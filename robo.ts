// =====================================================================
// Radar · robô "verificar" (versão 6: planos, várias lojas, alertas, e-mails, índice do nicho, Mercado Pago)
// - Site: lê produtos com foto, preço, preço antigo e desconto (JSON-LD,
//   Shopify e cartões de produto), promoções e frete. Corrige acentos.
// - Instagram (opcional): seguidores, posts com foto, curtidas, comentários,
//   engajamento e frequência, pela API oficial (Business Discovery).
// - Anúncios: link real da Biblioteca de Anúncios da Meta.
// - IA (Gemini): resumo, mudanças, plano para rebater, ideia de post e metas.
//
// Segredos: GEMINI_API_KEY, CRON_SECRET (obrigatórios)
//           IG_TOKEN, IG_USER_ID (para ligar o Instagram)
//           GEMINI_MODEL, IG_GRAPH_VERSION (opcionais)
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const GEMINI_KEY = env("GEMINI_API_KEY");
const CRON_SECRET = env("CRON_SECRET");
const IG_TOKEN = env("IG_TOKEN");
const IG_USER_ID = env("IG_USER_ID");
const GRAPH = "https://graph.facebook.com/" + (env("IG_GRAPH_VERSION") || "v26.0");
const MODELOS = [env("GEMINI_MODEL"), "gemini-3.8-flash", "gemini-flash-latest"].filter(Boolean);
const SEIS_HORAS = 6 * 3600 * 1000;
const POR_RODADA = 4;
const SITE_URL = env("SITE_URL") || "https://klayton-wj.github.io/radar/";
const MP_TOKEN = env("MP_ACCESS_TOKEN");
const SMTP_USER = env("SMTP_USER"), SMTP_PASS = env("SMTP_PASS");
const UA = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ------------------------------------------------------------ texto e acentos
const MARCA: Record<string, string> = { acute: "́", grave: "̀", circ: "̂", tilde: "̃", uml: "̈", cedil: "̧", ring: "̊" };
const NOMES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", ordm: "º", ordf: "ª", reg: "®", copy: "©", trade: "™",
  middot: "·", ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  bull: "•", deg: "°", times: "×", euro: "€", szlig: "ß", aelig: "æ", oslash: "ø",
};
function entidades(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    if (NOMES[e]) return NOMES[e];
    const k = e.match(/^([a-z])(acute|grave|circ|tilde|uml|cedil|ring)$/i);
    if (k) return (k[1] + MARCA[k[2].toLowerCase()]).normalize("NFC");
    return m;
  });
}
const limpa = (s: string) => entidades(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const corta = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + "…");
const num = (s: string) => Number(String(s).replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
const urlDe = (s: string) => (/^https?:\/\//i.test(s) ? s : "https://" + s.replace(/^\/+/, ""));
const abs = (u: string, base: string) => { try { return new URL(entidades(u.trim()), base).href; } catch { return ""; } };

async function hash(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function baixa(url: string, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal, redirect: "follow",
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "pt-BR,pt;q=0.9" },
    });
    const buf = new Uint8Array(await r.arrayBuffer());
    const cab = r.headers.get("content-type") || "";
    let cs = (cab.match(/charset=([\w-]+)/i) || [])[1] || "";
    if (!cs) {
      const cabeca = new TextDecoder("latin1").decode(buf.slice(0, 4096));
      cs = (cabeca.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || "utf-8";
    }
    let txt = "";
    try { txt = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { txt = new TextDecoder("utf-8").decode(buf); }
    return { ok: r.ok, status: r.status, url: r.url || url, tipo: cab, txt };
  } finally { clearTimeout(t); }
}

// ------------------------------------------------------------ produtos
type Produto = { nome: string; foto: string; preco: number | null; de: number | null; desconto: number | null; link: string };

function deJsonLd(html: string, base: string): Produto[] {
  const out: Produto[] = [];
  const visita = (o: any) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(visita);
    const t = [].concat(o["@type"] || []).join(",");
    if (/Product/i.test(t) && o.name) {
      const of = [].concat(o.offers || [])[0] as any || {};
      const img = [].concat(o.image || [])[0] as any;
      const preco = num(of.price ?? of.lowPrice ?? "");
      out.push({ nome: limpa(o.name), foto: abs(typeof img === "string" ? img : img?.url || "", base),
        preco: preco || null, de: null, desconto: null, link: abs(o.url || of.url || "", base) });
    }
    if (o.itemListElement) visita([].concat(o.itemListElement).map((x: any) => x.item || x));
    if (o["@graph"]) visita(o["@graph"]);
  };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visita(JSON.parse(m[1].trim())); } catch { /* ignora bloco inválido */ }
  }
  return out;
}

// lojas VTEX: catálogo público
async function deVtex(html: string, base: string): Promise<Produto[]> {
  if (!/vtex/i.test(html)) return [];
  try {
    const r = await baixa(new URL("/api/catalog_system/pub/products/search?_from=0&_to=23&O=OrderByReleaseDateDESC", base).href, 12000);
    const j = JSON.parse(r.txt);
    return (Array.isArray(j) ? j : []).map((p: any) => {
      const it = (p.items || [])[0] || {}, of = ((it.sellers || [])[0] || {}).commertialOffer || {};
      const preco = Number(of.Price) || null, de = Number(of.ListPrice) > Number(of.Price) ? Number(of.ListPrice) : null;
      return { nome: limpa(p.productName || ""), foto: ((it.images || [])[0] || {}).imageUrl || "", preco, de,
        desconto: de && preco ? Math.round((1 - preco / de) * 100) : null, link: p.link || "" };
    });
  } catch { return []; }
}
// lojas WooCommerce: Store API pública
async function deWoo(html: string, base: string): Promise<Produto[]> {
  if (!/woocommerce|wp-content/i.test(html)) return [];
  try {
    const r = await baixa(new URL("/wp-json/wc/store/v1/products?per_page=24&orderby=date", base).href, 12000);
    const j = JSON.parse(r.txt);
    return (Array.isArray(j) ? j : []).map((p: any) => {
      const pr = p.prices || {}, div = Math.pow(10, Number(pr.currency_minor_unit ?? 2));
      const preco = Number(pr.price) / div || null, regular = Number(pr.regular_price) / div;
      const de = regular > (preco || 0) ? regular : null;
      return { nome: limpa(p.name || ""), foto: ((p.images || [])[0] || {}).src || "", preco, de,
        desconto: de && preco ? Math.round((1 - preco / de) * 100) : null, link: p.permalink || "" };
    });
  } catch { return []; }
}
// qualquer loja: lê páginas de produto listadas no sitemap (dados estruturados de cada produto)
async function deSitemap(base: string): Promise<Produto[]> {
  try {
    const origem = new URL(base).origin;
    const urls: string[] = [];
    const robots = await baixa(origem + "/robots.txt", 8000).catch(() => null);
    const mapas = [...((robots?.txt || "").matchAll(/^sitemap:\s*(\S+)/gim))].map((m) => m[1]);
    if (!mapas.length) mapas.push(origem + "/sitemap.xml");
    const fila = [...mapas];
    for (let i = 0; i < fila.length && i < 6 && urls.length < 200; i++) {
      const x = await baixa(fila[i], 10000).catch(() => null);
      if (!x?.ok) continue;
      const locs = [...x.txt.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => entidades(m[1]));
      if (/<sitemapindex/i.test(x.txt)) {
        locs.sort((a, b) => (/product|produto/i.test(b) ? 1 : 0) - (/product|produto/i.test(a) ? 1 : 0)).slice(0, 4).forEach((l) => fila.push(l));
      } else urls.push(...locs);
    }
    const prod = urls.filter((u) => /\/(p|produto|produtos|product|products)\/|\/p$|\/p\?|-p\d+|\.html$/i.test(u)).slice(-200);
    const escolha = (prod.length ? prod : urls).slice(-10).reverse(); // os mais recentes costumam vir no fim
    const pags = await Promise.all(escolha.slice(0, 8).map((u) => baixa(u, 9000).catch(() => null)));
    const out: Produto[] = [];
    pags.forEach((pg, i) => {
      if (!pg?.ok) return;
      const j = deJsonLd(pg.txt, pg.url)[0];
      const meta = (n: string) => limpa((pg.txt.match(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']*)`, "i")) || [])[1] || "");
      const nome = j?.nome || meta("og:title"), foto = j?.foto || abs(meta("og:image"), pg.url);
      const preco = j?.preco || num(meta("product:price:amount") || meta("og:price:amount")) || null;
      if (nome && foto) out.push({ nome: corta(nome, 80), foto, preco, de: null, desconto: null, link: escolha[i] });
    });
    return out;
  } catch { return []; }
}

async function deShopify(html: string, base: string): Promise<Produto[]> {
  if (!/cdn\.shopify\.com|Shopify\.theme/i.test(html)) return [];
  try {
    const r = await baixa(new URL("/products.json?limit=24", base).href, 10000);
    const j = JSON.parse(r.txt);
    return (j.products || []).map((p: any) => {
      const v = (p.variants || [])[0] || {};
      const preco = num(v.price || ""), de = num(v.compare_at_price || "");
      return { nome: limpa(p.title), foto: (p.images || [])[0]?.src || "", preco: preco || null,
        de: de > preco ? de : null, desconto: de > preco ? Math.round((1 - preco / de) * 100) : null,
        link: new URL("/products/" + p.handle, base).href };
    });
  } catch { return []; }
}

function deCartoes(html: string, base: string): Produto[] {
  const out: Produto[] = [];
  const RUIM = /(logo|banner|icone|icon|selo|sprite|pagamento|bandeira|whats|instagram|facebook|seguran|ssl|placeholder|loading|avatar)/i;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const at = (n: string) => (tag.match(new RegExp(`\\b${n}=["']([^"']+)["']`, "i")) || [])[1] || "";
    const src = at("data-src") || at("data-lazy") || at("data-original") || (at("data-srcset") || at("srcset")).split(/[\s,]+/)[0] || at("src");
    const alt = limpa(at("alt") || at("title"));
    if (!src || src.startsWith("data:") || /\.svg(\?|$)/i.test(src) || alt.length < 6 || RUIM.test(alt) || RUIM.test(src)) continue;
    const pos = m.index || 0;
    let bruto = html.slice(pos, pos + 1200);
    const prox = bruto.slice(10).search(/<img\b/i);
    if (prox > 0) bruto = bruto.slice(0, prox + 10);
    const depois = limpa(bruto).replace(/\d{1,2}\s?x\s?(de\s?)?R\$\s?[\d.,]+/gi, " ").replace(/(acima|compras|pedidos|frete)[^R]{0,20}R\$\s?[\d.,]+/gi, " ");
    const precos = [...depois.matchAll(/R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+,\d{2})/g)].map((x) => num(x[1])).filter((v) => v > 0 && v < 50000);
    if (!precos.length) continue;
    const pc = (depois.match(/(\d{1,2})\s?%\s?(off|de desconto)/i) || [])[1];
    let preco = precos[0], de: number | null = null;
    if (precos[1] && precos[1] < precos[0] && precos[1] > precos[0] * 0.2) { de = precos[0]; preco = precos[1]; }
    const antes = html.slice(Math.max(0, pos - 800), pos);
    const href = [...antes.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)].pop()?.[1] || "";
    out.push({ nome: corta(alt, 80), foto: abs(src, base), preco, de, desconto: pc ? Number(pc) : de ? Math.round((1 - preco / de) * 100) : null, link: href ? abs(href, base) : "" });
  }
  return out;
}

async function lerSite(site: string) {
  const url = urlDe(site);
  try {
    const r = await baixa(url);
    if (!r.ok) {
      // página inicial bloqueada: tenta os caminhos públicos que a própria loja oferece (catálogo e mapa do site)
      if ([401, 403, 429, 503].includes(r.status)) {
        const base0 = r.url || url, todas = "vtex woocommerce cdn.shopify.com";
        let prods = [...(await deShopify(todas, base0)), ...(await deVtex(todas, base0)), ...(await deWoo(todas, base0))];
        let fonte = "api_da_loja";
        if (prods.filter((p) => p.foto).length < 3) { prods = [...prods, ...(await deSitemap(base0))]; fonte = "paginas_de_produto"; }
        const vistos = new Set<string>();
        const produtos = prods.filter((p) => { const k = p.nome.toLowerCase().slice(0, 50); if (!p.nome || !p.foto || vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 24);
        if (produtos.length) {
          const precos = produtos.map((p) => p.preco || 0).filter((v) => v > 0).sort((a, b) => a - b);
          const comDesc = produtos.filter((p) => p.desconto && p.desconto > 0).sort((a, b) => (b.desconto || 0) - (a.desconto || 0));
          const promocoes = comDesc.slice(0, 5).map((p) => `${p.desconto}% OFF em ${corta(p.nome, 45)}`);
          return {
            ok: true, bloqueado: true, status: r.status, url: base0, titulo: "", descricao: "", capa: "", titulos: [], promocoes, produtos, fonte,
            em_promocao: comDesc.length, faixa_precos: precos.length ? { min: precos[0], max: precos[precos.length - 1], mediana: precos[Math.floor(precos.length / 2)], quantidade: precos.length } : null,
            amostra: produtos.map((p) => p.nome + (p.preco ? " R$ " + p.preco : "")).join(" | "),
            assinatura: await hash(produtos.map((p) => p.nome + p.preco).join("|")),
          };
        }
      }
      return { ok: false, status: r.status, erro: "código " + r.status, url };
    }
    const html = r.txt.slice(0, 2_000_000);
    const base = r.url;
    const semScript = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ");
    const meta = (n: string) => limpa((html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]*content=["']([^"']*)`, "i"))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${n}["']`, "i")) || [])[1] || "");
    const titulo = limpa((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const descricao = meta("description") || meta("og:description");
    const capa = abs(meta("og:image"), base);
    const titulos = [...new Set([...semScript.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => limpa(m[1])))]
      .filter((t) => t.length > 2 && t.length < 90).slice(0, 20);
    const texto = limpa(semScript);

    // produtos: junta as fontes e tira repetidos
    let todos = [...deJsonLd(html, base), ...(await deShopify(html, base)), ...deCartoes(semScript, base)];
    let fonte = "pagina";
    if (todos.filter((p) => p.foto).length < 3) {
      const extra = [...(await deVtex(html, base)), ...(await deWoo(html, base))];
      if (extra.length) { todos = [...todos, ...extra]; fonte = "api_da_loja"; }
    }
    if (todos.filter((p) => p.foto).length < 3) {
      const sm = await deSitemap(base);
      if (sm.length) { todos = [...todos, ...sm]; fonte = "paginas_de_produto"; }
    }
    const vistos = new Set<string>();
    const produtos = todos.filter((p) => {
      const k = p.nome.toLowerCase().slice(0, 50);
      if (!p.nome || !p.foto || vistos.has(k)) return false;
      vistos.add(k); return true;
    }).slice(0, 24);

    // promoções curtas e legíveis
    const promocoes: string[] = [];
    const frete = texto.match(/frete gr[aá]tis[^.!|]{0,60}/i);
    if (frete) promocoes.push(corta(frete[0].trim(), 70));
    const parc = texto.match(/(\d{1,2})\s?x\s?(?:de\s?R\$\s?[\d.,]+\s?)?sem juros/i);
    if (parc) promocoes.push(`Parcelamento em até ${parc[1]}x sem juros`);
    const cupom = texto.match(/cupom[^.!|]{0,50}/i);
    if (cupom) promocoes.push(corta(cupom[0].trim(), 60));
    const comDesc = produtos.filter((p) => p.desconto && p.desconto > 0).sort((a, b) => (b.desconto || 0) - (a.desconto || 0));
    comDesc.slice(0, 4).forEach((p) => promocoes.push(`${p.desconto}% OFF em ${corta(p.nome, 45)}`));
    const desc = texto.match(/(liquida[cç][aã]o|queima de estoque|black friday|sale|outlet)[^.!|]{0,40}/i);
    if (desc) promocoes.push(corta(desc[0].trim(), 60));

    let precos = produtos.map((p) => p.preco || 0).filter((v) => v > 0);
    if (precos.length < 3) precos = [...texto.replace(/\d{1,2}\s?x\s?(de\s?)?R\$\s?[\d.,]+/gi, " ").replace(/(acima|compras|pedidos|frete|a partir)[^R]{0,25}R\$\s?[\d.,]+/gi, " ").matchAll(/R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+,\d{2})/g)].map((m) => num(m[1])).filter((v) => v >= 5 && v < 50000);
    precos.sort((a, b) => a - b);
    const faixa = precos.length ? { min: precos[0], max: precos[precos.length - 1], mediana: precos[Math.floor(precos.length / 2)], quantidade: precos.length } : null;

    return {
      ok: true, status: r.status, url: base, titulo, descricao, capa, titulos, promocoes: [...new Set(promocoes)].slice(0, 8),
      produtos, fonte, em_promocao: comDesc.length, faixa_precos: faixa, amostra: texto.slice(0, 5000),
      assinatura: await hash(titulo + titulos.join("|") + produtos.map((p) => p.nome + p.preco).join("|") + promocoes.join("|")),
    };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e), url };
  }
}

function compara(antes: any, agora: any) {
  if (!antes?.ok || !agora?.ok) return [];
  const m: string[] = [];
  const nomesA = new Set((antes.produtos || []).map((p: any) => p.nome));
  const novos = (agora.produtos || []).filter((p: any) => !nomesA.has(p.nome));
  if (antes.produtos?.length && novos.length) m.push(`${novos.length} produto(s) novo(s) na vitrine: ` + novos.slice(0, 3).map((p: any) => p.nome).join(", "));
  const promA = new Set(antes.promocoes || []);
  const np = (agora.promocoes || []).filter((x: string) => !promA.has(x));
  if (np.length) m.push("Nova promoção: " + np.slice(0, 2).join(" | "));
  const fa = antes.faixa_precos, fb = agora.faixa_precos;
  if (fa && fb && Math.abs(fb.mediana - fa.mediana) / fa.mediana > 0.07)
    m.push(`Preço típico mudou de R$ ${fa.mediana.toFixed(2).replace(".", ",")} para R$ ${fb.mediana.toFixed(2).replace(".", ",")}`);
  return m;
}

// ------------------------------------------------------------ Instagram
async function lerInstagram(usuario: string, limite = 24) {
  const u = (usuario || "").replace(/^@/, "").replace(/.*instagram\.com\//i, "").replace(/[/?#].*$/, "").trim();
  if (!u) return { ok: false, erro: "sem @" };
  if (!IG_TOKEN || !IG_USER_ID) return { ok: false, erro: "instagram_nao_conectado", usuario: u };
  const campos = `business_discovery.username(${u}){username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,` +
    `media.limit(${limite}){caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}`;
  try {
    const r = await fetch(`${GRAPH}/${IG_USER_ID}?fields=${encodeURIComponent(campos)}&access_token=${IG_TOKEN}`);
    const j = await r.json();
    if (!r.ok || !j.business_discovery) {
      const msg = j?.error?.message || "não encontrado";
      return { ok: false, usuario: u, erro: /not.*business|cannot be found|does not exist|Invalid user/i.test(msg) ? "conta_pessoal_ou_inexistente" : msg };
    }
    const b = j.business_discovery;
    const posts = (b.media?.data || []).map((p: any) => ({
      tipo: p.media_product_type === "REELS" ? "Reels" : p.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : p.media_type === "VIDEO" ? "Vídeo" : "Foto",
      foto: p.media_type === "VIDEO" ? (p.thumbnail_url || "") : (p.media_url || p.thumbnail_url || ""),
      legenda: corta((p.caption || "").replace(/\s+/g, " "), 600), link: p.permalink, data: p.timestamp,
      curtidas: typeof p.like_count === "number" ? p.like_count : null, comentarios: p.comments_count ?? 0,
    }));
    const seg = b.followers_count || 0;
    const ult = posts.slice(0, 12);
    const inter = ult.map((p: any) => (p.curtidas || 0) + (p.comentarios || 0));
    const media = inter.length ? inter.reduce((a: number, x: number) => a + x, 0) / inter.length : 0;
    posts.forEach((p: any) => { p.vezes_media = media ? +(((p.curtidas || 0) + (p.comentarios || 0)) / media).toFixed(1) : null; });
    // frequência: posts por semana considerando o período dos últimos 12 posts (mínimo de 4 semanas)
    const datas = ult.map((p: any) => Date.parse(p.data)).filter((t: number) => t > 0).sort((a: number, b: number) => b - a);
    const semanas = datas.length > 1 ? Math.max(4, (Date.now() - datas[datas.length - 1]) / (7 * 86400e3)) : 4;
    const ultimo_post_dias = datas.length ? Math.floor((Date.now() - datas[0]) / 86400e3) : null;
    const tipos: Record<string, number> = {};
    ult.forEach((p: any) => { tipos[p.tipo] = (tipos[p.tipo] || 0) + 1; });
    return {
      ok: true, usuario: b.username, nome: b.name, bio: b.biography || "", site: b.website || "", foto: b.profile_picture_url || "",
      seguidores: seg, seguindo: b.follows_count || 0, total_posts: b.media_count || 0,
      posts_semana: datas.length ? +(datas.length / semanas).toFixed(1) : 0, ultimo_post_dias, engajamento: seg ? +((media / seg) * 100).toFixed(2) : 0,
      interacoes_media: Math.round(media), curtidas_ocultas: ult.length > 0 && ult.filter((p: any) => p.curtidas == null).length >= ult.length / 2, tipos, ritmo: ritmo(posts), posts,
    };
  } catch (e) {
    return { ok: false, usuario: u, erro: e instanceof Error ? e.message : String(e) };
  }
}

// melhores dias e horários (horário de Brasília) por média de interações
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
function ritmo(posts: any[]) {
  const dias = DIAS.map((d) => ({ dia: d, posts: 0, inter: 0 }));
  const faixas: Record<string, { posts: number; inter: number }> = { "Manhã (6h–12h)": { posts: 0, inter: 0 }, "Tarde (12h–18h)": { posts: 0, inter: 0 }, "Noite (18h–24h)": { posts: 0, inter: 0 }, "Madrugada (0h–6h)": { posts: 0, inter: 0 } };
  const formatos: Record<string, { posts: number; inter: number }> = {};
  for (const p of posts) {
    const t = Date.parse(p.data); if (!t) continue;
    const br = new Date(t - 3 * 3600e3);
    const i = (p.curtidas || 0) + (p.comentarios || 0);
    const d = dias[br.getUTCDay()]; d.posts++; d.inter += i;
    const h = br.getUTCHours();
    const f = h < 6 ? "Madrugada (0h–6h)" : h < 12 ? "Manhã (6h–12h)" : h < 18 ? "Tarde (12h–18h)" : "Noite (18h–24h)";
    faixas[f].posts++; faixas[f].inter += i;
    formatos[p.tipo] = formatos[p.tipo] || { posts: 0, inter: 0 }; formatos[p.tipo].posts++; formatos[p.tipo].inter += i;
  }
  const med = (o: any) => (o.posts ? Math.round(o.inter / o.posts) : 0);
  return {
    dias: dias.map((d) => ({ dia: d.dia, posts: d.posts, media: med(d) })),
    faixas: Object.entries(faixas).map(([k, v]) => ({ faixa: k, posts: v.posts, media: med(v) })),
    formatos: Object.entries(formatos).map(([k, v]) => ({ formato: k, posts: v.posts, media: med(v) })).sort((a, b) => b.media - a.media),
  };
}

const bibliotecaAnuncios = (c: any) =>
  "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&media_type=all&search_type=keyword_unordered&q=" +
  encodeURIComponent((c.nome || c.instagram || "").replace(/^@/, ""));

// ------------------------------------------------------------ IA (Gemini)
let modeloBom = "";
async function chamaModelo(modelo: string, prompt: string, json = true) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: json ? { temperature: 0.6, responseMimeType: "application/json" } : { temperature: 0.6 } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${modelo}: ${j?.error?.message || r.status}`);
  const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  const limpo = txt.replace(/^[\s\S]*?(\{)/, "$1").replace(/\}[^}]*$/, "}");
  try { return { modelo, ...JSON.parse(limpo) }; } catch { throw new Error(`${modelo}: resposta fora do formato`); }
}
async function modelosDisponiveis() {
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": GEMINI_KEY } });
    const j = await r.json();
    const ver = (n: string) => Number((n.match(/(\d+(?:\.\d+)?)/) || [0, 0])[1]);
    return (j.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m: any) => String(m.name).replace(/^models\//, ""))
      .filter((n: string) => /flash/i.test(n) && !/(image|tts|audio|live|embedding|vision|exp|8b)/i.test(n) && !/preview/i.test(n))
      .sort((a: string, b: string) => ver(b) - ver(a) || (/lite/.test(a) ? 1 : 0) - (/lite/.test(b) ? 1 : 0));
  } catch { return []; }
}
const esgotado: Record<string, number> = {}; // modelo -> até quando evitar (cota estourada / sobrecarga)
let listaCache: { em: number; lista: string[] } = { em: 0, lista: [] };
async function gemini(prompt: string, leve = false) {
  if (!GEMINI_KEY) return { erro: "GEMINI_API_KEY não configurada" };
  if (Date.now() - listaCache.em > 3600e3) listaCache = { em: Date.now(), lista: await modelosDisponiveis() };
  const todos = listaCache.lista;
  const cheios = todos.filter((n) => !/lite/i.test(n)).slice(0, 3), lites = todos.filter((n) => /lite/i.test(n)).slice(0, 3);
  const base = [env("GEMINI_MODEL"), modeloBom, ...MODELOS.slice(1)].filter(Boolean);
  // rotina automática usa primeiro os modelos "lite" (cota grátis bem maior); pedidos do usuário usam primeiro os completos
  const ordem = [...new Set(leve ? [...lites, ...base, ...cheios] : [...base, ...cheios, ...lites])]
    .filter((m) => !(esgotado[m] > Date.now())).slice(0, 7);
  const erros: string[] = [];
  let soCota = true;
  for (const m of ordem) {
    for (const json of [true, false]) {
      try { const r = await chamaModelo(m, prompt, json); if (!/lite/i.test(m)) modeloBom = m; return r; }
      catch (e) {
        const msg = String(e instanceof Error ? e.message : e);
        erros.push(msg);
        if (/quota|exceeded|rate limit|RESOURCE_EXHAUSTED/i.test(msg)) esgotado[m] = Date.now() + 30 * 60e3;
        else if (/high demand|overloaded|unavailable|503/i.test(msg)) { esgotado[m] = Date.now() + 5 * 60e3; soCota = false; }
        else soCota = false;
        if (!/formato/.test(msg)) break;
      }
    }
  }
  if (!erros.length) return { erro: "Todos os modelos da IA estão no limite agora. Tente de novo em alguns minutos." };
  if (soCota) return { erro: "O limite diário gratuito da IA (Google Gemini) acabou por hoje. Ele volta amanhã — ou ative o faturamento no Google AI Studio para não ter limite." };
  return { erro: "A IA está sobrecarregada agora. Tente de novo em alguns minutos. (" + corta(erros.slice(-2).join(" | "), 240) + ")" };
}

function montaPrompt(loja: any, minhaIg: any, c: any, site: any, ig: any, mudancas: string[]) {
  const igTxt = ig?.ok ? JSON.stringify({
    seguidores: ig.seguidores, posts_por_semana: ig.posts_semana, engajamento_pct: ig.engajamento, formatos: ig.tipos, bio: ig.bio,
    ultimos_posts: ig.posts.slice(0, 10).map((p: any) => ({ tipo: p.tipo, legenda: p.legenda, curtidas: p.curtidas, comentarios: p.comentarios, vezes_media: p.vezes_media, data: p.data?.slice(0, 10) })),
  }) : "Instagram não disponível nesta leitura.";
  const siteTxt = site?.ok ? JSON.stringify({
    titulo: site.titulo, descricao: site.descricao, promocoes: site.promocoes, faixa_precos: site.faixa_precos, em_promocao: site.em_promocao,
    produtos: site.produtos.slice(0, 15).map((p: any) => ({ nome: p.nome, preco: p.preco, de: p.de, desconto: p.desconto })),
    texto: site.amostra?.slice(0, 2500),
  }) : "Site não disponível nesta leitura.";
  return `Você é um consultor de marketing para pequenos negócios no Brasil (lojas físicas e online de qualquer nicho). Português do Brasil, frases curtas, tom prático.

MINHA LOJA: ${lojaTxt(loja)}
${ADAPTA}
Sobre: ${loja?.descricao || "-"}
Meus números: ${minhaIg?.ok ? `${minhaIg.seguidores} seguidores, ${minhaIg.posts_semana} posts/semana, engajamento ${minhaIg.engajamento}%` : `${loja?.seguidores ?? "?"} seguidores (informado no cadastro)`}

CONCORRENTE: ${c.nome} (${c.instagram}${c.cidade ? ", " + c.cidade : ""})
INSTAGRAM DELA: ${igTxt}
SITE DELA: ${siteTxt}
MUDANÇAS DESDE A ÚLTIMA LEITURA: ${mudancas.length ? mudancas.join(" / ") : "nenhuma"}

Regras: use SOMENTE os dados acima. Não invente números, anúncios ou comentários. Se faltar dado, não afirme.
Responda APENAS com este JSON:
{
  "resumo": "1 ou 2 frases sobre o momento da concorrente",
  "fazendo": ["3 a 5 observações concretas (conteúdo, formatos que mais engajam, promoções, produtos, preços)"],
  "precos": "frase comparando a faixa de preço dela com uma loja como a minha",
  "mudancas": ["mudanças relevantes; lista VAZIA se não houver"],
  "rebater": [{"titulo": "ação curta", "texto": "como fazer, 1 ou 2 frases, específico para a minha loja"}],
  "ideia_post": {"formato": "Reels|Carrossel|Stories|Post", "titulo": "ideia de conteúdo", "porque": "por que funciona contra esta concorrente", "roteiro": ["0-3s: ...", "3-12s: ...", "12-24s: ...", "24-30s: ..."]},
  "metas": [{"titulo": "meta para 90 dias", "valor": "número ou frase curta", "porque": "baseado nos dados"}],
  "alerta": {"nivel": "baixo|medio|alto", "titulo": "manchete curta"}
}
"rebater": 3 ou 4 ações. "metas": 3 metas realistas.`;
}

// ------------------------------------------------------------ verificação
async function verificar(c: any) {
  let { data: loja } = c.empresa_id ? await db.from("empresas").select("*").eq("id", c.empresa_id).maybeSingle() : { data: null } as any;
  if (!loja) loja = (await db.from("empresas").select("*").eq("user_id", c.user_id).order("principal", { ascending: false }).limit(1).maybeSingle()).data;
  const { data: ant } = await db.from("verificacoes").select("dados").eq("concorrente_id", c.id)
    .order("feita_em", { ascending: false }).limit(1).maybeSingle();
  const [site, ig, minhaIg] = await Promise.all([
    c.site ? lerSite(c.site) : Promise.resolve({ ok: false, erro: "sem site cadastrado" } as any),
    lerInstagram(c.instagram),
    loja?.instagram ? lerInstagram(loja.instagram) : Promise.resolve({ ok: false } as any),
  ]);
  const mudancas = compara(ant?.dados?.site, site);
  if (ig.ok && ant?.dados?.instagram?.ok) {
    const dif = ig.seguidores - ant.dados.instagram.seguidores;
    if (Math.abs(dif) >= Math.max(20, ant.dados.instagram.seguidores * 0.01)) mudancas.push(`${dif > 0 ? "Ganhou" : "Perdeu"} ${Math.abs(dif)} seguidores desde a última leitura`);
    const antigos = new Set((ant.dados.instagram.posts || []).map((p: any) => p.link));
    const novos = ig.posts.filter((p: any) => !antigos.has(p.link)).length;
    if (novos) mudancas.push(`${novos} post(s) novo(s) no Instagram`);
  }
  const temDado = site.ok || ig.ok;
  const igAss = ig.ok ? ig.posts.map((p: any) => p.link + p.curtidas).join("|") : "";
  const assinatura = await hash(((site as any).assinatura || "") + igAss);
  const mesmaCoisa = ant?.dados?.assinatura === assinatura && ant?.dados?.ia && !ant.dados.ia.erro;
  const ia = !temDado ? { erro: "sem_dados" }
    : mesmaCoisa ? { ...ant!.dados.ia, reaproveitado: true }
    : await gemini(montaPrompt(loja, minhaIg, c, site, ig, mudancas), true);
  const { amostra: _a, ...siteSalvo } = site as any;
  const dados = { versao: 6, site: siteSalvo, instagram: ig, minha_loja: minhaIg, anuncios: { biblioteca: bibliotecaAnuncios(c) }, mudancas, ia, assinatura };
  const agora = new Date().toISOString();
  await db.from("verificacoes").insert({ concorrente_id: c.id, user_id: c.user_id, feita_em: agora, dados });
  await db.from("concorrentes").update({ ultima_verificacao: agora }).eq("id", c.id);
  // histórico: guarda as 40 últimas + 1 leitura por dia por até 120 dias (para relatórios e gráficos)
  const { data: velhas } = await db.from("verificacoes").select("id,feita_em").eq("concorrente_id", c.id)
    .order("feita_em", { ascending: false }).range(40, 2000);
  if (velhas?.length) {
    const dias = new Set<string>(), apagar: string[] = [];
    const limite = Date.now() - 120 * 86400e3;
    for (const v of velhas) {
      const dia = String(v.feita_em).slice(0, 10);
      if (Date.parse(v.feita_em) < limite || dias.has(dia)) apagar.push(v.id); else dias.add(dia);
    }
    for (let i = 0; i < apagar.length; i += 100) await db.from("verificacoes").delete().in("id", apagar.slice(i, i + 100));
  }
  // inspirações: posts que tiveram 2x ou mais a média de interações
  if (ig.ok) {
    const virais = ig.posts.filter((p: any) => (p.vezes_media || 0) >= 2 && p.link);
    if (virais.length) await db.from("analises").upsert(virais.map((p: any) => ({
      user_id: c.user_id, empresa_id: loja?.id || c.empresa_id, tipo: "swipe", chave: p.link,
      dados: { ...p, concorrente: c.nome, concorrente_id: c.id, usuario: ig.usuario, seguidores: ig.seguidores },
    })), { onConflict: "empresa_id,tipo,chave" });
  }
  // alertas (aparecem no sino do Radar e, nos planos com e-mail, chegam por e-mail)
  const alertas: any[] = [];
  const base = { user_id: c.user_id, empresa_id: loja?.id || c.empresa_id, concorrente_id: c.id };
  if (ig.ok) {
    const dois = Date.now() - 3 * 86400e3;
    ig.posts.filter((p: any) => (p.vezes_media || 0) >= 3 && Date.parse(p.data) > dois).forEach((p: any) =>
      alertas.push({ ...base, tipo: "viral", chave: p.link, titulo: `${c.nome} viralizou: ${p.tipo} com ${String(p.vezes_media).replace(".", ",")}x a média`, texto: corta(p.legenda || "", 200), link: p.link }));
    if (ant?.dados?.instagram?.ok) {
      const dif = ig.seguidores - ant.dados.instagram.seguidores;
      if (dif >= Math.max(100, ant.dados.instagram.seguidores * 0.03))
        alertas.push({ ...base, tipo: "seguidores", chave: c.id + ":" + hoje(), titulo: `${c.nome} ganhou ${dif} seguidores desde a última leitura`, texto: "Vale olhar o que ela postou ou anunciou.", link: `https://instagram.com/${ig.usuario}` });
    }
  }
  if (site.ok && ant?.dados?.site?.ok) {
    const velhas = new Set(ant.dados.site.promocoes || []);
    (site as any).promocoes.filter((x: string) => !velhas.has(x)).slice(0, 2).forEach((x: string) =>
      alertas.push({ ...base, tipo: "promocao", chave: c.id + ":" + x.slice(0, 80), titulo: `${c.nome} lançou promoção`, texto: x, link: (site as any).url }));
  }
  if (alertas.length) await db.from("alertas").upsert(alertas, { onConflict: "user_id,tipo,chave", ignoreDuplicates: true });
  return { id: c.id, nome: c.nome, site_ok: site.ok, ig_ok: ig.ok, ia_ok: !(ia as any).erro, feita_em: agora, dados };
}


// ------------------------------------------------------------ planejamento (etapa 5)
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
async function contexto(emp: any) {
  const loja = emp;
  const { data: cs } = await db.from("concorrentes").select("id,nome,instagram,cidade").eq("empresa_id", emp.id);
  const conc: any[] = [];
  for (const c of cs || []) {
    const { data: v } = await db.from("verificacoes").select("dados,feita_em").eq("concorrente_id", c.id).order("feita_em", { ascending: false }).limit(1).maybeSingle();
    const ig = v?.dados?.instagram, site = v?.dados?.site;
    conc.push({
      nome: c.nome, instagram: c.instagram,
      seguidores: ig?.ok ? ig.seguidores : null, engajamento: ig?.ok ? ig.engajamento : null, posts_semana: ig?.ok ? ig.posts_semana : null,
      ritmo: ig?.ok ? (ig.ritmo || ritmo(ig.posts || [])) : null,
      top_posts: ig?.ok ? [...(ig.posts || [])].sort((a: any, b: any) => (b.vezes_media || 0) - (a.vezes_media || 0)).slice(0, 4)
        .map((p: any) => ({ tipo: p.tipo, legenda: corta(p.legenda || "", 220), vezes_media: p.vezes_media, data: p.data?.slice(0, 10) })) : [],
      posts_recentes: ig?.ok ? (ig.posts || []).slice(0, 24).map((p: any) => ({ data: p.data?.slice(0, 10), legenda: corta(p.legenda || "", 120) })) : [],
      promocoes: site?.ok ? site.promocoes : [], preco_tipico: site?.ok ? site.faixa_precos?.mediana : null,
      resumo_ia: v?.dados?.ia?.resumo || null,
    });
  }
  const meu = loja?.instagram ? await lerInstagram(loja.instagram, 36) : { ok: false } as any;
  return { loja, conc, meu };
}
const modoTxt = (m: string) => ({ fisica: "loja física", online: "loja online", ambas: "loja física e online" } as any)[m] || "modalidade não informada";
const lojaTxt = (l: any) => `${l?.nome_fantasia || "-"} | nicho: ${l?.segmento || "-"} | ${modoTxt(l?.modalidade)} | ${l?.cidade || "-"} | Instagram ${l?.instagram || "-"} | sobre: ${l?.descricao || "-"}`;
const ADAPTA = "Adapte tudo ao nicho e à modalidade da loja: loja física pede ações locais (vitrine, Google Maps, WhatsApp, eventos no bairro, retirada); loja online pede frete, anúncios, prova social e conversão no site; restaurantes e serviços pedem agendamento, delivery e bastidores.";
const meuTxt = (m: any) => m?.ok ? JSON.stringify({ seguidores: m.seguidores, posts_semana: m.posts_semana, engajamento_pct: m.engajamento, ultimo_post_dias: m.ultimo_post_dias,
  ritmo: m.ritmo, bio: m.bio, posts: m.posts.slice(0, 20).map((p: any) => ({ tipo: p.tipo, legenda: corta(p.legenda || "", 160), curtidas: p.curtidas, comentarios: p.comentarios, vezes_media: p.vezes_media, data: p.data?.slice(0, 10) })) })
  : "Instagram da loja não disponível (conta pessoal ou não informada).";
const salva = (emp: any, tipo: string, chave: string, dados: any) =>
  db.from("analises").upsert({ user_id: emp.user_id, empresa_id: emp.id, tipo, chave, dados, criado_em: new Date().toISOString() }, { onConflict: "empresa_id,tipo,chave" });

async function analisarPerfil(emp: any) {
  const { loja, conc, meu } = await contexto(emp);
  if (!meu.ok) return { erro: meu.erro === "instagram_nao_conectado" ? "O Instagram ainda não foi conectado ao Radar." : "Não conseguimos ler o Instagram da sua loja. Ele precisa ser uma conta Comercial ou de Criador. Confira o @ em Minha loja." };
  const ia = await gemini(`Você é um estrategista de Instagram para pequenos negócios no Brasil (qualquer nicho, físico ou online). ${ADAPTA} Português do Brasil, direto e prático.
MINHA LOJA: ${lojaTxt(loja)}
MEU INSTAGRAM (dados reais): ${meuTxt(meu)}
CONCORRENTES (dados reais): ${JSON.stringify(conc.map((c) => ({ nome: c.nome, seguidores: c.seguidores, engajamento: c.engajamento, posts_semana: c.posts_semana, top_posts: c.top_posts })))}
Use só esses dados. Não invente números.
Responda APENAS com este JSON:
{"nota": 0-10, "diagnostico": "2 frases", "fortes": ["3 pontos fortes"], "fracos": ["3 pontos a melhorar"],
 "acoes": [{"titulo": "ação", "texto": "como fazer em 1-2 frases"}], "frequencia_ideal": "ex.: 4 posts e 10 stories por semana",
 "melhor_dia_horario": "frase usando o ritmo real", "bio_sugerida": "bio de até 150 caracteres", "comparacao": "1 frase comparando com as concorrentes"}
"acoes": 5 ações.`);
  const dados = { ...ia, meu: { ...meu, posts: meu.posts.slice(0, 36) }, gerado_em: new Date().toISOString() };
  await salva(emp, "perfil", "atual", dados);
  return dados;
}

async function gerarCalendario(emp: any, datas: any[]) {
  const { loja, conc, meu } = await contexto(emp);
  const nicho: Record<string, { posts: number; soma: number }> = {};
  conc.forEach((c) => (c.ritmo?.dias || []).forEach((d: any) => { nicho[d.dia] = nicho[d.dia] || { posts: 0, soma: 0 }; nicho[d.dia].posts += d.posts; nicho[d.dia].soma += d.media * d.posts; }));
  const diasNicho = Object.entries(nicho).map(([dia, v]) => ({ dia, posts: v.posts, media: v.posts ? Math.round(v.soma / v.posts) : 0 }));
  const ia = await gemini(`Você é social media de pequenos negócios no Brasil (qualquer nicho, físico ou online). ${ADAPTA} Monte o calendário de postagens da PRÓXIMA SEMANA (segunda a sábado) para a minha loja.
MINHA LOJA: ${lojaTxt(loja)}
MEU INSTAGRAM: ${meuTxt(meu)}
DIAS QUE MAIS ENGAJAM NO NICHO (concorrentes, dados reais): ${JSON.stringify(diasNicho)}
O QUE DEU CERTO NAS CONCORRENTES: ${JSON.stringify(conc.map((c) => ({ nome: c.nome, top_posts: c.top_posts, promocoes: c.promocoes })))}
DATAS COMERCIAIS PRÓXIMAS: ${JSON.stringify(datas || [])}
Hoje é ${hoje()}. Use os dados reais para escolher dia, horário e formato.
Responda APENAS com este JSON:
{"semana": [{"dia": "Segunda", "horario": "19:00", "formato": "Reels|Carrossel|Stories|Post", "tema": "título curto", "ideia": "o que mostrar, 1-2 frases", "legenda": "legenda pronta curta com CTA", "porque": "baseado em qual dado"}],
 "stories_diarios": "sugestão de rotina de stories", "observacao": "1 frase sobre a estratégia da semana"}
"semana": exatamente 6 itens, de Segunda a Sábado.`);
  const dados = { ...ia, nicho: diasNicho, meu_ritmo: meu.ok ? meu.ritmo : null, gerado_em: new Date().toISOString() };
  await salva(emp, "calendario", "atual", dados);
  return dados;
}

async function reescreverLegenda(emp: any, legenda: string, concorrente: string, tipo: string) {
  const loja = emp;
  return await gemini(`Você é copywriter de Instagram para pequenos negócios no Brasil. ${ADAPTA}
Esta legenda de ${concorrente || "uma concorrente"} (post em ${tipo || "formato não informado"}) teve muito mais engajamento que a média dela:
"""${String(legenda || "").slice(0, 1500)}"""
MINHA LOJA: ${lojaTxt(loja)}
Tarefa: explique o gancho que funcionou e escreva 2 legendas ORIGINAIS para a minha loja usando a mesma estratégia, sem copiar frases, no tom da minha marca.
Responda APENAS com este JSON:
{"gancho": "qual gancho/estrutura fez sucesso", "por_que_funcionou": "1-2 frases",
 "versoes": [{"titulo": "nome da abordagem", "legenda": "legenda completa com emojis moderados e CTA", "formato": "Reels|Carrossel|Post|Stories", "ideia_visual": "o que mostrar"}],
 "hashtags": ["5 a 8 hashtags relevantes"]}`);
}

async function gerarCampanha(emp: any, data: any) {
  const { loja, conc } = await contexto(emp);
  const ia = await gemini(`Você é estrategista de varejo e marketing local no Brasil (qualquer nicho, físico ou online). ${ADAPTA} Monte uma campanha para a data comercial abaixo.
DATA: ${data?.nome} em ${data?.data} (faltam ${data?.faltam} dias). Hoje é ${hoje()}.
MINHA LOJA: ${lojaTxt(loja)}
CONCORRENTES (dados reais: posts recentes, o que mais engajou, promoções no site): ${JSON.stringify(conc.map((c) => ({ nome: c.nome, top_posts: c.top_posts, posts_recentes: c.posts_recentes.slice(0, 12), promocoes: c.promocoes, preco_tipico: c.preco_tipico })))}
Se algum post das concorrentes falar desta data, use como referência do que elas costumam fazer. Não invente dados das concorrentes.
Responda APENAS com este JSON:
{"nome_campanha": "nome criativo", "conceito": "2 frases", "o_que_concorrentes_fazem": "o que os dados mostram (ou 'sem dados desta data')",
 "cronograma": [{"quando": "ex.: 15 dias antes", "acao": "o que fazer", "formato": "Reels|Carrossel|Stories|Post|Anúncio|WhatsApp"}],
 "ofertas": ["3 ideias de oferta que protegem a margem"], "criativos": [{"formato": "Reels|Carrossel|Stories", "ideia": "o que gravar/criar"}],
 "legenda_principal": "legenda pronta", "anuncio": {"publico": "sugestão de público", "verba_sugerida": "faixa em R$ por dia", "texto": "texto do anúncio"}}
"cronograma": 5 a 7 passos. "criativos": 4 ideias.`);
  const dados = { ...ia, data, gerado_em: new Date().toISOString() };
  await salva(emp, "campanha", String(data?.id || data?.data || "data"), dados);
  return dados;
}

// tendências: hashtags no Instagram (recurso "Instagram Public Content Access" da Meta)
async function lerTermo(t: any) {
  const tag = String(t.termo || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9_]/g, "");
  if (!tag) return { erro: "termo inválido" };
  if (!IG_TOKEN || !IG_USER_ID) return { erro: "instagram_nao_conectado" };
  let id = t.hashtag_id;
  if (!id) {
    const r = await fetch(`${GRAPH}/ig_hashtag_search?user_id=${IG_USER_ID}&q=${encodeURIComponent(tag)}&access_token=${IG_TOKEN}`);
    const j = await r.json();
    if (!r.ok) return { erro: j?.error?.message || "erro na busca", tag };
    id = j?.data?.[0]?.id;
    if (!id) return { erro: "hashtag não encontrada", tag };
  }
  const campos = "id,caption,media_type,like_count,comments_count,timestamp,permalink";
  const r2 = await fetch(`${GRAPH}/${id}/recent_media?user_id=${IG_USER_ID}&fields=${campos}&limit=50&access_token=${IG_TOKEN}`);
  const j2 = await r2.json();
  if (!r2.ok) return { erro: j2?.error?.message || "erro ao ler posts", tag, hashtag_id: id };
  const posts = j2.data || [];
  const r3 = await fetch(`${GRAPH}/${id}/top_media?user_id=${IG_USER_ID}&fields=${campos}&limit=6&access_token=${IG_TOKEN}`);
  const j3 = r3.ok ? await r3.json() : { data: [] };
  const inter = posts.map((p: any) => (p.like_count || 0) + (p.comments_count || 0));
  return {
    tag, hashtag_id: id,
    leitura: { em: new Date().toISOString(), posts_24h: posts.length, media_interacoes: inter.length ? Math.round(inter.reduce((a: number, b: number) => a + b, 0) / inter.length) : 0 },
    top: (j3.data || []).slice(0, 6).map((p: any) => ({ legenda: corta((p.caption || "").replace(/\s+/g, " "), 160), link: p.permalink, curtidas: p.like_count ?? null, comentarios: p.comments_count ?? 0, data: p.timestamp })),
  };
}
async function atualizarTermo(t: any) {
  const r: any = await lerTermo(t);
  const hist = Array.isArray(t.historico) ? t.historico : [];
  if (r.leitura) {
    const ant = hist.slice(-8).map((h: any) => h.posts_24h).filter((n: any) => typeof n === "number");
    const base = ant.length ? ant.reduce((a: number, b: number) => a + b, 0) / ant.length : 0;
    r.leitura.alta = base > 0 && r.leitura.posts_24h >= base * 1.6 && r.leitura.posts_24h >= 10;
    r.leitura.variacao = base ? Math.round((r.leitura.posts_24h / base - 1) * 100) : null;
    r.leitura.top = r.top;
    hist.push(r.leitura);
    if (r.leitura.alta) await db.from("alertas").upsert({ user_id: t.user_id, empresa_id: t.empresa_id, tipo: "tendencia", chave: t.id + ":" + hoje(),
      titulo: `#${t.termo} está em alta (+${r.leitura.variacao}%)`, texto: `${r.leitura.posts_24h} posts nas últimas 24 horas.`, link: (r.top || [])[0]?.link || null },
      { onConflict: "user_id,tipo,chave", ignoreDuplicates: true });
  } else {
    hist.push({ em: new Date().toISOString(), erro: r.erro });
  }
  await db.from("termos").update({ hashtag_id: r.hashtag_id || t.hashtag_id || null, historico: hist.slice(-60), ultima_leitura: new Date().toISOString() }).eq("id", t.id);
  return { ...r, historico: hist.slice(-60) };
}

// ------------------------------------------------------------ planos e uso da IA
const cachePlano: Record<string, { em: number; p: any }> = {};
async function planoDe(uid: string) {
  const c = cachePlano[uid];
  if (c && Date.now() - c.em < 60e3) return c.p;
  const { data } = await db.rpc("meu_plano", { uid });
  const p = (Array.isArray(data) ? data[0] : data) || { id: "gratis", max_lojas: 1, max_concorrentes: 2, max_termos: 0, intervalo_horas: 24, ia_mes: 5, recursos: [] };
  cachePlano[uid] = { em: Date.now(), p };
  return p;
}
const tem = (p: any, r: string) => (p?.recursos || []).includes(r);
const mesAtual = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);
async function usoIA(uid: string) {
  const { data } = await db.from("uso_ia").select("total").eq("user_id", uid).eq("mes", mesAtual()).maybeSingle();
  return data?.total || 0;
}
async function gastaIA(uid: string, p: any) {
  const usado = await usoIA(uid);
  if (usado >= p.ia_mes) return { erro: `Você usou os ${p.ia_mes} usos de IA do plano ${p.nome} neste mês. Faça upgrade em Planos para continuar.`, limite: true };
  await db.from("uso_ia").upsert({ user_id: uid, mes: mesAtual(), total: usado + 1 }, { onConflict: "user_id,mes" });
  return null;
}
const PRECISA: Record<string, string> = { perfil: "perfil", calendario: "calendario", campanha: "campanhas", reescrever: "inspiracoes", gerar: "gerador", indice: "indice" };
const NOME_REC: Record<string, string> = { perfil: "Meu perfil", calendario: "Calendário", campanhas: "Campanhas", inspiracoes: "Inspirações", gerador: "Criar com IA", indice: "Índice do nicho", aprovacao: "Aprovação do cliente" };

// ------------------------------------------------------------ gerador livre e índice do nicho
async function gerarLivre(emp: any, tipo: string, tema: string, tom: string) {
  const pedidos: Record<string, string> = {
    legenda: `3 legendas prontas sobre o tema, com emojis moderados e chamada para ação`,
    roteiro: `2 roteiros de Reels de 30 segundos, cada um com cenas e tempos (0-3s, 3-12s, 12-24s, 24-30s)`,
    stories: `uma sequência de 5 stories para o dia, com o que mostrar e o texto de cada um, incluindo enquete ou caixinha`,
    hashtags: `3 grupos de hashtags (alcance, nicho e local), 8 a 10 em cada`,
    ideias: `10 ideias de posts variadas (formato + título + por que funciona)`,
    anuncio: `2 textos de anúncio (título curto + texto) e sugestão de público`,
  };
  return await gemini(`Você é social media de pequenos negócios no Brasil. ${ADAPTA}
MINHA LOJA: ${lojaTxt(emp)}
TEMA: ${String(tema || "livre").slice(0, 300)}
TOM DE VOZ: ${String(tom || "o tom natural da marca").slice(0, 80)}
Crie: ${pedidos[tipo] || pedidos.legenda}.
Responda APENAS com este JSON:
{"titulo": "título curto do resultado", "itens": [{"titulo": "nome do item", "texto": "conteúdo completo pronto para copiar"}], "dica": "1 dica de uso"}`);
}

async function indiceNicho(emp: any) {
  const { data: lojas } = await db.from("empresas").select("id").eq("segmento", emp.segmento).limit(400);
  const ids = (lojas || []).map((l: any) => l.id);
  const { data: cs } = ids.length ? await db.from("concorrentes").select("id").in("empresa_id", ids).limit(1500) : { data: [] } as any;
  const vistos = new Set<string>(), valores: any[] = [];
  for (const c of (cs || []).slice(0, 300)) {
    const { data: v } = await db.from("verificacoes").select("dados->instagram").eq("concorrente_id", c.id).order("feita_em", { ascending: false }).limit(1).maybeSingle();
    const ig = (v as any)?.instagram;
    if (ig?.ok && !vistos.has(ig.usuario)) { vistos.add(ig.usuario); valores.push(ig); }
  }
  const med = (arr: number[]) => { const a = arr.filter((x) => x >= 0).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
  const formatos: Record<string, number> = {};
  valores.forEach((ig) => (ig.ritmo?.formatos || []).forEach((f: any) => { formatos[f.formato] = (formatos[f.formato] || 0) + f.posts; }));
  const meu = emp.instagram ? await lerInstagram(emp.instagram, 24) : { ok: false } as any;
  return {
    nicho: emp.segmento, perfis: valores.length,
    engajamento: med(valores.map((x) => x.engajamento)), posts_semana: med(valores.map((x) => x.posts_semana)),
    seguidores: med(valores.map((x) => x.seguidores)), formatos,
    meu: meu.ok ? { engajamento: meu.engajamento, posts_semana: meu.posts_semana, seguidores: meu.seguidores } : null,
    suficiente: valores.length >= 5, gerado_em: new Date().toISOString(),
  };
}

// ------------------------------------------------------------ e-mails (alertas e relatório mensal)
// envio de e-mail: Resend (se RESEND_API_KEY existir) ou SMTP do Gmail (porta 465), sem bibliotecas externas
const b64 = (s: string) => { const b = new TextEncoder().encode(s); let t = ""; for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(t); };
async function smtpEnvia(para: string, assunto: string, html: string) {
  const conn = await Deno.connectTls({ hostname: env("SMTP_HOST") || "smtp.gmail.com", port: Number(env("SMTP_PORT") || 465) });
  const dec = new TextDecoder(), enc = new TextEncoder(), buf = new Uint8Array(8192);
  const ler = async () => {
    let s = "";
    for (let i = 0; i < 50; i++) {
      const n = await conn.read(buf); if (n === null) break;
      s += dec.decode(buf.subarray(0, n));
      const linhas = s.split(/\r?\n/).filter(Boolean);
      if (linhas.length && /^\d{3} /.test(linhas[linhas.length - 1])) break;
    }
    return s;
  };
  const cmd = async (c: string, esperado: string) => {
    await conn.write(enc.encode(c + "\r\n"));
    const r = await ler();
    if (!r.startsWith(esperado) && !r.split(/\r?\n/).some((l) => l.startsWith(esperado + " "))) throw new Error("SMTP: " + r.slice(0, 200));
    return r;
  };
  try {
    await ler();
    await cmd("EHLO radar", "250");
    await cmd("AUTH LOGIN", "334");
    await cmd(btoa(SMTP_USER), "334");
    await cmd(btoa(SMTP_PASS), "235");
    await cmd(`MAIL FROM:<${SMTP_USER}>`, "250");
    await cmd(`RCPT TO:<${para}>`, "250");
    await cmd("DATA", "354");
    const corpo = b64(html).replace(/.{1,76}/g, "$&\r\n");
    const msg = [`From: =?UTF-8?B?${b64("Radar")}?= <${SMTP_USER}>`, `To: <${para}>`, `Subject: =?UTF-8?B?${b64(assunto)}?=`, `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", corpo].join("\r\n");
    await conn.write(enc.encode(msg + "\r\n.\r\n"));
    const r = await ler(); if (!r.startsWith("250")) throw new Error("SMTP: " + r.slice(0, 200));
    await conn.write(enc.encode("QUIT\r\n"));
    return true;
  } finally { try { conn.close(); } catch { /* ok */ } }
}
async function enviaEmail(para: string, assunto: string, html: string) {
  if (!para) return false;
  try {
    if (env("RESEND_API_KEY")) {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env("EMAIL_FROM") || "Radar <onboarding@resend.dev>", to: [para], subject: assunto, html }) });
      return r.ok;
    }
    if (!SMTP_USER || !SMTP_PASS) return false;
    return await smtpEnvia(para, assunto, html);
  } catch (e) { console.error("email", e); return false; }
}
const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]);
const moldura = (titulo: string, corpo: string) => `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:Segoe UI,Roboto,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table width="100%" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="height:6px;background:#d62976;background-image:linear-gradient(90deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)"></td></tr>
<tr><td style="padding:26px 28px 6px"><b style="font-size:20px;color:#15151f">Radar</b><h1 style="font-size:21px;margin:14px 0 0;color:#15151f">${titulo}</h1></td></tr>
<tr><td style="padding:8px 28px 26px;font-size:14.5px;line-height:1.55;color:#3b3b4a">${corpo}
<p style="margin-top:22px"><a href="${SITE_URL}app.html" style="background:#d62976;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;display:inline-block">Abrir o Radar</a></p></td></tr>
</table><p style="font-size:11px;color:#9a9aa8">Radar · Inteligência de concorrência para lojas e negócios</p></td></tr></table></body></html>`;

async function emailsDeAlerta() {
  const { data: pend } = await db.from("alertas").select("*").eq("enviado", false).order("criado_em").limit(200);
  if (!pend?.length) return 0;
  const porUser: Record<string, any[]> = {};
  pend.forEach((a: any) => (porUser[a.user_id] = porUser[a.user_id] || []).push(a));
  let n = 0;
  for (const [uid, lista] of Object.entries(porUser)) {
    const p = await planoDe(uid);
    if (tem(p, "alertas")) {
      const { data: pf } = await db.from("perfis").select("email,nome").eq("id", uid).maybeSingle();
      const corpo = `<p>Olá, ${esc((pf?.nome || "").split(" ")[0])}! O Radar encontrou novidades nas suas concorrentes:</p>` + lista.slice(0, 12).map((a) =>
        `<div style="border:1px solid #eeeef3;border-radius:12px;padding:12px 14px;margin:10px 0"><b style="color:#15151f">${esc(a.titulo)}</b>${a.texto ? `<div style="margin-top:4px">${esc(a.texto)}</div>` : ""}${a.link ? `<div style="margin-top:6px"><a href="${esc(a.link)}" style="color:#962fbf;font-weight:700">Ver ↗</a></div>` : ""}</div>`).join("");
      if (await enviaEmail(pf?.email, `Radar: ${lista.length} novidade(s) nas concorrentes`, moldura("Novidades nas concorrentes", corpo))) n++;
    }
    await db.from("alertas").update({ enviado: true }).in("id", lista.map((a) => a.id));
  }
  return n;
}

async function relatoriosMensais() {
  const agora = new Date(Date.now() - 3 * 3600e3);
  if (agora.getUTCDate() > 3 || agora.getUTCHours() < 8) return 0;   // dias 1 a 3 do mês, a partir das 8h
  const mes = mesAtual();
  const { data: pfs } = await db.from("perfis").select("id,nome,email,ultimo_relatorio,agencia_nome").or(`ultimo_relatorio.is.null,ultimo_relatorio.neq.${mes}`).limit(30);
  let n = 0;
  for (const pf of pfs || []) {
    const p = await planoDe(pf.id);
    if (!tem(p, "relatorio_mensal")) { await db.from("perfis").update({ ultimo_relatorio: mes }).eq("id", pf.id); continue; }
    const { data: lojas } = await db.from("empresas").select("*").eq("user_id", pf.id);
    const desde = new Date(Date.now() - 31 * 86400e3).toISOString();
    for (const emp of lojas || []) {
      const { data: cs } = await db.from("concorrentes").select("id,nome,instagram").eq("empresa_id", emp.id);
      const linhas: string[] = [];
      for (const c of cs || []) {
        const { data: hs } = await db.from("verificacoes").select("feita_em,seg:dados->instagram->seguidores,eng:dados->instagram->engajamento").eq("concorrente_id", c.id).gte("feita_em", desde).order("feita_em");
        const H = (hs || []).filter((h: any) => typeof h.seg === "number");
        const ini = H[0]?.seg, fim = H[H.length - 1]?.seg, eng = H[H.length - 1]?.eng;
        linhas.push(`<tr><td style="padding:8px 6px;border-bottom:1px solid #eee"><b>${esc(c.nome)}</b><br><span style="color:#888">${esc(c.instagram)}</span></td><td style="padding:8px 6px;border-bottom:1px solid #eee">${fim ?? "—"}</td><td style="padding:8px 6px;border-bottom:1px solid #eee">${ini != null && fim != null ? (fim - ini >= 0 ? "+" : "") + (fim - ini) : "—"}</td><td style="padding:8px 6px;border-bottom:1px solid #eee">${eng != null ? String(eng).replace(".", ",") + "%" : "—"}</td></tr>`);
      }
      const { data: virais } = await db.from("analises").select("dados").eq("empresa_id", emp.id).eq("tipo", "swipe").gte("criado_em", desde).limit(5);
      const corpo = `<p>Resumo dos últimos 30 dias de <b>${esc(emp.nome_fantasia)}</b>${tem(p, "marca_branca") && pf.agencia_nome ? `, preparado por <b>${esc(pf.agencia_nome)}</b>` : ""}.</p>
<table width="100%" style="border-collapse:collapse;font-size:13.5px"><tr style="color:#888;text-align:left"><th style="padding:6px">Concorrente</th><th style="padding:6px">Seguidores</th><th style="padding:6px">No mês</th><th style="padding:6px">Engaj.</th></tr>${linhas.join("") || '<tr><td colspan="4" style="padding:8px">Nenhuma concorrente cadastrada.</td></tr>'}</table>
${(virais || []).length ? `<p style="margin-top:16px"><b>Posts que mais engajaram nas concorrentes:</b></p>` + (virais || []).map((v: any) => `<p>• ${esc(v.dados?.concorrente)}: ${esc(corta(v.dados?.legenda || "", 120))} (${String(v.dados?.vezes_media || "").replace(".", ",")}x a média)</p>`).join("") : ""}
<p style="margin-top:16px">O relatório completo em PDF, com gráficos, está no Radar em <b>Planejar → Relatório PDF</b>.</p>`;
      const html = moldura(`Relatório mensal · ${esc(emp.nome_fantasia)}`, corpo);
      if (await enviaEmail(pf.email, `Relatório mensal de concorrência · ${emp.nome_fantasia}`, html)) n++;
      if (emp.cliente_email && emp.cliente_email !== pf.email) await enviaEmail(emp.cliente_email, `Relatório mensal de concorrência · ${emp.nome_fantasia}`, html);
    }
    await db.from("perfis").update({ ultimo_relatorio: mes }).eq("id", pf.id);
  }
  return n;
}

// ------------------------------------------------------------ Mercado Pago (assinatura mensal)
async function mp(path: string, metodo = "GET", corpo?: any) {
  const r = await fetch("https://api.mercadopago.com" + path, { method: metodo, headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || j?.error || ("Mercado Pago " + r.status));
  return j;
}
async function assinar(uid: string, email: string, planoId: string) {
  if (!MP_TOKEN) return { erro: "O pagamento ainda não foi configurado no Radar." };
  const { data: p } = await db.from("planos").select("*").eq("id", planoId).maybeSingle();
  if (!p || !(p.preco > 0)) return { erro: "Plano inválido." };
  const pre = await mp("/preapproval", "POST", {
    reason: `Radar · Plano ${p.nome}`, external_reference: `${uid}|${p.id}`, payer_email: email, back_url: SITE_URL + "app.html#planos",
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: Number(p.preco), currency_id: "BRL" }, status: "pending",
  });
  await db.from("assinaturas").upsert({ user_id: uid, plano: (await planoDe(uid)).id, status: "ativa", mp_preapproval_id: null, atualizado_em: new Date().toISOString() }, { onConflict: "user_id", ignoreDuplicates: true });
  return { link: pre.init_point, id: pre.id };
}
// pacotes de vagas extras: cada compra é uma assinatura própria ("uid|extra|pacote")
async function assinarExtra(uid: string, email: string, pacoteId: string) {
  if (!MP_TOKEN) return { erro: "O pagamento ainda não foi configurado no Radar." };
  const { data: k } = await db.from("pacotes").select("*").eq("id", pacoteId).eq("ativo", true).maybeSingle();
  if (!k) return { erro: "Pacote inválido." };
  await db.from("extras").delete().eq("user_id", uid).eq("status", "pendente").lt("criado_em", new Date(Date.now() - 86400e3).toISOString());
  const pre = await mp("/preapproval", "POST", {
    reason: `Radar · ${k.nome}`, external_reference: `${uid}|extra|${k.id}`, payer_email: email, back_url: SITE_URL + "app.html#planos",
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: Number(k.preco), currency_id: "BRL" }, status: "pending",
  });
  await db.from("extras").insert({ user_id: uid, pacote: k.id, quantidade: k.quantidade, status: "pendente", mp_preapproval_id: pre.id });
  return { link: pre.init_point, id: pre.id };
}
async function sincronizaExtra(pre: any, uid: string, pacoteId: string) {
  const { data: k } = await db.from("pacotes").select("quantidade").eq("id", pacoteId).maybeSingle();
  const st = pre.status;
  const linha: any = { user_id: uid, pacote: pacoteId, quantidade: k?.quantidade || 1, mp_preapproval_id: pre.id, atualizado_em: new Date().toISOString() };
  if (st === "authorized") {
    linha.status = "ativa";
    linha.valido_ate = pre.next_payment_date ? new Date(Date.parse(pre.next_payment_date) + 5 * 86400e3).toISOString() : null;
  } else if (st === "cancelled" || st === "paused") linha.status = "cancelada";
  else return { uid, status: st, extra: true };
  await db.from("extras").upsert(linha, { onConflict: "mp_preapproval_id" });
  return { uid, status: st, extra: true };
}
async function sincronizaAssinatura(preId: string) {
  const pre = await mp("/preapproval/" + preId);
  const partes = String(pre.external_reference || "").split("|");
  if (partes[1] === "extra" && partes[0] && partes[2]) return await sincronizaExtra(pre, partes[0], partes[2]);
  const [uid, planoId] = partes;
  if (!uid || !planoId) return { ignorado: true };
  const st = pre.status; // pending | authorized | paused | cancelled
  if (st === "authorized") {
    const prox = pre.next_payment_date ? new Date(Date.parse(pre.next_payment_date) + 5 * 86400e3).toISOString() : null;
    await db.from("assinaturas").upsert({ user_id: uid, plano: planoId, status: "ativa", mp_preapproval_id: preId, valido_ate: prox, atualizado_em: new Date().toISOString() }, { onConflict: "user_id" });
  } else if (st === "cancelled" || st === "paused") {
    const { data: a } = await db.from("assinaturas").select("mp_preapproval_id").eq("user_id", uid).maybeSingle();
    if (!a?.mp_preapproval_id || a.mp_preapproval_id === preId)
      await db.from("assinaturas").upsert({ user_id: uid, plano: "gratis", status: "ativa", mp_preapproval_id: null, valido_ate: null, atualizado_em: new Date().toISOString() }, { onConflict: "user_id" });
  }
  delete cachePlano[uid];
  return { uid, status: st };
}

// ------------------------------------------------------------ servidor
async function empresaDo(uid: string, empresaId?: string) {
  if (empresaId) {
    const { data } = await db.from("empresas").select("*").eq("id", empresaId).eq("user_id", uid).maybeSingle();
    if (data) return data;
  }
  const { data } = await db.from("empresas").select("*").eq("user_id", uid).order("principal", { ascending: false }).order("criado_em").limit(1).maybeSingle();
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // aviso do Mercado Pago (webhook): confere direto na API do Mercado Pago antes de mudar o plano
    if (url.searchParams.get("mp") === "1") {
      const id = body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");
      const tipo = body?.type || url.searchParams.get("type") || url.searchParams.get("topic") || "";
      if (id && /preapproval/.test(tipo) && MP_TOKEN) { try { await sincronizaAssinatura(String(id)); } catch (e) { console.error("mp", e); } }
      return resp({ ok: true });
    }

    // agendador
    if (CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET) {
      await db.rpc("vencer_assinaturas").then(() => {}, () => {});
      const limite = new Date(Date.now() - SEIS_HORAS + 5 * 60 * 1000).toISOString();
      const { data: candidatos, error } = await db.from("concorrentes").select("*").eq("pausada", false)
        .lte("ultima_verificacao", limite).order("ultima_verificacao", { ascending: true }).limit(40);
      if (error) return resp({ erro: error.message }, 500);
      const lista: any[] = [];
      for (const c of candidatos || []) {
        const p = await planoDe(c.user_id);
        if (Date.now() - Date.parse(c.ultima_verificacao) >= (p.intervalo_horas || 6) * 3600e3 - 5 * 60e3) lista.push(c);
        if (lista.length >= POR_RODADA) break;
      }
      const feitos = [];
      for (const c of lista) {
        try { const r = await verificar(c); feitos.push({ nome: r.nome, site_ok: r.site_ok, ig_ok: r.ig_ok, ia_ok: r.ia_ok }); }
        catch (e) { feitos.push({ nome: c.nome, erro: String(e) }); }
        await new Promise((ok) => setTimeout(ok, 1500));
      }
      const { data: ts } = await db.from("termos").select("*").lte("ultima_leitura", limite).order("ultima_leitura", { ascending: true }).limit(5);
      let termos = 0;
      for (const t of ts || []) { try { await atualizarTermo(t); termos++; } catch { /* segue */ } }
      const emails = await emailsDeAlerta().catch(() => 0);
      const relatorios = await relatoriosMensais().catch(() => 0);
      return resp({ verificados: feitos.length, feitos, termos, emails, relatorios });
    }

    // usuário logado
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return resp({ erro: "Faça login de novo." }, 401);
    const uid = u.user.id;

    if (body.acao === "apagar_conta") {
      const { data: a } = await db.from("assinaturas").select("mp_preapproval_id").eq("user_id", uid).maybeSingle();
      const { data: ex } = await db.from("extras").select("mp_preapproval_id").eq("user_id", uid).in("status", ["ativa", "pendente"]);
      const ids = [a?.mp_preapproval_id, ...(ex || []).map((x: any) => x.mp_preapproval_id)].filter(Boolean);
      if (MP_TOKEN) for (const id of ids) { try { await mp("/preapproval/" + id, "PUT", { status: "cancelled" }); } catch { /* segue */ } }
      const { error } = await db.auth.admin.deleteUser(uid);
      return error ? resp({ erro: error.message }, 500) : resp({ ok: true });
    }
    if (body.acao === "assinar") return resp(await assinar(uid, u.user.email || "", body.plano));
    if (body.acao === "assinar_extra") return resp(await assinarExtra(uid, u.user.email || "", body.pacote));
    if (body.acao === "cancelar_extra") {
      const { data: x } = await db.from("extras").select("*").eq("id", body.extra_id).eq("user_id", uid).maybeSingle();
      if (!x) return resp({ erro: "Pacote não encontrado." }, 404);
      if (x.mp_preapproval_id && MP_TOKEN) {
        try { await mp("/preapproval/" + x.mp_preapproval_id, "PUT", { status: "cancelled" }); } catch { /* já cancelado */ }
      }
      await db.from("extras").update({ status: "cancelada", atualizado_em: new Date().toISOString() }).eq("id", x.id);
      return resp({ ok: true });
    }
    if (body.acao === "cancelar_assinatura") {
      const { data: a } = await db.from("assinaturas").select("mp_preapproval_id").eq("user_id", uid).maybeSingle();
      if (!a?.mp_preapproval_id) return resp({ erro: "Não há assinatura paga ativa." });
      await mp("/preapproval/" + a.mp_preapproval_id, "PUT", { status: "cancelled" });
      await sincronizaAssinatura(a.mp_preapproval_id);
      return resp({ ok: true });
    }
    if (body.acao === "sincronizar_assinatura") {
      const { data: a } = await db.from("assinaturas").select("mp_preapproval_id").eq("user_id", uid).maybeSingle();
      const id = body.preapproval_id || a?.mp_preapproval_id;
      if (!id || !MP_TOKEN) return resp({ ok: true });
      const pre = await mp("/preapproval/" + id);
      if (!String(pre.external_reference || "").startsWith(uid + "|")) return resp({ erro: "Assinatura de outra conta." }, 403);
      return resp(await sincronizaAssinatura(id));
    }

    const p = await planoDe(uid);
    const emp = await empresaDo(uid, body.empresa_id);
    if (!emp && body.acao) return resp({ erro: "Loja não encontrada." }, 404);
    const rec = PRECISA[body.acao];
    if (rec && !tem(p, rec)) return resp({ erro: `${NOME_REC[rec] || "Este recurso"} não está no plano ${p.nome}. Veja os planos para liberar.`, bloqueado: rec }, 403);
    if (["perfil", "calendario", "campanha", "reescrever", "gerar"].includes(body.acao)) {
      const lim = await gastaIA(uid, p);
      if (lim) return resp(lim, 429);
    }
    if (body.acao === "perfil") return resp(await analisarPerfil(emp));
    if (body.acao === "calendario") return resp(await gerarCalendario(emp, body.datas || []));
    if (body.acao === "reescrever") return resp(await reescreverLegenda(emp, body.legenda, body.concorrente, body.tipo));
    if (body.acao === "campanha") return resp(await gerarCampanha(emp, body.data));
    if (body.acao === "gerar") return resp(await gerarLivre(emp, body.tipo, body.tema, body.tom));
    if (body.acao === "indice") { const r = await indiceNicho(emp); await salva(emp, "indice", "atual", r); return resp(r); }
    if (body.acao === "termo") {
      const { data: t } = await db.from("termos").select("*").eq("id", body.termo_id).eq("user_id", uid).maybeSingle();
      if (!t) return resp({ erro: "Termo não encontrado." }, 404);
      return resp(await atualizarTermo(t));
    }

    if (!body.concorrente_id) return resp({ erro: "concorrente_id faltando" }, 400);
    const { data: c } = await db.from("concorrentes").select("*").eq("id", body.concorrente_id).eq("user_id", uid).maybeSingle();
    if (!c) return resp({ erro: "Concorrente não encontrada." }, 404);
    if (c.pausada) return resp({ erro: "Esta concorrente está pausada porque passou do limite do seu plano. Compre vagas extras ou mude de plano para voltar a ler.", pausada: true }, 403);
    const { data: ultV } = await db.from("verificacoes").select("dados").eq("concorrente_id", c.id).order("feita_em", { ascending: false }).limit(1).maybeSingle();
    const podeRepetir = !ultV || !ultV.dados?.ia || ultV.dados.ia.erro || (ultV.dados.versao || 0) < 6;
    const espera = p.id === "gratis" ? 60 : 10; // minutos entre verificações manuais
    if (!podeRepetir && Date.now() - Date.parse(c.ultima_verificacao) < espera * 60 * 1000)
      return resp({ erro: p.id === "gratis" ? "No plano Grátis dá para verificar de novo 1 vez por hora. Nos planos pagos, a cada 10 minutos." : "Essa concorrente foi verificada há poucos minutos. Tente de novo daqui a pouco." }, 429);
    return resp(await verificar(c));
  } catch (e) {
    return resp({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});

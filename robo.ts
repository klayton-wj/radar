// =====================================================================
// Radar · robô "verificar" (versão 4)
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
    if (!r.ok) return { ok: false, status: r.status, erro: "código " + r.status, url };
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
    const todos = [...deJsonLd(html, base), ...(await deShopify(html, base)), ...deCartoes(semScript, base)];
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
      produtos, em_promocao: comDesc.length, faixa_precos: faixa, amostra: texto.slice(0, 5000),
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
async function lerInstagram(usuario: string) {
  const u = (usuario || "").replace(/^@/, "").replace(/.*instagram\.com\//i, "").replace(/[/?#].*$/, "").trim();
  if (!u) return { ok: false, erro: "sem @" };
  if (!IG_TOKEN || !IG_USER_ID) return { ok: false, erro: "instagram_nao_conectado", usuario: u };
  const campos = `business_discovery.username(${u}){username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count,` +
    `media.limit(24){caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}`;
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
      legenda: corta((p.caption || "").replace(/\s+/g, " "), 220), link: p.permalink, data: p.timestamp,
      curtidas: typeof p.like_count === "number" ? p.like_count : null, comentarios: p.comments_count ?? 0,
    }));
    const seg = b.followers_count || 0;
    const ult = posts.slice(0, 12);
    const inter = ult.map((p: any) => (p.curtidas || 0) + (p.comentarios || 0));
    const media = inter.length ? inter.reduce((a: number, x: number) => a + x, 0) / inter.length : 0;
    posts.forEach((p: any) => { p.vezes_media = media ? +(((p.curtidas || 0) + (p.comentarios || 0)) / media).toFixed(1) : null; });
    const d28 = Date.now() - 28 * 86400e3;
    const recentes = posts.filter((p: any) => Date.parse(p.data) > d28).length;
    const tipos: Record<string, number> = {};
    ult.forEach((p: any) => { tipos[p.tipo] = (tipos[p.tipo] || 0) + 1; });
    return {
      ok: true, usuario: b.username, nome: b.name, bio: b.biography || "", site: b.website || "", foto: b.profile_picture_url || "",
      seguidores: seg, seguindo: b.follows_count || 0, total_posts: b.media_count || 0,
      posts_semana: +(recentes / 4).toFixed(1), engajamento: seg ? +((media / seg) * 100).toFixed(2) : 0,
      interacoes_media: Math.round(media), tipos, posts,
    };
  } catch (e) {
    return { ok: false, usuario: u, erro: e instanceof Error ? e.message : String(e) };
  }
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
      .filter((n: string) => /flash/i.test(n) && !/(image|tts|audio|live|embedding|vision|exp|preview|8b)/i.test(n))
      .sort((a: string, b: string) => ver(b) - ver(a) || (/lite/.test(a) ? 1 : 0) - (/lite/.test(b) ? 1 : 0));
  } catch { return []; }
}
async function gemini(prompt: string) {
  if (!GEMINI_KEY) return { erro: "GEMINI_API_KEY não configurada" };
  const erros: string[] = [], tentados = new Set<string>();
  const tenta = async (lista: string[]) => {
    for (const m of lista) {
      if (!m || tentados.has(m)) continue;
      tentados.add(m);
      for (const json of [true, false]) {
        try { const r = await chamaModelo(m, prompt, json); modeloBom = m; return r; }
        catch (e) { erros.push(String(e instanceof Error ? e.message : e)); if (!/formato/.test(String(e))) break; }
      }
    }
    return null;
  };
  return (await tenta([modeloBom, ...MODELOS])) || (await tenta((await modelosDisponiveis()).slice(0, 4)))
    || { erro: erros.slice(-3).join(" | ") || "nenhum modelo disponível" };
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
  return `Você é um consultor de marketing para pequenas lojas de roupa no Brasil. Português do Brasil, frases curtas, tom prático.

MINHA LOJA: ${loja?.nome_fantasia || "-"} | ${loja?.segmento || "-"} | ${loja?.cidade || "-"} | Instagram ${loja?.instagram || "-"}
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
  const { data: loja } = await db.from("empresas").select("*").eq("user_id", c.user_id).maybeSingle();
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
    : await gemini(montaPrompt(loja, minhaIg, c, site, ig, mudancas));
  const { amostra: _a, ...siteSalvo } = site as any;
  const dados = { versao: 4, site: siteSalvo, instagram: ig, minha_loja: minhaIg, anuncios: { biblioteca: bibliotecaAnuncios(c) }, mudancas, ia, assinatura };
  const agora = new Date().toISOString();
  await db.from("verificacoes").insert({ concorrente_id: c.id, user_id: c.user_id, feita_em: agora, dados });
  await db.from("concorrentes").update({ ultima_verificacao: agora }).eq("id", c.id);
  const { data: velhas } = await db.from("verificacoes").select("id").eq("concorrente_id", c.id)
    .order("feita_em", { ascending: false }).range(40, 200);
  if (velhas?.length) await db.from("verificacoes").delete().in("id", velhas.map((v: any) => v.id));
  return { id: c.id, nome: c.nome, site_ok: site.ok, ig_ok: ig.ok, ia_ok: !(ia as any).erro, feita_em: agora, dados };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET) {
      const limite = new Date(Date.now() - SEIS_HORAS + 5 * 60 * 1000).toISOString();
      const { data: lista, error } = await db.from("concorrentes").select("*")
        .lte("ultima_verificacao", limite).order("ultima_verificacao", { ascending: true }).limit(POR_RODADA);
      if (error) return resp({ erro: error.message }, 500);
      const feitos = [];
      for (const c of lista || []) {
        try { const r = await verificar(c); feitos.push({ nome: r.nome, site_ok: r.site_ok, ig_ok: r.ig_ok, ia_ok: r.ia_ok }); }
        catch (e) { feitos.push({ nome: c.nome, erro: String(e) }); }
        await new Promise((ok) => setTimeout(ok, 1500));
      }
      return resp({ verificados: feitos.length, feitos });
    }
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return resp({ erro: "Faça login de novo." }, 401);
    if (!body.concorrente_id) return resp({ erro: "concorrente_id faltando" }, 400);
    const { data: c } = await db.from("concorrentes").select("*").eq("id", body.concorrente_id).eq("user_id", u.user.id).maybeSingle();
    if (!c) return resp({ erro: "Concorrente não encontrada." }, 404);
    const { data: ultV } = await db.from("verificacoes").select("dados").eq("concorrente_id", c.id).order("feita_em", { ascending: false }).limit(1).maybeSingle();
    const podeRepetir = !ultV || !ultV.dados?.ia || ultV.dados.ia.erro || (ultV.dados.versao || 0) < 4;
    if (!podeRepetir && Date.now() - Date.parse(c.ultima_verificacao) < 10 * 60 * 1000)
      return resp({ erro: "Essa concorrente foi verificada há poucos minutos. Tente de novo daqui a pouco." }, 429);
    return resp(await verificar(c));
  } catch (e) {
    return resp({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});

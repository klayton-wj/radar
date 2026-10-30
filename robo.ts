// =====================================================================
// Radar · Edge Function "verificar"
// Lê o site de cada concorrente, compara com a verificação anterior e
// pede para o Gemini escrever o resumo e o plano de resposta.
//
// Chamada de 2 jeitos:
//  1) Pelo agendador (pg_cron), com o cabeçalho x-cron-secret
//     → verifica até 4 concorrentes que estão há 6 horas ou mais sem verificação.
//  2) Pelo site, pelo botão "Verificar agora" (usuário logado)
//     → body { "concorrente_id": "..." } → verifica só aquela concorrente.
//
// Segredos (Edge Functions → Secrets):
//   GEMINI_API_KEY  (obrigatório)  chave do Google AI Studio
//   CRON_SECRET     (obrigatório)  uma senha qualquer, a mesma usada no agendador
//   GEMINI_MODEL    (opcional)     padrão: gemini-flash-latest
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem automaticamente.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const MODELOS = [Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest", "gemini-2.5-flash"];
const SEIS_HORAS = 6 * 3600 * 1000;
const POR_RODADA = 4;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------------------------------------------------------------- leitura do site
const limpa = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const meta = (html: string, nome: string) => {
  const r = new RegExp(`<meta[^>]+(?:name|property)=["']${nome}["'][^>]*content=["']([^"']*)["']`, "i");
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${nome}["']`, "i");
  return limpa((html.match(r) || html.match(r2) || [])[1] || "");
};
const urlDe = (s: string) => (/^https?:\/\//i.test(s) ? s : "https://" + s.replace(/^\/+/, ""));

async function lerSite(site: string) {
  const url = urlDe(site);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RadarBot/1.0; +https://klayton-wj.github.io/radar/)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    const html = (await r.text()).slice(0, 1_500_000);
    const semScript = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ");
    const titulo = limpa((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const descricao = meta(html, "description") || meta(html, "og:description");
    const titulos = [...semScript.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
      .map((m) => limpa(m[1].replace(/<[^>]+>/g, " "))).filter((t) => t.length > 2 && t.length < 140);
    const texto = limpa(semScript.replace(/<[^>]+>/g, " "));
    const precos = [...texto.matchAll(/R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:,\d{2})?)/g)]
      .map((m) => Number(m[1].replace(/\./g, "").replace(",", "."))).filter((v) => v > 0 && v < 20000);
    const PROMO = /(\d{1,2}\s?%\s?(?:off|de desconto)?|frete gr[aá]tis|cupom|liquida[cç][aã]o|promo[cç][aã]o|black friday|queima de estoque|leve \d+ pague \d+|desconto|lan[cç]amento|nova cole[cç][aã]o|sale)/gi;
    const promocoes = [...new Set(
      [...texto.matchAll(new RegExp(`.{0,60}${PROMO.source}.{0,60}`, "gi"))].map((m) => m[0].trim()),
    )].slice(0, 12);
    const ordenados = [...precos].sort((a, b) => a - b);
    const faixa = ordenados.length
      ? { min: ordenados[0], max: ordenados[ordenados.length - 1],
          mediana: ordenados[Math.floor(ordenados.length / 2)], quantidade: ordenados.length }
      : null;
    return {
      ok: r.ok, status: r.status, url: r.url || url, titulo, descricao,
      titulos: [...new Set(titulos)].slice(0, 25), promocoes, faixa_precos: faixa,
      amostra: texto.slice(0, 6000), tamanho: texto.length,
      assinatura: await hash(titulo + descricao + titulos.join("|") + promocoes.join("|") + ordenados.join(",")),
    };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e), url };
  } finally {
    clearTimeout(t);
  }
}

async function hash(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function compara(antes: any, agora: any) {
  if (!antes || !antes.ok || !agora.ok) return [];
  const m: string[] = [];
  const novos = (a: string[] = [], b: string[] = []) => b.filter((x) => !a.includes(x));
  const np = novos(antes.promocoes, agora.promocoes);
  if (np.length) m.push("Novas chamadas de promoção no site: " + np.slice(0, 3).join(" | "));
  const nt = novos(antes.titulos, agora.titulos);
  if (nt.length) m.push("Novas seções/títulos no site: " + nt.slice(0, 4).join(" | "));
  const fa = antes.faixa_precos, fb = agora.faixa_precos;
  if (fa && fb && Math.abs(fb.mediana - fa.mediana) / fa.mediana > 0.05)
    m.push(`Preço típico mudou de R$ ${fa.mediana.toFixed(2)} para R$ ${fb.mediana.toFixed(2)}`);
  if (antes.titulo !== agora.titulo) m.push(`Título do site mudou para "${agora.titulo}"`);
  return m;
}

// ---------------------------------------------------------------- IA (Gemini)
async function gemini(prompt: string) {
  if (!GEMINI_KEY) return { erro: "GEMINI_API_KEY não configurada" };
  let ultimoErro = "";
  for (const modelo of MODELOS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, responseMimeType: "application/json" },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { ultimoErro = `${modelo}: ${j?.error?.message || r.status}`; continue; }
    const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
    try { return { modelo, ...JSON.parse(txt.replace(/^```json|```$/g, "").trim()) }; }
    catch { ultimoErro = `${modelo}: resposta fora do formato`; }
  }
  return { erro: ultimoErro };
}

function montaPrompt(loja: any, c: any, site: any, mudancas: string[]) {
  return `Você é um consultor de marketing para pequenas lojas de roupa no Brasil. Escreva em português do Brasil, frases curtas, tom prático, sem jargão.

MINHA LOJA
- Nome: ${loja?.nome_fantasia || "-"} | Segmento: ${loja?.segmento || "-"} | Cidade: ${loja?.cidade || "-"}
- Instagram: ${loja?.instagram || "-"} | Seguidores: ${loja?.seguidores ?? "-"}
- Sobre: ${loja?.descricao || "-"}

CONCORRENTE: ${c.nome} (${c.instagram}${c.cidade ? ", " + c.cidade : ""})
DADOS LIDOS DO SITE (${site.url || c.site}):
${site.ok ? JSON.stringify({
    titulo: site.titulo, descricao: site.descricao, titulos: site.titulos,
    promocoes: site.promocoes, faixa_precos: site.faixa_precos, amostra_do_texto: site.amostra?.slice(0, 4000),
  }) : "Não foi possível ler o site agora (" + (site.erro || site.status) + ")."}
MUDANÇAS DESDE A ÚLTIMA VERIFICAÇÃO: ${mudancas.length ? mudancas.join(" / ") : "nenhuma detectada (ou é a primeira verificação)"}

Use SOMENTE as informações acima. Não invente números de seguidores, curtidas ou anúncios. Se algo não aparece nos dados, não afirme.

Responda APENAS com este JSON:
{
  "resumo": "1 ou 2 frases sobre o momento da concorrente",
  "fazendo": ["3 a 5 observações concretas do que ela está fazendo (promoções, coleções, preços, apelos)"],
  "promocoes": ["promoções ativas encontradas, em texto curto"],
  "precos": "frase sobre a faixa de preço dela comparada a uma loja como a minha",
  "mudancas": ["o que mudou desde a última verificação, se houver"],
  "rebater": [{"titulo": "ação curta", "texto": "como fazer, em 1 ou 2 frases, específico para a minha loja"}],
  "ideia_post": {"formato": "Reels|Carrossel|Stories|Post", "titulo": "ideia de conteúdo", "porque": "por que funciona contra esta concorrente"},
  "alerta": {"nivel": "baixo|medio|alto", "titulo": "manchete curta para a notificação"}
}
Em "rebater", dê de 3 a 4 ações.`;
}

// ---------------------------------------------------------------- verificação
async function verificar(c: any) {
  const { data: loja } = await db.from("empresas").select("*").eq("user_id", c.user_id).maybeSingle();
  const { data: ant } = await db.from("verificacoes").select("dados").eq("concorrente_id", c.id)
    .order("feita_em", { ascending: false }).limit(1).maybeSingle();
  const site = c.site ? await lerSite(c.site) : { ok: false, erro: "sem site cadastrado" };
  const mudancas = compara(ant?.dados?.site, site);
  const mesmaCoisa = site.ok && ant?.dados?.site?.assinatura === (site as any).assinatura && ant?.dados?.ia && !ant.dados.ia.erro;
  const ia = mesmaCoisa ? { ...ant!.dados.ia, reaproveitado: true } : await gemini(montaPrompt(loja, c, site, mudancas));
  const { amostra: _a, ...siteSalvo } = site as any;
  const dados = { site: siteSalvo, mudancas, ia };
  const agora = new Date().toISOString();
  await db.from("verificacoes").insert({ concorrente_id: c.id, user_id: c.user_id, feita_em: agora, dados });
  await db.from("concorrentes").update({ ultima_verificacao: agora }).eq("id", c.id);
  // guarda só as 40 verificações mais recentes de cada concorrente
  const { data: velhas } = await db.from("verificacoes").select("id").eq("concorrente_id", c.id)
    .order("feita_em", { ascending: false }).range(40, 200);
  if (velhas?.length) await db.from("verificacoes").delete().in("id", velhas.map((v) => v.id));
  return { id: c.id, nome: c.nome, site_ok: site.ok, ia_ok: !(ia as any).erro, feita_em: agora, dados };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));

    // 1) agendador
    if (CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET) {
      const limite = new Date(Date.now() - SEIS_HORAS + 5 * 60 * 1000).toISOString();
      const { data: lista, error } = await db.from("concorrentes").select("*")
        .lte("ultima_verificacao", limite).order("ultima_verificacao", { ascending: true }).limit(POR_RODADA);
      if (error) return resp({ erro: error.message }, 500);
      const feitos = [];
      for (const c of lista || []) {
        try { const r = await verificar(c); feitos.push({ nome: r.nome, site_ok: r.site_ok, ia_ok: r.ia_ok }); }
        catch (e) { feitos.push({ nome: c.nome, erro: String(e) }); }
        await new Promise((ok) => setTimeout(ok, 1500)); // respeita o limite gratuito do Gemini
      }
      return resp({ verificados: feitos.length, feitos });
    }

    // 2) usuário logado, botão "Verificar agora"
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return resp({ erro: "Faça login de novo." }, 401);
    if (!body.concorrente_id) return resp({ erro: "concorrente_id faltando" }, 400);
    const { data: c } = await db.from("concorrentes").select("*").eq("id", body.concorrente_id).eq("user_id", u.user.id).maybeSingle();
    if (!c) return resp({ erro: "Concorrente não encontrada." }, 404);
    const ult = Date.parse(c.ultima_verificacao);
    const { count } = await db.from("verificacoes").select("id", { count: "exact", head: true }).eq("concorrente_id", c.id);
    if (count && Date.now() - ult < 10 * 60 * 1000) return resp({ erro: "Essa concorrente foi verificada há poucos minutos. Tente de novo daqui a pouco." }, 429);
    return resp(await verificar(c));
  } catch (e) {
    return resp({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});

export function montaCriacao(G: any) {
const { db, corta, lerSite, salva, lerInstagram, gemini, iaVisao, lojaTxt, contexto, ADAPTA, hoje, env, tem, planoDe, GRAPH, UA, baixa, urlDe } = G;
const PEDIDOS: Record<string, string> = {
post: `um POST COMPLETO pronto para publicar`,
legenda: `3 legendas prontas, cada uma com gancho forte na primeira linha, emojis moderados e chamada para ação`,
roteiro: `2 roteiros de Reels de 15 a 30 segundos, com cenas e tempos (0-3s, 3-12s, 12-24s, 24-30s), texto na tela e áudio sugerido`,
carrossel: `1 carrossel de 6 a 8 telas: texto de cada tela (capa que prende, conteúdo, tela final com chamada) e a legenda`,
stories: `uma sequência de 5 a 7 stories para hoje, com o que mostrar, o texto de cada um e pelo menos uma enquete ou caixinha`,
hashtags: `3 grupos de hashtags (alcance, nicho e local), 8 a 10 em cada, sem hashtags proibidas ou genéricas demais`,
ideias: `10 ideias de posts variadas (formato + título + por que funciona, citando o dado em que se baseia)`,
anuncio: `2 anúncios para Instagram/Facebook (título curto + texto + chamada) e sugestão de público e verba diária`,
whatsapp: `3 mensagens curtas para lista de transmissão ou status do WhatsApp, com chamada para responder`,
};
const AJUSTES: Record<string, string> = {
curto: "deixe bem mais curto e direto, mantendo a ideia e a chamada para ação",
vendedor: "deixe mais vendedor: benefício claro, urgência honesta (sem inventar prazo ou desconto) e chamada para ação forte",
divertido: "deixe mais divertido e leve, com humor do dia a dia, sem perder a chamada para ação",
formal: "deixe mais profissional e elegante",
outra: "escreva uma versão totalmente diferente, com outro gancho e outra estrutura",
emoji: "tire quase todos os emojis",
};

function vozTxt(emp: any) {
const v = emp?.voz || {};
const partes = [v.resumo && `jeito de falar: ${v.resumo}`, v.tom && `tom: ${v.tom}`, v.emojis && `emojis: ${v.emojis}`, v.tamanho && `tamanho das legendas: ${v.tamanho}`,
v.cta && `chamada para ação preferida: ${v.cta}`, v.expressoes?.length && `expressões da marca: ${v.expressoes.join(", ")}`,
v.evitar?.length && `evitar: ${v.evitar.join(", ")}`, v.regras && `REGRAS DO DONO (obrigatórias): ${String(v.regras).slice(0, 600)}`].filter(Boolean);
return partes.length ? partes.join(" | ") : "ainda não definida (use um tom natural, próximo e claro)";
}

function melhoresHorarios(conc: any[]) {
const dias: Record<string, { n: number; s: number }> = {}, faixas: Record<string, { n: number; s: number }> = {};
conc.forEach((c) => {
(c.ritmo?.dias || []).forEach((d: any) => { dias[d.dia] = dias[d.dia] || { n: 0, s: 0 }; dias[d.dia].n += d.posts; dias[d.dia].s += d.media * d.posts; });
(c.ritmo?.faixas || []).forEach((d: any) => { faixas[d.faixa] = faixas[d.faixa] || { n: 0, s: 0 }; faixas[d.faixa].n += d.posts; faixas[d.faixa].s += d.media * d.posts; });
});
const top = (o: any) => Object.entries(o).map(([k, v]: any) => ({ k, media: v.n ? Math.round(v.s / v.n) : 0, posts: v.n })).filter((x) => x.posts >= 2).sort((a, b) => b.media - a.media).slice(0, 3);
return { dias: top(dias), faixas: top(faixas) };
}

async function aprendizados(emp: any) {
const { data } = await db.from("conteudos").select("titulo,tipo,dados,desempenho").eq("empresa_id", emp.id).not("desempenho", "is", null).order("criado_em", { ascending: false }).limit(30);
const l = (data || []).filter((x: any) => x.desempenho?.vezes_media != null).sort((a: any, b: any) => b.desempenho.vezes_media - a.desempenho.vezes_media);
const fmt = (x: any) => ({ titulo: x.titulo, formato: x.dados?.formato || x.tipo, gancho: corta(x.dados?.gancho || x.dados?.legenda || "", 140), vezes_media: x.desempenho.vezes_media });
return { melhores: l.slice(0, 3).map(fmt), piores: l.length > 3 ? l.slice(-2).map(fmt) : [] };
}

async function meusProdutos(emp: any, ler = false) {
const { data: a } = await db.from("analises").select("dados,criado_em").eq("empresa_id", emp.id).eq("tipo", "meus_produtos").eq("chave", "atual").maybeSingle();
if (!ler) return a?.dados || null;
if (!emp.site) return { erro: "Cadastre o site da sua loja em Minha loja para o Radar ler seus produtos." };
const s: any = await lerSite(emp.site);
if (!s.ok) return { erro: "Não conseguimos ler o seu site agora. (" + corta(s.erro || "erro", 120) + ")" };
const dados = { produtos: (s.produtos || []).slice(0, 24), promocoes: s.promocoes || [], url: s.url, lido_em: new Date().toISOString() };
await salva(emp, "meus_produtos", "atual", dados);
return dados;
}

async function aprenderVoz(emp: any) {
const meu: any = emp.instagram ? await lerInstagram(emp.instagram, 30) : { ok: false };
if (!meu.ok) return { erro: "Não conseguimos ler o Instagram da sua loja. Ele precisa ser uma conta Comercial ou de Criador." };
const legs = meu.posts.map((p: any) => p.legenda).filter((x: string) => x && x.length > 20).slice(0, 30);
if (legs.length < 3) return { erro: "Seu Instagram tem poucas legendas para a IA aprender o seu jeito. Escreva as regras da marca à mão." };
const ia: any = await gemini(`Analise as legendas reais desta loja no Instagram e descreva a VOZ DA MARCA para que outra pessoa escreva igual.
LOJA: ${lojaTxt(emp)}
LEGENDAS (mais recentes primeiro): ${JSON.stringify(legs.map((l: string) => corta(l, 400)))}
Responda APENAS com este JSON:
{"resumo": "1-2 frases sobre o jeito de falar", "tom": "3 adjetivos", "emojis": "quanto e quais usa", "tamanho": "curtas, médias ou longas", "cta": "como costuma chamar para ação",
"expressoes": ["até 6 expressões ou bordões que a marca repete"], "evitar": ["até 4 coisas que destoam da marca"], "exemplo": "uma legenda nova curta escrita nesse estilo"}`);
if (ia.erro) return ia;
const voz = { ...ia, regras: emp.voz?.regras || "", aprendida_em: new Date().toISOString(), legendas_lidas: legs.length };
delete (voz as any).modelo;
await db.from("empresas").update({ voz }).eq("id", emp.id);
return voz;
}

async function baseDoAlerta(uid: string, alertaId: string) {
const { data: a } = await db.from("alertas").select("*").eq("id", alertaId).eq("user_id", uid).maybeSingle();
if (!a) return null;
return { origem: "alerta", tipo_alerta: a.tipo, titulo: a.titulo, texto: a.texto, link: a.link };
}

async function gerarLivre(emp: any, b: any) {
const tipo = PEDIDOS[b.tipo] ? b.tipo : "post";
const [{ conc, meu }, aprend] = await Promise.all([contexto(emp), aprendizados(emp)]);
const prods: any = b.produto ? null : await meusProdutos(emp).catch(() => null);
const horarios = melhoresHorarios(conc);
const virais = conc.flatMap((c: any) => (c.top_posts || []).filter((p: any) => (p.vezes_media || 0) >= 1.5).map((p: any) => ({ concorrente: c.nome, ...p })))
.sort((x: any, y: any) => (y.vezes_media || 0) - (x.vezes_media || 0)).slice(0, 8);
const meusMelhores = meu.ok ? [...meu.posts].sort((x: any, y: any) => (y.vezes_media || 0) - (x.vezes_media || 0)).slice(0, 5)
.map((p: any) => ({ tipo: p.tipo, legenda: corta(p.legenda || "", 200), vezes_media: p.vezes_media })) : [];
const base = b.alerta_id ? await baseDoAlerta(emp.user_id, b.alerta_id) : b.base || null;
const qtd = Math.min(2, Math.max(1, Number(b.versoes) || 1));
const formatoPost = tipo === "post"
? `"itens": ${qtd} item(ns), cada um: {"titulo": "nome da ideia", "formato": "Reels|Carrossel|Foto|Stories", "gancho": "frase dos 3 primeiros segundos ou primeira linha", "capa": "texto curto para a capa/arte (até 8 palavras)",
"roteiro": ["cenas ou telas, na ordem, com tempo quando for vídeo"], "legenda": "legenda completa pronta", "hashtags": ["8 a 12"], "stories": ["2 a 3 stories para divulgar o post"],
"quando": "dia e horário sugeridos, usando os horários reais do nicho", "baseado_em": "qual dado real inspirou (post de concorrente, seu melhor post, promoção, aprendizado)", "texto": "a legenda completa de novo"}`
: `"itens": cada item {"titulo": "nome", "texto": "conteúdo completo pronto para copiar", "baseado_em": "qual dado real inspirou (curto)"}`;
const prompt = `Você é o melhor social media de pequenos negócios do Brasil. ${ADAPTA} Português do Brasil.
Crie: ${PEDIDOS[tipo]}${qtd > 1 && tipo === "post" ? " — 2 versões bem diferentes para teste A/B" : ""}.
MINHA LOJA: ${lojaTxt(emp)}
VOZ DA MARCA: ${vozTxt(emp)}
${b.tom && b.tom !== "voz" ? `TOM PEDIDO AGORA: ${String(b.tom).slice(0, 80)}` : ""}
TEMA PEDIDO: ${String(b.tema || "livre: escolha o tema com mais chance de resultado agora, pelos dados abaixo").slice(0, 400)}
${b.produto ? `PRODUTO EM DESTAQUE (real, do meu site): ${JSON.stringify(b.produto).slice(0, 400)}` : prods?.produtos?.length ? `MEUS PRODUTOS (reais, do meu site; use se combinar com o tema): ${JSON.stringify(prods.produtos.slice(0, 10).map((p: any) => ({ nome: p.nome, preco: p.preco })))}` : ""}
${base ? `RESPONDER A ESTE MOVIMENTO DA CONCORRÊNCIA (o post deve rebater sem citar o nome dela e sem guerra de preço se não for preciso): ${JSON.stringify(base).slice(0, 700)}` : ""}
POSTS QUE MAIS FUNCIONARAM NAS CONCORRENTES (dados reais; vezes_media = quantas vezes a média de interações): ${JSON.stringify(virais).slice(0, 2500)}
MEUS POSTS QUE MAIS FUNCIONARAM: ${JSON.stringify(meusMelhores).slice(0, 1200)}
O QUE JÁ FUNCIONOU COM POSTS CRIADOS AQUI (medido no meu Instagram): ${JSON.stringify(aprend).slice(0, 900)}
PROMOÇÕES ATIVAS DAS CONCORRENTES: ${JSON.stringify(conc.map((c: any) => ({ nome: c.nome, promocoes: (c.promocoes || []).slice(0, 3), preco_tipico: c.preco_tipico }))).slice(0, 900)}
MELHORES DIAS E FAIXAS DE HORÁRIO DO NICHO (média de interações): ${JSON.stringify(horarios)}
Hoje é ${hoje()}.
Regras: use a estrutura e o gancho do que funcionou, mas com palavras ORIGINAIS (nunca copie frases das concorrentes). Não invente preço, desconto, prazo ou dado que não esteja aqui. Siga a voz da marca e as regras do dono.
Responda APENAS com este JSON:
{"titulo": "título curto do resultado", ${formatoPost}, "dica": "1 dica prática de uso"}`;
const r: any = await gemini(prompt);
if (r.erro) return r;
(r.itens || []).forEach((it: any) => { if (!it.texto && it.legenda) it.texto = it.legenda; });
return { ...r, tipo, base_usada: base ? base.titulo || "movimento da concorrente" : null };
}

async function ajustarTexto(emp: any, texto: string, pedido: string) {
const como = AJUSTES[pedido] || AJUSTES.outra;
const r: any = await gemini(`Reescreva o texto abaixo para a loja (${lojaTxt(emp)}). ${como}.
VOZ DA MARCA: ${vozTxt(emp)}
Não invente preço, desconto ou prazo. Mantenha emojis só se combinarem com a voz da marca.
TEXTO: """${String(texto || "").slice(0, 2500)}"""
Responda APENAS com este JSON: {"texto": "novo texto completo"}`, true);
return r.erro ? r : { texto: r.texto || "" };
}

const palavras = (s: string) => new Set(String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 40));
function parecido(a: string, b: string) {
const A = palavras(a), B = palavras(b);
if (A.size < 4 || B.size < 4) return 0;
let i = 0; A.forEach((w) => { if (B.has(w)) i++; });
return i / Math.min(A.size, B.size);
}
async function medirConteudos() {
const desde = new Date(Date.now() - 45 * 86400e3).toISOString();
const { data: cs } = await db.from("conteudos").select("id,empresa_id,dados,status,desempenho,criado_em").in("status", ["agendado", "postado", "rascunho"])
.gte("criado_em", desde).order("criado_em", { ascending: false }).limit(300);
const porLoja: Record<string, any[]> = {};
(cs || []).filter((c: any) => !c.desempenho || Date.now() - Date.parse(c.desempenho.lido_em || 0) > 20 * 3600e3)
.forEach((c: any) => (porLoja[c.empresa_id] = porLoja[c.empresa_id] || []).push(c));
let n = 0;
for (const [eid, lista] of Object.entries(porLoja).slice(0, 3)) {
const { data: emp } = await db.from("empresas").select("instagram").eq("id", eid).maybeSingle();
if (!emp?.instagram) continue;
const ig: any = await lerInstagram(emp.instagram, 30);
if (!ig.ok) continue;
for (const c of lista) {
const leg = c.dados?.legenda || c.dados?.texto || "";
const p = ig.posts.filter((p: any) => Date.parse(p.data) >= Date.parse(c.criado_em) - 3600e3)
.map((p: any) => ({ p, s: parecido(leg, p.legenda) })).sort((x: any, y: any) => y.s - x.s)[0];
if (p && p.s >= 0.45) {
await db.from("conteudos").update({ status: "postado", postado_em: p.p.data, post_link: p.p.link,
desempenho: { curtidas: p.p.curtidas, comentarios: p.p.comentarios, vezes_media: p.p.vezes_media, lido_em: new Date().toISOString() } }).eq("id", c.id);
n++;
}
}
}
return n;
}

const GOOGLE_KEY = env("GOOGLE_PLACES_KEY");
async function lerGoogle(consulta: string) {
if (!GOOGLE_KEY) return { ok: false, erro: "google_nao_configurado" };
try {
const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
method: "POST",
headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_KEY,
"X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.reviews" },
body: JSON.stringify({ textQuery: consulta, languageCode: "pt-BR", regionCode: "BR", pageSize: 1 }),
});
const j = await r.json();
if (!r.ok) return { ok: false, erro: j?.error?.message || String(r.status) };
const p = j.places?.[0];
if (!p) return { ok: false, erro: "nao_encontrado" };
return {
ok: true, id: p.id, nome: p.displayName?.text || "", endereco: p.formattedAddress || "", nota: p.rating ?? null, avaliacoes: p.userRatingCount ?? 0, link: p.googleMapsUri || "",
reviews: (p.reviews || []).map((v: any) => ({ nota: v.rating, texto: corta(v.text?.text || v.originalText?.text || "", 600), autor: v.authorAttribution?.displayName || "", quando: v.relativePublishTimeDescription || "", data: v.publishTime || "" })),
};
} catch (e) { return { ok: false, erro: e instanceof Error ? e.message : String(e) }; }
}
async function atualizarGoogle(emp: any) {
const { data: cs } = await db.from("concorrentes").select("id,nome,cidade,instagram").eq("empresa_id", emp.id).eq("pausada", false).limit(15);
const cidade = emp.cidade || "";
const eu = await lerGoogle(`${emp.nome_fantasia} ${cidade}`.trim());
if (!eu.ok && (eu as any).erro === "google_nao_configurado") return { erro: "As avaliações do Google ainda não foram ativadas no Radar." };
const conc: any[] = [];
for (const c of cs || []) conc.push({ id: c.id, nome: c.nome, ...(await lerGoogle(`${c.nome} ${c.cidade || cidade}`.trim())) });
let resumo: any = null;
const ruins = conc.flatMap((c) => (c.reviews || []).filter((v: any) => v.nota <= 3).map((v: any) => ({ concorrente: c.nome, nota: v.nota, texto: v.texto })));
if (ruins.length) {
resumo = await gemini(`Avaliações negativas reais das concorrentes da loja ${lojaTxt(emp)} no Google:
${JSON.stringify(ruins).slice(0, 4000)}
Resuma o que os clientes reclamam delas e como a minha loja pode usar isso (sem citar nomes nas redes).
Responda APENAS com este JSON: {"reclamacoes": ["até 4 reclamações que se repetem"], "oportunidades": [{"titulo": "ação", "texto": "como fazer em 1 frase"}]}`, true);
if (resumo?.erro) resumo = null;
}
const dados = { eu, conc, resumo, lido_em: new Date().toISOString() };
await salva(emp, "google", "atual", dados);
return dados;
}
async function googleDoDia() {
if (!GOOGLE_KEY) return 0;
const { data: es } = await db.from("empresas").select("*").limit(500);
const { data: lidas } = await db.from("analises").select("empresa_id,criado_em").eq("tipo", "google");
const ult: Record<string, number> = {};
(lidas || []).forEach((x: any) => { ult[x.empresa_id] = Date.parse(x.criado_em); });
let n = 0;
for (const e of es || []) {
if (n >= 2) break;
if (Date.now() - (ult[e.id] || 0) < 24 * 3600e3) continue;
if (!tem(await planoDe(e.user_id), "avaliacoes")) continue;
await atualizarGoogle(e); n++;
}
return n;
}
async function responderAvaliacao(emp: any, v: any) {
const r: any = await gemini(`Escreva a resposta pública do dono da loja a esta avaliação no Google.
LOJA: ${lojaTxt(emp)}
VOZ DA MARCA: ${vozTxt(emp)}
AVALIAÇÃO (${Number(v?.nota) || "?"} estrelas, de ${String(v?.autor || "cliente").slice(0, 60)}): """${String(v?.texto || "").slice(0, 1200)}"""
Regras: agradeça pelo nome, seja específico sobre o que a pessoa disse, nunca discuta. Se for negativa, peça desculpas sem culpar o cliente e ofereça resolver por um canal privado. Até 600 caracteres.
Responda APENAS com este JSON: {"texto": "resposta pronta"}`, true);
return r.erro ? r : { texto: r.texto || "" };
}

const WA_TOKEN = env("WA_TOKEN"), WA_PHONE_ID = env("WA_PHONE_ID"), WA_TEMPLATE = env("WA_TEMPLATE") || "radar_alerta", WA_LANG = env("WA_LANG") || "pt_BR";
const numeroWa = (s: string) => { let d = String(s || "").replace(/\D/g, ""); if (d.length === 10 || d.length === 11) d = "55" + d; return d.length >= 12 ? d : ""; };
async function enviaWhatsApp(numero: string, texto: string) {
const para = numeroWa(numero);
if (!WA_TOKEN || !WA_PHONE_ID || !para) return false;
const limpo = String(texto).replace(/[\r\n\t]+/g, " · ").replace(/ {4,}/g, "   ").slice(0, 900);
try {
const r = await fetch(`${GRAPH}/${WA_PHONE_ID}/messages`, {
method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "template",
template: { name: WA_TEMPLATE, language: { code: WA_LANG }, components: [{ type: "body", parameters: [{ type: "text", text: limpo }] }] } }),
});
if (!r.ok) console.error("whatsapp", r.status, await r.text().catch(() => ""));
return r.ok;
} catch (e) { console.error("whatsapp", e); return false; }
}

async function imagemComoDados(url: string) {
if (!/^https:\/\//i.test(url || "")) return { erro: "Endereço de imagem inválido." };
try {
const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/*" } });
const tipo = r.headers.get("content-type") || "";
if (!r.ok || !/^image\/(png|jpe?g|webp|gif)/i.test(tipo)) return { erro: "Não foi possível baixar a imagem." };
const buf = new Uint8Array(await r.arrayBuffer());
if (buf.length > 3_000_000) return { erro: "Imagem grande demais." };
let bin = ""; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
return { dados: `data:${tipo.split(";")[0]};base64,${btoa(bin)}` };
} catch { return { erro: "Não foi possível baixar a imagem." }; }
}


const comoImg = (d: string) => { const m = /^data:([^;]+);base64,(.+)$/.exec(d || ""); return m ? { mime: m[1], b64: m[2] } : null; };
async function baixarImg(url: string) { const r: any = await imagemComoDados(url); return r?.dados ? comoImg(r.dados) : null; }
function limpaIA(o: any) { if (o && typeof o === "object") { delete o.modelo; delete o.sem_imagens; } return o; }

async function coresDoSite(site: string) {
if (!site) return [];
try {
const r: any = await baixa(urlDe(site), 10000);
if (!r.ok) return [];
const html = String(r.txt || "").slice(0, 400000);
const conta: Record<string, number> = {};
const tema = (html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-f]{3,6})/i) || [])[1];
if (tema) conta[tema.toLowerCase()] = 50;
for (const m of html.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
let h = m[1].toLowerCase(); if (h.length === 3) h = h.split("").map((c) => c + c).join("");
const [rr, gg, bb] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
if (mx - mn < 40 || mx < 40 || mn > 225) continue; // ignora cinzas, quase preto e quase branco
conta["#" + h] = (conta["#" + h] || 0) + 1;
}
return Object.entries(conta).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0]);
} catch { return []; }
}

async function nichoLeve(emp: any) {
const { data: cs } = await db.from("concorrentes").select("id,nome").eq("empresa_id", emp.id).eq("pausada", false).limit(10);
const vs = await Promise.all((cs || []).map((c: any) => db.from("verificacoes").select("ig:dados->instagram").eq("concorrente_id", c.id).order("feita_em", { ascending: false }).limit(1).maybeSingle()));
const top: any[] = [], formatos: Record<string, { posts: number; soma: number }> = {};
(cs || []).forEach((c: any, i: number) => {
const ig: any = (vs[i] as any)?.data?.ig;
if (!ig?.ok) return;
(ig.posts || []).slice(0, 12).forEach((p: any) => {
formatos[p.tipo] = formatos[p.tipo] || { posts: 0, soma: 0 }; formatos[p.tipo].posts++; formatos[p.tipo].soma += p.vezes_media || 0;
if ((p.vezes_media || 0) >= 1.5) top.push({ concorrente: c.nome, tipo: p.tipo, vezes_media: p.vezes_media, legenda: corta(p.legenda || "", 180) });
});
});
top.sort((a, b) => b.vezes_media - a.vezes_media);
const fm = Object.entries(formatos).map(([f, v]) => ({ formato: f, posts: v.posts, media_vezes: +(v.soma / v.posts).toFixed(1) })).sort((a, b) => b.media_vezes - a.media_vezes);
return { top: top.slice(0, 6), formatos: fm };
}

async function perfilMarca(emp: any) {
const [ig, siteCores, nicho]: any = await Promise.all([
emp.instagram ? lerInstagram(emp.instagram, 18) : Promise.resolve({ ok: false }),
coresDoSite(emp.site), nichoLeve(emp),
]);
if (!ig.ok && !siteCores.length) return { erro: "Não conseguimos ler o Instagram (precisa ser conta Comercial ou de Criador) nem o site da loja." };
const posts = ig.ok ? ig.posts : [];
const escolhidos = [...new Set([...[...posts].sort((a: any, b: any) => (b.vezes_media || 0) - (a.vezes_media || 0)).slice(0, 2), ...posts.slice(0, 3)])].filter((p: any) => p.foto).slice(0, 4);
const imgs = (await Promise.all(escolhidos.map((p: any) => baixarImg(p.foto)))).filter(Boolean) as any[];
const legendas = posts.map((p: any) => p.legenda).filter((x: string) => x && x.length > 15).slice(0, 14).map((l: string) => corta(l, 280));
const ia: any = await iaVisao(`Você é diretor de arte e estrategista de Instagram de pequenos negócios no Brasil. ${ADAPTA}
Analise a identidade da loja abaixo. As imagens anexadas são posts reais dela (os primeiros são os que mais engajaram).
LOJA: ${lojaTxt(emp)}
LEGENDAS REAIS: ${JSON.stringify(legendas)}
FORMATOS QUE ELA USA (últimos posts): ${JSON.stringify(ig.ok ? ig.tipos : {})}
CORES ENCONTRADAS NO SITE: ${JSON.stringify(siteCores)}
O QUE MAIS ENGAJA NAS CONCORRENTES DO NICHO: ${JSON.stringify(nicho).slice(0, 1500)}
Seja específico e prático. Não invente números.
Responda APENAS com este JSON:
{"resumo": "2 frases sobre a identidade visual e o jeito de comunicar",
"cores": [{"hex": "#RRGGBB", "nome": "nome da cor", "uso": "fundo|destaque|texto"}],
"fundo": "claro|escuro|misto", "estilo_imagens": "fotos reais|artes gráficas|misto", "texto_nas_artes": "nenhum|pouco|muito",
"tipografia": "grossa|fina|manuscrita|mista", "clima": "3 adjetivos",
"pontos_fortes": ["3 itens"], "melhorias": [{"titulo": "melhoria", "texto": "como aplicar em 1 frase"}],
"voz": {"resumo": "jeito de falar", "tom": "3 adjetivos", "emojis": "quanto e quais", "tamanho": "curtas|médias|longas", "cta": "chamada que usa", "expressoes": ["até 5"], "evitar": ["até 3"]}}
"cores": 3 a 5 cores da marca (tire das imagens; use as do site se combinarem). "melhorias": 3 ou 4.`, imgs);
if (ia.erro) return ia;
const voz = ia.voz; delete ia.voz;
const marca = { ...limpaIA(ia), site_cores: siteCores, formatos: ig.ok ? ig.tipos : {}, nicho_formatos: nicho.formatos, logo: ig.ok ? ig.foto : "",
usar_logo: emp.marca?.usar_logo ?? !!(ig.ok && ig.foto), imagens_vistas: imgs.length, analisado_em: new Date().toISOString() };
const upd: any = { marca };
if (voz && !emp.voz?.resumo) upd.voz = { ...voz, regras: emp.voz?.regras || "", aprendida_em: new Date().toISOString() };
await db.from("empresas").update(upd).eq("id", emp.id);
return { ...marca, voz: upd.voz || emp.voz || null };
}

function marcaTxt(emp: any) {
const m = emp.marca;
if (!m) return "ainda não analisada (use um visual limpo e moderno)";
return JSON.stringify({ resumo: m.resumo, cores: m.cores, fundo: m.fundo, estilo_imagens: m.estilo_imagens, texto_nas_artes: m.texto_nas_artes, tipografia: m.tipografia, clima: m.clima, melhorias: (m.melhorias || []).map((x: any) => x.titulo) }).slice(0, 1500);
}

async function briefing(emp: any, b: any) {
const nicho = await nichoLeve(emp);
const aprend = await aprendizados(emp).catch(() => ({}));
const exemplos = (Array.isArray(b.exemplos) ? b.exemplos : []).map(comoImg).filter(Boolean).slice(0, 3) as any[];
const tipo = String(b.tipo || "carrossel");
const ia: any = await iaVisao(`Você é diretor de criação de uma agência de Instagram para pequenos negócios no Brasil. ${ADAPTA}
O dono da loja escreveu um pedido simples. Transforme em um BRIEFING profissional e específico para criar um ${tipo}.
PEDIDO DO DONO: "${String(b.pedido || "escolha o tema com mais chance de resultado agora").slice(0, 400)}"
LOJA: ${lojaTxt(emp)}
IDENTIDADE DA MARCA: ${marcaTxt(emp)}
VOZ DA MARCA: ${vozTxt(emp)}
FOTOS QUE O DONO VAI USAR NA ARTE: ${Number(b.fotos) || 0}
O QUE MAIS ENGAJA NAS CONCORRENTES (dados reais): ${JSON.stringify(nicho).slice(0, 1800)}
O QUE JÁ FUNCIONOU COM OS POSTS DELE: ${JSON.stringify(aprend).slice(0, 600)}
${exemplos.length ? "As imagens anexadas são EXEMPLOS de estilo que o dono gostou: use só como inspiração de cores, clima e organização. Nunca copie textos, logos ou marcas de terceiros." : ""}
Não invente preço, desconto, prazo ou dado que não esteja no pedido.
Responda APENAS com este JSON:
{"objetivo": "o que o post precisa conseguir", "publico": "para quem", "gancho": "frase da capa, até 8 palavras", "paginas": 6,
"estrutura": ["o que vai em cada página, curto"], "visual": {"fundo": "claro|escuro", "cores": ["#RRGGBB", "#RRGGBB", "#RRGGBB"], "estilo": "1 frase", "tipografia": "grossa|fina"},
"chamada": "chamada para ação final", "tom": "como falar", "baseado_em": "qual dado real inspirou", "melhoria_aplicada": "qual melhoria da marca este post aplica (ou vazio)"}
"paginas": de 5 a 8. "cores": use as cores da marca (ou do exemplo, se houver).`, exemplos, true);
if (ia.erro) return ia;
return { ...limpaIA(ia), tipo, pedido: b.pedido || "" };
}

const FORMATO_PAGINA = `{"layout": "capa|topicos|numero|frase|foto|cta", "titulo": "até 8 palavras", "texto": "até 28 palavras", "itens": ["até 4 itens de até 6 palavras"], "destaque": "número ou palavra curta (opcional)", "emoji": "1 emoji (opcional)", "foto": índice da foto enviada ou null, "imagem": "em INGLÊS: descrição de um fundo ou ilustração para esta página (cenário, textura, objetos, luz, cores da marca), SEM texto, SEM letras, SEM logotipos, SEM pessoas reais e SEM mostrar o produto da loja"}`;
async function gerarCarrossel(emp: any, b: any) {
const br = b.briefing || {};
const nf = Math.max(0, Math.min(10, Number(b.fotos) || 0));
const prods: any = await meusProdutos(emp).catch(() => null);
const ia: any = await gemini(`Você é o melhor criador de carrosséis de Instagram do Brasil. ${ADAPTA}
Crie o carrossel seguindo o BRIEFING à risca.
BRIEFING: ${JSON.stringify(br).slice(0, 2500)}
LOJA: ${lojaTxt(emp)}
VOZ DA MARCA: ${vozTxt(emp)}
${prods?.produtos?.length ? `PRODUTOS REAIS (use só se combinar): ${JSON.stringify(prods.produtos.slice(0, 8).map((p: any) => ({ nome: p.nome, preco: p.preco })))}` : ""}
FOTOS ENVIADAS PELO DONO: ${nf} (índices de 0 a ${Math.max(0, nf - 1)}). ${nf ? "Use TODAS as fotos, cada uma em uma página (layout foto ou na capa), na ordem que fizer sentido." : "Não use fotos (foto sempre null)."}
Regras: página 1 é "capa" com o gancho; a última é "cta" com a chamada; textos curtos e fáceis de ler no celular; varie os layouts; não invente preço, desconto ou prazo; NUNCA invente depoimentos, avaliações, números de clientes ou falas atribuídas a clientes (o layout "frase" é só para frases da própria marca); siga as regras do dono.
Responda APENAS com este JSON:
{"titulo": "nome curto do carrossel", "paginas": [${FORMATO_PAGINA}], "legenda": "legenda completa pronta, com chamada para ação", "hashtags": ["8 a 12"]}
"paginas": exatamente ${Math.max(5, Math.min(8, Number(br.paginas) || 6))} páginas.`);
if (ia.erro) return ia;
(ia.paginas || []).forEach((p: any) => { if (typeof p.foto !== "number" || p.foto < 0 || p.foto >= nf) p.foto = null; });
return { ...limpaIA(ia), briefing: br };
}
async function refazerPagina(emp: any, b: any) {
const ia: any = await gemini(`Refaça SÓ a página ${Number(b.indice) + 1} deste carrossel de Instagram, mantendo o mesmo assunto e estilo, com outra abordagem${b.pedido ? ` (pedido do dono: ${String(b.pedido).slice(0, 200)})` : ""}.
LOJA: ${lojaTxt(emp)}
VOZ DA MARCA: ${vozTxt(emp)}
BRIEFING: ${JSON.stringify(b.briefing || {}).slice(0, 1500)}
CARROSSEL ATUAL: ${JSON.stringify(b.paginas || []).slice(0, 3000)}
Não invente preço, desconto, prazo, depoimentos ou falas de clientes. Mantenha o layout "${String(b.paginas?.[b.indice]?.layout || "topicos")}" e a foto ${JSON.stringify(b.paginas?.[b.indice]?.foto ?? null)}.
Responda APENAS com este JSON: {"pagina": ${FORMATO_PAGINA}}`, true);
if (ia.erro) return ia;
return { pagina: ia.pagina || ia };
}

const CF_CONTA = env("CF_ACCOUNT_ID"), CF_TOKEN = env("CF_API_TOKEN"), CF_MODELO = env("CF_IMAGE_MODEL") || "@cf/black-forest-labs/flux-1-schnell";
async function imagemIA(emp: any, b: any) {
if (!CF_CONTA || !CF_TOKEN) return { erro: "A criação de imagens por IA ainda não foi ativada no Radar." };
const p = await planoDe(emp.user_id);
const lim = Number(p?.img_dia ?? 10), dia = hoje();
const { data: u } = await db.from("uso_imagens").select("total").eq("user_id", emp.user_id).eq("dia", dia).maybeSingle();
if ((u?.total || 0) >= lim) return { erro: `Você já gerou as ${lim} imagens por IA de hoje no plano ${p?.nome || ""}. Amanhã libera de novo.`, limite: true };
let desc = String(b.prompt || "").slice(0, 600);
if (!desc) {
const r: any = await gemini(`Write a short English prompt (max 60 words) for an AI image generator to create a BACKGROUND or ILLUSTRATION for an Instagram post.
Business: ${lojaTxt(emp)}
Post page: ${JSON.stringify(b.pagina || {}).slice(0, 400)}
Brand style: ${marcaTxt(emp)}
Rules: no text, no letters, no logos, no real people, do not show the store's actual product. Respond ONLY with JSON: {"prompt": "..."}`, true);
desc = r?.prompt || `abstract background for a ${emp.segmento || "local business"} Instagram post`;
}
const cores = ((b.cores || emp.marca?.cores?.map((c: any) => c.hex) || []) as string[]).filter((h) => /^#[0-9a-f]{6}$/i.test(h)).slice(0, 3);
const estilo = b.estilo || emp.marca?.clima || "";
const prompt = `${desc}. Style: professional Instagram post background, ${estilo}${cores.length ? ", color palette " + cores.join(", ") : ""}, clean composition with empty space for text, high quality. No text, no letters, no words, no watermark, no logos.`.slice(0, 1800);
let r: Response;
try {
r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_CONTA}/ai/run/${CF_MODELO}`, {
method: "POST", signal: AbortSignal.timeout(60000),
headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
body: JSON.stringify({ prompt, steps: 4 }),
});
} catch { return { erro: "A IA de imagens demorou demais. Tente de novo." }; }
const tipo = r.headers.get("content-type") || "";
let b64 = "";
if (/json/.test(tipo)) {
const j: any = await r.json().catch(() => ({}));
if (!r.ok || j?.success === false) {
const m = j?.errors?.[0]?.message || String(r.status);
return { erro: /neuron|quota|limit|429|exceeded/i.test(m) || r.status === 429 ? "A cota grátis de imagens por IA acabou por hoje. Volta amanhã." : "A IA de imagens não respondeu agora. (" + corta(m, 120) + ")" };
}
b64 = j?.result?.image || "";
} else if (r.ok) {
const buf = new Uint8Array(await r.arrayBuffer());
let bin = ""; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
b64 = btoa(bin);
}
if (!b64) return { erro: "A IA de imagens não devolveu a imagem. Tente de novo." };
await db.from("uso_imagens").upsert({ user_id: emp.user_id, dia, total: (u?.total || 0) + 1 }, { onConflict: "user_id,dia" });
return { dados: `data:${/png/.test(tipo) ? "image/png" : "image/jpeg"};base64,${b64}`, restam: Math.max(0, lim - (u?.total || 0) - 1), prompt: desc };
}

return { gerarLivre, ajustarTexto, aprenderVoz, meusProdutos, imagemComoDados, atualizarGoogle, responderAvaliacao, medirConteudos, googleDoDia, enviaWhatsApp, vozTxt,
perfilMarca, briefing, gerarCarrossel, refazerPagina, imagemIA };
}

/* ====================== ARTES_MARK */
/* ====================== ARTES: perfil da marca, pedido turbinado, motor de artes e carrossel ====================== */
let tipoCriar='post',temaCriar='',IMGS=[],CARR=null,LOGO_IMG=null;
const hexOk=h=>/^#[0-9a-f]{6}$/i.test(String(h||''));
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const lum=h=>{const c=rgb(h);return (0.299*c[0]+0.587*c[1]+0.114*c[2])/255};
const sobre=h=>lum(h)>0.62?'#15151f':'#ffffff';
const carregaImg=src=>new Promise(ok=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>ok(null);im.src=src});
function reduzir(src,max,q){return carregaImg(src).then(im=>{if(!im)return null;const k=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',q)})}
// cores de uma imagem sem IA (para quando a IA não conseguir ver o exemplo)
async function paleta(src){const im=await carregaImg(src);if(!im)return [];const c=document.createElement('canvas');c.width=60;c.height=60;const x=c.getContext('2d');x.drawImage(im,0,0,60,60);const d=x.getImageData(0,0,60,60).data,b={};
 for(let i=0;i<d.length;i+=4){const r=d[i]>>4,g=d[i+1]>>4,bl=d[i+2]>>4,mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);const k=r+','+g+','+bl;b[k]=b[k]||{n:0,s:0,r:0,g:0,b:0};b[k].n++;b[k].s+=mx-mn;b[k].r+=d[i];b[k].g+=d[i+1];b[k].b+=d[i+2]}
 return Object.values(b).sort((p,q)=>(q.n*(1+q.s/q.n/60))-(p.n*(1+p.s/p.n/60))).slice(0,3).map(v=>'#'+[v.r,v.g,v.b].map(t=>Math.round(t/v.n).toString(16).padStart(2,'0')).join(''))}

/* ---------- sua marca segundo o Radar (Minha loja) ---------- */
function blocoMarcaRadar(){if(!CLOUD||!temR('gerador'))return '';const M=lojaAtual().marca;
 if(ocupado.marca)return carregando('O Radar está estudando o seu Instagram e o seu site…');
 if(!M)return '<div class="card marcaR" style="display:grid;gap:10px"><b style="font-size:18px">🎨 Sua marca segundo o Radar</b><p class="sm">O Radar estuda seu Instagram e seu site e descobre suas cores, seu estilo de post e o que dá para melhorar. Tudo que a IA criar sai com a sua cara.</p><button class="btn pri" style="justify-self:start" data-mk="analisar">'+ic('spark')+'Analisar minha marca</button></div>';
 const cs=(M.cores||[]).filter(c=>hexOk(c.hex));
 return '<div class="card marcaR" style="display:grid;gap:12px"><div class="row" style="flex-wrap:wrap;gap:8px"><b class="fl" style="font-size:18px">🎨 Sua marca segundo o Radar</b><button class="btn sec sm" data-mk="analisar">'+ic('refresh',14)+'Analisar de novo</button></div>'+
 (M.resumo?'<p class="sm" style="color:var(--ink)">'+esc(M.resumo)+'</p>':'')+
 '<div><span class="sm" style="font-weight:800;color:var(--ink)">Cores (toque para ajustar)</span><div class="row" style="gap:10px;flex-wrap:wrap;margin-top:6px">'+cs.map((c,i)=>'<label class="cor"><input type="color" data-mkcor="'+i+'" value="'+esc(c.hex)+'"><span class="sm">'+esc(c.nome||c.uso||'')+'</span></label>').join('')+'<button class="btn sec sm" data-mk="maiscor">+ cor</button></div></div>'+
 '<div class="row" style="gap:6px;flex-wrap:wrap">'+[M.fundo&&('Fundo '+M.fundo),M.estilo_imagens,M.texto_nas_artes&&('Texto nas artes: '+M.texto_nas_artes),M.tipografia&&('Letra '+M.tipografia),M.clima].filter(Boolean).map(x=>'<span class="chip">'+esc(x)+'</span>').join('')+'</div>'+
 ((M.pontos_fortes||[]).length?'<div><b class="sm" style="color:var(--ink)">✅ O que você já faz bem</b><ul class="rot">'+M.pontos_fortes.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'')+
 ((M.melhorias||[]).length?'<div><b class="sm" style="color:var(--ink)">🚀 O que dá para melhorar (a IA já aplica nas criações)</b><ul class="rot">'+M.melhorias.map(x=>'<li><b>'+esc(x.titulo||'')+'</b>'+(x.texto?': '+esc(x.texto):'')+'</li>').join('')+'</ul></div>':'')+
 (M.logo?'<label class="row sm" style="gap:8px;color:var(--ink)"><input type="checkbox" id="mkLogoUsa"'+(M.usar_logo?' checked':'')+'> Usar a foto do perfil do Instagram como logo nas artes</label>':'')+
 '<div class="row" style="gap:8px;flex-wrap:wrap"><select id="mkFundo" aria-label="Fundo das artes" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff">'+['claro','escuro'].map(f=>'<option value="'+f+'"'+((M.fundo==='escuro')===(f==='escuro')?' selected':'')+'>Fundo '+f+'</option>').join('')+'</select><select id="mkLetra" aria-label="Letra das artes" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff">'+['grossa','fina'].map(f=>'<option value="'+f+'"'+((M.tipografia==='fina')===(f==='fina')?' selected':'')+'>Letra '+f+'</option>').join('')+'</select><button class="btn pri sm" data-mk="salvar">Salvar ajustes</button></div>'+
 '<span class="sm">Analisado em '+(M.analisado_em?new Date(M.analisado_em).toLocaleDateString('pt-BR'):'—')+(M.imagens_vistas?' · '+M.imagens_vistas+' posts vistos pela IA':'')+'</span></div>'}
async function salvarMarca(){const E=lojaAtual(),M=Object.assign({},E.marca||{});const cs=(M.cores||[]).slice();document.querySelectorAll('[data-mkcor]').forEach(inp=>{const i=+inp.dataset.mkcor;if(cs[i])cs[i]=Object.assign({},cs[i],{hex:inp.value})});M.cores=cs;
 if($('mkFundo'))M.fundo=$('mkFundo').value;if($('mkLetra'))M.tipografia=$('mkLetra').value;if($('mkLogoUsa'))M.usar_logo=$('mkLogoUsa').checked;
 const q=await sb.from('empresas').update({marca:M}).eq('id',EMP_ID);if(q.error){toast(traduz(q.error.message));return}E.marca=M;LOGO_IMG=null;toast('Marca salva. As próximas artes já saem assim.');route()}
function avisoMarca(){if(lojaAtual().marca)return '';return '<div class="note row" style="gap:10px;flex-wrap:wrap;margin-bottom:12px;background:#fdf2f8;border-color:#fbcfe8;color:#9d174d"><span class="fl" style="min-width:min(100%,12em)">🎨 Analise sua marca uma vez e as artes saem com as suas cores e o seu estilo.</span><button class="btn pri sm" data-mk="analisar">Analisar agora</button></div>'}

/* ---------- imagens do usuário: usar na arte ou como exemplo ---------- */
function blocoImagens(){if(tipoCriar!=='carrossel')return '';const n1=IMGS.filter(x=>x.uso==='arte').length,n2=IMGS.length-n1;
 return '<div class="imgsBox" style="display:grid;gap:8px"><span class="sm" style="font-weight:800;color:var(--ink)">Imagens (opcional)</span><p class="sm" style="margin:0">📷 <b>Usar na arte</b>: fotos dos seus trabalhos ou produtos entram nas páginas. ✨ <b>Exemplo</b>: um post que você gostou; a IA se inspira no estilo, sem copiar.</p>'+
 (IMGS.length?'<div class="thumbs">'+IMGS.map((x,i)=>'<div class="th"><img src="'+x.src+'" alt="Imagem '+(i+1)+'"><button type="button" class="tg '+x.uso+'" data-img="'+i+'">'+(x.uso==='arte'?'📷 Na arte':'✨ Exemplo')+'</button><button type="button" class="x" data-imgdel="'+i+'" aria-label="Remover imagem">✕</button></div>').join('')+'</div>':'')+
 '<label class="btn sec sm" style="justify-self:start;cursor:pointer">'+ic('cam',14)+'Adicionar imagens<input id="cImgs" type="file" accept="image/*" multiple hidden></label>'+(IMGS.length?'<span class="sm">'+n1+' na arte · '+n2+' de exemplo</span>':'')+'</div>'}
async function addImagens(files){for(const f of [...files].slice(0,10)){if(IMGS.length>=12){toast('Máximo de 12 imagens.');break}
 const raw=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(f)});const src=await reduzir(raw,1080,0.88);if(!src)continue;IMGS.push({src,uso:'arte'})}route()}

/* ---------- pedido turbinado ---------- */
async function carrBrief(){const ex=[];for(const x of IMGS.filter(x=>x.uso==='exemplo').slice(0,3)){const m=await reduzir(x.src,640,0.78);if(m)ex.push(m)}
 ocupado.carr='brief';CARR=null;route();
 const r=await acao('briefing',{tipo:'carrossel',pedido:temaCriar,fotos:IMGS.filter(x=>x.uso==='arte').length,exemplos:ex});ocupado.carr=0;
 if(r.erro){CARR={erro:r.erro};route();return}
 if((!r.visual||!(r.visual.cores||[]).some(hexOk)||r.sem_imagens)&&IMGS.some(x=>x.uso==='exemplo')){const p=await paleta(IMGS.find(x=>x.uso==='exemplo').src);if(p.length){r.visual=Object.assign({},r.visual,{cores:p})}}
 CARR={briefing:r};route();setTimeout(()=>{const el=$('carrBox');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})},120)}
function lerBriefing(){const B=Object.assign({},CARR.briefing);const v=id=>$(id)?$(id).value.trim():'';B.objetivo=v('bObj')||B.objetivo;B.gancho=v('bGan')||B.gancho;B.chamada=v('bCta')||B.chamada;B.paginas=+v('bPag')||B.paginas||6;
 B.capa_ia=$('bIA')?$('bIA').checked:B.capa_ia;B.visual=Object.assign({},B.visual||{});const cs=[...document.querySelectorAll('[data-bcor]')].map(i=>i.value);if(cs.length)B.visual.cores=cs;if($('bFundo'))B.visual.fundo=$('bFundo').value;return B}
function cartaoBriefing(){const B=CARR.briefing,V=B.visual||{},cs=(V.cores||[]).filter(hexOk);const M=lojaAtual().marca||{};const cores=(cs.length?cs:(M.cores||[]).map(c=>c.hex).filter(hexOk)).slice(0,3);while(cores.length<3)cores.push(['#d62976','#962fbf','#fa7e1e'][cores.length]);
 const inp=(id,rot,val)=>'<label class="f" for="'+id+'"><span>'+rot+'</span><input id="'+id+'" value="'+esc(val||'')+'" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit"></label>';
 return '<div class="card ai brief" style="display:grid;gap:10px"><span class="chip ig" style="justify-self:start">'+ic('spark')+'O que a IA vai fazer</span><p class="sm" style="margin:0">Confira e mude o que quiser. Depois é só tocar em <b>Criar carrossel</b>.</p>'+
 inp('bObj','🎯 Objetivo',B.objetivo)+(B.publico?'<span class="sm">👥 <b style="color:var(--ink)">Para quem:</b> '+esc(B.publico)+'</span>':'')+inp('bGan','🪝 Gancho da capa',B.gancho)+
 '<div class="row" style="gap:10px;flex-wrap:wrap"><label class="f" for="bPag" style="flex:1;min-width:120px"><span>📄 Páginas</span><select id="bPag" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff">'+[5,6,7,8].map(n=>'<option'+(n===(+B.paginas||6)?' selected':'')+'>'+n+'</option>').join('')+'</select></label><label class="f" for="bFundo" style="flex:1;min-width:120px"><span>🖼️ Fundo</span><select id="bFundo" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff">'+['claro','escuro'].map(f=>'<option value="'+f+'"'+(((V.fundo||M.fundo)==='escuro')===(f==='escuro')?' selected':'')+'>'+f+'</option>').join('')+'</select></label></div>'+
 '<div><span class="sm" style="font-weight:800;color:var(--ink)">🎨 Cores</span><div class="row" style="gap:10px;margin-top:6px">'+cores.map((c,i)=>'<input type="color" class="corB" data-bcor="'+i+'" value="'+c+'" aria-label="Cor '+(i+1)+'">').join('')+'</div></div>'+
 inp('bCta','📣 Chamada final',B.chamada)+'<label class="row sm" style="gap:8px;color:var(--ink)"><input type="checkbox" id="bIA"'+(B.capa_ia===false?'':' checked')+'> 🎨 Gerar o fundo da capa com IA'+(IMGS.some(x=>x.uso==='arte')?' (se a capa ficar sem foto sua)':'')+'</label>'+
 ((B.estrutura||[]).length?'<details><summary class="sm" style="font-weight:800;color:var(--ink);cursor:pointer">Ver a estrutura das páginas</summary><ol class="rot">'+B.estrutura.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol></details>':'')+
 (B.baseado_em?'<span class="sm base">✨ Baseado em: '+esc(B.baseado_em)+'</span>':'')+(B.melhoria_aplicada?'<span class="sm">🚀 Melhoria aplicada: '+esc(B.melhoria_aplicada)+'</span>':'')+
 '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sec" data-car="brief">Refazer o plano</button><button class="btn pri fl" data-car="criar" style="min-width:min(100%,12em)">'+ic('spark')+'Criar carrossel</button></div></div>'}

/* ---------- motor de artes (1080 x 1350) ---------- */
if(typeof CanvasRenderingContext2D!=='undefined'&&!CanvasRenderingContext2D.prototype.roundRect)CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){r=Math.min(r,w/2,h/2);this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);this.arcTo(x+w,y+h,x,y+h,r);this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);this.closePath();return this};
function temaArte(){const B=(CARR&&CARR.briefing)||{},V=B.visual||{},M=lojaAtual().marca||{};let cs=(V.cores||[]).filter(hexOk);if(!cs.length)cs=(M.cores||[]).map(c=>c.hex).filter(hexOk);if(!cs.length)cs=['#d62976','#962fbf','#fa7e1e'];
 const escuro=(V.fundo||M.fundo)==='escuro';const p=cs[0],a=cs[1]||cs[0];return {p,a,c:cs[2]||a,escuro,bg:escuro?'#111114':'#ffffff',txt:escuro?'#ffffff':'#15151f',sub:escuro?'rgba(255,255,255,.8)':'#4a4a5a',peso:((V.tipografia||M.tipografia)==='fina')?'700':'900'}}
function texto(x,t,X,Y,W,H,tam,min,peso,cor,alt,alinha){t=String(t||'').trim();if(!t)return 0;let ls;for(;;){x.font=peso+' '+tam+'px Inter,system-ui,sans-serif';ls=quebra(x,t,W);if(ls.length*tam*alt<=H||tam<=min)break;tam=Math.max(min,Math.round(tam*0.9))}
 const cab=Math.max(1,Math.floor(H/(tam*alt)));if(ls.length>cab){ls=ls.slice(0,cab);ls[cab-1]=ls[cab-1].replace(/\s*\S*$/,'')+'…'}x.fillStyle=cor;x.textAlign=alinha||'left';x.textBaseline='top';ls.forEach((l,i)=>x.fillText(l,alinha==='center'?X+W/2:X,Y+i*tam*alt));x.textAlign='left';return ls.length*tam*alt}
function cobre(x,im,X,Y,W,H){const k=Math.max(W/im.width,H/im.height),iw=im.width*k,ih=im.height*k;x.save();x.beginPath();x.rect(X,Y,W,H);x.clip();x.drawImage(im,X+(W-iw)/2,Y+(H-ih)/2,iw,ih);x.restore()}
function grad(x,c1,c2){const g=x.createLinearGradient(0,0,1080,1350);g.addColorStop(0,c1);g.addColorStop(1,c2);return g}
async function logoArte(){const M=lojaAtual().marca||{};if(!M.usar_logo||!M.logo)return null;if(LOGO_IMG!==null)return LOGO_IMG||null;const r=await acao('imagem',{url:M.logo});LOGO_IMG=r&&r.dados?await carregaImg(r.dados):false;return LOGO_IMG||null}
async function desenhaPagina(pg,i,n,fotos,logo){const cv=document.createElement('canvas');cv.width=1080;cv.height=1350;const x=cv.getContext('2d'),T=temaArte(),W=1080,H=1350,M=80,arroba=conta.loja.ig||'';
 const L=pg.layout||'topicos',fia=pg._iaImg||null;const foto=typeof pg.foto==='number'&&fotos[pg.foto]?fotos[pg.foto]:(L==='capa'||L==='foto'?fia:null);
 const rodape=(cor)=>{x.font='700 30px Inter,system-ui,sans-serif';x.fillStyle=cor;x.textBaseline='alphabetic';x.fillText(arroba,M,H-58);x.textAlign='right';x.fillText((i+1)+'/'+n,W-M,H-58);x.textAlign='left'};
 const marcaLogo=()=>{if(!logo)return;x.save();x.beginPath();x.arc(M+48,M+48,48,0,Math.PI*2);x.closePath();x.clip();cobre(x,logo,M,M,96,96);x.restore()};
 const emo=(y,cor)=>{if(!pg.emoji)return 0;x.font='90px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';x.textBaseline='top';x.fillStyle=cor;x.fillText(pg.emoji,M,y);return 120};
 if(L==='capa'){if(foto){cobre(x,foto,0,0,W,H);const g=x.createLinearGradient(0,H*.3,0,H);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.85)');x.fillStyle=g;x.fillRect(0,0,W,H)}else{x.fillStyle=grad(x,T.p,T.a);x.fillRect(0,0,W,H)}
  const cor=foto?'#ffffff':sobre(T.p);marcaLogo();let y=foto?H*.5:H*.3;y+=emo(y,cor);y+=texto(x,pg.titulo,M,y,W-2*M,foto?420:520,120,64,T.peso,cor,1.06)+24;texto(x,pg.texto,M,y,W-2*M,Math.max(0,H-230-y),46,30,'500',cor,1.3);
  x.fillStyle=foto?'#ffffff':sobre(T.p)==='#ffffff'?'#ffffff':'#15151f';const bw=300;x.beginPath();x.roundRect(W-M-bw,H-180,bw,76,38);x.fill();x.font='800 32px Inter,system-ui,sans-serif';x.fillStyle=foto?'#15151f':T.p;x.textAlign='center';x.textBaseline='middle';x.fillText('Arrasta →',W-M-bw/2,H-142);x.textAlign='left';rodape(cor);return cv.toDataURL('image/jpeg',.9)}
 if(L==='cta'){x.fillStyle=grad(x,T.a,T.p);x.fillRect(0,0,W,H);if(fia){cobre(x,fia,0,0,W,H);x.globalAlpha=.72;x.fillStyle=grad(x,T.a,T.p);x.fillRect(0,0,W,H);x.globalAlpha=1}const cor=sobre(T.a);marcaLogo();let y=H*.28;y+=emo(y,cor);y+=texto(x,pg.titulo,M,y,W-2*M,420,104,60,T.peso,cor,1.06)+26;y+=texto(x,pg.texto,M,y,W-2*M,240,46,32,'500',cor,1.3)+50;
  const ch=(CARR&&CARR.briefing&&CARR.briefing.chamada)||pg.destaque||'Chama no direct';x.font='800 40px Inter,system-ui,sans-serif';const bw=Math.min(W-2*M,x.measureText(ch).width+100);x.fillStyle=cor;x.beginPath();x.roundRect(M,y,bw,100,50);x.fill();x.fillStyle=cor==='#ffffff'?T.p:'#ffffff';x.textBaseline='middle';x.fillText(ch.length>34?ch.slice(0,33)+'…':ch,M+50,y+50);rodape(cor);return cv.toDataURL('image/jpeg',.9)}
 if(L==='frase'){x.fillStyle=T.p;x.fillRect(0,0,W,H);if(fia){cobre(x,fia,0,0,W,H);x.globalAlpha=.78;x.fillStyle=T.p;x.fillRect(0,0,W,H);x.globalAlpha=1}const cor=sobre(T.p);x.globalAlpha=.25;x.font='900 420px Georgia,serif';x.fillStyle=cor;x.textBaseline='top';x.fillText('“',M-20,60);x.globalAlpha=1;let y=200;if(pg.titulo){x.font='800 34px Inter,system-ui,sans-serif';x.fillStyle=cor;x.fillText(String(pg.titulo).toUpperCase().slice(0,40),M,y);y+=80}
  texto(x,pg.texto||pg.titulo,M,y+60,W-2*M,760,76,44,T.peso,cor,1.22);rodape(cor);return cv.toDataURL('image/jpeg',.9)}
 if(L==='foto'){if(foto)cobre(x,foto,0,0,W,H*.64);else{x.fillStyle=grad(x,T.p,T.c);x.fillRect(0,0,W,H*.64)}x.fillStyle=T.bg;x.fillRect(0,H*.64,W,H*.36);x.fillStyle=T.p;x.fillRect(M,H*.64+60,120,12);
  let y=H*.64+100;y+=texto(x,pg.titulo,M,y,W-2*M,190,70,44,T.peso,T.txt,1.08)+14;texto(x,pg.texto,M,y,W-2*M,150,40,28,'500',T.sub,1.3);rodape(T.sub);return cv.toDataURL('image/jpeg',.9)}
 x.fillStyle=T.bg;x.fillRect(0,0,W,H);if(fia){cobre(x,fia,0,0,W,H);x.globalAlpha=.7;x.fillStyle=T.bg;x.fillRect(0,0,W,H);x.globalAlpha=1}x.fillStyle=T.p;x.fillRect(0,0,W,22);
 if(L==='numero'){let y=150;x.font='900 260px Inter,system-ui,sans-serif';x.fillStyle=T.p;x.textBaseline='top';const d=String(pg.destaque||(i+1)).slice(0,6);let t=260;while(x.measureText(d).width>W-2*M&&t>120){t-=20;x.font='900 '+t+'px Inter,system-ui,sans-serif'}x.fillText(d,M,y);y+=t*1.05;
  y+=texto(x,pg.titulo,M,y,W-2*M,300,80,48,T.peso,T.txt,1.08)+24;texto(x,pg.texto,M,y,W-2*M,H-y-160,46,30,'500',T.sub,1.32);rodape(T.sub);return cv.toDataURL('image/jpeg',.9)}
 let y=130;y+=emo(y,T.txt);y+=texto(x,pg.titulo,M,y,W-2*M,300,84,50,T.peso,T.txt,1.08)+44;const it=(pg.itens||[]).filter(Boolean).slice(0,4);
 if(it.length){const esp=Math.min(210,(H-y-170)/it.length);it.forEach((t,k)=>{x.fillStyle=T.p;x.beginPath();x.arc(M+40,y+40,40,0,Math.PI*2);x.fill();x.font='900 40px Inter,system-ui,sans-serif';x.fillStyle=sobre(T.p);x.textAlign='center';x.textBaseline='middle';x.fillText(String(k+1),M+40,y+42);x.textAlign='left';texto(x,t,M+110,y+6,W-2*M-110,esp-20,46,30,'700',T.txt,1.2);y+=esp})}
 else texto(x,pg.texto,M,y,W-2*M,H-y-170,50,32,'500',T.sub,1.32);rodape(T.sub);return cv.toDataURL('image/jpeg',.9)}
async function prepIA(pg){if(pg.fundo_ia&&!pg._iaImg)pg._iaImg=await carregaImg(pg.fundo_ia);if(!pg.fundo_ia)pg._iaImg=null}
const limpaPgs=ps=>(ps||[]).map(p=>{const {fundo_ia,_iaImg,...r}=p;return r});
async function desenhaTudo(){const R=CARR&&CARR.res;if(!R||!R.paginas)return;for(const p of R.paginas)await prepIA(p);const fotos=await Promise.all(IMGS.filter(x=>x.uso==='arte').map(x=>carregaImg(x.src)));const logo=await logoArte();
 if(document.fonts&&document.fonts.load){try{await document.fonts.load('900 40px Inter')}catch(_){}}
 CARR.artes=[];for(let i=0;i<R.paginas.length;i++)CARR.artes.push(await desenhaPagina(R.paginas[i],i,R.paginas.length,fotos,logo))}

/* ---------- tela do carrossel ---------- */
function renderCarr(){let h='<div id="carrBox" style="margin-top:12px;display:grid;gap:12px">';
 if(ocupado.carr==='brief')return h+carregando('A IA está planejando o seu carrossel…')+'</div>';
 if(CARR&&CARR.erro)return h+'<div class="note">'+esc(CARR.erro)+(/plano|upgrade/i.test(CARR.erro)?' <a href="#planos">Ver planos</a>':'')+'</div></div>';
 if(!CARR)return h+'</div>';
 if(!CARR.res)return h+(ocupado.carr==='gerar'?carregando('A IA está escrevendo e o Radar está montando as artes… (até 1 minuto)'):cartaoBriefing())+'</div>';
 const R=CARR.res,A=CARR.artes||[];
 h+='<div class="row" style="flex-wrap:wrap;gap:8px"><b class="fl" style="font-size:19px;min-width:min(100%,10em)">'+esc(R.titulo||'Seu carrossel')+'</b><button class="btn sec sm" data-car="voltar">Ajustar o plano</button></div>'+
 '<div class="strip" role="list">'+R.paginas.map((p,i)=>'<figure role="listitem">'+(A[i]?'<img src="'+A[i]+'" alt="Página '+(i+1)+': '+esc(p.titulo||'')+'">':'<div class="ph2"><span class="spin"></span></div>')+'<figcaption><span class="sm">'+(i+1)+'/'+R.paginas.length+'</span><button class="btn sec sm" data-carp="'+i+'">✏️ Editar</button></figcaption></figure>').join('')+'</div>'+
 '<p class="sm" style="margin:0">Arraste para o lado para ver todas as páginas.</p>'+
 '<div class="leg">'+esc(R.legenda||'')+'</div>'+((R.hashtags||[]).length?'<span class="sm" style="color:#962fbf">'+esc(R.hashtags.map(t=>t[0]==='#'?t:'#'+t).join(' '))+'</span>':'')+
 '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sec sm" data-copy="'+esc((R.legenda||'')+((R.hashtags||[]).length?'\n\n'+R.hashtags.map(t=>t[0]==='#'?t:'#'+t).join(' '):''))+'">Copiar legenda</button><button class="btn sec sm" data-car="baixar">Baixar imagens</button><button class="btn pri sm" data-car="compartilhar">Compartilhar no Instagram</button><button class="btn sec sm" data-car="salvar">Salvar em Meus conteúdos</button></div>'+
 (R.briefing&&R.briefing.baseado_em?'<span class="sm base">✨ Baseado em: '+esc(R.briefing.baseado_em)+'</span>':'');
 return h+'</div>'}
async function carrCriar(){const B=lerBriefing();CARR.briefing=B;ocupado.carr='gerar';route();
 const r=await acao('carrossel',{briefing:B,fotos:IMGS.filter(x=>x.uso==='arte').length});
 if(r.erro){ocupado.carr=0;toast(r.erro);route();return}USO_IA++;CARR.res=r;CARR.artes=[];
 const c0=(r.paginas||[])[0];if(B.capa_ia!==false&&c0&&!(typeof c0.foto==='number'&&c0.foto<IMGS.filter(x=>x.uso==='arte').length)){const im=await geraFundoIA(c0,true);if(im)c0.fundo_ia=im}
 await desenhaTudo();ocupado.carr=0;route();setTimeout(()=>{const el=$('carrBox');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})},120)}
function editarPagina(i){const p=CARR.res.paginas[i],nf=IMGS.filter(x=>x.uso==='arte').length;
 const campo='padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff';
 openModal('<h2 id="mT" style="font-size:21px;font-weight:900">Página '+(i+1)+'</h2>'+(CARR.artes&&CARR.artes[i]?'<img src="'+CARR.artes[i]+'" alt="" style="width:100%;max-width:240px;justify-self:center;border-radius:12px;border:1px solid var(--line)">':'')+
 '<label class="f" for="pLay"><span>Modelo</span><select id="pLay" style="'+campo+'">'+[['capa','Capa'],['topicos','Lista de tópicos'],['numero','Número em destaque'],['frase','Frase'],['foto','Foto'],['cta','Chamada final']].map(o=>'<option value="'+o[0]+'"'+(p.layout===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></label>'+
 '<label class="f" for="pTit"><span>Título</span><input id="pTit" value="'+esc(p.titulo||'')+'" style="'+campo+'"></label><label class="f" for="pTxt"><span>Texto</span><textarea id="pTxt" rows="3" style="'+campo+'">'+esc(p.texto||'')+'</textarea></label>'+
 '<label class="f" for="pIt"><span>Tópicos (um por linha)</span><textarea id="pIt" rows="3" style="'+campo+'">'+esc((p.itens||[]).join('\n'))+'</textarea></label>'+
 '<div class="row" style="gap:8px;flex-wrap:wrap"><label class="f" for="pDes" style="flex:1;min-width:110px"><span>Destaque</span><input id="pDes" value="'+esc(p.destaque||'')+'" style="'+campo+'"></label>'+(nf?'<label class="f" for="pFot" style="flex:1;min-width:110px"><span>Foto</span><select id="pFot" style="'+campo+'"><option value="">Nenhuma</option>'+Array.from({length:nf},(_,k)=>'<option value="'+k+'"'+(p.foto===k?' selected':'')+'>Foto '+(k+1)+'</option>').join('')+'</select></label>':'')+'</div>'+
 '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sec fl" data-car="iaimg" data-i="'+i+'" '+(ocupado.img?'disabled':'')+'>'+(ocupado.img?'Gerando imagem…':'🎨 '+(p.fundo_ia?'Outro fundo com IA':'Gerar fundo com IA'))+'</button>'+(p.fundo_ia?'<button class="btn sec sm" data-car="semia" data-i="'+i+'">Tirar fundo</button>':'')+'</div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sec fl" data-car="refazpg" data-i="'+i+'" '+(ocupado.pg?'disabled':'')+'>'+ic('spark',14)+(ocupado.pg?'Refazendo…':'Refazer com IA')+'</button><button class="btn pri fl" data-car="salvapg" data-i="'+i+'">Salvar página</button></div>')}
async function redesenha(i){await prepIA(CARR.res.paginas[i]);const fotos=await Promise.all(IMGS.filter(x=>x.uso==='arte').map(x=>carregaImg(x.src)));const logo=await logoArte();CARR.artes[i]=await desenhaPagina(CARR.res.paginas[i],i,CARR.res.paginas.length,fotos,logo)}
async function arquivosCarr(){const A=CARR.artes||[],nome=(CARR.res.titulo||'carrossel').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'-').slice(0,30);return Promise.all(A.map(async(u,i)=>new File([await (await fetch(u)).blob()],nome+'-'+String(i+1).padStart(2,'0')+'.jpg',{type:'image/jpeg'})))}
async function carrSaida(modo){const fs=await arquivosCarr();if(!fs.length)return;
 if(modo==='compartilhar'&&navigator.canShare&&navigator.canShare({files:fs})){try{const R=CARR.res;await navigator.share({files:fs,text:R.legenda||''});return}catch(e){if(e&&e.name==='AbortError')return}}
 for(const f of fs){const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();a.remove();await new Promise(r=>setTimeout(r,350))}toast(fs.length+' imagens baixadas'+(modo==='compartilhar'?'. Abra o Instagram e escolha várias fotos para o carrossel.':''))}

async function geraFundoIA(pg,silencioso){const B=CARR.briefing||{},V=B.visual||{};const r=await acao('imagem_ia',{prompt:pg.imagem||'',pagina:{titulo:pg.titulo,texto:pg.texto,layout:pg.layout},cores:(V.cores||[]).filter(hexOk),estilo:V.estilo||''});
 if(r.erro){if(!silencioso||/cota|limite|imagens por IA de hoje/.test(r.erro))toast(r.erro);return null}if(typeof r.restam==='number'&&!silencioso)toast('Fundo criado! Restam '+r.restam+' imagens por IA hoje.');return r.dados||null}
/* ---------- eventos ---------- */
document.addEventListener('change',e=>{const t=e.target;if(!t)return;if(t.name==='gTipo'){tipoCriar=t.value;if(tipoCriar!=='carrossel'||!CARR){}route();return}if(t.id==='cImgs'&&t.files&&t.files.length){addImagens(t.files)}});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='gTema')temaCriar=e.target.value});
document.addEventListener('click',async e=>{const t=e.target.closest&&e.target.closest('[data-mk],[data-car],[data-carp],[data-img],[data-imgdel]');if(!t)return;const d=t.dataset;
 if(d.img!==undefined){const x=IMGS[+d.img];if(x){x.uso=x.uso==='arte'?'exemplo':'arte';route()}return}
 if(d.imgdel!==undefined){IMGS.splice(+d.imgdel,1);route();return}
 if(d.carp!==undefined){editarPagina(+d.carp);return}
 if(d.mk==='analisar'){ocupado.marca=1;route();const r=await acao('marca');ocupado.marca=0;if(r.erro)toast(r.erro);else{USO_IA++;const E=lojaAtual();const v=r.voz;delete r.voz;E.marca=r;if(v&&!(E.voz&&E.voz.resumo))E.voz=v;LOGO_IMG=null;toast('Pronto! O Radar conheceu a sua marca.')}route();return}
 if(d.mk==='salvar'){salvarMarca();return}
 if(d.mk==='maiscor'){const E=lojaAtual();E.marca=Object.assign({},E.marca);E.marca.cores=(E.marca.cores||[]).concat([{hex:'#962fbf',nome:'nova cor'}]).slice(0,6);route();return}
 const a=d.car;if(!a)return;
 if(a==='brief'){carrBrief();return}
 if(a==='criar'){carrCriar();return}
 if(a==='voltar'){CARR.res=null;CARR.artes=[];route();return}
 if(a==='baixar'||a==='compartilhar'){carrSaida(a);return}
 if(a==='salvar'){const R=CARR.res;const q=await sb.from('conteudos').insert({empresa_id:EMP_ID,tipo:'carrossel',titulo:(R.titulo||'Carrossel').slice(0,140),dados:{formato:'Carrossel',legenda:R.legenda||'',hashtags:R.hashtags||[],paginas:limpaPgs(R.paginas),gancho:(R.paginas[0]||{}).titulo||''},baseado_em:(R.briefing||{}).baseado_em||null,status:'rascunho'}).select().single();
  if(q.error){toast(traduz(q.error.message));return}CONTEUDOS=[q.data].concat(CONTEUDOS||[]);toast('Salvo em Meus conteúdos');route();return}
 if(a==='iaimg'){const i=+d.i,p=CARR.res.paginas[i];ocupado.img=1;editarPagina(i);const im=await geraFundoIA(p);ocupado.img=0;if(im){p.fundo_ia=im;p._iaImg=null;await redesenha(i);route()}editarPagina(i);return}
 if(a==='semia'){const i=+d.i,p=CARR.res.paginas[i];p.fundo_ia=null;p._iaImg=null;await redesenha(i);editarPagina(i);route();return}
 if(a==='salvapg'){const i=+d.i,p=CARR.res.paginas[i];p.layout=$('pLay').value;p.titulo=$('pTit').value.trim();p.texto=$('pTxt').value.trim();p.itens=$('pIt').value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,4);p.destaque=$('pDes').value.trim();if($('pFot'))p.foto=$('pFot').value===''?null:+$('pFot').value;
  await redesenha(i);closeModal();route();return}
 if(a==='refazpg'){const i=+d.i;ocupado.pg=1;editarPagina(i);const r=await acao('pagina',{indice:i,paginas:limpaPgs(CARR.res.paginas),briefing:CARR.briefing});ocupado.pg=0;if(r.erro){toast(r.erro);editarPagina(i);return}USO_IA++;const nova=Object.assign({},CARR.res.paginas[i],r.pagina||{},{fundo_ia:CARR.res.paginas[i].fundo_ia,_iaImg:CARR.res.paginas[i]._iaImg});if(typeof nova.foto!=='number')nova.foto=CARR.res.paginas[i].foto;CARR.res.paginas[i]=nova;await redesenha(i);editarPagina(i);route();return}});


/* confete ao criar conta */
function confetti(){if(reduce)return;const cv=$('conf'),x=cv.getContext('2d');cv.width=innerWidth;cv.height=innerHeight;const C=['#feda75','#fa7e1e','#d62976','#962fbf','#4f5bd5'];const ps=Array.from({length:140},()=>({x:innerWidth/2,y:innerHeight/3,vx:(Math.random()-.5)*14,vy:Math.random()*-12-4,s:4+Math.random()*6,c:C[Math.floor(Math.random()*5)],r:Math.random()*6}));let f=0;(function loop(){x.clearRect(0,0,cv.width,cv.height);ps.forEach(p=>{p.vy+=.35;p.x+=p.vx;p.y+=p.vy;p.r+=.1;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);x.restore()});if(++f<130)requestAnimationFrame(loop);else x.clearRect(0,0,cv.width,cv.height)})()}

/* relógio de verificação: atualiza a cada minuto e faz a "verificação" automática quando passa de 6 h */
setInterval(()=>{let mudou=false;conc.forEach(c=>{if(Date.now()>=nextCheck(c)){c.check=Date.now();delete c._d;mudou=true;nuvem('check',c)}});if(mudou){save();if(sess&&conta)route();toast('Radar atualizado: nova verificação concluída')}},60000);
addEventListener('unhandledrejection',ev=>dispatchEvent(new ErrorEvent('error',{message:String(ev.reason&&ev.reason.message||ev.reason)})));
addEventListener('error',ev=>{const r=$('root');if(r&&!r.querySelector('form,.card,h1,h2'))r.innerHTML='<div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;font-family:system-ui"><div><h2>Ops, algo deu errado</h2><p style="color:#666">'+String(ev.message||'').replace(/</g,'&lt;')+'</p><button onclick="try{localStorage.clear()}catch(e){};location.reload()" style="margin-top:12px;padding:12px 18px;border:0;border-radius:12px;background:#d62976;color:#fff;font-weight:800">Limpar e recarregar</button></div></div>'});
(async function init(){if(!CLOUD)return route();$('root').innerHTML='<div style="min-height:100vh;display:grid;place-items:center"><span class="spin" style="width:32px;height:32px"></span></div>';
 try{const {data}=await comPrazo(sb.auth.getSession(),8000);if(data&&data.session){const r=await carregar();if(r==='incompleto'){if(!draft.resp||!draft.resp.email){$('root').innerHTML='<div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center"><div><h2>✓ E-mail confirmado!</h2><p style="margin:12px 0 0;color:#555">Volte para a aba onde você começou o cadastro e toque em <b>Criar minha conta</b>.</p></div></div>';return}if(location.hash!=='#cadastro'){toast('E-mail confirmado! Termine seu cadastro.');location.hash='cadastro'}}}}catch(e){limparSessao();conta=null;conc=[];sess=false}
 sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT'){conta=null;conc=[];sess=false}});route();carregaPlanos();if(/preapproval_id=/.test(location.href)&&sess)voltaDoPagamento()})();

window.RADAR_OK=window.RADAR_OK1&&window.RADAR_OK2&&window.RADAR_OK3?1:0;

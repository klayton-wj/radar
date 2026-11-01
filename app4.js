/* ====================== ARTES_MARK */
/* ====================== ARTES: marca, carrossel com estilos e tutorial ====================== */
let tipoCriar='post',temaCriar='',IMGS=[],CARR=null,LOGO_IMG=null;
const hexOk=h=>/^#[0-9a-f]{6}$/i.test(String(h||''));
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const hexDe=c=>'#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>{const x=rgb(a),y=rgb(b);return hexDe(x.map((v,i)=>v+(y[i]-v)*t))};
const lum=h=>{const c=rgb(h);return (0.299*c[0]+0.587*c[1]+0.114*c[2])/255};
const sobre=h=>lum(h)>0.6?'#121217':'#ffffff';
const rgba=(h,a)=>{const c=rgb(h);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')'};
const carregaImg=src=>new Promise(ok=>{if(!src)return ok(null);const im=new Image();im.onload=()=>ok(im);im.onerror=()=>ok(null);im.src=src});
function reduzir(src,max,q){return carregaImg(src).then(im=>{if(!im)return null;const k=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',q)})}
async function paleta(src){const im=await carregaImg(src);if(!im)return [];const c=document.createElement('canvas');c.width=60;c.height=60;const x=c.getContext('2d');x.drawImage(im,0,0,60,60);const d=x.getImageData(0,0,60,60).data,b={};
 for(let i=0;i<d.length;i+=4){const k=(d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4),s=Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2]);b[k]=b[k]||{n:0,s:0,r:0,g:0,b:0};b[k].n++;b[k].s+=s;b[k].r+=d[i];b[k].g+=d[i+1];b[k].b+=d[i+2]}
 return Object.values(b).sort((p,q)=>(q.n*(1+q.s/q.n/60))-(p.n*(1+p.s/p.n/60))).slice(0,3).map(v=>hexDe([v.r/v.n,v.g/v.n,v.b/v.n]))}
const hashStr=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};

/* ---------- estilos e paletas ---------- */
const ESTILOS={
 editorial:{nome:'Editorial',dica:'Elegante, letra serifada',tit:'"Playfair Display",Georgia,serif',tp:'800',txt:'Inter,system-ui,sans-serif',caps:false},
 impacto:{nome:'Impacto',dica:'Foto inteira e letras grandes',tit:'"Bebas Neue",Impact,sans-serif',tp:'400',txt:'Inter,system-ui,sans-serif',caps:true},
 minimal:{nome:'Minimalista',dica:'Limpo, muito respiro',tit:'Inter,system-ui,sans-serif',tp:'800',txt:'Inter,system-ui,sans-serif',caps:false},
 vidro:{nome:'Vidro',dica:'Foto desfocada e cartão de vidro',tit:'"Space Grotesk",Inter,sans-serif',tp:'700',txt:'"Space Grotesk",Inter,sans-serif',caps:false},
 revista:{nome:'Revista',dica:'Foto em cima, título em faixa',tit:'Montserrat,Inter,sans-serif',tp:'800',txt:'Inter,system-ui,sans-serif',caps:false},
 neon:{nome:'Noturno',dica:'Escuro com brilho na cor da marca',tit:'"Space Grotesk",Inter,sans-serif',tp:'700',txt:'"Space Grotesk",Inter,sans-serif',caps:false}};
function estiloInicial(){const M=lojaAtual().marca||{},esc=(M.fundo==='escuro');const cl=String(M.clima||'')+' '+String(M.resumo||'');
 let op=esc?['impacto','neon','vidro','revista']:['editorial','minimal','revista','vidro'];
 if(/elegan|sofistic|delicad|luxo|premium/i.test(cl))op=['editorial'].concat(op.filter(x=>x!=='editorial'));
 if(/ousad|forte|energ|urban|street/i.test(cl))op=['impacto'].concat(op.filter(x=>x!=='impacto'));
 const n=(+(localStorage.getItem('radar_carr_n')||0))||0;return op[(hashStr(EMP_ID)+n)%Math.min(3,op.length)]}
function paletasDa(){const M=lojaAtual().marca||{},B=(CARR&&CARR.briefing)||{},V=B.visual||{};
 let base=(V.cores||[]).filter(hexOk);const mc=(M.cores||[]).map(c=>c.hex).filter(hexOk);if(!base.length)base=mc;if(!base.length)base=['#d62976','#962fbf','#fa7e1e'];
 const p=base[0],a=base[1]||mix(p,'#ffffff',.35),ps=[];
 ps.push({nome:'Sua marca',c:[p,a]});
 if(mc.length&&mc[0]!==p)ps.push({nome:'Marca 2',c:[mc[0],mc[1]||mix(mc[0],'#000000',.3)]});
 ps.push({nome:'Contraste',c:[mix(p,'#000000',.55),p]});
 ps.push({nome:'Suave',c:[mix(p,'#ffffff',.25),mix(p,'#ffffff',.7)]});
 ps.push({nome:'Clássico',c:['#141414',p]});
 return ps.slice(0,5)}

/* ---------- texto rico: *palavra* fica em destaque; linhas equilibradas ---------- */
function toks(s){const out=[];String(s||'').replace(/\s+/g,' ').trim().split(/(\*[^*]+\*)/).forEach(part=>{if(!part)return;const d=part[0]==='*'&&part.slice(-1)==='*';const txt=d?part.slice(1,-1):part;const cola=!d&&out.length&&/^[^\s]/.test(txt);txt.split(' ').forEach((w,k)=>{if(!w)return;if(k===0&&cola){out.push({w,d:false,cola:true})}else out.push({w,d})})});
 const r=[];out.forEach(t=>{if(t.cola&&r.length){r[r.length-1]={w:r[r.length-1].w,d:r[r.length-1].d,pos:(r[r.length-1].pos||'')+t.w}}else r.push(t)});return r.map(t=>t.pos?{w:t.w,d:t.d,pos:t.pos}:t)}
const largT=(x,t)=>x.measureText(t.w+(t.pos||'')).width;
function linhas(x,tk,W){const ls=[];let l=[],lw=0;const sp=x.measureText(' ').width;tk.forEach(t=>{const w=largT(x,t);if(l.length&&lw+sp+w>W){ls.push(l);l=[t];lw=w}else{lw+=(l.length?sp:0)+w;l.push(t)}});if(l.length)ls.push(l);return ls}
function equilibra(x,tk,W){const a=linhas(x,tk,W);if(a.length<2)return a;let best=a,lo=W*0.55;for(let w=W-20;w>=lo;w-=20){const b=linhas(x,tk,w);if(b.length!==a.length)break;best=b}return best}
function caixa(x,s,o){const tk=toks(o.caps?String(s||'').toUpperCase():s);if(!tk.length)return {h:0,draw(){}};let tam=o.max,ls;
 for(;;){x.font=o.peso+' '+tam+'px '+o.fam;ls=equilibra(x,tk,o.w);if((ls.length*tam*o.lh<=o.h&&ls.length<=(o.linhas||9))||tam<=o.min)break;tam=Math.max(o.min,Math.round(tam*0.92))}
 const cab=Math.min(o.linhas||9,Math.max(1,Math.floor(o.h/(tam*o.lh))));if(ls.length>cab){ls=ls.slice(0,cab);const u=ls[cab-1];u[u.length-1]={w:u[u.length-1].w.replace(/[.,;:]?$/,'…'),d:u[u.length-1].d}}
 return {h:ls.length*tam*o.lh,tam,draw(X,Y){x.font=o.peso+' '+tam+'px '+o.fam;x.textBaseline='top';const sp=x.measureText(' ').width;
  ls.forEach((l,k)=>{const lw=l.reduce((s,t,j)=>s+largT(x,t)+(j?sp:0),0);let cx=o.al==='center'?X+(o.w-lw)/2:o.al==='right'?X+o.w-lw:X;const cy=Y+k*tam*o.lh;
   l.forEach((t,j)=>{const w=x.measureText(t.w).width;if(t.d&&o.marca){x.fillStyle=o.marca;x.fillRect(cx-6,cy+tam*0.08,w+12,tam*0.92)}x.fillStyle=t.d?(o.dest||o.cor):o.cor;x.fillText(t.w,cx,cy);if(t.pos){x.fillStyle=o.cor;x.fillText(t.pos,cx+w,cy)}cx+=largT(x,t)+sp})})}}}
const semAst=s=>String(s||'').replace(/\*/g,'');

/* ---------- imagens ---------- */
function cobre(x,im,X,Y,W,H,dx){const k=Math.max(W/im.width,H/im.height),iw=im.width*k,ih=im.height*k;const sx=Math.max(0,iw-W),off=dx==null?0.5:dx;x.save();x.beginPath();x.rect(X,Y,W,H);x.clip();x.drawImage(im,X-sx*off,Y+(H-ih)/2,iw,ih);x.restore()}
function desfoca(im,W,H){const c=document.createElement('canvas');c.width=36;c.height=45;const k=c.getContext('2d');cobre(k,im,0,0,36,45);const d=document.createElement('canvas');d.width=W;d.height=H;const z=d.getContext('2d');z.imageSmoothingQuality='high';z.drawImage(c,0,0,W,H);return d}
function rr(x,X,Y,W,H,r){x.beginPath();if(x.roundRect)x.roundRect(X,Y,W,H,r);else x.rect(X,Y,W,H)}
async function logoArte(){const M=lojaAtual().marca||{};if(!M.usar_logo||!M.logo)return null;if(LOGO_IMG!==null)return LOGO_IMG||null;const r=await acao('imagem',{url:M.logo});LOGO_IMG=r&&r.dados?await carregaImg(r.dados):false;return LOGO_IMG||null}
let FONTES_OK=false;async function fontes(){if(FONTES_OK||!document.fonts)return;const fs=['800 60px "Playfair Display"','400 60px "Bebas Neue"','700 60px "Space Grotesk"','400 30px "Space Grotesk"','800 60px Montserrat','800 60px Inter','500 30px Inter'];
 await Promise.race([Promise.all(fs.map(f=>document.fonts.load(f).catch(()=>{}))),new Promise(r=>setTimeout(r,3000))]);FONTES_OK=true}

/* ---------- motor: desenha uma página ---------- */
function desenhaPagina(pg,i,n,ctx){const cv=document.createElement('canvas');cv.width=1080;cv.height=1350;const x=cv.getContext('2d'),W=1080,H=1350,M=88;
 const est=ESTILOS[CARR.estilo]||ESTILOS.editorial,id=CARR.estilo,pal=(CARR.paleta||paletasDa()[0]).c,p=pal[0],a=pal[1]||pal[0];
 const L=pg.layout||'topicos',arroba=conta.loja.ig||'',capa=L==='capa',cta=L==='cta';
 const img=(typeof pg.foto==='number'&&ctx.fotos[pg.foto])||pg._iaImg||ctx.fundo||null;
 const off=(i*0.23)%1;let tx='#121217',sub='#4b4b57',dest=p,marca=null,kc=p;const B=CARR.briefing||{};
 const kick=semAst(pg.rotulo||(capa?(conta.emp.fantasia||''):cta?'Próximo passo':''));
 // fundo e área de texto de cada estilo
 let bx={x:M,y:180,w:W-2*M,h:H-180-200},al='left';
 if(id==='impacto'){x.fillStyle='#0d0d10';x.fillRect(0,0,W,H);if(img){cobre(x,img,0,0,W,H,off);const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(0,0,0,'+(capa||cta?.15:.55)+')');g.addColorStop(1,'rgba(0,0,0,.9)');x.fillStyle=g;x.fillRect(0,0,W,H)}else{x.fillStyle=mix(p,'#000000',.6);x.fillRect(0,0,W,H)}
  tx='#ffffff';sub='rgba(255,255,255,.86)';dest=sobre(a)==='#ffffff'?'#ffffff':'#121217';marca=a;kc=lum(a)<0.35?mix(a,'#ffffff',.55):a;bx={x:M,y:capa||cta?H*0.42:220,w:W-2*M,h:capa||cta?H*0.58-200:H-420}}
 else if(id==='vidro'){x.fillStyle=mix(p,'#ffffff',.2);x.fillRect(0,0,W,H);if(img)x.drawImage(desfoca(img,W,H),0,0);else{const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,p);g.addColorStop(1,a);x.fillStyle=g;x.fillRect(0,0,W,H)}
  x.fillStyle='rgba(0,0,0,.18)';x.fillRect(0,0,W,H);const cy=capa?H*0.4:150,ch=capa?H*0.6-130:H-300;rr(x,60,cy,W-120,ch,48);x.fillStyle='rgba(255,255,255,.2)';x.fill();x.lineWidth=3;x.strokeStyle='rgba(255,255,255,.55)';x.stroke();
  if(capa&&img){x.save();rr(x,60,110,W-120,cy-150,48);x.clip();cobre(x,img,60,110,W-120,cy-150,off);x.restore()}tx='#ffffff';sub='rgba(255,255,255,.9)';dest=lum(p)>0.75?mix(p,'#000000',.2):mix(p,'#ffffff',.55);kc='#ffffff';bx={x:120,y:cy+70,w:W-240,h:ch-140}}
 else if(id==='neon'){x.fillStyle='#09090d';x.fillRect(0,0,W,H);x.strokeStyle=rgba(p,.12);x.lineWidth=2;for(let g=0;g<W;g+=90){x.beginPath();x.moveTo(g,0);x.lineTo(g,H);x.stroke()}for(let g=0;g<H;g+=90){x.beginPath();x.moveTo(0,g);x.lineTo(W,g);x.stroke()}
  if(img&&(capa||cta||L==='foto')){cobre(x,img,0,0,W,H,off);x.globalCompositeOperation='color';x.fillStyle=p;x.fillRect(0,0,W,H);x.globalCompositeOperation='source-over';const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(9,9,13,.25)');g.addColorStop(1,'rgba(9,9,13,.95)');x.fillStyle=g;x.fillRect(0,0,W,H)}
  const rg=x.createRadialGradient(W*0.85,H*0.1,10,W*0.85,H*0.1,700);rg.addColorStop(0,rgba(p,.45));rg.addColorStop(1,rgba(p,0));x.fillStyle=rg;x.fillRect(0,0,W,H);
  tx='#ffffff';sub='rgba(255,255,255,.78)';dest=mix(p,'#ffffff',.25);kc=mix(p,'#ffffff',.3);bx={x:M,y:capa||cta?H*0.45:200,w:W-2*M,h:capa||cta?H*0.55-200:H-400}}
 else if(id==='revista'){const esc=(lojaAtual().marca||{}).fundo==='escuro',bg=esc?'#111114':'#ffffff';x.fillStyle=bg;x.fillRect(0,0,W,H);tx=esc?'#ffffff':'#121217';sub=esc?'rgba(255,255,255,.78)':'#4b4b57';
  if(img&&(capa||L==='foto'||L==='numero')){const ih=capa?H*0.62:H*0.5;cobre(x,img,0,0,W,ih,off);x.fillStyle=p;x.fillRect(M-20,ih-70,W-2*M+40,150);bx={x:M,y:ih-40,w:W-2*M,h:H-ih-170};marca=null;
   const t=caixa(x,pg.titulo,{fam:est.tit,peso:est.tp,max:76,min:44,lh:1.04,w:W-2*M-20,h:120,linhas:2,cor:sobre(p),dest:sobre(p)});t.draw(M,ih-50+(120-t.h)/2);pg=Object.assign({},pg,{titulo:''});bx.y=ih+110;bx.h=H-ih-280;kc=p}
  else{x.fillStyle=p;x.fillRect(0,0,W,16);x.fillStyle=rgba(p,.08);x.fillRect(0,0,W,H*0.36);dest=p;kc=p}}
 else if(id==='minimal'){const esc=(lojaAtual().marca||{}).fundo==='escuro',bg=esc?mix(p,'#000000',.82):mix(p,'#ffffff',.93);x.fillStyle=bg;x.fillRect(0,0,W,H);tx=esc?'#ffffff':'#121217';sub=esc?'rgba(255,255,255,.75)':'#55555f';dest=esc?mix(p,'#ffffff',.4):p;kc=dest;
  if(img&&(capa||L==='foto')){const s=capa?520:600;x.save();rr(x,M,130,W-2*M,s,40);x.clip();cobre(x,img,M,130,W-2*M,s,off);x.restore();bx={x:M,y:130+s+70,w:W-2*M,h:H-(130+s+70)-190}}else bx={x:M,y:capa?H*0.32:230,w:W-2*M,h:H-(capa?H*0.32:230)-210}
  for(let k=0;k<n;k++){x.fillStyle=k===i?dest:rgba(tx==='#ffffff'?'#ffffff':'#121217',.15);rr(x,M+k*((W-2*M)/n),H-110,(W-2*M)/n-10,8,4);x.fill()}}
 else{const esc=(lojaAtual().marca||{}).fundo==='escuro',bg=esc?'#16130f':'#f6f1e9';x.fillStyle=bg;x.fillRect(0,0,W,H);tx=esc?'#f6f1e9':'#1b1712';sub=esc?'rgba(246,241,233,.78)':'#5b5348';dest=p;kc=p;
  x.strokeStyle=rgba(tx==='#1b1712'?'#1b1712':'#f6f1e9',.25);x.lineWidth=2;x.beginPath();x.moveTo(M,120);x.lineTo(W-M,120);x.stroke();x.beginPath();x.moveTo(M,H-130);x.lineTo(W-M,H-130);x.stroke();
  x.font='600 26px Inter,system-ui,sans-serif';x.fillStyle=sub;x.textBaseline='alphabetic';x.fillText((conta.emp.fantasia||'').toUpperCase().slice(0,30),M,98);x.textAlign='right';x.fillText(String(i+1).padStart(2,'0')+' — '+String(n).padStart(2,'0'),W-M,98);x.textAlign='left';
  if(img&&(capa||cta||L==='foto')){const fh=capa?600:L==='foto'?640:380;cobre(x,img,M,160,W-2*M,fh,off);bx={x:M,y:160+fh+60,w:W-2*M,h:H-130-(160+fh+60)-40}}else bx={x:M,y:capa?H*0.3:200,w:W-2*M,h:H-(capa?H*0.3:200)-200};if(capa&&!img)al='left'}
 // conteúdo: mede tudo antes e centraliza na área livre
 const ops=[];const add=(h,f,gap)=>ops.push({h,f,gap:gap||0});
 if(L==='frase')add(120,(Y)=>{x.font='900 240px Georgia,serif';x.fillStyle=rgba(dest,.45);x.textBaseline='top';x.fillText('“',bx.x-10,Y-30)});
 if(kick&&id!=='editorial')add(58,(Y)=>{x.font='700 28px '+est.txt;x.fillStyle=kc;x.textBaseline='top';const k=kick.toUpperCase().slice(0,34);let kx=bx.x;for(const ch of k){x.fillText(ch,kx,Y);kx+=x.measureText(ch).width+3}});
 else if(kick&&id==='editorial'&&(capa||cta))add(62,(Y)=>{x.font='italic 600 32px "Playfair Display",Georgia,serif';x.fillStyle=kc;x.textBaseline='top';x.fillText(kick.slice(0,40),bx.x,Y)});
 if(L==='numero'&&pg.destaque){const d=semAst(pg.destaque).slice(0,10);let t=id==='impacto'?300:230;const fn=()=>(id==='impacto'?'400 ':'800 ')+t+'px '+est.tit;x.font=fn();while(x.measureText(d).width>bx.w&&t>110){t-=16;x.font=fn()}const tt=t;add(tt,(Y)=>{x.font=(id==='impacto'?'400 ':'800 ')+tt+'px '+est.tit;x.fillStyle=dest;x.textBaseline='top';x.fillText(d,bx.x,Y)})}
 if(pg.emoji&&capa&&!img)add(110,(Y)=>{x.font='84px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';x.textBaseline='top';x.fillText(pg.emoji,bx.x,Y)});
 const usado=()=>ops.reduce((s,o)=>s+o.h+o.gap,0);
 const itens=(pg.itens||[]).filter(Boolean).slice(0,4),temCorpo=!!(itens.length||pg.texto||cta);
 const grande=capa?(id==='impacto'?170:118):cta?(id==='impacto'?150:100):L==='frase'?84:(id==='impacto'?124:92);
 const tt=caixa(x,L==='frase'&&!pg.titulo?pg.texto:pg.titulo,{fam:est.tit,peso:est.tp,caps:est.caps,max:grande,min:46,lh:est.caps?0.98:1.08,w:bx.w,h:(bx.h-usado())*(temCorpo?(capa?0.66:0.5):1),linhas:capa?5:4,cor:tx,dest,marca,al});
 if(tt.h)add(tt.h,(Y)=>tt.draw(bx.x,Y),36);
 if(itens.length){const livre=bx.h-usado()-(cta?130:0),hItem=Math.min(190,livre/itens.length);itens.forEach((it,k)=>{const b=caixa(x,it,{fam:est.txt,peso:'600',max:50,min:30,lh:1.2,w:bx.w-110,h:hItem-30,linhas:2,cor:tx,dest});const hh=Math.max(78,b.h+12);
   add(hh,(Y)=>{if(id==='editorial'){x.font='italic 700 56px "Playfair Display",Georgia,serif';x.fillStyle=dest;x.textBaseline='top';x.fillText(String(k+1).padStart(2,'0'),bx.x,Y-6)}
    else if(id==='impacto'||id==='neon'){x.fillStyle=dest;x.fillRect(bx.x,Y+6,14,Math.max(48,b.h-6))}
    else{rr(x,bx.x,Y,68,68,id==='vidro'?20:34);x.fillStyle=id==='vidro'?'rgba(255,255,255,.88)':dest;x.fill();x.font='800 34px '+est.txt;x.fillStyle=id==='vidro'?'#121217':sobre(dest);x.textAlign='center';x.textBaseline='middle';x.fillText(String(k+1),bx.x+34,Y+36);x.textAlign='left'}
    b.draw(bx.x+(id==='impacto'||id==='neon'?44:110),Y+(b.h<68?(68-b.h)/2:4))},28)})}
 else if(pg.texto&&!(L==='frase'&&!pg.titulo)){const b=caixa(x,pg.texto,{fam:est.txt,peso:'500',max:capa?46:46,min:30,lh:1.34,w:bx.w*(capa?0.92:1),h:Math.max(0,bx.h-usado()-(cta?130:0)),linhas:capa?3:6,cor:sub,dest});if(b.h)add(b.h,(Y)=>b.draw(bx.x,Y),30)}
 if(cta){const ch=semAst(B.chamada||pg.destaque||'Chama no direct').slice(0,40);add(100,(Y)=>{x.font='800 40px '+est.txt;const bw=Math.min(bx.w,x.measureText(ch).width+110);rr(x,bx.x,Y,bw,100,id==='editorial'?6:50);x.fillStyle=id==='vidro'?'#ffffff':dest;x.fill();x.fillStyle=id==='vidro'?'#121217':sobre(dest);x.textBaseline='middle';x.fillText(ch,bx.x+55,Y+52)},10)}
 const total=usado(),folga=Math.max(0,bx.h-total);let y=bx.y+(capa?folga:folga*(cta?0.5:0.38));
 ops.forEach(o=>{o.f(y);y+=o.h+o.gap});
 // rodapé
 x.textBaseline='alphabetic';x.font='700 28px '+est.txt;x.fillStyle=id==='editorial'?sub:rgba(tx==='#ffffff'?'#ffffff':'#121217',.8);
 if(id!=='minimal'){x.fillText(arroba,M,H-62);if(id!=='editorial'){x.textAlign='right';x.fillText(capa?'arraste →':(i+1)+'/'+n,W-M,H-62);x.textAlign='left'}else if(capa){x.textAlign='right';x.font='italic 600 30px "Playfair Display",Georgia,serif';x.fillText('arraste para o lado →',W-M,H-62);x.textAlign='left'}}
 else{x.fillText(arroba,M,H-150)}
 if(ctx.logo&&(capa||cta)){const lx=id==='minimal'?W-M-96:W-M-96,ly=id==='editorial'?140:70;x.save();x.beginPath();x.arc(lx+48,ly+48,48,0,Math.PI*2);x.clip();cobre(x,ctx.logo,lx,ly,96,96);x.restore()}
 return cv.toDataURL('image/jpeg',.9)}
async function contextoArte(){await fontes();const fotos=await Promise.all(IMGS.filter(x=>x.uso==='arte').map(x=>carregaImg(x.src)));for(const p of (CARR.res.paginas||[]))if(p.fundo_ia&&!p._iaImg)p._iaImg=await carregaImg(p.fundo_ia);
 if(CARR.fundoIA&&!CARR._fundo)CARR._fundo=await carregaImg(CARR.fundoIA);return {fotos,logo:await logoArte(),fundo:CARR._fundo||null}}
async function desenhaTudo(){if(!CARR||!CARR.res||!CARR.res.paginas)return;const ctx=await contextoArte();const ps=CARR.res.paginas;CARR.artes=ps.map((p,i)=>desenhaPagina(p,i,ps.length,ctx))}
async function redesenha(i){const ctx=await contextoArte();CARR.artes[i]=desenhaPagina(CARR.res.paginas[i],i,CARR.res.paginas.length,ctx)}
const limpaPgs=ps=>(ps||[]).map(p=>{const {fundo_ia,_iaImg,...r}=p;return r});

/* ---------- sua marca (Minha loja): simples ---------- */
function blocoMarcaRadar(){if(!CLOUD||!temR('gerador'))return '';const M=lojaAtual().marca;
 if(ocupado.marca)return carregando('O Radar está estudando o seu Instagram e o seu site…');
 if(!M)return '<div class="card marcaR"><div class="mk-top"><span class="mk-ico">🎨</span><div class="fl" style="min-width:min(100%,12em)"><b>Sua marca</b><p class="sm">O Radar aprende suas cores e seu estilo para as artes saírem com a sua cara.</p></div></div><button class="btn pri" data-mk="analisar">'+ic('spark')+'Analisar minha marca</button></div>';
 const cs=(M.cores||[]).filter(c=>hexOk(c.hex)),ed=ocupado.mkEd;
 return '<div class="card marcaR"><div class="mk-top"><span class="mk-ico">🎨</span><div class="fl" style="min-width:min(100%,12em)"><b>Sua marca</b><p class="sm">'+esc(M.resumo||'')+'</p></div></div>'+
 '<div class="mk-cores">'+cs.map(c=>'<span class="bola" style="background:'+c.hex+'" title="'+esc(c.nome||c.hex)+'"></span>').join('')+'<span class="sm">'+esc([M.fundo&&('fundo '+M.fundo),M.clima].filter(Boolean).join(' · '))+'</span></div>'+
 ((M.melhorias||[]).length?'<div class="mk-dica">🚀 <b>Dica do Radar:</b> '+esc(M.melhorias[0].titulo)+(M.melhorias[0].texto?'. '+esc(M.melhorias[0].texto):'')+'</div>':'')+
 (ed?'<div class="mk-ed"><div class="row" style="gap:10px;flex-wrap:wrap">'+cs.map((c,i)=>'<input type="color" class="corB" data-mkcor="'+i+'" value="'+esc(c.hex)+'" aria-label="Cor '+(i+1)+'">').join('')+'</div><div class="seg" role="group" aria-label="Fundo">'+['claro','escuro'].map(f=>'<button class="'+((M.fundo==='escuro')===(f==='escuro')?'on':'')+'" data-mkfundo="'+f+'">Fundo '+f+'</button>').join('')+'</div>'+(M.logo?'<label class="row sm" style="gap:8px;color:var(--ink)"><input type="checkbox" id="mkLogoUsa"'+(M.usar_logo?' checked':'')+'> Usar a foto do perfil como logo</label>':'')+'<div class="row" style="gap:8px"><button class="btn sec sm" data-mk="fechar">Cancelar</button><button class="btn pri sm" data-mk="salvar">Salvar</button></div></div>':
 '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sec sm" data-mk="editar">Ajustar cores</button><button class="btn sec sm" data-mk="analisar">'+ic('refresh',14)+'Analisar de novo</button></div>')+'</div>'}
async function salvarMarca(){const E=lojaAtual(),M=Object.assign({},E.marca||{});const cs=(M.cores||[]).slice();document.querySelectorAll('[data-mkcor]').forEach(inp=>{const i=+inp.dataset.mkcor;if(cs[i])cs[i]=Object.assign({},cs[i],{hex:inp.value})});M.cores=cs;
 const f=document.querySelector('[data-mkfundo].on');if(f)M.fundo=f.dataset.mkfundo;if($('mkLogoUsa'))M.usar_logo=$('mkLogoUsa').checked;
 const q=await sb.from('empresas').update({marca:M}).eq('id',EMP_ID);if(q.error){toast(traduz(q.error.message));return}E.marca=M;LOGO_IMG=null;ocupado.mkEd=0;toast('Marca salva');route()}
function avisoMarca(){if(lojaAtual().marca)return '';return '<div class="note row" style="gap:10px;flex-wrap:wrap;margin-bottom:12px;background:#fdf2f8;border-color:#fbcfe8;color:#9d174d"><span class="fl" style="min-width:min(100%,12em)">🎨 Analise sua marca uma vez e as artes saem com as suas cores.</span><button class="btn pri sm" data-mk="analisar">Analisar</button></div>'}

/* ---------- imagens do usuário ---------- */
function blocoImagens(){if(tipoCriar!=='carrossel')return '';
 return '<div class="imgsBox"><div class="row" style="gap:8px;flex-wrap:wrap"><span class="sm fl" style="font-weight:800;color:var(--ink);min-width:min(100%,10em)">Fotos (opcional)</span><label class="btn sec sm" style="cursor:pointer">'+ic('cam',14)+'Adicionar<input id="cImgs" type="file" accept="image/*" multiple hidden></label></div>'+
 (IMGS.length?'<div class="thumbs">'+IMGS.map((x,i)=>'<div class="th"><img src="'+x.src+'" alt="Foto '+(i+1)+'"><button type="button" class="tg '+x.uso+'" data-img="'+i+'">'+(x.uso==='arte'?'Usar na arte':'Só inspiração')+'</button><button type="button" class="x" data-imgdel="'+i+'" aria-label="Remover foto">✕</button></div>').join('')+'</div><p class="sm" style="margin:0">Toque na etiqueta para trocar: <b>Usar na arte</b> ou <b>Só inspiração</b> (a IA copia o estilo, não a imagem).</p>':'<p class="sm" style="margin:0">Sem fotos, a IA cria o fundo sozinha.</p>')+'</div>'}
async function addImagens(files){for(const f of [...files].slice(0,10)){if(IMGS.length>=12){toast('Máximo de 12 fotos.');break}
 const raw=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(f)});const src=await reduzir(raw,1080,0.88);if(src)IMGS.push({src,uso:'arte'})}route()}

/* ---------- pedido turbinado (resumido) ---------- */
async function carrBrief(){const ex=[];for(const x of IMGS.filter(x=>x.uso==='exemplo').slice(0,3)){const m=await reduzir(x.src,640,0.78);if(m)ex.push(m)}
 ocupado.carr='brief';CARR=null;route();
 const r=await acao('briefing',{tipo:'carrossel',pedido:temaCriar,fotos:IMGS.filter(x=>x.uso==='arte').length,exemplos:ex});ocupado.carr=0;
 if(r.erro){CARR={erro:r.erro};route();return}
 if((!r.visual||!(r.visual.cores||[]).some(hexOk)||r.sem_imagens)&&IMGS.some(x=>x.uso==='exemplo')){const p=await paleta(IMGS.find(x=>x.uso==='exemplo').src);if(p.length)r.visual=Object.assign({},r.visual,{cores:p})}
 CARR={briefing:r,estilo:estiloInicial()};CARR.paleta=paletasDa()[0];route();setTimeout(()=>{const el=$('carrBox');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})},120)}
function seletorEstilo(){return '<div class="estilos" role="radiogroup" aria-label="Estilo">'+Object.entries(ESTILOS).map(([k,e])=>'<button type="button" role="radio" aria-checked="'+(CARR.estilo===k)+'" class="est '+(CARR.estilo===k?'on':'')+'" data-est="'+k+'"><b style="font-family:'+esc(e.tit)+';'+(e.caps?'text-transform:uppercase;letter-spacing:.02em':'')+'">'+e.nome+'</b><span>'+e.dica+'</span></button>').join('')+'</div>'}
function seletorPaleta(){const ps=paletasDa(),cur=(CARR.paleta||ps[0]).c.join();return '<div class="pals" role="radiogroup" aria-label="Cores">'+ps.map((p,i)=>'<button type="button" role="radio" aria-checked="'+(p.c.join()===cur)+'" class="pal '+(p.c.join()===cur?'on':'')+'" data-pal="'+i+'" title="'+esc(p.nome)+'"><i style="background:'+p.c[0]+'"></i><i style="background:'+p.c[1]+'"></i></button>').join('')+'</div>'}
function cartaoBriefing(){const B=CARR.briefing,ab=ocupado.bDet;const campo='padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;width:100%;background:#fff';
 return '<div class="card brief"><span class="chip ig" style="justify-self:start">'+ic('spark')+'Seu carrossel</span>'+
 '<p class="b-res">Vou criar <b>'+(+B.paginas||6)+' páginas</b> para <b>'+esc(String(B.objetivo||'chamar atenção').replace(/^./,c=>c.toLowerCase()))+'</b>.</p>'+
 '<label class="f" for="bGan"><span>Frase da capa</span><input id="bGan" value="'+esc(semAst(B.gancho||''))+'" style="'+campo+';font-weight:700"></label>'+
 '<div><span class="sm" style="font-weight:800;color:var(--ink)">Estilo</span>'+seletorEstilo()+'</div>'+
 '<div><span class="sm" style="font-weight:800;color:var(--ink)">Cores</span>'+seletorPaleta()+'</div>'+
 (ab?'<div class="b-det"><label class="f" for="bObj"><span>Objetivo</span><input id="bObj" value="'+esc(B.objetivo||'')+'" style="'+campo+'"></label><div class="row" style="gap:10px;flex-wrap:wrap"><label class="f" for="bPag" style="flex:1;min-width:110px"><span>Páginas</span><select id="bPag" style="'+campo+'">'+[5,6,7,8].map(n=>'<option'+(n===(+B.paginas||6)?' selected':'')+'>'+n+'</option>').join('')+'</select></label><label class="f" for="bCta" style="flex:2;min-width:160px"><span>Chamada final</span><input id="bCta" value="'+esc(B.chamada||'')+'" style="'+campo+'"></label></div>'+(B.baseado_em?'<span class="sm base">✨ Baseado em: '+esc(B.baseado_em)+'</span>':'')+'</div>':'')+
 '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><button class="lnk" data-car="det">'+(ab?'Menos detalhes':'Ajustar detalhes')+'</button><span class="fl"></span><button class="btn pri" data-car="criar">'+ic('spark')+'Criar carrossel</button></div></div>'}
function lerBriefing(){const B=Object.assign({},CARR.briefing);const v=id=>$(id)?$(id).value.trim():'';B.gancho=v('bGan')||B.gancho;B.objetivo=v('bObj')||B.objetivo;B.chamada=v('bCta')||B.chamada;B.paginas=+v('bPag')||B.paginas||6;
 B.visual=Object.assign({},B.visual||{},{cores:(CARR.paleta||paletasDa()[0]).c});B.estilo=CARR.estilo;return B}

/* ---------- tela do carrossel ---------- */
function renderCarr(){let h='<div id="carrBox" style="margin-top:12px;display:grid;gap:12px">';
 if(ocupado.carr==='brief')return h+carregando('A IA está planejando o seu carrossel…')+'</div>';
 if(CARR&&CARR.erro)return h+'<div class="note">'+esc(CARR.erro)+(/plano|upgrade/i.test(CARR.erro)?' <a href="#planos">Ver planos</a>':'')+'</div></div>';
 if(!CARR)return h+'</div>';
 if(!CARR.res)return h+(ocupado.carr==='gerar'?carregando(ocupado.carrMsg||'A IA está escrevendo o seu carrossel…'):cartaoBriefing())+'</div>';
 const R=CARR.res,A=CARR.artes||[];
 h+='<div class="card carr-top"><div class="row" style="flex-wrap:wrap;gap:8px"><b class="fl" style="font-size:18px;min-width:min(100%,10em)">'+esc(semAst(R.titulo||'Seu carrossel'))+'</b><button class="lnk" data-car="voltar">Mudar o plano</button></div>'+seletorEstilo()+seletorPaleta()+'</div>'+
 '<div class="strip" role="list">'+R.paginas.map((p,i)=>'<figure role="listitem"><button class="pgbtn" data-carp="'+i+'" aria-label="Editar página '+(i+1)+'">'+(A[i]?'<img src="'+A[i]+'" alt="Página '+(i+1)+'">':'<span class="ph2"><span class="spin"></span></span>')+'<span class="edt">✏️ Editar</span></button></figure>').join('')+'</div>'+
 '<p class="sm" style="margin:0;text-align:center">Arraste para ver as '+R.paginas.length+' páginas · toque numa página para editar</p>'+
 '<div class="card" style="display:grid;gap:8px"><b>Legenda</b><div class="leg">'+esc(R.legenda||'')+'</div>'+((R.hashtags||[]).length?'<span class="sm" style="color:#962fbf">'+esc(R.hashtags.map(t=>t[0]==='#'?t:'#'+t).join(' '))+'</span>':'')+'<button class="btn sec sm" style="justify-self:start" data-copy="'+esc((R.legenda||'')+((R.hashtags||[]).length?'\n\n'+R.hashtags.map(t=>t[0]==='#'?t:'#'+t).join(' '):''))+'">Copiar legenda</button></div>'+
 '<div class="acoesC"><button class="btn pri" data-car="compartilhar">'+ic('ig',16)+'Postar no Instagram</button><button class="btn sec" data-car="baixar">Baixar imagens</button><button class="btn sec" data-car="salvar">Salvar</button></div>';
 return h+'</div>'}
async function geraFundoIA(pg,silencioso){const B=CARR.briefing||{},V=B.visual||{};const r=await acao('imagem_ia',{prompt:pg.imagem||'',pagina:{titulo:semAst(pg.titulo),texto:pg.texto,layout:pg.layout},cores:(CARR.paleta||{c:V.cores||[]}).c.filter(hexOk),estilo:(ESTILOS[CARR.estilo]||{}).dica||''});
 if(r.erro){toast((silencioso?'Fundo por IA: ':'')+r.erro);return null}if(!r.dados){toast('A IA de imagens não devolveu a imagem.');return null}if(!silencioso&&typeof r.restam==='number')toast('Fundo criado! Restam '+r.restam+' imagens por IA hoje.');return r.dados}
async function carrCriar(){const B=lerBriefing();CARR.briefing=B;ocupado.carr='gerar';ocupado.carrMsg='A IA está escrevendo o seu carrossel…';route();
 const r=await acao('carrossel',{briefing:B,fotos:IMGS.filter(x=>x.uso==='arte').length});
 if(r.erro){ocupado.carr=0;toast(r.erro);route();return}USO_IA++;CARR.res=r;CARR.artes=[];CARR.fundoIA=null;CARR._fundo=null;
 try{localStorage.setItem('radar_carr_n',String((+(localStorage.getItem('radar_carr_n')||0))+1))}catch(_){}
 const temFoto=IMGS.some(x=>x.uso==='arte');if(!temFoto){ocupado.carrMsg='Criando o fundo com IA e montando as artes…';route();const c0=(r.paginas||[])[0]||{};const im=await geraFundoIA(c0,true);if(im)CARR.fundoIA=im}
 await desenhaTudo();ocupado.carr=0;route();setTimeout(()=>{const el=$('carrBox');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})},120)}
function editarPagina(i){const p=CARR.res.paginas[i],nf=IMGS.filter(x=>x.uso==='arte').length;const campo='padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;width:100%;background:#fff';
 openModal('<h2 id="mT" style="font-size:20px;font-weight:900">Página '+(i+1)+'</h2>'+(CARR.artes&&CARR.artes[i]?'<img src="'+CARR.artes[i]+'" alt="" class="pgprev">':'')+
 '<label class="f" for="pTit"><span>Título <em class="sm" style="font-style:normal">(use *asteriscos* para destacar uma palavra)</em></span><input id="pTit" value="'+esc(p.titulo||'')+'" style="'+campo+'"></label>'+
 ((p.itens||[]).length?'<label class="f" for="pIt"><span>Tópicos (um por linha)</span><textarea id="pIt" rows="3" style="'+campo+'">'+esc((p.itens||[]).join('\n'))+'</textarea></label>':'<label class="f" for="pTxt"><span>Texto</span><textarea id="pTxt" rows="3" style="'+campo+'">'+esc(p.texto||'')+'</textarea></label>')+
 (nf?'<label class="f" for="pFot"><span>Foto</span><select id="pFot" style="'+campo+'"><option value="">Sem foto</option>'+Array.from({length:nf},(_,k)=>'<option value="'+k+'"'+(p.foto===k?' selected':'')+'>Foto '+(k+1)+'</option>').join('')+'</select></label>':'')+
 '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sec fl" data-car="refazpg" data-i="'+i+'" '+(ocupado.pg?'disabled':'')+'>'+ic('spark',14)+(ocupado.pg?'Refazendo…':'Reescrever')+'</button><button class="btn sec fl" data-car="iaimg" data-i="'+i+'" '+(ocupado.img?'disabled':'')+'>'+(ocupado.img?'Gerando…':'🎨 Novo fundo')+'</button></div>'+
 '<button class="btn pri" data-car="salvapg" data-i="'+i+'">Salvar</button>')}
async function arquivosCarr(){const A=CARR.artes||[],nome=semAst(CARR.res.titulo||'carrossel').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'-').slice(0,30);return Promise.all(A.map(async(u,i)=>new File([await (await fetch(u)).blob()],nome+'-'+String(i+1).padStart(2,'0')+'.jpg',{type:'image/jpeg'})))}
async function carrSaida(modo){const fs=await arquivosCarr();if(!fs.length)return;
 if(modo==='compartilhar'&&navigator.canShare&&navigator.canShare({files:fs})){try{await navigator.share({files:fs,text:CARR.res.legenda||''});return}catch(e){if(e&&e.name==='AbortError')return}}
 for(const f of fs){const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();a.remove();await new Promise(r=>setTimeout(r,350))}toast(fs.length+' imagens baixadas'+(modo==='compartilhar'?'. No Instagram, escolha várias fotos para montar o carrossel.':''))}

/* ---------- tutorial de cada aba (só na primeira vez; depois pelo botão ?) ---------- */
const TOUR={
 painel:[['.ph h1','Seu painel','Aqui você vê, num só lugar, o que as suas concorrentes fizeram de novo e o que fazer a respeito.'],['.kpis','Números do dia','Quantas concorrentes você acompanha, seus seguidores e quantas promoções e posts elas estão fazendo.'],['.feed','O que está acontecendo','A IA lista as novidades de cada concorrente: posts que bombaram, promoções e mudanças no site.'],['.turb','Vale impulsionar','Quando um post seu vai muito melhor que a média, o Radar avisa e mostra como impulsionar: público, verba e o passo a passo.'],['.card.ai','Sugestão do dia','A melhor ação para você hoje, baseada no que as concorrentes estão fazendo.'],['.sino','Alertas','Quando uma concorrente viralizar ou lançar promoção, o aviso aparece aqui.']],
 concorrentes:[['.ph h1','Suas concorrentes','Cada cartão é uma loja que o Radar vigia sozinho a cada 6 horas.'],['.ph [data-act=add]','Adicionar concorrente','Toque aqui e informe o Instagram e o site. Em 1 minuto ela entra no radar.'],['.cc','Abra uma concorrente','Toque no cartão para ver tudo: posts, produtos, preços e como rebater.']],
 concorrente:[['.hero','A concorrente','Os links e a hora da última leitura. O robô volta a ler sozinho.'],['#bCheck','Verificar agora','Quer a informação fresquinha? Toque aqui para o robô ler de novo.'],['.tabs','Tudo sobre ela','Navegue pelas abas: o que estão fazendo, posts, produtos, anúncios, como rebater e metas.'],['[data-ctab=rebater]','Como rebater','A IA monta um plano de ação para você responder, sem guerra de preço.']],
 perfil:[['.ph h1','Raio-X do seu Instagram','A IA analisa o seu perfil e compara com as concorrentes.'],['[data-pl=perfil]','Analisar','Toque para a IA dar nota, apontar pontos fortes e o que melhorar.']],
 planejar:[['.ph h1','Planejar','Aqui a IA te ajuda a decidir o que postar e quando.'],['.tabs','As ferramentas','Calendário da semana, Criar com IA, Avaliações do Google, inspirações, hashtags, datas e tendências.'],['[data-pltab=criar]','Criar com IA','Posts completos, carrosséis com arte pronta, stories, anúncios e mais, no jeito da sua marca.']],
 criar:[['#fGerar .tipos','Escolha o que criar','Post completo, carrossel com artes, roteiro de Reels, stories, anúncio e mais.'],['#gTema','Diga o assunto (ou não)','Escreva do seu jeito, como "promoção de sexta". Se deixar em branco, a IA escolhe o melhor tema agora.'],['#fGerar button.pri','Criar','A IA usa o que deu certo nas concorrentes, seus melhores posts e a sua marca.']],
 loja:[['.ph h1','Sua loja','Seus dados, seu plano e as conexões.'],['.marcaR','Sua marca','O Radar aprende suas cores e seu estilo para todas as artes saírem com a sua cara.']],
 planos:[['.planos','Planos','Compare o que cada plano libera. Você pode mudar ou cancelar quando quiser.'],['#pacotes','Vagas extras','Precisa de mais concorrentes sem trocar de plano? Compre vagas avulsas.']]};
let TOUR_AT=null;
function chaveTour(){const h=(location.hash||'').slice(1),r=h.split('/')[0];if(r==='c')return 'concorrente';if(r==='planejar')return plTab==='criar'?'criar':'planejar';return TOUR[r]?r:(r===''||r==='painel'?'painel':null)}
const visto=k=>{try{return localStorage.getItem('radar_tour_'+k)==='1'}catch(_){return true}};
const marcaVisto=k=>{try{localStorage.setItem('radar_tour_'+k,'1')}catch(_){}};
function fechaTour(){const o=$('tourO');if(o)o.remove();if(TOUR_AT)marcaVisto(TOUR_AT.k);TOUR_AT=null;removeEventListener('resize',posTour);removeEventListener('scroll',posTour)}
function abreTour(k){const ps=(TOUR[k]||[]).filter(s=>{const e=document.querySelector(s[0]);return e&&e.getBoundingClientRect().width>0});if(!ps.length){marcaVisto(k);return}
 fechaTour();TOUR_AT={k,ps,i:0,rota:location.hash};const o=document.createElement('div');o.id='tourO';o.innerHTML='<div class="t-hi"></div><div class="t-box" role="dialog" aria-modal="true" aria-labelledby="tT"><span class="t-n"></span><b id="tT"></b><p></p><div class="t-bt"><button class="lnk" data-tour="pular">Pular</button><span class="fl"></span><button class="btn sec sm" data-tour="volta">Voltar</button><button class="btn pri sm" data-tour="prox">Próximo</button></div></div>';document.body.appendChild(o);addEventListener('resize',posTour);addEventListener('scroll',posTour,{passive:true});passoTour()}
function passoTour(){const T=TOUR_AT;if(!T)return;const s=T.ps[T.i],e=document.querySelector(s[0]);const o=$('tourO');if(!o)return;
 o.querySelector('#tT').textContent=s[1];o.querySelector('p').textContent=s[2];o.querySelector('.t-n').textContent=(T.i+1)+' de '+T.ps.length;o.querySelector('[data-tour=volta]').hidden=T.i===0;o.querySelector('[data-tour=prox]').textContent=T.i===T.ps.length-1?'Entendi':'Próximo';
 if(e){const r0=e.getBoundingClientRect();if(r0.top<70||r0.bottom>innerHeight-150)e.scrollIntoView({block:'center',behavior:'instant'})}setTimeout(posTour,60);o.querySelector('[data-tour=prox]').focus()}
function posTour(){const T=TOUR_AT;if(!T)return;const e=document.querySelector(T.ps[T.i][0]),o=$('tourO');if(!e||!o)return;const r=e.getBoundingClientRect(),hi=o.querySelector('.t-hi'),bx=o.querySelector('.t-box');const pad=8;
 const top=Math.max(4,r.top-pad),hh=Math.min(r.height+pad*2,innerHeight*0.6);Object.assign(hi.style,{left:Math.max(4,r.left-pad)+'px',top:top+'px',width:Math.min(innerWidth-8,r.width+pad*2)+'px',height:hh+'px'});
 const bh=bx.offsetHeight||170,abaixo=top+hh+12+bh<innerHeight-70;bx.style.top=(abaixo?top+hh+12:Math.max(8,top-bh-12))+'px'}
const _routeOrig=route;route=function(){if(TOUR_AT&&TOUR_AT.rota!==location.hash)fechaTour();const r=_routeOrig.apply(this,arguments);setTimeout(()=>{if(!conta||!sess)return;
 const ph=document.querySelector('main .ph'),mn=document.querySelector('main');if(chaveTour()&&mn&&!mn.querySelector('.tourBtn')){const b=document.createElement('button');b.className='tourBtn'+(ph?'':' solta');b.type='button';b.setAttribute('aria-label','Como funciona esta tela');b.dataset.tour='abrir';b.textContent='?';(ph||mn).appendChild(b)}
 const k=chaveTour();if(k&&!visto(k)&&!TOUR_AT&&$('modal').hidden)setTimeout(()=>{if(chaveTour()===k&&!TOUR_AT)abreTour(k)},500)},30);return r};
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-tour]');if(!t)return;const a=t.dataset.tour;
 if(a==='abrir'){const k=chaveTour();if(k)abreTour(k);return}if(!TOUR_AT)return;if(a==='pular'){fechaTour();return}
 if(a==='prox'){if(TOUR_AT.i>=TOUR_AT.ps.length-1){fechaTour();return}TOUR_AT.i++;passoTour();return}if(a==='volta'&&TOUR_AT.i>0){TOUR_AT.i--;passoTour()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&TOUR_AT)fechaTour()});

/* ---------- eventos ---------- */
document.addEventListener('change',e=>{const t=e.target;if(!t)return;if(t.name==='gTipo'){tipoCriar=t.value;route();return}if(t.id==='cImgs'&&t.files&&t.files.length)addImagens(t.files)});
document.addEventListener('input',e=>{if(e.target&&e.target.id==='gTema')temaCriar=e.target.value});
document.addEventListener('click',async e=>{const t=e.target.closest&&e.target.closest('[data-mk],[data-mkfundo],[data-car],[data-carp],[data-img],[data-imgdel],[data-est],[data-pal]');if(!t)return;const d=t.dataset;
 if(d.img!==undefined){const x=IMGS[+d.img];if(x){x.uso=x.uso==='arte'?'exemplo':'arte';route()}return}
 if(d.imgdel!==undefined){IMGS.splice(+d.imgdel,1);route();return}
 if(d.carp!==undefined){editarPagina(+d.carp);return}
 if(d.mkfundo){document.querySelectorAll('[data-mkfundo]').forEach(b=>b.classList.toggle('on',b===t));return}
 if(d.est){CARR.estilo=d.est;if(CARR.res){await desenhaTudo()}else{CARR.briefing.gancho=$('bGan')?$('bGan').value:CARR.briefing.gancho}route();return}
 if(d.pal!==undefined){if(!CARR.res&&$('bGan'))CARR.briefing.gancho=$('bGan').value;CARR.paleta=paletasDa()[+d.pal];if(CARR.res)await desenhaTudo();route();return}
 if(d.mk==='analisar'){ocupado.marca=1;route();const r=await acao('marca');ocupado.marca=0;if(r.erro)toast(r.erro);else{USO_IA++;const E=lojaAtual();const v=r.voz;delete r.voz;E.marca=r;if(v&&!(E.voz&&E.voz.resumo))E.voz=v;LOGO_IMG=null;toast('Pronto! O Radar conheceu a sua marca.')}route();return}
 if(d.mk==='editar'){ocupado.mkEd=1;route();return}if(d.mk==='fechar'){ocupado.mkEd=0;route();return}if(d.mk==='salvar'){salvarMarca();return}
 const a=d.car;if(!a)return;
 if(a==='det'){if($('bGan'))CARR.briefing.gancho=$('bGan').value;ocupado.bDet=!ocupado.bDet;route();return}
 if(a==='criar'){carrCriar();return}
 if(a==='voltar'){CARR.res=null;CARR.artes=[];route();return}
 if(a==='baixar'||a==='compartilhar'){carrSaida(a);return}
 if(a==='salvar'){const R=CARR.res;const q=await sb.from('conteudos').insert({empresa_id:EMP_ID,tipo:'carrossel',titulo:semAst(R.titulo||'Carrossel').slice(0,140),dados:{formato:'Carrossel',legenda:R.legenda||'',hashtags:R.hashtags||[],paginas:limpaPgs(R.paginas),estilo:CARR.estilo,gancho:semAst((R.paginas[0]||{}).titulo||'')},baseado_em:(R.briefing||{}).baseado_em||null,status:'rascunho'}).select().single();
  if(q.error){toast(traduz(q.error.message));return}CONTEUDOS=[q.data].concat(CONTEUDOS||[]);toast('Salvo em Meus conteúdos');route();return}
 if(a==='salvapg'){const i=+d.i,p=CARR.res.paginas[i];p.titulo=$('pTit').value.trim();if($('pIt'))p.itens=$('pIt').value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,4);if($('pTxt'))p.texto=$('pTxt').value.trim();if($('pFot'))p.foto=$('pFot').value===''?null:+$('pFot').value;await redesenha(i);closeModal();route();return}
 if(a==='refazpg'){const i=+d.i;ocupado.pg=1;editarPagina(i);const r=await acao('pagina',{indice:i,paginas:limpaPgs(CARR.res.paginas),briefing:CARR.briefing});ocupado.pg=0;if(r.erro){toast(r.erro);editarPagina(i);return}USO_IA++;const ant=CARR.res.paginas[i];const nova=Object.assign({},ant,r.pagina||{},{fundo_ia:ant.fundo_ia,_iaImg:ant._iaImg});if(typeof nova.foto!=='number')nova.foto=ant.foto;CARR.res.paginas[i]=nova;await redesenha(i);editarPagina(i);route();return}
 if(a==='iaimg'){const i=+d.i,p=CARR.res.paginas[i];ocupado.img=1;editarPagina(i);const im=await geraFundoIA(p);ocupado.img=0;if(im){p.fundo_ia=im;p._iaImg=null;await redesenha(i);route()}editarPagina(i);return}});


/* ---------- 🚀 Turbine este post ---------- */
let TURB={};
const turbFeitos=()=>{try{return JSON.parse(localStorage.getItem('radar_turb_ok')||'[]')}catch(_){return []}};
function postsParaTurbinar(){const m=minhaIG();if(!m||!m.posts)return [];const lim=Date.now()-7*864e5,ok=turbFeitos();
 return m.posts.filter(p=>(p.vezes_media||0)>=2&&p.link&&Date.parse(p.data)>lim&&!ok.includes(p.link)).sort((a,b)=>b.vezes_media-a.vezes_media).slice(0,2)}
function blocoTurbinar(){if(!CLOUD)return '';const ps=postsParaTurbinar();if(!ps.length)return '';const p=ps[0];
 return '<div class="card turb"><div class="tb-img">'+(p.foto?'<img src="'+esc(p.foto)+'" alt="" referrerpolicy="no-referrer">':'<span>🚀</span>')+'</div><div class="tb-txt"><span class="chip ok" style="justify-self:start">🚀 Vale impulsionar</span><b>Seu '+esc(String(p.tipo||'post').toLowerCase())+' está com '+String(p.vezes_media).replace('.',',')+'x a sua média</b><span class="sm">'+esc((p.legenda||'').slice(0,90))+((p.legenda||'').length>90?'…':'')+'</span><span class="sm">Impulsionar o que já funciona é o jeito mais barato de anunciar.</span><button class="btn pri sm" data-turb="'+esc(p.link)+'">Ver como impulsionar</button></div></div>'}
function postPorLink(link){const m=minhaIG();return (m&&m.posts||[]).find(p=>p.link===link)||null}
async function abrirTurbinar(link){const p=postPorLink(link);if(!p){toast('Esse post não está mais entre os recentes.');return}
 const desenha=()=>{const R=TURB[link];
  let h='<h2 id="mT" style="font-size:21px;font-weight:900">🚀 Impulsionar este post</h2><div class="tb-mini">'+(p.foto?'<img src="'+esc(p.foto)+'" alt="" referrerpolicy="no-referrer">':'')+'<div><b>'+esc(p.tipo||'Post')+' · '+String(p.vezes_media).replace('.',',')+'x a sua média</b><span class="sm">'+fmt(p.curtidas||0)+' curtidas · '+fmt(p.comentarios||0)+' comentários</span></div></div>';
  if(!R||R.carregando)return h+carregando('A IA está montando a recomendação…');
  if(R.erro)return h+'<div class="note">'+esc(R.erro)+'</div><button class="btn sec" data-act="close">Fechar</button>';
  const P=R.publico||{},V=R.verba||{};
  h+=(R.porque?'<p class="mut" style="margin:0">'+esc(R.porque)+'</p>':'')+
  '<div class="tb-verba"><span class="sm">Verba sugerida</span><b>R$ '+V.por_dia+' por dia · '+V.dias+' dias</b><span class="sm">Total: <b>R$ '+V.total+'</b></span></div>'+
  '<div class="tb-grid"><div><span class="sm">🎯 Objetivo</span><b>'+esc(R.objetivo||'')+'</b>'+(R.objetivo_porque?'<span class="sm">'+esc(R.objetivo_porque)+'</span>':'')+'</div>'+
  '<div><span class="sm">👥 Público</span><b>'+esc([P.local,P.idade&&(P.idade+' anos'),P.genero&&P.genero!=='todos'?P.genero:''].filter(Boolean).join(' · '))+'</b>'+((P.interesses||[]).length?'<span class="sm">Interesses: '+esc(P.interesses.join(', '))+'</span>':'')+'</div></div>'+
  (R.o_que_esperar?'<p class="sm" style="margin:0">📈 '+esc(R.o_que_esperar)+'</p>':'')+
  (R.ajuste_legenda?'<div class="note" style="background:#fdf2f8;border-color:#fbcfe8;color:#9d174d">✍️ Antes de impulsionar, troque a primeira linha da legenda por: <b>'+esc(R.ajuste_legenda)+'</b></div>':'')+
  '<details><summary class="sm" style="font-weight:800;color:var(--ink);cursor:pointer">Como fazer no Instagram (1 minuto)</summary><ol class="rot"><li>Abra o post no Instagram e toque em <b>Turbinar</b>.</li><li>Em <b>Objetivo</b>, escolha "'+esc(R.objetivo||'Mais visitas ao perfil')+'".</li><li>Em <b>Público</b>, crie um personalizado: '+esc([P.local,P.idade&&(P.idade+' anos')].filter(Boolean).join(', '))+(P.interesses&&P.interesses.length?' e os interesses sugeridos':'')+'.</li><li>Em <b>Orçamento e duração</b>, coloque R$ '+V.por_dia+' por dia por '+V.dias+' dias.</li><li>Revise e toque em <b>Turbinar post</b>.</li></ol></details>'+
  (R.dica?'<p class="sm" style="margin:0">💡 '+esc(R.dica)+'</p>':'')+
  '<div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn pri fl" href="'+esc(link)+'" target="_blank" rel="noopener">'+ic('ig',16)+'Abrir no Instagram</a><button class="btn sec fl" data-copy="'+esc('Objetivo: '+(R.objetivo||'')+'\nPúblico: '+[P.local,P.idade&&(P.idade+' anos'),P.genero].filter(Boolean).join(', ')+(P.interesses&&P.interesses.length?'\nInteresses: '+P.interesses.join(', '):'')+'\nVerba: R$ '+V.por_dia+'/dia por '+V.dias+' dias (R$ '+V.total+')')+'">Copiar</button></div>'+
  '<button class="lnk" style="justify-self:center" data-turbok="'+esc(link)+'">Já impulsionei / não quero</button>';
  return h};
 openModal(desenha());if(TURB[link]&&!TURB[link].erro)return;
 TURB[link]={carregando:1};const m=minhaIG();const r=await acao('turbinar',{post:{link:p.link,tipo:p.tipo,legenda:p.legenda,curtidas:p.curtidas,comentarios:p.comentarios,vezes_media:p.vezes_media,data:p.data},seguidores:m&&m.seguidores});
 TURB[link]=r;if(!r.erro)USO_IA++;if(!$('modal').hidden)$('modalBox').innerHTML=desenha()}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-turb],[data-turbok]');if(!t)return;
 if(t.dataset.turb){closeModal();setTimeout(()=>abrirTurbinar(t.dataset.turb),50);return}
 if(t.dataset.turbok){const l=turbFeitos();l.push(t.dataset.turbok);try{localStorage.setItem('radar_turb_ok',JSON.stringify(l.slice(-50)))}catch(_){}closeModal();route();toast('Combinado! O Radar avisa quando outro post bombar.')}});

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

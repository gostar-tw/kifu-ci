// node sim/duel.js G startG matches.json out.jsonl 分鐘   （GitHub Actions 跑 AI 對 AI 模擬；A=被測方）
// match:{id,N,A:{lv,boss,ov},B:{lv,boss,ov}}   match:{id,N,A:{lv,boss,ov},B:{lv,boss,ov}}  A=被測方; params via aiPrmG({lv,sz:N,boss})
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const G=+process.argv[2],G0=+process.argv[3],ms=JSON.parse(fs.readFileSync(process.argv[4],'utf8')),out=process.argv[5],TEND=Date.now()+(+process.argv[6]||300)*60000;
const done=new Set();if(fs.existsSync(out))fs.readFileSync(out,'utf8').split('\n').filter(Boolean).forEach(l=>{const o=JSON.parse(l);done.add(o.id+'-'+o.g);});
const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
await p.route('**/script.google.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
await p.route(/google-analytics|googletagmanager/,r=>r.abort());

await p.addInitScript(()=>{localStorage.setItem('gk_lang','zh');localStorage.setItem('gk_news','x');});
await p.goto('file://'+__dirname+'/'+(ms[0].page||'page.html')+'?ai=1');await p.waitForTimeout(1500);
await p.evaluate(()=>window.__t.kgLoad());
for(let g=G0;g<G0+G;g++)for(const m of ms){ if(done.has(m.id+'-'+g))continue; if(Date.now()>TEND){console.log('時間到');await b.close();return;}
 const r=await p.evaluate(async([g,m])=>{const K=window.__t,S=K.S(),N=m.N;
  const mk=s=>{const P=K.aiPrmG({lv:s.lv,sz:s.psz||N,boss:!!s.boss});Object.assign(P,s.ov||{});Object.keys(P).forEach(k=>{if(k.length>1&&k.endsWith('x')&&typeof P[k.slice(0,-1)]==='number'){P[k.slice(0,-1)]*=P[k];delete P[k];}});return P;};
  const PA=mk(m.A),PB=mk(m.B);const aBlack=g%2===0;
  S.size=N;S.moves=[];S.cur=0;S.setup={};S.extra={};S.tryMoves=[];S.ha=0;S.km=null;let passes=0;const o=[];const seen=new Set();K.tsn(0);
  for(let t=0;t<(m.T||Math.round(N*N*1.25));t++){const A=await K.aiEval();const c=K.nextColor();const isA=(c===1)===aBlack;const sp=isA?m.A:m.B,P=sp.full?K.aiPrmG({lv:20,sz:19}):(isA?PA:PB);let q,fx=0,tk='',sy=0;K.eyeold(!!(sp.ov&&sp.ov.noeye));
   if(sp.ov&&sp.ov.fixr){const r=sp.ov.fixr,bb=K.build(),ord=[];for(let i=0;i<N*N;i++)ord.push(i);ord.sort((a,z)=>A.pol[z]-A.pol[a]);const ok=ord.filter(i=>!bb.grid[i]&&K.legal(bb,i%N,(i-i%N)/N));q=ok.length?ok[Math.min(r,ok.length)-1]:-1;}   // 2026-10-25 固定挑 AI 直覺第 r 名
   else if(sp.ov&&sp.ov.vpick){q=await K.aiPickV(A,P,passes>0);const f=K.fx();tk=f[1];sy=(f[2]===q)?1:0;}
   else if(sp.boss){K.fx0&&K.fx0();const rr=await K.aiPick2(A,P,passes>0);q=rr[0];fx=rr[1].fx;tk=rr[1].tk;sy=(!fx&&!tk&&K.fx()[2]===q)?1:0;}
   else{q=K.aiPick(A,P,passes>0);const f=K.fx();fx=f[0];tk=f[1];sy=(!fx&&!tk&&f[2]===q)?1:0;}
   if(P.calm && !fx && !tk){const qc=K.aiCalm(A,q,P);if(qc!==q){q=qc;tk='g';sy=1;}}
   {const T=(isA?sp:m.B).svT||(m.svT||0);if(T>0){const q1=await K.aiSaveFix(q,T);if(q1!==q){q=q1;fx=0;tk='sv';sy=0;}}}
   {const q2=K.aiEndFix(A,q);if(q2!==q){q=q2;fx=0;tk='';sy=0;}}
   if(!m.noko){const q3=await (m.one?K.aiOneFix(q):K.aiKoFix(q));if(q3!==q){q=q3;fx=0;tk='';sy=0;}}
   if(q>=0){const x=q%N;S.moves.push({x,y:(q-x)/N,c});S.cur=S.moves.length;const hk=Array.prototype.join.call(K.build().grid,'');S.moves.pop();S.cur=S.moves.length;if(seen.has(hk)){q=-1;fx=0;tk='';sy=0;}}   // 全局同形：會回到之前出現過的盤面就虛手
   if(q<0){S.moves.push({x:-1,y:-1,c});o.push(-1);passes++;S.cur=S.moves.length;if(passes>=2)break;}
   else{passes=0;K.tsn(c,tk==='t');const x=q%N;S.moves.push({x,y:(q-x)/N,c});o.push([x,(q-x)/N,fx,tk,sy]);S.cur=S.moves.length;seen.add(Array.prototype.join.call(K.build().grid,''));}}
  const A=await K.aiEval();const bw=A.lead>0;return {aw:bw===aBlack?1:0,aBlack,lead:Math.round(A.lead*10)/10,mv:o};},[g,m]);
 fs.appendFileSync(out,JSON.stringify({id:m.id,g,...r})+'\n');console.log(m.id,g,r.aw,r.mv.length);
}
await b.close();})();

// node sim/probe.js page lvs out.jsonl  — 19 路自己對自己，量每手時間（模擬網站 aiMove 流程，不含刻意等待）
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const page=process.argv[2],lvs=process.argv[3].split(',').map(Number),out=process.argv[4];
const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
await p.route('**/script.google.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
await p.route(/google-analytics|googletagmanager/,r=>r.abort());
await p.addInitScript(()=>{localStorage.setItem('gk_lang','zh');localStorage.setItem('gk_news','x');});
await p.goto('file://'+__dirname+'/'+page+'?ai=1');await p.waitForTimeout(1500);
await p.evaluate(()=>window.__t.kgLoad());
for(const lv of lvs){
 const r=await p.evaluate(async(lv)=>{const K=window.__t,S=K.S(),N=19;
  let nrun=0; const R=window.ort.InferenceSession.prototype.run; window.ort.InferenceSession.prototype.run=function(){nrun++;return R.apply(this,arguments);};
  S.size=N;S.moves=[];S.cur=0;S.setup={};S.extra={};S.tryMoves=[];S.ha=0;S.km=null;K.tsn(0);let passes=0;const T=[];
  const G={lv:lv,sz:19,boss:lv<=19};
  for(let t=0;t<450;t++){const n0=nrun,t0=performance.now();
   const A=await K.aiEval();const t1=performance.now();const P=K.aiPrmG(G);const c=K.nextColor();
   let q,fx=0,tk='';
   if(G.boss){const rr=await K.aiPick2(A,P,passes>0);q=rr[0];fx=rr[1].fx;tk=rr[1].tk;} else {q=K.aiPick(A,P,passes>0);const f=K.fx();fx=f[0];tk=f[1];}
   const t2=performance.now();
   if(P.calm&&!fx&&!tk){q=K.aiCalm(A,q,P);}
   q=K.aiEndFix(A,q); q=await K.aiOneFix(q,A,P); const t3=performance.now();
   T.push([S.moves.length,Math.round(t1-t0),Math.round(t2-t1),Math.round(t3-t2),nrun-n0]);
   if(q<0){S.moves.push({x:-1,y:-1,c});S.cur=S.moves.length;passes++;if(passes>=2)break;}
   else{passes=0;K.tsn(c,tk==='t');const x=q%N;S.moves.push({x,y:(q-x)/N,c});S.cur=S.moves.length;}}
  window.ort.InferenceSession.prototype.run=R; return T;},lv);
 fs.appendFileSync(out,JSON.stringify({lv,T:r})+'\n');console.log('lv',lv,r.length);
}
await b.close();})();

// node sim/tagsy.js in.json out.json  ：重播棋譜，算棋風那方每一手是不是「個性手」（棋風讓這手機會變 2 倍以上）
// in: [{n, lv, ov, sb(棋風是黑=0/白=1), mv:[[x,y]|null,...]}]
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const G=JSON.parse(fs.readFileSync(process.argv[2]));const out={};
const o=process.env.HTTPS_PROXY&&process.env.LOCAL?{proxy:{server:process.env.HTTPS_PROXY}}:{};
const b=await chromium.launch(o);const p=await (await b.newContext({ignoreHTTPSErrors:true})).newPage();
await p.route('**/script.google.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
await p.route(/google-analytics|googletagmanager/,r=>r.abort());
await p.addInitScript(()=>{localStorage.setItem('gk_lang','zh');localStorage.setItem('gk_news','x');});
await p.goto('file://'+__dirname+'/page.html?ai=1');await p.waitForTimeout(1500);await p.evaluate(()=>window.__t.kgLoad());
for(const g of G){ const r=await p.evaluate(async g=>{const K=window.__t,S=K.S(),N=19;
  const P=K.aiPrmG({lv:g.lv,sz:19,boss:true});Object.assign(P,g.ov||{});Object.keys(P).forEach(k=>{if(k.length>1&&k.endsWith('x')&&typeof P[k.slice(0,-1)]==='number'){P[k.slice(0,-1)]*=P[k];delete P[k];}});
  const k=Math.max(P.k,6),tmp=Math.max(P.tmp,P.btmp!=null?P.btmp:0.7);
  S.size=N;S.setup={};S.extra={};S.tryMoves=[];S.ha=0;S.km=null;S.moves=g.mv.map((m,i)=>m?{x:m[0],y:m[1],c:i%2?2:1}:{x:-1,y:-1,c:i%2?2:1});
  let t='';
  for(let i=0;i<Math.min(100,g.mv.length);i++){ if(i%2!==g.sb||!g.mv[i]){t+='.';continue;}
   S.cur=i;const A=await K.aiEval();const bd=K.build(),c=K.nextColor(),q=g.mv[i][1]*N+g.mv[i][0];
   K.setOwn(A.ownB||null);
   let mx=-1e9;for(let j=0;j<N*N;j++)if(A.pol[j]>mx)mx=A.pol[j];
   const ord=[...Array(N*N).keys()].sort((a,z)=>A.pol[z]-A.pol[a]);const cand=[];
   for(const j of ord){if(cand.length>=k)break;const x=j%N,y=(j-x)/N;if(bd.grid[j]||!K.legal(bd,x,y)||K.aiOwnEye(bd.grid,x,y,c))continue;cand.push(j);}
   const ix=cand.indexOf(q);if(ix<0){t+='.';continue;}
   const early=S.cur<N*N*K.aiEarly();const CT=(P.ct>0||P.ts>0)?K.aiOppLibs(bd,c):null;
   const edge=j=>{const x=j%N,y=(j-x)/N;return x===0||y===0||x===N-1||y===N-1;};
   const base=j=>{let f=1;if(CT&&CT[j]!=null){const lb=CT[j];f=1+(g.ct0!=null?g.ct0:P.ct)*(lb<=2?8:lb===3?4:2);}return Math.pow(Math.exp(A.pol[j]-mx),1/tmp)*f*(early&&edge(j)?0.05:1);};
   const ctf=j=>{if(!(CT&&CT[j]!=null))return 1;const lb=CT[j],m=(lb<=2?8:lb===3?4:2);return (1+P.ct*m)/(1+(g.ct0!=null?g.ct0:P.ct)*m);};const w0=cand.map(base),w=cand.map(j=>base(j)*ctf(j)*K.aiSty(j,P,bd,c,early));
   const s0=w0.reduce((a,v)=>a+v,0),s1=w.reduce((a,v)=>a+v,0);
   t+=((w[ix]/s1)/(w0[ix]/s0)>=2)?'y':'.';}
  return t;},g); out[g.n]=r; console.log(g.n,r.split('y').length-1);}
fs.writeFileSync(process.argv[3],JSON.stringify(out));await b.close();})();

/* 用線上的 AI 小棋盤（gostar.tw/p/kifu.html）跑整盤分析
   node ana.js game.json ana.json [b|w|both]
   game.json = exGame 的回傳（code 是分享碼）
   每一手（要分析的那一方）：AI 前 6 名候選＋實際下的那手，各算一次形勢 → 誰比較好、差幾目 */
let PW;try{PW=require('playwright');}catch(e){PW=require('/opt/npm-tools/node_modules/playwright');}const {chromium}=PW;const fs=require('fs');
const [,,GF,OUT,SIDE0]=process.argv;const g=JSON.parse(fs.readFileSync(GF,'utf8'));
const PAGE='https://www.gostar.tw/p/kifu.html';
(async()=>{
 const MK='/* ---------- toolbar ---------- */';
 let html0='';
 for(let i=0;i<4;i++){ /* Blogger 偶爾回不完整的頁面：重抓幾次 */
  try{html0=await (await fetch(PAGE+'?nc='+Date.now())).text();}catch(e){html0='';}
  if(html0.indexOf(MK)>=0)break; await new Promise(r=>setTimeout(r,8000));
 }
 if(html0.indexOf(MK)<0) throw new Error('線上頁面找不到插入點（抓了 4 次，長度 '+html0.length+'）');
 const html=html0.replace(MK,'window.__t={S:function(){return S},build:build,aiEval:aiEval,kgLoad:kgLoad,dec:dec};\n'+MK);
 const b=await chromium.launch();const p=await b.newPage();
 p.on('pageerror',e=>console.log('頁面錯誤',e.message));
 await p.route('**/script.google.com/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
 await p.route(/google-analytics|googletagmanager|doubleclick/,r=>r.abort());
 await p.route(u=>u.href.startsWith(PAGE),r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
 await p.addInitScript(()=>{try{localStorage.setItem('gk_lang','zh');localStorage.setItem('gk_news','x');}catch(e){}});
 await p.goto(PAGE+'?x=1',{waitUntil:'domcontentloaded',timeout:120000});
 await p.waitForFunction(()=>window.__t,null,{timeout:60000});
 const t0=Date.now();
 await p.evaluate(()=>window.__t.kgLoad());
 let side=SIDE0||'';
 if(!side){ if(g.ai) side=g.col==='白'?'w':'b'; else side='both'; }
 const res=await p.evaluate(async([code,side])=>{const K=window.__t,S=K.S();
  if(!K.dec(code)) throw new Error('分享碼解不開');
  const M=S.moves.slice(),N=S.size,setup=Object.assign({},S.setup);
  const set=n=>{S.moves=M.slice(0,n);S.cur=n;S.tryMoves=[];S.extra={};};
  const ev=async(n,q,c)=>{set(n);if(q!==undefined){S.moves.push({x:q<0?-1:q%N,y:q<0?-1:(q-q%N)/N,c:c});S.cur=n+1;}return await K.aiEval();};
  const R=[];
  for(let n=0;n<M.length;n++){
   const c=M[n].c; if(side==='b'&&c!==1||side==='w'&&c!==2) continue;
   if(M[n].x<0) continue;
   const A=await ev(n),bd=K.build();const sg=c===1?1:-1;
   const ord=[];for(let i=0;i<N*N;i++)ord.push(i);ord.sort((a,z)=>A.pol[z]-A.pol[a]);
   const cand=[];for(const q of ord){if(cand.length>=6)break;if(bd.grid[q])continue;cand.push(q);}
   const act=M[n].y*N+M[n].x;if(!cand.includes(act))cand.push(act);
   const vals={};for(const q of cand){const B=await ev(n,q,c);vals[q]=Math.round(sg*B.lead*10)/10;}
   let best=cand[0];for(const q of cand)if(vals[q]>vals[best])best=q;
   R.push({n,c,own:A.ownB?Array.from(A.ownB).map(v=>Math.round(v*100)/100):null,lead0:Math.round(A.lead*10)/10,act,best,va:vals[act],vb:vals[best],cand:vals});
  }
  set(M.length);const E=await K.aiEval();
  return {size:N,mv:M.map(m=>[m.x,m.y]),col:M.map(m=>m.c),setup,ha:S.ha||0,km:S.km,rows:R,end:Math.round(E.lead*10)/10};},[g.code,side]);
 res.side=side;res.game=Object.assign({},g,{code:undefined});res.sec=Math.round((Date.now()-t0)/1000);
 fs.writeFileSync(OUT,JSON.stringify(res));
 console.log('分析完成',res.rows.length,'手，用了',res.sec,'秒');
 await b.close();})().catch(e=>{console.error('失敗：',e.message);process.exit(1);});

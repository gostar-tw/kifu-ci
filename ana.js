/* 用線上的 AI 小棋盤（gostar.tw/p/kifu.html）跑整盤分析
   node ana.js game.json ana.json [b|w|both]
   game.json = exGame 的回傳（code 是分享碼）
   每一手（要分析的那一方）：AI 前 6 名候選＋實際下的那手，各算一次形勢 → 誰比較好、差幾目 */
let PW;try{PW=require('playwright');}catch(e){PW=require('/opt/npm-tools/node_modules/playwright');}const {chromium}=PW;const fs=require('fs');
const [,,GF,OUT,SIDE0]=process.argv;const g=JSON.parse(fs.readFileSync(GF,'utf8'));
const PAGE='https://www.gostar.tw/p/kifu.html';
(async()=>{
 const MK='/* ---------- toolbar ---------- */';
 /* Google 偶爾擋 GitHub 機器（回 3KB 的擋頁）：重抓幾次，還是不行就用上次成功存下的快取 */
 const CACHE=require('path').join(__dirname,'cache','kifu.html');
 let html0='';
 for(let i=0;i<3;i++){
  try{html0=await (await fetch((i%2?'https://www.gostar.tw/p/kifu-play.html':PAGE)+'?nc='+Date.now(),{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36','Accept-Language':'zh-TW,zh;q=0.9'}})).text();}catch(e){html0='';}
  if(html0.indexOf(MK)>=0)break; await new Promise(r=>setTimeout(r,5000));
 }
 if(html0.indexOf(MK)>=0){fs.mkdirSync(require('path').dirname(CACHE),{recursive:true});fs.writeFileSync(CACHE,html0);}
 else if(fs.existsSync(CACHE)){console.log('線上頁面抓不到（長度 '+html0.length+'），改用快取');html0=fs.readFileSync(CACHE,'utf8');}
 if(html0.indexOf(MK)<0) throw new Error('線上頁面找不到插入點，也沒有快取（長度 '+html0.length+'）：'+html0.replace(/\s+/g,' ').slice(0,160));
 /* 2026-10-20 形勢加勝率＋藍點：evw = aiEval 再多回傳黑勝率（value 頭，跟小棋盤一樣），不多花時間。
   藍點不另外算：分析那一方的每一手本來就有 AI 前 6 名候選各下一步的結果，取勝率最高的 3 個 */
const EVW=`function(){var N=S.size,pla=nextColor(),I=kgInput(),Enc=kgEncs[N]||(kgEncs[N]=KGEnc(N)),r=Enc.encode(I.setup,I.ev,komiNow(),pla);
 return kgExec(function(){return {input_binary:new window.ort.Tensor("float32",r.bin,[1,22,N,N]),input_global:new window.ort.Tensor("float32",r.glob,[1,19])};},"ai").then(function(out){
  var raw=out.output_ownership.data,ownB=new Float32Array(N*N),i;for(i=0;i<N*N;i++){var v=Math.tanh(raw[i]);ownB[i]=r.pla===1?v:-v;}
  var pd=out.output_policy.data,vv=out.output_value.data,e0=Math.exp(vv[0]),e1=Math.exp(vv[1]),pw=e0/(e0+e1);
  return {pol:Array.prototype.slice.call(pd,0,N*N),pass:pd[N*N],ownB:ownB,lead:(r.pla===1?1:-1)*out.output_miscvalue.data[0]*20,winB:r.pla===1?pw:1-pw};});}`;
const html=html0.replace(MK,'window.__t={S:function(){return S},build:build,aiEval:aiEval,kgLoad:kgLoad,dec:dec,evw:'+EVW+'};\n'+MK);
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
  const ev=async(n,q,c)=>{set(n);if(q!==undefined){S.moves.push({x:q<0?-1:q%N,y:q<0?-1:(q-q%N)/N,c:c});S.cur=n+1;}return await K.evw();};
  const R=[];
  for(let n=0;n<M.length;n++){
   const c=M[n].c; if(side==='b'&&c!==1||side==='w'&&c!==2) continue;
   if(M[n].x<0) continue;
   const A=await ev(n),bd=K.build();const sg=c===1?1:-1;
   const ord=[];for(let i=0;i<N*N;i++)ord.push(i);ord.sort((a,z)=>A.pol[z]-A.pol[a]);
   const cand=[];for(const q of ord){if(cand.length>=6)break;if(bd.grid[q])continue;cand.push(q);}
   const act=M[n].y*N+M[n].x;if(!cand.includes(act))cand.push(act);
   const vals={},wins={};for(const q of cand){const B=await ev(n,q,c);vals[q]=Math.round(sg*B.lead*10)/10;wins[q]=Math.round((c===1?B.winB:1-B.winB)*100);}
   let best=cand[0];for(const q of cand)if(vals[q]>vals[best])best=q;
   R.push({n,c,own:A.ownB?Array.from(A.ownB).map(v=>Math.round(v*100)/100):null,lead0:Math.round(A.lead*10)/10,act,best,va:vals[act],vb:vals[best],cand:vals,cw:wins});
  }
  /* 2026-10-20 每一手的形勢（講評網頁的「🔵 形勢」開關用）：own 每點一個字母 a~u = -1~+1（黑正），lead 黑領先幾目 */
  const OW=[],LD=[],WB=[],BD=[];
  const RN={};for(const r of R)RN[r.n]=r;
  for(let k=0;k<=M.length;k++){set(k);const E2=await K.evw();LD.push(Math.round(E2.lead*10)/10);WB.push(Math.round(E2.winB*100));
   const rw=RN[k];BD.push(rw?Object.keys(rw.cw).map(q=>[+q,rw.cw[q]]).sort((a,b)=>b[1]-a[1]).slice(0,3):[]);
   OW.push(E2.ownB?Array.from(E2.ownB).map(v=>String.fromCharCode(97+Math.max(0,Math.min(20,Math.round(v*10)+10)))).join(''):'');}
  set(M.length);const E=await K.aiEval();
  return {own:OW,leadAll:LD,winAll:WB,bdAll:BD,size:N,mv:M.map(m=>[m.x,m.y]),col:M.map(m=>m.c),setup,ha:S.ha||0,km:S.km,rows:R,end:Math.round(E.lead*10)/10};},[g.code,side]);
 res.side=side;res.game=Object.assign({},g,{code:undefined});res.sec=Math.round((Date.now()-t0)/1000);
 fs.writeFileSync(OUT,JSON.stringify(res));
 console.log('分析完成',res.rows.length,'手，用了',res.sec,'秒');
 await b.close();})().catch(e=>{console.error('失敗：',e.message);process.exit(1);});

# 2026-10-24 不下已定型的地方、不提已死的子、打架沒打完不亂跑（模擬版 page.html）
import sys
B = sys.argv[1]
s = open(B, encoding='utf-8').read()
def rep(old, new, cnt=1):
    global s
    assert s.count(old) == cnt, (old[:80], s.count(old))
    s = s.replace(old, new)

HELP = r'''/* 2026-10-24 已定型的點（19 路）：形勢判斷八成五以上確定是誰的、下了不提子、旁邊沒有兩口氣以下的棋（不管哪一方）
   -> 下進對方地裡送死、在自己地裡多補一手，看起來很假，所有 AI 都不下（全都是這種點時才照舊） */
function aiSetl(b,c,A){
  var N=S.size; if(N!==19 || !A || !A.ownB) return null;
  var g=b.grid, sg=(c===1?1:-1), lo=null, CK={};
  return function(q){ if(CK[q]!=null) return CK[q];
    var o=sg*A.ownB[q], r=false;
    if(gkAbs(o)>=0.85){ var rr=aiAfter(g,N,q,c);
      if(!rr) r=true;
      else if(!rr.cap){ if(!lo) lo=[aiOppLibs(b,c),aiOppLibs(b,3-c)]; r=!((lo[0][q]!=null && lo[0][q]<=2) || (lo[1][q]!=null && lo[1][q]<=2)); } }
    CK[q]=r; return r; };
}
'''
# 1. helper before aiPick
rep('function aiPick(A,P,humanPassed){\n', HELP + 'function aiPick(A,P,humanPassed){\n')
# aiPick candidates: skip settled points (fallback: no filter)
rep('''    var wide=[];
    for(i=0;i<order.length && (cand.length<P.k || wide.length<P.W);i++){
      var q=order[i], x=q%N, y=(q-x)/N;
      if(b.grid[q] || !legal(b,x,y)) continue;
      if(aiOwnEye(b.grid,x,y,c)) continue;
      if(cand.length<P.k) cand.push({q:q, p:ps[q]/tot});
      if(wide.length<P.W) wide.push(q);
    }''','''    var wide=[], SETF=aiSetl(b,c,A);
    for(var pass2=0;pass2<2 && !cand.length;pass2++){ wide=[];
    for(i=0;i<order.length && (cand.length<P.k || wide.length<P.W);i++){
      var q=order[i], x=q%N, y=(q-x)/N;
      if(b.grid[q] || !legal(b,x,y)) continue;
      if(aiOwnEye(b.grid,x,y,c)) continue;
      if(!pass2 && SETF && SETF(q)) continue;   /* 2026-10-24 不下已定型的點 */
      if(cand.length<P.k) cand.push({q:q, p:ps[q]/tot});
      if(wide.length<P.W) wide.push(q);
    } }''')
# 2. aiCapDead: dead at 0.6; but capture that rescues an own group in atari is never "dead"
rep('''    if(nl===1) ss.forEach(function(s2){ tot+=sg*A.ownB[s2]; n++; }); });
  return n>0 && tot/n>=0.8;''','''    if(nl===1){ ss.forEach(function(s2){ tot+=sg*A.ownB[s2]; n++; var sx=s2%N, sy=(s2-sx)/N; [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d3){ var a3=sx+d3[0], e3=sy+d3[1]; if(a3<0||e3<0||a3>=N||e3>=N) return; var w3=e3*N+a3; if(g[w3]===c && aiGrpL(g,N,w3).libs.length===1) rescue=true; }); }); } });
  return !rescue && n>0 && tot/n>=0.6;   /* 2026-10-24 0.8 -> 0.6；提了能救自己被叫吃的棋就不算 */''')
rep('''function aiCapDead(b,c,A,q){
  var N=S.size, g=b.grid, sg=(c===1?1:-1), x=q%N, y=(q-x)/N, tot=0, n=0, seen={};''','''function aiCapDead(b,c,A,q){
  var N=S.size, g=b.grid, sg=(c===1?1:-1), x=q%N, y=(q-x)/N, tot=0, n=0, seen={}, rescue=false;''')
# aiPick2a0 loc (放水局部)
rep('''    if(N===19){ var ra=aiAfter(b.grid,N,q,c); if(!ra || (!ra.cap && ra.libs<2)) continue; }   /* 2026-10-23 放水不下虎口 */''',
    '''    if(N===19){ var ra=aiAfter(b.grid,N,q,c); if(!ra || (!ra.cap && ra.libs<2)) continue; if(SETF0 && SETF0(q)) continue; }   /* 2026-10-23 放水不下虎口；10-24 不下已定型的點 */''')
rep('''  var b=build(), order=[], i;
  for(i=0;i<N*N;i++) order.push(i);
  order.sort(function(a,z){ return A.pol[z]-A.pol[a]; });
  var loc=[];''','''  var b=build(), order=[], i, SETF0=aiSetl(b,c,A);
  for(i=0;i<N*N;i++) order.push(i);
  order.sort(function(a,z){ return A.pol[z]-A.pol[a]; });
  var loc=[];''')
# aiStay ok()
rep('''  function ok(q){ var x=q%N, y=(q-x)/N; if(g[q] || !legal(b,x,y) || aiOwnEye(g,x,y,c)) return false; var rr=aiAfter(g,N,q,c); return rr && (rr.cap || rr.libs>=2); }
  function best(f)''','''  var SETS=aiSetl(b,c,A);
  function ok(q){ var x=q%N, y=(q-x)/N; if(g[q] || !legal(b,x,y) || aiOwnEye(g,x,y,c)) return false; if(SETS && SETS(q)) return false; var rr=aiAfter(g,N,q,c); return rr && (rr.cap || rr.libs>=2); }
  function best(f)''')
# aiCalm ok()
rep('''  function ok(z){ var x=z%N, y=(z-x)/N; if(g[z] || !legal(b,x,y) || aiOwnEye(g,x,y,c)) return false; var r=aiAfter(g,N,z,c); return r && r.libs>=2; }''',
    '''  var SETC=aiSetl(b,c,A);
  function ok(z){ var x=z%N, y=(z-x)/N; if(g[z] || !legal(b,x,y) || aiOwnEye(g,x,y,c)) return false; if(SETC && SETC(z)) return false; var r=aiAfter(g,N,z,c); return r && r.libs>=2; }''')
# aiPickV: candidates skip settled; 3. stay in the fight
rep('''  var C=[]; for(i=0;i<order.length && C.length<(P.vn||5);i++){ var q=order[i], x=q%N, y=(q-x)/N; if(g[q] || !legal(b,x,y) || aiOwnEye(g,x,y,c)) continue; C.push(q); }''',
    '''  var SETV=aiSetl(b,c,A);
  var C=[]; for(i=0;i<order.length && C.length<(P.vn||5);i++){ var q=order[i], x=q%N, y=(q-x)/N; if(g[q] || !legal(b,x,y) || aiOwnEye(g,x,y,c) || (SETV && SETV(q))) continue; C.push(q); }
  if(!C.length) for(i=0;i<order.length && C.length<(P.vn||5);i++){ var q1=order[i], x1=q1%N, y1=(q1-x1)/N; if(g[q1] || !legal(b,x1,y1) || aiOwnEye(g,x1,y1,c)) continue; C.push(q1); }
  /* 2026-10-24 打架沒打完不亂跑：對方上一手 3 路內有兩、三口氣的棋（哪一方都算）= 還在打。
     那裡 AI 直覺最高的一手也拿來算目數；挑到別處的手要比它多 1 目（P.vstay）才准，不然留下來打 */
  var lm0=null; for(i=S.cur-1;i>=0;i--){ if(S.moves[i].c!==c){ lm0=S.moves[i]; break; } }
  var FQ=-1;
  if(lm0 && lm0.x>=0 && P.vstay!==0){ var Lf1=aiOppLibs(b,c), Lf2=aiOppLibs(b,3-c), hot=false;
    for(i=0;i<N*N && !hot;i++){ var hx=i%N, hy=(i-hx)/N; if(Math.max(gkAbs(hx-lm0.x),gkAbs(hy-lm0.y))>3) continue; if((Lf1[i]!=null&&Lf1[i]<=3)||(Lf2[i]!=null&&Lf2[i]<=3)) hot=true; }
    if(hot) for(i=0;i<order.length;i++){ var fq=order[i], fx2=fq%N, fy2=(fq-fx2)/N; if(Math.max(gkAbs(fx2-lm0.x),gkAbs(fy2-lm0.y))>3) continue; if(g[fq] || !legal(b,fx2,fy2) || aiOwnEye(g,fx2,fy2,c) || (SETV && SETV(fq))) continue; var fr=aiAfter(g,N,fq,c); if(!fr || (!fr.cap && fr.libs<2)) continue; FQ=fq; break; }
    if(FQ>=0 && C.indexOf(FQ)<0) C.push(FQ); }
  function farQ(p){ if(FQ<0) return false; var px=p%N, py=(p-px)/N; return Math.max(gkAbs(px-lm0.x),gkAbs(py-lm0.y))>3; }''')
rep('''    for(i=0;i<ok.length;i++){ r-=W[i]; if(r<=0){ pick=ok[i]; break; } }
    if(pick!==best) AI_SYQ=pick;''','''    for(i=0;i<ok.length;i++){ r-=W[i]; if(r<=0){ pick=ok[i]; break; } }
    if(farQ(pick) && V[pick] < V[FQ]+(P.vstay!=null?P.vstay:1)){ pick=FQ; AI_TK="l"; }   /* 2026-10-24 打架沒打完不亂跑 */
    if(pick!==best && AI_TK!=="l") AI_SYQ=pick;''')
open(B, 'w', encoding='utf-8').write(s)
print('ok')

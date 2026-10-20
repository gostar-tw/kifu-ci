#!/usr/bin/env python3
"""把 ana.js 的分析結果做成解說網頁
   python3 build.py ana.json out.html [talk.json]
   talk.json（有講評才給）= {"seg":[[起手,迄手,"標題","內文 HTML"],...], "one":"一句話總結"}
   內文提到的座標用 <b class="gn">D4</b> 包起來，棋盤上會畫綠圈"""
import json, sys, os, html as H

A = json.load(open(sys.argv[1], encoding='utf-8'))
OUT = sys.argv[2]
TALK = json.load(open(sys.argv[3], encoding='utf-8')) if len(sys.argv) > 3 and os.path.exists(sys.argv[3]) else None
N = A['size']; C = "ABCDEFGHJKLMNOPQRST"
co = lambda q: C[q % N] + str(N - q // N)
g = A.get('game', {})

def nb(p):
    x, y = p % N, p // N; r = []
    if x > 0: r.append(p - 1)
    if x < N - 1: r.append(p + 1)
    if y > 0: r.append(p - N)
    if y < N - 1: r.append(p + N)
    return r

def grp(b, p):
    col = b[p]; st = [p]; seen = {p}; libs = set()
    while st:
        u = st.pop()
        for v in nb(u):
            if b[v] == 0: libs.add(v)
            elif b[v] == col and v not in seen: seen.add(v); st.append(v)
    return seen, len(libs)

def boards():
    b = [0] * (N * N)
    for k, c in (A.get('setup') or {}).items():
        x, y = map(int, k.split(',')); b[y * N + x] = c
    out = [b[:]]
    for i, m in enumerate(A['mv']):
        c = A['col'][i]
        if m[0] >= 0:
            q = m[1] * N + m[0]; b[q] = c
            for v in nb(q):
                if b[v] == 3 - c:
                    s, l = grp(b, v)
                    if l == 0:
                        for p in s: b[p] = 0
        out.append(b[:])
    return out

def near(q, d):
    x, y = q % N, q // N; r = []
    for dy in range(-d, d + 1):
        for dx in range(-d, d + 1):
            u, v = x + dx, y + dy
            if 0 <= u < N and 0 <= v < N and (dx or dy): r.append(v * N + u)
    return r
def isopen(b, q): return all(b[p] == 0 for p in near(q, 2))
def settled(q, own):
    if not own: return False
    ps = near(q, 1) + [q]
    return sum(abs(own[p]) for p in ps) / len(ps) >= 0.8
def region(q):
    x, y = q % N, q // N; t = N / 3
    h = '左' if x < t else ('右' if x >= N - t else '')
    v = '上' if y < t else ('下' if y >= N - t else '')
    if h and v: return h + v + '角'
    if v: return v + '邊'
    if h: return h + '邊'
    return '中央'
def dist(a, b): return max(abs(a % N - b % N), abs(a // N - b // N))

B = boards()
items = []
for r in A['rows']:
    n = r['n']; b = B[n]; own = r.get('own'); a = r['act']; be = r['best']; me = r['c']; op = 3 - me
    loss = max(0, r['vb'] - r['va'])
    if a == be or loss < 1.5: k = 'good'; t = None
    elif loss < 3: k = 'mid'; t = None
    else:
        k = 'bad'
        adj = [p for p in nb(be) if b[p]]
        myl = min([grp(b, p)[1] for p in adj if b[p] == me] or [9])
        opl = min([grp(b, p)[1] for p in adj if b[p] == op] or [9])
        ps = near(be, 1) + [be]
        ob = sum(abs(own[p]) for p in ps) / len(ps) if own else 1
        if myl <= 2 and dist(a, be) > 1: t = '救棋'
        elif opl <= 2 and dist(a, be) > 1: t = '吃棋'
        elif ob < 0.4 and any(b[p] for p in near(be, 2)) and dist(a, be) > 2: t = '急場'
        elif settled(a, own): t = '小地方'
        elif isopen(b, be) and not isopen(b, a): t = '大場'
        elif isopen(b, be) and isopen(b, a): t = '方向'
        else: t = '局部'
    items.append({'n': n + 1, 'k': k, 't': t, 'b': be, 'a': a, 'l': round(loss, 1), 'c': me})

L = len(A['mv']); f = N * N / 361
PH = [('序盤（佈局）', 0, round(50 * f)), ('中盤（戰鬥）', round(50 * f), round(150 * f)), ('官子', round(150 * f), 99999)]
phases = []
for name, s, e in PH:
    it = [x for x in items if s < x['n'] <= e]
    if s >= L or not it: phases.append({'name': name, 'none': True}); continue
    types = {}
    for x in sorted(it, key=lambda x: -x['l']):
        if x['t']: types.setdefault(x['t'], []).append({'n': x['n'], 'b': x['b']})
    phases.append({'name': name, 'from': s + 1, 'to': min(e, L), 'types': types})

# 形勢變化：分析那一方的觀點（雙方都分析就用黑棋）
side = A.get('side', 'b'); sg = -1 if side == 'w' else 1
pts = [r for r in A['rows']]
trend = []
for mark in [round(x * f) for x in (50, 100, 150, 200, 250)] :
    if mark >= L: break
    r = min(pts, key=lambda r: abs(r['n'] - mark)) if pts else None
    if r: trend.append([r['n'] + 1, round(sg * r['lead0'], 1)])
trend.append([L, round(sg * A['end'], 1)])

def nm(c):
    if c == 1: return g.get('pb') or '黑棋'
    return g.get('pw') or '白棋'
pb, pw = nm(1), nm(2)
if g.get('ai'):
    lv = g.get('lv', '')
    if g.get('col') == '白': pb = 'AI 強度 %s' % lv
    else: pw = 'AI 強度 %s' % lv
me = pb if side == 'b' else pw if side == 'w' else '雙方'
D = {'g': {'size': N, 'mv': A['mv'], 'col': A['col'], 'setup': A.get('setup') or {}, 'pb': pb, 'pw': pw,
           'dt': g.get('dt', ''), 're': g.get('re', '') or (('小朋友' + g['win']) if g.get('win') else '')},
     'items': items, 'phases': phases, 'own': A.get('own') or [], 'lead': A.get('leadAll') or [], 'win': A.get('winAll') or [], 'bd': A.get('bdAll') or [], 'trend': trend, 'side': side, 'talk': TALK, 'gid': g.get('g', '')}
title = ('對局講評' if TALK else 'AI 分析') + '｜' + pb + ' vs ' + pw
tpl = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tpl.html'), encoding='utf-8').read()
data = json.dumps(D, ensure_ascii=False).replace('</', '<\\/')
out = tpl.replace('__TITLE__', H.escape(title)).replace('__ME__', H.escape(me)).replace('__DATA__', data)
open(OUT, 'w', encoding='utf-8').write(out)
bad = [x for x in items if x['k'] == 'bad']
print('網頁完成（%d 手分析，吃虧手 %d 手）' % (len(items), len(bad)))

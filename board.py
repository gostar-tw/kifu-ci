#!/usr/bin/env python3
"""驗證盤面用（寫講評前，戰術判斷一定要先在這裡確認）
  python3 board.py ana.json 124                 第 124 手下完的盤面
  python3 board.py ana.json 124 --grp M15        M15 那塊棋：有幾顆、氣在哪裡
  python3 board.py ana.json 124 --try L15 K15    接著下 L15、K15（輪流，從該下的那方開始），印出盤面和提子
  python3 board.py ana.json 124 --try W:L15 B:K15   也可以指定顏色
X=黑 O=白，後面有 < 的是最後一手"""
import json, sys
A = json.load(open(sys.argv[1], encoding='utf-8')); N = A['size']; C = "ABCDEFGHJKLMNOPQRST"
n = int(sys.argv[2]); args = sys.argv[3:]
def q2c(q): return C[q % N] + str(N - q // N)
def c2q(s): s = s.strip().upper(); return (N - int(s[1:])) * N + C.index(s[0])
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
    return seen, libs
def play(b, q, c):
    if b[q]: raise SystemExit('%s 已經有子' % q2c(q))
    b[q] = c; cap = []
    for v in nb(q):
        if b[v] == 3 - c:
            s, l = grp(b, v)
            if not l:
                for p in s: b[p] = 0; cap.append(p)
    s, l = grp(b, q)
    if not l: print('⚠ %s 是自殺手' % q2c(q))
    return cap
b = [0] * (N * N)
for k, c in (A.get('setup') or {}).items():
    x, y = map(int, k.split(',')); b[y * N + x] = c
last = None
for i in range(min(n, len(A['mv']))):
    m = A['mv'][i]
    if m[0] >= 0: last = m[1] * N + m[0]; play(b, last, A['col'][i])
nxt = (3 - A['col'][n - 1]) if n > 0 else (A['col'][0] if A['col'] else 1)
def show():
    print('    ' + ' '.join(C[:N]))
    for y in range(N):
        row = ''
        for x in range(N):
            q = y * N + x; ch = '.XO'[b[q]]
            row += ch + ('<' if q == last else ' ')
        print('%3d %s' % (N - y, row.rstrip()))
    print('    ' + ' '.join(C[:N]))
if '--grp' in args:
    for s in args[args.index('--grp') + 1:]:
        if s.startswith('--'): break
        q = c2q(s)
        if not b[q]: print(s, '是空點'); continue
        g, l = grp(b, q)
        print('%s：%s %d 顆 [%s]，氣 %d 口 [%s]' % (s, '黑' if b[q] == 1 else '白', len(g), ' '.join(sorted(map(q2c, g))), len(l), ' '.join(sorted(map(q2c, l)))))
elif '--try' in args:
    c = nxt
    for s in args[args.index('--try') + 1:]:
        if ':' in s: c = 1 if s[0].upper() == 'B' else 2; s = s.split(':')[1]
        q = c2q(s); cap = play(b, q, c); last = q
        print('%s %s%s' % ('黑' if c == 1 else '白', s.upper(), ('，提掉 ' + ' '.join(map(q2c, cap))) if cap else ''))
        c = 3 - c
    show()
else:
    print('第 %d 手下完，輪到%s' % (n, '黑' if nxt == 1 else '白'))
    show()

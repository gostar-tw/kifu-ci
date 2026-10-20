/* 智多星 AI 小棋盤：GitHub Actions 每小時跑的主程式
   node ci.js [分鐘=40]   （後台網址、工作鑰匙從環境變數 KIFU_URL、KIFU_KEY 拿）
   1. 收講評：Drive「已完成」裡 Claude 寫好的 talk.json → 做成講評網頁 → 交回後台
   2. 派講評：有人勾「要講評」（含老師回饋）的 → 準備 brief → 經後台放進 Drive「待講評」
   3. 自動分析：一盤一盤拿、跑 ana.js / build.py、交回，跑到時間到為止（剩下的下一輪）
   4. 再派一次講評（剛分析完、有人勾的） */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const URL = process.env.KIFU_URL, KEY = process.env.KIFU_KEY, MIN = +(process.argv[2] || 40);
if (!URL || !KEY) { console.error('少了 KIFU_URL 或 KIFU_KEY（GitHub → Settings → Secrets）'); process.exit(1); }
const T_END = Date.now() + MIN * 60000, DIR = __dirname, W = path.join(DIR, 'work');
fs.mkdirSync(W, { recursive: true });

async function api(b) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(Object.assign({ key: KEY }, b)) });
      const j = JSON.parse(await r.text());
      if (!j.ok) throw new Error(j.err || '後台回錯');
      return j;
    } catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 3000)); }
  }
}
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: DIR, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 40 * 60000 });

async function analyze(job, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const gf = path.join(dir, 'game.json'), af = path.join(dir, 'ana.json'), hf = path.join(dir, 'page.html');
  fs.writeFileSync(gf, JSON.stringify(job.game));
  console.log(sh('node', ['ana.js', gf, af]).trim());
  console.log(sh('python3', ['build.py', af, hf]).trim());
  return { af, hf };
}
/* 失敗馬上重試（最多 3 次，中間等 20 秒），真的不行才回報失敗 */
async function analyzeRetry(job, dir) {
  for (let i = 1; ; i++) {
    try { return await analyze(job, dir); }
    catch (e) { if (i >= 3) throw e; console.log('… 第 ' + i + ' 次失敗，20 秒後重試：' + String(e.message).split('\n').pop()); await new Promise(r => setTimeout(r, 20000)); }
  }
}

const C = 'ABCDEFGHJKLMNOPQRST';
function brief(job, A, rules, talk) {
  const N = A.size, co = q => C[q % N] + (N - Math.floor(q / N));
  const rows = A.rows.map(r => {
    const l = Math.max(0, r.vb - r.va); const k = (r.act === r.best || l < 1.5) ? '好' : (l < 3 ? '普通' : '吃虧');
    return '第 ' + (r.n + 1) + ' 手 ' + (r.c === 1 ? '黑' : '白') + ' ' + co(r.act) + '｜' + k + (k === '好' ? '' : '｜AI 最好 ' + co(r.best) + ' 約差 ' + l.toFixed(1) + ' 目') +
      '｜下之前形勢（黑方）' + r.lead0 + '｜候選：' + Object.entries(r.cand).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([q, v]) => co(+q) + ' ' + v).join('、');
  });
  let s = '# ' + job.g + '｜' + job.ttl + '\n\n';
  s += '- 種類：' + (job.kind === 'fb' ? '老師回饋，請修改講評' : '新的講評') + '（勾選：' + job.who + '）\n';
  s += '- 對局：' + JSON.stringify(Object.assign({}, job.game, { code: undefined })) + '\n';
  s += '- 分析的一方：' + A.side + '（b=黑 w=白），終局 AI 估計黑方 ' + A.end + ' 目\n\n';
  s += '## 解說原則（一定要照做，跟 README 衝突時以這裡為準）\n' + rules.map((x, i) => (i + 1) + '. ' + x).join('\n') + '\n\n';
  if (job.fb && job.fb.length) s += '## 討論紀錄（Claude＝你之前寫的）\n' + job.fb.map(m => '- ' + (m.c ? 'Claude' : m.w) + '：' + m.x).join('\n') + '\n\n';
  if (talk) s += '## 目前的講評（talk.json，改這份）\n' + JSON.stringify(talk) + '\n\n';
  s += '## 每一手（分析的那一方）\n' + rows.join('\n') + '\n\n';
  /* board.py 只需要這幾樣，整份 ana.json 太大不放 */
  s += '## 盤面資料（存成 ana.json 給 board.py 用）\n' + JSON.stringify({ size: A.size, mv: A.mv, col: A.col, setup: A.setup || {} }) + '\n';
  return s;
}

/* 1. 收講評 */
async function collect() {
  const d = await api({ action: 'exDrvDone' });
  let n = 0;
  for (const it of d.items || []) {
    const dir = path.join(W, 'done', it.g); fs.mkdirSync(dir, { recursive: true });
    try {
      let T; try { T = JSON.parse(it.talk); } catch (e) { throw new Error('talk.json 不是正確的 JSON：' + e.message); }
      if (!Array.isArray(T.seg) || !T.seg.length) throw new Error(T.reply ? 'Claude 寫不出來：' + T.reply : 'talk.json 沒有 seg');
      T.seg.forEach(s => { if (!(Array.isArray(s) && s.length >= 4 && s.length <= 6 && s[0] >= 1 && s[1] >= s[0] && (s[4] == null || (Number.isInteger(s[4]) && s[4] >= 0)) && (s[5] == null || (Array.isArray(s[5]) && s[5].length <= 10 && s[5].every(x => /^[A-HJ-T](1[0-9]|[1-9])$/.test(x)))))) throw new Error('seg 格式不對：' + JSON.stringify(s)); });   // v4：[起,迄,標題,內文,跳到第幾手?,參考圖手順?]
      const g = await api({ action: 'exGet', g: it.g });
      if (!g.ana) throw new Error('後台找不到分析檔');
      const af = path.join(dir, 'ana.json'), hf = path.join(dir, 'page.html'), tf = path.join(dir, 'page-talk.json');
      fs.writeFileSync(af, g.ana); fs.writeFileSync(tf, JSON.stringify({ seg: T.seg, one: T.one || '' }));
      console.log(sh('python3', ['build.py', af, hf, tf]).trim());
      const r = await api({ action: 'exPut', kind: 'talk', g: it.g, html: fs.readFileSync(hf, 'utf8'), reply: T.reply || '', suggest: T.suggest || [], sum: T.sum || '' });
      console.log('✓ 講評交回 1 盤'); n++;
    } catch (e) {
      console.log('✗ 講評交回失敗', e.message);
      await api({ action: 'exFail', kind: 'talk', g: it.g, msg: String(e.message).slice(0, 300) }).catch(() => {});
    }
    await api({ action: 'exDrvAck', g: it.g, st: it.st }).catch(e => console.log('收尾失敗', e.message));
  }
  return n;
}

/* 2. 派講評 */
async function dispatch() {
  const t = await api({ action: 'exPull', kind: 'talk', n: 10 });
  let n = 0;
  for (const job of t.jobs) {
    const dir = path.join(W, 'talk', job.g); fs.mkdirSync(dir, { recursive: true });
    try {
      const g = await api({ action: 'exGet', g: job.g, html: 1 }); let A;
      if (g.ana) {
        A = JSON.parse(g.ana);
        /* 2026-10-20 舊的分析沒有每一手的形勢：重寫講評時順便重新分析一次，網頁才有「🔵 形勢」（講評文字照舊） */
        /* 2026-10-20 晚：沒有勝率／藍點（winAll）的舊分析也一樣，勾「重寫」就順便重新分析 */
        if ((!A.own || !A.winAll) && job.game) {
          try {
            const r = await analyzeRetry(job, dir); A = JSON.parse(fs.readFileSync(r.af, 'utf8'));
            if (g.html && g.html.length > 200) await api({ action: 'exPut', kind: 'ana', g: job.g, html: g.html, ana: fs.readFileSync(r.af, 'utf8') });
            console.log('… 舊分析重新分析（補形勢／勝率／藍點）');
          } catch (e) { console.log('… 補形勢失敗，照舊分析寫：' + String(e.message).split('\n').pop()); A = JSON.parse(g.ana); }
        }
      }
      else { if (!job.game) throw new Error('找不到棋譜'); const r = await analyzeRetry(job, dir); A = JSON.parse(fs.readFileSync(r.af, 'utf8')); }
      let talk = null; const m = /<script id="exdata" type="application\/json">([\s\S]*?)<\/script>/.exec(g.html || '');
      if (m) { const d = JSON.parse(m[1].replace(/<\\\//g, '</')); if (d.talk) talk = d.talk; }
      const r = await api({ action: 'exDrvPut', g: job.g, kind: job.kind, doc: brief(job, A, t.rules || [], talk) });
      console.log('→ 待講評', job.kind === 'fb' ? '回饋' : '新的'); n++;
    } catch (e) {
      console.log('✗ 講評準備失敗', e.message);
      await api({ action: 'exFail', kind: 'talk', g: job.g, msg: String(e.message).slice(0, 300) }).catch(() => {});
    }
  }
  return n;
}

(async () => {
  const kit = await api({ action: 'exKit' });
  if (kit.files && kit.files['tpl.html']) fs.writeFileSync(path.join(DIR, 'tpl.html'), kit.files['tpl.html']);
  else throw new Error('後台沒給網頁樣板 tpl.html');
  const got = await collect();
  let sent = await dispatch();
  let done = 0, fail = 0;
  while (Date.now() < T_END) {
    const p = await api({ action: 'exPull', kind: 'ana', n: 1 }); if (!p.jobs.length) break;
    const job = p.jobs[0], dir = path.join(W, job.g);
    try {
      if (!job.game) throw new Error('找不到棋譜');
      const { af, hf } = await analyzeRetry(job, dir);
      await api({ action: 'exPut', kind: 'ana', g: job.g, html: fs.readFileSync(hf, 'utf8'), ana: fs.readFileSync(af, 'utf8') }); done++;
    } catch (e) {
      fail++; console.log('✗', e.message);
      try { await api({ action: 'exFail', kind: 'ana', g: job.g, msg: String(e.message).slice(0, 300) }); } catch (e2) {}
    }
  }
  sent += await dispatch();
  const msg = '收回講評 ' + got + ' 盤｜自動分析完成 ' + done + ' 盤、失敗 ' + fail + ' 盤｜送進待講評 ' + sent + ' 盤';
  console.log('\n=== ' + msg + ' ===');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### ' + msg + '\n');
})().catch(e => { console.error('失敗：', e.message); process.exit(1); });

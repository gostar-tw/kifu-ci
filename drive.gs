/* ==============================================================
   講評走 Google Drive（drive.gs）v1.0 —— 跟 explain.gs 放在同一個專案
   - GitHub Actions 每小時：exDrvPut 把要寫的講評放進「待講評」（Google 文件，一盤一份）
                           exDrvDone 拿「已完成」裡寫好的 talk.json；做成網頁交回後，exDrvAck 收尾
   - Claude 定時任務只碰 Drive：讀「待講評」→ 在「已完成」寫「同檔名.talk.json」
   ============================================================== */
var EXD_TODO = '1sF9epCVec1Qr9j8Wd187worNqm7J2Qlm';   // 待講評
var EXD_DONE = '12N3srOv5AVlWfyHP4jybcNvxo2qsqJ36';   // 已完成
var EX_STALE_TALK_H = 24;   // 講評在 Drive 等超過幾小時沒寫，就重新排隊（重新放一份進待講評）

/* exPost_ 先問這裡；不是 Drive 的動作就回 null */
function exDrv_(b) {
  if (b.action === 'exDrvPut') return exDrvPut_(b);
  if (b.action === 'exDrvDone') return exDrvDone_(b);
  if (b.action === 'exDrvAck') return exDrvAck_(b);
  return null;
}
/* 檔名：講評_短碼_時間戳（13 位數）；Claude 寫的是 講評_短碼_時間戳.talk.json */
function exdName_(g, st) { return '講評_' + g + '_' + st; }
function exdParse_(name) {
  var m = /^講評_(.+)_(\d{13})(\.talk\.json|\.md)?$/.exec(String(name));
  return m ? { g: m[1], st: m[2], talk: m[3] === '.talk.json' } : null;
}
function exdFiles_(fid) {
  var it = DriveApp.getFolderById(fid).getFiles(), r = [];
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) r.push(f); }
  return r;
}
function exdTrash_(f) { try { f.setTrashed(true); return true; } catch (e) { return false; } }

/* 建 Google 文件（Claude 那邊的 Drive 工具讀得到文字）；進階 Drive 服務不能用時退回純文字檔 */
function exdDoc_(name, text) {
  var blob = Utilities.newBlob(text, 'text/plain', name);
  try {
    if (Drive.Files.create) return Drive.Files.create({ name: name, mimeType: MimeType.GOOGLE_DOCS, parents: [EXD_TODO] }, blob).id;
    return Drive.Files.insert({ title: name, mimeType: MimeType.GOOGLE_DOCS, parents: [{ id: EXD_TODO }] }, blob, { convert: true }).id;
  } catch (e) {
    return DriveApp.getFolderById(EXD_TODO).createFile(name + '.md', text, MimeType.PLAIN_TEXT).getId();
  }
}

/* {g, kind, doc} → 放一份進「待講評」（同一盤舊的先收掉） */
function exDrvPut_(b) {
  var j = exFind_(b.g); if (!j) return out_({ ok: false, err: 'not found' });
  var doc = String(b.doc || ''); if (doc.length < 50) return out_({ ok: false, err: 'bad doc' });
  exdFiles_(EXD_TODO).forEach(function (f) { var p = exdParse_(f.getName()); if (p && p.g === j.g) exdTrash_(f); });
  var st = String(Date.now()), name = exdName_(j.g, st);
  exdDoc_(name, doc);
  exProps_().setProperty('EXD_' + j.g, st);
  return out_({ ok: true, st: st, name: name });
}

/* 「已完成」裡、對得上目前這一份的 talk.json */
function exDrvDone_(b) {
  var p = exProps_(), items = [];
  exdFiles_(EXD_DONE).forEach(function (f) {
    var q = exdParse_(f.getName()); if (!q || !q.talk) return;
    var j = exFind_(q.g), cur = p.getProperty('EXD_' + q.g);
    if (!j || cur !== q.st || !(j.t === 'r' || j.fp === 'R')) { exdTrash_(f); return; }   // 過期的，收掉
    if (items.length >= 20) return;
    var s = ''; try { s = f.getBlob().getDataAsString('UTF-8'); } catch (e) {}
    items.push({ g: q.g, st: q.st, talk: s.slice(0, 200000) });
  });
  return out_({ ok: true, items: items });
}

/* {g, st}：交回了（或失敗了），兩邊的檔案收掉 */
function exDrvAck_(b) {
  var g = String(b.g || ''), st = String(b.st || '');
  [EXD_TODO, EXD_DONE].forEach(function (fid) {
    exdFiles_(fid).forEach(function (f) { var q = exdParse_(f.getName()); if (q && q.g === g && q.st === st) exdTrash_(f); });
  });
  var p = exProps_(); if (p.getProperty('EXD_' + g) === st) p.deleteProperty('EXD_' + g);
  return out_({ ok: true });
}

/* 編輯器裡選 exDrvTest 按「執行」：確認讀寫得到兩個資料夾 */
function exDrvTest() {
  Logger.log('待講評：' + DriveApp.getFolderById(EXD_TODO).getName() + '，' + exdFiles_(EXD_TODO).length + ' 個檔案');
  Logger.log('已完成：' + DriveApp.getFolderById(EXD_DONE).getName() + '，' + exdFiles_(EXD_DONE).length + ' 個檔案');
  Logger.log('進階 Drive 服務：' + (typeof Drive !== 'undefined' ? (Drive.Files.create ? 'v3' : 'v2') : '沒有'));
}

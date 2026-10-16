# kifu-ci — 智多星 AI 小棋盤自動分析

GitHub Actions 每小時（第 17 分）跑 `ci.js`：

1. 收講評：Drive「已完成」裡 Claude 寫好的 `講評_短碼_時間.talk.json` → `build.py` 做成講評網頁 → 交回 Apps Script 後台
2. 派講評：老師勾「要講評」（含回饋）的 → 準備 brief（含盤面資料）→ 後台放進 Drive「待講評」（Google 文件）
3. 自動分析：`ana.js`（用線上 gostar.tw/p/kifu.html 的 KataGo）＋ `build.py`，一盤一盤交回，最多 40 分鐘

Claude 定時任務「棋譜分析」只碰 Drive：讀「待講評」→ 寫「已完成」。

## 需要的 Secrets（Settings → Secrets and variables → Actions）
- `KIFU_URL`：後台網址（…/exec）
- `KIFU_KEY`：工作鑰匙

手動跑：Actions → 棋譜自動分析 → Run workflow。

`drive.gs` 是 Apps Script 後台那邊的副本（正本在 Apps Script 專案）。

// Smoke test cho Tròn Party: cho máy (bot) chơi hết mọi game tới khi kết thúc, báo game nào lỗi / không kết thúc.
// Cách chạy (cần Node.js):
//   npm i -D playwright && npx playwright install chromium     (chỉ cần lần đầu)
//   node tools/smoke-test.js                 → test tất cả game
//   node tools/smoke-test.js sumo bomb       → chỉ test vài game theo id
//   node tools/smoke-test.js --shots         → kèm chụp ảnh giữa trận vào tools/shots/
//   node tools/smoke-test.js --len=short     → độ dài ván: short | normal (mặc định) | long
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const SHOTS = args.includes('--shots');
const ONLY = args.filter((a) => !a.startsWith('--'));
const LEN = (args.find((a) => a.startsWith('--len=')) || '--len=normal').slice(6);
const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_')) errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(1500);

  const report = await page.evaluate(([only, len]) => {
    App.lenLevel = len;
    const out = [];
    const games = Party.games.filter((g) => !only.length || only.includes(g.id));
    for (const level of ['easy', 'hard']) {
      for (const n of [2, 4]) {
        App.botLevel = level;
        App.slots = [0, 1, 2, 3].map((i) => (i < n ? App.makePlayer(i, null, true) : null));
        App.players = App.slots.filter(Boolean);
        for (const def of games) {
          if (n < (def.minPlayers || 2) || n > (def.maxPlayers || 4)) continue;
          for (const mode of (def.modes ? def.modes.map((m) => m.id) : [null])) {
          if (mode) App.gameMode[def.id] = mode;
          const t0 = performance.now();
          let err = null, steps = 0, posOk = 0, posNull = 0;
          try {
            App.startGame(def); App.hideAll(); App.state = 'play';
            while (!App.inst.finished && steps < 60 * 240) {
              App.inst.update(1 / 60, App.gatherInputs());
              App.api.parts.update(1 / 60);
              if (steps % 120 === 0) {
                App.inst.draw(App.ctx);
                // App.posOf phải trả toạ độ hợp lệ (hoặc null khi nhân vật đang ẩn/rơi)
                App.players.forEach((_, i) => {
                  const q = App.posOf(i);
                  if (q && !(Number.isFinite(q.x) && Number.isFinite(q.y) && q.x > -200 && q.x < W + 200 && q.y > -200 && q.y < H + 200)) throw new Error(`posOf(${i}) sai: ${JSON.stringify(q)}`);
                  if (q) posOk++; else posNull++;
                });
              }
              steps++;
            }
            App.inst.results();
          } catch (e) { err = e.message; }
          out.push({ id: def.id + (mode ? ':' + mode : ''), level, n, finished: !err && App.inst && App.inst.finished, sec: Math.round(steps / 60),
            ms: Math.round(performance.now() - t0), err, posOk, posNull, res: err ? null : App.inst.results().map((r) => r.text) });
          }
        }
      }
    }
    return out;
  }, [ONLY, LEN]);

  let bad = 0;
  for (const r of report) {
    const ok = r.finished && !r.err;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${r.id.padEnd(16)} ${r.level.padEnd(5)} ${r.n}p  ${String(r.sec).padStart(3)}s chơi  ${r.err ? 'LỖI: ' + r.err : r.finished ? r.res.join(' | ') : 'KHÔNG KẾT THÚC'}${!r.err && r.posOk === 0 ? '  ⚠ posOf luôn null' : ''}`);
  }

  if (SHOTS) {
    const dir = path.join(__dirname, 'shots');
    fs.mkdirSync(dir, { recursive: true });
    const ids = await page.evaluate((only) => Party.games.filter((g) => !only.length || only.includes(g.id)).map((g) => g.id), ONLY);
    await page.evaluate(() => { App.botLevel = 'normal'; App.slots = [0, 1, 2, 3].map((i) => App.makePlayer(i, null, true)); App.players = App.slots.slice(); App.openMenu(); });
    for (const id of ids) {
      await page.evaluate((id) => App.action('pick', { dataset: { id } }), id);
      await page.waitForTimeout(200);
      await page.evaluate(() => App.beginCountdown());
      await page.waitForTimeout(3000 + 5000);
      await page.screenshot({ path: path.join(dir, `${id}.png`) });
      await page.evaluate(() => App.action('menu'));
    }
    console.log(`Ảnh chụp: ${dir}`);
  }

  console.log(`\n[độ dài ván: ${LEN}] ${report.length - bad}/${report.length} lượt OK · lỗi trang: ${errors.length ? '\n  ' + errors.join('\n  ') : 'không có'}`);
  await browser.close();
  process.exit(bad || errors.length ? 1 : 0);
})();

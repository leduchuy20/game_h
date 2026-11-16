// Chụp ảnh thẻ game (thumbnail) cho menu: cho máy chơi thật một lúc rồi chụp khung hình → assets/thumbs/<id>.webp
// Cách chạy (cần Node.js + Playwright, Python 3 + Pillow để thu nhỏ ảnh):
//   node tools/make-thumbs.js            → chụp lại tất cả game
//   node tools/make-thumbs.js sumo race  → chỉ vài game
// Mỗi game: 4 máy Trung bình (hoặc số người tối đa của game), chế độ mặc định, tua nhanh SEC giây rồi chụp.
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'thumbs');
const TMP = path.join(require('os').tmpdir(), 'tronparty-thumbs');
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--'));
// số giây tua trước khi chụp (mặc định 9) — chỉnh riêng game nào lúc đầu ván chưa có gì để xem
const SEC = { default: 9, typing: 30, catdog: 60, jigsaw: 90, g2048: 40, monopoly: 40, ludo: 30, chess: 5, xiangqi: 25, caro: 30, race: 14, stack: 7, sketch: 12, tron: 6, count: 4, crown: 16, boss: 20, shmup: 20 };
// số người riêng (game cờ đẹp nhất khi đủ người)
const SEATS = {};
// dừng tua sớm khi đủ đẹp (biểu thức chạy trong trang, `g` = instance game)
const STOP = { g2048: 'g.top >= 8 && g.moves >= 150 && g.phase === "play" && (!g.anim || g.anim.t >= 0.11)',
  caro: 'g.b.moves.length >= 34 || g.over',
  typing: 'g.mets && g.mets.filter((m) => !m.dead).length >= 4 && g.target && g.target.typed >= 2',
  catdog: 'g.k.k === "fly" && g.shots[0] && g.shots[0].t > 0.35 && g.stat[0].throws + g.stat[1].throws >= 4',
  jigsaw: 'g.bd && g.bd.lockedCount() >= g.P.n * 0.4 && g.hold && g.botPlan && g.botPlan.ph === "carry"' };
// chỉnh instance trước khi tua (vd. máy gõ chậm để ảnh Bắn Thiên Thạch có nhiều thiên thạch)
const PREP = { g2048: 'g.botNoise = 0.03', typing: 'g.botWpm = 9', catdog: 'g.allBots = false', jigsaw: 'App.api.opts.pieces = "24"; App.api.variant = "garden"' };
// chế độ dùng để chụp (game có nhiều chế độ, lấy cảnh đẹp nhất)
const MODE = { typing: 'meteor' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(1500);
  const ids = await page.evaluate((only) => Party.games.filter((g) => !only.length || only.includes(g.id)).map((g) => g.id), ONLY);
  await page.evaluate(() => {
    if (typeof BoardKit !== 'undefined') BoardKit.sync = true;
    App.slots = [null, null, null, null]; App.helpOn = false; App.openMenu();
  });
  for (const id of ids) {
    const sec = SEC[id] || SEC.default;
    await page.evaluate(([id, n, mode]) => {
      const d = Party.games.find((g) => g.id === id);
      if (mode) App.gameMode[id] = mode;
      const k = n || d.maxPlayers || 4;
      App.startGame(d, { seats: Array.from({ length: k }, () => ({ bot: true, level: 'normal' })) });
      App.beginCountdown();
    }, [id, SEATS[id], MODE[id]]);
    await page.waitForFunction(() => App.state === 'play', null, { timeout: 15000 }).catch(() => {});
    // tua nhanh: chạy game đồng bộ sec giây (dừng sớm nếu game sắp kết thúc)
    await page.evaluate(([sec, stop, prep]) => {
      if (prep) new Function('g', prep)(App.inst);
      const done = stop ? new Function('g', 'return ' + stop) : () => false;
      for (let s = 0; s < sec * 60 && !App.inst.finished && !done(App.inst); s++) {
        App.inst.update(1 / 60, App.gatherInputs());
        App.api.parts.update(1 / 60);
      }
      App.goT = 99;   // qua thời gian hiện nhãn phím
    }, [sec, STOP[id], PREP[id]]);
    await page.waitForTimeout(700);   // để vòng lặp thật vẽ lại vài khung (cả cảnh 3D)
    const png = path.join(TMP, id + '.png');
    await page.locator('#stage').screenshot({ path: png });
    execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert('RGB').resize((384, 216), Image.LANCZOS)
im.save(${JSON.stringify(path.join(OUT, id + '.webp'))}, 'WEBP', quality=78, method=6)
`]);
    console.log('✓', id, sec + 's');
    await page.evaluate(() => App.action('menu'));
    await page.waitForTimeout(150);
  }
  console.log(errors.length ? 'Lỗi trang:\n  ' + errors.join('\n  ') : 'Không lỗi trang', '→', OUT);
  await browser.close();
})();

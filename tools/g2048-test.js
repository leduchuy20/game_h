// Test lõi 2048: node tools/g2048-test.js
const C = require('../js/games/g2048_core.js');
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
// tiện: chuyển giữa số thật và số mũ cho một hàng 4 ô (trượt trái = hướng 3)
const E = (a) => a.map((v) => (v > 0 ? Math.log2(v) : v));
const V = (a) => a.map((e) => (e > 0 ? 2 ** e : e));
const row = (a, dir = 3) => { const b = E(a).concat(new Array(12).fill(0)); const r = C.move(b, 4, dir); return { out: V(r.cells.slice(0, 4)), r }; };

ok(JSON.stringify(row([2, 2, 0, 0]).out) === '[4,0,0,0]', '2 2 _ _ ← = 4 _ _ _');
ok(JSON.stringify(row([2, 0, 0, 2]).out) === '[4,0,0,0]', '2 _ _ 2 ← = 4 _ _ _ (trượt rồi gộp)');
ok(JSON.stringify(row([2, 2, 2, 0]).out) === '[4,2,0,0]', '2 2 2 _ ← = 4 2 (hai ô phía trước gộp)');
ok(JSON.stringify(row([2, 2, 2, 0], 1).out) === '[0,0,2,4]', '2 2 2 _ → = _ _ 2 4 (phía trước theo hướng trượt)');
ok(JSON.stringify(row([2, 2, 2, 2]).out) === '[4,4,0,0]', '2 2 2 2 ← = 4 4 (hai cặp, không gộp tiếp thành 8)');
ok(JSON.stringify(row([4, 2, 2, 0]).out) === '[4,4,0,0]', '4 2 2 _ ← = 4 4 (ô vừa gộp không gộp lần hai)');
ok(JSON.stringify(row([8, 8, 16, 16]).out) === '[16,32,0,0]', '8 8 16 16 ← = 16 32');
ok(row([8, 8, 16, 16]).r.gained === 48, 'điểm cộng = tổng ô vừa gộp (16 + 32 = 48)');
ok(!row([2, 4, 8, 16]).r.moved, 'hàng không đổi → không tính là đi');
ok(JSON.stringify(row([2, -1, 0, 2]).out) === '[2,-1,2,0]', 'ô đá chia hàng: 2 🪨 _ 2 ← = 2 🪨 2 _');
ok(JSON.stringify(row([0, 2, -1, 2]).out) === '[2,0,-1,2]', 'ô đá đứng yên, ô không vượt qua đá');

// 4 hướng trên bàn 4×4 + danh sách di chuyển cho hoạt ảnh
{
  const b = E([2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 4]);
  const up = C.move(b, 4, 0), dn = C.move(b, 4, 2);
  ok(V(up.cells).join(',') === '2,0,0,2,4,0,0,4,0,0,0,0,0,0,0,0' || V(up.cells).slice(0, 8).join(',') === '2,0,0,2,4,0,0,4', 'trượt lên đúng');
  ok(V(dn.cells).slice(8).join(',') === '2,0,0,2,4,0,0,4', 'trượt xuống đúng');
  const lf = C.move(b, 4, 3);
  ok(lf.moves.filter((m) => m.merge).length === 4 && lf.merges.length === 2, 'mỗi ô gộp có 2 ô nguồn trong danh sách di chuyển');
  ok(lf.moves.every((m) => lf.cells[m.to] > 0), 'mọi di chuyển tới ô có số');
}

// hết nước, ô lớn nhất, ô mới, hạt giống
ok(!C.canMove(E([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]), 4), 'bàn đầy xen kẽ → hết nước');
ok(C.canMove(E([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 4]), 4), 'còn 2 ô kề cùng số → còn nước');
{
  const R = C.makeRng(5); let twos = 0, n = 20000;
  for (let k = 0; k < n; k++) { const b = [0]; C.spawn(b, R); if (b[0] === 1) twos++; }
  ok(Math.abs(twos / n - 0.9) < 0.01, `ô mới là 2 khoảng 90% (${(100 * twos / n).toFixed(1)}%)`);
  const a = C.newGame(4, 77), c = C.newGame(4, 77);
  ok(a.cells.join() === c.cells.join() && a.rng.s === c.rng.s, 'cùng hạt giống → cùng 2 ô đầu và cùng trạng thái bộ sinh số');
  const d = C.makeRng(a.rng.s), x = a.rng.next(), y = d.next();
  ok(x === y, 'trạng thái bộ sinh số lưu / nạp lại được');
}

// máy tự chơi (cho smoke test / ảnh thẻ, đi bừa 25%): ván nào cũng kết thúc trong số nước vừa phải
for (const N of C.SIZES) {
  const tops = [], lens = [];
  for (let g = 0; g < (N < 6 ? 20 : 3); g++) {
    const s = C.newGame(N, 1000 + g), br = C.makeRng(g);
    let k = 0;
    while (C.canMove(s.cells, N) && k < 20000) {
      const d = C.bestMove(s.cells, N, br, 0.25);
      const r = C.move(s.cells, N, d);
      s.cells = r.cells; s.score += r.gained; C.spawn(s.cells, s.rng); k++;
    }
    tops.push(2 ** C.maxTile(s.cells)); lens.push(k);
  }
  tops.sort((a, b) => a - b);
  console.log(`  ${N}×${N}: máy đi ${Math.min(...lens)}–${Math.max(...lens)} nước, ô lớn nhất trung vị ${tops[tops.length >> 1]}`);
  // 6×6 rộng quá, máy gần như không bao giờ thua → game tự dừng ván toàn máy sau BOT_CAP nước
  if (N < 6) ok(lens.every((l) => l < 6000), `${N}×${N}: máy ván nào cũng hết nước trong 6000 nước`);
}

// gợi ý (expectimax): luôn trả nước hợp lệ, hết nước thì −1, chơi tốt hơn máy 1 lớp
{
  const full = E([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]);
  ok(C.think(full, 4).dir === -1, 'gợi ý: hết nước → −1');
  const b = E([2, 2, 4, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const t = C.think(b, 4);
  ok(t.dir >= 0 && C.move(b, 4, t.dir).moved, `gợi ý trả nước hợp lệ (${['lên', 'phải', 'xuống', 'trái'][t.dir]})`);
  ok(t.dir === 3 || t.dir === 1, 'gợi ý gộp được hàng 2 2 4 8 thì trượt ngang');
  const tops = [];
  for (let g = 0; g < 2; g++) {
    const s = C.newGame(4, 900 + g); let k = 0;
    while (C.canMove(s.cells, 4) && k < 400) { const r = C.move(s.cells, 4, C.think(s.cells, 4).dir); s.cells = r.cells; C.spawn(s.cells, s.rng); k++; }
    tops.push(2 ** C.maxTile(s.cells));
  }
  ok(tops.every((v) => v >= 512), `gợi ý tự chơi 400 nước lên được ô ≥ 512 (${tops.join(', ')})`);
}

// màn Thử thách + ván mỗi ngày
{
  ok(C.LEVELS.length === 12 && new Set(C.LEVELS.map((L) => L.id)).size === 12, '12 màn, id không trùng');
  ok(C.LEVELS.every((L) => L.stones.every((i) => i >= 0 && i < L.N * L.N) && L.star[0] < L.star[1] && (!L.limit || L.star[1] <= L.limit)), 'ô đá nằm trong bàn, mốc 3 sao < 2 sao ≤ giới hạn nước');
  const L = C.LEVELS.find((x) => x.id === 'l8'), s = C.newLevel(L, 7);
  for (let k = 0; k < 60 && C.canMove(s.cells, L.N); k++) { s.cells = C.move(s.cells, L.N, k % 4).cells; C.spawn(s.cells, s.rng); }
  ok(L.stones.every((i) => s.cells[i] === C.STONE) && s.cells.filter((v) => v === C.STONE).length === L.stones.length, 'ô đá đứng yên sau 60 nước');
  ok(C.starsOf(L, L.star[0]) === 3 && C.starsOf(L, L.star[0] + 1) === 2 && C.starsOf(L, L.star[1] + 1) === 1, 'chấm sao theo số nước');
  const a = C.dailyGame('2026-11-16'), b2 = C.dailyGame('2026-11-16'), c = C.dailyGame('2026-11-17');
  ok(a.cells.join() === b2.cells.join() && a.rng.s === b2.rng.s, 'ván ngày: cùng ngày ra cùng ván');
  let diff = 0; for (let d = 1; d <= 20; d++) if (C.dailyGame(`2026-12-${String(d).padStart(2, '0')}`).cells.join() !== c.cells.join()) diff++;
  ok(diff >= 18, 'ván ngày: khác ngày ra ván khác');
  let st = 0; for (let d = 1; d <= 28; d++) if (C.dailyGame(`2027-02-${String(d).padStart(2, '0')}`).stone >= 0) st++;
  ok(st > 5 && st < 23, `ván ngày: khoảng nửa số ngày có ô đá (${st}/28)`);
}

console.log(fail ? `${fail} lỗi` : 'Không lỗi');
process.exit(fail ? 1 : 0);

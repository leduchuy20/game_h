// Test luật + đo máy Caro:  node tools/caro-test.js [số ván mỗi cặp]
'use strict';
const E = require('../js/games/caro_engine.js')();
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('✗', msg); } else console.log('✓', msg); };
const N = 15;
const at = (r, c) => r * N + c;
function board(rule, xs, os) {
  const b = new E.Board(N, rule);
  xs.forEach(([r, c]) => b.play(at(r, c), 1));
  os.forEach(([r, c]) => b.play(at(r, c), 2));
  return b;
}
/* ----- luật ----- */
// 5 ngang thường
let b = board('block2', [[7, 3], [7, 4], [7, 5], [7, 6]], []);
ok(b.wouldWin(at(7, 7), 1), 'chặn hai đầu: 5 quân không bị chặn → thắng');
b = board('block2', [[7, 3], [7, 4], [7, 5], [7, 6]], [[7, 2]]);
ok(b.wouldWin(at(7, 7), 1), 'chặn hai đầu: bị chặn MỘT đầu vẫn thắng');
b = board('block2', [[7, 3], [7, 4], [7, 5], [7, 6]], [[7, 2], [7, 8]]);
ok(!b.wouldWin(at(7, 7), 1), 'chặn hai đầu: bị chặn CẢ HAI đầu → không thắng');
b = board('free', [[7, 3], [7, 4], [7, 5], [7, 6]], [[7, 2], [7, 8]]);
ok(b.wouldWin(at(7, 7), 1), 'tự do: bị chặn hai đầu vẫn thắng');
b = board('exact', [[7, 3], [7, 4], [7, 5], [7, 6], [7, 8]], []);
ok(!b.wouldWin(at(7, 7), 1), 'đúng 5: dãy 6 không tính');
b = board('free', [[7, 3], [7, 4], [7, 5], [7, 6], [7, 8]], []);
ok(b.wouldWin(at(7, 7), 1), 'tự do: dãy 6 vẫn thắng');
b = board('block2', [[3, 3], [4, 4], [5, 5], [6, 6]], []);
ok(b.wouldWin(at(7, 7), 1) && b.wouldWin(at(2, 2), 1), 'đường chéo xuôi');
b = board('block2', [[3, 9], [4, 8], [5, 7], [6, 6]], []);
ok(b.wouldWin(at(7, 5), 1), 'đường chéo ngược');
// hình dạng
b = board('block2', [[7, 4], [7, 5], [7, 6]], []);
let s = E.shape(b, at(7, 7), 1);
ok(s.open4 === 1, 'xxx + 1 → bốn mở');
b = board('block2', [[7, 4], [7, 5], [7, 6]], [[7, 3]]);
s = E.shape(b, at(7, 7), 1);
ok(s.four === 1 && !s.open4, 'oxxx + 1 → bốn thường');
b = board('block2', [[7, 5], [7, 6]], []);
s = E.shape(b, at(7, 7), 1);
ok(s.three === 1, 'xx + 1 → ba mở');
// máy: thắng ngay và chặn
b = board('block2', [[7, 3], [7, 4], [7, 5], [7, 6], [1, 1]], [[9, 3], [9, 4], [9, 5], [9, 6]]);
ok([at(7, 7), at(7, 2)].includes(E.think(b, 1, 'hard')), 'máy thắng ngay khi có thể');
b = board('block2', [[1, 1], [2, 9]], [[9, 3], [9, 4], [9, 5], [9, 6]]);
ok([at(9, 7), at(9, 2)].includes(E.think(b, 1, 'normal')), 'máy chặn bốn của đối thủ');
b = board('block2', [[7, 5], [7, 6], [7, 7], [1, 1]], [[12, 1], [12, 3], [12, 5]]);
const t = E.think(b, 2, 'hard');
ok([at(7, 4), at(7, 8), at(7, 3), at(7, 9)].includes(t), 'máy Khó chặn ba mở (đi ' + t + ')');
// VCF
b = board('block2', [[5, 5], [5, 6], [5, 7], [6, 8], [7, 8], [8, 8]], [[5, 4], [9, 8], [0, 0], [0, 2]]);
const v = E.vcf(b, 1, 10, { n: 20000 });
ok(!!v, 'tìm được chuỗi bốn thắng (VCF) ' + JSON.stringify(v));

/* ----- máy đấu máy ----- */
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function play(lvA, lvB, seed, rule = 'block2') {
  const bd = new E.Board(30, rule), R = rng(seed);
  const lv = [null, lvA, lvB];
  let col = 1;
  for (let k = 0; k < 400; k++) {
    const m = E.think(bd, col, lv[col], R);
    if (bd.c[m]) throw new Error('máy đi vào ô đã có quân');
    bd.play(m, col);
    if (bd.winLine(m)) return col;
    col = 3 - col;
  }
  return 0;
}
const G = Number(process.argv[2]) || 10;
function match(a, b2) {
  let wa = 0, wb = 0, d = 0;
  const t0 = Date.now();
  for (let g = 0; g < G; g++) {
    // đổi bên đi trước
    const w = g % 2 ? play(b2, a, 1000 + g) : play(a, b2, 1000 + g);
    const aWon = g % 2 ? w === 2 : w === 1, bWon = g % 2 ? w === 1 : w === 2;
    if (aWon) wa++; else if (bWon) wb++; else d++;
  }
  console.log(`${a} vs ${b2}: ${wa}-${wb} (hòa ${d}) · ${((Date.now() - t0) / G / 1000).toFixed(2)}s/ván`);
  return wa / Math.max(1, wa + wb);
}
match('normal', 'easy');
match('hard', 'normal');
match('hard', 'easy');
console.log(fail ? `${fail} lỗi` : 'Không lỗi');
process.exit(fail ? 1 : 0);

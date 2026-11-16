// Test lõi Jigsaw Puzzle: node tools/jigsaw-test.js
const C = require('../js/games/jigsaw_core.js');
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };

// điểm cuối của từng lệnh vẽ (toạ độ tuyệt đối trên lời giải)
function outline(P, p) {
  const ox = p.c * P.pw, oy = p.r * P.ph, pts = [];
  for (const k of p.cmds) pts.push([k[k.length - 2] + ox, k[k.length - 1] + oy]);
  return pts;
}
// lấy mẫu đường Bézier của một mảnh → các điểm
function sample(P, p) {
  const ox = p.c * P.pw, oy = p.r * P.ph, out = [];
  let cx = 0, cy = 0;
  for (const k of p.cmds) {
    if (k[0] === 'M' || k[0] === 'L') { cx = k[1]; cy = k[2]; out.push([cx + ox, cy + oy]); continue; }
    for (let t = 0.1; t <= 1.0001; t += 0.1) {
      const u = 1 - t;
      const x = u * u * u * cx + 3 * u * u * t * k[1] + 3 * u * t * t * k[3] + t * t * t * k[5];
      const y = u * u * u * cy + 3 * u * u * t * k[2] + 3 * u * t * t * k[4] + t * t * t * k[6];
      out.push([x + ox, y + oy]);
    }
    cx = k[5]; cy = k[6];
  }
  return out;
}

for (const n of C.SIZES) {
  const P = C.makePuzzle(n, 720, 405, 1234 + n);
  ok(P.pieces.length === n && P.cols * P.rows === n, `${n} mảnh: lưới ${P.cols}×${P.rows}, mảnh ${P.pw.toFixed(0)}×${P.ph.toFixed(1)} px, lề vẽ ${P.pad}`);
  // đường viền khép kín, đi qua 4 góc ô
  let closed = true, corners = true;
  for (const p of P.pieces) {
    const o = outline(P, p), last = o[o.length - 1];
    if (Math.hypot(last[0] - p.c * P.pw, last[1] - p.r * P.ph) > 1e-6) closed = false;
    for (const [x, y] of [[(p.c + 1) * P.pw, p.r * P.ph], [(p.c + 1) * P.pw, (p.r + 1) * P.ph], [p.c * P.pw, (p.r + 1) * P.ph]]) {
      if (!o.some((q) => Math.hypot(q[0] - x, q[1] - y) < 1e-6)) corners = false;
    }
  }
  ok(closed && corners, `${n} mảnh: viền mỗi mảnh khép kín qua 4 góc ô`);
  // hai mảnh kề dùng chung đúng một đường cong: cạnh phải của A (3 lệnh sau cạnh trên) so với cạnh trái của B (3 lệnh cuối)
  let worst = 0;
  const seg = (P, p, from, to) => sample(P, Object.assign({}, p, { cmds: [['M', ...prevEnd(p.cmds, from)], ...p.cmds.slice(from, to)] }));
  const prevEnd = (cmds, k) => { const q = cmds[k - 1]; return [q[q.length - 2], q[q.length - 1]]; };
  for (const p of P.pieces) {
    if (p.c === P.cols - 1) continue;
    const q = P.pieces[p.i + 1], k0 = p.r > 0 ? 4 : 2;
    const a = seg(P, p, k0, k0 + 3), b = seg(P, q, q.cmds.length - 3, q.cmds.length);
    for (const s of a) {
      let d = Infinity;
      for (const t of b) d = Math.min(d, Math.hypot(s[0] - t[0], s[1] - t[1]));
      worst = Math.max(worst, d);
    }
  }
  ok(worst < 1e-6, `${n} mảnh: cạnh chung của hai mảnh kề trùng khít (lệch tối đa ${worst.toExponential(1)})`);
  // núm lồi/lõm ngược nhau ở hai bên một cạnh
  let opp = true;
  for (const p of P.pieces) {
    if (p.c < P.cols - 1 && p.edge[1] !== -P.pieces[p.i + 1].edge[3]) opp = false;
    if (p.r < P.rows - 1 && p.edge[2] !== -P.pieces[p.i + P.cols].edge[0]) opp = false;
    if ((p.r === 0) !== (p.edge[0] === 0) || (p.c === 0) !== (p.edge[3] === 0)) opp = false;
  }
  ok(opp, `${n} mảnh: mỗi cạnh trong một bên lồi một bên lõm, viền ngoài thẳng`);
}

// cùng hạt giống → cùng bộ; khác hạt giống → khác
const A = C.makePuzzle(48, 720, 405, 77), B = C.makePuzzle(48, 720, 405, 77), D = C.makePuzzle(48, 720, 405, 78);
ok(JSON.stringify(A.pieces) === JSON.stringify(B.pieces), 'cùng hạt giống ra cùng cách cắt');
ok(JSON.stringify(A.pieces) !== JSON.stringify(D.pieces), 'khác hạt giống ra cách cắt khác');

// hút dính + khoá vào khung
{
  const P = C.makePuzzle(12, 720, 405, 5), FX = 280, FY = 184;
  const bd = new C.Board(P, FX, FY);
  for (let i = 0; i < P.n; i++) bd.place(i, 100 + i * 90, 640, 0);
  // đặt mảnh 1 ngay cạnh mảnh 0 (đúng vị trí tương đối, lệch 6 px)
  const g0 = bd.groupOfPiece(0), g1 = bd.groupOfPiece(1);
  g1.x = g0.x + 6; g1.y = g0.y - 4;
  let r = bd.drop(g1, 14);
  ok(r.joins === 1 && bd.gOf[0] === bd.gOf[1] && bd.groups.size === P.n - 1, 'mảnh kề đặt gần đúng chỗ → dính thành một nhóm');
  // mảnh không kề (mảnh 5 nằm hàng dưới, cột 1 — kề 1 nhưng đặt sai chỗ 60 px) → không dính
  const g5 = bd.groupOfPiece(5), gm = bd.groupOfPiece(0);
  g5.x = gm.x + 60; g5.y = gm.y;
  r = bd.drop(g5, 14);
  ok(r.joins === 0, 'đặt lệch xa → không dính');
  // mảnh 2 lệch đúng nhưng xoay khác góc → không dính
  const g2 = bd.groupOfPiece(2); g2.rot = 1; g2.x = gm.x; g2.y = gm.y;
  r = bd.drop(g2, 14);
  ok(r.joins === 0, 'cùng chỗ nhưng khác góc xoay → không dính');
  // xoay quanh một điểm 4 lần → về như cũ
  const sx = g2.x, sy = g2.y;
  for (let k = 0; k < 4; k++) bd.rotate(g2, 333, 444, 1);
  ok(Math.abs(g2.x - sx) < 1e-9 && Math.abs(g2.y - sy) < 1e-9 && g2.rot === 1, 'xoay 4 lần quanh một điểm về đúng chỗ cũ');
  // điểm dưới con trỏ vẫn đứng yên khi xoay
  const before = bd.toSol(g2, 400, 300);
  bd.rotate(g2, 400, 300, -1);
  const after = bd.toSol(g2, 400, 300);
  ok(Math.hypot(before[0] - after[0], before[1] - after[1]) < 1e-9, 'xoay quanh con trỏ: điểm dưới con trỏ không trôi');
  // nhóm đúng góc, gần gốc khung → khoá
  gm.x = FX + 5; gm.y = FY + 3;
  r = bd.drop(gm, 14);
  ok(r.locked && gm.locked && gm.x === FX && gm.y === FY, 'nhóm đặt gần đúng chỗ trong khung → khoá vào khung');
  // ghép nốt toàn bộ: đặt từng nhóm lên gốc khung với rot 0 → xong
  for (const g of [...bd.groups.values()]) { if (g.locked) continue; g.rot = 0; g.x = FX + 3; g.y = FY - 2; bd.drop(g, 14); }
  ok(bd.done() && bd.lockedCount() === P.n, 'đặt hết vào khung → hoàn thành');
  // lưu và nạp lại
  const snap = JSON.parse(JSON.stringify(bd.snapshot()));
  const bd2 = new C.Board(P, FX, FY);
  ok(bd2.restore(snap) && bd2.done(), 'lưu rồi nạp lại ván ra đúng trạng thái');
  ok(!new C.Board(P, FX, FY).restore([{ x: 0, y: 0, rot: 0, m: [0, 1] }]), 'dữ liệu lưu thiếu mảnh → từ chối');
}

// nhóm lớn kéo nhóm nhỏ: nhóm thả dính vào nhóm kề lớn hơn mà nhóm lớn không bị dời
{
  const P = C.makePuzzle(24, 720, 405, 9), bd = new C.Board(P, 280, 184);
  for (let i = 0; i < P.n; i++) bd.place(i, 50 + (i % 6) * 200, 100 + Math.floor(i / 6) * 150, 0);
  const big = bd.groupOfPiece(0);
  for (const i of [1, 2, 6]) { const g = bd.groupOfPiece(i); g.x = big.x; g.y = big.y; bd.drop(g, 14); }
  const bx = big.x, by = big.y, small = bd.groupOfPiece(3);
  small.x = big.x + 8; small.y = big.y + 8;
  bd.drop(small, 14);
  ok(bd.gOf[3] === big.id && big.x === bx && big.y === by && big.m.length === 5, 'nhóm nhỏ thả vào nhóm lớn: nhóm lớn đứng yên, nhóm nhỏ nhảy vào khớp');
}

// rải mảnh: không đè vào lòng khung, nằm trong bàn
{
  const R = C.rng(3), P = C.makePuzzle(96, 720, 405, 3);
  const pts = C.scatter(R, 96, { w: 1280, h: 720, top: 56 }, { x: 280, y: 184, w: 720, h: 405 }, { w: P.pw, h: P.ph });
  const inFrame = pts.filter(([x, y]) => x > 280 + P.pw && x < 1000 - P.pw && y > 184 + P.ph && y < 589 - P.ph).length;
  const out = pts.filter(([x, y]) => x < 0 || x > 1280 || y < 56 || y > 720).length;
  let minD = Infinity;
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) minD = Math.min(minD, Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]));
  ok(inFrame === 0 && out === 0, `rải 96 mảnh: không mảnh nào nằm sâu trong khung hay ra ngoài bàn (khoảng cách tâm gần nhất ${minD.toFixed(0)} px)`);
}

// xếp gọn: đủ chỗ cho mọi số mảnh, không chỗ nào chạm khung, gần khung trước
for (const n of C.SIZES) {
  const P = C.makePuzzle(n, 720, 405, 1), fr = { x: 280, y: 185, w: 720, h: 405 };
  const sl = C.tidySlots(n, { w: 1280, h: 720, top: 56 }, fr, { w: P.pw, h: P.ph });
  const bad = sl.filter(([x, y]) => x > fr.x + P.pw * 0.5 && x < fr.x + fr.w - P.pw * 0.5 && y > fr.y + P.ph * 0.5 && y < fr.y + fr.h - P.ph * 0.5).length;
  const dist = ([x, y]) => Math.hypot(Math.max(fr.x - x, 0, x - fr.x - fr.w), Math.max(fr.y - y, 0, y - fr.y - fr.h));
  let sorted = true;
  for (let k = 1; k < sl.length; k++) if (dist(sl[k]) + 1 < dist(sl[k - 1])) sorted = false;
  ok(sl.length >= n && bad === 0 && sorted, `xếp gọn ${n} mảnh: ${sl.length} chỗ (không lấn sâu quá nửa mảnh vào khung), gần khung trước`);
}
{
  const P = C.makePuzzle(48, 720, 405, 1), fr = { x: 280, y: 185, w: 720, h: 405 };
  const sl = C.tidySlots(48, { w: 1280, h: 720, top: 56 }, fr, { w: P.pw, h: P.ph }, (x, y) => x < 200 && y < 300);
  ok(sl.every(([x, y]) => !(x < 200 && y < 300)), 'xếp gọn chừa chỗ đang có nhóm lớn');
}

console.log(fail ? `${fail} lỗi` : 'Không lỗi');
process.exit(fail ? 1 : 0);

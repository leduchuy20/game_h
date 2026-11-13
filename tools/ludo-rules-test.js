// Test luật Cờ Cá Ngựa + đo máy đấu máy: node tools/ludo-rules-test.js
const R = require(require('path').join(__dirname, '..', 'js', 'games', 'ludo_rules.js'));
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
// hình học
const set = new Set(R.RING_RC.map(([r, c]) => r + ',' + c));
assert(R.RING_RC.length === 56 && set.size === 56, 'vòng 56 ô không trùng');
for (let i = 0; i < 56; i++) { const [a, b] = R.RING_RC[i], [c, d] = R.RING_RC[(i + 1) % 56]; if (Math.abs(a - c) + Math.abs(b - d) !== 1) assert(false, 'ô liền kề ' + i); }
assert(R.GATE_IDX[0] === 55 && R.RING_RC[55].join() === '7,0', 'cửa đỏ (7,0)');
R.HOME_RC.forEach((h, k) => { assert(Math.abs(h[0][0] - R.RING_RC[R.GATE_IDX[k]][0]) + Math.abs(h[0][1] - R.RING_RC[R.GATE_IDX[k]][1]) === 1, 'bậc 1 sát cửa màu ' + k); });
const O = Object.assign({}, R.DEFAULTS);
const st = R.newState([0, 2]);
const tos = (d) => R.legalMoves(st, O, 0, d).filter((m) => m.h === 0).map((m) => m.to).sort((a, b) => a - b).join(',');
st.horses[0][0] = 53;
assert(tos([1, 2]) === '56', 'cách cửa 2, đổ 3 → bậc 1');
assert(tos([2, 6]) === '61', 'đổ 8 → bậc 6');
assert(tos([1, 1]) === '54,55', 'đổ 1-1 → 2 ô (cửa) hoặc 1 ô');
assert(tos([3, 6]) === '', 'đổ 9 → quá, không đi');
assert(tos([4, 4]) === '57,61', 'đổ 4-4 → bậc 6 hoặc bậc 2');
st.horses[0][0] = 59;
assert(tos([5, 5]) === '60', 'bậc 4, đổ 5-5 → bậc 5');
assert(tos([2, 3]) === '', 'bậc 4, 2+3 → đứng yên');
// xuất chuồng
st.horses[0] = [-1, -1, -1, -1];
assert(R.legalMoves(st, O, 0, [2, 3]).length === 0, '2+3 không xuất');
assert(R.legalMoves(st, O, 0, [1, 6]).some((m) => m.kind === 'exit'), '1+6 xuất');
assert(R.legalMoves(st, O, 0, [3, 3]).some((m) => m.kind === 'exit'), '3-3 xuất');
// đá + chắn đường
st.horses[0] = [0, -1, -1, -1];
st.horses[1] = [-1, -1, -1, -1];
const enemyAt = (cell) => { const p = (cell - R.START[2] + 56) % 56; st.horses[1][0] = p; };
enemyAt(5);
let mv = R.legalMoves(st, O, 0, [2, 3]);
assert(mv.some((m) => m.h === 0 && m.to === 5 && m.kick), 'đứng đúng ô → đá');
mv = R.legalMoves(st, O, 0, [3, 4]);
assert(!mv.some((m) => m.h === 0 && m.to === 7), 'không nhảy qua đầu');
assert(R.legalMoves(st, Object.assign({}, O, { jump: true }), 0, [3, 4]).some((m) => m.h === 0 && m.to === 7), 'cho nhảy qua đầu');
// ngựa nhà ở ô xuất quân → không xuất thêm
st.horses[1][0] = -1;
st.horses[0] = [0, -1, -1, -1];
assert(!R.legalMoves(st, O, 0, [6, 6]).some((m) => m.kind === 'exit'), 'ô xuất quân có ngựa nhà thì không xuất');
// kiểu 'gate'
const G = Object.assign({}, O, { entry: 'gate' });
st.horses[0] = [52, -1, -1, -1];
assert(R.legalMoves(st, G, 0, [3, 5]).some((m) => m.to === 55), 'gate: 1 con lẻ dừng đúng cửa');
st.horses[0] = [55, -1, -1, -1];
assert(R.legalMoves(st, G, 0, [2, 5]).map((m) => m.to).sort().join() === '57,60', 'gate: từ cửa ra 2/5 → bậc 2/5 (tổng 7 quá)');
st.horses[0] = [58, -1, -1, -1];
assert(R.legalMoves(st, G, 0, [4, 1]).map((m) => m.to).join() === '59', 'gate: bậc 3 ra 4 → bậc 4');
console.log('--- mô phỏng');
// mô phỏng ván đủ, đo mức máy
function game(levels, o, seed) {
  let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const n = levels.length; let st = R.newState(R.colorsFor(n)); let cur = 0, turns = 0;
  const done = [];
  while (done.length < (o.rank ? n - 1 : 1) && turns < 5000) {
    turns++;
    if (done.includes(cur)) { cur = (cur + 1) % n; continue; }
    let again = true, bonus = 0;
    while (again) {
      const d = o.dice === 1 ? [1 + Math.floor(rnd() * 6)] : [1 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 6)];
      again = R.isBonus(d, o);
      if (again) bonus++;
      if (o.triple && bonus >= 3) break;
      let pool = o.split && d.length === 2 ? [0, 1] : null;
      for (let step = 0; step < 2; step++) {
        const ms = R.legalMoves(st, o, cur, d, pool);
        if (!ms.length) break;
        const m = R.botPick(st, o, ms, levels[cur], rnd);
        st = R.apply(st, m);
        if (st.horses.flat().some((p) => p < -1 || p > 61)) throw new Error('vị trí sai');
        if (!pool || m.use === 'all') break;
        pool = pool.filter((k) => k !== m.use); if (!pool.length) break;
      }
      if (R.hasWon(st, o, cur)) { done.push(cur); break; }
    }
    cur = (cur + 1) % n;
  }
  return { winner: done[0], turns };
}
const variants = [{ entry: 'count' }, 
  {}, { dice: 1, exit: 'six' }, { split: true }, { entry: 'gate' }, { entry: 'gate', gateDouble: true }, { entry: 'count' }, { jump: true }, { win: 'all' }, { triple: true }, { exit: 'six', half: false },
];
for (const v of variants) {
  const o = Object.assign({}, R.DEFAULTS, v);
  let w = [0, 0], maxT = 0, stuck = 0;
  for (let g = 0; g < 200; g++) { const r = game(g % 2 ? ['hard', 'easy'] : ['easy', 'hard'], o, 1000 + g); if (r.winner === undefined) stuck++; else w[(r.winner === (g % 2 ? 0 : 1)) ? 0 : 1]++; maxT = Math.max(maxT, r.turns); }
  console.log(JSON.stringify(v).padEnd(40), 'Khó thắng Dễ', w[0], '/', w[0] + w[1], ' kẹt', stuck, ' lượt tối đa', maxT);
}
console.log('--- các cặp mức (luật mặc định)');
for (const [a, b] of [['normal', 'easy'], ['hard', 'normal'], ['hard', 'easy']]) {
  const o = Object.assign({}, R.DEFAULTS); let w = 0, t = 0;
  for (let g = 0; g < 400; g++) { const lv = g % 2 ? [a, b] : [b, a]; const r = game(lv, o, 5000 + g); if (r.winner === undefined) continue; t++; if (lv[r.winner] === a) w++; }
  console.log(a, 'thắng', b, w, '/', t);
}

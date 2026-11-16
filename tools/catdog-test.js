// Test lõi Cat and Dog: node tools/catdog-test.js
'use strict';
const C = require('../js/games/catdog_core.js');
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('✗', msg); } else console.log('✓', msg); };
const CAT = { x: 230, face: 1 }, DOG = { x: 1050, face: -1 };

// máy ngắm trúng đầu với mọi sức gió, hai phía
let allHead = true;
const need = [];
for (let w = -10; w <= 10; w++) {
  const p1 = C.solve(CAT.x, CAT.face, w, DOG), r1 = C.simulate(CAT.x, CAT.face, p1, w, DOG);
  const p2 = C.solve(DOG.x, DOG.face, w, CAT), r2 = C.simulate(DOG.x, DOG.face, p2, w, CAT);
  if (r1.kind !== 'head' || r2.kind !== 'head') { allHead = false; console.log('  gió', w, r1.kind, r2.kind, p1.toFixed(3), p2.toFixed(3)); }
  need.push(p1);
}
ok(allHead, `lực đúng luôn trúng đầu, gió −10…10 (lực cần ${Math.min(...need).toFixed(2)}–${Math.max(...need).toFixed(2)})`);
ok(Math.max(...need) < 0.97 && Math.min(...need) > 0.3, 'lực cần nằm gọn trong thanh lực');

// từng bản đồ: gió mạnh nhất vẫn ném trúng được; vị trí đã né (chế độ Né tránh) cũng trúng được
for (const id in C.MAPS) {
  const M = C.MAPS[id];
  let okAll = true, lo = 1, hi = 0;
  for (const w of [-M.windMax, -5, 0, 5, M.windMax]) for (const tx of [1000, 1050, 1100]) {
    const p = C.solve(CAT.x, 1, w, { x: tx, face: -1 }, false, M.wall), r = C.simulate(CAT.x, 1, p, w, { x: tx, face: -1 }, { wall: M.wall });
    if (r.kind !== 'head') { okAll = false; console.log('  ', id, 'gió', w, 'x', tx, r.kind, p.toFixed(2)); }
    lo = Math.min(lo, p); hi = Math.max(hi, p);
  }
  ok(okAll && hi < 0.99, `bản đồ ${id}: trúng đầu ở mọi gió ±${M.windMax}, đích x 1000–1100 (lực ${lo.toFixed(2)}–${hi.toFixed(2)})`);
}

// canh góc: không truyền góc = 55°; góc trong 45–65° trúng được đầu ở đa số gió; góc bị kẹp trong ANG_MIN..ANG_MAX
{
  const d = C.DEG || Math.PI / 180;
  const same = C.simulate(CAT.x, 1, 0.6, 3, DOG).x === C.simulate(CAT.x, 1, 0.6, 3, DOG, { ang: C.ANG }).x;
  ok(same, 'không truyền góc = góc mặc định 55°');
  const lowC = C.launch(CAT.x, 1, 0.5, 0, false, null, 0.1), minC = C.launch(CAT.x, 1, 0.5, 0, false, null, C.ANG_MIN);
  ok(lowC.vx === minC.vx && lowC.vy === minC.vy, `góc bị kẹp trong ${Math.round(C.ANG_MIN / d)}°–${Math.round(C.ANG_MAX / d)}°`);
  for (const deg of [45, 50, 60, 65, 70]) {
    let hit = 0, tot = 0;
    for (const id of Object.keys(C.MAPS)) {
      const M = C.MAPS[id];
      for (const w of [-M.windMax, -5, 0, 5, M.windMax]) for (const tx of [1000, 1050, 1100]) {
        tot++;
        const a = deg * d, p = C.solve(CAT.x, 1, w, { x: tx, face: -1 }, false, M.wall, a);
        if (C.simulate(CAT.x, 1, p, w, { x: tx, face: -1 }, { wall: M.wall, ang: a }).kind === 'head') hit++;
      }
    }
    console.log(`  góc ${deg}°: trúng đầu được ${hit}/${tot} trường hợp (mọi bản đồ)`);
    if (deg >= 50 && deg <= 60) ok(hit >= tot * 0.9, `góc ${deg}° trúng đầu được gần như mọi gió`);
  }
  let walls = 0;
  for (let p = 0.3; p <= 1; p += 0.05) if (C.simulate(CAT.x, 1, p, 0, DOG, { ang: C.ANG_MIN }).fence) walls++;
  ok(walls >= 5, `góc thấp nhất dễ vướng rào (${walls}/15 mức lực)`);
}

// lực yếu đập hàng rào, lực quá mạnh bay qua đầu
ok(C.simulate(CAT.x, 1, 0.05, 0, DOG).x < C.FENCE.x0, 'lực rất yếu rơi ngay bên mình');
let fp = -1;
for (let p = 0; p <= 0.6; p += 0.01) if (C.simulate(CAT.x, 1, p, 0, DOG).fence) { fp = p; break; }
ok(fp > 0, `lực khoảng ${fp.toFixed(2)} đập vào hàng rào`);
ok(['miss', 'near'].includes(C.simulate(CAT.x, 1, 1, 10, DOG).kind), 'lực tối đa + gió xuôi: bay qua');

// độ rộng vùng trúng theo lực (để chỉnh độ lệch của máy)
const p0 = C.solve(CAT.x, 1, 0, DOG);
let lo = p0, hi = p0;
while (C.simulate(CAT.x, 1, lo - 0.001, 0, DOG).kind !== 'miss' && lo > 0) lo -= 0.001;
while (C.simulate(CAT.x, 1, hi + 0.001, 0, DOG).kind !== 'miss' && hi < 1) hi += 0.001;
console.log(`  không gió: lực ${p0.toFixed(3)}, còn trúng (đầu/người/sát bên) trong ${(lo).toFixed(3)}–${hi.toFixed(3)} (±${((hi - lo) / 2 * 100).toFixed(1)}%)`);
ok(hi - lo > 0.03 && hi - lo < 0.2, 'vùng trúng không quá hẹp, không quá rộng');

ok(C.damage('head') === 25 && C.damage('head', true) === 38 && C.damage('miss') === 0, 'sát thương + Ném mạnh ×1,5');
ok(Math.abs(C.powerAt(0.5, 1) - 0.5) < 1e-9 && Math.abs(C.powerAt(1.5, 1) - 0.5) < 1e-9 && C.powerAt(1, 1) === 1, 'thanh lực lên rồi xuống');

// đo máy: tỉ lệ trúng theo độ lệch lực (sigma)
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
for (const [name, sig] of [['Dễ', 0.13], ['TB', 0.06], ['Khó', 0.035]]) {
  const cnt = { head: 0, body: 0, near: 0, miss: 0 };
  for (let k = 0; k < 400; k++) {
    const w = C.newWind(), p = C.solve(CAT.x, 1, w, DOG) + gauss() * sig;
    cnt[C.simulate(CAT.x, 1, p, w, DOG).kind]++;
  }
  console.log(`  máy ${name} (lệch ${sig}): đầu ${cnt.head / 4}% · người ${cnt.body / 4}% · sát ${cnt.near / 4}% · trượt ${cnt.miss / 4}%`);
}
console.log(fail ? `${fail} lỗi` : 'Không lỗi');
process.exit(fail ? 1 : 0);

// Lõi Cat and Dog: đường bay đồ ném (trọng lực + gió), va chạm hàng rào / nhân vật, sát thương, máy tính lực ném.
// Không vẽ gì — chạy được bằng node để test (tools/catdog-test.js). Trình duyệt: window.CatDogCore.
// Toạ độ theo màn 1280×720, y hướng xuống; mặt đất y = GY.
(function (root, factory) {
  const C = factory();
  if (typeof module === 'object' && module.exports) module.exports = C;
  else root.CatDogCore = C;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GY = 620;                          // mặt đất
  const G = 900;                           // trọng lực (px/s²)
  const ANG = 55 * Math.PI / 180;          // góc ném mặc định (chế độ góc cố định)
  const ANG_MIN = 40 * Math.PI / 180, ANG_MAX = 75 * Math.PI / 180;   // giới hạn khi tự canh góc (thấp hơn 40° gần như luôn vướng rào)
  const VMIN = 430, VMAX = 1080;           // vận tốc ném ở lực 0 / lực 1
  const WIND_ACC = 14;                     // gió ±10 → gia tốc ngang ±140 px/s²
  const DT = 1 / 120;                      // bước mô phỏng cố định (game và máy dùng chung)
  const R = 14, R_BIG = 20;                // bán kính đồ ném (thường / Ném mạnh)
  const FENCE = { x0: 622, x1: 658, top: 300 };
  // bản đồ: vật cản giữa sân + gió tối đa (Bãi biển gió mạnh hơn)
  const MAPS = {
    yard: { wall: FENCE, windMax: 10 },
    beach: { wall: { x0: 626, x1: 654, top: 300 }, windMax: 12 },
    roof: { wall: { x0: 596, x1: 684, top: 326 }, windMax: 10 },
  };
  const SCALE = 0.85;                      // tỉ lệ vẽ nhân vật
  const DMG = { head: 25, body: 15, near: 5 };
  const NEAR = 70;                         // rơi cách chân đối thủ ≤ NEAR → sát bên
  const MAXT = 8;                          // bay quá 8 giây thì thôi

  /** điểm buông tay của người ném ở x, hướng face (1 = nhìn phải) */
  function handOf(x, face) { return { x: x + face * 30 * SCALE, y: GY - 150 * SCALE }; }
  /** vùng trúng của nhân vật đứng ở x */
  function bodyOf(x, face) {
    return {
      head: { x: x + face * 6 * SCALE, y: GY - 114 * SCALE, r: 44 * SCALE },
      body: { x: x + face * 4 * SCALE, y: GY - 50 * SCALE, r: 38 * SCALE },
    };
  }

  /** wall = vật cản giữa sân { x0, x1, top } (hàng rào / lưới / ống khói), mặc định FENCE */
  function launch(x, face, power, wind, big, wall, ang) {
    const h = handOf(x, face), v = VMIN + Math.max(0, Math.min(1, power)) * (VMAX - VMIN);
    const a = ang == null ? ANG : Math.max(ANG_MIN, Math.min(ANG_MAX, ang));
    return { x: h.x, y: h.y, vx: face * v * Math.cos(a), vy: -v * Math.sin(a), ax: wind * WIND_ACC,
      r: big ? R_BIG : R, t: 0, state: 'fly', rot: 0, spin: face * (8 + v / 120), fenceHit: false, wall: wall || FENCE };
  }

  /**
   * một bước mô phỏng; target = { x, face } của đối thủ.
   * Trả kết quả khi chạm: { kind: 'head'|'body'|'near'|'miss', x, y } hoặc null khi còn bay.
   * Chạm hàng rào thì rơi thẳng xuống (state 'drop'), chạm đất mới có kết quả.
   */
  function step(s, dt, target) {
    s.t += dt;
    s.rot += s.spin * dt;
    if (s.state === 'fly') s.vx += s.ax * dt;
    s.vy += G * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    // vật cản giữa sân
    const F = s.wall || FENCE;
    if (s.state === 'fly' && s.x + s.r > F.x0 && s.x - s.r < F.x1 && s.y + s.r > F.top) {
      s.state = 'drop'; s.fenceHit = true;
      s.x = s.vx > 0 ? F.x0 - s.r : F.x1 + s.r;
      s.vx = -s.vx * 0.15; s.vy = Math.max(s.vy, 0) * 0.3; s.spin *= -0.5;
    }
    // nhân vật
    if (s.state === 'fly' && target) {
      const b = bodyOf(target.x, target.face);
      if (Math.hypot(s.x - b.head.x, s.y - b.head.y) < b.head.r + s.r) return { kind: 'head', x: s.x, y: s.y };
      if (Math.hypot(s.x - b.body.x, s.y - b.body.y) < b.body.r + s.r) return { kind: 'body', x: s.x, y: s.y };
    }
    // mặt đất / ra khỏi màn
    if (s.y + s.r * 0.5 >= GY) {
      s.y = GY - s.r * 0.5;
      const near = target && !s.fenceHit && Math.abs(s.x - target.x) < NEAR;
      return { kind: near ? 'near' : 'miss', x: s.x, y: s.y };
    }
    if (s.x < -200 || s.x > 1480 || s.t > MAXT) return { kind: 'miss', x: s.x, y: s.y };
    return null;
  }

  /** mô phỏng cả đường bay; trả { kind, x, y, t, path? , closest } (closest = khoảng cách gần nhất tới tâm đầu) */
  function simulate(from, face, power, wind, target, opts = {}) {
    const s = launch(from, face, power, wind, opts.big, opts.wall, opts.ang);
    const head = target ? bodyOf(target.x, target.face).head : null;
    let closest = Infinity;
    const path = opts.path ? [] : null;
    for (let i = 0; i < MAXT / DT + 2; i++) {
      const r = step(s, DT, target);
      if (head) closest = Math.min(closest, Math.hypot(s.x - head.x, s.y - head.y));
      if (path && i % 3 === 0) path.push([s.x, s.y]);
      if (r) return Object.assign(r, { t: s.t, closest, path, fence: s.fenceHit });
    }
    return { kind: 'miss', x: s.x, y: s.y, t: s.t, closest, path, fence: s.fenceHit };
  }

  /** lực ném tốt nhất để trúng đầu đối thủ ở góc ang (dò thô 0,01 rồi dò mịn) */
  function solve(from, face, wind, target, big, wall, ang) {
    const score = (p) => {
      const r = simulate(from, face, p, wind, target, { big, wall, ang });
      return (r.kind === 'head' ? 0 : r.kind === 'body' ? 10 : 30) + r.closest;
    };
    let best = 0.5, bs = Infinity;
    for (let p = 0; p <= 1.0001; p += 0.01) { const v = score(p); if (v < bs) { bs = v; best = p; } }
    for (let p = best - 0.01; p <= best + 0.01; p += 0.001) { const v = score(p); if (v < bs) { bs = v; best = p; } }
    return Math.max(0, Math.min(1, best));
  }

  /** sát thương theo chỗ trúng; Ném mạnh ×1,5 */
  function damage(kind, big) {
    const d = DMG[kind] || 0;
    return big ? Math.round(d * 1.5) : d;
  }

  /** gió ngẫu nhiên cho lượt mới: −10..10, càng về sau càng có thể mạnh hơn */
  function newWind(rnd = Math.random, max = 10) {
    const v = Math.round((rnd() * 2 - 1) * max);
    return Math.abs(v) <= 1 && rnd() < 0.5 ? 0 : v;
  }

  /** thanh lực "lên rồi xuống": thời gian giữ t → lực 0..1 (chu kỳ 2·T) */
  function powerAt(t, T) {
    const k = (t / T) % 2;
    return k <= 1 ? k : 2 - k;
  }

  return { GY, G, ANG, ANG_MIN, ANG_MAX, VMIN, VMAX, WIND_ACC, DT, R, R_BIG, FENCE, MAPS, SCALE, DMG, NEAR,
    handOf, bodyOf, launch, step, simulate, solve, damage, newWind, powerAt };
});

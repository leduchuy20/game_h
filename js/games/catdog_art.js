// Hình nhân vật Cat and Dog — vẽ bằng Canvas (nhân vật tự thiết kế cho Tròn Party, không lấy hình game khác).
// CatDogArt.draw(ctx, 'cat'|'dog', { x, y, scale, face: 1 (nhìn phải) | -1 (nhìn trái), pose, t, collar, power, item })
//   pose: idle (đứng chờ) · aim (giữ lực, tay vung ra sau) · throw (vừa ném) · hit (bị trúng, choáng) · ko (nằm bẹp) · win (nhảy mừng)
//   (x, y) = giữa hai bàn chân trên mặt đất; cao ~175 đơn vị khi scale 1.
// CatDogArt.item(ctx, 'fish'|'can'|'bone'|'slipper', x, y, rot, scale) — đồ ném.
(function (root) {
  'use strict';
  const OL = '#3a2a2a';
  const PAL = {
    cat: { body: '#ffb45e', far: '#f29a45', dark: '#e2803a', light: '#fff2df', inner: '#ff9fb4', nose: '#ff6f93', cheek: '#ff8fa8' },
    dog: { body: '#f4d6a6', far: '#e6c08c', dark: '#a8683c', light: '#fffaf0', inner: '#d39a64', nose: '#33272a', cheek: '#ff9fae' },
  };
  const TAU = Math.PI * 2;

  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function fs(ctx, fill, lw = 5) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OL; ctx.stroke(); }
  function line(ctx, pts, lw = 4, col = OL) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  /** tham số dáng theo pose */
  function poseOf(pose, t, power) {
    // arm/arm2 = góc tay trước/sau (0 = buông, dương = ra trước); raise = tay giơ cao vẽ SAU đầu (không che mặt)
    const p = { lean: 0, arm: 0.35, arm2: 0.2, len: 36, len2: 30, raise: false, hop: 0, eyes: 'open', mouth: 'smile', wag: 4, ko: false, stars: false, squash: 1 };
    switch (pose) {
      case 'aim': p.lean = -0.1 - power * 0.06; p.arm = -2.0 - power * 0.35; p.len = 50; p.raise = true; p.arm2 = 0.5; p.eyes = 'focus'; p.mouth = 'flat'; p.wag = 9; break;
      case 'throw': p.lean = 0.17; p.arm = 1.9; p.arm2 = -0.5; p.mouth = 'open'; p.wag = 9; break;
      case 'hit': p.lean = -0.22 + Math.sin(t * 18) * 0.05; p.arm = -0.9; p.arm2 = -1.1; p.eyes = 'dizzy'; p.mouth = 'o'; p.stars = true; p.wag = 0; break;
      case 'ko': p.ko = true; p.eyes = 'x'; p.mouth = 'tongue'; p.arm = 1.2; p.arm2 = 1.4; p.wag = 0; break;
      case 'win': p.hop = Math.abs(Math.sin(t * 6)) * 22; p.arm = 2.0 + Math.sin(t * 12) * 0.15; p.arm2 = -2.0 - Math.sin(t * 12) * 0.15; p.len = p.len2 = 48; p.raise = true; p.eyes = 'happy'; p.mouth = 'open'; p.wag = 16; p.squash = 1 - Math.max(0, 0.06 - p.hop * 0.01); break;
      default: p.squash = 1 + Math.sin(t * 3) * 0.015;
    }
    return p;
  }

  function draw(ctx, kind, o = {}) {
    const P = PAL[kind] || PAL.cat, t = o.t || 0, power = o.power || 0;
    const p = poseOf(o.pose || 'idle', t, power);
    const sc = o.scale || 1, face = o.face || 1;
    ctx.save();
    ctx.translate(o.x || 0, o.y || 0);
    ctx.scale(sc * face, sc);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // bóng dưới chân
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ell(ctx, p.ko ? -40 : 0, 2, p.ko ? 92 : 46 - p.hop * 0.6, 9); ctx.fill();
    if (p.ko) { ctx.translate(36, -40); ctx.rotate(-Math.PI / 2 * 0.96); }
    ctx.translate(0, -p.hop);
    ctx.scale(1, p.squash);
    tail(ctx, kind, P, t, p);
    // chân
    ell(ctx, -18, -8, 17, 10); fs(ctx, P.far);
    ell(ctx, 17, -8, 17, 10); fs(ctx, P.body);
    if (kind === 'dog') { ell(ctx, 26, -10, 6, 4); ctx.fillStyle = P.light; ctx.fill(); }
    // thân trên nghiêng quanh hông
    ctx.save();
    ctx.translate(0, -22); ctx.rotate(p.lean); ctx.translate(0, 22);
    limb(ctx, -10, -68, p.arm2, P.far, p.len2);                  // tay sau
    ell(ctx, 0, -52, 35, 40); fs(ctx, P.body);                   // thân
    ell(ctx, 9, -46, 20, 27); ctx.fillStyle = P.light; ctx.fill(); // bụng
    if (kind === 'cat') {                                         // sọc lưng mèo
      ctx.strokeStyle = P.dark; ctx.lineWidth = 5;
      [[-30, -66, -18, -62], [-33, -50, -20, -48], [-30, -34, -18, -35]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo((a + c) / 2, b - 5, c, d); ctx.stroke(); });
    }
    // tay ném (trước) + đồ cầm trên tay khi đang giữ lực / đứng chờ
    const held = o.item && (o.pose === 'aim' || o.pose === 'idle' || !o.pose) ? o.item : null;
    if (p.raise) limb(ctx, p.arm < 0 ? -12 : 16, -70, p.arm, P.body, p.len, held);   // giơ cao: vẽ sau đầu
    head(ctx, kind, P, t, p);
    collar(ctx, kind, o.collar || '#ff5d73');
    if (!p.raise) limb(ctx, 14, -64, p.arm, P.body, p.len, held);
    if (p.stars) {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + i * TAU / 3;
        star(ctx, 8 + Math.cos(a) * 34, -172 + Math.sin(a) * 9, 8, t * 4); fs(ctx, '#ffd23f', 3);
      }
    }
    ctx.restore();
    ctx.restore();
  }

  function tail(ctx, kind, P, t, p) {
    const w = Math.sin(t * p.wag) * (p.wag ? 1 : 0);
    ctx.beginPath();
    if (kind === 'cat') {
      ctx.moveTo(-26, -34);
      ctx.bezierCurveTo(-74, -40 + w * 4, -70 + w * 10, -104, -50 + w * 14, -122);
    } else {
      ctx.moveTo(-28, -42);
      ctx.quadraticCurveTo(-60 + w * 4, -54, -52 + w * 12, -88);
    }
    ctx.strokeStyle = OL; ctx.lineWidth = kind === 'cat' ? 22 : 24; ctx.stroke();
    ctx.strokeStyle = P.body; ctx.lineWidth = kind === 'cat' ? 12 : 14; ctx.stroke();
    if (kind === 'cat') { ell(ctx, -50 + w * 14, -122, 8, 8); ctx.fillStyle = P.dark; ctx.fill(); }
    else { ell(ctx, -52 + w * 12, -88, 7, 7); ctx.fillStyle = P.light; ctx.fill(); }
  }

  /** tay: vai (sx, sy), góc a (0 = buông thẳng, dương = vung ra trước), dài len */
  function limb(ctx, sx, sy, a, fill, len, item) {
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(-a);
    rrect(ctx, -9, -4, 18, len, 9); fs(ctx, fill);
    ell(ctx, 0, len, 12, 11); fs(ctx, fill);
    if (item) item_(ctx, item, 0, len + 6, Math.PI / 2, 0.8);
    ctx.restore();
  }

  /** vòng cổ dưới cằm (màu người chơi) + chuông (mèo) / thẻ tên (chó) */
  function collar(ctx, kind, col) {
    ctx.beginPath(); ctx.moveTo(-24, -77); ctx.quadraticCurveTo(6, -68, 34, -77); ctx.lineTo(34, -66); ctx.quadraticCurveTo(6, -57, -24, -66); ctx.closePath();
    fs(ctx, col, 4);
    if (kind === 'cat') { ell(ctx, 18, -56, 8, 8); fs(ctx, '#ffd23f', 3.5); line(ctx, [13, -56, 23, -56], 2.5); ell(ctx, 18, -52, 1.6, 1.6); ctx.fillStyle = OL; ctx.fill(); }
    else { ell(ctx, 18, -55, 8, 8); fs(ctx, '#d6e4ee', 3.5); ell(ctx, 18, -55, 3, 3); ctx.fillStyle = '#9fb3c2'; ctx.fill(); }
  }

  function head(ctx, kind, P, t, p) {
    const blink = !['x', 'dizzy', 'happy'].includes(p.eyes) && (t % 3.7) > 3.55;
    if (kind === 'cat') {
      // tai
      [[[-38, -128], [-30, -176], [-4, -152]], [[16, -154], [40, -178], [50, -128]]].forEach((tri) => {
        ctx.beginPath(); tri.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); fs(ctx, P.body);
      });
      [[[-30, -136], [-27, -164], [-12, -150]], [[22, -152], [38, -167], [42, -136]]].forEach((tri) => {
        ctx.beginPath(); tri.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fillStyle = P.inner; ctx.fill();
      });
      ell(ctx, 6, -116, 54, 45); fs(ctx, P.body);
      // sọc trán
      ctx.strokeStyle = P.dark; ctx.lineWidth = 5;
      [[-6, -158, -4, -146], [7, -160, 7, -148], [20, -158, 18, -146]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); });
      ell(ctx, 16, -97, 24, 15); ctx.fillStyle = P.light; ctx.fill();
      cheeks(ctx, P, -18, 52, -100);
      eyes(ctx, -4, 34, -118, p.eyes, blink);
      // mũi + miệng
      ctx.beginPath(); ctx.moveTo(10, -106); ctx.lineTo(22, -106); ctx.lineTo(16, -99); ctx.closePath(); fs(ctx, P.nose, 3);
      mouth(ctx, 16, -97, p.mouth, 'cat');
      // ria
      ctx.lineWidth = 2.5; ctx.strokeStyle = OL;
      [[40, -102, 66, -108], [41, -97, 68, -97], [40, -92, 65, -85], [-8, -102, -32, -108], [-9, -97, -35, -97], [-8, -92, -31, -85]]
        .forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); });
    } else {
      const flop = Math.sin(t * 4) * 0.06 + (p.eyes === 'happy' ? Math.sin(t * 12) * 0.12 : 0);
      ell(ctx, -42, -102, 14, 31, 0.5 + flop); fs(ctx, P.dark);    // tai sau
      ell(ctx, 6, -114, 52, 45); fs(ctx, P.body);
      ell(ctx, 32, -122, 17, 16); ctx.fillStyle = P.inner; ctx.fill();   // đốm quanh mắt
      ell(ctx, 20, -96, 27, 18); fs(ctx, P.light, 4);                   // mõm
      cheeks(ctx, P, -16, 54, -98);
      eyes(ctx, -2, 34, -120, p.eyes, blink);
      ell(ctx, 58, -102, 14, 31, -0.5 - flop); fs(ctx, P.dark);     // tai trước
      ell(ctx, 26, -104, 10, 7.5); fs(ctx, P.nose, 3);               // mũi
      ell(ctx, 23, -106.5, 3.5, 2); ctx.fillStyle = '#fff'; ctx.fill();
      line(ctx, [26, -97, 26, -92], 3);
      mouth(ctx, 26, -92, p.mouth, 'dog');
    }
  }

  function cheeks(ctx, P, x1, x2, y) {
    ctx.globalAlpha = 0.5; ctx.fillStyle = P.cheek;
    ell(ctx, x1, y, 9, 6); ctx.fill(); ell(ctx, x2, y, 9, 6); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function eyes(ctx, x1, x2, y, type, blink) {
    for (const x of [x1, x2]) {
      if (type === 'x') { line(ctx, [x - 7, y - 7, x + 7, y + 7], 4); line(ctx, [x + 7, y - 7, x - 7, y + 7], 4); continue; }
      if (type === 'happy') { ctx.beginPath(); ctx.arc(x, y + 4, 8, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 4.5; ctx.strokeStyle = OL; ctx.stroke(); continue; }
      if (type === 'dizzy') {
        ctx.beginPath();
        for (let k = 0; k < 26; k++) { const a = k * 0.5, r = 1 + k * 0.32; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
        ctx.lineWidth = 3; ctx.strokeStyle = OL; ctx.stroke(); continue;
      }
      if (blink) { line(ctx, [x - 8, y + 2, x + 8, y + 2], 4); continue; }
      ell(ctx, x, y, 8.5, 11.5); ctx.fillStyle = '#2b2233'; ctx.fill();
      ell(ctx, x - 2.5, y - 4.5, 3.6, 3.6); ctx.fillStyle = '#fff'; ctx.fill();
      ell(ctx, x + 3, y + 3.5, 1.6, 1.6); ctx.fill();
      if (type === 'focus') line(ctx, [x - 10, y - 18 + (x === x1 ? -3 : 3), x + 9, y - 16 + (x === x1 ? 3 : -3)], 4);
    }
  }

  function mouth(ctx, x, y, type, kind) {
    ctx.lineWidth = 3; ctx.strokeStyle = OL;
    if (type === 'open' || type === 'o') {
      const big = type === 'open';
      ell(ctx, x, y + (big ? 7 : 6), big ? 10 : 6, big ? 9 : 6); ctx.fillStyle = '#7a2f3a'; ctx.fill(); ctx.stroke();
      if (big) { ell(ctx, x, y + 12, 6, 3.5); ctx.fillStyle = '#ff7f9e'; ctx.fill(); }
      return;
    }
    if (type === 'flat') { line(ctx, [x - 6, y + 4, x + 6, y + 4], 3); return; }
    // cười: mèo "ω", chó cong
    ctx.beginPath();
    if (kind === 'cat') { ctx.arc(x - 5, y, 5, 0, Math.PI); ctx.moveTo(x + 10, y); ctx.arc(x + 5, y, 5, 0, Math.PI); }
    else { ctx.arc(x - 6, y, 6, 0.1, Math.PI - 0.3); ctx.moveTo(x + 12, y); ctx.arc(x + 6, y, 6, 0, Math.PI - 0.2); }
    ctx.stroke();
    if (type === 'tongue' || (kind === 'dog' && type === 'smile')) {
      rrect(ctx, x - 5, y + 3, 10, 12, 5); ctx.fillStyle = '#ff7f9e'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      line(ctx, [x, y + 6, x, y + 11], 1.5, '#d24f73');
    }
  }

  /* ---------- đồ ném ---------- */
  function item_(ctx, type, x, y, rot = 0, s = 1) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (type === 'fish') {
      // xương cá: đầu, xương sống, sườn, đuôi
      line(ctx, [-20, 0, 18, 0], 9); line(ctx, [-20, 0, 18, 0], 4, '#f4f7fb');
      for (const xx of [-12, -3, 6]) { line(ctx, [xx, -11, xx + 3, 11], 7); line(ctx, [xx, -11, xx + 3, 11], 3, '#f4f7fb'); }
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-34, -11); ctx.lineTo(-30, 0); ctx.lineTo(-34, 11); ctx.closePath(); fs(ctx, '#f4f7fb', 3.5);
      ctx.beginPath(); ctx.moveTo(14, -12); ctx.quadraticCurveTo(36, -10, 36, 0); ctx.quadraticCurveTo(36, 10, 14, 12); ctx.closePath(); fs(ctx, '#f4f7fb', 3.5);
      ell(ctx, 26, -3, 2.6, 2.6); ctx.fillStyle = OL; ctx.fill();
    } else if (type === 'can') {
      rrect(ctx, -14, -18, 28, 36, 6); fs(ctx, '#b9c6d3', 3.5);
      rrect(ctx, -14, -8, 28, 16, 2); ctx.fillStyle = '#4fa3ff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-1, -6, 6, 0); ctx.quadraticCurveTo(-1, 6, -8, 0); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
      line(ctx, [-14, -12, 14, -12], 2); line(ctx, [-14, 12, 14, 12], 2);
    } else if (type === 'bone') {
      rrect(ctx, -20, -6, 40, 12, 5); fs(ctx, '#fff6e2', 3.5);
      for (const [cx, cy] of [[-22, -7], [-22, 7], [22, -7], [22, 7]]) { ell(ctx, cx, cy, 8, 8); fs(ctx, '#fff6e2', 3.5); }
      rrect(ctx, -20, -5, 40, 10, 4); ctx.fillStyle = '#fff6e2'; ctx.fill();
    } else if (type === 'slipper') {
      ctx.beginPath(); ctx.ellipse(0, 0, 26, 11, 0, 0, TAU); fs(ctx, '#7ec8a8', 3.5);
      ctx.beginPath(); ctx.moveTo(-2, -9); ctx.quadraticCurveTo(10, -22, 22, -6); ctx.lineWidth = 7; ctx.strokeStyle = OL; ctx.stroke();
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#ff8a5c'; ctx.stroke();
    }
    ctx.restore();
  }

  root.CatDogArt = { draw, item: item_, PAL };
})(typeof window !== 'undefined' ? window : globalThis);

// Tranh cho Jigsaw Puzzle — 8 cảnh tự vẽ bằng Canvas (không dùng ảnh / nhân vật của thương hiệu khác).
// JigsawArt.list = [{ id, name, icon }]; JigsawArt.paint(id, ctx, w, h) vẽ cảnh vào khung w×h (luôn ra cùng một hình: ngẫu nhiên có hạt giống).
// Cảnh "Làng Tròn" dùng nhân vật Tròn của game (Draw.blob), cảnh "Mèo và Chó" dùng CatDogArt — đều là nhân vật tự thiết kế.
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const LIST = [
    { id: 'garden', name: 'Vườn hoa', icon: '🌷' },
    { id: 'ocean', name: 'Đáy biển', icon: '🐠' },
    { id: 'city', name: 'Phố đêm', icon: '🌃' },
    { id: 'space', name: 'Vũ trụ', icon: '🪐' },
    { id: 'village', name: 'Làng Tròn', icon: '🏡' },
    { id: 'catdog', name: 'Mèo và Chó', icon: '🐱' },
    { id: 'candy', name: 'Xứ kẹo', icon: '🍭' },
    { id: 'sunset', name: 'Hoàng hôn biển', icon: '🌅' },
    { id: 'autumn', name: 'Rừng thu', icon: '🍁' },
    { id: 'lantern', name: 'Phố đèn lồng', icon: '🏮' },
    { id: 'farm', name: 'Nông trại', icon: '🐄' },
    { id: 'snow', name: 'Làng tuyết', icon: '⛄' },
  ];

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /* ---------- tiện ích vẽ ---------- */
  function grad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach((c, k) => g.addColorStop(k / (stops.length - 1), c));
    return g;
  }
  function circle(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function ell(ctx, x, y, rx, ry, fill, a = 0) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, a, 0, TAU); ctx.fill(); }
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function rect(ctx, x, y, w, h, fill, r = 0) {
    ctx.fillStyle = fill;
    if (!r) { ctx.fillRect(x, y, w, h); return; }
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  function cloud(ctx, x, y, s, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.arc(x, y, 26 * s, 0, TAU); ctx.arc(x + 32 * s, y - 14 * s, 34 * s, 0, TAU); ctx.arc(x + 68 * s, y, 26 * s, 0, TAU);
    ctx.arc(x + 34 * s, y + 8 * s, 28 * s, 0, TAU); ctx.fill();
  }
  /** dãy đồi lượn: đường nối điểm ngẫu nhiên quanh mức y */
  function hills(ctx, R, y, amp, n, fill, bottom = 720) {
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(0, bottom);
    let px = 0, py = y + (R() - 0.5) * amp;
    ctx.lineTo(px, py);
    for (let k = 1; k <= n; k++) {
      const x = (1280 / n) * k, yy = y + (R() - 0.5) * amp;
      ctx.quadraticCurveTo((px + x) / 2, Math.min(py, yy) - amp * 0.35, x, yy);
      px = x; py = yy;
    }
    ctx.lineTo(1280, bottom); ctx.closePath(); ctx.fill();
  }
  function star5(ctx, x, y, r, fill, rot = 0) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = rot - Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  function flower(ctx, x, y, r, petal, mid, n = 5, rot = 0) {
    for (let k = 0; k < n; k++) {
      const a = rot + k * TAU / n;
      ell(ctx, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.62, r * 0.4, petal, a);
    }
    circle(ctx, x, y, r * 0.42, mid);
  }
  function tree(ctx, x, y, s, leaf, leaf2, trunk = '#7a4b2a') {
    rect(ctx, x - 8 * s, y - 60 * s, 16 * s, 60 * s, trunk, 4 * s);
    circle(ctx, x, y - 95 * s, 44 * s, leaf);
    circle(ctx, x - 30 * s, y - 70 * s, 30 * s, leaf);
    circle(ctx, x + 30 * s, y - 72 * s, 32 * s, leaf);
    circle(ctx, x + 10 * s, y - 108 * s, 24 * s, leaf2);
    circle(ctx, x - 18 * s, y - 88 * s, 14 * s, leaf2);
  }
  function house(ctx, x, y, w, h, wall, roof, door = '#7a4b2a') {
    rect(ctx, x, y - h, w, h, wall);
    poly(ctx, [[x - 12, y - h + 4], [x + w / 2, y - h - w * 0.55], [x + w + 12, y - h + 4]], roof);
    rect(ctx, x + w * 0.4, y - h * 0.48, w * 0.22, h * 0.48, door, 6);
    rect(ctx, x + w * 0.1, y - h * 0.78, w * 0.22, h * 0.22, '#bfe7ff', 3);
    rect(ctx, x + w * 0.68, y - h * 0.78, w * 0.22, h * 0.22, '#bfe7ff', 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(x, y - h, w, h);
  }
  function fish(ctx, x, y, s, body, fin, face = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(face * s, s);
    poly(ctx, [[-30, 0], [-52, -16], [-52, 16]], fin);
    ell(ctx, 0, 0, 36, 22, body);
    poly(ctx, [[-6, -18], [10, -32], [18, -16]], fin);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-4, 4, 6, 16, 0, 0, TAU); ctx.fill();
    circle(ctx, 20, -5, 6, '#fff'); circle(ctx, 22, -5, 3, '#1b1b2a');
    ctx.restore();
  }

  /* ---------- các cảnh (hệ toạ độ 1280×720) ---------- */
  const SCENES = {
    garden(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 420, ['#6fc3ff', '#bfe6ff', '#fff4d6']); ctx.fillRect(0, 0, 1280, 720);
      circle(ctx, 1090, 120, 70, '#fff1a8'); circle(ctx, 1090, 120, 52, '#ffd84d');
      for (let k = 0; k < 12; k++) { const a = k * TAU / 12; ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(1090 + Math.cos(a) * 82, 120 + Math.sin(a) * 82); ctx.lineTo(1090 + Math.cos(a) * 104, 120 + Math.sin(a) * 104); ctx.stroke(); }
      cloud(ctx, 120, 110, 1.2, '#ffffff'); cloud(ctx, 460, 70, 0.9, '#f4fbff'); cloud(ctx, 760, 140, 1.1, '#ffffff');
      hills(ctx, R, 360, 90, 5, '#9fd88a'); hills(ctx, R, 420, 70, 6, '#7cc66a');
      house(ctx, 860, 430, 170, 120, '#ffe1c2', '#e2574c');
      // hàng rào trắng
      for (let x = -10; x < 1290; x += 34) { poly(ctx, [[x, 520], [x, 470], [x + 11, 456], [x + 22, 470], [x + 22, 520]], '#fffaf0', '#c9b9a0', 2); }
      rect(ctx, 0, 482, 1280, 9, '#efe3cc'); rect(ctx, 0, 506, 1280, 9, '#efe3cc');
      tree(ctx, 150, 470, 1.15, '#4fae4a', '#7ed36b'); tree(ctx, 1210, 470, 0.95, '#3f9a42', '#6cc65d');
      rect(ctx, 0, 515, 1280, 205, '#5fb84f');
      // luống hoa nhiều màu, từ xa tới gần
      const pal = [['#ff6b8b', '#ffd23f'], ['#ffb347', '#a3402a'], ['#b388ff', '#fff3a0'], ['#ffffff', '#ffc531'], ['#ff4f6d', '#2b2240'], ['#6fd3ff', '#ffe066'], ['#ff8fe0', '#ffe066']];
      for (let row = 0; row < 6; row++) {
        const y = 540 + row * 34, r = 9 + row * 3.2, step = 30 + row * 9;
        for (let x = -20 + R() * 20; x < 1300; x += step + R() * 12) {
          const p = pal[Math.floor(R() * pal.length)];
          ctx.strokeStyle = '#2f8a35'; ctx.lineWidth = 2 + row * 0.4; ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x + (R() - 0.5) * 6, y + r * 2.4); ctx.stroke();
          ell(ctx, x + r * 0.7, y + r * 1.7, r * 0.55, r * 0.25, '#3fa23a', -0.5);
          flower(ctx, x, y + (R() - 0.5) * 8, r, p[0], p[1], R() < 0.5 ? 5 : 6, R() * TAU);
        }
      }
      // bướm
      for (let k = 0; k < 6; k++) {
        const x = 200 + R() * 900, y = 250 + R() * 200, c = ['#ff7ac3', '#ffd23f', '#8ad6ff', '#c49bff'][k % 4];
        ell(ctx, x - 9, y - 6, 10, 7, c, -0.5); ell(ctx, x + 9, y - 6, 10, 7, c, 0.5); ell(ctx, x - 7, y + 6, 7, 5, c, 0.4); ell(ctx, x + 7, y + 6, 7, 5, c, -0.4);
        rect(ctx, x - 1.5, y - 9, 3, 18, '#2b2240', 1.5);
      }
    },

    ocean(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 720, ['#44c7f0', '#1c88c9', '#0f4f8f', '#0a2f5c']); ctx.fillRect(0, 0, 1280, 720);
      // tia nắng
      ctx.save(); ctx.globalAlpha = 0.13;
      for (let k = 0; k < 7; k++) { const x = 100 + k * 190; poly(ctx, [[x, 0], [x + 70, 0], [x + 220, 720], [x + 90, 720]], '#ffffff'); }
      ctx.restore();
      // cát
      ctx.fillStyle = '#e8c98a'; ctx.beginPath(); ctx.moveTo(0, 720); ctx.lineTo(0, 600);
      for (let x = 0; x <= 1280; x += 80) ctx.quadraticCurveTo(x + 40, 580 + R() * 30, x + 80, 600 + R() * 20);
      ctx.lineTo(1280, 720); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 90; k++) circle(ctx, R() * 1280, 620 + R() * 100, 2 + R() * 2, 'rgba(160,120,60,0.35)');
      // rong biển
      for (let k = 0; k < 14; k++) {
        const x = 30 + k * 92 + R() * 30, hgt = 140 + R() * 200;
        ctx.strokeStyle = k % 2 ? '#2fae6a' : '#1f8c55'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, 640);
        for (let y = 640; y > 640 - hgt; y -= 20) ctx.lineTo(x + Math.sin(y / 30 + k) * 14, y);
        ctx.stroke();
      }
      // san hô
      const coral = (x, y, c, s) => {
        ctx.strokeStyle = c; ctx.lineCap = 'round';
        const br = (x0, y0, a, len, w, d) => {
          if (d === 0) return;
          const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
          ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          circle(ctx, x1, y1, w * 0.55, c);
          br(x1, y1, a - 0.5 - R() * 0.3, len * 0.72, w * 0.72, d - 1); br(x1, y1, a + 0.5 + R() * 0.3, len * 0.72, w * 0.72, d - 1);
        };
        br(x, y, -Math.PI / 2, 60 * s, 18 * s, 4);
      };
      coral(170, 660, '#ff6f91', 1.2); coral(520, 670, '#ffa64d', 0.9); coral(890, 665, '#c77dff', 1.1); coral(1170, 670, '#ff4f6d', 1);
      // rương báu + sao biển + vỏ ốc
      rect(ctx, 640, 600, 130, 76, '#8a5a2b', 8); rect(ctx, 640, 576, 130, 34, '#a8703f', 12); rect(ctx, 698, 596, 16, 22, '#ffd23f', 3);
      for (let k = 0; k < 8; k++) circle(ctx, 655 + k * 15, 580, 7, '#ffd84d');
      star5(ctx, 380, 680, 26, '#ff8a3d', 0.3); star5(ctx, 1040, 690, 20, '#ffd23f', -0.2);
      // cá
      const fc = [['#ffd23f', '#ff8a3d'], ['#ff6b8b', '#c2185b'], ['#6fd3ff', '#1e6fd9'], ['#b8f27c', '#3fa23a'], ['#ffffff', '#ff8a3d'], ['#c49bff', '#6a37c0']];
      for (let k = 0; k < 14; k++) {
        const c = fc[k % fc.length];
        fish(ctx, 80 + R() * 1120, 80 + R() * 420, 0.6 + R() * 0.8, c[0], c[1], R() < 0.5 ? 1 : -1);
      }
      // rùa
      ctx.save(); ctx.translate(1000, 230);
      ell(ctx, 0, 0, 78, 52, '#3f9a5c'); ell(ctx, 0, -4, 66, 42, '#5cc47a');
      for (const [x, y] of [[-25, -10], [10, -16], [30, 8], [-6, 14]]) circle(ctx, x, y, 12, '#3f9a5c');
      circle(ctx, 88, -12, 22, '#7fd394'); circle(ctx, 96, -18, 4, '#1b1b2a');
      ell(ctx, -60, 40, 30, 12, '#7fd394', 0.5); ell(ctx, 50, 44, 30, 12, '#7fd394', -0.5); ell(ctx, -50, -44, 26, 10, '#7fd394', -0.4);
      ctx.restore();
      // bọt khí
      for (let k = 0; k < 40; k++) { const r = 3 + R() * 10; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(R() * 1280, R() * 560, r, 0, TAU); ctx.stroke(); }
    },

    city(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 520, ['#1a1446', '#3b2a7a', '#a24a8f', '#ff9a6b']); ctx.fillRect(0, 0, 1280, 720);
      for (let k = 0; k < 120; k++) circle(ctx, R() * 1280, R() * 300, R() * 1.8 + 0.4, `rgba(255,255,255,${0.4 + R() * 0.6})`);
      circle(ctx, 1080, 110, 54, '#fff4d6'); circle(ctx, 1100, 96, 46, '#3b2a7a');
      // dãy nhà xa (tối) và gần (có cửa sổ sáng màu)
      const sky = (layer) => {
        let x = -20;
        while (x < 1290) {
          const w = 60 + R() * 90, h = (layer ? 160 : 230) + R() * (layer ? 200 : 170), top = 520 - h;
          rect(ctx, x, top, w, h, layer ? '#2a2058' : '#1d1640');
          if (layer) {
            const wc = ['#ffd86b', '#ffe9a8', '#ff9f6b', '#9fe8ff', '#ffb3e6'][Math.floor(R() * 5)];
            for (let y = top + 14; y < 500; y += 22) for (let xx = x + 10; xx < x + w - 14; xx += 18) if (R() < 0.62) rect(ctx, xx, y, 10, 12, wc);
            if (R() < 0.4) { rect(ctx, x + w / 2 - 2, top - 30, 4, 30, '#2a2058'); circle(ctx, x + w / 2, top - 32, 5, '#ff4f6d'); }
          }
          x += w + (layer ? 6 : -10);
        }
      };
      sky(0); sky(1);
      // sông + phản chiếu
      ctx.fillStyle = grad(ctx, 520, 720, ['#2b2a6a', '#120d33']); ctx.fillRect(0, 520, 1280, 200);
      for (let k = 0; k < 160; k++) { const x = R() * 1280, y = 530 + R() * 180; rect(ctx, x, y, 14 + R() * 30, 3, ['rgba(255,216,107,0.5)', 'rgba(255,159,107,0.45)', 'rgba(159,232,255,0.4)'][k % 3]); }
      // cầu dây văng có đèn
      ctx.strokeStyle = '#d9d2ff'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-10, 560); ctx.quadraticCurveTo(640, 520, 1290, 560); ctx.stroke();
      for (const px of [330, 950]) {
        rect(ctx, px - 10, 330, 20, 240, '#c9c0ff');
        ctx.strokeStyle = 'rgba(217,210,255,0.8)'; ctx.lineWidth = 2;
        for (let k = 1; k <= 7; k++) { ctx.beginPath(); ctx.moveTo(px, 340); ctx.lineTo(px - k * 40, 556 - k); ctx.moveTo(px, 340); ctx.lineTo(px + k * 40, 548 - k); ctx.stroke(); }
      }
      for (let x = 10; x < 1280; x += 40) circle(ctx, x, 548 + Math.abs(x - 640) * 0.04, 4, ['#ffd86b', '#ff6b8b', '#6fd3ff'][Math.floor(x / 40) % 3]);
      // thuyền nhỏ
      poly(ctx, [[180, 640], [300, 640], [280, 664], [200, 664]], '#ff6b8b'); rect(ctx, 236, 600, 4, 40, '#fff'); poly(ctx, [[240, 602], [276, 632], [240, 632]], '#fff4d6');
      poly(ctx, [[900, 660], [1040, 660], [1016, 688], [924, 688]], '#ffd23f'); rect(ctx, 940, 636, 70, 24, '#fff', 4);
    },

    space(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 720, ['#07051a', '#1b0f3d', '#2a0f4f', '#0b0624']); ctx.fillRect(0, 0, 1280, 720);
      // tinh vân
      for (const [x, y, r, c] of [[320, 260, 300, 'rgba(255,79,160,0.18)'], [900, 420, 340, 'rgba(80,140,255,0.2)'], [640, 120, 220, 'rgba(160,90,255,0.2)'], [1100, 120, 200, 'rgba(60,220,200,0.14)']]) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let k = 0; k < 260; k++) circle(ctx, R() * 1280, R() * 720, R() * 1.8 + 0.3, `rgba(255,255,255,${0.3 + R() * 0.7})`);
      for (let k = 0; k < 10; k++) star5(ctx, R() * 1280, R() * 720, 5 + R() * 6, ['#fff6b0', '#b8e1ff', '#ffc4f0'][k % 3], R());
      // hành tinh vòng
      const planet = (x, y, r, a, b, ring) => {
        const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, a); g.addColorStop(1, b);
        if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.5, -0.3, Math.PI, TAU); ctx.stroke(); }
        circle(ctx, x, y, r, g);
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
        for (let k = -3; k <= 3; k++) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x - r, y + k * r * 0.28, r * 2, r * 0.1); }
        ctx.restore();
        if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.5, -0.3, 0, Math.PI); ctx.stroke(); }
      };
      planet(980, 230, 120, '#ffcf8a', '#c4572e', 'rgba(255,220,170,0.75)');
      planet(260, 520, 90, '#8fe3ff', '#2453b8', null);
      planet(560, 140, 44, '#c9ff9e', '#3c9a46', 'rgba(220,255,200,0.6)');
      planet(1180, 600, 60, '#ffb3e6', '#a0337a', null);
      // mặt trăng có hố
      circle(ctx, 120, 120, 56, '#e6e2f0'); for (const [x, y, r] of [[100, 100, 12], [140, 130, 9], [110, 145, 7], [150, 95, 6]]) circle(ctx, x, y, r, '#c8c2da');
      // tên lửa
      ctx.save(); ctx.translate(640, 440); ctx.rotate(-0.5);
      poly(ctx, [[-20, 70], [0, 120], [20, 70]], '#ffb23f'); poly(ctx, [[-12, 70], [0, 100], [12, 70]], '#fff2a0');
      rect(ctx, -30, -60, 60, 130, '#f4f0ff', 26); poly(ctx, [[-30, -40], [0, -110], [30, -40]], '#ff4f6d');
      poly(ctx, [[-30, 30], [-56, 76], [-30, 66]], '#ff4f6d'); poly(ctx, [[30, 30], [56, 76], [30, 66]], '#ff4f6d');
      circle(ctx, 0, -12, 16, '#5ec8ff'); circle(ctx, 0, -12, 11, '#bfeaff');
      ctx.restore();
      // sao chổi
      ctx.save(); ctx.globalAlpha = 0.85;
      const cg = ctx.createLinearGradient(80, 330, 300, 250); cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(180,240,255,0.9)');
      poly(ctx, [[80, 340], [300, 240], [306, 258]], cg); circle(ctx, 304, 248, 10, '#e8fbff');
      ctx.restore();
    },

    village(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 400, ['#7fd0ff', '#d6f1ff']); ctx.fillRect(0, 0, 1280, 720);
      cloud(ctx, 200, 90, 1, '#fff'); cloud(ctx, 700, 60, 1.3, '#fff'); cloud(ctx, 1040, 120, 0.9, '#fff');
      // khinh khí cầu
      const balloon = (x, y, s, a, b) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
        ctx.beginPath(); ctx.ellipse(0, 0, 50, 60, 0, 0, TAU); ctx.clip();
        for (let k = -3; k < 3; k++) rect(ctx, k * 20, -70, 20, 140, k % 2 ? a : b);
        ctx.restore(); ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
        ctx.strokeStyle = '#6e4423'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, 46); ctx.lineTo(-14, 84); ctx.moveTo(30, 46); ctx.lineTo(14, 84); ctx.stroke();
        rect(ctx, -16, 84, 32, 22, '#b0784a', 4); ctx.restore();
      };
      balloon(1120, 210, 1, '#ff6b8b', '#ffd23f'); balloon(420, 160, 0.6, '#6fd3ff', '#ffffff');
      hills(ctx, R, 330, 80, 4, '#a8e08f'); hills(ctx, R, 390, 60, 6, '#86cf6f');
      // ao
      ell(ctx, 980, 600, 230, 70, '#5ec8ff'); ell(ctx, 980, 596, 200, 54, '#8fe0ff');
      for (let k = 0; k < 5; k++) ell(ctx, 860 + k * 60, 600 + (k % 2) * 16, 18, 8, '#4caf50');
      // nhà nhiều màu
      const hc = [['#ffe1c2', '#e2574c'], ['#d6f5ff', '#3b82f6'], ['#fff3a0', '#ff8a3d'], ['#f2dcff', '#8b5cf6'], ['#ffd6e5', '#22c7c0']];
      for (let k = 0; k < 5; k++) house(ctx, 40 + k * 150, 440 - (k % 2) * 18, 120, 90 + (k % 3) * 14, hc[k][0], hc[k][1]);
      tree(ctx, 800, 440, 0.9, '#3f9a42', '#6cc65d'); tree(ctx, 1220, 450, 1.1, '#4fae4a', '#7ed36b');
      rect(ctx, 0, 440, 1280, 280, '#6cc25a');
      // đường đất
      ctx.fillStyle = '#e3c48f'; ctx.beginPath(); ctx.moveTo(0, 520); ctx.quadraticCurveTo(400, 480, 640, 560); ctx.quadraticCurveTo(820, 620, 760, 720); ctx.lineTo(560, 720); ctx.quadraticCurveTo(620, 610, 460, 580); ctx.quadraticCurveTo(250, 540, 0, 580); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 60; k++) flower(ctx, R() * 1280, 470 + R() * 240, 5 + R() * 4, ['#ff6b8b', '#ffd23f', '#ffffff', '#b388ff'][k % 4], '#fff3a0', 5, R() * TAU);
      // nhân vật Tròn của game
      if (typeof Draw !== 'undefined' && typeof COLOR_CHOICES !== 'undefined') {
        const spots = [[180, 560, 0], [330, 600, 0.3], [520, 640, -0.4], [700, 560, 3.1], [1100, 660, 2.6], [880, 690, -2.5], [420, 520, 1.6]];
        spots.forEach(([x, y, f], k) => Draw.blob(ctx, { x, y, r: 30 + (k % 3) * 4, color: COLOR_CHOICES[k % COLOR_CHOICES.length], face: f, walk: k }));
      } else for (let k = 0; k < 6; k++) circle(ctx, 180 + k * 150, 600, 30, ['#ff6b8b', '#4fb3ff', '#ffd23f', '#5ddc7a', '#a66bff', '#ff8a3d'][k]);
    },

    catdog(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 520, ['#7cc8ff', '#dff3ff']); ctx.fillRect(0, 0, 1280, 720);
      circle(ctx, 1130, 110, 52, '#fff3b0');
      cloud(ctx, 160, 100, 1.1, '#fff'); cloud(ctx, 560, 70, 0.9, '#fff'); cloud(ctx, 820, 150, 1, '#fff');
      hills(ctx, R, 470, 70, 5, '#a6dd8f');
      // nhà Mèo + chuồng Chó
      house(ctx, 40, 560, 150, 130, '#ffb3c7', '#d9577a');
      rect(ctx, 1060, 470, 170, 110, '#e09a54'); poly(ctx, [[1044, 476], [1145, 400], [1246, 476]], '#c0392b');
      ctx.fillStyle = '#3a2a2a'; ctx.beginPath(); ctx.moveTo(1112, 580); ctx.lineTo(1112, 530); ctx.arc(1145, 530, 33, Math.PI, 0); ctx.lineTo(1178, 580); ctx.closePath(); ctx.fill();
      rect(ctx, 0, 560, 1280, 160, '#6cc25a');
      for (let x = 6; x < 1280; x += 26) poly(ctx, [[x, 562], [x + 5, 548], [x + 10, 562]], '#4e9a40');
      // hàng rào gỗ giữa
      for (let n = 0; n < 3; n++) poly(ctx, [[618 + n * 15, 580], [618 + n * 15, 330], [625 + n * 15, 316], [632 + n * 15, 330], [632 + n * 15, 580]], n % 2 ? '#c98d55' : '#d9a066', '#7a4e2a', 2.5);
      rect(ctx, 606, 390, 66, 12, '#a8703f'); rect(ctx, 606, 500, 66, 12, '#a8703f');
      // hoa + bóng + đồ chơi
      for (let k = 0; k < 40; k++) flower(ctx, R() * 1280, 590 + R() * 120, 6 + R() * 5, ['#ff6b8b', '#ffd23f', '#ffffff', '#b388ff', '#ff8a3d'][k % 5], '#fff3a0', 5, R() * TAU);
      circle(ctx, 470, 640, 26, '#ff4f6d'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(470, 640, 26, 0.3, 2.2); ctx.stroke();
      if (typeof CatDogArt !== 'undefined') {
        CatDogArt.draw(ctx, 'cat', { x: 330, y: 640, scale: 1.35, face: 1, pose: 'win', t: 0.6, collar: '#4fb3ff' });
        CatDogArt.draw(ctx, 'dog', { x: 900, y: 640, scale: 1.35, face: -1, pose: 'idle', t: 1.3, collar: '#ff6b8b' });
        CatDogArt.item(ctx, 'fish', 760, 300, -0.6, 1.4);
        CatDogArt.item(ctx, 'bone', 520, 250, 0.5, 1.4);
      } else { circle(ctx, 330, 560, 70, '#ff9f43'); circle(ctx, 900, 560, 70, '#d9b38c'); }
      // bướm
      for (let k = 0; k < 4; k++) { const x = 200 + k * 260, y = 220 + (k % 2) * 80, c = ['#ff7ac3', '#ffd23f', '#8ad6ff', '#c49bff'][k]; ell(ctx, x - 8, y, 9, 7, c, -0.5); ell(ctx, x + 8, y, 9, 7, c, 0.5); rect(ctx, x - 1.5, y - 7, 3, 14, '#2b2240'); }
    },

    candy(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 720, ['#ffd6f1', '#e4d1ff', '#cdeaff']); ctx.fillRect(0, 0, 1280, 720);
      // cầu vồng
      const rb = ['#ff6b8b', '#ffa94d', '#ffe066', '#7ee081', '#6fd3ff', '#b388ff'];
      rb.forEach((c, k) => { ctx.strokeStyle = c; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(640, 560, 460 - k * 22, Math.PI, TAU); ctx.stroke(); });
      cloud(ctx, 120, 470, 1.4, '#fff'); cloud(ctx, 1050, 470, 1.4, '#fff');
      // núi kem
      const scoop = (x, y, r, c) => { circle(ctx, x, y, r, c); for (let k = 0; k < 6; k++) circle(ctx, x - r + k * r * 0.4, y + r * 0.5, r * 0.28, c); };
      poly(ctx, [[160, 720], [260, 470], [360, 720]], '#e8b96a'); scoop(260, 450, 70, '#ffb3d1'); scoop(260, 390, 52, '#c6f5d5'); circle(ctx, 266, 336, 14, '#ff4f6d');
      poly(ctx, [[940, 720], [1060, 430], [1180, 720]], '#e8b96a'); scoop(1060, 410, 80, '#fff1a8'); scoop(1060, 340, 60, '#c9b3ff'); circle(ctx, 1066, 280, 15, '#ff4f6d');
      rect(ctx, 0, 600, 1280, 120, '#ffc4e1');
      for (let k = 0; k < 40; k++) rect(ctx, R() * 1280, 610 + R() * 100, 14, 5, ['#ff6b8b', '#6fd3ff', '#ffe066', '#7ee081', '#b388ff'][k % 5], 2);
      // kẹo gậy
      const cane = (x, y, h) => {
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.arc(x + 30, y - h, 30, Math.PI, TAU); ctx.stroke();
        ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 22; ctx.setLineDash([16, 16]); ctx.stroke(); ctx.setLineDash([]);
      };
      cane(470, 640, 170); cane(800, 650, 210);
      // kẹo mút
      const lolly = (x, y, r, cs) => {
        rect(ctx, x - 5, y, 10, 150, '#fff', 4);
        cs.forEach((c, k) => circle(ctx, x, y, r - k * r / cs.length, c));
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 6; ctx.beginPath();
        for (let a = 0; a < 5.5 * Math.PI; a += 0.2) ctx.lineTo(x + Math.cos(a) * a * r / 18, y + Math.sin(a) * a * r / 18);
        ctx.stroke();
      };
      lolly(600, 470, 64, ['#ff6b8b', '#ffb3d1', '#ff6b8b', '#ffffff']); lolly(160, 560, 46, ['#6fd3ff', '#c4f0ff', '#6fd3ff']); lolly(1210, 540, 50, ['#7ee081', '#d9ffd0', '#7ee081']);
      // bánh cupcake
      const cup = (x, y, top) => {
        poly(ctx, [[x - 46, y - 50], [x + 46, y - 50], [x + 34, y], [x - 34, y]], '#ffb347');
        for (let k = -3; k <= 3; k++) rect(ctx, x + k * 12 - 2, y - 48, 4, 46, 'rgba(160,80,20,0.3)');
        circle(ctx, x - 26, y - 62, 24, top); circle(ctx, x + 26, y - 62, 24, top); circle(ctx, x, y - 82, 30, top);
        circle(ctx, x, y - 116, 12, '#ff3b5c');
        for (let k = 0; k < 8; k++) rect(ctx, x - 30 + R() * 60, y - 100 + R() * 40, 9, 4, ['#6fd3ff', '#ffe066', '#7ee081'][k % 3], 2);
      };
      cup(380, 700, '#fff0f8'); cup(700, 712, '#c9b3ff'); cup(1000, 704, '#c6f5d5');
      for (let k = 0; k < 18; k++) star5(ctx, R() * 1280, R() * 300, 6 + R() * 6, '#ffffff', R());
    },

    sunset(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 430, ['#3b2a7a', '#b84a8f', '#ff7a59', '#ffcf6b']); ctx.fillRect(0, 0, 1280, 720);
      circle(ctx, 640, 430, 110, '#ffe8a3'); circle(ctx, 640, 430, 86, '#ffd25e');
      cloud(ctx, 120, 160, 1.2, 'rgba(255,190,200,0.85)'); cloud(ctx, 900, 110, 1.4, 'rgba(255,170,190,0.8)'); cloud(ctx, 420, 260, 0.9, 'rgba(255,210,180,0.85)');
      for (let k = 0; k < 6; k++) { const x = 300 + R() * 700, y = 120 + R() * 160; ctx.strokeStyle = '#3b2a5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.quadraticCurveTo(x - 6, y - 8, x, y); ctx.quadraticCurveTo(x + 6, y - 8, x + 12, y); ctx.stroke(); }
      // biển
      ctx.fillStyle = grad(ctx, 430, 600, ['#ff9a6b', '#7a4a9f', '#2f3f8f']); ctx.fillRect(0, 430, 1280, 170);
      for (let k = 0; k < 26; k++) { const y = 444 + k * 6, w = 200 - k * 6; rect(ctx, 640 - w / 2 + (R() - 0.5) * 30, y, w, 3, 'rgba(255,232,163,0.65)'); }
      for (let k = 0; k < 50; k++) rect(ctx, R() * 1280, 450 + R() * 140, 20 + R() * 40, 2, 'rgba(255,255,255,0.25)');
      // thuyền buồm
      poly(ctx, [[860, 470], [960, 470], [945, 488], [875, 488]], '#3b2a5a'); rect(ctx, 905, 400, 4, 70, '#3b2a5a'); poly(ctx, [[909, 404], [950, 466], [909, 466]], '#fff1e0'); poly(ctx, [[903, 412], [872, 466], [903, 466]], '#ffd6c9');
      // bãi cát
      ctx.fillStyle = '#f2c98a'; ctx.beginPath(); ctx.moveTo(0, 720); ctx.lineTo(0, 600); ctx.quadraticCurveTo(400, 560, 800, 610); ctx.quadraticCurveTo(1050, 640, 1280, 590); ctx.lineTo(1280, 720); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 80; k++) circle(ctx, R() * 1280, 620 + R() * 100, 2, 'rgba(170,110,60,0.35)');
      // cây dừa
      const palm = (x, y, s, lean) => {
        ctx.strokeStyle = '#7a4b2a'; ctx.lineWidth = 18 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.4, y - 150 * s, x + lean, y - 280 * s); ctx.stroke();
        const tx = x + lean, ty = y - 280 * s;
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI + k * Math.PI / 6 + 0.1;
          ctx.strokeStyle = k % 2 ? '#2f7a3a' : '#3f9a42'; ctx.lineWidth = 14 * s;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * 90 * s, ty + Math.sin(a) * 70 * s - 30 * s, tx + Math.cos(a) * 150 * s, ty + Math.sin(a) * 40 * s + 40 * s); ctx.stroke();
        }
        circle(ctx, tx - 10 * s, ty + 12 * s, 12 * s, '#6e4423'); circle(ctx, tx + 12 * s, ty + 14 * s, 12 * s, '#6e4423');
      };
      palm(150, 660, 1.1, 60); palm(1150, 640, 0.95, -70);
      // ô, lâu đài cát, vỏ sò
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(420, 690); ctx.lineTo(450, 570); ctx.stroke();
      ctx.save(); ctx.translate(450, 570); ctx.rotate(0.25);
      ['#ff4f6d', '#ffffff', '#4fb3ff', '#ffffff', '#ff4f6d', '#ffffff'].forEach((c, k) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 110, Math.PI + k * Math.PI / 6, Math.PI + (k + 1) * Math.PI / 6); ctx.closePath(); ctx.fill(); });
      ctx.restore();
      rect(ctx, 700, 640, 140, 60, '#e0b06a'); for (let k = 0; k < 3; k++) rect(ctx, 710 + k * 46, 600, 30, 44, '#e0b06a');
      for (let k = 0; k < 3; k++) poly(ctx, [[710 + k * 46, 600], [725 + k * 46, 576], [740 + k * 46, 600]], '#d29a50');
      rect(ctx, 758, 660, 24, 40, '#a8703f', 10); rect(ctx, 770, 560, 3, 40, '#7a4b2a'); poly(ctx, [[773, 562], [800, 572], [773, 582]], '#ff4f6d');
      for (const [x, y, c] of [[560, 690, '#ffd6e5'], [980, 680, '#fff1a8'], [1040, 700, '#ffe1c2']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 18, Math.PI, TAU); ctx.closePath(); ctx.fill(); }
      star5(ctx, 620, 700, 16, '#ff8a3d', 0.4);
    },
  };

  /* ---------- đợt 2: 4 cảnh mới ---------- */
  Object.assign(SCENES, {
    autumn(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 420, ['#8ec9ff', '#d7ecff', '#ffe8c4']); ctx.fillRect(0, 0, 1280, 720);
      // núi xa phủ tuyết
      const peak = (x, y, w, c, cap) => { poly(ctx, [[x - w, 420], [x, y], [x + w, 420]], c); poly(ctx, [[x - w * 0.28, y + (420 - y) * 0.28], [x, y], [x + w * 0.28, y + (420 - y) * 0.28], [x + w * 0.1, y + (420 - y) * 0.22], [x - w * 0.08, y + (420 - y) * 0.3]], cap); };
      peak(260, 150, 280, '#8a8fb8', '#ffffff'); peak(700, 110, 330, '#7a80ad', '#f4f6ff'); peak(1120, 170, 260, '#9095bf', '#ffffff');
      cloud(ctx, 420, 90, 1, '#fff'); cloud(ctx, 950, 70, 0.8, '#fff');
      // hồ phản chiếu
      ctx.fillStyle = grad(ctx, 420, 520, ['#6fb3e0', '#4a86c0']); ctx.fillRect(0, 420, 1280, 100);
      for (let k = 0; k < 30; k++) rect(ctx, R() * 1280, 430 + R() * 80, 40 + R() * 80, 3, 'rgba(255,255,255,0.35)');
      // rừng cây thu nhiều màu
      const leafC = [['#e8541e', '#ff8a3d'], ['#f2b705', '#ffd84d'], ['#c0392b', '#e8603c'], ['#d97706', '#f59e0b'], ['#8a3b12', '#c2571a']];
      for (let row = 0; row < 3; row++) {
        for (let x = -30 + R() * 40; x < 1320; x += 70 + R() * 50) {
          const c = leafC[Math.floor(R() * leafC.length)], s = 0.55 + row * 0.25 + R() * 0.15;
          tree(ctx, x, 470 + row * 40, s, c[0], c[1], '#5a3a22');
        }
      }
      rect(ctx, 0, 560, 1280, 160, '#c98a3a');
      // lối mòn + lá rụng
      ctx.fillStyle = '#e8c08a'; ctx.beginPath(); ctx.moveTo(520, 720); ctx.quadraticCurveTo(600, 620, 700, 560); ctx.lineTo(760, 560); ctx.quadraticCurveTo(740, 640, 820, 720); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 160; k++) { const c = leafC[k % leafC.length][k % 2]; ell(ctx, R() * 1280, 570 + R() * 150, 7, 4, c, R() * 3); }
      // nấm + hươu (dáng đơn giản tự vẽ)
      for (const [x, y] of [[200, 650], [240, 668], [1080, 660]]) { rect(ctx, x - 5, y - 14, 10, 18, '#fff4e0', 3); ctx.fillStyle = '#d93a3a'; ctx.beginPath(); ctx.arc(x, y - 14, 18, Math.PI, 0); ctx.fill(); circle(ctx, x - 6, y - 22, 3, '#fff'); circle(ctx, x + 7, y - 20, 3, '#fff'); }
      ctx.save(); ctx.translate(960, 600);
      ell(ctx, 0, 0, 60, 30, '#a0612f'); rect(ctx, -46, 10, 10, 50, '#8a4f24'); rect(ctx, -22, 14, 10, 46, '#8a4f24'); rect(ctx, 22, 14, 10, 46, '#8a4f24'); rect(ctx, 40, 10, 10, 50, '#8a4f24');
      ell(ctx, 66, -38, 20, 26, '#a0612f', 0.5); ell(ctx, 84, -56, 22, 16, '#b0703a'); circle(ctx, 92, -60, 4, '#1b1b2a'); circle(ctx, 104, -52, 5, '#3a2a2a');
      ctx.strokeStyle = '#6e4423'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(78, -70); ctx.lineTo(70, -100); ctx.lineTo(56, -110); ctx.moveTo(70, -100); ctx.lineTo(80, -118); ctx.moveTo(88, -70); ctx.lineTo(100, -98); ctx.lineTo(116, -104); ctx.stroke();
      for (let k = 0; k < 6; k++) circle(ctx, -30 + k * 14, -6 + (k % 2) * 8, 4, '#f4dcc0');
      ctx.restore();
    },

    lantern(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 720, ['#1d1240', '#3a1a5c', '#5b1f4f']); ctx.fillRect(0, 0, 1280, 720);
      circle(ctx, 1100, 110, 60, '#fff1c4'); circle(ctx, 1100, 110, 80, 'rgba(255,241,196,0.15)');
      for (let k = 0; k < 70; k++) circle(ctx, R() * 1280, R() * 260, R() * 1.6 + 0.4, 'rgba(255,255,255,0.7)');
      // dãy phố cổ hai tầng, mái ngói
      const wallC = ['#f2c14e', '#e8a33d', '#f5d27a', '#e9b44c', '#d98e32'];
      let x = -20;
      while (x < 1290) {
        const w = 150 + R() * 60, h = 230 + R() * 50, y = 600;
        rect(ctx, x, y - h, w, h, wallC[Math.floor(R() * wallC.length)]);
        poly(ctx, [[x - 14, y - h + 6], [x + 14, y - h - 34], [x + w - 14, y - h - 34], [x + w + 14, y - h + 6]], '#7a3b2a');
        for (let t = x - 10; t < x + w + 10; t += 14) rect(ctx, t, y - h - 6, 10, 10, '#a34a32', 2);
        rect(ctx, x + 10, y - h * 0.55, w - 20, 12, '#7a3b2a');
        // cửa gỗ + cửa sổ sáng
        rect(ctx, x + w * 0.3, y - 110, w * 0.4, 110, '#6e3a20'); for (let k = 1; k < 4; k++) rect(ctx, x + w * 0.3 + k * w * 0.1 - 2, y - 110, 4, 110, '#4a2614');
        rect(ctx, x + 18, y - h + 40, 40, 50, '#ffd86b', 4); rect(ctx, x + w - 58, y - h + 40, 40, 50, '#ffd86b', 4);
        x += w + 10;
      }
      // dây đèn lồng nhiều màu
      const lc = ['#ff3b3b', '#ff8a3d', '#ffd23f', '#ff5fa2', '#3bd16f', '#4fb3ff'];
      for (const [y0, sag] of [[230, 60], [320, 50], [150, 40]]) {
        ctx.strokeStyle = '#2b1a14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, y0); ctx.quadraticCurveTo(640, y0 + sag * 2, 1290, y0); ctx.stroke();
        for (let k = 0; k < 16; k++) {
          const t = (k + 0.5) / 16, lx = t * 1300 - 10, ly = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
          const c = lc[(k + y0) % lc.length];
          circle(ctx, lx, ly + 26, 30, 'rgba(255,200,120,0.15)');
          rect(ctx, lx - 2, ly, 4, 8, '#2b1a14'); ell(ctx, lx, ly + 26, 17, 20, c); rect(ctx, lx - 10, ly + 6, 20, 4, '#ffd23f', 2); rect(ctx, lx - 10, ly + 42, 20, 4, '#ffd23f', 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(lx, ly + 26, 8, 19, 0, 0, TAU); ctx.stroke();
          rect(ctx, lx - 1, ly + 46, 2, 12, '#ffd23f');
        }
      }
      // sông + thuyền đèn hoa đăng
      ctx.fillStyle = grad(ctx, 600, 720, ['#2a1f5c', '#140c33']); ctx.fillRect(0, 600, 1280, 120);
      for (let k = 0; k < 120; k++) rect(ctx, R() * 1280, 610 + R() * 100, 12 + R() * 26, 3, ['rgba(255,216,107,0.45)', 'rgba(255,90,90,0.35)', 'rgba(255,160,90,0.4)'][k % 3]);
      for (let k = 0; k < 9; k++) { const fx = 70 + k * 140 + R() * 40, fy = 650 + R() * 50; poly(ctx, [[fx - 16, fy], [fx + 16, fy], [fx + 10, fy + 8], [fx - 10, fy + 8]], '#ff5fa2'); circle(ctx, fx, fy - 4, 6, '#ffe8a3'); circle(ctx, fx, fy - 4, 14, 'rgba(255,232,163,0.25)'); }
      poly(ctx, [[540, 690], [760, 690], [730, 716], [570, 716]], '#6e3a20'); rect(ctx, 600, 660, 100, 30, '#a34a32', 6); ell(ctx, 650, 652, 16, 18, '#ff3b3b');
    },

    farm(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 400, ['#74c5ff', '#d9f1ff']); ctx.fillRect(0, 0, 1280, 720);
      circle(ctx, 180, 110, 56, '#fff3a8');
      cloud(ctx, 420, 90, 1.1, '#fff'); cloud(ctx, 860, 60, 0.9, '#fff'); cloud(ctx, 1100, 130, 1.2, '#fff');
      hills(ctx, R, 350, 60, 4, '#b5e08f');
      // ruộng sọc
      for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#e9cf6a' : '#9ed36b'; ctx.beginPath(); ctx.moveTo(0, 360 + k * 18); ctx.lineTo(1280, 340 + k * 20); ctx.lineTo(1280, 360 + k * 20); ctx.lineTo(0, 378 + k * 18); ctx.closePath(); ctx.fill(); }
      // chuồng đỏ + cối xay gió
      rect(ctx, 820, 300, 220, 170, '#c0392b'); poly(ctx, [[800, 306], [930, 210], [1060, 306]], '#7a1f1a');
      rect(ctx, 890, 360, 80, 110, '#fff'); rect(ctx, 896, 366, 68, 98, '#a12b22'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(896, 366); ctx.lineTo(964, 464); ctx.moveTo(964, 366); ctx.lineTo(896, 464); ctx.stroke();
      rect(ctx, 905, 250, 50, 40, '#fff', 4);
      rect(ctx, 1150, 210, 26, 260, '#e8e2d0'); circle(ctx, 1163, 210, 12, '#7a4b2a');
      for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(1163, 210); ctx.rotate(0.4 + k * Math.PI / 2); rect(ctx, -8, -110, 16, 104, '#fffaf0'); ctx.restore(); }
      rect(ctx, 0, 460, 1280, 260, '#7cc66a');
      // hàng rào gỗ
      for (let x2 = 0; x2 < 760; x2 += 46) rect(ctx, x2, 470, 10, 60, '#b0784a', 2);
      rect(ctx, 0, 484, 760, 8, '#c98d55'); rect(ctx, 0, 508, 760, 8, '#c98d55');
      // bò, gà, heo (dáng tự vẽ)
      const cow = (cx, cy, s) => {
        ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
        for (const lx of [-40, -18, 22, 44]) rect(ctx, lx, 10, 12, 44, '#f4f4f4', 4);
        ell(ctx, 0, 0, 66, 38, '#ffffff'); ell(ctx, -20, -10, 22, 16, '#2b2240'); ell(ctx, 26, 8, 18, 14, '#2b2240');
        ell(ctx, 72, -20, 28, 24, '#ffffff'); ell(ctx, 88, -8, 18, 13, '#ffb3c7'); circle(ctx, 70, -28, 4, '#1b1b2a');
        poly(ctx, [[58, -40], [52, -58], [66, -44]], '#e8d8b0'); poly(ctx, [[82, -42], [90, -60], [92, -42]], '#e8d8b0');
        ctx.restore();
      };
      cow(300, 600, 1.1); cow(640, 640, 0.85);
      const hen = (hx, hy) => { ell(ctx, hx, hy, 22, 18, '#fff8ec'); circle(ctx, hx + 18, hy - 16, 11, '#fff8ec'); poly(ctx, [[hx + 26, hy - 18], [hx + 36, hy - 14], [hx + 26, hy - 11]], '#ffb23f'); circle(ctx, hx + 18, hy - 28, 5, '#ff3b3b'); circle(ctx, hx + 21, hy - 18, 2.5, '#1b1b2a'); rect(ctx, hx - 4, hy + 14, 3, 12, '#ffb23f'); rect(ctx, hx + 6, hy + 14, 3, 12, '#ffb23f'); };
      hen(120, 680); hen(180, 700); hen(480, 690); hen(1180, 680);
      const pig = (px, py) => { ell(ctx, px, py, 46, 30, '#ffb3c7'); ell(ctx, px + 42, py - 8, 22, 20, '#ffb3c7'); ell(ctx, px + 58, py - 4, 10, 8, '#ff8fab'); circle(ctx, px + 44, py - 14, 3, '#1b1b2a'); for (const lx of [-26, -8, 14, 28]) rect(ctx, px + lx, py + 20, 10, 18, '#ff9fbb', 3); };
      pig(960, 640); pig(1080, 690);
      // hoa hướng dương
      for (let k = 0; k < 8; k++) { const sx = 30 + k * 34, sy = 430; rect(ctx, sx - 2, sy, 4, 60, '#3f9a42'); flower(ctx, sx, sy, 14, '#ffd23f', '#7a4b2a', 10, k); }
    },

    snow(ctx, R) {
      ctx.fillStyle = grad(ctx, 0, 460, ['#24356e', '#4a5fa8', '#a7b8e8']); ctx.fillRect(0, 0, 1280, 720);
      // cực quang
      ctx.save(); ctx.globalAlpha = 0.35;
      for (const [y, c] of [[110, '#5dffb0'], [150, '#6fd3ff'], [190, '#b388ff']]) { ctx.strokeStyle = c; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(-20, y); for (let x = 0; x <= 1300; x += 100) ctx.quadraticCurveTo(x + 50, y + (R() - 0.5) * 70, x + 100, y + (R() - 0.5) * 30); ctx.stroke(); }
      ctx.restore();
      for (let k = 0; k < 90; k++) circle(ctx, R() * 1280, R() * 300, R() * 1.6 + 0.4, 'rgba(255,255,255,0.8)');
      hills(ctx, R, 360, 80, 4, '#d9e6ff'); hills(ctx, R, 430, 60, 6, '#eef4ff');
      // cây thông phủ tuyết
      const pine = (x, y, s) => {
        rect(ctx, x - 6 * s, y - 20 * s, 12 * s, 24 * s, '#6e4423');
        for (let k = 0; k < 3; k++) { const yy = y - 20 * s - k * 34 * s, w = (54 - k * 12) * s; poly(ctx, [[x - w, yy], [x, yy - 56 * s], [x + w, yy]], '#1f6b45'); poly(ctx, [[x - w * 0.5, yy - 26 * s], [x, yy - 56 * s], [x + w * 0.5, yy - 26 * s], [x + w * 0.2, yy - 20 * s], [x - w * 0.2, yy - 22 * s]], '#ffffff'); }
      };
      for (let k = 0; k < 9; k++) pine(40 + k * 150 + R() * 40, 470 + (k % 2) * 20, 0.8 + R() * 0.3);
      // nhà gỗ có đèn + khói
      const cabin = (x, y, w, c) => {
        rect(ctx, x, y - 110, w, 110, c); for (let k = 0; k < 6; k++) rect(ctx, x, y - 110 + k * 18, w, 3, 'rgba(0,0,0,0.15)');
        poly(ctx, [[x - 16, y - 104], [x + w / 2, y - 180], [x + w + 16, y - 104]], '#ffffff'); poly(ctx, [[x - 16, y - 104], [x + w + 16, y - 104], [x + w + 10, y - 96], [x - 10, y - 96]], '#e0eaff');
        rect(ctx, x + w * 0.15, y - 80, 36, 34, '#ffd86b', 3); rect(ctx, x + w * 0.62, y - 70, 30, 70, '#5a3a22', 4);
        rect(ctx, x + w * 0.7, y - 196, 20, 40, '#8a4f3a');
      };
      cabin(220, 560, 180, '#a8643a'); cabin(860, 570, 200, '#8a4f3a');
      rect(ctx, 0, 540, 1280, 180, '#f6f9ff');
      for (let k = 0; k < 40; k++) ell(ctx, R() * 1280, 560 + R() * 150, 30 + R() * 50, 6, 'rgba(180,200,240,0.35)');
      // người tuyết
      const sm = (x, y, s) => {
        circle(ctx, x, y, 52 * s, '#ffffff'); circle(ctx, x, y - 70 * s, 38 * s, '#ffffff'); circle(ctx, x, y - 124 * s, 28 * s, '#ffffff');
        ctx.strokeStyle = '#c8d4f0'; ctx.lineWidth = 2; for (const [cy, r] of [[0, 52], [-70, 38], [-124, 28]]) { ctx.beginPath(); ctx.arc(x, y + cy * s, r * s, 0, TAU); ctx.stroke(); }
        rect(ctx, x - 30 * s, y - 104 * s, 60 * s, 12 * s, '#e8413c', 5); rect(ctx, x + 10 * s, y - 104 * s, 14 * s, 40 * s, '#e8413c', 5);
        poly(ctx, [[x, y - 124 * s], [x + 30 * s, y - 120 * s], [x, y - 116 * s]], '#ff8a3d');
        circle(ctx, x - 9 * s, y - 132 * s, 4 * s, '#1b1b2a'); circle(ctx, x + 9 * s, y - 132 * s, 4 * s, '#1b1b2a');
        for (let k = 0; k < 3; k++) circle(ctx, x, y - (80 - k * 16) * s, 4 * s, '#1b1b2a');
        rect(ctx, x - 26 * s, y - 166 * s, 52 * s, 10 * s, '#2b2240'); rect(ctx, x - 18 * s, y - 196 * s, 36 * s, 32 * s, '#2b2240'); rect(ctx, x - 18 * s, y - 176 * s, 36 * s, 6 * s, '#4fb3ff');
        ctx.strokeStyle = '#6e4423'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(x - 36 * s, y - 70 * s); ctx.lineTo(x - 90 * s, y - 110 * s); ctx.moveTo(x + 36 * s, y - 70 * s); ctx.lineTo(x + 86 * s, y - 104 * s); ctx.stroke();
      };
      sm(560, 650, 1); sm(1150, 670, 0.7);
      // xe trượt tuyết
      rect(ctx, 680, 640, 120, 24, '#e8413c', 8); ctx.strokeStyle = '#6e4423'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(670, 676); ctx.lineTo(810, 676); ctx.quadraticCurveTo(828, 676, 826, 660); ctx.stroke();
      // tuyết rơi
      for (let k = 0; k < 160; k++) circle(ctx, R() * 1280, R() * 720, 1.5 + R() * 3, 'rgba(255,255,255,0.85)');
    },
  });

  const CACHE = new Map();
  window.JigsawArt = {
    list: LIST,
    name(id) { const a = LIST.find((x) => x.id === id); return a ? a.name : id; },
    /** vẽ cảnh id vào ctx kích thước w×h */
    paint(id, ctx, w, h) {
      const f = SCENES[id] || SCENES.garden;
      ctx.save();
      ctx.scale(w / 1280, h / 720);
      ctx.lineJoin = 'round';
      try { f(ctx, rng(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7))); } catch (e) { /* thiếu hàm phụ trợ → giữ phần đã vẽ */ }
      ctx.restore();
    },
    /** canvas đã vẽ sẵn (cache theo id + cỡ) */
    canvas(id, w, h) {
      const key = `${id}:${w}x${h}`;
      if (CACHE.has(key)) return CACHE.get(key);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      this.paint(id, cv.getContext('2d'), w, h);
      CACHE.set(key, cv);
      return cv;
    },
  };
})();

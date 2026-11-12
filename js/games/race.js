'use strict';
/* Đua Xe — nhiều đường đua dài (RAC3: đường tắt + cầu nhảy + sông/vực), lái kiểu xe thật (RAC9), vật phẩm (RAC1),
   drift (RAC2), chế độ Đấu bong bóng (RAC4).
   - Bản đồ lớn hơn màn hình (WW×WH); camera tự đi theo và tự thu phóng để luôn thấy đủ mọi xe (zoom nhỏ nhất = thấy cả bản đồ).
   - Đường đua là dữ liệu trong TRACKS: điểm điều khiển (Catmull-Rom khép kín), bề rộng, vũng dầu (hiện không dùng — chủ project bỏ 10/11), hộp ?, cầu nhảy,
     vùng rơi (sông/vực — xe chạm đất trong đó là rơi, hồi lại phía sau), đường tắt (polyline mở, mặt đường riêng,
     có thể có cầu nhảy qua sông). Chọn đường ở màn giới thiệu (def.variants → api.variant).
   - Vật lý: xe có vận tốc thật (vx, vy) + hướng mũi xe h; mỗi khung hình tách vận tốc thành phần dọc / ngang theo mũi xe,
     phần ngang bị bám đường (grip) kéo về 0 → drift/băng/đất là grip thấp nên xe trượt.
   - Lái: ← → đánh lái, ↑ ga, ↓ phanh/lùi. Máy cũng lái bằng đúng cách đó (botInput cho hướng mục tiêu → botDrive đổi
     thành đánh lái/ga/phanh, phanh trước khúc cua gắt). */
(() => {
  const LAPS = 3, MAXT = 240, TAP = 0.18;
  const WW = 2200, WH = 1240;                // kích thước bản đồ
  const ZMIN = Math.min(W / WW, H / WH), ZMAX = 1;
  const GRAV = 1400, LAUNCH = 1;            // bay qua cầu nhảy: vz = v·LAUNCH, quãng bay ≈ v²/700 (340 → ~165px, tăng tốc 560 → ~450px)
  const VMAX = 360, VBOOST = 580, ACC = 470, STEER = 3.1;
  const ITEMS = { banana: '🍌', rocket: '🚀', shield: '🛡️' };
  const MODES = [
    { id: 'race', name: 'Đua vòng', desc: 'Chạy đủ số vòng, về đích trước là thắng.' },
    { id: 'balloon', name: 'Đấu bong bóng', desc: 'Mỗi xe 3 bong bóng. Bắn tên lửa, thả chuối, tăng tốc húc thẳng vào xe khác để làm nổ bong bóng. Hết bong bóng là bị loại!' },
  ];
  /* ---------- dữ liệu đường đua ---------- */
  // chỉ số trên đường = điểm điều khiển × 20 (mỗi đoạn nội suy 20 điểm)
  const TRACKS = [
    {
      id: 'meadow', name: 'Đồng Cỏ', icon: '🌳', theme: 'meadow', tw: 172,
      desc: 'Đường dài, cua uốn lượn, có khúc chữ U sâu. Đường tắt bằng đất băng qua sông — phải tăng tốc (Đánh hoặc drift) lên cầu nhảy mới bay qua!',
      raw: [[1100, 1080], [760, 1085], [440, 1060], [250, 960], [200, 780], [290, 640], [230, 480], [260, 320], [400, 220], [620, 200],
        [800, 270], [880, 450], [960, 680], [1120, 780], [1280, 700], [1330, 500], [1380, 320], [1520, 220], [1760, 200], [1960, 290],
        [2020, 480], [1990, 700], [1900, 900], [1720, 1040], [1420, 1080]],
      oils: [], boxes: [56, 160, 250, 370, 440],
      ramps: [{ k: 24 }],
      hazards: [{ kind: 'water', poly: [[1032, 150], [1166, 150], [1180, 300], [1166, 420], [1182, 556], [1100, 606], [1036, 556], [1012, 420], [1028, 300]], respawn: 'sc' }],
      shortcut: { pts: [[730, 238], [850, 248], [980, 250], [1110, 250], [1240, 252], [1360, 262], [1450, 262]], w: 104, surface: 'dirt', from: 190, to: 332, rampX: 978 },
      labelAt: 0.18,
    },
    {
      id: 'desert', name: 'Sa Mạc', icon: '🌵', theme: 'desert', tw: 168,
      desc: 'Hai vực sâu cắt ngang đường — cứ giữ tốc độ là bay qua, bị xoay giữa đường là rơi! Đường tắt cát lún đầy xương rồng.',
      raw: [[1100, 1080], [700, 1085], [380, 1060], [220, 940], [180, 740], [190, 520], [240, 330], [400, 220], [620, 210], [780, 320],
        [860, 520], [1000, 640], [1180, 620], [1280, 470], [1320, 300], [1460, 210], [1700, 200], [1920, 260], [2020, 430], [2020, 650],
        [1960, 860], [1800, 1010], [1500, 1080]],
      oils: [], boxes: [60, 150, 230, 330, 410],
      ramps: [{ k: 88 }, { k: 366 }],
      hazards: [{ kind: 'canyon', main: [90, 94] }, { kind: 'canyon', main: [368, 372] }],
      shortcut: { pts: [[690, 246], [830, 236], [980, 232], [1130, 236], [1280, 246], [1400, 236]], w: 100, surface: 'sand', from: 172, to: 292, cacti: [[930, 222], [1150, 252]] },
      labelAt: 0.16,
    },
    {
      id: 'snow', name: 'Núi Tuyết', icon: '❄️', theme: 'snow', tw: 164,
      desc: 'Đèo núi nhiều khúc ngoằn ngoèo, mảng băng trơn trượt và suối băng phải nhảy qua. Đường tắt cắt ngang hồ băng — ngắn mà trơn như mỡ!',
      raw: [[1100, 1080], [760, 1085], [440, 1070], [250, 980], [200, 800], [320, 680], [560, 700], [760, 640], [780, 470], [600, 400],
        [380, 380], [230, 280], [330, 170], [600, 160], [880, 200], [1060, 320], [1160, 500], [1340, 580], [1560, 520], [1640, 340],
        [1800, 200], [1990, 260], [2030, 470], [1960, 680], [2000, 880], [1860, 1030], [1500, 1080]],
      oils: [], boxes: [56, 150, 250, 410, 500],
      ramps: [{ k: 448 }],
      hazards: [{ kind: 'creek', main: [450, 454] }],
      ice: [[540, 700, 72], [720, 168, 62], [1700, 270, 60], [1980, 860, 64], [420, 1066, 66]],
      shortcut: { pts: [[1010, 278], [1140, 330], [1290, 362], [1440, 362], [1570, 330], [1690, 282]], w: 108, surface: 'ice', from: 296, to: 388 },
      labelAt: 0.22,
    },
  ];
  const VARIANTS = {
    label: 'Đường đua',
    items: TRACKS.map((t) => ({ id: t.id, name: t.name, icon: t.icon, desc: t.desc }))
      .concat([{ id: 'random', name: 'Ngẫu nhiên', icon: '🎲', desc: 'Mỗi ván bốc ngẫu nhiên một đường đua.' }]),
  };

  /** Catmull-Rom: khép kín (closed) hoặc mở, n điểm mỗi đoạn */
  function spline(raw, n, closed) {
    const out = [], m = raw.length;
    const P = (i) => (closed ? raw[(i + m) % m] : raw[U.clamp(i, 0, m - 1)]);
    const segs = closed ? m : m - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    if (!closed) out.push(raw[m - 1].slice());
    return out;
  }
  const inPoly = (x, y, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };

  const BUILT = {};
  function buildTrack(def) {
    if (BUILT[def.id]) return BUILT[def.id];
    const S = spline(def.raw, 20, true), NS = S.length;
    const CUM = new Float32Array(NS), ANG = new Float32Array(NS);
    let L = 0;
    for (let i = 0; i < NS; i++) {
      const a = S[i], b = S[(i + 1) % NS];
      CUM[i] = L; L += Math.hypot(b[0] - a[0], b[1] - a[1]);
      ANG[i] = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
    const onRoad = (k, off) => { const n = ANG[k] + Math.PI / 2; return { x: S[k][0] + Math.cos(n) * off, y: S[k][1] + Math.sin(n) * off }; };
    const T = { def, S, NS, CUM, ANG, L, TW: def.tw, onRoad };
    T.oils = def.oils.concat(def.oilsAfterRamp || []).map(([k, off]) => Object.assign(onRoad(k, off), { r: 24 }));
    T.boxes = [];
    for (const k of def.boxes) for (const off of [-52, 0, 52]) T.boxes.push(onRoad(k, off));
    T.ramps = (def.ramps || []).map((r) => ({ x: S[r.k][0], y: S[r.k][1], a: ANG[r.k], hw: def.tw / 2, k: r.k }));
    T.ice = (def.ice || []).map(([x, y, r]) => ({ x, y, r }));
    // vùng rơi: polygon tự cho hoặc dựng từ đoạn đường chính [k0, k1]
    T.hazards = (def.hazards || []).map((h) => {
      const o = Object.assign({}, h);
      if (h.main) {
        const [k0, k1] = h.main, wide = def.tw / 2 + 70, left = [], right = [];
        for (let k = k0; k <= k1; k++) { left.push(onRoad(k, -wide)); right.push(onRoad(k, wide)); }
        o.poly = left.concat(right.reverse()).map((p) => [p.x, p.y]);
        o.respawnK = (k0 - 20 + NS) % NS;
      }
      return o;
    });
    // đường tắt
    if (def.shortcut) {
      const sc = Object.assign({}, def.shortcut);
      sc.P = spline(sc.pts, 10, false);
      sc.cum = [0];
      for (let i = 1; i < sc.P.length; i++) sc.cum.push(sc.cum[i - 1] + Math.hypot(sc.P[i][0] - sc.P[i - 1][0], sc.P[i][1] - sc.P[i - 1][1]));
      sc.len = sc.cum[sc.cum.length - 1];
      sc.ang = sc.P.map((p, i) => { const q = sc.P[Math.min(i + 1, sc.P.length - 1)], r = sc.P[Math.max(i - 1, 0)]; return Math.atan2(q[1] - r[1], q[0] - r[0]); });
      if (sc.rampX) {
        let bi = 0; sc.P.forEach((p, i) => { if (Math.abs(p[0] - sc.rampX) < Math.abs(sc.P[bi][0] - sc.rampX)) bi = i; });
        T.ramps.push({ x: sc.P[bi][0], y: sc.P[bi][1], a: sc.ang[bi], hw: sc.w / 2, sc: true });
      }
      // điểm đường tắt bắt đầu tách hẳn khỏi đường chính (máy nhắm vào đó để rẽ)
      sc.split = sc.P.findIndex((p) => S.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > def.tw / 2 + 6));
      if (sc.split < 0) sc.split = 2;
      sc.grip = { dirt: 10, sand: 7, ice: 1.6 }[sc.surface];
      sc.vmul = { dirt: 0.94, sand: 0.8, ice: 1 }[sc.surface];
      sc.cacti = (sc.cacti || []).map(([x, y]) => ({ x, y, r: 18 }));
      T.sc = sc;
      // hồi sinh khi rơi ở đường tắt: về đường chính tại cửa vào
      for (const h of T.hazards) if (h.respawn === 'sc') h.respawnK = (sc.from - 4 + NS) % NS;
    }
    BUILT[def.id] = T;
    return T;
  }

  /* ---------- vẽ nền đường đua (cache theo đường) ---------- */
  const THEME = {
    meadow: { bg: '#4f9e45', dot: ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.06)'], road: '#575a6c', curbA: '#f2f2f2', curbB: '#e8384f' },
    desert: { bg: '#d9b46a', dot: ['rgba(255,255,255,0.08)', 'rgba(120,70,20,0.08)'], road: '#6b5e57', curbA: '#f6e7c8', curbB: '#d65a2e' },
    snow: { bg: '#e6eef6', dot: ['rgba(255,255,255,0.6)', 'rgba(120,150,190,0.12)'], road: '#5d6680', curbA: '#ffffff', curbB: '#3d7be0' },
  };
  const CANVAS = {};
  function trackCanvas(T) {
    if (CANVAS[T.def.id]) return CANVAS[T.def.id];
    const th = THEME[T.def.theme], S = T.S, TW = T.TW;
    const c = document.createElement('canvas'); c.width = WW; c.height = WH;
    const g = c.getContext('2d');
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.fillStyle = th.bg; g.fillRect(0, 0, WW, WH);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = th.dot[i % 2];
      g.beginPath(); g.arc(rnd() * WW, rnd() * WH, 3 + rnd() * 7, 0, TAU); g.fill();
    }
    // đường tắt (vẽ dưới đường chính để chỗ nối gọn)
    if (T.sc) {
      const sc = T.sc;
      const path = () => { g.beginPath(); sc.P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); };
      const col = { dirt: ['#7a5a32', '#a8834f'], sand: ['#c08a3e', '#f0d08e'], ice: ['#9fd3f2', '#d6f1ff'] }[sc.surface];
      const edge = { dirt: '#5a3f1e', sand: '#8a5a22', ice: '#5aa0d0' }[sc.surface];
      g.lineJoin = 'round'; g.lineCap = 'round';
      path(); g.strokeStyle = edge; g.lineWidth = sc.w + 12; g.stroke();
      path(); g.strokeStyle = col[0]; g.lineWidth = sc.w; g.stroke();
      path(); g.strokeStyle = col[1]; g.lineWidth = sc.w - 22; g.setLineDash([16, 14]); g.stroke(); g.setLineDash([]);
      if (sc.surface === 'ice') { for (let i = 0; i < 40; i++) { const p = sc.P[Math.floor(rnd() * sc.P.length)]; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(p[0] - 14 + rnd() * 10, p[1] - 20 + rnd() * 40); g.lineTo(p[0] + 4 + rnd() * 14, p[1] - 20 + rnd() * 40); g.stroke(); } }
    }
    // sông/hồ nằm ngoài đường chính (cắt ngang đường tắt) — vẽ sau đường tắt
    for (const h of T.hazards) if (!h.main) drawHazard(g, h, rnd);
    // đường chính
    const path = () => { g.beginPath(); S.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    path(); g.strokeStyle = th.curbA; g.lineWidth = TW + 22; g.stroke();
    path(); g.strokeStyle = th.curbB; g.lineWidth = TW + 22; g.setLineDash([22, 22]); g.stroke(); g.setLineDash([]);
    path(); g.strokeStyle = th.road; g.lineWidth = TW; g.stroke();
    path(); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3; g.setLineDash([24, 24]); g.stroke(); g.setLineDash([]);
    // vùng rơi cắt qua đường chính → vẽ lại đè lên mặt đường
    for (const h of T.hazards) if (h.main) drawHazard(g, h, rnd);
    // băng
    for (const p of T.ice) {
      g.fillStyle = 'rgba(190,235,255,0.75)'; g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 0.72, 0.3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(p.x - p.r * 0.5 + rnd() * p.r * 0.3, p.y - p.r * 0.3 + rnd() * p.r * 0.5); g.lineTo(p.x + rnd() * p.r * 0.5, p.y - p.r * 0.2 + rnd() * p.r * 0.4); g.stroke(); }
    }
    // trang trí ngoài đường
    const nearRoad = (x, y, pad) => {
      for (let k = 0; k < T.NS; k += 3) if (Math.hypot(S[k][0] - x, S[k][1] - y) < TW / 2 + pad) return true;
      if (T.sc) for (const p of T.sc.P) if (Math.hypot(p[0] - x, p[1] - y) < T.sc.w / 2 + pad) return true;
      for (const h of T.hazards) if (h.poly && inPoly(x, y, h.poly)) return true;
      return false;
    };
    for (let i = 0; i < 260; i++) {
      const x = 30 + rnd() * (WW - 60), y = 30 + rnd() * (WH - 60);
      if (nearRoad(x, y, 36)) continue;
      if (T.def.theme === 'meadow') { g.fillStyle = '#2f7a35'; g.beginPath(); g.arc(x, y, 16, 0, TAU); g.fill(); g.fillStyle = '#3f9444'; g.beginPath(); g.arc(x - 4, y - 5, 10, 0, TAU); g.fill(); }
      else if (T.def.theme === 'desert') { g.fillStyle = '#b48a4a'; g.beginPath(); g.ellipse(x, y, 14, 9, 0, 0, TAU); g.fill(); }
      else { g.fillStyle = '#2f6b55'; g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x - 14, y + 10); g.lineTo(x + 14, y + 10); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x - 6, y - 8); g.lineTo(x + 6, y - 8); g.closePath(); g.fill(); }
    }
    // cầu nhảy
    for (const r of T.ramps) {
      g.save(); g.translate(r.x, r.y); g.rotate(r.a);
      g.fillStyle = '#7a4a22'; g.fillRect(-24, -r.hw, 48, r.hw * 2);
      for (let y = -r.hw; y < r.hw; y += 20) { g.fillStyle = (Math.floor((y + r.hw) / 20) % 2) ? '#ffcf2e' : '#222'; g.fillRect(-24, y, 10, 20); }
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (const y of [-r.hw * 0.5, 0, r.hw * 0.5]) { g.beginPath(); g.moveTo(-4, y - 10); g.lineTo(16, y); g.lineTo(-4, y + 10); g.closePath(); g.fill(); }
      g.restore();
    }
    // nhãn "Đường tắt" ở cửa vào
    if (T.sc) {
      const sc = T.sc, j = Math.round(sc.P.length * (T.def.labelAt || 0.22));
      g.save(); g.translate(sc.P[j][0], sc.P[j][1]); g.rotate(sc.ang[j]);
      g.font = '800 15px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = 'rgba(20,10,30,0.7)'; g.strokeText('ĐƯỜNG TẮT ›', 0, 0);
      g.fillStyle = '#fff'; g.fillText('ĐƯỜNG TẮT ›', 0, 0);
      g.restore();
    }
    // vạch đích ô cờ
    g.save(); g.translate(S[0][0], S[0][1]); g.rotate(T.ANG[0]);
    const sq = TW / 8;
    for (let r = 0; r < 2; r++) for (let k = 0; k < 8; k++) { g.fillStyle = (r + k) % 2 ? '#111' : '#fff'; g.fillRect(-sq + r * sq, -TW / 2 + k * sq, sq, sq); }
    g.restore();
    CANVAS[T.def.id] = c;
    return c;
  }
  function drawHazard(g, h, rnd) {
    const poly = h.poly;
    g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    if (h.kind === 'water' || h.kind === 'creek') {
      g.fillStyle = h.kind === 'creek' ? '#7fc4ea' : '#3f8fd8'; g.fill();
      g.lineWidth = 6; g.strokeStyle = h.kind === 'creek' ? '#e9f6ff' : '#2e6fb0'; g.stroke();
      g.save(); g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
        const x = Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + rnd() * (Math.max(...ys) - Math.min(...ys));
        g.beginPath(); g.moveTo(x - 10, y); g.quadraticCurveTo(x, y - 5, x + 10, y); g.stroke();
      }
      g.restore();
    } else {
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const gr = g.createLinearGradient(Math.min(...xs), 0, Math.max(...xs), 0);
      gr.addColorStop(0, '#3a1f10'); gr.addColorStop(0.5, '#120804'); gr.addColorStop(1, '#3a1f10');
      g.fillStyle = gr; g.fill();
      g.lineWidth = 8; g.strokeStyle = '#a0612e'; g.stroke();
    }
  }

  class Race {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      let tid = api.variant || TRACKS[0].id;
      if (tid === 'random' || !TRACKS.some((t) => t.id === tid)) tid = api.randTrack = api.randTrack || U.pick(TRACKS).id; // giữ nguyên lựa chọn ngẫu nhiên trong cùng ván
      this.T = buildTrack(TRACKS.find((t) => t.id === tid));
      const T = this.T;
      this.elapsed = 0; this.finished = false; this.place = 0; this.firstFinish = -1;
      this.balloon = api.mode === 'balloon';
      if (this.balloon) { this.total = this.time = api.T(90); this.outCount = 0; } else this.laps = api.count(LAPS);
      this.maxT = MAXT * api.len.count;
      const grid = U.shuffle(this.P.map((_, i) => i));   // xáo vị trí xuất phát cho công bằng
      this.cars = this.P.map((p, i) => {
        const g = grid[i], row = Math.floor(g / 2), col = g % 2;
        const si = (T.NS - 6 - row * 8) % T.NS;
        const pos = T.onRoad(si, col ? 34 : -34);
        return {
          x: pos.x, y: pos.y, h: T.ANG[si], vx: 0, vy: 0, v: 0, z: 0, vz: 0,
          si, prevS: T.CUM[si], cross: 0, done: false, time: 0, rank: 0,
          boostT: 0, boostCd: 0, spin: 0, oilImm: 0, off: false, r: 20, onSc: false, rampCd: 0, fall: 0, ghost: 0, wrongT: 0,
          item: null, shield: 0, jumpHeld: 0, drift: 0, driftDir: 0, bal: 3, out: false, popImm: 0, outT: 0,
          plan: null,
        };
      });
      this.boxes = T.boxes.map((b) => ({ x: b.x, y: b.y, t: 0 }));
      this.bananas = []; this.rockets = [];
      this.bannerText = ''; this.bannerT = 9; this.bannerColor = '#fff';
      this.fx = new Particles();   // hiệu ứng trong toạ độ bản đồ (vẽ cùng camera)
      this.cam = { x: WW / 2, y: WH / 2, z: ZMIN };
      this.updateCam(0, true);
    }

    /** camera: khung bao mọi xe còn đua (+ lề), thu phóng trong [ZMIN, ZMAX], không ra ngoài bản đồ */
    updateCam(dt, snap) {
      let list = this.cars.filter((c) => !c.out && !(c.done && !this.balloon));
      if (!list.length) list = this.cars.filter((c) => !c.out);
      if (!list.length) list = this.cars;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of list) {
        // nhìn trước theo hướng chạy một chút
        const ax = c.x + c.vx * 0.35, ay = c.y + c.vy * 0.35;
        x0 = Math.min(x0, c.x, ax); y0 = Math.min(y0, c.y, ay); x1 = Math.max(x1, c.x, ax); y1 = Math.max(y1, c.y, ay);
      }
      const M = 230, bw = x1 - x0 + M * 2, bh = y1 - y0 + M * 2 + 90;   // +90: chừa chỗ HUD phía trên
      const z = U.clamp(Math.min(W / bw, H / bh), ZMIN, ZMAX);
      const hw = W / z / 2, hh = H / z / 2;
      const cx = U.clamp((x0 + x1) / 2, hw, WW - hw), cy = U.clamp((y0 + y1) / 2 - 40 / z, hh, WH - hh);
      const C = this.cam;
      if (snap) { C.x = cx; C.y = cy; C.z = z; return; }
      C.z += (z - C.z) * Math.min(1, dt * (z < C.z ? 4 : 1.6));   // thu nhỏ nhanh, phóng to chậm
      const hw2 = W / C.z / 2, hh2 = H / C.z / 2;
      C.x += (U.clamp(cx, hw2, WW - hw2) - C.x) * Math.min(1, dt * 5);
      C.y += (U.clamp(cy, hh2, WH - hh2) - C.y) * Math.min(1, dt * 5);
      C.x = U.clamp(C.x, hw2, WW - hw2); C.y = U.clamp(C.y, hh2, WH - hh2);
    }
    toScreen(x, y) { const C = this.cam; return { x: (x - C.x) * C.z + W / 2, y: (y - C.y) * C.z + H / 2 }; }

    nearest(c, win) {
      const T = this.T;
      let best = c.si, bd = Infinity;
      for (let k = -win; k <= win; k++) {
        const i = (c.si + k + T.NS) % T.NS;
        const d = (T.S[i][0] - c.x) ** 2 + (T.S[i][1] - c.y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      return [best, Math.sqrt(bd)];
    }
    /** vị trí gần nhất trên đường tắt: [chỉ số mẫu, khoảng cách, quãng đã đi] */
    nearestSc(x, y) {
      const sc = this.T.sc;
      let bi = 0, bd = Infinity;
      for (let i = 0; i < sc.P.length; i++) { const d = (sc.P[i][0] - x) ** 2 + (sc.P[i][1] - y) ** 2; if (d < bd) { bd = d; bi = i; } }
      return [bi, Math.sqrt(bd), sc.cum[bi]];
    }
    /** mức máy của người i: 0 Dễ, 1 Trung bình, 2 Khó */
    lv(i) { const L = this.api.botOf(i) || {}; return L.actDrop > 0.4 ? 0 : L.actDrop > 0.1 ? 1 : 2; }
    progress(c) { return Math.min(c.cross, this.laps + 1) * this.T.L + this.T.CUM[c.si]; }
    speedOf(c) { return Math.hypot(c.vx, c.vy); }

    /** xe bị trúng chuối / tên lửa: có khiên thì mất khiên, không thì xoay vòng */
    hitCar(c, i) {
      const parts = this.fx;
      if (c.shield > 0) { c.shield = 0; Sfx.play('crown'); parts.text(c.x, c.y - 36, '🛡️ Chặn!', '#9fd8ff', 24); return; }
      c.spin = 0.9; c.drift = 0; Sfx.play('hurt'); Party.rumble(i, 0.7, 260); FX.shake(4);
      parts.burst(c.x, c.y, ['#ffe14d', '#fff'], 12, 200, 0.5, 6);
      if (this.balloon) this.pop(c, i);
    }
    /** RAC4: nổ một bong bóng; hết bong bóng thì bị loại */
    pop(c, i) {
      if (c.out || c.popImm > 0) return;
      c.bal--; c.popImm = 1.2;
      const parts = this.fx;
      Sfx.play('boom', 0.05);
      parts.burst(c.x, c.y - 30, [this.P[i].color.light, '#fff'], 14, 240, 0.4, 5);
      if (c.bal <= 0) { c.out = true; c.outT = this.elapsed; c.rank = this.n - this.outCount++; parts.text(c.x, c.y - 40, 'Bị loại!', '#fff', 30); }
      else parts.text(c.x, c.y - 44, `Bùm! còn ${c.bal} 🎈`, this.P[i].color.light, 22);
    }
    useItem(c, i) {
      const it = c.item; c.item = null;
      if (it === 'banana') this.bananas.push({ x: c.x - Math.cos(c.h) * 34, y: c.y - Math.sin(c.h) * 34, age: 0 });
      if (it === 'shield') c.shield = 8;
      if (it === 'rocket') {
        const me = this.progress(c);
        let tgt = -1, best = Infinity;
        if (this.balloon) this.cars.forEach((o, j) => { if (j === i || o.out) return; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < best) { best = d; tgt = j; } });
        else this.cars.forEach((o, j) => { if (j === i || o.done) return; const d = this.progress(o) - me; if (d > 0 && d < best) { best = d; tgt = j; } });
        this.rockets.push({ x: c.x + Math.cos(c.h) * 30, y: c.y + Math.sin(c.h) * 30, h: c.h, si: c.si, tgt, owner: i, life: 4 });
      }
      Sfx.play(it === 'rocket' ? 'shoot' : 'place');
    }

    /** rơi xuống sông/vực: hồi lại trên đường chính phía sau */
    startFall(c, i, h) {
      c.fall = 1.1; c.fallK = h.respawnK; c.drift = 0; c.boostT = 0;
      Sfx.play('fall'); Party.rumble(i, 0.6, 300);
      this.fx.burst(c.x, c.y, h.kind === 'canyon' ? ['#a0612e', '#3a1f10'] : ['#ffffff', '#7fc4ea'], 16, 220, 0.6, 6);
      this.fx.text(c.x, c.y - 36, h.kind === 'canyon' ? 'Rơi xuống vực!' : 'Rơi xuống nước!', '#fff', 24);
    }
    respawn(c) {
      const T = this.T, k = c.fallK;
      c.si = k; c.prevS = T.CUM[k];
      c.x = T.S[k][0]; c.y = T.S[k][1]; c.h = T.ANG[k];
      c.vx = c.vy = 0; c.v = 0; c.z = 0; c.vz = 0; c.spin = 0; c.onSc = false; c.ghost = 1.2; c.plan = null;
    }

    /** lái kiểu xe thật: ← → đánh lái, ↑ ga, ↓ phanh/lùi. Trả về ga (1), phanh/lùi (-1) hoặc thả (0). */
    steer(c, i, q, dt) {
      const parts = this.fx;
      const st = Math.abs(q.mx) > 0.2 ? U.clamp(q.mx, -1, 1) : 0;
      const vf = c.vx * Math.cos(c.h) + c.vy * Math.sin(c.h);
      const k = U.clamp(Math.abs(vf) / 150, 0, 1) * Math.sign(vf || 1);
      c.h += st * STEER * k * dt;
      const turning = st;
      const throttle = q.my < -0.3 ? 1 : q.my > 0.3 ? -1 : 0;
      // nút Nhảy: chạm = dùng vật phẩm; giữ khi ôm cua = drift, nhả ra được tăng tốc (RAC2)
      if (q.jump) {
        c.jumpHeld += dt;
        if (c.jumpHeld >= TAP && c.v > 200 && !c.done && c.z <= 0) {
          if (!c.drift && Math.abs(turning) > 0.25) { c.drift = 0.001; c.driftDir = Math.sign(turning); }
          if (c.drift) {
            c.drift += dt;
            c.h += c.driftDir * 1.4 * dt;   // bẻ cua gắt hơn
            if (Math.random() < 0.5) parts.burst(c.x - Math.cos(c.h) * 22, c.y - Math.sin(c.h) * 22, c.drift > 1.2 ? '#ff8a2e' : c.drift > 0.6 ? '#5fc8ff' : '#fff', 1, 50, 0.3, 4);
          }
        }
      } else {
        if ((c.jumpHeld > 0 && c.jumpHeld < TAP) || (q.jumpP && !c.jumpHeld)) { if (c.item && !c.done) this.useItem(c, i); }
        if (c.drift > 0.6) {
          c.boostT = Math.max(c.boostT, c.drift > 1.2 ? 0.9 : 0.5); Sfx.play('dash');
          parts.text(c.x, c.y - 36, c.drift > 1.2 ? 'Drift siêu tốc!' : 'Drift!', c.drift > 1.2 ? '#ff8a2e' : '#5fc8ff', 22);
        }
        c.drift = 0; c.jumpHeld = 0;
      }
      return throttle;
    }
    /** máy: đổi hướng mục tiêu (mx, my) từ botInput thành đánh lái / ga / phanh như người */
    botDrive(c, q) {
      const T = this.T, o = Object.assign({}, q);
      if (Math.abs(q.mx) < 0.05 && Math.abs(q.my) < 0.05) { o.mx = 0; o.my = -1; return o; }
      const ta = Math.atan2(q.my, q.mx), dh = U.angDiff(c.h, ta);
      o.mx = U.clamp(dh * 2.6, -1, 1);
      // tốc độ an toàn theo độ gắt của khúc cua phía trước
      const bend = Math.abs(U.angDiff(T.ANG[c.si], T.ANG[(c.si + 22) % T.NS]));
      const vsafe = 400 - 190 * U.clamp((bend - 0.7) / 1.6, 0, 1);
      const v = c.vx * Math.cos(c.h) + c.vy * Math.sin(c.h);
      o.my = (Math.abs(dh) > 1.3 && v > 140) || v > vsafe + 30 ? 1 : -1;   // ↓ phanh, ↑ ga
      return o;
    }
    /** điểm nhìn trước để bám đường (đang ở đường tắt thì bám đường tắt) */
    lookPoint(c, ahead) {
      const T = this.T;
      const scIdx = c.onSc && T.sc ? this.nearestSc(c.x, c.y)[0] : -1;
      if (scIdx >= 0) {
        const sc = T.sc, bi = scIdx, j = Math.min(sc.P.length - 1, bi + Math.round(ahead * 0.9));
        if (j >= sc.P.length - 2) { const k = (sc.to + 6) % T.NS; return { x: T.S[k][0], y: T.S[k][1] }; }
        return { x: sc.P[j][0], y: sc.P[j][1] };
      }
      const k = (c.si + ahead) % T.NS;
      return { x: T.S[k][0], y: T.S[k][1] };
    }

    update(dt, inp) {
      const parts = this.fx, T = this.T;
      this.bannerT += dt;
      this.fx.update(dt);
      if (!this.finished) this.elapsed += dt;
      if (this.balloon && !this.finished) this.time = Math.max(0, this.time - dt);
      this.cars.forEach((c, i) => {
        const q = inp[i] || {};
        if (c.out) { c.vx *= Math.pow(0.1, dt); c.vy *= Math.pow(0.1, dt); c.x += c.vx * dt; c.y += c.vy * dt; return; }
        c.boostT -= dt; c.boostCd -= dt; c.oilImm -= dt; c.popImm -= dt; c.rampCd -= dt; c.ghost -= dt; c.shield -= dt;
        if (c.fall > 0) { c.fall -= dt; if (c.fall <= 0) this.respawn(c); return; }
        const air = c.z > 0;
        let throttle = 1;
        if (c.spin > 0) {
          c.spin -= dt; c.h += 10 * dt; c.vx *= Math.pow(0.3, dt); c.vy *= Math.pow(0.3, dt);
        } else {
          const h0 = c.h;
          throttle = this.steer(c, i, this.P[i].bot ? this.botDrive(c, q) : q, dt);
          if (air) c.h = h0 + (c.h - h0) * 0.35;   // trên không chỉ xoay nhẹ
          if (q.actP && c.boostCd <= 0 && !c.done) { c.boostT = 1; c.boostCd = 3; Sfx.play('dash'); }
        }
        // mặt đường + bám đường (grip)
        let grip = 9, vmul = 1;
        if (c.off) vmul = 0.5;
        if (c.onSc) { grip = Math.min(grip, T.sc.grip); vmul = T.sc.vmul; }
        for (const p of T.ice) if (Math.hypot(p.x - c.x, p.y - c.y) < p.r) { grip = 2; }
        if (c.drift) grip = Math.min(grip, 4);
        if (!air && c.spin <= 0) {
          const fx = Math.cos(c.h), fy = Math.sin(c.h);
          let vf = c.vx * fx + c.vy * fy, vl = -c.vx * fy + c.vy * fx;
          vl *= Math.exp(-grip * dt);
          let vmax = c.done ? 170 : c.boostT > 0 ? VBOOST : VMAX;
          vmax *= vmul;
          if (this.P[i].bot) vmax *= 0.4 + 0.6 * this.api.botOf(i).speed;
          const acc = (grip < 3 ? ACC * 0.55 : ACC) * (c.boostT > 0 ? 2 : 1);   // tăng tốc bốc mạnh
          if (c.done) vf = U.approach(vf, vmax, 500 * dt);   // về đích rồi: xe tự chạy chậm
          else if (throttle > 0) vf = U.approach(vf, vmax, (vf < vmax ? acc : 700) * dt);
          else if (throttle < 0) vf = vf > 20 ? U.approach(vf, 0, 1100 * dt) : U.approach(vf, -150, 320 * dt);
          else vf = U.approach(vf, 0, 170 * dt);
          if (vf > vmax) vf = U.approach(vf, vmax, 700 * dt);
          c.vx = fx * vf - fy * vl; c.vy = fy * vf + fx * vl;
          c.v = vf;
        } else if (air) {
          c.z += c.vz * dt; c.vz -= GRAV * dt;
          if (c.z <= 0) {
            c.z = 0; c.vz = 0; Sfx.play('crash', 0.1); FX.shake(2);
            parts.burst(c.x, c.y + 10, ['#fff', '#ccc'], 8, 120, 0.4, 5);
          }
        }
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.x = U.clamp(c.x, 20, WW - 20); c.y = U.clamp(c.y, 20, WH - 20);
        // vị trí trên đường
        const [si, d] = this.nearest(c, 25);
        c.onSc = false;
        if (T.sc && d > T.TW / 2 - 14) {
          const [bi, ds, t] = this.nearestSc(c.x, c.y);
          if (ds < T.sc.w / 2 + 8 && bi > 0 && bi < T.sc.P.length - 1) {
            c.onSc = true;
            c.si = Math.round(T.sc.from + (T.sc.to - T.sc.from) * (t / T.sc.len)) % T.NS;
          }
        }
        if (!c.onSc) c.si = si;
        c.off = !c.onSc && d > T.TW / 2 + 10;
        // cầu nhảy
        if (c.z <= 0 && c.rampCd <= 0 && c.spin <= 0) {
          for (const r of T.ramps) {
            const dx = c.x - r.x, dy = c.y - r.y, al = dx * Math.cos(r.a) + dy * Math.sin(r.a), ac = -dx * Math.sin(r.a) + dy * Math.cos(r.a);
            const sp = this.speedOf(c);
            if (Math.abs(al) < 26 && Math.abs(ac) < r.hw && sp > 120 && Math.cos(c.h - r.a) > 0.3) {
              c.vz = Math.min(sp, VBOOST) * LAUNCH; c.z = 1; c.rampCd = 0.5; c.drift = 0;
              Sfx.play('jump'); parts.burst(c.x, c.y, ['#ffcf2e', '#fff'], 8, 140, 0.4, 5);
            }
          }
        }
        // vùng rơi
        if (c.z <= 0 && c.ghost <= 0) {
          for (const h of T.hazards) if (inPoly(c.x, c.y, h.poly)) { this.startFall(c, i, h); return; }
        }
        // đường tắt sa mạc: xương rồng
        if (T.sc && c.z <= 0) for (const k of T.sc.cacti) {
          const dx = c.x - k.x, dy = c.y - k.y, dd = Math.hypot(dx, dy);
          if (dd < k.r + 18 && dd > 0.01) {
            const nx = dx / dd, ny = dy / dd;
            c.x = k.x + nx * (k.r + 19); c.y = k.y + ny * (k.r + 19);
            // bật ra: đảo thành phần vận tốc hướng vào xương rồng, mất bớt tốc độ
            const vn = c.vx * nx + c.vy * ny;
            if (vn < 0) { c.vx -= 1.6 * vn * nx; c.vy -= 1.6 * vn * ny; c.vx *= 0.5; c.vy *= 0.5; Sfx.play('hit', 0.3); parts.text(c.x, c.y - 30, 'Ui da!', '#5dff9b', 20); }
          }
        }
        // đi ngược chiều (người chơi) → nhắc
        if (!this.P[i].bot && !this.balloon && !c.done && !c.onSc && this.speedOf(c) > 80 && Math.cos(Math.atan2(c.vy, c.vx) - T.ANG[c.si]) < -0.4) c.wrongT += dt;
        else c.wrongT = Math.max(0, c.wrongT - dt * 2);
        // vòng đua
        const s = T.CUM[c.si];
        if (this.balloon) { /* đấu bong bóng: không tính vòng */ } else if (c.prevS > 0.75 * T.L && s < 0.25 * T.L) {
          c.cross++;
          if (c.cross > this.laps && !c.done) {
            c.done = true; c.time = this.elapsed; c.rank = ++this.place;
            if (this.firstFinish < 0) this.firstFinish = this.elapsed;
            this.bannerText = `${this.P[i].name} về đích #${c.rank}!`; this.bannerColor = this.P[i].color.light; this.bannerT = 0;
            Sfx.play('win');
            parts.burst(c.x, c.y, ['#ffe14d', '#fff', this.P[i].color.main], 30, 380, 0.9, 6);
          } else if (c.cross >= 2 && c.cross <= this.laps) {
            parts.text(c.x, c.y - 36, c.cross === this.laps ? 'Vòng cuối!' : `Vòng ${c.cross}`, this.P[i].color.light, 26);
            Sfx.play('pickup');
          }
        } else if (c.prevS < 0.25 * T.L && s > 0.75 * T.L) c.cross--;
        c.prevS = s;
        if (c.z > 0) return;   // đang bay: không dính dầu / chuối / hộp
        if (c.oilImm <= 0 && c.spin <= 0) {
          for (const o of T.oils) {
            if (Math.hypot(o.x - c.x, o.y - c.y) < o.r + 8) {
              c.spin = 0.8; c.oilImm = 1.6; Sfx.play('hurt'); Party.rumble(i, 0.6, 250);
              parts.burst(c.x, c.y, '#222', 10, 160, 0.5, 6);
            }
          }
        }
        if (!c.item && !c.done) {
          for (const b of this.boxes) {
            if (b.t <= 0 && Math.hypot(b.x - c.x, b.y - c.y) < 32) {
              b.t = 3; c.item = U.pick(Object.keys(ITEMS)); Sfx.play('pickup');
              parts.text(c.x, c.y - 36, ITEMS[c.item], '#fff', 30);
              break;
            }
          }
        }
        if (c.spin <= 0) for (const bn of this.bananas) {
          if (!bn.dead && bn.age > 0.3 && Math.hypot(bn.x - c.x, bn.y - c.y) < 24) { bn.dead = true; this.hitCar(c, i); }
        }
        if (c.boostT > 0 && Math.random() < 0.6) parts.burst(c.x - Math.cos(c.h) * 24, c.y - Math.sin(c.h) * 24, ['#ffb12e', '#ff5a2e'], 1, 60, 0.3, 6);
        if (c.onSc && T.sc.surface !== 'ice' && this.speedOf(c) > 150 && Math.random() < 0.35) parts.burst(c.x - Math.cos(c.h) * 22, c.y - Math.sin(c.h) * 22, T.sc.surface === 'sand' ? '#e8c27e' : '#a8834f', 1, 40, 0.4, 5);
      });
      for (const b of this.boxes) b.t -= dt;
      for (const bn of this.bananas) bn.age += dt;
      this.bananas = this.bananas.filter((bn) => !bn.dead);
      // tên lửa: bám xe mục tiêu, không có mục tiêu thì bay theo đường đua
      for (const r of this.rockets) {
        r.life -= dt;
        let tx, ty;
        const tg = r.tgt >= 0 ? this.cars[r.tgt] : null;
        if (tg && !tg.done && tg.fall <= 0) { tx = tg.x; ty = tg.y; }
        else { r.si = this.nearest({ si: r.si, x: r.x, y: r.y }, 20)[0]; const k = (r.si + 12) % T.NS; tx = T.S[k][0]; ty = T.S[k][1]; }
        r.h += U.clamp(U.angDiff(r.h, Math.atan2(ty - r.y, tx - r.x)), -4 * dt, 4 * dt);
        r.x += Math.cos(r.h) * 580 * dt; r.y += Math.sin(r.h) * 580 * dt;
        if (Math.random() < 0.7) parts.burst(r.x - Math.cos(r.h) * 12, r.y - Math.sin(r.h) * 12, ['#ffb12e', '#fff'], 1, 40, 0.3, 4);
        this.cars.forEach((c, j) => { if (j !== r.owner && !c.out && c.fall <= 0 && c.z < 30 && !r.dead && Math.hypot(c.x - r.x, c.y - r.y) < 26) { r.dead = true; this.hitCar(c, j); Sfx.play('boom', 0.1); } });
        if (r.life <= 0) r.dead = true;
      }
      this.rockets = this.rockets.filter((r) => !r.dead);
      // va chạm giữa xe (cùng độ cao)
      for (let a = 0; a < this.n; a++) {
        for (let b = a + 1; b < this.n; b++) {
          const A = this.cars[a], B = this.cars[b];
          if (A.out || B.out || A.fall > 0 || B.fall > 0 || Math.abs(A.z - B.z) > 20) continue;
          const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
          if (d < 40 && d > 0.01) {
            if (this.balloon) {
              if (A.boostT > 0 && Math.cos(A.h - Math.atan2(dy, dx)) > 0.6 && B.shield <= 0) this.pop(B, b);
              if (B.boostT > 0 && Math.cos(B.h - Math.atan2(-dy, -dx)) > 0.6 && A.shield <= 0) this.pop(A, a);
            }
            const ov = (40 - d) / 2, nx = dx / d, ny = dy / d;
            A.x -= nx * ov; A.y -= ny * ov; B.x += nx * ov; B.y += ny * ov;
            // trao đổi một phần vận tốc theo phương va chạm
            const rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
            if (rel < 0) { const j = rel * 0.5; A.vx += j * nx; A.vy += j * ny; B.vx -= j * nx; B.vy -= j * ny; }
            if (d < 32) Sfx.play('hit', 0.2);
          }
        }
      }
      this.updateCam(dt);
      if (!this.finished && this.balloon) {
        if (this.cars.filter((c) => !c.out).length <= 1 || this.time <= 0) this.finished = true;
      } else if (!this.finished) {
        if (this.cars.every((c) => c.done) || (this.firstFinish >= 0 && this.elapsed - this.firstFinish > 15) || this.elapsed > this.maxT) {
          this.finished = true;
        }
      }
    }

    draw(ctx) {
      const T = this.T, C = this.cam;
      ctx.fillStyle = THEME[T.def.theme].bg; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(C.z, C.z); ctx.translate(-C.x, -C.y);
      ctx.drawImage(trackCanvas(T), 0, 0);
      for (const o of T.oils) {
        ctx.fillStyle = '#1b1b24';
        ctx.beginPath(); ctx.ellipse(o.x, o.y, o.r, o.r * 0.7, 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(140,120,255,0.35)';
        ctx.beginPath(); ctx.ellipse(o.x - 6, o.y - 4, o.r * 0.45, o.r * 0.2, 0.4, 0, TAU); ctx.fill();
      }
      if (T.sc) for (const k of T.sc.cacti) Draw.text(ctx, '🌵', k.x, k.y, { size: 40, stroke: null });
      const t = U.now();
      for (const b of this.boxes) {
        if (b.t > 0) continue;
        ctx.save(); ctx.translate(b.x, b.y + Math.sin(t * 4 + b.x) * 2); ctx.rotate(t * 1.5);
        ctx.fillStyle = `hsla(${(t * 120 + b.x) % 360},90%,60%,0.9)`; Draw.rr(ctx, -13, -13, 26, 26, 5); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        Draw.text(ctx, '?', b.x, b.y + 1, { size: 19, color: '#fff', sw: 3 });
      }
      for (const bn of this.bananas) Draw.text(ctx, '🍌', bn.x, bn.y, { size: 26, stroke: null });
      for (const r of this.rockets) {
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.h);
        ctx.fillStyle = '#e8384f'; Draw.rr(ctx, -12, -5, 24, 10, 5); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(12, -5); ctx.lineTo(18, 0); ctx.lineTo(12, 5); ctx.fill();
        ctx.restore();
      }
      const order = this.cars.map((_, i) => i).sort((a, b) => (this.cars[a].z - this.cars[b].z) || (this.cars[a].y - this.cars[b].y));
      for (const i of order) {
        const c = this.cars[i];
        this.drawCar(ctx, c, this.P[i].color);
        if (c.fall > 0) continue;
        const yy = c.y - c.z;
        if (c.shield > 0) { ctx.strokeStyle = `rgba(150,220,255,${0.5 + 0.3 * Math.sin(t * 8)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, yy, 32, 0, TAU); ctx.stroke(); }
        if (c.item) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(c.x + 28, yy - 30, 13, 0, TAU); ctx.fill();
          Draw.text(ctx, ITEMS[c.item], c.x + 28, yy - 29, { size: 16, stroke: null });
        }
      }
      this.fx.draw(ctx);
      ctx.restore();
      // chữ trên đầu xe vẽ theo toạ độ màn hình (không bị thu nhỏ theo camera)
      for (const i of order) {
        const c = this.cars[i];
        if (c.fall > 0 || c.out) continue;
        const p = this.toScreen(c.x, c.y - c.z), off = 36 * C.z + 8;
        Draw.text(ctx, this.P[i].name, p.x, p.y - off, { size: 16, color: this.P[i].color.light, sw: 4 });
        if (c.wrongT > 0.6 && Math.sin(t * 10) > -0.3) Draw.text(ctx, '⛔ Đi ngược chiều!', p.x, p.y - off - 24, { size: 20, color: '#ff6a6a', sw: 4 });
      }

      // xếp hạng hiện tại
      const ranking = this.cars.map((c, i) => i).sort((a, b) => {
        const A = this.cars[a], B = this.cars[b];
        if (A.done && B.done) return A.rank - B.rank;
        if (A.done) return -1; if (B.done) return 1;
        return this.progress(B) - this.progress(A);
      });
      const pos = []; ranking.forEach((i, k) => { pos[i] = k + 1; });
      if (this.balloon) {
        Draw.chips(ctx, this.P, this.cars.map((c) => (c.out ? 'Loại' : '🎈'.repeat(c.bal))), { w: 200, dim: this.cars.map((c) => c.out) });
        Draw.timer(ctx, this.time, W - 72, 38);
      } else {
        Draw.chips(ctx, this.P, this.cars.map((c, i) => (c.done ? `🏁 #${c.rank}` : `#${pos[i]} · V${U.clamp(c.cross, 1, this.laps)}/${this.laps}`)), { w: 200 });
        Draw.label(ctx, '⏱ ' + U.fmtTime(this.elapsed), W - 80, 38);
      }
      Draw.text(ctx, `${T.def.icon} ${T.def.name}`, 16, H - 18, { size: 18, color: '#fff', sw: 4, align: 'left' });
      if (this.firstFinish >= 0 && !this.finished) {
        Draw.text(ctx, `Kết thúc sau ${Math.ceil(15 - (this.elapsed - this.firstFinish))} giây`, W / 2, 92, { size: 24, color: '#ffe14d' });
      }
      if (this.bannerT < 1.6) Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 60, y: 300 });
    }

    drawCar(ctx, c, col) {
      let sc = 1 + c.z / 260, alpha = 1;
      if (c.fall > 0) { sc = Math.max(0.1, c.fall / 1.1); alpha = sc; }
      if (c.ghost > 0 && Math.sin(c.ghost * 30) > 0) alpha *= 0.4;
      // bóng đổ trên mặt đất
      if (c.z > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(c.x + 4, c.y + 6, 26 / (1 + c.z / 200), 16 / (1 + c.z / 200), c.h, 0, TAU); ctx.fill();
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y - c.z); ctx.rotate(c.h + (c.fall > 0 ? (1.1 - c.fall) * 6 : 0)); ctx.scale(sc, sc);
      if (c.z <= 0) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; Draw.rr(ctx, -22, -11, 48, 28, 10); ctx.fill(); }
      ctx.fillStyle = '#222';
      for (const [wx, wy] of [[-14, -15], [14, -15], [-14, 15], [14, 15]]) { Draw.rr(ctx, wx - 7, wy - 4, 14, 8, 3); ctx.fill(); }
      ctx.fillStyle = col.main; Draw.rr(ctx, -24, -14, 48, 28, 10); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(20,10,40,0.5)'; ctx.stroke();
      ctx.fillStyle = col.light; ctx.fillRect(-20, -3, 40, 6);
      ctx.fillStyle = 'rgba(150,220,255,0.9)'; Draw.rr(ctx, 8, -10, 9, 20, 4); ctx.fill();
      if (c.boostT > 0) {
        ctx.fillStyle = '#ffb12e';
        ctx.beginPath(); ctx.moveTo(-24, -7); ctx.lineTo(-40 - Math.random() * 10, 0); ctx.lineTo(-24, 7); ctx.fill();
      }
      ctx.restore();
      if (c.fall > 0) return;
      ctx.save(); ctx.globalAlpha = alpha;
      Draw.blob(ctx, { x: c.x - Math.cos(c.h) * 4, y: c.y - c.z - 8, r: 11 * sc, color: col, face: c.h, shadow: false, stun: c.spin > 0, dead: c.out });
      ctx.restore();
      if (this.balloon && !c.out) {
        const t = U.now();
        for (let k = 0; k < c.bal; k++) {
          const bx = c.x + (k - (c.bal - 1) / 2) * 14 + Math.sin(t * 3 + k) * 2, by = c.y - c.z - 48 - (k % 2) * 6;
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c.x, c.y - c.z - 14); ctx.lineTo(bx, by + 8); ctx.stroke();
          ctx.fillStyle = col.light; ctx.beginPath(); ctx.ellipse(bx, by, 7, 9, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = col.main; ctx.lineWidth = 2; ctx.stroke();
        }
      }
    }

    results() {
      if (this.balloon) return this.cars.map((c) => (c.out ? { score: c.outT, text: `Bị loại ở giây ${Math.floor(c.outT)}` } : { score: 1000 + c.bal, text: `Còn ${c.bal} 🎈` }));
      return this.cars.map((c) => (c.done
        ? { score: 1e6 - c.time, text: `Về thứ ${c.rank} · ${c.time.toFixed(1)} giây` }
        : { score: this.progress(c) / this.T.L, text: `Chưa về đích (vòng ${U.clamp(c.cross, 1, this.laps)}/${this.laps})` }));
    }

    /** tránh vùng rơi phía trước (máy) */
    avoidHazard(c, o) {
      for (const h of this.T.hazards) {
        for (const dd of [50, 90]) {
          const px = c.x + Math.cos(Math.atan2(o.my, o.mx)) * dd, py = c.y + Math.sin(Math.atan2(o.my, o.mx)) * dd;
          if (inPoly(px, py, h.poly) && !(h.main && !c.off)) {
            const n = Math.atan2(o.my, o.mx) + Math.PI / 2;
            const k = (c.si + 8) % this.T.NS, side = Math.cos(n) * (this.T.S[k][0] - c.x) + Math.sin(n) * (this.T.S[k][1] - c.y) > 0 ? 1 : -1;
            o.mx = Math.cos(n) * side; o.my = Math.sin(n) * side; return;
          }
        }
      }
    }
    balloonBot(c, i) {
      const T = this.T, o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (c.out || c.fall > 0) return o;
      let tg = null, bd = Infinity;
      this.cars.forEach((x, j) => { if (j !== i && !x.out && x.fall <= 0) { const d = Math.hypot(x.x - c.x, x.y - c.y); if (d < bd) { bd = d; tg = x; } } });
      let tx, ty;
      const box = !c.item && this.boxes.filter((b) => b.t <= 0).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
      if (box && Math.hypot(box.x - c.x, box.y - c.y) < 260) { tx = box.x; ty = box.y; }
      else if (tg) { tx = tg.x + tg.vx * 0.3; ty = tg.y + tg.vy * 0.3; }
      else return o;
      if (c.off) { const k = (c.si + 6) % T.NS; tx = (tx + T.S[k][0]) / 2; ty = (ty + T.S[k][1]) / 2; }
      const a = Math.atan2(ty - c.y, tx - c.x);
      o.mx = Math.cos(a); o.my = Math.sin(a);
      if (tg && bd < 220 && Math.abs(U.angDiff(c.h, Math.atan2(tg.y - c.y, tg.x - c.x))) < 0.35 && c.boostCd <= 0 && Math.random() < 0.08) o.actP = true;
      if (c.item && (c.item === 'shield' || (tg && bd < 350)) && Math.random() < 0.05) o.jumpP = true;
      for (const oil of T.oils) if (Math.hypot(oil.x - c.x, oil.y - c.y) < 70) { const n = c.h + Math.PI / 2; o.mx = o.mx * 0.5 + Math.cos(n) * 0.5; o.my = o.my * 0.5 + Math.sin(n) * 0.5; }
      this.avoidHazard(c, o);
      return o;
    }
    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) */
    posOf(i) {
      const c = this.cars[i];
      if (c.fall > 0) return null;
      const p = this.toScreen(c.x, c.y - c.z);
      return p.x < 0 || p.x > W || p.y < 0 || p.y > H ? null : p;   // ngoài khung camera (vd. xe đã về đích) → ẩn
    }

    botInput(i) {
      const c = this.cars[i], T = this.T;
      const o = { mx: 0, my: 0, actP: false };
      if (this.balloon) return this.balloonBot(c, i);
      if (c.fall > 0) return o;
      const sc = T.sc;
      // quyết định có đi đường tắt không (khi tới gần cửa vào)
      if (sc && !c.onSc) {
        const toEntry = (sc.from - c.si + T.NS) % T.NS;
        if (toEntry > 6 && toEntry < 34 && c.plan === null) {
          const p = [0.15, 0.4, 0.65][this.lv(i)];
          const needBoost = !!sc.rampX;
          c.plan = Math.random() < p && (!needBoost || c.boostCd < 1.5) ? 'sc' : 'main';
        }
        if (toEntry > 40 && toEntry < T.NS - 20) c.plan = null;
      }
      let tx, ty;
      const nearEntry = sc && ((sc.from - c.si + T.NS) % T.NS < 14 || (c.si - sc.from + T.NS) % T.NS < 30);
      if (sc && (c.onSc || (c.plan === 'sc' && nearEntry))) {
        if (c.onSc) { const p = this.lookPoint(c, 8); tx = p.x; ty = p.y; }
        else { const j = Math.min(sc.P.length - 1, sc.split + 2); tx = sc.P[j][0]; ty = sc.P[j][1]; }
        // lách xương rồng phía trước
        for (const k of sc.cacti) {
          const dx = k.x - c.x, dy = k.y - c.y, dd = Math.hypot(dx, dy), a0 = Math.atan2(ty - c.y, tx - c.x);
          if (dd < 150 && Math.abs(U.angDiff(a0, Math.atan2(dy, dx))) < 0.7) {
            const side = U.angDiff(a0, Math.atan2(dy, dx)) > 0 ? -1 : 1, n = a0 + side * Math.PI / 2;
            tx = k.x + Math.cos(n) * 56; ty = k.y + Math.sin(n) * 56;
            break;
          }
        }
        // cần tăng tốc để bay qua sông
        if (sc.rampX && c.boostCd <= 0) {
          const r = T.ramps.find((x) => x.sc);
          if (r && Math.hypot(r.x - c.x, r.y - c.y) < 300) o.actP = true;
        }
      } else {
        const look = (c.si + 10) % T.NS;
        tx = T.S[look][0]; ty = T.S[look][1];
        // né vũng dầu nằm trên đoạn đường sắp tới (trừ khi sắp bay qua bằng cầu nhảy)
        for (const oil of T.oils) {
          for (let k = 2; k <= 22; k += 2) {
            const j = (c.si + k) % T.NS;
            if (Math.hypot(oil.x - T.S[j][0], oil.y - T.S[j][1]) < 45) {
              if (T.ramps.some((r) => !r.sc && ((r.k - c.si + T.NS) % T.NS) < k)) break;
              const n = T.ANG[j] + Math.PI / 2;
              const side = ((oil.x - T.S[j][0]) * Math.cos(n) + (oil.y - T.S[j][1]) * Math.sin(n)) > 0 ? -1 : 1;
              tx = T.S[j][0] + Math.cos(n) * side * 50; ty = T.S[j][1] + Math.sin(n) * side * 50;
              break;
            }
          }
        }
        // né băng nếu được
        for (const ic of T.ice) {
          const j = (c.si + 8) % T.NS;
          if (Math.hypot(ic.x - T.S[j][0], ic.y - T.S[j][1]) < ic.r + 30) {
            const n = T.ANG[j] + Math.PI / 2, side = ((ic.x - T.S[j][0]) * Math.cos(n) + (ic.y - T.S[j][1]) * Math.sin(n)) > 0 ? -1 : 1;
            tx = T.S[j][0] + Math.cos(n) * side * (T.TW / 2 - 24); ty = T.S[j][1] + Math.sin(n) * side * (T.TW / 2 - 24);
          }
        }
        const straight = Math.abs(U.angDiff(T.ANG[c.si], T.ANG[(c.si + 30) % T.NS])) < 0.35;
        const saveBoost = c.plan === 'sc' && sc && sc.rampX;
        if (straight && !saveBoost && c.boostCd <= 0 && Math.random() < 0.04) o.actP = true;
      }
      const a = Math.atan2(ty - c.y, tx - c.x);
      o.mx = Math.cos(a); o.my = Math.sin(a);
      // vật phẩm
      if (c.item && c.spin <= 0) {
        const me = this.progress(c);
        const behind = this.cars.some((x, j) => j !== i && me - this.progress(x) > 0 && me - this.progress(x) < 140);
        const ahead = this.cars.some((x, j) => j !== i && !x.done && this.progress(x) - me > 0 && this.progress(x) - me < T.L * 0.3);
        if ((c.item === 'shield') || (c.item === 'banana' && behind) || (c.item === 'rocket' && ahead)) { if (Math.random() < 0.05) o.jumpP = true; }
        else if (Math.random() < 0.003) o.jumpP = true;
      }
      // tránh chuối ngay phía trước
      for (const bn of this.bananas) {
        const dx = bn.x - c.x, dy = bn.y - c.y, d = Math.hypot(dx, dy);
        if (d < 120 && Math.abs(U.angDiff(c.h, Math.atan2(dy, dx))) < 0.5) {
          const n = c.h + Math.PI / 2 * (U.angDiff(c.h, Math.atan2(dy, dx)) > 0 ? -1 : 1);
          o.mx = o.mx * 0.4 + Math.cos(n) * 0.6; o.my = o.my * 0.4 + Math.sin(n) * 0.6;
          break;
        }
      }
      return o;
    }
  }

  Party.register({
    id: 'race', name: 'Đua Xe', emoji: '🏎️',
    tagline: '3 đường đua dài · đường tắt, cầu nhảy · lái như xe thật',
    how: 'Lái như xe thật: ← → đánh lái, ↑ ga, ↓ phanh/lùi — cua gắt nhớ nhả ga hoặc phanh. Về đích trước là thắng. Ra khỏi đường thì chậm, mảng băng làm xe trượt, trúng chuối/tên lửa thì xe xoay. Cầu nhảy vàng đen hất xe bay qua sông/vực — chạy chậm quá là rơi. '
      + 'Đường tắt ngắn hơn nhưng có rủi ro. Đánh = tăng tốc. Hộp ? cho 🍌 🚀 🛡️ — chạm Nhảy để dùng; giữ Nhảy khi ôm cua để drift.',
    controls: { move: '← → lái · ↑ ga · ↓ phanh', act: 'Tăng tốc', jump: 'Vật phẩm · Drift' },
    modes: MODES,
    variants: VARIANTS,
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Race(api),
  });
})();

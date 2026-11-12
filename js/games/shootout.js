'use strict';
/* Đá luân lưu — góc nhìn từ sau lưng người sút (kiểu PES/FIFA), dùng chung cho:
   - chế độ "Luân lưu" của Bóng Đá (đá luân lưu ngay từ đầu),
   - trận "Bóng đá thật" hết giờ hòa (soccer.js tạo PenaltyShootout làm ván phụ).
   Luật theo IFAB (Luật 10.3): mỗi đội đá xen kẽ, đá đủ số lượt (mặc định 5) — đội nào không thể gỡ được nữa thì dừng sớm;
   hòa thì đá chết từng lượt; mọi người trong đội phải đá xong mới tới lượt ai đá lần hai. Bốc thăm đội đá trước.
   Người sút: giữ Đánh lấy lực (quá vạch đỏ → dễ vọt xà), hướng đang giữ lúc thả = góc sút, giữ Nhảy lúc thả = sút bổng (Panenka).
   Thủ môn: ←→ di chuyển trên vạch trước khi sút; lúc người sút chạy đà / bóng đang bay: Nhảy + hướng để bay người.
   Máy được điều khiển bên trong lớp này (không qua input) để chủ động được độ trễ phản xạ theo mức. */
(() => {
  const GL = 330, GR = 950, GCX = 640, CB = 250, GG = 470;   // cột trái/phải, xà ngang, vạch vôi
  const SPOT = { x: 640, y: 596 };
  const CHARGE_T = 0.85, PMAX = 1.3;      // giữ CHARGE_T giây = lực 100%; quá 100% là vùng đỏ
  const RUN_T = 0.45, DIVE_T = 0.45;      // chạy đà (tâm ngắm ẩn, vẫn đổi hướng được), thời gian bay người
  const BODY = 50, HAND = 56, KMOVE = 120, AIM_T = 9;
  const AIM_SP = 560, AIM_Y0 = GG - 100;  // tốc độ di chuyển tâm ngắm
  const AX0 = GL + 28, AX1 = GR - 28, AY0 = CB + 26, AY1 = GG - 16; // tâm ngắm không sát cột/xà quá
  const BR0 = 20, BR1 = 11;               // bán kính bóng ở chấm phạt đền / ở khung thành
  const PRE = 1.3, RES = 1.7;
  // máy theo mức: [Dễ, Trung bình, Khó]
  const BOT = {
    react: [0.38, 0.3, 0.24],             // thủ môn: phản xạ sau khi bóng rời chân
    acc: [0.55, 0.7, 0.82],               // thủ môn: đoán đúng hướng khi phản xạ
    guess: [0.45, 0.4, 0.35],             // thủ môn: bay người đoán trước lúc chạy đà
    pw: [[0.58, 1.12], [0.74, 1.06], [0.84, 1.02]], // người sút: lực nhắm tới
    err: [18, 7, 0],                      // người sút: lệch thêm
    feint: [0.1, 0.22, 0.32],             // người sút: đổi hướng lúc chạy đà
  };
  const ease = (k) => 1 - (1 - k) * (1 - k);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 0.75;
  const darker = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.round(v * 0.55)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

  // khán đài: chấm màu cố định (seed) để không nhấp nháy
  const CROWD = (() => {
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const cols = ['#ff5a6a', '#ffe14d', '#4dd0ff', '#5dff9b', '#ffffff', '#ff9a3a', '#c38bff', '#ff7ad9'];
    const a = [];
    for (let i = 0; i < 520; i++) a.push({ x: r() * W, y: 112 + r() * 126, c: cols[Math.floor(r() * cols.length)], p: r() * 6 });
    return a;
  })();

  class PenaltyShootout {
    /** opts: { kicks, match: bool, matchScore: [a,b] } */
    constructor(api, opts = {}) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.team = TEAMS.split(this.n);
      this.kicks = opts.kicks || api.count(5);
      this.match = !!opts.match; this.matchScore = opts.matchScore || null;
      this.order = [0, 1].map((t) => this.P.map((_, i) => i).filter((i) => this.team[i] === t));
      this.rec = [[], []];          // kết quả từng lượt: true = vào
      this.idx = [0, 0];            // lượt sút thứ mấy của mỗi đội (để xoay người sút)
      this.first = Math.random() < 0.5 ? 0 : 1;
      this.stats = this.P.map(() => ({ goals: 0, shots: 0, saves: 0 }));
      this.finished = false; this.winner = -1; this.endT = 0;
      this.bannerT = 9; this.bannerText = ''; this.bannerColor = '#fff';
      this.t = 0; this.netB = 0; this.flash = 0;
      this.startKick();
      this.banner(`🪙 Bốc thăm: ${TEAMS.names[this.first]} đá trước`, TEAMS.colors[this.first]);
    }
    teamOf(i) { return this.team[i]; }
    /** mức máy của người i: 0 Dễ, 1 Trung bình, 2 Khó (mỗi máy một mức) */
    lv(i) { const L = this.api.botOf(i) || {}; return L.actDrop > 0.4 ? 0 : L.actDrop > 0.1 ? 1 : 2; }
    banner(s, c) { this.bannerText = s; this.bannerColor = c || '#fff'; this.bannerT = 0; }
    goals(t) { return this.rec[t].filter(Boolean).length; }

    /** đội đá tiếp theo (xen kẽ, đội bốc thăm đá trước) */
    nextTeam() { const n = this.rec.map((r) => r.length); return n[this.first] <= n[1 - this.first] ? this.first : 1 - this.first; }
    /** đã phân thắng bại chưa? trả về đội thắng, -1 nếu chưa, -2 nếu dừng hòa */
    decide(rec) {
      const K = this.kicks, n = rec.map((r) => r.length), g = rec.map((r) => r.filter(Boolean).length);
      if (n[0] <= K && n[1] <= K) {
        for (const t of [0, 1]) if (g[t] > g[1 - t] + (K - n[1 - t])) return t;
        if (n[0] === K && n[1] === K && g[0] !== g[1]) return g[0] > g[1] ? 0 : 1;
        return -1;
      }
      if (n[0] === n[1] && g[0] !== g[1]) return g[0] > g[1] ? 0 : 1;
      if (n[0] >= K + 10 && n[1] >= K + 10) return -2;
      return -1;
    }
    startKick() {
      const st = this.nextTeam(), dt = 1 - st;
      const os = this.order[st], od = this.order[dt];
      const shooter = os[this.idx[st] % os.length];
      // thủ môn: người đội kia không phải người sút kế tiếp của họ (đội 1 người thì chính người đó)
      const keeper = od[(this.idx[dt] + 1) % od.length];
      // cú này có quyết định trận không? (vào hoặc trượt là xong) → áp lực
      const ifG = this.rec.map((r, t) => (t === st ? r.concat(true) : r)), ifM = this.rec.map((r, t) => (t === st ? r.concat(false) : r));
      const sudden = this.rec[0].length >= this.kicks && this.rec[1].length >= this.kicks;
      const pressure = this.decide(ifG) >= 0 || this.decide(ifM) >= 0 || sudden ? 1 : 0;
      this.k = {
        st, dt, shooter, keeper, phase: 'pre', t: PRE, pw: 0, held: false, shot: null, kx: GCX, kvx: 0, ax: GCX, ay: AIM_Y0, chip: false,
        dive: null, res: '', pressure, sudden, beat: 0,
        ball: { x: SPOT.x, y: SPOT.y, r: BR0, z: 0, vx: 0, vy: 0 },
        sx: SPOT.x - 70, sy: SPOT.y + 58,
        bot: null,
      };
      this.k.bot = this.planBot();
      if (pressure && this.rec[0].length + this.rec[1].length > 0) this.k.preNote = sudden ? '☠️ Đá chết!' : '⚡ Cú sút quyết định!';
    }

    /* ---------- máy ---------- */
    planBot() {
      const k = this.k, o = {};
      if (this.P[k.shooter].bot) {
        const L = this.lv(k.shooter);
        const r = Math.random();
        const mx = r < 0.42 ? -1 : r < 0.84 ? 1 : r < 0.89 ? -0.6 : r < 0.94 ? 0.6 : 0;
        const r2 = Math.random(), my = r2 < 0.28 ? -1 : r2 < 0.62 ? 0 : 1;
        const [a, b] = BOT.pw[L];
        const tx = (m) => GCX + m * 265, ty = (m) => (m < 0 ? CB + 34 : m > 0 ? GG - 26 : AIM_Y0);
        o.shoot = { wait: U.rand(0.4, 1.0), tx: tx(mx), ty: ty(my), pw: U.rand(a, b), chip: Math.random() < [0.03, 0.04, 0.05][L] };
        if (o.shoot.chip) { o.shoot.tx = GCX; o.shoot.ty = AIM_Y0; }
        // động tác giả: lúc chạy đà kéo tâm sang phía kia
        if (!o.shoot.chip && mx !== 0 && Math.random() < BOT.feint[L]) o.shoot.feint = { tx: tx(-mx), ty: ty(my) };
      }
      if (this.P[k.keeper].bot) {
        const L = this.lv(k.keeper);
        o.keep = { sway: 0, swayT: 0 };
        if (Math.random() < BOT.guess[L]) { // đoán trước lúc chạy đà
          const r = Math.random();
          o.keep.guess = { at: U.rand(0.05, RUN_T - 0.02), dx: r < 0.44 ? -1 : r < 0.88 ? 1 : 0, dy: [-1, 0, 0, 1][Math.floor(Math.random() * 4)] };
        } else o.keep.react = BOT.react[L] * U.rand(0.85, 1.2);
      }
      return o;
    }
    botShooter(dt) {
      const k = this.k, b = k.bot.shoot;
      if (!b) return null;
      const steer = (tx, ty) => {
        const dx = tx - k.ax, dy = ty - k.ay;
        return { mx: Math.abs(dx) < 6 ? 0 : U.clamp(dx / 40, -1, 1), my: Math.abs(dy) < 6 ? 0 : U.clamp(dy / 40, -1, 1) };
      };
      if (k.phase === 'run') return Object.assign(b.feint ? steer(b.feint.tx, b.feint.ty) : { mx: 0, my: 0 }, { act: false, jump: b.chip });
      if (k.phase !== 'aim') return { mx: 0, my: 0, act: false, jump: false };
      b.wait -= dt;
      const o = steer(b.tx, b.ty);
      if (b.wait > 0) return Object.assign(o, { act: false, jump: false });
      const there = Math.abs(b.tx - k.ax) < 14 && Math.abs(b.ty - k.ay) < 14;
      return Object.assign(o, { act: k.pw < b.pw || !there, jump: b.chip });
    }
    botKeeper(dt) {
      const k = this.k, b = k.bot.keep, o = { mx: 0, my: 0, jumpP: false };
      if (!b) return null;
      if (k.phase === 'aim' || k.phase === 'pre') {
        b.swayT -= dt;
        if (b.swayT <= 0) { b.swayT = U.rand(0.5, 1.2); b.sway = U.rand(-50, 50); }
        const d = GCX + b.sway - k.kx; o.mx = Math.abs(d) > 8 ? Math.sign(d) * 0.6 : 0;
        return o;
      }
      if (k.dive) return o;
      if (b.guess && k.phase === 'run' && RUN_T - k.t >= b.guess.at) { o.jumpP = true; o.mx = b.guess.dx; o.my = b.guess.dy; return o; }
      if (b.react !== undefined && k.phase === 'fly' && k.shot.t >= b.react) {
        const S = k.shot, L = this.lv(k.keeper);
        let dx = Math.abs(S.tx - k.kx) < 70 ? 0 : Math.sign(S.tx - k.kx);
        if (Math.random() > BOT.acc[L]) dx = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : (Math.random() < 0.6 ? -dx : 0);
        let dy = S.ty < CB + 80 ? -1 : S.ty > GG - 55 ? 1 : 0;
        if (Math.random() > BOT.acc[L]) dy = [-1, 0, 1][Math.floor(Math.random() * 3)];
        o.jumpP = true; o.mx = dx; o.my = dy;
      }
      return o;
    }

    /* ---------- thủ môn: hình học ---------- */
    keeperGeo() {
      const k = this.k, D = k.dive, base = { x: k.kx, y: GG - 58 };
      if (!D) return { c: base, hands: [{ x: k.kx - 58, y: GG - 74, r: 30 }, { x: k.kx + 58, y: GG - 74, r: 30 }], ang: 0, p: 0 };
      const p = ease(Math.min(1, D.t / DIVE_T));
      const ux = D.tx - D.sx, uy = D.ty - D.sy, ul = Math.hypot(ux, uy) || 1;
      const nx = ux / ul, ny = uy / ul;
      const reach = BODY - 8;
      const c = { x: D.sx + (D.tx - nx * reach - D.sx) * p, y: D.sy + (D.ty - ny * reach - D.sy) * p };
      if (D.dx === 0) { // đứng chặn giữa / bật cao / đổ thấp: hai tay hai bên
        const sp = D.dy === 1 ? 54 : 46;
        const hy = c.y - (D.dy === -1 ? 36 : D.dy === 1 ? 6 : 30);
        return { c, hands: [{ x: c.x - sp, y: hy, r: HAND * 0.75 }, { x: c.x + sp, y: hy, r: HAND * 0.75 }], ang: 0, p };
      }
      return { c, hands: [{ x: c.x + nx * (BODY + 4), y: c.y + ny * (BODY + 4), r: HAND * (0.55 + 0.45 * p) }], ang: nx * (Math.PI / 2) * p * (D.dy === 1 ? 0.95 : 0.8), p };
    }
    doDive(dx, dy) {
      const k = this.k;
      if (k.dive) return;
      let tx, ty;
      if (dx === 0) { tx = k.kx; ty = dy === -1 ? CB + 72 : dy === 1 ? GG - 36 : GG - 112; }
      else { tx = U.clamp(k.kx + dx * 260, GL + 44, GR - 44); ty = dy === -1 ? CB + 52 : dy === 1 ? GG - 30 : GG - 84; }
      k.dive = { dx, dy, t: 0, sx: k.kx, sy: GG - 58, tx, ty };
      Sfx.play('dash');
    }

    /* ---------- sút ---------- */
    /** độ lệch (px) theo lực — cũng là cỡ vòng tâm ngắm */
    spread(pw) {
      const p1 = Math.min(1, Math.max(0.15, pw));
      return 9 + 40 * Math.max(0, p1 - 0.75) + 12 * this.k.pressure;
    }
    /** chỗ bóng sẽ tới nếu không lệch (quá lực thì bốc lên) */
    aimPoint() {
      const k = this.k;
      if (k.chip) return { x: GCX + (k.ax - GCX) * 0.75, y: GG - 98 };
      return { x: k.ax, y: k.ay - Math.max(0, k.pw - 1) * 420 };
    }
    shoot() {
      const k = this.k, pw = Math.max(0.15, k.pw), p1 = Math.min(1, pw), A = this.aimPoint();
      let sig, dur, arc;
      if (k.chip) { sig = 20 + 10 * k.pressure; dur = 1.0; arc = 170; }
      else { sig = this.spread(pw); dur = 0.95 - 0.53 * p1; arc = 34 * (1 - p1) + 8; }
      if (this.P[k.shooter].bot) sig += BOT.err[this.lv(k.shooter)];
      const tx = A.x + gauss() * sig, ty = A.y + gauss() * sig * 0.8;
      k.shot = { tx, ty, dur, arc, chip: k.chip, pw, t: 0, x0: SPOT.x, y0: SPOT.y };
      this.stats[k.shooter].shots++;
    }
    judge() {
      const k = this.k, S = k.shot, br = BR1;
      const inX = S.tx > GL - br && S.tx < GR + br;
      if (S.ty < CB - br || !inX) {
        // sát khung: dội cột / xà
        const nearBar = S.ty >= CB - br - 10 && S.ty < CB - br + 2 && S.tx > GL - 6 && S.tx < GR + 6;
        const nearPost = S.ty >= CB - 6 && (Math.abs(S.tx - GL) < br + 12 || Math.abs(S.tx - GR) < br + 12);
        if (nearBar || nearPost) return 'post';
        return S.ty < CB - br ? 'over' : 'wide';
      }
      if (Math.abs(S.tx - GL) < br + 4 || Math.abs(S.tx - GR) < br + 4 || Math.abs(S.ty - CB) < br + 3) return Math.random() < 0.4 ? 'postin' : 'post';
      const G = this.keeperGeo();
      const dB = Math.hypot(S.tx - G.c.x, S.ty - G.c.y);
      if (dB < BODY + br) return 'save';
      for (const h of G.hands) {
        const d = Math.hypot(S.tx - h.x, S.ty - h.y);
        if (d < h.r + br) return (!S.chip && S.pw > 0.85 && d > 0.72 * (h.r + br) && Math.random() < 0.45) ? 'tip' : 'save';
      }
      return 'goal';
    }

    update(dt, inp) {
      this.t += dt; this.bannerT += dt; this.flash = Math.max(0, this.flash - dt);
      this.netB = Math.max(0, this.netB - dt * 2.2);
      if (this.finished) return;
      const k = this.k;
      const qs = this.botShooter(dt) || inp[k.shooter] || {}, qk = this.botKeeper(dt) || inp[k.keeper] || {};
      // thủ môn di chuyển trên vạch trước khi sút
      if (k.phase === 'pre' || k.phase === 'aim') {
        k.kvx = U.approach(k.kvx, (qk.mx || 0) * 230, 1400 * dt);
        k.kx = U.clamp(k.kx + k.kvx * dt, GCX - KMOVE, GCX + KMOVE);
      }
      if (k.dive) k.dive.t += dt;
      else if (qk.jumpP && (k.phase === 'run' || k.phase === 'fly')) {
        let dx = qk.mx < -0.35 ? -1 : qk.mx > 0.35 ? 1 : 0, dy = qk.my < -0.35 ? -1 : qk.my > 0.35 ? 1 : 0;
        // bóng đã bay mà không giữ hướng → tự bay về phía bóng (chỉ cần canh đúng lúc)
        if (k.phase === 'fly' && dx === 0 && dy === 0) {
          const S = k.shot;
          dx = Math.abs(S.tx - k.kx) < 70 ? 0 : Math.sign(S.tx - k.kx);
          dy = S.ty < CB + 80 ? -1 : S.ty > GG - 55 ? 1 : 0;
        }
        this.doDive(dx, dy);
      }
      // người sút di chuyển tâm ngắm (lúc chạy đà vẫn đổi được nhưng tâm bị ẩn)
      if (k.phase === 'aim' || k.phase === 'run') {
        k.ax = U.clamp(k.ax + (qs.mx || 0) * AIM_SP * dt, AX0, AX1);
        k.ay = U.clamp(k.ay + (qs.my || 0) * AIM_SP * 0.75 * dt, AY0, AY1);
      }
      if (k.phase === 'pre') {
        k.t -= dt;
        if (k.t <= 0) { k.phase = 'aim'; k.t = AIM_T; if (k.preNote) this.banner(k.preNote, '#ffe14d'); }
      } else if (k.phase === 'aim') {
        k.t -= dt;
        if (k.pressure) { k.beat -= dt; if (k.beat <= 0) { k.beat = 0.55; Sfx.tone(70, 0.09, 'sine', 0.25); } }
        if (qs.act) { k.held = true; k.pw = Math.min(PMAX, k.pw + dt / CHARGE_T); }
        const released = k.held && !qs.act;
        if (released || k.t <= 0) {
          if (!k.held) k.pw = 0.6;
          k.chip = k.held && !!qs.jump;
          k.phase = 'run'; k.t = RUN_T;
        }
      } else if (k.phase === 'run') {
        k.t -= dt;
        const r = 1 - k.t / RUN_T;
        k.sx = SPOT.x - 70 + 46 * r; k.sy = SPOT.y + 58 - 16 * r;
        if (k.t <= 0) { this.shoot(); k.phase = 'fly'; Sfx.play('kick'); FX.shake(2 + 4 * Math.min(1, k.shot.pw)); }
      } else if (k.phase === 'fly') {
        const S = k.shot; S.t += dt;
        const r = Math.min(1, S.t / S.dur), B = k.ball;
        B.x = U.lerp(S.x0, S.tx, r); B.y = U.lerp(S.y0, S.ty, r) - Math.sin(Math.PI * r) * S.arc; B.r = U.lerp(BR0, BR1, ease(r));
        if (r >= 1) this.resolve();
      } else if (k.phase === 'res') {
        k.t -= dt;
        const B = k.ball;
        B.x += B.vx * dt; B.y += B.vy * dt; B.vy += (k.res === 'save' || k.res === 'post' ? 900 : 0) * dt;
        if (k.res === 'goal' || k.res === 'tip' || k.res === 'postin') { B.vx *= Math.pow(0.02, dt); B.vy *= Math.pow(0.02, dt); B.r = Math.max(9, B.r - dt * 3); }
        if (k.res === 'over' || k.res === 'wide') B.r = Math.max(5, B.r - dt * 8);
        if (k.t <= 0) this.nextKick();
      }
    }
    resolve() {
      const k = this.k, B = k.ball, parts = this.api.parts, S = k.shot;
      let res = this.judge();
      k.res = res; k.phase = 'res'; k.t = RES;
      const goal = res === 'goal' || res === 'tip' || res === 'postin';
      const sc = TEAMS.colors[k.st], kc = TEAMS.colors[k.dt];
      if (goal) {
        B.vx = (S.tx - GCX) * 0.25; B.vy = -40; this.netB = 1;
        Sfx.play('goal'); FX.shake(8); parts.burst(S.tx, S.ty, ['#ffe14d', '#fff', sc], 30, 320, 0.8, 6);
        this.banner(res === 'tip' ? 'Chạm tay… vẫn VÀO!' : res === 'postin' ? 'Dội cột… VÀO!' : S.chip ? 'Panenka! VÀO!' : 'VÀO!', sc);
        this.stats[k.shooter].goals++;
      } else if (res === 'save') {
        const G = this.keeperGeo();
        B.vx = (S.tx - G.c.x) * 3 + U.rand(-120, 120); B.vy = U.rand(120, 260);
        Sfx.play('crown'); FX.shake(4); parts.burst(S.tx, S.ty, ['#fff', kc], 16, 220, 0.5, 5);
        this.banner(S.chip ? 'Panenka hụt — bắt gọn!' : 'CẢN PHÁ!', kc); this.stats[k.keeper].saves++;
        Party.rumble(k.shooter, 0.4, 160);
      } else if (res === 'post') {
        B.vx = (S.tx < GCX ? 1 : -1) * U.rand(150, 260); B.vy = 180;
        Sfx.play('crash'); FX.shake(6); parts.burst(S.tx, S.ty, ['#fff'], 12, 200, 0.4, 4);
        this.banner('Dội cột!', '#fff');
      } else {
        B.vx = (S.tx - GCX) * 0.8; B.vy = res === 'over' ? -260 : -60;
        Sfx.play('fall'); this.banner(res === 'over' ? 'Vọt xà!' : 'Ra ngoài!', '#fff');
      }
      this.rec[k.st].push(goal); this.idx[k.st]++; // người bắt của đội kia xoay theo idx của đội đó
      this.flash = 0.25;
      const w = this.decide(this.rec);
      if (w !== -1) this.pendingEnd = w;
    }
    nextKick() {
      if (this.pendingEnd !== undefined) {
        const w = this.pendingEnd;
        this.winner = w >= 0 ? w : -1; this.finished = true;
        if (w >= 0) { this.banner(`🏆 ${TEAMS.names[w]} thắng luân lưu ${this.goals(w)}–${this.goals(1 - w)}!`, TEAMS.colors[w]); Sfx.play('win'); }
        else this.banner('Hòa!', '#fff');
        return;
      }
      this.startKick();
    }

    results() {
      return this.P.map((_, i) => {
        const t = this.team[i], st = this.stats[i];
        const me = ` · ghi ${st.goals}/${st.shots}` + (st.saves ? ` · cản ${st.saves}` : '');
        return { score: this.winner === t ? 1 : 0, text: `${TEAMS.names[t]} · ${this.goals(t)} – ${this.goals(1 - t)}${me}` };
      });
    }
    botInput() { return {}; }
    /** vị trí người chơi trên màn hình (cho biểu cảm / rung) */
    waitPos(i) {
      const t = this.team[i], list = this.order[t].filter((j) => j !== this.k.shooter && j !== this.k.keeper), k = list.indexOf(i);
      return { x: t === 0 ? 90 + k * 64 : W - 90 - k * 64, y: 668 };
    }
    posOf(i) {
      const k = this.k;
      if (i === k.shooter) return { x: k.sx, y: k.sy - 30 };
      if (i === k.keeper) { const c = this.keeperGeo().c; return { x: c.x, y: c.y }; }
      return this.waitPos(i);
    }

    /* ---------- vẽ ---------- */
    draw(ctx) {
      const k = this.k;
      // trời + khán đài
      const sky = ctx.createLinearGradient(0, 0, 0, 260);
      sky.addColorStop(0, '#0d1030'); sky.addColorStop(1, '#2a2f5c');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 262);
      ctx.fillStyle = '#1a1c3a'; ctx.fillRect(0, 106, W, 136);
      for (const d of CROWD) {
        const jump = this.flash > 0 || (k.phase === 'res' && /goal|tip|postin/.test(k.res)) ? Math.abs(Math.sin(this.t * 14 + d.p)) * 5 : Math.sin(this.t * 2 + d.p) * 1;
        ctx.fillStyle = d.c; ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.arc(d.x, d.y - jump, 4.2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // bảng quảng cáo
      ctx.fillStyle = '#20264d'; ctx.fillRect(0, 238, W, 26);
      for (let x = 0; x < W; x += 160) { ctx.fillStyle = (x / 160) % 2 ? '#ffe14d' : '#4dd0ff'; ctx.globalAlpha = 0.85; ctx.fillRect(x + 10, 243, 140, 16); }
      ctx.globalAlpha = 1;
      // sân cỏ phối cảnh
      const g = ctx.createLinearGradient(0, 264, 0, H);
      g.addColorStop(0, '#3f9a45'); g.addColorStop(1, '#5cc35f');
      ctx.fillStyle = g; ctx.fillRect(0, 264, W, H - 264);
      let y = 264, h = 14;
      for (let s = 0; y < H; s++) { if (s % 2) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, y, W, h); } y += h; h *= 1.28; }
      // vạch vôi
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, GG + 2); ctx.lineTo(W, GG + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(GL - 90, GG + 2); ctx.lineTo(GL - 150, 540); ctx.lineTo(GR + 150, 540); ctx.lineTo(GR + 90, GG + 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(GL - 300, GG + 2); ctx.lineTo(GL - 520, H); ctx.moveTo(GR + 300, GG + 2); ctx.lineTo(GR + 520, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(GL - 520, H - 1); ctx.lineTo(GR + 520, H - 1); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(SPOT.x, SPOT.y + 12, 12, 5, 0, 0, TAU); ctx.fill();
      // khung thành
      this.drawGoal(ctx);
      // thủ môn
      this.drawKeeper(ctx);
      if (k.phase === 'aim') this.drawAim(ctx);
      // bóng (đang bay cao thì vẽ trước/sau tùy)
      const B = k.ball;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const shY = k.shot && k.phase !== 'pre' && k.phase !== 'aim' && k.phase !== 'run' ? U.lerp(SPOT.y + 14, GG, Math.min(1, k.shot.t / k.shot.dur)) : SPOT.y + 14;
      ctx.beginPath(); ctx.ellipse(B.x, Math.max(B.y + B.r * 0.8, shY), B.r * 0.9, B.r * 0.32, 0, 0, TAU); ctx.fill();
      const flying = k.phase === 'fly' || k.phase === 'res';
      if (!flying) this.drawBall(ctx, B);
      // người đang chờ
      this.P.forEach((p, i) => {
        if (i === k.shooter || i === k.keeper) return;
        const q = this.waitPos(i);
        Draw.blob(ctx, { x: q.x, y: q.y, r: 26, color: p.color, face: -Math.PI / 2, walk: 0 });
        Draw.text(ctx, p.name, q.x, q.y - 40, { size: 16, color: p.color.light, sw: 3 });
      });
      // người sút (nhìn từ phía sau)
      const sp = this.P[k.shooter];
      Draw.blob(ctx, { x: k.sx, y: k.sy, r: 54, color: sp.color, face: -Math.PI / 2, walk: k.phase === 'run' ? this.t * 22 : 0, squash: k.phase === 'aim' && k.held ? -0.08 * Math.min(1, k.pw) : 0 });
      Draw.text(ctx, sp.name, k.sx, k.sy - 80, { size: 20, color: sp.color.light, sw: 4 });
      if (flying) this.drawBall(ctx, B); // bóng đã rời chân: vẽ đè lên người sút cho dễ nhìn
      if (k.phase === 'aim' || k.phase === 'run') this.drawPower(ctx);
      this.drawHud(ctx);
      if (this.bannerT < 1.6) Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 60, y: 372 });
    }
    drawGoal(ctx) {
      const nb = this.netB, bx0 = GL + 46, bx1 = GR - 46, by0 = CB + 8, by1 = GG - 30;
      const bulge = nb * 16;
      // lưới: mặt sau + hai bên
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(GL, CB); ctx.lineTo(bx0, by0 - bulge * 0.4); ctx.lineTo(bx1, by0 - bulge * 0.4); ctx.lineTo(GR, CB); ctx.lineTo(GR, GG); ctx.lineTo(bx1, by1 - bulge); ctx.lineTo(bx0, by1 - bulge); ctx.lineTo(GL, GG); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1.5;
      for (let i = 0; i <= 16; i++) {
        const x = U.lerp(bx0, bx1, i / 16), w = Math.sin(Math.PI * i / 16) * bulge;
        ctx.beginPath(); ctx.moveTo(x, by0 - w * 0.4); ctx.lineTo(x, by1 - w); ctx.stroke();
      }
      for (let j = 0; j <= 8; j++) {
        const yy = U.lerp(by0, by1, j / 8), w = Math.sin(Math.PI * j / 8) * bulge;
        ctx.beginPath(); ctx.moveTo(bx0, yy - w); ctx.lineTo(bx1, yy - w); ctx.stroke();
      }
      for (const [x0, x1] of [[GL, bx0], [GR, bx1]]) {
        for (let j = 0; j <= 8; j++) { ctx.beginPath(); ctx.moveTo(x0, U.lerp(CB, GG, j / 8)); ctx.lineTo(x1, U.lerp(by0, by1, j / 8)); ctx.stroke(); }
      }
      ctx.beginPath(); ctx.moveTo(GL, CB); ctx.lineTo(bx0, by0); ctx.moveTo(GR, CB); ctx.lineTo(bx1, by0); ctx.moveTo(GL, GG); ctx.lineTo(bx0, by1); ctx.moveTo(GR, GG); ctx.lineTo(bx1, by1); ctx.stroke();
      // cột + xà
      ctx.fillStyle = '#f4f4f4'; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
      ctx.fillRect(GL - 7, CB - 7, 14, GG - CB + 9); ctx.strokeRect(GL - 7, CB - 7, 14, GG - CB + 9);
      ctx.fillRect(GR - 7, CB - 7, 14, GG - CB + 9); ctx.strokeRect(GR - 7, CB - 7, 14, GG - CB + 9);
      ctx.fillRect(GL - 7, CB - 7, GR - GL + 14, 14); ctx.strokeRect(GL - 7, CB - 7, GR - GL + 14, 14);
    }
    drawKeeper(ctx) {
      const k = this.k, p = this.P[k.keeper], G = this.keeperGeo();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(G.c.x, GG + 4, 48, 12, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(G.c.x, G.c.y); ctx.rotate(G.ang);
      Draw.blob(ctx, { x: 0, y: 0, r: BODY, color: p.color, face: Math.PI / 2, shadow: false, squash: k.dive ? -0.12 : 0 });
      ctx.restore();
      for (const h of G.hands) {
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = p.color.dark || '#333'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(h.x, h.y, 15, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = p.color.main; ctx.beginPath(); ctx.arc(h.x, h.y, 6, 0, TAU); ctx.fill();
      }
      Draw.text(ctx, `🧤 ${p.name}`, G.c.x, G.c.y - 74, { size: 18, color: p.color.light, sw: 4 });
    }
    drawBall(ctx, B) {
      ctx.save(); ctx.translate(B.x, B.y);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = Math.max(1.5, B.r * 0.12);
      ctx.beginPath(); ctx.arc(0, 0, B.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.rotate(this.k.phase === 'fly' ? this.t * 18 : 0.3);
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(0, 0, B.r * 0.32, 0, TAU); ctx.fill();
      for (let a = 0; a < 5; a++) { const an = a * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(an) * B.r * 0.78, Math.sin(an) * B.r * 0.78, B.r * 0.2, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    /** tâm ngắm trong khung thành + mũi tên nét đứt từ bóng tới tâm */
    drawAim(ctx) {
      const k = this.k, c = this.P[k.shooter].color, A = this.aimPoint();
      const R = k.chip ? 26 : 12 + this.spread(k.pw || 0) * 1.5;
      const out = A.y < CB + 4 || A.x < GL + 4 || A.x > GR - 4;
      const col = out ? '#ff4a4a' : c.light;
      // mũi tên
      const bx = SPOT.x, by = SPOT.y - 8, dx = A.x - bx, dy = A.y - by, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const ex = A.x - ux * (R + 6), ey = A.y - uy * (R + 6);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.setLineDash([14, 10]); ctx.lineDashOffset = -this.t * 40;
      ctx.strokeStyle = 'rgba(20,10,40,0.55)'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
      ctx.translate(ex, ey); ctx.rotate(Math.atan2(uy, ux));
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-16, -13); ctx.lineTo(-16, 13); ctx.closePath();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,10,40,0.6)'; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
      ctx.restore();
      // vòng tâm (càng to càng dễ lệch)
      const pulse = 1 + Math.sin(this.t * 6) * 0.04;
      ctx.save(); ctx.translate(A.x, A.y); ctx.scale(pulse, pulse);
      ctx.fillStyle = out ? 'rgba(255,60,60,0.18)' : 'rgba(255,255,255,0.16)';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(20,10,40,0.5)'; ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-R - 8, 0); ctx.lineTo(-R + 8, 0); ctx.moveTo(R - 8, 0); ctx.lineTo(R + 8, 0);
      ctx.moveTo(0, -R - 8); ctx.lineTo(0, -R + 8); ctx.moveTo(0, R - 8); ctx.lineTo(0, R + 8); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      ctx.restore();
      if (k.chip) Draw.text(ctx, 'Panenka', A.x, A.y - R - 16, { size: 18, color: '#ffe14d', sw: 4 });
      if (out) Draw.text(ctx, k.pw > 1 ? 'Quá lực — vọt xà!' : 'Sát cột!', A.x, A.y + R + 22, { size: 18, color: '#ff6a6a', sw: 4 });
    }
    /** thanh lực nằm ngang, chia vùng Nhẹ / Vừa / Căng / Quá */
    drawPower(ctx) {
      const k = this.k, x = 770, y = 616, w = 380, h = 30, f = (v) => x + (v / PMAX) * w;
      const zones = [[0, 0.5, '#9fd8ff', 'Nhẹ'], [0.5, 0.85, '#ffe14d', 'Vừa'], [0.85, 1, '#ff9a3a', 'Căng'], [1, PMAX, '#ff3a3a', 'Quá']];
      Draw.rr(ctx, x - 12, y - 40, w + 24, h + 66, 16); ctx.fillStyle = 'rgba(10,15,30,0.78)'; ctx.fill();
      Draw.text(ctx, '⚡ Lực sút', x, y - 20, { size: 18, color: '#fff', sw: 3, align: 'left' });
      for (const [a, b, col, name] of zones) {
        ctx.fillStyle = col; ctx.globalAlpha = 0.28; ctx.fillRect(f(a), y, f(b) - f(a), h); ctx.globalAlpha = 1;
        Draw.text(ctx, name, (f(a) + f(b)) / 2, y + h + 15, { size: 14, color: col, sw: 3 });
      }
      const v = Math.min(PMAX, k.pw);
      if (v > 0) {
        for (const [a, b, col] of zones) {
          if (v <= a) break;
          ctx.fillStyle = col; ctx.fillRect(f(a), y, f(Math.min(b, v)) - f(a), h);
        }
      }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
      // vạch 100%
      ctx.beginPath(); ctx.moveTo(f(1), y - 6); ctx.lineTo(f(1), y + h + 6); ctx.stroke();
      // kim chỉ
      if (v > 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(f(v), y - 2); ctx.lineTo(f(v) - 8, y - 14); ctx.lineTo(f(v) + 8, y - 14); ctx.closePath(); ctx.fill(); }
      const zone = zones.find(([a, b]) => v > a && v <= b);
      const tag = k.pw <= 0 ? (this.P[k.shooter].bot ? '' : 'Giữ Đánh…') : zone ? zone[3] + (zone[3] === 'Căng' ? '!' : zone[3] === 'Quá' ? ' tay!' : '') : '';
      if (tag) Draw.text(ctx, tag, x + w, y - 20, { size: 20, color: zone ? zone[2] : '#fff', sw: 4, align: 'right' });
    }
    drawHud(ctx) {
      const k = this.k, cx = W / 2;
      Draw.rr(ctx, cx - 360, 8, 720, 92, 22); ctx.fillStyle = 'rgba(10,12,30,0.82)'; ctx.fill();
      for (const t of [0, 1]) {
        const s = t === 0 ? -1 : 1;
        Draw.text(ctx, TEAMS.names[t], cx + s * 250, 34, { size: 22, color: TEAMS.colors[t], sw: 4 });
        const r = this.rec[t], live = k.phase !== 'res' && k.st === t && !this.finished ? 1 : 0;
        const N = Math.max(this.kicks, r.length + live);
        const step = N > 7 ? Math.min(26, 230 / N) : 28;
        for (let i = 0; i < N; i++) {
          const x = t === 0 ? cx - 70 - i * step : cx + 70 + i * step, yy = 72;
          ctx.fillStyle = i < r.length ? (r[i] ? '#5dff9b' : '#ff5a6a') : 'rgba(255,255,255,0.18)';
          ctx.beginPath(); ctx.arc(x, yy, 9, 0, TAU); ctx.fill();
          if (i === r.length && live) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; ctx.stroke(); }
          if (i === this.kicks - 1 && N > this.kicks) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - s * step / 2, yy - 13); ctx.lineTo(x - s * step / 2, yy + 13); ctx.stroke(); }
        }
      }
      Draw.text(ctx, `${this.goals(0)} – ${this.goals(1)}`, cx, 40, { size: 40, color: '#fff', sw: 5 });
      const sub = this.match && this.matchScore ? `Hòa ${this.matchScore[0]}–${this.matchScore[1]} · Luân lưu` : '🥅 Luân lưu';
      Draw.label(ctx, k.sudden ? '☠️ Đá chết' : sub, W - 130, 44);
      if (k.pressure && (k.phase === 'aim' || k.phase === 'pre') && Math.sin(this.t * 8) > -0.3) {
        Draw.text(ctx, k.sudden ? '☠️ Đá chết — trượt là thua!' : '⚡ Cú sút quyết định!', cx, 196, { size: 24, color: '#ffe14d', sw: 5 });
      }
      // hướng dẫn
      if (k.phase === 'aim' || k.phase === 'pre') {
        const S = this.P[k.shooter], K = this.P[k.keeper];
        const l1 = S.bot ? `🤖 ${S.name} đang ngắm…` : `⚽ ${S.name} sút: phím hướng = di chuyển tâm ngắm · giữ Đánh lấy lực, thả để sút · giữ thêm Nhảy = Panenka · ${Math.ceil(Math.max(0, k.t))}s`;
        const l2 = K.bot ? `🤖 ${K.name} đang bắt…` : `🧤 ${K.name} bắt: ← → đứng chặn · bóng bay rồi bấm Nhảy là bay theo bóng (Nhảy + hướng = đoán trước)`;
        Draw.rr(ctx, cx - 470, 108, 940, 56, 18); ctx.fillStyle = 'rgba(10,15,30,0.82)'; ctx.fill();
        Draw.text(ctx, l1, cx, 125, { size: 17, color: S.color.light, sw: 3 });
        Draw.text(ctx, l2, cx, 149, { size: 17, color: K.color.light, sw: 3 });
      }
    }
  }
  window.PenaltyShootout = PenaltyShootout;
})();

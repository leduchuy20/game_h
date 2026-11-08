'use strict';
/* Pha Trà Sữa — đơn hàng hiện vài giây rồi ẩn đi. Nhớ đơn, chạy tới các trạm lấy đúng topping
   (bấm Đánh ở trạm), rồi mang ly tới quầy giao (bấm Đánh ở quầy). Giao đúng sớm được nhiều điểm. */
(() => {
  const CX = W / 2, CY = H / 2 + 70;
  const TOPS = [
    { name: 'Trân châu', c: '#3b2a20', ring: '#6b4a32' }, { name: 'Thạch xanh', c: '#34cc78', ring: '#1a8648' },
    { name: 'Pudding', c: '#ffcf3a', ring: '#c0900a' }, { name: 'Kem cheese', c: '#fff6e6', ring: '#d8c4a0' },
    { name: 'Đào', c: '#ff9a7a', ring: '#c25a3a' }, { name: 'Khoai môn', c: '#b48cff', ring: '#7a52c7' },
  ];
  const ST_R = 255, SHOW = 3.2;

  class Boba {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.rounds = api.count(5); this.round = 0; this.finished = false;
      this.stations = TOPS.map((tp, k) => {
        const a = -Math.PI / 3 + k * TAU / TOPS.length;
        return { x: CX + Math.cos(a) * ST_R * 1.9, y: CY + Math.sin(a) * ST_R * 0.85, k };
      });
      this.ps = this.P.map((p, i) => ({ x: CX + (i - (this.n - 1) / 2) * 70, y: CY + 70, vx: 0, vy: 0, r: 22, face: -Math.PI / 2,
        walk: 0, cup: [], points: 0, done: false, flash: 0, skip: false }));
      this.bot = this.P.map(() => ({ plan: [] }));
      this.nextRound();
    }

    nextRound() {
      this.round++;
      const len = Math.min(5, 2 + Math.floor((this.round - 1) / 2));
      this.order = Array.from({ length: len }, () => U.randi(0, TOPS.length - 1));
      this.phase = 'show'; this.phaseT = SHOW + len * 0.3;
      this.roundT = 0; this.limit = 9 + len * 2.5; this.delivered = 0;
      this.ps.forEach((p) => { p.cup = []; p.done = false; });
      const lv = this.api.bot;
      // máy "nhớ" đơn — máy càng dễ càng hay nhớ sai một món
      this.bot.forEach((b) => {
        const plan = this.order.slice();
        if (Math.random() < lv.actDrop * 0.8) plan[U.randi(0, plan.length - 1)] = U.randi(0, TOPS.length - 1);
        b.plan = plan; b.wait = U.rand(0.2, 0.8) + lv.react * 2;
      });
      Sfx.play('warn');
    }

    sameCup(cup) {
      if (cup.length !== this.order.length) return false;
      const a = cup.slice().sort(), b = this.order.slice().sort();
      return a.every((v, k) => v === b[k]);
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (this.finished) return;
      this.ps.forEach((p) => { p.flash -= dt; });
      if (this.phase === 'show') {
        this.phaseT -= dt;
        if (this.phaseT <= 0) { this.phase = 'go'; Sfx.play('go'); }
      } else if (this.phase === 'go') {
        this.roundT += dt;
        if (this.ps.every((p) => p.done) || this.roundT >= this.limit) {
          this.phase = 'reveal'; this.phaseT = 2.2;
          // BOB1: không giao kịp thì bị trừ 1 điểm
          this.ps.forEach((p) => {
            if (p.done) return;
            if (p.points > 0) { p.points--; parts.text(p.x, p.y - 50, 'Trễ đơn −1', '#ff8fa8', 24); }
          });
        }
      } else if (this.phase === 'reveal') {
        this.phaseT -= dt;
        if (this.phaseT <= 0) { if (this.round >= this.rounds) this.finished = true; else this.nextRound(); }
      }
      this.ps.forEach((p, i) => {
        const q = inp[i];
        if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        const k = Math.min(1, dt * 12);
        p.vx += (q.mx * 280 - p.vx) * k; p.vy += (q.my * 280 - p.vy) * k;
        p.x = U.clamp(p.x + p.vx * dt, 40, W - 40); p.y = U.clamp(p.y + p.vy * dt, 110, H - 30);
        if (this.phase !== 'go' || p.done) return;
        if (q.jumpP && p.cup.length) { p.cup = []; Sfx.play('leave'); parts.text(p.x, p.y - 40, 'Đổ ly', '#ccc', 22); }
        if (!q.actP) return;
        const st = this.stations.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < 58);
        if (st) {
          if (p.cup.length < 6) { p.cup.push(st.k); Sfx.play('pickup', 0.03); p.flash = 0.15; }
          return;
        }
        if (Math.hypot(CX - p.x, CY - p.y) < 85) {
          if (!p.cup.length) return;
          if (this.sameCup(p.cup)) {
            // BOB1: 2 điểm cơ bản + tiền tip theo thời gian còn lại (0–3) + 1 nếu giao đầu tiên
            const tip = Math.round(3 * Math.max(0, 1 - this.roundT / this.limit)), first = this.delivered === 0 ? 1 : 0;
            const pts = 2 + tip + first;
            this.delivered++; p.points += pts; p.done = true;
            Sfx.play('crown');
            parts.text(p.x, p.y - 50, `Đúng đơn! +2${tip ? ` · tip +${tip}` : ''}${first ? ' · nhanh nhất +1' : ''}`, '#5dff9b', 26);
            parts.burst(CX, CY, ['#ffe14d', '#fff', this.P[i].color.main], 20, 260, 0.6, 6);
          } else {
            p.cup = []; Sfx.play('hurt');
            parts.text(p.x, p.y - 50, 'Sai đơn! Làm lại', '#ff8fa8', 26);
          }
        }
      });
      this.ps.forEach((p) => { p.skip = false; });
      Phys.separate(this.ps, 0.4);
    }

    drawTopping(ctx, k, x, y, r) {
      const tp = TOPS[k];
      ctx.fillStyle = tp.c; ctx.strokeStyle = tp.ring; ctx.lineWidth = Math.max(2, r * 0.18);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, TAU); ctx.fill();
    }

    drawCup(ctx, x, y, items, s = 1) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-16, -20); ctx.lineTo(16, -20); ctx.lineTo(12, 20); ctx.lineTo(-12, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8c9a0'; ctx.fillRect(-14, -8, 28, 26);
      items.slice(0, 6).forEach((k, j) => this.drawTopping(ctx, k, -8 + (j % 3) * 8, 14 - Math.floor(j / 3) * 9, 4.5));
      ctx.strokeStyle = '#ff5c9d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, -20); ctx.lineTo(10, -34); ctx.stroke();
      ctx.restore();
    }

    draw(ctx) {
      ctx.fillStyle = '#f6e3c8'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#efd5b0';
      for (let x = 0; x < W; x += 64) for (let y = 80; y < H; y += 64) if ((x / 64 + y / 64) % 2 < 1) ctx.fillRect(x, y, 64, 64);
      // quầy giao
      ctx.fillStyle = '#8a5a3b'; ctx.beginPath(); ctx.ellipse(CX, CY + 10, 95, 60, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c98a5a'; ctx.beginPath(); ctx.ellipse(CX, CY, 90, 54, 0, 0, TAU); ctx.fill();
      Draw.text(ctx, 'QUẦY GIAO', CX, CY, { size: 22, color: '#fff' });
      // trạm topping
      for (const s of this.stations) {
        const tp = TOPS[s.k];
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 30, 54, 16, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; Draw.rr(ctx, s.x - 52, s.y - 34, 104, 64, 16); ctx.fill();
        ctx.strokeStyle = tp.ring; ctx.lineWidth = 4; ctx.stroke();
        for (let j = 0; j < 5; j++) this.drawTopping(ctx, s.k, s.x - 26 + (j % 3) * 26 + (j > 2 ? 13 : 0), s.y - 12 + (j > 2 ? 18 : 0), 9);
        Draw.text(ctx, tp.name, s.x, s.y - 48, { size: 18, color: '#5a3a2a', stroke: 'rgba(255,255,255,0.8)', sw: 4 });
      }
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk, squash: p.flash > 0 ? 0.15 : 0 });
        this.drawCup(ctx, p.x + 26, p.y - 18, p.cup, 0.9);
        if (p.done) Draw.text(ctx, '✓', p.x, p.y - 42, { size: 30, color: '#5dff9b' });
      }
      // phiếu đơn hàng
      const showOrder = this.phase === 'show' || this.phase === 'reveal';
      const ow = 120 + this.order.length * 60;
      Draw.rr(ctx, CX - ow / 2, 86, ow, 70, 16); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#c98a5a'; ctx.lineWidth = 3; ctx.stroke();
      Draw.text(ctx, 'Đơn:', CX - ow / 2 + 44, 121, { size: 22, color: '#5a3a2a', stroke: null });
      this.order.forEach((k, j) => {
        const x = CX - ow / 2 + 110 + j * 60;
        if (showOrder) this.drawTopping(ctx, k, x, 121, 20);
        else Draw.text(ctx, '?', x, 122, { size: 36, color: '#c98a5a', stroke: null });
      });
      if (this.phase === 'show') {
        const w = (ow - 20) * Math.max(0, this.phaseT / (SHOW + this.order.length * 0.3));
        ctx.fillStyle = '#ff9a3c'; ctx.fillRect(CX - ow / 2 + 10, 148, w, 5);
        Draw.text(ctx, 'Nhớ kỹ đơn hàng!', CX, 178, { size: 26, color: '#ff5c3a' });
      } else if (this.phase === 'go') {
        Draw.text(ctx, `Còn ${Math.ceil(this.limit - this.roundT)} giây · tip +${Math.round(3 * Math.max(0, 1 - this.roundT / this.limit))}`, CX, 178, { size: 22, color: '#8a5a3b', stroke: 'rgba(255,255,255,0.8)', sw: 4 });
      }
      Draw.label(ctx, `Đơn ${this.round}/${this.rounds}`, 80, 38);
      Draw.chips(ctx, this.P, this.ps.map((p) => `🧋 ${p.points}`));
    }

    results() { return this.ps.map((p) => ({ score: p.points, text: `${p.points} điểm` })); }

    botInput(i) {
      const p = this.ps[i], st = this.bot[i];
      const o = { mx: 0, my: 0, actP: false };
      if (this.phase !== 'go' || p.done) return o;
      st.wait -= 1 / 60;
      if (st.wait > 0) return o;
      let tx, ty, target = null;
      if (p.cup.length < st.plan.length) {
        // món tiếp theo còn thiếu
        const need = st.plan.slice();
        for (const k of p.cup) { const j = need.indexOf(k); if (j >= 0) need.splice(j, 1); }
        if (!need.length) { p.cup = []; return o; }
        let bd = Infinity;
        for (const k of need) { const s = this.stations[k]; const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; target = s; } }
        tx = target.x; ty = target.y + 20;
      } else { tx = CX; ty = CY + 60; }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d > 26) { o.mx = dx / d; o.my = dy / d; }
      else if (Math.random() < 0.3) { o.actP = true; st.wait = 0.25; }
      return o;
    }
  }

  Party.register({
    id: 'boba', name: 'Pha Trà Sữa', emoji: '🧋', cat: 'brain',
    tagline: 'Nhớ đơn, lấy đúng topping rồi giao · giao đúng trước được nhiều điểm',
    how: 'Đơn hàng hiện vài giây rồi ẩn đi — nhớ kỹ! Chạy tới trạm, bấm nút Đánh để thêm topping vào ly, rồi ra quầy giao bấm Đánh. Giao đúng được 2 điểm, cộng thêm tiền tip — giao càng nhanh tip càng nhiều, người giao đầu tiên +1. Hết giờ mà chưa giao thì bị trừ 1 điểm. Bấm nhầm thì nút Nhảy để đổ ly làm lại.',
    controls: { move: 'Chạy', act: 'Lấy topping / Giao', jump: 'Đổ ly' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Boba(api),
  });
})();

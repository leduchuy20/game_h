'use strict';
/* Chim Bay — vỗ cánh lách qua khe giữa hai ống. Chạm ống hay đất là mất tim. */
(() => {
  const TOP = 76, GROUND = H - 60, GAME_TIME = 60, PIPE_W = 86, GRAV = 1500, FLAP = -470;
  const XMIN = 140, XMAX = 560;

  class Flappy {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.elapsed = 0; this.finished = false;
      this.speed = 220; this.pipes = []; this.nextX = 640; this.scroll = 0;
      while (this.nextX < W + 400) this.addPipe();
      this.ps = this.P.map((p, i) => ({ x: 230 + i * 46, y: 300 + i * 30, vy: 0, hearts: 3, inv: 1.5, out: false,
        outTime: 0, passed: 0, flapT: 0, tilt: 0 }));
      this.bot = this.P.map(() => ({ t: 0, off: 0, pipe: null, want: false }));
    }

    addPipe() {
      const gap = Math.max(180, 235 - this.elapsed * 0.9);
      const cy = U.rand(TOP + 60 + gap / 2, GROUND - 60 - gap / 2);
      this.pipes.push({ x: this.nextX, top: cy - gap / 2, bot: cy + gap / 2, passed: new Set() });
      this.nextX += U.rand(300, 360);
    }

    hit(p) {
      if (p.y + 16 > GROUND) return true;
      for (const q of this.pipes) {
        if (p.x + 16 > q.x && p.x - 16 < q.x + PIPE_W && (p.y - 15 < q.top || p.y + 15 > q.bot)) return true;
      }
      return false;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt; this.elapsed += dt;
        if (this.time <= 0) { this.time = 0; this.finished = true; }
      }
      this.speed = Math.min(330, 220 + this.elapsed * 2);
      const dx = this.speed * dt;
      this.scroll += dx;
      for (const q of this.pipes) q.x -= dx;
      this.nextX -= dx;
      this.pipes = this.pipes.filter((q) => q.x > -PIPE_W - 10);
      while (this.nextX < W + 400) this.addPipe();

      this.ps.forEach((p, i) => {
        if (p.out) { p.vy += GRAV * dt; p.y = Math.min(H + 60, p.y + p.vy * dt); return; }
        const q = inp[i];
        p.inv -= dt; p.flapT -= dt;
        // tiến / lùi theo chiều ngang (bước nền cho FLP5 bám đuôi)
        if (!this.finished) p.x = U.clamp(p.x + q.mx * 170 * dt, XMIN, XMAX);
        if ((q.jumpP || q.actP) && !this.finished) { p.vy = FLAP; p.flapT = 0.15; Sfx.play('jump', 0.04); }
        p.vy = Math.min(700, p.vy + GRAV * dt);
        p.y += p.vy * dt;
        if (p.y < TOP + 16) { p.y = TOP + 16; p.vy = Math.max(0, p.vy); }
        p.tilt = U.clamp(p.vy / 900, -0.5, 0.8);
        for (const pq of this.pipes) {
          if (!pq.passed.has(i) && pq.x + PIPE_W < p.x) { pq.passed.add(i); p.passed++; }
        }
        if (this.finished || p.inv > 0) { if (p.y > GROUND - 16) { p.y = GROUND - 16; p.vy = FLAP * 0.8; } return; }
        if (this.hit(p)) {
          p.hearts--; p.inv = 1.8;
          Sfx.play('hurt'); FX.shake(5); Party.rumble(i);
          parts.burst(p.x, p.y, ['#fff', this.P[i].color.main, '#ffe14d'], 16, 240, 0.5, 5);
          if (p.hearts <= 0) { p.out = true; p.outTime = this.elapsed; p.vy = -300; parts.text(p.x, p.y - 30, 'Rơi!', '#fff', 28); }
          else {
            // đưa về giữa khe ống gần nhất cho dễ tiếp tục
            const nx = this.pipes.find((pq) => pq.x + PIPE_W > p.x - 20);
            p.y = nx ? (nx.top + nx.bot) / 2 : 300; p.vy = 0;
            parts.text(p.x, p.y - 30, '−1 ♥', '#ff8fa8', 24);
          }
        }
      });
      if (!this.finished && this.n >= 2 && this.ps.filter((p) => !p.out).length <= 1) this.finished = true;
    }

    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#5ec6ff'); g.addColorStop(1, '#c8f0ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // mây & đồi (cuộn chậm)
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 6; k++) {
        const x = ((k * 260 - this.scroll * 0.2) % (W + 300) + W + 300) % (W + 300) - 150, y = 120 + (k * 53) % 160;
        for (const [ox, oy, r] of [[0, 0, 28], [30, -12, 34], [62, 0, 26]]) { ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, TAU); ctx.fill(); }
      }
      ctx.fillStyle = '#8fd67a';
      for (let k = 0; k < 5; k++) {
        const x = ((k * 340 - this.scroll * 0.5) % (W + 400) + W + 400) % (W + 400) - 200;
        ctx.beginPath(); ctx.ellipse(x, GROUND, 220, 120, 0, Math.PI, TAU); ctx.fill();
      }
      // ống
      for (const q of this.pipes) {
        for (const [y0, y1, capY] of [[TOP - 10, q.top, q.top - 26], [q.bot, GROUND, q.bot]]) {
          ctx.fillStyle = '#3fae3f'; ctx.fillRect(q.x, y0, PIPE_W, y1 - y0);
          ctx.fillStyle = '#6fd66a'; ctx.fillRect(q.x + 10, y0, 14, y1 - y0);
          ctx.fillStyle = '#2e8a2e'; ctx.fillRect(q.x - 8, capY, PIPE_W + 16, 26);
          ctx.fillStyle = '#5cc85a'; ctx.fillRect(q.x - 2, capY + 4, 14, 18);
        }
      }
      // mặt đất
      ctx.fillStyle = '#d9b26a'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#6cbf4a'; ctx.fillRect(0, GROUND, W, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let x = -(this.scroll % 40); x < W; x += 40) ctx.fillRect(x, GROUND + 20, 20, H - GROUND);
      // chim
      this.ps.forEach((p, i) => {
        const c = this.P[i].color;
        const blink = p.inv > 0 && !p.out && Math.sin(U.now() * 30) > 0;
        ctx.save(); ctx.globalAlpha = blink ? 0.45 : 1;
        ctx.translate(p.x, p.y); ctx.rotate(p.tilt);
        const wing = p.flapT > 0 ? -1 : Math.sin(U.now() * 12) * 0.4;
        ctx.fillStyle = c.light; ctx.strokeStyle = 'rgba(20,10,40,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(-10, 2, 12, 7, wing, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
        Draw.blob(ctx, { x: p.x, y: p.y, r: 18, color: c, face: p.tilt, shadow: false, dead: p.out, alpha: blink ? 0.45 : 1 });
        ctx.fillStyle = '#ffb12e';
        ctx.beginPath(); ctx.moveTo(p.x + 16, p.y - 2); ctx.lineTo(p.x + 26, p.y + 2); ctx.lineTo(p.x + 16, p.y + 6); ctx.fill();
      });
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.out ? `Rơi · ${p.passed}` : `♥${p.hearts} · ${p.passed}`)), { dim: this.ps.map((p) => p.out) });
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    results() {
      return this.ps.map((p) => (p.out
        ? { score: p.outTime, text: `Rơi ở giây ${Math.floor(p.outTime)} · qua ${p.passed} ống` }
        : { score: 1000 + p.hearts * 100 + p.passed, text: `Còn ${p.hearts} ♥ · qua ${p.passed} ống` }));
    }

    botInput(i) {
      const p = this.ps[i], st = this.bot[i], lv = this.api.bot;
      const o = { mx: 0, jumpP: false };
      if (p.out) return o;
      st.t -= 1 / 60;
      const nx = this.pipes.find((q) => q.x + PIPE_W > p.x - 18);
      if (nx !== st.pipe) { st.pipe = nx; st.off = U.rand(-1, 1) * lv.actDrop * 70; }
      if (st.t <= 0) {
        st.t = Math.max(1 / 60, lv.react * 0.35);
        const target = nx ? (nx.top + nx.bot) / 2 + 22 + st.off : 360;
        st.want = p.y + p.vy * 0.12 > target && p.vy > -120 && Math.random() > lv.actDrop * 0.2;
      }
      if (st.want) { o.jumpP = true; st.want = false; }
      return o;
    }
  }

  Party.register({
    id: 'flappy', name: 'Chim Bay', emoji: '🐤',
    tagline: 'Vỗ cánh lách qua khe ống · trụ lại sau cùng là thắng',
    how: 'Bấm nút Nhảy (hoặc Đánh) để vỗ cánh bay lên. Bấm trái/phải để tiến lùi. Lách qua khe giữa hai ống — chạm ống hay đất là mất 1 tim. Hết giờ ai còn nhiều tim hơn thắng.',
    controls: { move: 'Tiến / lùi', jump: 'Vỗ cánh' },
    minPlayers: 2, maxPlayers: 4,
    rawBot: true, // máy tự xử lý độ khó (vỗ cánh cần nhịp đều)
    create: (api) => new Flappy(api),
  });
})();

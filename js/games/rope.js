'use strict';
/* Nhảy Dây — dây quay quanh, nhảy đúng lúc dây quét qua chân. Dây quay nhanh dần, có lúc 2 dây.
   Vướng dây mất 1 tim. */
(() => {
  const GROUND = H - 120, HAND_Y = GROUND - 80, LX = 150, RX = W - 150;
  const TOPY = 170, GAME_TIME = 60, GRAV = 1700, JUMP = 560;
  const C_APEX = (GROUND + TOPY) / 2, D_APEX = (GROUND - TOPY) / 2;
  const TURNER = { main: '#b9b3cc', dark: '#7c7695', light: '#f1eff7' };

  class Rope {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.elapsed = 0; this.finished = false;
      this.theta = 0.3; this.omega = TAU / 1.7; this.double = false; this.dirFlip = 1;
      this.ps = this.P.map((p, i) => ({ x: W / 2 + (i - (this.n - 1) / 2) * 150, z: 0, vz: 0, hearts: 3, out: false,
        outTime: 0, inv: 0, squash: 0, walk: 0 }));
      this.bot = this.P.map(() => ({ jitter: 0, cross: -1 }));
      this.bannerT = 9;
    }

    ropePhases() { return this.double ? [this.theta, this.theta + Math.PI] : [this.theta]; }
    // thời gian tới lần dây chạm đất kế tiếp
    timeToBottom() {
      let best = Infinity;
      for (const th of this.ropePhases()) {
        const d = ((Math.PI - th) % TAU + TAU) % TAU;
        best = Math.min(best, d / this.omega);
      }
      return best;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt; this.elapsed += dt;
        if (this.time <= 0) { this.time = 0; this.finished = true; }
      }
      this.bannerT += dt;
      // khoảng cách giữa 2 lần dây quét qua chân (không bao giờ ngắn hơn thời gian bay + một chút)
      if (!this.double && this.elapsed > this.total * 0.5) { this.double = true; this.bannerT = 0; Sfx.play('warn'); }
      const gapT = this.double ? Math.max(0.95, 1.3 - (this.elapsed - this.total * 0.5) * 0.012) : Math.max(0.85, 1.7 - this.elapsed * 0.03);
      this.omega = TAU / (this.double ? gapT * 2 : gapT);
      const before = this.ropePhases().map((th) => ((th % TAU) + TAU) % TAU);
      this.theta += this.omega * dt;
      const after = this.ropePhases().map((th) => ((th % TAU) + TAU) % TAU);
      // dây quét qua mặt đất?
      let sweep = false;
      for (let k = 0; k < before.length; k++) if (before[k] < Math.PI && after[k] >= Math.PI) sweep = true;
      if (sweep) Sfx.play('tick', 0.05);

      this.ps.forEach((p, i) => {
        if (p.out) { p.z = Math.max(0, p.z + p.vz * dt); p.vz -= GRAV * dt; return; }
        const q = inp[i];
        p.inv -= dt; p.squash *= Math.pow(0.01, dt);
        if ((q.jumpP || q.actP) && p.z <= 0) { p.vz = JUMP; p.squash = -0.2; Sfx.play('jump', 0.03); }
        p.vz -= GRAV * dt; p.z += p.vz * dt;
        if (p.z <= 0) { if (p.vz < -400) p.squash = 0.18; p.z = 0; p.vz = 0; }
        if (sweep && !this.finished && p.z < 22 && p.inv <= 0) {
          p.hearts--; p.inv = 0.6;
          Sfx.play('hurt'); FX.shake(5); Party.rumble(i);
          parts.burst(p.x, GROUND - 20, ['#fff', this.P[i].color.main], 12, 200, 0.5, 5);
          if (p.hearts <= 0) { p.out = true; p.outTime = this.elapsed; parts.text(p.x, GROUND - 90, 'Bị loại!', '#fff', 28); }
          else parts.text(p.x, GROUND - 90, '−1 ♥', '#ff8fa8', 26);
        }
      });
      if (!this.finished && this.n >= 2 && this.ps.filter((p) => !p.out).length <= 1) this.finished = true;
    }

    drawRope(ctx, th, front) {
      const s = Math.sin(th);
      if ((s > 0) !== front) return;
      const apex = C_APEX - D_APEX * Math.cos(th);
      const ctrl = 2 * apex - HAND_Y;
      ctx.strokeStyle = front ? '#ff5c7a' : 'rgba(255,92,122,0.55)'; ctx.lineWidth = front ? 6 : 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(LX + 26, HAND_Y); ctx.quadraticCurveTo(W / 2, ctrl, RX - 26, HAND_Y); ctx.stroke();
    }

    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#ffcf8a'); g.addColorStop(1, '#ff8f6b');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e46a5a';
      ctx.beginPath(); ctx.ellipse(300, GROUND + 10, 420, 150, 0, Math.PI, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1000, GROUND + 10, 480, 190, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#6a4a8a'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#7d5ba3'; for (let x = 0; x < W; x += 80) ctx.fillRect(x, GROUND, 40, H - GROUND);
      for (const th of this.ropePhases()) this.drawRope(ctx, th, false);
      // người quay dây
      for (const [x, f] of [[LX, 0], [RX, Math.PI]]) {
        Draw.blob(ctx, { x, y: GROUND - 34, r: 36, color: TURNER, face: f });
        ctx.fillStyle = TURNER.light; ctx.strokeStyle = 'rgba(20,10,40,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x + (f ? -26 : 26), HAND_Y, 10, 0, TAU); ctx.fill(); ctx.stroke();
      }
      this.ps.forEach((p, i) => {
        if (p.out) { Draw.blob(ctx, { x: p.x, y: GROUND - 26, r: 26, color: this.P[i].color, dead: true, alpha: 0.4 }); return; }
        const blink = p.inv > 0 && Math.sin(U.now() * 30) > 0;
        Draw.blob(ctx, { x: p.x, y: GROUND - 26, z: p.z, r: 26, color: this.P[i].color, face: -Math.PI / 2, squash: p.squash, alpha: blink ? 0.45 : 1 });
        Draw.text(ctx, this.P[i].name, p.x, GROUND + 30, { size: 20, color: this.P[i].color.light, sw: 4 });
      });
      for (const th of this.ropePhases()) this.drawRope(ctx, th, true);
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.out ? 'Loại' : '♥'.repeat(p.hearts))), { dim: this.ps.map((p) => p.out) });
      Draw.timer(ctx, this.time, W - 72, 38);
      Draw.label(ctx, `${(this.omega / TAU * 60 * (this.double ? 2 : 1)).toFixed(0)} lần/phút`, 120, 38);
      if (this.double && this.bannerT < 1.6) Draw.banner(ctx, 'HAI DÂY!', this.bannerT, { color: '#ffe14d', size: 70, y: 200 });
      if (this.elapsed < 3) Draw.text(ctx, 'Bấm Nhảy khi dây sắp chạm đất!', W / 2, 200, { size: 34, color: '#fff' });
    }

    results() {
      return this.ps.map((p) => (p.out
        ? { score: p.outTime, text: `Vướng dây ở giây ${Math.floor(p.outTime)}` }
        : { score: 1000 + p.hearts * 100, text: `Còn ${p.hearts} ♥` }));
    }

    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) { const p = this.ps[i]; return { x: p.x, y: GROUND - 26 - p.z }; }

    botInput(i) {
      const p = this.ps[i], st = this.bot[i], lv = this.api.botOf(i);
      const o = { jumpP: false };
      if (p.out || p.z > 0) return o;
      const tb = this.timeToBottom();
      // mỗi lần dây quét, máy chọn một độ lệch thời gian ngẫu nhiên (máy càng dễ lệch càng nhiều)
      const id = Math.floor((this.theta + Math.PI) / (this.double ? Math.PI : TAU));
      if (st.cross !== id) {
        st.cross = id; st.jitter = U.rand(-1, 1) * (0.08 + lv.actDrop * 0.35);
        // thỉnh thoảng lơ đễnh (kể cả mức Khó) để người thật có cơ hội thắng; dây càng nhanh càng dễ lơ đễnh
        if (Math.random() < 0.022 + 0.018 * Math.min(1, this.elapsed / Math.max(1, this.total))) st.jitter = (Math.random() < 0.5 ? -1 : 1) * U.rand(0.2, 0.32);
      }
      const ideal = JUMP / GRAV * 0.62; // nhảy sớm một chút trước khi dây tới
      if (tb < ideal + st.jitter && tb > 0.02) o.jumpP = true;
      return o;
    }
  }

  Party.register({
    id: 'rope', name: 'Nhảy Dây', emoji: '🤸', cat: 'dodge',
    tagline: 'Nhảy đúng nhịp qua dây · nhiều tim nhất là thắng',
    how: 'Dây quay liên tục — bấm nút Nhảy (hoặc Đánh) đúng lúc dây sắp chạm đất. Dây quay nhanh dần, nửa sau trận có tới 2 dây! Vướng dây mất 1 tim.',
    controls: { move: '(không dùng)', jump: 'Nhảy' },
    minPlayers: 2, maxPlayers: 4,
    rawBot: true, // máy tự xử lý độ khó bằng độ lệch thời gian khi nhảy
    create: (api) => new Rope(api),
  });
})();

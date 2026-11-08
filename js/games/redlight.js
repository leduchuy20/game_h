'use strict';
/* Đèn Xanh Đèn Đỏ — chạy khi đèn xanh, đứng im khi đèn đỏ. Nhúc nhích lúc đèn đỏ là bị kéo về vạch xuất phát. */
(() => {
  const START_X = 110, FINISH_X = 1060, FY0 = 140, FY1 = 690;
  const GAME_TIME = 75, TURN = 0.6, GRACE = 0.3;
  const DOLL_X = 1180, DOLL_Y = 300;

  class RedLight {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false; this.place = 0;
      this.phase = 'green'; this.phaseT = U.rand(2, 3.5); this.redT = 0; this.turnAnim = 0;
      const gap = (FY1 - FY0) / (this.n + 1);
      this.ps = this.P.map((p, i) => ({
        x: START_X - 40, y: FY0 + gap * (i + 1), vx: 0, vy: 0, r: 24, face: 0, walk: 0,
        caught: 0, stun: 0, punchCd: 0, punchT: 0, done: false, rank: 0, squash: 0, skip: false, greed: 0,
      }));
      this.scan = [];
    }

    catchP(p, i, why) {
      p.caught = 1.1; p.stun = 1.1; p.vx = p.vy = 0;
      Sfx.play('hurt'); FX.shake(5); Party.rumble(i);
      this.scan.push({ x: p.x, y: p.y, t: 0.5 });
      this.api.parts.text(p.x, p.y - 50, why, '#ff7a7a', 28);
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt;
        if (this.time <= 0) { this.time = 0; this.finished = true; }
      }
      // đèn
      this.phaseT -= dt;
      if (this.phase === 'red') this.redT += dt;
      if (this.phaseT <= 0) {
        if (this.phase === 'green') {
          this.phase = 'turning'; this.phaseT = TURN; Sfx.play('warn');
          const lv = this.api.bot;
          // máy đôi khi "tham" chạy thêm một chút — máy càng dễ càng hay tham
          const chance = 0.2 + lv.actDrop * 0.5;
          this.ps.forEach((p) => { p.greed = Math.random() < chance ? U.rand(0.2, 1.1) : 0; });
        } else if (this.phase === 'turning') { this.phase = 'red'; this.phaseT = U.rand(1.6, 3); this.redT = 0; Sfx.play('crash'); }
        else { this.phase = 'green'; this.phaseT = U.rand(1.6, 4); Sfx.play('go'); }
      }
      this.turnAnim = U.approach(this.turnAnim, this.phase === 'green' ? 0 : 1, dt / TURN);
      for (const s of this.scan) s.t -= dt;
      this.scan = this.scan.filter((s) => s.t > 0);

      const watching = this.phase === 'red' && this.redT > GRACE;
      this.ps.forEach((p, i) => {
        const q = inp[i];
        p.squash *= Math.pow(0.01, dt);
        p.punchT -= dt; p.punchCd -= dt; p.stun -= dt;
        if (p.done) { p.walk += dt * 6; return; }
        if (p.caught > 0) {
          p.caught -= dt;
          p.x += (START_X - 40 - p.x) * Math.min(1, dt * 5);
          return;
        }
        const can = p.stun <= 0 && !this.finished;
        if (can && (q.mx || q.my)) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        const sp = can ? 150 : 0, k = Math.min(1, dt * 14);
        p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        if (can && q.actP && p.punchCd <= 0) {
          p.punchCd = 0.7; p.punchT = 0.18; Sfx.play('punch');
          if (watching) { this.catchP(p, i, 'Vung tay — bị bắt!'); return; }
          this.ps.forEach((o, j) => {
            if (j === i || o.done || o.caught > 0) return;
            const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
            if (d < 72 && Math.abs(U.angDiff(p.face, Math.atan2(dy, dx))) < 1.2) {
              o.stun = 0.9; o.vx += dx / d * 300; o.vy += dy / d * 300;
              Sfx.play('hit');
              parts.burst(o.x, o.y - 10, ['#fff', '#ffe14d'], 10, 200, 0.4, 5, { shape: 's' });
            }
          });
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.x = Math.max(START_X - 60, p.x); p.y = U.clamp(p.y, FY0 + p.r, FY1 - p.r);
        if (p.x >= FINISH_X && !this.finished) {
          p.done = true; p.rank = ++this.place; p.vx = p.vy = 0;
          Sfx.play('win');
          parts.burst(p.x, p.y, ['#ffe14d', '#fff', this.P[i].color.main], 30, 380, 0.9, 6);
          parts.text(p.x, p.y - 50, `Về đích #${p.rank}!`, this.P[i].color.light, 30);
        }
        if (watching && Math.hypot(p.vx, p.vy) > 30) this.catchP(p, i, 'Nhúc nhích — bị bắt!');
      });
      this.ps.forEach((p) => { p.skip = p.done || p.caught > 0; });
      Phys.separate(this.ps, 0.4);
      if (!this.finished && this.place >= Math.max(1, this.n - 1)) this.finished = true;
    }

    draw(ctx) {
      const t = U.now();
      ctx.fillStyle = '#d9c38f'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ccb47e';
      for (let y = FY0; y < FY1; y += 60) ctx.fillRect(0, y, W, 30);
      // vùng đèn đỏ quét
      if (this.turnAnim > 0) {
        ctx.fillStyle = `rgba(255,40,60,${0.12 * this.turnAnim + (this.phase === 'red' ? 0.04 * Math.sin(t * 8) : 0)})`;
        ctx.beginPath(); ctx.moveTo(DOLL_X - 30, DOLL_Y); ctx.lineTo(START_X - 80, FY0 - 40); ctx.lineTo(START_X - 80, FY1 + 40); ctx.fill();
      }
      // vạch xuất phát & đích
      ctx.fillStyle = '#fff'; ctx.fillRect(START_X, FY0, 6, FY1 - FY0);
      ctx.fillStyle = '#e8384f'; ctx.fillRect(FINISH_X, FY0, 10, FY1 - FY0);
      for (let y = FY0; y < FY1; y += 20) { ctx.fillStyle = (y / 20) % 2 ? '#fff' : '#e8384f'; ctx.fillRect(FINISH_X + 10, y, 10, 20); }
      Draw.text(ctx, 'ĐÍCH', FINISH_X + 10, FY0 - 18, { size: 24, color: '#e8384f' });
      Draw.text(ctx, 'XUẤT PHÁT', START_X, FY0 - 18, { size: 20 });
      // cây
      for (const [x, y] of [[40, 110], [1240, 640], [60, 700]]) {
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x - 6, y - 10, 12, 30);
        ctx.fillStyle = '#4c9c45'; ctx.beginPath(); ctx.arc(x, y - 22, 26, 0, TAU); ctx.fill();
      }
      // tia bắt
      for (const s of this.scan) {
        ctx.strokeStyle = `rgba(255,40,60,${s.t * 2})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(DOLL_X - 20, DOLL_Y - 30); ctx.lineTo(s.x, s.y); ctx.stroke();
      }
      this.drawDoll(ctx);
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        Draw.blob(ctx, { x: p.x, y: p.y - (p.done ? Math.abs(Math.sin(p.walk)) * 16 : 0), r: p.r, color: this.P[i].color,
          face: p.face, walk: p.walk, squash: p.squash, stun: p.stun > 0 || p.caught > 0, alpha: p.caught > 0 ? 0.7 : 1 });
        if (p.punchT > 0) {
          ctx.fillStyle = this.P[i].color.light; ctx.strokeStyle = 'rgba(20,10,40,0.6)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x + Math.cos(p.face) * 36, p.y + Math.sin(p.face) * 28, 10, 0, TAU); ctx.fill(); ctx.stroke();
        }
      }
      // đèn
      const col = this.phase === 'green' ? '#3ddc6e' : this.phase === 'turning' ? '#ffc23a' : '#ff3b52';
      const txt = this.phase === 'green' ? 'ĐÈN XANH — CHẠY!' : this.phase === 'turning' ? 'SẮP ĐỎ…' : 'ĐÈN ĐỎ — ĐỨNG IM!';
      Draw.rr(ctx, W / 2 - 230, 76, 460, 50, 25); ctx.fillStyle = 'rgba(20,12,40,0.75)'; ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(W / 2 - 200, 101, 15, 0, TAU); ctx.fill();
      Draw.text(ctx, txt, W / 2 + 15, 102, { size: 28, color: col, sw: 5 });
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.done ? `🏁 #${p.rank}` : `${Math.round(U.clamp((p.x - START_X) / (FINISH_X - START_X), 0, 1) * 100)}%`)));
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    drawDoll(ctx) {
      const t = U.now(), a = this.turnAnim; // 0 quay lưng, 1 nhìn về phía người chơi
      const x = DOLL_X, y = DOLL_Y, r = 70;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(x, y + r + 50, r * 0.9, 16, 0, 0, TAU); ctx.fill();
      // thân váy
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath(); ctx.moveTo(x - 50, y + r + 50); ctx.lineTo(x - 30, y + 40); ctx.lineTo(x + 30, y + 40); ctx.lineTo(x + 50, y + r + 50); ctx.fill();
      ctx.fillStyle = '#ffe14d'; ctx.fillRect(x - 32, y + 40, 64, 18);
      // đầu
      const sx = Math.abs(Math.cos(a * Math.PI)) * 0.25 + 0.75;
      ctx.translate(x, y); ctx.scale(sx, 1);
      ctx.fillStyle = '#ffd9b3';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1a12';
      if (a < 0.5) {
        ctx.beginPath(); ctx.arc(0, -4, r * 0.64, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.15, r * 0.22, 0, TAU); ctx.arc(r * 0.55, r * 0.15, r * 0.22, 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, -r * 0.18, r * 0.64, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.58, r * 0.1, r * 0.2, 0, TAU); ctx.arc(r * 0.58, r * 0.1, r * 0.2, 0, TAU); ctx.fill();
        const glow = this.phase === 'red' ? 0.7 + 0.3 * Math.sin(t * 12) : 0.3;
        for (const s of [-1, 1]) {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s * 15, 4, 9, 11, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = `rgba(255,30,50,${glow})`; ctx.beginPath(); ctx.arc(s * 15 - 3, 5, 5.5, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = '#a0402a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 24, 8, 0.2, Math.PI - 0.2); ctx.stroke();
      }
      ctx.restore();
    }

    results() {
      return this.ps.map((p) => (p.done
        ? { score: 1000 - p.rank, text: `Về đích thứ ${p.rank}` }
        : { score: (p.x - START_X) / (FINISH_X - START_X) * 100, text: `Đi được ${Math.round(U.clamp((p.x - START_X) / (FINISH_X - START_X), 0, 1) * 100)}%` }));
    }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0, actP: false };
      if (p.done || p.caught > 0) return o;
      const go = this.phase === 'green' || (this.phase === 'turning' && TURN - this.phaseT < p.greed)
        || (this.phase === 'red' && this.redT < p.greed - TURN);
      if (!go) return o;
      o.mx = 1;
      this.ps.forEach((q, j) => {
        if (j === i || q.done) return;
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
        if (d < 70 && dx > 0) o.my += dy > 0 ? -0.6 : 0.6;
        if (d < 64 && p.punchCd <= 0 && this.phase === 'green' && Math.random() < 0.03) {
          o.actP = true; o.mx = dx / d; o.my = dy / d;
        }
      });
      return o;
    }
  }

  Party.register({
    id: 'redlight', name: 'Đèn Xanh Đèn Đỏ', emoji: '🚦',
    tagline: 'Đèn đỏ mà nhúc nhích là bị kéo về vạch · về đích trước là thắng',
    how: 'Đèn xanh thì chạy, khi búp bê quay lại (đèn vàng → đỏ) thì thả tay đứng im! Đèn đỏ mà còn nhúc nhích hay vung tay là bị kéo về vạch xuất phát. Đèn xanh có thể đấm choáng người bên cạnh.',
    controls: { move: 'Chạy (thả tay là dừng)', act: 'Đấm choáng' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new RedLight(api),
  });
})();

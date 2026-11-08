'use strict';
/* Cầu Kính — mỗi hàng có 2 tấm kính, 1 tấm thật, 1 tấm giả. Nhảy sai là rơi về đầu cầu.
   Kính đã vỡ thì ai cũng thấy — đi sau người khác sẽ an toàn hơn! */
(() => {
  const COLS = 10, PX0 = 190, STEP = 92, PW = 76, PH = 118;
  const LANE_Y = [290, 470];
  const START_X = 110, END_X = PX0 + COLS * STEP + 50, GAME_TIME = 80, HOP = 0.38;

  class Glass {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false; this.place = 0;
      this.real = Array.from({ length: COLS }, () => U.randi(0, 1));
      this.broken = Array.from({ length: COLS }, () => [false, false]);
      this.stepped = Array.from({ length: COLS }, () => [false, false]);
      this.ps = this.P.map((p, i) => ({ col: -1, lane: i % 2, hopT: 0, from: null, falling: 0, done: false, rank: 0,
        falls: 0, best: -1, wait: 0, walk: 0, face: 0 }));
      this.shards = [];
    }

    pos(p, i) {
      const off = (i - (this.n - 1) / 2) * 14;
      if (p.done) return [END_X + 40 + (i % 2) * 40, 300 + i * 50];
      if (p.col < 0) return [START_X, 300 + i * 50];
      return [PX0 + p.col * STEP + PW / 2, LANE_Y[p.lane] + PH / 2 - 10 + off];
    }

    hop(p, i, lane) {
      p.from = this.pos(p, i);
      p.hopT = HOP;
      if (p.col >= COLS - 1) { p.col = COLS; p.target = 'end'; }
      else { p.col++; p.lane = lane; p.target = 'panel'; }
      Sfx.play('jump', 0.04);
    }

    land(p, i) {
      const parts = this.api.parts;
      if (p.target === 'end') {
        p.done = true; p.rank = ++this.place;
        Sfx.play('win');
        const [x, y] = this.pos(p, i);
        parts.burst(x, y, ['#ffe14d', '#fff', this.P[i].color.main], 30, 360, 0.9, 6);
        parts.text(x, y - 50, `Qua cầu #${p.rank}!`, this.P[i].color.light, 30);
        return;
      }
      const c = p.col, l = p.lane;
      if (this.real[c] === l) {
        this.stepped[c][l] = true; p.best = Math.max(p.best, c);
        return;
      }
      // kính giả
      const [x, y] = this.pos(p, i);
      if (!this.broken[c][l]) {
        this.broken[c][l] = true;
        Sfx.play('crumble'); Sfx.play('crash');
        for (let k = 0; k < 18; k++) this.shards.push({ x: x + U.rand(-30, 30), y: y + U.rand(-40, 40), vx: U.rand(-120, 120), vy: U.rand(-200, 50), r: U.rand(0, TAU), t: 1.2 });
      }
      p.falling = 1.2; p.falls++; FX.shake(6);
      parts.text(x, y - 40, 'Kính giả!', '#ff8fa8', 28);
    }

    update(dt, inp) {
      if (!this.finished) { this.time -= dt; if (this.time <= 0) { this.time = 0; this.finished = true; } }
      for (const s of this.shards) { s.t -= dt; s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 6; }
      this.shards = this.shards.filter((s) => s.t > 0);
      this.ps.forEach((p, i) => {
        p.walk += dt * 6;
        if (p.done) return;
        if (p.falling > 0) {
          p.falling -= dt;
          if (p.falling <= 0) { p.col = -1; p.lane = i % 2; }
          return;
        }
        if (p.hopT > 0) {
          p.hopT -= dt;
          if (p.hopT <= 0) this.land(p, i);
          return;
        }
        if (this.finished) return;
        const q = inp[i];
        if (q.jumpP) this.hop(p, i, 0);
        else if (q.actP) this.hop(p, i, 1);
      });
      if (!this.finished && this.ps.every((p) => p.done)) this.finished = true;
      if (!this.finished && this.place >= Math.max(1, this.n - 1) && this.n > 1) this.finished = true;
    }

    draw(ctx) {
      const t = U.now();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1b1440'); g.addColorStop(1, '#05030f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let k = 0; k < 60; k++) ctx.fillRect((k * 211) % W, (k * 97) % H, 2, 2);
      // bệ đầu & cuối
      for (const [x0, w] of [[20, PX0 - 40], [END_X - 20, W - END_X]]) {
        ctx.fillStyle = '#5b5e78'; Draw.rr(ctx, x0, 230, w, 360, 16); ctx.fill();
        ctx.fillStyle = '#8d90ad'; Draw.rr(ctx, x0 + 6, 236, w - 12, 340, 12); ctx.fill();
      }
      Draw.text(ctx, 'ĐÍCH', END_X + (W - END_X) / 2 - 20, 210, { size: 28, color: '#ffe14d' });
      // dầm cầu
      ctx.fillStyle = '#6d7186';
      for (const y of [LANE_Y[0] - 14, LANE_Y[0] + PH + 4, LANE_Y[1] - 14, LANE_Y[1] + PH + 4]) ctx.fillRect(PX0 - 30, y, COLS * STEP + 40, 10);
      // tấm kính
      for (let c = 0; c < COLS; c++) {
        for (let l = 0; l < 2; l++) {
          const x = PX0 + c * STEP, y = LANE_Y[l];
          if (this.broken[c][l]) {
            ctx.strokeStyle = 'rgba(160,220,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
            Draw.rr(ctx, x, y, PW, PH, 8); ctx.stroke(); ctx.setLineDash([]);
            continue;
          }
          ctx.fillStyle = this.stepped[c][l] ? 'rgba(120,255,190,0.35)' : 'rgba(150,215,255,0.35)';
          Draw.rr(ctx, x, y, PW, PH, 8); ctx.fill();
          ctx.strokeStyle = 'rgba(210,240,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + 12, y + 18); ctx.lineTo(x + 30, y + 8); ctx.moveTo(x + 12, y + 34); ctx.lineTo(x + 44, y + 12); ctx.stroke();
        }
        Draw.text(ctx, String(c + 1), PX0 + c * STEP + PW / 2, LANE_Y[1] + PH + 36, { size: 18, color: 'rgba(255,255,255,0.5)', stroke: null });
      }
      for (const s of this.shards) {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.r); ctx.globalAlpha = Math.min(1, s.t);
        ctx.fillStyle = 'rgba(190,235,255,0.9)';
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 4); ctx.fill();
        ctx.restore();
      }
      // người chơi
      this.ps.forEach((p, i) => {
        let [x, y] = this.pos(p, i);
        let z = 0, scale = 1, alpha = 1;
        if (p.hopT > 0 && p.from) {
          const k = 1 - p.hopT / HOP;
          x = U.lerp(p.from[0], x, k); y = U.lerp(p.from[1], y, k); z = Math.sin(k * Math.PI) * 60;
        }
        if (p.falling > 0) { const k = 1 - p.falling / 1.2; scale = Math.max(0, 1 - k * 1.2); y += k * 160; alpha = 1 - k; }
        Draw.blob(ctx, { x, y, z, r: 24, color: this.P[i].color, face: 0, walk: p.hopT > 0 ? p.walk * 3 : 0, scale, alpha,
          stun: p.falling > 0, shadow: p.falling <= 0 });
        if (p.done) Draw.crown(ctx, x, y - 34 - Math.abs(Math.sin(t * 6)) * 6, 22);
      });
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.done ? `🏁 #${p.rank}` : `${Math.max(0, p.col + 1)}/${COLS}`)));
      Draw.timer(ctx, this.time, W - 72, 38);
      Draw.text(ctx, 'Nhảy = tấm TRÊN · Đánh = tấm DƯỚI', W / 2, H - 40, { size: 22, color: '#ffe14d', sw: 4 });
    }

    results() {
      return this.ps.map((p) => (p.done
        ? { score: 1000 - p.rank, text: `Qua cầu thứ ${p.rank} · rơi ${p.falls} lần` }
        : { score: p.best + 1 + (p.col + 1) * 0.01, text: `Tới hàng ${p.best + 1}/${COLS} · rơi ${p.falls} lần` }));
    }

    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) { const [x, y] = this.pos(this.ps[i], i); return { x, y }; }

    botInput(i) {
      const p = this.ps[i];
      const o = { actP: false, jumpP: false };
      if (p.done || p.falling > 0 || p.hopT > 0 || this.finished) return o;
      const c = p.col + 1;
      let lane;
      if (c >= COLS) lane = U.randi(0, 1);
      else if (this.stepped[c][0] || this.broken[c][1]) lane = 0;
      else if (this.stepped[c][1] || this.broken[c][0]) lane = 1;
      else {
        // hàng chưa ai thử: máy khó sẽ chờ người khác thử trước một chút
        const lv = this.api.bot;
        p.wait += 1 / 60;
        const patience = (1 - lv.actDrop) * 1.2;
        const someoneBehindOrSame = this.ps.some((q, j) => j !== i && !q.done && q.col >= p.col - 1 && q.col < c);
        if (someoneBehindOrSame && p.wait < patience) return o;
        p.wait = 0;
        lane = U.randi(0, 1);
      }
      if (Math.random() < 0.18) { if (lane === 0) o.jumpP = true; else o.actP = true; }
      return o;
    }
  }

  Party.register({
    id: 'glass', name: 'Cầu Kính', emoji: '🌉',
    tagline: 'Nhảy đúng tấm kính chịu lực · qua cầu trước là thắng',
    how: 'Mỗi hàng có 2 tấm kính: 1 thật, 1 giả. Nút Nhảy = nhảy lên tấm TRÊN, nút Đánh = nhảy lên tấm DƯỚI của hàng kế tiếp. Nhảy trúng kính giả là rơi về đầu cầu! Kính vỡ và tấm đã có người đi (màu xanh lá) ai cũng thấy.',
    controls: { move: '(không dùng)', act: 'Nhảy tấm dưới', jump: 'Nhảy tấm trên' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Glass(api),
  });
})();

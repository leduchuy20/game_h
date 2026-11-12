'use strict';
/* Nhớ Chuỗi — xem chuỗi nút hiện lên rồi bấm lại đúng thứ tự. Mỗi vòng thêm 1 nút. Sai là bị loại. */
(() => {
  const SYM = [
    { ch: '↑', c: '#3d9bff' }, { ch: '↓', c: '#34cc78' }, { ch: '←', c: '#ffbf2e' }, { ch: '→', c: '#ff5c9d' },
    { ch: '●', c: '#ff7a1a', label: 'Đánh' }, { ch: '▲', c: '#9b5cff', label: 'Nhảy' },
  ];
  const MAX_ROUND = 20;

  class Simon {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.finished = false; this.seq = []; this.round = 0;
      this.ps = this.P.map(() => ({ alive: true, prog: 0, done: false, outRound: 0, prevDir: -1, flash: 0, last: -1 }));
      this.bot = this.P.map(() => ({ t: 0, pressing: -1 }));
      this.pre = 1.2;
      this.nextRound();
    }

    nextRound() {
      this.round++;
      // 2 nút đầu tiên cho dễ nhớ
      while (this.seq.length < this.round + 1) this.seq.push(U.randi(0, 5));
      this.phase = 'show'; this.showIdx = 0;
      this.step = Math.max(0.42, 0.85 - this.round * 0.035);
      this.showT = this.step;
      this.ps.forEach((p) => { p.prog = 0; p.done = false; p.last = -1; });
      this.bot.forEach((b, j) => { b.t = U.rand(0.5, 0.9) + this.api.botOf(j).react * 2; b.pressing = -1; });
    }

    symOf(q, p) {
      let dir = -1;
      if (Math.abs(q.mx) > 0.5 || Math.abs(q.my) > 0.5) {
        if (Math.abs(q.mx) >= Math.abs(q.my)) dir = q.mx > 0 ? 3 : 2; else dir = q.my > 0 ? 1 : 0;
      }
      let s = -1;
      if (dir >= 0 && dir !== p.prevDir) s = dir;
      p.prevDir = dir;
      if (q.actP) s = 4;
      if (q.jumpP) s = 5;
      return s;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      this.ps.forEach((p) => { p.flash -= dt; });
      if (this.pre > 0) { this.pre -= dt; return; }
      if (this.finished) return;
      if (this.phase === 'show') {
        this.showT -= dt;
        if (this.showT <= 0) {
          this.showIdx++;
          this.showT = this.step;
          if (this.showIdx >= this.seq.length) { this.phase = 'input'; this.inputT = this.seq.length * 1.1 + 2.5; this.inputMax = this.inputT; Sfx.play('go'); }
        }
        if (this.phase === 'show' && this.soundIdx !== `${this.round}-${this.showIdx}`) {
          this.soundIdx = `${this.round}-${this.showIdx}`;
          Sfx.tone(300 + this.seq[this.showIdx] * 90, 0.18, 'triangle', 0.25);
        }
        // đọc input để cập nhật prevDir, tránh tính nhầm nút đang giữ
        inp.forEach((q, i) => { this.symOf(q, this.ps[i]); });
        return;
      }
      if (this.phase === 'input') {
        this.inputT -= dt;
        inp.forEach((q, i) => {
          const p = this.ps[i];
          const s = this.symOf(q, p);
          if (!p.alive || p.done || s < 0) return;
          p.last = s; p.flash = 0.2;
          if (s === this.seq[p.prog]) {
            p.prog++;
            Sfx.tone(300 + s * 90, 0.1, 'triangle', 0.15);
            if (p.prog >= this.seq.length) { p.done = true; Sfx.play('pickup'); }
          } else {
            p.alive = false; p.outRound = this.round;
            Sfx.play('hurt'); FX.shake(4);
            parts.text(W / 2, 560, `${this.P[i].name} bấm sai!`, '#ff8fa8', 30);
          }
        });
        const pending = this.ps.filter((p) => p.alive && !p.done);
        if (!pending.length || this.inputT <= 0) {
          for (const p of pending) { p.alive = false; p.outRound = this.round; }
          if (pending.length) parts.text(W / 2, 600, 'Hết giờ!', '#ffe14d', 30);
          this.phase = 'result'; this.resultT = 1.5;
        }
        return;
      }
      if (this.phase === 'result') {
        this.resultT -= dt;
        if (this.resultT <= 0) {
          const alive = this.ps.filter((p) => p.alive).length;
          if (alive <= (this.n >= 2 ? 1 : 0) || this.round >= MAX_ROUND) this.finished = true;
          else this.nextRound();
        }
      }
    }

    drawSym(ctx, s, x, y, size, alpha = 1) {
      const S = SYM[s];
      ctx.save(); ctx.globalAlpha = alpha;
      Draw.rr(ctx, x - size / 2, y - size / 2, size, size, size * 0.22); ctx.fillStyle = S.c; ctx.fill();
      ctx.lineWidth = size * 0.05; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
      Draw.text(ctx, S.ch, x, y + size * 0.03, { size: size * 0.6, sw: size * 0.06 });
      ctx.restore();
    }

    draw(ctx) {
      const g = ctx.createRadialGradient(W / 2, 260, 60, W / 2, 260, 760);
      g.addColorStop(0, '#3b2a7a'); g.addColorStop(1, '#140d30');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      Draw.label(ctx, `Vòng ${this.round}`, 80, 38);
      Draw.text(ctx, '● = nút Đánh   ▲ = nút Nhảy   mũi tên = hướng đi', W / 2, H - 26, { size: 20, color: '#cfc4ff', sw: 4 });
      // khung hiển thị
      const cy = 230;
      if (this.pre > 0) Draw.text(ctx, 'Nhìn kỹ nhé…', W / 2, cy, { size: 54 });
      else if (this.phase === 'show') {
        const s = this.seq[this.showIdx];
        const k = this.showT / this.step;
        if (k > 0.2 && s !== undefined) this.drawSym(ctx, s, W / 2, cy, 170 * (0.9 + 0.1 * Math.min(1, (1 - k) * 5)));
        Draw.text(ctx, `${this.showIdx + 1} / ${this.seq.length}`, W / 2, cy + 120, { size: 26, color: '#cfc4ff' });
      } else if (this.phase === 'input') {
        Draw.text(ctx, 'Bấm lại đúng thứ tự!', W / 2, cy - 30, { size: 54, color: '#ffe14d' });
        const w = 500 * Math.max(0, this.inputT / this.inputMax);
        Draw.rr(ctx, W / 2 - 250, cy + 20, 500, 12, 6); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
        Draw.rr(ctx, W / 2 - 250, cy + 20, w, 12, 6); ctx.fillStyle = this.inputT < 2 ? '#ff3b52' : '#ffe14d'; ctx.fill();
        Draw.text(ctx, `${this.seq.length} nút`, W / 2, cy + 64, { size: 24, color: '#cfc4ff' });
      } else {
        Draw.text(ctx, 'Đáp án:', W / 2, cy - 70, { size: 28, color: '#cfc4ff' });
        const sz = Math.min(64, 900 / this.seq.length);
        this.seq.forEach((s, k) => this.drawSym(ctx, s, W / 2 + (k - (this.seq.length - 1) / 2) * (sz + 6), cy, sz));
      }
      // tiến độ từng người
      const rowY = 400, rowH = Math.min(70, 260 / this.n);
      this.ps.forEach((p, i) => {
        const y = rowY + i * rowH, c = this.P[i].color;
        Draw.blob(ctx, { x: 150, y, r: 22, color: c, dead: !p.alive, shadow: false, squash: p.flash > 0 ? 0.15 : 0 });
        Draw.text(ctx, this.P[i].name, 190, y, { size: 24, color: c.light, align: 'left' });
        const len = this.seq.length, sz = Math.min(34, 760 / len);
        for (let k = 0; k < len; k++) {
          const x = 270 + k * (sz + 6) + sz / 2;
          if (k < p.prog) this.drawSym(ctx, this.seq[k], x, y, sz);
          else { Draw.rr(ctx, x - sz / 2, y - sz / 2, sz, sz, sz * 0.22); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); }
        }
        const endX = 270 + len * (sz + 6) + 20;
        if (!p.alive) Draw.text(ctx, `✗ loại ở vòng ${p.outRound}`, endX, y, { size: 22, color: '#ff8fa8', align: 'left' });
        else if (p.done) Draw.text(ctx, '✓', endX, y, { size: 30, color: '#5dff9b', align: 'left' });
      });
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.alive ? '✓' : `✗ V${p.outRound}`)), { dim: this.ps.map((p) => !p.alive) });
    }

    results() {
      return this.ps.map((p) => (p.alive
        ? { score: 100 + this.round, text: `Trụ tới vòng ${this.round}` }
        : { score: p.outRound, text: `Loại ở vòng ${p.outRound}` }));
    }

    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) { return { x: 150, y: 400 + i * Math.min(70, 260 / this.n) }; }

    botInput(i) {
      const p = this.ps[i], st = this.bot[i], lv = this.api.botOf(i);
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (this.phase !== 'input' || !p.alive || p.done) return o;
      st.t -= 1 / 60;
      if (st.t > 0) return o;
      st.t = U.rand(0.22, 0.45) + lv.react;
      const err = 0.015 + lv.actDrop * 0.06 + this.seq.length * 0.006 * (0.5 + lv.actDrop * 2);
      let s = this.seq[p.prog];
      if (Math.random() < err) s = (s + U.randi(1, 5)) % 6;
      if (s === 0) o.my = -1; else if (s === 1) o.my = 1; else if (s === 2) o.mx = -1; else if (s === 3) o.mx = 1;
      else if (s === 4) o.actP = true; else o.jumpP = true;
      return o;
    }
  }

  Party.register({
    id: 'simon', name: 'Nhớ Chuỗi', emoji: '🧠', cat: 'brain',
    tagline: 'Xem chuỗi nút rồi bấm lại đúng thứ tự · sai là bị loại',
    how: 'Chuỗi gồm các hướng (↑ ↓ ← →), nút Đánh (●) và nút Nhảy (▲). Xem kỹ rồi bấm lại đúng thứ tự trước khi hết giờ. Mỗi vòng chuỗi dài thêm 1 nút. Người trụ lại cuối cùng thắng!',
    controls: { move: 'Bấm ↑ ↓ ← →', act: 'Nút ●', jump: 'Nút ▲' },
    minPlayers: 2, maxPlayers: 4,
    rawBot: true, // máy tự xử lý độ khó (bấm từng nút một)
    create: (api) => new Simon(api),
  });
})();

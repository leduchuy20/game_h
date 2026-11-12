'use strict';
/* Bấm Nhanh Ký Tự (NEW5) — mỗi người một băng chuyền chữ: mỗi "từ" là 3–5 ký hiệu (↑ ↓ ← → ● ▲).
   Bấm đúng hết một từ thì Tròn của mình chạy lên một bậc; từ ⚡ bắn sét đẩy người dẫn đầu lùi lại. Bấm sai bị khựng.
   Khác Nhớ Chuỗi: chuỗi hiện sẵn, thi tốc độ chứ không thi nhớ. */
(() => {
  const SYMS = ['up', 'down', 'left', 'right', 'act', 'jump'];
  const ICON = { up: '↑', down: '↓', left: '←', right: '→', act: '●', jump: '▲' };
  const COL = { up: '#5aa9ff', down: '#5aa9ff', left: '#5aa9ff', right: '#5aa9ff', act: '#ff6b8a', jump: '#7dff9a' };
  const GOAL = 16, STUN = 0.45, ZAP_EVERY = 4;
  const TOP = 92, BOTTOM = H - 20;

  class Combo {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.goal = api.count(GOAL); this.finished = false; this.elapsed = 0; this.maxT = 40 + this.goal * 9; this.doneN = 0;
      this.ps = this.P.map((p, i) => ({
        words: [], k: 0, pos: 0, shown: 0, stun: 0, flash: 0, zapped: 0, prev: { x: 0, y: 0 }, done: false, rank: 0, typed: 0, errs: 0, zaps: 0,
        bot: { t: U.rand(0.6, 1) },
      }));
      this.ps.forEach((p) => { for (let k = 0; k < 4; k++) this.addWord(p); });
      this.bolts = [];
    }

    addWord(p) {
      const len = U.randi(3, Math.min(5, 3 + Math.floor((p.pos + p.words.length) / 4)));
      const w = Array.from({ length: len }, () => U.pick(SYMS));
      p.words.push({ s: w, zap: (p.pos + p.words.length + 1) % ZAP_EVERY === 0 });
    }

    /** đọc phím "vừa bấm" thành ký hiệu */
    readSym(q, p) {
      const dx = q.mx > 0.6 ? 1 : q.mx < -0.6 ? -1 : 0, dy = q.my > 0.6 ? 1 : q.my < -0.6 ? -1 : 0;
      let s = null;
      if (dx !== p.prev.x && dx) s = dx > 0 ? 'right' : 'left';
      if (dy !== p.prev.y && dy) s = dy > 0 ? 'down' : 'up';
      p.prev = { x: dx, y: dy };
      if (q.actP) s = 'act';
      if (q.jumpP) s = 'jump';
      return s;
    }

    press(p, i, s) {
      const w = p.words[0];
      if (s === w.s[p.k]) {
        p.k++; p.typed++; Sfx.tone(600 + p.k * 80, 0.05, 'square', 0.04);
        if (p.k >= w.s.length) this.wordDone(p, i, w);
      } else {
        p.stun = STUN; p.flash = 0.3; p.k = 0; p.errs++; Sfx.play('hurt', 0.05);
      }
    }

    wordDone(p, i, w) {
      p.words.shift(); p.k = 0; p.pos++; this.addWord(p);
      Sfx.play('pickup', 0.03);
      if (w.zap) {
        // sét: đẩy người dẫn đầu (không phải mình) lùi 1 bậc
        let tg = -1;
        this.ps.forEach((o, j) => { if (j !== i && !o.done && o.pos > 0 && (tg < 0 || o.pos > this.ps[tg].pos)) tg = j; });
        if (tg >= 0) {
          const o = this.ps[tg]; o.pos = Math.max(0, o.pos - 1); o.zapped = 0.6; o.k = 0; p.zaps++;
          this.bolts.push({ from: i, to: tg, t: 0.4 }); Sfx.play('boom', 0.05); FX.shake(4); Party.rumble(tg, 0.6, 200);
        }
      }
      if (p.pos >= this.goal && !p.done) { p.done = true; p.rank = ++this.doneN; Sfx.play('win'); }
    }

    update(dt, inp) {
      this.elapsed += dt;
      // người đầu tiên về đích → những người khác còn vài giây
      if (this.doneN > 0 && this.firstAt === undefined) this.firstAt = this.elapsed;
      if (!this.finished && (this.ps.every((p) => p.done) || (this.firstAt !== undefined && this.elapsed - this.firstAt > 5) || this.elapsed > this.maxT)) this.finished = true;
      for (const b of this.bolts) b.t -= dt;
      this.bolts = this.bolts.filter((b) => b.t > 0);
      this.ps.forEach((p, i) => {
        p.stun -= dt; p.flash -= dt; p.zapped -= dt;
        p.shown += (p.pos - p.shown) * Math.min(1, dt * 8);
        if (p.done || this.finished) return;
        let s;
        if (this.P[i].bot) s = this.botSym(p, dt, i);
        else s = this.readSym(inp[i], p);
        if (s && p.stun <= 0) this.press(p, i, s);
      });
    }

    /** máy bấm theo nhịp + tỉ lệ bấm nhầm theo mức */
    botSym(p, dt, i) {
      const lv = this.api.botOf(i);
      if (p.stun > 0) return null;
      p.bot.t -= dt;
      if (p.bot.t > 0) return null;
      const base = lv.actDrop > 0.4 ? 0.5 : lv.actDrop > 0.1 ? 0.37 : 0.28;
      p.bot.t = base * U.rand(0.7, 1.35);
      const want = p.words[0].s[p.k], err = lv.actDrop > 0.4 ? 0.1 : lv.actDrop > 0.1 ? 0.06 : 0.03;
      return Math.random() < err ? U.pick(SYMS.filter((x) => x !== want)) : want;
    }

    draw(ctx) {
      ctx.fillStyle = '#1f1a3a'; ctx.fillRect(0, 0, W, H);
      const lh = (BOTTOM - TOP) / this.n, t = U.now();
      this.ps.forEach((p, i) => {
        const y0 = TOP + i * lh, cy = y0 + lh / 2, c = this.P[i].color;
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)'; ctx.fillRect(0, y0, W, lh);
        if (p.flash > 0) { ctx.fillStyle = `rgba(255,60,80,${p.flash})`; ctx.fillRect(0, y0, W, lh); }
        // đường chạy phía dưới làn
        const ry = y0 + lh - 26, rx0 = 120, rx1 = W - 70;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(rx0, ry); ctx.lineTo(rx1, ry); ctx.stroke();
        for (let k = 0; k <= this.goal; k++) { const x = rx0 + (rx1 - rx0) * k / this.goal; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 1, ry - 6, 2, 12); }
        Draw.text(ctx, '🏁', rx1 + 22, ry - 6, { size: 24, stroke: null });
        const bx = rx0 + (rx1 - rx0) * Math.min(1, p.shown / this.goal);
        Draw.blob(ctx, { x: bx, y: ry - 14, r: 14, color: c, face: 0, walk: t * 10, stun: p.stun > 0 || p.zapped > 0, shadow: false });
        Draw.blob(ctx, { x: 56, y: cy - 10, r: 24, color: c, face: 0, shadow: false });
        Draw.text(ctx, this.P[i].name, 56, cy + 26, { size: 18, color: c.light });
        if (p.done) { Draw.text(ctx, `🏁 Về đích #${p.rank}`, W / 2, cy - 10, { size: 34, color: '#ffe14d' }); return; }
        // băng chuyền: từ hiện tại to, các từ sau nhỏ dần
        let x = 130;
        const sz = Math.min(54, lh * 0.42);
        p.words.slice(0, 3).forEach((w, wi) => {
          const s = wi === 0 ? sz : sz * 0.6, gap = s * 1.05;
          const ww = w.s.length * gap + 26;
          const yy = cy - 14;
          Draw.rr(ctx, x - 10, yy - s * 0.7, ww - 6, s * 1.4, 14);
          ctx.fillStyle = wi === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'; ctx.fill();
          if (w.zap) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; ctx.stroke(); Draw.text(ctx, '⚡', x - 6, yy - s * 0.7, { size: s * 0.45, stroke: null }); }
          w.s.forEach((sym, k) => {
            const done = wi === 0 && k < p.k, cur = wi === 0 && k === p.k;
            const sx = x + 8 + k * gap + gap / 2 - 8;
            if (cur) { ctx.fillStyle = 'rgba(255,225,77,0.25)'; ctx.beginPath(); ctx.arc(sx, yy, s * 0.55, 0, TAU); ctx.fill(); }
            Draw.text(ctx, ICON[sym], sx, yy, { size: s, color: done ? 'rgba(255,255,255,0.25)' : COL[sym], sw: wi === 0 ? 5 : 3 });
          });
          x += ww + 14;
        });
      });
      // tia sét
      for (const b of this.bolts) {
        const y1 = TOP + (b.from + 0.5) * lh, y2 = TOP + (b.to + 0.5) * lh;
        ctx.strokeStyle = `rgba(255,240,120,${b.t / 0.4})`; ctx.lineWidth = 5; ctx.beginPath();
        for (let k = 0; k <= 8; k++) ctx.lineTo(W - 120 + (k % 2 ? 18 : -18), y1 + (y2 - y1) * k / 8);
        ctx.stroke();
      }
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.done ? `🏁 #${p.rank}` : `${p.pos}/${this.goal}`)), { w: 160 });
      Draw.label(ctx, '● Đánh  ▲ Nhảy', 110, 38);
    }

    results() {
      return this.ps.map((p) => (p.done ? { score: 1000 - p.rank, text: `Về đích #${p.rank} · sai ${p.errs} · sét ${p.zaps}` } : { score: p.pos + p.k * 0.01, text: `${p.pos}/${this.goal} từ · sai ${p.errs}` }));
    }
    botInput() { return {}; }
    posOf(i) { const lh = (BOTTOM - TOP) / this.n; return { x: 56, y: TOP + (i + 0.5) * lh - 10 }; }
  }

  Party.register({
    id: 'combo', name: 'Bấm Nhanh Ký Tự', emoji: '⌨️', cat: 'brain',
    tagline: 'Gõ chuỗi ký hiệu thật nhanh, bắn sét người dẫn đầu',
    how: 'Mỗi người một băng chuyền. Mỗi "từ" là 3–5 ký hiệu: ↑ ↓ ← → là hướng, ● là nút Đánh, ▲ là nút Nhảy. Bấm đúng lần lượt hết một từ thì Tròn của bạn chạy lên một bậc. '
      + 'Bấm sai bị khựng một chút và phải gõ lại từ đầu. Từ có viền ⚡: gõ xong sẽ bắn sét đẩy người đang dẫn đầu lùi một bậc. Ai về đích trước thắng.',
    controls: { move: '↑ ↓ ← →', act: '●', jump: '▲' },
    minPlayers: 2, maxPlayers: 4, rawBot: true,
    create: (api) => new Combo(api),
  });
})();

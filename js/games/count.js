'use strict';
/* Đếm Tròn (NEW9) — một đoàn Tròn đủ màu, đủ phụ kiện chạy qua màn hình trong ít giây, rồi hỏi bất ngờ
   (ví dụ "bao nhiêu Tròn ĐỎ đội VƯƠNG MIỆN?"). Đánh +1, Nhảy −1, bấm Xuống để chốt. Gần đúng nhất thắng câu. */
(() => {
  const PARADE_T = 10, ANSWER_T = 7, SHOW_T = 3.2, ROUNDS = 5;
  const COLORS = [
    { id: 'red', name: 'ĐỎ', c: { main: '#e8404f', dark: '#9c1f2c', light: '#ff9aa4' } },
    { id: 'blue', name: 'XANH DƯƠNG', c: { main: '#3d7bf0', dark: '#1d47a0', light: '#9cc0ff' } },
    { id: 'green', name: 'XANH LÁ', c: { main: '#34b45a', dark: '#1a6d33', light: '#94e8a9' } },
    { id: 'yellow', name: 'VÀNG', c: { main: '#f0c419', dark: '#9c7a05', light: '#fff09a' } },
    { id: 'purple', name: 'TÍM', c: { main: '#9b4fd8', dark: '#5d2690', light: '#d6aaff' } },
  ];
  const ACC = [
    { id: 'none', name: '', icon: '' },
    { id: 'crown', name: 'đội VƯƠNG MIỆN', icon: '👑' },
    { id: 'hat', name: 'đội MŨ', icon: '🎩' },
    { id: 'shades', name: 'đeo KÍNH', icon: '🕶️' },
  ];

  class Count {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.qn = api.count(ROUNDS); this.round = 0; this.finished = false;
      this.score = new Array(this.n).fill(0); this.exact = new Array(this.n).fill(0);
      this.nextRound();
    }

    nextRound() {
      this.round++;
      if (this.round > this.qn) { this.finished = true; return; }
      this.phase = 'parade'; this.t = PARADE_T; this.pt = 0;
      // càng về sau càng đông, chạy nhanh hơn
      const k = (this.round - 1) / Math.max(1, this.qn - 1);
      const N = Math.round(U.lerp(14, 30, k) + U.rand(-2, 2));
      this.walkers = Array.from({ length: N }, () => {
        const col = U.randi(0, COLORS.length - 1);
        const acc = Math.random() < 0.45 ? 0 : U.randi(1, ACC.length - 1);
        const dir = U.pick(['L', 'R', 'R', 'L', 'U', 'D']);
        const sp = U.rand(160, 260) * (1 + k * 0.5), r = U.rand(17, 24);
        const start = U.rand(0, PARADE_T - 3.2);
        let x, y, vx = 0, vy = 0;
        if (dir === 'L') { x = W + 40; y = U.rand(120, H - 70); vx = -sp; }
        else if (dir === 'R') { x = -40; y = U.rand(120, H - 70); vx = sp; }
        else if (dir === 'U') { x = U.rand(80, W - 80); y = H + 40; vy = -sp * 0.75; }
        else { x = U.rand(80, W - 80); y = 60; vy = sp * 0.75; }
        return { col, acc, x, y, vx, vy, r, start, walk: Math.random() * 6, wob: Math.random() * 6 };
      });
      this.makeQuestion();
      this.ans = new Array(this.n).fill(0); this.lock = new Array(this.n).fill(-1); this.lockN = 0;
      this.prevDown = new Array(this.n).fill(false);
      this.botPlan = this.P.map((p, i) => (p.bot ? this.makeBot(i) : null));
    }

    makeQuestion() {
      const w = this.walkers;
      const types = ['color', 'acc', 'both', 'both'];
      for (let tries = 0; tries < 30; tries++) {
        const ty = U.pick(types), col = U.randi(0, COLORS.length - 1), acc = U.randi(1, ACC.length - 1);
        const f = ty === 'color' ? (x) => x.col === col : ty === 'acc' ? (x) => x.acc === acc : (x) => x.col === col && x.acc === acc;
        const ans = w.filter(f).length;
        if (ans === 0 && Math.random() < 0.8) continue; // đôi khi đáp án = 0 cho vui
        const cName = COLORS[col].name, aName = ACC[acc].name;
        this.q = {
          ty, col, acc, ans,
          text: ty === 'color' ? `Có bao nhiêu Tròn ${cName}?` : ty === 'acc' ? `Có bao nhiêu Tròn ${aName}?` : `Có bao nhiêu Tròn ${cName} ${aName}?`,
        };
        return;
      }
      const col = U.randi(0, COLORS.length - 1);
      this.q = { ty: 'color', col, acc: 0, ans: w.filter((x) => x.col === col).length, text: `Có bao nhiêu Tròn ${COLORS[col].name}?` };
    }

    /** máy "nhớ" sai một chút tuỳ mức độ khó */
    makeBot(i) {
      const lv = this.api.botOf(i), a = this.q.ans;
      const sharp = lv.actDrop > 0.4 ? 0.25 : lv.actDrop > 0.1 ? 0.45 : 0.62;
      let guess = a;
      if (Math.random() > sharp) {
        const spread = lv.actDrop > 0.4 ? 3 : lv.actDrop > 0.1 ? 2 : 1;
        let d = U.randi(-spread, spread); if (d === 0) d = Math.random() < 0.5 ? 1 : -1;
        guess = Math.max(0, a + d);
      }
      return { guess, next: U.rand(0.5, 1.2), lockAt: U.rand(2, ANSWER_T - 1) };
    }

    update(dt, inp) {
      if (this.finished) return;
      this.t -= dt;
      if (this.phase === 'parade') {
        this.pt += dt;
        for (const w of this.walkers) if (this.pt >= w.start) { w.x += w.vx * dt; w.y += w.vy * dt; w.walk += dt * 12; }
        if (this.t <= 0) { this.phase = 'answer'; this.t = ANSWER_T; Sfx.play('warn'); }
      } else if (this.phase === 'answer') {
        inp.forEach((q, i) => {
          if (this.lock[i] >= 0) return;
          let up = q.actP, dn = q.jumpP;
          const down = q.my > 0.6;
          let lk = down && !this.prevDown[i];
          this.prevDown[i] = down;
          if (this.P[i].bot) {
            const b = this.botPlan[i];
            up = dn = lk = false;
            b.next -= dt;
            if (b.next <= 0) {
              b.next = U.rand(0.12, 0.25);
              if (this.ans[i] < b.guess) up = true; else if (this.ans[i] > b.guess) dn = true;
              else if (ANSWER_T - this.t > b.lockAt) lk = true;
            }
          }
          if (up) { this.ans[i]++; Sfx.tone(700, 0.04, 'square', 0.04); }
          if (dn && this.ans[i] > 0) { this.ans[i]--; Sfx.tone(500, 0.04, 'square', 0.04); }
          if (lk) { this.lock[i] = this.lockN++; Sfx.play('place'); }
        });
        if (this.t <= 0 || this.lock.every((l) => l >= 0)) this.reveal();
      } else if (this.phase === 'show') {
        if (this.t <= 0) this.nextRound();
      }
    }

    reveal() {
      this.phase = 'show'; this.t = SHOW_T;
      const a = this.q.ans, diff = this.ans.map((x) => Math.abs(x - a)), best = Math.min(...diff);
      this.gain = new Array(this.n).fill(0);
      // gần đúng nhất +2, đúng tuyệt đối thêm +1, đúng mà chốt sớm nhất thêm +1
      const exactLockers = this.ans.map((x, i) => (x === a && this.lock[i] >= 0 ? i : -1)).filter((i) => i >= 0);
      const firstLock = exactLockers.sort((u, v) => this.lock[u] - this.lock[v])[0];
      diff.forEach((d, i) => {
        let g = 0;
        if (d === best) g += 2;
        if (d === 0) { g += 1; this.exact[i]++; }
        if (i === firstLock) g += 1;
        this.gain[i] = g; this.score[i] += g;
      });
      Sfx.play(best === 0 ? 'win' : 'pickup');
    }

    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2b3f6b'); g.addColorStop(1, '#1b2747');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // sân cỏ để đoàn chạy qua
      ctx.fillStyle = '#3d7a4a'; ctx.fillRect(0, 96, W, H - 96);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let x = 0; x < W; x += 80) ctx.fillRect(x, 96, 40, H - 96);
      if (this.phase === 'parade') {
        const ws = this.walkers.filter((w) => this.pt >= w.start).sort((a, b) => a.y - b.y);
        for (const w of ws) {
          const face = Math.atan2(w.vy, w.vx);
          Draw.blob(ctx, { x: w.x, y: w.y, r: w.r, color: COLORS[w.col].c, face, walk: w.walk });
          const a = ACC[w.acc];
          if (a.id === 'crown') Draw.crown(ctx, w.x, w.y - w.r * 1.1, w.r * 0.9);
          else if (a.id === 'hat') Draw.text(ctx, '🎩', w.x, w.y - w.r * 1.15, { size: w.r * 1.1, stroke: null });
          else if (a.id === 'shades') Draw.text(ctx, '🕶️', w.x + Math.cos(face) * w.r * 0.2, w.y - w.r * 0.15, { size: w.r * 0.9, stroke: null });
        }
        Draw.label(ctx, `Câu ${this.round}/${this.qn} · Nhìn kỹ!`, 150, 38);
        Draw.timer(ctx, Math.max(0, this.t), W - 72, 38);
        if (this.pt < 2.5) Draw.banner(ctx, '👀 Nhìn kỹ đoàn Tròn!', this.pt, { size: 48, y: 140, sub: 'Màu áo, vương miện, mũ, kính... chưa biết sẽ hỏi gì đâu!' });
      } else {
        ctx.fillStyle = 'rgba(10,14,30,0.55)'; ctx.fillRect(0, 0, W, H);
        Draw.label(ctx, `Câu ${this.round}/${this.qn}`, 90, 38);
        if (this.phase === 'answer') Draw.timer(ctx, Math.max(0, this.t), W - 72, 38);
        // câu hỏi + hình minh hoạ
        Draw.text(ctx, this.q.text, W / 2, 140, { size: 44, sw: 8, color: '#ffe14d' });
        const ix = W / 2, iy = 225;
        if (this.q.ty !== 'acc') Draw.blob(ctx, { x: ix, y: iy, r: 34, color: COLORS[this.q.col].c, face: Math.PI / 2 });
        else Draw.blob(ctx, { x: ix, y: iy, r: 34, color: { main: '#bbb', dark: '#777', light: '#eee' }, face: Math.PI / 2 });
        if (this.q.ty !== 'color') {
          const a = ACC[this.q.acc];
          if (a.id === 'crown') Draw.crown(ctx, ix, iy - 38, 30);
          else Draw.text(ctx, a.icon, ix, a.id === 'shades' ? iy - 6 : iy - 40, { size: 34, stroke: null });
        }
        // ô trả lời của từng người
        const bw = 230, gap = 24, x0 = W / 2 - (this.n * bw + (this.n - 1) * gap) / 2;
        this.P.forEach((p, i) => {
          const x = x0 + i * (bw + gap), y = 320;
          Draw.rr(ctx, x, y, bw, 260, 24); ctx.fillStyle = 'rgba(20,12,40,0.75)'; ctx.fill();
          ctx.lineWidth = 4; ctx.strokeStyle = this.lock[i] >= 0 ? '#7dff9a' : p.color.main; ctx.stroke();
          Draw.blob(ctx, { x: x + bw / 2, y: y + 50, r: 26, color: p.color, face: Math.PI / 2, shadow: false });
          Draw.text(ctx, p.name, x + bw / 2, y + 96, { size: 22, color: p.color.light });
          Draw.text(ctx, String(this.ans[i]), x + bw / 2, y + 160, { size: 72, sw: 8 });
          if (this.phase === 'answer') Draw.text(ctx, this.lock[i] >= 0 ? '🔒 Đã chốt' : 'Đánh +1 · Nhảy −1 · ↓ chốt', x + bw / 2, y + 226, { size: 15, color: this.lock[i] >= 0 ? '#7dff9a' : '#ccc', sw: 3 });
          else Draw.text(ctx, this.gain[i] > 0 ? `+${this.gain[i]} điểm` : 'trượt', x + bw / 2, y + 226, { size: 22, color: this.gain[i] > 0 ? '#ffe14d' : '#ff8fa8' });
        });
        if (this.phase === 'show') Draw.banner(ctx, `Đáp án: ${this.q.ans}`, SHOW_T - this.t, { size: 52, y: 640 });
      }
      Draw.chips(ctx, this.P, this.score.map((s) => `${s} đ`), { w: 150, y: 38 });
    }

    results() {
      return this.score.map((s, i) => ({ score: s, text: `${s} điểm · đúng ${this.exact[i]}/${this.qn} câu` }));
    }

    botInput() { return {}; }
    posOf(i) { return { x: W / 2 - (this.n * 230 + (this.n - 1) * 24) / 2 + i * 254 + 115, y: 370 }; }
  }

  Party.register({
    id: 'count', name: 'Đếm Tròn', emoji: '🔢', cat: 'brain',
    tagline: 'Nhìn đoàn Tròn chạy qua rồi trả lời câu hỏi bất ngờ',
    how: 'Một đoàn Tròn đủ màu, có người đội vương miện, đội mũ, đeo kính chạy qua màn hình. Hết đoàn thì mới hỏi — ví dụ "Có bao nhiêu Tròn ĐỎ đội VƯƠNG MIỆN?". '
      + 'Bấm Đánh để +1, Nhảy để −1, bấm Xuống để chốt đáp án. Gần đúng nhất +2 điểm, đúng tuyệt đối thêm +1, người chốt đúng sớm nhất thêm +1. Câu sau đông người hơn và chạy nhanh hơn.',
    controls: { move: '↓ chốt đáp án', act: '+1', jump: '−1' },
    minPlayers: 2, maxPlayers: 4, rawBot: true,
    create: (api) => new Count(api),
  });
})();

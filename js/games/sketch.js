'use strict';
/* Vẽ Theo Khuôn (NEW6) — hình mẫu hiện vài giây rồi ẩn; mỗi người tự vẽ lại trên bảng của mình
   (giữ Đánh để tô, giữ Nhảy để tẩy). Chấm % khớp theo lưới. */
(() => {
  const G = 12, SHOW_T = 5, DRAW_T = 14, SCORE_T = 3.5, ROUNDS = 4, SPEED = 300;
  const SHAPES = [
    { name: 'Trái tim', rows: [
      '............', '..##....##..', '.####..####.', '############', '############', '############',
      '.##########.', '..########..', '...######...', '....####....', '.....##.....', '............'] },
    { name: 'Ngôi nhà', rows: [
      '.....##.....', '....####....', '...######...', '..########..', '.##########.', '############',
      '.##########.', '.##......##.', '.##..##..##.', '.##..##..##.', '.##..##..##.', '.##########.'] },
    { name: 'Mặt cười', rows: [
      '...######...', '..#......#..', '.#........#.', '#..##..##..#', '#..##..##..#', '#..........#',
      '#..........#', '#.#......#.#', '#..#....#..#', '.#..####..#.', '..#......#..', '...######...'] },
    { name: 'Mũi tên', rows: [
      '......#.....', '......##....', '......###...', '......####..', '############', '#############'.slice(0, 12),
      '############', '......####..', '......###...', '......##....', '......#.....', '............'] },
    { name: 'Ngôi sao', rows: [
      '.....##.....', '.....##.....', '....####....', '############', '.##########.', '..########..',
      '...######...', '..########..', '..###..###..', '.###....###.', '.##......##.', '............'] },
    { name: 'Con cá', rows: [
      '............', '....#####...', '..########..', '.##########.', '###.#######.', '############',
      '############', '.##########.', '..########.#', '....#####..#', '...........#', '............'] },
    { name: 'Chữ T', rows: [
      '############', '############', '....####....', '....####....', '....####....', '....####....',
      '....####....', '....####....', '....####....', '....####....', '....####....', '....####....'] },
    { name: 'Cây thông', rows: [
      '.....##.....', '....####....', '...######...', '..########..', '....####....', '...######...',
      '..########..', '.##########.', '############', '.....##.....', '.....##.....', '....####....'] },
    { name: 'Chữ thập', rows: [
      '....####....', '....####....', '....####....', '....####....', '############', '############',
      '############', '############', '....####....', '....####....', '....####....', '....####....'] },
    { name: 'Vòng tròn', rows: [
      '....####....', '..########..', '.###....###.', '.##......##.', '##........##', '##........##',
      '##........##', '##........##', '.##......##.', '.###....###.', '..########..', '....####....'] },
  ].map((s) => ({ name: s.name, cells: s.rows.flatMap((r) => r.padEnd(G, '.').slice(0, G).split('').map((ch) => ch === '#')) }));

  class Sketch {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.qn = api.count(ROUNDS); this.round = 0; this.finished = false;
      this.score = new Array(this.n).fill(0); this.best = new Array(this.n).fill(0);
      this.order = U.shuffle(SHAPES.slice());
      // bảng vẽ của từng người
      const gap = 24, size = Math.min(this.n <= 2 ? 440 : 280, (W - 60 - gap * (this.n - 1)) / this.n);
      this.cs = size / G; this.size = size;
      const x0 = W / 2 - (this.n * size + (this.n - 1) * gap) / 2;
      this.boards = this.P.map((_, i) => ({ x: x0 + i * (size + gap), y: this.n <= 2 ? 170 : 230 }));
      this.ps = this.P.map(() => ({ cx: G / 2, cy: G / 2, cells: new Array(G * G).fill(false), pct: 0, bot: null }));
      this.next();
    }

    next() {
      this.round++;
      if (this.round > this.qn) { this.finished = true; return; }
      this.shape = this.order[(this.round - 1) % this.order.length];
      this.phase = 'show'; this.t = SHOW_T;
      this.ps.forEach((p, i) => { p.cells.fill(false); p.cx = G / 2; p.cy = G / 2; p.pct = 0; p.bot = this.P[i].bot ? this.planBot(i) : null; });
    }

    /** máy vẽ theo trí nhớ: nhớ sai vài ô tuỳ mức */
    planBot(i) {
      const lv = this.api.botOf(i), miss = lv.actDrop > 0.4 ? 0.3 : lv.actDrop > 0.1 ? 0.17 : 0.07;
      const want = this.shape.cells.map((v) => (Math.random() < miss ? !v : v));
      // lệch cả hình một ô đôi khi
      const sh = Math.random() < miss ? [U.randi(-1, 1), U.randi(-1, 1)] : [0, 0];
      const cells = [];
      for (let k = 0; k < G * G; k++) if (want[k]) { const x = (k % G) + sh[0], y = Math.floor(k / G) + sh[1]; if (x >= 0 && y >= 0 && x < G && y < G) cells.push([x, y]); }
      const speed = lv.actDrop > 0.4 ? 0.62 : lv.actDrop > 0.1 ? 0.8 : 1;
      return { todo: cells, speed, tgt: null };
    }

    update(dt, inp) {
      if (this.finished) return;
      this.t -= dt;
      if (this.phase === 'show') { if (this.t <= 0) { this.phase = 'draw'; this.t = DRAW_T; Sfx.play('go'); } return; }
      if (this.phase === 'draw') {
        this.ps.forEach((p, i) => {
          let q = inp[i];
          if (p.bot) q = this.botMove(p);
          p.cx = U.clamp(p.cx + q.mx * SPEED / this.cs * dt * (p.bot ? p.bot.speed : 1), 0, G - 0.01);
          p.cy = U.clamp(p.cy + q.my * SPEED / this.cs * dt * (p.bot ? p.bot.speed : 1), 0, G - 0.01);
          const k = Math.floor(p.cy) * G + Math.floor(p.cx);
          if (q.act && !p.cells[k]) { p.cells[k] = true; Sfx.tone(800 + Math.random() * 200, 0.02, 'sine', 0.02); }
          else if (q.jump && p.cells[k]) p.cells[k] = false;
        });
        if (this.t <= 0) this.scoreRound();
        return;
      }
      if (this.phase === 'score' && this.t <= 0) this.next();
    }

    botMove(p) {
      const b = p.bot, o = { mx: 0, my: 0, act: false, jump: false };
      if (!b.tgt) {
        // ô gần nhất chưa tô
        let bi = -1, bd = Infinity;
        b.todo.forEach(([x, y], j) => { const d = Math.hypot(x + 0.5 - p.cx, y + 0.5 - p.cy); if (d < bd) { bd = d; bi = j; } });
        if (bi < 0) return o;
        b.tgt = b.todo.splice(bi, 1)[0];
      }
      const tx = b.tgt[0] + 0.5, ty = b.tgt[1] + 0.5, dx = tx - p.cx, dy = ty - p.cy, d = Math.hypot(dx, dy);
      if (d < 0.25) { o.act = true; b.tgt = null; return o; }
      o.mx = dx / d; o.my = dy / d;
      return o;
    }

    scoreRound() {
      this.phase = 'score'; this.t = SCORE_T;
      const S = this.shape.cells;
      this.ps.forEach((p, i) => {
        let inter = 0, uni = 0;
        for (let k = 0; k < G * G; k++) { if (S[k] && p.cells[k]) inter++; if (S[k] || p.cells[k]) uni++; }
        p.pct = uni ? Math.round(inter / uni * 100) : 0;
        this.score[i] += p.pct; this.best[i] = Math.max(this.best[i], p.pct);
      });
      Sfx.play('win');
    }

    drawGrid(ctx, x, y, cells, col, alpha = 1) {
      const cs = this.cs;
      ctx.globalAlpha = alpha;
      for (let k = 0; k < G * G; k++) if (cells[k]) { ctx.fillStyle = col; ctx.fillRect(x + (k % G) * cs + 1, y + Math.floor(k / G) * cs + 1, cs - 2, cs - 2); }
      ctx.globalAlpha = 1;
    }

    draw(ctx) {
      ctx.fillStyle = '#2b2440'; ctx.fillRect(0, 0, W, H);
      const sz = this.size, cs = this.cs;
      if (this.phase === 'show') {
        Draw.text(ctx, `Nhớ hình: ${this.shape.name}`, W / 2, 128, { size: 34, color: '#ffe14d' });
        Draw.text(ctx, `Ẩn sau ${Math.ceil(this.t)} giây…`, W / 2, 162, { size: 20 });
      } else if (this.phase === 'draw') Draw.text(ctx, `Vẽ lại: ${this.shape.name} · giữ Đánh tô, giữ Nhảy tẩy`, W / 2, 128, { size: 28, color: '#ffe14d' });
      else Draw.text(ctx, `Đáp án: ${this.shape.name}`, W / 2, 128, { size: 32, color: '#ffe14d' });
      this.ps.forEach((p, i) => {
        const b = this.boards[i], c = this.P[i].color;
        Draw.rr(ctx, b.x - 8, b.y - 8, sz + 16, sz + 16, 14); ctx.fillStyle = '#f6f1e3'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = c.main; ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1;
        for (let k = 1; k < G; k++) { ctx.beginPath(); ctx.moveTo(b.x + k * cs, b.y); ctx.lineTo(b.x + k * cs, b.y + sz); ctx.moveTo(b.x, b.y + k * cs); ctx.lineTo(b.x + sz, b.y + k * cs); ctx.stroke(); }
        if (this.phase === 'show') this.drawGrid(ctx, b.x, b.y, this.shape.cells, '#3a3050');
        else {
          if (this.phase === 'score') this.drawGrid(ctx, b.x, b.y, this.shape.cells, '#3a3050', 0.25);
          this.drawGrid(ctx, b.x, b.y, p.cells, c.main, this.phase === 'score' ? 0.85 : 1);
          if (this.phase === 'draw') {
            const x = b.x + p.cx * cs, y = b.y + p.cy * cs;
            ctx.strokeStyle = c.dark; ctx.lineWidth = 3; ctx.strokeRect(b.x + Math.floor(p.cx) * cs, b.y + Math.floor(p.cy) * cs, cs, cs);
            Draw.text(ctx, '✏️', x + 8, y - 8, { size: 22, stroke: null });
          }
        }
        Draw.blob(ctx, { x: b.x + sz / 2 - 40, y: b.y + sz + 40, r: 18, color: c, face: Math.PI / 2, shadow: false });
        Draw.text(ctx, this.P[i].name, b.x + sz / 2 - 10, b.y + sz + 40, { size: 20, align: 'left', color: c.light });
        if (this.phase === 'score') Draw.text(ctx, `${p.pct}%`, b.x + sz / 2, b.y + sz / 2, { size: 56, color: p.pct >= 80 ? '#7dff9a' : p.pct >= 50 ? '#ffe14d' : '#ff8fa8', sw: 8 });
      });
      Draw.chips(ctx, this.P, this.score.map((s) => `${s} đ`), { w: 160 });
      Draw.label(ctx, `Hình ${Math.min(this.round, this.qn)}/${this.qn}`, 80, 38);
      if (this.phase !== 'score') Draw.timer(ctx, Math.max(0, this.t), W - 72, 38);
    }

    results() { return this.score.map((s, i) => ({ score: s, text: `${s} điểm · khớp nhất ${this.best[i]}%` })); }
    botInput() { return {}; }
    posOf(i) { const b = this.boards[i]; return { x: b.x + this.size / 2, y: b.y + this.size + 30 }; }
  }

  Party.register({
    id: 'sketch', name: 'Vẽ Theo Khuôn', emoji: '✏️', cat: 'collect',
    tagline: 'Nhớ hình mẫu rồi vẽ lại trên bảng của mình',
    how: 'Hình mẫu hiện vài giây rồi ẩn đi. Mỗi người một bảng vẽ: di chuyển bút chì, giữ Đánh để tô ô, giữ Nhảy để tẩy. Hết giờ thì chấm % khớp với hình mẫu (tô thừa cũng bị trừ). Cộng % qua các hình, ai cao nhất thắng.',
    controls: { move: 'Di chuyển bút', act: 'Giữ: tô', jump: 'Giữ: tẩy' },
    minPlayers: 2, maxPlayers: 4, rawBot: true,
    create: (api) => new Sketch(api),
  });
})();

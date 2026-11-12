'use strict';
/* Đố Toán & Đoán Màu — chạy tới đứng dưới cửa có đáp án đúng trước khi hết giờ. Sai cửa mất 1 tim.
   Hai game dùng chung 1 khung, chỉ khác cách ra câu hỏi. */
(() => {
  const FLOOR = 560, DOOR_Y = 250, DOOR_W = 190, DOOR_H = 200, QUESTIONS = 12;
  const COLORS = [
    { name: 'ĐỎ', c: '#ff3b52' }, { name: 'XANH LÁ', c: '#2fbf63' }, { name: 'XANH DƯƠNG', c: '#3d8bff' },
    { name: 'VÀNG', c: '#ffcc1f' }, { name: 'TÍM', c: '#9b5cff' }, { name: 'CAM', c: '#ff8a2e' },
  ];

  function mathQ(k) {
    let text, ans;
    const r = U.randi;
    const type = k < 3 ? 0 : k < 6 ? U.randi(0, 1) : k < 9 ? U.randi(0, 2) : U.randi(1, 3);
    if (type === 0) { const a = r(2, 20), b = r(2, 20); text = `${a} + ${b}`; ans = a + b; }
    else if (type === 1) { const a = r(10, 40), b = r(2, a - 1); text = `${a} − ${b}`; ans = a - b; }
    else if (type === 2) { const a = r(2, 9), b = r(2, 9); text = `${a} × ${b}`; ans = a * b; }
    else { const a = r(2, 9), b = r(2, 9), c = r(1, 15); text = `${a} × ${b} + ${c}`; ans = a * b + c; }
    const opts = new Set([ans]);
    while (opts.size < (k < 4 ? 3 : 4)) {
      const d = ans + U.pick([-10, -2, -1, 1, 2, 10, -3, 3, 5, -5]);
      if (d >= 0) opts.add(d);
    }
    const list = U.shuffle([...opts]);
    return { kind: 'math', text: `${text} = ?`, labels: list.map(String), correct: list.indexOf(ans) };
  }

  function colorQ(k) {
    const n = k < 4 ? 3 : 4;
    const pool = U.shuffle(COLORS.slice());
    const bg = pool[0], word = pool[1];
    const opts = U.shuffle(pool.slice(0, n));
    return { kind: 'color', bg: bg.c, word: word.name, wordColor: k > 5 ? U.pick(COLORS.filter((c) => c !== bg)).c : '#fff',
      labels: opts.map((o) => o.name), correct: opts.indexOf(bg) };
  }

  class Doors {
    constructor(api, mode) {
      this.api = api; this.P = api.players; this.n = this.P.length; this.mode = mode;
      this.k = 0; this.finished = false; this.qn = api.count(QUESTIONS);
      this.ps = this.P.map((p, i) => ({ x: W / 2 + (i - (this.n - 1) / 2) * 70, vx: 0, face: -Math.PI / 2, walk: 0,
        hearts: 5, points: 0, right: 0, out: false, result: 0, squash: 0, door: -1, arrive: 0, dashT: 0, dashCd: 0, dashDir: 1, fast: 0 }));
      this.bot = this.P.map(() => ({ target: null, delay: 0 }));
      this.next();
    }

    doorX(d) { const m = this.q.labels.length; return W / 2 + (d - (m - 1) / 2) * (DOOR_W + 40); }

    next() {
      this.k++;
      this.q = this.mode === 'math' ? mathQ(this.k) : colorQ(this.k);
      this.phase = 'ask'; this.qMax = this.qT = Math.max(3, 5.5 - this.k * 0.2);
      this.lastTick = 99;
      this.bot.forEach((b, j) => {
        const lv = this.api.botOf(j), pc = 0.93 - lv.actDrop * 0.75;
        const m = this.q.labels.length;
        b.target = Math.random() < pc ? this.q.correct : U.randi(0, m - 1);
        b.delay = U.rand(0.4, 1.3) + lv.react * 2;
      });
      this.ps.forEach((p) => { p.result = 0; p.door = -1; p.arrive = 0; });
      // MTH4 (Đố Toán): nửa sau trận cửa đúng chỉ có 2 chỗ, câu cuối chỉ 1 chỗ
      this.cap = this.mode === 'math' && this.k > this.qn / 2 ? (this.k === this.qn ? 1 : 2) : 0;
    }

    doorUnder(p) {
      for (let d = 0; d < this.q.labels.length; d++) if (Math.abs(p.x - this.doorX(d)) < DOOR_W / 2 - 6) return d;
      return -1;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      this.ps.forEach((p, i) => {
        p.squash *= Math.pow(0.01, dt);
        if (p.out) return;
        const q = inp[i];
        const can = this.phase === 'ask';
        p.dashT -= dt; p.dashCd -= dt;
        // MTH3 (Đố Toán): nút Đánh = húc ngang, đẩy người khác ra khỏi cửa
        if (this.mode === 'math' && can && q.actP && p.dashCd <= 0) {
          let dir = Math.sign(q.mx);
          if (!dir) {
            let best = null, bd = Infinity;
            this.ps.forEach((o, j) => { if (j !== i && !o.out && Math.abs(o.x - p.x) < bd) { bd = Math.abs(o.x - p.x); best = o; } });
            dir = best ? Math.sign(best.x - p.x) || 1 : 1;
          }
          p.dashT = 0.22; p.dashCd = 1.2; p.dashDir = dir; p.squash = -0.2; Sfx.play('dash');
        }
        const tv = can ? (p.dashT > 0 ? p.dashDir * 900 : q.mx * 380) : 0;
        p.vx += (tv - p.vx) * Math.min(1, dt * (p.dashT > 0 ? 30 : 12));
        p.x = U.clamp(p.x + p.vx * dt, 60, W - 60);
        // ghi lúc vào cửa (để tính ai tới trước)
        const d = can ? this.doorUnder(p) : p.door;
        if (d !== p.door) { p.door = d; p.arrive = this.qMax - this.qT; }
        if (Math.abs(p.vx) > 20) { p.face = p.vx > 0 ? 0 : Math.PI; p.walk += dt * 14; } else p.face = -Math.PI / 2;
      });
      // va chạm khi húc
      if (this.mode === 'math' && this.phase === 'ask') {
        this.ps.forEach((a, i) => {
          if (a.out || a.dashT <= 0) return;
          this.ps.forEach((b, j) => {
            if (j === i || b.out || Math.abs(b.x - a.x) > 50 || Math.sign(b.x - a.x || a.dashDir) !== a.dashDir) return;
            b.vx = a.dashDir * 1100; b.x += a.dashDir * 20; b.squash = 0.3; a.dashT = 0; a.vx *= 0.2;
            Sfx.play('hit'); FX.shake(4);
            parts.burst((a.x + b.x) / 2, FLOOR - 20, ['#fff', '#ffe680'], 8, 200, 0.35, 5, { shape: 's' });
          });
        });
      }
      if (this.finished) return;
      if (this.phase === 'ask') {
        this.qT -= dt;
        const s = Math.ceil(this.qT);
        if (s <= 3 && s > 0 && s !== this.lastTick) { this.lastTick = s; Sfx.play('tick'); }
        if (this.qT <= 0) {
          this.phase = 'reveal'; this.revealT = 1.6;
          let anyRight = false;
          // người đứng cửa đúng, xếp theo ai vào cửa trước
          const right = this.ps.map((p, i) => i).filter((i) => !this.ps[i].out && this.doorUnder(this.ps[i]) === this.q.correct)
            .sort((a, b) => this.ps[a].arrive - this.ps[b].arrive);
          const seated = this.cap ? right.slice(0, this.cap) : right;
          this.ps.forEach((p, i) => {
            if (p.out) return;
            const d = this.doorUnder(p);
            if (d === this.q.correct && !seated.includes(i)) {
              p.result = -1; p.squash = 0.3;
              parts.text(p.x, FLOOR - 60, 'Hết chỗ!', '#ffb36b', 26);
            } else if (d === this.q.correct) {
              // MTH3: vào cửa đúng sớm nhất được +1 (Đố Toán)
              const first = this.mode === 'math' && seated[0] === i;
              p.points += first ? 2 : 1; p.right++; p.result = 1; anyRight = true; p.squash = -0.25;
              parts.text(p.x, FLOOR - 60, first ? '+1 · nhanh nhất +1' : '+1', '#5dff9b', first ? 24 : 30);
            } else {
              p.hearts--; p.result = -1; p.squash = 0.3;
              parts.text(p.x, FLOOR - 60, d < 0 ? 'Chưa vào cửa! −1 ♥' : 'Sai! −1 ♥', '#ff7a7a', 26);
              if (p.hearts <= 0) { p.out = true; parts.burst(p.x, FLOOR, this.P[i].color.main, 16, 220, 0.6, 6); }
            }
          });
          Sfx.play(anyRight ? 'pickup' : 'hurt');
        }
      } else {
        this.revealT -= dt;
        if (this.revealT <= 0) {
          if (this.k >= this.qn || this.ps.every((p) => p.out)) this.finished = true;
          else this.next();
        }
      }
    }

    draw(ctx) {
      const t = U.now();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2d2160'); g.addColorStop(1, '#4a2f7a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#6a4aa3'; ctx.fillRect(0, FLOOR + 22, W, H - FLOOR);
      ctx.fillStyle = '#7d5bb8';
      for (let x = 0; x < W; x += 80) ctx.fillRect(x, FLOOR + 22, 40, H - FLOOR);
      // câu hỏi
      const qy = 128;
      if (this.q.kind === 'math') {
        Draw.rr(ctx, W / 2 - 300, qy - 48, 600, 96, 26); ctx.fillStyle = '#fff'; ctx.fill();
        Draw.text(ctx, this.q.text, W / 2, qy + 2, { size: 62, color: '#2a1840', stroke: null });
      } else {
        Draw.rr(ctx, W / 2 - 300, qy - 48, 600, 96, 26); ctx.fillStyle = this.q.bg; ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
        Draw.text(ctx, this.q.word, W / 2, qy + 3, { size: 60, color: this.q.wordColor, sw: 10 });
        Draw.text(ctx, 'Chọn MÀU NỀN, đừng tin chữ!', W / 2, qy + 66, { size: 20, color: '#ffe14d', sw: 4 });
      }
      // thanh thời gian
      if (this.phase === 'ask') {
        const w = 600 * Math.max(0, this.qT / this.qMax);
        Draw.rr(ctx, W / 2 - 300, qy + 52 + (this.q.kind === 'color' ? 30 : 0), 600, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
        Draw.rr(ctx, W / 2 - 300, qy + 52 + (this.q.kind === 'color' ? 30 : 0), w, 10, 5); ctx.fillStyle = this.qT < 1.5 ? '#ff3b52' : '#ffe14d'; ctx.fill();
      }
      // cửa
      for (let d = 0; d < this.q.labels.length; d++) {
        const x = this.doorX(d) - DOOR_W / 2, y = DOOR_Y + (FLOOR + 22 - DOOR_Y - DOOR_H) ;
        let frame = '#8a5a2b', fill = '#f2e6d0';
        if (this.phase === 'reveal') { fill = d === this.q.correct ? '#5dff9b' : '#ff7a8a'; }
        ctx.fillStyle = frame; Draw.rr(ctx, x - 10, y - 10, DOOR_W + 20, DOOR_H + 10, 16); ctx.fill();
        ctx.fillStyle = fill; Draw.rr(ctx, x, y, DOOR_W, DOOR_H, 10); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x + 14, y + 14, DOOR_W - 28, DOOR_H - 28);
        const lbl = this.q.labels[d];
        Draw.text(ctx, lbl, x + DOOR_W / 2, y + 60, { size: lbl.length > 6 ? 26 : 50, color: '#2a1840', stroke: null });
        ctx.fillStyle = '#c99a2e'; ctx.beginPath(); ctx.arc(x + DOOR_W - 26, y + DOOR_H / 2 + 20, 7, 0, TAU); ctx.fill();
      }
      if (this.cap && this.phase === 'ask') {
        Draw.text(ctx, this.cap === 1 ? 'Cửa đúng chỉ còn 1 chỗ! (Đánh = húc)' : 'Cửa đúng chỉ có 2 chỗ! (Đánh = húc)', W / 2, DOOR_Y - 14 + (FLOOR + 22 - DOOR_Y - DOOR_H) - 20, { size: 22, color: '#ffb36b', sw: 4 });
      }
      // người chơi
      this.ps.forEach((p, i) => {
        if (p.out) { Draw.blob(ctx, { x: p.x, y: FLOOR, r: 26, color: this.P[i].color, dead: true, alpha: 0.35 }); return; }
        const hop = p.result === 1 && this.phase === 'reveal' ? Math.abs(Math.sin(t * 10)) * 20 : 0;
        Draw.blob(ctx, { x: p.x, y: FLOOR, z: hop, r: 26, color: this.P[i].color, face: p.face, walk: p.walk, squash: p.squash, stun: p.result === -1 && this.phase === 'reveal' });
        Draw.text(ctx, this.P[i].name, p.x, FLOOR + 50, { size: 18, color: this.P[i].color.light, sw: 4 });
      });
      Draw.label(ctx, `Câu ${this.k}/${this.qn}`, 80, 38);
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.out ? `Loại · ${p.points}đ` : `${p.points}đ · ♥${p.hearts}`)), { dim: this.ps.map((p) => p.out) });
    }

    results() {
      return this.ps.map((p) => ({ score: p.points * 10 + p.hearts, text: `${p.points} điểm · đúng ${p.right} câu · còn ${p.hearts} ♥` }));
    }

    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) { return { x: this.ps[i].x, y: FLOOR }; }

    botInput(i) {
      const p = this.ps[i], st = this.bot[i];
      const o = { mx: 0, my: 0 };
      if (p.out || this.phase !== 'ask') return o;
      if (this.qMax - this.qT < st.delay) return o;
      const tx = this.doorX(st.target), dx = tx - p.x;
      if (Math.abs(dx) > 12) o.mx = Math.sign(dx);
      // Đố Toán: có người chiếm cửa mình muốn vào → húc họ ra (khi cửa giới hạn chỗ thì húc hăng hơn)
      if (this.mode === 'math' && p.dashCd <= 0) {
        const foe = this.ps.find((q, j) => j !== i && !q.out && Math.abs(q.x - p.x) < 60 && Math.abs(q.x - tx) < DOOR_W / 2);
        if (foe && Math.random() < (this.cap ? 0.06 : 0.015) * (1 - this.api.botOf(i).actDrop)) { o.mx = Math.sign(foe.x - p.x) || 1; o.actP = true; }
      }
      return o;
    }
  }

  Party.register({
    id: 'math', name: 'Đố Toán', emoji: '🧮',
    tagline: 'Chạy tới cửa có đáp án đúng · sai cửa mất 1 tim',
    how: 'Tính nhanh rồi chạy tới đứng dưới cửa có đáp án đúng trước khi hết giờ. Đúng +1 điểm, ai vào cửa đúng sớm nhất +1 nữa. Sai hoặc chưa vào cửa mất 1 tim (mỗi người 5 tim). Nút Đánh để húc người khác ra khỏi cửa. Nửa sau trận cửa đúng chỉ có 2 chỗ (câu cuối 1 chỗ) — ai vào trước giữ chỗ, đến sau phải húc người ta ra!',
    controls: { move: 'Chạy trái / phải', act: 'Húc' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Doors(api, 'math'),
  });
  Party.register({
    id: 'color', name: 'Đoán Màu', emoji: '🌈',
    tagline: 'Chạy tới cửa đúng MÀU NỀN, đừng tin chữ · sai mất 1 tim',
    how: 'Bảng có màu nền và một chữ ghi tên màu khác để lừa bạn. Chạy tới cửa ghi đúng tên MÀU NỀN! Sai hoặc chưa vào cửa mất 1 tim.',
    controls: { move: 'Chạy trái / phải' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Doors(api, 'color'),
  });
})();

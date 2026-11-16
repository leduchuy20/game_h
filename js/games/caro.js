(() => {
  'use strict';
  /* =========================================================
     Caro — X/O trên giấy tập kẻ ô (bàn rộng 50×50, màn hình tự cuộn theo con trỏ / nước vừa đi).
     2–4 người: chia 2 đội (P1,P3 | P2,P4), mỗi đội thay phiên người đánh. Thắng `api.wins` ván trước.
     Luật + máy ở caro_engine.js (CaroEngine); máy nghĩ trong Web Worker qua BoardKit.ai.
     ========================================================= */
  const CE = window.CaroEngine;
  const N = 50;                                   // bàn N×N ô
  const TOP = 80;                                 // dải thông tin trên cùng
  const CELL = 40, CELL_MIN = 26;                 // cỡ ô (thu nhỏ khi thế cờ lan rộng)
  const MARGIN = 2.5;                             // giữ con trỏ / nước mới cách mép màn hình ≥ chừng này ô
  const DRAW_T = 0.22;                            // thời gian "vẽ" một quân
  const OVER_T = 2.8;                             // dừng xem dãy thắng trước ván sau
  const MAX_MOVES = 600;
  const PEN = { x: '#d6342e', o: '#1f5fbf' };
  const STONE = { x: '#22201f', o: '#f7f4ec' };
  const TIMERS = { none: 0, m30: 30, m15: 15 };
  const AI_HANDLER = function (E, d) {
    const b = new E.Board(d.n, d.rule);
    for (const m of d.moves) b.play(m[0], m[1]);
    return { move: E.think(b, d.col, d.level) };
  };
  const brain = () => BoardKit.ai('caro', CaroEngineFactory, AI_HANDLER, CE);

  // giả ngẫu nhiên theo số (nét bút mỗi quân run tay khác nhau nhưng không nhảy mỗi khung)
  const hash = (k) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  class Caro {
    constructor(api) {
      this.api = api;
      this.players = api.players;
      this.n = this.players.length;
      this.need = api.wins;
      this.teams = [[], []];
      this.players.forEach((_, i) => this.teams[i % 2].push(i));
      this.turnIdx = [0, 0];                       // người kế tiếp của mỗi đội
      this.wins = [0, 0];
      this.games = 0;
      this.first = 0;                              // đội cầm X (đi trước) ván này — đổi sau mỗi ván
      this.cursor = this.players.map(() => ({ r: N >> 1, c: N >> 1 }));
      this.rep = this.players.map(() => new BoardKit.KeyRepeat());
      this.cam = { c: N / 2, r: N / 2, cs: CELL };
      this.t = 0;
      this.finished = false;
      this.hover = null; this.drag = null; this.manualT = 0;
      if (this.n > 2) {
        this.teamOf = (i) => i % 2;
        this.teamNames = ['Đội 1', 'Đội 2'];
        this.teamColors = [this.players[0].color.main, this.players[1].color.main];
      }
      this.ownEndBanner = true;
      this.newGame();
    }
    get rule() { const r = this.api.opts && this.api.opts.rule; return r === 'free' || r === 'exact' ? r : 'block2'; }
    get paper() { const p = this.api.opts && this.api.opts.paper; return p === 'wood' ? 'wood' : 'note'; }
    get hints() { return !!(this.api.opts && this.api.opts.hint === 'on'); }
    get perMove() { return TIMERS[this.api.variant] || 0; }

    newGame() {
      this.b = new CE.Board(N, this.rule);
      this.marks = [];                              // { i, sym:'x'|'o', t, k }
      this.side = this.first;                       // đội đang đi
      this.over = null;
      this.think = null;
      this.moveLeft = this.perMove;
      this.dangerKey = -1; this.danger = null;
      const mid = N >> 1;
      this.cursor.forEach((q) => { q.r = mid; q.c = mid; });
      this.cam.c = mid + 0.5; this.cam.r = mid + 0.5;
      this.banner = { text: `Ván ${this.games + 1}`, sub: `${this.teamLabel(this.first)} cầm ✕ đi trước`, age: 0 };
    }
    symOf(team) { return team === this.first ? 'x' : 'o'; }
    colOf(team) { return team === this.first ? 1 : 2; }
    teamLabel(t) {
      const ms = this.teams[t];
      return ms.length === 1 ? this.players[ms[0]].name : `Đội ${t + 1}`;
    }
    /** người đang tới lượt */
    get active() { const ms = this.teams[this.side]; return ms[this.turnIdx[this.side] % ms.length]; }

    /* ---------- toạ độ ---------- */
    get viewCY() { return TOP + (H - TOP) / 2; }
    cellXY(r, c) {
      const cs = this.cam.cs;
      return { x: W / 2 + (c + 0.5 - this.cam.c) * cs, y: this.viewCY + (r + 0.5 - this.cam.r) * cs };
    }
    xyCell(x, y) {
      const cs = this.cam.cs;
      const c = Math.floor((x - W / 2) / cs + this.cam.c), r = Math.floor((y - this.viewCY) / cs + this.cam.r);
      if (y < TOP || r < 0 || c < 0 || r >= N || c >= N) return null;
      return { r, c };
    }

    /* ---------- vòng lặp ---------- */
    update(dt, inp) {
      this.t += dt;
      if (this.banner) { this.banner.age += dt; if (this.banner.age > 1.8) this.banner = null; }
      for (const m of this.marks) m.t += dt;
      this.manualT = Math.max(0, this.manualT - dt);
      this.updateCam(dt);
      if (this.finished) return;
      if (this.over) {
        this.over.t += dt;
        if (this.over.t >= OVER_T * (this.allBots ? 0.15 : 1)) this.nextGame();
        return;
      }
      const pi = this.active, p = this.players[pi];
      // đồng hồ mỗi nước (chỉ tính người thật)
      if (this.perMove && !p.bot) {
        const before = this.moveLeft;
        this.moveLeft -= dt;
        if (this.moveLeft < 5 && Math.ceil(this.moveLeft) !== Math.ceil(before)) Sfx.play('tick');
        if (this.moveLeft <= 0) { this.endGame(1 - this.side, null, 'time'); return; }
      }
      if (p.bot) { this.updateBot(dt, pi); return; }
      this.humanInput(pi, inp[pi], dt);
    }
    get allBots() { return this.players.every((p) => p.bot); }

    humanInput(i, q, dt) {
      if (!q) return;
      const cur = this.cursor[i];
      const st = this.rep[i].step(q, dt);
      if (st) {
        const r = U.clamp(cur.r + st.dy, 0, N - 1), c = U.clamp(cur.c + st.dx, 0, N - 1);
        if (r !== cur.r || c !== cur.c) { cur.r = r; cur.c = c; this.manualT = 0; Sfx.tone(560, 0.025, 'sine', 0.03); }
      }
      if (q.actP) this.tryPlace(i, cur.r, cur.c);
      else if (q.jumpP) {
        // nhảy con trỏ về nước vừa đi (đỡ phải cuộn tìm)
        const last = this.b.moves[this.b.moves.length - 1];
        if (last !== undefined) { cur.r = (last / N) | 0; cur.c = last % N; this.manualT = 0; Sfx.play('move'); }
      }
    }
    tryPlace(i, r, c) {
      const idx = r * N + c;
      if (this.b.c[idx]) { Sfx.tone(180, 0.08, 'square', 0.06); return false; }
      this.place(idx, i);
      return true;
    }
    place(idx, pi) {
      const team = this.side, col = this.colOf(team);
      this.b.play(idx, col);
      const k = this.b.moves.length;
      this.marks.push({ i: idx, sym: this.symOf(team), t: 0, k, pi });
      this.turnIdx[team]++;
      this.manualT = 0;
      // con trỏ mọi người thật đứng ở nước vừa đi
      const r = (idx / N) | 0, c = idx % N;
      this.players.forEach((p, j) => { if (!p.bot && j !== pi) { this.cursor[j].r = r; this.cursor[j].c = c; } });
      Sfx.play('place');
      Sfx.tone(team === this.first ? 900 : 700, 0.05, 'triangle', 0.035);
      const line = this.b.winLine(idx);
      if (line) { this.endGame(team, line, 'five'); return; }
      if (this.b.moves.length >= MAX_MOVES) { this.endGame(-1, null, 'full'); return; }
      this.side = 1 - team;
      this.moveLeft = this.perMove;
      const np = this.players[this.active];
      if (!np.bot && !this.allBots) Party.rumble(this.active, 0.2, 80);
    }
    endGame(team, line, why) {
      this.think = null; brain().cancel();
      this.games++;
      if (team >= 0) this.wins[team]++;
      this.over = { team, line, why, t: 0 };
      if (team >= 0) {
        Sfx.play('win'); FX.shake(5);
        const q = line ? this.cellXY((line[2] / N) | 0, line[2] % N) : { x: W / 2, y: H / 2 };
        const colr = this.players[this.teams[team][0]].color;
        for (let k = 0; k < 3; k++) this.api.parts.burst(q.x + U.rand(-60, 60), q.y + U.rand(-30, 30), [colr.main, '#ffe14d', '#fff'], 18, 260, 0.8, 5);
        this.teams[1 - team].forEach((j) => Party.rumble(j, 0.6, 250));
      }
    }
    nextGame() {
      const w = this.wins;
      if (w[0] >= this.need || w[1] >= this.need || this.games >= this.need * 2 + 2) { this.finished = true; return; }
      this.first = 1 - this.first;
      this.newGame();
    }

    /* ---------- máy ---------- */
    updateBot(dt, pi) {
      if (!this.think) {
        const lv = this.players[pi].level || 'normal';
        const th = this.think = { t: 0, min: BoardKit.sync || this.allBots ? 0 : (lv === 'hard' ? U.rand(0.45, 0.8) : U.rand(0.6, 1.1)), res: null, ply: this.b.moves.length };
        const moves = this.b.moves.map((m) => [m, this.b.c[m]]);
        brain().ask({ n: N, rule: this.rule, moves, col: this.colOf(this.side), level: lv }, (r) => { th.res = r; });
        return;
      }
      const th = this.think;
      th.t += dt;
      if (th.res && th.t >= th.min) {
        this.think = null;
        if (th.ply !== this.b.moves.length) return;
        let m = th.res.move;
        if (!(m >= 0 && m < N * N) || this.b.c[m]) m = this.b.near(1)[0];
        this.place(m, pi);
      }
    }
    botInput() { return {}; }

    /* ---------- camera: chỉ cuộn khi con trỏ / nước mới sắp ra khỏi màn hình ---------- */
    focus() {
      if (this.over && this.over.line) { const l = this.over.line; return [(l[0] / N) | 0, l[0] % N, (l[l.length - 1] / N) | 0, l[l.length - 1] % N]; }
      const pi = this.active, p = this.players[pi];
      if (!this.finished && !this.over && !p.bot) { const q = this.cursor[pi]; return [q.r, q.c, q.r, q.c]; }
      const last = this.b.moves[this.b.moves.length - 1];
      if (last === undefined) return [N >> 1, N >> 1, N >> 1, N >> 1];
      return [(last / N) | 0, last % N, (last / N) | 0, last % N];
    }
    updateCam(dt) {
      const cam = this.cam;
      // thu nhỏ ô khi các quân lan rộng hơn màn hình
      let r0 = N, r1 = 0, c0 = N, c1 = 0;
      for (const m of this.b.moves) { const r = (m / N) | 0, c = m % N; r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
      let want = CELL;
      if (this.b.moves.length) want = U.clamp(Math.min((W - 60) / (c1 - c0 + 1 + 2 * MARGIN), (H - TOP - 40) / (r1 - r0 + 1 + 2 * MARGIN)), CELL_MIN, CELL);
      cam.cs += (want - cam.cs) * Math.min(1, dt * 3);
      if (this.manualT > 0) return;
      const [fr0, fc0, fr1, fc1] = this.focus();
      const hw = W / 2 / cam.cs - MARGIN, hh = (H - TOP) / 2 / cam.cs - MARGIN;
      let tc = cam.c, tr = cam.r;
      if (fc0 + 0.5 < tc - hw) tc = fc0 + 0.5 + hw;
      if (fc1 + 0.5 > tc + hw) tc = fc1 + 0.5 - hw;
      if (fr0 + 0.5 < tr - hh) tr = fr0 + 0.5 + hh;
      if (fr1 + 0.5 > tr + hh) tr = fr1 + 0.5 - hh;
      // không cuộn quá mép giấy quá xa
      tc = U.clamp(tc, W / 2 / cam.cs - 3, N + 3 - W / 2 / cam.cs);
      tr = U.clamp(tr, (H - TOP) / 2 / cam.cs - 3, N + 3 - (H - TOP) / 2 / cam.cs);
      const k = Math.min(1, dt * 5);
      cam.c += (tc - cam.c) * k; cam.r += (tr - cam.r) * k;
    }

    /* ---------- chuột: bấm ô để đánh, kéo giấy để xem chỗ khác ---------- */
    onPointer(x, y, type) {
      if (type === 'move') {
        if (this.drag) {
          const d = this.drag, dx = x - d.x, dy = y - d.y;
          if (!d.moved && Math.hypot(dx, dy) > 6) d.moved = true;
          if (d.moved) { this.cam.c = d.c - dx / this.cam.cs; this.cam.r = d.r - dy / this.cam.cs; this.manualT = 6; }
          return;
        }
        this.hover = this.xyCell(x, y);
        return;
      }
      if (type === 'down') { this.drag = { x, y, c: this.cam.c, r: this.cam.r, moved: false }; return; }
      if (type === 'up') {
        const d = this.drag;
        this.drag = null;
        if (!d || d.moved || this.finished || this.over) return;
        const pi = this.active;
        if (this.players[pi].bot) return;
        const q = this.xyCell(x, y);
        if (!q) return;
        this.cursor[pi].r = q.r; this.cursor[pi].c = q.c;
        this.tryPlace(pi, q.r, q.c);
      }
    }

    /* ---------- vẽ ---------- */
    draw(ctx) {
      const cam = this.cam, cs = cam.cs, wood = this.paper === 'wood';
      // nền bàn học (ngoài mép giấy)
      ctx.fillStyle = wood ? '#3b2a1c' : '#c99a62'; ctx.fillRect(0, 0, W, H);
      const p0 = this.cellXY(0, 0), x0 = p0.x - cs / 2, y0 = p0.y - cs / 2, PS = N * cs;
      // tờ giấy / bàn gỗ
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.fillStyle = wood ? '#dcb06b' : '#fdfcf6';
      ctx.fillRect(x0 - (wood ? cs * 0.6 : 0), y0 - (wood ? cs * 0.6 : 0), PS + (wood ? cs * 1.2 : 0), PS + (wood ? cs * 1.2 : 0));
      ctx.restore();
      // ô nhìn thấy
      const cA = Math.max(0, Math.floor(cam.c - W / 2 / cs) - 1), cB = Math.min(N - 1, Math.ceil(cam.c + W / 2 / cs) + 1);
      const rA = Math.max(0, Math.floor(cam.r - (H - TOP) / 2 / cs) - 1), rB = Math.min(N - 1, Math.ceil(cam.r + (H - TOP) / 2 / cs) + 1);
      ctx.save();
      if (wood) {
        // giao điểm kiểu cờ vây/gomoku: kẻ qua tâm ô
        ctx.strokeStyle = 'rgba(60,35,10,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = cA; c <= cB; c++) { const x = x0 + (c + 0.5) * cs; ctx.moveTo(x, y0 + (rA + 0.5) * cs); ctx.lineTo(x, y0 + (rB + 0.5) * cs); }
        for (let r = rA; r <= rB; r++) { const y = y0 + (r + 0.5) * cs; ctx.moveTo(x0 + (cA + 0.5) * cs, y); ctx.lineTo(x0 + (cB + 0.5) * cs, y); }
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#c4d9f0'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = cA; c <= cB + 1; c++) { const x = Math.round(x0 + c * cs) + 0.5; ctx.moveTo(x, Math.max(y0, TOP - 2)); ctx.lineTo(x, y0 + PS); }
        for (let r = rA; r <= rB + 1; r++) { const y = Math.round(y0 + r * cs) + 0.5; ctx.moveTo(Math.max(x0, 0), y); ctx.lineTo(Math.min(x0 + PS, W), y); }
        ctx.stroke();
        // lề đỏ + lỗ đóng gáy ở mép trái tờ giấy
        if (x0 + 2 * cs > -20) {
          ctx.strokeStyle = 'rgba(220,70,70,0.7)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x0 + 1.5 * cs, y0); ctx.lineTo(x0 + 1.5 * cs, y0 + PS); ctx.stroke();
          for (let r = 1; r < N; r += 3) { const y = y0 + r * cs; if (y < TOP - 20 || y > H + 20) continue; ctx.beginPath(); ctx.arc(x0 + 0.55 * cs, y, cs * 0.16, 0, TAU); ctx.fillStyle = '#c99a62'; ctx.fill(); }
        }
      }
      ctx.restore();
      // gợi ý nước nguy hiểm (người mới)
      if (this.hints && !this.over && !this.finished && !this.players[this.active].bot) this.drawHints(ctx);
      // nước vừa đi: dạ quang vàng
      const last = this.marks[this.marks.length - 1];
      if (last && !this.over) {
        const q = this.cellXY((last.i / N) | 0, last.i % N);
        ctx.fillStyle = `rgba(255,226,60,${0.35 + 0.15 * Math.sin(this.t * 5)})`;
        ctx.fillRect(q.x - cs / 2 + 2, q.y - cs / 2 + 2, cs - 4, cs - 4);
      }
      // dãy thắng: bút dạ quang
      if (this.over && this.over.line) this.drawWinLine(ctx, true);
      for (const m of this.marks) {
        const q = this.cellXY((m.i / N) | 0, m.i % N);
        if (q.x < -cs || q.x > W + cs || q.y < TOP - cs || q.y > H + cs) continue;
        this.drawMark(ctx, q.x, q.y, cs, m.sym, Math.min(1, m.t / DRAW_T), m.k, wood);
      }
      if (this.over && this.over.line) this.drawWinLine(ctx, false);
      this.drawCursors(ctx);
      this.drawHud(ctx);
      if (this.over) this.drawOver(ctx);
      if (this.banner && !this.over) this.drawBanner(ctx);
      try {
        const cv = document.getElementById('cv');
        if (cv) cv.style.cursor = this.drag && this.drag.moved ? 'grabbing' : (this.hover && !this.players[this.active].bot ? 'pointer' : '');
      } catch (e) { /* bỏ qua */ }
    }
    drawMark(ctx, x, y, cs, sym, k, seed, wood) {
      if (wood) {
        // quân đá đen / trắng
        const r = cs * 0.42 * (0.6 + 0.4 * Math.min(1, k * 1.6));
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
        if (sym === 'x') { g.addColorStop(0, '#6b6763'); g.addColorStop(1, STONE.x); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d6d0c2'); }
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.restore();
        return;
      }
      const s = cs * 0.3, j = (n) => (hash(seed * 7 + n) - 0.5) * cs * 0.08;
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2.2, cs * 0.085);
      ctx.strokeStyle = sym === 'x' ? PEN.x : PEN.o;
      if (sym === 'x') {
        const k1 = Math.min(1, k * 2), k2 = Math.max(0, k * 2 - 1);
        const a = [x - s + j(1), y - s + j(2)], b = [x + s + j(3), y + s + j(4)];
        const c = [x + s + j(5), y - s + j(6)], d = [x - s + j(7), y + s + j(8)];
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(U.lerp(a[0], b[0], k1), U.lerp(a[1], b[1], k1)); ctx.stroke();
        if (k2 > 0) { ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(U.lerp(c[0], d[0], k2), U.lerp(c[1], d[1], k2)); ctx.stroke(); }
      } else {
        const a0 = hash(seed) * TAU, rx = s * (1.02 + j(9) / cs * 3), ry = s * (0.95 + j(10) / cs * 3);
        ctx.beginPath();
        ctx.ellipse(x + j(11), y + j(12), rx, ry, hash(seed + 3) * 0.6, a0, a0 + TAU * 1.06 * k);
        ctx.stroke();
      }
      ctx.restore();
    }
    drawWinLine(ctx, under) {
      const l = this.over.line, cs = this.cam.cs;
      const a = this.cellXY((l[0] / N) | 0, l[0] % N), b = this.cellXY((l[l.length - 1] / N) | 0, l[l.length - 1] % N);
      const k = Math.min(1, this.over.t / 0.6);
      const bx = U.lerp(a.x, b.x, k), by = U.lerp(a.y, b.y, k);
      ctx.save(); ctx.lineCap = 'round';
      if (under) { ctx.strokeStyle = 'rgba(255,225,40,0.55)'; ctx.lineWidth = cs * 0.8; }
      else { ctx.strokeStyle = 'rgba(30,30,40,0.75)'; ctx.lineWidth = Math.max(2, cs * 0.07); }
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();
    }
    drawHints(ctx) {
      const key = this.b.moves.length;
      if (this.dangerKey !== key) { this.dangerKey = key; this.danger = CE.dangers(this.b, this.colOf(1 - this.side)); }
      const cs = this.cam.cs, d = this.danger;
      for (const i of d.win) {
        const q = this.cellXY((i / N) | 0, i % N);
        ctx.strokeStyle = `rgba(230,40,40,${0.6 + 0.4 * Math.sin(this.t * 8)})`; ctx.lineWidth = 3;
        ctx.strokeRect(q.x - cs / 2 + 3, q.y - cs / 2 + 3, cs - 6, cs - 6);
        Draw.text(ctx, '!', q.x, q.y + 1, { size: cs * 0.5, color: '#e02828', stroke: null });
      }
      for (const i of d.open) {
        const q = this.cellXY((i / N) | 0, i % N);
        ctx.fillStyle = 'rgba(255,140,0,0.75)';
        ctx.beginPath(); ctx.arc(q.x, q.y, cs * 0.12, 0, TAU); ctx.fill();
      }
    }
    drawCursors(ctx) {
      if (this.finished || this.over) return;
      const cs = this.cam.cs, pi = this.active, p = this.players[pi];
      if (p.bot) {
        // máy đang nghĩ: cây bút gõ gõ cạnh nước vừa đi
        const last = this.b.moves[this.b.moves.length - 1];
        const q = last !== undefined ? this.cellXY((last / N) | 0, last % N) : this.cellXY(N >> 1, N >> 1);
        Draw.text(ctx, '✏️', q.x + cs * 0.7, q.y - cs * 0.6 - Math.abs(Math.sin(this.t * 9)) * 6, { size: cs * 0.6, stroke: null });
        return;
      }
      const sym = this.symOf(this.side);
      const show = (q, alpha) => {
        const s = this.cellXY(q.r, q.c);
        ctx.save();
        ctx.strokeStyle = p.color.main; ctx.lineWidth = 3;
        ctx.globalAlpha = alpha;
        Draw.rr(ctx, s.x - cs / 2 + 1, s.y - cs / 2 + 1, cs - 2, cs - 2, 6); ctx.stroke();
        if (!this.b.c[q.r * N + q.c]) { ctx.globalAlpha = alpha * 0.35; this.drawMark(ctx, s.x, s.y, cs, sym, 1, 999, this.paper === 'wood'); }
        ctx.restore();
      };
      show(this.cursor[pi], 0.75 + 0.25 * Math.sin(this.t * 6));
      if (this.hover && (this.hover.r !== this.cursor[pi].r || this.hover.c !== this.cursor[pi].c)) show(this.hover, 0.5);
      // tên người đang đánh trên con trỏ
      const s = this.cellXY(this.cursor[pi].r, this.cursor[pi].c);
      if (this.humanCount > 1) Draw.text(ctx, p.name, s.x, s.y - cs * 0.75, { size: 13, color: p.color.main, stroke: '#fff', sw: 4 });
    }
    get humanCount() { return this.players.filter((p) => !p.bot).length; }

    drawHud(ctx) {
      // dải trên: hai đội hai bên, giữa là tỉ số
      ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(0, 0, W, TOP - 6);
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, TOP - 6, W, 3);
      for (let t = 0; t < 2; t++) this.drawTeam(ctx, t);
      const cx = W / 2;
      Draw.text(ctx, `${this.wins[0]}  –  ${this.wins[1]}`, cx, 30, { size: 30, color: '#2a2440', stroke: null });
      const rn = { block2: 'chặn hai đầu', free: 'tự do', exact: 'đúng 5' }[this.rule];
      Draw.text(ctx, `Ván ${this.over || this.finished ? this.games : this.games + 1} · thắng ${this.need} ván · luật ${rn}`, cx, 58, { size: 13, color: '#5a5670', stroke: null, weight: 600 });
    }
    drawTeam(ctx, t) {
      const left = t === 0, w = 430, x = left ? 12 : W - 12 - w, y = 8, h = TOP - 22;
      const active = !this.over && !this.finished && this.side === t;
      const ms = this.teams[t], sym = this.symOf(t);
      ctx.save();
      if (active) { ctx.shadowColor = this.players[this.active].color.main; ctx.shadowBlur = 14; }
      Draw.rr(ctx, x, y, w, h, 14); ctx.fillStyle = active ? '#fffbe6' : '#ffffff'; ctx.fill();
      ctx.restore();
      ctx.lineWidth = active ? 3 : 1.5; ctx.strokeStyle = active ? this.players[this.active].color.main : 'rgba(0,0,0,0.12)';
      Draw.rr(ctx, x, y, w, h, 14); ctx.stroke();
      // ký hiệu
      const sx = left ? x + 34 : x + w - 34, sy = y + h / 2;
      this.drawMark(ctx, sx, sy, 46, sym, 1, t + 5, this.paper === 'wood');
      // người trong đội
      const ax = left ? x + 70 : x + w - 70;
      ms.forEach((pi, k) => {
        const p = this.players[pi], on = active && this.active === pi;
        const bx = left ? ax + 20 + k * 150 : ax - 20 - k * 150;
        Draw.blob(ctx, { x: bx, y: sy + 2, r: on ? 15 : 12, color: p.color, face: Math.PI / 2, shadow: false });
        ctx.save(); ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'middle';
        ctx.font = `${on ? 800 : 700} 15px ${FONT}`; ctx.fillStyle = p.color.dark;
        const nm = p.name + (p.bot ? ' 🤖' : '');
        ctx.fillText(nm, left ? bx + 20 : bx - 20, sy - 7);
        ctx.font = `600 11.5px ${FONT}`; ctx.fillStyle = '#6a6680';
        ctx.fillText(on ? (p.bot ? 'đang nghĩ…' : 'đến lượt!') : (p.bot ? (BOT_LEVELS[p.level || 'normal'] || BOT_LEVELS.normal).name : ''), left ? bx + 20 : bx - 20, sy + 10);
        ctx.restore();
      });
      // đồng hồ mỗi nước
      if (active && this.perMove && !this.players[this.active].bot) {
        const k = U.clamp(this.moveLeft / this.perMove, 0, 1), bw = w - 24;
        ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x + 12, y + h - 7, bw, 4);
        ctx.fillStyle = k < 0.3 ? '#e74c3c' : '#2ecc71'; ctx.fillRect(left ? x + 12 : x + 12 + bw * (1 - k), y + h - 7, bw * k, 4);
      }
    }
    drawBanner(ctx) {
      const b = this.banner, k = Math.min(1, b.age / 0.25), a = b.age > 1.4 ? Math.max(0, 1 - (b.age - 1.4) / 0.4) : 1;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(W / 2, TOP + 70); ctx.scale(0.6 + 0.4 * U.outBack(k), 0.6 + 0.4 * U.outBack(k));
      Draw.rr(ctx, -210, -38, 420, 76, 20); ctx.fillStyle = 'rgba(42,36,64,0.88)'; ctx.fill();
      Draw.text(ctx, b.text, 0, -10, { size: 30, color: '#ffe14d', stroke: null });
      Draw.text(ctx, b.sub, 0, 20, { size: 15, color: '#fff', stroke: null, weight: 600 });
      ctx.restore();
    }
    drawOver(ctx) {
      const o = this.over, k = Math.min(1, o.t / 0.4);
      const msg = o.team < 0 ? 'Hòa ván!' : `${this.teamLabel(o.team)} thắng ván!`;
      const sub = o.why === 'time' ? 'đối thủ hết giờ' : o.team < 0 ? 'kín giấy rồi' : (this.wins[o.team] >= this.need ? '🏆 thắng chung cuộc!' : `tỉ số ${this.wins[0]} – ${this.wins[1]}`);
      ctx.save();
      ctx.translate(W / 2, H - 90); ctx.scale(0.5 + 0.5 * U.outBack(k), 0.5 + 0.5 * U.outBack(k));
      Draw.rr(ctx, -260, -44, 520, 88, 22); ctx.fillStyle = 'rgba(42,36,64,0.9)'; ctx.fill();
      const col = o.team >= 0 ? this.players[this.teams[o.team][0]].color.main : '#9fd8ff';
      Draw.text(ctx, msg, 0, -12, { size: 34, color: col, stroke: '#fff', sw: 3 });
      Draw.text(ctx, sub, 0, 24, { size: 16, color: '#fff', stroke: null, weight: 600 });
      ctx.restore();
    }

    posOf(i) {
      const q = this.cursor[i];
      if (!this.players[i].bot) { const s = this.cellXY(q.r, q.c); return { x: U.clamp(s.x, 0, W), y: U.clamp(s.y, TOP, H) }; }
      const t = i % 2, x = t === 0 ? 120 : W - 120;
      return { x, y: 40 };
    }
    results() {
      return this.players.map((_, i) => {
        const t = i % 2, w = this.wins[t], l = this.wins[1 - t];
        return { score: w, text: `${w > l ? '🏆 ' : ''}Thắng ${w} ván · thua ${l}` };
      });
    }
  }

  Party.register({
    id: 'caro', name: 'Cờ Caro', emoji: '❌', cat: 'board',
    tagline: 'X – O trên giấy tập kẻ ô: xếp 5 quân thẳng hàng trước là thắng. 2 người hoặc 2 đội, đấu máy 3 mức.',
    how: 'Thay phiên đánh ✕ và ⭕ vào ô trống. Ai xếp được 5 quân liên tiếp (ngang, dọc, chéo) trước là thắng ván. Luật chặn hai đầu: dãy 5 bị quân đối thủ chặn CẢ HAI đầu thì không tính. Giấy rộng tự cuộn theo con trỏ; kéo chuột để xem chỗ khác. 3–4 người thì chia 2 đội (P1, P3 | P2, P4), mỗi đội thay phiên người đánh. Ván sau đổi bên đi trước.',
    controls: { move: 'Di con trỏ', act: 'Đánh quân', jump: 'Về nước vừa đi' },
    helpExtra: '🖱️ chuột: bấm ô để đánh, kéo giấy để xem',
    minPlayers: 2, maxPlayers: 4, rawBot: true,
    variants: { label: 'Thời gian', items: [
      { id: 'none', name: 'Thong thả', icon: '☕', desc: 'Không tính giờ.' },
      { id: 'm30', name: '30 giây/nước', icon: '⏱️', desc: 'Mỗi nước tối đa 30 giây, hết giờ là thua ván.' },
      { id: 'm15', name: '15 giây/nước', icon: '⚡', desc: 'Caro chớp: mỗi nước 15 giây, hết giờ là thua ván.' }] },
    options: [
      { id: 'rule', label: 'Luật', items: [
        { id: 'block2', name: 'Chặn hai đầu', icon: '🚧', desc: 'Kiểu Việt Nam: dãy 5 bị chặn cả hai đầu thì không thắng' },
        { id: 'free', name: 'Tự do', icon: '🆓', desc: 'Cứ 5 quân trở lên liên tiếp là thắng' },
        { id: 'exact', name: 'Đúng 5', icon: '5️⃣', desc: 'Phải đúng 5 quân — dãy 6 không tính' }] },
      { id: 'paper', label: 'Bàn', items: [
        { id: 'note', name: 'Giấy tập', icon: '📓', desc: 'Giấy ô ly, ✕ đỏ ⭕ xanh nét bút bi' },
        { id: 'wood', name: 'Bàn gỗ', icon: '🪵', desc: 'Bàn gỗ, quân đá đen trắng' }] },
      { id: 'hint', label: 'Gợi ý', items: [
        { id: 'off', name: 'Tắt', icon: '🙈', desc: 'Tự nhìn thế cờ' },
        { id: 'on', name: 'Cảnh báo', icon: '⚠️', desc: 'Đánh dấu ô đối thủ sắp thắng (!) và ô tạo bốn mở (chấm cam) — cho người mới' }] },
    ],
    create: (api) => new Caro(api),
  });
})();

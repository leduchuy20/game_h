(() => {
  'use strict';
  /* =========================================================
     Cờ Vua — 2 người (người–người hoặc người–máy), bàn phím / tay cầm / chuột.
     Luật + AI ở chess_engine.js (ChessEngine), phần dùng chung ở board_base.js (BoardKit).
     Máy đi BÊN TRONG game (botInput trả {}), mức của từng máy đọc từ players[i].level.
     ========================================================= */
  const CE = window.ChessEngine;
  const SQ = 76, BS = SQ * 8, BX = 132, BY = 56;          // bàn cờ
  const PX = 784, PW = 456;                                // cột thông tin bên phải
  const CARD_H = 118, LIST_Y = 186, LIST_H = 348;
  const ANIM_T = 0.18, MAX_PLY = 400;
  const SIDE_NAME = ['Trắng', 'Đen'], SIDE_ICON = ['♔', '♚'];
  const FIG = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };
  const PIECE_CH = ' PNBRQK';
  const VAL = [0, 1, 3, 3, 5, 9, 0];
  const WHY = {
    mate: 'chiếu hết', stalemate: 'hết nước đi — hòa pat', fifty: 'luật 50 nước — hòa', repetition: 'lặp lại thế cờ 3 lần — hòa',
    material: 'không đủ quân chiếu hết — hòa', time: 'hết giờ', timedraw: 'hết giờ nhưng đối thủ không đủ quân chiếu hết — hòa',
    long: 'ván quá dài — hòa',
  };
  const SETS = ['cburnett', 'merida', 'maestro'];
  const pieceSrc = (set, p) => `assets/chess/${set}/${p & 8 ? 'b' : 'w'}${PIECE_CH[p & 7]}.svg`;
  BoardKit.preload(SETS.flatMap((s) => [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14].map((p) => pieceSrc(s, p))));

  // máy nghĩ trong worker: handler là hàm thuần (được nhúng vào worker bằng toString)
  const AI_HANDLER = function (E, d) {
    const p = new E.Pos(d.fen);
    for (const m of d.moves) p.make(m);
    const r = E.think(p, d.opt);
    return { move: r.move, score: r.score, depth: r.depth };
  };
  const brain = () => BoardKit.ai('chess', ChessEngineFactory, AI_HANDLER, CE);

  /* ---------- Bàn cờ: vẽ sẵn nền theo kiểu ---------- */
  const THEMES = {
    wood: { light: '#ecca96', dark: '#b07848', frame: '#5b351a', grain: true },
    marble: { light: '#efece6', dark: '#9aa7b4', frame: '#4b5563', veins: true },
    green: { light: '#eeeed2', dark: '#769656', frame: '#3d5130' },
  };
  const BOARD_CACHE = {};
  function boardCanvas(id) {
    if (BOARD_CACHE[id]) return BOARD_CACHE[id];
    const th = THEMES[id] || THEMES.wood, c = document.createElement('canvas');
    c.width = c.height = BS;
    const g = c.getContext('2d');
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      g.fillStyle = (r + f) % 2 ? th.dark : th.light;
      g.fillRect(f * SQ, r * SQ, SQ, SQ);
    }
    if (th.grain) {
      // vân gỗ: các đường lượn mảnh theo chiều ngang của từng ô
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
        g.save(); g.beginPath(); g.rect(f * SQ, r * SQ, SQ, SQ); g.clip();
        const vert = (r + f) % 2 === 0;
        for (let k = 0; k < 9; k++) {
          g.strokeStyle = `rgba(${(r + f) % 2 ? '60,30,10' : '120,70,30'},${0.05 + rnd() * 0.07})`;
          g.lineWidth = 1 + rnd() * 2;
          g.beginPath();
          const o = rnd() * SQ, a = 2 + rnd() * 4, ph = rnd() * 6;
          for (let s = 0; s <= SQ; s += 4) {
            const x = vert ? f * SQ + o + Math.sin(s / 13 + ph) * a : f * SQ + s, y = vert ? r * SQ + s : r * SQ + o + Math.sin(s / 13 + ph) * a;
            if (s) g.lineTo(x, y); else g.moveTo(x, y);
          }
          g.stroke();
        }
        g.restore();
      }
    }
    if (th.veins) {
      // vân đá cẩm thạch: vài đường gãy khúc mờ chạy qua cả bàn
      for (let k = 0; k < 16; k++) {
        g.strokeStyle = `rgba(80,90,105,${0.06 + rnd() * 0.1})`;
        g.lineWidth = 0.8 + rnd() * 2.2;
        g.beginPath();
        let x = rnd() * BS, y = rnd() * BS, a = rnd() * Math.PI * 2;
        g.moveTo(x, y);
        for (let s = 0; s < 40; s++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 18; y += Math.sin(a) * 18; g.lineTo(x, y); }
        g.stroke();
      }
    }
    // bóng nhẹ trong góc ô cho có chiều sâu
    const gr = g.createLinearGradient(0, 0, BS, BS);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = gr; g.fillRect(0, 0, BS, BS);
    BOARD_CACHE[id] = c;
    return c;
  }

  // ván đã xong: lần sau đổi màu quân (người cầm Trắng ván trước sẽ cầm Đen)
  let swapSides = false;

  class Chess {
    constructor(api) {
      this.api = api;
      this.players = api.players;
      this.n = this.players.length;
      this.pos = new CE.Pos();
      // P1 cầm Trắng, P2 cầm Đen (đổi sau mỗi ván)
      this.sideOf = this.players.map((_, i) => (i % 2) ^ (swapSides ? 1 : 0));
      this.playerOf = [this.sideOf.indexOf(0), this.sideOf.indexOf(1)];
      const humans = this.players.filter((p) => !p.bot);
      this.flip = humans.length === 1 && this.sideOf[this.players.indexOf(humans[0])] === 1;
      this.clock = new BoardKit.Clock(api.variant);
      this.legal = this.pos.legal();
      this.hist = [];                 // { m, san, side, cap }
      this.capt = [[], []];           // quân bị ăn BỞI bên s
      this.sel = -1; this.drag = null; this.hover = -1;
      this.cursor = this.players.map((_, i) => (this.sideOf[i] === 0 ? 0x14 : 0x64)); // e2 / e7
      this.rep = this.players.map(() => new BoardKit.KeyRepeat());
      this.promo = null;              // { moves, k } đang chọn quân phong cấp
      this.anim = null;
      this.think = null;              // máy đang nghĩ
      this.banner = null;
      this.finished = false;
      this.result = null;
      this.t = 0;
      this.lastTick = -1;
      this.teamOf = (i) => this.sideOf[i];
      this.teamNames = ['♔ Trắng', '♚ Đen'];
      this.teamColors = ['#fff6e0', '#c9c2ea'];
      this.teamLabel = 'Quân';
      this.ownEndBanner = true;
    }

    /* ---------- tiện ích toạ độ ---------- */
    sqXY(sq) { // góc trên-trái của ô trên màn hình
      const f = sq & 7, r = sq >> 4;
      return this.flip ? { x: BX + (7 - f) * SQ, y: BY + r * SQ } : { x: BX + f * SQ, y: BY + (7 - r) * SQ };
    }
    xySq(x, y) {
      const cf = Math.floor((x - BX) / SQ), cr = Math.floor((y - BY) / SQ);
      if (cf < 0 || cf > 7 || cr < 0 || cr > 7) return -1;
      return this.flip ? cr * 16 + (7 - cf) : (7 - cr) * 16 + cf;
    }
    get side() { return this.pos.side; }
    /** mức của máy cầm bên side (mỗi máy một mức) */
    levelOf(side) { return this.players[this.playerOf[side]].level || 'normal'; }
    get active() { return this.playerOf[this.pos.side]; }
    movesFrom(sq) { return this.legal.filter((m) => CE.mFrom(m) === sq); }
    ownPiece(sq) { const p = this.pos.b[sq]; return p && ((p & 8) ? 1 : 0) === this.pos.side; }

    /* ---------- vòng lặp ---------- */
    update(dt, inp) {
      this.t += dt;
      if (this.anim) { this.anim.t += dt; if (this.anim.t >= ANIM_T) this.anim = null; }
      if (this.banner) { this.banner.age += dt; if (this.banner.age > (this.finished ? 9 : 1.3)) this.banner = null; }
      if (this.finished) return;
      const side = this.pos.side, pi = this.active, p = this.players[pi];
      // đồng hồ
      if (this.clock.on && this.hist.length >= 1) {
        if (this.clock.tick(side, dt)) { this.timeOut(side); return; }
        const left = this.clock.left[side];
        if (left < 10 && !p.bot && Math.ceil(left) !== this.lastTick) { this.lastTick = Math.ceil(left); Sfx.play('tick'); }
      }
      if (p.bot) { this.updateBot(dt, side); return; }
      this.humanInput(pi, inp[pi], dt);
    }

    humanInput(i, q, dt) {
      if (!q) return;
      // chọn quân phong cấp
      if (this.promo) {
        const st = this.rep[i].step(q, dt);
        if (st) { this.promo.k = (this.promo.k + (st.dx || st.dy) + 4) % 4; Sfx.play('move'); }
        if (q.actP) this.finishPromo(this.promo.k);
        else if (q.jumpP) { this.promo = null; Sfx.play('leave'); }
        return;
      }
      const st = this.rep[i].step(q, dt);
      if (st) {
        const sgn = this.flip ? -1 : 1, c = this.cursor[i];
        const f = U.clamp((c & 7) + st.dx * sgn, 0, 7), r = U.clamp((c >> 4) - st.dy * sgn, 0, 7);
        if (f * 1 + r * 16 !== c) { this.cursor[i] = r * 16 + f; Sfx.tone(520, 0.03, 'sine', 0.04); }
      }
      if (q.actP) this.pressSquare(this.cursor[i]);
      if (q.jumpP && this.sel >= 0) { this.sel = -1; Sfx.play('leave'); }
    }
    /** bấm (phím Đánh hoặc chuột) vào ô sq */
    pressSquare(sq) {
      if (this.sel >= 0) {
        const ms = this.movesFrom(this.sel).filter((m) => CE.mTo(m) === sq);
        if (ms.length) { this.tryMove(ms); return; }
        if (sq === this.sel) { this.sel = -1; Sfx.play('leave'); return; }
      }
      if (this.ownPiece(sq)) {
        if (this.movesFrom(sq).length) { this.sel = sq; Sfx.play('select'); } else { this.sel = -1; Sfx.tone(180, 0.08, 'square', 0.06); }
        return;
      }
      if (this.sel >= 0) { this.sel = -1; Sfx.tone(180, 0.08, 'square', 0.06); }
    }
    tryMove(ms) {
      if (ms.length > 1) { this.promo = { moves: ms, k: 0 }; Sfx.play('warn'); return; } // nhiều nước cùng ô đích = phong cấp
      this.doMove(ms[0]);
    }
    finishPromo(k) {
      const want = [CE.QUEEN, CE.ROOK, CE.BISHOP, CE.KNIGHT][k];
      const m = this.promo.moves.find((x) => CE.mPromo(x) === want) || this.promo.moves[0];
      this.promo = null;
      this.doMove(m);
    }

    /** chuột (BRD1): bấm quân rồi bấm ô, hoặc kéo thả */
    onPointer(x, y, type) {
      if (this.finished) return;
      const pi = this.active;
      if (this.players[pi].bot) { this.drag = null; return; }
      const sq = this.xySq(x, y);
      if (type === 'move') { this.hover = sq; if (this.drag) { this.drag.x = x; this.drag.y = y; if (Math.hypot(x - this.drag.x0, y - this.drag.y0) > 8) this.drag.moved = true; } return; }
      if (this.promo) {
        if (type !== 'down') return;
        const k = this.promoHit(x, y);
        if (k >= 0) this.finishPromo(k); else this.promo = null;
        return;
      }
      if (type === 'down') {
        if (sq < 0) { this.sel = -1; return; }
        this.cursor[pi] = sq;
        const wasSel = sq === this.sel;
        if (!wasSel) this.pressSquare(sq);   // bấm lại quân đang chọn: chờ nhả chuột mới bỏ chọn (để còn kéo)
        if (this.sel === sq) this.drag = { sq, x, y, x0: x, y0: y, moved: false, wasSel };
      } else if (type === 'up' && this.drag) {
        const d = this.drag;
        this.drag = null;
        if (!d.moved) { if (d.wasSel && sq === d.sq) { this.sel = -1; Sfx.play('leave'); } return; }
        if (sq >= 0 && sq !== d.sq) {
          const ms = this.movesFrom(d.sq).filter((m) => CE.mTo(m) === sq);
          if (ms.length) { this.cursor[pi] = sq; this.tryMove(ms); }
        }
      }
    }

    /* ---------- máy ---------- */
    botOpt() {
      const ply = this.hist.length, side = this.pos.side, lv = this.levelOf(side);
      let o;
      if (lv === 'easy') o = { multi: true, depth: 2, noise: 70, blunder: 0.25, margin: 300, time: 900 };
      else if (lv === 'normal') o = { multi: true, depth: 3, noise: 25, blunder: 0.08, margin: 120, time: 1300 };
      else if (ply < 8) o = { multi: true, depth: 4, noise: 15, time: 1500 };  // vài nước đầu: đa dạng khai cuộc
      else o = { time: U.rand(1500, 2500) };
      if (this.clock.on) {
        const left = this.clock.left[side], inc = this.clock.tc.inc;
        o.time = Math.max(80, Math.min(o.time, (left / 28 + inc * 0.7) * 1000, left * 300));
      }
      return o;
    }
    updateBot(dt, side) {
      if (this.anim) return;
      if (!this.think) {
        const moves = this.hist.map((h) => h.m);
        const th = this.think = { t: 0, min: BoardKit.sync ? 0 : this.levelOf(side) === 'hard' ? 0.3 : U.rand(0.5, 0.9), res: null, side, ply: moves.length };
        brain().ask({ fen: CE.START, moves, opt: this.botOpt() }, (r) => { th.res = r; });
        return;
      }
      const th = this.think;
      th.t += dt;
      if (th.res && th.t >= th.min) {
        this.think = null;
        if (th.side !== this.pos.side || th.ply !== this.hist.length) return;
        const m = this.legal.includes(th.res.move) ? th.res.move : this.legal[0];
        this.doMove(m);
      }
    }
    botInput() { return {}; }

    /* ---------- đi quân ---------- */
    doMove(m) {
      const pos = this.pos, side = pos.side, b = pos.b;
      const from = CE.mFrom(m), to = CE.mTo(m), fl = CE.mFlag(m);
      const san = CE.san(pos, m, this.legal);
      const cap = fl & CE.F_EP ? b[side ? to + 16 : to - 16] : b[to];
      const piece = b[from];
      pos.make(m);
      this.hist.push({ m, san, side, from, to });
      if (cap) this.capt[side].push(cap);
      this.clock.moved(side);
      this.anim = { piece: CE.mPromo(m) ? piece : piece, from, to, t: 0, promo: CE.mPromo(m) ? b[to] : 0 };
      if (fl & CE.F_CASTLE) this.anim.rook = { from: to > from ? from + 3 : from - 4, to: to > from ? from + 1 : from - 1, piece: b[to > from ? from + 1 : from - 1] };
      this.sel = -1; this.promo = null; this.drag = null; this.lastTick = -1;
      this.legal = pos.legal();
      // âm thanh + hiệu ứng
      if (fl & CE.F_CASTLE) { Sfx.play('place'); setTimeout(() => Sfx.play('place', 0), 90); } else if (cap) { Sfx.play('hit'); this.burstAt(to, cap); } else Sfx.play('place');
      if (CE.mPromo(m)) { Sfx.play('crown'); this.burstAt(to, b[to], true); }
      const st = CE.status(pos);
      if (st) { this.finish(st.winner, st.why); return; }
      if (this.hist.length >= MAX_PLY && this.players.every((p) => p.bot)) { this.finish(-1, 'long'); return; }
      if (pos.inCheck()) {
        this.banner = { text: 'Chiếu!', age: 0, color: '#ff6b6b' };
        Sfx.play('warn');
        const vi = this.playerOf[pos.side];
        Party.rumble(vi, 0.6, 200);
      }
    }
    burstAt(sq, p, gold) {
      const q = this.sqXY(sq), cx = q.x + SQ / 2, cy = q.y + SQ / 2;
      const col = gold ? ['#ffe14d', '#fff'] : p & 8 ? ['#3a3248', '#8d84a8'] : ['#fff6e0', '#d9c9a0'];
      this.api.parts.burst(cx, cy, col, gold ? 22 : 14, gold ? 260 : 200, 0.5, 5);
    }
    timeOut(side) {
      // hết giờ: thua — trừ khi đối thủ không có cách nào chiếu hết thì hòa
      if (CE.canMate(this.pos, side ^ 1)) this.finish(side ^ 1, 'time');
      else this.finish(-1, 'timedraw');
    }
    finish(winner, why) {
      this.finished = true;
      this.result = { winner, why };
      this.think = null; brain().cancel();
      if (why === 'mate') { this.banner = { text: 'Chiếu hết!', age: 0, color: '#ffe14d' }; Sfx.play('boom'); FX.shake(8); }
      else if (winner < 0) this.banner = { text: 'Hòa!', age: 0, color: '#9fd8ff' };
      else this.banner = { text: 'Hết giờ!', age: 0, color: '#ff6b6b' };
      if (winner >= 0) {
        const q = this.cardPos(winner);
        for (let k = 0; k < 4; k++) this.api.parts.burst(q.x + U.rand(-40, 160), q.y + U.rand(-30, 30), [this.players[this.playerOf[winner]].color.main, '#ffe14d', '#fff'], 24, 320, 0.9, 6);
        const loser = this.playerOf[winner ^ 1];
        Party.rumble(loser, 0.8, 300);
      }
    }
    results() {
      if (!this.counted) { this.counted = true; swapSides = !swapSides; }
      const r = this.result || { winner: -1, why: 'long' };
      return this.players.map((_, i) => {
        const s = this.sideOf[i], why = WHY[r.why];
        if (r.winner < 0) return { score: 1, text: `${SIDE_ICON[s]} Hòa` };
        return r.winner === s ? { score: 2, text: `${SIDE_ICON[s]} Thắng · ${why}` } : { score: 0, text: `${SIDE_ICON[s]} Thua` };
      });
    }
    resultTitle() {
      const r = this.result || { winner: -1, why: 'long' };
      if (r.winner < 0) return `🤝 Hòa! <small>(${WHY[r.why]})</small>`;
      const p = this.players[this.playerOf[r.winner]];
      return `<span style="color:${p.color.light}">${p.name}</span> (${SIDE_NAME[r.winner]}) thắng — ${WHY[r.why]}!`;
    }

    /* ---------- vẽ ---------- */
    cardPos(side) { // bên ở dưới bàn = bên của người xem (không lật: Trắng)
      const bottom = this.flip ? 1 : 0;
      return { x: PX, y: side === bottom ? LIST_Y + LIST_H + 12 : BY };
    }
    posOf(i) { const q = this.cardPos(this.sideOf[i]); return { x: q.x + 46, y: q.y + 50 }; }

    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#2d1b57'); g.addColorStop(1, '#140b2e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      this.drawBoard(ctx);
      this.drawPanel(ctx);
      if (this.banner) {
        ctx.save(); ctx.translate(BX + BS / 2 - W / 2, 0);
        ctx.globalAlpha = this.finished ? 1 : Math.min(1, (1.3 - this.banner.age) / 0.3);
        Draw.banner(ctx, this.banner.text, this.banner.age, { size: 84, color: this.banner.color, y: BY + BS / 2 });
        ctx.restore();
      }
    }
    drawBoard(ctx) {
      const opt = this.api.opts || {}, th = THEMES[opt.board] || THEMES.wood;
      // khung
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      Draw.rr(ctx, BX - 24, BY - 24, BS + 48, BS + 48, 14);
      ctx.fillStyle = th.frame; ctx.fill();
      ctx.restore();
      ctx.drawImage(boardCanvas(opt.board || 'wood'), BX, BY);
      // toạ độ
      for (let k = 0; k < 8; k++) {
        const file = this.flip ? 7 - k : k, rank = this.flip ? k + 1 : 8 - k;
        Draw.text(ctx, 'abcdefgh'[file], BX + k * SQ + SQ / 2, BY + BS + 13, { size: 15, color: 'rgba(255,255,255,0.75)', stroke: null });
        Draw.text(ctx, String(rank), BX - 12, BY + k * SQ + SQ / 2, { size: 15, color: 'rgba(255,255,255,0.75)', stroke: null });
      }
      const fill = (sq, col) => { const q = this.sqXY(sq); ctx.fillStyle = col; ctx.fillRect(q.x, q.y, SQ, SQ); };
      // nước vừa đi
      const last = this.hist[this.hist.length - 1];
      if (last) { fill(last.from, 'rgba(255,214,64,0.42)'); fill(last.to, 'rgba(255,214,64,0.5)'); }
      if (this.sel >= 0) fill(this.sel, 'rgba(70,190,255,0.5)');
      // vua đang bị chiếu
      if (this.pos.inCheck() || (this.result && this.result.why === 'mate')) {
        const q = this.sqXY(this.pos.kings[this.pos.side]), cx = q.x + SQ / 2, cy = q.y + SQ / 2;
        const rg = ctx.createRadialGradient(cx, cy, 4, cx, cy, SQ * 0.62);
        rg.addColorStop(0, 'rgba(255,40,40,0.95)'); rg.addColorStop(0.55, 'rgba(255,40,40,0.5)'); rg.addColorStop(1, 'rgba(255,40,40,0)');
        ctx.fillStyle = rg; ctx.fillRect(q.x, q.y, SQ, SQ);
      }
      // ô chuột đang trỏ
      if (this.hover >= 0 && !this.players[this.active].bot && !this.finished) {
        const q = this.sqXY(this.hover);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.strokeRect(q.x + 1.5, q.y + 1.5, SQ - 3, SQ - 3);
      }
      // quân
      const hideA = this.anim ? this.anim.to : -1, hideR = this.anim && this.anim.rook ? this.anim.rook.to : -1;
      const dragSq = this.drag && this.drag.moved ? this.drag.sq : -1;
      for (let sq = 0; sq < 120; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = this.pos.b[sq];
        if (!p || sq === hideA || sq === hideR || sq === dragSq) continue;
        const q = this.sqXY(sq);
        this.drawPiece(ctx, p, q.x + SQ / 2, q.y + SQ / 2, 1);
      }
      // ô đi được
      if (this.sel >= 0) {
        for (const m of this.movesFrom(this.sel)) {
          const t = CE.mTo(m), q = this.sqXY(t), cx = q.x + SQ / 2, cy = q.y + SQ / 2;
          ctx.fillStyle = 'rgba(20,10,40,0.28)'; ctx.strokeStyle = 'rgba(20,10,40,0.3)';
          if (this.pos.b[t] || (CE.mFlag(m) & CE.F_EP)) { ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(cx, cy, SQ * 0.44, 0, TAU); ctx.stroke(); }
          else { ctx.beginPath(); ctx.arc(cx, cy, SQ * 0.15, 0, TAU); ctx.fill(); }
        }
      }
      // quân đang trượt
      if (this.anim) {
        const a = this.anim, k = U.clamp(a.t / ANIM_T, 0, 1), e = 1 - (1 - k) * (1 - k);
        const slide = (pc, f, t) => {
          const p0 = this.sqXY(f), p1 = this.sqXY(t);
          this.drawPiece(ctx, pc, U.lerp(p0.x, p1.x, e) + SQ / 2, U.lerp(p0.y, p1.y, e) + SQ / 2, 1 + Math.sin(k * Math.PI) * 0.12);
        };
        slide(a.piece, a.from, a.to);
        if (a.rook) slide(a.rook.piece, a.rook.from, a.rook.to);
      }
      // con trỏ của người đang đi (màu người chơi)
      const pi = this.active, pl = this.players[pi];
      if (!pl.bot && !this.finished) {
        const q = this.sqXY(this.cursor[pi]), pulse = 3 + Math.sin(this.t * 7) * 1.5;
        ctx.save();
        ctx.strokeStyle = pl.color.main; ctx.lineWidth = 5 + pulse * 0.4;
        ctx.shadowColor = pl.color.main; ctx.shadowBlur = 12;
        Draw.rr(ctx, q.x + 3, q.y + 3, SQ - 6, SQ - 6, 10); ctx.stroke();
        ctx.restore();
      }
      // quân đang kéo bằng chuột
      if (dragSq >= 0) this.drawPiece(ctx, this.pos.b[dragSq], this.drag.x, this.drag.y, 1.15);
      if (this.promo) this.drawPromo(ctx);
    }
    drawPiece(ctx, p, cx, cy, s) {
      const set = (this.api.opts && this.api.opts.pieces) || 'cburnett', im = BoardKit.img(pieceSrc(set, p));
      const sz = SQ * 0.92 * s;
      if (im.ok) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
        ctx.drawImage(im.el, cx - sz / 2, cy - sz / 2, sz, sz);
        ctx.restore();
        return;
      }
      // dự phòng: vẽ ký tự quân cờ khi thiếu ảnh
      const ch = '♙♘♗♖♕♔'[(p & 7) - 1];
      Draw.text(ctx, ch, cx, cy + 2, { size: 58 * s, color: p & 8 ? '#2a2233' : '#fffaf0', stroke: p & 8 ? '#bdb6c9' : '#2a2233', sw: 3 });
    }
    promoRect() {
      const to = CE.mTo(this.promo.moves[0]), q = this.sqXY(to);
      const down = q.y < BY + BS / 2; // ô phong cấp ở mép trên → bảng chọn mọc xuống
      return { x: q.x, y: down ? q.y : q.y - 3 * SQ, down };
    }
    promoHit(x, y) {
      const r = this.promoRect();
      if (x < r.x || x > r.x + SQ || y < r.y || y > r.y + 4 * SQ) return -1;
      const k = Math.floor((y - r.y) / SQ);
      return r.down ? k : 3 - k;
    }
    drawPromo(ctx) {
      const r = this.promoRect(), side = this.pos.side, kinds = [CE.QUEEN, CE.ROOK, CE.BISHOP, CE.KNIGHT];
      ctx.fillStyle = 'rgba(10,5,25,0.45)'; ctx.fillRect(BX, BY, BS, BS);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18;
      Draw.rr(ctx, r.x - 4, r.y - 4, SQ + 8, 4 * SQ + 8, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      kinds.forEach((t, k) => {
        const y = r.down ? r.y + k * SQ : r.y + (3 - k) * SQ;
        if (k === this.promo.k) { Draw.rr(ctx, r.x, y, SQ, SQ, 10); ctx.fillStyle = '#ffe14d'; ctx.fill(); }
        this.drawPiece(ctx, t | (side ? 8 : 0), r.x + SQ / 2, y + SQ / 2, 0.92);
      });
    }

    drawPanel(ctx) {
      for (const side of [0, 1]) this.drawCard(ctx, side);
      // biên bản nước đi
      const x = PX, y = LIST_Y, w = PW, h = LIST_H;
      Draw.rr(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
      Draw.text(ctx, '📜 Biên bản', x + 18, y + 22, { size: 18, align: 'left', color: 'rgba(255,255,255,0.8)', stroke: null });
      const rows = Math.ceil(this.hist.length / 2), per = 12, first = Math.max(0, rows - per);
      for (let r = first; r < rows; r++) {
        const yy = y + 54 + (r - first) * 24;
        Draw.text(ctx, `${r + 1}.`, x + 46, yy, { size: 17, align: 'right', color: 'rgba(255,255,255,0.5)', stroke: null });
        for (let c = 0; c < 2; c++) {
          const k = r * 2 + c, hm = this.hist[k];
          if (!hm) continue;
          const lastOne = k === this.hist.length - 1;
          const txt = hm.san.replace(/[KQRBN]/g, (ch) => FIG[ch]);
          if (lastOne) { Draw.rr(ctx, x + 58 + c * 150, yy - 11, 120, 22, 8); ctx.fillStyle = 'rgba(255,225,77,0.25)'; ctx.fill(); }
          Draw.text(ctx, txt, x + 66 + c * 150, yy, { size: 18, align: 'left', color: lastOne ? '#ffe14d' : '#fff', stroke: null });
        }
      }
      if (!this.hist.length) Draw.text(ctx, 'Trắng đi trước', x + w / 2, y + h / 2, { size: 20, color: 'rgba(255,255,255,0.45)', stroke: null });
      // trạng thái
      if (!this.finished && this.pos.inCheck()) Draw.text(ctx, `⚠️ ${SIDE_NAME[this.pos.side]} đang bị chiếu!`, x + w - 16, y + 22, { size: 17, align: 'right', color: '#ff8a8a', stroke: null });
    }
    drawCard(ctx, side) {
      const q = this.cardPos(side), pi = this.playerOf[side], p = this.players[pi];
      const active = !this.finished && this.pos.side === side;
      BoardKit.card(ctx, q.x, q.y, PW, CARD_H, { active, color: p.color });
      Draw.blob(ctx, { x: q.x + 46, y: q.y + 50, r: 28, color: p.color, face: Math.PI / 2, shadow: false,
        crown: this.result && this.result.winner === side });
      Draw.text(ctx, p.name, q.x + 88, q.y + 34, { size: 26, align: 'left', color: p.color.light });
      const sub = `${SIDE_ICON[side]} ${SIDE_NAME[side]}${p.bot ? ` · 🤖 Máy ${BOT_LEVELS[this.levelOf(side)].name}` : ''}`;
      Draw.text(ctx, sub, q.x + 88, q.y + 64, { size: 17, align: 'left', color: 'rgba(255,255,255,0.8)', stroke: null });
      // quân đã ăn được + chênh lệch
      const caps = this.capt[side].slice().sort((a, b) => VAL[b & 7] - VAL[a & 7]);
      let cx = q.x + 88;
      caps.forEach((c, k) => { if (k < 15) this.drawMini(ctx, c, cx + k * 17, q.y + 96); });
      const diff = this.capt[side].reduce((s, c) => s + VAL[c & 7], 0) - this.capt[side ^ 1].reduce((s, c) => s + VAL[c & 7], 0);
      if (diff > 0) Draw.text(ctx, `+${diff}`, cx + Math.min(15, caps.length) * 17 + 14, q.y + 96, { size: 17, align: 'left', color: '#5dff9b', stroke: null });
      // đồng hồ / máy đang nghĩ
      if (this.clock.on) {
        const left = this.clock.left[side];
        BoardKit.clockBox(ctx, q.x + PW - 150, q.y + 16, 134, 50, left, active && this.hist.length > 0, left < 20);
      }
      if (active && p.bot) {
        const dots = '.'.repeat(1 + Math.floor(this.t * 3) % 3);
        Draw.text(ctx, `🤔 đang nghĩ${dots}`, q.x + PW - 16, q.y + (this.clock.on ? 92 : 40), { size: 17, align: 'right', color: '#ffe14d', stroke: null });
      } else if (active) {
        Draw.text(ctx, '👉 tới lượt', q.x + PW - 16, q.y + (this.clock.on ? 92 : 40), { size: 17, align: 'right', color: '#ffe14d', stroke: null });
      }
    }
    drawMini(ctx, p, x, y) {
      const set = (this.api.opts && this.api.opts.pieces) || 'cburnett', im = BoardKit.img(pieceSrc(set, p));
      if (im.ok) ctx.drawImage(im.el, x - 13, y - 13, 26, 26);
      else Draw.text(ctx, '♙♘♗♖♕♔'[(p & 7) - 1], x, y, { size: 22, color: p & 8 ? '#2a2233' : '#fff', stroke: null });
    }
  }

  Party.register({
    id: 'chess', name: 'Cờ Vua', emoji: '♟️', cat: 'board',
    tagline: 'Cờ vua đủ luật quốc tế. Đấu bạn bè hoặc máy 3 mức, chơi bằng phím hay chuột.',
    how: 'Chiếu hết Vua đối phương để thắng. Đủ luật quốc tế: nhập thành, bắt tốt qua đường, phong cấp, hòa pat, lặp 3 lần, luật 50 nước. Người–người: thay phiên nhau đi trên cùng bàn; đấu máy: chọn mức Dễ / TB / Khó ở bảng bên dưới. Ván sau tự đổi màu quân.',
    controls: { move: 'Di ô chọn', act: 'Chọn / Đi', jump: 'Bỏ chọn' },
    helpExtra: '🖱️ chuột: bấm hoặc kéo thả quân',
    minPlayers: 2, maxPlayers: 2, rawBot: true,
    variants: BoardKit.TIME_CONTROLS,
    options: [
      { id: 'pieces', label: 'Bộ quân', items: [
        { id: 'cburnett', name: 'Cổ điển', icon: '♞', desc: 'Bộ quân Cburnett quen thuộc' },
        { id: 'merida', name: 'Merida', icon: '♝', desc: 'Kiểu sách cờ in' },
        { id: 'maestro', name: 'Maestro', icon: '♜', desc: 'Nét mềm, hiện đại' }] },
      { id: 'board', label: 'Bàn cờ', items: [
        { id: 'wood', name: 'Gỗ', icon: '🪵', desc: 'Vân gỗ ấm' },
        { id: 'marble', name: 'Cẩm thạch', icon: '🪨', desc: 'Đá trắng xám' },
        { id: 'green', name: 'Xanh lá', icon: '🟩', desc: 'Kiểu giải đấu' }] },
    ],
    create: (api) => new Chess(api),
  });
})();

(() => {
  'use strict';
  /* =========================================================
     Cờ Tướng — 2 người (người–người hoặc người–máy), bàn phím / tay cầm / chuột.
     Luật + AI ở xiangqi_engine.js (XiangqiEngine), phần dùng chung ở board_base.js (BoardKit).
     Luật thêm ở tầng game: hết nước đi là thua; chiếu dài (lặp thế 3 lần mà một bên chiếu liên tục) → bên chiếu thua;
     lặp thế thường → hòa; 60 nước (120 nửa nước) không ăn quân → hòa; hai bên hết quân tấn công → hòa.
     ========================================================= */
  const XE = window.XiangqiEngine;
  const G = 62, GX = 172, GY = 82;                 // lưới giao điểm 9×10
  const BX = GX - 40, BY = GY - 58, BW = 8 * G + 80, BH = 9 * G + 116; // khung bàn
  const PR = 27;                                   // bán kính quân
  const PX = 784, PW = 456, CARD_H = 118, LIST_Y = 186, LIST_H = 348;
  const ANIM_T = 0.18, MAX_PLY = 400;
  const SIDE_NAME = ['Đỏ', 'Đen'], SIDE_ICON = ['🔴', '⚫'];
  const VAL = [0, 0, 2, 2, 4, 9, 4.5, 1];
  const HAN = [null, ['帥', '將'], ['仕', '士'], ['相', '象'], ['馬', '馬'], ['車', '車'], ['炮', '砲'], ['兵', '卒']];
  const VIET = ['', 'Tướng', 'Sĩ', 'Tượng', 'Mã', 'Xe', 'Pháo', 'Tốt'];
  const ICON = ['', '👑', '🛡️', '🐘', '🐴', '🛞', '💥', '🪖'];
  const CJK = '"KaiTi", "STKaiti", "Kaiti TC", "BiauKai", "DFKai-SB", "Noto Serif CJK TC", "Noto Serif CJK SC", "SimSun", "Microsoft JhengHei", "Microsoft YaHei", serif'; // Windows: KaiTi nếu có, không thì JhengHei/YaHei (có sẵn)
  const WHY = {
    mate: 'chiếu bí', stalemate: 'đối phương hết nước đi', perpetual: 'đối phương chiếu dài (phạm luật)', repetition: 'lặp lại thế cờ — hòa',
    sixty: '60 nước không ăn quân — hòa', material: 'hai bên hết quân tấn công — hòa', time: 'hết giờ',
    timedraw: 'hết giờ nhưng đối thủ không còn quân tấn công — hòa', long: 'ván quá dài — hòa',
  };

  const AI_HANDLER = function (E, d) {
    const p = new E.Pos(d.fen);
    for (const m of d.moves) p.make(m);
    const r = E.think(p, d.opt);
    return { move: r.move, score: r.score, depth: r.depth };
  };
  const brain = () => BoardKit.ai('xiangqi', XiangqiEngineFactory, AI_HANDLER, XE);

  /* ---------- Bàn cờ (vẽ sẵn theo kiểu + kiểu chữ sông) ---------- */
  const THEMES = {
    wood: { bg: ['#f0cf8f', '#d9a95f'], line: '#5a3410', frame: '#6b3d17', river: '#7a4a1e', grain: true },
    paper: { bg: ['#fbf3df', '#efe2bf'], line: '#b0242b', frame: '#8c1d22', river: '#b0242b' },
    jade: { bg: ['#cfe7d6', '#9fcbb0'], line: '#1f4d35', frame: '#22513a', river: '#1f4d35' },
  };
  const BOARD_CACHE = {};
  function boardCanvas(theme, script) {
    const key = theme + script + (document.fonts && document.fonts.status === 'loaded' ? 1 : 0);
    if (BOARD_CACHE[key]) return BOARD_CACHE[key];
    const th = THEMES[theme] || THEMES.wood, c = document.createElement('canvas');
    c.width = BW; c.height = BH;
    const g = c.getContext('2d'), ox = GX - BX, oy = GY - BY;
    const gr = g.createLinearGradient(0, 0, BW, BH);
    gr.addColorStop(0, th.bg[0]); gr.addColorStop(1, th.bg[1]);
    g.fillStyle = gr; g.fillRect(0, 0, BW, BH);
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    if (th.grain) {
      for (let k = 0; k < 70; k++) {
        g.strokeStyle = `rgba(110,60,20,${0.04 + rnd() * 0.07})`; g.lineWidth = 1 + rnd() * 2.5;
        g.beginPath();
        const y0 = rnd() * BH, a = 3 + rnd() * 8, ph = rnd() * 6;
        for (let x = 0; x <= BW; x += 6) { const y = y0 + Math.sin(x / 60 + ph) * a; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
    }
    const X = (f) => ox + f * G, Y = (r) => oy + (9 - r) * G;
    g.strokeStyle = th.line; g.lineCap = 'round';
    // khung ngoài đậm
    g.lineWidth = 4; g.strokeRect(X(0) - 7, Y(9) - 7, 8 * G + 14, 9 * G + 14);
    g.lineWidth = 2;
    for (let r = 0; r < 10; r++) { g.beginPath(); g.moveTo(X(0), Y(r)); g.lineTo(X(8), Y(r)); g.stroke(); }
    for (let f = 0; f < 9; f++) {
      g.beginPath();
      if (f === 0 || f === 8) { g.moveTo(X(f), Y(0)); g.lineTo(X(f), Y(9)); } else { g.moveTo(X(f), Y(0)); g.lineTo(X(f), Y(4)); g.moveTo(X(f), Y(5)); g.lineTo(X(f), Y(9)); }
      g.stroke();
    }
    // cung tướng (đường chéo)
    for (const [r0, r1] of [[0, 2], [7, 9]]) {
      g.beginPath(); g.moveTo(X(3), Y(r0)); g.lineTo(X(5), Y(r1)); g.moveTo(X(5), Y(r0)); g.lineTo(X(3), Y(r1)); g.stroke();
    }
    // dấu vị trí Pháo / Tốt
    const mark = (f, r) => {
      const x = X(f), y = Y(r), d = 5, l = 11;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        if ((f === 0 && sx < 0) || (f === 8 && sx > 0)) continue;
        g.beginPath(); g.moveTo(x + sx * d, y + sy * (d + l)); g.lineTo(x + sx * d, y + sy * d); g.lineTo(x + sx * (d + l), y + sy * d); g.stroke();
      }
    };
    for (const [f, r] of [[1, 2], [7, 2], [1, 7], [7, 7]]) mark(f, r);
    for (let f = 0; f <= 8; f += 2) { mark(f, 3); mark(f, 6); }
    // sông
    g.fillStyle = th.river; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ry = (Y(4) + Y(5)) / 2;
    if (script === 'han') {
      g.font = `bold 38px ${CJK}`;
      g.fillText('楚  河', X(2), ry); g.fillText('漢  界', X(6), ry);
    } else {
      g.font = `800 26px ${FONT}`;
      g.fillText('SỞ HÀ', X(2), ry); g.fillText('HÁN GIỚI', X(6), ry);
    }
    // số cột: trên = bên Đen (1..9 từ trái), dưới = bên Đỏ (9..1 từ trái)
    g.font = `700 15px ${FONT}`; g.fillStyle = th.line;
    for (let f = 0; f < 9; f++) { g.fillText(String(f + 1), X(f), Y(9) - 42); g.fillText(String(9 - f), X(f), Y(0) + 42); }
    BOARD_CACHE[key] = c;
    return c;
  }

  /* ---------- Quân: đĩa gỗ (vẽ sẵn mỗi kiểu một lần) ---------- */
  const PIECE_CACHE = {};
  const PS = 128; // kích thước canvas vẽ sẵn
  function pieceCanvas(p, style) {
    const ready = document.fonts && document.fonts.status === 'loaded' ? 1 : 0;
    const key = style + p + ready;
    if (PIECE_CACHE[key]) return PIECE_CACHE[key];
    const c = document.createElement('canvas');
    c.width = c.height = PS;
    const g = c.getContext('2d'), m = PS / 2, R = PS / 2 - 6, black = !!(p & 8), t = p & 7;
    const ink = black ? '#1f1a17' : '#b3201f';
    // bóng đổ + cạnh đĩa
    g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
    g.beginPath(); g.arc(m, m, R, 0, TAU); g.fillStyle = '#b07a3e'; g.fill(); g.restore();
    // mặt đĩa gỗ
    const gr = g.createRadialGradient(m - R * 0.35, m - R * 0.4, R * 0.1, m, m, R);
    // kiểu Hình: tô màu đĩa theo bên cho dễ phân biệt Đỏ / Đen
    const face = style === 'icon' ? (black ? ['#f2f2f7', '#c3c3cf', '#7d7d8c'] : ['#ffe3dc', '#f4a493', '#c4523f']) : ['#fff0cf', '#efcf96', '#c99458'];
    gr.addColorStop(0, face[0]); gr.addColorStop(0.65, face[1]); gr.addColorStop(1, face[2]);
    g.beginPath(); g.arc(m, m, R - 4, 0, TAU); g.fillStyle = gr; g.fill();
    // vòng chỉ trong
    g.lineWidth = 3.2; g.strokeStyle = ink; g.globalAlpha = 0.85;
    g.beginPath(); g.arc(m, m, R - 12, 0, TAU); g.stroke();
    g.globalAlpha = 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (style === 'icon') {
      g.font = `58px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      g.fillText(ICON[t], m, m + 3);
      // chấm màu bên để phân biệt Đỏ / Đen
      g.beginPath(); g.arc(m + R * 0.55, m + R * 0.55, 11, 0, TAU); g.fillStyle = ink; g.fill();
      g.lineWidth = 2; g.strokeStyle = '#fff3d6'; g.stroke();
    } else if (style === 'viet') {
      const w = VIET[t];
      g.font = `800 ${w.length > 4 ? 30 : w.length > 2 ? 36 : 42}px ${FONT}`;
      g.fillStyle = ink; g.fillText(w, m, m + 3);
    } else {
      g.font = `bold 60px ${CJK}`;
      g.fillStyle = ink; g.fillText(HAN[t][black ? 1 : 0], m, m + 2);
    }
    // ánh bóng
    const hl = g.createLinearGradient(0, m - R, 0, m);
    hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.beginPath(); g.ellipse(m, m - R * 0.45, R * 0.62, R * 0.3, 0, 0, TAU); g.fillStyle = hl; g.fill();
    PIECE_CACHE[key] = c;
    return c;
  }

  let swapSides = false;

  class Xiangqi {
    constructor(api) {
      this.api = api;
      this.players = api.players;
      this.pos = new XE.Pos();
      this.sideOf = this.players.map((_, i) => (i % 2) ^ (swapSides ? 1 : 0));
      this.playerOf = [this.sideOf.indexOf(0), this.sideOf.indexOf(1)];
      const humans = this.players.filter((p) => !p.bot);
      this.flip = humans.length === 1 && this.sideOf[this.players.indexOf(humans[0])] === 1;
      this.clock = new BoardKit.Clock(api.variant);
      this.legal = this.pos.legal();
      this.hist = [];                 // { m, note, side, from, to, check, cap }
      this.capt = [[], []];
      this.sel = -1; this.drag = null; this.hover = -1;
      this.cursor = this.players.map((_, i) => (this.sideOf[i] === 0 ? XE.SQ(2, 7) : XE.SQ(7, 1))); // cạnh Pháo
      this.rep = this.players.map(() => new BoardKit.KeyRepeat());
      this.anim = null; this.think = null; this.banner = null; this.warn = null;
      this.finished = false; this.result = null;
      this.t = 0; this.lastTick = -1;
      this.opening = null;
      this.teamOf = (i) => this.sideOf[i];
      this.teamNames = ['🔴 Đỏ', '⚫ Đen'];
      this.teamColors = ['#ff8a80', '#c9c2ea'];
      this.teamLabel = 'Quân';
      this.ownEndBanner = true;
    }

    /* ---------- toạ độ ---------- */
    sqXY(sq) {
      const r = XE.ROW(sq), f = XE.COL(sq);
      return this.flip ? { x: GX + (8 - f) * G, y: GY + r * G } : { x: GX + f * G, y: GY + (9 - r) * G };
    }
    xySq(x, y) {
      const cf = Math.round((x - GX) / G), cr = Math.round((y - GY) / G);
      if (cf < 0 || cf > 8 || cr < 0 || cr > 9) return -1;
      if (Math.hypot(x - (GX + cf * G), y - (GY + cr * G)) > G * 0.55) return -1;
      return this.flip ? XE.SQ(cr, 8 - cf) : XE.SQ(9 - cr, cf);
    }
    get active() { return this.playerOf[this.pos.side]; }
    levelOf(side) { return this.players[this.playerOf[side]].level || 'normal'; }
    movesFrom(sq) { return this.legal.filter((m) => XE.mFrom(m) === sq); }
    ownPiece(sq) { const p = this.pos.b[sq]; return p && ((p & 8) ? 1 : 0) === this.pos.side; }
    style() { return (this.api.opts && this.api.opts.script) || 'han'; }

    /* ---------- vòng lặp ---------- */
    update(dt, inp) {
      this.t += dt;
      if (this.anim) { this.anim.t += dt; if (this.anim.t >= ANIM_T) this.anim = null; }
      if (this.banner) { this.banner.age += dt; if (this.banner.age > (this.finished ? 9 : 1.4)) this.banner = null; }
      if (this.warn) { this.warn.t -= dt; if (this.warn.t <= 0) this.warn = null; }
      if (this.finished) return;
      const side = this.pos.side, pi = this.active, p = this.players[pi];
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
      const st = this.rep[i].step(q, dt);
      if (st) {
        const sgn = this.flip ? -1 : 1, c = this.cursor[i];
        const f = U.clamp(XE.COL(c) + st.dx * sgn, 0, 8), r = U.clamp(XE.ROW(c) - st.dy * sgn, 0, 9);
        const n = XE.SQ(r, f);
        if (n !== c) { this.cursor[i] = n; Sfx.tone(520, 0.03, 'sine', 0.04); }
      }
      if (q.actP) this.pressSquare(this.cursor[i]);
      if (q.jumpP && this.sel >= 0) { this.sel = -1; Sfx.play('leave'); }
    }
    pressSquare(sq) {
      if (this.sel >= 0) {
        const m = this.movesFrom(this.sel).find((x) => XE.mTo(x) === sq);
        if (m) { this.doMove(m); return; }
        if (sq === this.sel) { this.sel = -1; Sfx.play('leave'); return; }
      }
      if (this.ownPiece(sq)) {
        if (this.movesFrom(sq).length) { this.sel = sq; Sfx.play('select'); } else { this.sel = -1; Sfx.tone(180, 0.08, 'square', 0.06); }
        return;
      }
      if (this.sel >= 0) { this.sel = -1; Sfx.tone(180, 0.08, 'square', 0.06); }
    }
    onPointer(x, y, type) {
      if (this.finished) return;
      const pi = this.active;
      if (this.players[pi].bot) { this.drag = null; return; }
      const sq = this.xySq(x, y);
      if (type === 'move') { this.hover = sq; if (this.drag) { this.drag.x = x; this.drag.y = y; if (Math.hypot(x - this.drag.x0, y - this.drag.y0) > 8) this.drag.moved = true; } return; }
      if (type === 'down') {
        if (sq < 0) { this.sel = -1; return; }
        this.cursor[pi] = sq;
        const wasSel = sq === this.sel;
        if (!wasSel) this.pressSquare(sq);
        if (this.sel === sq) this.drag = { sq, x, y, x0: x, y0: y, moved: false, wasSel };
      } else if (type === 'up' && this.drag) {
        const d = this.drag;
        this.drag = null;
        if (!d.moved) { if (d.wasSel && sq === d.sq) { this.sel = -1; Sfx.play('leave'); } return; }
        if (sq >= 0 && sq !== d.sq) {
          const m = this.movesFrom(d.sq).find((z) => XE.mTo(z) === sq);
          if (m) { this.cursor[pi] = sq; this.doMove(m); }
        }
      }
    }

    /* ---------- luật lặp / chiếu dài ---------- */
    /** xét vòng lặp vừa xảy ra: trả { count, checker } — checker = bên chiếu liên tục trong cả vòng (−1 nếu không/cả hai) */
    cycleInfo() {
      const pos = this.pos, count = pos.repCount();
      if (!count) return { count: 0, checker: -1 };
      const k0 = pos.firstRep(), all = [true, true], any = [false, false];
      for (let j = k0; j < this.hist.length; j++) { const h = this.hist[j]; any[h.side] = true; if (!h.check) all[h.side] = false; }
      const c0 = any[0] && all[0], c1 = any[1] && all[1];
      return { count, checker: c0 && !c1 ? 0 : c1 && !c0 ? 1 : -1 };
    }
    /** các nước chiếu làm lặp thế mà bên đi đang chiếu liên tục — máy tránh để khỏi bị xử thua chiếu dài */
    bannedMoves() {
      const pos = this.pos, side = pos.side, out = [];
      for (const m of this.legal) {
        pos.make(m);
        if (pos.repCount() >= 1 && pos.inCheck()) { // đã lặp 1 lần mà vẫn chiếu → né luôn (lần sau là bị xử thua)
          this.hist.push({ side, check: true });
          if (this.cycleInfo().checker === side) out.push(m);
          this.hist.pop();
        }
        pos.unmake();
      }
      return out;
    }

    /* ---------- máy ---------- */
    botOpt() {
      const ply = this.hist.length, side = this.pos.side, lv = this.levelOf(side);
      let o;
      if (lv === 'easy') o = { multi: true, depth: 2, noise: 70, blunder: 0.25, margin: 300, time: 900 };
      else if (lv === 'normal') o = { multi: true, depth: 3, noise: 25, blunder: 0.08, margin: 120, time: 1300 };
      else if (ply < 8) o = { multi: true, depth: 4, noise: 15, time: 1500 };
      else o = { time: U.rand(1500, 2500) };
      if (this.clock.on) {
        const left = this.clock.left[side], inc = this.clock.tc.inc;
        o.time = Math.max(80, Math.min(o.time, (left / 28 + inc * 0.7) * 1000, left * 300));
      }
      o.ban = this.bannedMoves();
      return o;
    }
    updateBot(dt, side) {
      if (this.anim) return;
      if (!this.think) {
        const moves = this.hist.map((h) => h.m), lv = this.levelOf(side);
        const th = this.think = { t: 0, min: BoardKit.sync ? 0 : lv === 'hard' ? 0.3 : U.rand(0.5, 0.9), res: null, side, ply: moves.length };
        // vài nước đầu: theo sách khai cuộc (máy Dễ ít theo hơn)
        if (moves.length < 8 && Math.random() < (lv === 'easy' ? 0.4 : 0.85)) {
          const bm = XE.bookMove(this.pos, this.hist.map((h) => h.note));
          if (bm) { th.res = { move: bm }; th.min = BoardKit.sync ? 0 : U.rand(0.4, 0.8); return; }
        }
        brain().ask({ fen: XE.START, moves, opt: this.botOpt() }, (r) => { th.res = r; });
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
      const pos = this.pos, side = pos.side, b = pos.b, from = XE.mFrom(m), to = XE.mTo(m);
      const note = XE.note(pos, m), cap = b[to], piece = b[from];
      pos.make(m);
      const check = pos.inCheck();
      this.hist.push({ m, note, side, from, to, check, cap });
      if (cap) this.capt[side].push(cap);
      this.clock.moved(side);
      this.anim = { piece, from, to, t: 0 };
      this.sel = -1; this.drag = null; this.lastTick = -1;
      this.legal = pos.legal();
      const nm = XE.openingName(this.hist.map((h) => h.note));
      if (nm && this.hist.length <= 12) this.opening = nm;
      if (cap) { Sfx.play('hit'); this.burstAt(to, cap); } else Sfx.tone(260, 0.05, 'square', 0.12); // tiếng "cạch"
      // kết thúc ván
      if (!this.legal.length) { this.finish(side, check ? 'mate' : 'stalemate'); return; }
      const cyc = this.cycleInfo();
      if (cyc.count >= 2) {
        if (cyc.checker >= 0) this.finish(cyc.checker ^ 1, 'perpetual'); else this.finish(-1, 'repetition');
        return;
      }
      if (pos.half >= 120) { this.finish(-1, 'sixty'); return; }
      if (!pos.hasAttackers(0) && !pos.hasAttackers(1)) { this.finish(-1, 'material'); return; }
      if (this.hist.length >= MAX_PLY && this.players.every((p) => p.bot)) { this.finish(-1, 'long'); return; }
      if (check) {
        this.banner = { text: 'Chiếu tướng!', age: 0, color: '#ff6b6b' };
        Sfx.play('warn');
        Party.rumble(this.playerOf[pos.side], 0.6, 200);
      }
      // cảnh báo chiếu dài: lặp lần 2 mà bên vừa đi chiếu liên tục
      if (cyc.count === 1 && cyc.checker === side) {
        this.warn = { side, t: 4 };
        Sfx.play('warn', 0);
      }
    }
    burstAt(sq, p) {
      const q = this.sqXY(sq);
      this.api.parts.burst(q.x, q.y, p & 8 ? ['#3a3248', '#c99458'] : ['#d64545', '#f3d39c'], 14, 200, 0.5, 5);
    }
    timeOut(side) {
      if (this.pos.hasAttackers(side ^ 1)) this.finish(side ^ 1, 'time'); else this.finish(-1, 'timedraw');
    }
    finish(winner, why) {
      this.finished = true;
      this.result = { winner, why };
      this.think = null; brain().cancel();
      if (why === 'mate') { this.banner = { text: 'Chiếu bí!', age: 0, color: '#ffe14d' }; Sfx.play('boom'); FX.shake(8); }
      else if (why === 'stalemate') this.banner = { text: 'Hết nước đi!', age: 0, color: '#ffe14d' };
      else if (why === 'perpetual') this.banner = { text: 'Chiếu dài — xử thua!', age: 0, color: '#ff6b6b' };
      else if (winner < 0) this.banner = { text: 'Hòa!', age: 0, color: '#9fd8ff' };
      else this.banner = { text: 'Hết giờ!', age: 0, color: '#ff6b6b' };
      if (winner >= 0) {
        const q = this.cardPos(winner);
        for (let k = 0; k < 4; k++) this.api.parts.burst(q.x + U.rand(-40, 160), q.y + U.rand(-30, 30), [this.players[this.playerOf[winner]].color.main, '#ffe14d', '#fff'], 24, 320, 0.9, 6);
        Party.rumble(this.playerOf[winner ^ 1], 0.8, 300);
      }
    }
    results() {
      if (!this.counted) { this.counted = true; swapSides = !swapSides; }
      const r = this.result || { winner: -1, why: 'long' };
      return this.players.map((_, i) => {
        const s = this.sideOf[i];
        if (r.winner < 0) return { score: 1, text: `${SIDE_ICON[s]} Hòa` };
        return r.winner === s ? { score: 2, text: `${SIDE_ICON[s]} Thắng · ${WHY[r.why]}` } : { score: 0, text: `${SIDE_ICON[s]} Thua` };
      });
    }
    resultTitle() {
      const r = this.result || { winner: -1, why: 'long' };
      if (r.winner < 0) return `🤝 Hòa! <small>(${WHY[r.why]})</small>`;
      const p = this.players[this.playerOf[r.winner]];
      return `<span style="color:${p.color.light}">${p.name}</span> (${SIDE_NAME[r.winner]}) thắng — ${WHY[r.why]}!`;
    }

    /* ---------- vẽ ---------- */
    cardPos(side) {
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
      if (this.warn && !this.finished) {
        const a = Math.min(1, this.warn.t / 0.5);
        ctx.save(); ctx.globalAlpha = a;
        Draw.rr(ctx, BX + 20, BY + BH / 2 - 34, BW - 40, 68, 16); ctx.fillStyle = 'rgba(120,10,20,0.9)'; ctx.fill();
        Draw.text(ctx, `⚠️ ${SIDE_NAME[this.warn.side]} chiếu dài! Lặp lại lần nữa sẽ bị xử thua`, BX + BW / 2, BY + BH / 2, { size: 21, color: '#fff' });
        ctx.restore();
      }
      if (this.banner) {
        ctx.save(); ctx.translate(BX + BW / 2 - W / 2, 0);
        ctx.globalAlpha = this.finished ? 1 : Math.min(1, (1.4 - this.banner.age) / 0.3);
        Draw.banner(ctx, this.banner.text, this.banner.age, { size: this.banner.text.length > 12 ? 60 : 80, color: this.banner.color, y: BY + BH / 2 - 60 });
        ctx.restore();
      }
    }
    drawBoard(ctx) {
      const opt = this.api.opts || {}, th = THEMES[opt.board] || THEMES.wood, style = this.style();
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      Draw.rr(ctx, BX - 10, BY - 10, BW + 20, BH + 20, 16); ctx.fillStyle = th.frame; ctx.fill();
      ctx.restore();
      const bc = boardCanvas(opt.board || 'wood', style === 'han' ? 'han' : 'viet');
      ctx.drawImage(bc, BX, BY); // bàn đối xứng: lật bàn không cần xoay ảnh (số cột hai mép vẫn đúng)
      // nước vừa đi: góc vuông ở ô đi và ô đến
      const last = this.hist[this.hist.length - 1];
      const corners = (sq, col) => {
        const q = this.sqXY(sq), d = PR + 4, l = 10;
        ctx.strokeStyle = col; ctx.lineWidth = 3.5;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(q.x + sx * d, q.y + sy * (d - l)); ctx.lineTo(q.x + sx * d, q.y + sy * d); ctx.lineTo(q.x + sx * (d - l), q.y + sy * d); ctx.stroke();
        }
      };
      if (last) { corners(last.from, 'rgba(40,120,255,0.75)'); corners(last.to, 'rgba(40,120,255,0.95)'); }
      // tướng bị chiếu
      if (this.pos.inCheck() || (this.result && this.result.why === 'mate')) {
        const q = this.sqXY(this.pos.kings[this.pos.side]);
        const rg = ctx.createRadialGradient(q.x, q.y, 6, q.x, q.y, PR * 1.7);
        rg.addColorStop(0, 'rgba(255,40,40,0.95)'); rg.addColorStop(0.6, 'rgba(255,40,40,0.45)'); rg.addColorStop(1, 'rgba(255,40,40,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(q.x, q.y, PR * 1.7, 0, TAU); ctx.fill();
      }
      if (this.hover >= 0 && !this.players[this.active].bot && !this.finished) {
        const q = this.sqXY(this.hover);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, PR + 3, 0, TAU); ctx.stroke();
      }
      // quân
      const hide = this.anim ? this.anim.to : -1, dragSq = this.drag && this.drag.moved ? this.drag.sq : -1;
      for (const sq of XE.SQS) {
        const p = this.pos.b[sq];
        if (!p || sq === hide || sq === dragSq) continue;
        const q = this.sqXY(sq);
        if (sq === this.sel) { ctx.fillStyle = 'rgba(70,190,255,0.55)'; ctx.beginPath(); ctx.arc(q.x, q.y, PR + 7, 0, TAU); ctx.fill(); }
        this.drawPiece(ctx, p, q.x, q.y, sq === this.sel ? 1.08 : 1);
      }
      // ô đi được
      if (this.sel >= 0) {
        for (const m of this.movesFrom(this.sel)) {
          const t = XE.mTo(m), q = this.sqXY(t);
          if (this.pos.b[t]) { ctx.strokeStyle = 'rgba(220,30,30,0.85)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(q.x, q.y, PR + 3, 0, TAU); ctx.stroke(); }
          else { ctx.fillStyle = 'rgba(30,140,60,0.75)'; ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, TAU); ctx.fill(); }
        }
      }
      if (this.anim) {
        const a = this.anim, k = U.clamp(a.t / ANIM_T, 0, 1), e = 1 - (1 - k) * (1 - k);
        const p0 = this.sqXY(a.from), p1 = this.sqXY(a.to);
        this.drawPiece(ctx, a.piece, U.lerp(p0.x, p1.x, e), U.lerp(p0.y, p1.y, e), 1 + Math.sin(k * Math.PI) * 0.15);
      }
      const pi = this.active, pl = this.players[pi];
      if (!pl.bot && !this.finished) {
        const q = this.sqXY(this.cursor[pi]), pulse = Math.sin(this.t * 7) * 2;
        ctx.save(); ctx.strokeStyle = pl.color.main; ctx.lineWidth = 5; ctx.shadowColor = pl.color.main; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(q.x, q.y, PR + 6 + pulse, 0, TAU); ctx.stroke(); ctx.restore();
      }
      if (dragSq >= 0) this.drawPiece(ctx, this.pos.b[dragSq], this.drag.x, this.drag.y, 1.15);
    }
    drawPiece(ctx, p, x, y, s) {
      const c = pieceCanvas(p, this.style()), r = PR * s;
      ctx.drawImage(c, x - r * PS / (PS - 12), y - r * PS / (PS - 12), 2 * r * PS / (PS - 12), 2 * r * PS / (PS - 12));
    }
    drawPanel(ctx) {
      for (const side of [0, 1]) this.drawCard(ctx, side);
      const x = PX, y = LIST_Y, w = PW, h = LIST_H;
      Draw.rr(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
      Draw.text(ctx, '📜 Biên bản', x + 18, y + 22, { size: 18, align: 'left', color: 'rgba(255,255,255,0.8)', stroke: null });
      if (this.opening) Draw.text(ctx, `📖 ${this.opening}`, x + w - 16, y + 22, { size: 15, align: 'right', color: '#ffe14d', stroke: null });
      const rows = Math.ceil(this.hist.length / 2), per = 12, first = Math.max(0, rows - per);
      for (let r = first; r < rows; r++) {
        const yy = y + 54 + (r - first) * 24;
        Draw.text(ctx, `${r + 1}.`, x + 46, yy, { size: 17, align: 'right', color: 'rgba(255,255,255,0.5)', stroke: null });
        for (let c = 0; c < 2; c++) {
          const k = r * 2 + c, hm = this.hist[k];
          if (!hm) continue;
          const lastOne = k === this.hist.length - 1;
          if (lastOne) { Draw.rr(ctx, x + 58 + c * 150, yy - 11, 120, 22, 8); ctx.fillStyle = 'rgba(255,225,77,0.25)'; ctx.fill(); }
          Draw.text(ctx, hm.note + (hm.check ? ' +' : ''), x + 66 + c * 150, yy, { size: 18, align: 'left', color: lastOne ? '#ffe14d' : c ? '#e2dcf5' : '#ffb3ab', stroke: null });
        }
      }
      if (!this.hist.length) {
        Draw.text(ctx, 'Đỏ đi trước', x + w / 2, y + h / 2 - 14, { size: 20, color: 'rgba(255,255,255,0.45)', stroke: null });
        Draw.text(ctx, 'Ký hiệu: X = Xe, P = Pháo, M = Mã, T = Tượng, S = Sĩ, Tg = Tướng, B = Tốt', x + w / 2, y + h / 2 + 16, { size: 14, color: 'rgba(255,255,255,0.4)', stroke: null });
        Draw.text(ctx, '. tiến · / thoái · - bình (đi ngang)', x + w / 2, y + h / 2 + 38, { size: 14, color: 'rgba(255,255,255,0.4)', stroke: null });
      }
    }
    drawCard(ctx, side) {
      const q = this.cardPos(side), pi = this.playerOf[side], p = this.players[pi];
      const active = !this.finished && this.pos.side === side;
      BoardKit.card(ctx, q.x, q.y, PW, CARD_H, { active, color: p.color });
      Draw.blob(ctx, { x: q.x + 46, y: q.y + 50, r: 28, color: p.color, face: Math.PI / 2, shadow: false, crown: this.result && this.result.winner === side });
      Draw.text(ctx, p.name, q.x + 88, q.y + 34, { size: 26, align: 'left', color: p.color.light });
      const sub = `${SIDE_ICON[side]} ${SIDE_NAME[side]}${p.bot ? ` · 🤖 Máy ${BOT_LEVELS[this.levelOf(side)].name}` : ''}`;
      Draw.text(ctx, sub, q.x + 88, q.y + 64, { size: 17, align: 'left', color: 'rgba(255,255,255,0.8)', stroke: null });
      const caps = this.capt[side].slice().sort((a, b) => VAL[b & 7] - VAL[a & 7]);
      caps.forEach((c, k) => { if (k < 14) this.drawPiece(ctx, c, q.x + 98 + k * 20, q.y + 96, 0.4); });
      const val = (s) => this.capt[s].reduce((a, c) => a + VAL[c & 7], 0);
      const diff = val(side) - val(side ^ 1);
      if (diff > 0) Draw.text(ctx, `+${String(diff).replace('.', ',')}`, q.x + 98 + Math.min(14, caps.length) * 20 + 4, q.y + 96, { size: 17, align: 'left', color: '#5dff9b', stroke: null });
      if (this.clock.on) {
        const left = this.clock.left[side];
        BoardKit.clockBox(ctx, q.x + PW - 150, q.y + 16, 134, 50, left, active && this.hist.length > 0, left < 20);
      }
      const ty = q.y + (this.clock.on ? 92 : 40);
      if (active && p.bot) Draw.text(ctx, `🤔 đang nghĩ${'.'.repeat(1 + Math.floor(this.t * 3) % 3)}`, q.x + PW - 16, ty, { size: 17, align: 'right', color: '#ffe14d', stroke: null });
      else if (active) Draw.text(ctx, this.pos.inCheck() ? '⚠️ đang bị chiếu!' : '👉 tới lượt', q.x + PW - 16, ty, { size: 17, align: 'right', color: this.pos.inCheck() ? '#ff8a8a' : '#ffe14d', stroke: null });
    }
  }

  Party.register({
    id: 'xiangqi', name: 'Cờ Tướng', emoji: '🀄', cat: 'board',
    tagline: 'Cờ tướng đủ luật, chữ Hán / chữ Việt / hình. Đấu bạn bè hoặc máy 3 mức.',
    how: 'Chiếu bí Tướng đối phương để thắng (đối phương hết nước đi cũng thắng). Đủ luật: cản chân Mã, cản mắt Tượng, Pháo ăn cách một quân, Tốt qua sông được đi ngang, hai Tướng không được đối mặt. Chiếu dài (cứ chiếu mãi làm lặp thế cờ) bị xử thua; lặp thế thường thì hòa. Đỏ đi trước, ván sau tự đổi màu quân.',
    controls: { move: 'Di ô chọn', act: 'Chọn / Đi', jump: 'Bỏ chọn' },
    helpExtra: '🖱️ chuột: bấm hoặc kéo thả quân',
    minPlayers: 2, maxPlayers: 2, rawBot: true,
    variants: BoardKit.TIME_CONTROLS,
    options: [
      { id: 'script', label: 'Mặt quân', items: [
        { id: 'han', name: 'Chữ Hán', icon: '帥', desc: 'Quân khắc chữ Hán truyền thống (帥 仕 相 車 馬 炮 兵)' },
        { id: 'viet', name: 'Chữ Việt', icon: '🇻🇳', desc: 'Tướng, Sĩ, Tượng, Xe, Mã, Pháo, Tốt' },
        { id: 'icon', name: 'Hình', icon: '🐴', desc: 'Hình vẽ cho người mới: 👑 Tướng 🛡️ Sĩ 🐘 Tượng 🛞 Xe 🐴 Mã 💥 Pháo 🪖 Tốt' }] },
      { id: 'board', label: 'Bàn cờ', items: [
        { id: 'wood', name: 'Gỗ', icon: '🪵', desc: 'Bàn gỗ vân' },
        { id: 'paper', name: 'Giấy đỏ', icon: '📜', desc: 'Bàn giấy kẻ đỏ kiểu cờ chợ' },
        { id: 'jade', name: 'Ngọc', icon: '🟢', desc: 'Bàn xanh ngọc' }] },
    ],
    create: (api) => new Xiangqi(api),
  });
})();

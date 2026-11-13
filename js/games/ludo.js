// Cờ Cá Ngựa 3D — vòng chơi, máy, giao diện 2D chồng lên cảnh 3D (ludo3d.js), luật ở ludo_rules.js
(() => {
  'use strict';
  const R = window.LudoRules;
  const HUE = [
    { css: '#e8433b', dark: '#a8241e', soft: '#fde3df', name: 'Đỏ' },
    { css: '#2f7fe0', dark: '#1b4f9a', soft: '#dceafd', name: 'Xanh dương' },
    { css: '#2fae55', dark: '#1d7336', soft: '#dcf3e2', name: 'Xanh lá' },
    { css: '#f3b51b', dark: '#9a6c04', soft: '#fdf1cf', name: 'Vàng' },
  ];
  const FONT = '"Baloo 2", "Segoe UI", system-ui, sans-serif';

  // bố cục 2D (1280×720): bàn 3D ở giữa, cột trái = người chơi + nhật ký, cột phải = khay xúc xắc + nước đi + phím
  const LX = 10, LW = 232, RX = 1038, RW = 232;
  const TRAY = { x: RX, y: 10, w: RW, h: 150 };
  const CARD_H = 96, CARD_GAP = 8;
  const ACT_Y = 172;                              // bảng hành động (đổ / chọn nước)

  // nhịp chơi (giây, × speed) — thong thả như Cờ Tỷ Phú
  const DICE_ROLL = 1.0, DICE_HOLD = 0.9, HOP_T = 0.36, HOP_AIR = 0.7, LAND_PAUSE = 0.35;
  const KICK_T = 1.1, BOT_THINK = [0.9, 1.5], AUTO_T = 1.0, NOMOVE_T = 1.6, TURN_FX_T = 1.6;

  /** đọc tuỳ chọn luật từ api.opts (đọc lúc bắt đầu ván — app không tạo lại instance khi đổi tuỳ chọn) */
  function rulesFrom(opts) {
    const o = Object.assign({}, R.DEFAULTS);
    const g = (k, d) => (opts && opts[k]) || d;
    o.dice = g('dice', '2') === '1' ? 1 : 2;
    const ex = g('exit', 'std');
    o.exit = o.dice === 1 ? (ex === 'loose' ? 'one6' : 'six') : (ex === 'loose' ? 'six' : 'pair16');
    o.jump = g('jump', 'no') === 'yes';
    o.entry = g('entry', 'straight');
    o.win = g('win', 'top4');
    o.rank = g('rank', 'yes') === 'yes';
    return o;
  }

  /* ---------- bàn 2D dự phòng (máy không có WebGL) ---------- */
  class View2D {
    constructor() { this.cell = 40; this.cx = 640; this.cy = 368; this.items = []; this.ghosts = []; this.rings = []; this.dice = [null, null]; }
    spot(k, p, h) {
      if (p < 0) { const [r, c] = R.YARD_RC[k], o = [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]][h]; return { x: c - 7 + o[0], y: 0, z: r - 7 + o[1] }; }
      if (p <= R.GATE) { const [r, c] = R.RING_RC[(R.START[k] + p) % R.RING]; return { x: c - 7, y: 0.14, z: r - 7 }; }
      const [r, c] = R.HOME_RC[k][p - R.GATE - 1]; return { x: c - 7, y: 0.14, z: r - 7 };
    }
    project(x, y, z) { return { x: this.cx + x * this.cell, y: this.cy + z * this.cell - y * this.cell * 0.6, front: true }; }
    groundAt(px, py) { return { x: (px - this.cx) / this.cell, z: (py - this.cy) / this.cell }; }
    placeHorse(k, h, o) { this.items[k * 4 + h] = Object.assign({ k }, o); }
    setRing(k, o) { this.rings[k] = o; }
    setGhosts(list) { this.ghosts = list; }
    placeDie(k, o) { this.dice[k] = o; }
    setTray() {}
    showCup() {}
    resetView() {}
    render(ctx) {
      const c = this.cell, X = (col) => this.cx + (col - 7) * c, Y = (row) => this.cy + (row - 7) * c;
      ctx.fillStyle = '#d8efe0'; ctx.fillRect(0, 0, 1280, 720);
      Draw.rr(ctx, X(-1.1), Y(-1.1), c * 16.2, c * 16.2, 18); ctx.fillStyle = '#c98a4b'; ctx.fill();
      ctx.fillStyle = '#fbf5e6'; ctx.fillRect(X(-0.5), Y(-0.5), c * 15, c * 15);
      R.YARD_RC.forEach(([r, cc], k) => { Draw.rr(ctx, X(cc - 2.85), Y(r - 2.85), c * 5.7, c * 5.7, 14); ctx.fillStyle = HUE[k].soft; ctx.fill(); });
      const tile = (r, cc, col, txt) => { Draw.rr(ctx, X(cc) - c * 0.45, Y(r) - c * 0.45, c * 0.9, c * 0.9, 6); ctx.fillStyle = col; ctx.fill(); if (txt) Draw.text(ctx, txt, X(cc), Y(r) + 1, { size: 16, color: '#fff', stroke: null }); };
      R.RING_RC.forEach(([r, cc], i) => { const s = R.START.indexOf(i); tile(r, cc, s >= 0 ? HUE[s].css : '#ffffff', s >= 0 ? '➜' : ''); });
      R.HOME_RC.forEach((cells, k) => cells.forEach(([r, cc], j) => tile(r, cc, HUE[k].css, String(j + 1))));
      for (const g of this.ghosts) { if (!g) continue; const q = this.project(g.x, 0, g.z); ctx.globalAlpha = g.alpha ?? 0.4; ctx.beginPath(); ctx.arc(q.x, q.y, c * 0.34, 0, Math.PI * 2); ctx.fillStyle = HUE[g.color].css; ctx.fill(); ctx.globalAlpha = 1; }
      for (const r of this.rings) { if (!r) continue; const q = this.project(r.x, 0, r.z); ctx.beginPath(); ctx.arc(q.x, q.y, c * 0.46 * (r.scale || 1), 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = typeof r.color === 'string' ? r.color : '#ffe14d'; ctx.stroke(); }
      for (const it of this.items) {
        if (!it || it.hide) continue;
        const q = this.project(it.x, it.y, it.z);
        ctx.beginPath(); ctx.arc(q.x, q.y, c * 0.34, 0, Math.PI * 2); ctx.fillStyle = HUE[it.k].css; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = HUE[it.k].dark; ctx.stroke();
        Draw.text(ctx, '♞', q.x, q.y + 1, { size: 20, color: '#fff', stroke: null });
      }
    }
  }

  class Ludo {
    constructor(api) {
      this.api = api;
      this.players = api.players;
      this.n = this.players.length;
      this.humans = this.players.filter((p) => !p.bot).length;
      // màu ngựa: chia ngẫu nhiên như ngoài đời; 2 người ngồi đối diện
      const base = R.colorsFor(this.n), rot = Math.floor(Math.random() * 4);
      this.colors = this.n === 2 ? [rot % 4, (rot + 2) % 4] : this.n === 4 ? U.shuffle([0, 1, 2, 3]) : base.map((c) => (c + rot) % 4);
      this.st = R.newState(this.colors);
      this.t = 0;
      this.finished = false;
      this.ownEndBanner = true;
      this.ownHelp = true;
      this.log = [];
      this.order = [];             // thứ tự về đích
      this.anim = new Map();       // ngựa đang bay: key 'pl:h' → {path, t, dur, kick}
      this.btns = [];
      this.ptr = null; this.press = null; this.drag = null;
      this.turnFx = null; this.turnFxSeen = false;
      this.stats = this.players.map(() => ({ kicks: 0, kicked: 0, doubles: 0 }));
      this.cur = Math.floor(Math.random() * this.n);
      this.k = { k: 'start', t: 0 };        // máy trạng thái lượt
      this.dice = [6, 6];
      this.prevIn = this.players.map(() => ({ x: 0, y: 0 }));
      this.diceAnim = this.restDice([6, 6]);
      // cảnh 3D dùng chung (hoặc bàn 2D khi không có WebGL)
      this.use3d = !!(window.Ludo3D && window.Ludo3D.available());
      try { this.view = this.use3d ? window.Ludo3D.shared() : new View2D(); } catch (e) { this.use3d = false; this.view = new View2D(); }
      this.view.setTray && this.view.setTray(TRAY);
      if (this.view.resetView) this.view.resetView();
      this.layoutAll(true);
    }

    /* ---------- tiện ích ---------- */
    get o() { return this.rules || rulesFrom(this.api.opts); }
    get speed() { return !this.humans ? 0.03 : (this.api.opts && this.api.opts.speed === 'fast') ? 0.5 : 1; }
    level(i) { return this.players[i].level || 'normal'; }
    name(i) { return this.players[i].name; }
    hue(i) { return HUE[this.colors[i]]; }
    say(s) { this.log.push(s); if (this.log.length > 40) this.log.shift(); }
    setK(o) { this.k = Object.assign({ t: 0 }, o); }
    active() { return [...Array(this.n).keys()].filter((i) => !this.order.includes(i)); }

    /* ---------- bắt đầu ---------- */
    begin() {
      this.rules = rulesFrom(this.api.opts);
      const o = this.rules;
      this.say(`🐴 Bắt đầu! ${o.dice === 2 ? '2 xúc xắc' : '1 xúc xắc'} · xuất chuồng khi ${o.dice === 2 ? (o.exit === 'pair16' ? 'đổ đôi hoặc 1+6' : 'đổ đôi hoặc có con 6') : (o.exit === 'one6' ? 'ra 1 hoặc 6' : 'ra 6')}`);
      this.players.forEach((p, i) => this.say(`• ${p.name}: ngựa ${this.hue(i).name}`));
      this.diceAnim = this.restDice(o.dice === 1 ? [6] : [6, 6]);
      this.startTurn();
    }
    startTurn() {
      if (this.finished) return;
      this.bonus = 0;
      this.pool = null;
      this.say(`▶ Lượt của ${this.name(this.cur)}`);
      if (this.humans) { this.turnFx = { i: this.cur, t: this.turnFxSeen ? 0 : -1.0 }; this.turnFxSeen = true; }
      this.setK({ k: 'roll' });
    }
    /** xúc xắc nằm yên trong khay (trước lần đổ đầu) */
    restDice(vals) { return vals.map((v, k) => ({ x0: 0, z0: 0, x1: vals.length === 1 ? 0 : (k ? 0.75 : -0.75), z1: 0.1, yaw: k ? 0.3 : -0.2, spin: 0, v })); }
    roll() {
      const o = this.o;
      this.dice = o.dice === 1 ? [U.randi(1, 6)] : [U.randi(1, 6), U.randi(1, 6)];
      Sfx.play('pull');
      // đường bay xúc xắc trong khay: từ mép trái lăn vào, nảy 2 lần rồi nằm đúng mặt
      this.diceAnim = this.dice.map((v, k) => ({
        x0: -2.2 + Math.random() * 0.3, z0: -0.6 + k * 0.9 + Math.random() * 0.3,
        x1: this.dice.length === 1 ? 0 : (k ? 0.75 : -0.75) + (Math.random() - 0.5) * 0.25, z1: 0.1 + (Math.random() - 0.5) * 0.5,
        yaw: (Math.random() - 0.5) * 0.8, spin: 3 + Math.random() * 3, v,
      }));
      const r = DICE_ROLL * this.speed + 0.05;
      this.setK({ k: 'dice', roll: r, dur: r + (this.humans ? DICE_HOLD * this.speed : 0) });
    }
    afterRoll() {
      const o = this.o, d = this.dice, i = this.cur;
      const bonus = R.isBonus(d, o);
      if (d.length === 2 && d[0] === d[1]) this.stats[i].doubles++;
      this.say(`🎲 ${this.name(i)} đổ ${d.join(' + ')}${d.length === 2 ? ` = ${d[0] + d[1]}` : ''}${bonus ? (d.length === 2 && d[0] === d[1] ? ' — đôi!' : ' — được đổ tiếp!') : ''}`);
      if (bonus) {
        this.bonus++;
        if (o.triple && this.bonus >= 3) { this.say(`⛔ ${this.name(i)} thưởng 3 lần liền — mất lượt`); this.setK({ k: 'wait', dur: NOMOVE_T * this.speed + 0.1, done: () => this.endTurn(false) }); return; }
      }
      this.again = bonus;
      this.pool = o.split && d.length === 2 ? [0, 1] : null;
      this.toPick();
    }
    toPick() {
      const i = this.cur;
      const moves = R.legalMoves(this.st, this.o, i, this.dice, this.pool);
      // sắp nước: theo ngựa rồi theo điểm đến (để ← → đi lần lượt)
      moves.sort((a, b) => a.h - b.h || a.to - b.to);
      if (!moves.length) {
        this.say(`😶 ${this.name(i)} không có nước đi`);
        this.setK({ k: 'wait', dur: NOMOVE_T * this.speed + 0.1, done: () => this.endRoll() });
        return;
      }
      let sel = 0;
      if (this.players[i].bot) { const m = R.botPick(this.st, this.o, moves, this.level(i)); sel = Math.max(0, moves.indexOf(m)); }
      this.setK({ k: 'pick', moves, sel, auto: moves.length === 1 });
    }
    /** đi nước m (bắt đầu hoạt cảnh) */
    play(m) {
      const i = this.cur, o = this.o;
      const path = [];
      if (m.kind === 'exit') path.push(-1, 0);
      else if (m.kind === 'climb' && o.entry !== 'count') path.push(m.from, m.to);
      else for (let p = m.from; p <= m.to; p++) path.push(p);
      this.setK({ k: 'move', m, path, step: 0, began: false, landT: -1 });
      Sfx.play('select');
    }
    stepMove(dt) {
      const s = this.k, m = s.m, i = this.cur;
      const hop = HOP_T * this.speed + 0.01;
      if (!s.began) { s.began = true; s.t = hop; }
      if (s.step >= s.path.length - 1) {
        // bước cuối: chạm đất rồi mới tính đá / vào chuồng
        if (s.landT < 0) {
          if (this.hop && this.hop.t < this.hop.air) return;
          s.landT = 0;
          this.landed(m);
        }
        s.landT += dt;
        if (s.landT >= LAND_PAUSE * this.speed + (m.kick ? KICK_T * this.speed * 0.6 : 0)) this.afterMove(m);
        return;
      }
      if (s.t < hop) return;
      s.t -= hop;
      const from = s.path[s.step], to = s.path[s.step + 1];
      s.step++;
      this.hop = { i, h: m.h, from, to, t: 0, dur: hop, air: hop * HOP_AIR };
      Sfx.tone(420 + (s.step % 4) * 50, 0.05, 'triangle', 0.05);
    }
    landed(m) {
      // cập nhật thế cờ khi chạm ô cuối; ngựa bị đá bay về chuồng
      const i = this.cur;
      this.st = R.apply(this.st, m);
      if (m.kick) {
        const v = m.kick;
        this.stats[i].kicks++; this.stats[v.pl].kicked++;
        this.say(`💥 ${this.name(i)} đá ngựa ${this.hue(v.pl).name} của ${this.name(v.pl)} về chuồng!`);
        this.kickAnim = { pl: v.pl, h: v.h, from: this.worldOf(v.pl, this.relTo(v.pl, i, m.to), v.h), t: 0, dur: KICK_T * Math.max(0.35, this.speed) };
        Sfx.play('kick'); FX.shake(5);
        if (Party.rumble) Party.rumble(v.pl, 0.6, 250);
      } else if (m.to > R.GATE && m.from <= R.GATE) { this.say(`🏁 ${this.name(i)} đưa ngựa vào chuồng — bậc ${m.to - R.GATE}`); Sfx.play('pickup'); }
      else if (m.kind === 'climb') { this.say(`⬆️ ${this.name(i)} lên bậc ${m.to - R.GATE}`); Sfx.play('pickup'); }
      else if (m.kind === 'exit') { this.say(`🐎 ${this.name(i)} xuất chuồng`); Sfx.play('jump'); }
      else Sfx.play('place');
    }
    /** ô của ngựa người j tương ứng tiến độ p của người i (dùng khi đá: vị trí trên vòng là chung) */
    relTo(j, i, pI) {
      const cell = R.cellOf(this.colors[i], pI);
      return (cell - R.START[this.colors[j]] + R.RING) % R.RING;
    }
    afterMove(m) {
      const i = this.cur, o = this.o;
      this.hop = null;
      if (R.hasWon(this.st, o, i) && !this.order.includes(i)) {
        this.order.push(i);
        this.say(`🏆 ${this.name(i)} về ${['nhất', 'nhì', 'ba'][this.order.length - 1] || 'đích'}!`);
        Sfx.play('win');
        const act = this.active();
        if (!o.rank || act.length <= 1) { act.forEach((j) => this.order.includes(j) || this.order.push(j)); this.finish(); return; }
        this.endTurn(false);
        return;
      }
      // tách 2 con: còn xúc xắc chưa dùng thì đi tiếp
      if (this.pool && m.use !== 'all') {
        this.pool = this.pool.filter((k) => k !== m.use);
        if (this.pool.length) { this.toPick(); return; }
      }
      this.endRoll();
    }
    endRoll() { this.endTurn(this.again); }
    endTurn(again) {
      if (this.finished) return;
      if (again && !this.order.includes(this.cur)) { this.again = false; this.setK({ k: 'roll' }); return; }
      const n = this.n;
      let c = this.cur;
      for (let k = 0; k < n; k++) { c = (c + 1) % n; if (!this.order.includes(c)) break; }
      this.cur = c;
      this.startTurn();
    }
    finish() {
      this.finished = true;
      this.setK({ k: 'over' });
      this.winT = 0;
    }
    results() {
      return this.players.map((p, i) => {
        const r = this.order.indexOf(i);
        const prog = R.progress(this.st, i);
        const home = this.st.horses[i].filter((x) => x > R.GATE).length;
        return { score: r >= 0 ? 1000 - r * 100 : prog, text: r >= 0 ? `Về ${['nhất', 'nhì', 'ba', 'tư'][r]} 🏁` : `${home}/4 ngựa trong chuồng đích` };
      });
    }

    /* ---------- vòng cập nhật ---------- */
    update(dt, inputs) {
      this.t += dt;
      if (this.press) { this.press.t += dt; if (this.press.t > 0.3) this.press = null; }
      if (this.turnFx) { this.turnFx.t += dt; if (this.turnFx.t > TURN_FX_T) this.turnFx = null; }
      if (this.hop) this.hop.t += dt;
      if (this.kickAnim) { this.kickAnim.t += dt; if (this.kickAnim.t >= this.kickAnim.dur) this.kickAnim = null; }
      if (this.finished) { this.winT += dt; return; }
      const s = this.k;
      s.t += dt;
      const i = this.cur, bot = this.players[i].bot, inp = (inputs && inputs[i]) || {};
      switch (s.k) {
        case 'start': this.begin(); return;
        case 'roll':
          if (bot) { if (s.t >= U.rand(BOT_THINK[0], BOT_THINK[1]) * this.speed) this.roll(); return; }
          if (inp.actP) { this.pressFx(this.rollBtn); this.roll(); }
          return;
        case 'dice':
          if (!s.landed && s.t >= s.roll) { s.landed = true; Sfx.play('place'); if (R.isBonus(this.dice, this.o)) Sfx.play('pickup'); }
          if (s.t >= s.dur) this.afterRoll();
          return;
        case 'pick': {
          const auto = s.auto ? AUTO_T * this.speed : bot ? U.rand(BOT_THINK[0], BOT_THINK[1]) * this.speed : -1;
          if (auto >= 0) { if (s.t >= (s.wait || (s.wait = auto))) this.play(s.moves[s.sel]); return; }
          // người: ← → (hoặc ↑ ↓) đổi nước, Đánh = đi
          const pv = this.prevIn[i], dx = Math.abs(inp.mx || 0) > 0.5 ? Math.sign(inp.mx) : 0, dy = Math.abs(inp.my || 0) > 0.5 ? Math.sign(inp.my) : 0;
          const step = (dx && dx !== pv.x ? dx : 0) || (dy && dy !== pv.y ? dy : 0);
          pv.x = dx; pv.y = dy;
          if (step) { s.sel = (s.sel + step + s.moves.length) % s.moves.length; Sfx.play('move'); }
          if (inp.actP) { this.pressFx(this.selRect); this.play(s.moves[s.sel]); }
          return;
        }
        case 'move': this.stepMove(dt); return;
        case 'wait': if (s.t >= s.dur) s.done(); return;
      }
    }
    botInput() { return {}; }

    /* ---------- vị trí ngựa (toạ độ thế giới) ---------- */
    worldOf(pl, p, h) {
      const k = this.colors[pl];
      return this.view.spot(k, p, h);
    }
    yawAt(pl, p) {
      const k = this.colors[pl];
      if (p < 0) return [0, -Math.PI / 2, Math.PI, Math.PI / 2][k];
      const a = this.view.spot(k, p, 0), b = this.view.spot(k, Math.min(p + 1, R.GATE + 6), 0);
      if (p >= R.GATE + 6) { const c = this.view.spot(k, p - 1, 0); return Math.atan2(-(a.z - c.z), a.x - c.x); }
      return Math.atan2(-(b.z - a.z), b.x - a.x);
    }
    horsePose(pl, h) {
      const p = this.st.horses[pl][h];
      // đang nhảy từng ô
      const hp = this.hop;
      if (hp && hp.i === pl && hp.h === h) {
        const a = this.worldOf(pl, hp.from, h), b = this.worldOf(pl, hp.to, h);
        const k = U.clamp(hp.t / hp.air, 0, 1), e = 0.5 - 0.5 * Math.cos(k * Math.PI);
        const land = hp.t > hp.air ? (hp.t - hp.air) / Math.max(0.05, Math.min(0.18, hp.dur - hp.air)) : -1;
        const sq = land >= 0 && land < 1 ? 0.18 * Math.sin(land * Math.PI) : (k < 1 ? -0.06 * Math.sin(k * Math.PI) : 0);
        const arc = hp.from < 0 ? 1.4 : 0.55;
        return { x: U.lerp(a.x, b.x, e), y: U.lerp(a.y, b.y, e) + Math.sin(k * Math.PI) * arc, z: U.lerp(a.z, b.z, e), yaw: Math.atan2(-(b.z - a.z), b.x - a.x) || this.yawAt(pl, hp.to), sq };
      }
      // đang đi nhưng chưa tới bước kế: đứng ở ô của bước hiện tại
      const s = this.k;
      if (s.k === 'move' && pl === this.cur && s.m.h === h && s.landT < 0) {
        const pp = s.path[s.step];
        return Object.assign(this.worldOf(pl, pp, h), { yaw: this.yawAt(pl, pp) });
      }
      // bị đá: bay xoáy về chuồng
      const ka = this.kickAnim;
      if (ka && ka.pl === pl && ka.h === h) {
        const b = this.worldOf(pl, -1, h), k = U.clamp(ka.t / ka.dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        return { x: U.lerp(ka.from.x, b.x, e), y: U.lerp(ka.from.y, b.y, e) + Math.sin(k * Math.PI) * 3.2, z: U.lerp(ka.from.z, b.z, e), yaw: k * 14, tilt: Math.sin(k * Math.PI) * 0.6 };
      }
      return Object.assign(this.worldOf(pl, p, h), { yaw: this.yawAt(pl, p) });
    }
    layoutAll() {
      const v = this.view;
      for (let k = 0; k < 4; k++) for (let h = 0; h < 4; h++) v.placeHorse(k, h, { x: 0, y: 0, z: 0, hide: true });
      this.players.forEach((_, pl) => {
        for (let h = 0; h < 4; h++) {
          const q = this.horsePose(pl, h);
          // ngựa đang đến lượt nhún nhẹ khi chờ đổ / chọn
          let y = q.y;
          const mine = !this.finished && pl === this.cur && ['roll', 'pick'].includes(this.k.k);
          if (mine && !this.anim.size) y += Math.abs(Math.sin(this.t * 3 + h)) * 0.06;
          v.placeHorse(this.colors[pl], h, Object.assign({}, q, { y }));
        }
      });
      // vòng sáng + ngựa mờ ở điểm đến
      const s = this.k, rings = [], ghosts = [];
      if (s.k === 'pick' && !this.finished) {
        const pl = this.cur, k = this.colors[pl];
        s.moves.forEach((m, idx) => {
          const on = idx === s.sel;
          const tg = this.worldOf(pl, m.to, m.h);
          ghosts.push(Object.assign({}, tg, { color: k, yaw: this.yawAt(pl, m.to), alpha: on ? 0.55 : 0.25, lift: on ? 0.08 + Math.abs(Math.sin(this.t * 4)) * 0.08 : 0 }));
          if (on) {
            const fr = this.horsePose(pl, m.h);
            rings.push({ x: fr.x, y: fr.y, z: fr.z, color: 0xffe14d, scale: 1 + Math.sin(this.t * 6) * 0.06 });
            rings.push({ x: tg.x, y: tg.y, z: tg.z, color: m.kick ? 0xff3b30 : 0xffe14d, scale: 1.1 });
          }
        });
      } else if (!this.finished && (s.k === 'roll' || s.k === 'dice')) {
        // đến lượt: vòng sáng dưới mọi ngựa của người đó ở ngoài chuồng
        const pl = this.cur;
        this.st.horses[pl].forEach((p, h) => { if (p >= 0 && rings.length < 4) { const q = this.horsePose(pl, h); rings.push({ x: q.x, y: q.y, z: q.z, color: 0xfff3a0, alpha: 0.5 + 0.3 * Math.sin(this.t * 5), scale: 0.95 }); } });
      }
      for (let k = 0; k < 6; k++) v.setRing(k, rings[k] || null);
      v.setGhosts(ghosts);
      // xúc xắc trong khay
      const da = this.diceAnim, dk = this.k;
      for (let k = 0; k < 2; k++) {
        const a = da && da[k];
        if (!a) { v.placeDie(k, null); continue; }
        const T = dk.k === 'dice' ? dk.t : 99, rollT = dk.k === 'dice' ? dk.roll : 1;
        const u = U.clamp(T / rollT, 0, 1);
        // bay vào + 2 lần nảy
        const x = U.lerp(a.x0, a.x1, 1 - Math.pow(1 - u, 2)), z = U.lerp(a.z0, a.z1, 1 - Math.pow(1 - u, 2));
        const bounce = u < 0.45 ? Math.sin(u / 0.45 * Math.PI) * 1.2 : u < 0.75 ? Math.sin((u - 0.45) / 0.3 * Math.PI) * 0.4 : u < 0.9 ? Math.sin((u - 0.75) / 0.15 * Math.PI) * 0.1 : 0;
        const qEnd = v.diceQuat ? v.diceQuat(a.v, a.yaw) : null;
        let q = qEnd;
        if (v.randomQuat && u < 1) { const qr = v.randomQuat(a.spin * (1 - u) * 2 + k); q = qr.clone().slerp(qEnd, Math.pow(u, 3)); }
        v.placeDie(k, { x, y: 0.45 + bounce, z, q, v: a.v });
      }
      if (v.showCup) v.showCup(this.finished ? Math.min(1.4, this.winT * 1.5) : 0);
    }

    /* ---------- chuột ---------- */
    btnAt() {
      const q = this.ptr;
      if (!q) return null;
      return this.btns.find((r) => q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) || null;
    }
    pressFx(r) { if (r) this.press = { x: r.x, y: r.y, w: r.w, h: r.h, t: 0 }; }
    human() { const c = this.cur; return !this.finished && !this.players[c].bot; }
    /** nước gần con trỏ nhất (điểm đến hoặc ngựa đang đứng), trong 46px */
    moveAt(x, y) {
      const s = this.k;
      if (s.k !== 'pick') return -1;
      let best = -1, bd = 46 * 46;
      s.moves.forEach((m, idx) => {
        for (const p of [m.to, m.from]) {
          const w = this.worldOf(this.cur, p, m.h), q = this.view.project(w.x, w.y + 0.4, w.z);
          const d = (q.x - x) ** 2 + (q.y - y) ** 2;
          if (d < bd) { bd = d; best = idx; }
          if (p === m.from) break;
        }
      });
      return best;
    }
    onPointer(x, y, type) {
      this.ptr = { x, y };
      const b = this.btnAt(), s = this.k;
      if (type === 'move') {
        if (this.drag && this.use3d) {
          const v = this.view.view; v.yaw -= (x - this.drag.x) * 0.006; v.pitch = U.clamp(v.pitch + (y - this.drag.y) * 0.004, 0.55, 1.45);
          this.view.applyView(); this.drag = { x, y }; return;
        }
        if (b && b.sel !== undefined && s.k === 'pick' && this.human() && s.sel !== b.sel) { s.sel = b.sel; Sfx.play('move', 0.05); }
        else if (!b && this.human() && s.k === 'pick') { const m = this.moveAt(x, y); if (m >= 0 && m !== s.sel) { s.sel = m; Sfx.play('move', 0.05); } }
        return;
      }
      if (type === 'up') { this.drag = null; return; }
      if (type !== 'down') return;
      if (b) {
        if (b.dis) { Sfx.tone(180, 0.08, 'square', 0.06); return; }
        Sfx.play('select'); this.pressFx(b); b.fn(); return;
      }
      if (this.human() && s.k === 'pick') { const m = this.moveAt(x, y); if (m >= 0) { s.sel = m; this.play(s.moves[m]); return; } }
      if (this.human() && s.k === 'roll' && x > TRAY.x && y < TRAY.y + TRAY.h) { this.roll(); return; }
      // kéo trên bàn để xoay
      if (x > LX + LW && x < RX) this.drag = { x, y };
    }

    /* ---------- vẽ ---------- */
    draw(ctx) {
      this.layoutAll();
      if (this.use3d) { ctx.clearRect(0, 0, W, H); this.view.render(this.api.opts && this.api.opts.quality === 'low'); }
      else this.view.render(ctx);
      this.btns = [];
      this.drawLabels(ctx);
      this.drawPlayers(ctx);
      this.drawRight(ctx);
      this.drawButtonFx(ctx);
      this.drawTurnFx(ctx);
      if (this.finished) this.drawWin(ctx);
    }
    fit(ctx, str, x, y, maxW, size, min, weight, color, align = 'left') {
      let fs = size;
      ctx.font = `${weight} ${fs}px ${FONT}`;
      while (fs > min && ctx.measureText(str).width > maxW) { fs -= 0.5; ctx.font = `${weight} ${fs}px ${FONT}`; }
      ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(str, x, y);
    }
    panel(ctx, x, y, w, h, fill = 'rgba(255,255,255,0.9)', stroke = 'rgba(43,58,51,0.2)') {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      Draw.rr(ctx, x, y, w, h, 14); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
      Draw.rr(ctx, x, y, w, h, 14); ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
    }
    /** nhãn nổi trên điểm đến: "② 7 → bậc 2" / "ĐÁ!" */
    drawLabels(ctx) {
      const s = this.k;
      if (s.k !== 'pick' || this.finished) return;
      const pl = this.cur;
      s.moves.forEach((m, idx) => {
        const w = this.worldOf(pl, m.to, m.h), q = this.view.project(w.x, w.y + 1.25, w.z);
        const on = idx === s.sel, txt = `${idx + 1} · ${m.tag}`;
        ctx.font = `800 ${on ? 17 : 14}px ${FONT}`;
        const tw = ctx.measureText(txt).width + 18, th = on ? 30 : 24;
        ctx.globalAlpha = on ? 1 : 0.85;
        Draw.rr(ctx, q.x - tw / 2, q.y - th / 2, tw, th, th / 2);
        ctx.fillStyle = m.kick ? '#e5322b' : on ? '#ffe14d' : '#ffffff'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = m.kick ? '#7a120e' : this.hue(pl).dark; ctx.stroke();
        Draw.text(ctx, txt, q.x, q.y + 1, { size: on ? 17 : 14, color: m.kick ? '#fff' : '#1d2b25', stroke: null, weight: 800 });
        ctx.globalAlpha = 1;
      });
    }
    /** cột trái: thẻ người chơi + nhật ký */
    drawPlayers(ctx) {
      this.players.forEach((p, i) => {
        const x = LX, y = 10 + i * (CARD_H + CARD_GAP), hu = this.hue(i), active = !this.finished && i === this.cur;
        ctx.save();
        if (active) { ctx.shadowColor = hu.css; ctx.shadowBlur = 18; }
        Draw.rr(ctx, x, y, LW, CARD_H, 14); ctx.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,0.86)'; ctx.fill();
        ctx.restore();
        Draw.rr(ctx, x, y, LW, CARD_H, 14); ctx.lineWidth = active ? 4 + 1.5 * Math.sin(this.t * 6) : 2; ctx.strokeStyle = active ? hu.css : 'rgba(43,58,51,0.25)'; ctx.stroke();
        ctx.save(); Draw.rr(ctx, x, y, LW, CARD_H, 14); ctx.clip(); ctx.fillStyle = hu.css; ctx.fillRect(x, y, 8, CARD_H); ctx.restore();
        Draw.blob(ctx, { x: x + 34, y: y + 32, r: 19, color: p.color, face: Math.PI / 2, shadow: false });
        this.fit(ctx, p.name + (p.bot ? ` 🤖 ${BOT_LEVELS[this.level(i)].name}` : ''), x + 60, y + 20, LW - (active ? 150 : 70), 17, 11, 800, p.color.dark);
        this.fit(ctx, `Ngựa ${hu.name}`, x + 60, y + 42, LW - 70, 13, 10, 700, hu.dark);
        if (active) {
          Draw.rr(ctx, x + LW - 90, y + 8, 82, 22, 11); ctx.fillStyle = hu.css; ctx.fill();
          Draw.text(ctx, '🎲 ĐẾN LƯỢT', x + LW - 49, y + 19.5, { size: 11.5, color: '#fff', stroke: 'rgba(0,0,0,0.3)', sw: 2 });
        }
        const r = this.order.indexOf(i);
        if (r >= 0) Draw.text(ctx, ['🥇', '🥈', '🥉', '4️⃣'][r], x + LW - 22, y + 46, { size: 24, stroke: null });
        // 4 ngựa: trong chuồng / đang chạy / đã vào chuồng đích
        this.st.horses[i].forEach((pp, h) => {
          const cx = x + 22 + h * 52, cy = y + 74;
          Draw.rr(ctx, cx - 4, cy - 14, 46, 28, 9);
          ctx.fillStyle = pp < 0 ? 'rgba(43,58,51,0.08)' : pp > R.GATE ? hu.css : hu.soft; ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = hu.css; ctx.stroke();
          const lab = pp < 0 ? '🏠' : pp > R.GATE ? `bậc ${pp - R.GATE}` : `${Math.round(pp / R.GATE * 100)}%`;
          Draw.text(ctx, lab, cx + 19, cy + 1, { size: pp < 0 ? 13 : 12.5, color: pp > R.GATE ? '#fff' : hu.dark, stroke: null, weight: 800 });
        });
      });
      // nhật ký
      const ly = 10 + this.n * (CARD_H + CARD_GAP) + 4, lh = H - 10 - ly;
      if (lh < 70) return;
      this.panel(ctx, LX, ly, LW, lh, 'rgba(255,255,255,0.85)');
      Draw.text(ctx, '📜 Diễn biến', LX + 12, ly + 16, { size: 14, align: 'left', color: '#2b5c4d', stroke: null, weight: 800 });
      ctx.font = `600 12.5px ${FONT}`;
      const lines = [];
      for (const l of this.log.slice(-12)) this.wrap(ctx, l, LW - 22).forEach((t, k) => lines.push({ t, first: k === 0 }));
      const rows = Math.max(1, Math.floor((lh - 34) / 17)), show = lines.slice(-rows);
      ctx.save(); Draw.rr(ctx, LX, ly, LW, lh, 14); ctx.clip();
      show.forEach((l, k) => Draw.text(ctx, l.t, LX + (l.first ? 10 : 20), ly + 36 + k * 17, { size: 12.5, align: 'left', color: k === show.length - 1 ? '#1d2b25' : '#46574f', stroke: null, weight: k === show.length - 1 ? 700 : 600 }));
      ctx.restore();
    }
    wrap(ctx, str, maxW) {
      const words = String(str).split(' '), out = [];
      let line = '';
      for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
      if (line) out.push(line);
      return out;
    }
    /** cột phải: khung khay xúc xắc, bảng hành động, phím */
    drawRight(ctx) {
      const s = this.k, i = this.cur, hu = this.hue(i), p = this.players[i];
      // khung khay (khay 3D vẽ bên dưới, ở đây chỉ viền + nhãn)
      Draw.rr(ctx, TRAY.x, TRAY.y, TRAY.w, TRAY.h, 14); ctx.lineWidth = 5; ctx.strokeStyle = '#8a5a32'; ctx.stroke();
      if (!this.use3d && this.diceAnim) this.dice.forEach((v, k) => this.die2D(ctx, TRAY.x + TRAY.w / 2 + (this.dice.length === 1 ? 0 : (k ? 34 : -34)), TRAY.y + TRAY.h / 2, 52, s.k === 'dice' && s.t < s.roll ? 1 + Math.floor((this.t * 17 + k * 3) % 6) : v));
      if (s.k === 'dice' && s.t >= s.roll || ['pick', 'move'].includes(s.k)) {
        const d = this.dice, sum = d.reduce((a, b) => a + b, 0), dbl = d.length === 2 && d[0] === d[1];
        const lab = `${d.length === 2 ? `= ${sum}` : ''}${dbl ? ' · ĐÔI!' : R.isBonus(d, this.o) ? ' · thưởng!' : ''}`;
        if (lab) {
          ctx.font = `800 16px ${FONT}`;
          const tw = ctx.measureText(lab).width + 20;
          Draw.rr(ctx, TRAY.x + TRAY.w / 2 - tw / 2, TRAY.y + TRAY.h - 30, tw, 24, 12); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
          Draw.text(ctx, lab, TRAY.x + TRAY.w / 2, TRAY.y + TRAY.h - 17, { size: 16, color: dbl ? '#e67e22' : '#1d2b25', stroke: null, weight: 800 });
        }
      }
      // bảng hành động
      const y0 = ACT_Y, kh = this.keysHeight(ctx), ah = H - 10 - kh - 8 - y0;
      this.panel(ctx, RX, y0, RW, ah, 'rgba(255,255,255,0.92)', hu.css);
      // trạng thái
      const title = this.finished ? '🏁 Hết ván' : s.k === 'roll' ? `Lượt của ${p.name}` : s.k === 'dice' ? `${p.name} đổ xúc xắc…` : s.k === 'pick' ? (s.auto ? 'Chỉ có 1 nước — tự đi' : p.bot ? `${p.name} đang nghĩ…` : 'Chọn nước đi') : s.k === 'move' ? `${p.name} đang đi…` : '…';
      ctx.font = `800 17px ${FONT}`;
      const tw = Math.min(RW - 16, ctx.measureText(title).width + 46);
      Draw.rr(ctx, RX + RW / 2 - tw / 2, y0 + 10, tw, 32, 16); ctx.fillStyle = hu.css; ctx.fill();
      Draw.blob(ctx, { x: RX + RW / 2 - tw / 2 + 17, y: y0 + 26, r: 10, color: p.color, face: Math.PI / 2, shadow: false });
      this.fit(ctx, title, RX + RW / 2 + 10, y0 + 27, tw - 40, 17, 11, 800, '#fff', 'center');
      this.selRect = null;
      if (s.k === 'roll' && !this.finished) {
        const bx = RX + 14, by = y0 + 56, bw = RW - 28, bh = 54;
        this.rollBtn = { x: bx, y: by, w: bw, h: bh };
        const can = !p.bot;
        Draw.rr(ctx, bx, by, bw, bh, 16); ctx.fillStyle = can ? '#ffcf3d' : '#e6e6e6'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = can ? '#c58a00' : '#bbb'; ctx.stroke();
        Draw.text(ctx, can ? '🎲 Đổ xúc xắc' : '🤖 Máy sắp đổ…', bx + bw / 2, by + bh / 2 + 1, { size: 21, color: '#3a2a00', stroke: null, weight: 800 });
        if (can) this.btns.push({ x: bx, y: by, w: bw, h: bh, fn: () => this.roll() });
        if (can) Draw.text(ctx, 'Bấm Đánh (hoặc bấm vào khay) để đổ', RX + RW / 2, by + bh + 16, { size: 12, color: '#5a6b63', stroke: null });
        this.drawRuleHint(ctx, y0 + 140, ah - 140);
      } else if (s.k === 'pick' && !this.finished) {
        const n = s.moves.length, bh = Math.min(34, (ah - 70) / n - 4);
        s.moves.forEach((m, idx) => {
          const bx = RX + 12, by = y0 + 52 + idx * (bh + 4), bw = RW - 24, on = idx === s.sel;
          if (on) this.selRect = { x: bx, y: by, w: bw, h: bh };
          Draw.rr(ctx, bx, by, bw, bh, 10);
          ctx.fillStyle = on ? (m.kick ? '#ff6b5e' : '#ffe14d') : m.kick ? '#ffe2df' : '#f3f6f4'; ctx.fill();
          ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? hu.dark : 'rgba(43,58,51,0.2)'; ctx.stroke();
          const horse = `${idx + 1}. Ngựa ${m.h + 1}`;
          this.fit(ctx, horse, bx + 10, by + bh / 2 + 1, 80, 14, 10, 800, hu.dark);
          this.fit(ctx, m.tag, bx + bw - 10, by + bh / 2 + 1, bw - 100, 14, 10, 800, m.kick ? '#7a120e' : '#1d2b25', 'right');
          if (!p.bot) this.btns.push({ x: bx, y: by, w: bw, h: bh, sel: idx, fn: () => { s.sel = idx; this.play(m); } });
        });
        if (!p.bot && !s.auto) Draw.text(ctx, '← → chọn · Đánh: đi · hoặc bấm chuột', RX + RW / 2, y0 + ah - 14, { size: 11.5, color: '#5a6b63', stroke: null });
      } else if (!this.finished) this.drawRuleHint(ctx, y0 + 56, ah - 56);
      // nút xem cả bàn (khi đã xoay)
      if (this.use3d) {
        const v = this.view.view, moved = Math.abs(v.yaw) > 0.01 || Math.abs(v.pitch - 0.98) > 0.01;
        if (moved) {
          const bx = LX + LW + 14, by = H - 46;
          Draw.rr(ctx, bx, by, 120, 34, 12); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#2b5c4d'; ctx.stroke();
          Draw.text(ctx, '🗺️ Về góc chuẩn', bx + 60, by + 18, { size: 13.5, color: '#2b5c4d', stroke: null, weight: 800 });
          this.btns.push({ x: bx, y: by, w: 120, h: 34, fn: () => { this.view.resetView(); } });
        }
      }
      this.drawKeys(ctx, RX, H - 10 - kh, RW);
    }
    /** nhắc luật ngắn trong bảng hành động */
    drawRuleHint(ctx, y, h) {
      if (h < 60) return;
      const o = this.o, lines = [
        o.dice === 2 ? (o.exit === 'pair16' ? '🚪 Xuất chuồng: đổ đôi hoặc 1+6' : '🚪 Xuất chuồng: đổ đôi hoặc có con 6') : (o.exit === 'one6' ? '🚪 Xuất chuồng: ra 1 hoặc 6' : '🚪 Xuất chuồng: ra 6'),
        '💥 Dừng đúng ô có ngựa đối thủ → đá về chuồng',
        o.jump ? '🦘 Được nhảy qua đầu ngựa' : '🚧 Không nhảy qua đầu ngựa',
        o.entry === 'straight' ? '🏁 Đếm thẳng vào chuồng; trong chuồng mỗi lần đôi lên 1 bậc' : o.entry === 'gate' ? '🏁 Dừng ở cửa, ra n lên bậc n' : '🏁 Đếm bước cả trong chuồng',
        o.win === 'top4' ? '🏆 Thắng: 4 ngựa ở bậc 3–4–5–6' : '🏆 Thắng: cả 4 ngựa vào chuồng đích',
        '🎲 Đôi / 1+6 được đổ tiếp',
      ];
      ctx.font = `600 12px ${FONT}`;
      let yy = y + 6;
      for (const l of lines) for (const t of this.wrap(ctx, l, RW - 24)) { if (yy > y + h - 10) return; Draw.text(ctx, t, RX + 12, yy, { size: 12, align: 'left', color: '#3d4f47', stroke: null, weight: 600 }); yy += 16; }
    }
    die2D(ctx, x, y, s, v) {
      Draw.rr(ctx, x - s / 2, y - s / 2, s, s, 10); ctx.fillStyle = '#fffdf7'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#999'; ctx.stroke();
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
      for (const [a, b] of P) { ctx.beginPath(); ctx.arc(x + a * s * 0.26, y + b * s * 0.26, s * 0.08, 0, Math.PI * 2); ctx.fillStyle = v === 1 ? '#d6312b' : '#26213a'; ctx.fill(); }
    }
    keysHeight(ctx) { return this.drawKeys(ctx, 0, 0, RW, false); }
    /** bảng "Phím của bạn" (giống Cờ Tỷ Phú) — trả chiều cao; draw=false chỉ đo */
    drawKeys(ctx, x, y, w, draw = true) {
      const rows = typeof App !== 'undefined' && App.helpRows ? App.helpRows() : [];
      if (!rows.length) return 0;
      const fs = 12, kh = 18, lh = 22, pad = 9;
      ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const items = [];
      let cy = 36;
      for (const r of rows) {
        let cx = pad;
        items.push({ t: 'name', r, x: cx, y: cy });
        ctx.font = `800 ${fs + 1}px ${FONT}`;
        cx += 16 + ctx.measureText(r.p.name).width + 8;
        for (const [key, label] of r.parts) {
          ctx.font = `800 ${fs}px ${FONT}`; const kw = ctx.measureText(key).width + 10;
          ctx.font = `600 ${fs}px ${FONT}`; const lw = ctx.measureText(label).width;
          if (cx + kw + 4 + lw > w - pad && cx > pad + 30) { cx = pad + 16; cy += lh; }
          items.push({ t: 'key', key, label, kw, x: cx, y: cy });
          cx += kw + 4 + lw + 10;
        }
        cy += lh + 4;
      }
      const h = cy + 2;
      if (draw) {
        Draw.rr(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(30,22,58,0.9)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,225,77,0.7)'; ctx.stroke();
        ctx.font = `800 13px ${FONT}`; ctx.fillStyle = '#ffe14d'; ctx.fillText('🎮 Phím · kéo chuột để xoay bàn', x + pad, y + 15);
        for (const it of items) {
          if (it.t === 'name') {
            ctx.fillStyle = it.r.p.color.main; ctx.beginPath(); ctx.arc(x + it.x + 6, y + it.y, 6, 0, Math.PI * 2); ctx.fill();
            ctx.font = `800 ${fs + 1}px ${FONT}`; ctx.fillStyle = it.r.p.color.light; ctx.fillText(it.r.p.name, x + it.x + 16, y + it.y + 1);
          } else {
            Draw.rr(ctx, x + it.x, y + it.y - kh / 2, it.kw, kh, 5); ctx.fillStyle = '#fff'; ctx.fill();
            ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = '#2a1840'; ctx.fillText(it.key, x + it.x + 5, y + it.y + 1);
            ctx.font = `600 ${fs}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(it.label, x + it.x + it.kw + 4, y + it.y + 1);
          }
        }
      }
      ctx.restore();
      return h;
    }
    drawButtonFx(ctx) {
      const b = this.btnAt();
      try { const cv = document.getElementById('cv'); if (cv) cv.style.cursor = this.drag ? 'grabbing' : b && !b.dis ? 'pointer' : (this.k.k === 'pick' && this.human() && this.ptr && this.moveAt(this.ptr.x, this.ptr.y) >= 0 ? 'pointer' : ''); } catch (e) { /* bỏ qua */ }
      if (b) {
        ctx.save(); ctx.shadowColor = '#2e86de'; ctx.shadowBlur = 14;
        Draw.rr(ctx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 12); ctx.lineWidth = 3; ctx.strokeStyle = '#2e86de'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill(); ctx.restore();
      }
      const p = this.press;
      if (p) {
        const k = p.t / 0.3, e = 6 + k * 10;
        ctx.save(); ctx.globalAlpha = 1 - k;
        Draw.rr(ctx, p.x - e, p.y - e, p.w + e * 2, p.h + e * 2, 14 + e); ctx.lineWidth = 4; ctx.strokeStyle = '#ffe14d'; ctx.stroke();
        ctx.restore();
      }
    }
    drawTurnFx(ctx) {
      const f = this.turnFx;
      if (!f || this.finished || f.t < 0) return;
      const pl = this.players[f.i], hu = this.hue(f.i), k = f.t / TURN_FX_T;
      const pop = k < 0.18 ? U.outBack(k / 0.18) : 1, a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const cx = (LX + LW + RX) / 2, cy = 300, w = 400, h = 112;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(pop, pop);
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24;
      Draw.rr(ctx, -w / 2, -h / 2, w, h, 22); ctx.fillStyle = hu.css; ctx.fill();
      ctx.shadowBlur = 0; ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
      Draw.blob(ctx, { x: -w / 2 + 62, y: 6, r: 34, color: pl.color, face: Math.PI / 2, shadow: false });
      Draw.text(ctx, `ĐẾN LƯỢT · ngựa ${hu.name}`, 46, -24, { size: 18, color: '#fff', stroke: 'rgba(0,0,0,0.35)', sw: 3 });
      Draw.text(ctx, pl.name + (pl.bot ? ' 🤖' : ''), 46, 18, { size: 40, color: '#fff', stroke: 'rgba(0,0,0,0.4)', sw: 5 });
      ctx.restore();
    }
    drawWin(ctx) {
      const w0 = this.order[0];
      if (w0 === undefined) return;
      const pl = this.players[w0], hu = this.hue(w0), k = Math.min(1, this.winT / 0.5);
      const cx = (LX + LW + RX) / 2, cy = 110;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(U.outBack(k), U.outBack(k));
      Draw.rr(ctx, -230, -44, 460, 88, 24); ctx.fillStyle = hu.css; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
      Draw.text(ctx, `🏆 ${pl.name} thắng!`, 0, -8, { size: 38, color: '#fff', stroke: 'rgba(0,0,0,0.4)', sw: 5 });
      Draw.text(ctx, `4 ngựa ${hu.name} đã về chuồng`, 0, 26, { size: 16, color: '#fff', stroke: 'rgba(0,0,0,0.3)', sw: 3 });
      ctx.restore();
      if (Math.random() < 0.25) this.api.parts.burst(cx + U.rand(-300, 300), U.rand(120, 400), [hu.css, '#ffe14d', '#ffffff'], 14, 260, 1.1, 5);
    }
    posOf(i) {
      // vị trí con ngựa đi xa nhất (hoặc giữa chuồng) trên màn hình
      const hs = this.st.horses[i];
      let h = 0;
      hs.forEach((p, k) => { if (p > hs[h]) h = k; });
      const q = this.horsePose(i, h), s = this.view.project(q.x, q.y + 0.6, q.z);
      return { x: U.clamp(s.x, 0, W), y: U.clamp(s.y, 0, H) };
    }
  }

  Party.register({
    id: 'ludo', name: 'Cờ Cá Ngựa 3D', emoji: '🐴', cat: 'board',
    tagline: 'Đổ đôi là xuất chuồng, đứng đúng ô là đá ngựa bạn bay về chuồng. Bàn cờ 3D, 2–4 người.',
    how: 'Mỗi người 4 ngựa trong chuồng ở góc. Đổ xúc xắc: đôi hoặc 1+6 thì xuất chuồng (luật nhà chỉnh được). Ngựa chạy hết một vòng theo chiều kim đồng hồ rồi vào chuồng đích 6 bậc ở giữa. Dừng đúng ô có ngựa đối thủ là đá nó về chuồng; không được nhảy qua đầu ngựa khác. Đổ đôi / 1+6 được đổ tiếp. Ai đưa đủ 4 ngựa lên bậc 3–6 trước là thắng. Đổ xong, các điểm đến hiện ngay trên bàn (ngựa mờ + nhãn) — ← → chọn, Đánh để đi, hoặc bấm chuột vào điểm đến. Kéo chuột để xoay bàn.',
    controls: { move: 'Chọn nước', act: 'Đổ · Đi' },
    helpExtra: '🖱️ chuột: bấm điểm đến / nút, kéo để xoay bàn',
    minPlayers: 2, maxPlayers: 4, rawBot: true,
    options: [
      { id: 'dice', label: 'Số xúc xắc', items: [
        { id: '2', name: '2 con', icon: '🎲🎲', desc: 'Luật nhà phổ biến: đi tổng 2 con, đôi được chọn đi cả hoặc nửa' },
        { id: '1', name: '1 con', icon: '🎲', desc: 'Kiểu cổ điển: ra 6 mới xuất chuồng và được đổ tiếp' }] },
      { id: 'exit', label: 'Xuất chuồng', items: [
        { id: 'std', name: 'Đôi / 1+6', icon: '🚪', desc: '2 con: đổ đôi hoặc 1+6 · 1 con: ra 6' },
        { id: 'loose', name: 'Dễ hơn', icon: '🔓', desc: '2 con: đổ đôi hoặc có con 6 · 1 con: ra 1 hoặc 6' }] },
      { id: 'jump', label: 'Nhảy qua đầu', items: [
        { id: 'no', name: 'Không được', icon: '🚧', desc: 'Trên đường đi không được vượt qua ngựa nào' },
        { id: 'yes', name: 'Được', icon: '🦘', desc: 'Nhảy qua thoải mái, chỉ tính ô dừng' }] },
      { id: 'entry', label: 'Vào chuồng', items: [
        { id: 'straight', name: 'Đếm thẳng', icon: '➡️', desc: 'Qua cửa thì mỗi bước tiếp là 1 bậc; đã vào chuồng thì mỗi lần đổ đôi lên 1 bậc' },
        { id: 'gate', name: 'Dừng ở cửa', icon: '🚪', desc: 'Phải dừng đúng ô cửa; từ cửa ra n lên bậc n, ở bậc k muốn lên phải ra k+1' },
        { id: 'count', name: 'Đếm cả chuồng', icon: '🔢', desc: 'Đi xuyên cửa, trong chuồng cũng đi đúng số bước, không quá bậc 6' }] },
      { id: 'win', label: 'Thắng khi', items: [
        { id: 'top4', name: 'Bậc 3–6', icon: '🏆', desc: '4 ngựa chiếm đủ bậc 3, 4, 5, 6' },
        { id: 'all', name: 'Cả 4 về', icon: '🏁', desc: 'Cả 4 ngựa vào chuồng đích, bậc nào cũng được' }] },
      { id: 'rank', label: 'Tranh hạng', items: [
        { id: 'yes', name: 'Chơi tiếp', icon: '🥈', desc: 'Có người về nhất thì những người còn lại chơi tiếp tranh hạng 2, 3' },
        { id: 'no', name: 'Dừng luôn', icon: '⏹️', desc: 'Có người về nhất là hết ván' }] },
      { id: 'speed', label: 'Tốc độ', items: [
        { id: 'normal', name: 'Thong thả', icon: '☕', desc: 'Xúc xắc dừng lâu, ngựa nhảy từng ô, máy nghĩ chậm rãi' },
        { id: 'fast', name: 'Nhanh', icon: '🏃', desc: 'Tua nhanh hiệu ứng và lượt của máy' }] },
      { id: 'quality', label: 'Đồ hoạ 3D', items: [
        { id: 'high', name: 'Cao', icon: '✨', desc: 'Bóng đổ, nét căng — cần máy khá' },
        { id: 'low', name: 'Thấp', icon: '🍃', desc: 'Tắt bóng đổ, giảm độ phân giải cho máy yếu' }] },
    ],
    create: (api) => new Ludo(api),
  });
})();

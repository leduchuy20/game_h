// Cat and Dog — Mèo và Chó ném đồ qua hàng rào theo lượt (ý tưởng từ các game Cat vs Dog; nhân vật tự thiết kế: catdog_art.js).
// Giữ Đánh: thanh lực dâng rồi tụt (lên-xuống), thả ra để ném; ↑ ↓ canh góc (tuỳ chọn "Góc ném", Cố định = 55° như bản gốc), gió đổi mỗi lượt.
// Lõi đường bay / va chạm / máy ngắm: catdog_core.js (test: node tools/catdog-test.js). Nạp catdog_core.js + catdog_art.js TRƯỚC file này.
(() => {
  'use strict';
  const C = window.CatDogCore, A = window.CatDogArt;
  if (!C || !A) return;
  const GY = C.GY, SC = C.SCALE, DT = C.DT;
  const POS = [230, 1050], FACE = [1, -1], KIND = ['cat', 'dog'], NAME = ['Mèo', 'Chó'], EMO = ['🐱', '🐶'];
  const HP_FULL = 100, HP_DODGE = 80, HEAL = 25, TURN_T = 10, CHARGE_T = 1.1, RESULT_T = 1.1, KO_T = 2.6, START_T = 1.7, WAIT_T = 0.9;
  const ITEMS = [
    { id: 'double', icon: '✌️', name: 'Ném đôi' },
    { id: 'power', icon: '💪', name: 'Ném mạnh' },
    { id: 'heal', icon: '🩹', name: 'Hồi máu' },
    { id: 'calm', icon: '🍃', name: 'Lặng gió' },
  ];
  const AMMO = [['fish', 'can'], ['bone', 'slipper']];
  // máy: độ lệch lực (đo bằng tools/catdog-test.js: trúng ~38% / ~72% / ~85%), thời gian nghĩ
  const BOT = { easy: { sig: 0.13, think: 1.3 }, normal: { sig: 0.06, think: 1.0 }, hard: { sig: 0.035, think: 0.8 } };
  const UI = '"Baloo 2", system-ui, sans-serif';
  const BAR = { w: 22, h: 180 };
  const ITEM_Y = GY - 290, ITEM_R = 21, ITEM_GAP = 48;
  // Né tránh: người bị ném chạy ← → trong khoảng ±DODGE_R quanh chỗ đứng; ném xong tự đi về chỗ cũ (người ném luôn đứng ở chỗ gốc)
  const DODGE_V = 90, HOME_V = 260, DODGE_R = 100;
  const BOT_DODGE = { easy: { react: 0.55, miss: 0.45 }, normal: { react: 0.32, miss: 0.15 }, hard: { react: 0.16, miss: 0.04 } };
  // canh góc: chạm ↑ ↓ = 1°, giữ quá ANG_REP giây thì chạy ANG_V độ/giây; máy chọn trong BOT_ANGS
  const DEG = Math.PI / 180, ANG_V = 30, ANG_REP = 0.28;
  const BOT_ANGS = [45, 50, 55, 60, 65, 70];
  const MAP_IDS = ['yard', 'beach', 'roof'];
  const MAP_INFO = {
    yard: { name: 'Sân sau', wallName: 'Vướng rào!', ink: '#2b2240' },
    beach: { name: 'Bãi biển', wallName: 'Vướng lưới!', ink: '#2b2240' },
    roof: { name: 'Mái nhà ban đêm', wallName: 'Vướng ống khói!', ink: '#ffffff' },
  };

  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  class CatDog {
    constructor(api) {
      this.api = api;
      this.ps = api.players;
      this.dodge = api.mode === 'dodge';
      this.maxHp = this.dodge ? HP_DODGE : HP_FULL;   // Né tránh khó trúng hơn → ít máu hơn cho trận gọn
      this.mapPick = api.variant || 'yard';
      this.mapId = null;
      this.px = POS.slice(); this.walk = [0, 0]; this.dodgeAI = null;
      this.stars = Array.from({ length: 80 }, () => ({ x: Math.random() * 1280, y: Math.random() * 400, s: Math.random() }));
      this.smoke = []; this.smokeT = 0;
      this.ownEndBanner = true;
      this.need = api.wins;
      this.maxRounds = api.wins * 2 - 1;
      this.hp = [this.maxHp, this.maxHp]; this.wins = [0, 0]; this.round = 0; this.first = 0;
      this.used = [new Set(), new Set()]; this.sel = [0, 0]; this.prevMx = [0, 0];
      this.lastPow = [null, null]; this.anim = [null, null];
      this.ang = [C.ANG, C.ANG]; this.angKey = [{ d: 0, t: 0 }, { d: 0, t: 0 }];   // góc ném từng bên (nhớ qua các lượt)
      this.stat = [{ head: 0, hit: 0, throws: 0 }, { head: 0, hit: 0, throws: 0 }];
      this.shots = []; this.floats = []; this.splats = [];
      this.wind = 0; this.windShow = 0; this.t = 0;
      this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 240 + Math.random() * 120, y: 70 + Math.random() * 120, s: 0.6 + Math.random() * 0.6 }));
      this.allBots = this.ps.every((p) => p.bot);
      this.finished = false;
      this.startRound();
    }
    teamOf(i) { return i; }
    get teamNames() { return ['🐱 Mèo', '🐶 Chó']; }
    lvOf(i) { return BOT[this.ps[i].level] || BOT.normal; }
    /** tuỳ chọn Góc ném: đọc mỗi lần dùng (app không tạo lại instance khi đổi tuỳ chọn) */
    freeAng() { return !(this.api.opts && this.api.opts.angle === 'fixed'); }
    angOf(i) { return this.freeAng() ? this.ang[i] : C.ANG; }
    degOf(i) { return Math.round(this.angOf(i) / DEG); }
    setDeg(i, d) { this.ang[i] = U.clamp(Math.round(d), C.ANG_MIN / DEG, C.ANG_MAX / DEG) * DEG; }

    /* ---------- vòng chơi ---------- */
    startRound() {
      this.round++;
      this.hp = [this.maxHp, this.maxHp];
      this.px = POS.slice();
      // bản đồ: Ngẫu nhiên = đổi bản đồ mỗi hiệp
      this.mapId = this.mapPick === 'random' ? U.pick(MAP_IDS.filter((m) => m !== this.mapId)) : (C.MAPS[this.mapPick] ? this.mapPick : 'yard');
      this.map = C.MAPS[this.mapId]; this.info = MAP_INFO[this.mapId];
      this.used = [new Set(), new Set()];
      this.shots = []; this.splats = [];
      this.turn = this.first;
      this.k = { k: 'start', t: 0 };
    }
    startTurn(i) {
      this.turn = i;
      this.wind = C.newWind(Math.random, this.map.windMax);
      this.k = { k: 'turn', t: 0, left: TURN_T, charging: false, ht: 0, pw: 0, throws: 1, thrown: 0, big: false, item: null, mouse: false };
      if (this.ps[i].bot) this.planBot();
    }
    /** lượt ném tiếp trong cùng lượt (Ném đôi) */
    nextThrow() {
      const k = this.k;
      Object.assign(k, { k: 'turn', t: 0, left: TURN_T, charging: false, ht: 0, pw: 0, mouse: false });
      if (this.ps[this.turn].bot) this.planBot();
    }
    endTurn() {
      this.shots = [];
      this.startTurn(1 - this.turn);
    }
    useItem(id) {
      const i = this.turn, k = this.k;
      if (k.k !== 'turn' || k.charging) return false;
      if (this.used[i].has(id) || k.item) { Sfx.tone(150, 0.08, 'square', 0.05); return false; }
      if (id === 'heal' && this.hp[i] >= this.maxHp) { Sfx.tone(150, 0.08, 'square', 0.05); this.float(this.px[i], GY - 250, 'Máu đang đầy', '#fff'); return false; }
      this.used[i].add(id); k.item = id;
      const x = this.px[i];
      if (id === 'heal') {
        this.hp[i] = Math.min(this.maxHp, this.hp[i] + HEAL);
        this.float(x, GY - 250, `+${HEAL} máu`, '#5dffb0');
        this.api.parts.burst(x, GY - 100, ['#5dffb0', '#fff'], 18, 200, 0.8, 5);
        Sfx.play('pickup');
        this.k = { k: 'wait', t: 0, then: 'end' };
      } else if (id === 'double') { k.throws = 2; this.float(x, GY - 250, 'Ném đôi!', '#ffd23f'); Sfx.play('select'); }
      else if (id === 'power') { k.big = true; this.float(x, GY - 250, 'Ném mạnh!', '#ff8a5c'); Sfx.play('select'); }
      else if (id === 'calm') { this.wind = 0; this.float(x, GY - 250, 'Lặng gió!', '#9fe8ff'); Sfx.play('select'); }
      return true;
    }
    throw_(pw) {
      const i = this.turn, k = this.k;
      k.charging = false; k.mouse = false; k.thrown++;
      this.lastPow[i] = pw;
      const ang = this.angOf(i);
      const s = C.launch(this.px[i], FACE[i], pw, this.wind, k.big, this.map.wall, ang);
      // chỗ rơi dự đoán (bóng đổ ở chế độ Né tránh)
      const land = C.simulate(this.px[i], FACE[i], pw, this.wind, null, { big: k.big, wall: this.map.wall, ang });
      s.landX = land.fence ? null : land.x; s.landT = land.t;
      this.dodgeAI = null;
      s.ammo = AMMO[i][(this.stat[i].throws++) % 2];
      s.big = k.big; s.acc = 0; s.trail = [];
      this.shots = [s];
      this.anim[i] = { pose: 'throw', t: 0.45 };
      this.k.k = 'fly';
      Sfx.play('dash');
    }
    resolve(s, r) {
      const i = this.turn, o = 1 - i;
      s.done = true;
      const dmg = C.damage(r.kind, s.big);
      this.splats.push({ x: r.x, y: Math.min(GY, r.y), t: 0, c: r.kind === 'miss' || r.kind === 'near' ? '#8a6a4a' : '#fff' });
      if (dmg > 0) {
        this.hp[o] = Math.max(0, this.hp[o] - dmg);
        this.stat[i].hit++;
        if (r.kind === 'head') this.stat[i].head++;
        const label = r.kind === 'head' ? `Trúng đầu! −${dmg}` : r.kind === 'body' ? `Trúng người −${dmg}` : `Sát bên −${dmg}`;
        this.float(this.px[o], GY - 230, label, r.kind === 'head' ? '#ff5d73' : '#ffd23f', r.kind === 'head' ? 34 : 28);
        if (r.kind !== 'near') {
          this.anim[o] = { pose: 'hit', t: 1.1 };
          this.api.parts.burst(r.x, r.y, ['#fff', '#ffd23f', this.ps[i].color.main], r.kind === 'head' ? 26 : 16, 260, 0.6, 6);
          FX.shake(r.kind === 'head' ? 9 : 5);
          Party.rumble(o, r.kind === 'head' ? 0.9 : 0.5, 220);
          Sfx.play(r.kind === 'head' ? 'punch' : 'hit');
          this.voice(o);
        } else Sfx.play('kick');
      } else {
        this.float(r.x, Math.min(GY - 40, r.y - 30), s.fenceHit ? this.info.wallName : 'Trượt!', '#ffffff', 24);
        Sfx.play(s.fenceHit ? 'crash' : 'fall', 0.05);
      }
      if (this.hp[o] <= 0) { this.k = { k: 'ko', t: 0, loser: o }; Sfx.play('crown'); return; }
      this.k = { k: 'result', t: 0, throws: this.k.throws, thrown: this.k.thrown, big: this.k.big, item: this.k.item };
    }
    /** tiếng meo / gâu tổng hợp */
    voice(i) {
      if (KIND[i] === 'cat') { Sfx.tone(880, 0.09, 'triangle', 0.06); setTimeout(() => Sfx.tone(620, 0.16, 'triangle', 0.06), 90); }
      else { Sfx.tone(240, 0.07, 'square', 0.05); setTimeout(() => Sfx.tone(200, 0.09, 'square', 0.05), 120); }
    }
    float(x, y, s, c, size = 28) { this.floats.push({ x, y, s, c, size, t: 0 }); }

    /* ---------- máy ---------- */
    planBot() {
      const i = this.turn, o = 1 - i, k = this.k, lv = this.ps[i].level || 'normal', L = this.lvOf(i);
      // vật phẩm (mỗi lượt tối đa một)
      let want = null;
      const has = (id) => !this.used[i].has(id) && !k.item;
      if (k.thrown === 0) {
        if (lv === 'easy') {
          if (Math.random() < 0.25) { const pool = ITEMS.map((x) => x.id).filter((id) => has(id) && (id !== 'heal' || this.hp[i] < this.maxHp)); want = pool.length ? U.pick(pool) : null; }
        } else {
          const hard = lv === 'hard';
          if (has('heal') && this.hp[i] <= (hard ? 40 : 35) && this.hp[o] > 25) want = 'heal';
          else if (has('calm') && Math.abs(this.wind) >= (hard ? 6 : 8)) want = 'calm';
          else if (has('power') && this.hp[o] > 25 && this.hp[o] <= 38 && (hard || Math.random() < 0.5)) want = 'power';
          else if (has('double') && this.hp[o] > 40 && (hard ? this.round > 0 && Math.random() < 0.35 : Math.random() < 0.15)) want = 'double';
        }
      }
      k.bot = { think: L.think * U.rand(0.7, 1.2), want, target: null };
    }
    botAim() {
      const i = this.turn, o = 1 - i, k = this.k, L = this.lvOf(i);
      const tg = { x: this.px[o], face: FACE[o] };
      let ang = C.ANG;
      if (this.freeAng()) {
        // tự canh góc: thử vài góc, giữ góc đang dùng nếu vẫn trúng được (đỡ phải chỉnh), không thì chọn bừa một góc trúng được
        const ok = BOT_ANGS.filter((d) => {
          const a = d * DEG, p = C.solve(this.px[i], FACE[i], this.wind, tg, k.big, this.map.wall, a);
          return p < 0.97 && C.simulate(this.px[i], FACE[i], p, this.wind, tg, { big: k.big, wall: this.map.wall, ang: a }).kind === 'head';
        });
        const cur = this.degOf(i);
        const d = ok.includes(cur) && Math.random() < 0.6 ? cur : ok.length ? U.pick(ok) : 55;
        ang = d * DEG;
        k.bot.deg = d;
      }
      const best = C.solve(this.px[i], FACE[i], this.wind, tg, k.big, this.map.wall, ang);
      // cú đầu của lượt lệch hơn một chút (chưa "quen" gió)
      k.bot.target = U.clamp(best + gauss() * L.sig * (k.thrown ? 0.8 : 1), 0.02, 0.99);
    }
    botStep(dt) {
      const k = this.k, b = k.bot;
      if (!b || k.k !== 'turn') return;
      if (k.t < b.think) return;
      if (b.want) { const w = b.want; b.want = null; this.useItem(w); return; }
      if (b.target === null) this.botAim();
      // chỉnh góc dần tới góc đã chọn (nhìn thấy mũi tên xoay) rồi mới giữ lực
      if (!k.charging && b.deg != null && this.freeAng()) {
        const cur = this.ang[this.turn] / DEG, d = b.deg - cur;
        if (Math.abs(d) > 0.01) { this.setDeg(this.turn, Math.abs(d) <= 1 ? b.deg : cur + Math.sign(d) * Math.max(1, ANG_V * 1.4 * dt)); if (Math.abs(b.deg - this.ang[this.turn] / DEG) > 0.01) return; b.wait = 0.25; }
        if (b.wait > 0) { b.wait -= dt; return; }
      }
      if (!k.charging) { k.charging = true; k.ht = 0; return; }
      if (k.pw >= k.bot.target || k.ht >= CHARGE_T) this.throw_(k.pw);
    }

    /* ---------- vòng lặp ---------- */
    update(dt, inputs) {
      if (this.allBots) dt *= 2.5;               // toàn máy (smoke test, ảnh thẻ): tua nhanh
      this.t += dt;
      this.windShow += (this.wind - this.windShow) * Math.min(1, dt * 4);
      for (const c of this.clouds) { c.x += (this.windShow * 7 + 6) * c.s * dt; if (c.x > 1400) c.x = -160; if (c.x < -180) c.x = 1380; }
      for (let i = 0; i < 2; i++) if (this.anim[i] && (this.anim[i].t -= dt) <= 0) this.anim[i] = null;
      this.floats = this.floats.filter((f) => (f.t += dt) < 1.4);
      this.walk = [0, 0];
      if (this.mapId === 'roof') this.updateSmoke(dt);
      this.splats = this.splats.filter((s) => (s.t += dt) < 3);
      if (this.finished) { this.k.t += dt; return; }
      const k = this.k;
      k.t += dt;
      switch (k.k) {
        case 'start':
          if (k.t > START_T) this.startTurn(this.turn);
          break;
        case 'turn': this.updateTurn(dt, inputs); break;
        case 'fly': {
          if (this.dodge) this.updateDodge(dt, inputs);
          for (const s of this.shots) {
            if (s.done) continue;
            s.acc += dt;
            while (s.acc >= DT && !s.done) {
              s.acc -= DT;
              const r = C.step(s, DT, { x: this.px[1 - this.turn], face: FACE[1 - this.turn] });
              if ((s.trail.length === 0 || s.t - s.trail[s.trail.length - 1][2] > 0.03)) { s.trail.push([s.x, s.y, s.t]); if (s.trail.length > 14) s.trail.shift(); }
              if (r) this.resolve(s, r);
            }
          }
          break;
        }
        case 'result':
          if (k.t > RESULT_T) {
            if (k.thrown < k.throws) this.nextThrow();   // Ném đôi: ném tiếp trong cùng lượt
            else this.endTurn();
          }
          break;
        case 'wait':
          if (k.t > WAIT_T) this.endTurn();
          break;
        case 'ko':
          if (k.t > KO_T) {
            this.px = POS.slice();
            const w = 1 - k.loser;
            this.wins[w]++;
            if (this.wins[w] >= this.need || this.round >= this.maxRounds) { this.finished = true; this.k = { k: 'over', t: 0, winner: w }; Sfx.play('win'); }
            else { this.first = k.loser; this.startRound(); }
          }
          break;
      }
      if (this.dodge && this.k.k !== 'fly' && this.k.k !== 'ko' && !this.finished) this.goHome(dt);
    }
    /** Né tránh: người bị ném chạy ← → (máy: theo bóng đổ, phản xạ theo mức) */
    updateDodge(dt, inputs) {
      const o = 1 - this.turn, s = this.shots[0];
      if (!s || s.done) return;
      let mv = 0;
      if (!this.ps[o].bot) { const inp = inputs[o] || {}; mv = Math.abs(inp.mx || 0) > 0.3 ? Math.sign(inp.mx) : 0; }
      else mv = this.botDodge(o, s, dt);
      if (mv) {
        const nx = U.clamp(this.px[o] + mv * DODGE_V * dt, POS[o] - DODGE_R, POS[o] + DODGE_R);
        if (nx !== this.px[o]) { this.px[o] = nx; this.walk[o] = mv; }
      }
    }
    botDodge(o, s, dt) {
      if (s.vy <= 0 || s.landX === null) return 0;        // chưa qua đỉnh: chưa thấy bóng đổ
      const L = BOT_DODGE[this.ps[o].level] || BOT_DODGE.normal;
      const a = this.dodgeAI || (this.dodgeAI = { t: 0, dir: 0, decided: false });
      a.t += dt;
      if (a.t < L.react) return 0;
      if (!a.decided) {
        a.decided = true;
        if (Math.random() < L.miss) a.dir = U.pick([0, -1, 1]);
        else {
          let d = Math.sign(this.px[o] - s.landX) || U.pick([-1, 1]);
          const lo = POS[o] - DODGE_R, hi = POS[o] + DODGE_R;
          if ((d < 0 && this.px[o] - lo < 60) || (d > 0 && hi - this.px[o] < 60)) d = -d;   // hết chỗ thì chạy hướng kia
          a.dir = d;
        }
      }
      return Math.abs(this.px[o] - s.landX) > 120 ? 0 : a.dir;
    }
    goHome(dt) {
      for (let i = 0; i < 2; i++) {
        const d = POS[i] - this.px[i];
        if (Math.abs(d) < 0.5) { this.px[i] = POS[i]; continue; }
        const st = Math.sign(d) * Math.min(Math.abs(d), HOME_V * dt);
        this.px[i] += st; this.walk[i] = Math.sign(d);
      }
    }
    updateSmoke(dt) {
      const F = this.map.wall;
      if ((this.smokeT -= dt) <= 0) { this.smokeT = 0.28; this.smoke.push({ x: (F.x0 + F.x1) / 2 + U.rand(-10, 10), y: F.top - 14, r: 10, t: 0 }); }
      for (const p of this.smoke) { p.t += dt; p.y -= 34 * dt; p.x += (this.windShow * 9) * dt; p.r += 9 * dt; }
      this.smoke = this.smoke.filter((p) => p.t < 3.2);
    }
    updateTurn(dt, inputs) {
      const k = this.k, i = this.turn, p = this.ps[i];
      k.left -= dt;
      if (!p.bot) {
        const inp = inputs[i] || {};
        // chọn vật phẩm: ← → (cạnh bấm), Nhảy dùng
        const mx = Math.abs(inp.mx || 0) > 0.5 ? Math.sign(inp.mx) : 0;
        if (mx && mx !== this.prevMx[i] && !k.charging) { this.sel[i] = (this.sel[i] + (FACE[i] === 1 ? mx : -mx) + ITEMS.length) % ITEMS.length; Sfx.play('move', 0.03); }
        this.prevMx[i] = mx;
        if (inp.jumpP && !k.charging) this.useItem(ITEMS[this.sel[i]].id);
        // canh góc: ↑ tăng, ↓ giảm (chạm = 1°, giữ = chạy liên tục)
        const my = Math.abs(inp.my || 0) > 0.5 ? -Math.sign(inp.my) : 0, ak = this.angKey[i];
        if (this.freeAng() && my && !k.charging) {
          const before = this.degOf(i);
          if (my !== ak.d) { ak.d = my; ak.t = 0; this.setDeg(i, before + my); }
          else {
            ak.t += dt;
            if (ak.t > ANG_REP) this.ang[i] = U.clamp(this.ang[i] + my * ANG_V * DEG * dt, C.ANG_MIN, C.ANG_MAX);
          }
          if (this.degOf(i) !== before) Sfx.tone(500 + this.degOf(i) * 6, 0.02, 'sine', 0.03);
        } else if (!my) { ak.d = 0; if (ak.t > 0) { this.setDeg(i, this.ang[i] / DEG); ak.t = 0; } }
        if (this.k !== k || k.k !== 'turn') return;
        const hold = !!inp.act || k.mouse;
        if (hold && !k.charging) { k.charging = true; k.ht = 0; }
        else if (!hold && k.charging) { this.throw_(k.pw); return; }
      } else this.botStep(dt);
      if (this.k !== k || k.k !== 'turn') return;
      if (k.charging) { k.ht += dt; k.pw = C.powerAt(k.ht, CHARGE_T); if (k.ht > 0.05 && Math.floor(k.pw * 10) !== Math.floor((k.pwPrev || 0) * 10)) Sfx.tone(300 + k.pw * 500, 0.02, 'sine', 0.025); k.pwPrev = k.pw; }
      if (k.left <= 0) {
        if (k.charging) this.throw_(k.pw);
        else { this.float(this.px[i], GY - 250, 'Hết giờ!', '#ff5d73'); this.k = { k: 'wait', t: 0 }; Sfx.play('warn'); }
      }
    }
    onPointer(x, y, type) {
      const k = this.k, i = this.turn;
      if (!k || k.k !== 'turn' || this.ps[i].bot) return;
      if (type === 'down') {
        for (let n = 0; n < ITEMS.length; n++) {
          const c = this.itemPos(i, n);
          if (Math.hypot(x - c.x, y - c.y) < ITEM_R + 6) { this.sel[i] = n; this.useItem(ITEMS[n].id); return; }
        }
        k.mouse = true;
      } else if (type === 'up') k.mouse = false;
    }
    itemPos(i, n) {
      const x0 = this.px[i] - (ITEMS.length - 1) * ITEM_GAP / 2;
      return { x: x0 + n * ITEM_GAP, y: ITEM_Y };
    }
    botInput() { return {}; }
    posOf(i) { return { x: this.px[i], y: GY - 90 }; }
    results() {
      return this.ps.map((p, i) => ({ score: this.wins[i] * 1000 + this.stat[i].hit,
        text: `${EMO[i]} ${this.wins[i]} hiệp thắng · trúng ${this.stat[i].hit} (đầu ${this.stat[i].head})` }));
    }

    /* ---------- vẽ ---------- */
    draw(ctx) {
      this.drawBg(ctx);
      // vết rơi
      for (const s of this.splats) {
        ctx.globalAlpha = Math.max(0, 1 - s.t / 3) * 0.6; ctx.fillStyle = s.c;
        ctx.beginPath(); ctx.ellipse(s.x, GY + 4, 22, 6, 0, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // bóng đổ chỗ đồ sắp rơi (Né tránh, chỉ hiện khi đồ đã qua đỉnh)
      if (this.dodge) {
        for (const s of this.shots) {
          if (s.done || s.landX === null || s.vy <= 0) continue;
          const kk = U.clamp(1 - (s.landT - s.t) / 0.9, 0, 1);
          ctx.fillStyle = `rgba(20,10,30,${0.15 + 0.4 * kk})`;
          ctx.beginPath(); ctx.ellipse(s.landX, GY + 3, 14 + 34 * kk, 5 + 5 * kk, 0, 0, 7); ctx.fill();
        }
      }
      // nhân vật
      for (let i = 0; i < 2; i++) this.drawChar(ctx, i);
      if (this.dodge && this.k.k === 'fly' && !this.ps[1 - this.turn].bot) {
        const o = 1 - this.turn;
        Draw.text(ctx, '← → chạy né!', this.px[o], GY - 250 + Math.sin(this.t * 10) * 3, { size: 24, color: '#ffd23f', sw: 5 });
      }
      // đồ đang bay + vệt
      for (const s of this.shots) {
        if (s.done && s.state !== 'drop') continue;
        s.trail.forEach(([x, y], n) => { ctx.globalAlpha = (n + 1) / s.trail.length * 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, s.r * 0.45 * (n + 1) / s.trail.length, 0, 7); ctx.fill(); });
        ctx.globalAlpha = 1;
        if (!s.done) A.item(ctx, s.ammo, s.x, s.y, s.rot, s.big ? 1.3 : 0.9);
      }
      this.drawHud(ctx);
      for (const f of this.floats) {
        const a = Math.min(1, (1.4 - f.t) * 2.5);
        ctx.globalAlpha = a;
        Draw.text(ctx, f.s, f.x, f.y - f.t * 40, { size: f.size, color: f.c, sw: 6 });
      }
      ctx.globalAlpha = 1;
      this.drawBanners(ctx);
    }
    drawBg(ctx) {
      if (this.mapId === 'beach') this.bgBeach(ctx);
      else if (this.mapId === 'roof') this.bgRoof(ctx);
      else this.bgYard(ctx);
      const F = this.map.wall;
      this.drawFlag(ctx, (F.x0 + F.x1) / 2, F.top - (this.mapId === 'roof' ? 16 : 4));
    }
    clouds_(ctx, col) {
      ctx.fillStyle = col;
      for (const c of this.clouds) {
        ctx.beginPath(); ctx.arc(c.x, c.y, 24 * c.s, 0, 7); ctx.arc(c.x + 30 * c.s, c.y - 12 * c.s, 30 * c.s, 0, 7); ctx.arc(c.x + 62 * c.s, c.y, 22 * c.s, 0, 7); ctx.fill();
      }
    }
    bgYard(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, GY);
      g.addColorStop(0, '#7cc8ff'); g.addColorStop(1, '#dff3ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY);
      // mặt trời + mây trôi theo gió
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(1130, 120, 46, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const c of this.clouds) {
        ctx.beginPath(); ctx.arc(c.x, c.y, 24 * c.s, 0, 7); ctx.arc(c.x + 30 * c.s, c.y - 12 * c.s, 30 * c.s, 0, 7); ctx.arc(c.x + 62 * c.s, c.y, 22 * c.s, 0, 7); ctx.fill();
      }
      // đồi xa
      ctx.fillStyle = '#a6dd8f';
      ctx.beginPath(); ctx.moveTo(0, GY); ctx.quadraticCurveTo(220, 470, 470, GY - 40); ctx.quadraticCurveTo(700, 450, 900, GY - 50); ctx.quadraticCurveTo(1100, 470, 1280, GY - 30); ctx.lineTo(1280, GY); ctx.fill();
      // nhà Mèo (trái) + chuồng Chó (phải)
      house(ctx, 70, GY, '#ffb3c7', '#d9577a', '🐟');
      kennel(ctx, 1190, GY);
      // mặt đất
      ctx.fillStyle = '#6cc25a'; ctx.fillRect(0, GY, W, H - GY);
      ctx.fillStyle = '#58aa48'; ctx.fillRect(0, GY, W, 8);
      ctx.fillStyle = '#4e9a40';
      for (let x = 10; x < W; x += 37) { ctx.beginPath(); ctx.moveTo(x, GY + 2); ctx.lineTo(x + 5, GY - 9); ctx.lineTo(x + 10, GY + 2); ctx.fill(); }
      // hàng rào
      const F = this.map.wall;
      for (let n = 0; n < 3; n++) {
        const x = F.x0 + n * 12;
        ctx.fillStyle = n % 2 ? '#c98d55' : '#d9a066';
        ctx.beginPath(); ctx.moveTo(x, GY); ctx.lineTo(x, F.top + 8); ctx.lineTo(x + 6, F.top - 4); ctx.lineTo(x + 12, F.top + 8); ctx.lineTo(x + 12, GY); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#7a4e2a'; ctx.lineWidth = 2.5; ctx.stroke();
      }
      ctx.fillStyle = '#a8703f'; ctx.fillRect(F.x0 - 6, F.top + 60, F.x1 - F.x0 + 12, 12); ctx.fillRect(F.x0 - 6, GY - 90, F.x1 - F.x0 + 12, 12);
    }
    /** cờ gió trên đỉnh vật cản: bay theo hướng gió, dài theo sức gió */
    drawFlag(ctx, px, py) {
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 70); ctx.stroke();
      const w = this.windShow, len = 14 + Math.abs(w) * 6, dir = w >= 0 ? 1 : -1, wave = Math.sin(this.t * 9) * (2 + Math.abs(w) * 0.6);
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath(); ctx.moveTo(px, py - 70); ctx.quadraticCurveTo(px + dir * len * 0.5, py - 70 + wave, px + dir * len, py - 62 + (Math.abs(w) < 1 ? 14 : 0)); ctx.lineTo(px, py - 52); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 2; ctx.stroke();
    }
    bgBeach(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, GY);
      g.addColorStop(0, '#5ec2ff'); g.addColorStop(1, '#ffe7c2');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY);
      ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(1090, 150, 52, 0, 7); ctx.fill();
      this.clouds_(ctx, 'rgba(255,255,255,0.85)');
      // biển + sóng
      const sg = ctx.createLinearGradient(0, 470, 0, GY);
      sg.addColorStop(0, '#1f8fd1'); sg.addColorStop(1, '#78d2ef');
      ctx.fillStyle = sg; ctx.fillRect(0, 470, W, GY - 470);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
      for (let row = 0; row < 3; row++) {
        const y = 492 + row * 40, off = (this.t * (30 + row * 12)) % 90;
        for (let x = -90 + off; x < W; x += 90) { ctx.beginPath(); ctx.arc(x, y, 14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      }
      // cát
      ctx.fillStyle = '#f3d9a0'; ctx.fillRect(0, GY - 14, W, H - GY + 14);
      ctx.fillStyle = '#e6c27f'; ctx.fillRect(0, GY - 14, W, 6);
      ctx.fillStyle = '#e9cc8f';
      for (let x = 24; x < W; x += 53) { ctx.beginPath(); ctx.ellipse(x, GY + 30 + (x % 3) * 18, 6, 3, 0, 0, 7); ctx.fill(); }
      // cây dừa (trái) + dù (phải)
      ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(60, GY - 4); ctx.quadraticCurveTo(40, GY - 140, 86, GY - 250); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#3fae5a';
      for (let n = 0; n < 6; n++) {
        const a = -Math.PI / 2 + (n - 2.5) * 0.55 + Math.sin(this.t * 1.5 + n) * 0.04;
        ctx.save(); ctx.translate(86, GY - 250); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(48, 0, 54, 13, 0.25, 0, 7); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = '#7a4a2a'; [[78, GY - 240], [96, GY - 236]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); });
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(1205, GY); ctx.lineTo(1225, GY - 170); ctx.stroke();
      for (let n = 0; n < 6; n++) {
        ctx.fillStyle = n % 2 ? '#fff' : '#ff5d73';
        ctx.beginPath(); ctx.moveTo(1225, GY - 172);
        ctx.arc(1225, GY - 172, 82, Math.PI + n * Math.PI / 6, Math.PI + (n + 1) * Math.PI / 6); ctx.closePath(); ctx.fill();
      }
      // lưới bóng chuyền: cột + tấm lưới
      const F = this.map.wall, cx = (F.x0 + F.x1) / 2;
      ctx.fillStyle = '#dcdcdc'; ctx.fillRect(cx - 4, F.top, 8, GY - F.top);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 4, F.top, 8, GY - F.top);
      ctx.strokeStyle = 'rgba(40,40,40,0.75)'; ctx.lineWidth = 1.5;
      for (let y = F.top + 8; y <= F.top + 120; y += 12) { ctx.beginPath(); ctx.moveTo(F.x0, y); ctx.lineTo(F.x1, y); ctx.stroke(); }
      for (let x = F.x0; x <= F.x1; x += 9) { ctx.beginPath(); ctx.moveTo(x, F.top + 8); ctx.lineTo(x, F.top + 120); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.fillRect(F.x0 - 2, F.top, F.x1 - F.x0 + 4, 8);
      ctx.strokeStyle = '#555'; ctx.strokeRect(F.x0 - 2, F.top, F.x1 - F.x0 + 4, 8);
    }
    bgRoof(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, GY);
      g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#2d2f6e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY);
      for (const st of this.stars) {
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.t * (0.8 + st.s) + st.x));
        ctx.fillStyle = '#fff'; ctx.fillRect(st.x, st.y, 2 + st.s, 2 + st.s);
      }
      ctx.globalAlpha = 1;
      // trăng
      ctx.fillStyle = '#fff6c9'; ctx.beginPath(); ctx.arc(1100, 130, 50, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(200,190,140,0.5)'; [[1085, 118, 9], [1115, 145, 7], [1095, 152, 5]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
      // phố xa có cửa sổ sáng
      const B = [[0, 120, 160], [130, 90, 210], [230, 140, 130], [380, 100, 190], [470, 70, 240], [760, 90, 220], [860, 130, 150], [1000, 100, 200], [1110, 170, 140]];
      for (const [x, w, h] of B) {
        ctx.fillStyle = '#1a1c40'; ctx.fillRect(x, GY - h, w, h);
        for (let yy = GY - h + 14; yy < GY - 20; yy += 26) for (let xx = x + 12; xx < x + w - 14; xx += 22) {
          if (((xx * 7 + yy * 13) % 5) < 2) { ctx.fillStyle = '#ffd86b'; ctx.fillRect(xx, yy, 9, 12); }
        }
      }
      // mái ngói
      ctx.fillStyle = '#8c3b3b'; ctx.fillRect(0, GY, W, H - GY);
      ctx.fillStyle = '#6e2b2b'; ctx.fillRect(0, GY, W, 7);
      ctx.strokeStyle = '#6e2b2b'; ctx.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        const y = GY + 20 + row * 26, off = row % 2 ? 18 : 0;
        for (let x = -36 + off; x < W; x += 36) { ctx.beginPath(); ctx.arc(x + 18, y, 18, 0, Math.PI); ctx.stroke(); }
      }
      // ống khói gạch + khói bay theo gió
      const F = this.map.wall;
      ctx.fillStyle = '#a3523a'; ctx.fillRect(F.x0, F.top, F.x1 - F.x0, GY - F.top);
      ctx.strokeStyle = '#6d3424'; ctx.lineWidth = 2;
      for (let y = F.top + 14; y < GY; y += 16) {
        ctx.beginPath(); ctx.moveTo(F.x0, y); ctx.lineTo(F.x1, y); ctx.stroke();
        const off = ((y - F.top) / 16) % 2 ? 0 : 22;
        for (let x = F.x0 + off; x < F.x1; x += 44) { ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x, y); ctx.stroke(); }
      }
      ctx.strokeRect(F.x0, F.top, F.x1 - F.x0, GY - F.top);
      ctx.fillStyle = '#7c3a28'; ctx.fillRect(F.x0 - 8, F.top - 14, F.x1 - F.x0 + 16, 16); ctx.strokeRect(F.x0 - 8, F.top - 14, F.x1 - F.x0 + 16, 16);
      for (const p of this.smoke) {
        ctx.globalAlpha = Math.max(0, 0.45 * (1 - p.t / 3.2));
        ctx.fillStyle = '#c9cbe0'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawChar(ctx, i) {
      const k = this.k, i2 = this.turn;
      let pose = 'idle', power = 0, item = null;
      if (k.k === 'ko' || k.k === 'over') {
        const loser = k.k === 'ko' ? k.loser : 1 - k.winner;
        pose = i === loser ? 'ko' : (k.t > 0.5 || k.k === 'over' ? 'win' : 'idle');
      } else if (this.anim[i]) pose = this.anim[i].pose;
      else if (i === i2 && k.k === 'turn' && k.charging) { pose = 'aim'; power = k.pw; }
      if (i === i2 && k.k === 'turn') item = AMMO[i][this.stat[i].throws % 2];
      const bob = this.walk[i] ? Math.abs(Math.sin(this.t * 16)) * 6 : 0;
      A.draw(ctx, KIND[i], { x: this.px[i], y: GY - bob, scale: SC, face: FACE[i], pose, t: this.t + i * 1.7, collar: this.ps[i].color.main, power, item });
      // bó cứu thương khi máu thấp
      if (this.hp[i] > 0 && this.hp[i] <= 35 && pose !== 'ko') {
        const hx = this.px[i] + FACE[i] * -20 * SC, hy = GY - 150 * SC;
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.6 * FACE[i]);
        Draw.rr(ctx, -14, -5, 28, 10, 4); ctx.fillStyle = '#ffe2c4'; ctx.fill(); ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#e8b48c'; ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      }
    }
    drawHud(ctx) {
      const k = this.k;
      // thanh máu hai bên
      for (let i = 0; i < 2; i++) {
        const p = this.ps[i], left = i === 0, x0 = left ? 30 : W - 30 - 440, y0 = 22, w = 440;
        Draw.rr(ctx, x0, y0, w, 30, 15); ctx.fillStyle = 'rgba(30,20,50,0.55)'; ctx.fill();
        const f = this.hp[i] / this.maxHp, fw = Math.max(0, (w - 8) * f);
        const col = f > 0.5 ? '#5dff9b' : f > 0.25 ? '#ffd23f' : '#ff5d73';
        if (fw > 0) { Draw.rr(ctx, left ? x0 + 4 : x0 + w - 4 - fw, y0 + 4, fw, 22, 11); ctx.fillStyle = col; ctx.fill(); }
        txt(ctx, `${this.hp[i]}`, left ? x0 + w - 14 : x0 + 14, y0 + 16, 18, '#fff', left ? 'right' : 'left');
        txt(ctx, `${EMO[i]} ${p.name}${p.bot ? ' 🤖' : ''}`, left ? x0 + 6 : x0 + w - 6, y0 + 48, 20, this.info.ink, left ? 'left' : 'right');
        // số hiệp thắng
        for (let n = 0; n < this.need; n++) {
          const cx = left ? x0 + w - 12 - n * 22 : x0 + 12 + n * 22;
          ctx.beginPath(); ctx.arc(cx, y0 + 48, 8, 0, 7);
          ctx.fillStyle = n < this.wins[i] ? '#ffd23f' : 'rgba(255,255,255,0.6)'; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = '#3a2a2a'; ctx.stroke();
        }
      }
      txt(ctx, `Hiệp ${this.round} · ${this.info.name}`, W / 2, 38, 22, this.info.ink);
      // gió
      const w = this.wind, wx = W / 2, wy = 82;
      Draw.rr(ctx, wx - 92, wy - 20, 184, 40, 20); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
      txt(ctx, 'Gió', wx - 62, wy + 1, 18, '#2b2240');
      if (w === 0) txt(ctx, 'lặng', wx + 20, wy + 1, 20, '#3d8bd6');
      else {
        const L = 18 + Math.abs(w) * 5, d = Math.sign(w), cx = wx + 14;
        ctx.strokeStyle = '#3d8bd6'; ctx.fillStyle = '#3d8bd6'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - d * L / 2, wy); ctx.lineTo(cx + d * L / 2, wy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + d * (L / 2 + 10), wy); ctx.lineTo(cx + d * (L / 2 - 4), wy - 10); ctx.lineTo(cx + d * (L / 2 - 4), wy + 10); ctx.fill();
        txt(ctx, `${Math.abs(w)}`, wx + 70, wy + 1, 20, '#2b2240');
      }
      // lượt hiện tại: vật phẩm, thanh lực, đồng hồ, mũi tên
      for (let i = 0; i < 2; i++) this.drawItems(ctx, i);
      if (k.k === 'turn' || k.k === 'fly' || k.k === 'result') {
        const i = this.turn, x = this.px[i], bx = x - FACE[i] * 104 - BAR.w / 2, by = GY - 34 - BAR.h;
        // thanh lực
        Draw.rr(ctx, bx, by, BAR.w, BAR.h, 9); ctx.fillStyle = 'rgba(30,20,50,0.55)'; ctx.fill();
        const pw = k.k === 'turn' ? k.pw : this.lastPow[i] || 0;
        const gg = ctx.createLinearGradient(0, by + BAR.h, 0, by);
        gg.addColorStop(0, '#5dff9b'); gg.addColorStop(0.6, '#ffd23f'); gg.addColorStop(1, '#ff5d73');
        if (pw > 0) { Draw.rr(ctx, bx + 3, by + 3 + (BAR.h - 6) * (1 - pw), BAR.w - 6, (BAR.h - 6) * pw, 7); ctx.fillStyle = gg; ctx.fill(); }
        ctx.lineWidth = 3; ctx.strokeStyle = '#3a2a2a'; Draw.rr(ctx, bx, by, BAR.w, BAR.h, 9); ctx.stroke();
        // vạch lực lần trước
        if (this.lastPow[i] !== null && k.k === 'turn') {
          const ly = by + 3 + (BAR.h - 6) * (1 - this.lastPow[i]);
          ctx.fillStyle = '#fff'; ctx.fillRect(bx - 6, ly - 2, BAR.w + 12, 4);
          Draw.text(ctx, 'lần trước', bx + BAR.w / 2 - FACE[i] * 48, ly, { size: 14, color: '#fff', sw: 4 });
        }
        if (k.k === 'turn' && k.charging && !this.ps[i].bot && this.api.opts && this.api.opts.hint === 'on') {
          // gợi ý: một đoạn đầu đường bay với lực đang giữ
          const path = C.simulate(this.px[i], FACE[i], k.pw, this.wind, null, { big: k.big, wall: this.map.wall, path: true, ang: this.angOf(i) }).path || [];
          const n = Math.floor(path.length * 0.42);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          for (let q = 2; q < n; q += 2) { ctx.beginPath(); ctx.arc(path[q][0], path[q][1], 4 * (1 - q / n) + 1.5, 0, 7); ctx.fill(); }
        }
        if (k.k === 'turn' && this.freeAng()) this.drawAim(ctx, i);
        if (k.k === 'turn') {
          // mũi tên tới lượt + đồng hồ lượt bên cạnh
          const ay = GY - 346 + Math.sin(this.t * 6) * 6;
          const sec = Math.max(0, Math.ceil(k.left));
          Draw.text(ctx, `⏱ ${sec}`, x + 52, GY - 356, { size: 22, color: sec <= 3 ? '#ff5d73' : '#fff', sw: 5 });
          ctx.fillStyle = this.ps[i].color.main; ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x - 14, ay - 16); ctx.lineTo(x + 14, ay - 16); ctx.lineTo(x, ay); ctx.closePath(); ctx.fill(); ctx.stroke();
          if (!this.ps[i].bot && k.t < 4 && !k.charging) txt(ctx, this.freeAng() ? '↑ ↓ canh góc · giữ nút Đánh để lấy lực' : 'Giữ nút Đánh để lấy lực', x + FACE[i] * 30, GY + 46, 18, '#fff');
        }
      }
    }
    /** mũi tên ngắm từ tay theo góc đang chọn + số độ (vạch mờ = 55° như bản gốc) */
    drawAim(ctx, i) {
      const k = this.k, a = this.angOf(i), f = FACE[i], h = C.handOf(this.px[i], f);
      const len = 92 + (k.charging ? k.pw * 40 : 0);
      const dx = f * Math.cos(a), dy = -Math.sin(a);
      ctx.save();
      ctx.lineCap = 'round';
      // cung góc + vạch góc gốc
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4;
      ctx.beginPath();
      if (f === 1) ctx.arc(h.x, h.y, 46, -C.ANG_MAX, -C.ANG_MIN); else ctx.arc(h.x, h.y, 46, Math.PI + C.ANG_MIN, Math.PI + C.ANG_MAX);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(h.x + f * Math.cos(C.ANG) * 40, h.y - Math.sin(C.ANG) * 40); ctx.lineTo(h.x + f * Math.cos(C.ANG) * 52, h.y - Math.sin(C.ANG) * 52); ctx.stroke();
      // mũi tên nét đứt
      const col = this.ps[i].color.main;
      ctx.setLineDash([14, 9]); ctx.lineDashOffset = -this.t * 30;
      ctx.beginPath(); ctx.moveTo(h.x + dx * 22, h.y + dy * 22); ctx.lineTo(h.x + dx * len, h.y + dy * len);
      ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 5.5; ctx.stroke();
      ctx.setLineDash([]);
      const tx = h.x + dx * (len + 14), ty = h.y + dy * (len + 14), nx = -dy * f, ny = dx * f;
      ctx.fillStyle = col; ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - dx * 20 + nx * 11 * f, ty - dy * 20 + ny * 11 * f);
      ctx.lineTo(tx - dx * 20 - nx * 11 * f, ty - dy * 20 - ny * 11 * f);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      // số độ bên dưới mũi tên
      Draw.text(ctx, `${this.degOf(i)}°`, h.x + f * 94, h.y + 6, { size: 24, color: '#fff', sw: 5 });
    }
    drawItems(ctx, i) {
      const k = this.k, mine = this.turn === i && k.k === 'turn', human = !this.ps[i].bot;
      for (let n = 0; n < ITEMS.length; n++) {
        const it = ITEMS[n], c = this.itemPos(i, n), used = this.used[i].has(it.id) && k.item !== it.id;
        const armed = mine && k.item === it.id;
        ctx.globalAlpha = used ? 0.3 : mine ? 1 : 0.75;
        ctx.beginPath(); ctx.arc(c.x, c.y, ITEM_R, 0, 7);
        ctx.fillStyle = armed ? '#ffd23f' : 'rgba(255,255,255,0.85)'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#3a2a2a'; ctx.stroke();
        txt(ctx, it.icon, c.x, c.y + 1, 22, '#000');
        if (mine && human && this.sel[i] === n && !k.charging) {
          ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(c.x, c.y, ITEM_R + 6, 0, 7); ctx.lineWidth = 3.5; ctx.strokeStyle = this.ps[i].color.main; ctx.stroke();
          txt(ctx, it.name, c.x, c.y - ITEM_R - 14, 15, this.info.ink);
        }
      }
      ctx.globalAlpha = 1;
    }
    drawBanners(ctx) {
      const k = this.k;
      if (k.k === 'start') {
        const p = this.ps[this.turn];
        Draw.banner(ctx, `Hiệp ${this.round}`, k.t, { y: 260, size: 80, color: '#ffd23f', sub: `${EMO[this.turn]} ${p.name} ném trước` });
      } else if (k.k === 'ko' && k.t > 0.4) {
        const w = 1 - k.loser;
        Draw.banner(ctx, `${EMO[w]} ${this.ps[w].name} thắng hiệp!`, k.t - 0.4, { y: 260, size: 64, color: this.ps[w].color.light });
      } else if (k.k === 'over') {
        const w = k.winner;
        Draw.banner(ctx, `🏆 ${NAME[w]} ${this.ps[w].name} thắng!`, k.t, { y: 250, size: 76, color: '#ffd23f', sub: `${this.wins[0]} – ${this.wins[1]}` });
      }
    }
  }

  /* ---------- tiện ích vẽ ---------- */
  function txt(ctx, s, x, y, size, color, align = 'center') {
    ctx.font = `700 ${size}px ${UI}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.textBaseline = 'alphabetic';
  }
  function house(ctx, cx, gy, wall, roof, sign) {
    ctx.lineJoin = 'round';
    ctx.fillStyle = wall; ctx.fillRect(cx - 60, gy - 120, 120, 120);
    ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 3; ctx.strokeRect(cx - 60, gy - 120, 120, 120);
    ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(cx - 76, gy - 116); ctx.lineTo(cx, gy - 184); ctx.lineTo(cx + 76, gy - 116); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a5a3a'; Draw.rr(ctx, cx - 18, gy - 62, 36, 62, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#bfe7ff'; ctx.fillRect(cx + 26, gy - 98, 24, 24); ctx.strokeRect(cx + 26, gy - 98, 24, 24);
    txt(ctx, sign, cx - 38, gy - 86, 22, '#000');
  }
  function kennel(ctx, cx, gy) {
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 3;
    ctx.fillStyle = '#e09a54'; ctx.fillRect(cx - 62, gy - 92, 124, 92); ctx.strokeRect(cx - 62, gy - 92, 124, 92);
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(cx - 76, gy - 88); ctx.lineTo(cx, gy - 150); ctx.lineTo(cx + 76, gy - 88); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2a2a'; ctx.beginPath(); ctx.moveTo(cx - 28, gy); ctx.lineTo(cx - 28, gy - 44); ctx.arc(cx, gy - 44, 28, Math.PI, 0); ctx.lineTo(cx + 28, gy); ctx.closePath(); ctx.fill();
    Draw.rr(ctx, cx - 30, gy - 120, 60, 20, 6); ctx.fillStyle = '#fff6e2'; ctx.fill(); ctx.stroke();
    txt(ctx, 'GÂU', cx, gy - 109, 14, '#3a2a2a');
  }

  Party.register({
    id: 'catdog', name: 'Cat and Dog', emoji: '🐱', cat: 'fight',
    tagline: 'Mèo và Chó ném đồ qua hàng rào theo lượt. Canh lực ném, xem gió, trúng đầu mất nhiều máu nhất!',
    how: 'Thay phiên ném đồ qua hàng rào. ↑ ↓ canh góc ném (mũi tên + số độ; tuỳ chọn Góc ném: Cố định = 55° như bản gốc). Giữ nút Đánh cho thanh lực dâng (giữ quá đỉnh thì tụt lại), thả ra để ném; vạch trắng là lực lần trước. Gió đổi mỗi lượt — xem cờ trên rào. Trúng đầu mất nhiều máu nhất. Mỗi hiệp, mỗi bên có 4 vật phẩm dùng một lần: Ném đôi, Ném mạnh, Hồi máu (mất lượt), Lặng gió — ← → chọn, Nhảy dùng. Hết máu là thua hiệp.',
    controls: { move: 'Chọn đồ · ↑ ↓ góc', act: 'Giữ lấy lực, thả ném', jump: 'Dùng đồ' },
    helpExtra: '🖱️ chuột: giữ rồi thả để ném, bấm vật phẩm để dùng',
    minPlayers: 2, maxPlayers: 2, rawBot: true,
    modes: [
      { id: 'classic', name: 'Cổ điển', icon: '🎯', desc: 'Như bản gốc: đứng yên, chỉ canh lực và gió.' },
      { id: 'dodge', name: 'Né tránh', icon: '🏃', desc: 'Người đang bị ném được chạy ← → trong sân mình để né — đồ qua đỉnh là hiện bóng đổ chỗ sắp rơi. Ném xong tự về chỗ cũ.',
        how: 'Như Cổ điển, thêm: khi đối thủ ném, bạn được chạy ← → trong sân mình để né. Đồ bay qua đỉnh thì hiện bóng đổ chỗ sắp rơi — chạy khỏi bóng đổ! Ném xong ai cũng tự về chỗ cũ.',
        controls: { move: 'Chọn đồ · chạy né · ↑ ↓ góc', act: 'Giữ lấy lực, thả ném', jump: 'Dùng đồ' } },
    ],
    variants: { label: 'Bản đồ', items: [
      { id: 'yard', name: 'Sân sau', icon: '🏡', desc: 'Hàng rào gỗ giữa hai sân, gió vừa' },
      { id: 'beach', name: 'Bãi biển', icon: '🏖️', desc: 'Ném qua lưới bóng chuyền, gió biển mạnh hơn' },
      { id: 'roof', name: 'Mái nhà ban đêm', icon: '🌙', desc: 'Trên mái nhà, ném qua ống khói cao; khói bay theo gió' },
      { id: 'random', name: 'Ngẫu nhiên', icon: '🎲', desc: 'Mỗi hiệp một bản đồ' },
    ] },
    options: [{ id: 'angle', label: 'Góc ném', items: [
      { id: 'free', name: 'Tự canh góc', icon: '📐', desc: '↑ ↓ chỉnh góc ném 40°–75° trước khi giữ lực' },
      { id: 'fixed', name: 'Cố định', icon: '📌', desc: 'Như bản gốc: góc 55°, chỉ canh lực' },
    ] }, { id: 'hint', label: 'Gợi ý đường bay', items: [
      { id: 'off', name: 'Tắt', icon: '🚫', desc: 'Như bản gốc: tự canh lực' },
      { id: 'on', name: 'Bật', icon: '✨', desc: 'Lúc giữ lực hiện một đoạn đầu đường bay (cho người mới)' },
    ] }],
    create: (api) => new CatDog(api),
  });
})();

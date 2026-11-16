// 2048 (1 người, tab Trí tuệ): trượt ô, hai ô cùng số chạm nhau thì gộp. Ô số "nổi" (bóng gradient, viền khối, chữ viền dày),
// càng lớn càng rực: phát sáng từ 128, lấp lánh từ 512, vệt sáng quét từ 1024, vương miện ở ô mục tiêu, ô 16384+ nền thiên hà
// chữ cầu vồng. 3 chế độ: Cổ điển (cỡ 3×3–6×6, lưu ván dở + kỷ lục), Thử thách (12 màn có ô đá / giới hạn nước, chấm sao),
// Ván mỗi ngày (cả ngày cùng một ván, 250 nước, giữ chuỗi ngày). Gợi ý nước đi bằng expectimax (3 lần mỗi ván). Lõi: g2048_core.js.
(() => {
  'use strict';
  const C = window.G2048Core;

  const BS = 600;                              // cạnh bàn
  const BX = 340, BY = 60;                     // góc trên-trái bàn
  const SLIDE = 0.11, POP = 0.17, GROW = 0.15; // giây: trượt, nảy khi gộp, ô mới lớn dần
  const HOLD_NEW = 1;                          // giữ Đánh 1 giây = ván mới
  const HINTS = 3;                             // số lần gợi ý mỗi ván (Cổ điển, Thử thách)
  const HINT_T = 4;                            // mũi tên gợi ý hiện tối đa (giây) hoặc tới nước kế
  const BOT_DT = 0.14, BOT_CAP = 600;          // máy (smoke test / ảnh thẻ): nhịp đi, tối đa số nước
  const STORE = 'tronparty.g2048';
  const DIRS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
  const DIR_NAME = ['lên', 'phải', 'xuống', 'trái'], DIR_ARROW = ['↑', '→', '↓', '←'];
  const LV = C.LEVELS;

  function mix(a, b, k) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const x = p(a), y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }
  // màu từng bậc (số mũ 1 = ô 2 …): [trên, dưới] của gradient — lạnh → nóng → neon, 16384 trở lên nền thiên hà tối
  const GRAD = [null,
    ['#8fd3ff', '#3f9bff'], ['#7be3a8', '#22b866'], ['#ffe066', '#ffaa00'], ['#ffb26b', '#ff7417'],
    ['#ff8a7a', '#ee3b2e'], ['#ff7cb4', '#e5246a'], ['#cf95ff', '#8a3dff'], ['#95a4ff', '#4552ff'],
    ['#5ef0d8', '#0ba58e'], ['#ffc46b', '#ff6a00'], ['#fff09a', '#ffae00'], ['#ff86e4', '#bb15b0'],
    ['#78e8ff', '#1a5cff'], ['#4a2f80', '#140a2e'], ['#3b1d5e', '#0a0518']];
  const TOPN = GRAD.length - 1;
  const PAL = GRAD.map((g, e) => g && { a: g[0], b: g[1], deep: mix(g[1], '#14082a', 0.55), lite: e >= 14 ? '#f0ddff' : mix(g[0], '#ffffff', 0.55) });
  const tierOf = (e) => Math.min(e, TOPN);
  const val = (e) => 2 ** e;
  const FS = [0, 0.52, 0.47, 0.39, 0.31, 0.255, 0.215];   // cỡ chữ theo số chữ số (× cạnh ô)

  function loadStore() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function saveStore(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* bỏ qua */ } }
  /** ngày theo giờ máy, dạng YYYY-MM-DD (off = lệch ngày) */
  function dayKey(off = 0) {
    const d = new Date(); d.setDate(d.getDate() + off);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const dayShort = (k) => `${+k.slice(8, 10)}/${+k.slice(5, 7)}`;

  const txt = (ctx, s, x, y, size, color, align = 'center', weight = 800, base = 'middle') => {
    ctx.font = `${weight} ${size}px "Baloo 2", sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
    ctx.fillText(s, x, y);
  };
  const ease = (k) => 1 - (1 - k) * (1 - k);
  /** ngôi sao 5 cánh */
  function star(ctx, x, y, r, on) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = on ? '#ffd23f' : 'rgba(255,255,255,0.12)'; ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.strokeStyle = on ? '#b07400' : 'rgba(255,255,255,0.22)'; ctx.stroke();
    ctx.restore();
  }

  let ACTIVE = null;
  const live = (g) => g && ACTIVE === g && typeof App !== 'undefined' && App.inst === g;
  addEventListener('keydown', (e) => {
    const g = ACTIVE;
    if (!live(g) || App.state !== 'play') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (g.onKey(e)) e.preventDefault();
  });
  setInterval(() => {
    if (ACTIVE && !(typeof App !== 'undefined' && App.inst === ACTIVE && ['play', 'paused', 'ending', 'countdown'].includes(App.state))) {
      if (App && App.cv) App.cv.style.cursor = '';
      ACTIVE = null;
    }
  }, 250);

  class G2048 {
    constructor(api) {
      this.api = api;
      this.ownHelp = true; this.ownEndBanner = true; this.quickStart = true;
      this.mode = ['challenge', 'daily'].includes(api.mode) ? api.mode : 'classic';
      this.p = api.players[0];
      this.bot = !!this.p.bot;
      this.finished = false;
      this.began = false;
      this.btns = []; this.hover = null;
      this.botNoise = 0.25;                    // máy đi bừa 25% để ván không quá dài (make-thumbs hạ xuống cho ảnh đẹp)
      ACTIVE = this;
    }
    /** cỡ bàn theo tuỳ chọn (đọc mỗi lần — app không tạo lại instance khi đổi tuỳ chọn) */
    size() { const s = +(this.api.opts && this.api.opts.size); return C.SIZES.includes(s) ? s : 4; }
    cfgKey() { return this.mode === 'classic' ? this.size() : this.mode; }
    get goalTile() { return val(this.goalExp()); }
    goalExp() { return this.mode === 'challenge' && this.L ? this.L.goal : C.TARGET[this.N || this.size()]; }
    /** số nước tối đa của ván (0 = không giới hạn) */
    limit() { return this.mode === 'daily' ? C.DAILY_MOVES : this.mode === 'challenge' && this.L ? this.L.limit : 0; }
    unlocked(i) { return i === 0 || !!(this.chDone[LV[i - 1].id]); }

    /* ---------- dựng ván ---------- */
    begin() {
      this.began = true;
      this.cfg = this.cfgKey();
      this.anim = null; this.queue = -1; this.lastDir = -1;
      this.floats = []; this.msg = null; this.holdT = 0; this.confirmT = 0; this.botT = 0;
      this.overT = 0; this.newBest = false; this.hint = null; this.unlock = null;
      const st = loadStore();
      this.coll = st.coll | 0;
      this.chDone = (st.ch && st.ch.done) || {};
      this.daily = st.daily || { days: {}, streak: 0, best: 0, last: null };
      if (this.mode === 'challenge') {
        // máy (smoke test) vào thẳng màn 1; người thì chọn màn — mặc định màn đầu tiên chưa qua
        const sv = st.chSave;
        let sel = LV.findIndex((L, i) => this.unlocked(i) && !this.chDone[L.id]);
        if (sel < 0) sel = 0;
        if (sv && !this.bot) { const k = LV.findIndex((L) => L.id === sv.id); if (k >= 0) sel = k; }
        this.sel = sel;
        if (this.bot) { this.startLevel(0); return; }
        this.N = LV[sel].N; this.L = LV[sel];
        this.phase = 'levels';
        this.cells = new Array(this.N * this.N).fill(0); this.score = 0; this.moves = 0; this.top = 0;
        return;
      }
      this.phase = 'play';
      if (this.mode === 'daily') {
        this.day = dayKey(); this.N = 4;
        const sv = !this.bot && st.dsave;
        if (sv && sv.date === this.day && Array.isArray(sv.cells) && sv.cells.length === 16 && C.canMove(sv.cells, 4) && sv.moves < C.DAILY_MOVES) {
          this.load(sv);
          this.say('Chơi tiếp ván hôm nay', '#9ee6ff');
        } else this.fresh();
        this.hints = 0;
        return;
      }
      this.N = this.size();
      this.best = ((st.best && st.best[this.N]) || 0);
      const sv = !this.bot && st.saves && st.saves[this.N];
      if (sv && Array.isArray(sv.cells) && sv.cells.length === this.N * this.N && C.canMove(sv.cells, this.N)) {
        this.load(sv);
        this.say('Chơi tiếp ván dở — bấm ↻ để chơi ván mới', '#9ee6ff');
      } else this.fresh();
    }
    load(sv) {
      this.cells = sv.cells.slice(); this.score = sv.score | 0; this.moves = sv.moves | 0;
      this.rng = C.makeRng(sv.rng | 0); this.won = !!sv.won;
      this.hints = sv.hints ?? HINTS;
      this.top = C.maxTile(this.cells);
      this.phase = 'play'; this.anim = null;
    }
    /** ván mới theo chế độ (Thử thách: màn đang chọn; Ván ngày: từ đầu, cùng hạt giống) */
    fresh() {
      let g;
      if (this.mode === 'daily') g = C.dailyGame(this.day);
      else if (this.mode === 'challenge') g = C.newLevel(this.L, (Math.random() * 2 ** 31) | 0);
      else g = C.newGame(this.N, (Math.random() * 2 ** 31) | 0);
      this.cells = g.cells; this.rng = g.rng; this.score = 0; this.moves = 0; this.won = false;
      this.hints = this.mode === 'daily' ? 0 : HINTS; this.hint = null;
      this.phase = 'play'; this.anim = { t: SLIDE + POP, moves: [], merges: [], spawn: -1, born: this.cells.map((v) => v > 0) };
      this.queue = -1; this.floats = []; this.newBest = false;
      this.top = C.maxTile(this.cells);
    }
    startLevel(i) {
      this.sel = i; this.L = LV[i]; this.N = this.L.N;
      const st = loadStore(), sv = st.chSave;
      if (!this.bot && sv && sv.id === this.L.id && Array.isArray(sv.cells) && sv.cells.length === this.N * this.N && C.canMove(sv.cells, this.N)) {
        this.load(sv);
        this.say(`Chơi tiếp màn ${i + 1}`, '#9ee6ff');
      } else this.fresh();
      this.phase = 'play';
      Sfx.play('select');
    }
    restart() {
      this.clearSave();
      this.fresh();
      this.say(this.mode === 'challenge' ? `Chơi lại màn ${this.sel + 1}` : this.mode === 'daily' ? 'Chơi lại ván hôm nay từ đầu' : 'Ván mới!', '#5dffb0');
      Sfx.play('select');
    }
    toLevels() {
      this.save();
      this.phase = 'levels'; this.hint = null; this.anim = null;
      Sfx.play('select');
    }
    say(s, color) { this.msg = { s, color, t: 0 }; }
    clearSave() {
      if (this.bot) return;
      const st = loadStore();
      if (this.mode === 'classic') { if (st.saves) delete st.saves[this.N]; } else if (this.mode === 'challenge') delete st.chSave;
      else delete st.dsave;
      saveStore(st);
    }
    save() {
      if (this.bot || this.phase !== 'play') return;
      const st = loadStore(), d = { cells: this.cells, score: this.score, moves: this.moves, rng: this.rng.s, won: this.won, hints: this.hints };
      if (this.mode === 'classic') { st.saves = st.saves || {}; st.saves[this.N] = d; } else if (this.mode === 'challenge') st.chSave = Object.assign({ id: this.L.id }, d);
      else st.dsave = Object.assign({ date: this.day }, d);
      saveStore(st);
    }
    /** ghi kỷ lục (Cổ điển) + bộ sưu tập (mọi chế độ) sau mỗi nước, để thoát giữa chừng vẫn giữ */
    record() {
      if (this.bot) return;
      const st = loadStore();
      if (this.mode === 'classic') {
        st.best = st.best || {}; st.top = st.top || {};
        if (this.score > (st.best[this.N] || 0)) { st.best[this.N] = this.score; this.newBest = this.score > 0; }
        const m = C.maxTile(this.cells);
        if (m > (st.top[this.N] || 0)) st.top[this.N] = m;
        this.best = Math.max(this.best | 0, this.score);
      }
      const m = C.maxTile(this.cells);
      if (m > (st.coll | 0)) { st.coll = m; this.unlock = { e: m, t: 0 }; }
      this.coll = st.coll | 0;
      saveStore(st);
    }

    /* ---------- nước đi ---------- */
    tryMove(d) {
      if (this.phase !== 'play') return;
      if (this.anim && this.anim.t < SLIDE) { this.queue = d; return; }
      const r = C.move(this.cells, this.N, d);
      if (!r.moved) { this.bump = { d, t: 0 }; return; }
      const from = this.cells;
      this.cells = r.cells;
      const sp = C.spawn(this.cells, this.rng);
      this.anim = { t: 0, moves: r.moves.map((m) => ({ from: m.from, to: m.to, v: from[m.from] })), merges: r.merges, spawn: sp };
      this.hint = null;
      this.moves++;
      this.score += r.gained;
      if (r.gained) { this.floats.push({ v: r.gained, t: 0 }); Sfx.tone(300 + Math.min(r.top, 14) * 55, 0.08, 'triangle', 0.12); }
      else Sfx.play('move', 0.05);
      const prevTop = this.top;
      this.top = C.maxTile(this.cells);
      this.record();
      // gộp ra ô lớn: tia sáng màu ô, ô càng lớn càng nhiều; ô lớn nhất mới thì rung nhẹ
      for (const i of r.merges) {
        const e = this.cells[i];
        if (e < 6) continue;
        const c = this.cellXY(i), P = PAL[tierOf(e)];
        this.api.parts.burst(c.x, c.y, [P.a, P.b, '#fff'], 6 + Math.min(e, 13) * 2, 140 + e * 14, 0.55, 4 + Math.min(e, 12) * 0.3);
      }
      if (this.top > prevTop && this.top >= 9) FX.shake(2 + (this.top - 9));
      const lim = this.limit();
      if (this.mode === 'challenge' && this.top >= this.L.goal) { this.clearLevel(); return; }
      if (this.mode === 'classic' && !this.won && this.top >= C.TARGET[this.N]) {
        this.won = true; this.phase = 'win'; this.winT = 0;
        this.celebrate();
      }
      if (!C.canMove(this.cells, this.N)) this.gameOver('stuck');
      else if (lim && this.moves >= lim) this.gameOver('limit');
      else if (this.bot && this.moves >= BOT_CAP) this.gameOver('stuck');
      else this.save();
    }
    celebrate() {
      Sfx.play('win'); FX.shake(4);
      for (let k = 0; k < 6; k++) setTimeout(() => this.api.parts.burst(BX + Math.random() * BS, BY + Math.random() * BS, ['#ffe066', '#ff6b8b', '#6fd3ff', '#5dffb0', '#fff'], 22, 240, 0.9, 6), k * 130);
    }
    clearLevel() {
      this.phase = 'clear'; this.overT = 0;
      this.stars = C.starsOf(this.L, this.moves);
      this.celebrate();
      if (this.bot) return;
      const st = loadStore();
      st.ch = st.ch || { done: {}, best: {} };
      const prev = st.ch.done[this.L.id] | 0;
      this.prevStars = prev;
      st.ch.done[this.L.id] = Math.max(prev, this.stars);
      if (!st.ch.best[this.L.id] || this.moves < st.ch.best[this.L.id]) st.ch.best[this.L.id] = this.moves;
      delete st.chSave;
      saveStore(st);
      this.chDone = st.ch.done;
      this.chBest = st.ch.best;
    }
    gameOver(why) {
      this.phase = 'over'; this.overT = 0; this.why = why;
      if (this.bot) return;
      Sfx.play(this.mode === 'daily' && why === 'limit' ? 'crown' : 'fall');
      const st = loadStore();
      st.games = (st.games | 0) + 1;
      if (this.mode === 'classic') { if (st.saves) delete st.saves[this.N]; } else if (this.mode === 'challenge') delete st.chSave;
      else {
        delete st.dsave;
        const D = st.daily = st.daily || { days: {}, streak: 0, best: 0, last: null };
        const prev = D.days[this.day] | 0;
        this.prevDay = prev;
        this.newBest = this.score > prev;
        if (this.newBest) D.days[this.day] = this.score;
        if (D.last !== this.day) D.streak = D.last === dayKey(-1) ? (D.streak | 0) + 1 : 1;
        D.last = this.day; D.best = Math.max(D.best | 0, D.streak);
        const keys = Object.keys(D.days).sort();
        while (keys.length > 60) delete D.days[keys.shift()];
        this.daily = D;
      }
      saveStore(st);
    }
    leave(to) {
      if (!this.bot) this.exitTo = to;
      this.finished = true;
      if (App && App.cv) App.cv.style.cursor = '';
    }
    continueWin() { if (this.phase === 'win') { this.phase = 'play'; Sfx.play('select'); } }
    /** 💡 gợi ý: expectimax tìm nước tốt nhất, hiện mũi tên tới nước kế (đang hiện thì bấm lại không tốn lượt) */
    useHint() {
      if (this.phase !== 'play' || this.bot) return;
      if (this.hint) return;
      if (this.mode === 'daily') { this.say('Ván mỗi ngày không có gợi ý', '#ffd166'); return; }
      if (this.hints <= 0) { this.say('Hết lượt gợi ý ván này', '#ffd166'); return; }
      const r = C.think(this.cells, this.N);
      if (r.dir < 0) return;
      this.hints--;
      this.hint = { dir: r.dir, t: 0 };
      Sfx.play('pickup');
      this.save();
    }
    nextLevel() {
      if (this.sel + 1 < LV.length) this.startLevel(this.sel + 1);
      else { this.toLevels(); this.say('Đã qua hết các màn! 🎉', '#ffe066'); }
    }

    /* ---------- phím, chuột ---------- */
    /** hướng của phím: mũi tên / WASD, hoặc phím hướng của bộ phím người chơi (kể cả phím đã đổi) — bàn phím đọc thẳng keydown
     *  (bấm nhanh hơn một khung hình vẫn ăn), Input của app chỉ dùng cho tay cầm / máy khác */
    dirOfCode(code) {
      const s = this.p.src;
      if (s && s.type === 'kb' && KB_SCHEMES[s.scheme]) {
        const k = KB_SCHEMES[s.scheme].keys, d = [k.up, k.right, k.down, k.left].indexOf(code);
        if (d >= 0) return d;
      }
      return code in DIRS ? DIRS[code] : -1;
    }
    kbSrc() { return !!(this.p.src && this.p.src.type === 'kb'); }
    /** phím Đánh / Nhảy của bộ phím người chơi (để keydown không xử lý trùng với Input) */
    isActJump(code) {
      const s = this.p.src;
      if (!s || s.type !== 'kb' || !KB_SCHEMES[s.scheme]) return false;
      const k = KB_SCHEMES[s.scheme].keys;
      return code === k.act || code === k.jump;
    }
    onKey(e) {
      if (this.bot || !this.began) return false;
      const k = e.key, d = this.dirOfCode(e.code);
      if (this.isActJump(e.code)) return false;   // Đánh/Nhảy đi qua Input của app
      if (this.phase === 'levels') {
        if (d >= 0) { this.moveSel(d); return true; }
        if (k === 'Enter' || k === ' ') { this.pickLevel(this.sel); return true; }
        if (k === 'm' || k === 'M') { this.leave('intro'); return true; }
        return false;
      }
      if (this.phase === 'over' || this.phase === 'clear') {
        if (this.overT < 0.6) return true;
        if (k === 'Enter') { this.endPrimary(); return true; }
        if (k === 'm' || k === 'M') { this.endSecondary(); return true; }
        if ((k === 'r' || k === 'R') && this.mode === 'challenge') { this.startFresh(this.sel); return true; }
        return false;
      }
      if (this.phase === 'win') {
        if (k === 'Enter' || k === ' ') { this.continueWin(); return true; }
        if (k === 'n' || k === 'N') { this.restart(); return true; }
        return false;
      }
      if (d >= 0) { if (!e.repeat) this.tryMove(d); return true; }
      if (k === 'n' || k === 'N') { if (!e.repeat) this.pressNew(); return true; }
      if (k === 'g' || k === 'G') { if (!e.repeat) this.useHint(); return true; }
      return false;
    }
    /** màn kết thúc: Enter / Đánh */
    endPrimary() {
      if (this.mode === 'challenge') { if (this.phase === 'clear') this.nextLevel(); else this.startFresh(this.sel); }
      else this.leave('replay');
    }
    /** màn kết thúc: M / Nhảy */
    endSecondary() {
      if (this.mode === 'challenge') this.toLevels();
      else this.leave('intro');
    }
    startFresh(i) { this.sel = i; this.L = LV[i]; this.N = this.L.N; this.fresh(); Sfx.play('select'); }
    moveSel(d) {
      const n = LV.length, s = this.sel;
      const t = d === 1 ? s + 1 : d === 3 ? s - 1 : d === 0 ? s - 3 : s + 3;
      if (t >= 0 && t < n) { this.sel = t; Sfx.play('move', 0.03); }
    }
    pickLevel(i) {
      if (!this.unlocked(i)) { this.say('Qua màn trước để mở màn này 🔒', '#ffd166'); Sfx.play('warn'); return; }
      this.startLevel(i);
    }
    /** ↻: ván đã đi vài nước thì cần bấm 2 lần (lần đầu hỏi lại) */
    pressNew() {
      if (this.phase !== 'play') return;
      if (this.moves < 3 || this.confirmT > 0) { this.confirmT = 0; this.restart(); return; }
      this.confirmT = 3;
      this.say('Bấm ↻ lần nữa để bỏ ván này', '#ffd166');
    }
    btnAt(x, y) { return this.btns.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null; }
    onPointer(x, y, type) {
      if (this.bot || !this.began) return;
      const b = this.btnAt(x, y);
      this.hover = b ? b.id : null;
      if (type === 'move' && b && /^lv\d+$/.test(b.id)) this.sel = +b.id.slice(2);
      if (type === 'down') {
        if (b) { this.clickBtn(b.id); this.swipe = null; return; }
        this.swipe = { x, y };
      } else if (type === 'up' && this.swipe) {
        const dx = x - this.swipe.x, dy = y - this.swipe.y;
        this.swipe = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        if (this.phase === 'play') this.tryMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
      }
    }
    clickBtn(id) {
      Sfx.play('select');
      if (/^lv\d+$/.test(id)) { this.pickLevel(+id.slice(2)); return; }
      if (id === 'new') this.pressNew();
      else if (id === 'menu') this.leave('intro');
      else if (id === 'levels') this.toLevels();
      else if (id === 'hint') this.useHint();
      else if (id === 'cont') this.continueWin();
      else if (id === 'wnew') this.restart();
      else if (id === 'end1') this.endPrimary();
      else if (id === 'end2') this.endSecondary();
      else if (id === 'retry') this.startFresh(this.sel);
    }

    /* ---------- vòng lặp ---------- */
    update(dt, inputs) {
      if (!this.began) this.begin();
      if (this.msg && (this.msg.t += dt) > 2.6) this.msg = null;
      this.floats = this.floats.filter((f) => (f.t += dt) < 0.9);
      if (this.bump && (this.bump.t += dt) > 0.18) this.bump = null;
      if (this.unlock && (this.unlock.t += dt) > 2.4) this.unlock = null;
      if (this.hint && (this.hint.t += dt) > HINT_T) this.hint = null;
      if (this.confirmT > 0) this.confirmT -= dt;
      if (this.anim) {
        this.anim.t += dt;
        if (this.anim.t >= SLIDE && this.queue >= 0) { const q = this.queue; this.queue = -1; this.anim.t = SLIDE + POP; this.tryMove(q); }
        else if (this.anim.t > SLIDE + POP + GROW) this.anim = null;
      }
      if (this.finished) return;
      const inp = inputs[0] || {};
      // hướng từ tay cầm / máy khác: lấy cạnh lên (chạm một lần = một nước, giữ không lặp)
      const mx = this.kbSrc() ? 0 : inp.mx || 0, my = this.kbSrc() ? 0 : inp.my || 0;
      let d = -1;
      if (Math.abs(mx) > 0.5 || Math.abs(my) > 0.5) d = Math.abs(mx) >= Math.abs(my) ? (mx > 0 ? 1 : 3) : (my > 0 ? 2 : 0);
      const edge = d >= 0 && d !== this.lastDir ? d : -1;
      this.lastDir = d;
      if (this.phase === 'levels') {
        if (this.bot) return;
        if (edge >= 0) this.moveSel(edge);
        if (inp.actP) this.pickLevel(this.sel);
        else if (inp.jumpP) this.leave('intro');
        return;
      }
      if (this.phase === 'win') {
        this.winT += dt;
        if (this.bot) { if (this.winT > 1) this.continueWin(); return; }
        if (this.winT > 0.5 && inp.actP) this.continueWin();
        return;
      }
      if (this.phase === 'over' || this.phase === 'clear') {
        this.overT += dt;
        if (this.bot) { if (this.overT > 1.5) this.finished = true; return; }
        if (this.overT > 0.6) { if (inp.actP) this.endPrimary(); else if (inp.jumpP) this.endSecondary(); }
        return;
      }
      if (this.bot) { this.botStep(dt); return; }
      if (edge >= 0) this.tryMove(edge);
      if (inp.jumpP) this.useHint();
      // giữ Đánh = ván mới
      if (inp.act) {
        this.holdT += dt;
        if (this.holdT >= HOLD_NEW) { this.holdT = -99; this.restart(); }
      } else this.holdT = 0;
    }
    botStep(dt) {
      if ((this.botT -= dt) > 0) return;
      this.botT = BOT_DT;
      const d = C.bestMove(this.cells, this.N, this.rng, this.botNoise);
      if (d >= 0) this.tryMove(d);
    }
    botInput() { return {}; }
    posOf() { return { x: BX + BS / 2, y: BY + BS / 2 }; }
    results() {
      if (this.mode === 'challenge') {
        const s = this.phase === 'clear' ? this.stars : 0;
        return [{ score: s * 1000 - (this.moves | 0), text: `Màn ${this.sel + 1}: ${s ? '★'.repeat(s) + '☆'.repeat(3 - s) : 'chưa qua'} · ${this.moves | 0} nước` }];
      }
      return [{ score: this.score | 0, text: `🏆 ${this.score | 0} điểm · ô ${val(this.top || 1)} · ${this.moves | 0} nước` }];
    }

    /* ---------- hình học ---------- */
    geo() {
      const N = this.N, gap = N <= 4 ? 14 : N === 5 ? 11 : 9;
      return { gap, cs: (BS - gap * (N + 1)) / N };
    }
    cellXY(i) {
      const { gap, cs } = this.geo(), r = Math.floor(i / this.N), c = i % this.N;
      return { x: BX + gap + c * (cs + gap) + cs / 2, y: BY + gap + r * (cs + gap) + cs / 2 };
    }

    /* ---------- vẽ ---------- */
    draw(ctx) {
      const playing = typeof App !== 'undefined' && ['play', 'paused', 'ending'].includes(App.state);
      if (!this.began || (!playing && this.cfg !== this.cfgKey())) this.begin();
      ACTIVE = this;
      if (App && App.cv && App.inst === this) {
        const want = this.hover && !this.bot ? 'pointer' : '';
        if (App.cv.style.cursor !== want) App.cv.style.cursor = want;
      }
      this.btns = [];
      this.drawBg(ctx);
      this.drawLeft(ctx);
      if (this.mode === 'challenge') this.drawLevelList(ctx);
      else if (this.mode === 'daily') this.drawDays(ctx);
      else this.drawRight(ctx);
      if (this.phase === 'levels') this.drawLevels(ctx);
      else this.drawBoard(ctx);
      if (this.hint && this.phase === 'play') this.drawHint(ctx);
      if (this.phase === 'win') this.drawWin(ctx);
      if (this.phase === 'over') this.drawOver(ctx);
      if (this.phase === 'clear') this.drawClear(ctx);
      if (this.msg) {
        const a = Math.min(1, (2.6 - this.msg.t) * 2);
        ctx.save(); ctx.globalAlpha = a;
        ctx.font = '800 20px "Baloo 2", sans-serif';
        const w = ctx.measureText(this.msg.s).width + 36;
        ctx.fillStyle = 'rgba(15,10,35,0.85)'; Draw.rr(ctx, 640 - w / 2, 14, w, 38, 19); ctx.fill();
        txt(ctx, this.msg.s, 640, 34, 20, this.msg.color);
        ctx.restore();
      }
    }
    drawBg(ctx) {
      const g = ctx.createLinearGradient(0, 0, 1280, 720);
      g.addColorStop(0, '#3a2a6e'); g.addColorStop(1, '#1b2f5c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
      // chấm tròn trang trí
      ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = '#fff';
      for (let k = 0; k < 26; k++) {
        const x = (k * 197) % 1280, y = (k * 131 + 40) % 720, r = 8 + (k * 37) % 30;
        ctx.beginPath(); ctx.arc(x, y + Math.sin(U.now() * 0.5 + k) * 6, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    panel(ctx, x, y, w, h) {
      ctx.fillStyle = 'rgba(12,8,30,0.45)'; Draw.rr(ctx, x, y, w, h, 18); ctx.fill();
    }
    button(ctx, id, x, y, w, h, label, color, fs = 20, off) {
      const on = this.hover === id && !off;
      ctx.save();
      if (off) ctx.globalAlpha *= 0.45;
      ctx.fillStyle = on ? mix(color, '#ffffff', 0.18) : color;
      Draw.rr(ctx, x, y, w, h, 14); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; Draw.rr(ctx, x, y + h - 5, w, 5, 3); ctx.fill();
      txt(ctx, label, x + w / 2, y + h / 2 + 1, fs, '#fff');
      ctx.restore();
      this.btns.push({ id, x, y, w, h });
    }
    drawLeft(ctx) {
      const x = 28, w = 284, L = this.L;
      // tiêu đề
      ctx.save();
      ctx.font = '800 76px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 10; ctx.strokeStyle = '#2a1850'; ctx.strokeText('2048', x + w / 2, 100);
      const tg = ctx.createLinearGradient(0, 66, 0, 131);
      tg.addColorStop(0, '#fff3a6'); tg.addColorStop(1, '#ffb02e');
      ctx.fillStyle = tg; ctx.fillText('2048', x + w / 2, 100);
      ctx.restore();
      const sub = this.mode === 'challenge' ? `Thử thách · màn ${this.sel + 1}: ${L.name}` : this.mode === 'daily' ? `Ván mỗi ngày · ${dayShort(this.day)}` : `Bàn ${this.N}×${this.N} · mục tiêu ${this.goalTile}`;
      ctx.save(); ctx.font = '700 18px "Baloo 2", sans-serif';
      const sw = ctx.measureText(sub).width; ctx.restore();
      txt(ctx, sub, x + w / 2, 146, sw > w ? 18 * w / sw : 18, '#d9d0ff', 'center', 700);
      const levels = this.phase === 'levels';
      // hai ô số liệu
      const box = (bx, label, v, hl, sub2) => {
        this.panel(ctx, bx, 170, 136, 76);
        txt(ctx, label, bx + 14, 190, 15, '#b9aef0', 'left', 700);
        const s = String(v);
        txt(ctx, s, bx + 68, 222, s.length > 7 ? 22 : 30, hl ? '#ffe066' : '#fff');
        if (sub2) txt(ctx, sub2, bx + 122, 190, 14, '#9ee6ff', 'right', 700);
      };
      const lim = this.limit(), left = lim ? Math.max(0, lim - this.moves) : 0;
      if (this.mode === 'challenge') {
        box(x, 'MỤC TIÊU', levels ? '—' : val(L.goal), false);
        box(x + 148, lim ? 'CÒN' : 'NƯỚC ĐI', levels ? '—' : lim ? `${left}` : this.moves | 0, lim && left <= 20 && !levels, lim ? 'nước' : '');
      } else if (this.mode === 'daily') {
        box(x, 'ĐIỂM', this.score | 0, false);
        box(x + 148, 'HÔM NAY', this.daily.days[this.day] | 0 || '—', false);
      } else {
        box(x, 'ĐIỂM', this.score | 0, false);
        box(x + 148, 'KỶ LỤC', Math.max(this.best | 0, this.score | 0), this.newBest);
      }
      if (this.mode !== 'challenge') {
        for (const f of this.floats) {
          const k = f.t / 0.9;
          ctx.save(); ctx.globalAlpha = 1 - k;
          txt(ctx, '+' + f.v, x + 124, 191 - k * 14, 17, '#5dffb0', 'right');
          ctx.restore();
        }
      }
      // dòng thông tin
      this.panel(ctx, x, 256, w, 50);
      if (this.mode === 'challenge') {
        if (levels) txt(ctx, `⭐ ${Object.values(this.chDone).reduce((a, b) => a + b, 0)}/${LV.length * 3} sao`, x + w / 2, 282, 19, '#ffe066');
        else {
          const s = C.starsOf(L, this.moves + 1);
          [0, 1, 2].forEach((k) => star(ctx, x + 26 + k * 26, 281, 10, k < s));
          txt(ctx, s === 3 ? `3 sao nếu qua trong ${L.star[0]} nước` : s === 2 ? `2 sao nếu qua trong ${L.star[1]} nước` : '1 sao khi qua màn', x + 104, 282, 15, '#fff', 'left', 700);
        }
      } else if (this.mode === 'daily') {
        txt(ctx, `🐾 còn ${left} nước`, x + 20, 282, 19, left <= 20 ? '#ffd166' : '#fff', 'left', 700);
        txt(ctx, `🔥 ${this.daily.last === this.day || this.daily.last === dayKey(-1) ? this.daily.streak | 0 : 0} ngày`, x + w - 18, 282, 19, '#ffb36b', 'right', 700);
      } else {
        txt(ctx, `🐾 ${this.moves | 0} nước`, x + 20, 282, 19, '#fff', 'left', 700);
        txt(ctx, `ô lớn nhất ${val(this.top || 1)}`, x + w - 18, 282, 19, '#fff', 'right', 700);
      }
      // nút
      if (!this.bot) {
        if (levels) {
          this.button(ctx, 'menu', x, 318, w, 50, '☰ Đổi game', '#3b5fb8');
        } else {
          const hold = this.holdT > 0 ? Math.min(1, this.holdT / HOLD_NEW) : 0;
          const lbl = this.mode === 'challenge' ? '↻ Chơi lại' : this.mode === 'daily' ? '↻ Từ đầu' : '↻ Ván mới';
          this.button(ctx, 'new', x, 318, 136, 50, this.confirmT > 0 ? '↻ Chắc chưa?' : lbl, this.confirmT > 0 ? '#e0743a' : '#6a4bd6');
          if (hold > 0) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; Draw.rr(ctx, x, 318, 136 * hold, 50, 14); ctx.fill(); }
          if (this.mode === 'challenge') this.button(ctx, 'levels', x + 148, 318, 136, 50, '🗺️ Chọn màn', '#3b5fb8');
          else this.button(ctx, 'menu', x + 148, 318, 136, 50, '☰ Đổi game', '#3b5fb8');
          if (this.mode !== 'daily') {
            const on = !!this.hint;
            this.button(ctx, 'hint', x, 378, w, 46, on ? `💡 Đi ${DIR_ARROW[this.hint.dir]} ${DIR_NAME[this.hint.dir]}` : `💡 Gợi ý nước đi (còn ${this.hints})`,
              on ? '#2fa86a' : '#c7871a', 19, this.hints <= 0 && !on);
          }
        }
      }
      // cách chơi + phím
      const py = this.mode === 'daily' || levels ? 380 : 436, ph = 676 - py;
      this.panel(ctx, x, py, w, ph);
      const lines = this.mode === 'challenge'
        ? (levels ? ['Mỗi màn một đề: ô đá chắn lối', '(không trượt, không gộp), có màn', 'giới hạn số nước. Lên tới ô mục', 'tiêu là qua; càng ít nước càng', 'nhiều sao. Qua màn mở màn kế.']
          : [L.desc + '.'].concat(L.stones.length ? ['Ô đá không trượt, không gộp.'] : [], [lim ? `Tối đa ${lim} nước.` : 'Không giới hạn số nước.']))
        : this.mode === 'daily'
          ? ['Cả ngày chỉ một ván: cùng ô đá,', 'cùng thứ tự ô mới cho mọi lần.', `${C.DAILY_MOVES} nước — điểm càng cao càng tốt.`, 'Chơi mỗi ngày để giữ 🔥 chuỗi.', 'Ván này không có gợi ý.']
          : ['Trượt cả bàn về một phía.', 'Hai ô cùng số chạm nhau', 'thì gộp thành một ô gấp đôi.', `Lên tới ${this.goalTile} là thắng.`];
      txt(ctx, levels ? 'Thử thách' : 'Cách chơi', x + 18, py + 24, 19, '#ffe066', 'left');
      lines.forEach((s, k) => txt(ctx, s, x + 18, py + 52 + k * 24, 16, '#e8e2ff', 'left', 600));
      const ky = py + ph - 64;
      txt(ctx, '🎮 Phím', x + 18, ky, 16, '#9ee6ff', 'left');
      const Lb = typeof srcLabels === 'function' && srcLabels(this.p.src);
      if (levels) {
        txt(ctx, '← ↑ → ↓ chọn màn · Enter / bấm chuột: chơi', x + 18, ky + 24, 14, '#fff', 'left', 600);
        txt(ctx, 'M: đổi game', x + 18, ky + 46, 14, '#fff', 'left', 600);
      } else {
        txt(ctx, '← ↑ → ↓ / WASD / vuốt chuột', x + 18, ky + 24, 15, '#fff', 'left', 600);
        txt(ctx, `N hoặc giữ ${Lb && Lb.act ? Lb.act : 'Đánh'}: ván mới${this.mode !== 'daily' ? ` · G hoặc ${Lb && Lb.jump ? Lb.jump : 'Nhảy'}: gợi ý` : ''}`, x + 18, ky + 46, 14, '#fff', 'left', 600);
      }
    }
    drawRight(ctx) {
      const x = 968, w = 284;
      this.panel(ctx, x, 60, w, 600);
      txt(ctx, 'Bộ sưu tập ô số', x + w / 2, 92, 22, '#ffe066');
      txt(ctx, `đã mở ${Math.min(Math.max(this.coll, this.top | 0), 15)}/15`, x + w / 2, 118, 15, '#b9aef0', 'center', 700);
      const cols = 3, cw = 84, ch = 90, gx = x + (w - cols * cw) / 2, gy = 136;
      for (let e = 1; e <= 15; e++) {
        const k = e - 1, cx = gx + (k % cols) * cw + cw / 2, cy = gy + Math.floor(k / cols) * ch + 40;
        const open = e <= this.coll || e <= (this.top | 0);
        if (e === (this.top | 0)) {
          ctx.fillStyle = 'rgba(255,224,102,0.2)'; Draw.rr(ctx, cx - 39, cy - 39, 78, 78, 16); ctx.fill();
        }
        if (open) this.drawTile(ctx, e, cx, cy, 62, 1, e, true);
        else this.lockedTile(ctx, cx, cy, 62);
      }
      if (this.unlock) this.drawUnlock(ctx, x, w);
      else {
        txt(ctx, 'Ô lớn nhất ván này', x + w / 2, 616, 15, '#b9aef0', 'center', 700);
        txt(ctx, String(val(this.top || 1)), x + w / 2, 642, 24, PAL[tierOf(this.top || 1)].lite);
      }
    }
    lockedTile(ctx, cx, cy, s) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; Draw.rr(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.18); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      Draw.rr(ctx, cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, s * 0.16); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, '?', cx, cy + 2, s * 0.42, 'rgba(255,255,255,0.3)');
    }
    drawUnlock(ctx, x, w) {
      const k = this.unlock.t, a = Math.min(1, k * 4, (2.4 - k) * 2);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(20,12,45,0.94)'; Draw.rr(ctx, x + 10, 598, w - 20, 56, 14); ctx.fill();
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; Draw.rr(ctx, x + 10, 598, w - 20, 56, 14); ctx.stroke();
      txt(ctx, '✨ Mở khoá ô mới!', x + w / 2, 616, 16, '#ffe066');
      txt(ctx, `Ô ${val(this.unlock.e)}`, x + w / 2, 638, 18, PAL[tierOf(this.unlock.e)].lite);
      ctx.restore();
    }
    /** cột phải ở Thử thách: danh sách màn + sao */
    drawLevelList(ctx) {
      const x = 968, w = 284;
      this.panel(ctx, x, 60, w, 600);
      const total = Object.values(this.chDone).reduce((a, b) => a + b, 0);
      txt(ctx, 'Các màn', x + 20, 90, 22, '#ffe066', 'left');
      txt(ctx, `⭐ ${total}/${LV.length * 3}`, x + w - 20, 91, 18, '#fff', 'right');
      LV.forEach((L, i) => {
        const y = 116 + i * 44, on = i === this.sel, open = this.unlocked(i), s = this.chDone[L.id] | 0;
        if (on) { ctx.fillStyle = 'rgba(255,224,102,0.18)'; Draw.rr(ctx, x + 8, y, w - 16, 40, 10); ctx.fill(); }
        txt(ctx, open ? String(i + 1) : '🔒', x + 30, y + 21, open ? 18 : 15, open ? '#fff' : '#8a80b0');
        ctx.save(); ctx.font = '700 16px "Baloo 2", sans-serif';
        let nm = L.name; while (ctx.measureText(nm).width > 128 && nm.length > 3) nm = nm.slice(0, -2) + '…';
        ctx.restore();
        txt(ctx, nm, x + 50, y + 21, 16, open ? '#e8e2ff' : '#7f76a3', 'left', 700);
        [0, 1, 2].forEach((k) => star(ctx, x + w - 72 + k * 22, y + 20, 8.5, k < s));
      });
    }
    /** cột phải ở Ván mỗi ngày: 14 ngày gần đây + chuỗi */
    drawDays(ctx) {
      const x = 968, w = 284, D = this.daily;
      this.panel(ctx, x, 60, w, 600);
      txt(ctx, '14 ngày gần đây', x + w / 2, 92, 22, '#ffe066');
      const streak = D.last === this.day || D.last === dayKey(-1) ? D.streak | 0 : 0;
      txt(ctx, `🔥 chuỗi ${streak} ngày · dài nhất ${D.best | 0}`, x + w / 2, 120, 15, '#ffb36b', 'center', 700);
      for (let k = 0; k < 14; k++) {
        const key = dayKey(k - 13), sc = D.days[key] | 0, cx = x + 22 + (k % 2) * 124, cy = 146 + Math.floor(k / 2) * 62;
        const today = key === this.day;
        ctx.fillStyle = sc ? 'rgba(93,255,176,0.18)' : 'rgba(255,255,255,0.06)';
        Draw.rr(ctx, cx, cy, 116, 54, 12); ctx.fill();
        if (today) { ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; Draw.rr(ctx, cx, cy, 116, 54, 12); ctx.stroke(); }
        txt(ctx, today ? 'Hôm nay' : dayShort(key), cx + 58, cy + 17, 14, today ? '#ffe066' : '#b9aef0', 'center', 700);
        txt(ctx, sc ? String(sc) : '—', cx + 58, cy + 38, 18, sc ? '#fff' : 'rgba(255,255,255,0.3)');
      }
      if (this.unlock) this.drawUnlock(ctx, x, w);
    }
    /** chọn màn (thay cho bàn): lưới 3 × 4 thẻ */
    drawLevels(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; Draw.rr(ctx, BX + 6, BY + 10, BS, BS, 26); ctx.fill();
      ctx.fillStyle = '#2b2150'; Draw.rr(ctx, BX, BY, BS, BS, 26); ctx.fill();
      txt(ctx, 'Chọn màn', BX + BS / 2, BY + 34, 26, '#ffe066');
      const cw = 184, ch = 132, gx = 10, gy = 8, x0 = BX + (BS - 3 * cw - 2 * gx) / 2, y0 = BY + 60;
      LV.forEach((L, i) => {
        const x = x0 + (i % 3) * (cw + gx), y = y0 + Math.floor(i / 3) * (ch + gy), on = i === this.sel, open = this.unlocked(i), s = this.chDone[L.id] | 0;
        ctx.save();
        if (on) { ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 18; }
        ctx.fillStyle = open ? (s ? '#3a2f6e' : '#463a86') : '#2a2246';
        Draw.rr(ctx, x, y, cw, ch, 16); ctx.fill();
        ctx.restore();
        if (on) { ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3; Draw.rr(ctx, x, y, cw, ch, 16); ctx.stroke(); }
        if (!open) ctx.globalAlpha = 0.5;
        // bàn nhỏ: ô đá + ô mục tiêu
        const ms = 54, cs2 = ms / L.N, mx0 = x + 12, my0 = y + 40;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; Draw.rr(ctx, mx0 - 3, my0 - 3, ms + 6, ms + 6, 6); ctx.fill();
        for (let k = 0; k < L.N * L.N; k++) {
          const st = L.stones.includes(k);
          ctx.fillStyle = st ? '#8a8399' : 'rgba(255,255,255,0.12)';
          ctx.fillRect(mx0 + (k % L.N) * cs2 + 1, my0 + Math.floor(k / L.N) * cs2 + 1, cs2 - 2, cs2 - 2);
        }
        txt(ctx, `${i + 1}. ${L.name}`, x + 12, y + 20, L.name.length > 14 ? 15 : 17, '#fff', 'left');
        this.drawTile(ctx, L.goal, x + 112, y + 66, 46, 1, i, true, true);
        txt(ctx, `${L.N}×${L.N}`, x + 160, y + (L.limit ? 56 : 66), 15, '#d9d0ff', 'center', 700);
        if (L.limit) txt(ctx, `⏱${L.limit}`, x + 160, y + 80, 15, '#ffd166', 'center', 700);
        ctx.globalAlpha = 1;
        if (open) [0, 1, 2].forEach((k) => star(ctx, x + 70 + k * 22, y + 112, 9, k < s));
        else txt(ctx, '🔒', x + cw / 2, y + 112, 18, '#fff');
        this.btns.push({ id: 'lv' + i, x, y, w: cw, h: ch });
      });
    }
    drawBoard(ctx) {
      const N = this.N, { gap, cs } = this.geo();
      let ox = 0, oy = 0;
      if (this.bump) { const k = Math.sin(this.bump.t / 0.18 * Math.PI) * 6; ox = [0, k, 0, -k][this.bump.d]; oy = [-k, 0, k, 0][this.bump.d]; }
      ctx.save(); ctx.translate(ox, oy);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; Draw.rr(ctx, BX + 6, BY + 10, BS, BS, 26); ctx.fill();
      ctx.fillStyle = '#2b2150'; Draw.rr(ctx, BX, BY, BS, BS, 26); ctx.fill();
      for (let i = 0; i < N * N; i++) {
        const c = this.cellXY(i);
        if (this.cells[i] === C.STONE) this.drawStone(ctx, c.x, c.y, cs, i);
        else { ctx.fillStyle = 'rgba(255,255,255,0.07)'; Draw.rr(ctx, c.x - cs / 2, c.y - cs / 2, cs, cs, cs * 0.16); ctx.fill(); }
      }
      // màn giới thiệu không gọi update → bỏ hoạt ảnh kẻo ô mới đứng ở cỡ 0
      const A = typeof App !== 'undefined' && !['play', 'paused', 'ending'].includes(App.state) ? null : this.anim;
      if (A && A.t < SLIDE) {
        const k = ease(A.t / SLIDE);
        // ô đứng yên trước (vẽ dưới), ô đang trượt vẽ sau
        const order = A.moves.slice().sort((a, b) => (a.from === a.to) - (b.from === b.to)).reverse();
        for (const m of order) {
          const a = this.cellXY(m.from), b = this.cellXY(m.to);
          this.drawTile(ctx, m.v, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, cs, 1, m.from);
        }
      } else {
        const t2 = A ? A.t - SLIDE : 99;
        for (let i = 0; i < N * N; i++) {
          const v = this.cells[i];
          if (v <= 0) continue;
          const c = this.cellXY(i);
          let s = 1;
          if (A && A.merges.includes(i) && t2 < POP) s = 1 + 0.2 * Math.sin(t2 / POP * Math.PI);
          if (A && (i === A.spawn || (A.born && A.born[i]))) { if (t2 < POP) continue; s = U.outBack(Math.min(1, (t2 - POP) / GROW)); }
          this.drawTile(ctx, v, c.x, c.y, cs, s, i);
        }
        // vòng sáng loé ra quanh ô vừa gộp
        if (A && t2 < POP * 2) {
          const p = t2 / (POP * 2);
          for (const i of A.merges) {
            const c = this.cellXY(i), P = PAL[tierOf(this.cells[i])], R = cs * (0.5 + p * 0.28);
            ctx.save(); ctx.globalAlpha = (1 - p) * 0.9;
            ctx.strokeStyle = P.a; ctx.lineWidth = cs * 0.07 * (1 - p) + 1;
            Draw.rr(ctx, c.x - R, c.y - R, R * 2, R * 2, cs * 0.22); ctx.stroke();
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }
    /** ô đá: khối đá xám có vết nứt (cố định theo vị trí) */
    drawStone(ctx, x, y, cs, i) {
      const h = cs / 2, rr = cs * 0.16, lip = cs * 0.05;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = '#3d3748'; Draw.rr(ctx, -h, -h + lip, cs, cs - lip, rr); ctx.fill();
      const g = ctx.createLinearGradient(0, -h, 0, h);
      g.addColorStop(0, '#a59fb3'); g.addColorStop(1, '#6b6478');
      ctx.fillStyle = g; Draw.rr(ctx, -h, -h, cs, cs - lip, rr); ctx.fill();
      ctx.save(); Draw.rr(ctx, -h, -h, cs, cs - lip, rr); ctx.clip();
      // đốm + vết nứt
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let k = 0; k < 5; k++) {
        const a = (i * 7 + k * 13) % 10 / 10 - 0.5, b = (i * 3 + k * 17) % 10 / 10 - 0.5;
        ctx.beginPath(); ctx.arc(a * cs * 0.8, b * cs * 0.8, cs * (0.05 + (k % 3) * 0.025), 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(30,20,45,0.55)'; ctx.lineWidth = Math.max(1.5, cs * 0.025); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-h * 0.5, -h); ctx.lineTo(-h * 0.15, -h * 0.35); ctx.lineTo(-h * 0.35, h * 0.1); ctx.lineTo(h * 0.1, h * 0.55);
      ctx.moveTo(-h * 0.15, -h * 0.35); ctx.lineTo(h * 0.4, -h * 0.2); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(1.5, cs * 0.018);
      Draw.rr(ctx, -h + cs * 0.03, -h + cs * 0.03, cs - cs * 0.06, cs - lip - cs * 0.06, rr * 0.8); ctx.stroke();
      ctx.restore();
    }
    /** mũi tên gợi ý lớn trên bàn, nhấp nháy */
    drawHint(ctx) {
      const d = this.hint.dir, t = this.hint.t, cx = BX + BS / 2, cy = BY + BS / 2;
      const a = Math.min(1, t * 5, (HINT_T - t) * 3) * (0.8 + 0.2 * Math.sin(t * 8));
      const push = Math.sin(t * 6) * 14;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(cx, cy); ctx.rotate([-Math.PI / 2, 0, Math.PI / 2, Math.PI][d]); ctx.translate(push, 0);
      ctx.shadowColor = '#5dffb0'; ctx.shadowBlur = 24;
      ctx.fillStyle = 'rgba(93,255,176,0.55)'; ctx.strokeStyle = 'rgba(15,90,58,0.8)'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-95, -30); ctx.lineTo(25, -30); ctx.lineTo(25, -75); ctx.lineTo(110, 0); ctx.lineTo(25, 75); ctx.lineTo(25, 30); ctx.lineTo(-95, 30); ctx.closePath();
      ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
      ctx.restore();
    }
    /** ô số: (x, y) tâm, cạnh cs, phóng s; `mini` = ô nhỏ ở bộ sưu tập (bỏ bớt hiệu ứng nặng) */
    drawTile(ctx, e, x, y, cs, s, seed, mini, crown) {
      if (crown === undefined) crown = e >= this.goalExp();
      if (s <= 0.02) return;
      const t = tierOf(e), P = PAL[t], now = U.now();
      const h = cs / 2, rr = cs * 0.17, lip = cs * 0.055, str = String(val(e));
      const top = -h, fh = cs - lip;                     // mặt ô (phần dưới chừa gờ khối)
      const galaxy = e >= 14;
      ctx.save();
      ctx.translate(x, y); ctx.scale(s, s);
      // hào quang từ 128, mạnh dần + nhịp thở
      if (e >= 7) {
        ctx.save();
        ctx.shadowColor = galaxy ? `hsl(${(now * 90) % 360},100%,65%)` : P.b;
        ctx.shadowBlur = cs * (0.1 + Math.min(e - 7, 5) * 0.035) * (1 + 0.25 * Math.sin(now * 3 + seed)) * (mini ? 0.6 : 1);
        ctx.fillStyle = P.b; Draw.rr(ctx, -h, top, cs, cs, rr); ctx.fill();
        ctx.restore();
      }
      // gờ khối phía dưới + mặt ô gradient
      ctx.fillStyle = P.deep; Draw.rr(ctx, -h, top + lip, cs, fh, rr); ctx.fill();
      const g = ctx.createLinearGradient(0, top, 0, top + fh);
      g.addColorStop(0, P.a); g.addColorStop(1, P.b);
      ctx.fillStyle = g; Draw.rr(ctx, -h, top, cs, fh, rr); ctx.fill();
      ctx.save();
      Draw.rr(ctx, -h, top, cs, fh, rr); ctx.clip();
      if (galaxy) {
        // nền thiên hà: sao lấp lánh
        for (let k = 0; k < 14; k++) {
          const sx = ((k * 73 + seed * 31) % 100) / 100 - 0.5, sy = ((k * 47 + seed * 17) % 100) / 100 - 0.5;
          ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(now * 2 + k));
          ctx.fillStyle = k % 3 ? '#fff' : '#ffd6ff';
          ctx.beginPath(); ctx.arc(sx * cs * 0.9, top + (sy + 0.5) * fh, cs * (k % 4 ? 0.012 : 0.022), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // bóng kính nửa trên
      const gl = ctx.createLinearGradient(0, top, 0, top + fh * 0.55);
      gl.addColorStop(0, 'rgba(255,255,255,0.42)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(-h, top, cs, fh * 0.55);
      // vệt sáng quét chéo từ 1024
      if (e >= 10 && !mini) {
        const per = 2.6, p = ((now + seed * 0.37) % per) / per;
        if (p < 0.45) {
          const bx = -cs * 1.1 + (p / 0.45) * cs * 2.2;
          ctx.save(); ctx.translate(bx, 0); ctx.rotate(0.45);
          const sg = ctx.createLinearGradient(-cs * 0.14, 0, cs * 0.14, 0);
          sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = sg; ctx.fillRect(-cs * 0.14, -cs, cs * 0.28, cs * 2);
          ctx.restore();
        }
      }
      ctx.restore();
      // viền sáng mảnh bên trong
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = Math.max(1.5, cs * 0.018);
      Draw.rr(ctx, -h + cs * 0.03, top + cs * 0.03, cs - cs * 0.06, fh - cs * 0.06, rr * 0.8); ctx.stroke();
      // chữ số: bóng đổ + viền dày màu đậm + ruột gradient trắng (cầu vồng ở ô thiên hà)
      const fs = cs * FS[Math.min(str.length, 6)], ty = top + fh / 2 + fs * 0.07 + (crown && !mini ? cs * 0.05 : 0);
      ctx.font = `800 ${fs}px "Baloo 2", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = fs * 0.2; ctx.strokeStyle = 'rgba(10,4,25,0.35)';
      ctx.strokeText(str, 0, ty + fs * 0.07);
      ctx.strokeStyle = P.deep; ctx.strokeText(str, 0, ty);
      let tg;
      if (galaxy) {
        tg = ctx.createLinearGradient(-fs, 0, fs, 0);
        for (let k = 0; k <= 4; k++) tg.addColorStop(k / 4, `hsl(${(now * 120 + k * 72) % 360},100%,72%)`);
      } else {
        tg = ctx.createLinearGradient(0, ty - fs * 0.45, 0, ty + fs * 0.4);
        tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.55, '#ffffff'); tg.addColorStop(1, P.lite);
      }
      ctx.fillStyle = tg; ctx.fillText(str, 0, ty);
      // vương miện ở ô mục tiêu trở lên, lấp lánh từ 512
      if (crown) Draw.crown(ctx, 0, top + cs * (mini ? 0.13 : 0.14), cs * (mini ? 0.22 : 0.2));
      if (e >= 9) {
        for (let k = 0; k < (mini ? 1 : 2); k++) {
          const tw = Math.sin(now * 3.4 + seed + k * 2.1);
          if (tw > 0) Draw.sparkle(ctx, (k ? -1 : 1) * h * 0.66, top + (k ? fh * 0.78 : fh * 0.2), cs * 0.07 * tw, '#fff');
        }
      }
      ctx.restore();
    }
    overlay(ctx) {
      ctx.fillStyle = 'rgba(20,12,45,0.74)'; Draw.rr(ctx, BX, BY, BS, BS, 26); ctx.fill();
    }
    /** ô to giữa các tia sáng xoay (màn thắng / qua màn) */
    bigTile(ctx, e, y, k) {
      const cx = BX + BS / 2;
      ctx.save(); ctx.translate(cx, y);
      ctx.save(); ctx.rotate(U.now() * 0.4); ctx.globalAlpha *= 0.35;
      for (let r = 0; r < 12; r++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = r % 2 ? '#ffe066' : '#ffb300'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-22, -180); ctx.lineTo(22, -180); ctx.fill(); }
      ctx.restore();
      ctx.rotate(Math.sin(U.now() * 2) * 0.05);
      this.drawTile(ctx, e, 0, 0, 140, k, 3);
      ctx.restore();
    }
    drawWin(ctx) {
      const a = Math.min(1, this.winT * 3);
      ctx.save(); ctx.globalAlpha = a;
      this.overlay(ctx);
      const cx = BX + BS / 2;
      this.bigTile(ctx, C.TARGET[this.N], BY + 190, U.outBack(Math.min(1, this.winT * 2)));
      txt(ctx, `🎉 Đã lên ô ${this.goalTile}!`, cx, BY + 320, 38, '#ffe066');
      txt(ctx, 'Chơi tiếp để phá kỷ lục, hay làm ván mới?', cx, BY + 362, 20, '#fff', 'center', 600);
      if (!this.bot) {
        this.button(ctx, 'cont', cx - 210, BY + 400, 200, 56, '▶ Chơi tiếp', '#2fa86a');
        this.button(ctx, 'wnew', cx + 10, BY + 400, 200, 56, '↻ Ván mới', '#6a4bd6');
        txt(ctx, 'Enter / nút Đánh: chơi tiếp · N: ván mới', cx, BY + 488, 16, '#d9d0ff', 'center', 600);
      }
      ctx.restore();
    }
    /** qua màn Thử thách: sao bật ra lần lượt */
    drawClear(ctx) {
      const t = this.overT, a = Math.min(1, t * 3), cx = BX + BS / 2;
      ctx.save(); ctx.globalAlpha = a;
      this.overlay(ctx);
      this.bigTile(ctx, this.L.goal, BY + 160, U.outBack(Math.min(1, t * 2)));
      txt(ctx, `Qua màn ${this.sel + 1}!`, cx, BY + 278, 40, '#ffe066');
      for (let k = 0; k < 3; k++) {
        const kk = U.clamp((t - 0.35 - k * 0.22) / 0.3, 0, 1);
        const sc = kk > 0 ? U.outBack(kk) : 0.6;
        star(ctx, cx - 70 + k * 70, BY + 342, 26 * sc, k < this.stars && kk > 0);
      }
      const best = this.chBest && this.chBest[this.L.id];
      txt(ctx, `${this.moves} nước${best && best < this.moves ? ` · tốt nhất ${best}` : this.prevStars && this.stars > this.prevStars ? ' · thêm sao mới!' : ''}`, cx, BY + 392, 20, '#fff', 'center', 700);
      if (this.stars < 3) txt(ctx, `3 sao: qua trong ${this.L.star[0]} nước`, cx, BY + 420, 16, '#d9d0ff', 'center', 600);
      if (!this.bot) {
        const last = this.sel + 1 >= LV.length;
        this.button(ctx, 'end1', cx - 285, BY + 450, 180, 54, last ? '🗺️ Danh sách' : '▶ Màn kế', '#2fa86a');
        this.button(ctx, 'retry', cx - 90, BY + 450, 180, 54, '↻ Chơi lại', '#6a4bd6');
        this.button(ctx, 'end2', cx + 105, BY + 450, 180, 54, '🗺️ Chọn màn', '#3b5fb8');
        txt(ctx, `Enter / Đánh: ${last ? 'danh sách' : 'màn kế'} · R: chơi lại · M / Nhảy: chọn màn`, cx, BY + 530, 15, '#d9d0ff', 'center', 600);
      }
      ctx.restore();
    }
    drawOver(ctx) {
      const a = Math.min(1, this.overT * 2.5);
      ctx.save(); ctx.globalAlpha = a;
      this.overlay(ctx);
      const cx = BX + BS / 2, ch = this.mode === 'challenge', daily = this.mode === 'daily';
      if (ch) {
        txt(ctx, 'Chưa qua màn!', cx, BY + 130, 44, '#fff');
        txt(ctx, this.why === 'limit' ? `Đã hết ${this.L.limit} nước` : 'Hết nước đi', cx, BY + 186, 24, '#ffb36b', 'center', 700);
        this.drawTile(ctx, this.top || 1, cx - 110, BY + 270, 70, 1, 5, true);
        txt(ctx, `Ô lớn nhất: ${val(this.top || 1)}`, cx - 60, BY + 256, 22, '#fff', 'left', 700);
        txt(ctx, `Cần: ${val(this.L.goal)}`, cx - 60, BY + 286, 18, '#d9d0ff', 'left', 600);
      } else {
        const title = daily ? (this.why === 'limit' ? '⭐ Xong ván hôm nay!' : 'Hết nước đi!') : this.won ? '🏆 Hết nước đi — ván thắng!' : 'Hết nước đi!';
        txt(ctx, title, cx, BY + 110, 40, this.won || daily ? '#ffe066' : '#fff');
        txt(ctx, `${this.score | 0} điểm`, cx, BY + 180, 58, '#fff');
        const sub = daily ? (this.newBest ? (this.prevDay ? `⭐ Điểm cao nhất hôm nay (trước: ${this.prevDay})` : '⭐ Đã ghi điểm hôm nay') : `Cao nhất hôm nay: ${this.prevDay | 0}`)
          : this.newBest ? '⭐ Kỷ lục mới!' : `Kỷ lục ${this.N}×${this.N}: ${this.best | 0}`;
        txt(ctx, sub, cx, BY + 235, 22, this.newBest ? '#ffe066' : '#d9d0ff', 'center', 700);
        this.drawTile(ctx, this.top || 1, cx - 105, BY + 316, 70, 1, 5, true);
        txt(ctx, `Ô lớn nhất: ${val(this.top || 1)}`, cx - 56, BY + 302, 22, '#fff', 'left', 700);
        txt(ctx, daily ? `🔥 chuỗi ${this.daily.streak | 0} ngày` : `${this.moves | 0} nước đi`, cx - 56, BY + 330, 18, daily ? '#ffb36b' : '#d9d0ff', 'left', 600);
      }
      if (!this.bot) {
        const l1 = ch ? '↻ Thử lại' : daily ? '↻ Chơi lại ván ngày' : '↻ Chơi lại';
        const l2 = ch ? '🗺️ Chọn màn' : '☰ Đổi game';
        this.button(ctx, 'end1', cx - 220, BY + 410, 210, 56, l1, '#2fa86a', daily ? 18 : 20);
        this.button(ctx, 'end2', cx + 10, BY + 410, 210, 56, l2, '#3b5fb8');
        txt(ctx, `Enter / Đánh: ${ch ? 'thử lại' : 'chơi lại'} · M / Nhảy: ${ch ? 'chọn màn' : 'đổi game'}`, cx, BY + 500, 16, '#d9d0ff', 'center', 600);
      }
      ctx.restore();
    }
  }

  Party.register({
    id: 'g2048', name: '2048', emoji: '🔢', cat: 'brain',
    tagline: 'Trượt bàn, gộp hai ô cùng số thành ô gấp đôi — lên tới ô 2048!',
    how: 'Mỗi lần trượt, mọi ô chạy hết cỡ về một phía; hai ô cùng số chạm nhau thì gộp thành một ô gấp đôi (cộng điểm bằng số mới). Sau mỗi nước có một ô 2 hoặc 4 mới xuất hiện. Lên tới ô mục tiêu là thắng (chơi tiếp được), hết chỗ và không gộp được nữa là hết ván. Thoát giữa chừng thì lần sau chơi tiếp.',
    controls: { move: 'Trượt bàn', act: 'Giữ: ván mới', jump: 'Gợi ý' },
    helpExtra: '⌨️ mũi tên / WASD · 🖱️ vuốt chuột trên bàn · N: ván mới · G: gợi ý',
    minPlayers: 1, maxPlayers: 1, rawBot: true, noFast: true,
    modes: [
      { id: 'classic', name: 'Cổ điển', icon: '🔢', desc: 'Luật gốc: lên ô mục tiêu là thắng, chơi tiếp được để phá kỷ lục. Có 3 lần gợi ý mỗi ván. Lưu ván dở và kỷ lục theo cỡ bàn.' },
      { id: 'challenge', name: 'Thử thách', icon: '🗺️', desc: '12 màn có ô đá chắn lối (không trượt, không gộp) hoặc giới hạn số nước. Lên ô mục tiêu là qua màn; càng ít nước càng nhiều sao (tối đa 3).',
        how: 'Chọn màn rồi lên tới ô mục tiêu của màn đó. Ô đá đứng yên, không gộp được và chặn đường trượt. Màn có giới hạn thì phải qua trong số nước cho phép. Qua màn trong càng ít nước càng được nhiều sao; qua màn mở màn kế. Mỗi lần chơi có 3 lần gợi ý.' },
      { id: 'daily', name: 'Ván mỗi ngày', icon: '🌞', desc: 'Cả ngày chỉ một ván cố định (cùng ô đá, cùng thứ tự ô mới), 250 nước, điểm càng cao càng tốt. Không gợi ý. Chơi mỗi ngày để giữ chuỗi 🔥.',
        how: 'Mỗi ngày một ván cố định cho mọi lần chơi trong ngày: cùng bàn 4×4, cùng ô đá (nếu có) và cùng thứ tự ô mới. Có 250 nước — hết nước hoặc kẹt là xong, điểm cao nhất trong ngày được lưu. Chơi mỗi ngày để giữ chuỗi ngày liên tiếp. Ván này không có gợi ý.' },
    ],
    options: [
      { id: 'size', label: 'Cỡ bàn (Cổ điển)', def: '4', items: [
        { id: '3', name: '3×3', icon: '🟢', desc: 'Bàn nhỏ, chật — mục tiêu ô 256' },
        { id: '4', name: '4×4', icon: '🟡', desc: 'Bàn chuẩn — mục tiêu ô 2048' },
        { id: '5', name: '5×5', icon: '🟠', desc: 'Rộng rãi — mục tiêu ô 4096' },
        { id: '6', name: '6×6', icon: '🔵', desc: 'Rất rộng, ván dài — mục tiêu ô 8192' },
      ] },
    ],
    create: (api) => new G2048(api),
  });
})();

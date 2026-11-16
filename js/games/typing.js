// Gõ Chữ Tiếng Anh — luyện gõ 10 ngón + từ vựng theo CEFR (1 người gõ). Lõi: typing_core.js, kho từ + câu: typing_words.js.
// Chế độ trong file này: speed = Kiểm Tra Tốc Độ · finger = Luyện Ngón · cards = Thẻ Từ · stats = Tiến Độ.
// Chế độ ở file riêng (gắn vào qua TypingGame.addMode): meteor = Bắn Thiên Thạch (typing_meteor.js), race = Đua Xe Gõ Chữ (typing_race.js).
// Game tự nghe keydown khi đang chơi (App bỏ qua phím tắt P/H khi inst.typing); tiến độ lưu theo tên người chơi.
(() => {
  'use strict';
  const C = window.TypingCore;
  const BANK = C.makeBank(window.TYPING_WORDS || []);
  const SENTS = C.makeSents(window.TYPING_SENTS || []);
  const MONO = '"Consolas","DejaVu Sans Mono","Menlo","Courier New",monospace';
  const UI = '"Baloo 2", system-ui, sans-serif';
  const COL = { bg0: '#25124f', bg1: '#140a30', card: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.12)',
    todo: 'rgba(255,255,255,0.38)', good: '#f4f0ff', bad: '#ff5d73', caret: '#ffd23f', accent: '#ffd23f', mint: '#5dffb0', sub: '#b8a8e6' };
  // màu ngón tay (út trái → út phải, ngón cái)
  const FCOL = ['#ff8fa3', '#ffb86b', '#ffe066', '#7ee081', '#6fd3ff', '#8fa8ff', '#c49bff', '#ff9be0', '#cfcfe6'];
  const FNAME = ['út trái', 'áp út trái', 'giữa trái', 'trỏ trái', 'trỏ phải', 'giữa phải', 'áp út phải', 'út phải', 'ngón cái'];
  const KB_ROWS = ['qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./'];
  const SPEED_T = 60, FINGER_N = 20, CARD_N = 10, TARGET_WPM = 20, RETYPE = 3, SUM_LOCK = 0.8;
  const MODE_NAME = { speed: 'Kiểm Tra Tốc Độ', finger: 'Luyện Ngón', cards: 'Thẻ Từ', stats: 'Tiến Độ' };
  const store = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const EXTRA = {};    // chế độ gắn thêm từ file khác: id → impl

  let ACTIVE = null;
  addEventListener('keydown', (e) => {
    const g = ACTIVE;
    if (!g || typeof App === 'undefined' || App.inst !== g || App.state !== 'play') return;
    if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;   // đang sửa Bộ từ của tôi
    if (e.altKey || e.metaKey || (e.ctrlKey && e.key !== 'Backspace')) return;
    if (['Escape', 'F5', 'F11', 'F12', 'Tab'].includes(e.key)) return;
    if (g.onKey(e)) e.preventDefault();
  });

  class Typing {
    constructor(api) {
      this.api = api;
      this.typing = true; this.ownHelp = true; this.ownEndBanner = true;
      this.mode = api.mode || 'speed';
      this.X = EXTRA[this.mode] || null;
      this.p = api.players[0];
      this.finished = false;
      this.started = false;
      this.phase = 'play';
      this.t = 0; this.fx = []; this.bump = 0; this.ime = 0;
      if (this.mode === 'speed') this.total = api.T(SPEED_T);
      else if (this.mode === 'finger') this.nwords = api.count(FINGER_N);
      else if (this.mode === 'cards') this.ncards = api.count(CARD_N);
      if (this.X && this.X.init) this.X.init.call(this);
      this.quickStart = this.mode === 'stats';     // app bỏ đếm ngược + chữ "Bắt đầu!"
      this.time = this.total || 0;
    }
    // bắt đầu thật ở khung đầu tiên (tuỳ chọn mức đọc lúc này — app không tạo lại instance khi đổi tuỳ chọn)
    begin() {
      this.started = true;
      ACTIVE = this;
      this.level = (this.api.opts && this.api.opts.level) || 'rand';
      this.name = this.p.name || 'P1';
      this.prof = C.loadProfile(store, this.name);
      this.day = C.today();
      this.bot = !!this.p.bot;
      this.streak = C.streak(this.prof, this.day);
      this.setup();
    }
    /** dựng ván (gọi lại sau khi sửa Bộ từ của tôi) */
    setup() {
      this.phase = 'play'; this.lvNote = '';
      this.stats = C.srsStats(this.prof.srs, this.day);
      if (this.level === 'mine' && this.mode !== 'finger' && this.mode !== 'stats') {
        this.mineB = C.mineBank(this.prof.mine);
        if (!this.mineB.all.length) {
          if (this.bot) { this.level = 'rand'; this.lvNote = 'Bộ từ trống · dùng mọi mức'; }
          else { this.openEditor(); return; }
        }
      }
      if (this.X) { this.X.setup.call(this); return; }
      if (this.mode === 'speed') {
        this.ses = new C.Session(this.wordList(400), { finishOnLast: true });
      } else if (this.mode === 'finger') {
        this.letters = C.FINGER_ORDER.slice(0, Math.max(C.FINGER_START, this.prof.unlocked || C.FINGER_START));
        this.weak = C.weakness(this.prof.keys);
        this.ses = new C.Session(C.fingerWords(BANK.plain, this.letters, this.weak, this.nwords));
      } else if (this.mode === 'cards') {
        if (this.isMine()) {
          this.cards = C.pickCards(this.mineB, this.prof.srs, 'rand', this.ncards, this.day);
          if (!this.cards.length) this.lvNote = 'Bộ từ chưa có nghĩa · dùng mọi mức';
        } else {
          this.cards = C.pickCards(BANK, this.prof.srs, this.level, this.ncards, this.day);
          // mức này chưa có nghĩa tiếng Việt (hiện có A1–B1) → lấy thẻ ở mọi mức đã có nghĩa
          if (!this.cards.length) this.lvNote = `${this.level} chưa có nghĩa · dùng A1–B1`;
        }
        if (!this.cards.length) this.cards = C.pickCards(BANK, this.prof.srs, 'rand', this.ncards, this.day);
        this.ci = 0; this.okN = 0; this.log = [];
        this.newCard();
      } else if (this.mode === 'stats') {
        this.phase = 'stats';
        this.statData();
      }
    }

    /* ---------- nguồn từ ---------- */
    isMine() { return this.level === 'mine' && this.mineB && this.mineB.all.length > 0; }
    /** n từ để gõ liên tiếp (chỉ chữ thường a–z; Bộ từ của tôi: tách cụm thành từng từ) */
    wordList(n, filter, phrases) {
      if (this.isMine()) {
        if (phrases) return C.pickWords(this.mineB.all, n).map((e) => e.w);
        const toks = [];
        this.mineB.all.forEach((e) => e.w.split(' ').forEach((w) => { if (w && (!filter || filter(w))) toks.push({ w }); }));
        return C.pickWords(toks.length ? toks : this.mineB.all, n).map((e) => e.w);
      }
      let pool = C.byLevel(BANK.plain, this.level);
      if (filter) { const f = pool.filter((e) => filter(e.w)); if (f.length >= 20) pool = f; }
      return C.pickWords(pool.length ? pool : BANK.plain, n).map((e) => e.w);
    }
    /** nghĩa tiếng Việt của một từ đã gõ (Bộ từ của tôi trước, rồi kho) */
    viOf(w) {
      if (this.mineB) { const e = this.mineB.byWord.get(w) || this.mineB.all.find((x) => x.w.toLowerCase() === String(w).toLowerCase()); if (e && e.vi) return e.vi; }
      const e = BANK.byWord.get(C.bare(w)) || BANK.byWord.get(w);
      return e ? e.vi : '';
    }
    /** khoá trong hộp Leitner của một từ đã gõ, hoặc null nếu không phải từ có trong kho */
    srsKey(w) {
      if (this.mineB) { const e = this.mineB.all.find((x) => x.w.toLowerCase() === String(w).toLowerCase()); if (e) return e.w; }
      const b = C.bare(w);
      return BANK.byWord.has(b) ? b : null;
    }
    /** từ gõ sai → hộp 1 (mọi chế độ đều ghi điểm từ) */
    markWrong(words) { return C.markWrong(this.prof, words, this.day, (w) => this.srsKey(w)); }

    /* ---------- Bộ từ của tôi: ô dán chữ ---------- */
    openEditor() {
      if (this.edBox) return;
      this.phase = 'edit';
      const stage = document.getElementById('stage');
      if (!stage) return;
      if (!document.getElementById('ty-mine-css')) {
        const st = document.createElement('style'); st.id = 'ty-mine-css';
        st.textContent = `#ty-mine{position:absolute;left:190px;top:84px;width:900px;height:560px;z-index:30;display:flex;flex-direction:column;gap:10px;
          padding:22px 26px;box-sizing:border-box;border-radius:24px;background:#2a1650;border:3px solid #ffd23f;box-shadow:0 18px 50px rgba(0,0,0,.5);
          font-family:"Baloo 2",system-ui,sans-serif;color:#fff}
          #ty-mine h3{margin:0;font-size:30px;line-height:1.1}#ty-mine p{margin:0;color:#cbbcf2;font-size:17px;line-height:1.35}
          #ty-mine textarea{flex:1;resize:none;border-radius:14px;border:2px solid rgba(255,255,255,.25);background:#140a30;color:#fff;
          font:20px/1.45 Consolas,"DejaVu Sans Mono",monospace;padding:12px 14px;outline:none}
          #ty-mine textarea:focus{border-color:#ffd23f}#ty-mine .row{display:flex;align-items:center;gap:12px}
          #ty-mine .cnt{flex:1;color:#5dffb0;font-size:18px;font-weight:700}
          #ty-mine button{font:700 20px "Baloo 2",system-ui,sans-serif;border:0;border-radius:14px;padding:8px 22px;cursor:pointer;background:rgba(255,255,255,.14);color:#fff}
          #ty-mine button.go{background:#ffd23f;color:#2a1840}`;
        document.head.appendChild(st);
      }
      const box = document.createElement('div');
      box.id = 'ty-mine';
      box.innerHTML = `<h3>📝 Bộ từ của tôi — ${esc(this.name)}</h3>
        <p>Dán danh sách từ đang học, mỗi dòng một từ: <b>word - nghĩa</b> (hoặc <b>word = nghĩa</b>, <b>word: nghĩa</b>, hoặc chỉ <b>word</b> — game tự tìm nghĩa trong kho nếu có). Lưu theo tên người chơi.</p>
        <textarea spellcheck="false" placeholder="abandon - từ bỏ&#10;look after - chăm sóc&#10;curious - tò mò"></textarea>
        <div class="row"><span class="cnt"></span><button class="no">Huỷ (Esc)</button><button class="go">💾 Lưu &amp; chơi (Ctrl+Enter)</button></div>`;
      stage.appendChild(box);
      const ta = box.querySelector('textarea'), cnt = box.querySelector('.cnt');
      ta.value = (this.prof.mine || []).map((e) => (e.vi ? `${e.w} - ${e.vi}` : e.w)).join('\n');
      const look = (w) => { const e = BANK.byWord.get(w.toLowerCase()); return e ? e.vi : ''; };
      const count = () => {
        const list = C.parseMine(ta.value, look);
        cnt.textContent = list.length ? `Đọc được ${list.length} từ · ${list.filter((e) => e.vi).length} từ có nghĩa` : 'Chưa có từ nào';
        return list;
      };
      const close = (save) => {
        const list = count();
        box.remove(); this.edBox = null;
        if (save) {
          this.prof.mine = list;
          if (!this.bot) C.saveProfile(store, this.name, this.prof);
        }
        if (!this.prof.mine.length) this.level = 'rand';
        this.setup();
        if (this.level === 'rand' && this.mode !== 'stats') this.lvNote = 'Bộ từ trống · dùng mọi mức';
      };
      ta.addEventListener('input', count);
      box.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
        else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); close(true); }
      });
      box.querySelector('.go').onclick = () => close(true);
      box.querySelector('.no').onclick = () => close(false);
      box.addEventListener('mousedown', (e) => e.stopPropagation());
      count();
      this.edBox = box;
      // tạm dừng thì ẩn ô dán; rời ván (thoát ra menu) thì gỡ hẳn
      const watch = setInterval(() => {
        if (!this.edBox) { clearInterval(watch); return; }
        if (typeof App === 'undefined') return;
        if (App.inst !== this || !['play', 'paused'].includes(App.state)) { this.closeEditorDom(); clearInterval(watch); return; }
        box.style.display = App.state === 'play' ? 'flex' : 'none';
      }, 200);
      setTimeout(() => { try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* bỏ qua */ } }, 30);
    }
    closeEditorDom() { if (this.edBox) { this.edBox.remove(); this.edBox = null; } }

    /* ---------- bàn phím ---------- */
    onKey(e) {
      if (this.phase === 'edit') return false;
      if (this.phase === 'stats') {
        if (['Enter', ' ', 'm', 'M'].includes(e.key)) this.leave('intro');
        return true;
      }
      if (this.phase === 'sum') {
        if (this.sumT > SUM_LOCK) {
          if (e.key === 'Enter' || e.key === ' ') this.leave('replay');
          else if (e.key === 'm' || e.key === 'M') this.leave('intro');
        }
        return true;
      }
      if (e.key === 'F2' && this.level === 'mine') { this.openEditor(); return true; }
      if (C.isImeKey(e)) { this.ime = 4; return true; }
      if (this.X) return this.X.key.call(this, e);
      const k = e.key;
      if (this.mode === 'cards') return this.cardKey(e);
      if (!this.ses) return false;
      if (k === 'Backspace') { (e.ctrlKey ? this.ses.backWord() : this.ses.back()); return true; }
      if (k.length !== 1) return false;
      if (k !== ' ' && !/^[\x21-\x7e]$/.test(k)) return true;
      this.press(k);
      return true;
    }
    press(ch) {
      const r = this.ses.type(ch, this.ms());
      if (r === null) return r;
      this.bump = 1;
      if (r === false) Sfx.tone(160, 0.06, 'square', 0.05); else Sfx.tone(ch === ' ' ? 520 : 780 + Math.random() * 60, 0.025, 'triangle', 0.035);
      if (this.ses.finished && !this.X) this.endRun();
      return r;
    }
    /** rời màn tổng kết: 'replay' = chơi lại ngay, 'intro' = về màn chọn chế độ (người thật); máy thì để app hiện kết quả */
    leave(to) {
      if (!this.bot) this.exitTo = to;
      this.finish();
    }

    /* ---------- Thẻ Từ ---------- */
    newCard() {
      const e = this.cards[this.ci];
      this.card = { e, input: '', state: 'ask', retype: 0, t: 0, hint: 0, wrongOnce: false };
    }
    cardKey(e) {
      const c = this.card;
      if (!c) return false;
      if (c.state === 'right') { if (e.key === 'Enter' || e.key === ' ') this.nextCard(); return true; }
      if (e.key === 'Backspace') { c.input = e.ctrlKey ? '' : c.input.slice(0, -1); return true; }
      if (e.key === 'Enter') { this.checkCard(); return true; }
      if (e.key === '?' || e.key === '/') { this.hint(); return true; }
      if (e.key.length === 1 && /^[a-zA-Z' .-]$/.test(e.key) && c.input.length < 30) {
        c.input += e.key; this.bump = 1; Sfx.tone(760 + Math.random() * 60, 0.025, 'triangle', 0.03);
        // gõ lại sau khi sai: đúng đủ là tự sang lượt gõ lại tiếp
        if (c.state === 'retype' && c.input.toLowerCase() === c.e.w.toLowerCase()) this.checkCard();
      }
      return true;
    }
    hint() {
      const c = this.card, w = c.e.w;
      if (c.state !== 'ask') return;
      c.hint = Math.min(w.length - 1, c.hint + 1);
      c.wrongOnce = true;        // dùng gợi ý = chưa thuộc
      Sfx.play('tick');
    }
    checkCard() {
      const c = this.card, w = c.e.w, ok = c.input.trim().toLowerCase() === w.toLowerCase();
      if (c.state === 'ask') {
        if (ok && !c.wrongOnce) { this.grade(true); c.state = 'right'; c.t = 0; this.okN++; Sfx.play('pickup'); this.sparkle(640, 330, COL.mint); }
        else if (ok) { this.grade(false); c.state = 'right'; c.t = 0; Sfx.play('select'); }
        else { this.grade(false); c.state = 'retype'; c.retype = 0; c.t = 0; c.miss = c.input; c.input = ''; Sfx.play('hurt'); FX.shake(4); }
      } else if (c.state === 'retype') {
        if (ok) {
          c.retype++; c.input = ''; Sfx.tone(600 + c.retype * 120, 0.08, 'sine', 0.06);
          if (c.retype >= RETYPE) { c.state = 'right'; c.t = 0; }
        } else { c.input = ''; Sfx.tone(160, 0.08, 'square', 0.05); }
      }
    }
    grade(ok) {
      const c = this.card;
      if (c.graded) return;
      c.graded = true;
      this.prof.srs[c.e.w] = C.review(this.prof.srs[c.e.w], ok, this.day);
      this.log.push({ e: c.e, ok, box: this.prof.srs[c.e.w][0] });
    }
    nextCard() {
      this.ci++;
      if (this.ci >= this.cards.length) { this.card = null; this.endRun(); return; }
      this.newCard();
    }

    /* ---------- kết thúc ---------- */
    endRun() {
      if (this.phase === 'sum') return;
      this.phase = 'sum'; this.sumT = 0;
      const t = this.ms();
      const prof = this.prof;
      C.markDay(prof, this.day);
      if (this.X) this.X.end.call(this);
      else if (this.mode === 'cards') {
        this.result = { ok: this.okN, n: this.log.length };
        prof.hist.push({ d: this.day, m: 'cards', ok: this.okN, n: this.log.length });
      } else {
        const s = this.ses, wpm = Math.round(s.wpm(t)), acc = Math.round(s.acc() * 100);
        C.mergeKeys(prof, s.perKey);
        this.result = { wpm, acc, raw: Math.round(s.raw(t)), keys: s.keys, bad: s.bad, wrong: s.wrongList(), sec: Math.round(s.elapsed(t)) };
        const key = this.mode === 'speed' ? 'speed' + this.total : 'finger';
        this.result.best = prof.best[key] || 0;
        this.result.record = wpm > this.result.best && s.keys > 10;
        if (this.result.record) prof.best[key] = wpm;
        prof.hist.push({ d: this.day, m: this.mode, wpm, acc });
        if (this.mode === 'speed') this.markWrong(this.result.wrong);
        if (this.mode === 'finger' && wpm >= TARGET_WPM && acc >= 95 && (prof.unlocked || C.FINGER_START) < C.FINGER_ORDER.length) {
          prof.unlocked = (prof.unlocked || C.FINGER_START) + 1;
          this.result.unlock = C.FINGER_ORDER[prof.unlocked - 1];
        }
      }
      if (!this.bot) C.saveProfile(store, this.name, prof);
      this.stats = C.srsStats(prof.srs, this.day);
      Sfx.play('win');
    }
    finish() {
      if (this.finished) return;
      this.finished = true;
      this.closeEditorDom();
      if (ACTIVE === this) ACTIVE = null;
    }
    results() {
      const r = this.result || {};
      if (this.X) return this.X.results.call(this);
      if (this.mode === 'stats') return [{ score: 0, text: 'Đã xem tiến độ' }];
      if (this.mode === 'cards') return [{ score: r.ok || 0, text: `${r.ok || 0}/${r.n || 0} thẻ nhớ đúng` }];
      return [{ score: r.wpm || 0, text: `${r.wpm || 0} WPM · chính xác ${r.acc || 0}%` }];
    }
    /** đồng hồ của ván (ms): chỉ chạy trong update nên lúc tạm dừng không bị tính giờ */
    ms() { return this.t * 1000; }
    botInput() { return {}; }
    posOf() { return { x: 110, y: 640 }; }

    /* ---------- vòng lặp ---------- */
    update(dt) {
      if (!this.started) this.begin();
      if (this.phase === 'edit') return;          // đang sửa Bộ từ của tôi: đứng hình, không tính giờ
      this.t += dt;
      this.bump = Math.max(0, this.bump - dt * 6);
      this.ime = Math.max(0, this.ime - dt);
      this.fx = this.fx.filter((f) => (f.t += dt) < f.life);
      if (this.phase === 'stats') { this.sumT = (this.sumT || 0) + dt; if (this.bot && this.sumT > 1.5) this.finish(); return; }
      if (this.phase === 'sum') {
        this.sumT += dt;
        if (this.X && this.X.sumUpdate) this.X.sumUpdate.call(this, dt);
        if (this.bot && this.sumT > 1.2) this.finish();
        return;
      }
      if (this.X) { this.X.update.call(this, dt); if (this.bot && this.phase === 'play') this.X.bot.call(this, dt); return; }
      if (this.mode === 'speed' && this.ses.t0 !== null) {
        this.time = Math.max(0, this.total - this.ses.elapsed(this.ms()));
        if (this.time <= 0) { this.ses.tEnd = this.ses.t0 + this.total * 1000; this.endRun(); }
      }
      if (this.mode === 'cards' && this.card) this.card.t += dt;
      if (this.bot) this.botStep(dt);
    }
    /** máy tự gõ (ảnh thẻ, smoke test): ~42 WPM, thỉnh thoảng gõ sai rồi xoá */
    botStep(dt) {
      this.botT = (this.botT || 0) + dt;
      const gap = 60 / (42 * 5);
      while (this.botT > gap) {
        this.botT -= gap;
        if (this.mode === 'cards') {
          const c = this.card; if (!c) return;
          if (c.state === 'right') { if (c.t > 0.6) this.nextCard(); return; }
          const w = c.e.w;
          if (c.state === 'ask' && c.input === '' && Math.random() < 0.25 && !c.botMiss) { c.botMiss = true; c.input = w.slice(0, 2) + 'x'; this.checkCard(); return; }
          if (c.input.length < w.length) { c.input += w[c.input.length]; this.bump = 1; } else this.checkCard();
          return;
        }
        if (!this.botType()) return;
      }
    }
    /** máy gõ một phím vào phiên this.ses (dùng chung cho Đua Xe); false = hết việc */
    botType() {
      const s = this.ses; if (!s || s.finished || this.phase !== 'play') return false;
      if (this.botErr) { s.back(); this.botErr = false; return true; }
      const want = s.expected();
      if (want !== ' ' && Math.random() < 0.04) { this.press('q' === want ? 'w' : 'q'); this.botErr = true; return true; }
      this.press(want);
      return this.phase === 'play';
    }
    sparkle(x, y, c, n = 14) { for (let i = 0; i < n; i++) this.fx.push({ x, y, vx: U.rand(-240, 240), vy: U.rand(-260, 60), t: 0, life: U.rand(0.5, 0.9), c }); }

    /* ---------- vẽ ---------- */
    draw(ctx) {
      if (this.X && this.X.bg && this.started && this.phase !== 'sum') this.X.bg.call(this, ctx);
      else {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, COL.bg0); g.addColorStop(1, COL.bg1);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 1, H);
        for (let y = 0; y < H; y += 40) ctx.fillRect(0, y, W, 1);
      }
      if (!this.started) return;
      this.drawTop(ctx);
      if (this.phase === 'edit') { T(ctx, 'Đang sửa Bộ từ của tôi…', 640, 690, { size: 20, color: COL.sub }); return; }
      if (this.phase === 'stats') this.drawStats(ctx);
      else if (this.phase === 'sum') { if (this.X) this.X.drawSum.call(this, ctx); else this.drawSummary(ctx); this.drawSumKeys(ctx); }
      else if (this.X) this.X.draw.call(this, ctx);
      else if (this.mode === 'speed') this.drawSpeed(ctx);
      else if (this.mode === 'finger') this.drawFinger(ctx);
      else this.drawCard(ctx);
      for (const f of this.fx) {
        const k = f.t / f.life;
        ctx.globalAlpha = 1 - k; ctx.fillStyle = f.c;
        ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t + 300 * f.t * f.t, 5 * (1 - k) + 1, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // nhân vật Tròn góc trái dưới nhún theo phím gõ (Bắn Thiên Thạch / Đua Xe tự vẽ Tròn của mình)
      if (!(this.X && this.X.ownBlob && this.phase === 'play') && this.phase !== 'stats') {
        Draw.blob(ctx, { x: 92, y: 650 - this.bump * 14, r: 30, color: this.p.color, face: 0, squash: this.bump * 0.18, walk: 0 });
      }
      if (this.ime > 0) this.drawIme(ctx);
    }
    drawTop(ctx) {
      let lvTxt = this.level === 'rand' ? 'Mọi mức' : this.level === 'mine' ? '📝 Của tôi' : this.level;
      if (this.isMine()) lvTxt = `📝 Của tôi · ${this.mineB.all.length} từ · F2 sửa`;
      if (this.lvNote) lvTxt = this.lvNote;
      const title = `⌨️ ${(this.X && this.X.name) || MODE_NAME[this.mode]}`;
      T(ctx, title, 40, 46, { size: 30, color: '#fff', align: 'left' });
      // Luyện Ngón / Tiến Độ không dùng mức từ nên không hiện
      if (this.mode !== 'finger' && this.mode !== 'stats') chip(ctx, 40 + ctx.measureText(title).width + 16, 30, lvTxt, COL.accent, '#2a1840');
      const info = `👤 ${this.name} · 🔥 ${this.streak} ngày · 📚 thuộc ${this.stats ? this.stats.known : 0} từ · ⏰ cần ôn ${this.stats ? this.stats.due : 0}`;
      T(ctx, info, W - 40, 46, { size: 18, color: COL.sub, align: 'right' });
    }
    // ---- Kiểm Tra Tốc Độ ----
    drawSpeed(ctx) {
      const s = this.ses, tm = this.ms();
      // đồng hồ + số liệu sống
      const left = Math.ceil(this.time);
      bigStat(ctx, 220, 132, s.t0 === null ? `${this.total}` : `${left}`, 'giây', left <= 10 && s.t0 !== null ? COL.bad : COL.accent);
      bigStat(ctx, 640, 132, `${Math.round(s.wpm(tm))}`, 'WPM', '#fff');
      bigStat(ctx, 1060, 132, `${Math.round(s.acc() * 100)}%`, 'chính xác', COL.mint);
      panel(ctx, 100, 190, 1080, 250);
      this.drawWords(ctx, s, 140, 249, 1000, 66, 3, 40);
      if (s.t0 === null) T(ctx, 'Gõ chữ đầu tiên để bắt đầu tính giờ · Space sang từ sau · Backspace để sửa', 640, 480, { size: 20, color: COL.sub });
      else T(ctx, `Phím sai: ${s.bad} · đã sửa: ${s.corrections}`, 640, 480, { size: 20, color: COL.sub });
    }
    /** vẽ các từ của phiên gõ thành dòng; dòng đang gõ là dòng thứ 2 (trừ lúc đầu) */
    drawWords(ctx, s, x0, y0, maxW, lh, nLines, size) {
      ctx.font = `${size}px ${MONO}`;
      const cw = ctx.measureText('M').width;
      // chia dòng (độ dài từ = max(từ, phần đã gõ))
      const lines = []; let line = [], w = 0;
      const lim = Math.min(s.words.length, s.cur + 80);
      for (let i = 0; i < lim; i++) {
        const len = Math.max(s.words[i].length, s.typed[i].length) * cw;
        if (line.length && w + len > maxW) { lines.push(line); line = []; w = 0; }
        line.push(i); w += len + cw;
      }
      if (line.length) lines.push(line);
      let li = lines.findIndex((l) => l.includes(Math.min(s.cur, lim - 1)));
      if (li < 0) li = lines.length - 1;
      const first = Math.max(0, li - 1);
      const blink = (this.t * 2) % 2 < 1.3;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      for (let r = 0; r < nLines && first + r < lines.length; r++) {
        let x = x0;
        const y = y0 + r * lh;
        for (const i of lines[first + r]) {
          const word = s.words[i], typed = s.typed[i], cur = i === s.cur;
          const n = Math.max(word.length, typed.length);
          for (let j = 0; j < n; j++) {
            let ch, c;
            if (j < typed.length) { ch = j < word.length ? word[j] : typed[j]; c = typed[j] === word[j] ? COL.good : COL.bad; }
            else { ch = word[j]; c = s.done[i] ? COL.bad : COL.todo; }
            if (j >= word.length) { ctx.globalAlpha = 0.75; }
            ctx.fillStyle = c; ctx.fillText(ch, x + j * cw, y);
            ctx.globalAlpha = 1;
          }
          if (s.done[i] && typed !== word) { ctx.fillStyle = COL.bad; ctx.fillRect(x, y + size * 0.55, n * cw, 3); }
          if (cur && blink) { ctx.fillStyle = COL.caret; ctx.fillRect(x + typed.length * cw - 1, y - size * 0.6, 3, size * 1.2); }
          x += n * cw + cw;
        }
      }
      ctx.textBaseline = 'alphabetic';
    }
    // ---- Luyện Ngón ----
    drawFinger(ctx) {
      const s = this.ses, tm = this.ms();
      T(ctx, `Từ ${Math.min(s.cur + 1, s.words.length)}/${s.words.length}`, 140, 112, { size: 22, color: COL.sub, align: 'left' });
      T(ctx, `${Math.round(s.wpm(tm))} WPM · ${Math.round(s.acc() * 100)}% · mục tiêu ${TARGET_WPM} WPM, 95% để mở chữ mới`, 1140, 112, { size: 22, color: COL.sub, align: 'right' });
      panel(ctx, 100, 128, 1080, 170);
      this.drawWords(ctx, s, 140, 176, 1000, 64, 2, 40);
      // chữ đã mở
      const L = C.FINGER_ORDER, n = this.letters.length;
      T(ctx, 'Chữ đã mở:', 140, 334, { size: 20, color: COL.sub, align: 'left' });
      ctx.font = `22px ${MONO}`; ctx.textAlign = 'left';
      for (let i = 0; i < L.length; i++) {
        const open = i < n;
        ctx.fillStyle = open ? '#fff' : 'rgba(255,255,255,0.22)';
        ctx.fillText(L[i], 262 + i * 22, 334);
      }
      this.drawKeyboard(ctx, 640, 380, s.expected());
    }
    drawKeyboard(ctx, cx, y0, next) {
      const K = 62, G = 8, offs = [0, 18, 46];
      const set = new Set(this.letters);
      for (let r = 0; r < 3; r++) {
        const row = KB_ROWS[r], w = row.length * (K + G) - G, x0 = cx - w / 2 + offs[r] - 20;
        for (let i = 0; i < row.length; i++) {
          const k = row[i], f = C.FINGER[k], x = x0 + i * (K + G), y = y0 + r * (K + G);
          const open = set.has(k), isNext = k === next;
          const weak = (this.weak && this.weak[k]) || 0;
          ctx.globalAlpha = open ? 1 : 0.28;
          Draw.rr(ctx, x, y + (isNext ? 3 : 0), K, K, 12); ctx.fillStyle = FCOL[f]; ctx.fill();
          if (isNext) { ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
          else if (weak > 0.5 && open) { ctx.lineWidth = 3; ctx.strokeStyle = COL.bad; ctx.stroke(); }
          ctx.globalAlpha = 1;
          T(ctx, k.toUpperCase(), x + K / 2, y + K / 2 + (isNext ? 3 : 0), { size: 28, color: '#2a1840', weight: 800 });
          if (r === 1 && (k === 'f' || k === 'j')) { ctx.fillStyle = '#2a1840'; ctx.fillRect(x + K / 2 - 8, y + K - 12, 16, 3); }
        }
      }
      // phím cách
      const sy = y0 + 3 * (K + G), sw = 360, isSp = next === ' ';
      Draw.rr(ctx, cx - sw / 2, sy + (isSp ? 3 : 0), sw, 48, 12); ctx.fillStyle = FCOL[8]; ctx.fill();
      if (isSp) { ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
      T(ctx, 'Space', cx, sy + 24 + (isSp ? 3 : 0), { size: 20, color: '#2a1840', weight: 800 });
      // chỉ dẫn ngón
      const f = next ? C.FINGER[next] : null;
      if (f !== undefined && f !== null) {
        T(ctx, `Gõ ${next === ' ' ? 'Space' : `"${next}"`} bằng ngón ${FNAME[f]}`, cx, sy + 92, { size: 24, color: FCOL[f] });
      }
    }
    // ---- Thẻ Từ ----
    drawCard(ctx) {
      const c = this.card;
      // tiến độ
      const n = this.cards.length, dw = 26;
      for (let i = 0; i < n; i++) {
        const lg = this.log[i];
        ctx.fillStyle = lg ? (lg.ok ? COL.mint : COL.bad) : i === this.ci ? COL.accent : 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.arc(640 - (n - 1) * dw / 2 + i * dw, 112, 8, 0, 7); ctx.fill();
      }
      if (!c) return;
      const e = c.e, rec = this.prof.srs[e.w];
      panel(ctx, 240, 140, 800, 470);
      chip(ctx, 270, 162, e.mine ? '📝 của tôi' : (C.posVi(e.pos) || 'từ'), 'rgba(255,255,255,0.14)', '#fff');
      chip(ctx, 1010, 162, `${C.LEVELS[e.lv] || ''}${rec ? `${e.lv >= 0 ? ' · ' : ''}hộp ${rec[0]}` : `${e.lv >= 0 ? ' · ' : ''}từ mới`}`, 'rgba(255,255,255,0.14)', '#fff', 'right');
      // nghĩa tiếng Việt
      wrapText(ctx, e.vi, 640, 270, 700, 46, 2, { size: 44, color: '#fff' });
      // gợi ý: chữ đầu + gạch dưới
      const w = e.w;
      const show = c.state === 'ask' ? 1 + c.hint : w.length;
      ctx.font = `40px ${MONO}`;
      const cw = Math.min(ctx.measureText('M').width + 6, 640 / w.length), x0 = 640 - (w.length * cw) / 2, yy = 390;
      for (let i = 0; i < w.length; i++) {
        const ch = w[i];
        if (ch === ' ' || ch === '-' || ch === "'" || ch === '.') { T(ctx, ch === ' ' ? '' : ch, x0 + i * cw + cw / 2, yy, { size: 36, color: COL.sub, font: MONO }); continue; }
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x0 + i * cw + 4, yy + 8, cw - 8, 3);
        if (i < show) T(ctx, ch, x0 + i * cw + cw / 2, yy, { size: 40, color: c.state === 'ask' ? COL.sub : COL.mint, font: MONO });
      }
      // ô gõ
      const boxY = 450;
      Draw.rr(ctx, 400, boxY, 480, 64, 14); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = c.state === 'retype' ? COL.bad : c.state === 'right' ? COL.mint : 'rgba(255,255,255,0.3)'; ctx.stroke();
      T(ctx, c.input + ((this.t * 2) % 2 < 1.3 && c.state !== 'right' ? '|' : ''), 640, boxY + 32, { size: 36, color: '#fff', font: MONO });
      // trạng thái
      let msg = 'Gõ từ tiếng Anh rồi Enter · ? = gợi ý thêm một chữ';
      let mc = COL.sub;
      if (c.state === 'retype') { msg = `Đáp án: "${w}" — gõ lại ${RETYPE - c.retype} lần nữa${c.miss ? ` (bạn gõ "${c.miss}")` : ''}`; mc = COL.bad; }
      if (c.state === 'right') {
        const lg = this.log[this.log.length - 1];
        msg = lg && lg.ok ? `Đúng rồi! "${w}" lên hộp ${lg.box} · Enter: thẻ tiếp` : `"${w}" — sẽ gặp lại sớm · Enter: thẻ tiếp`;
        mc = lg && lg.ok ? COL.mint : COL.accent;
      }
      T(ctx, msg, 640, 572, { size: 22, color: mc });
    }
    // ---- tổng kết ----
    drawSummary(ctx) {
      const r = this.result || {};
      panel(ctx, 160, 100, 960, 540);
      if (this.mode === 'cards') {
        T(ctx, `Nhớ đúng ${r.ok}/${r.n} thẻ`, 640, 170, { size: 50, color: COL.accent });
        T(ctx, `Đã thuộc ${this.stats.known} từ · đang học ${this.stats.learning} · cần ôn hôm nay ${this.stats.due}`, 640, 214, { size: 22, color: COL.sub });
        const rows = this.log.slice(0, 10);
        rows.forEach((lg, i) => {
          const y = 262 + i * 32;
          T(ctx, lg.ok ? '✓' : '✗', 230, y, { size: 24, color: lg.ok ? COL.mint : COL.bad, align: 'left' });
          T(ctx, fit(ctx, lg.e.w, 240, 24, MONO), 270, y, { size: 24, color: '#fff', align: 'left', font: MONO });
          T(ctx, fit(ctx, lg.e.vi, 520, 22), 520, y, { size: 22, color: COL.sub, align: 'left' });
          T(ctx, `hộp ${lg.box}`, 1080, y, { size: 20, color: COL.sub, align: 'right' });
        });
      } else {
        bigStat(ctx, 400, 200, `${r.wpm}`, 'WPM', COL.accent, 72);
        bigStat(ctx, 640, 200, `${r.acc}%`, 'chính xác', COL.mint, 72);
        bigStat(ctx, 880, 200, `${r.raw}`, 'tốc độ thô', '#fff', 72);
        let y = 262;
        if (r.record) { T(ctx, `🏆 Kỷ lục mới! (trước: ${r.best} WPM)`, 640, y, { size: 26, color: COL.accent }); y += 36; }
        else if (r.best) { T(ctx, `Kỷ lục của bạn: ${r.best} WPM`, 640, y, { size: 22, color: COL.sub }); y += 34; }
        if (r.unlock) { T(ctx, `🔓 Mở chữ mới: "${r.unlock.toUpperCase()}"`, 640, y, { size: 28, color: COL.mint }); y += 38; }
        else if (this.mode === 'finger') { T(ctx, `Cần ${TARGET_WPM} WPM và 95% để mở chữ mới`, 640, y, { size: 22, color: COL.sub }); y += 34; }
        // từ gõ sai + nghĩa (lúc học nghĩa là sau khi gõ, không phải trong lúc gõ)
        this.drawWrong(ctx, r.wrong, y + 14, 8);
        // phím yếu
        const wk = Object.entries(C.weakness(this.prof.keys)).sort((a, b) => b[1] - a[1]).slice(0, 5).filter((x) => x[1] > 0.3);
        if (wk.length) T(ctx, `Phím cần luyện: ${wk.map((x) => x[0].toUpperCase()).join('  ')}`, 640, 580, { size: 22, color: COL.sub });
      }
    }
    /** danh sách từ gõ sai kèm nghĩa (2 cột × 4 dòng) */
    drawWrong(ctx, list, y, max = 8, x0 = 230) {
      const wrong = [...new Set(list || [])].slice(0, max);
      if (!wrong.length) { T(ctx, 'Không sai từ nào — tuyệt!', 640, y + 6, { size: 24, color: COL.mint }); return; }
      T(ctx, 'Từ gõ sai — xem lại nghĩa (đã đưa vào Thẻ Từ để ôn):', x0, y, { size: 22, color: '#fff', align: 'left' });
      const rows = Math.ceil(max / 2);
      wrong.forEach((w, i) => {
        const yy = y + 36 + (i % rows) * 32, xx = i < rows ? x0 : x0 + 450;
        T(ctx, fit(ctx, w, 150, 22, MONO), xx, yy, { size: 22, color: COL.bad, align: 'left', font: MONO });
        T(ctx, fit(ctx, this.viOf(w) || '—', 280, 20), xx + 160, yy, { size: 20, color: COL.sub, align: 'left' });
      });
    }
    drawSumKeys(ctx) {
      if (this.sumT > SUM_LOCK) T(ctx, 'Enter: chơi lại  ·  M: chọn chế độ khác', 640, 620, { size: 24, color: (this.t * 2) % 2 < 1.4 ? '#fff' : COL.sub });
    }

    /* ---------- Tiến Độ ---------- */
    statData() {
      const prof = this.prof;
      this.sd = {
        days: C.byDay(prof.hist, 14, this.day),
        boxes: C.boxCounts(prof.srs),
        heat: heatOf(prof.keys),
        weak: Object.entries(C.weakness(prof.keys)).sort((a, b) => b[1] - a[1]).slice(0, 4).filter((x) => x[1] > 0.2).map((x) => x[0]),
      };
    }
    drawStats(ctx) {
      const prof = this.prof, sd = this.sd;
      // --- bản đồ phím yếu ---
      panel(ctx, 30, 82, 610, 330);
      T(ctx, '⌨️ Bản đồ phím', 56, 112, { size: 24, color: '#fff', align: 'left' });
      T(ctx, 'xanh = chắc tay · vàng = tạm · đỏ = hay sai / chậm', 614, 112, { size: 16, color: COL.sub, align: 'right' });
      const K = 50, G = 6, offs = [0, 14, 36];
      for (let r = 0; r < 3; r++) {
        const row = KB_ROWS[r], x0 = 335 - (row.length * (K + G) - G) / 2 + offs[r] - 16;
        for (let i = 0; i < row.length; i++) {
          const k = row[i], h = sd.heat[k], x = x0 + i * (K + G), y = 140 + r * (K + G + 14);
          Draw.rr(ctx, x, y, K, K, 10);
          ctx.fillStyle = h ? heatColor(h.score) : 'rgba(255,255,255,0.08)'; ctx.fill();
          T(ctx, k.toUpperCase(), x + K / 2, y + K / 2 - 5, { size: 22, color: h ? '#2a1840' : 'rgba(255,255,255,0.35)', weight: 800 });
          if (h) T(ctx, `${Math.round(h.err * 100)}%`, x + K / 2, y + K - 9, { size: 13, color: '#2a1840', weight: 700 });
        }
      }
      if (sd.weak.length) {
        T(ctx, 'Phím yếu nhất:', 56, 362, { size: 20, color: '#fff', align: 'left' });
        sd.weak.forEach((k, i) => {
          const h = sd.heat[k];
          T(ctx, `${k.toUpperCase()}: sai ${Math.round(h.err * 100)}% · ${h.ms ? Math.round(h.ms) + ' ms' : '—'}`,
            200 + (i % 2) * 220, 362 + Math.floor(i / 2) * 28, { size: 18, color: heatColor(h.score), align: 'left' });
        });
      } else T(ctx, 'Chưa đủ dữ liệu — gõ thêm vài ván Kiểm Tra Tốc Độ / Luyện Ngón', 335, 375, { size: 18, color: COL.sub });
      // --- biểu đồ WPM theo ngày ---
      panel(ctx, 660, 82, 590, 330);
      T(ctx, '📈 WPM 14 ngày gần nhất', 686, 112, { size: 24, color: '#fff', align: 'left' });
      T(ctx, '— cao nhất · ▮ trung bình', 1224, 112, { size: 15, color: COL.sub, align: 'right' });
      this.drawChart(ctx, 700, 150, 520, 220, sd.days);
      // --- từ vựng ---
      panel(ctx, 30, 428, 610, 210);
      T(ctx, '📚 Từ vựng (hộp Leitner)', 56, 458, { size: 24, color: '#fff', align: 'left' });
      const st = this.stats, bx = sd.boxes, mx = Math.max(1, ...bx.slice(1));
      for (let b = 1; b <= 5; b++) {
        const x = 70 + (b - 1) * 108, hh = 100 * bx[b] / mx;
        Draw.rr(ctx, x, 590 - Math.max(4, hh), 70, Math.max(4, hh), 8);
        ctx.fillStyle = b >= C.KNOWN_BOX ? COL.mint : b === 1 ? COL.bad : COL.accent; ctx.fill();
        T(ctx, `${bx[b]}`, x + 35, 578 - Math.max(4, hh), { size: 18, color: '#fff' });
        T(ctx, `hộp ${b}`, x + 35, 610, { size: 16, color: COL.sub });
      }
      T(ctx, `Thuộc ${st.known} · đang học ${st.learning} · cần ôn ${st.due}`, 614, 458, { size: 17, color: COL.sub, align: 'right' });
      // --- kỷ lục + chuỗi ngày ---
      panel(ctx, 660, 428, 590, 210);
      T(ctx, '🏆 Kỷ lục', 686, 458, { size: 24, color: '#fff', align: 'left' });
      const b = prof.best || {};
      const recs = [
        ['⏱️ Tốc độ', ['speed30', 'speed60', 'speed90'].map((k) => b[k] || 0).reduce((a, c) => Math.max(a, c), 0), 'WPM'],
        ['🏎️ Đua Xe', b.race || 0, 'WPM'], ['🖐️ Luyện Ngón', b.finger || 0, 'WPM'], ['☄️ Thiên Thạch', b.meteor || 0, 'điểm'],
      ];
      recs.forEach(([n, v, u], i) => {
        const x = 690 + (i % 2) * 280, y = 498 + Math.floor(i / 2) * 36;
        T(ctx, n, x, y, { size: 20, color: COL.sub, align: 'left' });
        T(ctx, v ? `${v} ${u}` : '—', x + 250, y, { size: 22, color: v ? COL.accent : COL.sub, align: 'right' });
      });
      // 28 ngày: chấm sáng = ngày có luyện
      const set = new Set(prof.days);
      T(ctx, `🔥 ${this.streak} ngày liên tiếp · ${prof.days.filter((d) => d > this.day - 28).length}/28 ngày gần đây`, 686, 582, { size: 18, color: '#fff', align: 'left' });
      for (let i = 0; i < 28; i++) {
        const d = this.day - 27 + i;
        ctx.fillStyle = set.has(d) ? COL.mint : 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(696 + i * 19.5, 614, 7, 0, 7); ctx.fill();
      }
      T(ctx, `📝 Bộ từ của tôi: ${(prof.mine || []).length} từ  ·  Enter: quay lại chọn chế độ`, 640, 684, { size: 20, color: (this.t * 2) % 2 < 1.4 ? '#fff' : COL.sub });
    }
    drawChart(ctx, x, y, w, h, days) {
      if (!days.length) { T(ctx, 'Chưa có dữ liệu — chơi Kiểm Tra Tốc Độ, Đua Xe', x + w / 2, y + h / 2 - 12, { size: 18, color: COL.sub }); T(ctx, 'hoặc Bắn Thiên Thạch để có biểu đồ', x + w / 2, y + h / 2 + 14, { size: 18, color: COL.sub }); return; }
      const n = 14, top = Math.max(20, Math.ceil(Math.max(...days.map((d) => d.best)) / 10) * 10);
      const bw = w / n;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
      for (let k = 0; k <= 4; k++) {
        const yy = y + h - h * k / 4;
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
        T(ctx, `${Math.round(top * k / 4)}`, x - 8, yy, { size: 13, color: COL.sub, align: 'right' });
      }
      const pts = [];
      for (let i = 0; i < n; i++) {
        const d = this.day - n + 1 + i, rec = days.find((a) => a.d === d), cx = x + bw * i + bw / 2;
        if (i % 2 === 1 || i === n - 1) {
          const dt = new Date(d * 864e5);
          T(ctx, `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`, cx, y + h + 14, { size: 12, color: COL.sub });
        }
        if (!rec) continue;
        const ah = h * rec.avg / top;
        Draw.rr(ctx, cx - bw * 0.3, y + h - ah, bw * 0.6, Math.max(2, ah), 4); ctx.fillStyle = 'rgba(111,211,255,0.55)'; ctx.fill();
        pts.push([cx, y + h - h * rec.best / top, rec]);
      }
      ctx.strokeStyle = COL.accent; ctx.lineWidth = 3; ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
      for (const [px, py, rec] of pts) {
        ctx.fillStyle = COL.accent; ctx.beginPath(); ctx.arc(px, py, 5, 0, 7); ctx.fill();
        T(ctx, `${rec.best}`, px, py - 14, { size: 13, color: COL.accent });
      }

    }
    drawIme(ctx) {
      ctx.globalAlpha = Math.min(1, this.ime);
      Draw.rr(ctx, 190, 300, 900, 120, 20); ctx.fillStyle = 'rgba(200,30,60,0.95)'; ctx.fill();
      T(ctx, '⚠️ Đang bật bộ gõ tiếng Việt (Unikey / EVKey)', 640, 350, { size: 32, color: '#fff' });
      T(ctx, 'Tắt đi (Ctrl+Shift, hoặc chuyển sang chế độ E) rồi gõ tiếp — phím vừa rồi không tính lỗi', 640, 392, { size: 21, color: '#ffe' });
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- tiện ích ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  /** độ yếu từng phím cho bản đồ: tỉ lệ sai, thời gian trung bình, điểm 0 (tốt) … 1 (yếu) */
  function heatOf(keys) {
    const out = {}, wk = C.weakness(keys);
    for (const k in keys) {
      const s = keys[k];
      if (!s || s.n < 5) continue;
      const ok = Math.max(1, s.n - s.err);
      out[k] = { err: s.err / s.n, ms: s.ms / ok, score: Math.min(1, (wk[k] || 0) / 1.2) };
    }
    return out;
  }
  function heatColor(v) {
    // xanh bạc hà → vàng → đỏ
    const a = [93, 255, 176], b = [255, 210, 63], c = [255, 93, 115];
    const [p, q, t] = v < 0.5 ? [a, b, v / 0.5] : [b, c, (v - 0.5) / 0.5];
    return `rgb(${p.map((x, i) => Math.round(x + (q[i] - x) * t)).join(',')})`;
  }
  /** chữ căn giữa theo chiều dọc, không viền (font mặc định Baloo 2, hoặc o.font) */
  function T(ctx, s, x, y, o = {}) {
    ctx.font = `${o.weight || (o.font ? 400 : 700)} ${o.size || 24}px ${o.font || UI}`;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(s, x, y);
    ctx.textBaseline = 'alphabetic';
  }
  function panel(ctx, x, y, w, h, fill = COL.card) {
    Draw.rr(ctx, x, y, w, h, 22); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = COL.line; ctx.stroke();
  }
  function chip(ctx, x, y, s, bg, fg, align = 'left') {
    ctx.font = `700 18px ${UI}`;
    const w = ctx.measureText(s).width + 28, xx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    Draw.rr(ctx, xx, y, w, 32, 16); ctx.fillStyle = bg; ctx.fill();
    T(ctx, s, xx + w / 2, y + 16, { size: 18, color: fg, weight: 700 });
  }
  function bigStat(ctx, x, y, v, label, color, size = 54) {
    T(ctx, v, x, y, { size, color });
    T(ctx, label, x, y + 26 + (size - 54) * 0.35, { size: 18, color: COL.sub });
  }
  function fit(ctx, s, maxW, size, font) {
    s = String(s || '');
    ctx.font = `${font ? 400 : 700} ${size}px ${font || UI}`;
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function wrapText(ctx, s, cx, y, maxW, lh, maxLines, o) {
    ctx.font = `${o.weight || (o.font ? 400 : 700)} ${o.size}px ${o.font || UI}`;
    const words = String(s).split(' '), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    const ls = lines.slice(0, maxLines), y0 = y - (ls.length - 1) * lh / 2;
    ls.forEach((l, i) => T(ctx, l, cx, y0 + i * lh, o));
    return ls.length;
  }

  const LEVEL_ITEMS = [{ id: 'rand', name: 'Ngẫu nhiên', icon: '🎲', desc: 'Lấy từ ngẫu nhiên ở mọi mức A1–C2' }]
    .concat(C.LEVELS.map((l, i) => ({ id: l, name: l, icon: ['🌱', '🌿', '🌳', '🏔️', '🚀', '👑'][i],
      desc: ['Sơ cấp', 'Sơ cấp trên', 'Trung cấp', 'Trung cấp trên', 'Cao cấp', 'Thành thạo'][i] + ` (${BANK.all.filter((e) => e.lv === i).length} từ)` })))
    .concat([{ id: 'mine', name: 'Của tôi', icon: '📝', desc: 'Bộ từ của tôi: dán danh sách từ đang học (mỗi dòng "word - nghĩa"), sửa bằng F2 lúc chơi' }]);

  const DEF = {
    id: 'typing', name: 'Gõ Chữ Tiếng Anh', emoji: '⌨️', cat: 'brain', noFast: true,
    tagline: 'Luyện gõ 10 ngón và học từ vựng tiếng Anh theo trình độ A1–C2: thẻ từ, bắn thiên thạch, đua xe. Lưu tiến độ theo tên.',
    how: 'Gõ chữ trên bàn phím; Space sang từ sau, Backspace để sửa. Tắt Unikey/EVKey trước khi chơi. Tiến độ (từ đã thuộc, kỷ lục WPM, chữ đã mở) lưu theo tên người chơi ở sảnh.',
    controls: { move: 'Gõ trên bàn phím' },
    typing: true,
    minPlayers: 1, maxPlayers: 1, rawBot: true,
    modes: [
      { id: 'speed', name: 'Kiểm Tra Tốc Độ', icon: '⏱️', desc: 'Gõ càng nhiều từ đúng càng tốt trước khi hết giờ — ra WPM, độ chính xác và từ gõ sai kèm nghĩa.' },
      { id: 'finger', name: 'Luyện Ngón', icon: '🖐️', desc: 'Bàn phím tô màu theo ngón tay; bắt đầu từ hàng phím cơ sở, đạt 20 WPM và 95% thì mở thêm chữ mới. Từ chứa phím bạn hay sai được ra nhiều hơn.' },
      { id: 'cards', name: 'Thẻ Từ', icon: '📚', desc: 'Đề là nghĩa tiếng Việt, gõ từ tiếng Anh rồi Enter. Sai thì gõ lại 3 lần. Từ hay quên được ôn lại sớm (hộp Leitner).' },
      { id: 'stats', name: 'Tiến Độ', icon: '📈', desc: 'Bản đồ phím yếu, biểu đồ WPM theo ngày, số từ theo từng hộp Leitner, kỷ lục và chuỗi ngày luyện.',
        how: 'Xem tiến độ của người chơi đang chọn (theo tên ở sảnh). Enter để quay lại chọn chế độ.' },
    ],
    options: [{ id: 'level', label: 'Mức từ', items: LEVEL_ITEMS }],
    create: (api) => new Typing(api),
  };
  Party.register(DEF);

  /** API cho các file chế độ thêm (typing_meteor.js, typing_race.js) — nạp SAU file này, TRƯỚC app.js */
  window.TypingGame = {
    C, BANK, SENTS, COL, FCOL, MONO, UI, store, T, panel, chip, bigStat, fit, wrapText,
    /** gắn chế độ: mode = { id, name, icon, desc, how? }, impl = { name, init?, setup, key, update, bot, draw, bg?, ownBlob?,
        end, drawSum, sumUpdate?, results } — các hàm chạy với this = instance Typing. Chế độ mới đứng trước Tiến Độ. */
    addMode(mode, impl) {
      EXTRA[mode.id] = impl;
      const at = DEF.modes.findIndex((m) => m.id === 'stats');
      DEF.modes.splice(at < 0 ? DEF.modes.length : at, 0, mode);
    },
  };
})();

// Jigsaw Puzzle — ghép hình 1 người (tab Trí tuệ). Lõi cắt mảnh / hút dính: jigsaw_core.js (test: node tools/jigsaw-test.js); tranh: jigsaw_art.js.
// Chế độ: relax = Thư giãn (lưu ván để chơi tiếp; ảnh mờ trong khung mặc định TẮT — chủ project 15/11: tăng độ khó) · time = Thi giờ (đếm giờ từ mảnh đầu, kỷ lục theo tranh × số mảnh × xoay).
// Điều khiển: chuột (kéo thả, chuột phải / lăn chuột xoay) hoặc con trỏ bàn phím / tay cầm (Đánh nhặt-thả, Nhảy: tới mảnh kế / xoay / giữ xem ảnh).
// Phím riêng đọc bằng keydown (Space xem ảnh, G gợi ý, R xoay, Enter/M ở bảng tổng kết). Máy chỉ tự ghép cho smoke test và ảnh thẻ.
(() => {
  'use strict';
  const JC = window.JigsawCore, ART = window.JigsawArt;
  if (!JC || !ART) return;
  const UI = '"Baloo 2", system-ui, sans-serif';
  const HUD_H = 56, FW = 720, FH = 405, FRX = 280, FRY = Math.round(HUD_H + (720 - HUD_H - FH) / 2);
  const RES = 2;                              // vẽ sẵn mảnh ở độ phân giải ×2 cho nét khi phóng to cửa sổ
  const SNAP_MOUSE = 16, SNAP_KEY = 26;       // sai lệch tối đa để hút dính (px)
  const CUR_V0 = 240, CUR_VMAX = 980, CUR_ACC = 1500;   // con trỏ phím: tốc độ đầu, tối đa, gia tốc
  const TAP = 0.32;                           // giữ Nhảy lâu hơn = xem ảnh
  const HINT_T = 4, HINT_PEN = 15;            // gợi ý sáng trong 4 giây rồi tự tắt; Thi giờ cộng 15 giây
  const ROT_T = 0.16;                         // thời gian xoay 90°
  const BOT_V = 1500;                         // tốc độ con trỏ của máy
  const MODE_NAME = { relax: 'Thư giãn', time: 'Thi giờ', daily: 'Bức mỗi ngày' };
  const DAILY_N = 48;                         // Bức mỗi ngày: 48 mảnh, không xoay, tranh + cách cắt theo ngày
  const TIDY_T = 0.4;                         // thời gian trượt khi Xếp gọn
  const MAX_IMG = 11;                         // số ảnh của bạn tối đa (vừa 3 hàng trong bộ sưu tập)
  const IMG_W = 1440, IMG_H = 810;            // ảnh của bạn lưu ở 16:9 (cắt giữa)
  const store = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const KEY = 'tronparty.jigsaw';
  function loadStore() { try { return JSON.parse(store.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function saveStore(d) { try { store.setItem(KEY, JSON.stringify(d)); } catch (e) { /* bỏ qua */ } }
  function fmt(s) { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; }
  /** ngày theo giờ máy: 'YYYY-MM-DD' (lệch d ngày) */
  function dayKey(d = 0) { const t = new Date(); t.setDate(t.getDate() + d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }
  function hashStr(str) { let h = 2166136261; for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------- Ảnh của bạn: lưu trong IndexedDB (dự phòng localStorage) ---------- */
  const UIMG = (() => {
    const DB = 'tronparty-jigsaw', ST = 'img', LS = 'tronparty.jigsaw.img';
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      try {
        const rq = indexedDB.open(DB, 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore(ST, { keyPath: 'id' });
        rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
      } catch (e) { rej(e); }
    }));
    const tx = (mode, fn) => open().then((db) => new Promise((res, rej) => {
      const t = db.transaction(ST, mode), r = fn(t.objectStore(ST));
      t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
    const lsGet = () => { try { return JSON.parse(store.getItem(LS)) || []; } catch (e) { return []; } };
    const lsSet = (a) => { try { store.setItem(LS, JSON.stringify(a)); return true; } catch (e) { return false; } };
    return {
      list: () => tx('readonly', (o) => o.getAll()).then((a) => (a || []).sort((x, y) => x.t - y.t)).catch(() => lsGet()),
      get: (id) => tx('readonly', (o) => o.get(id)).catch(() => lsGet().find((x) => x.id === id)),
      put: (rec) => tx('readwrite', (o) => o.put(rec)).catch(() => {
        const a = lsGet().filter((x) => x.id !== rec.id); a.push(rec);
        if (!lsSet(a)) throw new Error('đầy bộ nhớ');
      }),
      del: (id) => tx('readwrite', (o) => o.delete(id)).catch(() => lsSet(lsGet().filter((x) => x.id !== id))),
    };
  })();
  const USER_CV = new Map();                  // id → canvas đã vẽ sẵn ở cỡ khung ×RES
  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
  /** vẽ ảnh vào canvas w×h kiểu "cover" (cắt giữa cho đủ khung) */
  function coverCanvas(im, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = Math.max(w / iw, h / ih);
    const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high';
    c.drawImage(im, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k);
    return cv;
  }
  /** File ảnh → bản ghi { id, name, t, data (JPEG 1440×810), thumb (JPEG 240×135) } */
  function fileToRecord(file) {
    const url = URL.createObjectURL(file);
    return loadImg(url).then((im) => {
      const big = coverCanvas(im, IMG_W, IMG_H), th = coverCanvas(im, 240, 135);
      URL.revokeObjectURL(url);
      const name = (file.name || 'Ảnh').replace(/\.[^.]+$/, '').slice(0, 28);
      return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, t: Date.now(), data: big.toDataURL('image/jpeg', 0.86), thumb: th.toDataURL('image/jpeg', 0.8) };
    }, (e) => { URL.revokeObjectURL(url); throw e; });
  }
  let FILE_IN = null;                         // <input type=file> ẩn, tạo một lần

  // canvas phụ chỉ để hỏi isPointInPath (ma trận đơn vị)
  let HIT = null;
  const hitCtx = () => HIT || (HIT = document.createElement('canvas').getContext('2d'));

  let ACTIVE = null;
  const live = (g) => g && ACTIVE === g && typeof App !== 'undefined' && App.inst === g;
  addEventListener('keydown', (e) => {
    const g = ACTIVE;
    if (!live(g) || App.state !== 'play') return;
    if (e.target && e.target !== FILE_IN && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (g.onKey(e, true)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { const g = ACTIVE; if (live(g)) g.onKey(e, false); });
  addEventListener('wheel', (e) => {
    const g = ACTIVE;
    if (!live(g) || App.state !== 'play' || !App.cv || e.target !== App.cv) return;
    e.preventDefault();
    g.rotateAtCursor(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  // rời game thì trả con trỏ chuột về mặc định
  setInterval(() => {
    if (ACTIVE && !(typeof App !== 'undefined' && App.inst === ACTIVE && ['play', 'paused', 'ending', 'countdown'].includes(App.state))) {
      if (App && App.cv) App.cv.style.cursor = '';
      ACTIVE = null;
    }
  }, 250);

  class Jigsaw {
    constructor(api) {
      this.api = api;
      this.ownHelp = true; this.ownEndBanner = true;
      this.mode = ['time', 'daily'].includes(api.mode) ? api.mode : 'relax';
      this.p = api.players[0];
      this.bot = !!this.p.bot;
      this.finished = false;
      this.t = 0; this.began = false;
      this.cur = { x: 640, y: 640 }; this.v = 0; this.kb = !!(this.p.src && this.p.src.type !== 'mouse');
      this.hold = null; this.jumpT = -1; this.spaceDown = false; this.peekKey = false;
      this.rotAnim = null; this.hint = null; this.flash = [];
      this.btns = []; this.btnHover = null; this.confirmShuffle = 0;
      this.msg = null;
      this.phase = 'play';
      ACTIVE = this;
    }
    /** số mảnh của ván (đọc tuỳ chọn mỗi lần — app không tạo lại instance khi đổi tuỳ chọn) */
    get npieces() {
      if (this.mode === 'daily') return DAILY_N;
      const o = this.api.opts && this.api.opts.pieces;
      if (o && JC.GRIDS[o]) return +o;
      const c = this.api.count(48);
      return c < 36 ? 24 : c < 72 ? 48 : 96;
    }
    rotOn() { return !!(this.api.opts && this.api.opts.rotate === 'on'); }
    /** cấu hình hiện tại: màn giới thiệu vẽ game làm nền nên ván được dựng sớm — đổi tuỳ chọn ở đó thì dựng lại */
    cfgKey() { return [this.npieces, this.rotOn(), this.api.variant, this.api.opts && this.api.opts.ghostImg].join('|'); }

    /* ---------- dựng ván ---------- */
    begin() {
      this.began = true; this.cfg = this.cfgKey();
      ACTIVE = this;
      this.tok = (this.tok || 0) + 1;            // việc nạp ảnh bất đồng bộ của lần begin cũ thì bỏ qua
      this.daily = this.mode === 'daily';
      this.n = this.npieces; this.rotate = this.daily ? false : this.rotOn();
      this.ghost = this.mode === 'relax' && !!(this.api.opts && this.api.opts.ghostImg === 'on');
      this.userName = null; this.tidyAnim = null;
      let v = this.api.variant || 'random';
      if (this.bot && v === 'mine') v = 'random';
      const st = loadStore();
      if (this.daily) { this.beginDaily(st); return; }
      const sv = st.save;
      const isUser = sv && String(sv.art).startsWith('u:');
      // Thư giãn: có ván dở cùng số mảnh + kiểu xoay (+ cùng tranh / cùng loại "Ảnh của bạn") thì chơi tiếp
      if (this.mode === 'relax' && !this.bot && sv && sv.n === this.n && !!sv.rot === this.rotate
        && (isUser ? (v === 'mine' || v === 'random') : (v === 'random' || sv.art === v) && ART.list.some((a) => a.id === sv.art))) {
        if (isUser) {
          const tok = this.tok;
          this.phase = 'loading';
          this.loadUser(sv.art.slice(2)).then((cv) => {
            if (tok !== this.tok) return;
            if (!cv) { this.openGallery(); return; }
            this.build(sv.art, sv.seed, cv);
            if (this.bd.restore(sv.g)) this.resumeFrom(sv); else this.shuffle();
          });
          return;
        }
        this.build(sv.art, sv.seed);
        if (this.bd.restore(sv.g)) { this.resumeFrom(sv); return; }
      }
      if (v === 'mine') { this.openGallery(); return; }
      const art = v === 'random' || !ART.list.some((a) => a.id === v) ? U.pick(ART.list).id : v;
      this.build(art, (Math.random() * 2 ** 31) | 0);
      this.shuffle();
    }
    resumeFrom(sv) {
      this.t = +sv.t || 0; this.hints = sv.hints | 0; this.peeks = sv.peeks | 0; this.penalty = +sv.pen || 0; this.started = true;
      this.say(this.daily ? 'Chơi tiếp bức hôm nay' : 'Chơi tiếp ván trước', '#5dffb0');
      this.camHome();
    }
    /** Bức mỗi ngày: tranh + cách cắt theo ngày (ai chơi cũng cùng một bức trong ngày) */
    beginDaily(st) {
      const d = dayKey(), h = hashStr('jigsaw-' + d);
      this.day = d;
      this.build(ART.list[h % ART.list.length].id, h & 0x7fffffff);
      const ds = st.dsave;
      if (!this.bot && ds && ds.date === d && this.bd.restore(ds.g)) { this.resumeFrom(ds); return; }
      this.shuffle();
      const done = st.daily && st.daily.days && st.daily.days[d];
      if (done && !this.bot) this.say(`Hôm nay bạn đã ghép xong (${fmt(done)}) — thử nhanh hơn?`, '#ffd23f');
    }
    build(art, seed, cv) {
      this.art = art; this.seed = seed;
      this.P = JC.makePuzzle(this.n, FW, FH, seed);
      this.bd = new JC.Board(this.P, FRX, FRY);
      this.hints = 0; this.peeks = 0; this.t = 0; this.started = false; this.penalty = 0;
      this.hold = null; this.hint = null; this.phase = 'play'; this.tidyAnim = null;
      this.bigArt = cv || (String(art).startsWith('u:') ? this.bigArt : ART.canvas(art, FW * RES, FH * RES));
      this.prerender();
    }
    artName() { return String(this.art).startsWith('u:') ? `🖼️ ${this.userName || 'Ảnh của bạn'}` : `🧩 ${ART.name(this.art)}`; }
    /** nạp ảnh của bạn → canvas cỡ khung (null nếu không còn) */
    loadUser(id) {
      return UIMG.get(id).then((rec) => {
        if (!rec || !rec.data) return null;
        this.userName = rec.name;
        if (USER_CV.has(id)) return USER_CV.get(id);
        return loadImg(rec.data).then((im) => { const cv = coverCanvas(im, FW * RES, FH * RES); USER_CV.set(id, cv); return cv; });
      }).catch(() => null);
    }

    /* ---------- bộ sưu tập Ảnh của bạn ---------- */
    openGallery() {
      this.phase = 'gallery'; this.P = null; this.bd = null; this.hold = null;
      this.gal = this.gal || { items: null, sel: 0, del: null, prevMx: 0, prevMy: 0 };
      this.gal.items = null;
      const tok = this.tok;
      UIMG.list().then((a) => {
        if (tok !== this.tok) return;
        this.gal.items = a.map((r) => { const it = { id: r.id, name: r.name, img: new Image() }; it.img.src = r.thumb || r.data; return it; });
        this.gal.sel = Math.min(this.gal.sel, this.gal.items.length);
      });
    }
    galCount() { return 1 + (this.gal && this.gal.items ? this.gal.items.length : 0); }
    galChoose(k) {
      const g = this.gal;
      if (k === 0) { this.pickFiles(); return; }   // ô "Thêm ảnh" dùng được cả khi danh sách chưa tải xong
      if (!g || !g.items) return;
      const it = g.items[k - 1];
      if (!it) return;
      const tok = this.tok;
      this.phase = 'loading';
      this.loadUser(it.id).then((cv) => {
        if (tok !== this.tok) return;
        if (!cv) { this.say('Không mở được ảnh này', '#ff5d73'); this.openGallery(); return; }
        this.build('u:' + it.id, (Math.random() * 2 ** 31) | 0, cv);
        this.shuffle();
        this.say(`Bắt đầu ghép: ${it.name || 'ảnh của bạn'}`, '#5dffb0');
        Sfx.play('go');
      });
    }
    galDelete(k) {
      const g = this.gal, it = g && g.items && g.items[k - 1];
      if (!it) return;
      if (g.del !== it.id) { g.del = it.id; this.say('Bấm ✕ lần nữa để xoá ảnh này', '#ffd23f'); return; }
      g.del = null;
      USER_CV.delete(it.id);
      const st = loadStore();
      if (st.save && st.save.art === 'u:' + it.id) { delete st.save; saveStore(st); }
      UIMG.del(it.id).then(() => this.openGallery());
      this.say('Đã xoá ảnh', '#b8d6dd');
    }
    /** mở hộp chọn file của máy (phải gọi trong lúc bấm chuột / phím) */
    pickFiles() {
      if (this.gal && this.gal.items && this.gal.items.length >= MAX_IMG) { this.say(`Tối đa ${MAX_IMG} ảnh — xoá bớt ảnh cũ trước`, '#ff8a5c'); return; }
      if (!FILE_IN) {
        FILE_IN = document.createElement('input');
        FILE_IN.type = 'file'; FILE_IN.accept = 'image/*'; FILE_IN.multiple = true; FILE_IN.style.display = 'none';
        document.body.appendChild(FILE_IN);
      }
      FILE_IN.value = '';
      FILE_IN.onchange = () => { FILE_IN.blur(); this.addFiles([...FILE_IN.files]); };
      FILE_IN.click();
      // ô file ẩn không được giữ focus — không thì phím (Input của app bỏ qua phím khi đang ở ô nhập) sẽ "chết"
      setTimeout(() => { try { FILE_IN.blur(); } catch (e) { /* bỏ qua */ } }, 0);
    }
    addFiles(files) {
      const room = MAX_IMG - (this.gal && this.gal.items ? this.gal.items.length : 0);
      const list = files.filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)).slice(0, Math.max(0, room));
      if (!list.length) { this.say('Không có ảnh nào dùng được', '#ff8a5c'); return; }
      this.say(`Đang thêm ${list.length} ảnh…`, '#9fe8ff');
      let added = [];
      const next = (k) => {
        if (k >= list.length) {
          if (!added.length) { this.say('Không đọc được ảnh (thử ảnh JPG / PNG)', '#ff5d73'); return; }
          if (this.phase !== 'gallery') return;
          this.openGallery();
          // thêm đúng 1 ảnh thì vào ghép luôn
          if (added.length === 1) { const id = added[0]; const wait = () => { if (this.gal.items) { const k2 = this.gal.items.findIndex((x) => x.id === id); if (k2 >= 0) this.galChoose(k2 + 1); } else setTimeout(wait, 50); }; wait(); }
          else this.say(`Đã thêm ${added.length} ảnh`, '#5dffb0');
          return;
        }
        fileToRecord(list[k]).then((rec) => UIMG.put(rec).then(() => added.push(rec.id)))
          .catch(() => this.say('Một ảnh không lưu được (ảnh hỏng hoặc hết chỗ)', '#ff8a5c'))
          .then(() => next(k + 1));
      };
      next(0);
    }
    galInput(inp) {
      const g = this.gal, n = this.galCount();
      if (!g) return;
      const mx = Math.abs(inp.mx || 0) > 0.5 ? Math.sign(inp.mx) : 0, my = Math.abs(inp.my || 0) > 0.5 ? Math.sign(inp.my) : 0;
      if (mx && mx !== g.prevMx) { g.sel = (g.sel + mx + n) % n; this.kb = true; Sfx.play('move', 0.03); }
      if (my && my !== g.prevMy) { g.sel = U.clamp(g.sel + my * 4, 0, n - 1); this.kb = true; Sfx.play('move', 0.03); }
      g.prevMx = mx; g.prevMy = my;
      if (inp.actP) { this.kb = true; this.galChoose(g.sel); }
      else if (inp.jumpP) this.leave('intro');
    }
    /** rải mảnh ngẫu nhiên quanh khung */
    shuffle() {
      const P = this.P, R = JC.rng(this.seed ^ 0x5f3759df);
      // chừa lề cho núm (≈ 0,3 cạnh) để mảnh không chui dưới thanh trên hay ra ngoài mép
      const pts = JC.scatter(R, P.n, { w: 1280, h: 720, top: HUD_H + 4 }, { x: FRX, y: FRY, w: FW, h: FH }, { w: P.pw, h: P.ph }, 0.35, 0.8);
      const order = U.shuffle(P.pieces.map((p) => p.i));
      this.bd = new JC.Board(P, FRX, FRY);
      order.forEach((i, k) => this.bd.place(i, pts[k][0], pts[k][1], this.rotate ? Math.floor(R() * 4) : 0));
      this.t = 0; this.started = false; this.hints = 0; this.peeks = 0; this.penalty = 0; this.hold = null;
    }
    camHome() { this.cur = { x: 640, y: FRY + FH + 40 }; }
    /** Xếp gọn: mảnh rời (chưa nối) xếp thành hàng quanh khung — góc + viền nằm sát khung, mảnh giữa ra xa; nhóm đã nối giữ nguyên */
    tidy() {
      if (this.phase !== 'play' || !this.bd) return;
      this.finishTidy();
      const P = this.P, singles = [], boxes = [];
      for (const g of this.bd.groups.values()) {
        if (g.locked || (this.hold && this.hold.id === g.id)) continue;
        if (g.m.length === 1) { singles.push(g); continue; }
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const i of g.m) { const c = this.bd.pieceCenter(i); x0 = Math.min(x0, c[0]); y0 = Math.min(y0, c[1]); x1 = Math.max(x1, c[0]); y1 = Math.max(y1, c[1]); }
        boxes.push([x0 - P.pw, y0 - P.ph, x1 + P.pw, y1 + P.ph]);
      }
      if (!singles.length) { this.say('Không còn mảnh rời để xếp', '#b8d6dd'); return; }
      const kind = (g) => P.pieces[g.m[0]].edge.filter((e) => e === 0).length;    // 2 góc · 1 viền · 0 giữa
      const rnd = new Map(singles.map((g) => [g.id, Math.random()]));             // trong cùng loại thì trộn (không lộ thứ tự đúng)
      singles.sort((a, b) => (kind(b) - kind(a)) || (rnd.get(a.id) - rnd.get(b.id)));
      const slots = JC.tidySlots(singles.length, { w: 1280, h: 720, top: HUD_H + 4 }, { x: FRX, y: FRY, w: FW, h: FH }, { w: P.pw, h: P.ph },
        (x, y) => boxes.some((b) => x > b[0] && x < b[2] && y > b[1] && y < b[3]));
      if (!slots.length) return;
      this.tidyAnim = { t: 0, list: singles.map((g, k) => {
        const sp = slots[k % slots.length], p = P.pieces[g.m[0]], v = JC.rot((p.c + 0.5) * P.pw, (p.r + 0.5) * P.ph, g.rot);
        return { id: g.id, x0: g.x, y0: g.y, x1: sp[0] - v[0], y1: sp[1] - v[1] };
      }) };
      Sfx.play('select');
      const edges = singles.filter((g) => kind(g) > 0).length;
      this.say(edges ? `🧲 Xếp gọn: ${edges} mảnh viền nằm sát khung` : '🧲 Đã xếp gọn', '#9fe8ff');
    }
    updateTidy(dt) {
      const a = this.tidyAnim;
      if (!a) return;
      a.t += dt;
      const k = Math.min(1, a.t / TIDY_T), e = 1 - (1 - k) ** 3;
      for (const it of a.list) { const g = this.bd.group(it.id); if (g && !g.locked && !(this.hold && this.hold.id === g.id)) { g.x = it.x0 + (it.x1 - it.x0) * e; g.y = it.y0 + (it.y1 - it.y0) * e; } }
      if (k >= 1) { this.tidyAnim = null; this.saveProgress(true); }
    }
    finishTidy() { if (this.tidyAnim) { this.tidyAnim.t = TIDY_T; this.updateTidy(0); } }
    /** cắt ảnh thành từng mảnh (canvas riêng, có viền nổi) */
    prerender() {
      const P = this.P, pad = P.pad;
      for (const p of P.pieces) {
        const path = new Path2D();
        for (const k of p.cmds) {
          if (k[0] === 'M') path.moveTo(k[1], k[2]);
          else if (k[0] === 'L') path.lineTo(k[1], k[2]);
          else path.bezierCurveTo(k[1], k[2], k[3], k[4], k[5], k[6]);
        }
        path.closePath();
        p.path = path;
        const cv = document.createElement('canvas');
        cv.width = Math.ceil((P.pw + pad * 2) * RES); cv.height = Math.ceil((P.ph + pad * 2) * RES);
        const c = cv.getContext('2d');
        c.scale(RES, RES); c.translate(pad, pad);
        c.save(); c.clip(path);
        c.drawImage(this.bigArt, -p.c * P.pw, -p.r * P.ph, FW, FH);
        // viền nổi: sáng ở trên-trái, tối ở dưới-phải
        c.lineWidth = 3;
        c.save(); c.translate(1.4, 1.4); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.stroke(path); c.restore();
        c.save(); c.translate(-1.4, -1.4); c.strokeStyle = 'rgba(0,0,0,0.38)'; c.stroke(path); c.restore();
        c.restore();
        c.lineWidth = 1; c.strokeStyle = 'rgba(30,20,40,0.45)'; c.stroke(path);
        p.cv = cv;
      }
    }

    /* ---------- thao tác ---------- */
    /** nhóm + mảnh dưới điểm (x, y), bỏ qua nhóm đã khoá */
    pickAt(x, y) {
      if (!this.bd || this.phase !== 'play') return null;
      const P = this.P, ctx = hitCtx(), list = this.bd.order();
      for (let k = list.length - 1; k >= 0; k--) {
        const g = list[k];
        if (g.locked) continue;
        const s = this.bd.toSol(g, x, y);
        for (const i of g.m) {
          const p = P.pieces[i], lx = s[0] - p.c * P.pw, ly = s[1] - p.r * P.ph;
          if (lx < -P.pad || ly < -P.pad || lx > P.pw + P.pad || ly > P.ph + P.pad) continue;
          if (ctx.isPointInPath(p.path, lx, ly)) return { g, i };
        }
      }
      return null;
    }
    grab(x, y, via) {
      if (this.phase !== 'play') return false;
      this.finishTidy();
      let hit = this.pickAt(x, y);
      if (!hit && via === 'key') {
        // bàn phím: nhặt mảnh rời gần nhất trong 34 px
        let best = null, bd = 34;
        for (const g of this.bd.groups.values()) {
          if (g.locked) continue;
          for (const i of g.m) { const c = this.bd.pieceCenter(i), d = Math.hypot(c[0] - x, c[1] - y); if (d < bd) { bd = d; best = { g, i }; } }
        }
        hit = best;
      }
      if (!hit) return false;
      this.bd.raise(hit.g);
      this.hold = { id: hit.g.id, dx: x - hit.g.x, dy: y - hit.g.y, via };
      if (!this.started) this.started = true;
      if (this.hint && this.hint.gid === hit.g.id) this.hint.t = Math.min(this.hint.t, 1.2);
      Sfx.tone(520, 0.05, 'triangle', 0.05);
      return true;
    }
    heldGroup() { return this.hold ? this.bd.group(this.hold.id) : null; }
    followCursor() {
      const g = this.heldGroup();
      if (!g) { this.hold = null; return; }
      const cy = Math.max(this.cur.y, HUD_H + 8);
      g.x = this.cur.x - this.hold.dx; g.y = cy - this.hold.dy;
    }
    release() {
      const g = this.heldGroup();
      const via = this.hold && this.hold.via;
      this.hold = null;
      if (!g) return;
      const r = this.bd.drop(g, via === 'mouse' ? SNAP_MOUSE : SNAP_KEY);
      const ng = this.bd.group(r.gid);
      if (r.locked) {
        Sfx.tone(784, 0.08, 'triangle', 0.06); setTimeout(() => Sfx.tone(1046, 0.12, 'triangle', 0.05), 70);
        this.flashGroup(ng, '#ffe066');
      } else if (r.joins) {
        Sfx.play('place'); this.flashGroup(ng, '#ffffff');
      } else Sfx.tone(330, 0.04, 'sine', 0.035);
      if (r.joins || r.locked) this.api.parts.burst(this.cur.x, this.cur.y, ['#fff', '#ffe066', this.p.color.light], r.locked ? 14 : 8, 160, 0.5, 4);
      if (this.hint && !this.bd.group(this.hint.gid)) this.hint = null;
      if (this.bd.done()) this.complete();
      else this.saveProgress(true);
    }
    flashGroup(g, col) { if (g) this.flash.push({ id: g.id, t: 0, col }); }
    /** xoay nhóm đang cầm (hoặc nhóm dưới con trỏ) 90° */
    rotateAtCursor(dir) {
      if (!this.rotate || this.phase !== 'play') return;
      let g = this.heldGroup();
      if (!g) { const h = this.pickAt(this.cur.x, this.cur.y); g = h && h.g; }
      if (!g || g.locked) return;
      const px = this.cur.x, py = this.hold ? Math.max(this.cur.y, HUD_H + 8) : this.cur.y;
      this.bd.rotate(g, px, py, dir);
      if (this.hold) { this.hold.dx = px - g.x; this.hold.dy = py - g.y; }
      this.rotAnim = { id: g.id, px, py, a: -dir * Math.PI / 2, t: 0 };
      Sfx.tone(440 + dir * 60, 0.04, 'triangle', 0.04);
    }
    /** con trỏ nhảy tới mảnh rời kế tiếp (theo thứ tự trái → phải, trên → dưới) */
    jumpNext() {
      const cs = [];
      for (const g of this.bd.groups.values()) if (!g.locked) { const c = this.bd.pieceCenter(g.m[0]); cs.push(c); }
      if (!cs.length) return;
      cs.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
      const cur = this.cur, key = (c) => (c[1] - cur.y) * 4000 + (c[0] - cur.x);
      const nxt = cs.find((c) => key(c) > 1) || cs[0];
      this.cur = { x: nxt[0], y: nxt[1] };
      Sfx.play('move', 0.03);
    }
    useHint() {
      if (this.phase !== 'play') return;
      // đang có gợi ý: bấm lần nữa = tắt luôn (không bật lại, không tính thêm lượt / giây phạt)
      if (this.hint) { this.hint = null; Sfx.tone(300, 0.05, 'sine', 0.04); return; }
      const loose = [...this.bd.groups.values()].filter((g) => !g.locked);
      if (!loose.length) return;
      // ưu tiên mảnh kề phần đã ghép vào khung, rồi tới mảnh viền
      const lockedSet = new Set();
      for (const g of this.bd.groups.values()) if (g.locked) for (const i of g.m) lockedSet.add(i);
      const score = (g) => (g.m.some((i) => JC.neighbors(this.P, i).some((j) => lockedSet.has(j))) ? 0 : g.m.some((i) => JC.isEdge(this.P, i)) ? 1 : 2) * 1000 - g.m.length;
      loose.sort((a, b) => score(a) - score(b));
      const pick = loose[0];
      this.hint = { gid: pick.id, t: HINT_T };
      this.hints++;
      if ((this.mode === 'time' || this.daily) && this.started) { this.penalty += HINT_PEN; this.say(`💡 +${HINT_PEN} giây`, '#ffd23f'); }
      Sfx.play('select');
    }
    peek(on) {
      if (on && !this.peekOn) this.peeks++;
      this.peekOn = on;
    }
    say(s, c) { this.msg = { s, c, t: 0 }; }

    /* ---------- vào ra ---------- */
    onKey(e, down) {
      const k = e.key;
      if (k === ' ' || e.code === 'Space') { this.spaceDown = down; if (this.phase === 'play') this.peek(down || this.peekKey); return true; }
      if (!down) return false;
      if (this.phase === 'gallery') {
        const g = this.gal;
        if (k === 'Enter' && g) { this.galChoose(g.sel); return true; }
        if ((k === 'Delete' || k === 'Backspace') && g && g.sel > 0) { this.galDelete(g.sel); return true; }
        if (k === 'm' || k === 'M') { this.leave('intro'); return true; }
        return false;
      }
      if (this.phase === 'sum') {
        if (k === 'Enter') { this.leave('replay'); return true; }
        if (k === 'm' || k === 'M') { this.leave('intro'); return true; }
        return false;
      }
      if (k === 'g' || k === 'G') { if (!e.repeat) this.useHint(); return true; }   // giữ phím G không bật/tắt liên tục
      if (k === 'r' || k === 'R') { this.rotateAtCursor(e.shiftKey ? -1 : 1); return true; }
      if (k === 'x' || k === 'X') { if (!e.repeat) this.tidy(); return true; }
      return false;
    }
    onPointer(x, y, type, e) {
      if (!this.began || this.bot) return;
      if (type !== 'up') { this.cur = { x, y }; this.kb = false; }
      const b = this.btnAt(x, y);
      this.btnHover = b ? b.id : null;
      if (b && this.gal && /^tile:/.test(b.id)) this.gal.sel = +b.id.slice(5);
      if (type === 'down') {
        if (this.peekOn && !this.spaceDown) { this.peek(false); this.peekKey = false; return; }
        if (b) { this.pressBtn(b.id); return; }
        if (this.phase !== 'play') return;
        this.finishTidy();
        if (e && e.button === 2) { this.rotateAtCursor(1); return; }
        if (e && e.button !== 0) return;
        if (this.hold) { if (this.hold.via !== 'mouse') this.release(); return; }
        this.grab(x, y, 'mouse');
      } else if (type === 'move') {
        if (this.hold) this.followCursor();
      } else if (type === 'up') {
        if (this.hold && this.hold.via === 'mouse') { this.followCursor(); this.release(); }
      }
    }
    pressBtn(id) {
      Sfx.play('select');
      if (id === 'peek') { this.peekKey = !this.peekKey; this.peek(this.peekKey); }
      else if (id === 'hint') this.useHint();
      else if (id === 'tidy') this.tidy();
      else if (id.startsWith('tile:')) this.galChoose(+id.slice(5));
      else if (id.startsWith('del:')) this.galDelete(+id.slice(4));
      else if (id === 'back') this.leave('intro');
      else if (id === 'shuffle') {
        if (this.confirmShuffle > 0) { this.confirmShuffle = 0; this.restart(); }
        else this.confirmShuffle = 2.5;
      } else if (id === 'again') this.leave('replay');
      else if (id === 'menu') this.leave('intro');
    }
    btnAt(x, y) { return this.btns.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null; }
    /** Xáo lại: bỏ ván dở, cắt mới */
    restart() {
      const st = loadStore(); delete st.save; saveStore(st);
      this.build(this.art, (Math.random() * 2 ** 31) | 0, this.bigArt);
      this.shuffle();
      this.say('Đã xáo bức mới', '#5dffb0');
    }
    leave(to) {
      if (!this.bot) this.exitTo = to;
      this.finished = true;
      if (App && App.cv) App.cv.style.cursor = '';
    }
    saveProgress(force) {
      if (this.bot || this.mode === 'time' || this.phase !== 'play' || !this.bd) return;
      if (!force && this.saveT > 0) return;
      this.saveT = 4;
      const st = loadStore();
      if (this.daily) st.dsave = { date: this.day, t: Math.round(this.t), hints: this.hints, peeks: this.peeks, pen: this.penalty, g: this.bd.snapshot() };
      else st.save = { art: this.art, n: this.n, rot: this.rotate ? 1 : 0, seed: this.seed, t: Math.round(this.t), hints: this.hints, peeks: this.peeks, g: this.bd.snapshot() };
      saveStore(st);
    }
    complete() {
      this.phase = 'done'; this.doneT = 0; this.hold = null; this.hint = null; this.peekOn = false;
      const total = this.t + this.penalty;
      this.total = total;
      Sfx.play('win');
      FX.shake(4);
      for (let k = 0; k < 6; k++) setTimeout(() => this.api.parts.burst(FRX + Math.random() * FW, FRY + Math.random() * FH, ['#ffe066', '#ff6b8b', '#6fd3ff', '#5dffb0', '#fff'], 24, 260, 0.9, 6), k * 140);
      if (this.bot) return;
      const st = loadStore();
      if (this.daily) {
        delete st.dsave;
        const D = st.daily = st.daily || { days: {}, streak: 0, best: 0, last: null };
        const prev = D.days[this.day];
        this.prevBest = prev || null;
        this.newBest = !prev || total < prev;
        if (this.newBest) D.days[this.day] = Math.round(total * 10) / 10;
        if (D.last !== this.day) D.streak = D.last === dayKey(-1) ? (D.streak | 0) + 1 : 1;
        D.last = this.day; D.best = Math.max(D.best | 0, D.streak);
        // chỉ giữ 60 ngày gần nhất
        const keys = Object.keys(D.days).sort();
        while (keys.length > 60) delete D.days[keys.shift()];
        st.done = (st.done | 0) + 1;
        saveStore(st);
        return;
      }
      delete st.save;
      st.best = st.best || {};
      const key = `${this.art}|${this.n}|${this.rotate ? 'r' : ''}`;
      this.bestKey = key;
      this.prevBest = st.best[key] || null;
      if (this.mode === 'time' && (!this.prevBest || total < this.prevBest)) { st.best[key] = Math.round(total * 10) / 10; this.newBest = true; }
      st.done = (st.done | 0) + 1;
      saveStore(st);
    }

    /* ---------- vòng lặp ---------- */
    update(dt, inputs) {
      if (!this.began) this.begin();
      this.flash = this.flash.filter((f) => (f.t += dt) < 0.45);
      if (this.msg && (this.msg.t += dt) > 2.4) this.msg = null;
      if (this.rotAnim && (this.rotAnim.t += dt) >= ROT_T) this.rotAnim = null;
      if (this.confirmShuffle > 0) this.confirmShuffle -= dt;
      this.saveT = (this.saveT || 0) - dt;
      if (this.finished) return;
      if (this.phase === 'gallery') { if (!this.bot) this.galInput(inputs[0] || {}); return; }
      if (this.phase === 'loading') return;
      this.updateTidy(dt);
      if (this.phase === 'done') {
        this.doneT += dt;
        if (this.bot && this.doneT > 1.2) this.finished = true;
        else if (!this.bot && this.doneT > 1.6) this.phase = 'sum';
        return;
      }
      if (this.phase === 'sum') {
        const inp = inputs[0] || {};
        if (inp.actP) this.leave('replay');
        else if (inp.jumpP) this.leave('intro');
        return;
      }
      if (this.started) this.t += dt;
      if (this.hint && (this.hint.t -= dt) <= 0) this.hint = null;
      if (this.bot) { this.botStep(dt); return; }
      this.keyInput(dt, inputs[0] || {});
      if (this.mode !== 'time' && this.saveT <= 0) this.saveProgress();
    }
    keyInput(dt, inp) {
      const mx = Math.abs(inp.mx || 0) > 0.2 ? inp.mx : 0, my = Math.abs(inp.my || 0) > 0.2 ? inp.my : 0;
      if (mx || my) {
        this.kb = true;
        this.v = Math.min(CUR_VMAX, (this.v || CUR_V0) + CUR_ACC * dt);
        // đi ngang mảnh (khi tay không) thì chậm lại cho dễ dừng
        const slow = !this.hold && this.pickAt(this.cur.x, this.cur.y) ? 0.55 : 1;
        const L = Math.hypot(mx, my) || 1, sp = this.v * slow * Math.min(1, L);
        this.cur.x = U.clamp(this.cur.x + mx / L * sp * dt, 4, 1276);
        this.cur.y = U.clamp(this.cur.y + my / L * sp * dt, HUD_H + 4, 716);
        if (this.hold) this.followCursor();
      } else this.v = 0;
      if (inp.actP) {
        this.kb = true;
        if (this.hold) this.release();
        else this.grab(this.cur.x, this.cur.y, 'key');
      }
      // Nhảy: chạm = tới mảnh kế (tay không) / xoay (đang cầm); giữ = xem ảnh
      if (inp.jumpP) this.jumpT = 0;
      if (this.jumpT >= 0) {
        if (inp.jump) {
          this.jumpT += dt;
          if (this.jumpT >= TAP && !this.hold && !this.peekKey) { this.peekKey = true; this.peek(true); }
        } else {
          if (this.jumpT < TAP) { this.kb = true; if (this.hold) this.rotateAtCursor(1); else this.jumpNext(); }
          if (this.peekKey && this.jumpT >= TAP) { this.peekKey = false; this.peek(this.spaceDown); }
          this.jumpT = -1;
        }
      }
    }
    /** máy tự ghép (smoke test, ảnh thẻ): nhặt nhóm ưu tiên kề phần đã khoá → xoay về 0 → mang vào đúng chỗ */
    botStep(dt) {
      if (this.botWait > 0) { this.botWait -= dt; return; }
      const mv = (tx, ty) => {
        const dx = tx - this.cur.x, dy = ty - this.cur.y, d = Math.hypot(dx, dy), st = BOT_V * dt;
        if (d <= st) { this.cur.x = tx; this.cur.y = ty; return true; }
        this.cur.x += dx / d * st; this.cur.y += dy / d * st; return false;
      };
      const b = this.botPlan;
      if (!b) {
        const loose = [...this.bd.groups.values()].filter((g) => !g.locked);
        if (!loose.length) return;
        const lockedSet = new Set();
        for (const g of this.bd.groups.values()) if (g.locked) for (const i of g.m) lockedSet.add(i);
        const score = (g) => (g.m.some((i) => JC.neighbors(this.P, i).some((j) => lockedSet.has(j))) ? 0 : g.m.some((i) => JC.isEdge(this.P, i)) ? 1 : 2) * 100 + Math.random() * 10;
        loose.sort((a, b2) => score(a) - score(b2));
        const g = loose[0], c = this.bd.pieceCenter(g.m[0]);
        this.botPlan = { id: g.id, ph: 'go', x: c[0], y: c[1] };
        return;
      }
      const g = this.bd.group(b.id);
      if (!g || g.locked) { this.botPlan = null; this.hold = null; return; }
      if (b.ph === 'go') {
        if (mv(b.x, b.y)) { this.bd.raise(g); this.started = true; this.hold = { id: g.id, dx: this.cur.x - g.x, dy: this.cur.y - g.y, via: 'key' }; b.ph = 'rot'; b.t = 0; }
      } else if (b.ph === 'rot') {
        if (g.rot === 0) { b.ph = 'carry'; b.x = this.cur.x + (FRX - g.x); b.y = this.cur.y + (FRY - g.y); return; }
        if ((b.t += dt) > 0.14) { b.t = 0; this.rotateAtCursor(g.rot === 3 ? 1 : -1); }
      } else if (b.ph === 'carry') {
        const done = mv(b.x, b.y);
        this.followCursor();
        if (done) { this.release(); this.botPlan = null; this.botWait = 0.12; }
      }
    }
    botInput() { return {}; }
    posOf() { return { x: this.cur.x, y: this.cur.y }; }
    results() {
      const placed = this.bd ? this.bd.lockedCount() : 0;
      const tt = this.total || this.t || 0;
      return [{ score: placed * 1000 - Math.round(tt), text: `🧩 ${placed}/${this.n || 0} mảnh · ⏱ ${fmt(tt)}${this.hints ? ` · 💡 ${this.hints}` : ''}` }];
    }

    /* ---------- vẽ ---------- */
    draw(ctx) {
      if (!this.began || (typeof App !== 'undefined' && App.state !== 'play' && App.state !== 'paused' && ['play', 'gallery'].includes(this.phase) && !this.hold && this.cfg !== this.cfgKey())) this.begin();
      ACTIVE = this;
      if (App && App.cv && App.inst === this) {
        const want = this.kb || this.bot ? 'default' : this.btnHover ? 'pointer' : this.hold ? 'grabbing' : this.pickAt(this.cur.x, this.cur.y) ? 'grab' : 'default';
        if (App.cv.style.cursor !== want) App.cv.style.cursor = want;
      }
      this.drawTable(ctx);
      if (this.phase === 'gallery' || this.phase === 'loading') { this.drawGallery(ctx); this.drawMsg(ctx); return; }
      this.drawFrame(ctx);
      if (this.phase === 'play') {
        const list = this.bd.order(), held = this.heldGroup();
        for (const g of list) if (g !== held) this.drawGroup(ctx, g, false);
        this.drawHint(ctx);
        if (held) this.drawGroup(ctx, held, true);
      } else this.drawFinal(ctx);
      for (const f of this.flash) { const g = this.bd.group(f.id); if (g) this.outlineGroup(ctx, g, f.col, 4, 1 - f.t / 0.45); }
      this.drawHud(ctx);
      if (this.phase === 'play' && !this.bot && this.t < 14 && !this.peekOn) this.drawHelp(ctx);
      if (this.peekOn) this.drawPeek(ctx);
      if (this.phase === 'sum') this.drawSummary(ctx);
      this.drawMsg(ctx);
      if ((this.kb || this.bot) && this.phase === 'play') this.drawCursor(ctx);
    }
    drawMsg(ctx) {
      if (!this.msg) return;
      const a = Math.min(1, (2.4 - this.msg.t) * 2);
      ctx.globalAlpha = a;
      Draw.text(ctx, this.msg.s, 640, FRY - 22 - Math.min(10, this.msg.t * 20), { size: 26, color: this.msg.c, sw: 6 });
      ctx.globalAlpha = 1;
    }
    /** bộ sưu tập Ảnh của bạn: ô đầu = thêm ảnh, các ô sau = ảnh đã lưu (✕ xoá) */
    drawGallery(ctx) {
      this.btns = [];
      ctx.save();
      ctx.fillStyle = 'rgba(10,20,30,0.82)'; ctx.fillRect(0, 0, 1280, HUD_H);
      txt(ctx, '🖼️ Ảnh của bạn', 18, 21, 20, '#fff', 'left', 800);
      txt(ctx, `${MODE_NAME[this.mode]} · ${this.n} mảnh${this.rotate ? ' · xoay' : ''}`, 18, 42, 14, '#b8d6dd', 'left', 600);
      const back = { id: 'back', x: 1060, y: 11, w: 200, h: 34 };
      this.btns.push(back);
      Draw.rr(ctx, back.x, back.y, back.w, back.h, 12); ctx.fillStyle = this.btnHover === 'back' ? '#ffd23f' : 'rgba(255,255,255,0.12)'; ctx.fill();
      txt(ctx, '← Đổi tranh khác (M)', back.x + back.w / 2, back.y + 18, 16, this.btnHover === 'back' ? '#2a1840' : '#fff', 'center', 700);
      if (this.phase === 'loading') { txt(ctx, '⏳ Đang mở ảnh…', 640, 380, 30, '#fff', 'center', 800); ctx.restore(); return; }
      const g = this.gal;
      txt(ctx, 'Chọn một ảnh để ghép, hoặc thêm ảnh từ máy (JPG, PNG…). Ảnh được cắt giữa theo khung 16:9 và lưu lại cho lần sau.', 640, 88, 16, '#d6eef3', 'center', 600);
      if (!g || !g.items) { txt(ctx, '⏳ Đang tải…', 640, 380, 26, '#fff', 'center', 700); ctx.restore(); return; }
      const TW = 250, TH = 141, GX = 24, cols = 4, x0 = (1280 - cols * TW - (cols - 1) * GX) / 2, y0 = 120, RH = TH + 52;
      const n = this.galCount();
      for (let k = 0; k < n; k++) {
        const x = x0 + (k % cols) * (TW + GX), y = y0 + Math.floor(k / cols) * RH;
        const on = (this.kb ? g.sel === k : this.btnHover === `tile:${k}` || this.btnHover === `del:${k}`);
        this.btns.push({ id: `tile:${k}`, x, y, w: TW, h: TH + 30 });
        ctx.save();
        if (on) { ctx.shadowColor = 'rgba(255,210,63,0.6)'; ctx.shadowBlur = 18; }
        Draw.rr(ctx, x - 4, y - 4, TW + 8, TH + 38, 14); ctx.fillStyle = on ? '#ffd23f' : 'rgba(255,255,255,0.1)'; ctx.fill();
        ctx.restore();
        if (k === 0) {
          Draw.rr(ctx, x, y, TW, TH, 10); ctx.fillStyle = 'rgba(16,39,47,0.9)'; ctx.fill();
          ctx.setLineDash([10, 8]); ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 3; Draw.rr(ctx, x + 10, y + 10, TW - 20, TH - 20, 8); ctx.stroke(); ctx.setLineDash([]);
          txt(ctx, '＋', x + TW / 2, y + TH / 2 - 10, 48, '#9fe8ff', 'center', 800);
          txt(ctx, 'Thêm ảnh từ máy', x + TW / 2, y + TH + 16, 16, on ? '#2a1840' : '#fff', 'center', 800);
          continue;
        }
        const it = g.items[k - 1];
        ctx.save(); Draw.rr(ctx, x, y, TW, TH, 10); ctx.clip();
        if (it.img.complete && it.img.naturalWidth) ctx.drawImage(it.img, x, y, TW, TH); else { ctx.fillStyle = '#10272f'; ctx.fillRect(x, y, TW, TH); }
        ctx.restore();
        let nm = it.name || 'Ảnh';
        ctx.font = `700 15px ${UI}`; while (ctx.measureText(nm).width > TW - 16 && nm.length > 3) nm = nm.slice(0, -2);
        if (nm !== (it.name || 'Ảnh')) nm += '…';
        txt(ctx, nm, x + TW / 2, y + TH + 16, 15, on ? '#2a1840' : '#fff', 'center', 700);
        const del = { id: `del:${k}`, x: x + TW - 34, y: y + 6, w: 28, h: 28 };
        this.btns.push(del);
        const arm = g.del === it.id;
        circleFill(ctx, del.x + 14, del.y + 14, 14, arm ? '#ff5d73' : 'rgba(0,0,0,0.55)');
        txt(ctx, '✕', del.x + 14, del.y + 15, 15, '#fff', 'center', 800);
      }
      // ô xoá phải đứng trước ô ảnh trong danh sách bấm (nằm đè lên ô)
      this.btns.sort((a, b) => (a.id.startsWith('del:') ? 0 : 1) - (b.id.startsWith('del:') ? 0 : 1));
      txt(ctx, this.kb ? 'Phím hướng chọn · Đánh / Enter mở · Delete xoá · Nhảy / M quay lại' : 'Bấm ảnh để ghép · ✕ để xoá', 640, 704, 14, '#9fb8c0', 'center', 600);
      ctx.restore();
    }
    drawTable(ctx) {
      const g = ctx.createRadialGradient(640, 400, 120, 640, 400, 820);
      g.addColorStop(0, '#2f6b74'); g.addColorStop(1, '#173a45');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
      // vân nỉ
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let y = HUD_H; y < 720; y += 6) ctx.fillRect(0, y, 1280, 2);
    }
    drawFrame(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; Draw.rr(ctx, FRX - 14, FRY - 14, FW + 28, FH + 28, 16); ctx.fill();
      ctx.fillStyle = '#10272f'; ctx.fillRect(FRX, FRY, FW, FH);
      if (this.ghost && this.phase === 'play') { ctx.globalAlpha = 0.2; ctx.drawImage(this.bigArt, FRX, FRY, FW, FH); ctx.globalAlpha = 1; }
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.strokeRect(FRX - 1, FRY - 1, FW + 2, FH + 2);
      ctx.restore();
    }
    groupTransform(ctx, g) {
      const ra = this.rotAnim;
      if (ra && ra.id === g.id) {
        const k = 1 - ra.t / ROT_T;
        ctx.translate(ra.px, ra.py); ctx.rotate(ra.a * k * k); ctx.translate(-ra.px, -ra.py);
      }
      ctx.translate(g.x, g.y); ctx.rotate(g.rot * Math.PI / 2);
    }
    drawGroup(ctx, g, held) {
      const P = this.P, pad = P.pad;
      ctx.save();
      if (held) { ctx.translate(-3, -5); }
      this.groupTransform(ctx, g);
      if (held || !g.locked) {
        // bóng đổ (nâng lên khi đang cầm)
        ctx.save();
        if (held) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14; }
        const [sx, sy] = JC.rot(held ? 7 : 2, held ? 9 : 3, (4 - g.rot) % 4);
        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        ctx.translate(sx, sy);
        ctx.globalAlpha = held ? 0.5 : 0.3;
        for (const i of g.m) { const p = P.pieces[i]; ctx.save(); ctx.translate(p.c * P.pw, p.r * P.ph); ctx.fillStyle = '#000'; ctx.fill(p.path); ctx.restore(); }
        ctx.restore();
      }
      for (const i of g.m) {
        const p = P.pieces[i];
        ctx.drawImage(p.cv, p.c * P.pw - pad, p.r * P.ph - pad, P.pw + pad * 2, P.ph + pad * 2);
      }
      if (held) this.outlineGroup(ctx, g, this.p.color.main, 3, 0.9, true);
      ctx.restore();
    }
    /** viền quanh các mảnh của nhóm (inner = đã ở trong phép biến đổi của nhóm) */
    outlineGroup(ctx, g, col, lw, alpha, inner) {
      const P = this.P;
      ctx.save();
      if (!inner) this.groupTransform(ctx, g);
      ctx.globalAlpha = Math.max(0, alpha); ctx.strokeStyle = col; ctx.lineWidth = lw;
      for (const i of g.m) { const p = P.pieces[i]; ctx.save(); ctx.translate(p.c * P.pw, p.r * P.ph); ctx.stroke(p.path); ctx.restore(); }
      ctx.restore();
    }
    drawHint(ctx) {
      const h = this.hint;
      if (!h) return;
      const g = this.bd.group(h.gid);
      if (!g) return;
      const pulse = 0.55 + 0.45 * Math.sin(this.t * 10 + h.t * 6);
      this.outlineGroup(ctx, g, '#ffd23f', 5, pulse);
      // chỗ của nó trong khung
      const P = this.P;
      ctx.save();
      ctx.translate(FRX, FRY);
      ctx.globalAlpha = 0.35 + 0.35 * pulse; ctx.fillStyle = 'rgba(255,210,63,0.35)'; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      for (const i of g.m) { const p = P.pieces[i]; ctx.save(); ctx.translate(p.c * P.pw, p.r * P.ph); ctx.fill(p.path); ctx.stroke(p.path); ctx.restore(); }
      ctx.restore();
    }
    drawFinal(ctx) {
      // mảnh đã khoá hết: hiện dần bức tranh liền mạch, viền khung loé sáng
      const g = [...this.bd.groups.values()][0];
      if (g) this.drawGroup(ctx, g, false);
      const k = U.clamp((this.doneT || 0) / 1.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = k; ctx.drawImage(this.bigArt, FRX, FRY, FW, FH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(255,224,102,${0.4 + 0.4 * Math.sin(this.t * 6 + (this.doneT || 0) * 5)})`; ctx.lineWidth = 6; ctx.strokeRect(FRX - 4, FRY - 4, FW + 8, FH + 8);
      ctx.restore();
      for (let s = 0; s < 6; s++) {
        const a = (this.doneT || 0) * 1.3 + s;
        Draw.sparkle && Draw.sparkle(ctx, FRX + ((s * 137 + a * 60) % FW), FRY + ((s * 89 + a * 40) % FH), 8 + 4 * Math.sin(a * 3), '#fff');
      }
    }
    drawHud(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,20,30,0.82)'; ctx.fillRect(0, 0, 1280, HUD_H);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, HUD_H - 2, 1280, 2);
      let nm = this.artName();
      ctx.font = `800 20px ${UI}`; while (ctx.measureText(nm).width > 220 && nm.length > 4) nm = nm.slice(0, -2);
      if (nm !== this.artName()) nm += '…';
      txt(ctx, nm, 18, 21, 20, '#fff', 'left', 800);
      const sub = this.daily ? `📅 Bức ngày ${this.day.slice(8)}/${this.day.slice(5, 7)} · ${this.n} mảnh` : `${MODE_NAME[this.mode]} · ${this.n} mảnh${this.rotate ? ' · xoay' : ''}`;
      txt(ctx, sub, 18, 42, 14, '#b8d6dd', 'left', 600);
      // tiến độ
      const placed = this.bd.lockedCount(), frac = placed / this.P.n, bx = 250, bw = 230;
      Draw.rr(ctx, bx, 18, bw, 20, 10); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
      if (frac > 0) { Draw.rr(ctx, bx, 18, Math.max(20, bw * frac), 20, 10); ctx.fillStyle = '#5dffb0'; ctx.fill(); }
      txt(ctx, `${placed}/${this.P.n} vào khung`, bx + bw / 2, 29, 14, frac >= 0.6 ? '#10272f' : '#fff', 'center', 800);
      // nút
      this.btns = [];
      if (this.phase === 'play') {
        const items = [{ id: 'peek', s: this.peekOn ? '👁 Đóng ảnh' : '👁 Xem ảnh' }, { id: 'hint', s: this.hint ? `💡 Tắt gợi ý (${Math.ceil(this.hint.t)})` : '💡 Gợi ý' }];
        items.push({ id: 'tidy', s: '🧲 Xếp gọn' });
        if (this.mode === 'relax') items.push({ id: 'shuffle', s: this.confirmShuffle > 0 ? '⚠ Bấm lần nữa' : '🔀 Xáo lại' });
        let x = 500;
        for (const it of items) {
          ctx.font = `700 16px ${UI}`;
          const w = ctx.measureText(it.s).width + 26;
          const b = { id: it.id, x, y: 11, w, h: 34 };
          this.btns.push(b);
          const hov = this.btnHover === it.id;
          Draw.rr(ctx, b.x, b.y, b.w, b.h, 12); ctx.fillStyle = hov ? '#ffd23f' : it.id === 'shuffle' && this.confirmShuffle > 0 ? '#ff8a5c' : 'rgba(255,255,255,0.12)'; ctx.fill();
          txt(ctx, it.s, b.x + b.w / 2, b.y + 18, 16, hov ? '#2a1840' : '#fff', 'center', 700);
          x += w + 10;
        }
      }
      // đồng hồ
      const tt = this.phase === 'play' ? this.t + this.penalty : this.total || 0;
      txt(ctx, `⏱ ${fmt(tt)}`, 1262, 22, 24, this.mode !== 'relax' ? '#ffd23f' : '#fff', 'right', 800);
      let sub2;
      if (this.daily) { const D = loadStore().daily; sub2 = D && D.streak && (D.last === dayKey() || D.last === dayKey(-1)) ? `🔥 chuỗi ${D.streak} ngày` : 'giờ chạy từ mảnh đầu'; }
      else {
        const best = this.mode === 'time' ? (loadStore().best || {})[`${this.art}|${this.n}|${this.rotate ? 'r' : ''}`] : null;
        sub2 = best ? `kỷ lục ${fmt(best)}` : this.mode === 'time' ? (this.started ? 'đang tính giờ' : 'giờ chạy từ mảnh đầu') : `💡 ${this.hints} · 👁 ${this.peeks}`;
      }
      txt(ctx, sub2, 1262, 44, 13, '#b8d6dd', 'right', 600);
      ctx.restore();
    }
    drawHelp(ctx) {
      const a = Math.min(1, (14 - this.t) / 1.5);
      ctx.save(); ctx.globalAlpha = a;
      const mouse = '🖱️ Kéo thả mảnh' + (this.rotate ? ' · chuột phải / lăn chuột: xoay' : '') + ' · Space: xem ảnh · G: gợi ý · X: xếp gọn';
      Draw.rr(ctx, 640 - 400, 672, 800, 36, 12); ctx.fillStyle = 'rgba(10,20,30,0.75)'; ctx.fill();
      if (this.kb && typeof App !== 'undefined' && App.helpRows) {
        const r = App.helpRows()[0];
        if (r) { const w = App.helpLine(ctx, r, 0, 0, 15, false); App.helpLine(ctx, r, 640 - w / 2, 690, 15, true); }
      } else txt(ctx, mouse, 640, 691, 16, '#fff', 'center', 600);
      ctx.restore();
    }
    drawPeek(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(5,10,20,0.78)'; ctx.fillRect(0, 0, 1280, 720);
      const w = 1088, h = 612, x = (1280 - w) / 2, y = 54;
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24;
      ctx.drawImage(this.bigArt, x, y, w, h);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
      txt(ctx, `👁 ${this.artName().replace(/^\S+ /, '')}`, 640, 30, 22, '#fff', 'center', 800);
      txt(ctx, this.spaceDown || (this.peekKey && this.jumpT >= 0) ? 'Thả phím để quay lại' : 'Bấm chuột hoặc nút 👁 để đóng', 640, 694, 16, '#b8d6dd', 'center', 600);
      ctx.restore();
    }
    drawSummary(ctx) {
      const w = 680, h = 112, x = 300, y = FRY + FH + 2;
      ctx.save();
      const yy = Math.min(y, 720 - h - 8);
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18;
      Draw.rr(ctx, x, yy, w, h, 18); ctx.fillStyle = 'rgba(16,28,40,0.95)'; ctx.fill();
      ctx.shadowBlur = 0; ctx.lineWidth = 3; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
      txt(ctx, '🎉 Hoàn thành bức tranh!', x + 24, yy + 30, 24, '#ffd23f', 'left', 800);
      let line = `⏱ ${fmt(this.total)}`;
      if (this.mode === 'time' && this.penalty) line += ` (gồm +${this.penalty}s gợi ý)`;
      line += ` · 💡 ${this.hints} gợi ý · 👁 ${this.peeks} lần xem ảnh`;
      txt(ctx, line, x + 24, yy + 56, 16, '#fff', 'left', 600);
      if (this.mode === 'time') {
        const s = this.newBest ? (this.prevBest ? `🏆 Kỷ lục mới! (trước ${fmt(this.prevBest)})` : '🏆 Kỷ lục đầu tiên!') : `Kỷ lục: ${fmt(this.prevBest)}`;
        txt(ctx, s, x + w - 20, yy + 26, 16, this.newBest ? '#5dffb0' : '#b8d6dd', 'right', 700);
      }
      const D = this.daily ? loadStore().daily : null;
      if (D) {
        const s = `🔥 Chuỗi ${D.streak} ngày` + (this.prevBest ? (this.newBest ? ` · nhanh hơn lần trước (${fmt(this.prevBest)})` : ` · lần trước ${fmt(this.prevBest)}`) : '');
        txt(ctx, s, x + w - 20, yy + 26, 16, '#ffb35d', 'right', 700);
      }
      this.btns = [];
      const items = [{ id: 'again', s: this.daily ? '↻ Ghép lại (Enter)' : '↻ Bức mới (Enter)' }, { id: 'menu', s: '☰ Đổi tranh / chế độ (M)' }];
      let bx = x + 24;
      for (const it of items) {
        ctx.font = `700 16px ${UI}`;
        const bw = ctx.measureText(it.s).width + 28, b = { id: it.id, x: bx, y: yy + 72, w: bw, h: 30 };
        this.btns.push(b);
        const hov = this.btnHover === it.id;
        Draw.rr(ctx, b.x, b.y, b.w, b.h, 10); ctx.fillStyle = hov || it.id === 'again' ? '#ffd23f' : 'rgba(255,255,255,0.14)'; ctx.fill();
        txt(ctx, it.s, b.x + bw / 2, b.y + 16, 16, hov || it.id === 'again' ? '#2a1840' : '#fff', 'center', 700);
        bx += bw + 12;
      }
      if (D) {
        // 14 ngày gần nhất: ô xanh = đã ghép bức ngày đó
        for (let k = 0; k < 14; k++) {
          const dk = dayKey(k - 13), bx2 = x + w - 20 - (13 - k) * 17 - 13, by2 = yy + 80, on = !!(D.days && D.days[dk]);
          Draw.rr(ctx, bx2, by2, 13, 13, 3); ctx.fillStyle = on ? '#5dffb0' : 'rgba(255,255,255,0.14)'; ctx.fill();
          if (k === 13) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke(); }
        }
        txt(ctx, '14 ngày qua (ô vàng = hôm nay)', x + w - 20, yy + 66, 11, '#7f9aa6', 'right', 600);
      } else txt(ctx, 'Tay cầm: Đánh = bức mới · Nhảy = đổi tranh', x + w - 20, yy + 87, 12, '#7f9aa6', 'right', 600);
      ctx.restore();
    }
    drawCursor(ctx) {
      const { x, y } = this.cur, c = this.p.color;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = c.main; ctx.strokeStyle = '#1a1030'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (this.hold) { ctx.arc(0, 0, 13, 0, Math.PI * 2); }
      else { ctx.moveTo(0, 0); ctx.lineTo(0, 22); ctx.lineTo(6, 17); ctx.lineTo(10, 27); ctx.lineTo(14, 25); ctx.lineTo(10, 15); ctx.lineTo(17, 15); ctx.closePath(); }
      ctx.fill(); ctx.stroke();
      if (this.hold) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }

  function circleFill(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function txt(ctx, s, x, y, size, color, align = 'center', weight = 700) {
    ctx.font = `${weight} ${size}px ${UI}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.textBaseline = 'alphabetic';
  }

  Party.register({
    id: 'jigsaw', name: 'Jigsaw Puzzle', emoji: '🧩', cat: 'brain',
    tagline: 'Ghép tranh răng cưa: kéo thả từng mảnh, mảnh đúng tự hút dính. Thư giãn hoặc thi giờ với chính mình.',
    how: 'Kéo các mảnh vào khung giữa bàn. Hai mảnh đúng đặt gần nhau thì tự dính thành nhóm; nhóm đặt đúng chỗ trong khung thì khoá lại. Ghép hết là xong. Bí thì xem ảnh gốc, dùng gợi ý, hoặc 🧲 Xếp gọn để gom mảnh viền sát khung. Thư giãn: thoát giữa chừng thì lần sau chơi tiếp.',
    controls: { move: 'Di chuyển tay', act: 'Nhặt / thả mảnh', jump: 'Tới mảnh kế · xoay · giữ: xem ảnh' },
    helpExtra: '🖱️ kéo thả mảnh · chuột phải / lăn chuột: xoay · Space: xem ảnh · G: gợi ý · X: xếp gọn',
    minPlayers: 1, maxPlayers: 1, rawBot: true, noFast: true,
    modes: [
      { id: 'relax', name: 'Thư giãn', icon: '🧘', desc: 'Không áp lực, không tính kỷ lục; khung trống (bật ảnh mờ được ở tuỳ chọn), thoát giữa chừng thì lần sau chơi tiếp đúng chỗ.' },
      { id: 'time', name: 'Thi giờ', icon: '⏱', desc: 'Không ảnh mờ, giờ chạy từ lúc nhặt mảnh đầu, mỗi gợi ý +15 giây. Kỷ lục riêng cho từng tranh × số mảnh × xoay.',
        how: 'Ghép nhanh nhất có thể: giờ chạy từ lúc nhặt mảnh đầu tiên, không có ảnh mờ trong khung (vẫn xem được ảnh gốc), mỗi lần gợi ý cộng thêm giây phạt. Kỷ lục lưu riêng cho từng tranh, số mảnh và kiểu xoay.' },
      { id: 'daily', name: 'Bức mỗi ngày', icon: '📅', desc: 'Mỗi ngày một bức cố định (tranh + cách cắt theo ngày), 48 mảnh, không xoay. Ghép mỗi ngày để giữ chuỗi 🔥.',
        how: 'Mỗi ngày một bức cố định: cùng tranh, cùng cách cắt suốt ngày đó (không theo tuỳ chọn tranh / số mảnh / xoay). Giờ chạy từ mảnh đầu, gợi ý cộng giây phạt. Ghép xong mỗi ngày để giữ chuỗi ngày liên tiếp; thoát giữa chừng thì trong ngày vào lại chơi tiếp.' },
    ],
    variants: { label: 'Tranh', items: ART.list.map((a) => ({ id: a.id, name: a.name, icon: a.icon, desc: 'Tranh tự vẽ' })).concat([
      { id: 'mine', name: 'Ảnh của bạn', icon: '🖼️', desc: 'Chọn ảnh từ máy (JPG, PNG…) — ảnh được lưu lại cho lần sau' },
      { id: 'random', name: 'Ngẫu nhiên', icon: '🎲', desc: 'Mỗi ván một tranh tự vẽ' }]) },
    options: [
      { id: 'pieces', label: 'Số mảnh', items: [
        { id: 'auto', name: 'Theo độ dài', icon: '🎚️', desc: 'Ngắn 24 · Vừa 48 · Dài 96 mảnh' },
        { id: '12', name: '12', icon: '🟢', desc: '12 mảnh to — dễ' },
        { id: '24', name: '24', icon: '🟡', desc: '24 mảnh' },
        { id: '48', name: '48', icon: '🟠', desc: '48 mảnh' },
        { id: '96', name: '96', icon: '🔴', desc: '96 mảnh nhỏ — khó' },
      ] },
      { id: 'rotate', label: 'Xoay mảnh', items: [
        { id: 'off', name: 'Không xoay', icon: '⬆️', desc: 'Mảnh nằm đúng chiều' },
        { id: 'on', name: 'Có xoay', icon: '🔄', desc: 'Mảnh bị xoay ngẫu nhiên, xoay 90° bằng chuột phải / lăn chuột / R / Nhảy khi đang cầm' },
      ] },
      // id mới 'ghostImg' (trước là 'ghost', mặc định Có) để lựa chọn cũ đã lưu không bật lại ảnh mờ
      { id: 'ghostImg', label: 'Ảnh mờ trong khung', items: [
        { id: 'off', name: 'Không', icon: '⬛', desc: 'Khung trống — khó hơn' },
        { id: 'on', name: 'Có', icon: '🖼️', desc: 'Thư giãn: hiện ảnh mờ trong khung để dễ đặt' },
      ] },
    ],
    create: (api) => new Jigsaw(api),
  });
})();

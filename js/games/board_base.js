'use strict';
/* =========================================================
   BoardKit — phần dùng chung cho các game cờ (Cờ Vua, sau này Cờ Tướng, Cờ Tỷ Phú):
   - img(): nạp ảnh trong assets/ (SVG được vẽ sẵn ra canvas cho nét), thiếu file thì game tự vẽ Canvas
   - KeyRepeat: con trỏ đi bằng phím hướng, giữ để chạy liên tục
   - Clock + TIME_CONTROLS: đồng hồ hai bên (cộng giây mỗi nước)
   - ai(): máy nghĩ trong Web Worker tạo từ Blob (chạy được với file:// và bản .exe);
           không tạo được worker (hoặc BoardKit.sync = true khi test) thì tính ngay trên luồng chính
   Phải nạp TRƯỚC các file game cờ trong index.html.
   ========================================================= */
const BoardKit = (() => {
  /* ---------- Ảnh ---------- */
  const IMG = {};
  const RASTER = 160; // vẽ SVG ra canvas 160×160 một lần
  function img(src) {
    let e = IMG[src];
    if (e) return e;
    e = IMG[src] = { ok: false, bad: false, el: null };
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = RASTER;
        c.getContext('2d').drawImage(im, 0, 0, RASTER, RASTER);
        e.el = c;
      } catch (err) { e.el = im; }
      e.ok = true;
    };
    im.onerror = () => { e.bad = true; };
    im.src = src;
    return e;
  }
  const preload = (list) => list.forEach(img);
  /** đã nạp xong (hoặc lỗi) hết danh sách chưa — trả tỉ lệ 0..1 */
  const progress = (list) => list.filter((s) => { const e = img(s); return e.ok || e.bad; }).length / Math.max(1, list.length);

  /* ---------- Con trỏ phím ---------- */
  class KeyRepeat {
    constructor() { this.k = null; this.t = 0; }
    /** trả {dx,dy} khi con trỏ cần bước 1 ô (bấm lần đầu, rồi lặp khi giữ) */
    step(q, dt) {
      const dx = q.mx > 0.5 ? 1 : q.mx < -0.5 ? -1 : 0, dy = q.my > 0.5 ? 1 : q.my < -0.5 ? -1 : 0;
      if (!dx && !dy) { this.k = null; return null; }
      const k = dx * 3 + dy;
      if (k !== this.k) { this.k = k; this.t = 0.3; return { dx, dy }; }
      this.t -= dt;
      if (this.t <= 0) { this.t = 0.075; return { dx, dy }; }
      return null;
    }
  }

  /* ---------- Đồng hồ ---------- */
  const TIME_CONTROLS = {
    label: 'Đồng hồ',
    items: [
      { id: 'none', name: 'Không giới hạn', icon: '♾️', desc: 'Không tính giờ — thong thả suy nghĩ.' },
      { id: '3+2', name: '3 phút +2', icon: '⚡', desc: 'Cờ chớp: mỗi bên 3 phút, đi xong mỗi nước được cộng 2 giây. Hết giờ là thua.' },
      { id: '5', name: '5 phút', icon: '⏱️', desc: 'Mỗi bên 5 phút cho cả ván. Hết giờ là thua (trừ khi đối thủ không đủ quân chiếu hết → hòa).' },
      { id: '10', name: '10 phút', icon: '⏰', desc: 'Mỗi bên 10 phút cho cả ván. Hết giờ là thua.' },
      { id: '15+10', name: '15 phút +10', icon: '🕰️', desc: 'Cờ nhanh: mỗi bên 15 phút, mỗi nước được cộng 10 giây.' },
    ],
  };
  const TC = { none: null, '3+2': { base: 180, inc: 2 }, 5: { base: 300, inc: 0 }, 10: { base: 600, inc: 0 }, '15+10': { base: 900, inc: 10 } };
  class Clock {
    constructor(id) { this.tc = TC[id] || null; this.left = this.tc ? [this.tc.base, this.tc.base] : null; }
    get on() { return !!this.tc; }
    /** trừ giờ bên side; trả true khi vừa hết giờ */
    tick(side, dt) {
      if (!this.left) return false;
      const was = this.left[side];
      this.left[side] = Math.max(0, was - dt);
      return was > 0 && this.left[side] <= 0;
    }
    moved(side) { if (this.left) this.left[side] += this.tc.inc; }
  }
  const fmtClock = (s) => {
    if (s < 10) return s.toFixed(1);
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  /* ---------- Máy nghĩ trong Web Worker ---------- */
  const AIS = {};
  /**
   * ai(name, factory, handler): một worker dùng chung cho mỗi loại cờ.
   *   factory: hàm tạo engine (ví dụ ChessEngineFactory) — được nhúng vào worker bằng toString()
   *   handler(E, msg) → kết quả: hàm thuần, chạy trong worker với E = factory(); dự phòng chạy ở luồng chính với localEngine
   */
  function ai(name, factory, handler, localEngine) {
    if (AIS[name]) return AIS[name];
    const a = AIS[name] = {
      w: null, busy: null, seq: 0, dead: false,
      spawn() {
        if (this.dead || typeof Worker === 'undefined') { this.dead = true; return; }
        try {
          const src = `'use strict';\nconst E = (${factory.toString()})();\nconst H = ${handler.toString()};\n`
            + 'onmessage = (e) => { const r = H(E, e.data); r.id = e.data.id; postMessage(r); };';
          this.w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
          this.w.onmessage = (e) => this.got(e.data);
          this.w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); this.fallback(); };
        } catch (err) { this.dead = true; this.w = null; }
      },
      fallback() {
        if (this.w) { try { this.w.terminate(); } catch (e) { /* bỏ qua */ } }
        this.w = null; this.dead = true;
        const b = this.busy;
        if (b) { this.busy = null; this.ask(b.msg, b.cb); }
      },
      /** gửi yêu cầu; cb(kết quả) gọi khi xong. Yêu cầu mới huỷ yêu cầu cũ chưa xong. */
      ask(msg, cb) {
        const id = ++this.seq;
        if (BoardKit.sync || this.dead) {
          // chạy ngay trên luồng chính (rút ngắn thời gian nghĩ để khỏi đứng hình)
          const m = Object.assign({}, msg, { opt: Object.assign({}, msg.opt, { time: Math.min((msg.opt && msg.opt.time) || 300, BoardKit.sync ? 40 : 700) }) });
          const r = handler(localEngine, m);
          this.busy = null;
          cb(r);
          return id;
        }
        if (this.busy) { try { this.w.terminate(); } catch (e) { /* bỏ qua */ } this.w = null; }
        if (!this.w) this.spawn();
        if (!this.w) return this.ask(msg, cb);
        this.busy = { id, msg, cb };
        this.w.postMessage(Object.assign({ id }, msg));
        return id;
      },
      got(d) {
        const b = this.busy;
        if (!b || d.id !== b.id) return;
        this.busy = null;
        b.cb(d);
      },
      cancel() { this.busy = null; },
    };
    return a;
  }

  /* ---------- Vẽ ---------- */
  /** khung thẻ người chơi bên cạnh bàn cờ */
  function card(ctx, x, y, w, h, o) {
    ctx.save();
    if (o.active) { ctx.shadowColor = o.color.main; ctx.shadowBlur = 22; }
    Draw.rr(ctx, x, y, w, h, 16);
    ctx.fillStyle = o.active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3; ctx.strokeStyle = o.active ? o.color.main : 'rgba(255,255,255,0.12)';
    ctx.stroke();
    ctx.restore();
  }
  function clockBox(ctx, x, y, w, h, sec, active, warn) {
    Draw.rr(ctx, x, y, w, h, 10);
    ctx.fillStyle = active ? (warn ? '#ff5a5a' : '#ffe14d') : 'rgba(0,0,0,0.35)';
    ctx.fill();
    Draw.text(ctx, fmtClock(sec), x + w / 2, y + h / 2 + 2, { size: 30, color: active ? '#2a1840' : '#fff', stroke: null });
  }

  return { img, preload, progress, KeyRepeat, TIME_CONTROLS, Clock, fmtClock, ai, card, clockBox, sync: false };
})();

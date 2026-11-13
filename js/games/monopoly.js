(() => {
  'use strict';
  /* =========================================================
     Cờ Tỷ Phú — 2–4 người (người + máy) trên bàn 40 ô chủ đề "Thành phố thế giới".
     Tên ô, hình, thẻ do Tròn Party tự viết (không dùng tên/hình/thẻ gốc của thương hiệu khác).
     Lượt đi là một máy trạng thái this.st.k:
       resume → pre / jailpre → dice → move → (buy | auction | card | debt | wait) → post → (lượt kế)
       manage (xây/bán nhà, thế chấp, chuộc) và trade (giao dịch) mở từ pre / post / debt.
     Người thật điều khiển bằng menu ở giữa bàn: Lên/Xuống chọn, Đánh = đồng ý, Nhảy = quay lại; chuột bấm được hết.
     Đấu giá: mọi người cùng bấm phím của mình (Đánh +$10, Nhảy +$50).
     ========================================================= */
  // bàn chữ nhật phủ cả màn hình: hàng trên/dưới ô rộng, cột trái/phải ô thấp
  const BX = 0, BY = 0, BW = W, BH = H;
  const CWC = 116, CHC = 104;                                 // ô góc
  const TWR = (BW - 2 * CWC) / 9, THC = (BH - 2 * CHC) / 9;   // ô hàng ngang · ô cột dọc
  const IX0 = BX + CWC, IY0 = BY + CHC, IW = BW - 2 * CWC, IH = BH - 2 * CHC;   // lòng bàn
  const CW = 500, CX0 = IX0 + (IW - CW) / 2, CY0 = IY0 + (IH - CW) / 2;          // khung giữa (menu, thẻ, đấu giá…)
  const SIDE_W = (IW - CW) / 2 - 14, LX = IX0 + 8, RX = CX0 + CW + 6;            // cột người chơi (trái) · nhật ký (phải)
  const CARD_H = 120, CARD_GAP = 8;
  // bàn 3D: cột trái (thẻ người chơi + bảng hành động) · cột phải (vòng, góc nhìn, nhật ký, phím) · bàn ở giữa (tâm x = 640)
  const P3_X = 10, P3_W = 248, P3_Y = 10, P3_CH = 84, P3_GAP = 7;
  const R3_X = 1030, R3_W = 240;
  const TURN_FX_T = 2.0;                                      // giây hiện bảng "Lượt của …" lúc đổi lượt
  // nhịp chơi thong thả (chủ project: "không gấp, chơi chill") — mọi thời gian dưới đây × speed (Nhanh 0,45; toàn máy 0,04)
  const DICE_ROLL = 1.1, DICE_HOLD = 1.6;                     // giây lắc xúc xắc · dừng xem kết quả trước khi quân đi
  const HOP_AIR = 0.62;                                       // phần nhịp dành cho cú nhảy (còn lại đứng trên ô)
  const HOP_T = 0.7, HOP_FAST = 0.26, LAND_PAUSE = 0.8;       // giây mỗi bước nhảy ô · bước khi thẻ đưa đi xa · đứng lại sau bước cuối
  const BOT_THINK = [1.4, 2.2];                               // máy "nghĩ" bao lâu trước mỗi quyết định
  const WAIT_T = 1.9;                                         // dừng sau thông báo (hết lượt, trả lời giao dịch…)
  const AUCTION_T = 5;                                        // giây đếm ngược đấu giá (đặt giá mới thì đếm lại)
  const MONEY_T = 0.9, FLOAT_T = 2.2;                         // giây tiền bay giữa các thẻ · chữ ±$ nổi lên
  const TOKEN_OFF = [[-20, -12], [20, -12], [-20, 13], [20, 13]];
  const START_CASH = 1500, GO_CASH = 200, JAIL = 10, GOJAIL = 30, FINE = 50, FULL_CAP = 100, MAX_TURNS = 3000;
  const MULT = [1, 5, 15, 40, 55, 70];                        // tiền thuê theo số nhà (5 = khách sạn)
  const AIR_RENT = [0, 25, 50, 100, 200];
  const SAVE_KEY = 'tronparty.save.monopoly';
  const GROUPS = [
    { name: 'Châu Phi', color: '#8d5a3b' }, { name: 'Nam Mỹ', color: '#7fcdf0' }, { name: 'Đông Nam Á', color: '#e461a6' },
    { name: 'Việt Nam', color: '#f39c3d' }, { name: 'Đông Á', color: '#e74c3c' }, { name: 'Châu Âu', color: '#f2cf3a' },
    { name: 'Đại dương & Trung Đông', color: '#2fae62' }, { name: 'Siêu đô thị', color: '#2f5fd8' },
  ];
  const T = (t, o = {}) => Object.assign({ t }, o);
  const TILES = [
    T('go', { name: 'Khởi hành', art: 'go', icon: '🏁' }),
    T('city', { g: 0, name: 'Cairo', art: 'cairo', icon: '🐪', price: 60 }),
    T('chest', { name: 'Khí vận', art: 'chest', icon: '🎁' }),
    T('city', { g: 0, name: 'Cape Town', art: 'capetown', icon: '⛰️', price: 70 }),
    T('tax', { name: 'Thuế thu nhập', art: 'tax', icon: '💸', amt: 200 }),
    T('air', { name: 'Sân bay Nội Bài', art: 'air', icon: '✈️', price: 200 }),
    T('city', { g: 1, name: 'Lima', art: 'lima', icon: '🦙', price: 100 }),
    T('chance', { name: 'Cơ hội', art: 'chance', icon: '❓' }),
    T('city', { g: 1, name: 'Buenos Aires', art: 'buenosaires', icon: '💃', price: 100 }),
    T('city', { g: 1, name: 'Rio de Janeiro', art: 'rio', icon: '🏖️', price: 120 }),
    T('jail', { name: 'Nhà tù', art: 'jail', icon: '🔒' }),
    T('city', { g: 2, name: 'Bangkok', art: 'bangkok', icon: '🛕', price: 140 }),
    T('util', { name: 'Điện lực', art: 'elec', icon: '💡', price: 150 }),
    T('city', { g: 2, name: 'Kuala Lumpur', short: 'Kuala Lumpur', art: 'kualalumpur', icon: '🏙️', price: 140 }),
    T('city', { g: 2, name: 'Singapore', art: 'singapore', icon: '🦁', price: 160 }),
    T('air', { name: 'Sân bay Changi', art: 'air', icon: '✈️', price: 200 }),
    T('city', { g: 3, name: 'Đà Nẵng', art: 'danang', icon: '🌉', price: 180 }),
    T('chest', { name: 'Khí vận', art: 'chest', icon: '🎁' }),
    T('city', { g: 3, name: 'Hà Nội', art: 'hanoi', icon: '🐢', price: 180 }),
    T('city', { g: 3, name: 'TP. Hồ Chí Minh', short: 'TP.HCM', art: 'hcm', icon: '🛵', price: 200 }),
    T('park', { name: 'Bãi đỗ xe', art: 'park', icon: '🅿️' }),
    T('city', { g: 4, name: 'Seoul', art: 'seoul', icon: '🏯', price: 220 }),
    T('chance', { name: 'Cơ hội', art: 'chance', icon: '❓' }),
    T('city', { g: 4, name: 'Thượng Hải', art: 'shanghai', icon: '🌃', price: 220 }),
    T('city', { g: 4, name: 'Hồng Kông', art: 'hongkong', icon: '🚋', price: 240 }),
    T('air', { name: 'Sân bay Heathrow', art: 'air', icon: '✈️', price: 200 }),
    T('city', { g: 5, name: 'Rome', art: 'rome', icon: '🏛️', price: 260 }),
    T('city', { g: 5, name: 'Berlin', art: 'berlin', icon: '🐻', price: 260 }),
    T('util', { name: 'Cấp nước', art: 'water', icon: '🚰', price: 150 }),
    T('city', { g: 5, name: 'Paris', art: 'paris', icon: '🗼', price: 280 }),
    T('gojail', { name: 'Vào tù', art: 'gojail', icon: '👮' }),
    T('city', { g: 6, name: 'Sydney', art: 'sydney', icon: '🦘', price: 300 }),
    T('city', { g: 6, name: 'Dubai', art: 'dubai', icon: '🏜️', price: 300 }),
    T('chest', { name: 'Khí vận', art: 'chest', icon: '🎁' }),
    T('city', { g: 6, name: 'Los Angeles', art: 'la', icon: '🎬', price: 320 }),
    T('air', { name: 'Sân bay JFK', art: 'air', icon: '✈️', price: 200 }),
    T('chance', { name: 'Cơ hội', art: 'chance', icon: '❓' }),
    T('city', { g: 7, name: 'Tokyo', art: 'tokyo', icon: '🗻', price: 350 }),
    T('tax', { name: 'Thuế xa xỉ', art: 'lux', icon: '💎', amt: 100 }),
    T('city', { g: 7, name: 'New York', art: 'newyork', icon: '🗽', price: 400 }),
  ];
  const roundRent = (x) => (x < 50 ? Math.round(x) : Math.round(x / 5) * 5);
  const GROUP_TILES = GROUPS.map(() => []);
  TILES.forEach((t, i) => {
    t.i = i;
    t.buy = t.t === 'city' || t.t === 'air' || t.t === 'util';
    if (t.t === 'city') {
      t.hc = [50, 100, 150, 200][Math.floor(i / 10)];
      t.base = Math.max(2, Math.round(t.price * 0.08));
      t.rents = MULT.map((m) => roundRent(t.base * m));
      GROUP_TILES[t.g].push(i);
    }
  });
  /** sức mạnh nhóm màu: tiền thuê 3 nhà của cả nhóm / tiền xây 3 nhà cho cả nhóm */
  const groupPower = (g) => { const G = GROUP_TILES[g]; return G.reduce((x, t) => x + TILES[t].rents[3], 0) / (G.length * 3 * TILES[G[0]].hc) * G.length; };
  const AIRS = [5, 15, 25, 35], UTILS = [12, 28], BUYABLE = TILES.filter((t) => t.buy).map((t) => t.i);
  const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('vi-VN');

  /* ---------- Tranh (MON15): assets/monopoly/*.svg, tự vẽ — thiếu file thì quay về emoji ---------- */
  const ART_DIR = 'assets/monopoly/';
  const artSrc = (key, city) => ART_DIR + (city ? 'city_' : 'icon_') + key + '.svg';
  const GLOBE = ART_DIR + 'globe.svg';
  const ART_LIST = [...new Set(TILES.map((t) => artSrc(t.art, t.t === 'city')))].concat([GLOBE]);
  /** ảnh đã nạp (canvas) hoặc null; tranh thành phố 480×240, icon 128, quả địa cầu 760 */
  function art(src) {
    if (typeof BoardKit === 'undefined') return null;
    const e = src.includes('/city_') ? BoardKit.img(src, 480, 240) : src === GLOBE ? BoardKit.img(src, 760) : BoardKit.img(src, 128);
    return e.ok ? e.el : null;
  }
  /** nạp hết tranh (đúng kích thước) rồi báo đã xong chưa — ảnh lỗi cũng tính là xong */
  function artReady() {
    if (typeof BoardKit === 'undefined') return true;
    ART_LIST.forEach(art);
    return BoardKit.progress(ART_LIST) >= 1;
  }
  const tileArt = (t) => art(artSrc(t.art, t.t === 'city'));
  const deckArt = (deck) => art(artSrc(deck, false));
  /** vẽ tranh thành phố cắt vừa khung w×h (giữ tỉ lệ, lấy phần giữa, lệch theo fy 0..1) */
  function drawCrop(g, im, x, y, w, h, fy = 0.5) {
    const iw = im.width, ih = im.height, k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k;
    g.drawImage(im, (iw - sw) / 2, (ih - sh) * fy, sw, sh, x, y, w, h);
  }
  /** khung ảnh lớn cho thẻ thông tin / đấu giá: thành phố = tranh, ô khác = icon trên nền trời */
  function drawPicture(g, d, x, y, w, h) {
    const im = tileArt(d);
    if (im && d.t === 'city') { drawCrop(g, im, x, y, w, h, w / h > 3 ? 0.65 : 0.4); return true; }
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#8fd0f5'); gr.addColorStop(1, '#e6f6ff');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    if (d.t === 'air') { g.fillStyle = 'rgba(255,255,255,0.8)'; for (const [cx, cy, r] of [[x + 40, y + 26, 12], [x + 52, y + 22, 10], [x + w - 50, y + 34, 11], [x + w - 38, y + 30, 9]]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); } }
    const s = h * 0.72;
    if (im) g.drawImage(im, x + w / 2 - s / 2, y + h / 2 - s / 2 - 4, s, s);
    else { g.font = `${s * 0.7}px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(d.icon, x + w / 2, y + h / 2); }
    return !!im;
  }

  /* ---------- Thẻ Cơ hội / Khí vận ----------
     Theo kiểu thẻ của boardgamevui.com/typhu (14/11/2026, chủ project yêu cầu): mỗi thẻ có tiêu đề vui to (emo + title)
     và một dòng tác dụng ngắn (text). Bộ tác dụng/số tiền theo trang đó; tiêu đề tự viết lại theo chủ đề du lịch thế giới.
     {name} trong tiêu đề = tên người bốc thẻ. */
  const C = (emo, title, text, fn, o = {}) => Object.assign({ emo, title, text, icon: emo.split(' ')[0], fn }, o);
  const CHANCE = [
    C('🗻 ✈️', 'Săn được vé 0 đồng', 'Bay thẳng tới Tokyo. Qua Khởi hành nhận $200.', (g, i, done) => g.moveTo(i, 37, true, done)),
    C('🥟 🚋', 'Thèm dimsum quá trời', 'Tới Hồng Kông. Qua Khởi hành nhận $200.', (g, i, done) => g.moveTo(i, 24, true, done)),
    C('🛕 🍜', 'Đi Thái ăn pad thái', 'Tới Bangkok. Qua Khởi hành nhận $200.', (g, i, done) => g.moveTo(i, 11, true, done)),
    C('🧧 🛬', 'Về quê ăn Tết', 'Tới Sân bay Nội Bài. Qua Khởi hành nhận $200.', (g, i, done) => g.moveTo(i, 5, true, done)),
    C('✈️ 😵', 'Chuyến bay bị hoãn', 'Tới sân bay gần nhất phía trước. Có chủ thì trả gấp đôi tiền thuê.', (g, i, done) => g.toNearest(i, 'air', done)),
    C('⚡ 💧', 'Cúp điện cúp nước', 'Tới công ty gần nhất phía trước. Có chủ thì gieo xúc xắc, trả 10 lần số chấm.', (g, i, done) => g.toNearest(i, 'util', done)),
    C('🏁 🏍️', 'Bốc đầu về đích', 'Về ô Khởi hành, nhận $200.', (g, i, done) => g.moveTo(i, 0, true, done)),
    C('🛵 🛵 🛵', 'Kẹt xe giờ cao điểm', 'Lùi lại 3 ô.', (g, i, done) => g.moveBack(i, 3, done)),
    C('🌊 🛶', 'Mưa ngập tới gối', 'Đường ngập, dạt vào Bãi đỗ xe (không qua Khởi hành).', (g, i, done) => g.jumpTo(i, 20, done)),
    C('🚔 😱', 'Tù ngay và luôn', 'Vào tù ngay, không qua Khởi hành.', (g, i, done) => g.sendJail(i, done)),
    C('🗝️ 😎', 'Thẻ ra tù miễn phí', 'Giữ lại dùng khi cần, hoặc đem giao dịch với người khác.', (g, i, done) => g.giveCard(i, 'chance', done), { keep: true }),
    C('📲 💵', 'Ting ting! Tiền về', 'Nhận $100.', (g, i, done) => g.gain(i, 100, done)),
    C('🎰 🤑', 'Trúng số độc đắc', 'Nhận $150.', (g, i, done) => g.gain(i, 150, done)),
    C('📸 🚦', 'Dính phạt nguội', 'Trả $50.', (g, i, done) => g.charge(i, 50, done)),
    C('🏚️ 💧', 'Khách sạn dột mái', 'Trả $25 mỗi nhà, $100 mỗi khách sạn.', (g, i, done) => g.repairs(i, 25, 100, done)),
    C('👑 🍻', 'Lên chức trưởng đoàn', 'Khao cả bàn: trả mỗi người $50.', (g, i, done) => g.payEach(i, 50, done)),
  ];
  const CHEST = [
    C('🏦 💻', 'Ngân hàng chuyển nhầm', 'Nhận $200.', (g, i, done) => g.gain(i, 200, done)),
    C('💼 💼', 'Thưởng Tết ba tháng lương', 'Nhận $100.', (g, i, done) => g.gain(i, 100, done)),
    C('🌧️ 💰', 'Tiền từ trên trời rơi xuống', 'Nhận $100.', (g, i, done) => g.gain(i, 100, done)),
    C('🧳 ☂️', 'Bảo hiểm du lịch chi trả', 'Nhận $100.', (g, i, done) => g.gain(i, 100, done)),
    C('📈 🚀', 'Cổ phiếu xanh sàn', 'Nhận $50.', (g, i, done) => g.gain(i, 50, done)),
    C('🛍️ 📦', 'Thanh lý đồ cũ trên mạng', 'Nhận $50.', (g, i, done) => g.gain(i, 50, done)),
    C('🏆 🎤', 'Giải khuyến khích karaoke', 'Nhận $20.', (g, i, done) => g.gain(i, 20, done)),
    C('🎂 🎉', 'Sinh nhật {name}', 'Mỗi người tặng $30.', (g, i, done) => g.collectEach(i, 30, done)),
    C('🧧 🌸', 'Tết đến rồi!', 'Mỗi người lì xì bạn $20.', (g, i, done) => g.collectEach(i, 20, done)),
    C('🛵 🤕', 'Té xe nhập viện', 'Trả viện phí $100.', (g, i, done) => g.charge(i, 100, done)),
    C('🤦 📦', 'Chốt đơn livestream bị hớ', 'Trả $50.', (g, i, done) => g.charge(i, 50, done)),
    C('🦷 😭', 'Mọc răng khôn', 'Trả $50.', (g, i, done) => g.charge(i, 50, done)),
    C('🚇 🚧', 'Góp tiền làm metro', 'Trả $40 mỗi nhà, $115 mỗi khách sạn.', (g, i, done) => g.repairs(i, 40, 115, done)),
    C('🏁 🏠', 'Về nhà thôi', 'Về ô Khởi hành, nhận $200.', (g, i, done) => g.moveTo(i, 0, true, done)),
    C('🚔 🛂', 'Quên gia hạn visa', 'Vào tù ngay, không qua Khởi hành.', (g, i, done) => g.sendJail(i, done)),
    C('🗝️ 😎', 'Thẻ ra tù miễn phí', 'Giữ lại dùng khi cần, hoặc đem giao dịch với người khác.', (g, i, done) => g.giveCard(i, 'chest', done), { keep: true }),
  ];
  const CARD_READ = 2.8;                                       // giây máy để thẻ trên màn hình cho mọi người kịp đọc
  const CARD_RISE = 0.4, CARD_FLIP = 0.45;                     // thẻ bay lên từ chồng · lật mặt

  /* ---------- Hình học bàn ---------- */
  function tileRect(i) {
    if (i === 0) return { x: BX + BW - CWC, y: BY + BH - CHC, w: CWC, h: CHC, side: 0, corner: true };
    if (i < 10) return { x: BX + BW - CWC - i * TWR, y: BY + BH - CHC, w: TWR, h: CHC, side: 0 };
    if (i === 10) return { x: BX, y: BY + BH - CHC, w: CWC, h: CHC, side: 1, corner: true };
    if (i < 20) return { x: BX, y: BY + BH - CHC - (i - 10) * THC, w: CWC, h: THC, side: 1 };
    if (i === 20) return { x: BX, y: BY, w: CWC, h: CHC, side: 2, corner: true };
    if (i < 30) return { x: BX + CWC + (i - 21) * TWR, y: BY, w: TWR, h: CHC, side: 2 };
    if (i === 30) return { x: BX + BW - CWC, y: BY, w: CWC, h: CHC, side: 3, corner: true };
    return { x: BX + BW - CWC, y: BY + CHC + (i - 31) * THC, w: CWC, h: THC, side: 3 };
  }
  const BAND = 20, OWN_EDGE = 10;   // dải màu nhóm (cạnh trong) · viền màu chủ ô (cạnh ngoài)
  /** dải màu nhóm nằm ở cạnh trong của ô */
  function bandRect(r) {
    if (r.side === 0) return { x: r.x, y: r.y, w: r.w, h: BAND };
    if (r.side === 1) return { x: r.x + r.w - BAND, y: r.y, w: BAND, h: r.h };
    if (r.side === 2) return { x: r.x, y: r.y + r.h - BAND, w: r.w, h: BAND };
    return { x: r.x, y: r.y, w: BAND, h: r.h };
  }
  function tileAt(x, y) {
    for (let i = 0; i < 40; i++) { const r = tileRect(i); if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i; }
    return -1;
  }
  /** chữ nhiều dòng tự xuống hàng trong bề rộng w */
  function wrap(ctx, s, w) {
    const words = s.split(' '), lines = [];
    let cur = '';
    for (const wd of words) {
      const t = cur ? cur + ' ' + wd : wd;
      if (ctx.measureText(t).width > w && cur) { lines.push(cur); cur = wd; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /** nhà (xanh) / khách sạn (đỏ, 2 tầng) tâm (x, y), cỡ s */
  function drawHouse(g, x, y, s, hotel) {
    const w = hotel ? s * 1.5 : s, h = s, top = y - h / 2, roof = h * 0.42;
    g.beginPath();
    g.moveTo(x - w / 2, y + h / 2); g.lineTo(x - w / 2, top + roof); g.lineTo(x - w / 2 - 1, top + roof);
    g.lineTo(x, top - 1); g.lineTo(x + w / 2 + 1, top + roof); g.lineTo(x + w / 2, top + roof); g.lineTo(x + w / 2, y + h / 2); g.closePath();
    g.fillStyle = hotel ? '#e02c2c' : '#1fae4b'; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    if (hotel) { for (const dx of [-0.25, 0, 0.25]) g.fillRect(x + dx * w - 1, top + roof + 1.5, 2, 2); g.fillRect(x - 1.5, y + h / 2 - 3.5, 3, 3.5); }
    else g.fillRect(x - 1.2, y + h / 2 - 3.5, 2.4, 3.5);
  }
  /** tờ tiền đô (tiền bay khi trả / nhận) */
  function drawBill(g, x, y, rot) {
    g.save(); g.translate(x, y); g.rotate(Math.sin(rot) * 0.5);
    Draw.rr(g, -11, -6, 22, 12, 2); g.fillStyle = '#7ccf7a'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#2e7d32'; g.stroke();
    g.beginPath(); g.arc(0, 0, 3.6, 0, TAU); g.fillStyle = '#c8efc5'; g.fill();
    g.fillStyle = '#2e7d32'; g.font = `800 6px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 0.5);
    g.restore();
  }
  /** chữ cỡ size, dài quá maxW thì thu nhỏ dần tới min (giữ textAlign đang đặt) */
  function fitText(g, str, x, y, maxW, size, min, weight, color) {
    if (!str) return;
    let fs = size;
    g.font = `${weight} ${fs}px ${FONT}`;
    while (fs > min && g.measureText(str).width > maxW) { fs -= 0.5; g.font = `${weight} ${fs}px ${FONT}`; }
    g.fillStyle = color; g.fillText(str, x, y);
  }
  let BOARD_IMG = null;
  function boardCanvas() {
    // vẽ lại tới khi font + tranh đã nạp xong (tranh lỗi thì dùng emoji)
    const ready = (!document.fonts || document.fonts.status === 'loaded') && artReady();
    if (BOARD_IMG && (BOARD_IMG.ready || !ready)) return BOARD_IMG.c;
    const c = document.createElement('canvas');
    c.width = BW; c.height = BH;
    const g = c.getContext('2d');
    g.translate(-BX, -BY);
    const EMO = '"Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    // nền viền
    g.fillStyle = '#e8f4ea'; g.fillRect(BX, BY, BW, BH);
    // lòng bàn: biển + quả địa cầu mờ
    const mx = CX0 + CW / 2, my = CY0 + CW / 2;
    const gr = g.createRadialGradient(mx, my, 40, mx, my, IW * 0.6);
    gr.addColorStop(0, '#dff6f0'); gr.addColorStop(1, '#a6d9cb');
    g.fillStyle = gr; g.fillRect(IX0, IY0, IW, IH);
    const globe = art(GLOBE);
    g.save();
    if (globe) { g.globalAlpha = 0.4; const R = 215; g.drawImage(globe, mx - R, my - R + 26, R * 2, R * 2); }
    else { g.globalAlpha = 0.12; g.font = `300px ${EMO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🌏', mx, my + 10); }
    g.restore();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 40; i++) {
      const t = TILES[i], r = tileRect(i), im = tileArt(t), city = t.t === 'city';
      g.fillStyle = t.t === 'go' ? '#fff3c4' : t.t === 'jail' ? '#ffe0d6' : t.t === 'park' ? '#dff3ff' : t.t === 'gojail' ? '#ffd6d6' : '#fbfaf3';
      g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = '#2b3a33'; g.lineWidth = 1.5; g.strokeRect(r.x, r.y, r.w, r.h);
      if (city) { const b = bandRect(r); g.fillStyle = GROUPS[t.g].color; g.fillRect(b.x, b.y, b.w, b.h); g.strokeRect(b.x, b.y, b.w, b.h); }
      // vùng chữ (bỏ dải màu)
      let ax = r.x, ay = r.y, aw = r.w, ah = r.h;
      if (city) {
        if (r.side === 0) { ay += BAND; ah -= BAND; } else if (r.side === 2) { ah -= BAND; } else if (r.side === 1) { aw -= BAND; } else { ax += BAND; aw -= BAND; }
      }
      // chừa mép ngoài cho viền màu chủ ô (drawOverlay) để không che chữ
      if (t.buy && !r.corner) {
        if (r.side === 0) ah -= OWN_EDGE; else if (r.side === 2) { ay += OWN_EDGE; ah -= OWN_EDGE; } else if (r.side === 1) { ax += OWN_EDGE; aw -= OWN_EDGE; } else aw -= OWN_EDGE;
      }
      const cx = ax + aw / 2;
      if (r.corner) {
        if (im) g.drawImage(im, cx - 29, ay + ah / 2 - 38, 58, 58);
        else { g.font = `44px ${EMO}`; g.fillStyle = '#000'; g.fillText(t.icon, cx, ay + ah / 2 - 10); }
        fitText(g, t.name, cx, ay + ah - 14, aw - 6, 17, 12, 800, '#2b3a33');
        if (t.t === 'go') fitText(g, 'nhận $200', cx, ay + 11, aw - 6, 14, 10, 800, '#2b3a33');
        continue;
      }
      const row = r.side === 0 || r.side === 2;                 // hàng trên/dưới: ô rộng · cột trái/phải: ô thấp
      const sub = t.price ? '$' + t.price : t.amt ? 'trả $' + t.amt : '';
      const nm = t.short || t.name;
      if (city && im) {
        // tranh thành phố: dải ảnh trên cùng, tên + giá bên dưới
        const ph = row ? 32 : 20;
        drawCrop(g, im, ax + 2, ay + 2, aw - 4, ph, row ? 0.5 : 0.55);
        g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeRect(ax + 2, ay + 2, aw - 4, ph);
        if (row) {
          fitText(g, nm, cx, ay + ph + 13, aw - 6, 16, 11, 800, '#20302a');
          fitText(g, sub, cx, ay + ah - 10, aw - 6, 15, 11, 800, '#6b4f12');
        } else {
          fitText(g, nm, cx, ay + ph + 11, aw - 6, 14, 10, 800, '#20302a');
          fitText(g, sub, cx, ay + ah - 9, aw - 6, 13.5, 10, 800, '#6b4f12');
        }
        continue;
      }
      if (row) {
        if (im) g.drawImage(im, cx - 19, ay + 4, 38, 38);
        else { g.font = `28px ${EMO}`; g.fillStyle = '#000'; g.fillText(t.icon, cx, ay + 22); }
        g.font = `800 14.5px ${FONT}`;
        const lines = wrap(g, nm, aw - 6).slice(0, 2);
        lines.forEach((l, k) => fitText(g, l, cx, ay + 55 + k * 15 - (lines.length - 1) * 4, aw - 6, 14.5, 10, 800, '#20302a'));
        fitText(g, sub, cx, ay + ah - 11, aw - 6, 15, 11, 800, '#6b4f12');
      } else {
        if (im) g.drawImage(im, ax + 4, ay + ah / 2 - 16, 32, 32);
        else { g.font = `22px ${EMO}`; g.fillStyle = '#000'; g.fillText(t.icon, ax + 20, ay + ah / 2); }
        g.textAlign = 'left';
        g.font = `800 13.5px ${FONT}`;
        const lines = wrap(g, nm, aw - 44).slice(0, 2);
        const y0 = ay + ah / 2 - (lines.length - 1) * 7 - (sub ? 8 : 0);
        lines.forEach((l, k) => fitText(g, l, ax + 40, y0 + k * 14, aw - 44, 13.5, 10, 800, '#20302a'));
        if (sub) fitText(g, sub, ax + 40, ay + ah - 10, aw - 44, 13.5, 10, 800, '#6b4f12');
        g.textAlign = 'center';
      }
    }
    // tên game giữa bàn (chữ tự đặt, không dùng logo thương hiệu nào)
    g.save(); g.translate(CX0 + CW / 2, CY0 + 40);
    g.font = `800 34px ${FONT}`; g.lineWidth = 6; g.strokeStyle = '#fff'; g.strokeText('TRÒN TỶ PHÚ', 0, 0);
    g.fillStyle = '#c0392b'; g.fillText('TRÒN TỶ PHÚ', 0, 0);
    g.font = `700 13px ${FONT}`; g.fillStyle = '#2b5c4d'; g.fillText('vòng quanh thế giới', 0, 24);
    g.restore();
    BOARD_IMG = { c, ready };
    return c;
  }

  let lastResults = null;

  class Monopoly {
    constructor(api) {
      this.api = api;
      this.players = api.players;
      this.n = this.players.length;
      this.quick = api.mode !== 'full';
      this.mRounds = this.quick ? api.count(20) : 0;
      this.hotelAt = this.quick ? 3 : 4;              // số nhà trước khi lên khách sạn
      this.ps = this.players.map((p) => ({ cash: START_CASH, pos: 0, jail: false, jailTurns: 0, cards: [], out: false, outAt: 0, worth: [] }));
      this.own = new Array(40).fill(-1); this.lvl = new Array(40).fill(0); this.mort = new Array(40).fill(false);
      this.housesLeft = 32; this.hotelsLeft = 12;
      this.decks = { chance: U.shuffle(CHANCE.map((_, k) => k)), chest: U.shuffle(CHEST.map((_, k) => k)) };
      this.cur = 0; this.round = 1; this.turns = 0; this.dbl = 0; this.lastDouble = false; this.dice = [1, 1];
      this.log = []; this.floats = []; this.coins = []; this.hop = null;
      this.ptr = null; this.press = null; this.turnFx = null;   // chuột đang ở đâu · nút vừa bấm · hiệu ứng báo lượt
      this.finished = false; this.outCount = 0; this.t = 0;
      this.tradeMemo = {};
      this.rep = this.players.map(() => new BoardKit.KeyRepeat());
      this.hover = -1; this.btns = [];
      this.humans = this.players.filter((p) => !p.bot).length;
      this.ownEndBanner = false;
      this.ownHelp = true;                 // bảng phím vẽ trong cột phải (không để app phủ dải phím lên bàn)
      // ván nhanh: mỗi người được chia ngẫu nhiên 2 ô (trả tiền ngân hàng)
      if (this.quick) {
        const pool = U.shuffle(TILES.filter((t) => t.t === 'city').map((t) => t.i));
        this.ps.forEach((p, i) => { for (let k = 0; k < 2; k++) { const ti = pool.pop(); this.own[ti] = i; p.cash -= TILES[ti].price; } });
      }
      this.st = { k: 'start', t: 0 };
      this.saved = this.humans ? this.readSave() : null;
    }

    /* ---------- tiện ích ---------- */
    get speed() { return !this.humans ? 0.025 : (this.api.opts && this.api.opts.speed === 'fast') ? 0.45 : 1; }
    alive() { return this.ps.map((_, i) => i).filter((i) => !this.ps[i].out); }
    name(i) { return i < 0 ? 'Ngân hàng' : this.players[i].name; }
    say(s) { this.log.push(s); if (this.log.length > 40) this.log.shift(); }
    level(i) { return this.players[i].level || 'normal'; }
    groupOwned(g, i) { return GROUP_TILES[g].every((t) => this.own[t] === i); }
    airsOf(i) { return AIRS.filter((t) => this.own[t] === i).length; }
    housesOn(i) { // tổng nhà, khách sạn của người i
      let h = 0, ho = 0;
      for (let t = 0; t < 40; t++) if (this.own[t] === i) { if (this.lvl[t] === 5) ho++; else h += this.lvl[t]; }
      return { h, ho };
    }
    worth(i) {
      const p = this.ps[i];
      let w = p.cash;
      for (let t = 0; t < 40; t++) {
        if (this.own[t] !== i) continue;
        const d = TILES[t];
        w += this.mort[t] ? d.price / 2 : d.price;
        if (d.t === 'city') w += (this.lvl[t] === 5 ? this.hotelAt + 1 : this.lvl[t]) * d.hc;
      }
      return Math.round(w);
    }
    rentOf(t, diceSum, opts = {}) {
      const d = TILES[t], o = this.own[t];
      if (o < 0 || this.mort[t]) return 0;
      if (d.t === 'city') {
        const l = this.lvl[t];
        if (l === 0) return d.rents[0] * (this.groupOwned(d.g, o) ? 2 : 1);
        return d.rents[l === 5 ? 5 : l];
      }
      if (d.t === 'air') return AIR_RENT[this.airsOf(o)] * (opts.double ? 2 : 1);
      if (d.t === 'util') {
        const both = UTILS.every((u) => this.own[u] === o);
        return diceSum * (opts.ten || both ? 10 : 4);
      }
      return 0;
    }

    /* ---------- tiền: hiệu ứng + chuyển ---------- */
    cardXY(i) {
      if (i < 0) return { x: CX0 + CW / 2, y: CY0 + CW / 2, fx: CX0 + CW / 2 };
      if (this.is3d()) return { x: P3_X + 30, y: this.cardY3(i) + 30, fx: P3_X + P3_W + 44 };
      return { x: LX + 40, y: this.cardY(i) + 40, fx: LX + 230 };
    }
    cardY(i) { return IY0 + 6 + i * (CARD_H + CARD_GAP); }
    cardY3(i) { return P3_Y + i * (P3_CH + P3_GAP); }
    /** tâm ô t trên màn hình (bàn 3D: chiếu từ cảnh) */
    tileScr(t) {
      if (this.is3d()) { const c = this.s3.tileCenter(t); return this.s3.project(c.x, c.y, c.z); }
      const r = tileRect(t); return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    flyMoney(from, to, amt) {
      const a = this.cardXY(from), b = this.cardXY(to), n = Math.min(8, 2 + Math.floor(amt / 60));
      for (let k = 0; k < n; k++) this.coins.push({ a, b, t: -k * 0.07, dur: MONEY_T });
      if (from >= 0) this.floats.push({ x: a.fx, y: a.y - 18, s: '-' + money(amt), c: '#ff6b6b', t: 0 });
      if (to >= 0) this.floats.push({ x: b.fx, y: b.y - 18, s: '+' + money(amt), c: '#5dff9b', t: 0 });
      Sfx.play('pickup', 0.05);
    }
    transfer(from, to, amt) {
      if (amt <= 0) return;
      if (from >= 0) this.ps[from].cash -= amt;
      if (to >= 0) this.ps[to].cash += amt;
      this.flyMoney(from, to, amt);
    }
    /** người i trả amt cho `to` (−1 = ngân hàng); không đủ tiền → trạng thái nợ */
    pay(i, amt, to, why, done) {
      amt = Math.round(amt);
      if (amt <= 0) { done(); return; }
      if (this.ps[i].cash >= amt) { this.transfer(i, to, amt); done(); return; }
      this.say(`💸 ${this.name(i)} thiếu tiền trả ${money(amt)} (${why})`);
      this.setState({ k: 'debt', who: i, amt, to, why, done, sel: 0 });
    }
    gain(i, amt, done) { this.transfer(-1, i, amt); done(); }
    charge(i, amt, done) { this.pay(i, amt, -1, 'thẻ', done); }
    payEach(i, amt, done) {
      const others = this.alive().filter((j) => j !== i), total = amt * others.length;
      const doit = () => { others.forEach((j) => this.transfer(i, j, amt)); done(); };
      if (this.ps[i].cash >= total) { doit(); return; }
      // không đủ: gom tiền như nợ ngân hàng rồi chia cho mọi người
      this.setState({ k: 'debt', who: i, amt: total, to: -1, why: 'trả mỗi người', sel: 0, done: () => { others.forEach((j) => { this.ps[j].cash += amt; this.flyMoney(-1, j, amt); }); done(); } });
    }
    collectEach(i, amt, done) {
      const others = this.alive().filter((j) => j !== i);
      const next = (k) => {
        if (k >= others.length) { done(); return; }
        this.pay(others[k], amt, i, 'mừng sinh nhật', () => next(k + 1));
      };
      next(0);
    }
    giveCard(i, deck, done) { this.ps[i].cards.push(deck); done(); }
    repairs(i, ph, pho, done) {
      const { h, ho } = this.housesOn(i);
      this.pay(i, h * ph + ho * pho, -1, 'sửa nhà', done);
    }

    /* ---------- trạng thái & lượt ---------- */
    setState(s) { s.t = 0; s.sel = s.sel || 0; this.st = s; }
    controller() {
      const s = this.st;
      if (s.k === 'debt' || s.k === 'manage') return s.who;
      if (s.k === 'trade') return s.step === 'answer' ? s.b : s.a;
      if (s.k === 'resume') return this.players.findIndex((p) => !p.bot);
      return this.cur;
    }
    startTurn() {
      const p = this.ps[this.cur];
      this.dbl = 0; this.lastDouble = false;
      if (this.humans && !this.finished) this.writeSave();
      this.say(`▶ Lượt của ${this.name(this.cur)}`);
      // lượt đầu ván chờ chữ "Bắt đầu!" của app tắt rồi mới hiện
      if (this.humans) { this.turnFx = { i: this.cur, t: this.turnFxSeen ? 0 : -1.1 }; this.turnFxSeen = true; }
      this.setState({ k: p.jail ? 'jailpre' : 'pre' });
    }
    nextTurn() {
      if (this.checkEnd()) return;
      const al = this.alive();
      let c = this.cur;
      do { c = (c + 1) % this.n; } while (this.ps[c].out);
      if (c <= this.cur || al.length === 1) this.newRound();
      if (this.finished) return;
      this.cur = c;
      this.turns++;
      this.startTurn();
    }
    newRound() {
      this.ps.forEach((p, i) => { if (!p.out) p.worth.push(this.worth(i)); });
      this.round++;
      if (this.quick && this.round > this.mRounds) { this.finish('rounds'); return; }
      if (!this.quick && this.round > FULL_CAP) this.finish('rounds');
    }
    checkEnd() {
      const al = this.alive();
      if (al.length <= 1) { this.finish('last'); return true; }
      if (this.quick && this.outCount >= 2) { this.finish('bankrupt2'); return true; }
      if (this.turns > MAX_TURNS) { this.finish('rounds'); return true; }
      return false;
    }
    roll() {
      const d = [U.randi(1, 6), U.randi(1, 6)];
      this.dice = d;
      this.diceYaw = [U.rand(-0.6, 0.6), U.rand(-0.6, 0.6)]; this.rolled = true;
      Sfx.play('pull');
      // lắc ROLL giây rồi dừng, hiện kết quả thêm DICE_HOLD giây cho mọi người kịp nhìn rồi mới đi
      const r = DICE_ROLL * this.speed + (this.humans ? 0.05 : 0.01);
      this.setState({ k: 'dice', d, roll: r, dur: r + (this.humans ? DICE_HOLD * this.speed : 0) });
    }
    afterDice() {
      const i = this.cur, p = this.ps[i], [a, b] = this.dice, sum = a + b, dbl = a === b;
      this.say(`🎲 ${this.name(i)} gieo ${a} + ${b} = ${sum}${dbl ? ' (đôi!)' : ''}`);
      if (p.jail) {
        if (dbl) { p.jail = false; p.jailTurns = 0; this.say(`🔓 ${this.name(i)} gieo được đôi, ra tù`); this.lastDouble = false; this.moveBy(i, sum, () => this.land(i)); return; }
        p.jailTurns++;
        if (p.jailTurns >= 3) {
          this.say(`⏱ ${this.name(i)} hết 3 lượt trong tù — trả ${money(FINE)} rồi đi`);
          this.pay(i, FINE, -1, 'phí ra tù', () => { p.jail = false; p.jailTurns = 0; this.moveBy(i, sum, () => this.land(i)); });
          return;
        }
        this.toPost();
        return;
      }
      if (dbl) {
        this.dbl++;
        if (this.dbl >= 3) { this.say(`🚨 ${this.name(i)} gieo đôi 3 lần liền — vào tù!`); this.lastDouble = false; this.sendJail(i, () => this.toPost()); return; }
      }
      this.lastDouble = dbl;
      this.moveBy(i, sum, () => this.land(i));
    }
    moveBy(i, n, done) { this.setState({ k: 'move', who: i, left: n, dir: 1, go: true, done }); }
    moveBack(i, n, done) { this.setState({ k: 'move', who: i, left: n, dir: -1, go: false, done: () => this.land(i, {}, done) }); }
    moveTo(i, target, go, done) {
      const n = (target - this.ps[i].pos + 40) % 40;
      if (!n) { this.land(i, {}, done); return; }
      this.setState({ k: 'move', who: i, left: n, dir: 1, go, fast: true, done: () => this.land(i, {}, done) });
    }
    /** bay một cú thẳng tới ô t (không đi từng ô, không qua Khởi hành) rồi xử lý ô */
    jumpTo(i, t, done) {
      const p = this.ps[i], from = p.pos, d = 0.9 * this.speed + 0.05;
      p.pos = t;
      this.hop = { i, from, to: t, t: 0, dur: d, air: d * 0.8, high: true };
      Sfx.play('jump');
      this.setState({ k: 'wait', dur: d + 0.3 * this.speed, done: () => this.land(i, {}, done) });
    }
    toNearest(i, kind, done) {
      const list = kind === 'air' ? AIRS : UTILS, pos = this.ps[i].pos;
      const target = list.find((t) => t > pos) ?? list[0];
      const n = (target - pos + 40) % 40;
      this.setState({ k: 'move', who: i, left: n, dir: 1, go: true, fast: true, done: () => this.land(i, kind === 'air' ? { double: true } : { ten: true }, done) });
    }
    sendJail(i, done) {
      const p = this.ps[i];
      p.pos = JAIL; p.jail = true; p.jailTurns = 0;
      this.lastDouble = false;
      Sfx.play('warn'); FX.shake(4);
      this.say(`👮 ${this.name(i)} vào tù`);
      Party.rumble(i, 0.5, 200);
      done();
    }
    stepMove() {
      // s.t đã được update() cộng dt — trước đây cộng thêm lần nữa ở đây nên quân đi nhanh gấp đôi con số cài đặt
      const s = this.st, p = this.ps[s.who];
      const hopT = (s.fast ? HOP_FAST : HOP_T) * this.speed + (this.humans ? 0.01 : 0.002);
      // bước đầu tiên nhảy ngay, không đứng chờ hết một nhịp
      if (!s.began) { s.began = true; s.t = hopT; }
      // bước cuối xong: đứng yên một nhịp cho mọi người thấy quân dừng ở đâu rồi mới xử lý ô
      if (s.left <= 0) { if (s.t >= hopT + LAND_PAUSE * this.speed) s.done(); return; }
      if (s.t < hopT) return;
      s.t -= hopT;                       // giữ phần dư để nhịp các bước đều nhau
      const from = p.pos;
      p.pos = (p.pos + s.dir + 40) % 40;
      // nhảy trong HOP_AIR phần đầu của nhịp, phần còn lại đứng trên ô (nhún nhẹ khi chạm đất)
      this.hop = { i: s.who, from, to: p.pos, t: 0, dur: hopT, air: hopT * HOP_AIR };
      Sfx.tone(380 + (s.left % 4) * 40, 0.04, 'sine', 0.05);
      if (s.dir > 0 && p.pos === 0 && s.go) { this.transfer(-1, s.who, GO_CASH); this.say(`🏁 ${this.name(s.who)} qua Khởi hành, nhận ${money(GO_CASH)}`); }
      s.left--;
    }
    /** xử lý ô vừa dừng; done() mặc định là sang bước sau lượt */
    land(i, opts = {}, done) {
      done = done || (() => this.toPost());
      const t = this.ps[i].pos, d = TILES[t];
      if (d.buy) {
        const o = this.own[t];
        if (o < 0) { this.setState({ k: 'buy', who: i, tile: t, done }); return; }
        if (o === i) { done(); return; }
        if (this.mort[t]) { this.say(`🏚️ ${d.name} đang thế chấp — không phải trả tiền`); done(); return; }
        if (d.t === 'util' && opts.ten) {
          const r = [U.randi(1, 6), U.randi(1, 6)];
          this.dice = r;
          const amt = this.rentOf(t, r[0] + r[1], opts);
          this.say(`🎲 gieo ${r[0]} + ${r[1]} → trả 10× = ${money(amt)}`);
          this.payRent(i, o, amt, d, done);
          return;
        }
        this.payRent(i, o, this.rentOf(t, this.dice[0] + this.dice[1], opts), d, done);
        return;
      }
      if (d.t === 'tax') { this.say(`💸 ${this.name(i)} nộp ${d.name} ${money(d.amt)}`); this.pay(i, d.amt, -1, d.name, done); return; }
      if (d.t === 'chance' || d.t === 'chest') { this.drawCard(i, d.t, done); return; }
      if (d.t === 'gojail') { this.sendJail(i, done); return; }
      done();
    }
    payRent(i, o, amt, d, done) {
      this.say(`🏠 ${this.name(i)} trả ${this.name(o)} ${money(amt)} tiền thuê ${d.name}`);
      if (this.lvl[d.i] >= 3) FX.shake(3);
      this.pay(i, amt, o, `thuê ${d.name}`, done);
    }
    drawCard(i, deck, done) {
      const dk = this.decks[deck], k = dk.shift(), c = (deck === 'chance' ? CHANCE : CHEST)[k];
      if (!c.keep) dk.push(k);
      Sfx.play('select');
      const title = c.title.replace('{name}', this.name(i));
      this.say(`${deck === 'chance' ? '❓' : '🎁'} ${this.name(i)} — ${title}: ${c.text}`);
      this.setState({ k: 'card', who: i, deck, card: c, title, idx: k, done });
    }
    applyCard() {
      const s = this.st;
      s.card.fn(this, s.who, s.done);
    }
    toPost() {
      if (this.ps[this.cur].out) { this.nextTurn(); return; }
      this.setState({ k: 'post' });
    }
    endTurn() {
      const p = this.ps[this.cur];
      if (this.lastDouble && !p.jail && !p.out) { this.lastDouble = false; this.say(`🎲 ${this.name(this.cur)} được gieo tiếp (đôi)`); this.setState({ k: 'pre', again: true }); return; }
      this.nextTurn();
    }

    /* ---------- mua / đấu giá ---------- */
    buy(i, t, price) {
      this.transfer(i, -1, price);
      this.own[t] = i;
      Sfx.play('crown');
      const r = this.tileScr(t);
      this.api.parts.burst(r.x, r.y, [this.players[i].color.main, '#ffe14d'], 16, 200, 0.6, 5);
      this.say(`🏷️ ${this.name(i)} mua ${TILES[t].name} giá ${money(price)}`);
    }
    startAuction(t, done) {
      this.say(`🔨 Đấu giá ${TILES[t].name}`);
      const bots = {};
      this.alive().forEach((j) => { if (this.players[j].bot) bots[j] = { max: this.botValue(j, t), wait: U.rand(0.8, 2.0) }; });
      this.setState({ k: 'auction', tile: t, bid: 0, who: -1, left: AUCTION_T, bots, done });
    }
    bidAuction(j, inc) {
      const s = this.st, nb = s.bid + inc;
      const can = this.players[j].bot && this.level(j) !== 'easy' && s.bots[j] && s.bots[j].max > this.ps[j].cash ? this.spare(j) - 20 : this.ps[j].cash;
      if (this.ps[j].out || can < nb || s.who === j) return false; // không tự trả giá đè lên mình
      s.bid = nb; s.who = j; s.left = AUCTION_T;
      Sfx.play('tick', 0.03);
      this.floats.push({ x: this.cardXY(j).fx, y: this.cardXY(j).y - 18, s: money(nb), c: '#ffe14d', t: 0 });
      return true;
    }
    updateAuction(dt, inp) {
      const s = this.st;
      s.left -= dt / Math.max(this.humans ? 0.35 : 0.02, this.speed);
      for (const j of this.alive()) {
        const p = this.players[j];
        if (p.bot) {
          const b = s.bots[j];
          b.wait -= dt / Math.max(this.humans ? 0.1 : 0.02, this.speed);
          if (b.wait <= 0 && s.who !== j) {
            b.wait = U.rand(0.6, 1.8);
            const inc = b.max - s.bid > 150 && Math.random() < 0.4 ? 50 : 10;
            if (s.bid + inc <= b.max) this.bidAuction(j, inc);
          }
        } else {
          const q = inp[j] || {};
          if (q.actP) this.bidAuction(j, 10);
          if (q.jumpP) this.bidAuction(j, 50);
        }
      }
      if (s.left <= 0) {
        if (s.who >= 0 && this.ps[s.who].cash < s.bid) this.botRaise(s.who, s.bid); // máy Khó thế chấp để trả
        if (s.who >= 0 && this.ps[s.who].cash >= s.bid) this.buy(s.who, s.tile, s.bid);
        else this.say(`🔨 Không ai trả giá — ${TILES[s.tile].name} vẫn của ngân hàng`);
        s.done();
      }
    }

    /* ---------- nhà, thế chấp ---------- */
    canBuild(i, t) {
      const d = TILES[t];
      if (d.t !== 'city' || this.own[t] !== i || !this.groupOwned(d.g, i)) return { ok: false };
      const G = GROUP_TILES[d.g];
      if (G.some((x) => this.mort[x])) return { ok: false, why: 'Nhóm có ô thế chấp' };
      const l = this.lvl[t];
      if (l === 5) return { ok: false, why: 'Đã có khách sạn' };
      const min = Math.min(...G.map((x) => this.lvl[x]));
      if (l > min) return { ok: false, why: 'Phải xây đều các ô trong nhóm' };
      const toHotel = l === this.hotelAt;
      if (toHotel && G.some((x) => this.lvl[x] < this.hotelAt)) return { ok: false, why: 'Phải xây đều các ô trong nhóm' };
      if (toHotel && this.hotelsLeft <= 0) return { ok: false, why: 'Ngân hàng hết khách sạn' };
      if (!toHotel && this.housesLeft <= 0) return { ok: false, why: 'Ngân hàng hết nhà' };
      if (this.ps[i].cash < d.hc) return { ok: false, why: 'Không đủ tiền' };
      return { ok: true, cost: d.hc, hotel: toHotel };
    }
    build(i, t) {
      const c = this.canBuild(i, t);
      if (!c.ok) return false;
      const d = TILES[t];
      this.transfer(i, -1, d.hc);
      if (c.hotel) { this.lvl[t] = 5; this.hotelsLeft--; this.housesLeft += this.hotelAt; } else { this.lvl[t]++; this.housesLeft--; }
      const r = this.tileScr(t);
      this.api.parts.burst(r.x, r.y, c.hotel ? ['#e74c3c', '#ffe14d'] : ['#2ecc71', '#fff'], 14, 180, 0.6, 5);
      Sfx.play('place');
      this.say(`🏗️ ${this.name(i)} xây ${c.hotel ? 'khách sạn' : 'nhà'} ở ${d.name}`);
      return true;
    }
    canSell(i, t) {
      const d = TILES[t];
      if (d.t !== 'city' || this.own[t] !== i || this.lvl[t] === 0) return { ok: false };
      const G = GROUP_TILES[d.g], max = Math.max(...G.map((x) => this.lvl[x]));
      if (this.lvl[t] < max) return { ok: false, why: 'Phải bán đều các ô trong nhóm' };
      if (this.lvl[t] === 5 && this.housesLeft < this.hotelAt) return { ok: false, why: 'Ngân hàng hết nhà để đổi' };
      return { ok: true, gain: d.hc / 2 };
    }
    sell(i, t) {
      const c = this.canSell(i, t);
      if (!c.ok) return false;
      const d = TILES[t];
      if (this.lvl[t] === 5) { this.lvl[t] = this.hotelAt; this.hotelsLeft++; this.housesLeft -= this.hotelAt; } else { this.lvl[t]--; this.housesLeft++; }
      this.transfer(-1, i, c.gain);
      Sfx.play('leave');
      this.say(`🔻 ${this.name(i)} bán bớt nhà ở ${d.name} (+${money(c.gain)})`);
      return true;
    }
    canMortgage(i, t) {
      const d = TILES[t];
      if (this.own[t] !== i || this.mort[t]) return { ok: false };
      if (d.t === 'city' && GROUP_TILES[d.g].some((x) => this.lvl[x] > 0)) return { ok: false, why: 'Bán hết nhà trong nhóm trước' };
      return { ok: true, gain: d.price / 2 };
    }
    mortgage(i, t) {
      const c = this.canMortgage(i, t);
      if (!c.ok) return false;
      this.mort[t] = true;
      this.transfer(-1, i, c.gain);
      this.say(`🏚️ ${this.name(i)} thế chấp ${TILES[t].name} (+${money(c.gain)})`);
      return true;
    }
    unmortCost(t) { return Math.ceil(TILES[t].price / 2 * 1.1); }
    canUnmort(i, t) {
      if (this.own[t] !== i || !this.mort[t]) return { ok: false };
      const cost = this.unmortCost(t);
      if (this.ps[i].cash < cost) return { ok: false, why: 'Không đủ tiền', cost };
      return { ok: true, cost };
    }
    unmortgage(i, t) {
      const c = this.canUnmort(i, t);
      if (!c.ok) return false;
      this.mort[t] = false;
      this.transfer(i, -1, c.cost);
      this.say(`🔑 ${this.name(i)} chuộc lại ${TILES[t].name} (−${money(c.cost)})`);
      return true;
    }
    /** tổng tiền có thể gom được nếu bán hết nhà + thế chấp hết */
    liquid(i) {
      let v = this.ps[i].cash;
      for (let t = 0; t < 40; t++) {
        if (this.own[t] !== i) continue;
        const d = TILES[t];
        if (d.t === 'city') v += (this.lvl[t] === 5 ? this.hotelAt + 1 : this.lvl[t]) * d.hc / 2;
        if (!this.mort[t]) v += d.price / 2;
      }
      return v;
    }

    /* ---------- nợ & phá sản ---------- */
    settleDebt() {
      const s = this.st;
      if (this.ps[s.who].cash < s.amt) return false;
      this.transfer(s.who, s.to, s.amt);
      this.say(`✅ ${this.name(s.who)} đã trả ${money(s.amt)}`);
      s.done();
      return true;
    }
    bankrupt(i, to) {
      const p = this.ps[i];
      p.out = true; this.outCount++; p.outAt = this.round;
      p.outOrder = this.outCount;
      this.say(`💥 ${this.name(i)} PHÁ SẢN${to >= 0 ? ` — mọi tài sản về tay ${this.name(to)}` : ''}`);
      Sfx.play('boom'); FX.shake(8);
      Party.rumble(i, 0.9, 400);
      // nhà / khách sạn bán lại ngân hàng (nửa giá) trước
      for (let t = 0; t < 40; t++) {
        if (this.own[t] !== i || TILES[t].t !== 'city' || !this.lvl[t]) continue;
        const l = this.lvl[t];
        p.cash += (l === 5 ? this.hotelAt + 1 : l) * TILES[t].hc / 2;
        if (l === 5) this.hotelsLeft++; else this.housesLeft += l;
        this.lvl[t] = 0;
      }
      for (let t = 0; t < 40; t++) {
        if (this.own[t] !== i) continue;
        if (to >= 0) this.own[t] = to;
        else { this.own[t] = -1; this.mort[t] = false; }
      }
      if (to >= 0) { if (p.cash > 0) this.transfer(i, to, p.cash); this.ps[to].cards.push(...p.cards); }
      else { p.cards.forEach((d) => { const k = (d === 'chance' ? CHANCE : CHEST).findIndex((c) => c.keep); this.decks[d].push(k); }); }
      p.cash = 0; p.cards = [];
    }

    /* ---------- vòng lặp ---------- */
    update(dt, inp) {
      this.t += dt;
      this.floats = this.floats.filter((f) => (f.t += dt) < FLOAT_T);
      this.coins = this.coins.filter((c) => (c.t += dt) < c.dur);
      if (this.hop) { this.hop.t += dt; if (this.hop.t >= this.hop.dur) this.hop = null; }
      if (this.press) { this.press.t += dt; if (this.press.t > 0.3) this.press = null; }
      if (this.turnFx) { this.turnFx.t += dt; if (this.turnFx.t > TURN_FX_T) this.turnFx = null; }
      if (this.finished) return;
      const s = this.st;
      s.t += dt;
      switch (s.k) {
        case 'start':
          if (this.saved) { this.setState({ k: 'resume' }); break; }
          this.cur = 0; this.say(`🌏 Bắt đầu ${this.quick ? `ván nhanh (${this.mRounds} vòng)` : 'ván đầy đủ'} — mỗi người ${money(START_CASH)}`);
          if (this.quick) this.say('🎁 Mỗi người được chia sẵn 2 thành phố');
          this.startTurn();
          return;
        case 'dice':
          if (!s.landed && s.t >= s.roll) { s.landed = true; Sfx.play('place'); if (this.dice[0] === this.dice[1]) Sfx.play('pickup'); }
          if (s.t >= s.dur) this.afterDice();
          return;
        case 'move': this.stepMove(); return;
        case 'auction': this.updateAuction(dt, inp); return;
        case 'wait': if (s.t >= s.dur) s.done(); return;
      }
      const c = this.controller();
      if (c < 0) return;
      if (this.players[c].bot) { this.botStep(c); return; }
      this.humanStep(c, inp[c] || {}, dt);
    }

    /* ---------- menu cho người thật ---------- */
    items() {
      const s = this.st, i = this.cur, p = this.ps[i];
      const mg = { label: '🏗️ Nhà & thế chấp', fn: () => this.openManage() };
      const tr = { label: '🤝 Giao dịch', fn: () => this.openTrade(), dis: this.alive().length < 2 };
      switch (s.k) {
        case 'resume': return [
          { label: `▶ Chơi tiếp ván đang dở (vòng ${this.saved.round})`, fn: () => this.loadSave() },
          { label: '🆕 Chơi ván mới', fn: () => { this.clearSave(); this.saved = null; this.setState({ k: 'start' }); } },
        ];
        case 'pre': return [{ label: s.again ? '🎲 Gieo tiếp (được đôi)' : '🎲 Gieo xúc xắc', fn: () => this.roll() }, mg, tr];
        case 'jailpre': return [
          { label: `🎲 Gieo tìm đôi (lần ${p.jailTurns + 1}/3)`, fn: () => this.roll() },
          { label: `💵 Trả ${money(FINE)} để ra tù`, fn: () => this.payBail(i), dis: p.cash < FINE },
          { label: `🎫 Dùng thẻ ra tù${p.cards.length ? ` (có ${p.cards.length})` : ''}`, fn: () => this.useCard(i), dis: !p.cards.length },
          mg, tr,
        ];
        case 'buy': {
          const d = TILES[s.tile];
          return [
            { label: `💰 Mua ${d.name} — ${money(d.price)}`, fn: () => { this.buy(s.who, s.tile, d.price); s.done(); }, dis: p.cash < d.price },
            { label: '🔨 Không mua — đem đấu giá', fn: () => this.startAuction(s.tile, s.done) },
            mg,
          ];
        }
        case 'card': return [{ label: '👍 OK', fn: () => this.applyCard() }];
        case 'post': return [{ label: this.lastDouble && !p.jail ? '🎲 Gieo tiếp (được đôi)' : '✅ Kết thúc lượt', fn: () => this.endTurn() }, mg, tr];
        case 'debt': {
          const q = this.ps[s.who];
          return [
            { label: `💸 Trả ${money(s.amt)}${q.cash < s.amt ? ` (còn thiếu ${money(s.amt - q.cash)})` : ''}`, fn: () => this.settleDebt(), dis: q.cash < s.amt },
            { label: '🏗️ Bán nhà / thế chấp để gom tiền', fn: () => this.openManage(s.who) },
            { label: '🏳️ Tuyên bố phá sản', fn: () => this.goBankrupt() },
          ];
        }
      }
      return [];
    }
    payBail(i) {
      const p = this.ps[i];
      this.transfer(i, -1, FINE); p.jail = false; p.jailTurns = 0;
      this.say(`💵 ${this.name(i)} trả ${money(FINE)} ra tù`);
      this.setState({ k: 'pre' });
    }
    useCard(i) {
      const p = this.ps[i], d = p.cards.shift();
      this.decks[d].push((d === 'chance' ? CHANCE : CHEST).findIndex((c) => c.keep));
      p.jail = false; p.jailTurns = 0;
      this.say(`🎫 ${this.name(i)} dùng thẻ ra tù miễn phí`);
      this.setState({ k: 'pre' });
    }
    goBankrupt() {
      const s = this.st;
      this.bankrupt(s.who, s.to);
      if (s.who === this.cur) { this.setState({ k: 'wait', dur: WAIT_T * this.speed + 0.1, done: () => this.nextTurn() }); return; }
      // chủ nợ đang trong lượt người khác (vd. mừng sinh nhật): tiếp tục lượt đó
      if (this.checkEnd()) return;
      s.done();
    }
    humanStep(c, q, dt) {
      const s = this.st;
      if (s.k === 'manage') { this.manageInput(c, q, dt); return; }
      if (s.k === 'trade') { this.tradeInput(c, q, dt); return; }
      const its = this.items();
      if (!its.length) return;
      const st = this.rep[c].step(q, dt);
      if (st && st.dy) {
        let k = s.sel;
        for (let n = 0; n < its.length; n++) { k = (k + st.dy + its.length) % its.length; if (!its[k].dis) break; }
        s.sel = k; Sfx.play('move', 0.05);
      }
      if (its[s.sel] && its[s.sel].dis) { const k = its.findIndex((x) => !x.dis); if (k >= 0) s.sel = k; }
      if (q.actP && its[s.sel] && !its[s.sel].dis) { Sfx.play('select'); this.pressFx(this.selRect); its[s.sel].fn(); }
    }

    /* ---------- màn quản lý tài sản (MON5) ---------- */
    openManage(who) {
      const i = who ?? this.cur;
      const mine = BUYABLE.filter((t) => this.own[t] === i);
      this.setState({ k: 'manage', who: i, back: this.st, cursor: mine.length ? mine[0] : BUYABLE[0], sel: 0 });
    }
    manageActions(i, t) {
      if (this.own[t] !== i) return [];
      const d = TILES[t], out = [];
      if (d.t === 'city') {
        const b = this.canBuild(i, t), sl = this.canSell(i, t);
        const nextHotel = this.lvl[t] === this.hotelAt;
        out.push({ label: `🏠 Xây ${nextHotel ? 'khách sạn' : 'nhà'} (−${money(d.hc)})`, fn: () => this.build(i, t), dis: !b.ok, why: b.why || (!this.groupOwned(d.g, i) ? 'Cần sở hữu cả nhóm màu' : '') });
        out.push({ label: `🔻 Bán ${this.lvl[t] === 5 ? 'khách sạn' : 'nhà'} (+${money(d.hc / 2)})`, fn: () => this.sell(i, t), dis: !sl.ok, why: sl.why || '' });
      }
      const m = this.canMortgage(i, t), u = this.canUnmort(i, t);
      if (!this.mort[t]) out.push({ label: `🏚️ Thế chấp (+${money(d.price / 2)})`, fn: () => this.mortgage(i, t), dis: !m.ok, why: m.why || '' });
      else out.push({ label: `🔑 Chuộc lại (−${money(this.unmortCost(t))})`, fn: () => this.unmortgage(i, t), dis: !u.ok, why: u.why || '' });
      return out;
    }
    closeManage() {
      const b = this.st.back;
      this.st = b; this.st.t = 0;
      if (b.k === 'debt' && this.ps[b.who].cash >= b.amt) b.sel = 0;
    }
    manageInput(c, q, dt) {
      const s = this.st, mine = BUYABLE.filter((t) => this.own[t] === s.who);
      const st = this.rep[c].step(q, dt);
      if (st && st.dx && mine.length) {
        const k = mine.indexOf(s.cursor);
        s.cursor = mine[(k + st.dx + mine.length) % mine.length];
        s.sel = 0; Sfx.play('move', 0.05);
      }
      const acts = this.manageActions(s.who, s.cursor);
      if (st && st.dy && acts.length) { s.sel = (s.sel + st.dy + acts.length + 1) % (acts.length + 1); Sfx.play('move', 0.05); }
      if (q.actP) {
        if (s.sel >= acts.length) { this.closeManage(); Sfx.play('leave'); return; }
        const a = acts[s.sel];
        if (a && !a.dis) { this.pressFx(this.selRect); a.fn(); } else Sfx.tone(180, 0.08, 'square', 0.06);
        return;
      }
      if (q.jumpP) { this.closeManage(); Sfx.play('leave'); }
    }

    /* ---------- giao dịch (MON6) ---------- */
    tradeable(i) {
      return BUYABLE.filter((t) => this.own[t] === i && !(TILES[t].t === 'city' && GROUP_TILES[TILES[t].g].some((x) => this.lvl[x] > 0)));
    }
    openTrade(from, to) {
      const a = from ?? this.cur, others = this.alive().filter((j) => j !== a);
      if (!others.length) return;
      this.setState({ k: 'trade', step: to == null ? 'partner' : 'edit', a, b: to ?? others[0], back: this.st,
        give: { props: [], cash: 0, card: 0 }, get: { props: [], cash: 0, card: 0 }, col: 0, row: 0, sel: 0 });
    }
    tradeRows(side) { // side 0 = người đề nghị (a), 1 = đối tác (b)
      const s = this.st, who = side ? s.b : s.a, rows = [{ k: 'cash' }];
      if (this.ps[who].cards.length) rows.push({ k: 'card' });
      this.tradeable(who).forEach((t) => rows.push({ k: 'prop', t }));
      rows.push({ k: side ? 'cancel' : 'send' });
      return rows;
    }
    tradeValid() {
      const s = this.st, A = this.ps[s.a], B = this.ps[s.b];
      if (!s.give.props.length && !s.get.props.length && !s.give.cash && !s.get.cash && !s.give.card && !s.get.card) return { ok: false, why: 'Chưa chọn gì để trao đổi' };
      if (s.give.cash > A.cash) return { ok: false, why: `${this.name(s.a)} không đủ tiền` };
      if (s.get.cash > B.cash) return { ok: false, why: `${this.name(s.b)} không đủ tiền` };
      // nhận đất thế chấp phải trả ngay 10%
      const fee = (props) => props.filter((t) => this.mort[t]).reduce((x, t) => x + Math.ceil(TILES[t].price / 2 * 0.1), 0);
      const fa = fee(s.get.props), fb = fee(s.give.props);
      if (A.cash - s.give.cash + s.get.cash < fa) return { ok: false, why: `${this.name(s.a)} không đủ trả phí đất thế chấp` };
      if (B.cash - s.get.cash + s.give.cash < fb) return { ok: false, why: `${this.name(s.b)} không đủ trả phí đất thế chấp` };
      return { ok: true, fa, fb };
    }
    tradeInput(c, q, dt) {
      const s = this.st;
      const st = this.rep[c].step(q, dt);
      if (s.step === 'partner') {
        const others = this.alive().filter((j) => j !== s.a);
        if (st && (st.dy || st.dx)) { s.sel = (s.sel + (st.dy || st.dx) + others.length + 1) % (others.length + 1); Sfx.play('move', 0.05); }
        if (q.actP) {
          if (s.sel >= others.length) { this.cancelTrade(); return; }
          s.b = others[s.sel]; s.step = 'edit'; s.col = 0; s.row = 0; Sfx.play('select');
          return;
        }
        if (q.jumpP) this.cancelTrade();
        return;
      }
      if (s.step === 'edit') {
        const rows = this.tradeRows(s.col), r = rows[s.row];
        if (st && st.dy) { s.row = (s.row + st.dy + rows.length) % rows.length; Sfx.play('move', 0.05); }
        if (st && st.dx) {
          if (r && r.k === 'cash') {
            const pack = s.col ? s.get : s.give, maxc = this.ps[s.col ? s.b : s.a].cash;
            pack.cash = U.clamp(pack.cash + st.dx * (pack.cash >= 200 ? 50 : 10), 0, Math.floor(maxc / 10) * 10);
            Sfx.play('tick', 0.03);
          } else { s.col = s.col ? 0 : 1; s.row = Math.min(s.row, this.tradeRows(s.col).length - 1); Sfx.play('move', 0.05); }
        }
        if (q.actP && r) { this.tradeToggle(s.col, r); return; } // có thể đã gửi / huỷ → trạng thái đổi
        if (q.jumpP) this.cancelTrade();
        return;
      }
      if (s.step === 'answer') {
        if (st && st.dy) { s.sel = s.sel ? 0 : 1; Sfx.play('move', 0.05); }
        if (q.actP) { this.answerTrade(s.sel === 0); return; }
        if (q.jumpP) this.answerTrade(false);
      }
    }
    tradeToggle(col, r) {
      const s = this.st, pack = col ? s.get : s.give;
      if (r.k === 'prop') {
        const k = pack.props.indexOf(r.t);
        if (k >= 0) pack.props.splice(k, 1); else pack.props.push(r.t);
        Sfx.play('select');
      } else if (r.k === 'card') { pack.card = pack.card ? 0 : 1; Sfx.play('select'); }
      else if (r.k === 'cash') { /* đổi bằng ← → */ }
      else if (r.k === 'send') this.sendTrade();
      else if (r.k === 'cancel') this.cancelTrade();
    }
    cancelTrade() {
      const b = this.st.back;
      Sfx.play('leave');
      this.st = b; this.st.t = 0;
    }
    describeTrade(s) {
      const part = (pk) => {
        const bits = pk.props.map((t) => TILES[t].name + (this.mort[t] ? ' (thế chấp)' : ''));
        if (pk.cash) bits.push(money(pk.cash));
        if (pk.card) bits.push('thẻ ra tù');
        return bits.length ? bits.join(', ') : 'không gì';
      };
      return { give: part(s.give), get: part(s.get) };
    }
    sendTrade() {
      const s = this.st, v = this.tradeValid();
      if (!v.ok) { Sfx.tone(180, 0.08, 'square', 0.06); s.err = v.why; s.errT = 2; return; }
      const d = this.describeTrade(s);
      this.say(`🤝 ${this.name(s.a)} đề nghị ${this.name(s.b)}: đưa ${d.give} — lấy ${d.get}`);
      if (this.players[s.b].bot) {
        const ok = this.botAccept(s.b, s);
        this.say(ok ? `✅ ${this.name(s.b)} đồng ý` : `❌ ${this.name(s.b)} từ chối`);
        if (ok) this.applyTrade(s);
        this.setState({ k: 'wait', dur: WAIT_T * Math.max(0.3, this.speed), done: () => { this.st = s.back; this.st.t = 0; } });
        return;
      }
      s.step = 'answer'; s.sel = 0; Sfx.play('warn');
    }
    answerTrade(ok) {
      const s = this.st;
      this.say(ok ? `✅ ${this.name(s.b)} đồng ý giao dịch` : `❌ ${this.name(s.b)} từ chối`);
      if (ok) this.applyTrade(s);
      this.st = s.back; this.st.t = 0;
    }
    applyTrade(s) {
      const v = this.tradeValid();
      if (!v.ok) return;
      const A = this.ps[s.a], B = this.ps[s.b];
      if (s.give.cash) this.transfer(s.a, s.b, s.give.cash);
      if (s.get.cash) this.transfer(s.b, s.a, s.get.cash);
      s.give.props.forEach((t) => { this.own[t] = s.b; });
      s.get.props.forEach((t) => { this.own[t] = s.a; });
      if (s.give.card && A.cards.length) B.cards.push(A.cards.shift());
      if (s.get.card && B.cards.length) A.cards.push(B.cards.shift());
      if (v.fa) this.transfer(s.a, -1, v.fa);
      if (v.fb) this.transfer(s.b, -1, v.fb);
      Sfx.play('crown');
    }

    /* ---------- máy (MON8) ---------- */
    reserve(i) {
      const lv = this.level(i), late = this.round > 8;
      if (lv === 'easy') return 20;
      // đối thủ có nhà càng nhiều thì giữ tiền dự phòng càng lớn
      let danger = 0;
      for (let t = 0; t < 40; t++) if (this.own[t] >= 0 && this.own[t] !== i) danger = Math.max(danger, this.rentOf(t, 7));
      // ván nhanh tính tổng tài sản: tiền mua đất/nhà vẫn tính vào tài sản → máy giỏi giữ ít tiền mặt hơn
      if (this.quick) return lv === 'normal' ? 50 : Math.min(180, 20 + danger * 0.2);
      return lv === 'normal' ? 120 : Math.min(320, (late ? 90 : 50) + danger * 0.4);
    }
    /** ô t có làm i đủ nhóm / chặn người khác đủ nhóm không */
    setInfo(i, t) {
      const d = TILES[t];
      if (d.t !== 'city') return { completes: d.t === 'air' && this.airsOf(i) >= 2, blocks: false };
      const G = GROUP_TILES[d.g];
      const mine = G.filter((x) => x !== t && this.own[x] === i).length;
      const others = {};
      G.forEach((x) => { if (x !== t && this.own[x] >= 0 && this.own[x] !== i) others[this.own[x]] = (others[this.own[x]] || 0) + 1; });
      return { completes: mine === G.length - 1, blocks: Object.values(others).some((c) => c === G.length - 1) };
    }
    botValue(i, t) {
      const d = TILES[t], lv = this.level(i), si = this.setInfo(i, t);
      let v = d.price;
      // ván nhanh tính tài sản theo giá gốc: trả quá giá là lỗ, chỉ đáng khi đủ nhóm còn nhiều vòng thu tiền
      const left = this.quick ? this.mRounds - this.round : 99;
      const kc = this.quick ? (left > 6 ? 1.3 : 1.05) : 1.8, kb = this.quick ? 1.1 : lv === 'hard' ? 1.5 : 1.2;
      if (si.completes) v *= lv === 'easy' ? 1.2 : kc;
      else if (si.blocks) v *= kb;
      if (lv === 'easy') v *= U.rand(0.5, 1.4);
      else if (lv === 'hard' && !this.quick) v *= 1.1;
      const purse = (lv === 'hard' && (this.quick || si.completes || si.blocks)) || (lv === 'normal' && this.quick) ? this.spare(i) - 20 : this.ps[i].cash - (lv === 'easy' ? 0 : Math.min(this.reserve(i), this.quick ? 40 : 120));
      return Math.max(0, Math.min(v, purse));
    }
    /** tiền mặt + tiền thế chấp được từ các ô lẻ (không thuộc nhóm đủ bộ) */
    spare(i) {
      let v = this.ps[i].cash;
      for (const t of BUYABLE) {
        if (this.own[t] !== i || this.mort[t]) continue;
        const d = TILES[t];
        if (d.t === 'city' && this.groupOwned(d.g, i)) continue;
        v += d.price / 2;
      }
      return v;
    }
    botWantsBuy(i, t) {
      const d = TILES[t], p = this.ps[i], lv = this.level(i), si = this.setInfo(i, t);
      // máy Khó: thiếu tiền mặt thì thế chấp ô lẻ để mua (không để đối thủ đấu giá rẻ)
      if (p.cash < d.price && lv !== 'easy' && this.spare(i) >= d.price + 20 && (this.quick || (lv === 'hard' && (si.completes || si.blocks)))) return true;
      if (p.cash < d.price) return false;
      if (lv === 'easy') return Math.random() < 0.72; // máy Dễ: mua bừa, bỏ lỡ ô ngon
      if (lv === 'hard') {
        // máy Khó: đối thủ không đủ tiền tranh thì bỏ mua để đấu giá rẻ hơn
        const rich = Math.max(0, ...this.alive().filter((j) => j !== i).map((j) => this.ps[j].cash));
        if (rich + 20 < d.price * 0.8 && p.cash >= rich + 20 && !si.completes) return false;
      }
      if ((si.completes || si.blocks) && p.cash - d.price >= (this.quick ? 0 : 30)) return true;
      return p.cash - d.price >= this.reserve(i);
    }
    botBuild(i) {
      const lv = this.level(i), free = BUYABLE.filter((t) => this.own[t] < 0).length;
      if (lv === 'easy' && Math.random() < 0.5) return; // máy Dễ hay quên xây
      // còn nhiều ô chưa có chủ thì giữ tiền để mua đất trước (đất bị bỏ qua sẽ bị người khác đấu giá rẻ)
      const res = lv === 'easy' ? 0 : Math.max(this.reserve(i) * 0.5, free > 6 ? 150 : free > 2 ? 70 : 0);
      let guard = 0;
      for (;;) {
        if (guard++ > 30) return;
        const cands = [];
        for (let t = 0; t < 40; t++) {
          const c = this.canBuild(i, t);
          if (c.ok && this.ps[i].cash - c.cost >= res) cands.push(t);
        }
        if (!cands.length) return;
        let pick;
        if (lv === 'easy') pick = U.pick(cands);
        else {
          // ưu tiên lên tới 3 nhà (lợi nhất), rồi nhóm tiền thuê cao
          cands.sort((a, b) => (this.lvl[a] < 3 ? 0 : 1) - (this.lvl[b] < 3 ? 0 : 1) || TILES[b].rents[Math.min(5, this.lvl[b] + 1)] / TILES[b].hc - TILES[a].rents[Math.min(5, this.lvl[a] + 1)] / TILES[a].hc);
          pick = cands[0];
        }
        if (!this.build(i, pick)) return;
        if (lv === 'easy') return; // máy Dễ: mỗi lượt xây tối đa 1 căn
      }
    }
    botUnmortgage(i) {
      const res = this.reserve(i) * 2;
      for (let t = 0; t < 40; t++) {
        if (this.own[t] === i && this.mort[t] && this.ps[i].cash - this.unmortCost(t) >= res) this.unmortgage(i, t);
      }
    }
    /** gom tiền tới `need`: thế chấp ô lẻ trước, rồi bán nhà, rồi thế chấp ô trong nhóm */
    botRaise(i, need) {
      let guard = 0;
      while (this.ps[i].cash < need && guard++ < 80) {
        const mine = BUYABLE.filter((t) => this.own[t] === i);
        const single = mine.filter((t) => this.canMortgage(i, t).ok && !(TILES[t].t === 'city' && this.groupOwned(TILES[t].g, i)));
        if (single.length) { single.sort((a, b) => TILES[a].price - TILES[b].price); this.mortgage(i, single[0]); continue; }
        const sellable = mine.filter((t) => this.canSell(i, t).ok);
        if (sellable.length) { sellable.sort((a, b) => TILES[a].hc - TILES[b].hc); this.sell(i, sellable[0]); continue; }
        const rest = mine.filter((t) => this.canMortgage(i, t).ok);
        if (rest.length) { rest.sort((a, b) => TILES[a].price - TILES[b].price); this.mortgage(i, rest[0]); continue; }
        break;
      }
      return this.ps[i].cash >= need;
    }
    /** máy i có nhận đề nghị s không. guess = người đề nghị đoán (không có yếu tố ngẫu nhiên) */
    botAccept(i, s, guess) {
      const lv = this.players[i].bot ? this.level(i) : 'normal', me = i, other = s.a;
      const prm = { easy: [0.4, 0.4, -30], normal: [1, 1, 0], hard: [1.4, 1.6, 40] }[lv];
      const val = (t, owner, forWho) => {
        const d = TILES[t];
        let v = this.mort[t] ? d.price / 2 : d.price;
        const si = this.setInfoAfter(forWho, t, s);
        if (si) v += d.price * (forWho === me ? prm[0] : prm[1]);
        return v;
      };
      let get = s.give.cash + s.give.card * 50, give = s.get.cash + s.get.card * 50;
      s.give.props.forEach((t) => { get += val(t, other, me); });
      s.get.props.forEach((t) => { give += val(t, me, other); });
      // phá nhóm màu đang đủ của mình
      s.get.props.forEach((t) => { const d = TILES[t]; if (d.t === 'city' && this.groupOwned(d.g, me)) give += d.price * prm[0]; });
      if (this.ps[me].cash - s.get.cash < 40) return false;
      const noise = guess || lv !== 'easy' ? 0 : U.rand(-60, 60);
      return get - give + noise >= prm[2];
    }
    /** sau giao dịch, người `who` có đủ nhóm của ô t không */
    setInfoAfter(who, t, s) {
      const d = TILES[t];
      if (d.t !== 'city') return false;
      const after = (x) => {
        if (s.give.props.includes(x)) return s.b;
        if (s.get.props.includes(x)) return s.a;
        return this.own[x];
      };
      return GROUP_TILES[d.g].every((x) => after(x) === who);
    }
    /** ô còn thiếu duy nhất của nhóm g với người i (null nếu không phải) — nhóm chưa có nhà */
    missingOne(i, g) {
      const G = GROUP_TILES[g];
      if (G.some((x) => this.lvl[x] > 0)) return null;
      const miss = G.filter((x) => this.own[x] !== i);
      if (miss.length !== 1 || G.length - miss.length < 1) return null;
      const t = miss[0], j = this.own[t];
      if (j < 0 || j === i || this.ps[j].out) return null;
      return { t, j };
    }
    /** máy chủ động đề nghị giao dịch để đủ nhóm màu: ưu tiên đổi chéo (cả hai cùng đủ nhóm), không thì trả tiền */
    botTradeIdea(i) {
      const lv = this.level(i);
      if (lv === 'easy') return null;
      for (let g = 0; g < GROUPS.length; g++) {
        const m = this.missingOne(i, g);
        if (!m) continue;
        const key = `${i}-${m.t}`;
        if (this.tradeMemo[key] && this.round - this.tradeMemo[key] < 4) continue;
        this.tradeMemo[key] = this.round;
        let budget = Math.max(0, this.ps[i].cash - this.reserve(i) * 0.5);
        if (this.quick) {
          // ván nhanh: chỉ mua thêm khi còn đủ vòng để thu lại, và không trả quá ~1,4 lần giá
          if (this.mRounds - this.round < 6) continue;
          budget = Math.min(budget, TILES[m.t].price * 1.4);
        } else budget = Math.min(budget, TILES[m.t].price * 2.2);
        // đổi chéo: đối tác cũng đang thiếu đúng 1 ô mà mình giữ
        let swap = null;
        for (let h = 0; h < GROUPS.length && !swap; h++) {
          if (h === g) continue;
          const mj = this.missingOne(m.j, h);
          // chỉ đổi chéo khi nhóm mình nhận mạnh hơn hẳn nhóm trao cho đối thủ
          if (mj && mj.j === i && groupPower(TILES[m.t].g) >= groupPower(h) * 1.25) swap = mj.t;
        }
        // tăng dần tiền bù tới khi (theo mình đoán) đối tác chịu
        const probe = (props, startCash) => {
          for (let cash = startCash; cash <= budget; cash += 20) {
            const s = { a: i, b: m.j, give: { props, cash, card: 0 }, get: { props: [m.t], cash: 0, card: 0 } };
            if (this.botAccept(m.j, s, true)) return cash;
          }
          return -1;
        };
        if (swap != null) {
          const c = probe([swap], 0);
          if (c >= 0) return { t: m.t, j: m.j, give: [swap], offer: c };
        }
        const c = probe([], Math.round(TILES[m.t].price / 10) * 10);
        if (c >= 0) return { t: m.t, j: m.j, give: [], offer: c };
      }
      return null;
    }
    botProposeTrade(i, idea) {
      this.openTrade(i, idea.j);
      const s = this.st;
      s.give.cash = idea.offer; s.give.props = idea.give.slice(); s.get.props = [idea.t];
      const d = this.describeTrade(s);
      this.say(`🤝 ${this.name(i)} đề nghị ${this.name(idea.j)}: đưa ${d.give} — lấy ${d.get}`);
      if (this.players[idea.j].bot) {
        const ok = this.botAccept(idea.j, s);
        this.say(ok ? `✅ ${this.name(idea.j)} đồng ý` : `❌ ${this.name(idea.j)} từ chối`);
        if (ok) this.applyTrade(s);
        this.setState({ k: 'wait', dur: WAIT_T * this.speed + 0.05, done: () => { this.st = s.back; this.st.t = 0; } });
      } else { s.step = 'answer'; s.sel = 0; Sfx.play('warn'); }
    }
    botStep(c) {
      const s = this.st, delay = (s.k === 'card' && this.humans ? CARD_READ : U.rand(BOT_THINK[0], BOT_THINK[1])) * this.speed + 0.02;
      if (s.t < delay) return;
      s.t = -999; // chỉ làm một lần cho mỗi trạng thái
      const p = this.ps[c], lv = this.level(c);
      switch (s.k) {
        case 'resume': this.setState({ k: 'start' }); return;
        case 'pre':
          this.botBuild(c); this.botUnmortgage(c);
          { const idea = this.botTradeIdea(c); if (idea) { this.botProposeTrade(c, idea); return; } }
          this.roll(); return;
        case 'jailpre': {
          const early = BUYABLE.filter((t) => this.own[t] < 0).length > 8;
          const stay = lv === 'hard' ? !early : lv === 'normal' ? this.round > 15 : false;
          if (!stay && p.cards.length) { this.useCard(c); return; }
          if (!stay && p.cash >= FINE + 50) { this.payBail(c); return; }
          this.roll(); return;
        }
        case 'buy':
          if (this.botWantsBuy(c, s.tile)) {
            const pr = TILES[s.tile].price;
            if (p.cash < pr) this.botRaise(c, pr);
            if (p.cash >= pr) { this.buy(c, s.tile, pr); s.done(); return; }
          }
          this.startAuction(s.tile, s.done);
          return;
        case 'card': this.applyCard(); return;
        case 'post': this.botBuild(c); this.endTurn(); return;
        case 'debt':
          if (this.botRaise(c, s.amt)) this.settleDebt(); else this.goBankrupt();
          return;
        case 'trade':
          if (s.step === 'answer') { this.answerTrade(this.botAccept(c, s)); return; }
          this.cancelTrade(); return;
        case 'manage': this.closeManage(); return;
      }
    }
    botInput() { return {}; }

    /* ---------- chuột ---------- */
    onPointer(x, y, type) {
      this.ptr = { x, y };
      const c = this.controller(), human = c >= 0 && !this.players[c].bot;
      const b = this.btnAt(), s = this.st;
      if (this.is3d()) { this.pointer3d(x, y, type, b, human); return; }
      if (type === 'move') {
        this.hover = tileAt(x, y);
        // rê chuột lên nút menu = chọn luôn nút đó (khung vàng đi theo chuột)
        if (b && human && b.sel !== undefined && !b.dis && s.sel !== b.sel) { s.sel = b.sel; Sfx.play('move', 0.05); }
        return;
      }
      if (type !== 'down' || this.finished || !human) return;
      if (b) { if (!b.dis) { Sfx.play('select'); this.pressFx(b); b.fn(); } else Sfx.tone(180, 0.08, 'square', 0.06); return; }
      const t = tileAt(x, y);
      if (s.k === 'manage' && t >= 0) { s.cursor = t; s.sel = 0; }
    }

    /** chuột trên bàn 3D: nút như bàn phẳng; kéo trên bàn = xoay (ngang) / nghiêng (dọc); bấm nhẹ một ô = chọn ô */
    pointer3d(x, y, type, b, human) {
      const s = this.st, sc = this.s3, d = this.drag3;
      const inPanel = x < P3_X + P3_W + 4 || x > R3_X - 4 || (['auction', 'manage', 'trade'].includes(s.k) && x >= CX0 && x <= CX0 + CW && y >= CY0 && y <= CY0 + CW);
      if (type === 'move') {
        if (d) {
          const dx = x - d.x, dy = y - d.y;
          if (!d.moved && Math.hypot(dx, dy) > 6) d.moved = true;
          if (d.moved) { sc.view.yaw = d.yaw - dx * 0.0075; sc.view.pitch = d.pitch + dy * 0.004; sc.applyView(); }
          this.hover = -1;
          return;
        }
        this.hover = inPanel || b ? -1 : sc.pickTile(x, y);
        if (b && human && b.sel !== undefined && !b.dis && s.sel !== b.sel) { s.sel = b.sel; Sfx.play('move', 0.05); }
        return;
      }
      if (type === 'up') {
        if (d && !d.moved && !this.finished && human) {
          const t = sc.pickTile(x, y);
          if (s.k === 'manage' && t >= 0) { s.cursor = t; s.sel = 0; }
        }
        this.drag3 = null;
        return;
      }
      if (type !== 'down') return;
      const vb = this.viewBtn;
      if (vb && x >= vb.x && x <= vb.x + vb.w && y >= vb.y && y <= vb.y + vb.h) { Sfx.play('select'); this.pressFx(vb); sc.resetView(true); return; }
      if (b && human && !this.finished) { if (!b.dis) { Sfx.play('select'); this.pressFx(b); b.fn(); } else Sfx.tone(180, 0.08, 'square', 0.06); return; }
      if (inPanel) return;
      sc.stopGlide();
      this.drag3 = { x, y, yaw: sc.view.yaw, pitch: sc.view.pitch, moved: false };
    }

    /* ---------- lưu ván (MON13) ---------- */
    snapshot() {
      return {
        v: 1, mode: this.quick ? 'quick' : 'full', mRounds: this.mRounds, round: this.round, cur: this.cur, turns: this.turns,
        ps: this.ps.map((p) => ({ cash: p.cash, pos: p.pos, jail: p.jail, jailTurns: p.jailTurns, cards: p.cards, out: p.out, outAt: p.outAt, outOrder: p.outOrder, worth: p.worth })),
        own: this.own, lvl: this.lvl, mort: this.mort, housesLeft: this.housesLeft, hotelsLeft: this.hotelsLeft, decks: this.decks, outCount: this.outCount,
        who: this.players.map((p) => (p.bot ? 'bot' : p.name)), time: Date.now(),
      };
    }
    writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.snapshot())); } catch (e) { /* bỏ qua */ } }
    clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* bỏ qua */ } }
    readSave() {
      try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (!s || s.v !== 1 || s.ps.length !== this.n || s.mode !== (this.quick ? 'quick' : 'full')) return null;
        // cùng đội hình: số người, vị trí người thật / máy
        if (s.who.some((w, i) => (w === 'bot') !== !!this.players[i].bot)) return null;
        return s;
      } catch (e) { return null; }
    }
    loadSave() {
      const s = this.saved;
      Object.assign(this, { round: s.round, cur: s.cur, turns: s.turns, own: s.own, lvl: s.lvl, mort: s.mort, housesLeft: s.housesLeft, hotelsLeft: s.hotelsLeft, decks: s.decks, outCount: s.outCount, mRounds: s.mRounds });
      s.ps.forEach((q, i) => Object.assign(this.ps[i], q));
      this.saved = null;
      this.say(`💾 Chơi tiếp ván đã lưu — vòng ${this.round}`);
      this.startTurn();
    }

    /* ---------- kết thúc ---------- */
    finish(why) {
      if (this.finished) return;
      this.finished = true;
      this.endWhy = why;
      this.clearSave();
      this.ps.forEach((p, i) => { if (!p.out) p.worth.push(this.worth(i)); });
      Sfx.play('win');
      const al = this.alive().sort((a, b) => this.worth(b) - this.worth(a));
      const w = al[0];
      if (w != null) {
        const q = this.cardXY(w);
        for (let k = 0; k < 4; k++) this.api.parts.burst(q.x + U.rand(-30, this.is3d() ? 160 : 200), q.y + U.rand(-20, 20), [this.players[w].color.main, '#ffe14d', '#fff'], 22, 300, 0.9, 6);
      }
      this.say(why === 'rounds' ? '⏱ Hết số vòng — ai giàu nhất thắng!' : why === 'bankrupt2' ? '💥 Đã có 2 người phá sản — kết thúc ván' : '🏆 Chỉ còn một người trụ lại!');
    }
    results() {
      const r = this.players.map((_, i) => {
        const p = this.ps[i];
        if (p.out) return { score: -1000 + (p.outOrder || 0), text: `💥 Phá sản (vòng ${p.outAt})` };
        return { score: 1e6 + this.worth(i), text: `${money(this.worth(i))} tài sản · ${money(p.cash)} tiền mặt` };
      });
      lastResults = r;
      return r;
    }
    resultTitle() {
      const al = this.alive().sort((a, b) => this.worth(b) - this.worth(a)), w = al[0];
      if (w == null) return 'Ván kết thúc!';
      const p = this.players[w];
      return `<span style="color:${p.color.light}">${p.name}</span> là tỷ phú — ${money(this.worth(w))}!`;
    }
    /** vị trí quân trên bàn (toạ độ bàn, chưa qua camera); đang nhảy ô thì nội suy */
    tokenXY(i, hopToo) {
      const p = this.ps[i];
      if (!p || p.out) return null;
      const off = TOKEN_OFF[i];
      if (hopToo && this.hop && this.hop.i === i) {
        const h = this.hop, r0 = tileRect(h.from), r1 = tileRect(h.to);
        const k = U.clamp(h.t / h.air, 0, 1), e = 0.5 - 0.5 * Math.cos(k * Math.PI);   // nhanh dần rồi chậm dần
        // nhún: bẹt ra lúc vừa chạm đất rồi nảy về
        const land = h.t > h.air ? (h.t - h.air) / Math.max(0.05, Math.min(0.2, h.dur - h.air)) : -1;
        const sq = land >= 0 && land < 1 ? 0.22 * Math.sin(land * Math.PI) : (k < 1 ? -0.08 * Math.sin(k * Math.PI) : 0);
        return { x: U.lerp(r0.x + r0.w / 2, r1.x + r1.w / 2, e) + off[0], y: U.lerp(r0.y + r0.h / 2, r1.y + r1.h / 2, e) + off[1], z: Math.sin(k * Math.PI) * (h.high ? 90 : 24), sq };
      }
      const r = tileRect(p.pos);
      return { x: r.x + r.w / 2 + off[0], y: r.y + r.h / 2 + off[1], z: 0 };
    }
    /** toạ độ màn hình (qua camera) — app dùng cho nhãn phím */
    posOf(i) {
      if (this.is3d()) {
        const q = this.tokenWorld(i);
        if (!q) return null;
        const p = this.s3.project(q.x, q.y + 0.3, q.z);
        return { x: p.x, y: p.y };
      }
      const q = this.tokenXY(i, true);
      return q ? { x: q.x, y: q.y - q.z } : null;
    }

    /* ---------- bàn 3D (monopoly3d.js) ---------- */
    /** đang vẽ bàn 3D? (tuỳ chọn Bàn cờ ≠ Phẳng và máy có WebGL) — đọc mỗi khung vì app không tạo lại game khi đổi tuỳ chọn */
    is3d() {
      const v = this.api.opts && this.api.opts.view;
      if (v === '2d' || this.no3d || typeof window === 'undefined' || !window.Mono3D) return false;
      if (!this.s3) {
        try {
          if (!window.Mono3D.available()) { this.no3d = true; return false; }
          this.s3 = window.Mono3D.shared({ tiles: TILES, groups: GROUPS, art: tileArt, deckArt, globe: () => art(GLOBE), ready: artReady });
          this.s3.resetView();
        } catch (e) { this.no3d = true; return false; }
      }
      return true;
    }
    /** vị trí quân i trong cảnh 3D (đang nhảy ô thì nội suy theo vòng cung) */
    tokenWorld(i) {
      const p = this.ps[i], sc = this.s3;
      if (!p || p.out) return null;
      const h = this.hop;
      if (h && h.i === i) {
        const a = sc.tokenSpot(h.from, i), b = sc.tokenSpot(h.to, i);
        const k = U.clamp(h.t / h.air, 0, 1), e = 0.5 - 0.5 * Math.cos(k * Math.PI);
        const land = h.t > h.air ? (h.t - h.air) / Math.max(0.05, Math.min(0.2, h.dur - h.air)) : -1;
        const sq = land >= 0 && land < 1 ? 0.22 * Math.sin(land * Math.PI) : (k < 1 ? -0.08 * Math.sin(k * Math.PI) : 0);
        return { x: U.lerp(a.x, b.x, e), y: a.y + Math.sin(k * Math.PI) * (h.high ? 2.6 : 0.75), z: U.lerp(a.z, b.z, e), sq };
      }
      return sc.tokenSpot(p.pos, i);
    }
    /** đặt mọi thứ trong cảnh 3D rồi vẽ */
    render3d() {
      const sc = this.s3, s = this.st;
      if (sc.owner !== this) { sc.owner = this; sc.setPlayers(this.players.map((p) => p.color)); sc.lastOwn = []; }
      sc.sync(this.own, this.lvl, this.mort);
      const top = this.finished ? this.alive().sort((a, b) => this.worth(b) - this.worth(a))[0] : -1;
      this.players.forEach((_, i) => {
        const q = this.tokenWorld(i);
        sc.placeToken(i, q ? Object.assign({ crown: i === top, big: i === this.cur && !this.finished }, q) : { hide: true });
      });
      const q = !this.finished && this.tokenWorld(this.cur);
      sc.setTurn(q ? { x: q.x, y: q.y, z: q.z, color: this.players[this.cur].color.main, pulse: 0.5 + 0.5 * Math.sin(this.t * 6), bob: Math.abs(Math.sin(this.t * 4)) } : null);
      // khung sáng: ô quân sắp dừng (màu người đi) · ô đang chọn / rê chuột (vàng)
      if (s.k === 'move' && s.left > 0) {
        const p = this.ps[s.who];
        sc.setHighlight(0, (p.pos + s.left * s.dir + 400) % 40, this.players[s.who].color.main, 0.55 + 0.45 * Math.sin(this.t * 8));
      } else sc.setHighlight(0, -1);
      const hl = s.k === 'manage' ? s.cursor : (s.k === 'auction' || s.k === 'buy') ? s.tile : this.hover;
      sc.setHighlight(1, hl >= 0 ? hl : -1, hl === this.hover && s.k !== 'manage' && s.k !== 'auction' && s.k !== 'buy' ? '#ffffff' : '#ffe14d', 0.7 + 0.3 * Math.sin(this.t * 7));
      // xúc xắc: tung từ mép gần bàn, nảy vài lần, lăn chậm dần rồi nằm đúng mặt đã gieo
      const yaw = this.diceYaw || [0.3, -0.4], rest = [{ x: -0.6, z: 1.35 }, { x: 0.5, z: 1.1 }];
      const rolling = s.k === 'dice' && s.t < s.roll;
      for (let j = 0; j < 2; j++) {
        if (!this.rolled) { sc.placeDie(j, null); continue; }
        const fq = Kit3D.diceQuat(this.dice[j], yaw[j]);
        if (rolling) {
          const k = U.clamp(s.t / s.roll, 0, 1), e = 1 - (1 - k) * (1 - k);
          const x0 = 2.4 + j * 0.7, z0 = 4.2 - j * 0.4;
          const y = sc.diceY + (1 - k) * (1 - k) * 2.2 * Math.abs(Math.cos(k * Math.PI * 2.5));
          const qq = fq.clone().multiply(Kit3D.spinQuat(-1.7 * Math.pow(1 - k, 3)));
          sc.placeDie(j, { x: U.lerp(x0, rest[j].x, e), y, z: U.lerp(z0, rest[j].z, e), q: qq });
        } else sc.placeDie(j, { x: rest[j].x, y: sc.diceY, z: rest[j].z, q: fq });
      }
      sc.render(this.api.opts && this.api.opts.view === 'lite');
    }
    draw3d(ctx) {
      this.render3d();
      ctx.clearRect(0, 0, W, H);
      const s = this.st, sc = this.s3;
      this.btns = [];
      // nhãn trên bàn: kết quả xúc xắc, số bước còn lại, khoá tù
      if (this.rolled && s.k === 'dice' && s.t >= s.roll) {
        const p = sc.project(-0.05, sc.diceY + 1.1, 1.2), k = Math.min(1, (s.t - s.roll) / 0.25), pop = 1 + 0.3 * Math.sin(k * Math.PI);
        const dbl = this.dice[0] === this.dice[1], txt = `${this.dice[0]} + ${this.dice[1]} = ${this.dice[0] + this.dice[1]}${dbl ? '  ĐÔI!' : ''}`;
        ctx.save(); ctx.translate(p.x, p.y - 20); ctx.scale(pop, pop);
        ctx.font = `800 26px ${FONT}`; const tw = ctx.measureText(txt).width + 34;
        Draw.rr(ctx, -tw / 2, -22, tw, 44, 22); ctx.fillStyle = dbl ? '#e67e22' : '#c0392b'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
        Draw.text(ctx, txt, 0, 1, { size: 26, color: '#fff', stroke: 'rgba(0,0,0,0.3)', sw: 3 });
        ctx.restore();
      }
      this.ps.forEach((p, i) => {
        if (p.out) return;
        const q = this.tokenWorld(i);
        if (!q) return;
        if (p.jail) { const a = sc.project(q.x + 0.2, q.y + 0.55, q.z); Draw.text(ctx, '🔒', a.x, a.y, { size: 16, stroke: null }); }
        if (s.k === 'move' && s.who === i && s.left > 0) {
          const a = sc.project(q.x, q.y + 0.85, q.z), bx = a.x + 26, by = a.y - 6;
          ctx.beginPath(); ctx.arc(bx, by, 15, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = this.players[i].color.main; ctx.stroke();
          Draw.text(ctx, String(s.left), bx, by + 1, { size: 18, color: this.players[i].color.dark, stroke: null, weight: 800 });
        }
      });
      this.drawPanel3d(ctx);
      this.drawRight3d(ctx);
      this.drawAction3d(ctx);
      // màn phụ giữa bàn
      if (!this.finished) {
        if (['auction', 'manage', 'trade'].includes(s.k)) {
          ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24;
          Draw.rr(ctx, CX0, CY0, CW, CW, 18); ctx.fillStyle = 'rgba(240,250,246,0.96)'; ctx.fill(); ctx.restore();
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(43,92,77,0.45)'; Draw.rr(ctx, CX0, CY0, CW, CW, 18); ctx.stroke();
          if (s.k === 'auction') this.drawAuction(ctx); else if (s.k === 'manage') this.drawManage(ctx); else this.drawTrade(ctx);
        } else if (s.k === 'card') this.renderCard(ctx, s);
        else if (s.k === 'buy') this.drawTileInfo(ctx, s.tile, true);
      }
      this.drawButtonFx(ctx);
      for (const c of this.coins) {
        if (c.t < 0) continue;
        const k = c.t / c.dur, e = 1 - (1 - k) * (1 - k);
        drawBill(ctx, U.lerp(c.a.x, c.b.x, e), U.lerp(c.a.y, c.b.y, e) - Math.sin(k * Math.PI) * 60, k * 6 + c.dur);
      }
      for (const f of this.floats) {
        ctx.globalAlpha = Math.min(1, FLOAT_T - f.t);
        Draw.text(ctx, f.s, f.x, f.y - f.t * 18, { size: 20, color: f.c });
        ctx.globalAlpha = 1;
      }
      if (this.hover >= 0 && !this.finished && !this.btnAt() && !this.drag3 && !['manage', 'trade', 'auction', 'buy', 'card'].includes(s.k)) this.drawTileInfo(ctx, this.hover, true);
      this.drawTurnFx(ctx);
    }
    /** cột trái: thẻ người chơi gọn (tên, tiền, 28 ô sở hữu) */
    drawPanel3d(ctx) {
      const w = P3_W;
      this.players.forEach((pl, i) => {
        const p = this.ps[i], x = P3_X, y = this.cardY3(i), h = P3_CH, active = !this.finished && this.cur === i && !p.out;
        ctx.save();
        ctx.shadowColor = active ? pl.color.main : 'rgba(0,0,0,0.18)'; ctx.shadowBlur = active ? 18 : 8;
        Draw.rr(ctx, x, y, w, h, 14); ctx.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,0.9)'; ctx.fill();
        ctx.restore();
        ctx.lineWidth = active ? 4 + 1.5 * Math.sin(this.t * 6) : 1.5; ctx.strokeStyle = active ? pl.color.main : 'rgba(43,58,51,0.2)';
        Draw.rr(ctx, x, y, w, h, 14); ctx.stroke();
        ctx.save(); Draw.rr(ctx, x, y, w, h, 14); ctx.clip(); ctx.fillStyle = pl.color.main; ctx.fillRect(x, y, 7, h); ctx.restore();
        Draw.blob(ctx, { x: x + 30, y: y + 30, r: 17, color: pl.color, face: Math.PI / 2, shadow: false, dead: p.out });
        ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        fitText(ctx, pl.name + (pl.bot ? ` 🤖 ${BOT_LEVELS[this.level(i)].name}` : ''), x + 54, y + 17, w - (active ? 140 : 62), 16, 10, 800, pl.color.dark);
        ctx.restore();
        if (active) {
          Draw.rr(ctx, x + w - 80, y + 6, 72, 22, 11); ctx.fillStyle = pl.color.main; ctx.fill();
          Draw.text(ctx, '🎲 LƯỢT', x + w - 44, y + 17.5, { size: 12, color: '#fff', stroke: 'rgba(0,0,0,0.3)', sw: 2 });
        }
        Draw.text(ctx, p.out ? '💥 Phá sản' : money(p.cash), x + 54, y + 42, { size: 23, align: 'left', color: p.out ? '#c0392b' : '#1d7a3a', stroke: null, weight: 800 });
        const tags = (p.jail ? `🔒${p.jailTurns}/3 ` : '') + (p.cards.length ? `🎫×${p.cards.length}` : '');
        if (!p.out) Draw.text(ctx, tags || `TS ${money(this.worth(i))}`, x + w - 10, y + 44, { size: 12, align: 'right', color: tags ? '#2b3a33' : '#5a6b63', stroke: null });
        BUYABLE.forEach((t, k) => {
          const d = TILES[t], sx = x + 12 + k * 8.15, sy = y + 62;
          const mine = this.own[t] === i;
          ctx.fillStyle = mine ? (d.t === 'city' ? GROUPS[d.g].color : '#7f93a8') : 'rgba(43,58,51,0.1)';
          ctx.fillRect(sx, sy, 6.6, 14);
          if (mine && this.mort[t]) { ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, sy + 14); ctx.lineTo(sx + 6.6, sy); ctx.stroke(); }
          if (mine && this.lvl[t]) { ctx.fillStyle = this.lvl[t] === 5 ? '#e0352f' : '#fff'; ctx.fillRect(sx + 1.8, sy + 2, 3, 3); }
        });
        if (p.out) { ctx.fillStyle = 'rgba(60,60,70,0.35)'; Draw.rr(ctx, x, y, w, h, 14); ctx.fill(); }
      });
    }
    /** bảng hành động dưới thẻ người chơi: ai đang tới lượt, việc đang diễn ra, nút bấm */
    drawAction3d(ctx) {
      const s = this.st, x = P3_X, w = P3_W, y0 = this.cardY3(this.n) + 2, y1 = H - 10;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 10;
      Draw.rr(ctx, x, y0, w, y1 - y0, 16); ctx.fillStyle = 'rgba(255,255,255,0.93)'; ctx.fill(); ctx.restore();
      const pi = this.controller(), p = pi >= 0 ? this.players[pi] : null;
      if (this.finished) { Draw.text(ctx, '🏆 Ván đã kết thúc', x + w / 2, y0 + 30, { size: 18, color: '#c0392b', stroke: null }); return; }
      // viên thuốc màu: trạng thái lượt
      let title = '';
      if (p) {
        title = {
          resume: '💾 Có ván đang chơi dở', pre: `Lượt của ${p.name}`, jailpre: `${p.name} đang ở tù`, buy: `${p.name}: mua ô này?`,
          card: `${p.name} rút thẻ`, post: `${p.name} — xong nước đi`, debt: `${p.name} nợ ${money(s.amt)}`, dice: s.t < s.roll ? `${p.name} gieo xúc xắc…` : `${p.name} gieo được ${this.dice[0] + this.dice[1]}`,
          move: `${p.name} di chuyển…`, wait: `${p.name}`, auction: '🔨 Đang đấu giá', manage: `🏗️ ${p.name} xem tài sản`, trade: '🤝 Giao dịch',
        }[s.k] || p.name;
      }
      const ty = y0 + 26;
      Draw.rr(ctx, x + 8, ty - 19, w - 16, 38, 19); ctx.fillStyle = p ? p.color.main : '#555'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      if (p) Draw.blob(ctx, { x: x + 28, y: ty + 1, r: 12, color: p.color, face: Math.PI / 2, shadow: false });
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      fitText(ctx, title, x + w / 2 + 12, ty + 1, w - 70, 18, 11, 800, '#fff');
      ctx.restore();
      // menu (người thật) hoặc "máy đang nghĩ"
      const its = p && !p.bot && !['manage', 'trade', 'auction'].includes(s.k) ? this.items() : [];
      const bh = 38, gap = 6, by0 = y1 - 10 - its.length * (bh + gap) + gap;
      // dòng diễn biến gần nhất (tự xuống dòng, vừa chỗ trống)
      ctx.font = `600 13px ${FONT}`;
      const lines = [];
      for (const l of this.log.slice(-3)) wrap(ctx, l, w - 24).forEach((t) => lines.push(t));
      const room = Math.max(0, Math.floor((by0 - 8 - (ty + 26)) / 17));
      lines.slice(-room).forEach((l, k, arr) => Draw.text(ctx, l, x + 12, ty + 34 + k * 17, { size: 13, align: 'left', color: k === arr.length - 1 ? '#1d2b25' : '#5a6b63', stroke: null, weight: k === arr.length - 1 ? 700 : 600 }));
      if (p && p.bot && !['dice', 'move', 'wait', 'auction'].includes(s.k)) Draw.text(ctx, `🤖 ${p.name} đang suy nghĩ…`, x + w / 2, y1 - 26, { size: 15, color: '#2b5c4d', stroke: null });
      if (s.k === 'auction' || s.k === 'manage' || s.k === 'trade') Draw.text(ctx, '👉 xem bảng giữa màn hình', x + w / 2, y1 - 26, { size: 14, color: '#2b5c4d', stroke: null });
      its.forEach((it, k) => {
        const bx = x + 10, y = by0 + k * (bh + gap), bw = w - 20, on = k === s.sel && !it.dis;
        Draw.rr(ctx, bx, y, bw, bh, 12);
        ctx.fillStyle = it.dis ? 'rgba(120,120,120,0.25)' : on ? '#ffe14d' : '#ffffff'; ctx.fill();
        ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? p.color.main : 'rgba(0,0,0,0.22)'; ctx.stroke();
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        fitText(ctx, it.label, bx + bw / 2, y + bh / 2 + 1, bw - 16, 15.5, 10, 700, it.dis ? '#777' : '#2a1840');
        ctx.restore();
        if (on) this.selRect = { x: bx, y, w: bw, h: bh };
        this.btns.push({ x: bx, y, w: bw, h: bh, fn: it.fn, dis: it.dis, sel: k });
      });
    }
    /** cột phải: vòng / ngân hàng, nút góc nhìn, nhật ký, bảng phím */
    drawRight3d(ctx) {
      const x = R3_X, w = R3_W;
      Draw.rr(ctx, x, 10, w, 58, 14); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(43,58,51,0.2)'; ctx.stroke();
      const info = this.quick ? `Vòng ${Math.min(this.round, this.mRounds)} / ${this.mRounds}` : `Vòng ${this.round}`;
      Draw.text(ctx, info, x + w / 2, 29, { size: 20, color: '#2b5c4d', stroke: null, weight: 800 });
      Draw.text(ctx, `Ngân hàng: 🏠 ${this.housesLeft} · 🏨 ${this.hotelsLeft}`, x + w / 2, 53, { size: 13, color: '#4a5d55', stroke: null });
      // nút đặt lại góc nhìn (ai bấm cũng được, kể cả lúc máy đang đi)
      const vb = this.viewBtn = { x, y: 76, w, h: 32 };
      const on = this.ptr && this.ptr.x >= vb.x && this.ptr.x <= vb.x + vb.w && this.ptr.y >= vb.y && this.ptr.y <= vb.y + vb.h;
      Draw.rr(ctx, vb.x, vb.y, vb.w, vb.h, 12); ctx.fillStyle = on ? '#ffe14d' : 'rgba(255,255,255,0.9)'; ctx.fill();
      ctx.lineWidth = on ? 2.5 : 1.5; ctx.strokeStyle = on ? '#2e86de' : 'rgba(43,58,51,0.2)'; ctx.stroke();
      Draw.text(ctx, '🎥 Góc nhìn chuẩn', x + w / 2, vb.y + 17, { size: 14, color: '#2a1840', stroke: null });
      Draw.text(ctx, 'Kéo chuột trên bàn để xoay / nghiêng', x + w / 2, vb.y + 46, { size: 11.5, color: '#2b5c4d', stroke: 'rgba(255,255,255,0.8)', sw: 3 });
      // phím của người thật ở đáy, nhật ký phía trên
      const kh = this.drawKeys(ctx, x, 0, w, false), ky = H - 10 - kh + 12;
      if (kh) this.drawKeys(ctx, x, ky, w, true);
      const ly = 140, lh = (kh ? ky - 8 : H - 10) - ly;
      if (lh < 60) return;
      Draw.rr(ctx, x, ly, w, lh, 14); ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(43,58,51,0.2)'; ctx.stroke();
      Draw.text(ctx, '📜 Diễn biến', x + 12, ly + 16, { size: 15, align: 'left', color: '#2b5c4d', stroke: null, weight: 800 });
      ctx.font = `600 12.5px ${FONT}`;
      const lines = [];
      for (const l of this.log.slice(-16)) wrap(ctx, l, w - 22).forEach((t, k) => lines.push({ t, first: k === 0 }));
      const rows = Math.max(1, Math.floor((lh - 34) / 17)), show = lines.slice(-rows);
      ctx.save(); Draw.rr(ctx, x, ly, w, lh, 14); ctx.clip();
      show.forEach((l, k) => Draw.text(ctx, l.t, x + (l.first ? 12 : 22), ly + 36 + k * 17, { size: 12.5, align: 'left', color: k === show.length - 1 ? '#1d2b25' : '#3d4f47', stroke: null, weight: k === show.length - 1 ? 700 : 600 }));
      ctx.restore();
    }

    draw(ctx) {
      if (this.is3d()) { this.draw3d(ctx); return; }
      ctx.fillStyle = '#e8f4ea'; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.drawImage(boardCanvas(), BX, BY);
      this.drawOverlay(ctx);
      this.drawPanel(ctx);
      this.drawCenter(ctx);
      this.drawDest(ctx);
      this.drawTokens(ctx);
      this.drawButtonFx(ctx);
      // tiền bay
      for (const c of this.coins) {
        if (c.t < 0) continue;
        const k = c.t / c.dur, e = 1 - (1 - k) * (1 - k);
        const x = U.lerp(c.a.x, c.b.x, e), y = U.lerp(c.a.y, c.b.y, e) - Math.sin(k * Math.PI) * 60;
        drawBill(ctx, x, y, k * 6 + c.dur);
      }
      for (const f of this.floats) {
        ctx.globalAlpha = Math.min(1, FLOAT_T - f.t);
        Draw.text(ctx, f.s, f.x, f.y - f.t * 18, { size: 20, color: f.c });
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (this.hover >= 0 && !this.btnAt() && !['manage', 'trade', 'auction'].includes(this.st.k)) this.drawTileInfo(ctx, this.hover, true);
      this.drawTurnFx(ctx);
    }
    drawOverlay(ctx) {
      for (let t = 0; t < 40; t++) {
        const o = this.own[t];
        if (o < 0) continue;
        const r = tileRect(t), col = this.players[o].color.main;
        // viền màu chủ ở mép ngoài
        const th = OWN_EDGE - 2;
        ctx.fillStyle = col;
        if (r.side === 0) ctx.fillRect(r.x + 2, r.y + r.h - th - 1, r.w - 4, th);
        else if (r.side === 1) ctx.fillRect(r.x + 1, r.y + 2, th, r.h - 4);
        else if (r.side === 2) ctx.fillRect(r.x + 2, r.y + 1, r.w - 4, th);
        else ctx.fillRect(r.x + r.w - th - 1, r.y + 2, th, r.h - 4);
        if (this.mort[t]) {
          ctx.fillStyle = 'rgba(60,60,70,0.55)'; ctx.fillRect(r.x, r.y, r.w, r.h);
          Draw.text(ctx, 'THẾ CHẤP', r.x + r.w / 2, r.y + r.h / 2, { size: 9, color: '#fff', stroke: 'rgba(0,0,0,0.6)', sw: 2 });
        }
        const l = this.lvl[t];
        if (l > 0) {
          const b = bandRect(r), horiz = b.w > b.h;
          if (l === 5) drawHouse(ctx, b.x + b.w / 2, b.y + b.h / 2, 18, true);
          else {
            const s = horiz ? 16 : 13, gap = horiz ? 4 : 1, tot = l * s + (l - 1) * gap;
            for (let k = 0; k < l; k++) {
              const x = horiz ? b.x + b.w / 2 - tot / 2 + k * (s + gap) + s / 2 : b.x + b.w / 2;
              const y = horiz ? b.y + b.h / 2 : b.y + b.h / 2 - tot / 2 + k * (s + gap) + s / 2;
              drawHouse(ctx, x, y, s, false);
            }
          }
        }
      }
      // ô đang được chọn trong quản lý / đấu giá / mua
      const s = this.st, hl = s.k === 'manage' ? s.cursor : (s.k === 'auction' || s.k === 'buy') ? s.tile : -1;
      if (hl >= 0) {
        const r = tileRect(hl), pulse = 3 + Math.sin(this.t * 7) * 1.5;
        ctx.save(); ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3 + pulse * 0.5; ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 12;
        ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); ctx.restore();
      }
    }
    drawTokens(ctx) {
      this.ps.forEach((p, i) => {
        if (p.out) return;
        const q = this.tokenXY(i, true), z = q.z;
        if (i === this.cur && !this.finished) {
          // người đang tới lượt: vòng sáng nhấp nháy dưới chân + mũi tên nhún trên đầu
          const pu = 0.5 + 0.5 * Math.sin(this.t * 6);
          ctx.save(); ctx.globalAlpha = 0.45 + pu * 0.4;
          ctx.beginPath(); ctx.ellipse(q.x, q.y + 12, 24 + pu * 5, 10 + pu * 2, 0, 0, TAU);
          ctx.lineWidth = 4; ctx.strokeStyle = this.players[i].color.main; ctx.stroke(); ctx.restore();
          const ay = q.y - z - 40 - Math.abs(Math.sin(this.t * 5)) * 7;
          ctx.beginPath(); ctx.moveTo(q.x - 10, ay - 10); ctx.lineTo(q.x + 10, ay - 10); ctx.lineTo(q.x, ay + 2); ctx.closePath();
          ctx.fillStyle = this.players[i].color.main; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
        }
        Draw.blob(ctx, { x: q.x, y: q.y, z, squash: q.sq || 0, r: 18, color: this.players[i].color, face: Math.PI / 2, shadow: true, crown: this.finished && this.alive().sort((a, b) => this.worth(b) - this.worth(a))[0] === i });
        if (p.jail) Draw.text(ctx, '🔒', q.x + 10, q.y - 14, { size: 13, stroke: null });
        // đang đi: bong bóng số bước còn lại cạnh quân
        const s = this.st;
        if (s.k === 'move' && s.who === i && s.left > 0) {
          const bx = q.x + 24, by = q.y - z - 26;
          ctx.beginPath(); ctx.arc(bx, by, 14, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = this.players[i].color.main; ctx.stroke();
          Draw.text(ctx, String(s.left), bx, by + 1, { size: 17, color: this.players[i].color.dark, stroke: null, weight: 800 });
        }
      });
    }
    /** đang đi: viền nhấp nháy ở ô sẽ dừng để mắt biết quân đang tới đâu */
    drawDest(ctx) {
      const s = this.st;
      if (s.k !== 'move' || s.left <= 0) return;
      const p = this.ps[s.who], r = tileRect((p.pos + s.left * s.dir + 400) % 40), pl = this.players[s.who];
      const pu = 0.5 + 0.5 * Math.sin(this.t * 8);
      ctx.save();
      ctx.fillStyle = pl.color.main; ctx.globalAlpha = 0.12 + pu * 0.12; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 1; ctx.setLineDash([8, 5]); ctx.lineDashOffset = -this.t * 30;
      ctx.lineWidth = 4; ctx.strokeStyle = pl.color.main; ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      ctx.restore();
    }
    /** thẻ thông tin một ô (MON12) */
    drawTileInfo(ctx, t, float) {
      const d = TILES[t];
      if (!d.buy) return;
      // đầu thẻ = tranh (MON15): lớn khi mua / rê chuột, gọn hơn trong màn quản lý
      const ph = float ? 104 : 62, hd = ph + 4;
      const w = 230, h = (d.t === 'city' ? 198 : 124) + hd;
      const x = float ? CX0 + CW / 2 - w / 2 : CX0 + 20, y = float ? CY0 + 36 : CY0 + 64;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 14;
      Draw.rr(ctx, x, y, w, h, 12); ctx.fillStyle = '#fffdf5'; ctx.fill();
      ctx.restore();
      const col = d.t === 'city' ? GROUPS[d.g].color : '#5b6b80';
      ctx.save(); Draw.rr(ctx, x, y, w, h, 12); ctx.clip();
      drawPicture(ctx, d, x, y, w, ph);
      // dải tên đè lên chân tranh
      ctx.globalAlpha = 0.9; ctx.fillStyle = col; ctx.fillRect(x, y + ph - 26, w, 26); ctx.globalAlpha = 1;
      ctx.fillStyle = col; ctx.fillRect(x, y + ph, w, 4);
      ctx.restore();
      Draw.text(ctx, d.name, x + w / 2, y + ph - 12, { size: 17, color: '#fff', stroke: 'rgba(0,0,0,0.45)', sw: 3 });
      const line = (s, k, col = '#2b2b2b', bold) => Draw.text(ctx, s, x + 14, y + hd + 18 + k * 19, { size: 14, align: 'left', color: col, stroke: null, weight: bold ? 800 : 600 });
      let k = 0;
      if (d.t === 'city') {
        line(`Nhóm: ${GROUPS[d.g].name}`, k++, '#555');
        const L = this.lvl[t], cur = this.own[t] >= 0;
        const rows = [['Tiền thuê', d.rents[0]], ['1 nhà', d.rents[1]], ['2 nhà', d.rents[2]], ['3 nhà', d.rents[3]]];
        if (this.hotelAt === 4) rows.push(['4 nhà', d.rents[4]]);
        rows.push(['Khách sạn', d.rents[5]]);
        rows.forEach(([a, b], j) => {
          const on = cur && ((j === 0 && L === 0) || (j > 0 && j <= this.hotelAt && L === j) || (j === rows.length - 1 && L === 5));
          line(`${on ? '▶ ' : ''}${a}: ${money(b)}${j === 0 ? ' (đủ nhóm ×2)' : ''}`, k++, on ? '#c0392b' : '#2b2b2b', on);
        });
        line(`Giá ${money(d.price)} · Nhà ${money(d.hc)}`, k++, '#555');
      } else if (d.t === 'air') {
        line('Tiền thuê theo số sân bay sở hữu:', k++, '#555');
        line('1: $25 · 2: $50 · 3: $100 · 4: $200', k++);
        line(`Giá ${money(d.price)}`, k++, '#555');
      } else {
        line('Tiền thuê: 4× số chấm xúc xắc', k++);
        line('Có cả 2 công ty: 10× số chấm', k++);
        line(`Giá ${money(d.price)}`, k++, '#555');
      }
      const o = this.own[t];
      line(o >= 0 ? `Chủ: ${this.name(o)}${this.mort[t] ? ' · đang thế chấp' : ''}` : 'Chưa có chủ', k++, o >= 0 ? this.players[o].color.dark : '#888', true);
    }
    drawDice(ctx, x, y, s, v) {
      Draw.rr(ctx, x - s / 2, y - s / 2, s, s, s * 0.18); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#333'; ctx.stroke();
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
      ctx.fillStyle = v === 1 ? '#d63031' : '#222';
      for (const [a, b] of P) { ctx.beginPath(); ctx.arc(x + a * s * 0.26, y + b * s * 0.26, s * 0.09, 0, TAU); ctx.fill(); }
    }
    drawCenter(ctx) {
      const s = this.st, cx = CX0 + CW / 2;
      this.btns = [];
      // màn phụ (mua, thẻ, đấu giá, quản lý, giao dịch): phủ một tấm nền che chữ trang trí giữa bàn
      if (['buy', 'card', 'auction', 'manage', 'trade', 'resume'].includes(s.k) && !this.finished) {
        Draw.rr(ctx, CX0 + 6, CY0 + 6, CW - 12, CW - 12, 14); ctx.fillStyle = 'rgba(236,248,243,0.95)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(43,92,77,0.35)'; ctx.stroke();
      }
      const modal = ['buy', 'card', 'auction', 'manage', 'trade', 'resume'].includes(s.k);
      // xúc xắc
      const rolling = s.k === 'dice' && s.t < s.roll, shown = s.k === 'dice' && !rolling;
      if (!modal) {
      const dv = rolling ? [1 + Math.floor((this.t * 17) % 6), 1 + Math.floor((this.t * 23 + 3) % 6)] : this.dice;
      const dy = CY0 + 118;
      const wob = rolling ? Math.sin(this.t * 40) * 0.25 : 0;
      // vừa dừng: xúc xắc bật to lên một nhịp
      const k = shown ? Math.min(1, (s.t - s.roll) / 0.25) : 1, pop = shown ? 1 + 0.35 * Math.sin(k * Math.PI) : 1;
      ctx.save(); ctx.translate(cx - 34, dy); ctx.rotate(wob); ctx.scale(pop, pop); this.drawDice(ctx, 0, 0, 52, dv[0]); ctx.restore();
      ctx.save(); ctx.translate(cx + 34, dy); ctx.rotate(-wob); ctx.scale(pop, pop); this.drawDice(ctx, 0, 0, 52, dv[1]); ctx.restore();
      if (shown) {
        const dbl = this.dice[0] === this.dice[1];
        Draw.text(ctx, `= ${this.dice[0] + this.dice[1]}`, cx + 96, dy + 2, { size: 34, color: '#c0392b', stroke: '#fff', sw: 5, align: 'left' });
        if (dbl) Draw.text(ctx, 'ĐÔI!', cx - 96, dy + 2, { size: 28, color: '#e67e22', stroke: '#fff', sw: 5, align: 'right' });
      }
      }
      // dòng trạng thái
      const pi = this.controller(), p = pi >= 0 ? this.players[pi] : null;
      const info = this.quick ? `Vòng ${Math.min(this.round, this.mRounds)}/${this.mRounds}` : `Vòng ${this.round}`;
      if (!modal) {
      }
      if (this.finished) {
        Draw.text(ctx, 'Kết thúc ván!', cx, CY0 + 200, { size: 34, color: '#c0392b', stroke: '#fff', sw: 5 });
        return;
      }
      if (s.k === 'auction') { this.drawAuction(ctx); return; }
      if (s.k === 'manage') { this.drawManage(ctx); return; }
      if (s.k === 'trade') { this.drawTrade(ctx); return; }
      if (s.k === 'card') this.renderCard(ctx, s);
      if (s.k === 'buy') Draw.text(ctx, `${p ? p.name : ''} dừng ở ô chưa có chủ — mua không?`, cx, CY0 + 24, { size: 15, color: '#2b5c4d', stroke: null });
      if (s.k === 'buy') this.drawTileInfo(ctx, s.tile, true);
      let title = '';
      if (p) {
        title = {
          resume: '💾 Có ván đang chơi dở', pre: `Lượt của ${p.name}`, jailpre: `${p.name} đang ở tù`, buy: `${p.name} dừng ở ô chưa có chủ`,
          card: `${p.name} rút thẻ`, post: `${p.name} — xong nước đi`, debt: `${p.name} đang nợ ${money(s.amt)}`, dice: s.t < s.roll ? `${p.name} gieo xúc xắc…` : `${p.name} gieo được ${this.dice[0] + this.dice[1]}`,
          move: `${p.name} di chuyển…`, wait: '…',
        }[s.k] || '';
      }
      if (s.k !== 'card' && s.k !== 'buy' && title) {
        // dòng trạng thái = viên thuốc màu của người đang tới lượt
        ctx.font = `800 21px ${FONT}`;
        const tw = ctx.measureText(title).width + 64, ty = CY0 + 172;
        Draw.rr(ctx, cx - tw / 2, ty - 21, tw, 42, 21); ctx.fillStyle = p ? p.color.main : '#555'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
        if (p) Draw.blob(ctx, { x: cx - tw / 2 + 22, y: ty + 1, r: 13, color: p.color, face: Math.PI / 2, shadow: false });
        Draw.text(ctx, title, cx + 12, ty + 1, { size: 21, color: '#fff', stroke: 'rgba(0,0,0,0.35)', sw: 4 });
      }
      // log gần nhất
      if (!['card', 'buy'].includes(s.k)) {
        const last = this.log.slice(-2);
        last.forEach((l, k) => Draw.text(ctx, l, cx, CY0 + 202 + k * 20, { size: 13, color: '#24443a', stroke: null }));
      }
      // menu
      const its = p && !p.bot ? this.items() : [];
      if (p && p.bot && !['dice', 'move', 'wait'].includes(s.k)) Draw.text(ctx, `🤖 ${p.name} đang suy nghĩ…`, cx, CY0 + 300, { size: 18, color: '#2b5c4d', stroke: null });
      const bw = 330, bh = 36, gap = 7, y0 = CY0 + CW - 18 - its.length * (bh + gap);
      its.forEach((it, k) => {
        const x = cx - bw / 2, y = y0 + k * (bh + gap), on = k === s.sel && !it.dis;
        Draw.rr(ctx, x, y, bw, bh, 12);
        ctx.fillStyle = it.dis ? 'rgba(120,120,120,0.35)' : on ? '#ffe14d' : 'rgba(255,255,255,0.92)'; ctx.fill();
        ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? p.color.main : 'rgba(0,0,0,0.25)'; ctx.stroke();
        Draw.text(ctx, it.label, cx, y + bh / 2 + 1, { size: 16, color: it.dis ? '#777' : '#2a1840', stroke: null });
        if (on) this.selRect = { x, y, w: bw, h: bh };
        this.btns.push({ x, y, w: bw, h: bh, fn: it.fn, dis: it.dis, sel: k });
      });
    }
    /** thẻ Cơ hội / Khí vận: bay lên từ chồng thẻ (mặt sau sọc), lật sang mặt trước (tiêu đề to + tác dụng) */
    renderCard(ctx, s) {
      const chance = s.deck === 'chance', col = chance ? '#e8692a' : '#2e86de', dark = chance ? '#a8441a' : '#1d5a9c';
      const w = 360, h = 250, cx = CX0 + CW / 2, cy = CY0 + 200;
      const t = s.t / Math.max(0.3, Math.min(1, this.speed));
      // điểm xuất phát = chồng thẻ trên bàn
      let from = { x: cx + (chance ? -120 : 120), y: cy + 90 };
      if (this.is3d()) from = this.s3.deckScreen(s.deck) || from;
      const k = U.clamp(t / CARD_RISE, 0, 1), e = U.outBack ? U.outBack(k) : k;
      const x = U.lerp(from.x, cx, 1 - (1 - k) * (1 - k)), y = U.lerp(from.y, cy, 1 - (1 - k) * (1 - k)) - Math.sin(k * Math.PI) * 40;
      const sc = 0.25 + 0.75 * e;
      const f = U.clamp((t - CARD_RISE) / CARD_FLIP, 0, 1), flipX = Math.abs(Math.cos(f * Math.PI)), front = f > 0.5;
      // nền mờ sau thẻ cho nổi
      if (k >= 1 && this.is3d()) { ctx.save(); ctx.globalAlpha = Math.min(1, (t - CARD_RISE) * 3) * 0.35; ctx.fillStyle = '#1a2340'; Draw.rr(ctx, CX0 - 10, CY0 + 10, CW + 20, CW - 40, 30); ctx.fill(); ctx.restore(); }
      ctx.save(); ctx.translate(x, y); ctx.scale(sc * Math.max(0.02, flipX), sc); ctx.rotate((1 - k) * (chance ? -0.5 : 0.5));
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
      Draw.rr(ctx, -w / 2, -h / 2, w, h, 22); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save(); Draw.rr(ctx, -w / 2, -h / 2, w, h, 22); ctx.clip();
      if (!front) {
        // mặt sau: sọc chéo 2 tông + huy hiệu giữa
        ctx.fillStyle = col; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = chance ? '#f39257' : '#5aa3ea'; ctx.lineWidth = 14;
        for (let d = -w - h; d < w + h; d += 28) { ctx.beginPath(); ctx.moveTo(d - h / 2, -h / 2 - 10); ctx.lineTo(d + h / 2, h / 2 + 10); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, -14, 62, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
        const di = deckArt(s.deck);
        if (di) ctx.drawImage(di, -44, -58, 88, 88); else Draw.text(ctx, chance ? '❓' : '🎁', 0, -14, { size: 64, stroke: null });
        Draw.text(ctx, chance ? 'CƠ HỘI' : 'KHÍ VẬN', 0, 84, { size: 34, color: '#fff', stroke: dark, sw: 6 });
      } else {
        // mặt trước
        const gr = ctx.createRadialGradient(0, -h / 2, 10, 0, -h / 2, h * 1.1);
        gr.addColorStop(0, chance ? '#ffe2cf' : '#d8ebff'); gr.addColorStop(0.7, '#ffffff');
        ctx.fillStyle = gr; ctx.fillRect(-w / 2, -h / 2, w, h);
        Draw.rr(ctx, -62, -h / 2 + 12, 124, 26, 13); ctx.fillStyle = col; ctx.fill();
        Draw.text(ctx, chance ? 'CƠ HỘI' : 'KHÍ VẬN', 0, -h / 2 + 26, { size: 15, color: '#fff', stroke: null, weight: 800 });
        Draw.text(ctx, s.card.emo, 0, -h / 2 + 76, { size: 44, stroke: null });
        ctx.font = `800 30px ${FONT}`;
        const tl = wrap(ctx, s.title || s.card.title, w - 40).slice(0, 2), ty = -h / 2 + 128 - (tl.length - 1) * 16;
        tl.forEach((l, j) => { ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; fitText(ctx, l, 0, ty + j * 32, w - 30, 30, 18, 800, dark); ctx.restore(); });
        ctx.fillStyle = col; ctx.globalAlpha = 0.35; ctx.fillRect(-w / 2 + 40, ty + tl.length * 32 - 10, w - 80, 2); ctx.globalAlpha = 1;
        ctx.font = `700 18px ${FONT}`;
        const bl = wrap(ctx, s.card.text, w - 44).slice(0, 3), by = ty + tl.length * 32 + 16;
        bl.forEach((l, j) => Draw.text(ctx, l, 0, by + j * 23, { size: 18, color: '#2b2b2b', stroke: null, weight: 700 }));
        const pl = this.players[s.who];
        Draw.text(ctx, pl && pl.bot ? `🤖 ${pl.name} sẽ làm theo thẻ…` : '👉 Bấm OK để làm theo thẻ', 0, h / 2 - 20, { size: 13, color: '#8a8f96', stroke: null });
      }
      ctx.restore();
      Draw.rr(ctx, -w / 2, -h / 2, w, h, 22); ctx.lineWidth = 7; ctx.strokeStyle = front ? col : '#fff'; ctx.stroke();
      ctx.restore();
      // lấp lánh lúc vừa lật xong
      if (f >= 1 && t - CARD_RISE - CARD_FLIP < 0.6) {
        const q = (t - CARD_RISE - CARD_FLIP) / 0.6;
        ctx.save(); ctx.globalAlpha = 1 - q;
        for (let j = 0; j < 8; j++) { const a = j / 8 * TAU; Draw.sparkle ? Draw.sparkle(ctx, cx + Math.cos(a) * (w / 2 + q * 40), cy + Math.sin(a) * (h / 2 + q * 30), 7, '#ffe14d') : 0; }
        ctx.restore();
      }
    }
    drawAuction(ctx) {
      const s = this.st, d = TILES[s.tile], cx = CX0 + CW / 2;
      // tranh ô đang đấu giá
      ctx.save(); Draw.rr(ctx, cx - 110, CY0 + 22, 220, 100, 12); ctx.clip(); drawPicture(ctx, d, cx - 110, CY0 + 22, 220, 100); ctx.restore();
      Draw.rr(ctx, cx - 110, CY0 + 22, 220, 100, 12); ctx.lineWidth = 3; ctx.strokeStyle = d.t === 'city' ? GROUPS[d.g].color : '#5b6b80'; ctx.stroke();
      Draw.text(ctx, `⏱ Mỗi lần có người trả giá, đồng hồ ${AUCTION_T} giây chạy lại từ đầu`, cx, CY0 + 140, { size: 13, color: '#2b5c4d', stroke: null });
      Draw.text(ctx, `🔨 ĐẤU GIÁ ${d.name}`, cx, CY0 + 170, { size: 22, color: '#c0392b', stroke: '#fff', sw: 4 });
      Draw.text(ctx, `Giá gốc ${money(d.price)}`, cx, CY0 + 196, { size: 14, color: '#2b5c4d', stroke: null });
      Draw.text(ctx, s.who >= 0 ? `${money(s.bid)} — ${this.name(s.who)}` : 'Chưa ai trả giá', cx, CY0 + 236, { size: 30, color: s.who >= 0 ? this.players[s.who].color.dark : '#555', stroke: '#fff', sw: 5 });
      // thanh đếm ngược
      const k = U.clamp(s.left / AUCTION_T, 0, 1);
      Draw.rr(ctx, cx - 150, CY0 + 262, 300, 12, 6); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
      Draw.rr(ctx, cx - 150, CY0 + 262, 300 * k, 12, 6); ctx.fillStyle = k < 0.35 ? '#e74c3c' : '#27ae60'; ctx.fill();
      // phím từng người
      this.alive().forEach((j, n) => {
        const pl = this.players[j], y = CY0 + 300 + n * 30;
        const lb = srcLabels(pl.src);
        const txt = pl.bot ? `${pl.name} 🤖 máy tự trả giá` : `${pl.name}: [${lb.act}] +$10   [${lb.jump}] +$50`;
        Draw.text(ctx, txt, cx, y, { size: 16, color: pl.color.dark, stroke: '#fff', sw: 3 });
        Draw.text(ctx, money(this.ps[j].cash), cx + 200, y, { size: 13, color: '#2b5c4d', stroke: null, align: 'right' });
      });
    }
    drawManage(ctx) {
      const s = this.st, t = s.cursor, cx = CX0 + CW / 2;
      Draw.text(ctx, `🏗️ Tài sản của ${this.name(s.who)} — ${money(this.ps[s.who].cash)}`, cx, CY0 + 40, { size: 18, color: this.players[s.who].color.dark, stroke: '#fff', sw: 4 });
      this.drawTileInfo(ctx, t, false);
      const acts = this.manageActions(s.who, t);
      const x = CX0 + 268, bw = 210, bh = 34;
      Draw.text(ctx, '← → đổi ô của bạn · bấm ô trên bàn', x + bw / 2, CY0 + 80, { size: 12, color: '#2b5c4d', stroke: null });
      const all = acts.concat([{ label: '↩ Xong', fn: () => this.closeManage() }]);
      if (!acts.length) Draw.text(ctx, this.own[t] === s.who ? '' : 'Không phải ô của bạn', x + bw / 2, CY0 + 110, { size: 14, color: '#888', stroke: null });
      all.forEach((a, k) => {
        const y = CY0 + 100 + k * (bh + 8), on = k === s.sel;
        Draw.rr(ctx, x, y, bw, bh, 10);
        ctx.fillStyle = a.dis ? 'rgba(120,120,120,0.3)' : on ? '#ffe14d' : 'rgba(255,255,255,0.92)'; ctx.fill();
        ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? this.players[s.who].color.main : 'rgba(0,0,0,0.25)'; ctx.stroke();
        Draw.text(ctx, a.label, x + bw / 2, y + bh / 2 + 1, { size: 14, color: a.dis ? '#777' : '#2a1840', stroke: null });
        if (on && a.dis && a.why) Draw.text(ctx, a.why, x + bw / 2, y + bh + 6, { size: 11, color: '#c0392b', stroke: null });
        if (on) this.selRect = { x, y, w: bw, h: bh };
        this.btns.push({ x, y, w: bw, h: bh, fn: () => { s.sel = k; if (!a.dis) a.fn(); }, dis: a.dis, sel: k });
      });
      // danh sách nhóm màu đang sở hữu
      const own = BUYABLE.filter((x2) => this.own[x2] === s.who);
      Draw.text(ctx, `Đang có ${own.length} ô · ${GROUPS.filter((_, g) => this.groupOwned(g, s.who)).length} nhóm màu đủ bộ`, cx, CY0 + 350, { size: 14, color: '#24443a', stroke: null });
      if (this.st.back && this.st.back.k === 'debt') {
        const b = this.st.back;
        Draw.text(ctx, `Cần ${money(b.amt)} — đang có ${money(this.ps[s.who].cash)}`, cx, CY0 + 376, { size: 16, color: this.ps[s.who].cash >= b.amt ? '#1e8449' : '#c0392b', stroke: '#fff', sw: 3 });
      }
    }
    drawTrade(ctx) {
      const s = this.st, cx = CX0 + CW / 2;
      if (s.step === 'partner') {
        Draw.text(ctx, `🤝 ${this.name(s.a)} muốn giao dịch với ai?`, cx, CY0 + 60, { size: 20, color: '#2a1840', stroke: '#fff', sw: 4 });
        const others = this.alive().filter((j) => j !== s.a);
        others.concat([-1]).forEach((j, k) => {
          const y = CY0 + 100 + k * 46, on = k === s.sel, bw = 260;
          Draw.rr(ctx, cx - bw / 2, y, bw, 38, 12); ctx.fillStyle = on ? '#ffe14d' : 'rgba(255,255,255,0.92)'; ctx.fill();
          Draw.text(ctx, j < 0 ? '↩ Huỷ' : `${this.name(j)} · ${money(this.ps[j].cash)}`, cx, y + 20, { size: 17, color: j < 0 ? '#555' : this.players[j].color.dark, stroke: null });
          this.btns.push({ x: cx - bw / 2, y, w: bw, h: 38, fn: () => { if (j < 0) this.cancelTrade(); else { s.b = j; s.step = 'edit'; s.col = 0; s.row = 0; } } });
        });
        return;
      }
      if (s.step === 'answer') {
        const d = this.describeTrade(s), x = CX0 + 20, w = CW - 40;
        Draw.rr(ctx, x, CY0 + 150, w, 210, 14); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
        Draw.text(ctx, `🤝 ${this.name(s.a)} đề nghị ${this.name(s.b)}:`, cx, CY0 + 172, { size: 18, color: '#2a1840', stroke: null });
        ctx.font = `700 14px ${FONT}`;
        const L1 = wrap(ctx, `${this.name(s.a)} đưa: ${d.give}`, w - 30), L2 = wrap(ctx, `${this.name(s.b)} đưa: ${d.get}`, w - 30);
        L1.concat(L2).forEach((l, k) => Draw.text(ctx, l, cx, CY0 + 200 + k * 19, { size: 14, color: k < L1.length ? this.players[s.a].color.dark : this.players[s.b].color.dark, stroke: null }));
        ['✅ Đồng ý', '❌ Từ chối'].forEach((lb, k) => {
          const bx = cx - 150 + k * 160, y = CY0 + 312, on = s.sel === k;
          Draw.rr(ctx, bx, y, 140, 36, 12); ctx.fillStyle = on ? '#ffe14d' : '#eee'; ctx.fill();
          ctx.lineWidth = on ? 3 : 1; ctx.strokeStyle = this.players[s.b].color.main; ctx.stroke();
          Draw.text(ctx, lb, bx + 70, y + 19, { size: 16, color: '#2a1840', stroke: null });
          this.btns.push({ x: bx, y, w: 140, h: 36, fn: () => this.answerTrade(k === 0) });
        });
        Draw.text(ctx, `${this.name(s.b)} trả lời bằng phím của mình`, cx, CY0 + 375, { size: 13, color: '#24443a', stroke: null });
        return;
      }
      // màn soạn đề nghị: 2 cột
      Draw.text(ctx, '🤝 Giao dịch — ← → đổi cột (ở dòng tiền: chỉnh số tiền), Đánh = chọn', cx, CY0 + 22, { size: 12, color: '#24443a', stroke: null });
      for (let col = 0; col < 2; col++) {
        const who = col ? s.b : s.a, pack = col ? s.get : s.give, rows = this.tradeRows(col);
        const x = CX0 + 12 + col * (CW / 2), w = CW / 2 - 24, top = CY0 + 40;
        Draw.rr(ctx, x, top, w, CW - 60, 12); ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fill();
        if (s.col === col) { ctx.lineWidth = 3; ctx.strokeStyle = this.players[s.a].color.main; ctx.stroke(); }
        Draw.text(ctx, `${this.name(who)} đưa`, x + w / 2, top + 16, { size: 15, color: this.players[who].color.dark, stroke: null });
        const per = 15, sel = s.col === col ? s.row : -1, first = U.clamp(sel - per + 3, 0, Math.max(0, rows.length - per));
        rows.slice(first, first + per).forEach((r, k) => {
          const idx = first + k, y = top + 32 + k * 25, on = idx === sel;
          if (on) { Draw.rr(ctx, x + 4, y, w - 8, 23, 7); ctx.fillStyle = '#ffe14d'; ctx.fill(); }
          let label = '', col2 = '#2b2b2b';
          if (r.k === 'cash') label = `💵 Tiền: ◀ ${money(pack.cash)} ▶`;
          else if (r.k === 'card') label = `${pack.card ? '☑' : '☐'} 🎫 Thẻ ra tù`;
          else if (r.k === 'prop') {
            const d = TILES[r.t], on2 = pack.props.includes(r.t);
            label = `${on2 ? '☑' : '☐'} ${d.icon} ${d.name}${this.mort[r.t] ? ' (TC)' : ''}`;
            if (d.t === 'city') { ctx.fillStyle = GROUPS[d.g].color; ctx.fillRect(x + 8, y + 6, 6, 12); }
          } else if (r.k === 'send') { label = '📨 Gửi đề nghị'; col2 = '#1e8449'; }
          else { label = '↩ Huỷ'; col2 = '#c0392b'; }
          Draw.text(ctx, label, x + 20, y + 12, { size: 13, align: 'left', color: col2, stroke: null });
          this.btns.push({ x: x + 4, y, w: w - 8, h: 23, fn: () => { s.col = col; s.row = idx; this.tradeToggle(col, r); } });
        });
      }
      if (s.err && s.errT > 0) { s.errT -= 1 / 60; Draw.text(ctx, s.err, cx, CY0 + CW - 10, { size: 14, color: '#c0392b', stroke: '#fff', sw: 3 }); }
    }
    /** nút dưới con trỏ chuột (chỉ khi người thật đang điều khiển) */
    btnAt() {
      const q = this.ptr, c = this.controller();
      if (!q || c < 0 || this.players[c].bot) return null;
      return this.btns.find((r) => q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) || null;
    }
    pressFx(r) { if (r) this.press = { x: r.x, y: r.y, w: r.w, h: r.h, t: 0 }; }
    /** hiệu ứng nút: rê chuột = viền sáng + con trỏ bàn tay; vừa bấm = nháy sáng loé ra */
    drawButtonFx(ctx) {
      const b = this.btnAt();
      try {
        const cv = document.getElementById('cv'), vb = this.is3d() && this.viewBtn, q = this.ptr;
        const onV = vb && q && q.x >= vb.x && q.x <= vb.x + vb.w && q.y >= vb.y && q.y <= vb.y + vb.h;
        if (cv) cv.style.cursor = (b && !b.dis) || onV ? 'pointer' : this.drag3 && this.drag3.moved ? 'grabbing' : (this.hover >= 0 ? 'help' : '');
      } catch (e) { /* bỏ qua */ }
      if (b) {
        ctx.save();
        ctx.shadowColor = b.dis ? 'rgba(0,0,0,0.3)' : '#2e86de'; ctx.shadowBlur = 14;
        Draw.rr(ctx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 13);
        ctx.lineWidth = 3; ctx.strokeStyle = b.dis ? 'rgba(120,120,120,0.8)' : '#2e86de'; ctx.stroke();
        if (!b.dis) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill(); }
        ctx.restore();
      }
      const p = this.press;
      if (p) {
        const k = p.t / 0.3, e = 6 + k * 10;
        ctx.save(); ctx.globalAlpha = 1 - k;
        Draw.rr(ctx, p.x - e, p.y - e, p.w + e * 2, p.h + e * 2, 14 + e);
        ctx.lineWidth = 4; ctx.strokeStyle = '#ffe14d'; ctx.stroke();
        Draw.rr(ctx, p.x, p.y, p.w, p.h, 12); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
        ctx.restore();
      }
    }
    /** bảng lớn "Lượt của …" lúc đổi lượt (bật ra rồi mờ đi) */
    drawTurnFx(ctx) {
      const f = this.turnFx;
      if (!f || this.finished || f.t < 0) return;
      const pl = this.players[f.i], k = f.t / TURN_FX_T;
      const pop = k < 0.18 ? U.outBack(k / 0.18) : 1, a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const cx = CX0 + CW / 2, cy = CY0 + CW / 2 - 20, w = 380, h = 112;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(pop, pop);
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24;
      Draw.rr(ctx, -w / 2, -h / 2, w, h, 22); ctx.fillStyle = pl.color.main; ctx.fill();
      ctx.shadowBlur = 0; ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
      Draw.blob(ctx, { x: -w / 2 + 62, y: 6, r: 34, color: pl.color, face: Math.PI / 2, shadow: false });
      Draw.text(ctx, 'ĐẾN LƯỢT', 46, -22, { size: 20, color: '#fff', stroke: 'rgba(0,0,0,0.35)', sw: 3 });
      Draw.text(ctx, pl.name + (pl.bot ? ' 🤖' : ''), 46, 18, { size: 40, color: '#fff', stroke: 'rgba(0,0,0,0.4)', sw: 5 });
      ctx.restore();
    }
    /** bảng "Phím của bạn" (mỗi người thật: chấm màu + tên, rồi các phím tự xuống dòng) — trả chiều cao; draw=false chỉ đo */
    drawKeys(ctx, x, y, w, draw) {
      const rows = typeof App !== 'undefined' && App.helpRows ? App.helpRows() : [];
      if (!rows.length) return 0;
      const fs = 12.5, kh = 19, lh = 23, pad = 10;
      ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      // xếp chữ: mỗi người 1 dòng tên + các cặp [phím] nhãn, hết chỗ thì xuống dòng
      const items = [];
      let cy = 38;
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
      const tip = 'Esc: tạm dừng · chuột: bấm nút, rê lên ô';
      const h = cy + 8;
      if (draw) {
        Draw.rr(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(30,22,58,0.9)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,225,77,0.7)'; ctx.stroke();
        ctx.font = `800 14px ${FONT}`; ctx.fillStyle = '#ffe14d'; ctx.fillText('🎮 Phím của bạn', x + pad, y + 15);
        for (const it of items) {
          if (it.t === 'name') {
            ctx.fillStyle = it.r.p.color.main; ctx.beginPath(); ctx.arc(x + it.x + 6, y + it.y, 6, 0, TAU); ctx.fill();
            ctx.font = `800 ${fs + 1}px ${FONT}`; ctx.fillStyle = it.r.p.color.light; ctx.fillText(it.r.p.name, x + it.x + 16, y + it.y + 1);
          } else {
            Draw.rr(ctx, x + it.x, y + it.y - kh / 2, it.kw, kh, 5); ctx.fillStyle = '#fff'; ctx.fill();
            ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = '#2a1840'; ctx.fillText(it.key, x + it.x + 5, y + it.y + 1);
            ctx.font = `600 ${fs}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(it.label, x + it.x + it.kw + 4, y + it.y + 1);
          }
        }
        ctx.font = `600 11px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(tip, x + pad, y + h - 12);
      }
      ctx.restore();
      return h + 12;
    }
    /** cột trái trong lòng bàn: thẻ người chơi · cột phải: vòng, ngân hàng, nhật ký */
    drawPanel(ctx) {
      const w = SIDE_W;
      this.players.forEach((pl, i) => {
        const p = this.ps[i], x = LX, y = this.cardY(i), active = !this.finished && this.cur === i && !p.out;
        ctx.save();
        if (active) { ctx.shadowColor = pl.color.main; ctx.shadowBlur = 18; }
        Draw.rr(ctx, x, y, w, CARD_H, 14); ctx.fillStyle = active ? '#ffffff' : 'rgba(255,255,255,0.82)'; ctx.fill();
        ctx.restore();
        ctx.lineWidth = active ? 4 + 1.5 * Math.sin(this.t * 6) : 2; ctx.strokeStyle = active ? pl.color.main : 'rgba(43,58,51,0.25)';
        Draw.rr(ctx, x, y, w, CARD_H, 14); ctx.stroke();
        ctx.save(); Draw.rr(ctx, x, y, w, CARD_H, 14); ctx.clip(); ctx.fillStyle = pl.color.main; ctx.fillRect(x, y, 7, CARD_H); ctx.restore();
        Draw.blob(ctx, { x: x + 36, y: y + 36, r: 21, color: pl.color, face: Math.PI / 2, shadow: false, dead: p.out });
        if (active) Draw.text(ctx, '▶', x + 14, y + 36, { size: 13, color: pl.color.dark, stroke: null });
        ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        fitText(ctx, pl.name + (pl.bot ? ` 🤖 ${BOT_LEVELS[this.level(i)].name}` : ''), x + 64, y + 20, w - (active ? 160 : 72), 17, 11, 800, pl.color.dark);
        ctx.restore();
        if (active) {
          Draw.rr(ctx, x + w - 92, y + 8, 84, 24, 12); ctx.fillStyle = pl.color.main; ctx.fill();
          Draw.text(ctx, '🎲 ĐẾN LƯỢT', x + w - 50, y + 20.5, { size: 12, color: '#fff', stroke: 'rgba(0,0,0,0.3)', sw: 2 });
        }
        Draw.text(ctx, p.out ? '💥 Phá sản' : money(p.cash), x + 64, y + 48, { size: 26, align: 'left', color: p.out ? '#c0392b' : '#1d7a3a', stroke: null, weight: 800 });
        if (!p.out) Draw.text(ctx, `tài sản ${money(this.worth(i))}`, x + w - 10, y + 52, { size: 12, align: 'right', color: '#5a6b63', stroke: null });
        const tags = (p.jail ? `🔒 tù ${p.jailTurns}/3 ` : '') + (p.cards.length ? `🎫×${p.cards.length}` : '');
        if (tags) Draw.text(ctx, tags, x + w - 10, y + (active ? 40 : 32), { size: 13, align: 'right', color: '#2b3a33', stroke: null });
        // ô sở hữu: 28 ô nhỏ theo thứ tự trên bàn, 2 hàng × 14
        BUYABLE.forEach((t, k) => {
          const d = TILES[t], sx = x + 14 + (k % 14) * 17, sy = y + 72 + Math.floor(k / 14) * 22;
          const mine = this.own[t] === i;
          ctx.fillStyle = mine ? (d.t === 'city' ? GROUPS[d.g].color : '#7f93a8') : 'rgba(43,58,51,0.1)';
          ctx.fillRect(sx, sy, 14, 18);
          if (mine && this.mort[t]) { ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy + 18); ctx.lineTo(sx + 14, sy); ctx.stroke(); }
          if (mine && this.lvl[t]) Draw.text(ctx, this.lvl[t] === 5 ? 'K' : String(this.lvl[t]), sx + 7, sy + 9.5, { size: 11, color: '#fff', stroke: '#000', sw: 2 });
        });
        if (p.out) { ctx.fillStyle = 'rgba(60,60,70,0.35)'; Draw.rr(ctx, x, y, w, CARD_H, 14); ctx.fill(); }
      });
      // cột phải: vòng + ngân hàng
      const x = RX, y0 = IY0 + 6;
      Draw.rr(ctx, x, y0, w, 64, 14); ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(43,58,51,0.25)'; ctx.stroke();
      const info = this.quick ? `Vòng ${Math.min(this.round, this.mRounds)} / ${this.mRounds}` : `Vòng ${this.round}`;
      Draw.text(ctx, info, x + w / 2, y0 + 20, { size: 20, color: '#2b5c4d', stroke: null, weight: 800 });
      Draw.text(ctx, `Ngân hàng còn 🏠 ${this.housesLeft} nhà · 🏨 ${this.hotelsLeft} KS`, x + w / 2, y0 + 46, { size: 13, color: '#4a5d55', stroke: null });
      // bảng phím của người thật ở đáy cột phải, nhật ký chiếm phần còn lại
      const kh = this.drawKeys(ctx, x, 0, w, false), ky = IY0 + IH - 8 - kh;
      if (kh) this.drawKeys(ctx, x, ky, w, true);
      // nhật ký (tự xuống dòng)
      const ly = y0 + 74, lh = (kh ? ky - 8 : IY0 + IH - 8) - ly;
      Draw.rr(ctx, x, ly, w, lh, 14); ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fill(); ctx.stroke();
      Draw.text(ctx, '📜 Diễn biến', x + 12, ly + 16, { size: 15, align: 'left', color: '#2b5c4d', stroke: null, weight: 800 });
      ctx.font = `600 13px ${FONT}`;
      const lines = [];
      for (const l of this.log.slice(-14)) wrap(ctx, l, w - 22).forEach((t, k) => lines.push({ t, first: k === 0 }));
      const rows = Math.max(1, Math.floor((lh - 36) / 18));
      const show = lines.slice(-rows);
      ctx.save(); Draw.rr(ctx, x, ly, w, lh, 14); ctx.clip();
      show.forEach((l, k) => Draw.text(ctx, l.t, x + (l.first ? 12 : 22), ly + 38 + k * 18, { size: 13, align: 'left', color: k === show.length - 1 ? '#1d2b25' : '#3d4f47', stroke: null, weight: k === show.length - 1 ? 700 : 600 }));
      ctx.restore();
    }
  }

  Party.register({
    id: 'monopoly', name: 'Cờ Tỷ Phú 3D', emoji: '🎩', cat: 'board',
    tagline: 'Bàn cờ 3D giữa phố: mua thành phố khắp thế giới, xây nhà, thu tiền thuê, đẩy đối thủ phá sản. 2–4 người.',
    how: 'Gieo xúc xắc đi quanh bàn. Ô chưa có chủ: mua hoặc đem đấu giá (mọi người cùng bấm phím trả giá). Đủ cả nhóm màu thì xây nhà, khách sạn để thu tiền thuê cao. Thiếu tiền phải bán nhà / thế chấp, hết cách thì phá sản. Có tù, thẻ Cơ hội / Khí vận, giao dịch đất – tiền với người khác. Menu ở góc trái dưới (bàn phẳng: giữa bàn): Lên/Xuống chọn, Đánh đồng ý, Nhảy quay lại. Kéo chuột trên bàn 3D để xoay / nghiêng.',
    controls: { move: 'Chọn trong menu', act: 'Đồng ý · Đấu giá +$10', jump: 'Quay lại · Đấu giá +$50' },
    helpExtra: '🖱️ chuột: bấm nút, rê lên ô xem thông tin',
    minPlayers: 2, maxPlayers: 4, rawBot: true,
    modes: [
      { id: 'quick', name: 'Ván nhanh', icon: '⚡', desc: 'Chia sẵn 2 thành phố mỗi người, 3 nhà là lên khách sạn, giới hạn số vòng theo độ dài ván (Ngắn/Vừa/Dài ở sảnh). Hết vòng hoặc có 2 người phá sản → ai nhiều tài sản nhất thắng.' },
      { id: 'full', name: 'Ván đầy đủ', icon: '🏆', desc: 'Luật đầy đủ: chơi tới khi chỉ còn 1 người không phá sản (tối đa 100 vòng). Ván dài — game tự lưu sau mỗi lượt, lần sau mở lại được chơi tiếp.' },
    ],
    options: [
      { id: 'view', label: 'Bàn cờ', items: [
        { id: '3d', name: '3D', icon: '🧊', desc: 'Bàn cờ 3D giữa phố phường — kéo chuột để xoay, nghiêng' },
        { id: 'lite', name: '3D nhẹ', icon: '🪶', desc: 'Bàn 3D, tắt bóng đổ và giảm độ nét cho máy yếu' },
        { id: '2d', name: 'Phẳng', icon: '🗺️', desc: 'Bàn phẳng phủ kín màn hình (không cần card đồ hoạ)' }] },
      { id: 'speed', label: 'Tốc độ lượt', items: [
        { id: 'normal', name: 'Thong thả', icon: '☕', desc: 'Chơi chill: xúc xắc dừng lâu, quân đi từ từ, máy nghĩ chậm rãi' },
        { id: 'fast', name: 'Nhanh', icon: '🏃', desc: 'Tua nhanh hiệu ứng và lượt của máy' }] },
    ],
    create: (api) => new Monopoly(api),
  });
})();

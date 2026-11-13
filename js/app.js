'use strict';
/* =========================================================
   Tròn Party — điều khiển luồng: sảnh (người thật), menu, intro (đội hình + máy), chơi, kết quả
   ========================================================= */

/** biểu tượng cho thẻ chế độ ở màn intro (game có thể tự khai báo `icon` trong modes) */
const MODE_ICONS = {
  'baseball:classic': '🤖', 'baseball:pitcher': '🧢',
  'boss:classic': '🟣', 'boss:fire': '🔥', 'boss:ice': '❄️', 'boss:fly': '🦅', 'boss:random': '🎲',
  'fencing:points': '🎯', 'fencing:march': '🚩', 'paint:ffa': '🎨', 'paint:team': '🤝',
  'race:race': '🏁', 'race:balloon': '🎈', 'soccer:real': '⚽', 'soccer:shootout': '🥅', 'soccer:fun': '🎉',
  'spotlight:lights': '💡', 'spotlight:hunter': '🔦', 'stack:classic': '🧱', 'stack:physics': '🌀',
  'tank:ffa': '💥', 'tank:ctf': '🚩', 'tiles:waves': '🌊', 'tiles:step': '👣', 'tron:walls': '🧱', 'tron:wrap': '🌀',
  rounds: '🥊', team: '🤝', stocks: '❤️', koth: '👑', train: '🎯', random: '🎲', classic: '⭐',
};
const HELP_FLOAT_T = 12; // số giây đầu ván hiện nhãn phím ngay dưới nhân vật của từng người
const LV_SHORT = { easy: 'Dễ', normal: 'TB', hard: 'Khó' }; // nút mức máy ở màn giới thiệu
const modeIcon = (gid, m) => m.icon || MODE_ICONS[`${gid}:${m.id}`] || MODE_ICONS[m.id] || '🎮';

const App = {
  state: 'title',
  slots: [null, null, null, null],
  picking: -1, editing: -1, leaveT: [0, 0, 0, 0],
  players: [],
  def: null, inst: null, api: null, res: null,
  ready: [],
  cd: 0, lastCount: 0, goT: 0, endT: 0, endAge: 0,
  lock: 0,              // khóa nút menu ngắn sau khi mở màn hình (tránh bấm nhầm)
  focused: null,
  bg: [],
  lastPadCount: 0,
  lenLevel: 'normal',
  gameMode: {},          // chế độ đã chọn cho từng game (vd { sumo: 'stocks' })
  seats: null,           // đội hình ván đang mở: [{ h: ô sảnh } | { bot: true, level }]
  bench: [],             // người thật đang nghỉ ván này (ô sảnh)
  tauntCd: [],           // hồi chiêu biểu cảm từng người (ALL12)
  helpOn: false,         // dải phím đầy đủ ở mép dưới lúc chơi (phím H bật/tắt, nhớ localStorage)
  fast: false,           // ALL9 đột biến "Tua nhanh ×1,3" bật ở sảnh (lưu localStorage)
  speedMul: 1,           // hệ số tốc độ của ván đang chơi

  init() {
    try { const ln = localStorage.getItem('tronparty.lenLevel'); if (GAME_LENGTHS[ln]) this.lenLevel = ln; } catch (e) { /* bỏ qua */ }
    try { this.gameMode = JSON.parse(localStorage.getItem('tronparty.modes') || '{}') || {}; } catch (e) { this.gameMode = {}; }
    try { this.gameVariant = JSON.parse(localStorage.getItem('tronparty.variants') || '{}') || {}; } catch (e) { this.gameVariant = {}; }
    try { this.gameOpts = JSON.parse(localStorage.getItem('tronparty.opts') || '{}') || {}; } catch (e) { this.gameOpts = {}; }
    try { this.fast = localStorage.getItem('tronparty.fast') === '1'; } catch (e) { /* bỏ qua */ }
    try { this.helpOn = localStorage.getItem('tronparty.helpbar') === '1'; } catch (e) { /* bỏ qua */ }
    loadKeys(); // ALL14: bộ phím đã đổi
    this.loadProfiles(); // tên + màu từng ô
    // rung tay cầm (ALL11): rung màn hình → rung nhẹ mọi tay cầm người thật; Party.rumble(i) → rung mạnh tay cầm người đó
    FX.onShake = (a) => {
      if (!['play', 'ending'].includes(this.state) || a < 4) return;
      for (const p of this.players) if (!p.bot && p.src && p.src.type === 'pad') Input.rumble(p.src.index, Math.min(0.45, a / 30), 90 + a * 6);
    };
    Party.onRumble = (i, st, ms) => {
      const p = this.players[i];
      if (p && !p.bot && p.src && p.src.type === 'pad' && ['play', 'ending'].includes(this.state)) Input.rumble(p.src.index, st, ms);
    };
    this.cv = document.getElementById('cv');
    this.ctx = this.cv.getContext('2d');
    this.ui = document.getElementById('ui');
    Input.init();
    this.fit();
    addEventListener('resize', () => this.fit());
    this.ui.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      Sfx.ensure();
      this.action(b.dataset.act, b);
    });
    // BRD1: chuột trên canvas → game (nếu game có onPointer), toạ độ theo hệ 1280×720
    const ptr = (type) => (e) => {
      const g = this.inst;
      if (!g || !g.onPointer || !['play', 'ending'].includes(this.state)) return;
      const r = this.cv.getBoundingClientRect();
      g.onPointer((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height, type, e);
    };
    this.cv.addEventListener('pointerdown', (e) => { Sfx.ensure(); ptr('down')(e); });
    this.cv.addEventListener('pointermove', ptr('move'));
    addEventListener('pointerup', ptr('up'));
    this.cv.addEventListener('contextmenu', (e) => { if (this.inst && this.inst.onPointer && this.state === 'play') e.preventDefault(); });
    this.ui.addEventListener('mouseover', (e) => {
      const b = e.target.closest('.btn');
      if (b && !b.disabled) this.setFocus(b, false);
    });
    for (let i = 0; i < 7; i++) this.bg.push(this.newBgBlob(i));
    this.show('s-title');
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.033, Math.max(0, (t - last) / 1000));
      last = t;
      try {
        Input.poll();
        this.update(dt);
        this.render(dt);
      } catch (err) { console.error(err); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  fit() {
    const k = Math.min(innerWidth / W, innerHeight / H);
    document.getElementById('stage').style.transform = `translate(-50%,-50%) scale(${k})`;
  },

  /* ---------- Màn hình & điều hướng ---------- */
  show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    this.screen = id;
    this.lock = 0.25;
    const els = this.focusables();
    this.setFocus(els.find((e) => e.classList.contains('primary')) || els[0] || null, false);
  },
  hideAll() {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    this.screen = null;
  },
  focusables() {
    const s = this.screen && document.getElementById(this.screen);
    return s ? [...s.querySelectorAll('.btn:not([disabled])')] : [];
  },
  setFocus(el, sound = true) {
    if (this.focused === el) return;
    if (this.focused) this.focused.classList.remove('focus');
    this.focused = el;
    if (el) {
      el.classList.add('focus'); if (sound) Sfx.play('move');
      // tự cuộn danh sách game để thấy thẻ đang chọn
      const box = el.closest('.games');
      if (box) {
        if (el.offsetTop < box.scrollTop + 8) box.scrollTop = el.offsetTop - 10;
        else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight - 8) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight + 12;
      }
    }
  },
  nav(dir) {
    const els = this.focusables();
    if (!els.length) return;
    if (!this.focused || !els.includes(this.focused)) { this.setFocus(els[0]); return; }
    const r = this.focused.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bs = Infinity;
    for (const e of els) {
      if (e === this.focused) continue;
      const q = e.getBoundingClientRect();
      const dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
      let main, cross;
      if (dir === 'right') { main = dx; cross = dy; }
      else if (dir === 'left') { main = -dx; cross = dy; }
      else if (dir === 'down') { main = dy; cross = dx; }
      else { main = -dy; cross = dx; }
      if (main <= 4) continue;
      const score = main + Math.abs(cross) * 2.2;
      if (score < bs) { bs = score; best = e; }
    }
    if (best) this.setFocus(best);
  },
  menuInput(allowAct) {
    const m = Input.menu();
    if (m.up) this.nav('up');
    if (m.down) this.nav('down');
    if (m.left) this.nav('left');
    if (m.right) this.nav('right');
    if (this.lock > 0) return m;
    if ((m.enter || m.start || (allowAct && m.act)) && this.focused) {
      Sfx.ensure();
      this.focused.click();
    }
    return m;
  },

  /* ---------- Hành động nút ---------- */
  action(a, el) {
    Sfx.play('select');
    switch (a) {
      case 'start': this.openLobby(); break;
      case 'fullscreen':
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.().catch(() => {});
        break;
      case 'mute':
        Sfx.muted = !Sfx.muted;
        document.getElementById('mute').textContent = Sfx.muted ? '🔇' : '🔊';
        break;
      case 'lobby-back': this.show('s-title'); this.state = 'title'; break;
      case 'slot-human': this.picking = +el.dataset.s; this.renderLobby('[data-act="slot-kb"]'); break;
      case 'slot-kb': this.join({ type: 'kb', scheme: +el.dataset.k }, +el.dataset.s); break;
      case 'slot-cancel': { const s = this.picking; this.picking = -1; this.renderLobby(`[data-act="slot-human"][data-s="${s}"]`); break; }
      case 'slot-rm': this.removeSlot(+el.dataset.s); break;
      case 'slot-color': this.cycleColor(+el.dataset.s); break;
      case 'slot-name': this.startRename(+el.dataset.s); break;
      case 'len-level': {
        this.lenLevel = LEN_ORDER[(LEN_ORDER.indexOf(this.lenLevel) + 1) % LEN_ORDER.length];
        try { localStorage.setItem('tronparty.lenLevel', this.lenLevel); } catch (e) { /* bỏ qua */ }
        this.renderLobby();
        break;
      }
      case 'speed': {
        this.fast = !this.fast;
        try { localStorage.setItem('tronparty.fast', this.fast ? '1' : '0'); } catch (e) { /* bỏ qua */ }
        this.renderLobby();
        break;
      }
      case 'lobby-next':
        if (this.slots.some(Boolean)) this.openMenu();
        break;
      case 'menu-back': this.openLobby(); break;
      case 'pick': {
        const def = Party.games.find((g) => g.id === el.dataset.id);
        this.startGame(def);
        break;
      }
      case 'cat': {
        this.menuCat = el.dataset.cat;
        this.renderMenu();
        this.setFocus(document.querySelector(`#cats [data-cat="${this.menuCat}"]`), false);
        break;
      }
      case 'resume': this.hideAll(); this.state = 'play'; break;
      case 'restart': this.startGame(this.def, { keep: true }); break;
      case 'quit': this.openMenu(); break;
      case 'replay': this.startGame(this.def, { keep: true }); break;
      case 'menu': this.openMenu(); break;
      case 'keys': this.openKeys(); break;
      case 'keys-back': this.keyWait = null; this.openLobby(); break;
      case 'keys-reset': resetKeys(); this.keyWait = null; this.renderKeys('keys-reset'); break;
      case 'bind': this.keyWait = { s: +el.dataset.s, a: el.dataset.a, t: 0.15 }; this.renderKeys(); break;
      case 'go': this.beginCountdown(); break;
      case 'mode': this.cycleMode(); break;
      case 'mode-set': this.setMode(el.dataset.mode); break;
      case 'variant-set': this.setVariant(el.dataset.variant); break;
      case 'opt-set': this.setOpt(el.dataset.opt, el.dataset.val); break;
      case 'intro-back': this.openMenu(); break;
      // đội hình ở màn giới thiệu: thêm/bớt máy, mức từng máy, người thật nghỉ / vào chơi
      case 'r-add': this.seatEdit('add'); break;
      case 'r-rm': this.seatEdit('rm', +el.dataset.k); break;
      case 'r-lv': this.seatEdit('lv', +el.dataset.k, el.dataset.lv); break;
      case 'r-bench': this.seatEdit('bench', +el.dataset.k); break;
      case 'r-in': this.seatEdit('in', +el.dataset.s); break;
    }
  },

  /* ---------- Sảnh ---------- */
  openLobby() {
    this.state = 'lobby';
    this.inst = null; this.picking = -1; this.editing = -1;
    // tên/màu có thể vừa đổi: cập nhật người đang ở trong ô
    this.slots.forEach((p, s) => { if (p) { p.name = this.profiles[s].name || 'P' + (s + 1); p.color = COLOR_CHOICES[this.profiles[s].color]; } });
    this.renderLobby();
    this.show('s-lobby');
  },
  sameSrc(a, b) { return a && b && a.type === b.type && (a.type === 'kb' ? a.scheme === b.scheme : a.index === b.index); },
  /* hồ sơ từng ô (tên + màu) — nhớ trong localStorage 'tronparty.profiles' */
  loadProfiles() {
    this.profiles = [0, 1, 2, 3].map((s) => ({ name: '', color: s }));
    try {
      const a = JSON.parse(localStorage.getItem('tronparty.profiles') || 'null');
      if (Array.isArray(a)) a.slice(0, 4).forEach((p, s) => {
        if (p && typeof p.name === 'string') this.profiles[s].name = p.name.slice(0, NAME_MAX);
        if (p && Number.isInteger(p.color) && p.color >= 0 && p.color < COLOR_CHOICES.length) this.profiles[s].color = p.color;
      });
    } catch (e) { /* bỏ qua */ }
  },
  saveProfiles() { try { localStorage.setItem('tronparty.profiles', JSON.stringify(this.profiles)); } catch (e) { /* bỏ qua */ } },
  /** vào ô s (mặc định: ô trống đầu tiên, hoặc ô đang chọn bộ phím, hoặc thay một máy) */
  join(src, slot) {
    if (this.slots.some((p) => p && this.sameSrc(p.src, src))) return;
    let s = slot ?? (this.picking >= 0 && !this.slots[this.picking] ? this.picking : this.slots.findIndex((p) => !p));
    if (s < 0) return;
    this.slots[s] = this.makePlayer(s, src, false);
    this.picking = -1;
    Sfx.play('join');
    this.renderLobby();
  },
  removeSlot(s) {
    if (!this.slots[s]) return;
    this.slots[s] = null; this.leaveT[s] = 0;
    Sfx.play('leave');
    this.renderLobby();
  },
  makePlayer(s, src, bot) {
    const pf = this.profiles[s];
    return { slot: s, color: COLOR_CHOICES[pf.color], name: pf.name || 'P' + (s + 1), src, bot };
  },
  /** đổi sang màu kế tiếp chưa ai dùng */
  cycleColor(s) {
    const used = this.slots.map((p, j) => (p && j !== s ? this.profiles[j].color : -1));
    let c = this.profiles[s].color;
    for (let k = 0; k < COLOR_CHOICES.length; k++) { c = (c + 1) % COLOR_CHOICES.length; if (!used.includes(c)) break; }
    this.profiles[s].color = c; this.saveProfiles();
    if (this.slots[s]) this.slots[s].color = COLOR_CHOICES[c];
    Sfx.tone(500 + c * 60, 0.06, 'sine', 0.06);
    this.renderLobby(`[data-act="slot-color"][data-s="${s}"]`);
  },
  startRename(s) {
    this.editing = s;
    this.renderLobby();
    const inp = document.getElementById('nm-input');
    if (!inp) return;
    inp.focus(); inp.select();
    const done = (save) => {
      if (this.editing !== s) return;
      this.editing = -1;
      if (save) {
        const v = inp.value.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
        this.profiles[s].name = v; this.saveProfiles();
        if (this.slots[s]) this.slots[s].name = v || 'P' + (s + 1);
        Sfx.play('pickup');
      }
      this.lock = 0.25;
      this.renderLobby(`[data-act="slot-name"][data-s="${s}"]`);
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.preventDefault(); done(false); } });
    inp.addEventListener('blur', () => done(true));
  },
  blobHTML(c, cls = '') {
    return `<i class="blob ${cls}" style="--c:${c.main};--d:${c.dark};--l:${c.light}"></i>`;
  },
  renderLobby(focusSel) {
    const el = document.getElementById('slots');
    const used = (src) => this.slots.some((p) => p && this.sameSrc(p.src, src));
    el.innerHTML = this.slots.map((p, s) => {
      const c = p ? p.color : COLOR_CHOICES[this.profiles[s].color];
      const style = `--c:${c.main};--d:${c.dark};--l:${c.light}`;
      if (!p && this.picking === s) {
        // đang chọn bộ phím cho ô này
        const free = KB_SCHEMES.map((sc, i) => (used({ type: 'kb', scheme: i }) ? '' :
          `<button class="btn small" data-act="slot-kb" data-s="${s}" data-k="${i}">⌨️ ${sc.labels.move}</button>`)).join('');
        return `<div class="slot pick" style="${style}">
          <div class="nm small">P${s + 1} dùng phím nào?</div>
          <div class="pickgrid">${free || '<span class="empty">Hết bộ phím trống</span>'}</div>
          <div class="keys">🎮 Tay cầm: bấm <b>A</b></div>
          <button class="btn small" data-act="slot-cancel">Huỷ</button></div>`;
      }
      if (!p) {
        return `<div class="slot" style="${style}">
          <div class="plus">＋</div>
          <div class="empty">Ô trống · P${s + 1}</div>
          <div class="row tight"><button class="btn small" data-act="slot-human" data-s="${s}">🙋 Người chơi</button></div></div>`;
      }
      const lb = srcLabels(p.src);
      const keys = p.bot ? 'Máy tự chơi' :
        `Đi: <kbd>${lb.move}</kbd><br>Đánh: <kbd>${lb.act}</kbd> · Nhảy: <kbd>${lb.jump}</kbd>`;
      const test = p.bot ? '' : `<div class="ktest" id="kt${s}">${[['up', '↑'], ['down', '↓'], ['left', '←'], ['right', '→'], ['act', 'Đánh'], ['jump', 'Nhảy']].map(([a, t]) => `<b data-k="${a}">${t}</b>`).join('')}</div>
        <div class="leavebar" id="lv${s}"><i></i><span>Giữ Nhảy để rời</span></div>`;
      const nameEl = this.editing === s
        ? `<input id="nm-input" class="nm-input" maxlength="${NAME_MAX}" value="${p.name.replace(/"/g, '&quot;')}" placeholder="P${s + 1}" autocomplete="off" spellcheck="false">`
        : `<button class="btn nmbtn" data-act="slot-name" data-s="${s}" title="Đổi tên">${p.name.replace(/</g, '&lt;')} <small>✏️</small></button>`;
      return `<div class="slot on" style="${style}">
        <button class="btn xbtn" data-act="slot-rm" data-s="${s}" title="Xoá người chơi">✕</button>
        <button class="btn blobbtn" data-act="slot-color" data-s="${s}" title="Đổi màu">${this.blobHTML(c, 'lg')}</button>
        ${nameEl}
        <div class="src">${p.bot ? '🤖 Máy' : (p.src.type === 'pad' ? '🎮 ' : '⌨️ ') + srcName(p.src)}</div>
        <div class="keys">${keys}</div>${test}</div>`;
    }).join('');

    const sch = KB_SCHEMES.map((sc, i) =>
      `<div class="scheme ${used({ type: 'kb', scheme: i }) ? 'used' : ''}">⌨️ ${sc.labels.move} · vào: <b>${sc.labels.act}</b></div>`).join('');
    const pc = Input.padCount();
    this.lastPadCount = pc;
    document.getElementById('schemes').innerHTML = sch +
      `<div class="scheme">🎮 Tay cầm (${pc} đã cắm) · vào: <b>A</b></div>`;

    const L = GAME_LENGTHS[this.lenLevel];
    document.getElementById('btn-len-level').textContent = `${L.icon} Ván: ${L.name}`;
    document.getElementById('btn-speed').textContent = this.fast ? '⚡ Tua nhanh ×1,3' : '🐢 Tốc độ thường';
    const n = this.slots.filter(Boolean).length;
    const btn = document.getElementById('btn-lobby-next');
    btn.disabled = n < 1;
    btn.textContent = n < 1 ? 'Cần ít nhất 1 người' : `Chọn game → (${n} người)`;
    const want = focusSel && document.querySelector(`#s-lobby ${focusSel}`);
    if (want) this.setFocus(want, false);
    else if (!this.focused || this.focused.disabled || !document.body.contains(this.focused)) {
      const els = this.focusables();
      this.setFocus(els.find((e) => e.classList.contains('primary') && !e.disabled) || els[0] || null, false);
    }
  },
  lobbyInput(dt) {
    if (this.editing >= 0) return;
    KB_SCHEMES.forEach((sc, i) => { if (Input.hit(sc.keys.act)) this.join({ type: 'kb', scheme: i }); });
    for (let i = 0; i < 4; i++) if (Input.padHit(i, 0)) this.join({ type: 'pad', index: i });
    // giữ Nhảy 1 giây để rời (chạm nhẹ thì không sao — để còn thử phím)
    this.slots.forEach((p, s) => {
      if (!p || p.bot) return;
      const st = this.rawState(p.src);
      this.leaveT[s] = st.jump ? (this.leaveT[s] || 0) + dt : 0;
      const bar = document.getElementById('lv' + s);
      if (bar) { bar.classList.toggle('on', this.leaveT[s] > 0.15); bar.firstElementChild.style.width = Math.min(100, this.leaveT[s] * 100) + '%'; }
      if (this.leaveT[s] >= 1) this.removeSlot(s);
    });
    if (Input.padCount() !== this.lastPadCount) this.renderLobby();
    this.updateKeyTest();
  },
  /** ALL14: thử phím — sáng ô phím đang được nhận của từng người, liệt kê mọi phím đang giữ (phát hiện bàn phím kẹt) */
  rawState(src) {
    if (src.type === 'kb') { const k = KB_SCHEMES[src.scheme].keys; const o = {}; KEY_ACTIONS.forEach(([a]) => { o[a] = Input.key(k[a]); }); return o; }
    const p = Input.pads[src.index];
    if (!p || !p.connected) return {};
    return { up: p.y < -0.5, down: p.y > 0.5, left: p.x < -0.5, right: p.x > 0.5, act: !!(p.b[0] || p.b[2]), jump: !!(p.b[1] || p.b[3]) };
  },
  updateKeyTest() {
    this.slots.forEach((p, s) => {
      const el = p && !p.bot && document.getElementById('kt' + s);
      if (!el) return;
      const st = this.rawState(p.src);
      el.querySelectorAll('b').forEach((b) => b.classList.toggle('on', !!st[b.dataset.k]));
    });
    const live = document.getElementById('kb-live');
    if (live) {
      const held = [...Input.down];
      const txt = held.length ? `⌨️ Bàn phím đang nhận ${held.length} phím: ${held.map(keyName).join(' · ')}` : '⌨️ Thử phím: giữ các phím cùng lúc — phím nào không sáng là bàn phím bị kẹt (ghosting)';
      if (live.textContent !== txt) live.textContent = txt;
    }
  },

  /* ---------- Đổi phím (ALL14) ---------- */
  openKeys() {
    this.state = 'keys'; this.keyWait = null; this.keyMsg = '';
    this.renderKeys();
    this.show('s-keys');
  },
  renderKeys(keepFocus) {
    const w = this.keyWait;
    const head = KB_SCHEMES.map((sc, i) => `<th>⌨️ Bộ ${i + 1}<br><small>${KB_DEFAULT[i] && sc.name}</small></th>`).join('');
    const rows = KEY_ACTIONS.map(([a, nm]) => `<tr><td><b>${nm}</b></td>${KB_SCHEMES.map((sc, i) => {
      const wait = w && w.s === i && w.a === a;
      return `<td><button class="btn key ${wait ? 'wait' : ''}" data-act="bind" data-s="${i}" data-a="${a}" id="kb-${i}-${a}">${wait ? 'Nhấn phím…' : keyName(sc.keys[a])}</button></td>`;
    }).join('')}</tr>`).join('');
    document.getElementById('keys-card').innerHTML = `
      <h2>⌨️ Đổi phím</h2>
      <p class="tag">Chọn một ô rồi nhấn phím mới (Esc để huỷ). Phím đang dùng ở ô khác sẽ được đổi chỗ. Ô sáng lên khi phím đang được giữ.</p>
      <table class="ctl keys-tb"><tr><th></th>${head}</tr>${rows}</table>
      <p class="tag key-msg">${this.keyMsg || '&nbsp;'}</p>
      <div class="row"><button class="btn" data-act="keys-back">← Về sảnh</button>
        <button class="btn" data-act="keys-reset">↺ Khôi phục mặc định</button></div>`;
    const sel = keepFocus ? `[data-act="${keepFocus}"]` : w ? `#kb-${w.s}-${w.a}` : null;
    if (sel) this.setFocus(document.querySelector(`#keys-card ${sel}`), false);
  },
  updateKeys(dt) {
    const w = this.keyWait;
    if (w) {
      w.t -= dt;
      if (w.t > 0) return;
      const code = [...Input.just][0];
      if (!code) { this.padBack(); return; }
      if (code === 'Escape') { this.keyWait = null; this.keyMsg = 'Đã huỷ'; }
      else if (RESERVED_KEYS.includes(code)) { this.keyMsg = `Phím ${keyName(code)} dành cho menu, chọn phím khác`; this.renderKeys(); return; }
      else { bindKey(w.s, w.a, code); this.keyWait = null; this.keyMsg = `Đã gán ${keyName(code)}`; Sfx.play('pickup'); }
      this.lock = 0.2;
      this.renderKeys(); return;
    }
    // ô phím sáng khi đang giữ
    KB_SCHEMES.forEach((sc, i) => KEY_ACTIONS.forEach(([a]) => {
      const b = document.getElementById(`kb-${i}-${a}`);
      if (b) b.classList.toggle('held', Input.key(sc.keys[a]));
    }));
    const m = this.menuInput(true);
    if (m.back && this.lock <= 0) this.action('keys-back');
  },
  padBack() { /* tay cầm: nút B huỷ chờ phím */ for (let i = 0; i < 4; i++) if (Input.padHit(i, 1)) { this.keyWait = null; this.renderKeys(); } },

  /* ---------- Menu chọn game ---------- */
  openMenu() {
    this.state = 'menu';
    this.inst = null;
    this.renderMenu();
    this.show('s-menu');
  },
  renderMenu() {
    const cat = this.menuCat || 'all';
    document.getElementById('cats').innerHTML = GAME_CATS.map((c) => {
      const cnt = c.id === 'all' ? Party.games.length : Party.games.filter((g) => g.cat === c.id).length;
      return `<button class="btn tab ${c.id === cat ? 'on' : ''}" data-act="cat" data-cat="${c.id}">${c.icon} ${c.name} <small>${cnt}</small></button>`;
    }).join('');
    const cards = [];
    for (const g of Party.games) {
      if (cat !== 'all' && g.cat !== cat) continue;
      // thiếu người thì thêm máy, thừa người thì cho nghỉ — chỉnh ở màn giới thiệu của game
      cards.push(`<button class="btn gamecard" data-act="pick" data-id="${g.id}">
        <span class="em">${g.emoji}</span><span class="gn">${g.name}</span>
        <span class="gt">${g.tagline}</span>
        <span class="gp">${(g.minPlayers || 2) === (g.maxPlayers || 4) ? g.minPlayers : `${g.minPlayers || 2}–${g.maxPlayers || 4}`} người${g.coop ? ' · co-op' : ''}</span></button>`);
    }
    const box = document.getElementById('games');
    box.innerHTML = cards.join('');
    box.scrollTop = 0;
  },

  /* ---------- Bắt đầu game ---------- */
  /**
   * Mở màn giới thiệu của game def.
   * opts.keep  = giữ đội hình ván trước (Chơi lại); không thì dựng đội hình mặc định:
   *              mọi người thật trong sảnh (thừa thì nghỉ) + máy Trung bình cho đủ số người tối thiểu.
   * opts.seats = đội hình cho sẵn (smoke test).
   */
  startGame(def, opts = {}) {
    const same = this.def === def;
    this.def = def;
    if (opts.seats) { this.seats = opts.seats.map((s) => Object.assign({}, s)); this.bench = []; }
    else if (!(opts.keep && same && this.seats)) this.defaultSeats();
    this.setupGame();
    this.state = 'intro';
    this.renderIntro();
    this.show('s-intro');
    this.lock = 0.4;
  },
  defaultSeats() {
    const def = this.def, max = def.maxPlayers || 4, min = def.minPlayers || 2;
    const hs = this.slots.map((p, s) => (p ? s : -1)).filter((s) => s >= 0);
    this.seats = hs.slice(0, max).map((h) => ({ h }));
    this.bench = hs.slice(max);
    while (this.seats.length < min) this.seats.push({ bot: true, level: 'normal' });
  },
  /** sửa đội hình ở màn giới thiệu rồi dựng lại ván */
  seatEdit(op, k, lv) {
    const S = this.seats, max = this.def.maxPlayers || 4, min = this.def.minPlayers || 2;
    let focus = null;
    if (op === 'add' && S.length < max) { S.push({ bot: true, level: 'normal' }); focus = '[data-act="r-add"]'; }
    else if (op === 'rm' && S[k] && S[k].bot && S.length > min) { S.splice(k, 1); focus = '[data-act="r-add"]'; }
    else if (op === 'lv' && S[k] && S[k].bot && BOT_LEVELS[lv]) { S[k].level = lv; focus = `[data-act="r-lv"][data-k="${k}"][data-lv="${lv}"]`; }
    else if (op === 'bench' && S[k] && !S[k].bot) {
      this.bench.push(S[k].h);
      // đang ở số người tối thiểu thì thay bằng một máy
      if (S.length > min) S.splice(k, 1); else S[k] = { bot: true, level: 'normal' };
      focus = '[data-act="r-in"]';
    } else if (op === 'in' && this.bench.includes(k)) {
      if (S.length < max) S.push({ h: k });
      else {
        let b = -1;
        for (let j = S.length - 1; j >= 0; j--) if (S[j].bot) { b = j; break; }
        if (b < 0) return;
        S[b] = { h: k };
      }
      this.bench.splice(this.bench.indexOf(k), 1);
    } else return;
    this.setupGame();
    this.renderIntro(focus);
  },
  /** dựng người chơi + api + instance từ đội hình hiện tại */
  setupGame() {
    const def = this.def;
    // máy lấy màu chưa ai dùng, tên Máy 1, Máy 2...
    const used = this.seats.filter((s) => !s.bot).map((s) => this.profiles[s.h].color);
    let bn = 0;
    this.players = this.seats.map((s) => {
      if (!s.bot) return this.slots[s.h];
      let c = 0;
      while (used.includes(c) && c < COLOR_CHOICES.length - 1) c++;
      used.push(c); bn++;
      return { slot: -1, color: COLOR_CHOICES[c], name: `Máy ${bn}`, src: null, bot: true, level: s.level || 'normal' };
    });
    this.players.forEach((p, i) => { p.index = i; p.mem = null; });
    const len = GAME_LENGTHS[this.lenLevel];
    const firstBot = this.players.find((p) => p.bot);
    this.api = {
      players: this.players, parts: new Particles(), len,
      // mức máy: mỗi máy một mức — game dùng botOf(i); bot = mức của máy đầu tiên (game cũ)
      bot: BOT_LEVELS[firstBot ? firstBot.level : 'normal'],
      botOf: (i) => BOT_LEVELS[(this.players[i] && this.players[i].level) || 'normal'],
      T: (sec) => Math.round(sec * len.time),                      // thời gian ván theo độ dài
      wins: len.wins,                                              // số hiệp cần thắng
      count: (n) => Math.max(1, Math.round(n * len.count)),       // số câu / vòng / hộp / điểm
      sudden: false,                                               // (hiệp phụ quyết tử của Chơi tiệc — đã bỏ)
    };
    // chế độ chơi & lựa chọn riêng từng người (nếu game có)
    if (def.modes) {
      const saved = this.gameMode[def.id];
      this.api.mode = def.modes.some((m) => m.id === saved) ? saved : def.modes[0].id;
    }
    // biến thể (vd. đường đua) — hàng thẻ thứ hai ở intro
    if (def.variants) {
      const saved = (this.gameVariant || {})[def.id], its = def.variants.items;
      this.api.variant = its.some((v) => v.id === saved) ? saved : its[0].id;
    }
    // tuỳ chọn hiển thị (vd. bộ quân, kiểu bàn cờ) — không cần tạo lại instance khi đổi
    this.api.opts = {};
    for (const o of def.options || []) {
      const saved = ((this.gameOpts || {})[def.id] || {})[o.id];
      this.api.opts[o.id] = o.items.some((v) => v.id === saved) ? saved : o.items[0].id;
    }
    const pc = def.playerChoices;
    this.choices = this.players.map((p) => (pc ? (p.bot ? (pc.botDef ?? U.randi(0, pc.items.length - 1)) : (pc.def ?? 0)) : 0));
    this.api.choices = this.choices;
    // phụ kiện trang trí (def.looks) — người thật đổi bằng nút Lên, nhớ theo từng chỗ ngồi
    this.lookMem = this.lookMem || [];
    this.looks = this.players.map((p, i) => (def.looks ? (p.bot ? U.randi(0, def.looks.length - 1) : (this.lookMem[i] || 0) % def.looks.length) : 0));
    this.api.looks = this.looks;
    this.prevUp = this.players.map(() => false);
    this.prevDir = this.players.map(() => 0);
    this.speedMul = this.fast ? 1.3 : 1;
    this.inst = def.create(this.api);
    this.res = null;
    this.ready = this.players.map((p) => p.bot);
  },
  renderIntro(focusSel) {
    const d = this.def, md = d.modes && d.modes.find((m) => m.id === this.api.mode);
    const c = (md && md.controls) || d.controls; // chế độ có thể ghi đè luật chơi / cột phím
    const max = d.maxPlayers || 4, min = d.minPlayers || 2, nSeat = this.seats.length;
    const rows = this.players.map((p, i) => {
      const lb = srcLabels(p.src);
      const k = (s) => p.bot ? '—' : `<kbd>${s}</kbd>`;
      const tNames = this.inst.teamNames || TEAMS.names, tCols = this.inst.teamColors || TEAMS.colors; // game cờ: Trắng/Đen
      const team = this.inst.teamOf
        ? `<td><b style="color:${tCols[this.inst.teamOf(i)]}">${tNames[this.inst.teamOf(i)]}</b></td>` : '';
      const pc = d.playerChoices, it = pc ? pc.items[this.choices[i]] : null;
      const choice = (pc ? `<td class="choice">${p.bot ? '' : '◀ '}${it.icon} <b>${it.name}</b>${p.bot ? '' : ' ▶'}</td>` : '')
        + (d.looks ? `<td class="choice">${d.looks[this.looks[i]].icon}${p.bot ? '' : ' <small>↑</small>'}</td>` : '');
      // ai điều khiển: máy chọn mức Dễ / TB / Khó + bỏ máy; người thật có nút nghỉ ván này
      const who = p.bot
        ? `<span class="lvpick">${BOT_ORDER.map((lv) => `<button class="btn lv lv-${lv}${p.level === lv ? ' on' : ''}" data-act="r-lv" data-k="${i}" data-lv="${lv}" title="Máy ${BOT_LEVELS[lv].name}">${LV_SHORT[lv]}</button>`).join('')}</span>`
          + `<button class="btn xs" data-act="r-rm" data-k="${i}" title="Bỏ máy này" ${nSeat > min ? '' : 'disabled'}>✕</button>`
        : `${srcName(p.src)} <button class="btn xs" data-act="r-bench" data-k="${i}" title="Nghỉ ván này">💤</button>`;
      return `<tr><td><span class="who">${this.blobHTML(p.color, 'sm')} ${p.name}</span></td>${team}${choice}
        <td class="whoctl">${p.bot ? '🤖 ' : ''}${who}</td>
        <td>${k(lb ? lb.move : '')}</td>
        ${c.act ? `<td>${k(lb ? lb.act : '')}</td>` : ''}
        ${c.jump ? `<td>${k(lb ? lb.jump : '')}</td>` : ''}
        <td class="ready ${this.ready[i] ? 'yes' : 'no'}">${this.ready[i] ? '✓ Sẵn sàng' : 'Nhấn Đánh…'}</td></tr>`;
    }).join('');
    const L = GAME_LENGTHS[this.lenLevel];
    const tags = `<span class="party-tag len-tag">${L.icon} Ván ${L.name.toLowerCase()}</span>`
      + ` <span class="party-tag">👥 ${min === max ? min : `${min}–${max}`} người</span>`
      + (this.speedMul > 1 ? ' <span class="party-tag fast-tag">⚡ Tua nhanh ×1,3</span>' : '');
    const compact = !!(d.modes || d.playerChoices || d.options || nSeat > 2), card = document.getElementById('intro-card');
    card.classList.toggle('compact', compact);
    // người thật đang nghỉ: vào chơi (đủ chỗ thì thay một máy)
    const canIn = nSeat < max || this.seats.some((s) => s.bot);
    const benchBtns = this.bench.map((h) => `<button class="btn small" data-act="r-in" data-s="${h}" ${canIn ? '' : 'disabled'}>▶ ${this.slots[h].name} vào chơi</button>`).join('');
    card.innerHTML = `
      <div class="intro-tags">${tags}</div>
      ${compact ? `<h2>${d.emoji} ${d.name}</h2>` : `<div class="em">${d.emoji}</div>
      <h2>${d.name}</h2>`}
      <p class="tag">${(md && md.how) || d.how || d.tagline}</p>
      ${d.modes ? `<div class="mode-pick">
        <div class="mode-lbl">Chọn chế độ <small>· bấm vào thẻ, hoặc nút Nhảy để chuyển</small></div>
        <div class="mode-cards">${d.modes.map((m) => {
          const on = m.id === this.api.mode;
          return `<button class="mode-card${on ? ' on' : ''}" data-act="mode-set" data-mode="${m.id}" title="${m.desc.replace(/"/g, '&quot;')}">
            ${on ? '<span class="mcheck">✓</span>' : ''}<span class="mi">${modeIcon(d.id, m)}</span><b>${m.name}</b></button>`;
        }).join('')}</div>
        <div class="mode-desc2">${(d.modes.find((m) => m.id === this.api.mode) || d.modes[0]).desc}</div></div>` : ''}
      ${d.variants ? `<div class="mode-pick">
        <div class="mode-lbl">${d.variants.label} <small>· bấm vào thẻ, hoặc nút Lên để chuyển</small></div>
        <div class="mode-cards">${d.variants.items.map((v) => {
          const on = v.id === this.api.variant;
          return `<button class="mode-card${on ? ' on' : ''}" data-act="variant-set" data-variant="${v.id}" title="${v.desc.replace(/"/g, '&quot;')}">
            ${on ? '<span class="mcheck">✓</span>' : ''}<span class="mi">${v.icon || '🎮'}</span><b>${v.name}</b></button>`;
        }).join('')}</div>
        <div class="mode-desc2">${(d.variants.items.find((v) => v.id === this.api.variant) || d.variants.items[0]).desc}</div></div>` : ''}
      ${d.options ? `<div class="opt-rows">${d.options.map((o) => `<div class="mode-pick">
        <div class="mode-lbl">${o.label}</div>
        <div class="mode-cards">${o.items.map((v) => {
          const on = v.id === this.api.opts[o.id];
          return `<button class="btn mode-card${on ? ' on' : ''}" data-act="opt-set" data-opt="${o.id}" data-val="${v.id}" title="${(v.desc || '').replace(/"/g, '&quot;')}">
            ${on ? '<span class="mcheck">✓</span>' : ''}<span class="mi">${v.icon || '🎨'}</span><b>${v.name}</b></button>`;
        }).join('')}</div></div>`).join('')}</div>` : ''}
      ${this.lengthInfo() ? `<p class="tag len-info">Ván này: <b>${this.lengthInfo()}</b></p>` : ''}
      ${d.playerChoices ? `<p class="tag choice-legend">${d.playerChoices.items.map((x) => `${x.icon} <b>${x.name}</b>: ${x.desc}`).join(' &nbsp;·&nbsp; ')}</p>` : ''}
      <table class="ctl">
        <tr><th></th>${this.inst.teamOf ? `<th>${this.inst.teamLabel || 'Đội'}</th>` : ''}${d.playerChoices ? `<th>${d.playerChoices.label} (← →)</th>` : ''}${d.looks ? '<th>Phụ kiện (↑)</th>' : ''}<th>Ai chơi · mức máy</th><th>${c.move || 'Di chuyển'}</th>${c.act ? `<th>${c.act}</th>` : ''}${c.jump ? `<th>${c.jump}</th>` : ''}<th></th></tr>
        ${rows}
      </table>
      <div class="row">
        <button class="btn" data-act="intro-back">← Đổi game</button>
        <button class="btn small" data-act="r-add" ${nSeat < max ? '' : 'disabled'}>🤖 + Thêm máy</button>
        ${benchBtns}
        <button class="btn primary" data-act="go">Bắt đầu luôn (Enter)</button>
      </div>`;
    const els = this.focusables();
    const want = focusSel && card.querySelector(focusSel);
    this.setFocus(want && !want.disabled ? want : els.find((e) => e.classList.contains('primary')) || null, false);
  },
  /** Tóm tắt độ dài ván hiện tại (đọc từ instance game). */
  lengthInfo() {
    const g0 = this.inst, bits = [];
    // chỉ lấy số — tránh trùng tên hàm của game (vd. soccer có hàm goal())
    const g = new Proxy(g0, { get: (o, k) => (typeof o[k] === 'number' ? o[k] : 0) });
    if (g.total) bits.push(`${g.total} giây`);
    if (g.need) bits.push(`thắng ${g.need} hiệp`);
    if (g.laps) bits.push(`${g.laps} vòng`);
    if (g.qn) bits.push(`${g.qn} câu`);
    if (g.goal) bits.push(`${g.goal} hộp`);
    if (g.kicks) bits.push(`${g.kicks} lượt sút mỗi đội`);
    if (g.target) bits.push(`${g.target} điểm`);
    if (g.pitches) bits.push(`${g.pitches} cú ném`);
    if (g.rounds) bits.push(`${g.rounds} đơn hàng`);
    if (g.stocksMax) bits.push(`${g.stocksMax} mạng`);
    if (g.mRounds) bits.push(`${g.mRounds} vòng bàn cờ`);
    return bits.join(' · ');
  },
  cycleMode() {
    const ms = this.def.modes;
    if (!ms) return;
    const k = ms.findIndex((m) => m.id === this.api.mode);
    this.setMode(ms[(k + 1) % ms.length].id);
  },
  setMode(id) {
    const ms = this.def.modes;
    if (!ms || !ms.some((m) => m.id === id)) return;
    if (id === this.api.mode) return;
    this.api.mode = id;
    this.gameMode[this.def.id] = this.api.mode;
    try { localStorage.setItem('tronparty.modes', JSON.stringify(this.gameMode)); } catch (e) { /* bỏ qua */ }
    this.inst = this.def.create(this.api);   // tạo lại để xem trước đúng chế độ
    Sfx.play('select');
    this.renderIntro();
  },
  setVariant(id) {
    const vs = this.def.variants;
    if (!vs || !vs.items.some((v) => v.id === id) || id === this.api.variant) return;
    this.api.variant = id;
    this.gameVariant = this.gameVariant || {};
    this.gameVariant[this.def.id] = id;
    try { localStorage.setItem('tronparty.variants', JSON.stringify(this.gameVariant)); } catch (e) { /* bỏ qua */ }
    this.inst = this.def.create(this.api);
    Sfx.play('select');
    this.renderIntro();
  },
  /** đổi tuỳ chọn hiển thị (def.options) — chỉ cập nhật api.opts, game tự đọc lúc vẽ */
  setOpt(oid, val) {
    const o = (this.def.options || []).find((x) => x.id === oid);
    if (!o || !o.items.some((v) => v.id === val)) return;
    this.api.opts[oid] = val;
    this.gameOpts = this.gameOpts || {};
    (this.gameOpts[this.def.id] = this.gameOpts[this.def.id] || {})[oid] = val;
    try { localStorage.setItem('tronparty.opts', JSON.stringify(this.gameOpts)); } catch (e) { /* bỏ qua */ }
    this.renderIntro();
  },
  cycleVariant() {
    const its = this.def.variants && this.def.variants.items;
    if (!its) return;
    const k = its.findIndex((v) => v.id === this.api.variant);
    this.setVariant(its[(k + 1) % its.length].id);
  },
  introInput() {
    let changed = false, rebuild = false, modeHit = false, variantHit = false;
    const pc = this.def.playerChoices;
    this.players.forEach((p, i) => {
      if (p.bot) return;
      const q = Input.read(p.src);
      if (!this.ready[i] && q.actP) { this.ready[i] = true; changed = true; Sfx.play('pickup'); }
      if (this.def.variants && !this.def.looks) {
        const up = q.my < -0.5 && Math.abs(q.mx) < 0.5;
        if (up && !this.prevUp[i]) variantHit = true;
        this.prevUp[i] = up;
      }
      if (this.def.looks) {
        const up = q.my < -0.5 && Math.abs(q.mx) < 0.5;
        if (up && !this.prevUp[i]) { this.looks[i] = (this.looks[i] + 1) % this.def.looks.length; this.lookMem[i] = this.looks[i]; changed = true; Sfx.play('move'); }
        this.prevUp[i] = up;
      }
      if (this.def.modes && q.jumpP) modeHit = true;
      if (pc) {
        const d = q.mx > 0.5 ? 1 : q.mx < -0.5 ? -1 : 0;
        if (d && d !== this.prevDir[i]) {
          this.choices[i] = (this.choices[i] + d + pc.items.length) % pc.items.length;
          rebuild = true; Sfx.play('move');
        }
        this.prevDir[i] = d;
      }
    });
    if (modeHit) { this.cycleMode(); return; }
    if (variantHit) { this.cycleVariant(); return; }
    if (rebuild) { this.inst = this.def.create(this.api); changed = true; }
    if (changed) {
      if (this.ready.every(Boolean)) { this.beginCountdown(); return; }
      this.renderIntro();
    }
    const m = this.menuInput(false);
    if (m.back && this.lock <= 0) this.action('intro-back');
  },
  beginCountdown() {
    // game có chế độ / lựa chọn: tạo lại instance với lựa chọn cuối cùng
    if (this.def && (this.def.modes || this.def.playerChoices || this.def.variants) && this.state === 'intro') this.inst = this.def.create(this.api);
    this.hideAll();
    this.state = 'countdown';
    this.cd = 3;
    this.lastCount = 4;
  },

  /* ---------- Kết quả ---------- */
  rankOf(res) {
    return res.map((r) => res.filter((o) => o.score > r.score + 1e-9).length);
  },
  showResult() {
    const res = this.res, n = this.players.length;
    const place = this.rankOf(res);
    const order = this.players.map((_, i) => i).sort((a, b) => place[a] - place[b] || a - b);
    const winners = order.filter((i) => place[i] === 0);
    let title = winners.length === 1
      ? `<span style="color:${this.players[winners[0]].color.light}">${this.players[winners[0]].name}</span> thắng!`
      : (winners.length === n ? 'Hòa cả làng!' : 'Đồng hạng nhất!');
    if (this.inst.resultTitle) title = this.inst.resultTitle();
    const medals = ['🥇', '🥈', '🥉', '4'];
    const rows = order.map((i) => {
      const p = this.players[i];
      return `<div class="r ${place[i] === 0 ? 'first' : ''}">
        <span class="medal">${medals[place[i]]}</span>${this.blobHTML(p.color, 'sm')}
        <span class="nm" style="color:${p.color.light}">${p.name}${p.bot ? ` 🤖 <small>${BOT_LEVELS[p.level || 'normal'].name}</small>` : ''}</span>
        <span class="val">${res[i].text}</span><span></span></div>`;
    }).join('');
    document.getElementById('result-card').innerHTML = `
      <div class="em">🏆</div><h2>${title}</h2>
      <p class="tag">${this.def.name}</p>
      <div class="rank">${rows}</div>
      <div class="row"><button class="btn" data-act="menu">Chọn game khác</button>
        <button class="btn primary" data-act="replay">↻ Chơi lại</button></div>`;
    this.state = 'result';
    this.show('s-result');
    this.lock = 0.9;
    Sfx.play('win');
  },
  /* ---------- Vòng lặp ---------- */
  gatherInputs(dt = 1 / 60) {
    const empty = { mx: 0, my: 0, act: false, jump: false, actP: false, jumpP: false };
    return this.players.map((p, i) => {
      let q;
      if (p.bot) {
        this.api.bot = BOT_LEVELS[p.level || 'normal']; // game cũ đọc api.bot trong botInput → đúng mức của máy này
        const b = Object.assign({}, empty, (this.inst.botInput && this.inst.botInput(i)) || {});
        q = this.def.rawBot ? b : this.weakenBot(p, b, dt);
      } else q = Input.read(p.src);
      return q;
    });
  },

  /** Làm máy "người" hơn theo độ khó: phản xạ chậm, chạy chậm, hồi chiêu lâu, đôi khi bỏ lỡ hoặc đi lạc. */
  /* ---------- Biểu cảm chọc tức (ALL12): lúc đếm ngược và lúc vừa hết ván ---------- */
  taunt(i, emoji) {
    const q = this.posOf(i);
    if (!q || !this.api) return;
    this.api.parts.text(q.x, q.y - 46, emoji, '#fff', 40);
    Sfx.tone(520 + i * 90 + Math.random() * 120, 0.09, 'square', 0.06);
  },
  tauntInput(dt) {
    this.players.forEach((p, i) => {
      this.tauntCd[i] = (this.tauntCd[i] || 0) - dt;
      if (p.bot || this.tauntCd[i] > 0) return;
      const q = Input.read(p.src);
      if (!q.actP && !q.jumpP) return;
      this.tauntCd[i] = 0.45;
      this.taunt(i, U.pick(q.actP ? ['😂', '😎', '🔥', '💪'] : ['😡', '💀', '😱', '🙈']));
    });
  },
  /** máy về nhất thì cũng khoe một cái */
  botTaunt() {
    if (!this.res) return;
    const best = Math.max(...this.res.map((r) => r.score));
    this.players.forEach((p, i) => { if (p.bot && this.res[i].score === best && Math.random() < 0.6) setTimeout(() => this.state === 'ending' && this.taunt(i, U.pick(['😎', '👑', '😂'])), 300 + i * 150); });
  },

  /** Vị trí nhân vật người chơi i trên màn hình {x,y} (đã tính độ cao nhảy), hoặc null.
      Game có hàm posOf(i) riêng thì dùng hàm đó, không thì đọc ps[i].x/y. Bước nền cho biểu cảm (ALL12), rung tay cầm (ALL11). */
  posOf(i) {
    const g = this.inst;
    if (!g) return null;
    if (g.posOf) return g.posOf(i);
    const e = g.ps && g.ps[i];
    if (e && Number.isFinite(e.x) && Number.isFinite(e.y)) return { x: e.x, y: e.y - (e.z || 0) };
    return null;
  },
  weakenBot(p, b, dt) {
    const lv = BOT_LEVELS[p.level || 'normal'];
    const m = p.mem || (p.mem = { t: 0, mx: 0, my: 0, actCd: 0, jumpCd: 0, wT: 0, wx: 0, wy: 0 });
    m.t -= dt; m.actCd -= dt; m.jumpCd -= dt; m.wT -= dt;
    if (m.t <= 0) { m.t = lv.react * U.rand(0.7, 1.3); m.mx = b.mx; m.my = b.my; }
    let mx = m.mx, my = m.my;
    if (m.wT > 0) { mx = m.wx; my = m.wy; }
    else if (lv.wander > 0 && Math.random() < lv.wander * dt) {
      const a = Math.random() * TAU;
      m.wT = U.rand(0.4, 0.9); m.wx = Math.cos(a); m.wy = Math.sin(a);
    }
    const out = Object.assign({}, b, { mx: mx * lv.speed, my: my * lv.speed });
    const gate = (key, cdKey) => {
      if (!b[key]) return false;
      if (m[cdKey] > 0 || Math.random() < lv.actDrop) return false;
      m[cdKey] = lv.actCd;
      return true;
    };
    out.actP = gate('actP', 'actCd');
    out.jumpP = gate('jumpP', 'jumpCd');
    return out;
  },
  update(dt) {
    FX.update(dt);
    this.lock -= dt;
    this.updateBg(dt);
    switch (this.state) {
      case 'title': this.menuInput(true); break;
      case 'lobby': {
        this.lobbyInput(dt);
        if (this.editing >= 0) break; // đang gõ tên: không điều hướng menu
        const esc = Input.hit('Escape');
        const m = this.menuInput(false);
        if (esc && this.lock <= 0) { if (this.picking >= 0) this.action('slot-cancel'); else this.action('lobby-back'); }
        void m;
        break;
      }
      case 'menu': {
        const m = this.menuInput(true);
        if (m.back && this.lock <= 0) this.action('menu-back');
        break;
      }
      case 'keys': this.updateKeys(dt); break;
      case 'intro': this.introInput(); break;
      case 'countdown': {
        this.tauntInput(dt);
        this.cd -= dt;
        const c = Math.ceil(this.cd);
        if (c !== this.lastCount && c > 0) { this.lastCount = c; Sfx.play('count'); }
        if (this.cd <= 0) { this.state = 'play'; this.goT = 0; Sfx.play('go'); }
        this.api.parts.update(dt);
        break;
      }
      case 'play': {
        this.goT += dt;
        const m = Input.menu();
        // tay cầm: B là nút Nhảy trong game nên chỉ Start mới tạm dừng; bàn phím: Esc / P
        if (Input.hit('Escape') || m.start || Input.hit('KeyP')) {
          const ph = document.getElementById('pause-help');
          if (ph) ph.innerHTML = this.pauseHelpHTML();
          this.state = 'paused'; this.show('s-pause'); break;
        }
        if (Input.hit('KeyH') && this.helpKeyFree()) {
          this.helpOn = !this.helpOn;
          try { localStorage.setItem('tronparty.helpbar', this.helpOn ? '1' : '0'); } catch (e) { /* bỏ qua */ }
        }
        this.inst.update(dt * this.speedMul, this.gatherInputs(dt));
        this.api.parts.update(dt);
        if (this.inst.finished) {
          this.res = this.inst.results();
          this.state = 'ending'; this.endT = 1.6; this.endAge = 0;
          this.botTaunt();
        }
        break;
      }
      case 'ending':
        this.tauntInput(dt);
        this.endT -= dt; this.endAge += dt;
        this.inst.update(dt * this.speedMul, this.gatherInputs(dt));
        this.api.parts.update(dt);
        if (this.endT <= 0) this.showResult();
        break;
      case 'paused': {
        const m = this.menuInput(true);
        if (m.back && this.lock <= 0) this.action('resume');
        break;
      }
      case 'result': this.menuInput(true); break;
    }
  },
  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const o = FX.offset();
    ctx.save();
    ctx.translate(o.x, o.y);
    const inGame = this.inst && ['intro', 'countdown', 'play', 'ending', 'paused', 'result'].includes(this.state);
    if (inGame) {
      this.inst.draw(ctx);
      this.api.parts.draw(ctx);
    } else {
      this.drawBg(ctx);
    }
    ctx.restore();
    if (this.state === 'countdown') this.drawHelpBig(ctx);
    else if (this.inst && this.state === 'play' && !this.inst.ownHelp) {   // ownHelp: game tự vẽ bảng phím trong bố cục (vd. Cờ Tỷ Phú)
      if (this.helpOn) this.drawHelpStrip(ctx);
      else if (this.goT < HELP_FLOAT_T) this.drawHelpFloat(ctx, Math.min(1, (HELP_FLOAT_T - this.goT) / 1.5));
      this.drawHelpTag(ctx);
    }
    if (this.state === 'countdown') {
      const c = Math.ceil(this.cd), age = 1 - (this.cd - Math.floor(this.cd));
      ctx.fillStyle = 'rgba(10,5,25,0.25)'; ctx.fillRect(0, 0, W, H);
      Draw.banner(ctx, String(c), age < 1 ? age : 0, { size: 170, color: '#ffe14d' });
    } else if (this.state === 'play' && this.goT < 0.8) {
      ctx.globalAlpha = 1 - this.goT / 0.8;
      Draw.banner(ctx, 'Bắt đầu!', this.goT, { size: 110, color: '#5dff9b' });
      ctx.globalAlpha = 1;
    } else if (this.state === 'ending' && !(this.inst && this.inst.ownEndBanner)) { // game cờ tự hiện "Chiếu hết!" / "Hòa!"
      Draw.banner(ctx, 'Kết thúc!', this.endAge, { size: 100, color: '#ffe14d', y: H / 2 - 40 });
    }
  },

  /* ---------- Bảng phím trong game (cho người mới) ----------
     Lúc đếm ngược: bảng lớn "Phím của bạn" cho từng người thật.
     Lúc chơi: dải nhỏ ở mép dưới màn hình (mờ đi khi nhân vật ở sát dưới); phím H để ẩn/hiện. */
  helpRows() {
    const d = this.def, md = d && d.modes && d.modes.find((m) => m.id === this.api.mode);
    const c = (md && md.controls) || d.controls || {};
    return this.players.map((p, i) => ({ p, i })).filter(({ p }) => !p.bot).map(({ p, i }) => {
      const lb = srcLabels(p.src);
      // chữ mũi tên trong luật (vd "← → lái") đổi thành phím thật của người đó (A D lái)
      let fix = (t) => t;
      if (p.src && p.src.type === 'kb') {
        const k = KB_SCHEMES[p.src.scheme].keys, m = { '←': keyName(k.left), '→': keyName(k.right), '↑': keyName(k.up), '↓': keyName(k.down) };
        fix = (t) => t.replace(/[←→↑↓]/g, (ch) => m[ch]);
      }
      const parts = [[lb.move, fix(c.move || 'Di chuyển')]];
      if (c.act) parts.push([lb.act, fix(c.act)]);
      if (c.jump) parts.push([lb.jump, fix(c.jump)]);
      return { p, i, parts };
    });
  },
  helpKeyFree() { return !KB_SCHEMES.some((s) => Object.values(s.keys).includes('KeyH')); },
  /** đo / vẽ một dòng phím: [tên] [phím] nhãn [phím] nhãn ... — trả về độ rộng */
  helpLine(ctx, r, x, y, fs, draw) {
    const font = (w) => `${w} ${fs}px ${FONT}`;
    let cx = x;
    const pad = fs * 0.45, kh = fs * 1.45;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    // tên người chơi
    ctx.font = font(800);
    const nw = ctx.measureText(r.p.name).width;
    if (draw) {
      ctx.fillStyle = r.p.color.main; ctx.beginPath(); ctx.arc(cx + fs * 0.5, y, fs * 0.45, 0, TAU); ctx.fill();
      ctx.fillStyle = r.p.color.light; ctx.fillText(r.p.name, cx + fs * 1.2, y + 1);
    }
    cx += fs * 1.2 + nw + fs * 0.7;
    for (const [key, label] of r.parts) {
      ctx.font = font(800);
      const kw = ctx.measureText(key).width + pad * 2;
      if (draw) {
        Draw.rr(ctx, cx, y - kh / 2, kw, kh, fs * 0.35);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx + 3, y + kh / 2 - 3, kw - 6, 3);
        ctx.fillStyle = '#2a1840'; ctx.fillText(key, cx + pad, y + 1);
      }
      cx += kw + fs * 0.35;
      ctx.font = font(600);
      const lw = ctx.measureText(label).width;
      if (draw) { ctx.fillStyle = '#fff'; ctx.fillText(label, cx, y + 1); }
      cx += lw + fs * 0.9;
    }
    return cx - x - fs * 0.9;
  },
  /** bảng lớn lúc đếm ngược */
  drawHelpBig(ctx) {
    const rows = this.helpRows();
    if (!rows.length) return;
    const fs = 22, lh = 46, x0 = 0;
    const ws = rows.map((r) => this.helpLine(ctx, r, x0, 0, fs, false));
    const w = Math.max(...ws, 260) + 48, h = rows.length * lh + 58, x = (W - w) / 2, y = H - h - 18;
    ctx.save();
    Draw.rr(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(16,8,36,0.86)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,225,77,0.7)'; ctx.stroke();
    Draw.text(ctx, '🎮 Phím của bạn', W / 2, y + 26, { size: 22, color: '#ffe14d', stroke: null });
    rows.forEach((r, k) => this.helpLine(ctx, r, x + 24, y + 62 + k * lh, fs, true));
    ctx.restore();
  },
  /** dải nhỏ lúc chơi */
  drawHelpStrip(ctx) {
    const rows = this.helpRows();
    if (!rows.length) return;
    // cỡ chữ: một hàng nếu vừa, không thì 2 hàng, chữ nhỏ dần
    let fs = 16, lines;
    for (; fs >= 11; fs--) {
      const ws = rows.map((r) => this.helpLine(ctx, r, 0, 0, fs, false) + fs * 1.6);
      const one = ws.reduce((a, b) => a + b, 0) + 8 * (rows.length - 1);
      if (one <= W - 24) { lines = [rows]; break; }
      const half = Math.ceil(rows.length / 2), a = rows.slice(0, half), b = rows.slice(half);
      const wa = ws.slice(0, half).reduce((s, v) => s + v, 0), wb = ws.slice(half).reduce((s, v) => s + v, 0);
      if (Math.max(wa, wb) + 8 <= W - 24) { lines = [a, b]; break; }
    }
    if (!lines) lines = rows.map((r) => [r]);
    const ph = fs * 2.1, gap = 6;
    ctx.save();
    lines.forEach((line, li) => {
      const ws = line.map((r) => this.helpLine(ctx, r, 0, 0, fs, false) + fs * 1.6);
      const total = ws.reduce((a, b) => a + b, 0) + 8 * (line.length - 1);
      let x = (W - total) / 2;
      const y = this.helpBottom() - 6 - ph / 2 - (lines.length - 1 - li) * (ph + gap) - 16;
      line.forEach((r, k) => {
        // nhân vật đứng sát chỗ dải chữ thì làm mờ để khỏi che
        let near = false;
        this.players.forEach((_, j) => { const q = this.posOf(j); if (q && q.x > x - 30 && q.x < x + ws[k] + 30 && q.y > y - ph - 40) near = true; });
        ctx.globalAlpha = near ? 0.28 : 0.92;
        Draw.rr(ctx, x, y - ph / 2, ws[k], ph, ph / 2);
        ctx.fillStyle = 'rgba(16,8,36,0.78)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = r.p.color.main; ctx.stroke();
        this.helpLine(ctx, r, x + fs * 0.8, y, fs, true);
        x += ws[k] + 8;
      });
    });
    ctx.restore();
  },
  /** nhãn phím nhỏ đi theo nhân vật mỗi người thật trong vài giây đầu ván */
  drawHelpFloat(ctx, alpha) {
    const fs = 14, ph = fs * 2;
    ctx.save();
    // vị trí mong muốn: ngay dưới nhân vật (sát đáy thì lên trên); nhãn chồng nhau thì đẩy lệch ra
    const items = [];
    for (const r of this.helpRows()) {
      const q = this.posOf(r.i);
      if (!q) continue;
      const w = this.helpLine(ctx, r, 0, 0, fs, false) + fs * 1.6;
      const below = q.y + 44 + ph < H - 10;
      items.push({ r, w, x: U.clamp(q.x - w / 2, 6, W - 6 - w), y: below ? q.y + 44 + ph / 2 : q.y - 58 - ph / 2, dir: below ? 1 : -1 });
    }
    items.sort((a, c) => a.y - c.y);
    const placed = [];
    for (const it of items) {
      for (let k = 0; k < 6 && placed.some((o) => it.x < o.x + o.w && o.x < it.x + it.w && Math.abs(it.y - o.y) < ph + 3); k++) {
        it.y += it.dir * (ph + 4);
        if (it.y > H - 24 - ph / 2 || it.y < 70) { it.dir = -it.dir; it.y += it.dir * 2 * (ph + 4); }
      }
      placed.push(it);
    }
    for (const { r, w, x, y } of placed) {
      ctx.globalAlpha = alpha * 0.95;
      Draw.rr(ctx, x, y - ph / 2, w, ph, ph / 2);
      ctx.fillStyle = 'rgba(16,8,36,0.82)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = r.p.color.main; ctx.stroke();
      this.helpLine(ctx, r, x + fs * 0.8, y, fs, true);
    }
    ctx.restore();
  },
  /** dòng chữ nhỏ cuối màn hình: cách xem lại phím */
  drawHelpTag(ctx) {
    if (!this.helpRows().length) return;
    const t = `Esc: tạm dừng (xem phím)${this.helpKeyFree() ? ` · H: ${this.helpOn ? 'ẩn' : 'hiện'} bảng phím` : ''}${this.def.helpExtra ? ' · ' + this.def.helpExtra : ''}`;
    ctx.save(); ctx.globalAlpha = 0.6;
    Draw.text(ctx, t, this.inst && this.inst.helpX || W / 2, this.helpBottom() - 8, { size: 12, color: '#fff', stroke: 'rgba(0,0,0,0.7)', sw: 3, weight: 600 });
    ctx.restore();
  },
  /** mép dưới cho dải phím / dòng nhắc — game phủ kín màn hình (vd. Cờ Tỷ Phú) đặt inst.helpBottom để khỏi che bàn */
  helpBottom() { return (this.inst && this.inst.helpBottom) || H; },
  pauseHelpHTML() {
    const rows = this.helpRows();
    if (!rows.length) return '';
    return `<table class="ctl help-tb">${rows.map((r) => `<tr><td><span class="who">${this.blobHTML(r.p.color, 'sm')} ${r.p.name}</span></td>${r.parts.map(([k, l]) => `<td><kbd>${k}</kbd> ${l}</td>`).join('')}</tr>`).join('')}</table>`;
  },

  /* ---------- Nền động cho menu ---------- */
  newBgBlob(i) {
    const r = U.rand(30, 60);
    return { x: U.rand(r, W - r), y: U.rand(r, H - r), vx: U.rand(-90, 90), vy: U.rand(-90, 90), r, c: PLAYER_COLORS[i % 4], face: 0, walk: 0 };
  },
  updateBg(dt) {
    for (const b of this.bg) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < b.r || b.x > W - b.r) { b.vx *= -1; b.x = U.clamp(b.x, b.r, W - b.r); }
      if (b.y < b.r || b.y > H - b.r) { b.vy *= -1; b.y = U.clamp(b.y, b.r, H - b.r); }
      b.face = Math.atan2(b.vy, b.vx); b.walk += dt * 8;
    }
  },
  drawBg(ctx) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#3a1f78'); g.addColorStop(1, '#1b0f3d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    const t = U.now() * 20;
    for (let y = -60; y < H + 60; y += 60) {
      for (let x = -60; x < W + 60; x += 60) {
        if (((x + y) / 60) % 2 === 0) ctx.fillRect(x + (t % 120) - 60, y, 60, 60);
      }
    }
    ctx.globalAlpha = this.state === 'title' ? 0.5 : 0.25;
    for (const b of this.bg) Draw.blob(ctx, { x: b.x, y: b.y, r: b.r, color: b.c, face: b.face, walk: b.walk });
    ctx.globalAlpha = 1;
  },
};

const startApp = () => App.init();
if (document.fonts && document.fonts.load) {
  Promise.race([document.fonts.load('800 32px "Baloo 2"'), new Promise((r) => setTimeout(r, 1500))])
    .finally(startApp);
} else startApp();

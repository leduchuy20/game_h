'use strict';
/* =========================================================
   Tròn Party — điều khiển luồng: sảnh, menu, intro, chơi, kết quả, tiệc
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
const modeIcon = (gid, m) => m.icon || MODE_ICONS[`${gid}:${m.id}`] || MODE_ICONS[m.id] || '🎮';

const App = {
  state: 'title',
  slots: [null, null, null, null],
  picking: -1, editing: -1, leaveT: [0, 0, 0, 0],
  players: [],
  def: null, inst: null, api: null, res: null,
  party: null,          // { queue:[def], idx, pts:[] }
  ready: [],
  cd: 0, lastCount: 0, goT: 0, endT: 0, endAge: 0,
  lock: 0,              // khóa nút menu ngắn sau khi mở màn hình (tránh bấm nhầm)
  focused: null,
  bg: [],
  lastPadCount: 0,
  botLevel: 'normal',
  lenLevel: 'normal',
  gameMode: {},          // chế độ đã chọn cho từng game (vd { sumo: 'stocks' })
  partySet: { count: 5, off: [] },   // Chơi tiệc tự chọn (ALL3): số game + các game bị tắt
  tauntCd: [],           // hồi chiêu biểu cảm từng người (ALL12)
  fast: false,           // ALL9 đột biến "Tua nhanh ×1,3" bật ở sảnh (lưu localStorage)
  speedMul: 1,           // hệ số tốc độ của ván đang chơi

  init() {
    try { const lv = localStorage.getItem('tronparty.botLevel'); if (BOT_LEVELS[lv]) this.botLevel = lv; } catch (e) { /* bỏ qua */ }
    try { const ln = localStorage.getItem('tronparty.lenLevel'); if (GAME_LENGTHS[ln]) this.lenLevel = ln; } catch (e) { /* bỏ qua */ }
    try { this.gameMode = JSON.parse(localStorage.getItem('tronparty.modes') || '{}') || {}; } catch (e) { this.gameMode = {}; }
    try { this.gameVariant = JSON.parse(localStorage.getItem('tronparty.variants') || '{}') || {}; } catch (e) { this.gameVariant = {}; }
    try { this.fast = localStorage.getItem('tronparty.fast') === '1'; } catch (e) { /* bỏ qua */ }
    loadKeys(); // ALL14: bộ phím đã đổi
    this.loadProfiles(); // tên + màu từng ô
    try {
      const ps = JSON.parse(localStorage.getItem('tronparty.partySet') || 'null');
      if (ps && [3, 5, 8].includes(ps.count) && Array.isArray(ps.off)) this.partySet = ps;
    } catch (e) { /* bỏ qua */ }
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
      case 'add-bot': this.addBot(); break;
      case 'rm-bot': this.removeBot(); break;
      case 'slot-human': this.picking = +el.dataset.s; this.renderLobby('[data-act="slot-kb"]'); break;
      case 'slot-kb': this.join({ type: 'kb', scheme: +el.dataset.k }, +el.dataset.s); break;
      case 'slot-cancel': { const s = this.picking; this.picking = -1; this.renderLobby(`[data-act="slot-human"][data-s="${s}"]`); break; }
      case 'slot-bot': this.addBot(+el.dataset.s); break;
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
      case 'bot-level': {
        this.botLevel = BOT_ORDER[(BOT_ORDER.indexOf(this.botLevel) + 1) % BOT_ORDER.length];
        try { localStorage.setItem('tronparty.botLevel', this.botLevel); } catch (e) { /* bỏ qua */ }
        this.renderLobby();
        break;
      }
      case 'lobby-next':
        this.players = this.slots.filter(Boolean);
        if (this.players.length >= 2) this.openMenu();
        break;
      case 'menu-back': this.openLobby(); break;
      case 'pick': {
        const def = Party.games.find((g) => g.id === el.dataset.id);
        this.party = null;
        this.startGame(def);
        break;
      }
      case 'party': this.openPartySet(); break;
      case 'pset-count': this.partySet.count = +el.dataset.n; this.savePartySet(); this.renderPartySet(el.dataset.act + el.dataset.n); break;
      case 'pset-toggle': {
        const id = el.dataset.id, off = this.partySet.off;
        if (off.includes(id)) off.splice(off.indexOf(id), 1); else off.push(id);
        this.savePartySet(); this.renderPartySet('pset-toggle' + id);
        break;
      }
      case 'pset-all': this.partySet.off = []; this.savePartySet(); this.renderPartySet('pset-all'); break;
      case 'pset-none': this.partySet.off = Party.games.map((g) => g.id); this.savePartySet(); this.renderPartySet('pset-none'); break;
      case 'pset-go': this.startParty(); break;
      case 'pset-back': this.openMenu(); break;
      case 'cat': {
        this.menuCat = el.dataset.cat;
        this.renderMenu();
        this.setFocus(document.querySelector(`#cats [data-cat="${this.menuCat}"]`), false);
        break;
      }
      case 'resume': this.hideAll(); this.state = 'play'; break;
      case 'restart': this.startGame(this.def); break;
      case 'quit': this.endParty(); this.openMenu(); break;
      case 'replay': this.startGame(this.def); break;
      case 'menu': this.endParty(); this.openMenu(); break;
      case 'keys': this.openKeys(); break;
      case 'keys-back': this.keyWait = null; this.openLobby(); break;
      case 'keys-reset': resetKeys(); this.keyWait = null; this.renderKeys('keys-reset'); break;
      case 'bind': this.keyWait = { s: +el.dataset.s, a: el.dataset.a, t: 0.15 }; this.renderKeys(); break;
      case 'pset-board': this.partySet.board = !this.partySet.board; this.savePartySet(); this.renderPartySet('pset-board'); break;
      case 'pb-go': this.action('party-next'); break;
      case 'pb-buy': this.shopAnswer(true); break;
      case 'pb-skip': this.shopAnswer(false); break;
      case 'sudden-again': this.startGame(this.party.sd.def); break;
      case 'sudden-done': this.showBoard(); break;
      case 'party-next':
        // ALL15: sau mỗi game đi trên bàn cờ (nếu bật)
        if (this.partySet.board && !this.party.moved) { this.openPBoard(); break; }
        this.party.moved = false;
        if (this.party.idx < this.party.queue.length - 1) {
          this.party.idx++;
          // ALL2: giữa các game có vòng quay sự kiện (60%)
          if (Math.random() < 0.6) this.openEvent();
          else this.startGame(this.party.queue[this.party.idx]);
        } else if (!this.trySudden()) this.showBoard();
        break;
      case 'event-go': this.startGame(this.party.queue[this.party.idx]); break;
      case 'event-pick': {
        const def = Party.games.find((g) => g.id === el.dataset.id);
        if (def) this.party.queue[this.party.idx] = def;
        this.startGame(this.party.queue[this.party.idx]);
        break;
      }
      case 'party-new': this.openPartySet(); break;
      case 'go': this.beginCountdown(); break;
      case 'mode': this.cycleMode(); break;
      case 'mode-set': this.setMode(el.dataset.mode); break;
      case 'variant-set': this.setVariant(el.dataset.variant); break;
      case 'intro-back': this.endParty(); this.openMenu(); break;
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
    if (s < 0) s = this.slots.findIndex((p) => p && p.bot);
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
  addBot(slot) {
    const s = slot ?? this.slots.findIndex((p) => !p);
    if (s < 0 || this.slots[s]) return;
    this.slots[s] = this.makePlayer(s, null, true);
    if (this.picking === s) this.picking = -1;
    Sfx.play('join');
    this.renderLobby();
  },
  removeBot() {
    for (let s = 3; s >= 0; s--) if (this.slots[s] && this.slots[s].bot) { this.removeSlot(s); return; }
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
          <div class="row tight"><button class="btn small" data-act="slot-human" data-s="${s}">🙋 Người chơi</button>
            <button class="btn small" data-act="slot-bot" data-s="${s}">🤖 Máy</button></div></div>`;
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

    const lvBtn = document.getElementById('btn-bot-level');
    const icons = { easy: '🟢', normal: '🟡', hard: '🔴' };
    lvBtn.textContent = `${icons[this.botLevel]} Máy: ${BOT_LEVELS[this.botLevel].name}`;
    const L = GAME_LENGTHS[this.lenLevel];
    document.getElementById('btn-len-level').textContent = `${L.icon} Ván: ${L.name}`;
    document.getElementById('btn-speed').textContent = this.fast ? '⚡ Tua nhanh ×1,3' : '🐢 Tốc độ thường';
    const n = this.slots.filter(Boolean).length;
    document.getElementById('btn-add-bot').disabled = n >= 4;
    const btn = document.getElementById('btn-lobby-next');
    btn.disabled = n < 2;
    btn.textContent = n < 2 ? 'Cần ít nhất 2 người' : `Chọn game → (${n} người)`;
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
    const n = this.players.length, cat = this.menuCat || 'all';
    document.getElementById('cats').innerHTML = GAME_CATS.map((c) => {
      const cnt = c.id === 'all' ? Party.games.length : Party.games.filter((g) => g.cat === c.id).length;
      return `<button class="btn tab ${c.id === cat ? 'on' : ''}" data-act="cat" data-cat="${c.id}">${c.icon} ${c.name} <small>${cnt}</small></button>`;
    }).join('');
    const cards = cat !== 'all' ? [] : [`<button class="btn gamecard party" data-act="party">
        <span class="em">🎉</span><span class="gn">Chơi tiệc</span>
        <span class="gt">${this.partySet.count} game ngẫu nhiên liên tiếp · tự chọn danh sách game · cộng điểm</span>
        <span class="gp">${n} người</span></button>`];
    for (const g of Party.games) {
      if (cat !== 'all' && g.cat !== cat) continue;
      const ok = n >= (g.minPlayers || 2) && n <= (g.maxPlayers || 4);
      cards.push(`<button class="btn gamecard" data-act="pick" data-id="${g.id}" ${ok ? '' : 'disabled'}>
        <span class="em">${g.emoji}</span><span class="gn">${g.name}</span>
        <span class="gt">${g.tagline}</span>
        <span class="gp">${g.minPlayers || 2}–${g.maxPlayers || 4} người${g.coop ? ' · co-op' : ''}</span></button>`);
    }
    const box = document.getElementById('games');
    box.innerHTML = cards.join('');
    box.scrollTop = 0;
  },

  /* ---------- Bắt đầu game ---------- */
  /* ---------- Vòng quay sự kiện giữa các game trong Chơi tiệc (ALL2) ---------- */
  openEvent() {
    const pts = this.party.pts, n = this.players.length;
    const lo = Math.min(...pts), hi = Math.max(...pts);
    const lastI = pts.indexOf(lo), firstI = pts.indexOf(hi);
    const pool = this.partyPool().filter((g) => g !== this.party.queue[this.party.idx]);
    const evs = [
      { id: 'double', icon: '✨', name: 'Game sau điểm ×2!' },
      { id: 'fast', icon: '⚡', name: 'Game sau tua nhanh ×1,3!' },
      { id: 'robin', icon: '🏹', name: 'Người nhất chia 2 điểm cho người bét!' },
      { id: 'bonus', icon: '🎁', name: 'Ai không đứng nhất +1 điểm!' },
      { id: 'pick', icon: '👆', name: `${this.players[lastI].name} (đang bét) được chọn game tiếp theo!` },
      { id: 'none', icon: '😅', name: 'Không có gì xảy ra…' },
    ].filter((e) => (e.id !== 'robin' || (hi - lo >= 2 && firstI !== lastI)) && (e.id !== 'pick' || pool.length >= 2) && (e.id !== 'bonus' || hi > lo));
    this.ev = { list: evs, spin: 2.2, tick: 0, k: 0, final: U.pick(evs), lastI, firstI, n, pool, done: false };
    this.state = 'event';
    this.renderEvent();
    this.show('s-event');
    Sfx.play('warn');
  },
  updateEvent(dt) {
    const e = this.ev;
    if (e.done) { this.menuInput(true); return; }
    e.spin -= dt; e.tick -= dt;
    if (e.tick <= 0) { e.k = (e.k + 1) % e.list.length; e.tick = 0.06 + Math.max(0, 0.22 - e.spin * 0.1); Sfx.tone(700 + e.k * 40, 0.04, 'square', 0.04); this.renderEvent(); }
    if (e.spin <= 0) { e.done = true; this.applyEvent(e.final); this.renderEvent(); Sfx.play('crown'); }
  },
  applyEvent(ev) {
    const P = this.party, e = this.ev;
    if (ev.id === 'double') P.mul = 2;
    if (ev.id === 'fast') P.fastNext = true;
    if (ev.id === 'robin') { P.pts[e.firstI] -= 2; P.pts[e.lastI] += 2; }
    if (ev.id === 'bonus') { const hi = Math.max(...P.pts); P.pts.forEach((v, i) => { if (v < hi) P.pts[i] += 1; }); }
    if (ev.id === 'pick') {
      e.choices = U.shuffle(e.pool.slice()).slice(0, 3);
      // người bét là máy thì tự chọn
      if (this.players[e.lastI].bot) this.party.queue[this.party.idx] = U.pick(e.choices);
    }
  },
  renderEvent() {
    const e = this.ev, cur = e.done ? e.final : e.list[e.k];
    const humanPick = e.done && e.final.id === 'pick' && !this.players[e.lastI].bot;
    const scores = this.players.map((p, i) => `<span class="ev-sc">${this.blobHTML(p.color, 'sm')} <b style="color:${p.color.light}">${p.name}</b> ${this.party.pts[i]} đ</span>`).join('');
    document.getElementById('event-card').innerHTML = `
      <span class="party-tag">🎉 Trước game ${this.party.idx + 1}/${this.party.queue.length}</span>
      <h2>🎡 Vòng quay sự kiện</h2>
      <div class="ev-wheel ${e.done ? 'done' : ''}"><span class="ev-ic">${cur.icon}</span> ${cur.name}</div>
      <div class="row">${scores}</div>
      ${humanPick ? `<p class="tag">${this.players[e.lastI].name} chọn game:</p><div class="row">${e.choices.map((g) => `<button class="btn" data-act="event-pick" data-id="${g.id}">${g.emoji} ${g.name}</button>`).join('')}</div>`
        : e.done ? `<div class="row"><button class="btn primary" data-act="event-go">Tiếp tục: ${this.party.queue[this.party.idx].emoji} ${this.party.queue[this.party.idx].name} ▶</button></div>` : ''}`;
    if (e.done) { const els = this.focusables(); this.setFocus(els.find((x) => x.classList.contains('primary')) || els[0] || null, false); }
  },

  /* ---------- Hiệp phụ quyết tử (ALL13) ---------- */
  endParty() {
    if (this.party && this.party.sd) { this.players = this.party.sd.all; this.players.forEach((p, i) => { p.index = i; }); }
    this.party = null; this.sudden = false;
  },
  /** cuối tiệc mà nhiều người hòa điểm cao nhất → chỉ những người đó đấu 1 ván quyết tử */
  trySudden() {
    const P = this.party, hi = Math.max(...P.pts);
    const tied = P.pts.map((v, i) => (v === hi ? i : -1)).filter((i) => i >= 0);
    if (tied.length < 2 || P.sdWin >= 0) return false;
    const cands = ['sumo', 'fencing'].map((id) => Party.games.find((g) => g.id === id)).filter(Boolean);
    if (!cands.length) return false;
    P.sd = { all: this.players, ids: tied, def: U.pick(cands) };
    this.players = tied.map((i) => P.sd.all[i]);
    this.startGame(P.sd.def);
    return true;
  },
  showSuddenResult() {
    const P = this.party, sd = P.sd, place = this.rankOf(this.res);
    const win = place.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    let body;
    if (win.length === 1) {
      const w = sd.ids[win[0]], wp = sd.all[w];
      this.players = sd.all; this.players.forEach((p, i) => { p.index = i; });
      P.pts[w] += 1; P.sdWin = w; P.sd = null; this.sudden = false;
      body = `<div class="em">⚔️</div><h2><span style="color:${wp.color.light}">${wp.name}</span> thắng hiệp phụ!</h2>
        <p class="tag">+1 điểm · ${P.pts[w]} điểm — vô địch tiệc!</p>
        <div class="row"><button class="btn primary" data-act="sudden-done">Xem chung cuộc 🏆</button></div>`;
    } else {
      body = `<div class="em">🤝</div><h2>Vẫn hòa!</h2><p class="tag">Đấu lại thêm một hiệp phụ nữa.</p>
        <div class="row"><button class="btn primary" data-act="sudden-again">⚔️ Đấu lại</button></div>`;
    }
    document.getElementById('result-card').innerHTML = `<span class="party-tag sd-tag">⚔️ Hiệp phụ quyết tử</span>${body}`;
    this.state = 'result';
    this.show('s-result');
    this.lock = 0.9;
    Sfx.play('win');
  },

  /* ---------- Bàn cờ Chơi tiệc (ALL15) ---------- */
  openPBoard() {
    const P = this.party, n = this.players.length, place = P.lastPlace || this.players.map(() => 0);
    const RANGE = [[3, 6], [2, 5], [1, 4], [1, 3]];
    const order = this.players.map((_, i) => i).sort((a, b) => place[a] - place[b] || a - b);
    this.pb = { order, k: -1, phase: 'next', t: 0.6, roll: 0, steps: 0, log: [], RANGE, place, shop: null, done: false, show: 0 };
    void n;
    this.state = 'pboard';
    this.renderPBoard();
    this.show('s-pboard');
    this.inst = null;
  },
  pbTiles() {
    if (this.PB_TILES) return this.PB_TILES;
    const T = ['start', 'coin', 'coin', 'steal', 'coin', 'star', 'back', 'coin', 'shop', 'coin', 'coin', 'steal', 'coin',
      'star', 'coin', 'back', 'coin', 'shop', 'coin', 'coin', 'star', 'coin', 'back', 'steal', 'coin'];
    // 25 ô xếp quanh một hình chữ nhật bo góc
    const cx = W / 2, cy = 330, hw = 470, hh = 175, per = 4 * (hw + hh), out = [];
    for (let k = 0; k < T.length; k++) {
      let d = (k / T.length) * per, x, y;
      if (d < 2 * hw) { x = cx - hw + d; y = cy - hh; }
      else if ((d -= 2 * hw) < 2 * hh) { x = cx + hw; y = cy - hh + d; }
      else if ((d -= 2 * hh) < 2 * hw) { x = cx + hw - d; y = cy + hh; }
      else { d -= 2 * hw; x = cx - hw; y = cy + hh - d; }
      out.push({ type: T[k], x, y });
    }
    this.PB_TILES = out;
    return out;
  },
  updatePBoard(dt) {
    const b = this.pb, P = this.party, tiles = this.pbTiles(), N = tiles.length;
    if (b.done || b.shop) { this.menuInput(true); return; }
    b.t -= dt;
    if (b.t > 0) { if (b.phase === 'roll') { b.show = U.randi(b.RANGE[Math.min(3, b.place[b.order[b.k]])][0], b.RANGE[Math.min(3, b.place[b.order[b.k]])][1]); } return; }
    const i = b.k >= 0 ? b.order[b.k] : -1, name = i >= 0 ? this.players[i].name : '';
    if (b.phase === 'next') {
      b.k++;
      if (b.k >= b.order.length) { b.done = true; P.moved = true; this.renderPBoard(); Sfx.play('crown'); return; }
      const j = b.order[b.k], rg = b.RANGE[Math.min(3, b.place[j])];
      b.roll = U.randi(rg[0], rg[1]); b.steps = b.roll; b.phase = 'roll'; b.t = 0.8; Sfx.play('warn');
    } else if (b.phase === 'roll') {
      b.show = b.roll; b.log.push(`${name} gieo được ${b.roll}`); this.renderPBoard();
      b.phase = 'walk'; b.t = 0.35;
    } else if (b.phase === 'walk') {
      if (b.steps > 0) {
        P.pos[i] = (P.pos[i] + 1) % N; b.steps--; b.t = 0.2; Sfx.tone(600 + (b.roll - b.steps) * 60, 0.05, 'square', 0.05);
        if (P.pos[i] === 0) { P.pts[i] += 3; b.log.push(`${name} đi qua 🏁 Xuất phát +3`); this.renderPBoard(); }
      } else { b.phase = 'land'; b.t = 0.25; }
    } else if (b.phase === 'land') {
      this.landTile(i, tiles[P.pos[i]].type);
      if (!b.shop) { b.phase = 'next'; b.t = 0.7; }
      this.renderPBoard();
    }
  },
  landTile(i, type) {
    const P = this.party, b = this.pb, name = this.players[i].name;
    const leader = () => { let best = -1; P.pts.forEach((v, j) => { if (j !== i && v > 0 && (best < 0 || v > P.pts[best])) best = j; }); return best; };
    if (type === 'coin') { P.pts[i] += 1; b.log.push(`${name} 🪙 +1 điểm`); Sfx.play('pickup'); }
    else if (type === 'star') { P.pts[i] += 3; b.log.push(`${name} ⭐ +3 điểm!`); Sfx.play('crown'); }
    else if (type === 'steal') {
      const j = leader();
      if (j >= 0) { const v = Math.min(2, P.pts[j]); P.pts[j] -= v; P.pts[i] += v; b.log.push(`${name} 🦹 cướp ${v} điểm của ${this.players[j].name}!`); Sfx.play('hurt'); }
      else b.log.push(`${name} 🦹 chẳng có ai để cướp`);
    } else if (type === 'back') {
      const N = this.pbTiles().length; P.pos[i] = (P.pos[i] - 3 + N) % N; b.log.push(`${name} ⏪ lùi 3 ô`); Sfx.play('leave');
    } else if (type === 'shop') {
      const j = leader();
      if (P.pts[i] < 3 || j < 0) b.log.push(`${name} 🛒 ghé cửa hàng nhưng ${P.pts[i] < 3 ? 'không đủ 3 điểm' : 'chưa có ai để yểm'}`);
      else if (this.players[i].bot) {
        if (Math.random() < 0.6) this.buyCurse(i, j); else b.log.push(`${name} 🛒 không mua gì`);
      } else { b.shop = { i, j }; Sfx.play('warn'); }
    } else if (type === 'start') { P.pts[i] += 3; b.log.push(`${name} 🏁 đứng ở Xuất phát +3`); }
    b.log = b.log.slice(-4);
  },
  buyCurse(i, j) {
    const P = this.party;
    P.pts[i] -= 3; P.curse[j] = true;
    this.pb.log.push(`${this.players[i].name} 🛒 mua bùa: ${this.players[j].name} bị 🔄 đảo phím ở game sau!`);
    Sfx.play('boom', 0.05);
  },
  shopAnswer(buy) {
    const b = this.pb;
    if (!b || !b.shop) return;
    if (buy) this.buyCurse(b.shop.i, b.shop.j); else b.log.push(`${this.players[b.shop.i].name} 🛒 không mua gì`);
    b.log = b.log.slice(-4);
    b.shop = null; b.phase = 'next'; b.t = 0.6;
    this.renderPBoard();
  },
  renderPBoard() {
    const b = this.pb, P = this.party;
    const last = P.idx >= P.queue.length - 1;
    const sh = b.shop;
    document.getElementById('pboard-card').innerHTML = `
      <div class="pb-log">${b.log.map((l) => `<div>${l}</div>`).join('') || '<div>🎲 Về càng cao, xúc xắc càng to…</div>'}</div>
      ${sh ? `<div class="row"><span class="tag">🛒 ${this.players[sh.i].name}: mua bùa đảo phím ${this.players[sh.j].name} (−3 điểm)?</span>
          <button class="btn primary" data-act="pb-buy">Mua 🔄</button><button class="btn" data-act="pb-skip">Bỏ qua</button></div>`
        : b.done ? `<div class="row"><button class="btn primary" data-act="pb-go">${last ? 'Xem chung cuộc 🏆' : `Game tiếp theo (${P.idx + 2}/${P.queue.length}) ▶`}</button></div>` : ''}`;
    if (sh || b.done) { const els = this.focusables(); this.setFocus(els.find((x) => x.classList.contains('primary')) || els[0] || null, false); }
  },
  drawPBoard(ctx) {
    const b = this.pb, P = this.party, tiles = this.pbTiles(), t = U.now();
    if (!b) return;
    ctx.fillStyle = 'rgba(14,8,30,0.55)'; ctx.fillRect(0, 0, W, H);
    const ICON = { start: '🏁', coin: '🪙', star: '⭐', steal: '🦹', back: '⏪', shop: '🛒' };
    const COL = { start: '#ffd23f', coin: '#5b9bd5', star: '#ffb84d', steal: '#e85a6a', back: '#8a7aa8', shop: '#4ec98a' };
    Draw.text(ctx, '🎲 Bàn cờ Chơi tiệc', W / 2, 92, { size: 34 });
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 16; ctx.lineJoin = 'round';
    ctx.beginPath(); tiles.forEach((tl, k) => (k ? ctx.lineTo(tl.x, tl.y) : ctx.moveTo(tl.x, tl.y))); ctx.closePath(); ctx.stroke();
    tiles.forEach((tl) => {
      ctx.fillStyle = COL[tl.type]; ctx.beginPath(); ctx.arc(tl.x, tl.y, 28, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(20,10,40,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      Draw.text(ctx, ICON[tl.type], tl.x, tl.y + 1, { size: 24, stroke: null });
    });
    // quân cờ
    const cnt = {};
    this.players.forEach((p, i) => {
      const k = P.pos[i], m = cnt[k] = (cnt[k] || 0) + 1, tl = tiles[k];
      const cur = b.order[b.k] === i && !b.done;
      const ox = (m - 1) % 2 ? 14 : -14, oy = m > 2 ? 14 : -14;
      Draw.blob(ctx, { x: tl.x + ox, y: tl.y + oy - (cur ? Math.abs(Math.sin(t * 8)) * 12 : 0), r: 15, color: p.color, face: Math.PI / 2 });
    });
    // giữa bàn: bảng điểm + xúc xắc
    const inner = this.players.map((p, i) => ({ p, i })).sort((a, c) => P.pts[c.i] - P.pts[a.i]);
    inner.forEach(({ p, i }, r) => {
      const y = 245 + r * 44;
      Draw.blob(ctx, { x: W / 2 - 170, y, r: 16, color: p.color, face: Math.PI / 2, shadow: false });
      Draw.text(ctx, `${p.name}${P.curse[i] ? ' 🔄' : ''}`, W / 2 - 140, y, { size: 24, align: 'left', color: p.color.light });
      Draw.text(ctx, `${P.pts[i]} điểm`, W / 2 + 10, y, { size: 24, align: 'left' });
    });
    if (b.k >= 0 && !b.done && b.phase !== 'next') {
      const s = b.phase === 'roll' ? 1 + Math.sin(t * 30) * 0.06 : 1;
      ctx.save(); ctx.translate(W / 2 + 200, 300); ctx.scale(s, s);
      Draw.rr(ctx, -40, -40, 80, 80, 14); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = this.players[b.order[b.k]].color.main; ctx.lineWidth = 5; ctx.stroke();
      Draw.text(ctx, String(b.show || b.roll), 0, 2, { size: 48, color: '#2a1840', stroke: null });
      ctx.restore();
    }
  },

  /* ---------- Chơi tiệc tự chọn (ALL3) ---------- */
  partyPool() {
    const n = this.players.length;
    return Party.games.filter((g) => n >= (g.minPlayers || 2) && n <= (g.maxPlayers || 4) && !this.partySet.off.includes(g.id));
  },
  savePartySet() { try { localStorage.setItem('tronparty.partySet', JSON.stringify(this.partySet)); } catch (e) { /* bỏ qua */ } },
  openPartySet() {
    this.state = 'partyset';
    this.inst = null;
    this.renderPartySet();
    this.show('s-partyset');
  },
  renderPartySet(keepFocus) {
    const n = this.players.length, set = this.partySet, pool = this.partyPool();
    const L = GAME_LENGTHS[this.lenLevel];
    const counts = [3, 5, 8].map((c) => `<button class="btn tab ${set.count === c ? 'on' : ''}" data-act="pset-count" data-n="${c}">${c} game</button>`).join('');
    const chips = GAME_CATS.filter((c) => c.id !== 'all').map((c) => {
      const games = Party.games.filter((g) => g.cat === c.id);
      if (!games.length) return '';
      return `<div class="pset-cat"><span class="pset-cn">${c.icon} ${c.name}</span>${games.map((g) => {
        const ok = n >= (g.minPlayers || 2) && n <= (g.maxPlayers || 4), on = ok && !set.off.includes(g.id);
        return `<button class="btn chip ${on ? 'on' : ''}" data-act="pset-toggle" data-id="${g.id}" ${ok ? '' : 'disabled'}>${g.emoji} ${g.name}</button>`;
      }).join('')}</div>`;
    }).join('');
    const short = pool.length < set.count;
    document.getElementById('pset-card').innerHTML = `
      <h2>🎉 Chơi tiệc</h2>
      <p class="tag">Chọn số game và những game được bốc ngẫu nhiên · Ván ${L.name.toLowerCase()} (đổi ở sảnh)</p>
      <div class="row">${counts}<button class="btn tab" data-act="pset-all">Chọn hết</button><button class="btn tab" data-act="pset-none">Bỏ hết</button>
        <button class="btn tab ${set.board ? 'on' : ''}" data-act="pset-board">🎲 Bàn cờ: ${set.board ? 'Bật' : 'Tắt'}</button></div>
      ${set.board ? '<p class="tag pset-board">Sau mỗi game mọi người đi trên bàn cờ 25 ô — về càng cao xúc xắc càng to. Ô ⭐ +3, 🪙 +1, 🦹 cướp điểm, ⏪ lùi 3 ô, 🛒 mua bùa đảo phím người dẫn đầu.</p>' : ''}
      <div class="pset-list">${chips}</div>
      <p class="pset-info">${pool.length} game đang bật${short && pool.length ? ` — ít hơn ${set.count}, tiệc sẽ chỉ có ${pool.length} game` : ''}${!pool.length ? ' — hãy bật ít nhất 1 game' : ''}</p>
      <div class="row"><button class="btn" data-act="pset-back">← Chọn game</button>
        <button class="btn primary big" data-act="pset-go" ${pool.length ? '' : 'disabled'}>Bắt đầu tiệc ▶</button></div>`;
    if (keepFocus) {
      const [act, rest] = [keepFocus.match(/^pset-[a-z]+/)[0], keepFocus.replace(/^pset-[a-z]+/, '')];
      const sel = act === 'pset-count' ? `[data-act="pset-count"][data-n="${rest}"]` : act === 'pset-toggle' ? `[data-act="pset-toggle"][data-id="${rest}"]` : `[data-act="${act}"]`;
      this.setFocus(document.querySelector(`#pset-card ${sel}`), false);
    }
  },
  startParty() {
    const pool = this.partyPool();
    if (!pool.length) { this.openPartySet(); return; }
    this.party = { queue: U.shuffle(pool.slice()).slice(0, Math.min(this.partySet.count, pool.length)), idx: 0, pts: this.players.map(() => 0),
      pos: this.players.map(() => 0), curse: this.players.map(() => false), moved: false, sd: null, sdWin: -1 };
    this.startGame(this.party.queue[0]);
  },
  startGame(def) {
    this.def = def;
    this.players.forEach((p, i) => { p.index = i; });
    const len = GAME_LENGTHS[this.lenLevel];
    this.api = {
      players: this.players, parts: new Particles(), bot: BOT_LEVELS[this.botLevel], len,
      T: (sec) => Math.round(sec * len.time),                      // thời gian ván theo độ dài
      wins: len.wins,                                              // số hiệp cần thắng
      count: (n) => Math.max(1, Math.round(n * len.count)),       // số câu / vòng / hộp / điểm
    };
    this.players.forEach((p) => { p.mem = null; });
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
    // ALL13: hiệp phụ quyết tử — luôn dùng chế độ cơ bản của game
    this.sudden = !!(this.party && this.party.sd);
    this.api.sudden = this.sudden;
    if (this.sudden && def.modes) this.api.mode = def.modes[0].id;
    // ALL15: bùa đảo phím mua ở bàn cờ
    this.curse = this.players.map((p, i) => !!(this.party && !this.sudden && this.party.curse && this.party.curse[i]));
    const pc = def.playerChoices;
    this.choices = this.players.map((p) => (pc ? (p.bot ? (pc.botDef ?? U.randi(0, pc.items.length - 1)) : (pc.def ?? 0)) : 0));
    this.api.choices = this.choices;
    // phụ kiện trang trí (def.looks) — người thật đổi bằng nút Lên, nhớ theo từng chỗ ngồi
    this.lookMem = this.lookMem || [];
    this.looks = this.players.map((p, i) => (def.looks ? (p.bot ? U.randi(0, def.looks.length - 1) : (this.lookMem[i] || 0) % def.looks.length) : 0));
    this.api.looks = this.looks;
    this.prevUp = this.players.map(() => false);
    this.prevDir = this.players.map(() => 0);
    this.speedMul = this.fast || (this.party && this.party.fastNext) ? 1.3 : 1;
    // ALL10: cược điểm trong Chơi tiệc — máy có điểm thì đôi khi cược
    this.bets = this.players.map((p, i) => !!(this.party && !this.sudden && p.bot && this.party.pts[i] >= 1 && Math.random() < 0.3));
    this.prevDown = this.players.map(() => false);
    this.inst = def.create(this.api);
    this.res = null;
    this.ready = this.players.map((p) => p.bot);
    this.state = 'intro';
    this.renderIntro();
    this.show('s-intro');
    this.lock = 0.4;
  },
  renderIntro() {
    const d = this.def, md = d.modes && d.modes.find((m) => m.id === this.api.mode);
    const c = (md && md.controls) || d.controls; // chế độ có thể ghi đè luật chơi / cột phím
    const rows = this.players.map((p, i) => {
      const lb = srcLabels(p.src);
      const k = (s) => p.bot ? '—' : `<kbd>${s}</kbd>`;
      const team = this.inst.teamOf
        ? `<td><b style="color:${TEAMS.colors[this.inst.teamOf(i)]}">${TEAMS.names[this.inst.teamOf(i)]}</b></td>` : '';
      const pc = d.playerChoices, it = pc ? pc.items[this.choices[i]] : null;
      const choice = (pc ? `<td class="choice">${p.bot ? '' : '◀ '}${it.icon} <b>${it.name}</b>${p.bot ? '' : ' ▶'}</td>` : '')
        + (d.looks ? `<td class="choice">${d.looks[this.looks[i]].icon}${p.bot ? '' : ' <small>↑</small>'}</td>` : '');
      return `<tr><td><span class="who">${this.blobHTML(p.color, 'sm')} ${p.name}</span></td>${team}${choice}
        <td>${p.bot ? '🤖 Máy' : srcName(p.src)}</td>
        <td>${k(lb ? lb.move : '')}</td>
        ${c.act ? `<td>${k(lb ? lb.act : '')}</td>` : ''}
        ${c.jump ? `<td>${k(lb ? lb.jump : '')}</td>` : ''}
        ${this.party && !this.sudden ? `<td class="bet">${this.curse[i] ? '🔄 Bị đảo phím ' : ''}${this.bets[i] ? '🎲 Cược 1đ' : p.bot || this.party.pts[i] < 1 ? '' : '<small>↓ cược</small>'}</td>` : ''}
        <td class="ready ${this.ready[i] ? 'yes' : 'no'}">${this.ready[i] ? '✓ Sẵn sàng' : 'Nhấn nút Đánh…'}</td></tr>`;
    }).join('');
    const L = GAME_LENGTHS[this.lenLevel];
    const partyTag = (this.sudden ? '<span class="party-tag sd-tag">⚔️ Hiệp phụ quyết tử — hòa hạng nhất!</span> '
      : this.party ? `<span class="party-tag">🎉 Game ${this.party.idx + 1}/${this.party.queue.length}</span> ` : '')
      + `<span class="party-tag len-tag">${L.icon} Ván ${L.name.toLowerCase()}</span>`
      + (this.speedMul > 1 ? ' <span class="party-tag fast-tag">⚡ Tua nhanh ×1,3</span>' : '')
      + (this.party && this.party.mul > 1 ? ' <span class="party-tag">✨ Điểm ×2</span>' : '');
    const compact = !!(d.modes || d.playerChoices || this.party), card = document.getElementById('intro-card');
    card.classList.toggle('compact', compact);
    card.innerHTML = `
      ${partyTag}
      ${compact ? `<h2>${d.emoji} ${d.name}</h2>` : `<div class="em">${d.emoji}</div>
      <h2>${d.name}</h2>`}
      <p class="tag">${(md && md.how) || d.how || d.tagline}</p>
      ${d.modes && !this.sudden ? `<div class="mode-pick">
        <div class="mode-lbl">Chọn chế độ <small>· bấm vào thẻ, hoặc nút Nhảy để chuyển</small></div>
        <div class="mode-cards">${d.modes.map((m) => {
          const on = m.id === this.api.mode;
          return `<button class="mode-card${on ? ' on' : ''}" data-act="mode-set" data-mode="${m.id}" title="${m.desc.replace(/"/g, '&quot;')}">
            ${on ? '<span class="mcheck">✓</span>' : ''}<span class="mi">${modeIcon(d.id, m)}</span><b>${m.name}</b></button>`;
        }).join('')}</div>
        <div class="mode-desc2">${(d.modes.find((m) => m.id === this.api.mode) || d.modes[0]).desc}</div></div>` : ''}
      ${d.variants && !this.sudden ? `<div class="mode-pick">
        <div class="mode-lbl">${d.variants.label} <small>· bấm vào thẻ, hoặc nút Lên để chuyển</small></div>
        <div class="mode-cards">${d.variants.items.map((v) => {
          const on = v.id === this.api.variant;
          return `<button class="mode-card${on ? ' on' : ''}" data-act="variant-set" data-variant="${v.id}" title="${v.desc.replace(/"/g, '&quot;')}">
            ${on ? '<span class="mcheck">✓</span>' : ''}<span class="mi">${v.icon || '🎮'}</span><b>${v.name}</b></button>`;
        }).join('')}</div>
        <div class="mode-desc2">${(d.variants.items.find((v) => v.id === this.api.variant) || d.variants.items[0]).desc}</div></div>` : ''}
      ${this.lengthInfo() ? `<p class="tag len-info">Ván này: <b>${this.lengthInfo()}</b></p>` : ''}
      ${this.sudden ? '<p class="tag choice-legend">Chỉ những người đang hòa điểm cao nhất được vào. Ai thắng được +1 điểm và vô địch!</p>' : ''}
      ${this.party && !this.sudden && this.party.idx > 0 ? '<p class="tag choice-legend">🎲 Cược: bấm nút Xuống để cược 1 điểm — về nhất được +2, về bét mất điểm cược</p>' : ''}
      ${d.playerChoices ? `<p class="tag choice-legend">${d.playerChoices.items.map((x) => `${x.icon} <b>${x.name}</b>: ${x.desc}`).join(' &nbsp;·&nbsp; ')}</p>` : ''}
      <table class="ctl">
        <tr><th></th>${this.inst.teamOf ? '<th>Đội</th>' : ''}${d.playerChoices ? `<th>${d.playerChoices.label} (← →)</th>` : ''}${d.looks ? '<th>Phụ kiện (↑)</th>' : ''}<th></th><th>${c.move || 'Di chuyển'}</th>${c.act ? `<th>${c.act}</th>` : ''}${c.jump ? `<th>${c.jump}</th>` : ''}${this.party && !this.sudden ? '<th>Cược</th>' : ''}<th></th></tr>
        ${rows}
      </table>
      <div class="row">
        <button class="btn" data-act="intro-back">← Đổi game</button>
        <button class="btn primary" data-act="go">Bắt đầu luôn (Enter)</button>
      </div>`;
    const els = this.focusables();
    this.setFocus(els.find((e) => e.classList.contains('primary')) || null, false);
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
      // ALL10: nút Xuống = bật/tắt cược 1 điểm (chỉ trong Chơi tiệc, cần có ít nhất 1 điểm)
      const down = q.my > 0.5 && Math.abs(q.mx) < 0.5;
      if (this.party && !this.sudden && down && !this.prevDown[i] && this.party.pts[i] >= 1) { this.bets[i] = !this.bets[i]; changed = true; Sfx.play(this.bets[i] ? 'crown' : 'leave'); }
      this.prevDown[i] = down;
      if (this.def.variants && !this.def.looks && !this.sudden) {
        const up = q.my < -0.5 && Math.abs(q.mx) < 0.5;
        if (up && !this.prevUp[i]) variantHit = true;
        this.prevUp[i] = up;
      }
      if (this.def.looks) {
        const up = q.my < -0.5 && Math.abs(q.mx) < 0.5;
        if (up && !this.prevUp[i]) { this.looks[i] = (this.looks[i] + 1) % this.def.looks.length; this.lookMem[i] = this.looks[i]; changed = true; Sfx.play('move'); }
        this.prevUp[i] = up;
      }
      if (this.def.modes && q.jumpP && !this.sudden) modeHit = true;
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
    if (this.sudden) { this.showSuddenResult(); return; }
    const res = this.res, n = this.players.length;
    const place = this.rankOf(res);
    if (this.party) { this.party.lastPlace = place.slice(); this.party.curse = this.players.map(() => false); }
    const order = this.players.map((_, i) => i).sort((a, b) => place[a] - place[b] || a - b);
    const worst = Math.max(...place);
    const mul = this.party && this.party.mul > 1 ? this.party.mul : 1;
    const betTxt = [];
    const pts = place.map((p, i) => {
      let v = (n - 1 - p) * mul;
      // ALL10: cược — nhất +2, bét mất 1 điểm cược
      if (this.party && this.bets[i]) {
        if (p === 0) { v += 2; betTxt[i] = ' 🎲+2'; } else if (p === worst) { v -= 1; betTxt[i] = ' 🎲−1'; } else betTxt[i] = ' 🎲';
      }
      return v;
    });
    if (this.party) {
      pts.forEach((v, i) => { this.party.pts[i] = Math.max(0, this.party.pts[i] + v); });
      this.party.mul = 1; this.party.fastNext = false;
    }
    const winners = order.filter((i) => place[i] === 0);
    let title = winners.length === 1
      ? `<span style="color:${this.players[winners[0]].color.light}">${this.players[winners[0]].name}</span> thắng!`
      : (winners.length === n ? 'Hòa cả làng!' : 'Đồng hạng nhất!');
    if (this.inst.resultTitle) title = this.inst.resultTitle();
    const medals = ['🥇', '🥈', '🥉', '4'];
    const rows = order.map((i) => {
      const p = this.players[i];
      const extra = this.party ? `<span class="pts">${pts[i] >= 0 ? '+' : ''}${pts[i]}${betTxt[i] || ''} · ${this.party.pts[i]} đ</span>` : '<span></span>';
      return `<div class="r ${place[i] === 0 ? 'first' : ''}">
        <span class="medal">${medals[place[i]]}</span>${this.blobHTML(p.color, 'sm')}
        <span class="nm" style="color:${p.color.light}">${p.name}${p.bot ? ' 🤖' : ''}</span>
        <span class="val">${res[i].text}</span>${extra}</div>`;
    }).join('');
    let btns;
    if (this.party) {
      const last = this.party.idx >= this.party.queue.length - 1;
      btns = `<button class="btn" data-act="menu">Dừng tiệc</button>
        <button class="btn primary" data-act="party-next">${last ? 'Xem chung cuộc 🏆' : `Game tiếp theo (${this.party.idx + 2}/${this.party.queue.length}) ▶`}</button>`;
    } else {
      btns = `<button class="btn" data-act="menu">Chọn game khác</button>
        <button class="btn primary" data-act="replay">↻ Chơi lại</button>`;
    }
    document.getElementById('result-card').innerHTML = `
      ${this.party ? `<span class="party-tag">🎉 Game ${this.party.idx + 1}/${this.party.queue.length}</span>` : ''}
      <div class="em">🏆</div><h2>${title}</h2>
      <p class="tag">${this.def.name}</p>
      <div class="rank">${rows}</div>
      <div class="row">${btns}</div>`;
    this.state = 'result';
    this.show('s-result');
    this.lock = 0.9;
    Sfx.play('win');
  },
  showBoard() {
    const pts = this.party.pts, n = this.players.length;
    const res = pts.map((v) => ({ score: v }));
    const place = this.rankOf(res);
    const order = this.players.map((_, i) => i).sort((a, b) => place[a] - place[b] || a - b);
    const winners = order.filter((i) => place[i] === 0);
    const medals = ['🥇', '🥈', '🥉', '4'];
    const rows = order.map((i) => {
      const p = this.players[i];
      return `<div class="r ${place[i] === 0 ? 'first' : ''}">
        <span class="medal">${medals[place[i]]}</span>${this.blobHTML(p.color, 'sm')}
        <span class="nm" style="color:${p.color.light}">${p.name}${p.bot ? ' 🤖' : ''}</span>
        <span class="val"></span><span class="pts">${pts[i]} điểm</span></div>`;
    }).join('');
    const title = winners.length === 1
      ? `Vô địch: <span style="color:${this.players[winners[0]].color.light}">${this.players[winners[0]].name}</span>!`
      : 'Đồng vô địch!';
    const sdNote = this.party.sdWin >= 0 ? `<p class="tag">⚔️ ${this.players[this.party.sdWin].name} thắng hiệp phụ quyết tử (+1 điểm)</p>` : '';
    document.getElementById('board-card').innerHTML = `
      <div class="em">👑</div><h2>${title}</h2>
      <p class="tag">Kết quả chung cuộc sau ${this.party.queue.length} game</p>${sdNote}
      <div class="rank">${rows}</div>
      <div class="row"><button class="btn" data-act="menu">Về chọn game</button>
      <button class="btn primary" data-act="party-new">🎉 Tiệc mới</button></div>`;
    this.state = 'board';
    this.show('s-board');
    this.lock = 0.9;
    Sfx.play('win');
    void n;
  },

  /* ---------- Vòng lặp ---------- */
  gatherInputs(dt = 1 / 60) {
    const empty = { mx: 0, my: 0, act: false, jump: false, actP: false, jumpP: false };
    return this.players.map((p, i) => {
      let q;
      if (p.bot) {
        const b = Object.assign({}, empty, (this.inst.botInput && this.inst.botInput(i)) || {});
        q = this.def.rawBot ? b : this.weakenBot(p, b, dt);
      } else q = Input.read(p.src);
      // ALL15: bùa đảo phím — đi ngược hướng cả ván
      if (this.curse && this.curse[i]) q = Object.assign({}, q, { mx: -q.mx, my: -q.my });
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
    const lv = this.api.bot;
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
      case 'event': this.updateEvent(dt); break;
      case 'keys': this.updateKeys(dt); break;
      case 'pboard': this.updatePBoard(dt); break;
      case 'partyset': {
        const m = this.menuInput(true);
        if (m.back && this.lock <= 0) this.action('pset-back');
        break;
      }
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
        if (m.back || m.start || Input.hit('KeyP')) {
          this.state = 'paused'; this.show('s-pause'); break;
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
      case 'result':
      case 'board': this.menuInput(true); break;
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
      if (this.state === 'pboard') this.drawPBoard(ctx);
    }
    ctx.restore();
    if (this.state === 'countdown') {
      const c = Math.ceil(this.cd), age = 1 - (this.cd - Math.floor(this.cd));
      ctx.fillStyle = 'rgba(10,5,25,0.25)'; ctx.fillRect(0, 0, W, H);
      Draw.banner(ctx, String(c), age < 1 ? age : 0, { size: 170, color: '#ffe14d' });
    } else if (this.state === 'play' && this.goT < 0.8) {
      ctx.globalAlpha = 1 - this.goT / 0.8;
      Draw.banner(ctx, 'Bắt đầu!', this.goT, { size: 110, color: '#5dff9b' });
      ctx.globalAlpha = 1;
    } else if (this.state === 'ending') {
      Draw.banner(ctx, 'Kết thúc!', this.endAge, { size: 100, color: '#ffe14d', y: H / 2 - 40 });
    }
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

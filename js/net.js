'use strict';
/* =========================================================
   Net — chơi qua mạng kiểu "Remote Play": máy chủ (máy mở index.html bấm "Tạo phòng") chạy game như thường,
   phát HÌNH + TIẾNG của game sang máy khác qua WebRTC; người ở máy khác mở online.html, nhập mã phòng,
   phím của họ gửi ngược về và vào game như một bộ điều khiển (src { type: 'net', id, key }).
   - Tìm nhau (báo hiệu) qua máy chủ PeerJS miễn phí trên Internet (0.peerjs.com) → cần Internet lúc vào phòng;
     hình/phím sau đó đi thẳng giữa hai máy (cùng mạng nhà thì không ra ngoài). PeerJS có sẵn STUN/TURN nên chơi
     được cả với bạn ở xa.
   - Thử nghiệm với máy chủ PeerJS riêng: localStorage 'tronparty.peerserver' = 'host:port' (vd. 'localhost:9000').
   - Hình phát = canvas ghép (#cv3d + #cv) khi đang chơi; ở sảnh / chọn game / kết quả (giao diện HTML, không nằm
     trên canvas) thì phát một tấm thông báo vẽ riêng.
   Cần js/lib/peerjs.min.js (PeerJS 1.5.4, MIT). Nạp TRƯỚC app.js.
   ========================================================= */
const Net = (() => {
  const PREFIX = 'tronparty-';
  const N = { peer: null, code: '', status: 'off', err: '', guests: {}, stream: null, closing: false };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function peerOpts() {
    const o = { debug: 1 };
    try {
      const s = localStorage.getItem('tronparty.peerserver');
      if (s) { const [host, port] = s.split(':'); Object.assign(o, { host, port: Number(port) || 9000, path: '/', secure: false }); }
    } catch (e) { /* bỏ qua */ }
    return o;
  }
  // TẠM ẨN (14/11/2026, chủ project yêu cầu): đổi thành true để hiện lại nút "🌐 Chơi qua mạng" ở sảnh
  const ENABLED = false;
  N.available = () => ENABLED && typeof Peer !== 'undefined';
  N.on = () => N.status === 'open' || N.status === 'opening';

  /* ---------- mở / đóng phòng ---------- */
  N.open = function () {
    if (N.peer || !N.available()) return;
    Sfx.ensure();                                   // để có luồng tiếng (cần một lần bấm của người dùng)
    N.closing = false;
    N.code = String(1000 + Math.floor(Math.random() * 9000));
    N.status = 'opening'; N.err = '';
    const peer = N.peer = new Peer(PREFIX + N.code, peerOpts());
    peer.on('open', () => { N.status = 'open'; Sfx.play('join'); N.render(); });
    peer.on('connection', (conn) => onConn(conn));
    peer.on('disconnected', () => { if (!N.closing && N.peer === peer) { try { peer.reconnect(); } catch (e) { /* bỏ qua */ } } });
    peer.on('error', (e) => {
      const t = e && e.type;
      if (t === 'unavailable-id') { N.peer = null; try { peer.destroy(); } catch (x) { /* bỏ qua */ } N.open(); return; }  // trùng mã: lấy mã khác
      if (t === 'peer-unavailable') return;
      N.status = 'error';
      N.err = t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed'
        ? 'Không nối được máy chủ tìm phòng (cần Internet). Kiểm tra mạng rồi thử lại.'
        : t === 'browser-incompatible' ? 'Trình duyệt này không hỗ trợ WebRTC.' : `Lỗi mạng: ${t || e}`;
      N.render();
    });
    N.render();
  };
  N.close = function () {
    N.closing = true;
    for (const id in N.guests) { try { N.guests[id].conn.close(); } catch (e) { /* bỏ qua */ } leave(id, true); }
    N.guests = {};
    if (N.peer) { try { N.peer.destroy(); } catch (e) { /* bỏ qua */ } }
    N.peer = null; N.status = 'off'; N.code = '';
    // người ở máy khác rời sảnh
    App.slots.forEach((p, s) => { if (p && p.src && p.src.type === 'net') App.slots[s] = null; });
    if (App.state === 'lobby') App.renderLobby(); else N.render();
  };
  N.kick = function (id) { const g = N.guests[id]; if (g) { try { g.conn.send({ t: 'kick' }); } catch (e) { /* bỏ qua */ } setTimeout(() => { try { g.conn.close(); } catch (e) { /* bỏ qua */ } }, 200); leave(id, true); } };

  /* ---------- khách ---------- */
  function onConn(conn) {
    conn.on('data', (d) => onData(conn, d));
    conn.on('close', () => leave(conn.peer));
    conn.on('error', () => leave(conn.peer));
  }
  function onData(conn, d) {
    if (!d || typeof d !== 'object') return;
    const id = conn.peer;
    if (d.t === 'hello') {
      const name = String(d.name || 'Khách').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || 'Khách';
      const s = join(id, name, String(d.key || id));
      if (s < 0) { conn.send({ t: 'full' }); setTimeout(() => { try { conn.close(); } catch (e) { /* bỏ qua */ } }, 300); return; }
      N.guests[id] = { conn, name, slot: s, call: null };
      const p = App.slots[s];
      conn.send({ t: 'ok', slot: s, name: p.name, color: p.color.main, labels: NET_LABELS });
      call(id);
      N.render();
    } else if (d.t === 'in' && d.s) {
      Input.netSet(id, d.s);
    } else if (d.t === 'ptr') {
      const g = App.inst;
      if (g && g.onPointer && ['play', 'ending'].includes(App.state) && N.guests[id]) g.onPointer(U.clamp(+d.x || 0, 0, W), U.clamp(+d.y || 0, 0, H), d.k === 'down' || d.k === 'up' ? d.k : 'move');
    }
  }
  /** cho khách vào ô trống (hoặc ô cũ của họ nếu vào lại bằng cùng `key`) — trả số ô, −1 = đầy */
  function join(id, name, key) {
    let s = App.slots.findIndex((p) => p && p.src && p.src.type === 'net' && p.src.key === key);
    if (s >= 0) {
      const old = App.slots[s].src.id;
      if (old !== id) { Input.netDrop(old); delete N.guests[old]; }
      App.slots[s].src.id = id; App.slots[s].src.off = false; App.slots[s].name = name;
    } else {
      s = App.slots.findIndex((p) => !p);
      if (s < 0) return -1;
      App.slots[s] = App.makePlayer(s, { type: 'net', id, key }, false);
      App.slots[s].name = name;
    }
    Sfx.play('join');
    if (App.state === 'lobby') App.renderLobby();
    return s;
  }
  function leave(id, quiet) {
    const g = N.guests[id];
    Input.netDrop(id);
    if (!g) return;
    delete N.guests[id];
    const p = App.slots[g.slot];
    if (p && p.src && p.src.id === id) {
      // ở sảnh: rời hẳn; đang chơi: giữ chỗ (mất kết nối, có thể vào lại bằng cùng máy)
      if (App.state === 'lobby' || App.state === 'title') App.slots[g.slot] = null; else p.src.off = true;
    }
    if (!quiet) Sfx.play('leave');
    if (App.state === 'lobby') App.renderLobby(); else N.render();
  }

  /* ---------- phát hình + tiếng ---------- */
  function call(id) {
    const c = N.peer.call(id, stream());
    N.guests[id].call = c;
    const pc = c.peerConnection;
    if (!pc) return;
    // giữ nét chữ: ưu tiên độ phân giải, bitrate cao (mạng nhà dư sức)
    const tune = () => {
      for (const snd of pc.getSenders()) {
        if (!snd.track || snd.track.kind !== 'video') continue;
        const pr = snd.getParameters();
        pr.degradationPreference = 'maintain-resolution';
        (pr.encodings || []).forEach((e) => { e.maxBitrate = 8e6; e.scaleResolutionDownBy = 1; });
        snd.setParameters(pr).catch(() => {});
      }
    };
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'connected') tune(); });
  }
  let out = null, og = null;
  function stream() {
    if (N.stream) return N.stream;
    out = document.createElement('canvas'); out.width = W; out.height = H;
    og = out.getContext('2d');
    const loop = () => { compose(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    const st = N.stream = out.captureStream(30);
    st.getVideoTracks().forEach((t) => { t.contentHint = 'detail'; });
    try {
      if (Sfx.ctx && Sfx.master) {
        const dst = Sfx.ctx.createMediaStreamDestination();
        Sfx.master.connect(dst);
        dst.stream.getAudioTracks().forEach((t) => st.addTrack(t));
      }
    } catch (e) { /* không có tiếng cũng được */ }
    return st;
  }
  const PLAYING = ['play', 'countdown', 'paused', 'ending'];
  function compose() {
    const g = og;
    if (!g) return;
    if (PLAYING.includes(App.state)) {
      const cv = document.getElementById('cv'), c3 = document.getElementById('cv3d');
      g.fillStyle = '#1d1240'; g.fillRect(0, 0, W, H);
      if (c3 && c3.style.display !== 'none') g.drawImage(c3, 0, 0, W, H);
      if (cv) g.drawImage(cv, 0, 0, W, H);
      if (App.state === 'paused') {
        g.fillStyle = 'rgba(20,10,40,0.6)'; g.fillRect(0, 0, W, H);
        Draw.text(g, '⏸ Tạm dừng', W / 2, H / 2 - 10, { size: 56 });
        Draw.text(g, 'chờ chủ phòng chơi tiếp…', W / 2, H / 2 + 46, { size: 24, weight: 600 });
      }
      return;
    }
    // màn chờ cho người ở máy khác (sảnh / chọn game / giới thiệu / kết quả là giao diện HTML)
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#2b1b5e'); gr.addColorStop(1, '#16304f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const t = performance.now() / 1000;
    const msg = {
      title: 'Đang ở màn hình chính', lobby: 'Đang ở sảnh — chờ chủ phòng chọn game', menu: 'Chủ phòng đang chọn trò chơi',
      intro: `Sắp chơi: ${App.def ? App.def.name : ''}`, result: 'Xong ván! Xem kết quả', keys: 'Chủ phòng đang đổi phím',
    }[App.state] || 'Chờ chủ phòng…';
    Draw.text(g, '🌐 Tròn Party', W / 2, 90, { size: 44, color: '#ffe14d' });
    Draw.text(g, msg, W / 2, 160, { size: 30, weight: 700 });
    let list = App.slots.filter(Boolean);
    let res = null;
    if (App.state === 'intro' || App.state === 'result') list = App.players || list;
    if (App.state === 'result' && App.res) res = App.res;
    if (App.state === 'intro' && App.def) {
      g.font = `600 20px ${FONT}`;
      const words = (App.def.tagline || '').split(' '), lines = [];
      let cur = '';
      for (const w of words) { const s = cur ? cur + ' ' + w : w; if (g.measureText(s).width > 900 && cur) { lines.push(cur); cur = w; } else cur = s; }
      if (cur) lines.push(cur);
      lines.slice(0, 2).forEach((l, k) => Draw.text(g, l, W / 2, 205 + k * 28, { size: 20, weight: 600, stroke: null, color: '#d8d0ff' }));
    }
    const y0 = 290, rowH = 86;
    list.slice(0, 4).forEach((p, k) => {
      const x = W / 2 - 330, y = y0 + k * rowH;
      g.fillStyle = 'rgba(255,255,255,0.08)'; Draw.rr(g, x, y, 660, rowH - 12, 18); g.fill();
      Draw.blob(g, { x: x + 48, y: y + 37, r: 24, color: p.color, face: Math.PI / 2, shadow: false });
      const where = p.bot ? '🤖 Máy' : p.src && p.src.type === 'net' ? (p.src.off ? '📴 mất kết nối' : '🌐 máy khác') : '🏠 máy chủ';
      Draw.text(g, p.name, x + 90, y + 28, { size: 26, align: 'left', color: p.color.light });
      Draw.text(g, where, x + 90, y + 54, { size: 16, align: 'left', weight: 600, stroke: null, color: '#cfc8ee' });
      if (res && res[App.players.indexOf(p)]) Draw.text(g, res[App.players.indexOf(p)].text, x + 640, y + 38, { size: 18, align: 'right', weight: 700, stroke: null, color: '#fff' });
    });
    Draw.text(g, 'Chủ phòng điều khiển menu · bạn chỉ cần chờ tới lúc chơi', W / 2, H - 40 + Math.sin(t * 2) * 2, { size: 18, weight: 600, stroke: null, color: '#a99fd6' });
  }

  /* ---------- bảng "Chơi qua mạng" ở sảnh ---------- */
  N.render = function () {
    const el = document.getElementById('netbox');
    if (!el) return;
    const btn = document.getElementById('btn-net');
    if (!N.available()) { el.innerHTML = ''; el.classList.remove('on'); if (btn) btn.remove(); return; }
    if (btn) btn.textContent = N.on() ? `🌐 Phòng ${N.code || '…'}` : '🌐 Chơi qua mạng';
    if (!N.boxOpen && !N.on()) { el.innerHTML = ''; el.classList.remove('on'); return; }
    el.classList.add('on');
    if (N.status === 'off') {
      el.innerHTML = `<div class="netline"><span><b>🌐 Chơi qua mạng:</b> bạn ở máy khác (laptop, điện thoại…) xem hình máy này và gửi phím về. Cần Internet lúc vào phòng.</span>
        <button class="btn primary xs" data-act="net-open">Tạo phòng</button><button class="btn xs" data-act="net-hide">Đóng</button></div>`;
      return;
    }
    if (N.status === 'opening') { el.innerHTML = '<b>🌐 Đang tạo phòng…</b>'; return; }
    if (N.status === 'error') {
      el.innerHTML = `<div class="netline"><span><b>🌐 Chưa tạo được phòng:</b> ${esc(N.err)}</span>
        <button class="btn primary xs" data-act="net-retry">Thử lại</button><button class="btn xs" data-act="net-close">Đóng</button></div>`;
      return;
    }
    const gs = Object.keys(N.guests).map((id) => {
      const g = N.guests[id];
      return `<span class="guest">🌐 ${esc(g.name)} <button class="btn xs" data-act="net-kick" data-id="${esc(id)}" title="Mời ra">✕</button></span>`;
    }).join('') || '<i>chưa có ai vào</i>';
    el.innerHTML = `<div class="netline"><span class="netcode">Mã phòng <b>${N.code}</b></span>
      <span class="nethow">Máy khác mở <b>online.html</b> (cùng thư mục game), nhập mã này</span>
      <span class="guests">${gs}</span>
      <button class="btn xs" data-act="net-close">Đóng phòng</button></div>`;
  };
  N.action = function (act, el) {
    if (act === 'net') { N.boxOpen = !N.boxOpen || N.on(); N.render(); return true; }
    if (act === 'net-open') { N.open(); return true; }
    if (act === 'net-retry') { N.close(); N.boxOpen = true; N.open(); return true; }
    if (act === 'net-close') { N.close(); N.boxOpen = false; N.render(); return true; }
    if (act === 'net-hide') { N.boxOpen = false; N.render(); return true; }
    if (act === 'net-kick') { N.kick(el.dataset.id); return true; }
    return false;
  };
  if (!N.available()) { const b = document.getElementById('btn-net'); if (b) b.remove(); }   // tắt thì gỡ nút khỏi sảnh
  return N;
})();

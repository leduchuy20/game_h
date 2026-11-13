// Cờ Tỷ Phú — cảnh 3D (Three.js r159 + kit3d.js) → window.Mono3D
// Mọi mô hình dựng bằng code, chữ/tranh trên ô vẽ ra canvas làm texture (tranh lấy từ assets/monopoly qua cfg.art).
// Cảnh chỉ "vẽ": monopoly.js quyết định vị trí quân, xúc xắc, nhà… mỗi khung.
(() => {
  'use strict';
  if (typeof window === 'undefined' || !window.Kit3D) return;
  const K = window.Kit3D, FONT = K.FONT;
  const EMO = '"Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  /* ---------- hình học bàn (đơn vị thế giới) ---------- */
  const S = 12;                     // cạnh bàn (phần ô)
  const C = 1.7;                    // ô góc C×C; ô thường TW × C
  const TW = (S - 2 * C) / 9;
  const PLATE = 0.02;               // mặt bàn
  const TH = 0.14;                  // độ dày ô
  const TOP = PLATE + TH;           // mặt trên ô
  const GAP = 0.03;                 // khe giữa các ô
  const BAND = 0.32;                // dải màu nhóm (cạnh trong)
  const OWN = 0.12;                 // tấm màu chủ ô (cạnh ngoài)
  const H0 = S / 2, IN = S / 2 - C;

  /** hình chữ nhật ô i trên mặt bàn: x0..x1 × z0..z1, side 0 dưới · 1 trái · 2 trên · 3 phải, (ix, iz) = hướng vào giữa bàn */
  const RECTS = [];
  for (let i = 0; i < 40; i++) {
    const side = Math.floor(i / 10), k = i % 10, corner = k === 0;
    let x0, x1, z0, z1;
    if (side === 0) { z0 = IN; z1 = H0; if (corner) { x0 = IN; x1 = H0; } else { x1 = IN - (k - 1) * TW; x0 = x1 - TW; } }
    else if (side === 1) { x0 = -H0; x1 = -IN; if (corner) { z0 = IN; z1 = H0; } else { z1 = IN - (k - 1) * TW; z0 = z1 - TW; } }
    else if (side === 2) { z0 = -H0; z1 = -IN; if (corner) { x0 = -H0; x1 = -IN; } else { x0 = -IN + (k - 1) * TW; x1 = x0 + TW; } }
    else { x0 = IN; x1 = H0; if (corner) { z0 = -H0; z1 = -IN; } else { z0 = -IN + (k - 1) * TW; z1 = z0 + TW; } }
    const inw = [[0, -1], [1, 0], [0, 1], [-1, 0]][side];
    RECTS.push({ i, side, corner, x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, ix: inw[0], iz: inw[1] });
  }
  /** ô dưới điểm (x, z) trên mặt bàn, −1 nếu ngoài viền ô */
  function tileAtXZ(x, z) {
    if (Math.abs(x) > H0 || Math.abs(z) > H0) return -1;
    if (Math.abs(x) < IN && Math.abs(z) < IN) return -1;
    for (const r of RECTS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.i;
    return -1;
  }

  /* ---------- vẽ chữ ---------- */
  function fit(g, s, x, y, maxW, size, min, weight, color) {
    if (!s) return;
    let fs = size;
    g.font = `${weight} ${fs}px ${FONT}`;
    while (fs > min && g.measureText(s).width > maxW) { fs -= 1; g.font = `${weight} ${fs}px ${FONT}`; }
    g.fillStyle = color; g.fillText(s, x, y);
  }
  function wrap2(g, s, w) {
    const words = s.split(' '), out = [];
    let cur = '';
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > w && cur) { out.push(cur); cur = wd; } else cur = t; }
    if (cur) out.push(cur);
    if (out.length > 2) return [out[0], out.slice(1).join(' ')];
    return out;
  }
  function crop(g, im, x, y, w, h, fy = 0.5) {
    const iw = im.width, ih = im.height, k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k;
    g.drawImage(im, (iw - sw) / 2, (ih - sh) * fy, sw, sh, x, y, w, h);
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  class MonoScene {
    constructor(cfg) {
      this.cfg = cfg;
      this.R = K.renderer();
      const scene = this.scene = new THREE.Scene();
      scene.background = K.canvasTex(4, 256, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#8fd3f4'); gr.addColorStop(0.5, '#cdeefa'); gr.addColorStop(1, '#e9f7ee');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
      scene.fog = new THREE.Fog(0xd8f0f4, 34, 70);
      this.cam = new THREE.PerspectiveCamera(28, K.W / K.H, 0.5, 160);
      this.resetView();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb6a8, 1.2));
      const sun = this.sun = new THREE.DirectionalLight(0xfff2dc, 2.5);
      sun.position.set(-8, 18, 10);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 50;
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
      scene.add(sun);
      scene.add(new THREE.AmbientLight(0xffffff, 0.22));
      this.artDone = false;
      this.buildWorld();
      this.buildBoard();
      this.buildPieces();
      this.lastOwn = []; this.lastLvl = []; this.lastMort = [];
    }
    mat(color, rough = 0.6, extra = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra)); }
    add(mesh, cast = true, recv = true, parent) { mesh.castShadow = cast; mesh.receiveShadow = recv; (parent || this.scene).add(mesh); return mesh; }

    /* ----- camera ----- */
    /** góc nhìn chuẩn; smooth = lướt dần về (nút 🎥), không thì đặt ngay */
    resetView(smooth) {
      const v0 = { yaw: 0, pitch: 1.04, dist: 27, tx: 0, tz: 0.75 };
      if (!smooth || !this.view) { this.view = v0; this.goal = null; this.applyView(); return; }
      const v = this.view;
      v.yaw = Math.atan2(Math.sin(v.yaw), Math.cos(v.yaw));       // quay đường ngắn nhất
      this.goal = v0;
    }
    /** người chơi kéo chuột thì huỷ lướt */
    stopGlide() { this.goal = null; }
    applyView() {
      const v = this.view, c = this.cam;
      v.pitch = Math.max(0.6, Math.min(1.5, v.pitch));
      v.dist = Math.max(18, Math.min(36, v.dist));
      const y = Math.sin(v.pitch) * v.dist, h = Math.cos(v.pitch) * v.dist;
      c.position.set(v.tx + Math.sin(v.yaw) * h, y, v.tz + Math.cos(v.yaw) * h);
      c.lookAt(v.tx, 0, v.tz);
      c.updateMatrixWorld();
    }

    /* ----- phố xung quanh bàn ----- */
    buildWorld() {
      const sc = this.scene;
      // cỏ (vân lốm đốm nhẹ)
      const grass = K.canvasTex(256, 256, (g, w) => {
        g.fillStyle = '#93d27e'; g.fillRect(0, 0, w, w);
        for (let k = 0; k < 1400; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(40,110,40,0.07)'; g.fillRect(Math.random() * w, Math.random() * w, 3, 3); }
      });
      grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(16, 16);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.62; this.add(ground, false, true);
      // vỉa hè + đường nhựa bao quanh bàn
      const RW = H0 + 3.6, SW = H0 + 1.5;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, RW * 2), this.mat(0x59606b, 0.95));
      road.rotation.x = -Math.PI / 2; road.position.y = -0.605; this.add(road, false, true);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(SW * 2, SW * 2), this.mat(0xe4dfd2, 0.9));
      walk.rotation.x = -Math.PI / 2; walk.position.y = -0.6; this.add(walk, false, true);
      // vạch kẻ đứt giữa đường
      const dash = new THREE.MeshBasicMaterial({ color: 0xf6f1e0 }), mid = (RW + SW) / 2;
      const dg = new THREE.PlaneGeometry(0.55, 0.09);
      for (let a = -mid; a <= mid + 0.01; a += 1.1) {
        for (const [x, z, r] of [[a, mid, 0], [a, -mid, 0], [mid, a, 1], [-mid, a, 1]]) {
          const m = new THREE.Mesh(dg, dash); m.rotation.x = -Math.PI / 2; m.rotation.z = r ? Math.PI / 2 : 0; m.position.set(x, -0.6, z); sc.add(m);
        }
      }
      // nhà phố (cửa sổ vẽ canvas) — phía xa cao, hai bên vừa, phía gần chỉ cây thấp để không che bàn
      const winTex = (base) => K.canvasTex(64, 64, (g) => {
        g.fillStyle = base; g.fillRect(0, 0, 64, 64);
        for (const [x, y] of [[10, 10], [36, 10], [10, 36], [36, 36]]) { g.fillStyle = Math.random() < 0.25 ? '#ffe9a8' : '#bfe3f5'; g.fillRect(x, y, 18, 18); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y + 15, 18, 3); }
      });
      const palette = ['#f6c6a0', '#f4e1a6', '#bfe0d0', '#f3b7b5', '#c9d4f2', '#fff1dc', '#d9c7ef', '#a9dcd6'];
      const roofs = [0xe06b4f, 0x4f86c6, 0x5aa36b, 0xd9a03b, 0x8a6fc8, 0xe0807a];
      let seed = 7;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const house = (x, z, w, d, h, ry) => {
        const tex = winTex(palette[Math.floor(rnd() * palette.length)]);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, Math.round(w / 0.9)), Math.max(1, Math.round(h / 0.9)));
        const body = this.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })));
        body.position.set(x, -0.6 + h / 2, z); body.rotation.y = ry;
        if (rnd() < 0.55) {
          const roof = this.add(new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 0.9, 4), this.mat(roofs[Math.floor(rnd() * roofs.length)], 0.6)));
          roof.position.set(x, -0.6 + h + 0.45, z); roof.rotation.y = ry + Math.PI / 4; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
        } else {
          const cap = this.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.14, d + 0.12), this.mat(0xf2f2ee, 0.7)));
          cap.position.set(x, -0.6 + h + 0.07, z); cap.rotation.y = ry;
        }
      };
      const tree = (x, z, s = 1) => {
        const t = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.11 * s, 0.7 * s, 8), this.mat(0x8a5a32, 0.8)));
        t.position.set(x, -0.6 + 0.35 * s, z);
        const col = [0x4caf50, 0x5cbf5a, 0x3e9e4a][Math.floor(rnd() * 3)];
        const f = this.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 * s, 1), this.mat(col, 0.8, { flatShading: true })));
        f.position.set(x, -0.6 + 0.95 * s, z);
        const f2 = this.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.34 * s, 1), this.mat(col, 0.8, { flatShading: true })));
        f2.position.set(x + 0.18 * s, -0.6 + 1.3 * s, z - 0.1 * s);
      };
      const ring = RW + 0.4;
      // phía xa (−z): dãy nhà cao
      for (let x = -ring - 2; x <= ring + 2; ) {
        const w = 1.4 + rnd() * 1.4, h = 2 + rnd() * 3.2;
        if (rnd() < 0.18) { tree(x + 0.6, -ring - 0.9, 1.2); x += 1.4; continue; }
        house(x + w / 2, -ring - 1.1 - rnd() * 0.6, w, 1.6 + rnd() * 0.8, h, 0); x += w + 0.25;
      }
      // hai bên: nhà vừa xen cây
      for (const sx of [-1, 1]) {
        for (let z = -ring; z <= ring - 3; ) {
          const d = 1.3 + rnd() * 1.2, h = 1.2 + rnd() * 2.2;
          if (rnd() < 0.3) { tree(sx * (ring + 0.8), z + 0.6, 1.1); z += 1.5; continue; }
          house(sx * (ring + 1 + rnd() * 0.4), z + d / 2, 1.5 + rnd() * 0.6, d, h, 0); z += d + 0.3;
        }
      }
      // phía gần (+z): chỉ cây thấp, bụi hoa
      for (let x = -ring; x <= ring; x += 2.1 + rnd()) tree(x, ring + 0.7, 0.7 + rnd() * 0.25);
      // vài đám mây bồng bềnh xa xa
      const cloudM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
      for (const [x, y, z, s] of [[-14, 9, -26, 1.6], [6, 11, -30, 2], [20, 8, -22, 1.3], [-26, 10, -12, 1.4]]) {
        const g = new THREE.Group();
        for (const [a, b, r] of [[0, 0, 1], [1.1, 0.2, 0.8], [-1.1, 0.1, 0.75], [0.4, 0.6, 0.7]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), cloudM); m.position.set(a, b, 0); g.add(m); }
        g.position.set(x, y, z); g.scale.setScalar(s); sc.add(g);
      }
    }

    /* ----- bàn cờ ----- */
    buildBoard() {
      // đế bàn xanh lá + viền vàng nhạt
      const slab = this.add(new THREE.Mesh(K.roundBox(S + 1.1, 0.6, S + 1.1, 0.45, 0.06), this.mat(0x2e9e62, 0.55)));
      slab.position.y = -0.6;
      const rim = this.add(new THREE.Mesh(K.roundBox(S + 0.5, 0.03, S + 0.5, 0.25, 0.01), this.mat(0xf6efd8, 0.8)), false, true);
      rim.position.y = -0.01;
      // lòng bàn
      this.centerCanvas = document.createElement('canvas'); this.centerCanvas.width = this.centerCanvas.height = 1024;
      this.centerTex = new THREE.CanvasTexture(this.centerCanvas); this.centerTex.colorSpace = THREE.SRGBColorSpace; this.centerTex.anisotropy = 8;
      const ci = new THREE.Mesh(new THREE.PlaneGeometry(2 * IN - 0.06, 2 * IN - 0.06), new THREE.MeshStandardMaterial({ map: this.centerTex, roughness: 0.85 }));
      ci.rotation.x = -Math.PI / 2; ci.position.y = 0.022; this.add(ci, false, true);
      // ô: khối nổi, mặt trên là texture vẽ canvas
      this.sideMat = this.mat(0xfbf7ea, 0.7);
      this.tiles = RECTS.map((r) => {
        const horiz = r.side === 1 || r.side === 3;                     // cột trái/phải: ô nằm ngang → chữ viết ngang cho dễ đọc
        const cw = r.corner ? 400 : horiz ? 400 : 224, ch = r.corner ? 400 : horiz ? 224 : 400;
        const c = document.createElement('canvas'); c.width = cw; c.height = ch;
        const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
        const m = this.add(new THREE.Mesh(new THREE.BoxGeometry(r.w - GAP, TH, r.d - GAP), [this.sideMat, this.sideMat, top, this.sideMat, this.sideMat, this.sideMat]), true, true);
        m.position.set(r.cx, PLATE + TH / 2, r.cz);
        return { r, c, tex, mesh: m };
      });
      this.paintAll();
      // chồng thẻ Cơ hội / Khí vận giữa bàn
      this.decks = ['chance', 'chest'].map((deck, k) => {
        const g = new THREE.Group();
        const col = deck === 'chance' ? 0xf39c3d : 0x3f8fe0;
        for (let n = 0; n < 5; n++) {
          const card = new THREE.Mesh(K.roundBox(1.7, 0.035, 1.1, 0.1, 0.008), this.mat(n === 4 ? 0xffffff : col, 0.6));
          card.position.set((n % 2) * 0.015, n * 0.038, -(n % 3) * 0.01); card.castShadow = true; card.receiveShadow = true; g.add(card);
        }
        const c = document.createElement('canvas'); c.width = 340; c.height = 220;
        const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        const face = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.03), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
        face.rotation.x = -Math.PI / 2; face.position.y = 5 * 0.038 + 0.002; g.add(face);
        g.position.set(k ? 2.05 : -2.05, PLATE, k ? 1.85 : -1.75); g.rotation.y = k ? -0.42 : -0.42;
        this.scene.add(g);
        return { deck, c, tex, g };
      });
      this.paintDecks();
      // nhóm đồ trên ô: tấm màu chủ, nhà, khách sạn, lớp thế chấp, khung sáng
      this.houseGeo = (() => {
        const body = new THREE.BoxGeometry(0.15, 0.13, 0.15); body.translate(0, 0.065, 0);
        const roof = new THREE.ConeGeometry(0.14, 0.11, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 0.13 + 0.055, 0);
        return { body, roof };
      })();
      this.houseM = this.mat(0x22b04f, 0.45); this.roofM = this.mat(0x147a34, 0.5);
      this.hotelM = this.mat(0xe0352f, 0.45); this.hotelRoofM = this.mat(0x9c1f1a, 0.5);
      this.ownGeo = { h: new THREE.BoxGeometry(TW - GAP - 0.08, 0.03, OWN), v: new THREE.BoxGeometry(OWN, 0.03, TW - GAP - 0.08) };
      this.ownMats = {};
      this.items = RECTS.map(() => ({ houses: [], hotel: null, plate: null, mort: null }));
      const frame = K.canvasTex(256, 256, (g, w) => {
        g.clearRect(0, 0, w, w); g.strokeStyle = '#fff'; g.lineWidth = 26; rr(g, 15, 15, w - 30, w - 30, 26); g.stroke();
      });
      this.frames = [0, 1].map(() => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: frame, transparent: true, depthWrite: false, color: 0xffe14d }));
        m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3; this.scene.add(m); return m;
      });
      const glow = K.canvasTex(128, 128, (g, w) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); });
      this.tints = [0, 1].map(() => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0.2, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; this.scene.add(m); return m;
      });
    }
    /** vẽ (lại) mặt trên mọi ô + lòng bàn — gọi lại khi tranh / font nạp xong */
    paintAll() {
      this.tiles.forEach((t) => { this.paintTile(t); t.tex.needsUpdate = true; });
      this.paintCenter(); this.centerTex.needsUpdate = true;
      // ảnh nạp thẳng từ file:// làm canvas "bẩn" → WebGL từ chối; khi đó vẽ lại không dùng tranh (emoji)
      if (!this.noImg && [this.centerCanvas].concat(this.tiles.map((t) => t.c)).some((c) => { try { c.getContext('2d').getImageData(0, 0, 1, 1); return false; } catch (e) { return true; } })) {
        this.noImg = true; this.paintAll();
      }
    }
    artOf(d) { return this.noImg ? null : this.cfg.art(d); }
    refreshArt() {
      if (this.artDone) return;
      const ok = (!document.fonts || document.fonts.status === 'loaded') && this.cfg.ready();
      if (!ok) { this.artTry = (this.artTry || 0) + 1; if (this.artTry % 30) return; }
      this.paintAll(); this.paintDecks();
      if (ok) this.artDone = true;
    }
    paintTile(T) {
      const d = this.cfg.tiles[T.i !== undefined ? T.i : T.r.i], r = T.r, g = T.c.getContext('2d'), w = T.c.width, h = T.c.height;
      const city = d.t === 'city', im = this.artOf(d);
      g.clearRect(0, 0, w, h);
      g.fillStyle = d.t === 'go' ? '#fff1bf' : d.t === 'jail' ? '#ffe2d8' : d.t === 'park' ? '#dcf1ff' : d.t === 'gojail' ? '#ffd5d5' : '#fdfaf0';
      g.fillRect(0, 0, w, h);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const ink = '#22302a', gold = '#7a5512';
      if (r.corner) {
        g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.12)'; g.strokeRect(4, 4, w - 8, h - 8);
        if (im) g.drawImage(im, w / 2 - 105, 58, 210, 210);
        else { g.font = `170px ${EMO}`; g.fillStyle = '#000'; g.fillText(d.icon, w / 2, 165); }
        fit(g, d.name.toUpperCase(), w / 2, 312, w - 30, 58, 34, 800, ink);
        if (d.t === 'go') fit(g, 'nhận $200', w / 2, 362, w - 30, 40, 26, 800, '#b0451f');
        if (d.t === 'jail') fit(g, 'chỉ ghé thăm', w / 2, 362, w - 30, 34, 24, 700, '#7a4a3a');
        if (d.t === 'park') fit(g, 'nghỉ chân miễn phí', w / 2, 362, w - 30, 32, 22, 700, '#2b5c7a');
        if (d.t === 'gojail') fit(g, 'đi thẳng vào tù', w / 2, 362, w - 30, 34, 22, 700, '#a02a2a');
        return;
      }
      const sub = d.price ? '$' + d.price : d.amt ? 'trả $' + d.amt : '';
      const nm = d.short || d.name;
      const bandPx = city ? Math.round(BAND / (r.side === 1 || r.side === 3 ? r.w : r.d) * (r.side === 1 || r.side === 3 ? w : h)) : 0;
      const ownPx = Math.round(OWN / (r.side === 1 || r.side === 3 ? r.w : r.d) * (r.side === 1 || r.side === 3 ? w : h)) + 6;
      // vùng nội dung (bỏ dải màu nhóm ở cạnh trong và tấm màu chủ ở cạnh ngoài)
      let ax = 0, ay = 0, aw = w, ah = h;
      const col = city ? this.cfg.groups[d.g].color : null;
      if (r.side === 0) { if (city) { g.fillStyle = col; g.fillRect(0, 0, w, bandPx); } ay = bandPx; ah = h - bandPx - ownPx; }
      else if (r.side === 2) { if (city) { g.fillStyle = col; g.fillRect(0, h - bandPx, w, bandPx); } ay = ownPx; ah = h - bandPx - ownPx; }
      else if (r.side === 1) { if (city) { g.fillStyle = col; g.fillRect(w - bandPx, 0, bandPx, h); } ax = ownPx; aw = w - bandPx - ownPx; }
      else { if (city) { g.fillStyle = col; g.fillRect(0, 0, bandPx, h); } ax = bandPx; aw = w - bandPx - ownPx; }
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.1)'; g.strokeRect(3, 3, w - 6, h - 6);
      const cx = ax + aw / 2;
      if (r.side === 0 || r.side === 2) {
        // ô dọc (hàng trên/dưới): tranh · tên 2 dòng · giá
        const ph = 118;
        if (city && im) { crop(g, im, ax + 10, ay + 10, aw - 20, ph, 0.5); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.2)'; g.strokeRect(ax + 10, ay + 10, aw - 20, ph); }
        else if (im) g.drawImage(im, cx - 56, ay + 14, 112, 112);
        else { g.font = `92px ${EMO}`; g.fillStyle = '#000'; g.fillText(d.icon, cx, ay + 72); }
        g.font = `800 40px ${FONT}`;
        const lines = wrap2(g, nm, aw - 16);
        const ny = ay + ph + 20 + (ah - ph - 20 - 52) / 2;
        lines.forEach((l, k) => fit(g, l, cx, ny + (k - (lines.length - 1) / 2) * 42, aw - 14, 40, 22, 800, ink));
        if (sub) fit(g, sub, cx, ay + ah - 28, aw - 14, 42, 26, 800, gold);
      } else {
        // ô ngang (cột trái/phải): tranh trên · tên 1 dòng · giá
        const ph = 86;
        if (city && im) { crop(g, im, ax + 10, ay + 10, aw - 20, ph, 0.55); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.2)'; g.strokeRect(ax + 10, ay + 10, aw - 20, ph); }
        else if (im) g.drawImage(im, cx - 42, ay + 10, 84, 84);
        else { g.font = `70px ${EMO}`; g.fillStyle = '#000'; g.fillText(d.icon, cx, ay + 54); }
        fit(g, nm, cx, ay + ph + 42, aw - 16, 44, 24, 800, ink);
        if (sub) fit(g, sub, cx, ay + ah - 30, aw - 16, 40, 24, 800, gold);
      }
    }
    paintCenter() {
      const c = this.centerCanvas, g = c.getContext('2d'), w = c.width;
      const gr = g.createRadialGradient(w / 2, w / 2, 60, w / 2, w / 2, w * 0.72);
      gr.addColorStop(0, '#f3fbf6'); gr.addColorStop(1, '#cfeadd');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
      // viền đôi
      g.strokeStyle = '#d9483b'; g.lineWidth = 6; g.strokeRect(34, 34, w - 68, w - 68);
      g.strokeStyle = 'rgba(217,72,59,0.35)'; g.lineWidth = 3; g.strokeRect(50, 50, w - 100, w - 100);
      const globe = this.noImg ? null : this.cfg.globe();
      if (globe) { g.save(); g.globalAlpha = 0.5; g.drawImage(globe, w / 2 - 250, w / 2 - 200, 500, 500); g.restore(); }
      // tên game (chữ tự đặt, không logo thương hiệu nào), đọc từ phía người xem
      g.save(); g.translate(w / 2, w / 2 - 40); g.rotate(-0.12);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `800 132px ${FONT}`; g.lineWidth = 22; g.strokeStyle = '#fff'; g.strokeText('TRÒN TỶ PHÚ', 0, 0);
      g.fillStyle = '#d8342b'; g.fillText('TRÒN TỶ PHÚ', 0, 0);
      g.font = `800 52px ${FONT}`; g.lineWidth = 12; g.strokeText('vòng quanh thế giới', 0, 104);
      g.fillStyle = '#25604c'; g.fillText('vòng quanh thế giới', 0, 104);
      g.restore();
      // khung nét đứt chỗ đặt chồng thẻ
      g.save(); g.setLineDash([22, 14]); g.lineWidth = 7;
      for (const [x, y, col] of [[w / 2 + (-2.05 / (2 * IN)) * w, w / 2 + (-1.75 / (2 * IN)) * w, '#e67e22'], [w / 2 + (2.05 / (2 * IN)) * w, w / 2 + (1.85 / (2 * IN)) * w, '#2e86de']]) {
        g.save(); g.translate(x, y); g.rotate(0.42); g.strokeStyle = col; g.strokeRect(-128, -88, 256, 176); g.restore();
      }
      g.restore();
    }
    paintDecks() {
      for (const D of this.decks) {
        const g = D.c.getContext('2d'), w = D.c.width, h = D.c.height, ch = D.deck === 'chance';
        g.fillStyle = ch ? '#fff2d6' : '#e2f0ff'; g.fillRect(0, 0, w, h);
        g.lineWidth = 12; g.strokeStyle = ch ? '#e67e22' : '#2e86de'; g.strokeRect(10, 10, w - 20, h - 20);
        const im = this.noImg ? null : this.cfg.deckArt(D.deck);
        if (im) g.drawImage(im, w / 2 - 50, 26, 100, 100);
        else { g.font = `80px ${EMO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(ch ? '❓' : '🎁', w / 2, 76); }
        g.textAlign = 'center'; g.textBaseline = 'middle';
        fit(g, ch ? 'CƠ HỘI' : 'KHÍ VẬN', w / 2, 168, w - 40, 54, 30, 800, ch ? '#c0581c' : '#1f5fa8');
        D.tex.needsUpdate = true;
      }
    }

    /* ----- quân (nhân vật Tròn 3D), vòng lượt, xúc xắc ----- */
    buildPieces() {
      const body = new THREE.SphereGeometry(0.25, 28, 20); body.scale(1, 0.92, 1); body.translate(0, 0.27, 0);
      const base = new THREE.CylinderGeometry(0.25, 0.28, 0.05, 28); base.translate(0, 0.025, 0);
      const eyeW = new THREE.SphereGeometry(0.068, 14, 10), eyeB = new THREE.SphereGeometry(0.036, 10, 8), shine = new THREE.SphereGeometry(0.014, 6, 4);
      const whiteM = this.mat(0xffffff, 0.3), blackM = this.mat(0x1b1b24, 0.3), shineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const crownM = this.mat(0xf5c542, 0.25, { metalness: 0.7 });
      this.tokens = [0, 1, 2, 3].map(() => {
        const g = new THREE.Group(), inner = new THREE.Group();
        const bm = this.mat(0xffffff, 0.35), dm = this.mat(0x888888, 0.5);
        const b = new THREE.Mesh(body, bm); b.castShadow = true; inner.add(b);
        const bs = new THREE.Mesh(base, dm); bs.castShadow = true; bs.receiveShadow = true; inner.add(bs);
        for (const sx of [-1, 1]) {
          const e = new THREE.Mesh(eyeW, whiteM); e.position.set(sx * 0.085, 0.32, 0.19); e.scale.set(1, 1.2, 0.7); inner.add(e);
          const p = new THREE.Mesh(eyeB, blackM); p.position.set(sx * 0.085, 0.315, 0.235); inner.add(p);
          const s = new THREE.Mesh(shine, shineM); s.position.set(sx * 0.085 + 0.012, 0.335, 0.262); inner.add(s);
        }
        // vương miện (người thắng)
        const cr = new THREE.Group();
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 18, 1, true), crownM); cr.add(band);
        for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), crownM); const a = k / 5 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.12, 0.07, Math.sin(a) * 0.12); cr.add(sp); }
        cr.position.y = 0.53; cr.visible = false; inner.add(cr);
        g.add(inner); g.visible = false; this.scene.add(g);
        return { g, inner, bm, dm, crown: cr };
      });
      const ringG = new THREE.RingGeometry(0.3, 0.4, 40);
      this.turnRing = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9, depthWrite: false }));
      this.turnRing.rotation.x = -Math.PI / 2; this.turnRing.visible = false; this.turnRing.renderOrder = 4; this.scene.add(this.turnRing);
      const arrow = new THREE.ConeGeometry(0.13, 0.26, 18); arrow.rotateX(Math.PI);
      this.turnArrow = new THREE.Mesh(arrow, new THREE.MeshStandardMaterial({ color: 0xffe14d, roughness: 0.4, emissive: 0x332200 }));
      this.turnArrow.castShadow = true; this.turnArrow.visible = false; this.scene.add(this.turnArrow);
      const geo = new THREE.BoxGeometry(0.56, 0.56, 0.56);
      this.dice = [0, 1].map(() => { const d = new THREE.Mesh(geo, K.diceMats()); d.castShadow = true; d.visible = false; this.scene.add(d); return d; });
    }
    setPlayers(colors) {
      this.tokens.forEach((t, k) => {
        if (k >= colors.length) { t.g.visible = false; return; }
        t.bm.color.set(colors[k].main); t.dm.color.set(colors[k].dark);
      });
      this.colors = colors;
    }
    /** đồng bộ chủ ô / nhà / thế chấp (chỉ cập nhật ô đổi) */
    sync(own, lvl, mort) {
      for (let t = 0; t < 40; t++) {
        if (own[t] === this.lastOwn[t] && lvl[t] === this.lastLvl[t] && mort[t] === this.lastMort[t]) continue;
        this.lastOwn[t] = own[t]; this.lastLvl[t] = lvl[t]; this.lastMort[t] = mort[t];
        const r = RECTS[t], it = this.items[t];
        // tấm màu chủ ở mép ngoài
        if (own[t] >= 0) {
          if (!it.plate) {
            const g = r.side === 0 || r.side === 2 ? this.ownGeo.h : this.ownGeo.v;
            it.plate = this.add(new THREE.Mesh(g, this.mat(0xffffff, 0.4)), false, true);
            const off = r.corner ? 0 : (r.side === 0 || r.side === 2 ? r.d : r.w) / 2 - OWN / 2 - 0.05;
            it.plate.position.set(r.cx - r.ix * off, TOP + 0.015, r.cz - r.iz * off);
          }
          it.plate.visible = true;
          it.plate.material.color.set(this.colors && this.colors[own[t]] ? this.colors[own[t]].main : '#999');
        } else if (it.plate) it.plate.visible = false;
        // nhà / khách sạn trên dải màu nhóm
        const L = lvl[t] || 0, depth = r.side === 0 || r.side === 2 ? r.d : r.w;
        const bx = r.cx + r.ix * (depth / 2 - BAND / 2), bz = r.cz + r.iz * (depth / 2 - BAND / 2);
        while (it.houses.length < Math.min(4, L === 5 ? 0 : L)) {
          const g = new THREE.Group();
          const b = new THREE.Mesh(this.houseGeo.body, this.houseM); b.castShadow = true; g.add(b);
          const rf = new THREE.Mesh(this.houseGeo.roof, this.roofM); rf.castShadow = true; g.add(rf);
          this.scene.add(g); it.houses.push(g);
        }
        const n = L === 5 ? 0 : L;
        it.houses.forEach((h, k) => {
          h.visible = k < n;
          if (k >= n) return;
          const off = (k - (n - 1) / 2) * 0.215;
          h.position.set(bx + (r.iz !== 0 ? off : 0), TOP, bz + (r.ix !== 0 ? off : 0));
          h.rotation.y = r.side * Math.PI / 2;
        });
        if (L === 5 && !it.hotel) {
          const g = new THREE.Group();
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.22), this.hotelM); b.position.y = 0.13; b.castShadow = true; g.add(b);
          const rf = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.26), this.hotelRoofM); rf.position.y = 0.285; rf.castShadow = true; g.add(rf);
          const sign = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.03), this.mat(0xffe14d, 0.4)); sign.position.set(0, 0.36, 0); g.add(sign);
          this.scene.add(g); it.hotel = g;
        }
        if (it.hotel) { it.hotel.visible = L === 5; it.hotel.position.set(bx, TOP, bz); it.hotel.rotation.y = r.side * Math.PI / 2; }
        // lớp thế chấp (xám mờ + chữ)
        if (mort[t] && !it.mort) {
          const tx = K.canvasTex(256, 256, (g) => {
            g.fillStyle = 'rgba(40,44,52,0.62)'; g.fillRect(0, 0, 256, 256);
            g.save(); g.translate(128, 128); g.rotate(-0.6); g.textAlign = 'center'; g.textBaseline = 'middle';
            g.font = `800 46px ${FONT}`; g.fillStyle = '#fff'; g.fillText('THẾ CHẤP', 0, 0); g.restore();
          });
          it.mort = new THREE.Mesh(new THREE.PlaneGeometry(r.w - GAP, r.d - GAP), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
          it.mort.rotation.x = -Math.PI / 2; it.mort.position.set(r.cx, TOP + 0.004, r.cz); it.mort.renderOrder = 1; this.scene.add(it.mort);
        }
        if (it.mort) it.mort.visible = !!mort[t];
      }
    }

    /* ----- API vị trí ----- */
    rect(t) { return RECTS[t]; }
    tileCenter(t) { const r = RECTS[t]; return { x: r.cx, y: TOP, z: r.cz }; }
    /** chỗ đứng quân thứ k (0..3) trên ô t: lưới 2×2 ở phần ô ngoài dải màu */
    tokenSpot(t, k) {
      const r = RECTS[t];
      if (r.corner) {
        const a = [[-0.36, -0.3], [0.36, -0.3], [-0.36, 0.36], [0.36, 0.36]][k];
        return { x: r.cx + a[0], y: TOP, z: r.cz + a[1] };
      }
      // trục dọc ô = hướng vào giữa (ix, iz): hàng trong / hàng ngoài của phần ô ngoài dải nhà · trục ngang = vuông góc
      const along = [-0.22, 0.22, -0.22, 0.22][k], u = [0.08, 0.08, -0.46, -0.46][k];
      const dx = r.ix * u + (r.iz !== 0 ? along : 0), dz = r.iz * u + (r.ix !== 0 ? along : 0);
      return { x: r.cx + dx, y: TOP, z: r.cz + dz };
    }
    placeToken(i, o) {
      const T = this.tokens[i];
      if (!T) return;
      T.g.visible = !o.hide;
      if (o.hide) return;
      T.g.position.set(o.x, o.y, o.z);
      // quay mặt về phía camera
      T.g.rotation.y = Math.atan2(this.cam.position.x - o.x, this.cam.position.z - o.z);
      const sq = o.sq || 0;
      T.inner.scale.set(1 + sq, 1 - sq, 1 + sq);
      T.crown.visible = !!o.crown;
      T.g.scale.setScalar(o.big ? 1.12 : 1);
    }
    setTurn(o) {
      if (!o) { this.turnRing.visible = this.turnArrow.visible = false; return; }
      this.turnRing.visible = this.turnArrow.visible = true;
      this.turnRing.position.set(o.x, TOP + 0.006, o.z);
      this.turnRing.material.color.set(o.color); this.turnRing.material.opacity = 0.55 + 0.4 * o.pulse;
      this.turnRing.scale.setScalar(1 + 0.15 * o.pulse);
      this.turnArrow.position.set(o.x, o.y + 0.95 + o.bob * 0.18, o.z);
      this.turnArrow.material.color.set(o.color);
      this.turnArrow.rotation.y += 0.04;
    }
    /** khung sáng k (0 = ô quân sắp dừng, 1 = ô đang chọn) */
    setHighlight(k, t, color, alpha) {
      const f = this.frames[k], tn = this.tints[k];
      if (t < 0) { f.visible = tn.visible = false; return; }
      const r = RECTS[t];
      for (const m of [f, tn]) { m.visible = true; m.position.set(r.cx, TOP + 0.008 + k * 0.002, r.cz); m.scale.set(r.w - GAP + 0.04, r.d - GAP + 0.04, 1); }
      f.material.color.set(color); f.material.opacity = alpha;
      tn.material.color.set(color); tn.material.opacity = alpha * 0.28;
    }
    placeDie(k, o) {
      const d = this.dice[k];
      d.visible = !!o && !o.hide;
      if (!d.visible) return;
      d.position.set(o.x, o.y, o.z);
      if (o.q) d.quaternion.copy(o.q);
    }
    /** toạ độ màn hình của chồng thẻ (thẻ bốc ra bay lên từ đây) */
    deckScreen(deck) {
      const D = this.decks.find((d) => d.deck === deck);
      if (!D) return null;
      const p = D.g.position;
      return this.project(p.x, p.y + 0.25, p.z);
    }
    get diceY() { return PLATE + 0.28; }

    project(x, y, z) { return K.project(this.cam, x, y, z); }
    /** ô dưới con trỏ (−1 nếu không trúng ô nào) */
    pickTile(px, py) {
      const p = K.planeAt(this.cam, px, py, TOP);
      return p ? tileAtXZ(p.x, p.z) : -1;
    }
    render(lowQ) {
      this.refreshArt();
      if (this.goal) {
        const v = this.view, g = this.goal;
        let done = true;
        for (const k of ['yaw', 'pitch', 'dist', 'tx', 'tz']) { v[k] += (g[k] - v[k]) * 0.14; if (Math.abs(g[k] - v[k]) > 0.002) done = false; }
        if (done) { Object.assign(v, g); this.goal = null; }
        this.applyView();
      }
      const RR = K.begin(lowQ);
      RR.owner = this;
      this.sun.castShadow = !lowQ;
      RR.r.render(this.scene, this.cam);
    }
  }

  let SHARED = null;
  function shared(cfg) {
    if (!SHARED) SHARED = new MonoScene(cfg);
    return SHARED;
  }
  window.Mono3D = { available: () => K.webglOK(), shared, TOP };
})();

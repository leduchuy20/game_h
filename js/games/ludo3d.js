// Cờ Cá Ngựa — cảnh 3D (Three.js r159 đặt sẵn trong js/lib) → window.Ludo3D
// Mọi mô hình dựng bằng code. Cảnh chỉ "vẽ": game (ludo.js) quyết định vị trí từng quân / xúc xắc mỗi khung.
(() => {
  'use strict';
  if (typeof window === 'undefined' || !window.Kit3D) return;
  const R = window.LudoRules;

  // màu bàn: đỏ · xanh dương · xanh lá · vàng (pastel nền sân + đậm cho quân)
  const HUE = [
    { main: 0xe8433b, dark: 0xa8241e, soft: 0xfbd4cf, css: '#e8433b', cssDark: '#a8241e', name: 'Đỏ' },
    { main: 0x2f7fe0, dark: 0x1b4f9a, soft: 0xcfe2fb, css: '#2f7fe0', cssDark: '#1b4f9a', name: 'Xanh dương' },
    { main: 0x2fae55, dark: 0x1d7336, soft: 0xd2f0da, css: '#2fae55', cssDark: '#1d7336', name: 'Xanh lá' },
    { main: 0xf3b51b, dark: 0xa87808, soft: 0xfcecc2, css: '#f3b51b', cssDark: '#a87808', name: 'Vàng' },
  ];
  const W2 = 1280, H2 = 720;
  const TOP = 0.0;              // mặt bàn
  const TILE_H = 0.14;          // ô nổi lên khỏi mặt bàn
  const STEP_H = 0.06;          // mỗi bậc chuồng đích cao thêm

  const toXZ = (r, c) => ({ x: c - 7, z: r - 7 });

  // renderer, texture canvas, khối bo góc, xúc xắc: dùng chung trong kit3d.js
  const K = window.Kit3D;
  const { webglOK, canvasTex, roundBox, diceTex, DICE_FACES, diceQuat } = K;
  const getRenderer = K.renderer;
  const FONT = K.FONT;

  /* ---------- hình khối ---------- */
  /** đầu ngựa (bóng 2D đùn khối) + đế tròn tiện */
  function horseGeometry() {
    // bóng đầu ngựa nhìn ngang, mặt hướng +x; đơn vị ~ chiều cao 1
    const s = new THREE.Shape();
    s.moveTo(-0.27, 0);
    s.lineTo(0.27, 0);
    s.quadraticCurveTo(0.27, 0.14, 0.17, 0.24);          // ngực
    s.quadraticCurveTo(0.22, 0.4, 0.42, 0.5);            // cổ trước → mõm
    s.quadraticCurveTo(0.54, 0.56, 0.48, 0.66);          // mũi
    s.quadraticCurveTo(0.4, 0.74, 0.26, 0.76);           // sống mũi
    s.quadraticCurveTo(0.2, 0.86, 0.14, 0.9);            // trán
    s.lineTo(0.12, 1.04);                                // tai
    s.lineTo(0.02, 0.92);
    s.quadraticCurveTo(-0.14, 0.92, -0.24, 0.78);        // gáy
    s.quadraticCurveTo(-0.34, 0.56, -0.3, 0.34);         // bờm
    s.quadraticCurveTo(-0.26, 0.16, -0.27, 0);
    const head = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 5, curveSegments: 10 });
    head.translate(0, 0, -0.11);
    head.translate(0, 0.16, 0);
    // đế tiện tròn
    const prof = [[0, 0], [0.36, 0], [0.38, 0.05], [0.34, 0.09], [0.26, 0.12], [0.24, 0.17], [0, 0.17]].map(([x, y]) => new THREE.Vector2(x, y));
    const base = new THREE.LatheGeometry(prof, 28);
    return { head, base };
  }

  /* ---------- cảnh ---------- */
  class Scene3D {
    constructor(opts = {}) {
      this.R = getRenderer();
      this.quality = opts.quality || 'high';
      const scene = this.scene = new THREE.Scene();
      scene.background = canvasTex(4, 256, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#9fd8f2'); gr.addColorStop(0.55, '#d9f1f7'); gr.addColorStop(1, '#bfe6c6');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
      this.cam = new THREE.PerspectiveCamera(36, W2 / H2, 0.5, 120);
      this.view = { yaw: 0, pitch: 0.98, dist: 27.5, tx: 0, tz: 0.4 };
      this.applyView();
      // ánh sáng
      scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb6a8, 1.25));
      const sun = this.sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
      sun.position.set(-7, 16, 9);
      sun.castShadow = this.quality === 'high';
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 40;
      sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
      scene.add(sun);
      scene.add(new THREE.AmbientLight(0xffffff, 0.25));
      this.buildBoard();
      this.buildPieces([0, 1, 2, 3]);
      this.buildDice();
      this.ray = new THREE.Raycaster();
      this.ghosts = [];
    }
    mat(color, rough = 0.6, extra = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra)); }
    add(mesh, cast = true, recv = true) { mesh.castShadow = cast; mesh.receiveShadow = recv; this.scene.add(mesh); return mesh; }

    resetView() { this.view = { yaw: 0, pitch: 0.98, dist: 26.5, tx: 0, tz: 0.35 }; this.applyView(); }
    applyView() {
      const v = this.view, c = this.cam;
      const y = Math.sin(v.pitch) * v.dist, h = Math.cos(v.pitch) * v.dist;
      c.position.set(v.tx + Math.sin(v.yaw) * h, y, v.tz + Math.cos(v.yaw) * h);
      c.lookAt(v.tx, 0, v.tz);
      c.updateMatrixWorld();
    }

    buildBoard() {
      const g = new THREE.Group();
      // đế gỗ + mặt kem
      const wood = this.add(new THREE.Mesh(roundBox(16.6, 0.5, 16.6, 0.7, 0.08), this.mat(0xc98a4b, 0.55)));
      wood.position.y = -0.5;
      const top = this.add(new THREE.Mesh(roundBox(15.4, 0.06, 15.4, 0.45, 0.02), this.mat(0xfbf5e6, 0.8)), false, true);
      top.position.y = -0.04;
      // nền cỏ dưới bàn
      const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), this.mat(0xa9d9a0, 1));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.52;
      this.add(ground, false, true);
      // sân 4 góc
      R.YARD_RC.forEach(([r, c], k) => this.buildYard(k, r, c));
      // ô đường đua
      const tileG = roundBox(0.9, TILE_H, 0.9, 0.16, 0.035);
      const white = this.mat(0xffffff, 0.55);
      R.RING_RC.forEach(([r, c], i) => {
        const { x, z } = toXZ(r, c);
        const startOf = R.START.indexOf(i), gateOf = R.GATE_IDX.indexOf(i);
        const m = this.add(new THREE.Mesh(tileG, startOf >= 0 ? this.mat(HUE[startOf].main, 0.5) : white), false, true);
        m.position.set(x, TOP, z);
        if (startOf >= 0) this.arrowOn(x, z, startOf, i);
        if (gateOf >= 0) this.gateOn(x, z, gateOf);
      });
      // chuồng đích: 6 bậc cao dần, có số
      R.HOME_RC.forEach((cells, k) => cells.forEach(([r, c], j) => {
        const { x, z } = toXZ(r, c), h = TILE_H + (j + 1) * STEP_H;
        const m = this.add(new THREE.Mesh(roundBox(0.9, h, 0.9, 0.16, 0.035), this.mat(HUE[k].main, 0.5)), true, true);
        m.position.set(x, TOP, z);
        const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: this.numTex(j + 1), transparent: true }));
        lab.rotation.x = -Math.PI / 2;
        lab.position.set(x, h + 0.003, z);
        this.scene.add(lab);
      }));
      // ô giữa bàn: bục 4 màu (nơi cúp hiện lên khi có người thắng)
      for (let k = 0; k < 4; k++) {
        const t = new THREE.Shape();
        t.moveTo(0, 0); t.lineTo(-0.45, 0.45); t.lineTo(0.45, 0.45); t.closePath();
        const tri = this.add(new THREE.Mesh(new THREE.ExtrudeGeometry(t, { depth: 0.04, bevelEnabled: false }), this.mat(HUE[k].main, 0.5)), false, true);
        tri.rotation.x = Math.PI / 2;
        tri.rotation.z = [Math.PI / 2, Math.PI, -Math.PI / 2, 0][k];
        tri.position.y = TILE_H + 7 * STEP_H + 0.04;
      }
      const ped = this.add(new THREE.Mesh(roundBox(0.92, TILE_H + 7 * STEP_H, 0.92, 0.14, 0.03), this.mat(0xffffff, 0.5)), false, true);
      ped.position.y = 0;
      // cúp vàng (ẩn tới lúc có người thắng)
      const cup = new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.42, 0.08], [0.14, 0.14], [0.1, 0.4], [0.18, 0.5], [0.42, 0.64], [0.5, 1.05], [0.44, 1.05], [0.36, 0.7], [0, 0.62]].map(([a, b]) => new THREE.Vector2(a, b)), 32);
      this.cup = this.add(new THREE.Mesh(cup, this.mat(0xf5c542, 0.25, { metalness: 0.75 })));
      this.cup.position.y = TILE_H + 7 * STEP_H + 0.04; this.cup.scale.setScalar(0.001); this.cup.visible = false;
      return g;
    }
    numTex(n) {
      return canvasTex(128, 128, (g) => {
        g.fillStyle = '#fff'; g.font = `800 92px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeText(String(n), 64, 70); g.fillText(String(n), 64, 70);
      });
    }
    /** mũi tên trên ô xuất quân (chỉ hướng đi) */
    arrowOn(x, z, k, i) {
      const [r1, c1] = R.RING_RC[(i + 1) % R.RING], { x: x1, z: z1 } = toXZ(r1, c1);
      const s = new THREE.Shape();
      s.moveTo(0.3, 0); s.lineTo(-0.05, 0.26); s.lineTo(-0.05, 0.1); s.lineTo(-0.3, 0.1); s.lineTo(-0.3, -0.1); s.lineTo(-0.05, -0.1); s.lineTo(-0.05, -0.26); s.closePath();
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }), this.mat(0xffffff, 0.4));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(-(z1 - z), x1 - x);
      m.position.set(x, TILE_H + 0.002, z);
      this.add(m, false, true);
    }
    /** cổng màu trên ô cửa (lối vào chuồng đích) */
    gateOn(x, z, k) {
      const [hr, hc] = R.HOME_RC[k][0], { x: hx, z: hz } = toXZ(hr, hc);
      const dx = hx - x, dz = hz - z;                          // hướng vào chuồng
      const g = new THREE.Group();
      const post = new THREE.CylinderGeometry(0.06, 0.07, 0.62, 10), mt = this.mat(HUE[k].main, 0.45);
      for (const s of [-1, 1]) { const p = new THREE.Mesh(post, mt); p.position.set(s * 0.4, 0.31, 0); p.castShadow = true; g.add(p); }
      const bar = new THREE.Mesh(roundBox(0.98, 0.12, 0.14, 0.05, 0.02), mt);
      bar.position.y = 0.6; bar.castShadow = true; g.add(bar);
      g.rotation.y = Math.atan2(dx, dz);
      g.position.set(x + dx * 0.45, TILE_H, z + dz * 0.45);
      this.scene.add(g);
    }
    /** sân góc: nền pastel, hàng rào gỗ, nhà mái chóp, 4 ô chờ */
    buildYard(k, r, c) {
      const { x, z } = toXZ(r, c);
      const pad = this.add(new THREE.Mesh(roundBox(5.7, 0.08, 5.7, 0.6, 0.02), this.mat(HUE[k].soft, 0.85)), false, true);
      pad.position.set(x, -0.02, z);
      // hàng rào 4×4
      const wood = this.mat(0x9a6a3c, 0.75), post = new THREE.CylinderGeometry(0.07, 0.08, 0.5, 8);
      const F = 1.9;
      const posts = new Set();
      for (let a = -F; a <= F + 0.01; a += F / 2) for (const b of [-F, F]) for (const [px, pz] of [[a, b], [b, a]]) posts.add(px.toFixed(2) + ',' + pz.toFixed(2));
      posts.forEach((key) => { const [px, pz] = key.split(',').map(Number); const p = this.add(new THREE.Mesh(post, wood)); p.position.set(x + px, 0.25, z + pz); });
      const long = roundBox(F * 2, 0.07, 0.07, 0.02, 0.01);
      for (const b of [-F, F]) for (const yy of [0.16, 0.36]) {
        const h1 = this.add(new THREE.Mesh(long, wood)); h1.position.set(x, yy, z + b);
        const h2 = this.add(new THREE.Mesh(long, wood)); h2.rotation.y = Math.PI / 2; h2.position.set(x + b, yy, z);
      }
      // nhà nhỏ ở góc ngoài
      const out = [[-1, -1], [-1, 1], [1, 1], [1, -1]][k];
      const hx = x + out[1] * 2.3, hz = z + out[0] * 2.3;
      const body = this.add(new THREE.Mesh(roundBox(0.9, 0.6, 0.9, 0.08, 0.02), this.mat(0xfff7ea, 0.7)));
      body.position.set(hx, 0, hz);
      const roof = this.add(new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.65, 4), this.mat(HUE[k].main, 0.5)));
      roof.rotation.y = Math.PI / 4; roof.position.set(hx, 0.6 + 0.32, hz);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.36), this.mat(0x8a5a32, 0.8));
      door.position.set(hx, 0.2, hz + 0.47); this.scene.add(door);
      // 4 ô chờ trong chuồng
      this.yardSpots = this.yardSpots || [];
      this.yardSpots[k] = [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].map(([a, b]) => {
        const s = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 28), this.mat(0xffffff, 0.7, { transparent: true, opacity: 0.75 })), false, true);
        s.position.set(x + a, 0.02, z + b);
        return { x: x + a, z: z + b };
      });
    }

    buildPieces(colors) {
      const { head, base } = horseGeometry();
      const eyeG = new THREE.SphereGeometry(0.045, 10, 8), eyeM = this.mat(0x1b1b24, 0.3), shineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
      this.horses = colors.map((col) => [0, 1, 2, 3].map(() => {
        const g = new THREE.Group();
        const m = this.mat(HUE[col].main, 0.35, { metalness: 0.05 });
        const b = new THREE.Mesh(base, this.mat(HUE[col].dark, 0.45)); b.castShadow = true; b.receiveShadow = true; g.add(b);
        const h = new THREE.Mesh(head, m); h.castShadow = true; h.receiveShadow = true; g.add(h);
        for (const sz of [-1, 1]) {
          const e = new THREE.Mesh(eyeG, eyeM); e.position.set(0.25, 0.86, sz * 0.175); g.add(e);
          const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), shineM); s2.position.set(0.27, 0.88, sz * 0.21); g.add(s2);
        }
        // bờm sẫm màu chạy dọc gáy
        const mane = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 12, 1.5), this.mat(HUE[col].dark, 0.5));
        mane.position.set(0.0, 0.62, 0); mane.rotation.z = 1.25; mane.castShadow = true; g.add(mane);
        g.scale.setScalar(0.95);
        this.scene.add(g);
        return { g, mat: m };
      }));
      // vòng sáng dưới quân đang tới lượt / được chọn
      const ringG = new THREE.RingGeometry(0.38, 0.5, 40);
      this.rings = [0, 1, 2, 3, 4, 5].map(() => {
        const r = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9, depthWrite: false }));
        r.rotation.x = -Math.PI / 2; r.visible = false; this.scene.add(r); return r;
      });
      // ngựa mờ ở điểm đến
      this.ghostMats = HUE.map((h) => new THREE.MeshStandardMaterial({ color: h.main, transparent: true, opacity: 0.38, depthWrite: false }));
      this.ghostPool = [];
      this.pieceGeo = { head, base };
    }
    /** khay xúc xắc: cảnh riêng, vẽ vào một ô chữ nhật trên màn hình (luôn thấy rõ dù bàn xoay thế nào) */
    buildDice() {
      const ts = this.tScene = new THREE.Scene();
      ts.background = new THREE.Color(0x24604f);
      this.tCam = new THREE.PerspectiveCamera(34, 1.3, 0.1, 40);
      ts.add(new THREE.HemisphereLight(0xffffff, 0x335544, 1.4));
      const l = new THREE.DirectionalLight(0xffffff, 2.2);
      l.position.set(-2, 6, 3); l.castShadow = true; l.shadow.mapSize.set(512, 512);
      const c = l.shadow.camera; c.left = -3; c.right = 3; c.top = 3; c.bottom = -3;
      ts.add(l);
      // nền nỉ xanh có hoa văn chấm nhẹ
      const felt = canvasTex(256, 256, (g, w) => {
        g.fillStyle = '#2f7a64'; g.fillRect(0, 0, w, w);
        for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
      });
      felt.wrapS = felt.wrapT = THREE.RepeatWrapping; felt.repeat.set(3, 2);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), new THREE.MeshStandardMaterial({ map: felt, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; ts.add(floor);
      const mats = DICE_FACES.map((v) => new THREE.MeshStandardMaterial({ map: diceTex(v), roughness: 0.35 }));
      const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
      this.dice = [0, 1].map(() => { const d = new THREE.Mesh(geo, mats); d.castShadow = true; d.visible = false; ts.add(d); return d; });
      this.trayRect = null;
    }
    /** ô vẽ khay trên màn hình (toạ độ 1280×720) */
    setTray(rect) {
      this.trayRect = rect;
      if (!rect) return;
      this.tCam.aspect = rect.w / rect.h; this.tCam.updateProjectionMatrix();
      const span = 3.6;                                   // bề ngang nền nhìn thấy
      const d = span / 2 / Math.tan(THREE.MathUtils.degToRad(this.tCam.fov / 2)) / this.tCam.aspect;
      this.tCam.position.set(0, d * 0.92, d * 0.42); this.tCam.lookAt(0, 0, 0.12);
    }

    /* ----- API cho game ----- */
    cellXZ(r, c) { return toXZ(r, c); }
    /** toạ độ thế giới của ngựa tiến độ p (màu k, con thứ h đứng trong chuồng) */
    spot(k, p, h) {
      if (p < 0) { const s = this.yardSpots[k][h]; return { x: s.x, y: 0.05, z: s.z }; }
      if (p <= R.GATE) { const [r, c] = R.RING_RC[(R.START[k] + p) % R.RING], q = toXZ(r, c); return { x: q.x, y: TILE_H, z: q.z }; }
      const j = p - R.GATE - 1, [r, c] = R.HOME_RC[k][j], q = toXZ(r, c);
      return { x: q.x, y: TILE_H + (j + 1) * STEP_H, z: q.z };
    }
    /** đặt quân: o = {x,y,z, yaw?, sq?, hide?} */
    placeHorse(pl, h, o) {
      const it = this.horses[pl][h], g = it.g;
      g.visible = !o.hide;
      g.position.set(o.x, o.y, o.z);
      g.rotation.set(o.tilt || 0, o.yaw || 0, 0);
      const sq = o.sq || 0;
      g.scale.set(0.95 * (1 + sq), 0.95 * (1 - sq), 0.95 * (1 + sq));
    }
    setRing(k, o) {
      const r = this.rings[k];
      if (!o) { r.visible = false; return; }
      r.visible = true; r.position.set(o.x, o.y + 0.012, o.z);
      r.material.color.set(o.color || 0xffe14d); r.material.opacity = o.alpha ?? 0.9;
      r.scale.setScalar(o.scale || 1);
    }
    /** ngựa mờ ở các điểm đến: list = [{x,y,z,color,yaw,alpha}] */
    setGhosts(list) {
      while (this.ghostPool.length < list.length) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(this.pieceGeo.base, this.ghostMats[0]));
        g.add(new THREE.Mesh(this.pieceGeo.head, this.ghostMats[0]));
        g.scale.setScalar(0.92);
        this.scene.add(g); this.ghostPool.push(g);
      }
      this.ghostPool.forEach((g, k) => {
        const o = list[k];
        g.visible = !!o;
        if (!o) return;
        g.position.set(o.x, o.y + (o.lift || 0), o.z); g.rotation.y = o.yaw || 0;
        const m = this.ghostMats[o.color];
        g.children.forEach((c) => { c.material = m; });
        m.opacity = o.alpha ?? 0.4;
      });
    }
    /** xúc xắc: o = {x,y,z, q: Quaternion, hide} */
    placeDie(k, o) {
      const d = this.dice[k];
      d.visible = !!o && !o.hide;
      if (!d.visible) return;
      d.position.set(o.x, o.y, o.z);
      if (o.q) d.quaternion.copy(o.q);
    }
    diceQuat(v, yaw) { return diceQuat(v, yaw); }
    randomQuat(t) {
      return new THREE.Quaternion().setFromEuler(new THREE.Euler(t * 7.3, t * 5.1, t * 6.7));
    }
    showCup(s) { this.cup.visible = s > 0.01; this.cup.scale.setScalar(Math.max(0.001, s)); this.cup.rotation.y += 0.02; }

    /** chiếu điểm 3D ra toạ độ 1280×720 */
    project(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(this.cam);
      return { x: (v.x + 1) / 2 * W2, y: (1 - v.y) / 2 * H2, front: v.z < 1 };
    }
    /** tia từ toạ độ màn hình → điểm trên mặt bàn (y = TILE_H) */
    groundAt(px, py) {
      this.ray.setFromCamera(new THREE.Vector2(px / W2 * 2 - 1, -(py / H2 * 2 - 1)), this.cam);
      const o = this.ray.ray.origin, d = this.ray.ray.direction;
      if (Math.abs(d.y) < 1e-6) return null;
      const t = (TILE_H - o.y) / d.y;
      return t > 0 ? { x: o.x + d.x * t, z: o.z + d.z * t } : null;
    }

    render(lowQ) {
      const RR = K.begin(lowQ);
      RR.owner = this;
      this.sun.castShadow = !lowQ;
      RR.r.render(this.scene, this.cam);
      const t = this.trayRect;
      if (t) {
        const r = RR.r;
        r.setScissorTest(true);
        r.setScissor(t.x, H2 - t.y - t.h, t.w, t.h);
        r.setViewport(t.x, H2 - t.y - t.h, t.w, t.h);
        r.render(this.tScene, this.tCam);
        r.setScissorTest(false);
        r.setViewport(0, 0, W2, H2);
      }
    }
    /** giải phóng GPU khi game kết thúc */
    dispose() {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      if (this.R.owner === this) this.R.owner = null;
    }
  }

  let SHARED = null;
  /** cảnh dùng chung cho mọi ván (dựng 1 lần, tránh rò bộ nhớ GPU khi app tạo lại instance) */
  function shared() {
    if (!SHARED) SHARED = new Scene3D();
    return SHARED;
  }
  window.Ludo3D = { available: () => !!K && webglOK(), shared, HUE };
})();

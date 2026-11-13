// Kit3D — phần dùng chung cho các game 3D (Three.js r159 đặt sẵn trong js/lib) → window.Kit3D
// Một canvas WebGL #cv3d duy nhất nằm dưới #cv (canvas 2D vẽ giao diện chồng lên, clearRect để nhìn xuyên xuống).
// Nạp TRƯỚC ludo3d.js / monopoly3d.js.
(() => {
  'use strict';
  if (typeof window === 'undefined') return;
  const W2 = 1280, H2 = 720;
  const FONT = '"Baloo 2", "Segoe UI", system-ui, sans-serif';

  function webglOK() {
    if (typeof THREE === 'undefined') return false;
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  /* ---------- renderer dùng chung ---------- */
  let RENDER = null;
  function renderer() {
    if (RENDER) return RENDER;
    const stage = document.getElementById('stage'), cv = document.getElementById('cv');
    const canvas = document.createElement('canvas');
    canvas.id = 'cv3d';
    canvas.style.cssText = 'position:absolute;inset:0;width:1280px;height:720px;display:none;';
    stage.insertBefore(canvas, cv);
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    RENDER = { r, canvas, last: 0, pr: 0, owner: null, maxAniso: r.capabilities.getMaxAnisotropy() };
    // ẩn canvas 3D khi game không còn vẽ (thoát ra menu…)
    const watch = () => {
      if (RENDER.canvas.style.display !== 'none' && performance.now() - RENDER.last > 250) RENDER.canvas.style.display = 'none';
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    return RENDER;
  }
  /** chuẩn bị khung hình: độ phân giải theo tỉ lệ scale của #stage × DPR, hiện canvas */
  function begin(lowQ) {
    const RR = renderer();
    const st = document.getElementById('stage');
    const k = st ? st.getBoundingClientRect().width / W2 : 1;
    const pr = Math.min(2.5, Math.max(0.5, k * (window.devicePixelRatio || 1) * (lowQ ? 0.6 : 1)));
    if (Math.abs(pr - RR.pr) > 0.01) { RR.r.setPixelRatio(pr); RR.r.setSize(W2, H2, false); RR.pr = pr; }
    RR.r.shadowMap.enabled = !lowQ;
    RR.canvas.style.display = 'block';
    RR.last = performance.now();
    return RR;
  }

  /* ---------- texture vẽ bằng canvas 2D ---------- */
  function canvasTex(w, h, paint) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = RENDER ? Math.min(8, RENDER.maxAniso) : 4;
    return t;
  }

  /** khối chữ nhật bo góc (đùn từ hình chữ nhật bo góc 2D), đáy ở y = 0 */
  function roundBox(w, h, d, rad, bevel = 0.03) {
    const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + rad, y); s.lineTo(x + w - rad, y); s.quadraticCurveTo(x + w, y, x + w, y + rad);
    s.lineTo(x + w, y + d - rad); s.quadraticCurveTo(x + w, y + d, x + w - rad, y + d);
    s.lineTo(x + rad, y + d); s.quadraticCurveTo(x, y + d, x, y + d - rad);
    s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, h - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, bevel, 0);
    return g;
  }

  /* ---------- xúc xắc ---------- */
  function diceTex(n) {
    return canvasTex(128, 128, (g, w) => {
      g.fillStyle = '#fffdf7'; g.fillRect(0, 0, w, w);
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, w - 6);
      const pos = { 1: [[2, 2]], 2: [[1, 3], [3, 1]], 3: [[1, 3], [2, 2], [3, 1]], 4: [[1, 1], [1, 3], [3, 1], [3, 3]], 5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]], 6: [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3]] }[n];
      for (const [i, j] of pos) {
        g.beginPath(); g.arc(i * 32, j * 32, n === 1 ? 17 : 12, 0, Math.PI * 2);
        g.fillStyle = n === 1 ? '#d6312b' : '#26213a'; g.fill();
      }
    });
  }
  // thứ tự mặt BoxGeometry: +x, -x, +y, -y, +z, -z → giá trị (mặt đối nhau cộng 7)
  const DICE_FACES = [3, 4, 1, 6, 2, 5];
  const FACE_NORMAL = { 3: [1, 0, 0], 4: [-1, 0, 0], 1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1], 5: [0, 0, -1] };
  /** quaternion đưa mặt v lên trên, xoay quanh trục đứng một góc yaw */
  function diceQuat(v, yaw) {
    const n = new THREE.Vector3(...FACE_NORMAL[v]);
    const q = new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, 1, 0));
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    return qy.multiply(q);
  }
  /** quay lộn tự do theo "thời gian" t (t = 0 → không xoay) */
  function spinQuat(t) { return new THREE.Quaternion().setFromEuler(new THREE.Euler(t * 7.3, t * 5.1, t * 6.7)); }
  /** bộ 6 vật liệu mặt xúc xắc (dùng chung) */
  let DICE_MATS = null;
  function diceMats() {
    if (!DICE_MATS) DICE_MATS = DICE_FACES.map((v) => new THREE.MeshStandardMaterial({ map: diceTex(v), roughness: 0.35 }));
    return DICE_MATS;
  }

  /** chiếu điểm 3D ra toạ độ 1280×720 */
  function project(cam, x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(cam);
    return { x: (v.x + 1) / 2 * W2, y: (1 - v.y) / 2 * H2, front: v.z < 1 };
  }
  /** tia từ toạ độ màn hình → điểm trên mặt phẳng ngang y = h */
  const RAY = { r: null };
  function planeAt(cam, px, py, h) {
    if (!RAY.r) RAY.r = new THREE.Raycaster();
    RAY.r.setFromCamera(new THREE.Vector2(px / W2 * 2 - 1, -(py / H2 * 2 - 1)), cam);
    const o = RAY.r.ray.origin, d = RAY.r.ray.direction;
    if (Math.abs(d.y) < 1e-6) return null;
    const t = (h - o.y) / d.y;
    return t > 0 ? { x: o.x + d.x * t, z: o.z + d.z * t } : null;
  }

  window.Kit3D = { W: W2, H: H2, FONT, webglOK, renderer, begin, canvasTex, roundBox, diceTex, DICE_FACES, diceQuat, spinQuat, diceMats, project, planeAt };
})();

'use strict';
/* Chuyển Đồ Điên Loạn (NEW3, co-op) — cả nhóm khiêng đồ trong nhà ra xe tải bên kia sông trước khi hết giờ.
   Giữ Đánh để nhấc/khiêng (thả nút là đặt xuống). Đồ nhỏ một người khiêng được, chạm Nhảy để quăng.
   Đồ lớn (sofa, tủ lạnh...) cần 2 người cùng giữ Đánh; hai người cùng bấm Nhảy để quăng qua sông. Rơi xuống sông là mất! */
(() => {
  const AY = 84, BOT = H - 16;
  const WT = 16; // độ dày tường
  const HOUSE = { x0: 40, x1: 470, y0: 100, y1: H - 24 };
  const MID_Y = 395;
  const RIVER = { x0: 640, x1: 780 }, BRIDGE = { y0: 112, y1: 186 };
  const TRUCK = { x: 1070, y: 300, w: 170, h: 250 };
  const WALLS = [
    { x: HOUSE.x0, y: HOUSE.y0, w: HOUSE.x1 - HOUSE.x0, h: WT }, // trên
    { x: HOUSE.x0, y: HOUSE.y1 - WT, w: HOUSE.x1 - HOUSE.x0, h: WT }, // dưới
    { x: HOUSE.x0, y: HOUSE.y0, w: WT, h: HOUSE.y1 - HOUSE.y0 }, // trái
    // tường phải có 2 cửa: y 220–310 và y 490–580
    { x: HOUSE.x1 - WT, y: HOUSE.y0, w: WT, h: 120 }, { x: HOUSE.x1 - WT, y: 310, w: WT, h: 180 }, { x: HOUSE.x1 - WT, y: 580, w: WT, h: HOUSE.y1 - 580 },
    // tường ngăn giữa nhà, cửa x 190–280
    { x: HOUSE.x0, y: MID_Y, w: 150, h: WT }, { x: 280, y: MID_Y, w: HOUSE.x1 - 280, h: WT },
    // vách nhỏ trong phòng
    { x: 300, y: 180, w: WT, h: 120 }, { x: 120, y: 520, w: 110, h: WT },
  ];
  const GAME_TIME = 90, THROW = 270, TP = 0.6;
  const SMALL = [{ n: '📦', name: 'thùng' }, { n: '🪑', name: 'ghế' }, { n: '💡', name: 'đèn' }, { n: '🪴', name: 'chậu cây' }, { n: '📺', name: 'tivi' }, { n: '🧸', name: 'gấu bông' }];
  const LARGE = [{ n: '🛋️', name: 'sofa' }, { n: '🧊', name: 'tủ lạnh' }, { n: '🛏️', name: 'giường' }, { n: '🎹', name: 'đàn' }];
  const inRect = (x, y, r, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
  const inRiver = (x, y) => x > RIVER.x0 && x < RIVER.x1 && !(y > BRIDGE.y0 && y < BRIDGE.y1);
  const SPAWN = [[560, 300], [560, 380], [560, 460], [560, 540]];
  // lưới dẫn đường cho máy
  const GS = 20, GW = Math.ceil(W / GS), GH = Math.ceil(H / GS);

  class Moving {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false; this.elapsed = 0;
      this.ps = this.P.map((p, i) => ({ i, x: SPAWN[i][0], y: SPAWN[i][1], vx: 0, vy: 0, r: 20, face: Math.PI, walk: 0, hold: null, throwT: -9, moved: 0, skip: false, nav: null, navT: 0 }));
      this.items = [];
      const spots = U.shuffle([[110, 170], [200, 250], [380, 150], [400, 330], [110, 330], [240, 330], [380, 460], [120, 460], [300, 620], [140, 630], [400, 640], [230, 450], [190, 170], [420, 250], [330, 560]]);
      const nS = 5 + this.n, nL = 2 + Math.floor(this.n / 2);
      for (let k = 0; k < nL; k++) { const [x, y] = spots.pop(); this.items.push(this.mkItem(x, y, true)); }
      for (let k = 0; k < nS; k++) { const [x, y] = spots.pop(); this.items.push(this.mkItem(x, y, false)); }
      this.items.forEach((it) => this.collide(it));
      this.totalVal = this.items.reduce((s, it) => s + it.val, 0); this.got = 0; this.lost = 0;
      this.lastIn = this.P.map(() => ({ mx: 0, my: 0, act: false, jumpP: false }));
      this.navCache = {};
    }

    mkItem(x, y, big) {
      const k = big ? U.pick(LARGE) : U.pick(SMALL);
      return { x, y, vx: 0, vy: 0, z: 0, vz: 0, r: big ? 30 : 16, big, icon: k.n, name: k.name, val: big ? 3 : 1, carriers: [], ang: 0, fly: null, state: 'idle', sinkT: 0 };
    }

    blocked(x, y, pad) {
      if (WALLS.some((w) => inRect(x, y, w, pad))) return true;
      if (x > RIVER.x0 - pad && x < RIVER.x1 + pad && !(y > BRIDGE.y0 + pad && y < BRIDGE.y1 - pad)) return true;
      return x < 20 + pad || x > W - 20 - pad || y < AY + pad || y > BOT - pad;
    }
    collide(o) {
      for (const w of WALLS) Phys.circleRect(o, w);
      // bờ sông: không đi xuống sông (trừ trên cầu)
      if (o.x > RIVER.x0 - o.r && o.x < RIVER.x1 + o.r && !(o.y > BRIDGE.y0 + o.r * 0.5 && o.y < BRIDGE.y1 - o.r * 0.5)) {
        if (o.y > BRIDGE.y0 - o.r && o.y < BRIDGE.y1 + o.r && o.x > RIVER.x0 && o.x < RIVER.x1) o.y = U.clamp(o.y, BRIDGE.y0 + o.r * 0.5, BRIDGE.y1 - o.r * 0.5);
        else if (o.x < (RIVER.x0 + RIVER.x1) / 2) o.x = RIVER.x0 - o.r; else o.x = RIVER.x1 + o.r;
      }
      o.x = U.clamp(o.x, 20 + o.r, W - 20 - o.r); o.y = U.clamp(o.y, AY + o.r, BOT - o.r);
    }

    grab(p, it) {
      if (it.state !== 'idle' && !(it.state === 'held' && it.big && it.carriers.length === 1)) return false;
      if (it.carriers.length === 0) it.ang = Math.atan2(it.y - p.y, it.x - p.x);
      it.carriers.push(p.i); it.state = 'held'; p.hold = it; it.by = it.carriers.slice(); Sfx.play('pickup', 0.05);
      return true;
    }
    drop(p) {
      const it = p.hold; if (!it) return;
      it.carriers = it.carriers.filter((c) => c !== p.i);
      if (!it.carriers.length) it.state = 'idle';
      p.hold = null;
    }
    throwItem(it, dir) {
      it.carriers.forEach((c) => { this.ps[c].hold = null; });
      it.carriers = []; it.state = 'fly';
      const dist = it.big ? THROW - 20 : THROW;
      it.fly = { x0: it.x, y0: it.y, x1: it.x + Math.cos(dir) * dist, y1: it.y + Math.sin(dir) * dist, t: 0 };
      Sfx.play('dash');
    }

    deliver(it) {
      it.state = 'done'; this.got += it.val;
      (it.by || []).forEach((c) => { this.ps[c].moved += it.val; }); Sfx.play('crown'); FX.shake(3);
      this.api.parts.text(TRUCK.x + TRUCK.w / 2, TRUCK.y - 20, `+${it.val} ${it.icon}`, '#ffe14d', 30);
      this.api.parts.burst(TRUCK.x + TRUCK.w / 2, TRUCK.y + 40, ['#ffe14d', '#fff', '#7dff9a'], 20, 220, 0.6, 6);
    }

    update(dt, inp) {
      const parts = this.api.parts;
      this.lastIn = inp;
      if (!this.finished) {
        this.time -= dt; this.elapsed += dt;
        const left = this.items.filter((it) => it.state !== 'done' && it.state !== 'lost').length;
        if (this.time <= 0 || left === 0) { this.time = Math.max(0, this.time); this.finished = true; }
      }
      // người chơi
      this.ps.forEach((p, i) => {
        const q = this.finished ? { mx: 0, my: 0 } : inp[i];
        if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        // nhấc / thả
        if (q.act && !p.hold) {
          const it = this.items.filter((x) => (x.state === 'idle' || (x.state === 'held' && x.big && x.carriers.length === 1 && x.carriers[0] !== i)) && Math.hypot(x.x - p.x, x.y - p.y) < x.r + p.r + 14)
            .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
          if (it) this.grab(p, it);
        } else if (!q.act && p.hold) this.drop(p);
        // quăng
        if (q.jumpP && p.hold) {
          const it = p.hold;
          if (!it.big) this.throwItem(it, p.face);
          else if (it.carriers.length === 2) {
            p.throwT = this.elapsed;
            const o = this.ps[it.carriers.find((c) => c !== i)];
            if (this.elapsed - o.throwT < TP) this.throwItem(it, Math.atan2(Math.sin(p.face) + Math.sin(o.face), Math.cos(p.face) + Math.cos(o.face)));
          }
        }
        if (!p.hold || !p.hold.big) {
          const sp = p.hold ? 235 : 270, k = Math.min(1, dt * 10);
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
          p.x += p.vx * dt; p.y += p.vy * dt;
          this.collide(p);
          if (p.hold) {
            const it = p.hold; it.x = p.x + Math.cos(p.face) * 26; it.y = p.y + Math.sin(p.face) * 14 - 4;
            if (inRect(it.x, it.y, TRUCK)) { p.hold = null; it.carriers = []; this.deliver(it); }
          }
        }
      });
      // đồ lớn: hai người khiêng như cáng, xoay theo hướng đi
      for (const it of this.items) {
        if (it.state !== 'held' || !it.big) continue;
        const cs = it.carriers.map((c) => this.ps[c]);
        let vx = 0, vy = 0;
        cs.forEach((c) => { const q = this.finished ? { mx: 0, my: 0 } : inp[c.i]; vx += q.mx; vy += q.my; });
        const both = cs.length === 2, sp = both ? 195 / 2 : 70;
        vx *= sp; vy *= sp;
        const m = Math.hypot(vx, vy);
        if (m > 5) it.ang += U.angDiff(it.ang, Math.atan2(vy, vx)) * Math.min(1, dt * (both ? 4 : 2));
        it.x += vx * dt; it.y += vy * dt;
        this.collide(it);
        // người khiêng đứng hai đầu
        const d = it.r + 18;
        cs.forEach((c, k) => {
          const s = k === 0 ? -1 : 1;
          c.x = it.x + Math.cos(it.ang) * d * s; c.y = it.y + Math.sin(it.ang) * d * s;
          if (m > 5) c.walk += dt * 10;
          c.vx = c.vy = 0;
        });
        if (inRect(it.x, it.y, TRUCK)) { cs.forEach((c) => { c.hold = null; }); it.carriers = []; this.deliver(it); }
      }
      Phys.separate(this.ps.filter((p) => !p.hold || !p.hold.big), 0.4);
      // đồ đang bay / nằm đất
      for (const it of this.items) {
        if (it.state === 'fly') {
          const f = it.fly; f.t += dt / 0.6;
          const k = Math.min(1, f.t);
          it.x = f.x0 + (f.x1 - f.x0) * k; it.y = f.y0 + (f.y1 - f.y0) * k; it.z = 90 * 4 * k * (1 - k);
          if (k < 1 && WALLS.some((w) => inRect(it.x, it.y, w)) && it.z < 40) { f.x1 = it.x - (f.x1 - f.x0) * 0.08; f.y1 = it.y - (f.y1 - f.y0) * 0.08; f.t = 1; }
          if (k >= 1) {
            it.z = 0; it.state = 'idle';
            if (inRect(it.x, it.y, TRUCK)) this.deliver(it);
            else if (inRiver(it.x, it.y)) { it.state = 'lost'; it.sinkT = 1; this.lost += it.val; Sfx.play('fall'); parts.burst(it.x, it.y, ['#8fd3ff', '#fff'], 18, 200, 0.6, 5); parts.text(it.x, it.y - 30, 'Chìm mất!', '#ff8fa8', 24); }
            else { this.collide(it); Sfx.play('place', 0.05); }
          }
        } else if (it.state === 'idle' && inRect(it.x, it.y, TRUCK)) this.deliver(it);
        if (it.state === 'lost') it.sinkT -= dt;
      }
      this.ps.forEach((p) => { if (p.hold && p.hold.state === 'done') p.hold = null; });
    }

    draw(ctx) {
      const t = U.now();
      ctx.fillStyle = '#5c9e4a'; ctx.fillRect(0, 0, W, H);
      // sông + cầu
      ctx.fillStyle = '#2f7fc0'; ctx.fillRect(RIVER.x0, AY - 20, RIVER.x1 - RIVER.x0, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3;
      for (let k = 0; k < 12; k++) { const y = AY + k * 55 + ((t * 30) % 55); ctx.beginPath(); ctx.moveTo(RIVER.x0 + 20, y); ctx.quadraticCurveTo((RIVER.x0 + RIVER.x1) / 2, y + 12, RIVER.x1 - 20, y); ctx.stroke(); }
      ctx.fillStyle = '#9c6b3a'; ctx.fillRect(RIVER.x0 - 10, BRIDGE.y0, RIVER.x1 - RIVER.x0 + 20, BRIDGE.y1 - BRIDGE.y0);
      ctx.strokeStyle = 'rgba(60,35,15,0.5)'; ctx.lineWidth = 2;
      for (let x = RIVER.x0; x < RIVER.x1; x += 18) { ctx.beginPath(); ctx.moveTo(x, BRIDGE.y0); ctx.lineTo(x, BRIDGE.y1); ctx.stroke(); }
      // sàn nhà
      ctx.fillStyle = '#d9b98c'; ctx.fillRect(HOUSE.x0, HOUSE.y0, HOUSE.x1 - HOUSE.x0, HOUSE.y1 - HOUSE.y0);
      ctx.fillStyle = 'rgba(150,100,60,0.15)';
      for (let x = HOUSE.x0; x < HOUSE.x1; x += 40) ctx.fillRect(x, HOUSE.y0, 2, HOUSE.y1 - HOUSE.y0);
      ctx.fillStyle = '#6b4a3a';
      for (const w of WALLS) ctx.fillRect(w.x, w.y, w.w, w.h);
      // xe tải
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; Draw.rr(ctx, TRUCK.x + 8, TRUCK.y + 12, TRUCK.w, TRUCK.h, 14); ctx.fill();
      ctx.fillStyle = '#e8e4da'; Draw.rr(ctx, TRUCK.x, TRUCK.y, TRUCK.w, TRUCK.h, 14); ctx.fill();
      ctx.fillStyle = '#3d6fb3'; Draw.rr(ctx, TRUCK.x + TRUCK.w - 10, TRUCK.y + 60, 40, TRUCK.h - 120, 10); ctx.fill();
      ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.strokeRect(TRUCK.x + 6, TRUCK.y + 6, TRUCK.w - 12, TRUCK.h - 12); ctx.setLineDash([]);
      Draw.text(ctx, '🚚 XE TẢI', TRUCK.x + TRUCK.w / 2, TRUCK.y + 24, { size: 20, color: '#3a3050', stroke: null });
      Draw.text(ctx, `${this.got}/${this.totalVal}`, TRUCK.x + TRUCK.w / 2, TRUCK.y + TRUCK.h / 2, { size: 40, color: '#3a3050', stroke: null });
      // đồ đạc (dưới) + người
      const ents = [];
      for (const it of this.items) if (it.state !== 'done' && !(it.state === 'lost' && it.sinkT <= 0)) ents.push({ y: it.y, f: () => this.drawItem(ctx, it, t) });
      this.ps.forEach((p, i) => ents.push({ y: p.y + 1, f: () => {
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk });
        if (p.hold && p.hold.big && p.hold.carriers.length === 1) Draw.text(ctx, 'Cần 1 người nữa!', p.x, p.y - 42, { size: 15, color: '#ffe14d', sw: 3 });
      } }));
      ents.sort((a, b) => a.y - b.y).forEach((e) => e.f());
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.hold ? `${p.hold.icon}` : '🙌')), { w: 130 });
      Draw.timer(ctx, this.time, W - 72, 38);
      Draw.label(ctx, `🚚 ${this.got}/${this.totalVal}${this.lost ? ` · chìm ${this.lost}` : ''}`, 110, 38);
      if (this.elapsed < 6) Draw.text(ctx, 'Giữ Đánh: khiêng · Chạm Nhảy: quăng · Đồ to cần 2 người (cùng bấm Nhảy để quăng qua sông)', W / 2, H - 6, { size: 16, color: '#ffe14d', sw: 4 });
    }

    drawItem(ctx, it, t) {
      const sink = it.state === 'lost' ? it.sinkT : 1;
      ctx.save(); ctx.globalAlpha = sink;
      if (it.state !== 'lost') { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + it.r * 0.7, it.r, it.r * 0.35, 0, 0, TAU); ctx.fill(); }
      const y = it.y - it.z - (it.state === 'held' ? 10 : 0);
      if (it.big) {
        ctx.translate(it.x, y); ctx.rotate(it.state === 'held' ? it.ang : 0);
        ctx.fillStyle = '#f2e6c9'; Draw.rr(ctx, -it.r - 6, -it.r * 0.7, it.r * 2 + 12, it.r * 1.4, 10); ctx.fill();
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.stroke();
        ctx.rotate(-(it.state === 'held' ? it.ang : 0));
        Draw.text(ctx, it.icon, 0, 2, { size: 36, stroke: null });
      } else Draw.text(ctx, it.icon, it.x, y, { size: 30, stroke: null });
      ctx.restore();
      if (it.big && it.state === 'idle' && Math.sin(t * 4 + it.x) > 0.3) Draw.text(ctx, '👥', it.x + it.r, it.y - it.r - 6, { size: 16, stroke: null });
    }

    results() {
      const win = this.got >= this.totalVal;
      return this.ps.map((p) => ({ score: this.got * 10 + p.moved, text: `${win ? '🏆 ' : ''}Chuyển ${this.got}/${this.totalVal} · tự tay ${p.moved}` }));
    }
    resultTitle() { return this.got >= this.totalVal ? '🎉 Chuyển nhà xong xuôi!' : `🚚 Chuyển được ${this.got}/${this.totalVal} món${this.lost ? ` · ${this.lost} chìm sông` : ''}`; }

    /* ---------- máy ---------- */
    /** BFS trên lưới để lấy hướng đi tiếp tới (tx,ty) */
    navDir(p, tx, ty, pad) {
      const key = `${Math.floor(tx / GS)},${Math.floor(ty / GS)},${pad}`;
      let field = this.navCache[key];
      if (!field || this.elapsed - field.t > 2) {
        const dist = new Int16Array(GW * GH).fill(-1), q = [];
        const sx = U.clamp(Math.floor(tx / GS), 0, GW - 1), sy = U.clamp(Math.floor(ty / GS), 0, GH - 1);
        dist[sy * GW + sx] = 0; q.push(sy * GW + sx);
        for (let h = 0; h < q.length; h++) {
          const c = q[h], cx = c % GW, cy = (c - cx) / GW;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
            const k = ny * GW + nx;
            if (dist[k] >= 0 || this.blocked(nx * GS + GS / 2, ny * GS + GS / 2, pad)) continue;
            dist[k] = dist[c] + 1; q.push(k);
          }
        }
        field = this.navCache[key] = { dist, t: this.elapsed };
      }
      const cx = U.clamp(Math.floor(p.x / GS), 0, GW - 1), cy = U.clamp(Math.floor(p.y / GS), 0, GH - 1);
      // nhìn quanh 2 ô, chọn ô gần đích nhất
      let best = -1, bv = Infinity;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const v = field.dist[ny * GW + nx];
        if (v < 0) continue;
        const sc = v + Math.hypot(dx, dy) * 0.3;
        if (sc < bv) { bv = sc; best = ny * GW + nx; }
      }
      if (best < 0) return Math.atan2(ty - p.y, tx - p.x);
      if (field.dist[cy * GW + cx] >= 0 && field.dist[cy * GW + cx] <= 1) return Math.atan2(ty - p.y, tx - p.x);
      const bx = (best % GW) * GS + GS / 2, by = Math.floor(best / GW) * GS + GS / 2;
      return Math.atan2(by - p.y, bx - p.x);
    }

    /** điểm đứng quăng qua sông (bờ trái) */
    throwSpot(p) { return { x: RIVER.x0 - 34, y: U.clamp(p.y, 230, BOT - 60) }; }

    botInput(i) {
      const p = this.ps[i], o = { mx: 0, my: 0, act: false, jumpP: false };
      if (this.finished) return o;
      const go = (x, y, pad = 18) => { const a = this.navDir(p, x, y, pad); o.mx = Math.cos(a); o.my = Math.sin(a); };
      const it = p.hold;
      if (it) {
        o.act = true;
        const left = it.x < RIVER.x0;
        if (it.big) {
          const mates = it.carriers;
          if (mates.length < 2) {
            // vừa kéo lê dần ra phía bờ sông vừa đợi người tới phụ
            { const tx = left ? this.throwSpot(it).x : TRUCK.x + 40, ty = left ? this.throwSpot(it).y : TRUCK.y + TRUCK.h / 2; const a = this.navDir(it, tx, ty, 34); o.mx = Math.cos(a); o.my = Math.sin(a); }
            return o;
          }
          const other = mates.find((c) => c !== i);
          if (!this.P[other].bot) {
            // đi theo người thật đang khiêng cùng; họ quăng thì quăng theo
            const q = this.lastIn[other] || {};
            o.mx = q.mx || 0; o.my = q.my || 0;
            if (this.ps[other].throwT > this.elapsed - 0.25) o.jumpP = true;
            return o;
          }
          // hai máy khiêng: cùng tính một hướng
          const tx = left ? this.throwSpot(it).x : TRUCK.x + 40, ty = left ? this.throwSpot(it).y : TRUCK.y + TRUCK.h / 2;
          const a = this.navDir(it, tx, ty, 36); o.mx = Math.cos(a); o.my = Math.sin(a);
          if (left && Math.abs(it.x - tx) < 26 && it.y > BRIDGE.y1 + 40) { o.mx = 1; o.my = 0; o.jumpP = true; }
          return o;
        }
        if (left) {
          const s = this.throwSpot(p);
          if (Math.hypot(s.x - p.x, s.y - p.y) < 22) { o.mx = 1; o.my = 0; o.jumpP = true; return o; }
          go(s.x, s.y); return o;
        }
        // bờ phải: mang thẳng vào xe (hoặc quăng khi đủ gần)
        const dx = TRUCK.x + 30 - p.x, dy = TRUCK.y + TRUCK.h / 2 - p.y;
        if (Math.hypot(dx, dy) < THROW - 60 && Math.abs(dy) < 80 && dx > 120) { o.mx = 1; o.my = 0; o.jumpP = true; return o; }
        go(TRUCK.x + 40, TRUCK.y + TRUCK.h / 2); return o;
      }
      // rảnh tay: phụ khiêng đồ lớn đang có 1 người
      const solo = this.items.find((x) => x.state === 'held' && x.big && x.carriers.length === 1 && x.carriers[0] !== i);
      let target = solo;
      if (!target) {
        // món gần nhất chưa ai khiêng (máy khác đang nhắm thì bỏ qua), ưu tiên món ở bờ phải
        let bd = Infinity;
        for (const x of this.items) {
          if (x.state !== 'idle') continue;
          if (this.ps.some((q, j) => j !== i && q.botTarget === x)) continue;
          let d = Math.hypot(x.x - p.x, x.y - p.y) + (x.x > RIVER.x1 ? -200 : 0) + (x.big ? 120 : 0);
          if (d < bd) { bd = d; target = x; }
        }
      }
      p.botTarget = target || null;
      if (!target) return o;
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      if (d < target.r + p.r + 10) { o.act = true; return o; }
      let tx = target.x, ty = target.y;
      if (target === solo) { const c = this.ps[target.carriers[0]]; tx = target.x + (target.x - c.x) * 0.9; ty = target.y + (target.y - c.y) * 0.9; }
      go(tx, ty);
      return o;
    }
  }

  Party.register({
    id: 'moving', name: 'Chuyển Đồ Điên Loạn', emoji: '🚚', cat: 'team', coop: true,
    tagline: 'Cả nhóm khiêng đồ qua cửa hẹp, quăng qua sông lên xe tải',
    how: 'Cùng nhau chuyển hết đồ trong nhà lên xe tải bên kia sông trước khi hết giờ. Giữ Đánh để nhấc và khiêng, thả nút là đặt xuống. '
      + 'Đồ nhỏ một người khiêng được, chạm Nhảy để quăng theo hướng mặt. Đồ lớn (👥) phải 2 người cùng giữ Đánh mới đi nhanh — một mình chỉ kéo lê được; '
      + 'hai người cùng bấm Nhảy để quăng nó đi. Có thể vác qua cầu hoặc đứng ở bờ quăng qua sông cho nhanh — quăng hụt rơi xuống sông là mất!',
    controls: { move: 'Đi / khiêng', act: 'Giữ: nhấc & khiêng', jump: 'Quăng đồ' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Moving(api),
  });
})();

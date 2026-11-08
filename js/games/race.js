'use strict';
/* Đua Xe — bấm hướng muốn chạy, xe tự chạy. 3 vòng, né vũng dầu, có tăng tốc. */
(() => {
  const RAW = [[200, 600], [190, 330], [250, 190], [420, 140], [560, 210], [620, 350], [730, 420], [860, 370],
    [900, 230], [1020, 140], [1130, 210], [1140, 420], [1070, 580], [880, 640], [620, 620], [400, 650]];
  const TW = 118, LAPS = 3, MAXT = 150;

  // Đường đua: nội suy Catmull-Rom thành dãy điểm
  const S = [];
  for (let i = 0; i < RAW.length; i++) {
    const n = RAW.length;
    const p0 = RAW[(i - 1 + n) % n], p1 = RAW[i], p2 = RAW[(i + 1) % n], p3 = RAW[(i + 2) % n];
    for (let k = 0; k < 20; k++) {
      const t = k / 20, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      S.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const NS = S.length;
  const CUM = new Float32Array(NS), ANG = new Float32Array(NS);
  let L = 0;
  for (let i = 0; i < NS; i++) {
    const a = S[i], b = S[(i + 1) % NS];
    CUM[i] = L; L += Math.hypot(b[0] - a[0], b[1] - a[1]);
    ANG[i] = Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  const OILS = [[75, 26], [150, -28], [215, 30], [272, -24]].map(([k, off]) => {
    const n = ANG[k] + Math.PI / 2;
    return { x: S[k][0] + Math.cos(n) * off, y: S[k][1] + Math.sin(n) * off, r: 24 };
  });

  // RAC1: hàng hộp vật phẩm (3 hộp ngang đường) tại vài điểm trên đường đua
  const BOX_SEGS = [40, 118, 190, 250];
  const BOXES = [];
  for (const k of BOX_SEGS) for (const off of [-34, 0, 34]) {
    const n = ANG[k] + Math.PI / 2;
    BOXES.push({ x: S[k][0] + Math.cos(n) * off, y: S[k][1] + Math.sin(n) * off });
  }
  const ITEMS = { banana: '🍌', rocket: '🚀', shield: '🛡️' };
  const TAP = 0.18;
  const MODES = [
    { id: 'race', name: 'Đua vòng', desc: 'Chạy đủ số vòng, về đích trước là thắng.' },
    { id: 'balloon', name: 'Đấu bong bóng', desc: 'Mỗi xe 3 bong bóng. Bắn tên lửa, thả chuối, tăng tốc húc thẳng vào xe khác để làm nổ bong bóng. Hết bong bóng là bị loại!' },
  ];   // nhả nút Nhảy trước mốc này = dùng vật phẩm; giữ lâu hơn = drift

  let TRACK = null;
  function trackCanvas() {
    if (TRACK) return TRACK;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#4f9e45'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      g.beginPath(); g.arc(Math.random() * W, Math.random() * H, U.rand(3, 9), 0, TAU); g.fill();
    }
    const path = () => { g.beginPath(); S.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    path(); g.strokeStyle = '#f2f2f2'; g.lineWidth = TW + 20; g.stroke();
    path(); g.strokeStyle = '#e8384f'; g.lineWidth = TW + 20; g.setLineDash([20, 20]); g.stroke(); g.setLineDash([]);
    path(); g.strokeStyle = '#575a6c'; g.lineWidth = TW; g.stroke();
    path(); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3; g.setLineDash([22, 22]); g.stroke(); g.setLineDash([]);
    // vạch đích ô cờ
    g.save(); g.translate(S[0][0], S[0][1]); g.rotate(ANG[0]);
    const sq = TW / 8;
    for (let r = 0; r < 2; r++) for (let k = 0; k < 8; k++) {
      g.fillStyle = (r + k) % 2 ? '#111' : '#fff';
      g.fillRect(-sq + r * sq, -TW / 2 + k * sq, sq, sq);
    }
    g.restore();
    TRACK = c;
    return c;
  }

  class Race {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.elapsed = 0; this.finished = false; this.place = 0; this.firstFinish = -1;
      this.balloon = api.mode === 'balloon';
      if (this.balloon) { this.total = this.time = api.T(90); this.outCount = 0; } else this.laps = api.count(LAPS);
      this.maxT = MAXT * api.len.count;
      const grid = U.shuffle(this.P.map((_, i) => i));   // xáo vị trí xuất phát cho công bằng
      this.cars = this.P.map((p, i) => {
        const g = grid[i], row = Math.floor(g / 2), col = g % 2;
        const si = (NS - 6 - row * 7) % NS;
        const nrm = ANG[si] + Math.PI / 2, off = col ? 26 : -26;
        return {
          x: S[si][0] + Math.cos(nrm) * off, y: S[si][1] + Math.sin(nrm) * off, h: ANG[si], v: 0,
          si, prevS: CUM[si], cross: 0, done: false, time: 0, rank: 0,
          boostT: 0, boostCd: 0, spin: 0, oilImm: 0, off: false, r: 20,
          item: null, shield: 0, jumpHeld: 0, drift: 0, driftDir: 0, bal: 3, out: false, popImm: 0, outT: 0,
        };
      });
      this.boxes = BOXES.map((b) => ({ x: b.x, y: b.y, t: 0 }));
      this.bananas = []; this.rockets = [];
      this.bannerText = ''; this.bannerT = 9; this.bannerColor = '#fff';
    }

    nearest(c, win) {
      let best = c.si, bd = Infinity;
      for (let k = -win; k <= win; k++) {
        const i = (c.si + k + NS) % NS;
        const d = (S[i][0] - c.x) ** 2 + (S[i][1] - c.y) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      return [best, Math.sqrt(bd)];
    }
    progress(c) { return Math.min(c.cross, this.laps + 1) * L + CUM[c.si]; }

    /** xe bị trúng chuối / tên lửa: có khiên thì mất khiên, không thì xoay vòng */
    hitCar(c, i) {
      const parts = this.api.parts;
      if (c.shield > 0) { c.shield = 0; Sfx.play('crown'); parts.text(c.x, c.y - 36, '🛡️ Chặn!', '#9fd8ff', 24); return; }
      c.spin = 0.9; c.drift = 0; Sfx.play('hurt'); Party.rumble(i, 0.7, 260); FX.shake(4);
      parts.burst(c.x, c.y, ['#ffe14d', '#fff'], 12, 200, 0.5, 6);
      if (this.balloon) this.pop(c, i);
    }
    /** RAC4: nổ một bong bóng; hết bong bóng thì bị loại */
    pop(c, i) {
      if (c.out || c.popImm > 0) return;
      c.bal--; c.popImm = 1.2;
      const parts = this.api.parts;
      Sfx.play('boom', 0.05);
      parts.burst(c.x, c.y - 30, [this.P[i].color.light, '#fff'], 14, 240, 0.4, 5);
      if (c.bal <= 0) { c.out = true; c.outT = this.elapsed; c.rank = this.n - this.outCount++; parts.text(c.x, c.y - 40, 'Bị loại!', '#fff', 30); }
      else parts.text(c.x, c.y - 44, `Bùm! còn ${c.bal} 🎈`, this.P[i].color.light, 22);
    }
    useItem(c, i) {
      const it = c.item; c.item = null;
      if (it === 'banana') this.bananas.push({ x: c.x - Math.cos(c.h) * 34, y: c.y - Math.sin(c.h) * 34, age: 0 });
      if (it === 'shield') c.shield = 8;
      if (it === 'rocket') {
        // nhắm xe ngay phía trước theo tiến độ
        const me = this.progress(c);
        let tgt = -1, best = Infinity;
        if (this.balloon) this.cars.forEach((o, j) => { if (j === i || o.out) return; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < best) { best = d; tgt = j; } });
        else this.cars.forEach((o, j) => { if (j === i || o.done) return; const d = this.progress(o) - me; if (d > 0 && d < best) { best = d; tgt = j; } });
        this.rockets.push({ x: c.x + Math.cos(c.h) * 30, y: c.y + Math.sin(c.h) * 30, h: c.h, si: c.si, tgt, owner: i, life: 4 });
      }
      Sfx.play(it === 'rocket' ? 'shoot' : 'place');
    }

    update(dt, inp) {
      const parts = this.api.parts;
      this.bannerT += dt;
      if (!this.finished) this.elapsed += dt;
      if (this.balloon && !this.finished) this.time = Math.max(0, this.time - dt);
      this.cars.forEach((c, i) => {
        const q = inp[i];
        if (c.out) { c.v *= Math.pow(0.1, dt); c.x += Math.cos(c.h) * c.v * dt; c.y += Math.sin(c.h) * c.v * dt; return; }
        c.boostT -= dt; c.boostCd -= dt; c.oilImm -= dt; c.popImm -= dt;
        if (c.spin > 0) {
          c.spin -= dt; c.h += 10 * dt; c.v *= Math.pow(0.3, dt);
        } else {
          if (Math.abs(q.mx) > 0.3 || Math.abs(q.my) > 0.3) {
            const ta = Math.atan2(q.my, q.mx), dh = U.angDiff(c.h, ta);
            c.h += U.clamp(dh, -3.6 * dt, 3.6 * dt);
          }
          if (q.actP && c.boostCd <= 0 && !c.done) { c.boostT = 1; c.boostCd = 3; Sfx.play('dash'); }
          // nút Nhảy: chạm = dùng vật phẩm; giữ khi ôm cua = drift, nhả ra được tăng tốc (RAC2)
          const turning = Math.abs(q.mx) > 0.3 || Math.abs(q.my) > 0.3 ? U.angDiff(c.h, Math.atan2(q.my, q.mx)) : 0;
          if (q.jump) {
            c.jumpHeld += dt;
            if (c.jumpHeld >= TAP && c.v > 200 && !c.done) {
              if (!c.drift && Math.abs(turning) > 0.25) { c.drift = 0.001; c.driftDir = Math.sign(turning); }
              if (c.drift) {
                c.drift += dt;
                c.h += c.driftDir * 1.4 * dt;   // bẻ cua gắt hơn
                if (Math.random() < 0.5) parts.burst(c.x - Math.cos(c.h) * 22, c.y - Math.sin(c.h) * 22, c.drift > 1.2 ? '#ff8a2e' : c.drift > 0.6 ? '#5fc8ff' : '#fff', 1, 50, 0.3, 4);
              }
            }
          } else {
            if ((c.jumpHeld > 0 && c.jumpHeld < TAP) || (q.jumpP && !c.jumpHeld)) { if (c.item && !c.done) this.useItem(c, i); }
            if (c.drift > 0.6) {
              c.boostT = Math.max(c.boostT, c.drift > 1.2 ? 0.9 : 0.5); Sfx.play('dash');
              parts.text(c.x, c.y - 36, c.drift > 1.2 ? 'Drift siêu tốc!' : 'Drift!', c.drift > 1.2 ? '#ff8a2e' : '#5fc8ff', 22);
            }
            c.drift = 0; c.jumpHeld = 0;
          }
          c.shield -= dt;
          let vmax = c.done ? 160 : c.boostT > 0 ? 540 : 330;
          if (c.off) vmax *= 0.45;
          if (this.P[i].bot) vmax *= 0.4 + 0.6 * this.api.bot.speed;
          c.v = U.approach(c.v, vmax, (c.v < vmax ? 420 : 700) * dt);
        }
        c.x += Math.cos(c.h) * c.v * dt; c.y += Math.sin(c.h) * c.v * dt;
        c.x = U.clamp(c.x, 20, W - 20); c.y = U.clamp(c.y, 80, H - 16);
        const [si, d] = this.nearest(c, 25);
        c.si = si; c.off = d > TW / 2;
        const s = CUM[si];
        if (this.balloon) { /* đấu bong bóng: không tính vòng */ } else if (c.prevS > 0.75 * L && s < 0.25 * L) {
          c.cross++;
          if (c.cross > this.laps && !c.done) {
            c.done = true; c.time = this.elapsed; c.rank = ++this.place;
            if (this.firstFinish < 0) this.firstFinish = this.elapsed;
            this.bannerText = `${this.P[i].name} về đích #${c.rank}!`; this.bannerColor = this.P[i].color.light; this.bannerT = 0;
            Sfx.play('win');
            parts.burst(c.x, c.y, ['#ffe14d', '#fff', this.P[i].color.main], 30, 380, 0.9, 6);
          } else if (c.cross >= 2 && c.cross <= this.laps) {
            parts.text(c.x, c.y - 36, c.cross === this.laps ? 'Vòng cuối!' : `Vòng ${c.cross}`, this.P[i].color.light, 26);
            Sfx.play('pickup');
          }
        } else if (c.prevS < 0.25 * L && s > 0.75 * L) c.cross--;
        c.prevS = s;
        if (c.oilImm <= 0 && c.spin <= 0) {
          for (const o of OILS) {
            if (Math.hypot(o.x - c.x, o.y - c.y) < o.r + 8) {
              c.spin = 0.8; c.oilImm = 1.6; Sfx.play('hurt'); Party.rumble(i, 0.6, 250);
              parts.burst(c.x, c.y, '#222', 10, 160, 0.5, 6);
            }
          }
        }
        // hộp vật phẩm
        if (!c.item && !c.done) {
          for (const b of this.boxes) {
            if (b.t <= 0 && Math.hypot(b.x - c.x, b.y - c.y) < 30) {
              b.t = 3; c.item = U.pick(Object.keys(ITEMS)); Sfx.play('pickup');
              parts.text(c.x, c.y - 36, ITEMS[c.item], '#fff', 30);
              break;
            }
          }
        }
        if (c.spin <= 0) for (const bn of this.bananas) {
          if (!bn.dead && bn.age > 0.3 && Math.hypot(bn.x - c.x, bn.y - c.y) < 24) { bn.dead = true; this.hitCar(c, i); }
        }
        if (c.boostT > 0 && Math.random() < 0.6) {
          parts.burst(c.x - Math.cos(c.h) * 24, c.y - Math.sin(c.h) * 24, ['#ffb12e', '#ff5a2e'], 1, 60, 0.3, 6);
        }
      });
      for (const b of this.boxes) b.t -= dt;
      for (const bn of this.bananas) bn.age += dt;
      this.bananas = this.bananas.filter((bn) => !bn.dead);
      // tên lửa: bám xe mục tiêu, không có mục tiêu thì bay theo đường đua
      for (const r of this.rockets) {
        r.life -= dt;
        let tx, ty;
        if (r.tgt >= 0 && !this.cars[r.tgt].done) { tx = this.cars[r.tgt].x; ty = this.cars[r.tgt].y; }
        else { r.si = this.nearest({ si: r.si, x: r.x, y: r.y }, 20)[0]; const k = (r.si + 12) % NS; tx = S[k][0]; ty = S[k][1]; }
        r.h += U.clamp(U.angDiff(r.h, Math.atan2(ty - r.y, tx - r.x)), -4 * dt, 4 * dt);
        r.x += Math.cos(r.h) * 560 * dt; r.y += Math.sin(r.h) * 560 * dt;
        if (Math.random() < 0.7) parts.burst(r.x - Math.cos(r.h) * 12, r.y - Math.sin(r.h) * 12, ['#ffb12e', '#fff'], 1, 40, 0.3, 4);
        this.cars.forEach((c, j) => { if (j !== r.owner && !c.out && !r.dead && Math.hypot(c.x - r.x, c.y - r.y) < 26) { r.dead = true; this.hitCar(c, j); Sfx.play('boom', 0.1); } });
        if (r.life <= 0) r.dead = true;
      }
      this.rockets = this.rockets.filter((r) => !r.dead);
      // va chạm giữa xe
      for (let a = 0; a < this.n; a++) {
        for (let b = a + 1; b < this.n; b++) {
          const A = this.cars[a], B = this.cars[b];
          if (A.out || B.out) continue;
          const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
          if (d < 38 && d > 0.01) {
            // đấu bong bóng: đang tăng tốc mà húc thẳng vào xe khác → nổ bong bóng xe đó
            if (this.balloon) {
              if (A.boostT > 0 && Math.cos(A.h - Math.atan2(dy, dx)) > 0.6 && B.shield <= 0) this.pop(B, b);
              if (B.boostT > 0 && Math.cos(B.h - Math.atan2(-dy, -dx)) > 0.6 && A.shield <= 0) this.pop(A, a);
            }
            const ov = (38 - d) / 2, nx = dx / d, ny = dy / d;
            A.x -= nx * ov; A.y -= ny * ov; B.x += nx * ov; B.y += ny * ov;
            A.v *= 0.97; B.v *= 0.97;
            if (d < 30) Sfx.play('hit', 0.2);
          }
        }
      }
      if (!this.finished && this.balloon) {
        if (this.cars.filter((c) => !c.out).length <= 1 || this.time <= 0) this.finished = true;
      } else if (!this.finished) {
        if (this.cars.every((c) => c.done) || (this.firstFinish >= 0 && this.elapsed - this.firstFinish > 15) || this.elapsed > this.maxT) {
          this.finished = true;
        }
      }
    }

    draw(ctx) {
      ctx.drawImage(trackCanvas(), 0, 0);
      for (const o of OILS) {
        ctx.fillStyle = '#1b1b24';
        ctx.beginPath(); ctx.ellipse(o.x, o.y, o.r, o.r * 0.7, 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(140,120,255,0.35)';
        ctx.beginPath(); ctx.ellipse(o.x - 6, o.y - 4, o.r * 0.45, o.r * 0.2, 0.4, 0, TAU); ctx.fill();
      }
      const t = U.now();
      for (const b of this.boxes) {
        if (b.t > 0) continue;
        ctx.save(); ctx.translate(b.x, b.y + Math.sin(t * 4 + b.x) * 2); ctx.rotate(t * 1.5);
        ctx.fillStyle = `hsla(${(t * 120 + b.x) % 360},90%,60%,0.9)`; Draw.rr(ctx, -12, -12, 24, 24, 5); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        Draw.text(ctx, '?', b.x, b.y + 1, { size: 18, color: '#fff', sw: 3 });
      }
      for (const bn of this.bananas) Draw.text(ctx, '🍌', bn.x, bn.y, { size: 26, stroke: null });
      for (const r of this.rockets) {
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.h);
        ctx.fillStyle = '#e8384f'; Draw.rr(ctx, -12, -5, 24, 10, 5); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(12, -5); ctx.lineTo(18, 0); ctx.lineTo(12, 5); ctx.fill();
        ctx.restore();
      }
      const order = this.cars.map((_, i) => i).sort((a, b) => this.cars[a].y - this.cars[b].y);
      for (const i of order) {
        const c = this.cars[i];
        this.drawCar(ctx, c, this.P[i].color);
        if (c.shield > 0) { ctx.strokeStyle = `rgba(150,220,255,${0.5 + 0.3 * Math.sin(t * 8)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, 30, 0, TAU); ctx.stroke(); }
        if (c.item) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(c.x + 26, c.y - 30, 13, 0, TAU); ctx.fill();
          Draw.text(ctx, ITEMS[c.item], c.x + 26, c.y - 29, { size: 16, stroke: null });
        }
      }

      // xếp hạng hiện tại
      const ranking = this.cars.map((c, i) => i).sort((a, b) => {
        const A = this.cars[a], B = this.cars[b];
        if (A.done && B.done) return A.rank - B.rank;
        if (A.done) return -1; if (B.done) return 1;
        return this.progress(B) - this.progress(A);
      });
      const pos = []; ranking.forEach((i, k) => { pos[i] = k + 1; });
      if (this.balloon) {
        Draw.chips(ctx, this.P, this.cars.map((c) => (c.out ? 'Loại' : '🎈'.repeat(c.bal))), { w: 200, dim: this.cars.map((c) => c.out) });
        Draw.timer(ctx, this.time, W - 72, 38);
      } else {
        Draw.chips(ctx, this.P, this.cars.map((c, i) => (c.done ? `🏁 #${c.rank}` : `#${pos[i]} · V${U.clamp(c.cross, 1, this.laps)}/${this.laps}`)), { w: 200 });
        Draw.label(ctx, '⏱ ' + U.fmtTime(this.elapsed), W - 80, 38);
      }
      if (this.firstFinish >= 0 && !this.finished) {
        Draw.text(ctx, `Kết thúc sau ${Math.ceil(15 - (this.elapsed - this.firstFinish))} giây`, W / 2, 92, { size: 24, color: '#ffe14d' });
      }
      if (this.bannerT < 1.6) Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 60, y: 300 });
    }

    drawCar(ctx, c, col) {
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; Draw.rr(ctx, -22, -11, 48, 28, 10); ctx.fill();
      ctx.fillStyle = '#222';
      for (const [wx, wy] of [[-14, -15], [14, -15], [-14, 15], [14, 15]]) { Draw.rr(ctx, wx - 7, wy - 4, 14, 8, 3); ctx.fill(); }
      ctx.fillStyle = col.main; Draw.rr(ctx, -24, -14, 48, 28, 10); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(20,10,40,0.5)'; ctx.stroke();
      ctx.fillStyle = col.light; ctx.fillRect(-20, -3, 40, 6);
      ctx.fillStyle = 'rgba(150,220,255,0.9)'; Draw.rr(ctx, 8, -10, 9, 20, 4); ctx.fill();
      if (c.boostT > 0) {
        ctx.fillStyle = '#ffb12e';
        ctx.beginPath(); ctx.moveTo(-24, -7); ctx.lineTo(-40 - Math.random() * 10, 0); ctx.lineTo(-24, 7); ctx.fill();
      }
      ctx.restore();
      Draw.blob(ctx, { x: c.x - Math.cos(c.h) * 4, y: c.y - 8, r: 11, color: col, face: c.h, shadow: false, stun: c.spin > 0, dead: c.out });
      if (this.balloon && !c.out) {
        const t = U.now();
        for (let k = 0; k < c.bal; k++) {
          const bx = c.x + (k - (c.bal - 1) / 2) * 14 + Math.sin(t * 3 + k) * 2, by = c.y - 44 - (k % 2) * 6;
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c.x, c.y - 14); ctx.lineTo(bx, by + 8); ctx.stroke();
          ctx.fillStyle = col.light; ctx.beginPath(); ctx.ellipse(bx, by, 7, 9, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = col.main; ctx.lineWidth = 2; ctx.stroke();
        }
      }
    }

    results() {
      if (this.balloon) return this.cars.map((c) => (c.out ? { score: c.outT, text: `Bị loại ở giây ${Math.floor(c.outT)}` } : { score: 1000 + c.bal, text: `Còn ${c.bal} 🎈` }));
      return this.cars.map((c) => (c.done
        ? { score: 1e6 - c.time, text: `Về thứ ${c.rank} · ${c.time.toFixed(1)} giây` }
        : { score: this.progress(c) / L, text: `Chưa về đích (vòng ${U.clamp(c.cross, 1, this.laps)}/${this.laps})` }));
    }

    balloonBot(c, i) {
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (c.out) return o;
      let tg = null, bd = Infinity;
      this.cars.forEach((x, j) => { if (j !== i && !x.out) { const d = Math.hypot(x.x - c.x, x.y - c.y); if (d < bd) { bd = d; tg = x; } } });
      let tx, ty;
      const box = !c.item && this.boxes.filter((b) => b.t <= 0).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
      if (box && Math.hypot(box.x - c.x, box.y - c.y) < 260) { tx = box.x; ty = box.y; }
      else if (tg) { tx = tg.x + Math.cos(tg.h) * tg.v * 0.3; ty = tg.y + Math.sin(tg.h) * tg.v * 0.3; }
      else return o;
      if (c.off) { const k = (c.si + 6) % NS; tx = (tx + S[k][0]) / 2; ty = (ty + S[k][1]) / 2; }
      const a = Math.atan2(ty - c.y, tx - c.x);
      o.mx = Math.cos(a); o.my = Math.sin(a);
      if (tg && bd < 220 && Math.abs(U.angDiff(c.h, Math.atan2(tg.y - c.y, tg.x - c.x))) < 0.35 && c.boostCd <= 0 && Math.random() < 0.08) o.actP = true;
      if (c.item && (c.item === 'shield' || (tg && bd < 350)) && Math.random() < 0.05) o.jumpP = true;
      for (const oil of OILS) if (Math.hypot(oil.x - c.x, oil.y - c.y) < 70) { const n = c.h + Math.PI / 2; o.mx = o.mx * 0.5 + Math.cos(n) * 0.5; o.my = o.my * 0.5 + Math.sin(n) * 0.5; }
      return o;
    }
    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) { const c = this.cars[i]; return { x: c.x, y: c.y }; }

    botInput(i) {
      const c = this.cars[i];
      const o = { mx: 0, my: 0, actP: false };
      if (this.balloon) return this.balloonBot(c, i);
      const look = (c.si + 10) % NS;
      let tx = S[look][0], ty = S[look][1];
      // né vũng dầu nằm trên đoạn đường sắp tới
      for (const oil of OILS) {
        for (let k = 2; k <= 22; k += 2) {
          const j = (c.si + k) % NS;
          if (Math.hypot(oil.x - S[j][0], oil.y - S[j][1]) < 45) {
            const n = ANG[j] + Math.PI / 2;
            const side = ((oil.x - S[j][0]) * Math.cos(n) + (oil.y - S[j][1]) * Math.sin(n)) > 0 ? -1 : 1;
            tx = S[j][0] + Math.cos(n) * side * 42; ty = S[j][1] + Math.sin(n) * side * 42;
            break;
          }
        }
      }
      const a = Math.atan2(ty - c.y, tx - c.x);
      o.mx = Math.cos(a); o.my = Math.sin(a);
      const straight = Math.abs(U.angDiff(ANG[c.si], ANG[(c.si + 30) % NS])) < 0.35;
      if (straight && c.boostCd <= 0 && Math.random() < 0.04) o.actP = true;
      // vật phẩm
      if (c.item && c.spin <= 0) {
        const me = this.progress(c);
        const behind = this.cars.some((x, j) => j !== i && me - this.progress(x) > 0 && me - this.progress(x) < 140);
        const ahead = this.cars.some((x, j) => j !== i && !x.done && this.progress(x) - me > 0 && this.progress(x) - me < L * 0.3);
        if ((c.item === 'shield') || (c.item === 'banana' && behind) || (c.item === 'rocket' && ahead)) { if (Math.random() < 0.05) o.jumpP = true; }
        else if (Math.random() < 0.003) o.jumpP = true;
      }
      // tránh chuối ngay phía trước
      for (const bn of this.bananas) {
        const dx = bn.x - c.x, dy = bn.y - c.y, d = Math.hypot(dx, dy);
        if (d < 120 && Math.abs(U.angDiff(c.h, Math.atan2(dy, dx))) < 0.5) {
          const n = c.h + Math.PI / 2 * (U.angDiff(c.h, Math.atan2(dy, dx)) > 0 ? -1 : 1);
          o.mx = o.mx * 0.4 + Math.cos(n) * 0.6; o.my = o.my * 0.4 + Math.sin(n) * 0.6;
          break;
        }
      }
      return o;
    }
  }

  Party.register({
    id: 'race', name: 'Đua Xe', emoji: '🏎️',
    tagline: 'Đua nhiều vòng, né vũng dầu · về đích trước là thắng',
    how: 'Xe tự chạy — bấm hướng bạn muốn xe đi tới. Ra khỏi đường là chậm, đi vào vũng dầu là xoay vòng. Nút Đánh để tăng tốc (hồi 3 giây). Chạy qua hộp ? để nhận 🍌 chuối (thả phía sau), 🚀 tên lửa (đuổi xe phía trước) hoặc 🛡️ khiên — CHẠM nút Nhảy để dùng. GIỮ nút Nhảy khi ôm cua để drift, tia lửa xanh/cam thì nhả ra được tăng tốc.',
    controls: { move: 'Hướng muốn chạy', act: 'Tăng tốc', jump: 'Chạm: vật phẩm · Giữ: drift' },
    modes: MODES,
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Race(api),
  });
})();

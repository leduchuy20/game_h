'use strict';
/* Trốn Đèn — đèn rọi quét khắp phòng tối. Đứng trong vùng sáng quá lâu là bị phát hiện, mất 1 tim. */
(() => {
  const AX = 50, AY = 90, AW = W - 100, AH = H - 90 - 20;
  const GAME_TIME = 60, EXPOSE = 0.35;
  const MODES = [
    { id: 'lights', name: 'Đèn tự quét', desc: 'Đèn rọi tự đi tuần, bám theo người. Còn nhiều tim nhất là thắng.' },
    { id: 'hunter', name: 'Người cầm đèn', desc: 'Mỗi lượt một người cầm đèn rọi (cần gạt di chuyển đèn, nút Đánh để loé sáng), những người khác trốn trong bóng tối. Bắt được 1 người +2 điểm, trốn hết lượt +3 điểm. Ai cũng được cầm đèn một lần.' },
  ];
  const HUNT_SPEED = 200, FLASH_CD = 4, HUNT_EXPOSE = 0.55;

  class Spotlight {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.elapsed = 0; this.finished = false;
      this.lights = []; this.addT = 0;
      // lưới ô để đèn đi tuần đều khắp phòng (ưu tiên ô lâu chưa được rọi, kể cả góc & sát tường)
      this.GX = 6; this.GY = 4;
      this.seen = new Array(this.GX * this.GY).fill(0).map(() => -U.rand(0, 3));
      for (let k = 0; k < 2 + Math.floor(this.n / 2); k++) this.addLight(false);
      const pos = [[AX + 90, AY + 90], [AX + AW - 90, AY + AH - 90], [AX + AW - 90, AY + 90], [AX + 90, AY + AH - 90]];
      this.ps = this.P.map((p, i) => ({ x: pos[i][0], y: pos[i][1], vx: 0, vy: 0, r: 22, face: 0, walk: 0,
        hearts: 3, out: false, outTime: 0, inv: 1, expo: 0, skip: false }));
      this.dark = document.createElement('canvas'); this.dark.width = W; this.dark.height = H;
      this.dctx = this.dark.getContext('2d');
      this.hunt = api.mode === 'hunter';
      if (this.hunt) {
        this.round = -1; this.roundT = api.T(20); this.order = U.shuffle(this.P.map((_, i) => i)); this.pause = 0;
        this.ps.forEach((p) => { p.pts = 0; });
        this.nextRound();
      }
    }
    /** SPT2: sang lượt mới — người tiếp theo cầm đèn */
    nextRound() {
      this.round++;
      if (this.round >= this.order.length) { this.finished = true; return; }
      this.hunter = this.order[this.round];
      this.time = this.total = this.roundT; this.elapsed = 0; this.pause = 2; this.phase = 'pre';
      this.seen = this.seen.map(() => -U.rand(0, 3));
      this.lights = [{ x: W / 2, y: AY + AH / 2, tx: 0, ty: 0, r: 100, sp: HUNT_SPEED, seeker: true, hunter: true, born: 0, flashT: 0, flashCd: 0 }];
      if (this.n >= 3) this.addLight(false);
      const corners = [[AX + 70, AY + 70], [AX + AW - 70, AY + AH - 70], [AX + AW - 70, AY + 70], [AX + 70, AY + AH - 70]];
      let k = 0;
      this.ps.forEach((p, i) => {
        p.caught = false; p.expo = 0; p.inv = 0; p.vx = p.vy = 0;
        if (i === this.hunter) { p.out = true; return; }
        p.out = false; [p.x, p.y] = corners[k++ % 4];
      });
      this.bannerT = 0;
    }
    updateHunt(dt, inp) {
      const parts = this.api.parts;
      this.bannerT += dt;
      // phase: pre (đếm ngược, đèn chưa bật, người trốn chạy đi) → play → post (tổng kết lượt)
      if (this.phase === 'post') { this.pause -= dt; if (this.pause <= 0) this.nextRound(); return; }
      if (this.phase === 'pre') { this.pause -= dt; if (this.pause <= 0) { this.phase = 'play'; this.lights[0].born = 0; } }
      const L = this.lights[0], q = inp[this.hunter];
      if (this.phase === 'play') {
        this.time -= dt; this.elapsed += dt;
        L.born += dt;
        L.x = U.clamp(L.x + q.mx * HUNT_SPEED * dt, AX, AX + AW); L.y = U.clamp(L.y + q.my * HUNT_SPEED * dt, AY, AY + AH);
        L.flashCd -= dt; L.flashT -= dt;
        if (q.actP && L.flashCd <= 0) { L.flashT = 0.4; L.flashCd = FLASH_CD; Sfx.play('warn'); }
        L.r = L.flashT > 0 ? 125 : 85;
      }
      const cw = AW / this.GX, ch = AH / this.GY;
      for (let k = 0; k < this.seen.length; k++) {
        const x = AX + (k % this.GX + 0.5) * cw, y = AY + (Math.floor(k / this.GX) + 0.5) * ch;
        if (Math.hypot(L.x - x, L.y - y) < L.r) this.seen[k] = this.elapsed;
      }
      // đèn tuần phụ (từ 3 người)
      for (const l of this.lights) {
        if (l.hunter) continue;
        l.born += dt;
        const dx = l.tx - l.x, dy = l.ty - l.y, d = Math.hypot(dx, dy);
        if (d < 10) { [l.tx, l.ty] = this.rp(); continue; }
        const step = Math.min(d, l.sp * 0.6 * dt); l.x += dx / d * step; l.y += dy / d * step;
      }
      this.ps.forEach((p, i) => {
        if (p.out) return;
        const q = inp[i];
        if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        const k = Math.min(1, dt * 12), sneak = q.jump ? 0.5 : 1;
        p.vx += (q.mx * 250 * sneak - p.vx) * k; p.vy += (q.my * 250 * sneak - p.vy) * k;
        p.x = U.clamp(p.x + p.vx * dt, AX + p.r, AX + AW - p.r); p.y = U.clamp(p.y + p.vy * dt, AY + p.r, AY + AH - p.r);
        // chạy nhanh trong bóng tối thì để lại bụi — đi rón rén (giữ Nhảy) thì không
        p.noisy = sneak === 1 && Math.hypot(p.vx, p.vy) > 180;
        if (p.noisy) { p.heard = 1; if (Math.random() < dt * 6) parts.burst(p.x, p.y + p.r * 0.8, 'rgba(200,190,255,0.6)', 1, 30, 0.6, 4); }
        else p.heard = Math.max(0, (p.heard || 0) - dt);
        const lit = this.lights.some((l) => l.born > 0.8 && Math.hypot(l.x - p.x, l.y - p.y) < l.r);
        p.lit = lit;
        if (this.phase !== 'play') return;
        p.expo = lit ? p.expo + dt : Math.max(0, p.expo - dt * 2);
        if (p.expo >= HUNT_EXPOSE) {
          p.out = p.caught = true; p.expo = 0; this.ps[this.hunter].pts += 2;
          Sfx.play('hurt'); FX.shake(5); Party.rumble(i);
          parts.text(p.x, p.y - 40, `${this.P[this.hunter].name} bắt được!`, this.P[this.hunter].color.light, 26);
        }
      });
      this.ps.forEach((p) => { p.skip = p.out; });
      Phys.separate(this.ps, 0.5);
      const left = this.ps.filter((p) => !p.out);
      if (this.phase === 'play' && (this.time <= 0 || left.length === 0)) {
        this.time = Math.max(0, this.time);
        left.forEach((p) => { p.pts += 3; parts.text(p.x, p.y - 40, 'Trốn thành công +3', '#7dff9a', 24); });
        Sfx.play(left.length ? 'win' : 'crown');
        this.pause = 2.2; this.bannerT = 0; this.phase = 'post';
      }
    }

    cellOf(x, y) {
      const cx = U.clamp(Math.floor((x - AX) / (AW / this.GX)), 0, this.GX - 1);
      const cy = U.clamp(Math.floor((y - AY) / (AH / this.GY)), 0, this.GY - 1);
      return cy * this.GX + cx;
    }
    // chọn điểm đến: ô lâu nhất chưa có đèn rọi (và chưa có đèn khác đang nhắm tới)
    rp() {
      const now = this.elapsed || 0, taken = new Set((this.lights || []).map((l) => this.cellOf(l.tx, l.ty)));
      let best = 0, bs = -Infinity;
      for (let k = 0; k < this.seen.length; k++) {
        const sc = (now - this.seen[k]) + Math.random() * 1.5 - (taken.has(k) ? 100 : 0);
        if (sc > bs) { bs = sc; best = k; }
      }
      this.seen[best] = now + 1; // coi như đã có đèn sắp tới
      const cw = AW / this.GX, ch = AH / this.GY, cx = best % this.GX, cy = Math.floor(best / this.GX);
      // ô ở rìa thì cho tâm đèn đi sát hẳn vào tường để phủ cả góc
      const fx = cx === 0 ? U.rand(0, 0.4) : cx === this.GX - 1 ? U.rand(0.6, 1) : U.rand(0.15, 0.85);
      const fy = cy === 0 ? U.rand(0, 0.4) : cy === this.GY - 1 ? U.rand(0.6, 1) : U.rand(0.15, 0.85);
      return [U.clamp(AX + (cx + fx) * cw, AX + 15, AX + AW - 15), U.clamp(AY + (cy + fy) * ch, AY + 15, AY + AH - 15)];
    }
    addLight(seeker) {
      const [x, y] = this.rp(), [tx, ty] = this.rp();
      this.lights.push({ x, y, tx, ty, r: U.rand(80, 110), sp: U.rand(120, 190) * (seeker ? 0.75 : 1), seeker, born: 0 });
    }

    update(dt, inp) {
      if (this.hunt) { if (!this.finished) this.updateHunt(dt, inp); return; }
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt; this.elapsed += dt;
        if (this.time <= 0) { this.time = 0; this.finished = true; }
        // càng về sau càng nhiều đèn (đèn mới thứ 2 trở đi là đèn bám theo người)
        this.addT += dt;
        if (this.addT >= this.total / 5 && this.lights.length < 7) {
          this.addT = 0; this.addLight(this.lights.length % 2 === 1);
          Sfx.play('warn'); parts.text(W / 2, AY + 30, '+1 đèn rọi!', '#ffe14d', 28);
        }
      }
      const speedUp = 1 + this.elapsed / Math.max(30, this.total) * 0.5;
      const cw = AW / this.GX, ch = AH / this.GY;
      for (let k = 0; k < this.seen.length; k++) {
        const x = AX + (k % this.GX + 0.5) * cw, y = AY + (Math.floor(k / this.GX) + 0.5) * ch;
        if (this.lights.some((l) => Math.hypot(l.x - x, l.y - y) < l.r * 0.8)) this.seen[k] = this.elapsed;
      }
      for (const l of this.lights) {
        l.born += dt;
        let tx = l.tx, ty = l.ty;
        if (l.seeker) {
          let best = null, bd = Infinity;
          for (const p of this.ps) { if (p.out) continue; const d = Math.hypot(p.x - l.x, p.y - l.y); if (d < bd) { bd = d; best = p; } }
          if (best) { tx = best.x; ty = best.y; }
        }
        const dx = tx - l.x, dy = ty - l.y, d = Math.hypot(dx, dy);
        if (d < 10 && !l.seeker) { [l.tx, l.ty] = this.rp(); continue; }
        const step = Math.min(d, l.sp * speedUp * dt);
        l.x += dx / (d || 1) * step; l.y += dy / (d || 1) * step;
      }
      this.ps.forEach((p, i) => {
        if (p.out) return;
        const q = inp[i];
        p.inv -= dt;
        if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        const k = Math.min(1, dt * 12);
        p.vx += (q.mx * 250 - p.vx) * k; p.vy += (q.my * 250 - p.vy) * k;
        p.x = U.clamp(p.x + p.vx * dt, AX + p.r, AX + AW - p.r); p.y = U.clamp(p.y + p.vy * dt, AY + p.r, AY + AH - p.r);
        const lit = this.lights.some((l) => l.born > 0.8 && Math.hypot(l.x - p.x, l.y - p.y) < l.r);
        p.lit = lit;
        if (this.finished || p.inv > 0) { p.expo = 0; return; }
        p.expo = lit ? p.expo + dt : Math.max(0, p.expo - dt * 2);
        if (p.expo >= EXPOSE) {
          p.expo = 0; p.hearts--; p.inv = 1.6;
          Sfx.play('hurt'); FX.shake(5); Party.rumble(i);
          parts.text(p.x, p.y - 40, p.hearts > 0 ? 'Bị phát hiện! −1 ♥' : 'Bị loại!', '#ffe14d', 26);
          if (p.hearts <= 0) { p.out = true; p.outTime = this.elapsed; }
        }
      });
      this.ps.forEach((p) => { p.skip = p.out; });
      Phys.separate(this.ps, 0.5);
      if (!this.finished && this.n >= 2 && this.ps.filter((p) => !p.out).length <= 1) this.finished = true;
    }

    draw(ctx) {
      const t = U.now();
      ctx.fillStyle = '#1a1530'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#3a3358'; ctx.fillRect(AX, AY, AW, AH);
      ctx.fillStyle = '#433b66';
      for (let x = AX; x < AX + AW; x += 60) for (let y = AY; y < AY + AH; y += 60) if (((x - AX) / 60 + (y - AY) / 60) % 2 === 0) ctx.fillRect(x, y, 60, 60);
      // bóng tối với các lỗ sáng
      const d = this.dctx;
      d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H);
      d.fillStyle = 'rgba(4,3,14,0.82)'; d.fillRect(0, 0, W, H);
      d.globalCompositeOperation = 'destination-out';
      for (const l of this.lights) {
        const a = Math.min(1, l.born / 0.8);
        const g = d.createRadialGradient(l.x, l.y, l.r * 0.3, l.x, l.y, l.r);
        g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = g; d.beginPath(); d.arc(l.x, l.y, l.r * 1.05, 0, TAU); d.fill();
      }
      ctx.drawImage(this.dark, 0, 0);
      for (const l of this.lights) {
        const warm = l.born < 0.8;
        if (l.hunter) {
          const c = this.P[this.hunter].color;
          ctx.strokeStyle = c.light; ctx.lineWidth = l.flashT > 0 ? 6 : 3; ctx.setLineDash(warm ? [6, 8] : []);
          ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = c.main + '22'; ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, TAU); ctx.fill();
          Draw.text(ctx, '🔦 ' + this.P[this.hunter].name, l.x, Math.max(AY + 12, l.y - l.r - 14), { size: 16, color: c.light, sw: 3 });
          continue;
        }
        ctx.strokeStyle = l.seeker ? 'rgba(255,90,110,0.8)' : `rgba(255,230,120,${warm ? 0.3 + 0.3 * Math.sin(t * 20) : 0.7})`;
        ctx.lineWidth = 3; ctx.setLineDash(warm ? [6, 8] : []);
        ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = l.seeker ? 'rgba(255,90,110,0.08)' : 'rgba(255,240,170,0.08)';
        ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, TAU); ctx.fill();
      }
      const order = this.ps.map((_, i) => i).filter((i) => !this.ps[i].out).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        const blink = p.inv > 0 && Math.sin(t * 30) > 0;
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk, shadow: !this.hunt || p.lit,
          alpha: blink ? 0.4 : p.lit ? 1 : this.hunt ? (p.noisy ? 0.3 : 0.14) : 0.8 });
        if (p.expo > 0) {
          ctx.strokeStyle = '#ff3b52'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * p.expo / (this.hunt ? HUNT_EXPOSE : EXPOSE)); ctx.stroke();
        }
      }
      if (this.hunt) {
        Draw.chips(ctx, this.P, this.ps.map((p, i) => (i === this.hunter ? '🔦 ' : p.caught ? '👀 ' : '') + p.pts + ' đ'), { dim: this.ps.map((p) => p.caught) });
        Draw.timer(ctx, this.time, W - 72, 38);
        if (this.phase !== 'play' && this.round < this.order.length) {
          const pre = this.phase === 'pre', c = this.P[this.hunter].color;
          ctx.fillStyle = 'rgba(10,8,25,0.6)'; ctx.fillRect(0, H / 2 - 60, W, 120);
          Draw.text(ctx, pre ? `Lượt ${this.round + 1}/${this.order.length}: ${this.P[this.hunter].name} cầm đèn!` : 'Hết lượt!', W / 2, H / 2 - 10, { size: 40, color: pre ? c.light : '#fff', sw: 6 });
          Draw.text(ctx, pre ? 'Những người khác mau trốn vào bóng tối… (giữ Nhảy để đi rón rén)' : `Bắt được ${this.ps.filter((p) => p.caught).length} người`, W / 2, H / 2 + 34, { size: 20, sw: 3 });
        }
      } else {
        Draw.chips(ctx, this.P, this.ps.map((p) => (p.out ? 'Loại' : '♥'.repeat(p.hearts))), { dim: this.ps.map((p) => p.out) });
        Draw.timer(ctx, this.time, W - 72, 38);
      }
    }

    results() {
      if (this.hunt) return this.ps.map((p) => ({ score: p.pts, text: `${p.pts} điểm` }));
      return this.ps.map((p) => (p.out
        ? { score: p.outTime, text: `Bị loại ở giây ${Math.floor(p.outTime)}` }
        : { score: 1000 + p.hearts * 100, text: `Còn ${p.hearts} ♥` }));
    }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0 };
      if (this.hunt && i === this.hunter) return this.hunterBot();
      if (p.out) return o;
      if (this.hunt) return this.hideBot(p);
      const danger = (x, y) => {
        let c = 0;
        for (const l of this.lights) {
          const dx = (l.seeker ? 0 : (l.tx - l.x)), dy = (l.seeker ? 0 : (l.ty - l.y)), dl = Math.hypot(dx, dy) || 1;
          const fx = l.x + dx / dl * Math.min(dl, l.sp * 0.4), fy = l.y + dy / dl * Math.min(dl, l.sp * 0.4);
          for (const [lx, ly] of [[l.x, l.y], [fx, fy]]) c += Math.max(0, l.r + 34 - Math.hypot(lx - x, ly - y));
        }
        if (this.hunt) {
          // người trốn: tránh xa đèn của người cầm đèn, không chui vào góc (dễ bị dồn)
          const L = this.lights[0];
          c += Math.max(0, 460 - Math.hypot(L.x - x, L.y - y)) * 0.5;
          const ex = Math.min(x - AX, AX + AW - x), ey = Math.min(y - AY, AY + AH - y);
          c += Math.max(0, 140 - ex) * 0.4 + Math.max(0, 140 - ey) * 0.4;
        }
        const m = 50;
        if (x < AX + m) c += (AX + m - x); if (x > AX + AW - m) c += (x - AX - AW + m);
        if (y < AY + m) c += (AY + m - y); if (y > AY + AH - m) c += (y - AY - AH + m);
        return c;
      };
      let best = [0, 0], bc = danger(p.x, p.y) - 2;
      for (let k = 0; k < 12; k++) {
        const a = k * TAU / 12, nx = p.x + Math.cos(a) * 70, ny = p.y + Math.sin(a) * 70;
        const c = danger(nx, ny);
        if (c < bc) { bc = c; best = [Math.cos(a), Math.sin(a)]; }
      }
      o.mx = best[0]; o.my = best[1];
      return o;
    }
  }

  /** SPT2: người trốn (máy) chọn chỗ xa đèn nhất mà đường đi không cắt qua đèn */
  Spotlight.prototype.hideBot = function (p) {
    const L = this.lights[0], o = { mx: 0, my: 0, jump: false };
    const segD = (ax, ay, bx, by, px, py) => {
      const vx = bx - ax, vy = by - ay, t = U.clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
      return Math.hypot(ax + vx * t - px, ay + vy * t - py);
    };
    let best = null, bs = -Infinity;
    for (let gx = 0; gx < 7; gx++) for (let gy = 0; gy < 4; gy++) {
      const x = AX + 110 + gx * (AW - 220) / 6, y = AY + 100 + gy * (AH - 200) / 3;
      let sc = Math.min(520, Math.hypot(x - L.x, y - L.y)) - Math.hypot(x - p.x, y - p.y) * 0.25;
      if (segD(p.x, p.y, x, y, L.x, L.y) < L.r + 70) sc -= 2000;
      for (const q of this.ps) if (q !== p && !q.out && Math.hypot(q.x - x, q.y - y) < 120) sc -= 80; // tản ra, đừng tụm
      if (p.goal && Math.hypot(p.goal[0] - x, p.goal[1] - y) < 5) sc += 40; // giữ đích cũ cho đỡ lắc
      if (sc > bs) { bs = sc; best = [x, y]; }
    }
    p.goal = best;
    const dl = Math.hypot(L.x - p.x, L.y - p.y);
    if (bs < -1000) {
      // bị dồn: chạy ra xa đèn, lệch sang phía còn trống
      const a = Math.atan2(p.y - L.y, p.x - L.x);
      const side = Math.hypot(W / 2 - (p.x + Math.cos(a + 1.2) * 100), H / 2 - (p.y + Math.sin(a + 1.2) * 100)) < Math.hypot(W / 2 - (p.x + Math.cos(a - 1.2) * 100), H / 2 - (p.y + Math.sin(a - 1.2) * 100)) ? 1.2 : -1.2;
      o.mx = Math.cos(a + side); o.my = Math.sin(a + side);
      return o;
    }
    const dx = best[0] - p.x, dy = best[1] - p.y, d = Math.hypot(dx, dy);
    if (d > 20) { o.mx = dx / d; o.my = dy / d; }
    // lúc đèn ở xa thì đi rón rén cho khỏi để lại bụi
    if (dl > 450 && this.phase === 'play') o.jump = true;
    // tránh thêm đèn tuần phụ
    for (const l of this.lights) if (!l.hunter && Math.hypot(l.x - p.x, l.y - p.y) < l.r + 40) {
      const a = Math.atan2(p.y - l.y, p.x - l.x); o.mx = o.mx * 0.4 + Math.cos(a) * 0.6; o.my = o.my * 0.4 + Math.sin(a) * 0.6;
    }
    return o;
  };
  Spotlight.prototype.hunterBot = function () {
    const o = { mx: 0, my: 0, actP: false }, L = this.lights[0];
    let tg = null, bd = Infinity;
    // máy cầm đèn chỉ "thấy" người đang bị rọi, ở sát đèn, hoặc vừa chạy ồn (để lại bụi)
    for (const p of this.ps) {
      if (p.out) continue;
      const d = Math.hypot(p.x - L.x, p.y - L.y);
      if (!(p.lit || p.heard > 0 || d < L.r + 70)) continue;
      if (d < bd) { bd = d; tg = p; }
    }
    if (!tg) {
      // đi tuần tìm: đến ô lâu chưa rọi
      if (!L.search || Math.hypot(L.search[0] - L.x, L.search[1] - L.y) < 30) L.search = this.rp();
      const dx = L.search[0] - L.x, dy = L.search[1] - L.y, d = Math.hypot(dx, dy) || 1;
      o.mx = dx / d; o.my = dy / d;
      return o;
    }
    L.search = null;
    const tx = tg.x + tg.vx * 0.25, ty = tg.y + tg.vy * 0.25, d = Math.hypot(tx - L.x, ty - L.y);
    if (d > 8) { o.mx = (tx - L.x) / d; o.my = (ty - L.y) / d; }
    if (bd > 85 && bd < 120 && L.flashCd <= 0) o.actP = true;
    return o;
  };

  Party.register({
    id: 'spotlight', name: 'Trốn Đèn', emoji: '🔦', cat: 'dodge',
    tagline: 'Lẩn trong bóng tối, tránh đèn rọi · nhiều tim nhất là thắng',
    how: 'Đèn rọi quét khắp phòng. Đứng trong vùng sáng quá lâu (vòng đỏ đầy) là bị phát hiện, mất 1 tim. Đèn viền đỏ sẽ bám theo người! Càng về sau càng nhiều đèn.',
    controls: { move: 'Chạy / di chuyển đèn', act: 'Loé đèn (người cầm đèn)', jump: 'Giữ: đi rón rén' },
    modes: MODES,
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Spotlight(api),
  });
})();

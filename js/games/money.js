'use strict';
/* Chuyển Tiền — băng qua đường xe chạy lên kho lấy túi tiền, mang về ngân hàng. Bị xe đụng là rơi tiền. */
(() => {
  const VAULT_Y1 = 150, BANK_Y0 = H - 110;
  const LANES = 6, LANE_H = (BANK_Y0 - VAULT_Y1) / LANES;
  const GAME_TIME = 60;
  const CAR_COLORS = ['#e8384f', '#3d9bff', '#ffbf2e', '#34cc78', '#9b5cff', '#ff8a2e', '#f2f2f2'];

  class Money {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.elapsed = 0; this.finished = false;
      this.lanes = Array.from({ length: LANES }, (_, k) => ({
        y: VAULT_Y1 + LANE_H * (k + 0.5), dir: k % 2 ? 1 : -1, speed: U.rand(100, 190) + k * 8, gap: U.rand(1.9, 3.0), t: U.rand(0, 1),
      }));
      this.cars = [];
      for (const l of this.lanes) {
        for (let x = U.rand(0, 200); x < W; x += U.rand(360, 560)) this.cars.push(this.makeCar(l, x));
      }
      this.ps = this.P.map((p, i) => ({ x: W * (i + 1) / (this.n + 1), y: BANK_Y0 + 50, vx: 0, vy: 0, r: 18, face: -Math.PI / 2,
        walk: 0, carry: false, money: 0, hitT: 0, inv: 0, skip: false }));
    }

    makeCar(l, x) {
      const truck = Math.random() < 0.25;
      return { lane: l, x, w: truck ? 130 : 78, h: LANE_H - 18, col: U.pick(CAR_COLORS), truck };
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) { this.time -= dt; this.elapsed += dt; if (this.time <= 0) { this.time = 0; this.finished = true; } }
      const boost = 1 + this.elapsed * 0.006;
      for (const l of this.lanes) {
        l.t -= dt;
        if (l.t <= 0) { l.t = l.gap * U.rand(0.8, 1.4) / boost; this.cars.push(this.makeCar(l, l.dir > 0 ? -140 : W + 140)); }
      }
      for (const c of this.cars) c.x += c.lane.dir * c.lane.speed * boost * dt;
      this.cars = this.cars.filter((c) => c.x > -200 && c.x < W + 200);

      this.ps.forEach((p, i) => {
        const q = inp[i];
        p.hitT -= dt; p.inv -= dt;
        if (p.hitT > 0) return;
        if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        const sp = p.carry ? 190 : 230, k = Math.min(1, dt * 14);
        p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        p.x = U.clamp(p.x + p.vx * dt, 30, W - 30); p.y = U.clamp(p.y + p.vy * dt, 96, H - 30);
        if (this.finished) return;
        if (!p.carry && p.y < VAULT_Y1 - 4) { p.carry = true; Sfx.play('pickup'); parts.text(p.x, p.y - 30, '💰', '#fff', 30); }
        if (p.carry && p.y > BANK_Y0 + 4) {
          p.carry = false; p.money += 100;
          Sfx.play('crown');
          parts.text(p.x, p.y - 34, '+100', '#5dff9b', 28);
          parts.burst(p.x, p.y, ['#ffe14d', '#5dff9b'], 12, 200, 0.6, 5);
        }
        if (p.inv > 0) return;
        for (const c of this.cars) {
          if (Math.abs(p.x - c.x) < c.w / 2 + p.r - 6 && Math.abs(p.y - c.lane.y) < c.h / 2 + p.r - 14) {
            p.hitT = 0.9; p.inv = 2;
            p.vy = 0; p.vx = c.lane.dir * 200;
            Sfx.play('crash'); FX.shake(6);
            parts.burst(p.x, p.y, ['#fff', this.P[i].color.main], 14, 220, 0.5, 5);
            if (p.carry) { p.carry = false; parts.text(p.x, p.y - 30, 'Rơi tiền!', '#ff8fa8', 26); }
            // bị đẩy về lề gần nhất
            p.y = p.y < (VAULT_Y1 + BANK_Y0) / 2 ? VAULT_Y1 - 30 : BANK_Y0 + 30;
            break;
          }
        }
      });
      this.ps.forEach((p) => { p.skip = p.hitT > 0; });
      Phys.separate(this.ps, 0.3);
    }

    drawCar(ctx, c) {
      const x = c.x, y = c.lane.y, d = c.lane.dir;
      ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; Draw.rr(ctx, -c.w / 2 + 4, -c.h / 2 + 6, c.w, c.h, 10); ctx.fill();
      ctx.fillStyle = '#222';
      for (const wx of [-c.w / 2 + 16, c.w / 2 - 16]) { ctx.fillRect(wx - 9, -c.h / 2 - 3, 18, 6); ctx.fillRect(wx - 9, c.h / 2 - 3, 18, 6); }
      ctx.fillStyle = c.col; Draw.rr(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 10); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
      ctx.fillStyle = 'rgba(160,220,255,0.9)';
      if (c.truck) { Draw.rr(ctx, c.w / 2 - 34, -c.h / 2 + 5, 22, c.h - 10, 4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-c.w / 2 + 8, -c.h / 2 + 6, c.w - 52, c.h - 12); }
      else { Draw.rr(ctx, 6, -c.h / 2 + 5, 18, c.h - 10, 4); ctx.fill(); Draw.rr(ctx, -c.w / 2 + 10, -c.h / 2 + 7, 12, c.h - 14, 3); ctx.fill(); }
      ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(c.w / 2 - 3, -c.h / 2 + 7, 4, 0, TAU); ctx.arc(c.w / 2 - 3, c.h / 2 - 7, 4, 0, TAU); ctx.fill();
      ctx.restore();
    }

    draw(ctx) {
      // kho (trên) & ngân hàng (dưới)
      ctx.fillStyle = '#7a5bb0'; ctx.fillRect(0, 76, W, VAULT_Y1 - 76);
      ctx.fillStyle = '#8f6fc8'; for (let x = 0; x < W; x += 60) ctx.fillRect(x, 76, 30, VAULT_Y1 - 76);
      Draw.text(ctx, '🏦 KHO TIỀN — đi vào để lấy 💰', W / 2, (76 + VAULT_Y1) / 2, { size: 26, color: '#ffe14d' });
      ctx.fillStyle = '#3e8a4a'; ctx.fillRect(0, BANK_Y0, W, H - BANK_Y0);
      ctx.fillStyle = '#4c9c58'; for (let x = 0; x < W; x += 60) ctx.fillRect(x, BANK_Y0, 30, H - BANK_Y0);
      Draw.text(ctx, '💵 NGÂN HÀNG — mang tiền về đây', W / 2, BANK_Y0 + 82, { size: 24, color: '#d8ffd8' });
      // đường
      ctx.fillStyle = '#44475a'; ctx.fillRect(0, VAULT_Y1, W, BANK_Y0 - VAULT_Y1);
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, VAULT_Y1 - 4, W, 4); ctx.fillRect(0, BANK_Y0, W, 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([30, 26]);
      for (let k = 1; k < LANES; k++) { const y = VAULT_Y1 + k * LANE_H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.setLineDash([]);
      for (const c of this.cars) this.drawCar(ctx, c);
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        const blink = p.inv > 0 && Math.sin(U.now() * 30) > 0;
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk, stun: p.hitT > 0, alpha: blink ? 0.45 : 1 });
        if (p.carry) Draw.text(ctx, '💰', p.x + 12, p.y - 26, { size: 24, stroke: null });
      }
      const lead = this.ps.reduce((bi, p, i, a) => (p.money > a[bi].money ? i : bi), 0);
      Draw.chips(ctx, this.P, this.ps.map((p) => `$${p.money}`), { crown: this.ps[lead].money > 0 ? lead : -1 });
      Draw.timer(ctx, this.time, W - 72, 38);
    }

    results() { return this.ps.map((p) => ({ score: p.money, text: `$${p.money}` })); }

    laneOf(y) { const k = Math.floor((y - VAULT_Y1) / LANE_H); return k >= 0 && k < LANES ? k : -1; }

    safeLane(k, x, t0, t1) {
      if (k < 0 || k >= LANES) return true;
      const l = this.lanes[k], v = l.dir * l.speed * (1 + this.elapsed * 0.006);
      for (const c of this.cars) {
        if (c.lane !== l) continue;
        for (let t = t0; t <= t1 + 1e-6; t += 0.1) if (Math.abs(c.x + v * t - x) < c.w / 2 + 24) return false;
      }
      return true;
    }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0 };
      if (p.hitT > 0) return o;
      const dir = p.carry ? 1 : -1;
      const sp = p.carry ? 190 : 230;
      // đã tới vùng an toàn bên kia thì đi sâu vào để lấy / gửi tiền
      if (!p.carry && p.y < VAULT_Y1) { o.my = -1; return o; }
      if (p.carry && p.y > BANK_Y0) { o.my = 1; return o; }
      const cur = this.laneOf(p.y);
      const nextY = cur < 0 ? (dir < 0 ? BANK_Y0 - LANE_H / 2 : VAULT_Y1 + LANE_H / 2) : VAULT_Y1 + LANE_H * (cur + dir + 0.5);
      const nextK = this.laneOf(nextY);
      const tArrive = Math.abs(nextY - p.y) / sp;
      const okNext = this.safeLane(nextK, p.x, 0, tArrive + 0.18);
      const okHere = this.safeLane(cur, p.x, 0, 0.35);
      if (okNext) o.my = dir;
      else if (okHere) {
        // làn trước mặt đang có xe: đi ngang tìm chỗ trống
        for (const off of [90, -90, 180, -180]) {
          const x = p.x + off;
          if (x < 40 || x > W - 40) continue;
          const tSide = Math.abs(off) / sp;
          if (this.safeLane(cur, x, 0, tSide + 0.2) && this.safeLane(nextK, x, tSide, tSide + tArrive + 0.18)) { o.mx = Math.sign(off); break; }
        }
      } else {
        // đang nguy hiểm mà không đi tiếp được → lùi lại hoặc né ngang
        const back = this.laneOf(p.y - dir * LANE_H);
        if (this.safeLane(back, p.x, 0, 0.5)) o.my = -dir;
        else o.mx = this.cars.some((c) => c.lane === this.lanes[cur] && c.x < p.x) ? 1 : -1;
      }
      return o;
    }
  }

  Party.register({
    id: 'money', name: 'Chuyển Tiền', emoji: '💰', cat: 'collect',
    tagline: 'Băng qua đường lấy túi tiền về ngân hàng · nhiều tiền nhất là thắng',
    how: 'Đi lên kho tiền phía trên để lấy 💰, rồi băng qua đường mang về ngân hàng phía dưới (+$100). Bị xe đụng là rơi mất túi tiền! Xe chạy nhanh dần.',
    controls: { move: 'Đi lại / băng qua đường' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Money(api),
  });
})();

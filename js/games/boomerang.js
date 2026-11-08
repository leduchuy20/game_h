'use strict';
/* Vua Boomerang (NEW2) — giữ Đánh rồi thả để ném boomerang: bay ra, vòng về tay. Vướng tường thì rơi, phải chạy nhặt.
   Nhảy = lướt chém gần. Bụi cỏ để nấp (đứng trong bụi gần như vô hình). 3 tim, còn người cuối cùng hoặc nhiều tim nhất thắng. */
(() => {
  const AX = 50, AY = 84, AW = W - 100, AH = H - 84 - 24;
  const CX = AX + AW / 2, CY = AY + AH / 2;
  const GAME_TIME = 75, HEARTS = 5, TAP = 0.12, CHARGE = 0.55;
  const OBS = [
    { x: CX - 40, y: CY - 120, w: 80, h: 80 }, { x: CX - 40, y: CY + 40, w: 80, h: 80 },
    { x: AX + 230, y: CY - 30, w: 120, h: 60 }, { x: AX + AW - 350, y: CY - 30, w: 120, h: 60 },
  ];
  const BUSH = [
    { x: AX + 150, y: AY + 40, w: 170, h: 100 }, { x: AX + AW - 320, y: AY + AH - 140, w: 170, h: 100 },
    { x: AX + AW - 320, y: AY + 40, w: 170, h: 100 }, { x: AX + 150, y: AY + AH - 140, w: 170, h: 100 },
    { x: CX - 95, y: AY + AH - 90, w: 190, h: 80 },
  ];
  const SPAWN = [[AX + 70, AY + 70], [AX + AW - 70, AY + AH - 70], [AX + AW - 70, AY + 70], [AX + 70, AY + AH - 70]];
  const inR = (x, y, r, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

  class Boomerang {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false; this.elapsed = 0; this.outN = 0;
      this.hearts0 = this.stocksMax = api.count(HEARTS);
      this.ps = this.P.map((p, i) => ({
        x: SPAWN[i][0], y: SPAWN[i][1], vx: 0, vy: 0, r: 22, face: i % 2 ? Math.PI : 0, walk: 0,
        hearts: this.hearts0, out: false, inv: 1, stun: 0, hold: 0, dashT: 0, dashCd: 0, slashed: null, hits: 0, rank: 0,
        has: true, hide: false, skip: false,
      }));
      this.rangs = []; // boomerang đang bay hoặc nằm đất
    }

    los(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 16);
      for (let k = 1; k < n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; if (OBS.some((o) => inR(x, y, o, 4))) return false; }
      return true;
    }

    throwRang(p, i, power) {
      const v0 = 820 + power * 380;
      this.rangs.push({ owner: i, x: p.x + Math.cos(p.face) * 26, y: p.y + Math.sin(p.face) * 26, vx: Math.cos(p.face) * v0, vy: Math.sin(p.face) * v0,
        age: 0, state: 'fly', spin: 0, hit: new Set(), curve: (i % 2 ? 1 : -1) * 0.9 });
      p.has = false; Sfx.play('dash');
    }

    hurt(p, i, from, kx, ky) {
      if (p.out || p.inv > 0) return;
      p.hearts--; p.inv = 1.4; p.stun = 0.35; p.vx = kx * 360; p.vy = ky * 360;
      if (from >= 0) this.ps[from].hits++;
      Sfx.play('hurt'); FX.shake(6); Party.rumble(i);
      this.api.parts.burst(p.x, p.y, [this.P[i].color.light, '#fff'], 14, 240, 0.5, 5);
      if (p.hearts <= 0) {
        p.out = true; p.rank = this.n - this.outN++;
        this.api.parts.text(p.x, p.y - 50, 'Bị loại!', '#fff', 30);
        for (const b of this.rangs) if (b.owner === i && b.state === 'fly') b.state = 'drop';
      }
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt; this.elapsed += dt;
        const alive = this.ps.filter((p) => !p.out).length;
        if (this.time <= 0 || alive <= 1) { this.time = Math.max(0, this.time); this.finished = true; }
      }
      this.ps.forEach((p, i) => {
        p.skip = p.out;
        if (p.out) return;
        const q = this.finished ? { mx: 0, my: 0 } : inp[i];
        p.inv -= dt; p.stun -= dt; p.dashT -= dt; p.dashCd -= dt;
        if (p.stun <= 0) {
          if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
          // giữ Đánh để lấy đà, thả ra để ném
          if (q.act && p.has) p.hold += dt;
          else if (p.hold > 0) { if (p.has) this.throwRang(p, i, U.clamp((p.hold - TAP) / CHARGE, 0, 1)); p.hold = 0; }
          if (!p.has) p.hold = 0;
          // Nhảy: lướt chém
          if (q.jumpP && p.dashCd <= 0) { p.dashT = 0.2; p.dashCd = 2.2; p.slashed = new Set(); p.vx = Math.cos(p.face) * 760; p.vy = Math.sin(p.face) * 760; Sfx.play('punch'); }
        }
        if (p.dashT <= 0) {
          const sp = p.stun > 0 ? 0 : p.hold > 0 ? 170 : 270, k = Math.min(1, dt * (p.stun > 0 ? 3 : 10));
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        } else {
          // chém trúng người ngay trước mặt
          this.ps.forEach((o, j) => {
            if (j === i || o.out || p.slashed.has(j)) return;
            if (Math.hypot(o.x - p.x, o.y - p.y) < p.r + o.r + 14) { p.slashed.add(j); this.hurt(o, j, i, Math.cos(p.face), Math.sin(p.face)); }
          });
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        for (const o of OBS) Phys.circleRect(p, o);
        p.x = U.clamp(p.x, AX + p.r, AX + AW - p.r); p.y = U.clamp(p.y, AY + p.r, AY + AH - p.r);
        p.hide = BUSH.some((b) => inR(p.x, p.y, b));
      });
      Phys.separate(this.ps, 0.5);

      for (const b of this.rangs) {
        b.age += dt; b.spin += dt * 22;
        if (b.state === 'fly') {
          const o = this.ps[b.owner];
          // lực kéo về tay người ném + hơi lượn cong
          if (b.age > 0.12) {
            const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy) || 1;
            b.vx += dx / d * 1500 * dt; b.vy += dy / d * 1500 * dt;
          }
          const c = Math.cos(b.curve * dt), s = Math.sin(b.curve * dt);
          [b.vx, b.vy] = [b.vx * c - b.vy * s, b.vx * s + b.vy * c];
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > 1100) { b.vx *= 1100 / sp; b.vy *= 1100 / sp; }
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (OBS.some((r) => inR(b.x, b.y, r)) || b.x < AX || b.x > AX + AW || b.y < AY || b.y > AY + AH) {
            b.state = 'drop'; b.x = U.clamp(b.x - b.vx * dt * 2, AX + 14, AX + AW - 14); b.y = U.clamp(b.y - b.vy * dt * 2, AY + 14, AY + AH - 14);
            Sfx.play('crash', 0.05); parts.burst(b.x, b.y, '#d9b36b', 8, 160, 0.4, 4);
            for (const r of OBS) { if (inR(b.x, b.y, r, 16)) { const ccx = r.x + r.w / 2, ccy = r.y + r.h / 2, a = Math.atan2(b.y - ccy, b.x - ccx); b.x = ccx + Math.cos(a) * (Math.max(r.w, r.h) / 2 + 26); b.y = ccy + Math.sin(a) * (Math.max(r.w, r.h) / 2 + 26); } }
            continue;
          }
          // trúng người
          this.ps.forEach((p, j) => {
            if (j === b.owner || p.out || b.hit.has(j)) return;
            if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + 14) { b.hit.add(j); const sp2 = Math.hypot(b.vx, b.vy) || 1; this.hurt(p, j, b.owner, b.vx / sp2, b.vy / sp2); }
          });
          // về tới tay
          if (b.age > 0.3 && !o.out && Math.hypot(o.x - b.x, o.y - b.y) < o.r + 16) { b.state = 'gone'; o.has = true; Sfx.play('pickup', 0.05); }
          if (b.age > 3) b.state = 'drop';
        } else if (b.state === 'drop') {
          // nằm đất: chủ chạy tới nhặt
          const o = this.ps[b.owner];
          if (!o.out && Math.hypot(o.x - b.x, o.y - b.y) < o.r + 18) { b.state = 'gone'; o.has = true; Sfx.play('pickup'); }
        }
      }
      this.rangs = this.rangs.filter((b) => b.state !== 'gone' && !(b.state === 'drop' && this.ps[b.owner].out));
    }

    draw(ctx) {
      ctx.fillStyle = '#5a3d22'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX - 10, AY - 10, AW + 20, AH + 20, 26); ctx.fillStyle = '#7a5a34'; ctx.fill();
      Draw.rr(ctx, AX, AY, AW, AH, 20); ctx.fillStyle = '#d9b36b'; ctx.fill();
      ctx.fillStyle = 'rgba(160,110,50,0.18)';
      for (let k = 0; k < 40; k++) { const x = AX + ((k * 137) % AW), y = AY + ((k * 263) % AH); ctx.beginPath(); ctx.ellipse(x, y, 18, 6, 0, 0, TAU); ctx.fill(); }
      for (const o of OBS) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; Draw.rr(ctx, o.x + 4, o.y + 10, o.w, o.h, 12); ctx.fill();
        ctx.fillStyle = '#9a7b55'; Draw.rr(ctx, o.x, o.y, o.w, o.h, 12); ctx.fill();
        ctx.fillStyle = '#b8966a'; Draw.rr(ctx, o.x + 5, o.y + 4, o.w - 10, o.h - 16, 10); ctx.fill();
      }
      const t = U.now();
      for (const b of this.rangs) this.drawRang(ctx, b, t);
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        if (p.out) continue;
        const blink = p.inv > 0 && Math.sin(t * 30) > 0;
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk, stun: p.stun > 0, alpha: p.hide ? 0.18 : blink ? 0.45 : 1, shadow: !p.hide });
        if (p.has && !p.hide) this.drawRang(ctx, { x: p.x + Math.cos(p.face + 1.2) * 20, y: p.y - 6 + Math.sin(p.face + 1.2) * 12, spin: p.hold * 8, owner: i, state: 'held' }, t, 0.7);
        if (p.hold > TAP && !p.hide) {
          const k = U.clamp((p.hold - TAP) / CHARGE, 0, 1);
          ctx.strokeStyle = 'rgba(255,225,77,0.85)'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.face) * (40 + k * 70), p.y + Math.sin(p.face) * (40 + k * 70)); ctx.stroke();
        }
        if (p.dashT > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 12, p.face - 1, p.face + 1); ctx.stroke(); }
      }
      // bụi cỏ vẽ đè lên người
      for (const b of BUSH) {
        ctx.fillStyle = 'rgba(46,130,58,0.82)'; Draw.rr(ctx, b.x, b.y, b.w, b.h, 30); ctx.fill();
        ctx.fillStyle = 'rgba(80,175,80,0.7)';
        for (let k = 0; k < b.w / 34; k++) for (let m = 0; m < b.h / 34; m++) { ctx.beginPath(); ctx.arc(b.x + 20 + k * 34, b.y + 20 + m * 34, 16, 0, TAU); ctx.fill(); }
      }
      Draw.chips(ctx, this.P, this.ps.map((p) => (p.out ? 'Loại' : `♥ ${p.hearts}`)), { dim: this.ps.map((p) => p.out), w: 170 });
      Draw.timer(ctx, this.time, W - 72, 38);
      if (this.elapsed < 5) Draw.text(ctx, 'Giữ Đánh rồi thả: ném boomerang (giữ lâu bay xa) · Nhảy: lướt chém · Nấp trong bụi cỏ', W / 2, H - 10, { size: 17, color: '#ffe14d', sw: 4 });
    }

    drawRang(ctx, b, t, s = 1) {
      const col = this.P[b.owner].color;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.state === 'drop' ? 0.6 : b.spin); ctx.scale(s, s);
      ctx.strokeStyle = col.dark; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-14, 10); ctx.lineTo(0, -6); ctx.lineTo(14, 10); ctx.stroke();
      ctx.strokeStyle = col.main; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-14, 10); ctx.lineTo(0, -6); ctx.lineTo(14, 10); ctx.stroke();
      ctx.restore();
      if (b.state === 'drop' && Math.sin(t * 6) > 0) Draw.text(ctx, '↓', b.x, b.y - 24, { size: 18, color: col.light, sw: 3 });
    }

    results() {
      return this.ps.map((p) => (p.out ? { score: p.rank, text: `Hạng ${p.rank} · trúng ${p.hits}` }
        : { score: 100 + p.hearts * 10 + p.hits * 0.1, text: `Còn ${p.hearts} ♥ · trúng ${p.hits}` }));
    }

    botInput(i) {
      const p = this.ps[i], o = { mx: 0, my: 0, act: false, jumpP: false };
      if (p.out || this.finished) return o;
      // né boomerang đang bay về phía mình
      for (const b of this.rangs) {
        if (b.state !== 'fly' || b.owner === i) continue;
        // không phải lúc nào cũng kịp thấy boomerang bay tới
        if (!b.seen) b.seen = {};
        if (b.seen[i] === undefined) b.seen[i] = Math.random() < 0.7;
        if (!b.seen[i]) continue;
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
        if (d < 170 && dx * b.vx + dy * b.vy > 0) {
          const sp = Math.hypot(b.vx, b.vy) || 1, nx = -b.vy / sp, ny = b.vx / sp, side = nx * dx + ny * dy >= 0 ? 1 : -1;
          o.mx = nx * side; o.my = ny * side;
          if (d < 80 && p.dashCd <= 0) o.jumpP = true;
          return o;
        }
      }
      // boomerang nằm đất: chạy đi nhặt
      if (!p.has) {
        const mine = this.rangs.find((b) => b.owner === i && b.state === 'drop');
        if (mine) { const d = Math.hypot(mine.x - p.x, mine.y - p.y) || 1; o.mx = (mine.x - p.x) / d; o.my = (mine.y - p.y) / d; return o; }
      }
      // mục tiêu: người gần nhất mà mình nhìn thấy (trốn trong bụi thì chỉ thấy khi rất gần)
      let tg = null, td = Infinity;
      this.ps.forEach((q, j) => {
        if (j === i || q.out) return;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (q.hide && d > 120) return;
        if (d < td) { td = d; tg = q; }
      });
      if (!tg) {
        // không thấy ai: đi dò về giữa sân
        const d = Math.hypot(CX - p.x, CY + 160 - p.y);
        if (d > 60) { o.mx = (CX - p.x) / d; o.my = (CY + 160 - p.y) / d; }
        return o;
      }
      const aim = Math.atan2(tg.y - p.y, tg.x - p.x), see = this.los(p.x, p.y, tg.x, tg.y);
      if (td < 70 && p.dashCd <= 0 && Math.abs(U.angDiff(p.face, aim)) < 0.4 && Math.random() < 0.15) { o.jumpP = true; return o; }
      if (p.has && see && td < 520) {
        // quay mặt về mục tiêu (bước nhẹ), giữ Đánh theo khoảng cách rồi thả
        o.mx = Math.cos(aim) * 0.3; o.my = Math.sin(aim) * 0.3;
        const need = TAP + U.clamp((td - 300) / 380, 0, 1) * CHARGE;
        if (Math.abs(U.angDiff(p.face, aim)) < 0.15 && p.hold < need) o.act = true;
        else if (p.hold > 0 && p.hold < need) o.act = true;
        return o;
      }
      // lại gần, giữ khoảng cách vừa phải
      const want = p.has ? 330 : 200, dir = td > want ? 1 : -0.6;
      let ax = Math.cos(aim) * dir, ay = Math.sin(aim) * dir;
      if (!see) { // vòng qua chướng ngại
        for (const off of [0.7, -0.7, 1.4, -1.4]) { const a = aim + off; if (!OBS.some((r) => inR(p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60, r, 24))) { ax = Math.cos(a); ay = Math.sin(a); break; } }
      }
      o.mx = ax; o.my = ay;
      return o;
    }
  }

  Party.register({
    id: 'boomerang', name: 'Vua Boomerang', emoji: '🪃', cat: 'fight',
    tagline: 'Ném boomerang vòng về tay, nấp bụi cỏ, lướt chém',
    how: 'Giữ nút Đánh để lấy đà rồi thả ra để ném boomerang theo hướng mặt — giữ càng lâu bay càng xa. Boomerang lượn rồi tự bay về tay; vướng tường hay bay ra mép thì rơi xuống đất, phải chạy tới nhặt mới ném tiếp được. '
      + 'Nhảy = lướt chém người ngay trước mặt. Đứng trong bụi cỏ thì gần như vô hình. Mỗi người vài tim — còn lại người cuối cùng, hoặc hết giờ ai nhiều tim nhất thắng.',
    controls: { move: 'Chạy & xoay hướng', act: 'Giữ: lấy đà · Thả: ném', jump: 'Lướt chém' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Boomerang(api),
  });
})();

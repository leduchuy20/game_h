'use strict';
/* Tô Màu — chạy tới đâu tô màu tới đó. Hết giờ, ai chiếm nhiều ô nhất thắng. */
(() => {
  const GW = 28, GH = 15, C = 40;
  const OX = (W - GW * C) / 2, OY = 92;
  const GAME_TIME = 60;
  const SPAWN = [[2, 2], [GW - 3, GH - 3], [GW - 3, 2], [2, GH - 3]];
  const METER = 70, TOWER_T = 3, TOWER_CD = 14;
  const TX = Math.floor(GW / 2), TY = Math.floor(GH / 2);   // trụ phun sơn giữa sân (ô TX-1..TX, TY)
  const MODES = [
    { id: 'ffa', name: 'Mỗi người một màu', desc: 'Ai chiếm nhiều ô nhất thắng.' },
    { id: 'team', name: 'Đồng đội', desc: 'P1+P3 cùng màu đấu P2+P4. Đội nhiều ô hơn thắng.' },
  ];

  class Paint {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.teamMode = api.mode === 'team';
      this.team = this.teamMode ? TEAMS.split(this.n) : null;
      if (!this.teamMode) this.teamOf = null;
      this.tower = { cd: 6, who: -1, prog: 0 };
      this.cells = new Int8Array(GW * GH).fill(-1);
      this.pop = new Float32Array(GW * GH);
      this.counts = new Array(this.n).fill(0);
      this.time = this.total = api.T(GAME_TIME); this.finished = false;
      this.items = []; this.itemT = 5; this.lastTick = 99;
      this.ps = this.P.map((p, i) => ({
        x: OX + (SPAWN[i][0] + 0.5) * C, y: OY + (SPAWN[i][1] + 0.5) * C, vx: 0, vy: 0, r: 20,
        face: 0, walk: 0, dashT: 0, dashCd: 0, squash: 0, skip: false, meter: 0, tow: 0,
      }));
      this.bot = this.P.map(() => ({ tx: null, ty: null, t: 0 }));
    }

    /** màu của ô ngay trước mặt (ngoài vùng vừa tô), -1 = trống/ngoài sân */
    cellAhead(p, q) {
      const l = Math.hypot(q.mx, q.my);
      if (l < 0.1) return -1;
      const x = Math.floor((p.x + q.mx / l * (p.r + 14) - OX) / C), y = Math.floor((p.y + q.my / l * (p.r + 14) - OY) / C);
      if (x < 0 || y < 0 || x >= GW || y >= GH) return -1;
      return this.cells[y * GW + x];
    }
    teamOf(i) { return this.team[i]; }
    /** màu thực sự được tô: chế độ đồng đội thì cả đội dùng màu của người đầu đội (P1 / P2) */
    owner(i) { return this.teamMode ? this.team[i] : i; }
    setCell(k, i) {
      const o = this.owner(i);
      if (this.cells[k] === o) return false;
      this.cells[k] = o; this.pop[k] = 1;
      // PNT1: mỗi ô mới tô nạp thanh chiêu
      const p = this.ps[i];
      if (p && p.meter < METER) p.meter++;
      return true;
    }
    /** PNT1: bom sơn — ném tới trước 5 ô, nổ bung vùng tròn */
    paintBomb(p, i) {
      p.meter = 0;
      const l = Math.hypot(Math.cos(p.face), Math.sin(p.face));
      const gx = Math.floor((p.x + Math.cos(p.face) / l * C * 5 - OX) / C), gy = Math.floor((p.y + Math.sin(p.face) / l * C * 5 - OY) / C);
      const cx = U.clamp(gx, 1, GW - 2), cy = U.clamp(gy, 1, GH - 2);
      this.splash(cx, cy, i, 2.6);
      Sfx.play('boom'); FX.shake(6);
      const ix = OX + (cx + 0.5) * C, iy = OY + (cy + 0.5) * C;
      this.api.parts.burst(ix, iy, [this.P[this.owner(i)].color.main, this.P[this.owner(i)].color.light], 30, 380, 0.7, 9);
      this.api.parts.text(ix, iy - 30, 'Bom sơn!', this.P[this.owner(i)].color.light, 28);
    }
    /** PNT6: trụ phun sơn chữ thập 3 ô bề ngang khắp sân */
    towerBlast(i) {
      for (let x = 0; x < GW; x++) for (let y = TY - 1; y <= TY + 1; y++) this.setCell(y * GW + x, i);
      for (let y = 0; y < GH; y++) for (let x = TX - 2; x <= TX + 1; x++) this.setCell(y * GW + x, i);
      Sfx.play('goal'); FX.shake(10);
      this.api.parts.text(OX + TX * C, OY + TY * C - 50, 'Phun sơn!', this.P[this.owner(i)].color.light, 36);
    }
    towerPos() { return { x: OX + TX * C, y: OY + (TY + 0.5) * C }; }
    splash(cx, cy, i, rad) {
      for (let y = cy - rad; y <= cy + rad; y++) {
        for (let x = cx - rad; x <= cx + rad; x++) {
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad + 1) this.setCell(y * GW + x, i);
        }
      }
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt;
        const s = Math.ceil(this.time);
        if (s <= 5 && s !== this.lastTick && s > 0) { this.lastTick = s; Sfx.play('tick'); }
        if (this.time <= 0) { this.time = 0; this.finished = true; }
      }
      this.ps.forEach((p, i) => {
        const q = inp[i];
        p.dashT -= dt; p.dashCd -= dt;
        p.squash *= Math.pow(0.01, dt);
        if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        if (q.actP && p.dashCd <= 0 && !this.finished) {
          p.dashT = 0.3; p.dashCd = 1.4; p.squash = -0.2; Sfx.play('dash');
        }
        if (q.jumpP && p.meter >= METER && !this.finished) this.paintBomb(p, i);
        if (p.dashT > 0) {
          p.vx = Math.cos(p.face) * 640; p.vy = Math.sin(p.face) * 640;
          if (Math.random() < 0.5) parts.burst(p.x, p.y, this.P[i].color.main, 1, 40, 0.4, 7);
        } else {
          // PNT2: ô ngay phía trước là màu mình → nhanh hơn, màu đối thủ → chậm hơn
          const own = this.cellAhead(p, q), me = this.owner(i), mul = own === me ? 1.18 : own >= 0 ? 0.78 : 1;
          p.surf = own === me ? 1 : own >= 0 ? -1 : 0;
          const k = Math.min(1, dt * 12);
          p.vx += (q.mx * 300 * mul - p.vx) * k; p.vy += (q.my * 300 * mul - p.vy) * k;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.x = U.clamp(p.x, OX + p.r, OX + GW * C - p.r);
        p.y = U.clamp(p.y, OY + p.r, OY + GH * C - p.r);
      });
      Phys.separate(this.ps, 0.8, (a, b, nx, ny, imp) => {
        if (imp > 300) { Sfx.play('hit', 0.1); a.squash = b.squash = 0.2; }
      });

      if (!this.finished) {
        let painted = false;
        this.ps.forEach((p, i) => {
          const x0 = Math.floor((p.x - OX - p.r) / C), x1 = Math.floor((p.x - OX + p.r) / C);
          const y0 = Math.floor((p.y - OY - p.r) / C), y1 = Math.floor((p.y - OY + p.r) / C);
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
              const cx = OX + (x + 0.5) * C, cy = OY + (y + 0.5) * C;
              if (Math.hypot(cx - p.x, cy - p.y) <= p.r + 4) painted = this.setCell(y * GW + x, i) || painted;
            }
          }
        });
        if (painted) Sfx.play('paint', 0.07);

        this.itemT -= dt;
        if (this.itemT <= 0 && this.items.length < 2) {
          this.itemT = 7;
          this.items.push({ x: U.randi(3, GW - 4), y: U.randi(2, GH - 3), age: 0 });
        }
        for (const it of this.items) it.age += dt;
        this.items = this.items.filter((it) => {
          const ix = OX + (it.x + 0.5) * C, iy = OY + (it.y + 0.5) * C;
          for (let i = 0; i < this.n; i++) {
            const p = this.ps[i];
            if (Math.hypot(p.x - ix, p.y - iy) < p.r + 18) {
              this.splash(it.x, it.y, i, 3);
              Sfx.play('boom'); FX.shake(6);
              parts.burst(ix, iy, [this.P[i].color.main, this.P[i].color.light], 26, 380, 0.7, 9);
              parts.text(ix, iy - 30, 'Bùm màu!', this.P[i].color.light, 30);
              return false;
            }
          }
          return true;
        });
      }
      // PNT6: đứng MỘT MÌNH cạnh trụ đủ lâu thì trụ phun màu mình
      if (!this.finished) {
        const T0 = this.tower, tp = this.towerPos();
        T0.cd -= dt;
        const near = this.ps.map((p, i) => (Math.hypot(p.x - tp.x, p.y - tp.y) < C * 1.8 ? i : -1)).filter((i) => i >= 0);
        const groups = new Set(near.map((i) => this.owner(i)));
        this.ps.forEach((p, i) => { if (!near.includes(i)) p.tow = 0; });
        if (T0.cd <= 0 && groups.size === 1) {
          for (const i of near) {
            this.ps[i].tow += dt;
            if (this.ps[i].tow >= TOWER_T) { this.towerBlast(i); T0.cd = TOWER_CD; this.ps.forEach((p) => { p.tow = 0; }); break; }
          }
        }
        T0.contest = groups.size > 1;
      }
      for (let k = 0; k < this.pop.length; k++) if (this.pop[k] > 0) this.pop[k] = Math.max(0, this.pop[k] - dt * 4);
      this.counts.fill(0);
      for (const c of this.cells) if (c >= 0) this.counts[c]++;
      if (this.teamMode) { const t = [this.counts[0], this.counts[1] || 0]; this.counts = this.P.map((_, i) => t[this.team[i]]); }
    }

    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3b2370'); g.addColorStop(1, '#22143f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, OX - 10, OY - 10, GW * C + 20, GH * C + 20, 20);
      ctx.fillStyle = '#160c2c'; ctx.fill();
      for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
          const k = y * GW + x, c = this.cells[k], px = OX + x * C, py = OY + y * C;
          if (c < 0) {
            ctx.fillStyle = (x + y) % 2 ? '#efeaf8' : '#e3ddf0';
            ctx.fillRect(px, py, C, C);
          } else {
            ctx.fillStyle = (x + y) % 2 ? '#efeaf8' : '#e3ddf0';
            ctx.fillRect(px, py, C, C);
            const col = this.P[c].color;
            const s = 1 + this.pop[k] * 0.25;
            const w = (C - 2) * s;
            ctx.fillStyle = (x + y) % 2 ? col.main : col.dark;
            Draw.rr(ctx, px + C / 2 - w / 2, py + C / 2 - w / 2, w, w, 8);
            ctx.fill();
          }
        }
      }
      const t = U.now();
      for (const it of this.items) {
        const ix = OX + (it.x + 0.5) * C, iy = OY + (it.y + 0.5) * C - 6 + Math.sin(t * 5) * 4;
        const s = Math.min(1, it.age * 3);
        ctx.save(); ctx.translate(ix, iy); ctx.scale(s, s);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 22, 16, 5, 0, 0, TAU); ctx.fill();
        const hue = (t * 120) % 360;
        ctx.fillStyle = `hsl(${hue},90%,60%)`;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
        Draw.text(ctx, '🎨', 0, 2, { size: 22, stroke: null });
        ctx.restore();
      }
      // trụ phun sơn
      {
        const tp = this.towerPos(), T0 = this.tower, ready = T0.cd <= 0;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(tp.x, tp.y + 20, 30, 10, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = ready ? '#ffffff' : '#9a94b0'; Draw.rr(ctx, tp.x - 18, tp.y - 34, 36, 54, 10); ctx.fill();
        ctx.fillStyle = ready ? `hsl(${(t * 140) % 360},90%,60%)` : '#6b6684';
        ctx.beginPath(); ctx.arc(tp.x, tp.y - 36, 14, 0, TAU); ctx.fill();
        ctx.strokeStyle = T0.contest ? 'rgba(255,90,110,0.8)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(tp.x, tp.y, C * 1.8, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        if (!ready) Draw.text(ctx, String(Math.ceil(T0.cd)), tp.x, tp.y - 6, { size: 18, color: '#fff' });
        const best = this.ps.reduce((b, p, i) => (p.tow > (b < 0 ? 0 : this.ps[b].tow) ? i : b), -1);
        if (best >= 0) {
          ctx.strokeStyle = this.P[this.owner(best)].color.main; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(tp.x, tp.y - 36, 20, -Math.PI / 2, -Math.PI / 2 + TAU * this.ps[best].tow / TOWER_T); ctx.stroke();
        }
      }
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        if (this.teamMode) {   // vòng dưới chân = màu sơn của đội
          ctx.strokeStyle = this.P[this.owner(i)].color.main; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.7, p.r * 1.1, p.r * 0.4, 0, 0, TAU); ctx.stroke();
        }
        Draw.blob(ctx, { x: p.x, y: p.y - 4, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk, squash: p.squash });
        // thanh chiêu bom sơn
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y - 4, p.r + 6, 0, TAU); ctx.stroke();
        ctx.strokeStyle = p.meter >= METER ? `hsl(${(t * 300) % 360},95%,60%)` : this.P[i].color.light;
        ctx.beginPath(); ctx.arc(p.x, p.y - 4, p.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * p.meter / METER); ctx.stroke();
        if (p.meter >= METER && !this.P[i].bot) Draw.text(ctx, 'Nhảy: bom sơn!', p.x, p.y + p.r + 14, { size: 14, color: '#ffe14d', sw: 3 });
        if (p.surf === -1 && p.dashT <= 0) Draw.text(ctx, '🐌', p.x + p.r, p.y - p.r - 8, { size: 16, stroke: null });
      }

      // HUD
      const total = GW * GH;
      Draw.chips(ctx, this.P, this.counts.map((c) => Math.round(c / total * 100) + '%'), { y: 34 });
      Draw.timer(ctx, this.time, W - 72, 34);
      // thanh tỉ lệ
      const bx = OX, by = 66, bw = GW * C, bh = 12;
      Draw.rr(ctx, bx, by, bw, bh, 6); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
      let x = bx;
      const segs = this.teamMode ? [0, 1].map((t) => [this.counts[this.team.indexOf(t)] || 0, t]) : this.counts.map((c, i) => [c, i]);
      segs.forEach(([c, i]) => {
        const w = bw * c / total;
        ctx.fillStyle = this.P[i].color.main; ctx.fillRect(x, by, w, bh);
        x += w;
      });
    }

    results() {
      const total = GW * GH;
      return this.counts.map((c, i) => ({ score: c, text: `${this.teamMode ? TEAMS.names[this.team[i]] + ' · ' : ''}${c} ô · ${Math.round(c / total * 100)}%` }));
    }

    botInput(i) {
      const p = this.ps[i], st = this.bot[i];
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (this.finished) return o;
      st.t -= 1 / 60;
      const me = this.owner(i);
      if (p.meter >= METER && Math.random() < 0.04) o.jumpP = true;
      let tx, ty;
      // trụ phun sơn sắp sẵn sàng → ra giữ trụ
      const tp = this.towerPos(), tDist = Math.hypot(tp.x - p.x, tp.y - p.y);
      st.towerBan = (st.towerBan || 0) - 1 / 60;
      if (this.tower.cd < 1.5 && st.towerBan <= 0 && (tDist < 380 || st.goTower)) {
        if (!st.goTower) { st.goTower = Math.random() < 0.6; st.towerT = 0; if (!st.goTower) st.towerBan = 4; }
        if (st.goTower) {
          st.towerT += 1 / 60;
          // tranh chấp lâu quá thì bỏ đi tô chỗ khác
          if (st.towerT > 6) { st.goTower = false; st.towerBan = 8; }
          else { const dx = tp.x - p.x, dy = tp.y + C - p.y, d = Math.hypot(dx, dy) || 1; if (d > 12) { o.mx = dx / d; o.my = dy / d; } return o; }
        }
      } else st.goTower = false;
      const near = this.items.find((it) => Math.hypot(OX + (it.x + 0.5) * C - p.x, OY + (it.y + 0.5) * C - p.y) < 360);
      if (near) { tx = OX + (near.x + 0.5) * C; ty = OY + (near.y + 0.5) * C; }
      else {
        if (st.tx === null || st.t <= 0 || Math.hypot(st.tx - p.x, st.ty - p.y) < C * 0.6) {
          let best = null, bs = -Infinity;
          for (let n = 0; n < 16; n++) {
            const x = U.randi(0, GW - 1), y = U.randi(0, GH - 1), k = y * GW + x;
            const cx = OX + (x + 0.5) * C, cy = OY + (y + 0.5) * C;
            const own = this.cells[k];
            let s = own === me ? -50 : own === -1 ? 6 : 9;
            s -= Math.hypot(cx - p.x, cy - p.y) / C * 0.9;
            s += Math.random() * 3;
            if (s > bs) { bs = s; best = [cx, cy]; }
          }
          st.tx = best[0]; st.ty = best[1]; st.t = U.rand(1.2, 2.2);
        }
        tx = st.tx; ty = st.ty;
      }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
      o.mx = dx / d; o.my = dy / d;
      if (d > 220 && p.dashCd <= 0 && Math.random() < 0.03) o.actP = true;
      return o;
    }
  }

  Party.register({
    id: 'paint', name: 'Tô Màu', emoji: '🎨',
    tagline: 'Chạy tới đâu tô màu tới đó · chiếm nhiều ô nhất là thắng',
    how: 'Chạy khắp sàn để tô màu của mình, tô đè lên màu người khác. Chạy trên màu mình thì nhanh hơn, lội qua màu đối thủ thì chậm lại. Tô đủ nhiều thì vòng quanh người sáng lên: bấm Nhảy ném bom sơn ra phía trước. Đứng MỘT MÌNH cạnh trụ giữa sân vài giây để trụ phun màu bạn theo hình chữ thập. Nhặt 🎨 để tô cả vùng lớn. Hết giờ, nhiều ô nhất thắng!',
    controls: { move: 'Chạy & tô màu', act: 'Lướt nhanh', jump: 'Bom sơn (khi đầy)' },
    modes: MODES,
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Paint(api),
  });
})();

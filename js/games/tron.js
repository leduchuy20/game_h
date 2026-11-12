'use strict';
/* Vệt Sáng — mỗi người để lại vệt sáng phía sau. Đâm tường hay vệt của ai là thua hiệp. */
(() => {
  const CS = 10, GW = 124, GH = 62;
  const OX = (W - GW * CS) / 2, OY = 82;
  const SPEED = 15, GRIND = 1.35, AIR = 3, JUMP_CD = 6;
  const SD_AT = 25, SD_STEP = 0.35;   // vòng tử thần: sau 25 giây tường khép dần từ ngoài vào
  const MODES = [
    { id: 'walls', name: 'Có tường', desc: 'Đâm tường hay vệt sáng là thua hiệp.' },
    { id: 'wrap', name: 'Xuyên mép', desc: 'Chạy ra mép này thì hiện ra ở mép đối diện — chỉ vệt sáng mới nguy hiểm.' },
  ];

  class Tron {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.wrap = api.mode === 'wrap';
      this.wins = new Array(this.n).fill(0);
      this.round = 0; this.need = api.wins; this.maxRounds = api.wins * 2 - 1;
      this.finished = false;
      this.trail = document.createElement('canvas');
      this.trail.width = GW * CS; this.trail.height = GH * CS;
      this.tctx = this.trail.getContext('2d');
      this.bgc = document.createElement('canvas');
      this.bgc.width = GW * CS; this.bgc.height = GH * CS;
      const b = this.bgc.getContext('2d');
      b.fillStyle = '#0b0f26'; b.fillRect(0, 0, GW * CS, GH * CS);
      b.strokeStyle = 'rgba(120,140,255,0.08)'; b.lineWidth = 1;
      for (let x = 0; x <= GW; x += 4) { b.beginPath(); b.moveTo(x * CS + 0.5, 0); b.lineTo(x * CS + 0.5, GH * CS); b.stroke(); }
      for (let y = 0; y <= GH; y += 4) { b.beginPath(); b.moveTo(0, y * CS + 0.5); b.lineTo(GW * CS, y * CS + 0.5); b.stroke(); }
      this.startRound();
    }

    startRound() {
      this.round++;
      this.grid = new Int8Array(GW * GH).fill(-1);
      this.tctx.clearRect(0, 0, GW * CS, GH * CS);
      const mid = GH >> 1;
      const starts = this.n === 2
        ? [[14, mid, 1, 0], [GW - 15, mid, -1, 0]]
        : [[14, 14, 1, 0], [GW - 15, GH - 15, -1, 0], [GW - 15, 14, -1, 0], [14, GH - 15, 1, 0]];
      this.ps = this.P.map((p, i) => {
        const [x, y, dx, dy] = starts[i];
        const o = { x, y, dx, dy, ndx: dx, ndy: dy, alive: true, acc: 0, boostT: 0, boostCd: 0.5, deadT: 0, grindT: 0, air: 0, jumpCd: 2 };
        this.mark(o, i);
        return o;
      });
      this.over = false; this.overT = 0; this.rt = 0; this.ring = 0; this.ringT = 0;
      this.bannerText = `Hiệp ${this.round}`; this.bannerColor = '#fff'; this.bannerT = 0;
      this.freeze = this.round === 1 ? 0.3 : 1.4;
    }

    mark(p, i) {
      this.grid[p.y * GW + p.x] = i;
      const c = this.P[i].color, t = this.tctx;
      t.fillStyle = c.main; t.globalAlpha = 0.25;
      t.fillRect(p.x * CS - 3, p.y * CS - 3, CS + 6, CS + 6);
      t.globalAlpha = 1;
      t.fillRect(p.x * CS, p.y * CS, CS, CS);
      t.fillStyle = c.light;
      t.fillRect(p.x * CS + 3, p.y * CS + 3, CS - 6, CS - 6);
    }
    fillRing(k) {
      const t = this.tctx;
      t.fillStyle = '#3a3f66';
      for (let x = k; x < GW - k; x++) for (const y of [k, GH - 1 - k]) { if (this.grid[y * GW + x] < 0) { this.grid[y * GW + x] = 9; t.fillRect(x * CS, y * CS, CS, CS); } }
      for (let y = k; y < GH - k; y++) for (const x of [k, GW - 1 - k]) { if (this.grid[y * GW + x] < 0) { this.grid[y * GW + x] = 9; t.fillRect(x * CS, y * CS, CS, CS); } }
    }
    /** xuyên mép: đưa toạ độ về trong lưới */
    wx(x) { return this.wrap ? (x + GW) % GW : x; }
    wy(y) { return this.wrap ? (y + GH) % GH : y; }
    inside(x, y) { return x >= 0 && y >= 0 && x < GW && y < GH; }
    free(x, y) { x = this.wx(x); y = this.wy(y); return this.inside(x, y) && this.grid[y * GW + x] < 0; }

    crash(p, i) {
      p.alive = false;
      Sfx.play('crash'); FX.shake(7);
      const px = OX + (p.x + 0.5) * CS, py = OY + (p.y + 0.5) * CS;
      this.api.parts.burst(px, py, [this.P[i].color.main, this.P[i].color.light, '#fff'], 24, 320, 0.7, 6);
    }

    step(p, i) {
      if (!(p.ndx === -p.dx && p.ndy === -p.dy)) { p.dx = p.ndx; p.dy = p.ndy; }
      const nx = this.wx(p.x + p.dx), ny = this.wy(p.y + p.dy);
      // đang nhảy (TRN5): bay qua vệt sáng, không để lại vệt; tường thì vẫn đâm
      if (p.air > 0) {
        if (!this.inside(nx, ny)) { this.crash(p, i); return; }
        p.x = nx; p.y = ny; p.air--;
        return;
      }
      if (!this.free(nx, ny)) {
        if (this.inside(nx, ny)) { p.x = nx; p.y = ny; }
        this.crash(p, i);
        return;
      }
      p.x = nx; p.y = ny;
      this.mark(p, i);
      // chạy sát vệt sáng (TRN1): ô hai bên có vệt thì được tăng tốc
      const sx = -p.dy, sy = p.dx;
      if (!this.free(p.x + sx, p.y + sy) || !this.free(p.x - sx, p.y - sy)) {
        const hitWall = !this.wrap && (!this.inside(p.x + sx, p.y + sy) || !this.inside(p.x - sx, p.y - sy));
        if (!hitWall || this.grid[this.wy(p.y + sy) * GW + this.wx(p.x + sx)] >= 0 || this.grid[this.wy(p.y - sy) * GW + this.wx(p.x - sx)] >= 0) {
          if (p.grindT <= 0 && Math.random() < 0.5) {
            this.api.parts.burst(OX + (p.x + 0.5) * CS, OY + (p.y + 0.5) * CS, ['#fff', this.P[i].color.light], 3, 120, 0.25, 3);
          }
          p.grindT = 0.2;
        }
      }
    }

    update(dt, inp) {
      this.bannerT += dt;
      if (this.freeze > 0) { this.freeze -= dt; return; }
      this.ps.forEach((p, i) => {
        if (!p.alive) { p.deadT += dt; return; }
        const q = inp[i];
        let dx = 0, dy = 0;
        if (Math.abs(q.mx) > 0.4 || Math.abs(q.my) > 0.4) {
          if (Math.abs(q.mx) >= Math.abs(q.my)) dx = Math.sign(q.mx); else dy = Math.sign(q.my);
        }
        if ((dx || dy) && !(dx === -p.dx && dy === -p.dy)) { p.ndx = dx; p.ndy = dy; }
        p.boostT -= dt; p.boostCd -= dt; p.grindT -= dt; p.jumpCd -= dt;
        if (q.actP && p.boostCd <= 0 && !this.over) { p.boostT = 0.9; p.boostCd = 3; Sfx.play('dash'); }
        if (q.jumpP && p.jumpCd <= 0 && p.air <= 0 && !this.over) { p.air = AIR; p.jumpCd = JUMP_CD; Sfx.play('jump'); }
        p.acc += dt * Math.min(28, SPEED + this.rt * 0.18) * (p.boostT > 0 ? 1.8 : 1) * (p.grindT > 0 ? GRIND : 1);
      });
      this.rt += dt;
      // vòng tử thần: mỗi SD_STEP giây lấp thêm một vòng ô ở mép
      if (!this.over && this.rt > SD_AT) {
        if (this.ring === 0 && this.ringT === 0) { this.bannerText = 'Tường khép lại!'; this.bannerColor = '#ff7a7a'; this.bannerT = 0; Sfx.play('warn'); }
        this.ringT -= dt;
        if (this.ringT <= 0 && this.ring < Math.min(GW, GH) / 2 - 3) { this.ringT = SD_STEP; this.fillRing(this.ring++); }
      }
      // các bước nhỏ xen kẽ cho công bằng
      for (let guard = 0; guard < 10; guard++) {
        let any = false;
        this.ps.forEach((p, i) => {
          if (p.alive && p.acc >= 1) { p.acc -= 1; this.step(p, i); any = true; }
        });
        if (!any) break;
      }

      if (!this.over) {
        const alive = this.ps.map((p, i) => (p.alive ? i : -1)).filter((i) => i >= 0);
        if (alive.length <= 1) {
          this.over = true; this.overT = 2.2; this.bannerT = 0;
          if (alive.length === 1) {
            this.wins[alive[0]]++;
            this.bannerText = `${this.P[alive[0]].name} thắng hiệp!`;
            this.bannerColor = this.P[alive[0]].color.light;
            this.ps[alive[0]].acc = -999; // dừng lại
          } else { this.bannerText = 'Hòa!'; this.bannerColor = '#fff'; }
          Sfx.play('crown');
        }
      } else {
        this.overT -= dt;
        if (this.overT <= 0 && !this.finished) {
          if (this.round >= this.maxRounds || Math.max(...this.wins) >= this.need) this.finished = true;
          else this.startRound();
        }
      }
    }

    draw(ctx) {
      ctx.fillStyle = '#060818'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(this.bgc, OX, OY);
      ctx.drawImage(this.trail, OX, OY);
      ctx.strokeStyle = '#5b6cff'; ctx.lineWidth = 4;
      ctx.strokeRect(OX - 2, OY - 2, GW * CS + 4, GH * CS + 4);
      const t = U.now();
      this.ps.forEach((p, i) => {
        const px = OX + (p.x + 0.5) * CS, py = OY + (p.y + 0.5) * CS;
        const c = this.P[i].color;
        if (!p.alive) {
          if (p.deadT < 1.2) Draw.blob(ctx, { x: px, y: py, r: 12, color: c, dead: true, shadow: false, alpha: 1 - p.deadT / 1.2 });
          return;
        }
        const lift = p.air > 0 ? 10 : 0;
        if (lift) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(px, py + 6, 12, 5, 0, 0, TAU); ctx.fill(); }
        ctx.save();
        ctx.shadowColor = c.main; ctx.shadowBlur = p.boostT > 0 || p.grindT > 0 ? 30 : 16;
        ctx.fillStyle = c.main; ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 10);
        ctx.beginPath(); ctx.arc(px, py - lift, 16, 0, TAU); ctx.fill();
        ctx.restore();
        Draw.blob(ctx, { x: px, y: py - lift, r: lift ? 15 : 12, color: c, face: Math.atan2(p.dy, p.dx), shadow: false });
        if (p.jumpCd > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(px, py - lift, 20, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.jumpCd / JUMP_CD)); ctx.stroke();
        }
      });
      Draw.label(ctx, `Hiệp ${this.round}/${this.maxRounds}`, 90, 38);
      Draw.chips(ctx, this.P, this.wins.map((w) => '★'.repeat(w) + '☆'.repeat(Math.max(0, this.need - w))),
        { dim: this.ps.map((p) => !p.alive) });
      if (this.bannerT < 1.4 || this.over) Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 66 });
    }

    results() { return this.wins.map((w) => ({ score: w, text: `${w} hiệp thắng` })); }

    /* bot: chọn hướng có nhiều chỗ trống nhất (flood fill giới hạn) */
    space(x, y, limit) {
      if (!this.free(x, y)) return -1;
      x = this.wx(x); y = this.wy(y);
      const seen = new Set([y * GW + x]), q = [[x, y]];
      for (let h = 0; h < q.length && seen.size < limit; h++) {
        const [cx, cy] = q[h];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = this.wx(cx + dx), ny = this.wy(cy + dy), k = ny * GW + nx;
          if (this.free(nx, ny) && !seen.has(k)) { seen.add(k); q.push([nx, ny]); }
        }
      }
      return seen.size;
    }
    run(x, y, dx, dy) {
      let n = 0;
      while (n < 30 && this.free(x + dx * (n + 1), y + dy * (n + 1))) n++;
      return n;
    }
    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) { const p = this.ps[i]; return { x: OX + (p.x + 0.5) * CS, y: OY + (p.y + 0.5) * CS }; }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (!p.alive || this.freeze > 0) return o;
      if (p.air > 0) return o;
      const opts = [[p.dx, p.dy], [p.dy, -p.dx], [-p.dy, p.dx]];
      let best = null, bs = -Infinity;
      opts.forEach(([dx, dy], k) => {
        const sp = this.space(p.x + dx, p.y + dy, this.api.botOf(i).look);
        if (sp < 0) return;
        let s = sp + Math.min(this.run(p.x, p.y, dx, dy), 12) * 4;
        if (k === 0) s += 25;
        s += Math.random() * (this.api.botOf(i).look < 100 ? 40 : 10);
        if (s > bs) { bs = s; best = [dx, dy]; }
      });
      // sắp hết đường: nhảy qua vệt nếu ô đáp phía trước còn trống và có chỗ để chạy tiếp
      if ((!best || bs < 12) && p.jumpCd <= 0) {
        const lx = p.x + p.dx * (AIR + 1), ly = p.y + p.dy * (AIR + 1);
        if (this.space(lx, ly, 40) > 20 && (this.wrap || this.inside(p.x + p.dx * AIR, p.y + p.dy * AIR))) { o.jumpP = true; return o; }
      }
      if (best) { o.mx = best[0]; o.my = best[1]; }
      if (best && best[0] === p.dx && best[1] === p.dy && this.run(p.x, p.y, p.dx, p.dy) > 20 && Math.random() < 0.02) o.actP = true;
      return o;
    }
  }

  Party.register({
    id: 'tron', name: 'Vệt Sáng', emoji: '⚡',
    tagline: 'Đừng đâm tường hay vệt sáng của ai · còn chạy cuối cùng là thắng',
    how: 'Bạn luôn tự chạy về phía trước và để lại vệt sáng. Rẽ 90° để vây đối thủ. Chạy sát vệt sáng thì được tăng tốc (tóe lửa). Nút Nhảy: bay qua vệt sáng phía trước (có hồi chiêu, vòng trắng quanh người). Đâm tường hoặc vệt là thua hiệp. Thắng đủ số hiệp trước là vô địch.',
    controls: { move: 'Rẽ hướng', act: 'Tăng tốc', jump: 'Nhảy qua vệt' },
    modes: MODES,
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Tron(api),
  });
})();

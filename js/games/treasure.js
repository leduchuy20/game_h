'use strict';
/* Đào Kho Báu (NEW7) — rương chôn dưới cát. Radar dưới chân nháy càng nhanh khi càng gần rương.
   Giữ Đánh để đào ô đang đứng; đào trúng rương thì rương lộ ra, giữ Đánh thêm để mở (người khác có thể húc để cướp).
   Ô có vết nứt có thể là mìn: đào trúng hoặc bị húc văng vào là nổ. */
(() => {
  const CS = 64, COLS = 18, ROWS = 9;
  const AX = (W - COLS * CS) / 2, AY = 92, AW = COLS * CS, AH = ROWS * CS;
  const GAME_TIME = 60, DIG_T = 0.6, OPEN_T = 0.9;
  const SPAWN = [[AX + CS * 1.5, AY + CS * 1.5], [AX + AW - CS * 1.5, AY + AH - CS * 1.5], [AX + AW - CS * 1.5, AY + CS * 1.5], [AX + CS * 1.5, AY + AH - CS * 1.5]];

  class Treasure {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false; this.elapsed = 0;
      this.grid = Array.from({ length: COLS * ROWS }, () => ({ dug: 0, mine: false, crack: false, chest: null, boom: 0 }));
      // mìn: luôn có vết nứt; thêm vài vết nứt giả trên ô an toàn
      const cells = U.shuffle(this.grid.map((_, k) => k).filter((k) => !SPAWN.some(([x, y]) => this.cellAt(x, y) === k)));
      const mines = 12 + this.n * 2;
      for (let k = 0; k < mines; k++) { this.grid[cells[k]].mine = true; this.grid[cells[k]].crack = true; }
      for (let k = mines; k < mines + 10; k++) this.grid[cells[k]].crack = true;
      this.chests = [];
      for (let k = 0; k < this.n + 2; k++) this.hideChest();
      this.ps = this.P.map((p, i) => ({
        x: SPAWN[i][0], y: SPAWN[i][1], vx: 0, vy: 0, r: 22, face: 0, walk: 0, coins: 0, found: 0, booms: 0,
        dig: 0, digCell: -1, stun: 0, fly: 0, dashT: 0, dashCd: 0, pulse: 0, ping: 0, skip: false,
        goal: -1, goalT: 0,
      }));
    }

    cellAt(x, y) {
      const cx = Math.floor((x - AX) / CS), cy = Math.floor((y - AY) / CS);
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return -1;
      return cy * COLS + cx;
    }
    cellXY(k) { return [AX + (k % COLS + 0.5) * CS, AY + (Math.floor(k / COLS) + 0.5) * CS]; }

    hideChest() {
      for (let tries = 0; tries < 80; tries++) {
        const k = U.randi(0, this.grid.length - 1), g = this.grid[k];
        if (g.dug || g.mine || g.chest) continue;
        if (this.chests.some((c) => { const [x, y] = this.cellXY(c.k), [x2, y2] = this.cellXY(k); return Math.hypot(x - x2, y - y2) < CS * 3; })) continue;
        const gold = Math.random() < 0.15;
        const c = { k, val: gold ? 120 : U.randi(3, 7) * 10, gold, shown: false, open: 0, opener: -1, popT: 0 };
        g.chest = c; this.chests.push(c);
        return;
      }
    }

    /** khoảng cách tới rương chưa lộ gần nhất (cho radar) */
    radar(p) {
      let d = Infinity;
      for (const c of this.chests) if (!c.shown) { const [x, y] = this.cellXY(c.k); d = Math.min(d, Math.hypot(x - p.x, y - p.y)); }
      return d;
    }

    explode(k, i) {
      const g = this.grid[k], p = this.ps[i], parts = this.api.parts, [x, y] = this.cellXY(k);
      g.mine = false; g.crack = false; g.dug = 1; g.boom = 1;
      const lose = Math.min(p.coins, 30);
      p.coins -= lose; p.booms++; p.stun = 1.8; p.dig = 0; p.fly = 0;
      Sfx.play('boom'); FX.shake(10); Party.rumble(i);
      parts.burst(x, y, ['#ff8a3d', '#ffe14d', '#3a2a1a'], 30, 340, 0.7, 7);
      parts.text(x, y - 40, lose ? `💥 −${lose}` : '💥', '#ff6b6b', 30);
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt; this.elapsed += dt;
        if (this.time <= 0) { this.time = 0; this.finished = true; }
      }
      for (const c of this.chests) if (c.shown) c.popT += dt;
      for (const g of this.grid) if (g.boom > 0) g.boom -= dt * 0.7;

      this.ps.forEach((p, i) => {
        const q = this.finished ? {} : inp[i];
        p.stun -= dt; p.dashT -= dt; p.dashCd -= dt; p.fly -= dt;
        // radar
        const d = this.radar(p), period = U.clamp(d / 380, 0.12, 1.3);
        p.pulse += dt / period;
        if (p.pulse >= 1) { p.pulse -= 1; p.ping = 1; }
        p.ping = Math.max(0, p.ping - dt * 3);
        const k = this.cellAt(p.x, p.y), g = k >= 0 ? this.grid[k] : null;
        // bị húc văng vào ô có mìn
        if (p.fly > 0 && g && g.mine) { this.explode(k, i); return; }
        if (p.stun > 0) { p.vx *= Math.pow(0.03, dt); p.vy *= Math.pow(0.03, dt); p.dig = 0; }
        else {
          const digging = q.act && g && !this.finished;
          if (digging) {
            p.vx *= Math.pow(0.001, dt); p.vy *= Math.pow(0.001, dt);
            if (g.chest && g.chest.shown) {
              // mở rương đã lộ
              const c = g.chest;
              if (c.opener !== i) { c.opener = i; c.open = Math.max(0, c.open - 0.3); }
              c.open += dt;
              if (c.open >= OPEN_T) {
                p.coins += c.val; p.found++; Sfx.play('crown');
                const [x, y] = this.cellXY(k);
                parts.text(x, y - 46, `+${c.val}`, '#ffe14d', 32); parts.burst(x, y, ['#ffe14d', '#fff'], 22, 260, 0.6, 6);
                g.chest = null; this.chests = this.chests.filter((cc) => cc !== c); this.hideChest();
              }
            } else if (!g.dug) {
              if (p.digCell !== k) { p.digCell = k; p.dig = 0; }
              p.dig += dt;
              if (Math.random() < dt * 10) parts.burst(p.x, p.y + 14, '#c9a26b', 1, 80, 0.4, 4);
              if (p.dig >= DIG_T) {
                p.dig = 0; g.dug = 1;
                if (g.mine) { this.explode(k, i); return; }
                if (g.chest) { g.chest.shown = true; g.chest.opener = i; Sfx.play('pickup'); parts.text(p.x, p.y - 50, 'Rương!', '#ffe14d', 26); }
                else { Sfx.play('place', 0.05); }
              }
            }
          } else p.dig = Math.max(0, p.dig - dt * 2);
          if (!digging) {
            if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
            if (q.jumpP && p.dashCd <= 0) { p.dashT = 0.22; p.dashCd = 1.2; p.vx = Math.cos(p.face) * 700; p.vy = Math.sin(p.face) * 700; Sfx.play('dash'); }
            if (p.dashT <= 0) { const kk = Math.min(1, dt * 10); p.vx += ((q.mx || 0) * 270 - p.vx) * kk; p.vy += ((q.my || 0) * 270 - p.vy) * kk; }
          }
        }
        p.x = U.clamp(p.x + p.vx * dt, AX + p.r, AX + AW - p.r);
        p.y = U.clamp(p.y + p.vy * dt, AY + p.r, AY + AH - p.r);
      });
      Phys.separate(this.ps, 0.5, (a, b, nx, ny) => {
        const hit = (atk, vic, sx, sy) => {
          if (atk.dashT <= 0) return;
          atk.dashT = 0; vic.stun = 0.7; vic.fly = 0.35; vic.dig = 0; vic.vx = sx * 520; vic.vy = sy * 520;
          Sfx.play('hit'); FX.shake(5);
          const vi = this.ps.indexOf(vic);
          for (const c of this.chests) if (c.opener === vi) c.opener = -1;
        };
        hit(a, b, nx, ny); hit(b, a, -nx, -ny);
      });
    }

    draw(ctx) {
      ctx.fillStyle = '#2a4a6b'; ctx.fillRect(0, 0, W, H);
      Draw.rr(ctx, AX - 12, AY - 12, AW + 24, AH + 24, 22); ctx.fillStyle = '#8a6a3a'; ctx.fill();
      const t = U.now();
      this.grid.forEach((g, k) => {
        const [x, y] = this.cellXY(k), cx = x - CS / 2, cy = y - CS / 2;
        ctx.fillStyle = (k % COLS + Math.floor(k / COLS)) % 2 ? '#e6c98e' : '#dfc085';
        ctx.fillRect(cx, cy, CS, CS);
        if (g.crack && !g.dug) {
          ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx + 18, cy + 20); ctx.lineTo(cx + 30, cy + 30); ctx.lineTo(cx + 26, cy + 42); ctx.moveTo(cx + 30, cy + 30); ctx.lineTo(cx + 44, cy + 28); ctx.stroke();
        }
        if (g.dug) {
          ctx.fillStyle = g.boom > 0 ? `rgba(40,25,15,${0.6 + g.boom * 0.4})` : 'rgba(110,75,40,0.7)';
          ctx.beginPath(); ctx.ellipse(x, y + 4, CS * 0.36, CS * 0.26, 0, 0, TAU); ctx.fill();
        }
      });
      // rương đã lộ
      for (const c of this.chests) {
        if (!c.shown) continue;
        const [x, y] = this.cellXY(c.k), s = U.outBack(Math.min(1, c.popT / 0.3));
        ctx.save(); ctx.translate(x, y - 4); ctx.scale(s, s);
        ctx.fillStyle = c.gold ? '#e8b923' : '#9c5a2a'; Draw.rr(ctx, -22, -10, 44, 26, 5); ctx.fill();
        ctx.fillStyle = c.gold ? '#ffd84d' : '#b8743b'; Draw.rr(ctx, -24, -20, 48, 13, 6); ctx.fill();
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-3, -10, 6, 9);
        ctx.restore();
        Draw.text(ctx, String(c.val), x, y - 34, { size: 16, color: '#ffe14d', sw: 4 });
        if (c.open > 0) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * c.open / OPEN_T); ctx.stroke(); }
      }
      // radar dưới chân
      this.ps.forEach((p, i) => {
        const d = this.radar(p), hot = U.clamp(1 - d / 600, 0, 1);
        const col = `rgba(${Math.round(80 + 175 * hot)},${Math.round(180 - 120 * hot)},${Math.round(255 - 200 * hot)},${0.25 + p.ping * 0.6})`;
        ctx.strokeStyle = col; ctx.lineWidth = 3 + p.ping * 3;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.7, p.r * (1.1 + (1 - p.ping) * 0.5), p.r * (0.4 + (1 - p.ping) * 0.18), 0, 0, TAU); ctx.stroke();
        void i;
      });
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk, stun: p.stun > 0, squash: p.dig > 0 ? Math.sin(t * 30) * 0.06 : 0 });
        if (p.dig > 0) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(p.x, p.y - 4, p.r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * p.dig / DIG_T); ctx.stroke();
          Draw.text(ctx, '⛏️', p.x + p.r, p.y - p.r - 4, { size: 20, stroke: null });
        }
      }
      Draw.chips(ctx, this.P, this.ps.map((p) => `🪙 ${p.coins}`), { w: 170 });
      Draw.timer(ctx, this.time, W - 72, 38);
      if (this.elapsed < 5) Draw.text(ctx, 'Radar nháy nhanh = gần rương · Giữ Đánh: đào / mở rương · Nhảy: húc · Ô nứt có thể có mìn!', W / 2, H - 10, { size: 16, color: '#ffe14d', sw: 4 });
    }

    results() {
      return this.ps.map((p) => ({ score: p.coins, text: `🪙 ${p.coins} · ${p.found} rương · nổ ${p.booms}` }));
    }

    botInput(i) {
      const p = this.ps[i], o = { mx: 0, my: 0, act: false, jumpP: false };
      if (this.finished || p.stun > 0) return o;
      const lv = this.api.bot;
      const k = this.cellAt(p.x, p.y);
      // rương đã lộ gần đó: chạy tới mở; có người khác đang mở thì húc
      const shown = this.chests.filter((c) => c.shown).map((c) => ({ c, d: Math.hypot(this.cellXY(c.k)[0] - p.x, this.cellXY(c.k)[1] - p.y) })).sort((a, b) => a.d - b.d)[0];
      if (shown && shown.d < 320) {
        const [x, y] = this.cellXY(shown.c.k);
        if (k === shown.c.k) { o.act = true; return o; }
        const op = shown.c.opener >= 0 && shown.c.opener !== i ? this.ps[shown.c.opener] : null;
        const tx = op ? op.x : x, ty = op ? op.y : y, d = Math.hypot(tx - p.x, ty - p.y) || 1;
        o.mx = (tx - p.x) / d; o.my = (ty - p.y) / d;
        if (op && d < 110 && p.dashCd <= 0) o.jumpP = true;
        return o;
      }
      // đang đào dở thì đào tiếp
      if (p.dig > 0 && k === p.digCell) { o.act = true; return o; }
      // chọn ô đích: rương thật gần nhất + sai số theo mức (giống đọc radar không chuẩn)
      p.goalT -= 1 / 60;
      if (p.goal < 0 || p.goalT <= 0 || this.grid[p.goal].dug) {
        let best = null, bd = Infinity;
        for (const c of this.chests) if (!c.shown) {
          const [x, y] = this.cellXY(c.k), d = Math.hypot(x - p.x, y - p.y);
          // rương máy khác đang nhắm (và ở gần nó hơn) thì nhường
          const taken = this.ps.some((q, j) => j !== i && q.goalChest === c && Math.hypot(x - q.x, y - q.y) < d);
          if (!taken && d < bd) { bd = d; best = c; }
        }
        p.goalChest = best;
        if (best) {
          const far = bd > 200, err = lv.actDrop > 0.4 ? (far ? 2 : 1) : lv.actDrop > 0.1 && far ? 1 : 0; // dò radar: ở xa thì đoán lệch, lại gần thì chuẩn hơn, Khó gần như đúng khi tới gần
          let gk = best.k;
          for (let tries = 0; tries < 12; tries++) {
            const cx = U.clamp(best.k % COLS + U.randi(-err, err), 0, COLS - 1), cy = U.clamp(Math.floor(best.k / COLS) + U.randi(-err, err), 0, ROWS - 1);
            const kk = cy * COLS + cx, g = this.grid[kk];
            if (g.dug) continue;
            if (g.crack && Math.random() < 1 - lv.actDrop * 0.8) continue; // né ô nứt (Khó né gần hết)
            gk = kk; break;
          }
          p.goal = gk; p.goalT = U.rand(1.5, 3);
        }
      }
      if (p.goal < 0) return o;
      if (k === p.goal && !this.grid[k].dug) { o.act = true; return o; }
      const [gx, gy] = this.cellXY(p.goal), d = Math.hypot(gx - p.x, gy - p.y) || 1;
      o.mx = (gx - p.x) / d; o.my = (gy - p.y) / d;
      // né ô nứt trên đường đi khi bị đẩy? đơn giản: húc người đứng chắn gần đó đôi khi
      for (const [j, q] of this.ps.entries()) if (j !== i && q.dig > 0 && Math.hypot(q.x - p.x, q.y - p.y) < 90 && p.dashCd <= 0 && Math.random() < 0.03) {
        const a = Math.atan2(q.y - p.y, q.x - p.x); o.mx = Math.cos(a); o.my = Math.sin(a); o.jumpP = true;
      }
      return o;
    }
  }

  Party.register({
    id: 'treasure', name: 'Đào Kho Báu', emoji: '⛏️', cat: 'collect',
    tagline: 'Dò radar, đào rương, húc đối thủ vào ô có mìn',
    how: 'Vòng radar dưới chân nháy càng nhanh và càng đỏ khi bạn càng gần một rương chôn dưới cát. Đứng trên ô và giữ Đánh để đào; trúng rương thì rương lộ ra — giữ Đánh thêm chút nữa để mở lấy tiền (rương vàng nhiều tiền hơn). '
      + 'Ô có vết nứt có thể chôn mìn: đào trúng là nổ, mất tiền và choáng. Nhảy = lao húc: đẩy người đang mở rương ra để cướp, hoặc húc họ văng vào ô có mìn!',
    controls: { move: 'Chạy', act: 'Giữ: đào / mở rương', jump: 'Lao húc' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Treasure(api),
  });
})();

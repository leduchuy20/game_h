'use strict';
/* Đặt Bom — kiểu Bomberman. Phá hộp, nhặt đồ, nổ trúng đối thủ. Mỗi người 3 tim. */
(() => {
  const COLS = 17, ROWS = 13, T = 50;
  const OX = (W - COLS * T) / 2, OY = (H - ROWS * T) / 2;
  const SPAWNS = [[1, 1], [COLS - 2, ROWS - 2], [COLS - 2, 1], [1, ROWS - 2]];
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const FUSE = 2.3, FLAME = 0.55, GAME_TIME = 120;
  const ITEM_ICON = { bomb: '💣', fire: '🔥', speed: '👟', kick: '👢', glove: '🧤', remote: '📡' };
  const ITEM_NAME = { bomb: '+1 bom', fire: '+1 lửa', speed: 'Nhanh hơn', kick: 'Đá bom!', glove: 'Găng ném bom!', remote: 'Bom hẹn giờ!' };
  const SLIDE = 8, FLY = 0.55, THROW = 3, REMOTE_MAX = 7, GHOST_CD = 5;
  const PARRY_WIN = 0.4;   // BOM6: bấm Nhảy trong 40% cuối đường bay để đánh bật bom

  class Bomb {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.grid = new Uint8Array(COLS * ROWS);   // 0 trống, 1 tường, 2 hộp
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          let t = 0;
          if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0)) t = 1;
          else {
            const nearSpawn = SPAWNS.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 3);
            if (!nearSpawn && Math.random() < 0.68) t = 2;
          }
          this.grid[y * COLS + x] = t;
        }
      }
      this.items = new Map();
      this.bombs = []; this.flames = [];
      this.ps = this.P.map((p, i) => ({
        x: SPAWNS[i][0], y: SPAWNS[i][1], face: Math.PI / 2, walk: 0,
        speed: 3.6, maxB: 1, range: 2, hearts: 3, inv: 0, alive: true, deadT: 0, kills: 0, placed: 0, deathTime: 0,
        kick: false, glove: false, remote: false, dirx: 0, diry: 1, gs: 0, gCd: 3, parryT: 0,
      }));
      this.time = this.total = api.T(GAME_TIME); this.sd = Math.min(45, Math.round(this.total * 0.45)); this.elapsed = 0;
      this.finished = false;
      // vòng tử thần: 45 giây cuối tường khép dần từ ngoài vào (theo hình xoắn ốc)
      this.spiral = [];
      for (let k = 1; k <= 6; k++) {
        const x0 = k, y0 = k, x1 = COLS - 1 - k, y1 = ROWS - 1 - k;
        for (let x = x0; x <= x1; x++) this.spiral.push([x, y0]);
        for (let y = y0 + 1; y <= y1; y++) this.spiral.push([x1, y]);
        for (let x = x1 - 1; x >= x0; x--) this.spiral.push([x, y1]);
        for (let y = y1 - 1; y > y0; y--) this.spiral.push([x0, y]);
      }
      this.spiralIdx = 0; this.closeT = 0; this.suddenAnnounced = false;
      this.bot = this.P.map(() => ({ cd: U.rand(0.3, 0.8) }));
    }

    idx(x, y) { return y * COLS + x; }
    tile(x, y) { return (x < 0 || y < 0 || x >= COLS || y >= ROWS) ? 1 : this.grid[y * COLS + x]; }
    bombAt(x, y) { return this.bombs.find((b) => !b.fly && b.tx === x && b.ty === y); }
    solidFor(x, y, pi) {
      if (this.tile(x, y)) return true;
      const b = this.bombAt(x, y);
      return !!(b && !b.pass.has(pi));
    }

    /* Di chuyển theo "đường ray" lưới, tự căn giữa để dễ rẽ góc. */
    move(p, i, dx, dy, dist) {
      // trục di chuyển chính: a; trục vuông góc: b
      const A = dx ? 'x' : 'y', Bk = dx ? 'y' : 'x', s = dx || dy;
      const solid = (a, b) => (dx ? this.solidFor(a, b, i) : this.solidFor(b, a, i));
      const ca = Math.round(p[A]), cb = Math.round(p[Bk]);
      const off = p[Bk] - cb;
      if (Math.abs(off) > 0.001) {
        let target = cb;
        const other = cb + Math.sign(off);
        if (solid(ca + s, cb) && !solid(ca + s, other) && !solid(ca, other)) target = other;
        const need = target - p[Bk];
        const m = Math.min(Math.abs(need), dist);
        p[Bk] += Math.sign(need) * m;
        dist -= m;
        if (Math.abs(p[Bk] - Math.round(p[Bk])) > 0.001) return;
        p[Bk] = Math.round(p[Bk]);
      }
      const rb = Math.round(p[Bk]), col = Math.round(p[A]);
      let na = p[A] + s * dist;
      if (solid(col + s, rb)) na = s > 0 ? Math.min(na, col) : Math.max(na, col);
      p[A] = na;
    }

    placeBomb(p, i) {
      const cx = Math.round(p.x), cy = Math.round(p.y);
      if (p.placed >= p.maxB || this.bombAt(cx, cy) || this.tile(cx, cy)) return false;
      const pass = new Set();
      this.ps.forEach((o, j) => { if (o.alive && Math.abs(o.x - cx) < 0.95 && Math.abs(o.y - cy) < 0.95) pass.add(j); });
      this.bombs.push({ tx: cx, ty: cy, t: p.remote ? REMOTE_MAX : FUSE, remote: p.remote, range: p.range, owner: i, pass, prog: 0, slide: null, fly: null });
      p.placed++;
      Sfx.play('place');
      return true;
    }

    explode(b) {
      this.bombs.splice(this.bombs.indexOf(b), 1);
      if (!b.ghost) this.ps[b.owner].placed--;
      Sfx.play('boom', 0.05); FX.shake(8);
      const parts = this.api.parts;
      const addFlame = (x, y, kind) => {
        this.flames.push({ tx: x, ty: y, t: FLAME, owner: b.owner, kind });
        const it = this.items.get(this.idx(x, y));
        if (it && it.safe <= 0) { this.items.delete(this.idx(x, y)); }
      };
      addFlame(b.tx, b.ty, 'c');
      for (const [dx, dy] of DIRS) {
        for (let k = 1; k <= b.range; k++) {
          const x = b.tx + dx * k, y = b.ty + dy * k, t = this.tile(x, y);
          if (t === 1) break;
          if (t === 2) {
            this.grid[this.idx(x, y)] = 0;
            addFlame(x, y, dx ? 'h' : 'v');
            parts.burst(OX + x * T + T / 2, OY + y * T + T / 2, ['#c98b4a', '#8f5a26', '#f0c27a'], 10, 200, 0.5, 6, { g: 400 });
            if (Math.random() < 0.38) {
              const r = Math.random();
              const type = r < 0.32 ? 'bomb' : r < 0.62 ? 'fire' : r < 0.77 ? 'speed' : r < 0.87 ? 'kick' : r < 0.94 ? 'glove' : 'remote';
              this.items.set(this.idx(x, y), { type, safe: 0.6 });
            }
            break;
          }
          const ob = this.bombAt(x, y);
          addFlame(x, y, dx ? 'h' : 'v');
          if (ob) { ob.t = 0; ob.remote = false; break; }
        }
      }
    }

    /** ô trống cho bom trượt / rơi xuống: không tường, không hộp, không bom, không người */
    cellFree(x, y, ignorePlayers) {
      if (this.tile(x, y) || this.bombAt(x, y)) return false;
      if (ignorePlayers) return true;
      return !this.ps.some((o) => o.alive && Math.round(o.x) === x && Math.round(o.y) === y);
    }
    kickBomb(b, dx, dy) {
      if (b.slide || !this.cellFree(b.tx + dx, b.ty + dy)) return;
      b.slide = [dx, dy]; b.prog = 0; Sfx.play('kick');
    }
    /** ném bom bay qua tường (găng / ma báo thù / đánh bật). Rơi xuống ô trống đầu tiên từ khoảng cách dist */
    throwBomb(b, dx, dy, dist, fromX, fromY) {
      let lx = -1, ly = -1;
      for (let k = dist; k <= dist + 4; k++) {
        const x = fromX + dx * k, y = fromY + dy * k;
        if (x < 1 || y < 1 || x > COLS - 2 || y > ROWS - 2) break;
        if (this.cellFree(x, y, true)) { lx = x; ly = y; break; }
      }
      if (lx < 0) { for (let k = dist - 1; k >= 1; k--) { const x = fromX + dx * k, y = fromY + dy * k; if (this.cellFree(x, y, true)) { lx = x; ly = y; break; } } }
      if (lx < 0) return false;
      b.fly = { fx: fromX, fy: fromY, t: 0, dx, dy };
      b.tx = lx; b.ty = ly; b.slide = null; b.pass = new Set();
      Sfx.play('jump');
      return true;
    }
    perimeter() {
      const top = COLS - 1, side = ROWS - 1;
      return { top, side, len: 2 * (top + side) };
    }
    /** vị trí ma trên vòng tường ngoài: trả [x, y, nx, ny] (ny,nx = hướng vào trong) */
    ghostCell(gs) {
      const { top, side, len } = this.perimeter();
      let s = ((gs % len) + len) % len;
      if (s < top) return [s, 0, 0, 1];
      s -= top; if (s < side) return [COLS - 1, s, -1, 0];
      s -= side; if (s < top) return [COLS - 1 - s, ROWS - 1, 0, -1];
      s -= top; return [0, ROWS - 1 - s, 1, 0];
    }
    updateGhost(p, i, q, dt) {
      const [, , nx, ny] = this.ghostCell(p.gs);
      const tx = ny, ty = -nx;   // tiếp tuyến (đi theo chiều kim đồng hồ)
      p.gs += -(q.mx * tx + q.my * ty) * 6 * dt;
      if (Math.abs(q.mx) + Math.abs(q.my) > 0.2) p.walk += dt * 10;
      p.gCd -= dt;
      if (q.actP && p.gCd <= 0 && !this.finished) {
        const [gx, gy] = this.ghostCell(Math.round(p.gs));
        const b = { tx: gx, ty: gy, t: FUSE, range: 1, owner: i, ghost: true, pass: new Set(), prog: 0, slide: null, fly: null };
        if (this.throwBomb(b, nx, ny, 3, gx, gy)) { this.bombs.push(b); p.gCd = GHOST_CD; }
      }
    }

    hurt(p, i, owner) {
      p.hearts--; p.inv = 2;
      Sfx.play('hurt'); FX.shake(6); Party.rumble(i);
      const px = OX + p.x * T + T / 2, py = OY + p.y * T + T / 2;
      this.api.parts.burst(px, py, this.P[i].color.main, 14, 220, 0.5, 6);
      if (owner !== i && owner >= 0) this.ps[owner].kills++;
      if (p.hearts <= 0) {
        p.alive = false; p.deathTime = this.elapsed;
        this.api.parts.text(px, py - 30, 'Bị loại! 👻', '#fff', 30);
        // BOM3: thành ma báo thù trên vòng tường gần chỗ bị loại
        const { top, side } = this.perimeter();
        const cands = [[p.x, 0, p.x], [COLS - 1, p.y, top + p.y], [p.x, ROWS - 1, top + side + (COLS - 1 - p.x)], [0, p.y, 2 * top + side + (ROWS - 1 - p.y)]];
        cands.sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.y) - Math.hypot(b[0] - p.x, b[1] - p.y));
        p.gs = cands[0][2]; p.gCd = 2.5;
      }
    }

    update(dt, inp) {
      if (!this.finished) { this.time -= dt; this.elapsed += dt; }
      const parts = this.api.parts;
      this.ps.forEach((p, i) => {
        if (!p.alive) { p.deadT += dt; if (this.n > 2) this.updateGhost(p, i, inp[i], dt); return; }
        p.inv -= dt;
        const q = inp[i];
        let dx = 0, dy = 0;
        if (Math.abs(q.mx) > 0.3 || Math.abs(q.my) > 0.3) {
          if (Math.abs(q.mx) >= Math.abs(q.my)) dx = Math.sign(q.mx); else dy = Math.sign(q.my);
        }
        if (dx || dy) {
          p.face = Math.atan2(dy, dx); p.walk += dt * 14; p.dirx = dx; p.diry = dy;
          this.move(p, i, dx, dy, p.speed * dt * (this.P[i].bot ? this.api.botOf(i).speed : 1));
          // BOM1 đá bom: có 👢 mà đi thẳng vào quả bom phía trước thì bom trượt đi
          if (p.kick) {
            const cx = Math.round(p.x), cy = Math.round(p.y), b = this.bombAt(cx + dx, cy + dy);
            const gap = dx ? Math.abs(p.x - cx) : Math.abs(p.y - cy);
            if (b && !b.pass.has(i) && gap < 0.08) this.kickBomb(b, dx, dy);
          }
        }
        for (const b of this.bombs) {
          if (b.pass.has(i) && (Math.abs(p.x - b.tx) >= 0.95 || Math.abs(p.y - b.ty) >= 0.95)) b.pass.delete(i);
        }
        if (q.actP && !this.finished) {
          // BOM1 găng: đứng trên quả bom (vừa đặt) mà bấm Đánh → ném bom qua tường
          const cx = Math.round(p.x), cy = Math.round(p.y), b = this.bombAt(cx, cy);
          if (p.glove && b && !b.slide) this.throwBomb(b, p.dirx, p.diry, THROW, cx, cy);
          else this.placeBomb(p, i);
        }
        if (q.jumpP && !this.finished) {
          // BOM6: quả bom đang bay sắp rơi gần mình → đánh bật ngược lại
          const fb = this.bombs.find((b) => b.fly && b.fly.t / FLY > 1 - PARRY_WIN && Math.abs(b.tx - p.x) + Math.abs(b.ty - p.y) <= 1.5);
          if (fb) {
            this.throwBomb(fb, -fb.fly.dx, -fb.fly.dy, THROW, fb.tx, fb.ty);
            p.parryT = 0.4; Sfx.play('hit'); FX.shake(4);
            parts.text(OX + p.x * T + T / 2, OY + p.y * T - 10, 'Đánh bật!', '#9fd8ff', 24);
          } else if (p.remote) {
            // BOM1 bom hẹn giờ: bấm Nhảy cho nổ các quả bom của mình
            for (const b of this.bombs) if (b.owner === i && !b.ghost && b.remote && !b.fly) { b.t = 0; b.remote = false; }
          }
        }
        p.parryT -= dt;
        const k = this.idx(Math.round(p.x), Math.round(p.y));
        const it = this.items.get(k);
        if (it) {
          this.items.delete(k);
          if (it.type === 'bomb') p.maxB = Math.min(6, p.maxB + 1);
          if (it.type === 'fire') p.range = Math.min(8, p.range + 1);
          if (it.type === 'speed') p.speed = Math.min(5.6, p.speed + 0.5);
          if (it.type === 'kick') p.kick = true;
          if (it.type === 'glove') p.glove = true;
          if (it.type === 'remote') p.remote = true;
          Sfx.play('pickup');
          parts.text(OX + p.x * T + T / 2, OY + p.y * T, ITEM_NAME[it.type], '#ffe14d', 22);
        }
      });
      for (const it of this.items.values()) it.safe -= dt;

      for (const b of this.bombs) {
        if (b.fly) {
          b.fly.t += dt;
          if (b.fly.t >= FLY) {
            b.fly = null;
            // rơi trúng ô đã có bom/hộp (do thay đổi lúc bay) → nổ ngay
            if (this.tile(b.tx, b.ty) || this.bombs.some((o) => o !== b && !o.fly && o.tx === b.tx && o.ty === b.ty)) b.t = 0;
            Sfx.play('place', 0.05);
          }
          continue;   // đang bay: không đếm giờ
        }
        b.t -= dt;
        if (b.slide) {
          b.prog += SLIDE * dt;
          while (b.slide && b.prog >= 1) {
            const [dx, dy] = b.slide;
            b.prog -= 1; b.tx += dx; b.ty += dy;
            if (!this.cellFree(b.tx + dx, b.ty + dy)) { b.slide = null; b.prog = 0; }
          }
        }
      }
      let again = true;
      while (again) {
        again = false;
        for (const b of this.bombs.slice()) if (b.t <= 0) { this.explode(b); again = true; }
      }
      for (const f of this.flames) f.t -= dt;
      this.flames = this.flames.filter((f) => f.t > 0);

      if (!this.finished && this.time <= this.sd) {
        if (!this.suddenAnnounced) {
          this.suddenAnnounced = true; Sfx.play('warn');
          parts.text(W / 2, H / 2, 'Tường đang khép lại!', '#ffe14d', 48);
        }
        this.closeT -= dt;
        while (this.closeT <= 0 && this.spiralIdx < this.spiral.length) {
          this.closeT += this.sd / this.spiral.length;
          const [x, y] = this.spiral[this.spiralIdx++];
          const k = this.idx(x, y);
          if (this.grid[k] === 1) continue;
          this.grid[k] = 1;
          this.items.delete(k);
          const b = this.bombAt(x, y);
          if (b) { this.bombs.splice(this.bombs.indexOf(b), 1); if (!b.ghost) this.ps[b.owner].placed--; }
          Sfx.play('place', 0.05);
          this.ps.forEach((p, i) => {
            if (p.alive && Math.round(p.x) === x && Math.round(p.y) === y) { p.hearts = 1; p.inv = 0; this.hurt(p, i, -1); }
          });
        }
      }

      if (!this.finished) {
        const hot = new Map();
        for (const f of this.flames) if (f.t > 0.08) hot.set(this.idx(f.tx, f.ty), f.owner);
        this.ps.forEach((p, i) => {
          if (!p.alive || p.inv > 0) return;
          const k = this.idx(Math.round(p.x), Math.round(p.y));
          if (hot.has(k)) this.hurt(p, i, hot.get(k));
        });
        const alive = this.ps.filter((p) => p.alive).length;
        if (alive <= 1 || this.time <= 0) this.finished = true;
      }
    }

    /* ---------- vẽ ---------- */
    draw(ctx) {
      ctx.fillStyle = '#2b5d34'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 20, H);
      // sàn
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const px = OX + x * T, py = OY + y * T;
          ctx.fillStyle = (x + y) % 2 ? '#86cf6c' : '#7cc463';
          ctx.fillRect(px, py, T, T);
        }
      }
      // vật phẩm
      const t = U.now();
      for (const [k, it] of this.items) {
        const x = k % COLS, y = Math.floor(k / COLS);
        const px = OX + x * T + T / 2, py = OY + y * T + T / 2 + Math.sin(t * 4 + k) * 3;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(px, py, 18, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.stroke();
        ctx.font = `24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ITEM_ICON[it.type], px, py + 1);
      }
      // tường & hộp
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const v = this.grid[y * COLS + x];
          if (!v) continue;
          const px = OX + x * T, py = OY + y * T;
          if (v === 1) {
            ctx.fillStyle = '#5b5e78'; ctx.fillRect(px, py, T, T);
            ctx.fillStyle = '#8d90ad'; ctx.fillRect(px + 3, py + 3, T - 6, T - 12);
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(px + 6, py + 6, T - 12, 6);
          } else {
            ctx.fillStyle = '#7a4a1e'; ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
            ctx.fillStyle = '#c98b4a'; ctx.fillRect(px + 5, py + 5, T - 10, T - 12);
            ctx.strokeStyle = '#8f5a26'; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(px + 8, py + 8); ctx.lineTo(px + T - 8, py + T - 12);
            ctx.moveTo(px + T - 8, py + 8); ctx.lineTo(px + 8, py + T - 12);
            ctx.stroke();
          }
        }
      }
      // bom
      for (const b of this.bombs) {
        let bx = b.tx, by = b.ty, lift = 0;
        if (b.slide) { bx += b.slide[0] * b.prog; by += b.slide[1] * b.prog; }
        if (b.fly) {
          const k = b.fly.t / FLY;
          bx = U.lerp(b.fly.fx, b.tx, k); by = U.lerp(b.fly.fy, b.ty, k); lift = Math.sin(k * Math.PI) * 70;
          // vòng đỏ báo chỗ rơi; vòng xanh = đang trong lúc đánh bật được
          const lx = OX + b.tx * T + T / 2, ly = OY + b.ty * T + T / 2;
          ctx.strokeStyle = k > 1 - PARRY_WIN ? '#9fd8ff' : '#ff3b52'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(lx, ly, 22 * (1.4 - k * 0.6), 0, TAU); ctx.stroke();
        }
        const px = OX + bx * T + T / 2, py = OY + by * T + T / 2;
        const el = b.remote ? 1 : FUSE - b.t;
        const pulse = 1 + Math.sin(el * (6 + el * 6)) * 0.08;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(px, py + 16, 17, 6, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(px, py - lift); ctx.scale(pulse, pulse);
        const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 20);
        g.addColorStop(0, '#6b6b85'); g.addColorStop(1, '#1b1b29');
        ctx.fillStyle = b.t < 0.6 && Math.sin(t * 40) > 0 ? '#e83a5c' : g;
        ctx.beginPath(); ctx.arc(0, 2, 18, 0, TAU); ctx.fill();
        if (b.remote) { ctx.fillStyle = '#5fc8ff'; ctx.beginPath(); ctx.arc(0, 2, 6, 0, TAU); ctx.fill(); }
        if (b.ghost) { ctx.strokeStyle = 'rgba(200,180,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 2, 20, 0, TAU); ctx.stroke(); }
        ctx.strokeStyle = '#d9c08a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(4, -14); ctx.quadraticCurveTo(10, -24, 16, -20); ctx.stroke();
        Draw.sparkle(ctx, 16, -21, 6 + Math.random() * 3, '#ffe14d');
        ctx.restore();
      }
      // lửa
      for (const f of this.flames) {
        const a = f.t / FLAME, px = OX + f.tx * T, py = OY + f.ty * T;
        const s = 0.55 + 0.45 * Math.sin(a * Math.PI);
        ctx.globalAlpha = Math.min(1, a * 2.5);
        const w = f.kind === 'v' ? T * 0.6 * s : T, h = f.kind === 'h' ? T * 0.6 * s : T;
        const ww = f.kind === 'c' ? T * (0.7 + 0.3 * s) : w, hh = f.kind === 'c' ? T * (0.7 + 0.3 * s) : h;
        ctx.fillStyle = '#ff7a1a';
        Draw.rr(ctx, px + (T - ww) / 2, py + (T - hh) / 2, ww, hh, 12); ctx.fill();
        ctx.fillStyle = '#ffe14d';
        Draw.rr(ctx, px + (T - ww * 0.6) / 2, py + (T - hh * 0.6) / 2, ww * 0.6, hh * 0.6, 8); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // người chơi
      const order = this.ps.map((p, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        const px = OX + p.x * T + T / 2, py = OY + p.y * T + T / 2 - 4;
        if (!p.alive) {
          if (p.deadT < 1) Draw.blob(ctx, { x: px, y: py, r: 21, color: this.P[i].color, face: p.face, dead: true, scale: 1 - p.deadT, alpha: 1 - p.deadT });
          if (this.n > 2 && p.deadT >= 0.6) this.drawGhost(ctx, p, i);
          continue;
        }
        const blink = p.inv > 0 && Math.sin(t * 30) > 0;
        Draw.blob(ctx, { x: px, y: py, r: 21, color: this.P[i].color, face: p.face, walk: p.walk, alpha: blink ? 0.35 : 1 });
        if (p.parryT > 0) { ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px, py, 30 + (0.4 - p.parryT) * 40, 0, TAU); ctx.stroke(); }
      }
      this.drawPanels(ctx);
    }

    drawGhost(ctx, p, i) {
      const [gx, gy] = this.ghostCell(p.gs), t = U.now();
      const x = OX + gx * T + T / 2, y = OY + gy * T + T / 2 + Math.sin(t * 3 + i) * 4;
      ctx.save(); ctx.globalAlpha = 0.75;
      ctx.fillStyle = this.P[i].color.light;
      ctx.beginPath(); ctx.arc(x, y - 4, 18, Math.PI, 0); ctx.lineTo(x + 18, y + 14);
      for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(x + 13 - k * 9, y + 22 - (k % 2) * 8, x + 9 - k * 9, y + 14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1d1230'; ctx.beginPath(); ctx.arc(x - 6, y - 6, 3, 0, TAU); ctx.arc(x + 6, y - 6, 3, 0, TAU); ctx.fill();
      ctx.restore();
      if (p.gCd > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.gCd / GHOST_CD)); ctx.stroke();
      } else Draw.text(ctx, '💣', x, y - 30, { size: 16, stroke: null });
    }

    drawPanels(ctx) {
      // trái: P1 (trên), P4 (dưới) · phải: P3 (trên), P2 (dưới) — theo góc xuất phát
      const pos = [[12, 60], [W - OX + 12, 470], [W - OX + 12, 60], [12, 470]];
      const pw = OX - 24, ph = 190;
      this.ps.forEach((p, i) => {
        const [x, y] = pos[i], c = this.P[i].color;
        ctx.save();
        if (!p.alive) ctx.globalAlpha = 0.45;
        Draw.rr(ctx, x, y, pw, ph, 22);
        ctx.fillStyle = 'rgba(15,30,20,0.6)'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = c.main; ctx.stroke();
        Draw.blob(ctx, { x: x + 40, y: y + 42, r: 22, color: c, shadow: false, dead: !p.alive });
        Draw.text(ctx, this.P[i].name, x + 74, y + 42, { size: 30, align: 'left', color: c.light });
        Draw.text(ctx, p.alive ? '♥'.repeat(p.hearts) + '♡'.repeat(3 - p.hearts) : (this.n > 2 ? '👻 Ma báo thù' : 'Bị loại'), x + pw / 2, y + 92,
          { size: 30, color: p.alive ? '#ff5c7a' : '#ccc' });
        Draw.text(ctx, `💣${p.maxB}  🔥${p.range}  👟${Math.round((p.speed - 3.6) / 0.5) + 1}`, x + pw / 2, y + 134, { size: 20, sw: 4 });
        const extra = (p.kick ? '👢' : '') + (p.glove ? '🧤' : '') + (p.remote ? '📡' : '');
        Draw.text(ctx, `Hạ: ${p.kills}${extra ? '  ' + extra : ''}`, x + pw / 2, y + 166, { size: 18, sw: 4, color: '#ddd' });
        ctx.restore();
      });
      Draw.timer(ctx, this.time, OX / 2, 360);
      Draw.timer(ctx, this.time, W - OX / 2, 360);
    }

    results() {
      return this.ps.map((p) => ({
        score: (p.alive ? 1000 + p.hearts * 100 : p.deathTime) + p.kills * 0.01,
        text: p.alive ? `Còn ${p.hearts} ♥ · hạ ${p.kills}` : `Bị loại · hạ ${p.kills}`,
      }));
    }

    /* ---------- bot ---------- */
    dangerMap(extra) {
      const d = new Float32Array(COLS * ROWS).fill(Infinity);
      const list = extra ? this.bombs.concat([extra]) : this.bombs;
      for (const b of list) {
        const t = Math.max(0, b.t);
        const mark = (x, y) => { const k = this.idx(x, y); if (t < d[k]) d[k] = t; };
        mark(b.tx, b.ty);
        for (const [dx, dy] of DIRS) {
          for (let k = 1; k <= b.range; k++) {
            const x = b.tx + dx * k, y = b.ty + dy * k, tt = this.tile(x, y);
            if (tt === 1) break;
            mark(x, y);
            if (tt === 2) break;
          }
        }
      }
      for (const f of this.flames) d[this.idx(f.tx, f.ty)] = 0;
      if (this.time <= this.sd + 1) {
        for (let k = this.spiralIdx; k < Math.min(this.spiral.length, this.spiralIdx + 8); k++) {
          const [x, y] = this.spiral[k];
          d[this.idx(x, y)] = Math.min(d[this.idx(x, y)], 0.5);
        }
      }
      return d;
    }
    bfs(i, sx, sy, blockedFn) {
      const dist = new Int16Array(COLS * ROWS).fill(-1), prev = new Int16Array(COLS * ROWS).fill(-1);
      const s = this.idx(sx, sy), q = [s];
      dist[s] = 0;
      for (let h = 0; h < q.length; h++) {
        const c = q[h], cx = c % COLS, cy = (c / COLS) | 0;
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy, k = this.idx(nx, ny);
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || dist[k] >= 0) continue;
          if (this.solidFor(nx, ny, i) || blockedFn(k)) continue;
          dist[k] = dist[c] + 1; prev[k] = c; q.push(k);
        }
      }
      return { dist, prev };
    }
    firstStep(prev, start, goal) {
      let k = goal;
      while (prev[k] !== start && prev[k] >= 0) k = prev[k];
      return k;
    }
    wantsBomb(i, cx, cy) {
      const p = this.ps[i];
      for (const [dx, dy] of DIRS) if (this.tile(cx + dx, cy + dy) === 2) return true;
      return this.ps.some((o, j) => {
        if (j === i || !o.alive) return false;
        const ox = Math.round(o.x), oy = Math.round(o.y);
        if (ox !== cx && oy !== cy) return Math.abs(ox - cx) + Math.abs(oy - cy) <= 1;
        const d = Math.abs(ox - cx) + Math.abs(oy - cy);
        if (d > p.range) return false;
        const sx = Math.sign(ox - cx), sy = Math.sign(oy - cy);
        for (let k = 1; k < d; k++) if (this.tile(cx + sx * k, cy + sy * k)) return false;
        return true;
      });
    }
    ghostBot(p, i) {
      const o = { mx: 0, my: 0, actP: false };
      const foes = this.ps.filter((q, j) => j !== i && q.alive);
      if (!foes.length) return o;
      const { len } = this.perimeter();
      let best = 0, bd = Infinity;
      for (let s = 0; s < len; s++) {
        const [gx, gy, nx, ny] = this.ghostCell(s), lx = gx + nx * THROW, ly = gy + ny * THROW;
        for (const f of foes) { const d = Math.abs(f.x - lx) + Math.abs(f.y - ly); if (d < bd) { bd = d; best = s; } }
      }
      let diff = best - p.gs; diff = ((diff % len) + len * 1.5) % len - len / 2;
      if (Math.abs(diff) > 0.3) {
        const [, , nx, ny] = this.ghostCell(p.gs), tx = ny, ty = -nx, dir = -Math.sign(diff);
        o.mx = tx * dir; o.my = ty * dir;
      } else if (p.gCd <= 0 && bd <= 1.5) o.actP = true;
      return o;
    }
    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) {
      const p = this.ps[i];
      if (!p.alive) { if (this.n <= 2) return null; const [gx, gy] = this.ghostCell(p.gs); return { x: OX + gx * T + T / 2, y: OY + gy * T + T / 2 }; }
      return { x: OX + p.x * T + T / 2, y: OY + p.y * T + T / 2 };
    }

    botInput(i) {
      const p = this.ps[i], st = this.bot[i];
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (this.finished) return o;
      if (!p.alive) return this.n > 2 ? this.ghostBot(p, i) : o;
      st.cd -= 1 / 60;
      const cx = Math.round(p.x), cy = Math.round(p.y), cur = this.idx(cx, cy);
      // đánh bật bom đang bay tới
      if (this.bombs.some((b) => b.fly && b.fly.t / FLY > 1 - PARRY_WIN * 0.8 && Math.abs(b.tx - p.x) + Math.abs(b.ty - p.y) <= 1.2)) { o.jumpP = true; return o; }
      // bom hẹn giờ: cho nổ khi trúng đối thủ mà mình đứng ngoài vùng nổ
      if (p.remote && this.bombs.some((b) => b.owner === i && b.remote && !b.ghost)) {
        const blast = new Set();
        for (const b of this.bombs) {
          if (b.owner !== i || !b.remote || b.fly) continue;
          blast.add(this.idx(b.tx, b.ty));
          for (const [dx, dy] of DIRS) for (let k = 1; k <= b.range; k++) {
            const x = b.tx + dx * k, y = b.ty + dy * k, tt = this.tile(x, y);
            if (tt === 1) break; blast.add(this.idx(x, y)); if (tt === 2) break;
          }
        }
        const foeIn = this.ps.some((q, j) => j !== i && q.alive && blast.has(this.idx(Math.round(q.x), Math.round(q.y))));
        const boxIn = [...blast].some((k) => this.grid[k] === 2);
        if (!blast.has(cur) && (foeIn || (boxIn && Math.random() < 0.05))) o.jumpP = true;
      }
      const danger = this.dangerMap();
      let goal = -1, prev = null;

      if (danger[cur] !== Infinity) {
        // đang nguy hiểm → chạy tới ô an toàn gần nhất
        const r = this.bfs(i, cx, cy, (k) => danger[k] < 0.25);
        let bd = Infinity;
        for (let k = 0; k < r.dist.length; k++) {
          if (r.dist[k] >= 0 && danger[k] === Infinity && r.dist[k] < bd) { bd = r.dist[k]; goal = k; }
        }
        prev = r.prev;
      } else {
        if (p.placed < p.maxB && st.cd <= 0 && this.wantsBomb(i, cx, cy)) {
          const d2 = this.dangerMap({ tx: cx, ty: cy, range: p.range, t: FUSE });
          const saved = this.bombs.length;
          this.bombs.push({ tx: cx, ty: cy, t: FUSE, range: p.range, owner: i, pass: new Set([i]) });
          const r = this.bfs(i, cx, cy, (k) => danger[k] !== Infinity);
          this.bombs.length = saved;
          let bd = Infinity, g = -1;
          for (let k = 0; k < r.dist.length; k++) {
            if (r.dist[k] > 0 && r.dist[k] <= 6 && d2[k] === Infinity && r.dist[k] < bd) { bd = r.dist[k]; g = k; }
          }
          if (g >= 0) { o.actP = true; st.cd = U.rand(0.4, 1.0); return o; }
          st.cd = 0.3;
        }
        const r = this.bfs(i, cx, cy, (k) => danger[k] !== Infinity);
        prev = r.prev;
        let bs = Infinity;
        for (let k = 0; k < r.dist.length; k++) {
          const dd = r.dist[k];
          if (dd < 0) continue;
          const x = k % COLS, y = (k / COLS) | 0;
          let score = Infinity;
          if (this.items.has(k)) score = dd - 4;
          else if (DIRS.some(([dx, dy]) => this.tile(x + dx, y + dy) === 2)) score = dd;
          const nearFoe = this.ps.some((q, j) => j !== i && q.alive && Math.abs(Math.round(q.x) - x) + Math.abs(Math.round(q.y) - y) <= 2
            && (Math.round(q.x) === x || Math.round(q.y) === y));
          if (nearFoe) score = Math.min(score, dd - 2);
          if (score < bs) { bs = score; goal = k; }
        }
      }

      if (goal >= 0 && goal !== cur && prev) {
        const step = this.firstStep(prev, cur, goal);
        const sx = step % COLS, sy = (step / COLS) | 0;
        o.mx = Math.sign(sx - cx); o.my = Math.sign(sy - cy);
      } else {
        if (Math.abs(p.x - cx) > 0.06) o.mx = Math.sign(cx - p.x);
        else if (Math.abs(p.y - cy) > 0.06) o.my = Math.sign(cy - p.y);
      }
      return o;
    }
  }

  Party.register({
    id: 'bomb', name: 'Đặt Bom', emoji: '💣',
    tagline: 'Phá hộp, nhặt đồ, cho nổ trúng đối thủ · người trụ lại là thắng',
    how: 'Đặt bom phá hộp để nhặt 💣 thêm bom, 🔥 lửa xa hơn, 👟 chạy nhanh, 👢 đá bom (đi thẳng vào bom), 🧤 ném bom (đứng trên bom bấm Đánh), 📡 bom hẹn giờ (bấm Nhảy cho nổ). Bom đang bay rơi gần mình: bấm Nhảy đúng lúc (vòng xanh) để đánh bật lại! Mỗi người 3 tim; ai bị loại thành 👻 ma đi quanh tường, bấm Đánh ném bom vào sân. Cuối trận tường khép dần — người trụ lại cuối cùng thắng.',
    controls: { move: 'Di chuyển', act: 'Đặt bom / ném 🧤', jump: 'Kích nổ 📡 / đánh bật bom' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Bomb(api),
  });
})();

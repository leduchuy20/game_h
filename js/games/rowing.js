'use strict';
/* Thuyền Chèo — mỗi đội 1 thuyền, mỗi người giữ 1 mái chèo (đội 1 người thì giữ cả 2).
   Hai mái chèo CÙNG LÚC thì thuyền lao vọt; chèo 1 bên thì thuyền rẽ. Bấm dồn khi mái chèo chưa kịp
   đưa về chỉ bắn nước. Đội nào về đích trước thắng. */
(() => {
  const LANE_Y = [92, 408], LANE_H = 300, BANK = 30, WATER = LANE_H - BANK * 2;
  const BOAT_SX = 300, RECOVER = 0.42, SYNC = 0.18;

  class Rowing {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.team = TEAMS.split(this.n);
      this.L = Math.round(6000 * api.len.count);
      this.time = this.total = api.T(90); this.elapsed = 0; this.finished = false; this.place = 0;
      this.rocks = [];
      for (let x = 700; x < this.L - 300; x += U.rand(240, 380)) {
        this.rocks.push({ x, y: U.rand(75, WATER - 75), r: U.rand(20, 30) });
        if (Math.random() < 0.2) this.rocks.push({ x: x + U.rand(120, 160), y: U.rand(75, WATER - 75), r: U.rand(18, 24) });
      }
      this.boats = [0, 1].map((t) => {
        const mem = this.team.map((x, i) => (x === t ? i : -1)).filter((i) => i >= 0);
        return { t, mem, bx: 0, by: WATER / 2, h: 0, v: 0, oars: [{ cd: 0, last: -9, turn: 0, anim: 0 }, { cd: 0, last: -9, turn: 0, anim: 0 }],
          done: false, rank: 0, time: 0, bump: 0 };
      });
    }
    teamOf(i) { return this.team[i]; }
    // người chơi i điều khiển mái nào: [0] trên, [1] dưới, hoặc cả hai nếu đội 1 người
    oarsOf(i) {
      const b = this.boats[this.team[i]];
      return b.mem.length === 1 ? [0, 1] : [b.mem.indexOf(i)];
    }

    stroke(b, k) {
      const o = b.oars[k], other = b.oars[1 - k], parts = this.api.parts;
      const ly = LANE_Y[b.t] + BANK + b.by + (k === 0 ? -26 : 26);
      if (o.cd > 0) { // chưa kịp đưa mái chèo về: chỉ bắn nước
        o.cd = RECOVER * 0.6;
        parts.burst(BOAT_SX, ly, ['#bfe6ff', '#fff'], 4, 80, 0.3, 3);
        return;
      }
      o.cd = RECOVER; o.last = this.elapsed; o.anim = 1;
      b.v += 115;
      if (this.elapsed - other.last < SYNC) {
        // đồng bộ: hủy độ rẽ của mái kia, thưởng thêm tốc độ
        b.h -= other.turn; other.turn = 0; o.turn = 0;
        b.v += 150;
        Sfx.play('pull', 0.02);
        parts.burst(BOAT_SX - 40, LANE_Y[b.t] + BANK + b.by, ['#fff', '#bfe6ff'], 10, 160, 0.4, 4);
        parts.text(BOAT_SX, LANE_Y[b.t] + 40, 'Đồng bộ!', TEAMS.colors[b.t], 22);
      } else {
        o.turn = k === 0 ? 0.2 : -0.2;
        b.h += o.turn;
        Sfx.play('tick', 0.03);
      }
      b.h = U.clamp(b.h, -0.9, 0.9);
      parts.burst(BOAT_SX - 10, ly, ['#bfe6ff', '#fff'], 5, 100, 0.35, 3);
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) { this.time -= dt; this.elapsed += dt; }
      // đọc nút
      this.P.forEach((p, i) => {
        const b = this.boats[this.team[i]];
        if (b.done || this.finished) return;
        const q = inp[i], oars = this.oarsOf(i);
        if (oars.length === 2) { if (q.actP) this.stroke(b, 0); if (q.jumpP) this.stroke(b, 1); }
        else if (q.actP || q.jumpP) this.stroke(b, oars[0]);
      });
      for (const b of this.boats) {
        for (const o of b.oars) { o.cd -= dt; o.anim = Math.max(0, o.anim - dt * 3); }
        b.bump -= dt;
        b.v *= Math.pow(b.done ? 0.3 : 0.15, dt);
        b.h *= Math.pow(0.7, dt);
        b.bx += Math.cos(b.h) * b.v * dt; b.by += Math.sin(b.h) * b.v * dt;
        if (b.by < 20 || b.by > WATER - 20) {
          b.by = U.clamp(b.by, 20, WATER - 20); b.h = -b.h * 0.5; b.v *= 0.6;
          if (b.bump <= 0) { Sfx.play('hit', 0.1); b.bump = 0.4; }
        }
        for (const r of this.rocks) {
          const dx = b.bx - r.x, dy = b.by - r.y, d = Math.hypot(dx, dy);
          if (d < r.r + 22) {
            b.bx = r.x + dx / (d || 1) * (r.r + 22); b.by = r.y + dy / (d || 1) * (r.r + 22);
            if (b.bump <= 0) {
              b.v *= 0.6; b.h = U.clamp(b.h + (dy > 0 ? 0.35 : -0.35), -0.9, 0.9); b.bump = 0.5;
              Sfx.play('crash'); FX.shake(5);
              parts.burst(BOAT_SX, LANE_Y[b.t] + BANK + b.by, ['#8d90ad', '#fff'], 10, 180, 0.5, 5);
            }
          }
        }
        if (!b.done && !this.finished && b.bx >= this.L) {
          b.done = true; b.rank = ++this.place; b.time = this.elapsed;
          Sfx.play('win');
          parts.text(BOAT_SX + 100, LANE_Y[b.t] + LANE_H / 2, `${TEAMS.names[b.t]} về đích!`, TEAMS.colors[b.t], 36);
        }
      }
      if (!this.finished && (this.boats.every((b) => b.done) || this.place >= 1 || this.time <= 0)) {
        if (this.time <= 0) this.time = 0;
        this.finished = true;
      }
    }

    draw(ctx) {
      ctx.fillStyle = '#2f6e3a'; ctx.fillRect(0, 0, W, H);
      for (const b of this.boats) {
        const y0 = LANE_Y[b.t], wy = y0 + BANK;
        const cam = U.clamp(b.bx - BOAT_SX, 0, this.L + 200);
        // bờ & nước
        ctx.fillStyle = '#5fae4f'; ctx.fillRect(0, y0, W, LANE_H);
        ctx.fillStyle = '#3d8fd6'; ctx.fillRect(0, wy, W, WATER);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        for (let k = 0; k < 14; k++) {
          const x = ((k * 173 - cam * 1.0) % (W + 200) + W + 200) % (W + 200) - 100, y = wy + 20 + (k * 47) % (WATER - 40);
          ctx.fillRect(x, y, 60, 3);
        }
        // vạch xuất phát & đích
        for (const [lx, chk] of [[0, false], [this.L, true]]) {
          const sx = lx - cam + 0;
          if (sx < -20 || sx > W + 20) continue;
          for (let y = wy; y < wy + WATER; y += 15) { ctx.fillStyle = chk ? ((y - wy) / 15 % 2 ? '#111' : '#fff') : '#fff'; ctx.fillRect(sx, y, chk ? 15 : 5, 15); }
        }
        // đá
        for (const r of this.rocks) {
          const sx = r.x - cam;
          if (sx < -50 || sx > W + 50) continue;
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(sx + 4, wy + r.y + 6, r.r, r.r * 0.8, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#7d8094'; ctx.beginPath(); ctx.arc(sx, wy + r.y, r.r, 0, TAU); ctx.fill();
          ctx.fillStyle = '#a3a6bb'; ctx.beginPath(); ctx.arc(sx - r.r * 0.3, wy + r.y - r.r * 0.3, r.r * 0.45, 0, TAU); ctx.fill();
        }
        // thuyền
        const sx = b.bx - cam, sy = wy + b.by;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(b.h);
        b.oars.forEach((o, k) => {
          const side = k === 0 ? -1 : 1, sw = Math.sin(o.anim * Math.PI) * 0.9;
          ctx.strokeStyle = '#c99a5b'; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, side * 10); ctx.lineTo(-10 - 28 * sw, side * 46); ctx.stroke();
          ctx.fillStyle = '#c99a5b'; ctx.beginPath(); ctx.ellipse(-28 * sw - 10, side * 48, 10, 5, 0, 0, TAU); ctx.fill();
        });
        ctx.fillStyle = '#6b4320'; ctx.beginPath(); ctx.ellipse(0, 0, 58, 22, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#9a6a3a'; ctx.beginPath(); ctx.ellipse(0, 0, 50, 16, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = TEAMS.colors[b.t]; ctx.fillRect(-44, -3, 88, 6);
        ctx.restore();
        b.mem.forEach((i, k) => {
          const off = b.mem.length === 1 ? 0 : (k === 0 ? 18 : -18);
          Draw.blob(ctx, { x: sx + Math.cos(b.h) * off, y: sy - 6 + Math.sin(b.h) * off, r: 15, color: this.P[i].color, face: b.h, shadow: false });
        });
        // nhãn làn
        const pct = Math.min(100, Math.round(b.bx / this.L * 100));
        Draw.rr(ctx, 14, y0 + 6, 270, 22, 11); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
        Draw.rr(ctx, 14, y0 + 6, 270 * pct / 100, 22, 11); ctx.fillStyle = TEAMS.colors[b.t]; ctx.fill();
        const who = b.mem.length === 1 ? `${this.P[b.mem[0]].name} (2 mái)` : `${this.P[b.mem[0]].name} mái trên · ${this.P[b.mem[1]].name} mái dưới`;
        Draw.text(ctx, `${TEAMS.names[b.t]} ${b.done ? `🏁 #${b.rank}` : pct + '%'} · ${who}`, 300, y0 + 17, { size: 16, align: 'left', sw: 4 });
      }
      Draw.timer(ctx, this.time, W - 72, 38);
      Draw.chips(ctx, this.P, this.P.map((_, i) => TEAMS.names[this.team[i]].replace('Đội ', '')), { w: 160 });
    }

    results() {
      return this.P.map((_, i) => {
        const b = this.boats[this.team[i]];
        return b.done
          ? { score: 1000 - b.rank, text: `${TEAMS.names[b.t]} · về đích ${b.time.toFixed(1)} giây` }
          : { score: b.bx / this.L, text: `${TEAMS.names[b.t]} · đi được ${Math.round(b.bx / this.L * 100)}%` };
      });
    }

    /** vị trí nhân vật trên màn hình (cho biểu cảm, rung tay cầm...) — null nếu đang không hiện */
    posOf(i) {
      const b = this.boats[this.team[i]], cam = U.clamp(b.bx - BOAT_SX, 0, this.L + 200);
      return { x: b.bx - cam, y: LANE_Y[b.t] + BANK + b.by };
    }

    botInput(i) {
      const o = { actP: false, jumpP: false };
      const b = this.boats[this.team[i]];
      if (b.done || this.finished) return o;
      // hướng muốn đi: né đá phía trước
      let ty = WATER / 2;
      for (const r of this.rocks) {
        if (r.x < b.bx || r.x > b.bx + 380) continue;
        if (Math.abs(r.y - b.by) < r.r + 50) { ty = r.y > WATER / 2 ? r.y - r.r - 60 : r.y + r.r + 60; break; }
      }
      const hd = U.clamp(Math.atan2(ty - b.by, 260), -0.6, 0.6), e = hd - b.h;
      const want = [e > -0.12, e < 0.12]; // mái trên làm thuyền rẽ xuống, mái dưới rẽ lên
      const mine = this.oarsOf(i);
      for (const k of mine) {
        const oar = b.oars[k], other = b.oars[1 - k];
        if (!want[k] || oar.cd > 0) continue;
        const partnerMine = mine.includes(1 - k);
        // muốn chèo cả 2 bên: chờ mái kia sẵn sàng / vừa chèo để đồng bộ
        let go = true;
        if (want[1 - k]) {
          if (partnerMine) go = other.cd <= 0;
          else go = other.cd <= 0 || this.elapsed - other.last < 0.1 || this.elapsed - other.last > 0.9;
        }
        if (!go) continue;
        if (mine.length === 2) { if (k === 0) o.actP = true; else o.jumpP = true; }
        else o.actP = true;
      }
      return o;
    }
  }

  Party.register({
    id: 'rowing', name: 'Thuyền Chèo', emoji: '🚣', cat: 'team',
    tagline: 'Chèo cùng lúc thì thuyền lao vọt · đội về đích trước thắng',
    how: 'Mỗi đội 1 thuyền: P1/P2 giữ mái TRÊN, P3/P4 giữ mái DƯỚI (bấm Đánh hoặc Nhảy để chèo). Hai mái chèo cùng lúc thì thuyền lao nhanh; chèo 1 bên thì thuyền rẽ (mái trên → rẽ xuống, mái dưới → rẽ lên). Đội 1 người: Đánh = mái trên, Nhảy = mái dưới. Né đá!',
    controls: { move: '(không dùng)', act: 'Chèo (mái của mình)', jump: 'Chèo' },
    minPlayers: 2, maxPlayers: 4, team: true,
    create: (api) => new Rowing(api),
  });
})();

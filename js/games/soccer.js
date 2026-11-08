'use strict';
/* Bóng Đá — chia 2 đội. Dắt bóng, sút, húc để cướp bóng. Những giây cuối bàn thắng ×2, hòa thì đá bàn thắng vàng. */
(() => {
  const FX0 = 70, FY0 = 100, FW = W - 140, FH = 590;
  const GH = 200, GY0 = FY0 + FH / 2 - GH / 2, GY1 = GY0 + GH, GD = 46;
  const GAME_TIME = 75, DOUBLE_AT = 20, BR = 13;
  const TAP = 0.18, CHARGE = 0.8, TWIN = 0.25;   // chạm < TAP = chuyền; giữ tới CHARGE = sút căng nhất; sút đôi trong TWIN giây

  class Soccer {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.team = TEAMS.split(this.n);
      this.score = [0, 0]; this.time = this.total = api.T(GAME_TIME); this.doubleAt = api.T(DOUBLE_AT); this.golden = false; this.finished = false;
      this.goalT = 0; this.endAfterGoal = false;
      this.ps = this.P.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, r: 24, face: 0, walk: 0, dashT: 0, dashCd: 0,
        kickCd: 0, kickT: 0, stun: 0, squash: 0, skip: false, hold: 0 }));
      this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: BR, spin: 0, fire: 0, fireTeam: -1 };
      this.lastKick = null; this.clock = 0;
      this.bannerT = 9; this.bannerText = ''; this.bannerColor = '#fff';
      this.announced = false;
      this.kickoff();
      this.freeze = 0;
    }
    teamOf(i) { return this.team[i]; }

    kickoff() {
      const cx = FX0 + FW / 2, cy = FY0 + FH / 2;
      const cnt = [0, 0];
      this.ps.forEach((p, i) => {
        const t = this.team[i], k = cnt[t]++, side = t === 0 ? -1 : 1;
        const members = this.team.filter((x) => x === t).length;
        Object.assign(p, {
          x: cx + side * (k === 0 ? 150 : 380), y: cy + (members === 1 ? 0 : k === 0 ? -80 : 90),
          vx: 0, vy: 0, face: t === 0 ? 0 : Math.PI, dashT: 0, stun: 0,
        });
      });
      Object.assign(this.ball, { x: cx, y: cy, vx: 0, vy: 0 });
      this.freeze = 1.0;
    }

    /** sút bóng: dir = góc, pw = lực. Trả true nếu chạm được bóng */
    kick(p, i, dir, pw) {
      const b = this.ball, parts = this.api.parts;
      p.kickCd = 0.3; p.kickT = 0.15; p.squash = 0.15;
      if (Math.hypot(b.x - p.x, b.y - p.y) >= p.r + b.r + 24) return false;
      b.vx = Math.cos(dir) * pw + p.vx * 0.3; b.vy = Math.sin(dir) * pw + p.vy * 0.3;
      Sfx.play('kick'); FX.shake(3 + pw / 400);
      parts.burst(b.x, b.y, ['#fff', '#d9ffd0'], 8, 180, 0.35, 4);
      this.lastKick = { i, team: this.team[i], t: this.clock };
      return true;
    }
    /** SOC5: đồng đội bấm sút trong TWIN giây sau cú sút trước và đang ở gần bóng → bóng lửa */
    tryTwin(p, i) {
      const lk = this.lastKick, b = this.ball;
      if (!lk || lk.i === i || lk.team !== this.team[i] || this.clock - lk.t > TWIN) return false;
      if (Math.hypot(b.x - p.x, b.y - p.y) > 170) return false;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      b.vx = b.vx / sp * 1500; b.vy = b.vy / sp * 1500; b.fire = 1.4; b.fireTeam = this.team[i];
      this.lastKick = null;
      Sfx.play('boom'); FX.shake(8);
      this.api.parts.text(b.x, b.y - 40, 'SÚT ĐÔI! 🔥', '#ff8a2e', 32);
      return true;
    }
    /** đồng đội gần nhất để chuyền */
    mateFor(i) {
      const p = this.ps[i];
      let best = -1, bd = Infinity;
      this.ps.forEach((q, j) => { if (j !== i && this.team[j] === this.team[i]) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = j; } } });
      return best;
    }

    banner(s, c) { this.bannerText = s; this.bannerColor = c || '#fff'; this.bannerT = 0; }

    goal(t) {
      const pts = this.time <= this.doubleAt && !this.golden ? 2 : 1;
      this.score[t] += pts;
      this.banner(`${TEAMS.names[t]} ghi bàn!${pts > 1 ? ' ×2' : ''}`, TEAMS.colors[t]);
      this.goalT = 1.8; this.endAfterGoal = this.golden;
      Sfx.play('goal'); FX.shake(10);
      const gx = t === 0 ? FX0 + FW : FX0;
      this.api.parts.burst(gx, FY0 + FH / 2, ['#ffe14d', '#ff5c9d', '#4dd0ff', '#5dff9b', '#fff'], 50, 520, 1.2, 7, { g: 300 });
    }

    update(dt, inp) {
      const parts = this.api.parts, b = this.ball;
      this.bannerT += dt;
      for (const p of this.ps) { p.squash *= Math.pow(0.01, dt); p.kickT -= dt; }
      if (this.goalT > 0) {
        this.goalT -= dt;
        b.vx *= Math.pow(0.05, dt); b.vy *= Math.pow(0.05, dt);
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (this.goalT <= 0) { if (this.endAfterGoal) this.finished = true; else this.kickoff(); }
        return;
      }
      if (this.freeze > 0) { this.freeze -= dt; return; }
      if (this.finished) return;
      this.clock += dt;

      if (this.golden) {
        // bàn thắng vàng tối đa 30 giây, sau đó tính hòa
        this.goldenT = (this.goldenT || 0) + dt;
        if (this.goldenT >= 30) { this.finished = true; this.banner('Hòa!', '#fff'); return; }
      }
      if (!this.golden) {
        this.time -= dt;
        if (this.time <= this.doubleAt && !this.announced) {
          this.announced = true; Sfx.play('warn');
          parts.text(W / 2, 170, 'Bàn thắng ×2!', '#ffe14d', 48);
        }
        if (this.time <= 0) {
          this.time = 0;
          if (this.score[0] === this.score[1]) { this.golden = true; this.banner('Bàn thắng vàng!', '#ffe14d'); Sfx.play('warn'); }
          else { this.finished = true; return; }
        }
      }

      this.ps.forEach((p, i) => {
        const q = inp[i];
        p.dashT -= dt; p.dashCd -= dt; p.kickCd -= dt; p.stun -= dt;
        const can = p.stun <= 0;
        if (can && (q.mx || q.my)) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
        if (can && q.jumpP && p.dashCd <= 0) {
          p.dashT = 0.25; p.dashCd = 1.0; p.squash = -0.2; Sfx.play('dash');
          p.vx = Math.cos(p.face) * 650; p.vy = Math.sin(p.face) * 650;
        }
        if (p.dashT <= 0) {
          const sp = can ? (p.hold > TAP ? 180 : 265) : 0, k = Math.min(1, dt * (can ? 10 : 3));
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        }
        // SOC1: chạm Đánh = chuyền cho đồng đội gần nhất (không có đồng đội thì sút thường),
        // giữ Đánh = tích lực sút căng; máy gửi actP (không giữ) = sút thường, pass = chuyền
        if (can && q.act) p.hold += dt;
        const released = can && ((p.hold > 0 && !q.act) || (q.actP && !q.act));
        if (released && p.kickCd <= 0) {
          if (this.tryTwin(p, i)) { p.kickCd = 0.3; p.kickT = 0.15; }
          else if (this.P[i].bot && !q.pass) this.kick(p, i, p.face, 880);
          else if (p.hold >= TAP || (this.P[i].bot && !q.pass)) this.kick(p, i, p.face, 760 + 640 * Math.min(1, p.hold / CHARGE));
          else {
            const m = this.mateFor(i);
            if (m >= 0) {
              const mt = this.ps[m], lead = 0.35;
              const tx = mt.x + mt.vx * lead, ty = mt.y + mt.vy * lead, d = Math.hypot(tx - b.x, ty - b.y);
              this.kick(p, i, Math.atan2(ty - b.y, tx - b.x), U.clamp(d * 1.7, 420, 900));
            } else this.kick(p, i, p.face, 880);
          }
        }
        if (!q.act || !can) p.hold = 0;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.x = U.clamp(p.x, FX0 + p.r - 10, FX0 + FW - p.r + 10);
        p.y = U.clamp(p.y, FY0 + p.r, FY0 + FH - p.r);
      });
      Phys.separate(this.ps, 0.5, (a, c, nx, ny) => {
        const hit = (atk, vic, sx, sy) => {
          if (atk.dashT <= 0) return;
          atk.dashT = 0; vic.stun = 0.6; vic.vx += sx * 380; vic.vy += sy * 380;
          Sfx.play('hit'); FX.shake(6);
          parts.burst(vic.x, vic.y - 10, ['#fff', '#ffe14d'], 10, 220, 0.4, 5, { shape: 's' });
        };
        hit(a, c, nx, ny); hit(c, a, -nx, -ny);
      });

      // bóng chạm người: dắt bóng (bóng lửa thì húc văng người đội kia)
      b.fire -= dt;
      for (const [pi, p] of this.ps.entries()) {
        const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy), m = p.r + b.r;
        if (b.fire > 0 && d < m + 6 && this.team[pi] !== b.fireTeam) {
          const sp = Math.hypot(b.vx, b.vy) || 1;
          p.vx += b.vx / sp * 420; p.vy += b.vy / sp * 420; p.stun = 0.7; Party.rumble(pi, 0.7, 200);
          parts.burst(p.x, p.y, ['#ff8a2e', '#ffe14d'], 10, 220, 0.4, 5);
          continue;
        }
        if (d < m && d > 0.001) {
          const nx = dx / d, ny = dy / d;
          b.x = p.x + nx * m; b.y = p.y + ny * m;
          const pv = p.vx * nx + p.vy * ny, bv = b.vx * nx + b.vy * ny;
          const want = Math.max(0, pv) * 1.12 + 40;
          if (bv < want) { b.vx += nx * (want - bv); b.vy += ny * (want - bv); }
        }
      }
      // vật lý bóng
      b.x += b.vx * dt; b.y += b.vy * dt;
      const f = Math.pow(0.4, dt); b.vx *= f; b.vy *= f;
      b.spin += Math.hypot(b.vx, b.vy) * dt / b.r;
      const sp = Math.hypot(b.vx, b.vy);
      const cap = b.fire > 0 ? 1600 : 1100;
      if (sp > cap) { b.vx *= cap / sp; b.vy *= cap / sp; }
      if (b.y < FY0 + b.r) { b.y = FY0 + b.r; b.vy = Math.abs(b.vy) * 0.8; }
      if (b.y > FY0 + FH - b.r) { b.y = FY0 + FH - b.r; b.vy = -Math.abs(b.vy) * 0.8; }
      if (b.x < FX0 || b.x > FX0 + FW) {
        // bóng đang trong lưới: giữ trong khung
        if (b.y < GY0 + b.r) { b.y = GY0 + b.r; b.vy = Math.abs(b.vy) * 0.6; }
        if (b.y > GY1 - b.r) { b.y = GY1 - b.r; b.vy = -Math.abs(b.vy) * 0.6; }
      }
      const inMouth = b.y > GY0 + b.r * 0.6 && b.y < GY1 - b.r * 0.6;
      if (b.x < FX0 + b.r) {
        if (!inMouth) { b.x = FX0 + b.r; b.vx = Math.abs(b.vx) * 0.8; }
        else if (b.x < FX0 - b.r) { this.goal(1); return; }
      }
      if (b.x > FX0 + FW - b.r) {
        if (!inMouth) { b.x = FX0 + FW - b.r; b.vx = -Math.abs(b.vx) * 0.8; }
        else if (b.x > FX0 + FW + b.r) { this.goal(0); return; }
      }
    }

    draw(ctx) {
      ctx.fillStyle = '#1d5e2c'; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = k % 2 ? '#4ca84a' : '#55b553';
        ctx.fillRect(FX0 + k * FW / 14, FY0, FW / 14 + 1, FH);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4;
      ctx.strokeRect(FX0, FY0, FW, FH);
      ctx.beginPath(); ctx.moveTo(FX0 + FW / 2, FY0); ctx.lineTo(FX0 + FW / 2, FY0 + FH); ctx.stroke();
      ctx.beginPath(); ctx.arc(FX0 + FW / 2, FY0 + FH / 2, 80, 0, TAU); ctx.stroke();
      ctx.strokeRect(FX0, FY0 + FH / 2 - 150, 140, 300);
      ctx.strokeRect(FX0 + FW - 140, FY0 + FH / 2 - 150, 140, 300);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(FX0 + FW / 2, FY0 + FH / 2, 5, 0, TAU); ctx.fill();
      // khung thành
      for (const [gx, t] of [[FX0 - GD, 0], [FX0 + FW, 1]]) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(gx, GY0, GD, GH);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
        for (let y = GY0; y <= GY1; y += 12) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + GD, y); ctx.stroke(); }
        for (let x = gx; x <= gx + GD; x += 12) { ctx.beginPath(); ctx.moveTo(x, GY0); ctx.lineTo(x, GY1); ctx.stroke(); }
        ctx.strokeStyle = TEAMS.colors[t]; ctx.lineWidth = 6;
        ctx.strokeRect(gx, GY0, GD, GH);
      }
      // người chơi + bóng theo chiều sâu
      const b = this.ball;
      const items = this.ps.map((p, i) => ({ y: p.y, i })).concat([{ y: b.y, i: -1 }]).sort((a, c) => a.y - c.y);
      for (const it of items) {
        if (it.i < 0) { this.drawBall(ctx); continue; }
        const p = this.ps[it.i], t = this.team[it.i];
        ctx.strokeStyle = TEAMS.colors[t]; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.8, p.r * 1.05, p.r * 0.38, 0, 0, TAU); ctx.stroke();
        Draw.blob(ctx, { x: p.x, y: p.y, r: p.r, color: this.P[it.i].color, face: p.face, walk: p.walk,
          squash: p.squash, stun: p.stun > 0 });
        if (p.hold > TAP) {
          const k = Math.min(1, p.hold / CHARGE);
          ctx.strokeStyle = k >= 1 ? '#ff5a3a' : '#ffe14d'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
        }
        if (p.kickT > 0) {
          ctx.fillStyle = this.P[it.i].color.dark;
          ctx.beginPath(); ctx.arc(p.x + Math.cos(p.face) * (p.r + 6), p.y + p.r * 0.5 + Math.sin(p.face) * 10, 8, 0, TAU); ctx.fill();
        }
      }
      this.drawHud(ctx);
      if (this.bannerT < 1.6) Draw.banner(ctx, this.bannerText, this.bannerT, { color: this.bannerColor, size: 64, y: 300 });
    }

    drawBall(ctx) {
      const b = this.ball;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(b.x, b.y + b.r * 0.9, b.r, b.r * 0.35, 0, 0, TAU); ctx.fill();
      if (b.fire > 0) {
        ctx.fillStyle = 'rgba(255,140,40,0.55)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 9 + Math.random() * 4, 0, TAU); ctx.fill();
        this.api.parts.burst(b.x, b.y, ['#ff8a2e', '#ffe14d'], 1, 60, 0.35, 6);
      }
      ctx.save(); ctx.translate(b.x, b.y);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.clip();
      ctx.fillStyle = '#222';
      for (let k = 0; k < 3; k++) {
        const a = b.spin + k * TAU / 3;
        ctx.beginPath(); ctx.arc(Math.cos(a) * b.r * 0.55, Math.sin(a) * b.r * 0.3, b.r * 0.3, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    drawHud(ctx) {
      const cx = W / 2, y = 44;
      Draw.rr(ctx, cx - 250, y - 30, 500, 60, 30);
      ctx.fillStyle = 'rgba(15,25,15,0.75)'; ctx.fill();
      Draw.text(ctx, String(this.score[0]), cx - 34, y + 2, { size: 44, color: TEAMS.colors[0] });
      Draw.text(ctx, '–', cx, y, { size: 36 });
      Draw.text(ctx, String(this.score[1]), cx + 34, y + 2, { size: 44, color: TEAMS.colors[1] });
      for (const t of [0, 1]) {
        const ids = this.team.map((x, i) => (x === t ? i : -1)).filter((i) => i >= 0);
        ids.forEach((i, k) => {
          const bx = t === 0 ? cx - 90 - k * 40 : cx + 90 + k * 40;
          Draw.blob(ctx, { x: bx, y: y - 2, r: 15, color: this.P[i].color, shadow: false, face: t === 0 ? 0 : Math.PI });
        });
        Draw.text(ctx, TEAMS.names[t], t === 0 ? cx - 160 - (ids.length - 1) * 40 : cx + 160 + (ids.length - 1) * 40, y,
          { size: 20, color: TEAMS.colors[t], align: t === 0 ? 'right' : 'left', sw: 4 });
      }
      if (this.golden) Draw.label(ctx, `⚡ Bàn vàng ${Math.ceil(30 - (this.goldenT || 0))}s`, W - 130, 44);
      else Draw.timer(ctx, this.time, W - 72, 44);
      if (this.time <= this.doubleAt && !this.golden) Draw.label(ctx, 'Bàn ×2', 80, 44);
    }

    results() {
      return this.P.map((_, i) => {
        const t = this.team[i];
        return { score: this.score[t] - this.score[1 - t], text: `${TEAMS.names[t]} · ${this.score[t]} – ${this.score[1 - t]}` };
      });
    }

    botInput(i) {
      const p = this.ps[i], b = this.ball, t = this.team[i];
      const o = { mx: 0, my: 0, actP: false, jumpP: false };
      if (this.freeze > 0 || this.goalT > 0 || p.stun > 0) return o;
      const goalX = t === 0 ? FX0 + FW + 30 : FX0 - 30, goalY = FY0 + FH / 2;
      const ownX = t === 0 ? FX0 : FX0 + FW;
      const myD = Math.hypot(b.x - p.x, b.y - p.y);
      const mateCloser = this.ps.some((q, j) => j !== i && this.team[j] === t && Math.hypot(b.x - q.x, b.y - q.y) < myD - 30);
      let tx, ty;
      if (mateCloser) {
        tx = ownX + (b.x - ownX) * 0.35; ty = goalY + (b.y - goalY) * 0.5;
      } else {
        let gx = goalX - b.x, gy = goalY - b.y;
        const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
        const off = p.r + b.r + 6;
        const bx = b.x - gx * off, by = b.y - gy * off;
        const rel = (p.x - b.x) * gx + (p.y - b.y) * gy;
        if (rel < -5 && Math.hypot(p.x - bx, p.y - by) < 34) {
          tx = b.x + gx * 40; ty = b.y + gy * 40;
          if (gl < 520 && p.kickCd <= 0 && myD < p.r + b.r + 20 && Math.random() < 0.2) o.actP = true;
        } else {
          tx = bx; ty = by;
          if (rel > -5) {
            const side = ((p.x - b.x) * -gy + (p.y - b.y) * gx) >= 0 ? 1 : -1;
            tx += -gy * side * 55 - gx * 30; ty += gx * side * 55 - gy * 30;
          }
        }
      }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d > 8) { o.mx = dx / d; o.my = dy / d; }
      // sút khi đang ở gần bóng và mặt hướng về phía khung thành đối phương
      const toGoal = Math.atan2(goalY - p.y, goalX - p.x);
      if (myD < p.r + b.r + 20 && p.kickCd <= 0 && Math.abs(U.angDiff(p.face, toGoal)) < 0.7 && Math.random() < 0.25) o.actP = true;
      // chuyền cho đồng đội đứng gần khung thành đối phương hơn mình nhiều
      const m = this.mateFor(i);
      if (m >= 0 && !o.actP && myD < p.r + b.r + 20 && p.kickCd <= 0) {
        const mt = this.ps[m];
        if (Math.abs(goalX - mt.x) < Math.abs(goalX - p.x) - 220 && Math.random() < 0.04) { o.actP = true; o.pass = true; }
      }
      // sút đôi: đồng đội vừa sút mà mình ở gần bóng
      if (this.lastKick && this.lastKick.team === t && this.lastKick.i !== i && this.clock - this.lastKick.t < TWIN && Math.hypot(b.x - p.x, b.y - p.y) < 150 && p.kickCd <= 0 && Math.random() < 0.3) o.actP = true;
      this.ps.forEach((q, j) => {
        if (this.team[j] === t || p.dashCd > 0) return;
        const dq = Math.hypot(q.x - p.x, q.y - p.y);
        if (dq < 110 && Math.hypot(b.x - q.x, b.y - q.y) < 50 && Math.random() < 0.04) {
          o.jumpP = true; o.mx = (q.x - p.x) / dq; o.my = (q.y - p.y) / dq;
        }
      });
      return o;
    }
  }

  Party.register({
    id: 'soccer', name: 'Bóng Đá', emoji: '⚽',
    tagline: 'Chia 2 đội, sút bóng vào khung thành đối phương',
    how: 'Chạm bóng là dắt bóng. CHẠM nút Đánh để chuyền cho đồng đội gần nhất, GIỮ nút Đánh rồi thả để sút căng theo hướng đang đi. Hai người cùng đội sút gần như cùng lúc ngay cạnh bóng → bóng lửa bay cực nhanh, húc văng người cản! Nút Nhảy để húc cướp bóng. Những giây cuối bàn thắng ×2, hòa thì đá bàn thắng vàng!',
    controls: { move: 'Chạy & dắt bóng', act: 'Chạm: chuyền · Giữ: sút', jump: 'Húc cướp bóng' },
    minPlayers: 2, maxPlayers: 4, team: true,
    create: (api) => new Soccer(api),
  });
})();

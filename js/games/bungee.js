'use strict';
/* Dây Thun (NEW4) — 2 người cùng đội nối với nhau bằng dây thun trên một cây cầu nổi.
   Kéo căng dây quét ngang để gạt đội kia rơi xuống nước; nhảy qua khúc gỗ lăn; giữ Nhảy làm mỏ neo.
   Đội 1 người thì không có dây nhưng nặng và húc mạnh hơn. */
(() => {
  const BX = 130, BY = 150, BW = W - 260, BH = 470; // mặt cầu
  const GAME_TIME = 60, REST = 130, MAXL = 300, TAP = 0.18;
  const JUMP_T = 0.5;

  class Bungee {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.team = TEAMS.split(this.n);
      this.time = this.total = api.T(GAME_TIME); this.finished = false; this.elapsed = 0;
      this.pts = [0, 0];
      this.mates = [0, 1].map((t) => this.P.map((_, i) => i).filter((i) => this.team[i] === t));
      this.ps = this.P.map((p, i) => {
        const t = this.team[i], solo = this.mates[t].length === 1;
        return { x: 0, y: 0, vx: 0, vy: 0, r: solo ? 27 : 23, mass: solo ? 1.6 : 1, solo, face: t ? Math.PI : 0, walk: 0,
          z: 0, jt: 0, hold: 0, anchor: false, dashT: 0, dashCd: 0, stun: 0, fall: 0, respawn: 0, lineCd: 0, falls: 0, kos: 0, last: -1, lastT: 0, skip: false };
      });
      this.ps.forEach((p, i) => this.spawn(p, i));
      this.logs = []; this.logT = 4; this.ropes = this.mates.filter((m) => m.length === 2);
    }
    teamOf(i) { return this.team[i]; }

    spawn(p, i) {
      const t = this.team[i], k = this.mates[t].indexOf(i);
      p.x = t === 0 ? BX + 120 : BX + BW - 120; p.y = BY + BH / 2 + (this.mates[t].length === 2 ? (k ? 90 : -90) : 0);
      p.vx = p.vy = 0; p.z = 0; p.jt = 0; p.fall = 0; p.respawn = 0; p.stun = 0; p.inv = 1.2; p.face = t ? Math.PI : 0;
    }
    onBridge(p) { return p.x > BX && p.x < BX + BW && p.y > BY && p.y < BY + BH; }
    partner(i) { const m = this.mates[this.team[i]]; return m.length === 2 ? m[m[0] === i ? 1 : 0] : -1; }

    push(p, i, nx, ny, f, by) {
      if (p.anchor) f *= 0.35;
      p.vx += nx * f / p.mass; p.vy += ny * f / p.mass; p.stun = Math.max(p.stun, 0.25);
      if (by >= 0) { p.last = by; p.lastT = 3; }
      void i;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) {
        this.time -= dt; this.elapsed += dt;
        if (this.time <= 0) { this.time = 0; this.finished = true; }
      }
      // khúc gỗ lăn ngang cầu (phải nhảy qua)
      this.logT -= dt;
      if (this.logT <= 0 && !this.finished) {
        this.logT = U.rand(3.5, 6) * (this.elapsed > this.total * 0.5 ? 0.75 : 1);
        const vert = Math.random() < 0.6, dir = Math.random() < 0.5 ? 1 : -1;
        this.logs.push(vert ? { vert, x: dir > 0 ? BX - 40 : BX + BW + 40, y: BY + BH / 2, v: dir * U.rand(230, 300), warn: 1.1 }
          : { vert, x: BX + BW / 2, y: dir > 0 ? BY - 40 : BY + BH + 40, v: dir * U.rand(200, 260), warn: 1.1 });
        Sfx.play('warn');
      }
      for (const L of this.logs) {
        if (L.warn > 0) { L.warn -= dt; continue; }
        if (L.vert) L.x += L.v * dt; else L.y += L.v * dt;
        L.roll = (L.roll || 0) + dt * 8;
        this.ps.forEach((p, i) => {
          if (p.fall > 0 || p.respawn > 0 || p.z > 14 || (p.logHit && p.logHit === L)) return;
          const d = L.vert ? Math.abs(p.x - L.x) : Math.abs(p.y - L.y);
          if (d < p.r + 16) { p.logHit = L; this.push(p, i, L.vert ? Math.sign(L.v) : 0, L.vert ? 0 : Math.sign(L.v), 620, -1); Sfx.play('hit'); FX.shake(4); }
        });
      }
      this.logs = this.logs.filter((L) => (L.vert ? L.x > BX - 80 && L.x < BX + BW + 80 : L.y > BY - 80 && L.y < BY + BH + 80) || L.warn > 0);

      this.ps.forEach((p, i) => {
        p.skip = p.fall > 0 || p.respawn > 0;
        p.lineCd -= dt; p.lastT -= dt; p.inv = (p.inv || 0) - dt;
        if (p.respawn > 0) { p.respawn -= dt; if (p.respawn <= 0) this.spawn(p, i); return; }
        if (p.fall > 0) { p.fall -= dt; if (p.fall <= 0) p.respawn = 1.2; return; }
        const q = this.finished ? { mx: 0, my: 0 } : inp[i];
        p.stun -= dt; p.dashT -= dt; p.dashCd -= dt;
        // Nhảy: chạm = nhảy (qua gỗ, qua dây), giữ = mỏ neo
        if (q.jump) p.hold += dt; else { if (p.hold > 0 && p.hold < TAP && p.jt <= 0 && p.stun <= 0) { p.jt = JUMP_T; Sfx.play('jump'); } p.hold = 0; }
        p.anchor = p.hold >= TAP && p.z <= 0;
        if (p.jt > 0) { p.jt -= dt; p.z = Math.sin(Math.PI * U.clamp(1 - p.jt / JUMP_T, 0, 1)) * 46; } else p.z = 0;
        if (p.stun <= 0 && !p.anchor) {
          if (q.mx || q.my) { p.face = Math.atan2(q.my, q.mx); p.walk += dt * 14; }
          if (q.actP && p.dashCd <= 0) { p.dashT = 0.2; p.dashCd = 1.1; p.vx = Math.cos(p.face) * 620; p.vy = Math.sin(p.face) * 620; Sfx.play('dash'); }
        }
        if (p.dashT <= 0) {
          const sp = p.anchor || p.stun > 0 ? 0 : 250, k = Math.min(1, dt * (p.anchor ? 14 : p.stun > 0 ? 2 : 8));
          p.vx += (q.mx * sp - p.vx) * k; p.vy += (q.my * sp - p.vy) * k;
        }
      });
      // dây thun: kéo hai đầu lại khi căng
      for (const [a, b] of this.ropes) {
        const A = this.ps[a], B = this.ps[b];
        if (A.respawn > 0 || B.respawn > 0) continue;
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
        if (d > REST) {
          const f = Math.min(d - REST, MAXL) * 9 * dt, nx = dx / d, ny = dy / d;
          // người đang rơi kéo đồng đội về phía mép (trừ khi neo)
          const wa = A.anchor || A.fall > 0 ? 0 : B.anchor || B.fall > 0 ? 2 : 1, wb = B.anchor || B.fall > 0 ? 0 : A.anchor || A.fall > 0 ? 2 : 1;
          A.vx += nx * f * wa; A.vy += ny * f * wa; B.vx -= nx * f * wb; B.vy -= ny * f * wb;
          if (d > MAXL) { const ex = (d - MAXL); if (wa) { A.x += nx * ex * wa / (wa + wb); A.y += ny * ex * wa / (wa + wb); } if (wb) { B.x -= nx * ex * wb / (wa + wb); B.y -= ny * ex * wb / (wa + wb); } }
        }
        // dây căng quét trúng người đội kia (người đang nhảy thì lọt qua)
        if (d > REST * 1.25 && A.fall <= 0 && B.fall <= 0) {
          const mvx = (A.vx + B.vx) / 2, mvy = (A.vy + B.vy) / 2, nx = -dy / d, ny = dx / d;
          const sweep = mvx * nx + mvy * ny;
          this.ps.forEach((p, j) => {
            if (this.team[j] === this.team[a] || p.fall > 0 || p.respawn > 0 || p.z > 10 || p.lineCd > 0) return;
            const t = U.clamp(((p.x - A.x) * dx + (p.y - A.y) * dy) / (d * d), 0, 1);
            const cx = A.x + dx * t, cy = A.y + dy * t, dd = Math.hypot(p.x - cx, p.y - cy);
            if (dd < p.r + 8 && t > 0.08 && t < 0.92) {
              const side = (p.x - cx) * nx + (p.y - cy) * ny >= 0 ? 1 : -1;
              const f = 380 + Math.min(500, Math.abs(sweep) * 1.2);
              this.push(p, j, nx * side, ny * side, f, a);
              p.lineCd = 0.45; Sfx.play('pull'); FX.shake(5);
              parts.burst(p.x, p.y, ['#fff', '#ffe14d'], 10, 200, 0.4, 4);
            }
          });
        }
      }
      // di chuyển + rơi
      this.ps.forEach((p, i) => {
        if (p.respawn > 0) return;
        if (p.fall > 0) { p.x += p.vx * dt * 0.3; p.y += p.vy * dt * 0.3; return; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (!this.onBridge(p) && p.z <= 0 && !this.finished) {
          p.fall = 0.8; p.falls++; Sfx.play('fall'); Party.rumble(i);
          const ot = 1 - this.team[i]; this.pts[ot]++;
          if (p.last >= 0 && p.lastT > 0 && this.team[p.last] === ot) this.ps[p.last].kos++;
          parts.burst(p.x, p.y, ['#8fd3ff', '#fff'], 22, 260, 0.6, 6);
          parts.text(p.x, p.y - 40, `+1 ${TEAMS.names[ot]}`, TEAMS.colors[ot], 26);
        }
      });
      Phys.separate(this.ps.filter((p) => p.fall <= 0 && p.respawn <= 0 && p.z < 14).map((p) => { p.skip = false; return p; }), 0.6, (A, B, nx, ny) => {
        const hit = (atk, vic, sx, sy) => {
          if (atk.dashT <= 0) return;
          atk.dashT = 0;
          const ia = this.ps.indexOf(atk), iv = this.ps.indexOf(vic);
          if (this.team[ia] === this.team[iv]) return;
          this.push(vic, iv, sx, sy, 520 * atk.mass, ia); Sfx.play('hit'); FX.shake(4);
        };
        hit(A, B, nx, ny); hit(B, A, -nx, -ny);
      });
    }

    draw(ctx) {
      const t = U.now();
      ctx.fillStyle = '#2a6fb3'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
      for (let k = 0; k < 14; k++) { const y = 40 + k * 50 + Math.sin(t + k) * 4; ctx.beginPath(); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 2 + k) * 5); ctx.stroke(); }
      // cầu gỗ
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; Draw.rr(ctx, BX + 6, BY + 14, BW, BH, 18); ctx.fill();
      Draw.rr(ctx, BX, BY, BW, BH, 18); ctx.fillStyle = '#b5834a'; ctx.fill();
      ctx.save(); Draw.rr(ctx, BX, BY, BW, BH, 18); ctx.clip();
      for (let x = BX; x < BX + BW; x += 46) { ctx.fillStyle = ((x - BX) / 46) % 2 ? '#a77641' : '#bd8c52'; ctx.fillRect(x, BY, 46, BH); }
      ctx.fillStyle = 'rgba(80,50,20,0.25)'; for (let x = BX; x < BX + BW; x += 46) ctx.fillRect(x, BY, 2, BH);
      // nửa sân mỗi đội
      ctx.fillStyle = TEAMS.colors[0] + '22'; ctx.fillRect(BX, BY, 140, BH);
      ctx.fillStyle = TEAMS.colors[1] + '22'; ctx.fillRect(BX + BW - 140, BY, 140, BH);
      ctx.restore();
      // khúc gỗ
      for (const L of this.logs) {
        if (L.warn > 0) {
          ctx.fillStyle = `rgba(255,80,80,${0.3 + 0.3 * Math.sin(t * 20)})`;
          if (L.vert) { const x = L.v > 0 ? BX + 4 : BX + BW - 34; ctx.fillRect(x, BY, 30, BH); Draw.text(ctx, L.v > 0 ? '▶' : '◀', x + 15, BY - 18, { size: 26, color: '#ff6b6b' }); }
          else { const y = L.v > 0 ? BY + 4 : BY + BH - 34; ctx.fillRect(BX, y, BW, 30); Draw.text(ctx, L.v > 0 ? '▼' : '▲', BX - 22, y + 15, { size: 26, color: '#ff6b6b' }); }
          continue;
        }
        ctx.fillStyle = '#6b4423'; ctx.strokeStyle = '#3e2410'; ctx.lineWidth = 3;
        if (L.vert) { Draw.rr(ctx, L.x - 16, BY - 6, 32, BH + 12, 14); ctx.fill(); ctx.stroke(); for (let k = 0; k < 8; k++) { const yy = BY + ((k * 60 + L.roll * 20) % BH); ctx.beginPath(); ctx.moveTo(L.x - 12, yy); ctx.lineTo(L.x + 12, yy); ctx.stroke(); } }
        else { Draw.rr(ctx, BX - 6, L.y - 16, BW + 12, 32, 14); ctx.fill(); ctx.stroke(); for (let k = 0; k < 16; k++) { const xx = BX + ((k * 64 + L.roll * 20) % BW); ctx.beginPath(); ctx.moveTo(xx, L.y - 12); ctx.lineTo(xx, L.y + 12); ctx.stroke(); } }
      }
      // dây thun
      for (const [a, b] of this.ropes) {
        const A = this.ps[a], B = this.ps[b];
        if (A.respawn > 0 || B.respawn > 0) continue;
        const d = Math.hypot(B.x - A.x, B.y - A.y), taut = U.clamp((d - REST) / (MAXL - REST), 0, 1);
        const col = TEAMS.colors[this.team[a]];
        ctx.strokeStyle = col; ctx.lineWidth = 7 - taut * 3; ctx.lineCap = 'round';
        const sag = (1 - taut) * 30, mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 + sag;
        ctx.beginPath(); ctx.moveTo(A.x, A.y - A.z); ctx.quadraticCurveTo(mx, my, B.x, B.y - B.z); ctx.stroke();
        if (taut > 0.25) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(A.x, A.y - A.z); ctx.quadraticCurveTo(mx, my, B.x, B.y - B.z); ctx.stroke(); }
      }
      const order = this.ps.map((_, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
      for (const i of order) {
        const p = this.ps[i];
        if (p.respawn > 0) continue;
        const sc = p.fall > 0 ? p.fall / 0.8 : 1;
        if (p.anchor) { ctx.strokeStyle = '#7fd6ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.8, p.r * 1.3, p.r * 0.45, 0, 0, TAU); ctx.stroke(); Draw.text(ctx, '⚓', p.x, p.y + p.r + 12, { size: 16, stroke: null }); }
        Draw.blob(ctx, { x: p.x, y: p.y, z: p.z, r: p.r, color: this.P[i].color, face: p.face, walk: p.walk, stun: p.stun > 0.15, scale: sc, alpha: p.inv > 0 && Math.sin(t * 30) > 0 ? 0.5 : 1 });
        ctx.strokeStyle = TEAMS.colors[this.team[i]]; ctx.lineWidth = 3;
        if (sc > 0.5) { ctx.beginPath(); ctx.arc(p.x, p.y - p.z, p.r + 6, 0, TAU); ctx.stroke(); }
      }
      Draw.chips(ctx, this.P, this.ps.map((p, i) => `${TEAMS.names[this.team[i]].replace('Đội ', '')} ${p.kos}`), { w: 170 });
      Draw.timer(ctx, this.time, W - 72, 38);
      Draw.rr(ctx, W / 2 - 90, 70, 180, 50, 25); ctx.fillStyle = 'rgba(20,12,40,0.65)'; ctx.fill();
      Draw.text(ctx, String(this.pts[0]), W / 2 - 50, 96, { size: 32, color: TEAMS.colors[0], sw: 4 });
      Draw.text(ctx, '–', W / 2, 96, { size: 28 });
      Draw.text(ctx, String(this.pts[1]), W / 2 + 50, 96, { size: 32, color: TEAMS.colors[1], sw: 4 });
      if (this.elapsed < 5) Draw.text(ctx, 'Kéo căng dây gạt đối thủ xuống nước · Chạm Nhảy: nhảy qua gỗ · Giữ Nhảy: mỏ neo · Đánh: húc', W / 2, H - 22, { size: 17, color: '#ffe14d', sw: 4 });
    }

    results() {
      return this.ps.map((p, i) => {
        const t = this.team[i];
        return { score: this.pts[t] * 100 - this.pts[1 - t] + p.kos * 0.1, text: `${TEAMS.names[t]} ${this.pts[t]}–${this.pts[1 - t]} · gạt rơi ${p.kos} · rơi ${p.falls}` };
      });
    }

    botInput(i) {
      const p = this.ps[i], o = { mx: 0, my: 0, actP: false, jump: false };
      if (p.fall > 0 || p.respawn > 0 || this.finished) return o;
      // khúc gỗ sắp lăn tới: nhảy
      for (const L of this.logs) {
        if (L.warn > 0) continue;
        const d = L.vert ? (p.x - L.x) * Math.sign(L.v) : (p.y - L.y) * Math.sign(L.v);
        if (d > 0 && d < p.r + 16 + Math.abs(L.v) * 0.16 && p.jt <= 0) { o.jump = true; p.botTap = 2; return o; }
      }
      if (p.botTap > 0) { p.botTap--; return o; } // nhả nút ngay → tính là chạm (nhảy)
      const pi = this.partner(i), mate = pi >= 0 ? this.ps[pi] : null;
      // đồng đội đang rơi → giữ Nhảy làm neo
      if (mate && mate.fall > 0) { o.jump = true; return o; }
      // gần mép mà có địch sát bên → neo
      const edge = Math.min(p.x - BX, BX + BW - p.x, p.y - BY, BY + BH - p.y);
      const foes = this.ps.map((q, j) => ({ q, j })).filter(({ q, j }) => this.team[j] !== this.team[i] && q.fall <= 0 && q.respawn <= 0);
      let tg = null, td = Infinity;
      for (const { q } of foes) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < td) { td = d; tg = q; } }
      if (edge < 50 && tg && td < 110) { o.jump = true; return o; }
      // tránh mép
      const cx = BX + BW / 2, cy = BY + BH / 2;
      if (edge < 45) { const a = Math.atan2(cy - p.y, cx - p.x); o.mx = Math.cos(a); o.my = Math.sin(a); return o; }
      if (!tg) return o;
      let tx = tg.x, ty = tg.y;
      if (mate && mate.fall <= 0 && mate.respawn <= 0) {
        // kẹp địch: đứng đối diện đồng đội qua người địch để dây quét trúng
        const ax = tg.x - mate.x, ay = tg.y - mate.y, ad = Math.hypot(ax, ay) || 1;
        tx = tg.x + ax / ad * 110 + (-ay / ad) * 60; ty = tg.y + ay / ad * 110 + (ax / ad) * 60;
      } else {
        // một mình: vòng ra phía trong rồi húc địch về phía mép gần nhất
        const ex = tg.x < cx ? -1 : 1, ey = tg.y < cy ? -1 : 1;
        const toEdgeX = Math.min(tg.x - BX, BX + BW - tg.x) < Math.min(tg.y - BY, BY + BH - tg.y);
        tx = tg.x - (toEdgeX ? ex * 70 : 0); ty = tg.y - (toEdgeX ? 0 : ey * 70);
        if (Math.hypot(tx - p.x, ty - p.y) < 30 && td < 95) {
          const a = Math.atan2(tg.y - p.y, tg.x - p.x); o.mx = Math.cos(a); o.my = Math.sin(a); o.actP = p.dashCd <= 0; return o;
        }
      }
      tx = U.clamp(tx, BX + 50, BX + BW - 50); ty = U.clamp(ty, BY + 50, BY + BH - 50);
      const d = Math.hypot(tx - p.x, ty - p.y);
      if (d > 12) { o.mx = (tx - p.x) / d; o.my = (ty - p.y) / d; }
      if (td < 80 && p.dashCd <= 0 && Math.random() < 0.05) { const a = Math.atan2(tg.y - p.y, tg.x - p.x); o.mx = Math.cos(a); o.my = Math.sin(a); o.actP = true; }
      return o;
    }
  }

  Party.register({
    id: 'bungee', name: 'Dây Thun', emoji: '🪢', cat: 'team',
    tagline: 'Hai người một đội nối dây thun — kéo căng gạt đội kia xuống nước',
    how: 'Chia 2 đội trên một cây cầu nổi; hai người cùng đội nối với nhau bằng dây thun. Kéo căng dây rồi quét ngang để gạt người đội kia rơi xuống nước (+1 điểm cho đội mình). '
      + 'Chạm Nhảy = nhảy qua khúc gỗ đang lăn hoặc qua dây của đội kia; giữ Nhảy = mỏ neo đứng chắc, đồng đội có thể quay vòng quanh bạn — và giữ được đồng đội đang rơi. Đánh = lao húc. '
      + 'Đội chỉ có 1 người thì không có dây nhưng nặng và húc mạnh hơn. Hết giờ đội nhiều điểm thắng.',
    controls: { move: 'Chạy', act: 'Lao húc', jump: 'Chạm: nhảy · Giữ: mỏ neo' },
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Bungee(api),
  });
})();

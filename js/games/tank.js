'use strict';
/* Xe Tăng — chạy & xoay nòng, bắn đạn nảy 1 lần. Hạ đối thủ để ghi điểm. */
(() => {
  const AX = 30, AY = 80, AW = W - 60, AH = H - 80 - 16;
  const GAME_TIME = 60, BSPEED = 560;
  const OBS = [
    { x: W / 2 - 35, y: AY + AH / 2 - 110, w: 70, h: 220 },
    { x: 290, y: 200, w: 160, h: 46 }, { x: W - 450, y: 200, w: 160, h: 46 },
    { x: 290, y: AY + AH - 140, w: 160, h: 46 }, { x: W - 450, y: AY + AH - 140, w: 160, h: 46 },
    { x: 170, y: AY + AH / 2 - 30, w: 60, h: 60 }, { x: W - 230, y: AY + AH / 2 - 30, w: 60, h: 60 },
  ];
  const SPAWN = [[AX + 70, AY + 70], [AX + AW - 70, AY + AH - 70], [AX + AW - 70, AY + 70], [AX + 70, AY + AH - 70]];

  const MODES = [
    { id: 'ffa', name: 'Hỗn chiến', desc: 'Ai cũng là đối thủ — hạ nhiều nhất là thắng.' },
    { id: 'ctf', name: 'Cướp cờ', desc: 'Chia 2 đội (4 người: 2–2). Chạy sang lấy cờ đội bạn mang về căn cứ mình. Hạ người cầm cờ thì cờ rơi; chạm cờ nhà đang rơi để trả về. Bị hạ thì 3 giây sau hồi sinh ở căn cứ.' },
  ];
  const BASE = [[AX + 64, AY + AH / 2], [AX + AW - 64, AY + AH / 2]];
  const TSPAWN = [[SPAWN[0], SPAWN[3]], [SPAWN[2], SPAWN[1]]];
  const inRect = (x, y, r, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

  class Tank {
    constructor(api) {
      this.api = api; this.P = api.players; this.n = this.P.length;
      this.time = this.total = api.T(GAME_TIME); this.finished = false;
      this.ps = this.P.map((p, i) => ({
        x: SPAWN[i][0], y: SPAWN[i][1], vx: 0, vy: 0, r: 24, face: SPAWN[i][0] < W / 2 ? 0 : Math.PI,
        dead: 0, inv: 1, fireCd: 0, kills: 0, deaths: 0, recoil: 0, skip: false, dodgeT: 0, dodgeA: 0,
      }));
      this.bullets = [];
      this.ctf = api.mode === 'ctf';
      if (this.ctf) {
        this.team = TEAMS.split(this.n); this.target = api.count(3); this.caps = [0, 0]; this.time = this.total = api.T(90);
        this.flags = BASE.map(([x, y]) => ({ x, y, home: true, carrier: -1, dropT: 0 }));
        this.ps.forEach((p, i) => {
          const t = this.team[i], k = this.team.slice(0, i).filter((x) => x === t).length;
          [p.x, p.y] = TSPAWN[t][k % 2]; p.face = t === 0 ? 0 : Math.PI; p.caps = 0; p.flag = -1;
        });
      } else this.teamOf = null;
    }
    teamOf(i) { return this.team[i]; }
    foe(a, b) { return !this.ctf || this.team[a] !== this.team[b]; }
    /** TNK3: cờ rơi tại chỗ người cầm */
    dropFlag(p) {
      if (!this.ctf || p.flag < 0) return;
      const f = this.flags[p.flag];
      f.carrier = -1; f.x = p.x; f.y = p.y; f.dropT = 8; p.flag = -1;
    }
    updateFlags(dt) {
      const parts = this.api.parts;
      this.flags.forEach((f, ft) => {
        if (f.carrier >= 0) { const c = this.ps[f.carrier]; f.x = c.x; f.y = c.y; return; }
        if (!f.home) {
          f.dropT -= dt;
          if (f.dropT <= 0) { [f.x, f.y] = BASE[ft]; f.home = true; parts.text(f.x, f.y - 40, 'Cờ đã về nhà', TEAMS.colors[ft], 22); }
        }
        if (this.finished) return;
        this.ps.forEach((p, i) => {
          if (p.dead > 0 || f.carrier >= 0 || Math.hypot(p.x - f.x, p.y - f.y) > p.r + 18) return;
          if (this.team[i] === ft) {
            if (!f.home) { [f.x, f.y] = BASE[ft]; f.home = true; Sfx.play('pickup'); parts.text(p.x, p.y - 40, 'Trả cờ!', TEAMS.colors[ft], 24); }
          } else if (p.flag < 0) {
            f.carrier = i; f.home = false; p.flag = ft; Sfx.play('pickup'); Party.rumble(i, 0.5, 150);
            parts.text(p.x, p.y - 40, `${this.P[i].name} lấy cờ!`, this.P[i].color.light, 24);
          }
        });
      });
      // mang cờ đội bạn về căn cứ mình là ghi điểm
      this.ps.forEach((p, i) => {
        if (p.flag < 0 || p.dead > 0 || this.finished) return;
        const t = this.team[i], [bx, by] = BASE[t];
        if (Math.hypot(p.x - bx, p.y - by) < 46) {
          const f = this.flags[p.flag];
          [f.x, f.y] = BASE[p.flag]; f.home = true; f.carrier = -1; p.flag = -1;
          this.caps[t]++; p.caps++;
          Sfx.play('win'); FX.shake(6); parts.burst(bx, by, [TEAMS.colors[t], '#fff', '#ffe14d'], 40, 340, 0.9, 7);
          parts.text(W / 2, AY + 40, `${TEAMS.names[t]} ghi điểm! ${this.caps[0]} – ${this.caps[1]}`, TEAMS.colors[t], 34);
          if (this.caps[t] >= this.target) this.finished = true;
        }
      });
    }

    los(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 12);
      for (let k = 1; k < n; k++) {
        const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
        if (OBS.some((o) => inRect(x, y, o, 4))) return false;
      }
      return true;
    }

    respawnPoint(i) {
      let best = SPAWN[0], bs = -1;
      for (const s of SPAWN) {
        let m = Infinity;
        this.ps.forEach((q, j) => { if (j !== i && q.dead <= 0) m = Math.min(m, Math.hypot(q.x - s[0], q.y - s[1])); });
        m += Math.random() * 60;
        if (m > bs) { bs = m; best = s; }
      }
      return best;
    }

    update(dt, inp) {
      const parts = this.api.parts;
      if (!this.finished) { this.time -= dt; if (this.time <= 0) { this.time = 0; this.finished = true; } }
      this.ps.forEach((p, i) => {
        p.skip = p.dead > 0;
        if (p.dead > 0) {
          p.dead -= dt;
          if (p.dead <= 0) {
            const [x, y] = this.ctf ? U.pick(TSPAWN[this.team[i]]) : this.respawnPoint(i);
            Object.assign(p, { x, y, vx: 0, vy: 0, inv: 1.5 });
          }
          return;
        }
        const q = inp[i];
        p.inv -= dt; p.fireCd -= dt; p.recoil = Math.max(0, p.recoil - dt * 6);
        const mag = Math.hypot(q.mx, q.my);
        if (mag > 0.05) {
          const ta = Math.atan2(q.my, q.mx);
          p.face += U.clamp(U.angDiff(p.face, ta), -7 * dt, 7 * dt);
        }
        const k = Math.min(1, dt * 10);
        const spd = this.ctf && p.flag >= 0 ? 205 : 220;
        p.vx += (q.mx * spd - p.vx) * k; p.vy += (q.my * spd - p.vy) * k;
        p.x += p.vx * dt; p.y += p.vy * dt;
        for (const o of OBS) Phys.circleRect(p, o);
        p.x = U.clamp(p.x, AX + p.r, AX + AW - p.r); p.y = U.clamp(p.y, AY + p.r, AY + AH - p.r);
        const mine = this.bullets.filter((b) => b.owner === i).length;
        // bắn lúc NHẢ nút (bước nền cho TNK5 pháo cối: giữ lâu = đạn khác). Máy chỉ gửi actP → coi như bấm-nhả cùng khung hình
        const released = (p.held && !q.act) || (q.actP && !q.act);
        if (q.act) p.holdT = (p.held ? p.holdT : 0) + dt;
        p.lastHold = released ? (p.holdT || 0) : p.lastHold;
        p.held = !!q.act;
        if (released && p.fireCd <= 0 && mine < 3 && !this.finished) {
          p.fireCd = 0.4; p.recoil = 1;
          const c = Math.cos(p.face), s = Math.sin(p.face);
          this.bullets.push({ x: p.x + c * 32, y: p.y + s * 32, vx: c * BSPEED, vy: s * BSPEED, owner: i, bounces: 1, age: 0 });
          Sfx.play('shoot');
          parts.burst(p.x + c * 36, p.y + s * 36, ['#ffe14d', '#fff'], 5, 120, 0.2, 4);
        }
      });
      Phys.separate(this.ps, 0.3);
      if (this.ctf) this.updateFlags(dt);

      // đạn
      for (const b of this.bullets) {
        b.age += dt;
        for (let sub = 0; sub < 2; sub++) {
          const px = b.x, py = b.y;
          b.x += b.vx * dt / 2; b.y += b.vy * dt / 2;
          let bounced = false;
          for (const o of OBS) {
            if (inRect(b.x, b.y, o)) {
              if (!(px > o.x && px < o.x + o.w)) b.vx *= -1; else b.vy *= -1;
              b.x = px; b.y = py; bounced = true; break;
            }
          }
          if (b.x < AX || b.x > AX + AW) { b.vx *= -1; b.x = px; bounced = true; }
          if (b.y < AY || b.y > AY + AH) { b.vy *= -1; b.y = py; bounced = true; }
          if (bounced) {
            b.bounces--;
            if (b.bounces < 0) { b.dead = true; parts.burst(b.x, b.y, ['#ffe14d', '#aaa'], 6, 100, 0.25, 3); break; }
            Sfx.play('tick', 0.05);
          }
          for (let i = 0; i < this.n && !b.dead; i++) {
            const p = this.ps[i];
            if (p.dead > 0 || p.inv > 0) continue;
            if (i === b.owner && b.age < 0.3) continue;
            if (i !== b.owner && !this.foe(i, b.owner)) continue;
            if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + 5) {
              b.dead = true;
              if (!this.finished) {
                p.dead = this.ctf ? 3 : 1.8; p.deaths++; this.dropFlag(p);
                if (b.owner !== i) this.ps[b.owner].kills++;
                parts.text(p.x, p.y - 30, b.owner === i ? 'Tự bắn!' : `+1 ${this.P[b.owner].name}`, this.P[b.owner].color.light, 26);
              }
              Sfx.play('boom'); FX.shake(8); Party.rumble(i, 1, 300);
              parts.burst(p.x, p.y, ['#ff7a1a', '#ffe14d', '#555', this.P[i].color.main], 30, 320, 0.7, 7);
            }
          }
          if (b.dead) break;
        }
      }
      this.bullets = this.bullets.filter((b) => !b.dead && b.age < 3);
    }

    draw(ctx) {
      ctx.fillStyle = '#5a4a32'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#cdb27c'; ctx.fillRect(AX, AY, AW, AH);
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      for (let x = AX; x < AX + AW; x += 60) for (let y = AY; y < AY + AH; y += 60) if (((x - AX) / 60 + (y - AY) / 60) % 2 === 0) ctx.fillRect(x, y, 60, 60);
      ctx.strokeStyle = '#7a6440'; ctx.lineWidth = 6; ctx.strokeRect(AX, AY, AW, AH);
      for (const o of OBS) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(o.x + 5, o.y + 8, o.w, o.h);
        ctx.fillStyle = '#6f7690'; ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = '#9aa1bb'; ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, o.h - 12);
        ctx.fillStyle = '#5a6078';
        for (let x = o.x + 10; x < o.x + o.w - 6; x += 22) for (let y = o.y + 10; y < o.y + o.h - 10; y += 22) {
          ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
        }
      }
      if (this.ctf) {
        BASE.forEach(([x, y], t) => {
          ctx.fillStyle = TEAMS.colors[t] + '44'; ctx.strokeStyle = TEAMS.colors[t]; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        });
        this.flags.forEach((f, t) => {
          if (f.carrier >= 0) return;
          this.drawFlag(ctx, f.x, f.y, t, 1);
          if (!f.home) { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(Math.ceil(f.dropT) + 's', f.x, f.y + 22); }
        });
      }
      for (const b of this.bullets) {
        const c = this.P[b.owner].color;
        ctx.fillStyle = c.main; ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(b.x - b.vx * 0.015, b.y - b.vy * 0.015, 7, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = '#2a2a35';
        ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, TAU); ctx.fill();
        ctx.strokeStyle = c.light; ctx.lineWidth = 2; ctx.stroke();
      }
      const t = U.now();
      this.ps.forEach((p, i) => {
        const c = this.P[i].color;
        if (p.dead > 0) {
          const [sx, sy] = this.respawnPoint(i);
          void sx; void sy;
          return;
        }
        const blink = p.inv > 0 && Math.sin(t * 30) > 0;
        ctx.save(); ctx.globalAlpha = blink ? 0.45 : 1;
        ctx.translate(p.x, p.y); ctx.rotate(p.face);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; Draw.rr(ctx, -24, -18, 52, 42, 10); ctx.fill();
        ctx.fillStyle = '#2b2b36';
        Draw.rr(ctx, -26, -24, 52, 12, 5); ctx.fill();
        Draw.rr(ctx, -26, 12, 52, 12, 5); ctx.fill();
        ctx.fillStyle = c.main; Draw.rr(ctx, -21, -15, 42, 30, 9); ctx.fill();
        ctx.strokeStyle = 'rgba(20,10,40,0.5)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = c.dark; Draw.rr(ctx, 6 - p.recoil * 6, -5, 30, 10, 4); ctx.fill();
        ctx.restore();
        Draw.blob(ctx, { x: p.x, y: p.y - 4, r: 13, color: c, face: p.face, shadow: false, alpha: blink ? 0.45 : 1 });
        if (this.ctf) {
          ctx.strokeStyle = TEAMS.colors[this.team[i]]; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, TAU); ctx.stroke();
          if (p.flag >= 0) this.drawFlag(ctx, p.x - 14, p.y - 22, p.flag, 0.8);
        }
      });
      const lead = this.ps.reduce((bi, p, i, a) => (p.kills > a[bi].kills ? i : bi), 0);
      if (this.ctf) {
        Draw.chips(ctx, this.P, this.ps.map((p) => (p.dead > 0 ? '💥 ' : p.flag >= 0 ? '🚩 ' : '🎯 ') + p.kills), { w: 150 });
        // tỉ số đội ở góc trái trên
        Draw.rr(ctx, 14, 14, 150, 50, 25); ctx.fillStyle = 'rgba(20,12,40,0.6)'; ctx.fill();
        Draw.text(ctx, String(this.caps[0]), 46, 40, { size: 30, color: TEAMS.colors[0], sw: 4 });
        Draw.text(ctx, '🚩', 89, 40, { size: 24, stroke: null });
        Draw.text(ctx, String(this.caps[1]), 132, 40, { size: 30, color: TEAMS.colors[1], sw: 4 });
        Draw.text(ctx, `cướp ${this.target} cờ là thắng`, 89, 72, { size: 13, sw: 3 });
      } else Draw.chips(ctx, this.P, this.ps.map((p) => (p.dead > 0 ? '💥 ' : '🎯 ') + p.kills), { crown: this.ps[lead].kills > 0 ? lead : -1 });
      Draw.timer(ctx, this.time, W - 72, 38);
    }
    drawFlag(ctx, x, y, t, s) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.strokeStyle = '#3a3040'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -30); ctx.stroke();
      ctx.fillStyle = TEAMS.colors[t]; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(26, -22 + Math.sin(U.now() * 6) * 2); ctx.lineTo(0, -12); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }

    results() {
      if (this.ctf) return this.ps.map((p, i) => {
        const t = this.team[i];
        return { score: this.caps[t] * 1000 + p.caps * 10 + p.kills, text: `${TEAMS.names[t]} ${this.caps[t]}–${this.caps[1 - t]} · cướp ${p.caps} cờ · hạ ${p.kills}` };
      });
      return this.ps.map((p) => ({ score: p.kills * 10 - p.deaths * 0.1, text: `Hạ ${p.kills} · bị hạ ${p.deaths}` }));
    }

    botInput(i) {
      const p = this.ps[i];
      const o = { mx: 0, my: 0, actP: false };
      if (p.dead > 0) return o;
      // né đạn đang bay tới
      p.dodgeT -= 1 / 60;
      for (const b of this.bullets) {
        if (b.owner === i && b.age < 0.3) continue;
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
        const sp = Math.hypot(b.vx, b.vy);
        if (d < 160 && (dx * b.vx + dy * b.vy) / (d * sp) > 0.92 && p.dodgeT <= 0) {
          p.dodgeT = 0.35; p.dodgeA = Math.atan2(b.vy, b.vx) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        }
      }
      if (p.dodgeT > 0) { o.mx = Math.cos(p.dodgeA); o.my = Math.sin(p.dodgeA); return o; }
      let tgt = null, td = Infinity;
      this.ps.forEach((q, j) => {
        if (j === i || q.dead > 0 || !this.foe(i, j)) return;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < td) { td = d; tgt = q; }
      });
      if (this.ctf) {
        const goal = this.ctfGoal(i, p);
        const see = tgt && this.los(p.x, p.y, tgt.x, tgt.y);
        // đánh nhau khi địch ở gần & nhìn thấy (người cầm cờ chỉ bắn khi địch rất gần)
        const fight = tgt && see && td < (p.flag >= 0 ? 160 : 300);
        if (!fight) {
          const d = this.navDir(p, goal.x, goal.y);
          o.mx = Math.cos(d); o.my = Math.sin(d);
          if (tgt && see && Math.abs(U.angDiff(p.face, Math.atan2(tgt.y - p.y, tgt.x - p.x))) < 0.12 && p.fireCd <= 0) o.actP = true;
          return o;
        }
      }
      if (!tgt) return o;
      const lead = td / BSPEED;
      const ax = tgt.x + tgt.vx * lead, ay = tgt.y + tgt.vy * lead;
      const aim = Math.atan2(ay - p.y, ax - p.x);
      const see = this.los(p.x, p.y, tgt.x, tgt.y);
      const dir = see ? aim : this.navDir(p, tgt.x, tgt.y);
      const move = !see || td > 300;
      if (move) { o.mx = Math.cos(dir); o.my = Math.sin(dir); }
      else { o.mx = Math.cos(aim) * 0.25; o.my = Math.sin(aim) * 0.25; }
      if (see && Math.abs(U.angDiff(p.face, aim)) < 0.12 && p.fireCd <= 0) o.actP = true;
      return o;
    }
  }

  // điểm dẫn đường quanh các góc chướng ngại (tính sẵn), dùng để tìm đường ngắn nhất khi bị che
  const NODES = [];
  for (const o of OBS) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = (sx < 0 ? o.x : o.x + o.w) + sx * 36, y = (sy < 0 ? o.y : o.y + o.h) + sy * 36;
    if (x > AX + 26 && x < AX + AW - 26 && y > AY + 26 && y < AY + AH - 26 && !OBS.some((r) => inRect(x, y, r, 26))) NODES.push([x, y]);
  }
  const clear = (x0, y0, x1, y1) => {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 14);
    for (let k = 1; k < n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; if (OBS.some((o) => inRect(x, y, o, 22))) return false; }
    return true;
  };
  const NEI = NODES.map((a, i) => NODES.map((b, j) => (i !== j && clear(a[0], a[1], b[0], b[1]) ? Math.hypot(a[0] - b[0], a[1] - b[1]) : -1)));
  Tank.prototype.navDir = function (p, x, y) {
    const aim = Math.atan2(y - p.y, x - p.x);
    if (clear(p.x, p.y, x, y)) return aim;
    // Dijkstra trên các điểm dẫn đường
    const N = NODES.length, dist = new Array(N).fill(Infinity), done = new Array(N).fill(false), prev = new Array(N).fill(-1);
    for (let k = 0; k < N; k++) if (clear(p.x, p.y, NODES[k][0], NODES[k][1])) dist[k] = Math.hypot(NODES[k][0] - p.x, NODES[k][1] - p.y);
    let best = -1, bestD = Infinity;
    for (let it = 0; it < N; it++) {
      let u = -1;
      for (let k = 0; k < N; k++) if (!done[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
      if (u < 0) break;
      done[u] = true;
      if (dist[u] >= bestD) break;
      if (clear(NODES[u][0], NODES[u][1], x, y)) { const tot = dist[u] + Math.hypot(x - NODES[u][0], y - NODES[u][1]); if (tot < bestD) { bestD = tot; best = u; } }
      for (let v = 0; v < N; v++) if (NEI[u][v] > 0 && dist[u] + NEI[u][v] < dist[v]) { dist[v] = dist[u] + NEI[u][v]; prev[v] = u; }
    }
    if (best < 0) return aim;
    let k = best;
    while (prev[k] >= 0) k = prev[k];
    return Math.atan2(NODES[k][1] - p.y, NODES[k][0] - p.x);
  };
  /** TNK3: máy chọn đích — cầm cờ thì về nhà, cờ nhà bị lấy thì đuổi, cờ nhà rơi thì nhặt trả, còn lại đi cướp cờ */
  Tank.prototype.ctfGoal = function (i, p) {
    const t = this.team[i], mine = this.flags[t], theirs = this.flags[1 - t];
    if (p.flag >= 0) return { x: BASE[t][0], y: BASE[t][1] };
    if (mine.carrier >= 0) return { x: mine.x, y: mine.y, chase: this.ps[mine.carrier] };
    if (!mine.home) return { x: mine.x, y: mine.y };
    const mates = this.ps.map((_, j) => j).filter((j) => this.team[j] === t);
    // đội 2 người: người thứ hai đứng giữ nhà khi có địch tiến gần
    if (mates.length > 1 && mates[1] === i && theirs.carrier < 0) {
      const threat = this.ps.some((q, j) => this.team[j] !== t && q.dead <= 0 && Math.hypot(q.x - BASE[t][0], q.y - BASE[t][1]) < 260);
      if (threat) return { x: BASE[t][0] + (t === 0 ? 90 : -90), y: BASE[t][1] };
    }
    if (theirs.carrier >= 0) { const c = this.ps[theirs.carrier]; return { x: c.x + (t === 0 ? -60 : 60), y: c.y }; }
    return { x: theirs.x, y: theirs.y };
  };

  Party.register({
    id: 'tank', name: 'Xe Tăng', emoji: '🪖',
    tagline: 'Chạy & xoay nòng, bắn đạn nảy · hạ nhiều nhất là thắng',
    how: 'Xe quay nòng theo hướng bạn đi, đạn bắn ra lúc NHẢ nút Đánh. Đạn nảy được 1 lần khi chạm tường — coi chừng tự bắn trúng mình! Hạ đối thủ được 1 điểm, bị hạ thì 2 giây sau hồi sinh.',
    controls: { move: 'Chạy & xoay nòng', act: 'Bắn' },
    modes: MODES,
    minPlayers: 2, maxPlayers: 4,
    create: (api) => new Tank(api),
  });
})();

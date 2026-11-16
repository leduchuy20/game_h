// Gõ Chữ Tiếng Anh — chế độ ☄️ Bắn Thiên Thạch (ý tưởng ZType / Typing of the Dead / Epistory, hình tự vẽ).
// Thiên thạch mang từ tiếng Anh rơi về phía trạm; gõ chữ đầu để khoá mục tiêu, mỗi phím đúng là một phát bắn.
// Hết mỗi đợt có Trùm mang một câu ví dụ. Độ khó tự chỉnh theo WPM gần đây của người chơi (bị trúng thì chậm lại, sạch đợt thì nhanh lên).
// Nạp SAU typing.js (dùng window.TypingGame).
(() => {
  'use strict';
  const G = window.TypingGame;
  if (!G) return;
  const { C, SENTS, COL, MONO, T, panel, bigStat, fit } = G;

  const SHIP = { x: 640, y: 650 };
  const LIVES = 3, WAVES = 5, BANNER_T = 2, NEXT_T = 1.8, OVER_T = 1.6, TOP = 96;
  // độ dài từ theo đợt (đợt sau từ dài hơn)
  const LEN = [[3, 5], [3, 6], [4, 7], [4, 8], [5, 10]];
  const STARS = Array.from({ length: 150 }, () => ({ x: Math.random() * 1280, y: Math.random() * 720, z: 0.2 + Math.random() * 0.8 }));

  const M = {
    name: 'Bắn Thiên Thạch', ownBlob: true,
    init() { this.nwaves = this.api.count(WAVES); },
    setup() {
      this.mets = []; this.shots = []; this.booms = [];
      this.wave = 0; this.lives = LIVES; this.score = 0; this.combo = 0; this.bestCombo = 0;
      this.target = null; this.good = 0; this.bad = 0; this.kills = 0;
      this.missed = []; this.bossLog = []; this.usedS = new Set();
      this.perKey = {}; this.tLast = null; this.mt0 = this.ms();
      this.over = null; this.nextT = 0; this.recoil = 0; this.aim = -Math.PI / 2; this.flash = 0;
      // tốc độ gõ dùng để chỉnh độ khó (ký tự/giây)
      this.cps = U.clamp(C.recentWpm(this.prof.hist, 25) * 5 / 60, 1.2, 9);
      // từ đến hạn ôn được ưu tiên xuất hiện
      const srs = this.prof.srs;
      this.dueW = C.shuffle(Object.keys(srs).filter((w) => srs[w][1] <= this.day && (this.isMine()
        ? this.mineB.byWord.has(w) : /^[a-z]{2,12}$/.test(w) && (this.level === 'rand' || C.LEVELS[(BANK_LV(w))] === this.level))));
      startWave.call(this);
    },
    key(e) {
      const k = e.key;
      if (this.over) return true;
      if (k === 'Enter') { bomb.call(this); return true; }
      if (k === 'Backspace') {
        const m = this.target;
        if (m && !m.boss) { m.typed = 0; this.target = null; Sfx.play('tick'); }
        return true;
      }
      if (k.length !== 1) return false;
      if (/^[\x20-\x7e]$/.test(k)) fire.call(this, k);
      return true;
    },
    update(dt) {
      this.recoil = Math.max(0, this.recoil - dt * 7);
      this.flash = Math.max(0, this.flash - dt * 2.5);
      this.shots = this.shots.filter((s) => (s.t += dt) < s.life);
      this.booms = this.booms.filter((b) => (b.t += dt) < b.life);
      if (this.over) {
        this.over.t += dt;
        moveMets.call(this, dt * 0.25);
        if (this.over.t > OVER_T) this.endRun();
        return;
      }
      if (this.banner) { this.banner.t += dt; if (this.banner.t > BANNER_T) this.banner = null; }
      // sinh thiên thạch / Trùm
      if (!this.banner || this.banner.boss) {
        if (this.toSpawn > 0) {
          if ((this.spawnT -= dt) <= 0) { const m = spawn.call(this); this.toSpawn--; this.spawnT = gapFor.call(this, m.word.length); }
        } else if (!this.boss && !this.bossDone && this.mets.every((m) => m.dead)) spawnBoss.call(this);
      }
      moveMets.call(this, dt);
      this.mets = this.mets.filter((m) => !m.dead);
      // hết đợt
      if (this.bossDone && (this.nextT -= dt) <= 0) {
        if (this.wave >= this.nwaves) { this.over = { t: 0, win: true }; Sfx.play('win'); }
        else { if (!this.waveHit) this.cps *= 1.06; startWave.call(this); }
      }
      // nòng súng quay về mục tiêu
      const tg = this.target;
      const want = tg ? Math.atan2(tg.y - SHIP.y + 30, tg.x - SHIP.x) : -Math.PI / 2;
      this.aim += U.angDiff(this.aim, want) * Math.min(1, dt * 14);
    },
    bot(dt) {
      this.botT = (this.botT || 0) + dt;
      const gap = 60 / ((this.botWpm || 42) * 5);     // botWpm: make-thumbs cho máy gõ chậm để ảnh có nhiều thiên thạch
      while (this.botT > gap) {
        this.botT -= gap;
        if (this.over || (this.banner && !this.banner.boss)) return;
        let m = this.target;
        if (!m) m = this.mets.filter((x) => !x.dead).sort((a, b) => b.y - a.y)[0];
        if (!m) return;
        if (Math.random() < 0.03) fire.call(this, m.word[m.typed] === 'q' ? 'w' : 'q');
        else fire.call(this, m.word[m.typed]);
      }
    },
    bg(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#07061c'); g.addColorStop(0.6, '#1a0d40'); g.addColorStop(1, '#2d1460');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const s of STARS) {
        const y = (s.y + this.t * 18 * s.z) % H;
        ctx.globalAlpha = 0.3 + 0.6 * s.z; ctx.fillStyle = '#fff';
        ctx.fillRect(s.x, y, 1.5 * s.z + 0.5, 1.5 * s.z + 0.5);
      }
      ctx.globalAlpha = 1;
      // mặt hành tinh dưới chân trạm
      const pg = ctx.createRadialGradient(640, 1560, 840, 640, 1560, 930);
      pg.addColorStop(0, '#3b2a7a'); pg.addColorStop(0.9, '#5a3fa8'); pg.addColorStop(1, 'rgba(140,110,255,0)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(640, 1560, 930, 0, 7); ctx.fill();
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,240,200,${this.flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    },
    draw(ctx) {
      // HUD
      for (let i = 0; i < LIVES; i++) T(ctx, i < this.lives ? '❤️' : '🖤', 52 + i * 34, TOP, { size: 26 });
      T(ctx, `Đợt ${this.wave}/${this.nwaves}`, 640, TOP, { size: 26, color: '#fff' });
      T(ctx, `Điểm ${this.score}  ·  Combo ×${this.combo}  ·  💥 ${this.bombs}`, W - 40, TOP, { size: 22, color: COL.accent, align: 'right' });
      // thiên thạch
      for (const m of this.mets) if (!m.dead) drawRock(ctx, m, this.t, m === this.target);
      for (const m of this.mets) if (!m.dead) drawLabel(ctx, m, m === this.target, this.t);
      // tia bắn
      for (const s of this.shots) {
        const k = 1 - s.t / s.life;
        ctx.strokeStyle = `rgba(120,255,220,${k})`; ctx.lineWidth = 4 * k + 1;
        ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${k})`; ctx.beginPath(); ctx.arc(s.x1, s.y1, 6 * k + 2, 0, 7); ctx.fill();
      }
      // vụ nổ
      for (const b of this.booms) {
        const k = b.t / b.life;
        ctx.strokeStyle = b.c; ctx.globalAlpha = 1 - k; ctx.lineWidth = 6 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.3 + k), 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      drawShip(ctx, this);
      // banner đợt / Trùm
      if (this.banner) {
        const k = this.banner.t / BANNER_T, a = Math.min(1, (1 - k) * 3, this.banner.t * 6);
        ctx.globalAlpha = a;
        T(ctx, this.banner.text, 640, 300, { size: 64, color: this.banner.boss ? COL.bad : COL.accent });
        if (this.banner.sub) T(ctx, this.banner.sub, 640, 356, { size: 26, color: '#fff' });
        ctx.globalAlpha = 1;
      }
      if (this.over) {
        const a = Math.min(1, this.over.t * 2);
        ctx.globalAlpha = a;
        T(ctx, this.over.win ? '🛡️ Trạm an toàn!' : '💥 Hết khiên!', 640, 320, { size: 64, color: this.over.win ? COL.mint : COL.bad });
        ctx.globalAlpha = 1;
      }
      T(ctx, 'Gõ chữ đầu để khoá mục tiêu · Backspace: bỏ khoá · Enter: bom quét sạch (mỗi đợt 1 lần)', 640, 704, { size: 17, color: COL.sub });
    },
    end() {
      const prof = this.prof, t = this.ms();
      const min = Math.max(1 / 60, (t - this.mt0) / 60000);
      const wpm = Math.round(this.good / 5 / min), acc = Math.round(100 * this.good / Math.max(1, this.good + this.bad));
      C.mergeKeys(prof, this.perKey);
      const missed = [...new Set(this.missed)];
      this.markWrong(missed);
      const best = prof.best.meteor || 0, record = this.score > best && this.good > 10;
      if (record) prof.best.meteor = this.score;
      // WPM ở đây bị nhịp rơi của thiên thạch giới hạn nên lưu là mwpm (không vào biểu đồ tốc độ)
      prof.hist.push({ d: this.day, m: 'meteor', mwpm: wpm, acc, score: this.score });
      this.result = { win: !!(this.over && this.over.win), score: this.score, wpm, acc, wave: this.wave, kills: this.kills,
        bestCombo: this.bestCombo, missed, boss: this.bossLog, best, record };
    },
    drawSum(ctx) {
      const r = this.result;
      panel(ctx, 160, 84, 960, 568);
      T(ctx, r.win ? '🛡️ Bảo vệ trạm thành công!' : `💥 Hết khiên ở đợt ${r.wave}/${this.nwaves}`, 640, 130, { size: 40, color: r.win ? COL.mint : COL.bad });
      bigStat(ctx, 400, 205, `${r.score}`, 'điểm', COL.accent, 62);
      bigStat(ctx, 640, 205, `${r.wpm}`, 'WPM', '#fff', 62);
      bigStat(ctx, 880, 205, `${r.acc}%`, 'chính xác', COL.mint, 62);
      T(ctx, `Hạ ${r.kills} thiên thạch · combo cao nhất ×${r.bestCombo}` + (r.record ? ` · 🏆 Kỷ lục mới! (trước: ${r.best})` : r.best ? ` · kỷ lục ${r.best}` : ''),
        640, 262, { size: 21, color: r.record ? COL.accent : COL.sub });
      let y = 298;
      // câu của Trùm + bản dịch (lúc này mới hiện nghĩa)
      if (r.boss.length) {
        T(ctx, 'Câu của Trùm:', 210, y, { size: 21, color: '#fff', align: 'left' });
        r.boss.slice(-2).forEach((b, i) => {
          const yy = y + 30 + i * 52;
          T(ctx, (b.ok ? '✓ ' : '✗ ') + fit(ctx, b.s, 820, 20, MONO), 210, yy, { size: 20, color: b.ok ? COL.good : COL.bad, align: 'left', font: MONO });
          T(ctx, fit(ctx, b.vi, 820, 18), 236, yy + 22, { size: 18, color: COL.sub, align: 'left' });
        });
        y += 30 + Math.min(2, r.boss.length) * 52 + 6;
      }
      this.drawWrong(ctx, r.missed, y, 6);
    },
    results() {
      const r = this.result || {};
      return [{ score: r.score || 0, text: `${r.score || 0} điểm · đợt ${r.wave || 0}/${this.nwaves}` }];
    },
  };

  // mức CEFR của một từ trong kho (cho lọc từ đến hạn ôn)
  function BANK_LV(w) { const e = G.BANK.byWord.get(w); return e ? e.lv : -1; }

  function startWave() {
    this.wave++;
    const k = this.wave;
    this.toSpawn = 4 + k;
    this.spawnT = BANNER_T * 0.8;
    this.boss = null; this.bossDone = false; this.waveHit = false;
    this.bombs = 1;
    this.banner = { t: 0, text: `ĐỢT ${k}`, sub: k === 1 ? 'Gõ từ trên thiên thạch để bắn hạ!' : 'Thiên thạch nhanh hơn, từ dài hơn' };
    Sfx.play('go');
  }
  function gapFor(len) {
    return (len + 1) / this.cps * 1.2 / (1 + 0.1 * (this.wave - 1));
  }
  function pickWord() {
    const [a, b] = LEN[Math.min(this.wave - 1, LEN.length - 1)];
    const alive = new Set(this.mets.filter((m) => !m.dead).map((m) => m.word[0]));
    const okLen = (w) => w.length >= a && w.length <= b;
    // 30%: từ đến hạn ôn
    if (this.dueW.length && Math.random() < 0.3) {
      const i = this.dueW.findIndex((w) => !alive.has(w[0]) && (this.isMine() || okLen(w)));
      if (i >= 0) return this.dueW.splice(i, 1)[0];
    }
    const list = this.wordList(14, okLen, true);    // Bộ từ của tôi: giữ nguyên cụm từ (gõ cả dấu cách)
    return list.find((w) => !alive.has(w[0])) || list[0];
  }
  function spawn() {
    const word = pickWord.call(this);
    const x = U.rand(120, 1160), y = TOP + 45;
    const D = U.clamp((word.length + 1) / this.cps * 2.7 / (1 + 0.1 * (this.wave - 1)), 3.2, 15);
    const tx = U.clamp(SHIP.x + U.rand(-120, 120), 80, 1200), ty = SHIP.y - 10;
    const m = { word, typed: 0, x, y, vx: (tx - x) / D, vy: (ty - y) / D, r: 22 + Math.min(18, word.length * 2.2),
      rot: Math.random() * 6, spin: U.rand(-1.2, 1.2), shape: Array.from({ length: 10 }, () => 0.78 + Math.random() * 0.3),
      hit: 0, wrong: false, kb: 0 };
    this.mets.push(m);
    return m;
  }
  function spawnBoss() {
    let s;
    if (this.isMine()) {
      const ws = C.shuffle(this.mineB.all.slice()).slice(0, 5).map((e) => e.w);
      s = { s: ws.join(' '), vi: ws.map((w) => this.viOf(w) || '?').join(' · ') };
    } else {
      const pool = SENTS.filter((x) => !this.usedS.has(x.s));
      s = C.pickSents(pool.length ? pool : SENTS, this.level, 1)[0] || { s: 'Practice makes perfect.', vi: 'Có công mài sắt có ngày nên kim.' };
      this.usedS.add(s.s);
    }
    const D = U.clamp((s.s.length + 1) / this.cps * 2.3 + 3, 9, 70);
    const y0 = TOP + 110, y1 = SHIP.y - 50;
    const m = { word: s.s, vi: s.vi, typed: 0, x: 640, y: y0, vx: 0, vy: (y1 - y0) / D, r: 58, boss: true,
      rot: 0, spin: 0.25, shape: Array.from({ length: 14 }, () => 0.85 + Math.random() * 0.2), hit: 0, wrong: false, kb: 0, born: this.t };
    this.mets.push(m);
    this.boss = m;
    this.target = m;                 // Trùm đứng một mình: phím nào cũng vào Trùm
    this.banner = { t: 0, boss: true, text: '☄️ TRÙM!', sub: 'Gõ hết cả câu (có dấu cách, dấu câu, chữ hoa)' };
    Sfx.play('warn');
  }
  function moveMets(dt) {
    for (const m of this.mets) {
      if (m.dead) continue;
      m.kb = Math.max(0, m.kb - dt * 300);
      m.x += m.vx * dt; m.y += m.vy * dt - m.kb * dt;
      if (m.boss) m.x = 640 + Math.sin((this.t - m.born) * 0.5) * 120;
      m.rot += m.spin * dt;
      m.hit = Math.max(0, m.hit - dt * 5);
      if (!this.over && Math.hypot(m.x - SHIP.x, m.y - SHIP.y) < m.r + 36) hitShip.call(this, m);
    }
  }
  function hitShip(m) {
    m.dead = true;
    if (this.target === m) this.target = null;
    this.lives--; this.combo = 0; this.waveHit = true;
    this.cps = Math.max(1, this.cps * 0.92);
    if (m.boss) { this.bossLog.push({ s: m.word, vi: m.vi, ok: false }); this.boss = null; this.bossDone = true; this.nextT = NEXT_T; }
    else this.missed.push(m.word);
    boom.call(this, SHIP.x, SHIP.y - 20, 120, COL.bad);
    FX.shake(12); Sfx.play('crash');
    if (this.lives <= 0) { this.over = { t: 0, win: false }; Sfx.play('fall'); }
  }
  function bomb() {
    if (this.bombs <= 0 || this.over) { Sfx.tone(140, 0.08, 'square', 0.05); return; }
    this.bombs--;
    this.flash = 1; FX.shake(8); Sfx.play('boom');
    for (const m of this.mets) {
      if (m.dead || m.boss) continue;
      m.dead = true; boom.call(this, m.x, m.y, m.r * 2, '#ffd23f');
      if (this.target === m) this.target = null;
    }
  }
  function boom(x, y, r, c) {
    this.booms.push({ x, y, r, c, t: 0, life: 0.45 });
    this.sparkle(x, y, c, 10);
  }
  /** một phím gõ: khoá mục tiêu nếu chưa có, đúng chữ kế tiếp thì bắn */
  function fire(ch) {
    let m = this.target;
    if (!m) {
      if (ch === ' ') return;
      const cands = this.mets.filter((x) => !x.dead && x.word[0] === ch);
      if (!cands.length) { miss.call(this, null, ch); return; }
      m = cands.sort((a, b) => b.y - a.y)[0];
      this.target = m;
    }
    const want = m.word[m.typed], t = this.ms();
    const kk = want.toLowerCase();
    const ks = this.perKey[kk] || (this.perKey[kk] = { n: 0, err: 0, ms: 0 });
    ks.n++;
    if (ch !== want) { ks.err++; miss.call(this, m, ch); return; }
    if (this.tLast !== null) ks.ms += Math.min(2000, t - this.tLast);
    this.tLast = t;
    this.good++; m.typed++; m.hit = 1; m.kb = m.boss ? 30 : 70;
    this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += 10 * (1 + Math.floor(this.combo / 10));
    this.recoil = 1; this.bump = 1;
    const bx = SHIP.x + Math.cos(this.aim) * 46, by = SHIP.y - 30 + Math.sin(this.aim) * 46;
    this.shots.push({ x0: bx, y0: by, x1: m.x + U.rand(-8, 8), y1: m.y + U.rand(-8, 8), t: 0, life: 0.12 });
    Sfx.tone(ch === ' ' ? 500 : 900 + Math.random() * 120, 0.03, 'square', 0.025);
    if (m.typed >= m.word.length) kill.call(this, m);
  }
  function miss(m, ch) {
    this.bad++; this.combo = 0;
    if (m) { m.wrong = true; m.hit = 0.6; }
    Sfx.tone(130, 0.09, 'sawtooth', 0.05);
  }
  function kill(m) {
    m.dead = true;
    if (this.target === m) this.target = null;
    this.kills++;
    if (m.wrong && !m.boss) this.missed.push(m.word);
    if (m.boss) {
      this.score += 300;
      this.bossLog.push({ s: m.word, vi: m.vi, ok: true });
      this.boss = null; this.bossDone = true; this.nextT = NEXT_T;
      boom.call(this, m.x, m.y, 220, '#ff9be0'); boom.call(this, m.x, m.y, 140, COL.accent);
      FX.shake(10); Sfx.play('crown');
    } else {
      this.score += m.word.length * 5;
      boom.call(this, m.x, m.y, m.r * 2.2, '#ffb86b');
      Sfx.play('boom', 0.05);
    }
  }

  /* ---------- vẽ ---------- */
  function drawRock(ctx, m, t, locked) {
    ctx.save();
    ctx.translate(m.x, m.y);
    // vệt lửa phía sau
    const ang = Math.atan2(m.vy, m.vx), tail = m.r * (m.boss ? 1.6 : 2.2);
    const tg = ctx.createLinearGradient(0, 0, -Math.cos(ang) * tail, -Math.sin(ang) * tail);
    tg.addColorStop(0, m.boss ? 'rgba(255,90,160,0.55)' : 'rgba(255,170,80,0.5)'); tg.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang + 1.6) * m.r * 0.8, Math.sin(ang + 1.6) * m.r * 0.8);
    ctx.lineTo(-Math.cos(ang) * tail, -Math.sin(ang) * tail);
    ctx.lineTo(Math.cos(ang - 1.6) * m.r * 0.8, Math.sin(ang - 1.6) * m.r * 0.8);
    ctx.fill();
    ctx.rotate(m.rot);
    const n = m.shape.length;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, rr = m.r * m.shape[i];
      i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-m.r * 0.3, -m.r * 0.3, m.r * 0.1, 0, 0, m.r);
    if (m.boss) { g.addColorStop(0, '#c070e0'); g.addColorStop(1, '#4a1a6a'); } else { g.addColorStop(0, '#b08a6a'); g.addColorStop(1, '#5a3e2c'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = m.hit > 0 ? `rgba(255,255,255,${m.hit})` : 'rgba(0,0,0,0.35)'; ctx.stroke();
    // miệng núi lửa
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    [[0.3, -0.2, 0.22], [-0.35, 0.25, 0.16], [0.1, 0.45, 0.12]].forEach(([cx, cy, cr]) => { ctx.beginPath(); ctx.arc(cx * m.r, cy * m.r, cr * m.r, 0, 7); ctx.fill(); });
    ctx.restore();
    if (m.boss) {
      // mắt giận dữ của Trùm
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m.x + s * 18, m.y - 6, 10, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a0b2e'; ctx.beginPath(); ctx.arc(m.x + s * 16, m.y - 4, 5, 0, 7); ctx.fill();
        ctx.strokeStyle = '#2a0b2e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(m.x + s * 30, m.y - 22); ctx.lineTo(m.x + s * 8, m.y - 14); ctx.stroke();
      }
    }
    if (locked) {
      ctx.strokeStyle = COL.bad; ctx.lineWidth = 3;
      const rr = m.r + 10 + Math.sin(t * 10) * 2;
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + i * Math.PI / 2;
        ctx.beginPath(); ctx.arc(m.x, m.y, rr, a, a + 0.9); ctx.stroke();
      }
    }
  }
  function drawLabel(ctx, m, locked, t) {
    const size = m.boss ? 26 : 24;
    ctx.font = `${size}px ${MONO}`;
    const cw = ctx.measureText('M').width;
    let lines;
    if (m.boss) lines = wrapChars(m.word, 46);
    else lines = [[0, m.word.length]];
    const wMax = Math.max(...lines.map(([a, b]) => b - a)) * cw;
    const lh = size + 10, bw = wMax + 24, bh = lines.length * lh + 10;
    let x = m.boss ? 640 : m.x, y = m.y + m.r + 12;
    if (m.boss) y = Math.min(y, 590 - bh);
    x = U.clamp(x, bw / 2 + 8, W - bw / 2 - 8);
    if (!m.boss && y + bh > 620) y = m.y - m.r - 12 - bh;
    Draw.rr(ctx, x - bw / 2, y, bw, bh, 10);
    ctx.fillStyle = locked ? 'rgba(40,10,40,0.88)' : 'rgba(10,6,30,0.72)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = m.wrong ? COL.bad : locked ? COL.accent : 'rgba(255,255,255,0.25)'; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    lines.forEach(([a, b], li) => {
      const lx = x - ((b - a) * cw) / 2, ly = y + 5 + lh * li + lh / 2;
      for (let i = a; i < b; i++) {
        const done = i < m.typed;
        ctx.fillStyle = done ? 'rgba(255,210,63,0.45)' : i === m.typed && locked ? COL.accent : '#fff';
        ctx.fillText(m.word[i], lx + (i - a) * cw, ly);
        if (i === m.typed && locked && (t * 2) % 2 < 1.3) { ctx.fillStyle = COL.accent; ctx.fillRect(lx + (i - a) * cw, ly + size * 0.5, cw, 3); }
      }
    });
    ctx.textBaseline = 'alphabetic';
  }
  /** chia câu thành các dòng ≤ n ký tự (cắt ở dấu cách), trả [đầu, cuối) theo chỉ số ký tự */
  function wrapChars(s, n) {
    const out = []; let a = 0;
    while (a < s.length) {
      let b = Math.min(s.length, a + n);
      if (b < s.length) { const sp = s.lastIndexOf(' ', b); if (sp > a) b = sp + 1; }
      out.push([a, b]); a = b;
    }
    return out;
  }
  function drawShip(ctx, g) {
    const x = SHIP.x, y = SHIP.y;
    // nòng súng
    ctx.save();
    ctx.translate(x, y - 30); ctx.rotate(g.aim);
    Draw.rr(ctx, 10 - g.recoil * 8, -9, 44, 18, 6); ctx.fillStyle = '#8fa8ff'; ctx.fill();
    ctx.fillStyle = '#5dffb0'; ctx.fillRect(46 - g.recoil * 8, -6, 8, 12);
    ctx.restore();
    // vòm kính + Tròn
    ctx.fillStyle = '#4b3a8c'; Draw.rr(ctx, x - 64, y - 6, 128, 34, 14); ctx.fill();
    Draw.blob(ctx, { x, y: y - 26 - g.bump * 6, r: 26, color: g.p.color, face: g.aim, squash: g.bump * 0.15, walk: 0 });
    ctx.fillStyle = 'rgba(160,220,255,0.18)'; ctx.beginPath(); ctx.arc(x, y - 6, 48, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,255,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 6, 48, Math.PI, 0); ctx.stroke();
  }

  G.addMode({ id: 'meteor', name: 'Bắn Thiên Thạch', icon: '☄️',
    desc: 'Thiên thạch mang từ tiếng Anh rơi xuống: gõ chữ đầu để khoá mục tiêu, mỗi phím đúng một phát bắn; hết đợt có Trùm mang cả câu. Từ gõ sai được đưa vào Thẻ Từ để ôn.',
    how: 'Gõ từ trên thiên thạch để bắn hạ trước khi nó đâm vào trạm (3 khiên). Gõ chữ đầu là khoá mục tiêu, Backspace bỏ khoá, Enter = bom quét sạch (mỗi đợt 1 lần). Cuối mỗi đợt có Trùm: gõ hết cả câu. Tốc độ rơi tự chỉnh theo tốc độ gõ của bạn.' }, M);
})();

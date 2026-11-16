// Gõ Chữ Tiếng Anh — chế độ 🏎️ Đua Xe Gõ Chữ (ý tưởng Nitro Type / TypeRacer, hình tự vẽ).
// Gõ một đoạn gồm vài câu ví dụ; xe chạy theo từng chữ gõ đúng. Đua với 3 xe máy quanh WPM gần đây của bạn
// và xe "bóng" chạy lại đúng ván kỷ lục của chính bạn. Mỗi ván 1 lần Nitro (Enter) bỏ qua từ đang gõ.
// Nạp SAU typing.js (dùng window.TypingGame).
(() => {
  'use strict';
  const G = window.TypingGame;
  if (!G) return;
  const { C, SENTS, COL, MONO, T, panel, bigStat, fit } = G;

  const LANE_Y0 = 104, LANE_H = 54, X0 = 200, X1 = 1150, SAMPLE = 0.5, MAX_T = 420, END_T = 1.4;
  const RIVALS = [
    { name: 'Rùa Chăm', emo: '🐢', mul: 0.8, color: '#7ee081' },
    { name: 'Cáo Lẹ', emo: '🦊', mul: 0.97, color: '#ffb86b' },
    { name: 'Báo Đốm', emo: '🐆', mul: 1.15, color: '#ffe066' },
  ];
  const SENT_N = 3, MINE_WORDS = 24;

  const R = {
    name: 'Đua Xe Gõ Chữ', ownBlob: true,
    init() { this.nsents = this.api.count(SENT_N); },
    setup() {
      let text;
      if (this.isMine()) {
        this.sents = [];
        text = this.wordList(Math.round(MINE_WORDS * this.nsents / SENT_N)).join(' ');
      } else {
        this.sents = C.pickSents(SENTS, this.level, this.nsents);
        text = this.sents.map((s) => s.s).join(' ');
      }
      this.ses = new C.Session(text.split(' '), { finishOnLast: true });
      this.ses.stamp(this.ms());             // đua: đồng hồ chạy từ lúc xuất phát
      this.chars = text.length;
      const base = C.recentWpm(this.prof.hist, 30);
      this.cars = RIVALS.map((r) => {
        const wpm = Math.max(10, Math.round(base * r.mul * U.rand(0.95, 1.05)));
        const sched = C.paceSchedule(this.chars, wpm);
        return Object.assign({}, r, { wpm, sched, fin: C.paceFinish(sched) });
      });
      const gh = this.prof.ghost;
      this.ghost = gh && gh.prog && gh.prog.length > 2 ? gh : null;
      this.rt = 0; this.prog = [0]; this.sampT = 0;
      this.nitro = 1; this.boostT = 0; this.myFin = null; this.endT = 0; this.unfinished = false;
    },
    key(e) {
      const k = e.key, s = this.ses;
      if (this.myFin !== null) return true;
      if (k === 'Enter') { useNitro.call(this); return true; }
      if (k === 'Backspace') { (e.ctrlKey ? s.backWord() : s.back()); return true; }
      if (k.length !== 1) return false;
      if (/^[\x20-\x7e]$/.test(k)) this.press(k);
      return true;
    },
    update(dt) {
      this.boostT = Math.max(0, this.boostT - dt);
      if (this.myFin === null) {
        this.rt += dt;
        if ((this.sampT += dt) >= SAMPLE) { this.sampT -= SAMPLE; this.prog.push(Math.round(this.ses.progress() * 1000) / 1000); }
        if (this.ses.finished) {
          this.myFin = this.rt; this.endT = END_T;
          this.prog.push(1);
          const place = 1 + this.cars.filter((c) => c.fin < this.myFin).length;
          Sfx.play(place === 1 ? 'crown' : 'goal');
          this.sparkle(X1, LANE_Y0 + LANE_H / 2, COL.accent, 24);
        } else if (this.rt > MAX_T) { this.myFin = this.rt; this.unfinished = true; this.endT = 0.3; }
      } else if ((this.endT -= dt) <= 0) this.endRun();
    },
    bot(dt) {
      this.botT = (this.botT || 0) + dt;
      const gap = 60 / (42 * 5);
      while (this.botT > gap) { this.botT -= gap; if (this.myFin !== null || !this.botType()) return; }
    },
    draw(ctx) {
      const lanes = [{ me: true }].concat(this.cars).concat(this.ghost ? [{ ghost: true }] : []);
      // đường đua
      Draw.rr(ctx, 20, LANE_Y0 - 8, 1240, lanes.length * LANE_H + 16, 16);
      ctx.fillStyle = '#2b2440'; ctx.fill();
      lanes.forEach((L, i) => {
        const y = LANE_Y0 + i * LANE_H;
        if (i) { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([18, 14]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X0 - 20, y); ctx.lineTo(1250, y); ctx.stroke(); ctx.setLineDash([]); }
        if (L.me) { ctx.fillStyle = 'rgba(255,210,63,0.08)'; ctx.fillRect(24, y + 2, 1232, LANE_H - 4); }
        const name = L.me ? `${this.name} (bạn)` : L.ghost ? 'Kỷ lục' : L.name, emo = L.me ? '⭐' : L.ghost ? '👻' : L.emo;
        T(ctx, `${emo} ${fit(ctx, name, 120, 18)}`, 34, y + LANE_H / 2, { size: 18, color: L.me ? COL.accent : '#fff', align: 'left' });
      });
      // vạch xuất phát / đích
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(X0 - 4, LANE_Y0 - 4, 4, lanes.length * LANE_H + 8);
      for (let r = 0; r < lanes.length * 6; r++) for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#fff' : '#222';
        ctx.fillRect(X1 + 34 + c * 9, LANE_Y0 - 4 + r * 9, 9, 9);
      }
      // xe
      lanes.forEach((L, i) => {
        const y = LANE_Y0 + i * LANE_H + LANE_H / 2;
        let p, label, color;
        if (L.me) { p = this.myFin !== null && !this.unfinished ? 1 : this.ses.progress(); label = `${Math.round(this.ses.wpm(this.ms()))}`; color = this.p.color.main; }
        else if (L.ghost) { p = ghostAt(this.ghost, this.rt); label = `${this.ghost.wpm}`; color = '#c4b5ff'; }
        else { p = C.paceAt(L.sched, this.rt) / this.chars; label = `${L.wpm}`; color = L.color; }
        const x = X0 + p * (X1 - X0);
        drawCar(ctx, x, y, color, L, this, i);
        T(ctx, `${label} WPM`, Math.min(x + 54, 1240), y - 16, { size: 13, color: COL.sub, align: 'left' });
        if (!L.me && !L.ghost && L.fin <= this.rt) T(ctx, '🏁', x + 52, y + 6, { size: 18 });
      });
      // số liệu
      const s = this.ses, tm = this.ms();
      const yS = LANE_Y0 + lanes.length * LANE_H + 40;
      T(ctx, `⏱ ${this.rt.toFixed(1)} giây`, 140, yS, { size: 24, color: '#fff', align: 'left' });
      T(ctx, `${Math.round(s.wpm(tm))} WPM · ${Math.round(s.acc() * 100)}%`, 640, yS, { size: 26, color: COL.accent });
      T(ctx, this.nitro ? '🔥 Nitro: Enter (bỏ qua 1 từ)' : '🔥 Nitro đã dùng', 1140, yS, { size: 22, color: this.nitro ? COL.mint : COL.sub, align: 'right' });
      // đoạn văn
      const py = yS + 30;
      panel(ctx, 100, py, 1080, 642 - py);
      this.drawWords(ctx, s, 136, py + 50, 1010, 54, Math.max(2, Math.floor((642 - py - 30) / 54)), 34);
      if (this.myFin !== null) T(ctx, this.unfinished ? 'Hết giờ!' : `🏁 Về đích sau ${this.myFin.toFixed(1)} giây!`, 640, 680, { size: 28, color: COL.accent });
      else T(ctx, 'Gõ đoạn văn · Space sang từ sau · Backspace sửa · chữ hoa, dấu câu cũng phải gõ đúng', 640, 690, { size: 18, color: COL.sub });
    },
    end() {
      const prof = this.prof, s = this.ses, tm = this.ms();
      const wpm = Math.round(s.wpm(tm)), acc = Math.round(s.acc() * 100);
      C.mergeKeys(prof, s.perKey);
      const wrong = s.wrongList();
      this.markWrong(wrong);
      const place = this.unfinished ? 1 + this.cars.length : 1 + this.cars.filter((c) => c.fin < this.myFin).length;
      const best = prof.best.race || 0, record = !this.unfinished && wpm > best && s.keys > 10;
      if (record) { prof.best.race = wpm; prof.ghost = { wpm, prog: this.prog }; }
      prof.hist.push({ d: this.day, m: 'race', wpm, acc, place });
      const stand = [{ name: 'Bạn', emo: '⭐', t: this.unfinished ? Infinity : this.myFin, me: true }]
        .concat(this.cars.map((c) => ({ name: c.name, emo: c.emo, t: c.fin, wpm: c.wpm }))).sort((a, b) => a.t - b.t);
      this.result = { place, of: 1 + this.cars.length, wpm, acc, best, record, wrong, stand, time: this.myFin, nitro: !this.nitro };
    },
    drawSum(ctx) {
      const r = this.result;
      panel(ctx, 140, 84, 1000, 568);
      const medal = ['🥇', '🥈', '🥉', '4️⃣'][r.place - 1] || '';
      T(ctx, this.unfinished ? 'Chưa về đích' : `${medal} Về thứ ${r.place}/${r.of}${r.place === 1 ? ' — vô địch!' : ''}`, 640, 128, { size: 42, color: r.place === 1 ? COL.accent : '#fff' });
      bigStat(ctx, 420, 196, `${r.wpm}`, 'WPM', COL.accent, 58);
      bigStat(ctx, 640, 196, `${r.acc}%`, 'chính xác', COL.mint, 58);
      bigStat(ctx, 860, 196, this.unfinished ? '—' : `${r.time.toFixed(1)}s`, 'thời gian', '#fff', 58);
      T(ctx, r.record ? `🏆 Kỷ lục mới! (trước: ${r.best} WPM) — xe 👻 sẽ chạy lại ván này` : r.best ? `Kỷ lục Đua Xe: ${r.best} WPM` : '',
        640, 250, { size: 21, color: r.record ? COL.accent : COL.sub });
      // bảng về đích
      const parts = r.stand.map((e, i) => `${['🥇', '🥈', '🥉', '4.'][i]} ${e.emo} ${e.name} ${isFinite(e.t) ? e.t.toFixed(1) + 's' : '—'}`);
      T(ctx, parts.join('    '), 640, 284, { size: 19, color: '#fff' });
      // câu đã gõ + bản dịch (lúc này mới hiện nghĩa)
      let y = 322;
      this.sents.slice(0, 3).forEach((st) => {
        T(ctx, fit(ctx, st.s, 900, 19, MONO), 190, y, { size: 19, color: COL.good, align: 'left', font: MONO });
        T(ctx, fit(ctx, '→ ' + st.vi, 900, 17), 190, y + 21, { size: 17, color: COL.sub, align: 'left' });
        y += 50;
      });
      this.drawWrong(ctx, r.wrong, y + 8, 4, 190);
    },
    results() {
      const r = this.result || {};
      return [{ score: r.wpm || 0, text: `Về thứ ${r.place || '?'}/${r.of || 4} · ${r.wpm || 0} WPM` }];
    },
  };

  function useNitro() {
    if (!this.nitro || this.ses.finished) { Sfx.tone(140, 0.08, 'square', 0.05); return; }
    this.nitro = 0; this.boostT = 1.2;
    this.ses.skipWord(this.ms());
    Sfx.play('dash'); FX.shake(4);
  }
  /** xe bóng: tỉ lệ quãng đường ở thời điểm t theo bản ghi mỗi SAMPLE giây */
  function ghostAt(g, t) {
    const k = t / SAMPLE, i = Math.floor(k), p = g.prog;
    if (i >= p.length - 1) return p[p.length - 1];
    return p[i] + (p[i + 1] - p[i]) * (k - i);
  }
  function drawCar(ctx, x, y, color, L, g) {
    ctx.save();
    if (L.ghost) ctx.globalAlpha = 0.5;
    // lửa Nitro
    if (L.me && g.boostT > 0) {
      const f = 0.6 + Math.random() * 0.4;
      ctx.fillStyle = `rgba(255,140,40,${g.boostT})`;
      ctx.beginPath(); ctx.moveTo(x - 36, y - 7); ctx.lineTo(x - 36 - 46 * f, y); ctx.lineTo(x - 36, y + 7); ctx.fill();
    }
    // thân xe
    Draw.rr(ctx, x - 36, y - 6, 72, 18, 8); ctx.fillStyle = color; ctx.fill();
    Draw.rr(ctx, x - 16, y - 16, 34, 14, 7); ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; Draw.rr(ctx, x - 36, y + 6, 72, 6, 3); ctx.fill();
    ctx.fillStyle = '#1b1530';
    for (const wx of [-22, 22]) { ctx.beginPath(); ctx.arc(x + wx, y + 12, 7, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ddd';
    for (const wx of [-22, 22]) { ctx.beginPath(); ctx.arc(x + wx, y + 12, 3, 0, 7); ctx.fill(); }
    ctx.restore();
    // tài xế
    if (L.me) Draw.blob(ctx, { x: x + 1, y: y - 16 - g.bump * 4, r: 11, color: g.p.color, face: 0, squash: g.bump * 0.2, walk: 0 });
    else T(ctx, L.ghost ? '👻' : L.emo, x + 1, y - 17, { size: 18 });
  }

  G.addMode({ id: 'race', name: 'Đua Xe Gõ Chữ', icon: '🏎️',
    desc: 'Gõ một đoạn câu ví dụ, xe chạy theo từng chữ đúng. Đua với 3 xe máy quanh tốc độ gần đây của bạn và xe bóng 👻 của ván kỷ lục. Hết ván xem bản dịch các câu.',
    how: 'Gõ đoạn văn (có chữ hoa, dấu câu) — xe chạy theo số chữ gõ đúng. 3 xe máy chạy quanh tốc độ gần đây của bạn; xe 👻 chạy lại ván kỷ lục. Enter = Nitro bỏ qua từ đang gõ (1 lần mỗi ván). Backspace để sửa.' }, R);
})();

// ローグライクの難易度を、シミュレーションの統計から割り出す。
//   node tools/balance.js calibrate   … 表を調整して hitohude-hero/hitohude-hero/balance.js を書き出し、レポートも作る
//   node tools/balance.js report      … 今の balance.js のままレポートだけ作り直す(docs/balance_report.md / .csv)
//   node tools/balance.js expect      … 平均的な勇者の強さ(expect)だけ測り直す
//
// 目標(「ちょうどよく倒せる」の定義)。ふつうの人(casual)の遊び方に合わせる:
//   1. ふつうの敵: 階段が出るまで1ターンに1.2体(第1章)→0.9体(第10章)倒せる(線の長さに上限がなく、連撃で何体も倒せる前提)
//   2. ボス: ふつうの一筆で約4回(中央値)。ルールでも1ターンに最大HPの4割までしか削れない(rules.js の bossCap)
//   3. 被ダメージ: 1階あたり最大HPの15%(第1章)→35%(第10章)。ただし1階で死ぬ率は1.5%まで
//   4. 章の中はノコギリ型(ボス直後はやさしめ、ボス手前はきつめ)
// 表は章ごとに [1階目, 9階目] の2つの値で、間は直線でつなぐ(rules.js の table)。章ごとの敵の顔ぶれの違いも吸収する。
'use strict';
const fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ROOT = path.resolve(__dirname, '..');
const RULES = path.join(ROOT, 'hitohude-hero/hitohude-hero/rules.js');
const OUT_JS = path.join(ROOT, 'hitohude-hero/hitohude-hero/balance.js');
const DOCS = path.join(ROOT, 'docs');

// 章の中はノコギリ型: ボスを倒した直後(1階目)はやさしめ、ボスの手前(9階目)はきつめ。end = 0(1階目) / 1(9階目)
const TARGET = { kpt: (c, end) => (1.2 - 0.3 * c / 9) * (end ? 0.9 : 1.1), bossStrokes: 4, oneShotQ: 0.995, oneShotK: 1.2, death: 0.015,
  taken: (c, end) => (0.15 + 0.20 * c / 9) * (end ? 1.2 : 0.8) };

if (!isMainThread) { // ---- 作業用スレッド: 渡された表で何回か遊ばせる ----
  const R = require('./rogue_sim');
  const H = R.load(RULES, workerData.bal), M = R.makeSim(H);
  const out = [];
  for (const seed of workerData.seeds) out.push(M.playRun(seed, workerData.bot, workerData.maxFloor));
  parentPort.postMessage(out);
  return;
}

const NW = Math.max(2, require('os').cpus().length - 1);
function runMany(bal, bot, n, seed0, maxFloor = 100) {
  const chunks = [...Array(NW)].map(() => []);
  for (let i = 0; i < n; i++) chunks[i % NW].push(seed0 + i);
  return Promise.all(chunks.filter(c => c.length).map(seeds => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { bal, bot, seeds, maxFloor } });
    w.on('message', res); w.on('error', rej);
  }))).then(a => a.flat());
}

// ---- 統計の道具 ----
function wquantile(samples, q) { // samples: [value, weight]
  if (!samples.length) return NaN;
  const s = samples.slice().sort((a, b) => a[0] - b[0]);
  const tot = s.reduce((a, x) => a + x[1], 0); let acc = 0;
  for (const [v, w] of s) { acc += w; if (acc >= q * tot) return v; }
  return s[s.length - 1][0];
}
const quantile = (a, q) => wquantile(a.map(v => [v, 1]), q);
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
// floor f が表のどの値に効くか。表は章ごとの [1階目, 9階目] で、i 番目の値は 章 floor(i/2) の 始め(偶数)/終わり(奇数)
function anchorsOf(f) {
  const c = chapterOf(f), t = Math.min(8, (f - 1) % 10) / 8;
  return t ? [[2 * c, 1 - t], [2 * c + 1, t]] : [[2 * c, 1]];
}
const flat = arr => arr.flat();
const pairs = a => [...Array(10)].map((_, c) => [a[2 * c], a[2 * c + 1]]);
function table(arr, f) { const [a, b] = arr[chapterOf(f)], i = Math.min(8, (f - 1) % 10); return a + (b - a) * i / 8; }
const chapterOf = f => Math.floor((f - 1) / 10);

function measure(runs, bal) {
  const A = [...Array(20)].map(() => ({ kill: [], taken: [], qk: 0, qt: 0, tries: 0, died: 0 }));
  const boss = [...Array(10)].map(() => ({ dmg: [], strokes: [], hp: [], tries: 0 }));
  for (const g of runs) for (const F of g.floors) {
    if (F.f > 100) continue;
    if (F.boss) {
      const c = chapterOf(F.f), b = boss[c];
      for (const d of F.bossDmg) if (d > 0) b.dmg.push(d);
      if (F.cleared) b.strokes.push(F.bossStrokes);
      b.hp.push(F.bossHp); if (!F.died) b.tries++;
      continue;
    }
    for (const [i, w] of anchorsOf(F.f)) {
      for (const c of F.contacts) if (!c.boss) A[i].kill.push([c.kill ? 1 : 0, w]);
      if (F.qTurns) { A[i].qk += F.qKills * w; A[i].qt += F.qTurns * w; }
      A[i].taken.push([F.taken / F.maxhp, w]); A[i].tries += w; if (F.died) A[i].died += w;
    }
  }
  const wmean = s => { let a = 0, b = 0; for (const [v, w] of s) { a += v * w; b += w; } return b ? a / b : NaN; };
  return {
    anchors: A.map(a => ({ n: a.kill.length, kpt: a.qk / a.qt, kill: wmean(a.kill), taken: wmean(a.taken), death: a.died / Math.max(1e-9, a.tries) })),
    boss: boss.map(b => ({ tries: b.tries, n: b.strokes.length, med: quantile(b.dmg, 0.5), p98: quantile(b.dmg, TARGET.oneShotQ), strokes: quantile(b.strokes, 0.5), hp: mean(b.hp) })),
  };
}

const r2 = x => Math.round(x * 100) / 100;
// 平均的な勇者の強さ(章ごとの [1階目, 9階目] に来たときの {剣}・最大HP の中央値)。rules.js の adaptFor がこれを基準に敵を強くする
function expectFrom(runs, prev) {
  const ex = { atk: [], hp: [] };
  for (let c = 0; c < 10; c++) {
    const pa = [], ph = [];
    for (const f of [10 * c + 1, 10 * c + 9]) {
      const F = runs.flatMap(g => g.floors.filter(F => F.f === f && !F.deaths));
      const a = quantile(F.map(F => F.atk), 0.5), h = quantile(F.map(F => F.maxhp), 0.5);
      pa.push(isFinite(a) ? a : prev ? table(prev.atk, f) : 2); ph.push(isFinite(h) ? h : prev ? table(prev.hp, f) : 20);
    }
    ex.atk.push(pa); ex.hp.push(ph);
  }
  return ex;
}

async function calibrate() {
  let bal = fs.existsSync(OUT_JS) ? loadBal() : null;
  if (!bal) { const H = require('./rogue_sim').load(RULES); bal = JSON.parse(JSON.stringify(H.BAL)); }
  const iters = +process.argv[3] || 14, N = +process.argv[4] || 56;
  for (let it = 1; it <= iters; it++) {
    const d0 = +process.argv[5] || 0.7, damp = it <= 4 ? d0 : it <= 9 ? Math.min(d0, 0.5) : 0.3;
    const runs = await runMany(bal, 'casual', N, 1000 * it);
    const m = measure(runs, bal);
    const hp = flat(bal.hp), atk = flat(bal.atk), bm = bal.boss.slice();
    for (let i = 0; i < 20; i++) {
      const a = m.anchors[i]; if (a.n < 20) continue;
      const ch = Math.floor(i / 2);
      // 階段が出るまでに1ターンで倒せた数が目標より多ければ敵のHPを上げ、少なければ下げる
      if (isFinite(a.kpt)) hp[i] *= Math.pow(Math.min(1.5, Math.max(0.7, a.kpt / TARGET.kpt(ch, i % 2))), damp);
      // 1階の被ダメージが目標より少なければ敵の攻撃を上げ、多ければ下げる
      // ただし1階で死ぬ率が目標(1.5%)を超えたら、そちらを優先して下げる(一発の重さで死なせない)
      const byTaken = TARGET.taken(ch, i % 2) / Math.max(0.03, a.taken), byDeath = a.death > TARGET.death ? Math.sqrt(TARGET.death / a.death) : 1.4;
      atk[i] *= Math.pow(Math.min(1.4, Math.max(0.7, Math.min(byTaken, byDeath))), damp);
    }
    hp[0] = 1; atk[0] = 1; // 地下1階は導入。最初のスライムは HP3・攻撃1 のまま
    for (let i = 2; i < 20; i += 2) atk[i] = Math.min(atk[i], atk[i - 1] * 1.35); // 章が変わっても、敵の一撃が急に重くならないように
    for (let i = 1; i < 20; i += 2) { hp[i] = Math.max(hp[i], hp[i - 1]); atk[i] = Math.max(atk[i], atk[i - 1] * 0.5); } // 章の中でHPは下がらない(攻撃は敵の数が増える分だけ下げてよい)
    const hpP = pairs(hp);
    for (let c = 0; c < 10; c++) {
      const b = m.boss[c], f = 10 * (c + 1), cur = bm[c] * 16 * table(bal.hp, f);
      if (b.tries && b.n < b.tries * 0.5) { bm[c] = cur * 0.7 / (16 * table(pairs(hp), f)); continue; } // 半分以上の冒険で倒せなかった → 弱める
      if (!b.n || !isFinite(b.med)) continue;
      // 一筆で倒すのに要った回数(中央値)を目標の4回へ。ただし強い一筆(上位2%)の1.15倍は下回らない
      const byStrokes = isFinite(b.strokes) && b.strokes > 0 ? cur * Math.pow(TARGET.bossStrokes / b.strokes, 0.8) : cur;
      const target = Math.max(byStrokes, TARGET.oneShotK * b.p98);
      bm[c] = Math.exp(Math.log(cur) * (1 - damp) + Math.log(target) * damp) / (16 * table(hpP, f));
    }
    bal = { hp: pairs(hp.map(r2)), atk: pairs(atk.map(r2)), boss: bm.map(x => r2(Math.max(0.3, x))), expect: expectFrom(runs, bal.expect) };
    const deaths = runs.reduce((a, g) => a + g.floors.filter(F => F.died).length, 0), won = runs.filter(g => g.won).length;
    console.log('iter', it, 'kills/turn', m.anchors.map(a => isFinite(a.kpt) ? a.kpt.toFixed(2) : '-').join(' '));
    console.log('       taken', m.anchors.map(a => isFinite(a.taken) ? a.taken.toFixed(2) : '-').join(' '), ' bossStrokes', m.boss.map(b => b.strokes).join(','), ' deaths', deaths, 'won', won + '/' + runs.length);
    console.log('       hp', JSON.stringify(bal.hp), '\n       atk', JSON.stringify(bal.atk), '\n       boss', bal.boss.join(','));
  }
  writeBal(bal);
  console.log('wrote', OUT_JS);
  await report(bal, 120);
}

function loadBal() {
  const src = fs.readFileSync(OUT_JS, 'utf8'), w = {};
  new Function('window', src)(w);
  return w.BALANCE;
}

// ---- レポート ----
async function report(bal, n) {
  bal = bal || loadBal();
  const N = n || +process.argv[3] || 120, bots = ['skilled', 'casual', 'beginner'], res = {};
  for (const b of bots) res[b] = await runMany(bal, b, N, 90000);
  const pct = x => isFinite(x) ? Math.round(x * 100) + '%' : '-', f1 = x => isFinite(x) ? x.toFixed(1) : '-';
  const chap = (runs, c) => {
    const fl = runs.flatMap(g => g.floors.filter(F => chapterOf(F.f) === c && F.f <= 100));
    const normal = fl.filter(F => !F.boss), contacts = normal.flatMap(F => F.contacts.filter(x => !x.boss));
    const bossF = fl.filter(F => F.boss && F.cleared), bdmg = fl.filter(F => F.boss).flatMap(F => F.bossDmg.filter(d => d > 0));
    const bossHp = mean(fl.filter(F => F.boss).map(F => F.bossHp));
    const tries = fl.length, died = fl.filter(F => F.died).length;
    // 一度も死なずにこの章の終わりまで来られた冒険の割合
    const clean = runs.filter(g => !g.floors.some(F => F.died && F.f <= 10 * (c + 1)) && g.floors.some(F => F.f === 10 * (c + 1) && F.cleared)).length / runs.length;
    return {
      kill: mean(contacts.map(x => x.kill ? 1 : 0)), pool: quantile(contacts.map(x => x.pool), 0.5), ehp: mean(contacts.map(x => x.hp)),
      turns: mean(normal.filter(F => F.cleared).map(F => F.turns)), taken: mean(normal.map(F => F.taken / F.maxhp)),
      deathRate: died / Math.max(1, tries), bossStrokes: quantile(bossF.map(F => F.bossStrokes), 0.5),
      bossLo: quantile(bossF.map(F => F.bossStrokes), 0.1), bossHi: quantile(bossF.map(F => F.bossStrokes), 0.9),
      oneShot: bossF.length ? bossF.filter(F => F.bossStrokes <= 1).length / bossF.length : NaN, bossHp, bmax: bdmg.length ? Math.max(...bdmg) : NaN,
      // 連撃: 敵を倒せたターンのうち、2体以上まとめて倒せた割合と、1ターンの最大
      combo2: (() => { const k = normal.flatMap(F => F.turnKills || []).filter(n => n > 0); return k.length ? k.filter(n => n >= 2).length / k.length : NaN; })(),
      comboMax: quantile(normal.map(F => Math.max(0, ...(F.turnKills || [0]))), 0.5),
      rests: mean(normal.map(F => (F.rests || 0) / Math.max(1, F.turns))),
      adapt: quantile(normal.map(F => F.adapt || 1), 0.5), adaptHi: quantile(normal.map(F => F.adapt || 1), 0.9), heat: mean(normal.map(F => F.heat || 0)),
      lv: mean(fl.filter(F => F.f === 10 * c + 1).map(F => F.lv)), atk: mean(fl.filter(F => F.f === 10 * c + 1).map(F => F.atk)), clean,
    };
  };
  const H = require('./rogue_sim').load(RULES, bal);
  let md = '# 難易度の統計レポート（ローグライク）\n\n自動生成（`node tools/balance.js report`）。作成日: ' + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) + '（日本時間）\n\n' +
    '冒険を3種類の遊び方で、各 ' + N + ' 回ずつ地下100階まで自動で遊ばせた結果です。死んだら「この階をやり直す」で続けて、死んだ回数を数えています（広告での復活は使わない前提）。\n\n' +
    '- **上手**: よく探して、いつも一番よい線を選ぶ\n- **ふつう**: よさそうな線を選ぶが、ときどき2番手・3番手を選ぶ（60% / 25% / 15%）\n- **初心者**: あまり探さず迷いやすい（45% / 30% / 25%）。祝福もでたらめに選ぶ\n\n' +
    '## 目標（「ちょうどよく倒せる」の定義）\n\n調整は「ふつう」の遊び方に合わせています。\n\n' +
    '1. **ふつうの敵**: 階段が出るまで、1ターンに **1.2体（第1章）→0.9体（第10章）** 倒せる。1階で5〜7体倒すので、階段まで5〜7ターン。うまく連撃をつなげば一気に進み、下手につなぐと剣が足りない\n' +
    '2. **ボス**: ふつうの一筆で **約4回**。さらにルールとして、ボスは **1ターンに最大HPの4割まで** しか削れない（どんなにうまい連撃でも最低3ターン）\n' +
    '3. **被ダメージ**: 1階で最大HPの **15%（第1章）→35%（第10章）**。深くなるほど守りが要る。ただし **1階で死ぬ率は1.5%まで**（超えたら敵の攻撃を下げる）。章が変わっても敵の一撃は1.35倍までしか重くしない\n' +
    '4. **章の中の波**: ボスを倒した直後はやさしめ（倒せる数×1.1・被ダメージ×0.8）、ボスの手前はきつめ（×0.9・×1.2）\n\n' +
    '最初は被ダメージ40%→65%で試しましたが、1階で死ぬ率が30%を超えて厳しすぎたため、上の値に下げています。\n\n' +
    '### 今のルール\n\n- 線は何マスでもなぞれる（以前は8マスまで。そのころの目標は1ターンに0.85体→0.6体）\n' +
    '- **連撃**: 1本の線で倒すたびに剣の威力が ×1.25、×1.5…（最大×3）\n' +
    '- **地形**: 地下2階から岩が3〜7個。岩と岩のななめのすき間も通れない。バクダンの爆発で壊せる。どの1マスがふさがれても残りがつながる形だけを使う（敵が居座って先へ進めなくなる袋小路を作らない）\n' +
    '- **階段が出たあと**: なぞったマスには何もないマスが補充される（倒した敵のマスにはアイテムが落ちる）。居残って稼げないように\n' +
    '- **勇者の強さに合わせた敵**: 平均的な勇者（この自動プレイの中央値＝balance.js の expect）より {剣} が強ければ敵のHPを、最大HPが多ければ敵の攻撃を上げる（比の0.85乗・0.7乗）。さらに、目安より速く・あまり傷つかずに階を突破するたびに「手ごたえ」が上がり（最大で敵のHP×2・攻撃×1.5）、手間取ったりやられたりすると下がる。表の「敵の強さ補正」はその倍率\n' +
    '- **力をためる**: 勇者を2回タップすると1ターン使って次の線の{剣}が増える（となりの岩も砕ける）。鎧の敵とゴーストは盤面に2体まで\n' +
    '- ノルマは1階で5〜7体（以前は3〜5体）\n' +
    '- ボスは1ターンに最大HPの4割までしか削れない（連撃の勢いで一発で倒せてしまうことがあったため）\n\n' +
    '被ダメージの目標（15%→35%）より「1階で死ぬ率1.5%まで」を優先しています。線が長くなって敵の数も増えたぶん、平均の被ダメージが目標どおりでも、まとめて攻撃を受けて死ぬことが増えたためです。\n\n' +
    '「連撃率」は、敵を倒せたターンのうち2体以上まとめて倒せた割合です。\n\n';
  for (const b of bots) {
    const name = { skilled: '上手', casual: 'ふつう', beginner: '初心者' }[b], runs = res[b];
    const won = runs.filter(g => g.won).length, deaths = runs.map(g => g.floors.filter(F => F.died).length);
    md += '## ' + name + '\n\n地下100階の魔竜まで倒せた割合: **' + pct(won / runs.length) + '**（やり直し込み） / 1回の冒険で死んだ回数: 中央値 ' + quantile(deaths, 0.5) + '回\n\n' +
      '| 章 | 章の始めのLv / {剣} | 一撃で倒せた率 | ぶつかるときの{剣}(中央値) / 敵のHP(平均) | 1階のターン数 | 1階の被ダメージ | 1階で死ぬ率 | 一度も死なずにここまで | 連撃率 / 1階の最大連撃 | 力をためたターン | ボス: 回数(中央値・10〜90%) | ボスHP / 最大の一筆 | 敵の強さ補正(中央値・上位10%) / 手ごたえ(平均) |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
    for (let c = 0; c < 10; c++) {
      const s = chap(runs, c);
      md += '| ' + (c + 1) + ' ' + H.CHAPTERS[c].name + ' | ' + f1(s.lv) + ' / ' + f1(s.atk) + ' | ' + pct(s.kill) + ' | ' + f1(s.pool) + ' / ' + f1(s.ehp) + ' | ' + f1(s.turns) + ' | ' + pct(s.taken) + ' | ' + pct(s.deathRate) + ' | ' + pct(s.clean) + ' | ' + pct(s.combo2) + ' / ' + s.comboMax + ' | ' + pct(s.rests) +
        ' | ' + s.bossStrokes + '回（' + s.bossLo + '〜' + s.bossHi + '） | ' + Math.round(s.bossHp) + ' / ' + s.bmax + ' | ×' + s.adapt.toFixed(2) + '（×' + s.adaptHi.toFixed(2) + '） / +' + Math.round(s.heat * 100) + '% |\n';
    }
    md += '\n';
  }
  const pr = a => a[0] + ' → ' + a[1];
  md += '## 敵の強さの表（balance.js）\n\n各章の1階目→9階目の倍率（間は直線でつなぐ）。敵の基本の数値（rules.js の ETYPES）にこの倍率をかけます。\n\n' +
    '| 章 | ' + H.CHAPTERS.map((c, i) => (i + 1)).join(' | ') + ' |\n|---|' + '---|'.repeat(10) + '\n' +
    '| HP倍率 | ' + bal.hp.map(pr).join(' | ') + ' |\n| 攻撃倍率 | ' + bal.atk.map(pr).join(' | ') + ' |\n' +
    '| ボス | ' + H.CHAPTERS.map(c => H.ENAME[c.boss]).join(' | ') + ' |\n| ボスHP倍率 | ' + bal.boss.join(' | ') + ' |\n' +
    '| ボスのHP | ' + H.CHAPTERS.map((c, i) => Math.round(16 * bal.hp[i][1] * bal.boss[i])).join(' | ') + ' |\n\n' +
    '地下100階より先（深淵）は、HPと攻撃が1階ごとに3%ずつ伸びます。\n';
  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(path.join(DOCS, 'balance_report.md'), md);
  const csv = ['bot,chapter,start_lv,start_sword,first_hit_kill_rate,median_sword_at_contact,mean_enemy_hp,turns_per_floor,damage_taken_per_floor,death_rate_per_floor,no_death_until_here,multi_kill_rate,max_kills_in_one_turn,charge_turn_rate,boss_strokes_median,boss_strokes_p10,boss_strokes_p90,boss_hp,max_single_stroke_on_boss,enemy_strength_adapt_median,enemy_strength_adapt_p90,heat_mean'];
  for (const b of bots) for (let c = 0; c < 10; c++) {
    const s = chap(res[b], c);
    csv.push([b, c + 1, f1(s.lv), f1(s.atk), s.kill.toFixed(3), s.pool, f1(s.ehp), f1(s.turns), s.taken.toFixed(3), s.deathRate.toFixed(3), s.clean.toFixed(3), s.combo2.toFixed(3), s.comboMax, s.rests.toFixed(3), s.bossStrokes, s.bossLo, s.bossHi, Math.round(s.bossHp), s.bmax, s.adapt.toFixed(3), s.adaptHi.toFixed(3), s.heat.toFixed(3)].join(','));
  }
  fs.writeFileSync(path.join(DOCS, 'balance_report.csv'), '﻿' + csv.join('\n') + '\n');
  console.log('wrote', path.join(DOCS, 'balance_report.md'));
  for (const b of bots) console.log(b, [...Array(10)].map((_, c) => { const s = chap(res[b], c); return pct(s.kill) + '/' + pct(s.taken) + '/' + pct(s.deathRate) + '/' + s.bossStrokes + '/c' + pct(s.combo2); }).join('  '));
}

// 平均的な勇者の強さ(expect)だけを測り直して balance.js に書く
async function expectOnly() {
  const bal = loadBal(), runs = await runMany(bal, 'casual', +process.argv[3] || 56, 777);
  bal.expect = expectFrom(runs, bal.expect); writeBal(bal); console.log(JSON.stringify(bal.expect));
}
function writeBal(bal) {
  fs.writeFileSync(OUT_JS, '// tools/balance.js が、自動で遊ばせた結果の統計から割り出した敵の強さの表(手で直さず、再計算すること)\n' +
    '// hp/atk: 章ごとの [1階目, 9階目] の倍率(間は直線でつなぐ) / boss: 各章のボスのHP倍率(ボスの基本HP16 × 9階目のHP倍率 × これ)\n' +
    '// expect: 平均的な勇者がその階に来たときの {剣}・最大HP。これより強い勇者には敵も強くなる(rules.js の adaptFor)\n' +
    'window.BALANCE = ' + JSON.stringify(bal) + ';\n');
}
({ report, expect: expectOnly }[process.argv[2]] || calibrate)().catch(e => { console.error(e); process.exit(1); });

// ===== ひとふで勇者: 画面・演出・音・ネイティブ連携 =====
// ルールは rules.js(window.HH)。ここは「見せ方」と「画面の流れ」だけを持つ。
'use strict';
const { GW, GH, LAST_FLOOR, P, CARDS, LESSONS } = HH;
const eachCell = HH.eachCell;
const $ = id => document.getElementById(id);
const cv = $('cv');
let ctx = cv.getContext('2d'); // アイコン生成のときだけ一時的に差し替える

// 章(10階)ごとの景色。並びは rules.js の CHAPTERS と同じ。最後は深淵(101階〜)。
const THEMES = [
  { bg: '#0d1c1a', cell: '#17302c' }, // 苔の洞窟
  { bg: '#141226', cell: '#221f3d' }, // コウモリの巣
  { bg: '#1a1724', cell: '#2a2538' }, // 骨の回廊
  { bg: '#1f1710', cell: '#33261a' }, // 火薬の坑道
  { bg: '#0f1d12', cell: '#1b3320' }, // 甲虫の森
  { bg: '#121522', cell: '#1f2438' }, // 幽霊屋敷
  { bg: '#1b1a16', cell: '#2e2c25' }, // 岩の神殿
  { bg: '#1d0f1f', cell: '#321a35' }, // 呪いの祭壇
  { bg: '#221010', cell: '#3a1b18' }, // 灼熱の底
  { bg: '#1e140c', cell: '#352314' }, // 竜の巣
  { bg: '#08080f', cell: '#151528' }, // 深淵
];
const LESSON_THEME = { bg: '#10202a', cell: '#1a3340' };
function floorHint(f) {
  if (f === 1) return '勇者から指でなぞろう。剣を集めて、敵にぶつかれ！';
  if (HH.isBossFloor(f)) return 'ボスは一度で倒せなくていい。ぶつかって少しずつ削ろう';
  return HH.chapterInfo(f).hint;
}
const floorLabel = f => (f > LAST_FLOOR ? '深淵 ' : '地下') + f + '階';
const KCOL = { sword: '#cfe0f2', heart: '#ff6b81', coin: '#ffcf4a', shield: '#5cc3ea', stairs: '#ffe27a', ash: '#888' };
const ECOL = { slime: '#5fd27a', bat: '#a77be6', skel: '#f1ead8', bomb: '#ff9a3c', golem: '#b59a7e', king: '#48d9c0', general: '#ff6b5a', dragon: '#ff5340',
  beetle: '#5a78e0', ghost: '#dfe6ff', shaman: '#9b6fe0', fire: '#ff8a3c', drake: '#5fc46a', vampire: '#c03a5a', bombking: '#7fcf4a',
  stag: '#c0703a', lich: '#b49cff', titan: '#8aa6c0', priest: '#f2e6c8', ifrit: '#ff5a2a' };
const TILE_NAME = { sword: '剣', heart: 'ハート', coin: 'コイン', shield: '盾', stairs: '階段', ash: '灰' };
// 敵の説明(実際の数値入り)。はじめて出会ったときのカードと、長押しの説明で使う。
const ENEMY_INFO = {
  slime: e => '基本の敵。点がなくなると体当たりしてくる。',
  bat: e => 'せっかちで、' + e.cdMax + 'ターンごとに噛みついてくる。HPは低め。',
  skel: e => 'HPが高く、なかなか倒れない。剣をたくさん集めてから挑もう。',
  bomb: e => '倒すと爆発し、まわり8マスの敵に' + e.boom + 'ダメージ。放っておくと、点がなくなったとき自爆して' + e.atk + 'ダメージ（自爆すると消える）。',
  golem: e => '動きは遅いが、一撃が重い。HPも高い。盾でガードを固めておこう。',
  king: e => 'ボス。攻撃のたびに、仲間のスライムを呼び出す。一度で倒せなくても、ぶつかって少しずつ削ろう。',
  general: e => 'ボス。鎧' + e.armor + '：力が' + e.armor + 'に届かないと、はじかれて近づけない。',
  dragon: e => '地下100階のボス。攻撃のたびに剣を3本まで灰にし、火の精を呼ぶ。これまでのコツをすべて使おう。',
  beetle: e => '鎧' + e.armor + '：力が' + e.armor + 'に届かないと、はじかれて近づけない。剣を集めてから向かおう。',
  ghost: e => 'ふだんはすり抜ける。同じ線で先に1体倒した勢いがあるか、赤く光っている（攻撃の直前）ときだけ斬れる。爆発は当たる。',
  shaman: e => '毎ターン、となりの仲間のHPを' + e.heal + '回復する。まわりを削っても回復されるので、真っ先に倒そう。',
  fire: e => '攻撃のたびに、盤面の剣を1本灰にする。剣はためこまず、早めに使おう。',
  drake: e => 'ドラゴンの子ども。2ターンごとに攻撃し、一撃も重い。赤く光ったら最優先で。',
  vampire: e => 'ボス。噛みつくたびに、自分のHPを' + (e.atk * 2) + '回復する。間をあけず、続けて削ろう。',
  bombking: e => 'ボス。攻撃のたびにバクダンを呼ぶ。バクダンの爆発はボスにも当たる。うまく巻きこもう。',
  stag: e => 'ボス。鎧' + e.armor + '：剣をたっぷり集めて、力を' + e.armor + '以上にしてから挑もう。',
  lich: e => 'ボス。ゴーストと同じく、先に1体倒すか、赤く光っているときしか斬れない。呼び出すガイコツを足がかりにしよう。',
  titan: e => 'ボス。攻撃がガードをつらぬく（盾で防げない）。HPに余裕をもって、ハートを拾いながら戦おう。',
  priest: e => 'ボス。毎ターン、自分以外の全員のHPを' + e.healAll + '回復し、攻撃のたびにガイコツを呼ぶ。手下にかまわず本体を狙おう。',
  ifrit: e => 'ボス。攻撃のたびに剣を3本まで灰にする。剣を拾ったら、すぐに使い切ろう。',
};
const TILE_INFO = {
  sword: h => '拾うと力 +' + h.swordPow + '。たまった力は、敵にぶつかるとダメージになる（そのターンかぎり）。',
  heart: h => '拾うと HP +' + h.heartPow + '。',
  coin: h => '拾うと +' + HH.coinValue(S) + 'G。ステージの休憩所で、薬草や鍛冶に使える。',
  shield: h => '拾うとガード +' + h.shieldPow + '（最大' + HH.guardMax(h) + '）。敵の攻撃を先に受け止める（巨神像の攻撃は防げない）。',
  stairs: h => 'なぞると次の階へ。残って敵を倒し、経験値を稼ぐのもあり（ただし敵は少しずつ強くなる）。',
  ash: h => '魔竜の炎で焼けた剣。拾っても何も起きないが、通り道にはなる。',
};

// ---------------------------------------------------------------------
// 保存(localStorage)。読み書きに失敗しても遊べるようにすべて try で包む。
// ---------------------------------------------------------------------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } },
};
function loadMeta() {
  let m = null;
  try { m = JSON.parse(store.get('hh-meta', 'null')); } catch (e) { }
  m = Object.assign({ best: 0, clears: 0, runs: 0, lessons: [], seen: [], rewardAd: null, reviewAsked: false, tutDone: false }, m || {});
  const old = +store.get('hitofude_best', 0); // 試作版の最深記録を引き継ぐ
  if (old > m.best) m.best = old;
  return m;
}
const meta = loadMeta();
function saveMeta() { store.set('hh-meta', JSON.stringify(meta)); }
const cfg = {
  bgm: clampVol(store.get('hh-bgm-v', 60)), se: clampVol(store.get('hh-se-v', 80)),
  haptic: store.get('hh-haptic', '1') !== '0', sleep: store.get('hh-sleep', '1') !== '0',
};
function clampVol(v) { v = parseInt(v, 10); return isNaN(v) ? 60 : Math.max(0, Math.min(100, v)); }

function saveRunState(st) { if (st && st.mode === 'stage') store.set('hh-run', HH.serialize(st)); }
function saveRun() { saveRunState(S); }
function loadRun() { try { const v = store.get('hh-run', null); return v ? HH.deserialize(v) : null; } catch (e) { return null; } }
function clearRun() { store.del('hh-run'); }

// ---------------------------------------------------------------------
// ネイティブ(iOS)との連携。ブラウザで開いたときは何もしない。
// ---------------------------------------------------------------------
const NATIVE = (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.appReady) ? window.webkit.messageHandlers : null;
function post(name, body) { try { if (NATIVE && NATIVE[name]) NATIVE[name].postMessage(body || {}); } catch (e) { } }
function track(event, params) { post('progress', Object.assign({ event }, params || {})); }
function buzz(s) { if (cfg.haptic) post('haptic', { s }); }
let consentApplicable = false;
window.__setConsentApplicable__ = v => { consentApplicable = !!v; if (overlayFn === showSettings) refresh(); };

// ---- リワード広告(1日5回まで。日付の区切りは日本時間0時)----
const FAKE_ADS = /[?&]fakeads=1/.test(location.search); // ブラウザでの確認用
const AD_LIMIT = 5, AD_WATCHDOG_MS = 180000;
const jstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
function adLeft() { const r = meta.rewardAd; return (!r || r.date !== jstDay()) ? AD_LIMIT : Math.max(0, AD_LIMIT - r.count); }
function adConsume() { const d = jstDay(), r = meta.rewardAd; meta.rewardAd = { date: d, count: (r && r.date === d ? r.count : 0) + 1 }; saveMeta(); }
function adsSupported() { return FAKE_ADS || !!(NATIVE && NATIVE.rewardAd); }
const ad = { pending: null, askedAt: 0, fail: null };
function requestAd(context) {
  if (ad.pending || adLeft() <= 0) return;
  ad.pending = context; ad.fail = null; ad.askedAt = Date.now(); refresh();
  if (FAKE_ADS) { setTimeout(() => window.__onRewardAdResult__(context, 'rewarded'), 700); return; }
  post('rewardAd', { action: 'show', context });
}
window.__onRewardAdResult__ = (context, result) => {
  if (ad.pending !== context) return; // 別の画面へ移ったあとに届いた結果は使わない
  ad.pending = null; ad.askedAt = 0;
  const r = result === true ? 'rewarded' : result === false ? 'unavailable' : String(result || 'unavailable');
  track('reward_ad_result', { context, result: r });
  if (r !== 'rewarded') { ad.fail = r; refresh(); return; }
  adConsume();
  if (context === 'revive') {
    if (S.mode === 'stage' && HH.revive(S)) {
      saveRun(); closeOverlay();
      eachCell((x, y) => { const t = S.grid[y][x]; if (t) t._born = performance.now(); });
      sfx.level(); buzz('success'); fx.flash = { c: '255,226,122', a: 0.45 };
      banner('復活！', 'HP全回復'); fx.hint = '息を吹き返した！この階の続きから'; infoDirty = true;
    } else refresh();
  } else if (context === 'blessing') {
    if (HH.grantExtraPick(S)) { saveRun(); sfx.level(); toast('祝福を2つ選べるようになった'); }
    refresh();
  }
};
setInterval(() => { // ネイティブから結果が返らないまま固まったときの保険
  if (ad.pending && Date.now() - ad.askedAt > AD_WATCHDOG_MS) { ad.pending = null; ad.fail = 'timeout'; refresh(); }
}, 5000);
function adFailNote() {
  if (!ad.fail || ad.pending) return '';
  const t = ad.fail === 'dismissed' ? '報酬を受け取るには、広告を最後まで視聴してください。'
    : ad.fail === 'nofill' ? 'ただいま表示できる広告がありません。少し時間をおいてお試しください。'
      : ad.fail === 'nonetwork' ? '通信状態をご確認のうえ、もう一度お試しください。'
        : '広告を読み込めませんでした。広告ブロック機能などをお使いの場合は、一時的にオフにしてお試しください。';
  return '<p class="err">' + t + '</p>';
}
function adButton(context, label, sub) {
  const loading = ad.pending === context;
  return '<button class="btn ad" data-act="ad:' + context + '"' + (ad.pending ? ' disabled' : '') + '>' +
    (loading ? '広告を読み込み中…' : '▶ ' + label) + '<small>' + sub + '（本日あと' + adLeft() + '回）</small></button>' + adFailNote();
}

// ---------------------------------------------------------------------
// 音: 効果音(合成音)と BGM(合成のチップチューン)。音量は別々に調整できる。
// ---------------------------------------------------------------------
let AC = null, seBus = null, bgmBus = null;
function ac() {
  if (!AC) {
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { } // 他アプリの音楽と共存させる
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      seBus = AC.createGain(); bgmBus = AC.createGain();
      seBus.connect(AC.destination); bgmBus.connect(AC.destination); applyVolumes();
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended' && !document.hidden) AC.resume().catch(() => { });
  return AC;
}
function applyVolumes() { if (!AC) return; seBus.gain.value = cfg.se / 100; bgmBus.gain.value = cfg.bgm / 100 * 0.55; }
function tone(f, d, o = {}) {
  const bus = o.bus || seBus;
  if (!AC || (bus === seBus && cfg.se === 0)) return;
  try {
    const t = o.t != null ? o.t : AC.currentTime + (o.at || 0), os = AC.createOscillator(), g = AC.createGain();
    os.type = o.type || 'square'; os.frequency.setValueAtTime(f, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(o.v || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    os.connect(g); g.connect(bus); os.start(t); os.stop(t + d + 0.02);
  } catch (e) { }
}
function noise(d, v = 0.12, fq = 1400, o = {}) {
  const bus = o.bus || seBus;
  if (!AC || (bus === seBus && cfg.se === 0)) return;
  try {
    const n = Math.floor(AC.sampleRate * d), b = AC.createBuffer(1, n, AC.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = AC.createBufferSource(), g = AC.createGain(), fl = AC.createBiquadFilter();
    fl.type = o.hp ? 'highpass' : 'lowpass'; fl.frequency.value = fq; g.gain.value = v;
    src.buffer = b; src.connect(fl); fl.connect(g); g.connect(bus); src.start(o.t != null ? o.t : 0);
  } catch (e) { }
}
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const note = n => 392 * Math.pow(2, SCALE[Math.min(n, SCALE.length - 1)] / 12);
const sfx = {
  tick: n => tone(note(n) / 2, 0.05, { type: 'triangle', v: 0.05 }),
  pick: n => tone(note(n), 0.09, { type: 'square', v: 0.04 }),
  coin: n => { tone(note(n) * 2, 0.06, { v: 0.03 }); tone(note(n) * 3, 0.1, { v: 0.03, at: 0.05 }); },
  heal: () => { tone(523, 0.1, { type: 'sine', v: 0.08 }); tone(784, 0.16, { type: 'sine', v: 0.08, at: 0.07 }); },
  shield: () => tone(220, 0.12, { type: 'triangle', v: 0.09, to: 330 }),
  hit: d => { noise(0.09, 0.2 + Math.min(0.15, d * 0.01), 2400); tone(190, 0.1, { to: 60, v: 0.09 }); },
  kill: c => { noise(0.16, 0.2, 900); tone(330 * Math.pow(1.19, c), 0.14, { v: 0.06, to: 660 * Math.pow(1.19, c) }); },
  boom: () => { noise(0.4, 0.32, 500); tone(90, 0.35, { to: 30, v: 0.14, type: 'sawtooth' }); },
  hurt: () => { noise(0.14, 0.25, 700); tone(140, 0.2, { to: 50, v: 0.1, type: 'sawtooth' }); },
  block: () => { tone(880, 0.05, { v: 0.05 }); tone(660, 0.08, { v: 0.05, at: 0.04 }); },
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { v: 0.06, at: i * 0.07 })),
  stairs: () => [659, 784, 988].forEach((f, i) => tone(f, 0.2, { type: 'triangle', v: 0.08, at: i * 0.09 })),
  descend: () => [523, 440, 349, 262].forEach((f, i) => tone(f, 0.1, { type: 'triangle', v: 0.07, at: i * 0.06 })),
  dead: () => [330, 262, 196, 131].forEach((f, i) => tone(f, 0.25, { type: 'sawtooth', v: 0.06, at: i * 0.13 })),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, { v: 0.06, at: i * 0.11 })),
  ui: () => tone(660, 0.05, { v: 0.04 }),
};

// ---- BGM: 8分音符ずつ先読みして鳴らす小さなシーケンサ ----
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const TRACKS = {
  calm: { bpm: 84, chords: [[48, [60, 64, 67]], [41, [60, 65, 69]], [43, [59, 62, 67]], [48, [60, 64, 67]]],
    mel: [72, -1, -1, 74, 76, -1, 72, -1, 77, -1, 76, -1, 74, -1, 72, -1, 71, -1, 74, -1, 79, -1, 77, 74, 72, -1, -1, -1, -1, -1, -1, -1] },
  field: { bpm: 96, chords: [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]], [45, [57, 60, 64]], [41, [57, 60, 65]], [43, [55, 59, 62]], [40, [56, 59, 64]]],
    mel: [69, -1, 72, -1, 71, 69, 67, -1, 65, -1, 69, -1, 67, 65, 64, -1, 64, -1, 67, -1, 72, -1, 71, 69, 67, -1, -1, -1, 62, -1, -1, -1,
      72, -1, 71, 72, 76, -1, 74, 72, 69, -1, 72, -1, 71, 69, 65, -1, 67, -1, 64, 67, 71, -1, 74, -1, 71, -1, -1, -1, 68, -1, -1, -1] },
  boss: { bpm: 132, hat: true, chords: [[38, [62, 65, 69]], [46, [58, 62, 65]], [48, [60, 64, 67]], [45, [57, 61, 64]]],
    mel: [74, -1, 74, 72, 74, -1, 77, -1, 74, -1, 70, -1, 69, -1, 70, -1, 72, -1, 72, 70, 72, -1, 76, -1, 73, -1, -1, -1, 69, -1, -1, -1] },
};
const music = { cur: null, step: 0, t: 0, timer: null };
function musicPlay(name) {
  if (cfg.bgm === 0 || !name) { musicStop(); return; }
  if (!ac()) return;
  if (music.cur === name && music.timer) return;
  music.cur = name; music.step = 0; music.t = AC.currentTime + 0.1;
  if (!music.timer) music.timer = setInterval(musicTick, 30);
}
function musicStop() { if (music.timer) clearInterval(music.timer); music.timer = null; music.cur = null; }
function musicTick() {
  if (!AC || AC.state !== 'running') return;
  const tr = TRACKS[music.cur]; if (!tr) return;
  const sd = 60 / tr.bpm / 2;
  if (music.t < AC.currentTime - 0.2) music.t = AC.currentTime + 0.05;
  while (music.t < AC.currentTime + 0.15) {
    const s = music.step, i = s % 8, [root, tri] = tr.chords[Math.floor(s / 8) % tr.chords.length], bus = bgmBus, t = music.t;
    if (i % 2 === 0) tone(midi(root + (tr.hat && i % 4 === 2 ? 12 : 0)), sd * 1.7, { type: 'triangle', v: 0.09, t, bus });
    tone(midi(tri[[0, 1, 2, 1][i % 4]]), sd * 0.8, { type: 'triangle', v: 0.026, t, bus });
    const m = tr.mel[s % tr.mel.length]; if (m > 0) tone(midi(m), sd * 1.6, { type: 'square', v: 0.022, t, bus });
    if (tr.hat && i % 2 === 1) noise(0.04, 0.05, 6000, { hp: true, t, bus });
    music.step++; music.t += sd;
  }
}
function wantedTrack() {
  if (screen !== 'game') return 'calm';
  if (S.mode === 'lesson') return 'calm';
  return HH.isBossFloor(S.floor) && !S.bossDead ? 'boss' : 'field';
}

// ---- 曲ファイルのBGM(つなぎ目なしでループ)。曲がない・読めないときは上の合成BGMを使う ----
// 曲の最初に音が鳴る位置(から lead 秒戻した所)を頭にして、loopSec 秒ぶんをループする。
// loopSec は小節の区切りに合わせる(= 小節数 × 240 ÷ BPM)。曲の最後の無音・余韻はループに含めない。
const BGM_FILES = {
  // 約183秒の曲。音は0.1秒目から180.0秒目まで(84BPMで63小節 / 96BPMで72小節のどちらでも180.0秒)
  village: { src: 'The_First_Village.mp3', loopSec: 180.0, lead: 0.106 },
};
// 場面(合成BGMの名前) → 流す曲。曲が増えたら、ここを書き換える(例: boss: 'boss1')。
const BGM_FOR = { calm: 'village', field: 'village', boss: 'village' };
const fileBgm = { cache: {}, loading: {}, failed: {}, cur: null, src: null, gain: null };

function loadBgm(key) {
  if (fileBgm.cache[key] || fileBgm.loading[key] || fileBgm.failed[key]) return;
  fileBgm.loading[key] = true;
  const T = BGM_FILES[key], xhr = new XMLHttpRequest(); // file:// でも読めるよう fetch ではなく XHR
  const fail = e => { fileBgm.failed[key] = true; delete fileBgm.loading[key]; console.warn('BGM load failed:', key, e); updateMusic(); };
  xhr.open('GET', T.src); xhr.responseType = 'arraybuffer';
  xhr.onload = () => {
    if (!xhr.response || (xhr.status && xhr.status >= 400)) return fail(xhr.status);
    AC.decodeAudioData(xhr.response, buf => {
      fileBgm.cache[key] = prepLoop(buf, T); delete fileBgm.loading[key]; updateMusic();
    }, fail);
  };
  xhr.onerror = fail; xhr.send();
}
// ループの頭と終わりを決め、つなぎ目のプツッという音を消すために両端へごく短いフェードをかける
function prepLoop(buf, T) {
  const sr = buf.sampleRate, d0 = buf.getChannelData(0);
  let lead = 0; while (lead < d0.length && Math.abs(d0[lead]) < 0.01) lead++;
  const loopStart = Math.max(0, lead / sr - T.lead);
  const loopEnd = Math.min(buf.duration, loopStart + (T.loopSec || T.bars * 240 / T.bpm));
  const f = Math.floor(sr * 0.006), s0 = Math.floor(loopStart * sr), s1 = Math.floor(loopEnd * sr);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < f; i++) { const k = i / f; if (s0 + i < d.length) d[s0 + i] *= k; if (s1 - 1 - i >= 0) d[s1 - 1 - i] *= k; }
  }
  return { buffer: buf, loopStart, loopEnd };
}
function filePlay(key) {
  if (fileBgm.cur === key && fileBgm.src) return;
  fileStop(0.5);
  const L = fileBgm.cache[key], src = AC.createBufferSource(), g = AC.createGain(), t = AC.currentTime;
  src.buffer = L.buffer; src.loop = true; src.loopStart = L.loopStart; src.loopEnd = L.loopEnd;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.4);
  src.connect(g); g.connect(bgmBus); src.start(t + 0.02, L.loopStart);
  fileBgm.cur = key; fileBgm.src = src; fileBgm.gain = g;
}
function fileStop(fade = 0.3) {
  const { src, gain } = fileBgm; if (!src) return;
  fileBgm.src = null; fileBgm.cur = null;
  try {
    const t = AC.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + fade); src.stop(t + fade + 0.05);
  } catch (e) { }
}
function updateMusic() {
  const name = wantedTrack(), key = BGM_FOR[name];
  if (cfg.bgm === 0 || !name) { musicStop(); fileStop(); return; }
  if (!ac()) return;
  if (key && BGM_FILES[key] && !fileBgm.failed[key]) {
    musicStop(); // 合成BGMは止める(読み込み中は無音で、読み終わったら流れ始める)
    if (fileBgm.cache[key]) filePlay(key); else loadBgm(key);
    return;
  }
  fileStop(); musicPlay(name);
}

// ---------------------------------------------------------------------
// 状態
// ---------------------------------------------------------------------
let S, screen = 'title', s = 64, dpr = 1, now = 0, busy = false, dragging = false, path = [], pv = null, infoDirty = true, turnN = 0, dragWarn = '';
const fx = { parts: [], floats: [], marks: [], shake: 0, flash: null, fade: 0, hv: { x: 2, y: 4 }, off: { x: 0, y: 0 }, pool: null, hurtT: 0, hint: '' };
const tweens = [];

const sleep = ms => new Promise(r => setTimeout(r, ms));
function tween(obj, key, to, ms) { return new Promise(res => tweens.push({ obj, key, from: obj[key], to, t0: performance.now(), ms, res })); }
const C = (x, y) => [(x + 0.5) * s, (y + 0.5) * s];
function burst(x, y, color, n, sp = 3, size = 4) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (0.4 + Math.random()); fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: 0.18, life: 1, d: 0.03 + Math.random() * 0.03, color, size: size * (0.6 + Math.random() * 0.8) }); }
}
function floatText(x, y, text, color, size = 18, vy = -0.9) { fx.floats.push({ x, y, text, color, size, vy, life: 1 }); }
function hitMark(x, y, r, color) { fx.marks.push({ x, y, r, color, t0: now, rot: Math.random() * 3 }); }
function banner(text, sub) { const b = $('banner'); b.innerHTML = '<b>' + text + '</b>' + (sub ? '<span>' + sub + '</span>' : ''); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800); }

// ---------- 演出：出来事ひとつずつ ----------
async function animate(ev) {
  const h = S.hero;
  if (ev.pool != null && ev.pool !== fx.pool) { fx.pool = ev.pool; infoDirty = true; }
  switch (ev.t) {
    case 'move': {
      const ms = Math.max(34, 66 - turnN * 3); turnN++;
      tween(fx.hv, 'x', ev.x, ms); await tween(fx.hv, 'y', ev.y, ms); break;
    }
    case 'pick': {
      const [x, y] = C(ev.x, ev.y);
      burst(x, y, KCOL[ev.k], 7, 2.6, 3.5);
      if (ev.k === 'sword') { sfx.pick(ev.n); floatText(x, y - 8, '力+' + ev.val, '#eaf2fb', 13); }
      else if (ev.k === 'coin') { sfx.coin(ev.n); floatText(x, y - 8, '+' + ev.val + 'G', '#ffcf4a', 15); }
      else if (ev.k === 'heart') { sfx.heal(); floatText(x, y - 8, ev.val ? '+' + ev.val : '満タン', '#7dffa0', 17); }
      else if (ev.k === 'shield') { sfx.shield(); floatText(x, y - 8, ev.val ? 'ガード+' + ev.val : 'ガード最大', '#8fdcff', 14); }
      else sfx.tick(ev.n);
      break;
    }
    case 'hit': {
      const [x, y] = C(ev.x, ev.y), col = ECOL[ev.e.type];
      if (!ev.blast) {
        const dx = ev.x - h.x, dy = ev.y - h.y, m = Math.hypot(dx, dy) || 1;
        tween(fx.off, 'x', dx / m * 0.42, 45); await tween(fx.off, 'y', dy / m * 0.42, 45);
      }
      const hs = 55 + Math.min(110, ev.dmg * 5) + (ev.kill ? 35 : 0);
      sfx.hit(ev.dmg); hitMark(x, y, s * (0.5 + Math.min(0.5, ev.dmg * 0.03)), '#fff7d0');
      burst(x, y, col, 6 + Math.min(10, ev.dmg), 4, 4); burst(x, y, '#1a1a1a', 4, 3, 3);
      ev.e._shake = { until: now + hs + 90, mag: 4 + Math.min(7, ev.dmg * 0.5) };
      fx.shake = Math.max(fx.shake, 2 + Math.min(8, ev.dmg * 0.4));
      floatText(x + (Math.random() * 10 - 5), y - s * 0.3, '-' + ev.dmg, '#fff', 20 + Math.min(10, ev.dmg * 0.5), -1.3);
      await sleep(hs); // ヒットストップ
      if (!ev.blast) { tween(fx.off, 'x', 0, 70); tween(fx.off, 'y', 0, 70); if (!ev.kill) await sleep(90); }
      break;
    }
    case 'kill': {
      const [x, y] = C(ev.x, ev.y), col = ECOL[ev.e.type], big = ev.e.boss;
      sfx.kill(ev.combo); buzz(big ? 'heavy' : 'light'); burst(x, y, col, big ? 40 : 16, big ? 7 : 5, big ? 7 : 5); burst(x, y, '#fff', 6, 3, 3);
      fx.flash = { c: '255,255,255', a: big ? 0.6 : 0.14 }; fx.shake = Math.max(fx.shake, big ? 14 : 5);
      floatText(x, y + 4, '+' + ev.exp + ' EXP', '#ffe27a', 14, -0.6);
      if (ev.combo >= 2) floatText(x, y - s * 0.55, ev.combo + '連撃！', '#ffb347', 20 + ev.combo * 2, -0.7);
      if (ev.heal) floatText((h.x + 0.5) * s, (h.y + 0.5) * s, '+' + ev.heal, '#7dffa0', 14);
      if (big) { banner(ev.e.name + ' 撃破！'); sfx.win(); await sleep(500); } else await sleep(50);
      infoDirty = true; break;
    }
    case 'boom': {
      const [x, y] = C(ev.x, ev.y);
      sfx.boom(); buzz('heavy'); fx.flash = { c: '255,220,160', a: 0.45 }; fx.shake = 13;
      hitMark(x, y, s * 1.5, '#ffb347'); burst(x, y, '#ff9a3c', 26, 7, 6); burst(x, y, '#3a3030', 14, 4, 7);
      await sleep(110); break;
    }
    case 'levelup': {
      const [x, y] = C(h.x, h.y);
      sfx.level(); buzz('success'); fx.flash = { c: '255,226,122', a: 0.35 };
      for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283; fx.parts.push({ x, y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, g: 0, life: 1, d: 0.03, color: '#ffe27a', size: 5 }); }
      floatText(x, y - s * 0.6, 'LEVEL UP!', '#ffe27a', 24, -0.5); banner('レベル ' + h.lv, ev.big ? 'HP全回復・こうげき力+1・剣と盾の力+1' : 'HP全回復・こうげき力+1');
      await sleep(320); break;
    }
    case 'zanshin': floatText((h.x + 0.5) * s, (h.y + 0.2) * s, '残心 ガード+' + ev.val, '#8fdcff', 14); break;
    case 'clang': { const [x, y] = C(ev.x, ev.y); sfx.block(); floatText(x, y - 10, ev.ghost ? 'すり抜けた' : 'はじかれた', '#ccc', 15); await sleep(160); break; }
    case 'attack': {
      const [x, y] = C(ev.x, ev.y), [hx, hy] = C(h.x, h.y);
      if (ev.bomb) { sfx.boom(); hitMark(x, y, s * 1.4, '#ffb347'); burst(x, y, '#ff9a3c', 24, 7, 6); burst(x, y, '#3a3030', 12, 4, 7); }
      else { const dx = hx - x, dy = hy - y, m = Math.hypot(dx, dy) || 1; ev.e._lunge = { dx: dx / m, dy: dy / m, t0: now, ms: 230 }; await sleep(100); }
      if (ev.dmg > 0) {
        sfx.hurt(); buzz('medium'); fx.flash = { c: '255,50,50', a: 0.28 + Math.min(0.25, ev.dmg * 0.02) }; fx.shake = Math.max(fx.shake, 5 + Math.min(9, ev.dmg * 0.6)); fx.hurtT = now;
        hitMark(hx, hy, s * 0.55, '#ff7a7a'); burst(hx, hy, '#ff5a5a', 8, 4, 4);
        floatText(hx, hy - s * 0.35, '-' + ev.dmg, '#ff6b6b', 22, -1.2);
      } else { sfx.block(); floatText(hx, hy - s * 0.35, 'ガード！', '#8fdcff', 17); burst(hx, hy, '#8fdcff', 6, 3, 3); }
      if (ev.pierce && ev.dmg > 0) floatText(hx, hy - s * 0.75, 'ガードをつらぬいた', '#8fdcff', 13);
      await sleep(ev.dmg > 0 ? 190 : 130); infoDirty = true; break;
    }
    case 'summon': { const t = S.grid[ev.y][ev.x]; if (t) t._born = now; sfx.shield(); burst(...C(ev.x, ev.y), ECOL[ev.type] || '#fff', 10, 3, 4); floatText(...C(ev.x, ev.y), HH.ENAME[ev.type] + 'が現れた', '#7dffd0', 12); await sleep(140); break; }
    case 'heal': { sfx.heal(); for (const [x, y] of ev.cells) { const [cx, cy] = C(x, y); burst(cx, cy, '#7dffa0', 6, 2, 3); } floatText(GW * s / 2, GH * s * 0.45, '敵が回復した', '#7dffa0', 15); await sleep(160); break; }
    case 'drain': { const [x, y] = C(ev.x, ev.y); sfx.heal(); burst(x, y, '#ff5d73', 8, 2.5, 3); floatText(x, y - s * 0.3, '+' + ev.val, '#ff8fa0', 16); await sleep(120); break; }
    case 'burn': { sfx.boom(); for (const [x, y] of ev.cells) { burst(...C(x, y), '#ff7a3c', 12, 4, 5); const t = S.grid[y][x]; if (t) t._born = now; } floatText(GW * s / 2, GH * s / 2, '剣が灰になった', '#ff9a6b', 17); await sleep(220); break; }
    case 'stairs': {
      const [x, y] = C(ev.x, ev.y), t = S.grid[ev.y][ev.x]; if (t) t._born = now;
      sfx.stairs(); burst(x, y, '#ffe27a', 22, 5, 5); banner('階段があらわれた');
      fx.hint = '光る階段までなぞると次の階へ。残って経験値を稼ぐのもあり（敵は少しずつ強くなる）';
      await sleep(260); break;
    }
    case 'spawn': { ev.cells.forEach(([x, y], i) => { const t = S.grid[y][x]; if (t) t._born = now + i * 16; }); await sleep(Math.min(170, ev.cells.length * 16 + 50)); break; }
    case 'descend': sfx.descend(); await tween(fx, 'fade', 1, 260); break;
    case 'lessonClear': { banner('クリア！'); sfx.win(); buzz('success'); await sleep(650); break; }
    case 'dead': { sfx.dead(); buzz('error'); fx.flash = { c: '255,0,0', a: 0.6 }; fx.shake = 16; burst(...C(h.x, h.y), '#ff5a5a', 30, 6, 6); await sleep(750); break; }
  }
}

async function playTurn(p) {
  busy = true; turnN = 0; fx.pool = S.hero.atk; S.tut = null; infoDirty = true; hideTip();
  // 先に結果を計算して保存しておく(乱数は状態に入っているので、演出後の盤面と必ず一致する)。
  // 演出の途中でアプリが終了されても、1手をやり直して結果を選び直すことはできない。
  if (S.mode === 'stage') { const c = HH.deserialize(HH.serialize(S)); for (const _ of HH.turn(c, p)) { } saveRunState(c); }
  if (S.mode === 'stage' && S.floor === 1 && S.turn === 0) fx.hint = '敵の上の点は攻撃までのターン数。赤く光ったら、次に攻撃してくる';
  try { for (const ev of HH.turn(S, p)) await animate(ev); }
  finally { fx.pool = null; busy = false; infoDirty = true; }
  afterTurn();
}
function afterTurn() {
  updateMusic();
  if (S.mode === 'lesson') {
    const L = S.lesson;
    if (S.phase === 'lessonClear') { completeLesson(L.id); show(showLessonClear); return; }
    if (S.phase === 'lessonFail') { show(showLessonFail); return; }
    fx.hint = S.stairs ? '光る階段までなぞると、レッスンクリア！' : L.hints ? L.hints[Math.min(S.turn, L.hints.length - 1)] : ''; infoDirty = true;
    return;
  }
  saveRun();
  if (S.phase === 'rest' || S.phase === 'win') {
    track('floor_clear', { floor: S.floor });
    if (S.phase === 'win') show(showWin); else show(showRest);
  } else if (S.phase === 'dead') {
    track('death', { floor: S.floor, enemyId: S.killedBy || '', boss: HH.isBossFloor(S.floor) });
    recordBest(); show(showDead);
  } else checkNewEnemies();
}

// ---------------------------------------------------------------------
// 描画
// ---------------------------------------------------------------------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function circ(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); }
function txt(t, x, y, size, fill, align = 'center', stroke = '#0b0b12', lw = 4) {
  ctx.font = 'bold ' + size + 'px DotGothic16, sans-serif'; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(t, x, y); }
  ctx.fillStyle = fill; ctx.fillText(t, x, y);
}
function eyes(x, y, gap, r, col = '#fff', pupil = '#111') { for (const d of [-1, 1]) { ctx.fillStyle = col; circ(x + d * gap, y, r); ctx.fill(); ctx.fillStyle = pupil; circ(x + d * gap + 0.6, y + 0.6, r * 0.5); ctx.fill(); } }

const ICON = {
  sword() {
    ctx.save(); ctx.rotate(0.7);
    ctx.fillStyle = '#eaf2fb'; ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(4, -21); ctx.lineTo(4, 8); ctx.lineTo(-4, 8); ctx.lineTo(-4, -21); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8fa6bf'; ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(0, 8); ctx.lineTo(-4, 8); ctx.lineTo(-4, -21); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffcf4a'; rr(-11, 7, 22, 5, 2); ctx.fill();
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-2.5, 12, 5, 9);
    ctx.fillStyle = '#ffcf4a'; circ(0, 23, 3.4); ctx.fill();
    ctx.restore();
  },
  heart() {
    ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.moveTo(0, 17); ctx.bezierCurveTo(-30, -4, -15, -26, 0, -9); ctx.bezierCurveTo(15, -26, 30, -4, 0, 17); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-8, -9, 4, 2.6, -0.6, 0, 6.2832); ctx.fill();
  },
  coin() {
    ctx.fillStyle = '#b8860b'; circ(0, 2, 16); ctx.fill(); ctx.fillStyle = '#ffcf4a'; circ(0, 0, 16); ctx.fill();
    ctx.strokeStyle = '#d9a520'; ctx.lineWidth = 2.5; circ(0, 0, 10.5); ctx.stroke();
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(-6, -7, 4, 2.2, -0.7, 0, 6.2832); ctx.fill();
  },
  shield() {
    ctx.beginPath(); ctx.moveTo(-15, -17); ctx.lineTo(15, -17); ctx.lineTo(15, 2); ctx.quadraticCurveTo(13, 16, 0, 23); ctx.quadraticCurveTo(-13, 16, -15, 2); ctx.closePath();
    ctx.fillStyle = '#3f9fd0'; ctx.fill(); ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#e8f6ff'; ctx.fillRect(-2, -15, 4, 34); ctx.fillRect(-13, -6, 26, 4);
  },
  ash() { ctx.fillStyle = '#6a6470'; for (const [x, y, r] of [[-8, 6, 7], [6, 8, 8], [0, -4, 6]]) { circ(x, y, r); ctx.fill(); } ctx.fillStyle = '#8d8794'; circ(-2, -6, 3); ctx.fill(); },
  stairs() {
    const p = 0.75 + 0.25 * Math.sin(now / 180);
    ctx.fillStyle = 'rgba(255,226,122,' + (0.25 * p) + ')'; circ(0, 0, 29); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#fff3b8', '#ffe27a', '#e0b84a', '#a8862e'][i]; ctx.fillRect(-20 + i * 10, -18 + i * 9, 40 - i * 10, 9); }
    ctx.fillStyle = '#12121a'; ctx.beginPath(); ctx.moveTo(14, 12); ctx.lineTo(22, 12); ctx.lineTo(18, 20); ctx.closePath(); ctx.fill();
  },
};
function slimeBody(col, dark) {
  const q = 1 + 0.05 * Math.sin(now / 260);
  ctx.save(); ctx.scale(1 / q, q);
  ctx.beginPath(); ctx.moveTo(-17, 8); ctx.quadraticCurveTo(-19, -18, 0, -18); ctx.quadraticCurveTo(19, -18, 17, 8); ctx.quadraticCurveTo(0, 14, -17, 8); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-8, -10, 4, 2.5, -0.5, 0, 6.2832); ctx.fill();
  eyes(0, -3, 6, 3.6); ctx.restore();
}
const ENEMY = {
  slime() { slimeBody('#5fd27a', '#1d5a2e'); },
  bat() {
    const f = Math.sin(now / 90) * 0.35;
    for (const d of [-1, 1]) { ctx.save(); ctx.scale(d, 1); ctx.rotate(f); ctx.fillStyle = '#7b4fc4'; ctx.beginPath(); ctx.moveTo(5, -6); ctx.lineTo(25, -16); ctx.lineTo(22, -3); ctx.lineTo(17, -6); ctx.lineTo(14, 2); ctx.lineTo(9, -2); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#a77be6'; circ(0, -3, 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(-6, -18); ctx.lineTo(-2, -11); ctx.moveTo(8, -9); ctx.lineTo(6, -18); ctx.lineTo(2, -11); ctx.fill();
    eyes(0, -4, 4, 2.6, '#ffe27a', '#b00');
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(-1.5, 6); ctx.lineTo(0, 2); ctx.lineTo(1.5, 6); ctx.lineTo(3, 2); ctx.fill();
  },
  skel() {
    ctx.fillStyle = '#f1ead8'; circ(0, -8, 14); ctx.fill(); rr(-8, 2, 16, 9, 2); ctx.fill();
    ctx.fillStyle = '#15121c'; circ(-5.5, -8, 4); ctx.fill(); circ(5.5, -8, 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(-2, 1); ctx.lineTo(2, 1); ctx.fill();
    ctx.fillRect(-4.5, 5, 1.5, 6); ctx.fillRect(-0.75, 5, 1.5, 6); ctx.fillRect(3, 5, 1.5, 6);
  },
  bomb() {
    ctx.fillStyle = '#24242c'; circ(0, -2, 15); ctx.fill(); ctx.strokeStyle = '#55556a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#c9a86a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, -15); ctx.quadraticCurveTo(12, -24, 17, -20); ctx.stroke();
    ctx.fillStyle = Math.sin(now / 50) > 0 ? '#ffe27a' : '#ff7a3c'; circ(17, -20, 3.6 + Math.sin(now / 70)); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-9, -7); ctx.lineTo(-2, -3); ctx.lineTo(-9, -1); ctx.moveTo(9, -7); ctx.lineTo(2, -3); ctx.lineTo(9, -1); ctx.fill();
  },
  golem() {
    ctx.fillStyle = '#8d7b68'; rr(-16, -21, 32, 30, 5); ctx.fill(); ctx.strokeStyle = '#4d4034'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#6f6052'; ctx.fillRect(-16, -2, 12, 4); ctx.fillRect(4, 3, 12, 3); ctx.fillRect(-3, -21, 3, 8);
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(-10, -12, 7, 4); ctx.fillRect(3, -12, 7, 4);
  },
  king() {
    ctx.save(); ctx.scale(1.2, 1.2); ctx.translate(0, 2); slimeBody('#48d9c0', '#12604f');
    ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.moveTo(-10, -17); ctx.lineTo(-11, -27); ctx.lineTo(-5, -22); ctx.lineTo(0, -29); ctx.lineTo(5, -22); ctx.lineTo(11, -27); ctx.lineTo(10, -17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5d73'; circ(0, -21, 2); ctx.fill(); ctx.restore();
  },
  general() {
    ctx.save(); ctx.scale(1.15, 1.15); ctx.translate(0, 2); ENEMY.skel();
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, -10, 15, Math.PI, 0); ctx.lineTo(15, -8); ctx.lineTo(-15, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.moveTo(-13, -14); ctx.lineTo(-22, -28); ctx.lineTo(-8, -20); ctx.moveTo(13, -14); ctx.lineTo(22, -28); ctx.lineTo(8, -20); ctx.fill();
    ctx.restore();
  },
  dragon() {
    ctx.fillStyle = '#c93327'; ctx.beginPath(); ctx.moveTo(-20, -12); ctx.lineTo(-12, -28); ctx.lineTo(-7, -16); ctx.lineTo(7, -16); ctx.lineTo(12, -28); ctx.lineTo(20, -12); ctx.lineTo(13, 8); ctx.lineTo(0, 13); ctx.lineTo(-13, 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6b1410'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#ff7a3c'; ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(8, 3); ctx.lineTo(4, 11); ctx.lineTo(-4, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(-14, -9); ctx.lineTo(-4, -5); ctx.lineTo(-12, -2); ctx.moveTo(14, -9); ctx.lineTo(4, -5); ctx.lineTo(12, -2); ctx.fill();
    ctx.fillStyle = '#111'; circ(-8, -5.5, 1.6); ctx.fill(); circ(8, -5.5, 1.6); ctx.fill();
    ctx.fillStyle = 'rgba(255,' + (140 + 80 * Math.sin(now / 80) | 0) + ',60,.9)'; circ(-3, 7, 1.8); ctx.fill(); circ(3, 7, 1.8); ctx.fill();
  },
};
// ---- 第4章以降の敵(ボスは、その章の敵に冠・角・色などを足して作る) ----
function crown(y, col = '#ffcf4a') {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-9, y); ctx.lineTo(-10, y - 9); ctx.lineTo(-4.5, y - 5); ctx.lineTo(0, y - 11); ctx.lineTo(4.5, y - 5); ctx.lineTo(10, y - 9); ctx.lineTo(9, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff5d73'; circ(0, y - 4, 1.8); ctx.fill();
}
function beetleBody(shell, dark, jaw) {
  ctx.strokeStyle = dark; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (const d of [-1, 1]) for (const yy of [-2, 5, 12]) { ctx.beginPath(); ctx.moveTo(d * 12, yy); ctx.lineTo(d * 19, yy + 4); ctx.stroke(); }
  ctx.fillStyle = shell; ctx.beginPath(); ctx.ellipse(0, 3, 14, 13, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 16); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-6, -1, 2.6, 5.5, 0.3, 0, 6.2832); ctx.fill();
  ctx.fillStyle = dark; circ(0, -12, 7); ctx.fill();
  if (jaw) { ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 3.2; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 4, -16); ctx.quadraticCurveTo(d * 13, -24, d * 4, -29); ctx.stroke(); } }
  else { ctx.strokeStyle = '#a9bbff'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(0, -17); ctx.quadraticCurveTo(3, -25, -3, -29); ctx.stroke(); }
  eyes(0, -12, 3.6, 1.9, '#ffe27a', '#111');
}
function ghostBody(col, eye) {
  const f = Math.sin(now / 300) * 2;
  ctx.save(); ctx.translate(0, f);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-14, 12); ctx.lineTo(-14, -6); ctx.arc(0, -6, 14, Math.PI, 0); ctx.lineTo(14, 12);
  for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(14 - i * 7 - 3.5, 6, 14 - (i + 1) * 7, 12);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = eye;
  ctx.beginPath(); ctx.ellipse(-5, -7, 2.8, 4, 0, 0, 6.2832); ctx.fill(); ctx.beginPath(); ctx.ellipse(5, -7, 2.8, 4, 0, 0, 6.2832); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 2, 3, 2.2, 0, 0, 6.2832); ctx.fill();
  ctx.restore();
}
function robeBody(robe, trim, glow) {
  ctx.fillStyle = robe; ctx.beginPath(); ctx.moveTo(-15, 16); ctx.quadraticCurveTo(-14, -20, 0, -22); ctx.quadraticCurveTo(14, -20, 15, 16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = trim; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#1a1026'; ctx.beginPath(); ctx.ellipse(0, -6, 8, 9, 0, 0, 6.2832); ctx.fill();
  ctx.fillStyle = glow; circ(-3, -6, 1.9); ctx.fill(); circ(3, -6, 1.9); ctx.fill();
  ctx.strokeStyle = '#c9a86a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(18, 16); ctx.lineTo(18, -16); ctx.stroke();
  ctx.fillStyle = glow; circ(18, -19, 4 + Math.sin(now / 200) * 0.8); ctx.fill();
}
function flameBody(outer, inner, w = 1) {
  const fl = Math.sin(now / 90) * 1.6;
  ctx.fillStyle = outer; ctx.beginPath(); ctx.moveTo(0, -23 + fl); ctx.bezierCurveTo(11 * w, -10, 16 * w, 0, 12 * w, 9); ctx.quadraticCurveTo(0, 18, -12 * w, 9); ctx.bezierCurveTo(-16 * w, 0, -9 * w, -9, 0, -23 + fl); ctx.fill();
  ctx.fillStyle = inner; ctx.beginPath(); ctx.moveTo(0, -10 - fl); ctx.bezierCurveTo(6 * w, -3, 9 * w, 3, 6 * w, 9); ctx.quadraticCurveTo(0, 13, -6 * w, 9); ctx.bezierCurveTo(-9 * w, 3, -5 * w, -3, 0, -10 - fl); ctx.fill();
  ctx.fillStyle = '#3a1a10'; circ(-4, 2, 1.9); ctx.fill(); circ(4, 2, 1.9); ctx.fill();
}
function dragonHead(col, dark, eye) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-20, -12); ctx.lineTo(-12, -28); ctx.lineTo(-7, -16); ctx.lineTo(7, -16); ctx.lineTo(12, -28); ctx.lineTo(20, -12); ctx.lineTo(13, 8); ctx.lineTo(0, 13); ctx.lineTo(-13, 8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = eye; ctx.beginPath(); ctx.moveTo(-14, -9); ctx.lineTo(-4, -5); ctx.lineTo(-12, -2); ctx.moveTo(14, -9); ctx.lineTo(4, -5); ctx.lineTo(12, -2); ctx.fill();
  ctx.fillStyle = '#111'; circ(-8, -5.5, 1.6); ctx.fill(); circ(8, -5.5, 1.6); ctx.fill();
}
Object.assign(ENEMY, {
  beetle() { beetleBody('#2b3f8f', '#13204d', false); },
  stag() { ctx.save(); ctx.scale(1.15, 1.15); ctx.translate(0, 2); beetleBody('#7a3a1c', '#3a1a0c', true); ctx.restore(); },
  ghost() { ghostBody('#e8ecff', '#2a2a4a'); },
  lich() { ctx.save(); ctx.scale(1.15, 1.15); ctx.translate(0, 3); ghostBody('#b9a6ff', '#1c0f3a'); crown(-19); ctx.restore(); },
  shaman() { robeBody('#6b3fa0', '#3d2260', '#7dffa0'); },
  priest() {
    ctx.save(); ctx.scale(1.12, 1.12); ctx.translate(0, 2); robeBody('#e8e0c8', '#ffcf4a', '#ffe27a');
    ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.moveTo(-7, -19); ctx.lineTo(0, -31); ctx.lineTo(7, -19); ctx.closePath(); ctx.fill(); ctx.restore();
  },
  fire() { flameBody('#ff7a3c', '#ffd24a'); },
  ifrit() {
    ctx.save(); ctx.scale(1.2, 1.2); ctx.translate(0, 1); flameBody('#e8331c', '#ff9a3c', 1.1);
    ctx.fillStyle = '#3a1a10'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 6, -12); ctx.lineTo(d * 14, -24); ctx.lineTo(d * 10, -10); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  },
  drake() { ctx.save(); ctx.scale(0.85, 0.85); ctx.translate(0, 4); dragonHead('#4fae5a', '#1f5a28', '#ffe27a'); ctx.restore(); },
  vampire() {
    const f = Math.sin(now / 110) * 0.3;
    for (const d of [-1, 1]) { ctx.save(); ctx.scale(d, 1); ctx.rotate(f); ctx.fillStyle = '#3a1020'; ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(28, -18); ctx.lineTo(24, -2); ctx.lineTo(18, -6); ctx.lineTo(15, 4); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#7a1028'; ctx.beginPath(); ctx.moveTo(-13, 16); ctx.lineTo(-10, -2); ctx.lineTo(10, -2); ctx.lineTo(13, 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9dce8'; circ(0, -8, 10); ctx.fill();
    ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.moveTo(-10, -12); ctx.quadraticCurveTo(0, -24, 10, -12); ctx.lineTo(0, -15); ctx.closePath(); ctx.fill();
    eyes(0, -8, 4, 2.3, '#ff3a3a', '#300');
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(-2, 2); ctx.lineTo(-1, -2); ctx.moveTo(1, -2); ctx.lineTo(2, 2); ctx.lineTo(3, -2); ctx.fill();
  },
  bombking() {
    ctx.fillStyle = '#6fbf4a'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 10, -8); ctx.lineTo(d * 22, -14); ctx.lineTo(d * 12, -1); ctx.closePath(); ctx.fill(); }
    circ(0, -4, 13); ctx.fill(); ctx.strokeStyle = '#2e5a1e'; ctx.lineWidth = 2.5; ctx.stroke();
    eyes(0, -7, 5, 2.6, '#ffe27a', '#111');
    ctx.fillStyle = '#fff'; ctx.fillRect(-6, 1, 12, 4); ctx.strokeStyle = '#2e5a1e'; ctx.lineWidth = 1; for (let i = -3; i <= 3; i += 3) { ctx.beginPath(); ctx.moveTo(i, 1); ctx.lineTo(i, 5); ctx.stroke(); }
    crown(-16);
    ctx.save(); ctx.translate(15, 13); ctx.scale(0.45, 0.45); ENEMY.bomb(); ctx.restore();
  },
  titan() {
    ctx.save(); ctx.scale(1.18, 1.18); ctx.translate(0, 2);
    ctx.fillStyle = '#6f88a0'; rr(-16, -21, 32, 30, 5); ctx.fill(); ctx.strokeStyle = '#33465a'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#566e86'; ctx.fillRect(-16, -2, 12, 4); ctx.fillRect(4, 3, 12, 3); ctx.fillRect(-3, -21, 3, 8);
    ctx.fillStyle = 'rgba(120,230,255,' + (0.75 + 0.25 * Math.sin(now / 160)) + ')'; ctx.fillRect(-10, -12, 7, 4); ctx.fillRect(3, -12, 7, 4);
    crown(-21, '#cfd8e6'); ctx.restore();
  },
});
ENEMY.dragon = function () {
  dragonHead('#c93327', '#6b1410', '#ffe27a');
  ctx.fillStyle = '#ff7a3c'; ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(8, 3); ctx.lineTo(4, 11); ctx.lineTo(-4, 11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,' + (140 + 80 * Math.sin(now / 80) | 0) + ',60,.9)'; circ(-3, 7, 1.8); ctx.fill(); circ(3, 7, 1.8); ctx.fill();
};

function heroSprite(guard) {
  ctx.strokeStyle = '#eaf2fb'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(14, 10); ctx.lineTo(23, -12); ctx.stroke();
  ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(10, 5); ctx.lineTo(19, 9); ctx.stroke();
  ctx.fillStyle = '#3f7bd9'; rr(-11, 2, 22, 18, 6); ctx.fill(); ctx.fillStyle = '#ffcf4a'; ctx.fillRect(-11, 10, 22, 3);
  ctx.fillStyle = '#ffd9b3'; circ(0, -7, 11); ctx.fill();
  ctx.fillStyle = '#d7dde6'; ctx.beginPath(); ctx.arc(0, -8, 12, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(12, -8); ctx.lineTo(-12, -8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.moveTo(0, -19); ctx.quadraticCurveTo(10, -30, 14, -20); ctx.quadraticCurveTo(7, -22, 3, -17); ctx.fill();
  ctx.fillStyle = '#1a1a26'; circ(-4, -4, 1.8); ctx.fill(); circ(4, -4, 1.8); ctx.fill();
  if (guard) { ctx.strokeStyle = 'rgba(143,220,255,.75)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 2, 25, -2.6, -0.5); ctx.stroke(); }
}

function drawTile(t, x, y, th) {
  if (t._born && now < t._born) return;
  let k = 1; if (t._born) { const p = Math.min(1, (now - t._born) / 190); k = p < 1 ? 1 + 0.35 * Math.sin(p * Math.PI) - (1 - p) * 0.9 : 1; if (k < 0.05) k = 0.05; }
  let [cx, cy] = C(x, y);
  if (t._shake && now < t._shake.until) { const m = t._shake.mag * Math.min(1, (t._shake.until - now) / 120) * s / 64; cx += (Math.random() * 2 - 1) * m; cy += (Math.random() * 2 - 1) * m * 0.5; }
  if (t._lunge) { const p = (now - t._lunge.t0) / t._lunge.ms; if (p < 1) { const a = Math.sin(p * Math.PI) * s * 0.4; cx += t._lunge.dx * a; cy += t._lunge.dy * a; } else t._lunge = null; }
  const u = s / 64, key = x + ',' + y, mark = pv && pv.marks[key], inPath = dragging && path.some(p => p[0] === x && p[1] === y);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(u * k, u * k);
  const en = t.k === 'enemy', acts = S.rules.enemyAct, danger = en && acts && t.cd <= 1;
  rr(-29.5, -29.5, 59, 59, 9);
  ctx.fillStyle = en ? (danger ? 'rgba(' + (120 + 50 * Math.sin(now / 130) | 0) + ',28,36,1)' : '#33203a') : th.cell; ctx.fill();
  if (t.boss) { ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2.5; ctx.stroke(); }
  else if (danger) { ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 2.5; ctx.stroke(); }
  else if (inPath) { ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2; ctx.stroke(); }
  if (en) {
    ctx.save(); ctx.translate(0, -4); if (mark === 'kill') ctx.globalAlpha = 0.45; else if (t.ghost && !danger && acts) ctx.globalAlpha = 0.55; ENEMY[t.type](); ctx.restore();
    if (acts) { // 攻撃までのターン数
      for (let i = 0; i < t.cdMax; i++) { ctx.fillStyle = i < t.cd ? (danger ? '#ff5a5a' : '#ffb347') : 'rgba(255,255,255,.14)'; circ(-23 + i * 8, -23, 3); ctx.fill(); }
      if (danger) txt('!', 22, -20, 17, '#ff5a5a');
    }
    if (t.armor) txt('鎧' + t.armor, 13, -21, t.armor > 99 ? 9 : 11, '#cfd8e6', 'center', '#0b0b12', 3);
    // 攻撃力（左・赤）とHP（右・白）
    ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.moveTo(-26, 26); ctx.lineTo(-22, 15); ctx.lineTo(-18, 26); ctx.closePath(); ctx.fill();
    txt(String(t.atk), -16, 21, t.atk > 99 ? 12 : 14, '#ff8f8f', 'left');
    txt(String(Math.max(0, t.hp)), 26, 20, t.hp > 999 ? 12 : t.hp > 99 ? 14 : 17, '#fff', 'right');
    if (t.heal || t.healAll) txt('+', -22, 2, 14, '#7dffa0'); if (t.pierce) txt('貫', -21, 2, 11, '#8fdcff', 'center', '#0b0b12', 3);
    if (mark === 'kill') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-18, -18); ctx.lineTo(18, 14); ctx.moveTo(18, -18); ctx.lineTo(-18, 14); ctx.stroke(); }
    else if (mark === 'hurt') { ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3; circ(0, -4, 22); ctx.stroke(); }
  } else {
    ICON[t.k]();
    const h = S.hero, v = t.k === 'sword' ? h.swordPow : t.k === 'coin' ? HH.coinValue(S) : t.k === 'shield' ? h.shieldPow : 0;
    if (v > 1) txt('+' + v, 25, 21, 13, KCOL[t.k], 'right');
  }
  ctx.restore();
}

function drawHero() {
  const h = S.hero, u = s / 64, bob = Math.sin(now / 300) * 1.5;
  const cx = (fx.hv.x + 0.5 + fx.off.x) * s, cy = (fx.hv.y + 0.5 + fx.off.y) * s;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(u, u);
  if (!busy && !dragging && S.phase === 'play') { const p = (now / 900) % 1; ctx.strokeStyle = 'rgba(255,226,122,' + (0.7 * (1 - p)) + ')'; ctx.lineWidth = 3; circ(0, 0, 20 + p * 14); ctx.stroke(); }
  if (now - fx.hurtT < 260 && Math.floor(now / 40) % 2) ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 23, 15, 4.5, 0, 0, 6.2832); ctx.fill();
  ctx.translate(0, bob); heroSprite(h.guard > 0);
  ctx.restore();
  const pool = dragging && pv ? pv.pool : null;
  if (pool != null && path.length) {
    let bx, by;
    const l = path[path.length - 1], lt = S.grid[l[1]][l[0]], en = lt && lt.k === 'enemy' && pv.bump;
    const q = en && path.length > 1 ? path[path.length - 2] : en ? [h.x, h.y] : l;[bx, by] = C(q[0], q[1]); by -= s * 0.62;
    by = Math.max(by, 14 * u + 2);
    const used = pv.kills || (pv.bump && pv.bump.dmg), label = (used ? '残り ' : '力 ') + pool;
    const w = (used ? 72 : 58) * u, hh = 24 * u; bx = Math.max(w / 2 + 2, Math.min(GW * s - w / 2 - 2, bx));
    rr(bx - w / 2, by - hh / 2, w, hh, 8 * u); ctx.fillStyle = '#ffe27a'; ctx.fill(); ctx.strokeStyle = '#12121a'; ctx.lineWidth = 2; ctx.stroke();
    txt(label, bx, by + 1, 15 * u, '#12121a', 'center', null);
  }
}

function drawPath() {
  if (!dragging || !path.length) return;
  const h = S.hero, pts = [C(h.x, h.y)].concat(path.map(p => C(p[0], p[1])));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, c] of [[s * 0.2, 'rgba(10,10,18,.75)'], [s * 0.11, '#ffe27a']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
  if (pv && pv.bump && pv.bump.dmg > 0) { const [x, y] = C(pv.bump.x, pv.bump.y); txt('-' + pv.bump.dmg, x, y - s * 0.05, s * 0.34, '#ffb347'); }
}

let overlayOpen = false;
function guideVisible() {
  if (!S.tut || busy || dragging || screen !== 'game' || overlayOpen || S.phase !== 'play') return false;
  return S.mode === 'lesson' || !meta.lessons.includes('l1');
}
function drawTut() {
  if (!guideVisible()) return;
  const h = S.hero, pts = [C(h.x, h.y)].concat(S.tut.map(p => C(p[0], p[1])));
  const T = 2200, p = (now % T) / T, q = Math.min(1, p / 0.75) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(q)), f = q - i;
  ctx.strokeStyle = 'rgba(255,226,122,.5)'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([s * 0.02, s * 0.2]);
  ctx.beginPath(); pts.forEach((pt, j) => j ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])); ctx.stroke(); ctx.setLineDash([]);
  const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
  ctx.fillStyle = 'rgba(255,255,255,' + (p > 0.85 ? (1 - p) / 0.15 * 0.8 : 0.8) + ')'; circ(x, y, s * 0.17); ctx.fill();
  ctx.strokeStyle = 'rgba(255,226,122,.9)'; ctx.lineWidth = 3; circ(x, y, s * 0.24); ctx.stroke();
}

function theme() { return S.mode === 'lesson' ? LESSON_THEME : THEMES[Math.min(HH.chapterOf(S.floor), THEMES.length - 1)]; }
// 描画ループ。1フレームで例外が起きても、次のフレームは必ず予約する(画面が固まらないように)。
function frame(t) {
  requestAnimationFrame(frame);
  try { drawFrame(t); } catch (e) { if (!frame.warned) { frame.warned = true; console.error(e); } }
}
function drawFrame(t) {
  now = t;
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i], p = Math.min(1, (performance.now() - w.t0) / w.ms); w.obj[w.key] = w.from + (w.to - w.from) * p; if (p >= 1) { tweens.splice(i, 1); w.res(); } }
  const th = theme(), W = GW * s, H = GH * s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (fx.shake > 0.3) { ctx.translate(fx.shake > 4 ? (Math.random() * 2 - 1) * fx.shake * 0.7 : 0, (Math.random() * 2 - 1) * fx.shake); fx.shake *= 0.86; } else fx.shake = 0;
  // 空きマスもうっすら描いて、盤面のマス目が分かるようにする
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  eachCell((x, y) => { if (!S.grid[y][x]) { rr(x * s + s * 0.04, y * s + s * 0.04, s * 0.92, s * 0.92, s * 0.14); ctx.fill(); } });
  eachCell((x, y) => { const tl = S.grid[y][x]; if (tl) drawTile(tl, x, y, th); });
  drawTut(); drawPath(); drawHero();
  for (let i = fx.marks.length - 1; i >= 0; i--) {
    const m = fx.marks[i], p = (now - m.t0) / 170; if (p >= 1) { fx.marks.splice(i, 1); continue; }
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot);
    for (const [lw, c] of [[7, '#12121a'], [3.5, m.color]]) {
      ctx.strokeStyle = c; ctx.lineWidth = lw * (1 - p * 0.6); ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, r0 = m.r * (0.25 + p * 0.5), r1 = m.r * (0.55 + p * 0.6) * (k % 2 ? 0.7 : 1); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,' + (1 - p) + ')'; ctx.lineWidth = 3; circ(0, 0, m.r * (0.3 + p * 0.7)); ctx.stroke(); ctx.restore();
  }
  for (let i = fx.parts.length - 1; i >= 0; i--) {
    const q = fx.parts[i]; q.x += q.vx; q.y += q.vy; q.vy += q.g; q.vx *= 0.96; q.life -= q.d; if (q.life <= 0) { fx.parts.splice(i, 1); continue; }
    ctx.fillStyle = q.color; ctx.globalAlpha = Math.min(1, q.life * 1.6); const z = q.size * (0.4 + q.life * 0.6) * s / 64; ctx.fillRect(q.x - z / 2, q.y - z / 2, z, z);
  }
  ctx.globalAlpha = 1;
  for (let i = fx.floats.length - 1; i >= 0; i--) {
    const f = fx.floats[i]; f.y += f.vy; f.vy *= 0.94; f.life -= 0.018; if (f.life <= 0) { fx.floats.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, f.life * 2.2); const z = f.size * s / 64 * (f.life > 0.9 ? 1 + (f.life - 0.9) * 5 : 1);
    txt(f.text, Math.max(z * f.text.length * 0.3, Math.min(W - z * f.text.length * 0.3, f.x)), Math.max(z, f.y), z, f.color);
  }
  ctx.globalAlpha = 1; ctx.restore();
  if (fx.flash) { ctx.fillStyle = 'rgba(' + fx.flash.c + ',' + fx.flash.a + ')'; ctx.fillRect(0, 0, W, H); fx.flash.a *= 0.8; if (fx.flash.a < 0.02) fx.flash = null; }
  if (fx.fade > 0.01) { ctx.fillStyle = 'rgba(5,5,10,' + fx.fade + ')'; ctx.fillRect(0, 0, W, H); }
  hud();
}

// ---------- アイコン(説明画面・HUD 用に、盤面と同じ絵を画像にする) ----------
const IMG = {};
function makeIcon(draw, size = 96, zoom = 1.35) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), keep = ctx; ctx = g;
  try { g.translate(size / 2, size / 2 + 2); g.scale(zoom * size / 96, zoom * size / 96); draw(); } catch (e) { } finally { ctx = keep; }
  return c.toDataURL();
}
function buildIcons() {
  for (const k of Object.keys(ICON)) IMG[k] = makeIcon(ICON[k]);
  for (const k of Object.keys(ENEMY)) IMG[k] = makeIcon(() => { ctx.translate(0, -2); ENEMY[k](); });
  IMG.hero = makeIcon(() => heroSprite(false));
  IMG.heroBig = makeIcon(() => heroSprite(false), 240, 1.6);
}
const ic = k => '<img class="ic" src="' + IMG[k] + '" alt="">';

// ---------------------------------------------------------------------
// HUD と、盤面の下の案内
// ---------------------------------------------------------------------
let hudSig = '', depthSig = '';
function lessonIndex(id) { return LESSONS.findIndex(l => l.id === id); }
function goalText() {
  const L = S.lesson; if (!L) return '';
  if (L.goal === 'stairs') return S.stairs ? '光る階段までなぞろう' : '敵をあと' + Math.max(0, S.quota - S.kills) + '体倒して、階段を出そう';
  if (L.goal === 'killAll') { const n = HH.countEnemies(S); return L.goalText + (n > 1 && !L.requireKill ? '（あと' + n + '体）' : ''); }
  return L.goalText;
}
function hud() {
  const h = S.hero, lesson = S.mode === 'lesson';
  let left = '';
  if (!lesson) left = HH.isBossFloor(S.floor) ? (S.bossDead ? '階段へ' : 'ボスを倒せ') : (S.stairs ? '階段へ' : 'あと' + Math.max(0, S.quota - S.kills) + '体');
  else if (S.lesson.goal === 'stairs') left = S.stairs ? '階段へ' : 'あと' + Math.max(0, S.quota - S.kills) + '体';
  const sig = [S.mode, S.lessonId, S.floor, left, h.hp, h.maxhp, h.guard, h.lv, h.exp, h.next, h.atk, h.gold, h.swordPow, lesson ? goalText() : ''].join('|');
  if (sig !== hudSig) {
    hudSig = sig;
    $('floorName').textContent = lesson ? 'レッスン' + (lessonIndex(S.lessonId) + 1) + '　' + S.lesson.title : floorLabel(S.floor) + '　' + HH.chapterInfo(S.floor).name;
    $('quota').textContent = left; $('quota').hidden = !left; $('quota').className = /階段/.test(left) ? 'go' : '';
    $('hpFill').style.width = (h.hp / h.maxhp * 100) + '%'; $('hpFill').className = h.hp <= h.maxhp * 0.3 ? 'low' : '';
    $('hpTxt').textContent = 'HP ' + h.hp + ' / ' + h.maxhp;
    $('guard').innerHTML = ic('shield') + '<span>' + h.guard + '</span>'; $('guard').className = h.guard ? 'on' : '';
    $('lv').textContent = 'Lv' + h.lv; $('expFill').style.width = (h.exp / h.next * 100) + '%'; $('expTxt').textContent = '次のLvまで ' + (h.next - h.exp);
    $('atk').innerHTML = ic('sword') + '<span>' + h.atk + (h.swordPow > 1 ? '<small style="opacity:.7">（剣+' + h.swordPow + '）</small>' : '') + '</span>';
    $('gold').innerHTML = ic('coin') + '<span>' + h.gold + '</span>';
    if (lesson) $('goalTxt').textContent = '目標：' + goalText();
    document.body.style.background = theme().bg;
  }
  const dsig = lesson ? 'L' : String(S.floor);
  if (depthSig !== dsig) {
    depthSig = dsig; let o = '';
    if (lesson) o = '';
    else if (S.floor <= LAST_FLOOR) { // 今の章の10階ぶん(最後がボス)
      const c = HH.chapterOf(S.floor), f0 = c * HH.CH_LEN + 1;
      o = '<b class="ch">第' + (c + 1) + '章</b>';
      for (let f = f0; f < f0 + HH.CH_LEN; f++) o += '<i class="' + (f < S.floor ? 'done' : f === S.floor ? 'cur' : '') + (HH.isBossFloor(f) ? ' boss' : '') + '"></i>';
    } else o = '<span>深淵 ' + S.floor + '階　どこまで行ける？</span>';
    $('depth').innerHTML = o; $('depth').hidden = lesson; $('goal').hidden = !lesson;
  }
  if (infoDirty) { infoDirty = false; $('info').innerHTML = infoHtml(); }
}
function infoHtml() {
  if (busy && fx.pool != null) return '<b class="pw big">力 ' + fx.pool + '</b>';
  if (S.phase !== 'play') return '';
  if (dragging && pv) {
    const R = pv;
    if (!path.length) return '<span class="hint">となりのマスへ指をすべらせよう。剣を拾うと力がたまる</span>';
    const used = R.kills || (R.bump && R.bump.dmg);
    const o = ['<b class="pw">力 ' + (used ? R.total + '<small style="opacity:.75">（残り' + R.pool + '）</small>' : R.pool) + '</b>'];
    if (R.stairs) return o.concat('<b class="ok">次の階へ進む</b>').join('');
    if (R.kills) o.push('<b class="kl">' + R.kills + '体たおす' + (R.kills > 1 ? '（連撃）' : '') + '</b>');
    if (R.bump && R.bump.dmg) o.push('<b class="kl">' + R.bump.dmg + 'ダメージ（ここで止まる）</b>');
    if (R.heal) o.push('<span class="hl">HP+' + R.heal + '</span>');
    if (R.guardGain) o.push('<span class="gu">ガード+' + R.guardGain + '</span>');
    if (R.gold) o.push('<span class="gd">+' + R.gold + 'G</span>');
    if (S.rules.enemyAct) o.push('<b class="' + (R.taken ? 'bad' : 'ok') + '">' + (R.incoming ? (R.taken ? 'このあと ' + R.taken + 'ダメージ' : '攻撃はガードで防げる') : '敵の攻撃なし') + '</b>');
    if (dragWarn) o.push('<span class="warn">' + dragWarn + '</span>');
    else o.push('<span class="sub">指をはなすと実行 ・ 来た道を戻ると取り消し</span>');
    return o.join('');
  }
  const R = HH.sim(S, []);
  if (S.mode === 'stage' && !HH.hasMove(S)) return '<span class="warn">どこにも進めない。勇者をタップすると、その場でひと休み（1ターン進む）</span>';
  return '<span class="hint">' + (fx.hint || '') + '</span>' + (R.incoming ? '<b class="' + (R.taken ? 'bad' : 'ok') + '">次の敵の攻撃 ' + R.incoming + (S.hero.guard ? '（ガード後 ' + R.taken + '）' : '') + '</b>' : '');
}

// ---------- 長押し・タップでの説明 ----------
let tipT = 0;
function showTip(x, y, extra) {
  const t = S.grid[y] && S.grid[y][x], h = S.hero; let html;
  if (x === h.x && y === h.y) {
    html = '<img src="' + IMG.hero + '"><div><h4>勇者　Lv' + h.lv + '</h4><div class="st">HP ' + h.hp + '/' + h.maxhp + ' ・ こうげき力 ' + h.atk + ' ・ ガード ' + h.guard + '</div>なぞり始めの力＝こうげき力。剣1本で力 +' + h.swordPow + '。</div>';
  } else if (t && t.k === 'enemy') {
    const turns = S.rules.enemyAct ? (t.cd <= 1 ? '<b style="color:#ff6b6b;font-weight:normal">このターンの終わりに攻撃！</b>' : 'あと' + t.cd + 'ターンで攻撃') : '攻撃してこない';
    html = '<img src="' + IMG[t.type] + '"><div><h4>' + t.name + (t.boss ? '（ボス）' : '') + '</h4><div class="st">HP ' + t.hp + '/' + t.maxhp + ' ・ 攻撃力 ' + t.atk + (t.armor ? ' ・ 鎧 ' + t.armor : '') + ' ・ ' + turns + '</div>' + ENEMY_INFO[t.type](t) + '</div>';
  } else if (t) {
    html = '<img src="' + IMG[t.k] + '"><div><h4>' + TILE_NAME[t.k] + '</h4>' + TILE_INFO[t.k](h) + (extra ? '<div class="st">' + extra + '</div>' : '') + '</div>';
  } else return;
  const el = $('tip'); el.innerHTML = html; el.hidden = false;
  clearTimeout(tipT); tipT = setTimeout(hideTip, 4000);
}
function hideTip() { $('tip').hidden = true; clearTimeout(tipT); }

// ---------------------------------------------------------------------
// 入力
// ---------------------------------------------------------------------
function cellAt(e) {
  const r = cv.getBoundingClientRect(), gx = (e.clientX - r.left) / r.width * GW, gy = (e.clientY - r.top) / r.height * GH;
  const x = Math.floor(gx), y = Math.floor(gy);
  return { x, y, near: Math.hypot(gx - x - 0.5, gy - y - 0.5) < 0.46 };
}
function setPath(p) { path = p; pv = dragging ? HH.sim(S, path) : null; infoDirty = true; }
let press = null;
cv.addEventListener('pointerdown', e => {
  ac(); hideTip();
  if (busy || S.phase !== 'play' || screen !== 'game' || overlayOpen) return;
  e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) { }
  const c = cellAt(e), h = S.hero; dragWarn = '';
  clearTimeout(press && press.timer); press = { x: e.clientX, y: e.clientY, timer: 0 };
  const isHero = c.x === h.x && c.y === h.y;
  if (isHero || HH.canAdd(S, [], c.x, c.y)) {
    dragging = true; setPath(isHero ? [] : [[c.x, c.y]]); if (!isHero) sfx.tick(0);
    // 長押し(指を動かさずに少し待つ)で、そのマスの説明を出す。なぞりは取り消す。
    press.timer = setTimeout(() => {
      if (!dragging || path.length > (isHero ? 0 : 1)) return;
      dragging = false; setPath([]); showTip(c.x, c.y); buzz('light');
    }, 450);
  } else if (c.x >= 0 && c.y >= 0 && c.x < GW && c.y < GH && S.grid[c.y][c.x]) {
    showTip(c.x, c.y, 'なぞりは勇者（光る輪）から始めよう');
  }
});
cv.addEventListener('pointermove', e => {
  if (press && press.timer && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) { clearTimeout(press.timer); press.timer = 0; }
  if (!dragging) return; e.preventDefault();
  const c = cellAt(e), h = S.hero, n = path.length; if (!c.near) return;
  const back = n >= 2 ? path[n - 2] : [h.x, h.y];
  if (n && c.x === back[0] && c.y === back[1]) { dragWarn = ''; setPath(path.slice(0, -1)); sfx.tick(Math.max(0, n - 2)); return; }
  const last = n ? path[n - 1] : [h.x, h.y];
  if (c.x === last[0] && c.y === last[1]) return;
  const chk = HH.addCheck(S, path, c.x, c.y);
  if (chk.ok) { dragWarn = ''; setPath(path.concat([[c.x, c.y]])); sfx.tick(n); }
  else {
    const w = chk.why === 'armor' ? '力' + chk.pool + 'では鎧' + chk.armor + 'に届かない。剣を集めてから'
      : chk.why === 'ghost' ? 'ゴーストはすり抜ける。先に1体倒すか、赤く光るまで待とう'
      : chk.why === 'nopower' ? '力が0。剣を拾ってからぶつかろう'
        : chk.why === 'twice' ? '同じマスは2回通れない' : '';
    if (w && w !== dragWarn) { dragWarn = w; infoDirty = true; }
  }
});
function endDrag(go) {
  if (press) { clearTimeout(press.timer); press = null; }
  if (!dragging) return;
  dragging = false; const p = path; setPath([]); dragWarn = '';
  if (go && !p.length && S.mode === 'stage' && !HH.hasMove(S)) { // どこにも進めないときは、その場でひと休み(1ターン進める)
    toast('動けない…ひと休みした'); playTurn([]); return;
  }
  if (!go || !p.length) return;
  const L = S.mode === 'lesson' && S.lesson;
  if (L && L.requireKill && HH.sim(S, p).kills < L.requireKill) { // レッスン: 目的を果たせない線は実行しない
    fx.hint = L.requireHint; infoDirty = true; sfx.block(); buzz('light'); toast('もう一度！');
    return;
  }
  playTurn(p);
}
cv.addEventListener('pointerup', () => endDrag(true));
cv.addEventListener('pointercancel', () => endDrag(false));

// ---------------------------------------------------------------------
// 全画面パネル(タイトル・メニュー・休憩所など)
// ---------------------------------------------------------------------
let overlayFn = null, stack = [];
function overlay(html, solid) {
  const o = $('overlay'), keep = overlayFn === o._fn ? o.scrollTop : 0;
  o.className = solid ? 'solid' : ''; o.innerHTML = '<div class="box">' + html + '</div>';
  o.hidden = false; overlayOpen = true; o.scrollTop = keep; o._fn = overlayFn;
  hideTip(); if (dragging) endDrag(false);
}
function show(fn) { overlayFn = fn; fn(); }
function sub(fn) { stack.push(overlayFn); show(fn); }
function refresh() { if (overlayFn && overlayOpen) overlayFn(); }
function closeOverlay() { const o = $('overlay'); o.hidden = true; o.innerHTML = ''; overlayOpen = false; overlayFn = null; o._fn = null; stack = []; infoDirty = true; }
function back() { const prev = stack.pop(); if (prev) show(prev); else resumeGame(); }
// パネルを閉じて盤面に戻る。休憩所や力尽きた画面の途中なら、その画面に戻す。
function resumeGame() {
  closeOverlay();
  if (screen !== 'game') { show(showTitle); return; }
  const p = S.phase;
  if (p === 'rest') show(showRest); else if (p === 'win') show(showWin); else if (p === 'dead') show(showDead);
  else if (p === 'lessonClear') show(showLessonClear); else if (p === 'lessonFail') show(showLessonFail);
  else if (enemyQueue.length) show(showEnemyCard);
}

function statLine() {
  return '<p class="rec">倒した敵 ' + S.stats.kills + '体　最大 ' + S.stats.bestCombo + '連撃　' + S.stats.turns + 'ターン</p>';
}
function recordBest() { if (S.mode === 'stage' && S.floor > meta.best) { meta.best = S.floor; saveMeta(); track('user_props', { bestFloor: meta.best, clears: meta.clears }); } }

// ---- タイトル ----
function showTitle() {
  screen = 'title'; stack = []; updateMusic();
  const run = loadRun(), done = LESSONS.filter(l => meta.lessons.includes(l.id)).length, total = LESSONS.length;
  const fresh = !done && !run && !meta.runs;
  let o = '<img src="' + IMG.heroBig + '" alt="" style="width:110px;height:110px;margin:0 auto -6px"><h1>ひとふで勇者</h1>' +
    '<p class="lead">ひと筆でなぞって、剣を集めて、敵を斬る。<br>10階ごとに変わる敵を越え、地下100階の魔竜を倒せ。</p>';
  if (fresh) {
    o += '<button class="btn main" data-act="lessonIntro:l1">チュートリアルではじめる<small>まずは1本の線で敵を倒してみよう</small></button>' +
      '<button class="btn" data-act="stageNew">ステージモード<small>ルールを知っている人向け</small></button>';
  } else {
    if (run && run.phase !== 'win') o += '<button class="btn main" data-act="stageContinue">つづきから<small>' + floorLabel(run.floor) + '（' + HH.chapterInfo(run.floor).name + '）・ Lv' + run.hero.lv + '</small></button>';
    o += '<button class="btn' + (run && run.phase !== 'win' ? '' : ' main') + '" data-act="stageNew">ステージモード' + (run && run.phase !== 'win' ? '（はじめから）' : '') + '<small>ローグライク ・ 全10章・地下100階をめざす</small></button>';
    o += '<button class="btn" data-act="lessons">チュートリアル' + (done < total ? '<span class="badge">' + done + ' / ' + total + '</span>' : ' ✓') + '<small>遊び方とギミックを体験</small></button>';
  }
  if (meta.best) o += '<p class="rec">最深記録：' + floorLabel(meta.best) + (meta.clears ? '　魔竜討伐 ' + meta.clears + '回' : '') + '</p>';
  o += '<div class="btns2"><button class="btn ghost" data-act="help">遊び方</button><button class="btn ghost" data-act="settings">設定</button></div>';
  overlay(o, true);
}

// ---- チュートリアル ----
function showLessons() {
  screen = 'title'; updateMusic();
  const nextId = (LESSONS.find(l => !meta.lessons.includes(l.id)) || {}).id;
  let o = '<h2>チュートリアル</h2><p class="note">短いレッスンで、遊び方とギミックを体験しよう。<br>どのレッスンからでも、何度でも遊べます。</p><div class="lessons">';
  LESSONS.forEach((l, i) => {
    const d = meta.lessons.includes(l.id);
    o += '<button class="' + (d ? 'done' : '') + (l.id === nextId ? ' next' : '') + '" data-act="lessonIntro:' + l.id + '"><span class="no">' + (d ? '✓' : i + 1) + '</span><span><b>' + l.title + '</b><small>' + l.sub + '</small></span></button>';
  });
  o += '</div>';
  if (!nextId) o += '<button class="btn main" data-act="stageNew">ステージモードへ</button>';
  o += '<button class="btn ghost" data-act="toTitle">タイトルへ</button>';
  overlay(o, true);
}
let introId = 'l1';
function showLessonIntro() {
  const L = LESSONS.find(l => l.id === introId), i = lessonIndex(introId);
  let o = '<p class="rec">レッスン ' + (i + 1) + ' / ' + LESSONS.length + '</p><h2>' + L.title + '</h2>';
  if (L.enemyIntro) {
    const sp = Object.values(L.legend).find(e => e.type === L.enemyIntro), e = Object.assign({ name: HH.ENAME[L.enemyIntro], cdMax: 3 }, sp);
    o += '<div class="enemycard"><img src="' + IMG[L.enemyIntro] + '"><div><b>' + e.name + '</b><p>' + ENEMY_INFO[L.enemyIntro](e) + '</p></div></div>';
  }
  o += '<div class="intro">' + L.intro.map(t => '<p><span>' + t + '</span></p>').join('') + '</div>' +
    '<p class="note">マスを長押しすると、いつでも説明が見られます。</p>' +
    '<button class="btn main" data-act="lessonStart:' + L.id + '">やってみる</button>' +
    '<button class="btn ghost" data-act="lessons">レッスン一覧へ</button>';
  overlay(o, true);
}
function startLesson(id) {
  S = HH.newLesson(id); screen = 'game'; ad.fail = null;
  const L = S.lesson;
  eachCell((x, y) => { const t = S.grid[y][x]; if (t && t.k === 'enemy' && !meta.seen.includes(t.type)) meta.seen.push(t.type); });
  saveMeta(); closeOverlay(); layout();
  enterBoard('レッスン' + (lessonIndex(id) + 1), L.title);
  fx.hint = L.hints ? L.hints[0] : ''; infoDirty = true;
  track('lesson_start', { lesson: id });
}
function completeLesson(id) {
  if (!meta.lessons.includes(id)) meta.lessons.push(id);
  track('lesson_clear', { lesson: id });
  if (!meta.tutDone && LESSONS.every(l => meta.lessons.includes(l.id))) { meta.tutDone = true; track('tutorial_complete', {}); }
  saveMeta();
}
function showLessonClear() {
  const L = S.lesson, i = lessonIndex(L.id), next = LESSONS[i + 1];
  let o = '<h2 class="win">クリア！</h2><p class="rec">レッスン' + (i + 1) + '　' + L.title + '</p><div class="intro"><p><span>' + L.clear + '</span></p></div>';
  if (next) o += '<button class="btn main" data-act="lessonIntro:' + next.id + '">次のレッスンへ<small>' + next.title + '</small></button>';
  else o += '<button class="btn main" data-act="stageNew">ステージモードへ<small>全10章・地下100階をめざす</small></button>';
  o += '<div class="btns2"><button class="btn ghost" data-act="lessonStart:' + L.id + '">もう一度</button><button class="btn ghost" data-act="lessons">レッスン一覧</button></div>';
  overlay(o);
}
function showLessonFail() {
  overlay('<h2 class="bad">やられてしまった…</h2><p class="lead">赤く光った敵は、このターンの終わりに攻撃してきます。<br>盾を拾ったり、先に倒したりして身を守ろう。</p>' +
    '<button class="btn main" data-act="lessonStart:' + S.lessonId + '">もう一度</button><button class="btn ghost" data-act="lessons">レッスン一覧</button>');
}

// ---- ステージモード ----
function stageNew() {
  const run = loadRun();
  if (run && run.phase !== 'win') { sub(() => overlay('<h2>はじめから？</h2><p class="lead">いまの冒険（' + floorLabel(run.floor) + '）は消えてしまいます。</p>' +
    '<button class="btn main" data-act="stageNewForce">はじめから遊ぶ</button><button class="btn ghost" data-act="back">やめる</button>', true)); return; }
  startStage();
}
function startStage() {
  S = HH.newGame(); screen = 'game'; ad.fail = null; meta.runs++; saveMeta();
  closeOverlay(); layout(); enterFloor(); saveRun();
  track('run_start', { floor: 1, clears: meta.clears });
}
function continueStage() {
  const run = loadRun(); if (!run) { show(showTitle); return; }
  S = run; screen = 'game'; ad.fail = null; closeOverlay(); layout();
  enterBoard(S.phase === 'play' ? floorLabel(S.floor) : '', S.phase === 'play' ? 'つづきから' : '');
  fx.hint = floorHint(S.floor); infoDirty = true;
  if (S.phase !== 'play') { fx.fade = 0.6; resumeGame(); }
}
function enterBoard(title, sub) {
  const h = S.hero; fx.hv.x = h.x; fx.hv.y = h.y; fx.off.x = fx.off.y = 0; fx.parts.length = 0; fx.floats.length = 0; fx.marks.length = 0;
  fx.pool = null; fx.flash = null; dragging = false; path = []; pv = null; dragWarn = ''; hideTip();
  let i = 0; eachCell((x, y) => { const t = S.grid[y][x]; if (t) t._born = performance.now() + 120 + (i++) * 9; });
  hudSig = ''; depthSig = ''; infoDirty = true;
  fx.fade = 1; tween(fx, 'fade', 0, 300);
  if (title) banner(title, sub);
  updateMusic();
}
function enterFloor() {
  const boss = HH.findBoss(S);
  const ch = HH.chapterInfo(S.floor), first = HH.floorInChapter(S.floor) === 0;
  if (first && S.floor <= LAST_FLOOR) enterBoard('第' + (HH.chapterOf(S.floor) + 1) + '章　' + ch.name, floorLabel(S.floor) + '〜' + (S.floor + HH.CH_LEN - 1) + '階');
  else enterBoard(floorLabel(S.floor), boss ? 'ボス：' + boss.name : ch.name);
  fx.hint = floorHint(S.floor); infoDirty = true;
  recordBest(); checkNewEnemies();
}
// はじめて出会う敵は、軽い説明カードを出す(ステージモードのみ。一度見たら出さない)
let enemyQueue = [];
function checkNewEnemies() {
  if (S.mode !== 'stage' || S.phase !== 'play') return;
  eachCell((x, y) => { const t = S.grid[y][x]; if (t && t.k === 'enemy' && !meta.seen.includes(t.type)) { meta.seen.push(t.type); enemyQueue.push(t); } });
  if (!enemyQueue.length) return;
  saveMeta(); if (!overlayOpen) show(showEnemyCard);
}
function showEnemyCard() {
  const e = enemyQueue[0]; if (!e) { closeOverlay(); return; }
  overlay('<p class="rec">' + (e.boss ? 'ボスがあらわれた！' : 'はじめて出会う敵') + '</p><div class="enemycard"><img src="' + IMG[e.type] + '"><div><b>' + e.name + '</b><p>' + ENEMY_INFO[e.type](e) + '</p></div></div>' +
    '<p class="note">左下の赤い数字＝攻撃力、右下の白い数字＝HP、上の点＝攻撃までのターン数。<br>マスを長押しすると、いつでも説明が見られます。</p>' +
    '<button class="btn main" data-act="enemyOk">わかった</button>');
}
function showRest() {
  const h = S.hero, sc = HH.smithCost(S), pc = HH.potionCost(S), T = HH.tierOf(S.floor);
  let o = '<h2>' + floorLabel(S.floor) + ' 突破！</h2>' + (HH.isBossFloor(S.floor) && S.floor < LAST_FLOOR ? '<p class="rec">第' + (HH.chapterOf(S.floor) + 1) + '章クリア！ 次は「' + HH.chapterInfo(S.floor + 1).name + '」</p>' : '') +
    '<div class="statline"><span>HP ' + h.hp + '/' + h.maxhp + '</span><span>' + ic('sword') + 'こうげき ' + h.atk + '</span><span>' + ic('coin') + h.gold + 'G</span></div>' +
    '<h3>ショップ<small>コインで買える</small></h3><div class="shop">' +
    '<button data-act="buy:potion"' + (h.gold < pc || h.hp >= h.maxhp ? ' disabled' : '') + '><b>薬草</b><small>' + (h.hp >= h.maxhp ? 'HPは満タン' : 'HPを半分回復') + '</small><i>' + pc + 'G</i></button>' +
    '<button data-act="buy:smith"' + (h.gold < sc ? ' disabled' : '') + '><b>鍛冶</b><small>こうげき力 +' + HH.smithGain(S) + '</small><i>' + sc + 'G</i></button></div>' +
    '<h3>祝福をひとつ選ぶ<small>' + (S.extraPick ? '広告の特典：2つ選べます' : S.blessingAdUsed ? 'もう1つ選ぶと次の階へ' : '選ぶと次の階へ進みます') + '</small></h3><div class="cards">';
  for (const id of S.offers) {
    const c = CARDS.find(c => c.id === id), n = h.cards[id] || 0;
    o += '<button data-act="card:' + id + '"><em>' + c.ch + '</em><span><b>' + c.name + (n ? '<span class="lv">（' + (n + 1) + 'つ目）</span>' : '') + '</b><small>' + c.desc(T) + '</small></span></button>';
  }
  o += '</div>';
  if (adsSupported() && !S.blessingAdUsed && S.offers.length >= 2 && adLeft() > 0) o += adButton('blessing', '広告を見て、祝福を2つ選ぶ', '選んだあと、残りからもう1つ');
  overlay(o);
}
function showDead() {
  const can = adsSupported() && S.reviveFloor !== S.floor && adLeft() > 0;
  let o = '<h2 class="bad">力尽きた…</h2><p class="lead">' + floorLabel(S.floor) + '</p>' + statLine();
  if (can) o += adButton('revive', '広告を見て、その場で復活', 'HP全回復・この階の続きから');
  else if (adsSupported() && S.reviveFloor === S.floor) o += '<p class="note">この階では、もう広告で復活できません。</p>';
  o += '<button class="btn main" data-act="retry"' + (ad.pending ? ' disabled' : '') + '>この階の最初からやり直す<small>HPを6割まで回復して、新しい盤面で再挑戦</small></button>' +
    '<button class="btn ghost" data-act="giveUp"' + (ad.pending ? ' disabled' : '') + '>あきらめてタイトルへ</button>';
  overlay(o);
}
function showWin() {
  if (!S.winCounted) {
    S.winCounted = true; meta.clears++; saveMeta(); saveRun(); sfx.win();
    track('game_clear', { clears: meta.clears }); recordBest();
    if (!meta.reviewAsked) { meta.reviewAsked = true; saveMeta(); setTimeout(() => post('requestReview', {}), 1500); }
  }
  overlay('<h2 class="win">魔竜を倒した！</h2><p class="lead">地下100階、踏破。おめでとう！</p>' + statLine() +
    '<button class="btn main" data-act="endless">さらに深くへ<small>終わりのない深淵に潜る</small></button><button class="btn ghost" data-act="finish">タイトルへ（冒険を終える）</button>');
}

// ---- メニュー・設定・遊び方 ----
function showMenu() {
  let o = '<h2>メニュー</h2><button class="btn main" data-act="resume">つづける</button>';
  if (S.mode === 'lesson') o += '<button class="btn" data-act="lessonStart:' + S.lessonId + '">このレッスンをやり直す</button><button class="btn" data-act="lessons">レッスン一覧</button>';
  o += '<div class="btns2"><button class="btn" data-act="help">遊び方</button><button class="btn" data-act="settings">設定</button></div>' +
    '<button class="btn ghost" data-act="toTitle">タイトルへ' + (S.mode === 'stage' ? '<small>冒険は自動で保存されます</small>' : '') + '</button>';
  overlay(o);
}
function showSettings() {
  const tog = (k, on) => '<button class="tog' + (on ? ' on' : '') + '" data-act="toggle:' + k + '">' + (on ? 'ON' : 'OFF') + '</button>';
  const vol = (k, label) => '<div class="it"><span>' + label + '</span><span class="val" id="v-' + k + '">' + (cfg[k] ? cfg[k] + '%' : 'OFF') + '</span></div>' +
    '<input type="range" min="0" max="100" step="5" data-set="' + k + '" value="' + cfg[k] + '" style="--v:' + cfg[k] + '%">';
  let o = '<h2>設定</h2><div class="set"><div class="sec">音</div>' + vol('bgm', 'BGM') + vol('se', '効果音');
  if (NATIVE) o += '<div class="sec">操作</div>' +
    '<div class="it"><span>振動<small>敵を倒したとき・ダメージを受けたとき</small></span>' + tog('haptic', cfg.haptic) + '</div>' +
    '<div class="it"><span>画面スリープ防止<small>遊んでいる間、画面を暗くしない</small></span>' + tog('sleep', cfg.sleep) + '</div>';
  o += '<div class="sec">その他</div>' +
    '<div class="it"><span>プライバシーポリシー</span><button class="tog" data-act="privacy">開く</button></div>';
  if (consentApplicable) o += '<div class="it"><span>広告の同意設定を管理<small>パーソナライズ広告への同意</small></span><button class="tog" data-act="consent">開く</button></div>';
  if (NATIVE) o += '<div class="it"><span>レビューを書く<small>感想をお聞かせください</small></span><button class="tog" data-act="review">開く</button></div>';
  o += '</div><button class="btn" data-act="back" style="margin-top:12px">閉じる</button><p class="ver">ひとふで勇者 ver ' + (window.hhAppVersion || 'web') + '</p>';
  overlay(o, screen !== 'game');
}
let helpTab = 'basic';
function showHelp() {
  const tabs = [['basic', '基本'], ['tiles', 'マス'], ['enemy', '敵'], ['stage', 'ステージ']];
  const gi = (img, html) => '<div class="gi">' + (img ? '<img src="' + IMG[img] + '">' : '') + '<div>' + html + '</div></div>';
  let body = '';
  if (helpTab === 'basic') body =
    gi('hero', '<b>勇者から指でなぞる</b>と道すじができ、指をはなすと一気に進みます。たて・よこ・ななめの8方向。同じマスは2回通れません。') +
    gi('sword', '<b>剣</b>を拾うと<b>力</b>がたまります。なぞり始めの力は「こうげき力」。力はそのターンかぎり。') +
    gi('slime', '敵にぶつかると力のぶんだけダメージ。<b>力がHP以上なら倒して</b>、残りの力で線を続けられます。足りなければ<b>削って止まります</b>。') +
    gi(null, '敵の上の<b>点</b>＝攻撃までのターン数。<b>赤く光ったら</b>このターンの終わりに攻撃が来ます。左下の赤い数字が攻撃力、右下の白い数字がHP。') +
    gi(null, 'なぞっている間、盤面の下に<b>結果の予想</b>（倒せる数・受けるダメージ）が出ます。来た道を戻ると取り消し、勇者まで戻せばキャンセル。') +
    gi(null, 'マスを<b>長押し</b>すると、敵やマスのくわしい説明が見られます。') +
    gi(null, 'まわりが触れない敵ばかりで<b>動けないとき</b>は、勇者をタップすると、その場でひと休み（1ターン進む）できます。');
  else if (helpTab === 'tiles') body = ['sword', 'heart', 'coin', 'shield', 'stairs', 'ash'].map(k => gi(k, '<b>' + TILE_NAME[k] + '</b>　' + TILE_INFO[k](S.hero))).join('');
  else if (helpTab === 'enemy') body = HH.CHAPTERS.map((ch, i) => {
    const e = HH.makeEnemy({ floor: i * HH.CH_LEN + 1, overtime: 0, seed: 1 }, ch.star), bo = HH.makeEnemy({ floor: (i + 1) * HH.CH_LEN, overtime: 0, seed: 1 }, ch.boss);
    return '<div class="sec2">第' + (i + 1) + '章　' + ch.name + '（地下' + (i * 10 + 1) + '〜' + (i * 10 + 10) + '階）</div>' +
      gi(ch.star, '<b>' + e.name + '</b>　' + ENEMY_INFO[ch.star](e)) + gi(ch.boss, '<b>' + bo.name + '</b>　' + ENEMY_INFO[ch.boss](bo));
  }).join('');
  else body =
    gi('stairs', '各階では<b>決められた数の敵</b>（右上の「あと○体」）を倒すと<b>階段</b>があらわれます。') +
    gi('king', '<b>10階で1章</b>。章ごとに景色と敵が変わり、新しい敵は<b>新しいコツ</b>を1つ持っています。章の最後（10の倍数の階）には<b>ボス</b>。ボスを倒すと階段が出ます。') +
    gi('coin', '階段をくだると<b>休憩所</b>。コインで薬草・鍛冶を買い、<b>祝福</b>（強化）をひとつ選んで次の階へ。') +
    gi(null, '<b>力尽きたら</b>、その階の最初からやり直せます（HPを6割まで回復）。広告を見れば、その場で復活もできます（1つの階で1回まで）。') +
    gi(null, '冒険は<b>自動で保存</b>されます。地下100階の魔竜を倒すと、終わりのない<b>深淵</b>（エンドレス）へ進めます。');
  overlay('<h2>遊び方</h2><div class="tabs">' + tabs.map(([k, n]) => '<button class="' + (k === helpTab ? 'on' : '') + '" data-act="tab:' + k + '">' + n + '</button>').join('') + '</div>' +
    '<div class="guide">' + body + '</div><button class="btn" data-act="back">閉じる</button>', screen !== 'game');
}

// ---- パネルのボタン ----
$('overlay').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return; ac(); sfx.ui();
  const [a, v] = b.dataset.act.split(':');
  switch (a) {
    case 'lessons': stack = []; show(showLessons); break;
    case 'lessonIntro': introId = v; stack = []; show(showLessonIntro); break;
    case 'lessonStart': startLesson(v); break;
    case 'stageNew': stageNew(); break;
    case 'stageNewForce': startStage(); break;
    case 'stageContinue': continueStage(); break;
    case 'help': sub(showHelp); break;
    case 'settings': sub(showSettings); break;
    case 'tab': helpTab = v; refresh(); break;
    case 'back': back(); break;
    case 'resume': resumeGame(); break;
    case 'toTitle': if (S.mode === 'stage' && screen === 'game') saveRun(); closeOverlay(); show(showTitle); break;
    case 'enemyOk': enemyQueue.shift(); if (enemyQueue.length) refresh(); else resumeGame(); break;
    case 'buy': if (HH.buy(S, v)) { sfx.heal(); saveRun(); refresh(); } break;
    case 'card': {
      const name = CARDS.find(c => c.id === v).name;
      if (S.phase !== 'rest' || !S.offers.includes(v)) break;
      if (HH.takeCard(S, v)) { saveRun(); toast(name + ' を受け取った'); refresh(); break; }
      HH.nextFloor(S); ad.fail = null; saveRun(); closeOverlay(); enterFloor(); break;
    }
    case 'retry': HH.retryFloor(S); ad.fail = null; saveRun(); closeOverlay(); enterFloor(); break;
    case 'giveUp': sub(() => overlay('<h2>あきらめる？</h2><p class="lead">この冒険は終了します。</p><button class="btn main" data-act="giveUpForce">タイトルへ</button><button class="btn ghost" data-act="back">やめる</button>')); break;
    case 'giveUpForce': recordBest(); clearRun(); closeOverlay(); show(showTitle); break;
    case 'endless': S.endless = true; S.phase = 'rest'; saveRun(); show(showRest); break;
    case 'finish': clearRun(); closeOverlay(); show(showTitle); break;
    case 'ad': requestAd(v); break;
    case 'toggle': {
      cfg[v] = !cfg[v]; store.set('hh-' + v, cfg[v] ? '1' : '0');
      if (v === 'sleep') post('settings', { sleep: cfg.sleep });
      if (v === 'haptic' && cfg.haptic) buzz('light');
      refresh(); break;
    }
    case 'privacy': post('openURL', { url: 'https://eik-awa.github.io/privacy_policy/' }); if (!NATIVE) window.open('https://eik-awa.github.io/privacy_policy/', '_blank'); break;
    case 'consent': closeOverlay(); setTimeout(() => { post('privacy', { action: 'manageConsent' }); resumeGame(); }, 250); break;
    case 'review': post('requestReview', {}); break;
  }
});
$('overlay').addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.set; if (!k) return;
  const v = clampVol(e.target.value); cfg[k] = v; store.set('hh-' + k + '-v', v);
  e.target.style.setProperty('--v', v + '%'); const lab = $('v-' + k); if (lab) lab.textContent = v ? v + '%' : 'OFF';
  ac(); applyVolumes(); if (k === 'bgm') updateMusic();
});
$('overlay').addEventListener('change', e => { if (e.target.dataset && e.target.dataset.set === 'se') sfx.pick(3); });
$('menuBtn').addEventListener('click', () => { ac(); if (busy || overlayOpen || screen !== 'game') return; sfx.ui(); show(showMenu); });
$('goalRetry').addEventListener('click', () => { ac(); if (busy || overlayOpen || S.mode !== 'lesson') return; sfx.ui(); startLesson(S.lessonId); });

// ---------------------------------------------------------------------
// 画面サイズ・アプリの出入り・起動
// ---------------------------------------------------------------------
function layout() { hudSig = ''; depthSig = ''; hud(); resize(); }
function resize() {
  const vw = Math.min(window.innerWidth, 520), vh = window.innerHeight;
  const top = $('hud').getBoundingClientRect().bottom, bot = $('info').offsetHeight;
  s = Math.max(36, Math.floor(Math.min((vw - 12) / GW, (vh - top - bot - 12) / GH, 86)));
  dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = GW * s * dpr; cv.height = GH * s * dpr; cv.style.width = GW * s + 'px'; cv.style.height = GH * s + 'px';
  $('app').style.width = GW * s + 'px';
}
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (S && S.mode === 'stage' && screen === 'game' && !busy) saveRun(); // 演出中は playTurn が保存済み
    if (AC) AC.suspend().catch(() => { });
    if (dragging) endDrag(false);
  } else if (AC) { AC.resume().catch(() => { }); }
});
document.addEventListener('pointerdown', () => ac(), { passive: true });

function boot() {
  buildIcons();
  S = HH.newGame(); S.tut = null; // タイトルの背景用
  layout(); show(showTitle);
  requestAnimationFrame(frame);
  post('appReady', {}); post('settings', { sleep: cfg.sleep });
  track('user_props', { bestFloor: meta.best, clears: meta.clears });
}
(document.fonts && document.fonts.load ? document.fonts.load('16px DotGothic16').catch(() => { }) : Promise.resolve()).then(boot);
window.__game = { get S() { return S; }, playTurn, get busy() { return busy; }, meta, fileBgm, get AC() { return AC; } };

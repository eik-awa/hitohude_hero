// ===== ひとふで勇者: ルール部分（画面に依存しない） =====
// 盤面・勇者・敵の状態と、1ターンの進行だけを扱う。描画や音は app.js 側。
// 乱数は状態(S.seed)に持たせた疑似乱数を使う。同じ状態から同じ操作をすれば必ず同じ結果になるため、
// 「アプリを終了して1手をやり直す」ことで盤面や祝福を引き直せない(セーブの整合性のため)。
//
// ローグライク: 地下100階(10階ごとに1章・章の最後にボス)をめざし、敵を倒して育ちながら潜る。100階の先は深淵(エンドレス)。
// 敵の強さは balance.js(tools/balance.js がシミュレーションで割り出した表)に合わせる:
//   ふつうの敵 = 1ターンに1.2体→0.9体倒せる強さ(線の長さは無制限・連撃あり) / ボス = ふつうの一筆で約4回(1ターンに4割まで) / 被ダメージ = 1階でHPの1〜3割・死ぬ率1.5%まで
'use strict';
(function (root) {
const GW = 6, GH = 6, CH_LEN = 10, LAST_FLOOR = 100, SAVE_VERSION = 3, GUARD_MIN = 12;

const P = { // 調整したい数値はここに集める(敵の強さの表は balance.js)
  heroHp: 20, heroAtk: 2, lvHp: 4, lvAtk: 1,
  wSword: 38, wHeart: 12, wCoin: 14, wShield: 10, wSwordLuck: 8,
  maxLen: 0,          // 1回でなぞれるマス数(0 = 制限なし)。長い線の代わりに敵のHPを高くしてある
  comboStep: 0.25, comboMax: 3, // 連撃: 1本の線で倒すたびに剣の威力 ×1.25, ×1.5 …(最大×3)
  bossCap: 0.4,       // ボスは1ターンに最大HPの4割までしか削れない(連撃の勢いでも一発で倒せないように)
  comboExp: 0.5, retryHeal: 0.6, endlessGrowth: 0.03,
  expGrowth: 0.3, expBase: 4, expLin: 3, expSq: 0.25,
  // 勇者の強さに合わせた敵の強さ(結構続けて強くなっても苦戦するように)。
  // 平均的な勇者(BAL.expect = 自動プレイの中央値)より {剣} が強ければ敵のHPを、最大HPが多ければ敵の攻撃を上げる。
  // 強くなったぶんが全部打ち消されないよう、比の adaptPow 乗だけ上げる(2倍強い → 敵は約1.8倍)
  adaptPow: 0.85, adaptPowHp: 0.7, adaptMin: 0.85, adaptMax: 4,
  // 手ごたえ(heat): 楽に階を突破し続けると上がり(敵のHP×(1+heat)・攻撃×(1+heat/2))、苦戦したりやられたりすると下がる
  heatUp: 0.06, heatDown: 0.06, heatDeath: 0.15, heatMax: 1,
};
// 敵の強さの表。章ごとに [章の1階目, 章の9階目] の倍率(間は直線でつなぐ。ボスの階は9階目と同じ)。
// tools/balance.js がシミュレーションの統計から割り出した値を balance.js に書き出す。無ければこの既定値を使う。
const BAL_DEFAULT = {
  hp: [[1,20.48],[15.69,44.96],[13.72,30.62],[34.78,67.22],[35.89,72.53],[42.48,74.61],[51.17,80.67],[45.05,69.2],[87.21,112.92],[66.29,103.71]],
  atk: [[1,10.9],[14.72,13.02],[17.58,9.65],[13.03,16.15],[21.8,18.14],[24.49,15.38],[20.77,20.41],[27.55,23.52],[31.75,22.74],[30.7,24.72]],
  boss: [0.56,0.36,0.94,0.57,0.76,0.64,0.71,0.92,0.6,0.73],
  expect: {"atk":[[2,18],[22,30],[34,44],[48,62],[66,82],[89,104],[110,123],[129,145],[152,172],[176,193]],"hp":[[20,62],[70,96],[106,136],[144,186],[196,250],[262,296],[306,368],[386,428],[434,502],[520,572]]}, // 平均的な勇者の {剣}・最大HP(adaptFor の基準)
};
const BAL = Object.assign({}, BAL_DEFAULT, root.BALANCE && Array.isArray(root.BALANCE.hp && root.BALANCE.hp[0]) ? root.BALANCE : {}); // 形の違う古い表は使わない

// ---- 敵の種類(数値は地下1階相当。実際は階に応じて強くなる) ----
// armor: {剣}がこの値に届かないと触れない / ghost: その線で先に1体倒していないと触れない(赤く光る攻撃直前は触れる)
// boom: 倒すとまわり8マスへの爆発ダメージ / heal: 毎ターンとなりの仲間を回復 / healAll: 毎ターン自分以外の全員を回復
// burn: 攻撃のたびに剣を灰にする本数 / drain: 攻撃のたびに自分のHPを最大の6%回復 / pierce: 盾を無視する / summon: 攻撃のたびに呼ぶ仲間
const ETYPES = {
  slime: { hp: 3, atk: 1, cd: 3, exp: 2 },
  bat: { hp: 2, atk: 1, cd: 2, exp: 2 },
  skel: { hp: 6, atk: 2, cd: 3, exp: 3 },
  bomb: { hp: 3, atk: 4, cd: 4, exp: 3, boom: 6 },
  beetle: { hp: 4, atk: 2, cd: 3, exp: 3, armor: 3 },
  ghost: { hp: 4, atk: 2, cd: 3, exp: 3, ghost: true },
  golem: { hp: 10, atk: 3, cd: 4, exp: 5 },
  shaman: { hp: 4, atk: 1, cd: 3, exp: 3, heal: 2 },
  fire: { hp: 3, atk: 2, cd: 2, exp: 3, burn: 1 },
  drake: { hp: 6, atk: 2, cd: 2, exp: 5 },
  king: { boss: true, hp: 16, atk: 3, cd: 3, exp: 12, summon: 'slime' },
  vampire: { boss: true, hp: 16, atk: 3, cd: 3, exp: 14, drain: true },
  general: { boss: true, hp: 16, atk: 4, cd: 3, exp: 16, armor: 3 },
  bombking: { boss: true, hp: 16, atk: 4, cd: 3, exp: 18, summon: 'bomb' },
  stag: { boss: true, hp: 16, atk: 4, cd: 3, exp: 18, armor: 3 },
  lich: { boss: true, hp: 16, atk: 4, cd: 3, exp: 20, ghost: true, summon: 'skel' },
  titan: { boss: true, hp: 16, atk: 3, cd: 4, exp: 22, pierce: true },
  priest: { boss: true, hp: 16, atk: 4, cd: 3, exp: 22, healAll: 2, summon: 'skel' },
  ifrit: { boss: true, hp: 16, atk: 4, cd: 3, exp: 24, burn: 3 },
  dragon: { boss: true, hp: 16, atk: 4, cd: 3, exp: 30, burn: 3, summon: 'fire' },
};
const ENAME = {
  slime: 'スライム', bat: 'コウモリ', skel: 'ガイコツ', bomb: 'バクダン', beetle: 'カブトムシ', ghost: 'ゴースト',
  golem: 'ゴーレム', shaman: 'まじない師', fire: '火の精', drake: 'ドラゴンの子',
  king: 'キングスライム', vampire: 'ヴァンパイア', general: 'ガイコツ将軍', bombking: 'バクダン大将', stag: 'クワガタ大将',
  lich: '亡霊の王', titan: '巨神像', priest: '大司祭', ifrit: 'イフリート', dragon: '魔竜',
};

// ---- 章(10階ごと)。enemies は出現の重み。新しい敵が主役で、前の章の敵も少し混ざる ----
const CHAPTERS = [
  { name: '苔の洞窟', star: 'slime', boss: 'king', enemies: { slime: 1 }, hint: '剣を集めて敵へ。{剣}がHP以上なら倒せる' },
  { name: 'コウモリの巣', star: 'bat', boss: 'vampire', enemies: { bat: 5, slime: 3 }, hint: '赤く光った敵から先に倒そう' },
  { name: '骨の回廊', star: 'skel', boss: 'general', enemies: { skel: 5, bat: 2, slime: 2 }, hint: 'ガイコツは硬い。剣を多めに拾おう' },
  { name: '火薬の坑道', star: 'bomb', boss: 'bombking', enemies: { bomb: 3, skel: 3, slime: 3, bat: 2 }, hint: 'バクダンの爆発で、まわりの敵も倒せる' },
  { name: '甲虫の森', star: 'beetle', boss: 'stag', enemies: { beetle: 5, skel: 2, bat: 2, bomb: 1.5 }, hint: '鎧の数値まで{剣}をためてから' },
  { name: '幽霊屋敷', star: 'ghost', boss: 'lich', enemies: { ghost: 4, slime: 3, skel: 2, beetle: 1.5, bomb: 1 }, hint: 'ゴーストは、先に1体倒した勢いで斬る' },
  { name: '岩の神殿', star: 'golem', boss: 'titan', enemies: { golem: 3, beetle: 2, ghost: 2, bat: 2, bomb: 1.5, slime: 2 }, hint: '一撃が重い。{盾}をためておこう' },
  { name: '呪いの祭壇', star: 'shaman', boss: 'priest', enemies: { shaman: 3, skel: 3, golem: 2, ghost: 2, bat: 2 }, hint: 'まじない師は回復役。真っ先に倒そう' },
  { name: '灼熱の底', star: 'fire', boss: 'ifrit', enemies: { fire: 4, bomb: 2, beetle: 2, shaman: 1.5, golem: 1.5, bat: 2 }, hint: '剣を灰にされる前に使い切ろう' },
  { name: '竜の巣', star: 'drake', boss: 'dragon', enemies: { drake: 4, fire: 2, ghost: 2, golem: 2, shaman: 1.5, beetle: 1.5, bomb: 1.5 }, hint: '地下100階に魔竜が待つ' },
];
const ENDLESS = { name: '深淵', enemies: { slime: 1, bat: 1.5, skel: 1.5, bomb: 1.5, beetle: 1.5, ghost: 1.5, golem: 1.5, shaman: 1.5, fire: 1.5, drake: 2 }, hint: 'どこまで潜れるか' };

// 祝福(休憩所で1つ選ぶ強化)。数値と取れる回数(max)は章(T = 1〜10、深淵ではさらに上)に合わせて増える。
// 剣・命・癒は何度でも取れる(候補が3つ未満にならないように)。
const CARDS = [
  { id: 'atk', ch: '剣', name: '剣の指輪', max: Infinity, desc: T => '{剣} +' + atkGain(T), apply: (h, T) => { h.atk += atkGain(T); } },
  { id: 'sharp', ch: '研', name: '研ぎ石', max: T => 1 + Math.floor(T / 2), desc: T => '剣マスの数値 +1', apply: h => { h.swordPow += 1; } },
  { id: 'life', ch: '命', name: '命の器', max: Infinity, desc: T => '最大HP +' + (4 + 2 * T) + '・全回復', apply: (h, T) => { h.maxhp += 4 + 2 * T; h.hp = h.maxhp; } },
  { id: 'heal', ch: '癒', name: '癒しの心得', max: Infinity, desc: T => 'ハートの回復 +' + (T + 1), apply: (h, T) => { h.heartPow += T + 1; } },
  { id: 'wall', ch: '壁', name: '鉄壁', max: T => 1 + Math.floor(T / 2), desc: T => '盾マスの{盾} +1', apply: h => { h.shieldPow += 1; } },
  { id: 'chain', ch: '連', name: '連撃の極意', max: T => Math.min(3, 1 + Math.floor(T / 3)), desc: T => '倒すたび {剣} +' + Math.ceil(T / 2), apply: (h, T) => { h.refund += Math.ceil(T / 2); } },
  { id: 'vamp', ch: '吸', name: '吸魂', max: T => Math.min(3, 1 + Math.floor(T / 3)), desc: T => '倒すたび HP +' + (T + 1), apply: (h, T) => { h.vamp += T + 1; } },
  { id: 'zan', ch: '残', name: '残心', max: 1, desc: T => '余った{剣}の半分が{盾}に', apply: h => { h.zanshin = 1; } },
  { id: 'luck', ch: '運', name: '剣の導き', max: 2, desc: T => '剣マスが出やすくなる', apply: h => { h.swordLuck++; } },
  { id: 'gold', ch: '商', name: '商才', max: 3, desc: T => 'コイン +' + T + 'G', apply: h => { h.coinPow++; } },
];
function atkGain(T) { return 1 + Math.floor(T / 4); }

// 冒険の既定ルール。レッスンはこれを部分的に上書きする。
const STAGE_RULES = { enemyAct: true, refill: true, refillEnemies: true, stairs: true, walkEmpty: false, maxLen: P.maxLen };

function chapterOf(f) { return Math.floor((Math.max(1, f) - 1) / CH_LEN); }   // 0〜9、10以上は深淵
function tierOf(f) { return chapterOf(f) + 1; }
function chapterInfo(f) { const c = chapterOf(f); return c < CHAPTERS.length ? CHAPTERS[c] : ENDLESS; }
function isBossFloor(f) { return f % CH_LEN === 0; }
function floorInChapter(f) { return (f - 1) % CH_LEN; }
function quotaFor(f) { return 5 + Math.floor(floorInChapter(f) / 3); }         // 5,5,5,6,6,6,7,7,7
function expNext(lv) { return Math.round(P.expBase + P.expLin * lv + P.expSq * lv * lv); }
function table(arr, f) { // 章ごとの [1階目, 9階目] を直線でつなぐ。100階より先は少しずつ伸ばす
  if (f > LAST_FLOOR) return arr[9][1] * (1 + (f - LAST_FLOOR) * P.endlessGrowth);
  const [a, b] = arr[chapterOf(f)], i = Math.min(8, floorInChapter(f));
  return a + (b - a) * i / 8;
}
function hpMul(f) { return table(BAL.hp, f); }
// 平均的な勇者の {剣}・最大HP(その階に来たとき)。100階より先はゆるやかに伸ばす
function expectAt(arr, f) { return f > LAST_FLOOR ? arr[9][1] * (1 + (f - LAST_FLOOR) * 0.016) : table(arr, f); }
// この階の敵の強さ補正。階に入ったときに決める(階の途中では変わらない)
function adaptFor(S) {
  const one = { hp: 1, atk: 1, armor: 1, heat: 0 };
  if (S.mode !== 'stage' || !BAL.expect) return one;
  const h = S.hero, f = S.floor, cl = v => Math.min(P.adaptMax, Math.max(P.adaptMin, v));
  const pr = Math.pow(cl(h.atk / expectAt(BAL.expect.atk, f)), P.adaptPow), hr = Math.pow(cl(h.maxhp / expectAt(BAL.expect.hp, f)), P.adaptPowHp);
  const heat = S.heat || 0;
  return { hp: pr * (1 + heat), atk: hr * (1 + heat / 2), armor: pr, heat };
}
// 階段が出るまでの目安のターン数(ふつうの人が1ターンに1.2体→0.9体倒す前提。tools/balance.js の目標と同じ)
function expectTurns(f) { const c = Math.min(9, chapterOf(f)), i = Math.min(8, floorInChapter(f)); return quotaFor(f) / ((1.2 - 0.3 * c / 9) * (1.1 - 0.2 * i / 8)); }
// 階を突破したときに手ごたえを見直す: 目安より速く、あまり傷つかずに突破したら上げる。手間取ったら下げる
function updateHeat(S) {
  if (S.mode !== 'stage' || isBossFloor(S.floor) || !S.fTurns) return;
  const fast = expectTurns(S.floor) / S.fTurns, hurt = (S.fDmg || 0) / S.hero.maxhp;
  let d = 0;
  if (fast >= 1.25 && hurt <= 0.3) d = P.heatUp; else if (fast < 0.9 || hurt > 0.5) d = -P.heatDown;
  S.heat = Math.min(P.heatMax, Math.max(0, (S.heat || 0) + d));
}
// 連撃の倍率(その線で、すでに倒した数 k)。{剣}×倍率 が実際の威力になる
function comboMul(k) { return Math.min(P.comboMax, 1 + P.comboStep * k); }
// このターンにボスへ与えられる残りのダメージ(ボス以外は制限なし)
function capLeft(e, dealt) { return e.boss ? Math.max(0, Math.ceil(e.maxhp * P.bossCap) - (dealt || 0)) : Infinity; }
// 鎧は勇者の{剣}で届く高さにする。深淵ではHPほど速く伸ばさない(伸ばすと誰も触れなくなる)
function armorMul(f) { return f > LAST_FLOOR ? BAL.hp[9][1] * (1 + (f - LAST_FLOOR) * P.endlessGrowth / 3) : hpMul(f); }
function atkMul(f) { return table(BAL.atk, f); }
function bossMul(f) { const c = chapterOf(f); return BAL.boss[Math.min(c, BAL.boss.length - 1)] || 1; }
function guardMax(h) { return Math.max(GUARD_MIN, Math.floor(h.maxhp / 2)); }
function coinValue(S) { return S.hero.coinPow * (S.mode === 'stage' ? tierOf(S.floor) : 1); }
function potionCost(S) { return 5 * tierOf(S.floor); }
function smithCost(S) { return (10 + 6 * S.hero.smith) * tierOf(S.floor); }
function smithGain(S) { return 1 + Math.floor(tierOf(S.floor) / 3); }

// ---- 疑似乱数(mulberry32)。状態は S.seed(32bit整数)----
function rnd(S) {
  let t = (S.seed = (S.seed + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(S, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pickWeighted(S, w) {
  let tot = 0; for (const k in w) tot += w[k];
  let r = rnd(S) * tot;
  for (const k in w) { if (r < w[k]) return k; r -= w[k]; }
  return Object.keys(w)[0];
}
function newSeed() { return (Math.random() * 4294967296) | 0; }

function newHero() {
  return { x: 2, y: 4, hp: P.heroHp, maxhp: P.heroHp, atk: P.heroAtk, lv: 1, exp: 0, next: expNext(1), gold: 0, guard: 0,
    swordPow: 1, heartPow: 3, coinPow: 1, shieldPow: 1, refund: 0, vamp: 0, zanshin: 0, swordLuck: 0, smith: 0, cards: {} };
}
// レベルアップ: 毎回 {剣}+1・最大HP+4・ハート+1、3レベルごとに 剣マス+1・盾マス+1
function levelUp(h) {
  h.lv++; h.next = expNext(h.lv); h.maxhp += P.lvHp; h.atk += P.lvAtk; h.heartPow += 1; h.hp = h.maxhp;
  const big = h.lv % 3 === 0;
  if (big) { h.swordPow++; h.shieldPow++; }
  return big;
}

function newGame(seed) {
  const S = { mode: 'stage', v: SAVE_VERSION, seed: seed == null ? newSeed() : seed, rules: Object.assign({}, STAGE_RULES),
    hero: newHero(), floor: 0, grid: [], kills: 0, quota: 0, stairs: false, bossDead: false, overtime: 0, turn: 0,
    phase: 'play', endless: false, offers: [], extraPick: 0, blessingAdUsed: false, reviveFloor: 0,
    tut: null, stats: { kills: 0, bestCombo: 0, turns: 0 }, checkpoint: null };
  startFloor(S, 1);
  return S;
}

function eachCell(fn) { for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) fn(x, y); }
function countEnemies(S) { let n = 0; eachCell((x, y) => { const t = S.grid[y][x]; if (t && t.k === 'enemy') n++; }); return n; }
function findBoss(S) { let b = null; eachCell((x, y) => { const t = S.grid[y][x]; if (t && t.boss) b = t; }); return b; }
function emptyGrid() { const g = []; for (let y = 0; y < GH; y++) g.push(new Array(GW).fill(null)); return g; }
function dist(a, h) { return Math.max(Math.abs(a[0] - h.x), Math.abs(a[1] - h.y)); }
function neighbors(x, y) {
  const r = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < GW && ny < GH) r.push([nx, ny]);
  }
  return r;
}

// 階の強さに合わせて敵を作る(数値の倍率は balance.js の表)
function makeEnemy(S, type) {
  const f = S.floor;
  if (!type) { // 鎧の敵とゴーストは盤面に2体まで(並ぶと壁になって先へ進めなくなるため)
    const w = Object.assign({}, chapterInfo(f).enemies), n = {};
    eachCell((x, y) => { const t = S.grid[y] && S.grid[y][x]; if (t && t.k === 'enemy' && !t.boss) n[t.type] = (n[t.type] || 0) + 1; });
    for (const k of Object.keys(w)) if ((ETYPES[k].armor || ETYPES[k].ghost) && (n[k] || 0) >= 2 && Object.keys(w).length > 1) delete w[k];
    type = pickWeighted(S, w);
  }
  const A = S.adapt || { hp: 1, atk: 1, armor: 1 };
  const B = ETYPES[type], hm = hpMul(f) * A.hp * (1 + (S.overtime || 0) * 0.02), am = atkMul(f) * A.atk * (1 + (S.overtime || 0) * 0.01);
  const e = { k: 'enemy', type, name: ENAME[type], hp: Math.max(1, Math.round(B.hp * hm * (B.boss ? bossMul(f) : 1))), atk: Math.max(1, Math.round(B.atk * am)),
    cdMax: B.cd, exp: Math.max(1, Math.round(B.exp * Math.pow(hpMul(f), P.expGrowth))) };
  if (B.boss) e.boss = true;
  if (B.armor) e.armor = Math.max(2, Math.round(B.armor * armorMul(f) * A.armor));
  if (B.boom) e.boom = Math.round(B.boom * hm);
  if (B.heal) e.heal = Math.max(1, Math.round(B.heal * hm));
  if (B.healAll) e.healAll = Math.max(1, Math.round(B.healAll * hm));
  for (const k of ['ghost', 'burn', 'drain', 'pierce', 'summon']) if (B[k]) e[k] = B[k];
  e.maxhp = e.hp; e.cd = e.cdMax;
  return e;
}
// レッスン用: 数値を指定して敵を作る
function makeEnemyFrom(spec) {
  const e = Object.assign({ k: 'enemy', cdMax: 3, exp: 2 }, spec);
  e.name = e.name || ENAME[e.type];
  e.maxhp = e.hp; if (e.cd == null) e.cd = e.cdMax;
  if (e.type === 'bomb' && e.boom == null) e.boom = e.atk;
  return e;
}
function bossTypeFor(f) {
  const c = chapterOf(f);
  if (c < CHAPTERS.length) return CHAPTERS[c].boss;
  return CHAPTERS[(f / CH_LEN - 1) % CHAPTERS.length].boss; // 深淵ではボスが順にめぐる
}

function genTile(S, drop) {
  const f = S.floor, h = S.hero, n = countEnemies(S), boss = isBossFloor(f) && S.mode === 'stage';
  if (S.rules.refillEnemies && !(S.stairs && drop)) {
    const i = floorInChapter(f), c = Math.min(chapterOf(f), 9);
    const minE = boss ? 2 : 3, maxE = boss ? 5 : Math.min(4 + Math.floor(i / 3) + (c >= 5 ? 1 : 0), 7);
    let pE = 0.24 + 0.015 * i + 0.01 * c;
    if (n < minE) pE = 1; if (n >= maxE) pE = 0;
    if (rnd(S) < pE) return S.mode === 'stage' ? makeEnemy(S) : makeEnemyFrom(Object.assign({ type: 'slime' }, ETYPES.slime));
  }
  if (S.stairs && !drop) return { k: 'floor' }; // 階段が出たあとは、アイテムを補充しない(居残ってぐるぐる稼げないように)。倒した敵のマスだけはアイテムが落ちる
  const w = { sword: P.wSword + P.wSwordLuck * h.swordLuck, heart: P.wHeart, shield: P.wShield };
  if (S.mode === 'stage') w.coin = P.wCoin;
  return { k: pickWeighted(S, w) };
}

// ---- 地形(2階から)。岩はその階のあいだ残り、どの道を通るか・誰から倒すかを考えさせる ----
// 岩と岩の「ななめのすき間」もすり抜けられない(gapBlocked)。バクダンの爆発で、となりの岩は壊せる。
function rocksFor(f) {
  if (f < 2) return 0;
  if (f > LAST_FLOOR) return 7;
  const i = floorInChapter(f), c = chapterOf(f);
  if (isBossFloor(f)) return 4 + (c >= 5 ? 1 : 0);
  return Math.min(7, 3 + Math.floor(i / 3) + (c >= 2 ? 1 : 0) + (c >= 6 ? 1 : 0)); // 3〜7個
}
const isRock = (S, x, y) => x >= 0 && y >= 0 && x < GW && y < GH && !!S.grid[y][x] && S.grid[y][x].k === 'rock';
function gapBlocked(S, ax, ay, bx, by) { return ax !== bx && ay !== by && isRock(S, bx, ay) && isRock(S, ax, by); }
function rockPattern(S, n, h) {
  const cells = [], add = (x, y) => { if (x >= 0 && y >= 0 && x < GW && y < GH && !(x === h.x && y === h.y) && !cells.some(c => c[0] === x && c[1] === y)) cells.push([x, y]); };
  const kind = Math.floor(rnd(S) * 4), ri = k => Math.floor(rnd(S) * k);
  if (kind === 0) { // まっすぐな壁(すき間が1つ)
    const vert = rnd(S) < 0.5, line = 1 + ri(4), gap = ri(GW);
    for (let i = 0; i < GW; i++) if (i !== gap) vert ? add(line, i) : add(i, line);
  } else if (kind === 1) { // L字の壁
    const cx = 1 + ri(4), cy = 1 + ri(4), dx = rnd(S) < 0.5 ? 1 : -1, dy = rnd(S) < 0.5 ? 1 : -1, len = 2 + ri(2);
    add(cx, cy); for (let i = 1; i <= len; i++) { add(cx + dx * i, cy); add(cx, cy + dy * i); }
  } else if (kind === 2) { // ななめの壁(すき間はすり抜けられない)
    const sx = ri(GW), up = rnd(S) < 0.5;
    for (let i = 0; i < GW; i++) add(up ? sx + i : sx - i, 1 + i);
  } else { // 柱を点々と
    for (let i = 0; i < n; i++) add(ri(GW), ri(GH));
  }
  shuffle(S, cells);
  while (cells.length < n) add(ri(GW), ri(GH));
  return cells.slice(0, n);
}
// 勇者から岩以外の全マスへ行けるか(ななめのすき間の決まりも含めて)。skip のマスは通れないものとして数える
function allReachable(S, h, skip) {
  const start = skip === h.x + ',' + h.y ? null : [h.x, h.y];
  let open = 0, first = start; eachCell((x, y) => { if (!isRock(S, x, y) && skip !== x + ',' + y) { open++; if (!first) first = [x, y]; } });
  const seen = new Set([first[0] + ',' + first[1]]), q = [first];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [nx, ny] of neighbors(x, y)) {
      const k = nx + ',' + ny;
      if (seen.has(k) || k === skip || isRock(S, nx, ny) || gapBlocked(S, x, y, nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen.size === open;
}
// どの1マスがふさがっても(敵が居座っても)残りがつながっているか。袋小路や「出口が1つだけの壁」を作らない
function noChokepoint(S, h) {
  let ok = true;
  eachCell((x, y) => { if (ok && !isRock(S, x, y) && !allReachable(S, h, x + ',' + y)) ok = false; });
  return ok;
}
function placeRocks(S, f) {
  const h = S.hero;
  for (let n = rocksFor(f); n > 0; n--) { // 条件に合う形が見つからなければ、岩を1つ減らしてやり直す
    for (let tries = 0; tries < 30; tries++) {
      const cells = rockPattern(S, n, h);
      for (const [x, y] of cells) S.grid[y][x] = { k: 'rock' };
      // 勇者のまわりが岩だらけにならないように(最初の一手は選べるように)
      const free = neighbors(h.x, h.y).filter(([x, y]) => !isRock(S, x, y) && !gapBlocked(S, h.x, h.y, x, y)).length;
      if (free >= 3 && allReachable(S, h) && noChokepoint(S, h)) return;
      for (const [x, y] of cells) S.grid[y][x] = null;
    }
  }
}
// 力をためる: 勇者をタップしてひと休みすると、となりの岩が砕け、次の線の{剣}が「もとの{剣}の半分」ずつ増える(重ねられる)。
// 動けないとき(詰み防止)にも、重い敵に備えるときにも使う
function chargeBonus(h) { return Math.ceil(h.atk * 0.5 * (h.charge || 0)); }

function startFloor(S, f) {
  const h = S.hero;
  S.floor = f; S.kills = 0; S.quota = quotaFor(f); S.stairs = false; S.bossDead = false; S.overtime = 0; S.phase = 'play'; S.tut = null;
  S.offers = []; S.extraPick = 0; S.blessingAdUsed = false; S.drops = {}; S.fTurns = 0; S.fDmg = 0;
  S.adapt = adaptFor(S);
  S.grid = emptyGrid();
  if (S.mode === 'stage' && f >= 2) placeRocks(S, f);
  const order = []; eachCell((x, y) => { if (!(x === h.x && y === h.y) && !S.grid[y][x]) order.push([x, y]); });
  if (isBossFloor(f)) { // ボスは勇者から一番遠い所に
    order.sort((a, b) => dist(b, h) - dist(a, h));
    const bc = order[0];
    S.grid[bc[1]][bc[0]] = makeEnemy(S, bossTypeFor(f));
  }
  for (const [x, y] of shuffle(S, order.slice())) if (!S.grid[y][x]) S.grid[y][x] = genTile(S);
  if (f === 1) { // 導入: 最初の一手を必ず気持ちよく決められる盤面
    h.x = 2; h.y = 4; S.grid[4][2] = null;
    S.grid[3][2] = { k: 'sword' }; S.grid[2][3] = { k: 'sword' }; S.grid[2][4] = { k: 'sword' };
    S.grid[1][4] = makeEnemy(S, 'slime');
    S.tut = [[2, 3], [3, 2], [4, 2], [4, 1]];
  }
  S.checkpoint = JSON.stringify({ hero: h, floor: f, endless: S.endless, stats: S.stats });
}

// ---- 先読み（なぞっている最中の予測。盤面は書き換えない）----
function sim(S, path) {
  const h = S.hero, gmax = guardMax(h);
  const R = { pool: h.atk + chargeBonus(h), total: h.atk + chargeBonus(h), heal: 0, gold: 0, guard: h.guard, guardGain: 0, kills: 0, bump: null, clang: false, stairs: false, ended: false, marks: {}, taken: 0, incoming: 0, dealt: 0 };
  const hp = new Map(), dead = new Set(), bossDealt = new Map();
  const getHp = e => hp.has(e) ? hp.get(e) : e.hp;
  const dealTo = (e, d) => { if (e.boss) bossDealt.set(e, (bossDealt.get(e) || 0) + d); };
  const kill = (e, x, y) => {
    dead.add(e); R.kills++; R.pool += h.refund; R.total += h.refund; R.heal += h.vamp; R.marks[x + ',' + y] = 'kill';
    if (e.type === 'bomb') for (const [nx, ny] of neighbors(x, y)) {
      const t = S.grid[ny][nx];
      if (t && t.k === 'enemy' && !dead.has(t)) { const d = Math.min(e.boom, capLeft(t, bossDealt.get(t))), v = getHp(t) - d; dealTo(t, d); if (v <= 0) kill(t, nx, ny); else { hp.set(t, v); R.marks[nx + ',' + ny] = 'hurt'; } }
    }
  };
  for (const [x, y] of path) {
    const t = S.grid[y][x];
    if (!t || dead.has(t)) continue;
    if (t.k === 'sword') { R.pool += h.swordPow; R.total += h.swordPow; }
    else if (t.k === 'heart') R.heal += h.heartPow;
    else if (t.k === 'coin') R.gold += coinValue(S);
    else if (t.k === 'shield') { R.guard += h.shieldPow; R.guardGain += h.shieldPow; }
    else if (t.k === 'stairs') { R.stairs = true; R.ended = true; break; }
    else if (t.k === 'enemy') {
      const v = getHp(t), mul = comboMul(R.kills), eff = Math.floor(R.pool * mul);
      if ((t.armor && eff < t.armor) || (t.ghost && R.kills === 0 && !solid(t, S))) { R.clang = true; R.ended = true; R.bump = { x, y, dmg: 0 }; break; }
      const cap = capLeft(t, bossDealt.get(t));
      if (eff >= v && v <= cap) { R.pool -= Math.ceil(v / mul); R.dealt += v; dealTo(t, v); kill(t, x, y); }
      else { const d = Math.min(eff, cap); hp.set(t, v - d); dealTo(t, d); R.bump = { x, y, dmg: d, capped: eff > cap }; R.dealt += d; R.pool = 0; R.ended = true; break; }
    }
  }
  R.mul = comboMul(R.kills); R.eff = Math.floor(R.pool * R.mul); // 次の一撃の倍率と威力(画面の表示用)
  if (h.zanshin && !R.stairs) R.guard += Math.floor(R.pool / 2);
  R.guard = Math.min(gmax, R.guard);
  R.cleared = S.mode === 'lesson' && goalWouldClear(S, dead);
  let pierce = 0;
  if (!R.stairs && !R.cleared && S.rules.enemyAct) eachCell((x, y) => {
    const t = S.grid[y][x];
    if (t && t.k === 'enemy' && !dead.has(t) && t.cd - 1 <= 0) { R.incoming += t.atk; if (t.pierce) pierce += t.atk; }
  });
  R.taken = pierce + Math.max(0, R.incoming - pierce - R.guard);
  return R;
}
function goalWouldClear(S, dead) {
  let left = 0, bossLeft = false;
  eachCell((x, y) => { const t = S.grid[y][x]; if (t && t.k === 'enemy' && !dead.has(t)) { left++; if (t.boss) bossLeft = true; } });
  return S.goal === 'boss' ? !bossLeft && !!findBoss(S) : S.goal === 'killAll' ? left === 0 : false;
}

// 次のマスを道すじに足せるか。足せない理由も返す(画面の案内用)。
function addCheck(S, path, x, y) {
  const h = S.hero;
  if (x < 0 || y < 0 || x >= GW || y >= GH) return { ok: false };
  if (x === h.x && y === h.y) return { ok: false };
  const last = path.length ? path[path.length - 1] : [h.x, h.y];
  if (Math.max(Math.abs(last[0] - x), Math.abs(last[1] - y)) !== 1) return { ok: false };
  for (const p of path) if (p[0] === x && p[1] === y) return { ok: false, why: 'twice' };
  if (S.rules.maxLen && path.length >= S.rules.maxLen) return { ok: false, why: 'len', max: S.rules.maxLen };
  const t = S.grid[y][x];
  if (t && t.k === 'rock') return { ok: false, why: 'rock' };
  if (gapBlocked(S, last[0], last[1], x, y)) return { ok: false, why: 'gap' };
  if (!t && !S.rules.walkEmpty) return { ok: false };
  const R = sim(S, path);
  if (R.ended) return { ok: false, why: 'ended' };
  if (t && t.k === 'enemy' && R.marks[x + ',' + y] !== 'kill') {
    if (R.pool <= 0) return { ok: false, why: 'nopower' };
    if (t.armor && R.eff < t.armor) return { ok: false, why: 'armor', armor: t.armor, pool: R.eff };
    if (t.ghost && R.kills === 0 && !solid(t, S)) return { ok: false, why: 'ghost' };
  }
  return { ok: true };
}
function canAdd(S, path, x, y) { return addCheck(S, path, x, y).ok; }
// ゴーストは攻撃の直前(赤く光っているとき)だけ実体化して、連撃なしでも触れられる
function solid(t, S) { return S.rules.enemyAct && t.cd <= 1; }
// 勇者がどこにも進めないか。そのときは勇者をタップしてひと休み(1ターン進める)できる。
function hasMove(S) { const h = S.hero; for (const [x, y] of neighbors(h.x, h.y)) if (canAdd(S, [], x, y)) return true; return false; } // canAdd がすき間も見る
function goalCleared(S) {
  if (S.mode !== 'lesson') return false;
  if (S.goal === 'boss') return S.bossDead;
  if (S.goal === 'killAll') return countEnemies(S) === 0;
  return false; // 'stairs' は階段をくだった時点で判定する
}

// ---- 1ターンの進行。盤面を書き換えながら、演出用の出来事を順に返す ----
function* turn(S, path) {
  const h = S.hero, c = { pool: h.atk + chargeBonus(h), combo: 0, n: 0 };
  if (path.length) h.charge = 0;
  else { // その場でひと休み → 力をためる。となりの岩も砕ける
    const rubble = neighbors(h.x, h.y).filter(([x, y]) => isRock(S, x, y));
    for (const [x, y] of rubble) S.grid[y][x] = null;
    h.charge = (h.charge || 0) + 1;
    yield { t: 'charge', bonus: chargeBonus(h), rubble };
  }
  const eff = () => Math.floor(c.pool * comboMul(c.combo)), mul = () => comboMul(c.combo);
  c.bossDealt = new Map(); // このターンにボスへ与えたダメージ(上限つき)
  let stairs = false;
  S.turn++; S.stats.turns++; if (!S.stairs) S.fTurns = (S.fTurns || 0) + 1;
  for (const [x, y] of path) {
    const t = S.grid[y][x];
    if (!t || t.k === 'ash') { h.x = x; h.y = y; yield { t: 'move', x, y }; continue; }
    if (t.k === 'floor') { S.grid[y][x] = null; h.x = x; h.y = y; yield { t: 'move', x, y }; continue; } // 何もないマス(通ったあとは敵がわくこともある)
    if (t.k === 'enemy') {
      if (t.armor && eff() < t.armor) { yield { t: 'clang', x, y }; break; }
      if (t.ghost && c.combo === 0 && !solid(t, S)) { yield { t: 'clang', x, y, ghost: true }; break; }
      const m = mul(), cap = capLeft(t, c.bossDealt.get(t));
      if (eff() >= t.hp && t.hp <= cap) {
        const d = t.hp; c.pool -= Math.ceil(d / m); t.hp = 0;
        yield { t: 'hit', x, y, e: t, dmg: d, kill: true, mul: m, pool: eff() };
        yield* killEnemy(S, x, y, t, c);
        h.x = x; h.y = y; yield { t: 'move', x, y, pool: eff(), mul: mul() };
      } else {
        const d = Math.min(eff(), cap), capped = eff() > cap; t.hp -= d; c.pool = 0;
        if (t.boss) c.bossDealt.set(t, (c.bossDealt.get(t) || 0) + d);
        yield { t: 'hit', x, y, e: t, dmg: d, kill: false, mul: m, pool: 0, capped };
        break;
      }
    } else {
      S.grid[y][x] = null; h.x = x; h.y = y; c.n++;
      yield { t: 'move', x, y };
      let val = 0;
      if (t.k === 'sword') { c.pool += h.swordPow; val = h.swordPow; }
      else if (t.k === 'heart') { val = Math.min(h.heartPow, h.maxhp - h.hp); h.hp += val; }
      else if (t.k === 'coin') { val = coinValue(S); h.gold += val; }
      else if (t.k === 'shield') { val = Math.min(h.shieldPow, guardMax(h) - h.guard); h.guard += val; }
      else if (t.k === 'stairs') stairs = true;
      yield { t: 'pick', k: t.k, x, y, n: c.n, val, pool: eff(), mul: mul() };
      if (stairs) break;
    }
  }
  if (c.combo > S.stats.bestCombo) S.stats.bestCombo = c.combo;
  if (stairs) {
    if (S.mode === 'lesson') { S.phase = 'clear'; yield { t: 'descend' }; return; }
    updateHeat(S);
    S.phase = (S.floor === LAST_FLOOR && !S.endless) ? 'win' : 'rest';
    S.offers = pickOffers(S); S.extraPick = 0; S.blessingAdUsed = false;
    yield { t: 'descend' };
    return;
  }
  if (h.zanshin && c.pool > 1) {
    const g = Math.min(Math.floor(c.pool / 2), guardMax(h) - h.guard);
    if (g > 0) { h.guard += g; yield { t: 'zanshin', val: g }; }
  }
  if (goalCleared(S)) { S.phase = 'clear'; yield { t: 'clear' }; return; } // レッスン: 目標を達成したら敵の番を待たずに終わる
  // 敵の番
  if (S.rules.enemyAct) {
    const list = [];
    eachCell((x, y) => { const t = S.grid[y][x]; if (t && t.k === 'enemy') list.push([x, y, t]); });
    for (const a of list) a[2].cd--;
    const healed = [];
    for (const [x, y, e] of list) {
      if (e.heal) for (const [nx, ny] of neighbors(x, y)) {
        const t = S.grid[ny][nx];
        if (t && t.k === 'enemy' && t.hp < t.maxhp) { t.hp = Math.min(t.maxhp, t.hp + e.heal); healed.push([nx, ny]); }
      }
      if (e.healAll) for (const [ax, ay, t] of list) if (t !== e && t.hp > 0 && t.hp < t.maxhp) { t.hp = Math.min(t.maxhp, t.hp + e.healAll); healed.push([ax, ay]); }
    }
    if (healed.length) yield { t: 'heal', cells: healed };
    for (const [x, y, e] of list) {
      if (e.cd > 0) continue;
      e.cd = e.cdMax;
      const bomb = e.type === 'bomb';
      if (bomb) S.grid[y][x] = null;
      const dmg = e.atk, ab = e.pierce ? 0 : Math.min(h.guard, dmg);
      h.guard -= ab; h.hp -= dmg - ab; S.fDmg = (S.fDmg || 0) + dmg - ab;
      yield { t: 'attack', x, y, e, dmg: dmg - ab, absorbed: ab, bomb, pierce: !!e.pierce };
      if (h.hp <= 0) { h.hp = 0; S.phase = S.mode === 'lesson' ? 'fail' : 'dead'; S.failReason = 'dead'; S.killedBy = e.type; yield { t: 'dead' }; return; }
      if (e.drain && e.hp < e.maxhp) { const v = Math.min(e.maxhp - e.hp, Math.ceil(e.maxhp * 0.06)); e.hp += v; yield { t: 'drain', x, y, val: v }; }
      if (e.summon) {
        const cs = []; eachCell((cx, cy) => { const t = S.grid[cy][cx]; if (t && t.k !== 'enemy' && t.k !== 'stairs' && t.k !== 'rock') cs.push([cx, cy]); });
        if (cs.length && countEnemies(S) < 5) {
          const [cx, cy] = cs[Math.floor(rnd(S) * cs.length)];
          S.grid[cy][cx] = S.mode === 'stage' ? makeEnemy(S, e.summon) : makeEnemyFrom(Object.assign({ type: e.summon }, ETYPES[e.summon]));
          yield { t: 'summon', x: cx, y: cy, type: e.summon };
        }
      }
      if (e.burn) {
        const cs = []; eachCell((cx, cy) => { const t = S.grid[cy][cx]; if (t && t.k === 'sword') cs.push([cx, cy]); });
        const burn = shuffle(S, cs).slice(0, e.burn);
        for (const [cx, cy] of burn) S.grid[cy][cx] = { k: 'ash' };
        if (burn.length) yield { t: 'burn', cells: burn };
      }
    }
  }
  yield* afterEnemies(S);
  if (S.limit && S.turn >= S.limit && S.phase === 'play') { S.phase = 'fail'; S.failReason = 'turns'; yield { t: 'timeup' }; }
}

// 敵の番のあと: 階段の出現と、空いたマスの補充
function* afterEnemies(S) {
  const h = S.hero;
  if (S.stairs) S.overtime++;
  const cleared = (isBossFloor(S.floor) && S.mode === 'stage') ? S.bossDead : S.kills >= S.quota;
  if (S.rules.stairs && !S.stairs && cleared) {
    let cs = []; eachCell((x, y) => { if (!S.grid[y][x] && !(x === h.x && y === h.y)) cs.push([x, y]); });
    if (!cs.length) eachCell((x, y) => { const t = S.grid[y][x]; if (t && t.k !== 'enemy') cs.push([x, y]); });
    if (cs.length) {
      shuffle(S, cs); cs.sort((a, b) => dist(b, h) - dist(a, h));
      const [x, y] = cs[0];
      S.grid[y][x] = { k: 'stairs' }; S.stairs = true;
      yield { t: 'stairs', x, y };
    }
  }
  if (S.rules.refill) {
    const cells = [];
    const drops = S.drops || {};
    eachCell((x, y) => { if (!S.grid[y][x] && !(x === h.x && y === h.y)) { S.grid[y][x] = genTile(S, drops[x + ',' + y]); delete drops[x + ',' + y]; cells.push([x, y]); } });
    yield { t: 'spawn', cells };
  }
}

function* killEnemy(S, x, y, e, c) {
  const h = S.hero;
  S.grid[y][x] = null; c.combo++; S.kills++; S.stats.kills++;
  (S.drops = S.drops || {})[x + ',' + y] = 1; // 倒した敵のマスには、階段のあとでもアイテムが落ちる
  if (e.boss) S.bossDead = true;
  c.pool += h.refund;
  const heal = Math.min(h.vamp, h.maxhp - h.hp); h.hp += heal;
  const exp = Math.ceil((e.exp || 1) * (1 + P.comboExp * (c.combo - 1)));
  yield { t: 'kill', x, y, e, exp, combo: c.combo, heal, mul: comboMul(c.combo), pool: Math.floor(c.pool * comboMul(c.combo)) };
  if (e.type === 'bomb') {
    yield { t: 'boom', x, y };
    const rubble = neighbors(x, y).filter(([nx, ny]) => isRock(S, nx, ny)); // 爆発でとなりの岩が壊れる
    for (const [nx, ny] of rubble) S.grid[ny][nx] = null;
    if (rubble.length) yield { t: 'rubble', cells: rubble };
    for (const [nx, ny] of neighbors(x, y)) {
      const t = S.grid[ny][nx];
      if (t && t.k === 'enemy') {
        const d = Math.min(t.hp, e.boom, capLeft(t, c.bossDealt && c.bossDealt.get(t))); t.hp -= d;
        if (t.boss && c.bossDealt) c.bossDealt.set(t, (c.bossDealt.get(t) || 0) + d);
        yield { t: 'hit', x: nx, y: ny, e: t, dmg: d, kill: t.hp <= 0, blast: true, pool: Math.floor(c.pool * comboMul(c.combo)) };
        if (t.hp <= 0) yield* killEnemy(S, nx, ny, t, c);
      }
    }
  }
  if (S.mode !== 'stage') return; // レッスンでは育たない
  h.exp += exp;
  while (h.exp >= h.next) {
    h.exp -= h.next; const big = levelUp(h); c.pool += P.lvAtk;
    yield { t: 'levelup', pool: c.pool, big };
  }
}

function pickOffers(S) {
  const h = S.hero, T = tierOf(S.floor), cap = c => typeof c.max === 'function' ? c.max(T) : c.max;
  return shuffle(S, CARDS.filter(c => (h.cards[c.id] || 0) < cap(c))).slice(0, 3).map(c => c.id);
}
// 祝福を受け取る。広告で2枚目が選べる状態なら、選んだ1枚を外して休憩所に留まる(true を返す)。
function takeCard(S, id) {
  if (S.phase !== 'rest' || !S.offers.includes(id)) return false;
  const c = CARDS.find(c => c.id === id), h = S.hero;
  c.apply(h, tierOf(S.floor)); h.cards[id] = (h.cards[id] || 0) + 1;
  if (S.extraPick > 0) { S.extraPick--; S.offers = S.offers.filter(o => o !== id); return true; }
  return false;
}
function buy(S, what) {
  const h = S.hero;
  if (S.phase !== 'rest') return false;
  if (what === 'potion') { const c = potionCost(S); if (h.gold < c || h.hp >= h.maxhp) return false; h.gold -= c; h.hp = Math.min(h.maxhp, h.hp + Math.ceil(h.maxhp / 2)); return true; }
  if (what === 'smith') { const c = smithCost(S); if (h.gold < c) return false; h.gold -= c; h.atk += smithGain(S); h.smith++; return true; }
  return false;
}
function nextFloor(S) { startFloor(S, S.floor + 1); }
function retryFloor(S) { // 同じ階からやり直す。詰みを作らないため少し回復して再開
  const c = JSON.parse(S.checkpoint);
  S.heat = Math.max(0, (S.heat || 0) - P.heatDeath); // やられたら手ごたえを下げる
  S.hero = c.hero; S.endless = c.endless; S.stats = c.stats;
  S.hero.hp = Math.max(S.hero.hp, Math.ceil(S.hero.maxhp * P.retryHeal));
  S.hero.guard = 0;
  startFloor(S, c.floor);
}
// 広告での復活: その場でHP全回復。すぐ攻撃が来ないよう敵の構えを戻し、止まっていた補充を済ませる。
function revive(S) {
  if (S.phase !== 'dead' || S.reviveFloor === S.floor) return false;
  const h = S.hero;
  h.hp = h.maxhp; S.phase = 'play'; S.reviveFloor = S.floor; S.heat = Math.max(0, (S.heat || 0) - P.heatDeath);
  eachCell((x, y) => { const t = S.grid[y][x]; if (t && t.k === 'enemy') t.cd = t.cdMax; });
  for (const _ of afterEnemies(S)) { /* 演出なしで反映 */ }
  return true;
}
// 広告で「祝福を2つ選ぶ」
function grantExtraPick(S) {
  if (S.phase !== 'rest' || S.blessingAdUsed || S.offers.length < 2) return false;
  S.blessingAdUsed = true; S.extraPick = 1;
  return true;
}

// =====================================================================
// チュートリアル(レッスン)
// 盤面は文字の地図で書く: . 空き / H 勇者 / s 剣 / h ハート / c コイン / g 盾 / r 岩 / 大文字 = legend の敵
// =====================================================================
const LESSONS = [
  {
    id: 'l1', title: 'ひと筆で斬る', sub: 'なぞって進む・剣を集める',
    intro: [
      '勇者から指をはなさずに<b>なぞる</b>と、その道すじを一気に進みます。',
      '<b>剣</b>を拾うたびに {剣} が増え、敵にぶつかるとその数だけダメージ。',
      '<b>{剣} が敵のHP（右下の白い数字）以上</b>なら倒せます。',
    ],
    goal: 'killAll', goalText: 'スライムを倒そう', requireKill: 1,
    requireHint: 'スライムまで、指をはなさずになぞりきろう',
    rules: { enemyAct: false, refill: false, refillEnemies: false, stairs: false },
    map: ['. . . . . .', '. . . . . .', '. . . . . .', 'H s s s A .', '. . . . . .', '. . . . . .'],
    legend: { A: { type: 'slime', hp: 5, atk: 1 } },
    guide: [[1, 3], [2, 3], [3, 3], [4, 3]],
    hints: ['光る線のとおりに、勇者から指でなぞってみよう'],
    clear: '{剣}2 ＋ 剣3本 ＝ <b>{剣}5</b>。<br>HP5のスライムを、ちょうど倒せました。',
  },
  {
    id: 'l2', title: '曲がって連撃', sub: '8方向に曲げる・まとめて倒す',
    intro: [
      '線は<b>たて・よこ・ななめ</b>の8方向に曲げられます。同じマスは2回通れません。',
      '敵を倒しても、<b>残った {剣} で線を続けられます</b>。1本の線で何体も倒すと<b>連撃</b>！',
      '連撃のたびに剣の威力が <b>×1.25、×1.5…</b> と上がります。弱い敵から倒して、勢いで強い敵へ。',
      'なぞっている途中で、来た道を戻ると取り消せます。',
    ],
    goal: 'killAll', goalText: '1本の線で2体とも倒そう', requireKill: 2,
    requireHint: '2体とも、1本の線でつなげよう（ななめにも進めます）',
    rules: { enemyAct: false, refill: false, refillEnemies: false, stairs: false },
    map: ['. . . B . .', '. . . . s .', '. . . . s .', '. . s A c .', '. s h . . .', 'H c . . . .'],
    legend: { A: { type: 'slime', hp: 3, atk: 1 }, B: { type: 'slime', hp: 3, atk: 1 } },
    guide: [[1, 4], [2, 3], [3, 3], [4, 2], [4, 1], [3, 0]],
    hints: ['剣を拾いながら、ななめに曲がって2体をつなごう'],
    clear: '1本の線で2体倒すと<b>連撃</b>。2体目からは剣の威力が上がり、経験値にもボーナスがつきます。<br>ハートはHP回復、コインはお金（休憩所で使えます）。',
  },
  {
    id: 'l3', title: 'スライムの反撃', sub: '攻撃の合図・盾・削って倒す', enemyIntro: 'slime',
    intro: [
      '敵の上の<b>点</b>は、攻撃までのターン数。なぞるたびに1つ減ります。',
      '点が残り1つで<b>赤く光ったら</b>、このターンの終わりに攻撃が来ます。左下の<b>赤い数字</b>が敵の攻撃。',
      '<b>盾</b>を拾うと {盾} がたまり、攻撃を先に受け止めます。',
      '{剣} が足りなくても、ぶつかれば<b>HPを削れます</b>（線はそこで止まります）。',
    ],
    goal: 'killAll', goalText: 'スライムを倒そう（2回に分けてOK）',
    rules: { enemyAct: true, refill: false, refillEnemies: false, stairs: false },
    map: ['. . . . . .', '. . s A . .', '. s g s . .', '. g . s . .', '. . H . . .', '. . . . . .'],
    legend: { A: { type: 'slime', hp: 8, atk: 3, cd: 1, cdMax: 3 } },
    guide: [[3, 3], [3, 2], [2, 2], [1, 2], [2, 1], [3, 1]],
    hints: ['剣と盾を拾ってからぶつかろう。このスライムは赤く光っている＝すぐ攻撃してくる',
      'HPを削った！ {盾} でダメージも減らせた。となりのスライムにもう一度ぶつかろう'],
    clear: '削ってから倒すのも立派な作戦。<br>赤く光った敵は先に倒すか、盾で守りを固めよう。',
  },
  {
    id: 'l4', title: 'バクダン', sub: '爆発でまとめて倒す', enemyIntro: 'bomb',
    intro: [
      '<b>バクダン</b>を倒すと爆発して、<b>まわり8マス</b>の敵にダメージを与えます。',
      'なぞっている間、巻きこんで倒せる敵には<b>×印</b>が出ます。',
      'ただし放っておくと、点が0になったとき<b>自爆</b>して大ダメージ。早めに片付けよう。',
    ],
    goal: 'killAll', goalText: 'バクダンの爆発で、4体まとめて倒そう', requireKill: 4,
    requireHint: 'バクダンを倒して、まわりの3体を巻きこもう',
    rules: { enemyAct: true, refill: false, refillEnemies: false, stairs: false },
    map: ['. . . . . .', '. A . B . .', '. . X . . .', '. C s . . .', '. . s . . .', '. . H . . .'],
    legend: {
      X: { type: 'bomb', hp: 3, atk: 8, boom: 6, cdMax: 4 },
      A: { type: 'slime', hp: 5, atk: 2 }, B: { type: 'slime', hp: 5, atk: 2 }, C: { type: 'slime', hp: 5, atk: 2 },
    },
    guide: [[2, 4], [2, 3], [2, 2]],
    hints: ['バクダンまでなぞると、まわりの敵に×印が出るのを確かめてみよう'],
    clear: 'バクダンの爆発で4体まとめて撃破！<br>冒険では<b>第4章（地下31階〜）</b>から現れます。',
  },
  {
    id: 'l7', title: 'すり抜けるゴースト', sub: '先に1体倒してから触れる', enemyIntro: 'ghost',
    intro: [
      '<b>ゴースト</b>は、ふつうにぶつかっても<b>すり抜けてしまいます</b>。',
      '同じ線で<b>先に別の敵を1体倒してから</b>なら、触れて斬れます（連撃の勢いが必要）。',
      'バクダンの爆発なら、そのまま当たります。',
    ],
    goal: 'killAll', goalText: '先にスライムを倒し、その勢いでゴーストを斬ろう', requireKill: 2,
    requireHint: 'スライムを倒してから、同じ線のままゴーストへ',
    rules: { enemyAct: false, refill: false, refillEnemies: false, stairs: false },
    map: ['. . . . . .', '. . G . . .', '. . s . . .', '. s A . . .', '. . s . . .', '. . H . . .'],
    legend: { G: { type: 'ghost', hp: 3, atk: 2, ghost: true }, A: { type: 'slime', hp: 2, atk: 1 } },
    guide: [[2, 4], [1, 3], [2, 3], [2, 2], [2, 1]],
    hints: ['スライムを倒すまでは、ゴーストに触れられない。まずスライムへ'],
    clear: '連撃の勢いでゴーストを撃破！<br>冒険では<b>第6章（地下51階〜）</b>から現れます。',
  },
  {
    id: 'l8', title: '誰から倒す？', sub: '攻撃の順番を読む', enemyIntro: 'bat',
    intro: [
      '<b>先に攻撃してくる敵</b>（点が少ない・赤く光っている敵）から倒すと、ダメージを受けずに済みます。',
      '<b>岩</b>は通れません。岩と岩の<b>ななめのすき間</b>もすり抜けられないので、道すじを考えよう。',
    ],
    goal: 'killAll', goalText: '2ターン以内に、2体とも倒そう', limit: 2,
    rules: { enemyAct: true, refill: false, refillEnemies: false, stairs: false, walkEmpty: true },
    map: ['. . A . . .', '. s r s . .', 's . r . B .', 's . s . s .', '. s . s . .', '. . H . . .'],
    legend: { A: { type: 'bat', hp: 4, atk: 3, cd: 1, cdMax: 2 }, B: { type: 'slime', hp: 4, atk: 1, cd: 3, cdMax: 3 } },
    guide: [[1, 4], [0, 3], [0, 2], [1, 1], [2, 0]],
    hints: ['コウモリは赤く光っている＝すぐ攻撃してくる。先にコウモリへ',
      '次はスライム。残りの剣を拾いながら向かおう'],
    clear: '攻撃が来る順に倒せば、ダメージを受けません。',
  },
  {
    id: 'l5', title: '階段で次の階へ', sub: 'ノルマ・階段・補充',
    intro: [
      '冒険では、<b>決められた数の敵</b>を倒すと<b>階段</b>があらわれます。',
      '階段までなぞると次の階へ。なぞったマスには新しいマスが補充され、敵もまた現れます。',
      '残りの数は、画面右上の<b>「あと○体」</b>で確かめられます。',
    ],
    goal: 'stairs', quota: 2,
    rules: { enemyAct: true, refill: true, refillEnemies: true, stairs: true },
    map: ['c s h s c g', 's A s c s s', 'g s s s B c', 's h c s s s', 'c s H s g h', 's c s h s c'],
    legend: { A: { type: 'slime', hp: 3, atk: 1 }, B: { type: 'slime', hp: 4, atk: 1 } },
    hints: ['敵を2体倒すと階段があらわれるよ'],
    clear: '階段をくだると<b>休憩所</b>へ。<b>祝福</b>（強化）をひとつ選んで、さらに深くへ進みます。<br>10階ごとに景色と敵が変わり、章の最後にボスが待っています。',
  },
  {
    id: 'l6', title: 'よろいのボス', sub: 'ボスは削って倒す・鎧', enemyIntro: 'general',
    intro: [
      'ボスは一度で倒せなくても大丈夫。ぶつかって<b>少しずつ削ろう</b>（1ターンに削れるのは最大HPの<b>4割まで</b>）。',
      '<b>ガイコツ将軍</b>には<b>鎧</b>があり、{剣} が鎧の数値に届かないと、はじかれて近づけません。',
      '剣を集めて <b>{剣}5以上</b> にしてから挑もう。',
    ],
    goal: 'boss', goalText: 'ガイコツ将軍を倒そう',
    rules: { enemyAct: true, refill: true, refillEnemies: false, stairs: false },
    map: ['c s s s s h', 's g s s B s', 's s c s s g', 'h s s g s s', 's s c s s c', 'H s s h s s'],
    legend: { B: { type: 'general', boss: true, hp: 14, atk: 3, armor: 5, cdMax: 3 } },
    hints: ['剣を3本以上拾って、{剣}5以上でぶつかろう'],
    clear: 'ボス撃破！ これでチュートリアルは完了です。<br>地下100階の<b>魔竜</b>をめざそう。',
  },
];

function newLesson(id, seed) {
  const L = LESSONS.find(l => l.id === id);
  const S = { mode: 'lesson', lesson: L, lessonId: id, seed: seed == null ? newSeed() : seed,
    rules: Object.assign({}, STAGE_RULES, { maxLen: 0 }, L.rules), hero: newHero(), floor: 1, grid: emptyGrid(), goal: L.goal,
    kills: 0, quota: L.quota || 99, stairs: false, bossDead: false, overtime: 0, turn: 0, phase: 'play', limit: L.limit || 0,
    endless: false, offers: [], extraPick: 0, tut: L.guide ? L.guide.slice() : null,
    stats: { kills: 0, bestCombo: 0, turns: 0 }, checkpoint: null };
  L.map.forEach((row, y) => row.trim().split(/\s+/).forEach((ch, x) => {
    if (ch === 'H') { S.hero.x = x; S.hero.y = y; }
    else if (ch === 's') S.grid[y][x] = { k: 'sword' };
    else if (ch === 'h') S.grid[y][x] = { k: 'heart' };
    else if (ch === 'c') S.grid[y][x] = { k: 'coin' };
    else if (ch === 'g') S.grid[y][x] = { k: 'shield' };
    else if (ch === 'r') S.grid[y][x] = { k: 'rock' };
    else if (L.legend && L.legend[ch]) S.grid[y][x] = makeEnemyFrom(L.legend[ch]);
  }));
  return S;
}

// 保存用: 演出用の一時情報(_ で始まるキー)とレッスン定義の実体を除いて文字列にする
function serialize(S) { return JSON.stringify(S, (k, v) => (k.charAt(0) === '_' || k === 'lesson') ? undefined : v); }
function deserialize(str) {
  const S = JSON.parse(str);
  if (!S || !S.hero || !Array.isArray(S.grid) || S.grid.length !== GH) return null;
  if (S.mode === 'stage' && S.v !== SAVE_VERSION) return null; // 旧形式の冒険は引き継がない
  if (S.mode === 'lesson') S.lesson = LESSONS.find(l => l.id === S.lessonId);
  if (typeof S.seed !== 'number') S.seed = newSeed();
  S.rules = S.mode === 'stage' ? Object.assign({}, STAGE_RULES) : Object.assign({}, STAGE_RULES, S.rules || {}); // 冒険は今のルールで続ける
  return S;
}

root.HH = { GW, GH, CH_LEN, LAST_FLOOR, P, BAL, CARDS, ENAME, ETYPES, CHAPTERS, ENDLESS, LESSONS,
  isBossFloor, quotaFor, adaptFor, expectAt, expectTurns, expNext, chapterOf, tierOf, chapterInfo, floorInChapter, bossTypeFor, hpMul, atkMul, bossMul, guardMax,
  coinValue, potionCost, smithCost, smithGain, newHero, newGame, newLesson, eachCell, countEnemies, findBoss,
  makeEnemy, sim, addCheck, comboMul, capLeft, chargeBonus, noChokepoint, rocksFor, gapBlocked, allReachable, canAdd, hasMove, turn, pickOffers, takeCard, buy, nextFloor, retryFloor, revive, grantExtraPick,
  goalCleared, serialize, deserialize, rnd };
})(typeof window !== 'undefined' ? window : globalThis);

// ===== ひとふで勇者: ルール部分（画面に依存しない） =====
// 盤面・勇者・敵の状態と、1ターンの進行だけを扱う。描画や音は app.js 側。
// 乱数は状態(S.seed)に持たせた疑似乱数を使う。同じ状態から同じ操作をすれば必ず同じ結果になるため、
// 「アプリを終了して1手をやり直す」ことで盤面や祝福を引き直せない(セーブの整合性のため)。
//
// ステージは10階ごとに1章(全10章・地下100階)。章ごとに景色と新しい敵が変わり、章の最後(10の倍数の階)にボス。
// 新しい敵はそれぞれ「ひとつだけ新しいコツ」を持ち、章が進むほど少しずつ考えることが増える。
// 地下100階の魔竜を倒すと、終わりのない深淵(エンドレス)へ。
'use strict';
(function (root) {
const GW = 6, GH = 6, CH_LEN = 10, LAST_FLOOR = 100, SAVE_VERSION = 2;

const P = { // 調整したい数値はここに集める
  heroHp: 20, heroAtk: 2, lvHp: 4, lvAtk: 1,
  wSword: 38, wHeart: 12, wCoin: 14, wShield: 10, wSwordLuck: 8,
  atkRamp: 0.02,      // 敵の攻撃力の上乗せ(地下100階で約3倍。ボスは平方根ぶんだけ)
  endlessGrowth: 0.02, // 深淵(101階〜)で1階ごとに強くなる割合
  bossHp: 0.85, comboExp: 0.5, retryHeal: 0.6,
  expGrowth: 0.3, expBase: 4, expLin: 3, expSq: 0.25, // 経験値(後半ほどレベルが上がりにくい)
};

// ---- 敵の種類(数値は地下1階相当。実際は階に応じて強くなる) ----
// armor: 力がこの値に届かないと触れない / ghost: その線で先に1体倒していないと触れない
// boom: 倒すとまわり8マスへの爆発ダメージ / heal: 毎ターンとなりの仲間を回復 / healAll: 毎ターン自分以外の全員を回復
// burn: 攻撃のたびに剣を灰にする本数 / drain: 攻撃のたびに自分のHPを回復 / pierce: ガードを無視する
// summon: 攻撃のたびに呼び出す仲間
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
  vampire: { boss: true, hp: 20, atk: 3, cd: 3, exp: 14, drain: true },
  general: { boss: true, hp: 24, atk: 4, cd: 3, exp: 16, armor: 4 },
  bombking: { boss: true, hp: 28, atk: 4, cd: 3, exp: 18, summon: 'bomb' },
  stag: { boss: true, hp: 26, atk: 4, cd: 3, exp: 18, armor: 5 },
  lich: { boss: true, hp: 26, atk: 4, cd: 3, exp: 20, ghost: true, summon: 'skel' },
  titan: { boss: true, hp: 36, atk: 3, cd: 4, exp: 22, pierce: true },
  priest: { boss: true, hp: 30, atk: 4, cd: 3, exp: 22, healAll: 2, summon: 'skel' },
  ifrit: { boss: true, hp: 34, atk: 4, cd: 3, exp: 24, burn: 3 },
  dragon: { boss: true, hp: 40, atk: 4, cd: 3, exp: 30, burn: 3, summon: 'fire' },
};
const ENAME = {
  slime: 'スライム', bat: 'コウモリ', skel: 'ガイコツ', bomb: 'バクダン', beetle: 'カブトムシ', ghost: 'ゴースト',
  golem: 'ゴーレム', shaman: 'まじない師', fire: '火の精', drake: 'ドラゴンの子',
  king: 'キングスライム', vampire: 'ヴァンパイア', general: 'ガイコツ将軍', bombking: 'バクダン大将', stag: 'クワガタ大将',
  lich: '亡霊の王', titan: '巨神像', priest: '大司祭', ifrit: 'イフリート', dragon: '魔竜',
};

// ---- 章(10階ごと)。enemies は出現の重み。新しい敵が主役で、前の章の敵も少し混ざる ----
const CHAPTERS = [
  { name: '苔の洞窟', star: 'slime', boss: 'king', enemies: { slime: 1 },
    hint: '剣を集めて、敵にぶつかれ！ 力が敵のHP以上なら倒せる' },
  { name: 'コウモリの巣', star: 'bat', boss: 'vampire', enemies: { bat: 5, slime: 3 },
    hint: 'コウモリは2ターンごとに噛みつく。赤く光ったものから先に倒そう' },
  { name: '骨の回廊', star: 'skel', boss: 'general', enemies: { skel: 5, bat: 2, slime: 2 },
    hint: 'ガイコツは硬い。剣をたくさん拾ってからぶつかろう' },
  { name: '火薬の坑道', star: 'bomb', boss: 'bombking', enemies: { bomb: 3, skel: 3, slime: 3, bat: 2 },
    hint: 'バクダンを倒すと、まわりの敵を巻きこむ。敵のかたまりの近くで爆発させよう' },
  { name: '甲虫の森', star: 'beetle', boss: 'stag', enemies: { beetle: 5, skel: 2, bat: 2, bomb: 1.5 },
    hint: 'カブトムシの鎧より大きな力でないと触れない。剣を集めてから向かおう' },
  { name: '幽霊屋敷', star: 'ghost', boss: 'lich', enemies: { ghost: 4, slime: 3, skel: 2, beetle: 1.5, bomb: 1 },
    hint: 'ゴーストは、同じ線で先に1体倒してからでないと触れない。連撃でしとめよう' },
  { name: '岩の神殿', star: 'golem', boss: 'titan', enemies: { golem: 3, beetle: 2, ghost: 2, bat: 2, bomb: 1.5, slime: 2 },
    hint: 'ゴーレムの一撃は重い。盾でガードをためておこう' },
  { name: '呪いの祭壇', star: 'shaman', boss: 'priest', enemies: { shaman: 3, skel: 3, golem: 2, ghost: 2, bat: 2 },
    hint: 'まじない師は、となりの仲間を回復する。真っ先に倒そう' },
  { name: '灼熱の底', star: 'fire', boss: 'ifrit', enemies: { fire: 4, bomb: 2, beetle: 2, shaman: 1.5, golem: 1.5, bat: 2 },
    hint: '火の精は剣を灰にする。剣はためこまず、早めに使おう' },
  { name: '竜の巣', star: 'drake', boss: 'dragon', enemies: { drake: 4, fire: 2, ghost: 2, golem: 2, shaman: 1.5, beetle: 1.5, bomb: 1.5 },
    hint: 'これまでのコツを全部使おう。地下100階に魔竜が待つ' },
];
const ENDLESS = { name: '深淵', enemies: { slime: 1, bat: 1.5, skel: 1.5, bomb: 1.5, beetle: 1.5, ghost: 1.5, golem: 1.5, shaman: 1.5, fire: 1.5, drake: 2 },
  hint: 'ここから先は腕だめし。どこまで潜れるか' };

// 祝福(休憩所で1つ選ぶ強化)。数値と取れる回数(max)は章(T = 1〜10、深淵ではさらに上)に合わせて増える。
const CARDS = [
  { id: 'atk', ch: '力', name: '力の指輪', max: T => T + 1, desc: T => 'こうげき力 +' + atkGain(T), apply: (h, T) => { h.atk += atkGain(T); } },
  { id: 'sharp', ch: '研', name: '研ぎ石', max: T => 1 + Math.floor(T / 2), desc: T => '剣1本で増える力 +1', apply: h => { h.swordPow += 1; } },
  { id: 'life', ch: '命', name: '命の器', max: T => 1 + T, desc: T => '最大HP +' + (4 + 2 * T) + '、さらに全回復', apply: (h, T) => { h.maxhp += 4 + 2 * T; h.hp = h.maxhp; } },
  { id: 'heal', ch: '癒', name: '癒しの心得', max: T => 1 + Math.floor(T / 2), desc: T => 'ハートの回復量 +' + (T + 1), apply: (h, T) => { h.heartPow += T + 1; } },
  { id: 'wall', ch: '壁', name: '鉄壁', max: T => 1 + Math.floor(T / 2), desc: T => '盾1枚のガード +1', apply: h => { h.shieldPow += 1; } },
  { id: 'chain', ch: '連', name: '連撃の極意', max: T => Math.min(3, 1 + Math.floor(T / 3)), desc: T => '敵を倒すたび、力が ' + Math.ceil(T / 2) + ' もどる', apply: (h, T) => { h.refund += Math.ceil(T / 2); } },
  { id: 'vamp', ch: '吸', name: '吸魂', max: T => Math.min(3, 1 + Math.floor(T / 3)), desc: T => '敵を倒すたび HP +' + (T + 1), apply: (h, T) => { h.vamp += T + 1; } },
  { id: 'zan', ch: '残', name: '残心', max: 1, desc: T => '使い切れなかった力の半分がガードになる', apply: h => { h.zanshin = 1; } },
  { id: 'luck', ch: '運', name: '剣の導き', max: 2, desc: T => '剣のマスが出やすくなる', apply: h => { h.swordLuck++; } },
  { id: 'gold', ch: '商', name: '商才', max: 3, desc: T => 'コインの価値 +' + T + 'G', apply: h => { h.coinPow++; } },
];

function atkGain(T) { return 1 + Math.floor(T / 4); }

// ステージモードの既定ルール。レッスンはこれを部分的に上書きする。
const STAGE_RULES = { enemyAct: true, refill: true, refillEnemies: true, stairs: true };

function chapterOf(f) { return Math.floor((Math.max(1, f) - 1) / CH_LEN); }   // 0〜9、10以上は深淵
function tierOf(f) { return chapterOf(f) + 1; }                                // 祝福・店・コインの数値に使う
function chapterInfo(f) { const c = chapterOf(f); return c < CHAPTERS.length ? CHAPTERS[c] : ENDLESS; }
function isBossFloor(f) { return f % CH_LEN === 0; }
function floorInChapter(f) { return (f - 1) % CH_LEN; }                       // 0〜9
function quotaFor(f) { return 3 + Math.floor(floorInChapter(f) / 3); }         // 3,3,3,4,4,4,5,5,5
function expNext(lv) { return Math.round(P.expBase + P.expLin * lv + P.expSq * lv * lv); }
// 敵の強さの倍率。勇者の育ち方(シミュレーションで測った平均)に合わせた表を、階ごとに直線でつなぐ。
// 序盤は勇者の方がずっと強く(誰でも進める)、深く潜るほど差が縮まり、うまい線が必要になっていく。
const POWER_TABLE = [[1, 1], [5, 2.6], [10, 4.2], [20, 7.6], [30, 10], [40, 13], [50, 16], [60, 19.3], [70, 22.6], [80, 26], [90, 29.5], [100, 33]];
function power(f) {
  if (f >= LAST_FLOOR) return POWER_TABLE[POWER_TABLE.length - 1][1] * (1 + (f - LAST_FLOOR) * P.endlessGrowth);
  for (let i = 1; i < POWER_TABLE.length; i++) {
    const [f1, m1] = POWER_TABLE[i];
    if (f <= f1) { const [f0, m0] = POWER_TABLE[i - 1]; return m0 + (m1 - m0) * (f - f0) / (f1 - f0); }
  }
  return 1;
}
// 敵の攻撃力は、章が進むほど HP より少しだけ強めに伸びる(守りも考える必要が出てくる)
function atkRamp(f) { return 1 + P.atkRamp * (Math.min(f, LAST_FLOOR) - 1); }
function guardMax(h) { return Math.max(12, Math.floor(h.maxhp / 2)); }
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
// レベルアップ: 毎回 こうげき力+1・最大HP+4・ハート+1、3レベルごとに 剣の力+1・盾のガード+1
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

// 階の強さに合わせて敵を作る
function makeEnemy(S, type) {
  const f = S.floor;
  if (!type) type = pickWeighted(S, chapterInfo(f).enemies);
  const B = ETYPES[type], m = power(f), ot = S.overtime || 0;
  const hm = m * (1 + ot * 0.02) * (B.boss ? P.bossHp : 1), am = m * (B.boss ? Math.sqrt(atkRamp(f)) : atkRamp(f)) * (1 + ot * 0.01);
  const e = { k: 'enemy', type, name: ENAME[type], hp: Math.max(1, Math.round(B.hp * hm)), atk: Math.max(1, Math.round(B.atk * am)),
    cdMax: B.cd, exp: Math.max(1, Math.round(B.exp * Math.pow(m, P.expGrowth))) };
  if (B.boss) e.boss = true;
  if (B.armor) e.armor = Math.max(2, Math.round(B.armor * m));
  if (B.boom) e.boom = Math.round(B.boom * m);
  if (B.heal) e.heal = Math.max(1, Math.round(B.heal * m));
  if (B.healAll) e.healAll = Math.max(1, Math.round(B.healAll * m));
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

function genTile(S) {
  const f = S.floor, h = S.hero, n = countEnemies(S), boss = isBossFloor(f) && S.mode === 'stage';
  if (S.rules.refillEnemies) {
    const i = floorInChapter(f), c = Math.min(chapterOf(f), 9);
    const minE = boss ? 1 : 2, maxE = boss ? 4 : Math.min(3 + Math.floor(i / 3) + (c >= 5 ? 1 : 0), 6);
    let pE = 0.2 + 0.015 * i + 0.01 * c;
    if (n < minE) pE = 1; if (n >= maxE) pE = 0;
    if (rnd(S) < pE) return makeEnemy(S);
  }
  const w = { sword: P.wSword + P.wSwordLuck * h.swordLuck, heart: P.wHeart, coin: P.wCoin, shield: P.wShield };
  return { k: pickWeighted(S, w) };
}

function emptyGrid() { const g = []; for (let y = 0; y < GH; y++) g.push(new Array(GW).fill(null)); return g; }

function startFloor(S, f) {
  const h = S.hero;
  S.floor = f; S.kills = 0; S.quota = quotaFor(f); S.stairs = false; S.bossDead = false; S.overtime = 0; S.phase = 'play'; S.tut = null;
  S.offers = []; S.extraPick = 0; S.blessingAdUsed = false;
  S.grid = emptyGrid();
  const order = []; eachCell((x, y) => { if (!(x === h.x && y === h.y)) order.push([x, y]); });
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
    eachCell((x, y) => { if (!S.grid[y][x] && !(x === h.x && y === h.y)) S.grid[y][x] = { k: 'coin' }; });
  }
  S.checkpoint = JSON.stringify({ hero: h, floor: f, endless: S.endless, stats: S.stats });
}

function dist(a, h) { return Math.max(Math.abs(a[0] - h.x), Math.abs(a[1] - h.y)); }
function neighbors(x, y) {
  const r = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < GW && ny < GH) r.push([nx, ny]);
  }
  return r;
}

// ---- 先読み（なぞっている最中の予測。盤面は書き換えない）----
function sim(S, path) {
  const h = S.hero, gmax = guardMax(h);
  const R = { pool: h.atk, total: h.atk, heal: 0, gold: 0, guard: h.guard, guardGain: 0, kills: 0, bump: null, clang: false, stairs: false, ended: false, marks: {}, taken: 0, incoming: 0 };
  const hp = new Map(), dead = new Set();
  const getHp = e => hp.has(e) ? hp.get(e) : e.hp;
  const kill = (e, x, y) => {
    dead.add(e); R.kills++; R.pool += h.refund; R.total += h.refund; R.heal += h.vamp; R.marks[x + ',' + y] = 'kill';
    if (e.type === 'bomb') for (const [nx, ny] of neighbors(x, y)) {
      const t = S.grid[ny][nx];
      if (t && t.k === 'enemy' && !dead.has(t)) { const v = getHp(t) - e.boom; if (v <= 0) kill(t, nx, ny); else { hp.set(t, v); R.marks[nx + ',' + ny] = 'hurt'; } }
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
      const v = getHp(t);
      if ((t.armor && R.pool < t.armor) || (t.ghost && R.kills === 0 && !solid(t, S))) { R.clang = true; R.ended = true; R.bump = { x, y, dmg: 0 }; break; }
      if (R.pool >= v) { R.pool -= v; kill(t, x, y); }
      else { hp.set(t, v - R.pool); R.bump = { x, y, dmg: R.pool }; R.pool = 0; R.ended = true; break; }
    }
  }
  if (h.zanshin && !R.stairs) R.guard += Math.floor(R.pool / 2);
  R.guard = Math.min(gmax, R.guard);
  if (!R.stairs && S.rules.enemyAct) eachCell((x, y) => {
    const t = S.grid[y][x];
    if (t && t.k === 'enemy' && !dead.has(t) && t.cd - 1 <= 0) R.incoming += t.atk;
  });
  // ガードを無視する攻撃(巨神像)はガードで減らせない
  let pierce = 0;
  if (!R.stairs && S.rules.enemyAct) eachCell((x, y) => { const t = S.grid[y][x]; if (t && t.k === 'enemy' && t.pierce && !dead.has(t) && t.cd - 1 <= 0) pierce += t.atk; });
  R.taken = pierce + Math.max(0, R.incoming - pierce - R.guard);
  return R;
}

// 次のマスを道すじに足せるか。足せない理由も返す(画面の案内用)。
function addCheck(S, path, x, y) {
  const h = S.hero;
  if (x < 0 || y < 0 || x >= GW || y >= GH) return { ok: false };
  if (x === h.x && y === h.y) return { ok: false };
  const last = path.length ? path[path.length - 1] : [h.x, h.y];
  if (Math.max(Math.abs(last[0] - x), Math.abs(last[1] - y)) !== 1) return { ok: false };
  for (const p of path) if (p[0] === x && p[1] === y) return { ok: false, why: 'twice' };
  const t = S.grid[y][x]; if (!t) return { ok: false };
  const R = sim(S, path);
  if (R.ended) return { ok: false, why: 'ended' };
  if (t.k === 'enemy' && R.marks[x + ',' + y] !== 'kill') {
    if (R.pool <= 0) return { ok: false, why: 'nopower' };
    if (t.armor && R.pool < t.armor) return { ok: false, why: 'armor', armor: t.armor, pool: R.pool };
    if (t.ghost && R.kills === 0 && !solid(t, S)) return { ok: false, why: 'ghost' };
  }
  return { ok: true };
}
function canAdd(S, path, x, y) { return addCheck(S, path, x, y).ok; }
// ゴーストは攻撃の直前(赤く光っているとき)だけ実体化して、連撃なしでも触れられる
function solid(t, S) { return S.rules.enemyAct && t.cd <= 1; }
// 勇者がどこにも進めないか(まわりがすべて触れない敵など)。そのときは勇者をタップしてひと休みできる。
function hasMove(S) { const h = S.hero; for (const [x, y] of neighbors(h.x, h.y)) if (canAdd(S, [], x, y)) return true; return false; }

// ---- レッスンのクリア判定 ----
function lessonCleared(S) {
  const L = S.lesson; if (!L) return false;
  if (L.goal === 'killAll') return countEnemies(S) === 0;
  if (L.goal === 'boss') return S.bossDead;
  return false; // 'stairs' は階段をくだった時点で判定する
}

// ---- 1ターンの進行。盤面を書き換えながら、演出用の出来事を順に返す ----
function* turn(S, path) {
  const h = S.hero, c = { pool: h.atk, combo: 0, n: 0 };
  let stairs = false;
  S.turn++; S.stats.turns++;
  for (const [x, y] of path) {
    const t = S.grid[y][x];
    if (!t) { h.x = x; h.y = y; yield { t: 'move', x, y }; continue; }
    if (t.k === 'enemy') {
      if (t.armor && c.pool < t.armor) { yield { t: 'clang', x, y }; break; }
      if (t.ghost && c.combo === 0 && !solid(t, S)) { yield { t: 'clang', x, y, ghost: true }; break; }
      if (c.pool >= t.hp) {
        const d = t.hp; c.pool -= d; t.hp = 0;
        yield { t: 'hit', x, y, e: t, dmg: d, kill: true, pool: c.pool };
        yield* killEnemy(S, x, y, t, c);
        h.x = x; h.y = y; yield { t: 'move', x, y };
      } else {
        const d = c.pool; t.hp -= d; c.pool = 0;
        yield { t: 'hit', x, y, e: t, dmg: d, kill: false, pool: 0 };
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
      yield { t: 'pick', k: t.k, x, y, n: c.n, val, pool: c.pool };
      if (stairs) break;
    }
  }
  if (c.combo > S.stats.bestCombo) S.stats.bestCombo = c.combo;
  if (stairs) {
    if (S.mode === 'lesson') { S.phase = 'lessonClear'; yield { t: 'descend' }; return; }
    S.phase = (S.floor === LAST_FLOOR && !S.endless) ? 'win' : 'rest';
    S.offers = pickOffers(S); S.extraPick = 0; S.blessingAdUsed = false;
    yield { t: 'descend' };
    return;
  }
  if (h.zanshin && c.pool > 1) {
    const g = Math.min(Math.floor(c.pool / 2), guardMax(h) - h.guard);
    if (g > 0) { h.guard += g; yield { t: 'zanshin', val: g }; }
  }
  // レッスン: 目標を達成したら、敵の番を待たずに終わる
  if (S.mode === 'lesson' && lessonCleared(S)) { S.phase = 'lessonClear'; yield { t: 'lessonClear' }; return; }
  // 敵の番
  if (S.rules.enemyAct) {
    const list = [];
    eachCell((x, y) => { const t = S.grid[y][x]; if (t && t.k === 'enemy') list.push([x, y, t]); });
    for (const a of list) a[2].cd--;
    // まじない師・大司祭の回復(攻撃の前に)
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
      h.guard -= ab; h.hp -= dmg - ab;
      yield { t: 'attack', x, y, e, dmg: dmg - ab, absorbed: ab, bomb, pierce: !!e.pierce };
      if (h.hp <= 0) { h.hp = 0; S.phase = S.mode === 'lesson' ? 'lessonFail' : 'dead'; S.killedBy = e.type; yield { t: 'dead' }; return; }
      if (e.drain && e.hp < e.maxhp) { const v = Math.min(e.maxhp - e.hp, e.atk * 2); e.hp += v; yield { t: 'drain', x, y, val: v }; }
      if (e.summon) {
        const cs = []; eachCell((cx, cy) => { const t = S.grid[cy][cx]; if (t && t.k !== 'enemy' && t.k !== 'stairs') cs.push([cx, cy]); });
        if (cs.length && countEnemies(S) < 5) {
          const [cx, cy] = cs[Math.floor(rnd(S) * cs.length)];
          S.grid[cy][cx] = makeEnemy(S, e.summon); yield { t: 'summon', x: cx, y: cy, type: e.summon };
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
    eachCell((x, y) => { if (!S.grid[y][x] && !(x === h.x && y === h.y)) { S.grid[y][x] = genTile(S); cells.push([x, y]); } });
    yield { t: 'spawn', cells };
  }
}

function* killEnemy(S, x, y, e, c) {
  const h = S.hero;
  S.grid[y][x] = null; c.combo++; S.kills++; S.stats.kills++;
  if (e.boss) S.bossDead = true;
  c.pool += h.refund;
  const heal = Math.min(h.vamp, h.maxhp - h.hp); h.hp += heal;
  const exp = Math.ceil(e.exp * (1 + P.comboExp * (c.combo - 1)));
  yield { t: 'kill', x, y, e, exp, combo: c.combo, heal, pool: c.pool };
  if (e.type === 'bomb') {
    yield { t: 'boom', x, y };
    for (const [nx, ny] of neighbors(x, y)) {
      const t = S.grid[ny][nx];
      if (t && t.k === 'enemy') {
        const d = Math.min(t.hp, e.boom); t.hp -= d;
        yield { t: 'hit', x: nx, y: ny, e: t, dmg: d, kill: t.hp <= 0, blast: true, pool: c.pool };
        if (t.hp <= 0) yield* killEnemy(S, nx, ny, t, c);
      }
    }
  }
  h.exp += exp;
  while (h.exp >= h.next) {
    h.exp -= h.next; const big = levelUp(h); c.pool += P.lvAtk;
    yield { t: 'levelup', pool: c.pool, big };
  }
}

function pickOffers(S) {
  const h = S.hero;
  const T = tierOf(S.floor), cap = c => typeof c.max === 'function' ? c.max(T) : c.max;
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
  S.hero = c.hero; S.endless = c.endless; S.stats = c.stats;
  S.hero.hp = Math.max(S.hero.hp, Math.ceil(S.hero.maxhp * P.retryHeal));
  S.hero.guard = 0;
  startFloor(S, c.floor);
}
// 広告での復活: その場でHP全回復。すぐ攻撃が来ないよう敵の構えを戻し、止まっていた補充を済ませる。
function revive(S) {
  if (S.phase !== 'dead' || S.reviveFloor === S.floor) return false;
  const h = S.hero;
  h.hp = h.maxhp; S.phase = 'play'; S.reviveFloor = S.floor;
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
// 盤面は文字の地図で書く: . 空き / H 勇者 / s 剣 / h ハート / c コイン / g 盾 / 大文字 = legend の敵
// =====================================================================
const LESSONS = [
  {
    id: 'l1', title: 'ひと筆で斬る', sub: 'なぞって進む・剣で力をためる',
    intro: [
      '勇者から指をはなさずに<b>なぞる</b>と、その道すじを一気に進みます。',
      '<b>剣</b>を拾うたびに<b>力</b>がたまり、敵にぶつかると力のぶんだけダメージ。',
      '<b>力が敵のHP（右下の白い数字）以上</b>なら倒せます。',
    ],
    goal: 'killAll', goalText: 'スライムを倒そう', requireKill: 1,
    requireHint: 'スライムまで、指をはなさずになぞりきろう',
    rules: { enemyAct: false, refill: false, refillEnemies: false, stairs: false },
    map: ['. . . . . .', '. . . . . .', '. . . . . .', 'H s s s A .', '. . . . . .', '. . . . . .'],
    legend: { A: { type: 'slime', hp: 5, atk: 1 } },
    guide: [[1, 3], [2, 3], [3, 3], [4, 3]],
    hints: ['光る線のとおりに、勇者から指でなぞってみよう'],
    clear: 'こうげき力2 ＋ 剣3本 ＝ <b>力5</b>。<br>HP5のスライムを、ちょうど倒せました。',
  },
  {
    id: 'l2', title: '曲がって連撃', sub: '8方向に曲げる・まとめて倒す',
    intro: [
      '線は<b>たて・よこ・ななめ</b>の8方向に曲げられます。同じマスは2回通れません。',
      '敵を倒しても、<b>残った力で線を続けられます</b>。1本の線で何体も倒すと<b>連撃</b>！',
      'なぞっている途中で、来た道を戻ると取り消せます。',
    ],
    goal: 'killAll', goalText: '1本の線で2体とも倒そう', requireKill: 2,
    requireHint: '2体とも、1本の線でつなげよう（ななめにも進めます）',
    rules: { enemyAct: false, refill: false, refillEnemies: false, stairs: false },
    map: ['. . . B . .', '. . . . s .', '. . . . s .', '. . s A c .', '. s h . . .', 'H c . . . .'],
    legend: { A: { type: 'slime', hp: 3, atk: 1 }, B: { type: 'slime', hp: 3, atk: 1 } },
    guide: [[1, 4], [2, 3], [3, 3], [4, 2], [4, 1], [3, 0]],
    hints: ['剣を拾いながら、ななめに曲がって2体をつなごう'],
    clear: '1本の線で2体倒すと<b>連撃</b>。経験値にボーナスがつきます。<br>ハートはHP回復、コインはお金（ステージの休憩所で使えます）。',
  },
  {
    id: 'l3', title: 'スライムの反撃', sub: '攻撃の合図・盾・削って倒す', enemyIntro: 'slime',
    intro: [
      '敵の上の<b>点</b>は、攻撃までのターン数。なぞるたびに1つ減ります。',
      '点が残り1つで<b>赤く光ったら</b>、このターンの終わりに攻撃が来ます。左下の<b>赤い数字</b>が攻撃力。',
      '<b>盾</b>を拾うとガードがたまり、攻撃を先に受け止めます。',
      '力が足りなくても、ぶつかれば<b>HPを削れます</b>（線はそこで止まります）。',
    ],
    goal: 'killAll', goalText: 'スライムを倒そう（2回に分けてOK）',
    rules: { enemyAct: true, refill: false, refillEnemies: false, stairs: false },
    map: ['. . . . . .', '. . s A . .', '. s g s . .', '. g . s . .', '. . H . . .', '. . . . . .'],
    legend: { A: { type: 'slime', hp: 8, atk: 3, cd: 1, cdMax: 3 } },
    guide: [[3, 3], [3, 2], [2, 2], [1, 2], [2, 1], [3, 1]],
    hints: ['剣と盾を拾ってからぶつかろう。このスライムは赤く光っている＝すぐ攻撃してくる',
      'HPを削った！盾のガードでダメージも減らせた。となりのスライムにもう一度ぶつかろう'],
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
    clear: 'バクダンの爆発で4体まとめて撃破！<br>ステージでは<b>第4章（地下31階〜）</b>から現れます。',
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
    clear: '連撃の勢いでゴーストを撃破！<br>ステージでは<b>第6章（地下51階〜）</b>から現れます。',
  },
  {
    id: 'l5', title: '階段で次の階へ', sub: 'ノルマ・階段・補充',
    intro: [
      'ステージモードでは、<b>決められた数の敵</b>を倒すと<b>階段</b>があらわれます。',
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
      'ボスは一度で倒せなくても大丈夫。ぶつかって<b>少しずつ削ろう</b>。',
      '<b>ガイコツ将軍</b>には<b>鎧</b>があり、力が鎧の数値に届かないと、はじかれて近づけません。',
      '剣を集めて<b>力を5以上</b>ためてから挑もう。',
    ],
    goal: 'boss', goalText: 'ガイコツ将軍を倒そう',
    rules: { enemyAct: true, refill: true, refillEnemies: false, stairs: false },
    map: ['c s s s s h', 's g s s B s', 's s c s s g', 'h s s g s s', 's s c s s c', 'H s s h s s'],
    legend: { B: { type: 'general', boss: true, hp: 14, atk: 3, armor: 5, cdMax: 3, exp: 10 } },
    hints: ['剣を3本以上拾って、力を5以上にしてからぶつかろう'],
    clear: 'ボス撃破！ これでチュートリアルは完了です。<br>ステージモードで、地下100階の<b>魔竜</b>をめざそう。',
  },
];

function newLesson(id, seed) {
  const L = LESSONS.find(l => l.id === id);
  const S = { mode: 'lesson', lesson: L, lessonId: id, seed: seed == null ? newSeed() : seed,
    rules: Object.assign({}, STAGE_RULES, L.rules), hero: newHero(), floor: 1, grid: emptyGrid(),
    kills: 0, quota: L.quota || 99, stairs: false, bossDead: false, overtime: 0, turn: 0, phase: 'play',
    endless: false, offers: [], extraPick: 0, tut: L.guide ? L.guide.slice() : null,
    stats: { kills: 0, bestCombo: 0, turns: 0 }, checkpoint: null };
  L.map.forEach((row, y) => row.trim().split(/\s+/).forEach((ch, x) => {
    if (ch === 'H') { S.hero.x = x; S.hero.y = y; }
    else if (ch === 's') S.grid[y][x] = { k: 'sword' };
    else if (ch === 'h') S.grid[y][x] = { k: 'heart' };
    else if (ch === 'c') S.grid[y][x] = { k: 'coin' };
    else if (ch === 'g') S.grid[y][x] = { k: 'shield' };
    else if (L.legend && L.legend[ch]) S.grid[y][x] = makeEnemyFrom(L.legend[ch]);
  }));
  return S;
}

// 保存用: 演出用の一時情報(_ で始まるキー)とレッスン定義の実体を除いて文字列にする
function serialize(S) {
  return JSON.stringify(S, (k, v) => (k.charAt(0) === '_' || k === 'lesson') ? undefined : v);
}
function deserialize(str) {
  const S = JSON.parse(str);
  if (!S || !S.hero || !Array.isArray(S.grid) || S.grid.length !== GH) return null;
  if (S.mode === 'stage' && S.v !== SAVE_VERSION) return null; // 旧形式(9階版)の冒険は引き継がない
  if (S.mode === 'lesson') S.lesson = LESSONS.find(l => l.id === S.lessonId);
  if (typeof S.seed !== 'number') S.seed = newSeed();
  S.rules = Object.assign({}, STAGE_RULES, S.rules || {});
  return S;
}

root.HH = { GW, GH, CH_LEN, LAST_FLOOR, P, CARDS, ENAME, ETYPES, CHAPTERS, ENDLESS, LESSONS,
  isBossFloor, quotaFor, expNext, chapterOf, tierOf, chapterInfo, floorInChapter, bossTypeFor, power, guardMax,
  coinValue, potionCost, smithCost, smithGain, newHero, newGame, newLesson, eachCell, countEnemies, findBoss,
  makeEnemy, sim, addCheck, canAdd, hasMove, turn, pickOffers, takeCard, buy, nextFloor, retryFloor, revive, grantExtraPick,
  lessonCleared, serialize, deserialize, rnd };
})(typeof window !== 'undefined' ? window : globalThis);

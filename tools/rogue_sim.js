// ローグライク(冒険モード)を自動で最後まで遊ばせて、1階ごとの数字を集める部品。tools/balance.js から使う。
// 遊び方(bot)は3種類:
//   skilled  … 上手な人。よく探して、いつも一番よい線を選ぶ
//   casual   … ふつうの人。よさそうな線を選ぶが、ときどき2番手・3番手を選ぶ(60% / 25% / 15%)
//   beginner … 初心者。あまり探さず、迷いやすい(45% / 30% / 25%)
// 死んだら「この階をやり直す」(retryFloor)で続ける。死亡回数は記録する(同じ階で5回死んだら、その階は飛ばして先の階の数字を集める)。
'use strict';
const path = require('path');

const BOTS = {
  skilled: { width: 60, pick: [1] },
  casual: { width: 25, pick: [0.6, 0.25, 0.15] },
  beginner: { width: 10, pick: [0.45, 0.3, 0.25] },
};

function load(rulesPath, balance) {
  globalThis.window = globalThis;
  if (balance) globalThis.BALANCE = balance; else delete globalThis.BALANCE;
  delete require.cache[require.resolve(path.resolve(rulesPath))];
  require(path.resolve(rulesPath));
  return globalThis.HH;
}

function makeSim(H) {
  const run = (S, p) => { for (const _ of H.turn(S, p)) { } };
  function score(S, p, R) {
    const h = S.hero; let sc = 0;
    for (const key in R.marks) {
      if (R.marks[key] !== 'kill') continue;
      const [x, y] = key.split(',').map(Number), e = S.grid[y][x];
      sc += e.boss ? 400 : 40 + (S.stairs ? 0 : 10);
    }
    if (R.bump && R.bump.dmg) { const e = S.grid[R.bump.y][R.bump.x]; sc += (e.boss ? 160 : 25) * R.bump.dmg / e.maxhp; }
    if (R.taken >= h.hp) sc -= 1e5;
    sc -= 70 * R.taken / h.hp;
    sc += 40 * Math.min(R.heal, h.maxhp - h.hp) / h.maxhp;
    if (!R.incoming) sc += 0.5 * R.guardGain;
    sc += 0.3 * R.gold;
    // 階段が出たあとはアイテムが補充されないので、居残らずに階段へ向かう(通り道の敵は倒していく)
    if (R.stairs) sc += 130 + 25 * S.overtime + (h.hp < h.maxhp * 0.4 ? 60 : 0);
    return sc - p.length * 0.05;
  }
  // 線の候補を、長さごとに上位 width 本ずつ残しながら広げて探す(長さの上限がなければ DEPTH マスまで探す)
  const DEPTH = H.P.maxLen || 22;
  function candidates(S, width) {
    const h = S.hero, out = [];
    let layer = [[]];
    for (let d = 0; d < DEPTH && layer.length; d++) {
      const next = [];
      for (const pth of layer) {
        const last = pth.length ? pth[pth.length - 1] : [h.x, h.y];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = last[0] + dx, y = last[1] + dy;
          if (!H.canAdd(S, pth, x, y)) continue;
          const p = pth.concat([[x, y]]), R = H.sim(S, p), sc = score(S, p, R);
          out.push({ p, sc });
          if (!R.ended) next.push({ p, k: sc + R.pool * 4 });
        }
      }
      next.sort((a, b) => b.k - a.k);
      layer = next.slice(0, width).map(o => o.p);
    }
    // 力をためる(ひと休み): 倒せる線がないときの選択肢。次の線の{剣}が増える
    if (out.length) out.push({ p: [], sc: score(S, [], H.sim(S, [])) + 20 });
    out.sort((a, b) => b.sc - a.sc);
    const seen = new Set(), res = [];
    for (const o of out) {
      const end = o.p[o.p.length - 1] + '';
      if (seen.has(end)) continue; seen.add(end); res.push(o.p);
      if (res.length >= 4) break;
    }
    if (!res.length) res.push([]); // どこにも進めない → ひと休み
    return res;
  }
  // 道すじの中身を数える(最初にぶつかる敵と、そのときの{剣})
  function contactOf(S, p) {
    const h = S.hero; let pool = h.atk;
    for (const [x, y] of p) {
      const t = S.grid[y][x];
      if (!t) continue;
      if (t.k === 'sword') pool += h.swordPow;
      else if (t.k === 'enemy') return { e: t, pool };
    }
    return null;
  }
  function chooseCard(S, rand, bot) {
    const pref = { atk: 5, sharp: 5, life: 4, chain: 3, vamp: 3, heal: 2, wall: 2, zan: 2, luck: 2, gold: 1 };
    const offers = S.offers.slice();
    if (bot === 'skilled') return offers.sort((a, b) => pref[b] - pref[a])[0];
    if (bot === 'beginner') return offers[Math.floor(rand() * offers.length)];
    let tot = 0; for (const o of offers) tot += pref[o];
    let r = rand() * tot; for (const o of offers) { if (r < pref[o]) return o; r -= pref[o]; }
    return offers[0];
  }
  function rest(S, rand, bot) {
    const h = S.hero;
    if (S.offers.length) { const id = chooseCard(S, rand, bot); H.takeCard(S, id); }
    if (h.hp < h.maxhp * 0.6) H.buy(S, 'potion');
    while (h.gold >= H.smithCost(S) && (bot !== 'beginner' || rand() < 0.5)) if (!H.buy(S, 'smith')) break;
    if (h.hp < h.maxhp * 0.8) H.buy(S, 'potion');
  }

  // 1回の冒険を最後まで(または maxFloor まで)遊ばせる
  function playRun(seed, bot, maxFloor = H.LAST_FLOOR) {
    const cfg = BOTS[bot];
    let r = (seed * 2654435761 + 977) >>> 0;
    const rand = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
    const S = H.newGame(seed);
    const floors = [];
    let F = null, deathsHere = 0, attempt = 0;
    const begin = () => {
      F = { f: S.floor, boss: H.isBossFloor(S.floor), lv: S.hero.lv, atk: S.hero.atk, maxhp: S.hero.maxhp, hp0: S.hero.hp,
        turns: 0, taken: 0, qTurns: 0, qKills: 0, quota: S.quota, deaths: deathsHere, contacts: [], bossStrokes: 0, bossHp: 0, bossDmg: [], turnKills: [],
        adapt: S.adapt ? S.adapt.hp : 1, heat: S.heat || 0 };
      const b = H.findBoss(S); if (b) F.bossHp = b.maxhp;
    };
    begin();
    let guard = 0;
    while (guard++ < 20000) {
      if (S.phase === 'play') {
        const c = candidates(S, cfg.width);
        const u = rand(); let i = 0, acc = 0;
        for (; i < cfg.pick.length - 1; i++) { acc += cfg.pick[i]; if (u < acc) break; }
        const p = c[Math.min(i, c.length - 1)];
        const ct = contactOf(S, p), boss = H.findBoss(S), bossHpBefore = boss ? boss.hp : 0, hp0 = S.hero.hp;
        const hadStairs = S.stairs;
        if (!p.length) F.rests = (F.rests || 0) + 1; // 力をためたターン(動けないときも含む)
        const k0 = S.kills; run(S, p); F.turns++; F.turnKills.push(S.kills - k0); // 1ターンに倒した数(連撃の出かた)
        if (!hadStairs) { F.qTurns++; F.qKills = S.kills; } // 階段が出るまでのターン数と倒した数
        F.taken += Math.max(0, hp0 - S.hero.hp); F.lastHp = hp0;
        if (ct) {
          const B = H.ETYPES[ct.e.type];
          F.contacts.push({ type: ct.e.type, pool: ct.pool, hp: ct.e.maxhp, base: B.hp, kill: ct.e.hp <= 0, boss: !!ct.e.boss });
        }
        if (boss) {
          const after = H.findBoss(S), d = bossHpBefore - (after ? after.hp : 0);
          if (d > 0) { F.bossStrokes++; F.bossDmg.push(d); } // 連撃でお供を倒してからボスを斬る線も数える
        }
        if (F.turns > 200) { F.stuck = true; floors.push(F); H.retryFloor(S); H.nextFloor(S); deathsHere = 0; begin(); } // 終わらない階は飛ばす(記録は残す)
      } else if (S.phase === 'dead') {
        F.died = true; F.killedBy = S.killedBy; F.hpBefore = F.lastHp; floors.push(F); deathsHere++;
        H.retryFloor(S);
        if (deathsHere >= 5) { F.skipped = true; H.nextFloor(S); deathsHere = 0; } // 5回死んだ階は飛ばして、深い階の数字も集める
        begin();
      } else if (S.phase === 'rest' || S.phase === 'win') {
        F.cleared = true; F.hpEnd = S.hero.hp; floors.push(F);
        if (S.phase === 'win' && maxFloor > H.LAST_FLOOR) { S.endless = true; S.phase = 'rest'; } // 「さらに深くへ」
        if (S.phase === 'win' || S.floor >= maxFloor) return { bot, seed, floors, reached: S.floor, won: S.phase === 'win' && !floors.some(F => F.skipped || F.stuck) };
        rest(S, rand, bot); H.nextFloor(S); deathsHere = 0; begin();
      } else break;
    }
    if (F && !floors.includes(F)) floors.push(F);
    return { bot, seed, floors, reached: S.floor, won: false };
  }
  return { run, candidates, playRun };
}

module.exports = { BOTS, load, makeSim };

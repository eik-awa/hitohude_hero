// ===== ひとふで勇者: ドット絵(24×24以内) =====
// 1文字 = 1ドット。'.' は透明、k は黒い輪郭、e は目(まばたきで閉じる)、それ以外は各キャラの pal で色を決める。
// mirror: 'even' / 'odd' のキャラは左半分だけを書き、右半分は反転して作る(odd は真ん中の列を共有)。
// alt は2コマ目(なければ上下に1ドット揺らす)。altPal は2コマ目だけ色を変える(火花のチカチカなど)。
// blink は目を閉じたときに塗る色(体の色の文字)。
'use strict';
window.SPRITES = (function () {
  const S = {};

  // ---------------- 勇者 ----------------
  S.hero = { // ちびキャラの勇者: 青い羽飾りの金の兜・青い服・左手に剣、右手に十字の盾
    pal: { a: '#2a5bd7', y: '#f5c842', w: '#fff2a8', o: '#c98a1c', c: '#4d4757', s: '#f8dfbd', e: '#16121c', m: '#e8493f',
      B: '#2457c5', C: '#4fc3f0', x: '#e9eef5', v: '#9fb0c4', g: '#a9adb8' }, blink: 's',
    map: [
      '.......kkkk......',
      '.....kkkaakkk....',
      '....kywyaayyyk...',
      '...kyyccccccyok..',
      '...kcccscscccck..',
      '...kccsssssscck..',
      '...kcssssssssck..',
      '...kssessssessk..',
      '.k.kssksssskssk..',
      'kxk.kssssssssk...',
      'kxk..kssmmssk....',
      'kxvk.kBBBBBBkkkk.',
      'kxvkkBBBCCCyyyyyk',
      '.kxyyBBBCCCyycyok',
      'kyyykBBCCCCycccok',
      '.kkykBCCCCCyycyok',
      '...k.kxxxxxxyook.',
      '.....kxgkkgxkkk..',
      '.....kyk..kyk....',
      '......k....k.....',
    ],
  };
  S.slime = { // まるくて小さめ。2コマ目でぷにっとつぶれる
    pal: { g: '#43c35a', h: '#9be8a8' }, blink: 'g',
    map: ['....kkkkkk....', '..kkggggggkk..', '.kghhgggggggk.', 'kghggggggggggk', 'kgggeggggegggk', 'kgggeggggegggk',
      'kggggggggggggk', 'kggggggggggggk', '.kggggggggggk.', '..kkkkkkkkkk..'],
    alt: ['....kkkkkk....', '..kkggggggkk..', '.kghhgggggggk.', 'kgggeggggegggk', 'kgggeggggegggk',
      'kggggggggggggk', 'kggggggggggggk', '.kggggggggggk.', '..kkkkkkkkkk..'],
  };
  S.king = {
    pal: { t: '#3ccfb4', h: '#a8f2e4', y: '#f0c030', r: '#e0463c' }, blink: 't',
    map: ['...y...yy...y...', '...yy.yyyy.yy...', '...yyyyyryyyy...', '...kkkkkkkkkk...', '..kttttttttttk..', '.kthhtttttttttk.',
      'kthttttttttttttk', 'kttttettttettttk', 'kttttettttettttk', 'kttttttttttttttk', 'kttttttttttttttk', '.kttttttttttttk.', '..kkkkkkkkkkkk..'],
    alt: ['...y...yy...y...', '...yy.yyyy.yy...', '...yyyyyryyyy...', '...kkkkkkkkkk...', '..kttttttttttk..', '.kthhtttttttttk.',
      'kttttettttettttk', 'kttttettttettttk', 'kttttttttttttttk', 'kttttttttttttttk', '.kttttttttttttk.', '..kkkkkkkkkkkk..'],
  };
  S.bat = {
    pal: { p: '#8b3fc4' }, blink: 'p', mirror: 'even',
    map: ['k..........', 'kk......k..', 'kpk....kpk.', 'kppk...kppk', 'kpppk.kpppp', 'kppppkppppp',
      'kpppppppepp', 'kpppppppepp', '.kppppppppp', '..kpppkpppw', '...kkk.kkkk'],
    alt: ['...........', '........k..', '.......kpk.', '.......kppk', '...kkkkpppp', '..kpppppppp',
      '.kppppppepp', 'kpppppppepp', 'kpppppppppp', 'kppkppppppw', '.kk.kkkkkkk'],
  };
  S.vampire = { // 吸血鬼の伯爵: 立てた襟・赤い裏地のマント・オールバック・牙
    pal: { n: '#1c1424', w: '#e6dde9', e: '#ff3040', r: '#b0182c', c: '#2a1030', y: '#f0c030' }, blink: 'w', mirror: 'even',
    map: ['......kkkk', '.....knnnn', '....knnnnn', '....knnwwn', '.k..knwwww', '.rk.kwwwew', '.rrkkwwwww', '.rrrkwwkkk',
      '.rrrkwwkwk', '.rrrrkwwww', '.rrrcckkkk', '..rccccccy', '..rccccccc', '.rcccccccc', 'rccccccccc', 'kkkkkkkkkk'],
    alt: ['......kkkk', '.....knnnn', '....knnnnn', '....knnwwn', '.k..knwwww', '.rk.kwwwew', '.rrkkwwwww', '.rrrkwwkkk',
      '.rrrkwwkwk', '.rrrrkwwww', '.rrrcckkkk', '..rccccccy', '.rcccccccc', 'rccccccccc', 'rcccckcccc', 'kk.kkkkkkk'],
  };
  // ---------------- 第3章 ----------------
  S.skel = { // 2コマ目であごをカタカタ鳴らす
    pal: { w: '#efe8d6' },
    map: ['...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkkwwkkwk.', '.kwwwkkwwwk.',
      '..kwwwwwwk..', '..kwkwwkwk..', '...kwwwwk...', '....kkkk....'],
    alt: ['...kkkkkk...', '..kwwwwwwk..', '.kwwwwwwwwk.', '.kwkkwwkkwk.', '.kwkkwwkkwk.', '.kwwwkkwwwk.',
      '..kwwwwwwk..', '..kkkkkkkk..', '..kwkwwkwk..', '...kwwwwk...', '....kkkk....'],
  };
  S.general = {
    pal: { w: '#efe8d6', r: '#c8352a', y: '#f0c030' },
    map: ['y............y', 'yy..kkkkkk..yy', '.yykrrrrrrkyy.', '..krrrrrrrrk..', '..kkkkkkkkkk..', '..kwkkwwkkwk..',
      '..kwkkwwkkwk..', '..kwwwkkwwwk..', '...kwwwwwwk...', '...kwkwwkwk...', '....kkkkkk....'],
    alt: ['y............y', 'yy..kkkkkk..yy', '.yykrrrrrrkyy.', '..krrrrrrrrk..', '..kkkkkkkkkk..', '..kwkkwwkkwk..',
      '..kwkkwwkkwk..', '..kwwwkkwwwk..', '...kwwwwwwk...', '...kkkkkkkk...', '...kwkwwkwk...', '....kkkkkk....'],
  };
  S.bomb = {
    pal: { n: '#2c2a36', w: '#f3eee2', y: '#ffd84a' }, altPal: { y: '#ff7a2a' },
    map: [
      '..............yy..',
      '.............yyyy.',
      '............k.yy..',
      '...........k......',
      '......kkkkkk......',
      '....kknnnnnnkk....',
      '...knnnnnnnnnnk...',
      '..knnnnnnnnnnnnk..',
      '..knwnnnnnnnnwnk..',
      '.knnnwwnnnnwwnnnk.',
      '.knnnnwnnnnwnnnnk.',
      '.knnnnnnnnnnnnnnk.',
      '..knnnnnnnnnnnnk..',
      '..knnnnnnnnnnnnk..',
      '...knnnnnnnnnnk...',
      '....kknnnnnnkk....',
      '......kkkkkk......',
    ],
  };
  S.bombking = {
    pal: { g: '#6fbf4a', y: '#f0c030', w: '#f3eee2', n: '#2c2a36', o: '#ff7a2a' }, blink: 'g', altPal: { o: '#ffd84a' },
    map: [
      '......y..y..y.........',
      '......yyyyyyy.........',
      '......yyyyyyy.........',
      'kk...kkkkkkkkk...kk...',
      '.kgkkgggggggggkkgk....',
      '..kgggggggggggggk.....',
      '...kggeggggeggggk.....',
      '...kggeggggeggggk.....',
      '...kgggggggggggk......',
      '...kgwkwkwkwkwgk...o..',
      '....kgwwwwwwwgk...k...',
      '.....kkkkkkkkk..kkkk..',
      '...............knnnnk.',
      '..............knnnnnnk',
      '..............knwnnwnk',
      '..............knnnnnnk',
      '...............knnnnk.',
      '................kkkk..',
    ],
  };

  // ---------------- 第5章 ----------------
  S.beetle = {
    pal: { b: '#2f4ea8', d: '#1c2d63', h: '#9fb3ff', e: '#ffd84a' }, blink: 'd', mirror: 'odd',
    map: ['.........h', '........kh', '........kh', '.....kkkkd', '....kdddddd'.slice(0, 10), '....kddedd', '....kddddd',
      '..kkkkkkkk', '.kbbbbbbbk', 'kbbhbbbbbk', 'kbbbbbbbbk', 'kbbbbbbbbk', 'kbbbbbbbbk', '.kbbbbbbbk', '..kkkkkkkk', '..k..k..k.'],
    alt: ['.........h', '........kh', '........kh', '.....kkkkd', '....kddddd', '....kddedd', '....kddddd',
      '..kkkkkkkk', '.kbbbbbbbk', 'kbbhbbbbbk', 'kbbbbbbbbk', 'kbbbbbbbbk', 'kbbbbbbbbk', '.kbbbbbbbk', '..kkkkkkkk', '.k..k..k..'],
  };
  S.stag = {
    pal: { o: '#8a4b22', d: '#4a2810', y: '#f0c030', e: '#ffd84a' }, blink: 'd', mirror: 'odd',
    map: ['..y........', '.yy........', '.y.........', '.yy......kk', '..yy...kkdd', '...yykkdddd', '....kdddeddd'.slice(0, 11),
      '.....kkkkkk', '...kkooooko'.slice(0, 11), '..kooooooko', 'k.kooooooko', '.kkooooooko', '..kooooooko',
      'k.kooooooko', '.kkooooooko', '...kkkkkkkk'],
  };

  // ---------------- 第6章 ----------------
  S.ghost = {
    pal: { w: '#eef0ff' }, blink: 'w', mirror: 'even',
    map: ['.....kkkk', '...kkwwww', '..kwwwwww', '.kwwwwwww', '.kwwweeww', '.kwwweeww', '.kwwwwwww',
      '.kwwwwwww', '.kwwwwwek', '.kwwwwwww', '.kwwwwwww', '.kwkwwkww', '.kk.kk.kk'],
    alt: ['.....kkkk', '...kkwwww', '..kwwwwww', '.kwwwwwww', '.kwwweeww', '.kwwweeww', '.kwwwwwww',
      '.kwwwwwww', '.kwwwwwek', '.kwwwwwww', '.kwwwwwww', '.kwwkwwwk', '..kk.kkk.'],
  };
  S.lich = {
    pal: { l: '#b8a6ff', y: '#f0c030', r: '#e0463c' }, blink: 'l', mirror: 'even',
    map: ['....y..y..', '....yy.yyy', '....yyyyyr', '...kkkkkkk', '..kkllllll', '.kllllllll', '.klllleell',
      '.klllleell', '.kllllllll', '.kllllllel', '.kllllllll', '.kllllllll', '.klkllklll', '.kk.kk.kkk'],
    alt: ['....y..y..', '....yy.yyy', '....yyyyyr', '...kkkkkkk', '..kkllllll', '.kllllllll', '.klllleell',
      '.klllleell', '.kllllllll', '.kllllllel', '.kllllllll', '.kllllllll', '.kllklllkl', '..kk.kkk.k'],
  };

  // ---------------- 第7章 ----------------
  S.golem = {
    pal: { o: '#8d7457', d: '#5e4b37', y: '#ffd24a' }, mirror: 'even',
    map: ['....kkkkkk', '...koooooo', '...kookooo', '...koyyooo', '...kooooko', '...kkkkkkk', 'kkkkoooooo',
      'koookooodo', 'kooookoooo', 'kookkooooo', 'kkk.kooooo', '....koodoo', '....kooook', '...kkkkk..'],
  };
  S.titan = {
    pal: { u: '#7890a8', d: '#4c6076', c: '#7fe8ff', x: '#d6dde8' }, mirror: 'even',
    map: ['.....x..xx', '.....xxxxx', '....kkkkkk', '...kuuuuuu', '...kuukuuu', '...kucccuu', '...kuuuuku',
      '...kkkkkkk', 'kkkkuuuuuu', 'kuuukuuudu', 'kuuuukuuuu', 'kuukkuuuuu', 'kkk.kuuuuu', '....kuuduu',
      '....kuuuuk', '...kkkkk..'],
    altPal: { c: '#c8f6ff' },
  };

  // ---------------- 第8章 ----------------
  S.shaman = {
    pal: { p: '#6b3fa0', o: '#9a7040', g: '#7dffa0' }, altPal: { g: '#3fbf6a' },
    map: [
      '......kkkk......g.',
      '....kkppppkk...ggg',
      '...kppppppppk...g.',
      '..kppkkkkkkppk..o.',
      '..kpkkgkkgkkpk..o.',
      '..kpkkkkkkkkpk..o.',
      '..kppkkkkkkppk..o.',
      '..kppppppppppkkko.',
      '.kpppppppppppppko.',
      '.kppppppppppppk.o.',
      'kppppppppppppppko.',
      'kpppppppppppppppk.',
      'kkkkkkkkkkkkkkkk..',
    ],
  };
  S.priest = {
    pal: { w: '#efe8d8', y: '#f0c030', g: '#ffe27a' }, altPal: { g: '#fff6c0' },
    map: [
      '.......kk.........',
      '......kyyk......g.',
      '.....kyyyyk....ggg',
      '.....kyyyyk.....g.',
      '....kyyyyyyk....y.',
      '...kkkkkkkkkk...y.',
      '..kwkkkkkkkkwk..y.',
      '..kwkkgkkgkkwk..y.',
      '..kwkkkkkkkkwk..y.',
      '..kwwwkkkkwwwkkky.',
      '.kwwwwwyywwwwwwky.',
      '.kwwwwwyywwwwwk.y.',
      'kwwwwwwyywwwwwwky.',
      'kwwwwwwyywwwwwwwk.',
      'kkkkkkkkkkkkkkkkk.',
    ],
  };

  // ---------------- 第9章 ----------------
  S.fire = {
    pal: { o: '#ff7a2a', y: '#ffd34a' }, blink: 'y', mirror: 'even',
    map: ['.........k', '........ko', '.......koo', '.....k.koo', '....kokooo', '...koooooo', '..kooooyyy',
      '..koooyyyy', '.kooyyeyyy', '.kooyyeyyy', '.kooyyyyyy', '..kooyyyyy', '...kkooooo', '.....kkkkk'],
    alt: ['..........', '........k.', '.......kok', '...k..kooo', '..kok.kooo', '...kooooyo', '..koooyyyy',
      '..kooyyyyy', '.kooyyeyyy', '.kooyyeyyy', '.kooyyyyyy', '..kooyyyyy', '...kkooooo', '.....kkkkk'],
  };
  S.ifrit = { // 炎の魔人: 燃える髪・金の額飾りとねじれた角・腕組みならぬ力こぶ、下半身は炎
    pal: { r: '#d8331c', d: '#8e1c12', h: '#ff7a4a', o: '#ff9a3c', y: '#ffd34a', w: '#fff6c8', n: '#4a2418', e: '#fff6c8', g: '#f0c030' }, blink: 'd', mirror: 'even',
    map: [
      '........y..',
      '....y..yo.y',
      'n...yoyooyo',
      'nn..oyoyooo',
      '.nk.kooooyo',
      '..nnkgggggg',
      '...kkrrhrrr',
      '....krdddrr',
      '....krrkeer',
      '....krrrrrr',
      '....kdrkwkk',
      '..kkkkdrkkk',
      '.kohrrkrrrr',
      'kohrrrrrhrr',
      'korrkdrrrrd',
      'krrk.krrrdr',
      'kggk.kgggwg',
      'yowyk.koooo',
      '.yyk..kyooo',
      '..k....kyoo',
      '........kyy',
      '.........ky',
    ],
    alt: [
      '.......y...',
      '...y...oy.y',
      'n..yo.yoyyo',
      'nn.oyoyoooo',
      '.nk.kooooyo',
      '..nnkgggggg',
      '...kkrrhrrr',
      '....krdddrr',
      '....krrkeer',
      '....krrrrrr',
      '....kdrkwkk',
      '..kkkkdrkkk',
      '.kohrrkrrrr',
      'kohrrrrrhrr',
      'korrkdrrrrd',
      'krrk.krrrdr',
      'kggk.kgggwg',
      '.yyyk.koooo',
      'yowk..kyooo',
      '.yk....kyoo',
      '........kyo',
      '........ky.',
    ],
  };

  // ---------------- 第10章 ----------------
  S.drake = {
    pal: { g: '#4caf50', y: '#e8d27a', e: '#ffd84a', r: '#c8352a' }, blink: 'g', mirror: 'even',
    map: ['.ky.......', '.kyy......', '..kyy.....', '..kgkkkkkk', '.kgggggggg', '.kgggggggg', 'kggegggggg',
      'kgeegggggg', 'kggggggggg', '.kgggggggg', '..kgggkkkk', '..kggk.wkk'.replace('w', 'k'), '...kggkkkk', '....kkkkkk'],
    alt: ['.ky.......', '.kyy......', '..kyy.....', '..kgkkkkkk', '.kgggggggg', '.kgggggggg', 'kggegggggg',
      'kgeegggggg', 'kggggggggg', '.kgggggggg', '..kgggkkkk', '..kggkrrrr', '..kggkrrrr', '...kggkkkk', '....kkkkkk'],
  };
  S.dragon = { // 魔竜: 広げた翼・反りかえった2本の角・金の目・口の奥に炎、腹はうろこの段
    pal: { r: '#c9342a', d: '#7a1820', h: '#ff6a4a', w: '#efe2c8', b: '#f0c070', c: '#c98a3a', m: '#5a1626', e: '#ffd84a', o: '#ff9a3c', y: '#ffe27a' }, blink: 'r', mirror: 'even',
    map: [
      'k...........',
      'kk..w.......',
      'kdk.wk......',
      'kmdkkwk.....',
      'kmmdkkwk....',
      'kmmmdkkwk.kk',
      'kmmmmdkkwkrk',
      'kmmdmmkhrrrr',
      'kmdmmmkrkkrr',
      'kdmmmmkrreek',
      'kmmmdmmkrhrr',
      '.kmmdmmmkrrr',
      '.kmdmmmmkrdr',
      '..kmmmdmkwkk',
      '..kmmdkkkooo',
      '...kkkrrkkkk',
      '....krrkbbbb',
      '...krrrkcccc',
      '..kwkrrkbbbb',
      '..kwwkrrkccc',
      '...kkkrrrkbb',
      '....kkkkkkkk',
    ],
    alt: [
      'k...........',
      'kk..w.......',
      'kdk.wk......',
      'kmdkkwk.....',
      'kmmdkkwk....',
      'kmmmdkkwk.kk',
      'kmmmmdkkwkrk',
      'kmmdmmkhrrrr',
      'kmdmmmkrkkrr',
      'kdmmmmkrreek',
      'kmmmdmmkrhrr',
      '.kmmdmmmkrrr',
      '.kmdmmmmkrdr',
      '..kmmmdmkwkk',
      '..kmmdkkkyyy',
      '...kkkrrkooo',
      '....krrkbkkk',
      '...krrrkcccc',
      '..kwkrrkbbbb',
      '..kwwkrrkccc',
      '...kkkrrrkbb',
      '....kkkkkkkk',
    ],
  };

  // ---------------- マスの物 ----------------
  S.sword = {
    pal: { x: '#e9eef5', s: '#9fb0c4', y: '#e8b630', o: '#7a4a2a' },
    map: [
      '.............kk.',
      '............kxsk',
      '...........kxsk.',
      '..........kxsk..',
      '.........kxsk...',
      '........kxsk....',
      '.......kxsk.....',
      '..kk..kxsk......',
      '..kykkxsk.......',
      '...kyksk........',
      '...kkyk.........',
      '..kokkyk........',
      '.kok..kyk.......',
      'kok....kk.......',
      'kk..............',
    ],
  };
  S.heart = {
    pal: { r: '#ff4d6a', w: '#ffd0d8' },
    map: ['.kkk...kkk.', 'krrrk.krrrk', 'krwwrkrrrrk', 'krwrrrrrrrk', 'krrrrrrrrrk', '.krrrrrrrk.',
      '..krrrrrk..', '...krrrk...', '....krk....', '.....k.....'],
  };
  S.rock = {
    pal: { a: '#8a8478', b: '#b5afa2', d: '#5e5a52' },
    map: ['....kkkkkk......', '..kkaaaaaakk....', '.kaaaabbaaaakk..', '.kabbaaaaaaaaak.', 'kaaaaaaaadaaaak.',
      'kaaaaaaaddaaaaak', 'kaaaaadaaaaaaaak', 'kaaaaaaaaaaaddak', '.kaaaaaaaaaaaak.', '..kkkkkkkkkkkk..'],
  };
  S.coin = { // 丸い金貨。左上が光り、右下が影。まん中にひし形の刻印
    pal: { y: '#ffcf3a', w: '#fff0a0', a: '#ffffff', o: '#c98a14', d: '#8a5a0c' },
    map: ['...kkkkkk...', '.kkwwyyyykk.', '.kwayyyyyok.', 'kwyyyooyyyok', 'kwyyoyyoyyok', 'kyyoyyyyoyok', 'kyyoyyyyoydk', 'kyyyoyyoyydk', 'kyyyyooyyodk', '.kyyyyyyodk.', '.kkyyyoodkk.', '...kkkkkk...'],
  };
  S.shield = {
    pal: { b: '#3f9fd0', w: '#e8f6ff' }, mirror: 'even',
    map: ['kkkkkkkk', 'kbbbbbbw', 'kbbbbbbw', 'kbbbbbbw', 'kwwwwwww', 'kbbbbbbw', 'kbbbbbbw', '.kbbbbbw', '.kbbbbbw', '..kbbbbw', '...kbbbw', '....kkkk'],
  };
  S.stairs = { // 横から見た下り階段。右下へ下りるほど段が暗くなり、奥は闇。金の矢印で「下へ」
    pal: { a: '#fff3b8', y: '#ffe27a', o: '#c9962e', d: '#8a6420', m: '#4e3814', n: '#141019', g: '#ffcf3a' },
    map: [
      'kkkkkkkkkkkkkkkk',
      'kaaaaannnnnggnnk',
      'kyyyyynnnnnggnnk',
      'kyyyyynnnnnggnnk',
      'kyyyyyaaanggggnk',
      'kyyyyyooonnggnnk',
      'kyyyyyooonnnnnnk',
      'kyyyyyoooaaannnk',
      'kyyyyyooodddnnnk',
      'kyyyyyooodddnnnk',
      'kyyyyyooodddaaak',
      'kyyyyyooodddmmmk',
      'kyyyyyooodddmmmk',
      'kkkkkkkkkkkkkkkk',
    ],
  };
  S.ash = {
    pal: { a: '#6b6672', b: '#8d8794' }, mirror: 'even',
    map: ['......kk', '.....kbb', '....kaaa', '..kkkaaa', '.kbbkaaa', 'kaaaaaaa', 'kkkkkkkk'],
  };
  return S;
})();

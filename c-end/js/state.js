/**
 * 萌宠乐园 — shared state (localStorage)
 * VIP庄园已砍掉（不做）；游戏厅 / 平台划转：非本需求（out of scope）
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'vip_butler_pet_v3';
  const LEGACY_KEYS = ['vip_butler_pet_v2'];

  /** VIP level table: level index 0..5 → XP needed to reach that level */
  const VIP_LEVELS = [
    { level: 0, tier: 'VIP0s', needXp: 0, cashback: 0, maxCashback: 0 },
    { level: 1, tier: 'VIP1s', needXp: 200, cashback: 1, maxCashback: 888 },
    { level: 2, tier: 'VIP2s', needXp: 1000, cashback: 2, maxCashback: 1888 },
    { level: 3, tier: 'VIP3s', needXp: 5000, cashback: 3, maxCashback: 3888 },
    { level: 4, tier: 'VIP4s', needXp: 15000, cashback: 4, maxCashback: 6888 },
    { level: 5, tier: 'VIP5s', needXp: 50000, cashback: 5, maxCashback: 9999 },
  ];

  const XP_RULES = {
    claimCashback: 30,
    depositDemo: 25,
    dailyTask: {
      login: 50,
      claimCashback: 40,
      visitVip: 40,
      watchVideo: 60,
      carePet: 35,
    },
    demoBump: 500,
    care: {
      feed: 8,
      play: 8,
      drink: 6,
      clean: 8,
      itemBonus: 4,
    },
  };

  /** 今日养宠积分（与 VIP XP 独立；自然日重置）— 全免费互动，无付费 */
  const DAILY_POINTS = {
    feed: 10,
    play: 10,
    drink: 10,
    clean: 10,
    pat: 8,
    walk: 12,
    story: 8,
    snack: 8,
    photo: 14,
    helpFriend: 15,
    itemBonus: 5,
    chat: 4,
    questBonus: 20,
    comboBonus: 8,
  };

  /** 亲密度动作：每点 intimacy 计入 careCount（每 5 点升 1 Care Level） */
  const INTIMACY_ACTIONS = {
    feed: { label: '喂食', intimacy: 1, xp: 8, icon: '🍖', need: 'eat' },
    play: { label: '玩耍', intimacy: 1, xp: 8, icon: '🎾', need: 'play' },
    drink: { label: '喝水', intimacy: 1, xp: 6, icon: '💧', need: 'drink' },
    clean: { label: '清洁', intimacy: 1, xp: 8, icon: '🛁' },
    pat: { label: '抚摸', intimacy: 1, xp: 5, icon: '🖐' },
    walk: { label: '陪伴散步', intimacy: 2, xp: 6, icon: '🚶', need: 'play' },
    story: { label: '讲故事', intimacy: 1, xp: 5, icon: '📖' },
    snack: { label: '喂零食', intimacy: 1, xp: 5, icon: '🍪', need: 'eat' },
    photo: { label: '合影', intimacy: 2, xp: 6, icon: '📷' },
  };

  function emptyStageKinds() {
    const o = { chat: 0 };
    Object.keys(INTIMACY_ACTIONS).forEach(function (k) {
      o[k] = 0;
    });
    return o;
  }

  function normalizeStageKinds(raw) {
    const o = emptyStageKinds();
    if (!raw || typeof raw !== 'object') return o;
    Object.keys(o).forEach(function (k) {
      o[k] = Math.max(0, Number(raw[k]) || 0);
    });
    return o;
  }

  function inferredKinds(acts) {
    const n = Math.max(0, Number(acts) || 0);
    const o = emptyStageKinds();
    if (n <= 0) return o;
    o.feed = Math.max(2, Math.round(n * 0.32));
    o.play = Math.max(1, Math.round(n * 0.18));
    o.pat = Math.max(2, Math.round(n * 0.22));
    o.drink = Math.max(1, Math.round(n * 0.1));
    o.clean = Math.max(1, Math.round(n * 0.08));
    o.walk = Math.max(0, Math.round(n * 0.04));
    o.chat = Math.max(1, Math.round(n * 0.06));
    return o;
  }

  function kindsFromRow(row) {
    const k = normalizeStageKinds(row && row.kinds);
    let sum = 0;
    Object.keys(k).forEach(function (key) {
      sum += k[key];
    });
    if (sum > 0) return k;
    return inferredKinds(row && row.acts);
  }

  function actionRowsFromKinds(kinds) {
    const order = ['feed', 'play', 'drink', 'clean', 'pat', 'walk', 'story', 'snack', 'photo', 'chat'];
    const rows = [];
    order.forEach(function (id) {
      const n = (kinds && kinds[id]) || 0;
      if (!n) return;
      const meta =
        id === 'chat' ? { icon: '💬', label: '对话' } : INTIMACY_ACTIONS[id];
      if (!meta) return;
      rows.push({ id: id, icon: meta.icon, label: meta.label, count: n });
    });
    return rows;
  }

  /** 主动需求：满足后 24h 安静；到期后再次提醒 */
  const NEED_SATISFY_MS = 24 * 60 * 60 * 1000;
  const PET_NEED_DEFS = {
    eat: {
      id: 'eat',
      label: '想吃',
      satisfiedLabel: '饱食满足',
      action: 'feed',
      icon: '🍖',
      bubble: '肚子饿了…喂我一口好不好？',
      lambing: '喂食',
      flag: 'hungry',
      evolveNudge: '先喂我一口，才长得快呀',
    },
    play: {
      id: 'play',
      label: '想玩',
      satisfiedLabel: '玩乐满足',
      action: 'play',
      icon: '🎾',
      bubble: '陪我玩嘛…好想和你一起玩。',
      lambing: '玩耍',
      flag: 'wantPlay',
      evolveNudge: '陪我玩一会儿，下一形态就更近了',
    },
    drink: {
      id: 'drink',
      label: '想喝',
      satisfiedLabel: '饮水满足',
      action: 'drink',
      icon: '💧',
      bubble: '好渴呀，给我喝一口？',
      lambing: '喝水',
      flag: 'wantDrink',
      evolveNudge: '先喝一口，我们再一起长大',
    },
  };
  const PET_NEED_KEYS = ['eat', 'play', 'drink'];

  /** 每日亲密度任务（抚养循环） */
  const DAILY_INTIMACY_QUESTS = [
    { id: 'pat', kind: 'pat', need: 3, label: '抚摸 3 次' },
    { id: 'chat', kind: 'chat', need: 1, label: '对话 1 次' },
    { id: 'feed', kind: 'feed', need: 2, label: '喂食 2 次' },
  ];
  const QUEST_INTIMACY_BONUS = 3;
  /** 领取今日深度抚养（亲密度任务）时附带少量 VIP XP */
  const QUEST_VIP_XP = 20;
  const COMBO_KIND_NEED = 3;
  const INTIMACY_PER_LEVEL = 5;
  /** 亲密度每 5 点升 1 Care Level；形态进阶另计抚养日+互动（档越高越久） */
  /** 终极形态（VIP5）达成奖励 · 每品种自选一次 · 非充值 */
  const ULTIMATE_REWARD_OPTIONS = [
    {
      id: 'cash88',
      name: '现金奖励 ₱88',
      desc: '养成达成 · 入账钱包 P · 非充值',
      icon: '💵',
      kind: 'cash',
      amount: 88,
    },
    {
      id: 'cash188',
      name: '现金奖励 ₱188',
      desc: '稀有额度 · 入账钱包 P · 非充值',
      icon: '💰',
      kind: 'cash',
      amount: 188,
      rare: true,
    },
    {
      id: 'intimacyPack',
      name: '亲密度大礼包',
      desc: '亲密度进度 +8（约升 1～2 Care Level）',
      icon: '💕',
      kind: 'intimacy',
      amount: 8,
    },
    {
      id: 'dailyPoints',
      name: '今日积分加成',
      desc: '今日养宠积分立刻 +50',
      icon: '⭐',
      kind: 'points',
      amount: 50,
    },
    {
      id: 'doubleBuff',
      name: '24h 双倍亲密度',
      desc: '此后 24 小时照料/对话亲密度翻倍',
      icon: '✨',
      kind: 'buff',
      hours: 24,
    },
  ];

  const HELP_QUOTA_DAILY = 3;
  /** 亲密度等级保护窗：互动后 24h 内不降；超时未互动则亲密度 -1（下限 Lv.1；不影响 VIP） */
  const CARE_PROTECT_MS = 24 * 60 * 60 * 1000;
  const CARE_PROTECT_WARN_MS = 3 * 60 * 60 * 1000;
  const USER_RANK_ID = 'me';
  const USER_DISPLAY_NAME = '我（你）';

  /** Philippine mythic VIP-butler species (cute reinterpretations) */
  const PET_SPECIES_IDS = [
    'sarimanok',
    'bakunawa',
    'diwata',
    'tigmamanukan',
    'sirena',
    'kapre',
  ];

  const LEGACY_SPECIES_MAP = {
    dog: 'kapre',
    cat: 'sarimanok',
    tikbalang: 'kapre',
  };

  /** Soft fallback only for friends/rank/gallery when species missing */
  const SPECIES_FALLBACK = 'sarimanok';

  const PET_SPECIES = {
    sarimanok: {
      id: 'sarimanok',
      label: '彩羽神鸟',
      labelEn: 'Sarimanok',
      tone: '啾',
      cue: '啾~',
      unit: '神鸟',
      loreEn: 'Maranao lucky bird',
      loreZh: '吉祥彩羽',
    },
    bakunawa: {
      id: 'bakunawa',
      label: '月食神龙',
      labelEn: 'Bakunawa',
      tone: '嗷',
      cue: '嗷~',
      unit: '神龙',
      loreEn: 'Moon serpent',
      loreZh: '守护月光',
    },
    diwata: {
      id: 'diwata',
      label: '山林精灵',
      labelEn: 'Diwata',
      tone: '叮',
      cue: '叮~',
      unit: '精灵',
      loreEn: 'Nature spirit',
      loreZh: '守护山林',
    },
    tigmamanukan: {
      id: 'tigmamanukan',
      label: '吉兆灵鸟',
      labelEn: 'Tigmamanukan',
      tone: '啼',
      cue: '啼~',
      unit: '灵鸟',
      loreEn: 'Sacred omen bird · Bathala',
      loreZh: '吉兆护行',
    },
    sirena: {
      id: 'sirena',
      label: '海之仙女',
      labelEn: 'Sirena',
      tone: '哼',
      cue: '哼~',
      unit: '海仙',
      loreEn: 'Sea maiden',
      loreZh: '守护海域',
    },
    kapre: {
      id: 'kapre',
      label: '树精守护神',
      labelEn: 'Kapre',
      tone: '呵',
      cue: '呵~',
      unit: '树精',
      loreEn: 'Tree giant guardian',
      loreZh: '守护巨树的山林神灵',
    },
  };

  const PET_FORMS_BY_SPECIES = {
    sarimanok: {
      0: { id: 'sari_hatch', name: '幼羽彩鸟', formTitle: '幼宠', emoji: '🐣', stage: 'baby', accent: '#ffd4a8', desc: '彩羽神鸟 · 入门幼羽' },
      1: { id: 'sari_silver', name: '银徽彩羽', formTitle: '银徽', emoji: '🐤', stage: 'baby', accent: '#b8c4d8', desc: '彩羽神鸟 · VIP1 银徽' },
      2: { id: 'sari_butler', name: '管家彩鸟', formTitle: '管家', emoji: '🐦', stage: 'buddy', accent: '#ffb86b', desc: '彩羽神鸟 · VIP2 管家' },
      3: { id: 'sari_golden', name: '金甲彩羽', formTitle: '金甲', emoji: '🦜', stage: 'buddy', accent: '#f5c542', desc: '彩羽神鸟 · VIP3 金甲' },
      4: { id: 'sari_winged', name: '翼彩神鸟', formTitle: '翼宠', emoji: '🦢', stage: 'elite', accent: '#7eb6ff', desc: '彩羽神鸟 · VIP4 翼形态' },
      5: { id: 'sari_crowned', name: '冠羽吉祥鸟', formTitle: '冠宠', emoji: '🦚', stage: 'legend', accent: '#c9a0ff', desc: '彩羽神鸟 · VIP5 冠宠' },
    },
    bakunawa: {
      0: { id: 'baku_egg', name: '月卵幼龙', formTitle: '幼宠', emoji: '🥚', stage: 'baby', accent: '#ffd4a8', desc: '月食神龙 · 入门幼龙' },
      1: { id: 'baku_silver', name: '银徽月蛟', formTitle: '银徽', emoji: '🦎', stage: 'baby', accent: '#b8c4d8', desc: '月食神龙 · VIP1 银徽' },
      2: { id: 'baku_butler', name: '管家月蛇', formTitle: '管家', emoji: '🐍', stage: 'buddy', accent: '#ffb86b', desc: '月食神龙 · VIP2 管家' },
      3: { id: 'baku_golden', name: '金甲月龙', formTitle: '金甲', emoji: '🐲', stage: 'buddy', accent: '#f5c542', desc: '月食神龙 · VIP3 金甲' },
      4: { id: 'baku_winged', name: '翼月神龙', formTitle: '翼宠', emoji: '🌌', stage: 'elite', accent: '#7eb6ff', desc: '月食神龙 · VIP4 翼形态' },
      5: { id: 'baku_crowned', name: '冠月食神龙', formTitle: '冠宠', emoji: '🐉', stage: 'legend', accent: '#c9a0ff', desc: '月食神龙 · VIP5 冠宠' },
    },
    diwata: {
      0: { id: 'diwa_sprout', name: '幼芽精灵', formTitle: '幼宠', emoji: '🌱', stage: 'baby', accent: '#ffd4a8', desc: '山林精灵 · 入门幼芽' },
      1: { id: 'diwa_silver', name: '银徽林灵', formTitle: '银徽', emoji: '🍃', stage: 'baby', accent: '#b8c4d8', desc: '山林精灵 · VIP1 银徽' },
      2: { id: 'diwa_butler', name: '管家山林', formTitle: '管家', emoji: '🌿', stage: 'buddy', accent: '#ffb86b', desc: '山林精灵 · VIP2 管家' },
      3: { id: 'diwa_golden', name: '金甲灵光', formTitle: '金甲', emoji: '✨', stage: 'buddy', accent: '#f5c542', desc: '山林精灵 · VIP3 金甲' },
      4: { id: 'diwa_winged', name: '翼林精灵', formTitle: '翼宠', emoji: '🦋', stage: 'elite', accent: '#7eb6ff', desc: '山林精灵 · VIP4 翼形态' },
      5: { id: 'diwa_crowned', name: '冠山林精灵', formTitle: '冠宠', emoji: '🧚', stage: 'legend', accent: '#c9a0ff', desc: '山林精灵 · VIP5 冠宠' },
    },
    tigmamanukan: {
      0: { id: 'tig_chick', name: '幼兆灵鸟', formTitle: '幼宠', emoji: '🐤', stage: 'baby', accent: '#ffd4a8', desc: '吉兆灵鸟 · 入门幼兆' },
      1: { id: 'tig_silver', name: '银徽吉兆', formTitle: '银徽', emoji: '🐦', stage: 'baby', accent: '#b8c4d8', desc: '吉兆灵鸟 · VIP1 银徽' },
      2: { id: 'tig_butler', name: '管家灵鸟', formTitle: '管家', emoji: '🕊️', stage: 'buddy', accent: '#ffb86b', desc: '吉兆灵鸟 · VIP2 管家' },
      3: { id: 'tig_golden', name: '金甲兆羽', formTitle: '金甲', emoji: '🦉', stage: 'buddy', accent: '#f5c542', desc: '吉兆灵鸟 · VIP3 金甲' },
      4: { id: 'tig_winged', name: '翼吉兆鸟', formTitle: '翼宠', emoji: '🪽', stage: 'elite', accent: '#7eb6ff', desc: '吉兆灵鸟 · VIP4 翼形态' },
      5: { id: 'tig_crowned', name: '冠吉兆灵鸟', formTitle: '冠宠', emoji: '🦅', stage: 'legend', accent: '#c9a0ff', desc: '吉兆灵鸟 · VIP5 冠宠' },
    },
    sirena: {
      0: { id: 'sire_bubble', name: '幼浪海仙', formTitle: '幼宠', emoji: '🫧', stage: 'baby', accent: '#ffd4a8', desc: '海之仙女 · 入门幼浪' },
      1: { id: 'sire_silver', name: '银徽海珠', formTitle: '银徽', emoji: '🐚', stage: 'baby', accent: '#b8c4d8', desc: '海之仙女 · VIP1 银徽' },
      2: { id: 'sire_butler', name: '管家海灵', formTitle: '管家', emoji: '🐟', stage: 'buddy', accent: '#ffb86b', desc: '海之仙女 · VIP2 管家' },
      3: { id: 'sire_golden', name: '金甲海仙', formTitle: '金甲', emoji: '🐠', stage: 'buddy', accent: '#f5c542', desc: '海之仙女 · VIP3 金甲' },
      4: { id: 'sire_winged', name: '翼潮仙女', formTitle: '翼宠', emoji: '🌊', stage: 'elite', accent: '#7eb6ff', desc: '海之仙女 · VIP4 翼形态' },
      5: { id: 'sire_crowned', name: '冠海之仙女', formTitle: '冠宠', emoji: '🧜', stage: 'legend', accent: '#c9a0ff', desc: '海之仙女 · VIP5 冠宠' },
    },
    kapre: {
      0: { id: 'kap_sprout', name: '幼芽树精', formTitle: '幼宠', emoji: '🪵', stage: 'baby', accent: '#ffd4a8', desc: '树精守护神 · 入门幼芽' },
      1: { id: 'kap_silver', name: '银徽树灵', formTitle: '银徽', emoji: '🌿', stage: 'baby', accent: '#b8c4d8', desc: '树精守护神 · VIP1 银徽' },
      2: { id: 'kap_butler', name: '管家树精', formTitle: '管家', emoji: '🌳', stage: 'buddy', accent: '#ffb86b', desc: '树精守护神 · VIP2 管家' },
      3: { id: 'kap_golden', name: '金甲树卫', formTitle: '金甲', emoji: '🛡️', stage: 'buddy', accent: '#f5c542', desc: '树精守护神 · VIP3 金甲' },
      4: { id: 'kap_winged', name: '翼林树神', formTitle: '翼宠', emoji: '🎋', stage: 'elite', accent: '#7eb6ff', desc: '树精守护神 · VIP4 翼形态' },
      5: { id: 'kap_crowned', name: '冠树精守护神', formTitle: '冠宠', emoji: '🏯', stage: 'legend', accent: '#c9a0ff', desc: '树精守护神 · VIP5 冠宠' },
    },
  };

  /** 兼容旧引用：展示用默认形态表（未选种前） */
  const PET_FORMS_BY_VIP = PET_FORMS_BY_SPECIES.sarimanok;

  /** 六套立绘入库：VIP 档可随时切换（不付费）；最终留哪几套后定 */
  const ART_STYLES = [
    { id: 'neutral', label: '中性', hint: '产品中性立绘' },
    { id: 'sacred', label: '神圣', hint: '神灵祭礼气质' },
    { id: 'cute', label: '可爱', hint: 'Q 版抚养向' },
    { id: 'inkgold', label: '墨金', hint: '身上墨黑古金' },
    { id: 'obsidian', label: '玄祀', hint: '身上玄金配色' },
    { id: 'duskgold', label: '暮金', hint: '身上暮铜金' },
  ];
  const ART_STYLE_IDS = ART_STYLES.map(function (s) {
    return s.id;
  });
  const ART_SHEET_REL = {
    sacred: ['神圣', '{sp}-sacred-ui.png'],
    cute: ['可爱', '{sp}-cute-ui.png'],
    inkgold: ['墨金', '{sp}-inkgold-ui.png'],
    obsidian: ['玄祀', '{sp}-obsidian-ui.png'],
    duskgold: ['暮金', '{sp}-duskgold-ui.png'],
  };
  const FORM_STAGE_TITLES = ['幼宠', '银徽', '管家', '金甲', '翼宠', '冠宠'];
  /**
   * 当前形态 → 下一形态：合格抚养日（每 24h 互动最多计 1 天）+ 本档互动次数。
   * 档越高越久，用来拉登录粘性；VIP 只作可成长上限，不跳形态。
   */
  const STAGE_GROWTH = [
    { from: 0, to: 1, needDays: 1, needActs: 6 },
    { from: 1, to: 2, needDays: 2, needActs: 12 },
    { from: 2, to: 3, needDays: 3, needActs: 20 },
    { from: 3, to: 4, needDays: 5, needActs: 36 },
    { from: 4, to: 5, needDays: 7, needActs: 56 },
  ];

  function normalizeArtStyle(raw) {
    return ART_STYLE_IDS.indexOf(raw) >= 0 ? raw : 'neutral';
  }

  function artStyleLabel(raw) {
    const st = normalizeArtStyle(raw);
    for (let i = 0; i < ART_STYLES.length; i++) {
      if (ART_STYLES[i].id === st) return ART_STYLES[i].label;
    }
    return ART_STYLES[0].label;
  }

  function artSheetUrl(species, style) {
    const sp = resolveSpecies(species, SPECIES_FALLBACK);
    const st = normalizeArtStyle(style);
    const folder = encodeURI('神兽形态UI');
    const rel = ART_SHEET_REL[st];
    if (rel) {
      return '../docs/' + folder + '/' + encodeURI(rel[0]) + '/' + rel[1].replace('{sp}', sp);
    }
    return '../docs/' + folder + '/' + sp + '-forms-ui.png';
  }

  /** 单档立绘（从六档总览图裁出），相对 c-end/ 与 h5/ 页面 */
  function formArtUrl(species, style, tier) {
    const sp = resolveSpecies(species, SPECIES_FALLBACK);
    const st = normalizeArtStyle(style);
    const t = clampEvoTier(tier);
    return '../docs/beast-art/' + st + '/' + sp + '-' + t + '.png';
  }

  /**
   * 六档总览图（1536×1024，中间一排 6 张卡）裁出单档。
   * mode: 'portrait' 只取神兽立绘；'card' 含档位标题。
   */
  function formArtFrame(tier, mode) {
    const t = clampEvoTier(tier);
    const imgW = 1536;
    const imgH = 1024;
    const x0 = 54;
    const step = 245;
    const w = 214;
    const y = mode === 'card' ? 288 : 336;
    const h = mode === 'card' ? 500 : 328;
    const x = x0 + t * step;
    const sizeX = (imgW / w) * 100;
    const sizeY = (imgH / h) * 100;
    const posX = imgW > w ? (x / (imgW - w)) * 100 : 0;
    const posY = imgH > h ? (y / (imgH - h)) * 100 : 50;
    return {
      tier: t,
      mode: mode === 'card' ? 'card' : 'portrait',
      backgroundSize: sizeX.toFixed(2) + '% ' + sizeY.toFixed(2) + '%',
      backgroundPosition: posX.toFixed(2) + '% ' + posY.toFixed(2) + '%',
    };
  }

  function emptyUltimateClaimed() {
    const o = {};
    PET_SPECIES_IDS.forEach(function (id) {
      o[id] = false;
    });
    return o;
  }

  function normalizeSpecies(sp) {
    if (sp == null || sp === '') return null;
    const raw = String(sp);
    if (LEGACY_SPECIES_MAP[raw]) return LEGACY_SPECIES_MAP[raw];
    return PET_SPECIES[raw] ? raw : null;
  }

  function resolveSpecies(sp, fallback) {
    return normalizeSpecies(sp) || fallback || null;
  }

  function petFormForVip(vip, species) {
    const sp = resolveSpecies(species, SPECIES_FALLBACK);
    const lv = Math.max(0, Math.min(5, Math.floor(Number(vip) || 0)));
    const table = PET_FORMS_BY_SPECIES[sp] || PET_FORMS_BY_SPECIES[SPECIES_FALLBACK];
    const form = table[lv] || table[0];
    return Object.assign({ species: sp, tier: lv }, form);
  }

  function hasChosenSpecies(pet) {
    return !!(pet && pet.speciesChosen && normalizeSpecies(pet.species));
  }

  function clampEvoTier(n) {
    return Math.max(0, Math.min(5, Math.floor(Number(n) || 0)));
  }

  /** 展示形态 = 抚养进化档；VIP 不跳形态，只限制可进化上限 */
  function petDisplayTier(pet) {
    return clampEvoTier(pet && pet.evoTier);
  }

  function stageGrowthNeed(evoTier) {
    const t = clampEvoTier(evoTier);
    return STAGE_GROWTH[t] || null;
  }

  function ensureStageProgress(pet) {
    if (!pet) return;
    if (pet.stageEnteredAt == null) pet.stageEnteredAt = Number(pet.adoptedAt) || Date.now();
    pet.stageNurtureDays = Math.max(0, Number(pet.stageNurtureDays) || 0);
    pet.stageActCount = Math.max(0, Number(pet.stageActCount) || 0);
    pet.stageLastQualifyAt = Math.max(0, Number(pet.stageLastQualifyAt) || 0);
    pet.stageActKinds = normalizeStageKinds(pet.stageActKinds);
  }

  function resetStageProgress(pet) {
    if (!pet) return;
    pet.stageEnteredAt = Date.now();
    pet.stageNurtureDays = 0;
    pet.stageActCount = 0;
    pet.stageLastQualifyAt = 0;
    pet.stageActKinds = emptyStageKinds();
  }

  function normalizeStageHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = {};
    const out = [];
    raw.forEach(function (row) {
      if (!row || typeof row !== 'object') return;
      const tier = clampEvoTier(row.tier);
      if (seen[tier]) return;
      seen[tier] = true;
      out.push({
        tier: tier,
        toTier: clampEvoTier(row.toTier != null ? row.toTier : tier + 1),
        days: Math.max(0, Number(row.days) || 0),
        acts: Math.max(0, Number(row.acts) || 0),
        enteredAt: Number(row.enteredAt) || 0,
        evolvedAt: Number(row.evolvedAt) || 0,
        inferred: !!row.inferred,
        kinds: kindsFromRow(row),
      });
    });
    out.sort(function (a, b) {
      return a.tier - b.tier;
    });
    return out;
  }

  function historyRowFor(pet, fromTier) {
    const list = (pet && pet.stageHistory) || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].tier === fromTier) return list[i];
    }
    return null;
  }

  function backfillStageHistory(pet) {
    if (!pet) return;
    pet.stageHistory = normalizeStageHistory(pet.stageHistory);
    if (!hasChosenSpecies(pet)) return;
    const evo = clampEvoTier(pet.evoTier);
    const adopted = Number(pet.adoptedAt) || Date.now();
    let cursor = adopted;
    for (let i = 0; i < evo; i++) {
      const existing = historyRowFor(pet, i);
      if (existing) {
        cursor = existing.evolvedAt || cursor;
        continue;
      }
      const need = stageGrowthNeed(i);
      const days = need ? need.needDays : 0;
      const acts = need ? need.needActs : 0;
      const evolvedAt = cursor + days * CARE_PROTECT_MS;
      pet.stageHistory.push({
        tier: i,
        toTier: i + 1,
        days: days,
        acts: acts,
        enteredAt: cursor,
        evolvedAt: evolvedAt,
        inferred: true,
        kinds: inferredKinds(acts),
      });
      cursor = evolvedAt;
    }
    pet.stageHistory = normalizeStageHistory(pet.stageHistory).filter(function (h) {
      return h.tier < evo;
    });
  }

  function recordStageCompletion(pet, fromTier) {
    if (!pet) return;
    ensureStageProgress(pet);
    const need = stageGrowthNeed(fromTier);
    const row = {
      tier: clampEvoTier(fromTier),
      toTier: clampEvoTier(fromTier + 1),
      days: Math.max(pet.stageNurtureDays || 0, need ? need.needDays : 0),
      acts: Math.max(pet.stageActCount || 0, need ? need.needActs : 0),
      enteredAt: Number(pet.stageEnteredAt) || Date.now(),
      evolvedAt: Date.now(),
      inferred: false,
      kinds: normalizeStageKinds(pet.stageActKinds),
    };
    pet.stageHistory = normalizeStageHistory(pet.stageHistory).filter(function (h) {
      return h.tier !== row.tier;
    });
    pet.stageHistory.push(row);
    pet.stageHistory = normalizeStageHistory(pet.stageHistory);
  }

  function padDatePart(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatShortDate(ts) {
    const d = new Date(Number(ts) || 0);
    if (!ts || isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + padDatePart(d.getMonth() + 1) + '-' + padDatePart(d.getDate());
  }

  function formatWornLabel(ms) {
    const n = Math.max(0, Number(ms) || 0);
    if (n < 60 * 60 * 1000) return '不足 1 小时';
    if (n < CARE_PROTECT_MS) return '不到 1 天';
    return Math.round(n / CARE_PROTECT_MS) + ' 天';
  }

  function journeyTotals(pet) {
    backfillStageHistory(pet);
    ensureStageProgress(pet);
    const hist = pet.stageHistory || [];
    let days = 0;
    let acts = 0;
    hist.forEach(function (h) {
      days += h.days;
      acts += h.acts;
    });
    days += pet.stageNurtureDays || 0;
    acts += pet.stageActCount || 0;
    return {
      days: days,
      acts: acts,
      forms: clampEvoTier(pet.evoTier) + 1,
      careLevel: Math.max(1, pet.careLevel || 1),
      careCount: pet.careCount || 0,
      points: pet.allTimePoints || 0,
      companionLabel: formatWornLabel(Date.now() - (Number(pet.adoptedAt) || Date.now())),
    };
  }

  function defaultPetNeeds(allActive) {
    const needs = {};
    PET_NEED_KEYS.forEach(function (k) {
      needs[k] = { satisfiedUntil: allActive ? 0 : Date.now() + NEED_SATISFY_MS };
    });
    return needs;
  }

  function normalizePetNeeds(raw) {
    const base = defaultPetNeeds(true);
    if (!raw || typeof raw !== 'object') return base;
    PET_NEED_KEYS.forEach(function (k) {
      const row = raw[k];
      if (row && typeof row === 'object') {
        base[k] = {
          satisfiedUntil: Math.max(0, Number(row.satisfiedUntil) || 0),
        };
      }
    });
    return base;
  }

  function vipTierName(vip) {
    const lv = Math.max(0, Math.min(5, Math.floor(Number(vip) || 0)));
    return (VIP_LEVELS[lv] && VIP_LEVELS[lv].tier) || 'VIP' + lv + 's';
  }

  const RANK_SEED_DEFAULT = [
    { id: 'r01', name: '阳光小橘', vip: 5, species: 'sarimanok', points: 142 },
    { id: 'r02', name: '夜跑达人', vip: 4, species: 'bakunawa', points: 128 },
    { id: 'r03', name: '草莓布丁', vip: 4, species: 'diwata', points: 115 },
    { id: 'r04', name: '云朵牧场', vip: 3, species: 'kapre', points: 98 },
    { id: 'r05', name: '金豆豆', vip: 3, species: 'sirena', points: 86 },
    { id: 'r06', name: '薄荷汽水', vip: 2, species: 'tigmamanukan', points: 74 },
    { id: 'r07', name: '晚风捕手', vip: 2, species: 'sarimanok', points: 61 },
    { id: 'r08', name: '芝麻汤圆', vip: 1, species: 'diwata', points: 52 },
    { id: 'r09', name: '小小芽', vip: 1, species: 'sirena', points: 41 },
    { id: 'r10', name: '棉花糖', vip: 0, species: 'kapre', points: 33 },
  ];

  const FRIENDS_DEFAULT = [
    { id: 'f1', name: '小鹿同学', avatar: '🦌', vip: 2, species: 'diwata', hunger: 28, mood: 42, clean: 55, health: 70 },
    { id: 'f2', name: '阿橙', avatar: '🧡', vip: 3, species: 'kapre', hunger: 48, mood: 32, clean: 40, health: 65 },
    { id: 'f3', name: '青禾', avatar: '🌿', vip: 1, species: 'sarimanok', hunger: 62, mood: 58, clean: 30, health: 72 },
    { id: 'f4', name: '星河', avatar: '✨', vip: 4, species: 'bakunawa', hunger: 35, mood: 50, clean: 48, health: 68 },
  ];

  const PET_DEFAULT = {
    hunger: 72,
    mood: 68,
    clean: 70,
    health: 85,
    careCount: 0,
    careLevel: 1,
    /** 上次完成「进化」时的亲密度等级；careLevel > lastEvolvedLevel 可进化并换种 */
    lastEvolvedLevel: 1,
    /** 抚养驱动的同种形态阶（0–5）；展示形态 = evoTier，不随 VIP 跳档 */
    evoTier: 0,
    /** 本档合格抚养日 / 互动次数（进阶门槛，档越高越久） */
    stageEnteredAt: Date.now(),
    stageNurtureDays: 0,
    stageActCount: 0,
    stageLastQualifyAt: 0,
    /** 已完成档的抚养记录（幼宠→银徽…），用于已达成形态的抚养总结 */
    stageHistory: [],
    stageActKinds: emptyStageKinds(),
    lastCareAt: Date.now(),
    lastInteractAt: Date.now(),
    lastDecayAt: Date.now(),
    inventory: { food: 3, toy: 2, soap: 2 },
    inventoryDate: todayKey(),
    dailyFreeUsed: { food: 0, toy: 0, soap: 0 },
    /** 今日养宠积分（日清）+ 累计 */
    dailyPoints: 0,
    dailyPointsDate: todayKey(),
    allTimePoints: 0,
    /** 迁移兼容字段：出售已取消，加载时强制 sold=false / bound=true */
    sold: false,
    soldAt: null,
    lastSoldAt: null,
    adoptedAt: Date.now(),
    petName: '待选神兽',
    /** 品种：首次进窝必选；之后可随时更换神兽并继承当前形态档 */
    species: null,
    /** 是否已完成首次选种（未选则照料/对话/进化均阻塞） */
    speciesChosen: false,
    /** 立绘风格：六套入库，VIP 页可随时切换；最终留哪几套后定 */
    artStyle: 'neutral',
    /** 与 VIP 管家一对一绑定（始终绑定，无出售解绑） */
    bound: true,
    boundVipLevel: 3,
    boundVipTier: 'VIP3s',
    formId: null,
    formName: '待选神兽',
    /** 主动需求 24h 满足窗（想吃/想玩/想喝） */
    needs: defaultPetNeeds(true),
    needsToastDate: null,
    /** 各品种终极形态奖励是否已自选领取 · 每品种一次 */
    ultimateRewardClaimed: emptyUltimateClaimed(),
    /** 24h 双倍亲密度道具到期时间 */
    doubleIntimacyUntil: null,
    /** 轻社交：好友帮养（正向，无偷抢） */
    friends: cloneFriends(),
    helpUsed: 0,
    helpDate: todayKey(),
    /** 今日排名种子（演示假玩家） */
    rankSeed: cloneRankSeed(),
    /** 对话记录（近 20 条，按日可清） */
    chatMessages: [],
    chatDate: todayKey(),
    chatGreetedDate: null,
    /** 进页抚慰/撒娇 Toast 日戳 */
    voiceToastDate: null,
    /** 本会话照料种类（用于 combo，不强制持久） */
    sessionKinds: [],
    /** 每日亲密度任务进度 */
    dailyIntimacy: {
      date: todayKey(),
      counts: {
        feed: 0,
        play: 0,
        drink: 0,
        clean: 0,
        pat: 0,
        walk: 0,
        story: 0,
        snack: 0,
        photo: 0,
        chat: 0,
      },
      questClaimed: false,
    },
    /** Newbie guide: step 0..4, finished at 5 */
    guide: {
      active: true,
      step: 0,
      finished: false,
      fedOnce: false,
      playedOrCleaned: false,
    },
  };

  function cloneRankSeed() {
    return RANK_SEED_DEFAULT.map(function (r) {
      const sp = resolveSpecies(r.species, SPECIES_FALLBACK);
      const form = petFormForVip(r.vip, sp);
      return {
        id: r.id,
        name: r.name,
        vip: r.vip,
        species: sp,
        emoji: form.emoji,
        petName: form.name,
        points: r.points,
      };
    });
  }

  function cloneFriends() {
    return FRIENDS_DEFAULT.map(function (f) {
      const sp = resolveSpecies(f.species, SPECIES_FALLBACK);
      const form = petFormForVip(f.vip, sp);
      return {
        id: f.id,
        name: f.name,
        avatar: f.avatar,
        vip: f.vip,
        species: sp,
        petEmoji: form.emoji,
        petName: form.name,
        hunger: f.hunger,
        mood: f.mood,
        clean: f.clean,
        health: f.health,
      };
    });
  }

  /** 道具仅每日免费补给，无付费购买 */
  const INV_DAILY_FREE = { food: 3, toy: 2, soap: 2 };

  // VIP3 @ ~60% toward VIP4
  const DEFAULT_STATE = {
    p: 2710.0,
    g: 1288.45,
    xp: 11000,
    dailyCashback: 55.54,
    cashbackClaimed: false,
    tasks: {
      login: false,
      claimCashback: false,
      visitVip: false,
      watchVideo: false,
      carePet: false,
    },
    tasksDate: todayKey(),
    lastLevel: 3,
    pet: clone(PET_DEFAULT),
  };

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function emptyTasks() {
    return {
      login: false,
      claimCashback: false,
      visitVip: false,
      watchVideo: false,
      carePet: false,
    };
  }

  function clampStat(n) {
    return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  }

  function ensurePet(parsed) {
    if (!parsed.pet || typeof parsed.pet !== 'object') {
      parsed.pet = clone(PET_DEFAULT);
      parsed.pet.friends = cloneFriends();
      parsed.pet.rankSeed = cloneRankSeed();
      parsed.pet.adoptedAt = Date.now();
      return;
    }
    const p = parsed.pet;
    const g = p.guide || {};
    const inv = p.inventory || {};
    const free = p.dailyFreeUsed || {};
    const vipGuess = levelFromXp(Number(parsed.xp) || 0);
    const speciesGuess = normalizeSpecies(p.species);
    let speciesChosen;
    if (p.speciesChosen === true) speciesChosen = !!speciesGuess;
    else if (p.speciesChosen === false) speciesChosen = false;
    else speciesChosen = !!speciesGuess; // legacy dog/cat → migrated & treated as chosen
    const speciesFinal = speciesChosen ? speciesGuess : null;
    const evoGuess = clampEvoTier(p.evoTier != null ? p.evoTier : 0);
    const formGuess = speciesFinal
      ? petFormForVip(evoGuess, speciesFinal)
      : { id: null, name: '待选神兽' };
    parsed.pet = {
      hunger: clampStat(p.hunger != null ? p.hunger : PET_DEFAULT.hunger),
      mood: clampStat(p.mood != null ? p.mood : PET_DEFAULT.mood),
      clean: clampStat(p.clean != null ? p.clean : PET_DEFAULT.clean),
      health: clampStat(p.health != null ? p.health : PET_DEFAULT.health),
      careCount: Math.max(0, Number(p.careCount) || 0),
      careLevel: Math.max(1, Number(p.careLevel) || 1),
      lastEvolvedLevel: (function () {
        const careLv = Math.max(1, Number(p.careLevel) || 1);
        if (p.lastEvolvedLevel != null) {
          return Math.max(1, Math.min(careLv, Number(p.lastEvolvedLevel) || 1));
        }
        // 旧存档：视为已对齐当前亲密度，避免突然弹出待进化
        return careLv;
      })(),
      evoTier: evoGuess,
      stageEnteredAt: Number(p.stageEnteredAt) || Number(p.adoptedAt) || Date.now(),
      stageNurtureDays: Math.max(0, Number(p.stageNurtureDays) || 0),
      stageActCount: Math.max(0, Number(p.stageActCount) || 0),
      stageLastQualifyAt: Math.max(0, Number(p.stageLastQualifyAt) || 0),
      stageHistory: normalizeStageHistory(p.stageHistory),
      stageActKinds: normalizeStageKinds(p.stageActKinds),
      lastCareAt: Number(p.lastCareAt) || Date.now(),
      lastInteractAt: Number(p.lastInteractAt) || Number(p.lastCareAt) || Date.now(),
      lastDecayAt: Number(p.lastDecayAt) || Date.now(),
      inventory: {
        food: Math.max(0, Number(inv.food || 0)),
        toy: Math.max(0, Number(inv.toy || 0)),
        soap: Math.max(0, Number(inv.soap || 0)),
      },
      inventoryDate: p.inventoryDate || todayKey(),
      dailyFreeUsed: {
        food: Math.max(0, Number(free.food || 0)),
        toy: Math.max(0, Number(free.toy || 0)),
        soap: Math.max(0, Number(free.soap || 0)),
      },
      dailyPoints: Math.max(0, Number(p.dailyPoints) || 0),
      dailyPointsDate: p.dailyPointsDate || todayKey(),
      allTimePoints: Math.max(0, Number(p.allTimePoints) || 0),
      /** 出售概念已取消：遗留 sold 态一律治愈为已绑定 */
      sold: false,
      soldAt: null,
      lastSoldAt: null,
      adoptedAt: Number(p.adoptedAt) || Date.now(),
      species: speciesFinal,
      speciesChosen: speciesChosen,
      artStyle: normalizeArtStyle(p.artStyle),
      petName:
        typeof p.petName === 'string' &&
        p.petName &&
        !/已出售|未绑定|待绑定/.test(p.petName) &&
        (speciesChosen || p.petName === '待选神兽')
          ? p.petName
          : formGuess.name,
      bound: true,
      boundVipLevel:
        p.boundVipLevel != null ? Math.max(0, Number(p.boundVipLevel)) : vipGuess,
      boundVipTier:
        typeof p.boundVipTier === 'string' ? p.boundVipTier : vipTierName(vipGuess),
      formId: p.formId || formGuess.id,
      formName: p.formName || formGuess.name,
      needs: normalizePetNeeds(p.needs),
      needsToastDate: p.needsToastDate || null,
      ultimateRewardClaimed: normalizeUltimateClaimed(p.ultimateRewardClaimed),
      doubleIntimacyUntil: p.doubleIntimacyUntil ? Number(p.doubleIntimacyUntil) : null,
      friends: normalizeFriends(p.friends),
      helpUsed: Math.max(0, Number(p.helpUsed) || 0),
      helpDate: p.helpDate || todayKey(),
      rankSeed: normalizeRankSeed(p.rankSeed),
      chatMessages: normalizeChat(p.chatMessages),
      chatDate: p.chatDate || todayKey(),
      chatGreetedDate: p.chatGreetedDate || null,
      voiceToastDate: p.voiceToastDate || null,
      sessionKinds: Array.isArray(p.sessionKinds)
        ? p.sessionKinds.filter(function (k) {
            return !!INTIMACY_ACTIONS[k];
          }).slice(-12)
        : [],
      dailyIntimacy: normalizeDailyIntimacy(p.dailyIntimacy),
      guide: {
        active: g.active !== false,
        step: Math.max(0, Number(g.step) || 0),
        finished: !!g.finished,
        fedOnce: !!g.fedOnce,
        playedOrCleaned: !!g.playedOrCleaned,
      },
    };
    backfillStageHistory(parsed.pet);
    if (parsed.pet.guide.finished) {
      parsed.pet.guide.active = false;
      parsed.pet.guide.step = Math.max(parsed.pet.guide.step, 5);
    }
  }

  function normalizeUltimateClaimed(raw) {
    const o = emptyUltimateClaimed();
    if (!raw || typeof raw !== 'object') return o;
    // legacy dog/cat keys → new mythic ids
    if (raw.dog || raw.tikbalang) o.kapre = true;
    if (raw.cat) o.sarimanok = true;
    PET_SPECIES_IDS.forEach(function (id) {
      if (raw[id]) o[id] = true;
    });
    return o;
  }

  function normalizeDailyIntimacy(raw) {
    const today = todayKey();
    const base = {
      date: today,
      counts: {
        feed: 0,
        play: 0,
        drink: 0,
        clean: 0,
        pat: 0,
        walk: 0,
        story: 0,
        snack: 0,
        photo: 0,
        chat: 0,
      },
      questClaimed: false,
    };
    if (!raw || typeof raw !== 'object') return base;
    if (raw.date !== today) return base;
    const c = raw.counts || {};
    Object.keys(base.counts).forEach(function (k) {
      base.counts[k] = Math.max(0, Number(c[k]) || 0);
    });
    base.questClaimed = !!raw.questClaimed;
    return base;
  }

  function normalizeChat(list) {
    if (!Array.isArray(list)) return [];
    return list.slice(-20).map(function (m, i) {
      return {
        id: m.id || 'c' + i,
        role: m.role === 'user' ? 'user' : 'pet',
        text: String(m.text || '').slice(0, 200),
        at: Number(m.at) || Date.now(),
      };
    });
  }

  function normalizeFriends(list) {
    if (!Array.isArray(list) || !list.length) return cloneFriends();
    const byId = {};
    list.forEach(function (f) {
      if (f && f.id) byId[f.id] = f;
    });
    return FRIENDS_DEFAULT.map(function (base) {
      const f = byId[base.id] || base;
      const vip = f.vip != null ? Math.max(0, Math.min(5, Number(f.vip))) : base.vip;
      const sp = resolveSpecies(f.species, resolveSpecies(base.species, SPECIES_FALLBACK));
      const form = petFormForVip(vip, sp);
      return {
        id: base.id,
        name: f.name || base.name,
        avatar: f.avatar || base.avatar,
        vip: vip,
        species: sp,
        petEmoji: form.emoji,
        petName: form.name,
        hunger: clampStat(f.hunger != null ? f.hunger : base.hunger),
        mood: clampStat(f.mood != null ? f.mood : base.mood),
        clean: clampStat(f.clean != null ? f.clean : base.clean),
        health: clampStat(f.health != null ? f.health : base.health),
      };
    });
  }

  function normalizeRankSeed(list) {
    if (!Array.isArray(list) || list.length < 8) return cloneRankSeed();
    return list.slice(0, 12).map(function (r, i) {
      const fallback = RANK_SEED_DEFAULT[i] || RANK_SEED_DEFAULT[0];
      const vip = r.vip != null ? Math.max(0, Math.min(5, Number(r.vip))) : fallback.vip;
      const sp = resolveSpecies(r.species, resolveSpecies(fallback.species, SPECIES_FALLBACK));
      const form = petFormForVip(vip, sp);
      return {
        id: r.id || fallback.id,
        name: r.name || fallback.name,
        vip: vip,
        species: sp,
        emoji: form.emoji,
        petName: form.name,
        points: Math.max(0, Number(r.points) || 0),
      };
    });
  }

  function refreshDailyInventory(pet) {
    if (pet.inventoryDate === todayKey()) return;
    pet.inventoryDate = todayKey();
    pet.dailyFreeUsed = { food: 0, toy: 0, soap: 0 };
    pet.inventory.food = Math.max(pet.inventory.food, INV_DAILY_FREE.food);
    pet.inventory.toy = Math.max(pet.inventory.toy, INV_DAILY_FREE.toy);
    pet.inventory.soap = Math.max(pet.inventory.soap, INV_DAILY_FREE.soap);
  }

  /** 今日积分 + 帮养次数按自然日重置；累计积分保留 */
  function refreshPetSocialDaily(pet) {
    const today = todayKey();
    if (pet.dailyPointsDate !== today) {
      pet.dailyPoints = 0;
      pet.dailyPointsDate = today;
      if (Array.isArray(pet.rankSeed)) {
        pet.rankSeed.forEach(function (r, i) {
          const base = (RANK_SEED_DEFAULT[i] && RANK_SEED_DEFAULT[i].points) || 40;
          const jitter = ((i * 7 + today.length * 3) % 17) - 8;
          r.points = Math.max(5, base + jitter);
          const form = petFormForVip(r.vip, r.species);
          r.emoji = form.emoji;
          r.petName = form.name;
        });
      }
    }
    if (pet.helpDate !== today) {
      pet.helpUsed = 0;
      pet.helpDate = today;
    }
    if (pet.chatDate !== today) {
      pet.chatDate = today;
      // 保留近期对话，不清空；仅标记新日可再问候
    }
    pet.dailyIntimacy = normalizeDailyIntimacy(pet.dailyIntimacy);
  }

  function addDailyPoints(amount) {
    ensurePet(state);
    refreshPetSocialDaily(state.pet);
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n) return 0;
    state.pet.dailyPoints += n;
    state.pet.allTimePoints += n;
    return n;
  }

  function migrateFromLegacy() {
    for (let i = 0; i < LEGACY_KEYS.length; i++) {
      try {
        const raw = localStorage.getItem(LEGACY_KEYS[i]);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  function load() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      let parsed;
      if (!raw) {
        const legacy = migrateFromLegacy();
        parsed = legacy || clone(DEFAULT_STATE);
      } else {
        parsed = JSON.parse(raw);
      }
      if (parsed.tasksDate !== todayKey()) {
        parsed.tasks = emptyTasks();
        parsed.tasksDate = todayKey();
        parsed.cashbackClaimed = false;
        parsed.dailyCashback = 55.54;
      }
      if (!parsed.tasks || typeof parsed.tasks !== 'object') {
        parsed.tasks = emptyTasks();
      } else {
        parsed.tasks = {
          login: !!parsed.tasks.login,
          claimCashback: !!parsed.tasks.claimCashback,
          visitVip: !!parsed.tasks.visitVip,
          watchVideo: !!parsed.tasks.watchVideo,
          carePet: !!parsed.tasks.carePet,
        };
      }
      delete parsed.halls;
      // migrate: VIP庄园砍掉后丢弃旧 manor；出售用虚拟钱包一并删除
      if (parsed.manor) delete parsed.manor;
      delete parsed.virtualGold;
      delete parsed.virtualGems;
      ensurePet(parsed);
      refreshDailyInventory(parsed.pet);
      refreshPetSocialDaily(parsed.pet);
      applyVipPetSync(parsed.pet, Number(parsed.xp) || 0, { silent: true });
      return parsed;
    } catch (e) {
      return clone(DEFAULT_STATE);
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function levelFromXp(xp) {
    let lv = 0;
    for (let i = 0; i < VIP_LEVELS.length; i++) {
      if (xp >= VIP_LEVELS[i].needXp) lv = i;
    }
    return lv;
  }

  function progressToNext(xp) {
    const lv = levelFromXp(xp);
    if (lv >= VIP_LEVELS.length - 1) {
      return { level: lv, pct: 100, remaining: 0, current: VIP_LEVELS[lv], next: null };
    }
    const cur = VIP_LEVELS[lv];
    const next = VIP_LEVELS[lv + 1];
    const span = next.needXp - cur.needXp;
    const done = xp - cur.needXp;
    const pct = Math.min(100, Math.max(0, (done / span) * 100));
    return { level: lv, pct, remaining: next.needXp - xp, current: cur, next };
  }

  function formatMoney(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatXp(n) {
    return Math.floor(Number(n) || 0).toLocaleString('en-US');
  }

  function petAppearance(stateObj) {
    const s = stateObj || state;
    const vip = levelFromXp(s.xp);
    const pet = s.pet || {};
    const tier = vipTierName(vip);
    const careLv = pet.careLevel || 1;
    const evoTier = clampEvoTier(pet.evoTier);
    const displayTier = petDisplayTier(pet, vip);
    const careSuffix =
      careLv >= 8 ? ' · 满亲密度' : careLv >= 5 ? ' · 贴心' : careLv >= 3 ? ' · 熟悉' : '';
    if (!hasChosenSpecies(pet)) {
      return {
        title: '待选神兽 · VIP管家宠',
        emoji: '✨',
        stage: 'baby',
        vip: vip,
        tier: tier,
        careLevel: careLv,
        evoTier: evoTier,
        displayTier: displayTier,
        isUltimate: false,
        sold: false,
        bound: true,
        species: null,
        speciesLabel: '未选择',
        tone: '',
        petName: '待选神兽',
        formId: null,
        formName: '待选神兽',
        form: null,
        accent: '#ffd4a8',
        bindLabel: '已绑定 VIP' + vip + ' / ' + tier + ' · 待选神兽',
        needsSpeciesPick: true,
        artStyle: normalizeArtStyle(pet.artStyle),
        artSheetUrl: null,
        artUrl: null,
      };
    }
    const sp = normalizeSpecies(pet.species);
    const spMeta = PET_SPECIES[sp];
    const form = petFormForVip(displayTier, sp);
    const artStyle = normalizeArtStyle(pet.artStyle);
    return {
      title: form.name + ' · ' + spMeta.label + ' · ' + form.formTitle + careSuffix,
      emoji: form.emoji,
      stage: form.stage,
      vip: vip,
      tier: tier,
      careLevel: careLv,
      evoTier: evoTier,
      displayTier: displayTier,
      isUltimate: displayTier >= 5,
      sold: false,
      bound: true,
      species: sp,
      speciesLabel: spMeta.label,
      speciesLabelEn: spMeta.labelEn,
      tone: spMeta.tone,
      petName: form.name,
      formId: form.id,
      formName: form.name,
      form: clone(form),
      accent: form.accent,
      bindLabel: '已绑定 VIP' + vip + ' / ' + tier + ' · ' + spMeta.label,
      needsSpeciesPick: false,
      artStyle: artStyle,
      artSheetUrl: artSheetUrl(sp, artStyle),
      artUrl: formArtUrl(sp, artStyle, displayTier),
    };
  }

  function setArtStyle(styleId) {
    ensurePet(state);
    const pet = state.pet;
    const next = normalizeArtStyle(styleId);
    if (pet.artStyle === next) {
      return { ok: true, style: next, unchanged: true, look: petAppearance(state) };
    }
    pet.artStyle = next;
    emit({ type: 'artStyle', style: next });
    return { ok: true, style: next, look: petAppearance(state) };
  }

  function getArtStyleSwitchInfo(stateObj) {
    const look = petAppearance(stateObj);
    const styleMeta =
      ART_STYLES.filter(function (s) {
        return s.id === look.artStyle;
      })[0] || ART_STYLES[0];
    const vip = look.vip;
    const evoTier = look.evoTier;
    const stages = FORM_STAGE_TITLES.map(function (title, i) {
      const form = look.species ? petFormForVip(i, look.species) : null;
      return {
        tier: i,
        title: title,
        name: form ? form.name : title,
        current: i === evoTier,
        grown: i <= evoTier,
        pending: i > evoTier && i <= vip,
        vipLocked: i > vip,
      };
    });
    return {
      chosen: !look.needsSpeciesPick,
      speciesLabel: look.speciesLabel,
      petName: look.petName,
      emoji: look.emoji,
      vip: look.vip,
      displayTier: look.displayTier,
      artStyle: look.artStyle,
      artStyleLabel: styleMeta.label,
      artSheetUrl: look.artSheetUrl,
      styles: ART_STYLES,
      stages: stages,
      currentStage: stages[evoTier] || stages[0],
      evoTier: evoTier,
    };
  }

  function getStageGrowthInfo(stateObj) {
    const s = stateObj || state;
    const pet = s.pet || {};
    ensureStageProgress(pet);
    const vip = levelFromXp(s.xp);
    const evoTier = clampEvoTier(pet.evoTier);
    const need = stageGrowthNeed(evoTier);
    const haveDays = pet.stageNurtureDays || 0;
    const haveActs = pet.stageActCount || 0;
    const now = Date.now();
    const lastQ = Number(pet.stageLastQualifyAt) || 0;
    const nextQualifyAt = lastQ ? lastQ + CARE_PROTECT_MS : 0;
    const nextQualifyRemainMs = lastQ ? Math.max(0, nextQualifyAt - now) : 0;
    const fromTitle = FORM_STAGE_TITLES[evoTier] || '幼宠';
    const toTitle = evoTier >= 5 ? null : FORM_STAGE_TITLES[evoTier + 1];
    const base = {
      chosen: hasChosenSpecies(pet),
      evoTier: evoTier,
      vip: vip,
      haveDays: haveDays,
      haveActs: haveActs,
      fromTitle: fromTitle,
      toTitle: toTitle,
      nextQualifyAt: nextQualifyAt,
      nextQualifyRemainMs: nextQualifyRemainMs,
      nextQualifyRemainLabel: nextQualifyRemainMs > 0 ? formatProtectRemain(nextQualifyRemainMs) : '',
    };
    if (!hasChosenSpecies(pet)) {
      return Object.assign(base, {
        canEvolve: false,
        reason: 'need_species',
        isUltimate: false,
        needDays: 0,
        needActs: 0,
        daysPct: 0,
        actsPct: 0,
        progressPct: 0,
        progressHint: '请先选择 VIP管家神兽',
        vipBlocked: false,
      });
    }
    if (evoTier >= 5 || !need) {
      return Object.assign(base, {
        canEvolve: false,
        reason: 'ultimate',
        isUltimate: true,
        needDays: 0,
        needActs: 0,
        daysPct: 100,
        actsPct: 100,
        progressPct: 100,
        progressHint: '已达终极形态',
        vipBlocked: false,
      });
    }
    const needDays = need.needDays;
    const needActs = need.needActs;
    const daysReady = haveDays >= needDays;
    const actsReady = haveActs >= needActs;
    const vipBlocked = need.to > vip;
    const canEvolve = daysReady && actsReady && !vipBlocked;
    let reason = null;
    if (vipBlocked) reason = 'need_vip';
    else if (!canEvolve) reason = 'need_nurture';
    const daysPct = Math.min(100, Math.round((haveDays / needDays) * 100));
    const actsPct = Math.min(100, Math.round((haveActs / needActs) * 100));
    const progressPct = Math.round((daysPct + actsPct) / 2);
    const remainDays = Math.max(0, needDays - haveDays);
    const remainActs = Math.max(0, needActs - haveActs);
    let progressHint;
    if (vipBlocked && daysReady && actsReady) {
      progressHint = '抚养已满 · 升至 VIP' + need.to + ' 解锁「' + toTitle + '」';
    } else if (canEvolve) {
      progressHint = '可进化解锁「' + toTitle + '」';
    } else {
      const bits = [];
      if (remainDays > 0) bits.push('再回来抚养 ' + remainDays + ' 天');
      if (remainActs > 0) bits.push('再互动 ' + remainActs + ' 次');
      progressHint = bits.join(' · ') + ' 可进化「' + toTitle + '」';
      if (remainDays > 0 && nextQualifyRemainMs > 0) {
        progressHint += '（下次计日 ' + formatProtectRemain(nextQualifyRemainMs) + '）';
      }
    }
    return Object.assign(base, {
      canEvolve: canEvolve,
      reason: reason,
      isUltimate: false,
      needDays: needDays,
      needActs: needActs,
      needTo: need.to,
      daysReady: daysReady,
      actsReady: actsReady,
      vipBlocked: vipBlocked,
      remainDays: remainDays,
      remainActs: remainActs,
      daysPct: daysPct,
      actsPct: actsPct,
      progressPct: progressPct,
      progressHint: progressHint,
      tableHint:
        '幼宠→银徽 1天 · 银徽→管家 2天 · 管家→金甲 3天 · 金甲→翼宠 5天 · 翼宠→冠宠 7天（每 24h 互动计 1 抚养日）',
    });
  }

  /**
   * 已达成形态的抚养总结：点开某一档，看养成门槛、本档穿着、累计陪伴。
   */
  function getFormNurtureSummary(tierOpt) {
    ensurePet(state);
    const pet = state.pet;
    backfillStageHistory(pet);
    const look = petAppearance(state);
    const evo = look.evoTier;
    const vip = look.vip;
    const tier = tierOpt == null || tierOpt === '' ? evo : clampEvoTier(tierOpt);
    const form = look.species ? petFormForVip(tier, look.species) : null;
    const title = FORM_STAGE_TITLES[tier] || '幼宠';
    const grown = tier <= evo;
    const current = tier === evo;
    const pending = tier > evo && tier <= vip;
    const vipLocked = tier > vip;
    const totals = journeyTotals(pet);
    const overallLine =
      '累计已达成 ' +
      totals.forms +
      ' 档 · ' +
      totals.days +
      ' 个合格抚养日 · ' +
      totals.acts +
      ' 次互动 · 亲密度 Lv.' +
      totals.careLevel +
      ' · 陪伴 ' +
      totals.companionLabel;
    const base = {
      tier: tier,
      title: title,
      name: form ? form.name : title,
      emoji: form ? form.emoji : '✨',
      grown: grown,
      current: current,
      pending: pending,
      vipLocked: vipLocked,
      speciesLabel: look.speciesLabel || '',
      overallLine: overallLine,
      totals: totals,
      stats: [],
      kicker: '',
      lead: '',
      note: '',
      accent: form ? form.accent : '#ffd4a8',
      stage: form ? form.stage : 'baby',
      desc: form ? form.desc : '',
      artSheetUrl: look.artSheetUrl || '',
      artUrl: look.species ? formArtUrl(look.species, look.artStyle, tier) : '',
      artFrame: look.artSheetUrl ? formArtFrame(tier, 'portrait') : null,
    };
    if (!hasChosenSpecies(pet)) {
      return Object.assign(base, {
        grown: false,
        kicker: '未选神兽',
        lead: '请先选择菲律宾神兽，抚养总结会记在已达成的形态上。',
        note: '首次进窝必选神兽。',
      });
    }
    if (!grown) {
      return Object.assign(base, {
        kicker: pending ? '尚未达成 · 抚养中' : '尚未达成',
        lead: vipLocked
          ? '升至 VIP' + tier + ' 后，养满上一档即可进化「' + title + '」。'
          : '继续抚养与互动即可解锁「' + title + '」；档越高所需时间越长。',
        note: '形态靠抚养日+互动进阶，VIP 只作成长上限。',
        isPast: true,
        isLocked: true,
        cta: '回到当前形态继续抚养',
        actions: [],
        stats: [
          {
            label: '状态',
            value: pending ? '抚养中尚未进化' : vipLocked ? '需先升 VIP' : '尚未养成',
          },
        ],
      });
    }
    const reachNeed = tier > 0 ? stageGrowthNeed(tier - 1) : null;
    const reachHist = tier > 0 ? historyRowFor(pet, tier - 1) : null;
    const wearHist = current ? null : historyRowFor(pet, tier);
    const growth = getStageGrowthInfo();
    const kinds = current
      ? normalizeStageKinds(pet.stageActKinds)
      : kindsFromRow(wearHist || { acts: wearHist && wearHist.acts });
    const actions = actionRowsFromKinds(kinds);
    const sp = look.species;
    const tone = (PET_SPECIES[sp] && PET_SPECIES[sp].tone) || '';
    const lookBit = formLookBit(sp, title);
    const actionBits = actions
      .slice(0, 4)
      .map(function (a) {
        return a.label + ' ' + a.count + ' 次';
      })
      .join('、');
    const stats = [];
    if (tier === 0) {
      stats.push({ label: '起点', value: '选种后的幼宠' });
    } else {
      stats.push({
        label: '养成门槛',
        value:
          (reachHist ? reachHist.days : reachNeed.needDays) +
          ' 日 / ' +
          (reachHist ? reachHist.acts : reachNeed.needActs) +
          ' 次',
      });
    }
    if (current) {
      const wornMs = Date.now() - (Number(pet.stageEnteredAt) || Date.now());
      stats.push({ label: '本档穿着', value: formatWornLabel(wornMs) });
      if (growth && !growth.isUltimate) {
        stats.push({
          label: '本档进度',
          value:
            (growth.haveDays || 0) +
            '/' +
            growth.needDays +
            ' 日 · ' +
            (growth.haveActs || 0) +
            '/' +
            growth.needActs +
            ' 次',
        });
      } else {
        stats.push({ label: '本档', value: '已达终极形态' });
      }
    } else if (wearHist) {
      stats.push({
        label: '本档穿着',
        value: formatWornLabel((wearHist.evolvedAt || 0) - (wearHist.enteredAt || 0)),
      });
      stats.push({
        label: '本档抚养',
        value: wearHist.days + ' 日 / ' + wearHist.acts + ' 次后进化',
      });
      if (wearHist.evolvedAt) {
        stats.push({ label: '进化于', value: formatShortDate(wearHist.evolvedAt) });
      }
    }
    stats.push({
      label: '累计抚养',
      value: totals.days + ' 日 / ' + totals.acts + ' 次',
    });
    stats.push({ label: '亲密度', value: 'Lv.' + totals.careLevel });
    let lead;
    if (current && growth && growth.isUltimate) {
      lead =
        '冠宠「' +
        (form && form.name) +
        '」是你一档一档养出来的。累计 ' +
        totals.days +
        ' 个合格抚养日、' +
        totals.acts +
        ' 次互动。谢谢你。';
    } else if (current) {
      lead =
        '正在穿着「' +
        title +
        '」· ' +
        (form && form.name) +
        '。本档 ' +
        (growth.haveDays || 0) +
        '/' +
        (growth.needDays || 0) +
        ' 抚养日、' +
        (growth.haveActs || 0) +
        '/' +
        (growth.needActs || 0) +
        ' 次互动。再回来深度抚养，就能靠近「' +
        (growth.toTitle || '下一形态') +
        '」。';
    } else if (tier === 0) {
      lead =
        tone +
        '还记得幼宠那一阵。' +
        (actionBits ? '你' + actionBits + '。' : '') +
        '我的' +
        lookBit +
        '就是你养亮的。这是你把我带出起点的成就。谢谢你。';
    } else {
      lead =
        tone +
        '「' +
        title +
        ' · ' +
        (form && form.name) +
        '」那一阵，你' +
        (actionBits || '一直回来抚养') +
        '。我的' +
        lookBit +
        '是你一笔一笔养出来的。保重，这段成就不会丢。';
    }
    return Object.assign(base, {
      kicker: current ? '当前穿着 · 已达成' : '抚养成就 · 已养成',
      lead: lead,
      stats: stats,
      actions: actions,
      lookBit: lookBit,
      isPast: !current,
      cta: '回到当前形态继续抚养',
      accent: form ? form.accent : '#ffd4a8',
      stage: form ? form.stage : 'baby',
      desc: form ? form.desc : '',
      artSheetUrl: look.artSheetUrl || '',
      note: current
        ? '形态靠抚养进阶；更换神兽会继承这一档，抚养总结一起留下。'
        : '这是你在「' + title + '」时期的抚养记录。当前形态还在长，点下方可回去继续养。',
    });
  }

  function creditStageProgress(actGain) {
    ensurePet(state);
    const pet = state.pet;
    if (!hasChosenSpecies(pet)) return getStageGrowthInfo();
    ensureStageProgress(pet);
    const now = Date.now();
    const acts = Math.max(0, Math.floor(Number(actGain) || 0));
    if (acts > 0) pet.stageActCount += acts;
    const lastQ = Number(pet.stageLastQualifyAt) || 0;
    if (acts > 0 && (!lastQ || now - lastQ >= CARE_PROTECT_MS)) {
      pet.stageNurtureDays += 1;
      pet.stageLastQualifyAt = now;
    }
    return getStageGrowthInfo();
  }

  /**
   * 一对一绑定：会员 VIP ↔ 管家宠
   * VIP 只更新绑定档位与可进化上限；形态由抚养进阶（evoTier）决定
   */
  function applyVipPetSync(pet, xp, opts) {
    opts = opts || {};
    const vip = levelFromXp(xp);
    const tier = vipTierName(vip);
    pet.sold = false;
    pet.soldAt = null;
    pet.evoTier = clampEvoTier(pet.evoTier);
    const prevForm = pet.formId;
    const prevVip = pet.boundVipLevel;
    pet.bound = true;
    pet.boundVipLevel = vip;
    pet.boundVipTier = tier;
    if (!hasChosenSpecies(pet)) {
      pet.species = null;
      pet.speciesChosen = false;
      pet.formId = null;
      pet.formName = '待选神兽';
      if (!pet.petName || /已出售|未绑定|待绑定|金甲喵|金甲汪|幼蹄马灵|冠林间马灵|管家马灵/.test(pet.petName)) {
        pet.petName = '待选神兽';
      }
      return {
        changed: prevForm != null,
        sold: false,
        vip: vip,
        tier: tier,
        evoTier: pet.evoTier,
        displayTier: petDisplayTier(pet),
        species: null,
        form: null,
        prevForm: prevForm,
        prevVip: prevVip,
        awaitingSpecies: true,
      };
    }
    const sp = normalizeSpecies(pet.species);
    pet.species = sp;
    pet.speciesChosen = true;
    const displayTier = petDisplayTier(pet);
    const form = petFormForVip(displayTier, sp);
    pet.formId = form.id;
    pet.formName = form.name;
    pet.petName = form.name;
    const changed = prevForm !== form.id;
    return {
      changed: changed,
      sold: false,
      vip: vip,
      tier: tier,
      evoTier: pet.evoTier,
      displayTier: displayTier,
      species: sp,
      form: clone(form),
      prevForm: prevForm,
      prevVip: prevVip,
      awaitingSpecies: false,
    };
  }

  function syncPetToVip(opts) {
    ensurePet(state);
    return applyVipPetSync(state.pet, state.xp, opts || {});
  }

  function getPetFormGallery(speciesOpt) {
    const vip = levelFromXp(state.xp);
    const pet = state.pet || {};
    const sp = normalizeSpecies(speciesOpt) || (hasChosenSpecies(pet) ? normalizeSpecies(pet.species) : null);
    if (!sp) return [];
    const displayTier = petDisplayTier(pet);
    const unlockedCeil = Math.max(vip, clampEvoTier(pet.evoTier));
    return [0, 1, 2, 3, 4, 5].map(function (lv) {
      const form = petFormForVip(lv, sp);
      return {
        vip: lv,
        tier: vipTierName(lv),
        species: sp,
        form: clone(form),
        unlocked: unlockedCeil >= lv,
        grown: displayTier >= lv,
        current: pet.species === sp && displayTier === lv,
      };
    });
  }

  /** VIP5 终极形态预览（进化换种用） */
  function petUltimateForm(species) {
    const sp = resolveSpecies(species, SPECIES_FALLBACK);
    const form = petFormForVip(5, sp);
    return Object.assign(clone(form), {
      vip: 5,
      tier: vipTierName(5),
      blurb: '冲到 VIP5 可解锁的冠宠形态 · 达成可自选养成奖励（非充值）',
      labelLine: '终极形态（VIP5）：' + form.name,
      rewardHint: '达成后自选 1/5 养成奖励（每品种一次）',
    });
  }

  function listUltimateRewardOptions() {
    return ULTIMATE_REWARD_OPTIONS.map(function (o) {
      return clone(o);
    });
  }

  function getUltimateRewardInfo() {
    ensurePet(state);
    const pet = state.pet;
    if (!pet.ultimateRewardClaimed) pet.ultimateRewardClaimed = emptyUltimateClaimed();
    const vip = levelFromXp(state.xp);
    if (!hasChosenSpecies(pet)) {
      return {
        species: null,
        speciesLabel: '未选择',
        form: null,
        atUltimate: false,
        displayTier: petDisplayTier(pet, vip),
        claimed: false,
        canClaim: false,
        claimedMap: normalizeUltimateClaimed(pet.ultimateRewardClaimed),
        options: listUltimateRewardOptions(),
        doubleIntimacyActive: !!(pet.doubleIntimacyUntil && pet.doubleIntimacyUntil > Date.now()),
        doubleIntimacyUntil: pet.doubleIntimacyUntil || null,
        note: '请先选择 VIP管家神兽。',
        needSpecies: true,
      };
    }
    const sp = normalizeSpecies(pet.species);
    const claimedMap = normalizeUltimateClaimed(pet.ultimateRewardClaimed);
    const displayTier = petDisplayTier(pet, vip);
    const atUltimate = displayTier >= 5;
    const already = !!claimedMap[sp];
    const buffActive = !!(pet.doubleIntimacyUntil && pet.doubleIntimacyUntil > Date.now());
    return {
      species: sp,
      speciesLabel: PET_SPECIES[sp].label,
      form: petUltimateForm(sp),
      atUltimate: atUltimate,
      displayTier: displayTier,
      claimed: already,
      canClaim: atUltimate && !already,
      claimedMap: claimedMap,
      options: listUltimateRewardOptions(),
      doubleIntimacyActive: buffActive,
      doubleIntimacyUntil: pet.doubleIntimacyUntil || null,
      note: '养成达成奖励自选，非充值。抚养进化或 VIP 达终极形态（冠宠）后，该品种可自选领取一次（五选一）。',
    };
  }

  /**
   * 终极形态奖励自选领取
   * @param {{ rewardId: string, species?: string }} opts
   */
  function claimUltimateReward(opts) {
    opts = opts || {};
    applyDecay();
    ensurePet(state);
    const pet = state.pet;
    if (!hasChosenSpecies(pet)) return { ok: false, reason: 'need_species' };
    if (!pet.ultimateRewardClaimed) pet.ultimateRewardClaimed = emptyUltimateClaimed();
    const sp = resolveSpecies(opts.species, normalizeSpecies(pet.species));
    if (!sp) return { ok: false, reason: 'need_species' };
    const vip = levelFromXp(state.xp);
    const displayTier = petDisplayTier(pet, vip);
    if (displayTier < 5) {
      return { ok: false, reason: 'not_ultimate', needVip: 5, needDisplayTier: 5 };
    }
    if (pet.ultimateRewardClaimed[sp]) {
      return { ok: false, reason: 'claimed', species: sp };
    }
    const rewardId = String(opts.rewardId || '');
    const option = ULTIMATE_REWARD_OPTIONS.find(function (o) {
      return o.id === rewardId;
    });
    if (!option) {
      return {
        ok: false,
        reason: 'need_choice',
        options: listUltimateRewardOptions(),
        info: getUltimateRewardInfo(),
      };
    }

    pet.ultimateRewardClaimed[sp] = true;
    const form = petUltimateForm(sp);
    let feedback = '';
    let detail = {};

    if (option.kind === 'cash') {
      state.p = round2(state.p + option.amount);
      feedback =
        '已领取「' + option.name + '」· ₱' + option.amount + ' 入账钱包 P（养成达成，非充值）';
      detail = { pGain: option.amount, p: state.p };
    } else if (option.kind === 'intimacy') {
      const careMeta = bumpCareMeta(option.amount);
      feedback =
        '已领取「' +
        option.name +
        '」· 亲密度 +' +
        option.amount +
        '（现 Lv.' +
        pet.careLevel +
        '）';
      detail = { careMeta: careMeta, intimacy: getIntimacyInfo() };
    } else if (option.kind === 'points') {
      addDailyPoints(option.amount);
      feedback = '已领取「' + option.name + '」· 今日积分 +' + option.amount;
      detail = { pointsGain: option.amount, dailyPoints: pet.dailyPoints };
    } else if (option.kind === 'buff') {
      const ms = (option.hours || 24) * 60 * 60 * 1000;
      pet.doubleIntimacyUntil = Date.now() + ms;
      feedback = '已领取「' + option.name + '」· 24 小时内照料亲密度翻倍';
      detail = { doubleIntimacyUntil: pet.doubleIntimacyUntil };
    } else {
      return { ok: false, reason: 'unknown_reward' };
    }

    pushChatSystem(
      PET_SPECIES[sp].tone +
        '终极形态「' +
        form.name +
        '」达成！主人选了「' +
        option.name +
        '」～养成奖励已发放（非充值）！'
    );

    const result = {
      ok: true,
      rewardId: option.id,
      reward: clone(option),
      species: sp,
      speciesLabel: PET_SPECIES[sp].label,
      form: form,
      feedback: feedback,
      detail: detail,
      p: state.p,
    };
    pendingUltimateCelebrate = result;
    pendingUltimatePick = null;
    emit({ type: 'ultimateReward', rewardId: option.id, species: sp });
    return result;
  }

  /** 首次达成终极形态：打开自选，不自动发放 */
  function notifyUltimateReady() {
    const info = getUltimateRewardInfo();
    if (!info.canClaim) return null;
    pendingUltimatePick = {
      species: info.species,
      speciesLabel: info.speciesLabel,
      form: info.form,
      options: info.options,
      note: info.note,
    };
    return pendingUltimatePick;
  }

  function consumeUltimatePick() {
    const m = pendingUltimatePick;
    pendingUltimatePick = null;
    return m;
  }

  function consumeUltimateCelebrate() {
    const m = pendingUltimateCelebrate;
    pendingUltimateCelebrate = null;
    return m;
  }

  function getSpeciesCatalog(styleOpt) {
    const artStyle = normalizeArtStyle(
      styleOpt != null ? styleOpt : state.pet && state.pet.artStyle
    );
    return PET_SPECIES_IDS.map(function (sp) {
      const meta = PET_SPECIES[sp];
      const evo = petDisplayTier(state.pet);
      const inheritForm = petFormForVip(evo, sp);
      const starter = petFormForVip(0, sp);
      const ultimate = petUltimateForm(sp);
      return {
        id: sp,
        label: meta.label,
        labelEn: meta.labelEn,
        tone: meta.tone,
        unit: meta.unit,
        loreEn: meta.loreEn,
        loreZh: meta.loreZh,
        pickable: true,
        preview: clone(inheritForm),
        starter: clone(starter),
        currentPreview: clone(inheritForm),
        inheritForm: clone(inheritForm),
        inheritTier: evo,
        inheritTitle: FORM_STAGE_TITLES[evo] || '幼宠',
        ultimate: ultimate,
        ultimateLabel: ultimate.labelLine,
        starterArtUrl: formArtUrl(sp, artStyle, 0),
        inheritArtUrl: formArtUrl(sp, artStyle, evo),
        ultimateArtUrl: formArtUrl(sp, artStyle, 5),
      };
    });
  }

  /**
   * 首次进窝选种（必选，不可跳过）
   * @param {string} speciesId
   */
  function chooseStarterSpecies(speciesId) {
    ensurePet(state);
    const pet = state.pet;
    if (pet.speciesChosen && normalizeSpecies(pet.species)) {
      return { ok: false, reason: 'already_chosen', species: pet.species };
    }
    const sp = normalizeSpecies(speciesId);
    if (!sp) return { ok: false, reason: 'invalid_species' };
    pet.species = sp;
    pet.speciesChosen = true;
    resetStageProgress(pet);
    const sync = applyVipPetSync(pet, state.xp, {});
    const form = sync.form;
    const meta = PET_SPECIES[sp];
    const greet =
      (meta.cue || '啾~') +
      ' 我是「' +
      (form && form.name) +
      '」· ' +
      meta.label +
      '。从现在起和 VIP 绑定在一起。请好好养我呀。';
    pushChatSystem(greet);
    emit({ type: 'chooseStarterSpecies', species: sp, form: form });
    return {
      ok: true,
      species: sp,
      speciesLabel: meta.label,
      speciesLabelEn: meta.labelEn,
      form: form,
      look: petAppearance(state),
      greeting: greet,
      feedback:
        '已选定「' +
        meta.label +
        '」· ' +
        (form && form.emoji) +
        ' ' +
        (form && form.name) +
        '（' +
        sync.tier +
        '）',
    };
  }

  function getSpeciesSwitchInfo() {
    ensurePet(state);
    const pet = state.pet;
    const evoTier = petDisplayTier(pet);
    const formTitle = FORM_STAGE_TITLES[evoTier] || '幼宠';
    const catalog = getSpeciesCatalog();
    if (!hasChosenSpecies(pet)) {
      return {
        chosen: false,
        canSwitch: false,
        reason: 'need_species',
        evoTier: evoTier,
        formTitle: formTitle,
        currentSpecies: null,
        currentForm: null,
        options: catalog,
      };
    }
    const currentSp = normalizeSpecies(pet.species);
    const currentForm = petFormForVip(evoTier, currentSp);
    const options = catalog.map(function (s) {
      return Object.assign({}, s, {
        keep: s.id === currentSp,
        evolvePreview: s.inheritForm || s.preview,
      });
    });
    return {
      chosen: true,
      canSwitch: true,
      evoTier: evoTier,
      formTitle: formTitle,
      currentSpecies: currentSp,
      currentSpeciesLabel: PET_SPECIES[currentSp].label,
      currentForm: clone(currentForm),
      options: options,
      hint:
        '随时可换菲律宾神兽。新神兽直接升至你当前的「' +
        formTitle +
        '」形态，抚养进度保留。不付费、不解绑。',
    };
  }

  /**
   * 随时换种：新神兽继承当前 evoTier（对应形态档），抚养日/互动进度保留。
   */
  function switchPetSpecies(speciesId) {
    ensurePet(state);
    applyDecay();
    const pet = state.pet;
    if (!hasChosenSpecies(pet)) {
      return { ok: false, reason: 'need_species' };
    }
    const nextSp = normalizeSpecies(speciesId);
    if (!nextSp) return { ok: false, reason: 'invalid_species' };
    const prevSp = normalizeSpecies(pet.species);
    const evoTier = clampEvoTier(pet.evoTier);
    const formTitle = FORM_STAGE_TITLES[evoTier] || '幼宠';
    if (nextSp === prevSp) {
      return {
        ok: true,
        unchanged: true,
        species: nextSp,
        evoTier: evoTier,
        look: petAppearance(state),
      };
    }
    pet.species = nextSp;
    const sync = applyVipPetSync(pet, state.xp, {});
    const form = sync.form;
    const tone = PET_SPECIES[nextSp].tone;
    const chatLine =
      tone +
      '换种成功～从「' +
      PET_SPECIES[prevSp].label +
      '」换成「' +
      PET_SPECIES[nextSp].label +
      '」，已同步到你原来的「' +
      formTitle +
      '」形态「' +
      (form && form.name) +
      '」！抚养进度还在。';
    pushChatSystem(chatLine);
    const ultimatePick = notifyUltimateReady();
    emit({ type: 'switchSpecies', from: prevSp, to: nextSp, evoTier: evoTier });
    return {
      ok: true,
      from: prevSp,
      fromLabel: PET_SPECIES[prevSp].label,
      to: nextSp,
      toLabel: PET_SPECIES[nextSp].label,
      evoTier: evoTier,
      formTitle: formTitle,
      form: form,
      look: petAppearance(state),
      ultimatePick: ultimatePick,
      feedback:
        '已换成「' +
        PET_SPECIES[nextSp].label +
        '」· ' +
        (form && form.emoji) +
        ' ' +
        (form && form.name) +
        '（' +
        formTitle +
        '）',
    };
  }

  /**
   * 抚养进阶：本档抚养日+互动达标后可进化；
   * 确认后同种 evoTier +1，并可换菲律宾神兽；VIP 只作可进化上限。
   */
  function getEvolveInfo() {
    ensurePet(state);
    applyDecay();
    const pet = state.pet;
    const vip = levelFromXp(state.xp);
    const careLevel = Math.max(1, pet.careLevel || 1);
    const lastEv = Math.max(1, Number(pet.lastEvolvedLevel) || 1);
    const growth = getStageGrowthInfo();
    if (!hasChosenSpecies(pet)) {
      return {
        canEvolve: false,
        reason: 'need_species',
        careLevel: careLevel,
        lastEvolvedLevel: lastEv,
        options: getSpeciesCatalog(),
        rules: EVOLVE_RULES_COPY.slice(),
        growth: growth,
      };
    }
    const currentSp = normalizeSpecies(pet.species);
    const evoTier = clampEvoTier(pet.evoTier);
    const displayTier = petDisplayTier(pet);
    const currentForm = petFormForVip(displayTier, currentSp);
    const nextFormTier = Math.min(5, displayTier + 1);
    const nextFormPreview = petFormForVip(nextFormTier, currentSp);
    const catalog = getSpeciesCatalog();
    const options = catalog.map(function (s) {
      return Object.assign({}, s, {
        keep: s.id === currentSp,
        evolvePreview: petFormForVip(nextFormTier, s.id),
      });
    });
    const base = {
      careLevel: careLevel,
      lastEvolvedLevel: lastEv,
      nextNeedLevel: Math.min(10, lastEv + 1),
      evoTier: evoTier,
      displayTier: displayTier,
      nextFormTier: nextFormTier,
      nextFormPreview: clone(nextFormPreview),
      currentSpecies: currentSp,
      currentSpeciesLabel: PET_SPECIES[currentSp].label,
      currentForm: clone(currentForm),
      vip: vip,
      tier: vipTierName(vip),
      options: options,
      rules: EVOLVE_RULES_COPY.slice(),
      isUltimate: displayTier >= 5,
      growth: growth,
    };
    return Object.assign(base, {
      canEvolve: !!growth.canEvolve,
      reason: growth.reason,
    });
  }

  const EVOLVE_RULES_COPY = [
    '每个形态需经过抚养日 + 互动才进入下一阶段；档越高所需时间越长',
    '合格抚养日：每 24 小时互动最多计 1 天（幼宠 1 天 → 冠宠前 7 天）',
    'VIP 只限制可成长上限，不会因升 VIP 直接换形态',
    '每次进化：同种形态升一阶；换种请用「更换神兽」（随时，新神兽继承当前形态档）',
    '达终极（冠宠）可自选养成奖励（非充值）',
  ];

  /**
   * @param {{ species?: string }} opts 不传或非法则保留当前品种；可选 6 种神兽之一
   */
  function evolvePet(opts) {
    opts = opts || {};
    applyDecay();
    const pet = state.pet;
    if (!hasChosenSpecies(pet)) {
      return { ok: false, reason: 'need_species' };
    }
    const info = getEvolveInfo();
    if (!info.canEvolve) {
      return { ok: false, reason: info.reason || 'blocked', info: info };
    }
    const prevSpecies = normalizeSpecies(pet.species);
    const prevDisplay = petDisplayTier(pet);
    let nextSp = normalizeSpecies(opts.species);
    if (!nextSp) nextSp = prevSpecies;
    const switched = nextSp !== prevSpecies;
    pet.species = nextSp;
    pet.lastEvolvedLevel = Math.max(1, pet.careLevel || 1);
    recordStageCompletion(pet, prevDisplay);
    pet.evoTier = clampEvoTier(prevDisplay + 1);
    resetStageProgress(pet);
    const sync = applyVipPetSync(pet, state.xp, {});
    const form = sync.form;
    const tone = PET_SPECIES[nextSp].tone;
    let chatLine;
    if (switched) {
      chatLine =
        tone +
        '哇！进化换种成功～从「' +
        PET_SPECIES[prevSpecies].label +
        '」变成「' +
        PET_SPECIES[nextSp].label +
        '」啦！现在是「' +
        (form && form.name) +
        '」· 形态阶 ' +
        sync.displayTier +
        '，终极目标是「' +
        petUltimateForm(nextSp).name +
        '」哦！';
    } else {
      chatLine =
        tone +
        '进化成功！形态升至「' +
        (form && form.name) +
        '」（阶 ' +
        sync.displayTier +
        '）· 亲密度 Lv.' +
        pet.careLevel +
        '～继续抚养解锁下一形态吧！';
    }
    pushChatSystem(chatLine);
    const ultimatePick = notifyUltimateReady();
    emit({
      type: 'evolvePet',
      species: nextSp,
      prevSpecies: prevSpecies,
      switched: switched,
      careLevel: pet.careLevel,
      evoTier: pet.evoTier,
      displayTier: sync.displayTier,
      form: form,
      ultimatePick: ultimatePick,
    });
    return {
      ok: true,
      switched: switched,
      species: nextSp,
      prevSpecies: prevSpecies,
      careLevel: pet.careLevel,
      lastEvolvedLevel: pet.lastEvolvedLevel,
      evoTier: pet.evoTier,
      displayTier: sync.displayTier,
      form: form,
      vip: sync.vip,
      tier: sync.tier,
      ultimate: petUltimateForm(nextSp),
      ultimatePick: ultimatePick,
      chatLine: chatLine,
      feedback: switched
        ? '进化换种！「' +
          PET_SPECIES[prevSpecies].label +
          '」→「' +
          PET_SPECIES[nextSp].label +
          '」· ' +
          (form && form.emoji) +
          ' ' +
          (form && form.name)
        : '进化成功！「' +
          (form && form.emoji) +
          ' ' +
          (form && form.name) +
          '」· 形态阶 ' +
          sync.displayTier,
      look: petAppearance(state),
      nextForm: getNextFormTeaser(),
    };
  }

  function careLevelFromCount(count) {
    return Math.min(10, 1 + Math.floor(Math.max(0, count) / 5));
  }

  let state = load();
  let pendingCareDemoteToast = null;
  let pendingUltimateCelebrate = null;
  let pendingUltimatePick = null;
  const listeners = [];

  function emit(meta) {
    save(state);
    listeners.forEach((fn) => fn(state, meta || {}));
  }

  function addXp(gain) {
    const before = levelFromXp(state.xp);
    state.xp = Math.max(0, state.xp + gain);
    const after = levelFromXp(state.xp);
    const leveled = after > before;
    if (leveled) state.lastLevel = after;
    const formSync = syncPetToVip({ silent: true });
    const ultimatePick = notifyUltimateReady();
    if (leveled) {
      return {
        from: before,
        to: after,
        formChanged: !!formSync.changed,
        form: formSync.form,
        tier: formSync.tier,
        ultimatePick: ultimatePick,
      };
    }
    if (ultimatePick) {
      return {
        from: before,
        to: after,
        formChanged: false,
        form: formSync.form,
        tier: formSync.tier,
        ultimatePick: ultimatePick,
        soft: true,
      };
    }
    return null;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function touchPetInteraction(source) {
    ensurePet(state);
    const pet = state.pet;
    const now = Date.now();
    pet.lastInteractAt = now;
    if (source === 'care') pet.lastCareAt = now;
  }

  function formatProtectRemain(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    const pad = function (n) {
      return (n < 10 ? '0' : '') + n;
    };
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  function satisfyNeed(pet, needKey) {
    if (!pet.needs) pet.needs = normalizePetNeeds(null);
    if (!PET_NEED_DEFS[needKey]) return null;
    const until = Date.now() + NEED_SATISFY_MS;
    pet.needs[needKey] = { satisfiedUntil: until };
    return {
      need: needKey,
      satisfiedUntil: until,
      label: PET_NEED_DEFS[needKey].satisfiedLabel,
      remainMs: NEED_SATISFY_MS,
      remainLabel: formatProtectRemain(NEED_SATISFY_MS),
    };
  }

  function getPetNeedsInfo(opts) {
    opts = opts || {};
    ensurePet(state);
    const pet = state.pet;
    if (!pet.needs) pet.needs = normalizePetNeeds(null);
    const now = Date.now();
    const items = PET_NEED_KEYS.map(function (k) {
      const def = PET_NEED_DEFS[k];
      const until = Math.max(0, Number(pet.needs[k] && pet.needs[k].satisfiedUntil) || 0);
      const satisfied = until > now;
      const remainMs = satisfied ? until - now : 0;
      return {
        id: k,
        label: def.label,
        satisfiedLabel: def.satisfiedLabel,
        action: def.action,
        icon: def.icon,
        bubble: def.bubble,
        lambing: def.lambing || '',
        evolveNudge: def.evolveNudge,
        flag: def.flag,
        satisfied: satisfied,
        active: !satisfied,
        satisfiedUntil: until,
        remainMs: remainMs,
        remainLabel: satisfied ? formatProtectRemain(remainMs) : '00:00:00',
      };
    });
    const active = items.filter(function (it) {
      return it.active;
    });
    const flags = {
      hungry: !!(items[0] && items[0].active),
      wantPlay: !!(items[1] && items[1].active),
      wantDrink: !!(items[2] && items[2].active),
    };
    const bubbles = active.map(function (it) {
      return it.bubble;
    });
    if (active.length && !opts.skipEvolveNudge) {
      bubbles.push(active[0].evolveNudge || '满足我的需求，就能更接近下一形态哦');
    }
    let enterToast = null;
    if (!opts.skipToast && active.length) {
      const today = todayKey();
      if (pet.needsToastDate !== today) {
        pet.needsToastDate = today;
        enterToast =
          '管家宠提醒：' +
          active
            .map(function (a) {
              return a.label;
            })
            .join(' · ');
      }
    }
    return {
      items: items,
      active: active,
      flags: flags,
      bubbles: bubbles,
      anyActive: active.length > 0,
      enterToast: enterToast,
      satisfyMs: NEED_SATISFY_MS,
    };
  }

  /**
   * 下一形态预览（刺激持续抚养）
   * 进度：本档抚养日 + 互动；档越高所需时间越长。
   */
  function getNextFormTeaser() {
    ensurePet(state);
    const pet = state.pet;
    const vip = levelFromXp(state.xp);
    const growth = getStageGrowthInfo();
    if (!hasChosenSpecies(pet)) {
      return {
        bound: true,
        isUltimate: false,
        currentForm: null,
        nextForm: null,
        displayTier: petDisplayTier(pet),
        evoTier: clampEvoTier(pet.evoTier),
        evolveReady: false,
        intimacyNeeded: 0,
        progressPct: 0,
        progressHint: '请先选择 VIP管家神兽',
        tip: '首次进入宠物窝需选择一种菲律宾神兽。',
        celebrate: false,
        needSpecies: true,
        growth: growth,
      };
    }
    const sp = normalizeSpecies(pet.species);
    const displayTier = petDisplayTier(pet);
    const currentForm = petFormForVip(displayTier, sp);

    if (displayTier >= 5) {
      return {
        bound: true,
        isUltimate: true,
        currentForm: clone(currentForm),
        nextForm: null,
        displayTier: displayTier,
        evoTier: clampEvoTier(pet.evoTier),
        artSheetUrl: artSheetUrl(sp, pet.artStyle),
        artUrl: formArtUrl(sp, pet.artStyle, displayTier),
        evolveReady: false,
        intimacyNeeded: 0,
        progressPct: 100,
        progressHint: '已达终极形态',
        tip: '冠宠达成！可自选养成奖励（非充值）。继续照料仍涨亲密度与 VIP XP。',
        celebrate: true,
        growth: growth,
      };
    }

    const nextTier = displayTier + 1;
    const nextForm = petFormForVip(nextTier, sp);
    return {
      bound: true,
      isUltimate: false,
      currentForm: clone(currentForm),
      nextForm: clone(nextForm),
      nextTier: nextTier,
      artSheetUrl: artSheetUrl(sp, pet.artStyle),
      nextArtUrl: formArtUrl(sp, pet.artStyle, nextTier),
      displayTier: displayTier,
      evoTier: clampEvoTier(pet.evoTier),
      evolveReady: !!growth.canEvolve,
      intimacyNeeded: 0,
      progressPct: growth.progressPct || 0,
      progressHint: growth.progressHint,
      tip:
        '每个形态都要养够时间：本档需 ' +
        growth.needDays +
        ' 个抚养日（每24h互动计1天）和 ' +
        growth.needActs +
        ' 次互动。档越高越久。VIP 只限制上限，不跳形态。',
      celebrate: false,
      growth: growth,
    };
  }

  function demoExpirePetNeeds() {
    applyDecay();
    const pet = state.pet;
    pet.needs = defaultPetNeeds(true);
    pet.needsToastDate = null;
    const info = getPetNeedsInfo({ skipToast: true });
    emit({ type: 'demoExpireNeeds', needs: info });
    return { ok: true, needs: info, feedback: '演示：需求已到期，管家宠开始提醒' };
  }

  function demoSatisfyAllNeeds() {
    applyDecay();
    const pet = state.pet;
    PET_NEED_KEYS.forEach(function (k) {
      satisfyNeed(pet, k);
    });
    const info = getPetNeedsInfo({ skipToast: true });
    emit({ type: 'demoSatisfyNeeds', needs: info });
    return { ok: true, needs: info, feedback: '演示：三项需求均已 24h 满足' };
  }

  /**
   * 亲密度等级 24h 保护：超时未互动则每满 24h 降 1 级，下限 Lv.1
   * 不降 VIP / 不改形态绑定档位
   */
  function applyCareLevelDecay() {
    ensurePet(state);
    const pet = state.pet;
    const now = Date.now();
    const last = Number(pet.lastInteractAt) || Number(pet.lastCareAt) || Number(pet.adoptedAt) || now;
    pet.lastInteractAt = last;
    const elapsed = Math.max(0, now - last);
    if (elapsed < CARE_PROTECT_MS) {
      const remainMs = CARE_PROTECT_MS - elapsed;
      return {
        demoted: false,
        protect: {
          active: true,
          remainMs: remainMs,
          remainLabel: formatProtectRemain(remainMs),
          warn: remainMs <= CARE_PROTECT_WARN_MS,
          careLevel: pet.careLevel || 1,
          lastInteractAt: last,
        },
      };
    }
    const periods = Math.floor(elapsed / CARE_PROTECT_MS);
    const before = Math.max(1, pet.careLevel || 1);
    const after = Math.max(1, before - periods);
    if (after < before) {
      pet.careLevel = after;
      pet.careCount = Math.max(0, (after - 1) * 5);
      if (pet.lastEvolvedLevel != null) {
        pet.lastEvolvedLevel = Math.min(Math.max(1, Number(pet.lastEvolvedLevel) || 1), after);
      }
      // 降级后开启新一轮 24h 保护，避免重复连降刷屏
      pet.lastInteractAt = now;
      const message =
        '因超过 24 小时未互动，亲密度等级降至 Lv.' + after + '（VIP 档位不变）';
      pendingCareDemoteToast = message;
      return {
        demoted: true,
        from: before,
        to: after,
        periods: periods,
        message: message,
        protect: {
          active: true,
          remainMs: CARE_PROTECT_MS,
          remainLabel: formatProtectRemain(CARE_PROTECT_MS),
          warn: false,
          careLevel: after,
          lastInteractAt: now,
        },
      };
    }
    // 已在下限
    return {
      demoted: false,
      atFloor: true,
      protect: {
        active: false,
        remainMs: 0,
        remainLabel: '00:00:00',
        warn: true,
        expired: true,
        careLevel: before,
        lastInteractAt: last,
        floorLabel: '亲密度已为最低 Lv.1 · 快来互动续保护',
      },
    };
  }

  function getCareProtectInfo() {
    const decay = applyCareLevelDecay();
    if (decay.protect) {
      const p = decay.protect;
      return Object.assign({}, p, {
        demoted: !!decay.demoted,
        atFloor: !!decay.atFloor,
        demoteMessage: decay.message || null,
        from: decay.from,
        to: decay.to,
        label: p.active
          ? '等级保护剩余 ' + p.remainLabel
          : p.floorLabel || '保护已过期',
      });
    }
    return { active: false, careLevel: state.pet.careLevel || 1, label: '保护结算中' };
  }

  /**
   * 24h 抚养节奏（登录粘性）：与亲密度保护窗 / 需求 24h 同轴，
   * 引导「每 24 小时回来深度抚养一次」；不限制同访多次互动。
   */
  function getNurtureCadenceInfo() {
    ensurePet(state);
    const protect = getCareProtectInfo();
    const pet = state.pet;
    const now = Date.now();
    const lastNurtureAt =
      Number(protect.lastInteractAt) ||
      Number(pet.lastInteractAt) ||
      Number(pet.lastCareAt) ||
      Number(pet.adoptedAt) ||
      now;
    const nextDueAt = lastNurtureAt + CARE_PROTECT_MS;
    const remainMs = Math.max(0, nextDueAt - now);
    const remainLabel = formatProtectRemain(remainMs);

    // fresh ≥3h · due_soon <3h · due 保护已到期 · overdue 已降级/亲密度下限
    let status = 'fresh';
    if (protect.demoted || protect.atFloor) {
      status = 'overdue';
    } else if (protect.expired || !protect.active || remainMs <= 0) {
      status = 'due';
    } else if (remainMs < CARE_PROTECT_WARN_MS || protect.warn) {
      status = 'due_soon';
    } else {
      status = 'fresh';
    }

    const needs = getPetNeedsInfo({ skipToast: true });
    const needsActive = needs && needs.active ? needs.active.length : 0;
    const quests = getDailyIntimacyQuests();
    const doneItems = (quests.list || []).filter(function (q) {
      return q.complete;
    }).length;
    const totalItems = (quests.list || []).length || DAILY_INTIMACY_QUESTS.length;
    const progressLabel =
      doneItems +
      '/' +
      totalItems +
      ' 项' +
      (quests.claimed ? ' · 已领奖' : quests.canClaim ? ' · 可领奖' : '');

    let lobbyCta = '去深度抚养 →';
    let petBannerTitle = '24小时抚养节奏';
    let petBannerSub = '提高登录粘性 · 每24小时深度抚养一次，参与神兽成长';
    if (status === 'due_soon') {
      lobbyCta = '快回来抚养 · 保护将尽 →';
      petBannerTitle = '抚养节奏将至';
      petBannerSub = '亲密度保护不足 3 小时 · 回来完成今日深度抚养可续护并参与成长';
    } else if (status === 'due') {
      lobbyCta = '该回来抚养了 →';
      petBannerTitle = '该回来抚养了';
      petBannerSub = '已到 24 小时节奏点 · 深度抚养可续亲密度保护、满足需求、推进下一形态';
    } else if (status === 'overdue') {
      lobbyCta = '该回来抚养了 →';
      petBannerTitle = '该回来抚养了';
      petBannerSub =
        '超过 24 小时未抚养 · 亲密度需续护，需求也在等你——回来深度抚养参与成长';
    } else if (quests.canClaim) {
      lobbyCta = '领取今日深度抚养奖励 →';
      petBannerSub = '今日深度抚养已完成 · 领取奖励后可继续互动，约 24 小时后再来一轮';
    } else if (quests.allDone) {
      lobbyCta = '今日深度抚养已完成 →';
      petBannerSub =
        '节奏良好 · 下次建议 ' +
        remainLabel +
        ' 后再来深度抚养；同访仍可继续互动';
    } else {
      lobbyCta = '去深度抚养 →';
      petBannerSub =
        '提高登录粘性 · 每24小时深度抚养一次（抚摸×3 + 对话×1 + 喂食×2）参与成长';
    }

    return {
      purpose: '每24小时回来深度抚养，参与神兽成长',
      lastNurtureAt: lastNurtureAt,
      nextDueAt: nextDueAt,
      remainMs: remainMs,
      remainLabel: remainLabel,
      status: status,
      protect: protect,
      needsActive: needsActive,
      deepNurture: {
        done: !!quests.allDone,
        claimed: !!quests.claimed,
        progressLabel: progressLabel,
        canClaim: !!quests.canClaim,
        list: quests.list,
      },
      lobbyCta: lobbyCta,
      petBannerTitle: petBannerTitle,
      petBannerSub: petBannerSub,
    };
  }

  /** 演示：将上次互动时间拨回 24h+，触发保护结算 */
  function demoSkipCareProtect() {
    applyDecay();
    const pet = state.pet;
    pet.lastInteractAt = Date.now() - CARE_PROTECT_MS - 1000;
    pet.stageLastQualifyAt = Date.now() - CARE_PROTECT_MS - 1000;
    const result = applyCareLevelDecay();
    emit({ type: 'demoCareProtect', result: result });
    return { ok: true, result: result };
  }

  function applyDecay() {
    ensurePet(state);
    refreshDailyInventory(state.pet);
    refreshPetSocialDaily(state.pet);
    const careDecay = applyCareLevelDecay();
    const pet = state.pet;
    const now = Date.now();
    const elapsedMs = Math.max(0, now - (pet.lastDecayAt || now));
    const ticks = Math.min(48, Math.floor(elapsedMs / (12 * 60 * 1000)));
    if (ticks <= 0) {
      pet.lastDecayAt = now;
      return { ticks: 0, careDecay: careDecay };
    }
    pet.hunger = clampStat(pet.hunger - ticks * 3);
    pet.mood = clampStat(pet.mood - ticks * 2);
    pet.clean = clampStat(pet.clean - ticks * 2);
    const avg = (pet.hunger + pet.mood + pet.clean) / 3;
    if (avg < 40) {
      pet.health = clampStat(pet.health - ticks * 2);
    } else if (avg > 70) {
      pet.health = clampStat(pet.health + Math.floor(ticks / 2));
    } else {
      pet.health = clampStat(pet.health - Math.floor(ticks / 3));
    }
    pet.lastDecayAt = now;
    return { ticks: ticks, careDecay: careDecay };
  }

  function bumpCareMeta(intimacyGain) {
    const pet = state.pet;
    let gain = Math.max(1, Math.floor(Number(intimacyGain) || 1));
    const doubled = !!(pet.doubleIntimacyUntil && Number(pet.doubleIntimacyUntil) > Date.now());
    if (doubled) gain = gain * 2;
    const before = Math.max(1, pet.careLevel || 1);
    pet.careCount = (pet.careCount || 0) + gain;
    pet.careLevel = careLevelFromCount(pet.careCount);
    if (pet.lastEvolvedLevel == null) pet.lastEvolvedLevel = before;
    touchPetInteraction('care');
    creditStageProgress(1);
    const after = pet.careLevel;
    const growth = getStageGrowthInfo();
    return {
      careLeveled: after > before,
      from: before,
      to: after,
      intimacyGain: gain,
      doubled: doubled,
      evolveReady: !!growth.canEvolve,
    };
  }

  function trackSessionKind(kind) {
    const pet = state.pet;
    if (!Array.isArray(pet.sessionKinds)) pet.sessionKinds = [];
    if (pet.sessionKinds.indexOf(kind) < 0) pet.sessionKinds.push(kind);
    if (pet.sessionKinds.length > 12) pet.sessionKinds = pet.sessionKinds.slice(-12);
    return pet.sessionKinds.length;
  }

  function trackDailyIntimacyKind(kind) {
    refreshPetSocialDaily(state.pet);
    const di = state.pet.dailyIntimacy;
    if (!di.counts[kind]) di.counts[kind] = 0;
    di.counts[kind] += 1;
    const pet = state.pet;
    ensureStageProgress(pet);
    if (!pet.stageActKinds) pet.stageActKinds = emptyStageKinds();
    if (pet.stageActKinds[kind] == null) pet.stageActKinds[kind] = 0;
    pet.stageActKinds[kind] += 1;
  }

  function getIntimacyInfo() {
    ensurePet(state);
    const pet = state.pet;
    const careLevel = Math.max(1, Math.min(10, pet.careLevel || 1));
    const careCount = Math.max(0, pet.careCount || 0);
    const intoLevel = careLevel >= 10 ? INTIMACY_PER_LEVEL : careCount % INTIMACY_PER_LEVEL;
    const need = INTIMACY_PER_LEVEL;
    const pct = careLevel >= 10 ? 100 : Math.min(100, Math.round((intoLevel / need) * 100));
    const lastEv = Math.max(1, Number(pet.lastEvolvedLevel) || 1);
    return {
      careLevel: careLevel,
      careCount: careCount,
      intoLevel: intoLevel,
      needPerLevel: need,
      pct: pct,
      nextLevel: careLevel >= 10 ? 10 : careLevel + 1,
      maxed: careLevel >= 10,
      evolveReady: !!getStageGrowthInfo().canEvolve,
      lastEvolvedLevel: lastEv,
      label:
        careLevel >= 10
          ? '亲密度已满 Lv.10'
          : '亲密度 Lv.' + careLevel + ' → Lv.' + (careLevel + 1) + '（' + intoLevel + '/' + need + '）',
    };
  }

  function getDailyIntimacyQuests() {
    ensurePet(state);
    refreshPetSocialDaily(state.pet);
    const di = state.pet.dailyIntimacy;
    const list = DAILY_INTIMACY_QUESTS.map(function (q) {
      const done = Math.min(q.need, di.counts[q.kind] || 0);
      return {
        id: q.id,
        kind: q.kind,
        label: q.label,
        need: q.need,
        done: done,
        complete: done >= q.need,
      };
    });
    const allDone = list.every(function (q) {
      return q.complete;
    });
    return {
      list: list,
      allDone: allDone,
      claimed: !!di.questClaimed,
      canClaim: allDone && !di.questClaimed,
      bonusIntimacy: QUEST_INTIMACY_BONUS,
      bonusPoints: DAILY_POINTS.questBonus,
    };
  }

  function claimDailyIntimacyQuest() {
    applyDecay();
    const info = getDailyIntimacyQuests();
    if (!info.canClaim) {
      return { ok: false, reason: info.claimed ? 'claimed' : 'incomplete', info: info };
    }
    const pet = state.pet;
    pet.dailyIntimacy.questClaimed = true;
    const careMeta = bumpCareMeta(QUEST_INTIMACY_BONUS);
    addDailyPoints(DAILY_POINTS.questBonus);
    const leveled = addXp(QUEST_VIP_XP);
    pushChatSystem(
      '今日深度抚养完成！亲密度 +' +
        QUEST_INTIMACY_BONUS +
        ' · VIP XP +' +
        QUEST_VIP_XP +
        ' · 今日积分 +' +
        DAILY_POINTS.questBonus +
        '～约每 24 小时再回来抚养一轮吧！'
    );
    emit({ type: 'intimacyQuestClaim', careMeta: careMeta, xp: QUEST_VIP_XP });
    return {
      ok: true,
      careMeta: careMeta,
      evolveReady: !!careMeta.evolveReady,
      xpGain: QUEST_VIP_XP,
      leveled: leveled,
      feedback:
        '深度抚养完成！亲密度 +' +
        QUEST_INTIMACY_BONUS +
        ' · VIP XP +' +
        QUEST_VIP_XP +
        ' · +' +
        DAILY_POINTS.questBonus +
        ' 今日分',
      quests: getDailyIntimacyQuests(),
      intimacy: getIntimacyInfo(),
      nurtureCadence: getNurtureCadenceInfo(),
    };
  }

  function maybeCompleteCareTask() {
    if (state.tasks.carePet) return { taskXp: 0 };
    state.tasks.carePet = true;
    const taskXp = XP_RULES.dailyTask.carePet;
    return { taskXp };
  }

  function applyIntimacyActionStats(kind, usedItem) {
    const pet = state.pet;
    let feedback = '';
    if (kind === 'feed') {
      const boost = usedItem ? 38 : 22;
      pet.hunger = clampStat(pet.hunger + boost);
      pet.mood = clampStat(pet.mood + (usedItem ? 10 : 5));
      pet.health = clampStat(pet.health + (usedItem ? 4 : 2));
      feedback = usedItem ? '仙果真香！饱食大涨' : '喂了一口仙果点心，饱食上升';
    } else if (kind === 'play') {
      const boost = usedItem ? 36 : 24;
      pet.mood = clampStat(pet.mood + boost);
      pet.hunger = clampStat(pet.hunger - (usedItem ? 4 : 6));
      pet.clean = clampStat(pet.clean - (usedItem ? 2 : 4));
      pet.health = clampStat(pet.health + (usedItem ? 3 : 1));
      feedback = usedItem ? '灵嬉球玩疯了！心情满格' : '陪玩了一会儿，心情变好';
    } else if (kind === 'drink') {
      pet.health = clampStat(pet.health + 8);
      pet.hunger = clampStat(pet.hunger + 6);
      pet.mood = clampStat(pet.mood + 5);
      feedback = '咕咚咕咚～喝饱水啦';
    } else if (kind === 'clean') {
      const boost = usedItem ? 42 : 28;
      pet.clean = clampStat(pet.clean + boost);
      pet.mood = clampStat(pet.mood + (usedItem ? 8 : 4));
      pet.health = clampStat(pet.health + (usedItem ? 6 : 3));
      feedback = usedItem ? '净灵露洗得亮晶晶！' : '梳洗完毕，清洁上升';
    } else if (kind === 'pat') {
      pet.mood = clampStat(pet.mood + 14);
      pet.health = clampStat(pet.health + 2);
      feedback = '轻轻抚摸～亲密度暖暖上升';
    } else if (kind === 'walk') {
      pet.mood = clampStat(pet.mood + 12);
      pet.hunger = clampStat(pet.hunger - 5);
      pet.clean = clampStat(pet.clean - 3);
      pet.health = clampStat(pet.health + 4);
      feedback = '一起散步回来啦，陪伴感满满';
    } else if (kind === 'story') {
      pet.mood = clampStat(pet.mood + 16);
      pet.health = clampStat(pet.health + 1);
      feedback = '讲完故事，小眼睛亮晶晶～';
    } else if (kind === 'snack') {
      pet.hunger = clampStat(pet.hunger + 18);
      pet.mood = clampStat(pet.mood + 8);
      feedback = '零食好吃！再贴贴～';
    } else if (kind === 'photo') {
      pet.mood = clampStat(pet.mood + 10);
      pet.clean = clampStat(pet.clean + 4);
      feedback = '咔嚓！合影打卡，亲密又开心';
    } else {
      return { ok: false, reason: 'unknown' };
    }
    return { ok: true, feedback: feedback };
  }

  function careAction(kind, useItem) {
    applyDecay();
    const pet = state.pet;
    if (!hasChosenSpecies(pet)) return { ok: false, reason: 'need_species' };
    const action = INTIMACY_ACTIONS[kind];
    if (!action) return { ok: false, reason: 'unknown' };

    let usedItem = false;
    const invKey = kind === 'feed' ? 'food' : kind === 'play' ? 'toy' : kind === 'clean' ? 'soap' : null;
    if (useItem) {
      if (!invKey) return { ok: false, reason: 'no_item_for_kind' };
      if ((pet.inventory[invKey] || 0) <= 0) {
        return { ok: false, reason: 'no_item', item: invKey };
      }
      pet.inventory[invKey] -= 1;
      usedItem = true;
    }

    const statRes = applyIntimacyActionStats(kind, usedItem);
    if (!statRes.ok) return statRes;
    let feedback = statRes.feedback;

    let intimacyGain = action.intimacy + (usedItem ? 1 : 0);
    trackDailyIntimacyKind(kind);
    const distinct = trackSessionKind(kind);
    let comboBonus = 0;
    if (distinct >= COMBO_KIND_NEED && distinct % COMBO_KIND_NEED === 0) {
      comboBonus = 1;
      intimacyGain += comboBonus;
      feedback += ' · 抚养连击！+' + comboBonus + ' 亲密度';
    }

    const careMeta = bumpCareMeta(intimacyGain);
    // bumpCareMeta → ensurePet 可能替换 state.pet，后续写回必须用最新引用
    const livePet = state.pet;
    let needSatisfied = null;
    if (action.need) {
      needSatisfied = satisfyNeed(livePet, action.need);
      if (needSatisfied) {
        feedback += ' · ' + needSatisfied.label + ' 24h';
      }
    }
    const pg = livePet.guide;

    let xpGain = action.xp || 5;
    if (usedItem) xpGain += XP_RULES.care.itemBonus || 4;
    const taskBit = maybeCompleteCareTask();
    xpGain += taskBit.taskXp;
    const leveled = addXp(xpGain);

    let pointsGain = DAILY_POINTS[kind] || 8;
    if (usedItem) pointsGain += DAILY_POINTS.itemBonus;
    if (comboBonus) pointsGain += DAILY_POINTS.comboBonus;
    const vipNow = levelFromXp(state.xp);
    if (vipNow >= 5) pointsGain += 5;
    else if (vipNow >= 4) pointsGain += 3;
    else if (vipNow >= 3) pointsGain += 2;
    addDailyPoints(pointsGain);

    if (vipNow >= 4) {
      livePet.health = clampStat(livePet.health + 1);
    }

    let guideAdvanced = false;
    if (pg && !pg.finished && pg.active) {
      if (kind === 'feed' && pg.step === 2) {
        pg.fedOnce = true;
        pg.step = 3;
        guideAdvanced = true;
      } else if ((kind === 'play' || kind === 'clean' || kind === 'pat' || kind === 'drink') && pg.step === 3) {
        pg.playedOrCleaned = true;
        pg.step = 4;
        guideAdvanced = true;
      }
    }

    emit({
      type: 'care',
      kind,
      usedItem,
      xpGain,
      pointsGain,
      leveled,
      careLeveled: !!careMeta.careLeveled,
      evolveReady: !!careMeta.evolveReady,
      intimacyGain: intimacyGain,
      needSatisfied: needSatisfied,
      taskXp: taskBit.taskXp,
      guideStep: pg ? pg.step : null,
      guideAdvanced,
    });
    return {
      ok: true,
      kind,
      usedItem,
      feedback,
      xpGain,
      pointsGain,
      leveled,
      careLeveled: !!careMeta.careLeveled,
      careFrom: careMeta.from,
      careTo: careMeta.to,
      evolveReady: !!careMeta.evolveReady,
      intimacyGain: intimacyGain,
      comboBonus: comboBonus,
      needSatisfied: needSatisfied,
      needs: getPetNeedsInfo({ skipToast: true }),
      nextForm: getNextFormTeaser(),
      intimacy: getIntimacyInfo(),
      taskXp: taskBit.taskXp,
      pet: clone(state.pet),
      guideStep: pg ? pg.step : null,
      guideAdvanced,
    };
  }

  function getDailyRankboard() {
    ensurePet(state);
    refreshPetSocialDaily(state.pet);
    const pet = state.pet;
    const look = petAppearance(state);
    const myVip = levelFromXp(state.xp);
    const rows = (pet.rankSeed || []).map(function (r) {
      const sp = resolveSpecies(r.species, SPECIES_FALLBACK);
      const form = petFormForVip(r.vip, sp);
      return {
        id: r.id,
        name: r.name,
        vip: r.vip,
        species: sp,
        speciesLabel: PET_SPECIES[sp].label,
        tier: vipTierName(r.vip),
        emoji: form.emoji,
        petName: form.name,
        points: r.points,
        isMe: false,
      };
    });
    rows.push({
      id: USER_RANK_ID,
      name: USER_DISPLAY_NAME,
      vip: myVip,
      species: look.species || pet.species || null,
      speciesLabel: look.speciesLabel || '',
      tier: vipTierName(myVip),
      emoji: look.emoji,
      petName: look.petName,
      points: pet.dailyPoints || 0,
      isMe: true,
    });
    rows.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      if (b.vip !== a.vip) return b.vip - a.vip;
      if (a.isMe) return -1;
      if (b.isMe) return 1;
      return String(a.id).localeCompare(String(b.id));
    });
    let myRank = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].isMe) {
        myRank = i + 1;
        break;
      }
    }
    return {
      list: rows,
      myRank: myRank,
      myPoints: pet.dailyPoints || 0,
      allTimePoints: pet.allTimePoints || 0,
      total: rows.length,
      myVip: myVip,
    };
  }

  function friendNeedHint(f) {
    const lows = [];
    if (f.hunger < 40) lows.push('饱食偏低');
    if (f.mood < 40) lows.push('心情偏低');
    if (f.clean < 40) lows.push('需要清洁');
    if (!lows.length) {
      const avg = (f.hunger + f.mood + f.clean) / 3;
      if (avg >= 70) return '状态不错，去打个招呼也暖心';
      return '还不错，帮养一下更贴心';
    }
    return lows.join(' · ');
  }

  function helpFriendCare(friendId, kind) {
    applyDecay();
    refreshPetSocialDaily(state.pet);
    const pet = state.pet;
    if (kind !== 'feed' && kind !== 'play' && kind !== 'clean') {
      return { ok: false, reason: 'unknown' };
    }
    if (pet.helpUsed >= HELP_QUOTA_DAILY) {
      return { ok: false, reason: 'quota', helpUsed: pet.helpUsed, helpMax: HELP_QUOTA_DAILY };
    }
    const friend = (pet.friends || []).find(function (f) {
      return f.id === friendId;
    });
    if (!friend) return { ok: false, reason: 'missing' };

    let feedback = '';
    if (kind === 'feed') {
      friend.hunger = clampStat(friend.hunger + 28);
      friend.mood = clampStat(friend.mood + 6);
      friend.health = clampStat(friend.health + 2);
      feedback = '帮「' + friend.name + '」喂了 ' + friend.petName + '，饱食上升';
    } else if (kind === 'play') {
      friend.mood = clampStat(friend.mood + 30);
      friend.hunger = clampStat(friend.hunger - 3);
      friend.health = clampStat(friend.health + 1);
      feedback = '陪「' + friend.name + '」的 ' + friend.petName + ' 玩耍，心情变好';
    } else {
      friend.clean = clampStat(friend.clean + 32);
      friend.mood = clampStat(friend.mood + 5);
      friend.health = clampStat(friend.health + 3);
      feedback = '帮「' + friend.name + '」清洁了 ' + friend.petName + '，亮晶晶';
    }

    pet.helpUsed += 1;
    const pointsGain = DAILY_POINTS.helpFriend;
    addDailyPoints(pointsGain);

    const friendshipToasts = [
      '友谊小火花 +1 ✨',
      '正向帮养，暖暖的～',
      '好友会记得你的好心！',
      '轻社交满分，无偷无抢',
    ];
    const friendship = friendshipToasts[pet.helpUsed % friendshipToasts.length];

    emit({
      type: 'helpFriend',
      friendId,
      kind,
      pointsGain,
      helpUsed: pet.helpUsed,
    });
    return {
      ok: true,
      friendId,
      kind,
      feedback,
      friendship,
      pointsGain,
      helpUsed: pet.helpUsed,
      helpMax: HELP_QUOTA_DAILY,
      friend: clone(friend),
    };
  }

  function pushChat(role, text) {
    ensurePet(state);
    const pet = state.pet;
    if (!Array.isArray(pet.chatMessages)) pet.chatMessages = [];
    pet.chatMessages.push({
      id: 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      role: role,
      text: String(text).slice(0, 200),
      at: Date.now(),
    });
    if (pet.chatMessages.length > 20) {
      pet.chatMessages = pet.chatMessages.slice(-20);
    }
  }

  function pickDaily(arr, salt) {
    if (!arr || !arr.length) return '';
    const key = String(todayKey()) + '|' + String(salt || '');
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return arr[h % arr.length];
  }

  function pickDailySet(arr, salt, n) {
    if (!arr || !arr.length) return [];
    const key = String(todayKey()) + '|' + String(salt || '');
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const out = [];
    const count = Math.min(n || 3, arr.length);
    for (let i = 0; i < count; i++) out.push(arr[(h + i) % arr.length]);
    return out;
  }

  /** 展示期全中文；方案定稿后再加菲语 / 英语。撒娇促抚养，抚慰不催养、正向不凶。 */
  const SPECIES_VOICE = {
    sarimanok: {
      look: {
        幼宠: '软软的幼羽和小冠',
        银徽: '刚亮起来的银纹',
        管家: '领结和整齐的彩羽',
        金甲: '金甲彩羽',
        翼宠: '展开的虹彩长翼',
        冠宠: '盛开的冠羽',
      },
      nurtureLook: '{tone} 来摸摸我的{look}好不好？摸亮了才像吉祥鸟。',
      nurtureGrow: '我想长大，一直到{next}。每天回来看我一眼就好。{tone}',
      nurtureLove: '{tone} 好想你。今天特别黏人——喂我、摸摸我、跟我说说话。别丢下我。',
      lobbyComfort: '保重 · 彩羽给你一点好运',
      comfort: [
        '{tone} 你回来了！我的{look}都好好的。保重——今天给你一点好运。',
        '谢谢你回家。现在不用急着抚养，坐一会儿就好。彩羽陪着你。',
        '保重。我不是来讨债的，只想陪着你。彩羽在，今天会顺利。',
        '{tone} 你在，家里就亮了。谢谢。慢慢来就好。',
      ],
    },
    bakunawa: {
      look: {
        幼宠: '月卵上细细的鳞',
        银徽: '银色月纹',
        管家: '盘着月光的身子',
        金甲: '金色月鳞',
        翼宠: '星河之翼',
        冠宠: '冠上的月晕',
      },
      nurtureLook: '{tone} 我的{look}有点暗了…陪我一会儿，一起看月亮好不好？',
      nurtureGrow: '再养我一阵，就更靠近{next}了。别丢下我——月亮一个人会寂寞。{tone}',
      nurtureLove: '{tone} 我就在你旁边盘着。不可怕，只是撒娇。摸摸鳞、喂一口、陪我玩。好想你。',
      lobbyComfort: '保重 · 月亮还在，我也在',
      comfort: [
        '月亮还在，我也在。「{name}」替你守着光，等你回家。',
        '{tone} 今晚海面很静。不用急着抚养——只想让你心里亮一点。保重。',
        '看着月亮，想起那些故事。你来了，我的{look}也暖了。保重。',
        '谢谢你。我可以是很大的龙，但在你身边很软。就坐一会儿吧。',
      ],
    },
    diwata: {
      look: {
        幼宠: '嫩芽和露珠',
        银徽: '银色叶纹',
        管家: '林间管家的藤蔓腰带',
        金甲: '金色林光',
        翼宠: '蝶一般的林翼',
        冠宠: '冠上的花环',
      },
      nurtureLook: '{tone} 我的{look}有点蔫了…照顾一下，光就会回来。求你了。',
      nurtureGrow: '山林精灵长得慢。再养我一阵，一直到{next}。{tone}',
      nurtureLove: '{tone} 来林子里吧。喂我、陪我玩、给我喝一口。好想你——我会乖乖的。',
      lobbyComfort: '保重 · 山林里有人护着你',
      comfort: [
        '山林精灵守着山，也守着回家的人。你来了——叶子在轻轻说话。保重。',
        '现在不用硬着头皮抚养。在林子里停一下，我送你一阵风。保重。',
        '{tone} 谢谢你。心软的人，林子里有你的位置。',
        '今天我的{look}很安静。说说话就够了。',
      ],
    },
    tigmamanukan: {
      look: {
        幼宠: '吉兆幼羽',
        银徽: '银色吉兆纹',
        管家: '指路的翎羽',
        金甲: '金色兆羽',
        翼宠: '吉兆翼影',
        冠宠: '冠上的吉兆羽',
      },
      nurtureLook: '{tone} 帮我把{look}理一理好不好？就算是吉兆灵鸟，也需要摸摸才能给人指路。',
      nurtureGrow: '帮我再长大一点，一直到{next}。每天来看我一眼呀。{tone}',
      nurtureLove: '{tone} 别人出门前会看我——我也在看你。摸摸我、喂我一口。好想你。',
      lobbyComfort: '出行保重 · 今天方向是对的',
      comfort: [
        '今天方向是对的。吉兆是护佑，不是吓唬人。出行保重。',
        '{tone} 你一进来，就是好兆头。不用急着抚养——先收下这份祝福。',
        '谢谢你。肩上有灵鸟，这一天会顺。保重。',
        '我的{look}还有光。累了就歇着。我就在这里。',
      ],
    },
    sirena: {
      look: {
        幼宠: '软软的幼潮',
        银徽: '银色贝光',
        管家: '海管家的潮纱',
        金甲: '金色潮纹',
        翼宠: '浪翼',
        冠宠: '冠上的珍珠冠',
      },
      nurtureLook: '{tone} 我的{look}有点干了…给我喝一口，再梳一梳好不好？',
      nurtureGrow: '潮水来了才会长大。再养我一阵，就靠近{next}了。求你了。{tone}',
      nurtureLove: '{tone} 我在岸边等你。不会把你拉进水里——陪我玩、吃点心、说说话。好想你。',
      lobbyComfort: '保重 · 我在岸边，海面很静',
      comfort: [
        '今天海面很静。海之仙女的歌是送你平安回家，不是把你拉走。保重。',
        '{tone} 保重。我在岸边。现在不用抚养——听听浪就好。',
        '谢谢你来看海。珠光我替你藏着。',
        '我的{look}有光。你在，潮就稳。保重。',
      ],
    },
    kapre: {
      look: {
        幼宠: '小小的树纹',
        银徽: '银色藤徽',
        管家: '树管家的叶披风',
        金甲: '金色树甲',
        翼宠: '张开的树冠',
        冠宠: '冠上的树冠',
      },
      nurtureLook: '{tone} 我的{look}有点干了…给树喝一口、摸摸树干好不好？',
      nurtureGrow: '树长得慢，但会守很久。陪我一直到{next}呀。{tone}',
      nurtureLove: '{tone} 我坐在树下等你。喂我、说说话、撒娇一下。别丢下我。',
      lobbyComfort: '保重 · 门前的树还在',
      comfort: [
        '树精守着古树，也守着家。你回来了——树荫又凉快了。保重。',
        '现在不用做任务。在树下坐一会儿。保重。我看着呢。',
        '{tone} 谢谢你。门前的树还在——你不是一个人。',
        '我的{look}很安静。敬树，也敬你回家这一趟。',
      ],
    },
  };

  function fillVoice(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? vars[k] : '';
    });
  }

  function formLookBit(sp, formTitle) {
    const voice = SPECIES_VOICE[sp] || SPECIES_VOICE.sarimanok;
    return (voice && voice.look && voice.look[formTitle]) || '小小的样子';
  }

  /**
   * 进页互动口吻：需要抚养 → 外形/成长/感情撒娇；不需要 → 正向抚慰，不催养。
   */
  function getPetVoiceInfo(opts) {
    opts = opts || {};
    ensurePet(state);
    const pet = state.pet;
    if (!hasChosenSpecies(pet)) {
      return {
        mode: 'need_species',
        bubbles: ['先选一只菲律宾神兽，我们再一起撒娇～'],
        enterToast: null,
        greeting: null,
        chips: ['去选神兽', '稍后再摸'],
        hint: '先选一只 VIP 管家神兽，才能开始抚养～',
        lookBit: '',
        lobbyComfort: null,
      };
    }
    const look = petAppearance(state);
    const sp = look.species;
    const meta = PET_SPECIES[sp] || PET_SPECIES.sarimanok;
    const voice = SPECIES_VOICE[sp] || SPECIES_VOICE.sarimanok;
    const formTitle = (look.form && look.form.formTitle) || FORM_STAGE_TITLES[look.displayTier] || '幼宠';
    const lookBit = (voice.look && voice.look[formTitle]) || '小小的样子';
    const growth = getStageGrowthInfo();
    const nextTitle = (growth && growth.toTitle) || '下一形态';
    const needs = getPetNeedsInfo({ skipToast: true, skipEvolveNudge: true });
    const cadence = getNurtureCadenceInfo();
    const avg = ((pet.hunger || 0) + (pet.mood || 0) + (pet.clean || 0)) / 3;
    const needNurture =
      !!(needs && needs.anyActive) ||
      avg < 50 ||
      cadence.status === 'due' ||
      cadence.status === 'overdue' ||
      cadence.status === 'due_soon';
    const vars = {
      tone: meta.cue || '啾~',
      name: look.petName || meta.label,
      look: lookBit,
      next: nextTitle,
      form: formTitle,
      unit: meta.unit,
    };
    const chipsNurture = ['摸摸我', '喂食', '陪我玩', '好想你', '我可爱吗？', '求求你'];
    const chipsComfort = ['保重', '谢谢你', '我很好', '陪我说说话', '摸摸', '你回来了'];
    if (needNurture) {
      const bubbles = [
        fillVoice(voice.nurtureLook, vars),
        fillVoice(voice.nurtureGrow, vars),
        fillVoice(voice.nurtureLove, vars),
      ];
      if (needs && needs.active && needs.active[0]) {
        bubbles.push(
          (meta.cue || '啾~') +
            ' 求你了——' +
            (needs.active[0].lambing || needs.active[0].label) +
            '。先宠我一下，让' +
            lookBit +
            '亮起来。'
        );
      }
      const pendingToast = pet.voiceToastDate !== todayKey();
      return {
        mode: 'nurture',
        formTitle: formTitle,
        lookBit: lookBit,
        bubbles: bubbles,
        enterToast: pendingToast ? pickDaily(bubbles, sp + '|nurtureToast') : null,
        greeting: pickDaily(bubbles, sp + '|greetN') + ' 我是「' + vars.name + '」· ' + formTitle + '。',
        chips: chipsNurture,
        hint: fillVoice(voice.nurtureLove, vars),
        lobbyComfort: null,
      };
    }
    const comfortPool = (voice.comfort || []).map(function (t) {
      return fillVoice(t, vars);
    });
    const bubbles = pickDailySet(comfortPool, sp + '|comfortBub', 3);
    const pendingToast = pet.voiceToastDate !== todayKey();
    return {
      mode: 'comfort',
      formTitle: formTitle,
      lookBit: lookBit,
      bubbles: bubbles,
      enterToast: pendingToast ? pickDaily(comfortPool, sp + '|comfortToast') : null,
      greeting: pickDaily(comfortPool, sp + '|greetC'),
      chips: chipsComfort,
      hint: pickDaily(comfortPool, sp + '|hint'),
      lobbyComfort: voice.lobbyComfort || '保重 · 神兽在窝里等你',
    };
  }

  function markVoiceToastShown() {
    ensurePet(state);
    state.pet.voiceToastDate = todayKey();
    save(state);
    return { ok: true };
  }

  function buildPetReply(userText) {
    const pet = state.pet;
    const look = petAppearance(state);
    const raw = String(userText || '').trim();
    const t = raw.toLowerCase();

    const name = look.petName || pet.formName || '管家宠';
    const vip = look.vip;
    const formTitle = (look.form && look.form.formTitle) || '管家';
    if (!hasChosenSpecies(pet)) {
      return '先选一只 VIP 管家神兽，我们再一起撒娇～';
    }
    const sp = normalizeSpecies(pet.species);
    const cue = PET_SPECIES[sp].cue || '啾~';
    const unit = PET_SPECIES[sp].unit;

    if (/你好|嗨|哈喽|hello|\bhi\b|回来|在吗/.test(t)) {
      const v = getPetVoiceInfo({ skipToast: true });
      return (v && v.greeting) || cue + ' 你来了～我是「' + name + '」· ' + formTitle + '。';
    }
    if (/好看|外形|羽毛|样子|漂亮|帅|可爱|cute/.test(t)) {
      const v = getPetVoiceInfo({ skipToast: true });
      return (
        cue +
        ' 看看我的' +
        (v.lookBit || '样子') +
        '～我可爱吗？我是「' +
        name +
        '」· ' +
        formTitle +
        '。摸摸我、喂我一口，才会更亮。'
      );
    }
    if (/长大|成长|进化|下一|形态|grow/.test(t) && !/换种|品种/.test(t)) {
      const g = getStageGrowthInfo();
      if (g && g.isUltimate) {
        return cue + ' 我已经是冠宠了——「' + name + '」。还是要你继续养我呀。永远撒娇。';
      }
      return (
        cue +
        ' 我想长大，一直到「' +
        ((g && g.toTitle) || '下一形态') +
        '」。常来看我、陪我玩、喂我一口…别丢下我。'
      );
    }
    if (/想你|爱你|陪|撒娇|喜欢|miss/.test(t)) {
      return cue + ' 好想你。「' + name + '」今天特别黏——摸摸我、说说话、喂我一口。别丢下我。';
    }
    if (/保佑|祝福|保重|好运|谢谢/.test(t)) {
      const v = getPetVoiceInfo({ skipToast: true });
      return (v && v.mode === 'comfort' ? v.greeting : null) || cue + ' 保重。我就在这里。愿你今天顺利。';
    }
    if (/狗|猫|汪|喵|dog|cat/.test(t)) {
      return '这里只有菲律宾神话神兽，没有猫狗哦。我是「' + name + '」· ' + PET_SPECIES[sp].label + '！';
    }
    if (/品种|种类|换种|进化|神兽|神话/.test(t)) {
      return (
        '我是' +
        unit +
        '「' +
        name +
        '」～可以随时更换菲律宾神兽，会继承我现在的形态档。终极形态是「' +
        petUltimateForm(sp).name +
        '」，养成后有礼物（不是充值）！'
      );
    }
    if (/饿|吃|食|肚子|喂一口|喂我/.test(t)) {
      if (pet.hunger < 40) return cue + ' 好饿！饱食 ' + pet.hunger + '——快喂我一口！';
      if (pet.hunger < 70) return '还有点饿…先撑着，等下再喂我好不好？（饱食 ' + pet.hunger + '）' + cue;
      return '吃饱啦！谢谢你。（饱食 ' + pet.hunger + '）' + cue;
    }
    if (/玩|陪玩|play/.test(t)) {
      if (pet.mood < 40) return '有点闷…陪我玩好不好？（心情 ' + pet.mood + '）';
      return cue + ' 陪我玩！心情 ' + pet.mood + '～摸摸我、喂一口，我会更亮。';
    }
    if (/心情|开心|难过|情绪/.test(t)) {
      if (pet.mood < 40) return '有点闷…陪我玩好不好？（心情 ' + pet.mood + '）';
      if (pet.mood < 70) return '还行——再玩一会儿会更开心。';
      return cue + ' 和你在一起超开心 💕';
    }
    if (/脏|清洁|洗澡|净灵露|香波/.test(t)) {
      if (pet.clean < 40) return '有点乱了…帮我清洁 / 梳一梳好不好？（清洁 ' + pet.clean + '）';
      return '已经亮晶晶了！' + cue;
    }
    if (/摸|抱抱|rua|贴贴|pat/.test(t)) {
      return cue + ' 嗯…摸摸好舒服。亲密度 Lv.' + pet.careLevel + '。再宠我一下。';
    }
    if (/vip|冲档|升级|等级/.test(t)) {
      return (
        '冲 VIP 我最懂！我是 VIP' +
        vip +
        ' 绑定的「' +
        name +
        '」· ' +
        formTitle +
        '。去 VIP 页赚 XP；我的外形要靠你抚养才会进下一档哦。'
      );
    }
    if (/谁|什么宠|形态|名字/.test(t)) {
      return (
        '我是「' +
        name +
        '」（' +
        formTitle +
        '）· 一对一绑定 ' +
        look.tier +
        '。外形、成长、感情都要你养～'
      );
    }
    if (/卖|出售|解绑/.test(t)) {
      return '管家宠会一直陪着你，不能出售也不能解绑哦。想换菲律宾神兽就点「更换神兽」，会继承我现在的形态档。';
    }
    if (/排名|积分/.test(t)) {
      return (
        '今日养宠积分 ' +
        (pet.dailyPoints || 0) +
        '～照料和帮养好友都能涨分，去「今日排名」看看！'
      );
    }
    if (/好友|帮养/.test(t)) {
      return '帮好友养宠是正向轻社交，无偷无抢。每天有帮养次数哦～';
    }

    const voice = getPetVoiceInfo({ skipToast: true });
    if (voice && voice.mode === 'nurture') {
      return voice.hint || voice.bubbles[0];
    }
    if (voice && voice.mode === 'comfort') {
      return pickDaily(voice.bubbles, sp + '|chatFall') || voice.greeting;
    }
    const fallbacks = [
      '我就在这里听着。「' + name + '」陪着你～',
      '可以说：摸摸我 / 我可爱吗？ / 保重',
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  function petChatSend(text) {
    applyDecay();
    if (!hasChosenSpecies(state.pet)) return { ok: false, reason: 'need_species' };
    const raw = String(text || '').trim();
    if (!raw) return { ok: false, reason: 'empty' };
    if (raw.length > 80) return { ok: false, reason: 'too_long' };
    pushChat('user', raw);
    const reply = buildPetReply(raw);
    pushChat('pet', reply);
    let intimacyGain = 0;
    let careMeta = null;
    let pointsGain = 0;
    touchPetInteraction('chat');
    trackDailyIntimacyKind('chat');
    intimacyGain = 1;
    careMeta = bumpCareMeta(intimacyGain);
    pointsGain = DAILY_POINTS.chat || 4;
    addDailyPoints(pointsGain);
    emit({ type: 'petChat', text: raw, intimacyGain: intimacyGain });
    return {
      ok: true,
      reply: reply,
      intimacyGain: intimacyGain,
      pointsGain: pointsGain,
      careLeveled: !!(careMeta && careMeta.careLeveled),
      evolveReady: !!(careMeta && careMeta.evolveReady),
      intimacy: getIntimacyInfo(),
      messages: clone(state.pet.chatMessages),
    };
  }

  function petChatGreeting(force) {
    applyDecay();
    const pet = state.pet;
    if (!hasChosenSpecies(pet)) {
      return { ok: true, skipped: true, needSpecies: true, messages: clone(pet.chatMessages || []) };
    }
    const today = todayKey();
    if (!force && pet.chatGreetedDate === today && (pet.chatMessages || []).length) {
      return { ok: true, skipped: true, messages: clone(pet.chatMessages) };
    }
    const look = petAppearance(state);
    const voice = getPetVoiceInfo({ skipToast: true });
    const line = (voice && voice.greeting) || '欢迎回来！「' + look.petName + '」在等你。';
    pushChat('pet', line);
    pet.chatGreetedDate = today;
    emit({ type: 'petChatGreet' });
    return { ok: true, greeting: line, messages: clone(pet.chatMessages) };
  }

  const CHAT_QUICK_CHIPS = ['摸摸我', '喂食', '我可爱吗？', '保重', '好想你', '求求你'];

  /** 演示：临时提升亲密度（不改 VIP） */
  function demoBoostCareLevel(toLevel) {
    applyDecay();
    const pet = state.pet;
    const target = Math.max(1, Math.min(10, Number(toLevel) || 3));
    pet.careLevel = target;
    pet.careCount = Math.max(pet.careCount, (target - 1) * 5);
    touchPetInteraction('demo');
    emit({ type: 'demoCareBoost', careLevel: target });
    return { ok: true, careLevel: target };
  }

  /** 演示：填满本档抚养日+互动，使其可进化（不改 VIP） */
  function demoCompleteStageGrowth() {
    applyDecay();
    const pet = state.pet;
    if (!hasChosenSpecies(pet)) return { ok: false, reason: 'need_species' };
    const growth = getStageGrowthInfo();
    if (growth.isUltimate) return { ok: false, reason: 'ultimate', growth: growth };
    ensureStageProgress(pet);
    pet.stageNurtureDays = Math.max(pet.stageNurtureDays, growth.needDays || 0);
    pet.stageActCount = Math.max(pet.stageActCount, growth.needActs || 0);
    pet.stageLastQualifyAt = Date.now();
    if ((pet.careLevel || 1) < 3) {
      pet.careLevel = 3;
      pet.careCount = Math.max(pet.careCount, 10);
    }
    const next = getStageGrowthInfo();
    emit({ type: 'demoStageGrowth', growth: next });
    return { ok: true, growth: next, canEvolve: !!next.canEvolve };
  }

  /** 演示：直接养成到指定形态档（默认金甲），便于点前面的档看回顾页 */
  function demoGrowToTier(tier) {
    applyDecay();
    const pet = state.pet;
    if (!hasChosenSpecies(pet)) return { ok: false, reason: 'need_species' };
    const target = clampEvoTier(tier == null ? 3 : tier);
    const needXp = (VIP_LEVELS[target] && VIP_LEVELS[target].needXp) || 0;
    const gap = needXp - (state.xp || 0);
    if (gap > 0) addXp(gap + 10);
    pet.evoTier = target;
    backfillStageHistory(pet);
    resetStageProgress(pet);
    if ((pet.careLevel || 1) < 3) {
      pet.careLevel = 3;
      pet.careCount = Math.max(pet.careCount, 10);
    }
    const sync = applyVipPetSync(pet, state.xp, {});
    emit({ type: 'demoGrowToTier', evoTier: target });
    return { ok: true, evoTier: target, look: petAppearance(state), form: sync.form };
  }

  /** 演示：冲至 VIP5 且形态到冠宠，便于看终极奖励 */
  function demoReachUltimateForm() {
    applyDecay();
    const pet = state.pet;
    const need = 50000 - (state.xp || 0);
    if (need > 0) addXp(need + 10);
    pet.evoTier = 5;
    backfillStageHistory(pet);
    resetStageProgress(pet);
    const sync = applyVipPetSync(pet, state.xp, {});
    emit({ type: 'demoUltimateForm', vip: 5 });
    return { ok: true, look: petAppearance(state), form: sync.form };
  }

  function petGuideAdvanceIf(expectedStep, nextStep) {
    const g = state.pet.guide;
    if (!g || g.finished) return false;
    if (g.step === expectedStep) {
      g.step = nextStep;
      if (nextStep >= 5) {
        g.finished = true;
        g.active = false;
      }
      return true;
    }
    return false;
  }

  function petGuideNext() {
    applyDecay();
    const g = state.pet.guide;
    if (!g || g.finished) return { ok: false, reason: 'done' };
    // Linear next for informational steps; action steps stay until care
    if (g.step === 0) {
      g.step = 1;
    } else if (g.step === 1) {
      g.step = 2;
    } else if (g.step === 2 || g.step === 3) {
      // waiting for care action — UI may dismiss overlay
      emit({ type: 'petGuide', step: g.step, waiting: true });
      return { ok: true, step: g.step, waiting: true };
    } else if (g.step === 4) {
      g.finished = true;
      g.active = false;
      g.step = 5;
      emit({ type: 'petGuide', step: 5, guideDone: true });
      return { ok: true, step: 5, guideDone: true };
    } else {
      return { ok: false, reason: 'done' };
    }
    emit({ type: 'petGuide', step: g.step });
    return { ok: true, step: g.step };
  }

  function petSkipGuide() {
    applyDecay();
    const g = state.pet.guide;
    g.finished = true;
    g.active = false;
    g.step = 5;
    emit({ type: 'petGuideSkip' });
    return { ok: true, guideDone: true };
  }

  /** ——— Manor actions ——— */

  const Store = {
    VIP_LEVELS,
    XP_RULES,
    DAILY_POINTS,
    HELP_QUOTA_DAILY,
    CARE_PROTECT_MS,
    PET_FORMS_BY_VIP,
    PET_FORMS_BY_SPECIES,
    PET_SPECIES,
    PET_SPECIES_IDS,
    ART_STYLES,
    STAGE_GROWTH,
    CHAT_QUICK_CHIPS,
    INV_DAILY_FREE,
    INTIMACY_ACTIONS,
    DAILY_INTIMACY_QUESTS,
    ULTIMATE_REWARD_OPTIONS,

    get() {
      return state;
    },

    subscribe(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },

    reset() {
      state = clone(DEFAULT_STATE);
      state.pet = clone(PET_DEFAULT);
      state.pet.friends = cloneFriends();
      state.pet.rankSeed = cloneRankSeed();
      state.pet.chatMessages = [];
      state.pet.chatDate = todayKey();
      state.pet.chatGreetedDate = null;
      state.pet.lastCareAt = Date.now();
      state.pet.lastInteractAt = Date.now();
      state.pet.lastDecayAt = Date.now();
      state.pet.adoptedAt = Date.now();
      state.pet.dailyPointsDate = todayKey();
      state.pet.helpDate = todayKey();
      state.pet.inventoryDate = todayKey();
      delete state.virtualGold;
      delete state.virtualGems;
      applyVipPetSync(state.pet, state.xp, { silent: true });
      emit({ type: 'reset' });
    },

    levelFromXp,
    progressToNext,
    formatMoney,
    formatXp,
    petAppearance,
    applyDecay,

    claimCashback() {
      if (state.cashbackClaimed || state.dailyCashback <= 0) {
        return { ok: false, reason: 'claimed' };
      }
      const amt = state.dailyCashback;
      state.p = round2(state.p + amt);
      state.dailyCashback = 0;
      state.cashbackClaimed = true;
      let xpGain = XP_RULES.claimCashback;
      let taskXp = 0;
      if (!state.tasks.claimCashback) {
        state.tasks.claimCashback = true;
        taskXp = XP_RULES.dailyTask.claimCashback;
        xpGain += taskXp;
      }
      const leveled = addXp(xpGain);
      emit({ type: 'cashback', amount: amt, xpGain, leveled });
      return { ok: true, amount: amt, xpGain, leveled, taskXp };
    },

    completeLoginTask() {
      if (state.tasks.login) return { ok: false, reason: 'done' };
      state.tasks.login = true;
      const xpGain = XP_RULES.dailyTask.login;
      const leveled = addXp(xpGain);
      emit({ type: 'task', task: 'login', xpGain, leveled });
      return { ok: true, xpGain, leveled };
    },

    completeVisitVipTask() {
      if (state.tasks.visitVip) return { ok: false, reason: 'done' };
      state.tasks.visitVip = true;
      const xpGain = XP_RULES.dailyTask.visitVip;
      const leveled = addXp(xpGain);
      emit({ type: 'task', task: 'visitVip', xpGain, leveled });
      return { ok: true, xpGain, leveled };
    },

    completeWatchVideoTask() {
      if (state.tasks.watchVideo) return { ok: false, reason: 'done' };
      state.tasks.watchVideo = true;
      const xpGain = XP_RULES.dailyTask.watchVideo;
      const leveled = addXp(xpGain);
      emit({ type: 'task', task: 'watchVideo', xpGain, leveled });
      return { ok: true, xpGain, leveled };
    },

    demoDeposit(amount) {
      const amt = amount != null ? Number(amount) : 100;
      if (!(amt > 0)) return { ok: false, reason: 'invalid' };
      state.p = round2(state.p + amt);
      const xpGain = XP_RULES.depositDemo;
      const leveled = addXp(xpGain);
      emit({ type: 'deposit', amount: amt, xpGain, leveled });
      return { ok: true, amount: amt, xpGain, leveled };
    },

    demoAddXp(amount) {
      const xpGain = amount != null ? Number(amount) : XP_RULES.demoBump;
      const leveled = addXp(xpGain);
      emit({ type: 'demoXp', xpGain, leveled });
      return { ok: true, xpGain, leveled };
    },

    careFeed() {
      return careAction('feed', false);
    },
    carePlay() {
      return careAction('play', false);
    },
    careDrink() {
      return careAction('drink', false);
    },
    careClean() {
      return careAction('clean', false);
    },
    carePat() {
      return careAction('pat', false);
    },
    careWalk() {
      return careAction('walk', false);
    },
    careStory() {
      return careAction('story', false);
    },
    careSnack() {
      return careAction('snack', false);
    },
    carePhoto() {
      return careAction('photo', false);
    },
    careWithItem(kind) {
      if (kind !== 'feed' && kind !== 'play' && kind !== 'clean') {
        return { ok: false, reason: 'unknown' };
      }
      return careAction(kind, true);
    },

    /** 免费领取道具补给（无付费） */
    claimFreePetItem(item) {
      if (item !== 'food' && item !== 'toy' && item !== 'soap') {
        return { ok: false, reason: 'unknown' };
      }
      applyDecay();
      const pet = state.pet;
      pet.inventory[item] = (pet.inventory[item] || 0) + 1;
      emit({ type: 'freeItem', item: item });
      return { ok: true, item: item, inventory: clone(pet.inventory), feedback: '已免费领取补给' };
    },

    getPetSnapshot() {
      applyDecay();
      refreshPetSocialDaily(state.pet);
      syncPetToVip({ silent: true });
      const rank = getDailyRankboard();
      const needsInfo = getPetNeedsInfo({ skipToast: true });
      const voiceInfo = getPetVoiceInfo({ skipToast: true });
      const nextForm = getNextFormTeaser();
      const friends = (state.pet.friends || []).map(function (f) {
        const form = petFormForVip(f.vip, f.species);
        return Object.assign(clone(f), {
          needHint: friendNeedHint(f),
          petEmoji: form.emoji,
          petName: form.name,
          speciesLabel: PET_SPECIES[resolveSpecies(f.species, SPECIES_FALLBACK)].label,
          tier: vipTierName(f.vip),
        });
      });
      save(state);
      return {
        pet: clone(state.pet),
        look: petAppearance(state),
        guide: clone(state.pet.guide),
        daily: {
          points: state.pet.dailyPoints || 0,
          allTimePoints: state.pet.allTimePoints || 0,
          helpUsed: state.pet.helpUsed || 0,
          helpMax: HELP_QUOTA_DAILY,
        },
        rank: rank,
        friends: friends,
        forms: getPetFormGallery(),
        species: normalizeSpecies(state.pet.species),
        speciesChosen: !!state.pet.speciesChosen,
        needsSpeciesPick: !hasChosenSpecies(state.pet),
        speciesCatalog: getSpeciesCatalog(),
        speciesRule:
          '一员一宠始终绑定；首次进窝必选菲律宾神兽；可随时更换神兽并继承当前形态档；形态靠抚养日+互动进阶。VIP 只作成长上限。无出售/无付费换种。',
        careProtect: getCareProtectInfo(),
        nurtureCadence: getNurtureCadenceInfo(),
        careDemoteToast: (function () {
          const m = pendingCareDemoteToast;
          pendingCareDemoteToast = null;
          return m;
        })(),
        intimacy: getIntimacyInfo(),
        intimacyQuests: getDailyIntimacyQuests(),
        evolve: getEvolveInfo(),
        stageGrowth: getStageGrowthInfo(),
        formNurture: getFormNurtureSummary(),
        needs: needsInfo,
        voice: voiceInfo,
        nextForm: nextForm,
        ultimateReward: getUltimateRewardInfo(),
        ultimatePick: (function () {
          if (pendingUltimatePick) return pendingUltimatePick;
          const info = getUltimateRewardInfo();
          if (!info.canClaim) return null;
          return {
            species: info.species,
            speciesLabel: info.speciesLabel,
            form: info.form,
            options: info.options,
            note: info.note,
          };
        })(),
        ultimateCelebrate: consumeUltimateCelebrate(),
        intimacyActions: Object.keys(INTIMACY_ACTIONS).map(function (k) {
          const a = INTIMACY_ACTIONS[k];
          return { id: k, label: a.label, intimacy: a.intimacy, xp: a.xp, icon: a.icon };
        }),
        chat: {
          messages: clone(state.pet.chatMessages || []),
          chips: (voiceInfo && voiceInfo.chips && voiceInfo.chips.slice()) || CHAT_QUICK_CHIPS.slice(),
        },
        pointsRules: clone(DAILY_POINTS),
      };
    },

    getDailyRankboard,
    helpFriendCare,
    evolvePet,
    chooseStarterSpecies,
    switchPetSpecies,
    getSpeciesSwitchInfo,
    getEvolveInfo,
    getIntimacyInfo,
    getDailyIntimacyQuests,
    claimDailyIntimacyQuest,
    getUltimateRewardInfo,
    claimUltimateReward,
    petUltimateForm,
    getPetNeedsInfo,
    getPetVoiceInfo,
    markVoiceToastShown,
    getNextFormTeaser,
    getStageGrowthInfo,
    getFormNurtureSummary,
    demoBoostCareLevel,
    demoCompleteStageGrowth,
    demoGrowToTier,
    demoReachUltimateForm,
    demoSkipCareProtect,
    demoExpirePetNeeds,
    demoSatisfyAllNeeds,
    getCareProtectInfo,
    getNurtureCadenceInfo,
    applyCareLevelDecay,
    friendNeedHint,
    syncPetToVip,
    getPetFormGallery,
    getSpeciesCatalog,
    petFormForVip,
    petDisplayTier,
    petChatSend,
    petChatGreeting,
    petAppearance,
    setArtStyle,
    getArtStyleSwitchInfo,
    artSheetUrl,
    formArtFrame,
    formArtUrl,
    normalizeArtStyle,
    artStyleLabel,
    normalizeSpecies,
    hasChosenSpecies,
    PET_NEED_DEFS,
    NEED_SATISFY_MS,

    petGuideNext,
    petSkipGuide,
    petGuideAdvanceIf,

  };

  global.TTStore = Store;
})(typeof window !== 'undefined' ? window : globalThis);

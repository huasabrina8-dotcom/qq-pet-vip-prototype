/**
 * VIP管家宠 · 冲档版 — shared state (localStorage)
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

  /** 主动需求：满足后 24h 安静；到期后再次提醒 */
  const NEED_SATISFY_MS = 24 * 60 * 60 * 1000;
  const PET_NEED_DEFS = {
    eat: {
      id: 'eat',
      label: '想吃',
      satisfiedLabel: '饱食满足',
      action: 'feed',
      icon: '🍖',
      bubble: '想吃东西…',
      flag: 'hungry',
      evolveNudge: '喂饱我就能更接近下一形态哦',
    },
    play: {
      id: 'play',
      label: '想玩',
      satisfiedLabel: '玩乐满足',
      action: 'play',
      icon: '🎾',
      bubble: '想玩一会儿…',
      flag: 'wantPlay',
      evolveNudge: '陪我玩一玩，离下一形态更近啦',
    },
    drink: {
      id: 'drink',
      label: '想喝',
      satisfiedLabel: '饮水满足',
      action: 'drink',
      icon: '💧',
      bubble: '好渴，想喝水…',
      flag: 'wantDrink',
      evolveNudge: '喝饱水再继续抚养，就能进化咯',
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
  /** 亲密度每升 1 级可进化一步；同种内 evoTier 升档，展示形态 = max(evoTier, VIP) */
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
      unit: '神鸟',
      loreEn: 'Maranao lucky bird',
      loreZh: '吉祥彩羽',
    },
    bakunawa: {
      id: 'bakunawa',
      label: '月食神龙',
      labelEn: 'Bakunawa',
      tone: '嗷',
      unit: '神龙',
      loreEn: 'Moon serpent',
      loreZh: '守护月光',
    },
    diwata: {
      id: 'diwata',
      label: '山林精灵',
      labelEn: 'Diwata',
      tone: '叮',
      unit: '精灵',
      loreEn: 'Nature spirit',
      loreZh: '守护山林',
    },
    tigmamanukan: {
      id: 'tigmamanukan',
      label: '吉兆灵鸟',
      labelEn: 'Tigmamanukan',
      tone: '啼',
      unit: '灵鸟',
      loreEn: 'Sacred omen bird · Bathala',
      loreZh: 'Bathala 吉兆',
    },
    sirena: {
      id: 'sirena',
      label: '海之仙女',
      labelEn: 'Sirena',
      tone: '哼',
      unit: '海仙',
      loreEn: 'Sea maiden',
      loreZh: '守护海域',
    },
    kapre: {
      id: 'kapre',
      label: '树精守护神',
      labelEn: 'Kapre',
      tone: '呵',
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
      5: { id: 'sari_crowned', name: '冠羽吉祥鸟', formTitle: '冠宠', emoji: '🦚', stage: 'legend', accent: '#c9a0ff', desc: '彩羽神鸟 · VIP5 冠宠 · Sarimanok' },
    },
    bakunawa: {
      0: { id: 'baku_egg', name: '月卵幼龙', formTitle: '幼宠', emoji: '🥚', stage: 'baby', accent: '#ffd4a8', desc: '月食神龙 · 入门幼龙' },
      1: { id: 'baku_silver', name: '银徽月蛟', formTitle: '银徽', emoji: '🦎', stage: 'baby', accent: '#b8c4d8', desc: '月食神龙 · VIP1 银徽' },
      2: { id: 'baku_butler', name: '管家月蛇', formTitle: '管家', emoji: '🐍', stage: 'buddy', accent: '#ffb86b', desc: '月食神龙 · VIP2 管家' },
      3: { id: 'baku_golden', name: '金甲月龙', formTitle: '金甲', emoji: '🐲', stage: 'buddy', accent: '#f5c542', desc: '月食神龙 · VIP3 金甲' },
      4: { id: 'baku_winged', name: '翼月神龙', formTitle: '翼宠', emoji: '🌌', stage: 'elite', accent: '#7eb6ff', desc: '月食神龙 · VIP4 翼形态' },
      5: { id: 'baku_crowned', name: '冠月食神龙', formTitle: '冠宠', emoji: '🐉', stage: 'legend', accent: '#c9a0ff', desc: '月食神龙 · VIP5 冠宠 · Bakunawa' },
    },
    diwata: {
      0: { id: 'diwa_sprout', name: '幼芽精灵', formTitle: '幼宠', emoji: '🌱', stage: 'baby', accent: '#ffd4a8', desc: '山林精灵 · 入门幼芽' },
      1: { id: 'diwa_silver', name: '银徽林灵', formTitle: '银徽', emoji: '🍃', stage: 'baby', accent: '#b8c4d8', desc: '山林精灵 · VIP1 银徽' },
      2: { id: 'diwa_butler', name: '管家山林', formTitle: '管家', emoji: '🌿', stage: 'buddy', accent: '#ffb86b', desc: '山林精灵 · VIP2 管家' },
      3: { id: 'diwa_golden', name: '金甲灵光', formTitle: '金甲', emoji: '✨', stage: 'buddy', accent: '#f5c542', desc: '山林精灵 · VIP3 金甲' },
      4: { id: 'diwa_winged', name: '翼林精灵', formTitle: '翼宠', emoji: '🦋', stage: 'elite', accent: '#7eb6ff', desc: '山林精灵 · VIP4 翼形态' },
      5: { id: 'diwa_crowned', name: '冠山林精灵', formTitle: '冠宠', emoji: '🧚', stage: 'legend', accent: '#c9a0ff', desc: '山林精灵 · VIP5 冠宠 · Diwata' },
    },
    tigmamanukan: {
      0: { id: 'tig_chick', name: '幼兆灵鸟', formTitle: '幼宠', emoji: '🐤', stage: 'baby', accent: '#ffd4a8', desc: '吉兆灵鸟 · 入门幼兆' },
      1: { id: 'tig_silver', name: '银徽吉兆', formTitle: '银徽', emoji: '🐦', stage: 'baby', accent: '#b8c4d8', desc: '吉兆灵鸟 · VIP1 银徽' },
      2: { id: 'tig_butler', name: '管家灵鸟', formTitle: '管家', emoji: '🕊️', stage: 'buddy', accent: '#ffb86b', desc: '吉兆灵鸟 · VIP2 管家' },
      3: { id: 'tig_golden', name: '金甲兆羽', formTitle: '金甲', emoji: '🦉', stage: 'buddy', accent: '#f5c542', desc: '吉兆灵鸟 · VIP3 金甲' },
      4: { id: 'tig_winged', name: '翼吉兆鸟', formTitle: '翼宠', emoji: '🪽', stage: 'elite', accent: '#7eb6ff', desc: '吉兆灵鸟 · VIP4 翼形态' },
      5: { id: 'tig_crowned', name: '冠Bathala灵鸟', formTitle: '冠宠', emoji: '🦅', stage: 'legend', accent: '#c9a0ff', desc: '吉兆灵鸟 · VIP5 冠宠 · Tigmamanukan' },
    },
    sirena: {
      0: { id: 'sire_bubble', name: '幼浪海仙', formTitle: '幼宠', emoji: '🫧', stage: 'baby', accent: '#ffd4a8', desc: '海之仙女 · 入门幼浪' },
      1: { id: 'sire_silver', name: '银徽海珠', formTitle: '银徽', emoji: '🐚', stage: 'baby', accent: '#b8c4d8', desc: '海之仙女 · VIP1 银徽' },
      2: { id: 'sire_butler', name: '管家海灵', formTitle: '管家', emoji: '🐟', stage: 'buddy', accent: '#ffb86b', desc: '海之仙女 · VIP2 管家' },
      3: { id: 'sire_golden', name: '金甲海仙', formTitle: '金甲', emoji: '🐠', stage: 'buddy', accent: '#f5c542', desc: '海之仙女 · VIP3 金甲' },
      4: { id: 'sire_winged', name: '翼潮仙女', formTitle: '翼宠', emoji: '🌊', stage: 'elite', accent: '#7eb6ff', desc: '海之仙女 · VIP4 翼形态' },
      5: { id: 'sire_crowned', name: '冠海之仙女', formTitle: '冠宠', emoji: '🧜', stage: 'legend', accent: '#c9a0ff', desc: '海之仙女 · VIP5 冠宠 · Sirena' },
    },
    kapre: {
      0: { id: 'kap_sprout', name: '幼芽树精', formTitle: '幼宠', emoji: '🪵', stage: 'baby', accent: '#ffd4a8', desc: '树精守护神 · 入门幼芽' },
      1: { id: 'kap_silver', name: '银徽树灵', formTitle: '银徽', emoji: '🌿', stage: 'baby', accent: '#b8c4d8', desc: '树精守护神 · VIP1 银徽' },
      2: { id: 'kap_butler', name: '管家树精', formTitle: '管家', emoji: '🌳', stage: 'buddy', accent: '#ffb86b', desc: '树精守护神 · VIP2 管家' },
      3: { id: 'kap_golden', name: '金甲树卫', formTitle: '金甲', emoji: '🛡️', stage: 'buddy', accent: '#f5c542', desc: '树精守护神 · VIP3 金甲' },
      4: { id: 'kap_winged', name: '翼林树神', formTitle: '翼宠', emoji: '🎋', stage: 'elite', accent: '#7eb6ff', desc: '树精守护神 · VIP4 翼形态' },
      5: { id: 'kap_crowned', name: '冠树精守护神', formTitle: '冠宠', emoji: '🏯', stage: 'legend', accent: '#c9a0ff', desc: '树精守护神 · VIP5 冠宠 · Kapre' },
    },
  };

  /** 兼容旧引用：展示用默认形态表（未选种前） */
  const PET_FORMS_BY_VIP = PET_FORMS_BY_SPECIES.sarimanok;

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

  /** 展示形态档：抚养进化档与 VIP 取高（VIP 更高时同步换皮） */
  function petDisplayTier(pet, vipOpt) {
    const vip =
      vipOpt != null
        ? Math.max(0, Math.min(5, Math.floor(Number(vipOpt) || 0)))
        : levelFromXp(state.xp);
    const bound =
      pet && pet.boundVipLevel != null
        ? Math.max(0, Math.min(5, Math.floor(Number(pet.boundVipLevel) || 0)))
        : vip;
    const evo = clampEvoTier(pet && pet.evoTier);
    return Math.max(evo, bound, vip);
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
    /** 抚养驱动的同种形态阶（0–5）；展示档 = max(evoTier, VIP) */
    evoTier: 0,
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
    /** 品种：首次进窝必选；亲密度进化时可在 6 种菲律宾神兽间换种 */
    species: null,
    /** 是否已完成首次选种（未选则照料/对话/进化均阻塞） */
    speciesChosen: false,
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
    const formGuess = speciesFinal
      ? petFormForVip(p.boundVipLevel != null ? p.boundVipLevel : vipGuess, speciesFinal)
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
      evoTier: clampEvoTier(p.evoTier != null ? p.evoTier : 0),
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
      };
    }
    const sp = normalizeSpecies(pet.species);
    const spMeta = PET_SPECIES[sp];
    const form = petFormForVip(displayTier, sp);
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
    };
  }

  /**
   * 一对一绑定：会员 VIP ↔ 管家宠形态
   * 升档换形态/名称；品种仅通过亲密度进化换种
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
        displayTier: Math.max(pet.evoTier, vip),
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
    const displayTier = Math.max(pet.evoTier, vip);
    const form = petFormForVip(displayTier, sp);
    pet.formId = form.id;
    pet.formName = form.name;
    pet.petName = form.name;
    const changed = prevForm !== form.id || prevVip !== vip;
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
    const displayTier = petDisplayTier(pet, vip);
    const unlockedCeil = Math.max(vip, clampEvoTier(pet.evoTier));
    return [0, 1, 2, 3, 4, 5].map(function (lv) {
      const form = petFormForVip(lv, sp);
      return {
        vip: lv,
        tier: vipTierName(lv),
        species: sp,
        form: clone(form),
        unlocked: unlockedCeil >= lv,
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

  function getSpeciesCatalog() {
    const vip = levelFromXp(state.xp);
    return PET_SPECIES_IDS.map(function (sp) {
      const meta = PET_SPECIES[sp];
      const preview = petFormForVip(vip, sp);
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
        preview: clone(preview),
        starter: clone(starter),
        /** 当前 VIP 形态预览 */
        currentPreview: clone(preview),
        /** 终极形态 VIP5 */
        ultimate: ultimate,
        ultimateLabel: ultimate.labelLine,
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
    const sync = applyVipPetSync(pet, state.xp, {});
    const form = sync.form;
    const meta = PET_SPECIES[sp];
    const tone = meta.tone;
    const greet =
      tone +
      '～你好！我是「' +
      (form && form.name) +
      '」· ' +
      meta.label +
      '（' +
      meta.labelEn +
      '），已与你 VIP 一对一绑定～一起冲档吧！';
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

  /**
   * 亲密度进化：careLevel > lastEvolvedLevel 时可进化；
   * 确认后同种 evoTier +1（形态步进），并可在 6 种菲律宾神兽间换种；展示 = max(evoTier, VIP)。
   */
  function getEvolveInfo() {
    ensurePet(state);
    applyDecay();
    const pet = state.pet;
    const vip = levelFromXp(state.xp);
    const careLevel = Math.max(1, pet.careLevel || 1);
    const lastEv = Math.max(1, Number(pet.lastEvolvedLevel) || 1);
    if (!hasChosenSpecies(pet)) {
      return {
        canEvolve: false,
        reason: 'need_species',
        careLevel: careLevel,
        lastEvolvedLevel: lastEv,
        options: getSpeciesCatalog(),
        rules: EVOLVE_RULES_COPY.slice(),
      };
    }
    const currentSp = normalizeSpecies(pet.species);
    const evoTier = clampEvoTier(pet.evoTier);
    const displayTier = petDisplayTier(pet, vip);
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
    };
    const canEvolve = careLevel > lastEv;
    return Object.assign(base, {
      canEvolve: canEvolve,
      reason: canEvolve ? null : 'need_care_level',
    });
  }

  const EVOLVE_RULES_COPY = [
    '亲密度每升 1 级可进行一次「进化」',
    '每次进化：同种形态升一阶（抚养驱动）+ 可选换菲律宾神兽品种一次（默认保留）',
    '展示形态 = max(抚养阶, VIP)；VIP 更高时自动换皮同步',
    '舞台始终预览「下一形态」；达终极（冠宠）可自选养成奖励（非充值）',
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
    const prevDisplay = petDisplayTier(pet, levelFromXp(state.xp));
    let nextSp = normalizeSpecies(opts.species);
    if (!nextSp) nextSp = prevSpecies;
    const switched = nextSp !== prevSpecies;
    pet.species = nextSp;
    pet.lastEvolvedLevel = Math.max(1, pet.careLevel || 1);
    // 抚养步进：同种形态升一阶（至少超过当前展示档）
    pet.evoTier = clampEvoTier(Math.max(clampEvoTier(pet.evoTier), prevDisplay) + 1);
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
   * 进度：距可进化所需亲密度；已可进化则提示点进化。
   */
  function getNextFormTeaser() {
    ensurePet(state);
    const pet = state.pet;
    const vip = levelFromXp(state.xp);
    if (!hasChosenSpecies(pet)) {
      return {
        bound: true,
        isUltimate: false,
        currentForm: null,
        nextForm: null,
        displayTier: petDisplayTier(pet, vip),
        evoTier: clampEvoTier(pet.evoTier),
        evolveReady: false,
        intimacyNeeded: 0,
        progressPct: 0,
        progressHint: '请先选择 VIP管家神兽',
        tip: '首次进入宠物窝需选择一种菲律宾神兽。',
        celebrate: false,
        needSpecies: true,
      };
    }
    const sp = normalizeSpecies(pet.species);
    const displayTier = petDisplayTier(pet, vip);
    const currentForm = petFormForVip(displayTier, sp);
    const intimacy = getIntimacyInfo();
    const lastEv = Math.max(1, Number(pet.lastEvolvedLevel) || 1);
    const careLevel = Math.max(1, pet.careLevel || 1);
    const evolveReady = careLevel > lastEv;

    if (displayTier >= 5) {
      return {
        bound: true,
        isUltimate: true,
        currentForm: clone(currentForm),
        nextForm: null,
        displayTier: displayTier,
        evoTier: clampEvoTier(pet.evoTier),
        evolveReady: evolveReady,
        intimacyNeeded: 0,
        progressPct: 100,
        progressHint: '已达终极形态',
        tip: '冠宠达成！可自选养成奖励（非充值）。继续照料仍涨亲密度与 VIP XP。',
        celebrate: true,
      };
    }

    const nextTier = displayTier + 1;
    const nextForm = petFormForVip(nextTier, sp);
    let intimacyNeeded = 0;
    if (!evolveReady) {
      const targetLevel = Math.min(10, lastEv + 1);
      const targetCount = (targetLevel - 1) * INTIMACY_PER_LEVEL;
      intimacyNeeded = Math.max(0, targetCount - (pet.careCount || 0));
    }
    const barPct = evolveReady ? 100 : intimacy.maxed ? 100 : intimacy.pct || 0;
    let progressHint;
    if (evolveReady) {
      progressHint = '可进化解锁「' + nextForm.name + '」';
    } else if (intimacyNeeded > 0) {
      progressHint = '再获 ' + intimacyNeeded + ' 亲密度可进化';
    } else {
      progressHint = '继续抚养解锁下一形态';
    }
    return {
      bound: true,
      isUltimate: false,
      currentForm: clone(currentForm),
      nextForm: clone(nextForm),
      nextTier: nextTier,
      displayTier: displayTier,
      evoTier: clampEvoTier(pet.evoTier),
      evolveReady: evolveReady,
      intimacyNeeded: intimacyNeeded,
      progressPct: barPct,
      progressHint: progressHint,
      tip:
        '持续满足想吃/想玩/想喝并照料，攒亲密度后点「进化」解锁「' +
        nextForm.name +
        '」。也可保留或换其他菲律宾神兽。',
      celebrate: false,
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
    const after = pet.careLevel;
    const lastEv = Math.max(1, Number(pet.lastEvolvedLevel) || 1);
    return {
      careLeveled: after > before,
      from: before,
      to: after,
      intimacyGain: gain,
      doubled: doubled,
      evolveReady: after > lastEv,
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
      evolveReady: careLevel > lastEv,
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

  function pushChatSystem(text) {
    pushChat('pet', text);
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
      return '请先选择你的 VIP管家神兽，再来和我聊天呀～';
    }
    const sp = normalizeSpecies(pet.species);
    const tone = PET_SPECIES[sp].tone;
    const unit = PET_SPECIES[sp].unit;

    if (/你好|嗨|哈喽|hello|hi/.test(t)) {
      return tone + '～你好！我是「' + name + '」· ' + PET_SPECIES[sp].label + formTitle + '，已绑定 VIP' + vip + '～';
    }
    if (/狗|猫|汪|喵|dog|cat/.test(t)) {
      return '这里只有菲律宾神话神兽哦，没有猫狗这类现实宠物～我是「' + name + '」· ' + PET_SPECIES[sp].label + '！';
    }
    if (/品种|种类|换种|进化|神兽|神话/.test(t)) {
      return (
        '我是菲律宾神兽·' +
        unit +
        '「' +
        name +
        '」呀～亲密度升级可「进化」换其他神兽；终极形态是「' +
        petUltimateForm(sp).name +
        '」，达成有养成奖励哦（非充值）！'
      );
    }
    if (/饿|吃|食|肚子/.test(t)) {
      if (pet.hunger < 40) return tone + '…好饿！饱食才 ' + pet.hunger + '，快喂我一口嘛！';
      if (pet.hunger < 70) return '有点想吃仙果，不过还能撑～（饱食 ' + pet.hunger + '）' + tone;
      return '吃得好饱！谢谢你照顾我～（饱食 ' + pet.hunger + '）' + tone + '~';
    }
    if (/心情|开心|难过|情绪/.test(t)) {
      if (pet.mood < 40) return '有点闷闷的…陪我玩一会儿好不好？（心情 ' + pet.mood + '）';
      if (pet.mood < 70) return '还不错啦，再玩一下会更开心～';
      return tone + '！超级开心！和你在一起最好啦 💕';
    }
    if (/脏|清洁|洗澡|净灵露|香波/.test(t)) {
      if (pet.clean < 40) return '毛毛乱糟糟…求清洁！（清洁 ' + pet.clean + '）';
      return '亮晶晶！今天也香喷喷～' + tone;
    }
    if (/摸|抱抱|rua|贴贴/.test(t)) {
      return tone + '嗯嗯～被摸摸好幸福。亲密度 Lv.' + pet.careLevel + '，继续加油！';
    }
    if (/vip|冲档|升级|等级/.test(t)) {
      return (
        '冲 VIP 我最懂！我是 VIP' +
        vip +
        ' 绑定的「' +
        name +
        '」。去 VIP 页做任务赚 XP，升档我会换新形态哦！'
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
        '。不同 VIP 等级有不同管家宠形态～'
      );
    }
    if (/卖|出售|解绑/.test(t)) {
      return '管家宠会一直陪着你，不能出售也不能解绑哦。品种可在亲密度「进化」时换菲律宾神兽～';
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

    const recentCare = Date.now() - (pet.lastCareAt || 0) < 5 * 60 * 1000;
    if (recentCare) {
      return '刚才被你照料得好舒服…再聊几句？我是「' + name + '」呀～';
    }
    const avg = (pet.hunger + pet.mood + pet.clean) / 3;
    if (avg < 45) {
      return '状态有点低…喂食/玩耍/清洁一下，我立刻活过来！';
    }
    const fallbacks = [
      '嗯嗯，我在听！「' + name + '」陪着你冲 VIP' + vip + '～',
      '今天也要元气满满！要点照料还是去看排名？',
      '和你聊天好开心。试试快捷语：饿不饿 / 去冲VIP / 摸摸',
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
    let line;
    const avg = (pet.hunger + pet.mood + pet.clean) / 3;
    if (avg < 40) {
      line =
        '主人…「' + look.petName + '」有点难受（状态偏低），快来照料我一下嘛。';
    } else if (pet.hunger < 45) {
      line = '「' + look.petName + '」肚子咕咕叫…喂一口好不好？';
    } else {
      const cadence = getNurtureCadenceInfo();
      if (cadence.status === 'due' || cadence.status === 'overdue') {
        line =
          '欢迎回来！「' +
          look.petName +
          '」等你深度抚养啦～每 24 小时回来一次，一起参与成长！';
      } else if (cadence.status === 'due_soon') {
        line =
          '欢迎回来！亲密度保护快到期了，完成今日深度抚养就能续护～';
      } else {
        line =
          '欢迎回来！我是已绑定 ' +
          look.tier +
          ' 的「' +
          look.petName +
          '」· 今日积分 ' +
          (pet.dailyPoints || 0) +
          '～记得每 24 小时回来抚养一次哦';
      }
    }
    pushChat('pet', line);
    pet.chatGreetedDate = today;
    emit({ type: 'petChatGreet' });
    return { ok: true, greeting: line, messages: clone(pet.chatMessages) };
  }

  const CHAT_QUICK_CHIPS = ['你好', '饿不饿', '去冲VIP', '摸摸', '你是谁', '看排名'];

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
      const needsInfo = getPetNeedsInfo();
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
          '一员一宠始终绑定；首次进窝必选菲律宾神兽；亲密度「进化」时可换种（展示终极形态）。VIP 升档同种换皮。无出售/无付费换种。',
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
        needs: needsInfo,
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
          chips: CHAT_QUICK_CHIPS.slice(),
        },
        pointsRules: clone(DAILY_POINTS),
      };
    },

    getDailyRankboard,
    helpFriendCare,
    evolvePet,
    chooseStarterSpecies,
    getEvolveInfo,
    getIntimacyInfo,
    getDailyIntimacyQuests,
    claimDailyIntimacyQuest,
    getUltimateRewardInfo,
    claimUltimateReward,
    petUltimateForm,
    getPetNeedsInfo,
    getNextFormTeaser,
    demoBoostCareLevel,
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

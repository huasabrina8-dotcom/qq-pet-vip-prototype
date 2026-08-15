/**
 * Pet nest — intimacy care / evolve species / ultimate reward pick / no paywalls
 */
(function () {
  'use strict';

  const { $, toast, renderHeader, bindCommon, handleLeveled } = TTUI;

  const GUIDE_COPY = [
    {
      label: '新手 1/6',
      title: '认识 VIP管家宠',
      desc: '欢迎来到宠物窝！我是与你 VIP 一对一绑定的管家宠——不同 VIP 等级有不同形态；VIP5 终极形态可自选养成奖励（非充值）～',
      primary: '下一步',
      action: 'next',
      highlight: null,
    },
    {
      label: '新手 2/6',
      title: '看懂状态条',
      desc: '🍽 饱食 · 😊 心情 · ✨ 清洁（还有健康）会随时间慢慢下降。偏低时来照料，状态立刻回升！',
      primary: '下一步',
      action: 'next',
      highlight: 'stats',
    },
    {
      label: '新手 3/6',
      title: '先喂一口',
      desc: '当日抚养可以点「饱食」喂神兽。点「下一步」继续。',
      primary: '下一步',
      action: 'next',
      highlight: 'feed',
    },
    {
      label: '新手 4/6',
      title: '再照料一次',
      desc: '还可以点「喝水」「清洁」。更多互动里可以抚摸、玩耍。点「下一步」继续。',
      primary: '下一步',
      action: 'next',
      highlight: 'playclean',
    },
    {
      label: '新手 5/6',
      title: '进化 · 对话页签',
      desc: '亲密度升级可「进化」并换菲律宾神兽。窝里「对话」页签也能聊天、涨亲密度。建议每 24 小时回来深度抚养一次。',
      primary: '下一步',
      action: 'next',
      highlight: null,
    },
    {
      label: '新手 6/6',
      title: '整页悬浮对话框',
      desc: '萌宠会浮在整页最上面走来走去。点它打开对话框说话（计入今日深度抚养）；按住可以拖到任意位置。大厅里同样有这只悬浮萌宠。',
      primary: '开始照看',
      action: 'finish',
      highlight: 'petfloat',
    },
  ];

  const REACT = {
    feed: ['😋', '🍖', '✨'],
    play: ['😆', '🎾', '💕'],
    drink: ['💧', '😌', '✨'],
    clean: ['🫧', '✨', '🛁'],
    pat: ['🥰', '🖐', '💕'],
    walk: ['🚶', '🌿', '😊'],
    story: ['📖', '🌙', '✨'],
    snack: ['🍪', '😋', '💕'],
    photo: ['📷', '✨', '😆'],
  };

  let activeTab = 'care';
  let protectTimer = null;
  let bubbleTimer = null;
  let bubbleIndex = 0;
  let evolvePickSpecies = null;
  let switchPickSpecies = null;
  let pickSpeciesId = null;
  let pickArtStyle = 'neutral';
  let rewardPickId = null;
  let ultimateModalShownFor = null;
  let needsToastShown = false;
  let selectedFormTier = null;
  const CARE_TITLE_DEFAULT = '更多互动';
  const CARE_SUB_DEFAULT =
    '抚摸、散步、合影等免费互动，计入成长';

  function memoirHtml(s) {
    const accent = s.accent || '#ffd4a8';
    const artSrc = s.artUrl || '';
    const sheet = artSrc
      ? '<img class="care-past-sheet-img" src="' +
        String(artSrc).replace(/"/g, '') +
        '" alt="' +
        s.name +
        '">'
      : '';
    const figure = sheet
      ? sheet
      : '<span class="care-past-emoji">' + s.emoji + '</span>';
    const actions = (s.actions || [])
      .map(function (a) {
        return (
          '<li class="care-memoir-act"><span class="ico">' +
          a.icon +
          '</span><span class="lab">' +
          a.label +
          '</span><strong>' +
          a.count +
          ' 次</strong></li>'
        );
      })
      .join('');
    const stats = (s.stats || [])
      .map(function (row) {
        return (
          '<li><span>' + row.label + '</span><strong>' + row.value + '</strong></li>'
        );
      })
      .join('');
    return (
      '<div class="form-review-card' +
      (s.grown ? '' : ' is-locked-form') +
      '">' +
      '<section class="form-review-look">' +
      '<p class="form-review-sec">宠物形态</p>' +
      '<div class="care-past-hero" style="--past-accent:' +
      accent +
      '">' +
      '<div class="care-past-figure">' +
      figure +
      '</div>' +
      '<p class="care-past-kicker">' +
      s.kicker +
      '</p>' +
      '<h3>' +
      s.title +
      ' · ' +
      s.name +
      '</h3>' +
      '<p class="care-past-sp">' +
      (s.speciesLabel || '') +
      (s.desc ? ' · ' + s.desc : ' · 已养成形态') +
      '</p></div></section>' +
      '<section class="form-review-story">' +
      '<p class="form-review-sec">抚养经历</p>' +
      '<p class="form-nurture-lead">' +
      s.lead +
      '</p>' +
      (actions ? '<ul class="care-memoir-acts">' + actions + '</ul>' : '') +
      '<ul class="form-nurture-stats">' +
      stats +
      '</ul><p class="form-nurture-overall">' +
      s.overallLine +
      '</p><p class="form-nurture-note">' +
      s.note +
      '</p></section><button type="button" class="btn-ok" id="btnBackCurrentForm">' +
      (s.cta || '回到当前形态继续抚养') +
      '</button></div>'
    );
  }

  function renderCareMemoir(snap) {
    const memoir = $('#careMemoir');
    const current = (snap.forms || []).filter(function (f) {
      return f.current;
    })[0];
    const currentTier = current ? Number(current.vip) : 0;
    const viewingOther =
      selectedFormTier != null &&
      current &&
      Number(selectedFormTier) !== currentTier &&
      TTStore.getFormNurtureSummary;
    const s = viewingOther ? TTStore.getFormNurtureSummary(selectedFormTier) : null;
    const past = !!s;
    if (past) {
      if (memoir) {
        memoir.hidden = false;
        memoir.innerHTML = memoirHtml(s);
        const back = $('#btnBackCurrentForm');
        if (back) {
          back.addEventListener('click', function () {
            selectedFormTier = current.vip;
            switchTab('care');
            renderAll();
          });
        }
      }
      document.querySelectorAll('.pet-tab').forEach(function (btn) {
        const on = btn.dataset.tab === 'care';
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('.pet-tab-panel').forEach(function (panel) {
        panel.hidden = true;
        panel.classList.remove('is-active');
      });
      return true;
    }
    if (memoir) {
      memoir.hidden = true;
      memoir.innerHTML = '';
    }
    return false;
  }

  function renderCareProtect(protect, demoteToast) {
    const bar = $('#careProtectBar');
    const label = $('#careProtectLabel');
    if (!bar || !label) return;
    if (!protect) {
      bar.classList.remove('is-warn', 'is-expired');
      label.textContent = '亲密度保护结算中';
      return;
    }
    bar.classList.toggle('is-warn', !!protect.warn && !!protect.active);
    bar.classList.toggle('is-expired', !!protect.expired || !protect.active);
    if (protect.active) {
      label.textContent =
        '冻结保护中 · 亲密度 Lv.' + protect.careLevel + ' · 剩余 ' + protect.remainLabel;
    } else {
      label.textContent = protect.label || '保护已过期';
    }
    if (demoteToast) toast(demoteToast, 'success');
  }

  function renderNurtureCadence(cadence) {
    const card = $('#nurtureCadenceCard');
    if (!card || !cadence) return;
    const status = cadence.status || 'fresh';
    card.dataset.status = status;
    card.classList.toggle('is-warn', status === 'due_soon' || status === 'due');
    card.classList.toggle('is-overdue', status === 'overdue');
    const title = $('#nurtureCadenceTitle');
    const sub = $('#nurtureCadenceSub');
    const nextDue = $('#nurtureNextDue');
    const protectRemain = $('#nurtureProtectRemain');
    const deep = $('#nurtureDeepProgress');
    if (title) title.textContent = cadence.petBannerTitle || '24小时抚养节奏';
    if (sub) sub.textContent = cadence.petBannerSub || cadence.purpose || '';
    if (nextDue) {
      nextDue.textContent =
        status === 'due' || status === 'overdue'
          ? '现在'
          : cadence.remainLabel || '--:--:--';
    }
    if (protectRemain) {
      const p = cadence.protect || {};
      protectRemain.textContent = p.active
        ? p.remainLabel || cadence.remainLabel || '--:--:--'
        : p.floorLabel || '已到期 · 快来续护';
    }
    if (deep) {
      const dn = cadence.deepNurture || {};
      deep.textContent = dn.progressLabel || (dn.done ? '已完成' : '进行中');
    }
  }

  function setStat(id, valId, n) {
    const v = Math.max(0, Math.min(100, Math.round(n)));
    const bar = document.getElementById(id);
    const label = document.getElementById(valId);
    if (bar) {
      bar.style.width = v + '%';
      bar.classList.toggle('low', v < 35);
      bar.classList.toggle('mid', v >= 35 && v < 65);
    }
    if (label) label.textContent = String(v);
  }

  function moodHint(pet, look, needs, voice) {
    if (voice && voice.hint) return voice.hint;
    if (needs && needs.anyActive) {
      return (
        '管家宠在提醒你：' +
        needs.active
          .map(function (a) {
            return a.label;
          })
          .join('、') +
        '。满足后安静 24 小时，持续抚养可解锁下一形态～'
      );
    }
    const avg = (pet.hunger + pet.mood + pet.clean + pet.health) / 4;
    if (avg >= 80) return '状态绝佳！「' + look.petName + '」围着你转～下一形态就在旁边哦';
    if (avg >= 60) return '状态还不错，再照料一下会更开心，也更接近下一形态。';
    if (avg >= 40) return '有点想你了…喂一口、喝一口或梳洗一下，马上就会好。';
    return '状态偏低！快来喂食、玩耍、喝水吧。';
  }

  function renderNeeds(needs, voice) {
    const bar = $('#petNeedsBar');
    if (bar) {
      if (!needs || !needs.items) {
        bar.innerHTML = '';
      } else {
        bar.innerHTML = needs.items
          .map(function (it) {
            return (
              '<span class="pet-need-chip ' +
              (it.active ? 'is-active' : 'is-satisfied') +
              '" data-need="' +
              it.id +
              '">' +
              '<span>' +
              it.icon +
              '</span><span>' +
              (it.active ? it.label : it.satisfiedLabel) +
              '</span>' +
              (it.satisfied
                ? '<span class="cd" data-need-cd="' + it.id + '">' + it.remainLabel + '</span>'
                : '') +
              '</span>'
            );
          })
          .join('');
      }
    }

    document.querySelectorAll('.pet-act[data-need], .pet-nurture-btn[data-need]').forEach(function (btn) {
      const key = btn.dataset.need;
      const item =
        needs && needs.items
          ? needs.items.find(function (it) {
              return it.id === key;
            })
          : null;
      btn.classList.toggle('has-need', !!(item && item.active));
    });

    const bubble = $('#petSpeechBubble');
    if (bubble) {
      if (bubbleTimer) {
        clearInterval(bubbleTimer);
        bubbleTimer = null;
      }
      const lines =
        voice && voice.bubbles && voice.bubbles.length
          ? voice.bubbles
          : needs && needs.anyActive
            ? needs.bubbles || []
            : [];
      bubble.dataset.mode = (voice && voice.mode) || '';
      if (lines.length) {
        bubble.hidden = false;
        bubbleIndex = 0;
        bubble.textContent = lines[0];
        if (lines.length > 1) {
          bubbleTimer = setInterval(function () {
            bubbleIndex = (bubbleIndex + 1) % lines.length;
            bubble.textContent = lines[bubbleIndex];
          }, 3200);
        }
      } else {
        bubble.hidden = true;
        bubble.textContent = '';
      }
    }

    const enterLine = (voice && voice.enterToast) || (needs && needs.enterToast);
    if (!needsToastShown && enterLine) {
      needsToastShown = true;
      toast(enterLine, 'success');
      if (TTStore.markVoiceToastShown) TTStore.markVoiceToastShown();
    }
  }

  function refreshNeedCountdowns() {
    if (!TTStore.getPetNeedsInfo) return;
    const needs = TTStore.getPetNeedsInfo({ skipToast: true });
    (needs.items || []).forEach(function (it) {
      if (!it.satisfied) return;
      const el = document.querySelector('[data-need-cd="' + it.id + '"]');
      if (el) el.textContent = it.remainLabel;
    });
  }

  function applyArtBox(el, url) {
    if (!el) return false;
    if (!url) {
      el.hidden = true;
      el.innerHTML = '';
      return false;
    }
    el.hidden = false;
    el.removeAttribute('hidden');
    el.innerHTML =
      '<img alt="" src="' + String(url).replace(/"/g, '') + '">';
    return true;
  }

  function paintPetArt(url, tier, emoji) {
    const art = $('#petArt');
    const fallback = $('#petEmojiFallback');
    const figure = $('#petFigure');
    const src =
      url ||
      (TTStore.formArtUrl && TTStore.formArtUrl(null, null, tier));
    const ok = applyArtBox(art, src);
    if (fallback) {
      fallback.textContent = emoji || '✨';
      fallback.hidden = !!ok;
    }
    if (figure) figure.classList.toggle('has-art', !!ok);
  }

  function renderNextForm(teaser) {
    const card = $('#petNextForm');
    const emoji = $('#petNextEmoji');
    const name = $('#petNextName');
    const hint = $('#petNextHint');
    const label = $('#petNextLabel');
    const lock = $('#petNextLock');
    const evolveHint = $('#evolveProgressHint');
    if (!card) return;
    if (!teaser || teaser.bound === false) {
      card.hidden = true;
      if (evolveHint) evolveHint.textContent = '持续照料可进化下一形态';
      return;
    }
    card.hidden = false;
    card.classList.toggle('is-ultimate', !!teaser.isUltimate);
    if (teaser.isUltimate) {
      if (emoji) emoji.textContent = (teaser.currentForm && teaser.currentForm.emoji) || '👑';
      if (name) name.textContent = (teaser.currentForm && teaser.currentForm.name) || '冠宠';
      if (label) label.textContent = '终极形态';
      if (hint) hint.textContent = '已达终极形态 ✓';
      if (lock) lock.textContent = '✓';
    } else if (teaser.nextForm) {
      if (emoji) emoji.textContent = teaser.nextForm.emoji || '❓';
      if (name) name.textContent = teaser.nextForm.name || '下一形态';
      if (label) label.textContent = '下一形态';
      if (hint) hint.textContent = teaser.progressHint || '持续抚养可进化';
      if (lock) lock.textContent = teaser.evolveReady ? '✨' : '🔒';
    }
    const nextArt = $('#petNextArt');
    const nextUrl = teaser.isUltimate ? teaser.artUrl : teaser.nextArtUrl;
    const artOk = applyArtBox(nextArt, nextUrl);
    if (emoji) emoji.hidden = !!artOk;
    if (evolveHint) {
      evolveHint.textContent = teaser.progressHint || '';
      evolveHint.classList.toggle('is-ultimate', !!teaser.isUltimate);
    }
  }

  function renderStageGrowth(growth) {
    const meter = $('#stageGrowthMeter');
    if (!meter) return;
    if (!growth || growth.chosen === false) {
      meter.hidden = true;
      return;
    }
    meter.hidden = false;
    meter.classList.toggle('is-ready', !!growth.canEvolve);
    meter.classList.toggle('is-ultimate', !!growth.isUltimate);
    const label = $('#stageGrowthLabel');
    const days = $('#stageGrowthDays');
    const acts = $('#stageGrowthActs');
    const daysFill = $('#stageGrowthDaysFill');
    const actsFill = $('#stageGrowthActsFill');
    const hint = $('#stageGrowthHint');
    if (label) {
      label.textContent = growth.isUltimate
        ? '已达终极 · 冠宠'
        : (growth.fromTitle || '幼宠') + ' → ' + (growth.toTitle || '下一形态');
    }
    if (days) {
      days.textContent = growth.isUltimate ? '—' : growth.haveDays + '/' + growth.needDays;
    }
    if (acts) {
      acts.textContent = growth.isUltimate ? '—' : growth.haveActs + '/' + growth.needActs;
    }
    if (daysFill) daysFill.style.width = (growth.daysPct || 0) + '%';
    if (actsFill) actsFill.style.width = (growth.actsPct || 0) + '%';
    if (hint) hint.textContent = growth.progressHint || growth.tableHint || '';
  }

  function playReact(kind) {
    const figure = $('#petFigure');
    const react = $('#petReact');
    if (figure) {
      figure.classList.remove('bounce', 'wiggle', 'sparkle');
      void figure.offsetWidth;
      const cls =
        kind === 'feed' || kind === 'snack' || kind === 'drink'
          ? 'bounce'
          : kind === 'play' || kind === 'pat'
            ? 'wiggle'
            : 'sparkle';
      figure.classList.add(cls);
    }
    if (react) {
      const pool = REACT[kind] || ['✨'];
      react.textContent = pool[Math.floor(Math.random() * pool.length)];
      react.classList.remove('show');
      void react.offsetWidth;
      react.classList.add('show');
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.pet-guide-hl').forEach((el) => {
      el.classList.remove('pet-guide-hl');
    });
  }

  function applyHighlight(key) {
    clearHighlights();
    if (!key) return;
    if (key === 'stats') {
      const stats = $('#petStats');
      if (stats) stats.classList.add('pet-guide-hl');
    } else if (key === 'feed') {
      const nurture = document.querySelector('.pet-nurture-btn[data-care="feed"]');
      if (nurture) nurture.classList.add('pet-guide-hl');
      const btn = $('#btnFeed');
      if (btn) btn.classList.add('pet-guide-hl');
    } else if (key === 'playclean') {
      document.querySelectorAll('.pet-nurture-btn[data-care="drink"], .pet-nurture-btn[data-care="clean"]').forEach(function (el) {
        el.classList.add('pet-guide-hl');
      });
    } else if (key === 'petfloat') {
      if (window.TTPetFloat && TTPetFloat.parkForGuide) TTPetFloat.parkForGuide();
      const fab = $('#petFloatFab');
      if (fab) fab.classList.add('pet-guide-hl');
    }
  }

  function switchTab(tab) {
    if (tab === 'friends') tab = 'care';
    activeTab = tab;
    document.querySelectorAll('.pet-tab').forEach((btn) => {
      const on = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.pet-tab-panel').forEach((panel) => {
      const on = panel.dataset.panel === tab;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    });
  }

  function renderForms(forms) {
    const gal = $('#formsGallery');
    if (!gal || !forms) return;
    if (!forms.length) {
      gal.innerHTML = '';
      selectedFormTier = null;
      return;
    }
    const current = forms.filter(function (f) {
      return f.current;
    })[0];
    if (selectedFormTier == null && current) selectedFormTier = current.vip;
    const viewTier = selectedFormTier;
    gal.innerHTML = forms
      .map(function (f) {
        const grown = f.grown != null ? f.grown : f.unlocked && f.current;
        const sel = f.vip === viewTier ? ' is-selected' : '';
        const lockCls = f.current ? '' : ' is-locked';
        const tag = f.current ? ' · 当前' : ' · 待升';
        return (
          '<button type="button" class="pet-form-chip' +
          (f.current ? ' is-current' : '') +
          lockCls +
          sel +
          '" data-form-tier="' +
          f.vip +
          '" data-grown="' +
          (grown ? '1' : '0') +
          '"><span class="emoji">' +
          f.form.emoji +
          '</span><span class="name">' +
          f.form.name +
          '</span><span class="vip">' +
          (f.form.formTitle || '') +
          tag +
          '</span></button>'
        );
      })
      .join('');
    const hint = $('#formSwitcherHint');
    if (hint) {
        hint.textContent = '点已养成的档，下面显示该档形态和抚养经历';
    }
  }

  function renderIntimacy(intimacy, evolve) {
    const fill = $('#intimacyFill');
    const label = $('#intimacyLabel');
    const meta = $('#intimacyMeta');
    if (fill && intimacy) fill.style.width = (intimacy.pct || 0) + '%';
    if (label && intimacy) label.textContent = intimacy.label || '';
    if (meta && intimacy) {
      meta.textContent = intimacy.maxed
        ? '已满级'
        : '距下级 ' + intimacy.intoLevel + '/' + intimacy.needPerLevel;
    }
    const btn = $('#btnEvolve');
    if (btn) {
      const needSp = evolve && evolve.reason === 'need_species';
      const ready = !needSp && (!!(evolve && evolve.canEvolve) || !!(intimacy && intimacy.evolveReady));
      btn.disabled = !ready;
      btn.classList.toggle('is-ready', ready);
      btn.textContent = needSp ? '请先选种' : ready ? '✨ 进化' : '进化';
    }
  }

  function renderQuests(quests) {
    const box = $('#intimacyQuests');
    if (!box || !quests) return;
    const list = quests.list || [];
    box.innerHTML =
      '<div class="pet-quest-head">今日深度抚养</div>' +
      list
        .map(function (q) {
          return (
            '<div class="pet-quest-row' +
            (q.complete ? ' is-done' : '') +
            '"><span>' +
            q.label +
            '</span><strong>' +
            q.done +
            '/' +
            q.need +
            '</strong></div>'
          );
        })
        .join('') +
      (quests.canClaim
        ? '<button type="button" class="btn-ok" id="btnClaimQuest">领取任务奖励</button>'
        : quests.claimed
          ? '<p class="pet-quest-done">今日任务奖励已领</p>'
          : '<p class="pet-quest-hint">完成全部任务可领亲密度礼包</p>');
    const claim = $('#btnClaimQuest');
    if (claim) {
      claim.addEventListener('click', function () {
        const res = TTStore.claimDailyIntimacyQuest();
        if (!res.ok) {
          toast(res.reason === 'claimed' ? '已领取过了' : '先完成全部任务');
          return;
        }
        toast(res.feedback, 'success');
        if (res.leveled) handleLeveled(res.leveled);
        if (res.evolveReady) openEvolveModal();
        renderAll();
      });
    }
  }

  function renderUltimateBanner(info) {
    const el = $('#ultimateRewardBanner');
    if (!el || !info) return;
    if (info.canClaim) {
      el.hidden = false;
      el.innerHTML =
        '<div class="ult-banner-body"><strong>终极形态达成</strong><span>「' +
        (info.form && info.form.name) +
        '」可自选养成奖励（非充值）</span></div>' +
        '<button type="button" class="btn-ok" id="btnOpenUltimatePick">自选奖励</button>';
      const btn = $('#btnOpenUltimatePick');
      if (btn) btn.addEventListener('click', function () {
        openUltimatePickModal(info);
      });
    } else if (info.atUltimate && info.claimed) {
      el.hidden = false;
      el.innerHTML =
        '<div class="ult-banner-body"><strong>终极形态</strong><span>本品种奖励已领 · 换种达成可再选</span></div>';
    } else {
      el.hidden = true;
      el.innerHTML = '';
    }
  }

  function renderFriends(friends, daily) {
    const list = $('#friendsList');
    const quota = $('#helpQuotaLabel');
    if (quota && daily) quota.textContent = (daily.helpUsed || 0) + '/' + (daily.helpMax || 3);
    if (!list) return;
    list.innerHTML = (friends || [])
      .map(function (f) {
        return (
          '<div class="pet-friend-card" data-id="' +
          f.id +
          '"><div class="pet-friend-top"><span class="av">' +
          f.avatar +
          '</span><div><strong>' +
          f.name +
          '</strong><div class="sub">VIP' +
          f.vip +
          ' · ' +
          (f.speciesLabel || '') +
          ' · ' +
          f.petEmoji +
          ' ' +
          f.petName +
          '</div><div class="need">' +
          f.needHint +
          '</div></div></div><div class="pet-friend-acts">' +
          '<button type="button" class="btn-help" data-help="feed"' +
          (daily && daily.helpUsed >= daily.helpMax ? ' disabled' : '') +
          '>帮喂</button>' +
          '<button type="button" class="btn-help" data-help="play"' +
          (daily && daily.helpUsed >= daily.helpMax ? ' disabled' : '') +
          '>帮玩</button>' +
          '<button type="button" class="btn-help" data-help="clean"' +
          (daily && daily.helpUsed >= daily.helpMax ? ' disabled' : '') +
          '>帮洁</button></div></div>'
        );
      })
      .join('');
    list.querySelectorAll('.pet-friend-card').forEach(function (card) {
      card.querySelectorAll('.btn-help').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const res = TTStore.helpFriendCare(card.dataset.id, btn.dataset.help);
          if (!res.ok) {
            toast(res.reason === 'quota' ? '今日帮养次数已用完' : '帮养失败');
            return;
          }
          toast(res.feedback + ' · +' + res.pointsGain + ' 今日积分 · ' + res.friendship, 'success');
          renderAll();
        });
      });
    });
  }

  function renderRank(rank) {
    const list = $('#rankList');
    const pos = $('#rankMePos');
    const pts = $('#rankMePts');
    const all = $('#rankAllPts');
    if (pos) pos.textContent = rank ? '#' + rank.myRank : '—';
    if (pts) pts.textContent = rank ? String(rank.myPoints) : '0';
    if (all) all.textContent = rank ? String(rank.allTimePoints) : '0';
    if (!list || !rank) return;
    list.innerHTML = (rank.list || [])
      .map(function (r, i) {
        return (
          '<tr class="' +
          (r.isMe ? 'is-me' : '') +
          '"><td class="col-rank">' +
          (i + 1) +
          '</td><td class="col-user"><span class="nm">' +
          r.name +
          '</span><small>VIP' +
          r.vip +
          '</small></td><td class="col-pet">' +
          r.emoji +
          ' ' +
          r.petName +
          '</td></tr>'
        );
      })
      .join('');
  }

  function renderChat(chat) {
    const log = $('#chatLog');
    const chips = $('#chatChips');
    if (log) {
      const msgs = (chat && chat.messages) || [];
      log.innerHTML = msgs
        .map(function (m) {
          return (
            '<div class="pet-chat-bubble ' +
            (m.role === 'user' ? 'user' : 'pet') +
            '">' +
            m.text +
            '</div>'
          );
        })
        .join('');
      log.scrollTop = log.scrollHeight;
    }
    if (chips && chat && chat.chips) {
      chips.innerHTML = chat.chips
        .map(function (c) {
          return '<button type="button" class="pet-chip" data-chip="' + c + '">' + c + '</button>';
        })
        .join('');
      chips.querySelectorAll('.pet-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          sendChat(btn.dataset.chip);
        });
      });
    }
  }

  function sendChat(text) {
    const res = TTStore.petChatSend(text);
    if (!res.ok) {
      if (res.reason === 'need_species') toast('请先选择你的 VIP管家神兽');
      else if (res.reason === 'empty') toast('说点什么吧');
      else if (res.reason === 'too_long') toast('太长啦，精简一点～');
      else toast('发送失败');
      return;
    }
    const input = $('#chatInput');
    if (input) input.value = '';
    if (res.intimacyGain) toast('对话亲密 +' + res.intimacyGain, 'success');
    if (res.evolveReady) openEvolveModal();
    renderAll();
  }

  function speciesCardHtml(s, opts) {
    opts = opts || {};
    const keep = opts.keep;
    const ult = s.ultimate || {};
    const preview = s.evolvePreview || s.preview || {};
    return (
      '<button type="button" class="pet-species-pick' +
      (keep ? ' is-keep' : '') +
      (opts.selected ? ' is-selected' : '') +
      '" data-species="' +
      s.id +
      '">' +
      '<span class="big">' +
      (preview.emoji || s.starter && s.starter.emoji || '') +
      '</span>' +
      '<strong>' +
      s.label +
      (keep ? ' · 保留' : '') +
      '</strong>' +
      '<small>' +
      (s.loreZh || '') +
      '</small>' +
      '<small>' +
      (opts.inheritNote || ('当前预览 · ' + (preview.name || ''))) +
      '</small>' +
      '<div class="pet-ultimate-preview">' +
      '<div class="ult-label">养成后 · 冠宠终极形态</div>' +
      '<div class="ult-art">' +
      (s.ultimateArtUrl
        ? '<img class="spc-ult-img" src="' + String(s.ultimateArtUrl).replace(/"/g, '') + '" alt="">'
        : '') +
      '<span class="ult-emoji">' +
      (ult.emoji || '') +
      '</span>' +
      '</div>' +
      '<div class="ult-name">' +
      (ult.name || '') +
      '</div>' +
      '<div class="ult-blurb">' +
      (ult.blurb || '') +
      '</div>' +
      (ult.rewardHint ? '<div class="ult-reward">' + ult.rewardHint + '</div>' : '') +
      '</div>' +
      '</button>'
    );
  }

  function starterPickCardHtml(s, selected) {
    const ult = s.ultimate || {};
    const starter = s.starter || {};
    const ultArt = String(s.ultimateArtUrl || '').replace(/"/g, '');
    const startArt = String(s.starterArtUrl || '').replace(/"/g, '');
    const ultFace = ult.emoji || '';
    const startFace = starter.emoji || '';
    return (
      '<button type="button" class="species-pick-card' +
      (selected ? ' is-selected' : '') +
      '" data-species="' +
      s.id +
      '" aria-pressed="' +
      (selected ? 'true' : 'false') +
      '">' +
      '<div class="spc-ult-hero">' +
      '<span class="spc-ult-kicker">养成后 · 冠宠</span>' +
      '<div class="spc-ult-art">' +
      (ultArt ? '<img class="spc-ult-img" src="' + ultArt + '" alt="">' : '') +
      '<span class="spc-ult-face">' +
      ultFace +
      '</span>' +
      '</div>' +
      '<strong class="spc-ult-name">' +
      (ult.name || '') +
      '</strong>' +
      '</div>' +
      '<div class="spc-name">' +
      s.label +
      '</div>' +
      '<div class="spc-en">' +
      (s.loreZh || '') +
      '</div>' +
      '<div class="spc-start">' +
      '<span class="spc-start-label">幼宠</span>' +
      '<span class="spc-start-art">' +
      (startArt ? '<img class="spc-start-img" src="' + startArt + '" alt="">' : '') +
      '<span class="spc-start-face">' +
      startFace +
      '</span>' +
      '</span>' +
      '<span class="spc-start-name">' +
      (starter.name || '') +
      '</span>' +
      '</div>' +
      (selected
        ? '<span class="spc-picked">已选中</span>'
        : '<span class="spc-pick-cta">点此选中</span>') +
      '</button>'
    );
  }

  function bindSpeciesPickArt(root) {
    if (!root) return;
    root.querySelectorAll('.spc-ult-img, .spc-start-img, .spc-roster-img').forEach(function (img) {
      img.addEventListener('error', function () {
        img.hidden = true;
      });
      img.addEventListener('load', function () {
        const face = img.parentElement && img.parentElement.querySelector('.spc-ult-face, .spc-start-face');
        if (face) face.hidden = true;
      });
    });
  }

  function speciesPickNeeded(snap) {
    if (snap && typeof snap.needsSpeciesPick === 'boolean') return snap.needsSpeciesPick;
    const pet = (snap && snap.pet) || (TTStore.get() && TTStore.get().pet);
    if (TTStore.hasChosenSpecies) return !TTStore.hasChosenSpecies(pet);
    return true;
  }

  function pickCatalog() {
    return (TTStore.getSpeciesCatalog && TTStore.getSpeciesCatalog(pickArtStyle)) || [];
  }

  function pickedSpeciesMeta() {
    let found = null;
    pickCatalog().forEach(function (s) {
      if (s.id === pickSpeciesId) found = s;
    });
    return found;
  }

  function syncSpeciesPickConfirm() {
    const picked = pickedSpeciesMeta();
    const confirm = $('#speciesPickConfirm');
    const hint = $('#speciesPickHint');
    if (confirm) {
      confirm.disabled = !picked;
      confirm.textContent = picked
        ? '进入「' + (picked.label || '') + '」抚养'
        : '进入抚养';
    }
    if (hint) {
      hint.textContent = picked
        ? '已选中「' + picked.label + '」'
        : '点一张卡片选中神兽，再点进入抚养';
    }
  }

  function selectPickSpecies(id) {
    if (!id) return;
    pickSpeciesId = id;
    document.querySelectorAll('.species-pick-card').forEach(function (b) {
      const on = b.dataset.species === pickSpeciesId;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      const mark = b.querySelector('.spc-picked, .spc-pick-cta');
      if (mark) {
        mark.className = on ? 'spc-picked' : 'spc-pick-cta';
        mark.textContent = on ? '已选中' : '点此选中';
      }
    });
    document.querySelectorAll('.spc-roster-item').forEach(function (b) {
      b.classList.toggle('is-selected', b.dataset.species === pickSpeciesId);
    });
    syncSpeciesPickConfirm();
  }

  function paintSpeciesPickGallery() {
    const catalog = pickCatalog();
    const roster = $('#speciesPickRoster');
    if (roster) {
      roster.innerHTML = catalog
        .map(function (s) {
          const art = String(s.ultimateArtUrl || '').replace(/"/g, '');
          const on = s.id === pickSpeciesId;
          return (
            '<button type="button" class="spc-roster-item' +
            (on ? ' is-selected' : '') +
            '" data-species="' +
            s.id +
            '">' +
            (art ? '<img class="spc-roster-img" src="' + art + '" alt="">' : '') +
            '<span>' +
            (s.label || '') +
            '</span></button>'
          );
        })
        .join('');
      roster.querySelectorAll('.spc-roster-item').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          selectPickSpecies(btn.dataset.species);
        });
      });
      bindSpeciesPickArt(roster);
    }
    const grid = $('#speciesPickGrid');
    if (grid) {
      grid.innerHTML = catalog
        .map(function (s) {
          return starterPickCardHtml(s, pickSpeciesId === s.id);
        })
        .join('');
      grid.querySelectorAll('.species-pick-card').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          selectPickSpecies(btn.dataset.species);
        });
      });
      bindSpeciesPickArt(grid);
    }
    syncSpeciesPickConfirm();
  }

  function renderSpeciesPickStyles() {
    const box = $('#speciesPickStyles');
    if (!box) return;
    const styles = TTStore.ART_STYLES || [];
    box.innerHTML = styles
      .map(function (s) {
        const on = s.id === pickArtStyle;
        return (
          '<button type="button" class="species-pick-style' +
          (on ? ' is-on' : '') +
          '" data-art-style="' +
          s.id +
          '" role="tab" aria-selected="' +
          (on ? 'true' : 'false') +
          '">' +
          s.label +
          '<small>' +
          (s.hint || '') +
          '</small></button>'
        );
      })
      .join('');
    box.querySelectorAll('.species-pick-style').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const next = btn.dataset.artStyle;
        if (!next || next === pickArtStyle) return;
        pickArtStyle = next;
        renderSpeciesPickStyles();
        paintSpeciesPickGallery();
      });
    });
  }

  function renderSpeciesPickOverlay(snap) {
    const overlay = $('#speciesPickOverlay');
    if (!overlay) return;
    const need = speciesPickNeeded(snap);
    if (!need) {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      return;
    }
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    if (TTStore.normalizeArtStyle) {
      pickArtStyle = TTStore.normalizeArtStyle(pickArtStyle || (snap && snap.pet && snap.pet.artStyle));
    }
    renderSpeciesPickStyles();
    paintSpeciesPickGallery();
  }

  function confirmStarterSpecies() {
    if (!pickSpeciesId) {
      toast('请先选择一种神兽');
      return;
    }
    if (TTStore.setArtStyle) TTStore.setArtStyle(pickArtStyle);
    const res = TTStore.chooseStarterSpecies(pickSpeciesId);
    if (!res.ok && res.reason !== 'already_chosen') {
      toast('选种失败');
      return;
    }
    toast(res.feedback || '选种成功', 'success');
    pickSpeciesId = null;
    const overlay = $('#speciesPickOverlay');
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (typeof selectedFormTier !== 'undefined') selectedFormTier = null;
    if (typeof switchTab === 'function') switchTab('care');
    TTStore.petChatGreeting(true);
    renderAll();
  }

  function openEvolveModal() {
    const info = TTStore.getEvolveInfo ? TTStore.getEvolveInfo() : null;
    const modal = $('#evolveModal');
    if (!modal || !info) return;
    if (!info.canEvolve) {
      if (info.reason === 'need_species') toast('请先选择你的 VIP管家神兽');
      else if (info.reason === 'need_vip') {
        toast((info.growth && info.growth.progressHint) || '升 VIP 后才能进入下一形态');
      } else {
        toast((info.growth && info.growth.progressHint) || '继续抚养与互动后可进化');
      }
      return;
    }
    evolvePickSpecies = info.currentSpecies;
    const cur = $('#evolveCurrent');
    if (cur && info.currentForm) {
      const next = info.nextFormPreview;
      cur.innerHTML =
        '<div class="evolve-cur-emoji">' +
        info.currentForm.emoji +
        '</div><div><strong>' +
        info.currentForm.name +
        '</strong><div>亲密度 Lv.' +
        info.careLevel +
        ' · ' +
        info.tier +
        ' · ' +
        (info.currentSpeciesLabel || '') +
        (next
          ? ' → 下一形态 ' + next.emoji + ' ' + next.name
          : '') +
        '</div></div>';
    }
    const rules = $('#evolveRules');
    if (rules) {
      rules.innerHTML = (info.rules || [])
        .map(function (r) {
          return '<li>' + r + '</li>';
        })
        .join('');
    }
    const picks = $('#evolveSpeciesPicks');
    if (picks) {
      picks.innerHTML = (info.options || [])
        .map(function (s) {
          return speciesCardHtml(s, {
            keep: s.keep,
            selected: s.id === evolvePickSpecies,
          });
        })
        .join('');
      picks.querySelectorAll('.pet-species-pick').forEach(function (btn) {
        btn.addEventListener('click', function () {
          evolvePickSpecies = btn.dataset.species;
          picks.querySelectorAll('.pet-species-pick').forEach(function (b) {
            b.classList.toggle('is-selected', b.dataset.species === evolvePickSpecies);
          });
        });
      });
    }
    modal.classList.add('open');
  }

  function confirmEvolve() {
    const res = TTStore.evolvePet({ species: evolvePickSpecies });
    const modal = $('#evolveModal');
    if (modal) modal.classList.remove('open');
    if (!res.ok) {
      if (res.reason === 'need_species') toast('请先选择你的 VIP管家神兽');
      else toast(res.reason === 'need_care_level' ? '亲密度未达标' : '暂不可进化');
      return;
    }
    toast(res.feedback, 'success');
    if (res.ultimatePick) openUltimatePickModal(res.ultimatePick);
    renderAll();
  }

  function openSwitchSpeciesModal() {
    const modal = $('#switchSpeciesModal');
    if (!modal || !TTStore.getSpeciesSwitchInfo) return;
    const info = TTStore.getSpeciesSwitchInfo();
    if (!info.chosen) {
      toast('请先选择你的 VIP管家神兽');
      return;
    }
    switchPickSpecies = info.currentSpecies;
    const cur = $('#switchSpeciesCurrent');
    if (cur && info.currentForm) {
      cur.innerHTML =
        '<div class="evolve-cur-emoji">' +
        info.currentForm.emoji +
        '</div><div><strong>' +
        info.currentForm.name +
        '</strong><div>当前「' +
        (info.currentSpeciesLabel || '') +
        '」· ' +
        info.formTitle +
        ' · 换种后新神兽同步到此档</div></div>';
    }
    const hint = $('#switchSpeciesHint');
    if (hint) hint.textContent = info.hint || '';
    const picks = $('#switchSpeciesPicks');
    if (picks) {
      picks.innerHTML = (info.options || [])
        .map(function (s) {
          const form = s.inheritForm || s.evolvePreview || {};
          return speciesCardHtml(s, {
            keep: s.keep,
            selected: s.id === switchPickSpecies,
            inheritNote: '将升至「' + info.formTitle + '」· ' + (form.name || ''),
          });
        })
        .join('');
      picks.querySelectorAll('.pet-species-pick').forEach(function (btn) {
        btn.addEventListener('click', function () {
          switchPickSpecies = btn.dataset.species;
          picks.querySelectorAll('.pet-species-pick').forEach(function (b) {
            b.classList.toggle('is-selected', b.dataset.species === switchPickSpecies);
          });
        });
      });
      picks.querySelectorAll('.spc-ult-img').forEach(function (img) {
        img.addEventListener('error', function () {
          img.hidden = true;
        });
        img.addEventListener('load', function () {
          const face = img.parentElement && img.parentElement.querySelector('.ult-emoji');
          if (face) face.hidden = true;
        });
      });
    }
    modal.classList.add('open');
  }

  function confirmSwitchSpecies() {
    if (!TTStore.switchPetSpecies) return;
    const res = TTStore.switchPetSpecies(switchPickSpecies);
    const modal = $('#switchSpeciesModal');
    if (modal) modal.classList.remove('open');
    if (!res || !res.ok) {
      toast(res && res.reason === 'need_species' ? '请先选择神兽' : '更换失败');
      return;
    }
    if (res.unchanged) {
      toast('已经是这只神兽');
      return;
    }
    toast(res.feedback, 'success');
    if (res.ultimatePick) openUltimatePickModal(res.ultimatePick);
    renderAll();
  }

  function openUltimatePickModal(pick) {
    const modal = $('#ultimateRewardModal');
    const picks = $('#ultimateRewardPicks');
    const head = $('#ultimateRewardHead');
    if (!modal || !picks) return;
    const info = pick || (TTStore.getUltimateRewardInfo && TTStore.getUltimateRewardInfo());
    if (!info || !info.options) return;
    if (info.canClaim === false && !pick) {
      toast(info.claimed ? '本品种奖励已领取' : '尚未达成终极形态');
      return;
    }
    rewardPickId = null;
    if (head) {
      head.innerHTML =
        '<div class="ult-head-emoji">' +
        (info.form && info.form.emoji ? info.form.emoji : '👑') +
        '</div><div><strong>终极形态达成 · 奖励自选</strong><p>「' +
        (info.form && info.form.name ? info.form.name : '') +
        '」· ' +
        (info.speciesLabel || '') +
        ' · 五选一 · 养成达成非充值</p></div>';
    }
    picks.innerHTML = (info.options || [])
      .map(function (o) {
        return (
          '<button type="button" class="ult-reward-pick' +
          (o.rare ? ' is-rare' : '') +
          '" data-reward="' +
          o.id +
          '"><span class="ico">' +
          o.icon +
          '</span><strong>' +
          o.name +
          '</strong><small>' +
          o.desc +
          '</small></button>'
        );
      })
      .join('');
    picks.querySelectorAll('.ult-reward-pick').forEach(function (btn) {
      btn.addEventListener('click', function () {
        rewardPickId = btn.dataset.reward;
        picks.querySelectorAll('.ult-reward-pick').forEach(function (b) {
          b.classList.toggle('is-selected', b.dataset.reward === rewardPickId);
        });
      });
    });
    const note = $('#ultimateRewardNote');
    if (note) note.textContent = info.note || '养成达成奖励，非充值。';
    modal.classList.add('open');
    ultimateModalShownFor = info.species;
  }

  function confirmUltimateReward() {
    if (!rewardPickId) {
      toast('请先选择一项奖励');
      return;
    }
    const res = TTStore.claimUltimateReward({ rewardId: rewardPickId });
    const modal = $('#ultimateRewardModal');
    if (!res.ok) {
      if (res.reason === 'need_choice') toast('请选择一项奖励');
      else if (res.reason === 'claimed') toast('本品种已领取过');
      else toast('领取失败');
      return;
    }
    if (modal) modal.classList.remove('open');
    showUltimateCelebrate(res);
    toast(res.feedback, 'success');
    renderAll();
  }

  function showUltimateCelebrate(res) {
    const modal = $('#ultimateCelebrateModal');
    if (!modal || !res) return;
    const title = $('#ultimateCelebrateTitle');
    const desc = $('#ultimateCelebrateDesc');
    if (title) title.textContent = '终极形态奖励已发放！';
    if (desc) {
      desc.textContent =
        (res.form ? res.form.emoji + ' ' + res.form.name + ' · ' : '') +
        (res.reward ? res.reward.name : '') +
        ' · 养成达成，非充值';
    }
    modal.classList.add('open');
  }

  function maybeOpenUltimateFromSnap(snap) {
    if (!snap || !snap.ultimatePick) return;
    const sp = snap.ultimatePick.species;
    if (ultimateModalShownFor === sp) return;
    const modal = $('#ultimateRewardModal');
    if (modal && modal.classList.contains('open')) return;
    openUltimatePickModal(snap.ultimatePick);
  }

  function renderAll() {
    const snap = TTStore.getPetSnapshot();
    const state = TTStore.get();
    const pet = snap.pet;
    const look = snap.look;

    renderHeader(state);

    setStat('statHunger', 'statHungerVal', pet.hunger);
    setStat('statMood', 'statMoodVal', pet.mood);
    setStat('statClean', 'statCleanVal', pet.clean);
    setStat('statHealth', 'statHealthVal', pet.health);
    const cleanNurture = document.querySelector('.pet-nurture-btn[data-care="clean"]');
    if (cleanNurture) cleanNurture.classList.toggle('has-need', pet.clean < 50);

    const title = $('#petTitle');
    const meta = $('#petMeta');
    const hint = $('#petHint');
    const stage = $('#petStage');
    const bind = $('#petBindBadge');

    const viewTier =
      selectedFormTier != null ? Number(selectedFormTier) : look.displayTier;
    const viewingOther =
      selectedFormTier != null && Number(selectedFormTier) !== Number(look.displayTier);
    const viewForm =
      look.species && TTStore.petFormForVip
        ? TTStore.petFormForVip(viewTier, look.species)
        : look.form;

    if (title) {
      if (snap.needsSpeciesPick) {
        title.textContent = '待选神兽';
      } else if (viewingOther && viewForm) {
        title.textContent = viewForm.name;
      } else {
        title.textContent = look.petName || look.formName || 'VIP管家宠';
      }
    }
    if (meta) {
      if (snap.needsSpeciesPick) {
        meta.textContent = '请先选择本命神兽';
      } else {
        const formTitle =
          (viewingOther && viewForm && viewForm.formTitle) ||
          (look.form && look.form.formTitle) ||
          '';
        const bits = [];
        if (formTitle) bits.push(formTitle);
        if (viewingOther) bits.push('回顾');
        bits.push('亲密度 Lv.' + look.careLevel);
        bits.push('照料 ' + pet.careCount + ' 次');
        meta.textContent = bits.join(' · ');
      }
    }
    if (bind) {
      bind.textContent = look.bound === false ? '未绑定' : '已绑定';
      bind.classList.toggle('unbound', look.bound === false);
    }
    const speciesHint = $('#petSpeciesHint');
    if (speciesHint) {
      if (snap.needsSpeciesPick) {
        speciesHint.textContent = '本命神兽：待选神兽（首次必选）';
      } else {
        speciesHint.textContent =
          '本命神兽：' +
          (look.speciesLabel || '');
      }
    }
    const btnSwitch = $('#btnSwitchSpecies');
    const switchWrap = $('#petSwitchWrap');
    if (switchWrap) switchWrap.hidden = !!snap.needsSpeciesPick;
    else if (btnSwitch) btnSwitch.hidden = !!snap.needsSpeciesPick;
    renderNeeds(snap.needs, snap.voice);
    renderNextForm(snap.nextForm);
    if (hint) {
      hint.textContent = snap.needsSpeciesPick
        ? '请先选择你的 VIP管家神兽，再开始照料～'
        : moodHint(pet, look, snap.needs, snap.voice);
    }
    if (stage) stage.dataset.stage = (viewForm && viewForm.stage) || look.stage || 'empty';
    const artUrl =
      look.species && TTStore.formArtUrl
        ? TTStore.formArtUrl(look.species, look.artStyle, viewTier)
        : look.artUrl;
    paintPetArt(artUrl, viewTier, (viewForm && viewForm.emoji) || look.emoji || '✨');
    const nextCard = $('#petNextForm');
    if (nextCard) nextCard.classList.toggle('is-dim', !!viewingOther);

    document.querySelectorAll('.pet-act[data-care], .pet-nurture-btn[data-care], .btn-pet-use').forEach(function (btn) {
      btn.disabled = !!snap.needsSpeciesPick;
    });

    const invFood = $('#invFood');
    const invToy = $('#invToy');
    const invSoap = $('#invSoap');
    if (invFood) invFood.textContent = '×' + pet.inventory.food;
    if (invToy) invToy.textContent = '×' + pet.inventory.toy;
    if (invSoap) invSoap.textContent = '×' + pet.inventory.soap;

    document.querySelectorAll('.btn-pet-use').forEach((btn) => {
      const kind = btn.dataset.use;
      const key = kind === 'feed' ? 'food' : kind === 'play' ? 'toy' : 'soap';
      const locked = !!(snap.bagCareLocks && snap.bagCareLocks[kind]);
      btn.disabled = !!snap.needsSpeciesPick || locked || (pet.inventory[key] || 0) <= 0;
      btn.textContent = locked ? '本日已达标' : '使用';
      btn.title = locked ? '本日已达标' : '';
      const row = btn.closest('.pet-inv-row');
      const desc = row && row.querySelector('.pet-inv-desc');
      if (desc) {
        if (!desc.dataset.idle) desc.dataset.idle = desc.textContent;
        desc.textContent = locked ? '本日已达标' : desc.dataset.idle;
      }
    });

    const dp = $('#dailyPointsVal');
    const dr = $('#dailyRankVal');
    if (dp) dp.textContent = String(snap.daily.points);
    if (dr) dr.textContent = snap.rank ? '#' + snap.rank.myRank : '—';

    renderCareProtect(snap.careProtect, snap.careDemoteToast);
    renderNurtureCadence(snap.nurtureCadence);
    renderStageGrowth(snap.stageGrowth);
    renderIntimacy(snap.intimacy, snap.evolve);
    renderQuests(snap.intimacyQuests);
    renderUltimateBanner(snap.ultimateReward);
    renderForms(snap.forms);
    const viewingFormPage = renderCareMemoir(snap);
    renderFriends(snap.friends, snap.daily);
    renderRank(snap.rank);
    renderChat(snap.chat);
    renderSpeciesPickOverlay(snap);
    renderGuide(snap);
    if (!viewingFormPage) switchTab(activeTab);

    if (snap.ultimateCelebrate) showUltimateCelebrate(snap.ultimateCelebrate);
    maybeOpenUltimateFromSnap(snap);
  }

  function renderGuide(snap) {
    const overlay = $('#guideOverlay');
    if (!overlay) return;
    if (snap && snap.needsSpeciesPick) {
      overlay.hidden = true;
      clearHighlights();
      return;
    }
    const g = snap.guide;
    if (!g || g.finished || !g.active) {
      if (!overlay.dataset.force) overlay.hidden = true;
      clearHighlights();
      if (window.TTPetFloat && TTPetFloat.resumeFromGuide) TTPetFloat.resumeFromGuide();
      return;
    }
    const copy = GUIDE_COPY[g.step] || GUIDE_COPY[0];
    const label = $('#guideStepLabel');
    const title = $('#guideTitle');
    const desc = $('#guideDesc');
    const primary = $('#guidePrimary');
    if (label) label.textContent = copy.label;
    if (title) title.textContent = copy.title;
    if (desc) desc.textContent = copy.desc;
    if (primary) {
      primary.textContent = copy.primary;
      primary.dataset.action = copy.action;
    }
    overlay.hidden = false;
    overlay.dataset.force = '1';
    applyHighlight(copy.highlight);
  }

  function afterCare(res, evt) {
    if (!res.ok) {
      if (res.reason === 'need_species') toast('请先选择你的 VIP管家神兽');
      else if (res.reason === 'no_item') toast('背包里没有该道具了');
      else if (res.reason === 'daily_done') toast('本日已达标');
      else toast('操作失败');
      return;
    }
    playReact(res.kind);
    let msg = res.feedback;
    if (res.intimacyGain) msg += ' · 亲密度 +' + res.intimacyGain;
    if (res.xpGain) msg += ' · +' + res.xpGain + ' XP';
    if (res.pointsGain) msg += ' · +' + res.pointsGain + ' 今日分';
    if (res.taskXp) msg += '（含照料任务）';
    toast(msg, 'success');
    handleLeveled(res, evt);
    if (res.leveled && res.leveled.ultimatePick) {
      openUltimatePickModal(res.leveled.ultimatePick);
    }
    if (res.careLeveled && res.evolveReady) {
      setTimeout(function () {
        openEvolveModal();
      }, res.leveled ? 600 : 200);
    }
    if (res.guideAdvanced) {
      const ov = $('#guideOverlay');
      if (ov) {
        ov.hidden = false;
        ov.dataset.force = '1';
      }
    }
    renderAll();
  }

  function runCare(kind, evt) {
    let res;
    if (kind === 'feed') res = TTStore.careFeed();
    else if (kind === 'play') res = TTStore.carePlay();
    else if (kind === 'drink') res = TTStore.careDrink();
    else if (kind === 'clean') res = TTStore.careClean();
    else if (kind === 'pat') res = TTStore.carePat();
    else if (kind === 'walk') res = TTStore.careWalk();
    else if (kind === 'story') res = TTStore.careStory();
    else if (kind === 'snack') res = TTStore.careSnack();
    else if (kind === 'photo') res = TTStore.carePhoto();
    else return;
    afterCare(res, evt);
  }

  function onNextFormTap() {
    const teaser = TTStore.getNextFormTeaser ? TTStore.getNextFormTeaser() : null;
    if (!teaser) {
      toast('下一形态暂不可用');
      return;
    }
    if (teaser.isUltimate) {
      toast(teaser.tip || '已达终极形态', 'success');
      return;
    }
    if (teaser.evolveReady) {
      openEvolveModal();
      return;
    }
    toast(teaser.tip || '持续满足需求并照料，攒亲密度后即可进化');
    switchTab('care');
    const actions = document.querySelector('.pet-actions');
    if (actions && actions.scrollIntoView) {
      actions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function initGuide() {
    const overlay = $('#guideOverlay');
    const primary = $('#guidePrimary');
    const skip = $('#guideSkip');
    if (!overlay || !primary || !skip) return;

    primary.addEventListener('click', () => {
      overlay.dataset.force = '1';
      if (primary.dataset.action === 'finish') {
        const res = TTStore.petGuideNext();
        if (res.guideDone) toast('新手引导完成 · 去照看管家宠吧', 'success');
        overlay.hidden = true;
        clearHighlights();
        if (window.TTPetFloat && TTPetFloat.resumeFromGuide) TTPetFloat.resumeFromGuide();
      } else {
        TTStore.petGuideNext();
      }
      renderAll();
    });

    skip.addEventListener('click', () => {
      TTStore.petSkipGuide();
      toast('已跳过引导 · 直接开玩', 'success');
      overlay.hidden = true;
      clearHighlights();
      if (window.TTPetFloat && TTPetFloat.resumeFromGuide) TTPetFloat.resumeFromGuide();
      renderAll();
    });
  }

  function init() {
    bindCommon({ depositGivesXp: false });
    const spConfirm = $('#speciesPickConfirm');
    if (spConfirm) spConfirm.addEventListener('click', confirmStarterSpecies);
    initGuide();
    TTStore.applyDecay();

    const snap0 = TTStore.getPetSnapshot();
    const g0 = snap0.guide;
    // Care guide waits until starter species is chosen
    if (!snap0.needsSpeciesPick && g0 && g0.active && !g0.finished && g0.step <= 5) {
      const ov = $('#guideOverlay');
      if (ov) {
        ov.hidden = false;
        ov.dataset.force = '1';
      }
    }

    if (!snap0.needsSpeciesPick) TTStore.petChatGreeting(false);
    renderAll();
    TTStore.subscribe(() => renderAll());

    document.querySelectorAll('.pet-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.tab !== 'care') selectedFormTier = null;
        switchTab(btn.dataset.tab);
        renderAll();
      });
    });

    const formsGal = $('#formsGallery');
    if (formsGal && formsGal.dataset.bound !== '1') {
      formsGal.dataset.bound = '1';
      formsGal.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-form-tier]');
        if (!btn) return;
        selectedFormTier = Number(btn.getAttribute('data-form-tier'));
        switchTab('care');
        renderAll();
      });
    }

    document.querySelectorAll('.pet-act[data-care], .pet-nurture-btn[data-care]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        runCare(btn.dataset.care, e);
      });
    });

    document.querySelectorAll('.btn-pet-use').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        afterCare(TTStore.careWithItem(btn.dataset.use), e);
      });
    });

    document.querySelectorAll('.btn-pet-free').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.dataset.free;
        const res = TTStore.claimFreePetItem(item);
        if (!res.ok) {
          toast('领取失败');
          return;
        }
        const names = { food: '仙果', toy: '灵嬉球', soap: '净灵露' };
        toast('免费领取 ' + (names[item] || item), 'success');
        renderAll();
      });
    });

    const chatForm = $('#chatForm');
    if (chatForm) {
      chatForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const input = $('#chatInput');
        sendChat(input ? input.value : '');
      });
    }

    const btnEvolve = $('#btnEvolve');
    if (btnEvolve) btnEvolve.addEventListener('click', openEvolveModal);
    const btnNextForm = $('#petNextForm');
    if (btnNextForm) btnNextForm.addEventListener('click', onNextFormTap);
    const evolveConfirm = $('#evolveConfirm');
    const evolveCancel = $('#evolveCancel');
    const evolveModal = $('#evolveModal');
    if (evolveConfirm) evolveConfirm.addEventListener('click', confirmEvolve);
    if (evolveCancel && evolveModal) {
      evolveCancel.addEventListener('click', function () {
        evolveModal.classList.remove('open');
      });
      evolveModal.addEventListener('click', function (e) {
        if (e.target === evolveModal) evolveModal.classList.remove('open');
      });
    }

    const btnSwitch = $('#btnSwitchSpecies');
    if (btnSwitch) btnSwitch.addEventListener('click', openSwitchSpeciesModal);
    const btnSwitchHelp = $('#btnSwitchSpeciesHelp');
    const switchHelpPop = $('#switchSpeciesHelpPop');
    function setSwitchHelpOpen(on) {
      if (!switchHelpPop || !btnSwitchHelp) return;
      switchHelpPop.hidden = !on;
      btnSwitchHelp.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    if (btnSwitchHelp && switchHelpPop) {
      btnSwitchHelp.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setSwitchHelpOpen(!!switchHelpPop.hidden);
      });
      document.addEventListener('click', function (e) {
        if (switchHelpPop.hidden) return;
        const wrap = $('#petSwitchWrap');
        if (wrap && wrap.contains(e.target)) return;
        setSwitchHelpOpen(false);
      });
    }
    const switchConfirm = $('#switchSpeciesConfirm');
    const switchCancel = $('#switchSpeciesCancel');
    const switchModal = $('#switchSpeciesModal');
    if (switchConfirm) switchConfirm.addEventListener('click', confirmSwitchSpecies);
    if (switchCancel && switchModal) {
      switchCancel.addEventListener('click', function () {
        switchModal.classList.remove('open');
      });
      switchModal.addEventListener('click', function (e) {
        if (e.target === switchModal) switchModal.classList.remove('open');
      });
    }

    const ultConfirm = $('#ultimateRewardConfirm');
    const ultCancel = $('#ultimateRewardCancel');
    const ultModal = $('#ultimateRewardModal');
    if (ultConfirm) ultConfirm.addEventListener('click', confirmUltimateReward);
    if (ultCancel && ultModal) {
      ultCancel.addEventListener('click', function () {
        ultModal.classList.remove('open');
      });
      ultModal.addEventListener('click', function (e) {
        if (e.target === ultModal) ultModal.classList.remove('open');
      });
    }
    const ultCelebOk = $('#ultimateCelebrateOk');
    const ultCeleb = $('#ultimateCelebrateModal');
    if (ultCelebOk && ultCeleb) {
      ultCelebOk.addEventListener('click', function () {
        ultCeleb.classList.remove('open');
      });
      ultCeleb.addEventListener('click', function (e) {
        if (e.target === ultCeleb) ultCeleb.classList.remove('open');
      });
    }

    const btnDemoCare = $('#btnDemoCare');
    if (btnDemoCare) {
      btnDemoCare.addEventListener('click', function () {
        const res = TTStore.demoCompleteStageGrowth
          ? TTStore.demoCompleteStageGrowth()
          : TTStore.demoBoostCareLevel();
        if (!res || !res.ok) {
          toast(
            res && res.reason === 'need_species'
              ? '请先选种'
              : res && res.reason === 'ultimate'
                ? '已达终极形态'
                : '演示失败'
          );
        } else toast('演示：本档抚养日与互动已满', 'success');
        renderAll();
        if (TTStore.getEvolveInfo && TTStore.getEvolveInfo().canEvolve) openEvolveModal();
      });
    }
    const btnDemoGold = $('#btnDemoGold');
    if (btnDemoGold) {
      btnDemoGold.addEventListener('click', function () {
        const res = TTStore.demoGrowToTier ? TTStore.demoGrowToTier(3) : null;
        if (!res || !res.ok) {
          toast(res && res.reason === 'need_species' ? '请先选种' : '演示失败');
        } else {
          selectedFormTier = 3;
          toast('已养成到金甲。点上面「幼宠」等已达成档，下面会换成回顾页', 'success');
        }
        renderAll();
      });
    }
    const btnDemoProtect = $('#btnDemoProtect');
    if (btnDemoProtect) {
      btnDemoProtect.addEventListener('click', function () {
        const res = TTStore.demoSkipCareProtect();
        if (!res.ok) toast('演示失败');
        renderAll();
      });
    }
    const btnDemoNeeds = $('#btnDemoNeeds');
    if (btnDemoNeeds) {
      btnDemoNeeds.addEventListener('click', function () {
        const res = TTStore.demoExpirePetNeeds && TTStore.demoExpirePetNeeds();
        if (!res || !res.ok) toast('演示失败');
        else {
          needsToastShown = false;
          toast(res.feedback || '需求已提醒', 'success');
        }
        renderAll();
      });
    }
    const btnDemoVip5 = $('#btnDemoVip5');
    if (btnDemoVip5) {
      btnDemoVip5.addEventListener('click', function () {
        if (TTStore.demoReachUltimateForm) TTStore.demoReachUltimateForm();
        else {
          const need = 50000 - (TTStore.get().xp || 0);
          if (need > 0) TTStore.demoAddXp(need + 10);
        }
        toast('演示：冲至 VIP5 终极形态', 'success');
        renderAll();
        const info = TTStore.getUltimateRewardInfo && TTStore.getUltimateRewardInfo();
        if (info && info.canClaim) openUltimatePickModal(info);
      });
    }

    if (protectTimer) clearInterval(protectTimer);
    protectTimer = setInterval(function () {
      const p = TTStore.getCareProtectInfo && TTStore.getCareProtectInfo();
      if (p && p.active) renderCareProtect(p, null);
      const cadence = TTStore.getNurtureCadenceInfo && TTStore.getNurtureCadenceInfo();
      if (cadence) renderNurtureCadence(cadence);
      const growth = TTStore.getStageGrowthInfo && TTStore.getStageGrowthInfo();
      if (growth) renderStageGrowth(growth);
      refreshNeedCountdowns();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

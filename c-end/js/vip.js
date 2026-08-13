/**
 * VIP Level page interactions
 */
(function () {
  'use strict';

  const { $, toast, renderHeader, bindCommon, handleLeveled } = TTUI;

  let carIndex = 0;
  let selectedFormTier = null;

  const BENEFIT_COPY = {
    cashout: {
      title: 'Faster Cashout For VIP',
      detail: 'Priority Withdrawals, No Waiting — VIP 通道优先出款。',
    },
    upgrade: {
      title: 'VIP Upgrade Gift',
      detail: '升级礼包 Bonus Balance ₱888，请联系 VIP 客服 Claim Via Support。',
    },
    birthday: {
      title: 'Birthday JUAN365 Gift',
      detail: '生日礼：免费蛋糕寄送 + CASH ₱388，需向客服登记生日信息。',
    },
    support: {
      title: 'Personal VIP Support',
      detail: '一对一 VIP 客服。添加专属顾问可获 ₱588 Bonus Balance。',
    },
    monthly: {
      title: 'VIP 15th Bonus',
      detail: '每月 15 日 06:00 后可联系客服领取月度礼 ₱300。',
    },
    travel: {
      title: 'VIP Travel Fund',
      detail: '差旅基金最高 ₱8,000（机票/酒店），一次性申请，需客服审核。',
    },
  };

  function renderAll() {
    const state = TTStore.get();
    renderHeader(state);
    renderStatus(state);
    renderArtStyle(state);
    renderCarousel(state);
    renderTable();
  }

  function renderBoundPet(state) {
    const line = $('#vipBoundPetLine');
    if (!line || !TTStore.petAppearance) return;
    const look = TTStore.petAppearance(state);
    line.innerHTML =
      look.emoji +
      ' <strong>' +
      look.petName +
      '</strong> · ' +
      (look.speciesLabel || '') +
      ' · ' +
      look.bindLabel +
      ' · ' +
      (TTStore.artStyleLabel ? TTStore.artStyleLabel(look.artStyle) : '中性') +
      ' · 亲密度 Lv.' +
      look.careLevel;
  }

  function paintFormNurture(tier) {
    const box = document.getElementById('formNurtureSummary');
    if (!box || !TTStore.getFormNurtureSummary) return;
    const s = TTStore.getFormNurtureSummary(tier);
    if (!s) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    const acts = (s.actions || [])
      .map(function (a) {
        return (
          '<span class="care-memoir-act"><span class="ico">' +
          a.icon +
          '</span><span class="lab">' +
          a.label +
          '</span><strong>' +
          a.count +
          ' 次</strong></span>'
        );
      })
      .join('');
    box.hidden = false;
    box.innerHTML =
      '<p class="form-nurture-kicker">' +
      s.kicker +
      '</p><h3>' +
      s.emoji +
      ' ' +
      s.title +
      ' · ' +
      s.name +
      '</h3><p class="form-nurture-lead">' +
      s.lead +
      '</p>' +
      (acts ? '<div class="care-memoir-acts">' + acts + '</div>' : '') +
      '<ul class="form-nurture-stats">' +
      (s.stats || [])
        .map(function (row) {
          return (
            '<li><span>' +
            row.label +
            '</span><strong>' +
            row.value +
            '</strong></li>'
          );
        })
        .join('') +
      '</ul><p class="form-nurture-overall">' +
      s.overallLine +
      '</p><p class="form-nurture-note">' +
      s.note +
      '</p>';
  }

  function renderArtStyle(state) {
    const card = document.getElementById('artStyleCard');
    if (!card || !TTStore.getArtStyleSwitchInfo) return;
    const info = TTStore.getArtStyleSwitchInfo(state);
    const need = document.getElementById('artStyleNeed');
    const body = document.getElementById('artStyleBody');
    if (need) need.hidden = info.chosen;
    if (body) body.hidden = !info.chosen;
    if (!info.chosen) {
      const empty = document.getElementById('formNurtureSummary');
      if (empty) {
        empty.hidden = true;
        empty.innerHTML = '';
      }
      return;
    }

    const tabs = document.getElementById('artStyleTabs');
    if (tabs) {
      tabs.innerHTML = info.styles
        .map(function (s) {
          const on = s.id === info.artStyle ? ' is-on' : '';
          return (
            '<button type="button" class="art-style-tab' +
            on +
            '" data-art-style="' +
            s.id +
            '" role="tab" aria-selected="' +
            (s.id === info.artStyle ? 'true' : 'false') +
            '">' +
            s.label +
            '<small>' +
            s.hint +
            '</small></button>'
          );
        })
        .join('');
    }

    const wear = document.getElementById('artWearMeta');
    if (wear && info.currentStage) {
      wear.innerHTML =
        info.emoji +
        ' 当前穿着 <strong>' +
        info.petName +
        '</strong> · ' +
        info.currentStage.title +
        ' · ' +
        info.artStyleLabel +
        '风格';
    }

    const img = document.getElementById('artSheetImg');
    if (img && info.artSheetUrl) {
      img.src = info.artSheetUrl;
      img.alt = (info.speciesLabel || '') + ' · ' + info.artStyleLabel + '六档形态';
    }

    const chips = document.getElementById('artStageChips');
    if (chips) {
      let viewTier = selectedFormTier;
      if (viewTier == null) viewTier = info.evoTier;
      selectedFormTier = viewTier;
      chips.innerHTML = info.stages
        .map(function (st) {
          const cls =
            (st.current ? ' is-current' : '') +
            (st.vipLocked ? ' is-lock' : '') +
            (st.pending ? ' is-pending' : '') +
            (!st.current && st.grown ? ' is-open' : '') +
            (st.tier === viewTier ? ' is-selected' : '');
          const mark = st.vipLocked ? '🔒 ' : st.pending ? '⏳ ' : st.grown ? '✓ ' : '';
          const sub = st.current
            ? ' · 当前'
            : st.pending
              ? ' · 抚养中'
              : st.vipLocked
                ? ' · 待升VIP'
                : st.grown
                  ? ' · 已达成'
                  : '';
          return (
            '<button type="button" class="art-stage-chip' +
            cls +
            '" data-art-stage="' +
            st.tier +
            '" data-grown="' +
            (st.grown ? '1' : '0') +
            '" data-pending="' +
            (st.pending ? '1' : '0') +
            '" data-vip-lock="' +
            (st.vipLocked ? '1' : '0') +
            '">' +
            mark +
            st.title +
            '<span>VIP' +
            st.tier +
            sub +
            '</span></button>'
          );
        })
        .join('');
      paintFormNurture(viewTier);
    }

    const hint = document.getElementById('artStyleHint');
    if (hint) {
      hint.textContent =
        '点任意形态看该档说明：已达成看抚养总结，未养成看解锁条件。六套风格可随时切换。形态靠抚养日+互动进阶。可随时更换神兽，新神兽继承当前形态档。';
    }
    const switchBtn = document.getElementById('btnSwitchSpecies');
    if (switchBtn) switchBtn.hidden = !info.chosen;
  }

  function initArtStyle() {
    const card = document.getElementById('artStyleCard');
    if (!card || card.dataset.bound === '1') return;
    card.dataset.bound = '1';
    card.addEventListener('click', function (e) {
      const tab = e.target.closest('[data-art-style]');
      if (tab) {
        if (!TTStore.setArtStyle) return;
        const res = TTStore.setArtStyle(tab.getAttribute('data-art-style'));
        if (!res.ok && res.reason === 'need_species') {
          toast('请先去宠物窝选择神兽', 'info');
          return;
        }
        if (res.ok && !res.unchanged) {
          const meta = (TTStore.ART_STYLES || []).filter(function (s) {
            return s.id === res.style;
          })[0];
          toast('已切换为「' + (meta ? meta.label : res.style) + '」风格', 'success');
        }
        return;
      }
      const stage = e.target.closest('[data-art-stage]');
      if (!stage) return;
      selectedFormTier = Number(stage.getAttribute('data-art-stage'));
      renderArtStyle(TTStore.get());
    });
  }

  function renderStatus(state) {
    const prog = TTStore.progressToNext(state.xp);
    const cur = prog.current;
    $('#statusTier').textContent = cur.tier;
    $('#statusLevel').textContent = 'VIP' + cur.level;
    $('#statusFill').style.width = prog.pct.toFixed(1) + '%';
    const shield = document.getElementById('shieldText');
    if (shield) shield.textContent = 'V' + cur.level;
    if (!prog.next) {
      $('#statusHint').textContent = 'Maximum SVIP Level reached. Enjoy your rewards!';
    } else {
      $('#statusHint').textContent =
        '还需 ' + TTStore.formatXp(prog.remaining) + ' XP 升至 VIP' + prog.next.level +
        '（' + Math.round(prog.pct) + '%）';
    }
    $('#rateLabel').textContent = 'VIP' + cur.level;
    $('#rateVal').textContent = cur.cashback + '%';
    renderBoundPet(state);
  }

  function renderCarousel(state) {
    const track = $('#carouselTrack');
    const dots = $('#carouselDots');
    if (!track) return;
    const lv = TTStore.levelFromXp(state.xp);
    const sp =
      (TTStore.normalizeSpecies && TTStore.normalizeSpecies(state.pet && state.pet.species)) ||
      (state.pet && state.pet.species) ||
      'sarimanok';
    track.innerHTML = TTStore.VIP_LEVELS.map((v, i) => {
      const active = i === lv ? ' active' : '';
      const form =
        TTStore.petFormForVip && TTStore.petFormForVip(v.level, sp);
      const icons = ['🥉', '🥉', '🥈', '🥇', '💎', '👑'];
      return (
        '<div class="vip-tier-card' +
        active +
        '" data-idx="' +
        i +
        '">' +
        '<div class="badge-ico">' +
        icons[i] +
        '</div>' +
        (form
          ? '<span class="vip-tier-pet" title="' +
            form.name +
            '">' +
            form.emoji +
            '</span><div class="tn">' +
            form.name +
            '</div>'
          : '') +
        '<div class="tn">' +
        v.tier +
        '</div>' +
        '<div class="meta">Level VIP' +
        v.level +
        '<br>Cashback Max: ₱' +
        TTStore.formatMoney(v.maxCashback) +
        '<br>Need ' +
        TTStore.formatXp(v.needXp) +
        ' XP<br>Rate ' +
        v.cashback +
        '%</div>' +
        '</div>'
      );
    }).join('');

    dots.innerHTML = TTStore.VIP_LEVELS.map(
      (_, i) =>
        '<button type="button" data-idx="' +
        i +
        '" class="' +
        (i === carIndex ? 'active' : '') +
        '" aria-label="Slide ' +
        i +
        '"></button>'
    ).join('');

    // default carousel focus near current level
    if (carIndex === 0 && lv > 0) carIndex = Math.max(0, lv - 1);
    updateCarouselPos();
  }

  function updateCarouselPos() {
    const track = $('#carouselTrack');
    const dots = $('#carouselDots');
    if (!track) return;
    const cardW = 212;
    track.style.transform = 'translateX(' + -carIndex * cardW + 'px)';
    if (dots) {
      dots.querySelectorAll('button').forEach((b, i) => {
        b.classList.toggle('active', i === carIndex);
      });
    }
  }

  function renderTable() {
    const body = $('#vipTableBody');
    if (!body) return;
    body.innerHTML = TTStore.VIP_LEVELS.map(
      (v) =>
        '<tr><td>VIP' +
        v.level +
        '</td><td>' +
        v.tier +
        '</td><td>' +
        TTStore.formatXp(v.needXp) +
        '</td><td>' +
        v.cashback +
        '%</td><td>₱' +
        TTStore.formatMoney(v.maxCashback) +
        '</td></tr>'
    ).join('');
  }

  function initTabs() {
    document.querySelectorAll('.vip-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.vip-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const id = tab.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        const panel = document.getElementById('panel-' + id);
        if (panel) panel.classList.add('active');
      });
    });
  }

  function initSupportModal() {
    const modal = $('#supportModal');
    const ok = $('#supportOk');
    document.querySelectorAll('.benefit-card').forEach((card) => {
      card.addEventListener('click', () => {
        const key = card.dataset.benefit;
        const copy = BENEFIT_COPY[key] || { title: 'Benefit', detail: '' };
        $('#supportDesc').textContent = copy.title + ' — Claim Via Support';
        $('#supportDetail').textContent = copy.detail;
        modal.classList.add('open');
      });
    });
    ok.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  let switchPickSpecies = null;

  function switchCardHtml(s, formTitle, selected) {
    const form = s.inheritForm || s.evolvePreview || s.preview || {};
    return (
      '<button type="button" class="pet-species-pick' +
      (s.keep ? ' is-keep' : '') +
      (selected ? ' is-selected' : '') +
      '" data-species="' +
      s.id +
      '"><span class="big">' +
      (form.emoji || '') +
      '</span><strong>' +
      s.label +
      (s.keep ? ' · 当前' : '') +
      '</strong><small>将升至「' +
      formTitle +
      '」· ' +
      (form.name || '') +
      '</small></button>'
    );
  }

  function openSwitchSpeciesModal() {
    const modal = document.getElementById('switchSpeciesModal');
    if (!modal || !TTStore.getSpeciesSwitchInfo) return;
    const info = TTStore.getSpeciesSwitchInfo();
    if (!info.chosen) {
      toast('请先去宠物窝选择神兽', 'info');
      return;
    }
    switchPickSpecies = info.currentSpecies;
    const cur = document.getElementById('switchSpeciesCurrent');
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
    const hintEl = document.getElementById('switchSpeciesHint');
    if (hintEl) hintEl.textContent = info.hint || '';
    const picks = document.getElementById('switchSpeciesPicks');
    if (picks) {
      picks.innerHTML = (info.options || [])
        .map(function (s) {
          return switchCardHtml(s, info.formTitle, s.id === switchPickSpecies);
        })
        .join('');
      picks.querySelectorAll('.pet-species-pick').forEach(function (btn) {
        btn.addEventListener('click', function () {
          switchPickSpecies = btn.getAttribute('data-species');
          picks.querySelectorAll('.pet-species-pick').forEach(function (b) {
            b.classList.toggle('is-selected', b.getAttribute('data-species') === switchPickSpecies);
          });
        });
      });
    }
    modal.classList.add('open');
  }

  function confirmSwitchSpecies() {
    if (!TTStore.switchPetSpecies) return;
    const res = TTStore.switchPetSpecies(switchPickSpecies);
    const modal = document.getElementById('switchSpeciesModal');
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
    if (res.ultimatePick) {
      toast('已达该品种终极形态，可去宠物窝领取养成奖励');
    }
  }

  function initSwitchSpecies() {
    const btn = document.getElementById('btnSwitchSpecies');
    if (btn) btn.addEventListener('click', openSwitchSpeciesModal);
    const ok = document.getElementById('switchSpeciesConfirm');
    const cancel = document.getElementById('switchSpeciesCancel');
    const modal = document.getElementById('switchSpeciesModal');
    if (ok) ok.addEventListener('click', confirmSwitchSpecies);
    if (cancel && modal) {
      cancel.addEventListener('click', function () {
        modal.classList.remove('open');
      });
      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.classList.remove('open');
      });
    }
  }

  function init() {
    bindCommon({ depositGivesXp: true });
    initTabs();
    initSupportModal();
    initArtStyle();
    initSwitchSpecies();
    carIndex = Math.max(0, TTStore.levelFromXp(TTStore.get().xp) - 1);

    // auto-complete「访问 VIP Level」daily task when landing here
    const visitRes = TTStore.completeVisitVipTask();
    if (visitRes.ok) {
      toast('访问 VIP +' + visitRes.xpGain + ' XP', 'success');
      handleLeveled(visitRes);
    }

    renderAll();

    TTStore.subscribe(() => renderAll());

    $('#carPrev').addEventListener('click', () => {
      carIndex = Math.max(0, carIndex - 1);
      updateCarouselPos();
    });
    $('#carNext').addEventListener('click', () => {
      carIndex = Math.min(TTStore.VIP_LEVELS.length - 2, carIndex + 1);
      updateCarouselPos();
    });
    $('#carouselDots').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-idx]');
      if (!btn) return;
      carIndex = Number(btn.dataset.idx);
      updateCarouselPos();
    });

    $('#btnDemoXp').addEventListener('click', (e) => {
      const res = TTStore.demoAddXp(500);
      toast('Demo +' + res.xpGain + ' XP', 'success');
      handleLeveled(res, e);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

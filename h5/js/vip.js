/**
 * VIP Level page interactions
 */
(function () {
  'use strict';

  const { $, toast, renderHeader, bindCommon, handleLeveled } = TTUI;

  let carIndex = 0;

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
    renderCarousel(state);
    renderTable();
  }

  function renderBoundPet(state) {
    const line = document.getElementById('vipBoundPetLine');
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
      ' · 亲密度 Lv.' +
      look.careLevel;
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
    const sp = (TTStore.normalizeSpecies && TTStore.normalizeSpecies(state.pet && state.pet.species)) || (state.pet && state.pet.species) || 'sarimanok';
    track.innerHTML = TTStore.VIP_LEVELS.map((v, i) => {
      const active = i === lv ? ' active' : '';
      const form = TTStore.petFormForVip && TTStore.petFormForVip(v.level, sp);
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
          ? '<span class="vip-tier-pet">' + form.emoji + '</span><div class="tn">' + form.name + '</div>'
          : '') +
        '<div class="tn">' +
        v.tier +
        '</div>' +
        '<div class="meta">VIP' +
        v.level +
        ' · ' +
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
    const card = track.querySelector('.vip-tier-card');
    const cardW = card ? card.offsetWidth + 10 : 158;
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

  function init() {
    bindCommon({ depositGivesXp: true });
    initTabs();
    initSupportModal();
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

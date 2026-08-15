/**
 * Lobby page interactions (萌宠乐园 — no game halls)
 */
(function () {
  'use strict';

  const { $, toast, renderHeader, bindCommon, handleLeveled } = TTUI;

  function renderAll() {
    const state = TTStore.get();
    renderHeader(state);
    renderPet(state);
    renderMission(state);
    renderCashback(state);
    renderTasks(state);
  }

  function renderPet(state) {
    const prog = TTStore.progressToNext(state.xp);
    const badge = $('#petBadge');
    const fill = $('#petXpFill');
    const text = $('#petXpText');
    const cta = $('#petHudCta');
    const statusEl = $('#petHudStatus');
    const hud = $('#petHud');
    if (badge) badge.textContent = 'VIP' + prog.level;
    if (fill) fill.style.width = prog.pct.toFixed(1) + '%';
    if (text) {
      if (!prog.next) {
        text.textContent = '已达最高等级 VIP5 · 尽情享受权益！';
      } else {
        text.textContent =
          '还需 ' + TTStore.formatXp(prog.remaining) + ' XP 升至 VIP' + prog.next.level;
      }
    }
    let cadence = null;
    if (TTStore.applyDecay) TTStore.applyDecay();
    if (TTStore.getNurtureCadenceInfo) cadence = TTStore.getNurtureCadenceInfo();
    if (cta) {
      cta.textContent = cadence && cadence.lobbyCta ? cadence.lobbyCta : '去照看 →';
    }
    if (statusEl) {
      const st = cadence && cadence.status;
      if (st === 'due' || st === 'overdue') {
        statusEl.hidden = false;
        statusEl.textContent = '⏰ 该回来抚养了';
        statusEl.dataset.status = st;
      } else if (st === 'due_soon') {
        statusEl.hidden = false;
        statusEl.textContent = '🔔 抚养节奏将至 · 保护将尽';
        statusEl.dataset.status = st;
      } else {
        const voice =
          TTStore.getPetVoiceInfo && TTStore.getPetVoiceInfo({ skipToast: true });
        if (voice && voice.mode === 'comfort' && voice.lobbyComfort) {
          statusEl.hidden = false;
          statusEl.textContent = voice.lobbyComfort;
          statusEl.dataset.status = st || 'fresh';
        } else {
          statusEl.hidden = true;
          statusEl.textContent = '';
          statusEl.dataset.status = st || 'fresh';
        }
      }
    }
    if (hud) {
      hud.classList.toggle('is-due', !!(cadence && (cadence.status === 'due' || cadence.status === 'overdue')));
      hud.classList.toggle('is-due-soon', !!(cadence && cadence.status === 'due_soon'));
    }
  }

  function renderMission(state) {
    const prog = TTStore.progressToNext(state.xp);
    const pct = $('#missionPct');
    const fill = $('#missionFill');
    const hint = $('#missionHint');
    if (pct) pct.textContent = Math.round(prog.pct) + '%';
    if (fill) fill.style.width = prog.pct.toFixed(1) + '%';
    if (hint) {
      if (!prog.next) {
        hint.textContent = '已达最高 VIP 等级。尽情享受权益！';
      } else {
        hint.textContent =
          '再获 ' +
          TTStore.formatXp(prog.remaining) +
          ' XP 解锁 VIP' +
          prog.next.level +
          ' · 返水升至 ' +
          prog.next.cashback +
          '%';
      }
    }
  }

  function renderCashback(state) {
    const amt = $('#cbAmount');
    const btn = $('#btnClaimCb');
    if (amt) {
      amt.textContent = state.cashbackClaimed
        ? '₱0.00'
        : '₱' + TTStore.formatMoney(state.dailyCashback);
    }
    if (btn) {
      btn.disabled = state.cashbackClaimed || state.dailyCashback <= 0;
      btn.textContent = state.cashbackClaimed ? '已领取' : '领取';
    }
  }

  function renderTasks(state) {
    document.querySelectorAll('.task-item').forEach((row) => {
      const key = row.dataset.task;
      const btn = row.querySelector('.btn-task');
      const done = state.tasks[key];
      if (!btn) return;
      btn.classList.toggle('done', !!done);
      if (done) {
        btn.disabled = true;
        btn.textContent = '已完成';
        return;
      }
      if (key === 'claimCashback') {
        // completed via Claim button; show Go as hint
        btn.disabled = true;
        btn.textContent = '去完成';
      } else {
        btn.disabled = false;
        btn.textContent = '去完成';
      }
    });
  }

  function tickWeekly() {
    const el = $('#weeklyTimer');
    if (!el) return;
    let end = Number(sessionStorage.getItem('vip_butler_weekly_end') || 0);
    if (!end) {
      end = Date.now() + (79 * 3600 + 23 * 60 + 9) * 1000;
      sessionStorage.setItem('vip_butler_weekly_end', String(end));
    }
    function tick() {
      const left = Math.max(0, end - Date.now());
      const h = Math.floor(left / 3600000);
      const m = Math.floor((left % 3600000) / 60000);
      const s = Math.floor((left % 60000) / 1000);
      el.textContent =
        h + '时 ' + String(m).padStart(2, '0') + '分 ' + String(s).padStart(2, '0') + '秒';
    }
    tick();
    setInterval(tick, 1000);
  }

  function init() {
    bindCommon({ depositGivesXp: true });
    tickWeekly();
    renderAll();

    TTStore.subscribe(() => renderAll());

    $('#btnClaimCb').addEventListener('click', (e) => {
      const res = TTStore.claimCashback();
      if (!res.ok) {
        toast('今日返水已领取');
        return;
      }
      let msg = '已领取返水 +₱' + TTStore.formatMoney(res.amount);
      if (res.xpGain) msg += ' · +' + res.xpGain + ' XP';
      toast(msg, 'success');
      handleLeveled(res, e);
    });

    document.querySelectorAll('.btn-task[data-action="login"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const res = TTStore.completeLoginTask();
        if (!res.ok) {
          toast('今日已签到');
          return;
        }
        toast('签到成功 +' + res.xpGain + ' XP', 'success');
        handleLeveled(res, e);
      });
    });

    document.querySelectorAll('.btn-task[data-action="visitVip"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const res = TTStore.completeVisitVipTask();
        if (!res.ok) {
          toast('今日已完成');
          return;
        }
        toast('查看冲档 +' + res.xpGain + ' XP', 'success');
        handleLeveled(res, e);
      });
    });

    document.querySelectorAll('.btn-task[data-action="watchVideo"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const res = TTStore.completeWatchVideoTask();
        if (!res.ok) {
          toast('今日已看过视频');
          return;
        }
        toast('观看完成 +' + res.xpGain + ' XP', 'success');
        handleLeveled(res, e);
      });
    });

    document.querySelectorAll('.btn-task[data-action="carePet"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.href = 'pet.html?v=20260815e';
      });
    });

    const watchCard = $('#featWatch');
    if (watchCard) {
      watchCard.addEventListener('click', (e) => {
        const res = TTStore.completeWatchVideoTask();
        if (!res.ok) {
          toast('今日已看过视频 · 明天再来');
          return;
        }
        toast('观看完成 +' + res.xpGain + ' XP · 演示奖励', 'success');
        handleLeveled(res, e);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

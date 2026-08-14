/**
 * Shared UI helpers: toast, XP float, level-up, header balances
 */
(function (global) {
  'use strict';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function toast(msg, type) {
    const wrap = $('#toastWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'success' ? ' success' : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function xpFloat(xpGain, x, y) {
    if (!xpGain) return;
    const el = document.createElement('div');
    el.className = 'xp-float';
    el.textContent = '+' + xpGain + ' XP';
    el.style.left = (x != null ? x : window.innerWidth / 2) + 'px';
    el.style.top = (y != null ? y : window.innerHeight / 2) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  function showLevelUp(leveled) {
    if (!leveled) return;
    const modal = $('#levelUpModal');
    if (!modal) return;
    const to = TTStore.VIP_LEVELS[leveled.to];
    $('#levelUpTitle').textContent = '升级成功！VIP' + leveled.to;
    let desc =
      '恭喜升至 VIP' + leveled.to + ' / ' + to.tier +
      ' · 返水 ' + to.cashback + '% · 上限 ₱' + TTStore.formatMoney(to.maxCashback);
    if (leveled.form && leveled.form.name) {
      desc +=
        ' · 管家宠进化为「' +
        leveled.form.emoji +
        ' ' +
        leveled.form.name +
        '」！';
    }
    $('#levelUpDesc').textContent = desc;
    modal.classList.add('open');
  }

  function bindLevelUpClose() {
    const ok = $('#levelUpOk');
    const modal = $('#levelUpModal');
    if (ok && modal) {
      ok.addEventListener('click', () => modal.classList.remove('open'));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    }
  }

  function renderHeader(state) {
    const p = $('#balP');
    const g = $('#balG');
    if (p) p.textContent = TTStore.formatMoney(state.p);
    if (g) g.textContent = TTStore.formatMoney(state.g);
  }

  function bindCommon(opts) {
    const options = opts || {};
    bindLevelUpClose();
    const refresh = $('#btnRefresh');
    if (refresh) {
      refresh.addEventListener('click', () => {
        refresh.classList.add('spinning');
        setTimeout(() => refresh.classList.remove('spinning'), 700);
        toast('余额已刷新', 'success');
        renderHeader(TTStore.get());
      });
    }
    const deposit = $('#btnDeposit');
    if (deposit) {
      deposit.addEventListener('click', (e) => {
        if (options.depositGivesXp && TTStore.demoDeposit) {
          const res = TTStore.demoDeposit(100);
          toast(
            '充值演示 +₱' +
              TTStore.formatMoney(res.amount) +
              ' · +' +
              res.xpGain +
              ' XP',
            'success'
          );
          handleLeveled(res, e);
          return;
        }
        toast('充值演示：请前往充值页（原型未接入）');
      });
    }
    const reset = $('#btnReset');
    if (reset) {
      reset.addEventListener('click', () => {
        TTStore.reset();
        toast('演示数据已重置', 'success');
      });
    }
  }

  function handleLeveled(result, evt) {
    if (result && result.leveled) {
      showLevelUp(result.leveled);
    }
    if (result && result.xpGain) {
      const x = evt ? evt.clientX : null;
      const y = evt ? evt.clientY : null;
      xpFloat(result.xpGain, x, y);
    }
  }

  global.TTUI = {
    $,
    toast,
    xpFloat,
    showLevelUp,
    renderHeader,
    bindCommon,
    handleLeveled,
  };
})(typeof window !== 'undefined' ? window : globalThis);

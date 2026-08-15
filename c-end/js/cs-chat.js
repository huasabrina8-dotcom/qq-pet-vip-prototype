/**
 * 在线客服演示对话（非真实工单）
 */
(function (global) {
  'use strict';

  var KEY = 'mengchong_cs_chat_v1';
  var CHIPS = ['怎么养神兽', 'VIP怎么冲档', '权益怎么领', '转人工'];

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadMsgs() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {}
    return [
      {
        role: 'agent',
        text: '您好，我是萌宠乐园在线客服（演示）。可问神兽养成、VIP 冲档、权益领取。',
      },
    ];
  }

  function saveMsgs(msgs) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-40)));
    } catch (e) {}
  }

  function replyTo(text) {
    var t = String(text || '');
    if (/人工|转接|投诉|工单/.test(t)) {
      return '已记下。正式环境会转接人工客服；本窗口只演示对话，不会产生真实工单。';
    }
    if (/养|宠物|神兽|照料|对话|进化|萌宠/.test(t)) {
      return '去宠物窝照料即可。饱食 / 喝水 / 清洁全免费；点「对话」和萌宠聊天也算今日深度抚养。形态靠养，升 VIP 不会立刻换装。';
    }
    if (/vip|冲档|经验|xp/i.test(t)) {
      return 'VIP 冲档在大厅完成：每日任务、领返水、充值演示都可 +XP。宠物窝不卖充值项。';
    }
    if (/权益|礼包|领取|生日/.test(t)) {
      return '权益礼包走客服领取演示。本窗口可咨询规则；正式发奖需后台审核，原型不接真钱。';
    }
    if (/充值|提现|出款|钱包/.test(t)) {
      return '充值入口在大厅顶栏。本原型是演示站，不接真实充值或出款。';
    }
    return '已收到。演示客服可继续问养成、冲档或权益。正式环境将接入真实在线客服。';
  }

  function ensureDock() {
    if (document.getElementById('csChatDock')) return;
    var wrap = document.createElement('div');
    wrap.id = 'csChatDock';
    wrap.className = 'cs-chat-dock';
    wrap.innerHTML =
      '<button type="button" class="cs-chat-fab" id="csChatFab" aria-label="打开在线客服">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/>' +
      '<path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>' +
      '</svg></button>' +
      '<div class="cs-chat-panel" id="csChatPanel" hidden role="dialog" aria-label="在线客服">' +
      '<div class="cs-chat-top">' +
      '<span class="ava" aria-hidden="true">🎧</span>' +
      '<div><strong>在线客服</strong><small><span class="cs-dot"></span>萌宠乐园 · 演示在线</small></div>' +
      '<button type="button" class="cs-chat-close" id="csChatClose" aria-label="关闭">×</button>' +
      '</div>' +
      '<div class="cs-chat-log" id="csChatLog" aria-live="polite"></div>' +
      '<div class="cs-chat-chips" id="csChatChips"></div>' +
      '<form class="cs-chat-form" id="csChatForm">' +
      '<input type="text" id="csChatInput" maxlength="120" placeholder="输入要咨询的问题…" autocomplete="off">' +
      '<button type="submit">发送</button>' +
      '</form>' +
      '<p class="cs-chat-note">演示对话，不产生真实客服工单</p>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  function renderLog(msgs, typing) {
    var log = document.getElementById('csChatLog');
    if (!log) return;
    var html = msgs
      .map(function (m) {
        return (
          '<div class="cs-chat-bubble ' +
          (m.role === 'user' ? 'user' : 'agent') +
          '">' +
          escapeHtml(m.text) +
          '</div>'
        );
      })
      .join('');
    if (typing) html += '<div class="cs-chat-bubble agent typing">客服正在输入…</div>';
    log.innerHTML = html;
    log.scrollTop = log.scrollHeight;
  }

  function bind() {
    ensureDock();
    var fab = document.getElementById('csChatFab');
    var panel = document.getElementById('csChatPanel');
    var closeBtn = document.getElementById('csChatClose');
    var form = document.getElementById('csChatForm');
    var input = document.getElementById('csChatInput');
    var chips = document.getElementById('csChatChips');
    if (!fab || !panel || panel.dataset.bound === '1') return;
    panel.dataset.bound = '1';

    var msgs = loadMsgs();
    var busy = false;

    function open() {
      var petPanel = document.getElementById('petFloatPanel');
      var petFab = document.getElementById('petFloatFab');
      if (petPanel) petPanel.hidden = true;
      if (petFab) petFab.hidden = false;
      panel.hidden = false;
      fab.hidden = true;
      renderLog(msgs, false);
      if (input) input.focus();
    }
    function hide() {
      panel.hidden = true;
      fab.hidden = false;
    }
    function send(text) {
      var t = String(text || '').trim();
      if (!t || busy) return;
      msgs.push({ role: 'user', text: t });
      saveMsgs(msgs);
      if (input) input.value = '';
      busy = true;
      renderLog(msgs, true);
      setTimeout(function () {
        msgs.push({ role: 'agent', text: replyTo(t) });
        saveMsgs(msgs);
        busy = false;
        renderLog(msgs, false);
      }, 420);
    }

    if (chips) {
      chips.innerHTML = CHIPS.map(function (c) {
        return '<button type="button" class="cs-chip" data-chip="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
      }).join('');
      chips.querySelectorAll('.cs-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          send(btn.dataset.chip);
        });
      });
    }

    fab.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        send(input ? input.value : '');
      });
    }

    document.querySelectorAll('#btnCsChat, [aria-label="客服"]').forEach(function (btn) {
      if (btn.dataset.csBound === '1') return;
      btn.dataset.csBound = '1';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (panel.hidden) open();
        else hide();
      });
    });

    renderLog(msgs, false);
  }

  function boot() {
    bind();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.TTCsChat = { open: function () {
    var btn = document.getElementById('csChatFab');
    if (btn) btn.click();
  } };
})(typeof window !== 'undefined' ? window : globalThis);

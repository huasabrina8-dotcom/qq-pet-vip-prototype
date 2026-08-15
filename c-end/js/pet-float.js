/**
 * 萌宠悬浮窗：页面上层常驻，点开和神兽对话
 */
(function (global) {
  'use strict';

  function petHref() {
    return 'pet.html?v=20260815g';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function look() {
    if (!global.TTStore || !TTStore.petAppearance) {
      return { emoji: '🐾', petName: '萌宠', artUrl: '', needsSpeciesPick: true };
    }
    return TTStore.petAppearance(TTStore.get());
  }

  function ensure() {
    if (document.getElementById('petFloatDock')) return;
    var wrap = document.createElement('div');
    wrap.id = 'petFloatDock';
    wrap.className = 'pet-float-dock';
    wrap.innerHTML =
      '<button type="button" class="pet-float-fab" id="petFloatFab" aria-label="打开萌宠对话">' +
      '<span class="pet-float-bob" id="petFloatAva">🐾</span>' +
      '<span class="pet-float-hint" id="petFloatHint">陪你</span>' +
      '</button>' +
      '<div class="pet-float-panel" id="petFloatPanel" hidden role="dialog" aria-label="和萌宠对话">' +
      '<div class="pet-float-top">' +
      '<span class="ava" id="petFloatPanelAva">🐾</span>' +
      '<div><strong id="petFloatTitle">和萌宠对话</strong>' +
      '<small>悬浮陪伴 · 计入今日深度抚养</small></div>' +
      '<a class="pet-float-go" id="petFloatGo" href="' +
      petHref() +
      '">去窝</a>' +
      '<button type="button" class="pet-float-close" id="petFloatClose" aria-label="关闭">×</button>' +
      '</div>' +
      '<div class="pet-float-log" id="petFloatLog" aria-live="polite"></div>' +
      '<div class="pet-float-chips" id="petFloatChips"></div>' +
      '<form class="pet-float-form" id="petFloatForm">' +
      '<input type="text" id="petFloatInput" maxlength="80" placeholder="跟萌宠说点什么…" autocomplete="off">' +
      '<button type="submit">发送</button>' +
      '</form>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  function setAva(el, info) {
    if (!el || !info) return;
    if (info.artUrl) {
      el.innerHTML = '<img alt="" src="' + escapeHtml(info.artUrl) + '">';
    } else {
      el.textContent = info.emoji || '🐾';
    }
  }

  function renderLog(msgs) {
    var log = document.getElementById('petFloatLog');
    if (!log) return;
    var list = (msgs && msgs.length) ? msgs : [{ role: 'pet', text: '点开就能跟我说话啦～' }];
    log.innerHTML = list
      .map(function (m) {
        return (
          '<div class="pet-float-bubble ' +
          (m.role === 'user' ? 'user' : 'pet') +
          '">' +
          escapeHtml(m.text) +
          '</div>'
        );
      })
      .join('');
    log.scrollTop = log.scrollHeight;
  }

  function refresh() {
    var info = look();
    setAva(document.getElementById('petFloatAva'), info);
    setAva(document.getElementById('petFloatPanelAva'), info);
    var title = document.getElementById('petFloatTitle');
    if (title) title.textContent = info.needsSpeciesPick ? '和萌宠对话' : '和' + (info.petName || '萌宠') + '对话';
    var hint = document.getElementById('petFloatHint');
    if (hint) hint.textContent = info.needsSpeciesPick ? '选我' : '陪你';
    if (!global.TTStore || !TTStore.getPetSnapshot) return;
    var snap = TTStore.getPetSnapshot();
    renderLog(snap.chat && snap.chat.messages);
    var chips = document.getElementById('petFloatChips');
    if (chips && snap.chat && snap.chat.chips) {
      chips.innerHTML = snap.chat.chips
        .slice(0, 4)
        .map(function (c) {
          return '<button type="button" class="pet-float-chip" data-chip="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
        })
        .join('');
      chips.querySelectorAll('.pet-float-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          send(btn.dataset.chip);
        });
      });
    }
  }

  function send(text) {
    if (!global.TTStore || !TTStore.petChatSend) return;
    var res = TTStore.petChatSend(text);
    var input = document.getElementById('petFloatInput');
    if (input) input.value = '';
    if (!res.ok) {
      if (res.reason === 'need_species') renderLog([{ role: 'pet', text: '先去宠物窝选一只本命神兽，我才能开口说话～' }]);
      else if (res.reason === 'empty') return;
      else if (res.reason === 'too_long') renderLog([{ role: 'pet', text: '太长啦，精简一点～' }]);
      else refresh();
      return;
    }
    refresh();
  }

  function closeCs() {
    var csPanel = document.getElementById('csChatPanel');
    var csFab = document.getElementById('csChatFab');
    if (csPanel) csPanel.hidden = true;
    if (csFab) csFab.hidden = false;
  }

  function bind() {
    ensure();
    var fab = document.getElementById('petFloatFab');
    var panel = document.getElementById('petFloatPanel');
    var closeBtn = document.getElementById('petFloatClose');
    var form = document.getElementById('petFloatForm');
    var input = document.getElementById('petFloatInput');
    if (!fab || !panel || panel.dataset.bound === '1') return;
    panel.dataset.bound = '1';

    function open() {
      closeCs();
      panel.hidden = false;
      fab.hidden = true;
      if (TTStore.petChatGreeting) TTStore.petChatGreeting(false);
      refresh();
      if (input) input.focus();
    }
    function hide() {
      panel.hidden = true;
      fab.hidden = false;
    }

    fab.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        send(input ? input.value : '');
      });
    }
    if (TTStore.subscribe) TTStore.subscribe(refresh);
    refresh();
  }

  function boot() {
    if (!document.body) return;
    bind();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);

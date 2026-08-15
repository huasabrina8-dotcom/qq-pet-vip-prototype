/**
 * 萌宠悬浮层：铺满整个页面，神兽在视口内游走，始终压在内容之上
 */
(function (global) {
  'use strict';

  var SIZE = 76;
  var pos = { x: 16, y: 96 };
  var wanderTimer = 0;
  var dragging = false;
  var moved = false;

  function petHref() {
    return 'pet.html?v=20260815h';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isH5() {
    return document.documentElement.classList.contains('h5') || !!document.querySelector('.h5-tabbar');
  }

  function look() {
    if (!global.TTStore || !TTStore.petAppearance) {
      return { emoji: '🐾', petName: '萌宠', artUrl: '', needsSpeciesPick: true };
    }
    return TTStore.petAppearance(TTStore.get());
  }

  function bounds() {
    var pad = 8;
    var header = isH5() ? 56 : 64;
    var bottom = isH5() ? 68 : 52;
    var minX = pad;
    var maxX = Math.max(pad, window.innerWidth - SIZE - pad);
    var minY = header;
    var maxY = Math.max(header, window.innerHeight - SIZE - bottom);
    if (isH5()) {
      var col = Math.min(430, window.innerWidth);
      var left = (window.innerWidth - col) / 2;
      minX = left + pad;
      maxX = left + col - SIZE - pad;
    }
    if (maxX < minX) maxX = minX;
    if (maxY < minY) maxY = minY;
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }

  function clampPos() {
    var b = bounds();
    pos.x = Math.min(b.maxX, Math.max(b.minX, pos.x));
    pos.y = Math.min(b.maxY, Math.max(b.minY, pos.y));
  }

  function placeFab(smooth) {
    var fab = document.getElementById('petFloatFab');
    if (!fab) return;
    clampPos();
    fab.style.transition = smooth ? 'left 4.8s linear, top 4.8s linear' : 'none';
    fab.style.left = pos.x + 'px';
    fab.style.top = pos.y + 'px';
  }

  function wander() {
    var panel = document.getElementById('petFloatPanel');
    if (dragging || (panel && !panel.hidden)) return;
    var b = bounds();
    pos.x = b.minX + Math.random() * (b.maxX - b.minX);
    pos.y = b.minY + Math.random() * (b.maxY - b.minY);
    placeFab(true);
  }

  function startWander() {
    stopWander();
    wanderTimer = global.setInterval(wander, 5200);
  }

  function stopWander() {
    if (wanderTimer) {
      global.clearInterval(wanderTimer);
      wanderTimer = 0;
    }
  }

  function ensure() {
    if (document.getElementById('petFloatLayer')) return;
    var layer = document.createElement('div');
    layer.id = 'petFloatLayer';
    layer.className = 'pet-float-layer';
    layer.innerHTML =
      '<button type="button" class="pet-float-fab" id="petFloatFab" aria-label="打开萌宠对话">' +
      '<span class="pet-float-bob" id="petFloatAva">🐾</span>' +
      '<span class="pet-float-hint" id="petFloatHint">陪你</span>' +
      '</button>' +
      '<div class="pet-float-panel" id="petFloatPanel" hidden role="dialog" aria-label="和萌宠对话">' +
      '<div class="pet-float-top">' +
      '<span class="ava" id="petFloatPanelAva">🐾</span>' +
      '<div><strong id="petFloatTitle">和萌宠对话</strong>' +
      '<small>整页悬浮陪伴 · 计入今日深度抚养</small></div>' +
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
    document.body.appendChild(layer);
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
    var list = msgs && msgs.length ? msgs : [{ role: 'pet', text: '我会在整页陪着你，点我就能说话～' }];
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

  function bindDrag(fab, open) {
    var startX = 0;
    var startY = 0;
    var origX = 0;
    var origY = 0;

    function onMove(e) {
      var p = e.touches ? e.touches[0] : e;
      var dx = p.clientX - startX;
      var dy = p.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
      pos.x = origX + dx;
      pos.y = origY + dy;
      placeFab(false);
      if (e.cancelable) e.preventDefault();
    }

    function onUp(e) {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      clampPos();
      placeFab(false);
      startWander();
      if (!moved) open();
      if (e && e.cancelable) e.preventDefault();
    }

    function onDown(e) {
      var p = e.touches ? e.touches[0] : e;
      dragging = true;
      moved = false;
      stopWander();
      fab.style.transition = 'none';
      startX = p.clientX;
      startY = p.clientY;
      origX = pos.x;
      origY = pos.y;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    }

    fab.addEventListener('mousedown', onDown);
    fab.addEventListener('touchstart', onDown, { passive: true });
    fab.addEventListener('click', function (e) {
      e.preventDefault();
    });
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

    var b = bounds();
    pos.x = b.minX + 8;
    pos.y = b.minY + 24;
    placeFab(false);

    function open() {
      closeCs();
      panel.hidden = false;
      fab.hidden = true;
      stopWander();
      if (TTStore.petChatGreeting) TTStore.petChatGreeting(false);
      refresh();
      if (input) input.focus();
    }
    function hide() {
      panel.hidden = true;
      fab.hidden = false;
      startWander();
    }

    bindDrag(fab, open);
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        hide();
      });
    }
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        send(input ? input.value : '');
      });
    }
    global.addEventListener('resize', function () {
      clampPos();
      placeFab(false);
    });
    if (TTStore.subscribe) TTStore.subscribe(refresh);
    refresh();
    startWander();
    global.setTimeout(wander, 800);
  }

  function parkForGuide() {
    ensure();
    stopWander();
    var panel = document.getElementById('petFloatPanel');
    if (panel) panel.hidden = true;
    var fab = document.getElementById('petFloatFab');
    if (fab) fab.hidden = false;
    var b = bounds();
    pos.x = b.minX + Math.max(0, (b.maxX - b.minX) * 0.58);
    pos.y = b.minY + 10;
    if (fab) {
      fab.style.transition = 'left 0.35s ease, top 0.35s ease';
      fab.style.left = pos.x + 'px';
      fab.style.top = pos.y + 'px';
      fab.classList.add('is-guide');
    }
  }

  function resumeFromGuide() {
    var fab = document.getElementById('petFloatFab');
    if (fab) fab.classList.remove('is-guide');
    var panel = document.getElementById('petFloatPanel');
    if (panel && !panel.hidden) return;
    if (!wanderTimer) startWander();
  }

  global.TTPetFloat = {
    parkForGuide: parkForGuide,
    resumeFromGuide: resumeFromGuide,
  };

  function boot() {
    if (!document.body) return;
    bind();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);

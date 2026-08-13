/**
 * H5 shell — bottom tab active state + page enter animation
 */
(function () {
  'use strict';

  document.documentElement.classList.add('h5');
  document.body.classList.add('h5-enter');

  const path = (location.pathname.split('/').pop() || 'lobby.html').toLowerCase();
  let tab = 'lobby';
  if (path.indexOf('vip') >= 0) tab = 'vip';
  else if (path.indexOf('pet') >= 0) tab = 'pet';

  document.querySelectorAll('.h5-tab').forEach(function (el) {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
})();

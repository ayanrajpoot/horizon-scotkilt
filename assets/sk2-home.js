/* SCOTKILT — home v2 (pages.html editorial design) behaviours.
   Scoped to [data-sk2] elements so it never touches the rest of the theme. */
(function () {
  'use strict';

  if (window.__sk2HomeLoaded) return;
  window.__sk2HomeLoaded = true;

  function initReveal() {
    var els = document.querySelectorAll('.sk2-reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  function initRails() {
    document.querySelectorAll('[data-sk2-rail-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rail = document.getElementById(btn.getAttribute('data-sk2-rail-btn'));
        if (!rail) return;
        var card = rail.firstElementChild;
        var width = card ? card.getBoundingClientRect().width + 20 : 300;
        var dir = btn.getAttribute('data-sk2-dir') === 'prev' ? -1 : 1;
        rail.scrollBy({ left: width * 2 * dir, behavior: 'smooth' });
      });
    });
  }

  function initFaq() {
    document.querySelectorAll('[data-sk2-faq]').forEach(function (root) {
      root.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-sk2-faq-toggle]');
        if (!btn || !root.contains(btn)) return;
        var item = btn.closest('.sk2-faq__item');
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open);
      });
    });
  }

  function initFinder() {
    document.querySelectorAll('[data-sk2-finder]').forEach(function (root) {
      root.addEventListener('click', function (e) {
        var opt = e.target.closest('[data-sk2-finder-opt]');
        if (!opt || !root.contains(opt)) return;
        var id = opt.getAttribute('data-sk2-finder-opt');
        root.querySelectorAll('[data-sk2-finder-opt]').forEach(function (b) {
          var on = b === opt;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on);
        });
        root.querySelectorAll('[data-sk2-finder-panel]').forEach(function (panel) {
          panel.classList.toggle('is-on', panel.getAttribute('data-sk2-finder-panel') === id);
        });
        var result = root.querySelector('[data-sk2-finder-result]');
        if (result && window.innerWidth < 1024) {
          result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  function initNewsletterMessages() {
    document.querySelectorAll('[data-sk2-newsletter]').forEach(function (form) {
      form.addEventListener('submit', function () {
        var msg = form.parentElement.querySelector('[data-sk2-news-msg]');
        if (msg) msg.textContent = 'Thanks — check your inbox to confirm.';
      });
    });
  }

  function init() {
    initReveal();
    initRails();
    initFaq();
    initFinder();
    initNewsletterMessages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

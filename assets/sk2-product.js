/* SCOTKILT — product page v2 (pages.html PDP) behaviours.
   Everything is delegated from the document so the buy column can be swapped
   out by Prestige's <product-rerender> on a variant change without re-binding. */
(function () {
  'use strict';

  if (window.__sk2ProductLoaded) return;
  window.__sk2ProductLoaded = true;

  /* ---------- gallery ---------------------------------------------------- */
  function setSlide(gallery, index) {
    var slides = gallery.querySelectorAll('.pdp-main__slide');
    var thumbs = gallery.querySelectorAll('.pdp-thumb');
    if (!slides.length) return;
    var i = ((index % slides.length) + slides.length) % slides.length;
    slides.forEach(function (slide, k) { slide.classList.toggle('is-on', k === i); });
    thumbs.forEach(function (thumb, k) {
      thumb.classList.toggle('is-on', k === i);
      thumb.setAttribute('aria-selected', k === i);
    });
    var cap = gallery.querySelector('[data-sk2-cap]');
    if (cap) cap.textContent = slides[i].getAttribute('data-cap') || '';
  }

  function currentSlide(gallery) {
    var slides = Array.prototype.slice.call(gallery.querySelectorAll('.pdp-main__slide'));
    var on = gallery.querySelector('.pdp-main__slide.is-on');
    return Math.max(0, slides.indexOf(on));
  }

  document.addEventListener('click', function (e) {
    var thumb = e.target.closest('[data-sk2-slide]');
    if (thumb) {
      var g1 = thumb.closest('[data-sk2-gallery]');
      if (g1) setSlide(g1, parseInt(thumb.getAttribute('data-sk2-slide'), 10));
      return;
    }

    var nav = e.target.closest('[data-sk2-nav]');
    if (nav) {
      var g2 = nav.closest('[data-sk2-gallery]');
      if (g2) setSlide(g2, currentSlide(g2) + parseInt(nav.getAttribute('data-sk2-nav'), 10));
      return;
    }

    var accBtn = e.target.closest('[data-sk2-dacc]');
    if (accBtn) {
      var item = accBtn.closest('.dacc');
      var open = item.classList.toggle('is-open');
      accBtn.setAttribute('aria-expanded', open);
      return;
    }

    var railBtn = e.target.closest('[data-sk2-rail-nav]');
    if (railBtn) {
      var rail = document.getElementById(railBtn.getAttribute('data-sk2-rail-nav'));
      if (rail) {
        var card = rail.firstElementChild;
        var width = card ? card.getBoundingClientRect().width + 20 : 300;
        rail.scrollBy({ left: width * 2 * (railBtn.getAttribute('data-sk2-dir') === 'prev' ? -1 : 1), behavior: 'smooth' });
      }
      return;
    }

    var copy = e.target.closest('[data-sk2-copy-link]');
    if (copy) {
      var label = copy.textContent;
      var done = function () {
        copy.textContent = 'Link copied';
        setTimeout(function () { copy.textContent = label; }, 2000);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(window.location.href).then(done, function () {});
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.target.closest('input, select, textarea')) return;
    var gallery = document.querySelector('[data-sk2-gallery]');
    if (!gallery) return;
    setSlide(gallery, currentSlide(gallery) + (e.key === 'ArrowRight' ? 1 : -1));
  });

  /* ---------- variant change: jump to that variant's image --------------- */
  document.addEventListener('variant:change', function (e) {
    var gallery = document.querySelector('[data-sk2-gallery]');
    var mediaId = e.detail && e.detail.variant && e.detail.variant.featured_media && e.detail.variant.featured_media.id;
    if (!gallery || !mediaId) return;
    var slide = gallery.querySelector('.pdp-main__slide[data-media-id="' + mediaId + '"]');
    if (!slide) return;
    var slides = Array.prototype.slice.call(gallery.querySelectorAll('.pdp-main__slide'));
    setSlide(gallery, slides.indexOf(slide));
  });

  /* ---------- sticky buy bar --------------------------------------------- */
  // ponytail: one observer per page load, re-armed on section load in the editor.
  var observer = null;

  function initBuyBar() {
    var bar = document.querySelector('[data-sk2-buybar]');
    var cta = document.querySelector('[data-sk2-cta]');
    if (!bar || !cta || !('IntersectionObserver' in window)) return;
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        bar.classList.toggle('is-on', show);
        bar.setAttribute('aria-hidden', show ? 'false' : 'true');
      });
    });
    observer.observe(cta);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBuyBar);
  } else {
    initBuyBar();
  }
  document.addEventListener('shopify:section:load', initBuyBar);
})();

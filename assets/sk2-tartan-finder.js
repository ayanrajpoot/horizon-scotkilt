/* SCOTKILT — full-page tartan finder.

   The page scrolls, not the results list, so the search and the filter bar are
   pinned under the site header and the letter headings pin under those. Their
   offsets have to be the bars' real heights — those change with the viewport,
   with how many filter chips there are and when a filter wraps to a second
   line — so they are measured rather than written into the stylesheet. */
(function () {
  'use strict';

  function track(root) {
    var search = root.querySelector('.tp-modal__search');
    var toolbar = root.querySelector('.tp-modal__toolbar');
    if (!search || !toolbar) return false;

    // getBoundingClientRect, not offsetHeight: the bars are fractional heights
    // (84.0 and 47.6 here) and rounding them up left a hairline of grid
    // showing between the filter bar and the letter heading.
    function measure() {
      root.style.setProperty('--sk2-tf-search-h', search.getBoundingClientRect().height + 'px');
      root.style.setProperty('--sk2-tf-toolbar-h', toolbar.getBoundingClientRect().height + 'px');
    }

    measure();
    if (window.ResizeObserver) {
      var observer = new ResizeObserver(measure);
      observer.observe(search);
      observer.observe(toolbar);
    } else {
      window.addEventListener('resize', measure);
    }
    return true;
  }

  function start() {
    document.querySelectorAll('.sk2-tf__app').forEach(function (app) {
      if (track(app)) return;
      // tartan-picker.js builds the panel once its data arrives; wait for it.
      var observer = new MutationObserver(function () {
        if (track(app)) observer.disconnect();
      });
      observer.observe(app, { childList: true, subtree: true });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

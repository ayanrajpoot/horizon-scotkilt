/* SCOTKILT — collection page v2 (pages.html category page) behaviours.

   Filtering is Shopify's native tag filtering: every filter option is an
   ordinary link to /collections/<handle>/<tag>[+<tag>], so the page filters
   correctly with JavaScript switched off. This file is enhancement on top of
   that — it intercepts those links and swaps the section in place instead of
   reloading, then adds the accordion groups, the mobile drawer and "Load
   more". Anything that fails here falls back to following the link. */
(function () {
  'use strict';

  if (window.__sk2CollectionLoaded) return;
  window.__sk2CollectionLoaded = true;

  // Tells the stylesheet to show "Load more" and hide the numbered pagination.
  // On <html> so a section re-rendered through the Section Rendering API
  // keeps the same state.
  document.documentElement.classList.add('sk2-js');

  /* ---------- mobile drawer ---------------------------------------------- */
  function closeFilters() {
    document.querySelectorAll('.sk2-cat .filters.is-open').forEach(function (el) { el.classList.remove('is-open'); });
    document.querySelectorAll('.sk2-cat__backdrop').forEach(function (el) { el.hidden = true; el.classList.remove('is-open'); });
    document.body.style.overflow = '';
  }

  function openFilters(panel) {
    panel.classList.add('is-open');
    var backdrop = document.querySelector('.sk2-cat__backdrop');
    if (backdrop) { backdrop.hidden = false; requestAnimationFrame(function () { backdrop.classList.add('is-open'); }); }
    document.body.style.overflow = 'hidden';
  }

  /* ---------- filter without reloading ------------------------------------ */
  // The section re-renders itself at the new URL, so the tick marks, the
  // result count, the active pills and the grid all come back consistent —
  // there is no client-side filter state to keep in sync.
  async function swap(url, root) {
    var fetchUrl = new URL(url, window.location.origin);
    fetchUrl.searchParams.set('section_id', root.getAttribute('data-sk2-section'));

    // Carry over what the server does not know about: which groups the
    // visitor has opened or closed, and whether the mobile drawer is up.
    var openGroups = Array.prototype.map.call(root.querySelectorAll('.fgroup'), function (g) {
      return g.classList.contains('is-open');
    });
    var drawerOpen = !!root.querySelector('.filters.is-open');

    root.setAttribute('aria-busy', 'true');
    try {
      var response = await fetch(fetchUrl.toString());
      if (!response.ok) throw new Error(response.status);
      var doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      var next = doc.querySelector('.sk2-cat');
      if (!next) throw new Error('no section in response');

      root.innerHTML = next.innerHTML;

      root.querySelectorAll('.fgroup').forEach(function (g, i) {
        if (openGroups[i] === undefined) return;
        g.classList.toggle('is-open', openGroups[i]);
        var btn = g.querySelector('[data-sk2-fgroup]');
        if (btn) btn.setAttribute('aria-expanded', openGroups[i]);
      });

      var panel = root.querySelector('.filters');
      if (drawerOpen && panel) openFilters(panel);

      window.history.pushState({ sk2: true }, '', url);
    } catch (err) {
      window.location.href = url;          // enhancement failed — just navigate
      return;
    }
    root.removeAttribute('aria-busy');
  }

  document.addEventListener('click', function (e) {
    /* accordion groups */
    var groupBtn = e.target.closest('[data-sk2-fgroup]');
    if (groupBtn) {
      var open = groupBtn.closest('.fgroup').classList.toggle('is-open');
      groupBtn.setAttribute('aria-expanded', open);
      return;
    }

    /* drawer */
    var openBtn = e.target.closest('[data-sk2-filters-open]');
    if (openBtn) {
      var target = document.getElementById(openBtn.getAttribute('data-sk2-filters-open'));
      if (target) openFilters(target);
      return;
    }
    if (e.target.closest('[data-sk2-filters-close]')) { closeFilters(); return; }

    /* load more */
    var moreBtn = e.target.closest('[data-sk2-more-btn]');
    if (moreBtn) { loadMore(moreBtn); return; }

    /* filter links — sidebar options, "Clear all", and the active pills */
    var link = e.target.closest('.sk2-cat .filters a[href], .sk2-cat .active a[href]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (link.target === '_blank' || link.origin !== window.location.origin) return;
    var root = link.closest('.sk2-cat');
    if (!root || !root.getAttribute('data-sk2-section')) return;

    e.preventDefault();
    swap(link.href, root);
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeFilters(); });

  // Back and forward move between filtered views the same way.
  window.addEventListener('popstate', function () {
    var root = document.querySelector('.sk2-cat[data-sk2-section]');
    if (root) swap(window.location.href, root);
  });

  /* ---------- sort --------------------------------------------------------- */
  // The base URL already carries the active tag path, so sorting never drops
  // the filters.
  document.addEventListener('change', function (e) {
    var select = e.target.closest('[data-sk2-sort]');
    if (!select) return;
    // Off the current URL, not the section's base: it already carries the tag
    // path AND any filter.* params, and swap() keeps it in step via pushState.
    var url = new URL(window.location.href);
    url.searchParams.set('sort_by', select.value);
    url.searchParams.delete('page');
    var root = select.closest('.sk2-cat');
    if (root && root.getAttribute('data-sk2-section')) swap(url.toString(), root);
    else window.location.href = url.toString();
  });

  /* ---------- load more ---------------------------------------------------- */
  async function loadMore(btn) {
    var next = btn.getAttribute('data-sk2-next');
    var grid = document.querySelector('[data-sk2-grid]');
    if (!next || !grid) return;

    var url = new URL(next, window.location.origin);
    url.searchParams.set('section_id', btn.getAttribute('data-sk2-section'));

    btn.disabled = true;
    try {
      var html = await (await fetch(url.toString())).text();
      var doc = new DOMParser().parseFromString(html, 'text/html');

      var newGrid = doc.querySelector('[data-sk2-grid]');
      if (newGrid) grid.append.apply(grid, Array.from(document.importNode(newGrid, true).childNodes));

      // carry over the next page's own count, progress bar and button state
      var newMore = doc.querySelector('[data-sk2-more]');
      var count = document.querySelector('[data-sk2-more-count]');
      var bar = document.querySelector('[data-sk2-more-bar]');
      var newCount = newMore && newMore.querySelector('[data-sk2-more-count]');
      var newBar = newMore && newMore.querySelector('[data-sk2-more-bar]');
      if (count && newCount) count.textContent = newCount.textContent;
      if (bar && newBar) bar.style.width = newBar.style.width;

      var newBtn = newMore && newMore.querySelector('[data-sk2-more-btn]');
      if (newBtn) {
        btn.setAttribute('data-sk2-next', newBtn.getAttribute('data-sk2-next'));
        btn.disabled = false;
      } else {
        btn.remove();
      }
    } catch (err) {
      btn.disabled = false;
    }
  }

})();

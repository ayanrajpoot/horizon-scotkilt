/* ==========================================================================
   SCOTKILT — global chrome behaviour
   Ported from pages.html's own handlers: mega menu, search overlay, mobile
   drawer and its accordions, and the header scroll shadow.

   Cart opening is delegated to Horizon rather than reimplemented — the theme
   already owns the cart drawer, its focus trap and its item count.
   ========================================================================== */
(() => {
  const root = document.querySelector('[data-sk2-chrome]');
  if (!root) return;

  const header = root.querySelector('.header');
  const search = root.querySelector('[data-sk2-search]');
  const mnav = root.querySelector('[data-sk2-mnav]');
  const backdrop = root.querySelector('[data-sk2-backdrop]');

  /* --- header scroll shadow ---------------------------------------------- */
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- mega menu ---------------------------------------------------------
     pages.html opens on hover with a close delay, and on focus for keyboards.
     The panel is a child of .nav__item, which is position:static, so it spans
     the header: .header is the sticky positioned ancestor it resolves against.
     Keep it that way — making .nav__item relative would collapse the panel to
     the width of its link.                                                   */
  let megaTimer = null;

  const closeMega = (item) => {
    const items = item ? [item] : root.querySelectorAll('.nav__item.is-open');
    items.forEach((i) => {
      i.classList.remove('is-open');
      i.querySelector('.nav__link')?.setAttribute('aria-expanded', 'false');
    });
  };

  const openMega = (item) => {
    if (!item.querySelector('.mega')) return;
    root.querySelectorAll('.nav__item.is-open').forEach((i) => i !== item && closeMega(i));
    item.classList.add('is-open');
    item.querySelector('.nav__link')?.setAttribute('aria-expanded', 'true');
  };

  root.querySelectorAll('.nav__item').forEach((item) => {
    if (!item.querySelector('.mega')) return;
    item.addEventListener('pointerenter', () => { clearTimeout(megaTimer); openMega(item); });
    item.addEventListener('pointerleave', () => { megaTimer = setTimeout(() => closeMega(item), 180); });
    item.addEventListener('focusin', () => { clearTimeout(megaTimer); openMega(item); });
    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget)) closeMega(item);
    });
  });

  /* --- search overlay ----------------------------------------------------- */
  const setSearch = (open) => {
    if (!search) return;
    search.classList.toggle('is-open', open);
    root.querySelectorAll('[data-sk2-search-toggle]').forEach((b) =>
      b.setAttribute('aria-expanded', String(open))
    );
    if (open) search.querySelector('input')?.focus();
  };

  /* --- mobile drawer ------------------------------------------------------ */
  const setDrawer = (open) => {
    mnav?.classList.toggle('is-open', open);
    backdrop?.classList.toggle('is-open', open);
    mnav?.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('sk2-no-scroll', open);
    root.querySelector('[data-sk2-nav-open]')?.setAttribute('aria-expanded', String(open));
  };

  const closeAll = () => { setDrawer(false); setSearch(false); closeMega(); };

  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-sk2-action]');
    if (!el) return;
    const action = el.dataset.sk2Action;

    if (action === 'search-toggle') {
      event.preventDefault();
      setSearch(!search?.classList.contains('is-open'));
    } else if (action === 'search-close' || action === 'close-all') {
      event.preventDefault();
      closeAll();
    } else if (action === 'nav-open') {
      event.preventDefault();
      setDrawer(true);
    } else if (action === 'macc') {
      event.preventDefault();
      const acc = el.closest('.macc');
      const open = acc.classList.toggle('is-open');
      el.setAttribute('aria-expanded', String(open));
    }
  });

  backdrop?.addEventListener('click', closeAll);

  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
})();

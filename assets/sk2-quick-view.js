/* SCOTKILT — quick view.

   Horizon's own quick add fetches the product page and looks for
   [data-product-grid-content]; the SK2 product page doesn't emit that, so its
   Choose/Add button has nothing to open. This wires the card's Quick view
   button to Horizon's dialog instead, showing the very block the SK2 product
   page already builds for this: its #quick-buy-content template -- image,
   badge, title, rating, price, short description, options, add to cart, view
   details. The dialog, the scroll lock, the add-to-cart form component and the
   cart refresh all stay the theme's.

   sk2-product.js delegates from the document, so the injected variant rows and
   tartan picker work without re-binding.

   ponytail: one fetch per product, cached for the life of the page. No hover
   prefetch -- add it if the fetch ever reads as slow. */
(function () {
  'use strict';

  var pages = {};

  function load(url) {
    if (!pages[url]) {
      pages[url] = fetch(url)
        .then(function (r) { return r.text(); })
        .then(function (html) { return new DOMParser().parseFromString(html, 'text/html'); });
    }
    return pages[url];
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('.sk2-pcard__quick');
    if (!button) return;
    event.preventDefault();

    var dialog = document.getElementById('quick-add-dialog');
    var slot = document.getElementById('quick-add-modal-content');
    var card = button.closest('.sk2-pcard');
    var link = card && card.querySelector('a[href*="/products/"]');
    if (!dialog || !slot || !link) return;

    var url = link.href;
    button.setAttribute('aria-busy', 'true');

    load(url).then(function (doc) {
      button.removeAttribute('aria-busy');

      var tpl = doc.getElementById('quick-buy-content');
      // Nothing to show is not worth a broken dialog -- just go to the product.
      if (!tpl) { window.location.href = url; return; }

      // importNode copies, so the cached document keeps its template for the
      // next open, and the copy belongs to this document from the start.
      var frag = document.importNode(tpl.content, true);
      // The template opens with the modal header Prestige slots in; Horizon's
      // dialog has no slots, so it would land as a stray paragraph.
      var header = frag.querySelector('[slot="header"]');
      if (header) header.remove();

      slot.replaceChildren(frag);
      dialog.showDialog();
    }, function () {
      button.removeAttribute('aria-busy');
      window.location.href = url;
    });
  });
})();

/* SCOTKILT — quick view.

   Horizon's own quick add fetches the product page and looks for
   [data-product-grid-content]; the SK2 product page doesn't emit that, so its
   Choose/Add button has nothing to open. This wires the card's Quick view
   button to the same dialog instead: fetch the PDP, lift its gallery + buy
   column, drop them into Horizon's quick-add dialog. The dialog, the scroll
   lock, the add-to-cart form component and the cart refresh all stay the
   theme's.

   sk2-product.js delegates from the document, so the injected gallery and
   variant rows work without re-binding.

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

      var top = doc.querySelector('.sk2-pdp__top');
      // Nothing to show is not worth a broken dialog -- just go to the product.
      if (!top) { window.location.href = url; return; }

      var wrap = document.createElement('div');
      wrap.className = 'sk2 sk2-quickview';
      // Clone: appending would move the node out of the cached document, and the
      // second look at that product would find nothing.
      wrap.appendChild(top.cloneNode(true));

      var full = document.createElement('a');
      full.className = 'sk2-quickview__full';
      full.href = url;
      full.textContent = 'View full details';
      wrap.appendChild(full);

      slot.replaceChildren(wrap);
      dialog.showDialog();
    }, function () {
      button.removeAttribute('aria-busy');
      window.location.href = url;
    });
  });
})();

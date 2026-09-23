/* ==========================================================================
   SCOTKILT – Tartan picker
   Product block + browse modal. Data comes from sections/tartan-data.liquid.
   Documentation: docs/TARTAN-PICKER.md
   ========================================================================== */

(() => {
  if (window.customElements.get('tartan-picker')) return;

  const CACHE_PREFIX = 'scotkilt:tartans:';
  const REMEMBER_KEY = 'scotkilt:tartan:last';
  const CHUNK_SIZE = 90;
  const DATA_REQUESTS = new Map(); // one network load per data source per page view
  const SELECTIONS = new Map(); // formId -> handle, survives Prestige re-rendering the product info

  const COLOUR_HEX = {
    red: '#b3261e', 'dark red': '#7a1c1c', maroon: '#6b1f2a', crimson: '#a4161a', pink: '#e58fb0',
    orange: '#d9772b', yellow: '#e8c547', gold: '#c9a13b', brown: '#6d4c35', beige: '#d9c7a6', cream: '#f1e8d3',
    green: '#2f6b3a', 'dark green': '#1f3a2e', 'light green': '#8dbf7a', olive: '#6b6b2f', teal: '#2a7470',
    blue: '#2d5aa0', 'dark blue': '#1c2e5a', navy: '#1b2545', 'light blue': '#8fb8de', purple: '#5d3a7a',
    lilac: '#b39ccf', white: '#ffffff', grey: '#8a8a8a', gray: '#8a8a8a', silver: '#c0c0c0', black: '#1a1a1a'
  };

  /* ---------- Helpers ---------- */

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));

  const normalize = (value) => String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bmc(?=[a-z])/g, 'mac') // McDonald finds MacDonald and the other way round
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const splitList = (value) => (Array.isArray(value) ? value : String(value ?? '').split(/[|,\n\r]+/))
    .map((entry) => String(entry).trim())
    .filter(Boolean);

  const cssUrl = (url) => (url ? `url("${String(url).replace(/"/g, '%22')}")` : '');

  const storage = {
    get(key) {
      try { return JSON.parse(window.localStorage.getItem(key)); } catch (error) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* quota or private mode */ }
    },
    remove(key) {
      try { window.localStorage.removeItem(key); } catch (error) { /* ignore */ }
    }
  };

  const colourSwatch = (name) => {
    const key = String(name).toLowerCase().trim();
    if (COLOUR_HEX[key]) return COLOUR_HEX[key];
    const compact = key.replace(/\s+/g, '');
    return window.CSS && CSS.supports('color', compact) ? compact : '#9a948a';
  };

  const debounce = (fn, wait) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  const normalizeItem = (raw) => {
    const name = String(raw.n || raw.h || '').trim();
    let thumb = raw.t || raw.i || '';
    let image = raw.i || raw.t || '';

    if (!thumb && raw.v) {
      thumb = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw.v)}`;
      image = thumb;
    }

    const keywords = splitList(raw.k);
    const colours = splitList(raw.cl);
    const category = String(raw.c || '').trim();
    const availability = String(raw.a || '').trim();
    const letterSource = normalize(name).replace(/^(the|clan)\s+/, '');
    const letter = letterSource.charAt(0).toUpperCase();

    return refreshSearch({
      handle: raw.h,
      hidden: raw.hidden === true,
      name,
      thumb,
      image,
      hex: String(raw.x || '').trim(),
      category,
      colours,
      keywords,
      groups: splitList(raw.g).map(normalize),
      popular: raw.p === true || raw.p === 'true',
      availability,
      surcharge: Number(raw.s) || 0,
      surchargeFormatted: raw.sf || '',
      description: String(raw.d || '').trim(),
      letter: /[A-Z]/.test(letter) ? letter : '#',
      sortName: letterSource
    });
  };

  // Search and sort fields, recalculated when library and metaobject data are merged
  function refreshSearch(item) {
    const letterSource = normalize(item.name).replace(/^(the|clan)\s+/, '');
    const letter = letterSource.charAt(0).toUpperCase();

    item.letter = /[A-Z]/.test(letter) ? letter : '#';
    item.sortName = letterSource;
    item.searchName = normalize(item.name);
    item.searchKeywords = normalize(item.keywords.join(' '));
    item.searchAll = normalize([item.name, ...item.keywords, item.category, ...item.colours, item.availability].join(' '));
    return item;
  }

  // One row of assets/tartan-library.json (see docs/tools/build_tartan_library.py)
  const normalizeLibraryItem = (row, fields) => {
    const record = {};
    fields.forEach((field, index) => { record[field] = row[index]; });

    const item = normalizeItem({ h: record.handle, n: record.name, c: record.category, cl: record.colours, p: record.popular === 1 });
    item.threadcount = record.threadcount || '';
    item.palette = record.palette || '';
    item.symmetric = record.symmetric === 1;
    // Products tagged with this tartan: "product-handle~colourway|..." (colourway empty for modern)
    item.products = String(record.products || '').split('|').filter(Boolean).map((entry) => {
      const [handle, colourway = ''] = entry.split('~');
      return { handle, colourway: colourway || 'modern' };
    });
    item.library = true;
    return item;
  };

  // Metaobject entries override or extend library tartans with the same handle
  const mergeTartans = (library, extra) => {
    const byHandle = new Map(library.map((item) => [item.handle, item]));

    extra.forEach((entry) => {
      const base = byHandle.get(entry.handle);

      if (!base) {
        if (!entry.hidden) byHandle.set(entry.handle, entry);
        return;
      }

      if (entry.hidden) {
        byHandle.delete(entry.handle);
        return;
      }

      if (entry.name && entry.name !== entry.handle) base.name = entry.name;
      if (entry.thumb) { base.thumb = entry.thumb; base.image = entry.image; }
      if (entry.hex) base.hex = entry.hex;
      if (entry.category) base.category = entry.category;
      if (entry.colours.length) base.colours = entry.colours;
      if (entry.keywords.length) base.keywords = [...new Set([...base.keywords, ...entry.keywords])];
      if (entry.groups.length) base.groups = entry.groups;
      if (entry.popular) base.popular = true;
      if (entry.availability) base.availability = entry.availability;
      if (entry.surcharge) { base.surcharge = entry.surcharge; base.surchargeFormatted = entry.surchargeFormatted; }
      if (entry.description) base.description = entry.description;
      refreshSearch(base);
    });

    return [...byHandle.values()];
  };

  /* ---------- Data loading ---------- */

  const fetchDataPage = async (dataUrl, page) => {
    const separator = dataUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${dataUrl}${separator}page=${page}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Tartan data request failed (${response.status})`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const script = doc.querySelector('script[data-tartan-data]');
    if (!script) throw new Error('Tartan data section not found');

    return JSON.parse(script.textContent);
  };

  const fetchLibrary = async (url) => {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`Tartan library request failed (${response.status})`);
    const data = await response.json();
    const fields = data.fields || ['handle', 'name', 'threadcount', 'palette', 'symmetric', 'category', 'colours', 'popular'];
    return (data.items || []).map((row) => normalizeLibraryItem(row, fields));
  };

  const loadTartans = (config) => {
    const source = config.source || 'metaobjects';
    const useLibrary = source.startsWith('library') && Boolean(config.libraryUrl);
    const useSection = source !== 'library';
    const key = `${source}|${config.libraryUrl || ''}|${config.dataUrl}|${config.cacheVersion}`;
    if (DATA_REQUESTS.has(key)) return DATA_REQUESTS.get(key);

    const request = (async () => {
      const [library, sectionItems] = await Promise.all([
        useLibrary
          ? fetchLibrary(config.libraryUrl).catch((error) => { console.error('Tartan picker: library not loaded', error); return []; })
          : [],
        useSection
          ? loadSectionTartans(config).catch((error) => {
            if (!useLibrary) throw error;
            console.warn('Tartan picker: metaobject tartans not loaded, using the library only', error);
            return [];
          })
          : []
      ]);

      if (!useLibrary) return sectionItems.filter((item) => !item.hidden);
      return mergeTartans(library, sectionItems);
    })();

    request.catch(() => DATA_REQUESTS.delete(key));
    DATA_REQUESTS.set(key, request);
    return request;
  };

  const loadSectionTartans = (config) => {
    const key = `${config.dataUrl}|${config.cacheVersion}`;

    return (async () => {
      const cacheKey = CACHE_PREFIX + key;
      const maxAge = Number(config.cacheMinutes || 0) * 60 * 1000;

      if (maxAge > 0 && !config.designMode) {
        const cached = storage.get(cacheKey);
        if (cached && Array.isArray(cached.items) && Date.now() - cached.time < maxAge) {
          return cached.items.map(normalizeItem);
        }
      }

      const first = await fetchDataPage(config.dataUrl, 1);
      const pages = Math.max(1, Number(first.pages) || 1);
      const results = [first];
      const remaining = [];
      for (let page = 2; page <= pages; page++) remaining.push(page);

      // Up to 4 requests at a time
      while (remaining.length) {
        const batch = remaining.splice(0, 4);
        results.push(...await Promise.all(batch.map((page) => fetchDataPage(config.dataUrl, page))));
      }

      const seen = new Set();
      const rawItems = [];
      results.forEach((result) => (result.items || []).forEach((item) => {
        if (!item || !item.h || seen.has(item.h)) return;
        seen.add(item.h);
        rawItems.push(item);
      }));

      if (maxAge > 0) {
        try {
          Object.keys(window.localStorage).forEach((storedKey) => {
            if (storedKey.startsWith(CACHE_PREFIX) && storedKey !== cacheKey) storage.remove(storedKey);
          });
        } catch (error) { /* storage unavailable */ }
        storage.set(cacheKey, { time: Date.now(), items: rawItems });
      }

      return rawItems.map(normalizeItem);
    })();
  };

  /* ---------- Search ---------- */

  const searchTartans = (items, query) => {
    const q = normalize(query);
    if (!q) return items.slice();

    const tokens = q.split(' ');
    const scored = [];

    items.forEach((item) => {
      if (!tokens.every((token) => item.searchAll.includes(token))) return;

      let score = 5;
      if (item.searchName === q) score = 0;
      else if (item.searchName.startsWith(q)) score = 1;
      else if ((` ${item.searchName}`).includes(` ${q}`)) score = 2;
      else if (item.searchName.includes(q)) score = 3;
      else if (item.searchKeywords.includes(q)) score = 4;

      scored.push({ item, score });
    });

    return scored
      .sort((a, b) => a.score - b.score || a.item.sortName.localeCompare(b.item.sortName))
      .map((entry) => entry.item);
  };

  const highlight = (text, query) => {
    const safe = escapeHtml(text);
    const q = String(query || '').trim();
    if (q.length < 2) return safe;

    const index = text.toLowerCase().indexOf(q.toLowerCase());
    if (index === -1) return safe;

    return `${escapeHtml(text.slice(0, index))}<mark>${escapeHtml(text.slice(index, index + q.length))}</mark>${escapeHtml(text.slice(index + q.length))}`;
  };

  /* ---------- Tartan drawing (threadcount -> woven cloth) ---------- */

  const COLOURWAYS = ['modern', 'ancient', 'weathered'];
  const COLOURWAY_LABELS = { modern: 'Modern', ancient: 'Ancient', weathered: 'Weathered' };

  // Product data for the Tartan finder's product carousel, fetched once per product from /products/<handle>.js
  const productCache = new Map();
  const fetchProduct = (root, handle) => {
    if (!productCache.has(handle)) {
      productCache.set(handle, fetch(`${root}products/${encodeURIComponent(handle)}.js`, { headers: { Accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null));
    }
    return productCache.get(handle);
  };
  const formatMoney = (cents) => {
    const shopify = window.Shopify || {};
    try {
      return new Intl.NumberFormat(shopify.locale || document.documentElement.lang || 'en', { style: 'currency', currency: (shopify.currency && shopify.currency.active) || 'USD' }).format(cents / 100);
    } catch (error) {
      return (cents / 100).toFixed(2);
    }
  };
  const sizedImage = (src, width) => {
    if (!src) return '';
    const url = src.startsWith('//') ? `https:${src}` : src;
    return `${url}${url.includes('?') ? '&' : '?'}width=${width}`;
  };
  const IMAGE_CACHE = new Map();
  const DRAW_QUEUE = [];
  let drawScheduled = false;

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
  };

  const hslToRgb = (h, s, l) => {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  };

  // Ancient and Weathered are approximations: the register only records Modern colours
  const shadeColour = (rgb, colourway) => {
    if (colourway === 'ancient') {
      let [h, s, l] = rgbToHsl(...rgb);
      if (h < 25 || h > 335) h = (h + 14) % 360; // reds lean towards orange
      return hslToRgb(h, s * 0.72, Math.min(0.92, 0.2 + l * 0.74));
    }

    if (colourway === 'weathered') {
      const [h, s, l] = rgbToHsl(...rgb);
      const muted = hslToRgb(h, s * 0.4, 0.2 + l * 0.6);
      return muted.map((value, index) => Math.round(value * 0.78 + [138, 122, 92][index] * 0.22));
    }

    return rgb;
  };

  const parseSett = (item) => {
    if (item._sett !== undefined) return item._sett;
    item._sett = null;
    if (!item.threadcount || !item.palette) return null;

    const colours = {};
    String(item.palette).split(/\s+/).forEach((pair) => {
      const [code, hex] = pair.split(':');
      if (code && /^[0-9a-f]{6}$/i.test(hex || '')) {
        colours[code] = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
    });

    const tokens = [];
    for (const raw of String(item.threadcount).trim().split(/\s+/)) {
      const match = raw.match(/^([A-Za-z]+)\/?(\d+)$/);
      if (!match || !colours[match[1]]) return null;
      tokens.push([match[1], Number(match[2])]);
    }

    const full = item.symmetric && tokens.length > 2 ? tokens.concat(tokens.slice(1, -1).reverse()) : tokens;
    const codes = Object.keys(colours);
    const indexOf = new Map(codes.map((code, index) => [code, index]));
    const total = full.reduce((sum, [, count]) => sum + count, 0);
    if (!total) return null;

    const seq = new Uint16Array(total);
    const usage = new Array(codes.length).fill(0);
    let position = 0;
    full.forEach(([code, count]) => {
      const index = indexOf.get(code);
      seq.fill(index, position, position + count);
      usage[index] += count;
      position += count;
    });

    const dominant = colours[codes[usage.indexOf(Math.max(...usage))]];
    item._sett = { seq, palette: codes.map((code) => colours[code]) };
    if (!item.hex) item.hex = `rgb(${dominant.join(',')})`;
    return item._sett;
  };

  const isDrawable = (item) => Boolean(item && !item.thumb && parseSett(item));

  // Returns a canvas with the tartan woven at the requested size
  const drawTartan = (item, size, colourway, detail) => {
    const sett = parseSett(item);
    if (!sett) return null;

    const { seq } = sett;
    const settLength = seq.length;
    const palette = sett.palette.map((rgb) => shadeColour(rgb, colourway));

    // Pixels per thread: small swatches show about one full sett, detail views show the twill weave
    const ppt = detail
      ? Math.max(2, Math.min(5, Math.floor(size / Math.min(settLength, 420))))
      : Math.min(3, Math.max(0.35, size / settLength));

    // Average colour of the threads covered by each pixel column (rows use the same sett)
    const lines = new Float32Array(size * 3);
    for (let x = 0; x < size; x++) {
      const start = x / ppt;
      const end = (x + 1) / ppt;
      let r = 0; let g = 0; let b = 0; let weight = 0;
      for (let t = Math.floor(start); t < end; t++) {
        const covered = Math.min(end, t + 1) - Math.max(start, t);
        if (covered <= 0) continue;
        const colour = palette[seq[t % settLength]];
        r += colour[0] * covered; g += colour[1] * covered; b += colour[2] * covered; weight += covered;
      }
      lines[x * 3] = r / weight; lines[x * 3 + 1] = g / weight; lines[x * 3 + 2] = b / weight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const image = context.createImageData(size, size);
    const px = image.data;
    const woven = ppt >= 2;

    for (let y = 0; y < size; y++) {
      const threadY = Math.floor(y / ppt);
      const fracY = y / ppt - threadY;

      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        let r; let g; let b;

        if (woven) {
          // 2/2 twill: warp shows on half the crossings, with round-yarn shading
          const threadX = Math.floor(x / ppt);
          const warp = ((threadX - threadY) % 4 + 4) % 4 < 2;
          const source = warp ? x : y;
          const across = warp ? x / ppt - threadX : fracY;
          const shade = 1.08 - 0.32 * (2 * across - 1) ** 2;
          r = lines[source * 3] * shade; g = lines[source * 3 + 1] * shade; b = lines[source * 3 + 2] * shade;
        } else {
          // Seen from a distance warp and weft blend, with a faint diagonal texture
          const texture = ppt >= 0.9 && ((x - y) & 3) < 2 ? 1.04 : 0.97;
          r = (lines[x * 3] + lines[y * 3]) * 0.5 * texture;
          g = (lines[x * 3 + 1] + lines[y * 3 + 1]) * 0.5 * texture;
          b = (lines[x * 3 + 2] + lines[y * 3 + 2]) * 0.5 * texture;
        }

        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
    return canvas;
  };

  const runDrawQueue = () => {
    drawScheduled = false;
    const started = performance.now();

    while (DRAW_QUEUE.length && performance.now() - started < 12) {
      const job = DRAW_QUEUE.shift();
      const canvas = drawTartan(job.item, job.size, job.colourway, job.detail);
      if (!canvas) {
        job.resolve('');
        continue;
      }
      canvas.toBlob((blob) => job.resolve(blob ? URL.createObjectURL(blob) : ''), 'image/webp', 0.9);
    }

    if (DRAW_QUEUE.length) scheduleDraws();
  };

  function scheduleDraws() {
    if (drawScheduled) return;
    drawScheduled = true;
    window.requestAnimationFrame(runDrawQueue);
  }

  // Promise of an object URL for a drawn tartan (cached per size and colourway)
  const tartanImageUrl = (item, size, colourway = 'modern', detail = false) => {
    const key = `${item.handle}|${size}|${colourway}|${detail ? 1 : 0}`;
    if (IMAGE_CACHE.has(key)) return IMAGE_CACHE.get(key);

    const promise = new Promise((resolve) => {
      if (detail) DRAW_QUEUE.unshift({ item, size, colourway, detail, resolve });
      else DRAW_QUEUE.push({ item, size, colourway, detail, resolve });
      scheduleDraws();
    });

    IMAGE_CACHE.set(key, promise);
    return promise;
  };

  const swatchAttrs = (item, { size = 120, lazy = false, colourway = 'modern' } = {}) => {
    const drawable = isDrawable(item);
    const style = [];
    if (item.hex) style.push(`--tp-hex:${escapeHtml(item.hex)}`);

    if (item.thumb) {
      if (!lazy) style.push(`background-image:${escapeHtml(cssUrl(item.thumb))}`);
      return `style="${style.join(';')}"${lazy ? ` data-bg="${escapeHtml(item.thumb)}"` : ''}`;
    }

    if (!drawable) return `style="${style.join(';')}"`;

    return `style="${style.join(';')}" data-tp-draw="${size}" data-tp-draw-handle="${escapeHtml(item.handle)}" data-tp-draw-colourway="${escapeHtml(colourway)}"`;
  };

  // Draws every [data-tp-draw] swatch inside a container
  const drawSwatch = (element, byHandle) => {
    const item = byHandle.get(element.getAttribute('data-tp-draw-handle'));
    const size = Number(element.getAttribute('data-tp-draw')) || 120;
    const colourway = element.getAttribute('data-tp-draw-colourway') || 'modern';
    element.removeAttribute('data-tp-draw');
    if (!item) return;

    tartanImageUrl(item, size, colourway).then((url) => {
      if (url && element.getAttribute('data-tp-draw-colourway') === colourway) element.style.backgroundImage = cssUrl(url);
    });
  };

  const drawSwatches = (root, byHandle) => {
    root?.querySelectorAll('[data-tp-draw]').forEach((element) => drawSwatch(element, byHandle));
  };

  const swatchSize = (cssSize) => Math.min(240, Math.round(cssSize * Math.min(2, window.devicePixelRatio || 1)));

  /* ==========================================================================
     <tartan-picker>
     ========================================================================== */

  class TartanPicker extends HTMLElement {
    connectedCallback() {
      if (this._connected) return;
      this._connected = true;

      try {
        this.config = JSON.parse(this.querySelector('script[data-tartan-config]').textContent);
      } catch (error) {
        console.error('Tartan picker: invalid configuration', error);
        return;
      }

      this.formId = this.getAttribute('form-id');
      this.items = [];
      this.byHandle = new Map();
      this.selected = null;
      this.activeOption = -1;
      this.abort = new AbortController();

      this.valueInput = this.querySelector('[data-tp-value]');
      this.handleInput = this.querySelector('[data-tp-handle]');
      this.searchInput = this.querySelector('[data-tp-search]');
      this.dropdown = this.querySelector('[data-tp-dropdown]');
      this.grid = this.querySelector('[data-tp-grid]');
      this.errorEl = this.querySelector('[data-tp-error]');
      this.selectedEl = this.querySelector('[data-tp-selected]');
      this.colourwayInput = this.querySelector('[data-tp-colourway]');
      this.colourwaysEl = this.querySelector('[data-tp-colourways]');
      this.colourway = COLOURWAYS.includes(this.config.defaultColourway) ? this.config.defaultColourway : 'modern';

      if (this.config.required && this.valueInput) this.valueInput.required = true;

      this.bindEvents();

      // Load data when the block comes near the viewport (or straight away if the shopper interacts first)
      this.observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.observer.disconnect();
          this.ensureData();
        }
      }, { rootMargin: '600px 0px' });
      this.observer.observe(this);
    }

    disconnectedCallback() {
      this.abort?.abort();
      this.observer?.disconnect();
      this._connected = false;
    }

    bindEvents() {
      const { signal } = this.abort;

      this.addEventListener('click', (event) => {
        const openButton = event.target.closest('[data-tp-open]');
        if (openButton) {
          event.preventDefault();
          this.openModal();
          return;
        }

        if (event.target.closest('[data-tp-clear]')) {
          event.preventDefault();
          this.clear();
          return;
        }

        const colourwayButton = event.target.closest('[data-tp-set-colourway]');
        if (colourwayButton && this.colourwaysEl?.contains(colourwayButton)) {
          this.setColourway(colourwayButton.getAttribute('data-tp-set-colourway'));
          return;
        }

        const swatch = event.target.closest('[data-tp-handle-value]');
        if (swatch && this.grid?.contains(swatch)) {
          const item = this.byHandle.get(swatch.getAttribute('data-tp-handle-value'));
          if (item) this.select(item);
        }
      }, { signal });

      if (this.valueInput) {
        this.valueInput.addEventListener('invalid', (event) => {
          event.preventDefault();
          this.showError();
        }, { signal });
      }

      if (this.searchInput) {
        const runSearch = debounce(() => this.renderDropdown(), 80);

        this.searchInput.addEventListener('focus', () => {
          this.ensureData();
          if (this.searchInput.value.trim()) this.renderDropdown();
        }, { signal });

        this.searchInput.addEventListener('input', () => {
          this.ensureData();
          runSearch();
        }, { signal });

        this.searchInput.addEventListener('keydown', (event) => this.onSearchKeydown(event), { signal });

        this.searchInput.addEventListener('blur', () => {
          setTimeout(() => this.closeDropdown(), 150);
        }, { signal });

        this.dropdown?.addEventListener('mousedown', (event) => event.preventDefault(), { signal });
        this.dropdown?.addEventListener('click', (event) => {
          const option = event.target.closest('[data-index]');
          if (option) this.chooseOption(Number(option.getAttribute('data-index')));
        }, { signal });
      }

      // Buy it now bypasses the theme form validation, so it is guarded separately
      document.addEventListener('click', (event) => {
        if (!this.config.required || !this.config.guardPaymentButton || this.selected || !this.isConnected) return;

        const form = document.getElementById(this.formId);
        const paymentButton = event.target.closest?.('.shopify-payment-button, shopify-buy-it-now-button, shopify-accelerated-checkout');
        if (!form || !paymentButton || !form.contains(paymentButton)) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        this.showError();
      }, { capture: true, signal });
    }

    /* ---------- Data ---------- */

    ensureData() {
      if (this.dataPromise) return this.dataPromise;

      this.dataPromise = loadTartans(this.config)
        .then((items) => {
          this.items = this.applyScope(items).sort((a, b) => a.sortName.localeCompare(b.sortName));
          this.byHandle = new Map(this.items.map((item) => [item.handle, item]));
          this.facets = this.buildFacets();
          this.classList.add(`tp-fit--${this.config.imageFit || 'cover'}`);

          if (!this.items.length) {
            this.onNoData();
            return this.items;
          }

          this.renderInline();
          this.updateTotal();
          this.restoreSelection();
          return this.items;
        })
        .catch((error) => {
          console.error('Tartan picker: could not load tartans', error);
          this.dataPromise = null;
          this.onNoData(true);
          return [];
        });

      return this.dataPromise;
    }

    applyScope(items) {
      if (this.config.restrictToHandles) {
        const handles = new Set(splitList(this.config.scopeHandles).map((handle) => handle.toLowerCase()));
        if (handles.size) return items.filter((item) => handles.has(String(item.handle).toLowerCase()));
      }

      if (this.config.restrictToGroups) {
        const groups = new Set(splitList(this.config.scopeGroups).map(normalize));
        if (groups.size) return items.filter((item) => item.groups.some((group) => groups.has(group)));
      }

      return items;
    }

    buildFacets() {
      const count = (values) => {
        const map = new Map();
        values.forEach((value) => {
          if (!value) return;
          const key = value.toLowerCase();
          const entry = map.get(key) || { value, count: 0 };
          entry.count++;
          map.set(key, entry);
        });
        return [...map.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
      };

      return {
        categories: count(this.items.map((item) => item.category)),
        colours: count(this.items.flatMap((item) => item.colours)),
        availability: count(this.items.map((item) => item.availability)),
        popularCount: this.items.filter((item) => item.popular).length
      };
    }

    onNoData(failed = false) {
      if (this.config.designMode) {
        if (this.grid) {
          this.grid.innerHTML = `<p class="tartan-picker__error">${failed
            ? 'Tartans could not be loaded. Check Theme settings > Tartan picker.'
            : 'No tartans found yet. Add tartans, then check Theme settings > Tartan picker.'}</p>`;
        }
        return;
      }

      // Never block a purchase because the tartan library is empty or unavailable
      if (this.valueInput) this.valueInput.required = false;
      this.hidden = true;
    }

    updateTotal() {
      const totalEl = this.querySelector('[data-tp-total]');
      if (totalEl && this.config.showTotal) totalEl.textContent = this.items.length.toLocaleString();
    }

    /* ---------- Inline swatches ---------- */

    renderInline() {
      if (!this.grid) return;

      const count = Number(this.config.inlineCount) || 0;
      let list = [];

      if (this.config.inlineSource === 'popular') {
        list = this.items.filter((item) => item.popular);
        if (list.length < count) {
          const extra = this.items.filter((item) => !item.popular).slice(0, count - list.length);
          list = list.concat(extra);
        }
      } else {
        list = this.items;
      }

      list = list.slice(0, count);

      const size = swatchSize(Number.parseFloat(getComputedStyle(this).getPropertyValue('--tp-swatch-size')) || 48);

      this.grid.innerHTML = list.map((item) => `
        <button type="button" class="tp-swatch" role="listitem" data-tp-handle-value="${escapeHtml(item.handle)}"
          aria-pressed="false" aria-label="${escapeHtml(item.name)}" title="${escapeHtml(item.name)}"
          ${swatchAttrs(item, { size, colourway: this.colourway })}></button>
      `).join('');

      drawSwatches(this.grid, this.byHandle);
      this.syncInlineState();
    }

    syncInlineState() {
      this.grid?.querySelectorAll('[data-tp-handle-value]').forEach((swatch) => {
        swatch.setAttribute('aria-pressed', String(swatch.getAttribute('data-tp-handle-value') === this.selected?.handle));
      });
    }

    /* ---------- Inline search dropdown ---------- */

    async renderDropdown() {
      if (!this.dropdown || !this.searchInput) return;

      const query = this.searchInput.value.trim();
      if (!query) {
        this.closeDropdown();
        return;
      }

      await this.ensureData();
      if (query !== this.searchInput.value.trim()) return;

      const results = searchTartans(this.items, query);
      this.dropdownResults = results.slice(0, 8);
      this.activeOption = -1;

      if (!results.length) {
        this.dropdown.innerHTML = `<li class="tp-option tp-option--empty" role="presentation">${escapeHtml(this.config.noResultsText)}</li>`;
      } else {
        this.dropdown.innerHTML = this.dropdownResults.map((item, index) => {
          const meta = [item.category, this.surchargeLabel(item)].filter(Boolean).join(' · ');
          return `
            <li class="tp-option" role="option" id="${this.id}-option-${index}" data-index="${index}" aria-selected="false">
              <span class="tp-swatch" ${swatchAttrs(item, { size: swatchSize(34), colourway: this.colourway })} aria-hidden="true"></span>
              <span class="tp-option__text">
                <span class="tp-option__name">${highlight(item.name, query)}</span>
                ${meta ? `<span class="tp-option__meta">${escapeHtml(meta)}</span>` : ''}
              </span>
            </li>`;
        }).join('') + (results.length > this.dropdownResults.length
          ? `<li class="tp-option tp-option--all" role="option" id="${this.id}-option-all" data-index="-2" aria-selected="false">See all ${results.length.toLocaleString()} results →</li>`
          : '');
      }

      drawSwatches(this.dropdown, this.byHandle);
      this.dropdown.hidden = false;
      this.searchInput.setAttribute('aria-expanded', 'true');
    }

    closeDropdown() {
      if (!this.dropdown) return;
      this.dropdown.hidden = true;
      this.searchInput?.setAttribute('aria-expanded', 'false');
      this.searchInput?.removeAttribute('aria-activedescendant');
      this.activeOption = -1;
    }

    onSearchKeydown(event) {
      if (!this.dropdown || this.dropdown.hidden) {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.renderDropdown();
        }
        return;
      }

      const options = [...this.dropdown.querySelectorAll('[data-index]')];

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          event.preventDefault();
          if (!options.length) return;
          const step = event.key === 'ArrowDown' ? 1 : -1;
          this.activeOption = (this.activeOption + step + options.length) % options.length;
          options.forEach((option, index) => option.setAttribute('aria-selected', String(index === this.activeOption)));
          const active = options[this.activeOption];
          active.scrollIntoView({ block: 'nearest' });
          this.searchInput.setAttribute('aria-activedescendant', active.id);
          break;
        }
        case 'Enter': {
          event.preventDefault();
          const option = options[this.activeOption] || options[0];
          if (option) this.chooseOption(Number(option.getAttribute('data-index')));
          break;
        }
        case 'Escape':
          event.preventDefault();
          this.closeDropdown();
          break;
      }
    }

    chooseOption(index) {
      if (index === -2) {
        const query = this.searchInput.value;
        this.closeDropdown();
        this.openModal(query);
        return;
      }

      const item = this.dropdownResults?.[index];
      if (!item) return;

      this.select(item);
      this.searchInput.value = '';
      this.closeDropdown();
    }

    /* ---------- Selection ---------- */

    surchargeLabel(item) {
      if (!this.config.showSurcharge || !item || item.surcharge <= 0 || !item.surchargeFormatted) return '';
      return `+${item.surchargeFormatted}`;
    }

    restoreSelection() {
      let stored = SELECTIONS.get(this.formId);

      if (!stored && this.config.urlParam) {
        const params = new URL(window.location.href).searchParams;
        if (params.get('tartan')) stored = `${params.get('tartan')}|${params.get('colourway') || ''}`;
      }

      if (!stored && this.config.rememberSelection) {
        stored = storage.get(REMEMBER_KEY);
      }

      const [handle, colourway] = String(stored || '').split('|');
      const item = handle && this.byHandle.get(handle);
      if (item) this.select(item, { restoring: true, colourway });
    }

    usesColourways(item) {
      return Boolean(this.config.enableColourways && isDrawable(item));
    }

    selectionLabel(item) {
      return this.usesColourways(item) ? `${item.name} (${COLOURWAY_LABELS[this.colourway]})` : item.name;
    }

    select(item, { restoring = false, colourway } = {}) {
      if (!item) return;

      if (this.config.enableColourways && COLOURWAYS.includes(colourway)) this.colourway = colourway;

      this.selected = item;
      const stored = `${item.handle}|${this.usesColourways(item) ? this.colourway : ''}`;
      SELECTIONS.set(this.formId, stored);

      if (this.valueInput) this.valueInput.value = this.selectionLabel(item);
      if (this.handleInput) {
        this.handleInput.value = item.handle;
        this.handleInput.disabled = false;
      }
      if (this.colourwayInput) {
        this.colourwayInput.value = this.usesColourways(item) ? COLOURWAY_LABELS[this.colourway] : '';
        this.colourwayInput.disabled = !this.usesColourways(item);
      }

      this.renderSelected();
      this.syncInlineState();
      this.hideError();

      if (this.config.rememberSelection) storage.set(REMEMBER_KEY, stored);
      if (this.config.urlParam) this.updateUrl(item.handle, this.usesColourways(item) ? this.colourway : '');

      this.dispatchEvent(new CustomEvent('tartan:change', {
        bubbles: true,
        detail: { tartan: item, colourway: this.usesColourways(item) ? this.colourway : null, formId: this.formId, restoring }
      }));
    }

    setColourway(colourway) {
      if (!COLOURWAYS.includes(colourway) || colourway === this.colourway) return;
      this.colourway = colourway;

      if (this.selected) this.select(this.selected, { colourway });
      if (this.grid) {
        this.grid.querySelectorAll('[data-tp-handle-value]').forEach((swatch) => {
          const item = this.byHandle.get(swatch.getAttribute('data-tp-handle-value'));
          if (!isDrawable(item)) return;
          swatch.setAttribute('data-tp-draw', swatch.getAttribute('data-tp-draw') || String(swatchSize(48)));
          swatch.setAttribute('data-tp-draw-handle', item.handle);
          swatch.setAttribute('data-tp-draw-colourway', colourway);
        });
        drawSwatches(this.grid, this.byHandle);
      }
    }

    clear() {
      this.selected = null;
      SELECTIONS.delete(this.formId);

      if (this.valueInput) this.valueInput.value = '';
      if (this.handleInput) {
        this.handleInput.value = '';
        this.handleInput.disabled = true;
      }
      if (this.colourwayInput) {
        this.colourwayInput.value = '';
        this.colourwayInput.disabled = true;
      }

      if (this.config.rememberSelection) storage.remove(REMEMBER_KEY);
      if (this.config.urlParam) this.updateUrl(null);

      this.renderSelected();
      this.syncInlineState();

      this.dispatchEvent(new CustomEvent('tartan:change', {
        bubbles: true,
        detail: { tartan: null, formId: this.formId, restoring: false }
      }));
    }

    renderSelected() {
      if (!this.selectedEl) return;

      const item = this.selected;
      this.selectedEl.hidden = !item;
      if (!item) return;

      const swatch = this.selectedEl.querySelector('[data-tp-selected-swatch]');
      const colourway = this.colourway;
      parseSett(item);
      swatch.style.setProperty('--tp-hex', item.hex || '');

      if (item.thumb) {
        swatch.style.backgroundImage = cssUrl(item.thumb);
      } else if (isDrawable(item)) {
        swatch.style.backgroundImage = '';
        tartanImageUrl(item, swatchSize(44), this.usesColourways(item) ? colourway : 'modern').then((url) => {
          if (url && this.selected === item && this.colourway === colourway) swatch.style.backgroundImage = cssUrl(url);
        });
      }

      if (this.colourwaysEl) {
        this.colourwaysEl.hidden = !this.usesColourways(item);
        this.colourwaysEl.innerHTML = this.usesColourways(item) ? COLOURWAYS.map((name) => `
          <button type="button" class="tp-chip tp-chip--small" data-tp-set-colourway="${name}" aria-pressed="${name === colourway}">${COLOURWAY_LABELS[name]}</button>
        `).join('') : '';
      }

      this.selectedEl.querySelector('[data-tp-selected-name]').textContent = item.name;
      this.selectedEl.querySelector('[data-tp-selected-meta]').textContent =
        [item.category, item.availability, this.surchargeLabel(item)].filter(Boolean).join(' · ');
    }

    updateUrl(handle, colourway = '') {
      const url = new URL(window.location.href);
      if (!url.pathname.includes('/products/')) return;

      if (handle) url.searchParams.set('tartan', handle);
      else url.searchParams.delete('tartan');

      if (handle && colourway && colourway !== 'modern') url.searchParams.set('colourway', colourway);
      else url.searchParams.delete('colourway');

      window.history.replaceState(window.history.state, '', url.toString());
    }

    showError() {
      if (this.errorEl) this.errorEl.hidden = false;
      this.classList.add('tartan-picker--invalid');

      this.classList.remove('tartan-picker--shake');
      void this.offsetWidth;
      this.classList.add('tartan-picker--shake');

      const rect = this.getBoundingClientRect();
      if (rect.top < 80 || rect.bottom > window.innerHeight) {
        this.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    hideError() {
      if (this.errorEl) this.errorEl.hidden = true;
      this.classList.remove('tartan-picker--invalid', 'tartan-picker--shake');
    }

    /* ---------- Modal ---------- */

    async openModal(query = '') {
      if (!this.modal) this.modal = new TartanModal(this);
      this.modal.open(query);
    }
  }

  /* ==========================================================================
     Browse modal
     ========================================================================== */

  class TartanModal {
    constructor(picker, { inline = false } = {}) {
      this.picker = picker;
      this.config = picker.config;
      this.inline = inline;
      this.state = {
        query: '',
        popular: false,
        categories: new Set(),
        colours: new Set(),
        availability: new Set(),
        view: this.config.defaultView === 'list' ? 'list' : 'grid',
        colourway: picker.colourway || 'modern'
      };
      this.filtered = [];
      this.rendered = 0;
      this.id = `${picker.id}-${inline ? 'browser' : 'modal'}`;
      this.build();
    }


    build() {
      const c = this.config;
      const dialog = document.createElement(this.inline ? 'div' : 'dialog');
      const shape = [...this.picker.classList].find((name) => name.startsWith('tartan-picker--') && !name.includes('invalid') && !name.includes('shake'));

      dialog.className = `tp-modal ${this.inline ? 'tp-modal--inline' : 'color-scheme color-scheme--dialog'} tp-fit--${c.imageFit || 'cover'} ${shape ? shape.replace('tartan-picker--', 'tp-modal--') : ''}`;
      dialog.id = this.id;
      if (this.inline) {
        dialog.setAttribute('role', 'region');
        dialog.setAttribute('aria-label', c.modalTitle || 'Tartan finder');
      } else {
        dialog.setAttribute('aria-labelledby', `${this.id}-title`);
      }
      dialog.style.setProperty('--tp-tile-size', this.picker.style.getPropertyValue('--tp-tile-size') || '80px');

      const title = escapeHtml(c.modalTitle || 'Browse all tartans').replace(/^(\S+)\s(.+)$/, '$1 <em>$2</em>');

      const showHead = !this.inline || Boolean(c.modalTitle);

      dialog.innerHTML = `
        <header class="tp-modal__head" ${showHead ? '' : 'hidden'}>
          <div>
            <h2 class="tp-modal__title" id="${this.id}-title">${title}</h2>
            <p class="tp-modal__subtitle" data-subtitle></p>
          </div>
          ${this.inline ? '' : '<button type="button" class="tp-modal__close" data-close aria-label="Close">✕</button>'}
        </header>

        <div class="tp-modal__search">
          <label class="tp-sr-only" for="${this.id}-search">Search tartans</label>
          <input type="search" id="${this.id}-search" class="tp-modal__search-input" autocomplete="off"
            placeholder="${escapeHtml(c.searchPlaceholder || 'Search by clan, surname, region or colour')}" data-search>
        </div>

        <div class="tp-modal__toolbar">
          <div class="tp-modal__toolbar-start" data-quick-filters style="display:flex;flex-wrap:wrap;align-items:center;gap:8px"></div>
          <div class="tp-modal__toolbar-end">
            <div class="tp-view-toggle tp-colourway-toggle" role="group" aria-label="Colours" data-colourway-toggle hidden>
              ${COLOURWAYS.map((name) => `<button type="button" data-colourway="${name}" aria-pressed="false">${COLOURWAY_LABELS[name]}</button>`).join('')}
            </div>
            <button type="button" class="tp-chip" data-toggle-filters aria-expanded="false" aria-controls="${this.id}-filters" hidden>
              More filters <span class="tp-chip__count" data-filter-count hidden>0</span>
            </button>
            <div class="tp-view-toggle" role="group" aria-label="View">
              <button type="button" data-view="grid" aria-label="Grid view" aria-pressed="false">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
              </button>
              <button type="button" data-view="list" aria-label="List view" aria-pressed="false">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="1" y="7" width="14" height="2" rx="1"/><rect x="1" y="12" width="14" height="2" rx="1"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="tp-modal__filters" id="${this.id}-filters" data-filters hidden></div>
        <div class="tp-modal__active" data-active hidden></div>
        <nav class="tp-modal__alphabet" aria-label="Jump to letter" data-alphabet ${c.showAlphabet ? '' : 'hidden'}></nav>

        <div class="tp-modal__body" data-body>
          <div class="tp-results tp-results--${this.state.view}" data-results aria-live="polite"></div>
          <section class="tp-preview" data-preview hidden aria-label="Tartan preview"></section>
        </div>

        <footer class="tp-modal__foot">
          <span data-shown></span>
          ${c.requestUrl ? `<a href="${escapeHtml(c.requestUrl)}">${escapeHtml(c.requestText || 'Request a custom tartan')} →</a>` : ''}
        </footer>
      `;

      if (this.inline) this.picker.appendChild(dialog);
      else document.body.appendChild(dialog);

      this.dialog = dialog;
      this.searchInput = dialog.querySelector('[data-search]');
      this.results = dialog.querySelector('[data-results]');
      this.preview = dialog.querySelector('[data-preview]');
      this.body = dialog.querySelector('[data-body]');
      this.alphabet = dialog.querySelector('[data-alphabet]');
      this.filtersPanel = dialog.querySelector('[data-filters]');
      this.activeBar = dialog.querySelector('[data-active]');

      this.bindEvents();
    }

    bindEvents() {
      const dialog = this.dialog;

      dialog.addEventListener('click', (event) => {
        // Backdrop click
        if (event.target === dialog && !this.inline) {
          const rect = dialog.getBoundingClientRect();
          const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
          if (!inside) this.close();
          return;
        }

        const target = event.target;

        if (target.closest('[data-close]')) return this.close();
        if (target.closest('[data-back]')) return this.hidePreview();

        const colourwayButton = target.closest('[data-colourway]');
        if (colourwayButton) return this.setColourway(colourwayButton.getAttribute('data-colourway'));

        const viewButton = target.closest('[data-view]');
        if (viewButton) return this.setView(viewButton.getAttribute('data-view'));

        if (target.closest('[data-toggle-filters]')) {
          const toggle = target.closest('[data-toggle-filters]');
          const open = this.filtersPanel.hidden;
          this.filtersPanel.hidden = !open;
          toggle.setAttribute('aria-expanded', String(open));
          return;
        }

        const filterButton = target.closest('[data-filter]');
        if (filterButton) return this.toggleFilter(filterButton.getAttribute('data-filter'), filterButton.getAttribute('data-value'));

        if (target.closest('[data-clear-filters]')) return this.clearFilters();

        const letterButton = target.closest('[data-letter]');
        if (letterButton) return this.jumpTo(letterButton.getAttribute('data-letter'));

        const action = target.closest('[data-action]');
        if (action) {
          const handle = action.closest('[data-handle]')?.getAttribute('data-handle');
          const item = this.picker.byHandle.get(handle);
          if (!item) return;

          const name = action.getAttribute('data-action');
          if (name === 'select') return this.choose(item);
          if (name === 'preview') return this.showPreview(item);
          if (name === 'open') return this.config.showPreview ? this.showPreview(item) : this.choose(item);
        }
      });

      dialog.addEventListener('cancel', (event) => {
        if (!this.preview.hidden) {
          event.preventDefault();
          this.hidePreview();
        }
      });

      dialog.addEventListener('close', () => {
        document.documentElement.classList.remove('tp-scroll-lock');
        document.documentElement.style.removeProperty('overflow');
      });

      this.searchInput.addEventListener('input', debounce(() => {
        this.state.query = this.searchInput.value;
        if (!this.preview.hidden) this.hidePreview(false);
        this.apply();
      }, 100));

      this.searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && this.filtered.length) {
          event.preventDefault();
          const first = this.filtered[0];
          this.config.showPreview ? this.showPreview(first) : this.choose(first);
        }
      });

      this.renderObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) this.renderMore();
      }, { root: this.body, rootMargin: '800px 0px' });

      this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          this.imageObserver.unobserve(el);

          if (el.hasAttribute('data-bg')) {
            el.style.backgroundImage = cssUrl(el.getAttribute('data-bg'));
            el.removeAttribute('data-bg');
          } else if (el.hasAttribute('data-tp-draw')) {
            drawSwatch(el, this.picker.byHandle);
          }
        });
      }, { root: this.body, rootMargin: '400px 0px' });
    }

    async open(query = '') {
      if (!this.inline) {
        document.documentElement.style.overflow = 'hidden';
        this.dialog.showModal();
      }

      this.searchInput.value = query;
      this.state.query = query;
      this.hidePreview(false);

      if (!this.picker.items.length) {
        this.results.innerHTML = '<div class="tp-loading"><span class="tp-spinner"></span><span>Loading tartans…</span></div>';
        await this.picker.ensureData();
      }

      if (!this.facetsBuilt) {
        this.buildFilters();
        this.facetsBuilt = true;
      }

      this.state.colourway = this.picker.colourway || this.state.colourway;
      this.syncColourwayToggle();
      this.setView(this.state.view, false);
      this.apply();

      if (!this.inline && window.matchMedia('(pointer: fine)').matches) this.searchInput.focus();

      // Bring the current tartan into view
      const selected = this.picker.selected;
      if (selected && !query) {
        const index = this.filtered.indexOf(selected);
        if (index > -1) {
          this.renderUntil(index);
          this.results.querySelector(`[data-handle="${CSS.escape(selected.handle)}"]`)?.scrollIntoView({ block: 'center' });
        }
      }
    }

    close() {
      if (!this.inline) this.dialog.close();
    }

    syncColourwayToggle() {
      const toggle = this.dialog.querySelector('[data-colourway-toggle]');
      const available = this.config.enableColourways && this.picker.items.some((item) => item.threadcount && !item.thumb);
      toggle.hidden = !available;
      toggle.querySelectorAll('[data-colourway]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.getAttribute('data-colourway') === this.state.colourway));
      });
    }

    setColourway(colourway) {
      if (!COLOURWAYS.includes(colourway) || colourway === this.state.colourway) return;
      this.state.colourway = colourway;
      this.syncColourwayToggle();

      this.results.querySelectorAll('.tp-card .tp-swatch').forEach((swatch) => {
        const item = this.picker.byHandle.get(swatch.closest('[data-handle]')?.getAttribute('data-handle'));
        if (!isDrawable(item)) return;
        swatch.style.backgroundImage = '';
        swatch.setAttribute('data-tp-draw', String(swatchSize(120)));
        swatch.setAttribute('data-tp-draw-handle', item.handle);
        swatch.setAttribute('data-tp-draw-colourway', colourway);
        this.imageObserver.observe(swatch);
      });

      const previewItem = this.previewItem && !this.preview.hidden ? this.previewItem : null;
      if (previewItem) this.showPreview(previewItem, { keepScroll: true });
    }

    choose(item) {
      if (this.inline) {
        this.showPreview(item);
        return;
      }

      this.picker.select(item, { colourway: this.state.colourway });
      this.close();
    }

    /* ---------- Filters ---------- */

    buildFilters() {
      const c = this.config;
      const facets = this.picker.facets || { categories: [], colours: [], availability: [], popularCount: 0 };
      const quick = this.dialog.querySelector('[data-quick-filters]');

      if (c.showPopularFilter && facets.popularCount > 0) {
        quick.innerHTML = `
          <span class="tp-modal__toolbar-label">Show</span>
          <button type="button" class="tp-chip" data-filter="popular" data-value="all" aria-pressed="true">All</button>
          <button type="button" class="tp-chip" data-filter="popular" data-value="popular" aria-pressed="false">★ Popular only</button>
        `;
      }

      const group = (label, key, entries, withDot = false) => {
        if (!entries.length) return '';
        return `
          <div class="tp-filter-group" role="group" aria-label="${escapeHtml(label)}">
            <span class="tp-filter-group__label">${escapeHtml(label)}</span>
            ${entries.map((entry) => `
              <button type="button" class="tp-chip" data-filter="${key}" data-value="${escapeHtml(entry.value)}" aria-pressed="false">
                ${withDot ? `<span class="tp-chip__dot" style="background:${escapeHtml(colourSwatch(entry.value))}" aria-hidden="true"></span>` : ''}
                ${escapeHtml(entry.value)} <span style="opacity:.6">${entry.count}</span>
              </button>`).join('')}
          </div>`;
      };

      const html = [
        c.showCategoryFilter ? group('Category', 'categories', facets.categories) : '',
        c.showColourFilter ? group('Colour', 'colours', facets.colours, true) : '',
        c.showAvailabilityFilter ? group('Availability', 'availability', facets.availability) : ''
      ].join('');

      this.filtersPanel.innerHTML = html;
      this.dialog.querySelector('[data-toggle-filters]').hidden = !html.trim();
    }

    toggleFilter(key, value) {
      if (key === 'popular') {
        this.state.popular = value === 'popular';
      } else {
        const set = this.state[key];
        const existing = [...set].find((entry) => entry.toLowerCase() === value.toLowerCase());
        existing ? set.delete(existing) : set.add(value);
      }

      if (!this.preview.hidden) this.hidePreview(false);
      this.apply();
    }

    clearFilters() {
      this.state.popular = false;
      this.state.categories.clear();
      this.state.colours.clear();
      this.state.availability.clear();
      this.apply();
    }

    syncFilterButtons() {
      this.dialog.querySelectorAll('[data-filter]').forEach((button) => {
        const key = button.getAttribute('data-filter');
        const value = button.getAttribute('data-value');
        let pressed;

        if (key === 'popular') pressed = (value === 'popular') === this.state.popular;
        else pressed = [...this.state[key]].some((entry) => entry.toLowerCase() === value.toLowerCase());

        button.setAttribute('aria-pressed', String(pressed));
      });

      const activeCount = this.state.categories.size + this.state.colours.size + this.state.availability.size;
      const counter = this.dialog.querySelector('[data-filter-count]');
      counter.textContent = activeCount;
      counter.hidden = activeCount === 0;

      const chips = [
        ...(this.state.popular ? [['popular', 'popular', '★ Popular']] : []),
        ...[...this.state.categories].map((value) => ['categories', value, value]),
        ...[...this.state.colours].map((value) => ['colours', value, value]),
        ...[...this.state.availability].map((value) => ['availability', value, value])
      ];

      this.activeBar.hidden = chips.length === 0;
      this.activeBar.innerHTML = chips.length ? `
        <span class="tp-modal__toolbar-label">Filtering:</span>
        ${chips.map(([key, value, label]) => `
          <button type="button" class="tp-chip" aria-pressed="true" data-filter="${key}" data-value="${key === 'popular' ? 'all' : escapeHtml(value)}"
            aria-label="Remove filter ${escapeHtml(label)}">${escapeHtml(label)} ✕</button>`).join('')}
        <button type="button" class="tp-link-button" data-clear-filters>Clear all</button>
      ` : '';
    }

    /* ---------- Results ---------- */

    apply() {
      const { state } = this;
      const lower = (set) => new Set([...set].map((value) => value.toLowerCase()));
      const categories = lower(state.categories);
      const colours = lower(state.colours);
      const availability = lower(state.availability);

      let list = this.picker.items.filter((item) => {
        if (state.popular && !item.popular) return false;
        if (categories.size && !categories.has(item.category.toLowerCase())) return false;
        if (availability.size && !availability.has(item.availability.toLowerCase())) return false;
        if (colours.size && !item.colours.some((colour) => colours.has(colour.toLowerCase()))) return false;
        return true;
      });

      this.searching = Boolean(normalize(state.query));
      if (this.searching) list = searchTartans(list, state.query);

      this.filtered = list;
      this.syncFilterButtons();
      this.renderAlphabet();

      const total = this.picker.items.length;
      this.dialog.querySelector('[data-subtitle]').textContent = `${total.toLocaleString()} tartans`;
      this.dialog.querySelector('[data-shown]').textContent = list.length === total
        ? `${total.toLocaleString()} tartans shown`
        : `${list.length.toLocaleString()} of ${total.toLocaleString()} tartans shown`;

      this.resetResults();
    }

    /**
     * Where the results are scrolled to.
     *
     * In the modal, and in a finder with a fixed height, `.tp-modal__body` is
     * the scroll container. On the full-page finder it is not — the page
     * itself scrolls — so scrollTop there does nothing and the preview would
     * open above the fold. Both cases go through here.
     *
     * A skin may pin the search and filter bars over the top of the results;
     * whatever is pinned has to be cleared, or a tartan opens underneath it.
     * That is measured from the bars themselves — a custom property is no use
     * here, getComputedStyle hands those back unresolved (`calc(...)`).
     */
    get bodyScrolls() {
      return this.body.scrollHeight > this.body.clientHeight + 1;
    }

    get scrollOrigin() {
      return this.body.getBoundingClientRect().top + window.scrollY;
    }

    get stickyOffset() {
      let offset = 0;
      this.dialog.querySelectorAll('.tp-modal__search, .tp-modal__toolbar').forEach((bar) => {
        const style = getComputedStyle(bar);
        if (style.position !== 'sticky') return;
        offset = Math.max(offset, (parseFloat(style.top) || 0) + bar.getBoundingClientRect().height);
      });
      return offset;
    }

    get scrollPos() {
      return this.bodyScrolls ? this.body.scrollTop : window.scrollY - this.scrollOrigin + this.stickyOffset;
    }

    set scrollPos(top) {
      if (this.bodyScrolls) {
        this.body.scrollTop = top;
        return;
      }
      window.scrollTo({ top: Math.max(0, this.scrollOrigin + top - this.stickyOffset) });
    }

    resetResults() {
      this.renderObserver.disconnect();
      this.results.innerHTML = '';
      this.rendered = 0;
      this.lastLetter = null;
      this.scrollPos = 0;

      if (!this.filtered.length) {
        this.results.innerHTML = `<div class="tp-empty"><span>${escapeHtml(this.config.noResultsText)}</span>${
          this.hasFilters() ? '<button type="button" class="tp-link-button" data-clear-filters>Clear filters</button>' : ''}</div>`;
        return;
      }

      this.renderMore();
    }

    hasFilters() {
      const { state } = this;
      return state.popular || state.categories.size || state.colours.size || state.availability.size;
    }

    renderMore() {
      if (this.rendered >= this.filtered.length) return;

      const slice = this.filtered.slice(this.rendered, this.rendered + CHUNK_SIZE);
      const selectedHandle = this.picker.selected?.handle;
      let html = '';

      slice.forEach((item) => {
        if (!this.searching && item.letter !== this.lastLetter) {
          html += `<h3 class="tp-letter" id="${this.id}-letter-${item.letter === '#' ? 'num' : item.letter}">${item.letter}</h3>`;
          this.lastLetter = item.letter;
        }
        html += this.cardHtml(item, item.handle === selectedHandle);
      });

      this.results.querySelector('.tp-sentinel')?.remove();
      this.results.insertAdjacentHTML('beforeend', html);
      this.rendered += slice.length;

      this.results.querySelectorAll('[data-bg], [data-tp-draw]').forEach((el) => this.imageObserver.observe(el));

      if (this.rendered < this.filtered.length) {
        const sentinel = document.createElement('div');
        sentinel.className = 'tp-sentinel';
        this.results.appendChild(sentinel);
        this.renderObserver.disconnect();
        this.renderObserver.observe(sentinel);
      }
    }

    renderUntil(index) {
      while (this.rendered <= index && this.rendered < this.filtered.length) this.renderMore();
    }

    cardHtml(item, current) {
      const c = this.config;
      const meta = [item.category, item.availability].filter(Boolean).join(' · ');
      const surcharge = this.picker.surchargeLabel(item);

      return `
        <div class="tp-card" data-handle="${escapeHtml(item.handle)}" ${current ? 'aria-current="true"' : ''}>
          <button type="button" class="tp-swatch" data-action="open" ${swatchAttrs(item, { size: swatchSize(120), lazy: true, colourway: this.state.colourway })}
            aria-label="${escapeHtml(c.showPreview ? `Preview ${item.name}` : `Select ${item.name}`)}">
            ${item.popular ? '<span class="tp-card__badge">★ Popular</span>' : ''}
          </button>
          <div class="tp-card__text">
            <div class="tp-card__name-row">
              <button type="button" class="tp-card__name" data-action="open" style="text-align:start">${highlight(item.name, this.state.query)}</button>
              ${surcharge ? `<span class="tp-surcharge">${escapeHtml(surcharge)}</span>` : ''}
            </div>
            ${meta ? `<span class="tp-card__meta">${escapeHtml(meta)}</span>` : ''}
          </div>
          <div class="tp-card__actions">
            ${this.inline
              ? '<button type="button" class="tp-btn tp-btn--solid" data-action="preview">View tartan</button>'
              : `${c.showPreview ? '<button type="button" class="tp-btn" data-action="preview">Preview</button>' : ''}
                 <button type="button" class="tp-btn tp-btn--solid" data-action="select">${current ? 'Selected ✓' : 'Select'}</button>`}
          </div>
        </div>`;
    }

    renderAlphabet() {
      if (!this.config.showAlphabet) return;

      const available = new Set(this.searching ? [] : this.filtered.map((item) => item.letter));
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      if (available.has('#')) letters.unshift('#');

      this.alphabet.innerHTML = letters.map((letter) => `
        <button type="button" data-letter="${letter}" ${available.has(letter) ? '' : 'disabled'}
          aria-label="Jump to ${letter === '#' ? 'numbers' : letter}">${letter}</button>`).join('');
    }

    jumpTo(letter) {
      if (!this.preview.hidden) this.hidePreview(false);

      const index = this.filtered.findIndex((item) => item.letter === letter);
      if (index === -1) return;

      this.renderUntil(index);
      const heading = this.results.querySelector(`#${CSS.escape(`${this.id}-letter-${letter === '#' ? 'num' : letter}`)}`);
      if (heading) this.scrollPos = heading.offsetTop - this.results.offsetTop;
    }

    setView(view, rerender = true) {
      // Keep the first visible tartan in place when the layout changes
      const bodyTop = Math.max(this.body.getBoundingClientRect().top, this.stickyOffset);
      const anchor = rerender && this.preview.hidden
        ? [...this.results.querySelectorAll('.tp-card')].find((card) => card.getBoundingClientRect().bottom > bodyTop + 60)
        : null;

      this.state.view = view === 'list' ? 'list' : 'grid';
      this.results.className = `tp-results tp-results--${this.state.view}`;
      this.results.hidden = !this.preview.hidden;

      if (anchor) {
        anchor.scrollIntoView({ block: 'start' });
        this.scrollPos -= this.searching ? 8 : 48; // room for the sticky letter heading
      }
      this.dialog.querySelectorAll('[data-view]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.getAttribute('data-view') === this.state.view));
      });
      if (rerender && !this.preview.hidden) this.hidePreview();
    }

    /* ---------- Preview ---------- */

    showPreview(item, { keepScroll = false } = {}) {
      const c = this.config;
      const surcharge = this.picker.surchargeLabel(item);
      const isCurrent = this.picker.selected?.handle === item.handle;
      const drawable = isDrawable(item);
      const colourways = c.enableColourways && drawable;
      const colourway = colourways ? this.state.colourway : 'modern';
      const scrollTop = this.scrollPos;

      if (!keepScroll) this.scrollBeforePreview = this.scrollPos;
      this.previewItem = item;

      const facts = [];
      if (c.showSurcharge) {
        facts.push(['Price', surcharge || 'No extra cost']);
      }
      if (item.availability) facts.push(['Availability', item.availability]);

      this.preview.innerHTML = `
        <button type="button" class="tp-link-button tp-preview__back" data-back>← Back to all tartans</button>
        <div class="tp-preview__layout" data-handle="${escapeHtml(item.handle)}">
          <div class="tp-preview__media ${c.enableZoom && (item.image || drawable) ? 'tp-preview__media--zoomable' : ''}"
            style="${item.hex ? `--tp-hex:${escapeHtml(item.hex)};` : ''}${item.image ? `background-image:${escapeHtml(cssUrl(item.image))}` : ''}"
            role="img" aria-label="${escapeHtml(item.name)}" data-zoom>
            ${item.popular ? '<span class="tp-card__badge">★ Popular</span>' : ''}
          </div>

          <div class="tp-preview__details">
            <h3 class="tp-preview__name">${escapeHtml(item.name)}</h3>
            <div class="tp-preview__tags">
              ${item.category ? `<span class="tp-tag">${escapeHtml(item.category)}</span>` : ''}
            </div>

            ${facts.length ? `<div class="tp-preview__facts">${facts.map(([label, value]) => `
              <div class="tp-preview__fact">
                <span class="tp-preview__fact-label">${escapeHtml(label)}</span>
                <span class="tp-preview__fact-value">${escapeHtml(value)}</span>
              </div>`).join('')}</div>` : ''}

            ${colourways ? `
              <p class="tp-preview__section-label">Colourway</p>
              <div class="tp-preview__colours" role="group" aria-label="Colourway">
                ${COLOURWAYS.map((name) => `<button type="button" class="tp-chip" data-colourway="${name}" aria-pressed="${name === colourway}">${COLOURWAY_LABELS[name]}</button>`).join('')}
              </div>` : ''}

            ${item.colours.length ? `
              <p class="tp-preview__section-label">Colours</p>
              <div class="tp-preview__colours">
                ${item.colours.map((colour) => `<span class="tp-chip" style="cursor:default"><span class="tp-chip__dot" style="background:${escapeHtml(colourSwatch(colour))}" aria-hidden="true"></span>${escapeHtml(colour)}</span>`).join('')}
              </div>` : ''}

            ${this.inline ? this.productCarouselHtml(item) : ''}

            ${item.description ? `<p class="tp-preview__description">${escapeHtml(item.description)}</p>` : ''}

            ${this.inline ? this.shopLinksHtml(item) : `
            <button type="button" class="tp-btn tp-btn--solid tp-btn--large" data-action="select">
              ${isCurrent && (!colourways || this.picker.colourway === colourway) ? `Keep ${escapeHtml(item.name)} ✓` : `Select ${escapeHtml(item.name)}${colourways ? ` (${COLOURWAY_LABELS[colourway]})` : ''} →`}
            </button>`}
          </div>
        </div>
      `;

      this.results.hidden = true;
      this.alphabet.hidden = true;
      this.preview.hidden = false;
      this.scrollPos = keepScroll ? scrollTop : 0;

      const media = this.preview.querySelector('[data-zoom]');
      if (drawable) {
        const size = Math.min(1400, Math.max(700, Math.round(media.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1))));
        tartanImageUrl(item, size, colourway, true).then((url) => {
          if (url && this.previewItem === item && this.state.colourway === colourway || url && !colourways && this.previewItem === item) {
            media.style.backgroundImage = cssUrl(url);
          }
        });
      }

      this.bindZoom(media);
      if (this.inline) this.loadProductCarousel(item);
      if (!keepScroll) this.preview.querySelector('[data-back]').focus({ preventScroll: true });

      if (this.inline) {
        // The product Tartan picker restores this tartan when "Remember last tartan" is on
        storage.set(REMEMBER_KEY, `${item.handle}|${c.enableColourways && drawable ? colourway : ''}`);
        if (this.config.urlParam) this.setPageParam('tartan', item.handle);
      }
    }

    shopLinksHtml(item) {
      const links = Array.isArray(this.config.shopLinks) ? this.config.shopLinks : [];
      if (!links.length) return '';

      const carouselLink = this.carouselLink(item);
      const html = links.map((link, index) => {
        if (link === carouselLink) return '';
        const url = this.shopLinkUrl(link, item);
        if (!url) return '';
        const solid = link.style ? link.style === 'solid' : index === 0;
        return `<a class="tp-btn tp-btn--large ${solid ? 'tp-btn--solid' : ''}" href="${escapeHtml(url)}">${escapeHtml(link.label)} →</a>`;
      }).join('');

      return html ? `<div class="tp-preview__links">${html}</div>` : '';
    }

    /**
     * The first "tagged" link is shown as a product carousel when the tartan has linked products.
     * Without linked products it falls back to the button (hidden when "hide_without_products" is on).
     */
    carouselLink(item) {
      const links = Array.isArray(this.config.shopLinks) ? this.config.shopLinks : [];
      const hasProducts = Array.isArray(item.products) && item.products.length > 0;
      return hasProducts ? links.find((link) => link.type === 'tagged' && link.display !== 'button') || null : null;
    }

    // Linked products, the colourway the shopper is viewing first
    carouselProducts(item, link) {
      const colourway = this.config.enableColourways && isDrawable(item) ? this.state.colourway : 'modern';
      const rank = (product) => (product.colourway === colourway ? 0 : product.colourway === 'modern' ? 1 : 2);
      const limit = Number(link.limit) > 0 ? Number(link.limit) : 12;
      return [...item.products].sort((a, b) => rank(a) - rank(b)).slice(0, limit);
    }

    productCarouselHtml(item) {
      const link = this.carouselLink(item);
      if (!link) return '';
      const count = this.carouselProducts(item, link).length;
      const placeholder = '<div class="tp-product tp-product--loading" aria-hidden="true"><div class="tp-product__image"></div><div class="tp-product__line"></div><div class="tp-product__line tp-product__line--short"></div></div>';

      return `
        <div class="tp-products" data-tp-products>
          <div class="tp-products__header">
            <p class="tp-products__title">${escapeHtml(link.label)}</p>
            <div class="tp-products__nav">
              <button type="button" class="tp-products__arrow" data-tp-products-prev aria-label="Previous products" disabled>←</button>
              <button type="button" class="tp-products__arrow" data-tp-products-next aria-label="Next products">→</button>
            </div>
          </div>
          <div class="tp-products__track" data-tp-products-track>${placeholder.repeat(count)}</div>
        </div>`;
    }

    loadProductCarousel(item) {
      const link = this.carouselLink(item);
      const container = this.preview.querySelector('[data-tp-products]');
      if (!link || !container) return;

      const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      const colourways = new Map(item.products.map((product) => [product.handle, product.colourway]));
      // Each product opens with its own colourway selected (Ancient kilt -> Ancient)
      const params = (handle) => {
        const colourway = this.config.enableColourways && isDrawable(item) ? colourways.get(handle) || 'modern' : 'modern';
        return `tartan=${encodeURIComponent(item.handle)}${colourway !== 'modern' ? `&colourway=${colourway}` : ''}`;
      };
      const track = container.querySelector('[data-tp-products-track]');
      const prev = container.querySelector('[data-tp-products-prev]');
      const next = container.querySelector('[data-tp-products-next]');

      const updateArrows = () => {
        const max = track.scrollWidth - track.clientWidth - 2;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= max;
        container.classList.toggle('tp-products--static', max <= 0);
      };
      const step = (direction) => track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.8, 160), behavior: 'smooth' });
      prev.addEventListener('click', () => step(-1));
      next.addEventListener('click', () => step(1));
      track.addEventListener('scroll', updateArrows, { passive: true });
      updateArrows();

      Promise.all(this.carouselProducts(item, link).map((product) => fetchProduct(root, product.handle))).then((products) => {
        if (this.previewItem !== item || !container.isConnected) return;
        const available = products.filter(Boolean);
        if (!available.length) {
          container.remove();
          return;
        }

        track.innerHTML = available.map((product) => {
          const onSale = product.compare_at_price_min > product.price_min;
          const image = product.featured_image;
          return `
            <a class="tp-product" href="${escapeHtml(`${root}products/${product.handle}?${params(product.handle)}`)}">
              <span class="tp-product__image">
                ${image ? `<img src="${escapeHtml(sizedImage(image, 400))}" srcset="${escapeHtml(sizedImage(image, 300))} 300w, ${escapeHtml(sizedImage(image, 600))} 600w" sizes="220px" alt="${escapeHtml(product.title)}" loading="lazy">` : ''}
                ${product.available ? '' : '<span class="tp-product__badge">Sold out</span>'}
              </span>
              <span class="tp-product__title">${escapeHtml(product.title)}</span>
              <span class="tp-product__price">${product.price_varies ? 'From ' : ''}${escapeHtml(formatMoney(product.price_min))}${onSale ? ` <s>${escapeHtml(formatMoney(product.compare_at_price_min))}</s>` : ''}</span>
            </a>`;
        }).join('');
        updateArrows();
      });
    }

    /**
     * "url" links: the fixed link + ?tartan=handle.
     * "tagged" links: products tagged "<tartan name> <tag word>", e.g. "MacDonald tartan".
     *   - Known products come from the library (docs/tools/map_tartan_products.py). The shopper's colourway is preferred.
     *   - One product: link straight to it (when "single_product" is on). Several: the collection filtered by the tag.
     *   - No known products: hidden when "hide_without_products" is on, otherwise the tag link (for newly tagged products).
     */
    shopLinkUrl(link, item) {
      const colourway = this.config.enableColourways && isDrawable(item) ? this.state.colourway : 'modern';
      const params = `tartan=${encodeURIComponent(item.handle)}${colourway && colourway !== 'modern' ? `&colourway=${colourway}` : ''}`;
      const withParams = (url) => `${url}${url.includes('?') ? '&' : '?'}${params}`;
      const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

      if (link.type !== 'tagged') {
        return link.url ? withParams(link.url) : '';
      }

      const products = Array.isArray(item.products) ? item.products : [];
      if (!products.length && link.hideWithoutProducts !== false) return '';

      let matches = products.filter((product) => product.colourway === colourway);
      if (!matches.length) matches = products.filter((product) => product.colourway === 'modern');
      if (!matches.length) matches = products;

      if (matches.length === 1 && link.singleProduct !== false) {
        return withParams(`${root}products/${matches[0].handle}`);
      }

      // Same as Shopify's handleize: lowercase, accents and apostrophes removed, other characters become hyphens
      const tag = `${item.name} ${link.tagWord || 'tartan'}`;
      const tagHandle = tag.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['\u2019]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return withParams(`${root}collections/${link.collection || 'all'}/${tagHandle}`);
    }

    setPageParam(key, value) {
      const url = new URL(window.location.href);
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
      window.history.replaceState(window.history.state, '', url.toString());
    }

    hidePreview(restoreScroll = true) {
      if (this.preview.hidden) return;

      this.preview.hidden = true;
      this.preview.innerHTML = '';
      this.results.hidden = false;
      this.alphabet.hidden = !this.config.showAlphabet;

      if (this.inline && this.config.urlParam) this.setPageParam('tartan', null);

      if (restoreScroll && this.scrollBeforePreview != null) this.scrollPos = this.scrollBeforePreview;
    }

    bindZoom(media) {
      if (!media || !media.classList.contains('tp-preview__media--zoomable')) return;

      const move = (event) => {
        if (!media.classList.contains('tp-preview__media--zoomed')) return;
        const rect = media.getBoundingClientRect();
        const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
        const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
        media.style.backgroundPosition = `${x}% ${y}%`;
      };

      media.addEventListener('click', (event) => {
        media.classList.toggle('tp-preview__media--zoomed');
        if (media.classList.contains('tp-preview__media--zoomed')) move(event);
        else media.style.backgroundPosition = '';
      });

      media.addEventListener('pointermove', move);
    }
  }

  window.customElements.define('tartan-picker', TartanPicker);

  /* ==========================================================================
     <tartan-finder> – the browser shown directly on a page
     ========================================================================== */

  class TartanFinder extends TartanPicker {
    connectedCallback() {
      if (this._connected) return;
      this._connected = true;

      try {
        this.config = JSON.parse(this.querySelector('script[data-tartan-config]').textContent);
      } catch (error) {
        console.error('Tartan finder: invalid configuration', error);
        return;
      }

      this.formId = null;
      this.colourway = COLOURWAYS.includes(this.config.defaultColourway) ? this.config.defaultColourway : 'modern';
      this.items = [];
      this.byHandle = new Map();
      this.selected = null;
      this.abort = new AbortController();

      this.observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.observer.disconnect();
          this.start();
        }
      }, { rootMargin: '400px 0px' });
      this.observer.observe(this);
    }

    async start() {
      const params = new URL(window.location.href).searchParams;

      await this.ensureData();
      this.querySelector('[data-tp-finder-loading]')?.remove();

      this.modal = new TartanModal(this, { inline: true });
      await this.modal.open(params.get('q') || '');

      if (!this.items.length) {
        this.modal.results.innerHTML = `<div class="tp-empty"><span>${escapeHtml(this.config.emptyText || this.config.noResultsText)}</span></div>`;
        return;
      }

      if (COLOURWAYS.includes(params.get('colourway'))) {
        this.modal.state.colourway = params.get('colourway');
        this.modal.syncColourwayToggle();
      }

      const handle = params.get('tartan');
      const item = handle && this.byHandle.get(handle);
      if (item) this.modal.showPreview(item);
    }

    // The finder never writes to a product form
    restoreSelection() {}
    renderInline() {}
    select(item) {
      this.modal?.showPreview(item);
    }

    onNoData() {}
  }

  window.customElements.define('tartan-finder', TartanFinder);
})();

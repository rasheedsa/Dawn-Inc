'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const frame = $('canvas');
  const pages = [...$('page').options].map(option => option.value);
  const root = new URL('../', location.href);
  const originals = new Map();
  const key = page => `dawn-visual-draft-v1:${page}`;
  let page = pages[0], selected = null, preview = false, ready = false;
  let history = [], redo = [], timer, generation = 0;
  let loadWarning = '';

  function status(message) { $('status').textContent = message; }
  function storedDraft(name) {
    try {
      const draft = JSON.parse(localStorage.getItem(key(name)));
      return draft && typeof draft.html === 'string' && typeof draft.base === 'string' ? draft : null;
    } catch { return null; }
  }
  async function source(name) {
    if (!originals.has(name)) {
      const response = await fetch(new URL(name, root), { cache: 'no-store' });
      if (!response.ok) throw new Error(`Cannot load ${name} (HTTP ${response.status}).`);
      originals.set(name, await response.text());
    }
    return originals.get(name);
  }
  function serialize() {
    const clone = frame.contentDocument.documentElement.cloneNode(true);
    clone.classList.remove('ve-preview');
    if (!clone.className) clone.removeAttribute('class');
    clone.querySelectorAll('#ve-style, #ve-base').forEach(node => node.remove());
    clone.querySelectorAll('[data-ve-editable], [data-ve-selected]').forEach(node => {
      node.removeAttribute('contenteditable');
      node.removeAttribute('data-ve-editable');
      node.removeAttribute('data-ve-selected');
    });
    clone.querySelectorAll('[data-ve-image-focus]').forEach(node => {
      node.removeAttribute('tabindex'); node.removeAttribute('data-ve-image-focus');
    });
    // Menu state is a preview detail, not a permanent website change.
    const nav = clone.querySelector('#mobile-navigation');
    if (nav) nav.hidden = true;
    const toggle = clone.querySelector('.menu-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    }
    return '<!DOCTYPE html>\n' + clone.outerHTML;
  }
  function updateHistoryButtons() {
    $('undo').disabled = !ready || history.length < 2;
    $('redo').disabled = !ready || !redo.length;
  }
  function persist(html) {
    try {
      localStorage.setItem(key(page), JSON.stringify({ html, base: originals.get(page), saved: Date.now() }));
      status('Draft saved in this browser · Not published.' + loadWarning);
    } catch {
      status('Browser storage is full or unavailable. Download your changes now; they are not saved.' + loadWarning);
    }
  }
  function flush() {
    clearTimeout(timer);
    if (!ready) return;
    const html = serialize();
    if (html === history[history.length - 1]) return;
    history.push(html);
    if (history.length > 60) history.shift();
    redo = [];
    persist(html);
    updateHistoryButtons();
  }
  function changed() {
    status('Unsaved changes…');
    clearTimeout(timer);
    timer = setTimeout(flush, 350);
  }
  function clearSelection() {
    frame.contentDocument.querySelectorAll('[data-ve-selected]').forEach(node => node.removeAttribute('data-ve-selected'));
    selected = null;
    $('selection-label').textContent = preview ? 'Preview mode. Return to editing to make changes.' : 'Click something in the page preview to edit it.';
    $('image-settings').hidden = true;
    $('link-settings').hidden = true;
  }
  function select(node) {
    clearSelection();
    if (!node || preview) return;
    selected = node;
    node.setAttribute('data-ve-selected', '');
    const image = node.tagName === 'IMG';
    $('selection-label').textContent = image ? 'Image selected. Update its description or replace it below.' : 'Text selected. Type directly on the page.';
    $('image-settings').hidden = !image;
    if (image) {
      $('image-alt').value = node.alt;
      const src = node.getAttribute('src') || '';
      $('image-url').value = src.startsWith('data:') ? '' : src;
      $('image-file').value = '';
    }
    const link = node.closest('a');
    $('link-settings').hidden = !link;
    if (link) $('link-url').value = link.getAttribute('href') || '';
  }
  function setMode() {
    if (!ready) return;
    frame.contentDocument.querySelectorAll('[data-ve-editable]').forEach(node => {
      if (preview) node.removeAttribute('contenteditable');
      else node.setAttribute('contenteditable', 'true');
    });
    frame.contentDocument.documentElement.classList.toggle('ve-preview', preview);
    $('preview').setAttribute('aria-pressed', String(preview));
    $('preview').textContent = preview ? 'Back to editing' : 'Preview';
    $('mode-label').textContent = preview ? 'Preview mode' : 'Edit mode';
    clearSelection();
  }
  function editKey(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? redoEdit() : undoEdit();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      downloadPage();
    }
  }
  function setupFrame() {
    const doc = frame.contentDocument;
    const style = doc.createElement('style');
    style.id = 've-style';
    style.textContent = ':root:not(.ve-preview) [data-ve-editable]:hover,:root:not(.ve-preview) img:hover{outline:2px dashed #6b9a80;outline-offset:3px;cursor:text}:root:not(.ve-preview) img:hover{cursor:pointer}[data-ve-selected]{outline:2px solid #bf6e38!important;outline-offset:4px}[contenteditable]:focus{outline:2px solid #bf6e38!important}';
    doc.head.append(style);
    doc.querySelectorAll('h1,h2,h3,h4,p,li,a,strong,em,span').forEach(node => {
      if (!node.textContent.trim() || node.closest('svg,script,style') || node.querySelector('img,h1,h2,h3,h4,p,li,svg,button')) return;
      node.setAttribute('data-ve-editable', '');
    });
    doc.querySelectorAll('img:not([tabindex])').forEach(node => {
      node.tabIndex = 0; node.setAttribute('data-ve-image-focus', '');
    });
    doc.addEventListener('focusin', event => {
      if (!preview) select(event.target.closest('img,[data-ve-editable]'));
    });
    doc.addEventListener('click', event => {
      const target = event.target;
      const menu = target.closest('.menu-toggle');
      if (menu) {
        event.preventDefault();
        const nav = doc.querySelector('#mobile-navigation');
        const open = menu.getAttribute('aria-expanded') !== 'true';
        nav.hidden = !open;
        menu.setAttribute('aria-expanded', String(open));
        return;
      }
      const anchor = target.closest('a');
      if (anchor) event.preventDefault();
      if (preview) {
        if (anchor) {
          const href = anchor.getAttribute('href');
          const url = new URL(href, new URL(page, root));
          const local = pages.find(name => new URL(name, root).href === url.href.split('#')[0]);
          if (local) {
            if (local === page && url.hash) doc.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
            else { $('page').value = local; loadPage(local, url.hash); }
          } else status('External links are disabled in preview. They work on the public website.');
        }
        return;
      }
      select(target.closest('img,[data-ve-editable]'));
    });
    doc.addEventListener('input', changed);
    doc.addEventListener('paste', event => {
      if (preview || !event.target.closest('[contenteditable]')) return;
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      const selection = frame.contentWindow.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = doc.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node); range.collapse(true);
      selection.removeAllRanges(); selection.addRange(range);
      changed();
    });
    doc.addEventListener('drop', event => event.preventDefault());
    doc.addEventListener('keydown', editKey);
    doc.addEventListener('submit', event => event.preventDefault());
    $('page-title').value = doc.title;
    $('page-description').value = doc.querySelector('meta[name="description"]')?.content || '';
    ready = true;
    frame.dataset.page = page;
    frame.setAttribute('aria-busy', 'false');
    setMode();
    updateHistoryButtons();
  }
  function render(html, scroll = 0) {
    ready = false;
    frame.setAttribute('aria-busy', 'true');
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const base = parsed.createElement('base');
    base.id = 've-base'; base.href = root.href;
    parsed.head.prepend(base);
    // The original runtime remains in exported HTML but is inert in the editor.
    frame.onload = () => {
      setupFrame();
      if (!history.length) history = [serialize()];
      updateHistoryButtons();
      frame.contentWindow.scrollTo(0, scroll);
    };
    frame.srcdoc = '<!DOCTYPE html>\n' + parsed.documentElement.outerHTML;
  }
  async function loadPage(name, hash = '') {
    flush();
    const token = ++generation;
    ready = false; updateHistoryButtons();
    frame.setAttribute('aria-busy', 'true');
    status('Loading page…');
    try {
      const html = await source(name);
      if (token !== generation) return;
      page = name; history = []; redo = []; selected = null;
      const draft = storedDraft(name);
      loadWarning = draft && draft.base !== html ? ' The published page has changed since this draft; compare it before publishing or discard the draft.' : '';
      $('page-label').textContent = $('page').selectedOptions[0].textContent;
      render(draft?.html || html);
      if (hash) {
        const loaded = frame.onload;
        frame.onload = () => { loaded(); frame.contentDocument.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView(); };
      }
      status((draft ? 'Local draft restored · Not published.' : 'Published page loaded. Click text or an image to begin.') + loadWarning);
    } catch (error) { frame.setAttribute('aria-busy', 'false'); status(error.message + ' Select a page to retry.'); }
  }
  function undoEdit() {
    flush();
    if (history.length < 2) return;
    redo.push(history.pop());
    const html = history[history.length - 1];
    persist(html); render(html, frame.contentWindow.scrollY);
  }
  function redoEdit() {
    flush();
    if (!redo.length) return;
    const html = redo.pop(); history.push(html);
    persist(html); render(html, frame.contentWindow.scrollY);
  }
  function safeURL(value, image = false) {
    const raw = value.trim();
    if (!raw || /[\u0000-\u0020]/.test(raw)) throw new Error('Use a URL without spaces; encode spaces as %20.');
    const url = new URL(raw, root);
    if (!(image ? ['https:', 'http:'] : ['https:', 'http:', 'mailto:', 'tel:']).includes(url.protocol)) throw new Error('This link type is not supported.');
    return raw;
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function downloadPage() {
    if (!ready) return status('Wait for the page to finish loading.');
    flush();
    download(new Blob([serialize()], { type: 'text/html;charset=utf-8' }), page);
    $('download-status').textContent = `Downloaded ${page}. Upload it to docs in GitHub to publish.`;
  }

  // Standards-based, uncompressed ZIP: no external libraries, services or accounts.
  function zip(files) {
    const encoder = new TextEncoder(), local = [], central = [];
    let offset = 0, size = 0;
    const write = (length, fields) => {
      const bytes = new Uint8Array(length), view = new DataView(bytes.buffer);
      for (const [at, value, width] of fields) width === 2 ? view.setUint16(at, value, true) : view.setUint32(at, value, true);
      return bytes;
    };
    for (const [path, bytes] of files) {
      const name = encoder.encode(path);
      let crc = 0xffffffff;
      for (const byte of bytes) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      const head = write(30, [[0,0x04034b50,4],[4,20,2],[6,0x800,2],[12,33,2],[14,crc,4],[18,bytes.length,4],[22,bytes.length,4],[26,name.length,2]]);
      const entry = write(46, [[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[14,33,2],[16,crc,4],[20,bytes.length,4],[24,bytes.length,4],[28,name.length,2],[42,offset,4]]);
      local.push(head, name, bytes); central.push(entry, name);
      offset += head.length + name.length + bytes.length;
      size += entry.length + name.length;
    }
    const end = write(22, [[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,size,4],[16,offset,4]]);
    return new Blob([...local, ...central, end], { type: 'application/zip' });
  }
  async function downloadSite() {
    if (!ready) return;
    flush(); $('download-site').disabled = true;
    $('download-status').textContent = 'Preparing website backup…';
    try {
      const assets = ['.nojekyll','favicon.svg','assets/original.css','assets/enhancements.css','assets/site.js','images/dawn-logo.jpg','images/dawn-sunset-tree.webp','images/jacqueline-grant-portrait.webp','editor/index.html','editor/editor.css','editor/editor.js'];
      const encoder = new TextEncoder();
      const files = await Promise.all([...pages, ...assets].map(async name => {
        if (pages.includes(name)) return ['docs/' + name, encoder.encode(name === page ? serialize() : storedDraft(name)?.html || await source(name))];
        const response = await fetch(new URL(name, root));
        if (!response.ok) throw new Error(`Cannot include ${name}: HTTP ${response.status}`);
        return ['docs/' + name, new Uint8Array(await response.arrayBuffer())];
      }));
      download(zip(files), 'dawn-website.zip');
      $('download-status').textContent = 'Website ZIP downloaded. Extract it before uploading the files to GitHub.';
    } catch (error) { $('download-status').textContent = error.message + ' You can still download this page separately.'; }
    finally { $('download-site').disabled = false; }
  }
  $('page').addEventListener('change', event => loadPage(event.target.value));
  $('undo').addEventListener('click', undoEdit);
  $('redo').addEventListener('click', redoEdit);
  $('preview').addEventListener('click', () => { flush(); preview = !preview; setMode(); });
  for (const id of ['desktop', 'mobile']) $(id).addEventListener('click', () => {
    $('frame-wrap').classList.toggle('mobile', id === 'mobile');
    $('desktop').setAttribute('aria-pressed', String(id === 'desktop'));
    $('mobile').setAttribute('aria-pressed', String(id === 'mobile'));
  });
  $('page-title').addEventListener('input', event => { if (ready) { frame.contentDocument.title = event.target.value; changed(); } });
  $('page-description').addEventListener('input', event => {
    if (!ready) return;
    const doc = frame.contentDocument;
    let meta = doc.querySelector('meta[name="description"]');
    if (!meta) { meta = doc.createElement('meta'); meta.name = 'description'; doc.head.append(meta); }
    meta.content = event.target.value; changed();
  });
  $('image-alt').addEventListener('input', event => { if (selected?.tagName === 'IMG') { selected.alt = event.target.value; changed(); } });
  $('apply-image').addEventListener('click', async () => {
    if (selected?.tagName !== 'IMG') return;
    const image = selected;
    try {
      const url = safeURL($('image-url').value, true);
      const probe = new Image(); probe.src = new URL(url, root).href;
      await probe.decode();
      if (!ready || image.ownerDocument !== frame.contentDocument) return;
      image.setAttribute('src', url); image.removeAttribute('srcset'); changed();
    } catch (error) { status(error.message.startsWith('Use ') || error.message.startsWith('This link') ? error.message : 'The image could not be loaded. Check the URL or upload an image.'); }
  });
  $('image-file').addEventListener('change', async event => {
    const file = event.target.files[0], image = selected;
    if (!file || image?.tagName !== 'IMG') return;
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 2 * 1024 * 1024) return status('Choose a JPG, PNG, WebP or GIF smaller than 2 MB.');
    try {
      const bitmap = await createImageBitmap(file); bitmap.close();
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      if (!ready || image.ownerDocument !== frame.contentDocument) return;
      image.src = data; image.removeAttribute('srcset');
      $('image-url').value = ''; changed();
    } catch { status('This image could not be opened. Try another image.'); }
  });
  $('apply-link').addEventListener('click', () => {
    const link = selected?.closest('a');
    if (!link) return;
    try { link.setAttribute('href', safeURL($('link-url').value)); changed(); }
    catch (error) { status(error.message); }
  });
  $('reset').addEventListener('click', () => {
    if (!ready || !confirm('Discard this page’s local draft and reload the published page? Download a backup first if you want to keep it.')) return;
    clearTimeout(timer);
    try { localStorage.removeItem(key(page)); }
    catch { return status('Browser storage is unavailable. The stored draft could not be removed.'); }
    ready = false; originals.delete(page); loadPage(page);
  });
  $('publish').addEventListener('click', () => { flush(); $('download-status').textContent = ''; $('publish-dialog').showModal(); });
  $('close-dialog').addEventListener('click', () => $('publish-dialog').close());
  $('download-page').addEventListener('click', downloadPage);
  $('download-site').addEventListener('click', downloadSite);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  loadPage(page);
})();

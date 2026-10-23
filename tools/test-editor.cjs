const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../docs');
const server = http.createServer((request, response) => {
  let name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (!name.startsWith('/Dawn-Inc/')) { response.writeHead(404).end(); return; }
  name = name.slice('/Dawn-Inc/'.length);
  if (!name || name.endsWith('/')) name += 'index.html';
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { response.writeHead(404).end(); return; }
  const type = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.webp':'image/webp' }[path.extname(file)] || 'application/octet-stream';
  response.setHeader('Content-Type', type);
  response.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/Dawn-Inc/`;
  const browser = await chromium.launch({ headless:true, ...(fs.existsSync('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium'} : {}), args:['--no-sandbox'] });
  const page = await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const frame = page.frameLocator('#canvas');
  const ready = async () => {
    await frame.locator('h1').waitFor();
    await page.waitForFunction(() => {
      const canvas=document.querySelector('#canvas');
      return canvas.getAttribute('aria-busy')==='false' && canvas.dataset.page===document.querySelector('#page').value && canvas.contentDocument.querySelector('[data-ve-editable]');
    });
  };
  try {
    await page.goto(url+'editor/'); await ready();
    assert.match(await frame.locator('h1').innerText(), /A place to belong/);
    assert.equal(await page.locator('#font-family').isDisabled(),true);
    const paragraph = frame.locator('.hero-description');
    await paragraph.click();
    await page.locator('#font-family').selectOption('Georgia, serif');
    await page.locator('#font-size').fill('24'); await page.locator('#font-size').press('Tab');
    await page.locator('#font-colour').evaluate(el=>{el.value='#803322';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#format-bold').click();
    await page.locator('#format-italic').click();
    await page.locator('#format-underline').click();
    await page.locator('#align-center').click();
    const formatting = await paragraph.evaluate(el=>({font:el.style.fontFamily,size:el.style.fontSize,colour:el.style.color,bold:el.style.fontWeight,italic:el.style.fontStyle,underline:el.style.textDecoration,align:el.style.textAlign}));
    assert.deepEqual(formatting,{font:'Georgia, serif',size:'24px',colour:'rgb(128, 51, 34)',bold:'700',italic:'italic',underline:'underline',align:'center'});
    await page.locator('#undo').click(); await ready();
    assert.equal(await paragraph.evaluate(el=>el.style.textAlign),'');
    await page.locator('#redo').click(); await ready();
    assert.equal(await paragraph.evaluate(el=>el.style.textAlign),'center');
    await page.reload(); await ready();
    assert.equal(await paragraph.evaluate(el=>el.style.fontSize),'24px');
    await paragraph.click(); await page.locator('#clear-format').click();
    assert.equal(await paragraph.getAttribute('style'),null);
    await page.locator('#font-size').fill('200'); await page.locator('#font-size').press('Tab');
    assert.match(await page.locator('#status').innerText(),/8 to 120/);
    assert.equal(await paragraph.evaluate(el=>el.style.fontSize),'');
    console.log('PASS block fonts, sizes, colour, styles, alignment, undo/redo, reload, reset and size validation');

    await paragraph.evaluate(el=>{
      const range=el.ownerDocument.createRange();range.setStart(el.firstChild,0);range.setEnd(el.firstChild,14);
      const selection=el.ownerDocument.defaultView.getSelection();selection.removeAllRanges();selection.addRange(range);
      el.ownerDocument.dispatchEvent(new Event('selectionchange'));
    });
    await page.locator('#format-bold').click();
    assert.equal(await paragraph.locator('span').evaluate(el=>el.style.fontWeight),'700');
    await page.locator('#format-bold').click();
    assert.equal(await paragraph.locator('span').evaluate(el=>el.style.fontWeight),'400');
    await page.locator('#format-bold').click();
    await page.locator('#format-italic').click();
    await page.locator('#format-underline').click();
    await page.locator('#format-underline').click();
    await page.locator('#font-family').selectOption('Verdana, sans-serif');
    await page.locator('#font-size').fill('26'); await page.locator('#font-size').press('Tab');
    assert.equal(await paragraph.locator('span').count(),1);
    assert.equal(await paragraph.locator('span').evaluate(el=>el.style.fontSize),'26px');
    assert.equal(await paragraph.locator('span').evaluate(el=>el.style.textDecoration),'none');
    assert.equal(await paragraph.evaluate(el=>el.style.fontSize),'');
    console.log('PASS highlighted word formatting, toggles and selection preservation across toolbar controls');
    await frame.locator('h1').click();
    await frame.locator('h1').fill('A brighter day starts here.');
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Draft saved'));
    assert.equal(await page.locator('#undo').isEnabled(), true);
    await page.locator('#undo').click(); await ready();
    assert.match(await frame.locator('h1').innerText(), /A place to belong/);
    await page.locator('#redo').click(); await ready();
    assert.equal(await frame.locator('h1').innerText(), 'A brighter day starts here.');
    console.log('PASS direct text editing, autosave, undo and redo');

    await page.reload(); await ready();
    assert.equal(await frame.locator('h1').innerText(), 'A brighter day starts here.');
    await page.locator('#page').selectOption('about.html'); await ready();
    await frame.locator('h1').fill('Support shaped around you.');
    await page.locator('#page').selectOption('index.html'); await ready();
    assert.equal(await frame.locator('h1').innerText(), 'A brighter day starts here.');
    console.log('PASS reload recovery and independent page drafts');

    await frame.locator('.community-image').click();
    assert.equal(await page.locator('#font-family').isDisabled(),true);
    await page.locator('#image-alt').fill('A new image description');
    await page.locator('#image-file').setInputFiles(path.join(root,'images/dawn-logo.jpg'));
    await page.waitForFunction(() => document.querySelector('#canvas').contentDocument.querySelector('.community-image').src.startsWith('data:image/jpeg'));
    await frame.getByRole('link',{name:'Explore our services',exact:true}).click();
    await page.locator('#link-url').fill('javascript:alert(1)'); await page.locator('#apply-link').click();
    assert.match(await page.locator('#status').innerText(), /not supported/);
    await page.locator('#link-url').fill('contact-us.html'); await page.locator('#apply-link').click();
    assert.equal(await frame.getByRole('link',{name:'Explore our services',exact:true}).getAttribute('href'), 'contact-us.html');
    console.log('PASS image upload, alt text, link edits and unsafe URL rejection');

    await page.locator('summary').click();
    await page.locator('#page-title').fill('Dawn visual editor test');
    await page.locator('#page-description').fill('Updated description.');
    await page.locator('#mobile').click();
    await page.waitForFunction(() => Math.round(document.querySelector('#frame-wrap').getBoundingClientRect().width) === 390);
    assert.equal(await page.locator('#frame-wrap').evaluate(el=>Math.round(el.getBoundingClientRect().width)),390);
    await page.locator('#preview').click();
    assert.equal(await frame.locator('[contenteditable]').count(),0);
    await frame.locator('.menu-toggle').click();
    assert.equal(await frame.locator('#mobile-navigation').isVisible(),true);
    await page.locator('#preview').click();
    console.log('PASS metadata editing, mobile preview and mobile menu');

    await page.locator('#publish').click();
    const [download] = await Promise.all([page.waitForEvent('download'),page.locator('#download-page').click()]);
    assert.equal(download.suggestedFilename(),'index.html');
    const exported = fs.readFileSync(await download.path(),'utf8');
    assert.match(exported,/A brighter day starts here/);
    assert.match(exported,/Dawn visual editor test/);
    assert.match(exported,/Updated description/);
    assert.match(exported,/data:image\/jpeg;base64/);
    assert.match(exported,/A new image description/);
    assert.match(exported,/assets\/site.js/);
    assert.match(exported,/font-family: Verdana, sans-serif/);
    assert.match(exported,/font-size: 26px/);
    assert.match(exported,/font-weight: 700/);
    assert.doesNotMatch(exported,/data-ve-|contenteditable|ve-base|ve-style|ve-preview/);
    const [backup] = await Promise.all([page.waitForEvent('download'),page.locator('#download-site').click()]);
    const backupPath = path.join(os.tmpdir(),'dawn-editor-test.zip');
    await backup.saveAs(backupPath);
    const {execFileSync} = require('node:child_process');
    execFileSync('python3',['-c',`from zipfile import ZipFile\nwith ZipFile(${JSON.stringify(backupPath)}) as z:\n assert z.testzip() is None\n assert len(z.namelist()) == 17\n assert 'Support shaped around you.' in z.read('docs/about.html').decode()\n assert 'A brighter day starts here.' in z.read('docs/index.html').decode()\n assert 'docs/editor/editor.js' in z.namelist()\n`]);
    console.log('PASS clean HTML export, complete ZIP integrity and cross-page draft backup');
    await page.locator('#close-dialog').click();

    await page.evaluate(() => { const key='dawn-visual-draft-v1:index.html';const draft=JSON.parse(localStorage.getItem(key));draft.base='old version';localStorage.setItem(key,JSON.stringify(draft)); });
    await page.reload(); await ready();
    assert.match(await page.locator('#status').innerText(),/published page has changed/);
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#reset').click(); await ready();
    await page.waitForFunction(() => document.querySelector('#canvas').contentDocument.querySelector('h1').textContent.includes('A place to belong'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('dawn-visual-draft-v1:index.html')),null);
    console.log('PASS stale draft warning and confirmed draft discard');

    await page.route('**/contact-us.html',route=>route.fulfill({status:503,body:'Unavailable'}));
    await page.locator('#page').selectOption('contact-us.html');
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('HTTP 503'));
    await page.unroute('**/contact-us.html');
    await page.locator('#page').selectOption('index.html'); await ready();
    for (const name of ['our-services.html','about.html','contact-us.html','privacy.html','accessibility.html','index.html']) {
      await page.locator('#page').selectOption(name); await ready();
      assert.equal(await frame.locator('h1').count(),1);
      assert.equal(await frame.getByRole('link',{name:'Edit website',exact:true}).count(),1);
    }
    console.log('PASS failed page load recovery and all six editor pages');

    await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Storage unavailable','QuotaExceededError')};});
    await frame.locator('h1').fill('This edit can still be downloaded.');
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('storage is full or unavailable'));
    await page.locator('#publish').click();
    const [unsaved] = await Promise.all([page.waitForEvent('download'),page.locator('#download-page').click()]);
    assert.match(fs.readFileSync(await unsaved.path(),'utf8'),/This edit can still be downloaded/);
    await page.locator('#close-dialog').click();
    console.log('PASS honest storage failure warning and unsaved draft export');

    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(os.tmpdir(),'dawn-editor-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:path.join(os.tmpdir(),'dawn-editor-desktop.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS responsive editor layout and no JavaScript errors');
  } finally { await browser.close(); }
})().then(()=>server.close(),error=>{console.error(error);server.close();process.exitCode=1});

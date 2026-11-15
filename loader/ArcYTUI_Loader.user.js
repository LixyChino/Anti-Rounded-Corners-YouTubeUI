// ==UserScript==
// @name         ArcYTUI Loader
// @namespace    https://github.com/LixyChino/Anti-Rounded-Corners-YouTubeUI
// @version      0.1.0
// @description  ArcYTUI scripts loader and settings page
// @author       LixyChino
// @match        https://m.youtube.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @connect      arcytui.lixy548.com
// ==/UserScript==

(() => {
  'use strict';

  const LOADER_VERSION = '0.1.0';
  const MANIFEST_URL = 'https://arcytui.lixy548.com/bin/script/manifest.json';
  const SETTINGS_PATH = '/arcytui/settings';
  const REPOSITORY_URL = 'https://github.com/LixyChino/Anti-Rounded-Corners-YouTubeUI';
  const CACHE_PREFIX = 'arcytui:source:';
  const PREFS_KEY = 'arcytui:preferences';
  const PAGE_ID = 'arcytui-loader-settings';
  const STYLE_ID = 'arcytui-loader-style';

  let manifest = null;
  let settingsVisible = false;
  let expanded = false;
  let originalTitle = document.title;

  const gmGet = (key, fallback = null) => {
    try { return GM_getValue(key, fallback); } catch { return fallback; }
  };
  const gmSet = (key, value) => {
    try { GM_setValue(key, value); } catch (error) { console.error('[ArcYTUI Loader] storage error', error); }
  };
  const gmDelete = (key) => {
    try { GM_deleteValue(key); } catch {}
  };
  const gmRequest = (url) => new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      timeout: 20000,
      headers: { 'Cache-Control': 'no-cache' },
      onload: response => {
        if (response.status >= 200 && response.status < 300) resolve(response.responseText);
        else reject(new Error('HTTP ' + response.status + ': ' + url));
      },
      onerror: () => reject(new Error('Network error: ' + url)),
      ontimeout: () => reject(new Error('Request timeout: ' + url))
    });
  });

  const readPrefs = () => gmGet(PREFS_KEY, {});
  const writePrefs = (prefs) => gmSet(PREFS_KEY, prefs);
  const scriptId = (script) => String(script.name || '').replace(/^ArcYTUI_/, '');

  function isScriptAvailable(script) {
    return script && script.enabled === true && script.selectable !== false && script.status !== 'development';
  }

  function isVersionAvailable(version) {
    return version && version.enabled === true && version.selectable !== false && typeof version.url === 'string';
  }

  function compareVersions(a, b) {
    const aa = String(a || '').split('.').map(Number);
    const bb = String(b || '').split('.').map(Number);
    for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
      const d = (aa[i] || 0) - (bb[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  function selectedVersion(script) {
    if (!isScriptAvailable(script)) return null;
    const prefs = readPrefs();
    const override = prefs[script.name] || {};
    const target = override.followLatest === false ? override.version : script.latest;
    if (!target) return null;
    return (script.versions || []).find(v => v.version === target && isVersionAvailable(v)) || null;
  }

  async function loadManifest(force = false) {
    const cached = gmGet('arcytui:manifest');
    const checkedAt = gmGet('arcytui:manifest:checked', 0);
    if (!force && cached && Date.now() - checkedAt < 5 * 60 * 1000) {
      manifest = cached;
      return cached;
    }
    const raw = await gmRequest(MANIFEST_URL);
    const parsed = JSON.parse(raw);
    if (parsed.schema_version !== 2 || !Array.isArray(parsed.scripts)) {
      throw new Error('Unsupported manifest schema');
    }
    manifest = parsed;
    gmSet('arcytui:manifest', parsed);
    gmSet('arcytui:manifest:checked', Date.now());
    return parsed;
  }

  async function getSource(version) {
    const key = CACHE_PREFIX + version.url;
    const cached = gmGet(key);
    if (cached) return cached;
    const source = await gmRequest(version.url);
    gmSet(key, source);
    return source;
  }

  // Page-context execution is deliberately isolated from GM APIs. Existing child
  // scripts that require GM_* APIs or @require need a compatibility adapter before
  // they can be enabled through this loader.
  function executeInPage(source, scriptName, version) {
    const clean = source.replace(/^\\uFEFF/, '').replace(/^\s*\/\/ ==UserScript==[\s\S]*?^\s*\/\/ ==\/UserScript==\s*/m, '');
    const tag = document.createElement('script');
    tag.dataset.arcytui = scriptName;
    tag.dataset.version = version;
    tag.textContent = clean + '\n//# sourceURL=arcytui/' + encodeURIComponent(scriptName) + '/' + encodeURIComponent(version) + '.user.js';
    (document.head || document.documentElement).appendChild(tag);
    tag.remove();
  }

  async function startScripts() {
    const data = manifest || await loadManifest();
    for (const script of data.scripts) {
      const version = selectedVersion(script);
      if (!version) continue;
      try {
        const source = await getSource(version);
        executeInPage(source, script.name, version.version);
      } catch (error) {
        console.error('[ArcYTUI Loader] Failed to load ' + script.name, error);
      }
    }
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PAGE_ID}{position:fixed;inset:0;z-index:2147483000;background:#0f0f0f;color:#f1f1f1;font:14px Roboto,Arial,sans-serif;overflow:auto}
      #${PAGE_ID} *{box-sizing:border-box}
      #${PAGE_ID} .arc-header{height:56px;display:flex;align-items:center;gap:24px;padding:0 16px;border-bottom:1px solid #303030}
      #${PAGE_ID} button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
      #${PAGE_ID} .arc-back{font-size:26px;width:32px}
      #${PAGE_ID} .arc-title{font-size:18px;font-weight:600}
      #${PAGE_ID} .arc-content{max-width:760px;margin:0 auto;padding:8px 0 40px}
      #${PAGE_ID} .arc-row{min-height:64px;padding:0 24px;display:flex;align-items:center;gap:24px;border-bottom:1px solid #272727}
      #${PAGE_ID} .arc-row-main{flex:1;min-width:0}
      #${PAGE_ID} .arc-row-title{font-size:16px}
      #${PAGE_ID} .arc-sub{color:#aaa;font-size:13px;margin-top:5px}
      #${PAGE_ID} .arc-chevron{font-size:20px;color:#aaa}
      #${PAGE_ID} .arc-list{padding:0 24px 12px 72px}
      #${PAGE_ID} .arc-script{padding:12px 0;border-bottom:1px solid #272727}
      #${PAGE_ID} .arc-script-head{display:flex;align-items:center;gap:12px}
      #${PAGE_ID} .arc-script-name{flex:1}
      #${PAGE_ID} .arc-muted{color:#aaa;font-size:12px;margin-top:5px}
      #${PAGE_ID} .arc-pill{font-size:12px;color:#aaa}
      #${PAGE_ID} .arc-error{color:#ff8a80;padding:16px 24px}
      #${PAGE_ID} a{color:#8ab4f8;text-decoration:none}
      #${PAGE_ID} a:focus-visible,#${PAGE_ID} button:focus-visible{outline:2px solid #8ab4f8;outline-offset:3px}
      @media(max-width:600px){#${PAGE_ID} .arc-content{width:100%}#${PAGE_ID} .arc-row{padding:0 16px}#${PAGE_ID} .arc-list{padding-left:56px;padding-right:16px}}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function renderSettings(error = '') {
    if (!settingsVisible) return;
    addStyle();
    let root = document.getElementById(PAGE_ID);
    if (!root) {
      root = document.createElement('section');
      root.id = PAGE_ID;
      root.setAttribute('aria-label', 'ArcYTUI settings');
      document.documentElement.appendChild(root);
    }
    const scripts = manifest?.scripts || [];
    const scriptRows = scripts.map(script => {
      const version = selectedVersion(script);
      const available = isScriptAvailable(script);
      const reason = script.reason || (!available && script.status === 'development' ? '開発中のため利用できません' : '');
      return `<div class="arc-script">
        <div class="arc-script-head"><div class="arc-script-name">${escapeHtml(script.name || 'Unknown')}</div><span class="arc-pill">${available ? (version ? '有効' : '利用不可') : '無効'}</span></div>
        <div class="arc-muted">${escapeHtml(version ? 'Version ' + version.version : reason || '利用可能なバージョンがありません')}</div>
      </div>`;
    }).join('');
    root.innerHTML = `
      <header class="arc-header">
        <button class="arc-back" type="button" aria-label="戻る">‹</button>
        <div class="arc-title">ArcYTUIの設定</div>
      </header>
      <main class="arc-content">
        <button class="arc-row" id="arc-script-toggle" type="button" aria-expanded="${expanded}">
          <span class="arc-row-main"><span class="arc-row-title">スクリプト</span><span class="arc-sub">${scripts.length} scripts</span></span>
          <span class="arc-chevron">${expanded ? '⌃' : '›'}</span>
        </button>
        ${expanded ? '<div class="arc-list">' + (scriptRows || '<div class="arc-muted">スクリプトがありません</div>') + '</div>' : ''}
        <div class="arc-row"><div class="arc-row-main"><div class="arc-row-title">ArcYTUIのバージョン</div><div class="arc-sub">Loader　v${LOADER_VERSION}</div><div class="arc-sub" id="arcytui-css-version"></div></div></div>
        <a class="arc-row" href="${REPOSITORY_URL}" target="_blank" rel="noopener noreferrer"><span class="arc-row-main"><span class="arc-row-title">ArcYTUIのページへ</span></span><span class="arc-chevron">↗</span></a>
        ${error ? '<div class="arc-error">' + escapeHtml(error) + '</div>' : ''}
      </main>`;
    root.querySelector('.arc-back')?.addEventListener('click', closeSettings);
    root.querySelector('#arc-script-toggle')?.addEventListener('click', () => { expanded = !expanded; renderSettings(); });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function openSettings(push = true) {
    if (settingsVisible) return;
    if (push && location.pathname !== SETTINGS_PATH) history.pushState({ arcytuiSettings: true }, '', SETTINGS_PATH);
    settingsVisible = true;
    originalTitle = document.title;
    document.title = 'ArcYTUIの設定';
    document.documentElement.style.overflow = 'hidden';
    renderSettings();
    loadManifest(true).then(() => renderSettings()).catch(error => renderSettings('manifest.jsonを読み込めませんでした: ' + error.message));
  }

  function closeSettings() {
    if (location.pathname === SETTINGS_PATH) {
      history.back();
      return;
    }
    hideSettings();
  }

  function hideSettings() {
    settingsVisible = false;
    document.getElementById(PAGE_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.documentElement.style.overflow = '';
    document.title = originalTitle;
  }

  function handleRoute() {
    if (location.pathname === SETTINGS_PATH) openSettings(false);
    else if (settingsVisible) hideSettings();
  }

  function installEntryPoint() {
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-arcytui-entry]')) return;
      const candidates = [...document.querySelectorAll('a,ytm-menu-item,button')];
      const membership = candidates.find(el => /購入とメンバーシップ/.test(el.textContent || ''));
      if (!membership) return;
      const row = document.createElement('a');
      row.href = SETTINGS_PATH;
      row.dataset.arcytuiEntry = 'true';
      row.textContent = 'ArcYTUIの設定';
      row.style.cssText = 'display:flex;align-items:center;min-height:48px;padding:0 16px;color:inherit;text-decoration:none;font:inherit';
      row.addEventListener('click', event => {
        event.preventDefault();
        openSettings(true);
      });
      membership.parentElement?.insertAdjacentElement('afterend', row);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('popstate', handleRoute);
  window.addEventListener('yt-navigate-finish', handleRoute);
  if (location.pathname === SETTINGS_PATH) openSettings(false);
  else installEntryPoint();

  // Do not run child scripts on the settings route.
  if (location.pathname !== SETTINGS_PATH) {
    loadManifest().then(startScripts).catch(error => console.error('[ArcYTUI Loader] manifest error', error));
  }
})();

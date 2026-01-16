/* src/index.js — EthnoMusic Lab GY (RESTORE + FIXES, minimal & compatible)
   Goals:
   ✅ Stop 404-driven “nothing works” (correct entry expectations)
   ✅ Do NOT rewrite your app logic — just bootstrap safely
   ✅ Ensure required globals exist: analyzeAudioFile, initializeWorldMap/initWorldMap hooks, etc.
   ✅ Prevent duplicate listeners + DOM wipes
   ✅ Work with your existing files:
      utils/, advancedFeatures.js, audioAnalyzer.js, culturesData.js, expandedCultures.js,
      extendedFeatures.js, games.js, genreMLModel.js, indigenousTrainer.js, mlTrainer.js,
      trainerUI.js, etc.
*/
// Import CSS to be extracted by MiniCssExtractPlugin
import './styles.css';

// Import modules to ensure they register their global functions
import { initializeWorldMap, displayGlossary } from './advancedFeatures.js';
import { analyzeAudioFile } from './audioAnalyzer.js';

// Ensure functions are available on window immediately after import
window.initializeWorldMap = window.initializeWorldMap || initializeWorldMap;
window.displayGlossary = window.displayGlossary || displayGlossary;
window.analyzeAudioFile = window.analyzeAudioFile || analyzeAudioFile;

'use strict';

/* ---------------------------
   Helpers
--------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function on(el, ev, fn, opts) {
  if (!el) return;
  el.addEventListener(ev, fn, opts);
}

function show(el, display = 'block') { if (el) el.style.display = display; }
function hide(el) { if (el) el.style.display = 'none'; }

function safeCall(fn, ...args) {
  try { return typeof fn === 'function' ? fn(...args) : undefined; }
  catch (e) { console.error(e); return undefined; }
}

/* ---------------------------
   Global AudioContext + master gain
   (keeps your classroom-mode cap working)
--------------------------- */
window.audioContext = window.audioContext || null;

function ensureAudioContext() {
  if (!window.audioContext) {
    window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Create master gain once
  if (!window.__MASTER_GAIN) {
    try {
      const g = window.audioContext.createGain();
      g.gain.value = 0.35;
      g.connect(window.audioContext.destination);
      window.__MASTER_GAIN = g;
    } catch (e) {
      console.warn('Master gain creation failed:', e);
    }
  }
  return window.audioContext;
}

async function resumeAudio() {
  const ctx = ensureAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

/* ---------------------------
   Tabs (show/hide panels properly)
--------------------------- */
function initializeTabs() {
  const tabButtons = $$('.tab-btn');
  const tabPanels = $$('.tab-content');
  if (!tabButtons.length || !tabPanels.length) return;

  function activateTab(name) {
    tabButtons.forEach(btn => {
      const active = btn.dataset.tab === name;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    tabPanels.forEach(panel => {
      const active = panel.id === `${name}-tab`;
      panel.classList.toggle('active', active);
      panel.style.display = active ? 'block' : 'none';
    });

    // Leaflet needs a resize after becoming visible
    if (name === 'explore') {
      setTimeout(() => safeCall(window.__WORLD_MAP?.invalidateSize?.bind(window.__WORLD_MAP)), 150);
      setTimeout(() => safeCall(window.__WORLD_MAP?.invalidateSize?.bind(window.__WORLD_MAP)), 600);
    }
  }

  tabButtons.forEach(btn => on(btn, 'click', () => activateTab(btn.dataset.tab)));

  // On load, enforce only active tab visible
  const activeBtn = tabButtons.find(b => b.classList.contains('active')) || tabButtons[0];
  if (activeBtn) activateTab(activeBtn.dataset.tab);
}

/* ---------------------------
   Accessibility menu
--------------------------- */
function initializeAccessibilityMenu() {
  const toggle = $('#accessibility-menu-toggle');
  const menu = $('#accessibility-menu');
  if (!toggle || !menu) return;

  // default hidden
  if (!menu.style.display) menu.style.display = 'none';

  on(toggle, 'click', (e) => {
    e.stopPropagation();
    const open = menu.style.display !== 'none';
    menu.style.display = open ? 'none' : 'grid';
    toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
  });

  on(document, 'click', (e) => {
    if (menu.style.display === 'none') return;
    if (!menu.contains(e.target) && !toggle.contains(e.target)) {
      menu.style.display = 'none';
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ---------------------------
   Dark mode (menu + FAB)
--------------------------- */
function initializeDarkMode() {
  const btnMenu = $('#dark-mode-toggle-menu');
  const btnFab = $('#dark-mode-toggle-fab');

  let isDark = localStorage.getItem('darkMode') === 'true';

  function apply() {
    document.body.classList.toggle('dark-mode', isDark);
    if (btnMenu) btnMenu.innerHTML = isDark ? '<span>☀️</span> Light Mode' : '<span>🌙</span> Dark Mode';
    if (btnFab) btnFab.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('darkMode', String(isDark));
  }

  on(btnMenu, 'click', () => { isDark = !isDark; apply(); });
  on(btnFab, 'click', () => { isDark = !isDark; apply(); });

  apply();
}

/* ---------------------------
   Classroom mode (volume cap)
--------------------------- */
function initializeClassroomMode() {
  const toggle = $('#classroom-mode-toggle');
  let enabled = localStorage.getItem('classroomMode') === 'true';

  function apply() {
    document.body.classList.toggle('classroom-mode', enabled);
    if (window.__MASTER_GAIN) window.__MASTER_GAIN.gain.value = enabled ? 0.18 : 0.35;

    // keep your UI label simple
    if (toggle) toggle.textContent = enabled ? '🏫 On' : '🏫 Classroom Mode';
    localStorage.setItem('classroomMode', String(enabled));
  }

  on(toggle, 'click', () => { enabled = !enabled; apply(); });
  apply();
}

/* ---------------------------
   Audio unlock overlay (Safari/iOS autoplay)
--------------------------- */
function initializeAudioUnlockOverlay() {
  const overlay = $('#audio-unlock-overlay');
  const btn = $('#audio-unlock-button');
  const status = $('#audio-status');
  if (!overlay || !btn) return;

  // Show overlay until user taps once (safe for mobile)
  overlay.style.display = 'flex';

  on(btn, 'click', async () => {
    try {
      if (status) status.textContent = 'Unlocking audio…';
      await resumeAudio();
      overlay.style.display = 'none';
      if (status) status.textContent = '';
    } catch (e) {
      console.error(e);
      if (status) status.textContent = 'Could not enable audio. Try again.';
    }
  });
}

/* ---------------------------
   World map hook
   Your other scripts should define one of these:
   - window.initializeWorldMap()
   - window.initWorldMap()
   If they return/assign a Leaflet map, keep it in window.__WORLD_MAP
--------------------------- */
function initializeWorldMapSafe() {
  const mapEl = $('#world-map');
  if (!mapEl) return;

  try {
    if (typeof window.initializeWorldMap === 'function') {
      const m = window.initializeWorldMap();
      if (m) window.__WORLD_MAP = m;
    } else if (typeof window.initWorldMap === 'function') {
      const m = window.initWorldMap();
      if (m) window.__WORLD_MAP = m;
    } else {
      // Don’t hard-fail — just warn (your old app may init elsewhere)
      console.warn('No world map initializer found (initializeWorldMap / initWorldMap).');
    }
  } catch (e) {
    console.error('World map init failed:', e);
    mapEl.innerHTML =
      '<p style="padding:14px;background:#ffebee;border-left:4px solid #f44336;border-radius:8px;color:#b71c1c;">Map failed to load.</p>';
  }
}

/* ---------------------------
   Analyze tab: only wire the file input.
   IMPORTANT:
   - We do NOT replace your analyzer implementation.
   - We only ensure analyzeAudioFile exists globally if your analyzer is module-scoped.
--------------------------- */
function ensureAnalyzerGlobals() {
  // If your analyzer code defines analyzeAudioFile in module scope, it won’t be on window.
  // If it is already on window, do nothing.
  // If it exists as a global function name in current scope (non-module script),
  // browsers still typically attach it to window. But some bundlers don’t.
  if (typeof window.analyzeAudioFile === 'function') return;

  // Try to find it if it was declared as a top-level function in a non-module script:
  try {
    // eslint-disable-next-line no-undef
    if (typeof analyzeAudioFile === 'function') window.analyzeAudioFile = analyzeAudioFile;
  } catch (_) {}

  // Same for AudioAnalyzer instance if needed (optional)
  try {
    // eslint-disable-next-line no-undef
    if (!window.audioAnalyzer && typeof audioAnalyzer !== 'undefined') window.audioAnalyzer = audioAnalyzer;
  } catch (_) {}
}

async function decodeAudioBuffer(arrayBuffer, audioCtx) {
  // decodeAudioData consumes buffers in some browsers; slice to be safe
  const copy = arrayBuffer.slice(0);

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Audio decode timeout (8s). Try WAV/OGG/FLAC.')), 8000)
  );

  const decode = new Promise((resolve, reject) => {
    // Promise form supported by modern browsers
    audioCtx.decodeAudioData(copy).then(resolve).catch(reject);
  });

  return Promise.race([decode, timeout]);
}

function analyzeStatusBanner(message, kind = 'info') {
  const results = $('#analysis-results');
  if (results) results.style.display = 'block';

  let status = $('#analysis-status');
  if (!status && results) {
    status = document.createElement('div');
    status.id = 'analysis-status';
    status.style.cssText = 'margin:0 0 14px;padding:12px 14px;border-radius:10px;font-weight:700;border-left:4px solid #667eea;background:#eef2ff;color:#1e3a8a;';
    results.prepend(status);
  }
  if (!status) return;

  const palette = {
    info:  { bg:'#eef2ff', color:'#1e3a8a', border:'#667eea' },
    warn:  { bg:'#fff3cd', color:'#7a4b00', border:'#ffc107' },
    ok:    { bg:'#e8f5e9', color:'#1b5e20', border:'#4caf50' },
    error: { bg:'#ffebee', color:'#b71c1c', border:'#f44336' }
  }[kind] || { bg:'#eef2ff', color:'#1e3a8a', border:'#667eea' };

  status.style.background = palette.bg;
  status.style.color = palette.color;
  status.style.borderLeftColor = palette.border;
  status.textContent = message;
}

function initializeAnalyzeUpload() {
  const fileInput = $('#file-input');
  const cancelBtn = $('#cancel-analysis');
  const results = $('#analysis-results');
  if (!fileInput || !results) return;

  let cancelled = false;

  on(cancelBtn, 'click', () => {
    cancelled = true;
    hide(cancelBtn);
    analyzeStatusBanner('✖️ Analysis cancelled.', 'error');
  });

  on(fileInput, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    cancelled = false;
    show(cancelBtn, 'inline-block');
    show(results);

    ensureAnalyzerGlobals();

    try {
      analyzeStatusBanner('🔄 Loading file…', 'info');

      // size cap (optional)
      const max = 100 * 1024 * 1024;
      if (file.size > max) throw new Error(`File too large: ${(file.size/1024/1024).toFixed(1)}MB (max 100MB).`);

      const ctx = ensureAudioContext();
      try { await resumeAudio(); } catch {}

      analyzeStatusBanner('🎵 Decoding audio…', 'warn');

      const ab = await file.arrayBuffer();
      if (cancelled) throw new Error('Analysis cancelled');

      const audioBuffer = await decodeAudioBuffer(ab, ctx);
      if (cancelled) throw new Error('Analysis cancelled');

      // Create a player
      const audioUrl = URL.createObjectURL(file);
      const audioPlayer = document.createElement('audio');
      audioPlayer.controls = true;
      audioPlayer.src = audioUrl;
      audioPlayer.style.width = '100%';

      // Place player in a stable container (do not duplicate)
      let playerWrap = $('#analysis-audio-player');
      if (!playerWrap) {
        playerWrap = document.createElement('div');
        playerWrap.id = 'analysis-audio-player';
        playerWrap.style.cssText = 'margin:0 0 14px;padding:12px;background:#e3f2fd;border-radius:10px;border-left:4px solid #2196f3;';
        playerWrap.innerHTML = '<h4 style="margin:0 0 8px;color:#1565c0;">🔊 Audio Playback</h4>';
        const status = $('#analysis-status');
        (status || results).insertAdjacentElement('afterend', playerWrap);
      } else {
        // clear old audio element
        playerWrap.querySelectorAll('audio').forEach(a => a.remove());
      }
      playerWrap.appendChild(audioPlayer);

      // Your analyzer MUST exist
      if (typeof window.analyzeAudioFile !== 'function') {
        throw new Error('analyzeAudioFile() not found. Check that audioAnalyzer.js / analyzer code is loaded before index.js.');
      }

      analyzeStatusBanner('📊 Analyzing…', 'warn');
      await window.analyzeAudioFile(audioBuffer, file.name, audioPlayer);

      analyzeStatusBanner('✅ Analysis complete.', 'ok');
      hide(cancelBtn);
    } catch (err) {
      console.error(err);
      hide(cancelBtn);
      analyzeStatusBanner(`❌ ${err.message}`, 'error');

      // Tips block (non-destructive)
      let tips = $('#analysis-error-tips');
      if (!tips) {
        tips = document.createElement('div');
        tips.id = 'analysis-error-tips';
        tips.style.cssText = 'margin-top:10px;padding:12px;border-radius:10px;background:#fff;border:1px solid #f5c2c2;';
        $('#analysis-status')?.insertAdjacentElement('afterend', tips);
      }
      tips.innerHTML = `
        <div style="font-weight:700;color:#b71c1c;margin-bottom:6px;">Supported formats & quick fixes</div>
        <ul style="margin:0;padding-left:18px;line-height:1.6;color:#333;">
          <li><b>Best:</b> WAV, OGG, FLAC</li>
          <li><b>Limited:</b> MP3/M4A (browser dependent)</li>
          <li>Export as <b>PCM 16-bit WAV</b> and retry</li>
          <li>Try a shorter clip (under 5 minutes)</li>
        </ul>
      `;
    }
  });
}

/* ---------------------------
   Download buttons
   (Only delegates; your existing functions do the work.)
--------------------------- */
function initializeDownloadsOnce() {
  if (initializeDownloadsOnce._done) return;
  initializeDownloadsOnce._done = true;

  on(document, 'click', (e) => {
    const id = e.target?.id;
    if (!id) return;

    if (id === 'download-pitch-chart')   return safeCall(window.downloadChart, window.pitchChart, 'pitch-analysis.png');
    if (id === 'download-rhythm-chart')  return safeCall(window.downloadChart, window.rhythmChart, 'rhythm-analysis.png');
    if (id === 'download-spectral-chart')return safeCall(window.downloadChart, window.spectralChart, 'spectral-analysis.png');
    if (id === 'download-analysis-data') return safeCall(window.downloadJSON, window.currentAnalysisData, 'music-analysis-data.json');
    if (id === 'download-full-report')   return safeCall(window.generateAnalysisReport);
  });
}

/* ---------------------------
   Boot
   IMPORTANT: We only “call if exists”.
   That means your existing app logic stays the boss.
--------------------------- */
function boot() {
  // UI
  initializeTabs();
  initializeAccessibilityMenu();
  initializeDarkMode();
  initializeClassroomMode();
  initializeAudioUnlockOverlay();

  // Features
  initializeWorldMapSafe();
  initializeAnalyzeUpload();
  initializeDownloadsOnce();

  // Your modules (only if they exist)
  safeCall(window.initializeGames);
  safeCall(window.initializeRecorder);
  safeCall(window.initializeLivePitch);
  safeCall(window.initializeComposer);
  safeCall(window.initializeLessonPlans);
  safeCall(window.initializeProgress);

  // If you have a glossary renderer that expects specific IDs,
  // it should handle missing targets internally.
  safeCall(window.displayGlossary);

  // Final sanity: expose analyzer globals once more after other scripts run
  ensureAnalyzerGlobals();
}

document.addEventListener('DOMContentLoaded', boot);

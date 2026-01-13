/* index.js — World EthnoMusic Lab (clean bootstrap + safe Analyze UI)
   - Tabs + accessibility menu
   - Dark mode (menu + FAB)
   - Classroom mode (master gain cap)
   - Leaflet map init hook
   - Analyze tab: file upload → decode → analyze (NO wiping chart DOM)
   - Record tab + Live pitch + Compose: safe initializers (expects your existing modules)
*/

'use strict';

/* =========================
   Small DOM helpers
========================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function on(el, ev, fn, opts) {
  if (!el) return;
  el.addEventListener(ev, fn, opts);
}

function show(el) { if (el) el.style.display = 'block'; }
function hide(el) { if (el) el.style.display = 'none'; }
function setText(el, txt) { if (el) el.textContent = txt; }

function safeHTML(el, html) { if (el) el.innerHTML = html; }

/* =========================
   Toast (optional)
========================= */
function showToast(type, message) {
  // If you already have a toast system, remove this.
  console[type === 'error' ? 'error' : 'log']('[Toast]', type, message);
}

/* =========================
   Global Audio (optional master gain)
========================= */
let audioContext = null;
function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!window.__MASTER_GAIN) {
    try {
      const master = audioContext.createGain();
      master.gain.value = 0.35;
      master.connect(audioContext.destination);
      window.__MASTER_GAIN = master;
    } catch (e) {
      console.warn('Master gain creation failed:', e);
    }
  }
  return audioContext;
}

async function resumeAudioIfNeeded() {
  const ctx = ensureAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

/* =========================
   Analyze status banner (prevents DOM wipe)
========================= */
function ensureAnalysisStatus() {
  const results = $('#analysis-results');
  if (!results) return null;

  let status = $('#analysis-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'analysis-status';
    status.style.cssText = `
      margin: 0 0 16px;
      padding: 14px 16px;
      border-radius: 10px;
      font-weight: 700;
      border-left: 5px solid #667eea;
      background: #eef2ff;
      color: #1e3a8a;
    `;
    results.prepend(status);
  }
  return status;
}

function setAnalysisStatus(message, opts = {}) {
  const results = $('#analysis-results');
  if (results) results.style.display = 'block';

  const status = ensureAnalysisStatus();
  if (!status) return;

  const { bg = '#eef2ff', color = '#1e3a8a', border = '#667eea' } = opts;
  status.style.background = bg;
  status.style.color = color;
  status.style.borderLeftColor = border;
  status.textContent = message;
}

/* =========================
   Tabs
========================= */
function initializeTabs() {
  const tabButtons = $$('.tab-btn');
  const tabPanels = $$('.tab-content');

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

    // Leaflet maps need resize fix when shown
    if (name === 'explore') {
      setTimeout(() => window.__WORLD_MAP?.invalidateSize?.(), 150);
      setTimeout(() => window.__WORLD_MAP?.invalidateSize?.(), 600);
    }
  }

  tabButtons.forEach(btn => {
    on(btn, 'click', () => activateTab(btn.dataset.tab));
  });

  // Make sure only the active panel is visible on load
  const activeBtn = tabButtons.find(b => b.classList.contains('active')) || tabButtons[0];
  if (activeBtn) activateTab(activeBtn.dataset.tab);
}

/* =========================
   Accessibility menu toggle
========================= */
function initializeAccessibilityMenu() {
  const toggle = $('#accessibility-menu-toggle');
  const menu = $('#accessibility-menu');
  if (!toggle || !menu) return;

  on(toggle, 'click', (e) => {
    e.stopPropagation();
    const isOpen = menu.style.display !== 'none' && menu.style.display !== '';
    menu.style.display = isOpen ? 'none' : 'grid';
    toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  on(document, 'click', (e) => {
    if (!menu.contains(e.target) && e.target !== toggle) {
      menu.style.display = 'none';
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

/* =========================
   Dark Mode (menu + FAB)
========================= */
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

/* =========================
   Classroom Mode (volume cap)
========================= */
function initializeClassroomMode() {
  const toggle = $('#classroom-mode-toggle');
  let enabled = localStorage.getItem('classroomMode') === 'true';

  function apply() {
    document.body.classList.toggle('classroom-mode', enabled);
    // cap master gain if available
    if (window.__MASTER_GAIN) window.__MASTER_GAIN.gain.value = enabled ? 0.18 : 0.35;
    if (toggle) toggle.textContent = enabled ? '🏫 On' : '🏫 Classroom Mode';
    localStorage.setItem('classroomMode', String(enabled));
  }

  on(toggle, 'click', () => { enabled = !enabled; apply(); });
  apply();
}

/* =========================
   Audio unlock overlay (mobile autoplay restrictions)
========================= */
function initializeAudioUnlockOverlay() {
  const overlay = $('#audio-unlock-overlay');
  const btn = $('#audio-unlock-button');
  const status = $('#audio-status');
  if (!overlay || !btn) return;

  // Show overlay if audio is locked (heuristic)
  const shouldShow = true; // You can refine this check if you want
  if (shouldShow) {
    overlay.style.display = 'flex';
  }

  on(btn, 'click', async () => {
    try {
      setText(status, 'Unlocking audio…');
      await resumeAudioIfNeeded();
      overlay.style.display = 'none';
      setText(status, '');
    } catch (e) {
      console.error(e);
      setText(status, 'Could not enable audio on this device.');
    }
  });
}

/* =========================
   Leaflet world map init hook
   (expects you have initWorldMap() elsewhere)
========================= */
function initializeWorldMapSafe() {
  const mapEl = $('#world-map');
  if (!mapEl) return;

  try {
    if (typeof window.initializeWorldMap === 'function') {
      window.initializeWorldMap(); // your existing map function
    } else if (typeof window.initWorldMap === 'function') {
      window.initWorldMap();
    } else {
      console.warn('No world map initializer found (initializeWorldMap / initWorldMap).');
    }
  } catch (e) {
    console.error('World map init failed:', e);
    mapEl.innerHTML = '<p style="padding: 20px; background: #ffecec; border: 1px solid #f5c2c2; border-radius: 8px; color: #c0392b;">Map could not load.</p>';
  }
}

/* =========================
   Analyze tab (upload + decode + analyze)
   Requires your existing audioAnalyzer + analyzeAudioFile()
========================= */
async function decodeAudioBuffer(arrayBuffer, file, audioCtx) {
  const bufferCopy = arrayBuffer.slice(0);

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Audio decode timeout after 8 seconds')), 8000)
  );

  const decodePromise = new Promise(async (resolve, reject) => {
    try {
      const decoded = await audioCtx.decodeAudioData(bufferCopy);
      resolve(decoded);
    } catch (err) {
      reject(err);
    }
  });

  return Promise.race([decodePromise, timeout]);
}

function initializeAnalyzer() {
  const fileInput = $('#file-input');
  const cancelBtn = $('#cancel-analysis');
  const results = $('#analysis-results');

  if (!fileInput || !results) return;

  let analysisCancelled = false;

  on(cancelBtn, 'click', () => {
    analysisCancelled = true;
    setAnalysisStatus('✖️ Analysis cancelled.', { bg: '#ffebee', color: '#b71c1c', border: '#f44336' });
    hide(cancelBtn);
  });

  on(fileInput, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    analysisCancelled = false;
    show(cancelBtn);
    show(results);

    try {
      setAnalysisStatus('🔄 LOADING FILE…', { bg: '#ffeb3b', color: '#000', border: '#fbc02d' });

      // Validate size (100MB)
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 100MB).`);

      const ctx = ensureAudioContext();

      setAnalysisStatus('🎵 DECODING AUDIO…', { bg: '#e1bee7', color: '#4a148c', border: '#6a1b9a' });

      // Safari sometimes needs user gesture; we already provide overlay, but try resume anyway
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch {}
      }

      const arrayBuffer = await file.arrayBuffer();
      if (analysisCancelled) throw new Error('Analysis cancelled');

      const audioBuffer = await decodeAudioBuffer(arrayBuffer, file, ctx);
      if (analysisCancelled) throw new Error('Analysis cancelled');

      setAnalysisStatus('📊 STARTING ANALYSIS…', { bg: '#c8e6c9', color: '#1b5e20', border: '#4caf50' });

      // Create playback player
      const audioUrl = URL.createObjectURL(file);
      const audioPlayer = document.createElement('audio');
      audioPlayer.controls = true;
      audioPlayer.src = audioUrl;
      audioPlayer.style.width = '100%';
      audioPlayer.style.marginBottom = '20px';

      // If you have a dedicated slot, put it there; otherwise insert under status banner
      const status = ensureAnalysisStatus();
      if (status && !$('#analysis-audio-player')) {
        const wrap = document.createElement('div');
        wrap.id = 'analysis-audio-player';
        wrap.style.cssText = 'margin: 0 0 14px; padding: 12px; background: #e3f2fd; border-radius: 10px; border-left: 4px solid #2196f3;';
        wrap.innerHTML = '<h4 style="margin: 0 0 8px; color:#1565c0;">🔊 Audio Playback</h4>';
        wrap.appendChild(audioPlayer);
        status.insertAdjacentElement('afterend', wrap);
      }

      // Call your existing analysis function (must NOT wipe DOM)
      if (typeof window.analyzeAudioFile !== 'function') {
        throw new Error('analyzeAudioFile() not found. Make sure your analyzer code is loaded.');
      }

      await window.analyzeAudioFile(audioBuffer, file.name, audioPlayer);

      setAnalysisStatus('✅ Analysis complete.', { bg: '#e8f5e9', color: '#1b5e20', border: '#4caf50' });
      hide(cancelBtn);
    } catch (err) {
      console.error(err);
      hide(cancelBtn);

      // Friendly error message in status + leave charts/buttons intact
      setAnalysisStatus(`❌ ${err.message}`, { bg: '#ffebee', color: '#b71c1c', border: '#f44336' });

      // Optional tips block (no DOM wipe, just append/update)
      let tips = $('#analysis-error-tips');
      if (!tips) {
        tips = document.createElement('div');
        tips.id = 'analysis-error-tips';
        tips.style.cssText = 'margin-top: 12px; padding: 12px; border-radius: 10px; background:#fff; border: 1px solid #f5c2c2;';
        $('#analysis-status')?.insertAdjacentElement('afterend', tips);
      }

      tips.innerHTML = `
        <div style="font-weight:700; color:#b71c1c; margin-bottom:6px;">Supported Formats & Fixes</div>
        <ul style="margin: 0; padding-left: 18px; line-height: 1.6; color:#333;">
          <li><b>Best:</b> WAV, OGG, FLAC</li>
          <li><b>Limited:</b> MP3/M4A (depends on browser)</li>
          <li>Try exporting as <b>PCM 16-bit WAV</b></li>
          <li>Try a shorter clip (under 5 minutes)</li>
        </ul>
      `;
    }
  });
}

/* =========================
   Download buttons (delegation)
   Expects global chart instances + currentAnalysisData
========================= */
function setupDownloadButtonsOnce() {
  if (setupDownloadButtonsOnce._done) return;
  setupDownloadButtonsOnce._done = true;

  on(document, 'click', (e) => {
    const id = e.target?.id;
    if (!id) return;

    if (id === 'download-pitch-chart') return window.downloadChart?.(window.pitchChart, 'pitch-analysis.png');
    if (id === 'download-rhythm-chart') return window.downloadChart?.(window.rhythmChart, 'rhythm-analysis.png');
    if (id === 'download-spectral-chart') return window.downloadChart?.(window.spectralChart, 'spectral-analysis.png');
    if (id === 'download-analysis-data') return window.downloadJSON?.(window.currentAnalysisData, 'music-analysis-data.json');
    if (id === 'download-full-report') return window.generateAnalysisReport?.();
  });
}

/* =========================
   Boot
========================= */
function boot() {
  // Core UI
  initializeTabs();
  initializeAccessibilityMenu();
  initializeDarkMode();
  initializeClassroomMode();
  initializeAudioUnlockOverlay();

  // Features
  initializeWorldMapSafe();
  initializeAnalyzer();
  setupDownloadButtonsOnce();

  // Optional: call your other initializers if present
  if (typeof window.initializeGames === 'function') window.initializeGames();
  if (typeof window.initializeRecorder === 'function') window.initializeRecorder();
  if (typeof window.initializeLivePitch === 'function') window.initializeLivePitch();
  if (typeof window.initializeComposer === 'function') window.initializeComposer();
  if (typeof window.initializeLessonPlans === 'function') window.initializeLessonPlans();
  if (typeof window.initializeProgress === 'function') window.initializeProgress();

  // Glossary if you use the new IDs
  if (typeof window.displayGlossary === 'function') window.displayGlossary();
}

document.addEventListener('DOMContentLoaded', boot);

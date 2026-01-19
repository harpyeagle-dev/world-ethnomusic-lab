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
import { initializeWorldMap, displayGlossary, displayCultures, ProgressTracker } from './advancedFeatures.js';
import { lessonPlans } from './extendedFeatures.js';
import { jsPDF } from 'jspdf';
import { analyzeAudioFile } from './audioAnalyzer.js';
import { getAllCultures } from './culturesData.js';
import './games_clean.js';

// Ensure functions are available on window immediately after import
window.initializeWorldMap = window.initializeWorldMap || initializeWorldMap;
window.displayGlossary = window.displayGlossary || displayGlossary;
window.displayCultures = window.displayCultures || displayCultures;
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

async function safeCall(fn, ...args) {
  try { 
    const result = typeof fn === 'function' ? fn(...args) : undefined;
    // Handle promises/async functions
    if (result && typeof result.then === 'function') {
      return await result;
    }
    return result;
  }
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
    console.log('⏸️ Resuming suspended AudioContext...');
    try {
      const resumePromise = ctx.resume();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AudioContext resume timeout')), 3000)
      );
      await Promise.race([resumePromise, timeoutPromise]);
      console.log('✅ AudioContext resumed successfully, state:', ctx.state);
    } catch (error) {
      console.error('❌ Failed to resume AudioContext:', error);
      // Don't throw - continue anyway, some browsers work despite suspended state
    }
  }
  return ctx;
}

// Play a note by frequency
function playNote(frequency, time, duration, holdDuration = 0.3) {
  try {
    const ctx = ensureAudioContext();
    const gainNode = ctx.createGain();
    const osc = ctx.createOscillator();
    
    osc.frequency.value = frequency;
    osc.type = 'sine';
    
    gainNode.connect(window.__MASTER_GAIN || ctx.destination);
    osc.connect(gainNode);
    
    // Envelope
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + (holdDuration || 0.3));
    
    osc.start(now);
    osc.stop(now + (holdDuration || 0.3));
    
    console.log(`🎵 Playing ${frequency.toFixed(0)} Hz for ${(holdDuration || 0.3).toFixed(2)}s`);
  } catch (e) {
    console.error('❌ Play note failed:', e);
  }
}

// Convert note name to frequency
function noteToFrequency(noteName) {
  const notes = {
    'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 349.23, 'G': 391.99, 'A': 440, 'B': 493.88,
    'C#': 277.18, 'D#': 311.13, 'F#': 369.99, 'G#': 415.30, 'A#': 466.16
  };
  return notes[noteName] || 440;
}

// Expose playNote globally
window.playNote = playNote;
window.noteToFrequency = noteToFrequency;

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
async function initializeWorldMapSafe() {
  const mapEl = $('#world-map');
  if (!mapEl) return;

  try {
    if (typeof window.initializeWorldMap === 'function') {
      const m = await window.initializeWorldMap();
      if (m) window.__WORLD_MAP = m;
    } else if (typeof window.initWorldMap === 'function') {
      const m = await window.initWorldMap();
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
  console.log('🔊 decodeAudioBuffer called:', {
    bufferSize: arrayBuffer.byteLength,
    audioContextState: audioCtx.state,
    sampleRate: audioCtx.sampleRate
  });

  // decodeAudioData consumes buffers in some browsers; slice to be safe
  const copy = arrayBuffer.slice(0);

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Audio decode timeout (8s). Try WAV/OGG/FLAC.')), 8000)
  );

  const decode = new Promise((resolve, reject) => {
    // Promise form supported by modern browsers
    audioCtx.decodeAudioData(copy)
      .then(buffer => {
        console.log('✅ Audio decoded successfully:', {
          duration: buffer.duration,
          channels: buffer.numberOfChannels,
          sampleRate: buffer.sampleRate
        });
        resolve(buffer);
      })
      .catch(err => {
        console.error('❌ Audio decode failed:', err);
        console.error('Error details:', {
          name: err.name,
          message: err.message,
          code: err.code
        });
        reject(new Error(`Audio decode failed: ${err.message}. Try converting to PCM 16-bit WAV format.`));
      });
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
      console.log('📁 File selected:', {
        name: file.name,
        type: file.type,
        size: `${(file.size/1024/1024).toFixed(2)}MB`
      });

      analyzeStatusBanner('🔄 Loading file…', 'info');

      // size cap (optional)
      const max = 100 * 1024 * 1024;
      if (file.size > max) throw new Error(`File too large: ${(file.size/1024/1024).toFixed(1)}MB (max 100MB).`);

      const ctx = ensureAudioContext();
      console.log('🎵 AudioContext state before resume:', ctx.state);
      
      try { 
        await resumeAudio(); 
        console.log('▶️ AudioContext state after resume:', ctx.state);
      } catch (e) {
        console.warn('⚠️ AudioContext resume issue:', e);
        // Continue anyway - audio decoding may still work
      }
      
      // Note: We'll continue even if suspended - some operations work in suspended state
      if (ctx.state === 'suspended') {
        console.warn('⚠️ AudioContext still suspended, but continuing with analysis');
      }

      analyzeStatusBanner('🎵 Decoding audio…', 'warn');

      console.log('📖 Reading file as ArrayBuffer...');
      const ab = await file.arrayBuffer();
      console.log('✅ ArrayBuffer loaded:', ab.byteLength, 'bytes');
      
      if (cancelled) throw new Error('Analysis cancelled');

      console.log('🔄 Starting audio decode...');
      const audioBuffer = await decodeAudioBuffer(ab, ctx);
      console.log('✅ Audio buffer ready');
      
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
      console.log('🔍 Checking for analyzeAudioFile function...');
      console.log('window.analyzeAudioFile exists?', typeof window.analyzeAudioFile);
      console.log('Available window methods:', Object.keys(window).filter(k => k.includes('analyze') || k.includes('Audio')));
      
      if (typeof window.analyzeAudioFile !== 'function') {
        throw new Error('analyzeAudioFile() not found. Check that audioAnalyzer.js / analyzer code is loaded before index.js.');
      }

      console.log('🎯 Calling analyzeAudioFile...');
      analyzeStatusBanner('📊 Analyzing…', 'warn');
      await window.analyzeAudioFile(audioBuffer, file.name, audioPlayer);

      analyzeStatusBanner('✅ Analysis complete.', 'ok');
      hide(cancelBtn);
    } catch (err) {
      console.error('❌ Analysis error:', err);
      console.error('Error stack:', err.stack);
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
   Create page: minimal initializers
   Wires recorder, composer, and stub live pitch so buttons respond
--------------------------- */
function initializeRecorder() {
  const recordBtn = document.getElementById('record-btn');
  const stopBtn = document.getElementById('stop-record-btn');
  const status = document.getElementById('recording-status');
  if (!recordBtn || !stopBtn) return;

  let mediaRecorder = null;
  let chunks = [];

  recordBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = ensureAudioContext();
      try { await resumeAudio(); } catch {}
      // Pick a supported MIME type (Safari prefers mp4/aac; Chrome prefers webm/opus)
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/aac'
      ];
      const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported)
        ? candidates.find(t => MediaRecorder.isTypeSupported(t))
        : undefined;
      console.log('🎙️ Recorder MIME selected:', mimeType || '(default)');

      mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        if (!chunks.length) {
          status.textContent = '❌ No audio data captured.';
          return;
        }
        const effectiveType = chunks[0]?.type || mimeType || '';
        console.log('🎛️ Playback blob type:', effectiveType);
        const blob = new Blob(chunks, { type: effectiveType });
        const url = URL.createObjectURL(blob);
        status.innerHTML = `
          <div style="margin-top:8px;">
            <audio controls src="${url}" style="width:100%"></audio>
            <div style="margin-top:6px;">
              <a href="${url}" download="recording.${effectiveType.includes('mp4') ? 'm4a' : effectiveType.includes('webm') ? 'webm' : effectiveType.includes('ogg') ? 'ogg' : 'audio'}" class="btn-secondary">⬇️ Download</a>
            </div>
          </div>
        `;
        // Store blob for analysis and show analyze button
        window.lastRecordedBlob = blob;
        const actionsDiv = document.getElementById('recorder-actions');
        if (actionsDiv) {
          actionsDiv.style.display = 'flex';
        }
      };
      mediaRecorder.start();
      recordBtn.disabled = true;
      stopBtn.disabled = false;
      if (status) status.textContent = '🔴 Recording…';
    } catch (e) {
      console.error('Recorder error:', e);
      if (status) status.textContent = '❌ Microphone access denied.';
    }
  });

  stopBtn.addEventListener('click', () => {
    try { mediaRecorder?.stop(); } catch {}
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    if (status) status.textContent = '✅ Recording complete.';
  });

  // Analyze Recording button handler
  const analyzeBtn = document.getElementById('analyze-recording');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      const blob = window.lastRecordedBlob;
      if (!blob) {
        alert('No recording to analyze');
        return;
      }
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = '⏳ Analyzing...';
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ensureAudioContext().decodeAudioData(arrayBuffer);
        
        // Get channel data for waveform display
        const channelData = audioBuffer.getChannelData(0);
        
        // Analyze with existing pipeline
        const result = await analyzeAudioFile(audioBuffer, 'Recording', null);
        
        // Display results in modal
        showRecorderAnalysisModal(result, channelData);
        
        console.log('✅ Recorder analysis complete:', result);
      } catch (err) {
        console.error('Analysis error:', err);
        alert('Analysis failed: ' + err.message);
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '📊 Analyze Recording';
      }
    });
  }
}

async function showRecorderAnalysisModal(result, channelData) {
  // Create modal container
  let modal = document.getElementById('recorder-analysis-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'recorder-analysis-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
      z-index: 10000; overflow-y: auto;
    `;
    document.body.appendChild(modal);
  }
  
  // Build analysis content with proper chart containers
  const analysisHTML = `
    <div style="background: #1a1a2e; border-radius: 12px; padding: 24px; max-width: 1200px; width: 95%; max-height: 90vh; overflow-y: auto; color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h2 style="margin: 0;">📊 Recording Analysis</h2>
        <button id="close-modal" class="btn-secondary" style="padding: 8px 12px; cursor: pointer; background: #667eea; color: #fff; border: none; border-radius: 4px;">✕ Close</button>
      </div>
      
      <div id="analysis-results" style="display: block;">
        <div id="summary-stats" style="margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;"></div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 20px; margin-bottom: 20px;">
          <div>
            <canvas id="waveform-chart" width="400" height="250" style="border: 1px solid #444; border-radius: 4px; display: block;"></canvas>
            <div id="waveform-info" style="margin-top: 8px; font-size: 12px; color: #aaa;"></div>
          </div>
          <div>
            <canvas id="pitch-chart" width="400" height="250" style="border: 1px solid #444; border-radius: 4px; display: block;"></canvas>
            <div id="pitch-info" style="margin-top: 8px; font-size: 12px; color: #aaa;"></div>
          </div>
          <div>
            <canvas id="rhythm-chart" width="400" height="250" style="border: 1px solid #444; border-radius: 4px; display: block;"></canvas>
            <div id="rhythm-info" style="margin-top: 8px; font-size: 12px; color: #aaa;"></div>
          </div>
          <div>
            <canvas id="spectral-chart" width="400" height="250" style="border: 1px solid #444; border-radius: 4px; display: block;"></canvas>
            <div id="spectral-info" style="margin-top: 8px; font-size: 12px; color: #aaa;"></div>
          </div>
          <div>
            <canvas id="melodic-chart" width="400" height="250" style="border: 1px solid #444; border-radius: 4px; display: block;"></canvas>
            <div id="melodic-info" style="margin-top: 8px; font-size: 12px; color: #aaa;"></div>
          </div>
        </div>
        
        <div id="genre-info" style="margin-bottom: 20px; padding: 16px; background: rgba(102, 126, 234, 0.15); border-left: 4px solid #667eea; border-radius: 4px;"></div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; padding-top: 20px; border-top: 1px solid #444;">
        <button class="btn-primary" onclick="downloadRecorderChart('waveform')">📈 Waveform PNG</button>
        <button class="btn-primary" onclick="downloadRecorderChart('pitch')">🎵 Pitch PNG</button>
        <button class="btn-primary" onclick="downloadRecorderChart('rhythm')">🥁 Rhythm PNG</button>
        <button class="btn-primary" onclick="downloadRecorderChart('spectral')">📊 Spectral PNG</button>
        <button class="btn-primary" onclick="downloadRecorderChart('melodic')">🎼 Melodic PNG</button>
        <button class="btn-secondary" onclick="downloadRecorderChart('json')">💾 Data JSON</button>
      </div>
    </div>
  `;
  
  modal.innerHTML = analysisHTML;
  modal.style.display = 'flex';
  
  // Close handler - must be after innerHTML
  setTimeout(() => {
    const closeBtn = document.getElementById('close-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.style.display = 'none';
      });
    }
  }, 0);
  
  // Render analysis charts
  if (window.displayAnalysisResults) {
    window.displayAnalysisResults(result, channelData);
  } else {
    console.warn('displayAnalysisResults not available');
  }
  
  // Store result for downloads
  window.lastRecorderAnalysis = result;
}
function initializeComposer() {
  const culture1 = document.getElementById('culture1-select');
  const culture2 = document.getElementById('culture2-select');
  const mixBtn = document.getElementById('mix-scales');
  const canvas = document.getElementById('composition-canvas');
  const playBtn = document.getElementById('play-composition');
  const stopBtn = document.getElementById('stop-composition');
  const clearBtn = document.getElementById('clear-composition');
  
  let composerNotes = [];
  let isPlaying = false;
  let oscillators = [];
  
  if (canvas) {
    const ctx2d = canvas.getContext('2d');

    function drawGrid() {
      // Background
      ctx2d.fillStyle = '#34495e';
      ctx2d.fillRect(0, 0, canvas.width, canvas.height);
      // Grid lines
      ctx2d.strokeStyle = '#536273';
      ctx2d.lineWidth = 1;
      for (let x = 0; x <= canvas.width; x += 50) {
        ctx2d.beginPath();
        ctx2d.moveTo(x, 0);
        ctx2d.lineTo(x, canvas.height);
        ctx2d.stroke();
      }
      for (let y = 0; y <= canvas.height; y += 50) {
        ctx2d.beginPath();
        ctx2d.moveTo(0, y);
        ctx2d.lineTo(canvas.width, y);
        ctx2d.stroke();
      }
      // Help text
      ctx2d.fillStyle = '#fff';
      ctx2d.font = '14px Poppins, sans-serif';
      ctx2d.fillText('Click to add notes • Press C to clear', 18, 28);
    }

    function drawNotes() {
      ctx2d.fillStyle = '#00e676';
      composerNotes.forEach(({ x, y }) => {
        ctx2d.beginPath();
        ctx2d.arc(x, y, 6, 0, Math.PI * 2);
        ctx2d.fill();
      });
    }

    function redraw() {
      drawGrid();
      drawNotes();
    }

    redraw();

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      composerNotes.push({ x, y });
      console.log('🎼 Note added at', { x: Math.round(x), y: Math.round(y) });
      redraw();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key && e.key.toLowerCase() === 'c') {
        composerNotes.length = 0;
        console.log('🧹 Canvas cleared');
        redraw();
      }
    });
  }

  // Play composition
  if (playBtn) {
    playBtn.addEventListener('click', async () => {
      if (!canvas || !composerNotes.length) {
        alert('Add some notes to the canvas first.');
        return;
      }
      if (isPlaying) return;
      isPlaying = true;
      playBtn.style.display = 'none';
      stopBtn.style.display = 'inline-block';

      try {
        const ctx = ensureAudioContext();
        await resumeAudio();
        const now = ctx.currentTime;
        const duration = 0.4;
        const holdDuration = 0.1;

        // Schedule oscillators based on note positions
        composerNotes
          .slice()
          .sort((a, b) => a.x - b.x)
          .forEach((note) => {
            const startTime = now + (note.x / canvas.width) * 4;
            const freq = 130 + (1 - note.y / canvas.height) * 393; // Map Y to 130-523 Hz
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.connect(gain).connect(ctx.destination);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.8, startTime + 0.02);
            gain.gain.linearRampToValueAtTime(0, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration + holdDuration);
            oscillators.push(osc);
          });

        // Auto-stop after playback window (~4s span)
        const totalMs = (4 + duration + holdDuration) * 1000;
        setTimeout(() => {
          isPlaying = false;
          playBtn.style.display = 'inline-block';
          stopBtn.style.display = 'none';
          oscillators = [];
        }, totalMs + 100);
      } catch (e) {
        console.error('Play composition failed:', e);
        isPlaying = false;
        playBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
      }
    });
  }

  // Stop composition
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      isPlaying = false;
      oscillators.forEach(o => {
        try { o.stop(); } catch {}
      });
      oscillators = [];
      playBtn.style.display = 'inline-block';
      stopBtn.style.display = 'none';
      console.log('⏹️ Playback stopped');
    });
  }

  // Clear canvas button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      composerNotes.length = 0;
      if (canvas) {
        const ctx2d = canvas.getContext('2d');
        ctx2d.fillStyle = '#34495e';
        ctx2d.fillRect(0, 0, canvas.width, canvas.height);
        // Redraw grid
        ctx2d.strokeStyle = '#536273';
        ctx2d.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += 50) {
          ctx2d.beginPath();
          ctx2d.moveTo(x, 0);
          ctx2d.lineTo(x, canvas.height);
          ctx2d.stroke();
        }
        for (let y = 0; y <= canvas.height; y += 50) {
          ctx2d.beginPath();
          ctx2d.moveTo(0, y);
          ctx2d.lineTo(canvas.width, y);
          ctx2d.stroke();
        }
        ctx2d.fillStyle = '#fff';
        ctx2d.font = '14px Poppins, sans-serif';
        ctx2d.fillText('Click to add notes • Press C to clear', 18, 28);
      }
      console.log('🗑️ Composer cleared');
    });
  }

  // Populate culture selects once
  const cultures = typeof getAllCultures === 'function' ? getAllCultures() : [];
  const populate = (sel) => {
    if (!sel || !cultures?.length) return;
    // Avoid duplicate options
    const hasPopulated = sel.dataset.populated === 'true';
    if (hasPopulated) return;
    cultures.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.emoji || ''} ${c.name}`.trim();
      sel.appendChild(opt);
    });
    sel.dataset.populated = 'true';
  };
  populate(culture1);
  populate(culture2);

  if (mixBtn) {
    mixBtn.addEventListener('click', () => {
      console.log('🎛️ Mix Scales clicked');
      const id1 = culture1?.value;
      const id2 = culture2?.value;
      console.log('Selected cultures:', { id1, id2 });
      if (!id1 || !id2) return alert('Please select two cultures');

      const display = document.getElementById('mixed-scale-display') || document.getElementById('loop-display');
      if (!display) return;

      const findCulture = (id) => cultures.find(c => c.id === id);
      const c1 = findCulture(id1);
      const c2 = findCulture(id2);
      console.log('Resolved cultures:', { c1Name: c1?.name, c2Name: c2?.name });
      if (!c1 || !c2) return;

      const normScales = (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
        return [];
      };

      const scales1 = normScales(c1.characteristics?.scales);
      const scales2 = normScales(c2.characteristics?.scales);
      const rhythm1 = c1.characteristics?.rhythm || 'rhythmic patterns';
      const rhythm2 = c2.characteristics?.rhythm || 'rhythmic patterns';
      const instruments1 = c1.characteristics?.instruments || 'traditional instruments';
      const instruments2 = c2.characteristics?.instruments || 'traditional instruments';
      const tempo1 = c1.characteristics?.tempo || 'varied tempo';
      const tempo2 = c2.characteristics?.tempo || 'varied tempo';

      display.innerHTML = `
        <div style="margin-top: 16px; padding: 16px; background: #eef2ff; border-left: 4px solid #667eea; border-radius: 10px;">
          <h4>✨ Mixed Scales</h4>
          <p><strong>${c1.emoji || ''} ${c1.name} scales:</strong> ${scales1.join(', ') || 'Not listed'}</p>
          <p><strong>${c2.emoji || ''} ${c2.name} scales:</strong> ${scales2.join(', ') || 'Not listed'}</p>
          <p><strong>Blended rhythm:</strong> ${rhythm1} + ${rhythm2}</p>
          <p><strong>Combined instruments:</strong> ${instruments1} + ${instruments2}</p>
          <p><strong>Tempos:</strong> ${tempo1} / ${tempo2}</p>
          <p style="margin-top:10px;font-size:0.9em;color:#555;">Use the composer canvas to sketch a fusion melody inspired by these scales.</p>
        </div>
      `;
      console.log('✅ Mixed scales panel rendered');
    });
  }

  // Loop station minimal wiring
  const recLoop = document.getElementById('record-loop');
  const playLoops = document.getElementById('play-loops');
  const clearLoops = document.getElementById('clear-loops');
  const loopDisplay = document.getElementById('loop-display');
  let isRecordingLoop = false;
  if (recLoop) recLoop.addEventListener('click', async () => {
    isRecordingLoop = !isRecordingLoop;
    recLoop.textContent = isRecordingLoop ? '⏺️ Recording…' : '⏺️ Record Loop';
    loopDisplay && (loopDisplay.textContent = isRecordingLoop ? 'Recording loop layer…' : 'Loop recording stopped.');
  });
    if (playLoops) playLoops.addEventListener('click', async () => {
      try { await resumeAudio(); } catch {}
      loopDisplay && (loopDisplay.textContent = '▶️ Playing all loops (demo).');
    });
    if (clearLoops) clearLoops.addEventListener('click', () => {
      loopDisplay && (loopDisplay.textContent = 'Cleared all loops.');
    });
}

function initializeLivePitch() {
  // Stub to keep buttons responsive if present
  const start = document.getElementById('start-live-pitch');
  const stop = document.getElementById('stop-live-pitch');
  const canvas = document.getElementById('pitch-contour');
  let running = false;
  if (start) start.addEventListener('click', async () => {
    try { await resumeAudio(); } catch {}
    running = true;
    start.disabled = true;
    stop && (stop.disabled = false);
    canvas && (canvas.title = 'Live pitch running (stub)');
  });
  if (stop) stop.addEventListener('click', () => {
    running = false;
    stop.disabled = true;
    start && (start.disabled = false);
    canvas && (canvas.title = 'Live pitch stopped');
  });
}

// Teacher Dashboard (local only)
let dashboardSession = null;
let dashboardTimer = null;
let progressInterval = null;
const progressTracker = new ProgressTracker();
progressTracker.loadProgress && progressTracker.loadProgress();

function initializeTeacherDashboard() {
  const startBtn = document.getElementById('start-session-btn');
  const classInput = document.getElementById('class-name-input');
  const studentInput = document.getElementById('student-count-input');
  const stats = document.getElementById('session-stats');
  const tracksEl = document.getElementById('tracks-analyzed-count');
  const gamesEl = document.getElementById('games-played-count');
  const quizEl = document.getElementById('quizzes-taken-count');

  // Restore prior session
  const saved = localStorage.getItem('teacherDashboard');
  if (saved) {
    try {
      dashboardSession = JSON.parse(saved);
      classInput && (classInput.value = dashboardSession.className || '');
      studentInput && (studentInput.value = dashboardSession.studentCount || 25);
      showDashboard(stats, startBtn);
      updateDashboardCounts(tracksEl, gamesEl, quizEl);
      startTicker();
    } catch (e) {
      console.warn('Failed to load dashboard session', e);
    }
  }

  startBtn?.addEventListener('click', () => {
    const className = classInput?.value || 'Untitled Class';
    const studentCount = parseInt(studentInput?.value, 10) || 25;

    dashboardSession = {
      className,
      studentCount,
      startTime: new Date().toISOString(),
      activities: { tracksAnalyzed: 0, gamesPlayed: 0, quizzesTaken: 0, totalTimeSeconds: 0 }
    };

    saveDashboard();
    showDashboard(stats, startBtn);
    updateDashboardCounts(tracksEl, gamesEl, quizEl);
    startTicker();
  });
}

function startTicker() {
  if (dashboardTimer) clearInterval(dashboardTimer);
  dashboardTimer = setInterval(() => {
    if (!dashboardSession) return;
    dashboardSession.activities.totalTimeSeconds += 1;
    saveDashboard();
  }, 1000);
}

function saveDashboard() {
  if (dashboardSession) localStorage.setItem('teacherDashboard', JSON.stringify(dashboardSession));
}

function showDashboard(statsEl, startBtn) {
  if (statsEl) statsEl.style.display = 'block';
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = 'Session Started';
  }
}

function updateDashboardCounts(tracksEl, gamesEl, quizEl) {
  if (!dashboardSession) return;
  tracksEl && (tracksEl.textContent = dashboardSession.activities.tracksAnalyzed || 0);
  gamesEl && (gamesEl.textContent = dashboardSession.activities.gamesPlayed || 0);
  quizEl && (quizEl.textContent = dashboardSession.activities.quizzesTaken || 0);
}

// Expose for boot safeCall
window.initializeRecorder = window.initializeRecorder || initializeRecorder;
window.initializeComposer = window.initializeComposer || initializeComposer;
window.initializeLivePitch = window.initializeLivePitch || initializeLivePitch;
window.initializeLessonPlans = window.initializeLessonPlans || initializeLessonPlans;
window.initializeProgress = window.initializeProgress || initializeProgress;

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
    if (id === 'download-melodic-chart') return safeCall(window.downloadChart, window.melodicChart, 'melodic-frequency.png');
    if (id === 'download-waveform-chart')return safeCall(window.downloadChart, window.waveformChart, 'waveform.png');
    if (id === 'download-analysis-data') return safeCall(window.downloadJSON, window.currentAnalysisData, 'music-analysis-data.json');
    if (id === 'download-full-report')   return safeCall(window.generateAnalysisReport);
  });
}

// Download chart as PNG helper
window.downloadChart = function(canvas, filename) {
  if (!canvas) {
    console.warn('⚠️ Chart not available for download');
    return;
  }
  try {
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename || 'chart.png';
    link.href = url;
    link.click();
    console.log('✓ Chart downloaded:', filename);
  } catch (e) {
    console.error('❌ Download failed:', e);
  }
};

// Download recorder chart (wrapper that finds the chart in modal)
window.downloadRecorderChart = function(chartType) {
  if (chartType === 'json') {
    // Download JSON data
    const data = window.lastRecorderAnalysis || window.currentAnalysisData;
    if (!data) {
      console.warn('⚠️ No analysis data available');
      return;
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'recording-analysis-data.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  
  // For chart types, find the canvas by ID
  const canvasMap = {
    'waveform': 'waveform-chart',
    'pitch': 'pitch-chart',
    'rhythm': 'rhythm-chart',
    'spectral': 'spectral-chart',
    'melodic': 'melodic-chart'
  };
  
  const canvasId = canvasMap[chartType];
  const canvas = document.getElementById(canvasId);
  
  if (!canvas) {
    console.warn('⚠️ Chart not available:', chartType);
    return;
  }
  
  try {
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `recording-${chartType}.png`;
    link.href = url;
    link.click();
    console.log('✓ Recorder chart downloaded:', chartType);
  } catch (e) {
    console.error('❌ Download failed:', e);
  }
};

// Download analysis data as JSON
window.downloadJSON = function(data, filename) {
  if (!data) {
    console.warn('⚠️ Data not available for download');
    return;
  }
  try {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename || 'analysis-data.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    console.log('✓ JSON downloaded:', filename);
  } catch (e) {
    console.error('❌ Download failed:', e);
  }
};

// Generate analysis report as TXT
window.generateAnalysisReport = function() {
  const data = window.currentAnalysisData;
  if (!data) {
    console.warn('⚠️ No analysis data available');
    return;
  }
  try {
    const timestamp = new Date().toLocaleString();
    const report = `
═══════════════════════════════════════════════════
ETHNOMUSICOLOGY ANALYSIS REPORT
Generated: ${timestamp}
═══════════════════════════════════════════════════

PITCH ANALYSIS
Detected Pitch: ${(data.pitch || 0).toFixed(1)} Hz
Scale: ${data.scaleAnalysis?.scale || 'Unknown'}
Pitch Range: ${Math.min(...(data.pitches || [0])).toFixed(1)} - ${Math.max(...(data.pitches || [0])).toFixed(1)} Hz

═══════════════════════════════════════════════════

RHYTHM ANALYSIS
Tempo: ${(data.rhythmAnalysis?.tempo || 0).toFixed(0)} BPM
Regularity: ${((data.rhythmAnalysis?.regularity || 0) * 100).toFixed(1)}%
Detected Onsets: ${data.rhythmAnalysis?.peakCount || 0}

═══════════════════════════════════════════════════

SPECTRAL ANALYSIS
Spectral Centroid: ${(data.spectralAnalysis?.centroid || 0).toFixed(2)} Hz
Spectral Rolloff: ${(data.spectralAnalysis?.rolloff || 0).toFixed(2)} Hz
Brightness: ${((data.spectralAnalysis?.brightness || 0) * 100).toFixed(1)}%

═══════════════════════════════════════════════════

GENRE CLASSIFICATION
Genre: ${data.genre?.label || data.genre?.genre || 'Unknown'}
Confidence: ${Number.isFinite(data.genre?.confidence) && data.genre?.confidence > 1 ? data.genre?.confidence.toFixed(1) : ((data.genre?.confidence || 0) * 100).toFixed(1)}%

═══════════════════════════════════════════════════

For more information, visit: https://www.digitalheritagegy.com
    `.trim();
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'music-analysis-report.txt';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    console.log('✓ Report downloaded');
  } catch (e) {
    console.error('❌ Report generation failed:', e);
  }
};

// Progress Tracker UI (safe if elements missing)
function initializeProgress() {
  updateProgressDisplay();
  try { safeCall(window.displayGlossary); } catch {}

  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }

  if (dashboardSession) {
    progressInterval = setInterval(() => {
      if (dashboardSession) {
        updateProgressDisplay();
      } else {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    }, 5000);
  }

  function updateProgressDisplay() {
    const levelEl = document.getElementById('user-level');
    const xpEl = document.getElementById('current-xp');
    const nextXpEl = document.getElementById('next-level-xp');
    const xpFillEl = document.getElementById('xp-fill');

    if (levelEl) levelEl.textContent = String(progressTracker.level ?? 1);
    if (xpEl) xpEl.textContent = String(progressTracker.xp ?? 0);
    if (nextXpEl) nextXpEl.textContent = String((progressTracker.level ?? 1) * 100);
    if (xpFillEl) {
      const level = progressTracker.level ?? 1;
      const xp = progressTracker.xp ?? 0;
      const xpPercent = level > 0 ? Math.min(100, Math.max(0, (xp / (level * 100)) * 100)) : 0;
      xpFillEl.style.width = xpPercent + '%';
    }

    const badgesGrid = document.getElementById('badges-grid');
    if (badgesGrid && typeof progressTracker.getBadges === 'function') {
      badgesGrid.innerHTML = '';
      progressTracker.getBadges().forEach(badge => {
        const div = document.createElement('div');
        div.className = 'badge-item';
        div.innerHTML = `<div class="badge-icon">${badge.icon}</div><div>${badge.name}</div>`;
        badgesGrid.appendChild(div);
      });
    }

  }
}

// Lesson Plans rendering (Educators page)
function initializeLessonPlans() {
  const lessonsContainer = document.getElementById('lesson-plans-container');
  if (!lessonsContainer) return;

  lessonsContainer.innerHTML = '';
  lessonPlans.forEach(lesson => {
    const lessonCard = document.createElement('div');
    lessonCard.className = 'lesson-card';
    lessonCard.style.cssText = 'background: white; padding: 20px; margin: 15px 0; border-radius: 10px; border-left: 5px solid #667eea;';

    lessonCard.innerHTML = `
      <h3>${lesson.title}</h3>
      <p><strong>Grade Level:</strong> ${lesson.grade} | <strong>Duration:</strong> ${lesson.duration}</p>
      <h4>Learning Objectives:</h4>
      <ul>
        ${(lesson.objectives || []).map(obj => `<li>${obj}</li>`).join('')}
      </ul>
      <h4>Activities:</h4>
      <ol>
        ${(lesson.activities || []).map(act => `<li>${act}</li>`).join('')}
      </ol>
      <p><strong>Assessment:</strong> ${lesson.assessment || ''}</p>
      <p><strong>Extensions:</strong> ${lesson.extensions || ''}</p>
      <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn-primary download-lesson-pdf">📥 Download Lesson PDF</button>
        <button class="btn-secondary download-worksheet">📝 Download Student Worksheet</button>
      </div>
    `;

    const downloadBtn = lessonCard.querySelector('.download-lesson-pdf');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => downloadLessonPlan(lesson.title, lesson));
    }

    const worksheetBtn = lessonCard.querySelector('.download-worksheet');
    if (worksheetBtn) {
      worksheetBtn.addEventListener('click', () => downloadWorksheet(lesson.title, lesson));
    }

    lessonsContainer.appendChild(lessonCard);
  });
}

function downloadLessonPlan(title, lesson) {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - (margin * 2);

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(String(title || 'Lesson Plan'), margin, yPosition);
  yPosition += 12;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text(`Grade Level: ${lesson.grade || ''} | Duration: ${lesson.duration || ''}`, margin, yPosition);
  yPosition += 10;

  doc.setDrawColor(102, 126, 234);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('Learning Objectives', margin, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  (lesson.objectives || []).forEach((obj, i) => {
    const wrapped = doc.splitTextToSize(`${i + 1}. ${obj}`, maxWidth - 5);
    doc.text(wrapped, margin + 5, yPosition);
    yPosition += wrapped.length * 4 + 2;
    if (yPosition > pageHeight - margin) { doc.addPage(); yPosition = margin; }
  });

  yPosition += 3;

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('Activities', margin, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  (lesson.activities || []).forEach((act, i) => {
    const wrapped = doc.splitTextToSize(`${i + 1}. ${act}`, maxWidth - 5);
    doc.text(wrapped, margin + 5, yPosition);
    yPosition += wrapped.length * 4 + 2;
    if (yPosition > pageHeight - margin) { doc.addPage(); yPosition = margin; }
  });

  yPosition += 3;

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('Assessment', margin, yPosition);
  yPosition += 7;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  const assessmentWrapped = doc.splitTextToSize(String(lesson.assessment || ''), maxWidth);
  doc.text(assessmentWrapped, margin, yPosition);
  yPosition += assessmentWrapped.length * 4 + 5;
  if (yPosition > pageHeight - margin) { doc.addPage(); yPosition = margin; }

  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('Extensions', margin, yPosition);
  yPosition += 7;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  const extensionsWrapped = doc.splitTextToSize(String(lesson.extensions || ''), maxWidth);
  doc.text(extensionsWrapped, margin, yPosition);

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(9);
  doc.setFont(undefined, 'italic');
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Computational Ethnomusicology App | Page ${i}/${pageCount}`, margin, pageHeight - 10);
  }

  doc.save(`lesson-${String(title || '').toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

function downloadWorksheet(title, lesson) {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - (margin * 2);

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Student Worksheet', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(14);
  doc.text(String(title || 'Lesson'), margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Name: ___________________________     Date: ___________', margin, yPosition);
  yPosition += 10;

  doc.setDrawColor(102, 126, 234);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('What You Will Learn:', margin, yPosition);
  yPosition += 6;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  (lesson.objectives || []).slice(0, 3).forEach((obj) => {
    const wrapped = doc.splitTextToSize(`• ${obj}`, maxWidth - 5);
    doc.text(wrapped, margin + 3, yPosition);
    yPosition += wrapped.length * 4 + 2;
    if (yPosition > pageHeight - margin) { doc.addPage(); yPosition = margin; }
  });

  yPosition += 5;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Practice Activities:', margin, yPosition);
  yPosition += 6;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  const practices = [
    'Listen to the music sample. What instruments do you hear?',
    'Draw or describe the rhythm pattern you noticed.',
    'Write down 2-3 interesting facts you learned about this culture.'
  ];

  practices.forEach((practice, i) => {
    if (yPosition > pageHeight - 40) { doc.addPage(); yPosition = margin; }
    doc.setFont(undefined, 'bold');
    doc.text(`${i + 1}. ${practice}`, margin, yPosition);
    yPosition += 6;
    doc.setFont(undefined, 'normal');
    for (let line = 0; line < 4; line++) { doc.line(margin + 3, yPosition, pageWidth - margin, yPosition); yPosition += 6; }
    yPosition += 3;
  });

  if (yPosition > pageHeight - 40) { doc.addPage(); yPosition = margin; }
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Reflection:', margin, yPosition);
  yPosition += 6;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('What was the most interesting thing you learned today?', margin, yPosition);
  yPosition += 6;
  for (let line = 0; line < 5; line++) { doc.line(margin + 3, yPosition, pageWidth - margin, yPosition); yPosition += 6; }

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(9);
  doc.setFont(undefined, 'italic');
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Ethnomusicology Explorer | Page ${i}/${pageCount}`, margin, pageHeight - 10);
  }

  doc.save(`worksheet-${String(title || '').toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

/* ---------------------------
  Boot
  IMPORTANT: We only “call if exists”.
  That means your existing app logic stays the boss.
--------------------------- */
/* ---------------------------
  Boot
  IMPORTANT: We only "call if exists".
  That means your existing app logic stays the boss.
--------------------------- */
function boot() {
  try {
    // Detect which page we're on (handle both /page and /page.html)
    let currentPage = window.location.pathname.split('/').pop() || 'index.html';
    // Normalize: add .html if missing
    if (currentPage && !currentPage.includes('.') && currentPage !== '' && currentPage !== '/') {
      currentPage = currentPage + '.html';
    }
    console.log('🚀 Boot: Page detected:', currentPage);
    
    // Core UI (safe for all pages) - wrap each in try/catch
    try {
      if ($('.nav-tabs')) {
        initializeTabs();
        console.log('✓ Tabs initialized');
      }
    } catch (e) { console.warn('Tabs init failed:', e); }
    
    try { initializeAccessibilityMenu(); console.log('✓ Accessibility menu ready'); } catch (e) { console.warn('Accessibility menu failed:', e); }
    try { initializeDarkMode(); console.log('✓ Dark mode ready'); } catch (e) { console.warn('Dark mode failed:', e); }
    try { initializeClassroomMode(); console.log('✓ Classroom mode ready'); } catch (e) { console.warn('Classroom mode failed:', e); }
    try { initializeAudioUnlockOverlay(); console.log('✓ Audio unlock overlay ready'); } catch (e) { console.warn('Audio unlock failed:', e); }

    // Page-specific initialization
    if (currentPage === 'index.html' || currentPage === '' || currentPage === '/') {
      console.log('📄 Landing page - minimal init');
    } else if (currentPage === 'explore.html') {
      console.log('🌍 Explore page init');
      try { 
        initializeWorldMapSafe().then(() => console.log('✓ World map initialized')).catch(e => console.error('❌ World map failed:', e)); 
      } catch (e) { 
        console.error('❌ World map setup failed:', e); 
      }
      try { 
        safeCall(window.displayGlossary); 
        console.log('✓ Glossary called'); 
      } catch (e) { 
        console.error('❌ Glossary failed:', e); 
      }
      try { 
        safeCall(window.displayCultures); 
        console.log('✓ Cultures called'); 
      } catch (e) { 
        console.error('❌ Cultures display failed:', e); 
        console.error('Error details:', e.message, e.stack); 
      }
    } else if (currentPage === 'educators.html') {
      console.log('👨‍🏫 Educators page init');
      try { initializeTeacherDashboard(); console.log('✓ Teacher dashboard ready'); } catch (e) { console.warn('Teacher dashboard failed:', e); }
      try { safeCall(window.initializeLessonPlans); console.log('✓ Lesson plans ready'); } catch (e) { console.warn('Lesson plans failed:', e); }
      try { safeCall(window.initializeProgress); console.log('✓ Progress tracker ready'); } catch (e) { console.warn('Progress failed:', e); }
    } else if (currentPage === 'analyze.html') {
      console.log('📊 Analyze page init');
      try { initializeAnalyzeUpload(); console.log('✓ Analyze upload ready'); } catch (e) { console.warn('Analyze upload failed:', e); }
      try { initializeDownloadsOnce(); console.log('✓ Downloads ready'); } catch (e) { console.warn('Downloads failed:', e); }
      try { ensureAnalyzerGlobals(); console.log('✓ Analyzer globals ready'); } catch (e) { console.warn('Analyzer globals failed:', e); }
    } else if (currentPage === 'learn.html') {
      console.log('🎮 Learn page init');
      try { safeCall(window.initializeGames); console.log('✓ Games initialized'); } catch (e) { console.warn('Games failed:', e); }
      try { safeCall(window.displayGlossary); console.log('✓ Glossary displayed'); } catch (e) { console.warn('Glossary failed:', e); }
    } else if (currentPage === 'create.html') {
      console.log('🎵 Create page init');
      try { safeCall(window.initializeComposer); console.log('✓ Composer ready'); } catch (e) { console.warn('Composer failed:', e); }
      try { safeCall(window.initializeRecorder); console.log('✓ Recorder ready'); } catch (e) { console.warn('Recorder failed:', e); }
      try { safeCall(window.initializeLivePitch); console.log('✓ Live pitch ready'); } catch (e) { console.warn('Live pitch failed:', e); }
    } else {
      console.log('❓ Unknown/fallback page init');
      try { initializeWorldMapSafe(); } catch (e) { console.warn('World map failed:', e); }
      try { initializeAnalyzeUpload(); } catch (e) { console.warn('Analyze upload failed:', e); }
      try { initializeDownloadsOnce(); } catch (e) { console.warn('Downloads failed:', e); }
      try { safeCall(window.initializeGames); } catch (e) { console.warn('Games failed:', e); }
      try { safeCall(window.initializeRecorder); } catch (e) { console.warn('Recorder failed:', e); }
      try { safeCall(window.initializeLivePitch); } catch (e) { console.warn('Live pitch failed:', e); }
      try { safeCall(window.initializeComposer); } catch (e) { console.warn('Composer failed:', e); }
      try { safeCall(window.initializeLessonPlans); } catch (e) { console.warn('Lesson plans failed:', e); }
      try { safeCall(window.initializeProgress); } catch (e) { console.warn('Progress failed:', e); }
      try { safeCall(window.displayGlossary); } catch (e) { console.warn('Glossary failed:', e); }
      try { safeCall(window.displayCultures); } catch (e) { console.warn('Cultures failed:', e); }
      try { ensureAnalyzerGlobals(); } catch (e) { console.warn('Analyzer globals failed:', e); }
    }
    console.log('✅ Boot sequence complete');
  } catch (e) {
    console.error('❌ Critical boot failure:', e);
  }
}

document.addEventListener('DOMContentLoaded', boot);

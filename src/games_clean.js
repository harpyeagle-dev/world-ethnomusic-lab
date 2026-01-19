// Clean, minimal and dependency-safe game module
// Provides small utilities used across Learn page and reports

import essentiaHelper from './utils/essentiaHelper.js';

export class RhythmAnalysisGame {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.targetTempo = 120;
    this.microphone = null;
    this.analyser = null;
    this.isListening = false;
    this.detectedBeats = [];
    this.targetBeats = [];
    this.score = 0;
    essentiaHelper.initialize();
  }

  setTargetPattern(tempo, beats = [0, 1, 2, 3]) {
    this.targetTempo = tempo;
    this.targetBeats = beats;
    this.detectedBeats = [];
  }

  playClick(time) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    const master = (typeof window !== 'undefined' && window.__MASTER_GAIN) ? window.__MASTER_GAIN : null;
    (master ? gain.connect(master) : gain.connect(this.audioContext.destination));
    osc.frequency.value = 1000;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.06);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  playTargetPattern() {
    const secPerBeat = 60 / this.targetTempo;
    const now = this.audioContext.currentTime;
    this.targetBeats.forEach(b => this.playClick(now + b * secPerBeat));
  }

  async startListening(onBeat) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.microphone.connect(this.analyser);
      this.isListening = true;

      const buf = new Float32Array(this.analyser.fftSize);
      let lastOnset = 0;
      const minGap = 0.15;

      const loop = () => {
        if (!this.isListening) return;
        this.analyser.getFloatTimeDomainData(buf);
        let energy = 0;
        for (let i = 0; i < buf.length; i++) energy += Math.abs(buf[i]);
        energy /= buf.length;
        const t = this.audioContext.currentTime;
        if (energy > 0.05 && (t - lastOnset) > minGap) {
          lastOnset = t;
          const secPerBeat = 60 / this.targetTempo;
          const beatTime = (t % (secPerBeat * 8)) / secPerBeat;
          this.detectedBeats.push(beatTime);
          if (typeof onBeat === 'function') onBeat(beatTime);
        }
        requestAnimationFrame(loop);
      };
      loop();
      return true;
    } catch (e) {
      console.error('Rhythm mic access error:', e);
      return false;
    }
  }

  stopListening() {
    this.isListening = false;
    try { this.microphone?.disconnect(); } catch {}
    try { this.analyser?.disconnect(); } catch {}
    try { this.microphone?.mediaStream?.getTracks()?.forEach(t => t.stop()); } catch {}
    this.microphone = null;
    this.analyser = null;
  }

  comparePattern(toleranceBeats = 0.25) {
    const patternLen = Math.max(1, (this.targetBeats.at(-1) || 4) + 1);
    const detected = this.detectedBeats.map(b => ((b % patternLen) + patternLen) % patternLen);
    let hits = 0;
    this.targetBeats.forEach(tb => {
      const match = detected.some(db => Math.abs(db - tb) <= toleranceBeats);
      if (match) hits++;
    });
    const score = Math.round((hits / this.targetBeats.length) * 100);
    this.score = score;
    return { hits, total: this.targetBeats.length, score };
  }
}

export class TimbreAnalysisGame {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.microphone = null;
    this.analyser = null;
    this.isListening = false;
    this.instrumentIdentifier = new InstrumentIdentifier();
    essentiaHelper.initialize();
  }

  async start(onUpdate) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.microphone.connect(this.analyser);
      this.isListening = true;

      const timeBuf = new Float32Array(this.analyser.fftSize);
      const loop = () => {
        if (!this.isListening) return;
        this.analyser.getFloatTimeDomainData(timeBuf);
        const spec = essentiaHelper.analyzeSpectrum(timeBuf);
        const centroidHz = (spec?.centroid || 0.5) * (this.audioContext.sampleRate / 2);
        const attackTime = 0.05;
        const sustainLevel = 0.5;
        const guess = this.instrumentIdentifier.identifyFromFeatures(centroidHz, attackTime, sustainLevel);
        if (typeof onUpdate === 'function') {
          onUpdate({ centroidHz, rolloff: spec?.rolloff || 0, flatness: spec?.flatness || 0, guess });
        }
        requestAnimationFrame(loop);
      };
      loop();
      return true;
    } catch (e) {
      console.error('Timbre mic access error:', e);
      return false;
    }
  }

  stop() {
    this.isListening = false;
    try { this.microphone?.disconnect(); } catch {}
    try { this.analyser?.disconnect(); } catch {}
    try { this.microphone?.mediaStream?.getTracks()?.forEach(t => t.stop()); } catch {}
    this.microphone = null;
    this.analyser = null;
  }
}

export class InstrumentIdentifier {
  constructor() {
    this.instruments = [
      { name: 'Piano', timbre: 'harmonic', attack: 'fast', sustain: 'long' },
      { name: 'Guitar', timbre: 'harmonic', attack: 'medium', sustain: 'medium' },
      { name: 'Violin', timbre: 'harmonic', attack: 'slow', sustain: 'long' },
      { name: 'Trumpet', timbre: 'bright', attack: 'medium', sustain: 'medium' },
      { name: 'Flute', timbre: 'pure', attack: 'medium', sustain: 'long' },
      { name: 'Drums', timbre: 'percussive', attack: 'fast', sustain: 'short' },
      { name: 'Sitar', timbre: 'resonant', attack: 'medium', sustain: 'long' },
      { name: 'Didgeridoo', timbre: 'drone', attack: 'slow', sustain: 'continuous' }
    ];
  }

  identifyFromFeatures(spectralCentroid, attackTime, sustainLevel) {
    const scores = this.instruments.map(inst => {
      let score = 0;
      if (spectralCentroid > 3000 && inst.timbre === 'bright') score += 3;
      if (spectralCentroid < 1000 && inst.timbre === 'drone') score += 3;
      if (spectralCentroid > 1000 && spectralCentroid < 3000 && inst.timbre === 'harmonic') score += 3;
      if (attackTime < 0.01 && inst.attack === 'fast') score += 2;
      if (attackTime > 0.1 && inst.attack === 'slow') score += 2;
      return { instrument: inst.name, score };
    });
    scores.sort((a, b) => b.score - a.score);
    return scores[0].instrument;
  }

  getRandomInstrument() {
    return this.instruments[Math.floor(Math.random() * this.instruments.length)];
  }
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generatePDF(analysisData) {
  let report = `ETHNOMUSICOLOGY ANALYSIS REPORT\n`;
  report += `Generated: ${new Date().toLocaleDateString()}\n\n`;
  report += `=== ANALYSIS RESULTS ===\n\n`;
  if (analysisData.rhythm) {
    report += `Rhythm Analysis:\n`;
    report += `- Tempo: ${analysisData.rhythm.tempo} BPM\n`;
    report += `- Regularity: ${(analysisData.rhythm.regularity * 100).toFixed(1)}%\n`;
    report += `- Beats Detected: ${analysisData.rhythm.peakCount}\n\n`;
  }
  if (analysisData.pitch) {
    report += `Pitch Analysis:\n`;
    report += `- Average Frequency: ${analysisData.pitch.avgPitch} Hz\n`;
    report += `- Range: ${analysisData.pitch.min} - ${analysisData.pitch.max} Hz\n\n`;
  }
  if (analysisData.cultural) {
    report += `Cultural Matches:\n`;
    analysisData.cultural.forEach((match, i) => {
      report += `${i + 1}. ${match.culture.name} (${(match.confidence * 100).toFixed(1)}%)\n`;
    });
  }
  const blob = new Blob([report], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ethnomusicology-report.txt';
  a.click();
  URL.revokeObjectURL(url);
}

export class MusicComposer {
  constructor(audioContext) {
    this.audioContext = audioContext;
  }
  playTone(freq, time, duration = 0.3) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    const master = (typeof window !== 'undefined' && window.__MASTER_GAIN) ? window.__MASTER_GAIN : null;
    (master ? gain.connect(master) : gain.connect(this.audioContext.destination));
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(0.28, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.start(time);
    osc.stop(time + duration + 0.01);
  }
}

// Learn page initializer wires the buttons
function initializeGames() {
  const ctx = (typeof window !== 'undefined' ? (window.audioContext || new (window.AudioContext || window.webkitAudioContext)()) : null);
  if (ctx && !window.audioContext) window.audioContext = ctx;

  const rhythmBtn = document.getElementById('start-rhythm-game');
  const quizBtn = document.getElementById('start-quiz');
  const scaleSelect = document.getElementById('scale-select');
  const playScaleBtn = document.getElementById('play-scale');

  if (rhythmBtn) {
    const rhythm = new RhythmAnalysisGame(ctx);
    rhythm.setTargetPattern(120, [0, 1, 2, 3]);
    rhythmBtn.addEventListener('click', async () => {
      rhythm.playTargetPattern();
      await rhythm.startListening();
      rhythmBtn.textContent = 'Listening… tap the rhythm!';
      setTimeout(() => {
        rhythm.stopListening();
        const res = rhythm.comparePattern(0.3);
        rhythmBtn.textContent = `Score: ${res.score}% (restart)`;
      }, 6000);
    });
  }

  if (quizBtn) {
    const questions = [
      { q: 'Which instrument is central to Indian classical music?', opts: ['Sitar','Guitar','Piano','Trumpet'], ok: 0 },
      { q: 'What is a pentatonic scale?', opts: ['3 notes','5 notes','7 notes','12 notes'], ok: 1 },
      { q: 'The kora is from which region?', opts: ['East Asia','West Africa','Europe','South America'], ok: 1 }
    ];
    let i = 0, score = 0;
    quizBtn.addEventListener('click', () => {
      const q = questions[i];
      const choice = prompt(`${q.q}\n\nA) ${q.opts[0]}\nB) ${q.opts[1]}\nC) ${q.opts[2]}\nD) ${q.opts[3]}\n\nType A/B/C/D`);
      const map = { A:0, B:1, C:2, D:3 };
      if (map[(choice||'').toUpperCase()] === q.ok) score++;
      i++;
      if (i >= questions.length) {
        alert(`Quiz complete! Score: ${score}/${questions.length}`);
        i = 0; score = 0;
      }
    });
  }

  if (playScaleBtn && scaleSelect) {
    const composer = new MusicComposer(ctx);
    const scalesHz = {
      major:    [261.63,293.66,329.63,349.23,392.00,440.00,493.88,523.25],
      minor:    [220.00,246.94,261.63,293.66,329.63,349.23,392.00,440.00],
      pentatonic:[261.63,293.66,329.63,392.00,440.00,523.25],
      raga:     [261.63,277.18,311.13,349.23,392.00,440.00,466.16,523.25],
      maqam:    [261.63,277.18,329.63,349.23,392.00,415.30,493.88,523.25]
    };
    playScaleBtn.addEventListener('click', async () => {
      try { await ctx.resume?.(); } catch {}
      const sel = scaleSelect.value || 'major';
      const now = ctx.currentTime;
      const notes = scalesHz[sel] || scalesHz.major;
      notes.forEach((f, idx) => composer.playTone(f, now + idx * 0.45, 0.32));
    });
  }
}

if (typeof window !== 'undefined') {
  window.initializeGames = window.initializeGames || initializeGames;
}

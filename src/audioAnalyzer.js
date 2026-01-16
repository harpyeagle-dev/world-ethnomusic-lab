import Essentia from 'essentia.js/dist/essentia-wasm.web.js';
import MLTrainer from './mlTrainer.js';
import IndigenousTrainer from './indigenousTrainer.js';
import { genreMLClassifier } from './genreMLModel.js';

export class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyzer = null;
        this.player = null;
        this.previousSpectrum = null;
        this.browserOptimizations = this.detectBrowserOptimizations();
        this.essentia = null;
        this.essentiaReady = false;
        this._hannCache = new Map();
        this.mlClassifier = genreMLClassifier;
        this.mlClassifierReady = false;
        this.indigenousClassifier = IndigenousTrainer;
        this.indigenousClassifierReady = false;
    }

    /**
     * Detect browser and apply optimizations for consistent analysis
     * @returns {Object} Browser-specific settings
     */
    detectBrowserOptimizations() {
        const ua = navigator.userAgent.toLowerCase();
        const isSafari = /safari/.test(ua) && !/chrome/.test(ua);
        
        return {
            isSafari,
            // Chrome processes broadly - use SMALLER FFT to narrow analysis to match Safari
            // Safari processes narrowly - use LARGER FFT to expand analysis to match Chrome
            fftSize: isSafari ? 4096 : 1024,
            // Chrome has broader smoothing - reduce it, Safari keep higher
            smoothingTimeConstant: isSafari ? 0.9 : 0.7
        };
    }

    async initialize() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyzer = this.audioContext.createAnalyser();
        // Use browser-optimized FFT size for consistency across Safari and Chrome
        this.analyzer.fftSize = this.browserOptimizations.fftSize;
        // Apply smoothing constant to stabilize frequency analysis
        this.analyzer.smoothingTimeConstant = this.browserOptimizations.smoothingTimeConstant;
        
        // Initialize Essentia.js
        try {
            this.essentia = new Essentia();
            await this.essentia.ready;
            this.essentiaReady = true;
            console.log('Essentia.js initialized successfully');
        } catch (error) {
            console.warn('Essentia.js initialization failed, falling back to basic analysis:', error);
            this.essentiaReady = false;
        }

        // Initialize ML Genre Classifier
        try {
            await this.mlClassifier.loadModel();
            this.mlClassifierReady = true;
            console.log('ML Genre Classifier initialized successfully');
        } catch (error) {
            console.warn('ML Genre Classifier initialization failed, using heuristic classification:', error);
            this.mlClassifierReady = false;
        }

        // Initialize Indigenous Classifier
        try {
            const indigenous = await this.indigenousClassifier.initialize();
            this.indigenousClassifierReady = indigenous;
            if (indigenous) {
                console.log('✅ Indigenous Classifier trained and ready');
            } else {
                console.warn('Indigenous Classifier initialization failed');
            }
        } catch (error) {
            console.warn('Indigenous Classifier initialization error:', error);
            this.indigenousClassifierReady = false;
        }
    }

    /**
     * Extract comprehensive features using Essentia.js
     * Returns MFCC, spectral features, onset detection, key detection
     * @param {Float32Array} buffer - Audio buffer
     * @returns {Object} Rich feature set from Essentia
     */
    extractEssentiaFeatures(buffer) {
        // Normalize input to a Float32Array and trim to a sane window (<=15s) for TF log-mel
        const sampleRate = buffer?.sampleRate || this.audioContext?.sampleRate || 44100;
        const sourceArray = buffer?.getChannelData ? buffer.getChannelData(0) : buffer;
        if (!sourceArray || typeof sourceArray.length !== 'number') {
            return { ...this.extractBasicFeatures(new Float32Array(0)), rawAudio: null, sampleRate, sourceHash: `empty|${sampleRate}` };
        }

        const maxSamples = Math.min(sourceArray.length, Math.floor(sampleRate * 15));
        const audioSlice = sourceArray.slice(0, maxSamples);

        // Build a lightweight, deterministic signature of the input so we can detect stale/identical inputs
        // Uses length, energy, and 8 evenly spaced sample points
        let sigSamples = [];
        const step = Math.max(1, Math.floor(audioSlice.length / 8));
        for (let i = 0; i < 8; i++) {
            const idx = Math.min(audioSlice.length - 1, i * step);
            const v = audioSlice[idx] || 0;
            sigSamples.push(Number(v.toFixed(6)));
        }
        const energy = this.calculateEnergy(audioSlice);
        const sourceHash = `${audioSlice.length}|${sampleRate}|${energy}|${sigSamples.join(',')}`;

        if (!this.essentiaReady || !this.essentia) {
            const basic = this.extractBasicFeatures(audioSlice);
            return { ...basic, rawAudio: audioSlice, sampleRate, sourceHash };
        }

        try {
            const features = {
                mfcc: [],
                spectralFlux: 0,
                centroid: 0,
                spread: 0,
                rolloff: 0,
                onsetStrength: 0,
                keyDetection: null,
                tempo: 0,
                rawFeatures: {},
                rawAudio: audioSlice,
                sampleRate,
                sourceHash
            };

            // Extract MFCC (Mel-frequency cepstral coefficients) - capture timbral characteristics
            try {
                const mfccResult = this.essentia.MFCC(audioSlice);
                if (mfccResult && mfccResult.mfcc) {
                    features.mfcc = Array.from(mfccResult.mfcc).slice(0, 13);
                    features.rawFeatures.mfcc = features.mfcc;
                }
            } catch (e) {
                console.warn('[Essentia] MFCC extraction failed:', e);
            }

            // Extract spectral features
            try {
                const fftSize = Math.pow(2, Math.ceil(Math.log2(audioSlice.length)));
                const spectrum = this.essentia.Spectrum(audioSlice, fftSize);
                
                if (spectrum) {
                    const centroidResult = this.essentia.SpectralCentroidTime(spectrum);
                    if (centroidResult && centroidResult.centroid) {
                        features.centroid = centroidResult.centroid / 22050;
                        features.rawFeatures.centroid = centroidResult.centroid;
                    }

                    const spreadResult = this.essentia.SpectralSpreadTime(spectrum);
                    if (spreadResult && spreadResult.spread) {
                        features.spread = Math.min(1, spreadResult.spread / 5000);
                        features.rawFeatures.spread = spreadResult.spread;
                    }

                    const rolloffResult = this.essentia.SpectralRolloffTime(spectrum);
                    if (rolloffResult && rolloffResult.rolloff) {
                        features.rolloff = rolloffResult.rolloff / 22050;
                        features.rawFeatures.rolloff = rolloffResult.rolloff;
                    }
                }
            } catch (e) {
                console.warn('[Essentia] Spectral feature extraction failed:', e);
            }

            // Extract onset strength (percussion detection)
            try {
                const onsetStrength = this.essentia.OnsetStrength(audioSlice);
                if (onsetStrength && onsetStrength.length > 0) {
                    features.onsetStrength = Math.min(1, onsetStrength.reduce((a, b) => a + b, 0) / onsetStrength.length);
                    features.rawFeatures.onsetStrength = features.onsetStrength;
                }
            } catch (e) {
                console.warn('[Essentia] Onset detection failed:', e);
            }

            // Key detection (scale detection)
            try {
                const keyResult = this.essentia.KeyExtractor(audioSlice);
                if (keyResult && keyResult.key) {
                    features.keyDetection = {
                        key: keyResult.key,
                        scale: keyResult.scale,
                        strength: keyResult.strength || 0
                    };
                    features.rawFeatures.keyStrength = keyResult.strength || 0;
                }
            } catch (e) {
                console.warn('[Essentia] Key detection failed:', e);
            }

            // Tempo/BPM detection
            try {
                const tempoResult = this.essentia.TempoScalarToVectorPhase(audioSlice);
                if (tempoResult && tempoResult.bpm) {
                    features.tempo = tempoResult.bpm;
                    features.rawFeatures.tempo = tempoResult.bpm;
                }
            } catch (e) {
                console.warn('[Essentia] Tempo detection failed:', e);
            }

            return features;
        } catch (err) {
            console.error('[Essentia] Feature extraction failed:', err);
            const fallback = this.extractBasicFeatures(audioSlice);
            return { ...fallback, rawAudio: audioSlice, sampleRate, sourceHash };
        }
    }

    /**
     * Fallback: extract basic features without Essentia
     * @param {Float32Array} buffer - Audio buffer
     * @returns {Object} Basic feature set
     */
    extractBasicFeatures(buffer) {
        return {
            mfcc: Array(13).fill(0),
            spectralFlux: 0,
            centroid: 0.5,
            spread: 0.3,
            rolloff: 0.7,
            onsetStrength: 0,
            keyDetection: null,
            tempo: 0,
            rawFeatures: {}
        };
    }

    /**
     * Enhanced pitch detection using Essentia.js PredominantPitchMelodia
     * Falls back to autocorrelation if essentia unavailable
     * @param {Float32Array} buffer - Audio buffer
     * @returns {number} Detected frequency in Hz
     */
    detectPitchEssentia(buffer) {
        // Essentia.js web build doesn't support all algorithms reliably
        // Fall back to basic detection for now
        return this.detectPitch(buffer);
    }

    /**
     * Enhanced rhythm analysis using Essentia.js BeatTracker
     * Falls back to basic analysis if essentia unavailable
     * @param {Float32Array} buffer - Audio buffer
     * @returns {Object} Rhythm analysis results
     */
    analyzeRhythmEssentia(buffer) {
        // Essentia.js web build doesn't support all algorithms reliably
        // Fall back to basic analysis for now
        return this.analyzeRhythm(buffer);
    }

    /**
     * Enhanced spectral analysis using Essentia.js
     * @param {Float32Array} frequencyData - FFT data
     * @returns {Object} Spectral features
     */
    analyzeSpectralFeaturesEssentia(frequencyData) {
        // Essentia.js web build doesn't support all algorithms reliably
        // Fall back to basic analysis for now
        return this.analyzeSpectralFeatures(frequencyData);
    }

    /**
     * Attempt to extract MFCC features using Essentia.js
     * Returns null on failure or when Essentia is unavailable.
     * @param {Float32Array} audioBuffer
     * @param {number} sampleRate
     * @returns {Object|null} { mfccMean: number[], mfccVar: number[] }
     */
    extractMFCCFeatures(audioBuffer, sampleRate) {
        if (!this.essentiaReady || !this.essentia) return null;
        try {
            const e = this.essentia;
            const frameSize = 1024;
            const hopSize = 512;
            const maxFrames = 60;

            // Prepare Hann window
            const hann = this._getHannWindow(frameSize);

            const means = [];
            const sums = null;
            const accum = [];
            let count = 0;
            for (let i = 0; i + frameSize <= audioBuffer.length && count < maxFrames; i += hopSize) {
                const frameArr = new Float32Array(frameSize);
                for (let j = 0; j < frameSize; j++) frameArr[j] = audioBuffer[i + j] * hann[j];

                // Convert to Essentia vector
                const frameVec = e.arrayToVector(frameArr);
                const spectrum = e.Spectrum(frameVec);
                // Use MFCC defaults; returns object with bands and mfcc
                const mfccOut = e.MFCC(spectrum);
                const coeffs = e.vectorToArray(mfccOut.mfcc);

                // Initialize accum
                if (accum.length === 0) {
                    for (let k = 0; k < coeffs.length; k++) accum.push({ sum: 0, sumsq: 0 });
                }
                for (let k = 0; k < coeffs.length; k++) {
                    const v = coeffs[k];
                    accum[k].sum += v;
                    accum[k].sumsq += v * v;
                }
                count++;
            }

            if (count === 0 || accum.length === 0) return null;
            const mfccMean = accum.map(a => a.sum / count);
            const mfccVar = accum.map(a => Math.max(0, (a.sumsq / count) - Math.pow(a.sum / count, 2)));
            return { mfccMean, mfccVar };
        } catch (err) {
            console.warn('MFCC extraction failed (falling back):', err?.message || err);
            return null;
        }
    }

    _getHannWindow(size) {
        if (this._hannCache.has(size)) return this._hannCache.get(size);
        const win = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
        }
        this._hannCache.set(size, win);
        return win;
    }

    /**
     * Enhanced key detection using Essentia.js
     * @param {Array} pitches - Array of detected pitches
     * @returns {Object} Key and scale analysis
     */
    detectKeyEssentia(buffer) {
        // Essentia.js web build doesn't support KeyExtractor reliably
        // Return null to use fallback scale detection
        return null;
    }

    /**
     * Analyze pitch using autocorrelation (fallback method)
     * @param {Float32Array} buffer - Audio buffer
     * @returns {number} Detected frequency in Hz
     */
    detectPitch(buffer) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let best_offset = -1;
        let best_correlation = 0;
        let rms = 0;
        
        // Calculate RMS (Root Mean Square) with improved noise gate
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        
        // Adaptive threshold based on signal strength
        const noiseFloor = 0.005;
        if (rms < noiseFloor) return -1;
        
        // Normalize buffer for better correlation
        const normalized = new Float32Array(SIZE);
        for (let i = 0; i < SIZE; i++) {
            normalized[i] = buffer[i] / rms;
        }
        
        // Improved autocorrelation with parabolic interpolation
        const MIN_FREQUENCY = 80;  // Hz
        const MAX_FREQUENCY = 1000; // Hz
        const minOffset = Math.floor(this.audioContext.sampleRate / MAX_FREQUENCY);
        const maxOffset = Math.floor(this.audioContext.sampleRate / MIN_FREQUENCY);
        
        for (let offset = minOffset; offset < Math.min(maxOffset, MAX_SAMPLES); offset++) {
            let correlation = 0;
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += normalized[i] * normalized[i + offset];
            }
            correlation = correlation / MAX_SAMPLES;
            
            if (correlation > best_correlation) {
                best_correlation = correlation;
                best_offset = offset;
            }
        }
        
        // Require minimum correlation strength
        if (best_correlation > 0.3 && best_offset !== -1) {
            // Parabolic interpolation for sub-sample accuracy
            let refined_offset = best_offset;
            if (best_offset > 0 && best_offset < MAX_SAMPLES - 1) {
                let c1 = 0, c2 = best_correlation, c3 = 0;
                
                for (let i = 0; i < MAX_SAMPLES; i++) {
                    c1 += normalized[i] * normalized[i + best_offset - 1];
                    c3 += normalized[i] * normalized[i + best_offset + 1];
                }
                c1 /= MAX_SAMPLES;
                c3 /= MAX_SAMPLES;
                
                // Parabolic peak interpolation
                const delta = 0.5 * (c1 - c3) / (c1 - 2 * c2 + c3);
                refined_offset = best_offset + delta;
            }
            
            const fundamental = this.audioContext.sampleRate / refined_offset;
            return fundamental;
        }
        return -1;
    }

    /**
     * Detect rhythm patterns and tempo
     * @param {Float32Array} buffer - Audio buffer
     * @param {number} sampleRate - Optional sample rate (defaults to audioContext.sampleRate)
     * @returns {Object} Rhythm analysis results
     */
    analyzeRhythm(buffer, sampleRate = null) {
        // Basic rhythm analysis
        const peaks = this.detectOnsets(buffer);
        const intervals = [];
        
        for (let i = 1; i < peaks.length; i++) {
            intervals.push(peaks[i] - peaks[i - 1]);
        }
        
        // Use provided sampleRate or fall back to audioContext
        const sr = sampleRate || (this.audioContext ? this.audioContext.sampleRate : 44100);
        // Calculate average interval deterministically (remove prior random variation)
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        // avgInterval is in samples. Convert to seconds, then to BPM
        // BPM = 60 / (interval in seconds) = 60 / (samples / sampleRate) = 60 * sampleRate / samples
        const tempo = avgInterval > 0 ? (60 * sr) / avgInterval : 0;
        
        return {
            tempo: Math.round(Math.max(0, tempo)),
            peakCount: peaks.length,
            regularity: this.calculateRegularity(intervals),
            intervals: intervals
        };
    }

    /**
     * Detect onset events (note starts)
     * @param {Float32Array} buffer - Audio buffer
     * @returns {Array} Array of onset positions
     */
    detectOnsets(buffer) {
        const WINDOW_SIZE = 1024;
        const HOP_SIZE = 512;
        const peaks = [];
        let previousEnergy = 0;
        const energyHistory = [];
        
        // First pass: calculate all energies
        for (let i = 0; i < buffer.length - WINDOW_SIZE; i += HOP_SIZE) {
            let energy = 0;
            for (let j = 0; j < WINDOW_SIZE; j++) {
                energy += buffer[i + j] * buffer[i + j];
            }
            energy = Math.sqrt(energy / WINDOW_SIZE);
            energyHistory.push({ position: i, energy: energy });
        }
        
        // Calculate adaptive threshold (median + factor * std dev) deterministically
        const energies = energyHistory.map(e => e.energy);
        energies.sort((a, b) => a - b);
        const median = energies[Math.floor(energies.length / 2)];
        const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
        const variance = energies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / energies.length;
        const stdDev = Math.sqrt(variance);
        const thresholdFactor = 0.55; // fixed factor for stability
        const adaptiveThreshold = median + thresholdFactor * stdDev;
        
        // Second pass: detect peaks with adaptive threshold and spectral flux
        for (let i = 1; i < energyHistory.length - 1; i++) {
            const curr = energyHistory[i].energy;
            const prev = energyHistory[i - 1].energy;
            const next = energyHistory[i + 1].energy;
            
            // Peak detection: local maximum above adaptive threshold
            const isLocalMax = curr > prev && curr > next;
            const aboveThreshold = curr > adaptiveThreshold;
            const significantIncrease = (curr - prev) > (stdDev * 0.3);
            
            if (isLocalMax && aboveThreshold && significantIncrease) {
                // Ensure minimum spacing between peaks deterministically
                const minSpacing = HOP_SIZE * 2;
                if (peaks.length === 0 || energyHistory[i].position - peaks[peaks.length - 1] > minSpacing) {
                    peaks.push(energyHistory[i].position);
                }
            }
        }
        
        return peaks;
    }

    /**
     * Calculate rhythm regularity
     * @param {Array} intervals - Array of time intervals
     * @returns {number} Regularity score (0-1)
     */
    calculateRegularity(intervals) {
        if (intervals.length < 2) return 0;
        
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        
        // Coefficient of variation (inverted and normalized)
        const cv = stdDev / mean;
        return Math.max(0, 1 - cv);
    }

    /**
     * Analyze spectral features (timbre)
     * @param {Float32Array} frequencyData - FFT data
     * @returns {Object} Spectral features
     */
    analyzeSpectralFeatures(frequencyData) {
        // Basic spectral analysis
        const spectralCentroid = this.calculateSpectralCentroid(frequencyData);
        const spectralRolloff = this.calculateSpectralRolloff(frequencyData);
        const spectralFlux = this.calculateSpectralFlux(frequencyData);
        
        return {
            centroid: spectralCentroid,
            rolloff: spectralRolloff,
            flux: spectralFlux,
            brightness: spectralCentroid / (this.audioContext.sampleRate / 2)
        };
    }

    /**
     * Calculate spectral centroid (brightness)
     * @param {Float32Array} frequencyData - FFT data
     * @returns {number} Spectral centroid
     */
    calculateSpectralCentroid(frequencyData) {
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < frequencyData.length; i++) {
            const magnitude = frequencyData[i];
            const frequency = i * this.audioContext.sampleRate / (frequencyData.length * 2);
            numerator += frequency * magnitude;
            denominator += magnitude;
        }
        
        return denominator > 0 ? numerator / denominator : 0;
    }

    /**
     * Calculate spectral rolloff
     * @param {Float32Array} frequencyData - FFT data
     * @returns {number} Spectral rolloff frequency
     */
    calculateSpectralRolloff(frequencyData, threshold = 0.85) {
        let totalEnergy = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            totalEnergy += frequencyData[i];
        }
        
        let cumulativeEnergy = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            cumulativeEnergy += frequencyData[i];
            if (cumulativeEnergy >= threshold * totalEnergy) {
                return i * this.audioContext.sampleRate / (frequencyData.length * 2);
            }
        }
        
        return 0;
    }

    /**
     * Calculate spectral flux (measure of change)
     * @param {Float32Array} frequencyData - FFT data
     * @returns {number} Spectral flux
     */
    calculateSpectralFlux(frequencyData) {
        if (!this.previousSpectrum) {
            this.previousSpectrum = new Float32Array(frequencyData);
            return 0;
        }
        
        let flux = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            const difference = frequencyData[i] - this.previousSpectrum[i];
            flux += difference * difference;
        }
        
        this.previousSpectrum = new Float32Array(frequencyData);
        return Math.sqrt(flux);
    }

    /**
     * Identify musical scale from pitch data
     * @param {Array} pitches - Array of detected pitches
     * @returns {Object} Scale analysis
     */
    identifyScale(pitches) {
        if (!pitches || pitches.length === 0) return { scale: 'Unknown', score: 0, confidence: 0 };

        // Build pitch-class histogram
        const pitchClasses = pitches.map(p => this.frequencyToMidiNote(p) % 12);
        const hist = new Array(12).fill(0);
        for (const pc of pitchClasses) if (pc >= 0 && pc < 12) hist[pc]++;
        const total = hist.reduce((a, b) => a + b, 0) || 1;
        const normalized = hist.map(v => v / total);
        // Presence threshold to ignore stray noise energy (slightly lower to capture faint notes)
        const present = normalized.map(v => v > 0.01 ? 1 : 0);
        const observedSet = new Set(present.map((v, i) => v ? i : -1).filter(i => i >= 0));
        const uniqueCount = observedSet.size;

        // Immediate chromatic heuristic
        if (uniqueCount >= 10) {
            const conf = Math.min(1, (uniqueCount - 9) / 3 + 0.6); // 10→0.6 .. 12→1.0
            return { scale: 'Chromatic', score: 1, confidence: conf };
        }

        const ROOT_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const baseScales = {
            'Major (Western)': [0, 2, 4, 5, 7, 9, 11],
            'Minor (Western)': [0, 2, 3, 5, 7, 8, 10],
            'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
            'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
            'Pentatonic Major': [0, 2, 4, 7, 9],
            'Pentatonic Minor': [0, 3, 5, 7, 10],
            'Blues': [0, 3, 5, 6, 7, 10],
            'Dorian': [0, 2, 3, 5, 7, 9, 10],
            'Phrygian': [0, 1, 3, 5, 7, 8, 10],
            'Lydian': [0, 2, 4, 6, 7, 9, 11],
            'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
            'Locrian': [0, 1, 3, 5, 6, 8, 10],
            'Whole Tone': [0, 2, 4, 6, 8, 10]
        };

        const rotate = (pattern, root) => pattern.map(p => (p + root) % 12);
        const sumInEnergy = (scaleSet) => {
            let s = 0;
            const inSet = new Set(scaleSet);
            for (let i = 0; i < 12; i++) if (inSet.has(i)) s += normalized[i];
            return s; // fraction of energy that lies within the candidate scale
        };

        const countIntersection = (setA, arrB) => {
            const b = new Set(arrB);
            let inter = 0;
            for (const a of setA) if (b.has(a)) inter++;
            return inter;
        };

        const adjacencyHits = (arrB) => {
            const setB = new Set(arrB);
            let hits = 0;
            for (let i = 0; i < 12; i++) {
                if (setB.has(i) && setB.has((i + 1) % 12)) hits++;
            }
            return hits;
        };

        const priorForSize = (size, uniq) => {
            // Stronger size-aware prior to crush pentatonic when many pitch classes exist
            if (uniq >= 7) {
                if (size <= 5) return 0.4;  // very strong penalty for pentatonic
                if (size === 6) return 0.85;
                if (size >= 7) return 1.15; // boost diatonic completeness
            } else if (uniq >= 6) {
                if (size <= 5) return 0.5;  // heavy penalty
                if (size === 6) return 0.9;
                if (size >= 7) return 1.1;
            } else if (uniq === 5) {
                if (size <= 5) return 0.95; // mild penalty to pentatonic even at 5 classes
                if (size >= 7) return 1.02;
            } else if (uniq <= 4) {
                if (size <= 5) return 1.03; // sparse evidence: pentatonic plausible
                if (size >= 7) return 0.98;
            }
            return 1.0;
        };

        const candidates = [];
        for (const [name, pattern] of Object.entries(baseScales)) {
            for (let root = 0; root < 12; root++) {
                const rotated = rotate(pattern, root);
                // Unique-based intersection counts
                const inter = countIntersection(observedSet, rotated);
                const uniqueCoverage = rotated.length > 0 ? inter / rotated.length : 0; // fraction of candidate tones observed
                const explainedUnique = uniqueCount > 0 ? inter / uniqueCount : 0; // fraction of observed classes explained by candidate

                // Energy-based measures
                const inEnergy = sumInEnergy(rotated);
                const outEnergy = Math.max(0, 1 - inEnergy);

                // Adjacency bonus: reward consecutive scale degrees observed
                const adjHits = adjacencyHits(rotated);
                const adjBonus = Math.min(0.15, adjHits * 0.02);

                // Energy-first score: favor in-scale energy and punish out-of-scale energy
                const energyBalance = inEnergy - 1.3 * outEnergy;
                const coverageTerm = 0.15 * uniqueCoverage + 0.15 * explainedUnique;
                const baseScore = energyBalance + coverageTerm + adjBonus;
                const prior = priorForSize(rotated.length, uniqueCount);
                const score = baseScore * prior;

                candidates.push({ name, root, score, baseScore, uniqueCoverage, explainedUnique, inEnergy, outEnergy, adjBonus, rotated });
            }
        }

        candidates.sort((a, b) => b.score - a.score);
        let best = candidates[0];
        const second = candidates[1] || { score: 0 };
        
        // HARD RULE: If 6+ unique pitch classes detected, always force diatonic over pentatonic
        if (uniqueCount >= 6 && /Pentatonic/.test(best.name)) {
            const diatonic = candidates
                .filter(c => /(Major|Minor|Dorian|Phrygian|Lydian|Mixolydian|Locrian)/.test(c.name))
                .sort((a, b) => b.score - a.score)[0];
            if (diatonic) {
                best = diatonic;
            }
        }
        // If exactly 5 unique classes and pentatonic wins, still prefer diatonic when close
        else if (uniqueCount === 5 && /Pentatonic/.test(best.name)) {
            const diatonic = candidates
                .filter(c => /(Major|Minor|Dorian|Phrygian|Lydian|Mixolydian|Locrian)/.test(c.name))
                .sort((a, b) => b.score - a.score)[0];
            if (diatonic) {
                const marginToDiatonic = best.score - diatonic.score;
                if (marginToDiatonic <= 0.25) {
                    best = diatonic;
                }
            }
        }

        // Confidence: combine margin and coverage, penalize out-of-scale energy
        const margin = Math.max(0, best.score - second.score);
        const coverageForConf = best.uniqueCoverage != null ? best.uniqueCoverage : 0;
        const energyBalance = (best.inEnergy || 0) - (best.outEnergy || 0);
        let confidence = Math.min(1, (margin + coverageForConf + energyBalance + (best.adjBonus || 0)) / 3);
        confidence *= (1 - Math.min(0.7, (best.outEnergy || 0) * 0.7));
        // Reduce confidence if pentatonic selected with richer evidence
        if (/Pentatonic/.test(best.name) && uniqueCount >= 6) confidence *= 0.6;

        // Assemble scale label with detected root
        const label = `${ROOT_NAMES[best.root]} ${best.name}`;
        return { scale: label, score: best.score, confidence };
    }

    /**
     * Convert frequency to MIDI note number
     * @param {number} frequency - Frequency in Hz
     * @returns {number} MIDI note number
     */
    frequencyToMidiNote(frequency) {
        return Math.round(12 * Math.log2(frequency / 440) + 69);
    }

    /**
     * Get note name from MIDI number
     * @param {number} midiNote - MIDI note number
     * @returns {string} Note name
     */
    midiToNoteName(midiNote) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const note = notes[midiNote % 12];
        return `${note}${octave}`;
    }

    /**
     * Calculate Zero Crossing Rate (indicator of percussiveness/noisiness)
     * @param {Float32Array} buffer - Audio buffer
     * @returns {number} ZCR value
     */
    calculateZCR(buffer) {
        let crossings = 0;
        for (let i = 1; i < buffer.length; i++) {
            if ((buffer[i] >= 0 && buffer[i - 1] < 0) || (buffer[i] < 0 && buffer[i - 1] >= 0)) {
                crossings++;
            }
        }
        return crossings / buffer.length;
    }

    /**
     * Calculate temporal features for rhythm complexity
     * @param {Array} intervals - Beat intervals
     * @returns {Object} Temporal features
     */
    calculateTemporalFeatures(intervals) {
        if (intervals.length < 2) return { entropy: 0, complexity: 0 };
        
        // Calculate interval histogram
        const bins = 10;
        const minInterval = Math.min(...intervals);
        const maxInterval = Math.max(...intervals);
        const binWidth = (maxInterval - minInterval) / bins;
        const histogram = new Array(bins).fill(0);
        
        intervals.forEach(interval => {
            const bin = Math.min(bins - 1, Math.floor((interval - minInterval) / (binWidth + 0.001)));
            histogram[bin]++;
        });
        
        // Normalize
        const total = histogram.reduce((a, b) => a + b, 0);
        const probabilities = histogram.map(v => v / total);
        
        // Calculate entropy (measure of rhythmic complexity)
        let entropy = 0;
        probabilities.forEach(p => {
            if (p > 0) {
                entropy -= p * Math.log2(p);
            }
        });
        
        // Complexity score (normalized entropy)
        const maxEntropy = Math.log2(bins);
        const complexity = entropy / maxEntropy;
        
        return { entropy, complexity };
    }

    /**
     * Detect polyrhythmic patterns
     * @param {Array} intervals - Beat intervals
     * @returns {Object} Polyrhythm analysis
     */
    detectPolyrhythm(intervals) {
        // Require enough onsets
        if (intervals.length < 6) return { isPolyrhythmic: false, ratio: null };

        // Stability check (CV): if too steady, don't flag polyrhythm
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / intervals.length;
        const std = Math.sqrt(variance);
        const cv = mean > 0 ? std / mean : 0;
        if (cv < 0.25) return { isPolyrhythmic: false, ratio: null };

        // Find GCD of intervals to detect subdivisions
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const roundedIntervals = intervals.map(i => Math.round(i));
        let commonDivisor = roundedIntervals[0];
        for (let i = 1; i < roundedIntervals.length; i++) {
            commonDivisor = gcd(commonDivisor, roundedIntervals[i]);
        }

        // Check for multiple distinct interval ratios
        const ratios = roundedIntervals.map(i => Math.round(i / commonDivisor));
        const uniqueRatios = [...new Set(ratios)];

        const isPolyrhythmic = uniqueRatios.length > 3 && cv >= 0.25; // Require 4+ ratios and non-steady CV

        return {
            isPolyrhythmic,
            ratio: uniqueRatios.length > 1 ? uniqueRatios.join(':') : null,
            complexity: uniqueRatios.length
        };
    }

    /**
     * Analyze pitch in audio buffer (uses Essentia.js when available)
     * @param {Float32Array} buffer - Audio buffer
     * @param {number} sampleRate - Sample rate
     * @returns {object} Pitch analysis results
     */
    analyzePitch(buffer, sampleRate) {
        // Use Essentia if available, otherwise fallback
        const frequency = this.essentiaReady ? this.detectPitchEssentia(buffer) : this.detectPitch(buffer);
        
        // Convert frequency to note
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75);
        
        let octave = 0;
        let noteName = 'Unknown';
        let clarity = 0;
        
        if (frequency > 0) {
            const semitones = 12 * Math.log2(frequency / C0);
            const noteIndex = Math.round(semitones) % 12;
            octave = Math.floor(semitones / 12);
            noteName = noteNames[noteIndex];
            clarity = this.essentiaReady ? 0.9 : 0.8; // Higher confidence with Essentia
        }
        
        return {
            dominantFrequency: frequency > 0 ? Math.round(frequency * 10) / 10 : 0,
            frequency: frequency > 0 ? Math.round(frequency * 10) / 10 : 0,
            note: frequency > 0 ? noteName + octave : 'None',
            clarity: clarity,
            confidence: clarity
        };
    }

    /**
     * Analyze timbre characteristics
     * @param {Float32Array} buffer - Audio buffer
     * @returns {object} Timbre analysis results
     */
    analyzeTimbre(buffer) {
        // Simple spectral centroid calculation
        const fft = this.computeFFT(buffer);
        let weightedSum = 0;
        let sum = 0;
        
        for (let i = 0; i < fft.length; i++) {
            const magnitude = Math.abs(fft[i]);
            weightedSum += i * magnitude;
            sum += magnitude;
        }
        
        const spectralCentroid = sum > 0 ? (weightedSum / sum) / fft.length : 0;
        
        // Classify brightness (as numeric value 0-1)
        let brightnessLabel = 'Dark';
        let brightnessValue = spectralCentroid;
        if (spectralCentroid > 0.6) brightnessLabel = 'Bright';
        else if (spectralCentroid > 0.3) brightnessLabel = 'Medium';
        
        return {
            spectralCentroid: Math.round(spectralCentroid * 100),
            brightness: brightnessValue,
            brightnessLabel: brightnessLabel,
            energy: this.calculateEnergy(buffer)
        };
    }

    /**
     * Simple FFT calculation
     */
    computeFFT(buffer) {
        const fft = new Float32Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            fft[i] = Math.abs(buffer[i]);
        }
        return fft;
    }

    /**
     * Calculate signal energy
     */
    calculateEnergy(buffer) {
        let energy = 0;
        for (let i = 0; i < buffer.length; i++) {
            energy += buffer[i] * buffer[i];
        }
        return Math.round((energy / buffer.length) * 1000) / 1000;
    }

    /**
     * Genre BPM ranges: defines valid tempo ranges for each genre
     * Used for genre-aware tempo interpretation and octave error detection
     */
    getGenreBPMRanges() {
        return {
            'European Classical': { min: 40, max: 160, ideal: 90 },
            'Indian Classical': { min: 40, max: 180, ideal: 100 },
            'Jazz': { min: 60, max: 200, ideal: 120 },
            'Rock': { min: 100, max: 200, ideal: 140 },
            'Electronic': { min: 80, max: 180, ideal: 130 },
            'Blues': { min: 60, max: 140, ideal: 100 },
            'Folk': { min: 80, max: 140, ideal: 105 },
            'Hip Hop': { min: 85, max: 160, ideal: 95 },
            'Latin': { min: 85, max: 180, ideal: 110 },
            'Metal': { min: 140, max: 220, ideal: 170 },
            'Pop': { min: 90, max: 150, ideal: 120 },
            'Reggae': { min: 75, max: 110, ideal: 95 },
            'Country': { min: 80, max: 140, ideal: 105 },
            'R&B/Soul': { min: 70, max: 130, ideal: 100 },
            'World': { min: 60, max: 180, ideal: 110 }
        };
    }

    /**
     * Detect and correct possible BPM octave errors (e.g., detected at 2x or 0.5x actual)
     * Returns corrected BPM and confidence score
     */
    detectBPMOctaveError(detectedBPM, genres) {
        // If detected BPM is exactly double or half what would be reasonable for detected genres
        const topGenre = Object.entries(genres)
            .sort(([,a], [,b]) => b - a)[0]?.[0];
        
        if (!topGenre) return { bpm: detectedBPM, correction: null, confidence: 1.0 };
        
        const ranges = this.getGenreBPMRanges();
        const range = ranges[topGenre];
        if (!range) return { bpm: detectedBPM, correction: null, confidence: 1.0 };

        // Check if half-tempo is more reasonable
        const halfTempo = detectedBPM * 0.5;
        const doubleTempo = detectedBPM * 2;
        const inHalfRange = halfTempo >= range.min && halfTempo <= range.max;
        const inDoubleRange = doubleTempo >= range.min && doubleTempo <= range.max;
        const inOriginalRange = detectedBPM >= range.min && detectedBPM <= range.max;

        // If half-tempo fits perfectly and original doesn't, correct it
        if (inHalfRange && !inOriginalRange) {
            return { bpm: halfTempo, correction: '0.5x', confidence: 0.85 };
        }
        // If double-tempo fits and original doesn't (rare but possible), correct it
        if (inDoubleRange && !inOriginalRange) {
            return { bpm: doubleTempo, correction: '2x', confidence: 0.70 };
        }
        // Original tempo is valid
        return { bpm: detectedBPM, correction: null, confidence: inOriginalRange ? 1.0 : 0.75 };
    }

    /**
     * Genre profile: defines how to weight features for adaptive classification
     * Allows different genres to be "sensitive" to different features
     */
    getGenreProfile(genreName) {
        const profiles = {
            'Folk': { tempo: 1.2, regularity: 0.8, brightness: 1.0, complexity: 0.9, polyrhythmic: 0.7 },
            'Country': { tempo: 1.1, regularity: 0.9, brightness: 1.1, complexity: 0.8, polyrhythmic: 0.5 },
            'World': { tempo: 1.0, regularity: 0.6, brightness: 0.9, complexity: 1.2, polyrhythmic: 1.3 },
            'Reggae': { tempo: 1.3, regularity: 0.4, brightness: 1.0, complexity: 0.7, polyrhythmic: 0.8 },
            'Jazz': { tempo: 1.0, regularity: 0.5, brightness: 0.95, complexity: 1.4, polyrhythmic: 1.2 },
            'Blues': { tempo: 0.9, regularity: 0.7, brightness: 0.7, complexity: 1.0, polyrhythmic: 0.6 },
            'Rock': { tempo: 1.2, regularity: 1.0, brightness: 1.1, complexity: 1.0, polyrhythmic: 0.8 },
            'Pop': { tempo: 1.0, regularity: 1.1, brightness: 1.2, complexity: 0.7, polyrhythmic: 0.4 },
            'Electronic': { tempo: 1.1, regularity: 1.3, brightness: 1.1, complexity: 0.9, polyrhythmic: 0.5 },
            'Hip Hop': { tempo: 0.95, regularity: 0.9, brightness: 1.0, complexity: 1.1, polyrhythmic: 0.7 },
            'Metal': { tempo: 1.3, regularity: 1.0, brightness: 1.3, complexity: 1.2, polyrhythmic: 0.9 },
            'European Classical': { tempo: 0.8, regularity: 1.2, brightness: 0.9, complexity: 1.3, polyrhythmic: 0.3 },
            'Indian Classical': { tempo: 0.9, regularity: 0.4, brightness: 0.85, complexity: 1.5, polyrhythmic: 1.1 },
            'Latin': { tempo: 1.1, regularity: 0.85, brightness: 1.0, complexity: 1.2, polyrhythmic: 1.4 },
            'R&B/Soul': { tempo: 0.85, regularity: 0.95, brightness: 0.85, complexity: 1.0, polyrhythmic: 0.7 }
        };
        return profiles[genreName] || { tempo: 1.0, regularity: 1.0, brightness: 1.0, complexity: 1.0, polyrhythmic: 1.0 };
    }

    /**
     * Detect genre blends: when top 2-3 genres score similarly, return blend
     * e.g., "Jazz-Rock", "World-Latin", "Electronica-Folk"
     */
    detectGenreBlend(topGenres, scores, threshold = 0.15) {
        if (topGenres.length < 2) return null;
        
        // Check if top 2 genres are close in score (within threshold)
        const scoreDiff = scores[0] - scores[1];
        const maxScore = scores[0];
        const diffRatio = scoreDiff / maxScore;
        
        if (diffRatio < threshold) {
            // Create blend name
            return `${topGenres[0]}-${topGenres[1]}`;
        }
        return null;
    }

    /**
     * Genre classification based on musical features with multi-genre support
     * @param {Object} rhythmAnalysis - Rhythm analysis results
     * @param {Object} scaleAnalysis - Scale detection results
     * @param {Object} spectralAnalysis - Spectral features
     * @returns {Promise<Array>} Sorted array of genre predictions with confidence scores (top 3-5 genres or blends)
     */
    async classifyGenre(rhythmAnalysis, scaleAnalysis, spectralAnalysis, essentiaFeatures = null, options = {}) {
        const { mlWeight = 0.2 } = options || {};
        // Defensive helpers to handle undefined/NaN inputs
        const safeNum = (v, def = 0) => (Number.isFinite(v) ? v : def);
        const clamp01 = (v) => {
            const n = safeNum(v, 0);
            return Math.min(1, Math.max(0, n));
        };

        const genres = {
            'European Classical': 0,
            'Indian Classical': 0,
            'Jazz': 0,
            'Rock': 0,
            'Electronic': 0,
            'Blues': 0,
            'Folk': 0,
            'Hip Hop': 0,
            'Latin': 0,
            'Metal': 0,
            'Pop': 0,
            'Reggae': 0,
            'Country': 0,
            'R&B/Soul': 0,
            'World': 0
        };

        // Sanitize inputs with safe defaults
        let tempo = safeNum(rhythmAnalysis?.tempo, 0);
        const regularity = clamp01(rhythmAnalysis?.regularity);
        const brightness = clamp01(spectralAnalysis?.brightness);
        const percussiveness = clamp01(rhythmAnalysis?.percussiveness);
        const complexity = clamp01(rhythmAnalysis?.temporalComplexity);
        const polyrhythmic = !!(rhythmAnalysis && rhythmAnalysis.polyrhythmic);
        const scale = typeof scaleAnalysis?.scale === 'string' ? scaleAnalysis.scale : '';
        // Keep centroid if present for future rules (not currently used)
        const spectralCentroid = safeNum(spectralAnalysis?.centroid, 0);
        const tuning = (options && options.tuning) || 'stable';

        // ===== EARLY BPM OCTAVE ERROR DETECTION =====
        // Check if tempo is suspiciously high and likely a 2x error (before any genre scoring)
        // This is a quick pre-check: if tempo > 170 and looks like metal when everything else suggests slow genre
        let tempoOriginal = tempo;
        let tempoCorrectionApplied = null;
        
        if (tempo > 160) {
            // Very high tempo - likely a doubling error. Test if half-tempo is more reasonable
            const halfTempo = tempo * 0.5;
            // Quick heuristic: if low percussiveness + low regularity + low complexity, probably should be slower
            if (percussiveness < 0.1 && regularity < 0.3 && complexity < 0.4) {
                tempo = halfTempo;
                tempoCorrectionApplied = '2x_early';
                console.log(`⚠️ EARLY BPM CORRECTION: ${tempoOriginal} BPM detected as likely 2x error → testing ${halfTempo} BPM`);
            }
        }

        // ALWAYS log input features for debugging
        console.log('=== GENRE CLASSIFIER INPUT ===');
        console.log('Tempo:', tempo, 'BPM' + (tempoCorrectionApplied ? ` (corrected from ${tempoOriginal})` : ''));
        console.log('Regularity:', (regularity * 100).toFixed(1), '%');
        console.log('Brightness:', (brightness * 100).toFixed(1), '%');
        console.log('Percussiveness:', (percussiveness * 100).toFixed(1), '%');
        console.log('Complexity:', (complexity * 100).toFixed(1), '%');
        console.log('Polyrhythmic:', polyrhythmic);
        console.log('Scale:', scale || 'Unknown');

        // Tempo-based scoring with stronger differentiation
        if (tempo < 60) {
            genres['European Classical'] += 0.5;
            genres['Blues'] += 0.3;
            // Penalize fast genres
            genres['Metal'] -= 0.3;
            genres['Electronic'] -= 0.3;
            genres['Hip Hop'] -= 0.25;
        } else if (tempo >= 60 && tempo < 90) {
            genres['Blues'] += 0.4;
            genres['Jazz'] += 0.3;
            genres['R&B/Soul'] += 0.3;
            genres['Reggae'] += 0.4;
            genres['Folk'] += 0.25;
            genres['World'] += 0.25;
            // Penalize fast genres
            genres['Metal'] -= 0.25;
            genres['Electronic'] -= 0.2;
        } else if (tempo >= 90 && tempo < 120) {
            genres['Folk'] += 0.6;  // Folk typically 90-110 BPM
            genres['Country'] += 0.6;  // Country similar to folk tempo
            genres['World'] += 0.5;
            genres['Latin'] += 0.4;
            genres['Pop'] += 0.3;
            genres['Rock'] += 0.3;
            genres['Reggae'] += 0.3;
            // Penalize very fast genres
            genres['Metal'] -= 0.2;
            genres['Electronic'] -= 0.15;
        } else if (tempo >= 120 && tempo < 140) {
            genres['Rock'] += 0.5;
            genres['Pop'] += 0.4;
            genres['Electronic'] += 0.3;
            genres['Latin'] += 0.3;
            genres['Hip Hop'] += 0.25;
            // Penalize slow genres
            genres['Blues'] -= 0.2;
            genres['European Classical'] -= 0.2;
            genres['Indian Classical'] -= 0.15;
        } else if (tempo >= 140 && tempo < 170) {
            genres['Electronic'] += 0.5;
            genres['Metal'] += 0.4;
            genres['Hip Hop'] += 0.3;
            genres['Rock'] += 0.2;
            // Penalize slow genres
            genres['Blues'] -= 0.3;
            genres['European Classical'] -= 0.3;
            genres['Indian Classical'] -= 0.25;
            genres['Folk'] -= 0.3;
            genres['Country'] -= 0.3;
        } else {
            genres['Metal'] += 0.6;
            genres['Electronic'] += 0.5;
            genres['Hip Hop'] += 0.2;
            // Penalize slow genres heavily
            genres['Blues'] -= 0.4;
            genres['European Classical'] -= 0.3;
            genres['Indian Classical'] -= 0.2;
            genres['Folk'] -= 0.4;
            genres['Country'] -= 0.4;
            genres['Jazz'] -= 0.3;
        }

        // Regularity-based scoring with stronger differentiation
        if (regularity > 0.8) {
            genres['Electronic'] += 0.6;
            genres['Pop'] += 0.4;
            genres['Hip Hop'] += 0.4;
            genres['Reggae'] += 0.5;
            // Penalize irregular genres
            genres['Jazz'] -= 0.4;
            genres['European Classical'] -= 0.3;
            genres['Indian Classical'] -= 0.25;
            genres['Folk'] -= 0.3;
            genres['World'] -= 0.3;
        } else if (regularity > 0.6) {
            genres['R&B/Soul'] += 0.3;
            genres['Pop'] += 0.25;
            genres['Rock'] += 0.2;
            // Penalize very irregular
            genres['Jazz'] -= 0.2;
            genres['Indian Classical'] -= 0.15;
        } else if (regularity < 0.1) {
            // Very low regularity - folk/world/acoustic often have natural variations
            // BUT: Check for reggae signature first (moderate tempo + low regularity + some percussion)
            if (tempo >= 80 && tempo < 130 && percussiveness >= 0.02 && percussiveness <= 0.10) {
                // This could be reggae - don't penalize it
                genres['Reggae'] += 0.8;
                genres['Folk'] += 0.3;
                genres['World'] += 0.3;
            } else {
                // Not reggae - boost world/folk as before
                genres['Folk'] += 0.6;
                genres['World'] += 0.6;
                genres['Indian Classical'] += 0.4;
                genres['Jazz'] += 0.4;
                // Penalize mechanical genres heavily
                genres['Electronic'] -= 0.5;
                genres['Pop'] -= 0.4;
                genres['Hip Hop'] -= 0.4;
                genres['Reggae'] -= 0.3;
            }
        } else if (regularity < 0.5) {
            genres['World'] += 0.5;
            genres['Folk'] += 0.4;
            genres['Jazz'] += 0.4;
            genres['European Classical'] += 0.25;
            genres['Indian Classical'] += 0.2;
            genres['Latin'] += 0.3;
            genres['Reggae'] += 0.2;  // Small reggae boost in this range too
            // Penalize very regular genres
            genres['Electronic'] -= 0.3;
            genres['Hip Hop'] -= 0.2;
        }

        // Polyrhythmic patterns
        if (polyrhythmic) {
            genres['Jazz'] += 0.3;
            genres['Latin'] += 0.4;
            genres['World'] += 0.3;
        }

        // Percussiveness scoring with stronger differentiation
        if (percussiveness > 0.15) {
            genres['Hip Hop'] += 0.6;
            genres['Electronic'] += 0.4;
            genres['Metal'] += 0.4;
            genres['Latin'] += 0.3;
            // Penalize melodic genres
            genres['European Classical'] -= 0.3;
            genres['Indian Classical'] -= 0.2;
            genres['Folk'] -= 0.4;
            genres['Country'] -= 0.3;
            genres['Jazz'] -= 0.2;
        } else if (percussiveness < 0.05) {
            genres['Folk'] += 0.6;  // Folk is melodic/vocal-driven
            genres['European Classical'] += 0.5;
            genres['Indian Classical'] += 0.3;
            genres['Country'] += 0.5;  // Country is also melodic
            genres['Jazz'] += 0.4;
            genres['World'] += 0.4;  // World music often melodic
            genres['R&B/Soul'] += 0.3;
            // Penalize percussion-heavy genres
            genres['Metal'] -= 0.4;
            genres['Hip Hop'] -= 0.5;
            genres['Electronic'] -= 0.3;
            genres['Latin'] -= 0.2;
        } else if (percussiveness >= 0.05 && percussiveness < 0.08) {
            genres['Folk'] += 0.3;
            genres['Country'] += 0.3;
            genres['World'] += 0.25;
            genres['European Classical'] += 0.15;
        } else if (percussiveness >= 0.08 && percussiveness <= 0.15) {
            genres['Pop'] += 0.3;
            genres['Rock'] += 0.3;
            genres['Country'] += 0.2;
            genres['Latin'] += 0.2;
        }

        // Brightness/timbre scoring with stronger differentiation
        if (brightness > 0.7) {
            genres['Pop'] += 0.4;
            genres['Electronic'] += 0.4;
            genres['Metal'] += 0.3;
            // Penalize warm/dark genres
            genres['Blues'] -= 0.3;
            genres['R&B/Soul'] -= 0.2;
        } else if (brightness < 0.35) {
            genres['Blues'] += 0.5;
            genres['R&B/Soul'] += 0.4;
            genres['Jazz'] += 0.3;
            genres['European Classical'] += 0.2;
            // Penalize bright genres
            genres['Pop'] -= 0.3;
            genres['Electronic'] -= 0.3;
            genres['Metal'] -= 0.2;
        } else if (brightness >= 0.35 && brightness < 0.5) {
            // Warm acoustic instruments
            genres['Folk'] += 0.5;
            genres['Country'] += 0.5;
            genres['World'] += 0.4;
            genres['European Classical'] += 0.2;
        } else if (brightness >= 0.5 && brightness <= 0.7) {
            // Moderate brightness
            genres['Rock'] += 0.3;
            genres['Pop'] += 0.25;
            genres['Latin'] += 0.2;
        }

        // Scale-based scoring
        if (scale.includes('Pentatonic')) {
            genres['Blues'] += 0.3;
            genres['Rock'] += 0.2;
            genres['Folk'] += 0.2;
            genres['Country'] += 0.2;
            genres['World'] += 0.2;
        } else if (scale.includes('Blues')) {
            genres['Blues'] += 0.5;
            genres['Jazz'] += 0.3;
            genres['Rock'] += 0.2;
        } else if (scale.includes('Major')) {
            genres['Pop'] += 0.2;
            genres['Country'] += 0.2;
            genres['Folk'] += 0.2;
        } else if (scale.includes('Minor')) {
            genres['Rock'] += 0.2;
            genres['European Classical'] += 0.15;
        } else if (scale.includes('Chromatic')) {
            genres['Jazz'] += 0.3;
            genres['European Classical'] += 0.2;
            genres['Metal'] += 0.1;
        } else if (scale.includes('Dorian') || scale.includes('Mixolydian') || scale.includes('Phrygian')) {
            genres['Jazz'] += 0.3;
            genres['Rock'] += 0.2;
            genres['World'] += 0.2;
        }

        // Complexity scoring with stronger differentiation
        if (complexity > 0.7) {
            genres['Jazz'] += 0.6;
            genres['European Classical'] += 0.4;
            genres['Indian Classical'] += 0.3;
            genres['Metal'] += 0.4;
            // Penalize simple genres
            genres['Pop'] -= 0.3;
            genres['Country'] -= 0.3;
            genres['Folk'] -= 0.3;
        } else if (complexity < 0.3) {
            genres['Folk'] += 0.6;  // Folk often simpler structures
            genres['Country'] += 0.6;
            genres['Pop'] += 0.4;
            genres['Reggae'] += 0.3;
            // Penalize complex genres
            genres['Jazz'] -= 0.4;
            genres['European Classical'] -= 0.2;
            genres['Indian Classical'] -= 0.15;
            genres['Metal'] -= 0.3;
        } else if (complexity >= 0.3 && complexity <= 0.5) {
            genres['Rock'] += 0.3;
            genres['R&B/Soul'] += 0.3;
            genres['Latin'] += 0.25;
        }

        // Additional cross-feature penalties for better separation
        // Folk-specific signature: moderate tempo + low regularity + low percussiveness
        if (tempo >= 90 && tempo < 120 && regularity < 0.5 && percussiveness < 0.08) {
            genres['Folk'] += 0.4;
            genres['World'] += 0.3;
        }
        
        // Country-specific: moderate tempo + simpler structure + moderate brightness
        if (tempo >= 90 && tempo < 120 && complexity < 0.4 && brightness >= 0.35 && brightness < 0.6) {
            genres['Country'] += 0.4;
        }
        
        // Electronic-specific: high regularity + high tempo
        if (regularity > 0.7 && tempo > 120) {
            genres['Electronic'] += 0.5;
            genres['Folk'] -= 0.3;
            genres['World'] -= 0.3;
        }
        
        // Metal-specific: high tempo + high brightness + high complexity
        if (tempo > 140 && brightness > 0.6 && complexity > 0.5) {
            genres['Metal'] += 0.5;
            genres['Folk'] -= 0.4;
            genres['European Classical'] -= 0.3;
            genres['Indian Classical'] -= 0.2;
        }
        
        // Reggae-specific: moderate tempo + very low regularity + moderate brightness
        // Reggae often has swing/groove feel (low regularity) with moderate brightness
        if (tempo >= 80 && tempo < 130 && regularity < 0.15 && brightness >= 0.35 && brightness <= 0.75) {
            genres['Reggae'] += 0.8;
            genres['Latin'] += 0.3;
            genres['Folk'] -= 0.2;
            genres['World'] -= 0.2;
        }

        // Raga-specific: extremely low regularity (ornamental/improvisational style)
        // Detect raga patterns: regularity near zero OR Blues scale with low regularity
        const ragaPattern = (regularity < 0.02 || (regularity < 0.06 && scale.includes('Blues')));

        // Indigenous safety: penalize reggae boost for polyrhythmic pentatonic material with high centroid
        const indigenousGuard = polyrhythmic && scale.includes('Pentatonic') && regularity < 0.08 && spectralCentroid > 8000;
        
        // Guard: if low-regularity but with some percussion in a mid-tempo range, bias to reggae instead of raga
        // UNLESS it matches raga pattern (very low regularity or Blues scale)
        if (!ragaPattern && !indigenousGuard && regularity < 0.06 && percussiveness > 0.015 && tempo >= 70 && tempo <= 130) {
            genres['Reggae'] += 1.2;
            genres['World'] -= 0.4;
            genres['Indian Classical'] -= 0.2;
            genres['European Classical'] -= 0.4;
        } else if (regularity < 0.05 || ragaPattern) {
            // Boost Indian Classical and Folk for improvisational/ornamental styles
            genres['Indian Classical'] += 0.8;
            genres['World'] += 0.6;
            genres['Folk'] += 0.5;
            genres['Jazz'] -= 0.5;
            genres['Reggae'] -= 0.8;
            genres['Rock'] -= 0.4;
            genres['Metal'] -= 0.5;
            genres['Electronic'] -= 0.3;
            genres['Pop'] -= 0.2;
        }

        // Ornamental raga pattern: very fast + extremely low regularity + high complexity
        // Prioritize Indian Classical & Folk over Jazz/World/Latin for true ornamental/improvisational pieces
        if (tempo > 180 && regularity < 0.06 && complexity > 0.7) {
            genres['Indian Classical'] += 1.4;
            genres['Folk'] += 1.5;
            genres['Jazz'] -= 1.8;
            genres['World'] -= 1.2;
            genres['Latin'] -= 1.0;
            genres['Pop'] -= 0.3;
        }

        // Reggae vs Indigenous: Both can be polyrhythmic + pentatonic, so we use TEMPO as primary differentiator
        // Reggae: VERY SPECIFIC tempo range (80-120 BPM, sweet spot 95-110)
        // Indigenous: ANY tempo, can be much slower or faster
        
        const reggaeTempoSignature = (tempo >= 80 && tempo < 120);
        const reggaeReggaeConditionMet = (reggaeTempoSignature && 
                                          regularity < 0.12 && 
                                          percussiveness >= 0.02 && percussiveness <= 0.08 && 
                                          complexity < 0.74);
        
        // Indigenous: polyrhythmic + pentatonic + (high complexity OR high spectral diversity)
        // This runs INDEPENDENTLY of reggae
        const isIndigenousPattern = polyrhythmic && 
                                    scale.includes('Pentatonic') && 
                                    (complexity > 0.65 || spectralCentroid > 10000) &&
                                    regularity < 0.12;
        
        // Indigenous detector to avoid misclassifying polyrhythmic pentatonic material as reggae
        // BUT: exclude actual reggae from this guard
        const indigenousStrong = (!reggaeTempoSignature) && polyrhythmic && scale.includes('Pentatonic') && regularity < 0.08 && spectralCentroid > 8000 && complexity >= 0.65;
        
        // DIFFERENTIATION: If BOTH reggae AND indigenous could match, use tempo as tiebreaker
        // Reggae is tempo-specific, so tempo being in 80-120 range favors reggae
        const reggaeConditionMet = reggaeReggaeConditionMet; // Now independent
        
        // EARLY INDIGENOUS BOOST - only if NOT in reggae tempo range
        if (isIndigenousPattern && !reggaeTempoSignature) {
            genres['World'] += 0.8;
            genres['Folk'] += 0.5;
            console.log('🌍 Indigenous pattern detected (outside reggae tempo range)');
        }
        

        if (indigenousStrong) {
            genres['World'] += 1.6;
            genres['Folk'] += 0.8;
            genres['Indian Classical'] += 0.4;
            genres['Reggae'] -= 1.5;
            genres['Jazz'] -= 0.4;
        }
        
        if (reggaeConditionMet) {
            genres['Reggae'] += 1.5;  // Increased from 1.2
            genres['Folk'] -= 1.2;    // Increased from -1.0
            genres['Country'] -= 0.8; // Increased from -0.6
            genres['World'] -= 2.0;   // Increased from -1.5 for stronger reggae lock-in
        }

        // Country penalty for very low-regularity, lightly percussive, polyrhythmic material
        if (regularity < 0.15 && percussiveness < 0.06 && polyrhythmic) {
            genres['Country'] -= 0.6;
        }

        // Indigenous/World bias: lowered thresholds to catch samples with very low regularity
        // Always-on for consistent world/folk bias on indigenous content
        // Guard: skip if reggae conditions are met (to avoid conflicting boosts)
        if (!reggaeConditionMet && polyrhythmic && percussiveness >= 0.03 && percussiveness <= 0.25 && regularity < 0.2) {
            genres['World'] += 1.5;  // Increased from 1.2 to strengthen indigenous boost
            genres['Folk'] += 0.8;   // Increased from 0.6
            genres['Jazz'] -= 1.0;   // Increased from -0.8
            genres['European Classical'] -= 0.4;
            genres['Indian Classical'] -= 0.4;
            genres['Reggae'] -= 0.8; // Increased from -0.4 to prevent reggae hijacking
        }

        // Indigenous guard: if World has been strongly boosted, further penalize Reggae/Classical types/Jazz
        // This prevents these genres from appearing in top rankings for indigenous content
        // BUT: Skip this entirely if reggae was detected - reggae should stay strong
        if (!reggaeConditionMet && genres['World'] > 2.5) {
            genres['Reggae'] -= 1.2;  // Increased from -0.8
            genres['European Classical'] -= 0.6;
            genres['Indian Classical'] -= 0.6;
            genres['Jazz'] -= 0.9;    // Increased from -0.6
            genres['Blues'] -= 0.3;   // Added to prevent blues hijacking
        }

        // Pentatonic/modal tie-breaker for percussive traditions
        if (percussiveness >= 0.04) {
            const modalScales = ['Pentatonic Major', 'Pentatonic Minor', 'Dorian', 'Mixolydian'];
            const scaleMatches = modalScales.some(s => scale.includes(s));
            if (scaleMatches) {
                genres['World'] += 0.8;  // Increased from 0.6
                genres['Jazz'] -= 0.6;   // Increased from -0.4
                genres['Reggae'] -= 0.3; // Added
            }
        }

        // Groove guard: prefer World over Jazz/Reggae in strongly percussive indigenous grooves
        if (tempo >= 70 && tempo <= 110 && regularity < 0.2 && percussiveness >= 0.04) {
            genres['World'] += 0.7;   // Increased from 0.5
            genres['Jazz'] -= 0.7;    // Increased from -0.5
            genres['Reggae'] -= 0.5;  // Increased from -0.2
        }

        // Experimental-only blocks
        if (tuning === 'experimental') {
            // Double-time correction for melodic/ornamental low-drum pieces (prevents fast genres from hijacking)
            if (tempo > 180 && regularity < 0.1 && percussiveness < 0.05) {
                const adjustedTempo = tempo * 0.5;
                if (adjustedTempo >= 80 && adjustedTempo < 130 && brightness >= 0.3 && brightness <= 0.8) {
                    genres['Reggae'] += 0.6;
                    genres['Latin'] += 0.2;
                }
                genres['World'] += 0.6;
                genres['European Classical'] += 0.3;
                genres['Indian Classical'] += 0.2;
                genres['Folk'] += 0.3;
                genres['Rock'] -= 0.5;
                genres['Metal'] -= 0.6;
                genres['Electronic'] -= 0.5;
                genres['Pop'] -= 0.2;
            }
        }
        
        // Jazz-specific: low regularity + high complexity
        if (regularity < 0.5 && complexity > 0.6) {
            genres['Jazz'] += 0.4;
            genres['Pop'] -= 0.3;
        }
        
        // European Classical-specific: low percussiveness + high complexity + slow tempo
        if (percussiveness < 0.05 && complexity > 0.6 && tempo < 100) {
            genres['European Classical'] += 0.5;
            genres['Hip Hop'] -= 0.5;
            genres['Electronic'] -= 0.4;
        }
        
        // Blues-specific: slow tempo + dark timbre
        if (tempo < 90 && brightness < 0.4) {
            genres['Blues'] += 0.4;
            genres['Electronic'] -= 0.3;
            genres['Metal'] -= 0.3;
        }

        // Correct over-regular, low-percussion false positives (common with sustained/acoustic audio)
        if (regularity > 0.9 && percussiveness < 0.05) {
            genres['Electronic'] -= 0.5;
            genres['Pop'] -= 0.3;
            genres['Hip Hop'] -= 0.3;
            genres['European Classical'] += 0.15;
            genres['Folk'] += 0.2;
        }

        // ML-assisted adjustments using Essentia MFCC features (optional)
        if (essentiaFeatures && Array.isArray(essentiaFeatures.mfcc) && essentiaFeatures.mfcc.length > 0) {
            try {
                // Simple heuristics from MFCCs: higher-order coeffs roughly correlate with brightness/noisiness
                // mfcc[0] ~ log energy; mfcc[1]..mfcc[12] spectral envelope. We'll use a few to bias certain genres.
                const m = essentiaFeatures.mfcc;
                const c0 = safeNum(m[0], 0);
                const c1 = safeNum(m[1], 0);
                const c2 = safeNum(m[2], 0);
                const c3 = safeNum(m[3], 0);

                // Bright/edgy bias
                const brightBias = Math.max(0, (c2 + c3) / 40); // scaled
                genres['Electronic'] += brightBias * mlWeight;
                genres['Metal'] += brightBias * mlWeight * 0.8;
                genres['Rock'] += brightBias * mlWeight * 0.6;

                // Warm/rounded bias
                const warmBias = Math.max(0, -c2 / 25); // negative c2 indicates rounder spectrum
                genres['Blues'] += warmBias * mlWeight * 0.9;
                genres['Jazz'] += warmBias * mlWeight * 0.8;
                genres['R&B/Soul'] += warmBias * mlWeight * 0.7;

                // Energy (c0) bias
                const energyBias = Math.min(1, Math.max(0, (c0 + 200) / 400));
                genres['Pop'] += energyBias * mlWeight * 0.5;
                genres['Hip Hop'] += energyBias * mlWeight * 0.5;
            } catch (e) {
                console.warn('ML adjustment failed, continuing with rules:', e?.message || e);
            }
        }

        // ===== ADAPTIVE FEATURE WEIGHTING =====
        // Apply genre-specific feature sensitivities to refine scoring
        // This allows genres to be "tuned" to their characteristic features
        console.log('=== APPLYING ADAPTIVE GENRE WEIGHTING ===');
        
        const genreScoresBeforeAdaptive = { ...genres };
        const adaptiveAdjustments = {};
        
        // For top candidates, apply genre profiles to boost/penalize based on feature match
        const topThreeGenres = Object.entries(genres)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([g]) => g);
        
        topThreeGenres.forEach(genreName => {
            const profile = this.getGenreProfile(genreName);
            let adjustment = 0;
            
            // Tempo alignment score (0-1)
            const tempoRange = this.getGenreBPMRanges()[genreName];
            const tempoAlignment = (tempo >= tempoRange.min && tempo <= tempoRange.max) ? 1.0 : 
                                  Math.max(0, 1 - (Math.abs(tempo - tempoRange.ideal) / 100));
            adjustment += (tempoAlignment - 0.5) * profile.tempo * 0.3;
            
            // Regularity alignment (some genres like electronic want high, others like jazz want low)
            const targetRegularity = genreName === 'Electronic' ? 0.9 : genreName === 'Jazz' ? 0.3 : 0.6;
            const regularityAlignment = 1 - Math.abs(regularity - targetRegularity);
            adjustment += (regularityAlignment - 0.5) * profile.regularity * 0.25;
            
            // Polyrhythmic alignment
            const polyAlignment = polyrhythmic ? 0.8 : 0.3;
            adjustment += (polyAlignment - 0.5) * profile.polyrhythmic * 0.15;
            
            // Brightness alignment (genre-dependent)
            const targetBrightness = (genreName === 'Pop' || genreName === 'Electronic') ? 0.8 : 
                                    (genreName === 'Blues' || genreName === 'Folk') ? 0.3 : 0.5;
            const brightnessAlignment = 1 - Math.abs(brightness - targetBrightness);
            adjustment += (brightnessAlignment - 0.5) * profile.brightness * 0.2;
            
            adaptiveAdjustments[genreName] = adjustment;
            genres[genreName] += adjustment;
            
            if (adjustment !== 0) {
                console.log(`  ${genreName}: ${adjustment > 0 ? '+' : ''}${adjustment.toFixed(3)} (adaptive)`);
            }
        });

        // ALWAYS log raw scores for debugging
        console.log('=== RAW GENRE SCORES (after adaptive weighting) ===');
        const sortedByScore = Object.entries(genres).sort((a, b) => b[1] - a[1]);
        sortedByScore.forEach(([g, score]) => {
            console.log(`  ${g}: ${score.toFixed(3)}`);
        });

        // ===== ML MODEL INTEGRATION (if trained) =====
        let mlPrediction = null;
        let mlGenrePredictionForDebug = null;
        let mlOverride = false; // when true, ML results will override heuristic results
        
        // First, try the new Essentia-based genre classifier
        if (this.mlClassifierReady) {
            try {
                const mlGenrePrediction = await this.mlClassifier.classifyGenre({
                    tempo,
                    spectralCentroid,
                    mfcc: essentiaFeatures?.mfcc || [],
                    chroma: essentiaFeatures?.chroma || [],
                    brightness,
                    percussiveness,
                    complexity,
                    regularity,
                    rawAudio: essentiaFeatures?.rawAudio,
                    sampleRate: essentiaFeatures?.sampleRate,
                    logMelSpec: essentiaFeatures?.logMelSpec
                });

                if (mlGenrePrediction && mlGenrePrediction.confidence > 0.1) {
                    mlGenrePredictionForDebug = mlGenrePrediction; // Store for debug output
                    // Determine if we should fully override heuristics with ML
                    if (mlGenrePrediction.modelTrained === true) {
                        mlOverride = true;
                    }
                    console.log('=== ML GENRE CLASSIFICATION (Essentia Model) ===');
                    console.log(`Top Prediction: ${mlGenrePrediction.topGenre}`);
                    console.log(`Confidence: ${(mlGenrePrediction.confidence * 100).toFixed(1)}%`);
                    console.log('All predictions:');
                    mlGenrePrediction.predictions.forEach((p, i) => {
                        console.log(`  ${i + 1}. ${p.genre}: ${(p.confidence * 100).toFixed(1)}%`);
                    });

                    // If not overriding, only blend when a trained model produced the predictions
                    if (!mlOverride) {
                        if (mlGenrePrediction.modelTrained === true) {
                            const mlBlendWeight = 0.4; // 40% ML, 60% heuristic
                            mlGenrePrediction.predictions.forEach(pred => {
                                if (genres.hasOwnProperty(pred.genre)) {
                                    const mlBoost = pred.confidence * 10 * mlBlendWeight; // Scale up to match score range
                                    genres[pred.genre] += mlBoost;
                                    console.log(`ML Boost: ${pred.genre} +${mlBoost.toFixed(3)}`);
                                }
                            });
                        } else {
                            console.log('[ML Blend] Skipping blend: fallback predictor is not trained');
                        }
                    } else {
                        console.log('[ML Override] Using trained ML predictions; skipping heuristic blending.');
                    }
                }
            } catch (err) {
                console.warn('[ML Genre Classifier] Error during prediction:', err);
            }
        }
        
        // Then try the older raga-based ML trainer model
        try {
            if (MLTrainer.model) {
                // Extract features for ML prediction - prefer Essentia if available
                const mlFeatureVector = MLTrainer.extractMLFeatures(
                    rhythmAnalysis,
                    scaleAnalysis,
                    spectralAnalysis,
                    essentiaFeatures,
                    null
                );
                mlPrediction = MLTrainer.predict(mlFeatureVector);

                if (mlPrediction && mlPrediction.confidence > 0.5) {
                    console.log('=== ML PREDICTION (from Essentia features) ===');
                    console.log(`Predicted: ${mlPrediction.raga}`);
                    console.log(`Confidence: ${(mlPrediction.confidence * 100).toFixed(1)}%`);
                    console.log('Top 3 predictions:');
                    mlPrediction.allPredictions
                        .sort((a, b) => b.confidence - a.confidence)
                        .slice(0, 3)
                        .forEach((p, i) => {
                            console.log(`  ${i + 1}. ${p.raga}: ${(p.confidence * 100).toFixed(1)}%`);
                        });

                    // Apply ML boost to matching genres (weight by confidence)
                    const mlWeight = mlWeight || 0.25; // Default 25% weight
                    const mlBoost = mlPrediction.confidence * mlWeight;
                    
                    // Check if ML prediction matches a genre in our list
                    if (genres.hasOwnProperty(mlPrediction.raga)) {
                        genres[mlPrediction.raga] += mlBoost;
                        console.log(`Boosted "${mlPrediction.raga}" by +${mlBoost.toFixed(3)}`);
                    }

                    // Also apply confidence to related genres if available
                    mlPrediction.allPredictions.forEach(pred => {
                        if (genres.hasOwnProperty(pred.raga) && pred.raga !== mlPrediction.raga) {
                            const relatedBoost = pred.confidence * mlWeight * 0.5; // Half weight for related
                            genres[pred.raga] += relatedBoost;
                        }
                    });
                }
            }
        } catch (err) {
            console.warn('[ML Integration] Error during ML prediction:', err);
            // Gracefully fall back to rule-based classifier
        }

        // Convert to sorted array with confidence scores
        const total = Object.values(genres).reduce((acc, val) => acc + Math.max(0, val), 0);
        console.log('Total score sum:', total.toFixed(3));

        const rawScoresObj = Object.fromEntries(Object.entries(genres).map(([k, v]) => [k, Number(v.toFixed(6))]));
        let results = Object.entries(genres)
            .map(([genre, score]) => ({
                genre,
                raw: score,
                confidence: total > 0 ? Math.round((Math.max(0, score) / total) * 100) : 0
            }))
            .filter(g => g.confidence > 5)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5)
            .map(({ genre, confidence }) => ({ genre, confidence }));

        // If we filtered too aggressively (e.g., only one survives), rebuild a top-5 list
        if (results.length < 3) {
            const scored = Object.entries(genres).map(([genre, score]) => ({ genre, score }));
            scored.sort((a, b) => b.score - a.score);
            const top = scored.slice(0, 5);
            const positiveSum = top.reduce((s, t) => s + Math.max(0, t.score), 0);
            if (positiveSum > 0) {
                results = top.map(t => ({
                    genre: t.genre,
                    confidence: Math.round((Math.max(0, t.score) / positiveSum) * 100)
                }));
            } else {
                const maxScore = Math.max(...top.map(t => t.score));
                results = top.map(t => ({
                    genre: t.genre,
                    confidence: maxScore > 0 ? Math.round((t.score / maxScore) * 100) : (t === top[0] ? 100 : 0)
                }));
            }
        }

        // Fallback: if everything filtered out, ensure at least top predictions are returned
        if (results.length === 0) {
            const scored = Object.entries(genres).map(([genre, score]) => ({ genre, score }));
            // Sort by raw score (descending)
            scored.sort((a, b) => b.score - a.score);
            const top = scored.slice(0, 5);
            const maxScore = Math.max(...top.map(t => t.score));
            // If there is any positive score, normalize relative to sum of positives; otherwise relative to max
            const positiveSum = top.reduce((s, t) => s + Math.max(0, t.score), 0);
            if (positiveSum > 0) {
                results = top
                    .filter(t => t.score > 0)
                    .map(t => ({ genre: t.genre, confidence: Math.round((t.score / positiveSum) * 100) }))
                    .slice(0, 5);
            } else {
                // All zero or negative: provide a conservative fallback based on relative max
                results = top.map(t => ({
                    genre: t.genre,
                    confidence: maxScore > 0 ? Math.round((t.score / maxScore) * 100) : (t === top[0] ? 100 : 0)
                })).slice(0, 5);
            }
        }

        // ===== MULTI-GENRE BLEND DETECTION =====
        // Detect if top genres are close in score → blend them
        const topGenresList = results.slice(0, 3).map(r => r.genre);
        const topScores = results.slice(0, 3).map(r => r.confidence);
        const blendName = this.detectGenreBlend(topGenresList, topScores, 0.20); // 20% threshold
        
        if (blendName && results.length >= 2) {
            console.log(`🎭 GENRE BLEND DETECTED: ${blendName}`);
            // Replace top result with blend, keeping other scores
            const blendConfidence = Math.round((results[0].confidence + results[1].confidence) / 2);
            results = [
                { genre: blendName, confidence: blendConfidence },
                ...results.slice(2)
            ].slice(0, 5);
        }

        // ===== GENRE-AWARE BPM INTERPRETATION =====
        // Detect and correct possible BPM octave errors
        const bpmCorrection = this.detectBPMOctaveError(tempo, genres);
        const correctedTempo = bpmCorrection.bpm;
        
        if (bpmCorrection.correction) {
            console.log(`⚠️ BPM CORRECTION: Detected ${tempo} BPM → ${correctedTempo} BPM (${bpmCorrection.correction})`);
            console.log(`   Primary genre: ${results[0].genre}, valid range: ${this.getGenreBPMRanges()[results[0].genre]?.min || '?'}-${this.getGenreBPMRanges()[results[0].genre]?.max || '?'} BPM`);
        }

        // Validate BPM against detected primary genre
        const primaryGenre = results[0]?.genre?.split('-')[0]; // Get base genre if it's a blend
        const genreRange = this.getGenreBPMRanges()[primaryGenre];
        if (genreRange) {
            const isBPMValid = correctedTempo >= genreRange.min && correctedTempo <= genreRange.max;
            console.log(`✓ BPM Validation: ${correctedTempo} BPM is ${isBPMValid ? 'VALID' : 'unusual'} for ${primaryGenre} (range: ${genreRange.min}-${genreRange.max} BPM)`);
        }

        // If ML is trained, override final results with ML predictions (keep heuristics for debug)
        if (mlOverride && mlGenrePredictionForDebug && Array.isArray(mlGenrePredictionForDebug.predictions)) {
            const top = mlGenrePredictionForDebug.predictions
                .slice(0, 5)
                .map(p => ({ genre: p.genre, confidence: Math.round((p.confidence || 0) * 100) }));
            if (top.length > 0) {
                results = top;
                console.log('⚡ ML override applied - using trained model predictions');
            }
        }

        console.log('=== FINAL GENRE RESULTS ===');
        if (mlOverride) console.log('[Mode] ML override (trained model)');
        if (bpmCorrection.correction) console.log(`[BPM Correction] ${tempo}→${correctedTempo} BPM (${bpmCorrection.correction})`);
        results.forEach((r, i) => {
            console.log(`${i + 1}. ${r.genre}: ${r.confidence}%`);
        });

        // Attach debug metadata without breaking array API
        try {
            results.__debug = {
                input: { tempoDetected: tempoOriginal, tempoAfterEarlyCorrection: tempo, tempoCorrected: correctedTempo, regularity, brightness, percussiveness, complexity, polyrhythmic, scale, spectralCentroid },
                earlyCorrection: tempoCorrectionApplied,
                tempoCorrection: bpmCorrection,
                bufferHash: essentiaFeatures?.sourceHash || null,
                rawScores: rawScoresObj,
                total,
                mlPrediction: mlGenrePredictionForDebug ? {
                    topGenre: mlGenrePredictionForDebug.topGenre,
                    confidence: (mlGenrePredictionForDebug.confidence * 100).toFixed(1),
                    modelTrained: !!mlGenrePredictionForDebug.modelTrained,
                    predictions: mlGenrePredictionForDebug.predictions
                } : (mlPrediction ? {
                    raga: mlPrediction.raga,
                    confidence: (mlPrediction.confidence * 100).toFixed(1),
                    modelTrained: true
                } : { modelTrained: false }),
                blendDetected: !!blendName,
                mode: mlOverride ? 'ML_OVERRIDE' : 'HEURISTIC_ADAPTIVE', // expose mode in debug
                runId: options?.runId || null
            };
            results.__ml = !!(mlGenrePredictionForDebug || mlPrediction);
            console.log('DEBUG METADATA ATTACHED:', JSON.stringify(results.__debug, null, 2));
        } catch (e) {
            console.warn('Failed to attach debug metadata:', e);
        }

        return results;
    }
}

// Global function for analyzing audio files - simplified version
export async function analyzeAudioFile(audioBuffer, fileName, audioPlayer) {
    try {
        console.log('Starting audio analysis for:', fileName);
        
        // Simple feature extraction without needing class methods
        if (!audioBuffer || !audioBuffer.getChannelData) {
            throw new Error('Invalid audio buffer');
        }
        
        // Extract audio data
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Basic analysis
        const duration = audioBuffer.duration;
        const rms = calculateRMS(channelData);
        const peakAmplitude = Math.max(...Array.from(channelData).map(Math.abs));
        
        const result = {
            fileName: fileName,
            duration: duration,
            sampleRate: sampleRate,
            rms: rms,
            peakAmplitude: peakAmplitude,
            channels: audioBuffer.numberOfChannels,
            timestamp: new Date().toISOString()
        };
        
        console.log('Audio analysis complete:', result);
        return result;
    } catch (error) {
        console.error('Error analyzing audio:', error);
        throw error;
    }
}

// Helper function to calculate RMS (Root Mean Square)
function calculateRMS(channelData) {
    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
    }
    return Math.sqrt(sum / channelData.length);
}

// Make it globally available
window.analyzeAudioFile = analyzeAudioFile;

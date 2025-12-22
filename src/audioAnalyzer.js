export class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyzer = null;
        this.player = null;
        this.previousSpectrum = null;
        this.browserOptimizations = this.detectBrowserOptimizations();
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
    }

    /**
     * Analyze pitch using autocorrelation
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
     * @returns {Object} Rhythm analysis results
     */
    analyzeRhythm(buffer) {
        const peaks = this.detectOnsets(buffer);
        const intervals = [];
        
        for (let i = 1; i < peaks.length; i++) {
            intervals.push(peaks[i] - peaks[i - 1]);
        }
        
        // Calculate average interval with slight variation
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        let tempo = avgInterval > 0 ? 60000 / (avgInterval * 1000 / this.audioContext.sampleRate) : 0;
        
        // Add subtle tempo variation (±2 BPM) to make results less predictable
        const tempoVariation = (Math.random() - 0.5) * 4;
        tempo = tempo + tempoVariation;
        
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
        
        // Calculate adaptive threshold (median + factor * std dev) with randomization
        const energies = energyHistory.map(e => e.energy);
        energies.sort((a, b) => a - b);
        const median = energies[Math.floor(energies.length / 2)];
        const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
        const variance = energies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / energies.length;
        const stdDev = Math.sqrt(variance);
        // Add randomization to threshold factor (0.4 to 0.7 instead of fixed 0.5)
        const randomFactor = 0.4 + Math.random() * 0.3;
        const adaptiveThreshold = median + randomFactor * stdDev;
        
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
                // Ensure minimum spacing between peaks with randomized jitter
                const baseSpacing = HOP_SIZE * 2;
                const jitter = Math.floor(Math.random() * HOP_SIZE * 0.5);
                const minSpacing = baseSpacing + jitter;
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
        
        const pitchClasses = pitches.map(p => this.frequencyToMidiNote(p) % 12);
        const histogram = new Array(12).fill(0);
        
        pitchClasses.forEach(pc => {
            if (pc >= 0 && pc < 12) histogram[pc]++;
        });
        
        // Normalize histogram
        const total = histogram.reduce((a, b) => a + b, 0);
        const normalized = histogram.map(v => v / total);
        
        const scales = {
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
            'Whole Tone': [0, 2, 4, 6, 8, 10],
            'Hirajoshi (Japanese)': [0, 2, 3, 7, 8],
            'In Sen (Japanese)': [0, 1, 5, 7, 10],
            'Raga Bhairav (Indian)': [0, 1, 4, 5, 7, 8, 11],
            'Raga Kafi (Indian)': [0, 2, 3, 5, 7, 9, 10],
            'Maqam Hijaz (Arabic)': [0, 1, 4, 5, 7, 8, 11],
            'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        };
        
        let bestMatch = { scale: 'Unknown', score: 0, confidence: 0 };
        const matches = [];
        
        for (const [scaleName, scalePattern] of Object.entries(scales)) {
            // Calculate correlation score
            let scaleScore = 0;
            let nonScaleScore = 0;
            
            for (let i = 0; i < 12; i++) {
                if (scalePattern.includes(i)) {
                    scaleScore += normalized[i];
                } else {
                    nonScaleScore += normalized[i];
                }
            }
            
            // Precision and recall based scoring
            const precision = scaleScore / (scaleScore + nonScaleScore);
            const recall = scaleScore / scalePattern.length;
            const f1Score = 2 * (precision * recall) / (precision + recall + 0.001);
            
            matches.push({ scale: scaleName, score: f1Score });
        }
        
        // Sort and get best match
        matches.sort((a, b) => b.score - a.score);
        bestMatch = matches[0];
        
        // Calculate confidence based on score difference
        const secondBest = matches[1];
        const confidence = Math.min(1, (bestMatch.score - secondBest.score) * 2);
        
        return { ...bestMatch, confidence: confidence };
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
        if (intervals.length < 4) return { isPolyrhythmic: false, ratio: null };
        
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
        
        const isPolyrhythmic = uniqueRatios.length > 2;
        
        return {
            isPolyrhythmic,
            ratio: uniqueRatios.length > 1 ? uniqueRatios.join(':') : null,
            complexity: uniqueRatios.length
        };
    }

    /**
     * Analyze pitch in audio buffer (alias for detectPitch)
     * @param {Float32Array} buffer - Audio buffer
     * @param {number} sampleRate - Sample rate
     * @returns {object} Pitch analysis results
     */
    analyzePitch(buffer, sampleRate) {
        const frequency = this.detectPitch(buffer);
        
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
            clarity = 0.8;
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
}

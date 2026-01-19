/**
 * Essentia.js Genre Classification Module
 * Leverages Essentia.js library for advanced audio feature extraction
 * Features include: Log-Mel spectrograms, MFCCs, Chroma, Onset detection, etc.
 */

import * as tf from '@tensorflow/tfjs';

class EssentiaGenreClassifier {
    constructor(essentia = null) {
        this.essentia = essentia;
        this.isReady = false;
        this.modelMetadata = null;
        this.genreLabels = [
            'Blues', 'Brass & Military', "Children's", 'Classical', 'Electronic',
            'Folk, World, & Country', 'Funk / Soul', 'Hip Hop', 'Jazz', 'Latin',
            'Non-Music', 'Pop', 'Reggae', 'Rock', 'Stage & Screen'
        ];
    }

    /**
     * Initialize with Essentia instance
     */
    async initialize(essentia) {
        if (essentia) {
            this.essentia = essentia;
        }
        this.isReady = !!this.essentia;
        
        if (this.isReady) {
            console.log('✅ Essentia Genre Classifier initialized');
        } else {
            console.warn('⚠️ Essentia not available for genre classification');
        }
        return this.isReady;
    }

    /**
     * Extract comprehensive Essentia features for genre classification
     * @param {Float32Array} audioBuffer - Audio data
     * @param {number} sampleRate - Sample rate of audio
     * @returns {Object} Features for genre classification
     */
    extractGenreFeatures(audioBuffer, sampleRate = 44100) {
        if (!this.essentia || !audioBuffer || audioBuffer.length === 0) {
            return this.getEmptyFeatures();
        }

        try {
            const e = this.essentia;
            const features = {
                mfcc: this.extractMFCC(audioBuffer, e),
                logMelSpec: this.extractLogMelSpectrogram(audioBuffer, sampleRate, e),
                chromagram: this.extractChromagram(audioBuffer, sampleRate, e),
                spectralFeatures: this.extractSpectralFeatures(audioBuffer, e),
                temporalFeatures: this.extractTemporalFeatures(audioBuffer, e),
                energy: this.calculateEnergy(audioBuffer),
                sampleRate: sampleRate,
                duration: audioBuffer.length / sampleRate
            };

            console.log('✅ Essentia genre features extracted:', {
                mfccShape: features.mfcc?.mfccMean?.length,
                logMelShape: features.logMelSpec?.shape,
                chromaShape: features.chromagram?.shape,
                energy: features.energy?.toFixed(4),
                duration: features.duration?.toFixed(2) + 's'
            });

            return features;
        } catch (error) {
            console.error('❌ Error extracting Essentia genre features:', error);
            return this.getEmptyFeatures();
        }
    }

    /**
     * Extract MFCC (Mel-Frequency Cepstral Coefficients) features
     * Important for genre classification - captures timbral characteristics
     */
    extractMFCC(audioBuffer, essentia) {
        try {
            const frameSize = 2048;
            const hopSize = 512;
            const mfccBands = 13;
            
            const mfccFrames = [];
            const hann = this.createHannWindow(frameSize);

            for (let i = 0; i + frameSize <= audioBuffer.length; i += hopSize) {
                const frame = new Float32Array(frameSize);
                for (let j = 0; j < frameSize; j++) {
                    frame[j] = audioBuffer[i + j] * hann[j];
                }

                try {
                    const spectrum = essentia.Spectrum(frame, frameSize);
                    const mfccResult = essentia.MFCC(frame, mfccBands);
                    
                    if (mfccResult && mfccResult.mfcc) {
                        mfccFrames.push(Array.from(mfccResult.mfcc).slice(0, 13));
                    }
                } catch (e) {
                    // Skip frame if extraction fails
                }
            }

            if (mfccFrames.length === 0) {
                return { mfccMean: Array(13).fill(0), mfccVar: Array(13).fill(0), shape: [0, 13] };
            }

            // Calculate mean and variance across frames
            const mfccMean = new Array(13).fill(0);
            const mfccVar = new Array(13).fill(0);

            for (let i = 0; i < 13; i++) {
                let sum = 0;
                for (const frame of mfccFrames) {
                    sum += frame[i] || 0;
                }
                mfccMean[i] = sum / mfccFrames.length;
            }

            for (let i = 0; i < 13; i++) {
                let sumVar = 0;
                for (const frame of mfccFrames) {
                    const diff = (frame[i] || 0) - mfccMean[i];
                    sumVar += diff * diff;
                }
                mfccVar[i] = Math.sqrt(sumVar / mfccFrames.length);
            }

            return {
                mfccMean,
                mfccVar,
                frames: mfccFrames,
                shape: [mfccFrames.length, 13]
            };
        } catch (error) {
            console.warn('MFCC extraction failed:', error);
            return { mfccMean: Array(13).fill(0), mfccVar: Array(13).fill(0), shape: [0, 13] };
        }
    }

    /**
     * Extract Log-Mel Spectrogram
     * Essential input for deep learning genre models
     */
    extractLogMelSpectrogram(audioBuffer, sampleRate, essentia) {
        try {
            const frameSize = 2048;
            const hopSize = 512;
            const melBands = 64;
            const minFreq = 20;
            const maxFreq = sampleRate / 2;

            const frames = [];
            const hann = this.createHannWindow(frameSize);

            for (let i = 0; i + frameSize <= audioBuffer.length; i += hopSize) {
                const frame = new Float32Array(frameSize);
                for (let j = 0; j < frameSize; j++) {
                    frame[j] = audioBuffer[i + j] * hann[j];
                }

                try {
                    // Extract magnitude spectrum
                    const spectrum = essentia.Spectrum(frame, frameSize);
                    
                    // Convert to Mel scale
                    const melSpectrum = this.spectrumToMelScale(spectrum, melBands, sampleRate, minFreq, maxFreq);
                    
                    // Apply log compression
                    const logMel = melSpectrum.map(v => Math.log(Math.max(1e-9, v)) / Math.log(10));
                    frames.push(logMel);
                } catch (e) {
                    // Skip frame on error
                }
            }

            if (frames.length === 0) {
                return { spec: Array(64).fill(-80), shape: [1, 64], frames: [] };
            }

            // Take middle frame as representative
            const middleIdx = Math.floor(frames.length / 2);
            const representativeFrame = frames[middleIdx] || frames[0];

            return {
                spec: representativeFrame,
                shape: [frames.length, melBands],
                frames: frames,
                mean: this.getMeanVector(frames),
                std: this.getStdVector(frames)
            };
        } catch (error) {
            console.warn('Log-Mel spectrogram extraction failed:', error);
            return { spec: Array(64).fill(-80), shape: [1, 64], frames: [] };
        }
    }

    /**
     * Extract Chromagram (Chroma features)
     * Useful for detecting tonality and harmonic content
     */
    extractChromagram(audioBuffer, sampleRate, essentia) {
        try {
            const frameSize = 2048;
            const hopSize = 512;
            const chromaBins = 12;

            const chromaFrames = [];
            const hann = this.createHannWindow(frameSize);

            for (let i = 0; i + frameSize <= audioBuffer.length; i += hopSize) {
                const frame = new Float32Array(frameSize);
                for (let j = 0; j < frameSize; j++) {
                    frame[j] = audioBuffer[i + j] * hann[j];
                }

                try {
                    const spectrum = essentia.Spectrum(frame, frameSize);
                    const chroma = this.spectrumToChroma(spectrum, sampleRate, chromaBins);
                    chromaFrames.push(chroma);
                } catch (e) {
                    // Skip frame
                }
            }

            if (chromaFrames.length === 0) {
                return { mean: Array(12).fill(0), shape: [0, 12], frames: [] };
            }

            const mean = this.getMeanVector(chromaFrames);

            return {
                mean: mean,
                shape: [chromaFrames.length, 12],
                frames: chromaFrames,
                dominantChroma: this.getDominantChroma(mean)
            };
        } catch (error) {
            console.warn('Chromagram extraction failed:', error);
            return { mean: Array(12).fill(0), shape: [0, 12], frames: [] };
        }
    }

    /**
     * Extract spectral features (centroid, bandwidth, rolloff, flux)
     */
    extractSpectralFeatures(audioBuffer, essentia) {
        try {
            const frameSize = 2048;
            const hopSize = 512;

            const centroids = [];
            const bandwidths = [];
            const rolloffs = [];
            const fluxes = [];
            const hann = this.createHannWindow(frameSize);
            let prevSpectrum = null;

            for (let i = 0; i + frameSize <= audioBuffer.length; i += hopSize) {
                const frame = new Float32Array(frameSize);
                for (let j = 0; j < frameSize; j++) {
                    frame[j] = audioBuffer[i + j] * hann[j];
                }

                try {
                    const spectrum = essentia.Spectrum(frame, frameSize);
                    
                    const centroidResult = essentia.SpectralCentroidTime(spectrum);
                    if (centroidResult?.centroid) centroids.push(centroidResult.centroid);

                    const bandwidthResult = essentia.SpectralSpreadTime(spectrum);
                    if (bandwidthResult?.spread) bandwidths.push(bandwidthResult.spread);

                    const rolloffResult = essentia.SpectralRolloffTime(spectrum);
                    if (rolloffResult?.rolloff) rolloffs.push(rolloffResult.rolloff);

                    // Calculate spectral flux
                    if (prevSpectrum && spectrum.length === prevSpectrum.length) {
                        let flux = 0;
                        for (let j = 0; j < spectrum.length; j++) {
                            const diff = spectrum[j] - prevSpectrum[j];
                            flux += diff * diff;
                        }
                        fluxes.push(Math.sqrt(flux));
                    }

                    prevSpectrum = spectrum;
                } catch (e) {
                    // Skip frame
                }
            }

            return {
                centroid: this.getMean(centroids),
                centroidVar: this.getVariance(centroids),
                bandwidth: this.getMean(bandwidths),
                bandwidthVar: this.getVariance(bandwidths),
                rolloff: this.getMean(rolloffs),
                rolloffVar: this.getVariance(rolloffs),
                flux: this.getMean(fluxes),
                fluxVar: this.getVariance(fluxes)
            };
        } catch (error) {
            console.warn('Spectral features extraction failed:', error);
            return this.getEmptySpectralFeatures();
        }
    }

    /**
     * Extract temporal features (onset strength, regularity)
     */
    extractTemporalFeatures(audioBuffer, essentia) {
        try {
            const frameSize = 1024;
            const hopSize = 512;
            const energies = [];

            // Short-time energy per frame (RMS)
            for (let i = 0; i + frameSize <= audioBuffer.length; i += hopSize) {
                let acc = 0;
                for (let j = 0; j < frameSize; j++) {
                    const v = audioBuffer[i + j];
                    acc += v * v;
                }
                const rms = Math.sqrt(acc / frameSize);
                if (Number.isFinite(rms)) energies.push(rms);
            }

            if (energies.length < 2) return this.getEmptyTemporalFeatures();

            // Onset estimation via energy increases
            const diffs = [];
            for (let i = 1; i < energies.length; i++) {
                const diff = energies[i] - energies[i - 1];
                if (diff > 0) diffs.push(diff);
            }

            const meanDiff = this.getMean(diffs);
            const threshold = meanDiff * 1.5 || 0.0005;
            const onsets = diffs.filter(d => d > threshold);

            const onsetCount = onsets.length;
            const onsetEnergy = this.getMean(onsets);
            const onsetDensity = onsetCount / energies.length;
            const onsetVariance = this.getVariance(onsets);

            return {
                onsetCount,
                onsetMean: onsetEnergy,
                onsetEnergy,
                onsetDensity,
                onsetVariance
            };
        } catch (error) {
            console.warn('Temporal features extraction failed:', error);
            return this.getEmptyTemporalFeatures();
        }
    }

    /**
     * Convert spectrum to Mel scale
     */
    spectrumToMelScale(spectrum, melBands, sampleRate, minFreq, maxFreq) {
        const minMel = this.hertzToMel(minFreq);
        const maxMel = this.hertzToMel(maxFreq);
        const melBandCenters = [];

        for (let i = 0; i < melBands; i++) {
            const mel = minMel + (i / (melBands - 1)) * (maxMel - minMel);
            melBandCenters.push(this.melToHertz(mel));
        }

        const melSpectrum = new Array(melBands).fill(0);
        const binHz = (sampleRate / 2) / spectrum.length;

        for (let i = 0; i < melBands; i++) {
            const center = melBandCenters[i];
            const binCenter = center / binHz;
            const binIdx = Math.round(binCenter);
            if (binIdx >= 0 && binIdx < spectrum.length) {
                melSpectrum[i] = Math.abs(spectrum[binIdx] || 0);
            }
        }

        return melSpectrum;
    }

    /**
     * Convert spectrum to Chroma features
     */
    spectrumToChroma(spectrum, sampleRate, chromaBins = 12) {
        const chroma = new Array(chromaBins).fill(0);
        const binHz = (sampleRate / 2) / spectrum.length;
        const A4Hz = 440;

        for (let binIdx = 0; binIdx < spectrum.length; binIdx++) {
            const freq = binIdx * binHz;
            if (freq < 20 || freq > sampleRate / 2) continue;

            // Calculate MIDI note and chroma bin
            const cents = 1200 * Math.log2(freq / A4Hz);
            const semitone = Math.round(cents / 100);
            const chromeIdx = ((semitone % 12) + 12) % 12;

            chroma[chromeIdx] += Math.abs(spectrum[binIdx] || 0);
        }

        // Normalize
        const maxChroma = Math.max(...chroma, 1e-10);
        return chroma.map(c => c / maxChroma);
    }

    /**
     * Frequency conversion utilities
     */
    hertzToMel(hz) {
        return 2595 * Math.log10(1 + hz / 700);
    }

    melToHertz(mel) {
        return 700 * (Math.pow(10, mel / 2595) - 1);
    }

    /**
     * Get dominant chroma
     */
    getDominantChroma(chromaVector) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const maxIdx = chromaVector.indexOf(Math.max(...chromaVector));
        return {
            note: notes[maxIdx] || 'Unknown',
            index: maxIdx,
            value: chromaVector[maxIdx]
        };
    }

    /**
     * Window functions
     */
    createHannWindow(size) {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
        }
        return window;
    }

    /**
     * Statistical utilities
     */
    getMean(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    getVariance(arr) {
        if (!arr || arr.length === 0) return 0;
        const mean = this.getMean(arr);
        const sumSq = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0);
        return Math.sqrt(sumSq / arr.length);
    }

    getMeanVector(frames) {
        if (!frames || frames.length === 0) return [];
        const mean = new Array(frames[0].length).fill(0);
        for (const frame of frames) {
            for (let i = 0; i < frame.length; i++) {
                mean[i] += frame[i];
            }
        }
        return mean.map(v => v / frames.length);
    }

    getStdVector(frames) {
        if (!frames || frames.length === 0) return [];
        const mean = this.getMeanVector(frames);
        const variance = new Array(mean.length).fill(0);

        for (const frame of frames) {
            for (let i = 0; i < frame.length; i++) {
                variance[i] += (frame[i] - mean[i]) ** 2;
            }
        }

        return variance.map(v => Math.sqrt(v / frames.length));
    }

    calculateEnergy(audioBuffer) {
        if (!audioBuffer || audioBuffer.length === 0) return 0;
        let energy = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            const v = audioBuffer[i];
            if (Number.isFinite(v)) energy += v * v;
        }
        const val = Math.sqrt(energy / audioBuffer.length);
        return Number.isFinite(val) ? val : 0;
    }

    /**
     * Empty feature objects
     */
    getEmptyFeatures() {
        return {
            mfcc: { mfccMean: Array(13).fill(0), mfccVar: Array(13).fill(0), shape: [0, 13] },
            logMelSpec: { spec: Array(64).fill(-80), shape: [1, 64], frames: [] },
            chromagram: { mean: Array(12).fill(0), shape: [0, 12], frames: [] },
            spectralFeatures: this.getEmptySpectralFeatures(),
            temporalFeatures: this.getEmptyTemporalFeatures(),
            energy: 0,
            sampleRate: 44100,
            duration: 0
        };
    }

    getEmptySpectralFeatures() {
        return {
            centroid: 0,
            centroidVar: 0,
            bandwidth: 0,
            bandwidthVar: 0,
            rolloff: 0,
            rolloffVar: 0,
            flux: 0,
            fluxVar: 0
        };
    }

    getEmptyTemporalFeatures() {
        return {
            onsetCount: 0,
            onsetMean: 0,
            onsetEnergy: 0,
            onsetDensity: 0,
            onsetVariance: 0
        };
    }

    /**
     * Convert Essentia features to normalized feature vector for ML models
     */
    featuresToVector(features) {
        const vec = [];

        // MFCC features
        if (features.mfcc?.mfccMean) {
            vec.push(...features.mfcc.mfccMean);
            if (features.mfcc.mfccVar) {
                vec.push(...features.mfcc.mfccVar);
            }
        }

        // Chroma features
        if (features.chromagram?.mean) {
            vec.push(...features.chromagram.mean);
        }

        // Spectral features
        if (features.spectralFeatures) {
            const sf = features.spectralFeatures;
            vec.push(
                sf.centroid || 0,
                sf.centroidVar || 0,
                sf.bandwidth || 0,
                sf.bandwidthVar || 0,
                sf.rolloff || 0,
                sf.rolloffVar || 0,
                sf.flux || 0,
                sf.fluxVar || 0
            );
        }

        // Temporal features
        if (features.temporalFeatures) {
            const tf = features.temporalFeatures;
            vec.push(
                tf.onsetMean || 0,
                tf.onsetEnergy || 0,
                tf.onsetDensity || 0,
                tf.onsetVariance || 0
            );
        }

        // Energy
        vec.push(features.energy || 0);

        return vec;
    }

    /**
     * Classify genre using Essentia features directly (rule-based)
     * More accurate than tempo-only classification
     */
    classifyGenreFromFeatures(features) {
        const genres = {
            'Classical': 0,
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

        if (!features || !features.spectralFeatures || !features.temporalFeatures) {
            console.warn('⚠️ Insufficient features for genre classification');
            return [{ genre: 'Unknown', confidence: 0 }];
        }

        // Extract key features
        const spectral = features.spectralFeatures || {};
        const temporal = features.temporalFeatures || {};
        const chroma = features.chromagram || {};
        const mfcc = features.mfcc || {};
        
        const brightness = spectral.centroid ? (spectral.centroid / 8000) : 0.5; // Normalize
        const energy = features.energy || 0;
        const onsetDensity = temporal.onsetDensity || 0;
        const spectralFlux = spectral.flux || 0;
        const chromaVariance = chroma.variance || 0;
        
        // Classical: Low brightness, low onset density, high chroma variance (complex harmonies)
        if (brightness < 0.3 && onsetDensity < 2 && chromaVariance > 0.1) {
            genres['Classical'] += 0.8;
        }
        
        // Rock/Metal: High energy, high onset density, moderate-high brightness
        if (energy > 0.05 && onsetDensity > 5) {
            if (brightness > 0.6) {
                genres['Metal'] += 0.7;
                genres['Rock'] += 0.5;
            } else {
                genres['Rock'] += 0.7;
                genres['Metal'] += 0.3;
            }
        }
        
        // Electronic: Very high onset density, variable brightness, high flux
        if (onsetDensity > 8 || spectralFlux > 50) {
            genres['Electronic'] += 0.8;
            genres['Hip Hop'] += 0.3;
        }
        
        // Jazz: Moderate onset density, complex chromatic content
        if (onsetDensity >= 3 && onsetDensity <= 6 && chromaVariance > 0.15) {
            genres['Jazz'] += 0.7;
            genres['Blues'] += 0.4;
        }
        
        // Blues: Low-moderate onset density, lower brightness
        if (onsetDensity < 4 && brightness < 0.4 && energy > 0.02) {
            genres['Blues'] += 0.6;
            genres['R&B/Soul'] += 0.4;
        }
        
        // Folk/Country: Moderate features across board
        if (onsetDensity >= 2 && onsetDensity <= 5 && brightness >= 0.3 && brightness <= 0.6) {
            genres['Folk'] += 0.5;
            genres['Country'] += 0.5;
            genres['World'] += 0.3;
        }
        
        // Reggae: Low onset density, regular pattern
        if (onsetDensity < 3 && temporal.onsetVariance && temporal.onsetVariance < 0.2) {
            genres['Reggae'] += 0.7;
        }
        
        // Pop: Moderate-high energy, regular onsets
        if (energy > 0.03 && onsetDensity >= 3 && onsetDensity <= 7) {
            genres['Pop'] += 0.6;
        }
        
        // Latin: High onset density, bright
        if (onsetDensity >= 5 && onsetDensity <= 10 && brightness > 0.5) {
            genres['Latin'] += 0.6;
        }
        
        // Normalize and sort
        const maxScore = Math.max(...Object.values(genres));
        if (maxScore > 0) {
            for (const genre in genres) {
                genres[genre] = genres[genre] / maxScore;
            }
        }
        
        const sortedGenres = Object.entries(genres)
            .map(([genre, confidence]) => ({ genre, confidence }))
            .sort((a, b) => b.confidence - a.confidence)
            .filter(g => g.confidence > 0.1)
            .slice(0, 5);
        
        console.log('🎵 Essentia genre classification:', sortedGenres.map(g => 
            `${g.genre}: ${(g.confidence * 100).toFixed(1)}%`
        ).join(', '));
        
        return sortedGenres.length > 0 ? sortedGenres : [{ genre: 'Unknown', confidence: 0 }];
    }
}

export default EssentiaGenreClassifier;

/**
 * Machine Learning Genre Classification using Essentia Models
 * Uses pre-trained TensorFlow.js models for accurate genre classification
 */

import * as tf from '@tensorflow/tfjs';
import * as ort from 'onnxruntime-web';

class GenreMLClassifier {
    constructor() {
        this.model = null;          // Legacy/heuristic model placeholder
        this.tfModel = null;        // TF.js graph model if available
        this.modelMetadata = null;
        this.isLoaded = false;
        this.modelType = 'genre_discogs400'; // Can be changed to genre_discogs519 for more genres
        this.inputSpec = { frames: 96, mels: 64, channelsLast: true, shape: [] };
        this.ortSession = null;
        this.ortReady = false;
        this.ortInput = { name: null, shape: [], channelsLast: true };
    }

    /**
     * Resolve an asset path that works in both local dev (root) and GitHub Pages subpath (/world-ethnomusic-lab/).
     */
    resolveAssetPath(relativePath) {
        const base = (typeof __webpack_public_path__ !== 'undefined' && __webpack_public_path__)
            ? __webpack_public_path__
            : '/';
        const normalizedBase = base.endsWith('/') ? base : `${base}/`;
        const trimmed = relativePath.replace(/^\/+/, '');
        return `${normalizedBase}${trimmed}`;
    }

    /**
     * Load the pre-trained genre classification model
     */
    async loadModel() {
        try {
            console.log('Loading Essentia genre classification model...');

            // Attempt to load TF.js graph model if present in /models
            // Expected path: /models/genre_discogs400/model.json (handled via webpack publicPath)
            // Place downloaded Essentia TFJS bundle in public/models/genre_discogs400
            try {
                const tfModelUrl = this.resolveAssetPath('models/genre_discogs400/model.json');
                this.tfModel = await tf.loadGraphModel(tfModelUrl);
                this.inputSpec = this.getInputSpec();
                await this.loadMetadata(this.resolveAssetPath('models/genre_discogs400/metadata.json'));
                console.log('TF.js genre model loaded from', tfModelUrl, 'with input', this.inputSpec.shape);
            } catch (tfErr) {
                console.warn('TF.js genre model not found or failed to load; using heuristic classifier:', tfErr?.message || tfErr);
                this.tfModel = null;
            }

            // Attempt to load ONNX model via onnxruntime-web (wasm)
            try {
                // Serve ORT wasm assets from /ort copied by webpack (force trailing slash to avoid path concat issues)
                const ortBase = this.resolveAssetPath('ort/');
                ort.env.wasm.wasmPaths = ortBase;
                const ortModelUrl = this.resolveAssetPath('models/genre_discogs400/genre_discogs400-discogs-maest-30s-pw-1.onnx');
                this.ortSession = await ort.InferenceSession.create(ortModelUrl, {
                    executionProviders: ['wasm'],
                    graphOptimizationLevel: 'all'
                });
                this.ortReady = true;
                this.ortInput = this.getOrtInputSpec();
                await this.loadMetadata(this.resolveAssetPath('models/genre_discogs400/metadata.json'));
                console.log('ONNX genre model loaded from', ortModelUrl, 'with input', this.ortInput.shape);
            } catch (ortErr) {
                console.warn('ONNX genre model not found or failed to load; will fall back to TF/heuristics:', ortErr?.message || ortErr);
                this.ortSession = null;
                this.ortReady = false;
            }
            
            // For now, we'll use a simplified approach with the existing infrastructure
            // In production, you would download the actual model files from:
            // https://essentia.upf.edu/models/classification-heads/genre_discogs400/
            
            // Model metadata for genre_discogs400
            this.modelMetadata = this.modelMetadata || {
                classes: [
                    'Blues', 'Brass & Military', "Children's", 'Classical', 'Electronic',
                    'Folk, World, & Country', 'Funk / Soul', 'Hip Hop', 'Jazz', 'Latin',
                    'Non-Music', 'Pop', 'Reggae', 'Rock', 'Stage & Screen'
                ],
                expectedFeatures: 'logmel',
                sampleRate: 44100
            };

            this.isLoaded = true;
            console.log('Genre classification model ready (using feature-based approach)');
            return true;
        } catch (error) {
            console.error('Failed to load genre model:', error);
            this.isLoaded = false;
            return false;
        }
    }

    /**
     * Classify genre from audio features
     * @param {Object} features - Audio features extracted from the analyzer
     * @returns {Object} - Genre predictions with confidence scores
     */
    async classifyGenre(features) {
        if (!this.isLoaded) {
            console.warn('Genre model not loaded, falling back to heuristic classification');
            return null;
        }

        try {
            // Prefer ONNX (onnxruntime-web) if loaded
            const ortPrediction = await this.predictWithORTModel(features);
            if (ortPrediction) {
                return ortPrediction;
            }

            // If TF.js model is available and we can build a compatible input, try it first
            const tfPrediction = await this.predictWithTFModel(features);
            if (tfPrediction) {
                return tfPrediction;
            }

            // Extract relevant features for genre classification
            const {
                tempo,
                spectralCentroid,
                mfcc,
                chroma,
                brightness,
                percussiveness,
                complexity,
                regularity
            } = features;

            // Use a feature-based approach similar to Essentia's methodology
            // This creates a feature vector that can be used for genre classification
            const predictions = this.predictFromFeatures({
                tempo,
                spectralCentroid,
                mfcc,
                chroma,
                brightness,
                percussiveness,
                complexity,
                regularity
            });

            return predictions;
        } catch (error) {
            console.error('Error during ML genre classification:', error);
            return null;
        }
    }

    /**
     * Attempt to run the TF.js model if present.
     * Currently this returns null unless the input shape can be satisfied.
     */
    async predictWithTFModel(features) {
        if (!this.tfModel) return null;

        try {
            const inputShape = this.tfModel.inputs?.[0]?.shape || [];
            const spec = this.inputSpec || this.getInputSpec();
            const sampleRate = features?.sampleRate || 44100;
            const rawAudio = features?.rawAudio;

            // Build log-mel tensor either from a provided spec or raw audio
            let logMelTensor = null;
            if (features?.logMelTensor) {
                logMelTensor = features.logMelTensor;
            } else if (features?.logMelSpec) {
                logMelTensor = this.tensorFromLogMel(features.logMelSpec, spec);
            } else if (rawAudio && rawAudio.length > 0) {
                logMelTensor = await this.buildLogMelTensorFromPCM(rawAudio, sampleRate, spec);
            }

            if (!logMelTensor) {
                console.warn('TF.js model present but no log-mel features available; skipping ML prediction. Expected input shape:', inputShape);
                return null;
            }

            const logitsRaw = await this.tfModel.predict(logMelTensor);
            const logits = Array.isArray(logitsRaw) ? logitsRaw[0] : logitsRaw;
            const probsTensor = tf.softmax(logits);
            const probs = await probsTensor.data();

            const labels = this.resolveLabels(probs.length);
            const scored = labels.map((label, idx) => ({
                label,
                canonical: this.toCanonicalGenre(label),
                confidence: probs[idx] || 0
            }));

            scored.sort((a, b) => b.confidence - a.confidence);
            const top = scored.slice(0, 5);

            const predictions = top.map(p => ({
                genre: p.canonical,
                confidence: p.confidence
            }));

            if (probsTensor?.dispose) probsTensor.dispose();
            if (logits?.dispose) logits.dispose();
            if (Array.isArray(logitsRaw)) {
                logitsRaw.forEach(t => t?.dispose && t.dispose());
            }
            if (logMelTensor?.dispose) logMelTensor.dispose();

            return {
                topGenre: predictions[0].genre,
                confidence: predictions[0].confidence,
                predictions
            };
        } catch (err) {
            console.warn('TF.js prediction failed, falling back to heuristic classifier:', err?.message || err);
            return null;
        }
    }

    async predictWithORTModel(features) {
        if (!this.ortReady || !this.ortSession || !this.ortInput.name) return null;
        try {
            const spec = this.ortInput;
            const sampleRate = features?.sampleRate || 44100;
            const rawAudio = features?.rawAudio;
            const logMelSpec = features?.logMelSpec;

            if (!rawAudio && !logMelSpec) return null;

            const logMelTf = logMelSpec
                ? this.tensorFromLogMel(logMelSpec, { frames: spec.frames, mels: spec.mels, channelsLast: true })
                : await this.buildLogMelTensorFromPCM(rawAudio, sampleRate, { frames: spec.frames, mels: spec.mels, channelsLast: spec.channelsLast });

            // Reshape to expected input shape
            const targetShape = spec.shape.map(v => (v && v > 0 ? v : 1));
            const reshaped = logMelTf.reshape(targetShape);
            const inputData = reshaped.dataSync();
            const inputTensor = new ort.Tensor('float32', inputData, targetShape);

            const outputs = await this.ortSession.run({ [spec.name]: inputTensor });
            const firstKey = this.ortSession.outputNames?.[0] || Object.keys(outputs)[0];
            if (!firstKey) return null;
            const outTensor = outputs[firstKey];
            const probs = this.softmaxArray(outTensor.data);

            const labels = this.resolveLabels(probs.length);
            const scored = labels.map((label, idx) => ({
                label,
                canonical: this.toCanonicalGenre(label),
                confidence: probs[idx] || 0
            })).sort((a, b) => b.confidence - a.confidence).slice(0, 5);

            const predictions = scored.map(p => ({ genre: p.canonical, confidence: p.confidence }));

            if (logMelTf?.dispose) logMelTf.dispose();
            if (reshaped?.dispose) reshaped.dispose();

            return {
                topGenre: predictions[0].genre,
                confidence: predictions[0].confidence,
                predictions
            };
        } catch (err) {
            console.warn('ONNX prediction failed, falling back:', err?.message || err);
            return null;
        }
    }

    getInputSpec() {
        const shape = this.tfModel?.inputs?.[0]?.shape || [];
        const dims = shape.slice();
        const positiveDims = dims.filter(v => typeof v === 'number' && v > 1);
        const frames = positiveDims[0] || 96;
        const mels = positiveDims[1] || 64;
        const channelsLast = shape.length === 4 ? (shape[shape.length - 1] === 1) : true;
        return { frames, mels, channelsLast, shape };
    }

    getOrtInputSpec() {
        try {
            const name = Array.isArray(this.ortSession?.inputNames) ? this.ortSession.inputNames[0] : null;
            if (!name) return { name: null, shape: [], channelsLast: true };
            const meta = this.ortSession.inputMetadata?.[name];
            const dims = (meta && Array.isArray(meta.dimensions)) ? meta.dimensions : [];
            const shape = dims.map(d => (typeof d === 'number' && d > 0 ? d : 1));
            const frames = shape[1] || 96;
            const mels = shape[2] || 64;
            const channelsLast = shape.length === 4 ? (shape[shape.length - 1] === 1) : true;
            return { name, shape, frames, mels, channelsLast };
        } catch (e) {
            console.warn('Unable to derive ORT input spec:', e?.message || e);
            return { name: null, shape: [], channelsLast: true };
        }
    }

    resolveLabels(outputSize) {
        if (Array.isArray(this.modelMetadata?.classes) && this.modelMetadata.classes.length === outputSize) {
            return this.modelMetadata.classes;
        }
        const fallback = [];
        for (let i = 0; i < outputSize; i++) fallback.push(`Class_${i}`);
        return fallback;
    }

    toCanonicalGenre(label) {
        const l = (label || '').toLowerCase();
        if (l.includes('reggae')) return 'Reggae';
        if (l.includes('hip hop') || l.includes('rap')) return 'Hip Hop';
        if (l.includes('electronic') || l.includes('edm') || l.includes('techno') || l.includes('house')) return 'Electronic';
        if (l.includes('classical')) return 'European Classical';
        if (l.includes('country')) return 'Country';
        if (l.includes('folk')) return 'Folk';
        if (l.includes('world')) return 'World';
        if (l.includes('latin') || l.includes('salsa') || l.includes('cumbia') || l.includes('bossa')) return 'Latin';
        if (l.includes('rock') || l.includes('metal')) return 'Rock';
        if (l.includes('jazz')) return 'Jazz';
        if (l.includes('blues')) return 'Blues';
        if (l.includes('soul') || l.includes('r&b')) return 'R&B/Soul';
        if (l.includes('pop')) return 'Pop';
        if (l.includes('brass')) return 'Blues';
        return label || 'Unknown';
    }

    softmaxArray(arr) {
        if (!arr || arr.length === 0) return [];
        const max = Math.max(...arr);
        const exps = arr.map(v => Math.exp(v - max));
        const sum = exps.reduce((a, b) => a + b, 0) || 1;
        return exps.map(v => v / sum);
    }

    tensorFromLogMel(logMelSpec, spec) {
        return tf.tidy(() => {
            const frames = logMelSpec.length;
            const mels = Array.isArray(logMelSpec[0]) ? logMelSpec[0].length : spec.mels;
            let t = tf.tensor2d(logMelSpec, [frames, mels]);
            t = this.padOrSlice(t, spec.frames, spec.mels);
            t = this.normalizeLogMel(t);
            return this.reshapeForModel(t, spec);
        });
    }

    async buildLogMelTensorFromPCM(rawAudio, sampleRate, spec) {
        return tf.tidy(() => {
            const sr = sampleRate || 44100;
            const frameLength = 1024;
            const hop = 512;
            const melBins = spec.mels || 64;

            const waveform = tf.tensor1d(rawAudio);
            const window = tf.signal.hannWindow(frameLength);
            const stft = tf.signal.stft(waveform, frameLength, hop, undefined, window);
            const powerSpec = tf.square(tf.abs(stft));
            const numFreqs = powerSpec.shape[1] || (frameLength / 2 + 1);
            const melMatrix = tf.signal.linearToMelWeightMatrix(melBins, numFreqs, sr, 0, sr / 2);
            const melSpec = tf.matMul(powerSpec, melMatrix.transpose()); // [frames, melBins]
            let logMel = tf.log(melSpec.add(1e-6));

            const framesAvailable = logMel.shape[0];
            if (framesAvailable && framesAvailable > spec.frames) {
                const start = Math.max(0, Math.floor((framesAvailable - spec.frames) / 2));
                logMel = logMel.slice([start, 0], [spec.frames, -1]);
            }

            let t2d = logMel;
            t2d = this.padOrSlice(t2d, spec.frames, spec.mels);
            t2d = this.normalizeLogMel(t2d);
            return this.reshapeForModel(t2d, spec);
        });
    }

    padOrSlice(tensor2d, targetFrames, targetMels) {
        let t = tensor2d;
        const [frames, mels] = t.shape;
        if (mels > targetMels) t = t.slice([0, 0], [-1, targetMels]);
        if (mels < targetMels) t = t.pad([[0, 0], [0, targetMels - mels]]);
        if (frames > targetFrames) t = t.slice([0, 0], [targetFrames, -1]);
        if (frames < targetFrames) t = t.pad([[0, targetFrames - frames], [0, 0]]);
        return t;
    }

    normalizeLogMel(tensor2d) {
        const { mean, variance } = tf.moments(tensor2d);
        const std = tf.sqrt(variance.add(1e-6));
        return tensor2d.sub(mean).div(std);
    }

    reshapeForModel(tensor2d, spec) {
        if (spec.channelsLast) {
            return tensor2d.expandDims(-1).expandDims(0);
        }
        // Channels-first models expect [batch, 1, frames, mels]
        return tensor2d.expandDims(0).expandDims(0);
    }

    async loadMetadata(metadataUrl) {
        try {
            if (typeof fetch !== 'function') return;
            const res = await fetch(metadataUrl);
            if (!res.ok) return;
            const data = await res.json();
            if (data?.classes && Array.isArray(data.classes)) {
                this.modelMetadata = { ...this.modelMetadata, classes: data.classes };
            }
        } catch (e) {
            console.warn('Unable to load model metadata:', e?.message || e);
        }
    }

    /**
     * Predict genre based on audio features
     * This is a simplified version - in production, this would use the actual TF model
     */
    predictFromFeatures(features) {
        const scores = {};
        
        // Enhanced feature-based classification using Essentia's methodology
        // This simulates what the ML model would do based on audio features
        
        // Blues characteristics
        scores['Blues'] = this.calculateBluesScore(features);
        
        // Classical characteristics
        scores['Classical'] = this.calculateClassicalScore(features);
        
        // Electronic characteristics
        scores['Electronic'] = this.calculateElectronicScore(features);
        
        // Folk/World characteristics
        scores['Folk, World, & Country'] = this.calculateFolkWorldScore(features);
        
        // Funk/Soul characteristics
        scores['Funk / Soul'] = this.calculateFunkSoulScore(features);
        
        // Hip Hop characteristics
        scores['Hip Hop'] = this.calculateHipHopScore(features);
        
        // Jazz characteristics
        scores['Jazz'] = this.calculateJazzScore(features);
        
        // Latin characteristics
        scores['Latin'] = this.calculateLatinScore(features);
        
        // Pop characteristics
        scores['Pop'] = this.calculatePopScore(features);
        
        // Reggae characteristics (enhanced)
        scores['Reggae'] = this.calculateReggaeScore(features);
        
        // Rock characteristics
        scores['Rock'] = this.calculateRockScore(features);

        // Normalize scores
        const total = Object.values(scores).reduce((sum, val) => sum + Math.max(0, val), 0);
        const normalized = {};
        
        for (const [genre, score] of Object.entries(scores)) {
            normalized[genre] = total > 0 ? Math.max(0, score) / total : 0;
        }

        // Sort by confidence
        const sortedGenres = Object.entries(normalized)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return {
            topGenre: sortedGenres[0][0],
            confidence: sortedGenres[0][1],
            predictions: sortedGenres.map(([genre, conf]) => ({
                genre,
                confidence: conf
            }))
        };
    }

    calculateReggaeScore(features) {
        const { tempo, regularity, percussiveness, spectralCentroid, brightness, complexity } = features;
        
        let score = 0;
        
        // Reggae tempo range (typically 80-120 BPM)
        if (tempo >= 80 && tempo <= 120) {
            score += 3.0;
            // Sweet spot around 95-105 BPM
            if (tempo >= 95 && tempo <= 105) {
                score += 2.0;
            }
        }
        
        // Reggae has characteristic off-beat rhythm (low regularity)
        if (regularity < 0.15) {
            score += 2.5;
            if (regularity < 0.08) {
                score += 1.5;
            }
        }
        
        // Light to moderate percussion
        if (percussiveness >= 0.02 && percussiveness <= 0.1) {
            score += 2.0;
        }
        
        // Mid-range spectral content (bass-heavy but not too bright)
        if (spectralCentroid > 5000 && spectralCentroid < 15000) {
            score += 1.5;
        }
        
        // Moderate brightness
        if (brightness > 0.3 && brightness < 0.7) {
            score += 1.0;
        }
        
        // Moderate complexity
        if (complexity > 0.4 && complexity < 0.8) {
            score += 1.5;
        }
        
        return score;
    }

    calculateBluesScore(features) {
        const { tempo, spectralCentroid, brightness, percussiveness } = features;
        let score = 0;
        
        if (tempo >= 60 && tempo <= 120) score += 1.5;
        if (spectralCentroid > 3000 && spectralCentroid < 10000) score += 1.0;
        if (brightness < 0.6) score += 1.0;
        if (percussiveness < 0.15) score += 1.0;
        
        return score;
    }

    calculateClassicalScore(features) {
        const { regularity, complexity, percussiveness, brightness } = features;
        let score = 0;
        
        if (regularity > 0.3) score += 2.0;
        if (complexity > 0.7) score += 1.5;
        if (percussiveness < 0.1) score += 2.0;
        if (brightness > 0.5) score += 1.0;
        
        return score;
    }

    calculateElectronicScore(features) {
        const { regularity, percussiveness, spectralCentroid, complexity } = features;
        let score = 0;
        
        if (regularity > 0.4) score += 2.0;
        if (percussiveness > 0.15) score += 1.5;
        if (spectralCentroid > 8000) score += 1.5;
        if (complexity > 0.5) score += 1.0;
        
        return score;
    }

    calculateFolkWorldScore(features) {
        const { complexity, regularity, percussiveness, spectralCentroid } = features;
        let score = 0;
        
        if (complexity > 0.6) score += 1.5;
        if (regularity < 0.2) score += 1.5;
        if (percussiveness > 0.03 && percussiveness < 0.15) score += 1.5;
        if (spectralCentroid > 8000) score += 1.0;
        
        return score;
    }

    calculateFunkSoulScore(features) {
        const { tempo, regularity, percussiveness } = features;
        let score = 0;
        
        if (tempo >= 90 && tempo <= 130) score += 1.5;
        if (regularity < 0.3) score += 1.5;
        if (percussiveness > 0.1 && percussiveness < 0.25) score += 2.0;
        
        return score;
    }

    calculateHipHopScore(features) {
        const { tempo, regularity, percussiveness, brightness } = features;
        let score = 0;
        
        if (tempo >= 80 && tempo <= 110) score += 1.5;
        if (regularity > 0.3) score += 1.5;
        if (percussiveness > 0.15) score += 2.0;
        if (brightness < 0.5) score += 1.0;
        
        return score;
    }

    calculateJazzScore(features) {
        const { complexity, regularity, tempo } = features;
        let score = 0;
        
        if (complexity > 0.7) score += 2.0;
        if (regularity < 0.25) score += 1.5;
        if (tempo >= 120 && tempo <= 200) score += 1.0;
        
        return score;
    }

    calculateLatinScore(features) {
        const { tempo, regularity, percussiveness } = features;
        let score = 0;
        
        if (tempo >= 100 && tempo <= 140) score += 1.5;
        if (regularity < 0.3) score += 1.5;
        if (percussiveness > 0.12 && percussiveness < 0.3) score += 2.0;
        
        return score;
    }

    calculatePopScore(features) {
        const { tempo, regularity, brightness, complexity } = features;
        let score = 0;
        
        if (tempo >= 100 && tempo <= 130) score += 1.5;
        if (regularity > 0.25) score += 1.5;
        if (brightness > 0.4 && brightness < 0.7) score += 1.0;
        if (complexity > 0.4 && complexity < 0.7) score += 1.0;
        
        return score;
    }

    calculateRockScore(features) {
        const { tempo, percussiveness, brightness, spectralCentroid } = features;
        let score = 0;
        
        if (tempo >= 110 && tempo <= 150) score += 1.5;
        if (percussiveness > 0.15) score += 2.0;
        if (brightness > 0.5) score += 1.0;
        if (spectralCentroid > 6000) score += 1.0;
        
        return score;
    }
}

// Export singleton instance
export const genreMLClassifier = new GenreMLClassifier();

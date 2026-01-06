/**
 * ML-based Genre Classifier Trainer
 * Trains a TensorFlow.js neural network on labeled music samples
 * Stores model in IndexedDB for persistence
 */

import * as tf from '@tensorflow/tfjs';

const MLTrainer = {
  model: null,
  trainingData: [],
  ragaLabels: new Map(), // Map raga names to indices
  modelName: 'ethno-raga-classifier',
  db: null,

  /**
   * Initialize ML system: check for saved model
   */
  async init() {
    try {
      // Try to load saved model from IndexedDB
      await this.loadModelFromStorage();
      // Try to load saved training data
      await this.loadTrainingDataFromStorage();
      console.log('[ML] Initialized. Model loaded:', !!this.model, 'Samples:', this.trainingData.length);
      return true;
    } catch (err) {
      console.warn('[ML] Failed to initialize:', err);
      return false;
    }
  },

  /**
   * Extract features from audio context for ML
   * Prioritizes Essentia.js features if available
   * Returns normalized feature vector
   */
  extractMLFeatures(rhythmAnalysis, scaleAnalysis, spectralAnalysis, essentiaFeatures = null, mlFeatures = null) {
    // Prefer Essentia features if available
    if (essentiaFeatures) {
      const essentiaMfcc = essentiaFeatures.mfcc || Array(13).fill(0);
      const features = [
        // Essentia MFCC (13 coefficients)
        essentiaMfcc[0] || 0,
        essentiaMfcc[1] || 0,
        essentiaMfcc[2] || 0,
        essentiaMfcc[3] || 0,
        essentiaMfcc[4] || 0,
        essentiaMfcc[5] || 0,
        essentiaMfcc[6] || 0,
        essentiaMfcc[7] || 0,
        essentiaMfcc[8] || 0,
        essentiaMfcc[9] || 0,
        essentiaMfcc[10] || 0,
        essentiaMfcc[11] || 0,
        essentiaMfcc[12] || 0,
        
        // Essentia spectral features
        essentiaFeatures.centroid || 0.5,
        essentiaFeatures.spread || 0.3,
        essentiaFeatures.rolloff || 0.7,
        
        // Essentia onset strength (percussiveness)
        essentiaFeatures.onsetStrength || 0,
        
        // Rhythm features
        rhythmAnalysis?.tempo || 0,
        rhythmAnalysis?.regularity || 0,
        rhythmAnalysis?.complexity || 0,
        rhythmAnalysis?.polyrhythmic ? 1 : 0,
        
        // Scale/pitch features
        this.encodeScale(scaleAnalysis?.scale || 'Unknown'),
        scaleAnalysis?.octaveRange || 0,
        
        // Additional context
        essentiaFeatures.tempo || 0,
        essentiaFeatures.rawFeatures?.keyStrength || 0,
      ];
      return this.normalizeFeatures(features);
    }

    // Fallback to basic features if no Essentia
    const features = {
      // Audio features (always available)
      tempo: rhythmAnalysis.tempo || 0,
      regularity: rhythmAnalysis.regularity || 0,
      percussiveness: rhythmAnalysis.percussiveness || 0,
      brightness: spectralAnalysis.brightness || 0,
      complexity: rhythmAnalysis.complexity || 0,
      polyrhythmic: rhythmAnalysis.polyrhythmic ? 1 : 0,

      // Scale features (one-hot or encoded)
      scaleIndex: this.encodeScale(scaleAnalysis.scale || 'Unknown'),
      scaleOctaveRange: scaleAnalysis.octaveRange || 0,

      // Optional ML features from Essentia (MFCCs, spectral)
      mfcc1: mlFeatures?.mfcc?.[0] || 0,
      mfcc2: mlFeatures?.mfcc?.[1] || 0,
      mfcc3: mlFeatures?.mfcc?.[2] || 0,
      spectralCentroid: mlFeatures?.spectralCentroid || 0,
      zeroCrossingRate: mlFeatures?.zeroCrossingRate || 0,
    };

    // Normalize to [0, 1]
    return this.normalizeFeatures(features);
  },

  /**
   * Encode scale name to numeric index (0-15)
   */
  encodeScale(scale) {
    const scaleMap = {
      'Major': 0, 'Minor': 1, 'Pentatonic': 2, 'Blues': 3,
      'Harmonic Minor': 4, 'Dorian': 5, 'Phrygian': 6, 'Lydian': 7,
      'Mixolydian': 8, 'Whole Tone': 9, 'Chromatic': 10, 'Diminished': 11,
      'Unknown': 12
    };
    return (scaleMap[scale] || 12) / 12; // Normalize to [0, 1]
  },

  /**
   * Normalize feature vector to [0, 1] range
   * Supports both object and array input
   */
  normalizeFeatures(features) {
    const normalized = [];
    
    // If features is an array (from Essentia), normalize element-wise
    if (Array.isArray(features)) {
      for (let i = 0; i < features.length; i++) {
        const val = features[i] || 0;
        // MFCC coefficients range roughly [-100, 100]
        if (i < 13) {
          normalized.push(Math.max(0, Math.min(1, (val + 100) / 200)));
        } else if (i < 16) {
          // Spectral features (centroid, spread, rolloff) already ~[0,1]
          normalized.push(Math.max(0, Math.min(1, val)));
        } else if (i < 21) {
          // Rhythm features and polyrhythmic
          normalized.push(Math.max(0, Math.min(1, val)));
        } else {
          // Scale and tempo
          normalized.push(Math.max(0, Math.min(1, val)));
        }
      }
      return normalized;
    }

    // If features is an object (fallback), normalize by key
    const ranges = {
      tempo: [40, 300],
      regularity: [0, 1],
      percussiveness: [0, 1],
      brightness: [0, 1],
      complexity: [0, 1],
      polyrhythmic: [0, 1],
      scaleIndex: [0, 1],
      scaleOctaveRange: [1, 10],
      mfcc1: [-1000, 1000],
      mfcc2: [-1000, 1000],
      mfcc3: [-1000, 1000],
      spectralCentroid: [0, 11000],
      zeroCrossingRate: [0, 0.5],
    };

    for (const [key, value] of Object.entries(features)) {
      const [min, max] = ranges[key] || [0, 1];
      normalized.push(Math.max(0, Math.min(1, (value - min) / (max - min))));
    }

    return normalized;
  },

  /**
   * Add labeled training sample
   */
  addTrainingSample(features, ragaLabel) {
    // Ensure label exists in map
    if (!this.ragaLabels.has(ragaLabel)) {
      this.ragaLabels.set(ragaLabel, this.ragaLabels.size);
    }

    this.trainingData.push({
      features,
      label: ragaLabel,
      timestamp: Date.now(),
    });

    console.log(`[ML] Added training sample: ${ragaLabel} (total: ${this.trainingData.length})`);
    
    // Auto-save training data to IndexedDB
    this.saveTrainingDataToStorage().catch(err => 
      console.warn('[ML] Failed to auto-save training data:', err)
    );
  },

  /**
   * Train neural network on collected samples
   */
  async train(epochs = 50, batchSize = 8, validationSplit = 0.2) {
    if (this.trainingData.length < 5) {
      console.error('[ML] Need at least 5 training samples');
      return null;
    }

    try {
      console.log(`[ML] Starting training: ${this.trainingData.length} samples, ${this.ragaLabels.size} ragas`);

      // Prepare data
      const features = this.trainingData.map(d => d.features);
      const labels = this.trainingData.map(d => this.ragaLabels.get(d.label));

      // Convert to tensors
      const xs = tf.tensor2d(features);
      const ys = tf.oneHot(
        tf.tensor1d(labels, 'int32'),
        this.ragaLabels.size
      );

      // Build model
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [features[0].length], units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: this.ragaLabels.size, activation: 'softmax' }),
        ],
      });

      this.model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      });

      // Train
      const history = await this.model.fit(xs, ys, {
        epochs,
        batchSize,
        validationSplit,
        verbose: 0,
        shuffle: true,
      });

      console.log('[ML] Training complete');
      console.log('Final accuracy:', history.history.acc[history.history.acc.length - 1]);

      // Cleanup tensors
      xs.dispose();
      ys.dispose();

      // Save model
      await this.saveModelToStorage();

      return {
        success: true,
        epochs,
        samples: this.trainingData.length,
        ragas: this.ragaLabels.size,
        finalAccuracy: history.history.acc[history.history.acc.length - 1],
      };
    } catch (err) {
      console.error('[ML] Training failed:', err);
      return null;
    }
  },

  /**
   * Predict raga from features using trained model
   * Returns { raga: string, confidence: number }
   */
  predict(features) {
    if (!this.model) {
      return null;
    }

    try {
      const input = tf.tensor2d([features]);
      const predictions = this.model.predict(input);
      const output = predictions.dataSync();

      // Find best prediction
      let maxConfidence = 0;
      let bestIndex = 0;

      for (let i = 0; i < output.length; i++) {
        if (output[i] > maxConfidence) {
          maxConfidence = output[i];
          bestIndex = i;
        }
      }

      // Map index back to raga label
      let ragaLabel = 'Unknown';
      for (const [label, index] of this.ragaLabels.entries()) {
        if (index === bestIndex) {
          ragaLabel = label;
          break;
        }
      }

      input.dispose();
      predictions.dispose();

      return {
        raga: ragaLabel,
        confidence: maxConfidence,
        allPredictions: Array.from(output).map((conf, idx) => {
          let label = 'Unknown';
          for (const [l, i] of this.ragaLabels.entries()) {
            if (i === idx) {
              label = l;
              break;
            }
          }
          return { raga: label, confidence: conf };
        }),
      };
    } catch (err) {
      console.error('[ML] Prediction failed:', err);
      return null;
    }
  },

  /**
   * Save model to browser IndexedDB
   */
  async saveModelToStorage() {
    if (!this.model) return;

    try {
      await this.model.save(
        `indexeddb://${this.modelName}`
      );
      console.log('[ML] Model saved to IndexedDB');
    } catch (err) {
      console.warn('[ML] Failed to save model:', err);
    }
  },

  /**
   * Load model from browser IndexedDB
   */
  async loadModelFromStorage() {
    try {
      const models = await tf.io.listModels();
      if (models[`indexeddb://${this.modelName}`]) {
        this.model = await tf.loadLayersModel(`indexeddb://${this.modelName}`);
        console.log('[ML] Model loaded from IndexedDB');
        return true;
      }
    } catch (err) {
      console.warn('[ML] No saved model found');
    }
    return false;
  },

  /**
   * Delete saved model
   */
  async deleteModel() {
    try {
      await tf.io.removeModel(`indexeddb://${this.modelName}`);
      this.model = null;
      this.trainingData = [];
      this.ragaLabels.clear();
      // Also delete training data
      await this.deleteTrainingDataFromStorage();
      console.log('[ML] Model and training data deleted');
    } catch (err) {
      console.warn('[ML] Failed to delete model:', err);
    }
  },

  /**
   * Save training data to IndexedDB
   */
  async saveTrainingDataToStorage() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(['trainingData'], 'readwrite');
      const store = tx.objectStore('trainingData');
      
      const data = {
        id: 'main',
        samples: this.trainingData,
        ragaLabels: Array.from(this.ragaLabels.entries()),
        savedAt: new Date().toISOString()
      };
      
      await store.put(data);
      console.log('[ML] Training data saved to IndexedDB');
    } catch (err) {
      console.warn('[ML] Failed to save training data:', err);
    }
  },

  /**
   * Load training data from IndexedDB
   */
  async loadTrainingDataFromStorage() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(['trainingData'], 'readonly');
      const store = tx.objectStore('trainingData');
      const data = await store.get('main');
      
      if (data) {
        this.trainingData = data.samples || [];
        this.ragaLabels = new Map(data.ragaLabels || []);
        console.log(`[ML] Loaded ${this.trainingData.length} training samples from IndexedDB`);
        return true;
      }
    } catch (err) {
      console.warn('[ML] No saved training data found:', err);
    }
    return false;
  },

  /**
   * Delete training data from IndexedDB
   */
  async deleteTrainingDataFromStorage() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(['trainingData'], 'readwrite');
      const store = tx.objectStore('trainingData');
      await store.delete('main');
      console.log('[ML] Training data deleted from IndexedDB');
    } catch (err) {
      console.warn('[ML] Failed to delete training data:', err);
    }
  },

  /**
   * Open IndexedDB database
   */
  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ethno-ml-trainer', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('trainingData')) {
          db.createObjectStore('trainingData', { keyPath: 'id' });
        }
      };
    });
  },

  /**
   * Export training data as JSON
   */
  exportTrainingData() {
    return {
      samples: this.trainingData,
      ragaLabels: Array.from(this.ragaLabels.entries()),
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Import training data from JSON
   */
  async importTrainingData(data) {
    this.trainingData = data.samples || [];
    this.ragaLabels = new Map(data.ragaLabels || []);
    console.log(`[ML] Imported ${this.trainingData.length} samples`);
    // Auto-save imported data
    await this.saveTrainingDataToStorage();
  },

  /**
   * Get training statistics
   */
  getStats() {
    const ragaCounts = {};
    for (const sample of this.trainingData) {
      ragaCounts[sample.label] = (ragaCounts[sample.label] || 0) + 1;
    }

    return {
      totalSamples: this.trainingData.length,
      totalRagas: this.ragaLabels.size,
      ragaCounts,
      modelTrained: !!this.model,
    };
  },
};

export default MLTrainer;

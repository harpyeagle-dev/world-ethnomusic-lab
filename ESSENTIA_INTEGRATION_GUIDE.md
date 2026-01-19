# Essentia.js Genre Classification Integration Guide

## Overview

This document describes how the Computational Ethnomusiology App uses **Essentia.js** library for advanced audio feature extraction and genre classification.

## What is Essentia.js?

Essentia.js is a JavaScript binding of the Essentia C++ audio analysis library. It provides state-of-the-art algorithms for:

- **MFCC Extraction**: Mel-Frequency Cepstral Coefficients capture timbral characteristics
- **Spectral Analysis**: Centroid, bandwidth, rolloff, and flux calculations
- **Onset Detection**: Identifies percussion events and note attacks
- **Rhythm Analysis**: Beat tracking and tempo estimation
- **Chromagram**: Harmonic/tonal content analysis
- **Key Detection**: Musical key estimation

## Architecture

### Core Components

#### 1. **essentiaGenreClassifier.js** (NEW)
Specialized module for genre-specific feature extraction:

```javascript
// Extract comprehensive features for genre classification
const genreFeatures = essentiaGenreClassifier.extractGenreFeatures(audioBuffer, sampleRate);

// Returns:
{
    mfcc: { mfccMean: [...], mfccVar: [...], frames: [...] },
    logMelSpec: { spec: [...], shape: [frames, 64], frames: [...] },
    chromagram: { mean: [...], shape: [frames, 12], frames: [...] },
    spectralFeatures: { centroid, bandwidth, rolloff, flux, ... },
    temporalFeatures: { onsetCount, onsetMean, onsetEnergy, ... },
    energy: number,
    sampleRate: number,
    duration: number
}
```

**Features Extracted:**
- **MFCC (Mel-Frequency Cepstral Coefficients)**: 13 coefficients capturing timbre
- **Log-Mel Spectrogram**: 64-band frequency representation ideal for ML models
- **Chromagram**: 12-bin chroma features for tonality analysis
- **Spectral Features**: Centroid, bandwidth, rolloff, and flux
- **Temporal Features**: Onset strength, onset density, rhythm characteristics
- **Energy**: Overall signal loudness

#### 2. **audioAnalyzer.js** (ENHANCED)
Updated to use Essentia features:

```javascript
// Extract Essentia features for genre classification
const essentiaFeatures = await analyzer.extractEssentiaGenreFeatures(audioBuffer);
```

New method: `extractEssentiaGenreFeatures(audioBuffer, sampleRate)`
- Delegates to `essentiaGenreClassifier`
- Logs extracted feature dimensions
- Returns rich feature set for downstream processing

#### 3. **genreMLModel.js** (UPDATED)
ML genre classifier enhanced to accept Essentia features:

```javascript
// Genre classification now supports Essentia features
const prediction = await genreMLClassifier.classifyGenre({
    mfcc: essentiaFeatures.mfcc,
    logMelSpec: essentiaFeatures.logMelSpec,
    spectralFeatures: essentiaFeatures.spectralFeatures,
    energy: essentiaFeatures.energy,
    // ... other features
});
```

## Feature Extraction Details

### 1. MFCC (Mel-Frequency Cepstral Coefficients)

**Purpose**: Captures timbral characteristics that distinguish genres

**Process**:
- Frame audio into 2048-sample windows with 512-sample hop
- Apply Hann windowing to reduce spectral leakage
- Compute FFT spectrum for each frame
- Convert frequency scale to Mel scale (perceptually-motivated)
- Calculate log-energy in each Mel band
- Apply DCT (Discrete Cosine Transform) to decorrelate features
- Extract first 13 coefficients

**Why it matters for genre**:
- Different instruments have distinct timbral signatures
- Metal vs. Classical have dramatically different MFCC profiles
- Electronic music shows distinctive artificial timbre patterns

**Example interpretations**:
```
High MFCC coefficients (upper bands):
→ Bright, harsh timbres (Metal, Electronic)

Low MFCC coefficients:
→ Warm, rounded timbres (Jazz, Blues)

Variance in MFCCs:
→ Dynamic timbral changes (Classical, Folk)
→ Static timbral profile (Electronic, Pop)
```

### 2. Log-Mel Spectrogram

**Purpose**: Frequency-domain representation ideal for deep learning models

**Process**:
- Convert time-domain audio to frequency domain (FFT)
- Map to Mel scale (64 bands from 20 Hz to 22050 Hz)
- Apply log compression for perceptual relevance
- Normalize to typical range [-80 to 0] dB

**Structure**: 
- Shape: `[num_frames, 64]` where each frame is ~46ms
- Each value represents log energy in a frequency band
- Can be fed directly to CNN/RNN-based genre models

**Why it matters**:
- Mel scale mimics human auditory perception
- Log compression emphasizes perceived loudness variations
- Perfect input for trained deep learning genre classifiers

### 3. Chromagram

**Purpose**: Captures harmonic and tonal content

**Process**:
- Extract frequency spectrum
- Map frequencies to 12 chroma bins (C, C#, D, ..., B)
- Normalize by energy
- Can be computed frame-by-frame for temporal harmonic evolution

**Chroma bins**:
```
C, C#, D, D#, E, F, F#, G, G#, A, A#, B
```

**Why it matters for genre**:
- Jazz: Complex harmonic movements (rich, varied chroma)
- Pop: Simple harmonic patterns (concentrated in few bins)
- Classical: Traditional harmony (specific chroma patterns)
- World music: Modal/pentatonic systems (distinctive chroma signatures)

**Example**:
```
Blues scale heavy in: C, D#, E, G, A (pentatonic structure)
Classical major: C, E, G dominated
Jazz: All 12 bins active due to chromatic passing tones
```

### 4. Spectral Features

**Components**:
- **Centroid**: Center of mass of spectrum (brightness indicator)
- **Bandwidth**: Spread of spectral energy
- **Rolloff**: Frequency below which 85% of energy is concentrated
- **Flux**: Frame-to-frame spectral change (attack/decay indicator)

**Variance metrics**: Temporal variation in each feature

**Genre patterns**:
```
Centroid > 8000 Hz  → Metal, Electronic (bright)
Centroid < 2000 Hz  → Cello, Bass instruments (dark)

High bandwidth     → Complex timbres (Orchestra, Sitar)
Low bandwidth      → Pure tones (Sine, Flute)

High flux          → Percussive, dynamic (Rock, Jazz)
Low flux           → Sustained, smooth (Pad, Strings)
```

### 5. Temporal Features

**Components**:
- **Onset Count**: Number of detected attacks
- **Onset Density**: Ratio of onsets to total frames
- **Onset Energy**: Average strength of onsets
- **Onset Variance**: Regularity of onset timing

**Genre differentiation**:
```
High onset density → Percussion-heavy (Hip Hop, Metal, Techno)
Low onset density  → Sustained instruments (Classical, Ambient)

Regular onsets     → Metronomic (Electronic, Pop, Country)
Irregular onsets   → Free rhythm (Jazz, World, Classical)
```

## Usage Examples

### Basic Genre Feature Extraction

```javascript
const analyzer = new AudioAnalyzer();
await analyzer.initialize(); // Initializes Essentia

// From audio file
const response = await fetch('music.mp3');
const arrayBuffer = await response.arrayBuffer();
const audioContext = new AudioContext();
const decoded = await audioContext.decodeAudioData(arrayBuffer);
const audioBuffer = decoded.getChannelData(0); // Float32Array

// Extract features
const essentiaFeatures = await analyzer.extractEssentiaGenreFeatures(
    audioBuffer,
    audioContext.sampleRate
);

console.log('MFCC coefficients:', essentiaFeatures.mfcc.mfccMean);
console.log('Log-Mel shape:', essentiaFeatures.logMelSpec.shape);
console.log('Chroma means:', essentiaFeatures.chromagram.mean);
console.log('Spectral centroid:', essentiaFeatures.spectralFeatures.centroid);
```

### Full Genre Classification with Essentia

```javascript
// 1. Extract low-level features
const rhythmAnalysis = analyzer.analyzeRhythm(audioBuffer);
const spectralAnalysis = analyzer.analyzeSpectralFeatures(frequencyData);
const scaleAnalysis = analyzer.identifyScale(pitches);

// 2. Extract Essentia features
const essentiaFeatures = await analyzer.extractEssentiaGenreFeatures(audioBuffer);

// 3. Classify genre (now enhanced with Essentia features)
const genrePrediction = await analyzer.classifyGenre(
    rhythmAnalysis,
    scaleAnalysis,
    spectralAnalysis,
    essentiaFeatures,  // NEW: Essentia features
    { mlWeight: 0.3 }   // ML model weight
);

console.log('Top genre:', genrePrediction[0].genre);
console.log('Confidence:', genrePrediction[0].confidence);
console.log('Top 5 predictions:', genrePrediction.slice(0, 5));
```

### Processing Essentia Features for ML

```javascript
// Convert Essentia features to ML-ready vector
const featureVector = essentiaGenreClassifier.featuresToVector(essentiaFeatures);

// Structure: [MFCC mean (13), MFCC var (13), Chroma (12), 
//             Spectral (8), Temporal (4), Energy (1)]
// Total: ~51 dimensions

console.log('Feature vector length:', featureVector.length);
console.log('Feature vector:', featureVector);
```

## Integration with ML Models

### TensorFlow.js Integration

```javascript
// Load pre-trained genre model
const tfModel = await tf.loadGraphModel('models/genre_model.json');

// Prepare Essentia features as input
const mfccMean = essentiaFeatures.mfcc.mfccMean;
const mfccVar = essentiaFeatures.mfcc.mfccVar;
const chromaMean = essentiaFeatures.chromagram.mean;

// Create tensor
const inputTensor = tf.tensor2d([
    [...mfccMean, ...mfccVar, ...chromaMean]
]);

// Predict
const predictions = tfModel.predict(inputTensor);
const genreScores = predictions.dataSync();

console.log('Genre predictions:', genreScores);

// Cleanup
inputTensor.dispose();
predictions.dispose();
```

### Log-Mel Spectrogram for CNN

```javascript
// For CNN-based models expecting spectrogram input
const logMelSpec = essentiaFeatures.logMelSpec.frames; // [T, 64]

// Create batch of spectrograms (if processing multiple clips)
const batchSize = 1;
const timeSteps = logMelSpec.length;
const bands = 64;

// Reshape for model: [batch, time, frequency]
const spectrogramTensor = tf.tensor3d([logMelSpec], 
    [batchSize, timeSteps, bands]
);

const prediction = model.predict(spectrogramTensor);
```

## Performance Considerations

### Memory Usage

```
MFCC extraction:  ~2MB RAM (for 30s audio)
Log-Mel: ~5MB RAM
Chromagram: ~2MB RAM
Total per clip: ~10MB

Optimization: Use shorter clips (5-10s) for real-time analysis
```

### Computation Time

```
Feature extraction for 30s audio: ~200-300ms
- MFCC: ~80ms
- Log-Mel: ~100ms  
- Chromagram: ~50ms
- Spectral: ~40ms

Optimization: Extract features in web worker for UI responsiveness
```

### Quality Tuning

```javascript
// Frame size vs. spectral resolution tradeoff
const largeFrame = 2048;   // Better frequency resolution, worse time resolution
const smallFrame = 512;    // Better time resolution, worse frequency resolution

// Hop size (frame overlap) affects temporal detail
const smallHop = 128;      // 87.5% overlap, more frames, slower
const largeHop = 512;      // 75% overlap, fewer frames, faster
```

## Troubleshooting

### Essentia Not Initializing

```javascript
// Check browser compatibility
console.log('WebAssembly available:', 
    typeof WebAssembly !== 'undefined');

// Enable verbose logging
const essentia = new Essentia();
await essentia.ready;
console.log('Essentia version:', essentia.version);
console.log('Available algorithms:', essentia.algorithmNames);
```

### Feature Extraction Failures

```javascript
// Validate audio buffer
console.log('Buffer length:', audioBuffer.length);
console.log('Buffer sample rate:', sampleRate);
console.log('Buffer duration (s):', audioBuffer.length / sampleRate);

// Check feature outputs
const features = analyzer.extractEssentiaGenreFeatures(audioBuffer);
if (!features.mfcc.mfccMean || features.mfcc.mfccMean.length === 0) {
    console.warn('MFCC extraction failed, using fallback');
}
```

### Low Genre Classification Accuracy

1. **Verify feature extraction**:
   ```javascript
   console.log('Essentia ready:', analyzer.essentiaGenreClassifierReady);
   console.log('ML classifier ready:', analyzer.mlClassifierReady);
   ```

2. **Check input audio quality**:
   - Minimum duration: 2-3 seconds recommended
   - Sample rate: 44100 Hz or higher
   - Mono or downmix to mono

3. **Examine feature distributions**:
   ```javascript
   const features = await analyzer.extractEssentiaGenreFeatures(buffer);
   console.log('MFCC range:', 
       Math.min(...features.mfcc.mfccMean),
       Math.max(...features.mfcc.mfccMean));
   ```

## Advanced: Creating Custom Genre Models

### 1. Extract Training Data

```javascript
// Collect Essentia features from training dataset
const trainingData = [];

for (const audioFile of audioFiles) {
    const audioBuffer = await decodeAudioFile(audioFile);
    const features = await analyzer.extractEssentiaGenreFeatures(
        audioBuffer,
        44100
    );
    
    const featureVector = essentiaGenreClassifier.featuresToVector(features);
    trainingData.push({
        features: featureVector,
        label: audioFile.genre
    });
}
```

### 2. Train TensorFlow.js Model

```javascript
// Prepare tensors
const featureTensors = tf.tensor2d(
    trainingData.map(d => d.features)
);
const labelTensors = tf.tensor1d(
    trainingData.map(d => genreLabels.indexOf(d.label))
);

// Build model
const model = tf.sequential({
    layers: [
        tf.layers.dense({ units: 128, activation: 'relu', input shape: [51] }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: genreLabels.length, activation: 'softmax' })
    ]
});

// Compile and train
model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'sparseCategoricalCrossentropy',
    metrics: ['accuracy']
});

await model.fit(featureTensors, labelTensors, {
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2
});

// Save model
await model.save('indexeddb://genre-model');
```

## References

- **Essentia.js**: https://essentia.upf.edu/
- **MFCC**: https://en.wikipedia.org/wiki/Mel-frequency_cepstrum
- **Mel Scale**: https://en.wikipedia.org/wiki/Mel_scale
- **Chromagram**: https://en.wikipedia.org/wiki/Chroma_feature
- **Genre Classification Survey**: https://arxiv.org/abs/1802.00271

## Contributing

To improve Essentia.js integration:

1. Add new feature extraction methods to `essentiaGenreClassifier.js`
2. Update feature vector construction in `featuresToVector()`
3. Retrain ML models with new features
4. Document results in this guide

---

**Last Updated**: January 2026
**Status**: Production Ready ✅

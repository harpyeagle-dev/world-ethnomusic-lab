# Essentia.js Genre Classification - Quick Reference

## Quick Start

### 1. Initialize Analyzer with Essentia
```javascript
import { AudioAnalyzer } from './audioAnalyzer.js';

const analyzer = new AudioAnalyzer();
await analyzer.initialize();

// Check Essentia is ready
console.log('Essentia ready:', analyzer.essentiaGenreClassifierReady);
```

### 2. Extract Genre Features
```javascript
// From audio buffer (Float32Array)
const essentiaFeatures = await analyzer.extractEssentiaGenreFeatures(
    audioBuffer,  // Float32Array of audio samples
    44100         // sample rate in Hz
);
```

### 3. Classify Genre
```javascript
// Full genre classification with Essentia features
const genrePrediction = await analyzer.classifyGenre(
    rhythmAnalysis,      // from analyzer.analyzeRhythm()
    scaleAnalysis,       // from analyzer.identifyScale()
    spectralAnalysis,    // from analyzer.analyzeSpectralFeatures()
    essentiaFeatures,    // from extractEssentiaGenreFeatures()
    { mlWeight: 0.3 }    // optional ML model weight
);

// Top genre prediction
console.log(genrePrediction[0].genre);        // 'Rock'
console.log(genrePrediction[0].confidence);   // 0.92
console.log(genrePrediction.slice(0, 5));    // Top 5 genres
```

## Feature Types

### MFCC (Mel-Frequency Cepstral Coefficients)
```javascript
essentiaFeatures.mfcc = {
    mfccMean: [...],      // 13 coefficients - average timbre
    mfccVar: [...],       // 13 coefficients - timbre variation
    frames: [[...], ...], // Frame-by-frame coefficients
    shape: [numFrames, 13]
}

// Interpretation:
// High variance → Dynamic timbral changes (Classical, Folk)
// Low variance → Static timbre (Electronic, Pop)
```

### Log-Mel Spectrogram
```javascript
essentiaFeatures.logMelSpec = {
    spec: [...],         // 64-band frequency representation
    shape: [numFrames, 64],
    frames: [[...], ...], // All frames
    mean: [...],         // Mean across frames
    std: [...]           // Standard deviation across frames
}

// Perfect for CNN/RNN ML models
```

### Chromagram
```javascript
essentiaFeatures.chromagram = {
    mean: [...],           // 12 chroma bins (C, C#, D, ..., B)
    shape: [numFrames, 12],
    frames: [[...], ...],
    dominantChroma: {
        note: 'C',         // Dominant harmonic center
        index: 0,
        value: 0.45        // Relative strength
    }
}

// Genre patterns:
// [1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0] → Blues pentatonic
// [1, 0.5, 1, 0.5, 1, 1, ...] → Classical Western harmony
```

### Spectral Features
```javascript
essentiaFeatures.spectralFeatures = {
    centroid: 2500,          // Brightness (Hz)
    centroidVar: 800,        // Brightness variation
    bandwidth: 1200,         // Spectral spread (Hz)
    bandwidthVar: 300,
    rolloff: 8000,           // 85% energy cutoff (Hz)
    rolloffVar: 2000,
    flux: 0.15,              // Frame-to-frame change
    fluxVar: 0.05
}

// Brightness interpretation:
// < 2000 Hz  → Dark, bass-heavy (Cello, 808 bass)
// 2-5 kHz    → Warm, mid-range (Jazz, Blues)
// > 8 kHz    → Bright, harsh (Metal, Electronic)
```

### Temporal Features
```javascript
essentiaFeatures.temporalFeatures = {
    onsetCount: 45,        // Number of detected attacks
    onsetMean: 0.12,       // Average onset strength (0-1)
    onsetEnergy: 0.18,     // Cumulative onset energy
    onsetDensity: 0.35,    // Onsets per time unit (0-1)
    onsetVariance: 0.08    // Consistency of onsets
}

// Percussion indicator:
// > 0.25 → Percussion-heavy (Hip Hop, Metal)
// < 0.10 → Sustained instruments (Classical, Strings)
```

### Other Features
```javascript
essentiaFeatures.energy;      // Overall loudness (0-1)
essentiaFeatures.sampleRate;  // Hz (typically 44100)
essentiaFeatures.duration;    // Seconds
```

## Common Workflows

### Full Audio Analysis
```javascript
const audioFile = 'song.mp3';

// 1. Decode audio
const response = await fetch(audioFile);
const arrayBuffer = await response.arrayBuffer();
const audioContext = new AudioContext();
const decoded = await audioContext.decodeAudioData(arrayBuffer);

// 2. Get mono audio
const mono = decoded.getChannelData(0);

// 3. Extract all features
const essentiaFeatures = await analyzer.extractEssentiaGenreFeatures(
    mono,
    decoded.sampleRate
);

const rhythm = analyzer.analyzeRhythm(mono);
const spectral = analyzer.analyzeSpectralFeatures(mono);
const scale = analyzer.identifyScale(detectedPitches);

// 4. Classify genre with all features
const genres = await analyzer.classifyGenre(
    rhythm,
    scale,
    spectral,
    essentiaFeatures
);

console.log('Predicted genre:', genres[0].genre);
console.log('Confidence:', genres[0].confidence);
console.log('Top 5:', genres.slice(0, 5).map(g => g.genre));
```

### Real-Time Feature Extraction
```javascript
// For live audio from microphone
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = audioContext.createMediaStreamSource(stream);
const analyser = audioContext.createAnalyser();
source.connect(analyser);

// Extract features every 2 seconds
setInterval(async () => {
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    
    // You can use this for real-time analysis
    const brightness = analyzer.calculateSpectralCentroid(freqData);
    console.log('Current brightness:', brightness);
}, 2000);
```

### ML Feature Vector Preparation
```javascript
// Convert Essentia features to flat vector for ML models
const featureVector = essentiaGenreClassifier.featuresToVector(
    essentiaFeatures
);

// Vector structure:
// [MFCC mean (13) + MFCC var (13) + Chroma (12) + 
//  Spectral (8) + Temporal (4) + Energy (1)] = 51 dimensions

// Use with TensorFlow.js
const tensor = tf.tensor2d([featureVector]);
const prediction = mlModel.predict(tensor);
```

## Debugging

### Check Essentia Status
```javascript
console.log('Essentia Genre Classifier ready:', 
    analyzer.essentiaGenreClassifierReady);
console.log('Essentia instance:', analyzer.essentia);
console.log('Feature extractor:', analyzer.essentiaGenreClassifier);
```

### Inspect Feature Quality
```javascript
const features = await analyzer.extractEssentiaGenreFeatures(buffer);

// Check MFCC extraction
if (features.mfcc.mfccMean.length === 13) {
    console.log('✓ MFCC extracted correctly');
} else {
    console.warn('✗ MFCC extraction failed');
}

// Check spectrogram
console.log('Spectrogram shape:', features.logMelSpec.shape);
console.log('Spectrogram range:', 
    Math.min(...features.logMelSpec.spec),
    'to',
    Math.max(...features.logMelSpec.spec));

// Check for NaN values
const hasNaN = features.mfcc.mfccMean.some(v => !isFinite(v));
if (hasNaN) {
    console.warn('⚠️ NaN values detected in features');
}
```

### Sample Feature Outputs
```javascript
// Example features from 30-second Rock song
{
    mfcc: {
        mfccMean: [0.2, -5.3, 2.1, 1.4, 0.9, 0.2, -0.1, -0.3, -0.2, 0.1, 0, 0, 0],
        mfccVar: [0.5, 1.2, 0.8, 0.6, 0.4, 0.3, 0.2, 0.15, 0.1, 0.1, 0.08, 0.06, 0.05],
        shape: [1302, 13]
    },
    logMelSpec: {
        spec: [-80, -75, -60, ..., -85],  // 64 values
        shape: [1302, 64],
        mean: [-65, -62, -58, ..., -72]   // 64 means
    },
    chromagram: {
        mean: [0.15, 0.08, 0.12, 0.05, 0.14, 0.09, 0.06, 0.18, 0.04, 0.12, 0.07, 0.09],
        dominantChroma: { note: 'G', index: 7, value: 0.18 }
    },
    spectralFeatures: {
        centroid: 2800,
        bandwidth: 1500,
        rolloff: 8500,
        flux: 0.22
    },
    temporalFeatures: {
        onsetCount: 128,
        onsetDensity: 0.42,
        onsetMean: 0.28
    },
    energy: 0.45,
    sampleRate: 44100,
    duration: 30.2
}
```

## Performance Tips

### Memory Optimization
```javascript
// For large batch processing, process clips sequentially
async function processMultipleClips(audioFiles) {
    const results = [];
    
    for (const file of audioFiles) {
        // Extract features
        const features = await analyzer.extractEssentiaGenreFeatures(buffer);
        results.push(features);
        
        // Clear TensorFlow memory if using ML models
        tf.disposeVariables();
    }
    
    return results;
}
```

### Speed Optimization
```javascript
// Extract only needed features if using for specific task
// Instead of full extraction, use specific methods:

// For timbre-only analysis
const mfcc = essentiaGenreClassifier.extractMFCC(buffer, essentia);

// For harmony-only analysis  
const chroma = essentiaGenreClassifier.extractChromagram(buffer, sr, essentia);

// Avoids unnecessary computation
```

### Frame Size Tuning
```javascript
// Default: 2048 samples (46ms @ 44.1kHz)
// Larger frame = better frequency resolution, worse time resolution
// Smaller frame = better time resolution, worse frequency resolution

// For genre classification: 2048 is optimal
// For onset detection: 512-1024 is better
// For key detection: 2048-4096 gives more stable results
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Essentia not initializing | Check WebAssembly support, check browser console |
| NaN values in features | Check audio buffer is valid Float32Array |
| Poor genre predictions | Use longer clips (5-10s min), verify audio quality |
| Slow feature extraction | Use web workers, process shorter clips, reduce MFCC bands |
| Memory errors on long clips | Process audio in 10-30s chunks, dispose TF tensors |

## API Reference

### audioAnalyzer Methods

```javascript
// Extract Essentia features
await analyzer.extractEssentiaGenreFeatures(audioBuffer, sampleRate)

// Classify genre using all features including Essentia
await analyzer.classifyGenre(
    rhythmAnalysis, 
    scaleAnalysis, 
    spectralAnalysis, 
    essentiaFeatures,  // NEW parameter
    options
)
```

### essentiaGenreClassifier Methods

```javascript
// Initialize
await classifier.initialize(essentia)

// Extract all genre features
classifier.extractGenreFeatures(audioBuffer, sampleRate)

// Extract specific features
classifier.extractMFCC(audioBuffer, essentia)
classifier.extractLogMelSpectrogram(audioBuffer, sampleRate, essentia)
classifier.extractChromagram(audioBuffer, sampleRate, essentia)
classifier.extractSpectralFeatures(audioBuffer, essentia)
classifier.extractTemporalFeatures(audioBuffer, essentia)

// Convert to ML vector
classifier.featuresToVector(features)
```

---

**For detailed information**, see [ESSENTIA_INTEGRATION_GUIDE.md](ESSENTIA_INTEGRATION_GUIDE.md)

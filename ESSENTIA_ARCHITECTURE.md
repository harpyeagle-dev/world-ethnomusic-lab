# Essentia.js Genre Classification Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPUTATIONAL ETHNOMUSIOLOGY APP                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐         ┌────────────────────┐                   │
│  │  Audio File  │         │  Microphone Input  │                   │
│  └──────┬───────┘         └────────┬───────────┘                   │
│         │                          │                                │
│         └──────────────┬───────────┘                                │
│                        ▼                                             │
│         ┌──────────────────────────┐                                │
│         │  Web Audio API Decode    │                                │
│         │  (PCM Float32Array)      │                                │
│         └────────────┬─────────────┘                                │
│                      ▼                                              │
│         ┌────────────────────────────┐                              │
│         │  AudioAnalyzer.initialize()│                              │
│         │  - Essentia.js setup      │                              │
│         │  - Genre classifier init  │                              │
│         └────────────┬───────────────┘                              │
│                      ▼                                              │
│  ┌──────────────────────────────────────────────┐                  │
│  │    Feature Extraction Pipeline               │                  │
│  ├──────────────────────────────────────────────┤                  │
│  │  extractEssentiaGenreFeatures()              │                  │
│  │     ↓                                        │                  │
│  │  EssentiaGenreClassifier.extractGenreFeatures
│  │     ↓                                        │                  │
│  │  ┌──────────────────────────────────────┐   │                  │
│  │  │ Essentia Feature Extraction          │   │                  │
│  │  ├──────────────────────────────────────┤   │                  │
│  │  │ • MFCC (13 coefficients + var)       │   │                  │
│  │  │ • Log-Mel Spectrogram (64 bands)     │   │                  │
│  │  │ • Chromagram (12 chroma bins)        │   │                  │
│  │  │ • Spectral Features (centroid, etc)  │   │                  │
│  │  │ • Temporal Features (onsets, etc)    │   │                  │
│  │  │ • Energy and Duration                │   │                  │
│  │  └──────────────────────────────────────┘   │                  │
│  │     ↓                                        │                  │
│  │  featuresToVector() → ML-ready vector      │                  │
│  └────────────┬─────────────────────────────────┘                  │
│               ▼                                                     │
│  ┌──────────────────────────────────────────────┐                  │
│  │    Genre Classification                      │                  │
│  ├──────────────────────────────────────────────┤                  │
│  │  classifyGenre()                             │                  │
│  │     ├─ Rule-based heuristics                │                  │
│  │     ├─ Essentia feature scoring             │                  │
│  │     ├─ ML model prediction (TF.js/ONNX)    │                  │
│  │     └─ Ensemble voting                     │                  │
│  └────────────┬─────────────────────────────────┘                  │
│               ▼                                                     │
│         [Genre Predictions]                                         │
│         Top 5 genres with confidence scores                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Dependencies

```
┌─────────────────────────────────────┐
│   essentiaGenreClassifier.js (NEW)  │
│  ┌───────────────────────────────┐  │
│  │  EssentiaGenreClassifier class│  │
│  ├───────────────────────────────┤  │
│  │ Methods:                      │  │
│  │ • extractMFCC()               │  │
│  │ • extractLogMelSpectrogram()  │  │
│  │ • extractChromagram()         │  │
│  │ • extractSpectralFeatures()   │  │
│  │ • extractTemporalFeatures()   │  │
│  │ • featuresToVector()          │  │
│  └───────────────────────────────┘  │
│           ▲                          │
│           │ uses                     │
└───────────┼──────────────────────────┘
            │
            │
┌───────────┴──────────────────────────┐
│     audioAnalyzer.js (ENHANCED)      │
│  ┌────────────────────────────────┐  │
│  │  AudioAnalyzer class           │  │
│  ├────────────────────────────────┤  │
│  │ Properties:                    │  │
│  │ • essentiaGenreClassifier      │  │
│  │ • essentia                     │  │
│  │                                │  │
│  │ Methods:                       │  │
│  │ • extractEssentiaGenreFeatures │  │
│  │ • classifyGenre()              │  │
│  │ • analyzeRhythm()              │  │
│  │ • analyzeSpectralFeatures()    │  │
│  │ • identifyScale()              │  │
│  └────────────────────────────────┘  │
│           ▲                           │
│           │ uses                      │
└───────────┼───────────────────────────┘
            │
            │
┌───────────┴──────────────────────────┐
│       Essentia.js (External)         │
│  ┌────────────────────────────────┐  │
│  │  Essentia class (WASM)         │  │
│  ├────────────────────────────────┤  │
│  │ Algorithms:                    │  │
│  │ • MFCC()                       │  │
│  │ • Spectrum()                   │  │
│  │ • SpectralCentroid()           │  │
│  │ • OnsetStrength()              │  │
│  │ • ... (50+ algorithms)         │  │
│  └────────────────────────────────┘  │
│                                       │
└───────────────────────────────────────┘
```

## Feature Extraction Flow

```
Audio Buffer (Float32Array)
│
├─ Frame Extraction
│  Input: Full buffer
│  Params: 2048 samples/frame, 512 samples hop
│  Output: Sequence of frames [F1, F2, F3, ...]
│
├─ Apply Windowing
│  Input: Each frame
│  Params: Hann window
│  Output: Windowed frames [w(F1), w(F2), ...]
│
├─ FFT (Fast Fourier Transform)
│  Input: Each windowed frame
│  Output: Complex spectrum for each frame
│
├─ MFCC Extraction
│  Input: Spectrum
│  Process:
│  ├─ Convert to Mel scale (128 bands)
│  ├─ Log energy in each band
│  ├─ Apply DCT
│  ├─ Extract 13 coefficients
│  ├─ Calculate mean and variance across frames
│  Output: {mfccMean: [13], mfccVar: [13]}
│
├─ Log-Mel Spectrogram
│  Input: Spectrum
│  Process:
│  ├─ Convert to 64-band Mel scale
│  ├─ Apply log compression (dB scale)
│  ├─ Stack frames
│  Output: {spec: [64], frames: [[64], ...]}
│
├─ Chromagram
│  Input: Spectrum
│  Process:
│  ├─ Map frequencies to 12 chroma bins
│  ├─ Sum energy per bin
│  ├─ Normalize
│  ├─ Identify dominant chroma
│  Output: {mean: [12], dominantChroma: {note, value}}
│
├─ Spectral Features
│  Input: Spectrum
│  Process:
│  ├─ Calculate centroid (brightness)
│  ├─ Calculate spread/bandwidth
│  ├─ Calculate rolloff frequency
│  ├─ Calculate frame-to-frame flux
│  ├─ Calculate variance of each
│  Output: {centroid, bandwidth, rolloff, flux, ...}
│
└─ Temporal Features
   Input: Full buffer
   Process:
   ├─ Onset detection
   ├─ Count onsets
   ├─ Calculate onset density
   ├─ Measure onset energy
   Output: {onsetCount, onsetDensity, onsetEnergy, ...}

Final Output: Comprehensive feature object
```

## Genre Classification Pipeline

```
Input: [rhythm, scale, spectral, essentiaFeatures]
│
├─ Input Validation & Normalization
│  └─ Clamp to [0,1], handle NaN/Inf
│
├─ Tempo-based Scoring (5 bands)
│  ├─ < 60 BPM   → Classical, Blues
│  ├─ 60-90 BPM  → Blues, Reggae, Jazz
│  ├─ 90-120 BPM → Folk, Country, World
│  ├─ 120-140 BPM→ Rock, Pop, Electronic
│  └─ > 170 BPM  → Metal, Electronic
│
├─ Regularity-based Scoring
│  ├─ High (>0.8) → Electronic, Pop, Hip Hop
│  ├─ Medium (0.5-0.8) → Pop, Rock
│  ├─ Low (0.1-0.5) → Jazz, World, Folk, Indian Classical
│  └─ Very Low (<0.1) → World (polyrhythmic), Indian Classical
│
├─ Percussiveness-based Scoring
│  ├─ High (>0.15) → Hip Hop, Metal, Latin
│  ├─ Medium (0.05-0.15) → Rock, Pop
│  └─ Low (<0.05) → Classical, Folk, Country, Jazz
│
├─ Brightness/Timbre Scoring
│  ├─ High (>0.7) → Pop, Electronic, Metal
│  ├─ Medium (0.35-0.7) → Rock, Pop, Latin
│  └─ Low (<0.35) → Blues, Jazz, R&B/Soul
│
├─ Scale-based Scoring
│  ├─ Pentatonic → Blues, Folk, World
│  ├─ Blues scale → Blues, Jazz, Rock
│  ├─ Major → Pop, Country, Folk
│  ├─ Minor → Rock, European Classical
│  └─ Chromatic → Jazz, Classical, Metal
│
├─ Complexity-based Scoring
│  ├─ High (>0.7) → Jazz, Classical, Indian Classical, Metal
│  ├─ Medium (0.3-0.7) → Rock, R&B/Soul, Latin
│  └─ Low (<0.3) → Folk, Country, Pop, Reggae
│
├─ Multi-feature Interaction Rules
│  ├─ Reggae signature detection
│  │  └─ Slow tempo + moderate-low regularity + slight percussion
│  │
│  ├─ Indigenous/World detection  
│  │  └─ Polyrhythmic + pentatonic + high spectral diversity
│  │
│  ├─ Jazz-Rock distinction
│  │  └─ High complexity → Jazz
│  │     Regular rhythm → Rock
│  │
│  ├─ Folk-Country distinction
│  │  └─ Simple structure + simple brightness → Country
│  │     Simple structure + complex brightness → Folk
│  │
│  └─ Classical-Jazz distinction
│      └─ Low percussion + high complexity → Classical
│         Low percussion + high complexity + irregular → Jazz
│
├─ Essentia Feature Scoring
│  ├─ MFCC analysis
│  │  └─ Bright MFCC → Metal, Electronic
│  │     Warm MFCC → Jazz, Blues
│  │
│  ├─ Log-Mel analysis
│  │  └─ Distributed energy → Complex genre
│  │     Concentrated energy → Simple genre
│  │
│  ├─ Chromagram analysis
│  │  └─ Rich chromaticism → Jazz, Classical
│  │     Pentatonic pattern → World, Blues
│  │
│  └─ Spectral analysis
│     └─ High centroid → Metal, Electronic
│        Low centroid → Blues, Cello
│
├─ Adaptive Feature Weighting
│  └─ Genre-specific sensitivity profiles applied
│
├─ BPM Octave Error Detection
│  └─ If 2x/0.5x correction applied
│
├─ Ensemble Voting (if ML available)
│  ├─ Rule-based scores (60%)
│  ├─ Essentia feature scores (20%)
│  └─ ML model scores (20%)
│
└─ Output: Ranked genre predictions with confidence scores
   [
     { genre: 'Rock', confidence: 0.92 },
     { genre: 'Metal', confidence: 0.65 },
     { genre: 'Pop', confidence: 0.34 },
     ...
   ]
```

## Feature Space Visualization

```
Confidence Scores by Tempo (for reference)

100% │                     ╔════╗
     │                     ║Metal║
     │                ╔════╝    ╚════╗
  80%│ Classical     ║ Electronic    ║
     │    ╔═════╗    ║              ║
  60%│    ║     ║╔═══╩════╗╔════════╝
     │    ║     ║║  Jazz  ║║ Hip Hop
  40%│ Blues╚═══╝║  Rock  ║╚═════╗
     │  ╔═════════╝╚═══════╝      ║ Pop
  20%│  ║Folk  Country  Reggae    ║
     │  ╚═════════════════════════╝
     └────┬────────┬────────┬────────┬─
         60 BPM   120 BPM  170 BPM  220 BPM
```

## Memory Architecture

```
┌───────────────────────────────────────────────────────┐
│              Memory Usage Timeline (30s audio)        │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Audio Buffer              ████ 5-10 MB              │
│  MFCC Frames               ████ 2 MB                 │
│  Log-Mel Frames            ████████ 5 MB            │
│  Chroma Frames             ██ 1 MB                   │
│  Spectral Data             ██ 1 MB                   │
│  Temporal Data             █ 0.5 MB                  │
│  ──────────────────────────────────                 │
│  Peak Total                ████████████ 15-20 MB   │
│                                                       │
└───────────────────────────────────────────────────────┘
```

## Processing Timeline

```
┌───────────────────────────────────────────────────────┐
│          Processing Timeline (30s audio)              │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Initialize Essentia        ████████ 200ms          │
│  Frame extraction & FFT     ██████ 50ms             │
│  MFCC calculation           ████████████ 80ms       │
│  Log-Mel spectrogram        ████████████████ 100ms  │
│  Chromagram extraction      ██████ 50ms             │
│  Spectral features          ████ 40ms               │
│  Temporal features          ███ 30ms                │
│  Feature aggregation        ██ 20ms                 │
│  Genre classification       ████████ 100ms         │
│  ────────────────────────────────────               │
│  Total                      ████████████████████    │
│                             ~300-400ms              │
│                                                       │
└───────────────────────────────────────────────────────┘
```

## Genre Space Relationships

```
                    BRIGHTNESS (Spectral Centroid)
                           ▲
                           │
                    HIGH   │   LOW
                           │
                  Electronic│  Classical
                    Metal  │  Blues
    Pop──────────────┼──────────────Jazz
    Rock            │  Reggae  Folk
                    │  Country World
           REGULAR   │  IRREGULAR
        (Regularity) │

                  PERCUSSIVENESS
                        ▼

Hip Hop  Electronic ────────── Jazz   Classical
   Metal   Rock              Folk    Blues
      Latin Reggae Country        (Light Percussion)
        (Heavy)      (Moderate)
```

---

**For detailed information on each component, see the comprehensive documentation files.**

/**
 * ML Trainer UI Interface
 * Allows users to upload labeled audio samples and train the model
 */

import MLTrainer from './mlTrainer.js';

let mlInitialized = false;
let sharedAudioAnalyzer = null;

/**
 * Set the shared AudioAnalyzer instance from the main app
 */
export function setAudioAnalyzer(analyzer) {
  sharedAudioAnalyzer = analyzer;
  console.log('[Trainer] AudioAnalyzer set for feature extraction');
}

/**
 * Initialize ML trainer UI
 */
export async function initMLTrainerUI() {
  const container = document.getElementById('mlTrainerContainer');
  if (!container) return;

  // Initialize ML system
  const success = await MLTrainer.init();
  mlInitialized = success;

  // Create UI
  const html = `
    <section id="mlTrainerSection" class="feature-section">
      <h2>🤖 ML Classifier Trainer</h2>
      <p class="section-description">
        Train a machine learning model to classify music genres from your audio samples.
        Upload labeled recordings to improve classification accuracy.
      </p>

      <div class="trainer-controls">
        <div class="trainer-panel">
          <h3>Step 1: Collect Training Data</h3>
          <div class="form-group">
            <label for="ragaLabelInput">Genre/Label:</label>
            <input 
              type="text" 
              id="ragaLabelInput" 
              placeholder="e.g., Blues, Jazz, Classical, Raga"
              value=""
            >
          </div>

          <div class="form-group">
            <label for="trainingAudioInput">Upload Audio Sample:</label>
            <input 
              type="file" 
              id="trainingAudioInput" 
              accept="audio/*"
            >
            <small>Upload a clear recording of the raga you want to label</small>
          </div>

          <button id="addSampleBtn" class="btn btn-primary">
            ➕ Add Training Sample
          </button>

          <div id="sampleStatus" class="status-message"></div>
        </div>

        <div class="trainer-panel">
          <h3>Step 2: Review Collected Data</h3>
          <div id="statsDisplay" class="stats-box">
            <p>Samples collected: <strong id="sampleCount">0</strong></p>
            <p>Ragas labeled: <strong id="ragaCount">0</strong></p>
            <p>Model trained: <strong id="modelStatus">No</strong></p>
          </div>

          <details id="sampleDetails">
            <summary>📋 View collected samples</summary>
            <div id="sampleList" class="sample-list"></div>
          </details>

          <button id="exportDataBtn" class="btn btn-secondary">
            💾 Export Training Data
          </button>
          <button id="importDataBtn" class="btn btn-secondary">
            📂 Import Training Data
          </button>
          <input 
            type="file" 
            id="importFileInput" 
            accept=".json" 
            style="display: none;"
          >
        </div>

        <div class="trainer-panel">
          <h3>Step 3: Train Model</h3>
          <div class="form-group">
            <label for="epochsInput">Epochs (training iterations):</label>
            <input 
              type="number" 
              id="epochsInput" 
              min="10" 
              max="200" 
              value="50"
            >
          </div>

          <div class="form-group">
            <label for="batchSizeInput">Batch Size:</label>
            <select id="batchSizeInput">
              <option value="4">4 (small, slower)</option>
              <option value="8" selected>8 (medium)</option>
              <option value="16">16 (large, faster)</option>
            </select>
          </div>

          <button id="trainBtn" class="btn btn-success">
            🧠 Train Model
          </button>

          <div id="trainingProgress" style="display: none;">
            <div class="progress-bar">
              <div id="progressFill" class="progress-fill"></div>
            </div>
            <p id="progressText">Training...</p>
          </div>

          <div id="trainingResult" class="status-message"></div>
        </div>

        <div class="trainer-panel">
          <h3>Step 4: Manage Model</h3>
          <button id="testModelBtn" class="btn btn-info">
            ✅ Test Model
          </button>
          <button id="deleteModelBtn" class="btn btn-danger">
            🗑️ Delete Trained Model
          </button>

          <div id="testResult" class="status-message"></div>
        </div>
      </div>
    </section>
  `;

  container.innerHTML = html;

  // Bind event handlers
  bindTrainerEvents();
  updateStats();
}

/**
 * Bind all trainer UI event handlers
 */
function bindTrainerEvents() {
  // Add sample button
  document.getElementById('addSampleBtn').addEventListener('click', addTrainingSample);

  // Export/Import
  document.getElementById('exportDataBtn').addEventListener('click', exportTrainingData);
  document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', importTrainingData);

  // Train button
  document.getElementById('trainBtn').addEventListener('click', trainModel);

  // Test button
  document.getElementById('testModelBtn').addEventListener('click', testModel);

  // Delete button
  document.getElementById('deleteModelBtn').addEventListener('click', deleteModel);

  // Update stats when sample list expands
  document.getElementById('sampleDetails').addEventListener('toggle', updateStats);
}

/**
 * Add a training sample from file input
 */
async function addTrainingSample() {
  const label = document.getElementById('ragaLabelInput').value.trim();
  const fileInput = document.getElementById('trainingAudioInput');
  const statusEl = document.getElementById('sampleStatus');

  if (!label) {
    statusEl.textContent = '❌ Please enter a raga name';
    statusEl.className = 'status-message error';
    return;
  }

  if (!fileInput.files.length) {
    statusEl.textContent = '❌ Please select an audio file';
    statusEl.className = 'status-message error';
    return;
  }

  try {
    statusEl.textContent = '⏳ Processing audio...';
    statusEl.className = 'status-message info';

    const file = fileInput.files[0];
    const arrayBuffer = await file.arrayBuffer();

    // Use AudioContext to decode and analyze
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Extract real features using AudioAnalyzer
    if (!sharedAudioAnalyzer) {
      throw new Error('AudioAnalyzer not initialized. Please analyze a sample in the main app first.');
    }

    statusEl.textContent = '⏳ Extracting features...';
    
    // Analyze the audio buffer to extract features
    const essentiaFeatures = sharedAudioAnalyzer.extractEssentiaFeatures(audioBuffer);
    const rhythmAnalysis = await sharedAudioAnalyzer.analyzeRhythm(audioBuffer);
    const scaleAnalysis = await sharedAudioAnalyzer.detectScale(audioBuffer);
    const spectralAnalysis = await sharedAudioAnalyzer.analyzeSpectralProperties(audioBuffer);

    // Use MLTrainer's feature extraction
    const features = MLTrainer.extractMLFeatures(
      rhythmAnalysis,
      scaleAnalysis,
      spectralAnalysis,
      essentiaFeatures,
      null
    );

    console.log('[Trainer] Extracted features:', features);
    MLTrainer.addTrainingSample(features, label);

    statusEl.textContent = `✅ Added sample: ${label} (${features.length} features)`;
    statusEl.className = 'status-message success';

    // Clear inputs
    document.getElementById('ragaLabelInput').value = '';
    fileInput.value = '';

    updateStats();
  } catch (err) {
    statusEl.textContent = `❌ Error: ${err.message}`;
    statusEl.className = 'status-message error';
    console.error('[Trainer] Error adding sample:', err);
  }
}

/**
 * Train the model
 */
async function trainModel() {
  const epochs = parseInt(document.getElementById('epochsInput').value) || 50;
  const batchSize = parseInt(document.getElementById('batchSizeInput').value) || 8;
  const resultEl = document.getElementById('trainingResult');
  const progressEl = document.getElementById('trainingProgress');
  const trainBtn = document.getElementById('trainBtn');

  if (MLTrainer.trainingData.length < 5) {
    resultEl.textContent = '❌ Need at least 5 training samples';
    resultEl.className = 'status-message error';
    return;
  }

  try {
    trainBtn.disabled = true;
    progressEl.style.display = 'block';
    resultEl.textContent = '';

    resultEl.textContent = '⏳ Training started...';
    resultEl.className = 'status-message info';

    const result = await MLTrainer.train(epochs, batchSize, 0.2);

    if (result) {
      resultEl.innerHTML = `
        ✅ <strong>Training Complete!</strong><br>
        Accuracy: ${(result.finalAccuracy * 100).toFixed(1)}%<br>
        Epochs: ${result.epochs}<br>
        Samples: ${result.samples}<br>
        Ragas: ${result.ragas}
      `;
      resultEl.className = 'status-message success';
    } else {
      resultEl.textContent = '❌ Training failed';
      resultEl.className = 'status-message error';
    }

    progressEl.style.display = 'none';
    updateStats();
  } catch (err) {
    resultEl.textContent = `❌ Error: ${err.message}`;
    resultEl.className = 'status-message error';
  } finally {
    trainBtn.disabled = false;
  }
}

/**
 * Test the trained model on a random sample
 */
async function testModel() {
  const resultEl = document.getElementById('testResult');

  if (!MLTrainer.model) {
    resultEl.textContent = '❌ No trained model. Train the model first.';
    resultEl.className = 'status-message error';
    return;
  }

  if (MLTrainer.trainingData.length === 0) {
    resultEl.textContent = '❌ No test data available';
    resultEl.className = 'status-message error';
    return;
  }

  try {
    // Pick a random sample
    const sample = MLTrainer.trainingData[Math.floor(Math.random() * MLTrainer.trainingData.length)];
    const prediction = MLTrainer.predict(sample.features);

    if (prediction) {
      const correctClass = sample.label === prediction.raga ? '✅' : '❌';
      resultEl.innerHTML = `
        ${correctClass} <strong>Test Result</strong><br>
        Actual: ${sample.label}<br>
        Predicted: ${prediction.raga}<br>
        Confidence: ${(prediction.confidence * 100).toFixed(1)}%<br>
        <details>
          <summary>All predictions</summary>
          <ul>
            ${prediction.allPredictions
              .sort((a, b) => b.confidence - a.confidence)
              .slice(0, 5)
              .map(p => `<li>${p.raga}: ${(p.confidence * 100).toFixed(1)}%</li>`)
              .join('')}
          </ul>
        </details>
      `;
      resultEl.className = 'status-message info';
    } else {
      resultEl.textContent = '❌ Prediction failed';
      resultEl.className = 'status-message error';
    }
  } catch (err) {
    resultEl.textContent = `❌ Error: ${err.message}`;
    resultEl.className = 'status-message error';
  }
}

/**
 * Delete the trained model
 */
async function deleteModel() {
  if (!confirm('Delete the trained model? This cannot be undone.')) {
    return;
  }

  try {
    await MLTrainer.deleteModel();
    document.getElementById('trainingResult').textContent = '✅ Model deleted';
    document.getElementById('trainingResult').className = 'status-message success';
    updateStats();
  } catch (err) {
    document.getElementById('trainingResult').textContent = `❌ Error: ${err.message}`;
    document.getElementById('trainingResult').className = 'status-message error';
  }
}

/**
 * Export training data as JSON
 */
function exportTrainingData() {
  const data = MLTrainer.exportTrainingData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `raga-training-data-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import training data from JSON
 */
function importTrainingData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      MLTrainer.importTrainingData(data);
      document.getElementById('sampleStatus').textContent = `✅ Imported ${data.samples.length} samples`;
      document.getElementById('sampleStatus').className = 'status-message success';
      updateStats();
    } catch (err) {
      document.getElementById('sampleStatus').textContent = `❌ Invalid JSON file`;
      document.getElementById('sampleStatus').className = 'status-message error';
    }
  };
  reader.readAsText(file);
}

/**
 * Update statistics display
 */
function updateStats() {
  const stats = MLTrainer.getStats();

  document.getElementById('sampleCount').textContent = stats.totalSamples;
  document.getElementById('ragaCount').textContent = stats.totalRagas;
  document.getElementById('modelStatus').textContent = stats.modelTrained ? 'Yes ✅' : 'No';

  // Update sample list
  const listEl = document.getElementById('sampleList');
  if (stats.totalSamples === 0) {
    listEl.innerHTML = '<p style="color: #999;">No samples collected yet</p>';
  } else {
    const html = Object.entries(stats.ragaCounts)
      .map(([raga, count]) => `<li>${raga}: ${count} sample${count > 1 ? 's' : ''}</li>`)
      .join('');
    listEl.innerHTML = `<ul>${html}</ul>`;
  }
}

export { MLTrainer };

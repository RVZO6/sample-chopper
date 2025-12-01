import './style.css';
import WaveSurfer from 'wavesurfer.js';
import { preprocess } from './audioUtils.js';

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

let worker = null;
let wavesurfer = null;

// DOM elements
const dropArea = document.getElementById('drop-area');
const waveformContainer = document.getElementById('waveform-container');
const resultsSection = document.getElementById('results-section');
const loader = document.getElementById('loader');
const playBtn = document.getElementById('play-btn');
const bpmValue = document.getElementById('bpm-value');
const keyValue = document.getElementById('key-value');

// Initialize worker using URL pattern (Vite-compatible)
worker = new Worker(new URL('./analysis.worker.js', import.meta.url));
worker.onmessage = handleWorkerMessage;

// Send init message
worker.postMessage({ type: 'INIT' });

function handleWorkerMessage(evt) {
  const msg = evt.data;

  switch (msg.type) {
    case 'READY':
      console.log('Analysis worker ready!');
      break;

    case 'RESULT':
      displayResults(msg.payload);
      loader.classList.add('hidden');
      break;

    case 'ERROR':
      console.error('Worker error:', msg.error);
      alert(`Analysis error: ${msg.error}`);
      loader.classList.add('hidden');
      break;
  }
}

function displayResults(result) {
  const { bpm, key, mode } = result;

  if (bpm) {
    bpmValue.textContent = bpm.toFixed(1);
  } else {
    bpmValue.textContent = '--';
  }

  if (key) {
    keyValue.textContent = `${key} ${mode || ''}`.trim();
  } else {
    keyValue.textContent = '--';
  }
}

// File input setup
const fileInput = document.createElement('input');
fileInput.setAttribute('type', 'file');
fileInput.setAttribute('accept', 'audio/*');
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    processFile(fileInput.files[0]);
  }
});

// Drag and drop handlers
dropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropArea.classList.add('drag-over');
});

dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('drag-over');
});

dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  dropArea.classList.remove('drag-over');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
});

dropArea.addEventListener('click', () => {
  fileInput.click();
});

// Process uploaded file
async function processFile(file) {
  console.log('Processing file:', file.name);

  // Show waveform and results sections
  waveformContainer.classList.remove('hidden');
  resultsSection.classList.remove('hidden');
  loader.classList.remove('hidden');

  // Reset results
  bpmValue.textContent = '--';
  keyValue.textContent = '--';
  playBtn.disabled = true;

  // Create or recreate wavesurfer
  if (wavesurfer) {
    wavesurfer.destroy();
  }

  wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#a16607',
    progressColor: '#f7af39',
    cursorColor: '#1c4b78',
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    height: 100,
    normalize: true,
  });

  // Load audio into wavesurfer
  wavesurfer.loadBlob(file);

  wavesurfer.on('ready', () => {
    playBtn.disabled = false;
  });

  // Decode and analyze audio
  try {
    const arrayBuffer = await file.arrayBuffer();
    await audioCtx.resume();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    console.log('Audio decoded successfully');

    // Preprocess audio (mono + downsample to 16kHz for Essentia)
    const processedAudio = preprocess(audioBuffer);

    // Send to worker for analysis
    worker.postMessage({
      type: 'ANALYZE',
      payload: {
        pcm: processedAudio,
        sampleRate: 16000
      }
    });

  } catch (error) {
    console.error('Error processing audio:', error);
    alert('Error processing audio file. Please try a different file.');
    loader.classList.add('hidden');
  }
}

// Playback control
playBtn.addEventListener('click', () => {
  if (wavesurfer) {
    wavesurfer.playPause();
  }
});

// Audio preprocessing utilities

/**
 * Convert stereo to mono and downsample to target sample rate
 */
export function preprocess(audioBuffer) {
  if (!(audioBuffer instanceof AudioBuffer)) {
    throw new TypeError("Input must be an AudioBuffer");
  }
  
  const mono = monomix(audioBuffer);
  return downsampleArray(mono, audioBuffer.sampleRate, 16000);
}

/**
 * Mix down to mono audio
 */
function monomix(buffer) {
  if (buffer.numberOfChannels > 1) {
    console.log('Mixing down to mono...');
    const leftCh = buffer.getChannelData(0);
    const rightCh = buffer.getChannelData(1);
    return leftCh.map((sample, i) => 0.5 * (sample + rightCh[i]));
  } else {
    return buffer.getChannelData(0);
  }
}

/**
 * Downsample audio to target sample rate
 */
function downsampleArray(audioIn, sampleRateIn, sampleRateOut) {
  if (sampleRateOut === sampleRateIn) {
    return audioIn;
  }
  
  const sampleRateRatio = sampleRateIn / sampleRateOut;
  const newLength = Math.round(audioIn.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetAudioIn = 0;

  console.log(`Downsampling from ${sampleRateIn}Hz to ${sampleRateOut}Hz...`);
  
  while (offsetResult < result.length) {
    const nextOffsetAudioIn = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    
    for (let i = offsetAudioIn; i < nextOffsetAudioIn && i < audioIn.length; i++) {
      accum += audioIn[i];
      count++;
    }
    
    result[offsetResult] = accum / count;
    offsetResult++;
    offsetAudioIn = nextOffsetAudioIn;
  }

  return result;
}

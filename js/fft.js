const FFT_SIZE = 2048;
const MEL_BANDS = 12;

function hannWindow(length) {
  const window = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
  }
  return window;
}

function hzToMel(hz) {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel) {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

function createMelFilterBank(sampleRate) {
  const melMin = hzToMel(0);
  const melMax = hzToMel(sampleRate / 2);
  const melPoints = new Float32Array(MEL_BANDS + 2);
  for (let i = 0; i < melPoints.length; i += 1) {
    melPoints[i] = melMin + ((melMax - melMin) / (MEL_BANDS + 1)) * i;
  }
  const freqPoints = Array.from(melPoints, (mel) => melToHz(mel));
  const binPoints = freqPoints.map((freq) => Math.floor((FFT_SIZE + 1) * freq / sampleRate));

  const filters = [];
  for (let m = 1; m <= MEL_BANDS; m += 1) {
    const filter = new Float32Array(FFT_SIZE / 2);
    const left = binPoints[m - 1];
    const center = binPoints[m];
    const right = binPoints[m + 1];
    for (let k = left; k < center; k += 1) {
      filter[k] = (k - left) / (center - left);
    }
    for (let k = center; k < right; k += 1) {
      filter[k] = (right - k) / (right - center);
    }
    filters.push(filter);
  }
  return filters;
}

function applyMelFilters(magnitude, filters) {
  return filters.map((filter) => {
    let energy = 0;
    for (let i = 0; i < filter.length; i += 1) {
      energy += magnitude[i] * filter[i];
    }
    return energy;
  });
}

const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;

export class FFTProcessor {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.window = hannWindow(FFT_SIZE);
    this.filters = createMelFilterBank(sampleRate);
  }

  async computeSpectrum(frame) {
    const padded = new Float32Array(FFT_SIZE);
    const length = Math.min(frame.length, FFT_SIZE);
    for (let i = 0; i < length; i += 1) {
      padded[i] = frame[i] * this.window[i];
    }
    if (!OfflineCtx) {
      const magnitude = new Float32Array(FFT_SIZE / 2);
      for (let i = 0; i < magnitude.length; i += 1) {
        magnitude[i] = Math.abs(padded[i]);
      }
      const melBands = applyMelFilters(magnitude, this.filters);
      return { magnitude, melBands };
    }
    const offline = new OfflineCtx(1, FFT_SIZE, this.sampleRate);
    const buffer = offline.createBuffer(1, FFT_SIZE, this.sampleRate);
    buffer.copyToChannel(padded, 0);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    const analyser = offline.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    const gain = offline.createGain();
    gain.gain.value = 0;
    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(offline.destination);
    source.start();
    await offline.startRendering();
    const freqData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(freqData);
    const magnitude = new Float32Array(freqData.length);
    for (let i = 0; i < freqData.length; i += 1) {
      magnitude[i] = Math.pow(10, freqData[i] / 20);
    }
    const melBands = applyMelFilters(magnitude, this.filters);
    return { magnitude, melBands };
  }
}

export const melBandCount = MEL_BANDS;

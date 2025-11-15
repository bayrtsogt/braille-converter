import { melBandCount } from './fft.js';

const MFCC_COUNT = 13;

function createDctMatrix() {
  const matrix = [];
  for (let i = 0; i < MFCC_COUNT; i += 1) {
    const row = new Float32Array(melBandCount);
    for (let j = 0; j < melBandCount; j += 1) {
      row[j] = Math.cos((Math.PI * i * (2 * j + 1)) / (2 * melBandCount));
    }
    matrix.push(row);
  }
  return matrix;
}

const dctMatrix = createDctMatrix();

export function computeMFCC(melEnergies) {
  const logEnergies = melEnergies.map((value) => Math.log10(value + 1e-12));
  const coeffs = new Array(MFCC_COUNT).fill(0).map((_, rowIndex) => {
    let sum = 0;
    for (let col = 0; col < melEnergies.length; col += 1) {
      sum += dctMatrix[rowIndex][col] * logEnergies[col];
    }
    return sum;
  });
  return coeffs;
}

export function computeRms(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i += 1) {
    sum += frame[i] * frame[i];
  }
  return Math.sqrt(sum / frame.length);
}

export function computeZcr(frame) {
  let zeroCrossings = 0;
  for (let i = 1; i < frame.length; i += 1) {
    if ((frame[i - 1] >= 0 && frame[i] < 0) || (frame[i - 1] < 0 && frame[i] >= 0)) {
      zeroCrossings += 1;
    }
  }
  return zeroCrossings / frame.length;
}

export function computeSpectralStats(magnitude, sampleRate) {
  let sumMag = 0;
  let weightedSum = 0;
  const binCount = magnitude.length;
  for (let i = 0; i < binCount; i += 1) {
    const freq = (i * sampleRate) / (2 * binCount);
    const mag = magnitude[i];
    sumMag += mag;
    weightedSum += mag * freq;
  }
  const centroid = sumMag ? weightedSum / sumMag : 0;

  const sorted = Array.from(magnitude);
  sorted.sort((a, b) => a - b);
  const geom = Math.exp(sorted.reduce((sum, value) => sum + Math.log(value + 1e-12), 0) / binCount);
  const arith = sumMag / binCount;
  const flatness = arith ? geom / arith : 0;

  const rolloffThreshold = sumMag * 0.85;
  let cumulative = 0;
  let rolloff = 0;
  for (let i = 0; i < binCount; i += 1) {
    cumulative += magnitude[i];
    if (cumulative >= rolloffThreshold) {
      rolloff = (i * sampleRate) / (2 * binCount);
      break;
    }
  }

  return { spectralCentroid: centroid, spectralFlatness: flatness, spectralRolloff: rolloff };
}

import { FFTProcessor, melBandCount } from './fft.js';
import { computeMFCC, computeRms, computeZcr, computeSpectralStats } from './mfcc.js';

const WINDOW_SECONDS = 1;
const HOP_RATIO = 0.5;

function mergeChannels(buffer) {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const length = buffer.length;
  const merged = new Float32Array(length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      merged[i] += data[i] / buffer.numberOfChannels;
    }
  }
  return merged;
}

export async function extractFeatureWindows(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate;
  const frameSize = Math.floor(WINDOW_SECONDS * sampleRate);
  const hopSize = Math.floor(frameSize * HOP_RATIO);
  const mono = mergeChannels(audioBuffer);
  const fftProcessor = new FFTProcessor(sampleRate);
  const windows = [];
  let start = 0;
  while (start + frameSize <= mono.length) {
    const frame = mono.slice(start, start + frameSize);
    const rms = computeRms(frame);
    const zcr = computeZcr(frame);
    const { magnitude, melBands } = await fftProcessor.computeSpectrum(frame);
    const mfcc = computeMFCC(melBands);
    const { spectralCentroid, spectralFlatness, spectralRolloff } = computeSpectralStats(
      magnitude,
      sampleRate
    );
    windows.push({
      startTime: start / sampleRate,
      duration: WINDOW_SECONDS,
      rms,
      zcr,
      melBands,
      mfcc,
      spectralCentroid,
      spectralFlatness,
      spectralRolloff,
      magnitude,
    });
    start += hopSize;
  }
  return windows;
}

export function aggregateFeatures(windows) {
  if (!windows.length) {
    return {
      rms: 0,
      zcr: 0,
      mfcc: Array(13).fill(0),
      melEnergy: Array(12).fill(0),
      spectralCentroid: 0,
      spectralFlatness: 0,
      spectralRolloff: 0,
    };
  }
  const sum = windows.reduce(
    (acc, window) => {
      acc.rms += window.rms;
      acc.zcr += window.zcr;
      acc.spectralCentroid += window.spectralCentroid;
      acc.spectralFlatness += window.spectralFlatness;
      acc.spectralRolloff += window.spectralRolloff;
      window.melBands.forEach((value, index) => (acc.melEnergy[index] += value));
      window.mfcc.forEach((value, index) => (acc.mfcc[index] += value));
      return acc;
    },
    {
      rms: 0,
      zcr: 0,
      spectralCentroid: 0,
      spectralFlatness: 0,
      spectralRolloff: 0,
      melEnergy: new Array(melBandCount).fill(0),
      mfcc: new Array(13).fill(0),
    }
  );
  const size = windows.length;
  return {
    rms: sum.rms / size,
    zcr: sum.zcr / size,
    spectralCentroid: sum.spectralCentroid / size,
    spectralFlatness: sum.spectralFlatness / size,
    spectralRolloff: sum.spectralRolloff / size,
    melEnergy: sum.melEnergy.map((value) => value / size),
    mfcc: sum.mfcc.map((value) => value / size),
  };
}

export function buildFeatureVector(window) {
  return [
    ...window.mfcc,
    window.spectralCentroid,
    window.spectralFlatness,
    window.spectralRolloff,
    window.zcr,
    window.rms,
  ];
}

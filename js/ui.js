import { CLASS_NAMES } from './classifier.js';

export class UIController {
  constructor() {
    this.fileHint = document.getElementById('file-hint');
    this.audioPreview = document.getElementById('audio-preview');
    this.videoPreview = document.getElementById('video-preview');
    this.resultContainer = document.getElementById('result-container');
    this.probabilityBars = document.getElementById('probability-bars');
    this.waveformCanvas = document.getElementById('waveform');
    this.spectrogramCanvas = document.getElementById('spectrogram');
    this.segmentButton = document.getElementById('play-segment');
    this.segmentLabel = document.getElementById('segment-label');
    this.jsonOutput = document.getElementById('json-output');
    this.knowledgeBaseEl = document.getElementById('knowledge-base');
    this.waveCtx = this.waveformCanvas.getContext('2d');
    this.specCtx = this.spectrogramCanvas.getContext('2d');
  }

  setFileHint(text) {
    if (this.fileHint) this.fileHint.textContent = text;
  }

  showPreview({ url, kind }) {
    if (kind === 'video') {
      this.videoPreview.src = url;
      this.videoPreview.classList.remove('hidden');
      this.audioPreview.classList.add('hidden');
    } else {
      this.audioPreview.src = url;
      this.audioPreview.classList.remove('hidden');
      this.videoPreview.classList.add('hidden');
    }
  }

  setLoading(message) {
    this.resultContainer.textContent = message;
  }

  renderKnowledgeBase(entries) {
    if (!Array.isArray(entries)) return;
    this.knowledgeBaseEl.innerHTML = entries
      .map(
        (entry) => `
        <article class="kb-item">
          <div class="badge" data-zone="${entry.zone}">${entry.zoneLabel}</div>
          <h3>${entry.title}</h3>
          <p class="muted">${entry.symptom}</p>
          <p>${entry.tip}</p>
        </article>
      `
      )
      .join('');
  }

  renderResult(result) {
    const { fault, confidence, reasoning, secondary, features, locationLabel } = result;
    const secondaryText = Object.keys(secondary || {})
      .map((key) => `${key}: ${((secondary[key] || 0) * 100).toFixed(1)}%`)
      .join(', ');
    this.resultContainer.innerHTML = `
      <div class="result-header">
        <p class="muted">Илэрсэн асуудал</p>
        <h3>${fault}</h3>
        <p class="confidence">Итгэлцэл ${(confidence * 100).toFixed(1)}%</p>
        <p class="muted">Байршил: ${locationLabel}</p>
      </div>
      <p>${reasoning}</p>
      <p class="muted">Нэмэлт магадлал: ${secondaryText || '—'}</p>
      <div class="feature-grid">
        <div><p class="muted">RMS</p><p>${(features?.rms ?? 0).toFixed(4)}</p></div>
        <div><p class="muted">ZCR</p><p>${(features?.zcr ?? 0).toFixed(4)}</p></div>
        <div><p class="muted">Centroid (Hz)</p><p>${(features?.spectralCentroid ?? 0).toFixed(1)}</p></div>
        <div><p class="muted">Rolloff (Hz)</p><p>${(features?.spectralRolloff ?? 0).toFixed(1)}</p></div>
      </div>
    `;
    this.jsonOutput.textContent = JSON.stringify(result, null, 2);
  }

  renderProbabilities(probabilities) {
    if (!probabilities) {
      this.probabilityBars.innerHTML = '<p class="muted">ML загвар ачаалагдаагүй.</p>';
      return;
    }
    this.probabilityBars.innerHTML = CLASS_NAMES.map((label, index) => {
      const value = probabilities[index] || 0;
      return `
        <div class="probability-bar">
          <div class="label"><span>${label}</span><span>${(value * 100).toFixed(1)}%</span></div>
          <div class="bar-track"><span class="bar-fill" style="transform: scaleX(${value});"></span></div>
        </div>
      `;
    }).join('');
  }

  drawWaveform(data, anomalyRange) {
    const ctx = this.waveCtx;
    const { width, height } = this.waveformCanvas;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 1) {
      const index = Math.floor((x / width) * data.length);
      const value = data[index] || 0;
      const y = height / 2 - value * (height / 2);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (anomalyRange) {
      const duration = anomalyRange.duration || 1;
      const startX = (anomalyRange.start / duration) * width;
      const endX = (anomalyRange.end / duration) * width;
      ctx.fillStyle = 'rgba(255, 107, 107, 0.15)';
      ctx.fillRect(startX, 0, endX - startX, height);
    }
  }

  drawSpectrogram(melHistory) {
    const ctx = this.specCtx;
    const { width, height } = this.spectrogramCanvas;
    ctx.clearRect(0, 0, width, height);
    if (!melHistory.length) return;
    const bandCount = melHistory[0].length;
    melHistory.forEach((bands, windowIndex) => {
      bands.forEach((value, bandIndex) => {
        const intensity = Math.min(1, Math.log10(value + 1) / 3);
        const hue = 260 - (bandIndex / bandCount) * 180;
        ctx.fillStyle = `hsla(${hue}, 80%, ${40 + intensity * 40}%, ${0.9})`;
        const x = (windowIndex / melHistory.length) * width;
        const y = (bandIndex / bandCount) * height;
        ctx.fillRect(x, height - y - height / bandCount, width / melHistory.length, height / bandCount);
      });
    });
  }

  enableSegmentButton(enabled, label) {
    this.segmentButton.disabled = !enabled;
    this.segmentLabel.textContent = label;
  }
}

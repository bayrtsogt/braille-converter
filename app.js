const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("media-input");
const fileHint = document.getElementById("file-hint");
const audioPreview = document.getElementById("audio-preview");
const videoPreview = document.getElementById("video-preview");
const resultContainer = document.getElementById("result-container");
const resultTemplate = document.getElementById("result-template");
const knowledgeBaseContainer = document.getElementById("knowledge-base");

let audioContext;

const knowledgeBase = [
  {
    component: "Урд түдгэлзүүлэлт",
    symptoms: [
      "80-200 Гц орчмын хүчтэй дохио",
      "RMS > 0.25",
      "Уртааш чиглэлд давтамж тогтмол"
    ],
    action: "Амортизатор, сайлент блок, холхивч шалгах"
  },
  {
    component: "Хөтлөгч гол ба CV холбоос",
    symptoms: ["Дунд давтамж (200-800 Гц)", "Тэг огтлолтын өндөр давтамж", "Сул эргэлтэнд хүчтэй"],
    action: "CV үе, кардангийн гар холхивч тосолгоог шалгана"
  },
  {
    component: "Дамар/ремен",
    symptoms: ["1кГц-аас дээш шүгэлдэх", "ZCR өндөр", "Цахилгаан хэрэглэгч асаахад нэмэгдэнэ"],
    action: "Ременгийн хурцадмал, дамрын шулуун байдлыг шалгах"
  },
  {
    component: "Тормозны дэвсгэр",
    symptoms: ["500-2кГц хооронд жигд дуу", "RMS бага боловч өндөр давтамж давамгай"],
    action: "Дэвсгэрийн элэгдэл, тоос сорох сувгийг цэвэрлэх"
  }
];

function init() {
  renderKnowledgeBase();
  wireDragEvents();
  fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      handleFile(file);
    }
  });
}

function wireDragEvents() {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  });
}

async function handleFile(file) {
  resetPreviews();
  fileHint.textContent = `${file.name} (${formatBytes(file.size)})`;
  const objectUrl = URL.createObjectURL(file);

  if (file.type.startsWith("audio")) {
    audioPreview.src = objectUrl;
    audioPreview.classList.remove("hidden");
  } else if (file.type.startsWith("video")) {
    videoPreview.src = objectUrl;
    videoPreview.classList.remove("hidden");
  }

  try {
    setResultMessage("Дууг боловсруулж байна...");
    const features = await extractAudioFeatures(file);
    const analysis = inferIssue(features);
    renderResult(analysis);
  } catch (error) {
    console.error(error);
    setResultMessage(
      "Аудио урсгалыг тайлах боломжгүй байна. Файл нь DRM эсвэл дэмжигдээгүй кодектой байж болно."
    );
  }
}

function resetPreviews() {
  [audioPreview, videoPreview].forEach((element) => {
    element.classList.add("hidden");
    element.removeAttribute("src");
    element.load();
  });
}

function setResultMessage(message) {
  resultContainer.classList.add("muted");
  resultContainer.textContent = message;
}

async function extractAudioFeatures(file) {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await decodeAudio(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const sampleCount = Math.min(
    channelData.length,
    audioBuffer.sampleRate * 5 // analyze first 5 seconds
  );
  const segment = channelData.slice(0, sampleCount);

  const rms = computeRms(segment);
  const zeroCrossingRate = computeZeroCrossingRate(segment, audioBuffer.sampleRate);
  const bands = computeFrequencyBands(segment, audioBuffer.sampleRate);

  return {
    rms,
    zeroCrossingRate,
    ...bands,
    sampleRate: audioBuffer.sampleRate
  };
}

function decodeAudio(arrayBuffer) {
  return new Promise((resolve, reject) => {
    audioContext.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
  });
}

function computeRms(samples) {
  if (!samples.length) return 0;
  const sum = samples.reduce((acc, value) => acc + value * value, 0);
  return Math.sqrt(sum / samples.length);
}

function computeZeroCrossingRate(samples, sampleRate) {
  if (!samples.length) return 0;
  let crossings = 0;
  for (let i = 1; i < samples.length; i += 1) {
    if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
      crossings += 1;
    }
  }
  const durationSeconds = samples.length / sampleRate;
  return crossings / durationSeconds;
}

function computeFrequencyBands(samples, sampleRate) {
  const windowSize = 1024;
  if (samples.length < windowSize) {
    return { low: 0, mid: 0, high: 0 };
  }

  const start = Math.max(0, Math.floor((samples.length - windowSize) / 2));
  const window = samples.slice(start, start + windowSize);
  const magnitudes = discreteTransform(window);
  const binSize = sampleRate / windowSize;

  const bands = {
    low: averageMagnitudeInRange(magnitudes, binSize, 20, 200),
    mid: averageMagnitudeInRange(magnitudes, binSize, 200, 1000),
    high: averageMagnitudeInRange(magnitudes, binSize, 1000, 4000)
  };

  return bands;
}

function discreteTransform(window) {
  const n = window.length;
  const magnitudes = new Float32Array(n / 2);
  for (let k = 0; k < magnitudes.length; k += 1) {
    let real = 0;
    let imag = 0;
    for (let t = 0; t < n; t += 1) {
      const angle = (2 * Math.PI * k * t) / n;
      const value = window[t];
      real += value * Math.cos(angle);
      imag -= value * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(real * real + imag * imag);
  }
  return magnitudes;
}

function averageMagnitudeInRange(magnitudes, binSize, minFreq, maxFreq) {
  let sum = 0;
  let count = 0;
  const minIndex = Math.max(1, Math.floor(minFreq / binSize));
  const maxIndex = Math.min(magnitudes.length - 1, Math.ceil(maxFreq / binSize));
  for (let i = minIndex; i <= maxIndex; i += 1) {
    sum += magnitudes[i];
    count += 1;
  }
  return count ? sum / count : 0;
}

function inferIssue(features) {
  const { low, mid, high, rms, zeroCrossingRate } = features;
  const rules = [
    {
      component: "Дугуй / холхивч",
      condition: () => low > mid * 1.2 && rms > 0.18,
      severity: "high",
      explanation: "Доод давтамж давамгай, хүчтэй чичиргээ мэдрэгдсэн тул дугуйн холхивч эсвэл кардан голд доголдол байх магадлалтай."
    },
    {
      component: "Түдгэлзүүлэлтийн пүрш",
      condition: () => mid > low * 1.1 && rms > 0.22,
      severity: "medium",
      explanation: "Дунд зурвасын энерги өндөр байгаа нь пүрш/амортизатор цочролыг бүрэн шингээхгүй байгааг илтгэнэ."
    },
    {
      component: "Ремен эсвэл дамар",
      condition: () => high > mid * 1.4 && zeroCrossingRate > 200,
      severity: "medium",
      explanation: "Өндөр давтамж давамгай, тэг огтлолтын давтамж өссөн тул ремен гулгах эсвэл дамрын шүгэл сонсогдож байна."
    },
    {
      component: "Тормозны дэвсгэр",
      condition: () => high > low && rms < 0.15,
      severity: "low",
      explanation: "Нийт эрчим бага боловч өндөр давтамж давамгай тул тормозны дэвсгэр металлд хүрч эхэлж байж магадгүй."
    }
  ];

  const matchedRule = rules.find((rule) => rule.condition());
  const fallback = {
    component: "Хөдөлгүүрийн ерөнхий чичиргээ",
    severity: "low",
    explanation: "Тодорхой сегмент илрээгүй тул хосолсон оношилгоо шаардана."
  };

  const selected = matchedRule ?? fallback;
  const confidence = computeConfidence(features, selected.component);

  return {
    ...selected,
    features,
    confidence
  };
}

function computeConfidence(features, component) {
  const { low, mid, high, rms } = features;
  const total = low + mid + high + rms;
  if (!total) return 0.2;

  const ratios = [low, mid, high, rms].map((value) => value / total);
  const spread = Math.max(...ratios) - Math.min(...ratios);
  const base = component === "Хөдөлгүүрийн ерөнхий чичиргээ" ? 0.3 : 0.6;
  return Math.min(0.95, base + spread * 0.8);
}

function renderResult(analysis) {
  const { component, severity, explanation, features, confidence } = analysis;
  const result = resultTemplate.content.cloneNode(true);
  result.querySelector('[data-field="component"]').textContent = component;
  const severityElement = result.querySelector('[data-field="severity"]');
  severityElement.textContent = `Түвшин: ${translateSeverity(severity)}`;
  severityElement.dataset.level = severity;
  result.querySelector('[data-field="explanation"]').textContent = explanation;
  result.querySelector('[data-field="rms"]').textContent = formatNumber(features.rms);
  result.querySelector('[data-field="zcr"]').textContent = `${formatNumber(features.zeroCrossingRate)} / сек`;
  result.querySelector('[data-field="low"]').textContent = formatNumber(features.low);
  result.querySelector('[data-field="mid"]').textContent = formatNumber(features.mid);
  result.querySelector('[data-field="high"]').textContent = formatNumber(features.high);
  result.querySelector('[data-field="confidence"]').textContent = `${formatPercent(confidence)} магадлал`;

  resultContainer.classList.remove("muted");
  resultContainer.innerHTML = "";
  resultContainer.appendChild(result);
}

function translateSeverity(level) {
  switch (level) {
    case "high":
      return "Яаралтай";
    case "medium":
      return "Анхаарах";
    default:
      return "Ажиглах";
  }
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return "-";
  return Number(value).toFixed(digits);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let size = bytes;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(1)} ${units[index]}`;
}

function renderKnowledgeBase() {
  knowledgeBaseContainer.innerHTML = "";
  knowledgeBase.forEach((item) => {
    const article = document.createElement("article");
    article.className = "kb-item";
    article.innerHTML = `
      <h3>${item.component}</h3>
      <p class="muted">Ажиглагддаг шинж тэмдэг:</p>
      <ul>
        ${item.symptoms.map((symptom) => `<li>${symptom}</li>`).join("")}
      </ul>
      <p><strong>Үйлдэл:</strong> ${item.action}</p>
    `;
    knowledgeBaseContainer.appendChild(article);
  });
}

init();

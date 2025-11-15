const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("media-input");
const fileHint = document.getElementById("file-hint");
const audioPreview = document.getElementById("audio-preview");
const videoPreview = document.getElementById("video-preview");
const resultContainer = document.getElementById("result-container");
const resultTemplate = document.getElementById("result-template");
const knowledgeBaseContainer = document.getElementById("knowledge-base");
const locationSelect = document.getElementById("noise-location");

let audioContext;

const locationLabels = {
  global: "Тодорхойгүй / бүх хэсэгт",
  "front-left-wheel": "Зүүн урд дугуй",
  "front-right-wheel": "Баруун урд дугуй",
  "rear-left-wheel": "Зүүн хойд дугуй",
  "rear-right-wheel": "Баруун хойд дугуй",
  "rear-axle": "Хойд тэнхлэг ба дифференциал",
  "engine-bay": "Хөдөлгүүр, генератор",
  transmission: "Хурдны хайрцаг / кардан",
  undercarriage: "Доод явах эд анги, яндан",
  cabin: "Салон, жолооны хүрд"
};

const knowledgeBase = [
  {
    component: "Баруун урд дугуйн холхивч",
    zones: ["front-right-wheel", "front-left-wheel"],
    symptoms: ["80-250 Гц хооронд хүчтэй чичиргээ", "RMS > 0.22", "Хурдасахад эрчим нэмэгддэг"],
    action: "Холхивч, сайлент блок, бэхэлгээг шалгаж тослох эсвэл солих"
  },
  {
    component: "CV үе ба кардангийн холбоос",
    zones: ["front-left-wheel", "front-right-wheel", "transmission"],
    symptoms: [
      "200-800 Гц дунд зурваст тогтмол цохилт",
      "ZCR дунд зэргийн өсөлт",
      "Эргэх үед хүчтэй дугарна"
    ],
    action: "Гарны резин холбогч, тосолгоо, люфт хэмжинэ"
  },
  {
    component: "Тормозны дэвсгэр/диск",
    zones: ["front-left-wheel", "front-right-wheel", "rear-left-wheel", "rear-right-wheel"],
    symptoms: ["500-2000 Гц өндөр бүрэлдэхүүн", "RMS бага", "Тормоз гишгэхэд гарна"],
    action: "Дэвсгэрийн зузаан, тоос арчигч, дискний хазайлтыг шалгах"
  },
  {
    component: "Дугуйн хэв гажилт (cup)",
    zones: ["rear-left-wheel", "rear-right-wheel"],
    symptoms: [
      "Доод ба дунд зурвас ээлжлэн давамгай",
      "RMS тогтворгүй",
      "Замын хурднаас хамааран долгиолох",
    ],
    action: "Дугуйн баланс, хэв гажилтыг шалгаж эргүүлэх"
  },
  {
    component: "Дифференциал ба хойд хөтлөгч",
    zones: ["rear-left-wheel", "rear-right-wheel", "rear-axle"],
    symptoms: ["Доод зурвас давамгай", "RMS > 0.2", "Суллахад жигд гулгих чимээ"],
    action: "Дифференциалын тос, арааны элэгдлийг шалгах"
  },
  {
    component: "Хөдөлгүүрийн шаталтын доголдол",
    zones: ["engine-bay"],
    symptoms: ["Доод болон дунд зурвас зэрэг өндөр", "RMS > 0.25", "Тахир голын эргэлт савлаж сонсогдоно"],
    action: "Гал асаалт, форсунк, компресс шалгах"
  },
  {
    component: "Генератор/ременгийн шүгэл",
    zones: ["engine-bay"],
    symptoms: ["1кГц-аас дээш шүгэлдэх", "ZCR өндөр", "Цахилгаан хэрэглэгч асаахад нэмэгдэнэ"],
    action: "Ремен таталт, дамрын шулуун байдал, генераторын холхивч шалгах"
  },
  {
    component: "Power steering эсвэл AC насос",
    zones: ["engine-bay", "cabin"],
    symptoms: ["Өндөр зурвас чичиргээ", "RMS 0.18-0.24", "Жолоо эргэх үед нэмэгддэг"],
    action: "Шингэний түвшин, насосны холхивч, дамжуулгыг шалгах"
  },
  {
    component: "Хурдны хайрцгийн арааны дуу",
    zones: ["transmission"],
    symptoms: ["Дунд ба өндөр зурвас холилдсон", "ZCR > 160", "Ээлж солих үед нэмэгдэнэ"],
    action: "Тосолгоо, синхрончлогч, гол холхивчийг шалгах"
  },
  {
    component: "Яндангийн алдагдал",
    zones: ["undercarriage"],
    symptoms: ["Дунд зурвас тасралтгүй шуугих", "RMS 0.15-0.22", "Хурдасахад хурдан бүлэгнэнэ"],
    action: "Яндангийн холбоос, катализаторын ойролцоох ан цавыг шалгах"
  },
  {
    component: "Салоны сул бэхэлгээ",
    zones: ["cabin"],
    symptoms: ["200-600 Гц тогтвортой чичиргээ", "RMS < 0.18", "Хот дотор овойлт гарахад нэмэгдэнэ"],
    action: "Арматур, хаалганы карт, салон бэхэлгээг чангалах"
  }
];

const diagnosticRules = [
  {
    component: "Дугуйн холхивч", // applies to бүх дугуй
    zones: ["front-left-wheel", "front-right-wheel", "rear-left-wheel", "rear-right-wheel"],
    severity: "high",
    explanation: "Доод зурвас давамгай, өндөр RMS нь холхивч эсвэл төвийн зангилаа ихээхэн люфттай байгааг илтгэнэ.",
    condition: ({ low, mid, rms }) => low > mid * 1.15 && rms > 0.22
  },
  {
    component: "CV үе ба кардан", // steering angle noise
    zones: ["front-left-wheel", "front-right-wheel", "transmission"],
    severity: "medium",
    explanation: "Дунд зурвас хүчтэй бөгөөд тогтмол цохилт илэрсэн тул CV үе эсвэл кардангийн холбоос элэгдсэн байж магад.",
    condition: ({ mid, high, rms }) => mid > high * 0.95 && rms > 0.19
  },
  {
    component: "Дугуйн хэв гажилт/баланс", // rear vibrations
    zones: ["rear-left-wheel", "rear-right-wheel"],
    severity: "medium",
    explanation: "Доод ба дунд зурвас ээлжлэн давамгай байгаа нь дугуйн гадарга долгиорсон эсвэл баланс алдагдсан шинж.",
    condition: ({ low, mid, high, rms }) => low > high * 1.1 && mid > low * 0.8 && rms >= 0.17 && rms <= 0.28
  },
  {
    component: "Тормозны дэвсгэр / диск",
    zones: ["front-left-wheel", "front-right-wheel", "rear-left-wheel", "rear-right-wheel"],
    severity: "medium",
    explanation: "Өндөр зурвасын эрчим давамгай, нийт RMS бага байгаа нь дэвсгэр металлд хүрэх эсвэл диск мурийсныг илтгэнэ.",
    condition: ({ high, low, rms }) => high > low && rms < 0.16
  },
  {
    component: "Дифференциалын араа",
    zones: ["rear-axle", "rear-left-wheel", "rear-right-wheel"],
    severity: "high",
    explanation: "Доод зурвас жигд нэмэгдэж, RMS өндөр байгаа нь дифференциалын араа эсвэл хөтлөгч голд тогтворгүй байгааг харуулна.",
    condition: ({ low, mid, rms }) => low > mid && rms > 0.2
  },
  {
    component: "Генератор/ремен",
    zones: ["engine-bay"],
    severity: "medium",
    explanation: "Өндөр зурвас, өндөр тэг огтлолтын давтамж нь ремен гулгах эсвэл генераторын холхивч шаржигнахтай холбоотой.",
    condition: ({ high, mid, zeroCrossingRate }) => high > mid * 1.3 && zeroCrossingRate > 220
  },
  {
    component: "Хөдөлгүүрийн шаталтын доголдол",
    zones: ["engine-bay"],
    severity: "high",
    explanation: "Доод ба дунд зурвас зэрэг өндөр, RMS их байгаа нь шаталтын жигд бус байдал эсвэл гал асаалтын доголдлыг илтгэнэ.",
    condition: ({ low, mid, high, rms }) => mid > high && low > mid * 0.85 && rms > 0.24
  },
  {
    component: "Power steering / AC насос",
    zones: ["engine-bay", "cabin"],
    severity: "medium",
    explanation: "Өндөр зурваст тогтвортой шуугих, дундаж RMS нь насосны холхивч эсвэл шингэний даралттай холбоотойг илтгэнэ.",
    condition: ({ high, mid, rms }) => high > mid && rms >= 0.18 && rms <= 0.26
  },
  {
    component: "Хурдны хайрцгийн арааны дуу",
    zones: ["transmission"],
    severity: "medium",
    explanation: "Дунд болон өндөр зурвас хамт өсөж, тэг огтлолын давтамж нэмэгдсэн нь араа, синхрончлогч элэгдсэнийг заана.",
    condition: ({ mid, low, zeroCrossingRate }) => mid > low * 1.05 && zeroCrossingRate > 160
  },
  {
    component: "Яндангийн алдагдал",
    zones: ["undercarriage"],
    severity: "medium",
    explanation: "Дунд зурвасын тасралтгүй шуугих, RMS 0.15-0.23 байгаа нь яндангийн холбоос эсвэл ан цавтайг илтгэнэ.",
    condition: ({ mid, low, high, rms }) => mid > low && high < mid * 1.3 && rms >= 0.15 && rms <= 0.23
  },
  {
    component: "Салоны сул бэхэлгээ",
    zones: ["cabin"],
    severity: "low",
    explanation: "Дунд зурвас давамгай ч нийт RMS бага тул арматур, хаалганы карт зэрэг сул бэхэлгээ байж магадгүй.",
    condition: ({ mid, low, rms }) => mid > low && rms < 0.18
  }
];

const fallbackByZone = {
  global: {
    component: "Хөдөлгүүрийн ерөнхий чичиргээ",
    severity: "low",
    explanation: "Тодорхой хэв шинж илрээгүй тул нэмэлт сорил, туршилтын явц шаардлагатай."
  },
  "front-left-wheel": {
    component: "Урд тэнхлэгийн ерөнхий доголдол",
    severity: "medium",
    explanation: "Урд талын дугуй, пүрш, холхивч, тоормозыг хамтад нь шалгана уу."
  },
  "front-right-wheel": {
    component: "Урд тэнхлэгийн ерөнхий доголдол",
    severity: "medium",
    explanation: "Урд талын дугуй, пүрш, холхивч, тоормозыг хамтад нь шалгана уу."
  },
  "rear-left-wheel": {
    component: "Хойд тэнхлэгийн ерөнхий доголдол",
    severity: "medium",
    explanation: "Дугуйн баланс, холхивч, дифференциалын тосолгоог шалгана уу."
  },
  "rear-right-wheel": {
    component: "Хойд тэнхлэгийн ерөнхий доголдол",
    severity: "medium",
    explanation: "Дугуйн баланс, холхивч, дифференциалын тосолгоог шалгана уу."
  },
  "rear-axle": {
    component: "Дифференциалын ерөнхий чимээ",
    severity: "medium",
    explanation: "Хойд гол, кардан болон тосны түвшинг шалгана уу."
  },
  "engine-bay": {
    component: "Хөдөлгүүрийн туслах төхөөрөмж",
    severity: "medium",
    explanation: "Ремен, генератор, насос болон хурдасгуурыг нэгдсэн байдлаар шалгана уу."
  },
  transmission: {
    component: "Хурдны хайрцгийн нийтлэг чичиргээ",
    severity: "medium",
    explanation: "Редуктор, синхрончлогч, кардангийн тогтоцыг оношлоно."
  },
  undercarriage: {
    component: "Доод явах эд ангийн чимээ",
    severity: "low",
    explanation: "Яндан, хамгаалалтын төмөр, кардан бэхэлгээг шалгана уу."
  },
  cabin: {
    component: "Салон дахь сул эд анги",
    severity: "low",
    explanation: "Арматур, суудал, агааржуулалтын хайрцгийн бэхэлгээг шалгана уу."
  }
};

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
  const location = locationSelect?.value || "global";

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
    const analysis = inferIssue(features, location);
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

function inferIssue(features, location) {
  const zone = location || "global";
  const relevantRules = diagnosticRules.filter((rule) => locationMatches(rule.zones, zone));
  const matchedRule = relevantRules.find((rule) => rule.condition(features));
  const fallback = fallbackByZone[zone] ?? fallbackByZone.global;
  const selected = matchedRule ?? fallback;
  const confidence = computeConfidence(features, selected.component, Boolean(matchedRule), zone);

  return {
    ...selected,
    features,
    confidence,
    location: zone
  };
}

function locationMatches(zones, targetZone) {
  return zones?.includes("any") || zones?.includes(targetZone) || targetZone === "global";
}

function computeConfidence(features, component, hasDirectMatch, zone) {
  const { low, mid, high, rms } = features;
  const total = Math.max(low + mid + high + rms, 1e-6);
  const ratios = [low, mid, high].map((value) => value / total);
  const spread = Math.max(...ratios) - Math.min(...ratios);
  const energyBoost = Math.min(rms * 1.5, 0.35);
  const matchBoost = hasDirectMatch ? 0.25 : 0;
  const locationBoost = zone !== "global" ? 0.1 : 0;
  const base = component.includes("ерөнхий") ? 0.35 : 0.45;
  return Math.min(0.98, base + spread * 0.5 + energyBoost + matchBoost + locationBoost);
}

function renderResult(analysis) {
  const { component, severity, explanation, features, confidence, location } = analysis;
  const result = resultTemplate.content.cloneNode(true);
  result.querySelector('[data-field="component"]').textContent = component;
  const severityElement = result.querySelector('[data-field="severity"]');
  severityElement.textContent = `Түвшин: ${translateSeverity(severity)}`;
  severityElement.dataset.level = severity;
  result.querySelector('[data-field="location"]').textContent = getLocationLabel(location);
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

function getLocationLabel(value) {
  return locationLabels[value] ?? locationLabels.global;
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
    const zoneBadges = item.zones?.length
      ? `<div class="kb-meta">${item.zones
          .map((zone) => `<span>${getLocationLabel(zone)}</span>`)
          .join("")}</div>`
      : "";
    article.innerHTML = `
      <h3>${item.component}</h3>
      ${zoneBadges}
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

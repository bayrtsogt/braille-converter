import { setupLoader, getAudioContext } from './js/audioLoader.js';
import { extractFeatureWindows, aggregateFeatures, buildFeatureVector } from './js/audioFeatures.js';
import { Classifier, summarizeProbabilities, CLASS_NAMES } from './js/classifier.js';
import { UIController } from './js/ui.js';

const classifier = new Classifier('/model/model.json');
const ui = new UIController();
const knowledgeBase = [
  {
    title: 'CV Joint - огцом эргэхэд "тог тог"',
    symptom: 'Дугуйг бүтэн эргүүлэхэд рульд доргилт, хурдатгал дээр нэмэгдэнэ.',
    tip: 'Дунд/өндөр MFCC импульс хүчтэй үед CV joint click магадлал өндөр.',
    zone: 'front-right-wheel',
    zoneLabel: 'Урд тэнхлэг',
  },
  {
    title: 'Дифференциал - исгэрэх чимээ',
    symptom: '40-80 км/ц хурдтай үед хоцорч буй исгэрэх дуу.',
    tip: 'Mel бага/дунд зурваст тасралтгүй эрчим бол дифференциал.',
    zone: 'rear-axle',
    zoneLabel: 'Хойд тэнхлэг',
  },
  {
    title: 'Хөдөлгүүрийн алгасалт',
    symptom: 'Хөдөлгүүр доголдох, яндангаар шаталтгүй бензин үнэртэх.',
    tip: 'Өндөр RMS + өндөр centroid = misfire.',
    zone: 'engine-bay',
    zoneLabel: 'Хөдөлгүүр',
  },
  {
    title: 'Яндангийн алдагдал',
    symptom: 'Хурдасгал дээр үлээж буй дуу, дулаан үнэр.',
    tip: 'Mel дунд зурваст өргөн зурвасын энерги бол exhaust leak.',
    zone: 'undercarriage',
    zoneLabel: 'Доод хэсэг',
  },
  {
    title: 'Тоормосны хяхтнаа',
    symptom: 'Тоормос дарахад өндөр давтамжийн чимээ.',
    tip: 'Өндөр mel band + өндөр rolloff нь brake squeal.',
    zone: 'front-left-wheel',
    zoneLabel: 'Тоормос',
  },
  {
    title: 'Хөтлөгч голын холхивч',
    symptom: 'Хурдтай урагшлах үед исгэрч, эргэхэд нэмэгдэнэ.',
    tip: 'Доод mel band давтамж багатай ч тасралтгүй байвал bearing fault.',
    zone: 'transmission',
    zoneLabel: 'Хөтлүүр',
  },
];

ui.renderKnowledgeBase(knowledgeBase);

const locationSelect = document.getElementById('noise-location');
const playButton = document.getElementById('play-segment');

let currentBuffer = null;
let currentWindows = [];
let anomalyWindowIndex = null;

setupLoader({
  inputEl: document.getElementById('media-input'),
  dropZoneEl: document.getElementById('drop-zone'),
  onFileLoaded: async ({ audioBuffer, objectUrl, kind, file }) => {
    currentBuffer = audioBuffer;
    ui.setFileHint(`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    ui.showPreview({ url: objectUrl, kind });
    await runAnalysis();
  },
  onStateChange: ({ message }) => ui.setLoading(message),
});

playButton.addEventListener('click', () => {
  if (anomalyWindowIndex == null || !currentBuffer) return;
  const windowInfo = currentWindows[anomalyWindowIndex];
  if (!windowInfo) return;
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = currentBuffer;
  const gain = ctx.createGain();
  gain.gain.value = 1;
  source.connect(gain).connect(ctx.destination);
  const start = windowInfo.startTime;
  const duration = windowInfo.duration;
  try {
    source.start(0, start, duration);
  } catch (err) {
    console.warn('Cannot play segment', err);
  }
});

async function runAnalysis() {
  if (!currentBuffer) return;
  ui.setLoading('MFCC болон ML анализ тооцож байна…');
  try {
    currentWindows = await extractFeatureWindows(currentBuffer);
    if (!currentWindows.length) throw new Error('Анализ хийхэд хангалттай өгөгдөл алга.');
    const aggregate = aggregateFeatures(currentWindows);
    const melHistory = currentWindows.map((w) => w.melBands);
    ui.drawWaveform(currentBuffer.getChannelData(0), null);
    ui.drawSpectrogram(melHistory);

    const batch = currentWindows.map((window) => buildFeatureVector(window));
    const probabilities = await classifier.predictBatch(batch);

    const aggregatedProbs = probabilities
      ? probabilities.reduce((acc, probs) => {
          probs.forEach((value, index) => {
            acc[index] = (acc[index] || 0) + value;
          });
          return acc;
        }, new Array(CLASS_NAMES.length).fill(0))
      : null;

    let topClass = 'normal';
    let confidence = 0;
    let rest = [];
    if (aggregatedProbs) {
      const normalized = aggregatedProbs.map((value) => value / currentWindows.length);
      const summary = summarizeProbabilities(normalized);
      topClass = summary.top.label;
      confidence = summary.top.value;
      rest = summary.rest.slice(0, 3);
      anomalyWindowIndex = probabilities
        .map((probs, index) => ({ index, value: probs[CLASS_NAMES.indexOf(topClass)] }))
        .sort((a, b) => b.value - a.value)[0].index;
      ui.renderProbabilities(normalized);
    } else {
      ui.renderProbabilities(null);
      // fallback rule-based
      const loudest = currentWindows.reduce((prev, curr) => (curr.rms > prev.rms ? curr : prev));
      anomalyWindowIndex = currentWindows.indexOf(loudest);
      topClass = heuristicClass(loudest);
      confidence = 0.4;
      rest = [];
    }

    const locationLabel = locationSelect.options[locationSelect.selectedIndex].textContent;
    const reasoning = buildReasoning(topClass, locationLabel);
    const secondary = rest.reduce((acc, item) => {
      acc[item.label] = item.value;
      return acc;
    }, {});
    const result = {
      fault: topClass,
      confidence,
      secondary,
      features: aggregate,
      reasoning,
      locationLabel,
      anomalyWindowIndex,
      featuresByWindow: currentWindows,
    };
    ui.renderResult(result);
    ui.enableSegmentButton(true, `Цонх ${(anomalyWindowIndex ?? 0) + 1}`);
    document.dispatchEvent(new CustomEvent('analysis:complete', { detail: result }));
  } catch (error) {
    console.error(error);
    ui.setLoading('Алдаа гарлаа: ' + error.message);
    ui.enableSegmentButton(false, 'Цонх сонгогдоогүй');
  }
}

function heuristicClass(window) {
  if (window.zcr < 0.05 && window.rms > 0.2) return 'differential_whine';
  if (window.spectralCentroid > 4000 && window.spectralFlatness < 0.3) return 'brake_squeal';
  if (window.mfcc[0] > 1 && window.rms > 0.15) return 'engine_misfire';
  return 'normal';
}

function buildReasoning(fault, locationLabel) {
  const phrases = {
    bearing_fault: 'Доод давтамжийн тогтмол энерги илэрсэн тул холхивчны гэмтэл сэжиглэв.',
    cv_joint_click: 'Цохилтын MFCC импульсүүд CV joint-той таарч байна.',
    brake_squeal: 'Өндөр давтамжийн mel энерги давамгайлж байна.',
    differential_whine: 'Тэгш хэмт исгэрэх спектр илэрсэн.',
    engine_misfire: 'Өндөр RMS + төвшингүй centroid нь misfire шинж.',
    exhaust_leak: 'Дунд зурваст өргөн зурвасын энерги бүртгэгдлээ.',
    wheel_balance_issue: 'Бага давтамжийн давтагдсан долгион нь балансын асуудлыг илтгэнэ.',
    normal: 'Онцгой хэвийлт илрээгүй.',
  };
  return `${phrases[fault] || ''} Байршлын заалт: ${locationLabel}.`;
}

document.addEventListener('analysis:complete', (event) => {
  const detail = event.detail;
  const melHistory = detail.featuresByWindow?.map((w) => w.melBands) || [];
  const mono = currentBuffer?.getChannelData(0) || new Float32Array();
  const start = detail.featuresByWindow?.[detail.anomalyWindowIndex]?.startTime ?? 0;
  const end = start + (detail.featuresByWindow?.[detail.anomalyWindowIndex]?.duration || 1);
  ui.drawWaveform(mono, { start, end, duration: currentBuffer?.duration || 1 });
  ui.drawSpectrogram(melHistory);
});

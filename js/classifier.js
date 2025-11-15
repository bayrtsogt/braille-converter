const CLASS_NAMES = [
  'bearing_fault',
  'cv_joint_click',
  'brake_squeal',
  'differential_whine',
  'engine_misfire',
  'exhaust_leak',
  'wheel_balance_issue',
  'normal',
];

export class Classifier {
  constructor(modelUrl = '/model/model.json') {
    this.modelUrl = modelUrl;
    this.ready = false;
    this.loading = false;
  }

  async ensureLoaded() {
    if (this.ready || this.loading) return this.modelPromise;
    if (!window.tf) {
      console.warn('TensorFlow.js not available.');
      return null;
    }
    this.loading = true;
    this.modelPromise = window.tf
      .loadLayersModel(this.modelUrl)
      .then((model) => {
        this.model = model;
        this.ready = true;
        return model;
      })
      .catch((error) => {
        console.warn('Cannot load TF model', error);
        this.ready = false;
        return null;
      });
    await this.modelPromise;
    return this.model;
  }

  async predictBatch(batch) {
    await this.ensureLoaded();
    if (!this.model) return null;
    const tensor = window.tf.tensor2d(batch);
    const prediction = this.model.predict(tensor);
    const result = await prediction.array();
    window.tf.dispose([tensor, prediction]);
    return result;
  }
}

export function normalizeProbabilities(probs) {
  const total = probs.reduce((sum, value) => sum + value, 0) || 1;
  return probs.map((value) => value / total);
}

export function summarizeProbabilities(probabilities) {
  const normalized = normalizeProbabilities(probabilities);
  const paired = normalized.map((value, index) => ({ label: CLASS_NAMES[index], value }));
  paired.sort((a, b) => b.value - a.value);
  const [top, ...rest] = paired;
  return { top, rest };
}

export { CLASS_NAMES };

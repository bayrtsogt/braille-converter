const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const sharedCtx = AudioContextClass ? new AudioContextClass() : null;

async function decodeArrayBuffer(arrayBuffer) {
  if (!sharedCtx) throw new Error('AudioContext not supported.');
  try {
    return await sharedCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    return await new Promise((resolve, reject) => {
      sharedCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
    });
  }
}

export function setupLoader({ inputEl, dropZoneEl, onFileLoaded, onStateChange }) {
  const zone = dropZoneEl;

  const handleFiles = async (files) => {
    if (!files || !files.length) return;
    const file = files[0];
    onStateChange?.({ state: 'loading', message: 'Файл уншиж байна…' });
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await decodeArrayBuffer(arrayBuffer);
      const objectUrl = URL.createObjectURL(file);
      const kind = file.type.startsWith('video') ? 'video' : 'audio';
      onFileLoaded({ audioBuffer, file, objectUrl, kind });
    } catch (error) {
      console.error(error);
      onStateChange?.({ state: 'error', message: 'Файлыг унших боломжгүй байна.' });
    }
  };

  inputEl.addEventListener('change', (event) => handleFiles(event.target.files));

  ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });

  zone.addEventListener('dragover', () => zone.classList.add('dragover'));
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (event) => {
    zone.classList.remove('dragover');
    handleFiles(event.dataTransfer.files);
  });
}

export function getAudioContext() {
  return sharedCtx;
}

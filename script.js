const BACKEND_ROUTE = '/api/complete';

const chatFeed = document.getElementById('chatFeed');
const promptInput = document.getElementById('promptInput');
const submitBtn = document.getElementById('submitBtn');
const saveButton = document.getElementById('saveButton');
const typingStatus = document.getElementById('typingStatus');
const spinnerOverlay = document.getElementById('spinnerOverlay');
const spinnerText = document.getElementById('spinnerText');
const clearHistoryBtn = document.getElementById('clearHistory');
const fileInput = document.getElementById('fileInput');
const dropArea = document.getElementById('dropArea');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const openCameraBtn = document.getElementById('openCameraBtn');
const scanButton = document.getElementById('scanButton');
const solveButton = document.getElementById('solveButton');
const previewPanel = document.getElementById('previewPanel');
const previewImage = document.getElementById('previewImage');
const previewText = document.getElementById('previewText');
const scanProgressWrap = document.getElementById('scanProgressWrap');
const scanProgressText = document.getElementById('scanProgressText');
const scanProgressFill = document.getElementById('scanProgressFill');
const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const captureBtn = document.getElementById('captureBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const profileName = document.getElementById('profileName');
const profileHint = document.getElementById('profileHint');
const converterInput = document.getElementById('converterInput');
const converterRun = document.getElementById('converterRun');
const converterResult = document.getElementById('converterResult');
const desmosGraph = document.getElementById('desmosGraph');
const equationInput = document.getElementById('equationInput');
const plotEquationBtn = document.getElementById('plotEquationBtn');
const toastMessage = document.getElementById('toastMessage');
const conversationsList = document.getElementById('conversationsList');
const newConversationBtn = document.getElementById('newConversationBtn');
const intentButtons = {
  default: document.getElementById('intentDefault'),
  easier: document.getElementById('intentEasier'),
  short: document.getElementById('intentShort'),
  similar: document.getElementById('intentSimilar'),
  translate: document.getElementById('intentTranslate')
};

const firebaseConfig = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_FIREBASE_AUTH_DOMAIN',
  projectId: 'YOUR_FIREBASE_PROJECT_ID',
  storageBucket: 'YOUR_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'YOUR_FIREBASE_APP_ID'
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let conversation = [];
let currentUser = null;
let latestImageFile = null;
let isScanning = false;
let selectedIntent = 'default';
let assistantCard = null;

marked.setOptions({
  breaks: true,
  highlight: code => hljs.highlightAuto(code).value
});

function showToast(message) {
  toastMessage.textContent = message;
  toastMessage.classList.add('show');
  setTimeout(() => toastMessage.classList.remove('show'), 2800);
}

function updateProfileUI(user) {
  if (user) {
    profileName.textContent = user.displayName || 'Homework student';
    profileHint.textContent = user.email || 'Signed in';
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
  } else {
    profileName.textContent = 'Guest user';
    profileHint.textContent = 'Sign in to sync solutions.';
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
  }
}

function loadConversation() {
  const saved = localStorage.getItem('homeworkAI_history');
  if (saved) {
    conversation = JSON.parse(saved);
  }
  renderMessages();
}

function saveConversation() {
  localStorage.setItem('homeworkAI_history', JSON.stringify(conversation));
}

function sanitizeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, '<br>');
}

function renderMessages() {
  chatFeed.innerHTML = '';

  if (!conversation.length) {
    chatFeed.innerHTML = `<div class="message-card">
      <div class="message-title"><span class="tag">Tip</span></div>
      <div class="message-text">Start by typing a question or upload an image. The AI will solve it step-by-step with math rendering.</div>
    </div>`;
    return;
  }

  conversation.forEach((entry, index) => {
    const card = document.createElement('div');
    card.className = `message-card ${entry.role}`;

    const title = document.createElement('div');
    title.className = 'message-title';
    title.innerHTML = `<span class="tag">${entry.role === 'user' ? 'You' : 'Homework AI'}</span>
      <button class="copy-btn" data-copy-index="${index}">Copy</button>`;

    const body = document.createElement('div');
    body.className = 'message-text';
    if (entry.role === 'assistant') {
      body.innerHTML = marked.parse(entry.content || '');
    } else {
      body.innerHTML = sanitizeHtml(entry.content);
    }

    card.append(title, body);
    chatFeed.appendChild(card);
  });

  activateCopyButtons();
  MathJax.typesetPromise();
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function activateCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(button => {
    button.removeEventListener('click', copyHandler);
    button.addEventListener('click', copyHandler);
  });
}

function copyHandler(event) {
  const index = Number(event.target.dataset.copyIndex);
  const text = conversation[index]?.content || '';
  navigator.clipboard.writeText(text.replace(/<[^>]+>/g, '')).then(() => {
    event.target.textContent = 'Copied';
    setTimeout(() => (event.target.textContent = 'Copy'), 1600);
  });
}

function addMessage(role, content) {
  conversation.push({ role, content });
  saveConversation();
  renderMessages();
}

function setLoading(isLoading, message = 'Solving your problem...') {
  spinnerOverlay.classList.toggle('hidden', !isLoading);
  typingStatus.textContent = isLoading ? message : 'AI is ready';
}

function appendStreamingAssistantCard() {
  assistantCard = document.createElement('div');
  assistantCard.className = 'message-card assistant';
  assistantCard.innerHTML = `<div class="message-title"><span class="tag">Homework AI</span></div>
    <div class="message-text">Preparing response...</div>`;
  chatFeed.appendChild(assistantCard);
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function updateAssistantCard(text) {
  if (!assistantCard) return;
  const body = assistantCard.querySelector('.message-text');
  body.innerHTML = marked.parse(text);
  MathJax.typesetPromise();
  chatFeed.scrollTop = chatFeed.scrollHeight;
}

function setIntent(intent) {
  selectedIntent = intent;
  Object.entries(intentButtons).forEach(([key, button]) => {
    button.classList.toggle('active', key === intent);
  });
}

function handleVoiceRead() {
  const latestResponse = [...conversation].reverse().find(msg => msg.role === 'assistant');
  if (!latestResponse) {
    showToast('No AI response available yet.');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(latestResponse.content.replace(/\$|\{|\}|\\/g, ''));
  utterance.lang = 'en-US';
  speechSynthesis.speak(utterance);
}

function parseConverterInput(input) {
  const m = input.match(/([0-9.]+)\s*([^\s]+)\s+to\s+([^\s]+)/i);
  if (!m) return null;
  return { value: Number(m[1]), source: m[2].toLowerCase(), target: m[3].toLowerCase() };
}

function convertUnits(value, source, target) {
  // Handle temperature explicitly
  const tempUnits = ['c', 'celsius', 'f', 'fahrenheit', 'k', 'kelvin'];
  if (tempUnits.includes(source) && tempUnits.includes(target)) {
    if (source.startsWith('f')) return fahrenheitTo(value, target);
    if (source.startsWith('k')) return kelvinTo(value, target);
    return celsiusTo(value, target);
  }

  const units = {
    // length
    m: 1,
    cm: 0.01,
    mm: 0.001,
    km: 1000,
    // mass
    g: 0.001,
    kg: 1,
    // time
    s: 1,
    ms: 0.001,
    min: 60,
    h: 3600,
    // speed
    'm/s': 1,
    'km/h': 1000 / 3600,
    'kmh': 1000 / 3600,
    // energy
    j: 1,
    kj: 1000,
    // force
    n: 1,
    kn: 1000,
    // pressure
    pa: 1,
    kpa: 1000,
    bar: 100000,
    atm: 101325
  };

  const sKey = source.replace(/\s+/g, '');
  const tKey = target.replace(/\s+/g, '');
  if (units[sKey] && units[tKey]) {
    return (value * units[sKey]) / units[tKey];
  }

  return null;

  function celsiusTo(v, to) {
    to = to[0];
    if (to === 'f') return (v * 9) / 5 + 32;
    if (to === 'k') return v + 273.15;
    return v;
  }

  function fahrenheitTo(v, to) {
    to = to[0];
    if (to === 'c') return ((v - 32) * 5) / 9;
    if (to === 'k') return ((v - 32) * 5) / 9 + 273.15;
    return v;
  }

  function kelvinTo(v, to) {
    to = to[0];
    if (to === 'c') return v - 273.15;
    if (to === 'f') return ((v - 273.15) * 9) / 5 + 32;
    return v;
  }
}

function initGraph() {
  if (!desmosGraph || typeof Desmos === 'undefined') return;
  try {
    const elt = desmosGraph;
    const calculator = Desmos.GraphingCalculator(elt, { expressions: true, keypad: false });
    // expose for debugging
    window.homeworkCalculator = calculator;

    function plotFromInput() {
      const expr = equationInput.value.trim();
      if (!expr) return;
      // try to set expression; Desmos accepts many plain math strings
      try {
        calculator.setExpression({ id: 'eq1', latex: expr });
      } catch (e) {
        // fallback: try as simple equation
        calculator.setExpression({ id: 'eq1', latex: expr.replace(/=/, '=') });
      }
    }

    plotEquationBtn?.addEventListener('click', plotFromInput);
    equationInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') plotFromInput();
    });

    // default example
    equationInput.value = 'y=sin(x)';
    plotFromInput();
  } catch (err) {
    console.warn('Desmos init failed', err);
  }
}

function updateTextareaHeight() {
  promptInput.style.height = 'auto';
  promptInput.style.height = `${promptInput.scrollHeight}px`;
}

async function sendPrompt(prompt, intent = selectedIntent) {
  if (!prompt.trim()) {
    showToast('Type a problem or upload an image first.');
    return;
  }

  addMessage('user', prompt);
  promptInput.value = '';
  updateTextareaHeight();
  setLoading(true, 'Generating answer...');

  appendStreamingAssistantCard();

  try {
    const response = await fetch(BACKEND_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, intent })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || 'Backend request failed.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const events = chunk.split(/\r?\n\r?\n/).filter(Boolean);

      for (const event of events) {
        const line = event.replace(/^data:\s*/, '');
        if (line === '[DONE]') {
          break;
        }
        if (line.startsWith('[ERROR]')) {
          throw new Error(line.replace('[ERROR] ', ''));
        }

        assistantText += line;
        updateAssistantCard(assistantText);
      }
    }

    if (assistantText.trim()) {
      addMessage('assistant', assistantText.trim());
    }
  } catch (error) {
    if (assistantCard) {
      assistantCard.querySelector('.message-text').textContent = `Error: ${error.message}`;
    }
    showToast(error.message);
  } finally {
    assistantCard = null;
    setLoading(false);
  }
}

async function preprocessImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxSize = 1200;
  const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');

  ctx.filter = 'contrast(1.2) saturate(1.05) brightness(1.02)';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // light unsharp mask / sharpening pass
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const copy = new Uint8ClampedArray(data);
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

    for (let y = 1; y < canvas.height - 1; y += 1) {
      for (let x = 1; x < canvas.width - 1; x += 1) {
        let total = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const offset = ((y + ky) * canvas.width + x + kx) * 4;
            const gray = (copy[offset] + copy[offset + 1] + copy[offset + 2]) / 3;
            total += gray * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * canvas.width + x) * 4;
        const sharpened = Math.min(255, Math.max(0, total));
        data[idx] = data[idx + 1] = data[idx + 2] = sharpened;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    // ignore imageData errors on some browsers
  }

  // Export as JPEG and progressively compress if too large
  let quality = 0.9;
  let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  const maxBytes = 900 * 1024; // ~900KB
  while (blob && blob.size > maxBytes && quality > 0.45) {
    quality -= 0.15;
    // eslint-disable-next-line no-await-in-loop
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  return blob;
}

async function processImage(file) {
  if (isScanning) return;
  isScanning = true;
  setLoading(true, 'Scanning homework image...');
  setScanProgress(0, 'Preparing OCR...');

  try {
    const preprocessed = await preprocessImage(file);
    latestImageFile = file;
    showPreviewImage(URL.createObjectURL(file), 'Enhancing image. OCR is running.');

    const result = await Tesseract.recognize(preprocessed, 'rus+eng', {
      logger: m => {
        if (m.status === 'recognizing text' && m.progress) {
          const percent = Math.min(100, Math.round(m.progress * 100));
          setScanProgress(percent, `Scanning: ${percent}%`);
        }
      }
    });
    let text = result.data.text.trim();
    // post-process OCR to improve handwritten/math detection
    text = postProcessOCR(text);
    dispatchImageToPrompt(text);
    if (text) {
      addMessage('assistant', `**OCR Detected:**\n\n${text}`);
      await sendPrompt(text);
    } else {
      addMessage('assistant', 'OCR could not detect text from the image. Please try a clearer photo.');
      showToast('No text detected. Try a sharper image.');
    }
  } catch (error) {
    showToast('OCR error: ' + error.message);
    addMessage('assistant', `**OCR Error:** ${error.message}`);
  } finally {
    setScanProgress(null);
    setLoading(false);
    isScanning = false;
  }
}

function postProcessOCR(raw) {
  if (!raw) return '';
  let t = raw;
  // Normalize common OCR unicode glitches
  t = t.replace(/[�‚]/g, '');
  // Replace common OCR confusion between 0/O, 1/l, 5/S in math contexts
  t = t.replace(/(?<=\d)O(?=\d)/g, '0');
  t = t.replace(/\bO\b/g, '0');
  // Fix common sqrt notations
  t = t.replace(/sqrt\s*\(?/gi, '√(');
  t = t.replace(/\broot\b/gi, '√');
  // Convert common fraction forms: '1/2' stays, but stacked fractions may come as '1\n---\n2'
  t = t.replace(/\n[-=]{2,}\n/g, '/');
  // Fix OCR spaced exponents like x 2 -> x^2 when pattern suggests
  t = t.replace(/([a-zA-Z0-9\)\]])\s+([0-9]{1,2})\b/g, (m, a, b) => `${a}^${b}`);
  // Normalize math arrows and dashes
  t = t.replace(/[−–—]/g, '-');
  // Try to merge broken lines where equations split over lines
  t = t.split('\n').map(l => l.trim()).filter(Boolean).join(' ');
  return t;
}

function showPreviewImage(src, caption) {
  if (!previewPanel) return;
  previewPanel.classList.remove('hidden');
  previewImage.src = src;
  previewText.textContent = caption;
}

function setScanProgress(percent, label) {
  if (!scanProgressWrap) return;
  if (percent === null) {
    scanProgressWrap.classList.add('hidden');
    return;
  }
  scanProgressWrap.classList.remove('hidden');
  scanProgressText.textContent = label;
  scanProgressFill.style.width = `${percent}%`;
}

function dispatchImageToPrompt(text) {
  promptInput.value = text.trim();
  previewText.textContent = text.trim() || 'No text detected from the image.';
  updateTextareaHeight();
}

function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Camera not available in this browser.');
    return;
  }
  cameraModal.classList.remove('hidden');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      cameraVideo.srcObject = stream;
      cameraVideo.play();
    })
    .catch(error => {
      showToast('Camera error: ' + error.message);
      cameraModal.classList.add('hidden');
    });
}

function closeCamera() {
  if (cameraVideo.srcObject) {
    const tracks = cameraVideo.srcObject.getTracks();
    tracks.forEach(track => track.stop());
  }
  cameraVideo.pause();
  cameraVideo.srcObject = null;
  cameraModal.classList.add('hidden');
}

function captureCameraImage() {
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    showToast('Camera is not ready yet.');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = cameraVideo.videoWidth;
  canvas.height = cameraVideo.videoHeight;
  canvas.getContext('2d').drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    if (blob) {
      latestImageFile = blob;
      showPreviewImage(URL.createObjectURL(blob), 'Captured image ready. Tap Scan Homework to extract the text.');
      closeCamera();
    }
  }, 'image/jpeg', 0.92);
}

function saveConversationToCloud() {
  if (!currentUser) {
    showToast('Sign in first to save conversations to the cloud.');
    return;
  }
  const ref = db.collection('users').doc(currentUser.uid).collection('conversations');
  ref.add({
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    content: conversation,
    userName: currentUser.displayName || currentUser.email || 'Student'
  })
    .then(() => {
      showToast('Conversation saved to your Firebase profile.');
      loadConversationsFromFirebase();
    })
    .catch(error => showToast('Cloud save error: ' + error.message));
}

async function loadConversationsFromFirebase() {
  if (!currentUser || !conversationsList) return;
  conversationsList.innerHTML = '<p class="small-text">Loading...</p>';
  try {
    const snapshot = await db.collection('users')
      .doc(currentUser.uid)
      .collection('conversations')
      .orderBy('createdAt', 'desc')
      .get();

    if (snapshot.empty) {
      conversationsList.innerHTML = '<p class="small-text">No saved conversations yet.</p>';
      return;
    }

    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      items.push({ id: doc.id, ...data });
    });

    renderConversationsList(items);
  } catch (err) {
    conversationsList.innerHTML = '<p class="small-text">Could not load conversations.</p>';
    console.warn('Load conv error', err);
  }
}

function renderConversationsList(items) {
  conversationsList.innerHTML = '';
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'conversation-item';
    const date = item.createdAt && item.createdAt.toDate ? item.createdAt.toDate() : new Date();
    el.innerHTML = `<div class="conv-main" data-docid="${item.id}">
        <strong>${item.userName || 'You'}</strong>
        <div class="small-text">${date.toLocaleString()}</div>
      </div>
      <div class="conv-actions">
        <button class="open-conv ghost-btn" data-docid="${item.id}">Open</button>
        <button class="delete-conv ghost-btn" data-docid="${item.id}">Delete</button>
      </div>`;
    conversationsList.appendChild(el);
  });
}

function openConversationById(docId) {
  if (!currentUser) return;
  setLoading(true, 'Loading conversation...');
  db.collection('users').doc(currentUser.uid).collection('conversations').doc(docId).get()
    .then(doc => {
      if (!doc.exists) throw new Error('Conversation not found');
      const data = doc.data();
      conversation = data.content || [];
      saveConversation();
      renderMessages();
    })
    .catch(err => showToast('Open conversation error: ' + err.message))
    .finally(() => setLoading(false));
}

function deleteConversationById(docId) {
  if (!currentUser) return;
  if (!confirm('Delete this conversation? This action cannot be undone.')) return;
  db.collection('users').doc(currentUser.uid).collection('conversations').doc(docId).delete()
    .then(() => {
      showToast('Conversation deleted');
      loadConversationsFromFirebase();
    })
    .catch(err => showToast('Delete error: ' + err.message));
}

function initIntentButtons() {
  Object.entries(intentButtons).forEach(([intent, button]) => {
    button.addEventListener('click', () => setIntent(intent));
  });
}

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(error => showToast(error.message));
}

function signOutUser() {
  auth.signOut().catch(error => showToast(error.message));
}

auth.onAuthStateChanged(user => {
  currentUser = user;
  updateProfileUI(user);
  if (user) {
    loadConversationsFromFirebase();
  } else if (conversationsList) {
    conversationsList.innerHTML = '<p class="small-text">Sign in to view saved conversations.</p>';
  }
});

submitBtn.addEventListener('click', () => sendPrompt(promptInput.value));
clearHistoryBtn.addEventListener('click', () => {
  conversation = [];
  saveConversation();
  renderMessages();
});
promptInput.addEventListener('input', updateTextareaHeight);
promptInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendPrompt(promptInput.value);
  }
});

uploadPhotoBtn.addEventListener('click', () => fileInput.click());
openCameraBtn.addEventListener('click', openCamera);
scanButton.addEventListener('click', () => {
  if (latestImageFile) {
    processImage(latestImageFile);
  } else if (fileInput.files[0]) {
    processImage(fileInput.files[0]);
  } else {
    showToast('Upload or capture an image before scanning.');
  }
});
solveButton.addEventListener('click', () => sendPrompt(promptInput.value));

captureBtn.addEventListener('click', captureCameraImage);
closeCameraBtn.addEventListener('click', closeCamera);
loginBtn.addEventListener('click', signInWithGoogle);
logoutBtn.addEventListener('click', signOutUser);

saveButton.addEventListener('click', saveConversationToCloud);
// Conversation list delegation
conversationsList?.addEventListener('click', e => {
  const openBtn = e.target.closest('.open-conv');
  const delBtn = e.target.closest('.delete-conv');
  if (openBtn) {
    const id = openBtn.dataset.docid;
    openConversationById(id);
  }
  if (delBtn) {
    const id = delBtn.dataset.docid;
    deleteConversationById(id);
  }
});

newConversationBtn?.addEventListener('click', () => {
  if (!confirm('Start a new conversation? This will clear current conversation locally.')) return;
  conversation = [];
  saveConversation();
  renderMessages();
});
converterRun.addEventListener('click', () => {
  const parsed = parseConverterInput(converterInput.value);
  if (!parsed) {
    converterResult.textContent = 'Enter a value like "5 km to m".';
    return;
  }
  const converted = convertUnits(parsed.value, parsed.source, parsed.target);
  if (converted === null) {
    converterResult.textContent = 'Unit conversion not supported yet.';
    return;
  }
  converterResult.textContent = `${parsed.value} ${parsed.source} = ${converted} ${parsed.target}`;
});

dropArea.addEventListener('click', () => fileInput.click());
dropArea.addEventListener('dragover', event => {
  event.preventDefault();
  dropArea.classList.add('dragover');
});
dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('dragover');
});
dropArea.addEventListener('drop', event => {
  event.preventDefault();
  dropArea.classList.remove('dragover');
  const file = event.dataTransfer.files[0];
  if (file) {
    latestImageFile = file;
    const reader = new FileReader();
    reader.onload = () => showPreviewImage(reader.result, 'Image dropped. Tap Scan Homework to extract the text.');
    reader.readAsDataURL(file);
  }
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      console.warn('Service worker registration failed');
    });
  }
}

window.addEventListener('load', () => {
  initIntentButtons();
  loadConversation();
  updateTextareaHeight();
  initGraph();
  initMobileHandlers();
  registerServiceWorker();
});

function initMobileHandlers() {
  // Ensure textarea stays visible when mobile keyboard opens
  const composer = document.querySelector('.composer');
  if (!composer) return;

  function adjust() {
    const vp = window.visualViewport;
    if (!vp) return;
    const kbHeight = Math.max(0, window.innerHeight - vp.height - vp.offsetTop);
    composer.style.paddingBottom = `${kbHeight + 12}px`;
    if (kbHeight > 100) document.body.classList.add('keyboard-open');
    else document.body.classList.remove('keyboard-open');
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adjust);
    window.visualViewport.addEventListener('scroll', adjust);
  }

  // mobile-friendly textarea attributes
  promptInput.setAttribute('inputmode', 'text');
  promptInput.setAttribute('enterkeyhint', 'send');

  // make sure focus scrolls composer into view
  promptInput.addEventListener('focus', () => setTimeout(() => composer.scrollIntoView({ behavior: 'smooth', block: 'end' }), 200));
}

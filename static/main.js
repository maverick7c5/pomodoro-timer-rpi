// === DOM Elements ===
const timerDisplay = document.getElementById('timerDisplay');
const pomodoroCount = document.getElementById('pomodoroCount');
const body = document.body;
const settingsPanel = document.getElementById('settingsPanel');
const backgroundForm = document.getElementById('backgroundForm');
const backgroundInput = document.getElementById('backgroundInput');
const uploadBtn = document.getElementById('uploadBtn');
const browseBtn = document.getElementById('browseBtn');
const settingsToggle = document.getElementById('settingsToggle');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const pomodoroBtn = document.getElementById('pomodoroBtn');
const shortBreakBtn = document.getElementById('shortBreakBtn');
const longBreakBtn = document.getElementById('longBreakBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const closeAppBtn = document.getElementById('closeAppBtn');
const spotifyButton = document.getElementById('spotifyButton');

const pomodoroStartSound = document.getElementById('pomodoroStartSound');
const shortBreakStartSound = document.getElementById('shortBreakStartSound');
const longBreakStartSound = document.getElementById('longBreakStartSound');
const timerStartSound = document.getElementById('timerStartSound');

// === State ===
let currentMode = 'pomodoro';
let lastUpdateTime = 0;
let animationFrameId;
let completedPomodoros = 0;
let lastMode = null;
let isFirstUpdate = true;
let volume = 0.1;

// === Functions ===
function playSound(sound) {
  sound.volume = volume;
  sound.currentTime = 0;
  sound.play().catch(console.error);
}

function updateActiveButton(mode) {
  [pomodoroBtn, shortBreakBtn, longBreakBtn].forEach(btn => btn.classList.remove('active'));
  if (mode === 'pomodoro') pomodoroBtn.classList.add('active');
  if (mode === 'short_break') shortBreakBtn.classList.add('active');
  if (mode === 'long_break') longBreakBtn.classList.add('active');
}

function updatePomodoroCount(count) {
  pomodoroCount.innerHTML = '';
  const totalCycles = Math.ceil(count / 4);
  for (let cycle = 0; cycle < totalCycles; cycle++) {
    const cycleContainer = document.createElement('div');
    cycleContainer.className = 'pomodoro-cycle';
    const sessionsInCycle = Math.min(4, count - (cycle * 4));
    for (let i = 0; i < sessionsInCycle; i++) {
      const icon = document.createElement('i');
      icon.className = 'fas fa-check-circle pomodoro-icon';
      cycleContainer.appendChild(icon);
    }
    pomodoroCount.appendChild(cycleContainer);
  }
}

function updateDisplay(seconds, mode, count, bgImage) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  if (mode !== currentMode || isFirstUpdate) {
    if (!isFirstUpdate && currentMode) {
      if (currentMode === 'pomodoro') playSound(pomodoroStartSound);
      if (currentMode === 'short_break') playSound(shortBreakStartSound);
      if (currentMode === 'long_break') playSound(longBreakStartSound);
    }
    lastMode = currentMode;
    currentMode = mode;
    updateActiveButton(mode);
    body.className = `${mode.replace('_', '-')}-mode`;
    isFirstUpdate = false;
  }

  updatePomodoroCount(count);

  body.style.backgroundImage = bgImage
    ? `url('/static/uploads/${bgImage}')`
    : "url('/static/default_backgrounds/default_bg.jpg')";
}

async function fetchStatus() {
  try {
    const response = await fetch('/status');
    if (!response.ok) throw new Error('Network error');
    const data = await response.json();
    completedPomodoros = data.pomodoro_count;
    updateDisplay(data.remaining_time, data.current_mode, completedPomodoros, data.background_image);
  } catch (error) {
    console.error('Error fetching status:', error);
  }
}

function smoothUpdate() {
  const now = Date.now();
  if (now - lastUpdateTime >= 1000) {
    fetchStatus();
    lastUpdateTime = now;
  }
  animationFrameId = requestAnimationFrame(smoothUpdate);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
  } else {
    document.exitFullscreen();
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
  }
}

function closeApp() {
  if (window.confirm('Czy na pewno chcesz zamknąć aplikację?')) {
    window.close();
  }
}

// === Event Listeners ===
startBtn.onclick = async () => {
  try {
    timerStartSound.volume = volume;
    await timerStartSound.play();
    timerStartSound.pause();
  } catch {}
  const res = await fetch('/start');
  if (res.ok) playSound(timerStartSound);
};

pauseBtn.onclick = () => fetch('/pause').catch(console.error);
resetBtn.onclick = () => fetch('/reset').catch(console.error);

pomodoroBtn.onclick = async () => {
  const status = await fetch('/status').then(res => res.json());
  if (['short_break', 'long_break'].includes(status.current_mode)) {
    await fetch('/switch_to_pomodoro', { method: 'POST' });
    await fetch('/start', { method: 'POST' });
    fetchStatus();
  }
};

shortBreakBtn.onclick = () => fetch('/switch_to_short_break', { method: 'POST' }).then(fetchStatus);
longBreakBtn.onclick = () => fetch('/switch_to_long_break', { method: 'POST' }).then(fetchStatus);

settingsToggle.onclick = () => {
  settingsPanel.style.display = (settingsPanel.style.display === 'flex') ? 'none' : 'flex';
  document.querySelector('.timer-container').classList.toggle('expanded');
};

browseBtn.onclick = () => backgroundInput.click();

backgroundForm.onsubmit = async (e) => {
  e.preventDefault();
  const file = backgroundInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('background', file);

  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    const response = await fetch('/upload', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Upload failed');

    fetchStatus();
  } catch (error) {
    console.error(error.message);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload';
  }
};

fullscreenBtn.addEventListener('click', toggleFullscreen);
closeAppBtn.addEventListener('click', closeApp);

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const savedVolume = localStorage.getItem('pomodoroVolume');
  if (savedVolume) {
    volume = parseFloat(savedVolume);
  }
  smoothUpdate();
  fetchStatus();
});

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(animationFrameId);
});

spotifyButton.onclick = () => {
  window.open('https://open.spotify.com/playlist/0Ec6DatLDguXsx4UDntZbw', '_blank');
};

document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll("button, a, input[type='submit']").forEach(element => {
      element.addEventListener("click", function() {
          this.blur();
          document.body.classList.add('no-cursor');
      });
  });
});

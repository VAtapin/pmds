'use strict';

const scenes = Array.from(document.querySelectorAll('.scene'));
const sceneLabel = document.querySelector('#sceneLabel');
const sceneNumber = document.querySelector('#sceneNumber');
const progressBar = document.querySelector('#progressBar');
const previousButton = document.querySelector('#previousButton');
const nextButton = document.querySelector('#nextButton');
const cueButton = document.querySelector('#cueButton');
const teacherPanel = document.querySelector('#teacherPanel');
const teacherPanelContent = document.querySelector('#teacherPanelContent');
const closeTeacherPanel = document.querySelector('#closeTeacherPanel');
const lessonStage = document.querySelector('#lessonStage');
const toast = document.querySelector('#toast');

let currentScene = 0;
let toastTimeout;

function showToast(message) {
  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.hidden = false;
  toastTimeout = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function closeTeacherCue() {
  teacherPanel.hidden = true;
  cueButton.setAttribute('aria-expanded', 'false');
}

function setScene(index) {
  const nextIndex = Math.max(0, Math.min(index, scenes.length - 1));
  currentScene = nextIndex;

  scenes.forEach((scene, sceneIndex) => {
    const isCurrent = sceneIndex === currentScene;
    scene.classList.toggle('is-active', isCurrent);
    scene.setAttribute('aria-hidden', String(!isCurrent));
  });

  const scene = scenes[currentScene];
  sceneLabel.textContent = scene.dataset.title;
  sceneNumber.textContent = String(currentScene + 1);
  progressBar.style.width = `${((currentScene + 1) / scenes.length) * 100}%`;
  previousButton.disabled = currentScene === 0;
  nextButton.disabled = currentScene === scenes.length - 1;
  nextButton.querySelector('span:first-child').textContent = currentScene === scenes.length - 2 ? 'К итогу' : 'Далее';
  lessonStage.scrollTop = 0;
  scene.scrollTop = 0;
  closeTeacherCue();

  const defaultSeconds = Number(scene.dataset.defaultSeconds || 60);
  setTimer(defaultSeconds, false);
  window.history.replaceState(null, '', `#${currentScene + 1}`);
}

previousButton.addEventListener('click', () => setScene(currentScene - 1));
nextButton.addEventListener('click', () => setScene(currentScene + 1));
document.querySelectorAll('[data-next]').forEach((button) => {
  button.addEventListener('click', () => setScene(currentScene + 1));
});

cueButton.addEventListener('click', () => {
  const willOpen = teacherPanel.hidden;
  if (willOpen) {
    const cue = scenes[currentScene].querySelector('.scene__cue');
    teacherPanelContent.innerHTML = cue ? cue.innerHTML : '<p>Подсказка для этого этапа не добавлена.</p>';
  }
  teacherPanel.hidden = !willOpen;
  cueButton.setAttribute('aria-expanded', String(willOpen));
});

closeTeacherPanel.addEventListener('click', closeTeacherCue);

document.addEventListener('keydown', (event) => {
  const activeTag = document.activeElement?.tagName;
  const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA';
  if (isTyping) return;

  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault();
    setScene(currentScene + 1);
  }
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault();
    setScene(currentScene - 1);
  }
  if (event.key === 'Home') {
    event.preventDefault();
    setScene(0);
  }
  if (event.key === 'End') {
    event.preventDefault();
    setScene(scenes.length - 1);
  }
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    toggleFullscreen();
  }
});

// Fullscreen presentation mode
const fullscreenButton = document.querySelector('#fullscreenButton');

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    showToast('Полный экран недоступен в этом браузере');
  }
}

fullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const isFullscreen = Boolean(document.fullscreenElement);
  fullscreenButton.setAttribute('aria-label', isFullscreen ? 'Выйти из полноэкранного режима' : 'Открыть на весь экран');
  fullscreenButton.title = isFullscreen ? 'Выйти из полного экрана (F)' : 'На весь экран (F)';
});

// Classroom timer
const timerButton = document.querySelector('#timerButton');
const timerPanel = document.querySelector('#timerPanel');
const timerDisplay = document.querySelector('#timerDisplay');
const timerToggle = document.querySelector('#timerToggle');
const timerReset = document.querySelector('#timerReset');
let timerSeconds = 300;
let timerInitial = 300;
let timerInterval = null;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function paintTimer() {
  timerDisplay.textContent = formatTime(timerSeconds);
  timerButton.classList.toggle('is-ending', timerSeconds <= 10 && timerSeconds > 0 && Boolean(timerInterval));
}

function stopTimer() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  timerToggle.textContent = timerSeconds === 0 ? 'Сначала' : 'Старт';
  timerButton.classList.remove('is-ending');
}

function setTimer(seconds, startImmediately = false) {
  stopTimer();
  timerSeconds = seconds;
  timerInitial = seconds;
  paintTimer();
  if (startImmediately) startTimer();
}

function playTimerTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 680;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.55);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.6);
  } catch {
    // The visual timer still works when browser audio is unavailable.
  }
}

function startTimer() {
  if (timerInterval) {
    stopTimer();
    timerToggle.textContent = 'Продолжить';
    return;
  }
  if (timerSeconds === 0) timerSeconds = timerInitial;
  timerToggle.textContent = 'Пауза';
  timerInterval = window.setInterval(() => {
    timerSeconds -= 1;
    paintTimer();
    if (timerSeconds <= 0) {
      stopTimer();
      playTimerTone();
      showToast('Время обсуждения закончилось');
    }
  }, 1000);
}

timerButton.addEventListener('click', () => {
  const willOpen = timerPanel.hidden;
  timerPanel.hidden = !willOpen;
  timerButton.setAttribute('aria-expanded', String(willOpen));
});

timerToggle.addEventListener('click', startTimer);
timerReset.addEventListener('click', () => setTimer(timerInitial, false));
document.querySelectorAll('[data-seconds]').forEach((button) => {
  button.addEventListener('click', () => setTimer(Number(button.dataset.seconds), false));
});

document.querySelectorAll('.start-minute').forEach((button) => {
  button.addEventListener('click', () => {
    setTimer(60, true);
    timerPanel.hidden = true;
    timerButton.setAttribute('aria-expanded', 'false');
    showToast('У пары есть 1 минута');
  });
});

// Role reveal for the classroom dramatization
const roles = ['Путешественник', 'Разбойник 1', 'Разбойник 2', 'Священник', 'Левит', 'Самарянин'];
const revealRoleButton = document.querySelector('#revealRole');
const currentRole = document.querySelector('#currentRole');
const roleList = document.querySelector('#roleList');
let roleIndex = 0;

revealRoleButton.addEventListener('click', () => {
  if (roleIndex >= roles.length) {
    roleIndex = 0;
    roleList.replaceChildren();
    currentRole.textContent = 'Начинаем новый набор ролей';
    revealRoleButton.textContent = 'Первая роль';
    return;
  }

  const role = roles[roleIndex];
  currentRole.textContent = role;
  const chip = document.createElement('span');
  chip.textContent = role;
  roleList.append(chip);
  roleIndex += 1;
  revealRoleButton.textContent = roleIndex === roles.length ? 'Сбросить роли' : 'Следующая роль';
});

// Excuses contributed by the class
const excuses = [];
const excuseBoard = document.querySelector('#excuseBoard');
const discussionFollowup = document.querySelector('#discussionFollowup');

function renderExcuses() {
  document.querySelectorAll('[data-excuse-preview]').forEach((preview) => {
    const character = preview.dataset.excusePreview;
    preview.replaceChildren();
    excuses.filter((item) => item.character === character).forEach((item) => {
      const chip = document.createElement('span');
      chip.textContent = item.text;
      preview.append(chip);
    });
  });

  excuseBoard.replaceChildren();
  if (excuses.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Здесь появятся объяснения священника и левита.';
    excuseBoard.append(empty);
    return;
  }

  excuses.forEach((item) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'excuse-chip';
    chip.setAttribute('aria-pressed', 'false');
    chip.textContent = `«${item.text}»`;
    chip.addEventListener('click', () => {
      const pressed = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!pressed));
      discussionFollowup.textContent = pressed
        ? 'Мог ли самарянин найти себе такое же оправдание?'
        : `Что всё-таки мог сделать ${item.character.toLowerCase()}?`;
    });
    excuseBoard.append(chip);
  });
}

document.querySelectorAll('.excuse-form').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = form.elements.excuse;
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    excuses.push({ character: form.dataset.character, text });
    input.value = '';
    renderExcuses();
    showToast('Ответ добавлен на доску обсуждения');
  });
});

document.querySelectorAll('.reveal-trigger').forEach((button) => {
  button.addEventListener('click', () => {
    const answer = button.nextElementSibling;
    const willOpen = answer.hidden;
    answer.hidden = !willOpen;
    button.setAttribute('aria-expanded', String(willOpen));
    button.textContent = willOpen ? 'Скрыть поступок героя' : 'Открыть поступок героя';
  });
});

// Five-step road sequence
const sequenceSteps = [
  { label: 'Увидел', icon: '◉' },
  { label: 'Подошёл', icon: '●' },
  { label: 'Помог', icon: '+' },
  { label: 'Привёз', icon: '⌂' },
  { label: 'Позаботился дальше', icon: '∞' }
];
const sequencePool = document.querySelector('#sequencePool');
const roadStepElements = Array.from(document.querySelectorAll('#roadSteps li'));
const sequenceResult = document.querySelector('#sequenceResult');
const resetSequence = document.querySelector('#resetSequence');
let nextSequenceIndex = 0;

function shuffledIndexes() {
  const values = sequenceSteps.map((_, index) => index);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }
  return values;
}

function buildSequence() {
  nextSequenceIndex = 0;
  sequencePool.replaceChildren();
  sequenceResult.textContent = 'Первый шаг начинается с внимания.';
  roadStepElements.forEach((item, index) => {
    item.classList.remove('is-filled');
    item.querySelector('strong').textContent = '…';
    item.querySelector('span').textContent = String(index + 1);
  });

  shuffledIndexes().forEach((stepIndex) => {
    const step = sequenceSteps[stepIndex];
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.step = String(stepIndex);
    button.dataset.icon = step.icon;
    button.textContent = step.label;
    button.addEventListener('click', () => chooseSequenceStep(button, stepIndex));
    sequencePool.append(button);
  });
}

function chooseSequenceStep(button, stepIndex) {
  if (stepIndex !== nextSequenceIndex) {
    button.classList.remove('is-wrong');
    window.requestAnimationFrame(() => button.classList.add('is-wrong'));
    sequenceResult.textContent = nextSequenceIndex === 0
      ? 'С чего начинается помощь? Сначала нужно заметить человека.'
      : 'Этот поступок будет позже. Что сделал самарянин перед ним?';
    return;
  }

  button.disabled = true;
  button.classList.remove('is-wrong');
  const roadStep = roadStepElements[nextSequenceIndex];
  roadStep.classList.add('is-filled');
  roadStep.querySelector('span').textContent = sequenceSteps[nextSequenceIndex].icon;
  roadStep.querySelector('strong').textContent = sequenceSteps[nextSequenceIndex].label;
  nextSequenceIndex += 1;

  if (nextSequenceIndex === sequenceSteps.length) {
    sequenceResult.textContent = 'Помощь продолжилась даже после отъезда самарянина.';
    showToast('Путь помощи собран');
  } else {
    sequenceResult.textContent = `Верно. Теперь шаг ${nextSequenceIndex + 1}.`;
  }
}

resetSequence.addEventListener('click', buildSequence);
buildSequence();

// Choosing who became a neighbor
const choiceFeedback = document.querySelector('#choiceFeedback');
const finalQuote = document.querySelector('#finalQuote');
document.querySelectorAll('[data-person]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-person]').forEach((candidate) => {
      candidate.classList.remove('is-correct', 'is-incorrect');
    });

    if (button.dataset.person === 'samaritan') {
      button.classList.add('is-correct');
      choiceFeedback.textContent = 'Самарянин стал ближним, потому что проявил милосердие делом.';
      finalQuote.hidden = false;
    } else {
      button.classList.add('is-incorrect');
      choiceFeedback.textContent = 'Он увидел пострадавшего, но прошёл мимо. Кто остановился и помог?';
      finalQuote.hidden = true;
    }
  });
});

// School situation prompts
const scenarioCopy = {
  newcomer: {
    excuse: ['Оправдание бездействия', 'Как можно убедить себя, что подходить не нужно? Почему это объяснение не решает проблему?'],
    help: ['Конкретная помощь', 'Назовите первые слова, с которыми можно подойти. Что можно предложить сделать вместе?']
  },
  books: {
    excuse: ['Оправдание бездействия', 'Какая удобная причина позволит пройти мимо? Действительно ли она мешает остановиться?'],
    help: ['Конкретная помощь', 'Как подойти, что спросить и чем помочь прямо сейчас?']
  },
  game: {
    excuse: ['Оправдание бездействия', 'Почему можно решить, что это «не моё дело»? Что изменится, если все подумают так же?'],
    help: ['Конкретная помощь', 'Что сказать участникам игры и самому однокласснику, чтобы включить его без ссоры?']
  }
};

document.querySelectorAll('[data-scenario]').forEach((scene) => {
  const response = scene.querySelector('.scenario-response');
  const title = response.querySelector('strong');
  const text = response.querySelector('p');
  scene.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      scene.querySelectorAll('[data-mode]').forEach((candidate) => candidate.classList.remove('is-selected'));
      button.classList.add('is-selected');
      const [heading, prompt] = scenarioCopy[scene.dataset.scenario][button.dataset.mode];
      title.textContent = heading;
      text.textContent = prompt;
      response.hidden = false;
    });
  });
});

// Personal commitments for the final scene
const promiseForm = document.querySelector('#promiseForm');
const promiseRoad = document.querySelector('#promiseRoad');
let promiseCount = 0;

promiseForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = promiseForm.elements.promise;
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  if (promiseCount === 0) promiseRoad.replaceChildren();
  const note = document.createElement('span');
  note.className = 'promise-note';
  note.textContent = text;
  note.style.setProperty('--note-tilt', `${promiseCount % 2 === 0 ? -2 : 2}deg`);
  promiseRoad.append(note);
  promiseCount += 1;
  input.value = '';
  showToast('Поступок добавлен на общий путь');

  if (promiseCount >= 8) {
    const oldest = promiseRoad.querySelector('.promise-note');
    oldest?.remove();
    promiseCount = promiseRoad.querySelectorAll('.promise-note').length;
  }
});

// Close floating panels when clicking elsewhere
document.addEventListener('click', (event) => {
  if (!timerPanel.hidden && !timerPanel.contains(event.target) && !timerButton.contains(event.target)) {
    timerPanel.hidden = true;
    timerButton.setAttribute('aria-expanded', 'false');
  }
});

const initialHash = Number(window.location.hash.replace('#', ''));
setScene(Number.isInteger(initialHash) && initialHash >= 1 && initialHash <= scenes.length ? initialHash - 1 : 0);

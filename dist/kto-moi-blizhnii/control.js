'use strict';

(() => {
  const params = new URLSearchParams(window.location.search);
  const room = (params.get('room') || '').toUpperCase();
  const teacherKey = room ? localStorage.getItem(`neighborTeacher:${room}`) || '' : '';
  const apiUrl = 'sync.php';
  const titles = [
    'Кто мой ближний?', 'Человек на дороге', 'Священник', 'Левит', 'Самарянин',
    'Что мешает помочь?', 'Путь помощи', 'Кто оказался ближним?', 'Новенький на перемене',
    'Рассыпавшиеся книги', 'Не берут в игру', 'Кому я могу помочь?', 'Итог урока'
  ];
  const labels = {
    ready: 'Готовность', role: 'Роль', excuse: 'Оправдание героя', motive: 'Мотив самарянина',
    barrier: 'Что мешает помочь', sequence_order: 'Путь помощи', neighbor: 'Кто стал ближним',
    school_help: 'Школьная ситуация', promise: 'Личное решение', takeaway: 'Итог урока'
  };
  const correctAnswers = { 4: 'Сострадание', 7: 'Самарянин' };

  const byId = (id) => document.getElementById(id);
  const roomCode = byId('roomCode');
  const roomCodeLarge = byId('roomCodeLarge');
  const dialogRoomCode = byId('dialogRoomCode');
  const sceneNumber = byId('sceneNumber');
  const sceneTitle = byId('sceneTitle');
  const previousScene = byId('previousScene');
  const nextScene = byId('nextScene');
  const sequenceCheck = byId('sequenceCheck');
  const correctAnswer = byId('correctAnswer');
  const studentUrl = byId('studentUrl');
  const presentationLink = byId('presentationLink');
  const studentCount = byId('studentCount');
  const answerCount = byId('answerCount');
  const kindnessCount = byId('kindnessCount');
  const pendingCount = byId('pendingCount');
  const moderationList = byId('moderationList');
  const broadcastForm = byId('broadcastForm');
  const broadcastInput = byId('broadcastInput');
  const qrDialog = byId('qrDialog');
  const toast = byId('toast');
  let state = null;
  let revision = 0;
  let updating = false;
  let toastTimer = 0;

  function showToast(text) {
    window.clearTimeout(toastTimer);
    toast.textContent = text;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2400);
  }

  async function api(payload = null) {
    const url = new URL(apiUrl, window.location.href);
    if (!payload) {
      url.searchParams.set('room', room);
      url.searchParams.set('teacherKey', teacherKey);
    }
    const response = await fetch(url, payload ? {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    } : { method: 'GET' });
    const data = await response.json().catch(() => ({ ok: false, error: 'Некорректный ответ сервера' }));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось подключиться');
    return data;
  }

  function renderScene() {
    const index = Math.max(0, Math.min(titles.length - 1, Number(state?.scene) || 0));
    sceneNumber.textContent = `${index + 1} / ${titles.length}`;
    sceneTitle.textContent = titles[index];
    previousScene.disabled = index === 0;
    nextScene.textContent = index === titles.length - 1 ? 'Завершить урок' : index === titles.length - 2 ? 'К итогу ›' : 'Далее ›';
    sequenceCheck.hidden = index !== 6;
    sequenceCheck.disabled = Boolean(state?.sequenceReview);
    sequenceCheck.textContent = state?.sequenceReview ? 'Общая проверка идёт' : 'Проверить пути учеников вместе';
    const correctLabel = correctAnswers[index];
    const answerRevealed = Boolean(state?.correctReveals?.[index]);
    correctAnswer.hidden = !correctLabel;
    correctAnswer.disabled = answerRevealed;
    correctAnswer.textContent = answerRevealed
      ? `Правильный ответ показан: «${correctLabel}»`
      : `Показать правильный ответ: «${correctLabel}»`;
  }

  function responseText(item) {
    return item.text || item.value || 'Ответ отправлен';
  }

  function answerCard(post, response) {
    const card = document.createElement('article');
    const isQuestion = response.type === 'ready' && response.value === 'question';
    card.className = `answer-card${post?.status === 'approved' ? ' is-approved' : ''}${isQuestion ? ' is-question' : ''}`;
    const avatar = document.createElement('span');
    avatar.className = 'answer-avatar';
    avatar.textContent = (post?.name || response.name || 'У').slice(0, 1).toUpperCase();
    const copy = document.createElement('div');
    copy.className = 'answer-copy';
    const header = document.createElement('header');
    const name = document.createElement('strong');
    name.textContent = post?.name || response.name;
    const meta = document.createElement('small');
    meta.textContent = `${labels[post?.type || response.type] || 'Ответ'} · этап ${(post?.scene ?? response.scene) + 1}`;
    header.append(name, meta);
    const text = document.createElement('p');
    text.textContent = isQuestion ? 'Есть вопрос — ожидает ответа учителя' : post?.text || responseText(response);
    copy.append(header, text);
    if (isQuestion) {
      const actions = document.createElement('div');
      actions.className = 'answer-actions question-actions';
      actions.append(questionButton('✓ Вопрос закрыт', 'closed', 'approve'));
      actions.append(questionButton('↗ Сейчас подойду', 'coming', 'warm'));
      actions.append(questionButton('Окей', 'ok'));
      copy.append(actions);
    } else if (post) {
      const actions = document.createElement('div');
      actions.className = 'answer-actions';
      if (post.status !== 'approved') actions.append(actionButton('✓ Показать всем', 'approve', 'approve'));
      actions.append(actionButton('✎ Исправить', 'edit'));
      actions.append(actionButton('↩ Ответить', 'reply'));
      actions.append(actionButton(post.status === 'approved' ? 'Удалить с экрана' : '× Отклонить', 'delete', 'reject'));
      copy.append(actions);
    }
    card.append(avatar, copy);
    return card;

    function actionButton(textValue, operation, className = '') {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = textValue;
      button.className = className;
      button.addEventListener('click', () => moderate(post, operation));
      return button;
    }

    function questionButton(textValue, resolution, className = '') {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = textValue;
      button.className = className;
      button.addEventListener('click', () => resolveQuestion(response, resolution));
      return button;
    }
  }

  function renderData(data) {
    const students = Array.isArray(data.students) ? data.students : [];
    const responses = Array.isArray(data.responses) ? data.responses : [];
    const posts = Array.isArray(data.state?.studentPosts) ? data.state.studentPosts : [];
    const postsById = new Map(posts.map((post) => [post.id, post]));
    studentCount.textContent = String(data.connectedCount || 0);
    answerCount.textContent = String(responses.length);
    kindnessCount.textContent = String(students.reduce((sum, student) => sum + (Number(student.score) || 0), 0));
    const questions = responses.filter((response) => response.type === 'ready' && response.value === 'question');
    pendingCount.textContent = `${posts.filter((post) => post.status === 'pending').length + questions.length} ждут`;
    moderationList.replaceChildren();
    if (!responses.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Новые ответы появятся здесь.';
      moderationList.append(empty);
      return;
    }
    responses.slice(0, 80).forEach((response) => moderationList.append(answerCard(postsById.get(response.id), response)));
  }

  async function updateState(patch) {
    if (!state || updating) return;
    updating = true;
    state = { ...state, ...patch };
    renderScene();
    try {
      const data = await api({ action: 'update', room, teacherKey, state });
      revision = Number(data.revision) || revision;
      state = data.state;
      renderData(data);
    } catch (error) {
      showToast(error.message);
    } finally {
      updating = false;
    }
  }

  async function moderate(post, operation) {
    let text = post.text;
    let message = '';
    if (operation === 'edit') {
      text = window.prompt('Исправьте ответ перед публикацией:', post.text)?.trim();
      if (!text || text === post.text) return;
    }
    if (operation === 'reply') {
      message = window.prompt(`Ответ для ${post.name}:`, '')?.trim();
      if (!message) return;
    }
    try {
      const data = await api({ action: 'moderatePost', room, teacherKey, postId: post.id, operation, text, message });
      revision = Number(data.revision) || revision;
      state = data.state;
      renderData(data);
      showToast(operation === 'approve' ? 'Ответ показан классу' : operation === 'reply' ? 'Личный ответ отправлен' : 'Готово');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function resolveQuestion(response, resolution) {
    try {
      const data = await api({ action: 'resolveQuestion', room, teacherKey, responseId: response.id, resolution });
      revision = Number(data.revision) || revision;
      state = data.state;
      renderData(data);
      const notices = {
        closed: 'Ребёнок получил: «Вопрос закрыт»',
        coming: 'Ребёнок получил: «Сейчас подойду»',
        ok: 'Ребёнок получил ответ «Окей»'
      };
      showToast(notices[resolution]);
    } catch (error) {
      showToast(error.message);
    }
  }

  async function poll() {
    try {
      const data = await api();
      if (!state || (!updating && Number(data.revision) > revision)) {
        state = data.state;
        revision = Number(data.revision) || 0;
        renderScene();
      }
      renderData(data);
    } catch (error) {
      showToast(error.message);
    }
  }

  if (!room || !teacherKey) {
    document.body.innerHTML = '<main class="panel" style="width:min(34rem,calc(100% - 2rem));margin:3rem auto"><p class="kicker">Нет доступа</p><h1>Сначала откройте версию учителя</h1><p>Пульт привязан к созданному классу и открывается кнопкой из урока.</p><a href="teacher.html">Перейти ко входу учителя</a></main>';
    return;
  }

  const joinUrl = new URL('student.html', window.location.href);
  joinUrl.searchParams.set('room', room);
  const lessonUrl = new URL('lesson.html', window.location.href);
  lessonUrl.searchParams.set('mode', 'teacher');
  lessonUrl.searchParams.set('room', room);
  roomCode.textContent = room;
  roomCodeLarge.textContent = room;
  dialogRoomCode.textContent = room;
  studentUrl.value = joinUrl.href;
  presentationLink.href = lessonUrl.href;
  new QRCode(byId('studentQr'), { text: joinUrl.href, width: 180, height: 180, colorDark: '#102d2b', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  new QRCode(byId('studentQrLarge'), { text: joinUrl.href, width: 520, height: 520, colorDark: '#102d2b', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });

  previousScene.addEventListener('click', () => updateState({ scene: Math.max(0, Number(state.scene) - 1), finished: false, sequenceReview: false }));
  nextScene.addEventListener('click', () => {
    const current = Number(state.scene) || 0;
    if (current >= titles.length - 1) updateState({ finished: true });
    else updateState({ scene: current + 1, finished: false, sequenceReview: false });
  });
  sequenceCheck.addEventListener('click', () => updateState({ sequenceReview: true }));
  correctAnswer.addEventListener('click', () => {
    const scene = Math.max(0, Number(state?.scene) || 0);
    updateState({ correctReveals: { ...(state?.correctReveals || {}), [scene]: true } });
  });
  broadcastForm.addEventListener('submit', (event) => {
    event.preventDefault();
    updateState({ teacherMessage: broadcastInput.value.trim().slice(0, 120) });
    broadcastInput.value = '';
  });
  byId('kindnessWave').addEventListener('click', () => updateState({ celebrationId: Date.now() }));
  byId('clearResponses').addEventListener('click', async () => {
    try {
      const data = await api({ action: 'clearResponses', room, teacherKey });
      revision = Number(data.revision) || revision;
      state = data.state;
      renderData(data);
      showToast('Ответы очищены');
    } catch (error) { showToast(error.message); }
  });
  byId('copyLink').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(joinUrl.href); showToast('Ссылка скопирована'); }
    catch { studentUrl.select(); document.execCommand('copy'); showToast('Ссылка скопирована'); }
  });
  byId('projectQr').addEventListener('click', () => { qrDialog.hidden = false; });
  byId('closeQr').addEventListener('click', () => { qrDialog.hidden = true; });

  poll();
  window.setInterval(poll, 1000);
})();

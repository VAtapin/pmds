'use strict';

(() => {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') === 'student' ? 'student' : 'teacher';
  const apiUrl = 'sync.php';
  const classroomButton = document.querySelector('#classroomButton');
  const classroomPanel = document.querySelector('#classroomPanel');
  const closeClassroomPanel = document.querySelector('#closeClassroomPanel');
  const roomIndicator = document.querySelector('#roomIndicator');
  const roomModeLabel = document.querySelector('#roomModeLabel');
  const roomIndicatorCode = document.querySelector('#roomIndicatorCode');
  const classroomCode = document.querySelector('#classroomCode');
  const classroomCodeLarge = document.querySelector('#classroomCodeLarge');
  const studentLink = document.querySelector('#studentLink');
  const studentQrCode = document.querySelector('#studentQrCode');
  const projectedQrCode = document.querySelector('#projectedQrCode');
  const projectedRoomCode = document.querySelector('#projectedRoomCode');
  const projectedStudentUrl = document.querySelector('#projectedStudentUrl');
  const qrProjection = document.querySelector('#qrProjection');
  const projectQrButton = document.querySelector('#projectQrButton');
  const closeQrProjection = document.querySelector('#closeQrProjection');
  const copyStudentLink = document.querySelector('#copyStudentLink');
  const connectedBadge = document.querySelector('#connectedBadge');
  const studentCount = document.querySelector('#studentCount');
  const projectedStudentCount = document.querySelector('#projectedStudentCount');
  const answerCount = document.querySelector('#answerCount');
  const kindnessTotal = document.querySelector('#kindnessTotal');
  const responseFeed = document.querySelector('#responseFeed');
  const responseSceneLabel = document.querySelector('#responseSceneLabel');
  const broadcastForm = document.querySelector('#broadcastForm');
  const broadcastInput = document.querySelector('#broadcastInput');
  const teacherMessage = document.querySelector('#teacherMessage');
  const celebrateButton = document.querySelector('#celebrateButton');
  const clearResponsesButton = document.querySelector('#clearResponsesButton');
  const kindnessWave = document.querySelector('#kindnessWave');
  const moderationTray = document.querySelector('#moderationTray');
  const privateReply = document.querySelector('#privateReply');
  const privateReplyText = document.querySelector('#privateReplyText');
  const closePrivateReply = document.querySelector('#closePrivateReply');
  const openControlPage = document.querySelector('#openControlPage');
  const studentDock = document.querySelector('#studentDock');
  const studentActivity = document.querySelector('#studentActivity');
  const studentNameLabel = document.querySelector('#studentNameLabel');
  const studentScore = document.querySelector('#studentScore');

  let room = (params.get('room') || '').toUpperCase();
  let teacherKey = room ? localStorage.getItem(`neighborTeacher:${room}`) || '' : '';
  let teacherMessageText = '';
  let celebrationId = 0;
  let seenCelebrationId = 0;
  let pollTimer = 0;
  let updateTimer = 0;
  let teacherUpdatePending = false;
  let lastServerRevision = 0;
  let studentName = sessionStorage.getItem('neighborStudentName') || '';
  let studentId = localStorage.getItem('neighborStudentId') || '';
  let score = Number(sessionStorage.getItem('neighborStudentScore') || 0);
  let lastStudentScene = -1;
  let sharedPostsSignature = '';
  let pollTotalsSignature = '';
  let moderationSignature = '';
  const answeredScenes = new Set(JSON.parse(sessionStorage.getItem('neighborAnsweredScenes') || '[]'));
  const studentSelections = JSON.parse(sessionStorage.getItem('neighborStudentSelections') || '{}');
  const sequenceProgress = { index: 0, mistakes: 0 };
  const studentSequenceOrder = [];
  let sequenceReviewSeen = false;
  let correctReveals = {};
  const seenReplyIds = new Set(JSON.parse(sessionStorage.getItem('neighborSeenReplies') || '[]'));

  if (!studentId) {
    studentId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('neighborStudentId', studentId);
  }

  async function api(payload = null, query = {}) {
    const options = payload
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }
      : { method: 'GET' };
    const url = new URL(apiUrl, window.location.href);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({ ok: false, error: 'Сервер вернул некорректный ответ' }));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось подключиться к классу');
    return data;
  }

  function studentUrl() {
    const url = new URL('student.html', window.location.href);
    url.searchParams.set('room', room);
    return url.href;
  }

  function showTeacherMessage(text) {
    teacherMessage.textContent = text;
    teacherMessage.hidden = !text;
  }

  function showKindnessWave() {
    kindnessWave.hidden = false;
    window.setTimeout(() => {
      kindnessWave.hidden = true;
    }, 3600);
  }

  function renderQrCodes() {
    if (!window.QRCode) return;
    const link = studentUrl();
    studentQrCode.replaceChildren();
    projectedQrCode.replaceChildren();
    new QRCode(studentQrCode, {
      text: link,
      width: 180,
      height: 180,
      colorDark: '#102d2b',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    new QRCode(projectedQrCode, {
      text: link,
      width: 520,
      height: 520,
      colorDark: '#102d2b',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function paintRoomIdentity() {
    roomIndicator.hidden = false;
    roomModeLabel.textContent = mode === 'teacher' ? 'Класс' : studentName;
    roomIndicatorCode.textContent = mode === 'teacher' ? room : `${room} · ✦ ${score}`;
    classroomCode.textContent = room;
    classroomCodeLarge.textContent = room;
    projectedRoomCode.textContent = room;
    studentLink.value = studentUrl();
    projectedStudentUrl.textContent = studentUrl();
    const controlUrl = new URL('control.html', window.location.href);
    controlUrl.searchParams.set('room', room);
    openControlPage.href = controlUrl.href;
    renderQrCodes();
  }

  function responseLabel(item) {
    const labels = {
      ready: 'Готовность',
      role: 'Роль',
      excuse: 'Оправдание героя',
      motive: 'Мотив самарянина',
      barrier: 'Что мешает помочь',
      sequence: 'Путь помощи',
      neighbor: 'Кто стал ближним',
      school_help: 'Школьная ситуация',
      promise: 'Личное решение',
      takeaway: 'Итог урока'
    };
    return labels[item.type] || 'Ответ';
  }

  async function moderatePost(post, operation) {
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
      renderTeacherData(data);
      if (operation === 'approve') window.lessonApp.showToast('Ответ опубликован для всего класса');
      if (operation === 'edit') window.lessonApp.showToast('Ответ исправлен');
      if (operation === 'delete') window.lessonApp.showToast('Ответ удалён');
      if (operation === 'reply') window.lessonApp.showToast(`Ответ для ${post.name} отправлен`);
    } catch (error) {
      window.lessonApp.showToast(error.message);
    }
  }

  function createModerationBubble(post, signature) {
    const bubble = document.createElement('article');
    bubble.className = 'moderation-bubble';
    bubble.dataset.postId = post.id;
    bubble.dataset.signature = signature;
    const avatar = document.createElement('span');
    avatar.className = 'moderation-bubble__avatar';
    avatar.textContent = post.name.slice(0, 1).toUpperCase();
    const copy = document.createElement('div');
    copy.className = 'moderation-bubble__copy';
    const name = document.createElement('strong');
    name.textContent = post.name;
    const caption = document.createElement('small');
    caption.textContent = `${responseLabel(post)} · этап ${post.scene + 1}`;
    const text = document.createElement('p');
    text.textContent = post.text;
    copy.append(name, caption, text);
    const actions = document.createElement('div');
    actions.className = 'moderation-bubble__actions';
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'moderation-approve';
    approve.textContent = '✓ Показать всем';
    approve.addEventListener('click', () => moderatePost(post, 'approve'));
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'moderation-reject';
    reject.textContent = '× Отклонить';
    reject.addEventListener('click', () => moderatePost(post, 'delete'));
    const reply = document.createElement('button');
    reply.type = 'button';
    reply.className = 'moderation-reply';
    reply.textContent = '↩ Ответить ученику';
    reply.addEventListener('click', () => moderatePost(post, 'reply'));
    actions.append(approve, reject, reply);
    bubble.append(avatar, copy, actions);
    return bubble;
  }

  function renderModerationBubbles(posts = []) {
    const pending = posts.filter((post) => post.status === 'pending');
    const signature = JSON.stringify(pending.map((post) => [post.id, post.name, post.text, post.type, post.scene]));
    if (signature === moderationSignature) return;
    moderationSignature = signature;
    moderationTray.hidden = pending.length === 0;

    const existing = new Map(Array.from(moderationTray.querySelectorAll('.moderation-bubble'))
      .map((bubble) => [bubble.dataset.postId, bubble]));
    const keep = new Set();
    let anchor = moderationTray.firstElementChild;

    pending.slice(0, 1).forEach((post) => {
      const postSignature = JSON.stringify([post.name, post.text, post.type, post.scene]);
      let bubble = existing.get(post.id);
      if (!bubble || bubble.dataset.signature !== postSignature) {
        const replacement = createModerationBubble(post, postSignature);
        if (bubble) bubble.replaceWith(replacement);
        bubble = replacement;
      }
      keep.add(bubble);
      if (bubble !== anchor) moderationTray.insertBefore(bubble, anchor);
      anchor = bubble.nextElementSibling;
    });

    moderationTray.querySelectorAll('.moderation-bubble').forEach((bubble) => {
      if (!keep.has(bubble)) bubble.remove();
    });

    let more = moderationTray.querySelector('.moderation-more');
    if (pending.length > 1) {
      if (!more) {
        more = document.createElement('span');
        more.className = 'moderation-more';
      }
      more.textContent = `Ещё ответов: ${pending.length - 1}`;
      moderationTray.append(more);
    } else if (more) more.remove();
  }

  function renderSharedPosts(posts = []) {
    const currentScene = window.lessonApp.getCurrentScene();
    const visiblePosts = posts.filter((post) => post.status === 'approved' && post.scene === currentScene).slice(-12);
    const activeScene = document.querySelectorAll('.scene')[currentScene];
    const signature = JSON.stringify([currentScene, mode, visiblePosts.map((post) => [post.id, post.name, post.text])]);
    const activeWall = activeScene?.querySelector('.live-class-wall');
    if (signature === sharedPostsSignature && (visiblePosts.length === 0 || activeWall)) return;
    sharedPostsSignature = signature;
    document.querySelectorAll('.live-class-wall').forEach((wall) => wall.remove());
    if (!visiblePosts.length || !activeScene) return;
    const target = activeScene.querySelector('.mini-board, .scenario-panel, .closing-summary, .promise-road, .scene__paper') || activeScene;
    const wall = document.createElement('section');
    wall.className = 'live-class-wall';
    wall.setAttribute('aria-label', 'Опубликованные ответы класса');
    const heading = document.createElement('strong');
    heading.className = 'live-class-wall__heading';
    heading.textContent = 'Говорит класс';
    wall.append(heading);

    visiblePosts.forEach((post) => {
      const card = document.createElement('article');
      card.className = 'live-class-answer';
      const text = document.createElement('span');
      text.textContent = post.text;
      if (mode === 'teacher') {
        const name = document.createElement('strong');
        name.textContent = post.name;
        card.append(name);
      }
      card.append(text);
      if (mode === 'teacher') {
        const actions = document.createElement('span');
        actions.className = 'live-class-answer__actions';
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Изменить';
        edit.addEventListener('click', () => moderatePost(post, 'edit'));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Удалить';
        remove.addEventListener('click', () => moderatePost(post, 'delete'));
        actions.append(edit, remove);
        card.append(actions);
      }
      wall.append(card);
    });
    target.append(wall);
  }

  function renderPollTotals(totals = {}, responses = [], revealCorrect = false) {
    const scene = window.lessonApp.getCurrentScene();
    const activity = activities[scene];
    if (!activity?.options?.length) {
      pollTotalsSignature = '';
      document.querySelectorAll('.live-class-poll').forEach((poll) => poll.remove());
      return;
    }
    const showNames = mode === 'teacher' && activity.type === 'role';
    const results = activity.options.map(([label, value]) => {
      const names = showNames
        ? Array.from(new Set(responses
          .filter((item) => item.scene === scene && item.type === activity.type && item.value === value)
          .map((item) => item.name)
          .filter(Boolean)))
          .sort((left, right) => left.localeCompare(right, 'ru'))
        : [];
      return {
        label,
        value,
        names,
        count: Number(totals[`${scene}:${activity.type}:${value}`] || 0)
      };
    });
    const total = results.reduce((sum, item) => sum + item.count, 0);
    const signature = JSON.stringify([scene, mode, revealCorrect, results.map((item) => [item.value, item.count, item.names])]);
    const activeScene = document.querySelectorAll('.scene')[scene];
    const activePoll = activeScene?.querySelector('.live-class-poll');
    if (signature === pollTotalsSignature && (total === 0 || activePoll)) return;
    pollTotalsSignature = signature;
    document.querySelectorAll('.live-class-poll').forEach((poll) => poll.remove());
    if (!total || !activeScene) return;

    const poll = document.createElement('section');
    poll.className = 'live-class-poll';
    poll.setAttribute('aria-label', 'Результаты голосования класса');
    const heading = document.createElement('strong');
    heading.textContent = `Голос класса · ${total}`;
    poll.append(heading);
    const options = document.createElement('div');
    options.className = 'live-class-poll__options';
    results.forEach((item) => {
      const option = document.createElement('div');
      option.className = 'live-class-poll__option';
      option.classList.toggle('is-correct', Boolean(activity.correct && (mode === 'teacher' || revealCorrect) && item.value === activity.correct));
      const copy = document.createElement('span');
      copy.textContent = item.label;
      const count = document.createElement('b');
      count.textContent = String(item.count);
      const meter = document.createElement('i');
      meter.style.setProperty('--poll-width', `${Math.round((item.count / total) * 100)}%`);
      option.append(copy, count, meter);
      if (item.names.length) {
        const names = document.createElement('div');
        names.className = 'live-class-poll__names';
        item.names.forEach((studentName) => {
          const name = document.createElement('small');
          name.className = 'live-class-poll__name';
          name.textContent = studentName;
          names.append(name);
        });
        option.append(names);
      }
      options.append(option);
    });
    poll.append(options);

    const target = activeScene.querySelector('.excuse-board, .choice-feedback, .scene__paper, .cover-copy') || activeScene;
    target.append(poll);
  }

  function renderTeacherData(data) {
    const students = Array.isArray(data.students) ? data.students : [];
    const responses = Array.isArray(data.responses) ? data.responses : [];
    const posts = Array.isArray(data.state?.studentPosts) ? data.state.studentPosts : [];
    const postsById = new Map(posts.map((post) => [post.id, post]));
    connectedBadge.textContent = String(data.connectedCount || 0);
    studentCount.textContent = String(data.connectedCount || 0);
    projectedStudentCount.textContent = String(data.connectedCount || 0);
    answerCount.textContent = String(responses.length);
    kindnessTotal.textContent = String(students.reduce((total, student) => total + (Number(student.score) || 0), 0));
    const currentScene = window.lessonApp.getCurrentScene();
    const currentResponses = responses.filter((item) => item.scene === currentScene).slice(0, 30);
    responseSceneLabel.textContent = `Этап ${currentScene + 1}`;
    renderSharedPosts(posts);
    renderPollTotals(data.totals || {}, responses);
    renderModerationBubbles(posts);
    responseFeed.replaceChildren();

    if (!currentResponses.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Ответы этого этапа появятся здесь.';
      responseFeed.append(empty);
      return;
    }

    currentResponses.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'response-card';
      const avatar = document.createElement('span');
      avatar.className = 'response-card__avatar';
      avatar.textContent = item.name.slice(0, 1).toUpperCase();
      const copy = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = item.name;
      const type = document.createElement('small');
      type.textContent = responseLabel(item);
      const text = document.createElement('p');
      text.textContent = item.text || item.value || 'Ответ отправлен';
      copy.append(name, type, text);
      card.append(avatar, copy);
      const post = postsById.get(item.id);
      if (post) {
        const actions = document.createElement('div');
        actions.className = 'response-card__actions';
        const status = document.createElement('span');
        status.className = `moderation-status moderation-status--${post.status}`;
        status.textContent = post.status === 'approved' ? 'Опубликован' : 'На проверке';
        actions.append(status);
        if (post.status !== 'approved') {
          const approve = document.createElement('button');
          approve.type = 'button';
          approve.className = 'publish-response';
          approve.textContent = 'Опубликовать';
          approve.addEventListener('click', () => moderatePost(post, 'approve'));
          actions.append(approve);
        }
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'publish-response';
        edit.textContent = 'Изменить';
        edit.addEventListener('click', () => moderatePost(post, 'edit'));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'publish-response publish-response--danger';
        remove.textContent = 'Удалить';
        remove.addEventListener('click', () => moderatePost(post, 'delete'));
        actions.append(edit, remove);
        card.append(actions);
      }
      responseFeed.append(card);
    });
  }

  function sharedTeacherState() {
    const lessonState = window.lessonApp.getSharedState();
    if (lessonState.samaritanReveal) correctReveals[4] = true;
    if (lessonState.neighbor === 'samaritan') correctReveals[7] = true;
    return {
      ...lessonState,
      teacherMessage: teacherMessageText,
      celebrationId,
      correctReveals
    };
  }

  async function sendTeacherState() {
    if (!room || !teacherKey) return;
    updateTimer = 0;
    teacherUpdatePending = true;
    try {
      const data = await api({ action: 'update', room, teacherKey, state: sharedTeacherState() });
      lastServerRevision = Math.max(lastServerRevision, Number(data.revision) || 0);
    } catch (error) {
      window.lessonApp.showToast(error.message);
    } finally {
      teacherUpdatePending = false;
    }
  }

  function scheduleTeacherUpdate() {
    if (mode !== 'teacher') return;
    window.clearTimeout(updateTimer);
    updateTimer = window.setTimeout(sendTeacherState, 90);
  }

  async function teacherPoll() {
    try {
      const data = await api(null, { room, teacherKey });
      const revision = Number(data.revision) || 0;
      if (!updateTimer && !teacherUpdatePending && revision > lastServerRevision) {
        window.lessonApp.applySharedState(data.state);
        lastServerRevision = revision;
      }
      teacherMessageText = String(data.state.teacherMessage || '');
      celebrationId = Number(data.state.celebrationId) || 0;
      correctReveals = data.state.correctReveals && typeof data.state.correctReveals === 'object' ? data.state.correctReveals : {};
      showTeacherMessage(teacherMessageText);
      renderTeacherData(data);
    } catch (error) {
      connectedBadge.textContent = '!';
      if (!document.hidden) window.lessonApp.showToast(error.message);
    }
  }

  async function studentPoll() {
    try {
      const data = await api(null, { room, studentId });
      window.lessonApp.applySharedState(data.state);
      renderSharedPosts(Array.isArray(data.state.studentPosts) ? data.state.studentPosts : []);
      correctReveals = data.state.correctReveals && typeof data.state.correctReveals === 'object' ? data.state.correctReveals : {};
      const currentScene = window.lessonApp.getCurrentScene();
      const correctRevealed = Boolean(correctReveals[currentScene]);
      teacherMessageText = String(data.state.teacherMessage || '');
      showTeacherMessage(teacherMessageText);
      const nextCelebration = Number(data.state.celebrationId) || 0;
      if (nextCelebration && nextCelebration !== seenCelebrationId) {
        seenCelebrationId = nextCelebration;
        showKindnessWave();
      }
      if (data.state.sequenceReview && !sequenceReviewSeen) {
        sequenceReviewSeen = true;
        revealStudentSequenceResult();
      }
      if (!data.state.sequenceReview && sequenceReviewSeen) {
        sequenceReviewSeen = false;
        resetStudentSequence();
      }
      const replies = Array.isArray(data.studentMessages) ? data.studentMessages : [];
      const newestReply = replies.findLast((reply) => !seenReplyIds.has(reply.id));
      if (newestReply) {
        seenReplyIds.add(newestReply.id);
        sessionStorage.setItem('neighborSeenReplies', JSON.stringify(Array.from(seenReplyIds).slice(-40)));
        privateReplyText.textContent = newestReply.text;
        privateReply.hidden = false;
        if (newestReply.kind === 'question_resolved') {
          const resolvedScene = Number(newestReply.scene) || 0;
          answeredScenes.delete(resolvedScene);
          score = Math.max(0, score + (Number(newestReply.scoreAdjustment) || 0));
          saveStudentProgress();
          if (currentScene === resolvedScene) renderStudentActivity(currentScene);
        }
      }
      if (currentScene !== lastStudentScene) renderStudentActivity(currentScene);
      if (correctRevealed) revealCorrectAnswer(currentScene);
      renderPollTotals(data.totals || {}, [], correctRevealed);
    } catch {
      window.clearInterval(pollTimer);
      window.location.replace(`student.html?room=${encodeURIComponent(room)}&error=1`);
    }
  }

  async function studentPing() {
    try {
      await api({ action: 'ping', room, studentId, name: studentName, score });
    } catch {
      // The next state poll will show a reconnect path if the room is gone.
    }
  }

  function saveStudentProgress() {
    studentScore.textContent = String(score);
    if (mode === 'student' && roomIndicatorCode) roomIndicatorCode.textContent = `${room} · ✦ ${score}`;
    sessionStorage.setItem('neighborStudentScore', String(score));
    sessionStorage.setItem('neighborAnsweredScenes', JSON.stringify(Array.from(answeredScenes)));
    sessionStorage.setItem('neighborStudentSelections', JSON.stringify(studentSelections));
  }

  function awardPoint(scene) {
    if (answeredScenes.has(scene)) return;
    answeredScenes.add(scene);
    score += 1;
    saveStudentProgress();
  }

  async function submitStudentResponse(type, value = '', text = '', awardsPoint = true) {
    const scene = window.lessonApp.getCurrentScene();
    const alreadyAnswered = answeredScenes.has(scene);
    if (awardsPoint) awardPoint(scene);
    try {
      await api({ action: 'respond', room, studentId, name: studentName, score, scene, type, value, text, awarded: awardsPoint });
      if (value) {
        studentSelections[scene] = value;
        saveStudentProgress();
      }
      return true;
    } catch (error) {
      if (awardsPoint && !alreadyAnswered) {
        answeredScenes.delete(scene);
        score = Math.max(0, score - 1);
        saveStudentProgress();
      }
      window.lessonApp.showToast(error.message);
      return false;
    }
  }

  const activities = [
    { prompt: 'Готовы начать путь?', type: 'ready', options: [['Готов ✦', 'ready'], ['Есть вопрос', 'question']] },
    { prompt: 'Какую роль вы готовы сыграть?', type: 'role', options: [['Путешественник', 'traveler'], ['Разбойник 1', 'robber_1'], ['Разбойник 2', 'robber_2'], ['Священник', 'priest'], ['Левит', 'levite'], ['Самарянин', 'samaritan']] },
    { prompt: 'Введите ответ в большом поле на слайде ↑', type: 'excuse', mainField: true },
    { prompt: 'Введите ответ в большом поле на слайде ↑', type: 'excuse', mainField: true },
    { prompt: 'Что повело самарянина к человеку?', type: 'motive', correct: 'compassion', options: [['Сострадание', 'compassion'], ['Награда', 'reward'], ['Любопытство', 'curiosity']] },
    { prompt: 'Что чаще всего мешает помочь?', type: 'barrier', options: [['Спешка', 'rush'], ['Страх', 'fear'], ['Неловкость', 'awkward'], ['Равнодушие', 'indifference']] },
    { prompt: 'Соберите путь на основном слайде ↑', type: 'sequence_order', mainField: true },
    { prompt: 'Кто стал ближним?', type: 'neighbor', correct: 'samaritan', options: [['Священник', 'priest'], ['Левит', 'levite'], ['Самарянин', 'samaritan']] },
    { prompt: 'Какие первые слова вы скажете новенькому?', type: 'school_help', input: 'Напишите точную фразу' },
    { prompt: 'Как вы предложите собрать книги?', type: 'school_help', input: 'Напишите точную фразу' },
    { prompt: 'Как пригласить одноклассника в игру?', type: 'school_help', input: 'Напишите точную фразу' },
    { prompt: 'Введите своё решение в большом поле на слайде ↑', type: 'promise', mainField: true },
    { prompt: 'Одно слово, которое вы уносите с урока', type: 'takeaway', input: 'Например: внимание' }
  ];

  function renderResult(container, message) {
    container.querySelector('.activity-result')?.remove();
    const result = document.createElement('p');
    result.className = 'activity-result';
    result.textContent = message;
    container.append(result);
  }

  function revealCorrectAnswer(scene) {
    const activity = activities[scene];
    if (!activity?.correct) return;
    const activeScene = document.querySelectorAll('.scene')[scene];
    if (!activeScene) return;
    if (scene === 7) {
      const buttons = Array.from(activeScene.querySelectorAll('[data-person]'));
      buttons.forEach((button) => {
        button.disabled = true;
        button.classList.remove('is-correct', 'is-incorrect');
        if (button.dataset.person === activity.correct) button.classList.add('is-correct');
        else if (button.dataset.person === studentSelections[scene]) button.classList.add('is-incorrect');
      });
      const feedback = activeScene.querySelector('#choiceFeedback');
      const quote = activeScene.querySelector('#finalQuote');
      if (feedback) feedback.textContent = 'Самарянин стал ближним, потому что проявил милосердие делом.';
      if (quote) quote.hidden = false;
      return;
    }
    const activityBox = activeScene.querySelector('.student-inline-activity');
    if (!activityBox) return;
    activityBox.querySelectorAll('.activity-options button').forEach((button) => {
      button.disabled = true;
      button.classList.remove('is-correct', 'is-incorrect');
      if (button.dataset.value === activity.correct) button.classList.add('is-correct');
      else if (button.dataset.value === studentSelections[scene]) button.classList.add('is-incorrect');
    });
    const correctLabel = activity.options.find(([, value]) => value === activity.correct)?.[0] || 'верный вариант';
    renderResult(activityBox, `Правильный ответ: ${correctLabel}.`);
  }

  function renderStudentActivity(scene) {
    lastStudentScene = scene;
    const activity = activities[scene] || activities[0];
    document.querySelectorAll('.student-inline-activity').forEach((element) => element.remove());
    studentActivity.hidden = true;

    if (activity.mainField || scene === 7) return;

    const activeScene = document.querySelectorAll('.scene')[scene];
    if (!activeScene) return;
    const target = activeScene.querySelector(
      scene === 0 ? '.cover-copy'
        : scene === 5 ? '.discussion-heading'
          : scene >= 8 && scene <= 10 ? '.scenario-panel'
            : scene === 12 ? '.closing-summary'
              : '.scene__paper, .choice-copy, .journey-copy'
    ) || activeScene;
    const activityBox = document.createElement('section');
    activityBox.className = 'student-inline-activity';
    activityBox.setAttribute('aria-live', 'polite');
    const prompt = document.createElement('p');
    prompt.className = 'student-activity__prompt';
    prompt.textContent = activity.prompt;
    activityBox.append(prompt);

    if (activity.input) {
      const form = document.createElement('form');
      form.className = 'activity-submit';
      const input = document.createElement('input');
      input.maxLength = 180;
      input.placeholder = activity.input;
      input.setAttribute('aria-label', activity.prompt);
      const button = document.createElement('button');
      button.type = 'submit';
      button.textContent = 'Отправить';
      form.append(input, button);
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text) return input.focus();
        if (await submitStudentResponse(activity.type, '', text)) {
          input.value = '';
          renderResult(activityBox, 'Ответ отправлен учителю на проверку · +1 луч добра');
        }
      });
      activityBox.append(form);
      target.append(activityBox);
      return;
    }

    const options = document.createElement('div');
    options.className = 'activity-options';
    const values = activity.sequence || activity.options || [];
    values.forEach(([label, value], optionIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.value = value;
      button.addEventListener('click', async () => {
        if (activity.sequence) {
          if (optionIndex !== sequenceProgress.index) {
            sequenceProgress.mistakes += 1;
            button.textContent = 'Попробуйте позже';
            window.setTimeout(() => { button.textContent = label; }, 900);
            return;
          }
          button.classList.add('is-selected');
          button.disabled = true;
          sequenceProgress.index += 1;
          if (sequenceProgress.index === activity.sequence.length) {
            await submitStudentResponse(activity.type, 'complete', `Собрано, ошибок: ${sequenceProgress.mistakes}`);
            renderResult(activityBox, 'Путь помощи собран · +1 луч добра');
          }
          return;
        }

        const previousSelected = options.querySelector('button.is-selected');
        options.querySelectorAll('button').forEach((candidate) => {
          candidate.classList.remove('is-selected');
          candidate.disabled = true;
        });
        button.classList.add('is-selected');
        const asksQuestion = activity.type === 'ready' && value === 'question';
        const isCorrect = !activity.correct || value === activity.correct;
        const sent = await submitStudentResponse(activity.type, value, label, isCorrect && !asksQuestion);
        if (!sent) {
          options.querySelectorAll('button').forEach((candidate) => { candidate.disabled = false; });
          button.classList.remove('is-selected');
          previousSelected?.classList.add('is-selected');
          return;
        }
        if (activity.type === 'role') {
          options.querySelectorAll('button').forEach((candidate) => { candidate.disabled = false; });
        }
        renderResult(activityBox, asksQuestion
          ? 'Учитель увидел вопрос. Дождитесь ответа — кнопки снова откроются.'
          : activity.type === 'role' ? 'Роль выбрана. Можно перейти на другую свободную роль.'
            : isCorrect ? 'Ответ сохранён · +1 луч добра' : 'Ответ сохранён. Обсудим его вместе.');
      });
      options.append(button);
    });
    activityBox.append(options);
    target.append(activityBox);
  }

  function enableMainStudentAnswers() {
    document.querySelectorAll('.excuse-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = form.elements.excuse;
        const text = input.value.trim();
        if (!text) return input.focus();
        if (await submitStudentResponse('excuse', form.dataset.character, text)) {
          input.value = '';
          window.lessonApp.showToast('Ваш ответ увидит учитель');
        }
      });
    });

    const promiseForm = document.querySelector('#promiseForm');
    promiseForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = promiseForm.elements.promise;
      const text = input.value.trim();
      if (!text) return input.focus();
      if (await submitStudentResponse('promise', '', text)) {
        input.value = '';
        window.lessonApp.showToast('Ваше решение отправлено учителю');
      }
    });

    document.querySelectorAll('[data-person]').forEach((button) => {
      button.addEventListener('click', async () => {
        const label = button.textContent.trim();
        await submitStudentResponse('neighbor', button.dataset.person, label, button.dataset.person === 'samaritan');
      });
    });
  }

  function resetStudentSequence() {
    studentSequenceOrder.splice(0);
    window.lessonApp.resetSequence();
  }

  function revealStudentSequenceResult() {
    const labels = ['Увидел', 'Подошёл', 'Помог', 'Привёз', 'Позаботился дальше'];
    const slots = Array.from(document.querySelectorAll('#roadSteps li'));
    if (studentSequenceOrder.length !== labels.length) {
      const result = document.querySelector('#sequenceResult');
      result.textContent = 'Общая проверка началась. Сравните путь на проекторе.';
      return;
    }
    let correct = 0;
    studentSequenceOrder.forEach((stepIndex, position) => {
      const slot = slots[position];
      const isCorrect = stepIndex === position;
      slot.classList.add(isCorrect ? 'is-local-correct' : 'is-local-wrong');
      if (isCorrect) correct += 1;
      if (!isCorrect) slot.querySelector('strong').textContent = `${labels[stepIndex]} → ${labels[position]}`;
    });
    const result = document.querySelector('#sequenceResult');
    result.textContent = `Ваш результат: ${correct} из ${labels.length}. Сверяем путь вместе.`;
  }

  window.addEventListener('lesson:studentsequencechoice', async (event) => {
    if (mode !== 'student' || sequenceReviewSeen) return;
    const { button, stepIndex } = event.detail;
    if (button.disabled || studentSequenceOrder.length >= 5) return;
    const labels = ['Увидел', 'Подошёл', 'Помог', 'Привёз', 'Позаботился дальше'];
    const icons = ['◉', '●', '+', '⌂', '∞'];
    const position = studentSequenceOrder.length;
    const slot = document.querySelectorAll('#roadSteps li')[position];
    studentSequenceOrder.push(stepIndex);
    button.disabled = true;
    slot.classList.add('is-filled', 'is-local-choice');
    slot.querySelector('span').textContent = icons[stepIndex];
    slot.querySelector('strong').textContent = labels[stepIndex];
    document.querySelector('#sequenceResult').textContent = position < 4
      ? `Выбран шаг ${position + 1}. Осталось ${4 - position}.`
      : 'Ваш путь сохранён. Ждём общей проверки учителя.';
    if (studentSequenceOrder.length === 5) {
      await submitStudentResponse('sequence_order', studentSequenceOrder.join(','), studentSequenceOrder.map((index) => labels[index]).join(' → '));
      window.lessonApp.showToast('Путь сохранён. Ждём общей проверки.');
    }
  });

  document.querySelector('#resetSequence').addEventListener('click', () => {
    if (mode === 'student' && !sequenceReviewSeen) studentSequenceOrder.splice(0);
  });

  function openClassroomPanel() {
    classroomPanel.hidden = false;
    classroomButton.setAttribute('aria-expanded', 'true');
  }

  function closeClassroom() {
    classroomPanel.hidden = true;
    classroomButton.setAttribute('aria-expanded', 'false');
  }

  classroomButton.addEventListener('click', () => {
    if (classroomPanel.hidden) openClassroomPanel();
    else closeClassroom();
  });
  closeClassroomPanel.addEventListener('click', closeClassroom);
  closePrivateReply.addEventListener('click', () => { privateReply.hidden = true; });
  projectQrButton.addEventListener('click', () => { qrProjection.hidden = false; });
  closeQrProjection.addEventListener('click', () => { qrProjection.hidden = true; });
  copyStudentLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(studentLink.value);
      window.lessonApp.showToast('Ссылка для учеников скопирована');
    } catch {
      studentLink.select();
      document.execCommand('copy');
      window.lessonApp.showToast('Ссылка для учеников скопирована');
    }
  });
  broadcastForm.addEventListener('submit', (event) => {
    event.preventDefault();
    teacherMessageText = broadcastInput.value.trim().slice(0, 120);
    showTeacherMessage(teacherMessageText);
    scheduleTeacherUpdate();
    broadcastInput.value = '';
  });
  celebrateButton.addEventListener('click', () => {
    celebrationId = Date.now();
    seenCelebrationId = celebrationId;
    showKindnessWave();
    scheduleTeacherUpdate();
  });
  clearResponsesButton.addEventListener('click', async () => {
    try {
      const data = await api({ action: 'clearResponses', room, teacherKey });
      renderTeacherData(data);
      window.lessonApp.showToast('Ответы класса очищены');
    } catch (error) {
      window.lessonApp.showToast(error.message);
    }
  });

  async function startTeacher() {
    document.body.classList.add('mode-teacher');
    classroomButton.hidden = false;
    studentDock.hidden = true;
    try {
      if (!room || !teacherKey || params.get('new') === '1') {
        const data = await api({ action: 'create', state: sharedTeacherState() });
        room = data.room;
        teacherKey = data.teacherKey;
        lastServerRevision = Number(data.revision) || 0;
        localStorage.setItem(`neighborTeacher:${room}`, teacherKey);
        const nextUrl = new URL(window.location.href);
        nextUrl.search = '';
        nextUrl.searchParams.set('mode', 'teacher');
        nextUrl.searchParams.set('room', room);
        nextUrl.hash = window.location.hash;
        window.history.replaceState(null, '', nextUrl);
      } else {
        const data = await api(null, { room, teacherKey });
        lastServerRevision = Number(data.revision) || 0;
        window.lessonApp.applySharedState(data.state);
        teacherMessageText = String(data.state.teacherMessage || '');
        celebrationId = Number(data.state.celebrationId) || 0;
        correctReveals = data.state.correctReveals && typeof data.state.correctReveals === 'object' ? data.state.correctReveals : {};
        renderTeacherData(data);
      }
      paintRoomIdentity();
      closeClassroom();
      await teacherPoll();
      pollTimer = window.setInterval(teacherPoll, 1000);
    } catch (error) {
      window.lessonApp.showToast(error.message);
    }
  }

  async function startStudent() {
    if (!room || !studentName) {
      window.location.replace(`student.html${room ? `?room=${encodeURIComponent(room)}` : ''}`);
      return;
    }
    document.body.classList.add('mode-student');
    classroomButton.hidden = true;
    studentDock.hidden = true;
    document.querySelector('#restartLesson').hidden = true;
    studentNameLabel.textContent = studentName;
    saveStudentProgress();
    paintRoomIdentity();
    renderStudentActivity(window.lessonApp.getCurrentScene());
    enableMainStudentAnswers();
    try {
      await studentPing();
      await studentPoll();
      pollTimer = window.setInterval(studentPoll, 900);
      window.setInterval(studentPing, 15000);
    } catch {
      window.location.replace(`student.html?room=${encodeURIComponent(room)}&error=1`);
    }
  }

  window.addEventListener('lesson:statechange', scheduleTeacherUpdate);
  window.addEventListener('lesson:finished', scheduleTeacherUpdate);
  window.addEventListener('beforeunload', () => window.clearInterval(pollTimer));

  if (mode === 'student') startStudent();
  else startTeacher();
})();

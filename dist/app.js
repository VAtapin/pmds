(() => {
  'use strict';

  const data = window.QUESTIONS_DATA;
  const questions = data.questions;
  const searchInput = document.querySelector('#search-input');
  const sectionsRoot = document.querySelector('#course-sections');
  const tagCloud = document.querySelector('#tag-cloud');
  const resultCount = document.querySelector('#result-count');
  const resetButton = document.querySelector('#reset-button');
  const emptyState = document.querySelector('#empty-state');
  const emptyReset = document.querySelector('#empty-reset');
  let activeTag = '';

  const normalize = (value) => value
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')
    .trim();

  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);

  const highlight = (value, query) => {
    const safe = escapeHtml(value);
    if (!query) return safe;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${escapedQuery})`, 'giu'), '<mark>$1</mark>');
  };

  const courseMeta = {
    2: {
      title: 'Второй курс',
      description: 'Экзаменационный конспект по предоставленным вопросам и материалам.',
      color: 'var(--course-2)',
      soft: 'var(--course-2-soft)'
    },
    3: {
      title: 'Третий курс',
      description: 'Краткие, но содержательные ответы на экзаменационные вопросы.',
      color: 'var(--course-3)',
      soft: 'var(--course-3-soft)'
    }
  };

  const tagCounts = questions.reduce((counts, question) => {
    question.tags.forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
    return counts;
  }, {});

  const tagEntries = Object.entries(tagCounts);
  const tagMin = Math.min(...tagEntries.map(([, count]) => count));
  const tagMax = Math.max(...tagEntries.map(([, count]) => count));

  tagEntries.forEach(([tag, count]) => {
    const button = document.createElement('button');
    const scale = tagMax === tagMin ? 0.5 : (count - tagMin) / (tagMax - tagMin);
    button.type = 'button';
    button.dataset.tag = tag;
    button.setAttribute('aria-pressed', 'false');
    button.style.setProperty('--tag-size', `${0.76 + scale * 0.16}rem`);
    button.textContent = `${tag} · ${count}`;
    button.addEventListener('click', () => {
      activeTag = activeTag === tag ? '' : tag;
      updateFilters();
    });
    tagCloud.append(button);
  });

  const buildCard = (question, rawQuery) => {
    const details = document.createElement('details');
    const answerMatch = rawQuery && !normalize(question.question).includes(normalize(rawQuery));
    details.className = 'question-card';
    details.dataset.id = question.id;
    details.innerHTML = `
      <summary>
        <span class="question-number">${question.number}</span>
        <span>
          <span class="question-title">${highlight(question.question, rawQuery)}</span>
          <span class="question-tags">${question.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}</span>
          ${answerMatch ? '<span class="match-note">Совпадение найдено в ответе</span>' : ''}
        </span>
        <span class="chevron" aria-hidden="true"></span>
      </summary>
      <div class="answer">
        <p class="takeaway"><strong>Запомнить:</strong> ${highlight(question.takeaway, rawQuery)}</p>
        ${question.answer.split(/\n\n+/).map((paragraph) => `<p>${highlight(paragraph, rawQuery)}</p>`).join('')}
      </div>`;
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      document.querySelectorAll('.question-card[open]').forEach((card) => {
        if (card !== details) card.open = false;
      });
    });
    return details;
  };

  const matchesFilters = (question, query) => {
    if (activeTag && !question.tags.includes(activeTag)) return false;
    if (!query) return true;
    const haystack = normalize([
      question.question,
      question.answer,
      question.takeaway,
      ...question.tags
    ].join(' '));
    return haystack.includes(normalize(query));
  };

  const render = () => {
    const rawQuery = searchInput.value.trim();
    const filtered = questions.filter((question) => matchesFilters(question, rawQuery));
    sectionsRoot.replaceChildren();

    [2, 3].forEach((course) => {
      const courseQuestions = filtered.filter((question) => question.course === course);
      if (!courseQuestions.length) return;
      const meta = courseMeta[course];
      const section = document.createElement('section');
      section.className = 'course-section';
      section.id = `course-${course}`;
      section.style.setProperty('--course-color', meta.color);
      section.style.setProperty('--course-soft', meta.soft);
      section.innerHTML = `
        <header class="course-heading">
          <span class="course-kicker">${course}</span>
          <div>
            <h2>${meta.title}</h2>
            <p>${meta.description}</p>
          </div>
          <span class="course-visible-count">${courseQuestions.length} ${pluralize(courseQuestions.length)}</span>
        </header>
        <div class="question-grid"></div>`;
      const grid = section.querySelector('.question-grid');
      courseQuestions.forEach((question) => grid.append(buildCard(question, rawQuery)));
      sectionsRoot.append(section);
    });

    document.querySelectorAll('[data-tag]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.tag === activeTag));
    });
    resultCount.textContent = filtered.length === questions.length
      ? `Показаны все ${questions.length} вопроса`
      : `Найдено: ${filtered.length} из ${questions.length}`;
    resetButton.hidden = !rawQuery && !activeTag;
    emptyState.hidden = filtered.length > 0;
    sectionsRoot.hidden = filtered.length === 0;
  };

  const pluralize = (count) => {
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'вопросов';
    if (last === 1) return 'вопрос';
    if (last >= 2 && last <= 4) return 'вопроса';
    return 'вопросов';
  };

  const reset = () => {
    activeTag = '';
    searchInput.value = '';
    render();
    searchInput.focus();
  };

  const updateFilters = () => render();
  let debounceId;
  searchInput.addEventListener('input', () => {
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(updateFilters, 60);
  });
  resetButton.addEventListener('click', reset);
  emptyReset.addEventListener('click', reset);
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape' && document.activeElement === searchInput) {
      reset();
    }
  });

  document.querySelector('#total-count').textContent = questions.length;
  document.querySelector('#jump-count-2').textContent = questions.filter((question) => question.course === 2).length;
  document.querySelector('#jump-count-3').textContent = questions.filter((question) => question.course === 3).length;
  render();
})();

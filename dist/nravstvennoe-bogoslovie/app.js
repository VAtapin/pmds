(() => {
  'use strict';

  if (['#course-2', '#course-3'].includes(window.location.hash)) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  const data = window.QUESTIONS_DATA;
  const questions = data.questions;
  const searchInput = document.querySelector('#search-input');
  const sectionsRoot = document.querySelector('#course-sections');
  const tagCloud = document.querySelector('#tag-cloud');
  const resultCount = document.querySelector('#result-count');
  const resetButton = document.querySelector('#reset-button');
  const emptyState = document.querySelector('#empty-state');
  const emptyMessage = document.querySelector('#empty-message');
  const emptyReset = document.querySelector('#empty-reset');
  const courseToggles = document.querySelectorAll('[data-course-toggle]');
  const courses = [...new Set(questions.map((question) => question.course))].sort((a, b) => a - b);
  const activeCourses = new Set(courses);
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

  const courseMeta = data.courseMeta || {
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

  const filterGroups = data.filterGroups || [
    {
      title: 'Основы догматики',
      tags: ['Богословие', 'Свойства догматов', 'Догмат и ересь', 'Формулы и термины', 'Системы', 'Возникновение догматов', 'Раскрытие догматов', 'Назначение догматов', 'Усвоение догматов', 'Догматическое развитие', 'Предание']
    },
    {
      title: 'Богопознание',
      tags: ['Пути богопознания', 'Аэций', 'Евномий', 'Познаваемость Бога', 'Варлаам', 'Григорий Палама', 'Апофатика и катафатика', 'Апофатические свойства', 'Катафатические свойства']
    },
    {
      title: 'Святая Троица',
      tags: ['Догмат о Троице', 'Апологеты', 'Ориген', 'Афанасий Великий', 'Духоборчество', 'Каппадокийцы', 'Бог Отец', 'Бог Сын', 'Святой Дух', 'Filioque']
    },
    {
      title: 'Творение и Промысл',
      tags: ['Дуализм и пантеизм', 'Творение из ничего', 'Троица и творение', 'Цель и совершенство творения', 'Промысл']
    },
    {
      title: 'Антропология и грех',
      tags: ['Образ и подобие', 'Душа, дух и тело', 'Первоначальный человек', 'Причины грехопадения', 'Сущность грехопадения', 'Последствия грехопадения', 'Первородный и личный грех', 'Первородный грех', 'Наказание после падения', 'Пелагий', 'Августин']
    },
    {
      title: 'Христология и Соборы',
      tags: ['Человечество Христа', 'Апологеты и Ориген', 'Монархианство', 'Арианство', 'Аполлинарий', 'Македоний', 'Несторий', 'Кирилл Александрийский', 'Монофизитство', 'Ипостасное соединение', 'Монофелитство', 'Христос и Троица', 'Богородица']
    },
    {
      title: 'Искупление',
      tags: ['Искупление']
    },
    {
      title: 'Ангелология',
      tags: ['Ангелы', 'Злые духи']
    }
  ];

  const buildTagCloud = () => {
    const availableTags = new Set(
      questions
        .filter((question) => activeCourses.has(question.course))
        .flatMap((question) => question.tags)
    );

    if (activeTag && !availableTags.has(activeTag)) activeTag = '';
    tagCloud.replaceChildren();

    filterGroups.forEach((group) => {
      const visibleTags = group.tags.filter((tag) => availableTags.has(tag));
      if (!visibleTags.length) return;
      const groupBlock = document.createElement('section');
      groupBlock.className = 'filter-group';
      groupBlock.innerHTML = `<h3>${group.title}</h3><div class="filter-buttons"></div>`;
      const buttonsRoot = groupBlock.querySelector('.filter-buttons');

      visibleTags.forEach((tag) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.tag = tag;
        button.setAttribute('aria-pressed', 'false');
        button.textContent = tag;
        button.addEventListener('click', () => {
          activeTag = activeTag === tag ? '' : tag;
          render({ revealSingle: Boolean(activeTag) });
        });
        buttonsRoot.append(button);
      });

      tagCloud.append(groupBlock);
    });
  };

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
        <div class="takeaway"><strong>Что запомнить:</strong><ul>${question.takeaway.split(/\n+/).map(point => `<li>${highlight(point, rawQuery)}</li>`).join('')}</ul></div>
        ${question.answer.split(/\n\n+/).map((paragraph) => `<p>${highlight(paragraph, rawQuery)}</p>`).join('')}
        ${(question.sources || []).map((source) => `<p class="answer-source">Источник: ${source.url && source.url.startsWith('https://') ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>` : escapeHtml(source.title)}. ${escapeHtml(source.section || '')}</p>`).join('')}
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

  const render = ({ revealSingle = false } = {}) => {
    const rawQuery = searchInput.value.trim();
    const availableQuestions = questions.filter((question) => activeCourses.has(question.course));
    buildTagCloud();
    const filtered = availableQuestions.filter((question) => matchesFilters(question, rawQuery));
    sectionsRoot.replaceChildren();

    courses.forEach((course) => {
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
    courseToggles.forEach((button) => {
      button.setAttribute('aria-pressed', String(activeCourses.has(Number(button.dataset.courseToggle))));
    });
    resultCount.textContent = filtered.length === availableQuestions.length && !rawQuery && !activeTag
      ? `Показано: ${filtered.length} ${pluralize(filtered.length)}`
      : `Найдено: ${filtered.length} из ${availableQuestions.length}`;
    resetButton.hidden = !rawQuery && !activeTag && activeCourses.size === courses.length;
    emptyMessage.textContent = activeCourses.size
      ? 'По этому запросу ничего не найдено.'
      : 'Выберите учебный блок выше.';
    emptyState.hidden = filtered.length > 0;
    sectionsRoot.hidden = filtered.length === 0;
    if (revealSingle && filtered.length === 1) {
      window.requestAnimationFrame(() => {
        const card = sectionsRoot.querySelector('.question-card');
        if (!card) return;
        card.open = true;
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
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
    activeCourses.clear();
    courses.forEach((course) => activeCourses.add(course));
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
  courseToggles.forEach((button) => {
    button.addEventListener('click', () => {
      const course = Number(button.dataset.courseToggle);
      if (activeCourses.has(course)) {
        activeCourses.delete(course);
      } else {
        activeCourses.add(course);
      }
      updateFilters();
    });
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
  courses.forEach((course) => {
    document.querySelector(`#jump-count-${course}`).textContent = questions.filter((question) => question.course === course).length;
  });
  render();
})();

(() => {
  'use strict';

  if (['#course-2', '#course-3'].includes(window.location.hash)) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  const data = window.QUESTIONS_DATA;
  const tickets = data.tickets;
  const filterGroups = data.filterGroups;
  const searchInput = document.querySelector('#search-input');
  const sectionsRoot = document.querySelector('#course-sections');
  const tagCloud = document.querySelector('#tag-cloud');
  const resultCount = document.querySelector('#result-count');
  const resetButton = document.querySelector('#reset-button');
  const emptyState = document.querySelector('#empty-state');
  const emptyMessage = document.querySelector('#empty-message');
  const emptyReset = document.querySelector('#empty-reset');
  const reviewCard = document.querySelector('#review-card');
  const courseToggles = document.querySelectorAll('[data-course-toggle]');
  const allCourses = [...courseToggles].map((button) => Number(button.dataset.courseToggle));
  const activeCourses = new Set(allCourses);
  let activeTag = '';
  const ticketSelect = document.querySelector('#ticket-select');
  const initialNumber = Number(new URLSearchParams(window.location.search).get('ticket'));
  let selectedTicket = tickets.some(ticket => ticket.number === initialNumber) ? initialNumber : 0;
  const updateTicketUrl = () => {
    const url = new URL(window.location.href);
    if (selectedTicket) url.searchParams.set('ticket', selectedTicket);
    else url.searchParams.delete('ticket');
    window.history.replaceState(null, '', url);
  };

  const normalize = (value) => String(value)
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
    1: { title: data.title, description: '22 билета · по два вопроса в каждом', color: 'var(--course-3)', soft: 'var(--course-3-soft)' }
  };

  const buildTagCloud = () => {
    const availableTags = new Set(
      tickets
        .filter((ticket) => activeCourses.has(ticket.course) && (!selectedTicket || ticket.number === selectedTicket))
        .flatMap((ticket) => ticket.tags)
    );

    if (activeTag && !availableTags.has(activeTag)) activeTag = '';
    tagCloud.replaceChildren();

    filterGroups.forEach((group) => {
      const visibleTags = group.tags.filter((tag) => availableTags.has(tag));
      if (!visibleTags.length) return;

      const groupBlock = document.createElement('section');
      groupBlock.className = 'filter-group';
      groupBlock.innerHTML = `<h3>${escapeHtml(group.title)}</h3><div class="filter-buttons"></div>`;
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

  const buildCard = (ticket, rawQuery) => {
    const details = document.createElement('details');
    const questionText = ticket.items.map((item) => item.question).join(' ');
    const answerMatch = rawQuery && !normalize(`${ticket.title} ${questionText}`).includes(normalize(rawQuery));
    details.className = 'question-card';
    details.dataset.id = ticket.id;
    details.innerHTML = `
      <summary>
        <span class="question-number">${ticket.number}</span>
        <span>
          <span class="question-title">${highlight(ticket.title, rawQuery)}</span>
          <ol class="ticket-preview">
            ${ticket.items.map((item) => `<li>${highlight(item.question, rawQuery)}</li>`).join('')}
          </ol>
          ${answerMatch ? '<span class="match-note">Совпадение найдено в ответе или памятке</span>' : ''}
        </span>
        <span class="chevron" aria-hidden="true"></span>
      </summary>
      <div class="answer ticket-answer">
        ${ticket.items.map((item) => `
          <article class="ticket-item">
            <h3><span>${item.number}</span>${highlight(item.question, rawQuery)}</h3>
            <p class="takeaway"><strong>Запомнить:</strong> ${highlight(item.takeaway, rawQuery)}</p>
            <p class="ticket-item__answer">${highlight(item.answer, rawQuery)}</p>
            <p class="ticket-item__support"><strong>Опора:</strong> ${highlight(item.support, rawQuery)}</p>
          </article>`).join('')}
      </div>`;

    details.addEventListener('toggle', () => {
      if (!details.open) return;
      reviewCard.open = false;
      document.querySelectorAll('.question-card[open]').forEach((card) => {
        if (card !== details) card.open = false;
      });
    });
    return details;
  };

  const matchesFilters = (ticket, query) => {
    if (activeTag && !ticket.tags.includes(activeTag)) return false;
    if (!query) return true;

    const haystack = normalize([
      ticket.title,
      ...ticket.tags,
      ...ticket.items.flatMap((item) => [item.question, item.takeaway, item.answer, item.support])
    ].join(' '));
    return haystack.includes(normalize(query));
  };

  const pluralizeTickets = (count) => {
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'билетов';
    if (last === 1) return 'билет';
    if (last >= 2 && last <= 4) return 'билета';
    return 'билетов';
  };

  const render = ({ revealSingle = false } = {}) => {
    const rawQuery = searchInput.value.trim();
    const availableTickets = tickets.filter((ticket) => activeCourses.has(ticket.course) && (!selectedTicket || ticket.number === selectedTicket));
    buildTagCloud();
    const filtered = availableTickets.filter((ticket) => matchesFilters(ticket, rawQuery));
    sectionsRoot.replaceChildren();

    allCourses.forEach((course) => {
      const courseTickets = filtered.filter((ticket) => ticket.course === course);
      if (!courseTickets.length) return;
      const meta = courseMeta[course];
      const section = document.createElement('section');
      section.className = 'course-section';
      section.id = `course-${course}`;
      section.style.setProperty('--course-color', meta.color);
      section.style.setProperty('--course-soft', meta.soft);
      section.innerHTML = `
        <header class="course-heading">
          <span class="course-kicker">КП</span>
          <div>
            <h2>${meta.title}</h2>
            <p>${meta.description}</p>
          </div>
          <span class="course-visible-count">${courseTickets.length} ${pluralizeTickets(courseTickets.length)}</span>
        </header>
        <div class="question-grid"></div>`;
      const grid = section.querySelector('.question-grid');
      courseTickets.forEach((ticket) => grid.append(buildCard(ticket, rawQuery)));
      sectionsRoot.append(section);
    });

    document.querySelectorAll('[data-tag]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.tag === activeTag));
    });
    courseToggles.forEach((button) => {
      button.setAttribute('aria-pressed', String(activeCourses.has(Number(button.dataset.courseToggle))));
    });

    resultCount.textContent = filtered.length === availableTickets.length && !rawQuery && !activeTag
      ? `Показано: ${filtered.length} ${pluralizeTickets(filtered.length)}`
      : `Найдено: ${filtered.length} из ${availableTickets.length}`;
    resetButton.hidden = !rawQuery && !activeTag && !selectedTicket && activeCourses.size === allCourses.length;
    emptyMessage.textContent = activeCourses.size
      ? 'По этому запросу ничего не найдено.'
      : 'Включите экзаменационные билеты выше.';
    emptyState.hidden = filtered.length > 0;
    sectionsRoot.hidden = filtered.length === 0;

    if (revealSingle && filtered.length === 1) {
      window.requestAnimationFrame(() => {
        const card = sectionsRoot.querySelector('.question-card');
        if (!card) return;
        card.open = true;
        card.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      });
    }
  };

  const reset = () => {
    selectedTicket = 0;
    ticketSelect.value = '';
    updateTicketUrl();
    activeTag = '';
    activeCourses.clear();
    allCourses.forEach((course) => activeCourses.add(course));
    searchInput.value = '';
    render();
    searchInput.focus();
  };

  let debounceId;
  searchInput.addEventListener('input', () => {
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(render, 60);
  });
  courseToggles.forEach((button) => {
    button.addEventListener('click', () => {
      const course = Number(button.dataset.courseToggle);
      if (activeCourses.has(course)) activeCourses.delete(course);
      else activeCourses.add(course);
      render();
    });
  });
  resetButton.addEventListener('click', reset);
  emptyReset.addEventListener('click', reset);
  reviewCard.addEventListener('toggle', () => {
    if (!reviewCard.open) return;
    document.querySelectorAll('.question-card[open]').forEach((card) => {
      card.open = false;
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape' && document.activeElement === searchInput) reset();
  });

  document.querySelector('#total-count').textContent = tickets.length;
  document.querySelector('#jump-count-1').textContent = tickets.length;
  tickets.forEach((ticket) => {
    const option = document.createElement('option');
    option.value = ticket.number;
    option.textContent = ticket.title;
    ticketSelect.append(option);
  });
  ticketSelect.value = selectedTicket || '';
  ticketSelect.addEventListener('change', () => {
    selectedTicket = Number(ticketSelect.value);
    activeTag = '';
    searchInput.value = '';
    allCourses.forEach(course => activeCourses.add(course));
    updateTicketUrl();
    render({ revealSingle: Boolean(selectedTicket) });
  });
  const introRoot = document.querySelector('#document-intro');
  data.intro.forEach((text) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    introRoot.append(paragraph);
  });
  const reviewRoot = reviewCard.querySelector('.review-card__content');
  data.supplements.forEach((source) => {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = source.title;
    section.append(heading);
    source.paragraphs.forEach((text) => {
      const paragraph = document.createElement('p');
      const match = text.match(/https:\/\/\S+$/);
      if (match) {
        paragraph.append(text.slice(0, match.index));
        const link = document.createElement('a');
        link.href = match[0]; link.textContent = match[0];
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        paragraph.append(link);
      } else paragraph.textContent = text;
      section.append(paragraph);
    });
    if (source.rows) {
      const table = document.createElement('table');
      table.className = 'memory-table';
      source.rows.forEach((row, index) => {
        const tr = document.createElement('tr');
        row.forEach((text) => {
          const cell = document.createElement(index === 0 ? 'th' : 'td');
          if (index === 0) cell.scope = 'col';
          cell.textContent = text;
          tr.append(cell);
        });
        table.append(tr);
      });
      section.append(table);
    }
    reviewRoot.append(section);
  });
  render({ revealSingle: Boolean(selectedTicket) });
})();

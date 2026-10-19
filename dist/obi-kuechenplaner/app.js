(() => {
  'use strict';

  const questions = window.QUESTIONS_DATA.questions;
  const searchInput = document.querySelector('#search-input');
  const sectionsRoot = document.querySelector('#question-sections');
  const tagCloud = document.querySelector('#tag-cloud');
  const resultCount = document.querySelector('#result-count');
  const resetButton = document.querySelector('#reset-button');
  const emptyState = document.querySelector('#empty-state');
  const emptyReset = document.querySelector('#empty-reset');
  let activeTag = '';

  const filterGroups = [
    { title: 'Vorstellung und Motivation', tags: ['Selbstvorstellung', 'Motivation bei OBI', 'Eigene Stärken', 'Berufswechsel', 'Kundengespräch'] },
    { title: 'Software und Planung', tags: ['Planungsprogramme', '3D-Visualisierung', 'Angebotsprüfung', 'Technische Machbarkeit'] },
    { title: 'Kundenbedarf und Küchenplanung', tags: ['Grundriss', 'Maße und Anschlüsse', 'Küchenformen', 'Ergonomie', 'Kleine Räume', 'Unsichere Maße'] },
    { title: 'Beratung und Verkauf', tags: ['Budgeteinwand', 'Abschluss', 'Angebotsvergleich', 'Unterschiedliche Wünsche', 'Noch unentschlossen', 'Reklamation und Verzögerung'] },
    { title: 'Umsetzung und Zusammenarbeit', tags: ['Nach Vertragsabschluss', 'Zusammenarbeit', 'Projektorganisation'] },
    { title: 'Persönliche Fragen und Telefonat', tags: ['Unzufriedene Kunden', 'Arbeitsweise', 'Einarbeitung', 'Starttermin', 'Gehaltsvorstellung'] }
  ];

  const normalize = (value) => String(value)
    .toLocaleLowerCase('de')
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

  const closeOtherAccordions = (current) => {
    document.querySelectorAll('.question-card[open], .prep-tool[open]').forEach((item) => {
      if (item !== current) item.open = false;
    });
  };

  document.querySelectorAll('.prep-tool').forEach((tool) => {
    tool.addEventListener('toggle', () => {
      if (tool.open) closeOtherAccordions(tool);
    });
  });

  const buildTagCloud = () => {
    tagCloud.replaceChildren();
    filterGroups.forEach((group) => {
      const block = document.createElement('section');
      block.className = 'filter-group';
      block.innerHTML = `<h3>${escapeHtml(group.title)}</h3><div class="filter-buttons"></div>`;
      const buttonsRoot = block.querySelector('.filter-buttons');
      group.tags.forEach((tag) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.tag = tag;
        button.setAttribute('aria-pressed', String(tag === activeTag));
        button.textContent = tag;
        button.addEventListener('click', () => {
          activeTag = activeTag === tag ? '' : tag;
          render({ revealSingle: Boolean(activeTag) });
        });
        buttonsRoot.append(button);
      });
      tagCloud.append(block);
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
          ${answerMatch ? '<span class="match-note">Treffer im Antworttext</span>' : ''}
        </span>
        <span class="chevron" aria-hidden="true"></span>
      </summary>
      <div class="answer">
        <p class="takeaway"><strong>Merken:</strong> ${highlight(question.takeaway, rawQuery)}</p>
        ${question.answer.split(/\n\n+/).map((paragraph) => `<p>${highlight(paragraph, rawQuery)}</p>`).join('')}
      </div>`;
    details.addEventListener('toggle', () => {
      if (details.open) closeOtherAccordions(details);
    });
    return details;
  };

  const matchesFilters = (question, rawQuery) => {
    if (activeTag && !question.tags.includes(activeTag)) return false;
    if (!rawQuery) return true;
    return normalize([question.question, question.answer, question.takeaway, ...question.tags].join(' '))
      .includes(normalize(rawQuery));
  };

  const render = ({ revealSingle = false } = {}) => {
    const rawQuery = searchInput.value.trim();
    const filtered = questions.filter((question) => matchesFilters(question, rawQuery));
    buildTagCloud();
    sectionsRoot.replaceChildren();

    if (filtered.length) {
      const section = document.createElement('section');
      section.className = 'course-section';
      section.style.setProperty('--course-color', 'var(--course-2)');
      section.style.setProperty('--course-soft', 'var(--course-2-soft)');
      section.innerHTML = `
        <header class="course-heading">
          <span class="course-kicker">29</span>
          <div>
            <h2>Vorstellungsgespräch</h2>
            <p>Kurze mündliche Antworten für Telefonat und persönliches Gespräch.</p>
          </div>
          <span class="course-visible-count">${filtered.length} ${filtered.length === 1 ? 'Frage' : 'Fragen'}</span>
        </header>
        <div class="question-grid"></div>`;
      const grid = section.querySelector('.question-grid');
      filtered.forEach((question) => grid.append(buildCard(question, rawQuery)));
      sectionsRoot.append(section);
    }

    const isFiltered = Boolean(rawQuery || activeTag);
    resultCount.textContent = isFiltered ? `Gefunden: ${filtered.length} von ${questions.length}` : `Alle ${questions.length} Fragen`;
    resetButton.hidden = !isFiltered;
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

  const reset = () => {
    activeTag = '';
    searchInput.value = '';
    render();
    searchInput.focus();
  };

  let debounceId;
  searchInput.addEventListener('input', () => {
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(() => render(), 60);
  });
  resetButton.addEventListener('click', reset);
  emptyReset.addEventListener('click', reset);
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape' && document.activeElement === searchInput) reset();
  });

  document.querySelector('#total-count').textContent = questions.length;
  render();
})();

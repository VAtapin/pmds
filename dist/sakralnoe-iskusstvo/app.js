(() => {
  'use strict';

  const data = window.EXAM_DATA;
  const root = document.querySelector('#question-cards');
  const search = document.querySelector('#search-input');
  const tagsRoot = document.querySelector('#tag-cloud');
  const resultCount = document.querySelector('#result-count');
  const reset = document.querySelector('#reset-button');
  const emptyState = document.querySelector('#empty-state');
  const emptyReset = document.querySelector('#empty-reset');
  let activeTag = '';
  let query = '';

  const normalize = value => String(value).toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();
  const escapeHtml = value => String(value).replace(/[&<>\'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  const highlight = value => {
    const safe = escapeHtml(value);
    if (!query) return safe;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp('(' + escaped + ')', 'giu'), '<mark>$1</mark>');
  };
  const allText = value => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(allText).join(' ');
    if (value && typeof value === 'object') return Object.values(value).map(allText).join(' ');
    return '';
  };

  document.querySelector('#exam-format').textContent = data.examFormat;
  document.querySelector('#source-note').textContent = data.sourceNote;
  document.querySelector('#pending-note').textContent = data.pendingNote;
  document.querySelector('#total-count').textContent = data.officialQuestions.length;
  document.querySelector('#official-questions').innerHTML = data.officialQuestions.map((item, index) => '<li><a href="#question-' + (index + 1) + '">' + escapeHtml(item) + '</a></li>').join('');
  document.querySelector('#teacher-notes').innerHTML = data.teacherNotes.map(item => '<li>' + escapeHtml(item) + '</li>').join('');
  document.querySelector('#literature').innerHTML = data.literature.map(item => '<li>' + escapeHtml(item) + '</li>').join('');

  const renderTags = () => {
    tagsRoot.replaceChildren();
    const tags = [...new Set(data.questions.flatMap(item => item.tags))].sort((a, b) => a.localeCompare(b, 'ru'));
    tags.forEach(tag => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tag-button';
      button.textContent = tag;
      button.setAttribute('aria-pressed', String(tag === activeTag));
      button.addEventListener('click', () => {
        activeTag = activeTag === tag ? '' : tag;
        renderTags();
        render();
      });
      tagsRoot.append(button);
    });
  };

  const renderSections = sections => sections.map(section => {
    let body = '';
    if (section.text) body += '<p>' + highlight(section.text).replace(/\n/g, '<br>') + '</p>';
    if (section.items) body += '<ul>' + section.items.map(item => '<li>' + highlight(item) + '</li>').join('') + '</ul>';
    if (section.sources) body += '<ul class="source-links">' + section.sources.map(source => '<li><a href="' + escapeHtml(source.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(source.title) + '</a></li>').join('') + '</ul>';
    return '<section class="answer-block"><h3>' + escapeHtml(section.heading) + '</h3>' + body + '</section>';
  }).join('');

  const render = () => {
    const visible = data.questions.filter(item => {
      if (activeTag && !item.tags.includes(activeTag)) return false;
      return !query || normalize(allText(item)).includes(normalize(query));
    });
    root.replaceChildren();
    visible.forEach(item => {
      const details = document.createElement('details');
      details.className = 'question-card';
      details.id = 'question-' + item.number;
      details.innerHTML = '<summary><span class="question-number">' + item.number + '</span><span class="question-heading"><span class="question-title">' + highlight(item.title) + '</span><span class="question-tags">' + item.tags.map(tag => '<span>#' + escapeHtml(tag) + '</span>').join('') + '</span></span><span class="chevron" aria-hidden="true"></span></summary>' +
        '<div class="answer"><p class="coverage">' + highlight(item.coverage) + '</p><p class="takeaway"><strong>Короткий ответ:</strong> ' + highlight(item.takeaway) + '</p>' + renderSections(item.sections) + '</div>';
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        document.querySelectorAll('.question-card[open]').forEach(card => { if (card !== details) card.open = false; });
      });
      root.append(details);
    });
    resultCount.textContent = visible.length === data.questions.length ? 'Все ' + visible.length + ' вопросов' : 'Найдено вопросов: ' + visible.length;
    reset.hidden = !query && !activeTag;
    emptyState.hidden = visible.length > 0;
  };

  search.addEventListener('input', () => { query = search.value.trim(); render(); });
  search.addEventListener('keydown', event => { if (event.key === 'Escape') { search.value = ''; query = ''; render(); } });
  reset.addEventListener('click', () => { search.value = ''; query = ''; activeTag = ''; renderTags(); render(); search.focus(); });
  emptyReset.addEventListener('click', () => reset.click());
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); search.focus(); }
  });

  renderTags();
  render();
})();

(() => {
  'use strict';
  const data = window.COMPARATIVE_3_DATA;
  const questions = data.questions;
  const search = document.querySelector('#search-input');
  const questionRoot = document.querySelector('#questions');
  const tagRoot = document.querySelector('#tag-cloud');
  const count = document.querySelector('#result-count');
  const reset = document.querySelector('#reset-button');
  const empty = document.querySelector('#empty-state');
  let activeTag = '';

  const normalize = value => String(value).toLocaleLowerCase('ru').replaceAll('ё','е').replace(/\s+/g,' ').trim();
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain = value => value.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');

  function renderTags(){
    const tags=[...new Set(questions.flatMap(q=>q.tags))].sort((a,b)=>a.localeCompare(b,'ru'));
    tagRoot.innerHTML=tags.map(tag=>`<button class="tag-button" type="button" data-tag="${esc(tag)}" aria-pressed="${tag===activeTag}">${esc(tag)}</button>`).join('');
    tagRoot.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{activeTag=activeTag===button.dataset.tag?'':button.dataset.tag;renderTags();renderQuestions()}));
  }

  function renderQuestions(){
    const query=normalize(search.value);
    const shown=questions.filter(q=>{
      const full=normalize(`${q.question} ${q.takeaway} ${plain(q.answer)} ${q.tags.join(' ')}`);
      return (!query||full.includes(query))&&(!activeTag||q.tags.includes(activeTag));
    });
    questionRoot.innerHTML=shown.map(q=>`<details class="question-card"><summary><span class="number">${q.number}</span><span class="question-title">${esc(q.question)}</span><span class="chevron" aria-hidden="true">⌄</span></summary><div class="tags">${q.tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div><div class="answer"><p class="takeaway"><strong>Запомнить:</strong> ${esc(q.takeaway)}</p>${q.answer}</div></details>`).join('');
    count.textContent=shown.length===questions.length?'Показаны все 16 вопросов':`Найдено вопросов: ${shown.length}`;
    empty.hidden=shown.length>0;
    reset.hidden=!query&&!activeTag;
  }

  function clearFilters(){search.value='';activeTag='';renderTags();renderQuestions();search.focus()}
  search.addEventListener('input',renderQuestions);
  reset.addEventListener('click',clearFilters);
  document.querySelector('#empty-reset').addEventListener('click',clearFilters);
  document.addEventListener('keydown',event=>{if(event.key==='/'&&document.activeElement!==search&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();search.focus()}if(event.key==='Escape'&&document.activeElement===search){search.value='';renderQuestions()}});
  document.querySelector('#sources-list').innerHTML=data.sources.map(source=>typeof source==='string'?`<li>${esc(source)}</li>`:`<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('');
  renderTags();renderQuestions();
})();

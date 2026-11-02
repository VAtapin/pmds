(() => {
 'use strict';
 const dateKey=value=>{const m=String(value).match(/(\d{2})\.(\d{2})\.(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
 function refreshSchedule(){
  const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  document.querySelectorAll('[data-card]').forEach(card=>{
   const lecture=dateKey(card.dataset.lecture),assessment=dateKey(card.dataset.assessment);
   const state=assessment&&assessment<today?'finished':lecture&&lecture<=today?'started':lecture?'upcoming':'unknown';
   card.dataset.scheduleState=state;
   card.querySelector('[data-schedule-status]').textContent={finished:'Дата контроля прошла',started:'Лекция состоялась',upcoming:'Лекция впереди',unknown:'Дата лекции не указана'}[state];
  });
 }
 refreshSchedule();
 setInterval(refreshSchedule,60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSchedule()});
 const normalize=x=>String(x).toLocaleLowerCase('ru').replaceAll('ё','е').replace(/\s+/g,' ').trim();
 const catalog=document.querySelector('[data-catalog-search]');
 if(catalog)catalog.addEventListener('input',()=>{const query=normalize(catalog.value);let count=0;document.querySelectorAll('[data-card]').forEach(card=>{card.hidden=!normalize(card.dataset.search).includes(query);if(!card.hidden)count++});document.querySelector('[data-catalog-empty]').hidden=count>0;});
 const search=document.querySelector('#lesson-search');
 if(search){
  const chapters=[...document.querySelectorAll('[data-chapter]')],texts=chapters.map(x=>normalize(x.textContent)),clear=document.querySelector('[data-clear]');
  function filter(){const query=normalize(search.value);let count=0;chapters.forEach((chapter,i)=>{chapter.hidden=Boolean(query&&!texts[i].includes(query));if(!chapter.hidden)count++;const link=document.querySelector(`[data-outline][href="#${chapter.id}"]`);if(link)link.hidden=chapter.hidden;});document.querySelector('#search-count').textContent=query?`Найдено частей лекции: ${count}`:`Частей лекции: ${chapters.length}`;document.querySelector('#lesson-empty').hidden=count>0;clear.hidden=!query;}
  search.addEventListener('input',filter);clear.addEventListener('click',()=>{search.value='';filter();search.focus()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.activeElement===search){search.value='';filter()}});
  document.querySelectorAll('a[href^="#t-"]').forEach(a=>a.addEventListener('click',()=>{if(search.value){search.value='';filter()}}));
 }
 document.querySelectorAll('[data-print]').forEach(button=>button.addEventListener('click',()=>window.print()));
 if(matchMedia('(max-width: 800px)').matches){const detail=document.querySelector('.outline details');if(detail)detail.open=false;}
 const notebook=document.querySelector('[data-notebook]');
 if(notebook){
  const input=notebook.querySelector('[data-notebook-text]'),status=notebook.querySelector('[data-notebook-status]'),download=notebook.querySelector('[data-notebook-download]'),key=notebook.dataset.notebookKey;
  let storageAvailable=true;
  try{input.value=localStorage.getItem(key)||'';}catch{storageAvailable=false;}
  function state(){download.disabled=!input.value.trim();status.textContent=storageAvailable?(input.value?'Сохранено в этом браузере':''):'Автосохранение недоступно. Скачайте текст для сохранения.';}
  input.addEventListener('input',()=>{try{if(input.value)localStorage.setItem(key,input.value);else localStorage.removeItem(key);}catch{storageAvailable=false;}state()});
  download.addEventListener('click',()=>{const blob=new Blob([download.dataset.title+'\n\n'+input.value],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=download.dataset.title+' — мои заметки.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});state();
 }
})();

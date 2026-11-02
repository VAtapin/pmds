(() => {
 'use strict';
 const normalize=x=>String(x).toLocaleLowerCase('ru').replaceAll('ё','е').replace(/\s+/g,' ').trim();
 const catalog=document.querySelector('[data-catalog-search]');
 if(catalog)catalog.addEventListener('input',()=>{
  const query=normalize(catalog.value);let total=0;
  document.querySelectorAll('[data-card]').forEach(card=>{card.hidden=!normalize(card.dataset.search).includes(query);if(!card.hidden)total++});
  document.querySelector('[data-catalog-empty]').hidden=total>0;
 });
 const search=document.querySelector('#lesson-search');
 if(search){
  const chapters=[...document.querySelectorAll('[data-chapter]')];
  const clear=document.querySelector('[data-clear]');
  const texts=chapters.map(x=>normalize(x.textContent));
  function filter(){const query=normalize(search.value);let total=0;
   chapters.forEach((chapter,i)=>{chapter.hidden=query&&!texts[i].includes(query);if(!chapter.hidden)total++;const link=document.querySelector(`[data-outline][href="#${chapter.id}"]`);if(link)link.hidden=chapter.hidden;});
   document.querySelector('#search-count').textContent=query?`Найдено тем: ${total}`:`${chapters.length} тем для изучения`;
   document.querySelector('#lesson-empty').hidden=total>0;clear.hidden=!query;
  }
  search.addEventListener('input',filter);clear.addEventListener('click',()=>{search.value='';filter();search.focus()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.activeElement===search){search.value='';filter()}});
 }
 document.querySelectorAll('[data-print]').forEach(button=>button.addEventListener('click',()=>window.print()));
 if(matchMedia('(max-width: 800px)').matches){const detail=document.querySelector('.outline details');if(detail)detail.open=false;}
 document.querySelectorAll('.outline a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.outline a').forEach(x=>x.removeAttribute('aria-current'));a.setAttribute('aria-current','location');}));
})();

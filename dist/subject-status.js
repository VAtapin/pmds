(() => {
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Berlin'}).format(new Date());
  const key = date => date.split('.').reverse().join('-');
  document.querySelectorAll('.subject-card').forEach(card => {
    let slug=card.getAttribute('href').split('?')[0].split('/').filter(p=>p&&p!=='..').pop();
    if(slug==='istoriya-russkoi-cerkvi') slug='istoriya-cerkvi';
    const course=Number(card.dataset?.course)||(slug==='sravnitelnoe-bogoslovie-3-kurs'?3:null);
    if(slug==='sravnitelnoe-bogoslovie-3-kurs') slug='sravnitelnoe-bogoslovie';
    const subjects=window.SUBJECT_SCHEDULE.filter(s=>s.slug===slug&&(!course||s.course===course));
    if(!subjects.length) return;
    const completed=subjects.filter(s=>key(s.schedule.assessment)<today);
    if(completed.length===subjects.length) card.classList.add('subject-card--passed');
    const label=document.createElement('span'); label.className='subject-status';
    label.textContent=subjects.map(s=>s.course+' курс: '+(key(s.schedule.assessment)<today?'сдано':'контроль '+s.schedule.assessment)).join(' · ');
    card.querySelector('.subject-card__content').append(label);
  });
})();

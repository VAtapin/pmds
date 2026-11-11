import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=join(root,'dist');
const data=JSON.parse(readFileSync(join(root,'content/library.json'),'utf8'));
assert.equal(data.educationMode,'source-study');
assert.deepEqual(data.courses.map(x=>x.number),[1,2,3,4]);
assert.equal(data.courses[0].subjects.length,18);assert.equal(data.courses[1].subjects.length,17);assert.equal(data.courses[2].subjects.length,16);assert.equal(data.courses[3].subjects.length,17);
const subjects=data.courses.flatMap(c=>c.subjects);
const checks=[[3,'dogmatika',38],[4,'sravnitelnoe-bogoslovie',48],[4,'nravstvennoe-bogoslovie',12],[4,'cerkovnoe-iskusstvo',10],[4,'istoriya-cerkvi',39],[4,'kanonicheskoe-pravo',47]];
for(const [course,slug,n] of checks)assert.equal(subjects.find(s=>s.course===course&&s.slug===slug).chapters.length,n,slug+' author archive preserved');
for(const doc of data.documents){
 assert(['student','author-archive'].includes(doc.access),doc.id+' access classification');
 if(doc.filename){const path=join(root,'materials',doc.filename);assert(existsSync(path),doc.filename);if(doc.sha256)assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),doc.sha256,doc.filename+' integrity');assert.equal(existsSync(join(dist,'materials',doc.filename)),doc.access==='student',doc.id+' publication access');}
 if(doc.access==='author-archive')assert(!existsSync(join(dist,'documents',doc.id+'.html')),doc.id+' private reader must not exist');
}
for(const subject of subjects){
 const output=readFileSync(join(dist,`${subject.course}-kurs`,subject.slug,'index.html'),'utf8');
 assert(!output.includes('class="key-point"'),'No generated answer summaries on student pages');
 if(!(subject.lessons||[]).length)assert(!output.includes('data-chapter'),'No answer-bank chapters on source-only subjects');
 for(const assignment of subject.teacherAssignments||[])assert(data.documents.some(d=>d.id===assignment.sourceId&&d.access==='student'),'Assignment has a supplied public source');
}
const history=data.documents.find(d=>d.id==='church-history-study');
assert(history&&history.access==='student','History study text is published');
assert.equal(history.sourceOriginalId,'document-11');
assert.equal(history.sections.length,21);
assert.deepEqual([...new Set(history.sections.flatMap(s=>s.sourceTopics))].sort((a,b)=>a-b),Array.from({length:39},(_,i)=>i+1),'All 39 history topics covered');
assert(!/Что запомнить|Коротко важное|class="key-point"|<summary/i.test(history.html),'History is a continuous study text');
const historyPage=readFileSync(join(dist,'documents/church-history-study.html'),'utf8');
for(const section of history.sections){assert(history.html.includes(`id="${section.id}"`));assert(history.html.includes(`href="#${section.id}"`));assert(!section.title.includes('?'));assert(historyPage.includes(section.title));}
assert(historyPage.includes('Учебный материал'));
assert.equal(data.documents.find(d=>d.id==='document-11').access,'author-archive','Original answer guide remains archived');
const historySubject=subjects.find(s=>s.course===4&&s.slug==='istoriya-cerkvi');
assert(historySubject.documents.some(d=>d.id===history.id),'Study text linked from subject');
assert.equal(historySubject.teacherAssignments.length,0,'No invented teacher assignments');
const programme=data.documents.find(d=>d.id==='church-history-program-4');
assert.equal(programme.programTopics.length,10);
assert.equal(history.programSourceId,programme.id);
assert.deepEqual(history.programCoverage.map(p=>p.topic),Array.from({length:10},(_,i)=>i+1));
for(const entry of history.programCoverage)for(const id of entry.sections)assert(history.sections.some(s=>s.id===id),'Programme mapping resolves to a real chapter');
assert(history.html.includes('Львовское собрание 1946'));
assert(history.html.includes('Директория УНР'));
assert(history.html.includes('не даёт основания'),'Ambiguous 2008 programme reference remains explicit');
for(const [course,slug,id] of [[3,'dogmatika','dogmatika-third-questions'],[3,'metodika-prepodavaniya','methodology-lecture-audio'],[3,'vethii-zavet','old-testament-program-3'],[4,'vethii-zavet','old-testament-program-4'],[3,'novyi-zavet','new-testament-program-3'],[4,'novyi-zavet','new-testament-program-4'],[4,'nravstvennoe-bogoslovie','moral-program-4'],[3,'istoriya-pravoslaviya','church-history-program-3'],[4,'istoriya-cerkvi','church-history-program-4']]){
 const subject=subjects.find(s=>s.course===course&&s.slug===slug),doc=data.documents.find(d=>d.id===id);
 assert(doc&&doc.access==='student');assert(subject.documents.some(d=>d.id===id),'Found source attached to correct subject');
 if(doc.sourceOriginalId)assert(data.documents.some(d=>d.id===doc.sourceOriginalId&&d.access==='author-archive'));
}
const dogmaQuestions=data.documents.find(d=>d.id==='dogmatika-third-questions');
assert.equal((dogmaQuestions.html.match(/<p>/g)||[]).length,39,'Title plus 38 supplied questions');
assert(readFileSync(join(dist,'4-kurs/istoriya-cerkvi/index.html'),'utf8').includes('church-history-study.html'));
const methodology=subjects.find(s=>s.course===3&&s.slug==='metodika-prepodavaniya');
assert.equal(methodology.lessons.length,12);assert.equal(methodology.teacherAssignments.length,9);
const transcript=data.documents.find(d=>d.id==='metodika-lecture-2026-09-23');
const raw=readFileSync(join(root,'materials',transcript.filename),'utf8').replace(/^\uFEFF/,'');
const records=[...raw.matchAll(/^\[(\d{2}:\d{2}:\d{2})\]\s?([^\r\n]*)/gm)];
assert.equal(records.length,915);
const pyEscape=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[c]));
const lecture=methodology.lessons.map(p=>p.html).join('');
assert.equal([...lecture.matchAll(/data-time=/g)].length,records.length);
const sourceMap=new Map(records.map(m=>[m[1],m[2]]));
for(const [_,time,text] of records)assert(lecture.includes(`data-time="${time}"><span class="timestamp">[${time}]</span><span class="transcript-text">${pyEscape(text)}</span>`),'Transcript segment preserved: '+time);
let quoteCount=0;
for(const assignment of methodology.teacherAssignments){
 let found=0;
 for(const m of assignment.html.matchAll(/<p><a href="#t-\d+">\[([\d:]+)\]<\/a> ([\s\S]*?)<\/p>/g)){assert.equal(m[2],pyEscape(sourceMap.get(m[1])),`Teacher requirement must be verbatim: ${m[1]}`);found++;quoteCount++;}
 assert(found>0,'Teacher requirement has literal source quotes');
}
const files=[];function walk(path){for(const name of readdirSync(path)){const full=join(path,name);if(statSync(full).isDirectory())walk(full);else if(name.endsWith('.html'))files.push(full)}}walk(dist);
let linkCount=0;
for(const path of files){const body=readFileSync(path,'utf8');assert(!body.includes('undefined'),path);for(const match of body.matchAll(/(?:href|src)="([^"]+)"/g)){let link=match[1].replaceAll('&amp;','&');if(/^(https?:|mailto:|data:|#)/.test(link))continue;link=decodeURIComponent(link.split('#')[0].split('?')[0]);assert(existsSync(resolve(dirname(path),link)),`${path}: missing ${link}`);linkCount++;}}
console.log(`Checked sources-only publication: 68 subjects, ${files.length} pages, ${linkCount} local links; ${records.length} transcript segments and ${quoteCount} literal teacher quotations. Author answer archives are excluded from dist.`);

for(const page of ['3-kurs/metodika-prepodavaniya/index.html','documents/metodika-lecture-2026-09-23.html']){
 const html=readFileSync(join(dist,page),'utf8');
 assert(!/\d{2}:\d{2}:\d{2}|href="#t-|class="timestamp"|class="transcript-line"/.test(html),'Methodology is readable prose without timing: '+page);
 const plain=html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 let cursor=0;
 for(const record of records){const text=pyEscape(record[2]).replace(/\s+/g,' ').trim();const index=plain.indexOf(text,cursor);assert(index>=0,'Transcript text preserved in order: '+record[1]);cursor=index+text.length;}
}

const methodologyPage=readFileSync(join(dist,'3-kurs/metodika-prepodavaniya/index.html'),'utf8');
const assignmentBlock=methodologyPage.match(/<section class="teacher-assignment"[\s\S]*?<\/section>/)?.[0];
assert(assignmentBlock?.includes(methodology.assignmentSummary),'Publish the concise teacher requirements');
assert(!assignmentBlock.includes('teacher-quote'),'Do not publish the long quotation collection in the assignment block');
assert(methodology.assignmentSummary.includes('Сдать работу в письменном виде.'));

const schisms = subjects.find(s=>s.course===4&&s.slug==='istoriya-raskolov');
const schismsDoc=data.documents.find(d=>d.id==='schisms-lecture-2026-11-03');
assert.equal(schisms.lessons.length,11);assert.equal(schismsDoc.sections.length,11);
assert(schismsDoc.sections.every(s=>s.end<=3132),'Personal examination is outside published lecture');
assert.equal(schisms.teacherAssignments.length,1);
assert.equal((schisms.teacherAssignments[0].html.match(/<li>/g)||[]).length,9);
const schismsPage=readFileSync(join(dist,'4-kurs/istoriya-raskolov/index.html'),'utf8');
for(const part of schisms.lessons){assert(schismsPage.includes(part.title));assert(schismsPage.includes(part.html));}
assert(schismsPage.includes(schisms.assignmentIntro));assert(!schismsPage.includes('Временные метки ведут'),'Translation intro is accurate');
assert(!/на какую оценку|пят[её]рку|Владимир, на/iu.test(schismsPage),'Individual examination excluded');
console.log('Checked schisms lecture translation, 11 parts and nine teacher topics; personal examination excluded.');

assert(!schismsPage.includes('Перевод украинской речи на русский с удалением речевых повторов.'),'No processing preface on lecture page');
assert(!readFileSync(join(dist,'documents/schisms-lecture-2026-11-03.html'),'utf8').includes('Перевод украинской речи на русский с удалением речевых повторов.'),'No processing preface in reader');

assert(!schismsDoc.html.includes('direct.ugcc.ua'),'Use the public UGCC domain');
for(const link of schismsDoc.html.matchAll(/<a href="https:[^>]+>/g)){assert(link[0].includes('target="_blank"'));assert(link[0].includes('rel="noopener noreferrer"'));}

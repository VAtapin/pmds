import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const data=JSON.parse(fs.readFileSync('content/schisms-questions.json','utf8'));
const lecture=JSON.parse(fs.readFileSync('content/schisms-lecture-ru.json','utf8'));
test('Schisms study guide covers all teacher themes and preserves generated data',()=>{
 assert.equal(data.course,4);assert.equal(data.teacherTopics.length,9);assert.equal(data.questions.length,12);
 assert.deepEqual(data.questions.map(q=>q.number),Array.from({length:12},(_,i)=>i+1));
 for(const q of data.questions){assert.ok(q.answer.length>250);assert.ok(q.takeaway);assert.ok(q.tags.length);for(const n of q.lectureParts)assert.ok(lecture.sections[n-1]);}
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync('dist/istoriya-raskolov/questions.js','utf8'),ctx);assert.equal(JSON.stringify(ctx.window.SCHISMS_DATA),JSON.stringify(data));
 for(const n of [9,10,12])assert.match(data.questions[n-1].answer,/Дополнение/);
});
test('Only lecture and lecturer requirements are retained, not personal examination',()=>{
 assert.equal(lecture.sections.length,11);assert.ok(lecture.sections.every(s=>s.end<=3132));
 const all=JSON.stringify({lecture,data});assert.doesNotMatch(all,/на яку оцінку|на какую оценку|пят[её]рку|місцеблюстителі після|Владимир, на/iu);
 assert.match(lecture.editorialNote,/вопросы и обсуждения слушателей/);
 assert.ok(lecture.sections.some(s=>s.start>=3094));
 assert.match(data.questions[4].answer,/23 октября 1921/);
 assert.match(data.questions[7].answer,/УГКЦ не признаёт/);
});

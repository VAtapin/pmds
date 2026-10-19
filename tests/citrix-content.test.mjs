import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const data = JSON.parse(readFileSync(new URL('../content/citrix-questions.json',import.meta.url),'utf8'));

test('All 35 interview questions and 20 priority marks are present',()=>{
  assert.deepEqual(data.questions.map(q=>q.number),Array.from({length:35},(_,i)=>i+1));
  assert.equal(new Set(data.questions.map(q=>q.id)).size,35);
  assert.equal(data.questions.filter(q=>q.important).length,20);
  assert.deepEqual(data.filterGroups.map(g=>data.questions.filter(q=>q.group===g.id).length),[6,7,6,7,3,6]);
  data.questions.forEach(q=>{
    for(const key of ['question','takeaway','answer']) assert.ok(q[key].trim(),`${q.id}: ${key}`);
  });
  assert.equal(data.review.length,12);
  assert.ok(data.closing.startsWith('Wichtig für das Gespräch:'));
});

test('Keyword filters cover every question without duplicate cloud buttons',()=>{
  const tags=data.filterGroups.flatMap(g=>g.tags);
  assert.equal(new Set(tags).size,tags.length);
  data.questions.forEach(q=>q.tags.forEach(tag=>assert.ok(tags.includes(tag))));
  for(const [tag,numbers] of [['VDA',[10,21,25]],['Master Image',[14,18,19]],['MCS',[14,16]],['Profile',[22,29]]]) {
    assert.deepEqual(data.questions.filter(q=>q.tags.includes(tag)).map(q=>q.number),numbers);
  }
});

test('Published interview data matches the source and the hub links to the page',()=>{
  const context={window:{}};
  vm.runInNewContext(readFileSync(new URL('../dist/glg-citrix/questions.js',import.meta.url),'utf8'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.QUESTIONS_DATA)),data);
  const hub=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.ok(hub.includes('href="glg-citrix/"'));
  assert.ok(hub.includes('8 разделов'));
  const app=readFileSync(new URL('../dist/glg-citrix/app.js',import.meta.url),'utf8');
  assert.ok(!app.includes('OBI'));
});

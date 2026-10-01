import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const data = JSON.parse(readFileSync(new URL('../content/moral-theology-questions.json', import.meta.url), 'utf8'));

test('All 32 source topics and 96 points are present in the correct years', () => {
  assert.equal(data.questions.length, 96);
  assert.deepEqual([...new Set(data.questions.map(q => q.topicNumber))], Array.from({length:32}, (_,i) => i+1));
  assert.equal(new Set(data.questions.map(q => q.id)).size, 96);
  data.questions.forEach((q, i) => {
    assert.equal(q.number, i+1);
    assert.equal(q.course, q.topicNumber <= 10 ? 2 : 4);
    assert.equal(q.year, q.course === 2 ? 1 : 2);
    for (const key of ['question', 'answer', 'takeaway']) assert.ok(q[key].trim(), `${q.id}: ${key}`);
    assert.ok(q.sources.length);
    q.sources.forEach(s => { assert.ok(s.title); if (s.url) assert.equal(new URL(s.url).protocol, 'https:'); });
  });
});

test('Filters cover every question and exclude the other year when toggled', () => {
  const tags = data.filterGroups.flatMap(g => g.tags);
  assert.equal(tags.length, 32);
  assert.equal(new Set(tags).size, 32);
  for (const q of data.questions) assert.ok(tags.includes(q.tags[0]));
  for (const course of [2,4]) {
    const available = data.questions.filter(q => q.course === course);
    const visible = new Set(available.flatMap(q => q.tags));
    assert.equal(visible.size, course === 2 ? 10 : 22);
  }
});

test('Published data exactly matches the authored source', () => {
  const context = {window:{}};
  vm.runInNewContext(readFileSync(new URL('../dist/nravstvennoe-bogoslovie/questions.js', import.meta.url), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.QUESTIONS_DATA)), data);
});

test('Dogmatic data has not acquired moral theology questions', () => {
  const context = {window:{}};
  vm.runInNewContext(readFileSync(new URL('../dist/dogmatika/questions.js', import.meta.url), 'utf8'), context);
  assert.equal(context.window.QUESTIONS_DATA.questions.length, 103);
  assert.ok(context.window.QUESTIONS_DATA.questions.every(q => [2,3].includes(q.course)));
  assert.ok(!readFileSync(new URL('../dist/dogmatika/index.html', import.meta.url), 'utf8').includes('moral-questions.js'));
});

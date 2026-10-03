import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const data = JSON.parse(read('../content/religious-movements-questions.json'));

test('All 35 questions, six source sections, review, references and note are present', () => {
  assert.deepEqual(data.questions.map(q => q.number), Array.from({length:35}, (_,i) => i+1));
  assert.equal(new Set(data.questions.map(q => q.id)).size,35);
  assert.deepEqual([...new Set(data.questions.map(q => q.section))],data.filterGroups.map(g => g.title));
  assert.deepEqual(data.filterGroups.map(g => data.questions.filter(q => q.section === g.title).length),[4,10,5,7,7,2]);
  data.questions.forEach(q => {
    for (const key of ['question','answer','takeaway']) assert.ok(q[key].trim(),`${q.number}: ${key}`);
    assert.ok(data.courseMeta[q.course]);
  });
  assert.equal(data.review.length,12);
  assert.equal(data.sourceParagraphs.length,7);
  assert.ok(data.sourceNote.startsWith('Важно:'));
  assert.ok(data.sourceNote.includes('В академическом религиоведении'));
});

test('Unique cloud keywords cover all questions and connect related movements', () => {
  const tags=data.filterGroups.flatMap(g => g.tags);
  assert.equal(new Set(tags).size,tags.length);
  data.questions.forEach(q => {
    assert.ok(q.tags.length);
    q.tags.forEach(tag => assert.ok(tags.includes(tag),tag));
  });
  for (const [tag,numbers] of [['Мунизм',[20,21,22,34,35]],['New Age',[12,13]],['Саентология',[27,28,34,35]],['Асауляк',[15]],['Повторение',[34,35]]]) {
    assert.deepEqual(data.questions.filter(q => q.tags.includes(tag)).map(q => q.number),numbers);
  }
});

test('Published data exactly matches JSON and the guide has independent assets and home navigation', () => {
  const context={window:{}};
  vm.runInNewContext(read('../dist/religioznye-dvizheniya/questions.js'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.QUESTIONS_DATA)),data);
  const html=read('../dist/religioznye-dvizheniya/index.html');
  for (const text of ['src="app.js"','href="styles.css"','href="../"','id="source-note"','id="quick-review"','id="document-sources"']) assert.ok(html.includes(text),text);
  assert.ok(!html.includes('../filter-switches.css'));
  assert.ok(!html.includes('1917–2026'));
  assert.ok(!html.includes('История Русской Церкви'));
  assert.ok(read('../dist/index.html').includes('href="religioznye-dvizheniya/"'));
});

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const data = JSON.parse(read('../content/church-history-questions.json'));

test('All 39 source questions have ordered numbers, complete answers and four sections', () => {
  assert.deepEqual(data.questions.map(q => q.number), Array.from({length:39}, (_,i) => i+1));
  assert.equal(new Set(data.questions.map(q => q.id)).size, 39);
  assert.deepEqual([...new Set(data.questions.map(q => q.section))], data.filterGroups.map(g => g.title));
  assert.deepEqual(data.filterGroups.map(g => data.questions.filter(q => q.section === g.title).length), [10,8,7,14]);
  for (const q of data.questions) {
    for (const key of ['question','takeaway','answer']) assert.ok(q[key].trim(), `${q.number}: ${key}`);
    assert.ok(data.courseMeta[q.course]);
  }
  assert.equal(data.sourceParagraphs.length,17);
  assert.equal(data.sourceParagraphs.filter(p => p.includes('https://')).length,16);
});

test('The cloud covers all questions with unique, exact, shared keywords', () => {
  const tags=data.filterGroups.flatMap(g => g.tags);
  assert.equal(new Set(tags).size,tags.length);
  for (const q of data.questions) {
    assert.ok(q.tags.length);
    q.tags.forEach(tag => assert.ok(tags.includes(tag),tag));
  }
  for (const [tag,numbers] of [['Феофания',[36,39]],['Сергий',[5,6,8,9,10,17]],['Киево-Печерская лавра',[31]],['2024–2026',[37]]]) {
    assert.deepEqual(data.questions.filter(q => q.tags.includes(tag)).map(q => q.number),numbers);
  }
});

test('Published data is identical and the guide has independent assets and a home link', () => {
  const context={window:{}};
  vm.runInNewContext(read('../dist/istoriya-russkoi-cerkvi/questions.js'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.QUESTIONS_DATA)),data);
  const html=read('../dist/istoriya-russkoi-cerkvi/index.html');
  assert.ok(html.includes('src="app.js"'));
  assert.ok(html.includes('href="styles.css"'));
  assert.ok(html.includes('href="../"'));
  assert.ok(!html.includes('../nravstvennoe-bogoslovie/'));
  assert.ok(html.includes('id="document-sources"'));
  assert.ok(read('../dist/index.html').includes('href="istoriya-russkoi-cerkvi/"'));
});

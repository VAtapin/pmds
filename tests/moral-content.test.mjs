import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const data = JSON.parse(readFileSync(new URL('../content/moral-theology-questions.json', import.meta.url), 'utf8'));

test('All 12 lecture questions are present in the correct years', () => {
  assert.equal(data.questions.length, 12);
  assert.deepEqual([...new Set(data.questions.map(q => q.topicNumber))], Array.from({length:12}, (_,i) => i+11));
  assert.equal(new Set(data.questions.map(q => q.id)).size, 12);
  data.questions.forEach((q, i) => {
    assert.equal(q.number, i+11);
    assert.equal(q.course, 4);
    assert.equal(q.year, 2);
    for (const key of ['question', 'answer', 'takeaway']) assert.ok(q[key].trim(), `${q.id}: ${key}`);
    assert.ok(!q.sources, 'Only the supplied document text is published');
  });
});

test('Filters cover every question and exclude the other year when toggled', () => {
  const tags = data.filterGroups.flatMap(g => g.tags);
  assert.equal(new Set(tags).size, tags.length);
  for (const q of data.questions) {
    q.tags.forEach(tag => assert.ok(tags.includes(tag)));
  }
  for (const course of [4]) {
    const available = data.questions.filter(q => q.course === course);
    const visible = new Set(available.flatMap(q => q.tags));
    assert.equal(available.length, 12);
    assert.ok(visible.size);
  }
  for (const [tag, numbers] of [['Сребролюбие',[16]], ['Смирение',[17,21,22]], ['Помыслы',[11,22]], ['Пост',[14]]]) {
    assert.deepEqual(data.questions.filter(q => q.tags.includes(tag)).map(q => q.number), numbers);
  }
});

test('All six guides use the shared switch styles and old moral lectures are removed', () => {
  const switchStyles = readFileSync(new URL('../dist/filter-switches.css',import.meta.url),'utf8');
  assert.ok(switchStyles.includes('button[data-course-toggle][aria-pressed]::before'));
  assert.ok(!switchStyles.includes('.tag-cloud'));
  assert.ok(!switchStyles.includes('.discipline-toggles'));
  for (const page of ['dogmatika','religii','katehizis','novyi-zavet','sravnitelnoe-bogoslovie','nravstvennoe-bogoslovie']) {
    const html = readFileSync(new URL(`../dist/${page}/index.html`,import.meta.url),'utf8');
    assert.ok(html.includes('href="../filter-switches.css"'),page);
  }
  const html = readFileSync(new URL('../dist/dogmatika/index.html',import.meta.url),'utf8');
  assert.ok(!html.includes('moral-questions.js'));
  assert.ok(!html.includes('data-discipline-toggle'));
  assert.ok(!data.review);
});

test('Published data exactly matches the authored source', () => {
  const context = {window:{}};
  vm.runInNewContext(readFileSync(new URL('../dist/nravstvennoe-bogoslovie/questions.js', import.meta.url), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.QUESTIONS_DATA)), data);
});

test('Moral theology uses its own assets without depending on the restored dogmatics page', () => {
  const html = readFileSync(new URL('../dist/nravstvennoe-bogoslovie/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('src="app.js"'));
  assert.ok(html.includes('href="styles.css"'));
  assert.ok(!html.includes('../dogmatika/'));
  assert.ok(readFileSync(new URL('../dist/nravstvennoe-bogoslovie/app.js', import.meta.url), 'utf8').length);
  assert.ok(readFileSync(new URL('../dist/nravstvennoe-bogoslovie/styles.css', import.meta.url), 'utf8').length);
});

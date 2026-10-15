import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const data = JSON.parse(read('../content/religious-movements-questions.json'));

test('All 55 new questions and eight sections retain the new document structure', () => {
  assert.deepEqual(data.questions.map(q => q.number), Array.from({length:55}, (_,i) => i+1));
  assert.equal(new Set(data.questions.map(q => q.id)).size,55);
  assert.deepEqual([...new Set(data.questions.map(q => q.section))],data.filterGroups.map(g => g.title));
  assert.deepEqual(data.filterGroups.map(g => data.questions.filter(q => q.section === g.title).length),[5,8,4,9,7,6,7,9]);
  data.questions.forEach(q => {
    for (const key of ['question','answer','takeaway']) assert.ok(q[key].trim(),`${q.number}: ${key}`);
    assert.ok(data.courseMeta[q.course]);
  });
  assert.equal(data.review.length,12);
  assert.equal(data.sourceParagraphs.length,5);
  assert.ok(data.sourceNote.startsWith('Примечание о достоверности:'));
  assert.equal(data.chronology.length,16);
  assert.deepEqual(data.chronology[0],['Дата','Событие']);
  assert.equal(data.contents.length,8);
  assert.equal(data.sectionNotes.length,1);
  assert.ok(data.sourceNote.includes('утверждения'));
});

test('Unique cloud keywords cover all questions and connect related movements', () => {
  const tags=data.filterGroups.flatMap(g => g.tags);
  assert.equal(new Set(tags).size,tags.length);
  data.questions.forEach(q => {
    assert.ok(q.tags.length);
    q.tags.forEach(tag => assert.ok(tags.includes(tag),tag));
  });
  for (const [tag,numbers] of [['Мунизм',[18,19,20,21]],['New Age',[12,13]],['Саентология',[31,32,33]],['Асауляк',[14]]]) {
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


test('Every previous question is preserved once, with 33 thematic additions and two review questions', () => {
  const previous=JSON.parse(read('../content/religious-movements-previous.json'));
  assert.deepEqual(data.previousMaterial,previous);
  assert.equal(previous.questions.length,35);
  const links=data.questions.flatMap(q => q.previousQuestionNumbers);
  assert.equal(links.length,33);
  assert.deepEqual([...links,...data.previousReviewQuestionNumbers].sort((a,b)=>a-b),Array.from({length:35},(_,i)=>i+1));
  for (const [parent,children] of [[1,[1,4]],[20,[22]],[51,[25,26]],[47,[10]]]) {
    assert.deepEqual(data.questions.find(q=>q.number===parent).previousQuestionNumbers,children);
  }
  assert.equal(data.previousMaterial.review.length,12);
  assert.equal(data.previousMaterial.sourceParagraphs.length,7);
});

test('Conversation format and core textbooks are visible separately from source wording', () => {
  const html=read('../dist/religioznye-dvizheniya/index.html');
  for (const text of ['Подготовка к беседе','вероятно','Александр Дворкин','Чернышёв','собственную веру','55 основных вопросов','id="chronology"','id="previous-review"']) assert.ok(html.includes(text),text);
  assert.ok(!html.includes('35 вопросов'));
  assert.ok(read('../dist/index.html').includes('55 вопросов · подготовка к беседе'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const data = JSON.parse(fs.readFileSync('content/comparative-theology-questions.json', 'utf8'));
test('Two years preserve separate numbering and complete source fields', () => {
  assert.equal(data.questions.length, 94);
  assert.equal(new Set(data.questions.map(q => q.id)).size, 94);
  for (const [course, count] of [[3,48],[4,46]]) {
    const items = data.questions.filter(q => q.course === course);
    assert.deepEqual(items.map(q => q.number), Array.from({length:count}, (_,i) => i+1));
    assert.ok(items.every(q => q.question && q.answer && q.takeaway && q.section && q.tags.length));
  }
  assert.deepEqual(data.courses.map(c => [c.course,c.review.length,c.sources.length]), [[3,13,3],[4,17,2]]);
});
test('Shared filters are unique and link the two years', () => {
  const tags = data.filterGroups.flatMap(g => g.tags);
  assert.equal(new Set(tags).size, tags.length);
  assert.ok(data.questions.every(q => q.tags.every(t => tags.includes(t))));
  for (const tag of ['Первородный грех','Священное Писание и Предание','Евхаристия']) {
    assert.deepEqual([...new Set(data.questions.filter(q => q.tags.includes(tag)).map(q => q.course))], [3,4]);
  }
  assert.deepEqual(data.questions.filter(q => q.tags.includes('Первородный грех')).map(q => [q.course,q.number]), [[3,28],[4,7]]);
});
test('Curriculum mapping covers all topics with valid source questions and explicit limitations', () => {
  assert.deepEqual(data.verification.topics.map(t => t.number), Array.from({length:19}, (_,i) => i+1));
  for (const topic of data.verification.topics) {
    assert.equal(topic.course, topic.number <= 12 ? 3 : 4);
    assert.ok(topic.description.length >= 1 && topic.description.length <= 2);
    assert.ok(topic.questionNumbers.every(n => data.questions.some(q => q.course === topic.course && q.number === n)));
  }
  assert.equal(data.verification.partialCoverage.length, 10);
});
test('Published payload equals source data; page exposes both courses and curriculum', () => {
  const context = {window:{}};
  vm.runInNewContext(fs.readFileSync('dist/sravnitelnoe-bogoslovie/questions.js','utf8'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.QUESTIONS_DATA)), data);
  const html = fs.readFileSync('dist/sravnitelnoe-bogoslovie/index.html','utf8');
  assert.match(html, /data-course-toggle="3"/);
  assert.match(html, /data-course-toggle="4"/);
  assert.doesNotMatch(html, /data-course-toggle="2"/);
  assert.match(html, /id="curriculum-content"/);
  assert.match(fs.readFileSync('dist/index.html','utf8'), /3 и 4 курс · 94 вопроса/);
});

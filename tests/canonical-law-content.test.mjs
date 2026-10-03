import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const data = JSON.parse(read('../content/canonical-law-tickets.json'));
const official = JSON.parse(read('../content/canonical-law-official-tickets.json'));

test('Every official ticket and all 44 questions retain PDF wording and order', () => {
  assert.deepEqual(data.tickets.map(t => t.number),Array.from({length:22},(_,i)=>i+1));
  assert.equal(new Set(data.tickets.map(t => t.id)).size,22);
  assert.deepEqual(data.tickets.map(t => ({number:t.number,items:t.items.map(({number,question})=>({number,question}))})),official);
  for (const ticket of data.tickets) {
    assert.deepEqual(ticket.items.map(q=>q.number),[1,2]);
    for (const q of ticket.items) {
      for (const key of ['question','docxQuestion','takeaway','answer','support']) assert.ok(q[key].trim(),`${ticket.number}: ${key}`);
    }
  }
  assert.equal(data.tickets[12].items[1].question,'Хто складає парафіяльний притч?');
  assert.deepEqual(data.tickets[16].items.map(q=>q.question),['Правила святих апостолів.','Священна ієрархія. Поставлення кліриків.']);
});

test('Comparison records source differences and retains all supplementary material', () => {
  assert.equal(data.verification.questionCount,44);
  assert.deepEqual(data.verification.wordingDifferences.map(d=>d.ticket),[9,10,12,13,14,15,16]);
  for (const diff of data.verification.wordingDifferences) {
    const item=data.tickets[diff.ticket-1].items[diff.item-1];
    assert.equal(item.question,diff.pdf);
    assert.equal(item.docxQuestion,diff.docx);
  }
  assert.equal(data.supplements.length,3);
  assert.equal(data.supplements[1].rows.length,13);
  assert.deepEqual(data.supplements[1].rows[0],['Тема','Связка']);
  assert.equal(data.supplements[2].paragraphs.length,5);
});

test('Unique shared filters cover every ticket', () => {
  const tags=data.filterGroups.flatMap(g=>g.tags);
  assert.equal(new Set(tags).size,tags.length);
  data.tickets.forEach(t=>t.tags.forEach(tag=>assert.ok(tags.includes(tag),tag)));
  assert.deepEqual(data.tickets.filter(t=>t.tags.includes('Поставление клириков')).map(t=>t.number),[4,6,17]);
});

test('Published data matches JSON and ticket selector uses local independent assets', () => {
  const context={window:{}};
  vm.runInNewContext(read('../dist/kanonicheskoe-pravo/questions.js'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.QUESTIONS_DATA)),data);
  const html=read('../dist/kanonicheskoe-pravo/index.html');
  for (const s of ['id="ticket-select"','Все билеты','src="app.js"','href="styles.css"','href="../"']) assert.ok(html.includes(s),s);
  assert.ok(!html.includes('../filter-switches.css'));
  assert.ok(!html.includes('Обзор Нового Завета'));
  assert.ok(!html.includes('три вопроса'));
  assert.ok(read('../dist/index.html').includes('href="kanonicheskoe-pravo/"'));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('Patrology has all 51 source prompts across ten answered sections',()=>{
 const d=JSON.parse(fs.readFileSync('content/patrologiya-questions.json','utf8'));
 assert.equal(d.questions.length,10);
 assert.equal(d.questions.reduce((n,q)=>n+(q.answer.match(/<li>/g)||[]).length,0),51);
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync('dist/patrologiya/questions.js','utf8'),ctx);
 assert.equal(JSON.stringify(ctx.window.PATROLOGY_DATA),JSON.stringify(d));
 assert.match(fs.readFileSync('dist/index.html','utf8'),/href="patrologiya\/"/);
});
test('Schedule marks past assessments and preserves separate course status',()=>{
 const cards=['patrologiya/','sravnitelnoe-bogoslovie/','sravnitelnoe-bogoslovie-3-kurs/','istoriya-russkoi-cerkvi/'].map(href=>({href,classes:[],labels:[],getAttribute(){return href},classList:{add(c){this.owner.classes.push(c)}},querySelector(){return {append:l=>this.labels.push(l.textContent)}}}));
 cards.forEach(c=>c.classList.owner=c);
 const ctx={window:{},Date:class extends Date{constructor(){super('2026-11-02T12:00:00Z')}},Intl,document:{querySelectorAll:()=>cards,createElement:()=>({})}};
 vm.runInNewContext(fs.readFileSync('dist/subject-schedule.js','utf8'),ctx);vm.runInNewContext(fs.readFileSync('dist/subject-status.js','utf8'),ctx);
 assert.equal(cards[0].classes.length,0);assert.equal(cards[1].classes.length,0);assert.ok(cards[2].classes.includes('subject-card--passed'));assert.ok(cards[3].classes.includes('subject-card--passed'));
});

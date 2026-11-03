import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
test('All subjects are reachable through the correct course and local links resolve',()=>{
 const root=read('dist/index.html');
 assert.equal((root.match(/class="subject-card"/g)||[]).length,3);
 const expected={2:['dogmatika','religii','katehizis','novyi-zavet'],3:['dogmatika','sravnitelnoe-bogoslovie','sravnitelnoe-bogoslovie-3-kurs','patrologiya'],4:['nravstvennoe-bogoslovie','sravnitelnoe-bogoslovie','cerkovnoe-iskusstvo','istoriya-russkoi-cerkvi','religioznye-dvizheniya','kanonicheskoe-pravo','istoriya-raskolov']};
 for(const [c,slugs] of Object.entries(expected)){
  const p=`dist/${c}-kurs/index.html`, html=read(p);
  assert.ok(root.includes(`href="${c}-kurs/"`));
  const actual=[...html.matchAll(/data-course="(\d)" href="\.\.\/([^/]+)\/(?:\?course=\d)?"/g)];
  assert.deepEqual(actual.map(m=>m[2]).sort(),slugs.sort());assert.ok(actual.every(m=>m[1]===c));
  for(const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
   if(/^(data:|https?:)/.test(m[1]))continue;
   const target=path.resolve(path.dirname(p),m[1].split('?')[0]);assert.ok(fs.existsSync(target),target);
  }
 }
});
test('Shared guides initially select the course in the link',()=>{
 for(const [slug,courses] of [['dogmatika',[2,3]],['sravnitelnoe-bogoslovie',[3,4]]])for(const course of [...courses,0]){
  const ctx={window:{location:{hash:'',search:course?'?course='+course:'',pathname:'/'},QUESTIONS_DATA:{questions:[]}},URLSearchParams,document:{querySelector:()=>null,querySelectorAll:()=>courses.map(c=>({dataset:{courseToggle:String(c)}}))}};
  const prefix=read(`dist/${slug}/app.js`).split('  let activeTag')[0];
  vm.runInNewContext(prefix+'globalThis.selection=[...activeCourses];})();',ctx);
  assert.deepEqual(Array.from(ctx.selection),course?[course]:courses);
 }
});

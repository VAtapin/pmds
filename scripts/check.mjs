import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(readFileSync(join(root,'content/library.json'),'utf8'));
assert.deepEqual(data.courses.map(x=>x.number),[3,4]);
assert.equal(data.courses[0].subjects.length,16);assert.equal(data.courses[1].subjects.length,17);
let lessonCount=0;
for(const course of data.courses)for(const subject of course.subjects){
 assert.equal(subject.course,course.number);
 assert.equal(new Set(subject.chapters.map(x=>x.id)).size,subject.chapters.length,subject.slug+' chapter ids');
 for(const chapter of subject.chapters){assert(chapter.title.trim());assert(chapter.html.trim());lessonCount++;}
 for(const doc of subject.documents)assert(data.documents.some(x=>x.id===doc.id));
}
const checks=[[3,'dogmatika',38],[4,'sravnitelnoe-bogoslovie',48],[4,'nravstvennoe-bogoslovie',12],[4,'cerkovnoe-iskusstvo',10],[4,'istoriya-cerkvi',39],[4,'kanonicheskoe-pravo',47]];
for(const [course,slug,n] of checks)assert.equal(data.courses.find(c=>c.number===course).subjects.find(s=>s.slug===slug).chapters.length,n,slug+' chapter count');
for(const doc of data.documents)if(doc.filename){const path=join(root,'materials',doc.filename);assert(existsSync(path),doc.filename);assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),doc.sha256,doc.filename+' integrity');}
const dist=join(root,'dist');
const files=[];function walk(path){for(const name of readdirSync(path)){const full=join(path,name);if(statSync(full).isDirectory())walk(full);else if(name.endsWith('.html'))files.push(full)}}walk(dist);
let linkCount=0;
for(const path of files){const body=readFileSync(path,'utf8');assert(!body.includes('undefined'),path);
 for(const match of body.matchAll(/(?:href|src)="([^"]+)"/g)){let link=match[1].replaceAll('&amp;','&');if(/^(https?:|mailto:|data:|#)/.test(link))continue;link=decodeURIComponent(link.split('#')[0].split('?')[0]);assert(existsSync(resolve(dirname(path),link)),`${path}: missing ${link}`);linkCount++;}
}
console.log(`Checked courses 3/4, 33 subjects, ${lessonCount} learning chapters, ${files.length} HTML pages and ${linkCount} local links.`);

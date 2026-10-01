import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../content/moral-theology-questions.json', import.meta.url), 'utf8'));
writeFileSync(new URL('../dist/nravstvennoe-bogoslovie/questions.js', import.meta.url),
  `window.QUESTIONS_DATA = ${JSON.stringify(data, null, 2)};\n`, 'utf8');
console.log(`Built ${data.questions.length} moral theology questions.`);

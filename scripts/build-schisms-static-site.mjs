import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../content/schisms-questions.json',import.meta.url),'utf8'));
fs.writeFileSync(new URL('../dist/istoriya-raskolov/questions.js',import.meta.url),'window.SCHISMS_DATA = '+JSON.stringify(data,null,2)+';\n');
console.log(`Built ${data.questions.length} schisms study cards`);

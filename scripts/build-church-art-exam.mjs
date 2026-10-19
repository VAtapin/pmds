import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'content/cerkovnoe-iskusstvo-questions.json');
const outputPath = resolve(root, 'dist/cerkovnoe-iskusstvo/questions.js');
const raw = readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(raw);
writeFileSync(outputPath, 'window.EXAM_DATA = ' + JSON.stringify(data, null, 2) + ';\n', 'utf8');

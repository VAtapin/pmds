import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const mammoth=require('mammoth');
const WordExtractor=require('word-extractor');
const wordExtractor=new WordExtractor();

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));

function legacyTextToHtml(text){
 const lines=String(text??'').replace(/\r\n?/g,'\n').split('\n');
 const blocks=[];
 for(const rawLine of lines){
  const line=rawLine.replace(/\u0000/g,'').trim();
  if(!line){continue;}
  if(line==='\f'){blocks.push('<hr>');continue;}
  const cells=line.split('\t');
  if(cells.length>1){
   blocks.push('<p class="legacy-tabular">'+cells.map(cell=>'<span>'+escapeHtml(cell.trim())+'</span>').join('')+'</p>');
  }else{
   blocks.push('<p>'+escapeHtml(line)+'</p>');
  }
 }
 return blocks.join('\n');
}

export async function convertWordDocument(filePath){
 const extension=filePath.toLowerCase().split('.').pop();
 if(extension==='docx'){
  const result=await mammoth.convertToHtml(
   {path:filePath},
   {ignoreEmptyParagraphs:false,externalFileAccess:false}
  );
  const html=result.value.trim();
  if(!html)throw new Error('DOCX conversion produced no readable content: '+filePath);
  if(result.messages.length){
   console.warn('Word conversion notes for '+filePath+': '+result.messages.map(item=>item.message).join(' | '));
  }
  return html;
 }
 if(extension==='doc'){
  const document=await wordExtractor.extract(filePath);
  const body=legacyTextToHtml(document.getBody());
  const notes=[
   ['Сноски',document.getFootnotes()],
   ['Концевые примечания',document.getEndnotes()]
  ].filter(([,value])=>String(value??'').trim());
  const noteHtml=notes.map(([title,value])=>'<section class="legacy-notes"><h2>'+title+'</h2>'+legacyTextToHtml(value)+'</section>').join('');
  if(!body&&!noteHtml)throw new Error('DOC conversion produced no readable content: '+filePath);
  return body+noteHtml;
 }
 throw new Error('Unsupported Word document extension: '+filePath);
}

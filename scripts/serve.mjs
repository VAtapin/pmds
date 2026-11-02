import {createServer} from 'node:http';
import {createReadStream,statSync} from 'node:fs';
import {resolve,dirname,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.argv[2]||8767);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.pdf':'application/pdf','.mp3':'audio/mpeg','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.doc':'application/msword'};
createServer((req,res)=>{
 try{
  let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  if(statSync(path).isDirectory())path=join(path,'index.html');
  const size=statSync(path).size;const headers={'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes'};
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),size-1):size-1;if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});createReadStream(path,{start,end}).pipe(res);}
  else{res.writeHead(200,{...headers,'Content-Length':size});createReadStream(path).pipe(res);}
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Страница не найдена');}
}).listen(port,'127.0.0.1',()=>console.log(`Local URL: http://127.0.0.1:${port}`));

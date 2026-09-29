import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { randomBytes } from 'node:crypto';

const root = normalize(new URL('../dist/', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'));
const port = Number(process.argv[2] || 4173);
const rooms = new Map();
const apiPath = '/kto-moi-blizhnii/sync.php';
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function code(length = 6) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = randomBytes(length);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

function cleanText(value, limit = 160) {
  return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, limit);
}

function publicRoom(room, teacherKey = '', studentId = '') {
  const now = Date.now();
  const students = Object.values(room.students).filter((student) => now - student.seenAt < 45000);
  const isTeacher = teacherKey && teacherKey === room.teacherKey;
  const state = structuredClone(room.state);
  if (!isTeacher && Array.isArray(state.studentPosts)) {
    state.studentPosts = state.studentPosts.filter((post) => post.status === 'approved');
  }
  const result = {
    ok: true,
    room: room.code,
    revision: room.revision,
    updatedAt: room.updatedAt,
    state,
    connectedCount: students.length,
    totals: room.responses.reduce((accumulator, item) => {
      const key = `${item.scene}:${item.type}:${item.value || 'text'}`;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {})
  };

  if (isTeacher) {
    result.students = students.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    result.responses = room.responses.slice(-120).reverse();
  }
  if (!isTeacher && studentId && Array.isArray(room.studentMessages?.[studentId])) {
    result.studentMessages = room.studentMessages[studentId].slice(-20);
  }

  return result;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 262144) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function handleSync(request, response, url) {
  if (request.method === 'GET') {
    const roomCode = cleanText(url.searchParams.get('room'), 8).toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) return sendJson(response, 404, { ok: false, error: 'Класс не найден' });
    return sendJson(response, 200, publicRoom(
      room,
      cleanText(url.searchParams.get('teacherKey'), 80),
      cleanText(url.searchParams.get('studentId'), 80)
    ));
  }

  if (request.method !== 'POST') {
    return sendJson(response, 405, { ok: false, error: 'Метод не поддерживается' });
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    return sendJson(response, 400, { ok: false, error: 'Некорректные данные' });
  }

  if (body.action === 'create') {
    let roomCode;
    do roomCode = code(); while (rooms.has(roomCode));
    const room = {
      code: roomCode,
      teacherKey: randomBytes(24).toString('hex'),
      revision: 1,
      updatedAt: Date.now(),
      state: body.state && typeof body.state === 'object' ? body.state : {},
      students: {},
      responses: [],
      studentMessages: {}
    };
    rooms.set(roomCode, room);
    return sendJson(response, 201, { ...publicRoom(room, room.teacherKey), teacherKey: room.teacherKey });
  }

  const roomCode = cleanText(body.room, 8).toUpperCase();
  const room = rooms.get(roomCode);
  if (!room) return sendJson(response, 404, { ok: false, error: 'Класс не найден' });

  if (body.action === 'update' || body.action === 'clearResponses') {
    if (cleanText(body.teacherKey, 80) !== room.teacherKey) {
      return sendJson(response, 403, { ok: false, error: 'Нет доступа учителя' });
    }
    if (body.action === 'update' && body.state && typeof body.state === 'object') {
      const studentPosts = Array.isArray(room.state.studentPosts) ? room.state.studentPosts : [];
      room.state = { ...body.state, studentPosts };
    }
    if (body.action === 'clearResponses') {
      room.responses = [];
      room.state.studentPosts = [];
    }
    room.revision += 1;
    room.updatedAt = Date.now();
    return sendJson(response, 200, publicRoom(room, room.teacherKey));
  }

  if (body.action === 'moderatePost') {
    if (cleanText(body.teacherKey, 80) !== room.teacherKey) {
      return sendJson(response, 403, { ok: false, error: 'Нет доступа учителя' });
    }
    const postId = cleanText(body.postId, 80);
    const posts = Array.isArray(room.state.studentPosts) ? room.state.studentPosts : [];
    if (body.operation === 'delete') {
      room.state.studentPosts = posts.filter((post) => post.id !== postId);
    } else if (body.operation === 'approve') {
      room.state.studentPosts = posts.map((post) => post.id === postId ? { ...post, status: 'approved' } : post);
    } else if (body.operation === 'edit') {
      const nextText = cleanText(body.text, 180);
      room.state.studentPosts = posts.map((post) => post.id === postId ? { ...post, text: nextText, edited: true } : post);
    } else if (body.operation === 'reply') {
      const post = posts.find((candidate) => candidate.id === postId);
      const message = cleanText(body.message, 180);
      if (post && message) {
        room.studentMessages[post.studentId] ||= [];
        room.studentMessages[post.studentId].push({ id: `${Date.now()}-${code(4)}`, text: message, createdAt: Date.now() });
        room.studentMessages[post.studentId] = room.studentMessages[post.studentId].slice(-20);
      }
    }
    room.revision += 1;
    room.updatedAt = Date.now();
    return sendJson(response, 200, publicRoom(room, room.teacherKey));
  }

  const studentId = cleanText(body.studentId, 80);
  const studentName = cleanText(body.name, 32) || 'Ученик';
  if (!studentId) return sendJson(response, 400, { ok: false, error: 'Не указан ученик' });
  room.students[studentId] = {
    id: studentId,
    name: studentName,
    score: Math.max(0, Math.min(99, Number(body.score) || 0)),
    seenAt: Date.now()
  };

  if (body.action === 'respond') {
    const responseId = `${Date.now()}-${code(4)}`;
    const responseItem = {
      id: responseId,
      studentId,
      name: studentName,
      scene: Math.max(0, Math.min(12, Number(body.scene) || 0)),
      type: cleanText(body.type, 32),
      value: cleanText(body.value, 80),
      text: cleanText(body.text, 180),
      score: room.students[studentId].score,
      createdAt: Date.now()
    };
    const duplicate = room.responses.find((item) => item.studentId === responseItem.studentId
      && item.scene === responseItem.scene
      && item.type === responseItem.type
      && item.value.toLocaleLowerCase('ru') === responseItem.value.toLocaleLowerCase('ru')
      && item.text.toLocaleLowerCase('ru') === responseItem.text.toLocaleLowerCase('ru'));
    if (duplicate) return sendJson(response, 200, publicRoom(room));
    room.responses.push(responseItem);
    const sharedTypes = new Set(['excuse', 'school_help', 'promise', 'takeaway']);
    if (responseItem.text && sharedTypes.has(responseItem.type)) {
      const posts = Array.isArray(room.state.studentPosts) ? room.state.studentPosts : [];
      posts.push({
        id: responseId,
        studentId,
        name: studentName,
        scene: responseItem.scene,
        type: responseItem.type,
        text: responseItem.text,
        status: 'pending',
        createdAt: responseItem.createdAt
      });
      room.state.studentPosts = posts.slice(-160);
    }
    if (room.responses.length > 500) room.responses = room.responses.slice(-350);
    room.revision += 1;
    room.updatedAt = Date.now();
  }

  return sendJson(response, 200, publicRoom(room));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestPath = decodeURIComponent(url.pathname);

  if (requestPath === apiPath) {
    await handleSync(request, response, url);
    return;
  }

  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  let filePath = normalize(join(root, relativePath));

  if (filePath.startsWith(root) && existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = normalize(join(filePath, 'index.html'));
  }

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': types[extname(filePath)] || 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
});

setInterval(() => {
  const expiry = Date.now() - 12 * 60 * 60 * 1000;
  rooms.forEach((room, roomCode) => {
    if (room.updatedAt < expiry) rooms.delete(roomCode);
  });
}, 30 * 60 * 1000).unref();

server.listen(port, '127.0.0.1', () => {
  console.log(`Local URL: http://127.0.0.1:${port}`);
});

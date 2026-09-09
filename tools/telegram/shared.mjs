import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const empty = () => ({ version: 1, status: '', updatedAt: null, items: [] });
const now = () => new Date().toISOString();
function paths(project) {
  const dir = path.join(project, '.handoff');
  return { dir, file: path.join(dir, 'state.json'), lock: path.join(dir, 'state.lock') };
}
export function state(project) {
  try { return JSON.parse(fs.readFileSync(paths(project).file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return empty(); throw error; }
}
function update(project, operation) {
  const { dir, file, lock } = paths(project);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // No automatic stale-lock stealing: a crashed writer requires operator inspection.
  try { fs.mkdirSync(lock, { mode: 0o700 }); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Sdílený stav je zamčený; zopakuj požadavek později.'); throw error; }
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    const data = state(project);
    const result = operation(data);
    data.updatedAt = now();
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
    return result;
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.rmdirSync(lock);
  }
}
function text(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 8000) throw new Error('Text musí mít 1 až 8000 znaků.');
  return value.trim();
}
export function publish(project, summary) {
  return update(project, data => { data.status = text(summary); return 'Stav aktualizován.'; });
}
export function add(project, kind, content, externalId = null) {
  if (!['task', 'question', 'conversation'].includes(kind)) throw new Error('Neznámý typ.');
  const validated = text(content);
  return update(project, data => {
    const existing = externalId && data.items.find(item => item.externalId === externalId);
    if (existing) return existing;
    if (data.items.length >= 500) throw new Error('Sdílený záznam je plný; je potřeba ruční archivace.');
    const item = { id: crypto.randomBytes(6).toString('hex'), kind, text: validated,
      status: kind === 'question' ? 'waiting' : 'queued', createdAt: now(), externalId };
    data.items.push(item); return item;
  });
}
export function answer(project, id, response) {
  return update(project, data => {
    const item = data.items.find(item => item.id === id && item.kind === 'question');
    if (!item || item.status !== 'waiting') throw new Error('Otázka neexistuje nebo už byla zodpovězena.');
    item.answer = text(response); item.status = 'answered'; item.answeredAt = now();
    return item;
  });
}
export function claim(project, id, worker) {
  return update(project, data => {
    const item = data.items.find(item => item.id === id && item.kind === 'task');
    if (!item || item.status !== 'queued') throw new Error('Úkol není ve frontě.');
    if (data.items.some(item => item.kind === 'task' && item.status === 'running')) throw new Error('Jiný úkol už je převzatý.');
    item.worker = text(worker); item.status = 'running'; item.startedAt = now(); return item;
  });
}
export function finish(project, id, worker, result, status = 'done') {
  if (!['done', 'blocked'].includes(status)) throw new Error('Neplatný stav.');
  return update(project, data => {
    const item = data.items.find(item => item.id === id);
    if (!item || !['task', 'conversation'].includes(item.kind)) throw new Error('Úkol neexistuje.');
    if (item.kind === 'task' && (item.status !== 'running' || item.worker !== worker)) throw new Error('Úkol vlastní jiná relace nebo neběží.');
    item.result = text(result); item.status = status; item.finishedAt = now(); return item;
  });
}
export function pendingQuestions(project) {
  return state(project).items.filter(item => item.kind === 'question' && item.status === 'waiting' && !item.notifiedAt);
}
export function notified(project, id) {
  return update(project, data => {
    const item = data.items.find(item => item.id === id);
    if (item) item.notifiedAt = now();
  });
}
export function snapshot(project) {
  const data = state(project);
  return JSON.stringify({ status: data.status, updatedAt: data.updatedAt,
    items: data.items.slice(-20).map(item => ({ ...item, text: item.text.slice(0, 1500), result: item.result?.slice(0, 2000) })) }, null, 2);
}
export function telegramCommand(project, message) {
  const match = message.text.trim().match(/^(\/\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const [, command, body = ''] = match;
  if (command === '/task') {
    const item = add(project, 'task', body, `telegram-task:${message.chat.id}:${message.message_id}`);
    return `Úkol ${item.id} uložen (${item.status}). Pracovní relace jej převezme při dalším běhu; tímto se neprobouzí.`;
  }
  if (command === '/reply') {
    const [id, ...words] = body.trim().split(/\s+/);
    answer(project, id, words.join(' '));
    return `Odpověď k otázce ${id} uložena. Nejde o schválení systémového oprávnění Codexu.`;
  }
  if (command === '/shared') return snapshot(project);
  if (command === '/tasks') return state(project).items.filter(item => item.kind === 'task').slice(-15)
    .map(item => `${item.id} [${item.status}] ${item.text.slice(0, 180)}${item.result ? `\nVýsledek: ${item.result.slice(0, 400)}` : ''}`).join('\n') || 'Žádné úkoly.';
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  const project = process.cwd();
  try {
    let result;
    if (command === 'show') result = state(project);
    else if (command === 'publish') result = publish(project, args.join(' '));
    else if (command === 'ask') result = add(project, 'question', args.join(' '));
    else if (command === 'claim') result = claim(project, args[0], args[1]);
    else if (command === 'finish') result = finish(project, args[0], args[1], args.slice(3).join(' '), args[2]);
    else throw new Error('Příkazy: show | publish TEXT | ask OTÁZKA | claim ID RELACE | finish ID RELACE done/blocked VÝSLEDEK');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

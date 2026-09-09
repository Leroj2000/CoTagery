import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { state, add, answer, claim, finish, publish, snapshot, telegramCommand, pendingQuestions, notified } from './shared.mjs';

test('shared tasks, questions and status lifecycle', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'tagery-shared-test-'));
  try {
    assert.deepEqual(state(project).items, []);
    publish(project, 'Ready');
    const task = add(project, 'task', 'Implement feature', 'message-1');
    assert.equal(add(project, 'task', 'duplicate', 'message-1').id, task.id);
    claim(project, task.id, 'main');
    const second = add(project, 'task', 'Next');
    assert.throws(() => claim(project, second.id, 'other'));
    assert.throws(() => finish(project, task.id, 'other', 'done'));
    finish(project, task.id, 'main', 'Verified');
    assert.equal(state(project).items[0].status, 'done');
    const question = add(project, 'question', 'Approve this specific change?');
    assert.equal(pendingQuestions(project).length, 1);
    notified(project, question.id);
    assert.equal(pendingQuestions(project).length, 0);
    answer(project, question.id, 'Yes');
    assert.throws(() => answer(project, question.id, 'No'));
    assert.ok(snapshot(project).includes('Yes'));
    assert.equal(fs.statSync(path.join(project, '.handoff/state.json')).mode & 0o777, 0o600);
    fs.mkdirSync(path.join(project, '.handoff/state.lock'));
    assert.throws(() => publish(project, 'conflict'), /zamčený/);
    assert.equal(state(project).status, 'Ready');
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});
test('Telegram commands store prompts and matched replies', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'tagery-shared-test-'));
  const message = text => ({ text, chat: { id: 123 }, message_id: 456 });
  try {
    assert.match(telegramCommand(project, message('/task@TageryBot Implement this')), /uložen/);
    assert.equal(state(project).items.length, 1);
    telegramCommand(project, message('/task@TageryBot Implement this'));
    assert.equal(state(project).items.length, 1);
    assert.match(telegramCommand(project, message('/tasks')), /Implement this/);
    const q = add(project, 'question', 'Which option?');
    telegramCommand(project, message(`/reply ${q.id} Option two`));
    assert.equal(state(project).items[1].answer, 'Option two');
    assert.throws(() => telegramCommand(project, message('/reply missing yes')));
    assert.throws(() => telegramCommand(project, message('/task')));
    assert.equal(telegramCommand(project, message('normal prompt')), null);
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

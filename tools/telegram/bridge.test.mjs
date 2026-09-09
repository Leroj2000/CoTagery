import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { allowed, pair, chunks, codexArgs, runCodex, read } from './bridge.mjs';

const message = { chat: { id: 123, type: 'private' }, from: { id: 123 }, text: '/pair secret' };
const pairing = { code: 'secret', expiresAt: 100, attempts: 0 };
test('pairing binds a private chat and sender', () => {
  assert.deepEqual(pair(message, pairing, null, 99), { userId: 123, chatId: 123 });
});
test('expired, exhausted, wrong and already used codes are rejected', () => {
  assert.equal(pair(message, pairing, null, 100), null);
  assert.equal(pair(message, { ...pairing, attempts: 10 }, null, 99), null);
  assert.equal(pair({ ...message, text: '/pair wrong' }, pairing, null, 99), null);
  assert.equal(pair(message, pairing, { userId: 1 }, 99), null);
});
test('groups, bots and another sender cannot pair or access', () => {
  const owner = { userId: 123, chatId: 123 };
  assert.equal(allowed(message, owner), true);
  assert.equal(allowed({ ...message, from: { id: 124 } }, owner), false);
  for (const invalid of [{ ...message, chat: { id: 123, type: 'group' } }, { ...message, from: { id: 123, is_bot: true } }]) {
    assert.equal(pair(invalid, pairing, null, 99), null);
    assert.equal(allowed(invalid, owner), false);
  }
});
test('long Unicode answers split without data loss', () => {
  const text = '🙂x'.repeat(4000);
  const parts = chunks(text);
  assert.equal(parts.join(''), text);
  assert.ok(parts.every(part => part.length <= 3900 && !/[\uD800-\uDBFF]$/.test(part)));
});
test('first request forks; subsequent requests resume only the branch', () => {
  const config = { project: '/project', sourceSession: 'source' };
  const first = codexArgs(config, null, '/output');
  assert.ok(first.includes('fork')); assert.ok(first.includes('source'));
  assert.ok(first.includes('read-only')); assert.ok(first.includes('approval_policy="never"'));
  assert.ok(!first.includes('--approve-for-me'));
  const next = codexArgs(config, 'branch', '/output');
  assert.ok(next.includes('resume')); assert.ok(!next.includes('source'));
});
test('subprocess saves a separate branch, resumes it and hides failures', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tagery-bot-test-'));
  const executable = path.join(directory, 'fake-codex');
  fs.copyFileSync(new URL('./fixtures/fake-codex.mjs', import.meta.url), executable);
  fs.chmodSync(executable, 0o700);
  const config = { project: directory, codexBin: executable, codexHome: directory,
    sourceSession: '11111111-1111-1111-1111-111111111111', timeoutMs: 10000 };
  try {
    assert.equal(await runCodex(config, directory, 'hello'), 'TEST_OK');
    assert.equal(read(path.join(directory, 'session.json')), '22222222-2222-2222-2222-222222222222');
    assert.equal(await runCodex(config, directory, 'again'), 'TEST_OK');
    await assert.rejects(runCodex(config, directory, 'FAIL_TEST'), error => !error.message.includes('PRIVATE_ERROR'));
    await assert.rejects(runCodex(config, directory, 'SOURCE_TEST'), /samostatná relace/);
    await assert.rejects(runCodex({ ...config, timeoutMs: 150 }, directory, 'TIMEOUT_TEST'));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

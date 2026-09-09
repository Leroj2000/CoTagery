#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
let prompt = '';
for await (const part of process.stdin) prompt += part;
if (prompt.includes('FAIL_TEST')) { console.error('PRIVATE_ERROR_MUST_NOT_LEAK'); process.exit(1); }
if (prompt.includes('TIMEOUT_TEST')) await new Promise(resolve => setTimeout(resolve, 60000));
const id = prompt.includes('SOURCE_TEST') ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222';
console.log(JSON.stringify({ type: 'thread.started', thread_id: id }));
fs.writeFileSync(args[args.indexOf('-o') + 1], 'TEST_OK');

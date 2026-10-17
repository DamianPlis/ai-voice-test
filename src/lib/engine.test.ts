import test from 'node:test';
import assert from 'node:assert/strict';
import { createKokoroTextStream } from './engine';

test('Kokoro text stream flushes its final sentence and terminates', { timeout: 5000 }, async () => {
  const sentences: string[] = [];
  for await (const sentence of await createKokoroTextStream('Hello! This last sentence has no full stop')) sentences.push(sentence);
  assert.equal(sentences.join(' '), 'Hello! This last sentence has no full stop');
});

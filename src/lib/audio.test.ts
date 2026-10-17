import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeWav, formatTime, waveformPeaks } from './audio';
import { splitTtsText } from './engine';

test('encodeWav writes a mono 16-bit PCM WAV with clamped samples', async () => {
  const wav = encodeWav(new Float32Array([-1, 0, 1, 2]), 16_000);
  const bytes = new DataView(await wav.arrayBuffer());
  assert.equal(wav.type, 'audio/wav');
  assert.equal(bytes.getUint32(24, true), 16_000);
  assert.equal(bytes.getUint16(22, true), 1);
  assert.equal(bytes.getUint16(34, true), 16);
  assert.equal(bytes.getInt16(44, true), -32768);
  assert.equal(bytes.getInt16(48, true), 32767);
});

test('encodeWav rejects invalid input', () => {
  assert.throws(() => encodeWav(new Float32Array(), 24_000), /non-empty/);
  assert.throws(() => encodeWav(new Float32Array([0]), 0), /Sample rate/);
  assert.throws(() => encodeWav(new Float32Array([Number.NaN]), 24_000), /finite/);
});

test('waveformPeaks covers the full signal and fills empty bins with zero', () => {
  assert.deepEqual(waveformPeaks(new Float32Array([-0.2, 0.5, -1, 0.25]), 2), [0.5, 1]);
  assert.deepEqual(waveformPeaks(new Float32Array([0.4]), 3), [0, 0, Math.fround(0.4)]);
  assert.throws(() => waveformPeaks(new Float32Array([0]), 0), /positive integer/);
});

test('formatTime handles minutes, negative values, and invalid values', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(65.9), '1:05');
  assert.equal(formatTime(-2), '0:00');
  assert.equal(formatTime(Number.NaN), '0:00');
});

test('splitTtsText keeps a long unpunctuated script complete at word boundaries', () => {
  const text = 'This sentence keeps going without punctuation. '.replace('.', '') + 'word '.repeat(450);
  const chunks = splitTtsText(text, 120);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 120));
  assert.equal(chunks.join(''), text);
});

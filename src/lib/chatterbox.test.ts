import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeDefaultWav } from './chatterbox';

test('decodeDefaultWav reads PCM16 samples from a RIFF WAV', () => {
  const buffer = new ArrayBuffer(50);
  const view = new DataView(buffer);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  tag(0, 'RIFF');
  view.setUint32(4, 42, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24_000, true);
  view.setUint32(28, 48_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, 6, true);
  view.setInt16(44, -32768, true);
  view.setInt16(46, 0, true);
  view.setInt16(48, 16384, true);

  assert.deepEqual(decodeDefaultWav(buffer), new Float32Array([-1, 0, 0.5]));
});

test('decodeDefaultWav rejects malformed and unsupported WAV data', () => {
  assert.throws(() => decodeDefaultWav(new ArrayBuffer(44)), /valid WAV/);

  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, 'RIFF');
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 6, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24_000, true);
  view.setUint32(28, 48_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, 0, true);

  assert.throws(() => decodeDefaultWav(buffer), /unsupported audio format/);
});

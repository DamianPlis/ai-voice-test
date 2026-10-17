export function encodeWav(samples: Float32Array, rate: number): Blob {
  if (!(samples instanceof Float32Array) || samples.length === 0) throw new Error('Audio samples must be a non-empty Float32Array.');
  if (!Number.isInteger(rate) || rate < 1 || rate > 384_000) throw new Error('Sample rate must be an integer between 1 and 384000 Hz.');
  if (samples.some((sample) => !Number.isFinite(sample))) throw new Error('Audio samples must be finite numbers.');

  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * bytesPerSample, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return new Blob([buffer], { type: 'audio/wav' });
}

export function waveformPeaks(samples: Float32Array, bins: number): number[] {
  if (!Number.isInteger(bins) || bins < 1) throw new Error('Waveform bins must be a positive integer.');
  const peaks = new Array<number>(bins).fill(0);
  for (let bin = 0; bin < bins; bin++) {
    const start = Math.floor((bin * samples.length) / bins);
    const end = Math.floor(((bin + 1) * samples.length) / bins);
    for (let i = start; i < end; i++) peaks[bin] = Math.max(peaks[bin], Math.abs(samples[i]));
  }
  return peaks;
}

export function formatTime(seconds: number): string {
  const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

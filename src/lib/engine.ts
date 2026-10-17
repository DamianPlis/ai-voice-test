import type { TtsDevice, TtsDtype } from './models';

export const MAX_TTS_TEXT_LENGTH = 2500;
export const MAX_CHATTERBOX_TEXT_LENGTH = 200;
export const MAX_KOKORO_CHUNK_LENGTH = 200;

export async function createKokoroTextStream(text: string) {
  const { TextSplitterStream } = await import('kokoro-js');
  const splitter = new TextSplitterStream();
  splitter.push(text);
  // Kokoro's string overload stays open; close the splitter to finish the batch.
  splitter.close();
  return splitter;
}

/** Split long text at word boundaries without dropping whitespace or punctuation. */
export function splitTtsText(text: string, maxLength = MAX_KOKORO_CHUNK_LENGTH): string[] {
  if (!Number.isSafeInteger(maxLength) || maxLength < 1) {
    throw new Error('Chunk length must be a positive integer.');
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxLength, text.length);
    if (end < text.length) {
      const candidate = text.slice(start, end);
      const boundaries = [...candidate.matchAll(/\s+/g)];
      const boundary = boundaries.at(-1);
      const wordEnd = boundary?.index === undefined ? -1 : boundary.index + boundary[0].length;
      if (wordEnd > Math.floor(maxLength / 2)) {
        end = start + wordEnd;
      } else if (end > start && end < text.length) {
        const previous = text.charCodeAt(end - 1);
        const next = text.charCodeAt(end);
        if (previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end -= 1;
      }
    }
    if (end === start) end = Math.min(start + 2, text.length);
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

type TtsRequestOptions = {
  requestId: string;
  modelId: string;
  device: TtsDevice;
  dtype: TtsDtype;
  voice?: string;
  speed?: number;
  referenceAudio?: Float32Array;
};

export type TtsRequest =
  | ({ type: 'load' } & TtsRequestOptions)
  | ({ type: 'generate'; text: string } & TtsRequestOptions);

export type TtsResponse =
  | { type: 'progress'; requestId: string; status: string; file?: string; progress?: number; loaded?: number; total?: number }
  | { type: 'loaded'; requestId: string; modelId: string; device: TtsDevice; dtype: TtsDtype; voices?: string[] }
  | { type: 'result'; requestId: string; audio: Float32Array; samplingRate: number; generationMs: number }
  | { type: 'error'; requestId: string; message: string };

export function validateTtsText(text: string, maxLength = MAX_TTS_TEXT_LENGTH): string {
  if (typeof text !== 'string') throw new Error('Text must be a string.');
  if (text.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Enter some text to generate speech.');
  return trimmed;
}

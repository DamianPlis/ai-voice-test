import { getModel } from './models';
import { MAX_CHATTERBOX_TEXT_LENGTH, MAX_KOKORO_CHUNK_LENGTH, createKokoroTextStream, splitTtsText, validateTtsText } from './engine';
import type { TtsRequest, TtsResponse } from './engine';
import type { TtsDevice, TtsDtype } from './models';
import { loadChatterbox } from './chatterbox';

type WorkerScope = {
  addEventListener(type: 'message', listener: (event: MessageEvent<TtsRequest>) => void): void;
  postMessage(message: TtsResponse, transfer?: Transferable[]): void;
};

type AudioResult = { audio: Float32Array; samplingRate: number };
type KokoroSession = {
  model: { dispose(): Promise<void> };
  voices: Readonly<Record<string, unknown>>;
  tokenizer: (text: string, options: { truncation: false }) => { input_ids: { dims: number[] } };
  stream: (text: import('kokoro-js').TextSplitterStream, options: { voice: string; speed: number }) => AsyncIterable<{
    text: string;
    phonemes: string;
    audio: { audio: Float32Array };
  }>;
};
// The tokenizer includes two special tokens alongside up to 510 phoneme tokens.
const MAX_KOKORO_INPUT_TOKENS = 512;
type LoadedSession = {
  modelId: string;
  device: TtsDevice;
  dtype: TtsDtype;
  voices: string[];
  generate: (text: string, voice: string, speed: number, referenceAudio?: Float32Array) => Promise<AudioResult>;
  dispose: () => Promise<void>;
};

const worker = self as unknown as WorkerScope;
let loaded: LoadedSession | undefined;
let queue = Promise.resolve();

function send(message: TtsResponse, transfer?: Transferable[]): void {
  worker.postMessage(message, transfer);
}

function sendProgress(requestId: string, info: { status?: string; file?: string; progress?: number; loaded?: number; total?: number }): void {
  send({
    type: 'progress',
    requestId,
    status: info.status ?? 'progress',
    ...(typeof info.file === 'string' ? { file: info.file } : {}),
    ...(typeof info.progress === 'number' ? { progress: info.progress } : {}),
    ...(typeof info.loaded === 'number' ? { loaded: info.loaded } : {}),
    ...(typeof info.total === 'number' ? { total: info.total } : {}),
  });
}

function concatenateAudio(parts: Float32Array[]): Float32Array {
  const audio = new Float32Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    audio.set(part, offset);
    offset += part.length;
  }
  return audio;
}

async function generateKokoroAudio(tts: KokoroSession, text: string, voice: string, speed: number): Promise<Float32Array> {
  const parts: Float32Array[] = [];
  const synthesize = async (segmentText: string): Promise<void> => {
    const splitter = await createKokoroTextStream(segmentText);
    for await (const segment of tts.stream(splitter, { voice, speed })) {
      const { input_ids } = tts.tokenizer(segment.phonemes, { truncation: false });
      const tokenCount = input_ids.dims[input_ids.dims.length - 1] ?? 0;
      if (tokenCount > MAX_KOKORO_INPUT_TOKENS) {
        const chunkLength = Math.min(MAX_KOKORO_CHUNK_LENGTH, Math.max(1, Math.floor(segment.text.length / 2)));
        const chunks = splitTtsText(segment.text, chunkLength);
        if (chunks.length < 2 || chunks.some((chunk) => chunk.length >= segment.text.length)) {
          throw new Error('A Kokoro text segment is too long to split safely.');
        }
        for (const chunk of chunks) await synthesize(chunk);
      } else {
        parts.push(segment.audio.audio);
      }
    }
  };

  for (const chunk of splitTtsText(text, MAX_KOKORO_CHUNK_LENGTH)) await synthesize(chunk);
  if (parts.length === 0) throw new Error('Kokoro did not return any audio.');
  return concatenateAudio(parts);
}

function validateLoad(request: TtsRequest): void {
  const model = getModel(request.modelId);
  if (!model) throw new Error(`Unknown model: ${request.modelId}`);
  if (!['wasm', 'webgpu'].includes(request.device) || !['q8', 'fp32'].includes(request.dtype)) {
    throw new Error('Unsupported device or model precision.');
  }
  if (model.family === 'mms' && (request.device !== 'wasm' || request.dtype !== 'q8')) {
    throw new Error('MMS models support q8 on WASM only.');
  }
  if (model.family === 'kokoro' && (request.device === 'webgpu' ? request.dtype !== 'fp32' : request.dtype !== 'q8')) {
    throw new Error('Kokoro uses q8 on WASM and fp32 on WebGPU.');
  }
  if (request.device === 'webgpu' && !('gpu' in navigator)) {
    throw new Error('WebGPU is not available in this browser.');
  }
}

async function disposeLoaded(): Promise<void> {
  const previous = loaded;
  loaded = undefined;
  await previous?.dispose();
}

async function load(request: Extract<TtsRequest, { type: 'load' }>): Promise<void> {
  const model = getModel(request.modelId);
  if (!model) throw new Error(`Unknown model: ${request.modelId}`);
  validateLoad(request);
  await disposeLoaded();

  const progress_callback = (info: { status?: string; file?: string; progress?: number; loaded?: number; total?: number }) => {
    sendProgress(request.requestId, info);
  };

  if (model.family === 'kokoro') {
    const { KokoroTTS } = await import('kokoro-js');
    const tts = await KokoroTTS.from_pretrained(model.repo, {
      dtype: request.dtype,
      device: request.device,
      progress_callback,
    }) as unknown as KokoroSession;
    loaded = {
      modelId: request.modelId,
      device: request.device,
      dtype: request.dtype,
      voices: Object.keys(tts.voices),
      generate: async (text, voice, speed) => {
        const audio = await generateKokoroAudio(tts, text, voice, speed);
        return { audio, samplingRate: 24_000 };
      },
      dispose: async () => { await tts.model.dispose(); },
    };
  } else if (model.family === 'mms') {
    const { pipeline } = await import('@huggingface/transformers');
    const synthesizer = await pipeline('text-to-speech', model.repo, {
      dtype: request.dtype,
      device: request.device,
      progress_callback,
    });
    loaded = {
      modelId: request.modelId,
      device: request.device,
      dtype: request.dtype,
      voices: [],
      generate: async (text) => {
        const result = await synthesizer(text, {});
        return { audio: result.audio, samplingRate: result.sampling_rate };
      },
      dispose: async () => { await synthesizer.dispose(); },
    };
  } else {
    const session = await loadChatterbox(request.device, progress_callback);
    loaded = {
      modelId: request.modelId,
      device: request.device,
      dtype: request.dtype,
      voices: ['default'],
      generate: async (text, _voice, _speed, referenceAudio) => ({
        audio: await session.generate(text, referenceAudio),
        samplingRate: 24_000,
      }),
      dispose: () => session.dispose(),
    };
  }

  send({
    type: 'loaded',
    requestId: request.requestId,
    modelId: request.modelId,
    device: request.device,
    dtype: request.dtype,
    voices: loaded.voices,
  });
}

async function generate(request: Extract<TtsRequest, { type: 'generate' }>): Promise<void> {
  const session = loaded;
  if (!session || session.modelId !== request.modelId || session.device !== request.device || session.dtype !== request.dtype) {
    throw new Error('Load the selected model before generating speech.');
  }
  const model = getModel(request.modelId);
  if (!model) throw new Error(`Unknown model: ${request.modelId}`);
  const text = validateTtsText(request.text, model.family === 'chatterbox' ? MAX_CHATTERBOX_TEXT_LENGTH : undefined);
  const voice = request.voice ?? 'af_heart';
  if (model.family === 'kokoro' && !model.voices.includes(voice)) throw new Error(`Unknown voice: ${voice}`);
  const speed = request.speed ?? 1;
  if (model.family === 'kokoro' && (!Number.isFinite(speed) || speed < 0.5 || speed > 2)) {
    throw new Error('Speed must be between 0.5 and 2.');
  }

  const startedAt = performance.now();
  const { audio, samplingRate } = await session.generate(text, voice, speed, request.referenceAudio);
  if (!(audio instanceof Float32Array) || audio.length === 0 || !Number.isFinite(samplingRate) || samplingRate <= 0) {
    throw new Error('The model returned invalid audio.');
  }
  const transferableAudio = Float32Array.from(audio);
  send({
    type: 'result',
    requestId: request.requestId,
    audio: transferableAudio,
    samplingRate,
    generationMs: performance.now() - startedAt,
  }, [transferableAudio.buffer]);
}

async function handle(request: TtsRequest): Promise<void> {
  try {
    if (!request || typeof request.requestId !== 'string' || !request.requestId) throw new Error('Invalid request ID.');
    if (request.type === 'load') await load(request);
    else if (request.type === 'generate') await generate(request);
    else throw new Error('Unknown worker request.');
  } catch (error) {
    send({
      type: 'error',
      requestId: request?.requestId ?? '',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

worker.addEventListener('message', (event) => {
  queue = queue.then(() => handle(event.data));
});

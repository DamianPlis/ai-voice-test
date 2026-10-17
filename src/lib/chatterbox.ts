import type { ChatterboxModel as ChatterboxModelType, Tensor as TensorType } from '@hf/transformers-v4';

const MODEL_ID = 'onnx-community/chatterbox-ONNX';
const DEFAULT_VOICE_URL = `https://huggingface.co/${MODEL_ID}/resolve/main/default_voice.wav`;
const SAMPLE_RATE = 24_000;
const MAX_TEXT_LENGTH = 200;
const MAX_REFERENCE_SECONDS = 30;

const loadTransformers = () => import('@hf/transformers-v4');

type ProgressCallback = (event: any) => void;

export type ChatterboxSession = {
  generate(text: string, referenceAudio?: Float32Array): Promise<Float32Array>;
  dispose(): Promise<void>;
};

export function decodeDefaultWav(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer);
  if (view.byteLength < 44 || readTag(view, 0) !== 'RIFF' || readTag(view, 8) !== 'WAVE') {
    throw new Error('The default Chatterbox voice is not a valid WAV file.');
  }

  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let blockAlign = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > view.byteLength) throw new Error('The default Chatterbox WAV is truncated.');

    switch (readTag(view, offset)) {
      case 'fmt ':
        if (chunkSize < 16) throw new Error('The default Chatterbox WAV has an invalid format chunk.');
        format = view.getUint16(chunkStart, true);
        channels = view.getUint16(chunkStart + 2, true);
        sampleRate = view.getUint32(chunkStart + 4, true);
        blockAlign = view.getUint16(chunkStart + 12, true);
        bitsPerSample = view.getUint16(chunkStart + 14, true);
        break;
      case 'data':
        dataOffset = chunkStart;
        dataLength = chunkSize;
        break;
    }
    offset = chunkEnd + (chunkSize & 1);
  }

  const bytesPerSample = bitsPerSample / 8;
  if (
    dataOffset < 0 || !channels || !sampleRate || !bytesPerSample ||
    blockAlign !== channels * bytesPerSample || dataLength % blockAlign !== 0 ||
    !((format === 1 && [8, 16, 24, 32].includes(bitsPerSample)) || (format === 3 && bitsPerSample === 32))
  ) {
    throw new Error('The default Chatterbox WAV uses an unsupported audio format.');
  }

  const frames = dataLength / blockAlign;
  const mono = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      const offset = dataOffset + frame * blockAlign + channel * bytesPerSample;
      let sample: number;
      if (format === 3) {
        sample = view.getFloat32(offset, true);
      } else if (bitsPerSample === 8) {
        sample = (view.getUint8(offset) - 128) / 128;
      } else if (bitsPerSample === 16) {
        sample = view.getInt16(offset, true) / 32768;
      } else if (bitsPerSample === 24) {
        let value = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
        if (value & 0x800000) value |= 0xff000000;
        sample = value / 8388608;
      } else {
        sample = view.getInt32(offset, true) / 2147483648;
      }
      if (!Number.isFinite(sample)) throw new Error('The default Chatterbox WAV contains invalid samples.');
      sum += sample;
    }
    mono[frame] = sum / channels;
  }

  if (sampleRate === SAMPLE_RATE) return mono;
  const outputLength = Math.round(frames * SAMPLE_RATE / sampleRate);
  const resampled = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const position = i * sampleRate / SAMPLE_RATE;
    const left = Math.min(Math.floor(position), frames - 1);
    const right = Math.min(left + 1, frames - 1);
    const fraction = position - left;
    resampled[i] = mono[left] * (1 - fraction) + mono[right] * fraction;
  }
  return resampled;
}

function readTag(view: DataView, offset: number): string {
  return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}

function validateReferenceAudio(audio: Float32Array): void {
  if (audio.length < SAMPLE_RATE || audio.length > SAMPLE_RATE * MAX_REFERENCE_SECONDS) {
    throw new Error(`Reference audio must be between 1 and ${MAX_REFERENCE_SECONDS} seconds at 24 kHz mono.`);
  }
  for (let i = 0; i < audio.length; i++) {
    if (!Number.isFinite(audio[i])) throw new Error('Reference audio contains invalid samples.');
  }
}

type SpeakerEncoding = Awaited<ReturnType<ChatterboxModelType['encode_speech']>>;

function disposeSpeaker(speaker: SpeakerEncoding): void {
  for (const tensor of Object.values(speaker)) tensor.dispose();
}

export async function loadChatterbox(
  device: 'wasm' | 'webgpu',
  progress_callback: ProgressCallback,
): Promise<ChatterboxSession> {
  const { AutoProcessor, ChatterboxModel, Tensor } = await loadTransformers();
  let hasShaderF16 = false;
  if (device === 'webgpu') {
    const gpu = (globalThis.navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<{ features: { has(feature: string): boolean } } | null> };
    }).gpu;
    const adapter = await gpu?.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter is available in this browser.');
    hasShaderF16 = adapter.features.has('shader-f16');
  }
  const dtypes = {
    embed_tokens: 'fp32',
    speech_encoder: 'fp32',
    language_model: device === 'webgpu' && hasShaderF16 ? 'q4f16' : 'q4',
    conditional_decoder: 'fp32',
  } as const;
  const processor = await AutoProcessor.from_pretrained(MODEL_ID);
  const model = await ChatterboxModel.from_pretrained(MODEL_ID, {
    device,
    dtype: dtypes,
    progress_callback,
  }) as ChatterboxModelType;
  let defaultSpeaker: SpeakerEncoding | undefined;
  try {
    const response = await fetch(DEFAULT_VOICE_URL);
    if (!response.ok) throw new Error(`Could not download the default Chatterbox voice (${response.status}).`);
    const defaultAudio = decodeDefaultWav(await response.arrayBuffer());
    validateReferenceAudio(defaultAudio);
    const audioTensor = new Tensor('float32', defaultAudio, [1, defaultAudio.length]);
    try {
      defaultSpeaker = await model.encode_speech(audioTensor);
    } finally {
      audioTensor.dispose();
    }
  } catch (error) {
    if (defaultSpeaker) disposeSpeaker(defaultSpeaker);
    await model.dispose();
    throw error;
  }

  if (!defaultSpeaker) {
    await model.dispose();
    throw new Error('Could not encode the default Chatterbox voice.');
  }

  return {
    async generate(text, referenceAudio) {
      const normalizedText = text.trim();
      if (!normalizedText) throw new Error('Enter text to generate speech.');
      if (normalizedText.length > MAX_TEXT_LENGTH) {
        throw new Error(`Chatterbox supports up to ${MAX_TEXT_LENGTH} characters per generation.`);
      }

      let transientSpeaker: SpeakerEncoding | undefined;
      let inputs: Record<string, unknown> | undefined;
      let waveform: TensorType | undefined;
      try {
        let speaker = defaultSpeaker;
        if (referenceAudio) {
          validateReferenceAudio(referenceAudio);
          const audioTensor = new Tensor('float32', referenceAudio, [1, referenceAudio.length]);
          try {
            transientSpeaker = await model.encode_speech(audioTensor);
          } finally {
            audioTensor.dispose();
          }
          speaker = transientSpeaker;
        }
        inputs = await processor(normalizedText) as Record<string, unknown>;
        waveform = await model.generate({
          ...inputs,
          ...speaker,
          exaggeration: 0.5,
          max_new_tokens: 256,
        }) as TensorType;
        return new Float32Array(waveform.data);
      } finally {
        waveform?.dispose();
        if (inputs) {
          for (const value of Object.values(inputs)) {
            if (value instanceof Tensor) value.dispose();
          }
        }
        if (transientSpeaker) disposeSpeaker(transientSpeaker);
      }
    },
    async dispose() {
      disposeSpeaker(defaultSpeaker);
      await model.dispose();
    },
  };
}

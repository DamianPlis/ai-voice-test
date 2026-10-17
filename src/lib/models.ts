export type ModelFamily = 'kokoro' | 'mms' | 'chatterbox';
export type TtsDevice = 'wasm' | 'webgpu';
export type TtsDtype = 'q8' | 'fp32';

export type ModelDefinition = {
  id: string;
  name: string;
  family: ModelFamily;
  description: string;
  language: string;
  languageCode: string;
  repo: string;
  sizeMB: number;
  license: string;
  voices: string[];
  webgpu: boolean;
};

export type VoiceDefinition = {
  id: string;
  name: string;
  description: string;
  gender: 'Female' | 'Male';
  accent: 'American' | 'British';
  color: string;
};

export const VOICES: VoiceDefinition[] = [
  { id: 'af_heart', name: 'Heart', description: 'Warm, expressive American English.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'af_alloy', name: 'Alloy', description: 'Clear, balanced American English.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'af_aoede', name: 'Aoede', description: 'Light, melodic American English.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'af_bella', name: 'Bella', description: 'Bright, expressive American English.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'af_jessica', name: 'Jessica', description: 'Friendly, conversational American English.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'af_kore', name: 'Kore', description: 'Clear, direct American English.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'af_nicole', name: 'Nicole', description: 'Smooth American English with a soft edge.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'af_nova', name: 'Nova', description: 'Lively, upbeat American English.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'af_river', name: 'River', description: 'Calm, measured American English.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'af_sarah', name: 'Sarah', description: 'Gentle, steady American English.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'af_sky', name: 'Sky', description: 'Light, youthful American English.', gender: 'Female', accent: 'American', color: '#c084fc' },
  { id: 'am_adam', name: 'Adam', description: 'Low, relaxed American English.', gender: 'Male', accent: 'American', color: '#60a5fa' },
  { id: 'am_echo', name: 'Echo', description: 'Steady, mid-range American English.', gender: 'Male', accent: 'American', color: '#60a5fa' },
  { id: 'am_eric', name: 'Eric', description: 'Direct, conversational American English.', gender: 'Male', accent: 'American', color: '#60a5fa' },
  { id: 'am_fenrir', name: 'Fenrir', description: 'Deep, assertive American English.', gender: 'Male', accent: 'American', color: '#60a5fa' },
  { id: 'am_liam', name: 'Liam', description: 'Friendly, casual American English.', gender: 'Male', accent: 'American', color: '#60a5fa' },
  { id: 'am_michael', name: 'Michael', description: 'Mature, measured American English.', gender: 'Male', accent: 'American', color: '#60a5fa' },
  { id: 'am_onyx', name: 'Onyx', description: 'Low, resonant American English.', gender: 'Male', accent: 'American', color: '#60a5fa' },
  { id: 'am_puck', name: 'Puck', description: 'Playful, energetic American English.', gender: 'Male', accent: 'American', color: '#60a5fa' },
  { id: 'am_santa', name: 'Santa', description: 'Warm, characterful American English.', gender: 'Male', accent: 'American', color: '#60a5fa' },
  { id: 'bf_alice', name: 'Alice', description: 'Bright British English with a light delivery.', gender: 'Female', accent: 'British', color: '#fb923c' },
  { id: 'bf_emma', name: 'Emma', description: 'Warm, polished British English.', gender: 'Female', accent: 'British', color: '#fb923c' },
  { id: 'bf_isabella', name: 'Isabella', description: 'Smooth, composed British English.', gender: 'Female', accent: 'British', color: '#fb923c' },
  { id: 'bf_lily', name: 'Lily', description: 'Light, youthful British English.', gender: 'Female', accent: 'British', color: '#fb923c' },
  { id: 'bm_daniel', name: 'Daniel', description: 'Measured British English.', gender: 'Male', accent: 'British', color: '#34d399' },
  { id: 'bm_fable', name: 'Fable', description: 'Expressive British English.', gender: 'Male', accent: 'British', color: '#34d399' },
  { id: 'bm_george', name: 'George', description: 'Deep, classic British English.', gender: 'Male', accent: 'British', color: '#34d399' },
  { id: 'bm_lewis', name: 'Lewis', description: 'Friendly British English.', gender: 'Male', accent: 'British', color: '#34d399' },
];

const kokoroVoiceIds = VOICES.map(({ id }) => id);

export const MODELS: ModelDefinition[] = [
  {
    id: 'kokoro',
    name: 'Kokoro 82M',
    family: 'kokoro',
    description: 'Expressive English speech with 28 voices.',
    language: 'English',
    languageCode: 'en',
    repo: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    sizeMB: 92,
    license: 'Apache-2.0',
    voices: kokoroVoiceIds,
    webgpu: true,
  },
  {
    id: 'mms-eng',
    name: 'MMS English',
    family: 'mms',
    description: 'Compact single-speaker English speech.',
    language: 'English',
    languageCode: 'en',
    repo: 'Xenova/mms-tts-eng',
    sizeMB: 39,
    license: 'CC-BY-NC-4.0',
    voices: [],
    webgpu: false,
  },
  {
    id: 'mms-deu',
    name: 'MMS German',
    family: 'mms',
    description: 'Compact single-speaker German speech.',
    language: 'German',
    languageCode: 'de',
    repo: 'Xenova/mms-tts-deu',
    sizeMB: 39,
    license: 'CC-BY-NC-4.0',
    voices: [],
    webgpu: false,
  },
  {
    id: 'mms-fra',
    name: 'MMS French',
    family: 'mms',
    description: 'Compact single-speaker French speech.',
    language: 'French',
    languageCode: 'fr',
    repo: 'Xenova/mms-tts-fra',
    sizeMB: 39,
    license: 'CC-BY-NC-4.0',
    voices: [],
    webgpu: false,
  },
  {
    id: 'mms-spa',
    name: 'MMS Spanish',
    family: 'mms',
    description: 'Compact single-speaker Spanish speech.',
    language: 'Spanish',
    languageCode: 'es',
    repo: 'Xenova/mms-tts-spa',
    sizeMB: 39,
    license: 'CC-BY-NC-4.0',
    voices: [],
    webgpu: false,
  },
  {
    id: 'chatterbox',
    name: 'Chatterbox',
    family: 'chatterbox',
    description: 'English speech with an optional reference voice.',
    language: 'English',
    languageCode: 'en',
    repo: 'onnx-community/chatterbox-ONNX',
    sizeMB: 1540,
    license: 'MIT',
    voices: ['default'],
    webgpu: true,
  },
];

export function getModel(id: string): ModelDefinition | undefined {
  return MODELS.find((model) => model.id === id);
}

export function getVoices(model: ModelDefinition | string): VoiceDefinition[] {
  const definition = typeof model === 'string' ? getModel(model) : model;
  return definition?.family === 'kokoro' ? VOICES : [];
}

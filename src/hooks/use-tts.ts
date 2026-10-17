import { useCallback, useEffect, useRef, useState } from 'react';

export type EngineConfig = { modelId: string; device: 'wasm' | 'webgpu'; dtype: 'q8' | 'fp32' };
export type EngineResult = { audio: Float32Array; samplingRate: number; generationMs: number };
type Progress = { status: string; file?: string; progress?: number; loaded?: number; total?: number };

export function useTTS() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>());
  const loadedKey = useRef('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'generating'>('idle');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState<EngineConfig | null>(null);

  const stop = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    loadedKey.current = '';
    pending.current.forEach(({ reject }) => reject(new Error('Operation cancelled.')));
    pending.current.clear();
    setStatus('idle'); setProgress(null); setLoaded(null);
  }, []);
  useEffect(() => stop, [stop]);

  function request(type: string, config: EngineConfig, extra: Record<string, unknown> = {}): Promise<any> {
    if (!worker.current) {
      worker.current = new Worker(new URL('../lib/tts.worker.ts', import.meta.url), { type: 'module' });
      worker.current.onmessage = ({ data }) => {
        if (data.type === 'progress') { setProgress(data); return; }
        const promise = pending.current.get(data.requestId);
        if (!promise) return;
        pending.current.delete(data.requestId);
        if (data.type === 'error') promise.reject(new Error(data.message));
        else promise.resolve(data);
      };
      worker.current.onerror = (event) => {
        const message = event.message || 'The voice engine stopped. Reload the model and try again.';
        pending.current.forEach(({ reject }) => reject(new Error(message)));
        pending.current.clear();
        worker.current?.terminate(); worker.current = null; loadedKey.current = ''; setLoaded(null);
      };
    }
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      pending.current.set(requestId, { resolve, reject });
      worker.current!.postMessage({ type, requestId, ...config, ...extra });
    });
  }

  async function load(config: EngineConfig) {
    const key = JSON.stringify(config);
    if (loadedKey.current === key) return;
    setError(''); setStatus('loading'); setProgress({ status: 'Preparing model…' });
    try {
      await request('load', config);
      loadedKey.current = key; setLoaded(config); setStatus('ready'); setProgress(null);
    } catch (cause) {
      stop();
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message !== 'Operation cancelled.') setError(message);
      throw cause;
    }
  }

  async function generate(config: EngineConfig, text: string, voice: string, speed: number, referenceAudio?: Float32Array): Promise<EngineResult> {
    await load(config);
    setError(''); setStatus('generating');
    try {
      return await request('generate', config, { text, voice, speed, referenceAudio });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message !== 'Operation cancelled.') setError(message);
      throw cause;
    } finally {
      setStatus(loadedKey.current ? 'ready' : 'idle');
    }
  }
  return { status, progress, error, loaded, load, generate, stop, clearError: () => setError('') };
}

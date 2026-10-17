# Resonance

A browser-local voice playground built with React, TypeScript, Vite, Tailwind CSS, and shadcn-style Radix UI components. No Python, API key, or inference server is required.

## Run

```sh
npm install
npm run dev
```

Open the printed localhost URL in a recent Chrome or Edge browser. CPU inference uses WebAssembly; compatible browsers can also use WebGPU. HTTPS or localhost is required for WebGPU. Start with Kokoro on CPU, or select GPU in **Run on**.

```sh
npm test
npm run build
npm run preview
```

## Models

| Model | Runtime | Approximate model download | Notes |
| --- | --- | --- | --- |
| [Kokoro 82M](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) | q8 CPU / fp32 GPU | 92 / 326 MB | 28 American and British English voices; Apache-2.0 |
| [MMS English](https://huggingface.co/Xenova/mms-tts-eng) | q8 CPU | 39 MB | Single speaker; CC-BY-NC-4.0 |
| [MMS German](https://huggingface.co/Xenova/mms-tts-deu) | q8 CPU | 39 MB | Single speaker; CC-BY-NC-4.0 |
| [MMS French](https://huggingface.co/Xenova/mms-tts-fra) | q8 CPU | 39 MB | Single speaker; CC-BY-NC-4.0 |
| [MMS Spanish](https://huggingface.co/Xenova/mms-tts-spa) | q8 CPU | 39 MB | Single speaker; CC-BY-NC-4.0 |
| [Chatterbox ONNX](https://huggingface.co/onnx-community/chatterbox-ONNX) | mixed q4 CPU / q4f16 GPU | 1.5 GB | Experimental reference voice cloning; MIT |

Downloads are estimates for model weights; runtime, voice, tokenizer, and configuration assets add to the first load. Models load only when requested. Switching models disposes the previous session. Cancel terminates the inference worker and unloads its model.

Kokoro uses the stable [Kokoro.js](https://github.com/hexgrad/kokoro/tree/main/kokoro.js) runtime with Transformers.js 3. Chatterbox uses an isolated Transformers.js 4.3.1 alias, based on [Resemble's browser demo](https://github.com/resemble-ai/transformersjs-chatterbox-demo). Its 256-token output limit can end speech before the script finishes; the UI caps input at 200 characters. Expression tags are unsupported by this ONNX port. Reference audio must be 1–30 seconds and at most 20 MB; the browser mixes it to mono and resamples it to 24 kHz. Only use voices you have permission to use.

An arbitrary Hugging Face checkpoint or Python `.pt` file cannot be used directly. Each model needs an ONNX export and a matching browser inference adapter. The library contains supported adapters rather than advertising unsupported downloads as runnable models.

## Audio and privacy

- Scripts, reference audio, and synthesis stay on your device. Hugging Face receives model asset requests; Chatterbox fetches its versioned ONNX runtime binary from jsDelivr because the host limits individual files to 25 MiB.
- Models use the browser cache. Cache eviction and private browsing can require another download. This is not a guaranteed offline-installable PWA.
- The latest 20 generated WAVs, their scripts, and measured metadata are saved in this browser's IndexedDB. Export WAVs you want to keep. Clearing site data also removes history and cached models.
- The waveform comes from generated PCM. Runtime reports measured generation time, duration, sample rate, and real-time factor. Model loading is excluded from generation time.
- MMS models are licensed for noncommercial use. Review each model's terms for your use case.

## Structure

`src/App.tsx` owns the studio and library views. `src/hooks/use-tts.ts` handles worker lifecycle and cancellation. `src/lib/tts.worker.ts` runs inference off the UI thread. `src/lib/models.ts` is the supported model and voice catalog. Audio encoding, local history, and Chatterbox are isolated in their corresponding library files.

The UI primitives follow shadcn's open component pattern and use Radix Select, Slider, Tabs, and Dialog for keyboard support. Their configuration is in `components.json`.

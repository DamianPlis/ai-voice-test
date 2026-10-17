import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, AudioLines, BookOpen, Box, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Cpu, Download, ExternalLink, FlaskConical, Headphones, History, Info, LoaderCircle, Menu, Mic2, MoreHorizontal, Pause, Play, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Square, Trash2, Volume2, WandSparkles, Waves, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MODELS, VOICES, getModel } from '@/lib/models';
import { encodeWav, formatTime, waveformPeaks } from '@/lib/audio';
import { deleteGeneration, listGenerations, saveGeneration, type Generation } from '@/lib/history';
import { useTTS, type EngineConfig } from '@/hooks/use-tts';

type Page = 'playground' | 'voices' | 'models' | 'history';
const pageTitles: Record<Page, string> = { playground: 'Speech playground', voices: 'Voice library', models: 'Model library', history: 'Generation history' };
const examples = [
  { name: 'Tell a story', icon: BookOpen, text: 'Somewhere between the last train home and the first light of morning, the city belongs to the dreamers. The ones who take the long way. Who find a little magic in the ordinary.\n\nThis is your story. Let’s give it a voice.' },
  { name: 'Podcast intro', icon: Headphones, text: 'Welcome to The Open Frequency, a podcast for curious minds. Today, we’re exploring the small ideas that change everything. So find your favorite spot, settle in, and let’s get into it.' },
  { name: 'Product launch', icon: Sparkles, text: 'Meet a new way to bring your ideas to life. Thoughtfully designed. Effortlessly simple. And made for the way you work. Your next chapter starts here.' },
  { name: 'Pronunciation test', icon: FlaskConical, text: 'The quick brown fox jumps over the lazy dog. She sells seashells by the seashore. In 2026, we traveled 1,250 miles. Could you read that again, please?' },
];

function VoiceAvatar({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' | 'lg' }) {
  const n = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return <span className={`voice-avatar avatar-${size} avatar-${n % 7}`} aria-hidden="true"><span /><span /><span /></span>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><span className="brand-symbol"><AudioLines size={23} strokeWidth={2.2} /></span>{!compact && <span>resonance<span className="brand-dot">.</span></span>}</div>;
}

function DownloadAudio({ generation, compact = false }: { generation: Generation; compact?: boolean }) {
  const url = useMemo(() => URL.createObjectURL(generation.blob), [generation.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <a className={compact ? 'icon-link' : 'download-link'} href={url} download={`resonance-${generation.voiceId}-${generation.id.slice(0, 8)}.wav`} title="Download WAV" aria-label="Download WAV"><ArrowDownToLine size={16} />{!compact && <span>Download</span>}</a>;
}

function AudioPlayer({ generation }: { generation: Generation | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [playError, setPlayError] = useState('');
  const url = useMemo(() => generation ? URL.createObjectURL(generation.blob) : '', [generation]);
  useEffect(() => { setPlaying(false); setPosition(0); setPlayError(''); return () => { if (url) URL.revokeObjectURL(url); }; }, [url]);
  const peaks = generation?.peaks ?? Array.from({ length: 100 }, (_, i) => .1 + .25 * Math.abs(Math.sin(i * .7)) * Math.abs(Math.cos(i * .21)));
  async function toggle() {
    if (!audio.current) return;
    if (playing) audio.current.pause();
    else try { await audio.current.play(); } catch { setPlayError('Playback could not start. Download the WAV to listen.'); }
  }
  return <div className={`audio-player ${generation ? 'has-audio' : ''}`}>
    {generation && <audio ref={audio} src={url} onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
    <div className="player-top"><div className="player-title"><span className="tiny-icon"><AudioLines size={16} /></span><span>{generation ? 'Your generation' : 'Your voice starts here'}</span>{generation && <span className="tag">WAV</span>}</div><span className="player-format">{generation ? `${generation.samplingRate / 1000} kHz · Mono` : 'Ready when you are'}</span></div>
    <div className="player-wave-row"><Button size="icon" className="play-button" disabled={!generation} onClick={toggle} aria-label={playing ? 'Pause audio' : 'Play audio'}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</Button><div className="waveform-wrap"><div className="waveform" aria-hidden="true">{peaks.map((peak, i) => <i key={i} className={generation && i / peaks.length < position / generation.duration ? 'played' : ''} style={{ height: `${Math.max(4, peak * 48)}px` }} />)}</div><input type="range" className="waveform-seek" aria-label="Audio position" min="0" max={generation?.duration || 1} step="0.01" value={position} disabled={!generation} onChange={e => { const value = Number(e.target.value); if (audio.current) audio.current.currentTime = value; setPosition(value); }} /></div><span className="player-time">{formatTime(position)} <span>/ {formatTime(generation?.duration ?? 0)}</span></span>{generation ? <DownloadAudio generation={generation} compact /> : <span className="icon-link disabled"><ArrowDownToLine size={18} /></span>}</div>
    {playError && <p className="inline-error" role="alert">{playError}</p>}
    {generation && <div className="player-bottom"><span><VoiceAvatar id={generation.voiceId} size="sm" /> {generation.voiceName}</span><span>{generation.modelName}<i />{(generation.generationMs / 1000).toFixed(1)}s generation<i />{(generation.generationMs / 1000 / generation.duration).toFixed(2)}× RTF</span></div>}
  </div>;
}

export default function App() {
  const [page, setPage] = useState<Page>('playground');
  const [menuOpen, setMenuOpen] = useState(false);
  const [text, setText] = useState(examples[0].text);
  const [modelId, setModelId] = useState('kokoro');
  const [voiceId, setVoiceId] = useState('af_heart');
  const [device, setDevice] = useState<'wasm' | 'webgpu'>('wasm');
  const [speed, setSpeed] = useState(1);
  const [search, setSearch] = useState('');
  const [accent, setAccent] = useState('all');
  const [history, setHistory] = useState<Generation[]>([]);
  const [selected, setSelected] = useState<Generation | null>(null);
  const [notice, setNotice] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [hardware, setHardware] = useState({ gpu: false, name: '', cores: navigator.hardwareConcurrency || 0, storage: 0 });
  const [reference, setReference] = useState<{ name: string; audio: Float32Array } | null>(null);
  const [decoding, setDecoding] = useState(false);
  const referenceImportId = useRef(0);
  const engine = useTTS();
  const model = getModel(modelId)!;
  const chatterbox = model.family === 'chatterbox';
  const kokoro = model.family === 'kokoro';
  const maxLength = chatterbox ? 200 : 2500;
  const busy = engine.status === 'loading' || engine.status === 'generating' || decoding;
  const voice = VOICES.find(v => v.id === voiceId) ?? VOICES[0];
  const config: EngineConfig = { modelId, device: kokoro || chatterbox ? device : 'wasm', dtype: device === 'webgpu' && kokoro ? 'fp32' : 'q8' };
  const isLoaded = engine.loaded && JSON.stringify(engine.loaded) === JSON.stringify(config);
  const downloadMB = kokoro && device === 'webgpu' ? 326 : model.sizeMB;

  useEffect(() => {
    listGenerations().then(setHistory).catch(() => setNotice('Browser storage is unavailable. You can still generate and download audio.'));
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<{ info?: { description?: string; device?: string } } | null> } }).gpu;
    gpu?.requestAdapter().then(adapter => { if (adapter) setHardware(h => ({ ...h, gpu: true, name: adapter.info?.description || adapter.info?.device || 'WebGPU adapter' })); }).catch(() => {});
    navigator.storage?.estimate().then(estimate => setHardware(h => ({ ...h, storage: estimate.usage ?? 0 }))).catch(() => {});
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 9000); return () => clearTimeout(timer); }, [notice]);

  function navigate(next: Page) { setPage(next); setMenuOpen(false); setSearch(''); }
  function chooseModel(id: string) {
    const next = getModel(id)!;
    setModelId(id); setReference(null);
    if (next.family === 'kokoro') { if (!VOICES.some(v => v.id === voiceId)) setVoiceId('af_heart'); }
    else { setVoiceId('default'); setSpeed(1); }
    if (!next.webgpu) setDevice('wasm');
  }
  async function loadModel() { try { await engine.load(config); } catch { /* The engine shows its actionable error. */ } }

  async function generate(override?: { voiceId: string; text: string }) {
    const value = override?.text ?? text;
    if (!value.trim() || value.length > maxLength || busy) return;
    const requestedVoice = kokoro ? override?.voiceId ?? voiceId : 'default';
    const requestedVoiceName = kokoro ? VOICES.find(v => v.id === requestedVoice)?.name ?? requestedVoice : chatterbox ? reference?.name ?? 'Default voice' : model.language;
    try {
      const result = await engine.generate(config, value, requestedVoice, speed, reference?.audio);
      const generation: Generation = { id: crypto.randomUUID(), createdAt: Date.now(), text: value, modelId, modelName: model.name, voiceId: requestedVoice, voiceName: requestedVoiceName, device: config.device, dtype: chatterbox ? 'Mixed q4' : config.dtype, speed, duration: result.audio.length / result.samplingRate, generationMs: result.generationMs, samplingRate: result.samplingRate, blob: encodeWav(result.audio, result.samplingRate), peaks: waveformPeaks(result.audio, 110) };
      setSelected(generation);
      setHistory(h => [generation, ...h].slice(0, 20));
      try { await saveGeneration(generation); } catch { setNotice('Audio is ready, but browser storage is full or unavailable. Download this WAV to keep it.'); }
      navigator.storage?.estimate().then(estimate => setHardware(h => ({ ...h, storage: estimate.usage ?? 0 }))).catch(() => {});
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Audio generation failed. Please try again.';
      if (message !== 'Operation cancelled.') setNotice(message);
    }
  }

  async function importReference(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setNotice('Choose a reference recording smaller than 20 MB.'); return; }
    setDecoding(true);
    const importId = ++referenceImportId.current;
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      if (decoded.duration < 1 || decoded.duration > 30) throw new Error('Use a clear reference recording between 1 and 30 seconds.');
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 24000), 24000);
      const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
      const rendered = await offline.startRendering();
      if (importId === referenceImportId.current) setReference({ name: file.name, audio: rendered.getChannelData(0).slice() });
    } catch (cause) { if (importId === referenceImportId.current) setNotice(cause instanceof Error ? cause.message : 'This audio could not be decoded. Try a WAV or MP3 recording.'); }
    finally { if (context) await context.close().catch(() => {}); if (importId === referenceImportId.current) setDecoding(false); }
  }
  function cancel() { referenceImportId.current++; setDecoding(false); engine.stop(); }
  async function removeGeneration(id: string) {
    try { await deleteGeneration(id); setHistory(h => h.filter(g => g.id !== id)); if (selected?.id === id) setSelected(null); }
    catch { setNotice('Could not delete this generation from browser storage. Try again.'); }
  }
  const visibleVoices = VOICES.filter(v => (accent === 'all' || v.id.startsWith(accent)) && `${v.name} ${v.description} ${v.accent}`.toLowerCase().includes(search.toLowerCase()));
  const featured = ['af_heart', 'am_michael', 'bf_emma', 'bm_george'].map(id => VOICES.find(v => v.id === id)!).filter(Boolean);

  return <div className="app-shell">
    {menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <Brand />
      <div className="workspace-switch"><span className="workspace-icon">R</span><div>Personal workspace<small>Local playground</small></div><ChevronDown size={14} /></div>
      <div className="nav-section-label">Create</div>
      <nav aria-label="Main navigation">
        {([{ id: 'playground', label: 'Speech playground', icon: AudioLines }, { id: 'voices', label: 'Voice library', icon: Mic2 }, { id: 'models', label: 'Model library', icon: Box }, { id: 'history', label: 'History', icon: History }] as const).map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`nav-item ${page === item.id ? 'active' : ''}`} aria-current={page === item.id ? 'page' : undefined}><item.icon size={18} /><span>{item.label}</span>{item.id === 'voices' && <span className="nav-count">28</span>}{item.id === 'models' && <span className="nav-new">{MODELS.length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="local-card"><span className="local-card-icon"><ShieldCheck size={19} /></span><strong>Your voice. Your device.</strong><p>Open models. Local inference.<br />A little more peace of mind.</p><button onClick={() => setHelpOpen(true)}>How it works <ArrowRight size={13} /></button></div><a className="sidebar-help" href="https://huggingface.co/onnx-community" target="_blank" rel="noreferrer"><BookOpen size={16} /> Explore open models <ExternalLink size={13} /></a><button className="profile" onClick={() => setHelpOpen(true)}><span className="profile-avatar">Y</span><span>Your workspace<small>Running on your hardware</small></span><MoreHorizontal size={18} /></button></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><span className="breadcrumb-root">Workspace</span><ChevronRight size={13} /><span>{pageTitles[page]}</span></div><div className="topbar-actions"><span className="privacy-status"><span className="status-dot" /> On-device inference</span><span className="topbar-divider" /><button onClick={() => setHelpOpen(true)} aria-label="Help and privacy"><CircleHelp size={18} /></button><span className="top-avatar">Y</span></div></header>
      <main>
        <div className="page-heading"><div><div className="heading-with-icon"><h1>{pageTitles[page]}</h1>{page === 'playground' && <span className="tag beta-tag">Local studio</span>}</div><p>{page === 'playground' ? 'Turn a little text into something worth listening to.' : page === 'voices' ? 'Find the personality that brings your words to life.' : page === 'models' ? 'Open voice models, running right here on your hardware.' : 'A collection of your experiments. Saved in this browser.'}</p></div><Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}><BookOpen size={15} /> Quick guide <ExternalLink size={12} /></Button></div>

        {page === 'playground' && <div className="studio-grid"><div className="studio-main">
          <div className="studio-tabs"><button className="studio-tab active"><AudioLines size={16} /> Text to speech</button><button className="studio-tab" onClick={() => { navigate('models'); }}><FlaskConical size={16} /> Explore models <span className="tag">{MODELS.length}</span></button></div>
          <section className="editor-card" aria-label="Speech editor"><div className="editor-toolbar"><div><span className="editor-dot" /> Your script</div><Button size="sm" variant="ghost" disabled={busy} onClick={() => setText('')}><Trash2 size={14} /> Clear</Button></div><label htmlFor="speech-text" className="sr-only">Text to speak</label><textarea id="speech-text" value={text} onChange={e => setText(e.target.value)} placeholder="Every great voice starts with a few words. What will yours say?" spellCheck={false} disabled={busy} /><div className="editor-footer"><span><ShieldCheck size={14} /> Your text stays on this device</span><span className={text.length > maxLength ? 'over-limit' : ''}>{text.length.toLocaleString()} <span>/ {maxLength.toLocaleString()} characters</span></span></div></section>
          <div className="example-row"><span>Try a prompt</span>{examples.map(item => <button key={item.name} onClick={() => setText(chatterbox ? item.text.slice(0, 190) : item.text)} disabled={busy}><item.icon size={13} />{item.name}</button>)}</div>
          <div className="generate-row"><div><span className={`engine-dot ${isLoaded ? 'ready' : ''}`} /><span>{busy ? engine.status === 'generating' ? 'Creating your audio…' : 'Preparing the voice engine…' : isLoaded ? `${model.name} is ready` : 'Ready to make some noise'}<small>{isLoaded ? 'Model loaded on your device' : `First use downloads ~${downloadMB.toLocaleString()} MB · Cached for next time`}</small></span></div>{busy ? <Button variant="outline" onClick={cancel}><Square size={15} /> Cancel</Button> : <Button className="generate-button" disabled={!text.trim() || text.length > maxLength} onClick={() => generate()}><Sparkles size={16} /> Generate speech <span className="button-arrow"><ArrowRight size={16} /></span></Button>}</div>
          {engine.status === 'loading' && <div className="download-progress" role="status"><div><LoaderCircle size={15} className="spin" /><span>{engine.progress?.status === 'progress' ? 'Downloading model' : engine.progress?.status === 'ready' ? 'Preparing voice engine' : 'Loading model files'}<small>{engine.progress?.file?.split('/').pop()}</small></span><strong>{engine.progress?.progress != null ? `${Math.min(100, engine.progress.progress).toFixed(0)}%` : 'Working…'}</strong></div><progress max="100" value={engine.progress?.progress} /><p>Keep this tab open. The first load can take a few minutes.</p></div>}
          {engine.error && <div className="error-card" role="alert"><Info size={18} /><div><strong>The voice engine needs a moment</strong><p>{engine.error}</p><p>Try the CPU runtime, check your connection, or reload the model.</p></div><button onClick={engine.clearError} aria-label="Dismiss error"><X size={16} /></button></div>}
          <AudioPlayer generation={selected} />
          <div className="section-heading"><h2>A voice for every idea</h2><button onClick={() => navigate('voices')}>Explore voices <ArrowRight size={14} /></button></div>
          <div className="featured-voices">{featured.map(v => <button className={`featured-voice ${voiceId === v.id && kokoro ? 'selected' : ''}`} key={v.id} disabled={busy} onClick={() => { chooseModel('kokoro'); setVoiceId(v.id); }}><VoiceAvatar id={v.id} /><span><strong>{v.name}</strong><small>{v.id[0] === 'a' ? 'American' : 'British'} · {v.id[1] === 'f' ? 'Female' : 'Male'}</small></span><span className="voice-card-icon">{voiceId === v.id && kokoro ? <Check size={14} /> : <Plus size={14} />}</span></button>)}</div>
          <div className="local-note"><span className="local-note-icon"><Cpu size={20} /></span><div><strong>Big ideas. Small footprint.</strong><p>No API keys, no credits, no inference bill. Just open models and your hardware.</p></div><span className="tag">100% local inference</span></div>
        </div><aside className="settings-panel" aria-label="Voice controls"><Tabs defaultValue="settings"><TabsList><TabsTrigger value="settings"><SlidersHorizontal size={14} /> Voice settings</TabsTrigger><TabsTrigger value="runtime"><Activity size={14} /> Runtime</TabsTrigger></TabsList><TabsContent value="settings"><div className="settings-section"><div className="field-heading"><label htmlFor="model-select">Model</label><button onClick={() => navigate('models')}>Browse all <ArrowRight size={12} /></button></div><Select value={modelId} onValueChange={chooseModel} disabled={busy}><SelectTrigger id="model-select"><span className="select-model-icon"><Box size={17} /></span><SelectValue /></SelectTrigger><SelectContent>{MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select><div className="model-description"><span className={`tag ${chatterbox ? 'tag-amber' : 'tag-green'}`}>{chatterbox ? 'Experimental' : kokoro ? 'Recommended' : 'Multilingual'}</span><span>~{downloadMB.toLocaleString()} MB</span></div><p className="field-description">{kokoro ? 'Natural, expressive speech. A small model with a lot to say.' : chatterbox ? 'Reference voice cloning. Large download; use a short script. Audio may end before the script does.' : `Lightweight ${model.language} speech. One voice, made for language experiments. Noncommercial model.`}</p><a className="source-link" href={`https://huggingface.co/${model.repo}`} target="_blank" rel="noreferrer">View on Hugging Face <ExternalLink size={11} /></a></div>
          <div className="settings-section"><div className="field-heading"><label htmlFor="voice-select">Voice</label>{kokoro && <span>28 voices</span>}</div>{kokoro ? <><Select value={voiceId} onValueChange={setVoiceId} disabled={busy}><SelectTrigger id="voice-select"><VoiceAvatar id={voiceId} size="sm" /><SelectValue /></SelectTrigger><SelectContent>{VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.name} · {v.id[0] === 'a' ? 'US' : 'UK'}</SelectItem>)}</SelectContent></Select><div className="voice-description"><span>{voice.id[1] === 'f' ? 'Female' : 'Male'}</span><i /><span>{voice.id[0] === 'a' ? 'American' : 'British'} English</span></div><button className="preview-voice" disabled={busy} onClick={() => generate({ voiceId, text: `Hello, I’m ${voice.name}. Every idea has a voice. Let’s find yours.` })}><Play size={12} /> Preview voice</button></> : <div className="single-voice"><VoiceAvatar id={modelId} size="sm" /><span>{chatterbox ? reference?.name ?? 'Default voice' : `${model.language} speaker`}</span></div>}{chatterbox && <div className="reference-upload"><label htmlFor="reference-audio"><Mic2 size={15} />{decoding ? 'Preparing recording…' : reference ? 'Change reference audio' : 'Add reference audio'}<input id="reference-audio" type="file" accept="audio/*" disabled={busy} onChange={e => { void importReference(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label><p>1–30 seconds of a voice you have permission to use. Stays on this device.</p>{reference && <button onClick={() => setReference(null)} disabled={busy}>Use default voice <X size={11} /></button>}</div>}</div>
          <div className="settings-section"><div className="field-heading"><label>Speed</label><span className="value-tag">{speed.toFixed(2)}×</span></div><Slider aria-label="Speech speed" min={0.5} max={2} step={0.05} value={[speed]} onValueChange={([value]) => setSpeed(value)} disabled={busy || !kokoro} /><div className="slider-labels"><span>Slower</span><button onClick={() => setSpeed(1)} disabled={busy || !kokoro}>Default</button><span>Faster</span></div>{!kokoro && <p className="field-description">This model generates at its native speaking speed.</p>}</div>
          <div className="settings-section runtime-section"><div className="field-heading"><label htmlFor="runtime-select">Run on</label><Cpu size={15} /></div><Select value={config.device} onValueChange={v => setDevice(v as 'wasm' | 'webgpu')} disabled={busy}><SelectTrigger id="runtime-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="wasm">CPU · WebAssembly</SelectItem><SelectItem value="webgpu" disabled={!hardware.gpu || !model.webgpu}>GPU · WebGPU{!hardware.gpu ? ' (unavailable)' : !model.webgpu ? ' (unsupported)' : ''}</SelectItem></SelectContent></Select><p className="field-description">{config.device === 'wasm' ? 'Works without a dedicated GPU. Runs in a background worker.' : 'Uses your graphics processor. Faster on compatible hardware.'}</p><Button variant="outline" className="load-model-button" disabled={busy || !!isLoaded} onClick={loadModel}>{isLoaded ? <Check size={14} /> : <Download size={14} />}{isLoaded ? 'Model loaded' : 'Load model'}</Button>{engine.loaded && <button className="unload-link" onClick={engine.stop} disabled={busy}>Unload from memory</button>}</div><div className="settings-footer"><ShieldCheck size={15} /><span>Audio is generated on this device.<br />Models download from Hugging Face.</span></div></TabsContent>
          <TabsContent value="runtime"><div className="runtime-details"><div className="runtime-illustration"><Cpu size={30} /></div><h3>Your browser is the studio</h3><p>Live capability checks and measurements from this session.</p><dl><div><dt>Engine</dt><dd><span className={`engine-dot ${isLoaded ? 'ready' : ''}`} />{engine.status}</dd></div><div><dt>WebGPU</dt><dd>{hardware.gpu ? 'Available' : 'Unavailable'}</dd></div><div><dt>CPU threads</dt><dd>{hardware.cores || 'Not reported'}</dd></div><div><dt>Origin storage</dt><dd>{(hardware.storage / 1024 / 1024).toFixed(1)} MB</dd></div><div><dt>Precision</dt><dd>{chatterbox ? 'Mixed q4 / fp32' : config.dtype}</dd></div><div><dt>Worker</dt><dd>Background thread</dd></div></dl>{hardware.name && <div className="hardware-name"><Cpu size={14} />{hardware.name}</div>}{selected && <><h4>Last generation</h4><dl><div><dt>Inference time</dt><dd>{(selected.generationMs / 1000).toFixed(2)} s</dd></div><div><dt>Audio duration</dt><dd>{selected.duration.toFixed(2)} s</dd></div><div><dt>Real-time factor</dt><dd>{(selected.generationMs / 1000 / selected.duration).toFixed(2)}×</dd></div><div><dt>Sample rate</dt><dd>{selected.samplingRate.toLocaleString()} Hz</dd></div></dl><p className="runtime-hint">RTF below 1 means generation was faster than playback. Download and model loading are excluded.</p></>}<p className="runtime-hint">Storage includes browser model cache and saved audio. Browsers may evict cached files when space is low.</p></div></TabsContent></Tabs></aside></div>}

        {page === 'voices' && <><div className="library-toolbar"><div className="search-field"><Search size={17} /><input aria-label="Search voices" placeholder="Find your voice…" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="filter-chips">{[['all', 'All voices'], ['a', 'American'], ['b', 'British']].map(([id, label]) => <button className={accent === id ? 'active' : ''} key={id} onClick={() => setAccent(id)}>{label}</button>)}</div><span className="result-count">{visibleVoices.length} {visibleVoices.length === 1 ? 'voice' : 'voices'}</span></div><div className="voice-library-grid">{visibleVoices.map(v => <article className="voice-library-card" key={v.id}><div className="voice-library-top"><VoiceAvatar id={v.id} size="lg" /><span className="tag">Kokoro</span></div><h2>{v.name}</h2><p>{v.id[0] === 'a' ? 'American' : 'British'} English <span>·</span> {v.id[1] === 'f' ? 'Female' : 'Male'}</p><p className="voice-style">{v.description}</p><Button variant="outline" disabled={busy} onClick={() => { chooseModel('kokoro'); setVoiceId(v.id); navigate('playground'); }}>Use voice <ArrowRight size={14} /></Button></article>)}</div>{!visibleVoices.length && <div className="empty-state"><Search size={28} /><h2>No voices found</h2><p>Try a different name or accent.</p><Button variant="outline" onClick={() => { setSearch(''); setAccent('all'); }}>Reset filters</Button></div>}</>}

        {page === 'models' && <><div className="model-library-note"><span className="model-library-note-icon"><Box size={22} /></span><div><strong>Choose the right model for the moment.</strong><p>Kokoro for English quality. MMS for language experiments. Chatterbox for reference voices.</p></div><span className="tag">No API key needed</span></div><div className="model-library-grid">{MODELS.map(m => <article className={`model-library-card ${m.id === modelId ? 'current-model' : ''}`} key={m.id}><div className="model-card-top"><div className={`model-icon model-icon-${m.family}`}><AudioLines size={23} /></div><span className={`tag ${m.family === 'chatterbox' ? 'tag-amber' : m.family === 'kokoro' ? 'tag-purple' : ''}`}>{m.family === 'chatterbox' ? 'Experimental' : m.family === 'kokoro' ? 'Recommended' : m.language}</span></div><h2>{m.name}</h2><p>{m.description}</p><div className="model-stats"><span><Download size={13} /> ~{m.sizeMB.toLocaleString()} MB</span><span><Cpu size={13} />{m.webgpu ? 'CPU / GPU' : 'CPU'}</span></div><div className="model-license">{m.license}{m.family === 'mms' && <span> · Noncommercial</span>}</div><div className="model-card-actions"><Button variant={m.id === modelId ? 'secondary' : 'outline'} disabled={busy} onClick={() => { chooseModel(m.id); navigate('playground'); }}>{m.id === modelId ? <Check size={14} /> : <Plus size={14} />}{m.id === modelId ? 'Selected model' : 'Use model'}</Button><a href={`https://huggingface.co/${m.repo}`} target="_blank" rel="noreferrer" aria-label={`${m.name} model source`}><ExternalLink size={16} /></a></div></article>)}</div><div className="compatibility-note"><Info size={18} /><div><strong>A model picker with a reality check.</strong><p>These models have browser inference adapters. Arbitrary Hugging Face checkpoints and Python weight files cannot be loaded directly. Chatterbox uses a 256-token output cap, so keep scripts short; its ONNX port does not support expression tags.</p></div></div></>}

        {page === 'history' && <><div className="history-toolbar"><span>{history.length} of 20 recent generations</span><span><ShieldCheck size={14} /> Stored on this device</span></div>{history.length ? <><AudioPlayer generation={selected} /><div className="history-list">{history.map(g => <article className={`history-row ${g.id === selected?.id ? 'selected' : ''}`} key={g.id}><button className="history-play" onClick={() => setSelected(g)} aria-label={`Select generation by ${g.voiceName}`}><Play size={15} /></button><div className="history-row-body"><strong>{g.text.slice(0, 86)}{g.text.length > 86 ? '…' : ''}</strong><span>{g.voiceName}<i />{g.modelName}<i />{new Date(g.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div><span className="history-duration">{formatTime(g.duration)}</span><DownloadAudio generation={g} compact /><button className="history-delete" onClick={() => removeGeneration(g.id)} aria-label="Delete generation"><Trash2 size={15} /></button></article>)}</div></> : <div className="empty-state"><span className="empty-icon"><History size={30} /></span><h2>A little quiet here.</h2><p>Your generated audio will appear here, with the voice,<br />model, and performance details that made it.</p><Button onClick={() => navigate('playground')}><Sparkles size={16} /> Create your first generation</Button></div>}</>}
        <footer className="app-footer"><span><AudioLines size={13} /> Made for curious ears.</span><span>Open models. Your hardware. <span className="footer-dot" /> Resonance studio</span></footer>
      </main>
      <div className="statusbar"><span><span className={`status-dot ${isLoaded ? '' : 'neutral'}`} />{engine.status === 'idle' ? 'Engine idle' : engine.status === 'ready' ? `${engine.loaded ? getModel(engine.loaded.modelId)?.name : model.name} loaded` : engine.status === 'loading' ? 'Loading model…' : 'Generating speech…'}</span><span><Cpu size={12} />{hardware.gpu ? 'WebGPU available' : 'WebAssembly ready'}<span className="statusbar-separator" /><ShieldCheck size={12} /> Local inference</span></div>
    </div>
    {notice && <div className="toast" role="status"><Info size={18} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16} /></button></div>}
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent><div className="guide-brand"><Brand /></div><DialogTitle>Your browser is a voice studio.</DialogTitle><DialogDescription>Real open models. No Python setup. No inference server.</DialogDescription><div className="guide-steps"><div><span><Box size={18} /></span><div><h3>Choose a model and voice</h3><p>Start with Kokoro on CPU for a small download and expressive English speech. Choose WebGPU to use a compatible graphics processor.</p></div></div><div><span><Download size={18} /></span><div><h3>Download once, experiment often</h3><p>Model files come from Hugging Face and are cached by your browser. The first load takes longer. You still need the app and runtime files available to open a new session.</p></div></div><div><span><AudioLines size={18} /></span><div><h3>Generate, listen, compare</h3><p>Write your text, generate audio, and download a WAV. Runtime shows actual inference time and real-time factor. Your latest 20 generations are stored in this browser.</p></div></div></div><div className="guide-privacy"><ShieldCheck size={19} /><p>Your scripts and reference recordings are processed on your device. Model downloads contact Hugging Face. MMS models use a noncommercial license; check each model’s terms before publishing audio.</p></div><Button onClick={() => setHelpOpen(false)}>Let’s make something <ArrowRight size={15} /></Button></DialogContent></Dialog>
  </div>;
}



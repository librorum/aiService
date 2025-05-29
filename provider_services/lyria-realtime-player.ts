/*
 * LyriaRealtimePlayer – minimalist wrapper for Google Lyria realtime
 * ---------------------------------------------------------------
 * v0.4  2025-05-28
 *
 * ▸ npm i @google/genai web-audio-api speaker  (Node 실행시)
 *
 * 변화점 v0.4
 * • Node.js 자동 폴리필:  ⤵️  아래 "Node fallback" 블록 추가.
 *   - AudioContext 없는 환경에서 web-audio-api + speaker 를 동적 import
 *   - requestAnimationFrame/cancelAnimationFrame shim
 *
 * 브라우저는 영향 없음.
 */

/** Base64 → Uint8Array */
function decode(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

/** Uint8Array PCM → AudioBuffer */
async function decodeAudioData(
  pcm: Uint8Array,
  ctx: AudioContext,
  sampleRate = 48_000,
  channels = 2,
): Promise<AudioBuffer> {
  // Float32 PCM으로 변환
  const floats = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4)
  const buf = ctx.createBuffer(channels, floats.length / channels, sampleRate)
  for (let ch = 0; ch < channels; ch++) {
    buf.getChannelData(ch).set(floats.filter((_, i) => i % channels === ch))
  }
  return buf
}

import {
  GoogleGenAI,
  type LiveMusicSession,
  type LiveMusicServerMessage,
} from '@google/genai'

/*───────────────────── Node fallback (top‑level await) ───────────────────*/
if (typeof globalThis.AudioContext === 'undefined') {
  // ESM 상위 환경(top‑level await 지원)에서만 작동.
  const wa = await import('web-audio-api')
  const SpeakerMod: any = await import('speaker')
  const Speaker = SpeakerMod.default ?? SpeakerMod;
  (wa as any).setSpeaker(new Speaker())
  globalThis.AudioContext = (wa as any).AudioContext

  // RAF polyfill
  if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id)
  }
  // Window shim for code that checks window
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis as any
}
/*──────────────────────────────────────────────────────────────────────────*/

export type PlaybackState = 'stopped' | 'playing' | 'loading' | 'paused'

export interface Prompt {
  text: string
  weight: number // 0-2
}

export const PRESET_PROMPTS = {
  BOSSA_NOVA: 'Bossa Nova',
  CHILLWAVE: 'Chillwave',
  DRUM_AND_BASS: 'Drum and Bass',
  POST_PUNK: 'Post Punk',
  SHOEGAZE: 'Shoegaze',
  FUNK: 'Funk',
  CHIPTUNE: 'Chiptune',
  LUSH_STRINGS: 'Lush Strings',
  SPARKLING_ARPEGGIOS: 'Sparkling Arpeggios',
  STACCATO_RHYTHMS: 'Staccato Rhythms',
  PUNCHY_KICK: 'Punchy Kick',
  DUBSTEP: 'Dubstep',
  K_POP: 'K Pop',
  NEO_SOUL: 'Neo Soul',
  TRIP_HOP: 'Trip Hop',
  THRASH: 'Thrash',
} as const
export type PresetPromptKey = keyof typeof PRESET_PROMPTS

export function buildPrompt(name: PresetPromptKey, weight: number): Prompt {
  return { text: PRESET_PROMPTS[name], weight }
}
export function presets(...pairs: readonly [PresetPromptKey, number][]): Prompt[] {
  return pairs.map(([k, w]) => buildPrompt(k, w))
}

interface PlayerOptions {
  apiKey: string
  model?: string
  bufferTime?: number
  sampleRate?: number
}

type EventName = 'state' | 'level' | 'filter' | 'error'

export class LyriaRealtimePlayer {
  readonly #opt: Required<PlayerOptions>
  readonly #ai: GoogleGenAI
  #session!: LiveMusicSession
  #state: PlaybackState = 'stopped';
  #prompts: Prompt[] = [];

  readonly #ctx: AudioContext = new AudioContext({ sampleRate: 48000 });
  #out: GainNode = this.#ctx.createGain();
  #nextStart = 0;

  #anal: AnalyserNode = this.#ctx.createAnalyser();
  #buf: Uint8Array = new Uint8Array(this.#anal.frequencyBinCount);
  #raf = 0;

  #lis: { [K in EventName]?: Array<(arg: any) => void> } = {};

  constructor(opts: PlayerOptions) {
    this.#opt = {
      model: 'lyria-realtime-exp',
      bufferTime: 2,
      sampleRate: 48000,
      ...opts,
    } as Required<PlayerOptions>

    this.#ai = new GoogleGenAI({ apiKey: this.#opt.apiKey, apiVersion: 'v1alpha' })

    this.#ctx.sampleRate !== this.#opt.sampleRate && console.warn('Sample rate differs')
    this.#out.connect(this.#ctx.destination)
    this.#out.connect(this.#anal)
  }

  /*──────────────────── lifecycle ───────────────────*/
  async init() {
    if (this.#session) return
    this.#session = await this.#ai.live.music.connect({
      model: this.#opt.model,
      callbacks: {
        onmessage: (e) => this.#onMsg(e),
        onerror: (e) => this.#emit('error', e),
        onclose: () => this.#emit('error', new Error('session closed')),
      },
    })
    this.#startMeter()
  }

  destroy() {
    cancelAnimationFrame(this.#raf)
    this.stop()
    this.#ctx.close()
  }

  /*──────────────────── control ─────────────────────*/
  setPrompts(ps: Prompt[]) { this.#prompts = ps; this.#pushPrompts() }
  play() { if (this.#state === 'playing' || !this.#prompts.length) return; this.#ctx.resume(); this.#session.play(); this.#update('loading'); this.#fadeIn() }
  pause() { if (!['playing', 'loading'].includes(this.#state)) return; this.#session.pause(); this.#update('paused'); this.#resetAudio() }
  stop() { if (this.#state === 'stopped') return; this.#session.stop(); this.#update('stopped'); this.#resetAudio() }

  /*──────────────────── events ──────────────────────*/
  on<T extends EventName>(name: T, cb: (arg: any) => void) { (this.#lis[name] ??= []).push(cb) }
  #emit(n: EventName, a: any) { this.#lis[n]?.forEach(f => f(a)) }
  #update(s: PlaybackState) { this.#state = s; this.#emit('state', s) }

  /*──────────────────── internal ────────────────────*/
  async #pushPrompts() { const active = this.#prompts.filter(p => p.weight !== 0); if (!active.length) { this.pause(); return } await this.#session.setWeightedPrompts({ weightedPrompts: active }) }

  async #onMsg(e: LiveMusicServerMessage) {
    if (e.filteredPrompt) { this.#emit('filter', e.filteredPrompt); return }
    if (!e.serverContent?.audioChunks) return

    const buf = await decodeAudioData(decode(e.serverContent.audioChunks[0].data), this.#ctx, this.#opt.sampleRate, 2)
    const src = this.#ctx.createBufferSource(); src.buffer = buf; src.connect(this.#out)

    if (this.#nextStart === 0) { this.#nextStart = this.#ctx.currentTime + this.#opt.bufferTime; this.#update('playing') }
    if (this.#nextStart < this.#ctx.currentTime) { this.#update('loading'); this.#nextStart = 0; return }

    src.start(this.#nextStart)
    this.#nextStart += buf.duration
  }

  #resetAudio() { this.#out = this.#ctx.createGain(); this.#out.connect(this.#ctx.destination); this.#out.connect(this.#anal); this.#nextStart = 0 }
  #fadeIn() { this.#out.gain.setValueAtTime(0, this.#ctx.currentTime); this.#out.gain.linearRampToValueAtTime(1, this.#ctx.currentTime + 0.1) }
  #startMeter() { const meter = () => { this.#raf = requestAnimationFrame(meter); this.#anal.getByteFrequencyData(this.#buf); const avg = this.#buf.reduce((a, b) => a + b, 0) / this.#buf.length; this.#emit('level', avg / 255) }; meter() }
}

/*──────────────────── CLI quick‑test ───────────────────*/
console.log('import.meta.url', import.meta.url)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log('▶︎ LyriaRealtimePlayer quick test')
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY env not set')

    const player = new LyriaRealtimePlayer({ apiKey })
    await player.init()

    player.setPrompts([
      buildPrompt('BOSSA_NOVA', 1.2),
      buildPrompt('CHILLWAVE', 1.0),
      buildPrompt('SPARKLING_ARPEGGIOS', 0.8),
    ])
    player.play()

    setTimeout(() => player.setPrompts(presets(['DUBSTEP', 1.4], ['PUNCHY_KICK', 1.0], ['STACCATO_RHYTHMS', 0.7])), 10_000)
  })()
}

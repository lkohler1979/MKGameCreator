type ToneOptions = {
  type?: OscillatorType;
  startFreq?: number;
  volume?: number;
};

// Sequência curta em loop (estilo 8-bit) — sintetizada via Web Audio API, sem
// depender de nenhum arquivo de áudio externo (sem risco de licenciamento).
const MUSIC_SEQUENCE = [
  { freq: 392.0, duration: 0.22 },
  { freq: 440.0, duration: 0.22 },
  { freq: 493.88, duration: 0.22 },
  { freq: 440.0, duration: 0.22 },
  { freq: 392.0, duration: 0.22 },
  { freq: 349.23, duration: 0.22 },
  { freq: 392.0, duration: 0.44 },
];

export class GameAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.context) {
      this.context = new AudioContextClass();

      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;
      this.masterGain.connect(this.context.destination);

      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.masterGain);
    }

    if (this.context.state === "suspended") {
      void this.context.resume();
    }

    return this.context;
  }

  private playTone(freq: number, duration: number, options: ToneOptions = {}) {
    const context = this.ensureContext();
    if (!context || !this.masterGain) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? "square";

    const now = context.currentTime;
    if (options.startFreq) {
      oscillator.frequency.setValueAtTime(options.startFreq, now);
      oscillator.frequency.linearRampToValueAtTime(freq, now + duration);
    } else {
      oscillator.frequency.setValueAtTime(freq, now);
    }

    const volume = options.volume ?? 0.2;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  playJump() {
    this.playTone(660, 0.15, { startFreq: 330, type: "square", volume: 0.15 });
  }

  playCoin() {
    this.playTone(1046.5, 0.12, { startFreq: 784, type: "sine", volume: 0.2 });
  }

  playDamage() {
    this.playTone(110, 0.25, { startFreq: 220, type: "sawtooth", volume: 0.2 });
  }

  playPowerup() {
    this.playTone(880, 0.18, { startFreq: 440, type: "triangle", volume: 0.2 });
  }

  playWin() {
    if (!this.ensureContext()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      setTimeout(() => this.playTone(freq, 0.25, { type: "triangle", volume: 0.2 }), index * 120);
    });
  }

  playLose() {
    if (!this.ensureContext()) return;
    [392.0, 329.63, 261.63].forEach((freq, index) => {
      setTimeout(() => this.playTone(freq, 0.3, { type: "sawtooth", volume: 0.15 }), index * 150);
    });
  }

  startMusic() {
    const context = this.ensureContext();
    if (!context || !this.musicGain || this.musicTimeoutId) return;

    let index = 0;
    const playNext = () => {
      const note = MUSIC_SEQUENCE[index % MUSIC_SEQUENCE.length];
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(note.freq, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.duration);
      oscillator.connect(gain);
      gain.connect(this.musicGain as GainNode);
      oscillator.start(now);
      oscillator.stop(now + note.duration + 0.02);

      index += 1;
      this.musicTimeoutId = setTimeout(playNext, note.duration * 1000);
    };
    playNext();
  }

  stopMusic() {
    if (this.musicTimeoutId) {
      clearTimeout(this.musicTimeoutId);
      this.musicTimeoutId = null;
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 1;
    }
  }

  isMuted() {
    return this.muted;
  }

  destroy() {
    this.stopMusic();
    if (this.context) {
      void this.context.close();
      this.context = null;
      this.masterGain = null;
      this.musicGain = null;
    }
  }
}

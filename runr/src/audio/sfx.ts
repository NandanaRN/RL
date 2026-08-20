/*
 * RUNR synthesized sound effects.
 *
 * Uses the Web Audio API so the game needs zero audio
 * asset files. Browsers require a user gesture before
 * audio is allowed, so call `unlock()` on the first
 * pointer/keyboard interaction.
 */

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  /** Must be called from a user gesture (click / key / movement). */
  unlock() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!Ctor) return;

      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      const length = this.ctx.sampleRate * 0.5;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }

    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = "square",
    volume = 0.5,
    slideTo?: number
  ) {
    if (!this.ctx || !this.master) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        slideTo,
        this.ctx.currentTime + duration
      );
    }

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      this.ctx.currentTime + duration
    );

    osc.connect(gain);
    gain.connect(this.master);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private noise(duration: number, volume = 0.4, lowpass = 1200) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lowpass, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(
      80,
      this.ctx.currentTime + duration
    );

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    source.start();
    source.stop(this.ctx.currentTime + duration);
  }

  jump() {
    this.tone(320, 0.22, "square", 0.22, 640);
  }

  land() {
    this.noise(0.12, 0.35, 900);
  }

  slide() {
    this.noise(0.28, 0.3, 1400);
  }

  dodge() {
    this.noise(0.16, 0.24, 2000);
  }

  nearMiss() {
    this.tone(880, 0.09, "triangle", 0.4);
    this.tone(1320, 0.14, "triangle", 0.4, 1760);
  }

  clear() {
    this.tone(520, 0.1, "triangle", 0.3, 780);
  }

  hit() {
    this.tone(220, 0.45, "sawtooth", 0.5, 40);
    this.noise(0.4, 0.6, 700);
  }

  countdown() {
    this.tone(440, 0.12, "square", 0.25);
  }

  go() {
    this.tone(660, 0.2, "square", 0.3, 880);
    this.tone(880, 0.3, "triangle", 0.3);
  }

  levelUp() {
    this.tone(523, 0.12, "square", 0.3);
    this.tone(659, 0.12, "square", 0.3);
    this.tone(784, 0.18, "square", 0.35);
  }

  recovery() {
    this.tone(392, 0.2, "sine", 0.3);
    this.tone(494, 0.2, "sine", 0.3);
  }

  combo(level: number) {
    const base = 700 + Math.min(level, 20) * 60;
    this.tone(base, 0.08, "square", 0.22);
    this.tone(base * 1.25, 0.12, "square", 0.22);
  }

  gameOver() {
    this.tone(330, 0.25, "sawtooth", 0.35, 160);
    this.tone(160, 0.6, "sawtooth", 0.35, 60);
  }
}

export default new Sfx();
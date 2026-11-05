export interface AudioSpectrumData {
  bass: number; // 0..1
  mid: number; // 0..1
  treble: number; // 0..1
  overall: number; // 0..1
}

export class CosmicAudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private micStream: MediaStream | null = null;
  private synthOscillators: OscillatorNode[] = [];
  private synthGain: GainNode | null = null;
  private synthInterval: number | null = null;
  public micActive = false;
  public synthActive = false;

  private ensureContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public async enableMicrophone(): Promise<boolean> {
    try {
      const ctx = this.ensureContext();
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const source = ctx.createMediaStreamSource(this.micStream);
      if (this.analyser) {
        source.connect(this.analyser);
      }
      this.micActive = true;
      return true;
    } catch {
      this.micActive = false;
      return false;
    }
  }

  public disableMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.micActive = false;
  }

  public toggleProceduralSynth(enable: boolean): void {
    if (!enable) {
      this.stopSynth();
      return;
    }
    const ctx = this.ensureContext();
    this.stopSynth();

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.14, ctx.currentTime);
    if (this.analyser) {
      masterGain.connect(this.analyser);
    }
    masterGain.connect(ctx.destination);
    this.synthGain = masterGain;

    // Harmonic cosmic chord frequencies (Hz)
    const baseFreqs = [65.41, 98.0, 130.81, 196.0, 246.94, 293.66];
    baseFreqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      oscGain.gain.setValueAtTime(0.18 / baseFreqs.length, ctx.currentTime);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start();
      this.synthOscillators.push(osc);
    });

    // Rhythmic arpeggio pulse so the audio-reactive spectrum dances
    const scale = [130.81, 164.81, 196.0, 246.94, 261.63, 329.63, 392.0];
    let step = 0;
    this.synthInterval = window.setInterval(() => {
      if (!this.audioCtx || !this.synthGain) return;
      const now = this.audioCtx.currentTime;
      const pulseOsc = this.audioCtx.createOscillator();
      const pulseGain = this.audioCtx.createGain();
      pulseOsc.type = 'sine';
      pulseOsc.frequency.setValueAtTime(scale[step % scale.length], now);
      pulseGain.gain.setValueAtTime(0.08, now);
      pulseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      pulseOsc.connect(pulseGain);
      pulseGain.connect(this.synthGain);
      pulseOsc.start(now);
      pulseOsc.stop(now + 0.4);
      step++;
    }, 420);

    this.synthActive = true;
  }

  private stopSynth(): void {
    if (this.synthInterval !== null) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.synthOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    this.synthOscillators = [];
    if (this.synthGain) {
      this.synthGain.disconnect();
      this.synthGain = null;
    }
    this.synthActive = false;
  }

  public getSpectrum(timeSec: number): AudioSpectrumData {
    if ((!this.micActive && !this.synthActive) || !this.analyser || !this.freqData) {
      return { bass: 0, mid: 0, treble: 0, overall: 0 };
    }

    this.analyser.getByteFrequencyData(this.freqData);
    const len = this.freqData.length;
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;

    const bassEnd = Math.floor(len * 0.15);
    const midEnd = Math.floor(len * 0.55);

    for (let i = 0; i < len; i++) {
      const val = this.freqData[i] / 255.0;
      if (i < bassEnd) bassSum += val;
      else if (i < midEnd) midSum += val;
      else trebleSum += val;
    }

    const bass = Math.min(1, (bassSum / Math.max(1, bassEnd)) * 1.45);
    const mid = Math.min(1, (midSum / Math.max(1, midEnd - bassEnd)) * 1.6);
    const treble = Math.min(1, (trebleSum / Math.max(1, len - midEnd)) * 2.0);
    const overall = bass * 0.5 + mid * 0.35 + treble * 0.15;

    // Add gentle fallback harmonic pulse if synth is active
    if (this.synthActive && overall < 0.05) {
      const pulse = 0.35 + 0.25 * Math.sin(timeSec * 4.5);
      return { bass: pulse, mid: pulse * 0.8, treble: pulse * 0.5, overall: pulse };
    }

    return { bass, mid, treble, overall };
  }

  public dispose(): void {
    this.disableMicrophone();
    this.stopSynth();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}

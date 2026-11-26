// Ridge Runner — sound, all synthesised with WebAudio: an engine hum that
// follows the throttle, wind that follows speed, and chimes for the moments
// that matter. No audio files, no network. Starts on the first gesture.
export class FlightAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._engineOsc = null;
    this._engineGain = null;
    this._engineFilter = null;
    this._windGain = null;
    this._windSource = null;
  }

  // Call from a user gesture (click / keypress). Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // Engine: two detuned saws through a lowpass, pitch follows throttle.
      this._engineOsc = this.ctx.createOscillator();
      this._engineOsc.type = 'sawtooth';
      this._engineOsc.frequency.value = 62;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 93;
      this._engineFilter = this.ctx.createBiquadFilter();
      this._engineFilter.type = 'lowpass';
      this._engineFilter.frequency.value = 420;
      this._engineGain = this.ctx.createGain();
      this._engineGain.gain.value = 0.0;
      this._engineOsc.connect(this._engineFilter);
      osc2.connect(this._engineFilter);
      this._engineFilter.connect(this._engineGain);
      this._engineGain.connect(this.ctx.destination);
      this._engineOsc.start();
      osc2.start();
      this._osc2 = osc2;
      // Wind: looped noise through a bandpass, gain follows airspeed.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._windSource = this.ctx.createBufferSource();
      this._windSource.buffer = buf;
      this._windSource.loop = true;
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      this._windGain = this.ctx.createGain();
      this._windGain.gain.value = 0;
      this._windSource.connect(windFilter);
      windFilter.connect(this._windGain);
      this._windGain.connect(this.ctx.destination);
      this._windSource.start();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.ctx.destination.gain?.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
  }

  // Per-frame: throttle 0..1, speed m/s, onGround.
  update(throttle, speed, onGround) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const target = onGround && throttle < 0.05 ? 0 : 0.045 + throttle * 0.05;
    this._engineGain.gain.setTargetAtTime(target, t, 0.1);
    this._engineOsc.frequency.setTargetAtTime(58 + throttle * 62, t, 0.1);
    this._osc2.frequency.setTargetAtTime(87 + throttle * 93, t, 0.1);
    this._engineFilter.frequency.setTargetAtTime(380 + throttle * 900, t, 0.1);
    this._windGain.gain.setTargetAtTime(Math.min(0.09, Math.max(0, (speed - 18) / 95) * 0.09), t, 0.15);
  }

  _tone(freq, when, dur, gainValue, type = 'sine') {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(gainValue, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._tone(880, t, 0.35, 0.16);
    this._tone(1318.5, t + 0.09, 0.5, 0.14);
  }

  click() {
    if (!this.ctx) return;
    this._tone(1200, this.ctx.currentTime, 0.07, 0.08, 'square');
  }

  thud() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._tone(70, t, 0.3, 0.3, 'sine');
    this._tone(140, t, 0.18, 0.12, 'triangle');
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Noise burst through a lowpass, then a low boom.
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t);
    this._tone(52, t, 0.7, 0.3, 'sine');
  }
}

// Ridge Runner — keyboard + mouse input. Arrows / WASD fly the plane, the
// mouse steers by position, Shift/Ctrl work the throttle, and single keys
// handle gear, flaps, brake, pause and sound. Nothing here touches the DOM
// except reading pointer lock state.
export class FlightInput {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseActive = false;
    this._lastMouseX = null;
    this._lastMouseY = null;
    this._pressed = new Set();
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this._pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      if (this._lastMouseX === null) {
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
        return;
      }
      this.mouseDX += e.clientX - this._lastMouseX;
      this.mouseDY += e.clientY - this._lastMouseY;
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
      this.mouseActive = true;
    };
    this._onMouseDown = () => {
      this.mouseActive = true;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
  }

  // True once for the frame the key went down; call after reading.
  wasPressed(code) {
    return this._pressed.has(code);
  }

  endFrame() {
    this._pressed.clear();
    // Mouse steering decays: the stick recentres when the hand stops.
    this.mouseDX *= 0.86;
    this.mouseDY *= 0.86;
    if (Math.abs(this.mouseDX) < 0.4) this.mouseDX = 0;
    if (Math.abs(this.mouseDY) < 0.4) this.mouseDY = 0;
  }

  // Build the per-frame control vector from keys + mouse.
  readControls() {
    const k = this.keys;
    let pitch = 0;
    let roll = 0;
    if (k.has('ArrowUp') || k.has('KeyW')) pitch += 1;
    if (k.has('ArrowDown') || k.has('KeyS')) pitch -= 1;
    if (k.has('ArrowLeft') || k.has('KeyA')) roll -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) roll += 1;
    // Mouse: moving the pointer away from centre is stick deflection.
    const rect = this.canvas.getBoundingClientRect();
    if (this.mouseActive && rect.width > 0) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const mx = (this._lastMouseX ?? cx) - cx;
      const my = (this._lastMouseY ?? cy) - cy;
      const nx = Math.max(-1, Math.min(1, mx / (rect.width * 0.32)));
      const ny = Math.max(-1, Math.min(1, my / (rect.height * 0.32)));
      // Blend: the mouse steers gently, the keys override it.
      if (roll === 0) roll += nx * 0.9;
      if (pitch === 0) pitch -= ny * 0.9;
    }
    let throttleDelta = 0;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) throttleDelta += 0.55;
    if (k.has('ControlLeft') || k.has('ControlRight')) throttleDelta -= 0.55;
    if (k.has('KeyR')) throttleDelta += 0.55;
    if (k.has('KeyF')) throttleDelta -= 0.55;
    let yaw = 0;
    if (k.has('KeyQ')) yaw -= 1;
    if (k.has('KeyE')) yaw += 1;
    const brake = k.has('Space') || k.has('KeyB') ? 1 : 0;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      yaw,
      throttleDelta,
      brake,
    };
  }
}

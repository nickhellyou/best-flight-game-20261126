// Ridge Runner — bootstrap and game loop: renderer, chase camera, state
// machine (title / flying / paused / over), event wiring between the flight
// model, the missions, the HUD and the sound. The simulation runs on a
// clamped clock so a slow frame never teleports the plane.
import * as THREE from 'three';
import { AIRFIELD_NAME, CALLSIGN, GAME_NAME, GAME_TAGLINE, MISSIONS, RADIO } from './config.js';
import { buildTerrain } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { FlightModel } from './flight.js';
import { MissionRunner, buildMissionMeshes } from './missions.js';
import { FlightAudio } from './audio.js';
import { FlightInput } from './input.js';
import { FlightHud } from './hud.js';
import { applyShotScene, parseShotQuery } from './shots.js';

const DEG = Math.PI / 180;

class RidgeRunnerGame {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 5200);
    this.terrain = buildTerrain(this.scene);
    this.aircraft = buildAircraft();
    this.scene.add(this.aircraft.group);
    this.flight = new FlightModel();
    this.input = new FlightInput(this.canvas);
    this.audio = new FlightAudio();
    this.hud = new FlightHud(this.terrain);
    this.state = 'title';
    this.mission = new MissionRunner('ring-run', this.terrain.heightAt);
    this.missionMeshes = buildMissionMeshes(this.scene, this.mission, this.terrain.heightAt);
    this.hud.setMission(this.mission);
    this._camPos = new THREE.Vector3(0, 30, 340);
    this._frames = 0;
    this._simTime = 0;
    this._shotReady = false;
    this._shotScene = null;
    this._lastTime = performance.now();
    window.addEventListener('resize', () => this.resize());
    // Sound starts on a gesture only; creating an AudioContext every frame
    // before one just spams autoplay warnings.
    const gesture = () => this.audio.ensure();
    window.addEventListener('keydown', gesture, { once: true });
    window.addEventListener('pointerdown', gesture, { once: true });
    this.resize();
    this._wireOverlay();
    this.showTitle();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  selectMission(missionId, opts = {}) {
    if (this.missionMeshes) {
      this.scene.remove(this.missionMeshes.group);
    }
    this.mission = new MissionRunner(missionId, this.terrain.heightAt);
    this.missionMeshes = buildMissionMeshes(this.scene, this.mission, this.terrain.heightAt);
    this.hud.setMission(this.mission);
    if (!opts.silent) {
      for (const line of this.mission.startLine()) this.hud.radio(RADIO.tower, line);
    }
  }

  refreshMissionMeshes() {
    // Rebuild the mission meshes so staged scenes (screenshots) show the
    // rings already passed in green.
    if (this.missionMeshes) this.scene.remove(this.missionMeshes.group);
    this.missionMeshes = buildMissionMeshes(this.scene, this.mission, this.terrain.heightAt);
    for (const child of this.missionMeshes.group.children) {
      if (child.userData.ring?.passed) {
        child.userData.mat.color.setHex(0x37d67a);
        child.userData.mat.emissive.setHex(0x0a4a22);
      }
    }
  }

  _wireOverlay() {
    const overlay = document.getElementById('overlay');
    overlay.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mission]');
      if (btn) {
        this.selectMission(btn.dataset.mission);
        this.startFlight();
        return;
      }
      if (e.target.closest('[data-action="start"]')) this.startFlight();
      if (e.target.closest('[data-action="restart"]')) this.restart();
    });
  }

  showTitle() {
    this.state = 'title';
    const missionButtons = MISSIONS.map(
      (m) =>
        `<button class="mission-btn" data-mission="${m.id}">
           <span class="mission-btn-name">${m.index + 1}. ${m.name}</span>
           <span class="mission-btn-goal">${m.goal} · ${Math.floor(m.timeLimitSec / 60)}:00</span>
         </button>`,
    ).join('');
    this.hud.showOverlay(
      GAME_NAME,
      `${GAME_TAGLINE} — pick a sortie. Fly with arrows or WASD, steer with the mouse, Shift/Ctrl for throttle, G gear, F flaps, Space brake.`,
      '',
    );
    document.getElementById('overlay-text').innerHTML =
      `${GAME_TAGLINE} — pick a sortie. Fly with arrows or WASD, steer with the mouse, Shift/Ctrl for throttle, G gear, F flaps, Space brake.` +
      `<div class="mission-list">${missionButtons}</div>`;
    document.getElementById('overlay-hint').innerHTML =
      '<button class="start-btn" data-action="start">Fly Ring Run</button> <span class="hint-keys">1/2/3 mission · Enter fly · P pause · M sound</span>';
  }

  startFlight() {
    this.audio.ensure();
    this.flight.reset();
    this.selectMission(this.mission.id);
    this.state = 'flying';
    this.hud.hideOverlay();
    this.hud.banner(`${this.mission.def.name.toUpperCase()} — ${this.mission.def.goal}`, 4200);
  }

  restart() {
    this.flight.reset();
    this.selectMission(this.mission.id);
    this.state = 'flying';
    this.hud.hideOverlay();
    this.hud.banner('AGAIN — THROTTLE UP', 2600);
  }

  _handleKeyToggles() {
    if (this.input.wasPressed('KeyG') && this.state === 'flying') {
      this.flight.gearDown = !this.flight.gearDown;
      this.audio.click();
      this.hud.banner(this.flight.gearDown ? 'GEAR DOWN' : 'GEAR UP', 1400);
    }
    if (this.input.wasPressed('KeyF') && this.state === 'flying') {
      this.flight.flaps = !this.flight.flaps;
      this.audio.click();
      this.hud.banner(this.flight.flaps ? 'FLAPS DOWN' : 'FLAPS UP', 1400);
    }
    if (this.input.wasPressed('KeyM')) {
      this.audio.ensure();
      this.audio.setMuted(!this.audio.muted);
      this.hud.banner(this.audio.muted ? 'SOUND OFF' : 'SOUND ON', 1200);
    }
    if (this.input.wasPressed('KeyP') && (this.state === 'flying' || this.state === 'paused')) {
      if (this.state === 'flying') {
        this.state = 'paused';
        this.hud.showOverlay('Paused', 'The valley waits. P to resume, R to restart the sortie.', '');
        document.getElementById('overlay-hint').innerHTML =
          '<button class="start-btn" data-action="start">Resume</button>';
      } else {
        this.state = 'flying';
        this.hud.hideOverlay();
      }
    }
    if (this.input.wasPressed('Enter') && this.state === 'title') this.startFlight();
    if (this.input.wasPressed('Enter') && this.state === 'paused') {
      this.state = 'flying';
      this.hud.hideOverlay();
    }
    if (this.input.wasPressed('KeyR') && (this.state === 'over' || this.state === 'paused')) {
      this.restart();
    }
    if (this.state === 'title') {
      if (this.input.wasPressed('Digit1')) {
        this.selectMission('ring-run');
        this.startFlight();
      }
      if (this.input.wasPressed('Digit2')) {
        this.selectMission('canyon-courier');
        this.startFlight();
      }
      if (this.input.wasPressed('Digit3')) {
        this.selectMission('bush-landing');
        this.startFlight();
      }
    }
  }

  _applyFlightEvents(events) {
    for (const ev of events) {
      if (ev.type === 'takeoff') {
        this.hud.banner('AIRBORNE', 2200);
        this.hud.radio(CALLSIGN, 'Kestrel 2 airborne, gear coming up.');
      }
      if (ev.type === 'stall') this.hud.radio(RADIO.tower, RADIO.lines.stall[0]);
      if (ev.type === 'half-fuel') this.hud.radio(RADIO.tower, RADIO.lines.halfFuel[0]);
      if (ev.type === 'low-fuel') this.hud.radio(RADIO.tower, RADIO.lines.lowFuel[0]);
      if (ev.type === 'fuel-empty') this.hud.banner('FUEL EMPTY — GLIDING', 4000);
      if (ev.type === 'landed') {
        this.audio.thud();
        const result = this.mission.onLanded(ev.quality);
        this._endFlight(ev.quality === 'perfect' ? 'Greased it.' : 'Down safe.', result);
      }
      if (ev.type === 'crashed') {
        this.audio.crash();
        const result = this.mission.onCrashed(ev.reason);
        this.hud.radio(RADIO.tower, RADIO.lines.crashed[0]);
        this._endFlight('Crashed.', result, true);
      }
    }
  }

  _applyMissionEvents(events) {
    for (const ev of events) {
      if (ev.type === 'ring-passed') {
        this.audio.chime();
        this.hud.banner(`RING ${ev.index} OF 6 — +150`, 2000);
        this.hud.radio(
          RADIO.tower,
          RADIO.lines.ringPass[(ev.index - 1) % RADIO.lines.ringPass.length],
        );
      }
      if (ev.type === 'checkpoint') {
        this.audio.chime();
        this.hud.banner(`BEACON ${ev.index} OF 8 — +100`, 2000);
      }
      if (ev.type === 'mission-complete') {
        this.hud.banner('SORTIE COMPLETE', 5000);
        this._endFlight('Sortie complete.', ev, false);
      }
      if (ev.type === 'mission-failed') {
        this._endFlight('Sortie over.', ev, false);
      }
    }
  }

  _endFlight(headline, result, crashed = false) {
    this.state = 'over';
    const score = this.mission.score;
    const text = result?.text ?? this.mission.resultText;
    this.hud.showOverlay(
      crashed ? 'Crashed.' : headline,
      `${text} Score ${score}.`,
      '',
    );
    document.getElementById('overlay-hint').innerHTML =
      '<button class="start-btn" data-action="restart">Fly again (R)</button> ' +
      `<span class="hint-keys">Score ${score} · ${this.mission.def.name} · ${AIRFIELD_NAME}</span>`;
  }

  // Staged screenshot mode: a tiny autopilot flies the plane at the next
  // target (or down the runway) so the ring stays in frame while the shot
  // settles, instead of the staged bank curving the plane away from it.
  _shotControls() {
    const f = this.flight;
    if (f.onGround) return { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, brake: 0 };
    const target = this.mission.nextTarget();
    let desiredHeading = f.headingDeg;
    let desiredAlt = f.y;
    if (this.mission.id === 'bush-landing') {
      desiredHeading = 0; // runway 36 heading
      desiredAlt = this.terrain.heightAt(f.x, f.z) + 24;
    } else if (target) {
      desiredHeading = (Math.atan2(target.x - f.x, -(target.z - f.z)) / DEG + 360) % 360;
      desiredAlt = target.y;
    }
    const err = (((desiredHeading - f.headingDeg + 540) % 360) - 180);
    const roll = Math.max(-1, Math.min(1, err / 22));
    const altErr = desiredAlt - f.y;
    const pitch = Math.max(-0.6, Math.min(0.6, altErr / 30));
    return { pitch, roll, yaw: 0, throttleDelta: 0, brake: 0 };
  }

  frame(now) {
    const dt = Math.min(0.05, Math.max(0.0001, (now - this._lastTime) / 1000));
    this._lastTime = now;
    this._frames++;
    if (this.state === 'flying') this._simTime += dt;
    this._handleKeyToggles();

    if (this.state === 'flying' && !this._shotFrozen) {
      let controls = this.input.readControls();
      if (this._shotName) {
        controls = this._shotControls();
        const stagedThrottle = this._shotScene?.place?.throttle ?? this._shotScene?.throttle ?? 0.6;
        this.flight.throttle = stagedThrottle;
      }
      const flightEvents = this.flight.step(dt, controls, this.terrain.heightAt);
      const missionEvents = this.mission.update(dt, this.flight, this.missionMeshes);
      this._applyFlightEvents(flightEvents);
      this._applyMissionEvents(missionEvents);
      this.audio.update(this.flight.throttle, this.flight.speed, this.flight.onGround);
    }
    this.input.endFrame();

    // Aircraft transform from the flight model.
    const f = this.flight;
    this.aircraft.group.position.set(f.x, f.y, f.z);
    this.aircraft.group.rotation.order = 'YXZ';
    this.aircraft.group.rotation.set(f.pitchDeg * DEG, -f.headingDeg * DEG, -f.bankDeg * DEG);
    this.aircraft.prop.rotation.z -= dt * (3 + f.throttle * 42);
    this.aircraft.gear.visible = f.gearDown;

    // Chase camera: behind and above, eased, with a hint of the bank.
    const fwd = {
      x: Math.sin(f.headingDeg * DEG) * Math.cos(f.pitchDeg * DEG),
      y: Math.sin(f.pitchDeg * DEG),
      z: -Math.cos(f.headingDeg * DEG) * Math.cos(f.pitchDeg * DEG),
    };
    const desired = new THREE.Vector3(
      f.x - fwd.x * 12.0,
      f.y - fwd.y * 12.0 + 4.0,
      f.z - fwd.z * 12.0,
    );
    const k = 1 - Math.exp(-dt * 5.5);
    this._camPos.lerp(desired, k);
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(f.x + fwd.x * 22, f.y + fwd.y * 22 + 0.6, f.z + fwd.z * 22);
    this.camera.rotateZ(-f.bankDeg * 0.32 * DEG);

    // The sun's shadow frustum follows the plane.
    this.terrain.sun.target.position.set(f.x, f.y, f.z);
    this.terrain.sun.position.set(f.x - 600, f.y + 420, f.z - 350);
    this.terrain.update(dt);

    // HUD + warnings.
    const warnings = [];
    if (f.stalled) warnings.push('STALL');
    if (f.overspeed) warnings.push('OVERSPEED');
    if (f.engineOut) warnings.push('ENGINE OUT');
    else if (f.fuel < 20) warnings.push('FUEL LOW');
    if (f.damage > 50) warnings.push('DAMAGE');
    this.hud.update(dt, f, this.mission, warnings);

    this.renderer.render(this.scene, this.camera);

    // Staged screenshot mode: settle, then tell the driver we are ready.
    // Sim time, not frame count: a slow software renderer still gets the
    // same 2.2 seconds of flight before the shot.
    if (this._shotName && !this._shotReady && this._frames > 20 && this._simTime >= 2.2) {
      this._shotReady = true;
      window.__ridgeRunner = { ready: true, shot: this._shotName, state: this.state };
    }
  }
}

const game = new RidgeRunnerGame();
const { shot } = parseShotQuery(window.location.search);
if (shot) {
  game._shotName = shot;
  applyShotScene(game, shot);
  // In shot mode the game starts flying at once, no title screen.
  game.state = 'flying';
  game.hud.hideOverlay();
}
window.__ridgeRunner = window.__ridgeRunner ?? { ready: false, shot: shot ?? null, state: game.state };

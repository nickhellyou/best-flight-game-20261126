// Ridge Runner — the HUD: lit instruments, attitude indicator, compass tape,
// minimap, radio chatter and the title / pause / end overlays. The HUD is
// DOM + small canvases so it stays crisp in a screenshot at any size.
import { RUNWAY } from './config.js';

const DEG = Math.PI / 180;

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

export function formatHeading(deg) {
  const h = ((Math.round(deg) % 360) + 360) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `${String(h).padStart(3, '0')}° ${names[Math.round(h / 45) % 8]}`;
}

export class FlightHud {
  constructor(terrain) {
    this.terrain = terrain;
    this.el = {
      alt: document.getElementById('hud-alt'),
      spd: document.getElementById('hud-spd'),
      hdg: document.getElementById('hud-hdg'),
      vsi: document.getElementById('hud-vsi'),
      thrFill: document.getElementById('hud-thr-fill'),
      thrVal: document.getElementById('hud-thr-val'),
      fuelFill: document.getElementById('hud-fuel-fill'),
      fuelVal: document.getElementById('hud-fuel-val'),
      dmgFill: document.getElementById('hud-dmg-fill'),
      dmgVal: document.getElementById('hud-dmg-val'),
      score: document.getElementById('hud-score'),
      time: document.getElementById('hud-time'),
      mission: document.getElementById('hud-mission'),
      objective: document.getElementById('hud-objective'),
      warn: document.getElementById('hud-warn'),
      radio: document.getElementById('hud-radio'),
      banner: document.getElementById('hud-banner'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayText: document.getElementById('overlay-text'),
      overlayHint: document.getElementById('overlay-hint'),
      gear: document.getElementById('hud-gear'),
      flaps: document.getElementById('hud-flaps'),
      attitude: document.getElementById('hud-attitude'),
      compass: document.getElementById('hud-compass'),
      minimap: document.getElementById('hud-minimap'),
    };
    this._radioLines = [];
    this._bannerTimer = 0;
    this._minimapBase = this._paintMinimapBase();
  }

  // Pre-render the valley once: green low ground, brown high ground, the
  // river in blue and the runway as a dark strip.
  _paintMinimapBase() {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(180, 180);
    for (let py = 0; py < 180; py++) {
      for (let px = 0; px < 180; px++) {
        const x = (px / 180) * 2400 - 1200;
        const z = (py / 180) * 2400 - 1200;
        const h = this.terrain.heightAt(x, z);
        let r;
        let g;
        let b;
        if (h < 3.5) {
          r = 63;
          g = 127;
          b = 191; // water
        } else if (h > 85) {
          r = 232;
          g = 238;
          b = 242; // snow
        } else if (h > 60) {
          r = 138;
          g = 122;
          b = 104; // rock
        } else if (h > 30) {
          r = 181;
          g = 160;
          b = 90; // dry grass
        } else {
          r = 109;
          g = 162;
          b = 74; // grass
        }
        const i = (py * 180 + px) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Runway strip.
    ctx.fillStyle = '#2c2f34';
    ctx.fillRect(88, 78, 4, 76);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(89, 82, 2, 68);
    return canvas;
  }

  setMission(mission) {
    this.el.mission.textContent = mission.def.name.toUpperCase();
    this.el.objective.textContent = mission.objectiveText();
  }

  radio(speaker, line) {
    this._radioLines.push({ speaker, line });
    if (this._radioLines.length > 3) this._radioLines.shift();
    this.el.radio.innerHTML = this._radioLines
      .map(
        (l) =>
          `<div class="radio-line"><span class="radio-who">${l.speaker}</span> ${l.line}</div>`,
      )
      .join('');
  }

  banner(text, ms = 2600) {
    this.el.banner.textContent = text;
    this.el.banner.classList.add('show');
    this._bannerTimer = ms;
  }

  showOverlay(title, text, hint) {
    this.el.overlayTitle.textContent = title;
    this.el.overlayText.textContent = text;
    this.el.overlayHint.textContent = hint;
    this.el.overlay.classList.remove('hidden');
  }

  hideOverlay() {
    this.el.overlay.classList.add('hidden');
  }

  // dt seconds since the last call; plane is the FlightModel.
  update(dt, plane, mission, warnings) {
    const altM = plane.y - this.terrain.heightAt(plane.x, plane.z);
    this.el.alt.textContent = `${Math.max(0, Math.round(altM * 3.28))} ft`;
    this.el.spd.textContent = `${Math.round(plane.speed * 1.94)} kt`;
    this.el.hdg.textContent = formatHeading(plane.headingDeg);
    const vsi = plane.verticalSpeed * 196.85;
    this.el.vsi.textContent = `${vsi >= 0 ? '+' : ''}${Math.round(vsi)} fpm`;
    this.el.thrFill.style.width = `${Math.round(plane.throttle * 100)}%`;
    this.el.thrVal.textContent = `${Math.round(plane.throttle * 100)}%`;
    this.el.fuelFill.style.width = `${Math.round(plane.fuel)}%`;
    this.el.fuelFill.classList.toggle('low', plane.fuel < 20);
    this.el.fuelVal.textContent = `${Math.round(plane.fuel)}%`;
    this.el.dmgFill.style.width = `${Math.round(plane.damage)}%`;
    this.el.dmgFill.classList.toggle('bad', plane.damage > 50);
    this.el.dmgVal.textContent = `${Math.round(plane.damage)}%`;
    this.el.score.textContent = String(mission.score);
    this.el.time.textContent = formatClock(mission.timeLeft);
    this.el.time.classList.toggle('low', mission.timeLeft < 30);
    this.el.objective.textContent = mission.objectiveText();
    this.el.gear.textContent = plane.gearDown ? 'GEAR DOWN' : 'GEAR UP';
    this.el.gear.classList.toggle('on', plane.gearDown);
    this.el.flaps.textContent = plane.flaps ? 'FLAPS' : 'FLAPS UP';
    this.el.flaps.classList.toggle('on', plane.flaps);
    this.el.warn.textContent = warnings.join('  ·  ');
    this.el.warn.classList.toggle('show', warnings.length > 0);
    if (this._bannerTimer > 0) {
      this._bannerTimer -= dt * 1000;
      if (this._bannerTimer <= 0) this.el.banner.classList.remove('show');
    }
    this._drawAttitude(plane);
    this._drawCompass(plane.headingDeg);
    this._drawMinimap(plane, mission);
  }

  _drawAttitude(plane) {
    const c = this.el.attitude;
    const ctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-plane.bankDeg * DEG);
    const pitchPx = Math.max(-34, Math.min(34, plane.pitchDeg * 1.6));
    ctx.translate(0, pitchPx);
    ctx.fillStyle = '#3f6fb5';
    ctx.fillRect(-w, -h, w * 2, h);
    ctx.fillStyle = '#8a6b42';
    ctx.fillRect(-w, 0, w * 2, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.lineTo(w, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    for (const dy of [-22, 22]) {
      ctx.beginPath();
      ctx.moveTo(-26, dy);
      ctx.lineTo(26, dy);
      ctx.stroke();
    }
    ctx.restore();
    // Fixed aircraft symbol.
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 24, h / 2);
    ctx.lineTo(w / 2 + 24, h / 2);
    ctx.moveTo(w / 2, h / 2 - 4);
    ctx.lineTo(w / 2, h / 2 + 4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawCompass(headingDeg) {
    const c = this.el.compass;
    const ctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    const pxPerDeg = w / 120;
    for (let d = -60; d <= 60; d += 5) {
      const deg = Math.round(((headingDeg + d) % 360 + 360) % 360);
      const x = w / 2 + d * pxPerDeg;
      const major = deg % 30 === 0;
      ctx.strokeStyle = major ? '#fff' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, major ? 4 : 10);
      ctx.lineTo(x, 18);
      ctx.stroke();
      if (major) {
        const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg] ?? String(deg).padStart(3, '0');
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, 30);
      }
    }
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 5, 0);
    ctx.lineTo(w / 2 + 5, 0);
    ctx.lineTo(w / 2, 7);
    ctx.fill();
  }

  _drawMinimap(plane, mission) {
    const c = this.el.minimap;
    const ctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this._minimapBase, 0, 0, w, h);
    const toMap = (x, z) => [((x + 1200) / 2400) * w, ((z + 1200) / 2400) * h];
    // Next target: ring or beacon, pulsing.
    const target = mission.nextTarget();
    if (target) {
      const [tx, ty] = toMap(target.x, target.z);
      const pulse = 6 + Math.sin(performance.now() * 0.006) * 2;
      ctx.strokeStyle = '#ff8c1a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(tx, ty, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Passed rings / collected beacons as small green dots.
    ctx.fillStyle = '#37d67a';
    for (const ring of mission.rings) {
      if (!ring.passed) continue;
      const [rx, ry] = toMap(ring.x, ring.z);
      ctx.beginPath();
      ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Runway label.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 9px Arial, sans-serif';
    ctx.fillText('KESTREL', 96, 74);
    // The plane: a yellow triangle pointing along its heading.
    const [px, py] = toMap(plane.x, plane.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(plane.headingDeg * DEG);
    ctx.fillStyle = '#ffd23e';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }
}

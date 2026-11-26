// Ridge Runner — missions: where the rings and beacons hang, and the runner
// that tracks progress, score and the clock. Waypoints are placed from the
// terrain, so they always sit in flyable air above real ground.
import * as THREE from 'three';
import { MISSIONS, PALETTE, RADIO, RUNWAY, SCORE } from './config.js';
import { riverCentreX } from './terrain.js';

function ringPositions(heightAt) {
  // A flowing oval around the valley, not a zigzag: each leg turns at most
  // ~45 degrees from the last and is 300+ m long, so the rings can be
  // flown at speed with throttle discipline instead of a sharp reversal
  // into the northern ridge.
  const spots = [
    [170, -120],
    [250, -450],
    [120, -800],
    [-160, -830],
    [-290, -480],
    [-170, -100],
  ];
  return spots.map(([x, z]) => ({
    x,
    z,
    y: heightAt(x, z) + 34,
    radius: 14,
    passed: false,
  }));
}

function checkpointPositions(heightAt) {
  // Eight beacons down the river canyon, south to north.
  const spots = [];
  for (let i = 0; i < 8; i++) {
    const z = 620 - i * 165;
    const x = riverCentreX(z);
    spots.push({ x, z, y: heightAt(x, z) + 20, collected: false });
  }
  return spots;
}

export function buildMissionMeshes(scene, mission, heightAt) {
  const group = new THREE.Group();
  const data = { rings: [], checkpoints: [] };
  if (mission.id === 'ring-run') {
    data.rings = mission.rings;
    const geo = new THREE.TorusGeometry(14, 1.4, 12, 40);
    data.rings.forEach((ring) => {
      const mat = new THREE.MeshLambertMaterial({
        color: PALETTE.ringNext,
        emissive: 0x803a00,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(ring.x, ring.y, ring.z);
      mesh.userData.ring = ring;
      mesh.userData.mat = mat;
      group.add(mesh);
      // A small pylon under each ring so it reads as placed, not floating.
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.9, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0x5a5f66 }),
      );
      pylon.position.set(ring.x, ring.y - 19, ring.z);
      group.add(pylon);
    });
  }
  if (mission.id === 'canyon-courier') {
    data.checkpoints = mission.checkpoints;
    data.checkpoints.forEach((cp) => {
      const beacon = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(3.2, 0),
        new THREE.MeshLambertMaterial({ color: PALETTE.beacon, emissive: 0x0a4a66 }),
      );
      beacon.add(core);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 46, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: PALETTE.beacon,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      beam.position.y = 20;
      beacon.add(beam);
      beacon.position.set(cp.x, cp.y, cp.z);
      beacon.userData.cp = cp;
      beacon.userData.core = core;
      group.add(beacon);
    });
  }
  scene.add(group);
  return { group, data };
}

export class MissionRunner {
  constructor(missionId, heightAt) {
    this.def = MISSIONS.find((m) => m.id === missionId) ?? MISSIONS[0];
    this.id = this.def.id;
    this.heightAt = heightAt;
    this.rings = this.id === 'ring-run' ? ringPositions(heightAt) : [];
    this.checkpoints = this.id === 'canyon-courier' ? checkpointPositions(heightAt) : [];
    this.score = 0;
    this.timeLeft = this.def.timeLimitSec;
    this.done = false;
    this.failed = false;
    this.resultText = '';
    this.nextRingIndex = 0;
    this.ringsPassed = 0;
    this.checkpointsCollected = 0;
    this.landingQuality = null;
    this._timeBonusAdded = false;
  }

  startLine() {
    if (this.id === 'ring-run') return RADIO.lines.ringStart;
    if (this.id === 'canyon-courier') return RADIO.lines.courierStart;
    return RADIO.lines.landingStart;
  }

  nextTarget() {
    if (this.id === 'ring-run') return this.rings[this.nextRingIndex] ?? null;
    if (this.id === 'canyon-courier') {
      return this.checkpoints.find((c) => !c.collected) ?? null;
    }
    return null;
  }

  // Called every frame with the plane position. Returns event objects.
  update(dt, plane, missionMeshes) {
    const events = [];
    if (this.done || this.failed) return events;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.failed = true;
      this.resultText = 'Out of time — the sortie clock ran out.';
      events.push({ type: 'mission-failed', reason: this.resultText });
      return events;
    }
    if (this.id === 'ring-run') {
      const ring = this.rings[this.nextRingIndex];
      if (ring) {
        const dx = plane.x - ring.x;
        const dy = plane.y - ring.y;
        const dz = plane.z - ring.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < ring.radius - 1.5) {
          ring.passed = true;
          this.ringsPassed++;
          this.score += SCORE.ring;
          this.nextRingIndex++;
          events.push({ type: 'ring-passed', index: this.ringsPassed, score: this.score });
          if (missionMeshes) {
            for (const child of missionMeshes.group.children) {
              if (child.userData.ring === ring) {
                child.userData.mat.color.setHex(PALETTE.ringDone);
                child.userData.mat.emissive.setHex(0x0a4a22);
              }
              const next = this.rings[this.nextRingIndex];
              if (next && child.userData.ring === next) {
                child.scale.setScalar(1.12);
              }
            }
          }
          if (this.nextRingIndex >= this.rings.length) {
            this.complete(events, 'All six rings — clean flying, Kestrel 2.');
          }
        }
      }
    }
    if (this.id === 'canyon-courier') {
      for (const cp of this.checkpoints) {
        if (cp.collected) continue;
        const dx = plane.x - cp.x;
        const dy = plane.y - cp.y;
        const dz = plane.z - cp.z;
        // A generous 20 m sphere: the beacon is a light beam you fly
        // through, not a needle to thread like the rings.
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 20) {
          cp.collected = true;
          this.checkpointsCollected++;
          this.score += SCORE.checkpoint;
          events.push({ type: 'checkpoint', index: this.checkpointsCollected, score: this.score });
          if (missionMeshes) {
            for (const child of missionMeshes.group.children) {
              if (child.userData.cp === cp) child.visible = false;
            }
          }
          if (this.checkpointsCollected >= this.checkpoints.length) {
            this.complete(events, 'All eight beacons collected. River run complete.');
          }
          break;
        }
      }
    }
    return events;
  }

  complete(events, text) {
    this.done = true;
    const bonus = Math.round(this.timeLeft) * SCORE.timeBonusPerSecond;
    this.score += bonus;
    this.resultText = `${text} Time bonus +${bonus}.`;
    events.push({ type: 'mission-complete', score: this.score, text: this.resultText });
  }

  // The landing mission ends on touchdown, not on a target.
  onLanded(quality) {
    if (this.done || this.failed) return null;
    this.landingQuality = quality;
    if (this.id === 'bush-landing') {
      if (quality === 'field') {
        this.failed = true;
        this.resultText = 'Down in a field — the plane is safe, but the runway was the job.';
        return { type: 'mission-failed', reason: this.resultText };
      }
      const bonus =
        quality === 'perfect' ? SCORE.landingPerfect : quality === 'good' ? SCORE.landingGood : SCORE.landingRough;
      this.score += bonus;
      this.complete([], `Touchdown on runway 36 — ${quality} landing, +${bonus}.`);
      return { type: 'mission-complete', score: this.score, text: this.resultText };
    }
    // Other missions: landing ends the sortie early, score kept.
    this.failed = true;
    this.resultText = 'Landed with the sortie unfinished.';
    return { type: 'mission-failed', reason: this.resultText };
  }

  onCrashed(reason) {
    if (this.done) return null;
    this.failed = true;
    this.resultText = reason;
    return { type: 'mission-failed', reason };
  }

  objectiveText() {
    if (this.id === 'ring-run') return `Rings ${this.ringsPassed} / ${this.rings.length}`;
    if (this.id === 'canyon-courier') return `Beacons ${this.checkpointsCollected} / ${this.checkpoints.length}`;
    return 'Land on runway 36';
  }

  progressFraction() {
    if (this.id === 'ring-run') return this.ringsPassed / this.rings.length;
    if (this.id === 'canyon-courier') return this.checkpointsCollected / this.checkpoints.length;
    return this.landingQuality ? 1 : 0;
  }
}

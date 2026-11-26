// Ridge Runner — the flight model: an arcade model with real discipline in
// it. Speed is bought with throttle, turns are bought with bank, lift quits
// below stall speed, and the ground is always waiting. No rendering here:
// this file only moves numbers, so it can be tested on its own.
import { FLIGHT, RUNWAY, WORLD_HALF } from './config.js';

const DEG = Math.PI / 180;

export function headingToForward(headingDeg, pitchDeg) {
  const h = headingDeg * DEG;
  const p = pitchDeg * DEG;
  return {
    x: Math.sin(h) * Math.cos(p),
    y: Math.sin(p),
    z: -Math.cos(h) * Math.cos(p),
  };
}

export class FlightModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = RUNWAY.centreX;
    this.y = RUNWAY.surfaceY + 0.6;
    this.z = RUNWAY.centreZ + RUNWAY.length / 2 - 30;
    this.headingDeg = 0; // north, down the runway
    this.pitchDeg = 0;
    this.bankDeg = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = FLIGHT.fuelCapacity;
    this.damage = 0;
    this.gearDown = true;
    this.flaps = false;
    this.verticalSpeed = 0;
    this.onGround = true;
    this.airborne = false;
    this.landed = false;
    this.crashed = false;
    this.crashReason = '';
    this.stalled = false;
    this.overspeed = false;
    this.engineOut = false;
    this._takeoffGraceSec = 0;
    this._halfFuelWarned = false;
    this._lowFuelWarned = false;
    this._stallWarned = false;
  }

  // Place the plane mid-air for a staged scene (screenshots, or a mission
  // that starts in the air). headingDeg 0 = north.
  placeInAir(x, y, z, headingDeg, speed, throttle) {
    this.reset();
    this.x = x;
    this.y = y;
    this.z = z;
    this.headingDeg = headingDeg;
    this.speed = speed;
    this.throttle = throttle;
    this.onGround = false;
    this.airborne = true;
    this.gearDown = false;
  }

  // input: { pitch, roll, yaw, throttleDelta, brake } each -1..1, plus
  // toggles handled by the caller (gear/flaps). Returns event objects.
  step(dt, input, heightAt) {
    const events = [];
    if (this.crashed || this.landed) return events;

    // Throttle and fuel.
    if (!this.engineOut) {
      this.throttle = Math.max(0, Math.min(1, this.throttle + input.throttleDelta * dt));
    }
    const burn = FLIGHT.fuelBurnIdle + FLIGHT.fuelBurnFull * this.throttle;
    this.fuel = Math.max(0, this.fuel - burn * dt);
    if (this.fuel <= 0 && !this.engineOut) {
      this.engineOut = true;
      this.throttle = 0;
      events.push({ type: 'fuel-empty' });
    }
    if (!this._halfFuelWarned && this.fuel < 50) {
      this._halfFuelWarned = true;
      events.push({ type: 'half-fuel' });
    }
    if (!this._lowFuelWarned && this.fuel < 20) {
      this._lowFuelWarned = true;
      events.push({ type: 'low-fuel' });
    }

    // Speed: throttle pulls it up, drag and climbs pull it down.
    const targetSpeed = this.throttle * FLIGHT.maxSpeed * (this.flaps ? 0.82 : 1);
    this.speed += (targetSpeed - this.speed) * FLIGHT.accelRate * dt;
    if (this.pitchDeg > 0) this.speed -= Math.sin(this.pitchDeg * DEG) * 7 * dt;
    if (input.brake > 0) this.speed = Math.max(0, this.speed - 26 * input.brake * dt);
    this.speed = Math.max(0, this.speed);

    // Stall: below stall speed the wing quits, the nose drops, you sink.
    this.stalled = this.speed < FLIGHT.stallSpeed && !this.onGround;
    if (this.stalled && !this._stallWarned) {
      this._stallWarned = true;
      events.push({ type: 'stall' });
    }
    if (!this.stalled) this._stallWarned = false;

    // Bank and turn: the turn rate comes from the bank, not the stick.
    const airspeedFactor = Math.min(1, this.speed / FLIGHT.cruiseSpeed + 0.25);
    const targetBank = input.roll * FLIGHT.maxBankDeg;
    const bankRate = FLIGHT.rollRateDeg * airspeedFactor;
    this.bankDeg += Math.max(-bankRate * dt, Math.min(bankRate * dt, targetBank - this.bankDeg));
    // On the runway the wings stay near level: a 60-degree bank built up
    // while taxiing would sink the plane straight back down at rotation.
    if (this.onGround) this.bankDeg = Math.max(-10, Math.min(10, this.bankDeg));
    if (this.speed > 4 && !this.onGround) {
      const turnRate =
        (9.81 * Math.tan(this.bankDeg * DEG) * FLIGHT.turnAuthority) / Math.max(this.speed, 12);
      this.headingDeg = (this.headingDeg + (turnRate / DEG) * dt + 360) % 360;
    }
    // Rudder nudges the nose without banking.
    this.headingDeg = (this.headingDeg + input.yaw * 14 * airspeedFactor * dt + 360) % 360;

    // Pitch: stick authority grows with airspeed; stall drops the nose.
    const pitchRate = FLIGHT.pitchRateDeg * airspeedFactor * (this.flaps ? 0.8 : 1);
    this.pitchDeg += input.pitch * pitchRate * dt;
    if (this.stalled) this.pitchDeg -= 14 * dt;
    this.pitchDeg = Math.max(-28, Math.min(32, this.pitchDeg));
    // On the runway the stick only rotates the nose a little: no 30-degree
    // pitch built up before the wheels even leave the ground.
    if (this.onGround) this.pitchDeg = Math.max(-2, Math.min(10, this.pitchDeg));
    // Hands off the stick: the plane eases back toward level flight, so
    // releasing the keys levels out instead of holding a climb forever.
    if (!this.stalled) {
      if (input.pitch === 0 && !this.onGround) {
        const levelRate = 10 * dt;
        this.pitchDeg += Math.max(-levelRate, Math.min(levelRate, -this.pitchDeg));
      }
      if (input.roll === 0) {
        const rollLevel = 25 * dt;
        this.bankDeg += Math.max(-rollLevel, Math.min(rollLevel, -this.bankDeg));
      }
    }

    // Vertical speed: climb from pitch and speed. At cruise the wing holds
    // altitude at pitch 0; only below stall speed does the plane sink on
    // its own, and banked turns bleed lift.
    const climb = this.speed * Math.sin(this.pitchDeg * DEG);
    const bankSink = Math.abs(Math.tan(this.bankDeg * DEG)) * this.speed * 0.12;
    const stallSink = this.stalled ? 9 : 0;
    const slowSink = Math.max(0, FLIGHT.stallSpeed - this.speed) * 0.12;
    this.verticalSpeed = climb - slowSink - bankSink - stallSink;

    // Move.
    const fwd = headingToForward(this.headingDeg, this.pitchDeg);
    if (this.onGround) {
      // Rolling: steer gently with the bank input, lift off when fast
      // enough and the stick is back.
      this.headingDeg = (this.headingDeg + input.roll * 10 * dt + 360) % 360;
      this.x += Math.sin(this.headingDeg * DEG) * this.speed * dt;
      this.z += -Math.cos(this.headingDeg * DEG) * this.speed * dt;
      this.y = heightAt(this.x, this.z) + 0.6;
      this.verticalSpeed = 0;
      if (this.speed > FLIGHT.stallSpeed + 4 && this.pitchDeg > 4) {
        this.onGround = false;
        this.airborne = true;
        this._takeoffGraceSec = 0.5;
        events.push({ type: 'takeoff' });
      }
    } else {
      this.x += fwd.x * this.speed * dt;
      this.y += this.verticalSpeed * dt;
      this.z += fwd.z * this.speed * dt;
    }

    // Valley walls: a soft push back, not a wall you can clip through.
    const edge = WORLD_HALF - 24;
    if (Math.abs(this.x) > edge || Math.abs(this.z) > edge) {
      this.x = Math.max(-edge, Math.min(edge, this.x));
      this.z = Math.max(-edge, Math.min(edge, this.z));
      events.push({ type: 'valley-edge' });
    }

    // Overspeed shakes the airframe apart.
    this.overspeed = this.speed > FLIGHT.damageOverspeed;
    if (this.overspeed) {
      this.damage += 2.5 * dt;
      if (this.damage >= 100) {
        this.damage = 100;
        this.crashed = true;
        this.crashReason = 'Airframe failure in an overspeed dive';
        events.push({ type: 'crashed', reason: this.crashReason });
        return events;
      }
    }

    // Ground contact: only when actually descending onto it, and never in
    // the half second after lift-off — a steep bank at rotation can sink
    // the plane a touch, and that is a climb-out, not a landing.
    if (!this.onGround) this._takeoffGraceSec = Math.max(0, this._takeoffGraceSec - dt);
    const groundY = heightAt(this.x, this.z);
    const alt = this.y - groundY;
    if (!this.onGround && alt <= 0.6 && this.verticalSpeed < 0 && this._takeoffGraceSec <= 0) {
      const onRunway =
        Math.abs(this.x - RUNWAY.centreX) < RUNWAY.width / 2 + 2 &&
        Math.abs(this.z - RUNWAY.centreZ) < RUNWAY.length / 2;
      const sink = -this.verticalSpeed;
      if (onRunway && sink <= FLIGHT.landingMaxSink && this.speed <= FLIGHT.landingMaxSpeed + 18) {
        // Touchdown on the strip.
        this.y = groundY + 0.6;
        this.onGround = true;
        this.landed = true;
        const lateral = Math.abs(this.x - RUNWAY.centreX);
        let quality = 'rough';
        if (sink < 1.5 && lateral < 4) quality = 'perfect';
        else if (sink < 3 && lateral < 8) quality = 'good';
        if (!this.gearDown) {
          this.damage = Math.min(100, this.damage + 30);
          quality = 'rough';
        }
        events.push({ type: 'landed', quality, sink, lateral, speed: this.speed });
      } else if (!onRunway && this.speed < 12 && sink < 2.5) {
        // A gentle forced landing in a field: survivable, sortie over.
        this.y = groundY + 0.6;
        this.onGround = true;
        this.damage = Math.min(100, this.damage + 25);
        this.landed = true;
        events.push({ type: 'landed', quality: 'field', sink, lateral: 999, speed: this.speed });
      } else {
        this.crashed = true;
        this.crashReason = onRunway
          ? `Too fast / too hard on the runway (${Math.round(this.speed)} m/s, sink ${sink.toFixed(1)} m/s)`
          : 'Terrain impact';
        events.push({ type: 'crashed', reason: this.crashReason });
      }
    }
    return events;
  }
}

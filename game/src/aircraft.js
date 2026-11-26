// Ridge Runner — the Kestrel K-2 "Pipit", built from primitives so it reads
// as a built aircraft, not a box: tapered fuselage, wing, tail, spinning
// propeller, gear that folds, nav lights and a glass canopy.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function buildAircraft() {
  const group = new THREE.Group();
  const orange = new THREE.MeshLambertMaterial({ color: PALETTE.paintOrange });
  const cream = new THREE.MeshLambertMaterial({ color: PALETTE.paintCream });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c3138 });
  const glass = new THREE.MeshLambertMaterial({
    color: 0x1d3a4a,
    emissive: 0x0a2028,
  });
  const metal = new THREE.MeshLambertMaterial({ color: 0x9aa4ac });

  // Fuselage: a tapered cylinder along Z, nose forward (-Z).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 5.4, 12), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 12), orange);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.2;
  nose.castShadow = true;
  group.add(nose);
  // Engine cowling ring.
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.58, 0.7, 12), orange);
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = -2.6;
  group.add(cowl);

  // Canopy: a squashed glass dome over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), glass);
  canopy.scale.set(0.85, 0.62, 1.7);
  canopy.position.set(0, 0.62, -0.7);
  group.add(canopy);
  // Instrument glare shield, just visible through the glass line.
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.3), dark);
  dash.position.set(0, 0.42, -1.55);
  group.add(dash);

  // Main wing: low wing, slight dihedral, orange with cream tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.16, 1.7), orange);
  wing.position.set(0, -0.15, -0.3);
  wing.rotation.z = 0; // dihedral faked by the tip panels below
  wing.castShadow = true;
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 1.55), cream);
    tip.position.set(side * 4.6, -0.05, -0.3);
    tip.rotation.z = side * -0.08;
    group.add(tip);
    const navLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff2a2a : 0x2aff5a }),
    );
    navLight.position.set(side * 5.05, -0.05, -0.3);
    group.add(navLight);
  }
  // Tail: horizontal stabiliser + vertical fin, orange with cream rudder.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.0), orange);
  stab.position.set(0, 0.12, 2.5);
  stab.castShadow = true;
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 1.3), orange);
  fin.position.set(0, 0.75, 2.5);
  fin.castShadow = true;
  group.add(fin);
  const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.6), cream);
  rudder.position.set(0, 0.7, 3.05);
  group.add(rudder);

  // Propeller: two blades on a spinner, spins with throttle.
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 12), metal);
  spinner.rotation.x = -Math.PI / 2;
  prop.add(spinner);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.08), dark);
    blade.rotation.z = a;
    blade.position.z = -0.15;
    prop.add(blade);
  }
  prop.position.z = -3.85;
  group.add(prop);

  // Landing gear: two mains + tail wheel, fold away on command.
  const gear = new THREE.Group();
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8), metal);
    leg.position.set(side * 0.75, -0.85, -0.5);
    leg.rotation.z = side * 0.25;
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.95, -1.3, -0.5);
    wheel.castShadow = true;
    gear.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.75, 2.5);
  gear.add(tailWheel);
  group.add(gear);

  // Registration on the fin, drawn on a tiny canvas so the plane has a name.
  const regCanvas = document.createElement('canvas');
  regCanvas.width = 128;
  regCanvas.height = 64;
  const rctx = regCanvas.getContext('2d');
  rctx.fillStyle = '#e86a2a';
  rctx.fillRect(0, 0, 128, 64);
  rctx.fillStyle = '#f2e6c8';
  rctx.font = 'bold 34px Arial, sans-serif';
  rctx.textAlign = 'center';
  rctx.fillText('K2', 64, 44);
  const regTex = new THREE.CanvasTexture(regCanvas);
  regTex.colorSpace = THREE.SRGBColorSpace;
  const reg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.55),
    new THREE.MeshLambertMaterial({ map: regTex }),
  );
  reg.position.set(0.08, 0.75, 2.5);
  reg.rotation.y = Math.PI / 2;
  group.add(reg);

  return { group, prop, gear };
}

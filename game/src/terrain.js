// Ridge Runner — the valley: heightfield terrain, river, runway, airfield
// buildings, trees, clouds and sky. One height function drives both the mesh
// and the flight model, so the ground the plane sees is the ground it hits.
import * as THREE from 'three';
import { fbm2D, mulberry32 } from './noise.js';
import { PALETTE, RUNWAY, SEA_LEVEL, WORLD_HALF, WORLD_SIZE } from './config.js';

const NOISE_SEED = 7;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

// The river meanders down the valley along Z.
export function riverCentreX(z) {
  return 180 * Math.sin(z * 0.0016 + 0.7) + 60 * Math.sin(z * 0.0041);
}

// Analytic ground height. Keep this cheap: the mesh and the flight model
// both call it, and the minimap samples it hundreds of times.
export function terrainHeightAt(x, z) {
  const edge = Math.max(Math.abs(x), Math.abs(z)) / WORLD_HALF;
  const ridge = smoothstep(0.55, 1.0, edge) * 115;
  const hills =
    fbm2D(x * 0.004, z * 0.004, NOISE_SEED, 4) * 26 +
    fbm2D(x * 0.0012, z * 0.0012, NOISE_SEED + 7, 3) * 30;
  const dRiver = Math.abs(x - riverCentreX(z));
  const valley = -24 * Math.exp(-((dRiver / 170) * (dRiver / 170)));
  let h = 6 + hills + ridge + valley;
  // Flatten the airfield apron around the runway.
  const dx = Math.abs(x - RUNWAY.centreX);
  const dz = Math.abs(z - RUNWAY.centreZ);
  const flat = smoothstep(90, 45, dx) * smoothstep(300, 240, dz);
  h = h * (1 - flat) + RUNWAY.surfaceY * flat;
  return Math.max(h, 1.2);
}

function skyGradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#4f83c8');
  grad.addColorStop(0.45, '#7fb0dd');
  grad.addColorStop(0.72, '#e8c9a0');
  grad.addColorStop(1.0, '#f2c98a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function runwayMarkingsTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3d42';
  ctx.fillRect(0, 0, 128, 1024);
  ctx.fillStyle = '#e8e8e8';
  // Threshold bars at both ends.
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(14 + i * 28, 18, 16, 46);
    ctx.fillRect(14 + i * 28, 960, 16, 46);
  }
  // Centreline dashes.
  for (let y = 90; y < 950; y += 64) ctx.fillRect(60, y, 8, 36);
  // Runway numbers, drawn big so they read from the air.
  ctx.fillStyle = '#f4f4f4';
  ctx.font = 'bold 92px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(64, 170);
  ctx.fillText('36', 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(64, 900);
  ctx.rotate(Math.PI);
  ctx.fillText('18', 0, 0);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildTerrain(scene) {
  const rng = mulberry32(20261126);

  // Sky + light + fog: one warm late-afternoon look across the whole scene.
  scene.background = skyGradientTexture();
  scene.fog = new THREE.Fog(PALETTE.fog, 500, 2200);
  const hemi = new THREE.HemisphereLight(0xbfd8f2, 0x8a7a5a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.9);
  sun.position.set(-600, 420, -350);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 1800;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // Sun disc low in the west so the light has a source you can see.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }),
  );
  sunDisc.position.set(-1500, 320, -900);
  sunDisc.lookAt(0, 60, 0);
  scene.add(sunDisc);

  // Ground: 160 x 160 heightfield, vertex-coloured by height and slope.
  const segments = 160;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(PALETTE.grass);
  const dry = new THREE.Color(PALETTE.dryGrass);
  const rock = new THREE.Color(PALETTE.rock);
  const snow = new THREE.Color(PALETTE.snow);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeightAt(x, z);
    pos.setY(i, h);
    const slope =
      Math.abs(terrainHeightAt(x + 6, z) - h) + Math.abs(terrainHeightAt(x, z + 6) - h);
    if (h > 95) tmp.copy(snow);
    else if (slope > 5.5 || h > 78) tmp.copy(rock);
    else if (h > 34) tmp.copy(dry).lerp(grass, clamp01((52 - h) / 18));
    else tmp.copy(grass);
    // Sandy banks along the river.
    const dRiver = Math.abs(x - riverCentreX(z));
    if (dRiver < 26 && h < 6) tmp.lerp(new THREE.Color(0xcbb98a), 0.55);
    colours[i * 3] = tmp.r;
    colours[i * 3 + 1] = tmp.g;
    colours[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  // River: a ribbon following the meander, just above the water line.
  const riverPts = [];
  for (let z = -WORLD_HALF; z <= WORLD_HALF; z += 40) {
    riverPts.push(new THREE.Vector3(riverCentreX(z), SEA_LEVEL + 0.4, z));
  }
  const riverCurve = new THREE.CatmullRomCurve3(riverPts);
  const riverGeo = new THREE.PlaneGeometry(34, 1, 1, 120);
  const rPos = riverGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const t = (rPos.getY(i) + 0.5) * (riverPts.length - 1);
    const p = riverCurve.getPoint(clamp01(t));
    const tangent = riverCurve.getTangent(clamp01(t));
    const nx = -tangent.z;
    const nz = tangent.x;
    rPos.setXYZ(i, p.x + rPos.getX(i) * nx, p.y, p.z + rPos.getX(i) * nz);
  }
  riverGeo.computeVertexNormals();
  const river = new THREE.Mesh(
    riverGeo,
    new THREE.MeshLambertMaterial({
      color: PALETTE.water,
      transparent: true,
      opacity: 0.92,
    }),
  );
  river.receiveShadow = true;
  scene.add(river);

  // Runway: asphalt slab with painted markings, plus edge lights.
  const runway = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.width, 0.4, RUNWAY.length),
    new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
  );
  slab.position.set(RUNWAY.centreX, RUNWAY.surfaceY - 0.1, RUNWAY.centreZ);
  slab.receiveShadow = true;
  runway.add(slab);
  const paint = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.width - 1, RUNWAY.length - 2),
    new THREE.MeshLambertMaterial({ map: runwayMarkingsTexture() }),
  );
  paint.rotation.x = -Math.PI / 2;
  paint.position.set(RUNWAY.centreX, RUNWAY.surfaceY + 0.12, RUNWAY.centreZ);
  paint.receiveShadow = true;
  runway.add(paint);
  const edgeLightGeo = new THREE.SphereGeometry(0.45, 8, 8);
  const edgeLightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let side = -1; side <= 1; side += 2) {
    for (let z = RUNWAY.centreZ - RUNWAY.length / 2; z <= RUNWAY.centreZ + RUNWAY.length / 2; z += 42) {
      const lamp = new THREE.Mesh(edgeLightGeo, edgeLightMat);
      lamp.position.set(RUNWAY.centreX + side * (RUNWAY.width / 2 + 1.5), RUNWAY.surfaceY + 0.5, z);
      runway.add(lamp);
    }
  }
  scene.add(runway);

  // Airfield buildings: two hangars and a windsock by the threshold.
  const hangarMat = new THREE.MeshLambertMaterial({ color: 0xcfd6da });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x7a8894 });
  for (const hx of [-48, -48]) {
    const hz = hx === -48 ? 180 : 260;
    const hangar = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 20), hangarMat);
    walls.position.y = 4.5;
    walls.castShadow = true;
    hangar.add(walls);
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 26, 16, 1, false, 0, Math.PI),
      roofMat,
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 9;
    roof.castShadow = true;
    hangar.add(roof);
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 7),
      new THREE.MeshLambertMaterial({ color: 0x4a5560 }),
    );
    door.position.set(13.1, 3.5, 0);
    door.rotation.y = Math.PI / 2;
    hangar.add(door);
    hangar.position.set(hx, RUNWAY.surfaceY, hz);
    scene.add(hangar);
  }
  const windsock = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 9, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  pole.position.y = 4.5;
  windsock.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.2, 10, 1, true),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(2.2, 8.6, 0);
  windsock.add(sock);
  windsock.position.set(26, RUNWAY.surfaceY, RUNWAY.centreZ - RUNWAY.length / 2 + 24);
  scene.add(windsock);

  // Trees: instanced pines on the low slopes, kept off the runway and river.
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 340 && guard++ < 6000) {
    const x = (rng() * 2 - 1) * (WORLD_HALF - 60);
    const z = (rng() * 2 - 1) * (WORLD_HALF - 60);
    const h = terrainHeightAt(x, z);
    if (h < 4 || h > 58) continue;
    if (Math.abs(x - RUNWAY.centreX) < 95 && Math.abs(z - RUNWAY.centreZ) < 320) continue;
    if (Math.abs(x - riverCentreX(z)) < 26) continue;
    treeSpots.push([x, h, z, 0.8 + rng() * 0.9]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.4, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const pineGeo = new THREE.ConeGeometry(3.2, 11, 8);
  const pineMat = new THREE.MeshLambertMaterial({ color: 0x2f6b2f });
  const pineMesh = new THREE.InstancedMesh(pineGeo, pineMat, treeSpots.length);
  const dummy = new THREE.Object3D();
  treeSpots.forEach(([x, h, z, s], i) => {
    dummy.position.set(x, h + 1.6 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = rng() * Math.PI * 2;
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, h + (3.4 + 4.6) * s, z);
    dummy.updateMatrix();
    pineMesh.setMatrixAt(i, dummy.matrix);
  });
  trunkMesh.castShadow = true;
  pineMesh.castShadow = true;
  scene.add(trunkMesh);
  scene.add(pineMesh);

  // Boulders on the high ridges.
  const rockGeo = new THREE.DodecahedronGeometry(3.2, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x7d7468 });
  const boulders = new THREE.InstancedMesh(rockGeo, rockMat, 90);
  for (let i = 0; i < 90; i++) {
    const x = (rng() * 2 - 1) * (WORLD_HALF - 40);
    const z = (rng() * 2 - 1) * (WORLD_HALF - 40);
    const h = terrainHeightAt(x, z);
    dummy.position.set(x, h + 0.6, z);
    dummy.scale.set(0.7 + rng() * 1.6, 0.5 + rng() * 0.9, 0.7 + rng() * 1.6);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    dummy.updateMatrix();
    boulders.setMatrixAt(i, dummy.matrix);
  }
  boulders.castShadow = true;
  scene.add(boulders);

  // Clouds: flattened puffs drifting slowly east.
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rng() * 12, 10, 8), cloudMat);
      s.position.set((rng() - 0.5) * 42, (rng() - 0.5) * 5, (rng() - 0.5) * 18);
      s.scale.y = 0.45;
      cloud.add(s);
    }
    cloud.position.set(
      (rng() * 2 - 1) * (WORLD_HALF - 100),
      175 + rng() * 90,
      (rng() * 2 - 1) * (WORLD_HALF - 100),
    );
    scene.add(cloud);
    clouds.push(cloud);
  }

  return {
    heightAt: terrainHeightAt,
    riverCentreX,
    sun,
    windsock,
    clouds,
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x += dt * 1.6;
        if (cloud.position.x > WORLD_HALF) cloud.position.x = -WORLD_HALF;
      }
      windsock.rotation.y = Math.sin(performance.now() * 0.0002) * 0.2 + 0.4;
    },
  };
}

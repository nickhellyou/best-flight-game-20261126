// Ridge Runner — staged screenshot scenes. ?shot=<name> puts the game into a
// fixed, photogenic state so a screenshot is a real render of the game's own
// code, not a composite: the same flight model, terrain and HUD, just flown
// to a chosen spot first. ?seed=<n> picks the terrain seed (default 7).
export const SHOT_SCENES = {
  // Cover: mid-flight, banking through ring 3, river valley in view.
  cover: {
    mission: 'ring-run',
    place: { x: 110, y: 90, z: -640, heading: 355, speed: 62, throttle: 0.72 },
    bank: -18,
    pitch: 1,
    vsi: 2,
    matchRingAlt: true,
    ringsPassed: 2,
    banner: 'RING 3 OF 6',
  },
  // On the runway, throttled up for takeoff, instruments lit.
  takeoff: {
    mission: 'ring-run',
    place: null, // starts on the runway, the natural spawn
    throttle: 0.85,
    banner: 'CLEARED FOR TAKEOFF — RWY 36',
  },
  // Threading a ring at close range, the next ring glowing ahead.
  rings: {
    mission: 'ring-run',
    place: { x: 168, y: 85, z: -40, heading: 358, speed: 58, throttle: 0.66 },
    bank: 14,
    pitch: 1,
    vsi: 2,
    matchRingAlt: true,
    ringsPassed: 0,
    banner: 'RING 1 OF 6 — FLY THROUGH',
  },
  // Final approach: gear down, flaps out, runway 36 filling the view.
  landing: {
    mission: 'bush-landing',
    place: { x: 14, y: 55, z: 760, heading: 0, speed: 46, throttle: 0.35 },
    bank: 0,
    pitch: -2,
    vsi: -2.5,
    gearDown: true,
    flaps: true,
    banner: 'FINAL — RWY 36 — GEAR DOWN',
  },
};

export function parseShotQuery(search) {
  const params = new URLSearchParams(search);
  return {
    shot: params.get('shot'),
    seed: Number(params.get('seed') ?? 7) || 7,
  };
}

// Apply a staged scene to a live game object (see main.js). Returns true
// when a scene was applied.
export function applyShotScene(game, sceneName) {
  const scene = SHOT_SCENES[sceneName];
  if (!scene) return false;
  game.selectMission(scene.mission, { silent: true });
  if (scene.ringsPassed) {
    for (let i = 0; i < scene.ringsPassed && i < game.mission.rings.length; i++) {
      game.mission.rings[i].passed = true;
      game.mission.ringsPassed++;
      game.mission.nextRingIndex++;
      game.mission.score += 150;
    }
    game.refreshMissionMeshes();
  }
  if (scene.place) {
    // Level with the next ring, so the ring sits dead ahead of the nose
    // instead of far below it.
    let placeY = scene.place.y;
    if (scene.matchRingAlt) {
      const target = game.mission.nextTarget();
      if (target) placeY = target.y;
    }
    game.flight.placeInAir(
      scene.place.x,
      placeY,
      scene.place.z,
      scene.place.heading,
      scene.place.speed,
      scene.place.throttle,
    );
    game.flight.bankDeg = scene.bank ?? 0;
    game.flight.pitchDeg = scene.pitch ?? 0;
    game.flight.verticalSpeed = scene.vsi ?? 0;
    if (scene.gearDown !== undefined) game.flight.gearDown = scene.gearDown;
    if (scene.flaps !== undefined) game.flight.flaps = scene.flaps;
    // Airborne scenes hold their staged pose: the sim would fly the plane
    // away from the composed shot in seconds. The runway scene keeps
    // rolling — it is already on the ground and going nowhere fast.
    game._shotFrozen = true;
  } else {
    game.flight.throttle = scene.throttle ?? 0.5;
  }
  game.state = 'flying';
  game.hud.hideOverlay();
  if (scene.banner) game.hud.banner(scene.banner, 60000);
  game.hud.radio('KESTREL TOWER', 'Kestrel 2, you are looking good out there.');
  game._shotScene = scene;
  return true;
}

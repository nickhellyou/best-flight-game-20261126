// Ridge Runner — configuration: one place for every number the game tunes.
// Units are metres, seconds and degrees unless a name says otherwise.
export const GAME_NAME = 'Ridge Runner';
export const GAME_TAGLINE = 'Valley flying from Kestrel Field';
export const AIRFIELD_NAME = 'Kestrel Field';
export const CALLSIGN = 'Kestrel 2';

// World: a 2400 x 2400 m valley. North is -Z, east is +X, heading 0 is north.
export const WORLD_SIZE = 2400;
export const WORLD_HALF = WORLD_SIZE / 2;
export const SEA_LEVEL = 2.0;

// The runway: a 420 m strip along Z, centred on the valley floor.
export const RUNWAY = {
  centreX: 0,
  centreZ: 300,
  length: 420,
  width: 20,
  headingDeg: 0, // runway 36/18
  surfaceY: 3.0,
  name: 'RWY 36',
};

// Flight model.
export const FLIGHT = {
  maxSpeed: 95, // m/s, full throttle level
  cruiseSpeed: 62,
  stallSpeed: 30, // below this the wing quits and the nose drops
  maxClimbRate: 22,
  accelRate: 0.35, // 1/s towards throttle speed
  pitchRateDeg: 26, // deg/s at full stick, scaled by airspeed
  rollRateDeg: 95,
  maxBankDeg: 60,
  turnAuthority: 1.5, // arcade help: turns bite a little harder than physics
  fuelCapacity: 100,
  fuelBurnIdle: 0.05, // per second
  fuelBurnFull: 0.20, // per second at full throttle (added to idle)
  gearSpeedLimit: 55, // above this, gear damage on touchdown
  landingMaxSink: 4.5, // m/s
  landingMaxSpeed: 52,
  crashSink: 6.0,
  damageOverspeed: 105, // m/s: airframe stress above this
};

// Scoring.
export const SCORE = {
  ring: 150,
  checkpoint: 100,
  landingPerfect: 500, // touchdown sink < 1.5 m/s and |centreline| < 4 m
  landingGood: 300,
  landingRough: 120,
  timeBonusPerSecond: 2, // left on the mission clock at completion
};

// Missions. Ring / checkpoint waypoints are placed by missions.js from the
// terrain, so the numbers here are the shape of each sortie, not coordinates.
export const MISSIONS = [
  {
    id: 'ring-run',
    index: 0,
    name: 'Ring Run',
    short: 'RING RUN',
    goal: 'Fly through all 6 rings in order',
    detail:
      'Six rings hang over the valley. Thread them in order — smooth turns and steady throttle beat raw speed. A ring turns green once flown.',
    rings: 6,
    timeLimitSec: 300,
  },
  {
    id: 'canyon-courier',
    index: 1,
    name: 'Canyon Courier',
    short: 'COURIER',
    goal: 'Collect 8 beacons along the river',
    detail:
      'Eight beacons mark the river canyon. Drop low, stay over the water and collect them all. Watch the ridges — the canyon walls are unforgiving.',
    checkpoints: 8,
    timeLimitSec: 300,
  },
  {
    id: 'bush-landing',
    index: 2,
    name: 'Bush Landing',
    short: 'LANDING',
    goal: 'Land on runway 36 at Kestrel Field',
    detail:
      'Take off from runway 36, fly one circuit of the valley, then bring her home: gear down, flaps out, gentle descent, touchdown inside the markers. A greaser pays up to 500.',
    timeLimitSec: 360,
  },
];

// Radio chatter lines, in mission order. The tower talks like a person who
// has watched a hundred student pilots bounce down this runway.
export const RADIO = {
  tower: 'KESTREL TOWER',
  lines: {
    ringStart: [
      'Kestrel 2, Kestrel Tower. Ring run is yours, six rings, in order.',
      'Wind calm, valley clear. Fly smooth, not fast.',
    ],
    courierStart: [
      'Kestrel 2, eight beacons down the river canyon.',
      'Stay low, stay over the water. Mind the walls.',
    ],
    landingStart: [
      'Kestrel 2, cleared for one circuit, then runway 36.',
      'Gear down on final, flaps out, and mind the sink rate.',
    ],
    ringPass: [
      'Ring down. Nice flying.',
      'Through it clean. Next ring is on your nose.',
      'Good. Keep that throttle steady.',
    ],
    checkpointPass: ['Beacon collected.', 'Beacon down. On to the next.'],
    halfFuel: ['Kestrel 2, check your fuel. Half tanks.'],
    lowFuel: ['Kestrel 2, fuel low. Bring her home soon.'],
    stall: ['Careful — you are slow. Nose down, power up.'],
    overspeed: ['You are over the red line. Ease off.'],
    landed: ['Kestrel 2, welcome home. Shutdown when ready.'],
    crashed: ['Kestrel 2... Kestrel 2, do you read?'],
  },
};

// Colours: one warm late-afternoon palette for terrain, sky and the plane.
export const PALETTE = {
  skyTop: 0x5f8fd0,
  skyHorizon: 0xf2c98a,
  fog: 0xe8c9a0,
  sun: 0xffe2b0,
  grass: 0x6da24a,
  dryGrass: 0xb5a05a,
  rock: 0x8a7a68,
  snow: 0xe8eef2,
  water: 0x3f7fbf,
  asphalt: 0x3a3d42,
  paintOrange: 0xe86a2a,
  paintCream: 0xf2e6c8,
  ringNext: 0xff8c1a,
  ringDone: 0x37d67a,
  beacon: 0x35c4ff,
};

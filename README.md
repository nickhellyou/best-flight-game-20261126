# best-flight-game-20261126

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/nickhellyou/best-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/nickhellyou/best-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Ridge Runner: a 3D valley flight game. Fly the Kestrel K-2 "Pipit" out of Kestrel Field over a river valley — thread six glowing rings, run beacons down the canyon, or fly one circuit and grease a landing on runway 36. Throttle and turn discipline, fuel and damage that turn a sortie into decisions, and a tower that talks back. Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network request: every file the game loads is under `game/`, three.js included.

## Play

- Arrows / WASD — pitch and bank (mouse steers too)
- Shift / Ctrl — throttle up / down
- Q / E — rudder
- G — landing gear, F — flaps, Space — brake
- 1 / 2 / 3 — pick a mission, Enter — fly, P — pause, M — sound, R — restart

## Missions

1. **Ring Run** — fly through 6 rings in order over the valley (5:00).
2. **Canyon Courier** — collect 8 beacons along the river canyon (5:00).
3. **Bush Landing** — one circuit, then land on runway 36; a gentle touchdown on the centreline pays up to 500 (6:00).

Fuel burns with throttle and damage grows with overspeed and hard arrivals. Stall below 30 m/s and the wing quits — nose down, power up.

---

<sub>Entered on [make.fun](https://make.fun/?ref=kenzura&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

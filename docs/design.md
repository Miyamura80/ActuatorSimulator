# ActuatorSimulator: Game Design

Living design doc. Decisions made during implementation are logged at the bottom
(Decision Log) so the reasoning survives across PRs.

## Pitch

A tick-based factory tycoon. You run a small plant that builds **robot joint
servo actuators** (BLDC motor + encoder + harmonic gearbox + driver PCB). Buy
parts from suppliers of varying quality, machine and assemble them, test them,
and ship them against customer contracts. Things go wrong constantly: bad lots,
late trucks, drifting machines, breakdowns, and defects that escape to the field
and come back as RMAs. Stay solvent, grow reputation, land bigger contracts.

## Pillars

1. **Semi-realistic manufacturing**: real concepts (yield, incoming inspection,
   sampling plans, SPC, lot genealogy, RMAs) with simplified math.
2. **Policy, not micromanagement**: the player sets knobs (suppliers, reorder
   points, sampling rates, maintenance intervals, shifts, WIP caps) and reacts
   to incidents. The line runs itself.
3. **Every failure is traceable**: every unit's defect came from somewhere (a
   supplier lot, a worn machine). Good play is finding and fixing root causes.
4. **Deterministic**: a seed plus a list of actions reproduces a game exactly.
   This powers the daily challenge, save files, and headless balance tests.

## Architecture

```
            crates/sim  (pure Rust: no async, no IO, seeded RNG, serde state)
            Game::new(seed, difficulty) / apply(Action) / step() / snapshot()
                     |                                   |
         crates/sim-wasm (C ABI, JSON)           crates/engine commands
                     |                            (sim_run, ...)
         frontend: Vite + React + r3f                     |
         game loop in the browser tab,          actsim CLI: headless runs,
         saves in IndexedDB,                    balance sweeps, CI checks
         Web Audio procedural SFX
```

The browser game needs no server. The HTTP API stays for development and
debugging only. Deployment is a static build served from Railway.

## Time

1 tick = 1 hour of game time. 24 ticks = 1 day. Shifts: 1 shift runs 08:00 to
16:00, 2 shifts run 08:00 to 24:00, 3 shifts run around the clock. The browser
plays at 1x / 2x / 4x / pause.

## Product and Bill of Materials

Purchased parts: magnet set, lamination stack, copper wire, bearing, encoder IC,
PCB blank, aluminum billet, steel blank.

```
AluBillet ----------[Mill]---------> Housing -------------------+
SteelBlank --------[GearCut]-------> GearSet -------------------+
Laminations + CopperWire --[Winding]--> Stator --+               +--[FinalAsm]--> Actuator --[EolTest]--> FinishedGood --> ship
Magnets + 2x Bearing ---------------------------+-[MotorAsm]--> Motor
PcbBlank + EncoderIc ------[Smt]---> DriverBoard ---------------+
```

## Quality Model

Material moves in **lots**. A lot carries a quantity and two hidden counts:

- `defects`: units that fail a functional test (detectable).
- `latent`: units that pass every test but fail in the field weeks later.

Supplier lots are seeded from the supplier's quality. Each built unit inherits a
defect when any consumed input unit was defective (sequential draw from the
input lots, FIFO) and can also pick up a process defect whose rate rises as the
machine's condition drops. Output lots close at the station's lot size, so each
lot records the set of input lots it consumed (genealogy for traceability).

Detection points:

- **Incoming inspection (IQC)**, per purchased part: none, sample, or 100%.
  A sample that finds more than the acceptance number rejects the lot (return to
  supplier, refund). 100% inspection sorts out the defects it finds (inspectors
  catch 95%) at a per-unit cost, so a few still slip through.
- **End-of-line test (EOL)**: 100% or sample. A failing unit is scrapped.
  Sampling saves test bench capacity at the risk of escapes.

Escapes reach the customer: detectable defects fail almost immediately (DOA),
latent ones fail days to weeks later. Each failure is an RMA: replacement cost
plus a reputation hit. A lot with repeated field failures can be recalled.

## Failure Systems

| System | Examples | Player levers |
|---|---|---|
| Supplier | late shipments, bad lots, price spikes, supplier bankruptcy | supplier choice, dual sourcing, IQC plan, safety stock |
| Process | machine drift (condition decay), tool breakage, operator error | maintenance interval, SPC watch, shifts |
| Equipment | random and wear-driven breakdowns with repair downtime | preventive maintenance, spare machines |
| Field | DOA and latent failures, RMAs, recalls | EOL plan, lot tracing, recall decisions |

## Economy

Cash starts by difficulty. Costs: parts, labor per machine operating hour,
daily overhead, machine purchases, maintenance, inspection labor, scrap, RMAs,
late penalties. Revenue arrives when units ship against a contract. The game is
lost when cash falls below the overdraft limit.

## Contracts

Offers appear on a board (qty, unit price, deadline, quality tier, penalty for
lateness). Reputation (0 to 100) scales offer size and price. Accepting is a
commitment; missing the deadline costs a daily penalty and reputation.

## Difficulty

Presets tune starting cash, overdraft limit, supplier defect rates, event
frequency, machine wear, and contract strictness: Easy / Normal / Hard.

## Milestones

| # | Milestone |
|---|---|
| M1 | Sim core: state, lots, suppliers, stations, contracts, economy, `actsim` headless runs |
| M2 | Failure systems (supplier events, breakdowns, RMAs) + difficulty balance tuning |
| M3 | WASM bridge + save/load |
| M4 | 3D factory floor (stylized industrial) |
| M5 | Game UI: HUD, contracts, policy knobs, incident cards, stats (SPC, Pareto, cash) |
| M6 | Tutorial, seeded daily challenge, procedural SFX, settings |
| M7 | Balance pass via CLI sweeps, polish, Railway deploy |

## Decision Log

- **Sim is a separate pure crate** (`crates/sim`), not engine commands. It must
  compile to `wasm32-unknown-unknown` without tokio/reqwest, and it must be
  synchronous and deterministic. The engine wraps it for CLI/HTTP.
- **Own RNG** (SplitMix64 seeding a xoshiro256**) instead of the `rand` crate:
  the generator state is serialized with the game, and the sequence has to be
  identical on every platform and in WASM.
- **Lots, not individual units**: tracking each unit would bloat saves. Lots
  keep genealogy and hidden defect counts, which is enough for tracing and
  recalls.
- **One station kind per recipe**: no changeover scheduling in M1. Machines
  can be bought per station to fix bottlenecks.
- **Expedite (air freight)** is an order option: lead time / 3, price x1.5,
  better on-time odds. Without it a rejected lot plus a late truck could starve
  the line for a week with no way to respond.
- **IQC acceptance number** is 4% of the sample (at least 1). A zero-defect
  acceptance rule rejected too many good Standard lots on small samples; bad
  lots (M2 supplier events) are what sampling is meant to catch.
- **Lots transfer after 2 hours or 20 units**, so WIP flows through the line in
  hours instead of a day per station.
- **Balance tool**: `actsim call sim_run --args '{"seeds":20,"days":90,"difficulty":"normal"}' --json`
  runs the autopilot (`sim::bot`) across seeds and reports survival, cash,
  scrap rate and escape ppm.

- **M2 failure systems** (all odds scale with difficulty):
  - Supplier events, rolled daily per supplier: silent bad lots (defect rate
    x10 to x25, at least 8%, found at IQC, on the line or in the field), price spikes
    (+25 to 60% for 1 to 3 weeks), bankruptcy after day 20 (budget shops far
    more often, never the last supplier of a part; prepaid open orders are lost and reorders move to the cheapest
    remaining supplier).
  - Equipment: breakdown hazard rises with wear (6 to 30 h repair, 6% of
    machine price). Preventive maintenance every 120 operating hours by default
    (3 h, 1.5% of price) restores condition and re-centers the process.
  - Process drift: a hidden mean shift (random walk plus tool breaks of 1.5 to 3
    sigma) multiplies process defects by exp(drift^2/2). Every 3 hours each
    busy station logs an x-bar point (n=5); a point beyond 3 sigma or 9 in a row
    on one side raises an SPC alarm. On the EOL bench, drift lowers test coverage instead.
  - Field: escaped detectable defects fail 1 to 4 days after shipping (DOA),
    latent ones 10 to 60 days after. Each RMA costs $420 (x2 premium) and 0.3
    rep (x2 premium). `Recall(lot)` traces genealogy forward, recalls shipped
    units ($140 each, -1.5 rep flat), cancels their pending failures and scraps
    remaining stock.

- **WASM bridge is a plain C ABI** (`crates/sim-wasm`): JSON strings through
  linear memory, read by one small TS class (`frontend/src/sim/wasm.ts`). No
  wasm-bindgen CLI to pin in CI or Docker. The module is 650 KB (170 KB gzipped) with the `wasm`
  build profile.
- **The UI sees a `View`, never the state**: `GameState::view` leaves out
  hidden defect counts, supplier quality numbers, drift, pending field
  failures and true arrival dates, so the UI never displays them. This is a
  display boundary, not a secret: saves hold the full state, and anyone who
  opens IndexedDB can read it. It is a single-player game, so that is fine.
- **Saves** are the full state JSON in IndexedDB, with an autosave slot written
  once per game day and when a run ends. Headers live in their own store so
  the load menu never reads the payloads. Loading refuses a `SAVE_VERSION`
  mismatch (checked before the full parse) and any save whose IDs don't
  resolve (`GameState::validate`).
- **Game speed**: 1x is 2 game hours per real second (a 90-day game is about
  18 minutes); 2x and 4x multiply it.

- **M5 UI**: the 3D floor stays the main view; everything else lives in a
  tabbed sidebar (Contracts, Supply, Quality, Stats, Log). Critical events pop
  as incident cards with a shortcut (trace the lot, inspect the station), and
  repeats of the same message collapse with a count. Lot tracing goes through
  `sim::trace::report`, which exposes genealogy and shipped units but never
  hidden defect counts.
- **Daily challenge**: the seed is an FNV-1a hash of the UTC date, Normal
  difficulty, 30 game days. Score = cash + $2,000 per reputation point (0 if
  bankrupt). Best score per date is kept in localStorage. Daily runs never
  autosave, so they cannot be resumed or overwrite the sandbox autosave.
- **Tutorial**: eight steps on a fixed Easy plant. Six wait for the player to
  do the thing they describe (select a station, accept a contract, open a tab,
  start time, first shipment); the welcome and closing steps click through.
- **Sound** is all Web Audio synthesis (chimes, alarms, clunks, a noise-based
  factory hum scaled by line activity). No audio assets. One sound per frame:
  the most severe event wins.

## Balance Notes (open for M7)

M1 baseline, autopilot, 20 seeds x 90 days:

| Difficulty | Survived | Mean cash | Scrap rate |
|---|---|---|---|
| Easy | 20/20 | 5.7M | 7.7% |
| Normal | 20/20 | 2.4M | 9.6% |
| Hard | 20/20 | 109k | 11.1% |

- Easy/Normal snowball once a few machines are bought; needs cost pressure
  (maintenance, breakdowns, RMAs from M2) and a softer contract size curve.

After M5 (default reorder policy 180/200, autopilot capex guard; autopilot, 90 days;
30 seeds for Normal/Hard, 20 for Easy):

| Difficulty | Survived | Mean cash | Scrap | Field failures | Breakdowns/run |
|---|---|---|---|---|---|
| Easy | 20/20 | 4.2M | 5.9% | 1.0% | 21 |
| Normal | 30/30 | 1.0M | 8.5% | 1.4% | 24 |
| Hard | 20/30 | 23k | 15.5% | 2.5% | 8 |

(After M5: default reorder policy 180/200, and the autopilot no longer buys
machines while any part is short.)

- Hard is brutal for the autopilot because it never changes suppliers or
  tightens IQC after a bad lot; a human reacting to events should do far
  better. Check once the UI exists.

- Field failure rate (about 1 to 1.4% of shipped units, 2.5% on Hard) is dominated by latent
  defects, which the EOL test cannot catch. Premium suppliers and PM are the
  levers; revisit the rate in M7 once a human has played it.
- Reputation reaches 100 around day 45 on Normal; too fast.
- Scrap is high because machines only wear in M1; maintenance arrives in M2.

# Actuator Works

<p align="center">
  <img src="media/banner.png" alt="banner" width="400">
</p>

<p align="center">
<b>A factory tycoon about building robot joint actuators, and everything that goes wrong along the way.</b>
</p>

<p align="center">
  <a href="#the-game">The Game</a> •
  <a href="#play-locally">Play Locally</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#development">Development</a> •
  <a href="#deploy">Deploy</a>
</p>

<p align="center">
  <img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/Miyamura80/ActuatorSimulator/rust_checks.yaml?branch=main">
</p>

---

## The Game

You run a small plant that builds servo actuators for robot joints: a BLDC
motor, an encoder, a harmonic gearbox and a driver board in one housing.

- **Buy parts** from suppliers with different prices, lead times and quality.
  Budget suppliers are cheap until a bad lot slips through.
- **Run the line**: seven stations (CNC mill, gear cutting, stator winding, SMT,
  motor assembly, final assembly, end-of-line test) in a live 3D factory.
- **Fight failures**: late trucks, bad lots, supplier bankruptcies, machine
  wear and breakdowns, drifting processes caught (or not) by SPC charts, and
  escaped defects that come back weeks later as field returns.
- **Trace and recall**: every unit's history is recorded by lot; trace a
  failure back to the supplier lot and recall what shipped.
- **Win contracts**, grow reputation, stay above the overdraft limit.

Modes: sandbox (Easy / Normal / Hard, any seed), a guided tutorial, and a
seeded **daily challenge** (same plant for everyone, 30 days, best score kept).

Controls: click stations or use the station strip, `Space` pause/resume,
`1` / `2` / `3` speed, `Esc` close panels.

## Play Locally

```bash
make dev      # builds the sim to WebAssembly, then opens Vite on http://localhost:1420
```

Needs Rust (stable, with the `wasm32-unknown-unknown` target, which `make wasm`
installs) and [Bun](https://bun.sh).

## Architecture

```
crates/sim        pure, deterministic Rust simulation (seeded RNG, serde state)
   │                GameState::new(seed, difficulty) / apply(Action) / step() / view()
   ├── crates/sim-wasm   C-ABI WebAssembly bridge (JSON in/out)
   │      └── frontend/  React + react-three-fiber game, runs the sim in the tab,
   │                      IndexedDB saves, Web Audio sound
   └── crates/engine     typed Command registry (sim_run, ...)
          └── crates/cli the `actsim` binary: headless runs, balance sweeps, HTTP API
```

The same seed plus the same actions always replays the same game, which is
what makes saves, the daily challenge and headless balance tests work. Game
design, decisions and balance notes live in [`docs/design.md`](docs/design.md).

## Development

```bash
cargo test --workspace                                      # Rust tests
make ci                                                     # everything CI runs
actsim call sim_run --args '{"seeds":20,"days":90}' --json  # autopilot balance sweep
make web                                                    # static build in frontend/dist
```

Commit conventions and agent guidance are in [`CLAUDE.md`](CLAUDE.md).

## Deploy

`Dockerfile.web` builds `sim.wasm` and the Vite bundle and serves them with
Caddy (compression, long-lived caching for hashed assets, `$PORT` aware).
`railway.toml` points Railway at it. The original `Dockerfile` still builds the
`actsim` HTTP API server.

## Asset Generation

- `make logo` / `make banner` regenerate branding assets via the Rust
  `asset-gen` CLI (requires `APP__GEMINI_API_KEY`, set via `.env`).
- Logos/icons land under `frontend/public/`, the banner under `media/banner.png`.

## Configuration

Configuration is handled in Rust and exposed to the frontend over HTTP.

- **Rust**: `app_config::get_config()` (full) / `app_config::get_frontend_config()` (sanitized).
- **Frontend**: `useConfig()` hook → `GET /api/v1/config` (never carries secrets).

### Environment Variables
Prefix variables with `APP__` to override YAML settings (e.g.,
`APP__MODEL_NAME=gpt-4`, `APP__SERVER__PORT=9090`). Point a deployed binary at
its config file with `APP_CONFIG_PATH`.

## Agent Skills

Claude Code skills live in `.claude/skills/`. Invoke them with `/skill-name`.

| Skill | Description |
|-------|-------------|
| `/update-backend` | Guide for Rust backend changes - engine commands, traits, CLI/API, testing |
| `/onboarding` | Turn this template into a real project (interview → dry-run → prune) |
| `/code-quality` | Run formatting and linting checks (Biome + Clippy) |
| `/prd` | Generate a Product Requirements Document for a new feature |
| `/ralph` | Convert a PRD to `prd.json` for the Ralph autonomous agent |
| `/cleanup` | Git branch hygiene - delete merged branches, prune stale refs, sync deps |

## Credits

This software uses the following tools:
- [axum](https://github.com/tokio-rs/axum)
- [Bun](https://bun.sh/)
- [Biome](https://biomejs.dev/)
- [Rust](https://www.rust-lang.org/)

## About the Core Contributors

<a href="https://github.com/Miyamura80/ActuatorSimulator/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Miyamura80/ActuatorSimulator" />
</a>

Made with [contrib.rocks](https://contrib.rocks).

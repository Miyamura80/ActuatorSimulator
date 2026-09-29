//! Deterministic actuator-factory simulation.
//!
//! Pure Rust with no IO or async so the same code runs natively (CLI, tests,
//! balance sweeps) and in the browser via WASM. A seed plus the ordered list of
//! applied actions reproduces a game exactly.
//!
//! ```
//! use sim::{Difficulty, GameState};
//! let mut game = GameState::new(42, Difficulty::Normal);
//! game.run_days(3);
//! assert_eq!(game.day(), 3);
//! ```

pub mod action;
mod apply;
pub mod bot;
pub mod catalog;
pub mod difficulty;
pub mod event;
pub mod model;
pub mod policy;
pub mod rng;
pub mod state;
pub mod systems;

pub use action::{Action, ActionError};
pub use catalog::{Item, StationKind};
pub use difficulty::Difficulty;
pub use event::{Event, EventKind, Severity};
pub use model::{GameStatus, Tick, TICKS_PER_DAY};
pub use state::GameState;

impl GameState {
    /// Advance one hour. No-op once the game is over.
    pub fn step(&mut self) {
        if self.is_over() {
            return;
        }
        systems::purchasing::tick(self);
        systems::production::tick(self);
        systems::contracts::tick(self);
        systems::economy::tick(self);
        self.tick += 1;
    }

    pub fn run_hours(&mut self, hours: u32) {
        for _ in 0..hours {
            if self.is_over() {
                break;
            }
            self.step();
        }
    }

    pub fn run_days(&mut self, days: u32) {
        for _ in 0..days {
            if self.is_over() {
                break;
            }
            self.run_hours(TICKS_PER_DAY);
        }
    }
}

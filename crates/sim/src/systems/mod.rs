//! Per-tick systems, run in a fixed order by [`crate::GameState::step`].

pub mod contracts;
pub mod economy;
pub mod field;
pub mod maintenance;
pub mod production;
pub mod purchasing;
pub mod supply_events;

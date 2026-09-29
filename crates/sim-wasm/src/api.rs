//! Safe, JSON-speaking wrapper around the one game this module holds.

use sim::state::SAVE_VERSION;
use sim::{Action, Difficulty, GameState};
use std::cell::RefCell;

thread_local! {
    static GAME: RefCell<Option<GameState>> = const { RefCell::new(None) };
}

fn with_game<T>(f: impl FnOnce(&mut GameState) -> T) -> Result<T, String> {
    GAME.with(|g| {
        g.borrow_mut()
            .as_mut()
            .map(f)
            .ok_or_else(|| "no game loaded".into())
    })
}

pub fn new_game(seed: u64, difficulty: u32) {
    let d = match difficulty {
        0 => Difficulty::Easy,
        2 => Difficulty::Hard,
        _ => Difficulty::Normal,
    };
    GAME.with(|g| *g.borrow_mut() = Some(GameState::new(seed, d)));
}

pub fn apply(json: &str) -> Result<(), String> {
    let action: Action = serde_json::from_str(json).map_err(|e| format!("bad action: {e}"))?;
    with_game(|g| g.apply(action).map_err(|e| e.to_string()))?
}

/// Advance up to `hours` ticks; returns the resulting tick (0 with no game).
pub fn step(hours: u32) -> u32 {
    with_game(|g| {
        g.run_hours(hours);
        g.tick
    })
    .unwrap_or(0)
}

pub fn view(since: u64) -> Result<String, String> {
    with_game(|g| serde_json::to_string(&g.view(since)).map_err(|e| e.to_string()))?
}

pub fn save() -> Result<String, String> {
    with_game(|g| serde_json::to_string(g).map_err(|e| e.to_string()))?
}

pub fn load(json: &str) -> Result<(), String> {
    // Check the version before the full parse, so a save from another build
    // gets a clear message instead of a serde "missing field" error.
    let value: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("bad save: {e}"))?;
    let version = value
        .get("version")
        .and_then(serde_json::Value::as_u64)
        .ok_or("bad save: no version")?;
    if version != u64::from(SAVE_VERSION) {
        return Err(format!(
            "save is version {version}, this build reads version {SAVE_VERSION}"
        ));
    }
    let state: GameState = serde_json::from_value(value).map_err(|e| format!("bad save: {e}"))?;
    state.validate().map_err(|e| format!("bad save: {e}"))?;
    GAME.with(|g| *g.borrow_mut() = Some(state));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_through_json_api() {
        new_game(7, 1);
        apply(r#"{"type":"set_shifts","shifts":2}"#).unwrap();
        assert!(apply(r#"{"type":"set_shifts","shifts":9}"#).is_err());
        assert!(apply("not json").is_err());
        assert_eq!(step(30), 30);
        let saved = save().unwrap();
        let view_before = view(0).unwrap();

        new_game(99, 2);
        load(&saved).unwrap();
        assert_eq!(view(0).unwrap(), view_before);
        let old = load(r#"{"version": 1}"#).unwrap_err();
        assert!(old.contains("version 1"), "{old}");
        assert!(load("{}").is_err());
        let dangling = saved.replacen(r#""open_lot":null"#, r#""open_lot":424242"#, 1);
        assert_ne!(dangling, saved);
        assert!(load(&dangling).unwrap_err().contains("missing lot"));
    }
}

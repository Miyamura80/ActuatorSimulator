//! WebAssembly bridge for the simulation.
//!
//! A deliberately small C ABI instead of wasm-bindgen: no extra CLI tooling to
//! pin in CI or Docker, and the whole protocol is JSON strings through linear
//! memory. The host (see `frontend/src/sim/wasm.ts`):
//!
//! 1. writes UTF-8 input into a buffer from `sim_alloc` and frees it with
//!    `sim_free` afterwards;
//! 2. calls an export; string results land in an output buffer read through
//!    `sim_out_ptr` / `sim_out_len` (valid until the next call).
//!
//! One game lives in the module at a time. The safe `api` functions hold the
//! logic so they can be unit-tested natively.

use std::cell::RefCell;

pub mod api;

thread_local! {
    static OUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

fn set_out(s: String) {
    OUT.with(|o| *o.borrow_mut() = s.into_bytes());
}

/// Read a UTF-8 string the host wrote into our memory.
///
/// # Safety
/// `ptr` must point to `len` readable bytes.
unsafe fn read_input(ptr: *const u8, len: usize) -> String {
    let bytes = std::slice::from_raw_parts(ptr, len);
    String::from_utf8_lossy(bytes).into_owned()
}

/// Map a result to a status code, storing the payload or error message.
fn finish(result: Result<String, String>) -> u32 {
    match result {
        Ok(s) => {
            set_out(s);
            0
        }
        Err(e) => {
            set_out(e);
            1
        }
    }
}

#[no_mangle]
pub extern "C" fn sim_alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len.max(1));
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

/// # Safety
/// `ptr` and `len` must come from a single earlier `sim_alloc(len)` call.
#[no_mangle]
pub unsafe extern "C" fn sim_free(ptr: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(ptr, 0, len.max(1)));
}

#[no_mangle]
pub extern "C" fn sim_out_ptr() -> *const u8 {
    OUT.with(|o| o.borrow().as_ptr())
}

#[no_mangle]
pub extern "C" fn sim_out_len() -> usize {
    OUT.with(|o| o.borrow().len())
}

/// Start a new game. `difficulty`: 0 easy, 1 normal, 2 hard.
#[no_mangle]
pub extern "C" fn sim_new(seed_hi: u32, seed_lo: u32, difficulty: u32) {
    let seed = (u64::from(seed_hi) << 32) | u64::from(seed_lo);
    api::new_game(seed, difficulty);
}

/// Apply one JSON-encoded `Action`. Returns 0 on success, 1 with the error
/// message in the output buffer otherwise.
///
/// # Safety
/// `ptr` must point to `len` readable bytes.
#[no_mangle]
pub unsafe extern "C" fn sim_apply(ptr: *const u8, len: usize) -> u32 {
    finish(api::apply(&read_input(ptr, len)).map(|()| String::new()))
}

/// Advance `hours` ticks. Returns the tick reached.
#[no_mangle]
pub extern "C" fn sim_step(hours: u32) -> u32 {
    api::step(hours)
}

/// Write the player view (events newer than `since`) to the output buffer.
#[no_mangle]
pub extern "C" fn sim_view(since_hi: u32, since_lo: u32) -> u32 {
    let since = (u64::from(since_hi) << 32) | u64::from(since_lo);
    finish(api::view(since))
}

/// Write the trace report for lot `lot` to the output buffer.
#[no_mangle]
pub extern "C" fn sim_trace(lot: u32) -> u32 {
    finish(api::trace(lot))
}

/// Write the full save (JSON) to the output buffer.
#[no_mangle]
pub extern "C" fn sim_save() -> u32 {
    finish(api::save())
}

/// Replace the current game with a JSON save.
///
/// # Safety
/// `ptr` must point to `len` readable bytes.
#[no_mangle]
pub unsafe extern "C" fn sim_load(ptr: *const u8, len: usize) -> u32 {
    finish(api::load(&read_input(ptr, len)).map(|()| String::new()))
}

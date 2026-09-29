//! Deterministic, serializable RNG (xoshiro256** seeded via SplitMix64).
//!
//! The generator state is part of the saved game, and the sequence must be
//! identical on every platform and in WASM, so we avoid the `rand` crate.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rng {
    s: [u64; 4],
}

fn splitmix64(x: &mut u64) -> u64 {
    *x = x.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = *x;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

impl Rng {
    pub fn new(seed: u64) -> Self {
        let mut x = seed;
        Self {
            s: [
                splitmix64(&mut x),
                splitmix64(&mut x),
                splitmix64(&mut x),
                splitmix64(&mut x),
            ],
        }
    }

    pub fn next_u64(&mut self) -> u64 {
        let result = self.s[1].wrapping_mul(5).rotate_left(7).wrapping_mul(9);
        let t = self.s[1] << 17;
        self.s[2] ^= self.s[0];
        self.s[3] ^= self.s[1];
        self.s[1] ^= self.s[2];
        self.s[0] ^= self.s[3];
        self.s[2] ^= t;
        self.s[3] = self.s[3].rotate_left(45);
        result
    }

    /// Uniform float in `[0, 1)`.
    pub fn f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 * (1.0 / (1u64 << 53) as f64)
    }

    /// True with probability `p` (clamped to `[0, 1]`).
    pub fn chance(&mut self, p: f64) -> bool {
        self.f64() < p.clamp(0.0, 1.0)
    }

    /// Uniform integer in `[lo, hi]` (inclusive). Returns `lo` if `hi < lo`.
    pub fn range(&mut self, lo: u32, hi: u32) -> u32 {
        if hi <= lo {
            return lo;
        }
        let span = (hi - lo) as u64 + 1;
        // Rejection sampling avoids modulo bias.
        let cutoff = u64::MAX - u64::MAX % span;
        loop {
            let draw = self.next_u64();
            if draw < cutoff {
                return lo + (draw % span) as u32;
            }
        }
    }

    /// Uniform float in `[lo, hi)`.
    pub fn range_f64(&mut self, lo: f64, hi: f64) -> f64 {
        lo + (hi - lo) * self.f64()
    }

    /// Approximately normal sample (Irwin-Hall with 12 uniforms).
    pub fn normal(&mut self, mean: f64, sd: f64) -> f64 {
        let s: f64 = (0..12).map(|_| self.f64()).sum();
        mean + (s - 6.0) * sd
    }

    /// Binomial(n, p). Exact for small `n`, normal approximation above.
    pub fn binomial(&mut self, n: u32, p: f64) -> u32 {
        let p = p.clamp(0.0, 1.0);
        if n == 0 || p == 0.0 {
            return 0;
        }
        if n <= 64 {
            return (0..n).filter(|_| self.chance(p)).count() as u32;
        }
        let mean = n as f64 * p;
        let sd = (mean * (1.0 - p)).sqrt();
        self.normal(mean, sd).round().clamp(0.0, n as f64) as u32
    }

    /// Pick an index from `weights` proportionally. Returns 0 for empty input.
    pub fn weighted(&mut self, weights: &[f64]) -> usize {
        let total: f64 = weights.iter().sum();
        if total <= 0.0 {
            return 0;
        }
        let mut roll = self.f64() * total;
        for (i, w) in weights.iter().enumerate() {
            if roll < *w {
                return i;
            }
            roll -= w;
        }
        weights.len() - 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_same_sequence() {
        let mut a = Rng::new(42);
        let mut b = Rng::new(42);
        for _ in 0..100 {
            assert_eq!(a.next_u64(), b.next_u64());
        }
    }

    #[test]
    fn range_is_inclusive_and_bounded() {
        let mut r = Rng::new(7);
        let mut seen = [false; 3];
        for _ in 0..1000 {
            let v = r.range(2, 4);
            assert!((2..=4).contains(&v));
            seen[(v - 2) as usize] = true;
        }
        assert!(seen.iter().all(|s| *s));
    }

    #[test]
    fn binomial_mean_is_close() {
        let mut r = Rng::new(1);
        let n = 2000;
        let total: u32 = (0..n).map(|_| r.binomial(100, 0.1)).sum();
        let mean = total as f64 / n as f64;
        assert!((mean - 10.0).abs() < 0.5, "mean {mean}");
    }
}

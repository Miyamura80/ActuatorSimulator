//! Daily close: overhead, day summary, cash warnings, bankruptcy.

use crate::event::{EventKind, Severity};
use crate::model::{DaySummary, GameStatus};
use crate::state::{DayCounters, GameState};

pub fn tick(state: &mut GameState) {
    if state.hour() == 23 {
        close_day(state);
    }
}

fn close_day(state: &mut GameState) {
    let overhead = state.tuning.overhead_per_day;
    state.spend(overhead, |l| &mut l.overhead);

    let today = std::mem::take(&mut state.today);
    let start = std::mem::replace(&mut state.ledger_day_start, state.ledger.clone());
    let DayCounters {
        produced,
        shipped,
        scrapped,
        iqc_rejects,
    } = today;
    state.history.push(DaySummary {
        day: state.day(),
        cash: state.cash,
        reputation: state.reputation,
        revenue: state.ledger.revenue - start.revenue,
        costs: state.ledger.costs() - start.costs(),
        produced,
        shipped,
        scrapped,
        iqc_rejects,
    });

    let limit = state.tuning.overdraft_limit;
    if state.cash < -limit {
        state.status = GameStatus::Bankrupt { day: state.day() };
        let cash = state.cash;
        state.emit(
            Severity::Critical,
            format!("Bankrupt: cash ${cash} is past the ${limit} overdraft limit"),
            EventKind::Bankrupt { cash },
        );
    } else if state.cash < 0 {
        let cash = state.cash;
        state.emit(
            Severity::Critical,
            format!("Overdrawn: ${cash}. Bankruptcy below -${limit}"),
            EventKind::LowCash { cash },
        );
    }
}

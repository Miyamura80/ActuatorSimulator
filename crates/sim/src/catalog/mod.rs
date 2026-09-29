//! Static game data: items, stations, recipes, and base supplier table.

mod suppliers;

pub use suppliers::{supplier_table, SupplierSpec, Tier};

use serde::{Deserialize, Serialize};

/// Every material that can sit in inventory, purchased or built.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Item {
    Magnets,
    Laminations,
    CopperWire,
    Bearing,
    EncoderIc,
    PcbBlank,
    AluBillet,
    SteelBlank,
    Housing,
    GearSet,
    Stator,
    DriverBoard,
    Motor,
    Actuator,
    FinishedGood,
}

impl Item {
    pub const ALL: [Item; 15] = [
        Item::Magnets,
        Item::Laminations,
        Item::CopperWire,
        Item::Bearing,
        Item::EncoderIc,
        Item::PcbBlank,
        Item::AluBillet,
        Item::SteelBlank,
        Item::Housing,
        Item::GearSet,
        Item::Stator,
        Item::DriverBoard,
        Item::Motor,
        Item::Actuator,
        Item::FinishedGood,
    ];

    pub const PURCHASED: [Item; 8] = [
        Item::Magnets,
        Item::Laminations,
        Item::CopperWire,
        Item::Bearing,
        Item::EncoderIc,
        Item::PcbBlank,
        Item::AluBillet,
        Item::SteelBlank,
    ];

    pub fn is_purchased(self) -> bool {
        Self::PURCHASED.contains(&self)
    }

    pub fn label(self) -> &'static str {
        match self {
            Item::Magnets => "Magnet set",
            Item::Laminations => "Lamination stack",
            Item::CopperWire => "Copper wire",
            Item::Bearing => "Bearing",
            Item::EncoderIc => "Encoder IC",
            Item::PcbBlank => "PCB blank",
            Item::AluBillet => "Aluminum billet",
            Item::SteelBlank => "Steel blank",
            Item::Housing => "Housing",
            Item::GearSet => "Harmonic gear set",
            Item::Stator => "Stator",
            Item::DriverBoard => "Driver board",
            Item::Motor => "Motor",
            Item::Actuator => "Actuator (untested)",
            Item::FinishedGood => "Actuator (tested)",
        }
    }

    /// Base market price per unit for purchased parts (0 for built items).
    pub fn base_price(self) -> i64 {
        match self {
            Item::Magnets => 55,
            Item::Laminations => 22,
            Item::CopperWire => 9,
            Item::Bearing => 11,
            Item::EncoderIc => 32,
            Item::PcbBlank => 14,
            Item::AluBillet => 16,
            Item::SteelBlank => 20,
            _ => 0,
        }
    }
}

/// A production station type. Each has exactly one recipe.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StationKind {
    Mill,
    GearCut,
    Winding,
    Smt,
    MotorAsm,
    FinalAsm,
    EolTest,
}

/// Static parameters of a station type.
#[derive(Debug, Clone, Copy)]
pub struct StationSpec {
    pub output: Item,
    pub inputs: &'static [(Item, u32)],
    /// Units per machine per operating hour at full condition.
    pub rate_per_hour: f64,
    pub machine_price: i64,
    /// Chance a unit picks up a detectable defect at full condition.
    pub process_defect: f64,
    /// Chance a unit picks up a latent (field-only) defect at full condition.
    pub process_latent: f64,
    /// Condition points lost per operating hour.
    pub wear_per_hour: f64,
    /// Units per output lot.
    pub lot_size: u32,
}

impl StationKind {
    pub const ALL: [StationKind; 7] = [
        StationKind::Mill,
        StationKind::GearCut,
        StationKind::Winding,
        StationKind::Smt,
        StationKind::MotorAsm,
        StationKind::FinalAsm,
        StationKind::EolTest,
    ];

    pub fn label(self) -> &'static str {
        match self {
            StationKind::Mill => "CNC Mill",
            StationKind::GearCut => "Gear Cutting",
            StationKind::Winding => "Stator Winding",
            StationKind::Smt => "SMT Line",
            StationKind::MotorAsm => "Motor Assembly",
            StationKind::FinalAsm => "Final Assembly",
            StationKind::EolTest => "End-of-Line Test",
        }
    }

    pub fn spec(self) -> StationSpec {
        use Item::*;
        match self {
            StationKind::Mill => StationSpec {
                output: Housing,
                inputs: &[(AluBillet, 1)],
                rate_per_hour: 4.0,
                machine_price: 60_000,
                process_defect: 0.005,
                process_latent: 0.001,
                wear_per_hour: 0.12,
                lot_size: 20,
            },
            StationKind::GearCut => StationSpec {
                output: GearSet,
                inputs: &[(SteelBlank, 1)],
                rate_per_hour: 3.0,
                machine_price: 85_000,
                process_defect: 0.008,
                process_latent: 0.002,
                wear_per_hour: 0.15,
                lot_size: 20,
            },
            StationKind::Winding => StationSpec {
                output: Stator,
                inputs: &[(Laminations, 1), (CopperWire, 1)],
                rate_per_hour: 5.0,
                machine_price: 35_000,
                process_defect: 0.006,
                process_latent: 0.0025,
                wear_per_hour: 0.10,
                lot_size: 20,
            },
            StationKind::Smt => StationSpec {
                output: DriverBoard,
                inputs: &[(PcbBlank, 1), (EncoderIc, 1)],
                rate_per_hour: 10.0,
                machine_price: 95_000,
                process_defect: 0.004,
                process_latent: 0.0015,
                wear_per_hour: 0.08,
                lot_size: 20,
            },
            StationKind::MotorAsm => StationSpec {
                output: Motor,
                inputs: &[(Stator, 1), (Magnets, 1), (Bearing, 2)],
                rate_per_hour: 5.0,
                machine_price: 18_000,
                process_defect: 0.003,
                process_latent: 0.0015,
                wear_per_hour: 0.06,
                lot_size: 20,
            },
            StationKind::FinalAsm => StationSpec {
                output: Actuator,
                inputs: &[(Motor, 1), (GearSet, 1), (Housing, 1), (DriverBoard, 1)],
                rate_per_hour: 4.0,
                machine_price: 12_000,
                process_defect: 0.003,
                process_latent: 0.001,
                wear_per_hour: 0.05,
                lot_size: 20,
            },
            StationKind::EolTest => StationSpec {
                output: FinishedGood,
                inputs: &[(Actuator, 1)],
                rate_per_hour: 6.0,
                machine_price: 28_000,
                process_defect: 0.0,
                process_latent: 0.0,
                wear_per_hour: 0.04,
                lot_size: 20,
            },
        }
    }
}

/// Labor cost per machine per operating hour.
pub const LABOR_PER_MACHINE_HOUR: i64 = 38;
/// Incoming-inspection labor per unit inspected.
pub const IQC_COST_PER_UNIT: i64 = 2;
/// Chance the end-of-line test catches a detectable defect.
pub const EOL_TEST_COVERAGE: f64 = 0.97;

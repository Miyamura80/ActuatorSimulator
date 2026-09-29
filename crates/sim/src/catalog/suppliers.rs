//! Base supplier table. Names are fictional.

use super::Item;
use serde::{Deserialize, Serialize};

/// Supplier quality/price tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Tier {
    Premium,
    Standard,
    Budget,
}

impl Tier {
    pub fn price_mult(self) -> f64 {
        match self {
            Tier::Premium => 1.40,
            Tier::Standard => 1.00,
            Tier::Budget => 0.75,
        }
    }

    pub fn defect_rate(self) -> f64 {
        match self {
            Tier::Premium => 0.0015,
            Tier::Standard => 0.005,
            Tier::Budget => 0.020,
        }
    }

    pub fn latent_rate(self) -> f64 {
        match self {
            Tier::Premium => 0.0003,
            Tier::Standard => 0.001,
            Tier::Budget => 0.004,
        }
    }

    pub fn lead_days(self) -> u32 {
        match self {
            Tier::Premium => 5,
            Tier::Standard => 4,
            Tier::Budget => 7,
        }
    }

    /// Probability a shipment arrives on time.
    pub fn reliability(self) -> f64 {
        match self {
            Tier::Premium => 0.97,
            Tier::Standard => 0.90,
            Tier::Budget => 0.75,
        }
    }

    pub fn min_order(self) -> u32 {
        match self {
            Tier::Premium => 50,
            Tier::Standard => 50,
            Tier::Budget => 200,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct SupplierSpec {
    pub name: &'static str,
    pub item: Item,
    pub tier: Tier,
}

pub fn supplier_table() -> &'static [SupplierSpec] {
    use Item::*;
    use Tier::*;
    const TABLE: &[SupplierSpec] = &[
        SupplierSpec {
            name: "Kestrel Magnetics",
            item: Magnets,
            tier: Premium,
        },
        SupplierSpec {
            name: "Northfield Magnet Co.",
            item: Magnets,
            tier: Standard,
        },
        SupplierSpec {
            name: "Lotus Rare Earth",
            item: Magnets,
            tier: Budget,
        },
        SupplierSpec {
            name: "Ferrox Stampings",
            item: Laminations,
            tier: Standard,
        },
        SupplierSpec {
            name: "Gilded Steelworks",
            item: Laminations,
            tier: Budget,
        },
        SupplierSpec {
            name: "Arcwire",
            item: CopperWire,
            tier: Standard,
        },
        SupplierSpec {
            name: "Bluecoil Supply",
            item: CopperWire,
            tier: Budget,
        },
        SupplierSpec {
            name: "Precisa Bearings",
            item: Bearing,
            tier: Premium,
        },
        SupplierSpec {
            name: "Tandem Motion",
            item: Bearing,
            tier: Standard,
        },
        SupplierSpec {
            name: "Roll-Right",
            item: Bearing,
            tier: Budget,
        },
        SupplierSpec {
            name: "Quanta Sense",
            item: EncoderIc,
            tier: Premium,
        },
        SupplierSpec {
            name: "Pixel Logic",
            item: EncoderIc,
            tier: Budget,
        },
        SupplierSpec {
            name: "Copperleaf PCB",
            item: PcbBlank,
            tier: Standard,
        },
        SupplierSpec {
            name: "Rapidboard",
            item: PcbBlank,
            tier: Budget,
        },
        SupplierSpec {
            name: "Harbor Aluminum",
            item: AluBillet,
            tier: Standard,
        },
        SupplierSpec {
            name: "Valley Metals (Al)",
            item: AluBillet,
            tier: Budget,
        },
        SupplierSpec {
            name: "Ironclad Forge",
            item: SteelBlank,
            tier: Premium,
        },
        SupplierSpec {
            name: "Valley Metals (Steel)",
            item: SteelBlank,
            tier: Budget,
        },
    ];
    TABLE
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_purchased_item_has_a_supplier() {
        for item in Item::PURCHASED {
            assert!(
                supplier_table().iter().any(|s| s.item == item),
                "no supplier for {item:?}"
            );
        }
    }
}

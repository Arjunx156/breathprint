import type { AgeGroup } from "./profile";
import type { Bound } from "./range";
import type { SourceId } from "./sources";

/** One constant with its uncertainty, unit and where it comes from. */
export type Factor = {
  low: number;
  mid: number;
  high: number;
  unit: string;
  source: SourceId;
  note: string;
};

function f(low: number, mid: number, high: number, unit: string, source: SourceId, note: string) {
  return { low, mid, high, unit, source, note } satisfies Factor;
}

/** Converts a mean inhalation rate in m3 per minute to m3 per hour. */
const perHour = (m3PerMinute: number) => Math.round(m3PerMinute * 60 * 1000) / 1000;

/**
 * Inhalation rates, EPA Exposure Factors Handbook 2011, Table 6-2 (means).
 * Rows used: birth to <1, 6 to <11, 11 to <16, 31 to <41, 61 to <71 years.
 */
export const INHALATION = {
  infant: {
    sleep: perHour(3.0e-3),
    rest: perHour(3.1e-3),
    light: perHour(7.6e-3),
    moderate: perHour(1.4e-2),
    high: perHour(2.6e-2),
  },
  child: {
    sleep: perHour(4.5e-3),
    rest: perHour(4.8e-3),
    light: perHour(1.1e-2),
    moderate: perHour(2.2e-2),
    high: perHour(4.2e-2),
  },
  teen: {
    sleep: perHour(5.0e-3),
    rest: perHour(5.4e-3),
    light: perHour(1.3e-2),
    moderate: perHour(2.5e-2),
    high: perHour(4.9e-2),
  },
  adult: {
    sleep: perHour(4.6e-3),
    rest: perHour(4.3e-3),
    light: perHour(1.2e-2),
    moderate: perHour(2.7e-2),
    high: perHour(4.9e-2),
  },
  older: {
    sleep: perHour(5.2e-3),
    rest: perHour(4.9e-3),
    light: perHour(1.2e-2),
    moderate: perHour(2.6e-2),
    high: perHour(4.7e-2),
  },
} as const satisfies Record<AgeGroup, Record<string, number>>;

export type Activity = keyof (typeof INHALATION)["adult"];

export const FACTORS = {
  // Indoor air, single-zone mass balance.
  penetration: f(
    0.6,
    0.8,
    1.0,
    "fraction",
    "chenZhao2011",
    "Share of outdoor PM2.5 that gets through the building shell.",
  ),
  deposition: f(
    0.09,
    0.2,
    0.4,
    "per hour",
    "chenZhao2011",
    "Rate at which PM2.5 settles onto indoor surfaces.",
  ),
  airExchangeLeaky: f(
    1.0,
    1.5,
    2.5,
    "per hour",
    "assumption",
    "Older or gappy homes with windows shut; Indian homes are often leakier than the Beijing homes in the review.",
  ),
  airExchangeAverage: f(0.5, 0.8, 1.2, "per hour", "assumption", "Typical home with windows shut."),
  airExchangeTight: f(
    0.2,
    0.4,
    0.6,
    "per hour",
    "chenZhao2011",
    "Well-sealed home; the review cites 0.06 to 0.55 per hour for Beijing homes.",
  ),
  roomVolume: f(
    25,
    30,
    40,
    "m3",
    "assumption",
    "A 10 to 12 square metre bedroom with a 2.8 m ceiling.",
  ),
  livingRoomVolume: f(
    40,
    60,
    90,
    "m3",
    "assumption",
    "The room where the morning puja happens: 15 to 30 square metres.",
  ),
  purifierCadr: f(
    200,
    300,
    500,
    "m3 per hour",
    "ncceh2023",
    "Commercial HEPA purifiers tested in the review delivered 118 to 300 cfm of clean air.",
  ),
  boxFanCadr: f(
    190,
    265,
    540,
    "m3 per hour",
    "ncceh2023",
    "One MERV 13 filter taped to a box fan: 113 to 318 cfm across studies.",
  ),
  purifierWatts: f(30, 50, 70, "W", "assumption", "Room purifier on a medium setting."),
  boxFanWatts: f(
    55,
    65,
    80,
    "W",
    "dalPorto2022",
    "A 20-inch box fan; the multi-filter build drew 8.7 cfm per watt.",
  ),

  // Personal protection and travel.
  maskLeakage: f(
    0.05,
    0.2,
    0.5,
    "fraction",
    "cherrie2018",
    "Share of outdoor particles that still reach the lungs through a certified, well-fitted N95 or FFP2. Poor fit pushes this to 68%.",
  ),
  ratioWalk: f(
    1.2,
    1.4,
    1.6,
    "x ambient",
    "goel2015",
    "On-road PM2.5 while walking in Delhi, relative to the background reading.",
  ),
  ratioCycle: f(1.0, 1.1, 1.3, "x ambient", "goel2015", "On-road PM2.5 while cycling."),
  ratioTwoWheeler: f(
    1.1,
    1.3,
    1.5,
    "x ambient",
    "goel2015",
    "On-road PM2.5 on a motorcycle or scooter.",
  ),
  ratioAuto: f(1.2, 1.3, 1.5, "x ambient", "goel2015", "On-road PM2.5 in an auto-rickshaw."),
  ratioCarOpen: f(1.1, 1.3, 1.5, "x ambient", "goel2015", "Car with windows open."),
  ratioCarAc: f(0.4, 0.5, 0.6, "x ambient", "goel2015", "Car with windows shut and AC on."),
  ratioBus: f(1.0, 1.2, 1.4, "x ambient", "goel2015", "Inside a bus and at the bus stop."),
  ratioMetro: f(
    0.7,
    0.8,
    1.0,
    "x ambient",
    "goel2015",
    "Inside a metro carriage; stations run 1.3x.",
  ),
  speedWalk: f(4, 4.5, 5, "km per hour", "assumption", "Walking pace."),
  speedCycle: f(10, 12, 15, "km per hour", "assumption", "City cycling."),
  speedTwoWheeler: f(18, 22, 28, "km per hour", "assumption", "Peak-hour city riding."),
  speedCar: f(15, 20, 28, "km per hour", "assumption", "Peak-hour city driving."),
  speedAuto: f(15, 18, 24, "km per hour", "assumption", "Auto-rickshaw in traffic."),
  speedBus: f(12, 15, 20, "km per hour", "assumption", "City bus including stops."),
  speedMetro: f(25, 32, 38, "km per hour", "assumption", "Door-to-platform average on the metro."),

  // Emissions to the shared air.
  petrolCo2PerLitre: f(
    2.27,
    2.27,
    2.27,
    "kg CO2 per litre",
    "indiaGhg2015",
    "IPCC and India GHG Program factor for petrol.",
  ),
  carKmPerLitre: f(
    11.6,
    14.9,
    18,
    "km per litre",
    "indiaGhg2015",
    "Fuel economy of Indian petrol cars.",
  ),
  twoWheelerCo2PerKm: f(
    0.032,
    0.035,
    0.038,
    "kg CO2 per km",
    "indiaGhg2015",
    "Motorcycles and scooters under 150 cc.",
  ),
  autoCo2PerKm: f(
    0.1,
    0.108,
    0.132,
    "kg CO2 per km",
    "indiaGhg2015",
    "CNG auto-rickshaw; petrol and diesel run higher.",
  ),
  busCo2PerPkm: f(0.012, 0.0152, 0.02, "kg CO2 per passenger-km", "indiaGhg2015", "Intracity bus."),
  metroCo2PerPkm: f(
    0.025,
    0.037,
    0.061,
    "kg CO2 per passenger-km",
    "unepMetro2014",
    "Delhi Metro: 61 g at the 2011 grid, scaled to today's grid.",
  ),
  carNonExhaustPm25PerKm: f(
    0.007,
    0.0115,
    0.024,
    "g PM2.5 per km",
    "oecd2020",
    "Tyre, brake and road wear from a car. Tailpipe and resuspended dust come on top.",
  ),
  twoWheelerNonExhaustPm25PerKm: f(
    0.003,
    0.005,
    0.01,
    "g PM2.5 per km",
    "oecd2020",
    "Lighter vehicles shed less; scaled by weight from the OECD fit.",
  ),
  busNonExhaustPm25PerPkm: f(
    0.0008,
    0.0015,
    0.003,
    "g PM2.5 per passenger-km",
    "oecd2020",
    "Heavy-vehicle wear shared among passengers.",
  ),
  gridCo2PerKwh: f(
    0.6,
    0.675,
    0.727,
    "kg CO2 per kWh",
    "ceaCo2v22",
    "India grid weighted average, FY 2025-26 (FY 2023-24 was 0.727).",
  ),
  idleLitresPerHour: f(
    0.6,
    0.95,
    1.9,
    "litres per hour",
    "doeIdling",
    "A quarter to half a gallon an hour; small Indian engines sit at the low end.",
  ),
  garbagePm25PerKg: f(
    4.1,
    9.8,
    15.5,
    "g PM2.5 per kg",
    "akagi2011",
    "Open burning of household garbage and leaves.",
  ),
  incensePm25PerStick: f(
    8,
    35,
    84,
    "mg PM2.5 per stick",
    "jetter2002",
    "5 to 56 mg per gram burned; a stick is about 1.5 g.",
  ),
  coilMgPerHour: f(
    51,
    80,
    117,
    "mg PM2.5 per hour",
    "liu2003",
    "One coil equals 75 to 137 cigarettes of PM2.5.",
  ),
  cigaretteUgM3: f(
    22,
    22,
    22,
    "ug/m3 for 24 h",
    "berkeleyEarth2015",
    "A day at 22 ug/m3 is roughly as harmful as one cigarette.",
  ),

  // Household habits the profile does not ask about, stated as assumptions.
  twoWheelerKmPerLitre: f(
    35,
    45,
    55,
    "km per litre",
    "assumption",
    "Commuter motorcycles and scooters.",
  ),
  errandKmAvoided: f(
    3,
    6,
    10,
    "km per day",
    "assumption",
    "Car kilometres saved by chaining errands into one trip.",
  ),
  idleMinutesPerDay: f(
    5,
    10,
    20,
    "minutes per day",
    "assumption",
    "Time a city commute spends stopped at signals for more than 10 seconds.",
  ),
  wasteKgPerDay: f(
    0.5,
    1,
    3,
    "kg per day",
    "assumption",
    "Leaves and dry waste a household might otherwise burn.",
  ),
  heaterKwhSaved: f(
    0.5,
    1.5,
    3,
    "kWh per day",
    "assumption",
    "Heating one closed room on a timer instead of the whole home.",
  ),
  incenseSticksPerDay: f(1, 2, 4, "sticks per day", "assumption", "Morning and evening puja."),
  coilHours: f(
    6,
    8,
    10,
    "hours per night",
    "assumption",
    "A coil smoulders through most of the night.",
  ),

  // Money, Delhi.
  autoInrPerKm: f(
    11,
    13,
    16,
    "INR per km",
    "assumption",
    "Delhi auto-rickshaw metered fare after the first 1.5 km.",
  ),
  petrolInrPerLitre: f(
    94,
    95,
    105,
    "INR per litre",
    "assumption",
    "Delhi pump price, approximate. Check today's price.",
  ),
  metroFareInr: f(11, 40, 64, "INR per trip", "dmrcFares", "Delhi Metro fare range."),
  busFareInr: f(0, 15, 25, "INR per trip", "assumption", "DTC buses; free for women."),
  electricityInrPerKwh: f(3, 7, 8, "INR per kWh", "assumption", "Delhi household tariff slabs."),
  boxFanBuildInr: f(
    2500,
    3500,
    5000,
    "INR once",
    "assumption",
    "Box fan plus one MERV 13 or HEPA-grade filter.",
  ),
  n95Inr: f(
    30,
    60,
    150,
    "INR per mask",
    "assumption",
    "Certified N95 or FFP2, reused for a few days.",
  ),
  sealKitInr: f(
    150,
    300,
    600,
    "INR once",
    "assumption",
    "Foam weather strip and a door draught stopper for the rooms the family uses most.",
  ),
} as const satisfies Record<string, Factor>;

export type FactorId = keyof typeof FACTORS;

/** Picks one bound of every factor, for evaluating a model at that bound. */
export type Pick = (id: FactorId) => number;

/** A Pick that reads every factor at one bound: low, mid or high. */
export function picker(bound: Bound): Pick {
  return (id) => FACTORS[id][bound];
}

/** PM2.5 guideline values and thresholds the rules use, in ug/m3. */
export const THRESHOLDS = {
  whoAnnual: 5,
  whoDaily: 15,
  /** Top of US EPA "Moderate": above this, sensitive people should ease off outdoors. */
  sensitiveCaution: 35.4,
  /** Top of US EPA "Unhealthy for sensitive groups": above this, everyone should. */
  everyoneCaution: 55.4,
  /** US EPA "Very unhealthy" starts above this: move all exertion indoors. */
  indoorsOnly: 125.4,
} as const;

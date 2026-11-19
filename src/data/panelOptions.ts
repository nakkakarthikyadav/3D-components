export interface SolarPanelOption {
  id: string;
  name: string;
  shortName: string;
  technology: string;
  pMaxW: number;
  vmp: number;
  imp: number;
  voc: number;
  isc: number;
  tempCoeffVoc: number; // %/°C
  priceINR: number;
  priceRangeINR: string;
  priceUSD: number;
  availability: 'High (Retail)' | 'Medium (Distributors)' | 'Low / Niche Import' | 'Utility Only (Not 160W Retail)';
  mosfetRequirement: 'Standard 55V (IRF3205)' | 'Upgrade to 100V (IRFB4110 + 100V Caps)';
  highVoltageUpgrade: boolean;
  verdictTag:
    | 'Chosen #1: Cheap + Unique'
    | 'Cheapest Raw Baseline'
    | 'Unique Thin-Film (Costly)'
    | 'Unique Thin-Film (High Voc)'
    | 'Overkill / High Cost'
    | 'Lab / Warning';
  summary: string;
  hardwareChangesNeeded: string;
}

export const SOLAR_PANEL_OPTIONS: SolarPanelOption[] = [
  {
    id: '165w-perc',
    name: '165 Wp Passivated Emitter & Rear Contact (Mono PERC)',
    shortName: '165Wp Mono PERC',
    technology: '36-Cell Monocrystalline PERC (AlOx/SiNx Rear Passivation)',
    pMaxW: 165,
    vmp: 18.7,
    imp: 8.82,
    voc: 22.8,
    isc: 9.45,
    tempCoeffVoc: -0.29,
    priceINR: 4800,
    priceRangeINR: '₹4,600 – ₹5,800',
    priceUSD: 58,
    availability: 'High (Retail)',
    mosfetRequirement: 'Standard 55V (IRF3205)',
    highVoltageUpgrade: false,
    verdictTag: 'Chosen #1: Cheap + Unique',
    summary:
      'BEST PICK (Cheap + Unique): Costs nearly the same as plain 150Wp Poly (~₹300 extra), requires ZERO circuit redesign (22.8V Voc fits 55V IRF3205), yet upgrades your demo to modern rear-passivated PERC silicon (10–15% higher cloudy/morning yield) and enables our d²I/dV² PERC micro-crack diagnostics.',
    hardwareChangesNeeded:
      'None — fits the exact same 55V IRF3205 + 35V C_in + 15A fuse circuit with zero extra BOM cost.',
  },
  {
    id: '150w-poly',
    name: '150 Wp Polycrystalline Solar PV Module',
    shortName: '150Wp Poly-Si',
    technology: '36-Cell Legacy Al-BSF Polycrystalline',
    pMaxW: 150,
    vmp: 18.2,
    imp: 8.24,
    voc: 22.4,
    isc: 8.85,
    tempCoeffVoc: -0.32,
    priceINR: 4500,
    priceRangeINR: '₹4,500 – ₹5,800',
    priceUSD: 55,
    availability: 'High (Retail)',
    mosfetRequirement: 'Standard 55V (IRF3205)',
    highVoltageUpgrade: false,
    verdictTag: 'Cheapest Raw Baseline',
    summary:
      'Slightly cheaper raw sticker price (~₹300 less), but 95%+ of student mini-projects use legacy Poly-Si—zero panel uniqueness compared to 165Wp Mono PERC.',
    hardwareChangesNeeded: 'None — baseline 55V IRF3205 + 35V C_in + 11:1 (ESP32) / 6:1 (Arduino) divider.',
  },
  {
    id: '70w-cigs',
    name: '70 Wp Copper Indium Gallium Selenide (CIGS) Panel',
    shortName: '70Wp CIGS Thin-Film',
    technology: 'Flexible CIGS Thin-Film',
    pMaxW: 70,
    vmp: 17.5,
    imp: 4.0,
    voc: 22.2,
    isc: 4.45,
    tempCoeffVoc: -0.24,
    priceINR: 10500,
    priceRangeINR: '₹9,000 – ₹15,000',
    priceUSD: 126,
    availability: 'Low / Niche Import',
    mosfetRequirement: 'Standard 55V (IRF3205)',
    highVoltageUpgrade: false,
    verdictTag: 'Unique Thin-Film (Costly)',
    summary:
      'Ultra-unique flexible, glass-free thin-film panel rarely seen in student projects. Safe 22.2V Voc, tolerant to partial shading, but NOT cheap (₹130–₹250/W imported).',
    hardwareChangesNeeded: 'Lower current (4A) lets you use a smaller 7.5A fuse and 10A inductor.',
  },
  {
    id: '90w-asi',
    name: '90 Wp Amorphous Silicon (a-Si) Solar Panel',
    shortName: '90Wp Amorphous Si',
    technology: 'Thin-Film Amorphous Silicon',
    pMaxW: 90,
    vmp: 46.0,
    imp: 1.96,
    voc: 62.0,
    isc: 2.25,
    tempCoeffVoc: -0.21,
    priceINR: 5200,
    priceRangeINR: '₹4,000 – ₹6,300',
    priceUSD: 63,
    availability: 'Low / Niche Import',
    mosfetRequirement: 'Upgrade to 100V (IRFB4110 + 100V Caps)',
    highVoltageUpgrade: true,
    verdictTag: 'Unique Thin-Film (High Voc)',
    summary:
      'Works even under dim indoor/fluorescent hostel light, and almost nobody uses a-Si for MPPT—but rare to find retail in India and multi-junction Voc (45V–90V+) forces 100V MOSFET hardware changes.',
    hardwareChangesNeeded: 'MUST upgrade IRF3205 (55V) → IRFB4110 (100V), C_in → 100V, TVS → SMBJ70A, Divider → 220kΩ/10kΩ.',
  },
  {
    id: '160w-cdte',
    name: '160 Wp Cadmium Telluride (CdTe) Solar Panel',
    shortName: '160Wp CdTe',
    technology: 'CdTe Thin-Film (Utility Class)',
    pMaxW: 160,
    vmp: 48.0,
    imp: 3.33,
    voc: 60.5,
    isc: 3.7,
    tempCoeffVoc: -0.25,
    priceINR: 4200,
    priceRangeINR: 'Not sold at 160W retail (Silicon equiv ~₹3,800)',
    priceUSD: 50,
    availability: 'Utility Only (Not 160W Retail)',
    mosfetRequirement: 'Upgrade to 100V (IRFB4110 + 100V Caps)',
    highVoltageUpgrade: true,
    verdictTag: 'Lab / Warning',
    summary:
      'True CdTe (First Solar) is manufactured for utility megawatt plants, not 160W retail. If your college lab has a real CdTe sample, verify Voc first (often 60V–90V+); online "160W" listings are regular Silicon.',
    hardwareChangesNeeded: 'Check label Voc! If Voc > 30V, upgrade MOSFETs to 100V IRFB4110 and divider to 220kΩ/10kΩ.',
  },
  {
    id: '375w-mono',
    name: '375 Wp Monocrystalline Silicon Solar PV Module',
    shortName: '375Wp Mono-Si',
    technology: '72-Cell Monocrystalline Silicon',
    pMaxW: 375,
    vmp: 39.8,
    imp: 9.42,
    voc: 48.1,
    isc: 9.95,
    tempCoeffVoc: -0.3,
    priceINR: 9800,
    priceRangeINR: '₹9,000 – ₹11,500',
    priceUSD: 118,
    availability: 'Medium (Distributors)',
    mosfetRequirement: 'Upgrade to 100V (IRFB4110 + 100V Caps)',
    highVoltageUpgrade: true,
    verdictTag: 'Overkill / High Cost',
    summary:
      '24V-class 72-cell residential panel (~2m × 1m, ~21 kg). Far too bulky for a hostel room and outputs 48.1V Voc + ~30A battery output current.',
    hardwareChangesNeeded: 'Upgrade MOSFETs to 100V IRFB4110, 100V caps, ACS712-30A, 30A inductor, and 24V battery bank.',
  },
  {
    id: '410w-maxeon',
    name: '410 Wp Maxeon Cell (IBC) Solar Panel',
    shortName: '410Wp Maxeon IBC',
    technology: 'Interdigitated Back Contact (IBC)',
    pMaxW: 410,
    vmp: 40.5,
    imp: 10.12,
    voc: 48.2,
    isc: 10.75,
    tempCoeffVoc: -0.26,
    priceINR: 24000,
    priceRangeINR: '₹20,000 – ₹32,000 (Imported)',
    priceUSD: 290,
    availability: 'Low / Niche Import',
    mosfetRequirement: 'Upgrade to 100V (IRFB4110 + 100V Caps)',
    highVoltageUpgrade: true,
    verdictTag: 'Overkill / High Cost',
    summary:
      'Ultra-premium imported IBC back-contact module (22.6%+ efficiency). Exceptional tech, but way too expensive and physically massive for a student hostel mini-project.',
    hardwareChangesNeeded: 'Full 100V/35A power stage redesign (IRFB4110, 100V caps, ACS712-30A, 24V battery).',
  },
];

export interface UniqueInnovationFeature {
  title: string;
  badge: string;
  problemSolved: string;
  howItWorks: string;
  whyUnique: string;
}

export const UNIQUE_PROJECT_UPGRADES: UniqueInnovationFeature[] = [
  {
    title: '01. On-the-Fly d²I/dV² PERC Micro-Crack & Hotspot Detector',
    badge: '₹0 Extra Hardware',
    problemSolved:
      'Thin PERC silicon cells develop hidden micro-cracks and hotspots that normally require a ₹1.5 Lakh thermal/EL camera to diagnose.',
    howItWorks:
      'During a 100ms buck duty sweep, ESP32 applies a 5-point Savitzky-Golay filter and calculates the second derivative d²I/dV². Sharp inflection spikes separate permanent cell cracks/bypass faults from soft cloud shadows.',
    whyUnique:
      'Rarely found even in commercial controllers—turns your ₹1,400 MPPT into a self-diagnostic I-V PV-Scope.',
  },
  {
    title: '02. Buck Switching-Ripple Battery ESR & Sulfation Estimator',
    badge: 'Uses 40 kHz Ripple',
    problemSolved:
      'Standard chargers only read terminal voltage, missing dead/sulfated lead-acid or aging LiFePO4 cells until failure.',
    howItWorks:
      'Samples the synchronous buck converter’s inherent 40 kHz inductor AC ripple (ΔV_bat and ΔI_bat via digital high-pass extraction) to compute internal resistance ESR ≈ ΔV_bat / ΔI_bat in milliohms (mΩ) while charging.',
    whyUnique:
      'Eliminates external AC milliohm test rigs by exploiting switching ripple already present on the PCB.',
  },
  {
    title: '03. Two-Stage 100ms Global MPPT + InCond + Night Q3 Isolation',
    badge: 'Escapes Local Peaks',
    problemSolved:
      'Student P&O firmware gets trapped on fake power peaks when hostel balcony railings or trees shade part of the panel.',
    howItWorks:
      'On any sudden >15% power drop (or every 5 min), an open-loop 100ms ramp sweep locates the true Global Peak, then hands over to zero-oscillation Incremental Conductance (dI/dV = -I/V). Q3 locks out night back-feed.',
    whyUnique:
      'Recovers 20–40% shading energy loss and enables true resting-OCV battery SoC% + Wh/day yield logging.',
  },
  {
    title: '04. Dual-Core FreeRTOS Live PV-Scope + Dust vs. Cloud Classifier',
    badge: 'Core 1 DSP + Core 0 Wi-Fi',
    problemSolved:
      'Basic projects only show raw numbers on a 16×2 LCD and cannot tell dirty panel glass apart from passing clouds.',
    howItWorks:
      'Core 1 runs deterministic 40 kHz MPPT, d²I/dV², and ESR DSP; Core 0 hosts a live phone Web Oscilloscope (/pvscope JSON) plotting I-V/d²I/dV² curves, plus DS18B20-compensated soiling alerts.',
    whyUnique:
      'Combining d²I/dV² crack sensing + buck-ripple ESR + GMPPT + live Wi-Fi PV-Scope in one student build is virtually unheard of.',
  },
];


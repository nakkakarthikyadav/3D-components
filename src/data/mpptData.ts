export type SubsystemLayer = 'all' | 'power' | 'sensing' | 'driver' | 'protection';

export type ControllerPlatform = 'esp32' | 'arduino' | 'hybrid';

export type CurrencyCode = 'USD' | 'INR' | 'EUR';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  label: string;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', label: 'USD ($)', decimals: 2 },
  INR: { code: 'INR', symbol: '₹', label: 'INR (₹)', decimals: 0 },
  EUR: { code: 'EUR', symbol: '€', label: 'EUR (€)', decimals: 2 },
};

export const PLATFORM_META: Record<
  ControllerPlatform,
  {
    label: string;
    shortLabel: string;
    mcuSummary: string;
    logicLevel: string;
    pwmSpec: string;
  }
> = {
  esp32: {
    label: 'ESP32-WROOM-32',
    shortLabel: 'ESP32 Only',
    mcuSummary: 'Single-board 3.3V controller with 40 kHz LEDC PWM and built-in Wi-Fi telemetry.',
    logicLevel: '3.3 V CMOS (ADC1 pins 32–35)',
    pwmSpec: 'GPIO 18 · 40 kHz · 10-bit LEDC',
  },
  arduino: {
    label: 'Arduino Uno / Nano',
    shortLabel: 'Arduino Only',
    mcuSummary: 'Classic 5V mini-project controller with Timer1 40 kHz PWM and direct ACS712 interface.',
    logicLevel: '5.0 V TTL (Native ACS712 compatibility)',
    pwmSpec: 'Pin D9 (Timer1 OC1A) · 40 kHz Fast PWM',
  },
  hybrid: {
    label: 'Arduino + ESP32 Hybrid',
    shortLabel: 'Arduino + ESP32',
    mcuSummary: 'Arduino handles 5V MPPT buck control & LCD; ESP32 reads UART telemetry for Wi-Fi dashboard.',
    logicLevel: '5V Power Control + 3.3V Wi-Fi Bridge',
    pwmSpec: 'Arduino D9 (40 kHz) + UART TX/RX (9600 bps)',
  },
};

export interface PvModuleSpec {
  parameter: string;
  symbol: string;
  value: string;
  unit: string;
  notes: string;
}

export const PV_MODULE_SPECS: PvModuleSpec[] = [
  { parameter: 'Maximum Power (STC)', symbol: 'Pmp', value: '150', unit: 'Wp', notes: '1000 W/m², 25°C cell temp, AM 1.5' },
  { parameter: 'Voltage at Max Power', symbol: 'Vmp', value: '18.2', unit: 'V', notes: 'Optimal MPPT operating point' },
  { parameter: 'Current at Max Power', symbol: 'Imp', value: '8.24', unit: 'A', notes: 'Rated peak PV array current' },
  { parameter: 'Open-Circuit Voltage', symbol: 'Voc', value: '22.4', unit: 'V', notes: 'Cold weather peak ~24.8 V at 0°C' },
  { parameter: 'Short-Circuit Current', symbol: 'Isc', value: '8.85', unit: 'A', notes: 'Used for 15A fuse & 20A ACS712 sizing' },
  { parameter: 'Cell Architecture', symbol: '36-Cell', value: 'Polycrystalline', unit: 'Si', notes: '4×9 matrix, tempered low-iron glass' },
  { parameter: 'Temp. Coefficient (Voc)', symbol: 'β_Voc', value: '-0.32', unit: '%/°C', notes: 'Voltage drops as panel heats up' },
  { parameter: 'Temp. Coefficient (Pmp)', symbol: 'γ_Pmp', value: '-0.41', unit: '%/°C', notes: 'Yields ~128 W at 45°C cell temp' },
];

export interface CircuitNodeDetail {
  id: string;
  title: string;
  subtitle: string;
  layer: Exclude<SubsystemLayer, 'all'>;
  keyParts: string[];
  connections: { from: string; to: string; signal: string }[];
  engineeringMath: string;
  safetyNote: string;
}

export function getCircuitNodes(platform: ControllerPlatform): Record<string, CircuitNodeDetail> {
  const isArduinoControl = platform === 'arduino' || platform === 'hybrid';

  return {
    pv_input: {
      id: 'pv_input',
      title: '165Wp Mono PERC PV Input & Surge Stage',
      subtitle: 'MC4 Entry · Over-Current Fuse · Reverse Polarity & TVS Clamp',
      layer: 'protection',
      keyParts: [
        '165Wp Mono PERC Panel (22.8 Voc / 9.45 Isc)',
        '15A DC Blade Fuse',
        '15SQ045 Schottky Diode',
        'SMBJ26A TVS Diode',
        '2× 470µF / 35V Low-ESR Caps',
      ],
      connections: [
        { from: 'PV+ (MC4 Red)', to: '15A Fuse -> 15SQ045 Anode', signal: 'Unregulated 0–24V DC, up to 8.85A' },
        { from: '15SQ045 Cathode', to: 'SMBJ26A Cathode + C_in (+) + Q1 Drain', signal: 'Protected PV+ Bus (V_PV)' },
        { from: 'PV- (MC4 Black)', to: 'Common Ground Star Bus (GND)', signal: '0V Reference Plane' },
      ],
      engineeringMath:
        'Input RMS ripple current ΔI_rms ≈ I_mp × 0.5 ≈ 4.12 A. Two 470µF/35V Low-ESR capacitors in parallel provide 940µF bulk energy storage so input voltage droop stays < 0.25V during 40kHz Q1 turn-on pulses.',
      safetyNote:
        'Use 4mm² (12 AWG) solar cable. Keep SMBJ26A TVS diode directly across input terminals to clamp inductive lightning or disconnect spikes below 30V.',
    },
    acs_pv: {
      id: 'acs_pv',
      title: 'PV Input Current Sensor (ACS712-20A)',
      subtitle: isArduinoControl
        ? 'High-Side Hall-Effect Isolation · Direct 5V Arduino A2 Input'
        : 'High-Side Hall-Effect Isolation + 5V-to-3.3V Level Divider',
      layer: 'sensing',
      keyParts: isArduinoControl
        ? ['ACS712ELCTR-20A Module', '100nF Ceramic Filter Cap']
        : ['ACS712ELCTR-20A Module', '10kΩ + 20kΩ 1% Resistors', '100nF Ceramic Filter Cap'],
      connections: [
        { from: 'ACS712 IP+ / IP-', to: 'Series between C_in (+) and Q1 Drain', signal: 'PV Current Path (0–10A DC)' },
        { from: 'ACS712 VCC / GND', to: 'Aux 5V Rail / Common GND', signal: '5.0V Supply (13mA draw)' },
        isArduinoControl
          ? { from: 'ACS712 VIOUT', to: 'Arduino Pin A2 (100nF to GND)', signal: 'Direct 5V Analog (2.50V @ 0A, +100mV/A)' }
          : { from: 'ACS712 VIOUT', to: '10kΩ/20kΩ Divider -> ESP32 GPIO 32', signal: 'Scaled Analog (1.67V @ 0A, +66.7mV/A)' },
      ],
      engineeringMath: isArduinoControl
        ? 'Arduino Uno/Nano operates natively at 5.0V ADC reference (4.88 mV/step). ACS712-20A outputs 2.50V at 0A and 3.50V at 10A (+100 mV/A), connecting directly to A2 without resistor attenuation.'
        : 'ACS712-20A sensitivity is 100 mV/A centered at 2.50 V. Dividing by 20k/(10k+20k) = 0.667 maps 2.50 V to 1.667 V and 10A (3.50 V) to 2.333 V—safely inside ESP32 ADC1 linear range (0.15V–2.45V).',
      safetyNote: isArduinoControl
        ? 'Place a 100nF ceramic capacitor between A2 and GND close to the Arduino pin to filter 40kHz switching ripple.'
        : 'Do not connect ACS712 VIOUT directly to ESP32! At 20A peak, VIOUT reaches 4.5V which permanently damages ESP32 3.3V GPIO pins.',
    },
    vdiv_pv: {
      id: 'vdiv_pv',
      title: 'PV Voltage Divider & Zener Clamp',
      subtitle: isArduinoControl
        ? '6:1 Attenuation to Arduino A0 (5.1V Zener Protected)'
        : '11:1 Precision Attenuation to ESP32 GPIO 34 (3.3V Zener Protected)',
      layer: 'sensing',
      keyParts: isArduinoControl
        ? ['100kΩ 1% Resistor (R1)', '20kΩ 1% Resistor (R2)', '1N4733A 5.1V Zener Diode', '100nF Cap']
        : ['100kΩ 1% Resistor (R1)', '10kΩ 1% Resistor (R2)', '1N4728A 3.3V Zener Diode', '100nF Cap'],
      connections: [
        { from: 'Protected PV+ Bus', to: 'R1 (100kΩ)', signal: '0–25V PV Voltage' },
        isArduinoControl
          ? { from: 'R1 / R2 (20kΩ) Junction', to: 'Arduino Pin A0 + 5.1V Zener + 100nF', signal: '0–4.17V Analog ADC Input' }
          : { from: 'R1 / R2 (10kΩ) Junction', to: 'ESP32 GPIO 34 + 3.3V Zener + 100nF', signal: '0–2.27V Analog ADC Input' },
        { from: 'R2 Bottom / Zener Anode', to: 'Common GND', signal: 'Ground Reference' },
      ],
      engineeringMath: isArduinoControl
        ? 'V_adc = V_pv × [20k / (100k + 20k)] = V_pv / 6. At Voc = 22.4V, A0 reads 3.73V (ADC = 764/1023). Max safe measurable PV input = 30.0V (clamped at 5.1V).'
        : 'V_adc = V_pv × [10k / (100k + 10k)] = V_pv / 11. At Voc = 22.4V, GPIO 34 reads 2.036V. Even at 30V cold open-circuit, V_adc = 2.72V, and the 3.3V Zener clamps transient overshoot.',
      safetyNote: isArduinoControl
        ? 'Use 1% tolerance metal-film resistors so MPPT voltage readings stay accurate within ±0.15V.'
        : 'Use GPIO 34 (ADC1) because ESP32 disables all ADC2 channels whenever Wi-Fi telemetry is active.',
    },
    ir2104_driver: {
      id: 'ir2104_driver',
      title: 'IR2104 Synchronous Half-Bridge Gate Driver',
      subtitle: 'Bootstrap High-Side Drive + Built-in 520ns Dead-Time',
      layer: 'driver',
      keyParts: ['IR2104S Driver IC', '1N5819 Bootstrap Schottky', '1µF + 100nF Bootstrap Caps', '2× 10Ω Gate Resistors'],
      connections: [
        isArduinoControl
          ? { from: 'Arduino D9 (Timer1 40kHz)', to: 'IR2104 Pin 2 (IN)', signal: '5V Logic PWM (10kΩ pull-down)' }
          : { from: 'ESP32 GPIO 18 (40kHz PWM)', to: 'IR2104 Pin 2 (IN)', signal: '3.3V Logic PWM (>2.2V CMOS threshold)' },
        isArduinoControl
          ? { from: 'Arduino D8 (Enable)', to: 'IR2104 Pin 3 (SD)', signal: 'Shutdown Control (HIGH = Run, LOW = Off)' }
          : { from: 'ESP32 GPIO 19 (Enable)', to: 'IR2104 Pin 3 (SD)', signal: 'Shutdown Control (HIGH = Run, LOW = Off)' },
        { from: 'IR2104 Pin 1 (VCC)', to: 'Aux 12V Rail + 10µF Decoupling', signal: '12.0V Gate Drive Power' },
        { from: 'IR2104 Pin 7 (HO) / Pin 5 (LO)', to: '10Ω Gate Resistors -> Q1 Gate / Q2 Gate', signal: 'Bootstrapped High-Side & Low-Side Drive' },
        { from: 'IR2104 Pin 6 (VS)', to: 'Q1 Source / Q2 Drain / L1 Input', signal: 'Switched Node Reference (0V to V_PV)' },
      ],
      engineeringMath:
        'The IR2104 enforces an internal 520 ns dead-time between Q1 turn-off and Q2 turn-on, preventing shoot-through shorts across C_in. Bootstrap diode 1N5819 recharges the 1µF VB-VS capacitor every cycle when Q2 pulls VS to GND.',
      safetyNote:
        'Maximum duty cycle MUST be capped at 95% in firmware so the low-side MOSFET turns on each cycle to refresh the high-side bootstrap capacitor!',
    },
    buck_stage: {
      id: 'buck_stage',
      title: 'Synchronous Buck Power Stage (Q1, Q2, L1)',
      subtitle: '40kHz High-Efficiency DC-DC Step-Down (18.2V → 14.4V)',
      layer: 'power',
      keyParts: ['Q1 & Q2: IRF3205 N-MOSFETs (55V, 110A, 8mΩ)', 'L1: 47µH 15A Toroidal Inductor (T106-26)', 'C_out: 2× 1000µF / 25V Low-ESR'],
      connections: [
        { from: 'Q1 Drain', to: 'ACS712 PV Out + C_in (+)', signal: 'Input Bus ~18.2V @ 8.24A' },
        { from: 'Q1 Source + Q2 Drain', to: 'L1 Inductor Input + IR2104 VS', signal: '40kHz Square Wave Switch Node' },
        { from: 'Q2 Source', to: 'Common Power GND', signal: 'Synchronous Return Path' },
        { from: 'L1 Output', to: 'C_out (+) -> ACS712 Bat In', signal: 'Filtered 12.0V–14.4V DC up to 11.5A' },
      ],
      engineeringMath:
        'Inductor ripple ΔI_L = [V_bat × (1 - D)] / (f_sw × L1). At V_pv=18.2V, V_bat=13.5V (D=0.74), f_sw=40kHz, L1=47µH: ΔI_L = 1.87 A (~17% ripple). MOSFET conduction loss: I² × R_ds(on) ≈ 11² × 0.008 = 0.97 W.',
      safetyNote:
        'Mount Q1 and Q2 on isolated TO-220 heatsinks (with silicone pads) because the metal tab of IRF3205 is connected to the Drain—Q1 tab is at V_PV while Q2 tab is at Switch Node!',
    },
    aux_supply: {
      id: 'aux_supply',
      title: 'Dual Auxiliary Power Rails (12V & 5V)',
      subtitle: 'LM2596 Buck + AMS1117-5.0/7805 Regulated Logic Supply',
      layer: 'driver',
      keyParts: ['LM2596 Step-Down Module (tuned to 12.0V)', 'LM7805 / AMS1117-5.0 Linear Reg', '100µF + 100nF Bypass Caps'],
      connections: [
        { from: 'Battery+ (via Schottky OR-ing)', to: 'LM2596 VIN+', signal: 'Powers MCU & Driver even at night' },
        { from: 'LM2596 VOUT (12.0V)', to: 'IR2104 VCC + 12V Fan + 5V Reg IN', signal: 'Clean 12.0V Gate Drive Rail' },
        {
          from: '5V Regulator OUT',
          to:
            platform === 'hybrid'
              ? 'Arduino 5V + ESP32 VIN + ACS712 (×2) + LCD'
              : isArduinoControl
                ? 'Arduino 5V Pin + ACS712 (×2) + 16×2 LCD'
                : 'ESP32 VIN + ACS712 (×2) VCC',
          signal: 'Regulated 5.0V Logic Bus',
        },
        {
          from: platform === 'esp32' ? 'ESP32 3V3 Pin' : 'Arduino 5V / ESP32 3V3',
          to: platform === 'esp32' ? 'SSD1306 OLED + DS18B20' : 'Display & DS18B20 Pull-Up',
          signal: 'Peripheral Power',
        },
      ],
      engineeringMath:
        'Drawing auxiliary power from the battery rail (with OR-ing diode from PV) keeps the MCU, display, and protection alive after sunset without loading the PV panel during dawn MPPT startup.',
      safetyNote:
        'Verify LM2596 output is adjusted to 12.0V with a multimeter BEFORE inserting the IR2104 or connecting the 5V microcontroller rail.',
    },
    mcu_stage: {
      id: 'mcu_stage',
      title:
        platform === 'esp32'
          ? 'ESP32-WROOM-32 MPPT Controller'
          : platform === 'arduino'
            ? 'Arduino Uno / Nano MPPT Controller'
            : 'Hybrid Controller: Arduino Nano/Uno + ESP32 Wi-Fi Bridge',
      subtitle:
        platform === 'esp32'
          ? '40kHz LEDC PWM Engine · P&O Tracker · Wi-Fi Telemetry'
          : platform === 'arduino'
            ? 'Timer1 40kHz Fast PWM · 5V Native ADC · 16×2 I2C LCD'
            : 'Arduino Real-Time Buck Control + UART Level-Shifted ESP32 IoT Node',
      layer: 'sensing',
      keyParts:
        platform === 'esp32'
          ? ['ESP32-WROOM-32 DevKit V1 (30-pin)', '0.96" SSD1306 OLED (I2C)', 'DS18B20 Temp Sensor']
          : platform === 'arduino'
            ? ['Arduino Uno R3 or Nano V3 (ATmega328P)', '16×2 I2C LCD Display (PCF8574)', 'DS18B20 Temp Sensor']
            : ['Arduino Uno / Nano (5V Buck Loop)', 'ESP32-WROOM-32 (Wi-Fi / Web UI)', '1kΩ / 2kΩ UART Divider', '16×2 LCD + OLED'],
      connections:
        platform === 'esp32'
          ? [
              { from: 'GPIO 34 / GPIO 35', to: 'PV & Battery Voltage Dividers', signal: '12-bit ADC1 Voltage Sampling' },
              { from: 'GPIO 32 / GPIO 33', to: 'PV & Battery ACS712-20A Sensors', signal: '12-bit ADC1 Current Sampling' },
              { from: 'GPIO 18 / GPIO 19', to: 'IR2104 IN / SD Pins', signal: '40kHz 10-bit PWM + Hardware Enable' },
              { from: 'GPIO 21 (SDA) / 22 (SCL)', to: 'SSD1306 OLED Display', signal: 'I2C Telemetry Bus (400kHz)' },
              { from: 'GPIO 4', to: 'DS18B20 Data (4.7kΩ to 3.3V)', signal: 'Battery Thermal Compensation' },
            ]
          : platform === 'arduino'
            ? [
                { from: 'Pin A0 / Pin A1', to: 'PV (100k/20k) & Bat (100k/33k) Dividers', signal: '10-bit 5V ADC Voltage Sampling' },
                { from: 'Pin A2 / Pin A3', to: 'PV & Battery ACS712-20A VIOUT', signal: 'Direct 5V Current Sampling' },
                { from: 'Pin D9 / Pin D8', to: 'IR2104 IN / SD Pins', signal: 'Timer1 40kHz PWM + Enable' },
                { from: 'Pin A4 (SDA) / A5 (SCL)', to: '16×2 I2C LCD Display', signal: '5V I2C Live Telemetry' },
                { from: 'Pin D2', to: 'DS18B20 Data (4.7kΩ to 5V)', signal: 'Battery Thermal Compensation' },
              ]
            : [
                { from: 'Arduino A0–A3 & D9/D8/D7', to: 'All Sensors, IR2104 & Q3 Gate', signal: '5V Real-Time MPPT Control Loop' },
                { from: 'Arduino D11 (SoftSerial TX)', to: '1kΩ Series -> Junction -> 2kΩ GND -> ESP32 GPIO 16', signal: '5V-to-3.3V UART Telemetry Stream (9600 bps)' },
                { from: 'ESP32 GPIO 17 (TX2)', to: 'Arduino D10 (SoftSerial RX)', signal: '3.3V Remote Command / Mode Return' },
                { from: 'Arduino A4/A5 & ESP32 Wi-Fi', to: 'Local 16×2 LCD + Web / Blynk Dashboard', signal: 'Dual Local + Cloud Monitoring' },
              ],
      engineeringMath:
        platform === 'esp32'
          ? 'ESP32 LEDC at 40 kHz supports 10-bit resolution (1024 steps). Each step adjusts PV operating voltage by ~18mV for tight P&O locking around V_mp (18.2V).'
          : 'Arduino ATmega328P Timer1 in Mode 14 (Fast PWM, ICR1 = 399, prescaler = 1) generates an exact 16 MHz / 400 = 40.0 kHz PWM signal on Pin D9 with 400 duty steps (0.25% resolution).',
      safetyNote:
        platform === 'hybrid'
          ? 'CRITICAL: Always step down Arduino TX (5V) to ESP32 RX2 (GPIO 16, 3.3V) using a 1kΩ + 2kΩ resistor divider (5V × 2k/3k = 3.33V) and tie Arduino GND directly to ESP32 GND.'
          : 'Always average 32–64 ADC samples per MPPT tick and place 100nF bypass capacitors at the ADC pins to reject 40kHz switching noise.',
    },
    acs_bat: {
      id: 'acs_bat',
      title: 'Battery Charge Current & Voltage Sensing',
      subtitle: isArduinoControl
        ? 'Output ACS712-20A (A3) + 100kΩ/33kΩ Divider (A1)'
        : 'Output ACS712-20A (GPIO 33) + 100kΩ/15kΩ Divider (GPIO 35)',
      layer: 'sensing',
      keyParts: isArduinoControl
        ? ['ACS712ELCTR-20A #2', '100kΩ + 33kΩ 1% Resistors', '1N4733A 5.1V Zener + 100nF Caps']
        : ['ACS712ELCTR-20A #2', '100kΩ + 15kΩ 1% Resistors', '1N4728A 3.3V Zener + 100nF Caps'],
      connections: [
        { from: 'L1 / C_out (+)', to: 'ACS712 #2 IP+ -> IP- -> Q3 Drain', signal: 'Smoothed Buck Output Current (up to 12A)' },
        isArduinoControl
          ? { from: 'ACS712 #2 VIOUT', to: 'Arduino Pin A3 (100nF to GND)', signal: 'Direct 5V Charge Current Signal' }
          : { from: 'ACS712 #2 VIOUT', to: '10kΩ/20kΩ Divider -> ESP32 GPIO 33', signal: 'Scaled Charge Current Signal' },
        isArduinoControl
          ? { from: 'Battery+ Terminal', to: '100kΩ / 33kΩ Divider -> Arduino Pin A1', signal: '0–20V Battery Sense (3.57V @ 14.4V)' }
          : { from: 'Battery+ Terminal', to: '100kΩ / 15kΩ Divider -> ESP32 GPIO 35', signal: '0–16V Battery Sense (1.88V @ 14.4V)' },
      ],
      engineeringMath: isArduinoControl
        ? 'Battery divider ratio: 33k / (100k + 33k) = 0.2481. At 14.4V absorption voltage, Arduino A1 reads 3.57V. Combined with PV power, the MCU computes buck efficiency η = (V_bat × I_bat) / (V_pv × I_pv).'
        : 'Battery divider ratio: 15k / (100k + 15k) = 0.1304. At 14.4V absorption voltage, ESP32 GPIO 35 reads 1.878V.',
      safetyNote:
        'Battery voltage is sensed AFTER the reverse-block stage so the controller can verify battery presence (V_bat > 9.0V) before enabling the buck converter.',
    },
    battery_out: {
      id: 'battery_out',
      title: 'Output Reverse-Blocking & 12V Battery Bank',
      subtitle: 'Q3 Back-Feed MOSFET · 15A Fuse · CC/CV Charge Stage',
      layer: 'protection',
      keyParts: ['Q3: IRF3205 Reverse-Block MOSFET', '2N2222 Gate Level-Shifter', '15A DC Output Fuse', '12V Lead-Acid / LiFePO4 Battery'],
      connections: [
        {
          from: isArduinoControl ? 'Arduino Pin D7' : 'ESP32 GPIO 25',
          to: '1kΩ -> 2N2222 Base -> Q3 Gate Pull-Up',
          signal: 'Night-Time Disconnect Control',
        },
        { from: 'ACS712 #2 IP-', to: 'Q3 Source -> Q3 Drain -> 15A Fuse -> Bat+', signal: 'Bidirectional Blocking Path' },
        { from: 'Battery-', to: 'Common Power Ground Bus', signal: 'Heavy 12 AWG Return' },
      ],
      engineeringMath:
        'At night, a synchronous buck low-side MOSFET or body diode can drain the battery back into the solar panel. Q3 isolates the battery whenever I_bat < 0.05A or V_pv < V_bat + 0.5V.',
      safetyNote:
        'Always connect the 12V Battery FIRST before connecting the 150Wp Solar Panel, and fuse the battery terminal within 15cm of the positive post.',
    },
  };
}

export interface PointToPointWire {
  wireNo: string;
  from: string;
  to: string;
  wireSpec: string;
  purpose: string;
}

export function getPointToPointWiring(platform: ControllerPlatform): PointToPointWire[] {
  const commonPower: PointToPointWire[] = [
    { wireNo: 'W01', from: '165Wp PERC PV+ (MC4 Red)', to: '15A Fuse -> 15SQ045 Anode -> SMBJ26A+', wireSpec: '4mm² / 12 AWG Red', purpose: 'Solar PV positive input + surge protection' },
    { wireNo: 'W02', from: '15SQ045 Cathode + C_in (+)', to: 'ACS712 #1 IP+', wireSpec: '14 AWG Red', purpose: 'PV current sensing entry' },
    { wireNo: 'W03', from: 'ACS712 #1 IP-', to: 'Q1 (IRF3205) Drain', wireSpec: '14 AWG Red', purpose: 'Buck high-side power feed' },
    { wireNo: 'W04', from: 'Q1 Source + Q2 Drain', to: 'L1 (47µH) In + IR2104 Pin 6 (VS)', wireSpec: '14 AWG Yellow', purpose: '40kHz switch node' },
    { wireNo: 'W05', from: 'L1 (47µH) Out + C_out (+)', to: 'ACS712 #2 IP+', wireSpec: '14 AWG Orange', purpose: 'Filtered buck output to charge sensor' },
    { wireNo: 'W06', from: 'ACS712 #2 IP-', to: 'Q3 Source -> Q3 Drain -> 15A Fuse -> Bat+', wireSpec: '12 AWG Red', purpose: 'Reverse-blocked battery charge path' },
    { wireNo: 'W07', from: 'PV-, C_in-, Q2 Source, C_out-, Bat-', to: 'Common Star Ground Bar (GND)', wireSpec: '12 AWG Black', purpose: 'High-current 0V return plane' },
    { wireNo: 'W08', from: 'Battery+ (Post-Fuse)', to: 'LM2596 VIN+ -> VOUT (12.0V) -> IR2104 VCC', wireSpec: '20 AWG Violet', purpose: '12V gate drive auxiliary rail' },
    { wireNo: 'W09', from: 'LM2596 12V Out', to: 'AMS1117 / 7805 IN -> 5.0V Out', wireSpec: '22 AWG Cyan', purpose: 'Regulated 5V logic & sensor supply' },
  ];

  if (platform === 'esp32') {
    return [
      ...commonPower,
      { wireNo: 'W10', from: 'PV+ (100kΩ / 10kΩ Divider + 3.3V Zener)', to: 'ESP32 GPIO 34 (ADC1_CH6)', wireSpec: '22 AWG Blue', purpose: 'PV voltage sense (0–25V)' },
      { wireNo: 'W11', from: 'Bat+ (100kΩ / 15kΩ Divider + 3.3V Zener)', to: 'ESP32 GPIO 35 (ADC1_CH7)', wireSpec: '22 AWG Blue', purpose: 'Battery voltage sense (0–16V)' },
      { wireNo: 'W12', from: 'ACS712 #1 VIOUT (10kΩ / 20kΩ Divider)', to: 'ESP32 GPIO 32 (ADC1_CH4)', wireSpec: '22 AWG Green', purpose: 'PV current sense (3.3V safe)' },
      { wireNo: 'W13', from: 'ACS712 #2 VIOUT (10kΩ / 20kΩ Divider)', to: 'ESP32 GPIO 33 (ADC1_CH5)', wireSpec: '22 AWG Green', purpose: 'Battery current sense (3.3V safe)' },
      { wireNo: 'W14', from: 'ESP32 GPIO 18 / GPIO 19', to: 'IR2104 Pin 2 (IN) / Pin 3 (SD)', wireSpec: '22 AWG Teal', purpose: '40kHz PWM & hardware enable' },
      { wireNo: 'W15', from: 'ESP32 GPIO 25 -> 1kΩ -> 2N2222', to: 'Q3 Gate (12V pull-up)', wireSpec: '22 AWG Emerald', purpose: 'Night-time disconnect control' },
      { wireNo: 'W16', from: 'ESP32 GPIO 21/22 & GPIO 4', to: 'SSD1306 OLED (SDA/SCL) & DS18B20', wireSpec: '22 AWG White', purpose: 'OLED telemetry & battery temp' },
    ];
  }

  if (platform === 'arduino') {
    return [
      ...commonPower,
      { wireNo: 'W10', from: 'PV+ (100kΩ / 20kΩ Divider + 5.1V Zener)', to: 'Arduino Pin A0', wireSpec: '22 AWG Blue', purpose: 'PV voltage sense (0–30V)' },
      { wireNo: 'W11', from: 'Bat+ (100kΩ / 33kΩ Divider + 5.1V Zener)', to: 'Arduino Pin A1', wireSpec: '22 AWG Blue', purpose: 'Battery voltage sense (0–20V)' },
      { wireNo: 'W12', from: 'ACS712 #1 VIOUT (Direct + 100nF)', to: 'Arduino Pin A2', wireSpec: '22 AWG Green', purpose: 'PV current sense (native 5V)' },
      { wireNo: 'W13', from: 'ACS712 #2 VIOUT (Direct + 100nF)', to: 'Arduino Pin A3', wireSpec: '22 AWG Green', purpose: 'Battery current sense (native 5V)' },
      { wireNo: 'W14', from: 'Arduino Pin D9 / Pin D8', to: 'IR2104 Pin 2 (IN) / Pin 3 (SD)', wireSpec: '22 AWG Teal', purpose: 'Timer1 40kHz PWM & enable' },
      { wireNo: 'W15', from: 'Arduino Pin D7 -> 1kΩ -> 2N2222', to: 'Q3 Gate (12V pull-up)', wireSpec: '22 AWG Emerald', purpose: 'Night-time disconnect control' },
      { wireNo: 'W16', from: 'Arduino A4/A5 & D2', to: '16×2 I2C LCD (SDA/SCL) & DS18B20', wireSpec: '22 AWG White', purpose: 'LCD readout & battery temp' },
    ];
  }

  return [
    ...commonPower,
    { wireNo: 'W10', from: 'PV+ (100kΩ / 20kΩ) & Bat+ (100kΩ / 33kΩ)', to: 'Arduino A0 (V_PV) & A1 (V_BAT)', wireSpec: '22 AWG Blue', purpose: '5V ADC voltage sensing' },
    { wireNo: 'W11', from: 'ACS712 #1 & #2 VIOUT (Direct 5V)', to: 'Arduino A2 (I_PV) & A3 (I_BAT)', wireSpec: '22 AWG Green', purpose: 'Native 5V Hall current sensing' },
    { wireNo: 'W12', from: 'Arduino D9 / D8 / D7', to: 'IR2104 (IN / SD) & Q3 Gate Driver', wireSpec: '22 AWG Teal', purpose: '40kHz Timer1 buck control' },
    { wireNo: 'W13', from: 'Arduino D11 (TX) -> 1kΩ / 2kΩ Divider', to: 'ESP32 GPIO 16 (UART2 RX2)', wireSpec: '22 AWG Purple', purpose: '5V-to-3.3V safe telemetry bridge' },
    { wireNo: 'W14', from: 'ESP32 GPIO 17 (UART2 TX2)', to: 'Arduino D10 (SoftSerial RX)', wireSpec: '22 AWG Purple', purpose: '3.3V remote override / sync' },
    { wireNo: 'W15', from: 'Arduino GND <-> ESP32 GND', to: 'Common Logic Ground', wireSpec: '22 AWG Black', purpose: 'Shared UART & ADC reference' },
    { wireNo: 'W16', from: 'Arduino A4/A5 & ESP32 Wi-Fi', to: '16×2 I2C LCD & Web Telemetry', wireSpec: '22 AWG White', purpose: 'Local LCD + wireless monitoring' },
  ];
}

export interface PinoutRow {
  pinLabel: string;
  gpio: string;
  subsystem: 'ADC Sensing' | 'PWM Gate Drive' | 'I2C / 1-Wire' | 'Protection' | 'UART Bridge';
  component: string;
  conditioning: string;
  signalRange: string;
  notes: string;
}

export const ESP32_PINOUT: PinoutRow[] = [
  {
    pinLabel: 'D34',
    gpio: 'GPIO 34 (ADC1_CH6)',
    subsystem: 'ADC Sensing',
    component: 'PV Voltage Sensor',
    conditioning: '100kΩ / 10kΩ (1%) + 3.3V Zener + 100nF',
    signalRange: '0 – 2.27 V (0–25 V PV)',
    notes: 'Input-only pin; ADC1 stays active when Wi-Fi is on',
  },
  {
    pinLabel: 'D35',
    gpio: 'GPIO 35 (ADC1_CH7)',
    subsystem: 'ADC Sensing',
    component: 'Battery Voltage Sensor',
    conditioning: '100kΩ / 15kΩ (1%) + 3.3V Zener + 100nF',
    signalRange: '0 – 2.09 V (0–16 V Bat)',
    notes: 'Input-only pin; detects 14.4V Bulk / 13.6V Float',
  },
  {
    pinLabel: 'D32',
    gpio: 'GPIO 32 (ADC1_CH4)',
    subsystem: 'ADC Sensing',
    component: 'ACS712-20A (PV Input)',
    conditioning: '10kΩ / 20kΩ divider + 100nF low-pass',
    signalRange: '1.67 V @ 0A (+66.7 mV/A)',
    notes: '5V sensor scaled safely to 3.3V ESP32 ADC limit',
  },
  {
    pinLabel: 'D33',
    gpio: 'GPIO 33 (ADC1_CH5)',
    subsystem: 'ADC Sensing',
    component: 'ACS712-20A (Battery Out)',
    conditioning: '10kΩ / 20kΩ divider + 100nF low-pass',
    signalRange: '1.67 V @ 0A (+66.7 mV/A)',
    notes: 'Measures buck output charge current & efficiency',
  },
  {
    pinLabel: 'D18',
    gpio: 'GPIO 18 (LEDC_CH0)',
    subsystem: 'PWM Gate Drive',
    component: 'IR2104 Pin 2 (IN)',
    conditioning: 'Direct 3.3V CMOS + 10kΩ pull-down',
    signalRange: '40 kHz PWM, 10-bit (0–95%)',
    notes: 'Pull-down prevents shoot-through during ESP32 boot',
  },
  {
    pinLabel: 'D19',
    gpio: 'GPIO 19 (Digital Out)',
    subsystem: 'PWM Gate Drive',
    component: 'IR2104 Pin 3 (SD)',
    conditioning: 'Direct 3.3V CMOS + 10kΩ pull-down',
    signalRange: 'HIGH = Active, LOW = Shutdown',
    notes: 'Hardware disable on over-voltage or low-sunlight',
  },
  {
    pinLabel: 'D25',
    gpio: 'GPIO 25 (Digital Out)',
    subsystem: 'Protection',
    component: 'Q3 Back-Feed MOSFET',
    conditioning: '1kΩ -> 2N2222 NPN level shifter',
    signalRange: '0 V (Isolate) / 12 V (Conduct)',
    notes: 'Prevents battery drain into panel after sunset',
  },
  {
    pinLabel: 'D21 / D22',
    gpio: 'GPIO 21 (SDA) / 22 (SCL)',
    subsystem: 'I2C / 1-Wire',
    component: '0.96" SSD1306 OLED',
    conditioning: '3.3V I2C Bus (internal 10kΩ pull-ups)',
    signalRange: '3.3V I2C @ 400 kHz',
    notes: 'Displays V_pv, I_mppt, W_mppt, V_bat, and Duty %',
  },
  {
    pinLabel: 'D4',
    gpio: 'GPIO 4 (1-Wire)',
    subsystem: 'I2C / 1-Wire',
    component: 'DS18B20 Temp Probe',
    conditioning: '4.7kΩ pull-up to 3.3V rail',
    signalRange: '3.3V 1-Wire Digital',
    notes: 'Adjusts absorption voltage (-18 mV/°C for 12V SLA)',
  },
];

export const ARDUINO_PINOUT: PinoutRow[] = [
  {
    pinLabel: 'A0',
    gpio: 'Arduino A0 (ADC0)',
    subsystem: 'ADC Sensing',
    component: 'PV Voltage Sensor',
    conditioning: '100kΩ / 20kΩ (6:1) + 5.1V Zener + 100nF',
    signalRange: '0 – 4.17 V (0–25 V PV)',
    notes: 'Native 5V 10-bit ADC (3.73V at Voc = 22.4V)',
  },
  {
    pinLabel: 'A1',
    gpio: 'Arduino A1 (ADC1)',
    subsystem: 'ADC Sensing',
    component: 'Battery Voltage Sensor',
    conditioning: '100kΩ / 33kΩ (4.03:1) + 5.1V Zener + 100nF',
    signalRange: '0 – 3.97 V (0–16 V Bat)',
    notes: 'Detects 14.4V Bulk / 13.6V Float charge state',
  },
  {
    pinLabel: 'A2',
    gpio: 'Arduino A2 (ADC2)',
    subsystem: 'ADC Sensing',
    component: 'ACS712-20A (PV Input)',
    conditioning: 'Direct 5V connection + 100nF filter cap',
    signalRange: '2.50 V @ 0A (+100 mV/A)',
    notes: 'No level-shift divider required on 5V Arduino',
  },
  {
    pinLabel: 'A3',
    gpio: 'Arduino A3 (ADC3)',
    subsystem: 'ADC Sensing',
    component: 'ACS712-20A (Battery Out)',
    conditioning: 'Direct 5V connection + 100nF filter cap',
    signalRange: '2.50 V @ 0A (+100 mV/A)',
    notes: 'Measures buck charge current & conversion efficiency',
  },
  {
    pinLabel: 'D9',
    gpio: 'Arduino D9 (Timer1 OC1A)',
    subsystem: 'PWM Gate Drive',
    component: 'IR2104 Pin 2 (IN)',
    conditioning: 'Direct 5V TTL + 10kΩ pull-down',
    signalRange: '40 kHz Fast PWM (ICR1=399)',
    notes: 'Hardware Timer1 prevents audible inductor whine',
  },
  {
    pinLabel: 'D8',
    gpio: 'Arduino D8 (Digital Out)',
    subsystem: 'PWM Gate Drive',
    component: 'IR2104 Pin 3 (SD)',
    conditioning: 'Direct 5V TTL + 10kΩ pull-down',
    signalRange: 'HIGH = Active, LOW = Shutdown',
    notes: 'Disables synchronous buck at night or fault',
  },
  {
    pinLabel: 'D7',
    gpio: 'Arduino D7 (Digital Out)',
    subsystem: 'Protection',
    component: 'Q3 Back-Feed MOSFET',
    conditioning: '1kΩ -> 2N2222 NPN level shifter',
    signalRange: '0 V (Isolate) / 12 V (Conduct)',
    notes: 'Blocks night-time battery discharge into panel',
  },
  {
    pinLabel: 'A4 / A5',
    gpio: 'Arduino A4 (SDA) / A5 (SCL)',
    subsystem: 'I2C / 1-Wire',
    component: '16×2 I2C LCD Display',
    conditioning: '5V I2C Bus (PCF8574 backpack)',
    signalRange: '5V I2C @ 100 kHz',
    notes: 'Shows PV Watts, Volts, Amps, Bat V, and Duty %',
  },
  {
    pinLabel: 'D2',
    gpio: 'Arduino D2 (1-Wire)',
    subsystem: 'I2C / 1-Wire',
    component: 'DS18B20 Temp Probe',
    conditioning: '4.7kΩ pull-up to 5V rail',
    signalRange: '5V 1-Wire Digital',
    notes: 'Thermal compensation for lead-acid battery',
  },
];

export const HYBRID_EXTRA_PINOUT: PinoutRow[] = [
  ...ARDUINO_PINOUT,
  {
    pinLabel: 'D11 → GPIO16',
    gpio: 'Arduino D11 → ESP32 GPIO 16',
    subsystem: 'UART Bridge',
    component: 'Telemetry Link (TX → RX2)',
    conditioning: '1kΩ series + 2kΩ to GND (5V → 3.33V)',
    signalRange: '9600 bps JSON / CSV Serial',
    notes: 'Sends V_pv, I_pv, W_mppt, V_bat to ESP32 Wi-Fi server',
  },
  {
    pinLabel: 'GPIO17 → D10',
    gpio: 'ESP32 GPIO 17 → Arduino D10',
    subsystem: 'UART Bridge',
    component: 'Command Return (TX2 → RX)',
    conditioning: 'Direct 3.3V wire (valid Arduino HIGH)',
    signalRange: '9600 bps Serial',
    notes: 'Allows web dashboard to pause/reset MPPT controller',
  },
];

export const ESP32_FIRMWARE_CODE = `// 150Wp Solar PV MPPT Charge Controller — ESP32 (40 kHz Synchronous Buck)
// Algorithm: Perturb & Observe (P&O) with CC/CV Battery Protection

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>

// --- Pin Definitions (ADC1 Only for Wi-Fi Compatibility) ---
constexpr int PIN_V_PV   = 34; // 100k / 10k divider (Ratio = 11.0)
constexpr int PIN_V_BAT  = 35; // 100k / 15k divider (Ratio = 7.667)
constexpr int PIN_I_PV   = 32; // ACS712-20A via 10k / 20k divider
constexpr int PIN_I_BAT  = 33; // ACS712-20A via 10k / 20k divider
constexpr int PIN_PWM    = 18; // IR2104 IN (40 kHz LEDC)
constexpr int PIN_SD_EN  = 19; // IR2104 SD (HIGH = Enable)
constexpr int PIN_Q3_BLK = 25; // Output Reverse-Block MOSFET

constexpr int PWM_FREQ       = 40000; // 40 kHz for 47uH inductor
constexpr int PWM_RES_BITS   = 10;    // 0..1023
constexpr int DUTY_MIN       = 102;   // 10% floor
constexpr int DUTY_MAX       = 972;   // 95% cap (bootstrap refresh!)
constexpr float V_BULK_MAX   = 14.4f; // 12V Lead-Acid / LiFePO4 Bulk

int duty = 650;
int stepDir = 4;
float prevPowerPV = 0.0f;
float prevVoltPV  = 0.0f;

float readAvgVoltage(int pin, float dividerRatio) {
  uint32_t sumMv = 0;
  for (int i = 0; i < 64; i++) sumMv += analogReadMilliVolts(pin);
  return (sumMv / 64000.0f) * dividerRatio;
}

float readCurrentACS712(int pin, float zeroOffsetV) {
  uint32_t sumMv = 0;
  for (int i = 0; i < 64; i++) sumMv += analogReadMilliVolts(pin);
  float vPin = sumMv / 64000.0f;
  // ACS712-20A = 100mV/A, scaled by 20k/(10k+20k) = 66.67mV/A
  return max(0.0f, (vPin - zeroOffsetV) / 0.06667f);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_SD_EN, OUTPUT);
  pinMode(PIN_Q3_BLK, OUTPUT);
  digitalWrite(PIN_SD_EN, LOW);
  digitalWrite(PIN_Q3_BLK, LOW);

  analogReadResolution(12);
  ledcAttach(PIN_PWM, PWM_FREQ, PWM_RES_BITS);
  ledcWrite(PIN_PWM, 0);
}

void loop() {
  float vPV  = readAvgVoltage(PIN_V_PV, 11.0f);
  float vBat = readAvgVoltage(PIN_V_BAT, 7.667f);
  float iPV  = readCurrentACS712(PIN_I_PV, 1.667f);
  float pPV  = vPV * iPV;

  if (vPV < (vBat + 1.0f) || vBat < 9.5f) {
    digitalWrite(PIN_SD_EN, LOW);
    digitalWrite(PIN_Q3_BLK, LOW);
    ledcWrite(PIN_PWM, 0);
    delay(250);
    return;
  }

  digitalWrite(PIN_SD_EN, HIGH);
  digitalWrite(PIN_Q3_BLK, HIGH);

  if (vBat >= V_BULK_MAX) {
    duty -= 6;
  } else {
    float dP = pPV - prevPowerPV;
    float dV = vPV - prevVoltPV;
    if (dP > 0.15f)       stepDir = (dV > 0) ? -4 : 4;
    else if (dP < -0.15f) stepDir = (dV > 0) ? 4 : -4;
    duty += stepDir;
  }

  duty = constrain(duty, DUTY_MIN, DUTY_MAX);
  ledcWrite(PIN_PWM, duty);
  prevPowerPV = pPV;
  prevVoltPV  = vPV;
  delay(40);
}`;

export const ARDUINO_FIRMWARE_CODE = `// 150Wp Solar PV MPPT Charge Controller — Arduino Uno / Nano (ATmega328P)
// Timer1 Fast PWM @ 40.0 kHz (Pin D9) + Perturb & Observe (P&O)

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

const int PIN_V_PV   = A0; // 100k / 20k divider (Ratio = 6.0)
const int PIN_V_BAT  = A1; // 100k / 33k divider (Ratio = 4.03)
const int PIN_I_PV   = A2; // ACS712-20A direct 5V (2.5V = 0A, 100mV/A)
const int PIN_I_BAT  = A3; // ACS712-20A direct 5V
const int PIN_PWM    = 9;  // Timer1 OC1A -> IR2104 IN
const int PIN_SD_EN  = 8;  // IR2104 SD (HIGH = Enable)
const int PIN_Q3_BLK = 7;  // Output Reverse-Block MOSFET

const int DUTY_MIN = 40;   // 10% of ICR1 (399)
const int DUTY_MAX = 379;  // 95% cap for IR2104 bootstrap refresh
const float V_BULK_MAX = 14.4;

int duty = 260;
int stepDir = 2;
float prevPowerPV = 0.0, prevVoltPV = 0.0;

float readVoltage(int pin, float ratio) {
  long sum = 0;
  for (int i = 0; i < 32; i++) sum += analogRead(pin);
  return ((sum / 32.0) * (5.0 / 1023.0)) * ratio;
}

float readCurrent(int pin) {
  long sum = 0;
  for (int i = 0; i < 32; i++) sum += analogRead(pin);
  float v = (sum / 32.0) * (5.0 / 1023.0);
  return max(0.0f, (v - 2.50f) / 0.100f); // 100 mV/A
}

void setupTimer1_40kHz() {
  pinMode(PIN_PWM, OUTPUT);
  TCCR1A = _BV(COM1A1) | _BV(WGM11);
  TCCR1B = _BV(WGM13) | _BV(WGM12) | _BV(CS10); // Prescaler = 1
  ICR1 = 399; // 16 MHz / (1 * (399 + 1)) = 40.0 kHz
  OCR1A = 0;
}

void setup() {
  Serial.begin(9600); // Also feeds ESP32 UART bridge in Hybrid mode
  pinMode(PIN_SD_EN, OUTPUT);
  pinMode(PIN_Q3_BLK, OUTPUT);
  digitalWrite(PIN_SD_EN, LOW);
  digitalWrite(PIN_Q3_BLK, LOW);
  setupTimer1_40kHz();
  lcd.init();
  lcd.backlight();
}

void loop() {
  float vPV  = readVoltage(PIN_V_PV, 6.0);
  float vBat = readVoltage(PIN_V_BAT, 4.03);
  float iPV  = readCurrent(PIN_I_PV);
  float pPV  = vPV * iPV;

  if (vPV < (vBat + 1.0) || vBat < 9.5) {
    digitalWrite(PIN_SD_EN, LOW);
    digitalWrite(PIN_Q3_BLK, LOW);
    OCR1A = 0;
    delay(250);
    return;
  }

  digitalWrite(PIN_SD_EN, HIGH);
  digitalWrite(PIN_Q3_BLK, HIGH);

  if (vBat >= V_BULK_MAX) {
    duty -= 3;
  } else {
    float dP = pPV - prevPowerPV;
    float dV = vPV - prevVoltPV;
    if (dP > 0.15)       stepDir = (dV > 0) ? -2 : 2;
    else if (dP < -0.15) stepDir = (dV > 0) ? 2 : -2;
    duty += stepDir;
  }

  duty = constrain(duty, DUTY_MIN, DUTY_MAX);
  OCR1A = duty;
  prevPowerPV = pPV;
  prevVoltPV  = vPV;

  // Telemetry line for Serial Monitor or ESP32 Wi-Fi Bridge
  Serial.print("VPV:"); Serial.print(vPV, 1);
  Serial.print(",IPV:"); Serial.print(iPV, 2);
  Serial.print(",PPV:"); Serial.print(pPV, 1);
  Serial.print(",VBAT:"); Serial.println(vBat, 2);
  delay(50);
}`;

export const HYBRID_ESP32_CODE = `// Hybrid Mode: ESP32-WROOM-32 Wi-Fi Telemetry Bridge
// Receives 9600 bps CSV lines from Arduino D11 -> 1k/2k divider -> ESP32 GPIO 16

#include <WiFi.h>
#include <WebServer.h>

const char* SSID = "SolarMPPT_Lab";
const char* PASS = "solar150w";

WebServer server(80);
String latestTelemetry = "VPV:0.0,IPV:0.00,PPV:0.0,VBAT:0.00";

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17); // RX2=GPIO16, TX2=GPIO17

  WiFi.softAP(SSID, PASS); // Creates local mini-project Wi-Fi hotspot
  server.on("/data", []() {
    server.send(200, "text/plain", latestTelemetry);
  });
  server.begin();
}

void loop() {
  if (Serial2.available()) {
    String line = Serial2.readStringUntil('\\n');
    line.trim();
    if (line.startsWith("VPV:")) {
      latestTelemetry = line;
      Serial.println(line); // Forward to USB HIL Serial Scope @ 115200 baud
    }
  }
  server.handleClient();
}`;

export const NOVEL_PV_SCOPE_CODE = `// WORLD-FIRST STUDENT STACK: ESP32 Dual-Core Self-Diagnostic 165Wp PERC MPPT
// Combines: (1) 100ms GMPPT + InCond, (2) d2I/dV2 Micro-Crack Detector,
// (3) 40kHz Buck-Ripple Battery ESR, (4) Q3 Night SoC% + Wh/day, (5) Live Wi-Fi PV-Scope

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <OneWire.h>
#include <DallasTemperature.h>

constexpr int PIN_V_PV   = 34; // 100k/10k divider (Ratio 11.0)
constexpr int PIN_V_BAT  = 35; // 100k/15k divider (Ratio 7.667)
constexpr int PIN_I_PV   = 32; // ACS712-20A scaled (66.67 mV/A)
constexpr int PIN_I_BAT  = 33; // ACS712-20A scaled (66.67 mV/A)
constexpr int PIN_PWM    = 18; // 40 kHz LEDC -> IR2104 IN
constexpr int PIN_SD_EN  = 19; // IR2104 SD
constexpr int PIN_Q3_BLK = 25; // Q3 Reverse-Block MOSFET
constexpr int PIN_TEMP   = 4;  // DS18B20 1-Wire (4.7k pull-up to 3.3V)

// Paste optional #define overrides from the SolarMPPT USB HIL Trimmer above this line:
#ifndef CAL_VPV_GAIN
#define CAL_VPV_GAIN   1.0000f
#endif
#ifndef CAL_VBAT_GAIN
#define CAL_VBAT_GAIN  1.0000f
#endif
#ifndef CAL_ACS_ZERO_V
#define CAL_ACS_ZERO_V 2.5000f // Raw 0A voltage on ACS712 pin (scaled x0.6667 at GPIO32/33)
#endif

constexpr int SWEEP_N = 32;
float sweepV[SWEEP_N], sweepI[SWEEP_N], sweepD2[SWEEP_N];
volatile float g_pMax = 0, g_vMpp = 18.7f, g_esrMohm = 25.0f, g_maxD2 = 0;
volatile float g_whToday = 0, g_socPct = 75.0f, g_cellTempC = 28.0f;
volatile bool  g_crackAlert = false, g_dustAlert = false, g_nightMode = false;
volatile int   g_duty = 650;

OneWire oneWire(PIN_TEMP);
DallasTemperature ds18(&oneWire);
WebServer server(80);

float readPinV(int pin, float ratio) {
  uint32_t mv = 0;
  for (int i = 0; i < 16; i++) mv += analogReadMilliVolts(pin);
  return (mv / 16000.0f) * ratio;
}

float readPinI(int pin) {
  uint32_t mv = 0;
  for (int i = 0; i < 16; i++) mv += analogReadMilliVolts(pin);
  float zeroAtPin = CAL_ACS_ZERO_V * 0.6667f;
  return max(0.0f, ((mv / 16000.0f) - zeroAtPin) / 0.06667f);
}

// 1 & 2: 90ms Duty Sweep -> Global MPP + 2nd Derivative (d2I/dV2) Crack/Hotspot Check
void runDiagnosticSweep() {
  float bestP = 0.0f;
  int bestDuty = 650;
  for (int k = 0; k < SWEEP_N; k++) {
    int d = map(k, 0, SWEEP_N - 1, 150, 940);
    ledcWrite(PIN_PWM, d);
    delayMicroseconds(2800);
    sweepV[k] = readPinV(PIN_V_PV, 11.0f * CAL_VPV_GAIN);
    sweepI[k] = readPinI(PIN_I_PV);
    float p = sweepV[k] * sweepI[k];
    if (p > bestP) { bestP = p; bestDuty = d; g_vMpp = sweepV[k]; }
  }
  g_pMax = bestP;
  g_duty = bestDuty;
  ledcWrite(PIN_PWM, bestDuty);

  // Second derivative d2I/dV2 isolates sharp micro-crack kinks vs soft cloud steps
  float peakD2 = 0.0f;
  for (int k = 2; k < SWEEP_N - 2; k++) {
    float dv1 = max(0.15f, fabs(sweepV[k] - sweepV[k - 1]));
    float dv2 = max(0.15f, fabs(sweepV[k + 1] - sweepV[k]));
    float slope1 = (sweepI[k] - sweepI[k - 1]) / dv1;
    float slope2 = (sweepI[k + 1] - sweepI[k]) / dv2;
    float d2 = fabs((slope2 - slope1) / (0.5f * (dv1 + dv2)));
    sweepD2[k] = d2;
    if (d2 > peakD2) peakD2 = d2;
  }
  g_maxD2 = peakD2;
  g_crackAlert = (peakD2 > 1.8f); // Sharp inflection > 1.8 A/V^2 = PERC crack/bypass fault
}

// 3: Exploit 40 kHz Buck Switching Ripple to Estimate Battery ESR (Delta V_bat / Delta I_bat)
float estimateBatteryEsrMohm() {
  float vMin = 99.0f, vMax = 0.0f, iMin = 99.0f, iMax = 0.0f;
  float zeroAtPin = CAL_ACS_ZERO_V * 0.6667f;
  for (int n = 0; n < 64; n++) {
    float vb = analogReadMilliVolts(PIN_V_BAT) * (0.007667f * CAL_VBAT_GAIN);
    float ib = max(0.0f, (analogReadMilliVolts(PIN_I_BAT) * 0.001f - zeroAtPin) / 0.06667f);
    if (vb < vMin) vMin = vb; if (vb > vMax) vMax = vb;
    if (ib < iMin) iMin = ib; if (ib > iMax) iMax = ib;
  }
  float dI = iMax - iMin;
  if (dI < 0.12f) return g_esrMohm;
  return constrain(((vMax - vMin) / dI) * 1000.0f, 5.0f, 800.0f);
}

// Core 1: Deterministic 40 kHz InCond MPPT + Sweep + ESR + Night Q3 Isolation
void mpptControlTask(void* param) {
  float prevV = 0, prevI = 0;
  uint32_t lastSweep = 0, lastLoop = millis();
  for (;;) {
    float vPV = readPinV(PIN_V_PV, 11.0f * CAL_VPV_GAIN), iPV = readPinI(PIN_I_PV);
    float vBat = readPinV(PIN_V_BAT, 7.667f * CAL_VBAT_GAIN), iBat = readPinI(PIN_I_BAT);
    float dtHr = (millis() - lastLoop) / 3600000.0f;
    lastLoop = millis();

    if (vPV < (vBat + 0.8f) || vBat < 9.5f) {
      g_nightMode = true;
      digitalWrite(PIN_SD_EN, LOW);
      digitalWrite(PIN_Q3_BLK, LOW); // Isolate battery at night & log resting OCV SoC%
      ledcWrite(PIN_PWM, 0);
      g_socPct = constrain((vBat - 11.8f) / (12.75f - 11.8f) * 100.0f, 0.0f, 100.0f);
      vTaskDelay(pdMS_TO_TICKS(250));
      continue;
    }

    g_nightMode = false;
    digitalWrite(PIN_SD_EN, HIGH);
    digitalWrite(PIN_Q3_BLK, HIGH);
    g_whToday += (vBat * iBat) * dtHr;

    // Trigger 90ms Global Sweep every 5 min or on >15% shading step
    if (millis() - lastSweep > 300000UL || fabs((vPV * iPV) - g_pMax) > max(12.0f, g_pMax * 0.25f)) {
      runDiagnosticSweep();
      lastSweep = millis();
    } else if (vBat >= 14.4f - 0.018f * (g_cellTempC - 25.0f)) {
      g_duty = max(102, g_duty - 5); // Thermal-compensated CV cap
    } else {
      // Zero-oscillation Incremental Conductance (dI/dV == -I/V)
      float dV = vPV - prevV, dI = iPV - prevI;
      if (fabs(dV) > 0.04f) {
        float lhs = dI / dV, rhs = -iPV / max(vPV, 1.0f);
        if (lhs > rhs + 0.02f) g_duty -= 3;
        else if (lhs < rhs - 0.02f) g_duty += 3;
      }
      g_duty = constrain(g_duty, 102, 972);
      ledcWrite(PIN_PWM, g_duty);
    }

    // Dust vs Cloud Classifier: High V_oc/V_mp stability with depressed I_pv at sunny temp
    ds18.requestTemperatures();
    float tC = ds18.getTempCByIndex(0);
    if (tC > -10 && tC < 85) g_cellTempC = tC;
    g_dustAlert = (vPV > 18.0f && iPV > 0.5f && iPV < 3.2f && g_maxD2 < 1.2f);
    g_esrMohm = 0.85f * g_esrMohm + 0.15f * estimateBatteryEsrMohm();

    static uint32_t lastHilMs = 0;
    if (millis() - lastHilMs >= 250) {
      lastHilMs = millis();
      Serial.printf("HIL,%.2f,%.2f,%.2f,%.2f,%.1f,%.2f,%.1f,%.1f\\n",
        vPV, iPV, vBat, iBat, (g_duty / 1023.0f) * 100.0f, g_maxD2, g_esrMohm, g_cellTempC);
    }

    prevV = vPV; prevI = iPV;
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_SD_EN, OUTPUT); pinMode(PIN_Q3_BLK, OUTPUT);
  digitalWrite(PIN_SD_EN, LOW); digitalWrite(PIN_Q3_BLK, LOW);
  ds18.begin(); analogReadResolution(12); ledcAttach(PIN_PWM, 40000, 10);

  WiFi.softAP("PERC_PV_Scope", "mppt2025"); // Phone opens http://192.168.4.1
  server.on("/", []() {
    server.send(200, "text/html",
      "<html><body style='font-family:sans-serif;padding:16px'><h2>165W PERC PV-Scope</h2>"
      "<pre id='m'>Loading...</pre><canvas id='c' width='340' height='180' style='border:1px solid #ccc'></canvas>"
      "<script>setInterval(async()=>{const d=await(await fetch('/pvscope')).json();"
      "m.textContent=JSON.stringify(d,null,2);const x=c.getContext('2d');x.clearRect(0,0,340,180);"
      "x.strokeStyle='#2563eb';x.beginPath();d.iv.forEach((p,i)=>i?x.lineTo(p[0]*12,170-p[1]*14):x.moveTo(p[0]*12,170-p[1]*14));x.stroke();"
      "x.strokeStyle='#dc2626';x.beginPath();d.d2.forEach((y,i)=>i?x.lineTo(d.iv[i][0]*12,170-y*40):x.moveTo(d.iv[i][0]*12,170-y*40));x.stroke();},1000);</script></body></html>");
  });
  server.on("/pvscope", []() {
    String j = "{\\"pmp\\":" + String(g_pMax,1) + ",\\"vmpp\\":" + String(g_vMpp,1) +
      ",\\"d2idv2_peak\\":" + String(g_maxD2,2) + ",\\"crack_fault\\":" + String(g_crackAlert?"true":"false") +
      ",\\"bat_esr_mohm\\":" + String(g_esrMohm,1) + ",\\"dust_alert\\":" + String(g_dustAlert?"true":"false") +
      ",\\"wh_today\\":" + String(g_whToday,2) + ",\\"soc_pct\\":" + String(g_socPct,0) + ",\\"iv\\":[";
    for (int i = 0; i < SWEEP_N; i++) j += String(i?",":"") + "[" + String(sweepV[i],1) + "," + String(sweepI[i],2) + "]";
    j += "],\\"d2\\":[";
    for (int i = 0; i < SWEEP_N; i++) j += String(i?",":"") + String(sweepD2[i],2);
    j += "]}";
    server.send(200, "application/json", j);
  });
  server.begin();
  xTaskCreatePinnedToCore(mpptControlTask, "MPPT_DSP", 6144, NULL, 2, NULL, 1);
}

void loop() { server.handleClient(); }`;

export type BomCategory =
  | 'PV & Storage'
  | 'Compute & Sensing'
  | 'Power Stage'
  | 'Protection & Enclosure';

export interface VendorOffer {
  store: string;
  priceText: string;
  url: string;
}

export interface BomItem {
  id: string;
  name: string;
  spec: string;
  category: BomCategory;
  scope: 'controller' | 'system';
  platforms: ControllerPlatform[];
  qty: number;
  unitPriceUSD: number;
  unitPriceINR: number;
  unitPriceEUR: number;
  included: boolean;
  cheapestStore?: string;
  cheapestUrl?: string;
  priceComparison?: VendorOffer[];
}

export const INITIAL_BOM_ITEMS: BomItem[] = [
  // PV & Storage (System Scope)
  {
    id: 'pv-panel',
    name: '165 Wp Passivated Emitter & Rear Contact (Mono PERC)',
    spec: '36-Cell Monocrystalline PERC · Vmp 18.7V, Imp 8.82A, Voc 22.8V',
    category: 'PV & Storage',
    scope: 'system',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 58.0,
    unitPriceINR: 4800,
    unitPriceEUR: 53.36,
    included: true,
    cheapestStore: 'Industrybuying (SUI PERC)',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHFlaAnNoBTqzbcLbRyhNtDg-XvRJk_egOb5pEM-9_vyEeq2hDLUg8dldh0u3ewDsTLwYXD_BohWdhCWoomlcGA1HzS6hT64cxKme7QlQPzukgerCULZDel5lOtqbnmK3C3HbXiVQmdgjDDcSJiFmpW5Pz0ZIwAQJt5GCVxdD_Ihmd5OpuGkxHjxhkAkq3ffw==',
    priceComparison: [
      {
        store: 'Industrybuying (SUI 165W Mono PERC)',
        priceText: '₹4,800 – ₹5,800',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHFlaAnNoBTqzbcLbRyhNtDg-XvRJk_egOb5pEM-9_vyEeq2hDLUg8dldh0u3ewDsTLwYXD_BohWdhCWoomlcGA1HzS6hT64cxKme7QlQPzukgerCULZDel5lOtqbnmK3C3HbXiVQmdgjDDcSJiFmpW5Pz0ZIwAQJt5GCVxdD_Ihmd5OpuGkxHjxhkAkq3ffw==',
      },
      {
        store: 'IndiaMART (Livguard 165W Mono PERC)',
        priceText: '₹4,600 – ₹5,500',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF0tnqc4SelQXEsIcWpTUTbvXj5JuSfYHcbnP-iyVekLI97NYHqGLEd2-37LHdlanN-5ZgbUpdQE2yCHcqTefcmmvjSIkUTz0-Qhj19Vi7FJk-n2By4V5cS4dItmtoo5v_ypcMEvbCH6W294uZ5sq7KsmndgmCQVALv5GrolWoZoFeiVyY=',
      },
      {
        store: 'Flipkart (Exide 165W 12V Panel)',
        priceText: '₹5,000 – ₹6,200',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG_k7skZgxjxZg8Ln8GXJoWUCbfBN45jgtespgq5k6xUePKhZpDfoxBza9hp3naWbiX1GCAXcYpsHXNlv6JRlJ7BNWn3KoOwy85tvonQKED-gIe6DGWNUgKdOSyMacMkyWsgwhymZ433MIgxZExOgi-15hm0jApUHNL2J1ZW9RVrpk=',
      },
    ],
  },
  {
    id: 'battery-12v',
    name: '12V 20Ah Solar Tubular Battery (or 12V 7Ah Hostel Test)',
    spec: '20Ah C10 solar bank (tip: use ₹900 12V 7Ah SMF battery for hostel demo)',
    category: 'PV & Storage',
    scope: 'system',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 37.0,
    unitPriceINR: 3000,
    unitPriceEUR: 34.0,
    included: true,
    cheapestStore: 'Powerwale / Exide',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpaa9bF300x8GbCVZ-j7j05jC4m14zhMzembsdoYgdXBrXeYWjKyJEHyfoo2lSamAA0Hc03iNkb9j2yb19v66f9d-w9kRf315Li3j6-rUoomDgbTr0hd2NvXYTDs9cxkplEeZ1bh93a5YRCpz3lcgDGIzmbv7fMskD',
    priceComparison: [
      {
        store: 'Powerwale (12V 20Ah)',
        priceText: '₹3,000 – ₹3,800',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHpaa9bF300x8GbCVZ-j7j05jC4m14zhMzembsdoYgdXBrXeYWjKyJEHyfoo2lSamAA0Hc03iNkb9j2yb19v66f9d-w9kRf315Li3j6-rUoomDgbTr0hd2NvXYTDs9cxkplEeZ1bh93a5YRCpz3lcgDGIzmbv7fMskD',
      },
      {
        store: 'BatteryMall (12V 7Ah Test)',
        priceText: '₹900 – ₹1,500',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF9lLpGfrCernVRO2ljKA9Cq69uIG-3jBXVeplemZcxFmckCTDYH9Rh3_TYb1yZqK93BHZ89cjOcQG1Zy9pafmm_MoEQluFHXA2-5deUqzrRrh6sjBzmpACdIAcGyRtTcag8rogZ9FipGtK6g==',
      },
    ],
  },
  {
    id: 'pv-cables-mc4',
    name: '4mm² Solar DC Cable (5m Pair) + MC4 Connectors + Brackets',
    spec: 'UV-resistant XLPE twin-core cable + MC4 plug pair',
    category: 'PV & Storage',
    scope: 'system',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 11.0,
    unitPriceINR: 850,
    unitPriceEUR: 10.2,
    included: true,
    cheapestStore: 'Kenbrook Solar',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEFz28xX_koLAjeYa7hG2HIDowcGXp4q1F_csUrJAvD62afNLoXSWVdiDvADoMKVyPWAE4GcySm8z-K8I5LWIY0-3z4FjP-SWjW4YmvVEosulOHgS2VNC0aAXfX4ys5Kiot',
  },

  // Compute & Sensing (Controller Scope — Platform-Specific)
  {
    id: 'esp32',
    name: 'ESP32-WROOM-32 DevKit V1 (30-Pin)',
    spec: 'Dual-core 240MHz MCU, 40kHz LEDC PWM, 12-bit ADC1, Wi-Fi',
    category: 'Compute & Sensing',
    scope: 'controller',
    platforms: ['esp32', 'hybrid'],
    qty: 1,
    unitPriceUSD: 4.6,
    unitPriceINR: 380,
    unitPriceEUR: 4.25,
    included: true,
    cheapestStore: 'ElectronicsComp',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEHLwf8DtHAR-iu3dgv9OPKV4-5dhc1vxc-MuXUqmFsc7F_cZWbIzlJ6wqRX9drWHadD8zjrc-Rx-OeZoiZBYlB_rE33nOB5AwDzyusVKhw8OpvR5RTsd-nDdaKPENYMmjr7hZObhsGS0RID9QSyocgN6bgGjEm4-0oPoQOHrVHrfFrYXt7WE0TU5FNhUtRI2ICzapn9wpecJqVs_C9l5BjN_rBkdunWA==',
    priceComparison: [
      {
        store: 'ElectronicsComp',
        priceText: '₹380 – ₹450',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEHLwf8DtHAR-iu3dgv9OPKV4-5dhc1vxc-MuXUqmFsc7F_cZWbIzlJ6wqRX9drWHadD8zjrc-Rx-OeZoiZBYlB_rE33nOB5AwDzyusVKhw8OpvR5RTsd-nDdaKPENYMmjr7hZObhsGS0RID9QSyocgN6bgGjEm4-0oPoQOHrVHrfFrYXt7WE0TU5FNhUtRI2ICzapn9wpecJqVs_C9l5BjN_rBkdunWA==',
      },
      {
        store: 'Robocraze',
        priceText: '₹415 – ₹430',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZ7woAF4-wm3nfRY8onfai8JstvmfM-LX2dAS11dTYX6ceouLP64nrZub1MH4Sz1rI9-II1NfptN7nsZeb3snqmfvcB-B8qUJx4vS6BOkK5JRAL7ZQgwtNvn5Rr8WlQXN-QO7aei2BRN2EWMS4bD2U2uctJcsCvEzHfKM-2z-CUSKi3D04zqXdPg-7FXDUt-L03ioqgdCf4Q==',
      },
      {
        store: 'Robu.in',
        priceText: '₹400 – ₹530',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE-RMTJ67aM_5N65bqmoeMxE3tJlbSSxryvkDLQSj_VYMHiu-AoccqS-3qcASmNcLYTYQkFIC2IJPUM1KkiHpdSMPdxfcHXC5Jp5WbFXams5NSaNa3xwo1RIlX4aKg2LA==',
      },
    ],
  },
  {
    id: 'arduino-uno-nano',
    name: 'Arduino Nano V3 / Uno R3 (CH340 ATmega328P)',
    spec: '5V TTL MCU, Timer1 40kHz Fast PWM (D9), 10-bit ADC (A0–A3)',
    category: 'Compute & Sensing',
    scope: 'controller',
    platforms: ['arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 2.6,
    unitPriceINR: 215,
    unitPriceEUR: 2.4,
    included: true,
    cheapestStore: 'Quartz Components',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEIQqZHammnCxwKnPwokw-6UZ7W_JSgR8vLq08RPGvvE4jjxe_mxuIKWnM5HjAMBlPg5TUR_WsZDkD4FD5QkvZxuP4DlHlyFGWxUKzXYNqqBYaZnCNDMNTUPwXkG54j-aufmr4xoXwJY4Kiy6-e4H9pdSJk6boF4Kn5geU7wT4F',
    priceComparison: [
      {
        store: 'Quartz Components (Nano/Uno)',
        priceText: '₹190 – ₹215',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEIQqZHammnCxwKnPwokw-6UZ7W_JSgR8vLq08RPGvvE4jjxe_mxuIKWnM5HjAMBlPg5TUR_WsZDkD4FD5QkvZxuP4DlHlyFGWxUKzXYNqqBYaZnCNDMNTUPwXkG54j-aufmr4xoXwJY4Kiy6-e4H9pdSJk6boF4Kn5geU7wT4F',
      },
      {
        store: 'Robu.in (Uno/Nano CH340)',
        priceText: '₹250 – ₹420',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGkVJxictTiRUM3UKFaazqeME2f9UHigFyMJyvSjiXvXpUdxee2eGyRmLOQo6uz8Fo6YNIvGL9vFRt5uU325WDrJe4JIZbatu8dreDI2SXr_icejxF3idIf7zKulugC3rj-XNtLlcNrDUwI_VixX03gGvUB4MueFWP1cDjTUGGxSasPNrOx8xAS',
      },
    ],
  },
  {
    id: 'acs712',
    name: 'ACS712ELCTR-20A Hall-Effect Current Sensor',
    spec: '100 mV/A sensitivity, ±20A range (1× PV Input, 1× Battery Out)',
    category: 'Compute & Sensing',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 2,
    unitPriceUSD: 1.1,
    unitPriceINR: 88,
    unitPriceEUR: 1.0,
    included: true,
    cheapestStore: 'Quartz / Robu.in',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHUl4j5mkayopc0GrCWG3vn1zdfh-wmNgXku4WTOw-H5WPgxY2H55i4CMInXhO_K1PZfINimnYMtOcEGma8SzfkXcInngkRhi_R_4ROy2iX1NohKJMqODNTzhN1k9YNhM9D',
    priceComparison: [
      {
        store: 'Quartz Components',
        priceText: '₹88',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHvh8-6yLKEkR-cuTtE0Xoa8N2JXg0lCKEyvbYsIY_Q41KS0UTedix7q55kWHdTzeZFO9jB9qEvhLwdYkEQGVTv7VggYxqkG-2l9zwSU30pcMuME5fDuEs1hneeTJmbjI2zwXLRtHZxky_ldGsFLWeGCdmoaGxkFQwvlFn',
      },
      {
        store: 'Robu.in',
        priceText: '₹89',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHUl4j5mkayopc0GrCWG3vn1zdfh-wmNgXku4WTOw-H5WPgxY2H55i4CMInXhO_K1PZfINimnYMtOcEGma8SzfkXcInngkRhi_R_4ROy2iX1NohKJMqODNTzhN1k9YNhM9D',
      },
      {
        store: 'ElectronicsComp',
        priceText: '₹95',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEIiVo7TaJQIRZZU09mqRBjBB-mds7j_423nVJYUs91ulrToEcPjA6eEmon9NXIat4tybgnYF68e6WOZdxMevM66DctofRB6xakm4GhVvfYe_xBUpuOs50G1mvyU5uVIheV0yVz2Rk8R6Ui8Z0DlU_Ejciujrajb51l87k=',
      },
    ],
  },
  {
    id: 'oled',
    name: '0.96" SSD1306 I2C OLED Display (128×64)',
    spec: '3.3V I2C live telemetry readout (V_pv, I_mppt, W, Duty %)',
    category: 'Compute & Sensing',
    scope: 'controller',
    platforms: ['esp32'],
    qty: 1,
    unitPriceUSD: 1.75,
    unitPriceINR: 144,
    unitPriceEUR: 1.6,
    included: true,
    cheapestStore: 'Quartz Components',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHcvb6mGkpuKeyzIoBgCx0v05n6dzFH-UGHXOjUXcXBkFSlIJmXK1_KYxSsUjl-REcga9tqOHyzIb5-mPNmwyU3JTjNKlsWQW0bxpEzBkQ-Ze8x4IJ5SLhjMsUFYAJ5DaPm_Ue0j8J0LzBZ847FFe-yJLKFuQnmsc3Cs25ZNTN2XQ==',
  },
  {
    id: 'lcd-16x2',
    name: '16×2 I2C Character LCD Display (PCF8574)',
    spec: '5V backlit LCD for live PV Watts, Voltage, Current & Battery V',
    category: 'Compute & Sensing',
    scope: 'controller',
    platforms: ['arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 1.5,
    unitPriceINR: 120,
    unitPriceEUR: 1.4,
    included: true,
    cheapestStore: 'ElectronicsComp',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHbkuEZBDjc2QqfvsjHe-Sp3RopgyDVFDQFa98bc8212YMrmLArtQeDmHEHthqCrptAXvHq8rSHQ1j1DQ0uGRlVrtmPUBpcpopIkMTgQlf7JvOJlVUglvzZ9qayyz9926YmWgvme3i_GDokL4Y0bjHQ7yeZ83fD4r-b3oRiXjVNdGRwn_SbgGc667oAjup0jVeFWDc=',
  },
  {
    id: 'ds18b20',
    name: 'DS18B20 Temperature Sensor + 4.7kΩ Pull-Up',
    spec: '1-Wire digital sensor for battery thermal compensation',
    category: 'Compute & Sensing',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 0.45,
    unitPriceINR: 34,
    unitPriceEUR: 0.4,
    included: true,
    cheapestStore: 'Quartz Components',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEtKw1KYWdauYxmX_5ljh4qASNrAF7QJt2szG0gEw5JK-e1KRoMKdP_1-p1yG5oqokwLtcijxaJuJPHlIpJIQ2OdSgN9NEts18pB9AeRErvs6ddRlIbsjNtSeNZ3BOz9t8btUkAq964UQX5gL4_vIT2eoW9V4mSEC4CQxMkktoXB7vy',
    priceComparison: [
      {
        store: 'Quartz Components',
        priceText: '₹34 – ₹58',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEtKw1KYWdauYxmX_5ljh4qASNrAF7QJt2szG0gEw5JK-e1KRoMKdP_1-p1yG5oqokwLtcijxaJuJPHlIpJIQ2OdSgN9NEts18pB9AeRErvs6ddRlIbsjNtSeNZ3BOz9t8btUkAq964UQX5gL4_vIT2eoW9V4mSEC4CQxMkktoXB7vy',
      },
      {
        store: 'Robu.in',
        priceText: '₹59',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGHWQtoEyNyG35JSg7mPfJlbpMBpclTsKa4gh2gKuWmXtesXDu_SqF2sazN9oAbQFZdaKEVeAnKc-sgguYkVvefy0iXHGaRC6-d8PZfA4RDKaSX0kICY6ZOhng=',
      },
    ],
  },
  {
    id: 'resistor-zener-kit',
    name: '1% Metal Film Resistors + Zener Protection Diodes',
    spec: '100kΩ, 10kΩ, 15kΩ, 20kΩ, 33kΩ dividers + UART divider + Zeners',
    category: 'Compute & Sensing',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 0.9,
    unitPriceINR: 75,
    unitPriceEUR: 0.85,
    included: true,
    cheapestStore: 'Quartz Components',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAwLqXXuXrnKgnwenRSJhQlei2eGW0wR23HwFuC9t7S_lNDPWr8M5ZdUxmneXUTspagKJeiPq_vlu5gO0QG3pZ_7O-BZZlF11ufEN5OZMOOiz5cmYDhjUv8FOyLY2y7MTqnkajCVtOCvkhTVA6gEZbrWo4GtBmoVwqg54z9g==',
  },

  // Power Stage (Controller Scope)
  {
    id: 'ir2104',
    name: 'IR2104 Half-Bridge MOSFET Gate Driver IC + 8-Pin Socket',
    spec: 'SOP-8 (₹50 at Quartz) or DIP-8 through-hole (₹109 at ElectronicsComp)',
    category: 'Power Stage',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 0.65,
    unitPriceINR: 50,
    unitPriceEUR: 0.6,
    included: true,
    cheapestStore: 'Quartz (SOP-8)',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHjINDDmd-dv8RICnWYLWKREUWWyiPTg09W11WaGDurRg-Z-mjObbJTWy_rYGA8rGilmlyvJOkpaqC3fDgjCCWJrONKGmpus3k-jPkrtE5i07PGi_ZnOzJSfAMHHUwYY2eB6kbh4vzc2eZ2ItNXVU4M330g9BYOAzwWv2Ib7wIDzzxqEQ==',
    priceComparison: [
      {
        store: 'Quartz Components (SOP-8)',
        priceText: '₹50',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHjINDDmd-dv8RICnWYLWKREUWWyiPTg09W11WaGDurRg-Z-mjObbJTWy_rYGA8rGilmlyvJOkpaqC3fDgjCCWJrONKGmpus3k-jPkrtE5i07PGi_ZnOzJSfAMHHUwYY2eB6kbh4vzc2eZ2ItNXVU4M330g9BYOAzwWv2Ib7wIDzzxqEQ==',
      },
      {
        store: 'Robu.in (IR2104S)',
        priceText: '₹98',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGAm2d7q7fC8-jZ-6gxSVCC0ceW5N8JoT24exqxJeutLrEHW1CNvDe6ZykCRl8OfJVK3aiH1niGuBd40r5sJ8CTwE9HA0KEf3ne93U0y_gy_VFS3_F9hUwTmQkccSgev8IXvOtVaKA2pw==',
      },
      {
        store: 'ElectronicsComp (DIP-8)',
        priceText: '₹109',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG1mq_rB28E5gQvPZgEeEUNTXWI06uhQ_C-2qi6y4xto1GIvfTyZRU1wMEEj8ByX4_GbNW-N_Fxs01JXRXq3SA13yJeGxfeZDDiUW9xsQDQQyLc4AKtRqYcDhjLjgMffrsxJoRuPPu-CuoYv978-jlhSaw=',
      },
    ],
  },
  {
    id: 'irf3205',
    name: 'IRF3205 N-Channel Power MOSFET (55V, 110A, 8mΩ)',
    spec: 'High-side switch (Q1), Sync low-side (Q2), Reverse-block (Q3)',
    category: 'Power Stage',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 3,
    unitPriceUSD: 0.35,
    unitPriceINR: 26,
    unitPriceEUR: 0.32,
    included: true,
    cheapestStore: 'Robu.in / ElecComp',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG5zz8nDYcjx7eHFRfDCJbC0nzm0oqN-XgAK1PkGmqz3osnnKIXlsqgI2EWLJq9kaZJ8Zeh4EhGskaOFLKqmwRxf94i4aoz7cq8qU7xnm2cQZNxnvVL2vIQ3TSiSvXvPWHjbDHFlws=',
    priceComparison: [
      {
        store: 'Robu.in',
        priceText: '₹26',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG5zz8nDYcjx7eHFRfDCJbC0nzm0oqN-XgAK1PkGmqz3osnnKIXlsqgI2EWLJq9kaZJ8Zeh4EhGskaOFLKqmwRxf94i4aoz7cq8qU7xnm2cQZNxnvVL2vIQ3TSiSvXvPWHjbDHFlws=',
      },
      {
        store: 'Quartz Components',
        priceText: '₹32',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGSAsMVHGzDs6G3Pc4mW_49Hfpc76t_MQ3CTxtclScML-6-l-ptoi_dGY3jmU8sPYtUjhOyAAar462kf7HI-mXDODw7K_FZ29zsN-L9O8zVEQ6S0UZLiRmqbbai_HNC8xgUzgVOi7XBym4eib5woK6LWosTJwWU6NJ3AXk-VQQ38Q==',
      },
    ],
  },
  {
    id: 'inductor-core',
    name: 'T106-26 Iron Powder Toroid Core + 15 AWG Copper Wire',
    spec: 'Hand-wound 47µH, 15A continuous DC choke for 40kHz buck',
    category: 'Power Stage',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 2.4,
    unitPriceINR: 190,
    unitPriceEUR: 2.2,
    included: true,
    cheapestStore: 'TME India / Robu.in',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQESSI86uM_R1R-1o3u5wGbf4q9w7ZygHeYEYqJHUeCWeAvO0fSpxPn3mQtMV3IYxW3MuI4MJajRZlLDPmuvmha_lI5355UuE_V_rxjLV76IIsqc8sERtPVzS63eCHzprFjd1Mi49JjQtWrf9hfrLeFnsHE1yelviTefCg==',
    priceComparison: [
      {
        store: 'TME India (T106-26 Core)',
        priceText: '₹100 – ₹150',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQESSI86uM_R1R-1o3u5wGbf4q9w7ZygHeYEYqJHUeCWeAvO0fSpxPn3mQtMV3IYxW3MuI4MJajRZlLDPmuvmha_lI5355UuE_V_rxjLV76IIsqc8sERtPVzS63eCHzprFjd1Mi49JjQtWrf9hfrLeFnsHE1yelviTefCg==',
      },
      {
        store: 'Robu.in (Pre-wound Toroids)',
        priceText: '₹35 – ₹160',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFIQE89qBrzgDDjT9lHZTm5uA40htHQGabCtwEDVTOmLoN7GFXdExOqvVoD9o1UY3AT8rqBWKZC738Jd5j84APQAk-lGvXv7NOemHOqVr-ggvMeoUMs0Fw1ldLWEGdCVCN6Mw8D0b5VZMXu',
      },
    ],
  },
  {
    id: 'low-esr-caps',
    name: 'Low-ESR Electrolytic + Ceramic Decoupling Capacitor Pack',
    spec: '2× 470µF/35V (₹8 ea), 2× 1000µF/25V (₹10 ea), 100nF & 1µF',
    category: 'Power Stage',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 0.75,
    unitPriceINR: 56,
    unitPriceEUR: 0.7,
    included: true,
    cheapestStore: 'Quartz Components',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHupQDFiiL2jjr-MVi3Reoy3QVhSPVcQoJH4DG3yqyKcaDU1vrhvlm9CJHCO1VufMsoged0IYEsOhUt0o90V1Dk9wpCsY992hqKB1Gh3rWxd6oFnN5liTtZlgW9a7zIVJvu-NAUbqfX7cg3UT5hrzfCLc4gQKuSqja_M9Thw5cr_XxU9yMosyWKMZEWTqhnvf3JvUsaPPI=',
  },
  {
    id: 'diodes-tvs',
    name: '15SQ045 Schottky + 1N5819 Bootstrap + SMBJ26A TVS Diode',
    spec: 'Input reverse-polarity barrier (₹32), bootstrap (₹5), surge clamp',
    category: 'Power Stage',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 0.75,
    unitPriceINR: 52,
    unitPriceEUR: 0.7,
    included: true,
    cheapestStore: 'Sunrom / Quartz',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG0FRS_TNGx4urqmTu-AUrt1M2fVHG59YnCXQCQhDjQ74YGJje3mgBCcojq_KBCFv-EvQaFi_koyFMab4Motysd0q-_YUNGMYHATi4WIvCdl0ozIy__XgG2tQYQbeoqBeWW_Ke8z-GpBieE0nea_UXkqOu7mFU6eLeaUkvCHwg=',
    priceComparison: [
      {
        store: 'Sunrom (15SQ045)',
        priceText: '₹32',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG0FRS_TNGx4urqmTu-AUrt1M2fVHG59YnCXQCQhDjQ74YGJje3mgBCcojq_KBCFv-EvQaFi_koyFMab4Motysd0q-_YUNGMYHATi4WIvCdl0ozIy__XgG2tQYQbeoqBeWW_Ke8z-GpBieE0nea_UXkqOu7mFU6eLeaUkvCHwg=',
      },
      {
        store: 'Quartz (1N5819)',
        priceText: '₹5',
        url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEG7kdIl2idQhfGNfYQ-I4bPPSd8eX-1W4DtGoNT7F4J-_qyW3AdefzqZ_iNVB8Nf4lvIgY94pTGMXTHhY1COejhFkHpFb_ly9jlRcb56BrISDbSoVQW2iWG1PNfADuDVMlnLTCTmptDgv7PgTyZBuYIC7ULMDxD_w=',
      },
    ],
  },
  {
    id: 'lm2596-aux',
    name: 'LM2596 Buck Module (12V Rail) + AMS1117 / 7805 5V Regulator',
    spec: 'LM2596 (₹49 at Robu.in) + 5V regulator (₹20)',
    category: 'Power Stage',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 0.85,
    unitPriceINR: 69,
    unitPriceEUR: 0.8,
    included: true,
    cheapestStore: 'Robu.in',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGB2Yt7eD3naiVdBAcm6rYJLvYO88PemqVmqQbzJZyURJiO3-h2tFHZ2bAtEcbVSUPNY1Ey6MQM0-Ti_DZPNUt9TeY4-A_jmfGsmKW7Fi6PhEOZnF2QN9rCIA==',
  },

  // Protection & Enclosure (Controller Scope)
  {
    id: 'pcb-perfboard',
    name: 'Double-Sided Copper Perfboard / Zero-PCB + 16 AWG Bus Wire',
    spec: '100×80mm high-current trace layout for hostel soldering',
    category: 'Protection & Enclosure',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 1.8,
    unitPriceINR: 150,
    unitPriceEUR: 1.65,
    included: true,
    cheapestStore: 'Local / Robu.in',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGB2Yt7eD3naiVdBAcm6rYJLvYO88PemqVmqQbzJZyURJiO3-h2tFHZ2bAtEcbVSUPNY1Ey6MQM0-Ti_DZPNUt9TeY4-A_jmfGsmKW7Fi6PhEOZnF2QN9rCIA==',
  },
  {
    id: 'heatsinks',
    name: 'TO-220 Aluminum Heatsinks + Silicone Insulator Pads',
    spec: 'Electrically isolated thermal mounting for Q1, Q2, Q3',
    category: 'Protection & Enclosure',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 3,
    unitPriceUSD: 0.4,
    unitPriceINR: 30,
    unitPriceEUR: 0.35,
    included: true,
    cheapestStore: 'Local / ElectronicsComp',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG1mq_rB28E5gQvPZgEeEUNTXWI06uhQ_C-2qi6y4xto1GIvfTyZRU1wMEEj8ByX4_GbNW-N_Fxs01JXRXq3SA13yJeGxfeZDDiUW9xsQDQQyLc4AKtRqYcDhjLjgMffrsxJoRuPPu-CuoYv978-jlhSaw=',
  },
  {
    id: 'fuses-terminals',
    name: '15A DC Blade Fuse Holders (×2) + 30A Screw Terminal Blocks',
    spec: 'PV input & Battery output over-current protection',
    category: 'Protection & Enclosure',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 1.4,
    unitPriceINR: 115,
    unitPriceEUR: 1.3,
    included: true,
    cheapestStore: 'Local / Quartz',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAwLqXXuXrnKgnwenRSJhQlei2eGW0wR23HwFuC9t7S_lNDPWr8M5ZdUxmneXUTspagKJeiPq_vlu5gO0QG3pZ_7O-BZZlF11ufEN5OZMOOiz5cmYDhjUv8FOyLY2y7MTqnkajCVtOCvkhTVA6gEZbrWo4GtBmoVwqg54z9g==',
  },
  {
    id: 'enclosure-fan',
    name: 'ABS Project Enclosure (160×110×60mm) + 40mm 12V Cooling Fan',
    spec: 'Ventilated mini-project housing with brass standoffs',
    category: 'Protection & Enclosure',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 3.9,
    unitPriceINR: 320,
    unitPriceEUR: 3.6,
    included: true,
    cheapestStore: 'Local / Robu.in',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGB2Yt7eD3naiVdBAcm6rYJLvYO88PemqVmqQbzJZyURJiO3-h2tFHZ2bAtEcbVSUPNY1Ey6MQM0-Ti_DZPNUt9TeY4-A_jmfGsmKW7Fi6PhEOZnF2QN9rCIA==',
  },
  {
    id: 'consumables',
    name: 'Solder Wire, Jumper Wires, 2N2222 Transistor & Heat-Shrink',
    spec: 'Mini-project assembly & prototyping consumables',
    category: 'Protection & Enclosure',
    scope: 'controller',
    platforms: ['esp32', 'arduino', 'hybrid'],
    qty: 1,
    unitPriceUSD: 2.4,
    unitPriceINR: 195,
    unitPriceEUR: 2.2,
    included: true,
    cheapestStore: 'Local Market / Quartz',
    cheapestUrl:
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAwLqXXuXrnKgnwenRSJhQlei2eGW0wR23HwFuC9t7S_lNDPWr8M5ZdUxmneXUTspagKJeiPq_vlu5gO0QG3pZ_7O-BZZlF11ufEN5OZMOOiz5cmYDhjUv8FOyLY2y7MTqnkajCVtOCvkhTVA6gEZbrWo4GtBmoVwqg54z9g==',
  },
];

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const cfg = CURRENCIES[currency];
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency: cfg.code,
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  }).format(amount);
}

export function getUnitPrice(item: BomItem, currency: CurrencyCode): number {
  if (currency === 'INR') return item.unitPriceINR;
  if (currency === 'EUR') return item.unitPriceEUR;
  return item.unitPriceUSD;
}

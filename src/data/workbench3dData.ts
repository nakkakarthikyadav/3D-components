import { ControllerPlatform } from './mpptData';

export interface ComponentPin3D {
  id: string; // e.g. "pv_panel:PV+"
  compId: string;
  pinName: string;
  label: string;
  localOffset: [number, number, number];
  signalType: 'power_pos' | 'power_gnd' | 'pwm' | 'analog' | 'digital' | 'i2c';
  colorHex: number;
  maxVoltage: number;
}

export interface ComponentModule3D {
  id: string;
  name: string;
  shortName: string;
  category: 'Source & Load' | 'MCU & Sensing' | 'Power Stage' | 'Driver & Aux';
  trayPos: [number, number, number];
  boardPos: [number, number, number];
  platforms: ControllerPlatform[];
  pins: Omit<ComponentPin3D, 'id' | 'compId'>[];
  summary: string;
}

export interface RequiredWire3D {
  id: string;
  fromPin: string;
  toPin: string;
  colorHex: number;
  label: string;
  platforms: ControllerPlatform[];
}

export const COMPONENT_MODULES_3D: ComponentModule3D[] = [
  {
    id: 'pv_panel',
    name: '165Wp Mono PERC Solar Panel',
    shortName: '165W PERC PV',
    category: 'Source & Load',
    trayPos: [-5.4, 2.35, -3.9],
    boardPos: [-4.9, 0.0, -0.3],
    platforms: ['esp32', 'arduino', 'hybrid'],
    summary: '36-cell Mono PERC array (Voc 22.8V, Vmp 18.7V, Imp 8.82A)',
    pins: [
      { pinName: 'PV+', label: 'Solar PV+ (MC4 Red)', localOffset: [0.95, 0.25, -0.35], signalType: 'power_pos', colorHex: 0xdc2626, maxVoltage: 24 },
      { pinName: 'PV-', label: 'Solar PV- (MC4 Black)', localOffset: [0.95, 0.25, 0.35], signalType: 'power_gnd', colorHex: 0x1e293b, maxVoltage: 0 },
    ],
  },
  {
    id: 'protection',
    name: 'Fuse + 15SQ045 + TVS + Caps + Dividers',
    shortName: 'Input & Caps',
    category: 'Power Stage',
    trayPos: [-3.3, 2.35, -3.9],
    boardPos: [-2.45, 0.08, -0.95],
    platforms: ['esp32', 'arduino', 'hybrid'],
    summary: '15A Fuse, 15SQ045, SMBJ26A TVS, 940µF C_in, 2000µF C_out, 1% ADC dividers',
    pins: [
      { pinName: 'IN_PV+', label: '15A Fuse Input (from PV+)', localOffset: [-0.68, 0.24, -0.15], signalType: 'power_pos', colorHex: 0xdc2626, maxVoltage: 24 },
      { pinName: 'BUS_PV+', label: 'Protected PV Bus (to ACS1 & Div)', localOffset: [0.68, 0.24, -0.15], signalType: 'power_pos', colorHex: 0xea580c, maxVoltage: 24 },
      { pinName: 'DIV_PV', label: 'Scaled V_PV Sense Out (11:1 / 6:1)', localOffset: [0.68, 0.22, 0.25], signalType: 'analog', colorHex: 0x2563eb, maxVoltage: 3.3 },
      { pinName: 'DIV_BAT', label: 'Scaled V_BAT Sense Out', localOffset: [0.25, 0.22, 0.42], signalType: 'analog', colorHex: 0x0284c7, maxVoltage: 3.3 },
      { pinName: 'GND', label: 'Power Star Ground', localOffset: [-0.25, 0.22, 0.42], signalType: 'power_gnd', colorHex: 0x1e293b, maxVoltage: 0 },
    ],
  },
  {
    id: 'acs_pair',
    name: 'ACS712-20A Dual Current Sensors',
    shortName: 'ACS712 ×2',
    category: 'MCU & Sensing',
    trayPos: [-1.4, 2.35, -3.9],
    boardPos: [-0.95, 0.08, -1.15],
    platforms: ['esp32', 'arduino', 'hybrid'],
    summary: 'Hall-effect PV input (#1) and Battery charge (#2) current sensors (100mV/A)',
    pins: [
      { pinName: 'IP1_IN', label: 'ACS1 IP+ (from Protected PV+)', localOffset: [-0.45, 0.24, -0.25], signalType: 'power_pos', colorHex: 0xea580c, maxVoltage: 24 },
      { pinName: 'IP1_OUT', label: 'ACS1 IP- (to Q1 Drain)', localOffset: [0.45, 0.24, -0.25], signalType: 'power_pos', colorHex: 0xea580c, maxVoltage: 24 },
      { pinName: 'VIOUT1', label: 'ACS1 Analog Out (PV Current)', localOffset: [0.0, 0.22, -0.42], signalType: 'analog', colorHex: 0x16a34a, maxVoltage: 5 },
      { pinName: 'IP2_IN', label: 'ACS2 IP+ (from L1 Output)', localOffset: [-0.45, 0.24, 0.25], signalType: 'power_pos', colorHex: 0xd97706, maxVoltage: 16 },
      { pinName: 'IP2_OUT', label: 'ACS2 IP- (to Q3 Source)', localOffset: [0.45, 0.24, 0.25], signalType: 'power_pos', colorHex: 0xd97706, maxVoltage: 16 },
      { pinName: 'VIOUT2', label: 'ACS2 Analog Out (Bat Current)', localOffset: [0.0, 0.22, 0.42], signalType: 'analog', colorHex: 0x15803d, maxVoltage: 5 },
      { pinName: 'VCC5V', label: '5V Sensor Supply', localOffset: [-0.45, 0.22, 0.0], signalType: 'power_pos', colorHex: 0xef4444, maxVoltage: 5 },
    ],
  },
  {
    id: 'mosfets',
    name: 'Q1, Q2, Q3 IRF3205 MOSFETs + Heatsinks',
    shortName: 'Q1–Q3 FETs',
    category: 'Power Stage',
    trayPos: [0.6, 2.35, -3.9],
    boardPos: [0.75, 0.08, -1.05],
    platforms: ['esp32', 'arduino', 'hybrid'],
    summary: '3× 55V 8mΩ N-MOSFETs with isolated TO-220 aluminum heatsinks',
    pins: [
      { pinName: 'Q1_D', label: 'Q1 Drain (PV In)', localOffset: [-0.52, 0.22, -0.25], signalType: 'power_pos', colorHex: 0xea580c, maxVoltage: 24 },
      { pinName: 'Q1_G', label: 'Q1 Gate (from IR2104 HO)', localOffset: [-0.52, 0.22, 0.25], signalType: 'pwm', colorHex: 0x9333ea, maxVoltage: 30 },
      { pinName: 'SW_NODE', label: 'Q1 Source / Q2 Drain (Switch Node)', localOffset: [0.0, 0.22, -0.25], signalType: 'pwm', colorHex: 0xeab308, maxVoltage: 24 },
      { pinName: 'Q2_G', label: 'Q2 Gate (from IR2104 LO)', localOffset: [0.0, 0.22, 0.25], signalType: 'pwm', colorHex: 0x7e22ce, maxVoltage: 12 },
      { pinName: 'Q3_S', label: 'Q3 Source (from ACS2 Out)', localOffset: [0.52, 0.22, -0.25], signalType: 'power_pos', colorHex: 0xd97706, maxVoltage: 16 },
      { pinName: 'Q3_D', label: 'Q3 Drain (to Bat+ Fuse)', localOffset: [0.52, 0.22, 0.0], signalType: 'power_pos', colorHex: 0xdc2626, maxVoltage: 16 },
      { pinName: 'Q3_G', label: 'Q3 Gate (Night-Block Control)', localOffset: [0.52, 0.22, 0.25], signalType: 'digital', colorHex: 0x059669, maxVoltage: 12 },
    ],
  },
  {
    id: 'inductor',
    name: 'L1 47µH T106-26 Toroid Choke',
    shortName: '47µH Inductor',
    category: 'Power Stage',
    trayPos: [2.5, 2.35, -3.9],
    boardPos: [2.35, 0.08, -1.05],
    platforms: ['esp32', 'arduino', 'hybrid'],
    summary: 'Hand-wound 18-turn 15 AWG copper toroid (47µH, 15A continuous)',
    pins: [
      { pinName: 'L_IN', label: 'Inductor In (from Switch Node)', localOffset: [-0.45, 0.25, 0.0], signalType: 'pwm', colorHex: 0xeab308, maxVoltage: 24 },
      { pinName: 'L_OUT', label: 'Inductor Out (Filtered DC to ACS2)', localOffset: [0.45, 0.25, 0.0], signalType: 'power_pos', colorHex: 0xd97706, maxVoltage: 16 },
    ],
  },
  {
    id: 'ir2104',
    name: 'IR2104 Gate Driver + Bootstrap',
    shortName: 'IR2104 Driver',
    category: 'Driver & Aux',
    trayPos: [4.2, 2.35, -3.9],
    boardPos: [0.75, 0.08, 0.35],
    platforms: ['esp32', 'arduino', 'hybrid'],
    summary: 'Half-bridge high/low driver with 520ns dead-time & 1N5819 bootstrap',
    pins: [
      { pinName: 'VCC12', label: 'IR2104 Pin 1 VCC (12V)', localOffset: [-0.42, 0.22, -0.22], signalType: 'power_pos', colorHex: 0x7c3aed, maxVoltage: 12 },
      { pinName: 'IN_PWM', label: 'IR2104 Pin 2 IN (40kHz PWM)', localOffset: [-0.42, 0.22, 0.0], signalType: 'pwm', colorHex: 0x0d9488, maxVoltage: 5 },
      { pinName: 'SD_EN', label: 'IR2104 Pin 3 SD (Enable)', localOffset: [-0.42, 0.22, 0.22], signalType: 'digital', colorHex: 0x0f766e, maxVoltage: 5 },
      { pinName: 'HO', label: 'IR2104 Pin 7 HO (to Q1 Gate)', localOffset: [0.42, 0.22, -0.22], signalType: 'pwm', colorHex: 0x9333ea, maxVoltage: 30 },
      { pinName: 'VS', label: 'IR2104 Pin 6 VS (Switch Node)', localOffset: [0.42, 0.22, 0.0], signalType: 'pwm', colorHex: 0xeab308, maxVoltage: 24 },
      { pinName: 'LO', label: 'IR2104 Pin 5 LO (to Q2 Gate)', localOffset: [0.42, 0.22, 0.22], signalType: 'pwm', colorHex: 0x7e22ce, maxVoltage: 12 },
    ],
  },
  {
    id: 'aux_psu',
    name: 'LM2596 12V + AMS1117 5V Aux Rail',
    shortName: '12V/5V Aux PSU',
    category: 'Driver & Aux',
    trayPos: [-4.2, 2.35, -3.15],
    boardPos: [2.45, 0.08, 0.45],
    platforms: ['esp32', 'arduino', 'hybrid'],
    summary: 'Drops battery voltage to clean 12.0V gate rail & 5.0V sensor/MCU bus',
    pins: [
      { pinName: 'VIN_BAT', label: 'LM2596 VIN+ (from Bat+)', localOffset: [-0.55, 0.24, -0.18], signalType: 'power_pos', colorHex: 0xdc2626, maxVoltage: 16 },
      { pinName: 'V12_OUT', label: '12.0V Gate Drive Rail', localOffset: [0.55, 0.24, -0.18], signalType: 'power_pos', colorHex: 0x7c3aed, maxVoltage: 12 },
      { pinName: 'V5_OUT', label: '5.0V Logic & ACS712 Rail', localOffset: [0.55, 0.24, 0.2], signalType: 'power_pos', colorHex: 0xef4444, maxVoltage: 5 },
      { pinName: 'GND', label: 'Aux Ground', localOffset: [-0.55, 0.24, 0.2], signalType: 'power_gnd', colorHex: 0x1e293b, maxVoltage: 0 },
    ],
  },
  {
    id: 'esp32',
    name: 'ESP32-WROOM-32 DevKit V1',
    shortName: 'ESP32 DevKit',
    category: 'MCU & Sensing',
    trayPos: [-1.8, 2.35, -3.15],
    boardPos: [-1.4, 0.08, 1.35],
    platforms: ['esp32', 'hybrid'],
    summary: 'Dual-Core 240MHz MCU: 40kHz PWM, d²I/dV² DSP, ESR ripple & Wi-Fi PV-Scope',
    pins: [
      { pinName: 'GPIO34', label: 'GPIO 34 (PV Volt ADC1)', localOffset: [-0.62, 0.22, -0.25], signalType: 'analog', colorHex: 0x2563eb, maxVoltage: 3.3 },
      { pinName: 'GPIO35', label: 'GPIO 35 (Bat Volt ADC1)', localOffset: [-0.62, 0.22, -0.05], signalType: 'analog', colorHex: 0x0284c7, maxVoltage: 3.3 },
      { pinName: 'GPIO32', label: 'GPIO 32 (PV Current ADC1)', localOffset: [-0.62, 0.22, 0.15], signalType: 'analog', colorHex: 0x16a34a, maxVoltage: 3.3 },
      { pinName: 'GPIO33', label: 'GPIO 33 (Bat Current ADC1)', localOffset: [-0.62, 0.22, 0.35], signalType: 'analog', colorHex: 0x15803d, maxVoltage: 3.3 },
      { pinName: 'GPIO18', label: 'GPIO 18 (40kHz PWM Out)', localOffset: [0.62, 0.22, -0.25], signalType: 'pwm', colorHex: 0x0d9488, maxVoltage: 3.3 },
      { pinName: 'GPIO19', label: 'GPIO 19 (IR2104 SD Enable)', localOffset: [0.62, 0.22, -0.05], signalType: 'digital', colorHex: 0x0f766e, maxVoltage: 3.3 },
      { pinName: 'GPIO25', label: 'GPIO 25 (Q3 Night Block)', localOffset: [0.62, 0.22, 0.15], signalType: 'digital', colorHex: 0x059669, maxVoltage: 3.3 },
      { pinName: 'I2C_TEMP', label: 'GPIO 21/22 (OLED) + GPIO 4 (Temp)', localOffset: [0.0, 0.22, 0.38], signalType: 'i2c', colorHex: 0x4f46e5, maxVoltage: 3.3 },
      { pinName: 'UART_RX2', label: 'GPIO 16 RX2 (from Arduino D11)', localOffset: [0.62, 0.22, 0.35], signalType: 'digital', colorHex: 0xf59e0b, maxVoltage: 3.3 },
      { pinName: 'VIN5V', label: 'ESP32 VIN (5V Input)', localOffset: [-0.3, 0.22, -0.35], signalType: 'power_pos', colorHex: 0xef4444, maxVoltage: 5 },
    ],
  },
  {
    id: 'arduino',
    name: 'Arduino Nano / Uno (5V MPPT Loop)',
    shortName: 'Arduino Nano',
    category: 'MCU & Sensing',
    trayPos: [0.3, 2.35, -3.15],
    boardPos: [-0.95, 0.08, 0.3],
    platforms: ['arduino', 'hybrid'],
    summary: '5V ATmega328P Timer1 40kHz Fast PWM + direct 5V ACS712 ADC0–3',
    pins: [
      { pinName: 'A0', label: 'Pin A0 (PV Voltage Sense)', localOffset: [-0.52, 0.22, -0.22], signalType: 'analog', colorHex: 0x2563eb, maxVoltage: 5 },
      { pinName: 'A1', label: 'Pin A1 (Bat Voltage Sense)', localOffset: [-0.52, 0.22, 0.0], signalType: 'analog', colorHex: 0x0284c7, maxVoltage: 5 },
      { pinName: 'A2', label: 'Pin A2 (ACS1 PV Current)', localOffset: [-0.52, 0.22, 0.22], signalType: 'analog', colorHex: 0x16a34a, maxVoltage: 5 },
      { pinName: 'A3', label: 'Pin A3 (ACS2 Bat Current)', localOffset: [-0.18, 0.22, 0.28], signalType: 'analog', colorHex: 0x15803d, maxVoltage: 5 },
      { pinName: 'D9', label: 'Pin D9 (Timer1 40kHz PWM)', localOffset: [0.52, 0.22, -0.22], signalType: 'pwm', colorHex: 0x0d9488, maxVoltage: 5 },
      { pinName: 'D8', label: 'Pin D8 (IR2104 SD Enable)', localOffset: [0.52, 0.22, 0.0], signalType: 'digital', colorHex: 0x0f766e, maxVoltage: 5 },
      { pinName: 'D7', label: 'Pin D7 (Q3 Night Block)', localOffset: [0.52, 0.22, 0.22], signalType: 'digital', colorHex: 0x059669, maxVoltage: 5 },
      { pinName: 'D11_TX', label: 'Pin D11 UART TX (via 1k/2k to ESP32)', localOffset: [0.18, 0.22, 0.28], signalType: 'digital', colorHex: 0xf59e0b, maxVoltage: 5 },
      { pinName: 'V5_IN', label: 'Arduino 5V Power Pin', localOffset: [-0.18, 0.22, -0.28], signalType: 'power_pos', colorHex: 0xef4444, maxVoltage: 5 },
    ],
  },
  {
    id: 'display_temp',
    name: '0.96" OLED + DS18B20 Temp Probe',
    shortName: 'OLED & DS18B20',
    category: 'MCU & Sensing',
    trayPos: [2.4, 2.35, -3.15],
    boardPos: [0.95, 0.08, 1.45],
    platforms: ['esp32', 'arduino', 'hybrid'],
    summary: 'Live telemetry screen (W_mppt, d²I/dV², ESR mΩ) + battery/cell temp probe',
    pins: [
      { pinName: 'BUS_I2C', label: 'I2C SDA/SCL + DS18B20 Data', localOffset: [-0.55, 0.22, 0.0], signalType: 'i2c', colorHex: 0x4f46e5, maxVoltage: 3.3 },
      { pinName: 'GND', label: 'Display & Sensor Ground', localOffset: [0.55, 0.22, 0.0], signalType: 'power_gnd', colorHex: 0x1e293b, maxVoltage: 0 },
    ],
  },
  {
    id: 'battery',
    name: '12V 20Ah Solar Battery Bank',
    shortName: '12V Battery',
    category: 'Source & Load',
    trayPos: [4.7, 2.35, -3.15],
    boardPos: [4.85, 0.0, 0.2],
    platforms: ['esp32', 'arduino', 'hybrid'],
    summary: '12V Tubular / SMF Lead-Acid or LiFePO4 battery bank (14.4V Bulk / 13.6V Float)',
    pins: [
      { pinName: 'BAT+', label: 'Battery Positive Post (+12V)', localOffset: [-0.72, 0.92, -0.35], signalType: 'power_pos', colorHex: 0xdc2626, maxVoltage: 15 },
      { pinName: 'BAT-', label: 'Battery Negative Post (GND)', localOffset: [-0.72, 0.92, 0.35], signalType: 'power_gnd', colorHex: 0x1e293b, maxVoltage: 0 },
    ],
  },
];

export function getRequiredWires3D(platform: ControllerPlatform): RequiredWire3D[] {
  const sharedPowerWires: RequiredWire3D[] = [
    { id: 'w-pv-in', fromPin: 'pv_panel:PV+', toPin: 'protection:IN_PV+', colorHex: 0xdc2626, label: 'PV+ -> 15A Input Fuse & 15SQ045', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-pv-gnd', fromPin: 'pv_panel:PV-', toPin: 'protection:GND', colorHex: 0x1e293b, label: 'PV- -> Star GND', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-bus-acs1', fromPin: 'protection:BUS_PV+', toPin: 'acs_pair:IP1_IN', colorHex: 0xea580c, label: 'Protected PV+ -> ACS712 #1', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-acs1-q1', fromPin: 'acs_pair:IP1_OUT', toPin: 'mosfets:Q1_D', colorHex: 0xea580c, label: 'ACS712 #1 -> Q1 Drain', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-sw-l1', fromPin: 'mosfets:SW_NODE', toPin: 'inductor:L_IN', colorHex: 0xeab308, label: 'Switch Node -> L1 47µH', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-l1-acs2', fromPin: 'inductor:L_OUT', toPin: 'acs_pair:IP2_IN', colorHex: 0xd97706, label: 'L1 Out -> ACS712 #2', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-acs2-q3', fromPin: 'acs_pair:IP2_OUT', toPin: 'mosfets:Q3_S', colorHex: 0xd97706, label: 'ACS712 #2 -> Q3 Source', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-q3-bat', fromPin: 'mosfets:Q3_D', toPin: 'battery:BAT+', colorHex: 0xdc2626, label: 'Q3 Drain -> 12V Battery+', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-bat-gnd', fromPin: 'battery:BAT-', toPin: 'protection:GND', colorHex: 0x1e293b, label: 'Battery- -> Star GND', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-driver-ho', fromPin: 'ir2104:HO', toPin: 'mosfets:Q1_G', colorHex: 0x9333ea, label: 'IR2104 HO -> Q1 Gate', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-driver-lo', fromPin: 'ir2104:LO', toPin: 'mosfets:Q2_G', colorHex: 0x7e22ce, label: 'IR2104 LO -> Q2 Gate', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-driver-vs', fromPin: 'ir2104:VS', toPin: 'mosfets:SW_NODE', colorHex: 0xeab308, label: 'IR2104 VS -> Switch Node', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-aux-in', fromPin: 'battery:BAT+', toPin: 'aux_psu:VIN_BAT', colorHex: 0xdc2626, label: 'Bat+ -> LM2596 VIN', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-aux-12v', fromPin: 'aux_psu:V12_OUT', toPin: 'ir2104:VCC12', colorHex: 0x7c3aed, label: '12V Aux -> IR2104 VCC', platforms: ['esp32', 'arduino', 'hybrid'] },
    { id: 'w-aux-acs', fromPin: 'aux_psu:V5_OUT', toPin: 'acs_pair:VCC5V', colorHex: 0xef4444, label: '5V Aux -> ACS712 VCC', platforms: ['esp32', 'arduino', 'hybrid'] },
  ];

  if (platform === 'esp32') {
    return [
      ...sharedPowerWires,
      { id: 'w-5v-esp', fromPin: 'aux_psu:V5_OUT', toPin: 'esp32:VIN5V', colorHex: 0xef4444, label: '5V Aux -> ESP32 VIN', platforms: ['esp32'] },
      { id: 'w-div-pv', fromPin: 'protection:DIV_PV', toPin: 'esp32:GPIO34', colorHex: 0x2563eb, label: 'PV Divider -> ESP32 GPIO 34', platforms: ['esp32'] },
      { id: 'w-div-bat', fromPin: 'protection:DIV_BAT', toPin: 'esp32:GPIO35', colorHex: 0x0284c7, label: 'Bat Divider -> ESP32 GPIO 35', platforms: ['esp32'] },
      { id: 'w-acs1-esp', fromPin: 'acs_pair:VIOUT1', toPin: 'esp32:GPIO32', colorHex: 0x16a34a, label: 'ACS1 (10k/20k) -> GPIO 32', platforms: ['esp32'] },
      { id: 'w-acs2-esp', fromPin: 'acs_pair:VIOUT2', toPin: 'esp32:GPIO33', colorHex: 0x15803d, label: 'ACS2 (10k/20k) -> GPIO 33', platforms: ['esp32'] },
      { id: 'w-pwm-esp', fromPin: 'esp32:GPIO18', toPin: 'ir2104:IN_PWM', colorHex: 0x0d9488, label: 'GPIO 18 PWM -> IR2104 IN', platforms: ['esp32'] },
      { id: 'w-sd-esp', fromPin: 'esp32:GPIO19', toPin: 'ir2104:SD_EN', colorHex: 0x0f766e, label: 'GPIO 19 -> IR2104 SD', platforms: ['esp32'] },
      { id: 'w-q3-esp', fromPin: 'esp32:GPIO25', toPin: 'mosfets:Q3_G', colorHex: 0x059669, label: 'GPIO 25 -> Q3 Night Block', platforms: ['esp32'] },
      { id: 'w-i2c-esp', fromPin: 'esp32:I2C_TEMP', toPin: 'display_temp:BUS_I2C', colorHex: 0x4f46e5, label: 'GPIO 21/22/4 -> OLED & DS18B20', platforms: ['esp32'] },
    ];
  }

  const arduinoControlWires: RequiredWire3D[] = [
    { id: 'w-5v-ard', fromPin: 'aux_psu:V5_OUT', toPin: 'arduino:V5_IN', colorHex: 0xef4444, label: '5V Aux -> Arduino 5V', platforms: ['arduino', 'hybrid'] },
    { id: 'w-div-pv-a', fromPin: 'protection:DIV_PV', toPin: 'arduino:A0', colorHex: 0x2563eb, label: 'PV Divider -> Arduino A0', platforms: ['arduino', 'hybrid'] },
    { id: 'w-div-bat-a', fromPin: 'protection:DIV_BAT', toPin: 'arduino:A1', colorHex: 0x0284c7, label: 'Bat Divider -> Arduino A1', platforms: ['arduino', 'hybrid'] },
    { id: 'w-acs1-ard', fromPin: 'acs_pair:VIOUT1', toPin: 'arduino:A2', colorHex: 0x16a34a, label: 'ACS1 Direct 5V -> Arduino A2', platforms: ['arduino', 'hybrid'] },
    { id: 'w-acs2-ard', fromPin: 'acs_pair:VIOUT2', toPin: 'arduino:A3', colorHex: 0x15803d, label: 'ACS2 Direct 5V -> Arduino A3', platforms: ['arduino', 'hybrid'] },
    { id: 'w-pwm-ard', fromPin: 'arduino:D9', toPin: 'ir2104:IN_PWM', colorHex: 0x0d9488, label: 'Timer1 D9 -> IR2104 IN', platforms: ['arduino', 'hybrid'] },
    { id: 'w-sd-ard', fromPin: 'arduino:D8', toPin: 'ir2104:SD_EN', colorHex: 0x0f766e, label: 'Pin D8 -> IR2104 SD', platforms: ['arduino', 'hybrid'] },
    { id: 'w-q3-ard', fromPin: 'arduino:D7', toPin: 'mosfets:Q3_G', colorHex: 0x059669, label: 'Pin D7 -> Q3 Night Block', platforms: ['arduino', 'hybrid'] },
  ];

  if (platform === 'arduino') {
    return [...sharedPowerWires, ...arduinoControlWires];
  }

  // Hybrid: Arduino + ESP32 UART Bridge + OLED/Temp
  return [
    ...sharedPowerWires,
    ...arduinoControlWires,
    { id: 'w-5v-esp-hyb', fromPin: 'aux_psu:V5_OUT', toPin: 'esp32:VIN5V', colorHex: 0xef4444, label: '5V Aux -> ESP32 VIN', platforms: ['hybrid'] },
    { id: 'w-uart-bridge', fromPin: 'arduino:D11_TX', toPin: 'esp32:UART_RX2', colorHex: 0xf59e0b, label: 'Arduino D11 (1k/2k) -> ESP32 RX2', platforms: ['hybrid'] },
    { id: 'w-i2c-hyb', fromPin: 'esp32:I2C_TEMP', toPin: 'display_temp:BUS_I2C', colorHex: 0x4f46e5, label: 'OLED & DS18B20 Bus', platforms: ['hybrid'] },
  ];
}

import { ControllerPlatform } from './mpptData';

export interface HostelStep {
  stepNumber: number;
  title: string;
  duration: string;
  goal: string;
  checklist: string[];
  multimeterCheck: {
    probePoints: string;
    expectedReading: string;
  };
  hostelTip: string;
}

export interface HostelTroubleItem {
  symptom: string;
  likelyCause: string;
  hostelFix: string;
}

export function getHostelSteps(platform: ControllerPlatform): HostelStep[] {
  const isArduinoControl = platform === 'arduino' || platform === 'hybrid';

  return [
    {
      stepNumber: 1,
      title: 'Set Up Your Hostel Desk & Prepare the 47µH Inductor (L1)',
      duration: '25 min',
      goal: 'Arrange basic tools and wind or verify the 15A toroidal inductor before touching the PCB.',
      checklist: [
        'Clear your hostel desk and place a cardboard sheet or silicone mat down to protect the table from solder burns.',
        'Gather tools: 25W/40W soldering iron, rosin-core solder, digital multimeter, wire cutter, and needle-nose pliers.',
        'If winding L1 yourself: wrap 23 tightly spaced turns of 15 AWG (1.5mm) enameled copper wire around a yellow-white T106-26 toroid core (or use a pre-wound 47µH 15A toroid).',
        'Scrape the enamel coating off the last 12mm of both inductor leads using sandpaper or a blade, then tin both ends with fresh solder.',
      ],
      multimeterCheck: {
        probePoints: 'Multimeter in Continuity / Ohms mode across the two tinned leads of L1',
        expectedReading: 'Beep / < 0.2 Ω (confirms enamel was completely scraped off)',
      },
      hostelTip:
        'Buy a pre-wound 47µH 15A toroidal inductor online if possible—hand-winding thick 15 AWG copper wire in a hostel room takes strong grip and patience.',
    },
    {
      stepNumber: 2,
      title: 'Build & Calibrate the 12V & 5V Auxiliary Power Rails First',
      duration: '20 min',
      goal: 'Create rock-solid 12.0V (for IR2104 gate driver) and 5.0V (for MCU & ACS712) rails before wiring any chips.',
      checklist: [
        'Solder the LM2596 buck module input to a 15V–20V DC test source (or 12V battery) via a diode, leaving the output disconnected from other circuits.',
        'Turn the brass screw on the LM2596 blue potentiometer counter-clockwise ~15 turns while watching your multimeter.',
        'Wire the LM2596 12.0V output into the AMS1117-5.0 or LM7805 regulator input, adding 100µF and 100nF bypass capacitors across the 5V output.',
        'Label +12V, +5V, and GND bus lines clearly on your zero-PCB with a permanent marker.',
      ],
      multimeterCheck: {
        probePoints: 'DC Volts mode: LM2596 VOUT to GND, and 5V Reg OUT to GND',
        expectedReading: '12.00 V (±0.1 V) on Gate Rail · 5.00 V (±0.15 V) on Logic Rail',
      },
      hostelTip:
        'Never skip calibrating the LM2596 first—new modules often ship set to pass input voltage straight through, which instantly destroys the IR2104 or ESP32.',
    },
    {
      stepNumber: 3,
      title: 'Solder High-Current Power Traces & Isolated MOSFETs (Q1, Q2, Q3)',
      duration: '40 min',
      goal: 'Assemble the 12A synchronous buck path on perfboard without shorts or overheated thin traces.',
      checklist: [
        'Place 2-pin 30A screw terminals for PV Input and Battery Output at opposite edges of the zero-PCB.',
        'Mount Q1 (High-Side), Q2 (Low-Side), and Q3 (Reverse-Block) IRF3205 MOSFETs onto separate TO-220 heatsinks—or use silicone insulator pads + plastic shoulder washers if sharing one heatsink.',
        'Solder heavy paths: PV+ → 15A Fuse → 15SQ045 Schottky → SMBJ26A TVS → C_in (2×470µF/35V) → ACS712 #1 → Q1 Drain; Q1 Source + Q2 Drain → L1 → C_out (2×1000µF/25V) → ACS712 #2 → Q3 → 15A Fuse → Bat+.',
        'Reinforce every high-current path on the underside of the zero-PCB by laying bare 16 AWG copper wire along the pads and flooding it with solder.',
      ],
      multimeterCheck: {
        probePoints: 'Continuity mode between Q1 metal tab, Q2 metal tab, Q3 metal tab, and GND',
        expectedReading: 'OL (No beep) between all three heatsink tabs and GND',
      },
      hostelTip:
        'Standard zero-PCB copper pads burn off above 3A! Stripping a piece of household 1.5mm² copper wire and soldering it along the power tracks lets your board carry 15A easily.',
    },
    {
      stepNumber: 4,
      title: 'Wire the IR2104 Half-Bridge Driver & Bootstrap Circuit',
      duration: '25 min',
      goal: 'Connect the gate driver cleanly using an 8-pin IC socket so the chip can be replaced if damaged.',
      checklist: [
        'Solder an 8-pin DIP socket for the IR2104 (do NOT insert the IC yet) and place a 10µF + 100nF decoupling capacitor right next to Pin 1 (VCC) and Pin 4 (COM/GND).',
        'Solder the 1N5819 bootstrap diode (stripe toward Pin 8 VB) from Pin 1 (VCC) to Pin 8 (VB), and solder a 1µF ceramic/film capacitor between Pin 8 (VB) and Pin 6 (VS).',
        'Connect Pin 7 (HO) through a 10Ω resistor to Q1 Gate, and Pin 5 (LO) through a 10Ω resistor to Q2 Gate.',
        'Connect Pin 6 (VS) directly to the junction of Q1 Source, Q2 Drain, and L1 input, and add 10kΩ pull-down resistors from Pin 2 (IN) and Pin 3 (SD) to GND.',
      ],
      multimeterCheck: {
        probePoints: 'Ohms mode between Q1 Gate & Source, and between Q2 Gate & Source (IC out)',
        expectedReading: '10kΩ–100kΩ+ (zero dead shorts between Gate, Drain, and Source)',
      },
      hostelTip:
        'Those two 10kΩ pull-down resistors on IR2104 IN and SD pins keep both MOSFETs safely OFF while your ESP32 or Arduino is booting up.',
    },
    {
      stepNumber: 5,
      title: isArduinoControl
        ? 'Wire Arduino Voltage Dividers, Direct ACS712 & Display'
        : 'Wire ESP32 Dividers, Scaled ACS712 & OLED Display',
      duration: '30 min',
      goal: 'Build all analog sensing dividers and verify safe ADC voltages before plugging in your microcontroller.',
      checklist: isArduinoControl
        ? [
            'Solder the PV voltage divider (100kΩ top to PV+, 20kΩ bottom to GND, 5.1V Zener + 100nF across bottom resistor) and route center tap to Arduino A0.',
            'Solder the Battery voltage divider (100kΩ top to Bat+, 33kΩ bottom to GND, 5.1V Zener + 100nF) and route center tap to Arduino A1.',
            'Connect ACS712 #1 VIOUT → Arduino A2, and ACS712 #2 VIOUT → Arduino A3 (with 100nF caps to GND); connect both ACS712 VCC pins to +5V.',
            platform === 'hybrid'
              ? 'Build the UART safety divider: Arduino D11 (TX) → 1kΩ → ESP32 GPIO 16 (RX2) → 2kΩ → GND, plus direct wire ESP32 GPIO 17 → Arduino D10, and tie GNDs together.'
              : 'Connect 16×2 I2C LCD (VCC→5V, GND→GND, SDA→A4, SCL→A5) and DS18B20 data to D2 with a 4.7kΩ pull-up to 5V.',
          ]
        : [
            'Solder the PV voltage divider (100kΩ top to PV+, 10kΩ bottom to GND, 3.3V Zener + 100nF across bottom resistor) and route center tap to ESP32 GPIO 34.',
            'Solder the Battery voltage divider (100kΩ top to Bat+, 15kΩ bottom to GND, 3.3V Zener + 100nF) and route center tap to ESP32 GPIO 35.',
            'Build TWO 5V-to-3.3V dividers (10kΩ top + 20kΩ bottom) on ACS712 #1 & #2 VIOUT pins, routing the midpoints to ESP32 GPIO 32 and GPIO 33.',
            'Connect SSD1306 OLED (VCC→3.3V, GND→GND, SDA→GPIO 21, SCL→GPIO 22) and DS18B20 data to GPIO 4 with a 4.7kΩ pull-up to 3.3V.',
          ],
      multimeterCheck: {
        probePoints: isArduinoControl
          ? 'Apply 12V to PV+ terminal (MCU unplugged) and measure A0 and A2 to GND'
          : 'Apply 12V to PV+ terminal (ESP32 unplugged) and measure GPIO 34 and GPIO 32 sockets',
        expectedReading: isArduinoControl
          ? 'A0 = 2.00 V (never > 5.0 V) · A2 = 2.50 V (at 0 A)'
          : 'GPIO 34 = 1.09 V (never > 3.3 V) · GPIO 32 = 1.67 V (at 0 A)',
      },
      hostelTip:
        'Testing divider voltages with your multimeter BEFORE inserting the ESP32 or Arduino guarantees you will never fry an analog pin with a miswired resistor.',
    },
    {
      stepNumber: 6,
      title: 'Flash Firmware & Perform Indoor Hostel "Smoke-Stopper" Test',
      duration: '25 min',
      goal: 'Verify MPPT switching safely inside your hostel room using a 19V laptop charger and a series test bulb.',
      checklist: [
        'Plug your microcontroller into your laptop via USB and upload the firmware from Section 02 (insert IR2104 into its socket with power OFF).',
        'Connect a 12V battery (even a small 12V 7Ah UPS battery works indoors) to the Battery terminals and confirm the display & Serial Monitor show accurate V_bat.',
        'Simulate the 150Wp PV panel indoors using a 19V laptop power adapter wired IN SERIES with a 12V 21W automotive halogen bulb (acts as a current limiter if anything is shorted).',
        'Observe Serial Monitor: V_pv should lock around ~16–18V, PWM duty should settle near 70–80%, and the bulb should glow dimly or stay off—zero overheating on Q1/Q2.',
      ],
      multimeterCheck: {
        probePoints: 'DC Volts across Battery terminals while 19V laptop adapter is feeding PV+',
        expectedReading: 'Battery voltage rises smoothly by +0.2V to +1.0V; MOSFETs stay cool (< 40°C)',
      },
      hostelTip:
        'A ₹40 12V 21W bike/car indicator bulb wired in series with your test power supply is the best hostel safety trick: if there is a short, the bulb lights up brightly and saves your MOSFETs!',
    },
    {
      stepNumber: 7,
      title: 'Final Enclosure Assembly & Rooftop 150Wp Sunlight Test',
      duration: '30 min',
      goal: 'Mount the tested board in the IP65 box, wire the 40mm cooling fan, and verify real MPPT current boost in sunlight.',
      checklist: [
        'Drill mounting holes in the ABS enclosure for the 40mm 12V fan (powered from the LM2596 12V rail) and mount the PCB on brass standoffs.',
        'Take the unit outside with the 150Wp Polycrystalline panel tilted toward the sun.',
        'ALWAYS connect the 12V Battery FIRST so the controller boots and senses battery voltage, then plug in the MC4 cables from the 150Wp PV panel.',
        'Verify MPPT step-down action on the display: Output Battery Current (I_bat) must be HIGHER than PV Input Current (I_pv) — e.g. 7.8A in at 18.0V becomes ~10.2A out at 13.2V!',
      ],
      multimeterCheck: {
        probePoints: 'Compare PV Input Power (V_pv × I_pv) vs Battery Charge Power (V_bat × I_bat)',
        expectedReading: 'I_bat > I_pv by 15%–30% · Overall efficiency η = 93%–96.5%',
      },
      hostelTip:
        'During project viva/demo, always highlight that I_bat > I_pv! That proves your buck MPPT converter is actually transforming excess PV voltage into extra charging current rather than wasting it like PWM.',
    },
  ];
}

export const HOSTEL_TROUBLESHOOTING: HostelTroubleItem[] = [
  {
    symptom: 'Q1 or Q2 MOSFET heats up rapidly within 5 seconds',
    likelyCause: 'Heatsink tabs shorted together, missing 1µF bootstrap cap, or duty cycle hit 100%.',
    hostelFix:
      'Power off immediately. Check heatsink-to-heatsink isolation with multimeter continuity mode, confirm 1N5819 diode stripe faces IR2104 Pin 8 (VB), and ensure firmware caps duty at ≤ 95%.',
  },
  {
    symptom: 'ESP32 reboots or ADC reads 0V / random spikes when Wi-Fi is active',
    likelyCause: 'Sensors wired to ADC2 pins (GPIO 0, 2, 4, 12–15, 25–27) or weak USB/5V power supply.',
    hostelFix:
      'Keep all 4 analog sensors strictly on ADC1 pins (GPIO 32, 33, 34, 35) and solder a 470µF capacitor across ESP32 VIN and GND.',
  },
  {
    symptom: 'ACS712 current reading shows 0.0A or drifts randomly at no load',
    likelyCause: 'Zero-current midpoint offset differs slightly from ideal 2.50V (or 1.667V scaled).',
    hostelFix:
      'Disconnect PV and load, read the exact raw voltage at the ADC pin with your multimeter, and update zeroOffsetV in code.',
  },
  {
    symptom: 'Buck converter outputs 0V even when PV is at 20V',
    likelyCause: 'Battery is disconnected (V_bat < 9.5V safety lockout) or IR2104 SD pin (Pin 3) is pulled LOW.',
    hostelFix:
      'Connect the 12V battery first, then measure IR2104 Pin 3 (SD) with a multimeter—it must read > 3.0V when charging is active.',
  },
];

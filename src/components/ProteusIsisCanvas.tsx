import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Download,
  MousePointer2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sliders,
  Square,
  StepForward,
  X,
  Zap,
} from 'lucide-react';
import { ControllerPlatform, PLATFORM_META } from '../data/mpptData';
import { ProteusVsmInstruments } from './ProteusVsmInstruments';

interface ProteusIsisCanvasProps {
  platform: ControllerPlatform;
  poweredOn: boolean;
  onTogglePower: (next: boolean) => void;
  validWireCount: number;
  requiredCount: number;
  faultCount: number;
  onAutoWire: () => void;
}

type IsisTool = 'select' | 'probe';

type EditablePartId = 'PV1' | 'R_DIV' | 'Q1_Q2' | 'L1' | 'U1_IR2104' | 'MCU' | 'BAT1';

interface SimParams {
  irradiance: number; // W/m2
  inductanceUh: number; // uH
  fSwKhz: number; // kHz
  rTopKohm: number; // kOhm
  rBotKohm: number; // kOhm
  deadTimeNs: number; // ns
  batVolt: number; // V
  swPvClosed: boolean;
  swBatClosed: boolean;
  swShadeActive: boolean;
}

const DEFAULT_PARAMS: SimParams = {
  irradiance: 1000,
  inductanceUh: 47,
  fSwKhz: 40,
  rTopKohm: 100,
  rBotKohm: 10,
  deadTimeNs: 520,
  batVolt: 13.6,
  swPvClosed: true,
  swBatClosed: true,
  swShadeActive: false,
};

const PROTEUS_LIBRARY = [
  { name: 'IRF3205', category: 'MOSFETs', pkg: 'TO-220AB', model: 'SPICE NMOS 55V 8mΩ', target: 'Q1_Q2' as EditablePartId },
  { name: 'IR2104', category: 'Gate Drivers', pkg: 'DIP-8', model: 'Half-Bridge 520ns DT', target: 'U1_IR2104' as EditablePartId },
  { name: 'INDUCTOR-47U', category: 'Inductors', pkg: 'T106-26 Toroid', model: 'SPICE L=47µH 15A', target: 'L1' as EditablePartId },
  { name: 'RES-DIVIDER', category: 'Resistors', pkg: 'AXIAL-0.4', model: '1% Metal Film 100k/10k', target: 'R_DIV' as EditablePartId },
  { name: '15SQ045', category: 'Diodes', pkg: 'DO-201AD', model: '45V 15A Schottky', target: 'PV1' as EditablePartId },
  { name: 'ESP32-WROOM-32', category: 'Microcontrollers', pkg: 'DEVKIT-30P', model: 'VSM Dual-Core 240MHz', target: 'MCU' as EditablePartId },
  { name: 'ATMEGA328P', category: 'Microcontrollers', pkg: 'DIP-28 / NANO', model: 'VSM AVR 16MHz Timer1', target: 'MCU' as EditablePartId },
  { name: 'ACS712-20A', category: 'Sensors', pkg: 'SOIC-8 Module', model: 'Hall 100mV/A', target: 'PV1' as EditablePartId },
  { name: 'LM2596-12V', category: 'Regulators', pkg: 'TO-263-5', model: 'Buck Aux 12V/5V', target: 'BAT1' as EditablePartId },
  { name: 'OLED-SSD1306', category: 'Displays', pkg: 'I2C 0.96"', model: '128x64 Mono 0x3C', target: 'MCU' as EditablePartId },
  { name: 'DS18B20', category: 'Sensors', pkg: 'TO-92', model: '1-Wire Temp Probe', target: 'MCU' as EditablePartId },
  { name: 'DC VOLTMETER', category: 'Virtual Instruments', pkg: 'VSM Probe', model: 'Analog Node Meter', target: 'PV1' as EditablePartId },
  { name: 'DC AMMETER', category: 'Virtual Instruments', pkg: 'VSM Probe', model: 'Series Current Meter', target: 'BAT1' as EditablePartId },
  { name: 'VIRTUAL TERMINAL', category: 'Virtual Instruments', pkg: 'VSM UART', model: '9600/115200 8N1', target: 'MCU' as EditablePartId },
  { name: 'LOGIC ANALYSER', category: 'Virtual Instruments', pkg: 'VSM Digital', model: '5-Ch 20MHz Timing', target: 'U1_IR2104' as EditablePartId },
];

export function ProteusIsisCanvas({
  platform,
  poweredOn,
  onTogglePower,
  validWireCount,
  requiredCount,
  faultCount,
  onAutoWire,
}: ProteusIsisCanvasProps) {
  const [tool, setTool] = useState<IsisTool>('select');
  const [selectedPart, setSelectedPart] = useState<EditablePartId>('L1');
  const [probedNode, setProbedNode] = useState<string>('SW_NODE');
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simTimeMs, setSimTimeMs] = useState<number>(0);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [pickerQuery, setPickerQuery] = useState<string>('');
  const [pickedDevices, setPickedDevices] = useState<string[]>(['IRF3205', 'IR2104', 'INDUCTOR-47U', 'ACS712-20A']);

  // Sync divider default when switching Arduino (5V) vs ESP32 (3.3V)
  useEffect(() => {
    setParams((prev) => ({
      ...prev,
      rBotKohm: platform === 'arduino' ? 20 : 10,
    }));
  }, [platform]);

  const running = poweredOn && !isPaused;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSimTimeMs((t) => t + 50);
    }, 50);
    return () => window.clearInterval(id);
  }, [running]);

  const adcLimitV = platform === 'arduino' ? 5.0 : 3.3;

  // Real-time nodal & synchronous buck solver
  const solved = useMemo(() => {
    const wiringComplete = faultCount === 0 && validWireCount >= Math.min(10, requiredCount);
    const active = poweredOn && wiringComplete;

    const effSun = params.swShadeActive ? params.irradiance * 0.45 : params.irradiance;
    const vPvOpen = params.swPvClosed ? Number((22.8 * (0.92 + 0.08 * (effSun / 1000))).toFixed(2)) : 0;
    const vPv = !active
      ? params.swPvClosed && poweredOn
        ? vPvOpen
        : 0
      : !params.swPvClosed
        ? 0
        : !params.swBatClosed
          ? vPvOpen
          : Number((18.1 + (effSun / 1000) * 0.65).toFixed(2));

    const vBat = params.swBatClosed ? params.batVolt : 0;
    const divRatio = params.rBotKohm / Math.max(1, params.rTopKohm + params.rBotKohm);
    const vAdcPv = Number((vPv * divRatio).toFixed(2));

    const shootThrough = active && params.swPvClosed && params.swBatClosed && params.deadTimeNs < 100;
    const batLockout = !params.swBatClosed || vBat < 9.5;
    const nightLockout = !params.swPvClosed || vPv < vBat + 0.8;
    const buckSwitching = active && !batLockout && !nightLockout;

    const iPv = buckSwitching
      ? shootThrough
        ? 22.5
        : Number((8.82 * (effSun / 1000)).toFixed(2))
      : 0;
    const duty = buckSwitching ? Math.min(0.95, Math.max(0.1, vBat / Math.max(vPv, 1))) : 0;
    const pPv = vPv * iPv;
    const eff = shootThrough ? 0.12 : 0.962;
    const iBat = buckSwitching && vBat > 1 ? Number(((pPv * eff) / vBat).toFixed(2)) : 0;

    const L = Math.max(5, params.inductanceUh) * 1e-6;
    const fSw = Math.max(10, params.fSwKhz) * 1000;
    const deltaIL = buckSwitching
      ? shootThrough
        ? 85.0
        : Number(((Math.max(0, vPv - vBat) * duty) / (fSw * L)).toFixed(2))
      : 0;
    const iPeak = Number((iBat + deltaIL / 2).toFixed(2));
    const vGateHo = buckSwitching ? Number((vPv + 11.4).toFixed(1)) : 0;
    const vGateLo = buckSwitching ? 12.0 : 0;
    const v12Aux = active && params.swBatClosed ? 12.02 : 0;
    const v5Aux = active && params.swBatClosed ? 5.01 : 0;

    // Electrical Rules Check (ERC)
    const ercErrors: string[] = [];
    if (faultCount > 0) ercErrors.push('3D/Netlist Short-Circuit or Overvoltage Fault detected');
    if (poweredOn && !wiringComplete) {
      ercErrors.push(`Incomplete netlist (${validWireCount}/${requiredCount} wires) — click Auto-Wire`);
    }
    if (vAdcPv > adcLimitV) {
      ercErrors.push(`ADC Overvoltage: R_DIV outputs ${vAdcPv}V > ${adcLimitV}V MCU limit!`);
    }
    if (shootThrough) {
      ercErrors.push(`Shoot-Through Fault: Dead-time ${params.deadTimeNs}ns < 100ns destroys Q1+Q2!`);
    }
    if (iPeak > 15.0) {
      ercErrors.push(`Inductor Saturation: L1 peak ${iPeak}A > 15.0A T106-26 core ceiling!`);
    }

    const nodeVoltages: Record<string, { label: string; value: string; note: string }> = {
      PV_BUS: {
        label: 'NET: PV_BUS (15A Input)',
        value: `${vPv.toFixed(2)} V · ${iPv.toFixed(2)} A`,
        note: params.swPvClosed ? 'Protected 165Wp Mono PERC bus' : 'PV Breaker OPEN (0V)',
      },
      ADC_PV: {
        label: `NET: ADC_PV (${platform === 'arduino' ? 'A0' : 'GPIO34'})`,
        value: `${vAdcPv.toFixed(2)} V / ${adcLimitV.toFixed(1)} V max`,
        note: `Divider ${params.rTopKohm}kΩ / ${params.rBotKohm}kΩ`,
      },
      HO_GATE: {
        label: 'NET: IR2104_HO (Q1 Gate)',
        value: `${vGateHo.toFixed(1)} V pk @ ${params.fSwKhz} kHz`,
        note: `Bootstrap rail (VS + 11.4V) · ${params.deadTimeNs}ns dead-time`,
      },
      LO_GATE: {
        label: 'NET: IR2104_LO (Q2 Gate)',
        value: `${vGateLo.toFixed(1)} V pk @ ${params.fSwKhz} kHz`,
        note: 'Complementary sync rectifier gate drive',
      },
      SW_NODE: {
        label: 'NET: SW_NODE (Q1 Source / L1 In)',
        value: buckSwitching ? `0V ↔ ${vPv.toFixed(1)}V (${(duty * 100).toFixed(1)}% D)` : '0.00 V (Idle)',
        note: `40kHz square wave · ΔI_L = ${deltaIL.toFixed(2)} A p-p`,
      },
      BAT_OUT: {
        label: 'NET: BAT_OUT (12V Bank)',
        value: `${vBat.toFixed(2)} V · ${iBat.toFixed(2)} A`,
        note: params.swBatClosed ? `${(vBat * iBat).toFixed(1)} W Charge Power` : 'Battery OPEN (SD=LOW Lockout)',
      },
      AUX_12V: {
        label: 'NET: VCC_12V / VCC_5V',
        value: `${v12Aux.toFixed(1)} V / ${v5Aux.toFixed(1)} V`,
        note: 'LM2596 + AMS1117 auxiliary power bus',
      },
    };

    return {
      active,
      wiringComplete,
      buckSwitching,
      shootThrough,
      batLockout,
      nightLockout,
      vPv,
      iPv,
      vBat,
      iBat,
      vAdcPv,
      duty,
      deltaIL,
      iPeak,
      v12Aux,
      v5Aux,
      ercErrors,
      nodeVoltages,
    };
  }, [poweredOn, faultCount, validWireCount, requiredCount, params, adcLimitV, platform]);

  const handleExportSpice = () => {
    const periodUs = (1000 / params.fSwKhz).toFixed(2);
    const pulseOnUs = ((1000 / params.fSwKhz) * (solved.duty || 0.72)).toFixed(2);
    const spice = `* Proteus ISIS / SPICE Netlist — SolarMPPT 165Wp Mono PERC (${PLATFORM_META[platform].shortLabel})
* Generated from Interactive ISIS Schematic Capture
V_PV      PV_BUS   0        DC ${solved.vPv > 0 ? solved.vPv.toFixed(2) : '18.70'}
F1_FUSE   PV_BUS   PV_PROT  0.005
D_REV     PV_PROT  PV_NODE  D15SQ045
C_IN      PV_NODE  0        940u IC=18.7
R_DIV_TOP PV_NODE  ADC_PV   ${params.rTopKohm}k
R_DIV_BOT ADC_PV   0        ${params.rBotKohm}k

* Synchronous Half-Bridge (IRF3205 + IR2104 @ ${params.fSwKhz} kHz, Dead-Time ${params.deadTimeNs} ns)
V_HO      HO_GATE  SW_NODE  PULSE(0 12 0 40n 40n ${pulseOnUs}u ${periodUs}u)
V_LO      LO_GATE  0        PULSE(12 0 ${params.deadTimeNs}n 40n 40n ${pulseOnUs}u ${periodUs}u)
M_Q1      PV_NODE  HO_GATE  SW_NODE  SW_NODE  IRF3205
M_Q2      SW_NODE  LO_GATE  0        0        IRF3205

* Output LC Filter & Battery Load
L1_TOROID SW_NODE  BAT_FLT  ${params.inductanceUh}u IC=10.0
R_L1_ESR  BAT_FLT  BAT_NODE 0.018
C_OUT     BAT_NODE 0        2000u IC=${params.batVolt.toFixed(2)}
V_BAT     BAT_NODE 0        DC ${params.batVolt.toFixed(2)}

.model IRF3205 NMOS (VTO=3.2 KP=120 RD=0.004 RS=0.004)
.model D15SQ045 D (IS=1e-6 RS=0.015 N=1.1 BV=45)
.tran 0.25u 500u uic
.end
`;
    const blob = new Blob([spice], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solarmppt-165w-${platform}-isis.cir`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const logicDotColor = (isHigh: boolean, isPwm = false) => {
    if (!solved.active) return '#64748b';
    if (isPwm) return '#f59e0b';
    return isHigh ? '#dc2626' : '#2563eb';
  };

  const formatSimTime = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const rem = ms % 1000;
    return `00:${String(secs % 60).padStart(2, '0')}.${String(rem).padStart(3, '0')}`;
  };

  const currentProbe = solved.nodeVoltages[probedNode] ?? solved.nodeVoltages.SW_NODE;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden text-slate-100 flex flex-col">
      {/* Top Proteus ISIS Menu & Mode Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono font-semibold text-amber-300">
            SOLARMPPT_165W.pdsprj — ISIS Live Schematic Capture
          </span>
          <span className="text-slate-600">·</span>
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded p-0.5">
            <button
              type="button"
              onClick={() => setTool('select')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded cursor-pointer ${
                tool === 'select' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <MousePointer2 className="w-3 h-3" aria-hidden="true" />
              Edit Part
            </button>
            <button
              type="button"
              onClick={() => setTool('probe')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded cursor-pointer ${
                tool === 'probe' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Crosshair className="w-3 h-3" aria-hidden="true" />
              Voltage Probe
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-semibold rounded cursor-pointer ${
              showPicker
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
            }`}
          >
            <Plus className="w-3 h-3" aria-hidden="true" />
            P · Pick Devices ({pickedDevices.length})
          </button>
          {!solved.wiringComplete && (
            <button
              type="button"
              onClick={onAutoWire}
              className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
            >
              Sync / Auto-Wire Netlist
            </button>
          )}
          <button
            type="button"
            onClick={() => setParams(DEFAULT_PARAMS)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            Reset Values
          </button>
          <button
            type="button"
            onClick={handleExportSpice}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
          >
            <Download className="w-3 h-3" aria-hidden="true" />
            Export SPICE (.cir)
          </button>
        </div>
      </div>

      {/* Proteus "Pick Devices" Searchable Library Drawer */}
      {showPicker && (
        <div className="bg-slate-900 border-b border-slate-800 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search Proteus Library (e.g. IRF3205, IR2104, OLED, ATMEGA)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-700 rounded text-white placeholder:text-slate-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-slate-300 hover:text-white bg-slate-800 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Close Library
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
            {PROTEUS_LIBRARY.filter((d) => {
              const q = pickerQuery.trim().toLowerCase();
              return !q || d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.model.toLowerCase().includes(q);
            }).map((dev) => {
              const inList = pickedDevices.includes(dev.name);
              return (
                <button
                  key={dev.name}
                  type="button"
                  onClick={() => {
                    if (!inList) setPickedDevices((prev) => [...prev, dev.name]);
                    setSelectedPart(dev.target);
                  }}
                  className={`text-left px-2.5 py-1.5 rounded border text-[11px] font-mono cursor-pointer transition-colors ${
                    inList
                      ? 'bg-slate-800 border-emerald-500/60 text-white'
                      : 'bg-slate-950 border-slate-700 hover:border-sky-400 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-amber-300">{dev.name}</span>
                    <span className="text-[10px] text-slate-400">{dev.pkg}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {dev.category} · {dev.model}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main ISIS Sheet + Right Property Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12">
        {/* Classic Proteus ISIS Cream Drafting Sheet */}
        <div className="xl:col-span-9 bg-[#f7f5ea] p-2.5 overflow-x-auto border-b xl:border-b-0 xl:border-r border-slate-800">
          <svg
            viewBox="0 0 920 520"
            className={`w-full h-auto font-mono select-none ${tool === 'probe' ? 'cursor-crosshair' : 'cursor-default'}`}
            role="img"
            aria-label="Proteus ISIS interactive schematic capture sheet with live voltmeters, ammeters, logic probes, and clickable switches"
          >
            <defs>
              <pattern id="isisDotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.9" fill="#94a3b8" opacity="0.55" />
              </pattern>
            </defs>

            {/* Drafting Paper & Blue Proteus Border */}
            <rect width="920" height="520" fill="#f7f5ea" />
            <rect width="920" height="520" fill="url(#isisDotGrid)" />
            <rect x="10" y="10" width="900" height="500" fill="none" stroke="#1e3a8a" strokeWidth="2.2" />
            <rect x="14" y="14" width="892" height="492" fill="none" stroke="#1e3a8a" strokeWidth="0.7" />

            {/* Proteus Title Block (Bottom Right) */}
            <g transform="translate(650,455)">
              <rect width="256" height="51" fill="#f7f5ea" stroke="#1e3a8a" strokeWidth="1.2" />
              <line x1="0" y1="22" x2="256" y2="22" stroke="#1e3a8a" strokeWidth="0.9" />
              <text x="8" y="15" fill="#1e3a8a" fontSize="10" fontWeight="bold">
                SOLARMPPT 165Wp SYNC BUCK ({PLATFORM_META[platform].shortLabel.toUpperCase()})
              </text>
              <text x="8" y="36" fill="#334155" fontSize="8.5">
                f_sw: {params.fSwKhz} kHz · L1: {params.inductanceUh} µH · DT: {params.deadTimeNs} ns
              </text>
              <text x="8" y="47" fill="#64748b" fontSize="8">
                SHEET 1 OF 1 · REV 2.4 · VSM LIVE CAPTURE
              </text>
            </g>

            {/* ORTHOGONAL GREEN PROTEUS WIRES */}
            {/* PV+ -> SW_PV -> Ammeter -> Q1 Drain */}
            <polyline
              points="115,120 170,120"
              fill="none"
              stroke={solved.buckSwitching ? '#b91c1c' : '#0f766e'}
              strokeWidth="2.6"
              onClick={() => setProbedNode('PV_BUS')}
              className="cursor-pointer"
            />
            <polyline
              points="218,120 265,120"
              fill="none"
              stroke={solved.buckSwitching ? '#b91c1c' : '#0f766e'}
              strokeWidth="2.6"
              onClick={() => setProbedNode('PV_BUS')}
              className="cursor-pointer"
            />
            <polyline
              points="345,120 430,120"
              fill="none"
              stroke={solved.buckSwitching ? '#b91c1c' : '#0f766e'}
              strokeWidth="2.6"
              onClick={() => setProbedNode('PV_BUS')}
              className="cursor-pointer"
            />
            {/* Tap down to R_DIV */}
            <polyline
              points="250,120 250,245"
              fill="none"
              stroke="#0f766e"
              strokeWidth="2"
              onClick={() => setProbedNode('ADC_PV')}
              className="cursor-pointer"
            />
            <circle cx="250" cy="120" r="3.5" fill="#0f766e" />

            {/* SW_NODE -> L1 -> Output Ammeter -> SW_BAT -> BAT+ */}
            <polyline
              points="495,120 560,120"
              fill="none"
              stroke={solved.buckSwitching ? '#d97706' : '#0f766e'}
              strokeWidth="2.8"
              onClick={() => setProbedNode('SW_NODE')}
              className="cursor-pointer"
            />
            <polyline
              points="642,120 695,120"
              fill="none"
              stroke={solved.buckSwitching ? '#047857' : '#0f766e'}
              strokeWidth="2.8"
              onClick={() => setProbedNode('BAT_OUT')}
              className="cursor-pointer"
            />
            <polyline
              points="775,120 820,120 820,155"
              fill="none"
              stroke={solved.buckSwitching ? '#047857' : '#0f766e'}
              strokeWidth="2.8"
              onClick={() => setProbedNode('BAT_OUT')}
              className="cursor-pointer"
            />

            {/* Ground Return Rail */}
            <polyline
              points="115,205 115,435 820,435 820,255"
              fill="none"
              stroke="#1e3a8a"
              strokeWidth="2.2"
            />
            <line x1="250" y1="340" x2="250" y2="435" stroke="#1e3a8a" strokeWidth="1.8" />
            <line x1="462" y1="215" x2="462" y2="435" stroke="#1e3a8a" strokeWidth="1.8" />
            <circle cx="250" cy="435" r="3.5" fill="#1e3a8a" />
            <circle cx="462" cy="435" r="3.5" fill="#1e3a8a" />

            {/* R_DIV -> MCU ADC */}
            <polyline
              points="250,295 160,295 160,340"
              fill="none"
              stroke="#0284c7"
              strokeWidth="2"
              onClick={() => setProbedNode('ADC_PV')}
              className="cursor-pointer"
            />

            {/* MCU PWM -> IR2104 -> Q1/Q2 Gates */}
            <polyline
              points="220,365 360,365"
              fill="none"
              stroke="#0d9488"
              strokeWidth="2.2"
              onClick={() => setProbedNode('HO_GATE')}
              className="cursor-pointer"
            />
            <polyline
              points="460,325 460,250 430,250 430,158"
              fill="none"
              stroke="#7c3aed"
              strokeWidth="2"
              onClick={() => setProbedNode('HO_GATE')}
              className="cursor-pointer"
            />
            <polyline
              points="480,325 480,260 442,260 442,202"
              fill="none"
              stroke="#9333ea"
              strokeWidth="2"
              onClick={() => setProbedNode('LO_GATE')}
              className="cursor-pointer"
            />

            {/* Live Animated Current Arrows when Buck is Switching */}
            {solved.buckSwitching && !isPaused && (
              <g fill={solved.shootThrough ? '#dc2626' : '#dc2626'}>
                <polygon points="145,114 157,120 145,126" />
                <polygon points="385,114 397,120 385,126" />
                <polygon points="525,114 537,120 525,126" fill="#d97706" />
                <polygon points="665,114 677,120 665,126" fill="#059669" />
              </g>
            )}

            {/* COMPONENT 1: PV1 165Wp Solar Source */}
            <g
              transform="translate(36,100)"
              onClick={() => setSelectedPart('PV1')}
              className="cursor-pointer"
            >
              <rect
                width="79"
                height="105"
                fill="#fef9c3"
                stroke={selectedPart === 'PV1' ? '#2563eb' : '#8b1e1e'}
                strokeWidth={selectedPart === 'PV1' ? '2.5' : '1.8'}
              />
              <text x="40" y="20" textAnchor="middle" fill="#8b1e1e" fontSize="10" fontWeight="bold">
                PV1
              </text>
              <text x="40" y="38" textAnchor="middle" fill="#0f172a" fontSize="9">
                165Wp PERC
              </text>
              <text x="40" y="54" textAnchor="middle" fill="#1d4ed8" fontSize="9" fontWeight="bold">
                {params.swShadeActive ? `${Math.round(params.irradiance * 0.45)}` : params.irradiance} W/m²
              </text>
              <text x="68" y="24" fill="#dc2626" fontSize="10" fontWeight="bold">+</text>
              <text x="68" y="96" fill="#1e3a8a" fontSize="11" fontWeight="bold">-</text>
              {/* Logic state pin dot */}
              <rect x="76" y="16" width="7" height="7" fill={logicDotColor(solved.vPv > 5)} />
            </g>

            {/* INTERACTIVE SWITCH 1: SW_PV Breaker */}
            <g
              transform="translate(170,104)"
              onClick={() => setParams((p) => ({ ...p, swPvClosed: !p.swPvClosed }))}
              className="cursor-pointer"
            >
              <rect x="-4" y="-12" width="56" height="44" fill="#f7f5ea" stroke="#94a3b8" strokeDasharray="2 2" />
              <circle cx="4" cy="16" r="3.5" fill="#8b1e1e" />
              <circle cx="44" cy="16" r="3.5" fill="#8b1e1e" />
              <line
                x1="4"
                y1="16"
                x2={params.swPvClosed ? '44' : '38'}
                y2={params.swPvClosed ? '16' : '0'}
                stroke="#8b1e1e"
                strokeWidth="2.4"
              />
              <text x="24" y="-2" textAnchor="middle" fill="#0f172a" fontSize="8" fontWeight="bold">
                SW_PV ({params.swPvClosed ? 'ON' : 'OFF'})
              </text>
            </g>

            {/* VIRTUAL INSTRUMENT: PV AMMETER (Green Proteus Box) */}
            <g transform="translate(265,98)" onClick={() => setProbedNode('PV_BUS')} className="cursor-pointer">
              <rect width="80" height="44" rx="2" fill="#dcfce7" stroke="#15803d" strokeWidth="1.8" />
              <text x="40" y="14" textAnchor="middle" fill="#166534" fontSize="8" fontWeight="bold">
                DC AMMETER
              </text>
              <text x="40" y="33" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="bold">
                +{solved.iPv.toFixed(2)}A
              </text>
            </g>

            {/* VIRTUAL INSTRUMENT: PV VOLTMETER (Yellow Proteus Box) */}
            <g transform="translate(135,165)" onClick={() => setProbedNode('PV_BUS')} className="cursor-pointer">
              <rect width="82" height="42" rx="2" fill="#fef08a" stroke="#a16207" strokeWidth="1.8" />
              <text x="41" y="13" textAnchor="middle" fill="#854d0e" fontSize="7.5" fontWeight="bold">
                PV VOLTMETER
              </text>
              <text x="41" y="32" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="bold">
                +{solved.vPv.toFixed(1)}V
              </text>
            </g>

            {/* COMPONENT 2: R_DIV Precision Divider */}
            <g
              transform="translate(226,245)"
              onClick={() => setSelectedPart('R_DIV')}
              className="cursor-pointer"
            >
              <rect
                width="48"
                height="95"
                fill="#fef9c3"
                stroke={selectedPart === 'R_DIV' ? '#2563eb' : '#8b1e1e'}
                strokeWidth={selectedPart === 'R_DIV' ? '2.5' : '1.8'}
              />
              <text x="24" y="18" textAnchor="middle" fill="#8b1e1e" fontSize="9" fontWeight="bold">
                R_DIV
              </text>
              <text x="24" y="36" textAnchor="middle" fill="#0f172a" fontSize="8">
                {params.rTopKohm}kΩ
              </text>
              <line x1="6" y1="48" x2="42" y2="48" stroke="#8b1e1e" strokeWidth="1" />
              <text x="24" y="64" textAnchor="middle" fill="#0f172a" fontSize="8">
                {params.rBotKohm}kΩ
              </text>
              <text
                x="24"
                y="84"
                textAnchor="middle"
                fill={solved.vAdcPv > adcLimitV ? '#dc2626' : '#0369a1'}
                fontSize="8.5"
                fontWeight="bold"
              >
                {solved.vAdcPv.toFixed(2)}V
              </text>
            </g>

            {/* COMPONENT 3: Q1 + Q2 Synchronous MOSFET Half-Bridge */}
            <g
              transform="translate(430,92)"
              onClick={() => setSelectedPart('Q1_Q2')}
              className="cursor-pointer"
            >
              <rect
                width="65"
                height="122"
                fill="#fef9c3"
                stroke={
                  solved.shootThrough
                    ? '#dc2626'
                    : selectedPart === 'Q1_Q2'
                      ? '#2563eb'
                      : '#8b1e1e'
                }
                strokeWidth={selectedPart === 'Q1_Q2' || solved.shootThrough ? '2.6' : '1.8'}
              />
              <text x="32" y="18" textAnchor="middle" fill="#8b1e1e" fontSize="9.5" fontWeight="bold">
                Q1 / Q2
              </text>
              <text x="32" y="34" textAnchor="middle" fill="#0f172a" fontSize="8">
                IRF3205
              </text>
              <text x="32" y="54" textAnchor="middle" fill="#475569" fontSize="8">
                High Q1
              </text>
              <line x1="8" y1="64" x2="57" y2="64" stroke="#8b1e1e" strokeDasharray="3 2" />
              <text x="32" y="82" textAnchor="middle" fill="#475569" fontSize="8">
                Sync Q2
              </text>
              <text
                x="32"
                y="106"
                textAnchor="middle"
                fill={solved.shootThrough ? '#dc2626' : '#15803d'}
                fontSize="8"
                fontWeight="bold"
              >
                {solved.shootThrough ? 'BLOWUP!' : '8 mΩ'}
              </text>
              {/* Gate logic state dots */}
              <rect x="-4" y="62" width="7" height="7" fill={logicDotColor(solved.buckSwitching, true)} />
              <rect x="-4" y="104" width="7" height="7" fill={logicDotColor(solved.buckSwitching, true)} />
            </g>

            {/* COMPONENT 4: L1 Toroid Inductor */}
            <g
              transform="translate(560,96)"
              onClick={() => setSelectedPart('L1')}
              className="cursor-pointer"
            >
              <rect
                width="82"
                height="50"
                fill="#fef9c3"
                stroke={solved.iPeak > 15 ? '#dc2626' : selectedPart === 'L1' ? '#2563eb' : '#8b1e1e'}
                strokeWidth={selectedPart === 'L1' ? '2.5' : '1.8'}
              />
              <path
                d="M 8,24 C 12,10 22,10 26,24 C 30,10 40,10 44,24 C 48,10 58,10 62,24 C 66,10 74,10 76,24"
                fill="none"
                stroke="#8b1e1e"
                strokeWidth="2"
              />
              <text x="41" y="42" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                L1 {params.inductanceUh}µH
              </text>
            </g>

            {/* VIRTUAL INSTRUMENT: BATTERY CHARGE AMMETER */}
            <g transform="translate(695,98)" onClick={() => setProbedNode('BAT_OUT')} className="cursor-pointer">
              <rect width="80" height="44" rx="2" fill="#dcfce7" stroke="#15803d" strokeWidth="1.8" />
              <text x="40" y="14" textAnchor="middle" fill="#166534" fontSize="8" fontWeight="bold">
                BAT AMMETER
              </text>
              <text x="40" y="33" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="bold">
                +{solved.iBat.toFixed(2)}A
              </text>
            </g>

            {/* INTERACTIVE SWITCH 2: SW_BAT Fuse/Breaker */}
            <g
              transform="translate(792,155)"
              onClick={() => setParams((p) => ({ ...p, swBatClosed: !p.swBatClosed }))}
              className="cursor-pointer"
            >
              <rect x="-12" y="-4" width="76" height="40" fill="#f7f5ea" stroke="#94a3b8" strokeDasharray="2 2" />
              <circle cx="28" cy="4" r="3.5" fill="#8b1e1e" />
              <circle cx="28" cy="30" r="3.5" fill="#8b1e1e" />
              <line
                x1="28"
                y1="4"
                x2={params.swBatClosed ? '28' : '12'}
                y2={params.swBatClosed ? '30' : '26'}
                stroke="#8b1e1e"
                strokeWidth="2.4"
              />
              <text x="58" y="20" textAnchor="end" fill="#0f172a" fontSize="7.5" fontWeight="bold">
                SW_BAT
              </text>
            </g>

            {/* COMPONENT 5: BAT1 12V Battery Bank */}
            <g
              transform="translate(782,196)"
              onClick={() => setSelectedPart('BAT1')}
              className="cursor-pointer"
            >
              <rect
                width="78"
                height="62"
                fill="#fef9c3"
                stroke={selectedPart === 'BAT1' ? '#2563eb' : '#8b1e1e'}
                strokeWidth={selectedPart === 'BAT1' ? '2.5' : '1.8'}
              />
              <text x="39" y="18" textAnchor="middle" fill="#8b1e1e" fontSize="9.5" fontWeight="bold">
                BAT1
              </text>
              <text x="39" y="36" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
                {params.batVolt.toFixed(1)} V
              </text>
              <text x="39" y="51" textAnchor="middle" fill="#15803d" fontSize="8">
                {(solved.vBat * solved.iBat).toFixed(0)} W IN
              </text>
            </g>

            {/* VIRTUAL INSTRUMENT: BATTERY VOLTMETER */}
            <g transform="translate(675,205)" onClick={() => setProbedNode('BAT_OUT')} className="cursor-pointer">
              <rect width="84" height="42" rx="2" fill="#fef08a" stroke="#a16207" strokeWidth="1.8" />
              <text x="42" y="13" textAnchor="middle" fill="#854d0e" fontSize="7.5" fontWeight="bold">
                BAT VOLTMETER
              </text>
              <text x="42" y="32" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="bold">
                +{solved.vBat.toFixed(2)}V
              </text>
            </g>

            {/* COMPONENT 6: U2 MCU (ESP32 / Arduino) */}
            <g
              transform="translate(128,332)"
              onClick={() => setSelectedPart('MCU')}
              className="cursor-pointer"
            >
              <rect
                width="96"
                height="86"
                fill="#fef9c3"
                stroke={selectedPart === 'MCU' ? '#2563eb' : '#8b1e1e'}
                strokeWidth={selectedPart === 'MCU' ? '2.5' : '1.8'}
              />
              <text x="48" y="18" textAnchor="middle" fill="#8b1e1e" fontSize="9.5" fontWeight="bold">
                U2 MCU
              </text>
              <text x="48" y="34" textAnchor="middle" fill="#0f172a" fontSize="8.5" fontWeight="bold">
                {PLATFORM_META[platform].shortLabel}
              </text>
              <text x="48" y="52" textAnchor="middle" fill="#0d9488" fontSize="8">
                PWM: {(solved.duty * 100).toFixed(0)}%
              </text>
              <text x="48" y="68" textAnchor="middle" fill="#475569" fontSize="7.5">
                {params.fSwKhz} kHz InCond
              </text>
              {/* Logic state pin dot */}
              <rect x="92" y="30" width="7" height="7" fill={logicDotColor(solved.buckSwitching, true)} />
            </g>

            {/* COMPONENT 7: U1 IR2104 Half-Bridge Gate Driver */}
            <g
              transform="translate(360,325)"
              onClick={() => setSelectedPart('U1_IR2104')}
              className="cursor-pointer"
            >
              <rect
                width="136"
                height="78"
                fill="#fef9c3"
                stroke={selectedPart === 'U1_IR2104' ? '#2563eb' : '#8b1e1e'}
                strokeWidth={selectedPart === 'U1_IR2104' ? '2.5' : '1.8'}
              />
              <text x="68" y="18" textAnchor="middle" fill="#8b1e1e" fontSize="9.5" fontWeight="bold">
                U1 IR2104
              </text>
              <text x="68" y="35" textAnchor="middle" fill="#0f172a" fontSize="8.5">
                Half-Bridge Driver
              </text>
              <text x="68" y="51" textAnchor="middle" fill="#7c3aed" fontSize="8" fontWeight="bold">
                DT: {params.deadTimeNs} ns · VCC {solved.v12Aux.toFixed(0)}V
              </text>
              <text
                x="68"
                y="67"
                textAnchor="middle"
                fill={solved.batLockout || solved.nightLockout ? '#dc2626' : '#15803d'}
                fontSize="8"
                fontWeight="bold"
              >
                SD = {solved.buckSwitching ? 'HIGH (EN)' : 'LOW (LOCK)'}
              </text>
            </g>

            {/* INTERACTIVE CLOUD SHADE TOGGLE ON SHEET */}
            <g
              transform="translate(36,230)"
              onClick={() => setParams((p) => ({ ...p, swShadeActive: !p.swShadeActive }))}
              className="cursor-pointer"
            >
              <rect
                width="86"
                height="30"
                rx="3"
                fill={params.swShadeActive ? '#1e293b' : '#dbeafe'}
                stroke="#2563eb"
                strokeWidth="1.4"
              />
              <text
                x="43"
                y="19"
                textAnchor="middle"
                fill={params.swShadeActive ? '#fbbf24' : '#1e3a8a'}
                fontSize="8.5"
                fontWeight="bold"
              >
                {params.swShadeActive ? 'CLOUD: ON' : 'SUN: CLEAR'}
              </text>
            </g>

            {/* LIVE PROBE CALLOUT TAG ON SHEET */}
            <g transform="translate(530,335)">
              <rect width="195" height="58" rx="3" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="8" y="16" fill="#fbbf24" fontSize="8.5" fontWeight="bold">
                PROBE → {currentProbe.label}
              </text>
              <text x="8" y="34" fill="#ffffff" fontSize="10.5" fontWeight="bold">
                {currentProbe.value}
              </text>
              <text x="8" y="49" fill="#94a3b8" fontSize="7.8">
                {currentProbe.note}
              </text>
            </g>
          </svg>
        </div>

        {/* Right: Proteus "Edit Component Properties" Inspector */}
        <div className="xl:col-span-3 bg-slate-900 p-3.5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold border-b border-slate-800 pb-2">
              <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
              Edit Component ({selectedPart})
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <label className="block space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">L1 Inductance</span>
                  <span className="text-amber-300 font-bold">{params.inductanceUh} µH</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={100}
                  step={1}
                  value={params.inductanceUh}
                  onChange={(e) => setParams((p) => ({ ...p, inductanceUh: Number(e.target.value) }))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">PWM Frequency</span>
                  <span className="text-sky-300 font-bold">{params.fSwKhz} kHz</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={5}
                  value={params.fSwKhz}
                  onChange={(e) => setParams((p) => ({ ...p, fSwKhz: Number(e.target.value) }))}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">IR2104 Dead-Time</span>
                  <span className={params.deadTimeNs < 100 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {params.deadTimeNs} ns
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={800}
                  step={40}
                  value={params.deadTimeNs}
                  onChange={(e) => setParams((p) => ({ ...p, deadTimeNs: Number(e.target.value) }))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </label>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400">R_TOP (kΩ)</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={params.rTopKohm}
                    onChange={(e) => setParams((p) => ({ ...p, rTopKohm: Math.max(1, Number(e.target.value)) }))}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-slate-400">R_BOT (kΩ)</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={params.rBotKohm}
                    onChange={(e) => setParams((p) => ({ ...p, rBotKohm: Math.max(1, Number(e.target.value)) }))}
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Battery Voltage</span>
                  <span className="text-emerald-300 font-bold">{params.batVolt.toFixed(1)} V</span>
                </div>
                <input
                  type="range"
                  min={11.0}
                  max={14.6}
                  step={0.2}
                  value={params.batVolt}
                  onChange={(e) => setParams((p) => ({ ...p, batVolt: Number(e.target.value) }))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </label>
            </div>

            {/* Quick Voltage Probe Selector */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Active Voltage Probe Node
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.keys(solved.nodeVoltages).map((nodeKey) => (
                  <button
                    key={nodeKey}
                    type="button"
                    onClick={() => setProbedNode(nodeKey)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer ${
                      probedNode === nodeKey
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {nodeKey}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live ERC Console */}
          <div className="bg-slate-950 border border-slate-800 rounded p-2.5 text-[11px] font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">ISIS ERC SOLVER</span>
              {solved.ercErrors.length === 0 ? (
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  0 Errors
                </span>
              ) : (
                <span className="text-red-400 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  {solved.ercErrors.length} Alert
                </span>
              )}
            </div>
            {solved.ercErrors.length === 0 ? (
              <p className="text-slate-400 text-[10px] leading-snug">
                ΔI_L = {solved.deltaIL}A p-p · Peak {solved.iPeak}A (&lt;15A) · ADC {solved.vAdcPv}V (&lt;{adcLimitV}V).
              </p>
            ) : (
              solved.ercErrors.map((err, i) => (
                <p key={i} className="text-red-300 text-[10px] leading-snug">
                  • {err}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Classic Proteus Bottom Simulation Transport Bar */}
      <div className="bg-slate-900 border-t border-slate-800 px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onTogglePower(true);
              setIsPaused(false);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
              running ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-emerald-400'
            }`}
            title="Run Proteus VSM Simulation"
          >
            <Play className="w-3 h-3" aria-hidden="true" />
            Run
          </button>
          <button
            type="button"
            onClick={() => {
              onTogglePower(true);
              setIsPaused(true);
              setSimTimeMs((t) => t + 25);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            title="Single-Step Simulation"
          >
            <StepForward className="w-3 h-3" aria-hidden="true" />
            Step
          </button>
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            disabled={!poweredOn}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 cursor-pointer"
            title="Pause Simulation"
          >
            <Pause className="w-3 h-3" aria-hidden="true" />
            Pause
          </button>
          <button
            type="button"
            onClick={() => {
              onTogglePower(false);
              setIsPaused(false);
              setSimTimeMs(0);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-red-400 cursor-pointer"
            title="Stop Simulation"
          >
            <Square className="w-3 h-3" aria-hidden="true" />
            Stop
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-300 tabular-nums">
          <span className="flex items-center gap-1.5">
            <Zap className={`w-3.5 h-3.5 ${running ? 'text-emerald-400' : 'text-slate-500'}`} aria-hidden="true" />
            {running ? 'ANIMATING' : isPaused ? 'PAUSED' : 'STOPPED'}: {formatSimTime(simTimeMs)}
          </span>
          <span className="text-slate-400">
            Click <strong className="text-slate-200">SW_PV</strong>, <strong className="text-slate-200">SW_BAT</strong>, or{' '}
            <strong className="text-slate-200">SUN/CLOUD</strong> right on the schematic to test live!
          </span>
        </div>
      </div>

      {/* Proteus VSM Virtual Instruments Dock (UART Terminal, 5-Ch Logic Analyzer, OLED+I2C, MCU .HEX) */}
      <ProteusVsmInstruments
        platform={platform}
        state={{
          running,
          buckSwitching: solved.buckSwitching,
          shootThrough: solved.shootThrough,
          vPv: solved.vPv,
          iPv: solved.iPv,
          vBat: solved.vBat,
          iBat: solved.iBat,
          vAdcPv: solved.vAdcPv,
          duty: solved.duty,
          deltaIL: solved.deltaIL,
          fSwKhz: params.fSwKhz,
          deadTimeNs: params.deadTimeNs,
          inductanceUh: params.inductanceUh,
          simTimeMs,
        }}
      />
    </div>
  );
}

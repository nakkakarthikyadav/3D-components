import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  StepForward,
} from 'lucide-react';
import { ControllerPlatform, PLATFORM_META } from '../data/mpptData';

interface VirtualScopePanelProps {
  platform: ControllerPlatform;
  poweredOn: boolean;
  validWireCount: number;
  requiredCount: number;
  faultCount: number;
}

type TestScenario = 'normal' | 'cold_voc' | 'deadtime_zero' | 'open_bat' | 'night_backfeed';

const SCENARIO_META: Record<
  TestScenario,
  { label: string; short: string; desc: string }
> = {
  normal: {
    label: 'Normal MPPT Run (165Wp)',
    short: 'Normal Run',
    desc: '40 kHz synchronous buck with 520 ns IR2104 hardware dead-time',
  },
  cold_voc: {
    label: 'Cold Morning Voc Surge (24.6V)',
    short: 'Cold Voc 24.6V',
    desc: 'Winter sunrise open-circuit surge checking 35V cap & ADC divider headroom',
  },
  deadtime_zero: {
    label: '0ns Dead-Time Fault (Shoot-Through!)',
    short: 'Shoot-Through Fault',
    desc: 'Simulates shorted HO/LO gate timing causing Q1+Q2 cross-conduction',
  },
  open_bat: {
    label: 'Battery Disconnected (Open Load)',
    short: 'Open Battery',
    desc: 'Verifies IR2104 SD=LOW lockout stops gate drive before cap overvoltage',
  },
  night_backfeed: {
    label: 'Night Back-Feed Lockout (0 W/m²)',
    short: 'Night Back-Feed',
    desc: 'Verifies Q3 anti-reverse MOSFET blocks battery drain into dark panel',
  },
};

export function VirtualScopePanel({
  platform,
  poweredOn,
  validWireCount,
  requiredCount,
  faultCount,
}: VirtualScopePanelProps) {
  const [irradiance, setIrradiance] = useState<number>(1000);
  const [dutyPct, setDutyPct] = useState<number>(73);
  const [timebaseUs, setTimebaseUs] = useState<number>(50); // 2 cycles of 40kHz (25us period)
  const [scenario, setScenario] = useState<TestScenario>('normal');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [phaseUs, setPhaseUs] = useState<number>(0);

  const circuitReady = poweredOn && faultCount === 0 && validWireCount >= Math.min(10, requiredCount);

  useEffect(() => {
    if (!isPlaying || !circuitReady || faultCount > 0) return;
    const timer = window.setInterval(() => {
      setPhaseUs((p) => (p + 1.25) % 25);
    }, 80);
    return () => window.clearInterval(timer);
  }, [isPlaying, circuitReady, faultCount]);

  // Physics-derived buck + thermal/stress solver for 165Wp Mono PERC -> 12V Battery (40kHz, L = 47uH)
  const sim = useMemo(() => {
    if (faultCount > 0) {
      return {
        vPv: 0.0,
        iPv: 0.0,
        vBat: 0.0,
        iBat: 0.0,
        v12Aux: 0.0,
        v5Aux: 0.0,
        deltaI: 0.0,
        esrMohm: 0,
        mosfetLossW: 0,
        mosfetTempC: 28,
        inductorPeakA: 0,
        capRippleRmsA: 0,
        vBoot: 0,
        adcPvPinV: 0,
        isFaultTrip: true,
        statusText: 'SIMULATION HALTED: Wiring Short/Overvoltage Fault detected on 3D PCB!',
      };
    }

    if (!circuitReady) {
      return {
        vPv: poweredOn ? 22.8 : 0.0,
        iPv: 0.0,
        vBat: poweredOn ? 12.8 : 0.0,
        iBat: 0.0,
        v12Aux: 0.0,
        v5Aux: 0.0,
        deltaI: 0.0,
        esrMohm: 0,
        mosfetLossW: 0,
        mosfetTempC: 28,
        inductorPeakA: 0,
        capRippleRmsA: 0,
        vBoot: 0,
        adcPvPinV: 0,
        isFaultTrip: false,
        statusText: poweredOn
          ? `Incomplete wiring (${validWireCount}/${requiredCount} nets) — connect remaining wires or click Auto-Wire Default.`
          : 'Standby: Connect schematic wires and click "Power On 3D" to run VSM Oscilloscope & Stress Solver.',
      };
    }

    if (scenario === 'open_bat') {
      return {
        vPv: 22.9,
        iPv: 0.02,
        vBat: 0.0,
        iBat: 0.0,
        v12Aux: 12.0,
        v5Aux: 5.0,
        deltaI: 0.0,
        esrMohm: 0,
        mosfetLossW: 0.01,
        mosfetTempC: 29,
        inductorPeakA: 0.0,
        capRippleRmsA: 0.0,
        vBoot: 11.3,
        adcPvPinV: 2.08,
        isFaultTrip: false,
        statusText: 'LOCKOUT SAFE: Battery Open → MCU pulls IR2104 SD=LOW · HO/LO Disabled (0V)',
      };
    }

    if (scenario === 'night_backfeed') {
      return {
        vPv: 0.42,
        iPv: 0.0,
        vBat: 12.78,
        iBat: 0.0,
        v12Aux: 11.98,
        v5Aux: 5.0,
        deltaI: 0.0,
        esrMohm: 24,
        mosfetLossW: 0.02,
        mosfetTempC: 28,
        inductorPeakA: 0.0,
        capRippleRmsA: 0.01,
        vBoot: 11.3,
        adcPvPinV: 0.04,
        isFaultTrip: false,
        statusText: 'NIGHT LOCKOUT: Sun = 0 W/m² → Q3 Anti-Reverse MOSFET OFF (Battery Back-Feed = 0.00A)',
      };
    }

    if (scenario === 'deadtime_zero') {
      return {
        vPv: 16.4,
        iPv: 19.5,
        vBat: 12.6,
        iBat: 0.0,
        v12Aux: 11.2,
        v5Aux: 4.98,
        deltaI: 88.0,
        esrMohm: 24,
        mosfetLossW: 94.5,
        mosfetTempC: 218,
        inductorPeakA: 88.4,
        capRippleRmsA: 14.2,
        vBoot: 9.1,
        adcPvPinV: 1.49,
        isFaultTrip: true,
        statusText:
          'SHOOT-THROUGH FAULT (0ns Dead-Time): Q1+Q2 Cross-Conduction 88A Spike! MOSFET Tj = 218°C (>175°C MAX)',
      };
    }

    const effIrradiance = scenario === 'cold_voc' ? Math.max(irradiance, 850) : irradiance;
    const vPv =
      scenario === 'cold_voc'
        ? 24.6
        : Number((18.2 + (effIrradiance / 1000) * 0.5).toFixed(2));
    const iPv = Number((8.82 * (effIrradiance / 1000)).toFixed(2));
    const d = scenario === 'cold_voc' ? 0.56 : dutyPct / 100;
    const vBat = Number(Math.min(14.4, Math.max(12.2, vPv * d)).toFixed(2));
    const eff = 0.962;
    const pBat = vPv * iPv * eff;
    const iBat = Number((pBat / vBat).toFixed(2));

    // ΔI_L = (V_pv - V_bat) * D / (f_sw * L) ; f_sw = 40kHz, L = 47uH
    const fSw = 40000;
    const L = 47e-6;
    const deltaI = Number((Math.max(0, (vPv - vBat) * d) / (fSw * L)).toFixed(2));
    const esrMohm = 24;

    // Thermal & component stress calculations (2x IRF3205 Rds(on)=8mΩ + switching losses)
    const iRmsSq = iBat * iBat + (deltaI * deltaI) / 12;
    const conductionW = iRmsSq * 0.0085;
    const switchingW = 0.5 * vPv * iBat * 65e-9 * fSw;
    const mosfetLossW = Number((conductionW + switchingW).toFixed(2));
    const mosfetTempC = Math.round(30 + mosfetLossW * 11.5); // Small TO-220 heatsink ~11.5 °C/W
    const inductorPeakA = Number((iBat + deltaI / 2).toFixed(2));
    const capRippleRmsA = Number((deltaI / Math.sqrt(12)).toFixed(2));
    const vBoot = Number((12.02 - 0.65).toFixed(2));
    const adcPvPinV = Number((vPv * (10 / 110)).toFixed(2)); // 10k / 100k precision divider

    return {
      vPv,
      iPv,
      vBat,
      iBat,
      v12Aux: 12.02,
      v5Aux: 5.01,
      deltaI,
      esrMohm,
      mosfetLossW,
      mosfetTempC,
      inductorPeakA,
      capRippleRmsA,
      vBoot,
      adcPvPinV,
      isFaultTrip: false,
      statusText:
        scenario === 'cold_voc'
          ? `COLD VOC SURGE SAFE: ${vPv}V Peak → 35V Caps @ 70% · ADC Divider = ${adcPvPinV}V (<3.3V)`
          : `RUNNING (40 kHz Sync Buck): ${vPv}V × ${iPv}A → ${vBat}V @ ${iBat}A (${pBat.toFixed(1)}W, 96.2% Eff)`,
    };
  }, [circuitReady, faultCount, poweredOn, validWireCount, requiredCount, irradiance, dutyPct, scenario]);

  // Generate crisp 4-channel Proteus Virtual Oscilloscope SVG paths (Width 760, 4 stacked channels)
  const paths = useMemo(() => {
    const W = 760;
    const periodUs = 25; // 40 kHz
    const d = scenario === 'cold_voc' ? 0.56 : dutyPct / 100;
    const deadUs = scenario === 'deadtime_zero' ? 0.0 : 0.52;
    const gateActive = circuitReady && scenario !== 'open_bat' && scenario !== 'night_backfeed';

    const makeSquare = (baseY: number, ampPx: number, isHighSide: boolean, overlapShoot = false) => {
      const pts: string[] = [];
      const steps = 380;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * W;
        const tUs = (i / steps) * timebaseUs + phaseUs;
        const phase = (tUs % periodUs) / periodUs;
        let on = false;
        if (gateActive) {
          if (overlapShoot && scenario === 'deadtime_zero') {
            // Overlapping gate pulses causing cross-conduction at edges
            on = isHighSide ? phase <= d + 0.06 : phase >= d - 0.06 && phase <= 0.98;
          } else if (isHighSide) {
            on = phase >= deadUs / periodUs && phase <= d;
          } else {
            on = phase >= d + deadUs / periodUs && phase <= 1 - deadUs / periodUs;
          }
        }
        const y = on ? baseY - ampPx : baseY;
        pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      return pts.join(' ');
    };

    const makeInductorTriangle = (baseY: number, peakPx: number) => {
      const pts: string[] = [];
      const steps = 380;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * W;
        if (!gateActive) {
          pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${baseY.toFixed(1)}`);
          continue;
        }
        const tUs = (i / steps) * timebaseUs + phaseUs;
        const phase = (tUs % periodUs) / periodUs;

        if (scenario === 'deadtime_zero') {
          const isOverlap = (phase >= d - 0.06 && phase <= d + 0.06) || phase >= 0.96 || phase <= 0.04;
          const spike = isOverlap ? peakPx * 1.15 : peakPx * 0.25;
          const y = baseY - spike;
          pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
          continue;
        }

        let norm = 0;
        if (phase <= d) {
          norm = -0.5 + phase / Math.max(0.05, d);
        } else {
          norm = 0.5 - (phase - d) / Math.max(0.05, 1 - d);
        }
        const rippleScale = Math.min(1, sim.deltaI / 4.0);
        const avgLift = (sim.iBat / 14) * (peakPx * 0.55);
        const y = baseY - avgLift - norm * (peakPx * 0.45 * rippleScale);
        pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      return pts.join(' ');
    };

    return {
      ch1Ho: makeSquare(66, 38, true, true),
      ch2Lo: makeSquare(134, 34, false, true),
      ch3Vs: makeSquare(202, 36, true, false),
      ch4Il: makeInductorTriangle(274, 42),
    };
  }, [circuitReady, dutyPct, timebaseUs, phaseUs, sim.deltaI, sim.iBat, scenario]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-slate-100 space-y-4">
      {/* Header Strip + VSM Play/Pause/Step */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
            <Activity className="w-3.5 h-3.5" aria-hidden="true" />
            Proteus VSM-Style Virtual Oscilloscope, Fault Injector &amp; Thermal Solver ({PLATFORM_META[platform].shortLabel})
          </div>
          <div className="text-xs font-mono mt-1 flex items-center gap-2">
            {sim.isFaultTrip ? (
              <span className="text-red-400 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {sim.statusText}
              </span>
            ) : circuitReady ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {sim.statusText}
              </span>
            ) : (
              <span className="text-amber-300">{sim.statusText}</span>
            )}
          </div>
        </div>

        {/* VSM Play / Pause / Step + Interactive Sliders */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono bg-slate-900 border border-slate-800 rounded-md px-3 py-2">
          <div className="flex items-center gap-1 pr-2 border-r border-slate-700">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                isPlaying ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600 text-white'
              }`}
              title={isPlaying ? 'Pause Live Scope' : 'Play Live Scope'}
            >
              {isPlaying ? <Pause className="w-3 h-3" aria-hidden="true" /> : <Play className="w-3 h-3" aria-hidden="true" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setPhaseUs((p) => (p + 2) % 25);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              title="Single-step +2 µs"
            >
              <StepForward className="w-3 h-3" aria-hidden="true" />
              +2µs
            </button>
            <button
              type="button"
              onClick={() => {
                setScenario('normal');
                setPhaseUs(0);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="Reset Scenario to Normal Run"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>

          <label className="flex items-center gap-2">
            <span className="text-slate-400">Sun: {irradiance} W/m²</span>
            <input
              type="range"
              min={200}
              max={1000}
              step={50}
              value={irradiance}
              onChange={(e) => setIrradiance(Number(e.target.value))}
              className="w-16 accent-amber-400 cursor-pointer"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Duty: {dutyPct}%</span>
            <input
              type="range"
              min={55}
              max={85}
              step={1}
              value={dutyPct}
              onChange={(e) => setDutyPct(Number(e.target.value))}
              className="w-16 accent-sky-400 cursor-pointer"
            />
          </label>
          <div className="flex items-center gap-1">
            <span className="text-slate-400 mr-1">Span:</span>
            {[25, 50, 100].map((tb) => (
              <button
                key={tb}
                type="button"
                onClick={() => setTimebaseUs(tb)}
                className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                  timebaseUs === tb ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {tb}µs
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Proteus VSM Transient & Fault Test Scenarios */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/70 border border-slate-800 rounded-md p-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1.5 font-semibold">
          Fault / Transient Stress Tests:
        </span>
        {(Object.keys(SCENARIO_META) as TestScenario[]).map((key) => {
          const active = scenario === key;
          const isDanger = key === 'deadtime_zero';
          return (
            <button
              key={key}
              type="button"
              onClick={() => setScenario(key)}
              title={SCENARIO_META[key].desc}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                active
                  ? isDanger
                    ? 'bg-red-600 text-white font-semibold'
                    : 'bg-sky-600 text-white font-semibold'
                  : isDanger
                    ? 'bg-red-950/60 hover:bg-red-900/70 text-red-300 border border-red-800/70'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {SCENARIO_META[key].short}
            </button>
          );
        })}
      </div>

      {/* Main Split: 4-Ch Digital Oscilloscope (Left) + Virtual DC Volt/Amp Probes (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Proteus-style 4-Channel Oscilloscope */}
        <div className="lg:col-span-8 bg-[#050a14] border border-slate-800 rounded-md p-2.5">
          <svg
            viewBox="0 0 760 296"
            className="w-full h-auto font-mono select-none"
            role="img"
            aria-label="4-Channel Digital Oscilloscope showing 40kHz IR2104 HO, LO, VS switch node, and 47uH inductor ripple current"
          >
            <defs>
              <pattern id="scopeGrid" width="38" height="34" patternUnits="userSpaceOnUse">
                <path d="M 38 0 L 0 0 0 34" fill="none" stroke="#162238" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="760" height="296" fill="url(#scopeGrid)" rx="4" />

            {/* Channel Baseline Guides */}
            <line x1="0" y1="66" x2="760" y2="66" stroke="#334155" strokeDasharray="3 4" strokeWidth="0.7" />
            <line x1="0" y1="134" x2="760" y2="134" stroke="#334155" strokeDasharray="3 4" strokeWidth="0.7" />
            <line x1="0" y1="202" x2="760" y2="202" stroke="#334155" strokeDasharray="3 4" strokeWidth="0.7" />
            <line x1="0" y1="274" x2="760" y2="274" stroke="#334155" strokeDasharray="3 4" strokeWidth="0.7" />

            {/* Live Waveforms */}
            <path d={paths.ch1Ho} fill="none" stroke="#facc15" strokeWidth="2.2" />
            <path d={paths.ch2Lo} fill="none" stroke="#38bdf8" strokeWidth="2.2" />
            <path d={paths.ch3Vs} fill="none" stroke="#e879f9" strokeWidth="2.2" />
            <path
              d={paths.ch4Il}
              fill="none"
              stroke={scenario === 'deadtime_zero' && circuitReady ? '#ef4444' : '#34d399'}
              strokeWidth="2.4"
            />

            {/* Channel Labels */}
            <text x="10" y="20" fill="#facc15" fontSize="11" fontWeight="bold">
              CH A: IR2104 HO (High Gate 26V Boot) · {scenario === 'deadtime_zero' ? '0ns DEAD-TIME!' : '40 kHz'}
            </text>
            <text x="10" y="92" fill="#38bdf8" fontSize="11" fontWeight="bold">
              CH B: IR2104 LO (Low Sync Gate 12V) · {scenario === 'deadtime_zero' ? 'OVERLAP FAULT' : '520ns Dead-Time'}
            </text>
            <text x="10" y="160" fill="#e879f9" fontSize="11" fontWeight="bold">
              CH C: Switch Node VS ({circuitReady && scenario !== 'open_bat' && scenario !== 'night_backfeed' ? `${sim.vPv}V` : '0V'} Square Wave)
            </text>
            <text
              x="10"
              y="226"
              fill={scenario === 'deadtime_zero' && circuitReady ? '#f87171' : '#34d399'}
              fontSize="11"
              fontWeight="bold"
            >
              {scenario === 'deadtime_zero' && circuitReady
                ? 'CH D: SHOOT-THROUGH CURRENT SPIKE (>88A PEAK — MOSFET FAILURE!)'
                : `CH D: L1 47µH Inductor Current (Avg ${sim.iBat}A · ΔIpp ${sim.deltaI}A · ESR ${sim.esrMohm}mΩ)`}
            </text>
          </svg>
        </div>

        {/* Proteus-style Yellow/Green Digital DC Probe Meters */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-2.5">
          {[
            {
              title: 'PV+ INPUT METER',
              val: `${sim.vPv.toFixed(2)} V`,
              sub: `${sim.iPv.toFixed(2)} A (${(sim.vPv * sim.iPv).toFixed(0)} W)`,
              color: 'text-amber-300 border-amber-500/40',
            },
            {
              title: 'BATTERY OUT METER',
              val: `${sim.vBat.toFixed(2)} V`,
              sub: `${sim.iBat.toFixed(2)} A Charge`,
              color: 'text-emerald-300 border-emerald-500/40',
            },
            {
              title: '12V / 5V AUX RAILS',
              val: `${sim.v12Aux.toFixed(1)}V / ${sim.v5Aux.toFixed(1)}V`,
              sub: circuitReady ? `V_boot: ${sim.vBoot.toFixed(1)}V` : 'Aux Rail Offline',
              color: 'text-purple-300 border-purple-500/40',
            },
            {
              title: 'ADC & BATTERY ESR',
              val: `${sim.esrMohm} mΩ`,
              sub: `ADC Pin: ${sim.adcPvPinV.toFixed(2)}V (<3.3V)`,
              color: 'text-sky-300 border-sky-500/40',
            },
          ].map((meter) => (
            <div
              key={meter.title}
              className={`bg-slate-900 border ${meter.color.split(' ')[1]} rounded-md p-3 flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>{meter.title}</span>
                <Gauge className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              </div>
              <div className={`text-lg font-mono font-bold tabular-nums mt-2 ${meter.color.split(' ')[0]}`}>
                {meter.val}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">{meter.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Component Thermal & Stress Margin DRC Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
        <div
          className={`rounded-md border px-3 py-2 flex items-center justify-between ${
            sim.mosfetTempC > 150
              ? 'bg-red-950/70 border-red-500 text-red-200'
              : 'bg-slate-900 border-slate-800 text-slate-200'
          }`}
        >
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            Q1/Q2 Loss &amp; Tj
          </span>
          <span className="font-bold tabular-nums">
            {sim.mosfetLossW}W · {sim.mosfetTempC}°C / 175°C
          </span>
        </div>

        <div
          className={`rounded-md border px-3 py-2 flex items-center justify-between ${
            sim.inductorPeakA > 15
              ? 'bg-red-950/70 border-red-500 text-red-200'
              : 'bg-slate-900 border-slate-800 text-slate-200'
          }`}
        >
          <span className="text-[11px] text-slate-400">L1 Peak vs 15A Sat</span>
          <span className="font-bold tabular-nums">{sim.inductorPeakA} A / 15.0 A</span>
        </div>

        <div
          className={`rounded-md border px-3 py-2 flex items-center justify-between ${
            sim.capRippleRmsA > 4.2
              ? 'bg-red-950/70 border-red-500 text-red-200'
              : 'bg-slate-900 border-slate-800 text-slate-200'
          }`}
        >
          <span className="text-[11px] text-slate-400">Cap RMS Ripple</span>
          <span className="font-bold tabular-nums">{sim.capRippleRmsA} A / 4.2 A</span>
        </div>

        <div
          className={`rounded-md border px-3 py-2 flex items-center justify-between ${
            circuitReady && sim.vBoot < 10
              ? 'bg-red-950/70 border-red-500 text-red-200'
              : 'bg-slate-900 border-slate-800 text-slate-200'
          }`}
        >
          <span className="text-[11px] text-slate-400">IR2104 Boot UVLO</span>
          <span className="font-bold tabular-nums">{sim.vBoot.toFixed(1)} V (&gt;10.0V)</span>
        </div>
      </div>
    </div>
  );
}


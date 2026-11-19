import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Cable, Cpu, Layers, ShieldCheck, Zap } from 'lucide-react';
import {
  ControllerPlatform,
  getCircuitNodes,
  getPointToPointWiring,
  PLATFORM_META,
  SubsystemLayer,
} from '../data/mpptData';

const LAYER_FILTERS: { id: SubsystemLayer; label: string }[] = [
  { id: 'all', label: 'All Connections' },
  { id: 'power', label: 'Power Stage (12A)' },
  { id: 'sensing', label: 'MCU & ADC Sensing' },
  { id: 'driver', label: 'IR2104 & Aux Rails' },
  { id: 'protection', label: 'Fuses & Isolation' },
];

interface CircuitSchematicProps {
  platform: ControllerPlatform;
  onChangePlatform: (p: ControllerPlatform) => void;
}

export function CircuitSchematic({ platform, onChangePlatform }: CircuitSchematicProps) {
  const [selectedId, setSelectedId] = useState<string>('buck_stage');
  const [activeLayer, setActiveLayer] = useState<SubsystemLayer>('all');
  const [animateFlow, setAnimateFlow] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'diagram' | 'wirelist'>('diagram');

  const circuitNodes = useMemo(() => getCircuitNodes(platform), [platform]);
  const wireList = useMemo(() => getPointToPointWiring(platform), [platform]);
  const selectedNode = circuitNodes[selectedId] ?? circuitNodes.buck_stage;

  const isArduinoControl = platform === 'arduino' || platform === 'hybrid';

  const isHighlighted = (nodeLayer: Exclude<SubsystemLayer, 'all'>) =>
    activeLayer === 'all' || activeLayer === nodeLayer;

  const nodeOpacity = (nodeLayer: Exclude<SubsystemLayer, 'all'>) =>
    isHighlighted(nodeLayer) ? 1 : 0.25;

  const wireOpacity = (wireLayer: Exclude<SubsystemLayer, 'all'>) =>
    activeLayer === 'all' || activeLayer === wireLayer ? 1 : 0.16;

  const flowClass = (wireLayer: Exclude<SubsystemLayer, 'all'>) =>
    animateFlow && isHighlighted(wireLayer) ? 'animate-current-flow' : '';

  const blockBorder = (id: string, defaultColor: string) =>
    selectedId === id ? '#2563EB' : defaultColor;

  const blockWidth = (id: string) => (selectedId === id ? 2.5 : 1.4);

  return (
    <section id="schematic" className="scroll-mt-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-blue-600 mb-1">
            01. Hardware Architecture &amp; Connection Diagram
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            150Wp MPPT Circuit &amp; Connection Diagram
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Switch between <span className="font-medium text-slate-900">ESP32</span>,{' '}
            <span className="font-medium text-slate-900">Arduino Uno/Nano</span>, or{' '}
            <span className="font-medium text-slate-900">Arduino + ESP32 Hybrid</span> to inspect
            exact pin connections, voltage dividers, and point-to-point wiring.
          </p>
        </div>

        {/* Platform Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 border border-slate-200 rounded-lg">
            {(['esp32', 'arduino', 'hybrid'] as ControllerPlatform[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChangePlatform(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  platform === p
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {PLATFORM_META[p].shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-toolbar: View Mode + Layer Filter + Flow Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white border border-slate-200 rounded-lg px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setViewMode('diagram')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                viewMode === 'diagram'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              Schematic Diagram
            </button>
            <button
              type="button"
              onClick={() => setViewMode('wirelist')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                viewMode === 'wirelist'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cable className="w-3.5 h-3.5" aria-hidden="true" />
              Wire-by-Wire Connection Table ({wireList.length})
            </button>
          </div>

          {viewMode === 'diagram' && (
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md">
              {LAYER_FILTERS.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setActiveLayer(layer.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeLayer === layer.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {layer.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs font-mono text-slate-500">
            {PLATFORM_META[platform].pwmSpec}
          </span>
          {viewMode === 'diagram' && (
            <button
              type="button"
              onClick={() => setAnimateFlow((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                animateFlow
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" aria-hidden="true" />
              {animateFlow ? 'Flow Active' : 'Flow Paused'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 border border-slate-200 bg-white rounded-lg overflow-hidden">
        {/* Main Interactive Schematic or Wire-by-Wire Connection List */}
        <div className="xl:col-span-8 blueprint-grid border-b xl:border-b-0 xl:border-r border-slate-200 p-4 flex flex-col justify-between">
          {viewMode === 'wirelist' ? (
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Point-to-Point Connection Checklist — {PLATFORM_META[platform].label}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Follow wires W01–W{wireList.length} in sequence when assembling on PCB or perfboard.
                  </p>
                </div>
                <span className="text-xs font-mono text-blue-700 font-semibold">
                  {PLATFORM_META[platform].logicLevel}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-mono uppercase text-slate-500">
                      <th className="py-2 px-3">Wire</th>
                      <th className="py-2 px-3">From Terminal</th>
                      <th className="py-2 px-3">To Terminal</th>
                      <th className="py-2 px-3">Cable / Gauge</th>
                      <th className="py-2 px-3">Function</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {wireList.map((w) => (
                      <tr key={w.wireNo} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {w.wireNo}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-800">{w.from}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">{w.to}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {w.wireSpec}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{w.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-slate-200/80 text-xs font-mono text-slate-500">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-amber-600 inline-block" />
                    Power Bus (12A)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-blue-600 inline-block" />
                    ADC / Signal Lines
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-cyan-600 inline-block" />
                    Gate Drive &amp; 12V/5V Aux
                  </span>
                  {platform === 'hybrid' && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-violet-600 inline-block" />
                      UART Bridge (5V→3.3V)
                    </span>
                  )}
                </div>
                <span>{PLATFORM_META[platform].label}</span>
              </div>

              <div className="w-full overflow-x-auto">
                <svg
                  viewBox="0 0 980 560"
                  className="w-full h-auto min-w-[740px] select-none"
                  role="img"
                  aria-label={`Interactive ${PLATFORM_META[platform].label} 150Wp Solar MPPT Circuit Schematic`}
                >
                  <defs>
                    <marker id="arrowAmber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#D97706" />
                    </marker>
                    <marker id="arrowBlue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563EB" />
                    </marker>
                    <marker id="arrowCyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#0891B2" />
                    </marker>
                    <marker id="arrowViolet" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#7C3AED" />
                    </marker>
                  </defs>

                  {/* ================= POWER BUS RAILS ================= */}
                  <g opacity={wireOpacity('protection')}>
                    <line
                      x1="155"
                      y1="95"
                      x2="215"
                      y2="95"
                      stroke="#D97706"
                      strokeWidth="3"
                      className={flowClass('protection')}
                      markerEnd="url(#arrowAmber)"
                    />
                    <text x="185" y="85" textAnchor="middle" className="fill-amber-700 font-mono text-[10px] font-semibold">
                      V_PV+
                    </text>
                  </g>

                  <g opacity={wireOpacity('power')}>
                    <line
                      x1="340"
                      y1="95"
                      x2="415"
                      y2="95"
                      stroke="#D97706"
                      strokeWidth="3"
                      className={flowClass('power')}
                      markerEnd="url(#arrowAmber)"
                    />
                    <text x="377" y="85" textAnchor="middle" className="fill-amber-700 font-mono text-[10px]">
                      18.2V / 8.2A
                    </text>
                    <line
                      x1="640"
                      y1="95"
                      x2="700"
                      y2="95"
                      stroke="#D97706"
                      strokeWidth="3"
                      className={flowClass('power')}
                      markerEnd="url(#arrowAmber)"
                    />
                    <text x="670" y="85" textAnchor="middle" className="fill-amber-700 font-mono text-[10px]">
                      L1 Out
                    </text>
                  </g>

                  <g opacity={wireOpacity('protection')}>
                    <line
                      x1="815"
                      y1="95"
                      x2="855"
                      y2="95"
                      stroke="#D97706"
                      strokeWidth="3"
                      className={flowClass('protection')}
                      markerEnd="url(#arrowAmber)"
                    />
                  </g>

                  {/* Common Ground Bus */}
                  <g opacity={0.9}>
                    <line x1="90" y1="518" x2="910" y2="518" stroke="#475569" strokeWidth="2.5" />
                    <text x="500" y="538" textAnchor="middle" className="fill-slate-600 font-mono text-[11px] font-semibold">
                      COMMON STAR GROUND PLANE (0V GND — 12 AWG POWER RETURN + LOGIC GND)
                    </text>
                    <line x1="95" y1="145" x2="95" y2="518" stroke="#64748B" strokeWidth="1.5" />
                    <line x1="250" y1="262" x2="250" y2="518" stroke="#64748B" strokeWidth="1.5" />
                    <line x1="525" y1="180" x2="525" y2="518" stroke="#64748B" strokeWidth="1.5" />
                    <line x1="758" y1="262" x2="758" y2="518" stroke="#64748B" strokeWidth="1.5" />
                    <line x1="910" y1="200" x2="910" y2="518" stroke="#64748B" strokeWidth="1.5" />
                    <circle cx="95" cy="518" r="3.5" fill="#475569" />
                    <circle cx="250" cy="518" r="3.5" fill="#475569" />
                    <circle cx="525" cy="518" r="3.5" fill="#475569" />
                    <circle cx="758" cy="518" r="3.5" fill="#475569" />
                    <circle cx="910" cy="518" r="3.5" fill="#475569" />
                  </g>

                  {/* ================= SENSING & SIGNAL WIRES ================= */}
                  <g opacity={wireOpacity('sensing')}>
                    <line x1="185" y1="95" x2="185" y2="215" stroke="#D97706" strokeWidth="1.8" />
                    <circle cx="185" cy="95" r="3.5" fill="#D97706" />
                    <line x1="185" y1="215" x2="205" y2="215" stroke="#D97706" strokeWidth="1.8" />

                    {/* PV Divider -> MCU */}
                    <path
                      d="M 275 262 L 275 340 L 385 340"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="1.8"
                      className={flowClass('sensing')}
                      markerEnd="url(#arrowBlue)"
                    />
                    <text x="328" y="333" textAnchor="middle" className="fill-blue-700 font-mono text-[10px] font-semibold">
                      {isArduinoControl ? 'Pin A0 (V_PV)' : 'GPIO 34 (V_PV)'}
                    </text>

                    {/* ACS712 PV -> MCU */}
                    <path
                      d="M 295 140 L 295 168 L 365 168 L 365 372 L 385 372"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="1.8"
                      className={flowClass('sensing')}
                      markerEnd="url(#arrowBlue)"
                    />
                    <text x="330" y="390" textAnchor="middle" className="fill-blue-700 font-mono text-[10px] font-semibold">
                      {isArduinoControl ? 'Pin A2 (I_PV)' : 'GPIO 32 (I_PV)'}
                    </text>

                    {/* Bat+ tap down */}
                    <line x1="835" y1="95" x2="835" y2="215" stroke="#D97706" strokeWidth="1.8" />
                    <circle cx="835" cy="95" r="3.5" fill="#D97706" />
                    <line x1="835" y1="215" x2="810" y2="215" stroke="#D97706" strokeWidth="1.8" />

                    {/* ACS712 Bat -> MCU */}
                    <path
                      d="M 735 140 L 735 168 L 650 168 L 650 372 L 605 372"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="1.8"
                      className={flowClass('sensing')}
                      markerEnd="url(#arrowBlue)"
                    />
                    <text x="646" y="390" textAnchor="middle" className="fill-blue-700 font-mono text-[10px] font-semibold">
                      {isArduinoControl ? 'Pin A3 (I_BAT)' : 'GPIO 33 (I_BAT)'}
                    </text>

                    {/* Bat Voltage Divider -> MCU */}
                    <path
                      d="M 725 262 L 725 340 L 605 340"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="1.8"
                      className={flowClass('sensing')}
                      markerEnd="url(#arrowBlue)"
                    />
                    <text x="665" y="333" textAnchor="middle" className="fill-blue-700 font-mono text-[10px] font-semibold">
                      {isArduinoControl ? 'Pin A1 (V_BAT)' : 'GPIO 35 (V_BAT)'}
                    </text>
                  </g>

                  {/* ================= GATE DRIVER & AUX WIRES ================= */}
                  <g opacity={wireOpacity('driver')}>
                    <line
                      x1="465"
                      y1="320"
                      x2="465"
                      y2="275"
                      stroke="#0891B2"
                      strokeWidth="1.8"
                      className={flowClass('driver')}
                      markerEnd="url(#arrowCyan)"
                    />
                    <text x="456" y="302" textAnchor="end" className="fill-cyan-700 font-mono text-[10px] font-semibold">
                      {isArduinoControl ? 'D9 PWM' : 'GPIO 18 PWM'}
                    </text>
                    <line
                      x1="515"
                      y1="320"
                      x2="515"
                      y2="275"
                      stroke="#0891B2"
                      strokeWidth="1.8"
                      markerEnd="url(#arrowCyan)"
                    />
                    <text x="524" y="302" textAnchor="start" className="fill-cyan-700 font-mono text-[10px] font-semibold">
                      {isArduinoControl ? 'D8 SD' : 'GPIO 19 SD'}
                    </text>

                    <line x1="470" y1="205" x2="470" y2="180" stroke="#0891B2" strokeWidth="1.8" markerEnd="url(#arrowCyan)" />
                    <text x="456" y="196" textAnchor="end" className="fill-cyan-700 font-mono text-[10px]">
                      HO / VS
                    </text>
                    <line x1="540" y1="205" x2="540" y2="180" stroke="#0891B2" strokeWidth="1.8" markerEnd="url(#arrowCyan)" />
                    <text x="552" y="196" textAnchor="start" className="fill-cyan-700 font-mono text-[10px]">
                      LO
                    </text>

                    {/* Aux Supply Feeds */}
                    <path d="M 885 200 L 885 450 L 795 450" fill="none" stroke="#0891B2" strokeWidth="1.6" strokeDasharray="4 3" />
                    <text x="842" y="442" textAnchor="middle" className="fill-cyan-700 font-mono text-[9.5px]">
                      Bat+ Feed
                    </text>

                    <path d="M 655 430 L 580 430 L 580 245 L 570 245" fill="none" stroke="#0891B2" strokeWidth="1.6" markerEnd="url(#arrowCyan)" />
                    <text x="618" y="422" textAnchor="middle" className="fill-cyan-700 font-mono text-[10px] font-semibold">
                      +12V VCC
                    </text>

                    <line x1="655" y1="468" x2="605" y2="468" stroke="#0891B2" strokeWidth="1.6" markerEnd="url(#arrowCyan)" />
                    <text x="630" y="460" textAnchor="middle" className="fill-cyan-700 font-mono text-[10px] font-semibold">
                      +5V VIN
                    </text>
                  </g>

                  {/* Protection Q3 Control */}
                  <g opacity={wireOpacity('protection')}>
                    <path d="M 605 405 L 885 405 L 885 200" fill="none" stroke="#059669" strokeWidth="1.6" strokeDasharray="5 3" />
                    <text x="745" y="398" textAnchor="middle" className="fill-emerald-700 font-mono text-[10px] font-semibold">
                      {isArduinoControl ? 'Pin D7 → Q3 Night-Disconnect' : 'GPIO 25 → Q3 Night-Disconnect'}
                    </text>
                  </g>

                  {/* Hybrid Mode UART Bridge Wire & ESP32 Telemetry Node */}
                  {platform === 'hybrid' && (
                    <g opacity={wireOpacity('sensing')}>
                      <line
                        x1="385"
                        y1="448"
                        x2="215"
                        y2="448"
                        stroke="#7C3AED"
                        strokeWidth="2"
                        className={flowClass('sensing')}
                        markerEnd="url(#arrowViolet)"
                      />
                      <text x="300" y="438" textAnchor="middle" className="fill-violet-700 font-mono text-[9.5px] font-semibold">
                        D11 TX → 1k/2k → RX2 (16)
                      </text>
                      <g onClick={() => setSelectedId('mcu_stage')} className="cursor-pointer">
                        <rect
                          x="35"
                          y="406"
                          width="180"
                          height="84"
                          rx="6"
                          fill="#F5F3FF"
                          stroke={blockBorder('mcu_stage', '#7C3AED')}
                          strokeWidth={blockWidth('mcu_stage')}
                        />
                        <text x="125" y="426" textAnchor="middle" className="fill-slate-900 font-sans text-[11px] font-bold">
                          ESP32 Wi-Fi Telemetry
                        </text>
                        <text x="125" y="443" textAnchor="middle" className="fill-violet-800 font-mono text-[9.5px]">
                          RX2: GPIO 16 · TX2: GPIO 17
                        </text>
                        <text x="125" y="459" textAnchor="middle" className="fill-slate-600 font-mono text-[9px]">
                          5V→3.3V Divider (1kΩ / 2kΩ)
                        </text>
                        <text x="125" y="475" textAnchor="middle" className="fill-slate-600 font-mono text-[9px]">
                          SoftAP Web Dashboard
                        </text>
                      </g>
                    </g>
                  )}

                  {/* ================= CLICKABLE SUBSYSTEM BLOCKS ================= */}
                  {/* 1. 150Wp PV Input */}
                  <g onClick={() => setSelectedId('pv_input')} className="cursor-pointer" opacity={nodeOpacity('protection')}>
                    <rect
                      x="25"
                      y="40"
                      width="130"
                      height="105"
                      rx="6"
                      fill="#FFFBEB"
                      stroke={blockBorder('pv_input', '#D97706')}
                      strokeWidth={blockWidth('pv_input')}
                    />
                    <text x="90" y="60" textAnchor="middle" className="fill-slate-900 font-sans text-[11px] font-bold">
                      150Wp Poly PV
                    </text>
                    <text x="90" y="76" textAnchor="middle" className="fill-amber-700 font-mono text-[10px]">
                      18.2Vmp · 8.24Imp
                    </text>
                    <line x1="37" y1="88" x2="143" y2="88" stroke="#FDE68A" strokeWidth="1" />
                    <text x="90" y="104" textAnchor="middle" className="fill-slate-700 font-mono text-[9.5px]">
                      15A Fuse + 15SQ045
                    </text>
                    <text x="90" y="118" textAnchor="middle" className="fill-slate-700 font-mono text-[9.5px]">
                      SMBJ26A TVS Clamp
                    </text>
                    <text x="90" y="133" textAnchor="middle" className="fill-slate-500 font-mono text-[9px]">
                      C_in: 2× 470µF/35V
                    </text>
                  </g>

                  {/* 2. ACS712-20A PV Input */}
                  <g onClick={() => setSelectedId('acs_pv')} className="cursor-pointer" opacity={nodeOpacity('sensing')}>
                    <rect
                      x="215"
                      y="55"
                      width="125"
                      height="85"
                      rx="6"
                      fill="#EFF6FF"
                      stroke={blockBorder('acs_pv', '#2563EB')}
                      strokeWidth={blockWidth('acs_pv')}
                    />
                    <text x="277" y="75" textAnchor="middle" className="fill-slate-900 font-sans text-[11px] font-bold">
                      ACS712-20A (PV)
                    </text>
                    <text x="277" y="92" textAnchor="middle" className="fill-blue-700 font-mono text-[10px]">
                      Hall Current Sensor
                    </text>
                    <text x="277" y="109" textAnchor="middle" className="fill-slate-600 font-mono text-[9.5px]">
                      {isArduinoControl ? 'Direct 5V Output' : '10kΩ/20kΩ Divider'}
                    </text>
                    <text x="277" y="124" textAnchor="middle" className="fill-slate-500 font-mono text-[9px]">
                      {isArduinoControl ? '→ Arduino A2' : '→ GPIO 32 (ADC1)'}
                    </text>
                  </g>

                  {/* 3. PV Voltage Divider */}
                  <g onClick={() => setSelectedId('vdiv_pv')} className="cursor-pointer" opacity={nodeOpacity('sensing')}>
                    <rect
                      x="205"
                      y="192"
                      width="115"
                      height="70"
                      rx="6"
                      fill="#EFF6FF"
                      stroke={blockBorder('vdiv_pv', '#2563EB')}
                      strokeWidth={blockWidth('vdiv_pv')}
                    />
                    <text x="262" y="212" textAnchor="middle" className="fill-slate-900 font-sans text-[11px] font-bold">
                      PV Voltage Sense
                    </text>
                    <text x="262" y="228" textAnchor="middle" className="fill-blue-700 font-mono text-[10px]">
                      {isArduinoControl ? '100kΩ / 20kΩ (6:1)' : '100kΩ / 10kΩ (11:1)'}
                    </text>
                    <text x="262" y="244" textAnchor="middle" className="fill-slate-600 font-mono text-[9.5px]">
                      {isArduinoControl ? '5.1V Zener + 100nF' : '3.3V Zener + 100nF'}
                    </text>
                  </g>

                  {/* 4. Synchronous Buck Power Stage */}
                  <g onClick={() => setSelectedId('buck_stage')} className="cursor-pointer" opacity={nodeOpacity('power')}>
                    <rect
                      x="415"
                      y="38"
                      width="225"
                      height="142"
                      rx="6"
                      fill="#FFFBEB"
                      stroke={blockBorder('buck_stage', '#D97706')}
                      strokeWidth={blockWidth('buck_stage')}
                    />
                    <text x="527" y="58" textAnchor="middle" className="fill-slate-900 font-sans text-[12px] font-bold">
                      Synchronous Buck Power Stage
                    </text>

                    <rect x="430" y="70" width="60" height="38" rx="4" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="1" />
                    <text x="460" y="86" textAnchor="middle" className="fill-slate-900 font-mono text-[10px] font-bold">
                      Q1 HS
                    </text>
                    <text x="460" y="100" textAnchor="middle" className="fill-slate-600 font-mono text-[9px]">
                      IRF3205
                    </text>

                    <rect x="502" y="120" width="60" height="38" rx="4" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="1" />
                    <text x="532" y="136" textAnchor="middle" className="fill-slate-900 font-mono text-[10px] font-bold">
                      Q2 LS
                    </text>
                    <text x="532" y="150" textAnchor="middle" className="fill-slate-600 font-mono text-[9px]">
                      IRF3205
                    </text>

                    <path
                      d="M 490 89 L 515 89 Q 521 75 527 89 Q 533 75 539 89 Q 545 75 551 89 Q 557 75 563 89 L 580 89"
                      fill="none"
                      stroke="#B45309"
                      strokeWidth="2.4"
                    />
                    <line x1="510" y1="89" x2="510" y2="120" stroke="#B45309" strokeWidth="1.5" />
                    <circle cx="510" cy="89" r="3" fill="#B45309" />
                    <text x="540" y="74" textAnchor="middle" className="fill-amber-900 font-mono text-[9.5px] font-semibold">
                      L1: 47µH 15A
                    </text>

                    <rect x="572" y="70" width="56" height="44" rx="4" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="1" />
                    <text x="600" y="87" textAnchor="middle" className="fill-slate-900 font-mono text-[9.5px] font-bold">
                      C_out
                    </text>
                    <text x="600" y="102" textAnchor="middle" className="fill-slate-600 font-mono text-[8.5px]">
                      2×1000µF
                    </text>

                    <text x="458" y="169" textAnchor="middle" className="fill-amber-800 font-mono text-[9px]">
                      η ≈ 96.2% @ 40kHz
                    </text>
                  </g>

                  {/* 5. IR2104 MOSFET Driver */}
                  <g onClick={() => setSelectedId('ir2104_driver')} className="cursor-pointer" opacity={nodeOpacity('driver')}>
                    <rect
                      x="430"
                      y="205"
                      width="140"
                      height="70"
                      rx="6"
                      fill="#ECFEFF"
                      stroke={blockBorder('ir2104_driver', '#0891B2')}
                      strokeWidth={blockWidth('ir2104_driver')}
                    />
                    <text x="500" y="224" textAnchor="middle" className="fill-slate-900 font-sans text-[11px] font-bold">
                      IR2104 Gate Driver
                    </text>
                    <text x="500" y="240" textAnchor="middle" className="fill-cyan-800 font-mono text-[9.5px]">
                      Bootstrap 1N5819 + 1µF
                    </text>
                    <text x="500" y="256" textAnchor="middle" className="fill-slate-600 font-mono text-[9.5px]">
                      520ns Dead-Time · 12V
                    </text>
                  </g>

                  {/* 6. Primary MCU Stage (Dynamic: ESP32 or Arduino) */}
                  <g onClick={() => setSelectedId('mcu_stage')} className="cursor-pointer" opacity={nodeOpacity('sensing')}>
                    <rect
                      x="385"
                      y="320"
                      width="220"
                      height="165"
                      rx="6"
                      fill="#EFF6FF"
                      stroke={blockBorder('mcu_stage', '#1D4ED8')}
                      strokeWidth={blockWidth('mcu_stage')}
                    />
                    <rect
                      x="385"
                      y="320"
                      width="220"
                      height="28"
                      rx="6"
                      fill={isArduinoControl ? '#0F766E' : '#1E3A8A'}
                    />
                    <text x="495" y="338" textAnchor="middle" className="fill-white font-sans text-[11.5px] font-bold">
                      {isArduinoControl ? 'Arduino Uno / Nano MPPT' : 'ESP32-WROOM-32 MPPT MCU'}
                    </text>
                    <text x="495" y="366" textAnchor="middle" className="fill-blue-900 font-mono text-[10px] font-semibold">
                      Perturb &amp; Observe (40 kHz)
                    </text>
                    <text x="400" y="388" className="fill-slate-700 font-mono text-[9.5px]">
                      {isArduinoControl ? 'ADC: A0, A1, A2, A3 (5V)' : 'ADC1: GPIO 32, 33, 34, 35'}
                    </text>
                    <text x="400" y="406" className="fill-slate-700 font-mono text-[9.5px]">
                      {isArduinoControl ? 'PWM: D9 (Timer1) / D8 (SD)' : 'PWM: GPIO 18 (40kHz) / 19 (SD)'}
                    </text>
                    <text x="400" y="424" className="fill-slate-700 font-mono text-[9.5px]">
                      {isArduinoControl ? 'I2C: A4/A5 → 16×2 LCD' : 'I2C: GPIO 21/22 → SSD1306 OLED'}
                    </text>
                    <text x="400" y="442" className="fill-slate-700 font-mono text-[9.5px]">
                      {isArduinoControl ? '1-Wire: D2 → DS18B20 Temp' : '1-Wire: GPIO 4 → DS18B20 Temp'}
                    </text>
                    <text x="400" y="460" className="fill-slate-700 font-mono text-[9.5px]">
                      {platform === 'hybrid'
                        ? 'UART TX: D11 → ESP32 Wi-Fi'
                        : isArduinoControl
                          ? 'Protect: D7 → Q3 Isolate'
                          : 'Protect: GPIO 25 → Q3 Isolate'}
                    </text>
                  </g>

                  {/* 7. ACS712-20A Battery Out */}
                  <g onClick={() => setSelectedId('acs_bat')} className="cursor-pointer" opacity={nodeOpacity('sensing')}>
                    <rect
                      x="700"
                      y="55"
                      width="115"
                      height="85"
                      rx="6"
                      fill="#EFF6FF"
                      stroke={blockBorder('acs_bat', '#2563EB')}
                      strokeWidth={blockWidth('acs_bat')}
                    />
                    <text x="757" y="75" textAnchor="middle" className="fill-slate-900 font-sans text-[11px] font-bold">
                      ACS712-20A (Bat)
                    </text>
                    <text x="757" y="92" textAnchor="middle" className="fill-blue-700 font-mono text-[10px]">
                      Charge Current
                    </text>
                    <text x="757" y="109" textAnchor="middle" className="fill-slate-600 font-mono text-[9.5px]">
                      {isArduinoControl ? 'Direct 5V Output' : '10kΩ/20kΩ Divider'}
                    </text>
                    <text x="757" y="124" textAnchor="middle" className="fill-slate-500 font-mono text-[9px]">
                      {isArduinoControl ? '→ Arduino A3' : '→ GPIO 33 (ADC1)'}
                    </text>
                  </g>

                  {/* 8. Battery Voltage Divider */}
                  <g onClick={() => setSelectedId('acs_bat')} className="cursor-pointer" opacity={nodeOpacity('sensing')}>
                    <rect
                      x="700"
                      y="192"
                      width="115"
                      height="70"
                      rx="6"
                      fill="#EFF6FF"
                      stroke={blockBorder('acs_bat', '#2563EB')}
                      strokeWidth={blockWidth('acs_bat')}
                    />
                    <text x="757" y="212" textAnchor="middle" className="fill-slate-900 font-sans text-[11px] font-bold">
                      Bat Voltage Sense
                    </text>
                    <text x="757" y="228" textAnchor="middle" className="fill-blue-700 font-mono text-[10px]">
                      {isArduinoControl ? '100kΩ / 33kΩ (4:1)' : '100kΩ / 15kΩ (7.67:1)'}
                    </text>
                    <text x="757" y="244" textAnchor="middle" className="fill-slate-600 font-mono text-[9.5px]">
                      {isArduinoControl ? '5.1V Zener + 100nF' : '3.3V Zener + 100nF'}
                    </text>
                  </g>

                  {/* 9. Output Q3 Reverse-Block & 12V Battery */}
                  <g onClick={() => setSelectedId('battery_out')} className="cursor-pointer" opacity={nodeOpacity('protection')}>
                    <rect
                      x="855"
                      y="40"
                      width="105"
                      height="160"
                      rx="6"
                      fill="#ECFDF5"
                      stroke={blockBorder('battery_out', '#059669')}
                      strokeWidth={blockWidth('battery_out')}
                    />
                    <text x="907" y="60" textAnchor="middle" className="fill-slate-900 font-sans text-[11px] font-bold">
                      12V Battery
                    </text>
                    <text x="907" y="76" textAnchor="middle" className="fill-emerald-700 font-mono text-[10px]">
                      14.4V Bulk / 13.6V
                    </text>
                    <line x1="867" y1="88" x2="947" y2="88" stroke="#A7F3D0" strokeWidth="1" />
                    <text x="907" y="106" textAnchor="middle" className="fill-slate-700 font-mono text-[9.5px]">
                      Q3 IRF3205
                    </text>
                    <text x="907" y="120" textAnchor="middle" className="fill-slate-700 font-mono text-[9.5px]">
                      Back-Feed Block
                    </text>
                    <text x="907" y="138" textAnchor="middle" className="fill-slate-700 font-mono text-[9.5px]">
                      15A DC Fuse
                    </text>
                    <text x="907" y="158" textAnchor="middle" className="fill-emerald-800 font-mono text-[9px]">
                      Max ~11.5A Chg
                    </text>
                  </g>

                  {/* 10. Auxiliary Power Supply */}
                  <g onClick={() => setSelectedId('aux_supply')} className="cursor-pointer" opacity={nodeOpacity('driver')}>
                    <rect
                      x="655"
                      y="418"
                      width="140"
                      height="72"
                      rx="6"
                      fill="#ECFEFF"
                      stroke={blockBorder('aux_supply', '#0891B2')}
                      strokeWidth={blockWidth('aux_supply')}
                    />
                    <text x="725" y="438" textAnchor="middle" className="fill-slate-900 font-sans text-[11px] font-bold">
                      Aux Power Rails
                    </text>
                    <text x="725" y="454" textAnchor="middle" className="fill-cyan-800 font-mono text-[9.5px]">
                      LM2596 → +12V Gate
                    </text>
                    <text x="725" y="470" textAnchor="middle" className="fill-slate-600 font-mono text-[9.5px]">
                      AMS1117 → +5V Logic
                    </text>
                  </g>
                </svg>
              </div>

              {/* Quick-Select Block Bar */}
              <div className="pt-3 mt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-mono text-slate-500 mr-1">Inspect Block:</span>
                {Object.values(circuitNodes).map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedId(node.id)}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      selectedId === node.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {node.title.split('(')[0].split(':')[0].trim().slice(0, 22)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right Component & Terminal Wiring Inspector */}
        <aside className="xl:col-span-4 bg-slate-50/70 p-5 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-500 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-blue-600 font-semibold">
                <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                Selected Stage ({PLATFORM_META[platform].shortLabel})
              </span>
              <span className="uppercase">{selectedNode.layer}</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 leading-snug">
              {selectedNode.title}
            </h3>
            <p className="text-xs text-slate-600 mt-1">{selectedNode.subtitle}</p>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              Terminal-to-Terminal Connections
            </h4>
            <div className="space-y-2.5">
              {selectedNode.connections.map((conn, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-md p-2.5 text-xs"
                >
                  <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-800 flex-wrap">
                    <span>{conn.from}</span>
                    <ArrowRight className="w-3 h-3 text-blue-600 shrink-0" aria-hidden="true" />
                    <span className="text-blue-700">{conn.to}</span>
                  </div>
                  <div className="text-slate-600 mt-1">{conn.signal}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
              Components in Stage
            </h4>
            <ul className="space-y-1 text-xs text-slate-700 font-mono">
              {selectedNode.keyParts.map((part) => (
                <li key={part} className="flex items-start gap-2">
                  <span className="text-slate-400 select-none">•</span>
                  <span>{part}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              Design Calculation
            </h4>
            <p className="text-xs leading-relaxed text-slate-700 bg-white border border-slate-200 rounded-md p-3 font-mono">
              {selectedNode.engineeringMath}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold block mb-0.5">Bench Safety Rule</span>
              <span className="leading-relaxed text-amber-900">{selectedNode.safetyNote}</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

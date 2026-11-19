import { CheckCircle2, Circle, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ControllerPlatform, PLATFORM_META } from '../data/mpptData';
import { COMPONENT_MODULES_3D, getRequiredWires3D, RequiredWire3D } from '../data/workbench3dData';

interface WiredStatus {
  fromPin: string;
  toPin: string;
  status: 'valid' | 'custom' | 'fault';
}

interface RawConnectionDiagramProps {
  platform: ControllerPlatform;
  wires: WiredStatus[];
  guideWireId: string | null;
  onHighlightGuideWire: (rule: RequiredWire3D) => void;
  onConnectSingleRule: (rule: RequiredWire3D) => void;
}

function sameNet(a1: string, a2: string, b1: string, b2: string): boolean {
  return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
}

function formatPinName(pinId: string): string {
  const [compId, pin] = pinId.split(':');
  const mod = COMPONENT_MODULES_3D.find((m) => m.id === compId);
  return `${mod ? mod.shortName : compId} [${pin}]`;
}

function wireColorHexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function RawConnectionDiagram({
  platform,
  wires,
  guideWireId,
  onHighlightGuideWire,
  onConnectSingleRule,
}: RawConnectionDiagramProps) {
  const [expandedDiagram, setExpandedDiagram] = useState(false);
  const rules = getRequiredWires3D(platform);

  const isRuleWired = (rule: RequiredWire3D) =>
    wires.some((w) => w.status === 'valid' && sameNet(w.fromPin, w.toPin, rule.fromPin, rule.toPin));

  const wiredCount = rules.filter(isRuleWired).length;
  const nextPendingRule = rules.find((r) => !isRuleWired(r)) ?? null;

  const mcuLabel =
    platform === 'esp32'
      ? 'ESP32 (3.3V)'
      : platform === 'arduino'
        ? 'ARDUINO NANO (5V)'
        : 'ARDUINO + ESP32';

  // Helper to highlight SVG traces as emerald green once wired in 3D!
  const traceStyle = (pinA: string, pinB: string, defaultColor: string, width = 3) => {
    const done = wires.some((w) => w.status === 'valid' && sameNet(w.fromPin, w.toPin, pinA, pinB));
    return {
      stroke: done ? '#34d399' : defaultColor,
      strokeWidth: done ? width + 0.8 : width,
      strokeDasharray: done ? undefined : '4 3',
      opacity: done ? 1 : 0.88,
    };
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-blue-600 font-semibold">
            Raw Default Block Diagram
          </p>
          <h2 className="text-sm font-bold text-slate-900">
            How to Connect ({wiredCount}/{rules.length} Done)
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setExpandedDiagram((e) => !e)}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer shrink-0"
          title={expandedDiagram ? 'Compact sidebar view' : 'Expand blueprint view'}
        >
          {expandedDiagram ? (
            <>
              <Minimize2 className="w-3 h-3" aria-hidden="true" />
              Compact
            </>
          ) : (
            <>
              <Maximize2 className="w-3 h-3" aria-hidden="true" />
              Zoom SVG
            </>
          )}
        </button>
      </div>

      {/* Live Raw Block Schematic SVG (Fits cleanly on First Screen!) */}
      <div className="bg-slate-950 border border-slate-800 rounded-md p-2">
        <svg
          viewBox="0 0 560 325"
          className={`w-full h-auto font-mono select-none ${expandedDiagram ? 'min-h-[260px]' : ''}`}
          role="img"
          aria-label="Raw default block connection diagram for 165Wp Mono PERC MPPT"
        >
          <defs>
            <pattern id="rawGridCompact" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#1e293b" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="560" height="325" fill="url(#rawGridCompact)" rx="4" />

          <text x="10" y="16" fill="#94a3b8" fontSize="8.5" fontWeight="bold">
            RAW BLOCK SCHEMATIC · DASHED = TO WIRE · SOLID GREEN = WIRED IN 3D
          </text>

          {/* POWER STAGE PATH (Top Flow) */}
          <line x1="86" y1="54" x2="112" y2="54" {...traceStyle('pv_panel:PV+', 'protection:IN_PV+', '#ef4444', 3.5)} />
          <line x1="86" y1="74" x2="112" y2="74" {...traceStyle('pv_panel:PV-', 'protection:GND', '#64748b', 3)} />
          <line x1="192" y1="54" x2="216" y2="54" {...traceStyle('protection:BUS_PV+', 'acs_pair:IP1_IN', '#f97316', 3.5)} />
          <line x1="286" y1="54" x2="310" y2="54" {...traceStyle('acs_pair:IP1_OUT', 'mosfets:Q1_D', '#f97316', 3.5)} />
          <line x1="392" y1="54" x2="414" y2="54" {...traceStyle('mosfets:SW_NODE', 'inductor:L_IN', '#eab308', 3.5)} />
          <line x1="472" y1="54" x2="492" y2="54" {...traceStyle('mosfets:Q3_D', 'battery:BAT+', '#ef4444', 3.5)} />

          {/* L_OUT -> ACS2 -> Q3 loop */}
          <path
            d="M 443 86 L 443 108 L 251 108 L 251 86"
            fill="none"
            {...traceStyle('inductor:L_OUT', 'acs_pair:IP2_IN', '#f59e0b', 2.4)}
          />
          <text x="348" y="103" textAnchor="middle" fill="#fcd34d" fontSize="7.5">
            L_OUT -&gt; ACS2 -&gt; Q3_S -&gt; Q3_D -&gt; BAT+
          </text>

          {/* Battery GND & Aux Vin */}
          <path
            d="M 521 86 L 521 122 L 152 122 L 152 86"
            fill="none"
            {...traceStyle('battery:BAT-', 'protection:GND', '#64748b', 2.2)}
          />
          <path
            d="M 521 86 L 521 206 L 478 206"
            fill="none"
            {...traceStyle('battery:BAT+', 'aux_psu:VIN_BAT', '#ef4444', 2.5)}
          />

          {/* Gate Driver HO/LO/VS to MOSFETs */}
          <line x1="342" y1="86" x2="342" y2="176" {...traceStyle('ir2104:HO', 'mosfets:Q1_G', '#a855f7', 2.4)} />
          <line x1="360" y1="86" x2="360" y2="176" {...traceStyle('ir2104:LO', 'mosfets:Q2_G', '#9333ea', 2.4)} />
          <text x="352" y="152" textAnchor="middle" fill="#d8b4fe" fontSize="7.5">HO/LO/VS</text>

          {/* Aux 12V -> IR2104 & 5V -> MCU */}
          <line x1="404" y1="204" x2="380" y2="204" {...traceStyle('aux_psu:V12_OUT', 'ir2104:VCC12', '#a855f7', 2.4)} />
          <path
            d="M 441 232 L 441 252 L 222 252 L 222 232"
            fill="none"
            {...traceStyle('aux_psu:V5_OUT', platform === 'esp32' ? 'esp32:VIN5V' : 'arduino:V5_IN', '#ef4444', 2.2)}
          />

          {/* MCU <-> IR2104 PWM/SD + Sensing */}
          <line
            x1="258"
            y1="204"
            x2="296"
            y2="204"
            {...traceStyle(platform === 'esp32' ? 'esp32:GPIO18' : 'arduino:D9', 'ir2104:IN_PWM', '#14b8a6', 2.5)}
          />
          <text x="277" y="197" textAnchor="middle" fill="#5eead4" fontSize="7">40kHz</text>

          <path
            d="M 152 86 L 152 204 L 178 204"
            fill="none"
            {...traceStyle('protection:DIV_PV', platform === 'esp32' ? 'esp32:GPIO34' : 'arduino:A0', '#3b82f6', 2)}
          />
          <path
            d="M 235 86 L 235 162 L 200 162 L 200 176"
            fill="none"
            {...traceStyle('acs_pair:VIOUT1', platform === 'esp32' ? 'esp32:GPIO32' : 'arduino:A2', '#22c55e', 2)}
          />

          {/* OLED Bus */}
          <path
            d="M 258 224 L 284 224 L 284 282 L 320 282"
            fill="none"
            {...traceStyle('esp32:I2C_TEMP', 'display_temp:BUS_I2C', '#818cf8', 2.2)}
          />

          {/* ROW 1 BLOCKS */}
          <g transform="translate(10,32)">
            <rect width="76" height="54" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="38" y="20" textAnchor="middle" fill="#38bdf8" fontSize="8.5" fontWeight="bold">1. PV</text>
            <text x="38" y="34" textAnchor="middle" fill="#e2e8f0" fontSize="7.5">165W PERC</text>
            <text x="71" y="47" textAnchor="end" fill="#fca5a5" fontSize="7">PV+ / -</text>
          </g>

          <g transform="translate(112,32)">
            <rect width="80" height="54" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.5" />
            <text x="40" y="18" textAnchor="middle" fill="#f8fafc" fontSize="8" fontWeight="bold">2. INPUT</text>
            <text x="40" y="31" textAnchor="middle" fill="#94a3b8" fontSize="7">15A Fuse+Caps</text>
            <text x="40" y="45" textAnchor="middle" fill="#93c5fd" fontSize="7">DIV_PV/BAT</text>
          </g>

          <g transform="translate(216,32)">
            <rect width="70" height="54" rx="4" fill="#0f172a" stroke="#2563eb" strokeWidth="1.5" />
            <text x="35" y="18" textAnchor="middle" fill="#60a5fa" fontSize="8" fontWeight="bold">3. ACSx2</text>
            <text x="35" y="31" textAnchor="middle" fill="#94a3b8" fontSize="7">IP1 &amp; IP2</text>
            <text x="35" y="45" textAnchor="middle" fill="#86efac" fontSize="7">VIOUT1/2</text>
          </g>

          <g transform="translate(310,32)">
            <rect width="82" height="54" rx="4" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="41" y="18" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold">4. Q1-Q3</text>
            <text x="41" y="31" textAnchor="middle" fill="#94a3b8" fontSize="7">IRF3205 FETs</text>
            <text x="41" y="45" textAnchor="middle" fill="#fde047" fontSize="7">SW / Q1_G / Q3</text>
          </g>

          <g transform="translate(414,32)">
            <rect width="58" height="54" rx="4" fill="#0f172a" stroke="#eab308" strokeWidth="1.5" />
            <text x="29" y="20" textAnchor="middle" fill="#fde047" fontSize="8" fontWeight="bold">5. 47uH</text>
            <text x="29" y="34" textAnchor="middle" fill="#94a3b8" fontSize="7">Toroid</text>
            <text x="29" y="46" textAnchor="middle" fill="#fcd34d" fontSize="6.8">IN / OUT</text>
          </g>

          <g transform="translate(492,32)">
            <rect width="58" height="54" rx="4" fill="#0f172a" stroke="#ef4444" strokeWidth="1.5" />
            <text x="29" y="20" textAnchor="middle" fill="#fca5a5" fontSize="8" fontWeight="bold">11. BAT</text>
            <text x="29" y="34" textAnchor="middle" fill="#94a3b8" fontSize="7">12V 20Ah</text>
            <text x="29" y="46" textAnchor="middle" fill="#ef4444" fontSize="7">BAT+ / -</text>
          </g>

          {/* ROW 2 BLOCKS */}
          <g transform="translate(178,176)">
            <rect width="80" height="56" rx="4" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
            <text x="40" y="18" textAnchor="middle" fill="#34d399" fontSize="8" fontWeight="bold">8/9. MCU</text>
            <text x="40" y="32" textAnchor="middle" fill="#e2e8f0" fontSize="6.8">{mcuLabel}</text>
            <text x="40" y="47" textAnchor="middle" fill="#5eead4" fontSize="7">ADC + PWM</text>
          </g>

          <g transform="translate(296,176)">
            <rect width="84" height="56" rx="4" fill="#0f172a" stroke="#14b8a6" strokeWidth="1.5" />
            <text x="42" y="18" textAnchor="middle" fill="#2dd4bf" fontSize="8" fontWeight="bold">6. IR2104</text>
            <text x="42" y="32" textAnchor="middle" fill="#94a3b8" fontSize="7">Gate Driver</text>
            <text x="42" y="47" textAnchor="middle" fill="#d8b4fe" fontSize="7">IN / SD / HO / LO</text>
          </g>

          <g transform="translate(404,176)">
            <rect width="74" height="56" rx="4" fill="#0f172a" stroke="#6366f1" strokeWidth="1.5" />
            <text x="37" y="18" textAnchor="middle" fill="#a5b4fc" fontSize="8" fontWeight="bold">7. LM2596</text>
            <text x="37" y="32" textAnchor="middle" fill="#94a3b8" fontSize="7">12V &amp; 5V</text>
            <text x="37" y="47" textAnchor="middle" fill="#fca5a5" fontSize="7">V12 / V5 / GND</text>
          </g>

          <g transform="translate(320,264)">
            <rect width="170" height="44" rx="4" fill="#0f172a" stroke="#818cf8" strokeWidth="1.5" />
            <text x="85" y="19" textAnchor="middle" fill="#c7d2fe" fontSize="8" fontWeight="bold">10. 0.96&quot; OLED + DS18B20</text>
            <text x="85" y="34" textAnchor="middle" fill="#94a3b8" fontSize="7">BUS_I2C (SDA/SCL/TEMP) + GND</text>
          </g>
        </svg>
      </div>

      {/* Next Wire Action Shortcut */}
      {nextPendingRule ? (
        <button
          type="button"
          onClick={() => onHighlightGuideWire(nextPendingRule)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-md cursor-pointer transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            Locate Next Wire in 3D: {formatPinName(nextPendingRule.fromPin)} → {formatPinName(nextPendingRule.toPin)}
          </span>
        </button>
      ) : (
        <div className="px-3 py-2 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          All {rules.length} default connections wired! Click &quot;Power On 3D&quot;.
        </div>
      )}

      {/* Scrollable Step-by-Step Raw Checklist right on the First Screen */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
            Pin-to-Pin List ({PLATFORM_META[platform].shortLabel})
          </span>
          <span className="text-[10px] font-mono text-slate-400">Locate or Connect</span>
        </div>

        <div className="space-y-1.5 overflow-y-auto max-h-[245px] pr-1">
          {rules.map((rule, idx) => {
            const done = isRuleWired(rule);
            const isHighlighted = guideWireId === rule.id;
            return (
              <div
                key={rule.id}
                className={`rounded border px-2.5 py-1.5 text-xs transition-colors flex items-center justify-between gap-2 ${
                  done
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : isHighlighted
                      ? 'bg-amber-50 border-amber-400 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  {done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-semibold flex items-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: wireColorHexToCss(rule.colorHex) }}
                      />
                      <span className="truncate">
                        #{idx + 1} {rule.label}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">
                      {formatPinName(rule.fromPin)} → {formatPinName(rule.toPin)}
                    </div>
                  </div>
                </div>

                {!done && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onHighlightGuideWire(rule)}
                      className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white hover:bg-amber-100 text-slate-700 border border-slate-300 rounded cursor-pointer"
                      title="Highlight these 2 pins in 3D"
                    >
                      Find
                    </button>
                    <button
                      type="button"
                      onClick={() => onConnectSingleRule(rule)}
                      className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
                      title="Wire this step automatically"
                    >
                      Wire
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

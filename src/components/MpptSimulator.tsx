import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { SOLAR_PANEL_OPTIONS, SolarPanelOption } from '../data/panelOptions';

interface CurvePoint {
  v: number;
  i: number;
  p: number;
}

interface MpptSimulatorProps {
  panel?: SolarPanelOption;
}

export function MpptSimulator({ panel = SOLAR_PANEL_OPTIONS[0] }: MpptSimulatorProps) {
  const [irradiance, setIrradiance] = useState<number>(1000); // W/m²
  const [cellTemp, setCellTemp] = useState<number>(25); // °C
  const [batteryVoltage, setBatteryVoltage] = useState<number>(12.8); // V
  const [mpptEnabled, setMpptEnabled] = useState<boolean>(true);
  const [partialShading, setPartialShading] = useState<boolean>(false);
  const [microCrack, setMicroCrack] = useState<boolean>(false);
  const [hoverVoltage, setHoverVoltage] = useState<number | null>(null);

  const BUCK_EFF = 0.962;

  const model = useMemo(() => {
    const gNorm = irradiance / 1000;
    const dT = cellTemp - 25;

    const isc = panel.isc * gNorm * (1 + 0.0005 * dT);
    const voc = Math.max(
      10,
      panel.voc * (1 + (panel.tempCoeffVoc / 100) * dT) +
        0.0257 * 36 * 1.3 * Math.log(Math.max(gNorm, 0.08))
    );

    const vRatio = panel.vmp / panel.voc;
    const iRatio = panel.imp / panel.isc;
    const c2 = (vRatio - 1) / Math.log(1 - iRatio);
    const c1 = (1 - iRatio) * Math.exp(-vRatio / c2);

    const points: CurvePoint[] = [];
    const steps = 100;
    let mpp: CurvePoint = { v: 0, i: 0, p: 0 };

    for (let idx = 0; idx <= steps; idx++) {
      const v = (idx / steps) * voc;
      let rawI = isc * (1 - c1 * (Math.exp(v / (c2 * voc)) - 1));

      // Partial shading creates a smooth bypass step when shade hits a substring
      if (partialShading && v > voc * 0.45) {
        const shadeFactor = 0.48;
        const transition = Math.min(1, (v - voc * 0.45) / (voc * 0.12));
        rawI = rawI * (1 - transition * (1 - shadeFactor));
      }

      // Micro-crack / hotspot creates a sharp localized d²I/dV² inflection kink at ~62% Voc
      if (microCrack && v > voc * 0.6) {
        const crackFactor = 0.62;
        const sharpStep = Math.min(1, (v - voc * 0.6) / (voc * 0.025));
        rawI = rawI * (1 - sharpStep * (1 - crackFactor));
      }

      const i = Math.max(0, rawI);
      const p = v * i;
      const pt = { v, i, p };
      points.push(pt);
      if (p > mpp.p) {
        mpp = pt;
      }
    }

    // Second derivative peak |d²I/dV²| across the swept points
    let maxD2IdV2 = 0;
    for (let k = 2; k < points.length - 2; k++) {
      const dv = Math.max(0.08, points[k + 1].v - points[k].v);
      const d2 = Math.abs(
        (points[k + 1].i - 2 * points[k].i + points[k - 1].i) / (dv * dv)
      );
      if (d2 > maxD2IdV2) maxD2IdV2 = d2;
    }

    const pwmClampV = Math.min(voc, batteryVoltage + 0.6);
    let pwmCurrentRaw = isc * (1 - c1 * (Math.exp(pwmClampV / (c2 * voc)) - 1));
    if (partialShading && pwmClampV > voc * 0.45) {
      pwmCurrentRaw *= 0.48;
    }
    if (microCrack && pwmClampV > voc * 0.6) {
      pwmCurrentRaw *= 0.62;
    }
    const pwmCurrent = Math.max(0, pwmCurrentRaw);
    const pwmBatteryPower = batteryVoltage * pwmCurrent;

    const mpptBatteryPower = mpp.p * BUCK_EFF;
    const mpptBatteryCurrent = mpptBatteryPower / batteryVoltage;
    const dutyCycle = Math.min(0.95, Math.max(0.1, batteryVoltage / Math.max(mpp.v, 1)));
    const gainPct =
      pwmBatteryPower > 0.5
        ? ((mpptBatteryPower - pwmBatteryPower) / pwmBatteryPower) * 100
        : 0;

    return {
      voc,
      isc,
      mpp,
      points,
      pwmClampV,
      pwmCurrent,
      pwmBatteryPower,
      mpptBatteryPower,
      mpptBatteryCurrent,
      dutyCycle,
      gainPct,
      maxD2IdV2,
    };
  }, [panel, irradiance, cellTemp, batteryVoltage, partialShading, microCrack]);

  // Dynamic chart bounds so all 7 panels (70W to 410W, 22V to 65V Voc) plot cleanly
  const maxV = Math.ceil((panel.voc * 1.12) / 5) * 5;
  const maxI = Math.ceil((panel.isc * 1.15) / 2) * 2;
  const maxP = Math.ceil((panel.pMaxW * 1.1) / 25) * 25;

  const W = 680;
  const H = 340;
  const PAD = { top: 24, right: 56, bottom: 42, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const xOf = (v: number) => PAD.left + (v / maxV) * plotW;
  const yOfI = (i: number) => PAD.top + plotH - (i / maxI) * plotH;
  const yOfP = (p: number) => PAD.top + plotH - (p / maxP) * plotH;

  const ivPath = model.points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${xOf(pt.v).toFixed(1)} ${yOfI(pt.i).toFixed(1)}`)
    .join(' ');

  const pvPath = model.points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${xOf(pt.v).toFixed(1)} ${yOfP(pt.p).toFixed(1)}`)
    .join(' ');

  const pvAreaPath = `${pvPath} L ${xOf(model.voc).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L ${xOf(0).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`;

  const inspectedPoint = useMemo(() => {
    if (hoverVoltage === null) return null;
    let closest = model.points[0];
    let minDiff = Infinity;
    for (const pt of model.points) {
      const diff = Math.abs(pt.v - hoverVoltage);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    }
    return closest;
  }, [hoverVoltage, model.points]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const v = ((relX - PAD.left) / plotW) * maxV;
    if (v >= 0 && v <= model.voc) {
      setHoverVoltage(v);
    } else {
      setHoverVoltage(null);
    }
  };

  const resetDefaults = () => {
    setIrradiance(1000);
    setCellTemp(25);
    setBatteryVoltage(12.8);
    setMpptEnabled(true);
    setPartialShading(false);
    setMicroCrack(false);
  };

  const yFractions = [0, 0.25, 0.5, 0.75, 1];
  const xFractions = [0, 0.2, 0.4, 0.6, 0.8, 1];

  return (
    <section id="simulator" className="scroll-mt-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-blue-600 mb-1">
            04. Empirical Performance Verification
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            {panel.shortName} I-V / P-V Curve &amp; Global MPPT Simulator
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Simulate irradiance, cell temperature, and partial shading (dual-peak Global MPPT) on{' '}
            <strong className="text-slate-800">{panel.name}</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={resetDefaults}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Reset STC (1000 W/m², 25°C)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 border border-slate-200 bg-white rounded-lg overflow-hidden">
        {/* Left Control Column */}
        <div className="lg:col-span-4 bg-slate-50/70 border-b lg:border-b-0 lg:border-r border-slate-200 p-5 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="irradiance-slider" className="font-medium text-slate-700">
                  Solar Irradiance
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {irradiance} W/m²
                </span>
              </div>
              <input
                id="irradiance-slider"
                type="range"
                min={200}
                max={1000}
                step={25}
                value={irradiance}
                onChange={(e) => setIrradiance(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="temp-slider" className="font-medium text-slate-700">
                  PV Cell Temperature
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {cellTemp} °C
                </span>
              </div>
              <input
                id="temp-slider"
                type="range"
                min={15}
                max={65}
                step={1}
                value={cellTemp}
                onChange={(e) => setCellTemp(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="bat-slider" className="font-medium text-slate-700">
                  12V Battery Terminal Voltage
                </label>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {batteryVoltage.toFixed(1)} V
                </span>
              </div>
              <input
                id="bat-slider"
                type="range"
                min={11.5}
                max={14.4}
                step={0.1}
                value={batteryVoltage}
                onChange={(e) => setBatteryVoltage(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1.5">
                  Controller Tracking Mode
                </span>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-md">
                  <button
                    type="button"
                    onClick={() => setMpptEnabled(true)}
                    className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      mpptEnabled ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Global MPPT Buck
                  </button>
                  <button
                    type="button"
                    onClick={() => setMpptEnabled(false)}
                    className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      !mpptEnabled ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Direct PWM
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between gap-2 text-xs bg-white border border-slate-200 rounded-md px-3 py-2 cursor-pointer">
                <span className="font-medium text-slate-700">
                  Simulate Partial Shading (Dual-Peak GMPPT)
                </span>
                <input
                  type="checkbox"
                  checked={partialShading}
                  onChange={(e) => setPartialShading(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-2 text-xs bg-white border border-slate-200 rounded-md px-3 py-2 cursor-pointer">
                <span className="font-medium text-slate-700">
                  Simulate Cell Micro-Crack (d²I/dV² Spike)
                </span>
                <input
                  type="checkbox"
                  checked={microCrack}
                  onChange={(e) => setMicroCrack(e.target.checked)}
                  className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                />
              </label>

              <div
                className={`text-[11px] font-mono px-3 py-2 rounded-md border ${
                  microCrack
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : partialShading
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                d²I/dV² Peak: {model.maxD2IdV2.toFixed(2)} A/V² ·{' '}
                {microCrack
                  ? 'FAULT: Sharp Crack Inflection'
                  : partialShading
                    ? 'GMPPT Sweep: Soft Shade Bypass'
                    : 'Healthy Smooth Curve'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
            <div className="bg-white border border-slate-200 rounded-md p-3">
              <div className="text-[11px] font-mono uppercase text-slate-500">
                {mpptEnabled ? 'MPPT Power Out' : 'PWM Power Out'}
              </div>
              <div className="text-xl font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                {(mpptEnabled ? model.mpptBatteryPower : model.pwmBatteryPower).toFixed(1)}
                <span className="text-xs font-normal text-slate-500 ml-1">W</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-md p-3">
              <div className="text-[11px] font-mono uppercase text-slate-500">Charge Current</div>
              <div className="text-xl font-mono font-bold text-blue-700 tabular-nums mt-0.5">
                {(mpptEnabled ? model.mpptBatteryCurrent : model.pwmCurrent).toFixed(2)}
                <span className="text-xs font-normal text-slate-500 ml-1">A</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-md p-3">
              <div className="text-[11px] font-mono uppercase text-slate-500">
                {mpptEnabled ? 'Buck Duty (D)' : 'PV Clamped At'}
              </div>
              <div className="text-lg font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                {mpptEnabled
                  ? `${(model.dutyCycle * 100).toFixed(1)}%`
                  : `${model.pwmClampV.toFixed(1)} V`}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-md p-3">
              <div className="text-[11px] font-mono uppercase text-slate-500">MPPT Gain vs PWM</div>
              <div className="text-lg font-mono font-semibold text-emerald-700 tabular-nums mt-0.5">
                +{Math.max(0, model.gainPct).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Main Dual-Axis I-V & P-V Chart */}
        <div className="lg:col-span-8 p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs font-mono">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span className="w-3 h-0.5 bg-blue-600 inline-block" />
                P-V Power Curve (W)
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span className="w-3 h-0.5 bg-amber-600 inline-block" />
                I-V Current Curve (A)
              </span>
            </div>

            <div className="text-slate-600 tabular-nums">
              {inspectedPoint ? (
                <span>
                  V={inspectedPoint.v.toFixed(1)}V · I={inspectedPoint.i.toFixed(2)}A · P=
                  {inspectedPoint.p.toFixed(1)}W
                </span>
              ) : (
                <span>
                  GMPP: {model.mpp.v.toFixed(1)} V · {model.mpp.i.toFixed(2)} A ·{' '}
                  {model.mpp.p.toFixed(1)} W
                </span>
              )}
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto cursor-crosshair select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverVoltage(null)}
              role="img"
              aria-label={`${panel.name} I-V and P-V Characteristic Curves`}
            >
              <defs>
                <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {yFractions.map((frac) => {
                const tickI = frac * maxI;
                const tickP = frac * maxP;
                const y = yOfI(tickI);
                return (
                  <g key={frac}>
                    <line
                      x1={PAD.left}
                      y1={y}
                      x2={W - PAD.right}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                    <text
                      x={PAD.left - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-amber-700 font-mono text-[10px]"
                    >
                      {tickI.toFixed(1)}A
                    </text>
                    <text
                      x={W - PAD.right + 8}
                      y={y + 3}
                      textAnchor="start"
                      className="fill-blue-700 font-mono text-[10px]"
                    >
                      {Math.round(tickP)}W
                    </text>
                  </g>
                );
              })}

              {xFractions.map((frac) => {
                const tickV = Math.round(frac * maxV);
                const x = xOf(tickV);
                return (
                  <g key={frac}>
                    <line
                      x1={x}
                      y1={PAD.top}
                      x2={x}
                      y2={PAD.top + plotH}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={PAD.top + plotH + 18}
                      textAnchor="middle"
                      className="fill-slate-500 font-mono text-[10px]"
                    >
                      {tickV}V
                    </text>
                  </g>
                );
              })}

              <text
                x={PAD.left + plotW / 2}
                y={H - 6}
                textAnchor="middle"
                className="fill-slate-500 font-mono text-[10px]"
              >
                PV Array Terminal Voltage (V)
              </text>

              <path d={pvAreaPath} fill="url(#pvFill)" />
              <path d={pvPath} fill="none" stroke="#2563EB" strokeWidth="2.5" />
              <path d={ivPath} fill="none" stroke="#D97706" strokeWidth="2.2" />

              {mpptEnabled ? (
                <g>
                  <line
                    x1={xOf(model.mpp.v)}
                    y1={PAD.top}
                    x2={xOf(model.mpp.v)}
                    y2={PAD.top + plotH}
                    stroke="#2563EB"
                    strokeDasharray="4 3"
                    strokeWidth="1.2"
                  />
                  <circle
                    cx={xOf(model.mpp.v)}
                    cy={yOfP(model.mpp.p)}
                    r="5.5"
                    fill="#2563EB"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <circle
                    cx={xOf(model.mpp.v)}
                    cy={yOfI(model.mpp.i)}
                    r="4.5"
                    fill="#D97706"
                    stroke="#FFFFFF"
                    strokeWidth="1.8"
                  />
                  <text
                    x={Math.min(xOf(model.mpp.v) + 8, W - PAD.right - 105)}
                    y={Math.max(yOfP(model.mpp.p) - 10, PAD.top + 14)}
                    className="fill-blue-800 font-mono text-[10.5px] font-bold"
                  >
                    GMPP Lock ({model.mpp.p.toFixed(1)}W)
                  </text>
                </g>
              ) : (
                <g>
                  <line
                    x1={xOf(model.pwmClampV)}
                    y1={PAD.top}
                    x2={xOf(model.pwmClampV)}
                    y2={PAD.top + plotH}
                    stroke="#DC2626"
                    strokeDasharray="4 3"
                    strokeWidth="1.4"
                  />
                  <circle
                    cx={xOf(model.pwmClampV)}
                    cy={yOfP(model.pwmClampV * model.pwmCurrent)}
                    r="5.5"
                    fill="#DC2626"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <text
                    x={xOf(model.pwmClampV) + 8}
                    y={Math.max(yOfP(model.pwmClampV * model.pwmCurrent) - 10, PAD.top + 14)}
                    className="fill-red-700 font-mono text-[10.5px] font-bold"
                  >
                    PWM Clamp ({(model.pwmClampV * model.pwmCurrent).toFixed(1)}W)
                  </text>
                </g>
              )}

              {inspectedPoint && (
                <g>
                  <line
                    x1={xOf(inspectedPoint.v)}
                    y1={PAD.top}
                    x2={xOf(inspectedPoint.v)}
                    y2={PAD.top + plotH}
                    stroke="#64748B"
                    strokeWidth="1"
                  />
                  <circle cx={xOf(inspectedPoint.v)} cy={yOfP(inspectedPoint.p)} r="3.5" fill="#1E40AF" />
                  <circle cx={xOf(inspectedPoint.v)} cy={yOfI(inspectedPoint.i)} r="3.5" fill="#B45309" />
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

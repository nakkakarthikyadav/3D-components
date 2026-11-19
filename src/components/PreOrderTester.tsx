import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FlaskConical } from 'lucide-react';
import { ControllerPlatform, PLATFORM_META } from '../data/mpptData';
import { SOLAR_PANEL_OPTIONS, SolarPanelOption } from '../data/panelOptions';

interface TestScenario {
  id: string;
  label: string;
  pvVoltage: number;
  pvCurrent: number;
  batVoltage: number;
  description: string;
}

interface PreOrderTesterProps {
  platform: ControllerPlatform;
  panel?: SolarPanelOption;
}

export function PreOrderTester({
  platform,
  panel = SOLAR_PANEL_OPTIONS[0],
}: PreOrderTesterProps) {
  const [scenarioId, setScenarioId] = useState<string>('nominal');

  const scenarios = useMemo<TestScenario[]>(() => {
    return [
      {
        id: 'nominal',
        label: `Peak Sun (${panel.vmp.toFixed(1)}Vmp)`,
        pvVoltage: panel.vmp,
        pvCurrent: panel.imp,
        batVoltage: 12.8,
        description: `Standard ${panel.pMaxW}Wp operating point under clear noon sunlight.`,
      },
      {
        id: 'cloud',
        label: 'Cloud Pass (40% Sun)',
        pvVoltage: Number((panel.vmp * 0.96).toFixed(1)),
        pvCurrent: Number((panel.imp * 0.4).toFixed(2)),
        batVoltage: 12.6,
        description: 'Lower irradiance reduces PV current while V_mp shifts slightly.',
      },
      {
        id: 'cold_voc',
        label: `Cold Voc Peak (${(panel.voc * 1.08).toFixed(1)}V)`,
        pvVoltage: Number((panel.voc * 1.08).toFixed(1)),
        pvCurrent: 0.0,
        batVoltage: 14.4,
        description: 'Battery full (14.4V CV) or cold morning open-circuit voltage check.',
      },
      {
        id: 'no_bat',
        label: 'Battery Disconnected',
        pvVoltage: panel.voc,
        pvCurrent: 0.0,
        batVoltage: 0.0,
        description: 'Safety lockout check: controller must keep IR2104 SD LOW when V_bat < 9.5V.',
      },
      {
        id: 'night',
        label: 'Night Back-Feed Check',
        pvVoltage: 0.4,
        pvCurrent: 0.0,
        batVoltage: 12.7,
        description: 'After sunset: Q3 MOSFET must open to stop battery draining into PV panel.',
      },
    ];
  }, [panel]);

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];

  const diag = useMemo(() => {
    const isArduino = platform === 'arduino' || platform === 'hybrid';
    const adcMaxV = isArduino ? 5.0 : 3.3;
    const adcResolution = isArduino ? 1023 : 4095;
    const adcRefV = isArduino ? 5.0 : 3.3;

    // Auto-scale PV divider ratio when high-Voc panel (>30V) is selected
    const pvDivRatio = panel.highVoltageUpgrade
      ? isArduino
        ? 10 / 160
        : 10 / 230
      : isArduino
        ? 20 / 120
        : 10 / 110;
    const batDivRatio = isArduino ? 33 / 133 : 15 / 115;

    const vAdcPv = scenario.pvVoltage * pvDivRatio;
    const vAdcBat = scenario.batVoltage * batDivRatio;

    // ACS712-20A
    const acsScale = isArduino ? 1.0 : 20 / 30;
    const vAdcIpv = (2.5 + 0.1 * scenario.pvCurrent) * acsScale;

    // Firmware protection logic simulation
    const batPresent = scenario.batVoltage >= 9.5;
    const pvAboveBat = scenario.pvVoltage >= scenario.batVoltage + 1.0;
    const buckActive = batPresent && pvAboveBat && scenario.batVoltage < 14.4;

    const rawDuty = buckActive
      ? Math.min(0.95, Math.max(0.1, scenario.batVoltage / Math.max(scenario.pvVoltage, 1)))
      : 0;

    const pPv = scenario.pvVoltage * scenario.pvCurrent;
    const pBat = buckActive ? pPv * 0.962 : 0;
    const iBat = buckActive && scenario.batVoltage > 0 ? pBat / scenario.batVoltage : 0;

    const pvPinOk = vAdcPv <= adcMaxV * 0.9;
    const batPinOk = vAdcBat <= adcMaxV * 0.9;
    const curPinOk = vAdcIpv <= adcMaxV * 0.9;

    return {
      isArduino,
      adcMaxV,
      adcPinPv: isArduino ? 'A0' : 'GPIO 34',
      adcPinBat: isArduino ? 'A1' : 'GPIO 35',
      adcPinCur: isArduino ? 'A2' : 'GPIO 32',
      vAdcPv,
      vAdcBat,
      vAdcIpv,
      rawCountsPv: Math.round((vAdcPv / adcRefV) * adcResolution),
      rawCountsBat: Math.round((vAdcBat / adcRefV) * adcResolution),
      buckActive,
      q3Conducting: batPresent && pvAboveBat,
      dutyPct: rawDuty * 100,
      pPv,
      pBat,
      iBat,
      pvPinOk,
      batPinOk,
      curPinOk,
      allPinsSafe: pvPinOk && batPinOk && curPinOk,
    };
  }, [platform, panel, scenario]);

  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/70">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold">
            <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
            Pre-Order Virtual Circuit &amp; Firmware Bench Test
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
            Verify Pin Voltages &amp; Lockout Logic Before Ordering Components
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Run virtual fault and sunlight tests on <strong className="text-slate-800">{PLATFORM_META[platform].label}</strong> or open our circuit in free browser simulators.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://wokwi.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Test Code on Wokwi
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="http://www.falstad.com/circuit/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Test Buck on Falstad
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {panel.highVoltageUpgrade && (
          <div className="p-3.5 rounded-md border border-amber-300 bg-amber-50 text-xs text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold">
                High-Voltage Panel Upgrade Required ({panel.shortName}: Voc {panel.voc.toFixed(1)}V):
              </span>{' '}
              Standard 55V IRF3205 MOSFETs and 35V input capacitors will fail on cold mornings (
              {(panel.voc * 1.08).toFixed(1)}V peak). Upgrade Q1–Q3 to{' '}
              <span className="font-mono font-semibold">100V IRFB4110</span>, swap C_in to{' '}
              <span className="font-mono font-semibold">100V</span> rated caps +{' '}
              <span className="font-mono font-semibold">SMBJ70A TVS</span>, and scale the PV divider
              to{' '}
              <span className="font-mono font-semibold">
                {diag.isArduino ? '150kΩ / 10kΩ (16:1)' : '220kΩ / 10kΩ (23:1)'}
              </span>
              .
            </div>
          </div>
        )}

        {/* Scenario Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {scenarios.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => setScenarioId(sc.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                scenarioId === sc.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        <p className="text-xs font-mono text-slate-600">{scenario.description}</p>

        {/* Virtual Pin Voltmeter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="border border-slate-200 rounded-md p-3 bg-slate-50/50">
            <div className="text-[11px] font-mono uppercase text-slate-500">
              {diag.adcPinPv} (PV Divider Out)
            </div>
            <div className="text-lg font-mono font-bold text-slate-900 tabular-nums mt-0.5">
              {diag.vAdcPv.toFixed(2)} V
              <span className="text-xs font-normal text-slate-500 ml-1.5">
                (ADC {diag.rawCountsPv})
              </span>
            </div>
            <div
              className={`text-[11px] font-mono mt-1 flex items-center gap-1 ${
                diag.pvPinOk ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {diag.pvPinOk ? (
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              )}
              {diag.pvPinOk
                ? `Safe (< ${diag.adcMaxV.toFixed(1)}V limit)`
                : `Overvoltage (> ${diag.adcMaxV.toFixed(1)}V)`}
            </div>
          </div>

          <div className="border border-slate-200 rounded-md p-3 bg-slate-50/50">
            <div className="text-[11px] font-mono uppercase text-slate-500">
              {diag.adcPinBat} (Bat Divider Out)
            </div>
            <div className="text-lg font-mono font-bold text-slate-900 tabular-nums mt-0.5">
              {diag.vAdcBat.toFixed(2)} V
              <span className="text-xs font-normal text-slate-500 ml-1.5">
                (ADC {diag.rawCountsBat})
              </span>
            </div>
            <div
              className={`text-[11px] font-mono mt-1 flex items-center gap-1 ${
                diag.batPinOk ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {diag.batPinOk ? (
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              )}
              {diag.batPinOk
                ? `Safe (< ${diag.adcMaxV.toFixed(1)}V limit)`
                : `Overvoltage (> ${diag.adcMaxV.toFixed(1)}V)`}
            </div>
          </div>

          <div className="border border-slate-200 rounded-md p-3 bg-slate-50/50">
            <div className="text-[11px] font-mono uppercase text-slate-500">
              {diag.adcPinCur} (ACS712 Scaled)
            </div>
            <div className="text-lg font-mono font-bold text-slate-900 tabular-nums mt-0.5">
              {diag.vAdcIpv.toFixed(2)} V
              <span className="text-xs font-normal text-slate-500 ml-1.5">
                ({scenario.pvCurrent.toFixed(2)} A)
              </span>
            </div>
            <div
              className={`text-[11px] font-mono mt-1 flex items-center gap-1 ${
                diag.curPinOk ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {diag.curPinOk ? (
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              )}
              {diag.isArduino ? 'Direct 5V OK' : '10k/20k Divider OK'}
            </div>
          </div>

          <div className="border border-slate-200 rounded-md p-3 bg-slate-50/50">
            <div className="text-[11px] font-mono uppercase text-slate-500">
              Buck PWM &amp; Q3 Isolation
            </div>
            <div className="text-lg font-mono font-bold text-blue-700 tabular-nums mt-0.5">
              {diag.buckActive ? `${diag.dutyPct.toFixed(1)}% PWM` : '0% (LOCKED)'}
            </div>
            <div className="text-[11px] font-mono mt-1 flex items-center gap-1">
              {diag.q3Conducting ? (
                <span className="text-emerald-700">
                  ● Charging {diag.iBat.toFixed(2)}A ({diag.pBat.toFixed(1)}W)
                </span>
              ) : (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                  Q3 Open · IR2104 SD LOW
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

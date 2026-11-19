import { useMemo, useState } from 'react';
import { Check, Copy, Search } from 'lucide-react';
import {
  ARDUINO_FIRMWARE_CODE,
  ARDUINO_PINOUT,
  ControllerPlatform,
  ESP32_FIRMWARE_CODE,
  ESP32_PINOUT,
  HYBRID_ESP32_CODE,
  HYBRID_EXTRA_PINOUT,
  NOVEL_PV_SCOPE_CODE,
  PinoutRow,
  PLATFORM_META,
} from '../data/mpptData';

type PinSubsystemFilter = 'All' | PinoutRow['subsystem'];

interface PinoutAndFirmwareProps {
  platform: ControllerPlatform;
  onChangePlatform: (p: ControllerPlatform) => void;
}

export function PinoutAndFirmware({ platform, onChangePlatform }: PinoutAndFirmwareProps) {
  const [filter, setFilter] = useState<PinSubsystemFilter>('All');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [hybridCodeTab, setHybridCodeTab] = useState<'arduino' | 'esp32'>('arduino');
  const [firmwareTier, setFirmwareTier] = useState<'standard' | 'novel'>('novel');

  const activePinout = useMemo(() => {
    if (platform === 'esp32') return ESP32_PINOUT;
    if (platform === 'arduino') return ARDUINO_PINOUT;
    return HYBRID_EXTRA_PINOUT;
  }, [platform]);

  const subsystemFilters: PinSubsystemFilter[] = useMemo(() => {
    const base: PinSubsystemFilter[] = [
      'All',
      'ADC Sensing',
      'PWM Gate Drive',
      'I2C / 1-Wire',
      'Protection',
    ];
    return platform === 'hybrid' ? [...base, 'UART Bridge'] : base;
  }, [platform]);

  const filteredPins = useMemo(() => {
    return activePinout.filter((row) => {
      const matchesSub = filter === 'All' || row.subsystem === filter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        row.gpio.toLowerCase().includes(q) ||
        row.component.toLowerCase().includes(q) ||
        row.conditioning.toLowerCase().includes(q);
      return matchesSub && matchesQuery;
    });
  }, [activePinout, filter, query]);

  const activeCode = useMemo(() => {
    if (firmwareTier === 'novel') return NOVEL_PV_SCOPE_CODE;
    if (platform === 'esp32') return ESP32_FIRMWARE_CODE;
    if (platform === 'arduino') return ARDUINO_FIRMWARE_CODE;
    return hybridCodeTab === 'arduino' ? ARDUINO_FIRMWARE_CODE : HYBRID_ESP32_CODE;
  }, [platform, hybridCodeTab, firmwareTier]);

  const activeFilename = useMemo(() => {
    if (firmwareTier === 'novel') return 'pvscope_d2idv2_esr_gmppt.ino';
    if (platform === 'esp32') return 'mppt_esp32_po.ino';
    if (platform === 'arduino') return 'mppt_arduino_timer1.ino';
    return hybridCodeTab === 'arduino'
      ? '1_arduino_mppt_buck.ino'
      : '2_esp32_wifi_bridge.ino';
  }, [platform, hybridCodeTab, firmwareTier]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="pinout" className="scroll-mt-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-blue-600 mb-1">
            02. Microcontroller Pinout &amp; MPPT Code
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            {PLATFORM_META[platform].label} Pinout Matrix &amp; Firmware
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            {PLATFORM_META[platform].mcuSummary}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 border border-slate-200 rounded-lg self-start lg:self-auto">
          {(['esp32', 'arduino', 'hybrid'] as ControllerPlatform[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onChangePlatform(p);
                setFilter('All');
              }}
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left: Pinout Matrix */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg flex flex-col">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md">
              {subsystemFilters.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setFilter(sub)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    filter === sub
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter pin or sensor..."
                aria-label="Filter microcontroller pinout"
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 w-full sm:w-48"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">MCU Pin</th>
                  <th className="py-2.5 px-4">Connected Node</th>
                  <th className="py-2.5 px-4">Signal Conditioning</th>
                  <th className="py-2.5 px-4">Range &amp; Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPins.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      No pin assignments match &ldquo;{query}&rdquo;.
                    </td>
                  </tr>
                ) : (
                  filteredPins.map((row) => (
                    <tr key={`${platform}-${row.pinLabel}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 align-top">
                        <div className="font-mono font-semibold text-blue-700 whitespace-nowrap">
                          {row.gpio}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{row.subsystem}</div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-medium text-slate-900">{row.component}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{row.notes}</div>
                      </td>
                      <td className="py-3 px-4 align-top font-mono text-slate-700">
                        {row.conditioning}
                      </td>
                      <td className="py-3 px-4 align-top font-mono text-slate-700 whitespace-nowrap">
                        {row.signalRange}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: C++ Firmware Viewer */}
        <div className="xl:col-span-5 bg-slate-950 text-slate-100 border border-slate-800 rounded-lg flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-white">{activeFilename}</div>
              <div className="text-[11px] font-mono text-slate-400">
                {PLATFORM_META[platform].pwmSpec}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-700 rounded">
                <button
                  type="button"
                  onClick={() => setFirmwareTier('novel')}
                  className={`px-2 py-1 text-[11px] font-mono rounded cursor-pointer ${
                    firmwareTier === 'novel'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  d²I/dV² + ESR
                </button>
                <button
                  type="button"
                  onClick={() => setFirmwareTier('standard')}
                  className={`px-2 py-1 text-[11px] font-mono rounded cursor-pointer ${
                    firmwareTier === 'standard'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Basic P&amp;O
                </button>
              </div>

              {firmwareTier === 'standard' && platform === 'hybrid' && (
                <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-700 rounded">
                  <button
                    type="button"
                    onClick={() => setHybridCodeTab('arduino')}
                    className={`px-2 py-1 text-[11px] font-mono rounded cursor-pointer ${
                      hybridCodeTab === 'arduino'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Arduino
                  </button>
                  <button
                    type="button"
                    onClick={() => setHybridCodeTab('esp32')}
                    className={`px-2 py-1 text-[11px] font-mono rounded cursor-pointer ${
                      hybridCodeTab === 'esp32'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ESP32 Wi-Fi
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    Copy Code
                  </>
                )}
              </button>
            </div>
          </div>

          <pre className="p-4 text-[11.5px] leading-relaxed font-mono text-slate-200 overflow-x-auto max-h-[480px] overflow-y-auto">
            <code>{activeCode}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

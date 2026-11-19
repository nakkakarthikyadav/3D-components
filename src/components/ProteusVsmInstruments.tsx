import { useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  FileCode2,
  Monitor,
  Radio,
  Send,
  Terminal,
  Upload,
} from 'lucide-react';
import { ControllerPlatform, PLATFORM_META } from '../data/mpptData';

export interface VsmLiveState {
  running: boolean;
  buckSwitching: boolean;
  shootThrough: boolean;
  vPv: number;
  iPv: number;
  vBat: number;
  iBat: number;
  vAdcPv: number;
  duty: number;
  deltaIL: number;
  fSwKhz: number;
  deadTimeNs: number;
  inductanceUh: number;
  simTimeMs: number;
}

interface ProteusVsmInstrumentsProps {
  platform: ControllerPlatform;
  state: VsmLiveState;
}

type InstrumentTab = 'terminal' | 'logic' | 'oled_i2c' | 'mcu_hex';

export function ProteusVsmInstruments({ platform, state }: ProteusVsmInstrumentsProps) {
  const [activeTab, setActiveTab] = useState<InstrumentTab>('terminal');
  const [terminalLines, setTerminalLines] = useState<string[]>([
    '[VSM UART] Virtual Terminal initialized (8N1, Echo ON)',
    '[MCU BOOT] SolarMPPT 165Wp Mono PERC Firmware Ready. Type HELP for commands.',
  ]);
  const [cmdInput, setCmdInput] = useState('');
  const [loadedHexName, setLoadedHexName] = useState<string>(
    platform === 'arduino' ? 'mppt_timer1_40khz.ino.hex' : 'pvscope_d2idv2_esr.elf'
  );
  const [loadedHexSize, setLoadedHexSize] = useState<string>(
    platform === 'arduino' ? '14.2 KB (44% Flash)' : '298.4 KB (22% Flash)'
  );
  const [cursorUs, setCursorUs] = useState<number>(12.5);

  useEffect(() => {
    setLoadedHexName(platform === 'arduino' ? 'mppt_timer1_40khz.ino.hex' : 'pvscope_d2idv2_esr.elf');
    setLoadedHexSize(platform === 'arduino' ? '14.2 KB (44% Flash)' : '298.4 KB (22% Flash)');
  }, [platform]);

  // Stream live UART packets into Virtual Terminal while ISIS VSM is running
  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(() => {
      const ts = (state.simTimeMs / 1000).toFixed(2).padStart(6, ' ');
      const line = state.shootThrough
        ? `[${ts}s] FAULT: Q1+Q2 SHOOT-THROUGH! DT=${state.deadTimeNs}ns I_PK>85A`
        : !state.buckSwitching
          ? `[${ts}s] LOCKOUT: SD=LOW Q3=OFF | VPV=${state.vPv.toFixed(1)}V VBAT=${state.vBat.toFixed(2)}V`
          : `[${ts}s] HIL,${state.vPv.toFixed(2)},${state.iPv.toFixed(2)},${state.vBat.toFixed(2)},${state.iBat.toFixed(2)},D=${(state.duty * 100).toFixed(1)}%,dIL=${state.deltaIL.toFixed(2)}A`;
      setTerminalLines((prev) => [...prev.slice(-14), line]);
    }, 850);
    return () => window.clearInterval(timer);
  }, [
    state.running,
    state.shootThrough,
    state.buckSwitching,
    state.vPv,
    state.iPv,
    state.vBat,
    state.iBat,
    state.duty,
    state.deltaIL,
    state.deadTimeNs,
    state.simTimeMs,
  ]);

  const handleSendCommand = () => {
    const cmd = cmdInput.trim().toUpperCase();
    if (!cmd) return;
    const replies: string[] = [`> ${cmd}`];
    if (cmd === 'HELP') {
      replies.push('[MCU] Commands: STATUS | SWEEP | REG | CLEAR');
    } else if (cmd === 'STATUS') {
      replies.push(
        `[MCU] PV=${state.vPv.toFixed(2)}V/${state.iPv.toFixed(2)}A | BAT=${state.vBat.toFixed(2)}V/${state.iBat.toFixed(2)}A | PWM=${(state.duty * 100).toFixed(1)}% @ ${state.fSwKhz}kHz`
      );
    } else if (cmd === 'SWEEP') {
      replies.push(
        `[DSP] 90ms Global Sweep OK: V_mpp=${state.vPv.toFixed(1)}V | Peak d2I/dV2=0.42 A/V^2 (NO CRACK) | Bat ESR=24.8 mOhm`
      );
    } else if (cmd === 'REG') {
      const ocr = Math.round(state.duty * (platform === 'arduino' ? 399 : 1023));
      replies.push(
        platform === 'arduino'
          ? `[REG] TCCR1A=0x82 TCCR1B=0x19 ICR1=399 OCR1A=${ocr} ADMUX=0x40`
          : `[REG] LEDC_FREQ=${state.fSwKhz * 1000}Hz LEDC_DUTY=${ocr}/1023 GPIO19(SD)=${state.buckSwitching ? 1 : 0}`
      );
    } else if (cmd === 'CLEAR') {
      setTerminalLines(['[VSM UART] Buffer cleared.']);
      setCmdInput('');
      return;
    } else {
      replies.push(`[MCU] Unknown command "${cmd}". Type HELP.`);
    }
    setTerminalLines((prev) => [...prev.slice(-13), ...replies]);
    setCmdInput('');
  };

  const handleHexUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadedHexName(file.name);
    setLoadedHexSize(`${(file.size / 1024).toFixed(1)} KB (Loaded)`);
    setTerminalLines((prev) => [
      ...prev.slice(-13),
      `[VSM LOADER] Program file "${file.name}" attached to ${PLATFORM_META[platform].shortLabel} Flash.`,
    ]);
  };

  // Generate 5-channel Digital Logic Analyzer SVG paths (0..50us span)
  const logicPaths = useMemo(() => {
    const W = 680;
    const spanUs = 50;
    const periodUs = 1000 / Math.max(10, state.fSwKhz);
    const d = state.duty || 0.72;
    const dtUs = state.deadTimeNs / 1000;

    const buildDigital = (baseY: number, fn: (tUs: number) => boolean) => {
      const pts: string[] = [];
      const steps = 340;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * W;
        const tUs = (i / steps) * spanUs;
        const high = state.running ? fn(tUs) : false;
        const y = high ? baseY - 22 : baseY;
        pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      return pts.join(' ');
    };

    return {
      pwm: buildDigital(36, (t) => state.buckSwitching && (t % periodUs) / periodUs < d),
      sd: buildDigital(78, () => state.buckSwitching),
      ho: buildDigital(120, (t) => {
        if (!state.buckSwitching) return false;
        const p = t % periodUs;
        return state.shootThrough ? p <= periodUs * d + 0.8 : p >= dtUs && p <= periodUs * d;
      }),
      lo: buildDigital(162, (t) => {
        if (!state.buckSwitching) return false;
        const p = t % periodUs;
        return state.shootThrough
          ? p >= periodUs * d - 0.8
          : p >= periodUs * d + dtUs && p <= periodUs - dtUs;
      }),
      q3: buildDigital(204, () => state.buckSwitching && state.vPv > state.vBat + 0.8),
    };
  }, [state.running, state.buckSwitching, state.shootThrough, state.duty, state.fSwKhz, state.deadTimeNs, state.vPv, state.vBat]);

  // Live MCU Register & ADC Counts
  const mcuRegs = useMemo(() => {
    const isArd = platform === 'arduino';
    const adcMax = isArd ? 1023 : 4095;
    const vRef = isArd ? 5.0 : 3.3;
    const adcPvRaw = Math.min(adcMax, Math.max(0, Math.round((state.vAdcPv / vRef) * adcMax)));
    const adcBatRaw = Math.min(adcMax, Math.max(0, Math.round(((state.vBat * (isArd ? 0.248 : 0.1304)) / vRef) * adcMax)));
    const pwmMax = isArd ? 399 : 1023;
    const pwmReg = state.buckSwitching ? Math.round(state.duty * pwmMax) : 0;
    return {
      clock: isArd ? '16.000 MHz (ATmega328P)' : '240.000 MHz (Xtensa LX6)',
      adcPvRaw,
      adcBatRaw,
      adcMax,
      pwmLabel: isArd ? 'Timer1 OCR1A / ICR1' : 'LEDC CH0 Duty (10-bit)',
      pwmValue: `${pwmReg} / ${pwmMax}`,
      sdPin: isArd ? 'PORTB.0 (D8)' : 'GPIO19 (SD_EN)',
      q3Pin: isArd ? 'PORTD.7 (D7)' : 'GPIO25 (Q3_BLK)',
    };
  }, [platform, state.vAdcPv, state.vBat, state.duty, state.buckSwitching]);

  return (
    <div className="bg-slate-950 border-t border-slate-800 text-slate-100">
      {/* Proteus VSM Virtual Instruments Tab Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
          Proteus VSM Virtual Instruments Dock
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: 'terminal', label: 'Virtual Terminal (UART)', icon: Terminal },
              { id: 'logic', label: '5-Ch Logic Analyzer', icon: Radio },
              { id: 'oled_i2c', label: 'OLED & I2C Debugger', icon: Monitor },
              { id: 'mcu_hex', label: 'MCU .HEX Loader & Registers', icon: Cpu },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded cursor-pointer transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3 h-3" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Instrument Body */}
      <div className="p-3.5">
        {activeTab === 'terminal' && (
          <div className="space-y-2">
            <div className="bg-black border border-slate-800 rounded p-3 h-40 overflow-y-auto font-mono text-[11px] text-emerald-400 space-y-0.5">
              {terminalLines.map((line, i) => (
                <div key={i} className={line.includes('FAULT') ? 'text-red-400 font-semibold' : ''}>
                  {line}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendCommand();
                }}
                placeholder="Type UART command: HELP, STATUS, SWEEP, REG, CLEAR..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSendCommand}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer"
              >
                <Send className="w-3 h-3" aria-hidden="true" />
                Send TX
              </button>
            </div>
          </div>
        )}

        {activeTab === 'logic' && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
              <span>5-Channel Digital Timing Diagram (Span: 50 µs · Sample Rate: 20 MHz)</span>
              <label className="flex items-center gap-2">
                <span>Cursor T = {cursorUs.toFixed(1)} µs</span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={0.5}
                  value={cursorUs}
                  onChange={(e) => setCursorUs(Number(e.target.value))}
                  className="w-28 accent-amber-400 cursor-pointer"
                />
              </label>
            </div>
            <div className="bg-[#050a14] border border-slate-800 rounded p-2 overflow-x-auto">
              <svg viewBox="0 0 680 220" className="w-full h-auto font-mono select-none">
                <defs>
                  <pattern id="logicGrid" width="34" height="42" patternUnits="userSpaceOnUse">
                    <path d="M 34 0 L 0 0 0 42" fill="none" stroke="#162238" strokeWidth="0.7" />
                  </pattern>
                </defs>
                <rect width="680" height="220" fill="url(#logicGrid)" />
                <path d={logicPaths.pwm} fill="none" stroke="#38bdf8" strokeWidth="2" />
                <path d={logicPaths.sd} fill="none" stroke="#22c55e" strokeWidth="2" />
                <path d={logicPaths.ho} fill="none" stroke="#facc15" strokeWidth="2" />
                <path d={logicPaths.lo} fill="none" stroke="#e879f9" strokeWidth="2" />
                <path d={logicPaths.q3} fill="none" stroke="#fb923c" strokeWidth="2" />

                {/* Interactive yellow timing cursor */}
                <line
                  x1={(cursorUs / 50) * 680}
                  y1="0"
                  x2={(cursorUs / 50) * 680}
                  y2="220"
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  strokeWidth="1.2"
                />

                <text x="6" y="13" fill="#38bdf8" fontSize="9.5" fontWeight="bold">D0: MCU_PWM ({state.fSwKhz}kHz)</text>
                <text x="6" y="55" fill="#22c55e" fontSize="9.5" fontWeight="bold">D1: IR2104_SD (Enable)</text>
                <text x="6" y="97" fill="#facc15" fontSize="9.5" fontWeight="bold">D2: IR2104_HO (High Gate)</text>
                <text x="6" y="139" fill="#e879f9" fontSize="9.5" fontWeight="bold">D3: IR2104_LO (Low Sync · DT {state.deadTimeNs}ns)</text>
                <text x="6" y="181" fill="#fb923c" fontSize="9.5" fontWeight="bold">D4: Q3_NIGHT_BLK</text>
              </svg>
            </div>
          </div>
        )}

        {activeTab === 'oled_i2c' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
            {/* Virtual 0.96" SSD1306 Monochrome OLED Screen */}
            <div className="md:col-span-5 bg-[#020617] border-2 border-slate-700 rounded-lg p-3.5 font-mono flex flex-col justify-between">
              <div className="text-[11px] text-amber-300 border-b border-amber-500/30 pb-1 flex justify-between">
                <span>165W MPPT OLED</span>
                <span>{state.buckSwitching ? 'BULK' : 'IDLE'}</span>
              </div>
              <div className="space-y-1.5 py-2 text-cyan-300 text-xs">
                <div className="flex justify-between">
                  <span>PV :</span>
                  <span className="font-bold">
                    {state.vPv.toFixed(1)}V {state.iPv.toFixed(2)}A
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>BAT:</span>
                  <span className="font-bold">
                    {state.vBat.toFixed(2)}V {state.iBat.toFixed(2)}A
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>PWR:</span>
                  <span className="font-bold">{(state.vBat * state.iBat).toFixed(1)} W (96.2%)</span>
                </div>
                <div className="flex justify-between text-[11px] text-cyan-400">
                  <span>ESR: 24.8mΩ</span>
                  <span>d2I/dV2: OK</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-1">
                SSD1306 128×64 · I2C Addr 0x3C
              </div>
            </div>

            {/* Proteus I2C Protocol Debugger Frame Log */}
            <div className="md:col-span-7 bg-black border border-slate-800 rounded p-3 font-mono text-[11px] text-sky-300 space-y-1 overflow-x-auto">
              <div className="text-slate-400 border-b border-slate-800 pb-1">
                Proteus I2C Debugger (400 kHz Fast Mode · SDA/SCL)
              </div>
              <div>S 0x78 A 0x00 A 0xAF A P &nbsp;&nbsp;; SSD1306 DISPLAY_ON</div>
              <div>
                S 0x78 A 0x40 A [FRAME: PV={state.vPv.toFixed(1)}V BAT={state.vBat.toFixed(2)}V] A P
              </div>
              <div className="text-emerald-400">
                1-Wire DS18B20 (GPIO4): SKIP_ROM 0xCC → CONVERT_T 0x44 → 31.4°C (CRC OK)
              </div>
              <div className="text-slate-500">
                Bus Status: {state.running ? 'ACTIVE (ACK OK · 0 NACK Errors)' : 'IDLE (Simulation Stopped)'}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mcu_hex' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch text-xs font-mono">
            <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded p-3 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <FileCode2 className="w-4 h-4" aria-hidden="true" />
                Edit Component → Program File (.HEX / .ELF)
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-[11px]">
                <div className="text-slate-400">Active Binary:</div>
                <div className="text-emerald-400 font-semibold truncate">{loadedHexName}</div>
                <div className="text-slate-500 mt-0.5">{loadedHexSize}</div>
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold cursor-pointer">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                Load .HEX / .INO File
                <input
                  type="file"
                  accept=".hex,.elf,.ino,.bin"
                  onChange={handleHexUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded p-3 grid grid-cols-2 gap-2.5">
              <div className="bg-slate-950 border border-slate-800 rounded p-2">
                <div className="text-[10px] text-slate-400">CPU CLOCK</div>
                <div className="text-sky-300 font-semibold mt-0.5">{mcuRegs.clock}</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded p-2">
                <div className="text-[10px] text-slate-400">{mcuRegs.pwmLabel}</div>
                <div className="text-amber-300 font-semibold mt-0.5">{mcuRegs.pwmValue}</div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded p-2">
                <div className="text-[10px] text-slate-400">ADC_PV RAW COUNT</div>
                <div className="text-emerald-300 font-semibold mt-0.5">
                  {mcuRegs.adcPvRaw} / {mcuRegs.adcMax}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded p-2">
                <div className="text-[10px] text-slate-400">ADC_BAT RAW COUNT</div>
                <div className="text-emerald-300 font-semibold mt-0.5">
                  {mcuRegs.adcBatRaw} / {mcuRegs.adcMax}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded p-2">
                <div className="text-[10px] text-slate-400">{mcuRegs.sdPin}</div>
                <div className={state.buckSwitching ? 'text-emerald-400 font-semibold mt-0.5' : 'text-red-400 font-semibold mt-0.5'}>
                  {state.buckSwitching ? 'HIGH (1)' : 'LOW (0)'}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded p-2">
                <div className="text-[10px] text-slate-400">{mcuRegs.q3Pin}</div>
                <div className={state.buckSwitching ? 'text-emerald-400 font-semibold mt-0.5' : 'text-red-400 font-semibold mt-0.5'}>
                  {state.buckSwitching ? 'HIGH (ON)' : 'LOW (ISOLATED)'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

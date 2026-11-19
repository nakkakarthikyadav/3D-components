import { Component, ReactNode, useMemo, useState } from 'react';
import {
  BomCategory,
  BomItem,
  ControllerPlatform,
  CurrencyCode,
  formatMoney,
  getUnitPrice,
  INITIAL_BOM_ITEMS,
  PLATFORM_META,
} from './data/mpptData';
import { SOLAR_PANEL_OPTIONS, SolarPanelOption } from './data/panelOptions';
import { Header } from './components/Header';
import { PanelComparison } from './components/PanelComparison';
import { Proteus3DWorkbench } from './components/Proteus3DWorkbench';
import { CircuitSchematic } from './components/CircuitSchematic';
import { PinoutAndFirmware } from './components/PinoutAndFirmware';
import { HostelBuildGuide } from './components/HostelBuildGuide';
import { MpptSimulator } from './components/MpptSimulator';
import { PreOrderTester } from './components/PreOrderTester';
import { HilSerialScope } from './components/HilSerialScope';
import { CostBreakdown } from './components/CostBreakdown';

class WorkbenchErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-950">
          <p className="font-semibold">3D Workbench could not initialize on this browser ({this.state.message}).</p>
          <p className="text-xs text-amber-800 mt-1">
            All schematics, pinout diagrams, hostel steps, and BOM links below remain fully usable.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [bomItems, setBomItems] = useState<BomItem[]>(INITIAL_BOM_ITEMS);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('165w-perc');
  const [platform, setPlatform] = useState<ControllerPlatform>('hybrid');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [scope, setScope] = useState<'controller' | 'system'>('controller');
  const [contingencyPct, setContingencyPct] = useState<number>(10);

  const selectedPanel = useMemo(
    () => SOLAR_PANEL_OPTIONS.find((p) => p.id === selectedPanelId) ?? SOLAR_PANEL_OPTIONS[0],
    [selectedPanelId]
  );

  const handleSelectPanel = (panel: SolarPanelOption) => {
    setSelectedPanelId(panel.id);
    setBomItems((prev) =>
      prev.map((item) => {
        if (item.id === 'pv-panel') {
          return {
            ...item,
            name: panel.name,
            spec: `${panel.technology} · Vmp ${panel.vmp}V, Imp ${panel.imp}A, Voc ${panel.voc}V`,
            unitPriceINR: panel.priceINR,
            unitPriceUSD: panel.priceUSD,
            unitPriceEUR: Number((panel.priceUSD * 0.92).toFixed(2)),
          };
        }
        return item;
      })
    );
  };

  const kpiTotals = useMemo(() => {
    let controllerBase = 0;
    let systemBase = 0;

    for (const item of bomItems) {
      if (!item.included || !item.platforms.includes(platform)) continue;
      const line = getUnitPrice(item, currency) * item.qty;
      systemBase += line;
      if (item.scope === 'controller') {
        controllerBase += line;
      }
    }

    const mult = 1 + contingencyPct / 100;
    return {
      controllerParts: controllerBase,
      controllerWithContingency: controllerBase * mult,
      systemParts: systemBase,
      systemWithContingency: systemBase * mult,
    };
  }, [bomItems, platform, currency, contingencyPct]);

  const handleToggleInclude = (id: string) => {
    setBomItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, included: !item.included } : item))
    );
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setBomItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
      )
    );
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    setBomItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (currency === 'INR') return { ...item, unitPriceINR: newPrice };
        if (currency === 'EUR') return { ...item, unitPriceEUR: newPrice };
        return { ...item, unitPriceUSD: newPrice };
      })
    );
  };

  const handleAddCustomItem = (
    name: string,
    spec: string,
    category: BomCategory,
    price: number,
    qty: number
  ) => {
    const usd = currency === 'USD' ? price : currency === 'INR' ? price / 83 : price * 1.08;
    const inr = currency === 'INR' ? price : Math.round(usd * 83);
    const eur = currency === 'EUR' ? price : Number((usd / 1.08).toFixed(2));

    const newItem: BomItem = {
      id: `custom-${Date.now()}`,
      name,
      spec,
      category,
      scope: category === 'PV & Storage' ? 'system' : 'controller',
      platforms: ['esp32', 'arduino', 'hybrid'],
      qty,
      unitPriceUSD: Number(usd.toFixed(2)),
      unitPriceINR: inr,
      unitPriceEUR: eur,
      included: true,
    };
    setBomItems((prev) => [...prev, newItem]);
  };

  const handleDeleteCustomItem = (id: string) => {
    setBomItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleResetBom = () => {
    setBomItems(INITIAL_BOM_ITEMS);
    setSelectedPanelId('165w-perc');
    setContingencyPct(10);
  };

  const handleExportCsv = () => {
    const activeItems = bomItems.filter(
      (item) =>
        item.included &&
        item.platforms.includes(platform) &&
        (scope === 'system' || item.scope === 'controller')
    );
    const header = [
      'Component',
      'Specification',
      'Category',
      'Platform',
      'Scope',
      'Qty',
      `Unit (${currency})`,
      `Line Total (${currency})`,
    ];
    const rows = activeItems.map((item) => {
      const unit = getUnitPrice(item, currency);
      const total = unit * item.qty;
      return [
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.spec.replace(/"/g, '""')}"`,
        item.category,
        PLATFORM_META[platform].shortLabel,
        item.scope,
        String(item.qty),
        String(unit),
        total.toFixed(currency === 'INR' ? 0 : 2),
      ].join(',');
    });

    const baseSum = activeItems.reduce((acc, i) => acc + getUnitPrice(i, currency) * i.qty, 0);
    const contSum = baseSum * (contingencyPct / 100);
    rows.push(
      `"Shipping & Contingency (${contingencyPct}%)",,,,,,, "${contSum.toFixed(currency === 'INR' ? 0 : 2)}"`
    );
    rows.push(
      `"Grand Total",,,,,,, "${(baseSum + contSum).toFixed(currency === 'INR' ? 0 : 2)}"`
    );

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `150wp-${platform}-mppt-budget-${currency.toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header onExportCsv={handleExportCsv} />

      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-14 flex-1">
        {/* Top Interactive 3D Component Rack, Placement & Raw Default Connection Lab */}
        <WorkbenchErrorBoundary>
          <Proteus3DWorkbench platform={platform} onChangePlatform={setPlatform} />
        </WorkbenchErrorBoundary>

        {/* Project Datasheet & Budget KPI Summary */}
        <section aria-labelledby="hero-title" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 mb-3">
                  <span>{selectedPanel.shortName} PV</span>
                  <span aria-hidden="true">·</span>
                  <span>ESP32 &amp; Arduino Uno/Nano</span>
                  <span aria-hidden="true">·</span>
                  <span>40 kHz Synchronous Buck</span>
                </div>
                <h2
                  id="hero-title"
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance leading-[1.15]"
                >
                  {selectedPanel.shortName} MPPT + Self-Diagnostic PV-Scope Reference
                </h2>
                <p className="text-sm sm:text-base text-slate-600 mt-4 leading-relaxed max-w-2xl">
                  Built around our top <strong className="font-semibold text-slate-900">Cheap + Unique pick (165Wp Mono PERC)</strong> with{' '}
                  <strong className="font-semibold text-slate-900">ESP32</strong> &amp;{' '}
                  <strong className="font-semibold text-slate-900">Arduino Uno/Nano</strong>—combining{' '}
                  <strong className="font-semibold text-slate-900">d²I/dV² micro-crack detection</strong>,{' '}
                  <strong className="font-semibold text-slate-900">40 kHz buck-ripple battery ESR</strong>, and{' '}
                  <strong className="font-semibold text-slate-900">100ms Global MPPT</strong> in one hostel-buildable circuit.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-slate-200">
                <span className="text-xs font-mono text-slate-500 mr-1">Active Build:</span>
                {(['esp32', 'arduino', 'hybrid'] as ControllerPlatform[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      platform === p
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {PLATFORM_META[p].shortLabel}
                  </button>
                ))}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <a
                    href="#workbench-3d"
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    3D Proteus-Style Builder
                  </a>
                  <a
                    href="#hostel-guide"
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Step-by-Step Hostel Guide
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Selected Solar PV Module Electrical Datasheet */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {selectedPanel.shortName} Datasheet
                  </h2>
                  <p className="text-xs text-slate-500">Standard Test Conditions (1000 W/m², 25°C)</p>
                </div>
                <span className="text-xs font-mono text-amber-700 font-semibold">
                  {selectedPanel.pMaxW} Wp
                </span>
              </div>

              <div className="divide-y divide-slate-100 mt-2">
                {[
                  { label: 'Maximum Power', sym: 'Pmp', val: `${selectedPanel.pMaxW}`, unit: 'Wp' },
                  { label: 'Voltage at Max Power', sym: 'Vmp', val: `${selectedPanel.vmp.toFixed(1)}`, unit: 'V' },
                  { label: 'Current at Max Power', sym: 'Imp', val: `${selectedPanel.imp.toFixed(2)}`, unit: 'A' },
                  { label: 'Open-Circuit Voltage', sym: 'Voc', val: `${selectedPanel.voc.toFixed(1)}`, unit: 'V' },
                  { label: 'Short-Circuit Current', sym: 'Isc', val: `${selectedPanel.isc.toFixed(2)}`, unit: 'A' },
                  { label: 'Temp. Coeff (Voc)', sym: 'β', val: `${selectedPanel.tempCoeffVoc}`, unit: '%/°C' },
                  { label: 'MOSFET Rating Needed', sym: 'V_ds', val: selectedPanel.highVoltageUpgrade ? '100V IRFB4110' : '55V IRF3205', unit: '' },
                ].map((row) => (
                  <div
                    key={row.sym}
                    className="py-2 flex items-baseline justify-between gap-4 text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-800">{row.label}</span>
                      <span className="text-slate-400 font-mono ml-1.5">({row.sym})</span>
                    </div>
                    <div className="font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {row.val}
                      {row.unit && (
                        <span className="text-slate-500 font-normal ml-1">{row.unit}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4-Column Full-Width KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Selected Architecture
              </div>
              <div className="text-lg font-bold text-slate-900 mt-1 truncate">
                {PLATFORM_META[platform].label}
              </div>
              <div className="text-xs font-mono text-slate-500 mt-1">
                {PLATFORM_META[platform].logicLevel}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                PV Operating Point ({selectedPanel.pMaxW}Wp)
              </div>
              <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
                {selectedPanel.vmp.toFixed(1)} V <span className="text-sm font-normal text-slate-400">@</span> {selectedPanel.imp.toFixed(2)} A
              </div>
              <div className="text-xs font-mono text-slate-500 mt-1">
                Voc {selectedPanel.voc.toFixed(1)}V · {selectedPanel.highVoltageUpgrade ? 'Needs 100V Stage' : '96.2% Sync Buck'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Mini-Project Controller Budget
              </div>
              <div className="text-2xl font-mono font-bold text-blue-700 tabular-nums mt-1">
                {formatMoney(kpiTotals.controllerParts, currency)}
              </div>
              <div className="text-xs font-mono text-slate-500 mt-1">
                {formatMoney(kpiTotals.controllerWithContingency, currency)} w/ +{contingencyPct}% spares
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Full {selectedPanel.pMaxW}Wp + Battery Budget
              </div>
              <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
                {formatMoney(kpiTotals.systemParts, currency)}
              </div>
              <div className="text-xs font-mono text-slate-500 mt-1">
                {formatMoney(kpiTotals.systemWithContingency, currency)} w/ +{contingencyPct}% shipping
              </div>
            </div>
          </div>
        </section>

        {/* 7-Panel Comparison & Unique Innovation Upgrades */}
        <PanelComparison
          selectedPanelId={selectedPanelId}
          onSelectPanel={handleSelectPanel}
        />

        {/* Section 1: Interactive Circuit & Connection Diagram */}
        <CircuitSchematic platform={platform} onChangePlatform={setPlatform} />

        {/* Section 2: Microcontroller Pinout Matrix & Firmware */}
        <PinoutAndFirmware platform={platform} onChangePlatform={setPlatform} />

        {/* Section 3: Step-by-Step Hostel Build Guide */}
        <HostelBuildGuide platform={platform} onChangePlatform={setPlatform} />

        {/* Section 4: Live Selected-Panel I-V / P-V MPPT Simulator & Pre-Order Bench Test */}
        <div>
          <MpptSimulator panel={selectedPanel} />
          <PreOrderTester platform={platform} panel={selectedPanel} />
        </div>

        {/* Section 5: World-First USB Web-Serial Hardware-in-the-Loop (HIL) Parity & Calibration */}
        <HilSerialScope platform={platform} panel={selectedPanel} />

        {/* Section 6: Itemized BOM & Mini-Project Budget */}
        <CostBreakdown
          items={bomItems}
          platform={platform}
          currency={currency}
          scope={scope}
          contingencyPct={contingencyPct}
          onChangePlatform={setPlatform}
          onChangeCurrency={setCurrency}
          onChangeScope={setScope}
          onChangeContingency={setContingencyPct}
          onToggleInclude={handleToggleInclude}
          onUpdateQty={handleUpdateQty}
          onUpdatePrice={handleUpdatePrice}
          onAddCustomItem={handleAddCustomItem}
          onDeleteCustomItem={handleDeleteCustomItem}
          onResetBom={handleResetBom}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>SolarMPPT 150W Mini-Project Reference · ESP32 &amp; Arduino Uno/Nano</span>
          <span className="font-mono">
            Safety reminder: Connect 12V battery before PV panel; verify 12V/5V aux rails prior to IC insertion.
          </span>
        </div>
      </footer>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ExternalLink, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  BomCategory,
  BomItem,
  ControllerPlatform,
  CURRENCIES,
  CurrencyCode,
  formatMoney,
  getUnitPrice,
  PLATFORM_META,
} from '../data/mpptData';

interface CostBreakdownProps {
  items: BomItem[];
  platform: ControllerPlatform;
  currency: CurrencyCode;
  scope: 'controller' | 'system';
  contingencyPct: number;
  onChangePlatform: (p: ControllerPlatform) => void;
  onChangeCurrency: (c: CurrencyCode) => void;
  onChangeScope: (s: 'controller' | 'system') => void;
  onChangeContingency: (pct: number) => void;
  onToggleInclude: (id: string) => void;
  onUpdateQty: (id: string, delta: number) => void;
  onUpdatePrice: (id: string, newPrice: number) => void;
  onAddCustomItem: (name: string, spec: string, category: BomCategory, price: number, qty: number) => void;
  onDeleteCustomItem: (id: string) => void;
  onResetBom: () => void;
}

const CATEGORIES: ('All' | BomCategory)[] = [
  'All',
  'PV & Storage',
  'Power Stage',
  'Compute & Sensing',
  'Protection & Enclosure',
];

const CATEGORY_COLORS: Record<BomCategory, string> = {
  'PV & Storage': 'bg-amber-500',
  'Power Stage': 'bg-blue-600',
  'Compute & Sensing': 'bg-cyan-600',
  'Protection & Enclosure': 'bg-slate-600',
};

export function CostBreakdown({
  items,
  platform,
  currency,
  scope,
  contingencyPct,
  onChangePlatform,
  onChangeCurrency,
  onChangeScope,
  onChangeContingency,
  onToggleInclude,
  onUpdateQty,
  onUpdatePrice,
  onAddCustomItem,
  onDeleteCustomItem,
  onResetBom,
}: CostBreakdownProps) {
  const [categoryFilter, setCategoryFilter] = useState<'All' | BomCategory>('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customSpec, setCustomSpec] = useState('');
  const [customCategory, setCustomCategory] = useState<BomCategory>('Protection & Enclosure');
  const [customPrice, setCustomPrice] = useState('5');
  const [customQty, setCustomQty] = useState('1');

  const scopedItems = useMemo(() => {
    return items.filter(
      (item) =>
        item.platforms.includes(platform) &&
        (scope === 'system' || item.scope === 'controller')
    );
  }, [items, platform, scope]);

  const visibleItems = useMemo(() => {
    return scopedItems.filter(
      (item) => categoryFilter === 'All' || item.category === categoryFilter
    );
  }, [scopedItems, categoryFilter]);

  const summary = useMemo(() => {
    const byCategory: Record<BomCategory, number> = {
      'PV & Storage': 0,
      'Power Stage': 0,
      'Compute & Sensing': 0,
      'Protection & Enclosure': 0,
    };

    let baseSubtotal = 0;

    for (const item of scopedItems) {
      if (!item.included) continue;
      const lineTotal = getUnitPrice(item, currency) * item.qty;
      baseSubtotal += lineTotal;
      byCategory[item.category] += lineTotal;
    }

    const contingencyAmount = baseSubtotal * (contingencyPct / 100);
    const grandTotal = baseSubtotal + contingencyAmount;
    const costPerWatt = grandTotal / 150;

    // Cross-platform comparison totals for Mini-Project Budget Matrix
    const calcPlatformTotal = (p: ControllerPlatform, s: 'controller' | 'system') => {
      const base = items
        .filter(
          (it) =>
            it.included &&
            it.platforms.includes(p) &&
            (s === 'system' || it.scope === 'controller')
        )
        .reduce((acc, it) => acc + getUnitPrice(it, currency) * it.qty, 0);
      return base * (1 + contingencyPct / 100);
    };

    return {
      byCategory,
      baseSubtotal,
      contingencyAmount,
      grandTotal,
      costPerWatt,
      comparison: {
        esp32: {
          ctrl: calcPlatformTotal('esp32', 'controller'),
          sys: calcPlatformTotal('esp32', 'system'),
        },
        arduino: {
          ctrl: calcPlatformTotal('arduino', 'controller'),
          sys: calcPlatformTotal('arduino', 'system'),
        },
        hybrid: {
          ctrl: calcPlatformTotal('hybrid', 'controller'),
          sys: calcPlatformTotal('hybrid', 'system'),
        },
      },
    };
  }, [scopedItems, items, currency, contingencyPct]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Math.max(0, Number(customPrice) || 0);
    const parsedQty = Math.max(1, Math.round(Number(customQty) || 1));
    if (!customName.trim()) return;
    onAddCustomItem(
      customName.trim(),
      customSpec.trim() || 'User-added component',
      customCategory,
      parsedPrice,
      parsedQty
    );
    setCustomName('');
    setCustomSpec('');
    setCustomPrice('5');
    setCustomQty('1');
    setShowAddForm(false);
  };

  return (
    <section id="costs" className="scroll-mt-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-blue-600 mb-1">
            05. Mini-Project Budget &amp; Bill of Materials
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Component Costs &amp; Total Project Expense Breakdown
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Compare mini-project budgets across ESP32, Arduino Uno/Nano, or Hybrid builds. Edit any
            quantity or unit price below to match your local electronics supplier.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-md">
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onChangeCurrency(code)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  currency === code
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {CURRENCIES[code].label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onResetBom}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset BOM
          </button>
        </div>
      </div>

      {/* Platform Budget Comparison Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {(['esp32', 'arduino', 'hybrid'] as ControllerPlatform[]).map((p) => {
          const isSelected = platform === p;
          const comp = summary.comparison[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChangePlatform(p)}
              className={`text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/70 border-blue-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {PLATFORM_META[p].label}
                </span>
                <span className="text-[11px] font-mono text-blue-700 font-semibold">
                  {isSelected ? 'Selected' : 'Select'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between text-xs">
                <span className="text-slate-500">Controller Mini-Project:</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {formatMoney(comp.ctrl, currency)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-xs">
                <span className="text-slate-500">Full 150Wp + Battery:</span>
                <span className="font-mono font-semibold text-slate-700 tabular-nums">
                  {formatMoney(comp.sys, currency)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Expense Summary Strip & Distribution Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono uppercase text-slate-500">Budget Scope:</span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              <button
                type="button"
                onClick={() => onChangeScope('controller')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  scope === 'controller'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mini-Project Controller Only
              </button>
              <button
                type="button"
                onClick={() => onChangeScope('system')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  scope === 'system'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full System (w/ 150Wp PV + Battery)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono uppercase text-slate-500">
              Shipping &amp; Spares:
            </span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {[0, 10, 15].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => onChangeContingency(pct)}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    contingencyPct === pct
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  +{pct}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 py-5 border-b border-slate-200">
          <div>
            <div className="text-xs font-mono uppercase text-slate-500">
              Parts Subtotal ({scopedItems.filter((i) => i.included).length} items)
            </div>
            <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
              {formatMoney(summary.baseSubtotal, currency)}
            </div>
          </div>

          <div>
            <div className="text-xs font-mono uppercase text-slate-500">
              Shipping &amp; Contingency (+{contingencyPct}%)
            </div>
            <div className="text-2xl font-mono font-semibold text-slate-700 tabular-nums mt-1">
              {formatMoney(summary.contingencyAmount, currency)}
            </div>
          </div>

          <div>
            <div className="text-xs font-mono uppercase text-blue-600 font-semibold">
              Total Project Budget ({PLATFORM_META[platform].shortLabel})
            </div>
            <div className="text-2xl font-mono font-bold text-blue-700 tabular-nums mt-1">
              {formatMoney(summary.grandTotal, currency)}
            </div>
          </div>

          <div>
            <div className="text-xs font-mono uppercase text-slate-500">
              Normalized Cost / Watt (150Wp)
            </div>
            <div className="text-2xl font-mono font-semibold text-slate-900 tabular-nums mt-1">
              {formatMoney(summary.costPerWatt, currency)}
              <span className="text-xs font-normal text-slate-500 ml-1">/ Wp</span>
            </div>
          </div>
        </div>

        {/* Stacked Category Allocation Bar */}
        <div className="pt-5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-2">
            <span>Expense Distribution by Subsystem</span>
            <span>100% of Base Parts</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-sm overflow-hidden flex">
            {(Object.keys(summary.byCategory) as BomCategory[]).map((cat) => {
              const val = summary.byCategory[cat];
              const pct = summary.baseSubtotal > 0 ? (val / summary.baseSubtotal) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={cat}
                  style={{ width: `${pct}%` }}
                  className={`${CATEGORY_COLORS[cat]} h-full transition-all`}
                  title={`${cat}: ${formatMoney(val, currency)} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {(Object.keys(summary.byCategory) as BomCategory[]).map((cat) => {
              const val = summary.byCategory[cat];
              const pct = summary.baseSubtotal > 0 ? (val / summary.baseSubtotal) * 100 : 0;
              return (
                <div
                  key={cat}
                  className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200/80 rounded-md px-3 py-2"
                >
                  <span className="inline-flex items-center gap-2 text-slate-700 font-medium">
                    <span className={`w-2.5 h-2.5 rounded-xs ${CATEGORY_COLORS[cat]}`} />
                    {cat}
                  </span>
                  <span className="font-mono text-slate-900 tabular-nums">
                    {formatMoney(val, currency)}{' '}
                    <span className="text-slate-400">({pct.toFixed(0)}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Itemized BOM Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md">
            {CATEGORIES.filter(
              (cat) => scope === 'system' || cat !== 'PV & Storage'
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add Custom Expense
          </button>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddSubmit}
            className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">
                Component Name
              </label>
              <input
                type="text"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Digital Wattmeter"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">
                Specification
              </label>
              <input
                type="text"
                value={customSpec}
                onChange={(e) => setCustomSpec(e.target.value)}
                placeholder="Optional notes"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">
                Category
              </label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as BomCategory)}
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Power Stage">Power Stage</option>
                <option value="Compute & Sensing">Compute &amp; Sensing</option>
                <option value="Protection & Enclosure">Protection &amp; Enclosure</option>
                {scope === 'system' && <option value="PV & Storage">PV &amp; Storage</option>}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">
                Qty
              </label>
              <input
                type="number"
                min={1}
                value={customQty}
                onChange={(e) => setCustomQty(e.target.value)}
                className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-mono uppercase text-slate-500 mb-1">
                Unit ({CURRENCIES[currency].symbol})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="sm:col-span-1">
              <button
                type="submit"
                className="w-full px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer"
              >
                Add
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-4 w-10">Use</th>
                <th className="py-2.5 px-4">Component &amp; Specification</th>
                <th className="py-2.5 px-4">Cheapest Store &amp; Link</th>
                <th className="py-2.5 px-4 text-center">Qty</th>
                <th className="py-2.5 px-4 text-right">Unit Cost ({CURRENCIES[currency].symbol})</th>
                <th className="py-2.5 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {visibleItems.map((item) => {
                const unitPrice = getUnitPrice(item, currency);
                const lineTotal = item.included ? unitPrice * item.qty : 0;
                const isCustom = item.id.startsWith('custom-');

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.included ? 'hover:bg-slate-50/80' : 'bg-slate-50/50 opacity-55'
                    }`}
                  >
                    <td className="py-3 px-4 align-top">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={() => onToggleInclude(item.id)}
                        aria-label={`Include ${item.name}`}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        <span>{item.name}</span>
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => onDeleteCustomItem(item.id)}
                            className="text-slate-400 hover:text-red-600 cursor-pointer"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.spec}</div>
                      <div className="text-[10.5px] font-mono text-slate-400 mt-0.5">{item.category}</div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      {item.cheapestUrl ? (
                        <div className="space-y-1">
                          <a
                            href={item.cheapestUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap"
                          >
                            <span>{item.cheapestStore}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                          </a>
                          {item.priceComparison && item.priceComparison.length > 1 && (
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10.5px] text-slate-500">
                              {item.priceComparison.slice(1).map((alt) => (
                                <a
                                  key={alt.store}
                                  href={alt.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-slate-800 hover:underline whitespace-nowrap"
                                >
                                  {alt.store} ({alt.priceText})
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">Custom / Local</span>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="inline-flex items-center border border-slate-200 rounded bg-white">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, -1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 font-mono text-slate-900 tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <input
                        type="number"
                        min={0}
                        step={currency === 'INR' ? '1' : '0.10'}
                        value={unitPrice}
                        onChange={(e) => onUpdatePrice(item.id, Math.max(0, Number(e.target.value) || 0))}
                        aria-label={`Unit price for ${item.name}`}
                        className="w-24 text-right px-2 py-1 font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-600 tabular-nums"
                      />
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatMoney(lineTotal, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-mono text-xs">
                <td colSpan={4} className="py-3 px-4 text-slate-600">
                  Base Parts Subtotal + {contingencyPct}% Shipping/Contingency ({formatMoney(summary.contingencyAmount, currency)})
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-700 uppercase">
                  Grand Total
                </td>
                <td className="py-3 px-4 text-right text-base font-bold text-blue-700 tabular-nums whitespace-nowrap">
                  {formatMoney(summary.grandTotal, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

import { AlertTriangle, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';
import {
  SOLAR_PANEL_OPTIONS,
  SolarPanelOption,
  UNIQUE_PROJECT_UPGRADES,
} from '../data/panelOptions';

interface PanelComparisonProps {
  selectedPanelId: string;
  onSelectPanel: (panel: SolarPanelOption) => void;
}

export function PanelComparison({ selectedPanelId, onSelectPanel }: PanelComparisonProps) {
  const activePanel =
    SOLAR_PANEL_OPTIONS.find((p) => p.id === selectedPanelId) ?? SOLAR_PANEL_OPTIONS[0];

  return (
    <section id="panel-choice" className="scroll-mt-16 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-blue-600 mb-1">
            00. Panel Selection &amp; World-First Diagnostic Stack
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Chosen Panel: 165 Wp Mono PERC (Cheap + Unique)
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Comparing all 7 solar panels for a hostel mini-project. Click any row below to sync its
            electrical datasheet, MOSFET safety limits, simulator curve, and budget.
          </p>
        </div>

        {selectedPanelId !== '165w-perc' && (
          <button
            type="button"
            onClick={() => onSelectPanel(SOLAR_PANEL_OPTIONS[0])}
            className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Switch Back to Chosen Pick (165Wp PERC)
          </button>
        )}
      </div>

      {/* Clear Verdict Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50/80 border-2 border-blue-500 rounded-lg p-4">
          <div className="text-xs font-mono uppercase text-blue-700 font-semibold">
            Chosen #1 Pick · Cheap + Unique
          </div>
          <div className="text-base font-bold text-slate-900 mt-1">
            165 Wp Mono PERC (~₹4,600–₹5,800)
          </div>
          <p className="text-xs text-slate-700 mt-1 leading-relaxed">
            Costs only ~₹300 more than plain Poly, drops directly into our 55V IRF3205 circuit
            (22.8V Voc), uses rear dielectric passivation (rare in student builds), and unlocks
            d²I/dV² micro-crack diagnostics.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-blue-200/80">
            <a
              href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHFlaAnNoBTqzbcLbRyhNtDg-XvRJk_egOb5pEM-9_vyEeq2hDLUg8dldh0u3ewDsTLwYXD_BohWdhCWoomlcGA1HzS6hT64cxKme7QlQPzukgerCULZDel5lOtqbnmK3C3HbXiVQmdgjDDcSJiFmpW5Pz0ZIwAQJt5GCVxdD_Ihmd5OpuGkxHjxhkAkq3ffw=="
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Order (Industrybuying SUI PERC)
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
            <a
              href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF0tnqc4SelQXEsIcWpTUTbvXj5JuSfYHcbnP-iyVekLI97NYHqGLEd2-37LHdlanN-5ZgbUpdQE2yCHcqTefcmmvjSIkUTz0-Qhj19Vi7FJk-n2By4V5cS4dItmtoo5v_ypcMEvbCH6W294uZ5sq7KsmndgmCQVALv5GrolWoZoFeiVyY="
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded transition-colors"
            >
              IndiaMART (Livguard PERC)
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
            <a
              href="https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG_k7skZgxjxZg8Ln8GXJoWUCbfBN45jgtespgq5k6xUePKhZpDfoxBza9hp3naWbiX1GCAXcYpsHXNlv6JRlJ7BNWn3KoOwy85tvonQKED-gIe6DGWNUgKdOSyMacMkyWsgwhymZ433MIgxZExOgi-15hm0jApUHNL2J1ZW9RVrpk="
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded transition-colors"
            >
              Flipkart (Exide 165W)
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-mono uppercase text-emerald-700 font-semibold">
            Raw Cheapest Baseline
          </div>
          <div className="text-base font-bold text-slate-900 mt-1">
            150 Wp Polycrystalline (~₹4,500)
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Lowest sticker price, stocked everywhere, safe 22.4V Voc—but 95%+ of college projects
            already use legacy Poly-Si with zero panel uniqueness.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-mono uppercase text-amber-700 font-semibold">
            Most Exotic (Not Cheap / Needs Redesign)
          </div>
          <div className="text-base font-bold text-slate-900 mt-1">
            70Wp CIGS / 90Wp Amorphous Si
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Flexible CIGS costs ₹9k–₹15k (too pricey); a-Si outputs 60V–90V Voc requiring 100V
            IRFB4110 MOSFETs. 165Wp PERC beats both on cost + reliability.
          </p>
        </div>
      </div>

      {/* 7-Panel Interactive Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-4">Solar PV Module</th>
                <th className="py-2.5 px-4">Voc / Vmp</th>
                <th className="py-2.5 px-4">Approx. Price</th>
                <th className="py-2.5 px-4">Availability</th>
                <th className="py-2.5 px-4">Circuit Compatibility</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SOLAR_PANEL_OPTIONS.map((panel) => {
                const isSelected = panel.id === selectedPanelId;
                return (
                  <tr
                    key={panel.id}
                    onClick={() => onSelectPanel(panel)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-slate-900">{panel.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {panel.technology} ·{' '}
                        <span className="font-mono text-blue-700 font-medium">
                          {panel.verdictTag}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top font-mono text-slate-800 whitespace-nowrap tabular-nums">
                      <div>Voc: {panel.voc.toFixed(1)} V</div>
                      <div className="text-slate-500">Vmp: {panel.vmp.toFixed(1)} V</div>
                    </td>
                    <td className="py-3 px-4 align-top font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {panel.priceRangeINR}
                    </td>
                    <td className="py-3 px-4 align-top text-slate-600 whitespace-nowrap">
                      {panel.availability}
                    </td>
                    <td className="py-3 px-4 align-top">
                      {panel.highVoltageUpgrade ? (
                        <span className="inline-flex items-center gap-1 text-amber-800 font-mono text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                          Needs 100V MOSFETs
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-mono text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                          Direct 55V IRF3205 Fit
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPanel(panel);
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Select'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Active Panel Hardware Impact Bar */}
        <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-semibold text-slate-900">{activePanel.shortName}:</span>{' '}
            <span className="text-slate-600">{activePanel.summary}</span>
          </div>
          <div className="font-mono text-slate-800 bg-white border border-slate-200 rounded px-3 py-1.5 shrink-0">
            Hardware Note: {activePanel.hardwareChangesNeeded}
          </div>
        </div>
      </div>

      {/* Research-Grounded "Never Combined Together" Diagnostic Upgrades */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              IEEE / MDPI Research Gap · Zero Extra Sensors Required
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              4-in-1 Self-Diagnostic Stack (Rarely Combined in Any MPPT Build)
            </h3>
          </div>

          <a
            href="#pinout"
            className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Copy d²I/dV² + ESR Firmware
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {UNIQUE_PROJECT_UPGRADES.map((upg) => (
            <div key={upg.title} className="bg-slate-50 border border-slate-200/80 rounded-md p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{upg.title}</div>
                <span className="text-[11px] font-mono text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded shrink-0">
                  {upg.badge}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                <strong className="text-slate-800">Research Gap:</strong> {upg.problemSolved}
              </p>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                <strong className="text-slate-800">How We Do It (₹0 HW):</strong> {upg.howItWorks}
              </p>
              <p className="text-[11px] font-mono text-emerald-700 mt-2">{upg.whyUnique}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

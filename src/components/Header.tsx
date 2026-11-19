import { Download } from 'lucide-react';

interface HeaderProps {
  onExportCsv: () => void;
}

export function Header({ onExportCsv }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          SolarMPPT 150W
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600"
        >
          <a
            href="#workbench-3d"
            className="text-blue-700 font-semibold hover:text-blue-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            3D Workbench
          </a>
          <a
            href="#schematic"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Schematic
          </a>
          <a
            href="#pinout"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Pinout &amp; Code
          </a>
          <a
            href="#hostel-guide"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Hostel Guide
          </a>
          <a
            href="#simulator"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            MPPT Simulator
          </a>
          <a
            href="#hil-bridge"
            className="text-emerald-700 font-semibold hover:text-emerald-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            USB HIL Lab
          </a>
          <a
            href="#costs"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Budget
          </a>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/solarmppt-165w-project.zip"
            download="solarmppt-165w-project.zip"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Download ZIP
          </a>

          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Export BOM CSV
          </button>
        </div>
      </div>
    </header>
  );
}

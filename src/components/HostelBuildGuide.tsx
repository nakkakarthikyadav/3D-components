import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Gauge, Lightbulb, Wrench } from 'lucide-react';
import { ControllerPlatform, PLATFORM_META } from '../data/mpptData';
import { getHostelSteps, HOSTEL_TROUBLESHOOTING } from '../data/hostelGuideData';

interface HostelBuildGuideProps {
  platform: ControllerPlatform;
  onChangePlatform: (p: ControllerPlatform) => void;
}

export function HostelBuildGuide({ platform, onChangePlatform }: HostelBuildGuideProps) {
  const steps = useMemo(() => getHostelSteps(platform), [platform]);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const toggleComplete = (stepNum: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNum]: !prev[stepNum],
    }));
  };

  const completedCount = steps.filter((s) => completedSteps[s.stepNumber]).length;
  const currentStep = steps.find((s) => s.stepNumber === activeStep) ?? steps[0];

  return (
    <section id="hostel-guide" className="scroll-mt-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-blue-600 mb-1">
            03. Step-by-Step Hostel Workbench Guide
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Build It Step-by-Step in Your Hostel Room
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Follow these 7 bench phases using only a soldering iron, multimeter, and a 19V laptop
            charger + series car-bulb &ldquo;smoke stopper&rdquo; before testing with your 150Wp solar panel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          <div className="text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-2 tabular-nums">
            Progress: <strong className="text-slate-900">{completedCount} / {steps.length}</strong> phases
          </div>
        </div>
      </div>

      {/* Main 2-Column Step-by-Step Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 border border-slate-200 bg-white rounded-lg overflow-hidden">
        {/* Left: Step List */}
        <div className="lg:col-span-5 bg-slate-50/70 border-b lg:border-b-0 lg:border-r border-slate-200 divide-y divide-slate-200">
          {steps.map((step) => {
            const isSelected = activeStep === step.stepNumber;
            const isDone = Boolean(completedSteps[step.stepNumber]);

            return (
              <div
                key={step.stepNumber}
                className={`flex items-start gap-3 p-4 transition-colors ${
                  isSelected ? 'bg-white' : 'hover:bg-slate-100/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleComplete(step.stepNumber)}
                  aria-label={`Mark Step ${step.stepNumber} complete`}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0"
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Circle className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep(step.stepNumber)}
                  className="text-left flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className={isSelected ? 'text-blue-700 font-bold' : 'text-slate-500'}>
                      STEP 0{step.stepNumber}
                    </span>
                    <span className="text-slate-400">{step.duration}</span>
                  </div>
                  <div
                    className={`text-sm font-semibold mt-0.5 ${
                      isDone ? 'text-slate-500 line-through' : 'text-slate-900'
                    }`}
                  >
                    {step.title}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* Right: Active Step Details */}
        <div className="lg:col-span-7 p-6 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-blue-600">
                  Phase 0{currentStep.stepNumber} · {PLATFORM_META[platform].label} · {currentStep.duration}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mt-1">
                  {currentStep.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1">{currentStep.goal}</p>
              </div>

              <button
                type="button"
                onClick={() => toggleComplete(currentStep.stepNumber)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  completedSteps[currentStep.stepNumber]
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {completedSteps[currentStep.stepNumber] ? 'Completed' : 'Mark Step Done'}
              </button>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3">
                Assembly Actions
              </h4>
              <ol className="space-y-3">
                {currentStep.checklist.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                    <span className="w-5 h-5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono font-semibold text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Mandatory Multimeter Pass/Fail Gate */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase text-blue-700 mb-2">
                <Gauge className="w-4 h-4" aria-hidden="true" />
                Mandatory Multimeter Check Before Moving On
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Where to Probe:</span>
                  <span className="font-mono text-slate-900 font-medium">
                    {currentStep.multimeterCheck.probePoints}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Pass Criteria:</span>
                  <span className="font-mono text-emerald-700 font-semibold">
                    {currentStep.multimeterCheck.expectedReading}
                  </span>
                </div>
              </div>
            </div>

            {/* Hostel Tip */}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-semibold block mb-0.5">Hostel Bench Shortcut</span>
                <span className="leading-relaxed text-amber-900">{currentStep.hostelTip}</span>
              </div>
            </div>
          </div>

          {/* Prev / Next Navigation */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              disabled={activeStep <= 1}
              onClick={() => setActiveStep((s) => Math.max(1, s - 1))}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-md cursor-pointer"
            >
              Previous Step
            </button>
            <button
              type="button"
              disabled={activeStep >= steps.length}
              onClick={() => setActiveStep((s) => Math.min(steps.length, s + 1))}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md cursor-pointer"
            >
              Next Step
            </button>
          </div>
        </div>
      </div>

      {/* Compact Hostel Troubleshooting Table */}
      <div className="mt-6 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-slate-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-900">
            Quick Hostel Troubleshooting Matrix (If Something Goes Wrong)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] font-mono uppercase text-slate-500">
                <th className="py-2.5 px-4">Symptom</th>
                <th className="py-2.5 px-4">Likely Cause</th>
                <th className="py-2.5 px-4">Multimeter / Bench Fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {HOSTEL_TROUBLESHOOTING.map((row) => (
                <tr key={row.symptom} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">{row.symptom}</td>
                  <td className="py-3 px-4 text-slate-600">{row.likelyCause}</td>
                  <td className="py-3 px-4 text-slate-700 font-mono">{row.hostelFix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

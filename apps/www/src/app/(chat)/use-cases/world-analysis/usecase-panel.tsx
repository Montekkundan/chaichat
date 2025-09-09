import React from "react"
import { cx } from "class-variance-authority"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

interface OrbProps {
  dimension?: string
  className?: string
  tones?: {
    base?: string
    accent1?: string
    accent2?: string
    accent3?: string
  }
  spinDuration?: number
}

const ColorOrb: React.FC<OrbProps> = ({
  dimension = "192px",
  className,
  tones,
  spinDuration = 20,
}) => {
  const fallbackTones = {
    base: "oklch(95% 0.02 264.695)",
    accent1: "oklch(75% 0.15 350)",
    accent2: "oklch(80% 0.12 200)",
    accent3: "oklch(78% 0.14 280)",
  }

  const palette = { ...fallbackTones, ...tones }

  const dimValue = Number.parseInt(dimension.replace("px", ""), 10)

  const blurStrength =
    dimValue < 50 ? Math.max(dimValue * 0.008, 1) : Math.max(dimValue * 0.015, 4)

  const contrastStrength =
    dimValue < 50 ? Math.max(dimValue * 0.004, 1.2) : Math.max(dimValue * 0.008, 1.5)

  const pixelDot = dimValue < 50 ? Math.max(dimValue * 0.004, 0.05) : Math.max(dimValue * 0.008, 0.1)

  const shadowRange = dimValue < 50 ? Math.max(dimValue * 0.004, 0.5) : Math.max(dimValue * 0.008, 2)

  const maskRadius =
    dimValue < 30 ? "0%" : dimValue < 50 ? "5%" : dimValue < 100 ? "15%" : "25%"

  const adjustedContrast =
    dimValue < 30 ? 1.1 : dimValue < 50 ? Math.max(contrastStrength * 1.2, 1.3) : contrastStrength

  return (
    <div
      className={cn("color-orb", className)}
      style={{
        width: dimension,
        height: dimension,
        "--base": palette.base,
        "--accent1": palette.accent1,
        "--accent2": palette.accent2,
        "--accent3": palette.accent3,
        "--spin-duration": `${spinDuration}s`,
        "--blur": `${blurStrength}px`,
        "--contrast": adjustedContrast,
        "--dot": `${pixelDot}px`,
        "--shadow": `${shadowRange}px`,
        "--mask": maskRadius,
      } as React.CSSProperties}
    >
      <style jsx>{`
        @property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
        .color-orb { display: grid; grid-template-areas: "stack"; overflow: hidden; border-radius: 50%; position: relative; transform: scale(1.1); }
        .color-orb::before, .color-orb::after { content: ""; display: block; grid-area: stack; width: 100%; height: 100%; border-radius: 50%; transform: translateZ(0); }
        .color-orb::before {
          background:
            conic-gradient(from calc(var(--angle) * 2) at 25% 70%, var(--accent3), transparent 20% 80%, var(--accent3)),
            conic-gradient(from calc(var(--angle) * 2) at 45% 75%, var(--accent2), transparent 30% 60%, var(--accent2)),
            conic-gradient(from calc(var(--angle) * -3) at 80% 20%, var(--accent1), transparent 40% 60%, var(--accent1)),
            conic-gradient(from calc(var(--angle) * 2) at 15% 5%, var(--accent2), transparent 10% 90%, var(--accent2)),
            conic-gradient(from calc(var(--angle) * 1) at 20% 80%, var(--accent1), transparent 10% 90%, var(--accent1)),
            conic-gradient(from calc(var(--angle) * -2) at 85% 10%, var(--accent3), transparent 20% 80%, var(--accent3));
          box-shadow: inset var(--base) 0 0 var(--shadow) calc(var(--shadow) * 0.2);
          filter: blur(var(--blur)) contrast(var(--contrast));
          animation: spin var(--spin-duration) linear infinite;
        }
        .color-orb::after { background-image: radial-gradient(circle at center, var(--base) var(--dot), transparent var(--dot)); background-size: calc(var(--dot) * 2) calc(var(--dot) * 2); backdrop-filter: blur(calc(var(--blur) * 2)) contrast(calc(var(--contrast) * 2)); mix-blend-mode: overlay; }
        .color-orb[style*="--mask: 0%"]::after { mask-image: none; }
        .color-orb:not([style*="--mask: 0%"] )::after { mask-image: radial-gradient(black var(--mask), transparent 75%); }
        @keyframes spin { to { --angle: 360deg; } }
        @media (prefers-reduced-motion: reduce) { .color-orb::before { animation: none; } }
      `}</style>
    </div>
  )
}

const SPEED_FACTOR = 1

interface ContextShape {
  showForm: boolean
  successFlag: boolean
  triggerOpen: () => void
  triggerClose: () => void
}

const FormContext = React.createContext({} as ContextShape)
const useFormContext = () => React.useContext(FormContext)

export function MorphPanel() {
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  const [showForm, setShowForm] = React.useState(false)
  const [successFlag, setSuccessFlag] = React.useState(false)

  const triggerClose = React.useCallback(() => {
    setShowForm(false)
  }, [])

  const triggerOpen = React.useCallback(() => {
    setShowForm(true)
  }, [])

  const handleSuccess = React.useCallback(() => {
    triggerClose()
    setSuccessFlag(true)
    setTimeout(() => setSuccessFlag(false), 1500)
  }, [triggerClose])

  React.useEffect(() => {
    function clickOutsideHandler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node) && showForm) {
        triggerClose()
      }
    }
    document.addEventListener("mousedown", clickOutsideHandler)
    return () => document.removeEventListener("mousedown", clickOutsideHandler)
  }, [showForm, triggerClose])

  const ctx = React.useMemo(() => ({ showForm, successFlag, triggerOpen, triggerClose }), [showForm, successFlag, triggerOpen, triggerClose])

  return (
    <div className="flex items-center justify-center">
      <motion.div
        ref={wrapperRef}
        data-panel
        className={cx("bg-background relative bottom-0 z-20 flex flex-col items-center overflow-hidden border rounded-xl shadow-md")}
        initial={false}
        animate={{ width: showForm ? FORM_WIDTH : "auto", height: showForm ? FORM_HEIGHT : 44, borderRadius: showForm ? 14 : 20 }}
        transition={{ type: "spring", stiffness: 550 / SPEED_FACTOR, damping: 45, mass: 0.7, delay: showForm ? 0 : 0.08 }}
      >
        <FormContext.Provider value={ctx}>
          <DockBar />
          <DocsPanel />
        </FormContext.Provider>
      </motion.div>
    </div>
  )
}

function DockBar() {
  const { showForm, triggerOpen } = useFormContext()
  return (
    <footer className="mt-auto flex h-[44px] items-center justify-center whitespace-nowrap select-none">
      <div className="flex items-center justify-center gap-2 px-3">
        <div className="flex w-fit items-center gap-2">
          <AnimatePresence mode="wait">
            {showForm ? (
              <motion.div key="blank" initial={{ opacity: 0 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} className="h-5 w-5" />
            ) : (
              <motion.div key="orb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <ColorOrb dimension="24px" tones={{ base: "oklch(22.64% 0 0)" }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button type="button" className="flex h-fit flex-1 justify-end rounded-full px-2 !py-0.5" variant="ghost" onClick={triggerOpen}>
          <span className="truncate">Use Case</span>
        </Button>
      </div>
    </footer>
  )
}

const FORM_WIDTH = 560
const FORM_HEIGHT = 360

function DocsPanel() {
  const { showForm } = useFormContext()
  return (
    <div className="absolute bottom-0 right-0" style={{ width: showForm ? FORM_WIDTH : 0, height: showForm ? FORM_HEIGHT : 0, pointerEvents: showForm ? "all" : "none" }}>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 550 / SPEED_FACTOR, damping: 45, mass: 0.7 }} className="flex h-full flex-col p-2">
            <div className="flex items-center gap-2 px-2 py-1">
              <ColorOrb dimension="24px" tones={{ base: "oklch(22.64% 0 0)" }} />
              <p className="text-foreground font-medium select-none">World Analysis – What can it do?</p>
            </div>
            <div className="px-4 pb-3 text-sm text-muted-foreground leading-6">
              <ul className="list-disc pl-5 space-y-2">
                <li>Show or mask countries/regions with borders or fills (overlayGeo)</li>
                <li>Focus the target region and keep north up, pause/resume spin (setCamera, setRotation)</li>
                <li>Adjust sun position, atmosphere colors, and overlay offset (setShaderParams)</li>
                <li>Plot data as points or 3D bars; include labels and legends (overlayPoints, overlayBars)</li>
                <li>Switch base map: day, night, paleo, or custom URL texture (setBaseMap)</li>
              </ul>
              <div className="mt-3 text-xs">
                Tip: Try “show India”, “highlight USA borders in red”, “earth map before continental drift”, or “plot population bars for top cities”.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const SPRING_LOGO = { type: "spring", stiffness: 350 / SPEED_FACTOR, damping: 35 } as const

function KeyHint({ children, className }: { children: string; className?: string }) { return (
  <kbd className={cx("text-foreground flex h-6 w-fit items-center justify-center rounded-sm border px-[6px] font-sans", className)}>{children}</kbd>
) }

export default MorphPanel

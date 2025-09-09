import React from "react"
import { cx } from "class-variance-authority"
import { AnimatePresence, motion } from "motion/react"


interface ContextShape {
  showForm: boolean
  triggerOpen: () => void
  triggerClose: () => void
}

const FormContext = React.createContext({} as ContextShape)
const useFormContext = () => React.useContext(FormContext)

export function MorphPanel() {
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  const [showForm, setShowForm] = React.useState(false)

  const triggerClose = React.useCallback(() => {
    setShowForm(false)
  }, [])

  const triggerOpen = React.useCallback(() => {
    setShowForm(true)
  }, [])

  React.useEffect(() => {
    function clickOutsideHandler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node) && showForm) {
        triggerClose()
      }
    }
    document.addEventListener("mousedown", clickOutsideHandler)
    return () => document.removeEventListener("mousedown", clickOutsideHandler)
  }, [showForm, triggerClose])

  const ctx = React.useMemo(() => ({ showForm, triggerOpen, triggerClose }), [showForm, triggerOpen, triggerClose])

  return (
    <div className="flex items-center justify-center">
      <motion.div
        ref={wrapperRef}
        data-panel
        className={cx("bg-background relative bottom-0 z-20 flex flex-col items-center overflow-hidden border rounded-xl shadow-md")}
        initial={false}
        animate={{ width: showForm ? FORM_WIDTH : "auto", height: showForm ? FORM_HEIGHT : 44, borderRadius: showForm ? 14 : 20 }}
        transition={{ type: "spring", stiffness: 550, damping: 45, mass: 0.7, delay: showForm ? 0 : 0.08 }}
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
    <button
      type="button"
      className="mt-auto flex h-[44px] items-center justify-center whitespace-nowrap select-none bg-transparent"
      onClick={triggerOpen}
      aria-label="Open Use Case"
    >
      <div className="flex items-center justify-center gap-2 px-3 cursor-pointer">
        <AnimatePresence mode="wait">
          {showForm ? (
            <motion.div key="blank" initial={{ opacity: 0 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} className="h-5 w-5" />
          ) : (
            <motion.div key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <span className="truncate">Use Case</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </button>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 550, damping: 45, mass: 0.7 }} className="flex h-full flex-col p-2">
            <div className="flex items-center gap-2 px-2 py-1">
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

export default MorphPanel

import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../lib/app-context";
import { ToastClose, ToastIcon } from "./ui";

export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 sm:bottom-6 sm:right-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="glass pointer-events-auto flex items-start gap-3 rounded-2xl p-4"
          >
            <span className="mt-0.5 shrink-0"><ToastIcon kind={t.kind} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold leading-snug text-text-primary">{t.title}</p>
              {t.description && <p className="mt-0.5 truncate text-[12.5px] text-text-secondary">{t.description}</p>}
            </div>
            <ToastClose onClick={() => dismissToast(t.id)} />
            <span className="absolute inset-x-4 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-border/60">
              <motion.span
                initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 4.2, ease: "linear" }}
                className="block h-full w-full origin-left rounded-full bg-primary/70"
              />
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

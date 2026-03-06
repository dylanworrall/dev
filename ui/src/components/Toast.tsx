"use client";

import { useToast } from "@/contexts/ToastContext";
import { AnimatePresence, motion } from "motion/react";
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from "lucide-react";

const icons = {
  success: CheckCircleIcon,
  error: AlertCircleIcon,
  info: InfoIcon,
};

const colors = {
  success: "text-accent-green",
  error: "text-accent-red",
  info: "text-accent",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-1 border border-border shadow-elevation-2 min-w-[280px] max-w-[400px]"
            >
              <Icon className={`size-4 flex-shrink-0 ${colors[toast.type]}`} />
              <span className="text-sm text-foreground flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <XIcon className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

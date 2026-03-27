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
  success: "text-[#30D158]",
  error: "text-[#FF453A]",
  info: "text-[#0A84FF]",
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
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#1C1C1E]/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl min-w-[280px] max-w-[400px]"
            >
              <Icon size={14} className={`flex-shrink-0 ${colors[toast.type]}`} />
              <span className="text-[13px] font-medium text-white/90 flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <XIcon size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

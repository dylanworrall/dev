"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastItem["type"]) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastItem["type"] = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => {
        const next = [...prev, { id, message, type }];
        return next.slice(-3); // max 3 visible
      });
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

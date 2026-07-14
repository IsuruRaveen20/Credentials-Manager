"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
};

type ToastInput = {
  title: string;
  description?: string;
  kind?: ToastKind;
  durationMs?: number;
};

type ToastContextValue = {
  push: (input: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = `toast-${Date.now()}-${toastSeq++}`;
      const kind = input.kind ?? "info";
      setItems((prev) => [...prev.slice(-4), { id, kind, title: input.title, description: input.description }]);
      const ms = input.durationMs ?? (kind === "error" ? 4500 : 2800);
      window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) => push({ title, description, kind: "success" }),
      error: (title, description) => push({ title, description, kind: "error" }),
      info: (title, description) => push({ title, description, kind: "info" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="vo-toast-stack" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div key={t.id} className={`vo-toast vo-toast--${t.kind}`} role="status">
            <div className="vo-toast-body">
              <div className="vo-toast-title">{t.title}</div>
              {t.description && <div className="vo-toast-desc">{t.description}</div>}
            </div>
            <button type="button" className="vo-toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

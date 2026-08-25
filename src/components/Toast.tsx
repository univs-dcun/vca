"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastVariant = "default" | "success" | "info" | "warning" | "error";

interface ToastOptions {
  variant?: ToastVariant;
  title: string;
  desc?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; title: string; desc: string }> = {
  default: { bg: "#f8fafc", border: "#e2e8f0", title: "#0e162a", desc: "#475469" },
  success: { bg: "#e1f3e7", border: "#aed7bc", title: "#16a34a", desc: "#16a34a" },
  info:    { bg: "#f0f8ff", border: "#d3e0fd", title: "#38bdf8", desc: "#38bdf8" },
  warning: { bg: "#fffbeb", border: "#fce1b3", title: "#ea580c", desc: "#ea580c" },
  error:   { bg: "#ffeaea", border: "#f43f5e", title: "#f43f5e", desc: "#f43f5e" },
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "default") return null;
  const color = VARIANT_STYLES[variant].title;
  const common = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (variant === "success") return (
    <svg {...common}>
      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" />
      <path d="M7.5 10L9.16667 11.6667L12.5 8.33333" />
    </svg>
  );
  if (variant === "info") return (
    <svg {...common}>
      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" />
      <path d="M10 13.3333V10M10 6.66667H10.0083" />
    </svg>
  );
  if (variant === "warning") return (
    <svg {...common}>
      <path d="M18.1083 15L11.4417 3.33333C11.2963 3.07684 11.0855 2.86349 10.8308 2.71506C10.576 2.56662 10.2865 2.48842 9.99167 2.48842C9.69684 2.48842 9.4073 2.56662 9.15256 2.71506C8.89783 2.86349 8.68703 3.07684 8.54167 3.33333L1.875 15C1.72807 15.2545 1.65102 15.5433 1.65167 15.8371C1.65232 16.1309 1.73065 16.4194 1.87871 16.6732C2.02676 16.927 2.23929 17.1372 2.49475 17.2824C2.7502 17.4276 3.03951 17.5026 3.33333 17.5H16.6667C16.9591 17.4997 17.2463 17.4225 17.4994 17.2761C17.7525 17.1297 17.9627 16.9192 18.1088 16.6659C18.2548 16.4126 18.3317 16.1253 18.3316 15.8329C18.3315 15.5405 18.2545 15.2532 18.1083 15Z" />
      <path d="M10 7.5V10.8333" />
      <path d="M10 14.1667H10.0083" />
    </svg>
  );
  return (
    <svg {...common}>
      <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" />
      <path d="M10 6.66667V10" />
      <path d="M10 13.3333H10.0083" />
    </svg>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12 4L4 12" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4L12 12" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const variant = item.variant ?? "default";
  const colors = VARIANT_STYLES[variant];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "12px 16px", borderRadius: "12px", height: "60px", boxSizing: "border-box",
      backgroundColor: colors.bg, border: `1px solid ${colors.border}`,
      boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
      width: "380px", flexShrink: 0,
    }}>
      {variant !== "default" && (
        <div style={{ flexShrink: 0, display: "flex" }}>
          <ToastIcon variant={variant} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
        <div style={{ fontSize: "14px", fontWeight: 800, lineHeight: "20px", letterSpacing: "-0.28px", color: colors.title }}>{item.title}</div>
        {item.desc && (
          <div style={{ fontSize: "12px", fontWeight: 400, lineHeight: "16px", letterSpacing: "-0.24px", color: colors.desc }}>{item.desc}</div>
        )}
      </div>
      {item.actionLabel ? (
        <button
          onClick={() => { item.onAction?.(); onDismiss(item.id); }}
          style={{
            padding: "6px 12px", fontSize: "13px", fontWeight: 600, letterSpacing: "-0.26px",
            color: "#ffffff", backgroundColor: "#0e162a",
            border: "none", borderRadius: "8px", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
          }}
        >
          {item.actionLabel}
        </button>
      ) : (
        <button
          onClick={() => onDismiss(item.id)}
          aria-label="Dismiss"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, display: "flex" }}
        >
          <CloseIcon color={colors.desc} />
        </button>
      )}
    </div>
  );
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((opts: ToastOptions) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { ...opts, id }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: "fixed", top: "76px", left: "50%", transform: "translateX(-50%)", zIndex: 10000,
        display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
      }}>
        {toasts.map(t => <Toast key={t.id} item={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

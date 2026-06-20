'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  exiting: boolean;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const COLORS: Record<ToastType, { border: string; bg: string; icon: string }> = {
  success: { border: '#22c55e', bg: '#f0fdf4', icon: '✓' },
  error:   { border: '#ef4444', bg: '#fef2f2', icon: '✕' },
  info:    { border: '#3b82f6', bg: '#eff6ff', icon: 'ℹ' },
};

const AUTO_DISMISS = 4000;
const EXIT_DURATION = 300;
const MAX_TOASTS = 5;

function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const c = COLORS[item.type];

  return (
    <div
      className="rounded-xl"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 16px',
        borderLeft: `4px solid ${c.border}`,
        background: c.bg,
        boxShadow: '0 4px 24px rgba(0,0,0,.1)',
        minWidth: 280,
        maxWidth: 420,
        animation: item.exiting
          ? `toast-slide-out ${EXIT_DURATION}ms ease-in forwards`
          : `toast-slide-in 300ms ease-out forwards`,
        pointerEvents: 'auto' as const,
        width: '100%',
      }}
    >
      <span style={{ color: c.border, fontWeight: 700, fontSize: 16, lineHeight: '20px', flexShrink: 0 }}>
        {c.icon}
      </span>
      <span style={{ flex: 1, fontSize: 14, lineHeight: '20px', color: '#1f2937', wordBreak: 'break-word' }}>
        {item.message}
      </span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#9ca3af',
          fontSize: 16,
          lineHeight: '20px',
          padding: 0,
          flexShrink: 0,
        }}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), EXIT_DURATION);
  }, []);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts(prev => {
      const next = [...prev, { id, type, message, exiting: false }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
    setTimeout(() => dismiss(id), AUTO_DISMISS);
  }, [dismiss]);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => add('success', m),
      error: (m) => add('error', m),
      info: (m) => add('info', m),
    }),
    [add]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes toast-slide-out {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(100%); }
        }
        @media (max-width: 639px) {
          .toast-container {
            left: 0 !important;
            right: 0 !important;
            padding: 0 8px 8px !important;
          }
          @keyframes toast-slide-in {
            from { opacity: 0; transform: translateY(100%); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes toast-slide-out {
            from { opacity: 1; transform: translateY(0); }
            to   { opacity: 0; transform: translateY(100%); }
          }
        }
      `}</style>
      <div
        className="toast-container"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map(t => (
          <Toast key={t.id} item={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

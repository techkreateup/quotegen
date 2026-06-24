"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

// In-app replacement for the browser-native window.confirm / window.prompt /
// window.alert dialogs (which look unbranded and "external"). Promise-based so
// callers can `await dialog.confirm(...)` / `await dialog.prompt(...)`.

interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}
interface PromptField { label?: string; placeholder?: string; type?: "text" | "number" | "url" | "select"; defaultValue?: string; options?: { value: string; label: string }[] }
interface PromptOpts extends ConfirmOpts { fields: PromptField[] }

interface DialogApi {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  prompt: (opts: PromptOpts) => Promise<string[] | null>;
  alert: (opts: Omit<ConfirmOpts, "cancelLabel">) => Promise<void>;
}

const DialogContext = createContext<DialogApi | null>(null);

type State =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "alert"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOpts; resolve: (v: string[] | null) => void }
  | null;

// Imperative bridge so non-component modules (and any file) can open dialogs
// without wiring the useDialog hook. The provider registers the live API here.
let _api: DialogApi | null = null;
export const confirmDialog = (opts: ConfirmOpts) => _api ? _api.confirm(opts) : Promise.resolve(window.confirm(opts.message || opts.title));
export const alertDialog = (opts: Omit<ConfirmOpts, "cancelLabel">) => _api ? _api.alert(opts) : Promise.resolve(void window.alert(opts.message || opts.title));
export const promptDialog = (opts: PromptOpts) => _api ? _api.prompt(opts) : Promise.resolve(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(null);
  const [vals, setVals] = useState<string[]>([]);

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ kind: "confirm", opts, resolve })), []);
  const alert = useCallback((opts: ConfirmOpts) => new Promise<void>((resolve) => setState({ kind: "alert", opts, resolve: () => resolve() })), []);
  const prompt = useCallback((opts: PromptOpts) => new Promise<string[] | null>((resolve) => {
    setVals(opts.fields.map((f) => f.defaultValue ?? ""));
    setState({ kind: "prompt", opts, resolve });
  }), []);

  useEffect(() => {
    _api = { confirm, prompt, alert };
    return () => { _api = null; };
  }, [confirm, prompt, alert]);

  function close(result: boolean | string[] | null) {
    if (!state) return;
    if (state.kind === "prompt") state.resolve(result as string[] | null);
    else state.resolve(result as boolean);
    setState(null);
  }

  const danger = state?.opts.tone === "danger";

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)" }}
          onClick={() => close(state.kind === "prompt" ? null : false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl"
            style={{ animation: "qg-dialog-pop 180ms cubic-bezier(0.4,0,0.2,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 22px 16px" }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{state.opts.title}</h3>
              {state.opts.message && <p style={{ fontSize: 13.5, color: "#475569", marginTop: 6, lineHeight: 1.55 }}>{state.opts.message}</p>}

              {state.kind === "prompt" && (
                <div className="mt-4 space-y-3">
                  {state.opts.fields.map((f, i) => (
                    <div key={i}>
                      {f.label && <label className="lbl">{f.label}</label>}
                      {f.type === "select" ? (
                        <select
                          autoFocus={i === 0}
                          className="inp"
                          value={vals[i] ?? ""}
                          onChange={(e) => setVals((v) => { const n = [...v]; n[i] = e.target.value; return n; })}
                        >
                          {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input
                          autoFocus={i === 0}
                          className="inp"
                          type={f.type === "number" ? "number" : "text"}
                          placeholder={f.placeholder}
                          value={vals[i] ?? ""}
                          onChange={(e) => setVals((v) => { const n = [...v]; n[i] = e.target.value; return n; })}
                          onKeyDown={(e) => { if (e.key === "Enter") close(vals); }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              {state.kind !== "alert" && (
                <button onClick={() => close(state.kind === "prompt" ? null : false)} className="px-4 h-10 rounded-lg border border-slate-200 text-slate-600 text-[13px] font-semibold hover:bg-slate-50">
                  {state.opts.cancelLabel ?? "Cancel"}
                </button>
              )}
              <button
                onClick={() => close(state.kind === "prompt" ? vals : true)}
                className="px-4 h-10 rounded-lg text-white text-[13px] font-semibold"
                style={{ background: danger ? "#dc2626" : "#4f46e5" }}
              >
                {state.opts.confirmLabel ?? (state.kind === "alert" ? "OK" : "Confirm")}
              </button>
            </div>
          </div>
          <style>{`@keyframes qg-dialog-pop{from{opacity:0;transform:scale(0.95) translateY(6px)}to{opacity:1;transform:none}}`}</style>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

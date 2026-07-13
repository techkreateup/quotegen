"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Real invoice preview.
 * Mirrors src/components/DocumentPreview.tsx exactly:
 *  - Arial font, white A4 sheet, theme color header (#7c3aed default)
 *  - Two themeBg boxes for Billed By / Billed To
 *  - Theme-coloured item table header with white text
 *  - Items with # / Item + HSN / GST Rate / Qty / Rate / Amount / CGST / SGST / Total
 *  - Totals column on the right, amount in words on the left
 *  - HSN summary table at the bottom (gray header, bordered)
 */

const THEME = "#7c3aed";
const THEME_BG = "#7c3aed12";
const THEME_BORDER = "#7c3aed22";

export default function HeroInvoice() {
  const wrap = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-1, 1], [-5, 5]), { stiffness: 120, damping: 20 });
  const rotateX = useSpring(useTransform(my, [-1, 1], [3, -3]),  { stiffness: 120, damping: 20 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
      my.set(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const onLeave = () => { mx.set(0); my.set(0); };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, [mx, my]);

  return (
    <div ref={wrap} className="relative w-full max-w-[640px] mx-auto" style={{ perspective: 1600 }}>
      {/* Ambient wash */}
      <div aria-hidden className="absolute -inset-8 -z-10 rounded-[48px]"
           style={{ background: "radial-gradient(60% 60% at 50% 50%, oklch(0.85 0.13 275 / 0.30), transparent 70%)", filter: "blur(4px)" }} />

      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative"
      >
        {/* A4-style sheet — Arial, 13px, white, matches DocumentPreview */}
        <div
          style={{
            background: "#fff",
            color: "#333",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "10.5px",   /* scaled from 13px so full sheet fits hero */
            padding: "22px",
            borderRadius: "10px",
            border: "1px solid var(--lp-line)",
            boxShadow: "0 60px 120px -40px oklch(0.2 0.02 240 / 0.35), 0 20px 40px -20px oklch(0.2 0.02 240 / 0.18)",
            transform: "rotate(-1.5deg)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
            <div>
              <h1 style={{ fontSize: "17px", fontWeight: "bold", color: THEME, margin: 0, marginBottom: "3px" }}>Tax Invoice</h1>
              <p style={{ fontSize: "10.5px", color: "#666", margin: 0 }}>Invoice No: <b style={{ color: "#333" }}>INV-00248</b></p>
              <p style={{ fontSize: "10.5px", color: "#666", margin: 0 }}>Invoice Date: 04 Jul 2026</p>
              <p style={{ fontSize: "10.5px", color: "#666", margin: 0 }}>Due Date: 19 Jul 2026</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "17px", fontWeight: "bold", color: THEME, margin: 0 }}>Kaveri Fabrication LLP</p>
            </div>
          </div>

          {/* From / To */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
            <div style={{ flex: 1, background: THEME_BG, padding: "10px", borderRadius: "6px", border: `1px solid ${THEME_BORDER}` }}>
              <h3 style={{ fontSize: "11px", fontWeight: "bold", color: THEME, marginBottom: "4px", margin: 0 }}>Billed By</h3>
              <p style={{ fontWeight: 600, marginTop: "3px", marginBottom: "1px", fontSize: "10.5px" }}>Kaveri Fabrication LLP</p>
              <p style={{ color: "#555", fontSize: "9.5px", margin: 0 }}>Peelamedu, Coimbatore</p>
              <p style={{ color: "#555", fontSize: "9.5px", margin: 0 }}>Tamil Nadu, India, 641004</p>
              <p style={{ color: "#555", fontSize: "9.5px", margin: 0 }}>GSTIN: 33AAECK9871B1Z2</p>
            </div>
            <div style={{ flex: 1, background: THEME_BG, padding: "10px", borderRadius: "6px", border: `1px solid ${THEME_BORDER}` }}>
              <h3 style={{ fontSize: "11px", fontWeight: "bold", color: THEME, marginBottom: "4px", margin: 0 }}>Billed To</h3>
              <p style={{ fontWeight: 600, marginTop: "3px", marginBottom: "1px", fontSize: "10.5px" }}>Sundaram Steel Works</p>
              <p style={{ color: "#555", fontSize: "9.5px", margin: 0 }}>Ambattur Industrial Estate</p>
              <p style={{ color: "#555", fontSize: "9.5px", margin: 0 }}>Chennai, Tamil Nadu, 600058</p>
              <p style={{ color: "#555", fontSize: "9.5px", margin: 0 }}>GSTIN: 33AABCS4123A1Z9</p>
            </div>
          </div>

          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
            <thead>
              <tr style={{ background: THEME, color: "white" }}>
                <th style={th()}>#</th>
                <th style={th()}>Item</th>
                <th style={{ ...th(), textAlign: "center" }}>GST</th>
                <th style={{ ...th(), textAlign: "center" }}>Qty</th>
                <th style={{ ...th(), textAlign: "right" }}>Rate</th>
                <th style={{ ...th(), textAlign: "right" }}>Amount</th>
                <th style={{ ...th(), textAlign: "right" }}>CGST</th>
                <th style={{ ...th(), textAlign: "right" }}>SGST</th>
                <th style={{ ...th(), textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                { i: 1, name: "MS Angle 50×50×5, cut to length", hsn: "72161000", gst: 18, qty: 42, rate: 260, amt: "10,920.00", c: "982.80", s: "982.80", tot: "12,885.60" },
                { i: 2, name: "Fabrication labour, on-site",     hsn: "998873",   gst: 18, qty: 1,  rate: 18500, amt: "18,500.00", c: "1,665.00", s: "1,665.00", tot: "21,830.00" },
                { i: 3, name: "Painting, red oxide primer",      hsn: "998518",   gst: 18, qty: 1,  rate: 3200, amt: "3,200.00", c: "288.00", s: "288.00", tot: "3,776.00" },
              ].map((r, i) => (
                <motion.tr key={r.i}
                           initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                           transition={{ duration: 0.4, delay: 0.35 + i * 0.12, ease: [0.23, 1, 0.32, 1] }}
                           style={{ borderBottom: "1px solid #eee" }}>
                  <td style={td()}>{r.i}.</td>
                  <td style={td()}>
                    <div style={{ fontSize: "10px", fontWeight: 500, color: "#222" }}>{r.name}</div>
                    <div style={{ fontSize: "8.5px", color: "#888" }}>HSN/SAC: {r.hsn}</div>
                  </td>
                  <td style={{ ...td(), textAlign: "center" }}>{r.gst}%</td>
                  <td style={{ ...td(), textAlign: "center" }}>{r.qty}</td>
                  <td style={{ ...td(), textAlign: "right" }}>₹{r.rate.toLocaleString("en-IN")}</td>
                  <td style={{ ...td(), textAlign: "right" }}>₹{r.amt}</td>
                  <td style={{ ...td(), textAlign: "right" }}>₹{r.c}</td>
                  <td style={{ ...td(), textAlign: "right" }}>₹{r.s}</td>
                  <td style={{ ...td(), textAlign: "right", fontWeight: 600 }}>₹{r.tot}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {/* Totals row */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <p style={{ fontSize: "9.5px", color: "#666", fontStyle: "italic", maxWidth: "55%", margin: 0 }}>
              Total (in words): <b>RUPEES THIRTY EIGHT THOUSAND FOUR HUNDRED NINETY ONE AND SIXTY PAISE ONLY</b>
            </p>
            <div style={{ width: "180px", fontSize: "10.5px" }}>
              <div style={row()}><span>Amount</span><span>₹32,620.00</span></div>
              <div style={row()}><span>CGST</span><span>₹2,935.80</span></div>
              <div style={row()}><span>SGST</span><span>₹2,935.80</span></div>
              <div style={{ ...row(), borderTop: "2px solid #333", marginTop: "4px", paddingTop: "5px", fontSize: "12px", fontWeight: "bold" }}>
                <span>Total (INR)</span><span>₹38,491.60</span>
              </div>
            </div>
          </div>

          {/* HSN summary */}
          <div>
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ ...th(), color: "#333", textAlign: "left" }}>HSN</th>
                  <th style={{ ...th(), color: "#333", textAlign: "left" }}>Taxable</th>
                  <th style={{ ...th(), color: "#333", textAlign: "center" }}>CGST Rate</th>
                  <th style={{ ...th(), color: "#333", textAlign: "right" }}>CGST Amt</th>
                  <th style={{ ...th(), color: "#333", textAlign: "center" }}>SGST Rate</th>
                  <th style={{ ...th(), color: "#333", textAlign: "right" }}>SGST Amt</th>
                  <th style={{ ...th(), color: "#333", textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["72161000", "10,920", "9%",   "982.80",  "9%", "982.80",  "12,885.60"],
                  ["998873",   "18,500", "9%", "1,665.00",  "9%", "1,665.00", "21,830.00"],
                  ["998518",    "3,200", "9%",  "288.00",   "9%",  "288.00",  "3,776.00"],
                ].map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} style={{ ...td(), border: "1px solid #ddd", textAlign: j <= 1 ? "left" : (j % 2 === 0 ? "right" : "center") }}>
                        {j >= 1 && j !== 2 && j !== 4 ? "₹" : ""}{c}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr style={{ background: "#f5f5f5", fontWeight: "bold" }}>
                  <td style={{ ...td(), border: "1px solid #ddd", fontWeight: 700 }}>Total</td>
                  <td style={{ ...td(), border: "1px solid #ddd", fontWeight: 700 }}>₹32,620</td>
                  <td style={{ ...td(), border: "1px solid #ddd" }} />
                  <td style={{ ...td(), border: "1px solid #ddd", textAlign: "right", fontWeight: 700 }}>₹2,935.80</td>
                  <td style={{ ...td(), border: "1px solid #ddd" }} />
                  <td style={{ ...td(), border: "1px solid #ddd", textAlign: "right", fontWeight: 700 }}>₹2,935.80</td>
                  <td style={{ ...td(), border: "1px solid #ddd", textAlign: "right", fontWeight: 700 }}>₹38,491.60</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Floating status chips */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 1.1, ease: [0.23, 1, 0.32, 1] }}
        className="absolute -left-4 top-24 rounded-xl px-3 py-2 flex items-center gap-2"
        style={{ background: "var(--lp-ink)", color: "white", boxShadow: "0 20px 40px -12px oklch(0.15 0.02 240 / 0.4)" }}
      >
        <span className="relative w-2.5 h-2.5">
          <span className="absolute inset-0 rounded-full" style={{ background: "oklch(0.75 0.15 275)" }} />
          <motion.span aria-hidden className="absolute inset-0 rounded-full"
            style={{ background: "oklch(0.75 0.15 275)" }}
            initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }} />
        </span>
        <span className="text-[11.5px]">SBI · Credited <span className="lp-num">₹38,491.60</span></span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 1.3, ease: [0.23, 1, 0.32, 1] }}
        className="absolute -right-2 top-6 rounded-xl px-3 py-2"
        style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)", boxShadow: "0 20px 40px -12px oklch(0.15 0.02 240 / 0.25)" }}
      >
        <div className="text-[9.5px] uppercase tracking-widest" style={{ color: "var(--lp-mute)" }}>GSTR-1 · June</div>
        <div className="lp-num text-[13px] font-semibold" style={{ color: "var(--lp-brand-ink)" }}>Ready to file</div>
      </motion.div>
    </div>
  );
}

const th = (): React.CSSProperties => ({ padding: "6px 8px", fontSize: "9.5px", fontWeight: 600, textAlign: "left" });
const td = (): React.CSSProperties => ({ padding: "6px 8px", fontSize: "9.5px", verticalAlign: "top" });
const row = (): React.CSSProperties => ({ display: "flex", justifyContent: "space-between", padding: "2px 0" });

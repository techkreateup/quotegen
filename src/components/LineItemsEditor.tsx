"use client";

import React, { useEffect, useState, useRef } from "react";
import { LineItem, CatalogItem } from "@/lib/types";
import { createEmptyLineItem, calculateLineItem } from "@/lib/store";
import { apiGet } from "@/lib/api";
import { Plus, Trash2, BookMarked, X } from "lucide-react";

interface Props {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  themeColor?: string;
  isInterState?: boolean;
  // Export under LUT: no GST computed regardless of item gstRate.
  zeroTax?: boolean;
}

export default function LineItemsEditor({ items, onChange, themeColor = "#1E3A5F", isInterState = false, zeroTax = false }: Props) {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const catalogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<CatalogItem[]>("/api/catalog?active=true").then(setCatalogItems).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (catalogRef.current && !catalogRef.current.contains(e.target as Node)) setShowCatalog(false);
    }
    if (showCatalog) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCatalog]);

  function addFromCatalog(cat: CatalogItem) {
    const newItem = calculateLineItem({
      ...createEmptyLineItem(),
      itemName: cat.name,
      description: cat.description,
      hsnSac: cat.hsnSac,
      gstRate: cat.gstRate,
      rate: cat.rate,
      quantity: 1,
    }, isInterState, zeroTax);
    onChange([...items, newItem]);
    setShowCatalog(false);
    setCatalogSearch("");
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    updated[index] = calculateLineItem(updated[index], isInterState, zeroTax);
    onChange(updated);
  }

  function addItem() { onChange([...items, createEmptyLineItem()]); }
  function removeItem(index: number) { if (items.length <= 1) return; onChange(items.filter((_, i) => i !== index)); }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-[13px]" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: themeColor }} className="text-white">
              <th className="px-3 py-2.5 text-left font-medium w-10">#</th>
              <th className="px-3 py-2.5 text-left font-medium" style={{ width: 220, minWidth: 200 }}>Item</th>
              <th className="px-3 py-2.5 text-left font-medium" style={{ width: 110, minWidth: 100 }}>HSN/SAC</th>
              <th className="px-3 py-2.5 text-center font-medium" style={{ width: 80, minWidth: 80 }}>GST %</th>
              <th className="px-3 py-2.5 text-center font-medium" style={{ width: 72, minWidth: 70 }}>Qty</th>
              <th className="px-3 py-2.5 text-right font-medium" style={{ width: 110, minWidth: 110 }}>Rate (&#8377;)</th>
              <th className="px-3 py-2.5 text-center font-medium" style={{ width: 130, minWidth: 130, maxWidth: 140 }}>Discount</th>
              <th className="px-3 py-2.5 text-right font-medium" style={{ width: 110, minWidth: 100 }}>Amount</th>
              {isInterState ? (
                <th className="px-3 py-2.5 text-right font-medium" style={{ width: 90, minWidth: 80 }}>IGST</th>
              ) : (
                <>
                  <th className="px-3 py-2.5 text-right font-medium" style={{ width: 90, minWidth: 80 }}>CGST</th>
                  <th className="px-3 py-2.5 text-right font-medium" style={{ width: 90, minWidth: 80 }}>SGST</th>
                </>
              )}
              <th className="px-3 py-2.5 text-right font-medium" style={{ width: 120, minWidth: 110 }}>Total</th>
              <th className="px-2 py-2.5" style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const colCount = isInterState ? 10 : 11;
              return (
              <React.Fragment key={item.id}>
              <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="px-3 pt-3 pb-1 text-slate-400 font-medium align-top">{i + 1}</td>
                <td className="px-3 pt-2 pb-1">
                  <input type="text" value={item.itemName} onChange={(e) => updateItem(i, "itemName", e.target.value)}
                    className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-[13px] focus:border-indigo-400 bg-white" placeholder="Item Name" />
                </td>
                <td className="px-3 pt-2 pb-1">
                  <input type="text" value={item.hsnSac} onChange={(e) => updateItem(i, "hsnSac", e.target.value)}
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[13px] focus:border-indigo-400 bg-white" />
                </td>
                <td className="px-3 pt-2 pb-1">
                  <select value={item.gstRate} onChange={(e) => updateItem(i, "gstRate", Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[13px] text-slate-900 focus:border-indigo-400 bg-white cursor-pointer">
                    <option value={0}>0%</option><option value={5}>5%</option><option value={12}>12%</option>
                    <option value={18}>18%</option><option value={28}>28%</option>
                  </select>
                </td>
                <td className="px-3 pt-2 pb-1">
                  <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[13px] text-center text-slate-900 focus:border-indigo-400 bg-white tabular-nums" />
                </td>
                <td className="px-3 pt-2 pb-1">
                  <input type="number" min={0} step={0.01} value={item.rate} onChange={(e) => updateItem(i, "rate", Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[13px] text-right focus:border-indigo-400 bg-white tabular-nums" />
                </td>
                <td className="px-2 pt-2 pb-1" style={{ maxWidth: 140 }}>
                  <div className="flex items-center gap-1 w-full">
                    <input type="number" min={0} step={0.01} value={item.discountValue}
                      onChange={(e) => updateItem(i, "discountValue", Number(e.target.value))}
                      className="min-w-0 border border-slate-200 rounded-md px-1.5 py-1.5 text-[13px] text-right focus:border-indigo-400 bg-white tabular-nums"
                      style={{ width: 64 }} />
                    <select value={item.discountType} onChange={(e) => updateItem(i, "discountType", e.target.value)}
                      className="border border-slate-200 rounded-md px-1 py-1.5 text-[11px] focus:border-indigo-400 bg-white cursor-pointer shrink-0"
                      style={{ width: 42 }}>
                      <option value="percent">%</option><option value="fixed">&#8377;</option>
                    </select>
                  </div>
                  {item.discountAmount > 0 && <p className="text-[10px] text-emerald-600 mt-0.5 tabular-nums">-&#8377;{item.discountAmount.toFixed(2)}</p>}
                </td>
                <td className="px-3 pt-2 pb-1 text-right font-medium text-slate-700 tabular-nums">&#8377;{item.amount.toFixed(2)}</td>
                {isInterState ? (
                  <td className="px-3 pt-2 pb-1 text-right text-slate-500 tabular-nums text-[12px]">&#8377;{item.igst.toFixed(2)}</td>
                ) : (
                  <>
                    <td className="px-3 pt-2 pb-1 text-right text-slate-500 tabular-nums text-[12px]">&#8377;{item.cgst.toFixed(2)}</td>
                    <td className="px-3 pt-2 pb-1 text-right text-slate-500 tabular-nums text-[12px]">&#8377;{item.sgst.toFixed(2)}</td>
                  </>
                )}
                <td className="px-3 pt-2 pb-1 text-right font-semibold text-slate-900 tabular-nums">&#8377;{item.total.toFixed(2)}</td>
                <td className="px-2 pt-2 pb-1 align-top">
                  <button type="button" onClick={() => removeItem(i)} disabled={items.length <= 1}
                    className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30 transition-colors cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
              {/* Description row — full width */}
              <tr className="border-b border-slate-100">
                <td className="px-3 pb-2 pt-0" />
                <td className="px-3 pb-2 pt-0" colSpan={colCount}>
                  <input type="text" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)}
                    className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-[12px] text-slate-500 focus:border-indigo-400 bg-white" placeholder="Description (optional)" />
                </td>
              </tr>
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3 relative">
        <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer">
          <Plus size={15} /> Add New Line
        </button>
        {catalogItems.length > 0 && (
          <div ref={catalogRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowCatalog(!showCatalog)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              <BookMarked size={14} /> Pick from Catalog
            </button>
            {showCatalog && (
              <div style={{
                position: "absolute", top: 30, left: 0, width: 320, maxHeight: 280,
                background: "#fff", border: "1.5px solid #D1D5E0", borderRadius: 12,
                boxShadow: "0 12px 40px rgba(15,23,42,0.14)", zIndex: 50, overflow: "hidden",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="text" placeholder="Search catalog..."
                    value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                    style={{ flex: 1, border: "1px solid #E5E7EB", borderRadius: 7, padding: "6px 10px", fontSize: 12, outline: "none" }}
                    autoFocus
                  />
                  <button onClick={() => { setShowCatalog(false); setCatalogSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 8, minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {catalogItems
                    .filter(c => !catalogSearch || c.name.toLowerCase().includes(catalogSearch.toLowerCase()) || c.description.toLowerCase().includes(catalogSearch.toLowerCase()))
                    .map(c => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => addFromCatalog(c)}
                        style={{
                          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "10px 12px", border: "none", borderBottom: "1px solid #F8FAFC",
                          background: "transparent", cursor: "pointer", textAlign: "left", transition: "background 120ms",
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F8FAFF"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1F2937" }}>{c.name}</div>
                          {c.description && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{c.description}</div>}
                          {c.hsnSac && <div style={{ fontSize: 10, color: "#C4C9D9" }}>HSN: {c.hsnSac}</div>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>₹{c.rate.toLocaleString("en-IN")}</div>
                          <div style={{ fontSize: 10, color: "#9CA3AF" }}>GST {c.gstRate}%</div>
                        </div>
                      </button>
                    ))}
                  {catalogItems.filter(c => !catalogSearch || c.name.toLowerCase().includes(catalogSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>No items found</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

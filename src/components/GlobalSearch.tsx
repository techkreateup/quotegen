"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Users, FileText, Receipt, UserCircle, Package, FolderKanban } from "lucide-react";
import { apiGet } from "@/lib/api";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status?: string;
}

const TYPE_ICONS: Record<string, { icon: typeof Users; color: string; bg: string }> = {
  Client:    { icon: Users,       color: "#4F46E5", bg: "#EEF2FF" },
  Quotation: { icon: FileText,    color: "#059669", bg: "#ECFDF5" },
  Invoice:   { icon: Receipt,     color: "#D97706", bg: "#FFFBEB" },
  Employee:  { icon: UserCircle,  color: "#7C3AED", bg: "#F5F3FF" },
  Vendor:    { icon: Package,     color: "#EA580C", bg: "#FFF7ED" },
  Project:   { icon: FolderKanban, color: "#0891B2", bg: "#ECFEFF" },
};

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await apiGet<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`);
      setResults(data.results);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, maxWidth: 420 }} className="hidden md:block">
      {/* Search Input */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "0 12px", height: 36, borderRadius: 10,
        border: `1.5px solid ${open ? "#C7D2FE" : "#E2E5EF"}`,
        background: open ? "#FAFBFF" : "#F8F9FC",
        transition: "all 200ms",
        boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.08)" : "none",
      }}>
        <Search size={14} style={{ color: "#9CA3AF", flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search clients, invoices, projects..."
          style={{
            flex: 1, border: "none", outline: "none", background: "transparent",
            fontSize: 13, color: "#374151", fontWeight: 500,
          }}
        />
        {query ? (
          <button
            onClick={() => { setQuery(""); setResults([]); }}
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "#9CA3AF" }}
          >
            <X size={14} />
          </button>
        ) : (
          <kbd style={{
            display: "inline-flex", alignItems: "center",
            padding: "1px 6px", borderRadius: 5,
            fontSize: 10, fontWeight: 600, fontFamily: "system-ui",
            background: "#E5E7EB", color: "#6B7280",
            border: "1px solid #D1D5DB",
          }}>
            {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "⌘" : "Ctrl+"}K
          </kbd>
        )}
      </div>

      {/* Results Dropdown */}
      {open && (query.length >= 2 || results.length > 0) && (
        <div style={{
          position: "absolute", top: 44, left: 0, right: 0,
          background: "#fff",
          border: "1.5px solid #D1D5E0",
          borderRadius: 14,
          boxShadow: "0 12px 40px rgba(15,23,42,0.14), 0 4px 12px rgba(15,23,42,0.08)",
          zIndex: 100,
          maxHeight: 420, overflowY: "auto",
        }}>
          {loading ? (
            <div style={{ padding: "20px", textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>
              Searching...
            </div>
          ) : results.length === 0 && query.length >= 2 ? (
            <div style={{ padding: "24px 20px", textAlign: "center" }}>
              <Search size={24} style={{ color: "#D1D5DB", margin: "0 auto 8px" }} />
              <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>No results for &quot;{query}&quot;</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Try a different search term</div>
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => {
              const cfg = TYPE_ICONS[type] || TYPE_ICONS.Client;
              return (
                <div key={type}>
                  <div style={{
                    padding: "8px 16px",
                    fontSize: 11, fontWeight: 700, color: "#9CA3AF",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    background: "#FAFBFD",
                    borderBottom: "1px solid #F1F3F5",
                  }}>
                    {type}s
                  </div>
                  {items.map((r) => {
                    const Icon = cfg.icon;
                    return (
                      <Link
                        key={r.id}
                        href={r.href}
                        onClick={() => { setOpen(false); setQuery(""); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 16px",
                          textDecoration: "none",
                          borderBottom: "1px solid #F5F6FA",
                          transition: "background 120ms",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F9FAFF"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: cfg.bg, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Icon size={14} color={cfg.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{r.title}</div>
                          {r.subtitle && (
                            <div style={{ fontSize: 11.5, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.subtitle}
                            </div>
                          )}
                        </div>
                        {r.status && <StatusBadge status={r.status} />}
                      </Link>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

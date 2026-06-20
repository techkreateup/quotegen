"use client";

import { useEffect, useState } from "react";
import { CatalogItem } from "@/lib/types";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, Search, Edit2, Trash2, X, Package } from "lucide-react";
import ModalPortal from "@/components/ModalPortal";
import PermissionGate from "@/components/PermissionGate";
import { useToast } from "@/components/Toast";

export default function CatalogPage() {
  const toast = useToast();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hsnSac, setHsnSac] = useState("");
  const [gstRate, setGstRate] = useState(18);
  const [rate, setRate] = useState(0);
  const [unit, setUnit] = useState("Nos");
  const [isActive, setIsActive] = useState(true);

  async function loadItems() {
    const data = await apiGet<CatalogItem[]>("/api/catalog");
    setItems(data);
  }

  useEffect(() => { loadItems(); }, []);

  function resetForm() {
    setName(""); setDescription(""); setHsnSac(""); setGstRate(18);
    setRate(0); setUnit("Nos"); setIsActive(true); setEditItem(null);
  }

  function openAdd() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(item: CatalogItem) {
    setEditItem(item);
    setName(item.name); setDescription(item.description); setHsnSac(item.hsnSac);
    setGstRate(item.gstRate); setRate(item.rate); setUnit(item.unit); setIsActive(item.isActive);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { name, description, hsnSac, gstRate, rate, unit, isActive };
    try {
      if (editItem) {
        await apiPut(`/api/catalog/${editItem.id}`, data);
      } else {
        await apiPost("/api/catalog", data);
      }
      toast.success(editItem ? "Item updated" : "Item added");
      setShowModal(false);
      resetForm();
      loadItems();
    } catch { toast.error("Failed to save catalog item"); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this catalog item?")) return;
    try { await apiDelete(`/api/catalog/${id}`); toast.success("Item deleted"); }
    catch { toast.error("Failed to delete catalog item"); }
    loadItems();
  }

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.hsnSac.toLowerCase().includes(q);
  });

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Product / Service Catalog"
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Catalog" }]}
        action={
          <PermissionGate module="catalog" action="create">
            <button onClick={openAdd} className="btn btn-primary btn-sm">
              <Plus size={14} /> Add Item
            </button>
          </PermissionGate>
        }
      />

      <div className="card overflow-hidden w-full">
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <div className="search-box flex-1">
            <Search size={14} className="search-ico" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              className="search-inp" placeholder="Search catalog..."
            />
          </div>
          <span className="text-[12px] text-slate-400">{filtered.length} items</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Package size={22} /></div>
            <p className="text-[13px] text-slate-500 font-medium">No catalog items found</p>
            <p className="text-[12px] text-slate-400 mt-1">Add products or services to quickly fill line items</p>
            <PermissionGate module="catalog" action="create">
              <button onClick={openAdd} className="btn btn-primary btn-sm mt-4">
                <Plus size={14} /> Add First Item
              </button>
            </PermissionGate>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl tbl-cards">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="mob-hide tab-hide">HSN/SAC</th>
                  <th className="mob-hide">GST %</th>
                  <th className="right">Rate (₹)</th>
                  <th className="mob-hide tab-hide">Unit</th>
                  <th>Status</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td className="mob-primary">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      {item.description && <p className="text-[11.5px] text-slate-400 mt-0.5">{item.description}</p>}
                    </td>
                    <td className="mob-hide tab-hide font-mono text-[12px]">{item.hsnSac || "—"}</td>
                    <td className="mob-hide">{item.gstRate}%</td>
                    <td className="text-right nums" data-label="Rate">₹{item.rate.toFixed(2)}</td>
                    <td className="mob-hide tab-hide">{item.unit}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="mob-actions">
                      <div className="flex items-center justify-end gap-1">
                        <PermissionGate module="catalog" action="edit"><button onClick={() => openEdit(item)} className="act"><Edit2 size={14} /></button></PermissionGate>
                        <PermissionGate module="catalog" action="delete"><button onClick={() => handleDelete(item.id)} className="act del"><Trash2 size={14} /></button></PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <ModalPortal>
        <div className="modal-bg" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-[15px] font-bold text-slate-900">
                {editItem ? "Edit Catalog Item" : "Add Catalog Item"}
              </h2>
              <button onClick={() => setShowModal(false)} className="act"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="lbl">Name *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="inp" placeholder="Product or service name" />
              </div>
              <div>
                <label className="lbl">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="inp" rows={2} placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="lbl">HSN/SAC</label>
                  <input type="text" value={hsnSac} onChange={(e) => setHsnSac(e.target.value)} className="inp" />
                </div>
                <div>
                  <label className="lbl">GST Rate (%)</label>
                  <select value={gstRate} onChange={(e) => setGstRate(Number(e.target.value))} className="inp">
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div>
                  <label className="lbl">Rate (₹)</label>
                  <input type="number" min={0} step={0.01} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="inp" />
                </div>
                <div>
                  <label className="lbl">Unit</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="inp">
                    <option value="Nos">Nos</option>
                    <option value="Hrs">Hrs</option>
                    <option value="Days">Days</option>
                    <option value="Months">Months</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Kg">Kg</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Sqft">Sqft</option>
                    <option value="Set">Set</option>
                    <option value="Box">Box</option>
                  </select>
                </div>
              </div>
              {editItem && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-indigo-600" />
                  <label htmlFor="isActive" className="text-[13px] text-slate-600">Active</label>
                </div>
              )}
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" className="btn btn-primary">
                  {editItem ? "Update" : "Add Item"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

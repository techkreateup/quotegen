"use client";

import { useEffect, useState } from "react";
import { Project, Client } from "@/lib/types";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import {
  Plus, FolderKanban, Clock, CheckCircle2, AlertTriangle, X, Calendar, Tag, Search, Trash2,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import ModalPortal from "@/components/ModalPortal";
import PermissionGate from "@/components/PermissionGate";
import { confirmDialog, alertDialog } from "@/components/Dialog";

type ProjectRow = Project & { taskCount: number; doneCount: number };

const STATUSES = ["All", "Pending", "InProgress", "Completed", "OnHold", "Cancelled"] as const;
const STATUS_LABELS: Record<string, string> = {
  All: "All", Pending: "Pending", InProgress: "In Progress",
  Completed: "Completed", OnHold: "On Hold", Cancelled: "Cancelled",
};
const PRIORITIES: Project["priority"][] = ["Low", "Medium", "High", "Urgent"];
const TYPES: Project["type"][] = ["ClientWork", "Internal", "Other"];

const priorityColor: Record<string, string> = {
  Low: "#22C55E", Medium: "#F59E0B", High: "#F97316", Urgent: "#EF4444",
};

const empty: Omit<Project, "id" | "createdAt" | "updatedAt"> = {
  title: "", description: "", clientId: null, type: "ClientWork",
  priority: "Medium", deadline: null, status: "Pending",
  tags: [], notes: "", completedAt: null,
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(empty);
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  const toast = useToast();
  const load = () => apiGet<ProjectRow[]>("/api/projects").then(setProjects).catch(() => {});
  useEffect(() => { load(); apiGet<Client[] | { data: Client[] }>("/api/clients").then(c => setClients(Array.isArray(c) ? c : c.data)).catch(() => {}); }, []);

  const filtered = projects
    .filter((p) => filter === "All" || p.status === filter)
    .filter((p) => priorityFilter === "All" || p.priority === priorityFilter)
    .filter((p) => typeFilter === "All" || p.type === typeFilter)
    .filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
      switch (sort) {
        case "deadline": return (a.deadline || "9999") < (b.deadline || "9999") ? -1 : 1;
        case "priority": return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
        case "title": return a.title.localeCompare(b.title);
        default: return 0; // newest — server default
      }
    });

  const now = new Date();
  const total = projects.length;
  const inProgress = projects.filter((p) => p.status === "InProgress").length;
  const completed = projects.filter((p) => p.status === "Completed").length;
  const overdue = projects.filter(
    (p) => p.deadline && new Date(p.deadline) < now && p.status !== "Completed" && p.status !== "Cancelled"
  ).length;

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        deadline: form.deadline || null,
        clientId: form.clientId || null,
      };
      await apiPost("/api/projects", payload);
      setShowNew(false);
      setForm(empty);
      setTagsInput("");
      toast.success("Project created");
      load();
    } catch { toast.error("Failed to create project"); }
    setSaving(false);
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!(await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this project and all its tasks? Associated transactions will also be removed." }))) return;
    try {
      await apiDelete(`/api/projects/${id}`);
      toast.success("Project deleted");
      load();
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const pct = (done: number, total: number) => (total === 0 ? 0 : Math.round((done / total) * 100));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Projects"
        breadcrumbs={[{ label: "Workspace" }, { label: "Projects" }]}
        action={
          <PermissionGate module="projects" action="create"><button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={14} /> New Project
          </button></PermissionGate>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: "Total Projects", value: total, icon: FolderKanban, color: "#6366F1" },
          { label: "In Progress", value: inProgress, icon: Clock, color: "#3B82F6" },
          { label: "Completed", value: completed, icon: CheckCircle2, color: "#22C55E" },
          { label: "Overdue", value: overdue, icon: AlertTriangle, color: "#EF4444" },
        ].map((s) => (
          <div key={s.label} className="card px-3 py-2.5 sm:px-4 sm:py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 uppercase tracking-wider">{s.label}</p>
                <p className="text-[18px] sm:text-[22px] font-bold text-slate-900 mt-0.5 sm:mt-1 leading-none">{s.value}</p>
              </div>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center" style={{ background: s.color + "14" }}>
                <s.icon size={16} className="sm:!w-[18px] sm:!h-[18px]" style={{ color: s.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="pill"
            style={{
              background: filter === s ? "#6366F1" : "#F1F5F9",
              color: filter === s ? "#fff" : "#64748B",
              fontWeight: filter === s ? 700 : 500,
            }}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 flex-wrap" style={{ background: "#FAFBFD", borderBottom: "1px solid #EAECF0" }}>
          <div className="search-box flex-1 sm:flex-none">
            <Search size={13} className="search-ico" />
            <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 sm:flex gap-2">
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="text-[11px] sm:text-[12px] border border-slate-200 rounded-md px-1.5 sm:px-2 py-1.5 bg-white text-slate-600 outline-none">
              <option value="All">All Priorities</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-[11px] sm:text-[12px] border border-slate-200 rounded-md px-1.5 sm:px-2 py-1.5 bg-white text-slate-600 outline-none">
              <option value="All">All Types</option>
              {TYPES.map((t) => <option key={t} value={t}>{t === "ClientWork" ? "Client Work" : t}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="text-[11px] sm:text-[12px] border border-slate-200 rounded-md px-1.5 sm:px-2 py-1.5 bg-white text-slate-600 outline-none">
              <option value="newest">Newest</option>
              <option value="deadline">Deadline</option>
              <option value="priority">Priority</option>
              <option value="title">Title A→Z</option>
            </select>
          </div>
          <span className="text-[12px] text-slate-400 sm:ml-auto">{filtered.length} of {projects.length} projects</span>
        </div>
      </div>

      {/* Project Cards Grid */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><FolderKanban size={36} color="#D1D5DB" /></div>
            <h3 className="text-[15px] font-semibold text-slate-700 mt-3">No projects yet</h3>
            <p className="text-[13px] text-slate-400 mt-1">Create projects to organize your work and track progress with tasks.</p>
            <button onClick={() => setShowNew(true)} className="btn btn-primary mt-4">
              <Plus size={14} /> New Project
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Link key={p.id} href={`/projects/view?id=${p.id}`} className="card px-4 py-4 hover:shadow-md transition-shadow cursor-pointer block group" style={{ textDecoration: "none" }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-[14px] font-bold text-slate-900 leading-snug line-clamp-1 flex-1">{p.title}</h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: priorityColor[p.priority] + "18",
                      color: priorityColor[p.priority],
                    }}
                  >
                    {p.priority}
                  </span>
                  <PermissionGate module="projects" action="delete"><button onClick={(e) => handleDeleteProject(e, p.id)} className="max-sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity act del" title="Delete project" aria-label="Delete project">
                    <Trash2 size={13} />
                  </button></PermissionGate>
                </div>
              </div>

              {p.clientName && (
                <p className="text-[12px] text-slate-400 mb-2">{p.clientName}</p>
              )}

              <div className="flex items-center gap-3 mb-3">
                <StatusBadge status={p.status} />
                {p.deadline && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Calendar size={11} />
                    {new Date(p.deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-400">Progress</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {p.doneCount}/{p.taskCount} tasks
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct(p.doneCount, p.taskCount)}%`,
                      background: pct(p.doneCount, p.taskCount) === 100 ? "#22C55E" : "#6366F1",
                    }}
                  />
                </div>
              </div>

              {/* Tags */}
              {p.tags && p.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-2">
                  <Tag size={10} className="text-slate-300" />
                  {p.tags.map((t, i) => (
                    <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {showNew && (
        <ModalPortal>
        <div className="modal-bg" onClick={() => setShowNew(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">New Project</h2>
                <p className="text-[12px] text-slate-400 mt-0.5">Create a new project to track</p>
              </div>
              <button onClick={() => setShowNew(false)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
            </div>

            <div className="px-5 sm:px-7 py-5 space-y-3">
              <div>
                <label className="lbl">Title *</label>
                <input className="inp" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Project title" />
              </div>

              <div>
                <label className="lbl">Description</label>
                <textarea className="inp" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Client</label>
                  <select className="inp" value={form.clientId || ""} onChange={(e) => setForm({ ...form, clientId: e.target.value || null })}>
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.businessName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Type</label>
                  <select className="inp" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Project["type"] })}>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t === "ClientWork" ? "Client Work" : t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Priority</label>
                  <select className="inp" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Project["priority"] })}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Deadline</label>
                  <input type="date" className="inp" value={form.deadline ? String(form.deadline).slice(0, 10) : ""} onChange={(e) => setForm({ ...form, deadline: e.target.value || null })} />
                </div>
              </div>

              <div>
                <label className="lbl">Tags (comma-separated)</label>
                <input className="inp" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="design, frontend, urgent" />
              </div>

              <div>
                <label className="lbl">Notes</label>
                <textarea className="inp" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes..." />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button className="btn btn-outline" onClick={() => setShowNew(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={!form.title.trim() || saving} onClick={save}>
                  {saving ? <><div className="spinner spinner-sm"/> Creating…</> : "Create Project"}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

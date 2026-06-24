"use client";

import { Suspense } from "react";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Project, ProjectTask } from "@/lib/types";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import {
  Plus, Trash2, Calendar, Edit2, X, Check,
  ClipboardList, ArrowRight, CheckCircle2,
} from "lucide-react";
import ActivityTimeline from "@/components/ActivityTimeline";
import EntityNotes from "@/components/EntityNotes";
import EntityDocuments from "@/components/EntityDocuments";
import ModalPortal from "@/components/ModalPortal";
import { confirmDialog, alertDialog } from "@/components/Dialog";

const PRIORITIES: ProjectTask["priority"][] = ["Low", "Medium", "High", "Urgent"];
const PROJECT_STATUSES: Project["status"][] = ["Pending", "InProgress", "Completed", "OnHold", "Cancelled"];
const TASK_STATUSES: ProjectTask["status"][] = ["Todo", "InProgress", "Done"];
const STATUS_LABELS: Record<string, string> = {
  Pending: "Pending", InProgress: "In Progress", Completed: "Completed",
  OnHold: "On Hold", Cancelled: "Cancelled", Todo: "To Do", Done: "Done",
};

const priorityDot: Record<string, string> = {
  Low: "#22C55E", Medium: "#F59E0B", High: "#F97316", Urgent: "#EF4444",
};

const columnConfig = [
  { key: "Todo" as const, label: "To Do", icon: ClipboardList, color: "#64748B", bg: "#F8FAFC" },
  { key: "InProgress" as const, label: "In Progress", icon: ArrowRight, color: "#3B82F6", bg: "#EFF6FF" },
  { key: "Done" as const, label: "Done", icon: CheckCircle2, color: "#22C55E", bg: "#F0FDF4" },
];

function ProjectViewInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";

  const [project, setProject] = useState<(Project & { tasks: ProjectTask[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProjectTask>>({});

  // New task form
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<ProjectTask["priority"]>("Medium");
  const [newDue, setNewDue] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Project edit
  const [editingProject, setEditingProject] = useState(false);
  const [projForm, setProjForm] = useState<Partial<Project>>({});

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiGet<Project & { tasks: ProjectTask[] }>(`/api/projects/${id}`)
      .then((p) => setProject(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);


  if (loading) {
    return (
      <div className="w-full">
        <div className="card px-6 py-12 text-center">
          <p className="text-[13px] text-slate-400">Loading project...</p>
        </div>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="w-full">
        <div className="card px-6 py-12 text-center">
          <p className="text-[13px] text-slate-400">Project not found.</p>
        </div>
      </div>
    );
  }

  const tasks = project.tasks || [];
  const doneCount = tasks.filter((t) => t.status === "Done").length;
  const totalCount = tasks.length;
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    setAddingTask(true);
    try {
      await apiPost(`/api/projects/${id}/tasks`, {
        title: newTitle.trim(),
        priority: newPriority,
        dueDate: newDue || null,
      });
      setNewTitle("");
      setNewPriority("Medium");
      setNewDue("");
      load();
    } catch { /* handled */ }
    setAddingTask(false);
  };

  const updateTask = async (taskId: string, data: Partial<ProjectTask>) => {
    try {
      await apiPut(`/api/projects/${id}/tasks/${taskId}`, data);
      load();
    } catch { /* handled */ }
  };

  const deleteTask = async (taskId: string) => {
    if (!(await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this task?" }))) return;
    try {
      await apiDelete(`/api/projects/${id}/tasks/${taskId}`);
      load();
    } catch { /* handled */ }
  };

  const startEditTask = (task: ProjectTask) => {
    setEditingTask(task.id);
    setEditForm({ title: task.title, priority: task.priority, status: task.status, dueDate: task.dueDate });
  };

  const saveEditTask = async () => {
    if (!editingTask) return;
    await updateTask(editingTask, editForm);
    setEditingTask(null);
    setEditForm({});
  };

  const changeTaskStatus = async (taskId: string, status: ProjectTask["status"]) => {
    await updateTask(taskId, { status });
  };

  const updateProject = async () => {
    try {
      await apiPut(`/api/projects/${id}`, projForm);
      setEditingProject(false);
      load();
    } catch { /* handled */ }
  };

  const openEditProject = () => {
    setProjForm({
      title: project.title,
      description: project.description,
      status: project.status,
      priority: project.priority,
      deadline: project.deadline,
      notes: project.notes,
    });
    setEditingProject(true);
  };


  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={project.title}
        breadcrumbs={[
          { label: "Workspace" },
          { label: "Projects", href: "/projects" },
          { label: project.title },
        ]}
        action={
          <button className="btn btn-outline btn-sm" onClick={openEditProject}>
            <Edit2 size={13} /> Edit Project
          </button>
        }
      />

      {/* Project Info Header */}
      <div className="card px-4 sm:px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
          <StatusBadge status={project.status} />
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: priorityDot[project.priority] + "18",
              color: priorityDot[project.priority],
            }}
          >
            {project.priority}
          </span>
          {project.clientName && (
            <span className="text-[12px] text-slate-400">Client: <span className="font-medium text-slate-600">{project.clientName}</span></span>
          )}
          {project.deadline && (
            <span className="flex items-center gap-1 text-[12px] text-slate-400">
              <Calendar size={11} />
              {new Date(project.deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
        {project.description && (
          <p className="text-[13px] text-slate-500 mb-3">{project.description}</p>
        )}

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400">Overall Progress</span>
            <span className="text-[12px] font-semibold text-slate-600">{pct}% ({doneCount}/{totalCount})</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? "#22C55E" : "#6366F1",
              }}
            />
          </div>
        </div>
      </div>

      {/* Add Task Form */}
      <div className="card px-4 py-3">
        <p className="text-[12px] font-semibold text-slate-500 mb-2">Add Task</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
          <div className="flex-1">
            <input
              className="inp"
              placeholder="Task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
            />
          </div>
          <div className="flex items-end gap-2">
            <select className="inp" style={{ width: "auto", minWidth: 90 }} value={newPriority} onChange={(e) => setNewPriority(e.target.value as ProjectTask["priority"])}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" className="inp" style={{ width: "auto" }} value={newDue} onChange={(e) => setNewDue(e.target.value)} />
            <button className="btn btn-primary btn-sm" disabled={!newTitle.trim() || addingTask} onClick={addTask}>
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      </div>

      {/* Task Board - 3 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columnConfig.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="rounded-xl border border-slate-200 overflow-hidden" style={{ background: col.bg, minHeight: 180 }}>
              {/* Column Header */}
              <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.7)" }}>
                <col.icon size={14} style={{ color: col.color }} />
                <span className="text-[13px] font-bold text-slate-700">{col.label}</span>
                <span className="text-[11px] font-medium text-slate-400 ml-auto bg-white px-1.5 py-0.5 rounded-md">{colTasks.length}</span>
              </div>

              {/* Tasks */}
              <div className="p-3 space-y-2.5">
                {colTasks.length === 0 && (
                  <p className="text-[11px] text-slate-300 text-center py-6">No tasks</p>
                )}
                {colTasks.map((task) => (
                  <div key={task.id} className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow transition-shadow overflow-hidden">
                    {editingTask === task.id ? (
                      /* Inline Edit */
                      <div className="p-3 space-y-2">
                        <input
                          className="inp"
                          value={editForm.title || ""}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          autoFocus
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select className="inp" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ProjectTask["status"] })}>
                            {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                          </select>
                          <select className="inp" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as ProjectTask["priority"] })}>
                            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <input
                          type="date"
                          className="inp"
                          value={editForm.dueDate ? String(editForm.dueDate).slice(0, 10) : ""}
                          onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value || null })}
                        />
                        <div className="flex items-center gap-2 justify-end pt-1">
                          <button className="btn btn-outline btn-sm" onClick={() => { setEditingTask(null); setEditForm({}); }}>Cancel</button>
                          <button className="btn btn-primary btn-sm" onClick={saveEditTask}><Check size={13} /> Save</button>
                        </div>
                      </div>
                    ) : (
                      /* Task Card Display */
                      <div className="p-3">
                        {/* Title Row */}
                        <div className="flex items-start gap-2 mb-2">
                          <span className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ background: priorityDot[task.priority] }} title={task.priority} />
                          <span className="text-[13px] font-medium text-slate-800 leading-snug flex-1">{task.title}</span>
                        </div>

                        {/* Due date */}
                        {task.dueDate && (
                          <div className="flex items-center gap-1 mb-2.5 ml-4">
                            <Calendar size={10} className="text-slate-400" />
                            <span className="text-[10.5px] text-slate-400">
                              {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                            </span>
                          </div>
                        )}

                        {/* Status Move Buttons — always visible, tap-friendly */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                          {TASK_STATUSES.filter((s) => s !== task.status).map((s) => {
                            const cfg = columnConfig.find((c) => c.key === s)!;
                            return (
                              <button
                                key={s}
                                onClick={() => changeTaskStatus(task.id, s)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                                style={{
                                  background: cfg.color + "10",
                                  color: cfg.color,
                                  border: `1px solid ${cfg.color}25`,
                                }}
                              >
                                <cfg.icon size={11} />
                                {STATUS_LABELS[s]}
                              </button>
                            );
                          })}

                          <div className="flex items-center gap-0.5 ml-auto">
                            <button className="p-1.5 rounded-md text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer" title="Edit" onClick={() => startEditTask(task)}>
                              <Edit2 size={13} />
                            </button>
                            <button className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer" title="Delete" onClick={() => deleteTask(task.id)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity Timeline */}
      <ActivityTimeline entityType="Project" entityId={id} />

      {/* Linked documents */}
      <EntityDocuments entity="project" id={id} />

      {/* Notes */}
      <EntityNotes entityType="Project" entityId={id} />

      {/* Edit Project Modal */}
      {editingProject && (
        <ModalPortal>
        <div className="modal-bg" onClick={() => setEditingProject(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Edit Project</h2>
                <p className="text-[12px] text-slate-400 mt-0.5">Update project details</p>
              </div>
              <button onClick={() => setEditingProject(false)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
            </div>
            <div className="px-5 sm:px-7 py-5 space-y-3">
              <div>
                <label className="lbl">Title</label>
                <input className="inp" value={projForm.title || ""} onChange={(e) => setProjForm({ ...projForm, title: e.target.value })} />
              </div>
              <div>
                <label className="lbl">Description</label>
                <textarea className="inp" rows={2} value={projForm.description || ""} onChange={(e) => setProjForm({ ...projForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Status</label>
                  <select className="inp" value={projForm.status} onChange={(e) => setProjForm({ ...projForm, status: e.target.value as Project["status"] })}>
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Priority</label>
                  <select className="inp" value={projForm.priority} onChange={(e) => setProjForm({ ...projForm, priority: e.target.value as Project["priority"] })}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="lbl">Deadline</label>
                <input type="date" className="inp" value={projForm.deadline ? String(projForm.deadline).slice(0, 10) : ""} onChange={(e) => setProjForm({ ...projForm, deadline: e.target.value || null })} />
              </div>
              <div>
                <label className="lbl">Notes</label>
                <textarea className="inp" rows={2} value={projForm.notes || ""} onChange={(e) => setProjForm({ ...projForm, notes: e.target.value })} />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button className="btn btn-outline" onClick={() => setEditingProject(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={updateProject}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default function ProjectViewPage() {
  return (
    <Suspense fallback={<div className="w-full"><div className="card px-6 py-12 text-center"><p className="text-[13px] text-slate-400">Loading...</p></div></div>}>
      <ProjectViewInner />
    </Suspense>
  );
}

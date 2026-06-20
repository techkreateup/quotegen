"use client";

import { useEffect, useState } from "react";
import { EntityActivity } from "@/lib/types";
import { apiGet } from "@/lib/api";
import { Plus, Edit2, RefreshCw, CreditCard, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const actionConfig: Record<string, { color: string; bg: string; icon: typeof Plus }> = {
  created: { color: "#22C55E", bg: "#F0FDF4", icon: Plus },
  updated: { color: "#3B82F6", bg: "#EFF6FF", icon: Edit2 },
  status_changed: { color: "#F59E0B", bg: "#FFFBEB", icon: RefreshCw },
  payment_received: { color: "#22C55E", bg: "#F0FDF4", icon: CreditCard },
  deleted: { color: "#EF4444", bg: "#FEF2F2", icon: Trash2 },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function ActivityTimeline({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [activities, setActivities] = useState<EntityActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    apiGet<EntityActivity[]>(`/api/activity?entityType=${entityType}&entityId=${entityId}`)
      .then((data) => { if (data) setActivities(data); })
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="card p-6">
        <h3 className="text-[15px] font-bold text-slate-900 mb-4">Activity Timeline</h3>
        <p className="text-[13px] text-slate-400">Loading...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-[15px] font-bold text-slate-900 mb-4">Activity Timeline</h3>
        <p className="text-[13px] text-slate-400">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-[15px] font-bold text-slate-900 mb-4">Activity Timeline</h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />

        <div className="space-y-4">
          {activities.map((a) => {
            const cfg = actionConfig[a.action] || actionConfig.updated;
            const Icon = cfg.icon;
            const hasMeta = a.metadata && Object.keys(a.metadata).length > 0;

            return (
              <div key={a.id} className="relative flex gap-3 pl-0">
                {/* Icon circle */}
                <div
                  className="relative z-10 flex items-center justify-center shrink-0"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: cfg.bg,
                    border: `2px solid ${cfg.color}30`,
                  }}
                >
                  <Icon size={13} style={{ color: cfg.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-slate-800 capitalize">{a.action.replace(/_/g, " ")}</span>
                    <span className="text-[11px] text-slate-400">{timeAgo(a.createdAt)}</span>
                  </div>
                  {a.description && (
                    <p className="text-[12px] text-slate-500 mt-0.5">{a.description}</p>
                  )}
                  {hasMeta && (
                    <button
                      className="text-[11px] text-indigo-500 hover:text-indigo-700 mt-1 flex items-center gap-0.5"
                      onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                    >
                      {expanded === a.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      Details
                    </button>
                  )}
                  {expanded === a.id && a.metadata && (
                    <pre className="mt-1.5 text-[11px] bg-slate-50 rounded-md p-2 text-slate-600 overflow-x-auto">
                      {JSON.stringify(a.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

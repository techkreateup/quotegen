const statusMap: Record<string, { bg: string; text: string; border: string }> = {
  Active:           { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" },
  Inactive:         { bg: "#F3F4F6", text: "#4B5563", border: "#D1D5DB" },
  "At Risk":        { bg: "#FFF7ED", text: "#9A3412", border: "#FCA5A5" },
  Draft:            { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  Created:          { bg: "#FFFBEB", text: "#92400E", border: "#FCD34D" },
  Sent:             { bg: "#EFF6FF", text: "#1E40AF", border: "#93C5FD" },
  Won:              { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" },
  Lost:             { bg: "#FFF1F2", text: "#9F1239", border: "#FDA4AF" },
  Cancelled:        { bg: "#F3F4F6", text: "#4B5563", border: "#D1D5DB" },
  Unpaid:           { bg: "#FFF1F2", text: "#9F1239", border: "#FDA4AF" },
  Paid:             { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" },
  PartiallyPaid:    { bg: "#FFFBEB", text: "#92400E", border: "#FCD34D" },
  "Partially Paid": { bg: "#FFFBEB", text: "#92400E", border: "#FCD34D" },
  Overdue:          { bg: "#FFF1F2", text: "#9F1239", border: "#FDA4AF" },
  Settled:          { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" },
  Pending:          { bg: "#FFFBEB", text: "#92400E", border: "#FCD34D" },
  Processing:       { bg: "#EFF6FF", text: "#1E40AF", border: "#93C5FD" },
  Paused:           { bg: "#FFFBEB", text: "#92400E", border: "#FCD34D" },
  InProgress:       { bg: "#EFF6FF", text: "#1E40AF", border: "#93C5FD" },
  "In Progress":    { bg: "#EFF6FF", text: "#1E40AF", border: "#93C5FD" },
  Completed:        { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" },
  OnHold:           { bg: "#FFF7ED", text: "#9A3412", border: "#FDBA74" },
  "On Hold":        { bg: "#FFF7ED", text: "#9A3412", border: "#FDBA74" },
  Todo:             { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  Done:             { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" },
};

const displayLabel: Record<string, string> = {
  PartiallyPaid: "Partially Paid",
  InProgress: "In Progress",
  OnHold: "On Hold",
  AtRisk: "At Risk",
};

export default function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status] ?? { bg: "#F3F4F6", text: "#4B5563", border: "#D1D5DB" };
  const label = displayLabel[status] ?? status;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 999,
      border: `1.5px solid ${s.border}`,
      background: s.bg, color: s.text,
      fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
      lineHeight: 1, height: 22,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.text, flexShrink: 0, opacity: 0.8 }} />
      {label}
    </span>
  );
}

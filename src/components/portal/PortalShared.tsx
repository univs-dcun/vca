import type { ProjectType } from "@/lib/vcaStore";

export const BORDER = "1px solid var(--gray-200)";
export const PANEL_SHADOW = "0 2px 3px rgba(14,22,42,0.03)";

export const TYPE_META: Record<ProjectType, { label: string; bg: string; color: string }> = {
  smart_city: { label: "Smart City", bg: "var(--primary-100)", color: "var(--primary-400)" },
  smart_school: { label: "Smart School", bg: "var(--gray-100)", color: "var(--success-400)" },
};

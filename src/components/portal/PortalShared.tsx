import type { ProjectType } from "@/lib/vcaStore";

export const BORDER = "1px solid #e2e8f0";
export const PANEL_SHADOW = "0 2px 3px rgba(14,22,42,0.03)";

export const TYPE_META: Record<ProjectType, { label: string; bg: string; color: string }> = {
  smart_city: { label: "Smart City", bg: "#f0f0ff", color: "#5a3dfb" },
  smart_school: { label: "Smart School", bg: "#f1f5f9", color: "#16a34a" },
};

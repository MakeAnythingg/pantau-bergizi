/** Most urgent first. */
export const STATUSES = ["priority", "attention", "no_signal", "no_data"] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  priority: "Prioritas",
  attention: "Perlu perhatian",
  no_signal: "Tidak ada sinyal",
  no_data: "Belum ada data",
};

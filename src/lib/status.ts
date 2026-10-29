export type Status = "priority" | "attention" | "no_signal" | "no_data";

export const STATUS_LABEL: Record<Status, string> = {
  priority: "Prioritas",
  attention: "Perlu perhatian",
  no_signal: "Tidak ada sinyal",
  no_data: "Belum ada data",
};

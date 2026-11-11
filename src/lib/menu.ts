/** Isi Piringku compartments in tray order. Staple and protein are required; an empty slot reads "Tidak ada". */
export const PLATE = [
  { key: "staple", label: "Makanan pokok", required: true, placeholder: "Nasi, kentang, roti…" },
  { key: "protein", label: "Lauk pauk", required: true, placeholder: "Ayam goreng, telur, tempe…" },
  { key: "vegetable", label: "Sayur", required: false, placeholder: "Tumis buncis, sayur sop…" },
  { key: "fruit", label: "Buah", required: false, placeholder: "Pisang, jeruk…" },
  { key: "milk", label: "Susu", required: false, placeholder: "Susu UHT…" },
] as const;

export type Plate = Record<(typeof PLATE)[number]["key"], string>;

/** Long enough for "Ikan tongkol bumbu kuning, telur rebus", short enough to fit a compartment. */
export const PLATE_SLOT_MAX_CHARS = 60;

// All data here is SIMULASI — "Kota Sukamaju" does not exist.

export type SignalProfile = "priority" | "attention" | "no_signal" | "no_data";

export const DEMO_PASSWORD = "demo1234";
export const MODERATOR_EMAIL = "moderator@pantaubergizi.id";

type SeedSchool = { name: string; code: string; lat: number; lng: number };
type SeedSppg = { name: string; district: string; profile: SignalProfile; managerEmail?: string; schools: SeedSchool[] };

export const SEED_SPPG: SeedSppg[] = [
  {
    name: "SPPG Melati 01",
    district: "Kec. Cempaka",
    profile: "priority",
    managerEmail: "sppg-melati@pantaubergizi.id",
    schools: [
      { name: "SDN Harapan 1", code: "sdn-harapan-1", lat: -6.9021, lng: 107.6187 },
      { name: "SMPN Harapan 2", code: "smpn-harapan-2", lat: -6.9047, lng: 107.6222 },
      { name: "SDN Cempaka 3", code: "sdn-cempaka-3", lat: -6.8994, lng: 107.6151 },
      { name: "SMAN 1 Sukamaju", code: "sman-1-sukamaju", lat: -6.9068, lng: 107.6174 },
    ],
  },
  {
    name: "SPPG Kenanga 02",
    district: "Kec. Kenanga",
    profile: "attention",
    managerEmail: "sppg-kenanga@pantaubergizi.id",
    schools: [
      { name: "SDN Kenanga 1", code: "sdn-kenanga-1", lat: -6.9213, lng: 107.6035 },
      { name: "SMPN 4 Sukamaju", code: "smpn-4-sukamaju", lat: -6.9238, lng: 107.6071 },
      { name: "SMKN 2 Sukamaju", code: "smkn-2-sukamaju", lat: -6.9189, lng: 107.6012 },
    ],
  },
  {
    name: "SPPG Flamboyan 01",
    district: "Kec. Flamboyan",
    profile: "no_signal",
    schools: [
      { name: "SDN Flamboyan 1", code: "sdn-flamboyan-1", lat: -6.8857, lng: 107.6332 },
      { name: "SDN Flamboyan 2", code: "sdn-flamboyan-2", lat: -6.8879, lng: 107.6368 },
      { name: "SMPN 7 Sukamaju", code: "smpn-7-sukamaju", lat: -6.8832, lng: 107.6301 },
      { name: "SMAN 3 Sukamaju", code: "sman-3-sukamaju", lat: -6.8901, lng: 107.6345 },
      { name: "SDN Melur 5", code: "sdn-melur-5", lat: -6.8846, lng: 107.6389 },
    ],
  },
  {
    name: "SPPG Dahlia 03",
    district: "Kec. Dahlia",
    profile: "no_data",
    schools: [
      { name: "SDN Dahlia 1", code: "sdn-dahlia-1", lat: -6.9352, lng: 107.6248 },
      { name: "SMPN 9 Sukamaju", code: "smpn-9-sukamaju", lat: -6.9377, lng: 107.6283 },
      { name: "SMKN 5 Sukamaju", code: "smkn-5-sukamaju", lat: -6.9331, lng: 107.6219 },
    ],
  },
];

export const SEED_MENUS = [
  { name: "Nasi ayam goreng", composition: "Nasi, ayam goreng, tumis buncis, pisang" },
  { name: "Nasi ikan bumbu kuning", composition: "Nasi, ikan tongkol bumbu kuning, sayur bayam, jeruk" },
  { name: "Nasi telur balado", composition: "Nasi, telur balado, tumis kangkung, semangka" },
  { name: "Nasi semur daging", composition: "Nasi, semur daging, sayur sop, pepaya" },
  { name: "Nasi ayam kecap", composition: "Nasi, ayam kecap, capcay, susu UHT" },
  { name: "Nasi tempe orek", composition: "Nasi, tempe orek, telur rebus, sayur asem, melon" },
  { name: "Nasi pindang ikan", composition: "Nasi, pindang ikan, tumis wortel, pisang" },
];

export const SEED_NOTES = [
  "Enak, habis semua.",
  "Ayamnya agak keras tapi tetap habis.",
  "Sayurnya kurang asin.",
  "Porsinya pas.",
  "Buahnya segar.",
];

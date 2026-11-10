type NationalFigure = {
  label: string;
  value: string;
  period: string;
  source: string;
  url: string;
  publishedOn: string;
  accessedOn: string;
};

const accessedOn = "10 November 2026";

export const NATIONAL_FIGURES: readonly NationalFigure[] = [
  {
    label: "Korban insiden keracunan terkait MBG yang disebut dalam rapat Komisi IX",
    value: "50.059 orang",
    period: "Data per 2 September 2026",
    source: "Parlementaria DPR RI, pernyataan Wakil Ketua Komisi IX",
    url: "https://www.dpr.go.id/kegiatan-dpr/berita/Desak-Perubahan-Sistemik-BGN-Harus-Beralih-ke-Dapur-Berbasis-Sekolah-68757",
    publishedOn: "4 September 2026",
    accessedOn,
  },
  {
    label: "Dapur MBG (SPPG) dalam pendataan BGN",
    value: "27.485 dapur",
    period: "Hingga akhir Oktober 2026 · 26.723 dapur telah diverifikasi",
    source: "Badan Gizi Nasional, pembaruan tata kelola MBG",
    url: "https://www.bgn.go.id/news/artikel/ketika-mbg-tumbuh-besar-bgn-mulai-membenahi-dapur-hingga-tata-kelola",
    publishedOn: "2 November 2026",
    accessedOn,
  },
  {
    label: "Pagu tersedia untuk penyaluran MBG",
    value: "Rp218,77 triliun",
    period: "Tahun anggaran 2026 · posisi per 16 September 2026",
    source: "Badan Gizi Nasional, laporan anggaran MBG ke Komisi IX",
    url: "https://www.bgn.go.id/news/siaran-pers/program-mbg-serap-anggaran-6389-persen-per-september-2026",
    publishedOn: "17 September 2026",
    accessedOn,
  },
  {
    label: "Sisa makanan dari porsi utuh dalam studi di SMPN 4 Garut",
    value: "35,8%",
    period: "Studi terhadap 103 siswa di satu sekolah",
    source: "Repositori IPB, penelitian Kayla Alisha Putri",
    url: "https://repository.ipb.ac.id/handle/123456789/177115?show=full",
    publishedOn: "2026",
    accessedOn,
  },
];

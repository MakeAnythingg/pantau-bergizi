import { LacakView } from "./lacak-view";

export default function LacakPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-2 pb-14">
      <h1 className="font-heading text-[30px] leading-[1.05] font-bold tracking-tight">Lacak laporan</h1>
      <p className="mt-2 text-ink-2">Masukkan kode lacak yang kamu dapat setelah melapor.</p>
      <LacakView />
    </main>
  );
}

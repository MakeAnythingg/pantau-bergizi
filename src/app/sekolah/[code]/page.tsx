import { StubPage } from "@/components/stub-page";

async function Param({ params }: { params: PageProps<"/sekolah/[code]">["params"] }) {
  return <>{(await params).code}</>;
}

export default function SekolahPage(props: PageProps<"/sekolah/[code]">) {
  return (
    <StubPage title="Halaman sekolah">
      <Param params={props.params} />
    </StubPage>
  );
}

import { StubPage } from "@/components/stub-page";

async function Param({ params }: { params: PageProps<"/sppg/[id]">["params"] }) {
  return <>SPPG #{(await params).id}</>;
}

export default function RaporDapurPage(props: PageProps<"/sppg/[id]">) {
  return (
    <StubPage title="Rapor dapur">
      <Param params={props.params} />
    </StubPage>
  );
}

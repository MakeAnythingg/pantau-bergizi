import { StubPage } from "@/components/stub-page";

async function Param({ params }: { params: PageProps<"/lapor/[code]">["params"] }) {
  return <>{(await params).code}</>;
}

export default function LaporPage(props: PageProps<"/lapor/[code]">) {
  return (
    <StubPage title="Form lapor">
      <Param params={props.params} />
    </StubPage>
  );
}

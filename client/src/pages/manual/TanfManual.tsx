import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";

export default function TanfManual() {
  return (
    <>
      <Helmet>
        <title>TCA/TANF Handbook - Benefits Navigator</title>
        <meta name="description" content="Temporary Cash Assistance (TCA/TANF) program handbook with eligibility requirements, work requirements, time limits, and benefit calculations." />
      </Helmet>
      <ProgramManualEbook program="tanf" />
    </>
  );
}

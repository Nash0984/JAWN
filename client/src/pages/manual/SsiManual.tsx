import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";

export default function SsiManual() {
  return (
    <>
      <Helmet>
        <title>SSI Reference Guide - Benefits Navigator</title>
        <meta name="description" content="Supplemental Security Income (SSI) reference guide with federal program overview, state supplements, eligibility requirements, and benefit rates." />
      </Helmet>
      <ProgramManualEbook program="ssi" />
    </>
  );
}

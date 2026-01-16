import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";

export default function TaxCreditsManual() {
  return (
    <>
      <Helmet>
        <title>Tax Credits Guide - Benefits Navigator</title>
        <meta name="description" content="Refundable tax credits guide covering EITC, Child Tax Credit, state-specific credits, and VITA integration for benefits crosswalk." />
      </Helmet>
      <ProgramManualEbook program="tax-credits" />
    </>
  );
}

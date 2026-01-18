import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";
import { useTenant } from "@/contexts/TenantContext";

export default function TaxCreditsManual() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  
  return (
    <>
      <Helmet>
        <title>Tax Credits Guide - {stateName} Benefits Navigator</title>
        <meta name="description" content={`Refundable tax credits guide for ${stateName} covering EITC, Child Tax Credit, state-specific credits, and VITA integration for benefits crosswalk.`} />
      </Helmet>
      <ProgramManualEbook program="tax-credits" />
    </>
  );
}

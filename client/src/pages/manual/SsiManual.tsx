import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";
import { useTenant } from "@/contexts/TenantContext";

export default function SsiManual() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  
  return (
    <>
      <Helmet>
        <title>SSI Reference Guide - {stateName} Benefits Navigator</title>
        <meta name="description" content={`Supplemental Security Income (SSI) reference guide for ${stateName} with federal program overview, state supplements, eligibility requirements, and benefit rates.`} />
      </Helmet>
      <ProgramManualEbook program="ssi" />
    </>
  );
}

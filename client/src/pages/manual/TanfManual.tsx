import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";
import { useTenant } from "@/contexts/TenantContext";

export default function TanfManual() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  
  return (
    <>
      <Helmet>
        <title>TCA/TANF Handbook - {stateName} Benefits Navigator</title>
        <meta name="description" content={`Temporary Cash Assistance (TCA/TANF) program handbook for ${stateName} with eligibility requirements, work requirements, time limits, and benefit calculations.`} />
      </Helmet>
      <ProgramManualEbook program="tanf" />
    </>
  );
}

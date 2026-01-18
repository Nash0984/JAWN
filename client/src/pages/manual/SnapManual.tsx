import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";
import { useTenant } from "@/contexts/TenantContext";

export default function SnapManual() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  
  return (
    <>
      <Helmet>
        <title>SNAP Policy Manual - {stateName} Benefits Navigator</title>
        <meta name="description" content={`Complete SNAP (Supplemental Nutrition Assistance Program) policy manual for ${stateName} with eligibility requirements, income limits, deductions, and benefit calculations.`} />
      </Helmet>
      <ProgramManualEbook program="snap" />
    </>
  );
}

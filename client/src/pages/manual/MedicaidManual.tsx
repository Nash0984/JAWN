import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";
import { useTenant } from "@/contexts/TenantContext";

export default function MedicaidManual() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  
  return (
    <>
      <Helmet>
        <title>Medical Assistance Policy Guide - {stateName} Benefits Navigator</title>
        <meta name="description" content={`Comprehensive Medical Assistance (Medicaid) policy guide for ${stateName} covering eligibility groups, MAGI income methodology, covered services, and enrollment procedures.`} />
      </Helmet>
      <ProgramManualEbook program="medicaid" />
    </>
  );
}

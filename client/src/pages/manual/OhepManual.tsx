import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";
import { useTenant } from "@/contexts/TenantContext";

export default function OhepManual() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  
  return (
    <>
      <Helmet>
        <title>Energy Assistance Guide - {stateName} Benefits Navigator</title>
        <meta name="description" content={`Energy assistance programs policy guide for ${stateName} covering heating, cooling, utility assistance, arrearage retirement, and crisis energy assistance programs.`} />
      </Helmet>
      <ProgramManualEbook program="ohep" />
    </>
  );
}

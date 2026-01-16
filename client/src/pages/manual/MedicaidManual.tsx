import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";

export default function MedicaidManual() {
  return (
    <>
      <Helmet>
        <title>Medical Assistance Policy Guide - Benefits Navigator</title>
        <meta name="description" content="Comprehensive Medical Assistance (Medicaid) policy guide covering eligibility groups, MAGI income methodology, covered services, and enrollment procedures." />
      </Helmet>
      <ProgramManualEbook program="medicaid" />
    </>
  );
}

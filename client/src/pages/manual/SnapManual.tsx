import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";

export default function SnapManual() {
  return (
    <>
      <Helmet>
        <title>SNAP Policy Manual - Benefits Navigator</title>
        <meta name="description" content="Complete SNAP (Supplemental Nutrition Assistance Program) policy manual with eligibility requirements, income limits, deductions, and benefit calculations." />
      </Helmet>
      <ProgramManualEbook program="snap" />
    </>
  );
}

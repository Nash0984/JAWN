import { Helmet } from "react-helmet-async";
import { ProgramManualEbook } from "@/components/ProgramManualEbook";

export default function OhepManual() {
  return (
    <>
      <Helmet>
        <title>OHEP Energy Assistance Guide - Benefits Navigator</title>
        <meta name="description" content="Office of Home Energy Programs (OHEP) policy guide covering MEAP, EUSP, Arrearage Retirement, and crisis energy assistance programs." />
      </Helmet>
      <ProgramManualEbook program="ohep" />
    </>
  );
}

import type { Form1099MISCData, Form1099NECData } from '../../../server/services/taxDocumentExtraction';

/**
 * Synthetic 1099 Form Test Data
 * 
 * Realistic 1099-MISC and 1099-NEC test data for document extraction testing
 * Based on 2024 tax year Maryland contractors and self-employed individuals
 */

export const form1099Samples = {
  // 1099-MISC Forms
  misc_2024: {
    taxYear: 2024,
    payerName: "Baltimore Consulting Group LLC",
    payerTIN: "52-9876543",
    recipientName: "Jane M. Smith",
    recipientTIN: "987-65-4321",
    box1_rents: 0,
    box2_royalties: 0,
    box3_otherIncome: 12500,
    box4_federalTaxWithheld: 0,
    box5_fishingBoatProceeds: 0,
    box6_medicalHealthPayments: 0,
    box7_nonemployeeCompensation: 0, // Pre-2020 only
    box8_substitutePayments: 0,
    box9_cropInsurance: 0,
    box10_grossProceeds: 0,
    box14_excessGoldenParachute: 0,
    box16_stateTaxWithheld: 0,
    box17_stateIncome: 0,
    stateInfo: "MD",
  } as Form1099MISCData,

  misc_rental_2024: {
    taxYear: 2024,
    payerName: "Harbor Point Property Management LLC",
    payerTIN: "52-7654321",
    recipientName: "Michael R. Thompson",
    recipientTIN: "555-12-3456",
    box1_rents: 24000, // $2,000/month rental income
    box2_royalties: 0,
    box3_otherIncome: 500, // Late fees
    box4_federalTaxWithheld: 0,
    box5_fishingBoatProceeds: 0,
    box6_medicalHealthPayments: 0,
    box7_nonemployeeCompensation: 0,
    box8_substitutePayments: 0,
    box9_cropInsurance: 0,
    box10_grossProceeds: 0,
    box14_excessGoldenParachute: 0,
    box16_stateTaxWithheld: 0,
    box17_stateIncome: 0,
    stateInfo: "MD",
  } as Form1099MISCData,

  misc_royalties_2024: {
    taxYear: 2024,
    payerName: "Maryland Publishing House Inc",
    payerTIN: "52-1234567",
    recipientName: "Sarah L. Anderson",
    recipientTIN: "777-88-9999",
    box1_rents: 0,
    box2_royalties: 8500, // Book royalties
    box3_otherIncome: 0,
    box4_federalTaxWithheld: 850, // 10% backup withholding
    box5_fishingBoatProceeds: 0,
    box6_medicalHealthPayments: 0,
    box7_nonemployeeCompensation: 0,
    box8_substitutePayments: 0,
    box9_cropInsurance: 0,
    box10_grossProceeds: 0,
    box14_excessGoldenParachute: 0,
    box16_stateTaxWithheld: 425,
    box17_stateIncome: 8500,
    stateInfo: "MD",
  } as Form1099MISCData,

  misc_medical_2024: {
    taxYear: 2024,
    payerName: "Johns Hopkins Health System",
    payerTIN: "52-0595110",
    recipientName: "Dr. Robert K. Williams",
    recipientTIN: "333-44-5555",
    box1_rents: 0,
    box2_royalties: 0,
    box3_otherIncome: 0,
    box4_federalTaxWithheld: 0,
    box5_fishingBoatProceeds: 0,
    box6_medicalHealthPayments: 45000, // Healthcare payments
    box7_nonemployeeCompensation: 0,
    box8_substitutePayments: 0,
    box9_cropInsurance: 0,
    box10_grossProceeds: 0,
    box14_excessGoldenParachute: 0,
    box16_stateTaxWithheld: 0,
    box17_stateIncome: 0,
    stateInfo: "MD",
  } as Form1099MISCData,

  // 1099-NEC Forms (Nonemployee Compensation, post-2020)
  nec_2024: {
    taxYear: 2024,
    payerName: "Digital Marketing Solutions LLC",
    payerTIN: "52-3456789",
    recipientName: "Bob T. Johnson",
    recipientTIN: "111-22-3333",
    box1_nonemployeeCompensation: 35000,
    box4_federalTaxWithheld: 0,
    box5_stateTaxWithheld: 0,
    box6_stateIncome: 35000,
    stateInfo: "MD",
  } as Form1099NECData,

  nec_withholding_2024: {
    taxYear: 2024,
    payerName: "Freelance Co",
    payerTIN: "11-2233445",
    recipientName: "Jennifer A. Martinez",
    recipientTIN: "666-77-8888",
    box1_nonemployeeCompensation: 35000,
    box4_federalTaxWithheld: 3500, // Backup withholding
    box5_stateTaxWithheld: 1750,
    box6_stateIncome: 35000,
    stateInfo: "MD",
  } as Form1099NECData,

  nec_lowIncome_2024: {
    taxYear: 2024,
    payerName: "Local Community Services",
    payerTIN: "52-4567890",
    recipientName: "Maria G. Rodriguez",
    recipientTIN: "222-33-4444",
    box1_nonemployeeCompensation: 8500,
    box4_federalTaxWithheld: 0,
    box5_stateTaxWithheld: 0,
    box6_stateIncome: 8500,
    stateInfo: "MD",
  } as Form1099NECData,

  nec_highEarner_2024: {
    taxYear: 2024,
    payerName: "Tech Startup Ventures Inc",
    payerTIN: "52-6789012",
    recipientName: "David K. Chen",
    recipientTIN: "888-99-0000",
    box1_nonemployeeCompensation: 125000,
    box4_federalTaxWithheld: 0,
    box5_stateTaxWithheld: 0,
    box6_stateIncome: 125000,
    stateInfo: "MD",
  } as Form1099NECData,

  nec_multipleIncome_2024: {
    taxYear: 2024,
    payerName: "Consulting Partners LLC",
    payerTIN: "52-7890123",
    recipientName: "Alex P. Taylor",
    recipientTIN: "444-55-6666",
    box1_nonemployeeCompensation: 52000,
    box4_federalTaxWithheld: 5200, // 10% backup withholding
    box5_stateTaxWithheld: 2600,
    box6_stateIncome: 52000,
    stateInfo: "MD",
  } as Form1099NECData,
};

export type Form1099Samples = typeof form1099Samples;

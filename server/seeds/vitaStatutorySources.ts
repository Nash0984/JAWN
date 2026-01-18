import { db } from "../db";
import { statutorySources } from "@shared/schema";
import { logger } from "../services/logger.service";

/**
 * VITA Tax Statutory Sources
 * 
 * This module seeds the statutory sources for the VITA Tax Rules Engine,
 * providing formal legal citations for tax calculations including:
 * - Federal: Internal Revenue Code (Title 26 USC), Treasury Regulations (26 CFR), IRS Publications
 * - State: Maryland, Pennsylvania, Virginia, Utah tax codes and regulations
 * 
 * These sources enable the neuro-symbolic hybrid gateway to provide
 * legally-grounded explanations for tax eligibility determinations.
 */

export interface VITAStatutorySource {
  stateCode: string;
  programCode: string;
  sourceType: string;
  citation: string;
  title: string;
  fullText: string;
  sourceUrl?: string;
  parentCitation?: string;
  crossReferences?: string[];
  metadata?: Record<string, unknown>;
}

// Federal Tax Statutory Sources
export const FEDERAL_TAX_SOURCES: VITAStatutorySource[] = [
  // Internal Revenue Code - Core Provisions
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "statute",
    citation: "26 U.S.C. § 1",
    title: "Tax Imposed - Federal Income Tax Rates",
    fullText: "There is hereby imposed on the taxable income of every individual a tax determined in accordance with the following tables (10%, 12%, 22%, 24%, 32%, 35%, 37% brackets based on filing status and taxable income).",
    sourceUrl: "https://www.govinfo.gov/content/pkg/USCODE-2023-title26/html/USCODE-2023-title26-subtitleA-chap1-subchapA-partI-sec1.htm",
    crossReferences: ["26 U.S.C. § 63", "26 CFR § 1.1-1"],
    metadata: { taxYear: 2024, rateStructure: "progressive" }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "statute",
    citation: "26 U.S.C. § 24",
    title: "Child Tax Credit",
    fullText: "There shall be allowed as a credit against the tax imposed by this chapter for the taxable year an amount equal to $2,000 per qualifying child. The credit is partially refundable up to $1,700 per qualifying child as the Additional Child Tax Credit (ACTC) under section 24(h).",
    sourceUrl: "https://www.govinfo.gov/content/pkg/USCODE-2023-title26/html/USCODE-2023-title26-subtitleA-chap1-subchapA-partIV-subpartA-sec24.htm",
    crossReferences: ["26 U.S.C. § 152", "26 CFR § 1.24-1"],
    metadata: { creditAmount: 200000, refundableMax: 170000 }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "statute",
    citation: "26 U.S.C. § 24(h)",
    title: "Additional Child Tax Credit (ACTC)",
    fullText: "The portion of the credit under subsection (a) which is refundable shall not exceed $1,700 per qualifying child for taxable years beginning in 2024.",
    sourceUrl: "https://www.govinfo.gov/content/pkg/USCODE-2023-title26/html/USCODE-2023-title26-subtitleA-chap1-subchapA-partIV-subpartA-sec24.htm",
    parentCitation: "26 U.S.C. § 24",
    metadata: { refundableMax: 170000, taxYear: 2024 }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "statute",
    citation: "26 U.S.C. § 32",
    title: "Earned Income Tax Credit (EITC)",
    fullText: "In the case of an eligible individual, there shall be allowed as a credit against the tax imposed by this subtitle for the taxable year an amount equal to the credit percentage of so much of the taxpayer's earned income for the taxable year as does not exceed the earned income amount.",
    sourceUrl: "https://www.govinfo.gov/content/pkg/USCODE-2023-title26/html/USCODE-2023-title26-subtitleA-chap1-subchapA-partIV-subpartC-sec32.htm",
    crossReferences: ["26 CFR § 1.32-1", "IRS Publication 596"],
    metadata: { refundable: true, earnedIncomeRequired: true }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "statute",
    citation: "26 U.S.C. § 63",
    title: "Taxable Income Defined - Standard Deduction",
    fullText: "For purposes of this subtitle, the term 'taxable income' means gross income minus the deductions allowed by this chapter. The standard deduction varies by filing status: single ($14,600), married filing jointly ($29,200), head of household ($21,900) for 2024.",
    sourceUrl: "https://www.govinfo.gov/content/pkg/USCODE-2023-title26/html/USCODE-2023-title26-subtitleA-chap1-subchapB-partI-sec63.htm",
    crossReferences: ["26 U.S.C. § 1", "26 CFR § 1.63-1"],
    metadata: { taxYear: 2024 }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "statute",
    citation: "26 U.S.C. § 25A",
    title: "American Opportunity and Lifetime Learning Credits",
    fullText: "A credit shall be allowed for qualified tuition and related expenses. The American Opportunity Credit provides up to $2,500 per student (40% refundable, max $1,000). The Lifetime Learning Credit provides up to $2,000 per return (non-refundable).",
    sourceUrl: "https://www.govinfo.gov/content/pkg/USCODE-2023-title26/html/USCODE-2023-title26-subtitleA-chap1-subchapA-partIV-subpartA-sec25A.htm",
    crossReferences: ["IRS Publication 970", "IRS Form 8863"],
    metadata: { aocMax: 250000, llcMax: 200000 }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "statute",
    citation: "26 U.S.C. § 1401",
    title: "Self-Employment Tax",
    fullText: "In addition to other taxes, there shall be imposed for each taxable year, on the self-employment income of every individual, a tax equal to 15.3% (12.4% Social Security + 2.9% Medicare) of net self-employment earnings.",
    sourceUrl: "https://www.govinfo.gov/content/pkg/USCODE-2023-title26/html/USCODE-2023-title26-subtitleA-chap2-subchapA-sec1401.htm",
    crossReferences: ["26 U.S.C. § 1402", "IRS Schedule SE"],
    metadata: { socialSecurityRate: 0.124, medicareRate: 0.029 }
  },
  
  // Treasury Regulations (26 CFR)
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "cfr",
    citation: "26 CFR § 1.32-1",
    title: "EITC - Regulations",
    fullText: "This section provides rules for computing the earned income credit under section 32. Earned income includes wages, salaries, tips, and net earnings from self-employment.",
    sourceUrl: "https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/subject-group-ECFR3e5718e7a2c1b0b/section-1.32-1",
    parentCitation: "26 U.S.C. § 32",
    metadata: { regulationType: "interpretive" }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "cfr",
    citation: "26 CFR § 1.24-1",
    title: "Child Tax Credit - Regulations",
    fullText: "This section provides rules for the child tax credit under section 24, including the definition of qualifying child and income phase-out thresholds.",
    sourceUrl: "https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/section-1.24-1",
    parentCitation: "26 U.S.C. § 24",
    metadata: { regulationType: "interpretive" }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "cfr",
    citation: "26 CFR § 1.63-1",
    title: "Standard Deduction - Regulations",
    fullText: "This section provides rules for computing the standard deduction under section 63, including additional amounts for elderly and blind taxpayers.",
    sourceUrl: "https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/section-1.63-1",
    parentCitation: "26 U.S.C. § 63",
    metadata: { regulationType: "interpretive" }
  },
  
  // IRS Publications
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "guidance",
    citation: "IRS Publication 17",
    title: "Your Federal Income Tax (For Individuals)",
    fullText: "Comprehensive guide to federal income tax for individuals, covering filing requirements, income, deductions, credits, and tax computation.",
    sourceUrl: "https://www.irs.gov/publications/p17",
    crossReferences: ["26 U.S.C. § 1", "26 U.S.C. § 63"],
    metadata: { publicationType: "taxpayer_guide", taxYear: 2024 }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "guidance",
    citation: "IRS Publication 334",
    title: "Tax Guide for Small Business (Schedule C)",
    fullText: "Guide for sole proprietors covering business income, expenses, and self-employment tax. Includes Schedule C instructions and allowable business deductions.",
    sourceUrl: "https://www.irs.gov/publications/p334",
    crossReferences: ["26 U.S.C. § 1401", "IRS Schedule C"],
    metadata: { publicationType: "business_guide" }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "guidance",
    citation: "IRS Publication 596",
    title: "Earned Income Credit (EIC)",
    fullText: "Comprehensive guide to the Earned Income Tax Credit, including eligibility rules, qualifying child requirements, income limits, and credit computation worksheets.",
    sourceUrl: "https://www.irs.gov/publications/p596",
    parentCitation: "26 U.S.C. § 32",
    metadata: { publicationType: "credit_guide", refundable: true }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "guidance",
    citation: "IRS Publication 970",
    title: "Tax Benefits for Education",
    fullText: "Guide to education tax benefits including American Opportunity Credit, Lifetime Learning Credit, tuition and fees deduction, student loan interest deduction, and education savings accounts.",
    sourceUrl: "https://www.irs.gov/publications/p970",
    parentCitation: "26 U.S.C. § 25A",
    metadata: { publicationType: "education_guide" }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "guidance",
    citation: "IRS Publication 972",
    title: "Child Tax Credit",
    fullText: "Detailed guide to the Child Tax Credit and Additional Child Tax Credit, including qualifying child tests, income limits, and refundability rules.",
    sourceUrl: "https://www.irs.gov/publications/p972",
    parentCitation: "26 U.S.C. § 24",
    metadata: { publicationType: "credit_guide" }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "guidance",
    citation: "IRS Publication 4012",
    title: "VITA/TCE Volunteer Resource Guide",
    fullText: "Training resource for VITA and TCE volunteers covering tax law basics, interviewing techniques, and preparation of federal returns for low-to-moderate income taxpayers.",
    sourceUrl: "https://www.irs.gov/publications/p4012",
    metadata: { publicationType: "volunteer_training", program: "VITA/TCE" }
  },
  {
    stateCode: "US",
    programCode: "VITA",
    sourceType: "guidance",
    citation: "IRS Publication 4491",
    title: "VITA/TCE Training Guide",
    fullText: "Comprehensive training curriculum for VITA/TCE volunteers, including certification requirements, ethics, quality review, and scope of service limitations.",
    sourceUrl: "https://www.irs.gov/publications/p4491",
    metadata: { publicationType: "volunteer_training", program: "VITA/TCE" }
  }
];

// Maryland State Tax Sources
export const MARYLAND_TAX_SOURCES: VITAStatutorySource[] = [
  {
    stateCode: "MD",
    programCode: "VITA",
    sourceType: "statute",
    citation: "MD Tax-General § 10-105",
    title: "Maryland Income Tax Rates",
    fullText: "Maryland imposes a progressive income tax with rates ranging from 2% to 5.75% on taxable income. Rates apply to Maryland taxable income after deductions and exemptions.",
    sourceUrl: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-105",
    metadata: { rateMin: 0.02, rateMax: 0.0575 }
  },
  {
    stateCode: "MD",
    programCode: "VITA",
    sourceType: "statute",
    citation: "MD Tax-General § 10-701",
    title: "Maryland Earned Income Tax Credit",
    fullText: "A resident individual who is allowed an earned income credit under § 32 of the Internal Revenue Code is allowed a credit against the State income tax equal to 50% of the federal earned income credit (refundable) or 100% of the federal credit (nonrefundable).",
    sourceUrl: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-701",
    crossReferences: ["26 U.S.C. § 32", "IRS Publication 596"],
    metadata: { refundableRate: 0.50, nonrefundableRate: 1.00 }
  },
  {
    stateCode: "MD",
    programCode: "VITA",
    sourceType: "statute",
    citation: "MD Tax-General § 10-751",
    title: "Maryland Child Tax Credit",
    fullText: "Maryland allows a refundable child tax credit for qualifying children under age 17. The credit amount varies based on income and filing status.",
    sourceUrl: "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtg&section=10-751",
    crossReferences: ["26 U.S.C. § 24"],
    metadata: { refundable: true }
  },
  {
    stateCode: "MD",
    programCode: "VITA",
    sourceType: "regulation",
    citation: "COMAR 03.04.02",
    title: "Maryland Income Tax - Computation",
    fullText: "Regulations governing the computation of Maryland income tax, including adjustments to federal adjusted gross income, Maryland modifications, and credit limitations.",
    sourceUrl: "https://dsd.maryland.gov/regulations/Pages/03.04.02.01.aspx",
    metadata: { regulationType: "administrative" }
  },
  {
    stateCode: "MD",
    programCode: "VITA",
    sourceType: "regulation",
    citation: "COMAR 03.04.07",
    title: "Maryland County Income Tax",
    fullText: "Regulations governing the local income tax imposed by counties and Baltimore City. County rates range from 2.25% to 3.20% of Maryland taxable income.",
    sourceUrl: "https://dsd.maryland.gov/regulations/Pages/03.04.07.01.aspx",
    metadata: { rateMin: 0.0225, rateMax: 0.032 }
  },
  {
    stateCode: "MD",
    programCode: "VITA",
    sourceType: "policy_manual",
    citation: "Maryland Form 502 Instructions",
    title: "Resident Income Tax Return Instructions",
    fullText: "Official instructions for completing Maryland Form 502, the resident individual income tax return, including worksheets for credits and modifications.",
    sourceUrl: "https://www.marylandtaxes.gov/forms/current_forms/502.pdf",
    metadata: { formType: "instructions", taxYear: 2024 }
  }
];

// Pennsylvania State Tax Sources
export const PENNSYLVANIA_TAX_SOURCES: VITAStatutorySource[] = [
  {
    stateCode: "PA",
    programCode: "VITA",
    sourceType: "statute",
    citation: "72 P.S. § 7302",
    title: "Pennsylvania Personal Income Tax Rate",
    fullText: "The Commonwealth of Pennsylvania imposes a flat personal income tax rate of 3.07% on eight classes of taxable income: compensation, net profits, interest, dividends, rents, royalties, patents, and gambling/lottery winnings.",
    sourceUrl: "https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm?txtType=HTM&yr=1971&sessInd=0&smthLwInd=0&act=2&chpt=3&sctn=2&subsctn=0",
    metadata: { flatRate: 0.0307 }
  },
  {
    stateCode: "PA",
    programCode: "VITA",
    sourceType: "statute",
    citation: "72 P.S. § 7314",
    title: "Pennsylvania Tax Forgiveness Credit",
    fullText: "Low-income Pennsylvania taxpayers may be eligible for tax forgiveness based on eligibility income and family size. The credit can reduce or eliminate PA income tax liability.",
    sourceUrl: "https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm?txtType=HTM&yr=1971&sessInd=0&smthLwInd=0&act=2&chpt=3&sctn=14&subsctn=0",
    metadata: { creditType: "tax_forgiveness" }
  },
  {
    stateCode: "PA",
    programCode: "VITA",
    sourceType: "statute",
    citation: "72 P.S. § 8701-F",
    title: "Pennsylvania Property Tax/Rent Rebate Program",
    fullText: "The Property Tax/Rent Rebate Program (PA-1000) provides rebates to eligible Pennsylvanians age 65+, widows/widowers age 50+, and persons with disabilities age 18+. Maximum rebate is $1,000 with supplemental rebates available.",
    sourceUrl: "https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm?txtType=HTM&yr=2006&sessInd=0&act=001F&chpt=087&sctn=001&subsctn=0",
    metadata: { maxRebate: 100000, supplementalAvailable: true }
  },
  {
    stateCode: "PA",
    programCode: "VITA",
    sourceType: "policy_manual",
    citation: "PA-40 Instructions",
    title: "Pennsylvania Personal Income Tax Return Instructions",
    fullText: "Official instructions for completing PA-40, the Pennsylvania personal income tax return, including schedules for various income classes and tax forgiveness.",
    sourceUrl: "https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2023/2023_pa-40in.pdf",
    metadata: { formType: "instructions", taxYear: 2024 }
  }
];

// Virginia State Tax Sources
export const VIRGINIA_TAX_SOURCES: VITAStatutorySource[] = [
  {
    stateCode: "VA",
    programCode: "VITA",
    sourceType: "statute",
    citation: "Va. Code § 58.1-320",
    title: "Virginia Income Tax Rates",
    fullText: "Virginia imposes a graduated income tax with rates of 2% on income up to $3,000, 3% on $3,001-$5,000, 5% on $5,001-$17,000, and 5.75% on income over $17,000.",
    sourceUrl: "https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-320/",
    metadata: { rateMax: 0.0575 }
  },
  {
    stateCode: "VA",
    programCode: "VITA",
    sourceType: "statute",
    citation: "Va. Code § 58.1-339.8",
    title: "Virginia Earned Income Tax Credit",
    fullText: "Virginia allows a refundable earned income tax credit equal to 20% of the federal earned income credit for eligible taxpayers.",
    sourceUrl: "https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-339.8/",
    crossReferences: ["26 U.S.C. § 32"],
    metadata: { stateEitcRate: 0.20, refundable: true }
  },
  {
    stateCode: "VA",
    programCode: "VITA",
    sourceType: "policy_manual",
    citation: "Virginia Form 760 Instructions",
    title: "Resident Individual Income Tax Return Instructions",
    fullText: "Official instructions for completing Virginia Form 760, the resident individual income tax return, including credits and subtractions.",
    sourceUrl: "https://www.tax.virginia.gov/sites/default/files/taxforms/individual-income-tax/2023/760-2023.pdf",
    metadata: { formType: "instructions", taxYear: 2024 }
  }
];

// Utah State Tax Sources
export const UTAH_TAX_SOURCES: VITAStatutorySource[] = [
  {
    stateCode: "UT",
    programCode: "VITA",
    sourceType: "statute",
    citation: "Utah Code § 59-10-104",
    title: "Utah Income Tax Rate",
    fullText: "Utah imposes a flat individual income tax rate of 4.65% on Utah taxable income, calculated as federal taxable income with Utah-specific modifications.",
    sourceUrl: "https://le.utah.gov/xcode/Title59/Chapter10/59-10-S104.html",
    metadata: { flatRate: 0.0465 }
  },
  {
    stateCode: "UT",
    programCode: "VITA",
    sourceType: "statute",
    citation: "Utah Code § 59-10-1017",
    title: "Utah Earned Income Tax Credit",
    fullText: "Utah provides a nonrefundable earned income tax credit equal to 20% of the federal earned income credit claimed on the taxpayer's federal return.",
    sourceUrl: "https://le.utah.gov/xcode/Title59/Chapter10/59-10-S1017.html",
    crossReferences: ["26 U.S.C. § 32"],
    metadata: { stateEitcRate: 0.20, refundable: false }
  },
  {
    stateCode: "UT",
    programCode: "VITA",
    sourceType: "policy_manual",
    citation: "Utah Form TC-40 Instructions",
    title: "Utah Individual Income Tax Return Instructions",
    fullText: "Official instructions for completing Utah Form TC-40, the individual income tax return, including credits and adjustments.",
    sourceUrl: "https://tax.utah.gov/forms/current/tc-40inst.pdf",
    metadata: { formType: "instructions", taxYear: 2024 }
  }
];

// Combined array of all VITA statutory sources
export const ALL_VITA_STATUTORY_SOURCES: VITAStatutorySource[] = [
  ...FEDERAL_TAX_SOURCES,
  ...MARYLAND_TAX_SOURCES,
  ...PENNSYLVANIA_TAX_SOURCES,
  ...VIRGINIA_TAX_SOURCES,
  ...UTAH_TAX_SOURCES,
];

/**
 * Seed VITA statutory sources into the database
 */
export async function seedVITAStatutorySources(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  logger.info("[VITAStatutorySources] Starting VITA statutory sources seeding", {
    totalSources: ALL_VITA_STATUTORY_SOURCES.length
  });

  for (const source of ALL_VITA_STATUTORY_SOURCES) {
    try {
      const existing = await db
        .select()
        .from(statutorySources)
        .where(
          db.and(
            db.eq(statutorySources.stateCode, source.stateCode),
            db.eq(statutorySources.programCode, source.programCode),
            db.eq(statutorySources.citation, source.citation)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(statutorySources).values({
        stateCode: source.stateCode,
        programCode: source.programCode,
        sourceType: source.sourceType,
        citation: source.citation,
        title: source.title,
        fullText: source.fullText,
        sourceUrl: source.sourceUrl,
        parentCitation: source.parentCitation,
        crossReferences: source.crossReferences,
        metadata: source.metadata,
        version: "1.0",
        isActive: true,
      });

      inserted++;
    } catch (error) {
      logger.error("[VITAStatutorySources] Error seeding source", {
        citation: source.citation,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  logger.info("[VITAStatutorySources] VITA statutory sources seeding complete", {
    inserted,
    skipped,
    total: ALL_VITA_STATUTORY_SOURCES.length
  });

  return { inserted, skipped };
}

/**
 * Get statutory citations for VITA tax calculations
 * Returns formatted citations for use in policyCitations output
 */
export function getVITAStatutoryCitations(
  calculationType: "income_tax" | "eitc" | "ctc" | "education_credits" | "self_employment" | "standard_deduction",
  stateCode: string = "MD"
): string[] {
  const citations: string[] = [];

  switch (calculationType) {
    case "income_tax":
      citations.push("26 U.S.C. § 1 - Federal Tax Brackets");
      citations.push("26 U.S.C. § 63 - Taxable Income / Standard Deduction");
      if (stateCode === "MD") {
        citations.push("MD Tax-General § 10-105 - Maryland Income Tax Rates");
        citations.push("COMAR 03.04.07 - County Income Tax");
      } else if (stateCode === "PA") {
        citations.push("72 P.S. § 7302 - Pennsylvania 3.07% Flat Rate");
      } else if (stateCode === "VA") {
        citations.push("Va. Code § 58.1-320 - Virginia Graduated Rates");
      } else if (stateCode === "UT") {
        citations.push("Utah Code § 59-10-104 - Utah 4.65% Flat Rate");
      }
      break;

    case "eitc":
      citations.push("26 U.S.C. § 32 - Earned Income Tax Credit");
      citations.push("26 CFR § 1.32-1 - EITC Regulations");
      citations.push("IRS Publication 596 - Earned Income Credit");
      if (stateCode === "MD") {
        citations.push("MD Tax-General § 10-701 - Maryland EITC (50% refundable)");
      } else if (stateCode === "VA") {
        citations.push("Va. Code § 58.1-339.8 - Virginia EITC (20% refundable)");
      } else if (stateCode === "UT") {
        citations.push("Utah Code § 59-10-1017 - Utah EITC (20% nonrefundable)");
      }
      break;

    case "ctc":
      citations.push("26 U.S.C. § 24 - Child Tax Credit ($2,000/child)");
      citations.push("26 U.S.C. § 24(h) - Additional Child Tax Credit (refundable up to $1,700)");
      citations.push("26 CFR § 1.24-1 - CTC Regulations");
      citations.push("IRS Publication 972 - Child Tax Credit");
      if (stateCode === "MD") {
        citations.push("MD Tax-General § 10-751 - Maryland Child Tax Credit");
      }
      break;

    case "education_credits":
      citations.push("26 U.S.C. § 25A - Education Credits");
      citations.push("IRS Publication 970 - Tax Benefits for Education");
      citations.push("IRS Form 8863 - Education Credits");
      break;

    case "self_employment":
      citations.push("26 U.S.C. § 1401 - Self-Employment Tax (15.3%)");
      citations.push("IRS Schedule C - Profit or Loss from Business");
      citations.push("IRS Schedule SE - Self-Employment Tax");
      citations.push("IRS Publication 334 - Tax Guide for Small Business");
      break;

    case "standard_deduction":
      citations.push("26 U.S.C. § 63 - Standard Deduction");
      citations.push("26 CFR § 1.63-1 - Standard Deduction Regulations");
      citations.push("IRS Publication 17 - Standard Deduction by Filing Status");
      break;
  }

  return citations;
}

export default {
  ALL_VITA_STATUTORY_SOURCES,
  FEDERAL_TAX_SOURCES,
  MARYLAND_TAX_SOURCES,
  PENNSYLVANIA_TAX_SOURCES,
  VIRGINIA_TAX_SOURCES,
  UTAH_TAX_SOURCES,
  seedVITAStatutorySources,
  getVITAStatutoryCitations,
};

import { db } from "../db";
import { 
  eeSyntheticIndividuals,
  eeSyntheticContacts,
  eeSyntheticAddresses,
  eeSyntheticIdentification,
  eeSyntheticCases,
  eeSyntheticProgramEnrollments,
  eeSyntheticProviders,
  eeSyntheticCaseClosures,
  eeSyntheticCaseMembers,
} from "@shared/schema";

const MARYLAND_LDSS_OFFICES = [
  { ldssCode: "0100", name: "Allegany County DSS", regionCode: "WMD", population: 70416 },
  { ldssCode: "0200", name: "Anne Arundel County DSS", regionCode: "SMD", population: 588261 },
  { ldssCode: "0300", name: "Baltimore City DSS", regionCode: "BALT", population: 585708 },
  { ldssCode: "0400", name: "Baltimore County DSS", regionCode: "BALT", population: 854535 },
  { ldssCode: "0500", name: "Calvert County DSS", regionCode: "SMD", population: 92525 },
  { ldssCode: "0600", name: "Caroline County DSS", regionCode: "EMD", population: 33406 },
  { ldssCode: "0700", name: "Carroll County DSS", regionCode: "CMD", population: 172891 },
  { ldssCode: "0800", name: "Cecil County DSS", regionCode: "EMD", population: 103725 },
  { ldssCode: "0900", name: "Charles County DSS", regionCode: "SMD", population: 166617 },
  { ldssCode: "1000", name: "Dorchester County DSS", regionCode: "EMD", population: 32531 },
  { ldssCode: "1100", name: "Frederick County DSS", regionCode: "CMD", population: 271717 },
  { ldssCode: "1200", name: "Garrett County DSS", regionCode: "WMD", population: 29014 },
  { ldssCode: "1300", name: "Harford County DSS", regionCode: "CMD", population: 260924 },
  { ldssCode: "1400", name: "Howard County DSS", regionCode: "CMD", population: 332317 },
  { ldssCode: "1500", name: "Kent County DSS", regionCode: "EMD", population: 19422 },
  { ldssCode: "1600", name: "Montgomery County DHHS", regionCode: "MMD", population: 1062061 },
  { ldssCode: "1700", name: "Prince George's County DSS", regionCode: "MMD", population: 967201 },
  { ldssCode: "1800", name: "Queen Anne's County DSS", regionCode: "EMD", population: 50381 },
  { ldssCode: "1900", name: "St. Mary's County DSS", regionCode: "SMD", population: 113777 },
  { ldssCode: "2000", name: "Somerset County DSS", regionCode: "EMD", population: 24620 },
  { ldssCode: "2100", name: "Talbot County DSS", regionCode: "EMD", population: 37181 },
  { ldssCode: "2200", name: "Washington County DSS", regionCode: "WMD", population: 154705 },
  { ldssCode: "2300", name: "Wicomico County DSS", regionCode: "EMD", population: 103588 },
  { ldssCode: "2400", name: "Worcester County DSS", regionCode: "EMD", population: 52460 },
];

const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Daniel", "Lisa", "Matthew", "Nancy",
  "Antonio", "Maria", "DeShawn", "Keisha", "Carlos", "Guadalupe", "Ahmed", "Fatima",
  "Jamal", "Latisha", "Miguel", "Rosa", "Tyrone", "Shaniqua", "Demetrius", "Aaliyah"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "Washington", "Jefferson", "Robinson", "Clark", "Lewis", "Walker", "Hall",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Adams"
];

const MARYLAND_COUNTIES = [
  { code: "001", name: "Allegany" },
  { code: "002", name: "Anne Arundel" },
  { code: "003", name: "Baltimore County" },
  { code: "004", name: "Calvert" },
  { code: "005", name: "Caroline" },
  { code: "006", name: "Carroll" },
  { code: "007", name: "Cecil" },
  { code: "008", name: "Charles" },
  { code: "009", name: "Dorchester" },
  { code: "010", name: "Frederick" },
  { code: "011", name: "Garrett" },
  { code: "012", name: "Harford" },
  { code: "013", name: "Howard" },
  { code: "014", name: "Kent" },
  { code: "015", name: "Montgomery" },
  { code: "016", name: "Prince George's" },
  { code: "017", name: "Queen Anne's" },
  { code: "018", name: "St. Mary's" },
  { code: "019", name: "Somerset" },
  { code: "020", name: "Talbot" },
  { code: "021", name: "Washington" },
  { code: "022", name: "Wicomico" },
  { code: "023", name: "Worcester" },
  { code: "510", name: "Baltimore City" },
];

const MARYLAND_CITIES = [
  "Baltimore", "Frederick", "Rockville", "Gaithersburg", "Bowie", "Hagerstown",
  "Annapolis", "College Park", "Salisbury", "Cumberland", "Laurel", "Greenbelt",
  "Takoma Park", "Westminster", "Easton", "Elkton", "Hyattsville", "Cambridge"
];

const STREET_NAMES = [
  "Main", "Oak", "Maple", "Cedar", "Elm", "Pine", "Washington", "Jefferson",
  "Lincoln", "Martin Luther King Jr", "Church", "Park", "School", "High", "North",
  "South", "East", "West", "First", "Second", "Third", "Fourth", "Fifth"
];

const STREET_TYPES = ["St", "Ave", "Blvd", "Dr", "Ln", "Rd", "Ct", "Way", "Pl"];

const CLOSURE_REASONS = [
  { code: "FNR", reason: "Form Not Received", category: "procedural" },
  { code: "RDE", reason: "Redetermination Expired", category: "procedural" },
  { code: "IOL", reason: "Income Over Limit", category: "eligibility" },
  { code: "FTC", reason: "Failed to Comply", category: "procedural" },
  { code: "MOS", reason: "Moved Out of State", category: "eligibility" },
  { code: "VOL", reason: "Voluntary Closure", category: "client" },
  { code: "NEM", reason: "No Eligible Members", category: "eligibility" },
  { code: "RES", reason: "Resources Over Limit", category: "eligibility" },
];

const PROGRAMS = [
  { code: "SNAP", name: "Supplemental Nutrition Assistance Program", maxBenefit: 1751 },
  { code: "MEDICAID", name: "Medical Assistance", maxBenefit: 0 },
  { code: "TANF", name: "Temporary Cash Assistance", maxBenefit: 727 },
  { code: "OHEP", name: "Office of Home Energy Programs", maxBenefit: 2000 },
  { code: "WIC", name: "Women, Infants, and Children", maxBenefit: 234 },
  { code: "LIHEAP", name: "Low Income Home Energy Assistance", maxBenefit: 1800 },
];

interface GenerationStats {
  individuals: number;
  cases: number;
  contacts: number;
  addresses: number;
  identifications: number;
  programEnrollments: number;
  caseClosures: number;
  caseMembers: number;
  crossEnrollmentOpportunities: number;
  churnCases: number;
}

function randomDate(start: Date, end: Date): string {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSSN(): string {
  const area = String(Math.floor(Math.random() * 899) + 100);
  const group = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
  const serial = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `${area}-${group}-${serial}`;
}

function randomPhone(): string {
  const areaCode = String(Math.floor(Math.random() * 800) + 200);
  const exchange = String(Math.floor(Math.random() * 900) + 100);
  const subscriber = String(Math.floor(Math.random() * 9000) + 1000);
  return `(${areaCode}) ${exchange}-${subscriber}`;
}

function randomZipCode(): string {
  const marylandZips = [
    "20601", "20603", "20705", "20706", "20707", "20708", "20710", "20711",
    "20715", "20716", "20720", "20721", "20722", "20724", "20725", "20731",
    "20740", "20742", "20744", "20745", "20746", "20747", "20748", "20751",
    "20770", "20772", "20774", "20781", "20782", "20783", "20784", "20785",
    "21001", "21012", "21030", "21031", "21040", "21043", "21044", "21045",
    "21046", "21050", "21071", "21075", "21076", "21077", "21090", "21093",
    "21104", "21111", "21117", "21128", "21131", "21133", "21136", "21152",
    "21157", "21162", "21201", "21202", "21204", "21205", "21206", "21207",
    "21208", "21209", "21210", "21211", "21212", "21213", "21214", "21215",
    "21216", "21217", "21218", "21222", "21224", "21225", "21227", "21228",
    "21229", "21230", "21231", "21234", "21236", "21237", "21239", "21244",
  ];
  return randomElement(marylandZips);
}

function generateIndividualId(): string {
  return `IND${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

function generateCaseNumber(): string {
  return `MD${Math.floor(Math.random() * 900000000) + 100000000}`;
}

function generateMaId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `${randomElement(letters.split(''))}${randomElement(letters.split(''))}${Math.floor(Math.random() * 90000000) + 10000000}`;
}

function generateIRN(): string {
  return `${Math.floor(Math.random() * 900000000) + 100000000}`.substring(0, 9);
}

export async function generateSyntheticData(
  targetIndividuals: number = 500,
  options: {
    churnRate?: number;
    crossEnrollmentOpportunityRate?: number;
    averageHouseholdSize?: number;
    activeEnrollmentRate?: number;
  } = {}
): Promise<GenerationStats> {
  const {
    churnRate = 0.20,
    crossEnrollmentOpportunityRate = 0.35,
    averageHouseholdSize = 2.5,
    activeEnrollmentRate = 0.75,
  } = options;

  const stats: GenerationStats = {
    individuals: 0,
    cases: 0,
    contacts: 0,
    addresses: 0,
    identifications: 0,
    programEnrollments: 0,
    caseClosures: 0,
    caseMembers: 0,
    crossEnrollmentOpportunities: 0,
    churnCases: 0,
  };

  const ldssOffices = MARYLAND_LDSS_OFFICES;

  const targetCases = Math.floor(targetIndividuals / averageHouseholdSize);
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  for (let caseIdx = 0; caseIdx < targetCases; caseIdx++) {
    const householdSize = Math.max(1, Math.floor(Math.random() * 5) + 1);
    const ldss = randomElement(ldssOffices);
    const county = randomElement(MARYLAND_COUNTIES);
    const caseNumber = generateCaseNumber();
    const caseEffectiveBegin = randomDate(twoYearsAgo, oneYearAgo);
    const isActiveCase = Math.random() < activeEnrollmentRate;
    const isChurnCase = !isActiveCase && Math.random() < (churnRate / (1 - activeEnrollmentRate));
    
    if (isChurnCase) stats.churnCases++;

    const monthlyIncome = Math.floor(Math.random() * 4000) + 500;
    const monthlyExpenses = Math.floor(monthlyIncome * (0.6 + Math.random() * 0.3));

    let hohIndividualId = "";
    const householdMembers: string[] = [];

    for (let memberIdx = 0; memberIdx < householdSize; memberIdx++) {
      const isHoh = memberIdx === 0;
      const individualId = generateIndividualId();
      if (isHoh) hohIndividualId = individualId;
      householdMembers.push(individualId);

      const gender = Math.random() > 0.5 ? "M" : "F";
      const age = isHoh 
        ? Math.floor(Math.random() * 50) + 18 
        : Math.floor(Math.random() * 70) + 1;
      const dob = new Date(now.getFullYear() - age, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);

      await db.insert(eeSyntheticIndividuals).values({
        individualId,
        mdmId: `MDM${individualId}`,
        sourceSystem: "E&E",
        ssn: randomSSN(),
        dateOfBirth: dob.toISOString().split('T')[0],
        birthStateCode: "MD",
        birthState: "Maryland",
        genderCode: gender,
        gender: gender === "M" ? "Male" : "Female",
        raceCode: randomElement(["01", "02", "03", "04", "05"]),
        race: randomElement(["White", "Black or African American", "Asian", "Hispanic or Latino", "Other"]),
        ethnicityCode: randomElement(["H", "N"]),
        ethnicity: randomElement(["Hispanic or Latino", "Not Hispanic or Latino"]),
        citizenshipStatusCode: "CIT",
        citizenship: "US Citizen",
        maritalStatusInd: isHoh ? randomElement(["S", "M", "D", "W"]) : "S",
        maritalStatus: isHoh ? randomElement(["Single", "Married", "Divorced", "Widowed"]) : "Single",
        preferredLanguageCode: randomElement(["EN", "ES", "ZH", "VI", "KO"]),
        preferredLanguage: randomElement(["English", "Spanish", "Chinese", "Vietnamese", "Korean"]),
        firstName: randomElement(FIRST_NAMES),
        lastName: randomElement(LAST_NAMES),
        middleName: Math.random() > 0.3 ? randomElement(FIRST_NAMES) : null,
        effectiveBeginDate: caseEffectiveBegin,
        ssnVerificationIndicator: Math.random() > 0.1,
        ssnVerificationSource: "SSA",
      });
      stats.individuals++;

      await db.insert(eeSyntheticContacts).values({
        individualId,
        caseNumber,
        contactType: "personal",
        phoneNumber: randomPhone(),
        phoneType: randomElement(["Mobile", "Home", "Work"]),
        email: Math.random() > 0.3 ? `${individualId.toLowerCase()}@example.com` : null,
        effectiveBeginDate: caseEffectiveBegin,
      });
      stats.contacts++;

      await db.insert(eeSyntheticAddresses).values({
        individualId,
        caseNumber,
        addressType: "residential",
        addressLine1: `${Math.floor(Math.random() * 9999) + 1} ${randomElement(STREET_NAMES)} ${randomElement(STREET_TYPES)}`,
        city: randomElement(MARYLAND_CITIES),
        countyCode: county.code,
        county: county.name,
        stateCode: "MD",
        state: "Maryland",
        zipCode: randomZipCode(),
        effectiveBeginDate: caseEffectiveBegin,
      });
      stats.addresses++;

      await db.insert(eeSyntheticIdentification).values({
        individualId,
        mdmId: `MDM${individualId}`,
        irn: generateIRN(),
        maId: generateMaId(),
      });
      stats.identifications++;

      const relationship = isHoh ? "Self" : randomElement(["Spouse", "Child", "Parent", "Sibling", "Other"]);
      await db.insert(eeSyntheticCaseMembers).values({
        caseNumber,
        individualId,
        relationshipToHoh: relationship,
        isHoh,
        isApplicant: isHoh,
        memberStatusCode: isActiveCase ? "ACT" : "INA",
        memberStatus: isActiveCase ? "Active" : "Inactive",
        effectiveBeginDate: caseEffectiveBegin,
      });
      stats.caseMembers++;
    }

    await db.insert(eeSyntheticCases).values({
      caseNumber,
      hohIndividualId,
      hohIndicator: true,
      caseStatusCode: isActiveCase ? "ACT" : "CLO",
      caseStatus: isActiveCase ? "Active" : "Closed",
      caseModeCode: randomElement(["REG", "EXP"]),
      caseMode: randomElement(["Regular", "Expedited"]),
      effectiveBeginDate: caseEffectiveBegin,
      effectiveEndDate: !isActiveCase ? randomDate(oneYearAgo, now) : null,
      ldssCode: ldss.ldssCode,
      districtOffice: ldss.name,
      householdSize,
      monthlyIncome,
      monthlyExpenses,
    });
    stats.cases++;

    const enrolledPrograms: string[] = [];
    const potentialPrograms = [...PROGRAMS];
    const numPrograms = Math.floor(Math.random() * 3) + 1;

    for (let p = 0; p < numPrograms && potentialPrograms.length > 0; p++) {
      const programIndex = Math.floor(Math.random() * potentialPrograms.length);
      const program = potentialPrograms.splice(programIndex, 1)[0];
      enrolledPrograms.push(program.code);

      const certEnd = new Date(now);
      certEnd.setMonth(certEnd.getMonth() + Math.floor(Math.random() * 12) + 1);
      const redetDue = new Date(certEnd);
      redetDue.setDate(redetDue.getDate() - 30);

      const benefitAmount = program.maxBenefit > 0 
        ? Math.floor(Math.random() * program.maxBenefit * 0.8) + Math.floor(program.maxBenefit * 0.2)
        : 0;

      await db.insert(eeSyntheticProgramEnrollments).values({
        individualId: hohIndividualId,
        caseNumber,
        programCode: program.code,
        programName: program.name,
        programStatusCode: isActiveCase ? "ACT" : "CLO",
        programStatus: isActiveCase ? "Active" : "Closed",
        effectiveBeginDate: caseEffectiveBegin,
        effectiveEndDate: !isActiveCase ? randomDate(oneYearAgo, now) : null,
        ldssCode: ldss.ldssCode,
        districtOffice: ldss.name,
        worker: `Worker_${Math.floor(Math.random() * 100)}`,
        supervisor: `Supervisor_${Math.floor(Math.random() * 20)}`,
        monthlyBenefitAmount: benefitAmount,
        certificationPeriodEnd: certEnd.toISOString().split('T')[0],
        redeterminationDue: redetDue.toISOString().split('T')[0],
      });
      stats.programEnrollments++;
    }

    if (Math.random() < crossEnrollmentOpportunityRate && potentialPrograms.length > 0) {
      stats.crossEnrollmentOpportunities++;
    }

    if (!isActiveCase) {
      const selectedClosure = randomElement(CLOSURE_REASONS);

      const closureDate = randomDate(oneYearAgo, now);
      const fiscalDate = new Date(closureDate);
      const fiscalMonth = `${fiscalDate.getFullYear()}-${String(fiscalDate.getMonth() + 1).padStart(2, '0')}`;

      for (const programCode of enrolledPrograms) {
        await db.insert(eeSyntheticCaseClosures).values({
          caseNumber,
          programCode,
          closureDate,
          closureReasonCode: selectedClosure.code,
          closureReason: selectedClosure.reason,
          closureCategory: selectedClosure.category,
          ldssCode: ldss.ldssCode,
          regionCode: ldss.regionCode,
          fiscalMonth,
          wasChurn: isChurnCase,
          daysUntilReopen: isChurnCase ? Math.floor(Math.random() * 30) + 1 : null,
        });
        stats.caseClosures++;
      }
    }
  }

  return stats;
}

export async function clearSyntheticData(): Promise<void> {
  await db.delete(eeSyntheticCaseClosures);
  await db.delete(eeSyntheticProgramEnrollments);
  await db.delete(eeSyntheticCaseMembers);
  await db.delete(eeSyntheticProviders);
  await db.delete(eeSyntheticIdentification);
  await db.delete(eeSyntheticAddresses);
  await db.delete(eeSyntheticContacts);
  await db.delete(eeSyntheticCases);
  await db.delete(eeSyntheticIndividuals);
}

export async function getSyntheticDataStats(): Promise<{
  totalIndividuals: number;
  totalCases: number;
  activeCases: number;
  closedCases: number;
  churnCases: number;
  programEnrollments: { [key: string]: number };
  closureReasons: { [key: string]: number };
  ldssDistribution: { [key: string]: number };
}> {
  const individuals = await db.select().from(eeSyntheticIndividuals);
  const cases = await db.select().from(eeSyntheticCases);
  const enrollments = await db.select().from(eeSyntheticProgramEnrollments);
  const closures = await db.select().from(eeSyntheticCaseClosures);

  const activeCases = cases.filter(c => c.caseStatus === "Active").length;
  const closedCases = cases.filter(c => c.caseStatus === "Closed").length;
  const churnCases = closures.filter(c => c.wasChurn).length;

  const programEnrollments: { [key: string]: number } = {};
  for (const e of enrollments) {
    programEnrollments[e.programCode] = (programEnrollments[e.programCode] || 0) + 1;
  }

  const closureReasons: { [key: string]: number } = {};
  for (const c of closures) {
    const reason = c.closureReason || "Unknown";
    closureReasons[reason] = (closureReasons[reason] || 0) + 1;
  }

  const ldssDistribution: { [key: string]: number } = {};
  for (const c of cases) {
    const ldss = c.districtOffice || "Unknown";
    ldssDistribution[ldss] = (ldssDistribution[ldss] || 0) + 1;
  }

  return {
    totalIndividuals: individuals.length,
    totalCases: cases.length,
    activeCases,
    closedCases,
    churnCases,
    programEnrollments,
    closureReasons,
    ldssDistribution,
  };
}

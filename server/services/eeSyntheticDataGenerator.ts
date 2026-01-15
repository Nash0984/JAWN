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
  eeSyntheticIncome,
  eeSyntheticResources,
  eeSyntheticExpenses,
  eeSyntheticVerifications,
  eeSyntheticAbawd,
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

const EMPLOYERS = [
  { name: "Walmart", fein: "71-0415188" },
  { name: "Amazon Fulfillment", fein: "91-1646860" },
  { name: "McDonald's", fein: "36-2361282" },
  { name: "Johns Hopkins Hospital", fein: "52-0591656" },
  { name: "Giant Food", fein: "52-0762893" },
  { name: "Marriott International", fein: "52-2055918" },
  { name: "Home Depot", fein: "95-3261426" },
  { name: "Target", fein: "41-0215170" },
  { name: "Safeway", fein: "94-2588976" },
  { name: "University of Maryland", fein: "52-6002033" },
];

const JOB_TITLES = [
  "Cashier", "Sales Associate", "Warehouse Worker", "Food Service Worker",
  "Home Health Aide", "Janitor", "Security Guard", "Stock Clerk",
  "Customer Service Rep", "Administrative Assistant", "Driver", "Cook"
];

const INCOME_TYPES = [
  { code: "EMP", type: "Employment", source: "wages" },
  { code: "SEL", type: "Self-Employment", source: "business" },
  { code: "SSI", type: "SSI", source: "ssa" },
  { code: "SSA", type: "Social Security", source: "ssa" },
  { code: "UNE", type: "Unemployment", source: "dol" },
  { code: "CHI", type: "Child Support", source: "cse" },
  { code: "PEN", type: "Pension", source: "retirement" },
  { code: "REN", type: "Rental Income", source: "property" },
];

const RESOURCE_TYPES = [
  { code: "CHK", type: "Checking Account", countable: true },
  { code: "SAV", type: "Savings Account", countable: true },
  { code: "VEH", type: "Vehicle", countable: true },
  { code: "PRO", type: "Real Property", countable: false },
  { code: "RET", type: "Retirement Account", countable: false },
  { code: "LIF", type: "Life Insurance", countable: true },
  { code: "STK", type: "Stocks/Bonds", countable: true },
];

const EXPENSE_TYPES = [
  { code: "RNT", type: "Rent/Mortgage", category: "shelter" },
  { code: "UTL", type: "Utilities", category: "shelter" },
  { code: "MED", type: "Medical Expenses", category: "medical" },
  { code: "CHC", type: "Childcare", category: "dependent_care" },
  { code: "CSO", type: "Child Support Obligation", category: "support" },
  { code: "TAX", type: "Property Taxes", category: "shelter" },
  { code: "INS", type: "Insurance", category: "shelter" },
];

const VERIFICATION_TYPES = [
  { code: "SSN", type: "SSN Verification", category: "identity" },
  { code: "IDT", type: "Identity Verification", category: "identity" },
  { code: "CIT", type: "Citizenship Verification", category: "identity" },
  { code: "INC", type: "Income Verification", category: "financial" },
  { code: "RES", type: "Residency Verification", category: "address" },
  { code: "EXP", type: "Expense Verification", category: "financial" },
  { code: "AST", type: "Asset Verification", category: "financial" },
];

const ABAWD_EXEMPTIONS = [
  { code: "DIS", reason: "Physical or Mental Disability" },
  { code: "PRE", reason: "Pregnant" },
  { code: "CAR", reason: "Caring for Incapacitated Household Member" },
  { code: "CHI", reason: "Caring for Child Under 6" },
  { code: "STU", reason: "Student Enrolled Half-Time" },
  { code: "WRK", reason: "Working 20+ Hours/Week" },
  { code: "TRN", reason: "In Approved Training Program" },
];

const SHELTERS = [
  { name: "Baltimore Rescue Mission", phone: "(410) 342-2533" },
  { name: "Our Daily Bread Employment Center", phone: "(410) 659-4000" },
  { name: "Sarah's Hope", phone: "(410) 234-0950" },
  { name: "Helping Up Mission", phone: "(410) 675-7500" },
  { name: "Project PLASE", phone: "(410) 837-1400" },
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
  incomeRecords: number;
  resourceRecords: number;
  expenseRecords: number;
  verificationRecords: number;
  abawdRecords: number;
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

function generateFEIN(): string {
  return `${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 9000000) + 1000000}`;
}

function generateAccountNumber(): string {
  return `****${Math.floor(Math.random() * 9000) + 1000}`;
}

export async function generateSyntheticData(
  targetIndividuals: number = 500,
  options: {
    churnRate?: number;
    crossEnrollmentOpportunityRate?: number;
    averageHouseholdSize?: number;
    activeEnrollmentRate?: number;
    homelessRate?: number;
    abawdRate?: number;
  } = {}
): Promise<GenerationStats> {
  const {
    churnRate = 0.20,
    crossEnrollmentOpportunityRate = 0.35,
    averageHouseholdSize = 2.5,
    activeEnrollmentRate = 0.75,
    homelessRate = 0.05,
    abawdRate = 0.15,
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
    incomeRecords: 0,
    resourceRecords: 0,
    expenseRecords: 0,
    verificationRecords: 0,
    abawdRecords: 0,
    crossEnrollmentOpportunities: 0,
    churnCases: 0,
  };

  const ldssOffices = MARYLAND_LDSS_OFFICES;

  const targetCases = Math.floor(targetIndividuals / averageHouseholdSize);
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());

  for (let caseIdx = 0; caseIdx < targetCases; caseIdx++) {
    const householdSize = Math.max(1, Math.floor(Math.random() * 5) + 1);
    const ldss = randomElement(ldssOffices);
    const county = randomElement(MARYLAND_COUNTIES);
    const caseNumber = generateCaseNumber();
    const caseEffectiveBegin = randomDate(twoYearsAgo, oneYearAgo);
    const isActiveCase = Math.random() < activeEnrollmentRate;
    const isChurnCase = !isActiveCase && Math.random() < (churnRate / (1 - activeEnrollmentRate));
    const isHomeless = Math.random() < homelessRate;
    
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
      const isAbawd = isHoh && age >= 18 && age < 50 && Math.random() < abawdRate;

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
        hearingImpairedIndicator: Math.random() < 0.02,
        domesticViolenceInd: Math.random() < 0.03,
      });
      stats.individuals++;

      const employer = randomElement(EMPLOYERS);
      const hasEmployer = age >= 16 && Math.random() > 0.4;
      
      await db.insert(eeSyntheticContacts).values({
        individualId,
        caseNumber,
        contactType: "personal",
        phoneNumber: randomPhone(),
        phoneNumberTypeCode: randomElement(["MOB", "HOM", "WRK"]),
        phoneType: randomElement(["Mobile", "Home", "Work"]),
        altPhoneNumber: Math.random() > 0.5 ? randomPhone() : null,
        altPhoneType: Math.random() > 0.5 ? randomElement(["Mobile", "Home", "Work"]) : null,
        email: Math.random() > 0.3 ? `${individualId.toLowerCase()}@example.com` : null,
        emailVerified: Math.random() > 0.5,
        textMessageOptIn: Math.random() > 0.3,
        commModeCode: randomElement(["PHN", "EML", "MAL"]),
        communicationMode: randomElement(["Phone", "Email", "Mail"]),
        commPrefTimeCode: randomElement(["MOR", "AFT", "EVE"]),
        commPrefTime: randomElement(["Morning", "Afternoon", "Evening"]),
        employerName: hasEmployer ? employer.name : null,
        employerFein: hasEmployer ? employer.fein : null,
        employerCity: hasEmployer ? randomElement(MARYLAND_CITIES) : null,
        employerStateCode: hasEmployer ? "MD" : null,
        employerPhone: hasEmployer ? randomPhone() : null,
        emergencyContactName: Math.random() > 0.5 ? `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)}` : null,
        emergencyContactRelationship: Math.random() > 0.5 ? randomElement(["Parent", "Sibling", "Friend", "Spouse"]) : null,
        emergencyContactPhone: Math.random() > 0.5 ? randomPhone() : null,
        authorizedRepName: Math.random() > 0.8 ? `${randomElement(FIRST_NAMES)} ${randomElement(LAST_NAMES)}` : null,
        authorizedRepTypeCode: Math.random() > 0.8 ? randomElement(["FUL", "LIM"]) : null,
        authorizedRepType: Math.random() > 0.8 ? randomElement(["Full Authority", "Limited Authority"]) : null,
        effectiveBeginDate: caseEffectiveBegin,
      });
      stats.contacts++;

      const shelter = isHomeless ? randomElement(SHELTERS) : null;
      await db.insert(eeSyntheticAddresses).values({
        individualId,
        caseNumber,
        addressType: isHomeless ? "homeless" : "residential",
        addressLine1: isHomeless ? null : `${Math.floor(Math.random() * 9999) + 1} ${randomElement(STREET_NAMES)} ${randomElement(STREET_TYPES)}`,
        city: randomElement(MARYLAND_CITIES),
        countyCode: county.code,
        county: county.name,
        stateCode: "MD",
        state: "Maryland",
        zipCode: randomZipCode(),
        countryCode: "USA",
        country: "United States",
        homelessIndicator: isHomeless,
        homelessTypeCode: isHomeless ? randomElement(["SHL", "STR", "TEM"]) : null,
        homelessType: isHomeless ? randomElement(["Shelter", "Street", "Temporary Housing"]) : null,
        shelterName: shelter?.name,
        shelterPhone: shelter?.phone,
        addressVerificationCode: Math.random() > 0.2 ? "VER" : "PND",
        addressVerificationStatus: Math.random() > 0.2 ? "Verified" : "Pending",
        addressVerificationDate: Math.random() > 0.2 ? randomDate(oneYearAgo, now) : null,
        addressVerificationSource: Math.random() > 0.2 ? randomElement(["USPS", "Utility Bill", "Lease"]) : null,
        residencyStartDate: caseEffectiveBegin,
        ldssServiceAreaCode: ldss.ldssCode,
        ldssServiceArea: ldss.name,
        congressionalDistrict: `MD-${Math.floor(Math.random() * 8) + 1}`,
        legislativeDistrict: `${Math.floor(Math.random() * 47) + 1}`,
        isPrimaryResidence: true,
        isMailingAddress: true,
        effectiveBeginDate: caseEffectiveBegin,
      });
      stats.addresses++;

      await db.insert(eeSyntheticIdentification).values({
        individualId,
        mdmId: `MDM${individualId}`,
        irn: generateIRN(),
        maId: generateMaId(),
        pin: `${Math.floor(Math.random() * 9000) + 1000}`,
        passportNumber: Math.random() > 0.9 ? `${Math.floor(Math.random() * 900000000) + 100000000}` : null,
        alienNumber: Math.random() > 0.95 ? `A${Math.floor(Math.random() * 90000000) + 10000000}` : null,
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

      if (age >= 16 && Math.random() > 0.3) {
        const incomeType = randomElement(INCOME_TYPES);
        const isEmployed = incomeType.code === "EMP";
        const hourlyWage = Math.floor(Math.random() * 15) + 10;
        const hoursPerWeek = Math.floor(Math.random() * 30) + 10;
        const weeklyGross = hourlyWage * hoursPerWeek;
        const monthlyGross = weeklyGross * 4.33;
        
        await db.insert(eeSyntheticIncome).values({
          individualId,
          caseNumber,
          incomeTypeCode: incomeType.code,
          incomeType: incomeType.type,
          incomeSourceCode: incomeType.source,
          incomeSource: incomeType.source,
          employerName: isEmployed ? randomElement(EMPLOYERS).name : null,
          employerFein: isEmployed ? generateFEIN() : null,
          employerCity: isEmployed ? randomElement(MARYLAND_CITIES) : null,
          employerStateCode: isEmployed ? "MD" : null,
          employerPhone: isEmployed ? randomPhone() : null,
          jobTitle: isEmployed ? randomElement(JOB_TITLES) : null,
          employmentStatusCode: isEmployed ? randomElement(["FT", "PT", "SEA"]) : null,
          employmentStatus: isEmployed ? randomElement(["Full-Time", "Part-Time", "Seasonal"]) : null,
          hoursPerWeek: isEmployed ? hoursPerWeek : null,
          payFrequencyCode: isEmployed ? randomElement(["WK", "BW", "SM", "MO"]) : null,
          payFrequency: isEmployed ? randomElement(["Weekly", "Bi-Weekly", "Semi-Monthly", "Monthly"]) : null,
          grossAmount: Math.floor(weeklyGross * 100),
          monthlyGross: Math.floor(monthlyGross * 100),
          monthlyNet: Math.floor(monthlyGross * 0.75 * 100),
          annualGross: Math.floor(monthlyGross * 12 * 100),
          selfEmploymentIndicator: incomeType.code === "SEL",
          seasonalIndicator: Math.random() < 0.1,
          variableIncomeIndicator: Math.random() < 0.2,
          verificationStatusCode: randomElement(["VER", "PND", "UNV"]),
          verificationStatus: randomElement(["Verified", "Pending", "Unverified"]),
          verificationDate: randomDate(threeMonthsAgo, now),
          verificationSource: randomElement(["Pay Stub", "Employer Statement", "Tax Return", "NDNH"]),
          ndnhVerified: Math.random() > 0.5,
          swicaVerified: Math.random() > 0.7,
          startDate: randomDate(twoYearsAgo, oneYearAgo),
          effectiveBeginDate: caseEffectiveBegin,
        });
        stats.incomeRecords++;
      }

      if (isHoh && Math.random() > 0.5) {
        const resourceType = randomElement(RESOURCE_TYPES);
        const value = Math.floor(Math.random() * 5000) + 100;
        
        await db.insert(eeSyntheticResources).values({
          individualId,
          caseNumber,
          resourceTypeCode: resourceType.code,
          resourceType: resourceType.type,
          resourceDescription: `${resourceType.type} - ${randomElement(["Primary", "Secondary", "Joint"])}`,
          accountNumber: resourceType.code === "CHK" || resourceType.code === "SAV" ? generateAccountNumber() : null,
          institutionName: resourceType.code === "CHK" || resourceType.code === "SAV" ? randomElement(["Bank of America", "Wells Fargo", "PNC Bank", "M&T Bank", "TD Bank"]) : null,
          currentValue: value * 100,
          fairMarketValue: value * 100,
          countableValue: resourceType.countable ? value * 100 : 0,
          ownershipTypeCode: randomElement(["SOL", "JNT"]),
          ownershipType: randomElement(["Sole Owner", "Joint Owner"]),
          ownershipPercentage: randomElement([100, 50, 33]),
          isCountable: resourceType.countable,
          isExempt: !resourceType.countable,
          exemptionReasonCode: !resourceType.countable ? randomElement(["RET", "HOM", "BUS"]) : null,
          exemptionReason: !resourceType.countable ? randomElement(["Retirement Account", "Homestead", "Business Asset"]) : null,
          vehicleYear: resourceType.code === "VEH" ? String(2010 + Math.floor(Math.random() * 14)) : null,
          vehicleMake: resourceType.code === "VEH" ? randomElement(["Toyota", "Honda", "Ford", "Chevrolet", "Nissan"]) : null,
          vehicleModel: resourceType.code === "VEH" ? randomElement(["Camry", "Civic", "F-150", "Malibu", "Altima"]) : null,
          vehicleUseCode: resourceType.code === "VEH" ? randomElement(["WRK", "PER", "MED"]) : null,
          vehicleUse: resourceType.code === "VEH" ? randomElement(["Work", "Personal", "Medical Transport"]) : null,
          verificationStatusCode: randomElement(["VER", "PND"]),
          verificationStatus: randomElement(["Verified", "Pending"]),
          verificationDate: randomDate(threeMonthsAgo, now),
          verificationSource: randomElement(["Bank Statement", "DMV Record", "Account Printout"]),
          effectiveBeginDate: caseEffectiveBegin,
        });
        stats.resourceRecords++;
      }

      if (isHoh) {
        const numExpenses = Math.floor(Math.random() * 3) + 1;
        for (let e = 0; e < numExpenses; e++) {
          const expenseType = randomElement(EXPENSE_TYPES);
          const amount = Math.floor(Math.random() * 1500) + 200;
          
          await db.insert(eeSyntheticExpenses).values({
            individualId,
            caseNumber,
            expenseTypeCode: expenseType.code,
            expenseType: expenseType.type,
            expenseCategoryCode: expenseType.category,
            expenseCategory: expenseType.category,
            payeeName: randomElement(["Landlord", "BGE", "PEPCO", "WSSC", "Verizon", "Comcast"]),
            monthlyAmount: amount * 100,
            annualAmount: amount * 12 * 100,
            frequencyCode: "MO",
            frequency: "Monthly",
            actualAmount: amount * 100,
            standardUtilityAllowanceCode: expenseType.code === "UTL" ? randomElement(["HUA", "LUA", "TEL"]) : null,
            standardUtilityAllowance: expenseType.code === "UTL" ? randomElement(["Heating/Cooling", "Limited", "Telephone"]) : null,
            rentMortgageAmount: expenseType.code === "RNT" ? amount * 100 : null,
            heatingFuelType: expenseType.code === "UTL" ? randomElement(["Electric", "Gas", "Oil", "Propane"]) : null,
            electricIndicator: expenseType.code === "UTL" && Math.random() > 0.3,
            gasIndicator: expenseType.code === "UTL" && Math.random() > 0.5,
            waterSewerIndicator: expenseType.code === "UTL" && Math.random() > 0.5,
            phoneIndicator: expenseType.code === "UTL" && Math.random() > 0.7,
            verificationStatusCode: randomElement(["VER", "PND", "UNV"]),
            verificationStatus: randomElement(["Verified", "Pending", "Unverified"]),
            verificationDate: randomDate(threeMonthsAgo, now),
            verificationSource: randomElement(["Bill", "Lease", "Statement"]),
            effectiveBeginDate: caseEffectiveBegin,
          });
          stats.expenseRecords++;
        }
      }

      const numVerifications = Math.floor(Math.random() * 3) + 1;
      for (let v = 0; v < numVerifications; v++) {
        const verificationType = randomElement(VERIFICATION_TYPES);
        const isPending = Math.random() < 0.15;
        
        await db.insert(eeSyntheticVerifications).values({
          individualId,
          caseNumber,
          verificationTypeCode: verificationType.code,
          verificationType: verificationType.type,
          verificationCategoryCode: verificationType.category,
          verificationCategory: verificationType.category,
          documentTypeCode: randomElement(["DL", "BC", "PP", "SS", "WS"]),
          documentType: randomElement(["Driver's License", "Birth Certificate", "Passport", "Social Security Card", "W-2"]),
          verificationStatusCode: isPending ? "PND" : "VER",
          verificationStatus: isPending ? "Pending" : "Verified",
          verificationDate: isPending ? null : randomDate(threeMonthsAgo, now),
          verifiedBy: isPending ? null : `Worker_${Math.floor(Math.random() * 100)}`,
          verificationMethod: randomElement(["In-Person", "Electronic", "Mail"]),
          verificationSource: randomElement(["SSA", "DMV", "USCIS", "Client Provided"]),
          electronicVerificationCode: Math.random() > 0.5 ? randomElement(["SSA", "DHS", "IRS"]) : null,
          wasPending: isPending,
          pendingReasonCode: isPending ? randomElement(["NDR", "EXP", "INC"]) : null,
          pendingReason: isPending ? randomElement(["Not Received", "Expired", "Incomplete"]) : null,
          dueDate: isPending ? randomDate(now, new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())) : null,
          effectiveBeginDate: caseEffectiveBegin,
        });
        stats.verificationRecords++;
      }

      if (isAbawd) {
        const isExempt = Math.random() > 0.6;
        const exemption = isExempt ? randomElement(ABAWD_EXEMPTIONS) : null;
        
        await db.insert(eeSyntheticAbawd).values({
          individualId,
          caseNumber,
          abawdStatusCode: isExempt ? "EXM" : randomElement(["MET", "CNT", "LIM"]),
          abawdStatus: isExempt ? "Exempt" : randomElement(["Meeting Requirements", "Counting Months", "Time Limited"]),
          isAbawd: true,
          isExempt,
          exemptionReasonCode: exemption?.code,
          exemptionReason: exemption?.reason,
          exemptionStartDate: isExempt ? randomDate(oneYearAgo, now) : null,
          workRequirementMonthsUsed: isExempt ? 0 : Math.floor(Math.random() * 3),
          workRequirementMonthsRemaining: isExempt ? null : 3 - Math.floor(Math.random() * 3),
          countableMonthsIn36: isExempt ? 0 : Math.floor(Math.random() * 3),
          workHoursPerWeek: !isExempt ? Math.floor(Math.random() * 20) + 5 : null,
          workProgramCode: !isExempt && Math.random() > 0.5 ? randomElement(["SNAP_ET", "WIOA", "VOL"]) : null,
          workProgram: !isExempt && Math.random() > 0.5 ? randomElement(["SNAP E&T", "WIOA Training", "Volunteer"]) : null,
          workProgramStatusCode: !isExempt ? randomElement(["ENR", "COM", "DRP"]) : null,
          workProgramStatus: !isExempt ? randomElement(["Enrolled", "Completed", "Dropped"]) : null,
          sanctionIndicator: !isExempt && Math.random() < 0.1,
          waiverCountyIndicator: Math.random() < 0.2,
          effectiveBeginDate: caseEffectiveBegin,
        });
        stats.abawdRecords++;
      }
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
  await db.delete(eeSyntheticAbawd);
  await db.delete(eeSyntheticVerifications);
  await db.delete(eeSyntheticExpenses);
  await db.delete(eeSyntheticResources);
  await db.delete(eeSyntheticIncome);
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
  incomeRecords: number;
  resourceRecords: number;
  expenseRecords: number;
  verificationRecords: number;
  abawdRecords: number;
  homelessIndividuals: number;
  programEnrollments: { [key: string]: number };
  closureReasons: { [key: string]: number };
  ldssDistribution: { [key: string]: number };
  incomeTypeDistribution: { [key: string]: number };
  verificationStatusDistribution: { [key: string]: number };
}> {
  const individuals = await db.select().from(eeSyntheticIndividuals);
  const cases = await db.select().from(eeSyntheticCases);
  const enrollments = await db.select().from(eeSyntheticProgramEnrollments);
  const closures = await db.select().from(eeSyntheticCaseClosures);
  const incomes = await db.select().from(eeSyntheticIncome);
  const resources = await db.select().from(eeSyntheticResources);
  const expenses = await db.select().from(eeSyntheticExpenses);
  const verifications = await db.select().from(eeSyntheticVerifications);
  const abawdRecords = await db.select().from(eeSyntheticAbawd);
  const addresses = await db.select().from(eeSyntheticAddresses);

  const activeCases = cases.filter(c => c.caseStatus === "Active").length;
  const closedCases = cases.filter(c => c.caseStatus === "Closed").length;
  const churnCases = closures.filter(c => c.wasChurn).length;
  const homelessIndividuals = addresses.filter(a => a.homelessIndicator).length;

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

  const incomeTypeDistribution: { [key: string]: number } = {};
  for (const i of incomes) {
    const type = i.incomeType || "Unknown";
    incomeTypeDistribution[type] = (incomeTypeDistribution[type] || 0) + 1;
  }

  const verificationStatusDistribution: { [key: string]: number } = {};
  for (const v of verifications) {
    const status = v.verificationStatus || "Unknown";
    verificationStatusDistribution[status] = (verificationStatusDistribution[status] || 0) + 1;
  }

  return {
    totalIndividuals: individuals.length,
    totalCases: cases.length,
    activeCases,
    closedCases,
    churnCases,
    incomeRecords: incomes.length,
    resourceRecords: resources.length,
    expenseRecords: expenses.length,
    verificationRecords: verifications.length,
    abawdRecords: abawdRecords.length,
    homelessIndividuals,
    programEnrollments,
    closureReasons,
    ldssDistribution,
    incomeTypeDistribution,
    verificationStatusDistribution,
  };
}

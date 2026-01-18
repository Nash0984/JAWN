import type { InsertPolicySource } from "@shared/schema";
import { logger } from "../services/logger.service";

/**
 * 50-State SNAP Policy Registry
 * 
 * This module provides a comprehensive registry of SNAP policy manual URLs
 * for all 50 states, District of Columbia, and U.S. territories.
 * 
 * Data is derived from official state agency sources and includes:
 * - State code and name
 * - State agency name
 * - Program branding (e.g., CalFresh, FoodShare)
 * - Direct policy manual URL
 * - Administrative model (state, county, or hybrid)
 * 
 * These sources enable the Living Policy Manual and RAG pipeline to
 * ingest and index state-specific SNAP policies for national scalability.
 */

export type AdminModel = "state" | "county" | "hybrid";

export interface StatePolicySource {
  stateCode: string;
  stateName: string;
  agencyName: string;
  agencyAbbreviation: string;
  programBrand: string;
  policyManualUrl: string;
  policyManualCitation: string;
  adminModel: AdminModel;
  notes?: string;
  isActive: boolean;
}

// All 50 States + DC + Territories
export const SNAP_POLICY_SOURCES: StatePolicySource[] = [
  // Alabama
  {
    stateCode: "AL",
    stateName: "Alabama",
    agencyName: "Alabama Department of Human Resources",
    agencyAbbreviation: "DHR",
    programBrand: "SNAP",
    policyManualUrl: "https://dhr.alabama.gov/food-assistance/",
    policyManualCitation: "Alabama DHR Food Assistance Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Alaska
  {
    stateCode: "AK",
    stateName: "Alaska",
    agencyName: "Alaska Department of Health",
    agencyAbbreviation: "DOH",
    programBrand: "SNAP",
    policyManualUrl: "https://health.alaska.gov/dpa/Pages/snap/default.aspx",
    policyManualCitation: "Alaska SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Arizona
  {
    stateCode: "AZ",
    stateName: "Arizona",
    agencyName: "Arizona Department of Economic Security",
    agencyAbbreviation: "DES",
    programBrand: "SNAP",
    policyManualUrl: "https://des.az.gov/services/basic-needs/food-assistance/supplemental-nutrition-assistance-program-snap",
    policyManualCitation: "Arizona DES SNAP Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Arkansas
  {
    stateCode: "AR",
    stateName: "Arkansas",
    agencyName: "Arkansas Department of Human Services",
    agencyAbbreviation: "DHS",
    programBrand: "SNAP",
    policyManualUrl: "https://humanservices.arkansas.gov/divisions-shared-services/county-operations/snap/",
    policyManualCitation: "Arkansas DHS SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // California - County Administered
  {
    stateCode: "CA",
    stateName: "California",
    agencyName: "California Department of Social Services",
    agencyAbbreviation: "CDSS",
    programBrand: "CalFresh",
    policyManualUrl: "https://www.cdss.ca.gov/inforesources/calfresh",
    policyManualCitation: "Manual of Policies and Procedures (MPP) Division 63",
    adminModel: "county",
    notes: "58 counties administer program; state supervised",
    isActive: true,
  },
  
  // Colorado - County Administered
  {
    stateCode: "CO",
    stateName: "Colorado",
    agencyName: "Colorado Department of Human Services",
    agencyAbbreviation: "CDHS",
    programBrand: "SNAP",
    policyManualUrl: "https://cdhs.colorado.gov/snap",
    policyManualCitation: "Colorado SNAP Rules (10 CCR 2506-1)",
    adminModel: "county",
    notes: "64 counties administer program; state supervised",
    isActive: true,
  },
  
  // Connecticut
  {
    stateCode: "CT",
    stateName: "Connecticut",
    agencyName: "Connecticut Department of Social Services",
    agencyAbbreviation: "DSS",
    programBrand: "SNAP",
    policyManualUrl: "https://portal.ct.gov/dss/SNAP/Supplemental-Nutrition-Assistance-Program---SNAP",
    policyManualCitation: "Connecticut DSS SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Delaware
  {
    stateCode: "DE",
    stateName: "Delaware",
    agencyName: "Delaware Department of Health and Social Services",
    agencyAbbreviation: "DHSS",
    programBrand: "SNAP",
    policyManualUrl: "https://dhss.delaware.gov/dhss/dss/snap.html",
    policyManualCitation: "Delaware SNAP Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // District of Columbia
  {
    stateCode: "DC",
    stateName: "District of Columbia",
    agencyName: "DC Department of Human Services",
    agencyAbbreviation: "DHS",
    programBrand: "SNAP",
    policyManualUrl: "https://dhs.dc.gov/service/snap-food-stamps",
    policyManualCitation: "DC SNAP Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Florida
  {
    stateCode: "FL",
    stateName: "Florida",
    agencyName: "Florida Department of Children and Families",
    agencyAbbreviation: "DCF",
    programBrand: "SNAP",
    policyManualUrl: "https://www.myflfamilies.com/services/public-assistance/supplemental-nutrition-assistance-program-snap",
    policyManualCitation: "Florida ACCESS SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Georgia
  {
    stateCode: "GA",
    stateName: "Georgia",
    agencyName: "Georgia Division of Family and Children Services",
    agencyAbbreviation: "DFCS",
    programBrand: "SNAP",
    policyManualUrl: "https://dfcs.georgia.gov/services/food-stamps",
    policyManualCitation: "Georgia DFCS Economic Support Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Hawaii
  {
    stateCode: "HI",
    stateName: "Hawaii",
    agencyName: "Hawaii Department of Human Services",
    agencyAbbreviation: "DHS",
    programBrand: "SNAP",
    policyManualUrl: "https://humanservices.hawaii.gov/bessd/snap/",
    policyManualCitation: "Hawaii SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Idaho
  {
    stateCode: "ID",
    stateName: "Idaho",
    agencyName: "Idaho Department of Health and Welfare",
    agencyAbbreviation: "DHW",
    programBrand: "SNAP",
    policyManualUrl: "https://healthandwelfare.idaho.gov/services-programs/financial-assistance/supplemental-nutrition-assistance-program-snap",
    policyManualCitation: "Idaho SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Illinois
  {
    stateCode: "IL",
    stateName: "Illinois",
    agencyName: "Illinois Department of Human Services",
    agencyAbbreviation: "IDHS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.dhs.state.il.us/page.aspx?item=30357",
    policyManualCitation: "Illinois SNAP Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Indiana
  {
    stateCode: "IN",
    stateName: "Indiana",
    agencyName: "Indiana Family and Social Services Administration",
    agencyAbbreviation: "FSSA",
    programBrand: "SNAP",
    policyManualUrl: "https://www.in.gov/fssa/dfr/snap-food-assistance/",
    policyManualCitation: "Indiana DFR SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Iowa
  {
    stateCode: "IA",
    stateName: "Iowa",
    agencyName: "Iowa Department of Health and Human Services",
    agencyAbbreviation: "HHS",
    programBrand: "SNAP",
    policyManualUrl: "https://hhs.iowa.gov/programs/self-sufficiency/food-assistance",
    policyManualCitation: "Iowa Employees Manual (IEM)",
    adminModel: "state",
    isActive: true,
  },
  
  // Kansas
  {
    stateCode: "KS",
    stateName: "Kansas",
    agencyName: "Kansas Department for Children and Families",
    agencyAbbreviation: "DCF",
    programBrand: "SNAP",
    policyManualUrl: "https://www.dcf.ks.gov/services/ees/Pages/Food/FoodAssistance.aspx",
    policyManualCitation: "Kansas Economic and Employment Services Manual (KEESM)",
    adminModel: "state",
    isActive: true,
  },
  
  // Kentucky
  {
    stateCode: "KY",
    stateName: "Kentucky",
    agencyName: "Kentucky Cabinet for Health and Family Services",
    agencyAbbreviation: "CHFS",
    programBrand: "SNAP",
    policyManualUrl: "https://chfs.ky.gov/agencies/dcbs/dfs/snap/Pages/default.aspx",
    policyManualCitation: "Kentucky SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Louisiana
  {
    stateCode: "LA",
    stateName: "Louisiana",
    agencyName: "Louisiana Department of Children and Family Services",
    agencyAbbreviation: "DCFS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.dcfs.louisiana.gov/page/snap",
    policyManualCitation: "Louisiana DCFS Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Maine
  {
    stateCode: "ME",
    stateName: "Maine",
    agencyName: "Maine Department of Health and Human Services",
    agencyAbbreviation: "DHHS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.maine.gov/dhhs/ofi/programs-services/food-supplement",
    policyManualCitation: "Maine SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Maryland - County Administered
  {
    stateCode: "MD",
    stateName: "Maryland",
    agencyName: "Maryland Department of Human Services",
    agencyAbbreviation: "DHS",
    programBrand: "SNAP",
    policyManualUrl: "https://dhs.maryland.gov/food-supplement-program/",
    policyManualCitation: "COMAR 07.03.17 - Food Supplement Program",
    adminModel: "county",
    notes: "24 Local Departments of Social Services (LDSS); JAWN reference implementation",
    isActive: true,
  },
  
  // Massachusetts
  {
    stateCode: "MA",
    stateName: "Massachusetts",
    agencyName: "Massachusetts Department of Transitional Assistance",
    agencyAbbreviation: "DTA",
    programBrand: "SNAP",
    policyManualUrl: "https://www.mass.gov/snap-benefits-food-stamps",
    policyManualCitation: "Massachusetts DTA Policy Guide",
    adminModel: "state",
    isActive: true,
  },
  
  // Michigan
  {
    stateCode: "MI",
    stateName: "Michigan",
    agencyName: "Michigan Department of Health and Human Services",
    agencyAbbreviation: "MDHHS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.michigan.gov/mdhhs/doing-business/providers/providers/foodassistance",
    policyManualCitation: "Bridges Eligibility Manual (BEM)",
    adminModel: "state",
    isActive: true,
  },
  
  // Minnesota
  {
    stateCode: "MN",
    stateName: "Minnesota",
    agencyName: "Minnesota Department of Human Services",
    agencyAbbreviation: "DHS",
    programBrand: "SNAP",
    policyManualUrl: "https://mn.gov/dhs/people-we-serve/children-and-families/economic-assistance/food-nutrition/programs-and-services/supplemental-nutrition-assistance-program.jsp",
    policyManualCitation: "Combined Manual (CM)",
    adminModel: "state",
    isActive: true,
  },
  
  // Mississippi
  {
    stateCode: "MS",
    stateName: "Mississippi",
    agencyName: "Mississippi Department of Human Services",
    agencyAbbreviation: "MDHS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.mdhs.ms.gov/economic-assistance/snap/",
    policyManualCitation: "Mississippi SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Missouri
  {
    stateCode: "MO",
    stateName: "Missouri",
    agencyName: "Missouri Department of Social Services",
    agencyAbbreviation: "DSS",
    programBrand: "SNAP",
    policyManualUrl: "https://dss.mo.gov/fsd/food-stamps/",
    policyManualCitation: "Missouri FSD SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Montana
  {
    stateCode: "MT",
    stateName: "Montana",
    agencyName: "Montana Department of Public Health and Human Services",
    agencyAbbreviation: "DPHHS",
    programBrand: "SNAP",
    policyManualUrl: "https://dphhs.mt.gov/hcsd/snap",
    policyManualCitation: "Montana SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Nebraska
  {
    stateCode: "NE",
    stateName: "Nebraska",
    agencyName: "Nebraska Department of Health and Human Services",
    agencyAbbreviation: "DHHS",
    programBrand: "SNAP",
    policyManualUrl: "https://dhhs.ne.gov/Pages/Supplemental-Nutrition-Assistance-Program.aspx",
    policyManualCitation: "Nebraska SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Nevada
  {
    stateCode: "NV",
    stateName: "Nevada",
    agencyName: "Nevada Division of Welfare and Supportive Services",
    agencyAbbreviation: "DWSS",
    programBrand: "SNAP",
    policyManualUrl: "https://dwss.nv.gov/SNAP/SNAP/",
    policyManualCitation: "Nevada DWSS SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // New Hampshire
  {
    stateCode: "NH",
    stateName: "New Hampshire",
    agencyName: "New Hampshire Department of Health and Human Services",
    agencyAbbreviation: "DHHS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.dhhs.nh.gov/programs-services/financial-assistance/food-stamps-snap",
    policyManualCitation: "New Hampshire SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // New Jersey
  {
    stateCode: "NJ",
    stateName: "New Jersey",
    agencyName: "New Jersey Department of Human Services",
    agencyAbbreviation: "DHS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.nj.gov/humanservices/dfd/programs/njsnap/",
    policyManualCitation: "New Jersey SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // New Mexico
  {
    stateCode: "NM",
    stateName: "New Mexico",
    agencyName: "New Mexico Human Services Department",
    agencyAbbreviation: "HSD",
    programBrand: "SNAP",
    policyManualUrl: "https://www.hsd.state.nm.us/food-and-nutrition-services/",
    policyManualCitation: "New Mexico SNAP Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // New York - County Administered
  {
    stateCode: "NY",
    stateName: "New York",
    agencyName: "New York Office of Temporary and Disability Assistance",
    agencyAbbreviation: "OTDA",
    programBrand: "SNAP",
    policyManualUrl: "https://otda.ny.gov/programs/snap/",
    policyManualCitation: "SNAP Source Book (LDSS-4882)",
    adminModel: "county",
    notes: "58 Local Departments of Social Services (LDSS) + NYC HRA",
    isActive: true,
  },
  
  // North Carolina - County Administered
  {
    stateCode: "NC",
    stateName: "North Carolina",
    agencyName: "North Carolina Department of Health and Human Services",
    agencyAbbreviation: "NCDHHS",
    programBrand: "FNS (Food and Nutrition Services)",
    policyManualUrl: "https://www.ncdhhs.gov/divisions/social-services/food-and-nutrition-services-food-stamps",
    policyManualCitation: "NC FNS Administrative Manual",
    adminModel: "county",
    notes: "100 county Departments of Social Services",
    isActive: true,
  },
  
  // North Dakota - County Administered
  {
    stateCode: "ND",
    stateName: "North Dakota",
    agencyName: "North Dakota Department of Health and Human Services",
    agencyAbbreviation: "HHS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.hhs.nd.gov/economic-assistance/snap",
    policyManualCitation: "North Dakota SNAP Manual",
    adminModel: "county",
    notes: "Human service zones administer program",
    isActive: true,
  },
  
  // Ohio - County Administered
  {
    stateCode: "OH",
    stateName: "Ohio",
    agencyName: "Ohio Department of Job and Family Services",
    agencyAbbreviation: "ODJFS",
    programBrand: "SNAP",
    policyManualUrl: "https://jfs.ohio.gov/assistance-programs/snap",
    policyManualCitation: "Ohio Works First / SNAP Rules (OAC 5101)",
    adminModel: "county",
    notes: "88 county agencies administer program",
    isActive: true,
  },
  
  // Oklahoma
  {
    stateCode: "OK",
    stateName: "Oklahoma",
    agencyName: "Oklahoma Department of Human Services",
    agencyAbbreviation: "OKDHS",
    programBrand: "SNAP",
    policyManualUrl: "https://oklahoma.gov/okdhs/services/snap.html",
    policyManualCitation: "Oklahoma DHS Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Oregon
  {
    stateCode: "OR",
    stateName: "Oregon",
    agencyName: "Oregon Department of Human Services",
    agencyAbbreviation: "ODHS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.oregon.gov/odhs/food/Pages/snap.aspx",
    policyManualCitation: "Oregon SNAP Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Pennsylvania - County Administered
  {
    stateCode: "PA",
    stateName: "Pennsylvania",
    agencyName: "Pennsylvania Department of Human Services",
    agencyAbbreviation: "DHS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.dhs.pa.gov/Services/Assistance/Pages/SNAP.aspx",
    policyManualCitation: "Pennsylvania SNAP Handbook",
    adminModel: "county",
    notes: "67 County Assistance Offices (CAOs); JAWN expansion target",
    isActive: true,
  },
  
  // Rhode Island
  {
    stateCode: "RI",
    stateName: "Rhode Island",
    agencyName: "Rhode Island Department of Human Services",
    agencyAbbreviation: "DHS",
    programBrand: "SNAP",
    policyManualUrl: "https://dhs.ri.gov/programs-and-services/supplemental-nutrition-assistance-program-snap",
    policyManualCitation: "Rhode Island SNAP Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // South Carolina
  {
    stateCode: "SC",
    stateName: "South Carolina",
    agencyName: "South Carolina Department of Social Services",
    agencyAbbreviation: "DSS",
    programBrand: "SNAP",
    policyManualUrl: "https://dss.sc.gov/assistance-programs/snap/",
    policyManualCitation: "South Carolina SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // South Dakota
  {
    stateCode: "SD",
    stateName: "South Dakota",
    agencyName: "South Dakota Department of Social Services",
    agencyAbbreviation: "DSS",
    programBrand: "SNAP",
    policyManualUrl: "https://dss.sd.gov/economicassistance/snap/",
    policyManualCitation: "South Dakota SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Tennessee
  {
    stateCode: "TN",
    stateName: "Tennessee",
    agencyName: "Tennessee Department of Human Services",
    agencyAbbreviation: "TDHS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.tn.gov/humanservices/for-families/supplemental-nutrition-assistance-program-snap.html",
    policyManualCitation: "Tennessee SNAP Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Texas
  {
    stateCode: "TX",
    stateName: "Texas",
    agencyName: "Texas Health and Human Services Commission",
    agencyAbbreviation: "HHSC",
    programBrand: "SNAP",
    policyManualUrl: "https://www.hhs.texas.gov/services/food/snap",
    policyManualCitation: "Texas Works Handbook",
    adminModel: "state",
    notes: "Texas Works Handbook covers both SNAP and TANF",
    isActive: true,
  },
  
  // Utah
  {
    stateCode: "UT",
    stateName: "Utah",
    agencyName: "Utah Department of Workforce Services",
    agencyAbbreviation: "DWS",
    programBrand: "SNAP",
    policyManualUrl: "https://jobs.utah.gov/customereducation/services/financialhelp/snap.html",
    policyManualCitation: "Utah DWS SNAP Manual",
    adminModel: "state",
    notes: "JAWN expansion target",
    isActive: true,
  },
  
  // Vermont
  {
    stateCode: "VT",
    stateName: "Vermont",
    agencyName: "Vermont Department for Children and Families",
    agencyAbbreviation: "DCF",
    programBrand: "3SquaresVT",
    policyManualUrl: "https://dcf.vermont.gov/benefits/3SquaresVT",
    policyManualCitation: "3SquaresVT Policy Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Virginia
  {
    stateCode: "VA",
    stateName: "Virginia",
    agencyName: "Virginia Department of Social Services",
    agencyAbbreviation: "VDSS",
    programBrand: "SNAP",
    policyManualUrl: "https://www.dss.virginia.gov/benefit/snap/",
    policyManualCitation: "Virginia SNAP Policy Manual",
    adminModel: "state",
    notes: "JAWN expansion target",
    isActive: true,
  },
  
  // Washington
  {
    stateCode: "WA",
    stateName: "Washington",
    agencyName: "Washington State Department of Social and Health Services",
    agencyAbbreviation: "DSHS",
    programBrand: "Basic Food",
    policyManualUrl: "https://www.dshs.wa.gov/esa/community-services-offices/basic-food",
    policyManualCitation: "Washington Administrative Code (WAC) 388-400",
    adminModel: "state",
    isActive: true,
  },
  
  // West Virginia
  {
    stateCode: "WV",
    stateName: "West Virginia",
    agencyName: "West Virginia Department of Human Services",
    agencyAbbreviation: "DoHS",
    programBrand: "SNAP",
    policyManualUrl: "https://dhhr.wv.gov/bcf/Services/familyassistance/Pages/SNAP.aspx",
    policyManualCitation: "West Virginia SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // Wisconsin - County Administered
  {
    stateCode: "WI",
    stateName: "Wisconsin",
    agencyName: "Wisconsin Department of Health Services",
    agencyAbbreviation: "DHS",
    programBrand: "FoodShare",
    policyManualUrl: "https://www.dhs.wisconsin.gov/foodshare/index.htm",
    policyManualCitation: "FoodShare Wisconsin Handbook",
    adminModel: "county",
    notes: "72 county agencies administer FoodShare",
    isActive: true,
  },
  
  // Wyoming
  {
    stateCode: "WY",
    stateName: "Wyoming",
    agencyName: "Wyoming Department of Family Services",
    agencyAbbreviation: "DFS",
    programBrand: "SNAP",
    policyManualUrl: "https://dfs.wyo.gov/assistance-programs/food-assistance/snap/",
    policyManualCitation: "Wyoming SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
];

// U.S. Territories
export const TERRITORY_POLICY_SOURCES: StatePolicySource[] = [
  // Guam
  {
    stateCode: "GU",
    stateName: "Guam",
    agencyName: "Guam Department of Public Health and Social Services",
    agencyAbbreviation: "DPHSS",
    programBrand: "SNAP",
    policyManualUrl: "https://dphss.guam.gov/division-of-public-welfare/",
    policyManualCitation: "Guam SNAP Manual",
    adminModel: "state",
    notes: "Operates under federal SNAP guidelines with territorial modifications",
    isActive: true,
  },
  
  // Puerto Rico - NAP (Nutrition Assistance Program)
  {
    stateCode: "PR",
    stateName: "Puerto Rico",
    agencyName: "Puerto Rico Department of Family",
    agencyAbbreviation: "ADSEF",
    programBrand: "NAP (Nutrition Assistance Program)",
    policyManualUrl: "https://www.familia.pr.gov/pan/",
    policyManualCitation: "Puerto Rico NAP Manual",
    adminModel: "state",
    notes: "Block grant program; not traditional SNAP",
    isActive: true,
  },
  
  // U.S. Virgin Islands
  {
    stateCode: "VI",
    stateName: "U.S. Virgin Islands",
    agencyName: "Virgin Islands Department of Human Services",
    agencyAbbreviation: "DHS",
    programBrand: "SNAP",
    policyManualUrl: "https://dhs.gov.vi/family-assistance/snap/",
    policyManualCitation: "USVI SNAP Manual",
    adminModel: "state",
    isActive: true,
  },
  
  // American Samoa
  {
    stateCode: "AS",
    stateName: "American Samoa",
    agencyName: "American Samoa Department of Human and Social Services",
    agencyAbbreviation: "DHSS",
    programBrand: "Food Stamp Program",
    policyManualUrl: "https://dhss.as.gov/",
    policyManualCitation: "American Samoa Food Assistance Manual",
    adminModel: "state",
    notes: "Limited SNAP-like program",
    isActive: true,
  },
];

// Combined array of all SNAP policy sources
export const ALL_SNAP_POLICY_SOURCES: StatePolicySource[] = [
  ...SNAP_POLICY_SOURCES,
  ...TERRITORY_POLICY_SOURCES,
];

// Filter by administrative model
export function getCountyAdministeredStates(): StatePolicySource[] {
  return ALL_SNAP_POLICY_SOURCES.filter(s => s.adminModel === "county");
}

export function getStateAdministeredStates(): StatePolicySource[] {
  return ALL_SNAP_POLICY_SOURCES.filter(s => s.adminModel === "state");
}

// Get state by code
export function getStateByCode(stateCode: string): StatePolicySource | undefined {
  return ALL_SNAP_POLICY_SOURCES.find(s => s.stateCode === stateCode);
}

// Get states with custom branding
export function getStatesWithCustomBranding(): StatePolicySource[] {
  return ALL_SNAP_POLICY_SOURCES.filter(s => s.programBrand !== "SNAP");
}

/**
 * Convert StatePolicySource to InsertPolicySource format for database seeding
 */
export function toInsertPolicySources(benefitProgramId: string): Omit<InsertPolicySource, "benefitProgramId">[] {
  return ALL_SNAP_POLICY_SOURCES.map(source => ({
    name: `${source.stateName} SNAP Policy Manual`,
    sourceType: "state_policy",
    jurisdiction: source.stateCode.toLowerCase(),
    description: `${source.agencyName} - ${source.programBrand} Policy Manual (${source.policyManualCitation})`,
    url: source.policyManualUrl,
    syncType: "web_scraping" as const,
    syncSchedule: "off" as const,
    maxAllowedFrequency: "monthly" as const,
    priority: 50,
    isActive: source.isActive,
    syncConfig: {
      scrapeType: "state_snap_manual",
      stateCode: source.stateCode,
      adminModel: source.adminModel,
      programBrand: source.programBrand,
      agencyAbbreviation: source.agencyAbbreviation,
      notes: source.notes,
    },
  }));
}

/**
 * Get summary statistics for the registry
 */
export function getRegistryStats(): {
  totalStates: number;
  totalTerritories: number;
  countyAdministered: number;
  stateAdministered: number;
  customBranding: string[];
} {
  const countyAdministered = getCountyAdministeredStates();
  const customBranding = getStatesWithCustomBranding();

  return {
    totalStates: SNAP_POLICY_SOURCES.length,
    totalTerritories: TERRITORY_POLICY_SOURCES.length,
    countyAdministered: countyAdministered.length,
    stateAdministered: SNAP_POLICY_SOURCES.length - countyAdministered.length,
    customBranding: customBranding.map(s => `${s.stateCode}: ${s.programBrand}`),
  };
}

/**
 * Log registry summary
 */
export function logRegistrySummary(): void {
  const stats = getRegistryStats();
  
  logger.info("[SNAPPolicyRegistry] Registry Summary", {
    totalStates: stats.totalStates,
    totalTerritories: stats.totalTerritories,
    countyAdministered: stats.countyAdministered,
    stateAdministered: stats.stateAdministered,
    customBranding: stats.customBranding,
  });

  logger.info("[SNAPPolicyRegistry] County-administered states", {
    states: getCountyAdministeredStates().map(s => s.stateCode).join(", "),
  });
}

export default {
  ALL_SNAP_POLICY_SOURCES,
  SNAP_POLICY_SOURCES,
  TERRITORY_POLICY_SOURCES,
  getCountyAdministeredStates,
  getStateAdministeredStates,
  getStateByCode,
  getStatesWithCustomBranding,
  toInsertPolicySources,
  getRegistryStats,
  logRegistrySummary,
};

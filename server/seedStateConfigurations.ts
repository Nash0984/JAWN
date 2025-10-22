import { db } from "./db";
import { storage } from "./storage";
import { stateConfigurationService } from "./services/stateConfigurationService";
import { logger } from "./services/logger.service";
import type { 
  InsertStateConfiguration, 
  InsertStateBenefitProgram,
  BenefitProgram 
} from "@shared/schema";

// State configuration data for all priority states
const stateConfigData = [
  // Mid-Atlantic Region
  {
    tenant: {
      name: "Maryland Department of Human Services",
      slug: "maryland",
      domain: "benefits.maryland.gov"
    },
    stateConfig: {
      stateName: "Maryland",
      stateCode: "MD",
      abbreviation: "MD",
      timezone: "America/New_York",
      region: "Mid-Atlantic",
      agencyName: "Maryland Department of Human Services",
      agencyAcronym: "MD DHS",
      agencyWebsite: "https://dhs.maryland.gov",
      agencyAddress: "311 W. Saratoga Street, Baltimore, MD 21201",
      agencyPhone: "800-332-6347",
      agencyEmail: "dhs.help@maryland.gov",
      mainContactName: "Rafael López",
      mainContactTitle: "Secretary",
      mainContactPhone: "410-767-7109",
      mainContactEmail: "rafael.lopez@maryland.gov",
      emergencyContactPhone: "800-332-6347",
      emergencyContactEmail: "emergency@maryland.gov",
      supportPhone: "800-332-6347",
      supportEmail: "support@maryland.gov",
      supportHours: "Mon-Fri 8:00 AM - 5:00 PM EST",
      supportLanguages: ["en", "es", "zh", "ko", "vi", "fr", "am", "ar"],
      policyManualUrl: "https://dhs.maryland.gov/supplemental-nutrition-assistance-program/snap-manual/",
      regulationsUrl: "https://dsd.state.md.us/regulations/Pages/07.03.03.00.aspx",
      legislativeUrl: "http://mgaleg.maryland.gov",
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: true,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#0D4F8B",
      secondaryColor: "#FFC20E",
      logoUrl: "/assets/maryland/seal.svg"
    }
  },
  {
    tenant: {
      name: "Pennsylvania Department of Human Services",
      slug: "pennsylvania",
      domain: "compass.state.pa.us"
    },
    stateConfig: {
      stateName: "Pennsylvania",
      stateCode: "PA",
      abbreviation: "PA",
      timezone: "America/New_York",
      region: "Mid-Atlantic",
      agencyName: "Pennsylvania Department of Human Services",
      agencyAcronym: "PA DHS",
      agencyWebsite: "https://www.dhs.pa.gov",
      agencyAddress: "625 Forster Street, Harrisburg, PA 17120",
      agencyPhone: "800-692-7462",
      agencyEmail: "dhs@pa.gov",
      supportPhone: "800-692-7462",
      supportEmail: "compass.support@pa.gov",
      supportHours: "Mon-Fri 8:30 AM - 4:45 PM EST",
      supportLanguages: ["en", "es"],
      policyManualUrl: "https://www.dhs.pa.gov/Services/Assistance/Pages/SNAP.aspx",
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: true,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#002664",
      secondaryColor: "#FFB81C",
      logoUrl: "/assets/pennsylvania/seal.svg"
    }
  },
  {
    tenant: {
      name: "New Jersey Department of Human Services",
      slug: "new-jersey",
      domain: "njhelps.org"
    },
    stateConfig: {
      stateName: "New Jersey",
      stateCode: "NJ",
      abbreviation: "NJ",
      timezone: "America/New_York",
      region: "Mid-Atlantic",
      agencyName: "New Jersey Department of Human Services",
      agencyAcronym: "NJ DHS",
      agencyWebsite: "https://www.nj.gov/humanservices",
      agencyAddress: "222 South Warren Street, Trenton, NJ 08608",
      agencyPhone: "877-435-7669",
      agencyEmail: "dhs@dhs.nj.gov",
      supportPhone: "877-435-7669",
      supportEmail: "njhelps@dhs.nj.gov",
      supportHours: "Mon-Fri 8:00 AM - 4:30 PM EST",
      supportLanguages: ["en", "es"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#FFC72C",
      secondaryColor: "#002D62",
      logoUrl: "/assets/new-jersey/seal.svg"
    }
  },
  {
    tenant: {
      name: "Delaware Health and Social Services",
      slug: "delaware",
      domain: "assist.dhss.delaware.gov"
    },
    stateConfig: {
      stateName: "Delaware",
      stateCode: "DE",
      abbreviation: "DE",
      timezone: "America/New_York",
      region: "Mid-Atlantic",
      agencyName: "Delaware Health and Social Services",
      agencyAcronym: "DHSS",
      agencyWebsite: "https://dhss.delaware.gov",
      agencyAddress: "1901 N. DuPont Highway, New Castle, DE 19720",
      agencyPhone: "800-372-2022",
      agencyEmail: "dhssinfo@delaware.gov",
      supportPhone: "800-372-2022",
      supportEmail: "assist@delaware.gov",
      supportHours: "Mon-Fri 8:00 AM - 4:30 PM EST",
      supportLanguages: ["en", "es"],
      features: {
        enableVita: true,
        enableSms: false,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#00769E",
      secondaryColor: "#B8860B",
      logoUrl: "/assets/delaware/seal.svg"
    }
  },
  {
    tenant: {
      name: "Virginia Department of Social Services",
      slug: "virginia",
      domain: "commonhelp.virginia.gov"
    },
    stateConfig: {
      stateName: "Virginia",
      stateCode: "VA",
      abbreviation: "VA",
      timezone: "America/New_York",
      region: "Mid-Atlantic",
      agencyName: "Virginia Department of Social Services",
      agencyAcronym: "VDSS",
      agencyWebsite: "https://www.dss.virginia.gov",
      agencyAddress: "801 E. Main Street, Richmond, VA 23219",
      agencyPhone: "855-635-4370",
      agencyEmail: "info@dss.virginia.gov",
      supportPhone: "855-635-4370",
      supportEmail: "commonhelp@dss.virginia.gov",
      supportHours: "Mon-Fri 7:00 AM - 6:00 PM EST",
      supportLanguages: ["en", "es"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: true,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#022D4F",
      secondaryColor: "#F47B20",
      logoUrl: "/assets/virginia/seal.svg"
    }
  },
  {
    tenant: {
      name: "New York State Office of Temporary and Disability Assistance",
      slug: "new-york",
      domain: "mybenefits.ny.gov"
    },
    stateConfig: {
      stateName: "New York",
      stateCode: "NY",
      abbreviation: "NY",
      timezone: "America/New_York",
      region: "Northeast",
      agencyName: "New York State Office of Temporary and Disability Assistance",
      agencyAcronym: "OTDA",
      agencyWebsite: "https://otda.ny.gov",
      agencyAddress: "40 North Pearl Street, Albany, NY 12243",
      agencyPhone: "800-342-3009",
      agencyEmail: "nyspio@otda.ny.gov",
      supportPhone: "800-342-3009",
      supportEmail: "mybenefits@otda.ny.gov",
      supportHours: "Mon-Fri 8:30 AM - 4:45 PM EST",
      supportLanguages: ["en", "es", "zh", "ru", "bn", "ko", "ht", "it"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: true,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#002D72",
      secondaryColor: "#FFC845",
      logoUrl: "/assets/new-york/seal.svg"
    }
  },
  {
    tenant: {
      name: "New York City Human Resources Administration",
      slug: "nyc",
      domain: "access.nyc.gov"
    },
    stateConfig: {
      stateName: "New York City",
      stateCode: "NYC",
      abbreviation: "NYC",
      timezone: "America/New_York",
      region: "Northeast",
      agencyName: "New York City Human Resources Administration",
      agencyAcronym: "NYC HRA",
      agencyWebsite: "https://www.nyc.gov/hra",
      agencyAddress: "150 Greenwich Street, New York, NY 10007",
      agencyPhone: "718-557-1399",
      agencyEmail: "askhra@hra.nyc.gov",
      supportPhone: "718-557-1399",
      supportEmail: "accesshrahelp@hra.nyc.gov",
      supportHours: "Mon-Fri 8:30 AM - 5:00 PM EST",
      supportLanguages: ["en", "es", "zh", "ru", "bn", "ko", "ht", "ar", "ur", "fr"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: true,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#0A2140",
      secondaryColor: "#00A1DE",
      logoUrl: "/assets/nyc/seal.svg"
    }
  },
  {
    tenant: {
      name: "District of Columbia Department of Human Services",
      slug: "washington-dc",
      domain: "dhs.dc.gov"
    },
    stateConfig: {
      stateName: "Washington DC",
      stateCode: "DC",
      abbreviation: "DC",
      timezone: "America/New_York",
      region: "Mid-Atlantic",
      agencyName: "District of Columbia Department of Human Services",
      agencyAcronym: "DC DHS",
      agencyWebsite: "https://dhs.dc.gov",
      agencyAddress: "64 New York Ave NE, Washington, DC 20002",
      agencyPhone: "202-671-4200",
      agencyEmail: "dhs@dc.gov",
      supportPhone: "202-671-4200",
      supportEmail: "dhs.assistance@dc.gov",
      supportHours: "Mon-Fri 8:15 AM - 4:45 PM EST",
      supportLanguages: ["en", "es", "am", "zh", "fr", "ko", "vi"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#DC143C",
      secondaryColor: "#003F87",
      logoUrl: "/assets/dc/seal.svg"
    }
  },
  // National Expansion States
  {
    tenant: {
      name: "California Department of Social Services",
      slug: "california",
      domain: "benefitscal.com"
    },
    stateConfig: {
      stateName: "California",
      stateCode: "CA",
      abbreviation: "CA",
      timezone: "America/Los_Angeles",
      region: "West",
      agencyName: "California Department of Social Services",
      agencyAcronym: "CDSS",
      agencyWebsite: "https://www.cdss.ca.gov",
      agencyAddress: "744 P Street, Sacramento, CA 95814",
      agencyPhone: "877-847-3663",
      agencyEmail: "info@cdss.ca.gov",
      supportPhone: "877-847-3663",
      supportEmail: "help@benefitscal.com",
      supportHours: "Mon-Fri 8:00 AM - 5:00 PM PST",
      supportLanguages: ["en", "es", "zh", "vi", "ko", "tl", "ru", "ar", "fa", "km"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: true,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#006BA6",
      secondaryColor: "#FDB515",
      logoUrl: "/assets/california/seal.svg"
    }
  },
  {
    tenant: {
      name: "Texas Health and Human Services",
      slug: "texas",
      domain: "yourtexasbenefits.com"
    },
    stateConfig: {
      stateName: "Texas",
      stateCode: "TX",
      abbreviation: "TX",
      timezone: "America/Chicago",
      region: "South",
      agencyName: "Texas Health and Human Services",
      agencyAcronym: "TX HHS",
      agencyWebsite: "https://www.hhs.texas.gov",
      agencyAddress: "4900 N. Lamar Blvd, Austin, TX 78751",
      agencyPhone: "877-541-7905",
      agencyEmail: "info@hhs.texas.gov",
      supportPhone: "877-541-7905",
      supportEmail: "support@yourtexasbenefits.com",
      supportHours: "Mon-Fri 8:00 AM - 6:00 PM CST",
      supportLanguages: ["en", "es"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#003F87",
      secondaryColor: "#C8102E",
      logoUrl: "/assets/texas/seal.svg"
    }
  },
  {
    tenant: {
      name: "Florida Department of Children and Families",
      slug: "florida",
      domain: "myflfamilies.com"
    },
    stateConfig: {
      stateName: "Florida",
      stateCode: "FL",
      abbreviation: "FL",
      timezone: "America/New_York",
      region: "South",
      agencyName: "Florida Department of Children and Families",
      agencyAcronym: "FL DCF",
      agencyWebsite: "https://www.myflfamilies.com",
      agencyAddress: "1317 Winewood Blvd, Tallahassee, FL 32399",
      agencyPhone: "850-300-4323",
      agencyEmail: "info@myflfamilies.com",
      supportPhone: "850-300-4323",
      supportEmail: "access@myflfamilies.com",
      supportHours: "Mon-Fri 7:00 AM - 6:00 PM EST",
      supportLanguages: ["en", "es", "ht"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: true,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#004B87",
      secondaryColor: "#FFA300",
      logoUrl: "/assets/florida/seal.svg"
    }
  },
  {
    tenant: {
      name: "Ohio Department of Job and Family Services",
      slug: "ohio",
      domain: "benefits.ohio.gov"
    },
    stateConfig: {
      stateName: "Ohio",
      stateCode: "OH",
      abbreviation: "OH",
      timezone: "America/New_York",
      region: "Midwest",
      agencyName: "Ohio Department of Job and Family Services",
      agencyAcronym: "ODJFS",
      agencyWebsite: "https://jfs.ohio.gov",
      agencyAddress: "30 E. Broad Street, Columbus, OH 43215",
      agencyPhone: "844-640-6446",
      agencyEmail: "info@jfs.ohio.gov",
      supportPhone: "844-640-6446",
      supportEmail: "benefits@jfs.ohio.gov",
      supportHours: "Mon-Fri 8:00 AM - 5:00 PM EST",
      supportLanguages: ["en", "es"],
      features: {
        enableVita: true,
        enableSms: false,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#C8102E",
      secondaryColor: "#003F87",
      logoUrl: "/assets/ohio/seal.svg"
    }
  },
  {
    tenant: {
      name: "Georgia Division of Family and Children Services",
      slug: "georgia",
      domain: "gateway.ga.gov"
    },
    stateConfig: {
      stateName: "Georgia",
      stateCode: "GA",
      abbreviation: "GA",
      timezone: "America/New_York",
      region: "South",
      agencyName: "Georgia Division of Family and Children Services",
      agencyAcronym: "GA DFCS",
      agencyWebsite: "https://dfcs.georgia.gov",
      agencyAddress: "2 Peachtree Street NW, Atlanta, GA 30303",
      agencyPhone: "877-423-4746",
      agencyEmail: "info@dfcs.ga.gov",
      supportPhone: "877-423-4746",
      supportEmail: "gateway@georgia.gov",
      supportHours: "Mon-Fri 8:00 AM - 5:00 PM EST",
      supportLanguages: ["en", "es"],
      features: {
        enableVita: true,
        enableSms: false,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#003366",
      secondaryColor: "#FDB913",
      logoUrl: "/assets/georgia/seal.svg"
    }
  },
  {
    tenant: {
      name: "North Carolina Department of Health and Human Services",
      slug: "north-carolina",
      domain: "epass.nc.gov"
    },
    stateConfig: {
      stateName: "North Carolina",
      stateCode: "NC",
      abbreviation: "NC",
      timezone: "America/New_York",
      region: "South",
      agencyName: "North Carolina Department of Health and Human Services",
      agencyAcronym: "NC DHHS",
      agencyWebsite: "https://www.ncdhhs.gov",
      agencyAddress: "101 Blair Drive, Raleigh, NC 27603",
      agencyPhone: "888-245-0179",
      agencyEmail: "info@dhhs.nc.gov",
      supportPhone: "888-245-0179",
      supportEmail: "epass.help@dhhs.nc.gov",
      supportHours: "Mon-Fri 8:00 AM - 5:00 PM EST",
      supportLanguages: ["en", "es"],
      features: {
        enableVita: true,
        enableSms: false,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#0073C0",
      secondaryColor: "#A80000",
      logoUrl: "/assets/north-carolina/seal.svg"
    }
  },
  {
    tenant: {
      name: "Michigan Department of Health and Human Services",
      slug: "michigan",
      domain: "michigan.gov/mibridges"
    },
    stateConfig: {
      stateName: "Michigan",
      stateCode: "MI",
      abbreviation: "MI",
      timezone: "America/Detroit",
      region: "Midwest",
      agencyName: "Michigan Department of Health and Human Services",
      agencyAcronym: "MDHHS",
      agencyWebsite: "https://www.michigan.gov/mdhhs",
      agencyAddress: "333 S. Grand Avenue, Lansing, MI 48909",
      agencyPhone: "855-275-6424",
      agencyEmail: "mdhhs-info@michigan.gov",
      supportPhone: "855-275-6424",
      supportEmail: "mibridges@michigan.gov",
      supportHours: "Mon-Fri 8:00 AM - 7:00 PM EST",
      supportLanguages: ["en", "es", "ar"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#00274C",
      secondaryColor: "#FFCB05",
      logoUrl: "/assets/michigan/seal.svg"
    }
  },
  {
    tenant: {
      name: "Illinois Department of Human Services",
      slug: "illinois",
      domain: "abe.illinois.gov"
    },
    stateConfig: {
      stateName: "Illinois",
      stateCode: "IL",
      abbreviation: "IL",
      timezone: "America/Chicago",
      region: "Midwest",
      agencyName: "Illinois Department of Human Services",
      agencyAcronym: "IDHS",
      agencyWebsite: "https://www.dhs.state.il.us",
      agencyAddress: "100 South Grand Avenue East, Springfield, IL 62762",
      agencyPhone: "800-843-6154",
      agencyEmail: "dhs.info@illinois.gov",
      supportPhone: "800-843-6154",
      supportEmail: "abe.support@illinois.gov",
      supportHours: "Mon-Fri 7:30 AM - 6:00 PM CST",
      supportLanguages: ["en", "es", "pl"],
      features: {
        enableVita: true,
        enableSms: false,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#17406D",
      secondaryColor: "#E84A27",
      logoUrl: "/assets/illinois/seal.svg"
    }
  },
  // Additional States
  {
    tenant: {
      name: "Massachusetts Department of Transitional Assistance",
      slug: "massachusetts",
      domain: "mass.gov/dta"
    },
    stateConfig: {
      stateName: "Massachusetts",
      stateCode: "MA",
      abbreviation: "MA",
      timezone: "America/New_York",
      region: "Northeast",
      agencyName: "Massachusetts Department of Transitional Assistance",
      agencyAcronym: "DTA",
      agencyWebsite: "https://www.mass.gov/dta",
      agencyAddress: "600 Washington Street, Boston, MA 02111",
      agencyPhone: "877-382-2363",
      agencyEmail: "dta@mass.gov",
      supportPhone: "877-382-2363",
      supportEmail: "dtaconnect@mass.gov",
      supportHours: "Mon-Fri 8:00 AM - 5:00 PM EST",
      supportLanguages: ["en", "es", "pt", "zh", "vi", "ru", "ht"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: true,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#14558F",
      secondaryColor: "#43956F",
      logoUrl: "/assets/massachusetts/seal.svg"
    }
  },
  {
    tenant: {
      name: "Washington State Department of Social and Health Services",
      slug: "washington",
      domain: "washingtonconnection.org"
    },
    stateConfig: {
      stateName: "Washington",
      stateCode: "WA",
      abbreviation: "WA",
      timezone: "America/Los_Angeles",
      region: "West",
      agencyName: "Washington State Department of Social and Health Services",
      agencyAcronym: "DSHS",
      agencyWebsite: "https://www.dshs.wa.gov",
      agencyAddress: "1115 Washington Street SE, Olympia, WA 98504",
      agencyPhone: "877-501-2233",
      agencyEmail: "info@dshs.wa.gov",
      supportPhone: "877-501-2233",
      supportEmail: "help@washingtonconnection.org",
      supportHours: "Mon-Fri 8:00 AM - 5:00 PM PST",
      supportLanguages: ["en", "es", "vi", "ko", "ru", "so", "zh"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#002F5D",
      secondaryColor: "#8DC63F",
      logoUrl: "/assets/washington/seal.svg"
    }
  },
  {
    tenant: {
      name: "Colorado Department of Human Services",
      slug: "colorado",
      domain: "colorado.gov/peak"
    },
    stateConfig: {
      stateName: "Colorado",
      stateCode: "CO",
      abbreviation: "CO",
      timezone: "America/Denver",
      region: "West",
      agencyName: "Colorado Department of Human Services",
      agencyAcronym: "CDHS",
      agencyWebsite: "https://cdhs.colorado.gov",
      agencyAddress: "1575 Sherman Street, Denver, CO 80203",
      agencyPhone: "800-536-5298",
      agencyEmail: "cdhs_info@state.co.us",
      supportPhone: "800-536-5298",
      supportEmail: "peak.support@state.co.us",
      supportHours: "Mon-Fri 7:00 AM - 5:00 PM MST",
      supportLanguages: ["en", "es"],
      features: {
        enableVita: true,
        enableSms: true,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#2E3192",
      secondaryColor: "#FFC20E",
      logoUrl: "/assets/colorado/seal.svg"
    }
  },
  {
    tenant: {
      name: "Arizona Department of Economic Security",
      slug: "arizona",
      domain: "healthearizonaplus.gov"
    },
    stateConfig: {
      stateName: "Arizona",
      stateCode: "AZ",
      abbreviation: "AZ",
      timezone: "America/Phoenix",
      region: "West",
      agencyName: "Arizona Department of Economic Security",
      agencyAcronym: "DES",
      agencyWebsite: "https://des.az.gov",
      agencyAddress: "1789 W. Jefferson Street, Phoenix, AZ 85007",
      agencyPhone: "855-432-7587",
      agencyEmail: "desinfo@azdes.gov",
      supportPhone: "855-432-7587",
      supportEmail: "help@healthearizonaplus.gov",
      supportHours: "Mon-Fri 7:00 AM - 6:00 PM MST",
      supportLanguages: ["en", "es"],
      features: {
        enableVita: true,
        enableSms: false,
        enableChat: false,
        enableAppointments: true,
        enableDocumentUpload: true
      },
      isActive: true
    },
    branding: {
      primaryColor: "#CE5C17",
      secondaryColor: "#002868",
      logoUrl: "/assets/arizona/seal.svg"
    }
  }
];

// Function to seed state configurations
export async function seedStateConfigurations() {
  logger.info("🌱 Seeding state configurations...", {
    service: "seedStateConfigurations",
    action: "start",
    totalStates: stateConfigData.length
  });

  try {
    // Get all benefit programs to configure for each state
    const benefitPrograms = await storage.getBenefitPrograms();
    
    const snapProgram = benefitPrograms.find(p => p.code === 'SNAP');
    const medicaidProgram = benefitPrograms.find(p => p.code === 'MEDICAID');
    const tanfProgram = benefitPrograms.find(p => p.code === 'TANF');
    const vitaProgram = benefitPrograms.find(p => p.code === 'VITA');

    for (const state of stateConfigData) {
      logger.info(`  📍 Creating configuration for ${state.stateConfig.stateName}...`, {
        service: "seedStateConfigurations",
        action: "createState",
        stateName: state.stateConfig.stateName,
        stateCode: state.stateConfig.stateCode
      });

      // Check if state already exists
      const existingConfig = await storage.getStateConfigurationByCode(state.stateConfig.stateCode);
      if (existingConfig) {
        logger.warn(`    ⚠️  State configuration already exists for ${state.stateConfig.stateName}`, {
          service: "seedStateConfigurations",
          action: "stateExists",
          stateName: state.stateConfig.stateName,
          stateCode: state.stateConfig.stateCode
        });
        continue;
      }

      // First, check or create tenant
      let tenant = await storage.getTenantBySlug(state.tenant.slug);
      if (!tenant) {
        tenant = await storage.createTenant({
          ...state.tenant,
          id: undefined, // Let database generate ID
          status: 'active',
          type: 'state' as const,
          config: {}
        });
      }

      // Create state configuration directly
      const stateConfigData = {
        ...state.stateConfig,
        tenantId: tenant.id
      } as InsertStateConfiguration;
      
      const created = await storage.createStateConfiguration(stateConfigData);
      
      // Create or update branding if provided
      if (state.branding && tenant.id) {
        const existingBranding = await storage.getTenantBranding(tenant.id);
        if (!existingBranding) {
          await storage.createTenantBranding({
            tenantId: tenant.id,
            ...state.branding
          });
        }
      }

      // Configure benefit programs for the state
      const programsToAdd = [];
      
      // All states get SNAP and Medicaid
      if (snapProgram) {
        programsToAdd.push({
          benefitProgramId: snapProgram.id,
          stateProgramName: `${state.stateConfig.stateName} SNAP`,
          stateProgramCode: `${state.stateConfig.stateCode}_SNAP`,
          isActive: true
        });
      }

      if (medicaidProgram) {
        programsToAdd.push({
          benefitProgramId: medicaidProgram.id,
          stateProgramName: `${state.stateConfig.stateName} Medicaid`,
          stateProgramCode: `${state.stateConfig.stateCode}_MEDICAID`,
          isActive: true
        });
      }

      // Most states get TANF
      if (tanfProgram) {
        programsToAdd.push({
          benefitProgramId: tanfProgram.id,
          stateProgramName: `${state.stateConfig.stateName} TANF`,
          stateProgramCode: `${state.stateConfig.stateCode}_TANF`,
          isActive: true
        });
      }

      // States with VITA enabled get tax preparation
      if (vitaProgram && state.stateConfig.features?.enableVita) {
        programsToAdd.push({
          benefitProgramId: vitaProgram.id,
          stateProgramName: `${state.stateConfig.stateName} Tax Assistance`,
          stateProgramCode: `${state.stateConfig.stateCode}_VITA`,
          isActive: true
        });
      }

      // Add programs to the state
      for (const program of programsToAdd) {
        await stateConfigurationService.configureStateBenefitProgram(
          created.id,
          program.benefitProgramId,
          program as InsertStateBenefitProgram
        );
      }

      logger.info(`    ✅ Created configuration for ${state.stateConfig.stateName} with ${programsToAdd.length} programs`, {
        service: "seedStateConfigurations",
        action: "stateCreated",
        stateName: state.stateConfig.stateName,
        stateCode: state.stateConfig.stateCode,
        programsCount: programsToAdd.length
      });
    }

    logger.info("✅ State configurations seeded successfully!", {
      service: "seedStateConfigurations",
      action: "complete",
      totalStates: stateConfigData.length
    });
  } catch (error) {
    logger.error("❌ Error seeding state configurations", {
      service: "seedStateConfigurations",
      action: "error",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Run if executed directly
// Check if this is the main module in ES modules
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  seedStateConfigurations()
    .then(() => {
      logger.info("✨ Seeding complete!", {
        service: "seedStateConfigurations",
        action: "finalize"
      });
      process.exit(0);
    })
    .catch((error) => {
      logger.error("💥 Seeding failed", {
        service: "seedStateConfigurations",
        action: "fatal",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      process.exit(1);
    });
}
import { db } from "./db";
import { dhsForms } from "@shared/schema";

/**
 * Seed Maryland DHS Forms from official sources
 * Based on forms identified from:
 * - https://dhs.maryland.gov/business-center/documents/forms/
 * - https://dhs.maryland.gov/business-center/documents/fia/
 */
export async function seedDhsForms() {
  console.log("📋 Seeding Maryland DHS Forms...");

  try {
    const forms = [
      // OHEP Application - Latest Version (Sept 2025)
      {
        formNumber: "DHS-FIA-9780",
        name: "OHEP Application",
        language: "en",
        languageName: "English",
        version: "2025-09-12",
        programCode: "MD_OHEP",
        formType: "application",
        description: "Maryland Office of Home Energy Programs (OHEP) Application - 2025-2026 Season",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/English/OHEP/OHEP-Updated-app-9.12.25.-English.pdf",
        isLatestVersion: true,
        isFillable: true,
        metadata: {
          season: "2025-2026",
          notes: "Latest fillable PDF version for upcoming heating season"
        }
      },

      // Request for Assistance (Form 9711/9711A) - 6 Languages
      {
        formNumber: "DHS-FIA-9711",
        name: "Request for Assistance",
        language: "en",
        languageName: "English",
        version: "2023-03",
        programCode: "MD_SNAP",
        formType: "application",
        description: "General application for public assistance benefits (SNAP, TCA, Medicaid)",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/English/To%20Apply%20for%20Assistance/DHS_FIA_9711_English.pdf",
        isLatestVersion: true,
        isFillable: false,
        metadata: {
          programs: ["SNAP", "TCA", "Medicaid"],
          revisionDate: "March 2023"
        }
      },
      {
        formNumber: "DHS-FIA-9711A",
        name: "Request for Assistance (Amharic)",
        language: "am",
        languageName: "Amharic",
        version: "2023-03",
        programCode: "MD_SNAP",
        formType: "application",
        description: "ለእርዳታ ጥያቄ (የአማርኛ ቅጽ)",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/Amharic/To%20Apply%20for%20Assistance/DHS_FIA_9711A%20Req-Assist%20Revised%203-2023_Amharic%20No%20highlights%20(1)%20(1).pdf",
        isLatestVersion: true,
        isFillable: false,
        metadata: {
          programs: ["SNAP", "TCA", "Medicaid"],
          targetCommunity: "Ethiopian"
        }
      },
      {
        formNumber: "DHS-FIA-9711",
        name: "Request for Assistance (Arabic)",
        language: "ar",
        languageName: "Arabic",
        version: "2023-03",
        programCode: "MD_SNAP",
        formType: "application",
        description: "طلب المساعدة (النموذج بالعربية)",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/Arabic/To%20Apply%20for%20Assistance/DHS_FIA_9711Req-Assist%20Revised%203-2023_Arabic%20No%20highlights%20(1).pdf",
        isLatestVersion: true,
        isFillable: false,
        metadata: {
          programs: ["SNAP", "TCA", "Medicaid"]
        }
      },
      {
        formNumber: "DHS-FIA-9711",
        name: "Request for Assistance (Burmese)",
        language: "my",
        languageName: "Burmese",
        version: "2023-03",
        programCode: "MD_SNAP",
        formType: "application",
        description: "အကူအညီတောင်းခံခြင်း (မြန်မာဘာသာ)",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/Burmese/To%20Apply%20for%20Assistance/DHS_FIA_9711Req-Assist%20Revised%203-2023_Burmese%20No%20highlights%20(1).pdf",
        isLatestVersion: true,
        isFillable: false,
        metadata: {
          programs: ["SNAP", "TCA", "Medicaid"],
          targetCommunity: "Myanmar/Burma"
        }
      },
      {
        formNumber: "DHS-FIA-9711",
        name: "Request for Assistance (Chinese Traditional)",
        language: "zh-TW",
        languageName: "Chinese (Traditional)",
        version: "2023-03",
        programCode: "MD_SNAP",
        formType: "application",
        description: "申請援助 (繁體中文表格)",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/Chinese/To%20Apply%20for%20Assistance/DHS_FIA_9711%209711A%20Req-Assist%20Revised%203-2023_Chinese_Traditional%20No%20highlights%20(1).pdf",
        isLatestVersion: true,
        isFillable: false,
        metadata: {
          programs: ["SNAP", "TCA", "Medicaid"],
          script: "Traditional"
        }
      },
      {
        formNumber: "DHS-FIA-9711A",
        name: "Request for Assistance (Chinese Simplified)",
        language: "zh-CN",
        languageName: "Chinese (Simplified)",
        version: "2023-03",
        programCode: "MD_SNAP",
        formType: "application",
        description: "申请援助 (简体中文表格)",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/Chinese/To%20Apply%20for%20Assistance/DHS_FIA_9711A%20Req-Assist%20Revised%203-2023_Chinese_Simplified%20No%20highlights%20(1).pdf",
        isLatestVersion: true,
        isFillable: false,
        metadata: {
          programs: ["SNAP", "TCA", "Medicaid"],
          script: "Simplified"
        }
      },
      {
        formNumber: "DHS-FIA-9711",
        name: "Request for Assistance (Spanish)",
        language: "es",
        languageName: "Spanish",
        version: "2023-03",
        programCode: "MD_SNAP",
        formType: "application",
        description: "Solicitud de Asistencia (Formulario en Español)",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/Spanish/To%20Apply%20for%20Assistance/DHS_FIA_9711_Spanish.pdf",
        isLatestVersion: true,
        isFillable: false,
        metadata: {
          programs: ["SNAP", "TCA", "Medicaid"]
        }
      },

      // Change Report Form - Latest (May 2024)
      {
        formNumber: "DHS-FIA-491",
        name: "Change Report Form",
        language: "en",
        languageName: "English",
        version: "2024-05",
        programCode: "MD_SNAP",
        formType: "change_report",
        description: "Report changes in household circumstances for SNAP, TCA, Medicaid",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/English/Other-Forms/1%20FIA%20Change%20Report%20Form/491-DHS-FIA-Change-Report-Form-5.2024.docx",
        isLatestVersion: true,
        isFillable: true,
        metadata: {
          fileFormat: "DOCX",
          revisionDate: "May 2024"
        }
      },

      // Fair Hearing Request (April 2021)
      {
        formNumber: "DHS-FIA-334",
        name: "Request for Fair Hearing",
        language: "en",
        languageName: "English",
        version: "2021-04-01",
        programCode: null,
        formType: "appeal",
        description: "Request for administrative hearing to appeal benefit determination",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/English/Other-Forms/3%20Request%20Appeal%20for%20Hearing/DHS_FIA_334-Request-For-Fair-Hearing-4.1.2021-fillable.pdf",
        isLatestVersion: true,
        isFillable: true,
        metadata: {
          effectiveDate: "April 1, 2021"
        }
      },

      // QMB/SLMB Medicare Savings Programs (August 2021)
      {
        formNumber: "DHS-FIA-9705",
        name: "QMB and SLMB Application",
        language: "en",
        languageName: "English",
        version: "2021-08",
        programCode: "MD_MEDICAID",
        formType: "application",
        description: "Qualified Medicare Beneficiary (QMB) and Specified Low-Income Medicare Beneficiary (SLMB) Application",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/FIA%20Forms/English/Other-Forms/4%20QMB%20and%20SLMB%20Programs/9705-DHS-QMB-SLMB-MSP-Application-Revised-August-2021.pdf",
        isLatestVersion: true,
        isFillable: false,
        metadata: {
          programs: ["QMB", "SLMB", "MSP"],
          revisionDate: "August 2021"
        }
      },

      // Direct Deposit Authorization - Latest (April 2024)
      {
        formNumber: "DHS-CSEA-DD",
        name: "Direct Deposit Application Update",
        language: "en",
        languageName: "English",
        version: "2024-04-01",
        programCode: null,
        formType: "supplemental",
        description: "Child Support Direct Deposit Authorization",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/CSEA%20Forms/Direct%20Deposit%20Application%20Update%20-%2004-01-24.docx",
        isLatestVersion: true,
        isFillable: true,
        metadata: {
          fileFormat: "DOCX",
          program: "Child Support"
        }
      },
      {
        formNumber: "DHS-CSEA-DD",
        name: "Direct Deposit Application Update (Spanish)",
        language: "es",
        languageName: "Spanish",
        version: "2024-04-01",
        programCode: null,
        formType: "supplemental",
        description: "Autorización de Depósito Directo de Manutención de Menores",
        sourceUrl: "https://dhs.maryland.gov/documents/DHS%20Forms/CSEA%20Forms/Direct%20Deposit%20Application%20Update%20-%20Spanish%2004-01-24.docx",
        isLatestVersion: true,
        isFillable: true,
        metadata: {
          fileFormat: "DOCX",
          program: "Child Support"
        }
      },
    ];

    for (const form of forms) {
      await db.insert(dhsForms).values(form).onConflictDoNothing();
    }

    console.log(`✅ Seeded ${forms.length} DHS forms across 6 languages`);
    console.log("   Languages: English, Spanish, Amharic, Arabic, Burmese, Chinese (Traditional & Simplified)");
    console.log("   Programs: SNAP, OHEP, Medicaid, TCA, Child Support");
    console.log("   Form Types: application, change_report, appeal, supplemental");

  } catch (error) {
    console.error("❌ Error seeding DHS forms:", error);
    throw error;
  }
}

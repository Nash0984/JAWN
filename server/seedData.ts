import { storage } from "./storage";

export async function seedMarylandBenefitPrograms() {
  try {
    // Check if Maryland SNAP program already exists
    const programs = await storage.getBenefitPrograms();
    const marylandSnap = programs.find(p => p.code === 'MD_SNAP');
    
    if (marylandSnap) {
      console.log('Maryland SNAP program already exists:', marylandSnap.name);
      return marylandSnap;
    }

    // Create Maryland SNAP program
    const newProgram = await storage.createBenefitProgram({
      name: 'Maryland SNAP (Food Supplement Program)',
      code: 'MD_SNAP',
      description: 'Maryland Supplemental Nutrition Assistance Program (SNAP), also known as Food Supplement Program (FSP), administered by the Maryland Department of Human Services',
      isActive: true
    });

    console.log('✓ Created Maryland SNAP benefit program:', newProgram.name);
    return newProgram;
  } catch (error) {
    console.error('Error seeding Maryland SNAP program:', error);
    throw error;
  }
}

export async function seedDocumentTypes() {
  try {
    const types = await storage.getDocumentTypes();
    
    // Define document types for Maryland SNAP system
    const documentTypesToSeed = [
      {
        code: 'POLICY_MANUAL',
        name: 'Policy Manual',
        description: 'Maryland SNAP Policy Manual sections',
      },
      {
        code: 'FEDERAL_REGULATION',
        name: 'Federal Regulation',
        description: 'Federal SNAP regulations (7 CFR Part 273)',
      },
      {
        code: 'STATE_REGULATION',
        name: 'State Regulation',
        description: 'Maryland state regulations (COMAR Title 10)',
      },
      {
        code: 'GUIDANCE',
        name: 'Program Guidance',
        description: 'FNS memos, action transmittals, information memos',
      },
      {
        code: 'CLIENT_DOCUMENT',
        name: 'Client Document',
        description: 'Documents uploaded by clients for verification (income, residency, etc.)',
      },
    ];

    let seededCount = 0;
    for (const docType of documentTypesToSeed) {
      const existing = types.find(t => t.code === docType.code);
      if (!existing) {
        await storage.createDocumentType(docType);
        seededCount++;
        console.log(`✓ Seeded document type: ${docType.name}`);
      }
    }

    if (seededCount > 0) {
      console.log(`✓ Seeded ${seededCount} new document types`);
    } else {
      console.log('✓ Document types already exist');
    }
  } catch (error) {
    console.error('Error seeding document types:', error);
    throw error;
  }
}

// Initialize all required data
export async function initializeSystemData() {
  console.log('Initializing Maryland Benefits Navigator system data...');
  
  try {
    await seedMarylandBenefitPrograms();
    await seedDocumentTypes();
    
    console.log('✓ System data initialization complete');
  } catch (error) {
    console.error('System data initialization failed:', error);
    throw error;
  }
}
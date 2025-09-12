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
    
    // Check if policy manual type exists
    const policyManualType = types.find(t => t.code === 'POLICY_MANUAL');
    
    if (!policyManualType) {
      console.log('Document types need to be seeded. This should be done via database migration.');
      // In a real system, document types would be seeded via database migration
    } else {
      console.log('✓ Document types already exist');
    }
  } catch (error) {
    console.error('Error checking document types:', error);
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
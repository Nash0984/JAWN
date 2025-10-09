import { storage } from "./storage";
import bcrypt from "bcryptjs";

export async function seedDemoUsers() {
  try {
    console.log('Seeding demo users...');
    
    const demoUsers = [
      {
        username: 'demo.applicant',
        password: await bcrypt.hash('Demo2024!', 10),
        email: 'applicant@demo.md.gov',
        fullName: 'Maria Rodriguez',
        role: 'client',
        isActive: true,
      },
      {
        username: 'demo.navigator',
        password: await bcrypt.hash('Demo2024!', 10),
        email: 'navigator@demo.md.gov',
        fullName: 'James Chen',
        role: 'navigator',
        dhsEmployeeId: 'NAV-2024-001',
        officeLocation: 'Baltimore City DHS Office',
        isActive: true,
      },
      {
        username: 'demo.caseworker',
        password: await bcrypt.hash('Demo2024!', 10),
        email: 'caseworker@demo.md.gov',
        fullName: 'Sarah Johnson',
        role: 'caseworker',
        dhsEmployeeId: 'CW-2024-001',
        officeLocation: 'Montgomery County DHS Office',
        isActive: true,
      },
      {
        username: 'demo.admin',
        password: await bcrypt.hash('Demo2024!', 10),
        email: 'admin@demo.md.gov',
        fullName: 'Administrator',
        role: 'admin',
        dhsEmployeeId: 'ADM-2024-001',
        officeLocation: 'Maryland DHS Central Office',
        isActive: true,
      },
    ];

    let createdCount = 0;
    for (const userData of demoUsers) {
      try {
        // Check if user already exists
        const existingUser = await storage.getUserByUsername(userData.username);
        if (!existingUser) {
          await storage.createUser(userData);
          createdCount++;
          console.log(`✓ Created demo user: ${userData.username} (${userData.role})`);
        } else {
          console.log(`  Demo user already exists: ${userData.username}`);
        }
      } catch (error) {
        console.error(`  Error creating demo user ${userData.username}:`, error);
      }
    }

    if (createdCount > 0) {
      console.log(`✓ Seeded ${createdCount} demo users`);
      console.log('\n📋 Demo Credentials:');
      console.log('  Applicant   - username: demo.applicant   | password: Demo2024!');
      console.log('  Navigator   - username: demo.navigator   | password: Demo2024!');
      console.log('  Caseworker  - username: demo.caseworker  | password: Demo2024!');
      console.log('  Admin       - username: demo.admin       | password: Demo2024!\n');
    }
  } catch (error) {
    console.error('Error seeding demo users:', error);
    throw error;
  }
}

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
    await seedDemoUsers();
    await seedMarylandBenefitPrograms();
    await seedDocumentTypes();
    
    console.log('✓ System data initialization complete');
  } catch (error) {
    console.error('System data initialization failed:', error);
    throw error;
  }
}
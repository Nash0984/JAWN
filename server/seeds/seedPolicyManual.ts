/**
 * Seed Policy Manual - Populate chapters, sections, and glossary
 * Demonstrates the Living Policy Manual system with real content
 */

import { assembleCompleteManual } from "../services/policyManualAssemblyService";

export async function seedPolicyManual(): Promise<void> {
  console.log("📚 Seeding Policy Manual...");
  
  try {
    const result = await assembleCompleteManual();
    
    console.log(`✅ Policy Manual seeded successfully:`);
    console.log(`   - Chapters: ${result.chapters}`);
    console.log(`   - Sections: ${result.sections}`);
    console.log(`   - Glossary Terms: ${result.glossaryTerms}`);
  } catch (error) {
    console.error("❌ Error seeding policy manual:", error);
    throw error;
  }
}

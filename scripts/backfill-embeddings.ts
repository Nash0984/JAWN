import { db } from "../server/db";
import { documentChunks } from "../shared/schema";
import { generateEmbedding } from "../server/services/gemini.service";
import { isNull, eq } from "drizzle-orm";

async function backfillEmbeddings() {
  console.log("🔍 Finding chunks without embeddings...");
  
  // Get all chunks without embeddings
  const chunksWithoutEmbeddings = await db
    .select({
      id: documentChunks.id,
      documentId: documentChunks.documentId,
      content: documentChunks.content,
    })
    .from(documentChunks)
    .where(isNull(documentChunks.embeddings));
  
  console.log(`📊 Found ${chunksWithoutEmbeddings.length} chunks without embeddings`);
  
  if (chunksWithoutEmbeddings.length === 0) {
    console.log("✅ All chunks already have embeddings!");
    return;
  }
  
  console.log("\n🚀 Starting embedding generation...\n");
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < chunksWithoutEmbeddings.length; i++) {
    const chunk = chunksWithoutEmbeddings[i];
    
    try {
      console.log(`[${i + 1}/${chunksWithoutEmbeddings.length}] Processing chunk ${chunk.id}...`);
      console.log(`   Content preview: ${chunk.content.substring(0, 100)}...`);
      
      // Generate embedding
      const embedding = await generateEmbedding(chunk.content);
      
      if (!embedding || embedding.length === 0) {
        console.log(`   ⚠️  Warning: Empty embedding generated for chunk ${chunk.id}`);
        errorCount++;
        continue;
      }
      
      console.log(`   ✓ Generated embedding with ${embedding.length} dimensions`);
      
      // Convert to JSON string for storage
      const embeddingJson = JSON.stringify(embedding);
      
      // Update database
      await db
        .update(documentChunks)
        .set({ embeddings: embeddingJson })
        .where(eq(documentChunks.id, chunk.id));
      
      console.log(`   ✓ Stored embedding in database\n`);
      successCount++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`   ❌ Error processing chunk ${chunk.id}:`, error);
      errorCount++;
    }
  }
  
  console.log("\n📈 Backfill Summary:");
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  
  // Verify final counts
  console.log("\n🔍 Verifying final state...");
  
  const finalCounts = await db.execute(`
    SELECT 
      COUNT(*) as total_chunks,
      COUNT(CASE WHEN embeddings IS NOT NULL THEN 1 END) as with_embeddings,
      COUNT(CASE WHEN embeddings IS NULL THEN 1 END) as without_embeddings
    FROM document_chunks
  `);
  
  console.log("\n📊 Final Embedding Status:");
  console.log(`   Total chunks: ${finalCounts.rows[0].total_chunks}`);
  console.log(`   With embeddings: ${finalCounts.rows[0].with_embeddings}`);
  console.log(`   Without embeddings: ${finalCounts.rows[0].without_embeddings}`);
  
  if (finalCounts.rows[0].without_embeddings === "0") {
    console.log("\n🎉 SUCCESS! All chunks now have embeddings!");
  } else {
    console.log(`\n⚠️  Warning: ${finalCounts.rows[0].without_embeddings} chunks still missing embeddings`);
  }
}

// Run the backfill
backfillEmbeddings()
  .then(() => {
    console.log("\n✨ Backfill complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Backfill failed:", error);
    process.exit(1);
  });

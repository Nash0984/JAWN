#!/usr/bin/env tsx
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, stat } from 'fs/promises';
import path from 'path';
import { gzipSync, brotliCompressSync } from 'zlib';
import { readFileSync } from 'fs';

const execAsync = promisify(exec);

interface BundleStats {
  file: string;
  size: number;
  gzipSize: number;
  brotliSize: number;
  type: string;
}

interface BundleReport {
  totalSize: number;
  totalGzipSize: number;
  totalBrotliSize: number;
  initialBundleSize: number;
  initialGzipSize: number;
  chunks: BundleStats[];
  recommendations: string[];
  meetsTarget: boolean;
  targetSize: number;
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

function getGzipSize(content: Buffer): number {
  return gzipSync(content).length;
}

function getBrotliSize(content: Buffer): number {
  return brotliCompressSync(content).length;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getSizeColor(bytes: number, threshold: number): string {
  if (bytes < threshold * 0.5) return colors.green;
  if (bytes < threshold * 0.8) return colors.yellow;
  return colors.red;
}

async function analyzeBundle(distPath: string): Promise<BundleReport> {
  const files = await readdir(path.join(distPath, 'assets'), { recursive: true });
  const chunks: BundleStats[] = [];
  
  let totalSize = 0;
  let totalGzipSize = 0;
  let totalBrotliSize = 0;
  let initialBundleSize = 0;
  let initialGzipSize = 0;
  
  for (const file of files) {
    if (typeof file === 'string' && (file.endsWith('.js') || file.endsWith('.css'))) {
      const filePath = path.join(distPath, 'assets', file);
      const content = readFileSync(filePath);
      const size = content.length;
      const gzipSize = getGzipSize(content);
      const brotliSize = getBrotliSize(content);
      
      const isInitial = !file.includes('chunk') && !file.includes('vendor');
      const type = file.endsWith('.css') ? 'css' : 
                   file.includes('vendor') ? 'vendor' :
                   file.includes('chunk') ? 'lazy' : 'initial';
      
      chunks.push({
        file,
        size,
        gzipSize,
        brotliSize,
        type
      });
      
      totalSize += size;
      totalGzipSize += gzipSize;
      totalBrotliSize += brotliSize;
      
      if (type === 'initial' || type === 'css') {
        initialBundleSize += size;
        initialGzipSize += gzipSize;
      }
    }
  }
  
  // Sort chunks by size
  chunks.sort((a, b) => b.size - a.size);
  
  const targetSize = 500 * 1024; // 500KB target
  const meetsTarget = initialGzipSize < targetSize;
  
  const recommendations: string[] = [];
  
  // Generate recommendations
  if (!meetsTarget) {
    recommendations.push('❌ Initial bundle exceeds 500KB target');
    
    // Find large vendor chunks
    const largeVendors = chunks.filter(c => c.type === 'vendor' && c.size > 100 * 1024);
    if (largeVendors.length > 0) {
      recommendations.push('• Consider splitting large vendor bundles further');
      recommendations.push(`  Large vendors: ${largeVendors.map(v => v.file).join(', ')}`);
    }
    
    // Check for optimization opportunities
    const cssSize = chunks.filter(c => c.type === 'css').reduce((sum, c) => sum + c.size, 0);
    if (cssSize > 100 * 1024) {
      recommendations.push('• CSS bundle is large - consider using CSS modules or PurgeCSS');
    }
    
    recommendations.push('• Enable tree shaking for unused code elimination');
    recommendations.push('• Consider dynamic imports for route-based code splitting');
    recommendations.push('• Use production builds with minification');
  } else {
    recommendations.push('✅ Bundle size meets the 500KB target!');
    recommendations.push(`• Initial bundle (gzipped): ${formatSize(initialGzipSize)}`);
  }
  
  return {
    totalSize,
    totalGzipSize,
    totalBrotliSize,
    initialBundleSize,
    initialGzipSize,
    chunks,
    recommendations,
    meetsTarget,
    targetSize
  };
}

async function buildAndAnalyze() {
  console.log(`${colors.cyan}🔨 Building production bundle...${colors.reset}\n`);
  
  try {
    // Build the production bundle
    const { stdout, stderr } = await execAsync('npm run build');
    
    if (stderr && !stderr.includes('warning')) {
      console.error(`Build error: ${stderr}`);
    }
    
    console.log(`${colors.green}✅ Build completed successfully${colors.reset}\n`);
    
    // Analyze the bundle
    console.log(`${colors.cyan}📊 Analyzing bundle size...${colors.reset}\n`);
    
    const distPath = path.join(process.cwd(), 'dist/public');
    const report = await analyzeBundle(distPath);
    
    // Print report header
    console.log(`${colors.bright}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}Bundle Size Analysis Report${colors.reset}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Print overall stats
    console.log(`${colors.bright}📦 Overall Statistics:${colors.reset}`);
    console.log(`  Total Size:        ${formatSize(report.totalSize)}`);
    console.log(`  Gzipped:          ${formatSize(report.totalGzipSize)}`);
    console.log(`  Brotli:           ${formatSize(report.totalBrotliSize)}\n`);
    
    // Print initial bundle stats
    const targetColor = getSizeColor(report.initialGzipSize, report.targetSize);
    console.log(`${colors.bright}🚀 Initial Bundle:${colors.reset}`);
    console.log(`  Raw:              ${formatSize(report.initialBundleSize)}`);
    console.log(`  ${targetColor}Gzipped:          ${formatSize(report.initialGzipSize)}${colors.reset}`);
    console.log(`  Target:           ${formatSize(report.targetSize)}`);
    console.log(`  ${report.meetsTarget ? colors.green + '✅' : colors.red + '❌'} Status:           ${report.meetsTarget ? 'PASS' : 'FAIL'}${colors.reset}\n`);
    
    // Print top 10 chunks
    console.log(`${colors.bright}📊 Largest Chunks:${colors.reset}`);
    const top10 = report.chunks.slice(0, 10);
    
    for (const chunk of top10) {
      const sizeColor = chunk.type === 'initial' ? colors.yellow : colors.reset;
      const typeEmoji = chunk.type === 'vendor' ? '📚' : 
                        chunk.type === 'initial' ? '🎯' :
                        chunk.type === 'lazy' ? '😴' : '🎨';
      
      console.log(`  ${typeEmoji} ${chunk.file}`);
      console.log(`     ${sizeColor}Size: ${formatSize(chunk.size)} | Gzip: ${formatSize(chunk.gzipSize)} | Type: ${chunk.type}${colors.reset}`);
    }
    
    // Print recommendations
    console.log(`\n${colors.bright}💡 Recommendations:${colors.reset}`);
    for (const rec of report.recommendations) {
      console.log(`  ${rec}`);
    }
    
    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    if (report.meetsTarget) {
      console.log(`${colors.green}${colors.bright}✅ SUCCESS: Bundle size is optimized!${colors.reset}`);
      console.log(`${colors.green}Initial bundle is ${formatSize(report.targetSize - report.initialGzipSize)} under target${colors.reset}`);
    } else {
      console.log(`${colors.red}${colors.bright}❌ ACTION REQUIRED: Bundle size optimization needed${colors.reset}`);
      console.log(`${colors.red}Initial bundle exceeds target by ${formatSize(report.initialGzipSize - report.targetSize)}${colors.reset}`);
    }
    console.log(`${'='.repeat(60)}\n`);
    
    // Write detailed report to file
    const detailedReport = {
      timestamp: new Date().toISOString(),
      ...report,
      chunks: report.chunks.map(c => ({
        ...c,
        sizeFormatted: formatSize(c.size),
        gzipSizeFormatted: formatSize(c.gzipSize),
        brotliSizeFormatted: formatSize(c.brotliSize)
      }))
    };
    
    const fs = await import('fs/promises');
    await fs.writeFile(
      'bundle-report.json',
      JSON.stringify(detailedReport, null, 2)
    );
    
    console.log(`📄 Detailed report saved to: bundle-report.json\n`);
    
    // Exit with appropriate code
    process.exit(report.meetsTarget ? 0 : 1);
    
  } catch (error) {
    console.error(`${colors.red}Error during bundle analysis:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the analysis
buildAndAnalyze().catch(console.error);
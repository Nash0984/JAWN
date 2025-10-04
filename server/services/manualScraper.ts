import axios from 'axios';
import * as cheerio from 'cheerio';

const MANUAL_BASE_URL = 'https://dhs.maryland.gov/supplemental-nutrition-assistance-program/food-supplement-program-manual/';

export interface ScrapedSection {
  sectionNumber: string;
  sectionTitle: string;
  category: string;
  sourceUrl: string;
  fileType: string;
  fileSize: number;
  lastModified: Date;
  sortOrder: number;
}

/**
 * Scrapes the Maryland DHS SNAP manual page to get all section metadata
 * @returns Array of all manual sections with metadata
 */
export async function scrapeManualSections(): Promise<ScrapedSection[]> {
  try {
    console.log(`Fetching manual page from ${MANUAL_BASE_URL}...`);
    const response = await axios.get(MANUAL_BASE_URL, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Maryland-SNAP-Policy-System/1.0 (Educational/Government Tool)',
      },
    });

    const $ = cheerio.load(response.data);
    const sections: ScrapedSection[] = [];
    let sortOrder = 0;

    // The page has sections structured as:
    // - Section title (e.g., "100 Household Composition")
    // - Under each title, there are file links
    
    // Find all section containers - they appear as list items or divs with section info
    $('ul li, .section-item').each((index, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      
      // Look for section number patterns: "000", "100", "115", "200", etc.
      const sectionMatch = text.match(/^(\d{3})\s+(.+?)(?:\s*-\s*(.+))?$/);
      
      if (sectionMatch) {
        const sectionNumber = sectionMatch[1];
        const sectionTitle = sectionMatch[2].trim();
        
        // Find the download link within this section
        const $link = $el.find('a[href]').first();
        const href = $link.attr('href');
        
        if (href) {
          // Extract file metadata
          const fileName = href.split('/').pop() || '';
          const fileType = fileName.split('.').pop()?.toUpperCase() || 'UNKNOWN';
          
          // Extract file size if shown (e.g., "76.75 KB")
          const sizeMatch = text.match(/([\d.]+)\s*(KB|MB|GB)/i);
          let fileSize = 0;
          if (sizeMatch) {
            const size = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2].toUpperCase();
            fileSize = unit === 'KB' ? size * 1024 : 
                      unit === 'MB' ? size * 1024 * 1024 :
                      unit === 'GB' ? size * 1024 * 1024 * 1024 : size;
          }
          
          // Extract last modified date if shown
          const dateMatch = text.match(/([A-Z][a-z]+)\s+(\d{1,2})\s+(\d{4})/);
          let lastModified = new Date();
          if (dateMatch) {
            const monthStr = dateMatch[1];
            const day = dateMatch[2];
            const year = dateMatch[3];
            lastModified = new Date(`${monthStr} ${day}, ${year}`);
          }
          
          // Determine category based on section number
          const sectionNum = parseInt(sectionNumber);
          let category = 'Other';
          if (sectionNumber === '000') {
            category = '000 - Table of Contents';
          } else if (sectionNum >= 100 && sectionNum < 130) {
            category = '100s - Household & Eligibility';
          } else if (sectionNum === 130) {
            category = '130s - Work Requirements';
          } else if (sectionNum >= 200 && sectionNum < 300) {
            category = '200s - Income & Resources';
          } else if (sectionNum >= 400 && sectionNum < 500) {
            category = '400s - Application & Processing';
          } else if (sectionNum >= 500 && sectionNum < 600) {
            category = '500s - Certification & Recertification';
          } else if (sectionNum >= 600 && sectionNum < 700) {
            category = '600s - Benefits & Issuance';
          } else if (sectionNum >= 700 && sectionNum < 800) {
            category = '700s - Program Violations';
          }
          
          // Build full URL if relative
          const fullUrl = href.startsWith('http') ? href : `https://dhs.maryland.gov${href}`;
          
          sections.push({
            sectionNumber,
            sectionTitle,
            category,
            sourceUrl: fullUrl,
            fileType,
            fileSize: Math.round(fileSize),
            lastModified,
            sortOrder: sortOrder++,
          });
        }
      }
    });

    // Alternative parsing: Look for direct section structure
    if (sections.length === 0) {
      console.log('Trying alternative parsing method...');
      
      // Find all links that point to documents
      $('a[href*=".pdf"], a[href*=".docx"], a[href*=".doc"]').each((index, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        const linkText = $link.parent().text().trim();
        
        if (href) {
          // Try to extract section number from the link text or URL
          const urlSectionMatch = href.match(/\/(\d{3})[\s_-]/);
          const textSectionMatch = linkText.match(/^(\d{3})\s+(.+)/);
          
          if (urlSectionMatch || textSectionMatch) {
            const sectionNumber = urlSectionMatch ? urlSectionMatch[1] : textSectionMatch![1];
            const sectionTitle = textSectionMatch ? textSectionMatch[2].split('\n')[0].trim() : 
                                  href.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
            
            const fileName = href.split('/').pop() || '';
            const fileType = fileName.split('.').pop()?.toUpperCase() || 'UNKNOWN';
            
            // Extract file size from surrounding text
            const $parent = $link.parent();
            const parentText = $parent.text();
            const sizeMatch = parentText.match(/([\d.]+)\s*(KB|MB|GB)/i);
            let fileSize = 0;
            if (sizeMatch) {
              const size = parseFloat(sizeMatch[1]);
              const unit = sizeMatch[2].toUpperCase();
              fileSize = unit === 'KB' ? size * 1024 : 
                        unit === 'MB' ? size * 1024 * 1024 :
                        unit === 'GB' ? size * 1024 * 1024 * 1024 : size;
            }
            
            // Extract date
            const dateMatch = parentText.match(/([A-Z][a-z]+)\s+(\d{1,2})\s+(\d{4})/);
            let lastModified = new Date();
            if (dateMatch) {
              lastModified = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]}`);
            }
            
            // Determine category
            const sectionNum = parseInt(sectionNumber);
            let category = 'Other';
            if (sectionNumber === '000') {
              category = '000 - Table of Contents';
            } else if (sectionNum >= 100 && sectionNum < 130) {
              category = '100s - Household & Eligibility';
            } else if (sectionNum === 130) {
              category = '130s - Work Requirements';
            } else if (sectionNum >= 200 && sectionNum < 300) {
              category = '200s - Income & Resources';
            } else if (sectionNum >= 400 && sectionNum < 500) {
              category = '400s - Application & Processing';
            } else if (sectionNum >= 500 && sectionNum < 600) {
              category = '500s - Certification & Recertification';
            } else if (sectionNum >= 600 && sectionNum < 700) {
              category = '600s - Benefits & Issuance';
            } else if (sectionNum >= 700 && sectionNum < 800) {
              category = '700s - Program Violations';
            }
            
            const fullUrl = href.startsWith('http') ? href : `https://dhs.maryland.gov${href}`;
            
            sections.push({
              sectionNumber,
              sectionTitle: sectionTitle.substring(0, 200), // Truncate long titles
              category,
              sourceUrl: fullUrl,
              fileType,
              fileSize: Math.round(fileSize),
              lastModified,
              sortOrder: sortOrder++,
            });
          }
        }
      });
    }

    // Remove duplicates based on sectionNumber
    const uniqueSections = sections.reduce((acc, section) => {
      if (!acc.find(s => s.sectionNumber === section.sectionNumber)) {
        acc.push(section);
      }
      return acc;
    }, [] as ScrapedSection[]);

    // Sort by section number
    uniqueSections.sort((a, b) => {
      const aNum = parseInt(a.sectionNumber);
      const bNum = parseInt(b.sectionNumber);
      return aNum - bNum;
    });

    console.log(`Successfully scraped ${uniqueSections.length} sections from Maryland DHS website`);
    
    return uniqueSections;
  } catch (error) {
    console.error('Error scraping manual sections:', error);
    throw new Error(`Failed to scrape manual sections: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Test the scraper (for debugging)
 */
export async function testScraper() {
  const sections = await scrapeManualSections();
  console.log('Scraped sections:');
  sections.forEach(s => {
    console.log(`${s.sectionNumber}: ${s.sectionTitle} (${s.fileType}, ${(s.fileSize / 1024).toFixed(2)} KB)`);
  });
  return sections;
}

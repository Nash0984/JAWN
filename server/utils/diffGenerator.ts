/**
 * Diff Generator Utility
 * Generates line-by-line diffs for version comparison
 */

export interface DiffLine {
  type: 'unchanged' | 'added' | 'deleted' | 'modified';
  content: string;
  lineNumber: number;
  oldLineNumber?: number; // for deleted/modified lines
  newLineNumber?: number; // for added/modified lines
}

/**
 * Generate a simple line-by-line diff between two texts
 * @param oldText - The original text
 * @param newText - The updated text
 * @returns Array of diff lines with change types
 */
export function generateDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff: DiffLine[] = [];
  
  let oldIndex = 0;
  let newIndex = 0;
  
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];
    
    // Both lines exist and are identical
    if (oldLine === newLine && oldIndex < oldLines.length && newIndex < newLines.length) {
      diff.push({
        type: 'unchanged',
        content: oldLine,
        lineNumber: diff.length + 1,
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
      });
      oldIndex++;
      newIndex++;
      continue;
    }
    
    // Check if current old line appears later in new lines (was added above)
    const oldLineInNew = newLines.indexOf(oldLine, newIndex);
    // Check if current new line appears later in old lines (was deleted above)
    const newLineInOld = oldLines.indexOf(newLine, oldIndex);
    
    // Line was deleted
    if (oldIndex < oldLines.length && (newLineInOld < 0 || oldLineInNew >= 0)) {
      diff.push({
        type: 'deleted',
        content: oldLine,
        lineNumber: diff.length + 1,
        oldLineNumber: oldIndex + 1,
      });
      oldIndex++;
      continue;
    }
    
    // Line was added
    if (newIndex < newLines.length && (oldLineInNew < 0 || newLineInOld >= 0)) {
      diff.push({
        type: 'added',
        content: newLine,
        lineNumber: diff.length + 1,
        newLineNumber: newIndex + 1,
      });
      newIndex++;
      continue;
    }
    
    // Lines are different - treat as modified
    if (oldIndex < oldLines.length && newIndex < newLines.length) {
      diff.push({
        type: 'modified',
        content: newLine,
        lineNumber: diff.length + 1,
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
      });
      oldIndex++;
      newIndex++;
    }
  }
  
  return diff;
}

/**
 * Generate a summary of changes between two texts
 * @param oldText - The original text
 * @param newText - The updated text
 * @returns Object with change statistics
 */
export function generateDiffSummary(oldText: string, newText: string) {
  const diff = generateDiff(oldText, newText);
  
  const added = diff.filter(line => line.type === 'added').length;
  const deleted = diff.filter(line => line.type === 'deleted').length;
  const modified = diff.filter(line => line.type === 'modified').length;
  const unchanged = diff.filter(line => line.type === 'unchanged').length;
  
  return {
    totalLines: diff.length,
    added,
    deleted,
    modified,
    unchanged,
    changePercentage: diff.length > 0 
      ? Math.round(((added + deleted + modified) / diff.length) * 100) 
      : 0,
  };
}

/**
 * Compare two JSON objects and return a structured diff
 * @param oldObj - The original object
 * @param newObj - The updated object
 * @returns Diff summary with added, removed, and modified keys
 */
export function generateJsonDiff(oldObj: any, newObj: any) {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: Array<{ key: string; oldValue: any; newValue: any }> = [];
  
  const oldKeys = Object.keys(oldObj || {});
  const newKeys = Object.keys(newObj || {});
  
  // Find removed keys
  for (const key of oldKeys) {
    if (!(key in (newObj || {}))) {
      removed.push(key);
    }
  }
  
  // Find added and modified keys
  for (const key of newKeys) {
    if (!(key in (oldObj || {}))) {
      added.push(key);
    } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      modified.push({
        key,
        oldValue: oldObj[key],
        newValue: newObj[key],
      });
    }
  }
  
  return {
    added,
    removed,
    modified,
    hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0,
  };
}

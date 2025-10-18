# Platform Statistics Verification System

## Overview

The statistics verification system ensures accuracy and consistency of platform metrics across all documentation, showcase pages, and codebase.

## Features

- **Dynamic Counting**: Automatically counts features, tables, endpoints, and services from source files
- **Cross-Reference Validation**: Verifies consistency across Demo Showcase, API Explorer, and documentation
- **CI/CD Integration**: Can be integrated into pre-commit hooks and deployment pipelines
- **Zero Configuration**: Works out-of-the-box with existing codebase structure

## Usage

### Manual Verification

```bash
tsx scripts/verify-stats.ts
```

### Pre-Commit Hook

To automatically verify statistics before each commit:

```bash
# Install git pre-commit hook
cp scripts/pre-commit.sample .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### CI/CD Integration

Add to your CI pipeline (e.g., GitHub Actions):

```yaml
- name: Verify Platform Statistics
  run: tsx scripts/verify-stats.ts
```

## What Gets Verified

### 1. Features Count
- **Source**: `shared/featureMetadata.ts` (`FEATURE_CATALOG.length`)
- **Verified Against**:
  - Demo.tsx (dynamic via `{FEATURE_CATALOG.length}`)
  - replit.md documentation

### 2. Database Tables Count
- **Source**: `shared/schema.ts` (count of `pgTable` declarations)
- **Verified Against**:
  - Demo.tsx (static count)

### 3. API Endpoints Count
- **Source**: `shared/apiEndpoints.ts` (`API_ENDPOINTS.length`)
- **Verified Against**:
  - Demo.tsx (dynamic via `{API_ENDPOINTS.length}`)
  - APIExplorer.tsx meta description
  - replit.md documentation

### 4. Services Count
- **Source**: `server/` directory (recursive file count)
- **Verified Against**:
  - Demo.tsx (approximate count with "+" suffix)

## Output Example

```
🔍 Platform Statistics Verification

════════════════════════════════════════════════════════════

📊 Actual Platform Statistics:
   Features:        99
   Database Tables: 136
   API Endpoints:   218
   Services:        140

📄 Documentation Statistics:
   Demo.tsx:        Tables=136
   APIExplorer.tsx: Endpoints=218
   replit.md:       Features=99, Endpoints=218

✅ Verification Results:
   ✓ Demo.tsx tables: 136 matches actual
   ✓ APIExplorer.tsx endpoints: 218 matches actual
   ✓ replit.md features: 99 matches actual
   ✓ replit.md endpoints: 218 matches actual

⚠️  Dynamic Value Checks:
   Demo.tsx features uses {FEATURE_CATALOG.length} - Dynamic ✓
   Demo.tsx endpoints uses {API_ENDPOINTS.length} - Dynamic ✓

════════════════════════════════════════════════════════════
✅ All statistics are consistent and accurate!
```

## Exit Codes

- **0**: All statistics are consistent
- **1**: Inconsistencies detected (see output for details)

## Troubleshooting

### Common Issues

**Issue**: "ReferenceError: __dirname is not defined"
- **Fix**: Script uses ES modules with `fileURLToPath` - ensure running with `tsx`

**Issue**: Statistics mismatch detected
- **Fix**: Update the documentation files listed in the error output with correct counts

### Updating Statistics

When platform metrics change:

1. **Add Features**: Update `shared/featureMetadata.ts`
   - Automatically reflected in Demo.tsx via `{FEATURE_CATALOG.length}`
   - Update replit.md manually

2. **Add Database Tables**: Update `shared/schema.ts`
   - Update static count in Demo.tsx

3. **Add API Endpoints**: Update `shared/apiEndpoints.ts`
   - Automatically reflected in Demo.tsx via `{API_ENDPOINTS.length}`
   - Update APIExplorer.tsx meta description
   - Update replit.md manually

4. **Add Services**: Add files to `server/` directory
   - Count updates automatically
   - Update approximate count in Demo.tsx if needed

## Architecture

### File Structure

```
scripts/
├── verify-stats.ts       # Main verification script
├── README.md             # This file
└── pre-commit.sample     # Git pre-commit hook template
```

### Verification Flow

```
┌─────────────────────┐
│ Source Files        │
├─────────────────────┤
│ featureMetadata.ts  │──┐
│ apiEndpoints.ts     │  │
│ schema.ts           │  │  Count
│ server/*            │  │  Statistics
└─────────────────────┘  │
                         ▼
                  ┌──────────────┐
                  │ Verification │
                  │   Engine     │
                  └──────────────┘
                         │
                         ▼
           ┌─────────────────────────┐
           │ Compare Against:        │
           ├─────────────────────────┤
           │ Demo.tsx                │
           │ APIExplorer.tsx         │
           │ replit.md               │
           └─────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   Report     │
                  │   Results    │
                  └──────────────┘
```

## Best Practices

1. **Run Before Committing**: Verify statistics before pushing documentation updates
2. **Keep Dynamic Values**: Prefer `{CATALOG.length}` over hardcoded numbers in React components
3. **Update Centrally**: Maintain single sources of truth (featureMetadata, apiEndpoints, schema)
4. **Document Changes**: Update replit.md when adding major features or endpoints

## Future Enhancements

- [ ] GitHub Action for automated PR checks
- [ ] Slack/Discord notifications for CI failures
- [ ] Historical metrics tracking and visualization
- [ ] Auto-fix capability for documentation updates
- [ ] Integration with changelog generation

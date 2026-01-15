# JAWN Platform Quick Reference Card
## Demo Navigation Paths

### Login with Demo Account
1. Navigate to `/login`
2. Click "Use Demo Account"
3. Select desired role:
   - **demo.admin** - Full admin access
   - **demo.navigator** - Caseworker view
   - **demo.researcher** - Analytics view

---

## Key Demo Routes

### Public Pages (No Auth Required)
| Page | URL |
|------|-----|
| Landing Page | `/` |
| Login | `/login` |
| Sign Up | `/signup` |
| Public Search | `/search` |

### Navigator/Caseworker Pages
| Page | URL |
|------|-----|
| Workspace | `/navigator` |
| Eligibility Check | `/eligibility` |
| VITA Tax Help | `/vita` |
| Cross-Enrollment | `/admin/cross-enrollment` |

### Admin Pages
| Page | URL |
|------|-----|
| Admin Dashboard | `/admin` |
| PER Dashboard | `/admin/per` |
| AI Monitoring | `/admin/ai-monitoring` |
| System Monitoring | `/admin/monitoring` |
| Counties/LDSS | `/admin/counties` |
| FNS State Options | `/admin/fns-state-options` |
| Federal Law Tracker | `/admin/federal-law-tracker` |
| Security Dashboard | `/admin/security` |
| User Management | `/admin/users` |
| Analytics Dashboard | `/admin/analytics` |
| Benefits Access Review | `/admin/bar` |

---

## PER Dashboard Tabs
Navigate to `/admin/per` then use tab navigation:
1. **Executive Overview** - KPIs and metrics
2. **Supervisor Dashboard** - Office-level view
3. **Risk Queue** - High-risk cases
4. **High Priority Nudges** - AI alerts
5. **Error Breakdown** - Analysis
6. **PERM Compliance** - Federal reporting
7. **LDSS League** - Office rankings

---

## E&E Synthetic Database

### API Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/ee-synthetic/health` | Database status and counts |
| `GET /api/ee-synthetic/stats` | Detailed statistics |
| `POST /api/ee-synthetic/generate` | Generate test data |

### Current Data Counts
- **588** individuals
- **200** cases (153 active, 47 closed)
- **343** income records
- **33** homeless individuals (5.6%)
- **15** ABAWD tracking records
- **14** database tables
- **172+** E&E Data Dictionary fields

---

## Key Platform Features

### 1. Neuro-Symbolic Gateway
- AI handles extraction only (Gemini)
- Z3 Solver makes eligibility decisions
- Statutory citations for all determinations

### 2. Payment Error Reduction (PER)
- Real-time AI nudges for caseworkers
- Top 4 error categories covered
- LDSS League for office recognition

### 3. Cross-Enrollment Intelligence
- AI identifies unclaimed benefits
- Multi-program eligibility analysis
- 35% of cases have opportunities

### 4. Digital Twin (E&E Synthetic)
- Complete Maryland E&E Data Dictionary
- NDNH/SWICA wage verification
- Homeless and ABAWD tracking

---

## Grant Deliverables Alignment

| Grant | Key Demonstration |
|-------|-------------------|
| Arnold Ventures ($900K) | Neuro-Symbolic Gateway, Z3 Solver |
| PTIG ($1.7M) | PER Module, PERM Reporting |
| Georgetown | Rules-as-Code, Dual Verification |

---

*For detailed documentation, see DEMO_GUIDE.md*

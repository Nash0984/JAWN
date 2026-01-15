# JAWN Platform Demo Materials Guide
## Georgetown University / Arnold Ventures Grant Demonstration

**Version:** 1.0  
**Date:** January 2026  
**Platform:** Maryland Universal Financial Navigator (JAWN)

---

## Executive Summary

The Joint Access Welfare Network (JAWN) is a production-ready sovereign white-label multi-state benefits platform with a neuro-symbolic Rules-as-Code hybrid engine. This document provides a comprehensive guide to the platform's user experience from each role perspective and key module functionality.

---

## 1. Public Portal (Unauthenticated Users)

### 1.1 Landing Page
- **URL:** `/`
- **Features:**
  - Maryland Department of Human Services branding
  - Welcome message and platform overview
  - Quick access to benefits eligibility check
  - Login/Sign up navigation
  - Multi-language support indicator

### 1.2 Login Page
- **URL:** `/login`
- **Features:**
  - Email/password authentication
  - "Use Demo Account" option for demonstrations
  - Demo accounts available:
    - `demo.admin` - Administrator access
    - `demo.navigator` - Caseworker/Navigator access
    - `demo.researcher` - Research access
  - Google OAuth integration (production)

### 1.3 Registration Page
- **URL:** `/signup`
- **Features:**
  - New user registration form
  - Role selection (where applicable)
  - Terms of service acceptance

### 1.4 Public Search
- **URL:** `/search`
- **Features:**
  - Policy document search
  - Benefits information lookup
  - No authentication required

---

## 2. Navigator/Caseworker Perspective

### 2.1 Navigator Workspace
- **URL:** `/navigator`
- **Role Required:** Staff/Navigator
- **Features:**
  - Client case management dashboard
  - Quick actions for common tasks
  - Case assignment and workload view
  - Recent activity timeline

### 2.2 Eligibility Pre-Screener
- **URL:** `/eligibility`
- **Features:**
  - Multi-program eligibility calculator
  - Household information collection
  - Income and resource assessment
  - Program recommendations:
    - SNAP (Food Stamps)
    - Medicaid
    - TANF
    - Energy Assistance
    - WIC

### 2.3 VITA Tax Knowledge Base
- **URL:** `/vita`
- **Features:**
  - Tax preparation guidance
  - EITC eligibility calculator
  - Document requirements checklist
  - Integration with benefits data

### 2.4 Cross-Enrollment Analysis
- **URL:** `/admin/cross-enrollment`
- **Features:**
  - AI-powered benefit recommendations
  - Client identifier lookup
  - Cross-program eligibility analysis
  - "Analyze Cross-Enrollment" action button

---

## 3. Administrator Perspective

### 3.1 Administration Dashboard
- **URL:** `/admin`
- **Role Required:** Admin
- **Features:**
  - System overview metrics
  - Quick access to admin functions
  - User and role management links
  - Configuration settings

### 3.2 AI Monitoring Dashboard
- **URL:** `/admin/ai-monitoring`
- **Features:**
  - Real-time AI service health monitoring
  - Gemini API usage metrics
  - Cost tracking and budgets
  - Error rate monitoring
  - Response latency metrics

### 3.3 Counties/LDSS Management
- **URL:** `/admin/counties`
- **Features:**
  - 24 Maryland LDSS office management
  - Office configuration settings
  - Contact information management
  - Regional groupings (WMD, SMD, BALT, EMD, CMD, MMD)

### 3.4 FNS State Options Manager
- **URL:** `/admin/fns-state-options`
- **Features:**
  - SNAP policy configuration
  - State option elections
  - Federal requirement tracking
  - Policy effective dates

### 3.5 Federal Law Tracker
- **URL:** `/admin/federal-law-tracker`
- **Features:**
  - Federal legislation monitoring
  - Impact analysis on state programs
  - Compliance deadline tracking
  - Citation management

### 3.6 Security Dashboard
- **URL:** `/admin/security`
- **Role Required:** Admin
- **Features:**
  - Security Score card (overall security posture)
  - Total security events count
  - Failed login attempts monitoring
  - Active threats indicator
  - Recent Security Events table with severity indicators
  - Threat types: Brute Force, Suspicious IP, Session Anomaly
  - Real-time security monitoring

### 3.7 User Management
- **URL:** `/admin/users`
- **Role Required:** Admin
- **Features:**
  - Total users count with role breakdown
  - Active users tracking
  - User search functionality
  - Role filter (All Roles, Admin, Staff, Researcher)
  - Status filter (All Status, Active, Inactive, Pending)
  - User table with: Username, Email, Role, Status, Last Active, Actions
  - User management actions

### 3.8 Analytics Dashboard
- **URL:** `/admin/analytics`
- **Role Required:** Admin
- **Features:**
  - KPI Cards:
    - Total Sessions
    - Unique Users
    - Average Session Duration
    - Total Page Views
  - Tabbed interface:
    - **Activity Tab:** Daily usage trends chart
    - **Features Tab:** Feature usage breakdown
    - **Programs Tab:** Benefits program popularity
    - **Users Tab:** User engagement metrics
  - Interactive Recharts visualizations

### 3.9 Benefits Access Review (BAR) Dashboard
- **URL:** `/admin/bar`
- **Role Required:** Admin
- **Features:**
  - Total Reviews count
  - Pending reviews indicator
  - Completed reviews with accuracy metrics
  - Average Score tracking
  - Tabbed interface:
    - **Review Queue:** Pending case reviews table
    - **Completed:** Finished reviews with outcomes
    - **Analytics:** BAR performance metrics
  - AI Assessment scores for case quality
  - Case review workflow integration

---

## 4. Payment Error Reduction (PER) Dashboard

### 4.1 Executive Overview
- **URL:** `/admin/per`
- **Tab:** Executive Overview
- **Features:**
  - KPI Cards:
    - Cases Scanned
    - Errors Prevented
    - Current Error Rate (Target %)
    - Active Nudges
  - Pending metrics:
    - Income Verifications
    - Consistency Checks
    - Duplicate Claims
  - State selector (Maryland)
  - System status indicator
  - PERM compliance status

### 4.2 Supervisor Dashboard
- **Tab:** Supervisor Dashboard
- **Features:**
  - Office-specific metrics (Tier 2 view)
  - LDSS office selector for filtering
  - Caseworker performance tracking
  - Coaching queue management

### 4.3 Risk Queue
- **Tab:** Risk Queue
- **Features:**
  - High-risk cases requiring review
  - Risk scoring breakdown
  - Priority assignment
  - Action buttons for case processing

### 4.4 High Priority Nudges
- **Tab:** High Priority Nudges
- **Features:**
  - AI-generated nudges for caseworkers
  - Nudge categories:
    - Income Discrepancy
    - Household Change
    - Work Requirement (ABAWD)
    - Documentation Gap
  - Nudge compliance tracking

### 4.5 Error Breakdown
- **Tab:** Error Breakdown
- **Features:**
  - Error category analysis
  - Top 4 SNAP Payment Error categories:
    - Wages/Salaries (27% of errors)
    - Shelter Deductions (18%)
    - Household Composition (15%)
    - ABAWD Time Limits (12%)

### 4.6 PERM Compliance
- **Tab:** PERM Compliance
- **Features:**
  - Payment Error Rate Measurement reporting
  - Federal compliance metrics
  - Sample case tracking
  - Audit preparation tools

### 4.7 LDSS League
- **Tab:** LDSS League
- **Features:**
  - Office performance rankings
  - Trophy/badge recognition:
    - Gold tier
    - Silver tier
    - Bronze tier
  - Podium display for top 3 offices
  - Performance metrics comparison table

---

## 5. E&E Synthetic Database (Digital Twin)

### 5.1 Health Endpoint
- **URL:** `/api/ee-synthetic/health`
- **Current Statistics:**
  - Status: Healthy
  - Total Records: 588 individuals
  - Total Cases: 200
  - Active Cases: 153
  - Closed Cases: 47
  - Churn Cases: 78

### 5.2 Data Distribution
- **Income Records:** 343
- **Resource Records:** 92
- **Expense Records:** 419
- **Verification Records:** 1,188
- **ABAWD Records:** 15
- **Homeless Individuals:** 33 (5.6% rate)

### 5.3 Database Tables (14 Tables)
1. `eeSyntheticIndividuals` - Core individual records
2. `eeSyntheticContacts` - 48 fields (employer info, emergency contacts)
3. `eeSyntheticAddresses` - 42 fields (homeless indicators, shelter tracking)
4. `eeSyntheticIdentification` - SSN, identity documents
5. `eeSyntheticCases` - Case management records
6. `eeSyntheticProgramEnrollments` - Multi-program enrollment
7. `eeSyntheticProviders` - Healthcare providers
8. `eeSyntheticCaseClosures` - Case closure tracking
9. `eeSyntheticCaseMembers` - Household composition
10. `eeSyntheticIncome` - NDNH/SWICA wage verification
11. `eeSyntheticResources` - Countable assets
12. `eeSyntheticExpenses` - Shelter/medical/childcare deductions
13. `eeSyntheticVerifications` - Document tracking
14. `eeSyntheticAbawd` - Work requirement tracking

### 5.4 Compliance
- **Field Compliance:** 172+ Maryland E&E Data Dictionary fields implemented
- **LDSS Distribution:** Cases distributed across 24 Maryland offices
- **Wage Verification:** NDNH and SWICA integration flags

---

## 6. Neuro-Symbolic Hybrid Gateway

### 6.1 Verification Modes
- **Mode 1 (Explanation Verification):** Tests if AI responses are legally consistent with statute
- **Mode 2 (Case Eligibility Verification):** Authoritative eligibility decision-maker
- **Dual Verification:** Parallel verification with cross-validation

### 6.2 Z3 Solver Integration
- SAT = Legally valid determination
- UNSAT = Violation with statutory citations
- UNSAT Core provides specific rule citations for appeals

---

## 7. Grant Alignment Summary

| Source Document | Key Features Demonstrated |
|----------------|--------------------------|
| E&E Data Dictionary | 172+ fields in synthetic database |
| PTIG Application ($1.7M) | PER Module, PERM Reporting |
| Arnold Ventures ($900K) | Neuro-Symbolic Gateway, Z3 Solver |
| JAWN Paper | Rules-as-Code, Dual Verification |
| OBA Task Force | Cross-Enrollment Intelligence |
| PBIF/PTIG Combined | Multi-tenant LDSS architecture |

---

## 8. Demo Account Credentials

| Username | Role | Access Level |
|----------|------|--------------|
| demo.admin | Administrator | Full system access |
| demo.navigator | Navigator/Caseworker | Case management, eligibility |
| demo.researcher | Researcher | Analytics, read-only data |

---

## 9. Technical Specifications

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Express.js, PostgreSQL (Neon), Drizzle ORM
- **AI:** Google Gemini API (extraction/translation only)
- **Symbolic Engine:** Z3 Solver (eligibility decisions)
- **Benefit Calculations:** PolicyEngine API
- **Compliance:** GDPR, HIPAA, WCAG 2.1 AA

---

*Document generated for Georgetown University/Arnold Ventures grant demonstration.*

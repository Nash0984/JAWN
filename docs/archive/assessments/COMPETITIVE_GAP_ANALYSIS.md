# Competitive Gap Analysis & Feature Prioritization
**Date:** October 20, 2025  
**Competitors Analyzed:** mRelief, GetCalFresh, Propel, Beam Benefits  
**JAWN Current Status:** 92/93 features implemented (98.9% complete)

---

## Executive Summary

JAWN has achieved exceptional feature completeness (98.9%) with a unique value proposition: **the only platform combining benefits eligibility with tax preparation and AI cross-enrollment intelligence**. However, competitive analysis reveals strategic gaps in:

1. **EBT Financial Tools** (Propel's 5M-user stronghold)
2. **Multi-Channel Access** (mRelief's phone/SMS coverage)
3. **Geographic Reach** (mRelief's 50-state coverage vs. JAWN's Maryland-only)
4. **Consumer Engagement** (discount marketplaces, spending insights)

**Key Insight:** No competitor offers benefits + tax integration. JAWN should maintain this differentiation while selectively adopting high-impact features from category leaders.

---

## Competitor Landscape Analysis

### **mRelief** - Eligibility Screening Leader
**Market Position:** Nonprofit SNAP screening platform  
**Scale:** $1.4B benefits unlocked, 4M+ users, 50 states  
**Key Strengths:**
- Multi-channel access (web, SMS, **voice/phone**)
- 50-state coverage with state-agnostic templates
- 70% approval rate (vs. 58% national average)
- CBO CRM tool "Johnnie"
- AI document verification (GitLab Foundation grant 2025)
- Ultra-fast: 3-minute screening, 13-minute applications

**JAWN Gaps vs. mRelief:**
- ❌ **Voice/phone channel** (mRelief has, JAWN planned)
- ❌ **50-state coverage** (mRelief has, JAWN Maryland-only)
- ⚠️  **CBO portal maturity** (JAWN has basic, mRelief has full CRM)
- ✅ JAWN advantage: **Tax preparation integration** (mRelief doesn't have)

---

### **GetCalFresh** - State Application Platform
**Market Position:** California SNAP application portal (Code for America)  
**Scale:** $11.5B delivered, 7M+ households  
**Status:** **Sunsetting September 2025** (replaced by BenefitsCal)  
**Key Strengths:**
- Mobile-first, 10-12 minute applications
- Photo document upload
- CBO dashboard
- SMS/email reminders
- Multi-language (English, Spanish, Chinese)

**JAWN Gaps vs. GetCalFresh:**
- ✅ JAWN already has: Mobile-optimized, photo upload, document management
- ⚠️  Multi-language support (JAWN has 10 languages, GetCalFresh has 3)
- ✅ JAWN advantage: **Cross-program eligibility** (GetCalFresh is SNAP-only)

**Note:** GetCalFresh is retiring, so learning from their transition to BenefitsCal (multi-program portal) validates JAWN's integrated approach.

---

### **Propel (Fresh EBT)** - #1 EBT Management App
**Market Position:** Consumer fintech for EBT cardholders  
**Scale:** 5M+ users, 52 states/territories, nearly 1M 5-star reviews  
**Key Strengths:**
- ✅ **Real-time EBT balance checking**
- ✅ **12-month transaction history tracking**
- ✅ **Spending insights & analytics**
- ✅ **EBT card locking/security features** (31+ states)
- ✅ **Fraud monitoring** (30+ states)
- ✅ **Exclusive discount marketplace** (Instacart, Amazon, Walmart partners)
- ✅ **Job board** (gig + full-time work)
- ✅ **Multi-benefit tracking** (SNAP, WIC, TANF, SSI, tax refunds)
- ✅ **Mobile banking** (Providers Card with early direct deposit)

**JAWN Gaps vs. Propel:**
- ❌ **EBT balance tracking** (Propel's core feature)
- ❌ **Transaction history & spending insights**
- ❌ **Discount marketplace & exclusive deals**
- ❌ **Job board integration**
- ❌ **EBT security features** (card locking, fraud alerts)
- ✅ JAWN advantage: **Eligibility screening + tax prep** (Propel doesn't have)

**Strategic Insight:** Propel dominates post-approval engagement. JAWN could integrate EBT tools to create end-to-end journey: eligibility → application → approval → benefit management → tax optimization.

---

### **Beam Benefits** - Employee Benefits Platform
**Market Position:** Insurtech for employer dental/vision benefits  
**Scale:** 45+ states, 300+ employees  
**Relevance:** ❌ **NOT A COMPETITOR** (different market: employer benefits, not public assistance)  
**Note:** Beam Perks discount program **ending May 2025** due to low engagement.

---

## Competitive Gap Matrix

| Gap Category | Feature | Competitor Leader | Market Size | JAWN Status | Priority Rank |
|-------------|---------|-------------------|-------------|-------------|--------------|
| **EBT Financial Tools** | Real-time balance checking | Propel (5M users) | Very High | ❌ Missing | **#1** |
| | Transaction history (12 months) | Propel | High | ❌ Missing | **#2** |
| | Spending insights & analytics | Propel | High | ❌ Missing | **#4** |
| **Multi-Channel Access** | Voice/Phone IVR system | mRelief | High | ⏳ Planned | **#3** |
| | SMS screening links | mRelief, JAWN | High | ✅ Built (Oct 2025) | ✅ |
| **Geographic Expansion** | 50-state coverage | mRelief | Very High | ❌ Missing (MD only) | **#5** |
| **Consumer Engagement** | Discount marketplace partners | Propel | Medium | ❌ Missing | **#7** |
| | Job board integration | Propel | Medium | ❌ Missing | **#9** |
| **Security** | EBT card locking | Propel (31+ states) | Medium | ❌ Missing | **#6** |
| | Fraud monitoring & alerts | Propel (30+ states) | Medium | ❌ Missing | **#8** |
| **Organizational Tools** | Enhanced CBO portal (CRM) | mRelief ("Johnnie") | Medium | ⚠️  Basic | **#10** |
| **Accessibility** | Kiosk mode (in-person sites) | mRelief | Low | ❌ Missing | **#11** |

---

## Prioritized Feature Roadmap by Market Impact

### **Tier 1: High-Impact, Revenue-Generating** 💰
Features that unlock new user segments or create competitive moats.

#### **#1: EBT Balance Tracking & Transaction History** ⭐
**Competitor:** Propel (5M users)  
**Market Impact:** **VERY HIGH** - Engages 42M SNAP recipients post-approval  
**Technical Effort:** **MEDIUM**  
**Revenue Potential:** **HIGH** (data insights for fintech partnerships, ad marketplace)

**Why Prioritize:**
- Propel proves massive demand (5M users, #1 app)
- Extends JAWN from pre-approval → post-approval lifecycle
- Creates daily engagement (vs. annual tax cycle)
- Enables spending pattern insights for cross-enrollment AI

**Technical Requirements:**
- State EBT portal integrations (52 states)
- Real-time API connections (Quest, ebtEDGE, ConnectEBT, etc.)
- Secure credential management (OAuth, encryption)
- Transaction parsing & categorization
- 12-month history storage

**Dependencies:**
- State data use agreements
- EBT system API access (varies by state)
- Compliance: PCI DSS (if storing card data), data privacy regulations

**Time Estimate:** 8-12 weeks (per state), start with Maryland/pilot states

---

#### **#2: Voice/Phone IVR System** ⭐
**Competitor:** mRelief  
**Market Impact:** **HIGH** - Reaches low-literacy, elderly, non-smartphone users  
**Technical Effort:** **MEDIUM**  
**Revenue Potential:** **MEDIUM** (public contracts, CBO partnerships)

**Why Prioritize:**
- mRelief proves phone access drives inclusivity (70% approval rate)
- Critical for VITA tax sites (many clients lack smartphones)
- Differentiator for government RFPs (accessibility requirements)
- Complements existing SMS infrastructure

**Technical Requirements:**
- Twilio Voice API integration
- Interactive Voice Response (IVR) menu system
- Speech-to-text transcription (Gemini Speech API or Twilio)
- Call routing and queue management
- Voicemail-to-SMS/email forwarding

**Dependencies:**
- Twilio account setup (already configured for SMS)
- Phone number acquisition (1-800 number)
- Call recording compliance (state laws vary)

**Time Estimate:** 6-8 weeks

**Status:** Infrastructure partially ready (Twilio account, call queue tables exist in schema)

---

#### **#3: 50-State Expansion (Multi-State Rules Engine)** ⭐
**Competitor:** mRelief (50 states)  
**Market Impact:** **VERY HIGH** - Unlocks national market (42M SNAP recipients vs. 780K in MD)  
**Technical Effort:** **HIGH**  
**Revenue Potential:** **VERY HIGH** (10-50x addressable market)

**Why Prioritize:**
- mRelief's success proves 50-state model viability ($1.4B unlocked)
- Government contracts prefer national solutions
- Tax preparation is inherently multi-state (people move)
- PolicyEngine already supports all 50 states

**Technical Requirements:**
- State-specific rules engines (SNAP, Medicaid, TANF, OHEP equivalents)
- State benefit program mapping (each state names programs differently)
- State policy document tracking (50 state legislatures)
- Multi-state tax return support (state income tax systems)
- State-specific form libraries

**Dependencies:**
- State program research (benefit amounts, eligibility rules)
- State policy manual access (public records requests)
- State e-filing credentials (if offering e-file)
- PolicyEngine state coverage validation

**Time Estimate:** 3-6 months (pilot with 5 high-population states first: CA, TX, FL, NY, IL)

**Phased Approach:**
1. **Phase 1** (Month 1-2): California, New York, Texas (high population)
2. **Phase 2** (Month 3-4): Florida, Illinois, Pennsylvania
3. **Phase 3** (Month 5-6): Remaining 44 states (template-driven)

---

### **Tier 2: User Engagement & Retention** 📈
Features that increase daily active users and stickiness.

#### **#4: Spending Insights & Budget Analytics** ⭐
**Competitor:** Propel  
**Market Impact:** **HIGH** - Helps users stretch benefits, reduces food insecurity  
**Technical Effort:** **MEDIUM**  
**Revenue Potential:** **MEDIUM** (premium tier, fintech partnerships)

**Why Prioritize:**
- Natural extension of EBT balance tracking (#1)
- Builds on JAWN's AI capabilities (cross-enrollment intelligence)
- Creates actionable insights (grocery budgeting, savings opportunities)
- Differentiates from Propel (add tax optimization angle)

**Technical Requirements:**
- Transaction categorization AI (Gemini or rule-based)
- Spending pattern analysis (monthly trends, anomaly detection)
- Budget forecasting (predict benefit exhaustion date)
- Savings recommendations (SNAP-approved stores with better prices)
- Integration with tax data (estimate refund impact on budget)

**Dependencies:**
- EBT transaction data (#1 must be implemented first)
- Merchant categorization database (grocery vs. convenience store)

**Time Estimate:** 4-6 weeks (after #1 complete)

---

#### **#5: EBT Security Features (Card Locking, Fraud Alerts)** ⭐
**Competitor:** Propel (31+ states)  
**Market Impact:** **MEDIUM** - Addresses EBT theft epidemic (rising concern 2024-2025)  
**Technical Effort:** **MEDIUM-HIGH**  
**Revenue Potential:** **LOW** (public good, potential state contracts)

**Why Prioritize:**
- EBT skimming/theft is major user pain point (news coverage 2024-2025)
- State governments actively seeking fraud prevention solutions
- Builds trust and security reputation
- Competitive parity with Propel

**Technical Requirements:**
- State EBT system integration for card controls
- Real-time fraud detection algorithms
- Push notifications for suspicious transactions
- Out-of-state transaction blocking (31+ states support)
- Card lock/unlock UI (instant activation)

**Dependencies:**
- State EBT portal API access (varies by state)
- State participation in card control features (not all states support)

**Time Estimate:** 6-8 weeks (per state), pilot with Maryland first

---

### **Tier 3: Marketplace & Partnerships** 🤝
Features that create revenue streams and ecosystem value.

#### **#6: Discount Marketplace (EBT-Exclusive Deals)** ⭐
**Competitor:** Propel (Instacart, Amazon, Walmart partners)  
**Market Impact:** **MEDIUM** - Stretches user benefits, creates partnership revenue  
**Technical Effort:** **MEDIUM**  
**Revenue Potential:** **HIGH** (affiliate commissions, sponsored placements)

**Why Prioritize:**
- Proven model (Propel has partnerships with major retailers)
- Creates non-government revenue stream (sustainability)
- Increases user engagement (daily deal checking)
- Aligns with JAWN's mission (maximize financial well-being)

**Technical Requirements:**
- Partner API integrations (Instacart, Amazon Fresh, Walmart+, Target)
- Coupon/deal aggregation system
- Geo-location based deal filtering (local grocery stores)
- Click tracking for affiliate revenue
- Deal expiration management

**Dependencies:**
- Partnership agreements (revenue sharing terms)
- EBT-eligibility verification system
- Compliance with SNAP promotional restrictions

**Time Estimate:** 8-12 weeks (partnership negotiations + technical integration)

**Potential Partners:**
- **Groceries:** Instacart (EBT accepted), Amazon Fresh, Walmart Grocery
- **Phone Plans:** Lifeline/ACP providers (free government phones)
- **Utilities:** Low-income discount programs (energy, internet)
- **Transportation:** Reduced fare transit passes

---

#### **#7: Job Board Integration** ⭐
**Competitor:** Propel  
**Market Impact:** **MEDIUM** - Addresses income stability (root cause of benefit need)  
**Technical Effort:** **LOW-MEDIUM**  
**Revenue Potential:** **MEDIUM** (job listing fees, placement commissions)

**Why Prioritize:**
- Aligns with SNAP E&T (Employment & Training) requirements
- Creates pathway out of benefits dependency
- Low technical lift (API integrations with existing job boards)
- Differentiation: tie job income to benefits impact (what-if modeling)

**Technical Requirements:**
- Job board API integration (Indeed, ZipRecruiter, Snagajob)
- Geo-location job filtering (local opportunities)
- Benefits impact calculator (what-if new income reduces SNAP?)
- Application tracking (applied, interviewed, hired)

**Dependencies:**
- Job board partnership agreements
- Resume builder integration (optional enhancement)

**Time Estimate:** 4-6 weeks

**JAWN Differentiation:** Show users how job income affects benefit eligibility in real-time (Financial Opportunity Radar integration).

---

### **Tier 4: Organizational & Infrastructure** 🏛️
Features that support scaling and partnerships.

#### **#8: Enhanced CBO Portal (CRM "Johnnie" Style)** ⭐
**Competitor:** mRelief ("Johnnie" CRM)  
**Market Impact:** **MEDIUM** - Supports community organizations (JAWN's key partners)  
**Technical Effort:** **MEDIUM-HIGH**  
**Revenue Potential:** **LOW** (mission-driven, enables government contracts)

**Why Prioritize:**
- Community organizations are JAWN's distribution channel
- mRelief proves demand (CBOs love "Johnnie" for case management)
- Government RFPs often require CBO support tools
- VITA sites need volunteer management tools

**Technical Requirements:**
- Client relationship management (CRM) database
- Communication tools (SMS/email from CBO to clients)
- Document tracking (upload status, missing docs alerts)
- Case notes and follow-up reminders
- Multi-user permissions (CBO staff roles)
- Reporting dashboard (clients served, conversion rates)

**Dependencies:**
- CBO user research (feature requirements)
- Multi-tenant architecture (already exists in JAWN)

**Time Estimate:** 8-12 weeks

---

#### **#9: Kiosk Mode (In-Person Public Access)** ⭐
**Competitor:** mRelief (mentioned but limited info)  
**Market Impact:** **LOW-MEDIUM** - Serves non-internet users at libraries, DHS offices  
**Technical Effort:** **LOW**  
**Revenue Potential:** **LOW** (public good, some government contracts)

**Why Prioritize:**
- Low technical lift (simplified UI for public terminals)
- Addresses digital divide (15% of low-income households lack internet)
- VITA tax sites can deploy kiosks (in-person drop-in screening)

**Technical Requirements:**
- Fullscreen kiosk mode (hide browser controls)
- Session timeout/reset (auto-logout after inactivity)
- Print receipts (screening results summary)
- No login required (anonymous screening)
- Accessibility mode (large text, high contrast)

**Dependencies:**
- Hardware partnerships (kiosk terminals, printers)
- Public space agreements (libraries, DHS offices)

**Time Estimate:** 2-3 weeks

---

### **Tier 5: Compliance & SSI Integration** 🏥
**#10: SSI (Supplemental Security Income) Program** ⭐
**Competitor:** None (gap in market)  
**Market Impact:** **HIGH** - 7.4M SSI recipients (disabled, elderly)  
**Technical Effort:** **HIGH**  
**Revenue Potential:** **MEDIUM** (government contracts, advocacy funding)

**Why Prioritize:**
- No competitor integrates SSI with benefits screening
- SSI recipients often eligible for multiple programs (SNAP, Medicaid, housing)
- Cross-enrollment opportunity (many eligible SSI recipients don't claim)
- FEATURES.md lists as "planned for future development"

**Technical Requirements:**
- SSI eligibility rules engine (income, asset limits, disability criteria)
- Integration with PolicyEngine SSI module (verify if exists)
- SSA (Social Security Administration) data integration (if possible)
- Disability documentation guidance
- Appeals process tracking (SSI denials are common)

**Dependencies:**
- SSI program policy research (federal rules, state supplements)
- Legal expertise (disability law is complex)
- Advocacy partnerships (disability rights organizations)

**Time Estimate:** 12-16 weeks

**Note:** This is already documented as planned in FEATURES.md.

---

## Implementation Sequencing Strategy

### **Phase 1: EBT Ecosystem Entry** (Months 1-3)
Build Propel-competitive features to capture post-approval market.

1. **EBT Balance Tracking** (#1) - 8-12 weeks
2. **Spending Insights** (#4) - 4-6 weeks (parallel after #1 data layer)
3. **EBT Security** (#5) - 6-8 weeks (parallel with #1)

**Outcome:** JAWN becomes full-lifecycle platform (screening → application → benefit management).

---

### **Phase 2: Multi-Channel Expansion** (Months 4-6)
Address accessibility and reach gaps vs. mRelief.

4. **Voice/Phone IVR** (#2) - 6-8 weeks
5. **Kiosk Mode** (#9) - 2-3 weeks (quick win)

**Outcome:** Omnichannel access (web, mobile, SMS, voice, kiosk).

---

### **Phase 3: Geographic Scaling** (Months 7-12)
Unlock national market.

6. **50-State Expansion** (#3) - 3-6 months (pilot with CA, NY, TX, FL, IL first)

**Outcome:** National addressable market (42M SNAP recipients vs. 780K MD-only).

---

### **Phase 4: Marketplace & Revenue Diversification** (Months 13-15)
Create sustainable revenue streams.

7. **Discount Marketplace** (#6) - 8-12 weeks
8. **Job Board** (#7) - 4-6 weeks

**Outcome:** Non-government revenue, increased daily engagement.

---

### **Phase 5: Organizational Support & SSI** (Months 16-20)
Deepen CBO partnerships and add SSI program.

9. **Enhanced CBO Portal** (#8) - 8-12 weeks
10. **SSI Program Integration** (#10) - 12-16 weeks

**Outcome:** Government contract readiness, full program coverage.

---

## Competitive Differentiation Matrix

| Feature Category | JAWN Unique Advantage | Competitor Leader | Market Gap |
|------------------|----------------------|-------------------|------------|
| **Benefits + Tax Integration** | ✅ **Only platform combining eligibility with e-filing** | None | **JAWN-exclusive** |
| **Cross-Enrollment Intelligence** | ✅ AI-powered unclaimed benefits detection | None | **JAWN-exclusive** |
| **Maryland Rules-as-Code** | ✅ State-specific deterministic rules (not just PolicyEngine) | None | **JAWN-exclusive** |
| **Multi-Program Screening** | ✅ 6 programs (SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI) | mRelief (SNAP-focused) | JAWN more comprehensive |
| **EBT Management** | ❌ Missing (Propel has 5M users) | **Propel** | **Add this** (#1 priority) |
| **Voice/Phone Channel** | ⏳ Planned | **mRelief** | **Add this** (#2 priority) |
| **50-State Coverage** | ❌ MD-only | **mRelief** (50 states) | **Add this** (#3 priority) |

---

## Revenue Model Opportunities

### **Current (Government-Funded)**
- County/state contracts for benefit screening
- VITA site licenses
- CBO partnerships

### **New (Diversified Revenue)**
1. **Discount Marketplace Affiliate Revenue** (#6) - $500K-$2M/year potential (based on Propel's scale)
2. **Job Board Listing Fees** (#7) - $200K-$500K/year
3. **Premium CBO Tools** (#8) - $50-$200/month per CBO (500 CBOs = $300K-$1.2M/year)
4. **Data Insights (Anonymized)** - Policy research sales to nonprofits/academia
5. **White-Label Licensing** - License JAWN to other states ($100K-$500K per state)

**Total New Revenue Potential:** $1M-$4M annually (conservative estimate)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **EBT portal API access denied** | Medium | High | Start with Maryland (existing relationship), expand state-by-state |
| **Partnership negotiations stall** | Medium | Medium | Build marketplace in-house first, add partners iteratively |
| **50-state expansion costs exceed budget** | High | High | Phased rollout (5 states/phase), prioritize high-population states |
| **Propel competitive response** | Medium | Medium | Maintain tax prep differentiation, move fast on EBT features |
| **State policy changes break rules engines** | High | Medium | Already mitigated (Smart Scheduler monitors policy updates) |

---

## Recommendations

### **Immediate Actions (Next 30 Days)**
1. ✅ **Validate EBT integration feasibility** - Contact Maryland DHS, check API access
2. ✅ **Twilio Voice setup** - Acquire 1-800 number, test IVR menu prototypes
3. ✅ **California expansion research** - PolicyEngine CA rules validation, CalFresh policy manual access

### **Strategic Priorities (Next 6 Months)**
1. **Build EBT ecosystem** (Tier 1: #1, #4, #5) - Compete directly with Propel
2. **Add voice channel** (Tier 1: #2) - Match mRelief's accessibility
3. **Pilot multi-state** (Tier 1: #3) - Start with California or New York

### **Long-Term Vision (12-24 Months)**
- Become **national platform** (50 states)
- Own **full user lifecycle** (screening → application → benefit management → tax optimization)
- Diversify revenue beyond government contracts (marketplace, CBO tools, licensing)

---

## Conclusion

JAWN's **benefits + tax integration** is a unique competitive moat that no competitor can easily replicate. However, to achieve national scale and sustainable revenue, JAWN must:

1. **Match Propel's EBT management** (capture post-approval engagement)
2. **Match mRelief's accessibility** (voice channel, 50-state coverage)
3. **Monetize marketplace & data** (reduce dependency on government funding)

**Bottom Line:** JAWN is 92/93 features complete with a differentiated product. The next phase is strategic expansion into EBT management, multi-channel access, and geographic scaling to unlock the $100M+ TAM (total addressable market) in benefits optimization.

---

**Report Prepared:** October 20, 2025  
**Next Review:** After Phase 1 EBT features launch (3-month milestone)

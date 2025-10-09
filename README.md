# Maryland SNAP Policy Manual System

An AI-powered platform for Maryland's Food Supplement Program (SNAP) that helps users verify documents and navigate benefit policies through intelligent search and document processing.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Google Gemini API key
- Google Cloud Storage access

### Installation

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository-url>
   cd maryland-snap-system
   npm install
   ```

2. **Environment Setup**
   Create a `.env` file with required variables:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   DATABASE_URL=your_postgresql_connection_string
   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
   SESSION_SECRET=your_secure_random_string
   ```

3. **Database Setup**
   ```bash
   npm run db:push
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 🔑 Demo Accounts

The system includes pre-configured demo accounts for testing all role-based features. On the login page, click **"Use Demo Account"** to see all available credentials:

| Role | Username | Password | Description |
|------|----------|----------|-------------|
| **Applicant** | `demo.applicant` | `Demo2024!` | Test the applicant experience |
| **Navigator** | `demo.navigator` | `Demo2024!` | Benefits navigator tools and client management |
| **Caseworker** | `demo.caseworker` | `Demo2024!` | Case management features and DHS tools |
| **Admin** | `demo.admin` | `Demo2024!` | Full system administration and analytics |

> 💡 **Tip**: These accounts are automatically seeded on system startup, making preview and testing instant without manual setup.

## 🌟 Key Features

### PolicyEngine Integration
- **Multi-Benefit Calculations**: Accurate federal and state-specific benefit estimates for SNAP, Medicaid, EITC, CTC, SSI, and TANF
- **Household Modeling**: Calculate benefits based on family composition, income, and expenses
- **What-If Scenarios**: Test different income or expense changes to optimize benefits
- **Real-Time Results**: Instant benefit calculations powered by PolicyEngine's policy engine

### Adaptive Intake Copilot
- **Conversational Application**: AI-powered dialogue guides applicants through the SNAP application process
- **Smart Data Extraction**: Automatically structures household information from natural conversation
- **Progress Tracking**: Visual indicators show application completeness
- **Integrated Calculations**: Real-time benefit estimates during intake using PolicyEngine

### Household Scenario Workspace
- **What-If Modeling**: Create and compare multiple household scenarios with different income/expense profiles
- **Visual Comparisons**: Side-by-side benefit outcome charts using Recharts
- **PDF Reports**: Export client counseling reports with household details and benefit calculations
- **Optimization Tools**: Help navigators identify strategies to maximize client benefits

### Anonymous Benefit Screener
- **No Login Required**: Public access at `/screener` for immediate eligibility checks
- **Privacy-First**: Anonymous sessions protect applicant privacy
- **Save Results**: Option to create account and migrate screening data
- **Multi-Benefit Output**: Check eligibility for all Maryland programs at once

### Document Verification
- **Upload Documents**: Mobile photos or PDF files
- **AI Analysis**: Google Gemini-powered document verification
- **Requirements Check**: Automatic SNAP eligibility verification
- **Plain English Results**: Easy-to-understand explanations

### Conversational Search
- **Natural Language Queries**: Ask questions in plain English
- **Official Policy Citations**: Responses backed by Maryland SNAP manual
- **Reading Level Optimized**: Grade 6-8 reading level for accessibility
- **Multi-Language Support**: 10 languages including Spanish, French, Chinese

### Maryland Integration
- **Official Branding**: Maryland Digital Style Guide compliance
- **State Seal Integration**: Official Maryland state seal
- **Mobile-First Design**: Fully responsive, works on phones, tablets, and desktops
- **Accessibility Compliant**: WCAG 2.1 AA standards

## 🏗️ Architecture Overview

### Frontend (React + TypeScript)
- **UI Framework**: React 18 with shadcn/ui components
- **Styling**: Tailwind CSS with Maryland branding
- **Routing**: Wouter for client-side navigation
- **State Management**: TanStack Query for server state
- **Language Access**: Multi-language support with translations

### Backend (Express + TypeScript)
- **API Framework**: Express.js with RESTful endpoints
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: Google Gemini API (Gemini-1.5-pro, text-embedding-004)
- **File Storage**: Google Cloud Storage
- **Session Management**: PostgreSQL-backed sessions

### Key Services
- **RAG Service**: Retrieval-Augmented Generation for policy search
- **PolicyEngine Service**: Multi-benefit calculations and eligibility determinations
- **Document Processor**: OCR and AI-powered document analysis
- **Reading Level Service**: Plain language compliance validation
- **Language Service**: Multi-language translation system
- **Cache Service**: Server-side caching with 5-minute TTL for performance
- **Security Services**: CSRF protection, rate limiting, and security headers
- **PDF Export Service**: Client counseling reports and scenario analysis exports

## 📱 Mobile Compatibility

This application is **fully mobile-responsive** and works seamlessly across all devices:

### ✅ Supported Platforms
- **Mobile Browsers**: iOS Safari, Chrome, Firefox on smartphones
- **Tablet Browsers**: iPad Safari, Android Chrome
- **Desktop Browsers**: Chrome, Firefox, Safari, Edge

### 📐 Responsive Features
- **Touch-Optimized**: All buttons, forms, and controls are sized appropriately for touch interaction
- **Mobile-First Design**: UI adapts from 320px (small phones) to 4K displays
- **Flexible Layouts**: Components reflow and resize based on screen size
- **Camera Integration**: Direct photo upload from mobile device cameras for document verification

### 🎯 Mobile-Specific Optimizations
- **Benefit Screener**: Optimized for on-the-go eligibility checks
- **Intake Copilot**: Works great for field interviews on tablets
- **Scenario Workspace**: Responsive charts and PDF generation on all devices
- **Demo Login**: One-tap demo account access on mobile login screen

## 📱 Usage Guide

### For Benefit Recipients
1. **Check Eligibility**: Use the anonymous screener at `/screener` - no login needed
2. **Ask Questions**: Use the main search interface to ask about SNAP benefits
3. **Apply Online**: Guided intake copilot walks you through the application at `/intake`
4. **Verify Documents**: Upload photos of paystubs, bank statements, or other documents
5. **Get Plain English Answers**: Receive clear, easy-to-understand responses
6. **Multi-Language Support**: Switch to your preferred language

### For Navigators
1. **Client Screening**: Quick benefit calculations using PolicyEngine
2. **Scenario Modeling**: Create what-if scenarios to optimize client benefits at `/scenarios`
3. **Policy Search**: Find specific SNAP policy information quickly
4. **Document Guidance**: Help clients understand document requirements  
5. **Export Reports**: Generate PDF counseling reports for client meetings
6. **Training Resources**: Access system training and help materials

## 🛠️ Development Guide

### Project Structure
```
maryland-snap-system/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-based page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utility functions and configurations
├── server/                 # Backend Express application
│   ├── services/           # Business logic and AI services
│   ├── routes.ts           # API endpoint definitions
│   └── storage.ts          # Database layer
├── shared/                 # Shared TypeScript types and schemas
│   └── schema.ts           # Drizzle database schema
└── public/                 # Static assets
```

### Key Commands
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run db:push          # Synchronize database schema
npm run db:studio        # Open database explorer
npx vitest               # Run test suite
npx vitest --ui          # Run tests with UI
npx vitest --coverage    # Run tests with coverage
npm run lint             # Run code linting
```

### Adding New Features

1. **Database Changes**: Update `shared/schema.ts` and run `npm run db:push`
2. **API Endpoints**: Add routes in `server/routes.ts`
3. **Frontend Components**: Create in `client/src/components/`
4. **Translations**: Update `client/src/hooks/useLanguage.ts`

## 🌐 Language Access Features

### Supported Languages
- English (primary)
- Spanish (Español)
- French (Français) 
- Portuguese (Português)
- Chinese (中文)
- Korean (한국어)
- Vietnamese (Tiếng Việt)
- Arabic (العربية)
- Somali (Soomaali)
- Amharic (አማርኛ)

### Reading Level Compliance
- **Target Level**: Grade 6-8 reading level
- **Automatic Validation**: AI responses checked for readability
- **Plain Language**: Complex terms replaced with simple alternatives
- **Flesch-Kincaid Scoring**: Automatic readability assessment

## 🔧 Configuration

### Maryland Branding
The system implements Maryland Digital Style Guide (2023):
- **Colors**: Official red (#c8122c), gold (#ffc838), black (#231f20), white (#ffffff)
- **Typography**: Montserrat font family
- **Logo**: Official Maryland state seal integration
- **Accessibility**: WCAG 2.1 AA compliance

### AI Configuration
- **Primary Model**: Google Gemini-1.5-pro for text generation
- **Embeddings**: text-embedding-004 for semantic search
- **Vision**: Gemini-1.5-pro-vision for document analysis
- **Reading Level**: Automatic grade 6-8 optimization

## 📊 Monitoring and Analytics

### System Health
- API response times and error rates
- Database performance metrics  
- AI service usage and costs
- User experience tracking

### Content Analytics
- Search query patterns and success rates
- Document verification accuracy
- Language preference distribution
- User journey analysis

## 🚢 Deployment

### Production Deployment on Replit
1. **Environment Variables**: Set all required secrets in Replit
2. **Database**: Configure PostgreSQL connection
3. **Storage**: Set up Google Cloud Storage credentials
4. **Domain**: Configure custom domain (optional)

### Health Checks
- `/api/health` - Basic health check
- `/api/system/status` - Detailed system status
- Database connectivity verification
- AI service availability check

## 🔒 Security & Performance

### Security Features (Production-Ready)
- **CSRF Protection**: Double-submit cookie pattern for all state-changing requests
- **Rate Limiting**: Three-tier protection (100/15min general, 5/15min auth, 20/min AI)
- **Security Headers**: Helmet middleware with environment-aware CSP and HSTS
- **Trust Proxy**: Configured for load balancer compatibility

### Performance Optimizations
- **Server-Side Caching**: NodeCache with 5-minute TTL and auto-invalidation
- **Database Indexes**: Strategic indexing for 2-10x query performance
- **Lazy Loading**: Component-level code splitting for faster initial loads

### User Experience Enhancements
- **Command Palette**: Cmd+K quick navigation with role-based filtering
- **Framer Motion**: Smooth animations for results, notifications, and feedback
- **Resizable Panels**: Split-view document verification with adjustable layout
- **Skeleton Loading**: Comprehensive placeholders prevent layout shift

### Testing Infrastructure
- **Vitest**: Modern testing framework with happy-dom environment
- **Component Tests**: React Testing Library integration
- **API Tests**: Supertest for endpoint integration testing
- **Test Coverage**: V8 provider with comprehensive reporting

## 📚 Additional Resources

### Documentation
- [Technical Documentation](./TECHNICAL_DOCUMENTATION.md) - Complete technical specs
- [API Documentation](./docs/API.md) - Endpoint specifications
- [Component Documentation](./docs/COMPONENTS.md) - Frontend component guide

### Support
- **User Support**: Contact Maryland SNAP program
- **Technical Issues**: Submit GitHub issues
- **Feature Requests**: Community discussions

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project is developed for Maryland Department of Human Services and follows applicable state and federal regulations for public benefit systems.

---

**Maryland SNAP Policy Manual System** - Empowering benefit access through intelligent technology.
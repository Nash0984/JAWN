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

## 🌟 Key Features

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
- **Mobile-First Design**: Optimized for mobile users
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
- **Document Processor**: OCR and AI-powered document analysis
- **Reading Level Service**: Plain language compliance validation
- **Language Service**: Multi-language translation system

## 📱 Usage Guide

### For Benefit Recipients
1. **Ask Questions**: Use the main search interface to ask about SNAP benefits
2. **Verify Documents**: Upload photos of paystubs, bank statements, or other documents
3. **Get Plain English Answers**: Receive clear, easy-to-understand responses
4. **Multi-Language Support**: Switch to your preferred language

### For Navigators
1. **Policy Search**: Find specific SNAP policy information quickly
2. **Document Guidance**: Help clients understand document requirements  
3. **Training Resources**: Access system training and help materials
4. **Administrative Tools**: Manage policy sources and system configuration

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
npm run dev          # Start development server
npm run build        # Build for production
npm run db:push      # Synchronize database schema
npm run db:studio    # Open database explorer
npm test             # Run test suite
npm run lint         # Run code linting
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
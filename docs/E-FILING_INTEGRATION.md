# E-Filing Integration Guide

## Overview

This guide provides comprehensive instructions for integrating production-ready federal and Maryland state e-filing capabilities into the Maryland Universal Benefits-Tax Service Delivery Platform. The current implementation provides a **foundational prototype** with core workflow infrastructure. Production deployment requires official credentials, schema validation, and compliance certification.

## Current Status

### ✅ Completed Foundation
- Form 1040 XML generator with complete field mapping
- Maryland Form 502 XML generator scaffolding
- E-file submission queue with status tracking (draft → ready → transmitted → accepted/rejected)
- Transmission ID management and audit trail
- Quality review workflow with retry logic
- Admin monitoring dashboard for submission tracking
- Database schema for federal and Maryland tax returns with e-file status fields

### ⏸️ Deferred for Production Credentials
- IRS MeF XSD schema validation
- Maryland iFile XML schema compliance
- Digital signature implementation (X.509 certificates)
- Secure transmission protocols (SOAP/REST)
- Production endpoint integration
- Automated acknowledgment processing

---

## Federal E-Filing: IRS Modernized e-File (MeF)

### 1. IRS Credentials & Registration

#### EFIN (Electronic Filing Identification Number)
**Purpose**: Unique identifier for authorized e-file providers issued by the IRS.

**Acquisition Process**:
1. **Register as IRS e-Services User**: [IRS e-Services Portal](https://www.irs.gov/e-file-providers/e-file-application)
2. **Complete Suitability Check**: IRS reviews background (fingerprinting may be required)
3. **Pass Testing Requirements**: Submit test returns in IRS test environment
4. **Receive EFIN**: Typically 45-60 days for approval

**Requirements**:
- Valid Tax Identification Number (TIN)
- Physical business address
- Fingerprinting for principals/responsible officials
- $50 application fee (2025)
- Compliance with IRS Circular 230 (tax preparer standards)

#### ETIN (Electronic Transmitter Identification Number)
**Purpose**: Identifier for software developers/transmitters if different from EFIN holder.

**When Required**: 
- Third-party software vendors transmitting on behalf of preparers
- Organizations with separate transmission infrastructure

#### Production Credentials
- **EFIN**: Store in environment variable `IRS_EFIN`
- **ETIN** (if applicable): Store in `IRS_ETIN`
- **Transmitter Control Code (TCC)**: Store in `IRS_TCC`
- **X.509 Digital Certificate**: Store private key securely (HSM or encrypted secrets vault)

### 2. IRS MeF Schema & Validation

#### XSD Schema Files (Required for Production)
The IRS publishes annual XML schemas that define the exact structure for e-filed returns.

**Download Location**: [IRS MeF Schema Library](https://www.irs.gov/e-file-providers/modernized-e-file-mef-schemas)

**Key Schemas for Form 1040** (Tax Year 2025):
```
- IndividualIncomeTax/Common/efileAttachments.xsd
- IndividualIncomeTax/Ind1040/Return1040.xsd
- IndividualIncomeTax/Ind1040/IRS1040ScheduleEIC.xsd
- IndividualIncomeTax/Common/Dependencies/IRS8863.xsd
```

**Integration Steps**:
1. Download official XSD schemas for tax year 2025
2. Store schemas in `server/schemas/irs/2025/`
3. Implement XML validation using `libxml` or equivalent:
   ```bash
   npm install libxmljs2
   ```
4. Update `server/services/form1040XmlGenerator.ts`:
   ```typescript
   import libxmljs from 'libxmljs2';
   
   const validateAgainstSchema = (xml: string, schemaPath: string): ValidationResult => {
     const xsdDoc = libxmljs.parseXml(fs.readFileSync(schemaPath, 'utf8'));
     const xmlDoc = libxmljs.parseXml(xml);
     return xmlDoc.validate(xsdDoc);
   };
   ```

#### Validation Requirements
- **Structural Validation**: XML must conform to IRS XSD schemas
- **Business Rule Validation**: IRS-specific calculation checks (e.g., EITC eligibility)
- **Rejection Prevention**: Pre-transmission validation prevents 90% of rejections

### 3. Digital Signatures & Security

#### X.509 Certificate Requirements
IRS requires all e-filed returns to be digitally signed.

**Certificate Acquisition**:
1. **Purchase from IRS-Approved Certificate Authority**:
   - DigiCert (formerly Symantec)
   - Entrust
   - IdenTrust
2. **Certificate Type**: Code Signing Certificate (minimum 2048-bit RSA)
3. **Validation Level**: Organization Validation (OV) or Extended Validation (EV)

**Storage & Management**:
```typescript
// Store certificate and private key securely
// Environment variables:
IRS_CERTIFICATE_PATH=/path/to/cert.pem
IRS_PRIVATE_KEY_PATH=/path/to/key.pem
IRS_PRIVATE_KEY_PASSPHRASE=<secure-passphrase>

// Use Hardware Security Module (HSM) for production:
// - AWS CloudHSM
// - Google Cloud HSM
// - Azure Key Vault
```

**Signing Implementation**:
```typescript
import { createSign } from 'crypto';
import fs from 'fs';

const signXML = (xml: string): string => {
  const privateKey = fs.readFileSync(process.env.IRS_PRIVATE_KEY_PATH!, 'utf8');
  const sign = createSign('RSA-SHA256');
  sign.update(xml);
  const signature = sign.sign({
    key: privateKey,
    passphrase: process.env.IRS_PRIVATE_KEY_PASSPHRASE
  }, 'base64');
  
  // Embed signature in XML per IRS specifications
  return embedSignature(xml, signature);
};
```

### 4. Transmission Protocol

#### Production Endpoints
- **Test Environment**: `https://testesb.irs.gov/mef/services`
- **Production Environment**: `https://esb.irs.gov/mef/services`

#### Transmission Methods
**Option 1: SOAP Web Services** (Recommended)
```typescript
import axios from 'axios';

const submitReturn = async (signedXML: string, efin: string) => {
  const soapEnvelope = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                      xmlns:irs="http://www.irs.gov/mef">
      <soapenv:Header/>
      <soapenv:Body>
        <irs:SubmitReturn>
          <irs:EFIN>${efin}</irs:EFIN>
          <irs:ReturnData>${Buffer.from(signedXML).toString('base64')}</irs:ReturnData>
        </irs:SubmitReturn>
      </soapenv:Body>
    </soapenv:Envelope>
  `;
  
  const response = await axios.post(process.env.IRS_SUBMISSION_ENDPOINT!, soapEnvelope, {
    headers: {
      'Content-Type': 'text/xml',
      'SOAPAction': 'SubmitReturn'
    }
  });
  
  return parseAcknowledgment(response.data);
};
```

**Option 2: FIRE API (Fast Internet Return Exchange)**
- Direct TCP/IP connection
- Requires FIRE Authenticator software
- Higher throughput for bulk submissions

### 5. Acknowledgment Processing

#### Acknowledgment Types
- **990**: Successfully received and accepted
- **991**: Received but rejected (with error codes)
- **900**: System error (retry)

#### Implementation
```typescript
const processAcknowledgment = async (transmissionId: string, ackXML: string) => {
  const ackType = parseAckType(ackXML);
  
  switch(ackType) {
    case '990':
      await storage.updateFederalTaxReturn(returnId, {
        efileStatus: 'accepted',
        efileAcceptedAt: new Date()
      });
      break;
    case '991':
      const errors = parseRejectionErrors(ackXML);
      await storage.updateFederalTaxReturn(returnId, {
        efileStatus: 'rejected',
        validationErrors: errors
      });
      break;
    case '900':
      // System error - retry
      await eFileQueueService.retryFailedSubmission(returnId);
      break;
  }
};
```

#### Polling vs. Webhook
**Polling** (Current Implementation):
```typescript
// Check for acknowledgments every 5 minutes
setInterval(async () => {
  const pendingReturns = await storage.getEFileSubmissions({ status: 'transmitted' });
  for (const return of pendingReturns) {
    const ack = await fetchAcknowledgment(return.efileTransmissionId);
    if (ack) {
      await processAcknowledgment(return.id, ack);
    }
  }
}, 5 * 60 * 1000);
```

**Webhook** (Recommended for Production):
```typescript
// IRS calls back when acknowledgment ready
app.post('/api/irs/acknowledgment', async (req, res) => {
  const { transmissionId, acknowledgment } = req.body;
  await processAcknowledgment(transmissionId, acknowledgment);
  res.sendStatus(200);
});
```

---

## Maryland E-Filing: iFile System

### 1. Maryland Credentials & Registration

#### iFile Provider Registration
**Purpose**: Authorization to submit Maryland state tax returns electronically.

**Registration Process**:
1. **Maryland Comptroller Registration**: [iFile Provider Portal](https://interactive.marylandtaxes.gov)
2. **Complete Provider Application**: Submit business details, federal EFIN
3. **Software Certification**: Pass Maryland test scenarios
4. **Receive iFile Credentials**: Provider ID and API keys

**Requirements**:
- Valid federal EFIN (prerequisite)
- Maryland business registration (if applicable)
- Compliance with Maryland tax preparer regulations
- Software certification (15-25 test returns)

#### Production Credentials
- **Provider ID**: Store in `MARYLAND_IFILE_PROVIDER_ID`
- **API Key**: Store in `MARYLAND_IFILE_API_KEY`
- **Submission Password**: Store in `MARYLAND_IFILE_PASSWORD`

### 2. Maryland iFile Schema

#### XML Schema Requirements
Maryland's iFile system requires XML conforming to their published schemas.

**Download Location**: [Maryland iFile Developer Resources](https://www.marylandtaxes.gov/ifile-business.php)

**Key Schemas for Form 502** (Tax Year 2025):
```
- MD502_Main_2025.xsd
- MD502CR_Credits_2025.xsd
- MD_CommonTypes.xsd
```

**Integration Steps**:
1. Download Maryland XSD schemas for tax year 2025
2. Store schemas in `server/schemas/maryland/2025/`
3. Implement validation in `server/services/form502XmlGenerator.ts`:
   ```typescript
   const validateForm502 = (xml: string): ValidationResult => {
     const schema = fs.readFileSync('server/schemas/maryland/2025/MD502_Main_2025.xsd', 'utf8');
     return validateAgainstSchema(xml, schema);
   };
   ```

#### Maryland-Specific Fields
- **County Code**: 2-digit code (required on all MD returns)
- **Local Tax Calculation**: County-specific rates from `county_tax_rates` table
- **EITC Calculation**: Maryland's refundable EITC (50% of federal EITC)
- **Poverty Level Credit**: Maryland-specific credit based on income/family size

### 3. Maryland Transmission Protocol

#### Production Endpoints
- **Test Environment**: `https://test.ifile.marylandtaxes.gov/api/v1/submit`
- **Production Environment**: `https://ifile.marylandtaxes.gov/api/v1/submit`

#### Submission Method (REST API)
```typescript
const submitMarylandReturn = async (xml: string, providerId: string) => {
  const response = await axios.post(
    process.env.MARYLAND_SUBMISSION_ENDPOINT!,
    {
      providerId,
      taxYear: 2025,
      returnType: '502',
      returnXML: Buffer.from(xml).toString('base64')
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.MARYLAND_IFILE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return {
    confirmationNumber: response.data.confirmationNumber,
    status: response.data.status
  };
};
```

### 4. Maryland Acknowledgment Processing

#### Status Codes
- **ACCEPTED**: Return accepted and processed
- **REJECTED**: Validation errors (includes error codes)
- **PENDING**: Under review
- **PROCESSING**: System processing

#### Implementation
```typescript
const pollMarylandStatus = async (confirmationNumber: string) => {
  const response = await axios.get(
    `${process.env.MARYLAND_STATUS_ENDPOINT}/${confirmationNumber}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.MARYLAND_IFILE_API_KEY}`
      }
    }
  );
  
  return {
    status: response.data.status,
    errors: response.data.errors || [],
    acceptedAt: response.data.acceptedAt
  };
};
```

---

## Production Integration Checklist

### Phase 1: Credential Acquisition (6-8 weeks)
- [ ] Apply for IRS EFIN (45-60 days processing)
- [ ] Complete IRS suitability check and fingerprinting
- [ ] Obtain X.509 digital certificate from approved CA
- [ ] Register as Maryland iFile provider
- [ ] Complete Maryland software certification

### Phase 2: Schema Implementation (2-3 weeks)
- [ ] Download IRS MeF XSD schemas for tax year 2025
- [ ] Download Maryland iFile XSD schemas for tax year 2025
- [ ] Implement XML schema validation in Form 1040 generator
- [ ] Implement XML schema validation in Form 502 generator
- [ ] Create automated test suite with IRS/Maryland test scenarios

### Phase 3: Security & Signatures (1-2 weeks)
- [ ] Configure secure certificate storage (HSM or encrypted vault)
- [ ] Implement XML digital signature for Form 1040
- [ ] Implement Maryland authentication (API key + password)
- [ ] Set up secure credential rotation procedures
- [ ] Implement audit logging for all e-file transmissions

### Phase 4: Testing Environment (2-3 weeks)
- [ ] Configure IRS test environment endpoint
- [ ] Configure Maryland test environment endpoint
- [ ] Submit minimum 10 test returns to IRS (various scenarios)
- [ ] Submit minimum 15 test returns to Maryland
- [ ] Validate 100% acceptance rate in test environments
- [ ] Document all test results and edge cases

### Phase 5: Production Deployment (1 week)
- [ ] Switch to production endpoints (IRS + Maryland)
- [ ] Enable production credential environment variables
- [ ] Implement acknowledgment polling/webhook handlers
- [ ] Set up monitoring dashboard for real-time status tracking
- [ ] Configure error alerting (Sentry + email notifications)
- [ ] Create runbook for handling rejections and system errors

### Phase 6: Compliance & Monitoring (Ongoing)
- [ ] Schedule annual EFIN renewal review
- [ ] Monitor IRS schema updates (typically November/December)
- [ ] Update Maryland schemas for new tax year
- [ ] Review and update certificate expiration (annually)
- [ ] Conduct quarterly security audits
- [ ] Maintain 95%+ first-time acceptance rate

---

## Environment Variables Reference

### IRS MeF Configuration
```bash
# Credentials
IRS_EFIN=<your-efin>
IRS_ETIN=<your-etin-if-applicable>
IRS_TCC=<transmitter-control-code>

# Digital Certificate
IRS_CERTIFICATE_PATH=/secure/path/to/cert.pem
IRS_PRIVATE_KEY_PATH=/secure/path/to/key.pem
IRS_PRIVATE_KEY_PASSPHRASE=<secure-passphrase>

# Endpoints
IRS_SUBMISSION_ENDPOINT=https://esb.irs.gov/mef/services/submit
IRS_ACKNOWLEDGMENT_ENDPOINT=https://esb.irs.gov/mef/services/acknowledgment
IRS_TEST_MODE=false  # Set to true for test environment
```

### Maryland iFile Configuration
```bash
# Credentials
MARYLAND_IFILE_PROVIDER_ID=<provider-id>
MARYLAND_IFILE_API_KEY=<api-key>
MARYLAND_IFILE_PASSWORD=<submission-password>

# Endpoints
MARYLAND_SUBMISSION_ENDPOINT=https://ifile.marylandtaxes.gov/api/v1/submit
MARYLAND_STATUS_ENDPOINT=https://ifile.marylandtaxes.gov/api/v1/status
MARYLAND_TEST_MODE=false  # Set to true for test environment
```

---

## Error Handling & Retry Logic

### Common Rejection Codes

#### IRS Rejection Codes
| Code | Description | Resolution |
|------|-------------|------------|
| F1040-001 | Missing or invalid SSN | Validate SSN format (9 digits, no dashes in XML) |
| F1040-502 | Invalid filing status | Ensure filing status matches dependent count |
| F1040-507 | AGI mismatch | Recalculate AGI from W-2 + other income |
| IND-031 | Duplicate SSN | Check for prior year return or spouse return |
| SEIC-04 | EITC calculation error | Verify EITC eligibility and income limits |

#### Maryland Rejection Codes
| Code | Description | Resolution |
|------|-------------|------------|
| MD-001 | Invalid county code | Verify 2-digit county code from `county_tax_rates` table |
| MD-502-15 | Local tax calculation error | Recalculate using correct county rate |
| MD-EITC-02 | Maryland EITC exceeds limit | Cap at 50% of federal EITC |

### Retry Strategy
```typescript
const retryConfig = {
  maxAttempts: 3,
  backoffMultiplier: 2,
  initialDelay: 5000,  // 5 seconds
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'IRS_SYSTEM_ERROR',  // Code 900
    'MARYLAND_SYSTEM_UNAVAILABLE'
  ]
};

const submitWithRetry = async (returnId: number, attempt = 1) => {
  try {
    return await eFileQueueService.submitForEFile(returnId);
  } catch (error) {
    if (attempt < retryConfig.maxAttempts && isRetryable(error)) {
      const delay = retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
      await sleep(delay);
      return submitWithRetry(returnId, attempt + 1);
    }
    throw error;
  }
};
```

---

## Security Considerations

### Data Protection
1. **At Rest**: 
   - Encrypt tax return data using AES-256-GCM (already implemented)
   - Store private keys in HSM or encrypted secrets vault
   - Encrypt database backups

2. **In Transit**:
   - Use TLS 1.3 for all API communications
   - Implement certificate pinning for IRS/Maryland endpoints
   - Validate SSL certificates before transmission

3. **Access Control**:
   - Limit e-file submission to admin users only
   - Implement IP whitelisting for production API access
   - Require MFA for accessing e-file credentials

### Compliance
- **IRS Publication 1075**: Safeguarding Federal Tax Information
- **Maryland Tax Confidentiality Laws**: Title 13, Subtitle 6
- **SOC 2 Type II**: Annual audit for service providers
- **Data Retention**: Retain e-filed returns for 7 years minimum

---

## Testing Scenarios

### IRS Test Scenarios (Minimum Requirements)
1. **Basic 1040**: Single filer, W-2 income only
2. **Married Filing Jointly**: With dependents
3. **EITC Claim**: Low-income with qualifying children
4. **CTC Claim**: Child Tax Credit scenarios
5. **Multiple Income Sources**: W-2 + interest + dividends
6. **Self-Employment**: Schedule C income
7. **Retirement Income**: Social Security + pension
8. **Itemized Deductions**: vs. standard deduction
9. **Head of Household**: With qualifying person
10. **Prior Year AGI Verification**: Electronic signature validation

### Maryland Test Scenarios (Minimum Requirements - 15+)
1. **Montgomery County**: High local tax rate (3.2%)
2. **Baltimore City**: City tax (3.2%)
3. **Rural County**: Low local tax rate (Allegany 2.96%)
4. **Maryland EITC**: 50% of federal credit
5. **Poverty Level Credit**: Income-based credit
6. **Part-Year Resident**: Pro-rated state tax
7. **Nonresident**: Maryland-source income only
8. **Military Personnel**: Special exemptions
9. **Pension Exclusion**: Age 65+ pension exclusion ($35,200 limit 2025)
10. **Two-County Allocation**: Moved during tax year
11. **Childcare Expense Credit**: Working families with dependent care expenses
12. **Student Loan Interest Deduction**: Maryland-specific deduction (up to $5,000 limit)
13. **Low-Income Credit**: Combined poverty level credit + EITC scenario
14. **Multiple Local Jurisdictions**: Employment in one county, residence in another
15. **Higher Education Expenses**: Subtraction for college savings contributions (529 plans)

---

## Monitoring & Observability

### Key Metrics
- **Acceptance Rate**: Target 95%+ first-time acceptance
- **Transmission Time**: Average time from submission to acknowledgment
- **Error Rate**: Percentage of returns rejected
- **Retry Success Rate**: Percentage of retries that succeed

### Dashboards
- **E-File Status Dashboard**: `/admin/efile-monitoring` (already implemented)
- **Real-Time Alerts**: Sentry integration for critical errors
- **Daily Reports**: Email digest of submission stats

### Logs
```typescript
// Structured logging for e-file events
logger.info('E-file submission initiated', {
  returnId,
  taxYear,
  transmissionId,
  efin: process.env.IRS_EFIN,
  timestamp: new Date().toISOString()
});

logger.error('E-file rejection received', {
  returnId,
  transmissionId,
  rejectionCode,
  rejectionMessage,
  attemptNumber
});
```

---

## Support & Resources

### IRS Resources
- [IRS e-Services Portal](https://www.irs.gov/e-file-providers)
- [MeF Developer Portal](https://www.irs.gov/e-file-providers/modernized-e-file-mef-guide-for-software-developers)
- [IRS e-Help Desk](https://www.irs.gov/e-file-providers/e-help-desk-contact-information)
- [Publication 1345](https://www.irs.gov/pub/irs-pdf/p1345.pdf): Handbook for Authorized IRS e-file Providers

### Maryland Resources
- [Maryland iFile Portal](https://interactive.marylandtaxes.gov)
- [iFile Developer Guide](https://www.marylandtaxes.gov/forms/Tax_Publications/iFile_Developer_Guide.pdf)
- [Comptroller's Office](https://www.marylandtaxes.gov/contact-us.php)

### Internal Resources
- **E-File Queue Service**: `server/services/eFileQueueService.ts`
- **Form 1040 Generator**: `server/services/form1040XmlGenerator.ts`
- **Form 502 Generator**: `server/services/form502XmlGenerator.ts`
- **Admin Dashboard**: `client/src/pages/admin/EFileMonitoring.tsx`
- **Database Schema**: `shared/schema.ts` (federalTaxReturns, marylandTaxReturns)

---

## Next Steps

1. **Immediate** (Before Production):
   - Apply for IRS EFIN (longest lead time)
   - Register as Maryland iFile provider
   - Obtain X.509 certificate

2. **Short-Term** (1-2 months):
   - Download and integrate IRS/Maryland XSD schemas
   - Implement XML validation with official schemas
   - Complete test submissions in both environments

3. **Production Launch** (3 months):
   - Deploy with production credentials
   - Monitor acceptance rates closely
   - Iterate based on rejection patterns

4. **Optimization** (Ongoing):
   - Implement machine learning for pre-submission error detection
   - Build intelligent retry logic based on error patterns
   - Automate schema updates for new tax years

---

**Document Version**: 1.0  
**Last Updated**: October 17, 2025  
**Maintained By**: Development Team  
**Review Frequency**: Quarterly or upon IRS/Maryland schema updates

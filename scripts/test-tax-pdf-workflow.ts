/**
 * Tax Preparation PDF Generation Workflow Test
 * 
 * Tests the complete workflow:
 * 1. Create federal tax return
 * 2. Generate Form 1040 PDF
 * 3. Create Maryland tax return
 * 4. Generate Form 502 PDF
 * 
 * Success criteria:
 * - Both PDF generation endpoints return 200
 * - PDF data is returned (Buffer)
 * - No 500 errors
 */

import axios from 'axios';
import { writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:5000';
const TEST_USER = {
  username: 'demo.applicant',
  password: 'password123'
};

interface TestResult {
  step: string;
  status: 'pass' | 'fail';
  details?: string;
  error?: any;
}

const results: TestResult[] = [];

async function testWorkflow() {
  console.log('🚀 Starting Tax PDF Generation Workflow Test\n');
  console.log('=' .repeat(60));
  
  let sessionCookie = '';
  let csrfToken = '';
  let federalTaxReturnId = '';
  let marylandTaxReturnId = '';
  
  try {
    // Step 0: Get CSRF token
    console.log('\n📝 Step 0: Getting CSRF token...');
    try {
      const csrfRes = await axios.get(`${BASE_URL}/api/csrf-token`, {
        withCredentials: true
      });
      
      csrfToken = csrfRes.data.token;
      sessionCookie = csrfRes.headers['set-cookie']?.[0] || '';
      console.log('✅ CSRF token obtained');
    } catch (error: any) {
      console.error('❌ Failed to get CSRF token:', error.message);
      throw error;
    }
    
    // Step 1: Login
    console.log('\n📝 Step 1: Login as demo.applicant...');
    try {
      const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, TEST_USER, {
        withCredentials: true,
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          'Cookie': sessionCookie
        }
      });
      
      sessionCookie = loginRes.headers['set-cookie']?.[0] || sessionCookie;
      results.push({ step: '1. Login', status: 'pass', details: 'Successfully logged in' });
      console.log('✅ Login successful');
    } catch (error: any) {
      results.push({ step: '1. Login', status: 'fail', error: error.message });
      console.error('❌ Login failed:', error.response?.data || error.message);
      throw error;
    }
    
    // Step 2: Create Federal Tax Return
    console.log('\n📝 Step 2: Create Federal Tax Return...');
    try {
      const taxData = {
        taxYear: 2024,
        filingStatus: 'single',
        form1040Data: {
          personalInfo: {
            taxpayerFirstName: 'Demo',
            taxpayerLastName: 'Applicant',
            taxpayerSSN: '123-45-6789',
            streetAddress: '123 Main St',
            city: 'Baltimore',
            state: 'MD',
            zipCode: '21201',
            virtualCurrency: false
          },
          taxInput: {
            taxYear: 2024,
            filingStatus: 'single' as const,
            stateCode: 'MD',
            taxpayer: { age: 35 },
            w2Income: {
              taxpayerWages: 50000,
              federalWithholding: 6000,
              socialSecurityWithholding: 3100,
              medicareWithholding: 725
            }
          },
          taxResult: {
            totalIncome: 50000,
            adjustedGrossIncome: 50000,
            deduction: 14600,
            taxableIncome: 35400,
            incomeTax: 4012,
            eitc: 0,
            childTaxCredit: 0,
            additionalChildTaxCredit: 0,
            totalTax: 4012,
            federalWithholding: 6000,
            refund: 1988,
            deductionBreakdown: {
              standardDeduction: 14600,
              itemizedDeduction: 0,
              usedStandardDeduction: true
            },
            taxBreakdown: {
              ordinaryIncomeTax: 4012,
              capitalGainsTax: 0,
              selfEmploymentTax: 0,
              additionalMedicareTax: 0,
              niit: 0
            }
          }
        },
        adjustedGrossIncome: 50000,
        taxableIncome: 35400,
        totalTax: 4012,
        totalCredits: 0,
        eitcAmount: 0,
        childTaxCredit: 0
      };
      
      const createFederalRes = await axios.post(
        `${BASE_URL}/api/tax/federal`,
        taxData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          }
        }
      );
      
      federalTaxReturnId = createFederalRes.data.id;
      results.push({ 
        step: '2. Create Federal Tax Return', 
        status: 'pass', 
        details: `Tax return ID: ${federalTaxReturnId}` 
      });
      console.log('✅ Federal tax return created:', federalTaxReturnId);
    } catch (error: any) {
      results.push({ step: '2. Create Federal Tax Return', status: 'fail', error: error.message });
      console.error('❌ Failed to create federal tax return:', error.response?.data || error.message);
      throw error;
    }
    
    // Step 3: Generate Form 1040 PDF
    console.log('\n📝 Step 3: Generate Form 1040 PDF...');
    try {
      const form1040Res = await axios.post(
        `${BASE_URL}/api/tax/form1040/generate`,
        { taxReturnId: federalTaxReturnId },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          },
          responseType: 'arraybuffer'
        }
      );
      
      if (form1040Res.status === 200) {
        const pdfSize = form1040Res.data.byteLength;
        const contentType = form1040Res.headers['content-type'];
        
        // Save PDF for verification
        writeFileSync('/tmp/form-1040-test.pdf', Buffer.from(form1040Res.data));
        
        results.push({ 
          step: '3. Generate Form 1040 PDF', 
          status: 'pass', 
          details: `PDF generated (${pdfSize} bytes, ${contentType})` 
        });
        console.log(`✅ Form 1040 PDF generated: ${pdfSize} bytes`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Saved to: /tmp/form-1040-test.pdf`);
      } else {
        throw new Error(`Unexpected status code: ${form1040Res.status}`);
      }
    } catch (error: any) {
      results.push({ step: '3. Generate Form 1040 PDF', status: 'fail', error: error.message });
      console.error('❌ Failed to generate Form 1040 PDF:', error.response?.data || error.message);
      throw error;
    }
    
    // Step 4: Create Maryland Tax Return
    console.log('\n📝 Step 4: Create Maryland Tax Return...');
    try {
      const marylandData = {
        federalReturnId: federalTaxReturnId,
        taxYear: 2024,
        county: 'Baltimore City',
        form502Data: {
          federalAGI: 50000,
          marylandAGI: 50000,
          marylandTaxableIncome: 47650,
          marylandStateTax: 2140,
          countyTax: 1525,
          totalMarylandTax: 3665,
          marylandEITC: 0,
          totalCredits: 0,
          taxAfterCredits: 3665,
          marylandWithholding: 2500,
          marylandRefund: -1165
        },
        marylandTax: 3665,
        marylandRefund: -1165
      };
      
      const createMarylandRes = await axios.post(
        `${BASE_URL}/api/tax/maryland`,
        marylandData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          }
        }
      );
      
      marylandTaxReturnId = createMarylandRes.data.id;
      results.push({ 
        step: '4. Create Maryland Tax Return', 
        status: 'pass', 
        details: `Tax return ID: ${marylandTaxReturnId}` 
      });
      console.log('✅ Maryland tax return created:', marylandTaxReturnId);
    } catch (error: any) {
      results.push({ step: '4. Create Maryland Tax Return', status: 'fail', error: error.message });
      console.error('❌ Failed to create Maryland tax return:', error.response?.data || error.message);
      throw error;
    }
    
    // Step 5: Generate Form 502 PDF
    console.log('\n📝 Step 5: Generate Form 502 PDF...');
    try {
      const form502Res = await axios.post(
        `${BASE_URL}/api/tax/form502/generate`,
        { federalTaxReturnId: federalTaxReturnId },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'Cookie': sessionCookie
          },
          responseType: 'arraybuffer'
        }
      );
      
      if (form502Res.status === 200) {
        const pdfSize = form502Res.data.byteLength;
        const contentType = form502Res.headers['content-type'];
        
        // Save PDF for verification
        writeFileSync('/tmp/form-502-test.pdf', Buffer.from(form502Res.data));
        
        results.push({ 
          step: '5. Generate Form 502 PDF', 
          status: 'pass', 
          details: `PDF generated (${pdfSize} bytes, ${contentType})` 
        });
        console.log(`✅ Form 502 PDF generated: ${pdfSize} bytes`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Saved to: /tmp/form-502-test.pdf`);
      } else {
        throw new Error(`Unexpected status code: ${form502Res.status}`);
      }
    } catch (error: any) {
      results.push({ step: '5. Generate Form 502 PDF', status: 'fail', error: error.message });
      console.error('❌ Failed to generate Form 502 PDF:', error.response?.data || error.message);
      throw error;
    }
    
  } catch (error) {
    console.error('\n💥 Workflow test failed');
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY\n');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  
  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : '❌';
    console.log(`${icon} ${result.step}: ${result.status.toUpperCase()}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log(`\n${passed} passed, ${failed} failed\n`);
  console.log('='.repeat(60));
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! Tax PDF generation workflow is working correctly.');
    process.exit(0);
  }
}

// Run the test
testWorkflow().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

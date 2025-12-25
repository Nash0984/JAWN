/**
 * Direct PDF Generation Test (bypassing HTTP layer)
 * 
 * Tests PDF generation by directly calling the storage and generator services.
 * This avoids CSRF and authentication complications while still validating the workflow.
 */

import { storage } from '../server/storage';
import { form1040Generator } from '../server/services/form1040Generator';
import { form502Generator } from '../server/services/form502Generator';
import { writeFileSync } from 'fs';

console.log('🚀 Starting Direct Tax PDF Generation Test\n');
console.log('='.repeat(60));

async function testDirectPDFGeneration() {
  let federalTaxReturnId = '';
  let marylandTaxReturnId = '';
  
  try {
    // Step 0: Get an existing user for preparer ID
    console.log('\n📝 Step 0: Getting existing user...');
    const { db } = await import('../server/db');
    const { users } = await import('../shared/schema');
    
    const existingUsers = await db.select({ id: users.id, username: users.username }).from(users).limit(1);
    if (existingUsers.length === 0) {
      throw new Error('No users found in database. Please run seed data first.');
    }
    const preparerId = existingUsers[0].id;
    console.log(`✅ Using user: ${existingUsers[0].username} (${preparerId})`);
    
    // Step 1: Create Federal Tax Return
    console.log('\n📝 Step 1: Create Federal Tax Return...');
    
    const federalTaxReturn = await storage.createFederalTaxReturn({
      preparerId: preparerId,
      taxYear: 2024,
      filingStatus: 'single',
      form1040Data: {
        personalInfo: {
          taxpayerFirstName: 'Test',
          taxpayerLastName: 'User',
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
          estimatedTaxPayments: 0,
          premiumTaxCredit: 0,
          educationCredits: 0,
          childDependentCareCredit: 0,
          deductionBreakdown: {
            standardDeduction: 14600,
            itemizedDeduction: 0,
            usedStandardDeduction: true
          },
          creditBreakdown: {
            nonRefundableCredits: 0,
            refundableCredits: 0
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
    });
    
    federalTaxReturnId = federalTaxReturn.id;
    console.log(`✅ Federal tax return created: ${federalTaxReturnId}`);
    
    // Step 2: Generate Form 1040 PDF
    console.log('\n📝 Step 2: Generate Form 1040 PDF...');
    
    const form1040Data = federalTaxReturn.form1040Data as any;
    const form1040PDF = await form1040Generator.generateForm1040(
      form1040Data.personalInfo,
      form1040Data.taxInput,
      form1040Data.taxResult,
      {
        taxYear: 2024,
        preparerName: 'Test Navigator',
        preparationDate: new Date(),
        includeWatermark: true
      }
    );
    
    if (form1040PDF && form1040PDF.length > 0) {
      writeFileSync('/tmp/form-1040-direct-test.pdf', form1040PDF);
      console.log(`✅ Form 1040 PDF generated: ${form1040PDF.length} bytes`);
      console.log(`   Saved to: /tmp/form-1040-direct-test.pdf`);
    } else {
      throw new Error('Form 1040 PDF generation returned empty buffer');
    }
    
    // Step 3: Create Maryland Tax Return
    console.log('\n📝 Step 3: Create Maryland Tax Return...');
    
    const marylandTaxReturn = await storage.createMarylandTaxReturn({
      federalReturnId: federalTaxReturnId,
      taxYear: 2024,
      countyCode: 'BALTIMORE_CITY',
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
    });
    
    marylandTaxReturnId = marylandTaxReturn.id;
    console.log(`✅ Maryland tax return created: ${marylandTaxReturnId}`);
    
    // Step 4: Generate Form 502 PDF
    console.log('\n📝 Step 4: Generate Form 502 PDF...');
    
    const form502Result = await form502Generator.generateForm502(
      {
        taxpayerFirstName: 'Test',
        taxpayerLastName: 'User',
        taxpayerSSN: '123-45-6789',
        streetAddress: '123 Main St',
        city: 'Baltimore',
        state: 'MD',
        zipCode: '21201',
        county: 'Baltimore City',
        marylandResident: true
      },
      form1040Data.taxInput,
      form1040Data.taxResult,
      {},
      {
        taxYear: 2024,
        preparerName: 'Test Navigator',
        preparationDate: new Date(),
        includeWatermark: true
      }
    );
    
    if (form502Result.pdf && form502Result.pdf.length > 0) {
      writeFileSync('/tmp/form-502-direct-test.pdf', form502Result.pdf);
      console.log(`✅ Form 502 PDF generated: ${form502Result.pdf.length} bytes`);
      console.log(`   Saved to: /tmp/form-502-direct-test.pdf`);
      console.log(`   Maryland tax result:`);
      console.log(`     - Maryland AGI: $${form502Result.marylandTaxResult.marylandAGI}`);
      console.log(`     - State tax: $${form502Result.marylandTaxResult.marylandStateTax.toFixed(2)}`);
      console.log(`     - County tax: $${form502Result.marylandTaxResult.countyTax.toFixed(2)}`);
      console.log(`     - Total Maryland tax: $${form502Result.marylandTaxResult.totalMarylandTax.toFixed(2)}`);
    } else {
      throw new Error('Form 502 PDF generation returned empty buffer');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY\n');
    console.log('✅ Step 1: Federal tax return created');
    console.log('✅ Step 2: Form 1040 PDF generated');
    console.log('✅ Step 3: Maryland tax return created');
    console.log('✅ Step 4: Form 502 PDF generated');
    console.log('\n🎉 All tests passed! PDF generation workflow is working correctly.');
    console.log('\nGenerated files:');
    console.log('  - /tmp/form-1040-direct-test.pdf');
    console.log('  - /tmp/form-502-direct-test.pdf');
    console.log('='.repeat(60));
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n💥 Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testDirectPDFGeneration();

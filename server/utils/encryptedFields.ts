/**
 * Encrypted Fields Utility
 * 
 * Provides helper functions to automatically encrypt/decrypt sensitive fields
 * when reading from or writing to the database.
 * 
 * Usage:
 *   - Before insert/update: Call encryptSensitiveFields() to encrypt plaintext SSNs and bank accounts
 *   - After select: Call decryptSensitiveFields() to decrypt encrypted data for application use
 */

import { encryptionService, type EncryptionResult } from '../services/encryption.service';

/**
 * Household Profile encrypted fields
 */
export function encryptHouseholdProfile(data: any) {
  const encrypted = { ...data };
  
  // Encrypt SSNs if provided as plaintext strings
  if (encrypted.taxpayerSSN && typeof encrypted.taxpayerSSN === 'string') {
    encrypted.taxpayerSSN = encryptionService.encryptSSN(encrypted.taxpayerSSN);
  }
  
  if (encrypted.spouseSSN && typeof encrypted.spouseSSN === 'string') {
    encrypted.spouseSSN = encryptionService.encryptSSN(encrypted.spouseSSN);
  }
  
  return encrypted;
}

export function decryptHouseholdProfile(data: any) {
  const decrypted = { ...data };
  
  // Decrypt SSNs
  if (decrypted.taxpayerSSN) {
    decrypted.taxpayerSSN = encryptionService.decryptSSN(decrypted.taxpayerSSN as EncryptionResult, true);
  }
  
  if (decrypted.spouseSSN) {
    decrypted.spouseSSN = encryptionService.decryptSSN(decrypted.spouseSSN as EncryptionResult, true);
  }
  
  return decrypted;
}

/**
 * Mask SSN for display in Household Profile
 */
export function maskHouseholdProfileSSNs(data: any) {
  const masked = { ...data };
  
  if (masked.taxpayerSSN) {
    masked.taxpayerSSN = encryptionService.maskSSN(masked.taxpayerSSN);
  }
  
  if (masked.spouseSSN) {
    masked.spouseSSN = encryptionService.maskSSN(masked.spouseSSN);
  }
  
  return masked;
}

/**
 * VITA Intake Session encrypted fields
 */
export function encryptVitaIntake(data: any) {
  const encrypted = { ...data };
  
  // Encrypt SSNs if provided as plaintext strings
  if (encrypted.primarySSN && typeof encrypted.primarySSN === 'string') {
    encrypted.primarySSN = encryptionService.encryptSSN(encrypted.primarySSN);
  }
  
  if (encrypted.spouseSSN && typeof encrypted.spouseSSN === 'string') {
    encrypted.spouseSSN = encryptionService.encryptSSN(encrypted.spouseSSN);
  }
  
  // Encrypt bank account info if provided as plaintext strings
  if (encrypted.bankAccountNumber && typeof encrypted.bankAccountNumber === 'string') {
    encrypted.bankAccountNumber = encryptionService.encryptBankAccount(encrypted.bankAccountNumber);
  }
  
  if (encrypted.bankRoutingNumber && typeof encrypted.bankRoutingNumber === 'string') {
    encrypted.bankRoutingNumber = encryptionService.encryptBankAccount(encrypted.bankRoutingNumber);
  }
  
  return encrypted;
}

export function decryptVitaIntake(data: any) {
  const decrypted = { ...data };
  
  // Decrypt SSNs
  if (decrypted.primarySSN) {
    decrypted.primarySSN = encryptionService.decryptSSN(decrypted.primarySSN as EncryptionResult, true);
  }
  
  if (decrypted.spouseSSN) {
    decrypted.spouseSSN = encryptionService.decryptSSN(decrypted.spouseSSN as EncryptionResult, true);
  }
  
  // Decrypt bank account info
  if (decrypted.bankAccountNumber) {
    decrypted.bankAccountNumber = encryptionService.decryptBankAccount(decrypted.bankAccountNumber as EncryptionResult);
  }
  
  if (decrypted.bankRoutingNumber) {
    decrypted.bankRoutingNumber = encryptionService.decryptBankAccount(decrypted.bankRoutingNumber as EncryptionResult);
  }
  
  return decrypted;
}

/**
 * Mask sensitive data for display in VITA Intake
 */
export function maskVitaIntakeSecrets(data: any) {
  const masked = { ...data };
  
  if (masked.primarySSN) {
    masked.primarySSN = encryptionService.maskSSN(masked.primarySSN);
  }
  
  if (masked.spouseSSN) {
    masked.spouseSSN = encryptionService.maskSSN(masked.spouseSSN);
  }
  
  if (masked.bankAccountNumber) {
    masked.bankAccountNumber = encryptionService.maskBankAccount(masked.bankAccountNumber);
  }
  
  if (masked.bankRoutingNumber) {
    masked.bankRoutingNumber = encryptionService.maskBankAccount(masked.bankRoutingNumber);
  }
  
  return masked;
}

/**
 * E&E Client encrypted fields
 */
export function encryptEEClient(data: any) {
  const encrypted = { ...data };
  
  // Encrypt client name if provided as plaintext
  if (encrypted.clientName && typeof encrypted.clientName === 'string') {
    encrypted.clientName = encryptionService.encrypt(encrypted.clientName);
  }
  
  // Encrypt SSN last 4 if provided as plaintext
  if (encrypted.ssnLast4 && typeof encrypted.ssnLast4 === 'string') {
    encrypted.ssnLast4 = encryptionService.encrypt(encrypted.ssnLast4);
  }
  
  // Encrypt date of birth if provided as plaintext
  if (encrypted.dateOfBirth && typeof encrypted.dateOfBirth === 'string') {
    encrypted.dateOfBirth = encryptionService.encrypt(encrypted.dateOfBirth);
  }
  
  return encrypted;
}

export function decryptEEClient(data: any) {
  const decrypted = { ...data };
  
  // Decrypt client name
  if (decrypted.clientName) {
    decrypted.clientName = encryptionService.decrypt(decrypted.clientName as EncryptionResult);
  }
  
  // Decrypt SSN last 4
  if (decrypted.ssnLast4) {
    decrypted.ssnLast4 = encryptionService.decrypt(decrypted.ssnLast4 as EncryptionResult);
  }
  
  // Decrypt date of birth
  if (decrypted.dateOfBirth) {
    decrypted.dateOfBirth = encryptionService.decrypt(decrypted.dateOfBirth as EncryptionResult);
  }
  
  return decrypted;
}

/**
 * Generic helper to encrypt all sensitive fields in a record based on table name
 */
export function encryptSensitiveFields(tableName: string, data: any): any {
  switch (tableName) {
    case 'household_profiles':
      return encryptHouseholdProfile(data);
    case 'vita_intake_sessions':
      return encryptVitaIntake(data);
    case 'ee_clients':
      return encryptEEClient(data);
    default:
      return data;
  }
}

/**
 * Generic helper to decrypt all sensitive fields in a record based on table name
 */
export function decryptSensitiveFields(tableName: string, data: any): any {
  switch (tableName) {
    case 'household_profiles':
      return decryptHouseholdProfile(data);
    case 'vita_intake_sessions':
      return decryptVitaIntake(data);
    case 'ee_clients':
      return decryptEEClient(data);
    default:
      return data;
  }
}

/**
 * Generic helper to mask sensitive fields for display/logging
 */
export function maskSensitiveFields(tableName: string, data: any): any {
  switch (tableName) {
    case 'household_profiles':
      return maskHouseholdProfileSSNs(data);
    case 'vita_intake_sessions':
      return maskVitaIntakeSecrets(data);
    case 'ee_clients':
      // E&E clients use hashes for display, not masking
      return data;
    default:
      return data;
  }
}

import { z } from 'zod';

// ============================================================================
// PHONE NUMBER VALIDATION
// ============================================================================

export const phoneSchema = z.string().refine(
  (val) => {
    const cleaned = val.replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 11;
  },
  { message: 'Phone number must be 10 or 11 digits' }
);

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone;
}

export function validatePhoneNumber(phone: string): { 
  valid: boolean; 
  formatted?: string; 
  error?: string 
} {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 0) {
    return { valid: false, error: 'Phone number is required' };
  }
  
  if (cleaned.length < 10) {
    return { valid: false, error: 'Phone number is too short (need 10 digits)' };
  }
  
  if (cleaned.length > 11) {
    return { valid: false, error: 'Phone number is too long (max 11 digits)' };
  }
  
  if (cleaned.length === 11 && cleaned[0] !== '1') {
    return { valid: false, error: '11-digit number must start with 1' };
  }
  
  return { valid: true, formatted: formatPhoneNumber(phone) };
}

// ============================================================================
// SSN VALIDATION
// ============================================================================

export const ssnSchema = z.string().refine(
  (val) => {
    const cleaned = val.replace(/\D/g, '');
    return cleaned.length === 9;
  },
  { message: 'SSN must be 9 digits' }
);

export function formatSSN(ssn: string, maskFirst5: boolean = false): string {
  const cleaned = ssn.replace(/\D/g, '');
  
  if (cleaned.length === 9) {
    if (maskFirst5) {
      return `XXX-XX-${cleaned.slice(5)}`;
    }
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
  }
  
  return ssn;
}

export function validateSSN(ssn: string): { 
  valid: boolean; 
  formatted?: string; 
  lastFour?: string;
  error?: string 
} {
  const cleaned = ssn.replace(/\D/g, '');
  
  if (cleaned.length === 0) {
    return { valid: false, error: 'SSN is required' };
  }
  
  if (cleaned.length !== 9) {
    return { 
      valid: false, 
      error: `SSN must be 9 digits (you entered ${cleaned.length})` 
    };
  }
  
  // Basic validation rules
  if (cleaned === '000000000') {
    return { valid: false, error: 'Invalid SSN format' };
  }
  
  if (cleaned.startsWith('000') || cleaned.startsWith('666') || cleaned.startsWith('9')) {
    return { valid: false, error: 'Invalid SSN prefix' };
  }
  
  return { 
    valid: true, 
    formatted: formatSSN(cleaned),
    lastFour: cleaned.slice(5)
  };
}

// ============================================================================
// ADDRESS VALIDATION
// ============================================================================

export const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State must be 2-letter code'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
});

export function formatZipCode(zip: string): string {
  const cleaned = zip.replace(/\D/g, '');
  
  if (cleaned.length === 5) {
    return cleaned;
  } else if (cleaned.length === 9) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
  
  return zip;
}

export function validateZipCode(zip: string): {
  valid: boolean;
  formatted?: string;
  zipPlusFour?: boolean;
  error?: string;
} {
  const cleaned = zip.replace(/\D/g, '');
  
  if (cleaned.length === 0) {
    return { valid: false, error: 'ZIP code is required' };
  }
  
  if (cleaned.length === 5) {
    return { 
      valid: true, 
      formatted: cleaned,
      zipPlusFour: false
    };
  } else if (cleaned.length === 9) {
    return { 
      valid: true, 
      formatted: `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`,
      zipPlusFour: true
    };
  } else {
    return { 
      valid: false, 
      error: `ZIP must be 5 or 9 digits (you entered ${cleaned.length})`
    };
  }
}

// Maryland county codes (for E&E compatibility)
export const marylandCountyCodes: Record<string, string> = {
  '001': 'Allegany',
  '003': 'Anne Arundel',
  '005': 'Baltimore County',
  '009': 'Calvert',
  '011': 'Caroline',
  '013': 'Carroll',
  '015': 'Cecil',
  '017': 'Charles',
  '019': 'Dorchester',
  '021': 'Frederick',
  '023': 'Garrett',
  '025': 'Harford',
  '027': 'Howard',
  '029': 'Kent',
  '031': 'Montgomery',
  '033': 'Prince Georges',
  '035': 'Queen Annes',
  '037': 'Somerset',
  '039': 'St. Marys',
  '041': 'Talbot',
  '043': 'Washington',
  '045': 'Wicomico',
  '047': 'Worcester',
  '510': 'Baltimore City'
};

// Reverse lookup: ZIP code to county (simplified, based on first 3 digits)
export const zipToCounty: Record<string, string> = {
  '205': '510', // Baltimore City
  '206': '005', // Baltimore County
  '207': '003', // Anne Arundel
  '208': '031', // Montgomery
  '209': '033', // Prince Georges
  '210': '005', // Baltimore County
  '212': '005', // Baltimore County
};

export function getCountyFromZip(zip: string): { 
  countyCode?: string; 
  countyName?: string 
} {
  const cleaned = zip.replace(/\D/g, '');
  const prefix = cleaned.slice(0, 3);
  const countyCode = zipToCounty[prefix];
  
  if (countyCode) {
    return {
      countyCode,
      countyName: marylandCountyCodes[countyCode]
    };
  }
  
  return {};
}

export function validateAddress(address: {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}): {
  valid: boolean;
  errors: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  if (!address.street || address.street.trim().length === 0) {
    errors.push('Street address is required');
  }
  
  if (!address.city || address.city.trim().length === 0) {
    errors.push('City is required');
  }
  
  if (!address.state || address.state.length !== 2) {
    errors.push('State must be 2-letter code (e.g., MD)');
  } else if (address.state.toUpperCase() === 'MD' && address.zipCode) {
    const county = getCountyFromZip(address.zipCode);
    if (county.countyName) {
      suggestions.push(`Detected county: ${county.countyName} (code: ${county.countyCode})`);
    }
  }
  
  if (address.zipCode) {
    const zipValidation = validateZipCode(address.zipCode);
    if (!zipValidation.valid) {
      errors.push(zipValidation.error || 'Invalid ZIP code');
    } else if (zipValidation.zipPlusFour === false) {
      suggestions.push('Consider adding ZIP+4 for better accuracy (e.g., 21201-1234)');
    }
  } else {
    errors.push('ZIP code is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    suggestions
  };
}

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

export const emailSchema = z.string().email('Invalid email format');

export function validateEmail(email: string): {
  valid: boolean;
  error?: string;
} {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true };
}

// ============================================================================
// DATA COMPLETENESS HELPERS
// ============================================================================

export function calculateCompletenessScore(data: Record<string, any>, requiredFields: string[]): {
  score: number;
  missingFields: string[];
  completedFields: string[];
} {
  const missingFields: string[] = [];
  const completedFields: string[] = [];
  
  for (const field of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    } else if (Array.isArray(value) && value.length === 0) {
      missingFields.push(field);
    } else {
      completedFields.push(field);
    }
  }
  
  const score = requiredFields.length > 0 
    ? Math.round((completedFields.length / requiredFields.length) * 100)
    : 0;
  
  return {
    score,
    missingFields,
    completedFields
  };
}

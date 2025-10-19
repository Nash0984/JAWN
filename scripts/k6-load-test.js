import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');
const cacheHits = new Counter('cache_hits');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 100 },    // Ramp up to 100 users in 30s
    { duration: '30s', target: 500 },    // Ramp up to 500 users in 30s
    { duration: '30s', target: 1000 },   // Ramp up to 1000 users in 30s
    { duration: '30s', target: 2500 },   // Ramp up to 2500 users in 30s
    { duration: '1m', target: 5000 },    // Ramp up to 5000 users in 1 minute
    { duration: '3m', target: 5000 },    // Stay at 5000 users for 3 minutes
    { duration: '1m', target: 0 },       // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // 95% under 1s, 99% under 2s
    http_req_failed: ['rate<0.05'],                   // Error rate under 5%
    errors: ['rate<0.05'],                             // Custom error rate under 5%
  },
  ext: {
    loadimpact: {
      projectID: 3000000,                             // Replace with actual project ID
      name: 'Maryland Benefits Navigator Load Test',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Test data
const testUsers = [
  { username: 'demo.applicant', password: 'Demo2024!', role: 'applicant' },
  { username: 'demo.navigator', password: 'Demo2024!', role: 'navigator' },
  { username: 'demo.caseworker', password: 'Demo2024!', role: 'caseworker' },
];

// Endpoints to test
const endpoints = [
  { path: '/api/programs', weight: 20, name: 'Programs List' },
  { path: '/api/policy-documents', weight: 15, name: 'Policy Documents' },
  { path: '/api/benefits/snap/eligibility', weight: 15, name: 'SNAP Eligibility' },
  { path: '/api/benefits/medicaid/eligibility', weight: 10, name: 'Medicaid Eligibility' },
  { path: '/api/benefits/ohep/eligibility', weight: 10, name: 'OHEP Eligibility' },
  { path: '/api/counties', weight: 10, name: 'Counties' },
  { path: '/api/glossary', weight: 5, name: 'Glossary' },
  { path: '/api/policy-sources', weight: 5, name: 'Policy Sources' },
  { path: '/api/faq', weight: 5, name: 'FAQ' },
  { path: '/api/health', weight: 5, name: 'Health Check' },
];

// Helper function to get weighted random endpoint
function getRandomEndpoint() {
  const random = Math.random() * 100;
  let sum = 0;
  
  for (const endpoint of endpoints) {
    sum += endpoint.weight;
    if (random < sum) {
      return endpoint;
    }
  }
  
  return endpoints[0];
}

// Login function
export function setup() {
  // Try to login as test user to get auth token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: testUsers[0].username,
    password: testUsers[0].password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const data = JSON.parse(loginRes.body);
    return { authToken: data.token };
  }
  
  console.log('Login failed, will test public endpoints only');
  return { authToken: null };
}

// Main test scenario
export default function(data) {
  const endpoint = getRandomEndpoint();
  const url = `${BASE_URL}${endpoint.path}`;
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: {
      endpoint: endpoint.name,
    },
  };

  // Add auth token if available
  if (data && data.authToken) {
    params.headers['Authorization'] = `Bearer ${data.authToken}`;
  }

  // Make request and measure response time
  const startTime = Date.now();
  const response = http.get(url, params);
  const responseTime = Date.now() - startTime;
  
  // Record custom metrics
  apiResponseTime.add(responseTime, { endpoint: endpoint.name });
  
  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'status is not 500': (r) => r.status !== 500,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
    'has response body': (r) => r.body && r.body.length > 0,
  });

  if (success) {
    successfulRequests.add(1);
    
    // Check if response was cached (very fast response)
    if (responseTime < 50) {
      cacheHits.add(1);
    }
  } else {
    errorRate.add(1);
  }

  // Simulate user think time (1-3 seconds)
  sleep(1 + Math.random() * 2);
}

// Test specific user flows
export function testBenefitScreening() {
  const household = {
    county: 'Baltimore City',
    householdSize: 4,
    monthlyIncome: 2500,
    hasChildren: true,
    hasElderly: false,
    hasDisabled: false,
  };

  // Test SNAP screening
  const snapRes = http.post(`${BASE_URL}/api/benefits/snap/screen`, JSON.stringify(household), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(snapRes, {
    'SNAP screening successful': (r) => r.status === 200,
    'SNAP response has eligibility': (r) => {
      const body = JSON.parse(r.body || '{}');
      return body.hasOwnProperty('eligible');
    },
  });

  sleep(1);

  // Test Medicaid screening
  const medicaidRes = http.post(`${BASE_URL}/api/benefits/medicaid/screen`, JSON.stringify(household), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(medicaidRes, {
    'Medicaid screening successful': (r) => r.status === 200,
  });

  sleep(1);
}

// Test document processing (heavy operation)
export function testDocumentProcessing() {
  // Simulate document upload
  const documentData = {
    type: 'pay_stub',
    content: 'base64encodedcontent',
    filename: 'paystub.pdf',
  };

  const uploadRes = http.post(`${BASE_URL}/api/documents/process`, JSON.stringify(documentData), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
  });

  check(uploadRes, {
    'Document processing initiated': (r) => r.status === 202 || r.status === 200,
    'Document processing time < 10s': (r) => r.timings.duration < 10000,
  });

  sleep(2);
}

// Test search functionality
export function testSearch() {
  const searches = [
    'SNAP eligibility',
    'Medicaid application',
    'OHEP assistance',
    'tax credits',
    'food stamps',
  ];

  const searchTerm = searches[Math.floor(Math.random() * searches.length)];
  
  const searchRes = http.get(`${BASE_URL}/api/search?q=${encodeURIComponent(searchTerm)}`, {
    tags: { operation: 'search' },
  });

  check(searchRes, {
    'Search successful': (r) => r.status === 200,
    'Search has results': (r) => {
      const body = JSON.parse(r.body || '{}');
      return body.results && body.results.length > 0;
    },
  });

  sleep(1);
}

// Teardown function
export function teardown(data) {
  // Calculate and log final metrics
  console.log('Load test completed');
}
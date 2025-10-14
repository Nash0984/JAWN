/**
 * OpenAPI 3.0 Specification for Maryland Benefits Platform Public API
 * Version: 1.0.0
 * 
 * This specification documents all public API endpoints for third-party integrations.
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Maryland Benefits Platform API',
    version: '1.0.0',
    description: `
# Maryland Benefits Platform Public API

The Maryland Benefits Platform API enables third-party organizations, community-based organizations (CBOs), 
and partners to integrate benefit eligibility checking, document verification, and screening capabilities 
into their applications.

## Authentication

All API requests require an API key. Include your API key in the \`X-API-Key\` header:

\`\`\`
X-API-Key: your_api_key_here
\`\`\`

To obtain an API key, contact your Maryland Benefits Platform administrator or visit the Developer Portal.

## Rate Limits

API keys have rate limits based on your organization's tier:
- **Standard**: 1,000 requests/hour
- **Premium**: 5,000 requests/hour
- **Enterprise**: 10,000 requests/hour

Rate limit information is returned in response headers:
- \`X-RateLimit-Limit\`: Maximum requests per hour
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: When the rate limit resets (ISO 8601)

## Scopes

API keys are granted specific scopes that determine which endpoints they can access:

- \`eligibility:read\` - Check eligibility for benefit programs
- \`documents:write\` - Upload and verify documents
- \`screener:read\` - Run benefit screeners
- \`programs:read\` - List available benefit programs
- \`webhooks:write\` - Register and manage webhooks
- \`tax:read\` - Access tax calculation results

## Webhooks

Register webhooks to receive real-time notifications when events occur:
- \`eligibility.checked\` - Eligibility check completed
- \`document.verified\` - Document verification completed
- \`screener.completed\` - Screener completed

## Versioning

The API is versioned using URL path versioning (\`/api/v1/...\`). We maintain backwards compatibility 
and provide advance notice before deprecating endpoints.
    `,
    contact: {
      name: 'Maryland Benefits Platform API Support',
      email: 'api-support@mdbenefits.gov',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: 'https://api.mdbenefits.gov',
      description: 'Production server',
    },
    {
      url: 'https://api-staging.mdbenefits.gov',
      description: 'Staging server',
    },
    {
      url: 'http://localhost:5000',
      description: 'Local development',
    },
  ],
  security: [
    {
      ApiKeyAuth: [],
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication. Obtain from Developer Portal.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error', 'message', 'code'],
        properties: {
          error: {
            type: 'string',
            description: 'Error type',
            example: 'Unauthorized',
          },
          message: {
            type: 'string',
            description: 'Human-readable error message',
            example: 'API key is required',
          },
          code: {
            type: 'string',
            description: 'Machine-readable error code',
            example: 'MISSING_API_KEY',
          },
        },
      },
      HouseholdMember: {
        type: 'object',
        required: ['age', 'relationship'],
        properties: {
          age: {
            type: 'integer',
            minimum: 0,
            maximum: 120,
            example: 35,
          },
          relationship: {
            type: 'string',
            enum: ['self', 'spouse', 'child', 'parent', 'other'],
            example: 'self',
          },
          income: {
            type: 'number',
            minimum: 0,
            example: 25000,
          },
          hasDisability: {
            type: 'boolean',
            example: false,
          },
        },
      },
      EligibilityRequest: {
        type: 'object',
        required: ['householdSize', 'totalIncome', 'state'],
        properties: {
          householdSize: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            example: 3,
          },
          totalIncome: {
            type: 'number',
            minimum: 0,
            example: 35000,
            description: 'Annual household income in dollars',
          },
          state: {
            type: 'string',
            pattern: '^[A-Z]{2}$',
            example: 'MD',
            description: 'Two-letter state code',
          },
          householdMembers: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/HouseholdMember',
            },
          },
          zipCode: {
            type: 'string',
            pattern: '^[0-9]{5}$',
            example: '21201',
          },
        },
      },
      EligibilityResult: {
        type: 'object',
        properties: {
          eligible: {
            type: 'boolean',
            example: true,
          },
          programs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'SNAP',
                },
                name: {
                  type: 'string',
                  example: 'Supplemental Nutrition Assistance Program',
                },
                eligible: {
                  type: 'boolean',
                  example: true,
                },
                estimatedBenefit: {
                  type: 'number',
                  example: 680,
                  description: 'Estimated monthly benefit amount',
                },
                reason: {
                  type: 'string',
                  example: 'Income below 130% FPL',
                },
              },
            },
          },
          nextSteps: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: ['Complete full application', 'Gather required documents', 'Schedule interview'],
          },
        },
      },
      BenefitProgram: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          code: {
            type: 'string',
            example: 'SNAP',
          },
          name: {
            type: 'string',
            example: 'Supplemental Nutrition Assistance Program',
          },
          description: {
            type: 'string',
            example: 'Provides nutrition benefits to supplement the food budget',
          },
          programType: {
            type: 'string',
            enum: ['benefit', 'tax', 'hybrid'],
            example: 'benefit',
          },
        },
      },
      DocumentVerifyRequest: {
        type: 'object',
        required: ['documentType', 'documentData'],
        properties: {
          documentType: {
            type: 'string',
            enum: ['income_proof', 'identity', 'residency', 'other'],
            example: 'income_proof',
          },
          documentData: {
            type: 'string',
            format: 'base64',
            description: 'Base64-encoded document image or PDF',
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      DocumentVerifyResult: {
        type: 'object',
        properties: {
          verified: {
            type: 'boolean',
            example: true,
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            example: 0.95,
            description: 'Confidence score (0-1)',
          },
          extractedData: {
            type: 'object',
            additionalProperties: true,
            example: {
              employerName: 'ABC Corp',
              grossIncome: 3500,
              payPeriod: 'monthly',
            },
          },
          issues: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: ['Document quality could be improved'],
          },
        },
      },
      ScreenerRequest: {
        type: 'object',
        required: ['householdSize', 'monthlyIncome'],
        properties: {
          householdSize: {
            type: 'integer',
            minimum: 1,
            example: 2,
          },
          monthlyIncome: {
            type: 'number',
            minimum: 0,
            example: 2500,
          },
          hasChildren: {
            type: 'boolean',
            example: true,
          },
          hasDisability: {
            type: 'boolean',
            example: false,
          },
          isElderly: {
            type: 'boolean',
            example: false,
          },
        },
      },
      ScreenerResult: {
        type: 'object',
        properties: {
          likelyEligible: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: ['SNAP', 'MEDICAID', 'WIC'],
          },
          possiblyEligible: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: ['TANF'],
          },
          notEligible: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: [],
          },
          recommendedNextSteps: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: ['Apply for SNAP benefits', 'Complete full application for Medicaid'],
          },
        },
      },
      WebhookRegisterRequest: {
        type: 'object',
        required: ['url', 'events'],
        properties: {
          url: {
            type: 'string',
            format: 'uri',
            example: 'https://example.com/webhooks/mdbenefits',
            description: 'Your webhook endpoint URL (must be HTTPS)',
          },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['eligibility.checked', 'document.verified', 'screener.completed'],
            },
            example: ['eligibility.checked', 'document.verified'],
          },
          secret: {
            type: 'string',
            description: 'Optional webhook secret for signature verification (will be generated if not provided)',
          },
        },
      },
      WebhookResponse: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          url: {
            type: 'string',
            format: 'uri',
          },
          events: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          secret: {
            type: 'string',
            description: 'Your webhook secret - save this for signature verification',
          },
          status: {
            type: 'string',
            enum: ['active', 'paused', 'failed'],
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  paths: {
    '/api/v1/eligibility/check': {
      post: {
        tags: ['Eligibility'],
        summary: 'Check benefit eligibility',
        description: 'Check household eligibility for available benefit programs',
        operationId: 'checkEligibility',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/EligibilityRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Eligibility check completed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EligibilityResult',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized - Invalid or missing API key',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '403': {
            description: 'Forbidden - Insufficient scope',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '429': {
            description: 'Too Many Requests - Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/programs': {
      get: {
        tags: ['Programs'],
        summary: 'List benefit programs',
        description: 'Get a list of all available benefit programs',
        operationId: 'listPrograms',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'programType',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['benefit', 'tax', 'hybrid'],
            },
            description: 'Filter by program type',
          },
          {
            name: 'active',
            in: 'query',
            schema: {
              type: 'boolean',
            },
            description: 'Filter by active status',
          },
        ],
        responses: {
          '200': {
            description: 'List of programs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/BenefitProgram',
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/documents/verify': {
      post: {
        tags: ['Documents'],
        summary: 'Verify document',
        description: 'Upload and verify a document using AI',
        operationId: 'verifyDocument',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DocumentVerifyRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Document verification result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/DocumentVerifyResult',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/screener/quick': {
      post: {
        tags: ['Screener'],
        summary: 'Quick benefit screener',
        description: 'Run a quick 2-minute benefit screener to identify likely eligible programs',
        operationId: 'quickScreen',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ScreenerRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Screener result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ScreenerResult',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/webhooks/register': {
      post: {
        tags: ['Webhooks'],
        summary: 'Register webhook',
        description: 'Register a webhook to receive event notifications',
        operationId: 'registerWebhook',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WebhookRegisterRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Webhook registered',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WebhookResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'List webhooks',
        description: 'Get all webhooks registered for your API key',
        operationId: 'listWebhooks',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: 'List of webhooks',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/WebhookResponse',
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Eligibility',
      description: 'Benefit eligibility checking endpoints',
    },
    {
      name: 'Programs',
      description: 'Benefit program information',
    },
    {
      name: 'Documents',
      description: 'Document verification endpoints',
    },
    {
      name: 'Screener',
      description: 'Quick benefit screening',
    },
    {
      name: 'Webhooks',
      description: 'Webhook management for event notifications',
    },
  ],
};

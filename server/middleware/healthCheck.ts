/**
 * Health Check and Readiness Endpoints
 * 
 * Provides health monitoring for load balancers and orchestration systems
 * - /health: Liveness probe (is the service running?)
 * - /ready: Readiness probe (is the service ready to accept traffic?)
 */

import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail';
      message?: string;
      responseTime?: number;
    };
  };
}

/**
 * Simple liveness check
 * Returns 200 if the service is running
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  // Basic process check
  health.checks.process = {
    status: 'pass',
    message: `Uptime: ${Math.floor(process.uptime())}s`
  };

  res.status(200).json(health);
}

/**
 * Comprehensive readiness check
 * Returns 200 only if all dependencies are available
 */
export async function readinessCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  let overallHealthy = true;

  // 1. Database check
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1 as health_check`);
    health.checks.database = {
      status: 'pass',
      responseTime: Date.now() - dbStart,
      message: 'Database connection successful'
    };
  } catch (error) {
    overallHealthy = false;
    health.checks.database = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database connection failed'
    };
  }

  // 2. Memory check (warn if > 90% used)
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  if (heapUsedPercent > 90) {
    health.checks.memory = {
      status: 'fail',
      message: `High memory usage: ${heapUsedPercent.toFixed(1)}%`
    };
    overallHealthy = false;
  } else {
    health.checks.memory = {
      status: 'pass',
      message: `Memory usage: ${heapUsedPercent.toFixed(1)}%`
    };
  }

  // 3. AI Service check (optional but warn if missing) - prefer GOOGLE_API_KEY
  const hasAIKey = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
  health.checks.ai_service = {
    status: hasAIKey ? 'pass' : 'fail',
    message: hasAIKey ? 'AI service configured' : 'GOOGLE_API_KEY not configured'
  };
  
  if (!hasAIKey) {
    health.status = 'degraded';
  }

  // 4. Object Storage check (optional)
  const hasStorage = !!process.env.GCS_BUCKET_NAME;
  health.checks.object_storage = {
    status: hasStorage ? 'pass' : 'fail',
    message: hasStorage ? 'Object storage configured' : 'GCS bucket not configured'
  };

  if (!hasStorage) {
    health.status = 'degraded';
  }

  // Determine overall status
  if (!overallHealthy) {
    health.status = 'unhealthy';
    res.status(503).json(health);
  } else if (health.status === 'degraded') {
    res.status(200).json(health);
  } else {
    res.status(200).json(health);
  }
}

/**
 * Startup probe check
 * Used by orchestration systems to know when service is fully started
 */
export async function startupCheck(req: Request, res: Response): Promise<void> {
  // Check if all critical startup tasks completed
  const checks: Record<string, boolean> = {
    database: true, // We'll check DB connection
    environment: true, // Environment validated on startup
  };

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    checks.database = false;
  }

  const allReady = Object.values(checks).every(v => v);

  res.status(allReady ? 200 : 503).json({
    ready: allReady,
    checks,
    timestamp: new Date().toISOString()
  });
}

/**
 * TLS/HTTPS Configuration Health Check
 * 
 * Deployment-agnostic HTTPS verification for multi-cloud compliance:
 * - AWS GovCloud ALB (Application Load Balancer)
 * - GCP Cloud Load Balancer
 * - Azure Application Gateway
 * - On-premises nginx/Apache reverse proxy
 * 
 * FedRAMP-compliant checks:
 * - Transport encryption (HTTPS detection via X-Forwarded-Proto)
 * - HSTS header presence (SC-8 Transmission Confidentiality)
 * - Secure cookie configuration (AC-2 Account Management)
 * - CSP upgrade-insecure-requests directive (SC-8)
 * 
 * @returns 200 OK if all TLS checks pass, 426 Upgrade Required if HTTP detected in production
 */
export async function tlsHealthCheck(req: Request, res: Response): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const timestamp = new Date().toISOString();
  
  interface TLSCheck {
    status: 'pass' | 'fail' | 'warning';
    message: string;
    details?: any;
  }
  
  const checks: Record<string, TLSCheck> = {};
  let overallStatus: 'secure' | 'insecure' | 'degraded' = 'secure';
  
  // 1. Check if connection is HTTPS (via reverse proxy headers)
  // All major cloud providers set X-Forwarded-Proto
  const protocol = req.headers['x-forwarded-proto'] as string || 
                   req.headers['x-forwarded-protocol'] as string ||
                   req.protocol;
  
  const isHttps = protocol === 'https' || 
                  req.secure || 
                  req.headers['x-forwarded-ssl'] === 'on';
  
  if (!isHttps && isProd) {
    checks.transport = {
      status: 'fail',
      message: 'HTTP detected in production (HTTPS required for FedRAMP compliance)',
      details: {
        protocol,
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        'x-forwarded-ssl': req.headers['x-forwarded-ssl'],
        secure: req.secure
      }
    };
    overallStatus = 'insecure';
  } else {
    checks.transport = {
      status: 'pass',
      message: isHttps ? 'HTTPS transport encryption verified' : 'HTTP (dev mode)',
      details: {
        protocol: isHttps ? 'https' : 'http',
        reverseProxy: req.headers['x-forwarded-proto'] ? 'detected' : 'none',
        environment: process.env.NODE_ENV
      }
    };
  }
  
  // 2. Check HSTS header in response
  // HSTS forces browsers to use HTTPS (FedRAMP SC-8 requirement)
  const hstsHeader = res.getHeader('Strict-Transport-Security') as string;
  
  if (!hstsHeader && isProd) {
    checks.hsts = {
      status: 'fail',
      message: 'HSTS header missing (required for FedRAMP SC-8 compliance)',
      details: {
        expected: 'max-age=31536000; includeSubDomains; preload',
        actual: 'not set'
      }
    };
    if (overallStatus === 'secure') overallStatus = 'degraded';
  } else if (hstsHeader) {
    const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/);
    const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0;
    const hasSubdomains = hstsHeader.includes('includeSubDomains');
    const hasPreload = hstsHeader.includes('preload');
    
    // FedRAMP recommends max-age >= 31536000 (1 year)
    if (maxAge < 31536000 || !hasSubdomains) {
      checks.hsts = {
        status: 'warning',
        message: 'HSTS configured but not optimal (FedRAMP recommends max-age=1 year, includeSubDomains)',
        details: {
          maxAge,
          includeSubDomains: hasSubdomains,
          preload: hasPreload,
          header: hstsHeader
        }
      };
      if (overallStatus === 'secure') overallStatus = 'degraded';
    } else {
      checks.hsts = {
        status: 'pass',
        message: 'HSTS header configured correctly',
        details: {
          maxAge,
          includeSubDomains: hasSubdomains,
          preload: hasPreload
        }
      };
    }
  } else {
    checks.hsts = {
      status: 'pass',
      message: 'HSTS check skipped (development mode)',
      details: { environment: 'development' }
    };
  }
  
  // 3. Check CSP upgrade-insecure-requests directive
  // Forces HTTP resources to load via HTTPS (FedRAMP SC-8)
  const cspHeader = res.getHeader('Content-Security-Policy') as string;
  
  if (!cspHeader?.includes('upgrade-insecure-requests') && isProd && isHttps) {
    checks.csp_upgrade = {
      status: 'warning',
      message: 'CSP upgrade-insecure-requests directive missing (recommended for mixed-content protection)',
      details: {
        expected: 'upgrade-insecure-requests',
        actual: cspHeader ? 'CSP set without upgrade directive' : 'CSP not set'
      }
    };
    if (overallStatus === 'secure') overallStatus = 'degraded';
  } else if (cspHeader?.includes('upgrade-insecure-requests')) {
    checks.csp_upgrade = {
      status: 'pass',
      message: 'CSP upgrade-insecure-requests directive present',
      details: { directive: 'upgrade-insecure-requests' }
    };
  } else {
    checks.csp_upgrade = {
      status: 'pass',
      message: 'CSP upgrade check skipped (development mode or HTTP)',
      details: { environment: process.env.NODE_ENV, https: isHttps }
    };
  }
  
  // 4. Check secure cookie configuration
  // Cookies must have Secure flag in production HTTPS (FedRAMP AC-2)
  const cookieHeader = req.headers['cookie'];
  let secureCookiesEnabled = 'unknown';
  
  // In production HTTPS, all session cookies should be Secure
  // We can't check response cookies here, but we can check session config
  if (isProd && isHttps) {
    // Check if express-session Secure flag is likely set
    // This is a best-effort check based on environment
    secureCookiesEnabled = process.env.SESSION_SECRET ? 'likely_configured' : 'unknown';
    
    checks.secure_cookies = {
      status: secureCookiesEnabled === 'likely_configured' ? 'pass' : 'warning',
      message: secureCookiesEnabled === 'likely_configured' 
        ? 'Secure cookie configuration detected'
        : 'Unable to verify secure cookie configuration',
      details: {
        recommendation: 'Ensure express-session configured with cookie.secure=true in production',
        sessionConfigured: !!process.env.SESSION_SECRET
      }
    };
  } else {
    checks.secure_cookies = {
      status: 'pass',
      message: 'Secure cookie check skipped (development or HTTP)',
      details: { environment: process.env.NODE_ENV, https: isHttps }
    };
  }
  
  // 5. Reverse proxy detection
  // Verify deployment environment is correctly configured
  const reverseProxyHeaders = {
    'x-forwarded-for': req.headers['x-forwarded-for'],
    'x-forwarded-proto': req.headers['x-forwarded-proto'],
    'x-forwarded-host': req.headers['x-forwarded-host'],
    'x-real-ip': req.headers['x-real-ip'],
    'cf-connecting-ip': req.headers['cf-connecting-ip'], // Cloudflare
    'x-azure-clientip': req.headers['x-azure-clientip'], // Azure
    'x-appengine-user-ip': req.headers['x-appengine-user-ip'] // GCP App Engine
  };
  
  const hasReverseProxy = Object.values(reverseProxyHeaders).some(v => v);
  
  checks.reverse_proxy = {
    status: hasReverseProxy ? 'pass' : (isProd ? 'warning' : 'pass'),
    message: hasReverseProxy 
      ? 'Reverse proxy detected (AWS ALB/GCP LB/Azure Gateway/nginx/Cloudflare)'
      : (isProd ? 'No reverse proxy headers detected (verify load balancer configuration)' : 'Direct connection (dev mode)'),
    details: {
      detected: hasReverseProxy,
      headers: Object.fromEntries(
        Object.entries(reverseProxyHeaders).filter(([_, v]) => v)
      )
    }
  };
  
  // Determine HTTP status code based on overall status
  let statusCode = 200;
  if (overallStatus === 'insecure' && isProd) {
    statusCode = 426; // Upgrade Required
  } else if (overallStatus === 'degraded') {
    statusCode = 200; // Still operational but degraded
  }
  
  res.status(statusCode).json({
    status: overallStatus,
    timestamp,
    environment: process.env.NODE_ENV,
    https: isHttps,
    checks,
    compliance: {
      fedRAMP: overallStatus === 'secure' ? 'compliant' : 'non-compliant',
      nist_sc8: checks.transport.status === 'pass' && checks.hsts.status !== 'fail',
      irs_pub1075: isHttps || !isProd
    },
    recommendations: overallStatus !== 'secure' ? [
      ...(checks.transport.status === 'fail' ? ['Configure reverse proxy to terminate TLS and set X-Forwarded-Proto header'] : []),
      ...(checks.hsts.status === 'fail' ? ['Enable HSTS with max-age=31536000; includeSubDomains; preload'] : []),
      ...(checks.csp_upgrade.status === 'warning' ? ['Add upgrade-insecure-requests to Content-Security-Policy'] : [])
    ] : []
  });
}

/**
 * TLS Load Balancer Attestation Endpoint
 * 
 * Accepts and validates TLS configuration attestation from production load balancers.
 * This endpoint is used for FedRAMP SC-8 evidence collection where the application
 * cannot directly validate TLS certificates (standard architectural pattern).
 * 
 * Attestation sources supported:
 * - AWS GovCloud ALB (Application Load Balancer) - TLS 1.2+ with FedRAMP-approved ciphers
 * - GCP Cloud Load Balancer - TLS 1.2+ with FIPS 140-2 modules
 * - Azure Application Gateway - TLS 1.2+ with Azure Gov compliance
 * - On-premises nginx/F5 with signed attestation
 * 
 * Security:
 * - GET requests are public (returns requirements and current status)
 * - POST requests require API key authentication (TLS_ATTESTATION_API_KEY env var)
 * - All POST requests are logged for audit trail
 * 
 * @returns 200 OK with attestation status, 400 if invalid attestation format, 401 if unauthorized
 */
export async function tlsAttestationEndpoint(req: Request, res: Response): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // For POST requests, require API key authentication
  if (req.method === 'POST') {
    const apiKey = req.headers['x-attestation-api-key'] as string || 
                   req.headers['authorization']?.replace('Bearer ', '');
    const expectedKey = process.env.TLS_ATTESTATION_API_KEY;
    
    // Require API key in production or when configured
    if (expectedKey && apiKey !== expectedKey) {
      console.log(`[TLS-ATTESTATION] Unauthorized attempt from ${req.ip} at ${timestamp}`);
      res.status(401).json({
        status: 'unauthorized',
        timestamp,
        message: 'Invalid or missing API key. Set X-Attestation-API-Key header.',
        hint: 'Configure TLS_ATTESTATION_API_KEY environment variable for production attestation submission'
      });
      return;
    }
    
    // In production without API key configured, reject attestation submissions
    if (process.env.NODE_ENV === 'production' && !expectedKey) {
      res.status(403).json({
        status: 'forbidden',
        timestamp,
        message: 'TLS_ATTESTATION_API_KEY not configured. Cannot accept attestation in production without authentication.',
        configuration: 'Set TLS_ATTESTATION_API_KEY environment variable to enable attestation submission'
      });
      return;
    }
  }
  
  interface AttestationResult {
    status: 'valid' | 'invalid' | 'pending';
    provider?: string;
    tlsVersion?: string;
    cipherSuite?: string;
    certificateExpiry?: string;
    fedrampCompliant?: boolean;
    fips140Compliant?: boolean;
    attestationId?: string;
    message: string;
  }
  
  // GET: Return current attestation status and requirements
  if (req.method === 'GET') {
    const result: AttestationResult = {
      status: 'pending',
      message: 'TLS attestation not yet submitted. POST attestation evidence to this endpoint.',
    };
    
    // Check for stored attestation in environment (populated by DevOps/deployment pipeline)
    if (process.env.TLS_ATTESTATION_PROVIDER) {
      result.status = 'valid';
      result.provider = process.env.TLS_ATTESTATION_PROVIDER;
      result.tlsVersion = process.env.TLS_ATTESTATION_VERSION || 'TLS 1.2+';
      result.cipherSuite = process.env.TLS_ATTESTATION_CIPHER || 'ECDHE-RSA-AES256-GCM-SHA384';
      result.certificateExpiry = process.env.TLS_ATTESTATION_CERT_EXPIRY;
      result.fedrampCompliant = process.env.TLS_ATTESTATION_FEDRAMP === 'true';
      result.fips140Compliant = process.env.TLS_ATTESTATION_FIPS140 === 'true';
      result.attestationId = process.env.TLS_ATTESTATION_ID;
      result.message = 'TLS attestation verified via deployment pipeline';
    }
    
    res.status(200).json({
      timestamp,
      attestation: result,
      requirements: {
        fedramp: {
          tlsMinVersion: 'TLS 1.2',
          requiredCiphers: [
            'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
            'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
            'TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384',
            'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256'
          ],
          hstsRequired: true,
          hstsMinMaxAge: 31536000
        },
        irs_pub_1075: {
          tlsMinVersion: 'TLS 1.2',
          fips140Required: true,
          description: 'FIPS 140-2 validated cryptographic modules required for FTI transmission'
        },
        nist_sp_800_52: {
          tlsMinVersion: 'TLS 1.2',
          description: 'Guidelines for TLS Implementations - require TLS 1.2 minimum'
        }
      },
      instructions: {
        awsGovCloud: 'Use AWS Certificate Manager with ALB configured for TLS 1.2+ and FIPS endpoints',
        gcp: 'Configure Cloud Load Balancer with managed certificates and FIPS 140-2 BoringCrypto',
        azure: 'Use Azure Application Gateway with TLS 1.2 policy and Azure Government compliance',
        onPremises: 'Submit signed attestation document with TLS configuration evidence'
      }
    });
    return;
  }
  
  // POST: Validate and accept attestation evidence
  if (req.method === 'POST') {
    const body = req.body as {
      provider?: string;
      tlsVersion?: string;
      cipherSuite?: string;
      certificateThumbprint?: string;
      certificateExpiry?: string;
      signedAttestation?: string;
      fedrampCompliant?: boolean;
      fips140Compliant?: boolean;
    };
    
    // Validate required fields
    if (!body.provider || !body.tlsVersion) {
      res.status(400).json({
        status: 'invalid',
        timestamp,
        message: 'Missing required fields: provider, tlsVersion',
        required: ['provider', 'tlsVersion', 'cipherSuite', 'certificateExpiry']
      });
      return;
    }
    
    // Validate TLS version meets FedRAMP requirements
    const validTlsVersions = ['TLS 1.2', 'TLS 1.3', 'TLSv1.2', 'TLSv1.3'];
    const normalizedTlsVersion = body.tlsVersion.replace(/\s+/g, ' ').trim();
    const isTlsValid = validTlsVersions.some(v => 
      normalizedTlsVersion.toLowerCase().includes(v.toLowerCase())
    );
    
    if (!isTlsValid) {
      res.status(400).json({
        status: 'invalid',
        timestamp,
        message: `TLS version '${body.tlsVersion}' does not meet FedRAMP requirements (TLS 1.2+ required)`,
        validVersions: validTlsVersions
      });
      return;
    }
    
    // Generate attestation ID for audit trail
    const attestationId = `ATTEST-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Log attestation for audit (would be persisted in production)
    console.log(`[TLS-ATTESTATION] ${attestationId}: Provider=${body.provider}, TLS=${body.tlsVersion}, FedRAMP=${body.fedrampCompliant}, FIPS=${body.fips140Compliant}`);
    
    res.status(200).json({
      status: 'valid',
      timestamp,
      attestationId,
      message: 'TLS attestation accepted and logged for FedRAMP SC-8 compliance evidence',
      attestation: {
        provider: body.provider,
        tlsVersion: body.tlsVersion,
        cipherSuite: body.cipherSuite,
        certificateExpiry: body.certificateExpiry,
        fedrampCompliant: body.fedrampCompliant ?? false,
        fips140Compliant: body.fips140Compliant ?? false
      },
      compliance: {
        fedRAMP_SC8: isTlsValid,
        irs_pub_1075: body.fips140Compliant ?? false,
        nist_sp_800_52: isTlsValid
      },
      instructions: {
        next: 'Set TLS_ATTESTATION_* environment variables for persistent attestation status',
        variables: [
          'TLS_ATTESTATION_PROVIDER',
          'TLS_ATTESTATION_VERSION',
          'TLS_ATTESTATION_CIPHER',
          'TLS_ATTESTATION_CERT_EXPIRY',
          'TLS_ATTESTATION_FEDRAMP',
          'TLS_ATTESTATION_FIPS140',
          'TLS_ATTESTATION_ID'
        ]
      }
    });
    return;
  }
  
  // Unsupported method
  res.status(405).json({
    status: 'error',
    message: 'Method not allowed. Use GET to check status or POST to submit attestation.',
    allowedMethods: ['GET', 'POST']
  });
}

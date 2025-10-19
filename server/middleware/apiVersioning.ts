import { Request, Response, NextFunction } from 'express';

export const CURRENT_API_VERSION = 'v1';
export const SUPPORTED_API_VERSIONS = ['v1'];
export const DEPRECATED_API_VERSIONS: string[] = [];

/**
 * API Version Middleware
 * 
 * Extracts API version from:
 * 1. URL path (/api/v1/...)
 * 2. Accept-Version header
 * 3. X-API-Version header
 * 
 * Defaults to current version if not specified.
 */
export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract version from URL path
  const pathVersion = req.path.match(/^\/api\/(v\d+)\//)?.[1];
  
  // Extract from headers
  const headerVersion = req.headers['accept-version'] || req.headers['x-api-version'];
  
  // Determine the version to use
  const requestedVersion = pathVersion || headerVersion || CURRENT_API_VERSION;
  
  // Validate version is supported
  if (!SUPPORTED_API_VERSIONS.includes(requestedVersion)) {
    return res.status(400).json({
      error: 'Unsupported API Version',
      message: `API version '${requestedVersion}' is not supported. Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}`,
      currentVersion: CURRENT_API_VERSION,
      supportedVersions: SUPPORTED_API_VERSIONS,
    });
  }
  
  // Check if version is deprecated
  const isDeprecated = DEPRECATED_API_VERSIONS.includes(requestedVersion);
  
  // Attach version info to request
  (req as any).apiVersion = requestedVersion;
  
  // Set response headers
  res.setHeader('X-API-Version', requestedVersion);
  res.setHeader('X-API-Current-Version', CURRENT_API_VERSION);
  
  // Add deprecation warning if applicable
  if (isDeprecated) {
    res.setHeader('Warning', `299 - "API version ${requestedVersion} is deprecated. Please migrate to ${CURRENT_API_VERSION}."`);
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Sunset-Date', getSunsetDate(requestedVersion));
  }
  
  next();
}

/**
 * Get the sunset date for a deprecated API version
 */
function getSunsetDate(version: string): string {
  // In production, this would come from a configuration
  const sunsetDates: Record<string, string> = {
    // 'v0': '2026-01-01',
  };
  
  return sunsetDates[version] || 'TBD';
}

/**
 * Route version wrapper
 * Adds version prefix to route paths
 */
export function versionRoute(version: string, path: string): string {
  // If path already has /api/vX prefix, return as-is
  if (path.match(/^\/api\/v\d+\//)) {
    return path;
  }
  
  // If path starts with /api/, inject version
  if (path.startsWith('/api/')) {
    return path.replace('/api/', `/api/${version}/`);
  }
  
  // Otherwise, add version prefix
  return `/api/${version}${path}`;
}

/**
 * Deprecation notice middleware
 * Logs when deprecated endpoints are accessed
 */
export function deprecationNotice(version: string, message: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    console.warn(`[DEPRECATION] ${req.method} ${req.path} - ${message}`);
    res.setHeader('X-Deprecation-Notice', message);
    next();
  };
}

/**
 * Helper to create versioned route handlers
 */
export interface VersionedRouteHandler {
  version: string;
  handler: (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
}

export function versionedRoute(
  handlers: VersionedRouteHandler[],
  defaultHandler?: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiVersion = (req as any).apiVersion || CURRENT_API_VERSION;
    
    // Find handler for requested version
    const versionHandler = handlers.find(h => h.version === apiVersion);
    
    if (versionHandler) {
      return versionHandler.handler(req, res, next);
    }
    
    // Fall back to default handler if provided
    if (defaultHandler) {
      return defaultHandler(req, res, next);
    }
    
    // No handler found
    return res.status(501).json({
      error: 'Version Not Implemented',
      message: `Endpoint not available in API version ${apiVersion}`,
      availableVersions: handlers.map(h => h.version),
    });
  };
}

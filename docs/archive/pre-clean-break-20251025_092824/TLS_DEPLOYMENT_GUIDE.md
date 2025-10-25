# TLS Deployment Guide (CRIT-001)

**Document Version:** 1.0.0  
**Last Updated:** 2025-10-23  
**Target Compliance:** FedRAMP Moderate, NIST SP 800-52r2, IRS Pub 1075, HIPAA Security Rule  
**Target States:** Maryland, Pennsylvania, Virginia, Utah, Indiana, Michigan

---

## Table of Contents

1. [Overview](#overview)
2. [TLS Requirements](#tls-requirements)
3. [Cloud Deployment Options](#cloud-deployment-options)
   - [AWS GovCloud (Application Load Balancer)](#aws-govcloud-application-load-balancer)
   - [Google Cloud Platform (Cloud Load Balancer)](#google-cloud-platform-cloud-load-balancer)
   - [Azure Government (Application Gateway)](#azure-government-application-gateway)
4. [On-Premises Deployment Options](#on-premises-deployment-options)
   - [nginx Reverse Proxy](#nginx-reverse-proxy)
   - [Apache HTTP Server](#apache-http-server)
5. [Certificate Management](#certificate-management)
6. [Verification & Testing](#verification--testing)
7. [Troubleshooting](#troubleshooting)
8. [Compliance Mapping](#compliance-mapping)

---

## Overview

JAWN's TLS verification system (CRIT-001) provides deployment-agnostic HTTPS enforcement suitable for multi-state white-label deployments. This guide provides FedRAMP Moderate-compliant configurations for all major cloud platforms and on-premises reverse proxies.

### Architecture Pattern

```
┌──────────────┐     HTTPS      ┌─────────────────┐     HTTP      ┌──────────────┐
│              │  ───────────>   │  Reverse Proxy  │  ──────────>  │              │
│   Client     │                 │  (ALB/nginx/    │               │  JAWN App    │
│   Browser    │  <─────────────  │   Apache)       │  <──────────  │  (Node.js)   │
│              │     HTTPS       │                 │     HTTP      │              │
└──────────────┘                 └─────────────────┘               └──────────────┘
                                         │                                │
                                         │ Sets X-Forwarded-Proto         │
                                         └────────────────────────────────┘
                                         
                                 JAWN validates via:
                                 - req.protocol === 'https'
                                 - req.get('X-Forwarded-Proto') === 'https'
```

### Key Features

- **Deployment-Agnostic**: Works with any reverse proxy that sets `X-Forwarded-Proto: https`
- **Production HTTPS Enforcement**: Blocks HTTP requests in production with 426 Upgrade Required
- **Real-Time Health Checks**: `/api/health/tls` endpoint validates HTTPS/HSTS/CSP/cookies
- **Multi-Cloud Ready**: Tested configurations for AWS, GCP, Azure, nginx, Apache

---

## TLS Requirements

### Minimum TLS Configuration (FedRAMP Moderate Baseline)

| Requirement | Value | Compliance Standard |
|------------|-------|---------------------|
| **TLS Version** | TLS 1.2 minimum, TLS 1.3 recommended | NIST SP 800-52r2, FedRAMP |
| **Cipher Suites** | ECDHE-RSA-AES128-GCM-SHA256, ECDHE-RSA-AES256-GCM-SHA384, TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384 | NIST SP 800-52r2 |
| **Certificate Authority** | Federal PKI (FPKI), IdenTrust, DigiCert, or state-approved CA | FedRAMP, IRS Pub 1075 |
| **Certificate Expiry** | 90 days maximum (automated renewal recommended) | Let's Encrypt, Industry Best Practice |
| **HSTS Max-Age** | 31536000 seconds (1 year) minimum | NIST SP 800-52r2 |
| **Key Size** | RSA 2048-bit minimum, ECDSA P-256 recommended | NIST SP 800-57 |

### Prohibited Configurations

- ❌ SSL 2.0, SSL 3.0, TLS 1.0, TLS 1.1 (deprecated)
- ❌ RC4, DES, 3DES, MD5 cipher suites (weak cryptography)
- ❌ Self-signed certificates in production (except for internal testing)
- ❌ HTTP-only deployments (blocked by JAWN in production mode)

---

## Cloud Deployment Options

### AWS GovCloud (Application Load Balancer)

#### Prerequisites

- AWS GovCloud account with FedRAMP authorization
- ACM (AWS Certificate Manager) certificate or imported third-party certificate
- VPC with public and private subnets

#### Step 1: Create ACM Certificate

```bash
# Option A: Request ACM-managed certificate (automated renewal)
aws acm request-certificate \
  --domain-name "jawn.maryland.gov" \
  --subject-alternative-names "*.jawn.maryland.gov" \
  --validation-method DNS \
  --region us-gov-west-1

# Option B: Import third-party certificate
aws acm import-certificate \
  --certificate fileb://cert.pem \
  --private-key fileb://privkey.pem \
  --certificate-chain fileb://chain.pem \
  --region us-gov-west-1
```

#### Step 2: Create Application Load Balancer

```bash
# Create ALB in public subnets
aws elbv2 create-load-balancer \
  --name jawn-production-alb \
  --subnets subnet-abc123 subnet-def456 \
  --security-groups sg-12345678 \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --region us-gov-west-1
```

#### Step 3: Configure HTTPS Listener (FedRAMP-Compliant)

```bash
# Create HTTPS listener with TLS 1.2+ and approved cipher suites
aws elbv2 create-listener \
  --load-balancer-arn arn:aws-us-gov:elasticloadbalancing:us-gov-west-1:123456789012:loadbalancer/app/jawn-production-alb/1234567890abcdef \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws-us-gov:acm:us-gov-west-1:123456789012:certificate/abcd1234-ab12-cd34-ef56-1234567890ab \
  --ssl-policy ELBSecurityPolicy-TLS-1-2-Ext-2018-06 \
  --default-actions Type=forward,TargetGroupArn=arn:aws-us-gov:elasticloadbalancing:us-gov-west-1:123456789012:targetgroup/jawn-app/1234567890abcdef
```

**Approved SSL Policies for FedRAMP:**

- `ELBSecurityPolicy-TLS-1-2-Ext-2018-06` (TLS 1.2 minimum)
- `ELBSecurityPolicy-TLS13-1-2-2021-06` (TLS 1.3 + 1.2, recommended)

#### Step 4: Configure HTTP-to-HTTPS Redirect

```bash
# Create HTTP listener that redirects to HTTPS
aws elbv2 create-listener \
  --load-balancer-arn arn:aws-us-gov:elasticloadbalancing:us-gov-west-1:123456789012:loadbalancer/app/jawn-production-alb/1234567890abcdef \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}"
```

#### Step 5: Configure Target Group Health Checks

```bash
# Configure health checks for Node.js backend
aws elbv2 modify-target-group \
  --target-group-arn arn:aws-us-gov:elasticloadbalancing:us-gov-west-1:123456789012:targetgroup/jawn-app/1234567890abcdef \
  --health-check-protocol HTTP \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3
```

#### Step 6: Configure ALB Attributes

```bash
# Enable access logs and connection draining
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn arn:aws-us-gov:elasticloadbalancing:us-gov-west-1:123456789012:loadbalancer/app/jawn-production-alb/1234567890abcdef \
  --attributes \
    Key=access_logs.s3.enabled,Value=true \
    Key=access_logs.s3.bucket,Value=jawn-alb-logs \
    Key=idle_timeout.timeout_seconds,Value=60 \
    Key=deletion_protection.enabled,Value=true
```

#### Security Group Configuration

```bash
# Allow HTTPS from internet
aws ec2 authorize-security-group-ingress \
  --group-id sg-alb-12345678 \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Allow HTTP from internet (for redirect only)
aws ec2 authorize-security-group-ingress \
  --group-id sg-alb-12345678 \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Allow ALB to reach backend on port 5000
aws ec2 authorize-security-group-ingress \
  --group-id sg-app-87654321 \
  --protocol tcp \
  --port 5000 \
  --source-group sg-alb-12345678
```

---

### Google Cloud Platform (Cloud Load Balancer)

#### Prerequisites

- GCP project with appropriate IAM permissions
- Cloud Load Balancing API enabled
- Managed SSL certificate or uploaded third-party certificate

#### Step 1: Create Managed SSL Certificate

```bash
# Option A: Google-managed certificate (automated renewal)
gcloud compute ssl-certificates create jawn-ssl-cert \
  --domains=jawn.pennsylvania.gov,www.jawn.pennsylvania.gov \
  --global

# Option B: Upload third-party certificate
gcloud compute ssl-certificates create jawn-ssl-cert \
  --certificate=cert.pem \
  --private-key=privkey.pem \
  --global
```

#### Step 2: Create Backend Service

```bash
# Create instance group (example: managed instance group)
gcloud compute instance-groups managed create jawn-instance-group \
  --base-instance-name=jawn-app \
  --size=3 \
  --template=jawn-instance-template \
  --zone=us-east4-a

# Create health check
gcloud compute health-checks create http jawn-health-check \
  --port=5000 \
  --request-path=/api/health \
  --check-interval=30s \
  --timeout=5s \
  --healthy-threshold=2 \
  --unhealthy-threshold=3

# Create backend service
gcloud compute backend-services create jawn-backend-service \
  --protocol=HTTP \
  --health-checks=jawn-health-check \
  --port-name=http \
  --timeout=30s \
  --enable-cdn \
  --global
```

#### Step 3: Add Instance Group to Backend Service

```bash
gcloud compute backend-services add-backend jawn-backend-service \
  --instance-group=jawn-instance-group \
  --instance-group-zone=us-east4-a \
  --balancing-mode=UTILIZATION \
  --max-utilization=0.8 \
  --global
```

#### Step 4: Create URL Map

```bash
# Create URL map for routing
gcloud compute url-maps create jawn-url-map \
  --default-service=jawn-backend-service \
  --global
```

#### Step 5: Create HTTPS Target Proxy (FedRAMP-Compliant)

```bash
# Create HTTPS target proxy with TLS 1.2+ enforcement
gcloud compute target-https-proxies create jawn-https-proxy \
  --url-map=jawn-url-map \
  --ssl-certificates=jawn-ssl-cert \
  --global

# Configure minimum TLS version (TLS 1.2)
gcloud compute ssl-policies create jawn-ssl-policy \
  --profile=MODERN \
  --min-tls-version=1.2 \
  --global

# Apply SSL policy to proxy
gcloud compute target-https-proxies update jawn-https-proxy \
  --ssl-policy=jawn-ssl-policy \
  --global
```

**Approved SSL Profiles:**

- `MODERN`: TLS 1.2+ with strong cipher suites (recommended)
- `RESTRICTED`: TLS 1.2+ with most restrictive cipher suites (high security)

#### Step 6: Create Global Forwarding Rules

```bash
# Reserve static IP address
gcloud compute addresses create jawn-ip-address \
  --ip-version=IPV4 \
  --global

# Create HTTPS forwarding rule
gcloud compute forwarding-rules create jawn-https-rule \
  --address=jawn-ip-address \
  --target-https-proxy=jawn-https-proxy \
  --ports=443 \
  --global

# Create HTTP-to-HTTPS redirect (requires URL map)
gcloud compute url-maps import jawn-http-redirect \
  --global \
  --source=/dev/stdin <<EOF
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
EOF

gcloud compute target-http-proxies create jawn-http-proxy \
  --url-map=jawn-http-redirect \
  --global

gcloud compute forwarding-rules create jawn-http-rule \
  --address=jawn-ip-address \
  --target-http-proxy=jawn-http-proxy \
  --ports=80 \
  --global
```

#### Step 7: Configure Firewall Rules

```bash
# Allow HTTPS from internet to load balancer
gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --target-tags jawn-lb

# Allow HTTP from internet (for redirect)
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --source-ranges 0.0.0.0/0 \
  --target-tags jawn-lb

# Allow health checks from GCP ranges
gcloud compute firewall-rules create allow-health-checks \
  --allow tcp:5000 \
  --source-ranges 130.211.0.0/22,35.191.0.0/16 \
  --target-tags jawn-app
```

---

### Azure Government (Application Gateway)

#### Prerequisites

- Azure Government subscription
- Resource group and virtual network
- Key Vault with SSL certificate

#### Step 1: Store Certificate in Key Vault

```bash
# Create Key Vault
az keyvault create \
  --name jawn-keyvault \
  --resource-group jawn-rg \
  --location usgovvirginia \
  --enabled-for-deployment true \
  --enabled-for-template-deployment true

# Import certificate
az keyvault certificate import \
  --vault-name jawn-keyvault \
  --name jawn-ssl-cert \
  --file cert.pfx \
  --password "YourCertificatePassword"
```

#### Step 2: Create Application Gateway

```bash
# Create public IP
az network public-ip create \
  --resource-group jawn-rg \
  --name jawn-public-ip \
  --allocation-method Static \
  --sku Standard \
  --location usgovvirginia

# Create Application Gateway with WAF
az network application-gateway create \
  --name jawn-appgw \
  --resource-group jawn-rg \
  --location usgovvirginia \
  --vnet-name jawn-vnet \
  --subnet appgw-subnet \
  --capacity 2 \
  --sku WAF_v2 \
  --http-settings-cookie-based-affinity Disabled \
  --frontend-port 443 \
  --http-settings-port 5000 \
  --http-settings-protocol Http \
  --public-ip-address jawn-public-ip \
  --cert-file cert.pfx \
  --cert-password "YourCertificatePassword"
```

#### Step 3: Configure SSL Policy (FedRAMP-Compliant)

```bash
# Set minimum TLS version to 1.2
az network application-gateway ssl-policy set \
  --resource-group jawn-rg \
  --gateway-name jawn-appgw \
  --min-protocol-version TLSv1_2 \
  --policy-type Predefined \
  --policy-name AppGwSslPolicy20170401S

# Or use custom policy for maximum control
az network application-gateway ssl-policy set \
  --resource-group jawn-rg \
  --gateway-name jawn-appgw \
  --policy-type Custom \
  --min-protocol-version TLSv1_2 \
  --cipher-suites \
    TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 \
    TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 \
    TLS_AES_128_GCM_SHA256 \
    TLS_AES_256_GCM_SHA384
```

**Approved SSL Policies:**

- `AppGwSslPolicy20170401S`: TLS 1.2+ with strong ciphers (recommended)
- `AppGwSslPolicy20220101`: TLS 1.2+ with modern ciphers (most secure)

#### Step 4: Configure HTTP-to-HTTPS Redirect

```bash
# Create HTTP listener
az network application-gateway http-listener create \
  --resource-group jawn-rg \
  --gateway-name jawn-appgw \
  --name http-listener \
  --frontend-port 80 \
  --frontend-ip appGatewayFrontendIP

# Create redirect configuration
az network application-gateway redirect-config create \
  --resource-group jawn-rg \
  --gateway-name jawn-appgw \
  --name http-to-https \
  --type Permanent \
  --target-listener https-listener \
  --include-path true \
  --include-query-string true

# Create redirect rule
az network application-gateway rule create \
  --resource-group jawn-rg \
  --gateway-name jawn-appgw \
  --name redirect-rule \
  --http-listener http-listener \
  --rule-type Basic \
  --redirect-config http-to-https
```

#### Step 5: Configure WAF Rules

```bash
# Enable WAF with OWASP 3.2 ruleset
az network application-gateway waf-config set \
  --resource-group jawn-rg \
  --gateway-name jawn-appgw \
  --enabled true \
  --firewall-mode Prevention \
  --rule-set-type OWASP \
  --rule-set-version 3.2
```

#### Step 6: Configure Backend Health Probes

```bash
# Create custom health probe
az network application-gateway probe create \
  --resource-group jawn-rg \
  --gateway-name jawn-appgw \
  --name jawn-health-probe \
  --protocol Http \
  --host-name-from-http-settings true \
  --path /api/health \
  --interval 30 \
  --timeout 30 \
  --threshold 3

# Associate probe with backend settings
az network application-gateway http-settings update \
  --resource-group jawn-rg \
  --gateway-name jawn-appgw \
  --name appGatewayBackendHttpSettings \
  --probe jawn-health-probe
```

---

## On-Premises Deployment Options

### nginx Reverse Proxy

#### Prerequisites

- nginx 1.18.0+ (supports TLS 1.3)
- OpenSSL 1.1.1+
- Valid SSL certificate and private key

#### nginx Configuration File

Create `/etc/nginx/sites-available/jawn.conf`:

```nginx
# HTTP-to-HTTPS Redirect
server {
    listen 80;
    listen [::]:80;
    server_name jawn.pennsylvania.gov www.jawn.pennsylvania.gov;

    # Redirect all HTTP requests to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS Server (FedRAMP-Compliant)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name jawn.pennsylvania.gov www.jawn.pennsylvania.gov;

    # ============================================================================
    # SSL/TLS Configuration (NIST SP 800-52r2 Compliant)
    # ============================================================================
    
    # Certificate paths (update with your paths)
    ssl_certificate /etc/ssl/certs/jawn.pennsylvania.gov.crt;
    ssl_certificate_key /etc/ssl/private/jawn.pennsylvania.gov.key;
    ssl_trusted_certificate /etc/ssl/certs/jawn.pennsylvania.gov.chain.crt;

    # TLS Protocol Versions (TLS 1.2 minimum, TLS 1.3 preferred)
    ssl_protocols TLSv1.2 TLSv1.3;

    # Cipher Suites (NIST SP 800-52r2 Approved)
    ssl_ciphers 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384';
    ssl_prefer_server_ciphers on;

    # SSL Session Settings
    ssl_session_cache shared:SSL:50m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling (reduces client-side latency)
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # ============================================================================
    # Security Headers (NIST SP 800-52r2, FedRAMP Moderate)
    # ============================================================================
    
    # HSTS (HTTP Strict Transport Security) - 1 year, include subdomains
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Prevent clickjacking
    add_header X-Frame-Options "DENY" always;

    # Prevent MIME type sniffing
    add_header X-Content-Type-Options "nosniff" always;

    # XSS Protection (legacy browsers)
    add_header X-XSS-Protection "1; mode=block" always;

    # Referrer Policy
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Content Security Policy (strict policy - adjust as needed)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; upgrade-insecure-requests;" always;

    # Permissions Policy (formerly Feature-Policy)
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # ============================================================================
    # Reverse Proxy Configuration
    # ============================================================================
    
    # Proxy to JAWN backend (Node.js on port 5000)
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # CRITICAL: Set X-Forwarded-Proto for JAWN TLS detection
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # WebSocket support (for real-time notifications)
    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;

        # WebSocket timeouts (longer for persistent connections)
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # ============================================================================
    # Access and Error Logs
    # ============================================================================
    
    access_log /var/log/nginx/jawn-access.log;
    error_log /var/log/nginx/jawn-error.log warn;

    # ============================================================================
    # File Upload Limits
    # ============================================================================
    
    client_max_body_size 10M;
}
```

#### Enable nginx Configuration

```bash
# Validate nginx configuration
sudo nginx -t

# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/jawn.conf /etc/nginx/sites-enabled/

# Reload nginx
sudo systemctl reload nginx

# Enable nginx to start on boot
sudo systemctl enable nginx
```

#### nginx SSL Certificate Renewal (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d jawn.pennsylvania.gov -d www.jawn.pennsylvania.gov

# Test automatic renewal
sudo certbot renew --dry-run

# Renewal cron job (runs twice daily)
sudo crontab -e
# Add: 0 0,12 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

### Apache HTTP Server

#### Prerequisites

- Apache 2.4.48+ (supports TLS 1.3)
- OpenSSL 1.1.1+
- Enabled modules: `ssl`, `headers`, `proxy`, `proxy_http`, `proxy_wstunnel`

#### Enable Required Apache Modules

```bash
sudo a2enmod ssl
sudo a2enmod headers
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo systemctl restart apache2
```

#### Apache Configuration File

Create `/etc/apache2/sites-available/jawn-ssl.conf`:

```apache
# HTTP-to-HTTPS Redirect
<VirtualHost *:80>
    ServerName jawn.virginia.gov
    ServerAlias www.jawn.virginia.gov

    # Redirect all HTTP traffic to HTTPS
    Redirect permanent / https://jawn.virginia.gov/
</VirtualHost>

# HTTPS Server (FedRAMP-Compliant)
<VirtualHost *:443>
    ServerName jawn.virginia.gov
    ServerAlias www.jawn.virginia.gov

    # ============================================================================
    # SSL/TLS Configuration (NIST SP 800-52r2 Compliant)
    # ============================================================================
    
    SSLEngine on

    # Certificate paths (update with your paths)
    SSLCertificateFile /etc/ssl/certs/jawn.virginia.gov.crt
    SSLCertificateKeyFile /etc/ssl/private/jawn.virginia.gov.key
    SSLCertificateChainFile /etc/ssl/certs/jawn.virginia.gov.chain.crt

    # TLS Protocol Versions (TLS 1.2 minimum, TLS 1.3 preferred)
    SSLProtocol -all +TLSv1.2 +TLSv1.3

    # Cipher Suites (NIST SP 800-52r2 Approved)
    SSLCipherSuite ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384
    SSLHonorCipherOrder on

    # SSL Session Settings
    SSLSessionCache "shmcb:/var/cache/apache2/ssl_scache(512000)"
    SSLSessionCacheTimeout 300

    # OCSP Stapling
    SSLUseStapling on
    SSLStaplingCache "shmcb:/var/cache/apache2/stapling_cache(128000)"

    # ============================================================================
    # Security Headers (NIST SP 800-52r2, FedRAMP Moderate)
    # ============================================================================
    
    # HSTS (HTTP Strict Transport Security) - 1 year, include subdomains
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

    # Prevent clickjacking
    Header always set X-Frame-Options "DENY"

    # Prevent MIME type sniffing
    Header always set X-Content-Type-Options "nosniff"

    # XSS Protection
    Header always set X-XSS-Protection "1; mode=block"

    # Referrer Policy
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # Content Security Policy
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"

    # Permissions Policy
    Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"

    # ============================================================================
    # Reverse Proxy Configuration
    # ============================================================================
    
    ProxyPreserveHost On
    ProxyRequests Off

    # CRITICAL: Set X-Forwarded-Proto for JAWN TLS detection
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-For "%{REMOTE_ADDR}s"

    # Proxy to JAWN backend (Node.js on port 5000)
    ProxyPass / http://127.0.0.1:5000/
    ProxyPassReverse / http://127.0.0.1:5000/

    # WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*) ws://127.0.0.1:5000/$1 [P,L]

    # ============================================================================
    # Access and Error Logs
    # ============================================================================
    
    ErrorLog ${APACHE_LOG_DIR}/jawn-error.log
    CustomLog ${APACHE_LOG_DIR}/jawn-access.log combined

    # ============================================================================
    # File Upload Limits
    # ============================================================================
    
    LimitRequestBody 10485760
</VirtualHost>
```

#### Enable Apache Configuration

```bash
# Validate Apache configuration
sudo apachectl configtest

# Enable site
sudo a2ensite jawn-ssl.conf

# Reload Apache
sudo systemctl reload apache2

# Enable Apache to start on boot
sudo systemctl enable apache2
```

#### Apache SSL Certificate Renewal (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-apache

# Obtain certificate
sudo certbot --apache -d jawn.virginia.gov -d www.jawn.virginia.gov

# Test automatic renewal
sudo certbot renew --dry-run

# Renewal cron job
sudo crontab -e
# Add: 0 0,12 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload apache2"
```

---

## Certificate Management

### Certificate Acquisition Options

#### Option 1: Let's Encrypt (Automated, Free)

**Best for:** Development, staging, small-scale production deployments

```bash
# Install certbot (nginx)
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d jawn.example.gov

# Install certbot (Apache)
sudo apt-get install certbot python3-certbot-apache
sudo certbot --apache -d jawn.example.gov
```

**Pros:**
- Free and automated renewal
- Trusted by all modern browsers
- 90-day validity (forces regular rotation)

**Cons:**
- Not FedRAMP-approved for federal deployments
- Requires public DNS validation
- No wildcard certificates without DNS-01 challenge

#### Option 2: State/Federal PKI (FPKI)

**Best for:** FedRAMP, IRS Pub 1075, state government deployments

**Approved Certificate Authorities:**
- Federal PKI Bridge (federated trust)
- DigiCert Federal SSP (FedRAMP High)
- IdenTrust Federal SSP (FedRAMP Moderate)
- Entrust Managed Services PKI (FedRAMP Moderate)

**Acquisition Process:**
1. Submit CSR (Certificate Signing Request) to state IT security team
2. Undergo identity verification (may require in-person validation)
3. Receive signed certificate with 1-2 year validity
4. Import certificate to cloud provider or on-premises server

#### Option 3: Commercial CA (DigiCert, Sectigo, GlobalSign)

**Best for:** Private-sector deployments, non-FedRAMP government

**Acquisition Process:**
```bash
# Generate CSR with OpenSSL
openssl req -new -newkey rsa:2048 -nodes \
  -keyout jawn.example.gov.key \
  -out jawn.example.gov.csr \
  -subj "/C=US/ST=Pennsylvania/L=Philadelphia/O=Commonwealth of Pennsylvania/CN=jawn.pennsylvania.gov"

# Submit CSR to CA (DigiCert, Sectigo, etc.)
# Undergo domain validation (email, DNS, or HTTP)
# Download signed certificate and intermediate chain
```

### Certificate Renewal Best Practices

| Practice | Recommendation | Rationale |
|----------|---------------|-----------|
| **Renewal Window** | 30 days before expiry | Prevents downtime from delayed renewals |
| **Automated Renewal** | Use certbot, ACM, or Key Vault | Eliminates human error |
| **Renewal Alerts** | Email/Slack notifications at 60/30/7 days | Provides escalation path if automation fails |
| **Staging Validation** | Test renewal in non-production first | Catches configuration errors before production |
| **Certificate Monitoring** | Use `/api/health/tls` endpoint | Real-time validation of TLS configuration |

---

## Verification & Testing

### Step 1: Verify TLS Health Endpoint

```bash
# Test from command line (replace with your domain)
curl -v https://jawn.pennsylvania.gov/api/health/tls | jq .

# Expected response (production):
{
  "status": "secure",
  "https": true,
  "hsts": true,
  "csp": true,
  "secureCookies": true,
  "forwardedProto": "https",
  "compliance": {
    "fedramp": true,
    "nist_sc8": true,
    "irs_pub1075": true
  },
  "environment": "production",
  "timestamp": "2025-10-23T15:30:00Z"
}
```

### Step 2: SSL Labs Test

Visit [SSL Labs](https://www.ssllabs.com/ssltest/) and test your domain:

**Required Grade for FedRAMP Moderate:** A or A+

**Key Checks:**
- ✅ Certificate validity and chain
- ✅ TLS 1.2+ protocol support
- ✅ Strong cipher suites only
- ✅ HSTS enabled
- ✅ OCSP stapling working

### Step 3: SecurityHeaders.com Test

Visit [SecurityHeaders.com](https://securityheaders.com) and test your domain:

**Required Grade:** A or A+

**Key Checks:**
- ✅ Strict-Transport-Security header
- ✅ Content-Security-Policy header
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ Referrer-Policy present

### Step 4: Manual Browser Testing

```bash
# Test HTTP-to-HTTPS redirect
curl -I http://jawn.pennsylvania.gov
# Expected: HTTP/1.1 301 Moved Permanently
#           Location: https://jawn.pennsylvania.gov

# Test HTTPS connection
curl -I https://jawn.pennsylvania.gov
# Expected: HTTP/2 200
#           Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# Test WebSocket upgrade (if applicable)
wscat -c wss://jawn.pennsylvania.gov/ws/notifications
```

### Step 5: Compliance Validation Script

Create `scripts/validate-tls.sh`:

```bash
#!/bin/bash
# TLS Compliance Validation Script for JAWN

DOMAIN="${1:-jawn.pennsylvania.gov}"

echo "==================================================="
echo "JAWN TLS Compliance Validation"
echo "Domain: $DOMAIN"
echo "==================================================="

# 1. Check TLS version
echo -n "TLS Version: "
openssl s_client -connect "$DOMAIN:443" -tls1_2 < /dev/null 2>&1 | grep "Protocol" | awk '{print $3}'

# 2. Check cipher suite
echo -n "Cipher Suite: "
openssl s_client -connect "$DOMAIN:443" < /dev/null 2>&1 | grep "Cipher" | awk '{print $3}'

# 3. Check certificate expiry
echo -n "Certificate Expiry: "
openssl s_client -connect "$DOMAIN:443" < /dev/null 2>&1 | openssl x509 -noout -enddate | cut -d= -f2

# 4. Check HSTS header
echo -n "HSTS Header: "
curl -s -I "https://$DOMAIN" | grep -i "strict-transport-security" | cut -d: -f2-

# 5. Check /api/health/tls endpoint
echo "TLS Health Check:"
curl -s "https://$DOMAIN/api/health/tls" | jq .

echo "==================================================="
echo "Validation Complete"
echo "==================================================="
```

---

## Troubleshooting

### Issue: JAWN Returns 426 Upgrade Required in Production

**Symptoms:**
```json
{
  "error": "HTTPS Required",
  "message": "This application requires HTTPS in production environments...",
  "statusCode": 426
}
```

**Root Cause:** JAWN is not detecting HTTPS connection from reverse proxy.

**Solution:**

1. **Verify `X-Forwarded-Proto` header is set:**
   ```bash
   # nginx
   proxy_set_header X-Forwarded-Proto $scheme;
   
   # Apache
   RequestHeader set X-Forwarded-Proto "https"
   
   # AWS ALB - automatically set
   # GCP Load Balancer - automatically set
   # Azure App Gateway - automatically set
   ```

2. **Verify Express trust proxy setting:**
   ```typescript
   // server/index.ts (already configured)
   app.set('trust proxy', 1);
   ```

3. **Test header propagation:**
   ```bash
   curl -H "X-Forwarded-Proto: https" http://localhost:5000/api/health/tls
   ```

### Issue: SSL Labs Grade Below A

**Common Issues:**

1. **Weak cipher suites enabled:**
   - Remove RC4, DES, 3DES ciphers
   - Use only ECDHE-RSA-AES128-GCM-SHA256 and stronger

2. **TLS 1.0/1.1 still enabled:**
   - Disable all protocols except TLS 1.2 and TLS 1.3

3. **Missing HSTS header:**
   - Add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

4. **Certificate chain incomplete:**
   - Include intermediate certificates in chain file

### Issue: WebSocket Connections Fail Over HTTPS

**Symptoms:**
- Chat/notifications not working in production
- Browser console errors: `WebSocket connection to 'wss://...' failed`

**Solution:**

1. **nginx:**
   ```nginx
   location /ws {
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

2. **Apache:**
   ```apache
   RewriteEngine On
   RewriteCond %{HTTP:Upgrade} =websocket [NC]
   RewriteRule /(.*) ws://127.0.0.1:5000/$1 [P,L]
   ```

3. **AWS ALB:**
   - Use Application Load Balancer (not Classic ELB)
   - WebSocket support is automatic

4. **GCP Cloud Load Balancer:**
   - Use HTTP(S) Load Balancer (not TCP)
   - WebSocket support is automatic

### Issue: Certificate Renewal Fails

**Common Issues:**

1. **Let's Encrypt rate limits:**
   - Limit: 50 certificates per registered domain per week
   - Use staging environment for testing

2. **Firewall blocking ACME challenge:**
   - Ensure port 80 is open for HTTP-01 challenge
   - Or use DNS-01 challenge for wildcard certificates

3. **Permission errors:**
   ```bash
   # Fix certbot permissions
   sudo chown -R root:root /etc/letsencrypt
   sudo chmod 0755 /etc/letsencrypt
   ```

---

## Compliance Mapping

### FedRAMP Moderate (NIST SP 800-53r5)

| Control ID | Control Name | Implementation | Evidence |
|-----------|--------------|----------------|----------|
| **SC-8** | Transmission Confidentiality and Integrity | TLS 1.2+ with NIST-approved ciphers | `/api/health/tls` endpoint, SSL Labs report |
| **SC-8(1)** | Cryptographic Protection | ECDHE-RSA-AES128-GCM-SHA256, TLS_AES_128_GCM_SHA256 | nginx/Apache config, ALB SSL policy |
| **SC-13** | Cryptographic Protection | FIPS 140-2 validated modules (cloud providers) | AWS ACM, GCP KMS, Azure Key Vault |
| **SC-23** | Session Authenticity | HTTPS-only cookies with Secure flag | securityHeaders.ts middleware |
| **IA-5(1)** | Password-Based Authentication | HTTPS prevents credential interception | Production HTTPS enforcement |

### IRS Pub 1075 (Federal Tax Information Protection)

| Requirement | Implementation | Verification |
|-------------|----------------|--------------|
| **9.3.1.2** | FTI transmitted over public networks must be encrypted | TLS 1.2+ with 128-bit AES minimum | `enforceHttpsProduction` middleware, `/api/health/tls` |
| **9.3.1.3** | Encryption must use NIST-approved algorithms | AES-GCM cipher suites | nginx/Apache cipher configuration |
| **9.3.1.4** | Certificates must be from approved CAs | DigiCert, IdenTrust, Federal PKI | Certificate chain validation |

### HIPAA Security Rule (45 CFR § 164.312)

| Standard | Implementation | Code Reference |
|----------|----------------|----------------|
| **§ 164.312(e)(1)** | Transmission Security | TLS 1.2+ encryption for all PHI in transit | `enforceHttpsProduction` middleware |
| **§ 164.312(e)(2)(i)** | Integrity Controls | TLS cipher suites with authenticated encryption (GCM) | nginx/Apache cipher suites |
| **§ 164.312(e)(2)(ii)** | Encryption | HTTPS enforced in production, blocks HTTP requests | 426 Upgrade Required response |

### NIST SP 800-52r2 (TLS Guidelines)

| Section | Requirement | JAWN Implementation |
|---------|------------|---------------------|
| **3.1** | TLS 1.2 minimum, TLS 1.3 recommended | All configurations enforce TLS 1.2+, prefer TLS 1.3 |
| **3.2** | Use authenticated encryption cipher suites | ECDHE-RSA-AES128-GCM-SHA256, TLS_AES_128_GCM_SHA256 |
| **3.3** | Disable weak ciphers (RC4, DES, 3DES) | Explicitly removed from all configurations |
| **4.1** | HSTS with max-age ≥ 1 year | `Strict-Transport-Security: max-age=31536000` |

---

## Production Deployment Checklist

Before deploying JAWN to production with TLS:

- [ ] **Certificate Obtained** from approved CA (Let's Encrypt, DigiCert, Federal PKI)
- [ ] **Certificate Chain Complete** including intermediate certificates
- [ ] **TLS 1.2+ Enforced** on reverse proxy (nginx, Apache, ALB, etc.)
- [ ] **Strong Cipher Suites** configured (ECDHE-RSA-AES128-GCM-SHA256 or stronger)
- [ ] **HTTP-to-HTTPS Redirect** configured with 301 Permanent
- [ ] **HSTS Header** enabled with 1-year max-age
- [ ] **X-Forwarded-Proto** header set by reverse proxy
- [ ] **WebSocket Support** configured for `/ws` endpoints
- [ ] **SSL Labs Grade** A or A+ achieved
- [ ] **SecurityHeaders.com Grade** A or A+ achieved
- [ ] **`/api/health/tls` Endpoint** returns `status: secure` and all compliance flags true
- [ ] **Certificate Renewal** automated with cron job or cloud provider
- [ ] **Monitoring** configured for certificate expiry (30-day alert)
- [ ] **Firewall Rules** allow HTTPS (443) and HTTP (80 for redirect)
- [ ] **DNS Records** point to load balancer or reverse proxy IP
- [ ] **Backup Certificates** stored securely in case of renewal failure

---

## Support & Contact

For technical assistance with JAWN TLS deployment:

- **Maryland DHS:** Contact Maryland IT security team
- **Pennsylvania Implementation:** Contact Philadelphia Revenue LITA team (BenePhilly coordinator)
- **Federal Compliance:** Consult FedRAMP PMO or state ISSO/ISSM
- **Certificate Issues:** Contact state PKI administrator or commercial CA support

---

**Document Change Log:**

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2025-10-23 | Initial release - AWS GovCloud, GCP, Azure, nginx, Apache configurations | JAWN Development Team |

---

**End of TLS Deployment Guide**

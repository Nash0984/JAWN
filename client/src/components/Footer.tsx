import { Link } from "wouter";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" data-testid="footer">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="font-semibold mb-4" data-testid="text-footer-about">About</h3>
            <p className="text-sm text-muted-foreground">
              Maryland Benefits Platform helps Maryland residents access government benefits and tax assistance through a secure, HIPAA-compliant platform.
            </p>
          </div>
          
          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4" data-testid="text-footer-legal">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-privacy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-terms">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/license" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-license">
                  License & Copyright
                </Link>
              </li>
              <li>
                <Link href="/legal/accessibility" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-accessibility">
                  Accessibility
                </Link>
              </li>
              <li>
                <Link href="/legal/security" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-security">
                  Security Policy
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-4" data-testid="text-footer-resources">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/demo" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-demo">
                  Demo Showcase
                </Link>
              </li>
              <li>
                <Link href="/api-explorer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-api-explorer">
                  API Explorer
                </Link>
              </li>
              <li>
                <Link href="/legal" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-legal-hub">
                  Legal Hub
                </Link>
              </li>
              <li>
                <Link href="/legal/disclaimer" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-disclaimer">
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link href="/legal/breach-notification" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-breach">
                  Breach Policy
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4" data-testid="text-footer-contact">Contact</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Email: support@marylandbenefits.org</li>
              <li>Phone: (410) 555-HELP</li>
              <li>Hours: Mon-Fri, 8 AM - 6 PM EST</li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="pt-6 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            <p data-testid="text-footer-copyright">
              © {currentYear} Maryland Benefits Navigator Contributors. All rights reserved.
            </p>
            <p className="mt-1" data-testid="text-footer-license">
              Licensed under{" "}
              <Link href="/legal/license" className="text-primary hover:underline">
                MIT License
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/legal/privacy" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-bottom-privacy">
              Privacy
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link href="/legal/terms" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-bottom-terms">
              Terms
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link href="/legal/accessibility" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-bottom-accessibility">
              Accessibility
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link href="/legal/security" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-bottom-security">
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

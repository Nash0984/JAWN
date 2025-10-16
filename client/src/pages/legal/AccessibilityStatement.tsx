import { Helmet } from "react-helmet-async";
import LegalLayout from "@/components/LegalLayout";

export default function AccessibilityStatement() {
  return (
    <>
      <Helmet>
        <title>Accessibility Statement - Maryland Benefits Platform</title>
        <meta 
          name="description" 
          content="Maryland Benefits Platform's commitment to WCAG 2.1 AA accessibility, inclusive design, and ensuring equal access for all users." 
        />
      </Helmet>
      
      <LegalLayout title="Accessibility Statement" lastReviewed="October 16, 2025">
        <section data-testid="section-accessibility-commitment">
          <h2>Our Commitment to Accessibility</h2>
          <p>
            Maryland Benefits Platform is committed to ensuring digital accessibility for people with disabilities. 
            We continuously work to improve the user experience for all users and apply relevant accessibility standards.
          </p>
        </section>

        <section data-testid="section-wcag-compliance">
          <h2>WCAG 2.1 AA Compliance</h2>
          <p>
            Our Platform conforms to the <strong>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</strong> 
            standards published by the World Wide Web Consortium (W3C). This ensures:
          </p>
          <ul>
            <li><strong>Perceivable:</strong> Information and user interface components are presentable to users in ways they can perceive</li>
            <li><strong>Operable:</strong> User interface components and navigation are operable by all users</li>
            <li><strong>Understandable:</strong> Information and operation of the user interface are understandable</li>
            <li><strong>Robust:</strong> Content is robust enough to be interpreted reliably by a wide variety of user agents, including assistive technologies</li>
          </ul>
        </section>

        <section data-testid="section-accessibility-features">
          <h2>Accessibility Features Implemented</h2>
          
          <h3>Keyboard Navigation</h3>
          <ul>
            <li>All interactive elements are keyboard accessible (Tab, Enter, Space, Arrow keys)</li>
            <li>Visible focus indicators on all focusable elements</li>
            <li>Logical tab order throughout the application</li>
            <li>Skip navigation links to bypass repetitive content</li>
            <li>Keyboard shortcuts for common actions (documented in Help section)</li>
          </ul>

          <h3>Screen Reader Support</h3>
          <ul>
            <li>Semantic HTML5 elements for proper content structure</li>
            <li>ARIA labels, roles, and landmarks for enhanced navigation</li>
            <li>Alt text for all informative images</li>
            <li>Descriptive link text (no "click here" links)</li>
            <li>Live regions for dynamic content updates</li>
            <li>Form labels and error messages announced to screen readers</li>
          </ul>

          <h3>Visual Accessibility</h3>
          <ul>
            <li>Color contrast ratios meet WCAG AA standards (minimum 4.5:1 for normal text, 3:1 for large text)</li>
            <li>Information is not conveyed by color alone</li>
            <li>Text can be resized up to 200% without loss of functionality</li>
            <li>Responsive design supports various screen sizes and zoom levels</li>
            <li>Clear typography with sufficient line spacing</li>
            <li>Dark mode option for reduced eye strain</li>
          </ul>

          <h3>Forms and Input</h3>
          <ul>
            <li>Clear labels for all form fields</li>
            <li>Inline validation with descriptive error messages</li>
            <li>Required fields clearly marked</li>
            <li>Time limits can be extended or disabled</li>
            <li>Auto-save functionality to prevent data loss</li>
            <li>Multiple input methods supported (voice, touch, mouse, keyboard)</li>
          </ul>

          <h3>Content Structure</h3>
          <ul>
            <li>Proper heading hierarchy (H1-H6) for content organization</li>
            <li>Breadcrumb navigation on all pages</li>
            <li>Consistent navigation patterns throughout the Platform</li>
            <li>Plain language content (Flesch-Kincaid Grade Level 6-8)</li>
            <li>Tables with proper headers and captions</li>
            <li>Lists properly marked up for structure</li>
          </ul>

          <h3>Multimedia Accessibility</h3>
          <ul>
            <li>Captions for all video content</li>
            <li>Transcripts for audio content</li>
            <li>Audio descriptions for important visual information in videos</li>
            <li>Controls for media playback (play, pause, volume)</li>
          </ul>
        </section>

        <section data-testid="section-assistive-technologies">
          <h2>Compatible Assistive Technologies</h2>
          <p>Our Platform is designed to work with:</p>
          <ul>
            <li><strong>Screen Readers:</strong> JAWS, NVDA, VoiceOver, TalkBack</li>
            <li><strong>Screen Magnifiers:</strong> ZoomText, MAGic</li>
            <li><strong>Voice Recognition:</strong> Dragon NaturallySpeaking, Voice Control</li>
            <li><strong>Alternative Input Devices:</strong> Switch controls, eye-tracking devices</li>
            <li><strong>Browser Extensions:</strong> Read&Write, ClaroRead</li>
          </ul>
        </section>

        <section data-testid="section-known-limitations">
          <h2>Known Limitations and Workarounds</h2>
          
          <h3>PDF Documents</h3>
          <p>
            <strong>Limitation:</strong> Some uploaded PDF documents may not be fully accessible.
          </p>
          <p>
            <strong>Workaround:</strong> Request alternative formats (plain text, HTML) by contacting accessibility@marylandbenefits.org
          </p>

          <h3>Third-Party Integrations</h3>
          <p>
            <strong>Limitation:</strong> External services (e.g., IRS e-file system) may have varying accessibility levels.
          </p>
          <p>
            <strong>Workaround:</strong> Our staff can assist with completing these processes via phone or in-person support.
          </p>

          <h3>Complex Data Visualizations</h3>
          <p>
            <strong>Limitation:</strong> Some charts and graphs may be challenging for screen reader users.
          </p>
          <p>
            <strong>Workaround:</strong> We provide data tables as alternatives to all visualizations. Use the "View as Table" option.
          </p>
        </section>

        <section data-testid="section-accommodation-requests">
          <h2>Requesting Accommodations</h2>
          <p>
            We strive to provide equal access to all users. If you encounter accessibility barriers or need specific accommodations, 
            we will work with you to provide alternative access methods.
          </p>
          
          <h3>How to Request an Accommodation:</h3>
          <ol>
            <li>Contact our Accessibility Team (contact information below)</li>
            <li>Describe the barrier you encountered or the accommodation you need</li>
            <li>Provide your preferred contact method and timeline</li>
            <li>We will respond within 2 business days with a proposed solution</li>
          </ol>

          <h3>Available Accommodations:</h3>
          <ul>
            <li>Phone assistance for completing forms and applications</li>
            <li>Alternative document formats (large print, Braille, audio)</li>
            <li>In-person assistance at partner organizations</li>
            <li>Extended time limits for completing tasks</li>
            <li>Simplified interface for users with cognitive disabilities</li>
            <li>Sign language interpretation for video consultations (with 48-hour notice)</li>
          </ul>
        </section>

        <section data-testid="section-testing-validation">
          <h2>Accessibility Testing and Validation</h2>
          <p>Our Platform undergoes regular accessibility testing:</p>
          <ul>
            <li><strong>Automated Testing:</strong> Axe DevTools, WAVE, Lighthouse audits on every deployment</li>
            <li><strong>Manual Testing:</strong> Keyboard navigation, screen reader testing (NVDA, VoiceOver)</li>
            <li><strong>User Testing:</strong> Feedback from users with disabilities incorporated into design</li>
            <li><strong>Third-Party Audits:</strong> Annual WCAG 2.1 AA compliance audit by certified accessibility consultants</li>
          </ul>
        </section>

        <section data-testid="section-ongoing-improvement">
          <h2>Ongoing Improvement Commitment</h2>
          <p>
            Accessibility is an ongoing effort. We continuously monitor, test, and improve our Platform to ensure 
            the best possible experience for all users. Our roadmap includes:
          </p>
          <ul>
            <li>Monthly accessibility reviews of new features</li>
            <li>Quarterly user feedback sessions with disability advocates</li>
            <li>Annual comprehensive accessibility audit</li>
            <li>Staff training on accessible design and development practices</li>
            <li>Integration of emerging assistive technologies</li>
          </ul>
        </section>

        <section data-testid="section-feedback">
          <h2>Your Feedback Matters</h2>
          <p>
            We welcome your feedback on the accessibility of the Maryland Benefits Platform. Please let us know 
            if you encounter barriers or have suggestions for improvement.
          </p>
        </section>

        <section data-testid="section-contact-accessibility">
          <h2>Contact Information - Accessibility Team</h2>
          <p>For accessibility questions, accommodation requests, or to report accessibility issues:</p>
          <div className="bg-muted p-4 rounded-lg" data-testid="contact-accessibility">
            <p className="font-semibold">Accessibility Coordinator</p>
            <p>Maryland Benefits Platform</p>
            <p>Email: accessibility@marylandbenefits.org</p>
            <p>Phone: (410) 555-ACCESS (222-377)</p>
            <p>TTY: (410) 555-8833</p>
            <p>Videophone (ASL): accessibility-vp@marylandbenefits.org</p>
            <p>Mail: Accessibility Office, 123 Benefits Way, Baltimore, MD 21201</p>
            <p className="mt-2 text-sm text-muted-foreground">Response time: 2 business days</p>
          </div>
        </section>

        <section data-testid="section-legal-standards">
          <h2>Legal Standards and Compliance</h2>
          <p>
            In addition to WCAG 2.1 AA, our Platform complies with:
          </p>
          <ul>
            <li><strong>Section 508 of the Rehabilitation Act</strong> (U.S. federal accessibility requirements)</li>
            <li><strong>Americans with Disabilities Act (ADA) Title II and III</strong></li>
            <li><strong>Maryland Accessibility Code</strong></li>
            <li><strong>EN 301 549</strong> (European accessibility standard for reference)</li>
          </ul>
        </section>

        <section data-testid="section-accessibility-version">
          <h2>Document Information</h2>
          <p className="font-semibold">
            Current Version: 1.0 | Last Updated: October 16, 2025
          </p>
          <p>
            This statement was last reviewed on October 16, 2025. We update this statement when accessibility 
            improvements are made or when standards change.
          </p>
        </section>
      </LegalLayout>
    </>
  );
}

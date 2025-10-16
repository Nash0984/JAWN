import { Helmet } from "react-helmet-async";
import LegalLayout from "@/components/LegalLayout";
import { Scale, CheckCircle, Users, Code } from "lucide-react";

export default function License() {
  return (
    <>
      <Helmet>
        <title>License & Copyright - Maryland Benefits Platform</title>
        <meta 
          name="description" 
          content="Maryland Benefits Platform is open source software licensed under the MIT License. Learn about your rights to use, modify, and distribute this software." 
        />
      </Helmet>
      
      <LegalLayout title="License & Copyright" lastReviewed="October 16, 2025">
        <section data-testid="section-license-overview">
          <h2>Open Source License</h2>
          <p>
            Maryland Benefits Platform is open source software released under the <strong>MIT License</strong>. 
            This means the code is freely available for anyone to use, modify, and distribute, subject to the 
            terms and conditions outlined below.
          </p>
        </section>

        <section data-testid="section-what-mit-allows">
          <h2>What the MIT License Allows</h2>
          <p>
            Under the MIT License, you have the following rights:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
            <div className="flex gap-3 p-4 border rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold mb-1">Use</h3>
                <p className="text-sm text-muted-foreground">
                  Use the software for any purpose, including commercial applications
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 p-4 border rounded-lg">
              <Code className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold mb-1">Modify</h3>
                <p className="text-sm text-muted-foreground">
                  Change and customize the code to fit your needs
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 p-4 border rounded-lg">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold mb-1">Distribute</h3>
                <p className="text-sm text-muted-foreground">
                  Share the original or modified software with others
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 p-4 border rounded-lg">
              <Scale className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold mb-1">Sublicense</h3>
                <p className="text-sm text-muted-foreground">
                  Grant these same rights to others who receive the software from you
                </p>
              </div>
            </div>
          </div>

          <p>
            <strong>The only requirement</strong> is that you include the original copyright notice and 
            license text in any copies or substantial portions of the software.
          </p>
        </section>

        <section data-testid="section-copyright">
          <h2>Copyright & Intellectual Property</h2>
          <p>
            <strong>Copyright © 2025 Maryland Benefits Navigator Contributors</strong>
          </p>
          <p>
            While the code is open source, the copyright remains with the original authors and contributors. 
            This establishes clear intellectual property ownership while allowing the community to benefit 
            from and improve upon the work.
          </p>
        </section>

        <section data-testid="section-mit-license-text">
          <h2>Full MIT License Text</h2>
          <div className="bg-muted p-6 rounded-lg font-mono text-sm whitespace-pre-wrap" data-testid="text-license-full">
{`MIT License

Copyright (c) 2025 Maryland Benefits Navigator Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
          </div>
        </section>

        <section data-testid="section-contributors">
          <h2>Credits & Attribution</h2>
          <p>
            This platform was built by and for the civic tech community to help Maryland residents access 
            government benefits and tax assistance. We extend our gratitude to all contributors who have 
            helped make this project possible.
          </p>
          <p>
            The platform incorporates several open source technologies and libraries, each with their own 
            licenses. See the project's <code>package.json</code> for a complete list of dependencies.
          </p>
        </section>

        <section data-testid="section-contributing">
          <h2>Contributing to This Project</h2>
          <p>
            We welcome contributions from the community! By contributing to this project, you agree that 
            your contributions will be licensed under the same MIT License.
          </p>
          <p>
            For detailed information on how to contribute, please see our{" "}
            <a 
              href="https://github.com/yourusername/maryland-benefits-platform/blob/main/CONTRIBUTING.md"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-contributing"
            >
              Contributing Guidelines
            </a>.
          </p>
        </section>

        <section data-testid="section-disclaimer">
          <h2>Disclaimer</h2>
          <p>
            THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. This means there is no 
            guarantee that the software will work perfectly for your use case. Use at your own risk.
          </p>
          <p>
            For production deployments handling sensitive data, ensure you implement appropriate security 
            measures and comply with all applicable regulations including HIPAA, GDPR, and state privacy laws.
          </p>
        </section>

        <section data-testid="section-questions">
          <h2>Questions About Licensing?</h2>
          <p>
            If you have questions about the license or how it applies to your use case, please contact us at:
          </p>
          <ul>
            <li>Email: <a href="mailto:legal@marylandbenefits.org" className="text-primary hover:underline">legal@marylandbenefits.org</a></li>
            <li>GitHub: <a href="https://github.com/yourusername/maryland-benefits-platform/issues" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Open an issue</a></li>
          </ul>
        </section>
      </LegalLayout>
    </>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/contexts/TenantContext";
import { 
  FileText, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Users,
  BookOpen,
  HelpCircle,
  Phone,
  Video,
  Shield,
  Laptop,
  Calendar,
  MapPin,
  ArrowRight,
  FileSpreadsheet,
  HeadphonesIcon,
  Zap
} from "lucide-react";

export default function FsaLanding() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const stateCode = stateConfig?.stateCode || 'MD';
  const taxSlayerUrl = `https://www.taxslayerpro.com/fsa?sidn=${stateCode.toUpperCase()}-VITA-2025`;
  
  // TODO: Pull income thresholds from tenant config when fully implemented
  // Currently using IRS VITA standard threshold of $67,000
  const incomeThreshold = '$67,000';

  return (
    <>

      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-12 max-w-6xl">
          
          {/* Hero Section */}
          <div className="text-center mb-12">
            <Badge className="mb-4" variant="outline" data-testid="badge-free-service">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              100% Free Service
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4" data-testid="heading-hero">
              Prepare Your Own Taxes with TaxSlayer
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-6 max-w-3xl mx-auto">
              Free self-assisted tax preparation for {stateName} taxpayers earning {incomeThreshold} or less. Expert navigator support available when you need it.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                className="text-lg px-8"
                asChild
                data-testid="button-start-taxes"
              >
                <a href={taxSlayerUrl} target="_blank" rel="noopener noreferrer">
                  Start Your Taxes Now
                  <ExternalLink className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8"
                asChild
                data-testid="button-find-vita-site"
              >
                <a href="#navigator-support">
                  Get Help from a Navigator
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
            </div>
          </div>

          {/* Taxpayer Overview Section */}
          <Card className="mb-8" data-testid="card-overview">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-6 h-6" />
                What is Free Self-Assisted Tax Preparation?
              </CardTitle>
              <CardDescription>
                Take control of your tax filing with free tools and expert backup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4" data-testid="benefit-convenience">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Go at Your Own Pace</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    File your taxes anytime, anywhere, on your schedule
                  </p>
                </div>
                <div className="text-center p-4" data-testid="benefit-learning">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Learn About Your Taxes</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Understand your tax situation while you prepare
                  </p>
                </div>
                <div className="text-center p-4" data-testid="benefit-support">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <HeadphonesIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Expert Help Available</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Get navigator support if you get stuck
                  </p>
                </div>
              </div>

              <Separator />

              {/* Comparison Table */}
              <div>
                <h3 className="text-lg font-semibold mb-4">FSA vs In-Person VITA: Which is Right for You?</h3>
                <div className="overflow-x-auto">
                  <Table data-testid="table-comparison">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Feature</TableHead>
                        <TableHead className="w-1/3">Free Self-Assisted (FSA)</TableHead>
                        <TableHead className="w-1/3">In-Person VITA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Who prepares</TableCell>
                        <TableCell>
                          <Badge variant="outline">You prepare yourself</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Volunteer prepares for you</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">When you can file</TableCell>
                        <TableCell>Anytime, 24/7</TableCell>
                        <TableCell>During site hours (by appointment)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Where</TableCell>
                        <TableCell>From home or FSA site</TableCell>
                        <TableCell>At VITA site only</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Best for</TableCell>
                        <TableCell>Simple returns, comfortable with computers</TableCell>
                        <TableCell>Complex situations, prefer in-person help</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Support available</TableCell>
                        <TableCell>Remote navigator support (phone/video)</TableCell>
                        <TableCell>In-person assistance throughout</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Cost</TableCell>
                        <TableCell className="text-green-600 font-semibold">100% Free</TableCell>
                        <TableCell className="text-green-600 font-semibold">100% Free</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Alert data-testid="alert-eligibility">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Eligibility:</strong> FSA is available to {stateName} taxpayers with income of {incomeThreshold} or less. If you have complex tax situations (rental property, business income, investments), we recommend in-person VITA assistance.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Navigator Support Section */}
          <Card className="mb-8" id="navigator-support" data-testid="card-navigator-support">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-6 h-6" />
                Navigator Support - We're Here to Help
              </CardTitle>
              <CardDescription>
                You're not alone! Our trained navigators provide free support throughout your tax preparation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div data-testid="support-workflow">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                    How the Hybrid Workflow Works
                  </h3>
                  <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex gap-2">
                      <span className="font-semibold text-blue-600">1.</span>
                      <span>You prepare your tax return using TaxSlayer FSA</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-blue-600">2.</span>
                      <span>Navigator reviews your return for accuracy (optional)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-blue-600">3.</span>
                      <span>You file electronically and receive your refund</span>
                    </li>
                  </ol>
                </div>

                <div data-testid="support-contact">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-green-600" />
                    How to Get Help
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 mt-1 text-gray-400" />
                      <div>
                        <p className="font-medium">Phone Support</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Call 1-800-MD-TAXES (1-800-638-2937)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Video className="w-4 h-4 mt-1 text-gray-400" />
                      <div>
                        <p className="font-medium">Video Support</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Screen sharing available by appointment</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 mt-1 text-gray-400" />
                      <div>
                        <p className="font-medium">Hours of Operation</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Monday - Friday: 9 AM - 5 PM EST</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Saturday: 10 AM - 2 PM EST</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div data-testid="support-services">
                <h3 className="font-semibold mb-3">What Navigators Can Help With:</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <span className="text-sm">Technical issues with TaxSlayer</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <span className="text-sm">Questions about tax forms and documents</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <span className="text-sm">Understanding deductions and credits</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <span className="text-sm">Reviewing your completed return</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <span className="text-sm">E-filing assistance</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <span className="text-sm">Refund tracking information</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Eligibility & Cautions Section */}
          <Card className="mb-8" data-testid="card-eligibility">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-6 h-6" />
                Eligibility & Important Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div data-testid="eligibility-requirements">
                  <h3 className="font-semibold mb-3 text-green-700 dark:text-green-400">✓ Good Fit for FSA:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Income $67,000 or less</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>W-2 income only (wages/salaries)</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Standard deduction (not itemizing)</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Comfortable using a computer</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Single or married filing jointly</span>
                    </li>
                  </ul>
                </div>

                <div data-testid="eligibility-complex">
                  <h3 className="font-semibold mb-3 text-amber-700 dark:text-amber-400">⚠ May Need In-Person VITA:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span>Self-employment or business income</span>
                    </li>
                    <li className="flex gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span>Rental property income</span>
                    </li>
                    <li className="flex gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span>Stock sales or investment income</span>
                    </li>
                    <li className="flex gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span>Itemized deductions (mortgage, charity)</span>
                    </li>
                    <li className="flex gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <span>Multiple states or foreign income</span>
                    </li>
                  </ul>
                </div>
              </div>

              <Alert variant="default" data-testid="alert-vita-sites">
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  <strong>Need in-person help?</strong> Find your nearest VITA site at{" "}
                  <a 
                    href="https://irs.treasury.gov/freetaxprep/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline font-medium"
                    data-testid="link-find-vita"
                  >
                    IRS Free Tax Prep Locator
                  </a>
                </AlertDescription>
              </Alert>

              <Alert variant="default" className="border-blue-200 bg-blue-50 dark:bg-blue-950" data-testid="alert-disclaimer">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Important:</strong> When using FSA, you are responsible for the accuracy of your tax return. While navigators can provide guidance and review your return, the final filing is your responsibility. We recommend having a navigator review your return before filing.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          <Card className="mb-8" data-testid="card-faq">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-6 h-6" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="faq-1" data-testid="faq-difference">
                  <AccordionTrigger>What's the difference between FSA and regular VITA?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      With traditional VITA, you bring your documents to a site and a volunteer prepares your taxes for you. With FSA (Free Self-Assisted), you prepare your own taxes using TaxSlayer software, but you can get help from navigators if needed. Both services are 100% free and available to taxpayers earning $67,000 or less.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-2" data-testid="faq-requirements">
                  <AccordionTrigger>What do I need to get started?</AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                      <p><strong>Technical Requirements:</strong></p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Computer, tablet, or smartphone with internet access</li>
                        <li>Updated web browser (Chrome, Firefox, Safari, or Edge)</li>
                        <li>Email address for account creation</li>
                      </ul>
                      <p className="mt-3"><strong>Tax Documents Needed:</strong></p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>W-2 forms from all employers</li>
                        <li>1099 forms (if applicable)</li>
                        <li>Social Security numbers for you, spouse, and dependents</li>
                        <li>Bank account information for direct deposit (optional)</li>
                        <li>Prior year tax return (helpful but not required)</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-3" data-testid="faq-help">
                  <AccordionTrigger>What if I get stuck while preparing my taxes?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Don't worry! Our navigators are available to help. You can call our support line at 1-800-MD-TAXES (1-800-638-2937) during business hours. We offer phone support and can also schedule video sessions with screen sharing to walk you through any issues. If your situation is too complex for FSA, we can help you schedule an in-person VITA appointment instead.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-4" data-testid="faq-security">
                  <AccordionTrigger>Is my information secure?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Yes! TaxSlayer uses bank-level encryption to protect your data. All information is transmitted securely and stored with the same security standards used by major financial institutions. The {stateName} VITA program follows strict IRS security protocols. Your personal information is never shared without your consent, and all navigators are IRS-certified and background-checked volunteers.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-5" data-testid="faq-cost">
                  <AccordionTrigger>Is FSA really free? Are there any hidden fees?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      FSA is completely free - no hidden fees, no charges for state returns, no fees for direct deposit or e-filing. This is part of the IRS VITA (Volunteer Income Tax Assistance) program, funded to help low-to-moderate income taxpayers. You pay nothing at all for the software, preparation, filing, or navigator support.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-6" data-testid="faq-review">
                  <AccordionTrigger>Should I have a navigator review my return before filing?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      We strongly recommend it! While you're responsible for your tax return, having a trained navigator review it can catch errors and ensure you're getting all the credits and deductions you're entitled to. This service is free and can be done remotely. Many taxpayers feel more confident filing after a navigator review, and it can help avoid costly mistakes or missed opportunities.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-7" data-testid="faq-deadline">
                  <AccordionTrigger>Can I use FSA all year, or is there a deadline?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      FSA is available during the entire tax filing season, typically from late January through the tax deadline in mid-April. Navigator support is available during posted business hours throughout the season. If you need to file a prior year return or an extension, contact a navigator to discuss your options.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Training Materials Download Section */}
          <Card className="mb-8" data-testid="card-training-materials">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Training Materials & Implementation Guides
              </CardTitle>
              <CardDescription>
                Resources for VITA sites implementing FSA programs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <a 
                  href="/fsa-resources/fsa-site-setup-checklist-v1.0.txt" 
                  download
                  className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  data-testid="download-site-setup"
                >
                  <Download className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Site Setup Checklist</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">v1.0 • Equipment, network setup, SIDN tracking</p>
                  </div>
                </a>

                <a 
                  href="/fsa-resources/fsa-best-practices-v1.0.txt" 
                  download
                  className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  data-testid="download-best-practices"
                >
                  <Download className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">FSA Best Practices Guide</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">v1.0 • Remote support, quality review procedures</p>
                  </div>
                </a>

                <a 
                  href="/fsa-resources/fsa-navigator-training-v1.0.txt" 
                  download
                  className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  data-testid="download-navigator-training"
                >
                  <Download className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Navigator Training Packet</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">v1.0 • FSA workflow, review procedures, scripts</p>
                  </div>
                </a>

                <a 
                  href="/fsa-resources/fsa-remote-support-playbook-v1.0.txt" 
                  download
                  className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  data-testid="download-remote-playbook"
                >
                  <Download className="w-5 h-5 text-amber-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Remote Support Playbook</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">v1.0 • Phone/video support, troubleshooting</p>
                  </div>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Final CTA */}
          <div className="text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Ready to Start Your Taxes?</h2>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Join thousands of {stateName} taxpayers who have successfully filed their taxes for free with FSA. Get started now or reach out to a navigator for guidance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg px-8"
                asChild
                data-testid="button-cta-start"
              >
                <a href={taxSlayerUrl} target="_blank" rel="noopener noreferrer">
                  Launch TaxSlayer FSA
                  <ExternalLink className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8"
                asChild
                data-testid="button-cta-contact"
              >
                <a href="tel:1-800-638-2937">
                  <Phone className="mr-2 w-5 h-5" />
                  Call 1-800-MD-TAXES
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

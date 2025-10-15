# Maryland Digital Style Guide Implementation

## Overview

This document defines the design system for the Maryland Multi-Program Benefits Navigator System, implementing the **Maryland Department of Human Services (DHS) Digital Style Guide**. All components, colors, typography, and patterns adhere to state branding requirements and WCAG 2.1 AA accessibility standards.

**Design Philosophy:** Government clarity, accessibility-first, mobile-responsive, Maryland brand integrity.

---

## Table of Contents

1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Component Library](#component-library)
4. [Accessibility Standards](#accessibility-standards)
5. [Responsive Design](#responsive-design)
6. [Iconography](#iconography)
7. [Spacing & Layout](#spacing--layout)
8. [Forms & Inputs](#forms--inputs)
9. [Navigation Patterns](#navigation-patterns)
10. [Data Visualization](#data-visualization)
11. [Animation & Motion](#animation--motion)
12. [Dark Mode](#dark-mode)

---

## Color Palette

### Primary Maryland DHS Colors

**Maryland DHS Blue** (Primary)
```css
--maryland-dhs-blue: hsl(207, 91%, 29%); /* #0D4F8B */
```
- **Use:** Primary actions, navigation headers, focus states
- **Contrast Ratio:** 7.5:1 on white (WCAG AAA)
- **CSS Variable:** `--primary`
- **Tailwind:** `.bg-primary`, `.text-primary`, `.border-primary`

**Maryland DHS Red** (Accent)
```css
--maryland-dhs-red: hsl(354, 70%, 46%); /* #C5203A */
```
- **Use:** Alerts, destructive actions, error states, important notices
- **Contrast Ratio:** 5.8:1 on white (WCAG AA)
- **CSS Variable:** `--accent` or `--destructive`
- **Tailwind:** `.bg-accent`, `.text-accent`, `.bg-destructive`

**Maryland DHS Gold** (Secondary)
```css
--maryland-dhs-gold: hsl(43, 100%, 55%); /* #FFB81C */
```
- **Use:** Secondary actions, highlights, status badges (pending/warning)
- **Contrast Ratio:** 8.2:1 on black text (WCAG AAA)
- **CSS Variable:** `--secondary` or `--accent-warm`
- **Tailwind:** `.bg-secondary`, `.text-secondary`

**Maryland Black** (Text)
```css
--maryland-black: hsl(210, 17%, 11%); /* #231f20 */
```
- **Use:** Primary text, headings
- **Contrast Ratio:** 16.5:1 on white (WCAG AAA)
- **CSS Variable:** `--foreground`
- **Tailwind:** `.text-foreground`

**Maryland White** (Background)
```css
--maryland-white: hsl(0, 0%, 100%); /* #ffffff */
```
- **Use:** Page background, card surfaces
- **CSS Variable:** `--background`, `--card`
- **Tailwind:** `.bg-background`, `.bg-card`

### Semantic Colors

**Success Green**
```css
--success: hsl(122, 39%, 49%); /* #4CAF50 */
```
- **Use:** Success messages, approved documents, positive outcomes
- **Usage:** `.bg-success`, `.text-success`

**Warning Yellow**
```css
--warning: hsl(45, 100%, 51%); /* #FFC107 */
```
- **Use:** Warning messages, pending status
- **Usage:** `.bg-warning`, `.text-warning`

**Destructive/Error Red**
```css
--destructive: hsl(354, 70%, 46%); /* #C5203A - DHS Red */
```
- **Use:** Error messages, destructive actions, failed states
- **Usage:** `.bg-destructive`, `.text-destructive`

### Neutral Palette

```css
--muted: hsl(210, 20%, 95%);           /* Light gray backgrounds */
--muted-foreground: hsl(210, 8%, 46%); /* Secondary text */
--border: hsl(210, 13%, 91%);          /* Borders and dividers */
--input: hsl(210, 13%, 91%);           /* Input backgrounds */
```

### Chart Colors

For data visualization (benefit comparisons, analytics):
```css
--chart-1: hsl(12, 76%, 61%);   /* Warm Red */
--chart-2: hsl(173, 58%, 39%);  /* Teal */
--chart-3: hsl(197, 37%, 24%);  /* Dark Blue */
--chart-4: hsl(43, 74%, 66%);   /* Gold */
--chart-5: hsl(27, 87%, 67%);   /* Orange */
```

### Color Usage Guidelines

**Do:**
- ✅ Use Maryland DHS Blue for primary CTAs and navigation
- ✅ Use Maryland DHS Red for alerts and destructive actions
- ✅ Use Maryland DHS Gold for secondary actions and highlights
- ✅ Ensure 4.5:1 contrast ratio minimum for text (WCAG AA)
- ✅ Use semantic colors consistently (green=success, red=error)

**Don't:**
- ❌ Mix Maryland DHS Red with Success Green in the same context
- ❌ Use Gold as primary text color (poor contrast)
- ❌ Override Maryland brand colors with generic blues/reds
- ❌ Use color alone to convey information (add icons/text)

### Color Contrast Examples

| Foreground | Background | Ratio | Grade |
|------------|-----------|-------|-------|
| Maryland Black (#231f20) | White (#ffffff) | 16.5:1 | AAA ✓ |
| Maryland Blue (#0D4F8B) | White (#ffffff) | 7.5:1 | AAA ✓ |
| Maryland Red (#C5203A) | White (#ffffff) | 5.8:1 | AA ✓ |
| White (#ffffff) | Maryland Blue (#0D4F8B) | 7.5:1 | AAA ✓ |
| White (#ffffff) | Maryland Red (#C5203A) | 5.8:1 | AA ✓ |

---

## Typography

### Font Families

**Primary Font: Montserrat**
```css
--font-sans: 'Montserrat', system-ui, sans-serif;
```
- **Source:** Google Fonts
- **Weights Used:** 400 (Regular), 600 (Semi-Bold), 700 (Bold)
- **Fallback:** system-ui, -apple-system, sans-serif
- **Import:** `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');`

**Secondary Fonts:**
```css
--font-serif: Georgia, serif;
--font-mono: Menlo, monospace;
```

### Type Scale

**Headings:**
```css
h1 { font-size: 2rem; font-weight: 600; line-height: 1.3; }      /* 32px */
h2 { font-size: 1.75rem; font-weight: 600; line-height: 1.3; }   /* 28px */
h3 { font-size: 1.5rem; font-weight: 600; line-height: 1.3; }    /* 24px */
h4 { font-size: 1.25rem; font-weight: 600; line-height: 1.3; }   /* 20px */
h5 { font-size: 1.125rem; font-weight: 600; line-height: 1.3; }  /* 18px */
h6 { font-size: 1rem; font-weight: 600; line-height: 1.3; }      /* 16px */
```

**Body Text:**
```css
body {
  font-family: 'Montserrat', system-ui, sans-serif;
  font-size: 1rem;        /* 16px base */
  font-weight: 400;
  line-height: 1.6;       /* 26px */
}
```

**Utility Classes:**
- `.text-xs` - 0.75rem (12px)
- `.text-sm` - 0.875rem (14px)
- `.text-base` - 1rem (16px)
- `.text-lg` - 1.125rem (18px)
- `.text-xl` - 1.25rem (20px)
- `.text-2xl` - 1.5rem (24px)
- `.text-3xl` - 1.875rem (30px)
- `.text-4xl` - 2.25rem (36px)

### Mobile Typography (≤768px)

```css
@media (max-width: 768px) {
  body { font-size: 16px; }  /* Prevent zoom on iOS */
  h1 { font-size: 1.5rem; line-height: 1.2; }   /* 24px */
  h2 { font-size: 1.25rem; line-height: 1.3; }  /* 20px */
  p, .text-sm { line-height: 1.7; }
}
```

### Typography Guidelines

**Do:**
- ✅ Use Montserrat Semi-Bold (600) for all headings
- ✅ Use Montserrat Regular (400) for body text
- ✅ Maintain 1.6 line-height for body text readability
- ✅ Use relative units (rem) for scalability
- ✅ Set 16px minimum font size on mobile (prevents zoom)

**Don't:**
- ❌ Use more than 3 font weights
- ❌ Mix serif and sans-serif in UI elements
- ❌ Use font size < 14px for body text
- ❌ Use all-caps for long text blocks
- ❌ Override Montserrat with generic fonts

---

## Component Library

### shadcn/ui Components

Built on **Radix UI** primitives with **Tailwind CSS** styling.

#### Core Components

**Button**
```tsx
import { Button } from "@/components/ui/button";

<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Link</Button>
```

**Variants:**
- `default` - Maryland DHS Blue background
- `secondary` - Maryland DHS Gold background
- `destructive` - Maryland DHS Red background
- `outline` - Transparent with border
- `ghost` - Transparent, hover effect
- `link` - Text-only, no background

**Card**
```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>SNAP Benefits</CardTitle>
  </CardHeader>
  <CardContent>
    Eligibility information...
  </CardContent>
</Card>
```

**Dialog/Modal**
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
    </DialogHeader>
    <DialogDescription>Are you sure?</DialogDescription>
  </DialogContent>
</Dialog>
```

**Alert**
```tsx
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

<Alert variant="default">
  <AlertTitle>Information</AlertTitle>
  <AlertDescription>Policy update available</AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Failed to load data</AlertDescription>
</Alert>
```

**Badge**
```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="default">Pending</Badge>
<Badge variant="secondary">Approved</Badge>
<Badge variant="destructive">Rejected</Badge>
<Badge variant="outline">Draft</Badge>
```

**Status Badge Colors:**
- `Significant` → Red badge (`.bg-destructive`)
- `Accepted` → Green badge (`.bg-success`)
- `Pending` → Yellow badge (`.bg-warning`)
- `Rejected` → Red badge (`.bg-destructive`)

#### Form Components

**Input**
```tsx
import { Input } from "@/components/ui/input";

<Input type="text" placeholder="Enter case number" />
<Input type="email" placeholder="Email address" />
```

**Select**
```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select program" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="snap">SNAP</SelectItem>
    <SelectItem value="medicaid">Medicaid</SelectItem>
    <SelectItem value="tanf">TANF</SelectItem>
  </SelectContent>
</Select>
```

**Checkbox**
```tsx
import { Checkbox } from "@/components/ui/checkbox";

<Checkbox id="consent" />
<label htmlFor="consent">I agree to terms</label>
```

**Radio Group**
```tsx
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

<RadioGroup defaultValue="yes">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="yes" id="yes" />
    <label htmlFor="yes">Yes</label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="no" id="no" />
    <label htmlFor="no">No</label>
  </div>
</RadioGroup>
```

**Form (react-hook-form integration)**
```tsx
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

const form = useForm();

<Form {...form}>
  <FormField
    control={form.control}
    name="clientName"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Client Name</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</Form>
```

#### Real-Time Widgets

**Financial Opportunity Radar**
```tsx
import { FinancialOpportunityRadar } from "@/components/FinancialOpportunityRadar";
import { useEligibilityRadar } from "@/hooks/useEligibilityRadar";

// In parent component (e.g., HouseholdProfiler)
const householdData = useWatch({ control: form.control });
const { programs, alerts, summary, isCalculating, error } = useEligibilityRadar(householdData);

<FinancialOpportunityRadar
  programs={programs}
  alerts={alerts}
  summary={summary}
  isCalculating={isCalculating}
  error={error}
/>
```

**Component Features:**
- **Real-Time Eligibility**: Displays instant updates across 6 Maryland programs (SNAP, Medicaid, TANF, EITC, CTC, SSI)
- **Change Indicators**: Green "New" badges for first-time eligibility, ↑↓ arrows for benefit increases/decreases
- **Summary Dashboard**: Total monthly/annual benefits, program count, effective benefit rate
- **Smart Alerts**: AI-powered cross-enrollment recommendations
- **Animations**: Framer Motion transitions for change highlights
- **Loading States**: Skeleton placeholders during calculations
- **Error Handling**: User-friendly error messages with retry capability

**Visual Elements:**
```tsx
// Status Icons
✅ Eligible (text-green-600)
⚠️ Needs Info (text-yellow-600)
❌ Ineligible (text-red-600)

// Change Badges
<Badge className="bg-green-500">New</Badge>
<Badge className="bg-blue-500">Changed</Badge>

// Change Arrows
↑ +$450 (+18.5%)  // Increase (text-green-600)
↓ -$120 (-8.2%)   // Decrease (text-red-600)
```

**Layout Pattern:**
- **Desktop**: Persistent sidebar in 3-column grid
- **Tablet**: Stacked 2-column layout
- **Mobile**: Collapsible drawer with summary visible

**Color Scheme:**
- Eligible programs: Green accent (`hsl(122, 39%, 49%)`)
- New eligibility badges: Success green background
- Benefit increases: Green arrows and text
- Benefit decreases: Red arrows and text
- Alert cards: Gradient from blue to purple
- Summary panel: Maryland DHS Blue header

**Technical Integration:**
```tsx
// Hook watches form fields with 300ms debounce
const householdData = useWatch({
  control: form.control,
  name: ['adults', 'children', 'annualIncome', 'monthlyRent', ...]
});

// Automatic calculations on field changes
useEffect(() => {
  if (householdData) {
    calculate(householdData);
  }
}, [adults, children, income, ...16 fields]);
```

**Accessibility:**
- ARIA live regions for dynamic updates
- Semantic HTML with proper heading hierarchy
- Keyboard navigation support
- Screen reader announcements for benefit changes
- High contrast mode compatible
- Focus indicators on interactive elements

#### Navigation Components

**Tabs**
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="documents">Documents</TabsTrigger>
    <TabsTrigger value="history">History</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Overview content</TabsContent>
  <TabsContent value="documents">Documents content</TabsContent>
</Tabs>
```

**Command Palette**
```tsx
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";

<Command>
  <CommandInput placeholder="Search..." />
  <CommandList>
    <CommandGroup heading="Programs">
      <CommandItem>SNAP</CommandItem>
      <CommandItem>Medicaid</CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

### Custom Maryland Components

**Maryland Header**
```tsx
// Includes Maryland flag + "State of Maryland" branding
<header className="bg-primary text-primary-foreground">
  <div className="flex items-center gap-3">
    <img src="/maryland-flag.png" alt="Maryland Flag" className="h-8" />
    <span className="text-lg font-semibold">State of Maryland</span>
  </div>
</header>
```

**Status Badge System**
```tsx
// Consistent status colors across the app
function StatusBadge({ status }: { status: string }) {
  const variants = {
    'Significant': 'destructive',      // Red
    'Accepted': 'success',             // Green
    'Pending': 'warning',              // Yellow
    'Rejected': 'destructive',         // Red
  };
  
  return <Badge variant={variants[status]}>{status}</Badge>;
}
```

---

## Accessibility Standards

### WCAG 2.1 AA Compliance

**Required Standards:**
- ✅ **1.4.3 Contrast (Minimum)** - 4.5:1 for normal text, 3:1 for large text
- ✅ **1.4.11 Non-text Contrast** - 3:1 for UI components and graphics
- ✅ **2.1.1 Keyboard** - All functionality available via keyboard
- ✅ **2.4.7 Focus Visible** - Keyboard focus indicator visible
- ✅ **4.1.2 Name, Role, Value** - ARIA attributes on custom components

### Focus Indicators

**Keyboard Navigation:**
```css
*:focus {
  outline: 2px solid hsl(var(--maryland-dhs-red));
  outline-offset: 2px;
}
```
- **Color:** Maryland DHS Red (#C5203A)
- **Width:** 2px solid
- **Offset:** 2px for visual separation

**Example:**
```tsx
<Button className="focus:ring-2 focus:ring-accent focus:ring-offset-2">
  Submit Application
</Button>
```

### Skip Links

**Screen Reader Navigation:**
```tsx
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
```

**Styling:**
```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: hsl(var(--maryland-dhs-red));
  color: white;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
  border-radius: 4px;
}

.skip-link:focus {
  top: 6px;
}
```

### Screen Reader Support

**Hidden Content for Screen Readers:**
```tsx
<span className="sr-only">Document uploaded successfully</span>
```

**Styling:**
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

**ARIA Labels:**
```tsx
<Button aria-label="Close notification">
  <X className="h-4 w-4" />
</Button>

<Input aria-describedby="email-error" aria-invalid={hasError} />
<span id="email-error" className="text-destructive">Invalid email</span>
```

### Touch Target Size

**Mobile Accessibility (WCAG 2.5.5):**
```css
@media (max-width: 768px) {
  button, .btn, [role="button"] {
    min-height: 44px;
    min-width: 44px;
  }
}
```
- **Minimum Size:** 44x44px (iOS/Android guidelines)
- **Spacing:** 8px between adjacent touch targets

### High Contrast Mode

**Support for Forced Colors:**
```css
@media (prefers-contrast: high) {
  * {
    border-color: currentColor;
  }
}
```

### Reduced Motion

**Respect User Preferences:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**React Example:**
```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
>
  Content
</motion.div>
```

### Semantic HTML

**Always Use Semantic Elements:**
```tsx
// ✅ Good
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/cases">Cases</a></li>
  </ul>
</nav>

<main id="main-content">
  <article>
    <h1>SNAP Benefits Overview</h1>
  </article>
</main>

// ❌ Bad
<div className="nav">
  <div className="nav-item">Cases</div>
</div>
```

---

## Responsive Design

### Breakpoints

**Tailwind CSS Breakpoints:**
```css
sm: 640px   /* Tablet portrait */
md: 768px   /* Tablet landscape */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large desktop */
```

### Mobile-First Approach

**Base styles apply to mobile, then override for larger screens:**
```tsx
<div className="
  flex flex-col          // Mobile: vertical stack
  md:flex-row            // Tablet+: horizontal row
  gap-4                  // Mobile: 1rem gap
  md:gap-6               // Tablet+: 1.5rem gap
">
  <Card>Content 1</Card>
  <Card>Content 2</Card>
</div>
```

### Responsive Typography

```tsx
<h1 className="
  text-2xl               // Mobile: 1.5rem (24px)
  md:text-3xl            // Tablet: 1.875rem (30px)
  lg:text-4xl            // Desktop: 2.25rem (36px)
">
  Maryland Benefits Navigator
</h1>
```

### Container Padding

```css
@media (max-width: 768px) {
  .container {
    padding-left: 1rem;   /* 16px */
    padding-right: 1rem;  /* 16px */
  }
}
```

### Responsive Navigation

**Mobile Navigation (Bottom Bar):**
```tsx
<nav className="
  fixed bottom-0 left-0 right-0 
  md:static md:bottom-auto
  bg-card border-t
  md:border-t-0
">
  <div className="flex justify-around md:justify-start md:gap-6">
    <NavItem icon={<Home />} label="Home" />
    <NavItem icon={<Search />} label="Search" />
    <NavItem icon={<Bell />} label="Updates" />
    <NavItem icon={<FileText />} label="Resources" />
  </div>
</nav>
```

### Image Optimization

**High DPI/Retina Displays:**
```css
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  body {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

**Responsive Images:**
```tsx
<img 
  src="/maryland-flag.png"
  srcSet="/maryland-flag@2x.png 2x, /maryland-flag@3x.png 3x"
  alt="Maryland Flag"
  className="h-8 w-auto"
/>
```

---

## Iconography

### Icon Library

**Primary:** lucide-react
```tsx
import { Home, Search, Bell, FileText, Check, X, AlertTriangle } from "lucide-react";

<Button>
  <Check className="h-4 w-4 mr-2" />
  Approve
</Button>
```

**Company Logos:** react-icons/si
```tsx
import { SiGoogle } from "react-icons/si";

<SiGoogle className="h-6 w-6" />
```

### Icon Sizing

```tsx
.h-3 .w-3  // 12px - Small inline icons
.h-4 .w-4  // 16px - Button icons, form icons
.h-5 .w-5  // 20px - Navigation icons
.h-6 .w-6  // 24px - Page header icons
.h-8 .w-8  // 32px - Feature icons
.h-10 .w-10 // 40px - Hero icons
```

### Icon Colors

**Semantic Icon Colors:**
```tsx
<Check className="h-4 w-4 text-success" />      // Green checkmark
<X className="h-4 w-4 text-destructive" />       // Red X
<AlertTriangle className="h-4 w-4 text-warning" /> // Yellow warning
<Info className="h-4 w-4 text-primary" />        // Blue info
```

### Icon Backgrounds

**Circular Icon Backgrounds:**
```tsx
<div className="
  h-10 w-10 
  rounded-full 
  bg-icon-background 
  flex items-center justify-center
">
  <FileText className="h-5 w-5 text-primary" />
</div>
```

**Icon Background Colors:**
```css
--icon-background: hsl(207, 89%, 92%); /* Light Blue (light mode) */
--icon-background: hsl(207, 89%, 20%); /* Dark Blue (dark mode) */
```

---

## Spacing & Layout

### Spacing Scale

**Tailwind Spacing (based on 4px grid):**
```
0    → 0px
1    → 4px
2    → 8px
3    → 12px
4    → 16px
5    → 20px
6    → 24px
8    → 32px
10   → 40px
12   → 48px
16   → 64px
20   → 80px
24   → 96px
```

**Common Spacing Patterns:**
```tsx
// Card padding
<Card className="p-6">...</Card>

// Section spacing
<section className="space-y-8">...</section>

// Button spacing
<div className="flex gap-4">
  <Button>Action 1</Button>
  <Button>Action 2</Button>
</div>
```

### Layout Containers

The platform uses four distinct container width patterns, each serving specific functional purposes. These widths are **intentional design choices** optimized for their content types and user workflows.

#### Container Width Standards

**1. Dashboards - `max-w-6xl` (1152px)**
```tsx
<div className="container mx-auto px-4 py-8 max-w-6xl">
  {/* Dashboard quick actions and cards */}
</div>
```
- **Used in:** NavigatorDashboard, AdminDashboard, ClientDashboard, CaseworkerDashboard
- **Rationale:** Balanced width for dashboard cards in 2-3 column grids, optimized for scanning quick actions
- **Grid Pattern:** 2-column on tablet, 3-column on desktop
- **Example:** Client dashboard with 4 quick action cards

**2. Content Pages - `max-w-7xl` (1280px)**
```tsx
<div className="container mx-auto px-4 py-8 max-w-7xl">
  {/* Content-rich pages */}
</div>
```
- **Used in:** Home page, Search results, IntakeCopilot, Policy Manual
- **Rationale:** Standard content width for text-heavy pages, search results, and conversational interfaces
- **Optimal Line Length:** Maintains readability for long-form content
- **Example:** Policy search results with preview cards

**3. Wide Workspaces - `max-w-[1800px]` (1800px)**
```tsx
<div className="container mx-auto px-4 py-8 max-w-[1800px]">
  {/* Complex multi-column workspaces */}
</div>
```
- **Used in:** HouseholdProfiler only
- **Rationale:** Accommodates 3-column layout (form fields + Financial Opportunity Radar sidebar + spacing)
- **Layout:** Left sidebar (navigation) + Center (form) + Right sidebar (real-time calculations)
- **Example:** Household profiler with persistent benefit calculation sidebar

**4. Full Width - No max-width**
```tsx
<div className="container mx-auto px-4 py-8">
  {/* Data-intensive tables and QC dashboards */}
</div>
```
- **Used in:** SupervisorCockpit, CaseworkerCockpit (QC dashboards only)
- **Rationale:** Data tables require maximum horizontal space for columns and filters
- **Content Type:** Wide data tables with 8+ columns, analytics dashboards
- **Example:** Quality control dashboard with error patterns and case flags

#### Width Selection Guidelines

**When to use each width:**

| Container Width | Use Case | Content Type | Example Pages |
|----------------|----------|--------------|---------------|
| `max-w-6xl` | Role dashboards | Quick actions, card grids | ClientDashboard, NavigatorDashboard |
| `max-w-7xl` | Content pages | Text, search results, forms | Home, Search, Policy Manual |
| `max-w-[1800px]` | Multi-column workspaces | Complex forms with sidebars | HouseholdProfiler |
| No max-width | Data dashboards | Wide data tables | SupervisorCockpit, CaseworkerCockpit |

**Visual Transition Strategy:**
While transitioning between pages with different widths is intentional, consider adding subtle animations to minimize jarring layout shifts:

```tsx
<div className="transition-all duration-200 ease-in-out">
  {/* Container content */}
</div>
```

**Prose Content (Narrow):**
```tsx
<div className="container max-w-4xl mx-auto px-4">
  {/* Optimal for article-style content: 896px max width, ~75 characters per line */}
</div>
```
- **Used in:** Long-form documentation, policy text, article pages
- **Rationale:** Maintains optimal reading line length (50-75 characters)

### Grid Layouts

**Responsive Grid:**
```tsx
<div className="
  grid 
  grid-cols-1 
  md:grid-cols-2 
  lg:grid-cols-3 
  gap-6
">
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</div>
```

---

## Forms & Inputs

### Form Layout

**Vertical Form (Default):**
```tsx
<form className="space-y-6">
  <FormField>
    <FormLabel>Client Name</FormLabel>
    <FormControl>
      <Input />
    </FormControl>
  </FormField>
  
  <FormField>
    <FormLabel>Case Number</FormLabel>
    <FormControl>
      <Input />
    </FormControl>
  </FormField>
  
  <Button type="submit">Submit</Button>
</form>
```

**Horizontal Form (Desktop):**
```tsx
<form className="space-y-4">
  <div className="md:flex md:items-center md:gap-6">
    <FormLabel className="md:w-40">Client Name</FormLabel>
    <FormControl className="md:flex-1">
      <Input />
    </FormControl>
  </div>
</form>
```

### Input States

**Default:**
```tsx
<Input placeholder="Enter value" />
```

**Disabled:**
```tsx
<Input disabled placeholder="Cannot edit" />
```

**Error:**
```tsx
<Input 
  aria-invalid="true" 
  aria-describedby="error-message"
  className="border-destructive"
/>
<p id="error-message" className="text-sm text-destructive mt-1">
  Field is required
</p>
```

**Success:**
```tsx
<Input 
  className="border-success"
/>
<p className="text-sm text-success mt-1 flex items-center gap-1">
  <Check className="h-4 w-4" />
  Valid input
</p>
```

### File Upload

**Upload Zone:**
```tsx
<div className="upload-zone p-8 text-center rounded-lg cursor-pointer">
  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
  <p>Drag and drop or click to upload</p>
  <p className="text-sm text-muted-foreground mt-1">
    PDF, JPG, PNG (max 10MB)
  </p>
</div>
```

**Styling:**
```css
.upload-zone {
  border: 2px dashed hsl(var(--border));
  transition: all 0.2s ease-in-out;
}

.upload-zone:hover,
.upload-zone.dragover {
  border-color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 0.05);
}
```

---

## Navigation Patterns

### Header Navigation

**Desktop:**
```tsx
<header className="bg-primary text-primary-foreground">
  <div className="container mx-auto px-4 py-4 flex justify-between items-center">
    <div className="flex items-center gap-3">
      <img src="/maryland-flag.png" alt="" className="h-8" />
      <h1 className="text-xl font-semibold">Maryland Benefits</h1>
    </div>
    <nav>
      <ul className="flex gap-6">
        <li><a href="/cases">Cases</a></li>
        <li><a href="/documents">Documents</a></li>
        <li><a href="/reports">Reports</a></li>
      </ul>
    </nav>
  </div>
</header>
```

### Bottom Navigation (Mobile)

**Fixed Bottom Bar:**
```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-card border-t md:hidden">
  <div className="flex justify-around py-2">
    <NavItem icon={<Home />} label="Home" href="/" />
    <NavItem icon={<Search />} label="Search" href="/search" />
    <NavItem icon={<Bell />} label="Updates" href="/notifications" />
    <NavItem icon={<FileText />} label="Resources" href="/resources" />
  </div>
</nav>
```

**NavItem Component:**
```tsx
function NavItem({ icon, label, href }: NavItemProps) {
  return (
    <Link 
      href={href}
      className="flex flex-col items-center gap-1 py-2 px-4 text-muted-foreground hover:text-foreground"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Link>
  );
}
```

### Breadcrumbs

```tsx
<nav aria-label="Breadcrumb" className="mb-6">
  <ol className="flex items-center gap-2 text-sm">
    <li><a href="/" className="text-primary hover:underline">Home</a></li>
    <li><ChevronRight className="h-4 w-4 text-muted-foreground" /></li>
    <li><a href="/cases" className="text-primary hover:underline">Cases</a></li>
    <li><ChevronRight className="h-4 w-4 text-muted-foreground" /></li>
    <li className="text-muted-foreground">Case #12345</li>
  </ol>
</nav>
```

---

## Data Visualization

### Chart Colors

**Recharts Configuration:**
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

<BarChart data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="name" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Bar dataKey="snap" fill="hsl(var(--chart-1))" />
  <Bar dataKey="medicaid" fill="hsl(var(--chart-2))" />
  <Bar dataKey="tanf" fill="hsl(var(--chart-3))" />
</BarChart>
```

### Status Visualization

**Verification Stamps:**
```tsx
<div className="relative">
  <img src="/document.pdf" alt="Document preview" />
  
  {/* Approved stamp */}
  <div className="absolute top-4 right-4 rotate-12">
    <div className="
      bg-success/10 
      border-2 border-success 
      text-success 
      px-4 py-2 
      rounded 
      font-bold 
      text-xl
    ">
      APPROVED
    </div>
  </div>
</div>
```

---

## Animation & Motion

### Framer Motion

**Page Transitions:**
```tsx
import { motion } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
>
  Page content
</motion.div>
```

**Staggered Lists:**
```tsx
<motion.ul
  variants={{
    visible: { transition: { staggerChildren: 0.1 } }
  }}
  initial="hidden"
  animate="visible"
>
  {items.map(item => (
    <motion.li
      key={item.id}
      variants={{
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 }
      }}
    >
      {item.name}
    </motion.li>
  ))}
</motion.ul>
```

### CSS Animations

**Loading Pulse:**
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

**Slide Up:**
```css
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
```

---

## Dark Mode

### Implementation

**Theme Provider:**
```tsx
const [theme, setTheme] = useState<'light' | 'dark'>('light');

useEffect(() => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('theme', theme);
}, [theme]);
```

### Dark Mode Colors

**Background & Foreground:**
```css
.dark {
  --background: hsl(0, 0%, 0%);              /* Black */
  --foreground: hsl(200, 6.67%, 91.18%);     /* Light gray text */
  --card: hsl(228, 9.8%, 10%);               /* Dark gray cards */
  --card-foreground: hsl(0, 0%, 85.1%);      /* Light text on cards */
}
```

**Preserve Maryland Brand Colors:**
```css
.dark {
  --primary: hsl(207, 91%, 29%);             /* Maryland DHS Blue (unchanged) */
  --secondary: hsl(43, 100%, 55%);           /* Maryland DHS Gold (unchanged) */
  --accent: hsl(354, 70%, 46%);              /* Maryland DHS Red (unchanged) */
}
```

### Dark Mode Usage

**Explicit Light/Dark Variants:**
```tsx
<div className="bg-white dark:bg-black text-black dark:text-white">
  Content adapts to theme
</div>

<Card className="bg-card text-card-foreground">
  {/* Automatically uses dark mode colors */}
</Card>
```

---

## Appendix

### Design Tokens (CSS Variables)

**Complete Token List:**
```css
/* Colors */
--background, --foreground
--card, --card-foreground
--popover, --popover-foreground
--primary, --primary-foreground
--secondary, --secondary-foreground
--muted, --muted-foreground
--accent, --accent-foreground
--destructive, --destructive-foreground
--success, --success-foreground
--warning, --warning-foreground

/* Maryland Brand */
--maryland-dhs-blue
--maryland-dhs-red
--maryland-dhs-gold
--maryland-black
--maryland-white

/* UI */
--border
--input
--ring
--icon-background

/* Charts */
--chart-1, --chart-2, --chart-3, --chart-4, --chart-5

/* Typography */
--font-sans, --font-serif, --font-mono

/* Spacing */
--radius (8px)
--spacing (0.25rem)
```

### Complete Component Library (46 Features)

This platform implements 46+ UI components across all feature categories. For complete component architecture mapping including file paths, API integrations, and technical details, see:

- **Architecture:** [docs/ARCHITECTURE.md - Complete Feature Architecture Map](ARCHITECTURE.md#complete-feature-architecture-map)
- **Component Catalog:** [FEATURES.md](../FEATURES.md) - Comprehensive feature listing with UI details
- **Technical Docs:** [TECHNICAL_DOCUMENTATION.md](../TECHNICAL_DOCUMENTATION.md) - Implementation specifics

**Component Categories:**
- Public Portal (5): QuickScreener, BenefitScreener, DocumentChecklist, NoticeExplainer, SimplifiedSearch
- Core Widgets (5): FinancialOpportunityRadar, HouseholdProfiler, ScenarioWorkspace, EligibilityChecker, PolicyEngineVerificationBadge
- Dashboards (7): Navigator, Client, Caseworker, Supervisor, Admin, Performance, County Analytics
- Quality Control (5): CaseworkerCockpit, SupervisorCockpit, BenchmarkInsights, DataQualityDashboard, FlaggedCases
- Infrastructure (6): NotificationBell, InstallPrompt, MobileBottomNav, CommandPalette, AchievementNotification, Leaderboard
- Admin Tools (12): Policy Management, Rules Extraction, Security Monitoring, AI Monitoring, Developer Portal, Training, etc.
- Foundation (shadcn/ui): All accessible Radix UI components with Maryland DHS theming

All components follow Maryland DHS design standards, WCAG 2.1 AA compliance, and mobile-first responsive design.

### Component Checklist

**New Component Requirements:**
- [ ] Uses Maryland DHS color palette
- [ ] Montserrat typography applied
- [ ] WCAG 2.1 AA contrast ratios met
- [ ] Keyboard accessible (focus indicators)
- [ ] Touch targets ≥44x44px on mobile
- [ ] ARIA attributes for screen readers
- [ ] Responsive design (mobile-first)
- [ ] Dark mode support
- [ ] Respects reduced motion preferences
- [ ] Semantic HTML structure

### Resources

**Design Files:**
- Maryland DHS Style Guide (PDF)
- Component Figma Library: [Link]
- Icon Library: https://lucide.dev

**Code References:**
- Tailwind CSS: https://tailwindcss.com
- shadcn/ui: https://ui.shadcn.com
- Radix UI: https://radix-ui.com
- Framer Motion: https://framer.com/motion

**Accessibility:**
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/

---

**Last Updated:** January 2025  
**Document Version:** 1.0  
**Next Review:** April 2025

For design system questions, contact: design@maryland.gov

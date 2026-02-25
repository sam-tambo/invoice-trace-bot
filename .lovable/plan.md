

## Analysis

The app currently has no public-facing landing page -- the Index page is an unused placeholder, and "/" routes directly to the authenticated Dashboard. The user wants a professional, enterprise-grade landing page that:

1. Explains InvoiceTrace's purpose (invoice recovery/tracking for Portuguese businesses)
2. Highlights key features: photo capture of invoices, organization by month/day/provider, Gmail scanning, automated supplier outreach, TOConline sync, accounting sharing portal
3. No pricing section
4. Professional, enterprise-quality design

## Plan

### 1. Create a new Landing Page component (`src/pages/Landing.tsx`)

A full marketing page with the following sections:

**Hero Section**
- Bold headline: "Nunca mais perca uma fatura" (Never lose an invoice again)
- Subtitle explaining automatic invoice recovery, organization, and accounting sync
- Two CTAs: "Começar Agora" (links to /auth) and "Ver Demo"
- Abstract illustration using Lucide icons arranged in a grid/visual

**How It Works (3 steps)**
- Step 1: Import invoices from e-Fatura or take photos
- Step 2: Automatic email scanning and supplier outreach
- Step 3: Organize, share with accounting, sync with TOConline

**Features Grid (6 feature cards)**
- Camera/Photo Capture: Photograph invoices directly, OCR extraction
- Smart Organization: Auto-organize by month, day, and provider
- Gmail Integration: Automatic scanning and matching of invoice emails
- Automated Outreach: Template-based supplier follow-up emails
- TOConline Sync: Direct synchronization with TOConline accounting
- Accounting Portal: Password-protected sharing with external accountants

**Integration Banner**
- Visual showing TOConline logo/mention, Gmail, e-Fatura connections
- "Integra-se com as ferramentas que já usa"

**CTA Section**
- Final call to action to sign up
- "Comece a recuperar faturas hoje"

**Footer**
- Minimal footer with InvoiceTrace branding

### 2. Update Routing (`src/App.tsx`)

- Add a new `/landing` route (public, no auth required) pointing to `Landing`
- Alternatively, make "/" show Landing for unauthenticated users and Dashboard for authenticated users. Since the current ProtectedRoute already redirects to /auth, I'll create a smarter root route that shows Landing when not logged in and redirects to /dashboard when logged in.
- Move Dashboard to `/dashboard` route
- Update sidebar nav to point to `/dashboard` instead of `/`

### 3. Files to modify
- **Create**: `src/pages/Landing.tsx` -- full landing page
- **Edit**: `src/App.tsx` -- add Landing route, adjust "/" to show landing for guests / dashboard for auth users
- **Edit**: `src/components/AppLayout.tsx` -- update nav item for Painel from "/" to "/dashboard"

### Technical Details

- Pure Tailwind CSS, no additional dependencies needed
- Uses existing Lucide icons (Camera, Search, Mail, Calendar, Building2, Share2, ArrowRight, CheckCircle2, etc.)
- Responsive design with mobile-first approach
- Gradient accents using the existing primary blue color scheme
- Card components from existing UI library for feature cards
- Inter font already configured


import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import MarketingHeader from '../components/marketing-header';
import ProductPreview from '../components/product-preview';
import InterestPreview from '../components/interest-preview';
import { createSupabaseServer } from '../lib/supabase/server';
import styles from '../components/marketing.module.css';
import clean from '../components/landing.module.css';
const title = 'BidXchange | California Contractor Bid Control';
const description =
  'Bid review for California field contractors. Keep licenses, DIR registration, insurance, bid requirements and deadlines together so your team can decide whether to bid and prepare its response.';
const publicMetadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://bidxapp.vercel.app/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    title,
    description,
    siteName: 'BidXchange',
    url: 'https://bidxapp.vercel.app/',
    images: [
      {
        url: 'https://bidxapp.vercel.app/brand/bidxchange-icon.png?v=2',
        width: 1254,
        height: 1254,
        alt: 'BidXchange California contractor bid workspace',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title,
    description,
    images: ['https://bidxapp.vercel.app/brand/bidxchange-icon.png?v=2'],
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const query = await searchParams;
  return { ...publicMetadata, robots: { index: Object.keys(query).length === 0, follow: true } };
}

export default async function Home() {
  let signedIn = false;
  try {
    const supabase = await createSupabaseServer();
    if (supabase) {
      const { data, error } = await supabase.auth.getUser();
      signedIn = !error && !!data.user;
    }
  } catch {
    // Keep the public page available if the identity provider is unavailable.
  }
  return (
    <div className={`${styles.site} ${clean.landing}`}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <MarketingHeader signedIn={signedIn} />
      <main id="main-content" tabIndex={-1}>
        <section className={`${styles.hero} ${clean.hero}`} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.heroEyebrow}>
                <span /> BID PREPARATION FOR CALIFORNIA FIELD CONTRACTORS
              </div>
              <h1 id="hero-title">
                Before you price the job, <span>review what the bid requires.</span>
              </h1>
              <p className={styles.heroDescription}>
                Compare license, DIR, insurance and bonding requirements with your company records.
                Assign missing information, track deadlines, and prepare a response your team can
                review.
              </p>
              <div className={styles.heroActions}>
                <a href="#sample-review" className={styles.primary}>
                  Try a sample bid review <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a href="#request-demo" className={styles.secondary}>
                  Arrange a walkthrough <ArrowUpRight size={18} aria-hidden="true" />
                </a>
                <a href="/ges-ai-demo" className={styles.secondary}>
                  GES AI call simulation <ArrowRight size={18} aria-hidden="true" />
                </a>
              </div>
              <p className={clean.heroNote}>
                Your team makes the decision, approves the response, and submits the bid.
              </p>
            </div>
            <div className={`${styles.heroVisual} ${clean.visual}`}>
              <ProductPreview />
            </div>
          </div>
        </section>
        <section id="ges-call-simulation" className={clean.orientation} aria-labelledby="ges-call-title">
          <div>
            <span className={styles.eyebrow}>GES ELECTRICAL · INTERACTIVE DEMO</span>
            <h2 id="ges-call-title">See a customer call become an appointment and follow-up drafts.</h2>
          </div>
          <div>
            <p>Follow a simulated lighting inquiry with Donn as the customer in Calimesa. View the customer record, demonstration appointment, email draft, proposal draft, and operator handoff.</p>
            <a href="/ges-ai-demo" className={clean.textLink}>Run the GES AI call simulation <ArrowRight size={16} aria-hidden="true" /></a>
            <p>Scripted demonstration with optional browser speech. No live calls, bookings, emails, or contracts are sent.</p>
          </div>
        </section>
        <section id="capabilities" className={clean.orientation} aria-label="What BidXchange is">
          <div>
            <span className={styles.eyebrow}>BEFORE COMMITTING ESTIMATING TIME</span>
            <h2>Find the unanswered questions before they become last-minute work.</h2>
          </div>
          <p>
            Add a notice from PEPMA, a school district, a city or another procurement portal.
            Compare it with your company records, then give each missing confirmation an owner.
            Built for California electrical, energy-efficiency and construction teams.
          </p>
        </section>
        <section id="company-passport" className={clean.passport} aria-labelledby="passport-title">
          <div>
            <span className={styles.eyebrow}>COMPANY PASSPORT</span>
            <h2 id="passport-title">
              Enter company details once. Keep them current for the next bid.
            </h2>
            <p>
              Your Company Passport is your reusable company profile. Keep license numbers,
              registration status, insurance dates, bonding information and past projects together,
              with a source and last-checked date for each record.
            </p>
            <Link href="/company?workspace=demo" className={clean.textLink}>
              View sample company profile <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div>
            <ul className={clean.recordList}>
              <li>CSLB license details and DIR public-works registration</li>
              <li>Insurance, bonding information and service areas</li>
              <li>Past projects, personnel and equipment capacity</li>
            </ul>
            <details className={clean.expandable}>
              <summary>What else belongs in the Passport?</summary>
              <p>
                Legal business name, authorized contacts, certifications, trade classifications,
                safety records and references to supporting documents. Record who checked each item,
                its source and any expiration date.
              </p>
              <p>
                Access depends on team permissions and the record’s sensitivity. Link to supporting
                documents in storage your company controls; private file uploads are not enabled.
              </p>
            </details>
            <p>
              Saved or reviewed records do not establish legal eligibility. Your team must check the
              requirements of each bid; BidXchange does not confirm license coverage.
            </p>
          </div>
        </section>
        <section
          id="ai-assistance"
          className={`${clean.passport} ${clean.assistant}`}
          aria-labelledby="ai-title"
        >
          <div>
            <span className={styles.eyebrow}>MEET BIDBUDDY BY BIDXCHANGE</span>
            <h2 id="ai-title">Ask BidBuddy what needs attention on this bid.</h2>
            <p>
              Ask follow-up questions about your saved company records, unresolved requirements and
              assigned tasks. BidBuddy can suggest next steps and help draft a response outline. In
              workspace mode, company-specific answers use records your role allows it to access.
            </p>
            <p>
              Review AI suggestions against the original notice. BidBuddy cannot approve pricing,
              verify legal qualifications, authorize submission, or submit a bid.
            </p>
          </div>
          <div>
            <div className={clean.answer} aria-label="Illustrative BidBuddy answer">
              <span className={styles.eyebrow}>SCRIPTED EXAMPLE · FICTIONAL RECORDS</span>
              <h3>“What still needs attention before we prepare this response?”</h3>
              <ol>
                <li>
                  <strong>Bond confirmation is missing.</strong> Ask the estimator to request it
                  from the surety.
                </li>
                <li>
                  <strong>Job-walk attendance is unconfirmed.</strong> Have the project manager
                  confirm the attendee and meeting details.
                </li>
                <li>
                  <strong>License coverage needs human review.</strong> Ask the bid lead to compare
                  the saved CSLB record with the specification.
                </li>
              </ol>
              <a href="#sample-review" className={clean.textLink}>
                See the sample requirements behind this answer{' '}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
              <p>
                Illustrative answer, not a live AI response. Review suggestions against the original
                notice.
              </p>
            </div>
            <details className={clean.expandable}>
              <summary>What can BidBuddy access?</summary>
              <p>
                General mode does not access private company records or browse the web. Workspace
                answers use records your role allows it to access. To create a response outline,
                open the relevant bid; your role must allow draft creation.
              </p>
            </details>
          </div>
        </section>
        <section id="questions" className={clean.questions} aria-labelledby="questions-title">
          <div>
            <span className={styles.eyebrow}>BEFORE YOU GET STARTED</span>
            <h2 id="questions-title">Frequently Asked Questions</h2>
            <p>
              For contractor owners, estimators, bid coordinators and project managers handling
              public-works and utility bids. Find out what to bring, what your team can do here, and
              which decisions stay with you.
            </p>
          </div>
          <div className={clean.faq}>
            <details>
              <summary>What do I need to get started?</summary>
              <p>
                Start with a public bid notice, basic company details and a person to lead the
                review. Add supporting records as you work through the requirements. You can explore
                the fictional demo without entering company data.{' '}
                <Link href="/pursuits/DEMO-001?workspace=demo">Try the sample bid workspace</Link>.
              </p>
            </details>
            <details>
              <summary>Can I use bids from PEPMA, SAM.gov or other portals?</summary>
              <p>
                Yes. Paste the public notice text and record its official link, deadline and
                submission instructions. Portal shortcuts open external sites; they do not
                automatically import or synchronize every notice. Your team checks the official
                source for updates. <a href="#current-scope">See the current connection limits</a>.
              </p>
            </details>
            <details>
              <summary>What belongs in my company profile?</summary>
              <p>
                Legal company details, CSLB and DIR records, insurance expiration dates, bonding
                information, service areas and relevant past projects. Keep the source and
                last-checked date with each record so reviewers know what needs updating.{' '}
                <Link href="/company?workspace=demo">Explore the sample company profile</Link>.
              </p>
            </details>
            <details>
              <summary>How does BidBuddy use my company records?</summary>
              <p>
                In an enabled workspace, BidBuddy uses saved records your role permits it to access
                to explain requirements, identify missing information and help draft an outline.
                General mode does not use private company records. Review AI answers against the
                source notice. <a href="#ai-assistance">See an illustrative BidBuddy answer</a>.
              </p>
            </details>
            <details>
              <summary>Can I create and export a bid response?</summary>
              <p>
                You can create a response outline from current, attested company records, add your
                technical answers and export a PDF or Word draft. Missing information stays marked
                for human input. Your team supplies pricing and approves a specific draft version.{' '}
                <Link href="/pursuits/DEMO-001?workspace=demo">
                  Explore the sample response workflow
                </Link>
                .
              </p>
            </details>
            <details>
              <summary>Does BidXchange submit bids or determine eligibility?</summary>
              <p>
                No. Your team reviews qualifications, makes the bid/no-bid decision, signs and
                submits through the buyer’s required channel. You can record the submission and
                confirmation here; BidXchange does not independently verify buyer receipt. It does
                not guarantee eligibility, responsiveness, award, profitability or revenue.
              </p>
            </details>
            <details id="security">
              <summary>Who can see my company information?</summary>
              <p>
                Authenticated workspaces use organization membership and role-based access. Company
                records can be restricted by role and are not published in the public demo. Link to
                supporting documents in storage your company controls; access to those external
                files is managed there.
              </p>
            </details>
            <details id="pricing">
              <summary>How do I arrange a walkthrough, and what does it cost?</summary>
              <p>
                Start with a pilot walkthrough with Manuel. Commercial terms are not finalized; no
                prices or service commitments are published yet.{' '}
                <a href="#request-demo">Arrange a walkthrough</a>. If the contact option opens your
                email app, send the message there to request a time.
              </p>
            </details>
          </div>
        </section>
        <div className={clean.contact}>
          <InterestPreview />
        </div>
      </main>
      <footer className={clean.footer}>
        <div className={clean.footerTop}>
          <div>
            <Link href="/" aria-label="BidXchange home">
              <Image
                src="/brand/bidxchange-logo.png?v=2"
                width={2172}
                height={724}
                sizes="160px"
                alt="BidXchange"
              />
            </Link>
            <p>Company records, bid requirements and response drafts in one workspace.</p>
          </div>
          <nav aria-label="Footer access links">
            <Link href="/login">Sign In</Link>
            {process.env.BIDXCHANGE_SELF_SERVICE_ENABLED === 'true' && (
              <Link href="/signup">Create a company workspace</Link>
            )}
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Use</Link>
          </nav>
        </div>
        <details id="current-scope" className={clean.legal}>
          <summary>Current scope</summary>
          <p>
            Company Passport, research over available records, portal links, saved searches, manual
            opportunity intake, pursuit workspaces, cited requirements, evidence-use reviews,
            findings, tasks, deadlines, human bid/no-bid decisions, response drafts, PDF/Word
            exports, version-bound approvals and user-recorded submissions. Access depends on role;
            AI assistance requires an enabled workspace.
          </p>
          <p>
            People check candidate requirements against the full notice and review amendments.
            Production intake remains manual; broad live procurement feeds and private file uploads
            are not enabled. The SAM.gov connector awaits production activation. Signatures and
            delivery stay with your team and the agency or utility’s required channel.
          </p>
        </details>
        <p id="legal-notices" className={clean.legal}>
          Privacy Policy and Terms of Use are in draft and are not yet effective.
        </p>
        <div className={clean.footerBottom}>
          <span>© {new Date().getFullYear()} BidXchange</span>
          <span>Independent software. No government affiliation or guaranteed awards.</span>
        </div>
      </footer>
    </div>
  );
}

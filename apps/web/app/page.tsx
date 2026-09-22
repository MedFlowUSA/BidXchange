import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight, FolderCheck, ListChecks, FileSearch } from 'lucide-react';
import MarketingHeader from '../components/marketing-header';
import ProductPreview from '../components/product-preview';
import InterestPreview from '../components/interest-preview';
import { createSupabaseServer } from '../lib/supabase/server';
import styles from '../components/marketing.module.css';
import clean from '../components/landing.module.css';
const title = 'BidXchange | From Contract Opportunity to Reviewed Bid';
const description =
  'Choose government and utility opportunities worth pursuing, reuse company qualifications, prepare evidence-backed responses and manage the work through human-approved submission.';
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
        alt: 'BidXchange government-contracting workspace',
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
                <span /> GOVERNMENT & UTILITY CONTRACTS
              </div>
              <h1 id="hero-title">
                Pursue work you can deliver.{' '}
                <span>Build the bid that backs it up.</span>
              </h1>
              <p className={styles.heroDescription}>
                Turn a contract opportunity into a coordinated response. Check it against your
                company’s qualifications, decide whether to bid, assign the missing work and prepare
                a response your team can review and submit.
              </p>
              <div className={styles.heroActions}>
                <a href="#request-demo" className={styles.primary}>
                  Request a Bid Review <ArrowUpRight size={18} aria-hidden="true" />
                </a>
                <Link href="/dashboard?workspace=demo" className={styles.secondary}>
                  Explore the Demo <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
              <p className={clean.heroNote}>
                Public works · Specialty trades · Facility services · Energy and utilities ·
                Professional services · Government suppliers
              </p>
            </div>
            <div className={`${styles.heroVisual} ${clean.visual}`}>
              <ProductPreview />
            </div>
          </div>
        </section>
        <section className={clean.definition} aria-label="What BidXchange is">
          <p>
            <strong>One workspace for the work between finding a bid and submitting it.</strong>{' '}
            Keep the company evidence, notice requirements, estimating tasks, response drafts and
            approval record together.
          </p>
          <p>
            Spend proposal time on work your team has a reason to pursue. Reuse what you have
            already documented, see what is missing, and give each open item an owner.
          </p>
        </section>
        <section id="capabilities" className={clean.workspace} aria-labelledby="capabilities-title">
          <div className={clean.sectionIntro}>
            <div>
              <span className={styles.eyebrow}>HOW IT HELPS YOU COMPETE</span>
              <h2 id="capabilities-title">
                Choose the work. Build the response. Manage the finish.
              </h2>
            </div>
            <p>
              Your estimator, bid lead and approver work from the same requirements and evidence,
              with a clear next action at each stage.
            </p>
          </div>
          <div className={clean.features}>
            {[
              {
                icon: FolderCheck,
                number: '01',
                title: 'Decide where to spend your bid effort',
                text: 'Compare available opportunities with verified company codes, trace requirements to evidence, and surface recorded blockers before committing to a response.',
              },
              {
                icon: FileSearch,
                number: '02',
                title: 'Prepare the response without starting over',
                text: 'Reuse reviewed company information, assign estimates and missing evidence, and assemble a PDF or Word working draft against the notice requirements.',
              },
              {
                icon: ListChecks,
                number: '03',
                title: 'Keep the submission work accounted for',
                text: 'Track deadlines, review the response version, record approvals, name the submitter and retain the submission record. Your authorized team delivers it through the buyer’s official channel.',
              },
            ].map((feature) => (
              <article key={feature.number}>
                <div className={clean.featureTop}>
                  <feature.icon size={27} strokeWidth={1.5} aria-hidden="true" />
                  <span>{feature.number}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
          <details className={clean.expandable}>
            <summary>Before your estimator spends a week on the numbers</summary>
            <div className={clean.problemGrid}>
              <div>
                <h3>Stop estimating bids that were never a fit</h3>
                <p>
                  A missing license, set-aside qualification, bond limit, registration or mandatory
                  event can make an attractive opportunity unworkable.
                </p>
              </div>
              <div>
                <h3>Stop rebuilding company information</h3>
                <p>
                  Keep reusable qualifications and their supporting sources in the Company Passport,
                  ready for the next pursuit’s review.
                </p>
              </div>
              <div>
                <h3>Stop managing requirements across inboxes and spreadsheets</h3>
                <p>
                  Cite the notice, assign each open question and preserve the requirement’s review
                  history.
                </p>
              </div>
              <div>
                <h3>Stop making bid decisions without a record</h3>
                <p>
                  Record why you pursued or passed. When reviewed information changes, reopen the
                  decision with the reasons in view.
                </p>
              </div>
            </div>
          </details>
        </section>
        <section id="company-passport" className={clean.passport} aria-labelledby="passport-title">
          <div>
            <span className={styles.eyebrow}>COMPANY PASSPORT</span>
            <h2 id="passport-title">Your next bid should start with what you already know.</h2>
            <p>
              Build a reusable record of your company’s capabilities and completed work. Keep its
              sources and renewal dates current, then review the relevant evidence for each new bid.
            </p>
          </div>
          <div>
            <ul className={clean.recordList}>
              <li>Licenses, registrations and certifications</li>
              <li>Insurance, bonding and service territories</li>
              <li>Past performance and operating capacity</li>
            </ul>
            <details className={clean.expandable}>
              <summary>What else belongs in the Passport?</summary>
              <p>
                Legal identity and authorized contacts; capabilities and classifications; equipment
                information within capacity records; key personnel; safety and compliance records;
                proposal-material references. Keep sources, verification details and expiration
                dates with each record.
              </p>
              <p>
                Record access depends on role and classification. Private file uploads are not
                enabled; supporting files stay in your authorized storage.
              </p>
            </details>
            <p>
              Verified company information does not automatically prove eligibility.
              Opportunity-specific human review remains required.
            </p>
          </div>
        </section>
        <section id="workflow" className={clean.workspace} aria-labelledby="workflow-title">
          <div className={clean.sectionIntro}>
            <div>
              <span className={styles.eyebrow}>FROM OPPORTUNITY TO SUBMISSION</span>
              <h2 id="workflow-title">A practical path to your next contract pursuit.</h2>
            </div>
          </div>
          <ol className={clean.steps}>
            {[
              [
                'Build your Company Passport',
                'Record the services, licenses, insurance, bonding and past projects that support your ability to do the work.',
              ],
              [
                'Bring an opportunity worth investigating',
                'Open a procurement portal or research records already in BidXchange. Capture the notice, scope and official deadline.',
              ],
              [
                'Make the bid/no-bid decision',
                'Compare cited requirements with company evidence. Review blockers, missing information and capacity before committing the team.',
              ],
              [
                'Assign the work that makes the bid possible',
                'Give estimates, site-visit questions, forms and evidence requests an owner and a deadline.',
              ],
              [
                'Build and review the response',
                'Reuse company information, develop the technical answers, and export a working draft for the responsible reviewers.',
              ],
              [
                'Approve, submit and record the result',
                'Review the final version, confirm the named submitter and official destination, then record delivery and the buyer’s receipt or acknowledgment.',
              ],
            ].map(([heading, text], i) => (
              <li key={heading}>
                <span aria-hidden="true">0{i + 1}</span>
                <div>
                  <h3>{heading}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className={clean.boundary}>
            BidXchange does not automatically submit bids. Final pricing, certifications,
            signatures, approvals and portal submission remain with authorized people.
          </p>
          <div className={clean.statusGroup} role="group" aria-label="Current product availability">
            <details className={clean.expandable}>
              <summary>Available now</summary>
              <p>
                Company Passport, conversational research over available records, portal links,
                personal saved searches, manual opportunity intake, pursuit workspaces, cited
                requirement records, evidence-use reviews, requirement findings, tasks and
                deadlines, human bid/no-bid decisions, response drafting and review, PDF/Word
                working exports, version-bound approvals and human submission records. Actions
                depend on role; AI assistance requires an enabled workspace.
              </p>
            </details>
            <details className={clean.expandable}>
              <summary>Limited or manual</summary>
              <p>
                People enter opportunities, review amendments, verify evidence and check candidate
                requirements against the full notice. Requirement extraction assists review of
                pasted excerpts; it does not certify a complete register. Final files, signatures
                and procurement-portal delivery are handled outside BidXchange.
              </p>
            </details>
            <details className={clean.expandable}>
              <summary>Not currently enabled</summary>
              <p>
                Broad live procurement feeds and private file uploads are not enabled. The SAM.gov
                connector is implemented, but production intake remains manual; connector activation
                and live synchronization are pending. BidXchange does not autonomously certify
                eligibility, calculate prices, submit through procurement portals or guarantee
                awards.
              </p>
            </details>
          </div>
        </section>
        <section id="ai-assistance" className={clean.passport} aria-labelledby="ai-title">
          <div>
            <span className={styles.eyebrow}>ASK ABOUT THE WORK IN FRONT OF YOU</span>
            <h2 id="ai-title">Ask the next question that moves the bid forward.</h2>
            <p>
              Research available opportunities with follow-up questions, review the interpreted
              filters, and see company-code matches and missing information. In workspace-record
              mode, answers use authorized BidXchange records and citations. General mode does not
              attach private company records.
            </p>
            <p>
              AI cannot approve pricing, verify qualifications, authorize submission or submit a
              bid. It has no live web browsing; an unanswered question stays a question.
            </p>
          </div>
          <div>
            <h3>Questions to bring to the assistant</h3>
            <ul className={clean.recordList}>
              <li>Why might this opportunity fit our company?</li>
              <li>What could disqualify us?</li>
              <li>Which requirements still lack reviewed evidence?</li>
              <li>What tasks are overdue?</li>
              <li>What changed and requires another review?</li>
              <li>Create a response outline for this solicitation.</li>
            </ul>
            <p>
              Questions are limited to the records available to that mode. The outline command
              requires a selected pursuit and permission to create a draft; it prepares sections for
              your team to complete. The public demo uses fictional data and a separate general
              assistant.
            </p>
          </div>
        </section>
        <section id="questions" className={clean.questions} aria-labelledby="questions-title">
          <div>
            <span className={styles.eyebrow}>BUILT FOR ESTABLISHED BUSINESSES</span>
            <h2 id="questions-title">You can perform the work. Organize the bid effort.</h2>
            <p>
              For general and specialty contractors, energy and utility contractors, facilities and
              maintenance firms, public-works vendors, government suppliers and professional-service
              providers without a full internal capture, compliance and proposal department.
            </p>
            <h3>More than software. A structured bid-review process.</h3>
            <p>
              Founding-customer discussions are shaping software-supported contracting operations:
              onboarding, bid review and response coordination. Managed support is a pilot service
              under development; scope and commercial terms are not finalized.
            </p>
          </div>
          <div className={clean.faq}>
            <details>
              <summary>Is BidXchange a bid board?</summary>
              <p>
                BidXchange supports the work after you identify an opportunity: qualification
                review, estimating tasks, response preparation and submission coordination. Research
                currently searches available workspace records; portal shortcuts open the external
                platforms. Live source coverage depends on connector activation.
              </p>
            </details>
            <details>
              <summary>Does BidXchange determine whether we legally qualify?</summary>
              <p>
                No. It organizes requirements and evidence for human review. Final qualification
                determinations remain with authorized people and the issuing agency.
              </p>
            </details>
            <details>
              <summary>Does BidXchange write the entire proposal?</summary>
              <p>
                It can create a structured response outline, reuse approved company information,
                flag incomplete answers and export a working PDF or Word draft. Opportunity-specific
                technical content, pricing, representations and final review remain human
                responsibilities.
              </p>
            </details>
            <details>
              <summary>Does BidXchange submit the bid?</summary>
              <p>
                No. It prepares and tracks the response workflow. An authorized person follows the
                buyer’s official submission instructions and records the result in BidXchange. A
                submission record does not independently verify buyer receipt.
              </p>
            </details>
            <details>
              <summary>What will I see in the demo?</summary>
              <p>
                Sample company records and a fictional municipal energy retrofit opportunity. You
                can explore requirements and pursuit tasks without entering company data. Demo
                scores and eligibility examples do not assess your business or a live contract.
              </p>
            </details>
            <details id="security">
              <summary>Is our company information shared publicly?</summary>
              <p>
                No. Authenticated workspaces use organization membership and role-based access.
                Company records can be restricted, while pursuit requirements are shared with
                workspace members. Verification and bid authority remain with people.
              </p>
            </details>
            <details>
              <summary>Does BidXchange guarantee awards?</summary>
              <p>
                No. BidXchange does not guarantee eligibility, responsiveness, award, profitability
                or revenue.
              </p>
            </details>
            <details id="pricing">
              <summary>What does it cost?</summary>
              <p>
                Founding-customer plans are being finalized and may combine onboarding, software
                access and managed support. No prices or service commitments are published yet.
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
            <p>From a promising opportunity to a reviewed response.</p>
          </div>
          <nav aria-label="Footer access links">
            <Link href="/login">Sign In</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Use</Link>
          </nav>
        </div>
        <details id="legal-notices" className={clean.legal}>
          <summary>Privacy and terms are being finalized</summary>
          <p>
            Privacy Policy and Terms of Use drafts are available for review and are not yet
            effective. For questions about information you have shared, contact
            mrodriguez@oaisinc.com. Please do not send confidential records through the public
            contact channel.
          </p>
        </details>
        <div className={clean.footerBottom}>
          <span>© {new Date().getFullYear()} BidXchange</span>
          <span>Independent software. No government affiliation or guaranteed awards.</span>
        </div>
      </footer>
    </div>
  );
}

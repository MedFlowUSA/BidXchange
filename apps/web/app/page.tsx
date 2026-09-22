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
const title = 'BidXchange | California Contractor Bid Control';
const description =
  'Organize California contractor evidence, solicitation requirements, blockers and bid decisions. Prepare a reviewed response and record your team’s external submission.';
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
                <span /> CALIFORNIA PUBLIC WORKS & UTILITY CONTRACTS
              </div>
              <h1 id="hero-title">
                Know if the bid is worth the week.{' '}
                <span>Then build the response from what you already have.</span>
              </h1>
              <p className={styles.heroDescription}>
                BidXchange keeps company evidence next to notice requirements so your team can see
                blockers, assign the missing work, and review a response before anyone spends a week
                estimating the wrong job.
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
                Built for electrical, energy-efficiency, school-district, municipal, and utility
                field contractors in California.
              </p>
            </div>
            <div className={`${styles.heroVisual} ${clean.visual}`}>
              <ProductPreview />
            </div>
          </div>
        </section>
        <section className={clean.definition} aria-label="What BidXchange is">
          <p>
            <strong>One workspace from notice to reviewed response.</strong> Company evidence,
            notice requirements, estimating tasks, drafts, owners, and approvals live in the same
            record.
          </p>
          <p>
            <strong>Spend bid time on work you can actually deliver.</strong> Reuse what is already
            documented, surface what is missing, and give every open item an owner.
          </p>
        </section>
        <section id="capabilities" className={clean.workspace} aria-labelledby="capabilities-title">
          <div className={clean.sectionIntro}>
            <div>
              <span className={styles.eyebrow}>HOW IT HELPS YOU COMPETE</span>
              <h2 id="capabilities-title">Put your bid effort where it counts.</h2>
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
                title: 'Decide where to spend bid effort',
                text: 'Compare the notice to reviewed company codes and evidence before the estimator starts.',
              },
              {
                icon: FileSearch,
                number: '02',
                title: 'Prepare the response without starting over',
                text: 'Reuse reviewed company information, assign gaps, and assemble a working draft against the notice.',
              },
              {
                icon: ListChecks,
                number: '03',
                title: 'Keep the finish accountable',
                text: 'Track owners, versions, approvals, the named submitter, and a user-recorded submission record. Your team still submits through the buyer’s channel.',
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
        </section>
        <section id="company-passport" className={clean.passport} aria-labelledby="passport-title">
          <div>
            <span className={styles.eyebrow}>COMPANY PASSPORT</span>
            <h2 id="passport-title">
              Your next bid should start with what the company already is.
            </h2>
            <p>
              Licenses, registrations, insurance, bonding, territories, past performance, and
              operating capacity — with sources and renewal dates — so each new notice is checked
              against a living company record, not a scavenger hunt.
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
              <span className={styles.eyebrow}>THE WORKFLOW</span>
              <h2 id="workflow-title">From opportunity to submission</h2>
            </div>
          </div>
          <ol className={clean.steps}>
            {[
              [
                'Build your Company Passport',
                'Keep licenses, insurance, bonding and past projects ready for review.',
              ],
              [
                'Bring an opportunity worth investigating',
                'Capture the notice, source, scope and official deadline from the buyer’s portal.',
              ],
              [
                'Make the bid/no-bid decision',
                'Review requirements, evidence and blockers, then record a human decision.',
              ],
              [
                'Assign the work that makes the bid possible',
                'Give estimates, site visits, forms and evidence requests an owner and deadline.',
              ],
              [
                'Build and review the response',
                'Reuse reviewed records, add human-written technical answers and export a PDF or Word draft.',
              ],
              [
                'Approve, submit and record the result',
                'Approve a version, submit through the buyer’s channel and record the receipt.',
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
          <p className={clean.scopeNote}>
            Some intake and portal steps are still assisted or manual. BidXchange does not submit
            bids for you. <a href="#current-scope">Current scope</a>
          </p>
        </section>
        <section id="ai-assistance" className={clean.passport} aria-labelledby="ai-title">
          <div>
            <span className={styles.eyebrow}>ASK ABOUT THE WORK IN FRONT OF YOU</span>
            <h2 id="ai-title">Ask the next question that moves the bid.</h2>
            <p>
              Answers use authorized BidXchange records in workspace mode. The assistant cannot
              approve pricing, verify legal qualifications, authorize submission, or submit a bid.
              An unanswered question stays a question.
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
              General mode does not access private company records or browse the web. Response
              outlines require a selected pursuit and draft-creation permission.
            </p>
          </div>
        </section>
        <section id="questions" className={clean.questions} aria-labelledby="questions-title">
          <div>
            <span className={styles.eyebrow}>BUILT FOR CALIFORNIA FIELD CONTRACTORS</span>
            <h2 id="questions-title">You can perform the work. Organize the bid effort.</h2>
            <p>
              For electrical, energy-efficiency, utility and public-works teams without a full
              internal capture, compliance and proposal department.
            </p>
          </div>
          <div className={clean.faq}>
            <details>
              <summary>Is BidXchange a bid board?</summary>
              <p>
                No. It organizes pursuit of work you already found or imported. Research uses
                available records; portal shortcuts open the official external sites.
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
                No. It drafts an outline from reviewed records and exports a working PDF or Word
                document. Your team supplies technical answers, pricing and final review.
              </p>
            </details>
            <details>
              <summary>Does BidXchange submit the bid?</summary>
              <p>
                No. Your team submits through the buyer’s channel and records the result. BidXchange
                does not independently verify buyer receipt.
              </p>
            </details>
            <details>
              <summary>What will I see in the demo?</summary>
              <p>
                Fictional company records and a municipal energy retrofit opportunity. Explore
                requirements and tasks without entering company data; the demo does not assess your
                business or a live contract.
              </p>
            </details>
            <details id="security">
              <summary>Is our company information shared publicly?</summary>
              <p>
                No. Authenticated workspaces use organization membership and role-based access.
                Company records can be restricted by role.
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
                Start with a pilot walkthrough with Manuel. Commercial terms are not finalized; no
                prices or service commitments are published yet.
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
            delivery stay with your team and the buyer?s official channel.
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

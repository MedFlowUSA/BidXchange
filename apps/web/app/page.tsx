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
                <span /> CALIFORNIA PUBLIC WORKS, SCHOOL, MUNICIPAL, AND UTILITY CONTRACTS
              </div>
              <h1 id="hero-title">
                Review the requirements.{' '}
                <span>Prepare your bid in one place.</span>
              </h1>
              <p className={styles.heroDescription}>
                  Compare each contract’s requirements with your company’s licenses, insurance,
                  bonding and past projects. Identify missing information, assign tasks and prepare
                  a response for your team to review.
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
                Built for California electrical, energy-efficiency, and other field contractors
                bidding public works, school facilities, municipal, and utility projects.
              </p>
            </div>
            <div className={`${styles.heroVisual} ${clean.visual}`}>
              <ProductPreview />
            </div>
          </div>
        </section>
        <section id="who-we-are" className={clean.orientation} aria-label="What BidXchange is">
          <div>
            <span className={styles.eyebrow}>WHO WE ARE</span>
            <h2>
              Bid review for contractors who do the work — not a department that only writes
              proposals.
            </h2>
            <p>
              Most public-works teams do not have a capture office. They have a license book, a
              surety contact, a shared drive, and a deadline. BidXchange is the record between the
              notice and the submission: what the owner asked for, what the company can show, what
              is still missing, and who owns the next step. Your people still price, sign, and
              submit through the official channel.
            </p>
            <p className={clean.scopeNote}>
              Not a bid board. Not an eligibility engine. Not an auto-bidder. Not a guarantee of
              award.
            </p>
          </div>
          <div className={clean.purpose}>
            <div>
              <h3>Mission</h3>
              <p>
                Help contractors pursue work they can perform, and walk away from work they cannot,
                with the evidence in one place and the decision still in their hands.
              </p>
            </div>
            <div>
              <h3>Vision</h3>
              <p>
                Every notice a contractor opens should already stand next to their licenses,
                bonding, registrations, and past performance — so “can we do this?” is a recorded
                review, not a week of reconstruction.
              </p>
            </div>
          </div>
        </section>
        <section id="bid-cost" className={clean.pain} aria-labelledby="bid-cost-title">
          <h2 id="bid-cost-title">The costly bid is the one you never should have estimated.</h2>
          <ul>
            <li>
              A missing license class, registration, bond capacity, or mandatory walk can kill a job
              after takeoff is done.
            </li>
            <li>
              The same insurance certificates, project list, and key-person information get rebuilt
              because they live in inboxes and shared drives.
            </li>
            <li>“We should have passed” has no record when the next similar notice appears.</li>
          </ul>
        </section>
        <section id="capabilities" className={clean.workspace} aria-labelledby="capabilities-title">
          <div className={clean.sectionIntro}>
            <div>
              <span className={styles.eyebrow}>HOW IT HELPS YOU COMPETE</span>
              <h2 id="capabilities-title">Put your bid effort where it counts.</h2>
            </div>
            <p>
              Owners, estimators and bid coordinators can see what needs checking, who is handling
              it and when it is due.
            </p>
          </div>
          <div className={clean.features}>
            {[
              {
                icon: FolderCheck,
                number: '01',
                title: 'Pass early, on evidence',
                text: 'Review license, DIR registration, insurance and bonding requirements against your company records before committing estimating time.',
              },
              {
                icon: FileSearch,
                number: '02',
                title: 'Draft from what you already proved',
                text: 'Reuse reviewed license details and past-project records, assign missing information, and draft a response to the bid requirements.',
              },
              {
                icon: ListChecks,
                number: '03',
                title: 'Close the file when you submit',
                text: 'Track assigned tasks, draft versions, approvals and who will submit. Your team submits through the agency or utility’s required channel, then records the confirmation.',
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
            <h2 id="passport-title">Start the next bid with the company you already are.</h2>
            <p>
              The Company Passport is the reusable file: licenses and registrations, insurance and
              bonding, territories, past performance, capacity. Sources and renewal dates stay with
              the record. Each new notice is a review against that file — not a scavenger hunt.
            </p>
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
        <section id="workflow" className={clean.workspace} aria-labelledby="workflow-title">
          <div className={clean.sectionIntro}>
            <div>
              <span className={styles.eyebrow}>THE WORKFLOW</span>
              <h2 id="workflow-title">What a pursuit looks like in BidXchange</h2>
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
                'Review and sign off the requirements, then record your bid/no-bid decision and reasons.',
              ],
              [
                'Assign the work that makes the bid possible',
                'Assign estimating tasks, job walks, forms and document requests to a person with a due date.',
              ],
              [
                'Build and review the response',
                'Reuse reviewed records, add your technical answers and export a PDF or Word draft.',
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
              <li>Which bid requirements still need our review?</li>
              <li>Which requirements still lack reviewed evidence?</li>
              <li>What tasks are overdue?</li>
              <li>Summarize the requirements recorded for this bid.</li>
              <li>Create a response outline for this solicitation.</li>
            </ul>
            <p>
              General mode does not access private company records or browse the web. To create a
              response outline, open the relevant bid workspace; your role must allow draft
              creation.
            </p>
          </div>
        </section>
        <section id="questions" className={clean.questions} aria-labelledby="questions-title">
          <div>
            <span className={styles.eyebrow}>BUILT FOR CALIFORNIA FIELD CONTRACTORS</span>
            <h2 id="questions-title">For the team balancing bids with work in the field.</h2>
            <p>
              For contractor owners, estimators, bid coordinators and project managers handling
              public-works and utility bids alongside day-to-day operations. Start with one
              opportunity and the records your team already maintains.
            </p>
          </div>
          <div className={clean.faq}>
            <details>
              <summary>Is BidXchange a bid board?</summary>
              <p>
                No. It helps you review and prepare bids for work you already found or added.
                Research searches available records; portal shortcuts open official external sites.
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

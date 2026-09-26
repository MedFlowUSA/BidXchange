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
                <span /> BID PREPARATION FOR CALIFORNIA FIELD CONTRACTORS
              </div>
              <h1 id="hero-title">
                See what the bid requires. <span>Know what your company still needs.</span>
              </h1>
              <p className={styles.heroDescription}>
                Compare a bid’s license, insurance and bonding requirements with your company
                records. Assign someone to resolve each gap, track deadlines and prepare a PDF or
                Word response draft for your team to review.
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
                For electrical, energy-efficiency and construction teams bidding on public works,
                school facilities, municipal improvements and utility projects.
              </p>
            </div>
            <div className={`${styles.heroVisual} ${clean.visual}`}>
              <ProductPreview />
            </div>
          </div>
        </section>
        <section id="who-we-are" className={clean.orientation} aria-label="What BidXchange is">
          <div>
            <span className={styles.eyebrow}>WHAT BIDXCHANGE DOES</span>
            <h2>Bring the bid notice, company records and review checklist together.</h2>
            <p>
              Add a notice from PEPMA, a school district, a city or another procurement portal.
              Review its requirements alongside your company’s license details, insurance dates,
              bonding information and past projects. Keep the unanswered questions and assigned
              follow-ups with that bid.
            </p>
            <p className={clean.scopeNote}>
              Your team decides whether to bid, sets the price, signs the documents and submits
              through the buyer’s required channel.
            </p>
          </div>
          <div className={clean.purpose}>
            <div>
              <h3>For the owner deciding whether to bid</h3>
              <p>
                Review missing records and unresolved requirements before committing estimating
                time. Save the bid/no-bid decision and the reasons behind it.
              </p>
            </div>
            <div>
              <h3>For the team preparing the response</h3>
              <p>
                See who is requesting the bond, attending the job walk and collecting forms. Keep
                those tasks, due dates and draft versions with the bid.
              </p>
            </div>
          </div>
        </section>
        <section id="bid-cost" className={clean.pain} aria-labelledby="bid-cost-title">
          <h2 id="bid-cost-title">Check these details before you spend hours estimating.</h2>
          <ul>
            <li>
              Does the notice call for a license classification or DIR registration your team still
              needs to check?
            </li>
            <li>
              Has your surety confirmed the required bond, and do your insurance records need an
              update?
            </li>
            <li>Who will attend the mandatory job walk, and when are questions and bids due?</li>
          </ul>
        </section>
        <section id="capabilities" className={clean.workspace} aria-labelledby="capabilities-title">
          <div className={clean.sectionIntro}>
            <div>
              <span className={styles.eyebrow}>WHAT YOUR TEAM WORKS WITH</span>
              <h2 id="capabilities-title">
                A requirement checklist, a task list and a response draft.
              </h2>
            </div>
            <p>
              Each bid keeps its source requirements, supporting company records and outstanding
              work together.
            </p>
          </div>
          <div className={clean.features}>
            {[
              {
                icon: FolderCheck,
                number: '01',
                title: 'Review each requirement',
                text: 'Link a requirement to a company record. Mark what needs evidence, clarification or human review before committing estimating time.',
              },
              {
                icon: FileSearch,
                number: '02',
                title: 'Assign the missing information',
                text: 'Give the bond request, insurance update or job-walk confirmation an owner and a due date. Keep follow-up notes with the bid.',
              },
              {
                icon: ListChecks,
                number: '03',
                title: 'Prepare a draft for review',
                text: 'Create a response outline using reviewed company details. Add your technical answers and pricing, then export a PDF or Word draft for review and approval.',
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
              Keep license, insurance and project details ready for the next bid.
            </h2>
            <p>
              Your Company Passport is the company profile your team reuses across bids. Record
              license numbers, registration status, insurance expiration dates, bonding capacity and
              past projects. Keep the source and last-checked date with each supporting record so
              reviewers can see what needs updating.
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
              <h2 id="workflow-title">From adding a bid notice to recording your submission.</h2>
            </div>
          </div>
          <ol className={clean.steps}>
            {[
              [
                'Build your Company Passport',
                'Keep licenses, insurance, bonding and past projects ready for review.',
              ],
              [
                'Add the bid notice',
                'Paste the notice text and record its official link, scope, deadline and time zone.',
              ],
              [
                'Make the bid/no-bid decision',
                'Review and sign off the requirements, then record your bid/no-bid decision and reasons.',
              ],
              [
                'Assign tasks and due dates',
                'Assign estimating tasks, job walks, forms and document requests to a person with a due date.',
              ],
              [
                'Create and edit a response draft',
                'Reuse reviewed records, add your technical answers and export a PDF or Word draft.',
              ],
              [
                'Record your team’s submission',
                'Approve a specific draft version. Your team submits externally, then records the date and confirmation number in BidXchange.',
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
            You add the notice and check the official portal for updates. BidXchange does not submit
            bids for you. <a href="#current-scope">Current scope</a>
          </p>
        </section>
        <section id="ai-assistance" className={clean.passport} aria-labelledby="ai-title">
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
            <h3>Questions to ask BidBuddy</h3>
            <ul className={clean.recordList}>
              <li>Which requirements still lack reviewed evidence?</li>
              <li>What company records do we have for this license requirement?</li>
              <li>What tasks are overdue for this bid?</li>
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
            <span className={styles.eyebrow}>BEFORE YOU GET STARTED</span>
            <h2 id="questions-title">What to know before adding your first bid.</h2>
            <p>
              For contractor owners, estimators, bid coordinators and project managers handling
              public-works and utility bids. Start with a public notice, your company profile and
              the person responsible for the bid review.
            </p>
          </div>
          <div className={clean.faq}>
            <details>
              <summary>Is BidXchange a bid board?</summary>
              <p>
                No. It helps you review and prepare bids for work you already found or added.
                Research searches records available in BidXchange. Portal shortcuts open official
                external sites; they do not import every bid posted there.
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

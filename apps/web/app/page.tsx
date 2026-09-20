import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Search,
  ShieldCheck,
  Compass,
  ListChecks,
  BarChart3,
  Sparkles,
  LockKeyhole,
  UserCheck,
  FileCheck2,
  Layers,
  Clock3,
  Building2,
  HardHat,
  Zap,
  Wrench,
  Landmark,
  BriefcaseBusiness,
  Package,
  CircleCheck,
  MoveUpRight,
} from 'lucide-react';
import MarketingHeader from '../components/marketing-header';
import ProductPreview from '../components/product-preview';
import InterestPreview from '../components/interest-preview';
import { demoContactHref } from '../lib/operations-contact';
import { createSupabaseServer } from '../lib/supabase/server';
import styles from '../components/marketing.module.css';

const title = 'BidXchange | Find and Qualify Government Contract Opportunities';
const description =
  'BidXchange helps contractors discover public-sector opportunities, evaluate fit, identify disqualifiers, and organize compliant bid pursuits.';
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
        alt: 'BidXchange — We Find. We Qualify. You Win.',
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

const steps = [
  {
    name: 'Find',
    icon: Search,
    text: 'Monitor relevant procurement sources and organize potential opportunities.',
    now: 'Now: manual intake in the fictional demo. Live source monitoring is planned.',
  },
  {
    name: 'Qualify',
    icon: Compass,
    text: 'Compare solicitation requirements with your company’s verified capabilities.',
    now: 'Now: illustrative demo gates and scoring. Real company-aware matching is planned.',
  },
  {
    name: 'Pursue',
    icon: ListChecks,
    text: 'Bring requirements, documents, deadlines, tasks, reviews, and approvals into one place.',
    now: 'Now: pursuit workspace foundations and demo checklists. Full workflows are in development.',
  },
  {
    name: 'Learn',
    icon: BarChart3,
    text: 'Use decisions, submissions, wins, losses, and readiness gaps to inform your next move.',
    now: 'Now: basic pipeline reports and company-readiness facts. Outcome analytics are planned.',
  },
];

const capabilityGroups = [
  {
    name: 'Available in the current beta',
    label: 'Available',
    className: styles.available,
    intro: 'Try the demo. Begin company onboarding.',
    items: [
      [
        'Fatal-disqualifier checks',
        'Fictional demo only: failed or unknown eligibility blocks advancement.',
      ],
      [
        'Explainable fit scoring',
        'Fictional demo only: inspect illustrative factors and score breakdowns.',
      ],
      [
        'Company-readiness management',
        'Authenticated company facts, source notes, verification states, and missing-information lists.',
      ],
      [
        'Reports and pipeline visibility',
        'Basic recorded pipeline views, brief export, and role-permitted activity.',
      ],
    ],
  },
  {
    name: 'Foundation implemented',
    label: 'Foundation',
    className: styles.foundation,
    intro: 'The structure is here. Workflows are growing.',
    items: [
      [
        'Bid/no-bid decision support',
        'Decision sections and human-control boundaries. Live decisions are not enabled.',
      ],
      [
        'Pursuit workspaces',
        'Dedicated opportunity and pursuit pages. Full operational editing is in development.',
      ],
      [
        'Compliance matrices',
        'Structured sections and data foundation. The compliance review workflow is not enabled.',
      ],
      [
        'Document organization',
        'Private-library foundation. Uploads and downloads await validation and scanning.',
      ],
    ],
  },
  {
    name: 'Planned functionality',
    label: 'Planned',
    className: styles.planned,
    intro: 'Our direction, with clear limits today.',
    items: [
      [
        'Opportunity discovery',
        'Authorized live procurement-source integrations. Current demo intake is manual.',
      ],
      [
        'Company-aware matching',
        'Evaluate official requirements against a verified company profile.',
      ],
      [
        'Deadline and addendum tracking',
        'Source-linked change monitoring and reminders. Dates can be displayed today.',
      ],
      [
        'Grounded procurement assistant',
        'Evidence-linked assistance using company and solicitation records. No live AI answers today.',
      ],
    ],
  },
];

export default async function Home() {
  let signedIn = false;
  try {
    const supabase = await createSupabaseServer();
    if (supabase) {
      const { data, error } = await supabase.auth.getUser();
      signedIn = !error && !!data.user;
    }
  } catch {
    // The public homepage remains available when the identity provider is unavailable.
  }
  return (
    <div className={styles.site}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <MarketingHeader signedIn={signedIn} />
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.heroEyebrow}>
                <span /> A SMARTER PATH TO PUBLIC-SECTOR WORK
              </div>
              <h1 id="hero-title">
                Stop Searching.
                <br />
                Start Pursuing
                <br />
                <span>the Right Contracts.</span>
              </h1>
              <p className={styles.heroDescription}>
                BidXchange helps contractors find public-sector opportunities, determine which
                contracts fit their verified capabilities, identify potential disqualifiers, and
                manage the bid process from discovery through submission.
              </p>
              <p className={styles.phaseNote}>
                Our vision, delivered in phases. Explore the current beta below; live integrations,
                AI, and submission workflows are not enabled.
              </p>
              <div className={styles.heroActions}>
                <a href="#request-demo" className={styles.primary}>
                  Request a Demo <ArrowUpRight size={18} aria-hidden="true" />
                </a>
                <Link href="/dashboard?workspace=demo" className={styles.secondary}>
                  Explore the Demo <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
              <div className={styles.tagline}>
                We Find. <span>We Qualify.</span> You Win.
              </div>
              <p className={styles.smallNote}>
                Built for better pursuit decisions. No contract awards guaranteed.
              </p>
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.visualOrbit} aria-hidden="true" />
              <ProductPreview />
              <div className={styles.evidenceNote}>
                <span>
                  <ShieldCheck size={22} aria-hidden="true" />
                </span>
                <div>
                  <strong>Opportunity is only the beginning.</strong>
                  <p>Know what fits. Know what needs proof.</p>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.sectorStrip}>
            <p>DESIGNED FOR THE PUBLIC-SECTOR OPPORTUNITY LANDSCAPE</p>
            <ul>
              {[
                'Federal',
                'State',
                'Municipal',
                'School districts',
                'Utilities',
                'Public works',
                'Prime-contractor opportunities',
              ].map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <small>Independent software. No government affiliation or endorsement.</small>
          </div>
        </section>

        <section className={`${styles.section} ${styles.problem}`} aria-labelledby="problem-title">
          <div className={styles.problemIntro}>
            <span className={styles.eyebrow}>THE WORK BEFORE THE WORK</span>
            <h2 id="problem-title">
              You can do the job.
              <br />
              Finding the right one
              <br />
              <em>shouldn’t be a job.</em>
            </h2>
            <p>
              Your estimating time is valuable. Spend it on opportunities that deserve a closer
              look.
            </p>
          </div>
          <div className={styles.problemList}>
            {[
              [
                'Too many portals. Too little clarity.',
                'Opportunities are scattered across procurement systems, inboxes, and spreadsheets.',
                Layers,
              ],
              [
                'The right scope. The wrong requirements.',
                'Eligibility takes careful reading. A missed requirement can turn estimating effort into a dead end.',
                FileCheck2,
              ],
              [
                'One missed detail can change everything.',
                'Deadlines, job walks, addenda, forms, and approvals need a place to be tracked together.',
                Clock3,
              ],
              [
                'A capable team, stretched thin.',
                'Established contractors often lack a dedicated capture and proposal department.',
                Building2,
              ],
            ].map(([heading, copy, Icon]) => {
              const I = Icon as typeof Layers;
              return (
                <article key={heading as string}>
                  <I size={22} aria-hidden="true" />
                  <div>
                    <h3>{heading as string}</h3>
                    <p>{copy as string}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          id="how-it-works"
          className={styles.processSection}
          aria-labelledby="process-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>FROM OPPORTUNITY TO AN INFORMED DECISION</span>
              <h2 id="process-title">One connected pursuit process.</h2>
            </div>
            <p>
              A clear operating model for public-sector growth.
              <br />
              Built step by step, with people in control.
            </p>
          </div>
          <div className={styles.steps}>
            {steps.map((s, i) => (
              <article key={s.name}>
                <div className={styles.stepTop}>
                  <span>0{i + 1}</span>
                  <s.icon size={25} aria-hidden="true" />
                </div>
                <h3>
                  {s.name}
                  <ArrowUpRight size={20} aria-hidden="true" />
                </h3>
                <p>{s.text}</p>
                <div className={styles.stepStatus}>{s.now}</div>
              </article>
            ))}
          </div>
        </section>

        <section id="capabilities" className={styles.section} aria-labelledby="capabilities-title">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>BUILT WITH PURPOSE. CLEAR ABOUT PROGRESS.</span>
              <h2 id="capabilities-title">
                A contract desk.
                <br />
                Not another overflowing inbox.
              </h2>
            </div>
            <p>
              Know what you can use now—and what we’re building next. Demo capabilities are clearly
              separated from real company workflows.
            </p>
          </div>
          <div className={styles.capabilityGrid}>
            {capabilityGroups.map((g) => (
              <section key={g.label} className={styles.capabilityColumn} aria-label={g.name}>
                <div className={styles.capabilityIntro}>
                  <span className={`${styles.status} ${g.className}`}>{g.name}</span>
                  <p>{g.intro}</p>
                </div>
                {g.items.map(([name, text]) => (
                  <article key={name}>
                    <CircleCheck size={18} aria-hidden="true" />
                    <div>
                      <h3>{name}</h3>
                      <p>{text}</p>
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </section>

        <section className={styles.assistantSection} aria-labelledby="assistant-title">
          <div>
            <span className={styles.darkEyebrow}>
              <Sparkles size={16} aria-hidden="true" /> THE BIDXCHANGE ASSISTANT · PLANNED
            </span>
            <h2 id="assistant-title">
              Better questions.
              <br />
              <span>Answers with evidence.</span>
            </h2>
            <p>
              The planned procurement assistant will ground answers in verified company information
              and official solicitation records, so your team can review the source behind a
              recommendation.
            </p>
            <strong className={styles.aiDisclosure}>
              Coming in a later phase — no live AI analysis enabled.
            </strong>
          </div>
          <div className={styles.questionPanel}>
            <div className={styles.questionPanelHeader}>
              <Image
                src="/brand/bidxchange-icon.png?v=2"
                width="32"
                height="32"
                alt=""
                loading="lazy"
              />
              <span>Ask BidXchange</span>
              <small>Preview</small>
            </div>
            <p>QUESTIONS WORTH ASKING</p>
            {[
              'What new contracts fit our company today?',
              'Why does this opportunity match?',
              'What could disqualify us?',
              'What changed in the latest addendum?',
              'Which documents and signatures are required?',
            ].map((q) => (
              <div key={q} className={styles.exampleQuestion}>
                <span>{q}</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </div>
            ))}
            <div className={styles.questionFooter}>
              <LockKeyhole size={14} aria-hidden="true" /> Illustrative questions. No answers are
              generated.
            </div>
          </div>
        </section>

        <section id="who-its-for" className={styles.section} aria-labelledby="audience-title">
          <div className={styles.centerHeading}>
            <span className={styles.eyebrow}>YOU BRING THE CAPABILITY</span>
            <h2 id="audience-title">
              Built for businesses ready
              <br />
              to do the work.
            </h2>
            <p>
              For established companies with the expertise to perform—and without a full internal
              government-contracting department.
            </p>
          </div>
          <div className={styles.audiences}>
            {[
              ['General contractors', 'From renovations to complex building projects.', HardHat],
              ['Specialty contractors', 'A focused trade. A clearer pursuit strategy.', Wrench],
              [
                'Energy and utility contractors',
                'Efficiency, infrastructure, and program delivery.',
                Zap,
              ],
              [
                'Facilities and maintenance firms',
                'Supporting the places communities rely on.',
                Building2,
              ],
              [
                'Public works vendors',
                'The services and infrastructure behind daily life.',
                Landmark,
              ],
              [
                'Professional-service providers',
                'Specialist expertise for public-sector needs.',
                BriefcaseBusiness,
              ],
              [
                'Suppliers pursuing government business',
                'Products and materials matched to real requirements.',
                Package,
              ],
            ].map(([name, copy, Icon]) => {
              const I = Icon as typeof HardHat;
              return (
                <article key={name as string}>
                  <I size={24} aria-hidden="true" />
                  <h3>{name as string}</h3>
                  <p>{copy as string}</p>
                </article>
              );
            })}
          </div>
          <div className={styles.managedService}>
            <div className={styles.managedMark} aria-hidden="true">
              <MoveUpRight size={42} />
            </div>
            <div>
              <span className={styles.eyebrow}>SOFTWARE + EXPERT-SUPPORTED OPERATIONS</span>
              <h3>More than a bid board.</h3>
              <p>
                BidXchange is being built as a technology-powered outsourced government-contracting
                department—not another database that sends contractors hundreds of irrelevant
                listings.
              </p>
              <p>
                Designed to reduce noise, identify actionable opportunities, and help organize
                compliant pursuits. Managed-service scope is being developed; contract awards are
                never guaranteed.
              </p>
            </div>
          </div>
        </section>

        <section id="security" className={styles.securitySection} aria-labelledby="security-title">
          <div>
            <span className={styles.eyebrow}>CONFIDENCE COMES FROM CONTROL</span>
            <h2 id="security-title">
              Your company.
              <br />
              Your information.
              <br />
              <span>Your decisions.</span>
            </h2>
            <p>
              A good pursuit starts with trustworthy information. Important claims and actions need
              evidence, ownership, and a human decision.
            </p>
            <Link href="/login" className={styles.inlineLink}>
              Existing user? Sign in <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.securityGrid}>
            {[
              [
                'Organization-level separation',
                'Authenticated workspaces use organization-scoped access controls.',
                LockKeyhole,
              ],
              [
                'Access with a defined role',
                'Roles limit who can view information and make important changes.',
                UserCheck,
              ],
              [
                'Claims need human verification',
                'Company facts carry verification states and source references.',
                ShieldCheck,
              ],
              [
                'Information with provenance',
                'Source-supported records are the basis for review; no live feeds are connected today.',
                FileCheck2,
              ],
              [
                'People authorize commitments',
                'Pricing and submission authorization remain human-controlled. No automatic bid submission.',
                ListChecks,
              ],
              [
                'A record of important changes',
                'Administrative changes are recorded for authorized review.',
                Layers,
              ],
            ].map(([name, text, Icon]) => {
              const I = Icon as typeof LockKeyhole;
              return (
                <article key={name as string}>
                  <I size={23} aria-hidden="true" />
                  <h3>{name as string}</h3>
                  <p>{text as string}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="pricing" className={styles.pricingSection} aria-labelledby="pricing-title">
          <div>
            <span className={styles.darkEyebrow}>EARLY ACCESS. A THOUGHTFUL FIT.</span>
            <h2 id="pricing-title">
              The right support
              <br />
              for your next stage.
            </h2>
            <p>Founding customer plans are being finalized.</p>
            <p>
              Pricing may combine onboarding, managed service, and software access. Final plans,
              availability, and commercial terms have not been established.
            </p>
          </div>
          <div className={styles.pricingCard}>
            <span className={styles.pricingLabel}>FOUNDING CUSTOMER PLANS</span>
            <h3>Start with your business.</h3>
            <ul>
              <li>
                <Check size={17} aria-hidden="true" /> Company readiness and onboarding
              </li>
              <li>
                <Check size={17} aria-hidden="true" /> Software access for your team
              </li>
              <li>
                <Check size={17} aria-hidden="true" /> Managed support suited to your needs
              </li>
            </ul>
            <p>Potential plan components—not current service commitments.</p>
            <a href="#request-demo" className={styles.goldButton}>
              Discuss Your Needs <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <small>Contact Manuel Rodriguez for a walkthrough</small>
          </div>
        </section>

        <InterestPreview />
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            <Link href="/" aria-label="BidXchange home">
              <Image
                src="/brand/bidxchange-logo.png?v=2"
                width="2172"
                height="724"
                sizes="185px"
                alt="BidXchange"
                loading="lazy"
              />
            </Link>
            <p>We Find. We Qualify. You Win.</p>
          </div>
          <nav aria-label="Footer product links">
            <strong>Product</strong>
            <a href="#capabilities">Capabilities</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#security">Security</a>
          </nav>
          <nav aria-label="Footer access links">
            <strong>Get started</strong>
            <a href="#request-demo">Request a Demo</a>
            <Link href="/dashboard?workspace=demo">Explore the Demo</Link>
            <Link href="/login">Sign In</Link>
          </nav>
          <nav aria-label="Footer company links">
            <strong>Company</strong>
            <a href="#legal-notices">Privacy — pending</a>
            <a href="#legal-notices">Terms — pending</a>
            <a href={demoContactHref}>Contact Manuel</a>
          </nav>
        </div>
        <section id="legal-notices" className={styles.legalNotices} aria-labelledby="legal-title">
          <h2 id="legal-title">Before public access opens</h2>
          <p>
            The full Privacy notice and Terms of service are being finalized; these links are not
            published legal terms. For a demo or a question about information you have shared,
            contact Manuel Rodriguez at mrodriguez@oaisinc.com. Please do not send confidential
            company records through the public contact channel.
          </p>
        </section>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} BidXchange. All rights reserved.</span>
          <span>Not affiliated with or endorsed by any government agency.</span>
        </div>
      </footer>
    </div>
  );
}

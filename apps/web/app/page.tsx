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
const title = 'BidXchange | Find and Qualify Government Contract Opportunities';
const description =
  'Organize company evidence, public-sector opportunities, requirements, and pursuit tasks in one focused workspace with BidXchange.';
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
                <span /> YOUR PUBLIC-SECTOR CONTRACT DESK
              </div>
              <h1 id="hero-title">
                Your next contract.
                <br />
                <span>A clearer path.</span>
              </h1>
              <p className={styles.heroDescription}>
                Bring your company evidence, opportunities, and pursuit tasks into one focused
                workspace. Know what needs attention before you commit to a bid.
              </p>
              <div className={styles.heroActions}>
                <a href="#request-demo" className={styles.primary}>
                  Request a Demo <ArrowUpRight size={18} aria-hidden="true" />
                </a>
                <Link href="/dashboard?workspace=demo" className={styles.secondary}>
                  Explore the Demo <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
              <p className={clean.heroNote}>
                For contractors, service providers, and suppliers pursuing public-sector work.
              </p>
            </div>
            <div className={`${styles.heroVisual} ${clean.visual}`}>
              <ProductPreview />
            </div>
          </div>
        </section>
        <section id="capabilities" className={clean.workspace} aria-labelledby="capabilities-title">
          <div className={clean.sectionIntro}>
            <div>
              <span className={styles.eyebrow}>LESS SCATTERED WORK. MORE CLARITY.</span>
              <h2 id="capabilities-title">
                Keep the important
                <br />
                details together.
              </h2>
            </div>
            <p>
              A practical starting point for teams that have the expertise to do the job and need a
              better way to organize the pursuit.
            </p>
          </div>
          <div className={clean.features}>
            {[
              {
                icon: FolderCheck,
                number: '01',
                title: 'Know your company.',
                text: 'Capture capabilities, registrations, and supporting facts with sources and owners. See what needs human review.',
              },
              {
                icon: FileSearch,
                number: '02',
                title: 'Keep the source in sight.',
                text: 'Record an opportunity with its original notice, buyer, and deadline. Build a useful shortlist from the work you find.',
              },
              {
                icon: ListChecks,
                number: '03',
                title: 'Make the next step clear.',
                text: 'Open a pursuit, cite its requirements, flag missing information, and assign tasks so the next action has an owner.',
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
          <div className={clean.availability}>
            <span>AVAILABLE TODAY</span>
            <p>
              Company records, manual opportunity intake, requirements, and tasks. Live procurement
              feeds, AI answers, and proposal submission are not enabled.
            </p>
          </div>
        </section>
        <section id="questions" className={clean.questions} aria-labelledby="questions-title">
          <div>
            <span className={styles.eyebrow}>A FEW THINGS TO KNOW</span>
            <h2 id="questions-title">
              Clear expectations.
              <br />
              From the start.
            </h2>
          </div>
          <div className={clean.faq}>
            <details>
              <summary>Who is BidXchange for?</summary>
              <p>
                Established contractors, specialty trades, facilities teams, professional-service
                firms, and suppliers that want a more organized approach to government
                opportunities.
              </p>
            </details>
            <details>
              <summary>What will I see in the demo?</summary>
              <p>
                A fictional company and sample opportunities that let you explore the workflow. Demo
                scores and eligibility examples are illustrative, not assessments of your business
                or live contracts.
              </p>
            </details>
            <details id="security">
              <summary>Who can access our company information?</summary>
              <p>
                Authenticated workspaces use organization membership and role-based access. Company
                records can be restricted, while pursuit requirements are shared with workspace
                members. Verification and bid authority remain with people.
              </p>
            </details>
            <details id="pricing">
              <summary>How does pricing work?</summary>
              <p>
                Early-access plans and managed support are being developed. A walkthrough helps us
                understand your team and discuss fit; pricing and service terms are not yet
                finalized.
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
            <p>We Find. We Qualify. You Win.</p>
          </div>
          <nav aria-label="Footer access links">
            <Link href="/login">Sign In</Link>
            <a href="#legal-notices">Privacy — pending</a>
            <a href="#legal-notices">Terms — pending</a>
          </nav>
        </div>
        <details id="legal-notices" className={clean.legal}>
          <summary>Privacy and terms are being finalized</summary>
          <p>
            Published legal terms are not yet available. For questions about information you have
            shared, contact mrodriguez@oaisinc.com. Please do not send confidential records through
            the public contact channel.
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

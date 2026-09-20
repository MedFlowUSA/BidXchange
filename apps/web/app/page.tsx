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
  'Track solicitation requirements, company registrations, bid deadlines, and assigned tasks with BidXchange. Prepare your team before committing to a government bid.';
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
                Before you bid,
                <br />
                <span>know what’s required.</span>
              </h1>
              <p className={styles.heroDescription}>
                A bid can hinge on a license, a registration, or a deadline. Record what the notice
                requires, what your company can document, and who needs to follow up.
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
                For teams bidding on public works, facility services, and government supply
                contracts.
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
              <span className={styles.eyebrow}>FROM SOLICITATION TO ASSIGNED WORK</span>
              <h2 id="capabilities-title">
                The notice. The evidence.
                <br />
                The work still to do.
              </h2>
            </div>
            <p>
              Give your estimator, company administrator, and bid lead a place to record the
              requirements and track unanswered questions before preparing a response.
            </p>
          </div>
          <div className={clean.features}>
            {[
              {
                icon: FolderCheck,
                number: '01',
                title: 'Document your qualifications.',
                text: 'Record licenses, SAM registration, insurance, and past project experience. Keep source references, expiration dates, and review status with each company record.',
              },
              {
                icon: FileSearch,
                number: '02',
                title: 'Start with the actual notice.',
                text: 'Save the issuing agency, solicitation number, source link, and bid deadline with its time zone. Give the team a reference to check against the original notice.',
              },
              {
                icon: ListChecks,
                number: '03',
                title: 'Put a name on the follow-up.',
                text: 'Cite the section requiring a bid bond or site visit. Flag missing information, assign someone to investigate, and set a task deadline. The bid decision stays with your team.',
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
            <span className={styles.eyebrow}>BEFORE YOU TRY IT</span>
            <h2 id="questions-title">
              Your team.
              <br />
              Your bid process.
            </h2>
          </div>
          <div className={clean.faq}>
            <details>
              <summary>Who is BidXchange for?</summary>
              <p>
                Contractors, specialty trades, facilities firms, professional-service providers, and
                suppliers preparing government bids—especially when estimating, collecting company
                records, and coordinating the response fall to the same small team.
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
                Plans are not priced yet. Tell us who prepares your bids, how many notices you
                review, and where the work gets held up. We’ll discuss software access and potential
                support; service scope and commercial terms are still being developed.
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

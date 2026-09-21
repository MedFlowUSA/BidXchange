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
const title = 'BidXchange | A Clearer Decision Before You Bid';
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
                <span /> FOR THE PEOPLE WHO PUT THE BID TOGETHER
              </div>
              <h1 id="hero-title">
                A bid worth pursuing.
                <br />
                <span>A decision you can defend.</span>
              </h1>
              <p className={styles.heroDescription}>
                Before your estimator spends a week on the numbers, get the requirements, supporting
                records, and unanswered questions in one place. Know what still needs checking—and
                who is on it.
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
                Public works · Specialty trades · Facility services · Government supply
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
              <span className={styles.eyebrow}>LESS CHASING. A CLEARER BID REVIEW.</span>
              <h2 id="capabilities-title">
                Don’t start from scratch
                <br />
                with every solicitation.
              </h2>
            </div>
            <p>
              Your company records belong beside the requirements they support. The open questions
              belong with the people who can answer them.
            </p>
          </div>
          <div className={clean.features}>
            {[
              {
                icon: FolderCheck,
                number: '01',
                title: '“Do we have the evidence?”',
                text: 'Keep license details, insurance dates, registrations, and past project experience in your Company Passport. See what has been reviewed and what needs another look.',
              },
              {
                icon: FileSearch,
                number: '02',
                title: '“What does this bid require?”',
                text: 'Record the deadline and cite the requirements that matter: the bid bond, the mandatory walk-through, the experience threshold. Review company evidence against each one.',
              },
              {
                icon: ListChecks,
                number: '03',
                title: '“Who is closing the gaps?”',
                text: 'Assign the unanswered questions. Record the reason to pursue—or pass. When reviewed information changes, bring the decision back for another look.',
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
            <span>WORKING SOFTWARE. HUMAN DECISIONS.</span>
            <p>
              Company Passport, manual opportunity intake, evidence reviews, tasks, and bid/no-bid
              decisions. AI assistance is available in enabled workspaces. Live procurement feeds
              and proposal submission are not enabled.
            </p>
          </div>
        </section>
        <section id="questions" className={clean.questions} aria-labelledby="questions-title">
          <div>
            <span className={styles.eyebrow}>BEFORE YOU TRY IT</span>
            <h2 id="questions-title">
              Before you bring
              <br />
              your next bid.
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
            <p>The requirements. The evidence. The decision.</p>
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

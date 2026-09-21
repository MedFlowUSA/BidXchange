import Link from 'next/link';
import { legalOperator, legalVersion, type LegalDocument } from '../lib/legal-documents';
import styles from './legal-document.module.css';

export default function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="BidXchange home">
          BidXchange
        </Link>
        <nav aria-label="Legal navigation">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
          <Link href="/login">Sign In</Link>
        </nav>
      </header>
      <main id="legal-content" className={styles.main}>
        <p className={styles.eyebrow}>BIDXCHANGE LLC · LEGAL</p>
        <h1>{document.title}</h1>
        <aside className={styles.draft} aria-label="Document status">
          <strong>Draft for review — not yet effective.</strong>
          <p>
            Prepared <time dateTime={legalVersion}>September 21, 2026</time>. These documents remain
            subject to business and legal review.
          </p>
        </aside>
        <p className={styles.introduction}>{document.introduction}</p>
        <nav className={styles.contents} aria-label="On this page">
          <h2>On this page</h2>
          <ol>
            {document.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title.replace(/^\d+\. /, '')}</a>
              </li>
            ))}
          </ol>
        </nav>
        {document.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-heading`}
            className={styles.section}
          >
            <h2 id={`${section.id}-heading`}>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        {document.title === 'Privacy Policy' && (
          <p>
            Provider reference:{' '}
            <a href="https://developers.openai.com/api/docs/guides/your-data">
              OpenAI API data controls and retention
            </a>
            .
          </p>
        )}
      </main>
      <footer className={styles.footer}>
        <strong>{legalOperator.name}</strong>
        <p>{legalOperator.location}</p>
        <a href={`mailto:${legalOperator.email}`}>{legalOperator.email}</a>
        <p>
          <Link href="/">Return to BidXchange</Link>
        </p>
      </footer>
    </div>
  );
}

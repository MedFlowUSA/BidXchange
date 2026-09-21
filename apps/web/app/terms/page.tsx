import type { Metadata } from 'next';
import LegalDocumentPage from '../../components/legal-document';
import { termsOfUse } from '../../lib/legal-documents';

export const metadata: Metadata = {
  title: 'Terms of Use (Draft) | BidXchange',
  description:
    'Draft terms for BidXchange LLC: workspace use, company content, AI assistance and human bid responsibility.',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://bidxapp.vercel.app/terms' },
};

export default function TermsPage() {
  return <LegalDocumentPage document={termsOfUse} />;
}

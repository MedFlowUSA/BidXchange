import type { Metadata } from 'next';
import LegalDocumentPage from '../../components/legal-document';
import { privacyPolicy } from '../../lib/legal-documents';

export const metadata: Metadata = {
  title: 'Privacy Policy (Draft) | BidXchange',
  description:
    'Draft privacy policy for BidXchange LLC: company records, AI processing and privacy requests.',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://bidxapp.vercel.app/privacy' },
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={privacyPolicy} />;
}

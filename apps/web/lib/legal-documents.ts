// Drafts: publication requires confirming the operational commitments in docs/legal-review.md.
export const legalOperator = {
  name: 'BidXchange LLC',
  location: 'Redlands, California 92373, United States',
  email: 'mrodriguez@oaisinc.com',
  contact: 'Manuel Rodriguez',
};
export const legalVersion = '2026-09-21';
export type LegalSection = { id: string; title: string; paragraphs: string[]; items?: string[] };
export type LegalDocument = { title: string; introduction: string; sections: LegalSection[] };

export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  introduction:
    'This policy describes how BidXchange LLC handles information through the BidXchange website, demonstration and government-contracting workspace. It covers visitors, people who contact us and users of company workspaces.',
  sections: [
    {
      id: 'operator',
      title: '1. Who handles your information',
      paragraphs: [
        'BidXchange LLC operates BidXchange from Redlands, California 92373, United States. Contact Manuel Rodriguez at mrodriguez@oaisinc.com for privacy questions or requests. This is our business location; contact us by email to arrange postal correspondence.',
        'For account administration, service security and business inquiries, BidXchange determines how information is used. When a company provides workspace records about employees, references or other people, that company also controls the information it enters and the people it authorizes. Contact your organization administrator about those records; you may also contact us for help. The parties’ specific responsibilities may be addressed in a separate written agreement.',
      ],
    },
    {
      id: 'collected',
      title: '2. Information we collect',
      paragraphs: [
        'We collect information you provide, information authorized users enter about others, and technical information needed to operate the service. Categories include:',
      ],
      items: [
        'Account and contact information: name, work email, organization membership, role and sign-in/session information. The current user-facing sign-in flow uses email links.',
        'Business inquiries: your name, company, work email, trade, geographic market, agencies of interest, opportunity links, message and correspondence. Email contact links open your email application; a message is sent only when you send it there. If an online request form is enabled, it saves the submitted contact details and permission to respond.',
        'Workspace records: company identity and contact information, licenses, registrations, certifications, insurance, bonding, project references, personnel, capacity and other evidence your organization enters. These can include business contact information about other people.',
        'Pursuit records: opportunities, cited requirements, tasks, deadlines, notes, response drafts, approvals, named submitters, submission references, follow-up records and audit history identifying the user and action.',
        'File references: document names, external storage references and file hashes recorded during a response review. The current final-file hashing process runs in your browser and does not upload those file bytes. Private document uploads are not currently enabled.',
        'AI information: the question you submit, the generated response, and, in Workspace records mode, selected authorized records used to answer it. General questions mode and the public demo do not automatically attach private company records; information you type into a question is still sent for processing.',
        'Technical and usage information: browser/device and request information, IP addresses processed by hosting/security providers, session cookies, request identifiers, timestamps, usage counts, model/timing/token metadata, feedback selections and security logs. Some application abuse controls store keyed hashes of identifiers or prompts rather than the original values; those hashes are not described as anonymous.',
      ],
    },
    {
      id: 'purposes',
      title: '3. How we use information',
      paragraphs: [
        'We use information to authenticate users, apply organization and role permissions, maintain company and pursuit records, generate requested working drafts and AI assistance, preserve review history, respond to inquiries, troubleshoot failures and protect against abuse. We also use operational information to administer usage limits, understand service reliability, comply with applicable obligations and resolve disputes.',
        'Verification and approval labels describe recorded human actions. They do not establish that a record is correct or that your company legally qualifies for an opportunity. We do not use the assistant to make autonomous bid, pricing or submission decisions.',
      ],
    },
    {
      id: 'sharing',
      title: '4. Who receives information',
      paragraphs: [
        'Authorized members of your organization can access workspace information according to their roles and the record’s visibility. Shared pursuit requirements, drafts and approval/submission histories may be available to other active members. Restricted company facts have narrower access. Choosing a visibility setting applies to the record, including its sources and notes.',
        'We use Vercel for application hosting, Supabase for authentication and database services, and OpenAI for enabled AI requests. These providers process the information needed for their service. Business email correspondence is also handled through email providers. Authorized support and operations personnel may access information as needed to operate, support and protect the service.',
        'We may disclose information when reasonably necessary to comply with lawful requests, protect rights and safety, investigate misuse or handle a business transaction such as a merger or transfer, subject to applicable protections. We may also disclose information at your direction, including when you download or share a response package.',
        'The current application has no advertising-pixel, data-sale or cross-site behavioral-advertising integration. This statement does not mean that essential hosting, authentication, security and AI providers receive no information.',
        'Links to procurement portals or external evidence locations lead to services governed by their own practices. Information your team downloads, copies or submits outside BidXchange is also subject to your organization’s handling and the recipient’s policies.',
      ],
    },
    {
      id: 'ai',
      title: '5. AI processing and conversation storage',
      paragraphs: [
        'When you submit an AI question, it is sent to OpenAI. Workspace records mode can also send selected records permitted by your role and the application’s disclosure rules. General mode and the public demo do not query private company records. Do not put passwords, banking details, full tax identifiers, sensitive personal identifiers or information you are not authorized to disclose into a prompt.',
        'The application does not save a conversation transcript as a shared database history. Displayed conversations are held in the current tab’s memory and can be cleared; reloading or leaving the relevant session removes that display state. Usage metadata, keyed prompt digests, feedback and security/audit records are handled separately and are not erased by clearing the conversation.',
        'AI requests disable response storage for later API retrieval. That setting is not a promise of zero provider retention: provider security, abuse-monitoring and other applicable retention controls may still apply. See the linked OpenAI data controls for its current practices. BidXchange does not claim to have provider Zero Data Retention approval.',
      ],
    },
    {
      id: 'cookies',
      title: '6. Cookies, local storage and tracking choices',
      paragraphs: [
        'Authentication uses cookies to maintain and refresh your session. The public demo assistant uses a security cookie with a one-day maximum age and abuse controls. The fictional demo saves edits in browser local storage, and workspace guidance stores a dismissal preference on your device. Avoid entering real confidential information into the fictional demo.',
        'You can clear cookies and site storage in your browser, reset the fictional demo or clear the assistant display. Clearing local storage does not delete company records, audit history, messages sent by email or provider logs. Blocking essential cookies can prevent sign-in or AI-demo access.',
        'The current application does not change its behavior in response to browser Do Not Track signals. It does not include cross-site advertising trackers. Hosting, authentication and AI providers still process operational data as described above. Contact us about privacy choices, including any rights that apply to you under local law.',
      ],
    },
    {
      id: 'retention',
      title: '7. Retention and deletion',
      paragraphs: [
        'We retain account, company and pursuit information for the purposes described here, considering the active customer relationship, review and audit needs, security, disputes and applicable legal obligations. Requesting account closure or removing a member does not automatically erase organization-owned records or the history of their actions.',
        'Approval, submission and audit histories are designed to preserve an attributed record and are not editable or deletable through ordinary user controls. We review deletion requests individually, including whether information must be retained or can be removed, restricted or otherwise addressed. A universal automated deletion schedule for all workspace records is not currently enabled.',
        'The public-demo AI usage system removes usage entries older than 14 days during later quota reservations; this is not an immediate scheduled deletion guarantee. Other usage metadata, email, provider logs and backups follow their operational retention arrangements. Clearing the interface does not erase these copies.',
      ],
    },
    {
      id: 'requests',
      title: '8. Your requests and choices',
      paragraphs: [
        'You can ask about access to, correction of or deletion of personal information by emailing mrodriguez@oaisinc.com with “Privacy request” in the subject. Describe your relationship to BidXchange and the request without including sensitive documents or credentials. We may need to verify your identity and authority using proportionate information. An organization administrator may need to participate when the request concerns company-controlled records.',
        'Depending on your location and the laws applicable to our processing, rights may include access, correction, deletion, a portable copy, restriction or objection, withdrawal of consent, an authorized-agent request, and choices about sale, sharing or certain other processing. We will address applicable requests and explain any limitation or denial, including available appeal or complaint options. We will not unlawfully discriminate against you for exercising an applicable privacy right.',
        'California residents can contact us using the same channel. This policy does not represent that every provision of the California Consumer Privacy Act applies to BidXchange; applicability depends on statutory criteria. Nothing here limits rights granted by applicable law.',
      ],
    },
    {
      id: 'security',
      title: '9. Security and processing locations',
      paragraphs: [
        'The service uses authenticated sessions, organization-scoped database access rules, role restrictions and protected server-side credentials. These controls reduce risk but cannot guarantee absolute security. Protect access to your email account and devices, review workspace membership and report suspected unauthorized access promptly.',
        'Our providers may process information in the United States and other locations where they operate. Do not assume that the service provides a particular national data-residency guarantee or certification. Contact us before using it for information requiring special contractual, regulatory or location controls.',
      ],
    },
    {
      id: 'children',
      title: '10. Children and sensitive information',
      paragraphs: [
        'BidXchange is a business service intended for adults, not children under 18. We do not knowingly seek children’s personal information. Contact us if you believe a child has provided it.',
        'The current service is not offered as an approved repository for classified information, controlled unclassified information, protected health information or other specially regulated records requiring controls not agreed in writing. Do not enter credentials, full tax identifiers or bank-account details.',
      ],
    },
    {
      id: 'changes',
      title: '11. Policy changes and contact',
      paragraphs: [
        'We will identify the effective date of a published policy and update its date when changes take effect. Material changes will be communicated through the service or another appropriate channel, with additional notice or consent where required. New wording will not override legal restrictions on how previously collected information may be used.',
        'Privacy contact: Manuel Rodriguez, BidXchange LLC, Redlands, California 92373, United States; mrodriguez@oaisinc.com.',
      ],
    },
  ],
};

export const termsOfUse: LegalDocument = {
  title: 'Terms of Use',
  introduction:
    'These proposed Terms describe use of the BidXchange website, fictional demonstration and business workspace operated by BidXchange LLC. They are a draft for review and do not take effect merely because you view this draft.',
  sections: [
    {
      id: 'agreement',
      title: '1. The service and your agreement',
      paragraphs: [
        'In these Terms, “BidXchange,” “we” and “us” mean BidXchange LLC, located in Redlands, California 92373, United States. “You” means the person using the service and, when that person is authorized to accept terms for an organization, that organization.',
        'You must be at least 18 and authorized to access the organization and information you use. Once these Terms are finalized and presented for acceptance, access is subject to the accepted Terms and any applicable written customer agreement. A separate signed agreement controls an inconsistency concerning the services it covers. Publication of this draft is not recorded acceptance.',
      ],
    },
    {
      id: 'scope',
      title: '2. What BidXchange provides',
      paragraphs: [
        'BidXchange organizes company evidence, solicitation requirements, assigned work, human bid decisions, response drafts and review/submission records. Features may depend on your role, organization activation, service availability and usage limits. Demonstration companies, scores and opportunities are fictional and do not assess a real company or contract.',
        'The service is independent of government agencies and procurement portals. It does not guarantee complete source coverage, legal eligibility, responsiveness, profitability, awards or revenue. Current opportunity intake is manual; implemented connector code does not establish live coverage. Private file uploads are not currently enabled.',
      ],
    },
    {
      id: 'human-review',
      title: '3. Your team remains responsible for bids',
      paragraphs: [
        'Your authorized team must read the official notice and amendments, identify all requirements, verify company facts, assess eligibility, prepare pricing and technical content, obtain required signatures and approvals, and meet the buyer’s submission instructions and deadline. The issuing agency’s official requirements control.',
        'Working PDF and Word exports, AI outlines, readiness counts and evidence-review labels are review aids. They are not completed legal certifications, electronic signatures or authorization to make a commitment. A saved approval records a human action against a version; it does not replace that person’s authority or responsibility.',
        'BidXchange does not automatically submit bids. Your team performs portal delivery and records the outcome. Submission records and file hashes do not independently prove buyer receipt, retrieve external files or establish the legal effect of a signature. Keep official receipts and the final delivered files in your authorized records.',
      ],
    },
    {
      id: 'accounts',
      title: '4. Accounts and organization access',
      paragraphs: [
        'Use accurate business information and protect your email account, sign-in links, sessions and devices. Do not share credentials or access another organization without permission. Notify us of suspected account misuse.',
        'Organization administrators manage membership and permissions. Your organization is responsible for granting appropriate roles, removing access when no longer needed and reviewing visibility before entering company or third-party information. Losing membership can end your access without deleting organization-owned records or audit history.',
      ],
    },
    {
      id: 'content',
      title: '5. Your information and permitted processing',
      paragraphs: [
        'As between you and BidXchange, you retain your rights in the information and materials you provide. You represent that you have the authority and permissions needed to enter that information, use it in the service and request its processing, including information about personnel, customers and references.',
        'You grant BidXchange a limited permission to host, store, reproduce, transmit, format and otherwise process your content as needed to provide, secure and support the requested service, including processing through its service providers. This is not permission to advertise with your company records or publish them to the general public. Processing and sharing are described in the Privacy Policy.',
        'You control exports and sharing outside the service. Changes made in a downloaded Word file do not automatically update the saved application draft. Review imported, copied and automatically populated information before use. Restricted or unverified records may be omitted, and legacy identity records may require structured mapping and renewed verification.',
      ],
    },
    {
      id: 'ai',
      title: '6. AI assistance',
      paragraphs: [
        'AI can produce incomplete, outdated or incorrect results. Independently verify consequential statements, citations, calculations and drafts. The assistant is not a lawyer, accountant, insurer, surety, procurement official or other professional adviser.',
        'AI questions are processed by an external provider. Workspace records mode can use authorized records; General mode and the public demo do not automatically attach private company records. Anything you type in a prompt can still be sent to that provider. Do not submit information you are not permitted to disclose.',
        'AI cannot verify qualifications, approve pricing, authorize submission or submit a bid. An explicit outline command may invoke the application’s authorized draft-creation workflow; it does not make the resulting document complete or approved. Outputs may not be unique, and we do not guarantee that any output is free of third-party rights.',
      ],
    },
    {
      id: 'acceptable-use',
      title: '7. Acceptable use',
      paragraphs: ['You must not:'],
      items: [
        'Use the service unlawfully, impersonate another person, forge evidence or misrepresent a verification, approval or submission.',
        'Bypass authentication, organization boundaries, security controls or usage limits; interfere with the service; introduce malware; or conduct unauthorized security testing.',
        'Enter content that violates another person’s confidentiality, privacy or intellectual-property rights, or use the service to send abusive or unlawful material.',
        'Upload or enter classified information, controlled unclassified information, protected health information or other specially regulated content requiring controls not expressly agreed in writing. Do not enter passwords, full tax identifiers or bank-account details.',
        'Present demo results or AI output as an official government determination or as evidence of an award, qualification or authorization that has not occurred.',
      ],
    },
    {
      id: 'ownership',
      title: '8. BidXchange materials and feedback',
      paragraphs: [
        'BidXchange and its licensors retain their rights in the software, design, branding and service materials, subject to applicable third-party and open-source licenses. You receive permission to use the service for your authorized business purposes during permitted access; no ownership of the platform is transferred.',
        'You may provide voluntary feedback. We may use nonconfidential suggestions to improve the service without an obligation to compensate you. This does not grant permission to use private workspace content as public marketing material.',
      ],
    },
    {
      id: 'commercial',
      title: '9. Plans, fees and pilot services',
      paragraphs: [
        'Published plan pricing and managed-service scope are being developed. A demo request or email inquiry does not create a paid subscription, automatic renewal or obligation to purchase. Fees, taxes, payment terms, renewals, cancellation and any managed support must be agreed separately before paid service begins.',
        'Pilot access may be limited or changed. Unless a separate written agreement says otherwise, no specific feature delivery date, uptime commitment, response time, procurement-source coverage or managed bid service is promised.',
      ],
    },
    {
      id: 'availability',
      title: '10. Changes, suspension and ending access',
      paragraphs: [
        'We may maintain or change features, impose reasonable usage limits, or suspend access when needed to address security, misuse, legal requirements or a material breach. We will provide notice when reasonably practicable and appropriate; urgent protective action may occur first.',
        'You may stop using the service and contact us or your organization administrator about ending access and requesting your information. Retention and deletion are governed by the Privacy Policy, applicable law and any written customer agreement. Ending access is not an immediate erasure of audit, approval or submission history. Keep copies of documents and official receipts your organization needs.',
      ],
    },
    {
      id: 'warranties',
      title: '11. Disclaimers',
      paragraphs: [
        'To the extent permitted by applicable law and except for commitments in a separate written agreement, the service is provided “as is” and “as available.” We disclaim implied warranties of merchantability, fitness for a particular purpose and noninfringement. We do not warrant uninterrupted or error-free operation, complete data, or the outcome of a bid.',
        'Nothing in these Terms excludes a warranty, right or remedy that applicable law does not permit us to exclude. Use qualified professional advice where your situation requires it.',
      ],
    },
    {
      id: 'liability',
      title: '12. Limits of liability',
      paragraphs: [
        'To the extent permitted by law, neither party is liable to the other for indirect, incidental, special, consequential or punitive damages, or lost profits, revenue or anticipated awards, arising from use of the service.',
        'Unless a separate written agreement provides otherwise, BidXchange’s total liability arising from the service is limited to the greater of US $100 or the amount you paid BidXchange for the affected service in the twelve months before the event giving rise to the claim. These limits do not exclude liability for fraud, willful misconduct, gross negligence or liability that applicable law does not allow to be limited.',
      ],
    },
    {
      id: 'law',
      title: '13. Applicable law and disputes',
      paragraphs: [
        'Subject to any mandatory law protecting you and any separate written agreement, California law governs these Terms without applying its conflict-of-law rules. Disputes may be brought in state or federal courts with jurisdiction serving San Bernardino County, California, subject to any nonwaivable venue rights.',
        'Please first contact mrodriguez@oaisinc.com so we can try to resolve an issue informally. This request does not prevent seeking urgent relief, using available small-claims procedures, reporting an issue to an authority or exercising a nonwaivable right. These Terms do not impose mandatory arbitration or a class-action waiver.',
      ],
    },
    {
      id: 'updates',
      title: '14. Changes, general terms and contact',
      paragraphs: [
        'Final published Terms will identify their effective date. We will communicate material changes through the service or another appropriate channel and obtain acceptance where required. Changes do not retroactively remove accrued rights or override a signed customer agreement.',
        'If a provision cannot be enforced, the remaining provisions continue to the extent permitted by law. A failure to enforce a provision is not a waiver. These Terms and any applicable written agreement address service use; the Privacy Policy separately explains information handling.',
        'Contact: Manuel Rodriguez, BidXchange LLC, Redlands, California 92373, United States; mrodriguez@oaisinc.com. Contact us by email to arrange postal correspondence.',
      ],
    },
  ],
};

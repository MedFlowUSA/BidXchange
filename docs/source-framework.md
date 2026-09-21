# Multi-source opportunity framework

## Shipped scope

`/opportunities/registry` is an authenticated source registry. Source definitions live in `apps/web/lib/sources/registry.ts`; transport and normalized record contracts live in `normalized.ts`. Manual adapters share validation and one persistence action rather than per-portal scrapers. The existing SAM.gov API worker and source inbox remain independent and retain their activation controls; adding a registry entry does not activate a feed.

The catalog covers the sources requested in the expansion brief. Cal eProcure and CSCR are one source to avoid representing the same state register as two feeds. FI$Cal information, federal awards and USAspending are research entries. Cooperative purchasing and awarded vehicles have a separate category and registration/scope evidence; they cannot be saved as ordinary open-bid opportunities through normalized intake. PEPMA, SCE Ariba and SCE public listings are separate entries. LAUSD purchasing and facilities/prequalification are also separate.

Each catalog entry declares its integration mode. The currently implemented modes are SAM.gov's existing official API adapter and reviewed manual intake/handoff. The common contract reserves authenticated-portal and import modes for future adapters; there is no working generic email/CSV/PDF importer in this release. No platform login is harvested, no submission automation is added, and no partner/endorsement claim or third-party logo is used.

## Persistent records

- Migration 017 adds optional normalized source details to existing opportunities and a tenant-scoped source-registration table. It leaves existing opportunity values intact.
- Intake supports source, buying agency, solicitation/type, scope, NAICS/NIGP/PSC/UNSPSC, performance location, publication/question/site-visit/pre-bid dates, submission deadline/time zone, USD estimate, preferences, license/certification/bonding/insurance/experience/prequalification requirements, incumbent references, contacts, attachment references, addenda, submission destination and method.
- Unknown fields remain blank. Manual records must have null synchronization time and null data-confidence score. A numeric confidence score is not inferred from a filled form.
- Source notes and list-like reference fields remain reviewed text, with attachments/addenda entered one per line. Links are not fetched and files are not uploaded. Full structured attachment/version ingestion remains a separate dependency.
- Registration evidence includes status, vendor/vehicle number, reviewed portal URL, expiry, supporting reference and GSA Schedule number. It is an administrator-maintained business record, not authenticated portal status. No password, MFA token, full EIN or bank account field is introduced.
- eBuy intake is gated on recorded current Schedule evidence, number and expiry, in both application presentation and database write enforcement. This is not independent GSA eligibility verification. It intentionally follows the Schedule-holder scope requested in the brief.
- Registry counts are exact counts of active normalized records visible in the organization, explicitly excluding legacy unclassified records. Existing SAM worker status is shown only from its current authorized status RPC. Other sources show no synchronization attempted.

## Company evidence and matching boundaries

Migration 018 extends the existing structured fact catalog with procurement codes, safety/EMR, labor and prevailing-wage capability, financial capacity, staffing, subcontractor qualifications, reusable form references and a secure tax-document reference. Existing identity, UEI/CAGE, registrations, licenses, certifications, insurance, bonding, project, personnel and equipment templates are retained. Facts still need sources, owner, visibility, dates and human verification. Editing structural values resets verification. Financial, safety and partner information retains existing restricted disclosure rules.

The opportunity review shows availability of current verified company evidence by requirement area and identifies missing requirement inputs. These counts are **not** qualification matches, an eligibility decision, a strategic/competition score or a win-probability estimate. Formal requirement-level evidence approvals and bid/no-bid decisions continue in the existing pursuit workflow. Meaningful numerical forecasts still require complete buyer criteria, capacity data, outcome history and a validated estimation method. Full EIN storage is not implemented; use a secure source-document reference.

## Submission handoff

`/opportunities/[id]/handoff` shows the recorded destination, deadline/time zone and source details, with explicit human-review instructions and a link to the existing pursuit's versioned checklist, file review, approvals, named submitter and submission-confirmation workflow. A destination entered by a user is not independently certified as official. No link click is treated as delivery. Opportunity edits change `updated_at`, which is already part of pursuit and release review context, so changes require renewed review through existing controls.

## Access and rollout

Registration edits require organization administrator membership. Opportunity intake and edits require administrator/capture-manager membership, mutation limits and current edit versions. Reads use user sessions and RLS; no service credential is added to application paths. Migration tests cover cross-tenant reads/writes, viewer mutations, anonymous access, audit history, false sync claims, and eBuy eligibility bypasses. UI tests cover mode/category separation, unknown data, URL validation, responsive forms, source intake and read-only membership.

Production migrations are applied by `scripts/source-registry-production.mjs apply-approved` with fixed migration hashes, a fixed linked project, a transaction, lock timeout, prerequisite checks, and before/after checks for existing facts, opportunities, RLS and AI activation. No sample company records, subscriptions, portal credentials or external services are provisioned.

## Remaining external and product dependencies

Automatic discovery for additional portals needs a supported API/export method, permission to access it and the relevant agency account. Registry URLs with no vetted catalog destination require a reviewed agency-specific URL. Portal terms are not assumed to permit scraping. The private-file scanning worker remains a dependency for uploaded-document ingestion. Bulk imports, external authentication and calibrated win forecasts are not represented as complete.

## Official references checked September 21, 2026

- [California DGS Cal eProcure/CSCR guidance](https://www.dgs.ca.gov/en/PD/Resources/Page-Content/Procurement-Division-Resources-List-Folder/Cal-eProcure-Portal-to-Access-Bid-Opportunities) identifies the state bid register.
- [SCE supplier procurement](https://www.sce.com/partners/3rd-party-energy-providers/supply-chain-management) and [SCE bid opportunities](https://www.sce.com/partners/partner-resources/buying-selling/bid-opportunities) distinguish supplier procurement from the separate PEPMA workflow.
- [LADWP vendors and bidders](https://www.ladwp.com/doing-business-ladwp/vendors-and-bidders) links its procurement process; [LAUSD prequalification](https://procurement.lausd.org/apps/pages/Prequalification) identifies a separate facilities process.
- [San Bernardino ePro](https://epro.sbcounty.gov/bso/) identifies the county's procurement system; [Ventura's portal](https://ventura.bonfirehub.com/portal) identifies County of Ventura on Bonfire.
- [PlanetBids vendor support](https://home.planetbids.com/vendor-support) and [OpenGov vendor guidance](https://opengov.com/products/procurement/for-vendor/) provide agency-portal entry guidance, not authorization for a BidXchange connector.
- [SBA SUBNet](https://www.sba.gov/subnet) is a subcontract opportunity source; [USAspending](https://www.usaspending.gov/search) is award research, not a live solicitation feed.

Some sites block automated page retrieval; the catalog does not interpret public documentation or a reachable page as authenticated access or integration permission.

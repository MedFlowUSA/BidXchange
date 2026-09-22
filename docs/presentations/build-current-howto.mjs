import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const PptxGenJS=require('../../.tmp/presentation-tools/node_modules/pptxgenjs');
const out=path.resolve('docs/presentations');
const slides=[];
const add=(title,section,cards,takeaway,notes)=>slides.push({title,section,cards,takeaway,notes});
slides.push({cover:true,title:'How to use\nBidXchange',subtitle:'A practical guide for California contractor teams',notes:'Allow 25–30 minutes plus practice. This guide follows the deployed contractor workflow, including company signup and invitations, September 21, 2026. Open https://bidxapp.vercel.app/. Screenshots are public fictional demo data. Use an authorized training workspace for changes; the public demo does not reproduce every authenticated feature.'});
add('One bid. One connected review trail.','YOUR WORKFLOW',[
 ['Company → Opportunity','Record reusable company evidence. Capture the buyer’s notice and official source.'],
 ['Requirements → Decision → Tasks','Review the register, identify gaps, sign off and record human bid intent. Assign the remaining work.'],
 ['Draft → Approval → Submission record','Prepare and review a specific response version. A person submits externally and records what happened.']
],'BidXchange organizes the work. People determine eligibility, price, approve, sign and submit.','Define an opportunity as the source notice and a pursuit as the team’s workspace for evaluating and responding. Evidence approval for one requirement is different from approval of an entire response. Never describe the app as the bid submitter.');
add('Create or join your company','01 / GET STARTED',[
 ['Confirm your work email','Open /signup for a new account or /login to sign in. Use the confirmation link or email code.'],
 ['Create or accept an invitation','Open /onboarding. Create a company you administer, or accept the invitation for your exact confirmed email.'],
 ['Follow the setup checklist','Open each Passport area, save supported evidence, then record your first opportunity. Confirm the selected company.']
],'Use the fictional demo to explore navigation—not to store real company information.','Company creation and joining are under /onboarding. Administrators create invitations in Settings → Create and manage team invitations, then share the join address themselves. No invitation email is sent automatically. Invitations last seven days and require the exact confirmed email. Existing active roles are preserved. Creating a company saves workspace names but does not attest Passport evidence. Each account can create up to three companies; contact support for more. Never share sign-in links or codes. Users with several companies must confirm the selected organization on every task.');
slides.push({title:'Find your way around',section:'02 / NAVIGATION',image:'dashboard.png',cards:[['Today','Start with deadlines, open work and evidence that needs attention.'],['Your bid workspace','Company: evidence.\nOpportunities: notices.\nPursuits: reviews and drafts.'],['Assistant','Ask general questions or select Workspace records for authorized company context.']],takeaway:'Live public-demo screenshot · all displayed company and bid data are fictional.',notes:'Point to the left navigation. The real company workspace includes role-controlled contractor features not all represented in this demo. Avoid reading fictional metrics as a real company assessment. Use the same top-level route names in the live demonstration.'});
add('Start with the Company Passport','03 / COMPANY',[
 ['Identity and registrations','Enter legal name, DBA, entity type and headquarters. Record SAM/UEI and DIR status as claimed.'],
 ['License, territory and services','Record CSLB number/classifications, expiration, counties or travel radius, and service/NAICS descriptions.'],
 ['Coverage and experience','Add bonding bands, GL/workers’ compensation/auto expiration dates, and three past projects.']
],'Open Company → California Contractor Passport. Use “Add when needed” for advanced evidence.','An administrator adds or edits company records. Work through the six Passport areas; entries save individually. Use Redlands, California as a territory example, not a real customer assertion. Leave unsupported information unknown. Project entries include customer, role, value band, year, scope, location and disclosure permission. No upload is required.');
add('Save evidence with a source','03 / COMPANY',[
 ['Add what you can support','Open the relevant Passport item. Enter the structured fields and a useful record label.'],
 ['Keep its provenance','Record the source reference or note, dates, owner and permitted visibility. Save the evidence record.'],
 ['Request human review','An authorized reviewer checks the claim and records attestation. Saving alone does not attest it.']
],'A CSLB number in the Passport does not establish that its classification covers a particular bid.','Some existing controls call attestation verification. Explain that this records human review of evidence, not legal eligibility. Material edits can reset the record to pending verification. Keep financial and insurance details within permitted visibility. Do not paste passwords or full tax identifiers. External source links are preferable to unsupported upload assumptions.');
add('Use the Radar before the next deadline','04 / EVIDENCE FRESHNESS',[
 ['Choose a window','In Company or Today, filter the Radar: expired, 0–30, 31–60, 61–90 days, stale, or missing dates.'],
 ['Open the record','Check the source, expiration and owner. Correct the evidence and obtain the required human review.'],
 ['Revisit affected pursuits','Opening a pursuit can reopen linked requirements and create a follow-up task. Reaffirm stale decisions.']
],'A reminder is not renewed coverage. Update and review the underlying evidence.','The source-check date falls back to the attestation date when no explicit check date exists. Stale means last checked over 90 days ago. Follow-up creation runs on pursuit access; there is no background email notification. Previous decisions remain in history. Restricted records may be hidden from the current role.');
slides.push({title:'Capture the notice, not just its title',section:'05 / OPPORTUNITY INTAKE',image:'opportunities.png',cards:[['Record an opportunity','Enter buyer, title, solicitation number, source and notice excerpt.'],['Confirm the deadline','Record the exact date, time and time zone from official instructions.'],['Keep the source current','Preserve the portal URL and source-review note. Check for changes at the official site.']],takeaway:'Live public-demo screenshot · fictional opportunities; not a live market feed.',notes:'Demonstrate the Record an opportunity area in an authorized workspace. A URL alone does not import all solicitation content. Paste relevant public notice text and preserve its source. Only record estimated value when explicitly stated. Open the resulting opportunity, then start a pursuit using its planning control.'});
add('Use official portals deliberately','05 / EXTERNAL SOURCES',[
 ['Open a portal shortcut','Find official links for SAM.gov, Cal eProcure, SCE PEPMA, LADWP, LAUSD and other supported sources.'],
 ['Research at the source','Sign in directly when required. Read the notice, attachments, meeting instructions and addenda.'],
 ['Bring the evidence back','Save the official URL and source note in BidXchange. Paste the relevant public notice excerpt.']
],'“External site” means a portal shortcut—not automatic synchronization or submission.','For energy-efficiency work, SCE PEPMA may be especially relevant. Portal registration and authentication remain separate from BidXchange. Do not imply unrestricted SAM live coverage. The manual workflow remains reliable without an API connection. Never copy portal passwords into a source note.');
add('Turn an opportunity into a pursuit','06 / PURSUIT WORKSPACE',[
 ['Open the opportunity','Confirm the source notice and the opportunity you intend to evaluate.'],
 ['Start the pursuit','Use the opportunity’s pursuit/planning control. Give the workspace a recognizable name.'],
 ['Work in that pursuit','Keep requirements, decision history, tasks, response drafts and release records together.']
],'Starting a pursuit is a planning step. It is not a final decision to bid.','The initial decision stays pending. Do not treat an attractive scope or source match as qualification. Before drafting, ensure the pursuit points to the intended opportunity and deadline. Use the source URL to revisit the actual buyer instructions.');
add('Extract candidate requirements','07 / REQUIREMENTS REGISTER',[
 ['Paste a notice excerpt','Use the notice-review area in the pursuit. Include a source reference and relevant original wording.'],
 ['Inspect the suggestions','Check candidate requirements and the California checklist heuristics against the quoted source.'],
 ['Save only what applies','Add/edit cited requirements. Fill omissions manually; dismiss irrelevant suggestions.']
],'Candidate requirements may be incomplete or inaccurate until a person reviews and signs off.','Checklist heuristics are versioned and nonbinding. Electrical, wage, payroll, bond and meeting keywords prompt investigation; they do not determine license coverage. Heuristic dismissals currently last in the open view. Review the entire notice and attachments rather than assuming the excerpt was exhaustive.');
add('Review each requirement and its evidence','07 / REQUIREMENTS REGISTER',[
 ['Keep a traceable row','Check requirement wording and citation. Assign an owner and record clarification needs.'],
 ['Review evidence use','Choose the company evidence. Assess applicability and whether it is approved for this requirement.'],
 ['Record a human finding','Use supported, blocked, awaiting clarification, needs review or not applicable—with a reason.']
],'A saved company fact is not automatically approved evidence for this pursuit.','Administrator/executive roles perform human resolution reviews. Supported findings require current approved evidence. Not applicable requires a reason; a documented buyer waiver is a separate executive-only finding with authority/source details. AI suggestions do not finalize blockers. Evidence details remain role-restricted.');
add('Sign off the register before deciding','08 / HUMAN SIGN-OFF',[
 ['Review beyond the extracted rows','Check for missing forms, dates, job walks, bonds, addenda and submission instructions.'],
 ['Record the sign-off','Open Requirements Register sign-off. Enter a review note and confirm the acknowledgment.'],
 ['Refresh the review context','A current human sign-off enables final bid/no-bid recording. Review outstanding gaps explicitly.']
],'Sign-off records a person’s review. It does not certify eligibility or erase blockers.','An administrator or executive approver signs off. Amendments must be reviewed first. Sign-off is bound to the register/source/evidence context and review date. If records change, refresh and review again. The system preserves the prior sign-off rather than overwriting its historical meaning.');
add('Write a bid/no-bid decision memo','09 / DECISION',[
 ['Before final review','Use Draft decision, Leaning bid or Leaning pass when the team is still investigating.'],
 ['When ready to decide','Choose Pursue bid or Do not bid after sign-off. Record rationale, primary reason and pursuit hours.'],
 ['Keep the limits visible','Document conditions and unresolved risks. Confirm the scope of your authority and save.']
],'Pursuit hours are entered by a person. There is no profitability or win-probability score.','Decision controls require an administrator or executive approver. Both final outcomes require current sign-off. The record preserves who decided, when, and the reviewed context. A stale decision does not silently switch bid to no-bid. Pricing, signatures and submission authorization remain separate.');
add('Assign the contractor work','10 / TASKS',[
 ['Use the task template','Offer tasks for DIR, bond requests, job walks, wages, payroll, quotes, addenda and submission checks.'],
 ['Make each task actionable','Assign an owner, due date/time zone, priority and notes. Link the relevant requirement.'],
 ['Update the work','Move tasks through todo, in progress and complete. Resolve blockers with documented human review.']
],'A confirmed capability gap can become an “Identify a teaming partner for…” task.','Capture managers and administrators create pursuit tasks. Templates are suggestions added deliberately, not proof that work is complete. Teaming research is not a public marketplace or automatic eligibility fix. Check the buyer’s rules before assuming a subcontractor resolves a license or participation requirement.');
add('Use the assistant in the right mode','11 / ASSISTANT',[
 ['General questions','Ask “Explain how a bid bond works.” This mode does not read private company records.'],
 ['Workspace records','Select the company context. Ask “Summarize this pursuit” or “What tasks are overdue?” Review its sources.'],
 ['Document command','Open the pursuit and ask: “Create a response outline for this solicitation”. A register must exist.']
],'The assistant can organize and explain. It cannot approve, price, sign, certify or submit.','Workspace AI uses current authorized records when a request is made; previous answers are snapshots. Availability depends on activation and usage limits. General mode has no live web access. Newly added record types may not all be retrievable yet: open the source panel directly if needed. Do not enter passwords or API keys. Questions are independent, so include the needed context.');
add('Create the response outline','12 / DRAFT',[
 ['Create or open the draft','In Response packages, choose Create response draft—or open the assistant-created response.'],
 ['Check the autofill preview','Inspect company and bid information. Current attested records may fill allowed fields; gaps stay visible.'],
 ['Write the actual response','Complete the overview and each requirement answer. Human input is required for pricing and technical content.']
],'Missing, stale or restricted evidence must not become an invented statement.','The assistant outline contains California contractor sections and requirement-linked answers. Legal name/DBA require current attested identity; the website may remain a human-input placeholder. Insurance/bonding and other sensitive facts are not indiscriminately copied. Past-performance reuse requires disclosure permission and applicable export policy. Creating an outline is not a full proposal-writing service.');
add('Review and export the saved draft','12 / PDF AND WORD',[
 ['Save the latest edits','Complete the overview and requirement answers. Remove every unfinished human-input marker.'],
 ['Inspect the saved response','Review missing answers, changed requirements and stale source context. Read the document end to end.'],
 ['Download a review copy','Choose Download saved draft PDF or Download saved draft Word from the saved response card.']
],'A downloaded working draft is not an approved release or proof of submission.','Downloads use saved narrative; permitted automatic data are refreshed at export. Manually copied old values must still be checked. Human-input placeholders and TODO/TBD block release approval. Working PDF/Word drafts retain internal review material; prepare the buyer-facing final files deliberately outside the app as required by the release workflow.');
add('Approve one specific response version','13 / RELEASE REVIEW',[
 ['Complete release checks','Confirm instructions, attachments, deadline, portal and named submitter. Prepare the required final files.'],
 ['Freeze the reviewed version','Use the versioned release workflow and final-file manifest. Keep final files in approved storage.'],
 ['Record the required approvals','Authorized reviewers complete the available gates in order. Recheck if the draft or context changes.']
],'Approvals belong to the exact version. Editing requires a new version and renewed review.','Existing release gates cover compliance, pricing, final review and submission authorization, with role requirements shown in the app. File hashes are calculated in the browser; selected file bytes are not uploaded by this workflow. A changed upstream approval invalidates later gates. Approvals are attributed review records, not legal signatures or buyer acceptance.');
add('Submit externally, then record the receipt','14 / SUBMISSION RECORD',[
 ['Use the official destination','The named person submits through the buyer portal, email or other stated delivery method.'],
 ['Record what actually happened','Confirm the exact files and enter the actual time, method, confirmation number and receipt reference.'],
 ['Preserve the trail','Retain the approved version and external receipt. Add a correction rather than rewriting history.']
],'Submission information is user-recorded and is not independently verified by BidXchange.','The app does not log into portals, upload the bid for you, sign, or send it. Recording is role-controlled and tied to the authorized submitter/version. Check the app’s current release gates: passed deadlines or changed review dates can require renewed review. An internal handoff packet is not the buyer-facing submission.');
add('Handle amendments and stale evidence','15 / CHANGE CONTROL',[
 ['Record the amendment','Add its label, date, official URL, summary and public excerpt in Opportunity amendments.'],
 ['Review the official change','Read it at the source. Record human amendment review; update affected requirements and tasks.'],
 ['Reaffirm the work','Re-sign the register, record a fresh decision and prepare a new release version when context changes.']
],'Previous sign-offs and decisions remain in history. A new amendment requires fresh review.','The amendment review control asks you to type reviewed. That acknowledgment does not automatically sign off the register. Expired/stale linked evidence can also reopen review when a pursuit is opened. There is no background email notification. Context includes a UTC review-date boundary, so next-day work can require renewed review.');
add('Close the loop—and know who can act','16 / FOLLOW-UP & ACCESS',[
 ['Record the outcome','Use release follow-up for questions, clarification, award/loss, cancellation, debrief and lessons learned.'],
 ['Use the right role','Admins manage company evidence/access. Capture managers organize bids and drafts. Approvers review decisions/releases.'],
 ['If a control is missing','Check organization and role. Refresh changed records. Ask your administrator for the appropriate access.']
],'An award or past-performance claim must come from a documented human record.','Do not promise automatic award detection or outcome-to-past-performance promotion; the complete promotion workflow is still unfinished. Estimator and viewer privileges differ from approver privileges. Do not borrow an account to bypass a missing permission. The same person may hold several authorized responsibilities; strict four-person separation is not enforced.');
add('Practice with one fictional training bid','17 / GUIDED EXERCISE',[
 ['Set up the example','In an authorized training workspace, label it “TRAINING — not for submission”. Cite a numbered training brief.'],
 ['Build the review trail','Add two requirements, one clarification and one assigned task. Review evidence and record a preliminary decision.'],
 ['Prepare a reviewable draft','Create an outline. Complete one answer, leave one placeholder, export and explain why it is not approved.']
],'Practice success: another team member can trace an answer back to its requirement and evidence.','Allow 10–15 minutes with facilitator help. Use synthetic information only; do not fabricate an official source. Add a fictional amendment to demonstrate invalidation if the audience has the right permissions. The public demo can show navigation but does not support the entire authenticated workflow. Do not record a practice submission as a real event.');
add('Make it a daily operating routine','YOUR NEXT SESSION',[
 ['Start in Today','Check deadlines, overdue tasks, blockers and evidence needing attention. Open active pursuits.'],
 ['Check before handoff','Is the register signed off? Is the decision current? Are answers complete and this exact version approved?'],
 ['Keep learning','Use Workspace guide for contextual help. Open the official source whenever instructions are uncertain.']
],'Open bidxapp.vercel.app → choose your company → take the next documented action.','Close by having each attendee name their next task and who reviews it. Reiterate the boundary: Human review required. BidXchange organizes contracting information but does not determine legal eligibility, set pricing or submit bids. This deck describes the deployed contractor release, not every future capability in the broader roadmap.');

const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='BidXchange';pptx.company='BidXchange LLC';pptx.subject='How to use the deployed California contractor workflow';pptx.title='How to Use BidXchange — California Contractor Edition';pptx.lang='en-US';pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-US'};
const C={navy:'0D1933',blue:'235AF5',gold:'F2B337',ink:'172641',muted:'506178',paper:'F3F6FB',line:'DCE4F0',white:'FFFFFF'};
for(const [i,d] of slides.entries()){
 const s=pptx.addSlide();s.background={color:d.cover?C.navy:C.paper};s.addNotes(d.notes);
 const rect=(x,y,w,h,color)=>s.addShape(pptx.ShapeType.rect,{x,y,w,h,line:{color,transparency:100},fill:{color}});
 const text=(t,x,y,w,h,size=18,color=C.ink,bold=false,extra={})=>s.addText(t,{x,y,w,h,fontFace:'Aptos',fontSize:size,color,bold,margin:0,breakLine:false,valign:'top',paraSpaceAfter:0,...extra});
 if(d.cover){
  s.addImage({path:path.resolve('apps/web/public/brand/bidxchange-icon.png'),x:10.25,y:.65,w:2.25,h:2.25});
  text('CALIFORNIA CONTRACTOR EDITION',.7,.75,9,.4,13,C.gold,true);
  text(d.title,.7,1.75,9,2.3,48,C.white,true);
  text(d.subtitle,.75,4.5,10,.9,25,'DDE5F4');
  rect(.75,6.0,1,.07,C.gold);text('STEP-BY-STEP TRAINING  •  SEPTEMBER 2026',.75,6.3,11,.35,12,'DDE5F4');
  text('Open BidXchange ↗',.75,6.9,10,.3,14,C.gold,false,{hyperlink:{url:'https://bidxapp.vercel.app/'}});
 }else{
  rect(0,0,13.333,.09,C.blue);text(d.section,.65,.38,11,.3,12,C.blue,true);text(d.title,.65,.93,12.05,.8,30,C.navy,true);
  if(d.image){
   s.addImage({path:path.join(out,'how-to-assets',d.image),x:.55,y:1.8,w:8.23,h:5.21});
   d.cards.forEach(([h,b],j)=>{text(h,9.03,1.92+j*1.37,3.62,.42,19,C.blue,true);text(b,9.03,2.39+j*1.37,3.62,.85,16,C.ink);});
   text(d.takeaway,9.03,6.18,3.6,.68,11,C.muted);
  }else{
   d.cards.forEach(([h,b],j)=>{const x=.65+j*4.1;rect(x,2.03,3.85,3.89,C.white);rect(x,2.03,.06,3.89,j===1?C.gold:C.blue);text(String(j+1).padStart(2,'0'),x+.23,2.25,3.3,.4,13,C.blue,true);text(h,x+.23,2.83,3.36,.8,22,C.navy,true);text(b,x+.23,3.79,3.32,1.83,18,C.ink);});
   rect(.65,6.18,12.05,.63,C.navy);text(d.takeaway,.85,6.32,11.6,.41,14,C.white);
  }
  text('BidXchange  /  HOW TO USE THE APP',.65,7.12,10,.2,9,C.muted);text(String(i+1).padStart(2,'0'),12.03,7.08,.65,.27,11,C.muted,false,{align:'right'});
 }
}
await pptx.writeFile({fileName:path.join(out,'BidXchange-How-To-Use.pptx')});
fs.writeFileSync(path.join(out,'How-To-Presenter-Notes.md'),'# How to use BidXchange\n\n25–30 minute walkthrough plus practice. Deployed workflow: 0107d2c.\n\n'+slides.map((d,i)=>`## ${i+1}. ${d.title.replaceAll('\n',' ')}\n\n${d.notes}\n`).join('\n'));
fs.writeFileSync(path.join(out,'how-to-content.json'),JSON.stringify(slides,null,2)+'\n');
console.log(`Created ${slides.length} editable slides with speaker notes.`);

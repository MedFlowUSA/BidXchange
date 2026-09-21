import { ArrowUpRight, Check, Circle, FileText } from 'lucide-react';
import styles from './bid-preview.module.css';

export default function ProductPreview() {
  return (
    <figure
      className={styles.brief}
      aria-label="Illustrative bid review using fictional Apex Energy Demo records"
    >
      <div className={styles.top}>
        <span>
          <FileText size={15} aria-hidden="true" /> THE BID REVIEW
        </span>
        <span>ILLUSTRATIVE EXAMPLE</span>
      </div>
      <div className={styles.heading}>
        <p>APEX ENERGY DEMO / PUBLIC WORKS</p>
        <h2>
          Municipal building
          <br />
          energy retrofit
        </h2>
        <span>One notice. Three requirements to review.</span>
      </div>
      <div className={styles.sheet}>
        <div className={styles.columns}>
          <span>REQUIREMENT</span>
          <span>REVIEW STATUS</span>
        </div>
        <div className={styles.row}>
          <div>
            <strong>Contractor license</strong>
            <small>Company Passport → license record</small>
          </div>
          <span className={styles.reviewed}>
            <Check size={13} aria-hidden="true" /> Reviewed
          </span>
        </div>
        <div className={styles.row}>
          <div>
            <strong>Bid bond</strong>
            <small>Confirm capacity with the surety</small>
          </div>
          <span className={styles.open}>
            <Circle size={11} aria-hidden="true" /> Needs evidence
          </span>
        </div>
        <div className={styles.row}>
          <div>
            <strong>Mandatory site visit</strong>
            <small>Confirm attendance requirements</small>
          </div>
          <span className={styles.open}>
            <Circle size={11} aria-hidden="true" /> Needs clarification
          </span>
        </div>
        <div className={styles.followup}>
          <span>NEXT FOLLOW-UP</span>
          <p>Get the bond confirmation before the bid review.</p>
          <div>
            <span className={styles.avatar}>BL</span>
            <strong>Bid lead</strong>
            <span>Assigned owner</span>
          </div>
        </div>
      </div>
      <div className={styles.decision}>
        <div>
          <span>THE DECISION STAYS WITH YOUR TEAM</span>
          <p>Evidence first. Then pursue—or pass.</p>
        </div>
        <ArrowUpRight size={22} aria-hidden="true" />
      </div>
      <figcaption>
        Fictional demonstration data. Illustrative review, not a live contract or eligibility
        determination.
      </figcaption>
    </figure>
  );
}

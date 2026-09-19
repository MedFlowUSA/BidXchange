import {
  ArrowUpRight,
  Check,
  Circle,
  LayoutDashboard,
  ListFilter,
  ShieldCheck,
  FolderOpen,
  BriefcaseBusiness,
} from 'lucide-react';
import styles from './marketing.module.css';
import Image from 'next/image';

export default function ProductPreview() {
  return (
    <figure
      className={styles.preview}
      aria-label="Representative BidXchange dashboard using fictional Apex Energy Demo records"
    >
      <div className={styles.previewBar}>
        <span>
          <i />
          <i />
          <i />
        </span>
        <span>YOUR CONTRACT DESK</span>
        <span className={styles.previewDemo}>Fictional demo</span>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewRail} aria-hidden="true">
          <Image src="/brand/bidxchange-icon.png?v=2" width={40} height={40} alt="" />
          <LayoutDashboard />
          <ListFilter />
          <BriefcaseBusiness />
          <FolderOpen />
          <ShieldCheck className={styles.railBottom} />
        </div>
        <div className={styles.previewContent}>
          <div className={styles.previewBreadcrumb}>
            Apex Energy Demo <span>/</span> Today
          </div>
          <div className={styles.previewTitle}>
            <h2>
              A clearer path to your
              <br />
              next pursuit.
            </h2>
            <span className={styles.previewAdd}>+ Opportunity</span>
          </div>
          <div className={styles.previewStats}>
            <div>
              <span>To review</span>
              <strong>03</strong>
            </div>
            <div>
              <span>In pursuit</span>
              <strong>01</strong>
            </div>
            <div>
              <span>Evidence first</span>
              <ShieldCheck size={27} />
            </div>
          </div>
          <div className={styles.previewOpportunity}>
            <div className={styles.previewCardTop}>
              <span>ENERGY EFFICIENCY</span>
              <span>Demo fit review</span>
            </div>
            <h3>Municipal building energy retrofit</h3>
            <p>Canyon Springs · Public Works</p>
            <div className={styles.previewChecklist}>
              <span>
                <Check size={14} /> Scope reviewed
              </span>
              <span>
                <Circle size={12} /> Evidence to confirm
              </span>
            </div>
            <div className={styles.previewCardBottom}>
              <span>Source → requirements → decision</span>
              <ArrowUpRight size={17} />
            </div>
          </div>
          <div className={styles.previewFooter}>
            <span>
              <i /> Keep the opportunity. Lose the guesswork.
            </span>
            <span>Human review</span>
          </div>
        </div>
      </div>
      <figcaption>
        Representative product view · Fictional demonstration data, not live contracts or results.
      </figcaption>
    </figure>
  );
}

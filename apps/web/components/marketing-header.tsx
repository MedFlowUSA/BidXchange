'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import styles from './marketing.module.css';
import PublicWorkspaceAccess from './public-workspace-access';

const links = [
  ['Capabilities', '#capabilities'],
  ['Questions', '#questions'],
];

export default function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = React.useState(false);
  const toggle = React.useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  return (
    <header className={styles.header}>
      <div
        className={styles.headerInner}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            close();
            toggle.current?.focus();
          }
        }}
      >
        <Link href="/" className={styles.logo} aria-label="BidXchange home">
          <Image
            src="/brand/bidxchange-logo.png?v=2"
            alt="BidXchange"
            width={2172}
            height={724}
            sizes="185px"
            loading="eager"
          />
        </Link>
        <button
          ref={toggle}
          className={styles.menuToggle}
          type="button"
          aria-label={open ? 'Close public navigation' : 'Open public navigation'}
          aria-expanded={open}
          aria-controls="public-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav
          id="public-navigation"
          aria-label="Public navigation"
          className={`${styles.navigation} ${open ? styles.navigationOpen : ''}`}
        >
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={close}>
              {label}
            </a>
          ))}
          <div className={styles.headerActions}>
            <Link href="/login" onClick={close}>
              Sign In
            </Link>
            <PublicWorkspaceAccess
              signedIn={signedIn}
              className={styles.workspaceLink}
              onClick={close}
            />
            <a href="#request-demo" className={styles.primary} onClick={close}>
              Request a Demo <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}

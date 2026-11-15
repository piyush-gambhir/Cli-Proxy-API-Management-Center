import { useId, type CSSProperties } from 'react';
import { IconExternalLink, IconPlus } from '@/components/ui/icons';
import type { ProviderFlowState } from '../hooks/useOAuthFlows';
import { BrandGlyph } from './BrandGlyph';
import styles from './SponsorCard.module.scss';


const CARD_ENTER_DELAY = '140ms';


const LIGHT_POOLS = ['a', 'b', 'c'] as const;

export interface SponsorCardSite {
  id: string;

  name: string;

  region: string;
  domain: string;
  status?: ProviderFlowState['status'];
  statusLabel?: string;
  signUpUrl: string;
}

export interface SponsorCardProps {
  title: string;
  caption: string;
  icon: string;
  signUpLabel: string;
  sites: SponsorCardSite[];

  onOpen: (siteId: string) => void;
}









export function SponsorCard({
  title,
  caption,
  icon,
  signUpLabel,
  sites,
  onOpen,
}: SponsorCardProps) {
  const titleId = useId();
  const pools = LIGHT_POOLS.map((pool) => (
    <span key={pool} className={styles.pool} data-pool={pool} />
  ));

  return (
    <div
      className={styles.card}
      role="group"
      aria-labelledby={titleId}
      style={{ '--card-delay': CARD_ENTER_DELAY } as CSSProperties}
    >
      <div className={styles.field} aria-hidden="true">
        {pools}
      </div>
      <div className={styles.rim} aria-hidden="true">
        {pools}
      </div>

      <div className={styles.head}>
        <BrandGlyph src={icon} size={40} className={styles.glyph} />
        <div className={styles.headText}>
          <p className={styles.title} id={titleId}>
            {title}
          </p>
          <p className={styles.caption}>{caption}</p>
        </div>
      </div>

      <div className={styles.sites}>
        {sites.map((site) => (
          <SiteEntry
            key={site.id}
            site={site}
            signUpLabel={signUpLabel}
            onOpen={() => onOpen(site.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SiteEntry({
  site,
  signUpLabel,
  onOpen,
}: {
  site: SponsorCardSite;
  signUpLabel: string;
  onOpen: () => void;
}) {
  const metaId = useId();

  return (
    <div className={styles.site} data-status={site.status ?? 'idle'}>
      <div className={styles.siteBody}>
        <span className={styles.siteText}>
          <button
            type="button"
            className={styles.siteMain}
            onClick={onOpen}
            aria-label={site.name}
            aria-haspopup="dialog"
            aria-describedby={metaId}
          >
            {site.region}
          </button>
          <span className={styles.siteMeta} id={metaId}>
            {site.status && site.statusLabel ? (
              <span className={styles.status}>
                <span className={styles.statusDot} aria-hidden="true" />
                {site.statusLabel}
              </span>
            ) : (
              <span className={styles.domain}>{site.domain}</span>
            )}
          </span>
        </span>
        <a
          className={styles.signUp}
          href={site.signUpUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${signUpLabel} · ${site.name}`}
        >
          {signUpLabel}
          <IconExternalLink size={12} aria-hidden="true" />
        </a>
        <span className={styles.trail} aria-hidden="true">
          <IconPlus size={15} />
        </span>
      </div>
    </div>
  );
}

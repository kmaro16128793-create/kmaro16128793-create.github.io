import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const socials = [
  {
    key: 'tiktok',
    name: 'TikTok',
    handle: '@minabrunchtraiteur',
    href: 'https://www.tiktok.com/@minabrunchtraiteur',
    icon: '/app/social/tiktok.svg',
  },
  {
    key: 'instagram-primary',
    name: 'Instagram',
    handle: '@minatraiteur93',
    href: 'https://www.instagram.com/minatraiteur93',
    icon: '/app/social/instagram.svg',
  },
  {
    key: 'instagram-events',
    name: 'Instagram',
    handle: '@minatraiteurevents',
    href: 'https://www.instagram.com/minatraiteurevents',
    icon: '/app/social/instagram.svg',
  },
] as const;

function usePortalTargets() {
  const [drawerTarget, setDrawerTarget] = useState<HTMLElement | null>(null);
  const [aboutTarget, setAboutTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const refresh = () => {
      const drawer = document.querySelector<HTMLElement>('.ref-drawer-contact');
      const about = document.querySelector<HTMLElement>('.ref-about-body');
      setDrawerTarget(current => current === drawer ? current : drawer);
      setAboutTarget(current => current === about ? current : about);
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', refresh);

    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', refresh);
    };
  }, []);

  return { drawerTarget, aboutTarget };
}

function SocialLinks({ placement }: { placement: 'drawer' | 'about' }) {
  return (
    <section className={`mina-socials mina-socials-${placement}`} aria-label="Réseaux sociaux Mina Brunch">
      <div className="mina-socials-heading">
        <span>RÉSEAUX SOCIAUX</span>
        {placement === 'about' && <strong>Retrouvez Mina Brunch</strong>}
      </div>
      <div className="mina-socials-list">
        {socials.map(social => (
          <a
            key={social.key}
            className={`mina-social-link mina-social-${social.key.startsWith('instagram') ? 'instagram' : 'tiktok'}`}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${social.name} ${social.handle}`}
          >
            <span className="mina-social-icon" aria-hidden="true">
              <img src={social.icon} alt="" width="24" height="24" loading="lazy" decoding="async" />
            </span>
            <span className="mina-social-copy">
              <b>{social.name}</b>
              <small>{social.handle}</small>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

export default function SocialPortals() {
  const { drawerTarget, aboutTarget } = usePortalTargets();

  return (
    <>
      {drawerTarget && createPortal(<SocialLinks placement="drawer" />, drawerTarget)}
      {aboutTarget && createPortal(<SocialLinks placement="about" />, aboutTarget)}
    </>
  );
}

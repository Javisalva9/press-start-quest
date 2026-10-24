import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 py-3 text-center text-sm font-semibold transition ${
    isActive ? 'text-cyan' : 'text-muted hover:text-fg'
  }`;

/** Bottom navigation, within thumb reach on a phone. */
export function AppNav() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl">
        <NavLink to="/" end className={linkClass}>
          {t('nav.home')}
        </NavLink>
        <NavLink to="/library" className={linkClass}>
          {t('nav.library')}
        </NavLink>
        <NavLink to="/deals" className={linkClass}>
          {t('nav.deals')}
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          {t('nav.settings')}
        </NavLink>
      </div>
    </nav>
  );
}

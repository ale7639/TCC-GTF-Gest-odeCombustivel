import { Platform } from 'react-native';

// Ajustes leves de viewport / PWA só no navegador (Expo web).
export function setupWeb() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const garantirMeta = (name, content) => {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  garantirMeta(
    'viewport',
    'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no'
  );
  garantirMeta('theme-color', '#dc2626');
  garantirMeta('mobile-web-app-capable', 'yes');
  garantirMeta('apple-mobile-web-app-capable', 'yes');
  garantirMeta('apple-mobile-web-app-status-bar-style', 'default');
  garantirMeta('apple-mobile-web-app-title', 'Gestão de Frota');

  if (!document.title || document.title === 'mobile') {
    document.title = 'Gestão de Frota';
  }

  const html = document.documentElement;
  const body = document.body;
  html.style.height = '100%';
  html.style.touchAction = 'manipulation';
  body.style.height = '100%';
  body.style.margin = '0';
  body.style.padding = '0';
  body.style.overflow = 'hidden';
  body.style.backgroundColor = '#6b7280';
  body.style.overscrollBehavior = 'none';

  const root = document.getElementById('root');
  if (root) {
    root.style.height = '100%';
    root.style.width = '100%';
    root.style.display = 'flex';
    root.style.justifyContent = 'center';
    root.style.alignItems = 'stretch';
  }
}

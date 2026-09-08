import type { Product } from './types';

export type Screen = 'home' | 'product' | 'cart' | 'booking' | 'customer' | 'zone' | 'quote' | 'about';

export type AppRoute = {
  screen: Screen;
  productId?: string;
};

const simpleRoutes: Record<Exclude<Screen, 'home' | 'product'>, string> = {
  cart: 'cart',
  booking: 'booking',
  customer: 'customer',
  zone: 'zone',
  quote: 'quote',
  about: 'about'
};

export function routeToHash(screen: Screen, product?: Product | null) {
  if (screen === 'home') return '#/';
  if (screen === 'product') return product ? `#/product/${encodeURIComponent(product.id)}` : '#/';
  return `#/${simpleRoutes[screen]}`;
}

export function parseHash(hash: string): AppRoute {
  const clean = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!clean) return { screen: 'home' };

  const [first, second] = clean.split('/');
  if (first === 'product' && second) return { screen: 'product', productId: decodeURIComponent(second) };

  const screen = (Object.entries(simpleRoutes).find(([, value]) => value === first)?.[0] ?? 'home') as Screen;
  return { screen };
}

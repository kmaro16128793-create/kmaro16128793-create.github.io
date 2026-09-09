import { useEffect, type ReactNode } from 'react';
import { jsPDF } from 'jspdf';
import { products } from './data';

type StoredCartItem = { productId: string; qty: number };
type StoredRequest = {
  eventType?: string;
  guestCount?: string;
  company?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  budget?: string;
  invoice?: boolean;
  notes?: string;
};
type StoredBooking = { date?: string; time?: string };

type QuoteSnapshot = {
  cart: StoredCartItem[];
  request: StoredRequest;
  booking: StoredBooking;
};

const GUARDED_HASHES = new Set(['#/zone', '#/generating', '#/quote']);
const HISTORY_GUARD_KEY = '__minaHistoryGuardInstalled';

function safeJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function validPhone(value = '') {
  return /^(?:(?:\+|00)33|0)[1-9](?:[\s.-]*\d{2}){4}$/.test(value.trim());
}

function validEmail(value = '') {
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function getSnapshot(): QuoteSnapshot {
  const rawCart = safeJson<unknown>('mina-cart', []);
  const rawRequest = safeJson<unknown>('mina-video-request', {});
  const rawBooking = safeJson<unknown>('mina-booking', {});

  const knownIds = new Set(products.map((product) => product.id));
  const cart = Array.isArray(rawCart)
    ? rawCart
        .filter((item): item is StoredCartItem => {
          if (!item || typeof item !== 'object') return false;
          const candidate = item as Partial<StoredCartItem>;
          return typeof candidate.productId === 'string'
            && knownIds.has(candidate.productId)
            && Number.isFinite(candidate.qty)
            && Number(candidate.qty) > 0;
        })
        .map((item) => ({ productId: item.productId, qty: Math.min(99, Math.max(1, Math.floor(Number(item.qty)))) }))
    : [];

  const request = rawRequest && typeof rawRequest === 'object' ? rawRequest as StoredRequest : {};
  const booking = rawBooking && typeof rawBooking === 'object' ? rawBooking as StoredBooking : {};
  return { cart, request, booking };
}

function orderPrerequisites(snapshot = getSnapshot()) {
  const { cart, request } = snapshot;
  return cart.length > 0
    && (request.name ?? '').trim().length > 1
    && validPhone(request.phone)
    && validEmail(request.email)
    && (request.address ?? '').trim().length > 4
    && /^\d{5}$/.test((request.postalCode ?? '').trim())
    && (request.city ?? '').trim().length > 1;
}

function quotePrerequisites(snapshot = getSnapshot()) {
  return orderPrerequisites(snapshot)
    && Boolean(snapshot.booking.date)
    && Boolean(snapshot.booking.time);
}

function fallbackHash(snapshot = getSnapshot()) {
  return snapshot.cart.length > 0 ? '#/order' : '#/cart';
}

function normalizedTarget(url: string | URL | null | undefined) {
  if (url == null) return null;
  try {
    return new URL(String(url), window.location.href);
  } catch {
    return null;
  }
}

function rewriteUnsafeUrl(url: string | URL | null | undefined) {
  const target = normalizedTarget(url);
  if (!target || !GUARDED_HASHES.has(target.hash) || quotePrerequisites()) return url;
  target.hash = fallbackHash();
  return `${target.pathname}${target.search}${target.hash}`;
}

function dispatchRouteSync(state: unknown) {
  queueMicrotask(() => window.dispatchEvent(new PopStateEvent('popstate', { state })));
}

function installHistoryGuard() {
  const marker = window as typeof window & { [HISTORY_GUARD_KEY]?: boolean };
  if (marker[HISTORY_GUARD_KEY]) return;
  marker[HISTORY_GUARD_KEY] = true;

  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
    const safeUrl = rewriteUnsafeUrl(url);
    originalPush(data, unused, safeUrl);
    if (safeUrl !== url) dispatchRouteSync(data);
  }) as History['pushState'];

  history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
    const safeUrl = rewriteUnsafeUrl(url);
    originalReplace(data, unused, safeUrl);
    if (safeUrl !== url) dispatchRouteSync(data);
  }) as History['replaceState'];
}

function enforceCurrentRoute() {
  if (!GUARDED_HASHES.has(location.hash) || quotePrerequisites()) return false;
  history.replaceState({ mina: true, depth: 0 }, '', fallbackHash());
  dispatchRouteSync(history.state);
  return true;
}

function dateLabel(value?: string) {
  if (!value) return 'À choisir';
  return new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function safeDownloadQuote() {
  const snapshot = getSnapshot();
  if (!quotePrerequisites(snapshot)) {
    history.replaceState({ mina: true, depth: 0 }, '', fallbackHash(snapshot));
    dispatchRouteSync(history.state);
    return;
  }

  const { request, booking } = snapshot;
  const detailed = snapshot.cart
    .map((item) => ({ ...item, product: products.find((product) => product.id === item.productId) }))
    .filter((item): item is StoredCartItem & { product: (typeof products)[number] } => Boolean(item.product));

  const quoteId = `MB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 17;
  const right = 193;
  const bodyBottom = 258;
  const lineHeight = 4.6;
  let y = 18;

  const continuationHeader = () => {
    doc.setTextColor(55, 48, 41);
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text('MINA BRUNCH', left, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(168, 124, 59);
    doc.text(`DEVIS ${quoteId} · SUITE`, right, 17, { align: 'right' });
    doc.setDrawColor(218, 198, 169);
    doc.line(left, 21, right, 21);
    y = 29;
  };

  const newPage = () => {
    doc.addPage();
    continuationHeader();
  };

  const ensure = (height: number) => {
    if (y + height > bodyBottom) newPage();
  };

  const writeWrapped = (text: string, width = 170, height = lineHeight) => {
    const lines = doc.splitTextToSize(text, width) as string[];
    lines.forEach((line) => {
      ensure(height + 1);
      doc.text(line, left, y);
      y += height;
    });
  };

  doc.setTextColor(55, 48, 41);
  doc.setFont('times', 'bold');
  doc.setFontSize(23);
  doc.text('MINA BRUNCH', left, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(168, 124, 59);
  doc.text('TRAITEUR ÉVÉNEMENTIEL · DEMANDE DE DEVIS', left, y);
  y += 7;
  doc.setDrawColor(198, 154, 75);
  doc.line(left, y, right, y);
  y += 10;
  doc.setTextColor(55, 48, 41);
  doc.setFontSize(9);
  doc.text(`Devis ${quoteId}`, left, y);
  doc.text(new Date().toLocaleDateString('fr-FR'), right, y, { align: 'right' });
  y += 10;

  const info = [
    `Client : ${request.name || '—'}`,
    `Entreprise : ${request.company || '—'}`,
    `Téléphone : ${request.phone || '—'}`,
    `E-mail : ${request.email || '—'}`,
    `Budget indicatif : ${request.budget || 'À définir'}`,
    `Facturation : ${request.invoice ? 'Facture demandée' : 'Non demandée'}`,
    `Événement : ${request.eventType || '—'} · ${request.guestCount || '—'} invités`,
    `Date : ${dateLabel(booking.date)} · ${booking.time || '—'}`,
    `Livraison : ${request.address || '—'}, ${request.postalCode || ''} ${request.city || ''}`.trim()
  ];

  doc.setTextColor(55, 48, 41);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  info.forEach((line) => writeWrapped(line));
  y += 6;

  ensure(13);
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('Votre sélection', left, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  detailed.forEach(({ product, qty }) => {
    ensure(8);
    const nameLines = doc.splitTextToSize(product.name, 105) as string[];
    nameLines.forEach((line, index) => {
      ensure(6);
      doc.text(line, left, y);
      if (index === 0) {
        doc.text(`x${qty}`, 150, y);
        doc.text('Sur devis', right, y, { align: 'right' });
      }
      y += 5.5;
    });
  });

  if ((request.notes ?? '').trim()) {
    ensure(18);
    y += 3;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('Besoins particuliers / allergies', left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize((request.notes ?? '').trim(), 170) as string[];
    noteLines.forEach((line) => {
      ensure(5.2);
      doc.text(line, left, y);
      y += 4.5;
    });
  }

  ensure(30);
  y += 8;
  doc.setDrawColor(198, 154, 75);
  doc.line(left, y, right, y);
  y += 8;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(55, 48, 41);
  doc.text('Total estimé', left, y);
  doc.text('Sur devis', right, y, { align: 'right' });
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 92, 83);
  writeWrapped('Tarifs, disponibilité et frais de livraison à confirmer par Mina Brunch.', 170, 4.2);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(232, 224, 214);
    doc.line(left, 279, right, 279);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(130, 122, 113);
    doc.text('Mina Brunch · Île-de-France', left, 286);
    doc.text(`Page ${page}/${pageCount}`, right, 286, { align: 'right' });
  }

  doc.save(`devis-${quoteId.toLowerCase()}.pdf`);
}

installHistoryGuard();
enforceCurrentRoute();

export default function SafetyBoundary({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onRoute = () => enforceCurrentRoute();
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if (!target) return;
      const label = target.textContent?.replace(/\s+/g, ' ').trim() ?? '';

      if (label.includes('Télécharger le devis PDF')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        safeDownloadQuote();
        return;
      }

      if (label.includes('Envoyer à Mina Brunch') && !quotePrerequisites()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        history.replaceState({ mina: true, depth: 0 }, '', fallbackHash());
        dispatchRouteSync(history.state);
      }
    };

    window.addEventListener('hashchange', onRoute);
    window.addEventListener('popstate', onRoute);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener('popstate', onRoute);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return <>{children}</>;
}

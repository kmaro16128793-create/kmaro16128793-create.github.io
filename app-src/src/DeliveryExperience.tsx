import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { jsPDF } from 'jspdf';
import {
  ArrowLeft, Check, ChevronRight, FileDown, LoaderCircle, MapPin, MessageCircle, Search
} from 'lucide-react';
import { business, idfDepartments, products } from './data';

declare global {
  interface Window { L?: any }
}

type StoredCartItem = { productId: string; qty: number };
type StoredRequest = {
  eventType?: string; guestCount?: string; company?: string; name?: string; email?: string; phone?: string;
  address?: string; postalCode?: string; city?: string; budget?: string; invoice?: boolean; notes?: string;
};
type StoredBooking = { date?: string; time?: string };
type DeliveryInfo = {
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  zone: 1 | 2 | 3 | null;
  minimum: number | null;
  fee: number | null;
  verifiedPricing: boolean;
  displayAddress: string;
  updatedAt: number;
};

type Snapshot = {
  cart: StoredCartItem[];
  request: StoredRequest;
  booking: StoredBooking;
};

const MINA_ORIGIN = { lat: 48.906, lng: 2.331 };
const VISUAL_ZONES = [
  { id: 1 as const, maxKm: 5, minimum: 80, fee: 0, verifiedPricing: true },
  { id: 2 as const, maxKm: 10, minimum: null, fee: null, verifiedPricing: false },
  { id: 3 as const, maxKm: 15, minimum: null, fee: null, verifiedPricing: false },
];
const EMPTY_DELIVERY: DeliveryInfo = {
  lat: null, lng: null, distanceKm: null, zone: null, minimum: null, fee: null,
  verifiedPricing: false, displayAddress: '', updatedAt: 0
};

function safeJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}
function safeWrite(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* no-op */ }
}
function validPhone(value = '') {
  return /^(?:(?:\+|00)33|0)[1-9](?:[\s.-]*\d{2}){4}$/.test(value.trim());
}
function validEmail(value = '') {
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}
function getSnapshot(): Snapshot {
  const rawCart = safeJson<unknown>('mina-cart', []);
  const request = safeJson<StoredRequest>('mina-video-request', {});
  const booking = safeJson<StoredBooking>('mina-booking', {});
  const ids = new Set(products.map(p => p.id));
  const cart = Array.isArray(rawCart) ? rawCart.filter((item): item is StoredCartItem => {
    if (!item || typeof item !== 'object') return false;
    const x = item as Partial<StoredCartItem>;
    return typeof x.productId === 'string' && ids.has(x.productId) && Number.isFinite(x.qty) && Number(x.qty) > 0;
  }).map(x => ({ productId: x.productId, qty: Math.max(1, Math.min(99, Math.floor(Number(x.qty)))) })) : [];
  return { cart, request, booking };
}
function orderReady(s = getSnapshot()) {
  return s.cart.length > 0
    && (s.request.name ?? '').trim().length > 1
    && validPhone(s.request.phone)
    && validEmail(s.request.email)
    && (s.request.address ?? '').trim().length > 4
    && /^\d{5}$/.test((s.request.postalCode ?? '').trim())
    && (s.request.city ?? '').trim().length > 1;
}
function quoteReady(s = getSnapshot()) {
  return orderReady(s) && Boolean(s.booking.date) && Boolean(s.booking.time);
}
function routeTo(hash: string, replace = false) {
  const depth = Number(history.state?.depth ?? 0);
  if (replace) history.replaceState({ mina: true, depth }, '', hash);
  else history.pushState({ mina: true, depth: depth + 1 }, '', hash);
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function dateLabel(value?: string) {
  if (!value) return 'À choisir';
  return new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function deliveryFor(lat: number, lng: number, displayAddress: string): DeliveryInfo {
  const distanceKm = haversineKm(MINA_ORIGIN.lat, MINA_ORIGIN.lng, lat, lng);
  const rule = VISUAL_ZONES.find(z => distanceKm <= z.maxKm);
  return {
    lat, lng, distanceKm,
    zone: rule?.id ?? null,
    minimum: rule?.minimum ?? null,
    fee: rule?.fee ?? null,
    verifiedPricing: Boolean(rule?.verifiedPricing),
    displayAddress,
    updatedAt: Date.now()
  };
}
function readDelivery() {
  const value = safeJson<DeliveryInfo>('mina-delivery-zone', EMPTY_DELIVERY);
  return value && typeof value === 'object' ? value : EMPTY_DELIVERY;
}
function getQuoteId() {
  try {
    const existing = sessionStorage.getItem('mina-quote-id');
    if (existing) return existing;
    const id = `MB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    sessionStorage.setItem('mina-quote-id', id);
    return id;
  } catch {
    return `MB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  }
}
function idfAddress(request: StoredRequest) {
  const dept = (request.postalCode ?? '').slice(0, 2);
  return /^\d{5}$/.test(request.postalCode ?? '') && idfDepartments.includes(dept);
}
function deliveryFeeLabel(delivery: DeliveryInfo) {
  if (delivery.verifiedPricing && delivery.fee === 0) return 'Offert';
  if (typeof delivery.fee === 'number') return `${delivery.fee.toFixed(2).replace('.', ',')} €`;
  return 'À confirmer';
}
function minimumLabel(delivery: DeliveryInfo) {
  return typeof delivery.minimum === 'number' ? `${delivery.minimum.toFixed(2).replace('.', ',')} €` : 'À confirmer';
}

export default function DeliveryExperience({ children }: { children: ReactNode }) {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const sync = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  const overlay = hash === '#/zone' ? <DeliveryZoneOverlay />
    : hash === '#/generating' ? <QuoteGeneratingOverlay />
      : hash === '#/quote' ? <QuoteOverlay /> : null;
  return <>{children}{overlay}</>;
}

function DeliveryHeader({ title, back }: { title: string; back: () => void }) {
  return <header className="dx-header">
    <button onClick={back} aria-label="Retour"><ArrowLeft size={22}/></button>
    <h1>{title}</h1><span />
  </header>;
}

function DeliveryZoneOverlay() {
  const snapshot = useMemo(getSnapshot, []);
  const request = snapshot.request;
  const address = [request.address, request.postalCode, request.city].filter(Boolean).join(', ');
  const [delivery, setDelivery] = useState<DeliveryInfo>(() => readDelivery());
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [lookupBusy, setLookupBusy] = useState(false);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const idf = idfAddress(request);

  const commitDelivery = (next: DeliveryInfo) => {
    setDelivery(next); safeWrite('mina-delivery-zone', next);
  };

  const locateAddress = async () => {
    if (!address.trim()) return;
    setLookupBusy(true);
    try {
      const params = new URLSearchParams({ q: `${address}, France`, format: 'jsonv2', limit: '1', countrycodes: 'fr' });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { 'Accept-Language': 'fr' }
      });
      if (!response.ok) throw new Error('geocoding');
      const results = await response.json() as Array<{ lat: string; lon: string; display_name?: string }>;
      if (!results[0]) throw new Error('not-found');
      const lat = Number(results[0].lat), lng = Number(results[0].lon);
      const next = deliveryFor(lat, lng, address);
      commitDelivery(next);
      if (mapRef.current) mapRef.current.setView([lat, lng], 12, { animate: true });
    } catch {
      setStatus(mapRef.current ? 'ready' : 'fallback');
    } finally { setLookupBusy(false); }
  };

  useEffect(() => {
    if (!quoteReady(snapshot)) {
      routeTo(snapshot.cart.length ? '#/order' : '#/cart', true);
      return;
    }
    let cancelled = false;
    let retries = 0;
    let timer: number | undefined;

    const init = () => {
      if (cancelled || !mapEl.current) return;
      const L = window.L;
      if (!L) {
        retries += 1;
        if (retries < 24) timer = window.setTimeout(init, 125);
        else setStatus('fallback');
        return;
      }
      if (mapRef.current) return;
      const initial = delivery.lat != null && delivery.lng != null
        ? [delivery.lat, delivery.lng] : [MINA_ORIGIN.lat, MINA_ORIGIN.lng];
      const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true, preferCanvas: true })
        .setView(initial, delivery.lat != null ? 12 : 10);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      VISUAL_ZONES.slice().reverse().forEach(zone => {
        const circle = L.circle([MINA_ORIGIN.lat, MINA_ORIGIN.lng], {
          radius: zone.maxKm * 1000,
          color: '#b88a43', weight: 1.4, dashArray: zone.id === 1 ? undefined : '5 5',
          fillColor: '#d3ad6d', fillOpacity: zone.id === 1 ? .12 : .07
        }).addTo(map);
        circle.bindTooltip(`Zone ${zone.id}`, {
          permanent: true, direction: 'center', className: `dx-zone-tooltip z${zone.id}`
        });
      });
      L.circleMarker([MINA_ORIGIN.lat, MINA_ORIGIN.lng], {
        radius: 5, color: '#fff', weight: 2, fillColor: '#a87432', fillOpacity: 1
      }).addTo(map).bindTooltip('Mina', { permanent: true, direction: 'bottom', offset: [0, 8], className: 'dx-mina-tooltip' });
      const onMove = () => {
        const c = map.getCenter();
        commitDelivery(deliveryFor(c.lat, c.lng, address));
      };
      map.on('moveend', onMove);
      setStatus('ready');
      window.setTimeout(() => map.invalidateSize(), 60);
      if (!delivery.updatedAt || delivery.displayAddress !== address) locateAddress().catch(() => undefined);
    };
    init();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* no-op */ }
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoneOne = delivery.zone === 1 && delivery.verifiedPricing;
  const visualZone = delivery.zone != null;
  const distanceText = delivery.distanceKm == null ? 'À calculer' : `${delivery.distanceKm.toFixed(1).replace('.', ',')} km`;
  const badge = zoneOne ? 'Dans la zone' : visualZone && idf ? 'Zone détectée' : idf ? 'À vérifier' : 'Hors zone auto';
  const canConfirm = quoteReady(snapshot) && idf;
  const fallbackLat = delivery.lat ?? MINA_ORIGIN.lat;
  const fallbackLng = delivery.lng ?? MINA_ORIGIN.lng;
  const span = .07;
  const fallbackSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${fallbackLng-span}%2C${fallbackLat-span}%2C${fallbackLng+span}%2C${fallbackLat+span}&layer=mapnik&marker=${fallbackLat}%2C${fallbackLng}`;

  return <main className="dx-overlay dx-zone-screen">
    <DeliveryHeader title="Périmètre de livraison" back={() => routeTo('#/order', true)} />
    <section className="dx-zone-body">
      <button className="dx-address" onClick={locateAddress} disabled={lookupBusy}>
        <span>{address || 'Adresse à compléter'}</span>{lookupBusy ? <LoaderCircle className="dx-spin" size={18}/> : <Search size={18}/>} 
      </button>
      <div className="dx-map-hint">Déplacez la carte pour vérifier votre zone</div>
      <div className="dx-map-shell">
        <div ref={mapEl} className={`dx-map-canvas ${status === 'fallback' ? 'is-hidden' : ''}`} />
        {status === 'fallback' && <iframe title="Carte OpenStreetMap de secours" src={fallbackSrc} className="dx-map-fallback" />}
        <div className="dx-center-pin" aria-hidden="true"><MapPin size={34}/></div>
        {status === 'loading' && <div className="dx-map-loading"><LoaderCircle className="dx-spin" size={24}/><span>Chargement de la carte…</span></div>}
      </div>

      <section className={`dx-zone-card ${zoneOne ? 'ok' : ''}`}>
        <div className="dx-zone-card-head"><h2>Périmètre de livraison</h2><span><Check size={14}/>{badge}</span></div>
        <p>{zoneOne
          ? 'Votre adresse est éligible à la livraison. Livraison offerte pour cette zone.'
          : visualZone && idf
            ? `Votre adresse se situe dans l’anneau Zone ${delivery.zone}. Le minimum d’achat et les frais de cette zone restent à confirmer par Mina Brunch.`
            : idf
              ? 'Votre adresse est en Île-de-France mais nécessite une validation manuelle du barème de livraison.'
              : 'Cette adresse sort du périmètre automatique Île-de-France et doit être validée par Mina Brunch.'}</p>
        <div className="dx-zone-metrics">
          <div><small>Zone</small><b>{delivery.zone ? `Zone ${delivery.zone}` : 'À confirmer'}</b></div>
          <div><small>Distance estimée</small><b>{distanceText}</b></div>
          <div><small>Minimum requis</small><b>{minimumLabel(delivery)}</b></div>
          <div><small>Frais de livraison</small><b>{deliveryFeeLabel(delivery)}</b></div>
        </div>
        {zoneOne && <small className="dx-rule-proof">Zone 1 : 0–5 km · minimum 80 € · livraison offerte.</small>}
      </section>
    </section>
    <div className="dx-fixed-cta"><button disabled={!canConfirm} onClick={() => routeTo('#/generating')}>Confirmer cette adresse <ChevronRight size={18}/></button></div>
  </main>;
}

function QuoteGeneratingOverlay() {
  const snapshot = useMemo(getSnapshot, []);
  const delivery = useMemo(readDelivery, []);
  const quoteId = useMemo(getQuoteId, []);
  useEffect(() => {
    if (!quoteReady(snapshot)) {
      routeTo(snapshot.cart.length ? '#/order' : '#/cart', true); return;
    }
    const timer = window.setTimeout(() => routeTo('#/quote', true), 1250);
    return () => window.clearTimeout(timer);
  }, [snapshot]);
  return <main className="dx-overlay dx-quote-screen">
    <DeliveryHeader title="Votre devis" back={() => routeTo('#/zone', true)} />
    <section className="dx-quote-body">
      <div className="dx-status-card loading"><i><LoaderCircle className="dx-spin" size={24}/></i><small>DEVIS N° {quoteId}</small><h2>Création en cours…</h2><p>Nous préparons le récapitulatif complet de votre demande.</p></div>
      <QuoteSummary snapshot={snapshot} delivery={delivery} compact />
    </section>
  </main>;
}

function QuoteOverlay() {
  const snapshot = useMemo(getSnapshot, []);
  const delivery = useMemo(readDelivery, []);
  const quoteId = useMemo(getQuoteId, []);
  useEffect(() => {
    if (!quoteReady(snapshot)) routeTo(snapshot.cart.length ? '#/order' : '#/cart', true);
  }, [snapshot]);

  const detailed = snapshot.cart.map(item => ({ ...item, product: products.find(p => p.id === item.productId) }))
    .filter((x): x is StoredCartItem & { product: (typeof products)[number] } => Boolean(x.product));

  const download = () => downloadQuote(snapshot, delivery, quoteId);
  const whatsapp = () => {
    const lines = detailed.map(x => `• ${x.product.name} x${x.qty}`).join('\n');
    const zone = delivery.zone ? `Zone ${delivery.zone}` : 'Zone à confirmer';
    const distance = delivery.distanceKm == null ? 'à confirmer' : `${delivery.distanceKm.toFixed(1)} km`;
    const text = `Bonjour Mina Brunch, je souhaite confirmer ma demande ${quoteId}.\n\n${lines}\n\nÉvénement : ${snapshot.request.eventType || '—'} · ${snapshot.request.guestCount || '—'} invités\nDate : ${dateLabel(snapshot.booking.date)} · ${snapshot.booking.time || '—'}\nAdresse : ${snapshot.request.address || '—'}, ${snapshot.request.postalCode || ''} ${snapshot.request.city || ''}\nLivraison : ${zone} · distance estimée ${distance} · minimum ${minimumLabel(delivery)} · frais ${deliveryFeeLabel(delivery)}\nContact : ${snapshot.request.name || '—'} · ${snapshot.request.phone || '—'}${snapshot.request.email ? ` · ${snapshot.request.email}` : ''}${snapshot.request.notes ? `\nPrécisions : ${snapshot.request.notes}` : ''}\n\nLes tarifs des créations restent sur devis.`;
    window.open(`https://wa.me/${business.phoneWhatsApp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return <main className="dx-overlay dx-quote-screen">
    <DeliveryHeader title="Votre devis" back={() => routeTo('#/zone', true)} />
    <section className="dx-quote-body">
      <div className="dx-status-card success"><i><Check size={24}/></i><small>DEVIS N° {quoteId}</small><h2>Votre devis est prêt</h2><p>Le récapitulatif reprend votre sélection, votre événement et votre zone de livraison.</p></div>
      <QuoteSummary snapshot={snapshot} delivery={delivery} />
      <section className="dx-selection-card"><label>VOTRE SÉLECTION</label>{detailed.map(({ product, qty }) => <div key={product.id}><span>{product.name} × {qty}</span><b>Sur devis</b></div>)}<div className="strong"><span>Sous-total</span><b>Sur devis</b></div><div><span>Frais de livraison</span><b>{deliveryFeeLabel(delivery)}</b></div><div className="strong"><span>Total estimé</span><b>Sur devis</b></div></section>
      {snapshot.request.notes && <section className="dx-notes-card"><label>BESOINS PARTICULIERS / ALLERGIES</label><p>{snapshot.request.notes}</p></section>}
      <div className="dx-quote-actions"><button className="primary" onClick={download}><FileDown size={17}/> Télécharger mon devis PDF</button><button className="secondary" onClick={whatsapp}><MessageCircle size={17}/> Envoyer à Mina Brunch</button><button className="text" onClick={() => routeTo('#/', true)}>Retour à l’accueil</button></div>
    </section>
  </main>;
}

function QuoteSummary({ snapshot, delivery, compact = false }: { snapshot: Snapshot; delivery: DeliveryInfo; compact?: boolean }) {
  return <>
    <section className="dx-summary-card"><label>CLIENT</label><Row k="Entreprise" v={snapshot.request.company || '—'}/><Row k="Contact" v={snapshot.request.name || '—'}/><Row k="Email" v={snapshot.request.email || '—'}/><Row k="Téléphone" v={snapshot.request.phone || '—'}/></section>
    <section className="dx-summary-card"><label>ÉVÉNEMENT</label><Row k="Type" v={snapshot.request.eventType || '—'}/><Row k="Date" v={dateLabel(snapshot.booking.date)}/><Row k="Créneau" v={snapshot.booking.time || '—'}/><Row k="Invités" v={snapshot.request.guestCount || '—'}/></section>
    {!compact && <section className="dx-summary-card"><label>LIVRAISON</label><Row k="Adresse" v={[snapshot.request.address, snapshot.request.postalCode, snapshot.request.city].filter(Boolean).join(', ') || '—'}/><Row k="Zone" v={delivery.zone ? `Zone ${delivery.zone}` : 'À confirmer'}/><Row k="Distance estimée" v={delivery.distanceKm == null ? 'À confirmer' : `${delivery.distanceKm.toFixed(1).replace('.', ',')} km`}/><Row k="Minimum requis" v={minimumLabel(delivery)}/><Row k="Frais de livraison" v={deliveryFeeLabel(delivery)}/></section>}
  </>;
}
function Row({ k, v }: { k: string; v: string }) { return <div className="dx-row"><span>{k}</span><b>{v}</b></div>; }

function downloadQuote(snapshot: Snapshot, delivery: DeliveryInfo, quoteId: string) {
  if (!quoteReady(snapshot)) return;
  const detailed = snapshot.cart.map(item => ({ ...item, product: products.find(p => p.id === item.productId) }))
    .filter((x): x is StoredCartItem & { product: (typeof products)[number] } => Boolean(x.product));
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 17, right = 193, bodyBottom = 258; let y = 18;
  const lineHeight = 4.6;
  const newPage = () => {
    doc.addPage(); y = 23;
    doc.setFont('times', 'bold'); doc.setFontSize(14); doc.setTextColor(55,48,41); doc.text('MINA BRUNCH', left, 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(168,124,59); doc.text(`DEVIS ${quoteId} · SUITE`, right, 17, { align: 'right' });
  };
  const ensure = (height: number) => { if (y + height > bodyBottom) newPage(); };
  const wrapped = (text: string, width = 170, height = lineHeight) => {
    const lines = doc.splitTextToSize(text, width) as string[];
    lines.forEach(line => { ensure(height + 1); doc.text(line, left, y); y += height; });
  };

  doc.setTextColor(55,48,41); doc.setFont('times','bold'); doc.setFontSize(23); doc.text('MINA BRUNCH', left, y); y += 6;
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(168,124,59); doc.text('TRAITEUR ÉVÉNEMENTIEL · DEMANDE DE DEVIS', left, y); y += 7;
  doc.setDrawColor(198,154,75); doc.line(left,y,right,y); y += 10;
  doc.setTextColor(55,48,41); doc.setFontSize(9); doc.text(`Devis ${quoteId}`, left, y); doc.text(new Date().toLocaleDateString('fr-FR'), right, y, { align:'right' }); y += 10;
  const info = [
    `Client : ${snapshot.request.name || '—'}`,
    `Entreprise : ${snapshot.request.company || '—'}`,
    `Téléphone : ${snapshot.request.phone || '—'}`,
    `E-mail : ${snapshot.request.email || '—'}`,
    `Événement : ${snapshot.request.eventType || '—'} · ${snapshot.request.guestCount || '—'} invités`,
    `Date : ${dateLabel(snapshot.booking.date)} · ${snapshot.booking.time || '—'}`,
    `Livraison : ${snapshot.request.address || '—'}, ${snapshot.request.postalCode || ''} ${snapshot.request.city || ''}`.trim(),
    `Zone : ${delivery.zone ? `Zone ${delivery.zone}` : 'À confirmer'}${delivery.zone === 1 ? ' (0–5 km)' : ''} · Minimum requis : ${minimumLabel(delivery)}`,
    `Distance estimée : ${delivery.distanceKm == null ? 'À confirmer' : `${delivery.distanceKm.toFixed(1).replace('.', ',')} km`} · Frais de livraison : ${deliveryFeeLabel(delivery)}`,
    `Budget indicatif : ${snapshot.request.budget || 'À définir'} · Facturation : ${snapshot.request.invoice ? 'Facture demandée' : 'Non demandée'}`
  ];
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(55,48,41); info.forEach(line => wrapped(line)); y += 6;
  ensure(13); doc.setFont('times','bold'); doc.setFontSize(13); doc.text('Détail de la sélection', left, y); y += 7; doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  detailed.forEach(({ product, qty }) => {
    const lines = doc.splitTextToSize(product.name, 105) as string[];
    lines.forEach((line, index) => { ensure(6); doc.text(line,left,y); if(index===0){doc.text(`x${qty}`,150,y);doc.text('Sur devis',right,y,{align:'right'});} y += 5.5; });
  });
  if ((snapshot.request.notes ?? '').trim()) {
    ensure(18); y += 3; doc.setFont('times','bold'); doc.setFontSize(11); doc.text('Besoins particuliers / allergies',left,y); y += 6;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); (doc.splitTextToSize(snapshot.request.notes!.trim(),170) as string[]).forEach(line => { ensure(5.2); doc.text(line,left,y); y += 4.5; });
  }
  ensure(32); y += 7; doc.setDrawColor(198,154,75); doc.line(left,y,right,y); y += 8; doc.setFont('times','bold'); doc.setFontSize(11); doc.setTextColor(55,48,41);
  doc.text('Sous-total',left,y); doc.text('Sur devis',right,y,{align:'right'}); y += 6;
  doc.text('Frais de livraison',left,y); doc.text(deliveryFeeLabel(delivery),right,y,{align:'right'}); y += 7;
  doc.setFontSize(13); doc.text('Total estimé TTC',left,y); doc.text('Sur devis',right,y,{align:'right'});
  const pages = doc.getNumberOfPages();
  for(let page=1; page<=pages; page+=1){doc.setPage(page);doc.setDrawColor(232,224,214);doc.line(left,279,right,279);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(130,122,113);doc.text('Mina Brunch · Île-de-France',left,286);doc.text(`Page ${page}/${pages}`,right,286,{align:'right'});}
  doc.save(`devis-${quoteId.toLowerCase()}.pdf`);
}

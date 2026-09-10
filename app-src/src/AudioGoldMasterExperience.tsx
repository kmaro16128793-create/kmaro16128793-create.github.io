import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { jsPDF } from 'jspdf';
import { Check, Mail, Send, TriangleAlert } from 'lucide-react';
import { business, products } from './data';

type StoredCartItem = { productId: string; qty: number };
type StoredRequest = {
  eventType?: string; guestCount?: string; company?: string; name?: string; email?: string; phone?: string;
  address?: string; postalCode?: string; city?: string; budget?: string; invoice?: boolean; notes?: string;
};
type StoredBooking = { date?: string; time?: string };
type DeliveryInfo = {
  distanceKm?: number | null; zone?: 1 | 2 | 3 | null; minimum?: number | null; fee?: number | null;
  verifiedPricing?: boolean;
};
type EmailState = 'idle' | 'sending' | 'sent' | 'needs-config' | 'error';

type EmailJsConfig = {
  serviceId: string;
  templateId: string;
  publicKey: string;
};

declare global {
  interface Window {
    __MINA_EMAILJS__?: Partial<EmailJsConfig>;
  }
}

function safeJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function getQuoteId() {
  try {
    const existing = sessionStorage.getItem('mina-quote-id');
    if (existing) return existing;
    const next = `MB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    sessionStorage.setItem('mina-quote-id', next);
    return next;
  } catch {
    return `MB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  }
}

function dateLabel(value?: string) {
  if (!value) return 'À choisir';
  return new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function deliveryFeeLabel(delivery: DeliveryInfo) {
  if (delivery.verifiedPricing && delivery.fee === 0) return 'Offert';
  if (typeof delivery.fee === 'number') return `${delivery.fee.toFixed(2).replace('.', ',')} €`;
  return 'À confirmer';
}

function minimumLabel(delivery: DeliveryInfo) {
  return typeof delivery.minimum === 'number' ? `${delivery.minimum.toFixed(2).replace('.', ',')} €` : 'À confirmer';
}

function readEmailConfig(): EmailJsConfig | null {
  const runtime = window.__MINA_EMAILJS__ ?? {};
  const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {});
  const config = {
    serviceId: runtime.serviceId || env.VITE_MINA_EMAILJS_SERVICE_ID || '',
    templateId: runtime.templateId || env.VITE_MINA_EMAILJS_TEMPLATE_ID || '',
    publicKey: runtime.publicKey || env.VITE_MINA_EMAILJS_PUBLIC_KEY || ''
  };
  return config.serviceId && config.templateId && config.publicKey ? config : null;
}

function quoteSnapshot() {
  const cart = safeJson<StoredCartItem[]>('mina-cart', []);
  const request = safeJson<StoredRequest>('mina-video-request', {});
  const booking = safeJson<StoredBooking>('mina-booking', {});
  const delivery = safeJson<DeliveryInfo>('mina-delivery-zone', {});
  return { cart: Array.isArray(cart) ? cart : [], request, booking, delivery };
}

function quoteIsReady() {
  const { cart, request, booking } = quoteSnapshot();
  return cart.length > 0
    && Boolean(request.name?.trim())
    && Boolean(request.email?.trim())
    && Boolean(request.phone?.trim())
    && Boolean(request.address?.trim())
    && Boolean(request.postalCode?.trim())
    && Boolean(request.city?.trim())
    && Boolean(booking.date)
    && Boolean(booking.time);
}

function buildPdfDataUri(quoteId: string) {
  const { cart, request, booking, delivery } = quoteSnapshot();
  const detailed = cart.map(item => ({ ...item, product: products.find(p => p.id === item.productId) })).filter(x => x.product);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 17, right = 193, bodyBottom = 258;
  let y = 18;
  const newPage = () => {
    doc.addPage(); y = 24;
    doc.setFont('times', 'bold'); doc.setFontSize(14); doc.setTextColor(55,48,41); doc.text('MINA BRUNCH', left, 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(168,124,59); doc.text(`DEVIS ${quoteId} · SUITE`, right, 17, { align: 'right' });
  };
  const ensure = (height: number) => { if (y + height > bodyBottom) newPage(); };
  const write = (text: string, width = 170, step = 4.6) => {
    const lines = doc.splitTextToSize(text, width) as string[];
    lines.forEach(line => { ensure(step + 1); doc.text(line, left, y); y += step; });
  };

  doc.setTextColor(55,48,41); doc.setFont('times','bold'); doc.setFontSize(23); doc.text('MINA BRUNCH', left, y); y += 6;
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(168,124,59); doc.text('TRAITEUR ÉVÉNEMENTIEL · DEMANDE DE DEVIS', left, y); y += 7;
  doc.setDrawColor(198,154,75); doc.line(left,y,right,y); y += 10;
  doc.setTextColor(55,48,41); doc.setFontSize(9); doc.text(`Devis ${quoteId}`, left, y); doc.text(new Date().toLocaleDateString('fr-FR'), right, y, { align:'right' }); y += 10;

  const info = [
    `Contact : ${request.name || '—'}`,
    `Entreprise : ${request.company || '—'}`,
    `E-mail : ${request.email || '—'}`,
    `Téléphone : ${request.phone || '—'}`,
    `Événement : ${request.eventType || '—'} · ${request.guestCount || '—'} invités`,
    `Date : ${dateLabel(booking.date)} · ${booking.time || '—'}`,
    `Livraison : ${request.address || '—'}, ${request.postalCode || ''} ${request.city || ''}`.trim(),
    `Zone : ${delivery.zone ? `Zone ${delivery.zone}` : 'À confirmer'} · Minimum requis : ${minimumLabel(delivery)} · Frais : ${deliveryFeeLabel(delivery)}`,
    `Budget indicatif : ${request.budget || 'À définir'} · Facture : ${request.invoice ? 'Demandée' : 'Non demandée'}`
  ];
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(55,48,41); info.forEach(line => write(line)); y += 6;

  ensure(12); doc.setFont('times','bold'); doc.setFontSize(13); doc.text('Votre sélection', left, y); y += 7;
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  detailed.forEach(({ product, qty }) => {
    if (!product) return;
    ensure(7);
    doc.text(product.name, left, y, { maxWidth: 118 });
    doc.text(`x${qty}`, 154, y);
    doc.text('Sur devis', right, y, { align: 'right' });
    y += 6;
  });

  if (request.notes?.trim()) {
    ensure(18); y += 3; doc.setFont('times','bold'); doc.setFontSize(11); doc.text('Besoins particuliers / allergies', left, y); y += 6;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); write(request.notes.trim(), 170, 4.5);
  }

  ensure(28); y += 7; doc.setDrawColor(198,154,75); doc.line(left,y,right,y); y += 8;
  doc.setFont('times','bold'); doc.setFontSize(12); doc.setTextColor(55,48,41); doc.text('Total estimé', left, y); doc.text('Sur devis', right, y, { align:'right' });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page); doc.setDrawColor(232,224,214); doc.line(left,279,right,279); doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(130,122,113);
    doc.text('Mina Brunch · Île-de-France', left, 286); doc.text(`Page ${page}/${pages}`, right, 286, { align:'right' });
  }
  return doc.output('datauristring');
}

function buildEmailParams(quoteId: string) {
  const { cart, request, booking, delivery } = quoteSnapshot();
  const detailed = cart.map(item => ({ ...item, product: products.find(p => p.id === item.productId) })).filter(x => x.product);
  const items = detailed.map(({ product, qty }) => `${product?.name || 'Création'} × ${qty} — Sur devis`).join('\n');
  const distance = typeof delivery.distanceKm === 'number' ? `${delivery.distanceKm.toFixed(1).replace('.', ',')} km` : 'À confirmer';
  return {
    to_email: request.email || '',
    to_name: request.name || 'Client Mina Brunch',
    reply_to: business.email,
    quote_id: quoteId,
    company: request.company || '—',
    event_type: request.eventType || '—',
    guest_count: request.guestCount || '—',
    event_date: dateLabel(booking.date),
    event_time: booking.time || '—',
    delivery_address: [request.address, request.postalCode, request.city].filter(Boolean).join(', '),
    delivery_zone: delivery.zone ? `Zone ${delivery.zone}` : 'À confirmer',
    delivery_distance: distance,
    delivery_minimum: minimumLabel(delivery),
    delivery_fee: deliveryFeeLabel(delivery),
    budget: request.budget || 'À définir',
    invoice: request.invoice ? 'Oui' : 'Non',
    notes: request.notes || 'Aucune précision',
    items,
    quote_pdf: buildPdfDataUri(quoteId),
    website: 'https://kmaro16128793-create.github.io/app/'
  };
}

async function sendAutomaticQuoteEmail(config: EmailJsConfig, quoteId: string) {
  const payload = {
    service_id: config.serviceId,
    template_id: config.templateId,
    user_id: config.publicKey,
    template_params: buildEmailParams(quoteId)
  };
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`emailjs-${response.status}`);
}

function openEmailFallback() {
  const { request, booking, delivery } = quoteSnapshot();
  const quoteId = getQuoteId();
  const subject = `Votre devis Mina Brunch ${quoteId}`;
  const body = [
    `Bonjour ${request.name || ''},`, '',
    `Votre demande Mina Brunch ${quoteId} est prête.`,
    `Événement : ${request.eventType || '—'} · ${request.guestCount || '—'} invités`,
    `Date : ${dateLabel(booking.date)} · ${booking.time || '—'}`,
    `Livraison : ${delivery.zone ? `Zone ${delivery.zone}` : 'À confirmer'} · minimum ${minimumLabel(delivery)} · frais ${deliveryFeeLabel(delivery)}`,
    '', 'Les tarifs des créations restent sur devis.', '', 'Mina Brunch'
  ].join('\n');
  window.location.href = `mailto:${encodeURIComponent(request.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function AudioGoldMasterExperience({ children }: { children: ReactNode }) {
  const [hash, setHash] = useState(location.hash || '#/');
  const [state, setState] = useState<EmailState>('idle');
  const [message, setMessage] = useState('');
  const quoteId = useMemo(getQuoteId, [hash]);

  useEffect(() => {
    const sync = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  useEffect(() => {
    if (hash !== '#/quote' || !quoteIsReady()) {
      setState('idle'); setMessage(''); return;
    }
    const { request } = quoteSnapshot();
    const email = request.email?.trim() || '';
    if (!email) return;
    const sentKey = `mina-email-sent:${quoteId}:${email.toLowerCase()}`;
    try {
      if (sessionStorage.getItem(sentKey) === '1') {
        setState('sent'); setMessage(`Devis déjà envoyé automatiquement à ${email}`); return;
      }
    } catch { /* no-op */ }

    const config = readEmailConfig();
    if (!config) {
      setState('needs-config');
      setMessage(`Envoi automatique prêt pour ${email}, mais le service e-mail doit être connecté une seule fois.`);
      return;
    }

    let cancelled = false;
    setState('sending'); setMessage(`Envoi automatique du devis à ${email}…`);
    sendAutomaticQuoteEmail(config, quoteId)
      .then(() => {
        if (cancelled) return;
        try { sessionStorage.setItem(sentKey, '1'); } catch { /* no-op */ }
        setState('sent'); setMessage(`Devis envoyé automatiquement à ${email}`);
      })
      .catch(() => {
        if (cancelled) return;
        setState('error'); setMessage(`L’envoi automatique vers ${email} n’a pas abouti. Utilisez l’envoi e-mail de secours.`);
      });
    return () => { cancelled = true; };
  }, [hash, quoteId]);

  return <>
    {children}
    {hash === '#/quote' && state !== 'idle' && <aside className={`agm-email agm-${state}`} role="status" aria-live="polite">
      <div className="agm-email-icon">{state === 'sent' ? <Check size={18}/> : state === 'error' ? <TriangleAlert size={18}/> : <Mail size={18}/>}</div>
      <div className="agm-email-copy"><small>ENVOI DU DEVIS</small><b>{state === 'sending' ? 'Envoi automatique…' : state === 'sent' ? 'E-mail envoyé' : state === 'needs-config' ? 'E-mail automatique à activer' : 'Envoi à relancer'}</b><span>{message}</span></div>
      {(state === 'needs-config' || state === 'error') && <button onClick={openEmailFallback}><Send size={15}/> Envoyer par e-mail</button>}
    </aside>}
  </>;
}

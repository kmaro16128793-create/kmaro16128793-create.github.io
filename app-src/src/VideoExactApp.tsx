import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Building2, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  FileDown, Heart, LoaderCircle, Mail, MapPin, Menu, Minus, Phone, Plus, ReceiptText,
  Search, ShoppingBag, Sparkles, Trash2, UserRound, X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { business, categories, idfDepartments, products } from './data';
import type { Booking, CartItem, Category, Product } from './types';

type View = 'home' | 'product' | 'cart' | 'order' | 'date' | 'zone' | 'generating' | 'quote' | 'about';

type RequestInfo = {
  eventType: string;
  guestCount: string;
  company: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  budget: string;
  invoice: boolean;
  notes: string;
};

const defaultRequest: RequestInfo = {
  eventType: 'Réunion', guestCount: '', company: '', name: '', email: '', phone: '',
  address: '', postalCode: '', city: '', budget: '', invoice: false, notes: ''
};

const eventTypes = ['Séminaire', 'Réunion', 'Réception', 'Mariage', 'Autre'];
const timeSlots = ['08h', '10h', '12h', '14h', '16h', '18h'];
const socials = [
  { name: 'TikTok', handle: '@minabrunchtraiteur', href: 'https://www.tiktok.com/@minabrunchtraiteur', icon: '/app/social/tiktok.svg', tone: 'tiktok' },
  { name: 'Instagram', handle: '@minatraiteur93', href: 'https://www.instagram.com/minatraiteur93', icon: '/app/social/instagram.svg', tone: 'instagram' },
  { name: 'Instagram', handle: '@minatraiteurevents', href: 'https://www.instagram.com/minatraiteurevents', icon: '/app/social/instagram.svg', tone: 'instagram' },
] as const;

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}
function safeWrite(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* memory fallback */ }
}
function validEmail(v: string) { return !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v.trim()); }
function validPhone(v: string) { return /^(?:(?:\+|00)33|0)[1-9](?:[\s.-]*\d{2}){4}$/.test(v.trim()); }
function dateLabel(v: string) {
  if (!v) return 'À choisir';
  return new Date(`${v}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function routeFromHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [head, id] = hash.split('/');
  if (head === 'produit' && id) return { view: 'product' as View, productId: id };
  const allowed: View[] = ['cart','order','date','zone','generating','quote','about'];
  return { view: allowed.includes(head as View) ? head as View : 'home' as View, productId: '' };
}
function hashFor(view: View, product?: Product) {
  if (view === 'home') return '#/';
  if (view === 'product' && product) return `#/produit/${product.id}`;
  return `#/${view}`;
}

function getFrenchHolidaySet(year: number) {
  const days = new Set<string>([
    `${year}-01-01`, `${year}-05-01`, `${year}-05-08`, `${year}-07-14`,
    `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`
  ]);
  const easter = easterSunday(year);
  const add = (offset: number) => {
    const d = new Date(easter); d.setDate(d.getDate() + offset);
    days.add(d.toISOString().slice(0, 10));
  };
  add(1); add(39); add(50);
  return days;
}
function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`vx-brand ${compact ? 'compact' : ''}`}>
    <img src="/images/logo.jpg" alt="Logo Mina Brunch" />
    <div><strong>MINA BRUNCH</strong><small>TRAITEUR ÉVÉNEMENTIEL</small></div>
  </div>;
}

function Header({ title, onBack, cartCount, onMenu, onCart }: {
  title?: string; onBack?: () => void; cartCount?: number; onMenu?: () => void; onCart?: () => void;
}) {
  return <header className="vx-header">
    <div>{onBack ? <button className="vx-icon" onClick={onBack} aria-label="Retour"><ArrowLeft size={21}/></button> : onMenu ? <button className="vx-icon" onClick={onMenu} aria-label="Menu"><Menu size={21}/></button> : null}</div>
    <div className="vx-header-center">{title ? <span className="vx-header-title">{title}</span> : <Brand compact/>}</div>
    <div>{onCart && <button className="vx-icon vx-cart-icon" onClick={onCart} aria-label="Panier"><ShoppingBag size={20}/>{Boolean(cartCount) && <b>{cartCount}</b>}</button>}</div>
  </header>;
}

function SocialBlock({ compact = false }: { compact?: boolean }) {
  return <section className={`vx-socials ${compact ? 'compact' : ''}`}>
    {!compact && <><span className="vx-kicker">RÉSEAUX SOCIAUX</span><h3>Retrouvez Mina Brunch</h3></>}
    <div className="vx-social-grid">{socials.map(s => <a key={s.handle} href={s.href} target="_blank" rel="noreferrer" className="vx-social-link">
      <i className={`vx-social-icon ${s.tone}`}><img src={s.icon} alt=""/></i><span><b>{s.name}</b><small>{s.handle}</small></span>
    </a>)}</div>
  </section>;
}

export default function VideoExactApp() {
  const initial = useMemo(routeFromHash, []);
  const [view, setView] = useState<View>(initial.view);
  const [activeProduct, setActiveProduct] = useState<Product>(() => products.find(p => p.id === initial.productId) ?? products[0]);
  const [cart, setCart] = useState<CartItem[]>(() => safeRead<CartItem[]>('mina-cart', []));
  const [request, setRequest] = useState<RequestInfo>(() => safeRead<RequestInfo>('mina-video-request', defaultRequest));
  const [booking, setBooking] = useState<Booking>(() => safeRead<Booking>('mina-booking', { date: '', time: '' }));
  const [category, setCategory] = useState<Category>('Tous');
  const [query, setQuery] = useState('');
  const [liked, setLiked] = useState<string[]>([]);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => safeWrite('mina-cart', cart), [cart]);
  useEffect(() => safeWrite('mina-video-request', request), [request]);
  useEffect(() => safeWrite('mina-booking', booking), [booking]);

  useEffect(() => {
    if (!location.hash) history.replaceState({ mina: true, depth: 0 }, '', `${location.pathname}${location.search}#/`);
    const sync = () => {
      const route = routeFromHash();
      if (route.view === 'product') {
        const p = products.find(x => x.id === route.productId);
        if (p) setActiveProduct(p); else { history.replaceState({ mina: true, depth: 0 }, '', '#/'); setView('home'); return; }
      }
      setView(route.view); setDrawer(false); scrollTo({ top: 0, behavior: 'auto' });
    };
    addEventListener('popstate', sync); addEventListener('hashchange', sync);
    return () => { removeEventListener('popstate', sync); removeEventListener('hashchange', sync); };
  }, []);

  const go = (next: View, product?: Product, replace = false) => {
    const hash = hashFor(next, product ?? activeProduct);
    const depth = Number(history.state?.depth ?? 0);
    if (replace) history.replaceState({ mina: true, depth }, '', hash);
    else history.pushState({ mina: true, depth: depth + 1 }, '', hash);
    if (product) setActiveProduct(product);
    setDrawer(false); setView(next); scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = (fallback: View) => Number(history.state?.depth ?? 0) > 0 ? history.back() : go(fallback, undefined, true);
  const detailed = useMemo(() => cart.map(x => ({ ...x, product: products.find(p => p.id === x.productId) })).filter((x): x is CartItem & { product: Product } => Boolean(x.product)), [cart]);
  const cartCount = detailed.reduce((s, x) => s + x.qty, 0);
  const add = (p: Product, q = 1) => setCart(prev => {
    const safe = Math.max(1, Math.min(99, Math.floor(q)));
    const found = prev.find(x => x.productId === p.id);
    return found ? prev.map(x => x.productId === p.id ? { ...x, qty: Math.min(99, x.qty + safe) } : x) : [...prev, { productId: p.id, qty: safe }];
  });
  const changeQty = (id: string, d: number) => setCart(prev => prev.map(x => x.productId === id ? { ...x, qty: Math.max(0, Math.min(99, x.qty + d)) } : x).filter(x => x.qty > 0));

  return <div className="vx-app"><div className="vx-phone">
    {view === 'home' && <HomeScreen {...{ category, setCategory, query, setQuery, cartCount, liked, setLiked, add, go }} onMenu={() => setDrawer(true)} />}
    {view === 'product' && <ProductScreen product={activeProduct} liked={liked.includes(activeProduct.id)} onLike={() => setLiked(v => v.includes(activeProduct.id) ? v.filter(id => id !== activeProduct.id) : [...v, activeProduct.id])} add={add} go={go} back={() => back('home')} />}
    {view === 'cart' && <CartScreen items={detailed} cartCount={cartCount} request={request} changeQty={changeQty} go={go} back={() => back('home')} />}
    {view === 'order' && <OrderScreen items={detailed} cartCount={cartCount} request={request} setRequest={setRequest} booking={booking} go={go} back={() => back('cart')} />}
    {view === 'date' && <DateScreen booking={booking} setBooking={setBooking} request={request} go={go} back={() => back('order')} />}
    {view === 'zone' && <ZoneScreen request={request} go={go} back={() => back('order')} />}
    {view === 'generating' && <GeneratingScreen go={go} />}
    {view === 'quote' && <QuoteScreen items={detailed} request={request} booking={booking} go={go} back={() => back('zone')} />}
    {view === 'about' && <AboutScreen go={go} back={() => back('home')} />}
    {drawer && <Drawer close={() => setDrawer(false)} go={go} cartCount={cartCount}/>} 
  </div></div>;
}

function HomeScreen({ category, setCategory, query, setQuery, cartCount, liked, setLiked, add, go, onMenu }: {
  category: Category; setCategory: (x: Category) => void; query: string; setQuery: (x: string) => void; cartCount: number;
  liked: string[]; setLiked: React.Dispatch<React.SetStateAction<string[]>>; add: (p: Product, q?: number) => void;
  go: (v: View, p?: Product) => void; onMenu: () => void;
}) {
  const filtered = products.filter(p => (category === 'Tous' || p.category === category) && p.name.toLowerCase().includes(query.toLowerCase()));
  return <main className="vx-screen vx-home vx-bottom-space">
    <Header cartCount={cartCount} onMenu={onMenu} onCart={() => go('cart')} />
    <section className="vx-hero">
      <div className="vx-hero-copy"><span>COMMANDE SUR MESURE</span><h1>Pour vos événements<br/>d’entreprise</h1><div><small>✦ Qualité artisanale</small><small>● Livraison IDF</small><small>▣ Devis personnalisé</small></div></div>
      <img src="/images/box-mix.png" alt="Créations Mina Brunch" fetchPriority="high" />
    </section>
    <div className="vx-search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une création..." aria-label="Rechercher"/><Search size={20}/></div>
    <div className="vx-cats">{categories.map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div>
    <div className="vx-section-title"><h2>Nos créations</h2><span/></div>
    <section className="vx-grid">{filtered.map(p => <article key={p.id} className="vx-card">
      <button className="vx-card-image" onClick={() => go('product', p)}><img src={p.image} alt={p.name} loading="lazy"/></button>
      <button className={`vx-heart ${liked.includes(p.id) ? 'on' : ''}`} onClick={() => setLiked(v => v.includes(p.id) ? v.filter(id => id !== p.id) : [...v, p.id])} aria-label="Favori"><Heart size={15} fill={liked.includes(p.id) ? 'currentColor' : 'none'}/></button>
      <button className="vx-card-copy" onClick={() => go('product', p)}><b>{p.name}</b><span>Sur devis</span></button>
      <button className="vx-add" onClick={() => add(p)} aria-label={`Ajouter ${p.name}`}><Plus size={15}/></button>
    </article>)}</section>
    {filtered.length === 0 && <div className="vx-empty"><Search size={26}/><p>Aucune création trouvée.</p></div>}
    <div className="vx-fixed-cta"><button className="vx-primary" onClick={() => go(cartCount ? 'cart' : 'home')}><ShoppingBag size={18}/>{cartCount ? `Composer mon plateau · ${cartCount}` : 'Composer un plateau'}</button></div>
  </main>;
}

function ProductScreen({ product, liked, onLike, add, go, back }: { product: Product; liked: boolean; onLike: () => void; add: (p: Product, q?: number) => void; go: (v: View) => void; back: () => void }) {
  const [qty, setQty] = useState(1); const [open, setOpen] = useState(true);
  return <main className="vx-screen vx-product vx-bottom-space">
    <Header title="Détail de la création" onBack={back} />
    <button className={`vx-detail-heart ${liked ? 'on' : ''}`} onClick={onLike}><Heart size={20} fill={liked ? 'currentColor' : 'none'}/></button>
    <div className="vx-product-stage"><img src={product.image} alt={product.name}/><div className="vx-dots"><b/><i/><i/></div></div>
    <section className="vx-product-info"><h1>{product.name}</h1><strong>Sur devis</strong><p>{product.description}</p>
      <button className="vx-accordion" onClick={() => setOpen(v => !v)}><span>Composition</span><ChevronDown size={18} className={open ? 'rot' : ''}/></button>
      {open && <div className="vx-composition">{product.composition.map(x => <span key={x}>• {x}</span>)}<small>Allergènes : à confirmer avec Mina Brunch selon la composition finale.</small></div>}
      <div className="vx-qty"><span>Quantité</span><div><button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={16}/></button><b>{qty}</b><button onClick={() => setQty(Math.min(99, qty + 1))}><Plus size={16}/></button></div></div>
      <div className="vx-line-total"><span>Total</span><b>Sur devis</b></div>
    </section>
    <div className="vx-fixed-cta"><button className="vx-primary" onClick={() => { add(product, qty); go('cart'); }}>Ajouter au plateau <ShoppingBag size={17}/></button></div>
  </main>;
}

function CartScreen({ items, cartCount, request, changeQty, go, back }: { items: Array<CartItem & { product: Product }>; cartCount: number; request: RequestInfo; changeQty: (id: string, d: number) => void; go: (v: View) => void; back: () => void }) {
  return <main className="vx-screen vx-cart-page vx-bottom-space">
    <Header title="Composer mon plateau" onBack={back}/>
    <section className="vx-format"><div className="vx-format-icon">◇</div><div><small>Format entreprise</small><b>{request.guestCount ? `${request.guestCount} invités` : 'Nombre d’invités à définir'}</b><span>Composition sur mesure</span></div><button onClick={() => go('order')}>Modifier</button></section>
    <section className="vx-cart-content"><h2>Votre sélection</h2>{items.length === 0 ? <div className="vx-empty"><ShoppingBag size={30}/><p>Ajoutez des créations pour composer votre plateau.</p><button onClick={() => go('home')}>Voir les créations</button></div> : <>
      <div className="vx-cart-list">{items.map(({ product, qty }) => <div className="vx-cart-row" key={product.id}><img src={product.image} alt=""/><div><b>{product.name}</b><span>{qty} pièce{qty > 1 ? 's' : ''} · Sur devis</span></div><div className="vx-step"><button onClick={() => changeQty(product.id, -1)}>{qty === 1 ? <Trash2 size={15}/> : <Minus size={15}/>}</button><b>{qty}</b><button onClick={() => changeQty(product.id, 1)}><Plus size={15}/></button></div></div>)}</div>
      <button className="vx-more" onClick={() => go('home')}><Plus size={17}/> Ajouter d’autres créations</button>
    </>}</section>
    {items.length > 0 && <div className="vx-cart-totals"><div><span>Total sélectionné</span><b>{cartCount} pièces</b></div><div><span>Tarif estimé</span><b>Sur devis</b></div></div>}
    {items.length > 0 && <div className="vx-fixed-cta"><button className="vx-primary" onClick={() => go('order')}>Continuer <ChevronRight size={18}/></button></div>}
  </main>;
}

function OrderScreen({ items, cartCount, request, setRequest, booking, go, back }: {
  items: Array<CartItem & { product: Product }>; cartCount: number; request: RequestInfo; setRequest: React.Dispatch<React.SetStateAction<RequestInfo>>;
  booking: Booking; go: (v: View) => void; back: () => void;
}) {
  const set = <K extends keyof RequestInfo>(key: K, value: RequestInfo[K]) => setRequest(v => ({ ...v, [key]: value }));
  const ready = request.name.trim().length > 1 && validPhone(request.phone) && validEmail(request.email) && request.address.trim().length > 4 && /^\d{5}$/.test(request.postalCode) && request.city.trim().length > 1;
  const next = () => !booking.date || !booking.time ? go('date') : ready ? go('zone') : undefined;
  return <main className="vx-screen vx-order vx-bottom-space"><Header title="Commande entreprise" onBack={back}/>
    <section className="vx-order-summary"><div><span>Total articles</span><b>{cartCount} pièces</b></div><div><span>Sous-total</span><b>Sur devis</b></div><div><span>Frais de livraison</span><b>À confirmer</b></div><div className="strong"><span>Total estimé</span><b>Sur devis</b></div></section>
    <section className="vx-form">
      <FieldLabel text="TYPE D’ÉVÉNEMENT"/><div className="vx-chips">{eventTypes.map(x => <button key={x} className={request.eventType === x ? 'active' : ''} onClick={() => set('eventType', x)}>{x}</button>)}</div>
      <Input label="NOMBRE D’INVITÉS" value={request.guestCount} onChange={v => set('guestCount', v.replace(/\D/g,'').slice(0,4))} placeholder="40" inputMode="numeric"/>
      <div className="vx-two"><Pseudo label="DATE" value={dateLabel(booking.date)} icon={<CalendarDays size={16}/>} onClick={() => go('date')}/><Pseudo label="HEURE" value={booking.time || 'À choisir'} icon={<CalendarDays size={16}/>} onClick={() => go('date')}/></div>
      <Input label="ADRESSE DE LIVRAISON" value={request.address} onChange={v => set('address', v)} placeholder="12 rue..." icon={<MapPin size={16}/>}/>
      <div className="vx-two"><Input label="CODE POSTAL" value={request.postalCode} onChange={v => set('postalCode', v.replace(/\D/g,'').slice(0,5))} placeholder="75000" inputMode="numeric"/><Input label="VILLE" value={request.city} onChange={v => set('city', v)} placeholder="Paris"/></div>
      <Input label="ENTREPRISE" value={request.company} onChange={v => set('company', v)} placeholder="Nom de l’entreprise" icon={<Building2 size={16}/>}/>
      <Input label="PERSONNE DE CONTACT" value={request.name} onChange={v => set('name', v)} placeholder="Nom et prénom" icon={<UserRound size={16}/>}/>
      <Input label="E-MAIL" value={request.email} onChange={v => set('email', v)} placeholder="contact@entreprise.fr" icon={<Mail size={16}/>} type="email"/>
      <Input label="TÉLÉPHONE" value={request.phone} onChange={v => set('phone', v)} placeholder="06 12 34 56 78" icon={<Phone size={16}/>} type="tel"/>
      <label className="vx-field"><span>BUDGET INDICATIF</span><div><ReceiptText size={16}/><select value={request.budget} onChange={e => set('budget', e.target.value)}><option value="">À définir</option><option>Moins de 250 €</option><option>250 – 500 €</option><option>500 – 1 000 €</option><option>Plus de 1 000 €</option></select><ChevronDown size={15}/></div></label>
      <label className="vx-toggle"><span><b>Besoin de facture</b><small>Pour votre comptabilité</small></span><input type="checkbox" checked={request.invoice} onChange={e => set('invoice', e.target.checked)}/><i/></label>
      <label className="vx-notes"><span>BESOINS PARTICULIERS / ALLERGIES</span><textarea value={request.notes} onChange={e => set('notes', e.target.value.slice(0,1200))} placeholder="Précisez les allergies, contraintes ou demandes particulières..." rows={4}/></label>
      {!ready && booking.date && booking.time && <p className="vx-error">Complétez le contact et l’adresse de livraison avant de continuer.</p>}
      {items.length === 0 && <p className="vx-error">Votre plateau est vide.</p>}
    </section>
    <div className="vx-fixed-cta"><button className="vx-primary" disabled={!items.length || (Boolean(booking.date && booking.time) && !ready)} onClick={next}>{!booking.date || !booking.time ? 'Réservez votre date' : 'Vérifier la zone de livraison'} <ChevronRight size={18}/></button><small>Aucun paiement n’est effectué dans l’application</small></div>
  </main>;
}

function FieldLabel({ text }: { text: string }) { return <span className="vx-field-label">{text}</span>; }
function Input({ label, value, onChange, placeholder, icon, type='text', inputMode }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; icon?: React.ReactNode; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }) {
  return <label className="vx-field"><span>{label}</span><div>{icon}<input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} inputMode={inputMode}/></div></label>;
}
function Pseudo({ label, value, icon, onClick }: { label: string; value: string; icon: React.ReactNode; onClick: () => void }) { return <button className="vx-pseudo" onClick={onClick}><span>{label}</span><div>{icon}<b>{value}</b></div></button>; }

function DateScreen({ booking, setBooking, request, go, back }: { booking: Booking; setBooking: React.Dispatch<React.SetStateAction<Booking>>; request: RequestInfo; go: (v: View) => void; back: () => void }) {
  const today = new Date(); const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = cursor.getFullYear(), month = cursor.getMonth(), holidays = getFrenchHolidaySet(year);
  const first = (new Date(year, month, 1).getDay() + 6) % 7, count = new Date(year, month + 1, 0).getDate();
  const isPast = (d: number) => new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const iso = (d: number) => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const unavailable = (d: number) => { const date = new Date(year, month, d); return isPast(d) || date.getDay() === 0 || holidays.has(iso(d)); };
  const addressReady = request.address.trim().length > 4 && /^\d{5}$/.test(request.postalCode) && request.city.trim().length > 1;
  return <main className="vx-screen vx-date vx-bottom-space"><Header title="Réservez votre date" onBack={back}/><section className="vx-date-content"><p>Choisissez la date et le créneau de livraison. Dimanches et jours fériés indisponibles.</p>
    <div className="vx-calendar-head"><button onClick={() => setCursor(new Date(year,month-1,1))} disabled={year===today.getFullYear()&&month===today.getMonth()}><ChevronLeft/></button><b>{cursor.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</b><button onClick={() => setCursor(new Date(year,month+1,1))}><ChevronRight/></button></div>
    <div className="vx-week">{['L','M','M','J','V','S','D'].map((x,i)=><span key={i}>{x}</span>)}</div>
    <div className="vx-calendar">{Array.from({length:first}).map((_,i)=><i key={`e${i}`}/>) }{Array.from({length:count}).map((_,i)=>{ const d=i+1, value=iso(d), off=unavailable(d); return <button key={d} disabled={off} className={booking.date===value?'selected':''} onClick={() => setBooking(v=>({...v,date:value}))}>{d}</button>; })}</div>
    {booking.date && <div className="vx-available"><Check size={16}/><span><b>Votre date est disponible</b><small>Sous réserve de confirmation finale</small></span></div>}
    <FieldLabel text="CRÉNEAU DE LIVRAISON"/><div className="vx-slots">{timeSlots.map(t => <button key={t} className={booking.time===t?'active':''} onClick={()=>setBooking(v=>({...v,time:t}))}>{t}</button>)}</div>
  </section><div className="vx-fixed-cta"><button className="vx-primary" disabled={!booking.date||!booking.time} onClick={()=>go(addressReady ? 'zone' : 'order')}>{addressReady ? 'Vérifier la zone de livraison' : 'Continuer la demande'} <ChevronRight size={18}/></button></div></main>;
}

function ZoneScreen({ request, go, back }: { request: RequestInfo; go: (v: View) => void; back: () => void }) {
  const dept = request.postalCode.slice(0,2); const eligible = /^\d{5}$/.test(request.postalCode) && idfDepartments.includes(dept);
  return <main className="vx-screen vx-zone vx-bottom-space"><Header title="Périmètre de livraison" onBack={back}/><section className="vx-zone-content">
    <div className="vx-address"><MapPin size={17}/><span>{request.address || 'Adresse à compléter'}{request.postalCode && <small>{request.postalCode} {request.city}</small>}</span><Search size={18}/></div>
    <div className="vx-map-wrap"><iframe title="Carte interactive de la zone de livraison" src="https://www.openstreetmap.org/export/embed.html?bbox=2.236%2C48.842%2C2.425%2C48.953&layer=mapnik&marker=48.906%2C2.331" loading="lazy"/><div className="vx-rings"><i className="r3">ZONE 3</i><i className="r2">ZONE 2</i><i className="r1">ZONE 1</i><b><MapPin size={22}/><small>Mina</small></b></div></div>
    <div className={`vx-zone-result ${eligible?'ok':'manual'}`}><div><span>PÉRIMÈTRE DE LIVRAISON</span><h2>{eligible ? 'Dans la zone' : 'Vérification nécessaire'}</h2><p>{eligible ? 'Votre code postal est en Île-de-France. La distance exacte et les frais de livraison seront confirmés par Mina Brunch.' : 'Cette adresse nécessite une validation manuelle par Mina Brunch avant confirmation.'}</p></div><em>{eligible ? <><Check size={14}/> Éligible</> : <><MapPin size={14}/> À vérifier</>}</em></div>
  </section><div className="vx-fixed-cta"><button className="vx-primary" onClick={()=>go('generating')}>Confirmer cette adresse <ChevronRight size={18}/></button></div></main>;
}

function GeneratingScreen({ go }: { go: (v: View, p?: Product, replace?: boolean) => void }) {
  useEffect(() => { const t=setTimeout(()=>go('quote',undefined,true), 1100); return ()=>clearTimeout(t); }, [go]);
  return <main className="vx-screen vx-generating"><div className="vx-loader"><LoaderCircle className="spin" size={42}/><h1>Création du devis…</h1><p>Nous préparons le récapitulatif complet de votre demande.</p></div></main>;
}

function QuoteScreen({ items, request, booking, go, back }: { items: Array<CartItem & { product: Product }>; request: RequestInfo; booking: Booking; go: (v: View) => void; back: () => void }) {
  const quoteId = useMemo(()=>`MB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,[]);
  const download = () => {
    const doc=new jsPDF({unit:'mm',format:'a4'}); const left=17, right=193; let y=18;
    doc.setTextColor(55,48,41); doc.setFont('times','bold'); doc.setFontSize(23); doc.text('MINA BRUNCH',left,y); y+=6;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(168,124,59); doc.text('TRAITEUR ÉVÉNEMENTIEL · DEMANDE DE DEVIS',left,y); y+=7; doc.setDrawColor(198,154,75); doc.line(left,y,right,y); y+=10;
    doc.setTextColor(55,48,41); doc.setFontSize(9); doc.text(`Devis ${quoteId}`,left,y); doc.text(new Date().toLocaleDateString('fr-FR'),right,y,{align:'right'}); y+=10;
    const info=[`Client : ${request.name || '—'}`,`Entreprise : ${request.company || '—'}`,`Téléphone : ${request.phone || '—'}`,`E-mail : ${request.email || '—'}`,`Budget indicatif : ${request.budget || 'À définir'}`,`Facturation : ${request.invoice ? 'Facture demandée' : 'Non demandée'}`,`Événement : ${request.eventType} · ${request.guestCount || '—'} invités`,`Date : ${dateLabel(booking.date)} · ${booking.time || '—'}`,`Livraison : ${request.address}, ${request.postalCode} ${request.city}`];
    info.forEach(line=>{ const lines=doc.splitTextToSize(line,170); doc.text(lines,left,y); y+=lines.length*4.6; }); y+=6;
    doc.setFont('times','bold'); doc.setFontSize(13); doc.text('Votre sélection',left,y); y+=7; doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    items.forEach(({product,qty})=>{ if(y>255){doc.addPage();y=20;} doc.text(product.name,left,y); doc.text(`x${qty}`,150,y); doc.text('Sur devis',right,y,{align:'right'}); y+=7; });
    if(request.notes.trim()){ y+=3; doc.setFont('times','bold'); doc.setFontSize(11); doc.text('Besoins particuliers / allergies',left,y); y+=6; doc.setFont('helvetica','normal'); doc.setFontSize(8); const n=doc.splitTextToSize(request.notes,170); doc.text(n,left,y); y+=n.length*4.5; }
    y=Math.min(265,y+8); doc.setDrawColor(198,154,75); doc.line(left,y,right,y); y+=8; doc.setFont('times','bold'); doc.setFontSize(12); doc.text('Total estimé',left,y); doc.text('Sur devis',right,y,{align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(100,92,83); doc.text('Tarifs, disponibilité et frais de livraison à confirmer par Mina Brunch.',left,y+10,{maxWidth:170});
    doc.save(`devis-${quoteId.toLowerCase()}.pdf`);
  };
  const whatsapp=()=>{ const lines=items.map(x=>`• ${x.product.name} x${x.qty}`).join('\n'); const text=`Bonjour Mina Brunch, je souhaite confirmer ma demande ${quoteId}.\n\n${lines}\n\nÉvénement : ${request.eventType} · ${request.guestCount||'—'} invités\nDate : ${dateLabel(booking.date)} · ${booking.time||'—'}\nAdresse : ${request.address}, ${request.postalCode} ${request.city}\nContact : ${request.name} · ${request.phone}${request.email?` · ${request.email}`:''}\nBudget indicatif : ${request.budget||'À définir'}\nFacture : ${request.invoice?'Oui':'Non'}${request.notes?`\nPrécisions : ${request.notes}`:''}\n\nJe comprends que le tarif et la livraison restent à confirmer.`; open(`https://wa.me/${business.phoneWhatsApp}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer'); };
  return <main className="vx-screen vx-quote"><Header title="Votre devis" onBack={back}/><section className="vx-quote-content"><div className="vx-success"><i><Check size={22}/></i><span>VOTRE DEVIS</span><h1>Devis créé avec succès</h1><p>Voici le récapitulatif de votre demande. Mina Brunch vous confirme ensuite le tarif et le créneau.</p></div>
    <section className="vx-quote-section"><label>DEVIS</label><Row k="Référence" v={quoteId}/><Row k="Entreprise" v={request.company||'—'}/><Row k="Contact" v={request.name||'—'}/><Row k="E-mail" v={request.email||'—'}/><Row k="Téléphone" v={request.phone||'—'}/><Row k="Événement" v={`${request.eventType} · ${request.guestCount||'—'} invités`}/><Row k="Date" v={`${dateLabel(booking.date)} · ${booking.time||'—'}`}/><Row k="Livraison" v={`${request.postalCode} ${request.city}`}/><Row k="Budget indicatif" v={request.budget||'À définir'}/><Row k="Facture" v={request.invoice?'Demandée':'Non demandée'}/></section>
    <section className="vx-quote-section"><label>VOTRE SÉLECTION</label>{items.map(({product,qty})=><Row key={product.id} k={`${product.name} × ${qty}`} v="Sur devis"/>)}<Row k="Sous-total" v="Sur devis" strong/><Row k="Livraison" v="À confirmer"/><Row k="Total estimé" v="Sur devis" strong/></section>
    {request.notes && <section className="vx-quote-section"><label>BESOINS PARTICULIERS / ALLERGIES</label><p className="vx-quote-note">{request.notes}</p></section>}
    <div className="vx-quote-actions"><button className="vx-primary" onClick={download}><FileDown size={17}/> Télécharger le devis PDF</button><button className="vx-outline" onClick={whatsapp}>Envoyer à Mina Brunch</button><button className="vx-text" onClick={()=>go('home')}>Retour à l’accueil</button></div>
  </section></main>;
}
function Row({k,v,strong=false}:{k:string;v:string;strong?:boolean}){return <div className={`vx-row ${strong?'strong':''}`}><span>{k}</span><b>{v}</b></div>}

function AboutScreen({ go, back }: { go: (v: View) => void; back: () => void }) {
  const gallery = [
    ['/images/patisseries.png','Pâtisseries & douceurs'],['/images/box-mix.png','Brunch & box'],
    ['/images/dome-crevettes-brochettes.png','Réceptions & cocktails'],['/images/plateau-fruit-1.png','Plateaux de fruits']
  ];
  return <main className="vx-screen vx-about"><Header title="À propos" onBack={back}/><section className="vx-about-hero"><img src="/images/Maman photo 8k salé.png" alt="Mina Brunch"/><div/><span>AU FIL DE MON PARCOURS</span><h1>Mina, une cuisine<br/>faite pour vos moments</h1><p>Traiteur en Île-de-France</p></section>
    <section className="vx-about-body"><blockquote>« Chaque table est pensée pour votre événement, vos invités et l’ambiance que vous souhaitez créer. »</blockquote><p className="vx-sign">Mina Brunch · Traiteur</p>
      <div className="vx-stats"><div><b>17+</b><span>Créations au catalogue</span></div><div><b>IDF</b><span>Zone de livraison</span></div><div><b>72h</b><span>Réservation conseillée</span></div></div>
      <div className="vx-section-title"><h2>Nos événements en images</h2><span/></div><div className="vx-gallery">{gallery.map(([src,label])=><figure key={src}><img src={src} alt={label}/><figcaption>{label}<small>Mina Brunch</small></figcaption></figure>)}</div>
      <div className="vx-section-title"><h2>Retrouvez Mina Brunch</h2><span/></div><SocialBlock compact/>
      <div className="vx-about-cta"><Sparkles size={21}/><h3>Votre événement mérite une attention particulière</h3><p>Composez votre sélection, choisissez votre date et recevez un récapitulatif prêt à envoyer.</p><button className="vx-primary" onClick={()=>go('home')}>Composer un plateau <ChevronRight size={17}/></button></div>
      <div className="vx-about-footer">MINA BRUNCH · ÎLE-DE-FRANCE</div>
    </section></main>;
}

function Drawer({ close, go, cartCount }: { close: () => void; go: (v: View) => void; cartCount: number }) {
  return <div className="vx-drawer-backdrop" onClick={close}><aside className="vx-drawer" onClick={e=>e.stopPropagation()}><div className="vx-drawer-head"><Brand/><button className="vx-icon" onClick={close}><X size={20}/></button></div><nav><button onClick={()=>go('home')}>Accueil <ChevronRight/></button><button onClick={()=>go('cart')}>Mon plateau {cartCount>0&&<b>{cartCount}</b>}<ChevronRight/></button><button onClick={()=>go('order')}>Commande entreprise <ChevronRight/></button><button onClick={()=>go('about')}>À propos <ChevronRight/></button></nav><div className="vx-drawer-contact"><span>CONTACT DIRECT</span><a href={`https://wa.me/${business.phoneWhatsApp}`} target="_blank" rel="noreferrer">WhatsApp · {business.phoneDisplay}</a></div><SocialBlock compact/></aside></div>;
}

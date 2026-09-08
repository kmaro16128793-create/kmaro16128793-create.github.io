import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  Clock3, FileDown, Heart, Mail, MapPin, Menu, Minus, Phone, Plus,
  Search, Send, ShoppingBag, Sparkles, Trash2, UserRound, X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { business, categories, idfDepartments, products } from './data';
import { parseHash, routeToHash } from './navigation';
import type { Screen } from './navigation';
import type { Booking, CartItem, Category, Product } from './types';

type RequestInfo = {
  name: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  company: string;
  eventType: string;
  guestCount: string;
  budget: string;
  invoice: boolean;
  notes: string;
};

const defaultRequest: RequestInfo = {
  name: '', phone: '', email: '', address: '', postalCode: '', city: '',
  company: '', eventType: 'Réunion', guestCount: '', budget: '', invoice: false, notes: ''
};

const eventTypes = ['Séminaire', 'Réunion', 'Réception', 'Mariage', 'Autre'];
const timeSlots = ['08h', '10h', '12h', '14h', '16h', '18h'];
const pageTransition = { duration: .34, ease: [0.16, 1, 0.3, 1] as const };

function safeRead(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeWrite(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* memory-only fallback */ }
}
function loadCart(): CartItem[] {
  try {
    const value = JSON.parse(safeRead('mina-cart') || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item.productId === 'string' && Number.isInteger(item.qty) && item.qty > 0 && products.some(p => p.id === item.productId))
      .map(item => ({ productId: item.productId, qty: Math.min(99, item.qty) }));
  } catch { return []; }
}
function loadBooking(): Booking {
  try {
    const value = JSON.parse(safeRead('mina-booking') || '{}');
    return { date: typeof value?.date === 'string' ? value.date : '', time: typeof value?.time === 'string' ? value.time : '' };
  } catch { return { date: '', time: '' }; }
}
function loadRequest(): RequestInfo {
  const merged = { ...defaultRequest };
  try {
    const legacy = JSON.parse(safeRead('mina-customer') || '{}');
    for (const key of ['name','phone','email','address','postalCode','city','notes'] as const) {
      if (typeof legacy?.[key] === 'string') merged[key] = legacy[key];
    }
  } catch { /* ignore */ }
  try {
    const extra = JSON.parse(safeRead('mina-request-extra') || '{}');
    for (const key of Object.keys(defaultRequest) as Array<keyof RequestInfo>) {
      if (key === 'invoice') {
        if (typeof extra?.invoice === 'boolean') merged.invoice = extra.invoice;
      } else if (typeof extra?.[key] === 'string') merged[key] = extra[key];
    }
  } catch { /* ignore */ }
  return merged;
}
function validPhone(value: string) {
  return /^(?:(?:\+|00)33|0)[1-9](?:[\s.-]*\d{2}){4}$/.test(value.trim());
}
function validEmail(value: string) {
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}
function dateLabel(iso: string) {
  if (!iso) return 'À choisir';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`ref-brand ${compact ? 'compact' : ''}`} aria-label="Mina Brunch Traiteur">
    <span className="ref-brand-gem" aria-hidden="true">◇</span>
    <strong>MINA BRUNCH</strong>
    <small>TRAITEUR ÉVÉNEMENTIEL</small>
  </div>;
}

function Header({ title, back, right }: { title?: string; back?: () => void; right?: React.ReactNode }) {
  return <header className="ref-header">
    <div>{back ? <button className="ref-icon" onClick={back} aria-label="Retour"><ArrowLeft size={18}/></button> : <span/>}</div>
    <div className="ref-header-center">{title ? <span className="ref-header-title">{title}</span> : <Brand compact/>}</div>
    <div className="ref-header-right">{right}</div>
  </header>;
}

function ReferenceApp() {
  const reduceMotion = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const initialRoute = useMemo(() => parseHash(window.location.hash), []);
  const initialProduct = initialRoute.productId ? products.find(p => p.id === initialRoute.productId) : undefined;
  const [screen, setScreen] = useState<Screen>(initialProduct || initialRoute.screen !== 'product' ? initialRoute.screen : 'home');
  const [activeProduct, setActiveProduct] = useState<Product>(initialProduct ?? products[0]);
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [booking, setBooking] = useState<Booking>(loadBooking);
  const [request, setRequest] = useState<RequestInfo>(loadRequest);
  const [category, setCategory] = useState<Category>('Tous');
  const [query, setQuery] = useState('');
  const [liked, setLiked] = useState<string[]>([]);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => safeWrite('mina-cart', cart), [cart]);
  useEffect(() => safeWrite('mina-booking', booking), [booking]);
  useEffect(() => {
    safeWrite('mina-request-extra', request);
    safeWrite('mina-customer', { name: request.name, phone: request.phone, email: request.email, address: request.address, postalCode: request.postalCode, city: request.city, notes: request.notes });
  }, [request]);

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState({ mina: true, depth: 0 }, '', `${window.location.pathname}${window.location.search}#/`);
    else window.history.replaceState({ ...(window.history.state || {}), mina: true, depth: Number(window.history.state?.depth || 0) }, '', window.location.href);
    const sync = () => {
      const route = parseHash(window.location.hash);
      if (route.screen === 'product') {
        const found = route.productId ? products.find(p => p.id === route.productId) : undefined;
        if (!found) { setScreen('home'); return; }
        setActiveProduct(found);
      }
      setDrawer(false);
      setScreen(route.screen);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [screen]);

  const go = (next: Screen, product?: Product | null, replace = false) => {
    const target = product ?? activeProduct;
    const hash = routeToHash(next, target);
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    const depth = Number(window.history.state?.depth || 0);
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
      if (replace) window.history.replaceState({ mina: true, depth }, '', url);
      else window.history.pushState({ mina: true, depth: depth + 1 }, '', url);
    }
    if (next === 'product' && product) setActiveProduct(product);
    setDrawer(false);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  const back = (fallback: Screen) => {
    if (Number(window.history.state?.depth || 0) > 0) window.history.back();
    else go(fallback, null, true);
  };

  const detailed = useMemo(() => cart.map(item => ({ ...item, product: products.find(p => p.id === item.productId) })).filter((x): x is CartItem & { product: Product } => Boolean(x.product)), [cart]);
  const cartCount = detailed.reduce((sum, x) => sum + x.qty, 0);
  const add = (product: Product, qty = 1) => setCart(prev => {
    const safeQty = Math.max(1, Math.min(99, Math.floor(qty)));
    const found = prev.find(x => x.productId === product.id);
    return found ? prev.map(x => x.productId === product.id ? { ...x, qty: Math.min(99, x.qty + safeQty) } : x) : [...prev, { productId: product.id, qty: safeQty }];
  });
  const qty = (id: string, delta: number) => setCart(prev => prev.map(x => x.productId === id ? { ...x, qty: Math.max(0, Math.min(99, x.qty + delta)) } : x).filter(x => x.qty > 0));
  const openProduct = (product: Product) => go('product', product);

  const content = {
    home: <HomeScreen category={category} setCategory={setCategory} query={query} setQuery={setQuery} cartCount={cartCount} railRef={railRef} openProduct={openProduct} add={add} liked={liked} setLiked={setLiked} go={go} openDrawer={() => setDrawer(true)} />,
    product: <ProductScreen product={activeProduct} liked={liked.includes(activeProduct.id)} toggleLike={() => setLiked(v => v.includes(activeProduct.id) ? v.filter(id => id !== activeProduct.id) : [...v, activeProduct.id])} add={add} go={go} back={() => back('home')} />,
    cart: <CartScreen items={detailed} updateQty={qty} go={go} back={() => back('home')} />,
    customer: <CustomerScreen request={request} setRequest={setRequest} booking={booking} items={detailed} go={go} back={() => back('cart')} />,
    booking: <BookingScreen booking={booking} setBooking={setBooking} go={go} back={() => back('customer')} />,
    zone: <ZoneScreen request={request} hasItems={detailed.length > 0} go={go} back={() => back('booking')} />,
    quote: <QuoteScreen items={detailed} request={request} booking={booking} go={go} back={() => back('zone')} />,
    about: <AboutScreen go={go} back={() => back('home')} />
  }[screen];

  return <div className="ref-app-outer">
    <div className="ref-device">
      <AnimatePresence mode="wait">
        <motion.main ref={mainRef} tabIndex={-1} key={screen} className="ref-main"
          initial={reduceMotion ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -8 }} transition={reduceMotion ? { duration: 0 } : pageTransition}>
          {content}
        </motion.main>
      </AnimatePresence>
      <AnimatePresence>{drawer && <Drawer close={() => setDrawer(false)} go={go} cartCount={cartCount}/>}</AnimatePresence>
    </div>
  </div>;
}

function HomeScreen({ category, setCategory, query, setQuery, cartCount, railRef, openProduct, add, liked, setLiked, go, openDrawer }: {
  category: Category; setCategory: (v: Category) => void; query: string; setQuery: (v: string) => void; cartCount: number;
  railRef: React.RefObject<HTMLDivElement | null>; openProduct: (p: Product) => void; add: (p: Product) => void;
  liked: string[]; setLiked: React.Dispatch<React.SetStateAction<string[]>>; go: (s: Screen) => void; openDrawer: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const filtered = products.filter(p => (category === 'Tous' || p.category === category) && p.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  const scrollProducts = () => railRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  return <div className="ref-screen ref-home ref-with-sticky">
    <Header right={<button className="ref-bag" onClick={() => go('cart')} aria-label={`Panier, ${cartCount} article${cartCount > 1 ? 's' : ''}`}><ShoppingBag size={17}/>{cartCount > 0 && <b>{cartCount}</b>}</button>} />
    <button className="ref-menu-floating" onClick={openDrawer} aria-label="Ouvrir le menu"><Menu size={18}/></button>

    <section className="ref-hero">
      <div className="ref-hero-copy"><small>COMMANDE SUR MESURE</small><h1>Pour vos événements<br/>d’entreprise</h1><div className="ref-hero-proof"><span>✦ Qualité artisanale</span><span>● Livraison IDF</span><span>▣ Devis personnalisé</span></div></div>
      <img src="/images/box-mix.png" alt="Composition Mina Brunch" fetchPriority="high" decoding="async" />
    </section>

    <div className="ref-search"><input aria-label="Rechercher une création" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une création..."/><Search size={15}/></div>
    <div className="ref-categories" aria-label="Catégories">{categories.map(c => <button key={c} className={c === category ? 'active' : ''} aria-pressed={c === category} onClick={() => setCategory(c)}>{c}</button>)}</div>
    <div className="ref-section-title"><span>Nos créations</span><h2>Les incontournables Mina Brunch</h2><i/></div>

    <div className="ref-product-rail" ref={railRef}>
      {filtered.map(product => <article className="ref-product-mini" key={product.id}>
        <button className="ref-product-visual" onClick={() => openProduct(product)} aria-label={`Voir ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" decoding="async"/></button>
        <button className={`ref-heart ${liked.includes(product.id) ? 'active' : ''}`} aria-label={liked.includes(product.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={liked.includes(product.id)} onClick={() => setLiked(v => v.includes(product.id) ? v.filter(id => id !== product.id) : [...v, product.id])}><Heart size={12} fill={liked.includes(product.id) ? 'currentColor' : 'none'}/></button>
        <button className="ref-product-meta" onClick={() => openProduct(product)}><strong>{product.name}</strong><span>Sur devis</span></button>
        <button className="ref-mini-plus" onClick={() => add(product)} aria-label={`Ajouter ${product.name} au devis`}><Plus size={13}/></button>
      </article>)}
    </div>
    {filtered.length === 0 && <p className="ref-empty-line">Aucune création ne correspond à votre recherche.</p>}

    <div className="ref-sticky"><button className="ref-primary" onClick={cartCount ? () => go('cart') : scrollProducts}><ShoppingBag size={16}/>{cartCount ? `Composer mon plateau · ${cartCount}` : 'Composer mon plateau'}</button></div>
  </div>;
}

function ProductScreen({ product, liked, toggleLike, add, go, back }: { product: Product; liked: boolean; toggleLike: () => void; add: (p: Product, qty?: number) => void; go: (s: Screen) => void; back: () => void }) {
  const [count, setCount] = useState(1);
  const [open, setOpen] = useState(true);
  return <div className="ref-screen ref-product ref-with-sticky">
    <Header title="Détail de la création" back={back} right={<button className="ref-icon" onClick={toggleLike} aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={liked}><Heart size={17} fill={liked ? 'currentColor' : 'none'}/></button>}/>
    <section className="ref-product-stage"><img src={product.image} alt={product.name} fetchPriority="high" decoding="async"/><div className="ref-dots"><b/><i/><i/><i/></div></section>
    <section className="ref-product-copy"><h1>{product.name}</h1><div className="ref-price">Sur devis</div><p>{product.description}</p>
      <button className="ref-accordion" onClick={() => setOpen(v => !v)} aria-expanded={open}><span><Sparkles size={14}/> Composition</span><ChevronDown size={15} className={open ? 'open' : ''}/></button>
      <AnimatePresence initial={false}>{open && <motion.div className="ref-composition" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={pageTransition}>{product.composition.map(x => <span key={x}>{x}</span>)}<small>Allergènes : à préciser selon la création.</small></motion.div>}</AnimatePresence>
      <div className="ref-qty-line"><span>Quantité</span><div><button onClick={() => setCount(Math.max(1, count - 1))} aria-label="Diminuer"><Minus size={14}/></button><b>{count}</b><button onClick={() => setCount(Math.min(99, count + 1))} aria-label="Augmenter"><Plus size={14}/></button></div></div>
      <div className="ref-product-total"><span>Total</span><strong>Sur devis</strong></div>
    </section>
    <div className="ref-sticky"><button className="ref-primary" onClick={() => { add(product, count); go('cart'); }}>Ajouter au plateau <ShoppingBag size={15}/></button></div>
  </div>;
}

function CartScreen({ items, updateQty, go, back }: { items: Array<CartItem & { product: Product }>; updateQty: (id: string, d: number) => void; go: (s: Screen) => void; back: () => void }) {
  const count = items.reduce((s, x) => s + x.qty, 0);
  return <div className="ref-screen ref-cart ref-with-sticky">
    <Header title="Composer mon plateau" back={back}/>
    <section className="ref-format-card"><div className="ref-format-icon">◇</div><div><small>Format événement</small><strong>{count || 0} pièce{count > 1 ? 's' : ''}</strong><span>Composition sur mesure</span></div><button onClick={() => go('home')}>Modifier</button></section>
    <section className="ref-cart-content"><h2>Votre sélection</h2>
      {items.length === 0 ? <div className="ref-empty-state"><ShoppingBag size={28}/><h3>Votre plateau est vide</h3><p>Ajoutez vos créations avant de continuer.</p><button onClick={() => go('home')}>Voir les créations</button></div> : <>
        <div className="ref-cart-list">{items.map(({ product, qty }) => <div className="ref-cart-row" key={product.id}><img src={product.image} alt={product.name}/><div><strong>{product.name}</strong><span>{qty} pièce{qty > 1 ? 's' : ''} · Sur devis</span></div><div className="ref-inline-step"><button onClick={() => updateQty(product.id, -1)} aria-label={qty === 1 ? `Retirer ${product.name}` : 'Diminuer'}>{qty === 1 ? <Trash2 size={12}/> : <Minus size={12}/>}</button><b>{qty}</b><button onClick={() => updateQty(product.id, 1)} aria-label="Augmenter"><Plus size={12}/></button></div></div>)}</div>
        <button className="ref-add-more" onClick={() => go('home')}><Plus size={13}/> Ajouter d’autres créations</button>
      </>}
    </section>
    {items.length > 0 && <div className="ref-cart-summary"><div><span>Total sélectionné</span><b>{count} pièce{count > 1 ? 's' : ''}</b></div><div className="right"><span>Tarif estimé</span><b>Sur devis</b></div></div>}
    {items.length > 0 && <div className="ref-sticky"><button className="ref-primary" onClick={() => go('customer')}>Continuer <ChevronRight size={15}/></button></div>}
  </div>;
}

function CustomerScreen({ request, setRequest, booking, items, go, back }: { request: RequestInfo; setRequest: React.Dispatch<React.SetStateAction<RequestInfo>>; booking: Booking; items: Array<CartItem & { product: Product }>; go: (s: Screen) => void; back: () => void }) {
  const set = (key: keyof RequestInfo, value: string | boolean) => setRequest(v => ({ ...v, [key]: value }));
  const count = items.reduce((s, x) => s + x.qty, 0);
  const ready = request.name.trim().length >= 2 && validPhone(request.phone) && validEmail(request.email) && request.address.trim().length >= 5 && /^\d{5}$/.test(request.postalCode) && request.city.trim().length >= 2 && Number(request.guestCount || '0') > 0;
  return <div className="ref-screen ref-order ref-with-sticky">
    <Header title="Commande entreprise" back={back}/>
    <section className="ref-order-summary"><div><span>Total pièces</span><b>{count || '—'}</b></div><div><span>Sous-total</span><b>Sur devis</b></div><div><span>Frais de livraison</span><b>À confirmer</b></div><div className="strong"><span>Total estimé</span><b>Sur devis</b></div></section>
    <section className="ref-form-stack">
      <div className="ref-field-block"><label>TYPE D’ÉVÉNEMENT</label><div className="ref-chip-row">{eventTypes.map(type => <button key={type} onClick={() => set('eventType', type)} className={request.eventType === type ? 'active' : ''} aria-pressed={request.eventType === type}>{type}</button>)}</div></div>
      <RefInput label="NOMBRE D’INVITÉS" value={request.guestCount} onChange={v => set('guestCount', v.replace(/\D/g,'').slice(0,4))} placeholder="40" icon={<UserRound size={14}/>} inputMode="numeric"/>
      <div className="ref-two-fields"><button className="ref-pseudo-field" onClick={() => go('booking')}><label>DATE</label><span><CalendarDays size={14}/>{booking.date ? dateLabel(booking.date) : 'Choisir'}</span></button><button className="ref-pseudo-field" onClick={() => go('booking')}><label>HEURE</label><span><Clock3 size={14}/>{booking.time || 'Choisir'}</span></button></div>
      <RefInput label="ADRESSE DE LIVRAISON" value={request.address} onChange={v => set('address', v)} placeholder="12 rue de Rivoli" icon={<MapPin size={14}/>} autoComplete="street-address"/>
      <div className="ref-two-fields"><RefInput label="CODE POSTAL" value={request.postalCode} onChange={v => set('postalCode', v.replace(/\D/g,'').slice(0,5))} placeholder="75001" inputMode="numeric" autoComplete="postal-code"/><RefInput label="VILLE" value={request.city} onChange={v => set('city', v)} placeholder="Paris" autoComplete="address-level2"/></div>
      <RefInput label="NOM DE L’ENTREPRISE" value={request.company} onChange={v => set('company', v)} placeholder="Votre entreprise"/>
      <RefInput label="PERSONNE DE CONTACT" value={request.name} onChange={v => set('name', v)} placeholder="Nom et prénom" icon={<UserRound size={14}/>} autoComplete="name"/>
      <div className="ref-two-fields"><RefInput label="EMAIL" value={request.email} onChange={v => set('email', v)} placeholder="contact@exemple.fr" icon={<Mail size={14}/>} type="email" inputMode="email" autoComplete="email"/><RefInput label="TÉLÉPHONE" value={request.phone} onChange={v => set('phone', v)} placeholder="06 12 34 56 78" icon={<Phone size={14}/>} type="tel" inputMode="tel" autoComplete="tel"/></div>
      <label className="ref-select-field"><span>BUDGET ESTIMÉ</span><select value={request.budget} onChange={e => set('budget', e.target.value)}><option value="">À définir</option><option>Moins de 300 €</option><option>Entre 300 € et 500 €</option><option>Entre 500 € et 800 €</option><option>Plus de 800 €</option></select><ChevronDown size={14}/></label>
      <label className="ref-toggle-line"><span><b>Besoin de facture</b><small>Coordonnées de facturation à confirmer</small></span><input type="checkbox" checked={request.invoice} onChange={e => set('invoice', e.target.checked)}/><i/></label>
      <label className="ref-notes"><span>BESOINS PARTICULIERS (OPTIONNEL)</span><textarea rows={3} maxLength={1200} value={request.notes} onChange={e => set('notes', e.target.value)} placeholder="Allergies, préférences, précisions..."/></label>
      {!validEmail(request.email) && request.email && <p className="ref-form-error">Vérifiez l’adresse e-mail.</p>}
      {!validPhone(request.phone) && request.phone && <p className="ref-form-error">Vérifiez le numéro de téléphone.</p>}
    </section>
    <div className="ref-sticky"><button className="ref-primary" disabled={!ready} onClick={() => go('booking')}>Choisir la date et le créneau <ChevronRight size={15}/></button><small className="ref-secure-note">Vos informations restent utilisées uniquement pour votre demande.</small></div>
  </div>;
}

function RefInput({ label, value, onChange, placeholder, icon, inputMode, type='text', autoComplete }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; icon?: React.ReactNode; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; type?: string; autoComplete?: string }) {
  return <label className="ref-input-field"><span>{label}</span><div>{icon}<input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} type={type} autoComplete={autoComplete}/></div></label>;
}

function BookingScreen({ booking, setBooking, go, back }: { booking: Booking; setBooking: React.Dispatch<React.SetStateAction<Booking>>; go: (s: Screen) => void; back: () => void }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const currentMonth = year === today.getFullYear() && month === today.getMonth();
  const iso = (d: number) => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const past = (d: number) => new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return <div className="ref-screen ref-booking ref-with-sticky">
    <Header title="Réservez votre date" back={back}/>
    <section className="ref-book-content"><p>Choisissez la date et le créneau souhaité. La disponibilité finale reste confirmée par Mina Brunch.</p>
      <div className="ref-calendar-head"><button disabled={currentMonth} onClick={() => setCursor(new Date(year, month-1, 1))} aria-label="Mois précédent"><ChevronLeft size={16}/></button><strong>{cursor.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</strong><button onClick={() => setCursor(new Date(year, month+1, 1))} aria-label="Mois suivant"><ChevronRight size={16}/></button></div>
      <div className="ref-weekdays">{['L','M','M','J','V','S','D'].map((x,i)=><span key={i}>{x}</span>)}</div>
      <div className="ref-calendar-grid">{Array.from({length:first}).map((_,i)=><span key={`b${i}`}/>)}{Array.from({length:days}).map((_,i)=>{const d=i+1,v=iso(d),selected=v===booking.date; return <button key={d} disabled={past(d)} className={selected?'selected':''} aria-pressed={selected} onClick={() => setBooking(b=>({...b,date:v}))}>{d}</button>})}</div>
      <div className="ref-slot-title">CRÉNEAU DE LIVRAISON</div><div className="ref-slot-row">{timeSlots.map(slot => <button key={slot} className={booking.time===slot?'active':''} aria-pressed={booking.time===slot} onClick={() => setBooking(b=>({...b,time:slot}))}>{slot}</button>)}</div>
    </section>
    <div className="ref-sticky"><button className="ref-primary muted-when-disabled" disabled={!booking.date || !booking.time} onClick={() => go('zone')}>Vérifier la zone de livraison <ChevronRight size={15}/></button></div>
  </div>;
}

function ZoneScreen({ request, hasItems, go, back }: { request: RequestInfo; hasItems: boolean; go: (s: Screen) => void; back: () => void }) {
  const dept = request.postalCode.slice(0,2);
  const eligible = request.postalCode.length === 5 && idfDepartments.includes(dept);
  return <div className="ref-screen ref-zone ref-with-sticky">
    <Header title="Périmètre de livraison" back={back}/>
    <section className="ref-zone-content"><div className="ref-address-search"><span>{request.address || 'Adresse à confirmer'}, {request.postalCode} {request.city}</span><Search size={14}/></div><div className="ref-map-hint">Déplacez la carte pour vérifier votre zone</div>
      <div className="ref-map" role="img" aria-label="Schéma du périmètre de livraison Mina Brunch en Île-de-France"><div className="ref-map-rings"><i className="r3">Zone 3</i><i className="r2">Zone 2</i><i className="r1">Zone 1</i><b><MapPin size={20}/><small>Mina Brunch</small></b></div><span className="road r-a"/><span className="road r-b"/><span className="road r-c"/><span className="river"/></div>
      <div className="ref-zone-result"><div><h2>Périmètre de livraison</h2><p>{eligible ? 'Votre code postal est dans le périmètre annoncé. L’adresse exacte et les éventuels frais restent confirmés sur devis.' : 'Cette adresse nécessite une vérification manuelle par Mina Brunch avant confirmation.'}</p></div><span className={eligible ? 'ok' : 'manual'}>{eligible ? <><Check size={12}/> Dans la zone</> : 'À vérifier'}</span></div>
    </section>
    <div className="ref-sticky"><button className="ref-primary muted-when-disabled" disabled={!hasItems} onClick={() => go('quote')}>{hasItems ? 'Confirmer cette adresse' : 'Ajoutez une création avant le devis'}</button></div>
  </div>;
}

function QuoteScreen({ items, request, booking, go, back }: { items: Array<CartItem & { product: Product }>; request: RequestInfo; booking: Booking; go: (s: Screen) => void; back: () => void }) {
  const quoteId = useMemo(() => `MB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, []);
  const count = items.reduce((s,x)=>s+x.qty,0);
  const downloadPdf = () => {
    if (!items.length) return;
    const doc = new jsPDF({ unit:'mm', format:'a4' });
    const left=18,right=192;
    const header=()=>{doc.setFillColor(249,247,242);doc.rect(0,0,210,297,'F');doc.setTextColor(48,43,37);doc.setFont('times','bold');doc.setFontSize(24);doc.text('MINA BRUNCH',left,24);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(176,132,66);doc.text('TRAITEUR · DEMANDE DE DEVIS',left,31);doc.setDrawColor(210,196,175);doc.line(left,37,right,37)};
    header();doc.setTextColor(55,50,45);doc.setFontSize(9);doc.text(`Référence : ${quoteId}`,left,48);doc.text(`Client : ${request.name || '—'}`,left,56);doc.text(`Entreprise : ${request.company || '—'}`,left,62);doc.text(`Téléphone : ${request.phone || '—'}`,left,68);doc.text(`E-mail : ${request.email || '—'}`,left,74);
    const address=doc.splitTextToSize(`Livraison : ${request.address}, ${request.postalCode} ${request.city}`,170);doc.text(address,left,82);let y=82+address.length*5+5;doc.text(`Événement : ${request.eventType} · ${request.guestCount || '—'} invité(s) · ${dateLabel(booking.date)} ${booking.time || ''}`,left,y,{maxWidth:170});y+=14;doc.setFont('times','bold');doc.setFontSize(14);doc.text('Votre sélection',left,y);y+=9;doc.setFont('helvetica','normal');doc.setFontSize(9);
    items.forEach(({product,qty},i)=>{if(y>252){doc.addPage();header();y=50}doc.text(`${i+1}. ${product.name}`,left,y,{maxWidth:112});doc.text(`x${qty}`,150,y);doc.text('Sur devis',right,y,{align:'right'});y+=9});
    if(request.notes.trim()){if(y>225){doc.addPage();header();y=50}doc.setFont('times','bold');doc.setFontSize(11);doc.text('Précisions / allergies',left,y+4);doc.setFont('helvetica','normal');doc.setFontSize(9);const lines=doc.splitTextToSize(request.notes.trim(),170);doc.text(lines,left,y+11);y+=lines.length*4.5+17}
    doc.setDrawColor(210,196,175);doc.line(left,y,right,y);doc.setFont('times','bold');doc.setFontSize(11);doc.text('Tarif final',left,y+9);doc.text('À confirmer sur devis',right,y+9,{align:'right'});doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(105,96,87);doc.text(`Quantité totale : ${count} pièce(s). Le tarif et le créneau sont confirmés par Mina Brunch après étude de la demande.`,left,y+20,{maxWidth:170});doc.setTextColor(176,132,66);doc.text(`${business.phoneDisplay} · ${business.email}`,left,282);doc.save(`mina-brunch-${quoteId.toLowerCase()}.pdf`);
  };
  const whatsapp=()=>{if(!items.length)return;const list=items.map(x=>`• ${x.product.name} x${x.qty}`).join('\n');const notes=request.notes.trim()?`\nPrécisions / allergies : ${request.notes.trim()}`:'';const text=`Bonjour Mina Brunch, je souhaite transmettre ma demande ${quoteId}.\n\n${list}\n\nÉvénement : ${request.eventType}\nInvités : ${request.guestCount || '—'}\nDate : ${dateLabel(booking.date)} ${booking.time || ''}\nAdresse : ${request.address}, ${request.postalCode} ${request.city}\nEntreprise : ${request.company || '—'}\nContact : ${request.name}\nTéléphone : ${request.phone}\nE-mail : ${request.email || '—'}\nBudget : ${request.budget || 'À définir'}\nFacture : ${request.invoice ? 'Oui' : 'Non'}${notes}\n\nJe comprends que le tarif et le créneau restent à confirmer.`;window.open(`https://wa.me/${business.phoneWhatsApp}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer')};
  if(!items.length)return <div className="ref-screen"><Header title="Votre devis" back={back}/><div className="ref-empty-state standalone"><ShoppingBag size={28}/><h3>Aucune création sélectionnée</h3><button onClick={()=>go('home')}>Choisir mes créations</button></div></div>;
  return <div className="ref-screen ref-quote"><Header title="Votre devis" back={back}/><section className="ref-quote-content"><div className="ref-quote-status"><div className="ref-check-seal"><Check size={17}/></div><small>DEVIS N° {quoteId}</small><h1>Votre demande est prête</h1><p>Téléchargez votre récapitulatif ou transmettez-le directement à Mina Brunch.</p></div>
    <div className="ref-info-section"><label>CLIENT</label><Row label="Entreprise" value={request.company || '—'}/><Row label="Contact" value={request.name || '—'}/><Row label="Email" value={request.email || '—'}/><Row label="Téléphone" value={request.phone || '—'}/></div>
    <div className="ref-info-section"><label>ÉVÉNEMENT</label><Row label="Type" value={request.eventType}/><Row label="Date" value={dateLabel(booking.date)}/><Row label="Créneau" value={booking.time || '—'}/><Row label="Invités" value={request.guestCount || '—'}/></div>
    <div className="ref-info-section"><label>VOTRE PLATEAU</label>{items.map(({product,qty})=><Row key={product.id} label={`${product.name} × ${qty}`} value="Sur devis"/>)}<Row label="Total" value="À confirmer" strong/></div>
    {request.notes.trim()&&<div className="ref-quote-note"><label>PRÉCISIONS / ALLERGIES</label><p>{request.notes}</p></div>}
    <div className="ref-quote-buttons"><button className="ref-primary" onClick={downloadPdf}><FileDown size={15}/> Télécharger le devis PDF</button><button className="ref-whatsapp" onClick={whatsapp}><Send size={15}/> Envoyer à Mina Brunch</button><button className="ref-return" onClick={()=>go('home')}>Retour à l’accueil</button></div>
  </section></div>;
}

function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div className={`ref-row ${strong?'strong':''}`}><span>{label}</span><b>{value}</b></div>}

function AboutScreen({ go, back }: { go: (s: Screen) => void; back: () => void }) {
  const gallery=[
    ['/images/patisseries.png','Pâtisseries & douceurs'],['/images/box-mix.png','Box sucrée & salée'],['/images/dome-crevettes-brochettes.png','Réceptions & cocktails'],['/images/plateau-fruit-1.png','Plateaux de fruits']
  ];
  return <div className="ref-screen ref-about"><Header title="À propos" back={back}/><section className="ref-about-hero"><img src="/images/Maman photo 8k salé.png" alt="Mina Brunch Traiteur" fetchPriority="high"/><div/><span>AU FIL DE MON PARCOURS</span><h1>Mina, une cuisine<br/>faite pour vos moments</h1><p>Traiteur en Île-de-France</p></section>
    <section className="ref-about-body"><blockquote>« Chaque table raconte une histoire — celle des familles, des amis et des événements que vous me confiez. »</blockquote><p className="ref-sign">Mina Brunch · Fondatrice</p><div className="ref-stats"><div><b>17+</b><span>Créations au catalogue</span></div><div><b>IDF</b><span>Zone de livraison</span></div><div><b>72h</b><span>Réservation conseillée</span></div></div>
      <div className="ref-about-title"><small>NOS RÉALISATIONS</small><h2>Nos événements en images</h2><i/></div><div className="ref-about-grid">{gallery.map(([src,title])=><figure key={src}><img src={src} alt={title} loading="lazy"/><figcaption>{title}<small>Créations Mina Brunch</small></figcaption></figure>)}</div>
      <div className="ref-trust"><small>NOTRE ENGAGEMENT</small><h2>Une prestation pensée avec soin</h2><div><span><Sparkles size={18}/> Sur mesure</span><span><MapPin size={18}/> Île-de-France</span><span><CalendarDays size={18}/> Sur rendez-vous</span></div></div>
      <div className="ref-about-cta"><h3>Votre événement mérite le meilleur</h3><p>Composez votre plateau à votre image, recevez un devis et échangez directement avec Mina Brunch.</p><button className="ref-primary" onClick={()=>go('home')}>Composer un plateau <ChevronRight size={15}/></button></div><div className="ref-about-footer">— MINA BRUNCH · ÎLE-DE-FRANCE —</div>
    </section></div>;
}

function Drawer({ close, go, cartCount }: { close: () => void; go: (s: Screen) => void; cartCount: number }) {
  return <motion.div className="ref-drawer-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={close}><motion.aside className="ref-drawer" role="dialog" aria-modal="true" aria-label="Menu Mina Brunch" initial={{x:'-100%'}} animate={{x:0}} exit={{x:'-100%'}} transition={pageTransition} onClick={e=>e.stopPropagation()}><div className="ref-drawer-head"><Brand/><button className="ref-icon" onClick={close} aria-label="Fermer"><X size={18}/></button></div><nav><button onClick={()=>go('home')}>Accueil <ChevronRight size={15}/></button><button onClick={()=>go('cart')}>Mon plateau {cartCount>0&&<b>{cartCount}</b>}<ChevronRight size={15}/></button><button onClick={()=>go('customer')}>Commande entreprise <ChevronRight size={15}/></button><button onClick={()=>go('about')}>À propos <ChevronRight size={15}/></button></nav><div className="ref-drawer-contact"><small>CONTACT DIRECT</small><a href={`https://wa.me/${business.phoneWhatsApp}`} target="_blank" rel="noreferrer">WhatsApp · {business.phoneDisplay}</a><a href={business.tiktokUrl} target="_blank" rel="noreferrer">TikTok · {business.tiktok}</a></div></motion.aside></motion.div>;
}

export default ReferenceApp;

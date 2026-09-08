import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3,
  FileDown, Heart, MapPin, Menu, Minus, Plus, Search,
  Send, ShoppingBag, Sparkles, Trash2, UserRound, X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { business, categories, idfDepartments, products } from './data';
import { parseHash, routeToHash } from './navigation';
import type { Screen } from './navigation';
import type { Booking, CartItem, Category, Customer, Product } from './types';

const initialCustomer: Customer = {
  name: '', phone: '', email: '', address: '', postalCode: '', city: '', notes: ''
};
const initialBooking: Booking = { date: '', time: '' };

const spring = { type: 'spring' as const, stiffness: 340, damping: 34, mass: 0.8 };
const pageTransition = { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const };
const screenNames: Record<Screen, string> = {
  home: 'Accueil', product: 'Détail de la création', cart: 'Panier', booking: 'Date et créneau',
  customer: 'Coordonnées', zone: 'Zone de livraison', quote: 'Devis', about: 'À propos'
};

function money(value: number | null) {
  if (value === null) return 'Sur devis';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

function safeStorageRead(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function safeStorageWrite(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible : app utilisable en mémoire */ }
}

function loadCart(): CartItem[] {
  const raw = safeStorageRead('mina-cart');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CartItem => Boolean(
        item && typeof item.productId === 'string' && products.some(p => p.id === item.productId) &&
        Number.isInteger(item.qty) && item.qty > 0
      ))
      .map(item => ({ productId: item.productId, qty: Math.min(item.qty, 99) }));
  } catch { return []; }
}

function loadBooking(): Booking {
  const raw = safeStorageRead('mina-booking');
  if (!raw) return initialBooking;
  try {
    const value = JSON.parse(raw);
    return {
      date: typeof value?.date === 'string' ? value.date : '',
      time: typeof value?.time === 'string' ? value.time : ''
    };
  } catch { return initialBooking; }
}

function loadCustomer(): Customer {
  const raw = safeStorageRead('mina-customer');
  if (!raw) return initialCustomer;
  try {
    const value = JSON.parse(raw);
    const next = { ...initialCustomer };
    (Object.keys(next) as Array<keyof Customer>).forEach(key => {
      if (typeof value?.[key] === 'string') next[key] = value[key];
    });
    return next;
  } catch { return initialCustomer; }
}

function isValidPhone(value: string) {
  return /^(?:(?:\+|00)33|0)[1-9](?:[\s.-]*\d{2}){4}$/.test(value.trim());
}

function isValidEmail(value: string) {
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function customerErrors(customer: Customer) {
  return {
    name: customer.name.trim().length >= 2 ? '' : 'Indiquez un nom et prénom valides.',
    phone: isValidPhone(customer.phone) ? '' : 'Indiquez un numéro français valide (ex. 06 12 34 56 78).',
    email: isValidEmail(customer.email) ? '' : 'Vérifiez l’adresse e-mail.',
    address: customer.address.trim().length >= 5 ? '' : 'Indiquez une adresse suffisamment précise.',
    postalCode: /^\d{5}$/.test(customer.postalCode) ? '' : 'Le code postal doit contenir 5 chiffres.',
    city: customer.city.trim().length >= 2 ? '' : 'Indiquez la ville.'
  };
}

function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <header className="screen-header">
      <button className="icon-button ghost" onClick={onBack} aria-label="Revenir à l’écran précédent"><ArrowLeft size={19} /></button>
      <div className="screen-title">{title}</div>
      <div className="header-right-slot">{right}</div>
    </header>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? 'compact' : ''}`} aria-label="Mina Brunch Traiteur">
      <span className="brand-crown" aria-hidden="true">✦</span>
      <span className="brand-name">MINA BRUNCH</span>
      <span className="brand-sub">TRAITEUR</span>
    </div>
  );
}

function App() {
  const reduceMotion = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const initialRoute = useMemo(() => parseHash(window.location.hash), []);
  const initialProduct = initialRoute.productId ? products.find(p => p.id === initialRoute.productId) : undefined;
  const [screen, setScreen] = useState<Screen>(initialProduct || initialRoute.screen !== 'product' ? initialRoute.screen : 'home');
  const [activeProduct, setActiveProduct] = useState<Product>(initialProduct ?? products[0]);
  const [category, setCategory] = useState<Category>('Tous');
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [booking, setBooking] = useState<Booking>(loadBooking);
  const [customer, setCustomer] = useState<Customer>(loadCustomer);
  const [liked, setLiked] = useState<string[]>([]);

  useEffect(() => { safeStorageWrite('mina-cart', cart); }, [cart]);
  useEffect(() => { safeStorageWrite('mina-booking', booking); }, [booking]);
  useEffect(() => { safeStorageWrite('mina-customer', customer); }, [customer]);

  useEffect(() => {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash || '#/'}`;
    if (!window.location.hash) window.history.replaceState({ minaApp: true, minaDepth: 0 }, '', current);
    else window.history.replaceState({ ...(window.history.state ?? {}), minaApp: true, minaDepth: window.history.state?.minaDepth ?? 0 }, '', current);

    const syncFromUrl = () => {
      const route = parseHash(window.location.hash);
      if (route.screen === 'product') {
        const found = route.productId ? products.find(p => p.id === route.productId) : undefined;
        if (!found) {
          window.history.replaceState({ minaApp: true, minaDepth: window.history.state?.minaDepth ?? 0 }, '', `${window.location.pathname}${window.location.search}#/`);
          setScreen('home');
          return;
        }
        setActiveProduct(found);
      }
      setDrawer(false);
      setScreen(route.screen);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
    };
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(id);
  }, [screen]);

  const go = (next: Screen, product?: Product | null, replace = false) => {
    setDrawer(false);
    const targetProduct = product ?? activeProduct;
    const hash = routeToHash(next, targetProduct);
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    const currentDepth = Number(window.history.state?.minaDepth ?? 0);
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
      if (replace) window.history.replaceState({ minaApp: true, minaDepth: currentDepth }, '', url);
      else window.history.pushState({ minaApp: true, minaDepth: currentDepth + 1 }, '', url);
    }
    if (next === 'product' && product) setActiveProduct(product);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const back = (fallback: Screen) => {
    const depth = Number(window.history.state?.minaDepth ?? 0);
    if (depth > 0) window.history.back();
    else go(fallback, null, true);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartDetailed = useMemo(() => cart
    .map(item => ({ ...item, product: products.find(p => p.id === item.productId) }))
    .filter((item): item is CartItem & { product: Product } => Boolean(item.product)), [cart]);
  const hasUnknownPrice = cartDetailed.some(item => item.product.price === null);
  const knownTotal = cartDetailed.reduce((sum, item) => sum + (item.product.price ?? 0) * item.qty, 0);

  const addToCart = (product: Product, qty = 1) => {
    const safeQty = Math.max(1, Math.min(Math.floor(qty), 99));
    setCart(prev => {
      const found = prev.find(item => item.productId === product.id);
      return found
        ? prev.map(item => item.productId === product.id ? { ...item, qty: Math.min(item.qty + safeQty, 99) } : item)
        : [...prev, { productId: product.id, qty: safeQty }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev
      .map(item => item.productId === productId ? { ...item, qty: Math.max(0, Math.min(99, item.qty + delta)) } : item)
      .filter(item => item.qty > 0));
  };

  const openProduct = (product: Product) => go('product', product);

  const content = {
    home: <HomeScreen category={category} setCategory={setCategory} query={query} setQuery={setQuery} openProduct={openProduct} addToCart={addToCart} liked={liked} setLiked={setLiked} cartCount={cartCount} go={go} openDrawer={() => setDrawer(true)} />,
    product: <ProductScreen product={activeProduct} onBack={() => back('home')} addToCart={addToCart} go={go} liked={liked.includes(activeProduct.id)} toggleLike={() => setLiked(prev => prev.includes(activeProduct.id) ? prev.filter(id => id !== activeProduct.id) : [...prev, activeProduct.id])} />,
    cart: <CartScreen items={cartDetailed} onBack={() => back('home')} updateQty={updateQty} go={go} knownTotal={knownTotal} hasUnknownPrice={hasUnknownPrice} />,
    booking: <BookingScreen booking={booking} setBooking={setBooking} onBack={() => back('cart')} go={go} />,
    customer: <CustomerScreen customer={customer} setCustomer={setCustomer} onBack={() => back('booking')} go={go} />,
    zone: <ZoneScreen customer={customer} hasItems={cartDetailed.length > 0} onBack={() => back('customer')} go={go} />,
    quote: <QuoteScreen items={cartDetailed} booking={booking} customer={customer} knownTotal={knownTotal} hasUnknownPrice={hasUnknownPrice} onBack={() => back('zone')} go={go} />,
    about: <AboutScreen onBack={() => back('home')} go={go} />
  }[screen];

  return (
    <div className="app-outer">
      <div className="device-shell">
        <div className="top-progress" />
        <div className="screen-route-announcer" role="status" aria-live="polite">{screenNames[screen]}</div>
        <AnimatePresence mode="wait">
          <motion.main
            ref={mainRef}
            tabIndex={-1}
            aria-label={`Écran ${screenNames[screen]}`}
            key={screen}
            initial={reduceMotion ? false : { opacity: 0, x: 18, filter: 'blur(5px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -12, filter: 'blur(3px)' }}
            transition={reduceMotion ? { duration: 0 } : pageTransition}
            className="app-page"
          >{content}</motion.main>
        </AnimatePresence>

        <AnimatePresence>
          {drawer && <Drawer onClose={() => setDrawer(false)} go={go} cartCount={cartCount} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

function HomeScreen({ category, setCategory, query, setQuery, openProduct, addToCart, liked, setLiked, cartCount, go, openDrawer }: {
  category: Category; setCategory: (value: Category) => void; query: string; setQuery: (value: string) => void;
  openProduct: (product: Product) => void; addToCart: (product: Product) => void; liked: string[]; setLiked: React.Dispatch<React.SetStateAction<string[]>>;
  cartCount: number; go: (s: Screen) => void; openDrawer: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const filtered = products.filter(p => (category === 'Tous' || p.category === category) && p.name.toLowerCase().includes(query.toLowerCase()));
  const focusProducts = () => document.querySelector('.product-grid')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  return (
    <div className="home-page page-pad-bottom">
      <div className="home-topbar">
        <button className="icon-button ghost" onClick={openDrawer} aria-label="Ouvrir le menu"><Menu size={19} /></button>
        <BrandMark compact />
        <button className="icon-button ghost cart-button" onClick={() => go('cart')} aria-label={`Panier${cartCount ? `, ${cartCount} article${cartCount > 1 ? 's' : ''}` : ''}`}>
          <ShoppingBag size={19} />{cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </div>

      <motion.section className="hero-card" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={reduceMotion ? { duration: 0 } : pageTransition}>
        <img src="/images/patisseries.png" alt="Créations Mina Brunch" className="hero-card-image" fetchPriority="high" decoding="async" />
        <div className="hero-card-shade" />
        <div className="hero-card-copy">
          <span className="eyebrow light">Pour vos événements</span>
          <h1>L’art d’une table<br /><em>d’exception</em></h1>
          <p>Brunch · salé · sucré · plats · fruits</p>
        </div>
        <div className="hero-card-glyph" aria-hidden="true"><Sparkles size={17} /></div>
      </motion.section>

      <section className="section-block compact-bottom">
        <div className="section-heading-row">
          <div><span className="eyebrow">Sélection du moment</span><h2>Nos créations</h2></div>
          <button className="text-link" onClick={() => setCategory('Tous')}>Tout voir</button>
        </div>

        <div className="search-wrap">
          <Search size={16} aria-hidden="true" />
          <input aria-label="Rechercher une création" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une création…" />
        </div>

        <div className="category-scroll" aria-label="Catégories">
          {categories.map(cat => <button key={cat} onClick={() => setCategory(cat)} aria-pressed={category === cat} className={`category-pill ${category === cat ? 'active' : ''}`}>{cat}</button>)}
        </div>

        <div className="product-grid">
          {filtered.map((product, index) => (
            <motion.article key={product.id} className="product-card" initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={reduceMotion ? { duration: 0 } : { ...pageTransition, delay: Math.min(index * .035, .22) }}>
              <button className="product-image-wrap" onClick={() => openProduct(product)} aria-label={`Voir ${product.name}`}>
                <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
              </button>
              <button className={`heart-button ${liked.includes(product.id) ? 'active' : ''}`} aria-label={liked.includes(product.id) ? `Retirer ${product.name} des favoris` : `Ajouter ${product.name} aux favoris`} aria-pressed={liked.includes(product.id)} onClick={() => setLiked(prev => prev.includes(product.id) ? prev.filter(id => id !== product.id) : [...prev, product.id])}><Heart size={15} fill={liked.includes(product.id) ? 'currentColor' : 'none'} /></button>
              <button className="product-copy" onClick={() => openProduct(product)}>
                <span>{product.category}</span><h3>{product.name}</h3><strong>{money(product.price)}</strong>
              </button>
              <button className="mini-add" onClick={() => addToCart(product)} aria-label={`Ajouter ${product.name} au devis`}><Plus size={15} /></button>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="quiet-banner" onClick={() => go('about')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('about'); } }} role="button" tabIndex={0} aria-label="Découvrir Mina Brunch">
        <img src="/images/Maman photo 8k salé.png" alt="L’univers Mina Brunch" loading="lazy" decoding="async" />
        <div className="quiet-banner-overlay" />
        <div className="quiet-banner-copy"><span className="eyebrow light">Notre univers</span><h3>Des créations pensées pour vos moments.</h3><span className="under-link">Découvrir Mina Brunch</span></div>
      </section>

      <div className="sticky-action-wrap">
        <button className="primary-action" onClick={cartCount ? () => go('cart') : focusProducts}>
          {cartCount ? <><ShoppingBag size={17} /> Composer mon panier <span className="action-count">{cartCount}</span></> : <><ShoppingBag size={17} /> Choisir mes créations</>}
        </button>
      </div>
    </div>
  );
}

function ProductScreen({ product, onBack, addToCart, go, liked, toggleLike }: { product: Product; onBack: () => void; addToCart: (p: Product, qty?: number) => void; go: (s: Screen) => void; liked: boolean; toggleLike: () => void }) {
  const reduceMotion = useReducedMotion();
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(true);
  const add = () => { addToCart(product, qty); go('cart'); };
  return (
    <div className="screen-page detail-page page-pad-bottom">
      <ScreenHeader title="Détail de la création" onBack={onBack} right={<button className={`icon-button ghost ${liked ? 'liked' : ''}`} onClick={toggleLike} aria-label={liked ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={liked}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /></button>} />
      <div className="detail-image-stage"><img src={product.image} alt={product.name} fetchPriority="high" decoding="async" /></div>
      <div className="detail-content">
        <span className="eyebrow">{product.category}</span>
        <div className="title-price"><h1>{product.name}</h1><strong>{money(product.price)}</strong></div>
        <p className="body-copy">{product.description}</p>
        <button className="accordion-head" onClick={() => setOpen(v => !v)} aria-expanded={open}><span>Composition</span><ChevronRight size={17} className={open ? 'rotated' : ''} /></button>
        <AnimatePresence initial={false}>{open && <motion.ul className="composition-list" initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={reduceMotion ? undefined : { height: 0, opacity: 0 }} transition={reduceMotion ? { duration: 0 } : pageTransition}>{product.composition.map(x => <li key={x}><span className="dot" />{x}</li>)}</motion.ul>}</AnimatePresence>
        <div className="quantity-row"><span>Quantité</span><div className="stepper"><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Diminuer la quantité"><Minus size={16} /></button><strong aria-live="polite">{qty}</strong><button onClick={() => setQty(Math.min(99, qty + 1))} aria-label="Augmenter la quantité"><Plus size={16} /></button></div></div>
        <div className="price-note"><Sparkles size={15} /><span>Le tarif final est confirmé après validation de votre demande.</span></div>
      </div>
      <div className="sticky-action-wrap"><button className="primary-action" onClick={add}><ShoppingBag size={17} /> Ajouter au devis</button></div>
    </div>
  );
}

function CartScreen({ items, onBack, updateQty, go, knownTotal, hasUnknownPrice }: { items: Array<CartItem & { product: Product }>; onBack: () => void; updateQty: (id: string, d: number) => void; go: (s: Screen) => void; knownTotal: number; hasUnknownPrice: boolean }) {
  return (
    <div className="screen-page page-pad-bottom">
      <ScreenHeader title="Composer mon panier" onBack={onBack} right={<span className="header-counter" aria-label={`${items.reduce((s, x) => s + x.qty, 0)} articles`}>{items.reduce((s, x) => s + x.qty, 0)}</span>} />
      <div className="step-line" aria-hidden="true"><span className="active" /><span /><span /><span /></div>
      <section className="screen-content top-tight">
        <span className="eyebrow">Votre sélection</span><h1 className="screen-h1">Les pièces choisies</h1>
        {items.length === 0 ? (
          <div className="empty-state"><ShoppingBag size={34} /><h3>Votre panier est vide</h3><p>Choisissez vos créations avant de poursuivre.</p><button className="secondary-action" onClick={() => go('home')}>Découvrir les créations</button></div>
        ) : (
          <div className="cart-list">
            {items.map(({ product, qty }) => <div className="cart-row" key={product.id}>
              <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
              <div className="cart-row-copy"><span>{product.category}</span><h3>{product.name}</h3><strong>{money(product.price)}</strong></div>
              <div className="cart-stepper"><button onClick={() => updateQty(product.id, -1)} aria-label={qty === 1 ? `Retirer ${product.name}` : `Diminuer la quantité de ${product.name}`}>{qty === 1 ? <Trash2 size={13} /> : <Minus size={13} />}</button><b aria-live="polite">{qty}</b><button onClick={() => updateQty(product.id, 1)} aria-label={`Augmenter la quantité de ${product.name}`}><Plus size={13} /></button></div>
            </div>)}
            <button className="add-more" onClick={() => go('home')}><Plus size={15} /> Ajouter une autre création</button>
          </div>
        )}
        {items.length > 0 && <div className="total-panel"><div><span>Sous-total connu</span><b>{knownTotal > 0 ? money(knownTotal) : '—'}</b></div><div><span>Tarif final</span><strong>{hasUnknownPrice || knownTotal === 0 ? 'À confirmer sur devis' : money(knownTotal)}</strong></div><p>Aucun prix n’est inventé : la tarification est validée avec Mina Brunch selon les quantités, la livraison et la prestation.</p></div>}
      </section>
      {items.length > 0 && <div className="sticky-action-wrap"><button className="primary-action" onClick={() => go('booking')}>Continuer <ChevronRight size={17} /></button></div>}
    </div>
  );
}

function BookingScreen({ booking, setBooking, onBack, go }: { booking: Booking; setBooking: React.Dispatch<React.SetStateAction<Booking>>; onBack: () => void; go: (s: Screen) => void }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const slots = ['09:00', '10:30', '12:00', '14:00', '16:00', '18:00'];
  const iso = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isPast = (d: number) => new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monthLabel = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  return (
    <div className="screen-page page-pad-bottom">
      <ScreenHeader title="Réserver votre date" onBack={onBack} />
      <div className="step-line" aria-hidden="true"><span className="active" /><span className="active" /><span /><span /></div>
      <section className="screen-content">
        <span className="eyebrow">Disponibilités</span><h1 className="screen-h1">Choisissez un jour</h1>
        <div className="calendar-card">
          <div className="calendar-nav"><button disabled={isCurrentMonth} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Mois précédent"><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Mois suivant"><ChevronRight size={17} /></button></div>
          <div className="weekday-row" aria-hidden="true">{['L','M','M','J','V','S','D'].map((x,i) => <span key={`${x}${i}`}>{x}</span>)}</div>
          <div className="calendar-grid">{Array.from({ length: firstDay }).map((_,i) => <span key={`blank-${i}`} />)}{Array.from({ length: days }).map((_,i) => { const d=i+1, value=iso(d), selected=booking.date===value; const label=new Date(year,month,d).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); return <button key={d} disabled={isPast(d)} onClick={() => setBooking(b => ({ ...b, date: value }))} aria-label={label} aria-pressed={selected} className={selected ? 'selected' : ''}>{d}</button>; })}</div>
        </div>
        <div className="availability-note"><Check size={14} /><span>Réservation recommandée {business.leadTime}. Le créneau reste à confirmer par Mina Brunch.</span></div>
        <div className="slot-block"><span className="field-label">Créneau souhaité</span><div className="slot-grid">{slots.map(slot => <button key={slot} onClick={() => setBooking(b => ({ ...b, time: slot }))} aria-pressed={booking.time === slot} className={booking.time === slot ? 'selected' : ''}><Clock3 size={13} /> {slot}</button>)}</div></div>
      </section>
      <div className="sticky-action-wrap"><button className="primary-action" disabled={!booking.date || !booking.time} onClick={() => go('customer')}>Continuer <ChevronRight size={17} /></button></div>
    </div>
  );
}

function CustomerScreen({ customer, setCustomer, onBack, go }: { customer: Customer; setCustomer: React.Dispatch<React.SetStateAction<Customer>>; onBack: () => void; go: (s: Screen) => void }) {
  const set = (key: keyof Customer, value: string) => setCustomer(c => ({ ...c, [key]: value }));
  const errors = customerErrors(customer);
  const ready = Boolean(customer.name.trim() && customer.phone.trim() && customer.address.trim() && customer.postalCode && customer.city.trim() && !Object.values(errors).some(Boolean));
  return (
    <div className="screen-page page-pad-bottom">
      <ScreenHeader title="Commande entreprise" onBack={onBack} />
      <div className="step-line" aria-hidden="true"><span className="active" /><span className="active" /><span className="active" /><span /></div>
      <section className="screen-content form-screen">
        <span className="eyebrow">Adresse de livraison</span><h1 className="screen-h1">Vos informations</h1>
        <Field label="Nom et prénom *" value={customer.name} onChange={v => set('name', v)} placeholder="Votre nom" icon={<UserRound size={15} />} autoComplete="name" error={customer.name ? errors.name : ''} />
        <Field label="Téléphone *" value={customer.phone} onChange={v => set('phone', v)} placeholder="06 …" inputMode="tel" type="tel" autoComplete="tel" error={customer.phone ? errors.phone : ''} />
        <Field label="E-mail" value={customer.email} onChange={v => set('email', v)} placeholder="vous@exemple.fr" inputMode="email" type="email" autoComplete="email" error={customer.email ? errors.email : ''} />
        <Field label="Adresse *" value={customer.address} onChange={v => set('address', v)} placeholder="N° et nom de rue" icon={<MapPin size={15} />} autoComplete="street-address" error={customer.address ? errors.address : ''} />
        <div className="field-grid"><Field label="Code postal *" value={customer.postalCode} onChange={v => set('postalCode', v.replace(/\D/g,'').slice(0,5))} placeholder="75000" inputMode="numeric" autoComplete="postal-code" error={customer.postalCode ? errors.postalCode : ''} /><Field label="Ville *" value={customer.city} onChange={v => set('city', v)} placeholder="Paris" autoComplete="address-level2" error={customer.city ? errors.city : ''} /></div>
        <label className="form-field"><span>Précisions / allergies / événement</span><textarea value={customer.notes} onChange={e => set('notes', e.target.value.slice(0,1200))} rows={4} maxLength={1200} placeholder="Ajoutez les informations utiles…" /><small className="form-hint">Ces précisions seront reprises dans le devis PDF et le message WhatsApp.</small></label>
      </section>
      <div className="sticky-action-wrap"><button className="primary-action" disabled={!ready} onClick={() => go('zone')}><MapPin size={17} /> Vérifier la livraison</button></div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, inputMode, icon, type = 'text', autoComplete, error }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; icon?: React.ReactNode; type?: string; autoComplete?: string; error?: string }) {
  const id = useId();
  const errorId = `${id}-error`;
  return <label className={`form-field ${error ? 'has-error' : ''}`}><span>{label}</span><div className="input-shell">{icon}<input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} type={type} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} /></div>{error && <small id={errorId} className="field-error" role="alert">{error}</small>}</label>;
}

function ZoneScreen({ customer, hasItems, onBack, go }: { customer: Customer; hasItems: boolean; onBack: () => void; go: (s: Screen) => void }) {
  const dept = customer.postalCode.slice(0,2);
  const eligible = customer.postalCode.length === 5 && idfDepartments.includes(dept);
  const depts = ['75','92','93','94','91','78','95','77'];
  return (
    <div className="screen-page page-pad-bottom">
      <ScreenHeader title="Vérifier la livraison" onBack={onBack} />
      <section className="screen-content top-tight">
        <div className="address-summary"><MapPin size={15} /><div><b>{customer.address}</b><span>{customer.postalCode} {customer.city}</span></div></div>
        <div className="map-card map-dom-fallback" role="img" aria-label="Schéma de la zone de livraison Mina Brunch en Île-de-France. Ce schéma ne géolocalise pas précisément l’adresse.">
          <div className="map-fallback-inner"><div className="map-fallback-pin"><MapPin size={20} /></div></div>
          <div className="map-fallback-depts" aria-hidden="true">{depts.map(x => <span key={x}>{x}</span>)}</div>
          <span className="map-badge">Île-de-France</span>
          <div className="map-fallback-caption"><div><strong>Zone annoncée</strong><br />8 départements franciliens</div><div>Schéma indicatif<br />pas un géocodage</div></div>
        </div>
        <div className={`zone-result ${eligible ? 'ok' : 'manual'}`}>
          <div className="zone-icon">{eligible ? <Check size={20} /> : <MapPin size={20} />}</div>
          <div><span className="eyebrow">Périmètre de livraison</span><h3>{eligible ? 'Votre code postal est en Île-de-France' : 'Vérification manuelle nécessaire'}</h3><p>{eligible ? 'Le département correspond au périmètre annoncé par Mina Brunch. L’adresse exacte et le prix de livraison restent confirmés sur devis.' : 'Le code postal indiqué ne permet pas de confirmer automatiquement la zone. Mina Brunch validera l’adresse avec vous.'}</p></div>
        </div>
      </section>
      <div className="sticky-action-wrap">{hasItems ? <button className="primary-action" onClick={() => go('quote')}><FileDown size={17} /> Générer mon devis</button> : <button className="primary-action" onClick={() => go('home')}><ShoppingBag size={17} /> Ajouter une création avant le devis</button>}</div>
    </div>
  );
}

function QuoteScreen({ items, booking, customer, knownTotal, hasUnknownPrice, onBack, go }: { items: Array<CartItem & { product: Product }>; booking: Booking; customer: Customer; knownTotal: number; hasUnknownPrice: boolean; onBack: () => void; go: (s: Screen) => void }) {
  const quoteId = useMemo(() => `MB-${new Date().getFullYear()}-${String(Math.floor(Date.now()/1000)).slice(-6)}`, []);
  const quoteDate = new Date().toLocaleDateString('fr-FR');
  const bookingLabel = booking.date ? new Date(`${booking.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'À définir';

  const downloadPdf = () => {
    if (!items.length) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const left = 20, right = 190;
    const addPageHeader = () => {
      doc.setFillColor(247, 243, 235); doc.rect(0,0,210,297,'F');
      doc.setTextColor(47,39,32); doc.setFont('times','bold'); doc.setFontSize(24); doc.text('MINA BRUNCH', left, 26);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(159,116,59); doc.text('TRAITEUR • DEMANDE DE DEVIS',left,32);
      doc.setDrawColor(190,151,99); doc.line(left,38,right,38);
    };
    addPageHeader();
    doc.setTextColor(47,39,32); doc.setFontSize(10);
    doc.text(`Référence : ${quoteId}`,left,48); doc.text(`Date : ${quoteDate}`,140,48);
    doc.text(`Client : ${customer.name || '—'}`,left,58); doc.text(`Téléphone : ${customer.phone || '—'}`,left,64); doc.text(`E-mail : ${customer.email || '—'}`,left,70);
    const addressLines = doc.splitTextToSize(`Livraison : ${customer.address}, ${customer.postalCode} ${customer.city}`,170); doc.text(addressLines,left,80);
    const eventY = 80 + addressLines.length * 5 + 5;
    doc.text(`Événement : ${bookingLabel}${booking.time ? ` • ${booking.time}` : ''}`,left,eventY,{maxWidth:170});
    let y = eventY + 15;
    doc.setFont('times','bold'); doc.setFontSize(15); doc.text('Votre sélection',left,y); y += 10;
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    items.forEach(({product,qty}, i) => {
      if (y > 252) { doc.addPage(); addPageHeader(); y = 52; }
      const nameLines = doc.splitTextToSize(`${i+1}. ${product.name}`,112);
      doc.text(nameLines,left,y); doc.text(`x${qty}`,145,y); doc.text(product.price === null ? 'Sur devis' : money(product.price*qty),right,y,{align:'right'});
      y += Math.max(9, nameLines.length * 5 + 4);
    });
    if (customer.notes.trim()) {
      if (y > 225) { doc.addPage(); addPageHeader(); y = 52; }
      y += 3; doc.setFont('times','bold'); doc.setFontSize(12); doc.text('Précisions / allergies / événement',left,y); y += 7;
      doc.setFont('helvetica','normal'); doc.setFontSize(9); const noteLines = doc.splitTextToSize(customer.notes.trim(),170); doc.text(noteLines,left,y); y += noteLines.length * 4.5 + 5;
    }
    if (y > 248) { doc.addPage(); addPageHeader(); y = 52; }
    doc.setDrawColor(190,151,99); doc.line(left,y,right,y); y += 9;
    doc.setFont('times','bold'); doc.setFontSize(11); doc.text('Tarif final',left,y); doc.text(hasUnknownPrice || knownTotal === 0 ? 'À confirmer' : money(knownTotal),right,y,{align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,91,82); doc.text('Ce document récapitule votre demande. Le tarif est confirmé par Mina Brunch après validation des quantités, de la livraison et de la prestation.',left,y+12,{maxWidth:170});
    doc.setTextColor(159,116,59); doc.text(`${business.phoneDisplay} • ${business.email}`,left,282);
    doc.save(`devis-${quoteId.toLowerCase()}.pdf`);
  };

  const whatsapp = () => {
    if (!items.length) return;
    const lines = items.map(x => `• ${x.product.name} x${x.qty}`).join('\n');
    const notes = customer.notes.trim() ? `\nPrécisions / allergies : ${customer.notes.trim()}` : '';
    const email = customer.email.trim() ? `\nE-mail : ${customer.email.trim()}` : '';
    const text = `Bonjour Mina Brunch, je souhaite confirmer ma demande de devis ${quoteId}.\n\n${lines}\n\nDate : ${bookingLabel} ${booking.time || ''}\nAdresse : ${customer.address}, ${customer.postalCode} ${customer.city}\nNom : ${customer.name}\nTéléphone : ${customer.phone}${email}${notes}\n\nJe comprends que le tarif et le créneau restent à confirmer par Mina Brunch.`;
    window.open(`https://wa.me/${business.phoneWhatsApp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  if (!items.length) {
    return <div className="screen-page page-pad-bottom"><ScreenHeader title="Votre devis" onBack={onBack} /><section className="screen-content"><div className="empty-state"><ShoppingBag size={34} /><h3>Aucune création sélectionnée</h3><p>Un devis Mina Brunch doit contenir au moins une création. Aucun montant à 0 € ne sera présenté comme un tarif réel.</p><button className="secondary-action" onClick={() => go('home')}>Choisir mes créations</button></div></section></div>;
  }

  return (
    <div className="screen-page quote-page page-pad-bottom">
      <ScreenHeader title="Votre devis" onBack={onBack} />
      <div className="step-line" aria-hidden="true"><span className="active" /><span className="active" /><span className="active" /><span className="active" /></div>
      <section className="screen-content">
        <div className="quote-success"><div className="success-seal"><Check size={22} /></div><span className="eyebrow">Votre demande est prête</span><h1>Devis à confirmer par Mina Brunch</h1><p>Vous pouvez télécharger ce récapitulatif puis l’envoyer directement par WhatsApp.</p></div>
        <div className="quote-card">
          <div className="quote-brand"><BrandMark /><span>{quoteId}</span></div>
          <div className="quote-meta-grid"><div><span>Client</span><b>{customer.name || '—'}</b></div><div><span>Date</span><b>{quoteDate}</b></div><div><span>Événement</span><b>{bookingLabel}</b><small>{booking.time}</small></div><div><span>Livraison</span><b>{customer.postalCode} {customer.city}</b><small>{customer.address}</small></div></div>
          <div className="quote-items">{items.map(({product,qty}) => <div key={product.id}><img src={product.image} alt="" loading="lazy" /><div><b>{product.name}</b><span>{product.category} · x{qty}</span></div><strong>{product.price === null ? 'Sur devis' : money(product.price*qty)}</strong></div>)}</div>
          {customer.notes.trim() && <div className="quote-notes"><span>Précisions / allergies / événement</span><p>{customer.notes.trim()}</p></div>}
          <div className="quote-total"><span>Tarif final estimé</span><strong>{hasUnknownPrice || knownTotal === 0 ? 'À confirmer' : money(knownTotal)}</strong><small>Après validation de la prestation et de la livraison</small></div>
        </div>
        <div className="quote-actions"><button className="primary-action static" onClick={downloadPdf}><FileDown size={17} /> Télécharger le devis PDF</button><button className="whatsapp-action" onClick={whatsapp}><Send size={17} /> Envoyer à Mina Brunch</button><button className="text-return" onClick={() => go('home')}>Retour à l’accueil</button></div>
      </section>
    </div>
  );
}

function AboutScreen({ onBack, go }: { onBack: () => void; go: (s: Screen) => void }) {
  const reduceMotion = useReducedMotion();
  const gallery = ['/images/patisseries.png','/images/plateau-fruit-1.png','/images/dome-crevettes-brochettes.png','/images/box-mix.png'];
  return (
    <div className="screen-page about-page page-pad-bottom">
      <ScreenHeader title="À propos" onBack={onBack} />
      <section className="about-hero">
        <img src="/images/Maman photo 8k salé.png" alt="Mina Brunch Traiteur" fetchPriority="high" decoding="async" />
        <div className="about-hero-shade" />
        <div className="about-hero-copy"><span className="eyebrow light">Mina Brunch Traiteur</span><h1>Une cuisine pensée pour <em>vos moments</em></h1></div>
      </section>
      <section className="about-copy screen-content">
        <p className="drop-copy">Brunch, apéritifs, pâtisseries, plateaux de fruits et plats pour vos événements en Île-de-France.</p>
        <div className="facts-row"><div><strong>IDF</strong><span>Zone de livraison</span></div><div><strong>7j/7</strong><span>Selon disponibilité</span></div><div><strong>72h</strong><span>Réservation conseillée</span></div></div>
        <span className="eyebrow">Nos réalisations</span><h2 className="screen-h1 smaller">Vos événements en images</h2>
        <div className="about-gallery">{gallery.map((src,i) => <motion.img key={src} src={src} alt={`Création Mina Brunch ${i+1}`} loading="lazy" decoding="async" whileHover={reduceMotion ? undefined : { scale: 1.025 }} transition={reduceMotion ? { duration: 0 } : spring} />)}</div>
        <div className="trust-row"><div><Sparkles size={19} /><span>Sur mesure</span></div><div><MapPin size={19} /><span>Île-de-France</span></div><div><CalendarDays size={19} /><span>Sur rendez-vous</span></div></div>
        <div className="about-cta"><span>Votre événement mérite une attention particulière.</span><h3>Parlons de votre table.</h3><button className="primary-action static" onClick={() => go('home')}><ShoppingBag size={17} /> Composer ma demande</button></div>
      </section>
    </div>
  );
}

function Drawer({ onClose, go, cartCount }: { onClose: () => void; go: (s: Screen) => void; cartCount: number }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={pageTransition} onClick={onClose}>
    <motion.aside ref={panelRef} className="drawer" role="dialog" aria-modal="true" aria-label="Menu Mina Brunch" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={spring} onClick={e => e.stopPropagation()}>
      <div className="drawer-head"><BrandMark /><button ref={closeRef} className="icon-button ghost" onClick={onClose} aria-label="Fermer le menu"><X size={19} /></button></div>
      <nav aria-label="Navigation de l’application"><button onClick={() => go('home')}>Accueil <ChevronRight size={16} /></button><button onClick={() => go('cart')}>Mon panier {cartCount > 0 && <span>{cartCount}</span>} <ChevronRight size={16} /></button><button onClick={() => go('booking')}>Réserver une date <ChevronRight size={16} /></button><button onClick={() => go('about')}>À propos <ChevronRight size={16} /></button></nav>
      <div className="drawer-contact"><span className="eyebrow">Contact direct</span><a href={`https://wa.me/${business.phoneWhatsApp}`} target="_blank" rel="noreferrer">WhatsApp · {business.phoneDisplay}</a><a href={business.tiktokUrl} target="_blank" rel="noreferrer">TikTok · {business.tiktok}</a></div>
    </motion.aside>
  </motion.div>;
}

export default App;

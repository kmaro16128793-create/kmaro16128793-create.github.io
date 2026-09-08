import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3,
  FileDown, Heart, MapPin, Menu, Minus, Plus, Search,
  Send, ShoppingBag, Sparkles, Trash2, UserRound, X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { business, categories, idfDepartments, products } from './data';
import type { Booking, CartItem, Category, Customer, Product } from './types';

type Screen = 'home' | 'product' | 'cart' | 'booking' | 'customer' | 'zone' | 'quote' | 'about';

const initialCustomer: Customer = {
  name: '', phone: '', email: '', address: '', postalCode: '', city: '', notes: ''
};

const spring = { type: 'spring' as const, stiffness: 340, damping: 34, mass: 0.8 };
const pageTransition = { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const };

function money(value: number | null) {
  if (value === null) return 'Sur devis';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <header className="screen-header">
      <button className="icon-button ghost" onClick={onBack} aria-label="Retour"><ArrowLeft size={19} /></button>
      <div className="screen-title">{title}</div>
      <div className="header-right-slot">{right}</div>
    </header>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? 'compact' : ''}`}>
      <span className="brand-crown">✦</span>
      <span className="brand-name">MINA BRUNCH</span>
      <span className="brand-sub">TRAITEUR</span>
    </div>
  );
}

function App() {
  const reduceMotion = useReducedMotion();
  const [screen, setScreen] = useState<Screen>('home');
  const [activeProduct, setActiveProduct] = useState<Product>(products[0]);
  const [category, setCategory] = useState<Category>('Tous');
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('mina-cart') || '[]'); } catch { return []; }
  });
  const [booking, setBooking] = useState<Booking>(() => {
    try { return JSON.parse(localStorage.getItem('mina-booking') || '{"date":"","time":""}'); } catch { return { date: '', time: '' }; }
  });
  const [customer, setCustomer] = useState<Customer>(() => {
    try { return { ...initialCustomer, ...JSON.parse(localStorage.getItem('mina-customer') || '{}') }; } catch { return initialCustomer; }
  });
  const [liked, setLiked] = useState<string[]>([]);

  useEffect(() => { localStorage.setItem('mina-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('mina-booking', JSON.stringify(booking)); }, [booking]);
  useEffect(() => { localStorage.setItem('mina-customer', JSON.stringify(customer)); }, [customer]);

  const go = (next: Screen) => {
    setDrawer(false);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartDetailed = useMemo(() => cart.map(item => ({ ...item, product: products.find(p => p.id === item.productId)! })).filter(x => x.product), [cart]);
  const hasUnknownPrice = cartDetailed.some(item => item.product.price === null);
  const knownTotal = cartDetailed.reduce((sum, item) => sum + (item.product.price ?? 0) * item.qty, 0);

  const addToCart = (product: Product, qty = 1) => {
    setCart(prev => {
      const found = prev.find(item => item.productId === product.id);
      return found
        ? prev.map(item => item.productId === product.id ? { ...item, qty: item.qty + qty } : item)
        : [...prev, { productId: product.id, qty }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev
      .map(item => item.productId === productId ? { ...item, qty: Math.max(0, item.qty + delta) } : item)
      .filter(item => item.qty > 0));
  };

  const openProduct = (product: Product) => { setActiveProduct(product); go('product'); };

  const content = {
    home: <HomeScreen category={category} setCategory={setCategory} query={query} setQuery={setQuery} openProduct={openProduct} addToCart={addToCart} liked={liked} setLiked={setLiked} cartCount={cartCount} go={go} openDrawer={() => setDrawer(true)} />,
    product: <ProductScreen product={activeProduct} onBack={() => go('home')} addToCart={addToCart} go={go} liked={liked.includes(activeProduct.id)} toggleLike={() => setLiked(prev => prev.includes(activeProduct.id) ? prev.filter(id => id !== activeProduct.id) : [...prev, activeProduct.id])} />,
    cart: <CartScreen items={cartDetailed} onBack={() => go('home')} updateQty={updateQty} go={go} knownTotal={knownTotal} hasUnknownPrice={hasUnknownPrice} />,
    booking: <BookingScreen booking={booking} setBooking={setBooking} onBack={() => go('cart')} go={go} />,
    customer: <CustomerScreen customer={customer} setCustomer={setCustomer} onBack={() => go('booking')} go={go} />,
    zone: <ZoneScreen customer={customer} onBack={() => go('customer')} go={go} />,
    quote: <QuoteScreen items={cartDetailed} booking={booking} customer={customer} knownTotal={knownTotal} hasUnknownPrice={hasUnknownPrice} onBack={() => go('zone')} go={go} />,
    about: <AboutScreen onBack={() => go('home')} go={go} />
  }[screen];

  return (
    <div className="app-outer">
      <div className="device-shell">
        <div className="top-progress" />
        <AnimatePresence mode="wait">
          <motion.main
            key={screen}
            initial={reduceMotion ? false : { opacity: 0, x: 18, filter: 'blur(5px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -12, filter: 'blur(3px)' }}
            transition={pageTransition}
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
  const filtered = products.filter(p => (category === 'Tous' || p.category === category) && p.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="home-page page-pad-bottom">
      <div className="home-topbar">
        <button className="icon-button ghost" onClick={openDrawer} aria-label="Menu"><Menu size={19} /></button>
        <BrandMark compact />
        <button className="icon-button ghost cart-button" onClick={() => go('cart')} aria-label="Panier">
          <ShoppingBag size={19} />{cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </div>

      <motion.section className="hero-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={pageTransition}>
        <img src="/images/patisseries.png" alt="Créations Mina Brunch" className="hero-card-image" />
        <div className="hero-card-shade" />
        <div className="hero-card-copy">
          <span className="eyebrow light">Pour vos événements</span>
          <h1>L’art d’une table<br /><em>d’exception</em></h1>
          <p>Brunch · salé · sucré · plats · fruits</p>
        </div>
        <div className="hero-card-glyph"><Sparkles size={17} /></div>
      </motion.section>

      <section className="section-block compact-bottom">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Sélection du moment</span>
            <h2>Nos créations</h2>
          </div>
          <button className="text-link" onClick={() => setCategory('Tous')}>Tout voir</button>
        </div>

        <div className="search-wrap">
          <Search size={16} />
          <input aria-label="Rechercher une création" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une création…" />
        </div>

        <div className="category-scroll" aria-label="Catégories">
          {categories.map(cat => <button key={cat} onClick={() => setCategory(cat)} className={`category-pill ${category === cat ? 'active' : ''}`}>{cat}</button>)}
        </div>

        <div className="product-grid">
          {filtered.map((product, index) => (
            <motion.article key={product.id} className="product-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...pageTransition, delay: Math.min(index * .035, .22) }}>
              <button className="product-image-wrap" onClick={() => openProduct(product)} aria-label={`Voir ${product.name}`}>
                <img src={product.image} alt={product.name} />
              </button>
              <button className={`heart-button ${liked.includes(product.id) ? 'active' : ''}`} aria-label="Ajouter aux favoris" onClick={() => setLiked(prev => prev.includes(product.id) ? prev.filter(id => id !== product.id) : [...prev, product.id])}><Heart size={15} fill={liked.includes(product.id) ? 'currentColor' : 'none'} /></button>
              <button className="product-copy" onClick={() => openProduct(product)}>
                <span>{product.category}</span>
                <h3>{product.name}</h3>
                <strong>{money(product.price)}</strong>
              </button>
              <button className="mini-add" onClick={() => addToCart(product)} aria-label={`Ajouter ${product.name}`}><Plus size={15} /></button>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="quiet-banner" onClick={() => go('about')} role="button" tabIndex={0}>
        <img src="/images/Maman photo 8k salé.png" alt="L’univers Mina Brunch" />
        <div className="quiet-banner-overlay" />
        <div className="quiet-banner-copy"><span className="eyebrow light">Notre univers</span><h3>Des créations pensées pour vos moments.</h3><span className="under-link">Découvrir Mina Brunch</span></div>
      </section>

      <div className="sticky-action-wrap">
        <button className="primary-action" onClick={() => go(cartCount ? 'cart' : 'booking')}>
          {cartCount ? <><ShoppingBag size={17} /> Composer mon panier <span className="action-count">{cartCount}</span></> : <><CalendarDays size={17} /> Préparer ma demande</>}
        </button>
      </div>
    </div>
  );
}

function ProductScreen({ product, onBack, addToCart, go, liked, toggleLike }: { product: Product; onBack: () => void; addToCart: (p: Product, qty?: number) => void; go: (s: Screen) => void; liked: boolean; toggleLike: () => void }) {
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(true);
  const add = () => { addToCart(product, qty); go('cart'); };
  return (
    <div className="screen-page detail-page page-pad-bottom">
      <ScreenHeader title="Détail de la création" onBack={onBack} right={<button className={`icon-button ghost ${liked ? 'liked' : ''}`} onClick={toggleLike}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /></button>} />
      <div className="detail-image-stage"><img src={product.image} alt={product.name} /></div>
      <div className="detail-content">
        <span className="eyebrow">{product.category}</span>
        <div className="title-price"><h1>{product.name}</h1><strong>{money(product.price)}</strong></div>
        <p className="body-copy">{product.description}</p>
        <button className="accordion-head" onClick={() => setOpen(v => !v)}><span>Composition</span><ChevronRight size={17} className={open ? 'rotated' : ''} /></button>
        <AnimatePresence initial={false}>{open && <motion.ul className="composition-list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={pageTransition}>{product.composition.map(x => <li key={x}><span className="dot" />{x}</li>)}</motion.ul>}</AnimatePresence>
        <div className="quantity-row"><span>Quantité</span><div className="stepper"><button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={16} /></button><strong>{qty}</strong><button onClick={() => setQty(qty + 1)}><Plus size={16} /></button></div></div>
        <div className="price-note"><Sparkles size={15} /><span>Le tarif final est confirmé après validation de votre demande.</span></div>
      </div>
      <div className="sticky-action-wrap"><button className="primary-action" onClick={add}><ShoppingBag size={17} /> Ajouter au devis</button></div>
    </div>
  );
}

function CartScreen({ items, onBack, updateQty, go, knownTotal, hasUnknownPrice }: { items: Array<CartItem & { product: Product }>; onBack: () => void; updateQty: (id: string, d: number) => void; go: (s: Screen) => void; knownTotal: number; hasUnknownPrice: boolean }) {
  return (
    <div className="screen-page page-pad-bottom">
      <ScreenHeader title="Composer mon panier" onBack={onBack} right={<span className="header-counter">{items.reduce((s, x) => s + x.qty, 0)}</span>} />
      <div className="step-line"><span className="active" /><span /><span /><span /></div>
      <section className="screen-content top-tight">
        <span className="eyebrow">Votre sélection</span>
        <h1 className="screen-h1">Les pièces choisies</h1>
        {items.length === 0 ? (
          <div className="empty-state"><ShoppingBag size={34} /><h3>Votre panier est vide</h3><p>Choisissez vos créations avant de poursuivre.</p><button className="secondary-action" onClick={() => go('home')}>Découvrir les créations</button></div>
        ) : (
          <div className="cart-list">
            {items.map(({ product, qty }) => <div className="cart-row" key={product.id}>
              <img src={product.image} alt="" />
              <div className="cart-row-copy"><span>{product.category}</span><h3>{product.name}</h3><strong>{money(product.price)}</strong></div>
              <div className="cart-stepper"><button onClick={() => updateQty(product.id, -1)}>{qty === 1 ? <Trash2 size={13} /> : <Minus size={13} />}</button><b>{qty}</b><button onClick={() => updateQty(product.id, 1)}><Plus size={13} /></button></div>
            </div>)}
            <button className="add-more" onClick={() => go('home')}><Plus size={15} /> Ajouter une autre création</button>
          </div>
        )}
        {items.length > 0 && <div className="total-panel"><div><span>Sous-total connu</span><b>{knownTotal > 0 ? money(knownTotal) : '—'}</b></div><div><span>Tarif final</span><strong>{hasUnknownPrice ? 'À confirmer sur devis' : money(knownTotal)}</strong></div><p>Aucun prix n’est inventé : la tarification est validée avec Mina Brunch selon les quantités, la livraison et la prestation.</p></div>}
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
  const isPast = (d: number) => new Date(year, month, d, 23, 59) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monthLabel = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return (
    <div className="screen-page page-pad-bottom">
      <ScreenHeader title="Réserver votre date" onBack={onBack} />
      <div className="step-line"><span className="active" /><span className="active" /><span /><span /></div>
      <section className="screen-content">
        <span className="eyebrow">Disponibilités</span><h1 className="screen-h1">Choisissez un jour</h1>
        <div className="calendar-card">
          <div className="calendar-nav"><button onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={17} /></button></div>
          <div className="weekday-row">{['L','M','M','J','V','S','D'].map((x,i) => <span key={`${x}${i}`}>{x}</span>)}</div>
          <div className="calendar-grid">{Array.from({ length: firstDay }).map((_,i) => <span key={`blank-${i}`} />)}{Array.from({ length: days }).map((_,i) => { const d=i+1, value=iso(d), selected=booking.date===value; return <button key={d} disabled={isPast(d)} onClick={() => setBooking(b => ({ ...b, date: value }))} className={selected ? 'selected' : ''}>{d}</button>; })}</div>
        </div>
        <div className="availability-note"><Check size={14} /><span>Réservation recommandée {business.leadTime}</span></div>
        <div className="slot-block"><span className="field-label">Créneau souhaité</span><div className="slot-grid">{slots.map(slot => <button key={slot} onClick={() => setBooking(b => ({ ...b, time: slot }))} className={booking.time === slot ? 'selected' : ''}><Clock3 size={13} /> {slot}</button>)}</div></div>
      </section>
      <div className="sticky-action-wrap"><button className="primary-action" disabled={!booking.date || !booking.time} onClick={() => go('customer')}>Continuer <ChevronRight size={17} /></button></div>
    </div>
  );
}

function CustomerScreen({ customer, setCustomer, onBack, go }: { customer: Customer; setCustomer: React.Dispatch<React.SetStateAction<Customer>>; onBack: () => void; go: (s: Screen) => void }) {
  const set = (key: keyof Customer, value: string) => setCustomer(c => ({ ...c, [key]: value }));
  const ready = customer.name && customer.phone && customer.address && customer.postalCode && customer.city;
  return (
    <div className="screen-page page-pad-bottom">
      <ScreenHeader title="Commande entreprise" onBack={onBack} />
      <div className="step-line"><span className="active" /><span className="active" /><span className="active" /><span /></div>
      <section className="screen-content form-screen">
        <span className="eyebrow">Adresse de livraison</span><h1 className="screen-h1">Vos informations</h1>
        <Field label="Nom et prénom *" value={customer.name} onChange={v => set('name', v)} placeholder="Votre nom" icon={<UserRound size={15} />} />
        <Field label="Téléphone *" value={customer.phone} onChange={v => set('phone', v)} placeholder="06 …" inputMode="tel" />
        <Field label="E-mail" value={customer.email} onChange={v => set('email', v)} placeholder="vous@exemple.fr" inputMode="email" />
        <Field label="Adresse *" value={customer.address} onChange={v => set('address', v)} placeholder="N° et nom de rue" icon={<MapPin size={15} />} />
        <div className="field-grid"><Field label="Code postal *" value={customer.postalCode} onChange={v => set('postalCode', v.replace(/\D/g,'').slice(0,5))} placeholder="75000" inputMode="numeric" /><Field label="Ville *" value={customer.city} onChange={v => set('city', v)} placeholder="Paris" /></div>
        <label className="form-field"><span>Précisions / allergies / événement</span><textarea value={customer.notes} onChange={e => set('notes', e.target.value)} rows={4} placeholder="Ajoutez les informations utiles…" /></label>
      </section>
      <div className="sticky-action-wrap"><button className="primary-action" disabled={!ready} onClick={() => go('zone')}><MapPin size={17} /> Vérifier la livraison</button></div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, inputMode, icon }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; icon?: React.ReactNode }) {
  return <label className="form-field"><span>{label}</span><div className="input-shell">{icon}<input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} /></div></label>;
}

function ZoneScreen({ customer, onBack, go }: { customer: Customer; onBack: () => void; go: (s: Screen) => void }) {
  const dept = customer.postalCode.slice(0,2);
  const eligible = customer.postalCode.length === 5 && idfDepartments.includes(dept);
  return (
    <div className="screen-page page-pad-bottom">
      <ScreenHeader title="Vérifier la livraison" onBack={onBack} />
      <section className="screen-content top-tight">
        <div className="address-summary"><MapPin size={15} /><div><b>{customer.address}</b><span>{customer.postalCode} {customer.city}</span></div></div>
        <div className="map-card">
          <iframe title="Carte de Saint-Ouen et Paris" src="https://www.openstreetmap.org/export/embed.html?bbox=2.250%2C48.835%2C2.435%2C48.955&layer=mapnik&marker=48.9119%2C2.3340" loading="lazy" />
          <div className="map-wash" />
          <div className="delivery-ring"><div className="delivery-pin"><MapPin size={18} /></div></div>
          <span className="map-badge">Île-de-France</span>
        </div>
        <div className={`zone-result ${eligible ? 'ok' : 'manual'}`}>
          <div className="zone-icon">{eligible ? <Check size={20} /> : <MapPin size={20} />}</div>
          <div><span className="eyebrow">Périmètre de livraison</span><h3>{eligible ? 'Votre adresse est en Île-de-France' : 'Vérification manuelle nécessaire'}</h3><p>{eligible ? 'La zone correspond au périmètre annoncé par Mina Brunch. Le prix de livraison reste confirmé sur devis.' : 'Le code postal indiqué ne permet pas de confirmer automatiquement la zone. Mina Brunch validera l’adresse avec vous.'}</p></div>
        </div>
      </section>
      <div className="sticky-action-wrap"><button className="primary-action" onClick={() => go('quote')}><FileDown size={17} /> Générer mon devis</button></div>
    </div>
  );
}

function QuoteScreen({ items, booking, customer, knownTotal, hasUnknownPrice, onBack, go }: { items: Array<CartItem & { product: Product }>; booking: Booking; customer: Customer; knownTotal: number; hasUnknownPrice: boolean; onBack: () => void; go: (s: Screen) => void }) {
  const quoteId = useMemo(() => `MB-${new Date().getFullYear()}-${String(Math.floor(Date.now()/1000)).slice(-6)}`, []);
  const quoteDate = new Date().toLocaleDateString('fr-FR');
  const bookingLabel = booking.date ? new Date(`${booking.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'À définir';

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFillColor(247, 243, 235); doc.rect(0,0,210,297,'F');
    doc.setTextColor(47,39,32); doc.setFont('times','bold'); doc.setFontSize(24); doc.text('MINA BRUNCH', 20, 26);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(159,116,59); doc.text('TRAITEUR • DEMANDE DE DEVIS',20,32);
    doc.setDrawColor(190,151,99); doc.line(20,38,190,38);
    doc.setTextColor(47,39,32); doc.setFontSize(10);
    doc.text(`Référence : ${quoteId}`,20,48); doc.text(`Date : ${quoteDate}`,140,48);
    doc.text(`Client : ${customer.name || '—'}`,20,58); doc.text(`Téléphone : ${customer.phone || '—'}`,20,64); doc.text(`E-mail : ${customer.email || '—'}`,20,70);
    doc.text(`Livraison : ${customer.address}, ${customer.postalCode} ${customer.city}`,20,80,{maxWidth:170});
    doc.text(`Événement : ${bookingLabel}${booking.time ? ` • ${booking.time}` : ''}`,20,90,{maxWidth:170});
    doc.setFont('times','bold'); doc.setFontSize(15); doc.text('Votre sélection',20,105);
    let y = 115;
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    items.forEach(({product,qty}, i) => { if (y > 258) { doc.addPage(); y = 25; } doc.text(`${i+1}. ${product.name}`,20,y); doc.text(`x${qty}`,145,y); doc.text(product.price === null ? 'Sur devis' : money(product.price*qty),190,y,{align:'right'}); y += 9; });
    y += 4; doc.setDrawColor(190,151,99); doc.line(20,y,190,y); y += 9;
    doc.setFont('times','bold'); doc.text('Tarif final',20,y); doc.text(hasUnknownPrice ? 'À confirmer' : money(knownTotal),190,y,{align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(100,91,82); doc.text('Ce document récapitule votre demande. Le tarif est confirmé par Mina Brunch après validation des quantités, de la livraison et de la prestation.',20,y+12,{maxWidth:170});
    doc.setTextColor(159,116,59); doc.text(`${business.phoneDisplay} • ${business.email}`,20,282);
    doc.save(`devis-${quoteId.toLowerCase()}.pdf`);
  };

  const whatsapp = () => {
    const lines = items.map(x => `• ${x.product.name} x${x.qty}`).join('\n');
    const text = `Bonjour Mina Brunch, je souhaite confirmer ma demande de devis ${quoteId}.\n\n${lines}\n\nDate : ${bookingLabel} ${booking.time || ''}\nAdresse : ${customer.address}, ${customer.postalCode} ${customer.city}\nNom : ${customer.name}\nTéléphone : ${customer.phone}`;
    window.open(`https://wa.me/${business.phoneWhatsApp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="screen-page quote-page page-pad-bottom">
      <ScreenHeader title="Votre devis" onBack={onBack} />
      <div className="step-line"><span className="active" /><span className="active" /><span className="active" /><span className="active" /></div>
      <section className="screen-content">
        <div className="quote-success"><div className="success-seal"><Check size={22} /></div><span className="eyebrow">Votre demande est prête</span><h1>Devis à confirmer par Mina Brunch</h1><p>Vous pouvez télécharger ce récapitulatif puis l’envoyer directement par WhatsApp.</p></div>
        <div className="quote-card">
          <div className="quote-brand"><BrandMark /><span>{quoteId}</span></div>
          <div className="quote-meta-grid"><div><span>Client</span><b>{customer.name || '—'}</b></div><div><span>Date</span><b>{quoteDate}</b></div><div><span>Événement</span><b>{bookingLabel}</b><small>{booking.time}</small></div><div><span>Livraison</span><b>{customer.postalCode} {customer.city}</b><small>{customer.address}</small></div></div>
          <div className="quote-items">{items.map(({product,qty}) => <div key={product.id}><img src={product.image} alt="" /><div><b>{product.name}</b><span>{product.category} · x{qty}</span></div><strong>{product.price === null ? 'Sur devis' : money(product.price*qty)}</strong></div>)}</div>
          <div className="quote-total"><span>Tarif final estimé</span><strong>{hasUnknownPrice ? 'À confirmer' : money(knownTotal)}</strong><small>Après validation de la prestation et de la livraison</small></div>
        </div>
        <div className="quote-actions"><button className="primary-action static" onClick={downloadPdf}><FileDown size={17} /> Télécharger le devis PDF</button><button className="whatsapp-action" onClick={whatsapp}><Send size={17} /> Envoyer à Mina Brunch</button><button className="text-return" onClick={() => go('home')}>Retour à l’accueil</button></div>
      </section>
    </div>
  );
}

function AboutScreen({ onBack, go }: { onBack: () => void; go: (s: Screen) => void }) {
  const gallery = ['/images/patisseries.png','/images/plateau-fruit-1.png','/images/dome-crevettes-brochettes.png','/images/box-mix.png'];
  return (
    <div className="screen-page about-page page-pad-bottom">
      <ScreenHeader title="À propos" onBack={onBack} />
      <section className="about-hero">
        <img src="/images/Maman photo 8k salé.png" alt="Mina Brunch Traiteur" />
        <div className="about-hero-shade" />
        <div className="about-hero-copy"><span className="eyebrow light">Mina Brunch Traiteur</span><h1>Une cuisine pensée pour <em>vos moments</em></h1></div>
      </section>
      <section className="about-copy screen-content">
        <p className="drop-copy">Brunch, apéritifs, pâtisseries, plateaux de fruits et plats pour vos événements en Île-de-France.</p>
        <div className="facts-row"><div><strong>IDF</strong><span>Zone de livraison</span></div><div><strong>7j/7</strong><span>Selon disponibilité</span></div><div><strong>72h</strong><span>Réservation conseillée</span></div></div>
        <span className="eyebrow">Nos réalisations</span><h2 className="screen-h1 smaller">Vos événements en images</h2>
        <div className="about-gallery">{gallery.map((src,i) => <motion.img key={src} src={src} alt={`Création Mina Brunch ${i+1}`} whileHover={{ scale: 1.025 }} transition={spring} />)}</div>
        <div className="trust-row"><div><Sparkles size={19} /><span>Sur mesure</span></div><div><MapPin size={19} /><span>Île-de-France</span></div><div><CalendarDays size={19} /><span>Sur rendez-vous</span></div></div>
        <div className="about-cta"><span>Votre événement mérite une attention particulière.</span><h3>Parlons de votre table.</h3><button className="primary-action static" onClick={() => go('home')}><ShoppingBag size={17} /> Composer ma demande</button></div>
      </section>
    </div>
  );
}

function Drawer({ onClose, go, cartCount }: { onClose: () => void; go: (s: Screen) => void; cartCount: number }) {
  return <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={pageTransition} onClick={onClose}>
    <motion.aside className="drawer" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={spring} onClick={e => e.stopPropagation()}>
      <div className="drawer-head"><BrandMark /><button className="icon-button ghost" onClick={onClose}><X size={19} /></button></div>
      <nav><button onClick={() => go('home')}>Accueil <ChevronRight size={16} /></button><button onClick={() => go('cart')}>Mon panier {cartCount > 0 && <span>{cartCount}</span>} <ChevronRight size={16} /></button><button onClick={() => go('booking')}>Réserver une date <ChevronRight size={16} /></button><button onClick={() => go('about')}>À propos <ChevronRight size={16} /></button></nav>
      <div className="drawer-contact"><span className="eyebrow">Contact direct</span><a href={`https://wa.me/${business.phoneWhatsApp}`} target="_blank" rel="noreferrer">WhatsApp · {business.phoneDisplay}</a><a href={business.tiktokUrl} target="_blank" rel="noreferrer">TikTok · {business.tiktok}</a></div>
    </motion.aside>
  </motion.div>;
}

export default App;

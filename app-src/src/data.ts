import type { Product } from './types';

export const business = {
  name: 'Mina Brunch',
  label: 'Traiteur',
  phoneDisplay: '+33 6 51 16 84 51',
  phoneWhatsApp: '33651168451',
  email: 'contact@minabrunch.fr',
  tiktok: '@minabrunchtraiteur',
  tiktokUrl: 'https://www.tiktok.com/@minabrunchtraiteur',
  pickup: 'Saint-Ouen-sur-Seine · Métro Garibaldi',
  delivery: "Toute l’Île-de-France",
  leadTime: '72h à l’avance'
};

export const products: Product[] = [
  { id: 'patisseries', name: "Pâtisseries d’Exception", category: 'Sucré', image: '/images/patisseries.png', featured: true, description: "Une sélection élégante de douceurs pour vos réceptions et tables de fête.", composition: ['Assortiment selon la demande', 'Présentation soignée', 'Préparation sur commande'], price: null },
  { id: 'box-mix', name: 'Box Sucrée & Salée', category: 'Brunch', image: '/images/box-mix.png', featured: true, description: "Une box généreuse qui réunit le meilleur du sucré et du salé.", composition: ['Sélection sucrée', 'Sélection salée', 'Présentation prête à servir'], price: null },
  { id: 'box-aperitive', name: 'Box Apéritive Premium', category: 'Salé', image: '/images/box-sale-1.png', description: "Des bouchées variées pour cocktails, anniversaires et réceptions.", composition: ['Mini bouchées', 'Pièces salées variées', 'Dressage soigné'], price: null },
  { id: 'brunch', name: 'Assortiment Brunch', category: 'Brunch', image: '/images/box-sale-2.png', featured: true, description: "Une composition brunch pensée pour partager un moment gourmand.", composition: ['Assortiment brunch', 'Pièces sucrées et salées', 'Préparé sur commande'], price: null },
  { id: 'plateaux-varies', name: 'Plateaux Variés', category: 'Salé', image: '/images/box-sale-3.png', description: "Des plateaux à partager, composés selon votre événement et vos envies.", composition: ['Assortiment personnalisé', 'Quantités adaptées', 'Présentation événementielle'], price: null },
  { id: 'fruits-exotiques', name: 'Plateau de Fruits Exotiques', category: 'Fruits', image: '/images/plateau-fruit-1.png', featured: true, description: "Une composition fraîche et colorée pour apporter de la légèreté à votre table.", composition: ['Fruits de saison', 'Fruits exotiques selon disponibilité', 'Découpe et dressage'], price: null },
  { id: 'fruits-composition', name: 'Composition Fruitée', category: 'Fruits', image: '/images/plateau-fruit-2.png', description: "Une création fruitée dressée avec soin pour vos buffets et réceptions.", composition: ['Fruits frais', 'Composition artistique', 'Format sur mesure'], price: null },
  { id: 'couscous-pruneaux', name: 'Couscous aux Pruneaux', category: 'Plats', image: '/images/couscous.png', description: "Un plat généreux pour vos repas familiaux et événements.", composition: ['Préparation sur commande', 'Portions adaptées', 'Présentation prête à servir'], price: null },
  { id: 'dessert-oriental', name: 'Dessert Oriental', category: 'Sucré', image: '/images/dessert-oriental.png', description: "Une douceur orientale à intégrer à vos plateaux et buffets.", composition: ['Préparation artisanale', 'Dressage soigné', 'Quantités sur mesure'], price: null },
  { id: 'feuilletee', name: 'Pâtisserie Feuilletée', category: 'Sucré', image: '/images/patisserie-feuilletee.png', description: "Une pâtisserie fine et croustillante pour compléter vos assortiments.", composition: ['Feuilletage', 'Garniture selon sélection', 'Préparation sur commande'], price: null },
  { id: 'dome-crevettes', name: 'Dôme Crevettes & Brochettes', category: 'Salé', image: '/images/dome-crevettes-brochettes.png', description: "Une présentation festive conçue pour les grandes tables et réceptions.", composition: ['Crevettes', 'Brochettes', 'Dressage événementiel'], price: null },
  { id: 'gateau-couscous', name: 'Gâteau Couscous Poulet', category: 'Plats', image: '/images/gateau-couscous-poulet.png', description: "Une présentation originale de plat salé pour vos événements.", composition: ['Poulet', 'Semoule', 'Dressage sur commande'], price: null },
  { id: 'poulets-conique', name: 'Plat Conique Poulets', category: 'Plats', image: '/images/plat-conique-poulets.png', description: "Un plat de réception généreux, préparé selon le nombre de convives.", composition: ['Poulet', 'Accompagnement', 'Format événementiel'], price: null },
  { id: 'couscous-viande', name: 'Couscous & Viande', category: 'Plats', image: '/images/plat-couscous-viande.png', description: "Un grand classique pour les repas de groupe et événements familiaux.", composition: ['Viande', 'Semoule', 'Garniture selon commande'], price: null },
  { id: 'poulets-rotis', name: 'Plat Poulets Rôtis', category: 'Plats', image: '/images/plat-poulets-rotis.png', description: "Une préparation conviviale pour recevoir simplement et généreusement.", composition: ['Poulets rôtis', 'Garniture', 'Quantités adaptées'], price: null },
  { id: 'salade-gateau', name: 'Salade Gâteau', category: 'Salé', image: '/images/salade-gateau.png', description: "Une composition salée originale pour vos buffets et tables de réception.", composition: ['Composition salée', 'Décor événementiel', 'Format sur mesure'], price: null },
  { id: 'viande-abricots', name: 'Viande aux Abricots', category: 'Plats', image: '/images/viande-abricots-pruneaux.png', description: "Une préparation sucrée-salée destinée aux repas et réceptions.", composition: ['Viande', 'Abricots et fruits secs', 'Préparation sur commande'], price: null }
];

export const categories = ['Tous', 'Brunch', 'Salé', 'Sucré', 'Plats', 'Fruits'] as const;
export const idfDepartments = ['75', '77', '78', '91', '92', '93', '94', '95'];

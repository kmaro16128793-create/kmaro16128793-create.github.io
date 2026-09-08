export type Category = 'Tous' | 'Brunch' | 'Salé' | 'Sucré' | 'Plats' | 'Fruits';

export type Product = {
  id: string;
  name: string;
  category: Exclude<Category, 'Tous'>;
  image: string;
  description: string;
  composition: string[];
  price: number | null;
  featured?: boolean;
};

export type CartItem = { productId: string; qty: number };

export type Customer = {
  name: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  notes: string;
};

export type Booking = { date: string; time: string };

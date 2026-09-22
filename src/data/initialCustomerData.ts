import { CustomerApplication, AdBanner } from '../types';

export const INITIAL_CUSTOMER_APPLICATIONS: CustomerApplication[] = [];

export const INITIAL_AD_BANNERS: AdBanner[] = [
  {
    id: 'ad-001',
    title: 'Nouvel Arrivage • Extraits Oud & Ambre Pur',
    subtitle: 'Qualité supérieure importée de Grasse & Dubaï. Réservation réservée aux parfumeurs enregistrés.',
    imageUrl: 'https://images.unsplash.com/photo-1615397349754-cfa2066a298e?w=1000&auto=format&fit=crop&q=80',
    badgeText: 'NOUVEAU STOCK 2026',
    buttonText: 'Consulter le Catalogue',
    isActive: true,
    createdAt: '2026-09-10T12:00:00.000Z',
  },
  {
    id: 'ad-002',
    title: 'Collection Flacons Cristallins Haute Joaillerie',
    subtitle: 'Flacons 50ml et 100ml en verre lourd avec pompes serties or & argent. Vente en gros par cartons de 50 unités.',
    imageUrl: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=1000&auto=format&fit=crop&q=80',
    badgeText: 'PACKAGING PRESTIGE',
    buttonText: 'Voir les Flacons',
    isActive: true,
    createdAt: '2026-09-11T14:30:00.000Z',
  },
  {
    id: 'ad-003',
    title: 'Tarifs Professionnels & Vente en Demi-Gros',
    subtitle: 'Inscrivez-vous pour obtenir vos identifiants d\'accès et débloquer les tarifs exclusifs réservés aux artisans.',
    imageUrl: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=1000&auto=format&fit=crop&q=80',
    badgeText: 'ACCÈS PRO',
    buttonText: 'Demander un Compte',
    isActive: true,
    createdAt: '2026-09-12T09:00:00.000Z',
  },
];

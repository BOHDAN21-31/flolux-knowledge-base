// Палітра іконок для розділів (Topic.icon зберігає ім'я ключа).
import {
  Flower2, BookOpen, Truck, Coffee, Camera, Wrench, Settings, FileText, Users,
  Heart, Star, Sparkles, Gift, Cake, Award, Briefcase, Calendar, Clock, MapPin,
  Phone, Mail, ShoppingCart, CreditCard, Bell, Cloud, Database, Box, Layers,
  Lightbulb, Music,
} from 'lucide-react';

export const TOPIC_ICONS = {
  Flower2, BookOpen, Truck, Coffee, Camera, Wrench, Settings, FileText, Users,
  Heart, Star, Sparkles, Gift, Cake, Award, Briefcase, Calendar, Clock, MapPin,
  Phone, Mail, ShoppingCart, CreditCard, Bell, Cloud, Database, Box, Layers,
  Lightbulb, Music,
};

export const TOPIC_ICON_NAMES = Object.keys(TOPIC_ICONS);

// Компонент іконки за ім'ям, з фолбеком.
export const iconFor = (name, fallback = BookOpen) => TOPIC_ICONS[name] || fallback;

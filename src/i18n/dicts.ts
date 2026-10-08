import en, { type Dict } from './locales/en';
import hi from './locales/hi';
import bn from './locales/bn';
import as from './locales/as';
import es from './locales/es';
import pt from './locales/pt';
import fr from './locales/fr';
import ar from './locales/ar';
import ur from './locales/ur';
import zh from './locales/zh';
import ja from './locales/ja';
import ko from './locales/ko';
import ru from './locales/ru';
import id from './locales/id';
import de from './locales/de';
import tr from './locales/tr';
import it from './locales/it';
import vi from './locales/vi';
import th from './locales/th';
import ta from './locales/ta';
import { locales, type Locale } from './index';

const maps: Record<Locale, Dict> = {
  en, hi, bn, as, es, pt, fr, ar, ur, zh,
  ja, ko, ru, id, de, tr, it, vi, th, ta,
};

export function getDict(locale: string): Dict {
  if ((locales as readonly string[]).includes(locale)) return maps[locale as Locale];
  return en;
}

export type { Dict };

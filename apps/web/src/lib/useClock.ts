import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n';

const clockOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'Africa/Dar_es_Salaam',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
};

export function useClock(): string {
  const { locale } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return `${new Intl.DateTimeFormat(locale, clockOptions).format(now)} (EAT)`;
}

export interface PricedAddon {
  id: string;
  name: string;
  priceCents: number;
  durationMin: number;
}

export interface Quote {
  basePriceCents: number;
  addonsPriceCents: number;
  totalCents: number;
  durationMin: number;
}

export function quoteFor(basePriceCents: number, baseDurationMin: number, addons: PricedAddon[]): Quote {
  const addonsPriceCents = addons.reduce((sum, addon) => sum + addon.priceCents, 0);
  const addonsDuration = addons.reduce((sum, addon) => sum + addon.durationMin, 0);
  return {
    basePriceCents,
    addonsPriceCents,
    totalCents: basePriceCents + addonsPriceCents,
    durationMin: baseDurationMin + addonsDuration,
  };
}

export function formatMoney(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr${hours === 1 ? '' : 's'}` : `${hours} hr ${rest} min`;
}

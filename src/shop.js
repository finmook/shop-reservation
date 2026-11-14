// The shop's Twitter account that customers contact after a successful reservation.
// Override with VITE_SHOP_TWITTER if it changes.
export const SHOP_TWITTER = (import.meta.env.VITE_SHOP_TWITTER || 'OoKamaruvvoO').replace(/^@/, '')
export const SHOP_TWITTER_URL = `https://x.com/${SHOP_TWITTER}`

// Seasonal theme. Set VITE_THEME=default to switch Christmas off.
export const THEME = import.meta.env.VITE_THEME || 'christmas'
export const DECOR =
  THEME === 'christmas'
    ? { brand: '🎄', hero: '🧸', tagline: 'Merry Christmas~ 🎁' }
    : { brand: '🧸', hero: '🧸', tagline: '' }

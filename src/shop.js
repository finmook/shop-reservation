// The shop's Twitter account that customers contact after a successful reservation.
// Override with VITE_SHOP_TWITTER if it changes.
export const SHOP_TWITTER = (import.meta.env.VITE_SHOP_TWITTER || 'OoKamaruvvoO').replace(/^@/, '')
export const SHOP_TWITTER_URL = `https://x.com/${SHOP_TWITTER}`

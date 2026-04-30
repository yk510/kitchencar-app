import Stripe from 'stripe'

let stripeClient: Stripe | null = null

function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || null
}

export function getStripeConfigStatus() {
  return {
    hasSecretKey: Boolean(getStripeSecretKey()),
    hasWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
  }
}

export function getStripeClient() {
  const secretKey = getStripeSecretKey()

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY が未設定です')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey)
  }

  return stripeClient
}

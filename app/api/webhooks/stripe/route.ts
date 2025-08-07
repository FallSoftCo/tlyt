import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!stripe) {
    console.error('Stripe not configured')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  if (!webhookSecret) {
    console.error('Stripe webhook secret not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
  }

  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('No Stripe signature found')
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('Processing webhook event:', event.type)

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'payment_intent.succeeded':
        console.log('Payment intent succeeded:', event.data.object.id)
        break

      case 'payment_intent.payment_failed':
        console.log('Payment intent failed:', event.data.object.id)
        break

      default:
        console.log('Unhandled event type:', event.type)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing completed checkout session:', session.id)

  try {
    // Get the user ID from the client_reference_id
    const userId = session.client_reference_id
    if (!userId) {
      console.error('No client_reference_id found in session:', session.id)
      return
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      console.error('User not found:', userId)
      return
    }

    // Get line items to determine which package was purchased
    if (!stripe) {
      console.error('Stripe not available for listing line items')
      return
    }
    
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ['data.price.product']
    })

    if (lineItems.data.length === 0) {
      console.error('No line items found for session:', session.id)
      return
    }

    const lineItem = lineItems.data[0]
    const priceId = lineItem.price?.id

    if (!priceId) {
      console.error('No price ID found in line item')
      return
    }

    // Find the corresponding chip package
    const chipPackage = await prisma.chipPackage.findUnique({
      where: { stripePriceId: priceId }
    })

    if (!chipPackage) {
      console.error('No chip package found for price ID:', priceId)
      return
    }

    const quantity = lineItem.quantity || 1
    const totalChips = chipPackage.chipAmount * quantity
    const totalAmount = (lineItem.amount_total || 0) // Amount in cents

    console.log(`Crediting user ${userId} with ${totalChips} chips for $${totalAmount / 100}`)

    // Use database transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Update user chip balance
      await tx.user.update({
        where: { id: userId },
        data: {
          chipBalance: {
            increment: totalChips
          }
        }
      })

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          type: 'PURCHASE',
          chipAmount: totalChips,
          description: `Purchased ${chipPackage.name} (${chipPackage.chipAmount} chips x${quantity})`,
          stripeSessionId: session.id,
          packageId: chipPackage.id
        }
      })
    })

    console.log(`Successfully credited ${totalChips} chips to user ${userId}`)

  } catch (error) {
    console.error('Error handling checkout session completed:', error)
    throw error
  }
}
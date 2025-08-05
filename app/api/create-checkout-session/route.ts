// app/api/create-checkout-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {

  try {
    const { items, userId } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    // Validate quantity limits - max 1 of each product
    for (const item of items) {
      if (item.quantity > 1) {
        return NextResponse.json(
          { error: "Maximum quantity of 1 per product type allowed" },
          { status: 400 }
        );
      }
    }

    // Create a simple checkout session without customer association
    // The customer creation and association will happen in webhook handling
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      client_reference_id: userId || '', // This will be visible in the webhook
      line_items: items.map((item: { priceId: string; quantity: number }) => ({
        price: item.priceId,
        quantity: item.quantity,
      })),
      mode: "payment",
      success_url: `${process.env.VERCEL_ENV === "development" ? "http://" : "https://"}${process.env.VERCEL_URL || "localhost:3256"}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.VERCEL_ENV === "development" ? "http://" : "https://"}${process.env.VERCEL_URL || "localhost:3256"}/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Error creating checkout session" },
      { status: 500 }
    );
  }
}
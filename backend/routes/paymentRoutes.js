const express = require('express');
const Stripe = require('stripe');
const authenticateUser = require('../middleware/authenticateUser'); // Assuming you have auth middleware
const prisma = require('../services/prismaClient'); // Import Prisma client

// Load environment variables
require('dotenv').config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// Endpoint to create a checkout session for subscriptions
router.post('/create-checkout-session', authenticateUser, async (req, res) => {
  const userId = req.user?.id; // Get user ID from authenticated request
  const userEmail = req.user?.email; // Get user email

  if (!userId || !userEmail) {
    return res.status(401).json({ error: 'User not authenticated or email missing.' });
  }

  // --- IMPORTANT: Replace with your actual Subscription Price ID ---
  const priceId = 'price_YOUR_SUBSCRIPTION_PRICE_ID';
  // ---

  const YOUR_DOMAIN = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    // Find the user in your database
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found in database.' });
    }

    let stripeCustomerId = user.stripeCustomerId;

    // If the user doesn't have a Stripe Customer ID, create one
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId, // Link Stripe Customer to your internal User ID
        },
      });
      stripeCustomerId = customer.id;

      // Update the user record in your database with the new Stripe Customer ID
      user = await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: stripeCustomerId },
      });
    }

    // Create the Stripe Checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription', // Set mode to subscription
      customer: stripeCustomerId, // Pass the Stripe Customer ID
      success_url: `${YOUR_DOMAIN}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`, // Redirect to billing page on success
      cancel_url: `${YOUR_DOMAIN}/billing?status=cancel`, // Redirect to billing page on cancel
      // We don't need client_reference_id as we use stripeCustomerId
      // Add metadata if needed, e.g., linking the checkout to a specific plan variation
      // metadata: { plan: 'premium' }
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating Stripe subscription checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Helper function to manage subscription status updates
const manageSubscriptionStatusChange = async (subscriptionId, customerId, createAction = false) => {
  try {
    // Retrieve the subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method"] // Optional: expand if needed
    });

    // Find user by Stripe Customer ID
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      console.error(`Webhook Error: No user found for Stripe Customer ID: ${customerId}`);
      return; // Or throw an error
    }

    // Calculate grace period end date (3 days from now)
    const gracePeriodDuration = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
    const now = new Date();
    const gracePeriodEnd = new Date(now.getTime() + gracePeriodDuration);

    let updateData = {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      // Reset grace period and mark as paid on active status
      gracePeriodEndsAt: subscription.status === 'active' ? null : user.gracePeriodEndsAt, // Keep existing if not active
      isPaidUser: subscription.status === 'active' || (subscription.status === 'past_due' && user.gracePeriodEndsAt && user.gracePeriodEndsAt > now),
    };

    // Specific handling for different statuses
    if (subscription.status === 'active') {
      updateData.isPaidUser = true;
      updateData.gracePeriodEndsAt = null; // Clear grace period on active
    } else if (subscription.status === 'past_due') {
      // If entering past_due and no grace period set OR grace period expired, set a new one
      if (!user.gracePeriodEndsAt || user.gracePeriodEndsAt <= now) {
        updateData.gracePeriodEndsAt = gracePeriodEnd;
      }
      // User remains paid during grace period
      updateData.isPaidUser = user.gracePeriodEndsAt ? user.gracePeriodEndsAt > now : gracePeriodEnd > now;
    } else if (['canceled', 'unpaid'].includes(subscription.status)) {
      updateData.isPaidUser = false;
      updateData.gracePeriodEndsAt = null; // Clear grace period on cancellation/unpaid
    } else {
       // Handle other statuses like 'incomplete', 'incomplete_expired', 'trialing' if needed
       // For 'trialing', you might set isPaidUser = true
       updateData.isPaidUser = subscription.status === 'trialing'; // Example: Paid during trial
       updateData.gracePeriodEndsAt = null;
    }


    await prisma.user.update({
      where: { stripeCustomerId: customerId },
      data: updateData,
    });

    console.log(`Updated user ${user.id} subscription status to ${subscription.status}`);

  } catch (error) {
    console.error(`Error handling subscription status change for ${subscriptionId}:`, error);
    // Consider alerting or logging this error more formally
  }
};


// Stripe Webhook Handler
// Use `express.raw({ type: 'application/json' })` middleware for this route specifically
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => { // Make async
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.sendStatus(400);
  }

  // Handle the event
  let subscription;
  let customerId;
  let session;

  switch (event.type) {
    case 'checkout.session.completed':
      session = event.data.object;
      // This event fires when the checkout is successful.
      // If it's a subscription, the actual subscription details might come
      // in invoice.payment_succeeded or customer.subscription.created/updated.
      // We can log it, but primary logic relies on subscription/invoice events.
      console.log(`Checkout session ${session.id} completed.`);
      if (session.mode === 'subscription' && session.subscription) {
        // Optionally trigger an early update based on checkout completion
        // await manageSubscriptionStatusChange(session.subscription, session.customer);
        console.log(`Subscription ${session.subscription} initiated by checkout.`);
      }
      break;

    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      // If the payment is for a subscription, update the status
      if (invoice.subscription) {
        subscriptionId = invoice.subscription;
        customerId = invoice.customer;
        console.log(`Invoice payment succeeded for subscription ${subscriptionId}`);
        await manageSubscriptionStatusChange(subscriptionId, customerId);
      }
      break;

    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      // Payment failed for an invoice, potentially for a subscription renewal
      if (failedInvoice.subscription) {
        subscriptionId = failedInvoice.subscription;
        customerId = failedInvoice.customer;
        console.log(`Invoice payment failed for subscription ${subscriptionId}. Initiating grace period.`);
        // manageSubscriptionStatusChange will handle setting the grace period
        await manageSubscriptionStatusChange(subscriptionId, customerId);
      }
      break;

    case 'customer.subscription.updated':
      subscription = event.data.object;
      customerId = subscription.customer;
      console.log(`Subscription ${subscription.id} updated. Status: ${subscription.status}`);
      // Handles status changes like cancellations initiated by user or Stripe
      await manageSubscriptionStatusChange(subscription.id, customerId);
      break;

    case 'customer.subscription.deleted':
      // Subscription ended (e.g., cancelled and period ended)
      subscription = event.data.object;
      customerId = subscription.customer;
      console.log(`Subscription ${subscription.id} deleted.`);
      try {
        await prisma.user.update({
          where: { stripeCustomerId: customerId },
          data: {
            isPaidUser: false,
            subscriptionStatus: 'canceled', // Or 'deleted'
            stripeSubscriptionId: null, // Clear the subscription ID
            gracePeriodEndsAt: null, // Clear grace period
          },
        });
         console.log(`Updated user ${customerId} status after subscription deletion.`);
      } catch (error) {
         console.error(`Error updating user after subscription deletion ${subscription.id}:`, error);
      }
      break;

    // Add other event types if needed (e.g., customer.subscription.created)

    default:
      console.log(`Unhandled webhook event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  // Return a 200 response to acknowledge receipt of the event
  res.sendStatus(200);
});

// Endpoint to create a Stripe Billing Portal session
router.post('/create-portal-session', authenticateUser, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }

  const YOUR_DOMAIN = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    // Find the user to get their Stripe Customer ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true }, // Only select the needed field
    });

    if (!user || !user.stripeCustomerId) {
      console.log(`User ${userId} does not have a Stripe Customer ID. Cannot create portal session.`);
      // Optionally, redirect them to subscribe first or show a message
      return res.status(404).json({ error: 'Stripe customer profile not found for this user.' });
    }

    // Create a Billing Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${YOUR_DOMAIN}/billing`, // URL to return to after portal session
    });

    // Redirect the user to the portal URL
    res.json({ url: portalSession.url });

  } catch (error) {
    console.error(`Error creating Stripe Billing Portal session for user ${userId}:`, error);
    res.status(500).json({ error: 'Failed to create billing portal session.' });
  }
});


module.exports = router;

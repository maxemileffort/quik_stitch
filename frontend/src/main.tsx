// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import App from './App.tsx';
import './index.css';

// Load Stripe outside of the component render to avoid recreating the Stripe object on every render.
// Use your publishable key from the .env file
let stripeKey;

if(import.meta.env.TEST_MODE==='true'){
  stripeKey = import.meta.env.VITE_STRIPE_TEST_PUB_KEY;
}else{
  stripeKey = import.meta.env.VITE_STRIPE_PROD_PUB_KEY;
}
const stripePromise = loadStripe(stripeKey);

if (!stripeKey) {
  console.error("Error: VITE_STRIPE_PUBLISHABLE_KEY is not set in the environment variables.");
  // Optionally render an error message or prevent the app from rendering
}


createRoot(document.getElementById('root')!).render(
  // <StrictMode>
  <Elements stripe={stripePromise}>
    <App />
  </Elements>
  // </StrictMode>
);

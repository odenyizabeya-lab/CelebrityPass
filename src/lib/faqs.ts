export type Faq = { q: string; a: string; topic: string };

/**
 * Single source of truth for CelebrityPass FAQs.
 * Used by the searchable Help Center (/help) and the FAQ page (/faq).
 */
export const FAQS: Faq[] = [
  // Accounts & registration
  { topic: "Account & Registration", q: "How do I create an account?", a: "You can create an account by joining any celebrity community (choose a community and register as a fan), or by signing up directly from the Account Registration page. You'll provide your name, email, and choose a password." },
  { topic: "Account & Registration", q: "How do I log in?", a: "Go to the Fan Login page, enter your email and password, and sign in. A successful login shows your fan dashboard with your cards and communities." },
  { topic: "Account & Registration", q: "How do I change my password?", a: "Sign in, open Account Settings, and use the password section. You'll need to enter your current password to set a new one." },
  { topic: "Account & Registration", q: "I forgot my password. What do I do?", a: "Use the password reset link from the login page. Enter your email and, if an account exists, we'll send a reset link that's valid for one hour." },
  { topic: "Account & Registration", q: "Can one account join more than one community?", a: "Yes. One account can hold many fan cards, one per community, each with its own Fan ID and membership level." },
  { topic: "Account & Registration", q: "How do I delete my account?", a: "Sign in, open Account Settings, and use the delete option at the bottom. Deleting your account removes your account and associated fan cards. You can also submit a deletion request through the User Rights & Data Requests page without signing in." },

  // Fan cards
  { topic: "Fan Cards", q: "What is a fan card?", a: "A fan card is an official digital membership card issued by a celebrity's fan community. Each card is unique to the fan, with a Fan ID, membership level, and a shareable card page with a QR code." },
  { topic: "Fan Cards", q: "Is getting a fan card free?", a: "A membership card is available on a free level in every community. Paid Premium and VIP levels are available too, and their prices are always shown clearly before you confirm a purchase. Payments are made by Bank Transfer (verified manually before your card is issued) or by ATM Card through our third-party card merchant." },
  { topic: "Fan Cards", q: "How do I share my card?", a: "Your unique card link (for example /celebrity/name/fan/FC-000001) is a shareable public verification page. Anyone who scans the QR code can confirm your membership." },

  // Login & security
  { topic: "Login & Security", q: "Why was I asked to sign in again?", a: "For your protection, sessions can expire. To keep your account secure, log in again when prompted." },
  { topic: "Login & Security", q: "What should I do if my account is compromised?", a: "Contact support using the Security category on the Contact & Support page, and change your password as soon as possible." },

  // App
  { topic: "App", q: "How do I install the Android app?", a: "Download the CelebrityPass app for Android from the App Download page. The app uses the same account and shows the same platform on your phone." },
  { topic: "App", q: "Is my account the same on the app and website?", a: "Yes. The app and website share the same CelebrityPass account, so your cards and communities are consistent across both." },

  // Privacy
  { topic: "Privacy", q: "What information does CelebrityPass collect?", a: "We collect the information needed to run the service, such as your name, email, country, fan card details, and order/payment information. See our Privacy Policy for full details." },
  { topic: "Privacy", q: "Does CelebrityPass sell my data?", a: "No. We do not sell your personal data. We share information only as needed to run the service or where required by law." },
  { topic: "Privacy", q: "How do I request my data?", a: "Use the User Rights & Data Requests page to request access, correction, deletion, or export of your information. If you are signed in, you can also delete your account directly from Account Settings." },

  // Events & tickets
  { topic: "Events & Tickets", q: "Where does event information come from?", a: "Event and ticket information is sourced from authorized providers and our team. We aim to keep it accurate, but event details can change." },
  { topic: "Events & Tickets", q: "When is a ticket issued?", a: "A ticket or card is only issued after a payment has genuinely succeeded or been verified. We never generate a ticket from an unconfirmed payment." },

  // Support
  { topic: "Support", q: "How do I contact support?", a: "Use the Contact & Support page to send us a message from the contact form and choose a category. We aim to respond within 2 business days." },
];
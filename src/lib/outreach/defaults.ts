/** Starting copy for the two seeded outreach templates. Editable in Admin → Brand outreach → Templates. */
export const DEFAULT_OUTREACH_TEMPLATES = [
  {
    key: "pitch",
    name: "Initial pitch",
    sort: 0,
    subject: "New customers for {brand}, at full price",
    body: `Assalam-o-alaikum {name},

I'm {sender_name}, founder of Wahbayaan — one place where shoppers in Pakistan and abroad browse many Pakistani brands, check out once, and we handle everything after. We'd love to feature {brand}.

What it means for you:
• More orders at your full price — we buy at your listed retail price, no discounts asked, no commission taken from you.
• Customers you don't reach today — overseas families and gift buyers who find shipping, customs and returns from Pakistan hard.
• No extra work — we handle shipping, customs paperwork, payments, customer service and returns; you fulfil as you would any online order.
• Your brand, shown your way — your name, the photos and descriptions you approve, and a link to your store.
• Sales insight — regular reports on what our customers buy from you.

All we need is your permission to list your catalogue and images on Wahbayaan, credited to {brand}. Could we have a 15-minute call this week?

Warm regards,
{sender_name}
Founder, Wahbayaan · {sender_phone} · {site_url}`,
  },
  {
    key: "follow_up",
    name: "Follow-up",
    sort: 1,
    subject: "Re: New customers for {brand}",
    body: `Assalam-o-alaikum {name},

Just following up on my note about featuring {brand} on Wahbayaan — we buy at your full retail price and handle shipping, payments and returns for customers in Pakistan and abroad.

Would a quick 15-minute call or a WhatsApp chat this week suit you? Happy to work around your schedule.

Warm regards,
{sender_name}
Founder, Wahbayaan · {sender_phone} · {site_url}`,
  },
] as const;

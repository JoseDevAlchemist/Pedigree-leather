import type { SettingKey } from "./settings-schema";

type Field = readonly [SettingKey, string, ("text" | "email" | "url" | "number" | "decimal" | "checkbox" | "textarea" | "image" | "sort")?];
type Section = {
  id: string;
  label: string;
  description: string;
  groups?: { title: string; fields: Field[] }[];
  notes?: string[];
  links?: [string, string][];
  confirm?: boolean;
};

export const settingsSections: Section[] = [
  {
    id: "store", label: "Store information", description: "Manage the identity and contact details customers see.",
    groups: [
      { title: "Identity", fields: [["business_name", "Business name"], ["shop_name", "Store display name"], ["logo", "Business logo", "image"], ["favicon", "Favicon", "image"]] },
      { title: "Contact and location", fields: [["email", "Contact email", "email"], ["support_email", "Customer support email", "email"], ["phone", "Telephone"], ["whatsapp", "WhatsApp number (including country code)"], ["address", "Shop address"], ["google_maps_url", "Google Maps link", "url"], ["operating_hours", "Business hours", "textarea"]] },
      { title: "Social profiles", fields: [["instagram_url", "Instagram", "url"], ["facebook_url", "Facebook", "url"], ["tiktok_url", "TikTok", "url"], ["other_social_url", "Other social profile", "url"]] },
      { title: "Announcement", fields: [["announcement_enabled", "Show announcement", "checkbox"], ["announcement", "Announcement message", "textarea"]] },
    ],
  },
  {
    id: "currency", label: "Currency and pricing", description: "KES is the checkout currency. The website and POS use the shared KES-per-USD rate.",
    groups: [
      { title: "Exchange rate", fields: [["exchange_rate_kes_to_usd", "KES per 1 USD", "decimal"]] },
      { title: "Website price display", fields: [["show_discount_badge", "Show discount badges on product cards", "checkbox"], ["tax_display_note", "Tax information shown at checkout"]] },
    ],
    notes: ["The tax note and discount badges affect website display. Currency rounding and tax calculations follow the existing pricing rules."],
    confirm: true,
  },
  {
    id: "payments", label: "Payments", description: "Review the payment paths available to this deployment.",
    groups: [{ title: "Website payment options", fields: [["stk_enabled", "Offer M-Pesa STK Push", "checkbox"], ["stk_wait_seconds", "STK confirmation wait (15–180 seconds)", "number"], ["manual_payment_instructions", "Additional manual M-Pesa instructions", "textarea"], ["pay_at_pickup", "Allow payment at pickup", "checkbox"], ["pay_on_delivery", "Allow payment on delivery", "checkbox"]] }],
    confirm: true,
    notes: ["Manual M-Pesa instructions use the existing merchant configuration. The wait time controls the customer’s waiting screen. The existing callback still handles provider confirmation.", "POS cash settings and refund authorization require a verified POS or provider integration."],
    links: [["Website orders and payment records", "/admin/orders"]],
  },
  {
    id: "delivery", label: "Delivery and pickup", description: "Manage fulfilment availability, fees and instructions shown at checkout.",
    groups: [
      { title: "Delivery", fields: [["delivery_enabled", "Offer delivery", "checkbox"], ["delivery_flat_rate", "Default delivery fee (KES)", "number"], ["free_delivery_threshold", "Free delivery from (KES)", "number"], ["delivery_estimate", "Estimated delivery time"]] },
      { title: "Store pickup", fields: [["pickup_available", "Offer store pickup", "checkbox"], ["pickup_address", "Pickup address"], ["pickup_hours", "Pickup hours"], ["pickup_instructions", "Pickup instructions", "textarea"]] },
      { title: "Preparation", fields: [["preparation_time", "Estimated preparation time"]] },
    ],
    notes: ["Courier contact and dispatch integration require configuration."],
    links: [["Manage delivery zones and fees", "/admin/settings/zones"]],
    confirm: true,
  },
  {
    id: "inventory", label: "Inventory and POS", description: "Product and stock records are managed in the shared Supabase catalogue.",
    groups: [
      { title: "Storefront stock display", fields: [["hide_unavailable", "Hide sold-out products in website listings", "checkbox"]] },
      { title: "Website admin product list", fields: [["low_stock_threshold", "Low-stock warning threshold (0 to disable)", "number"], ["show_admin_codes", "Show product codes", "checkbox"], ["show_colour_stock", "Show stock by colour", "checkbox"], ["show_size_stock", "Show EU size counts", "checkbox"]] },
    ],
    notes: ["Automated stock alerts, stock adjustment permissions and POS display preferences require POS integration.", "Cross-application sync and inventory activity need a verified POS integration."],
    links: [["Manage products and variants", "/admin/products"]],
  },
  {
    id: "orders", label: "Orders and checkout", description: "Set the information customers receive during checkout.",
    groups: [
      { title: "Checkout information", fields: [["checkout_instructions", "Customer-facing instructions", "textarea"], ["preparation_time", "Estimated preparation time"]] },
    ],
    confirm: true,
    notes: ["Published policies are maintained in the approved legal source files.", "Checkout currently supports guest purchases. Order numbering and confirmations follow the current order workflow. Cart expiration and abandoned-cart notifications require additional integration."],
    links: [["Manage orders", "/admin/orders"], ["View current return and exchange policy", "/legal/returns"], ["View current cancellation terms", "/legal/cancellation"]],
  },
  {
    id: "notifications", label: "Notifications", description: "Manage notifications sent through the existing WhatsApp and receipt integrations.",
    groups: [
      { title: "WhatsApp notifications", fields: [["notify_new_order", "Alert staff about new orders", "checkbox"], ["notification_phones", "Staff recipients (comma-separated +254 numbers)", "textarea"], ["notify_customer_order", "Confirm new orders to customers", "checkbox"], ["notify_customer_status", "Send customer order status updates", "checkbox"], ["notify_customer_cancellation", "Send cancellation notices to customers", "checkbox"]] },
      { title: "Email notifications", fields: [["notify_payment_receipt", "Send payment receipts to customers", "checkbox"]] },
    ],
    confirm: true,
    notes: ["Leave staff recipients blank to use the existing WhatsApp recipient. Failed payment, refund request, stock and security event delivery require additional integration."],
  },
  {
    id: "staff", label: "Staff and permissions", description: "Review website roles and open the existing staff manager.",
    notes: ["Owner and worker are the two website roles. Owners manage products, publication, pricing, staff and settings. Workers can access the dashboard and manage orders. POS manager permissions are enforced separately by POS.", "Custom role permissions and staff session policies require application and authentication support."],
    links: [["Manage staff accounts", "/admin/staff"], ["View settings audit", "/admin/settings?section=audit"]],
  },
  {
    id: "appearance", label: "Website appearance", description: "Edit the catalogue introduction and storefront messages.",
    groups: [
      { title: "Catalogue introduction", fields: [["hero_title", "Homepage heading"], ["hero_description", "Homepage introduction", "textarea"], ["homepage_sort", "Homepage catalogue sorting", "sort"], ["feature_first", "List featured products first", "checkbox"], ["show_discount_badge", "Show discount badges on product cards", "checkbox"]] },
      { title: "Storefront messages", fields: [["announcement_enabled", "Show announcement", "checkbox"], ["announcement", "Announcement message", "textarea"], ["maintenance_message", "Maintenance message", "textarea"]] },
    ],
    notes: ["The maintenance message is informational. Separate homepage sections require storefront support."],
    links: [["Edit footer contact details and social links", "/admin/settings"]],
  },
  {
    id: "seo", label: "SEO and marketing", description: "Set default search and sharing metadata for the storefront.",
    groups: [
      { title: "Search appearance", fields: [["seo_title", "Default website title"], ["seo_description", "Default meta description", "textarea"], ["allow_indexing", "Allow storefront indexing", "checkbox"], ["search_verification", "Google Search Console verification token"]] },
      { title: "Social sharing", fields: [["sharing_title", "Sharing title"], ["sharing_description", "Sharing description", "textarea"], ["social", "Default Open Graph image", "image"]] },
    ],
    links: [["Manage marketing announcement", "/admin/settings?section=appearance"]],
    confirm: true,
  },
  {
    id: "security", label: "Security", description: "Manage account recovery and review administrative changes.",
    notes: ["MFA enrolment and a per-device session list require additional authentication integration."],
    links: [["Change password by email", "/admin/forgot-password"], ["View settings audit", "/admin/settings?section=audit"]],
  },
  {
    id: "system", label: "System health", description: "Inspect this deployment and the settings database.",
    notes: ["Verified backup information and POS heartbeat data require connected monitoring."],
  },
  {
    id: "audit", label: "Audit history", description: "Review the latest changes to storefront settings, the shared exchange rate and delivery zones.",
  },
];

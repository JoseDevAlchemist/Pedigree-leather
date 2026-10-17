import { getShopConfig } from "@/lib/shop-config";
import { ContactWidget } from "@/components/layout/ContactWidget";

/**
 * Server component wrapper that fetches shop config and passes it to the
 * client ContactWidget. This keeps the contact data fetching on the server.
 */
export async function ContactWidgetWrapper() {
  const config = await getShopConfig();

  return (
    <ContactWidget
      whatsappNumber={config.whatsapp}
      whatsappUrl={`https://wa.me/${config.whatsapp}`}
      instagramHandle={config.instagramHandle || "@pedigreeleather"}
      instagramUrl={config.instagramUrl || "https://instagram.com/pedigreeleather"}
      phoneNumber={config.phone.replace(/\D/g, "")}
      phoneDisplay={config.phone}
      email={config.email || "hello@pedigree.co.ke"}
    />
  );
}
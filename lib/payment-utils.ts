/**
 * Payment form validation and formatting utilities.
 */

// Kenyan phone number validation
export function normalizeKenyanPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.startsWith("+254")) return cleaned;
  if (cleaned.startsWith("07") || cleaned.startsWith("01")) {
    return `+254${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith("254")) {
    return `+${cleaned}`;
  }
  return cleaned;
}

export function isValidKenyanPhone(phone: string): boolean {
  const normalized = normalizeKenyanPhone(phone);
  // Safaricom: +2547XX XXXXXXX or +2541XX XXXXXXX (10 digits after +254)
  return /^\+254[17]\d{8}$/.test(normalized);
}

export function formatKenyanPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  // Format as +254 7XX XXX XXX or +254 1XX XXX XXX
  if (cleaned.startsWith("254")) {
    const rest = cleaned.slice(3);
    if (rest.length <= 3) return `+254 ${rest}`;
    if (rest.length <= 6) return `+254 ${rest.slice(0, 3)} ${rest.slice(3)}`;
    return `+254 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }
  return phone;
}

// Card number formatting and validation
export function formatCardNumber(number: string): string {
  const cleaned = number.replace(/\D/g, "");
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(" ") : "";
}

export function luhnCheck(number: string): boolean {
  const cleaned = number.replace(/\D/g, "");
  if (cleaned.length < 13 || cleaned.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

// Expiry formatting and validation
export function formatExpiry(expiry: string): string {
  const cleaned = expiry.replace(/\D/g, "");
  if (cleaned.length <= 2) return cleaned;
  return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
}

export function isValidExpiry(expiry: string): boolean {
  const cleaned = expiry.replace(/\D/g, "");
  if (cleaned.length !== 4) return false;

  const month = parseInt(cleaned.slice(0, 2), 10);
  const year = parseInt(cleaned.slice(2, 4), 10);

  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;

  return true;
}

// CVC validation
export function isValidCVC(cvc: string): boolean {
  return /^\d{3,4}$/.test(cvc);
}

// Format price in KES
export function formatKES(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
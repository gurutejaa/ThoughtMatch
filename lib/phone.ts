export type PhoneParseResult =
  | { valid: true; normalized: string; country_code: string; area_code: string }
  | { valid: false; error: string };

export function parseUSPhone(raw: string): PhoneParseResult {
  let cleaned = raw.replace(/[\s\-().]/g, "");

  const country_code = "+1";

  if (cleaned.startsWith("+1")) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith("1") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: "Enter a valid 10-digit US phone number" };
  }

  return {
    valid: true,
    normalized: cleaned,
    country_code,
    area_code: cleaned.slice(0, 3)
  };
}

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export function validateGSTIN(gstin: string): ValidationResult {
  if (!gstin) return { valid: true, message: "" };
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(gstin)) {
    return { valid: false, message: "Invalid GSTIN format. Expected: 22AAAAA0000A1Z5" };
  }
  return { valid: true, message: "" };
}

export function validatePAN(pan: string): ValidationResult {
  if (!pan) return { valid: true, message: "" };
  const regex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!regex.test(pan)) {
    return { valid: false, message: "Invalid PAN format. Expected: ABCDE1234F" };
  }
  return { valid: true, message: "" };
}

export function validateEmail(email: string): ValidationResult {
  if (!email) return { valid: true, message: "" };
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return { valid: false, message: "Invalid email address" };
  }
  return { valid: true, message: "" };
}

export function validatePhone(phone: string): ValidationResult {
  if (!phone) return { valid: true, message: "" };
  // Strip spaces, dashes, +91 prefix
  const cleaned = phone.replace(/[\s\-+]/g, "").replace(/^91/, "");
  const regex = /^[6-9]\d{9}$/;
  if (!regex.test(cleaned)) {
    return { valid: false, message: "Invalid Indian phone number. Must start with 6-9 and be 10 digits" };
  }
  return { valid: true, message: "" };
}

export function validateAadhar(aadhar: string): ValidationResult {
  if (!aadhar) return { valid: true, message: "" };
  const regex = /^\d{12}$/;
  if (!regex.test(aadhar)) {
    return { valid: false, message: "Aadhar must be exactly 12 digits" };
  }
  return { valid: true, message: "" };
}

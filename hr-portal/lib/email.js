// Shared "can this applicant be emailed" check, used by the Recruitment
// send-mode UI (disabling a checkbox), the confirmation screen (the
// skipped list), and the send route itself (excluding recipients before
// the BCC call goes out). Deliberately narrow per the spec: catches
// blank and obviously malformed addresses (no "@", no domain), not
// whether the address actually exists, see README/spec section 5.4 for
// why that's the line.
export function isSendableEmail(email) {
  const trimmed = (email || '').trim();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return false;
  const domain = trimmed.slice(at + 1);
  return domain.includes('.');
}

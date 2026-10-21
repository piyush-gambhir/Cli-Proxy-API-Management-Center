/**
 * Mask email addresses for screen-shared views.
 *
 * Keeps the first character of the local part and of the domain plus the top-level label, so
 * accounts stay distinguishable without being readable: `piyush.gambhir@spyne.ai` becomes
 * `p•••@s•••.ai` and `alice@dept.example.com` becomes `a•••@d•••.com`. Works on free text
 * (a filename that embeds an address is masked in place) and on non-Latin addresses.
 */
// The domain runs greedily to its last label, so subdomains and registered domains are both
// hidden. In a filename such as `x@spyne.ai-pro.json` that last label is `json`; over-masking a
// filename is the safe side of the trade.
const EMAIL_PATTERN =
  /([\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]*@([\p{L}\p{N}-])[\p{L}\p{N}.-]*\.(\p{L}{2,})(?![\p{L}\p{N}-])/gu;

export function maskEmails(text: string): string {
  return text.replace(
    EMAIL_PATTERN,
    (_match, localFirst: string, domainFirst: string, tld: string) =>
      `${localFirst}•••@${domainFirst}•••.${tld}`
  );
}

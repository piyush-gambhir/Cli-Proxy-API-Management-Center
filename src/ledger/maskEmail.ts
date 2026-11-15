










const EMAIL_PATTERN =
  /([\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]*@([\p{L}\p{N}-])[\p{L}\p{N}.-]*\.(\p{L}{2,})(?![\p{L}\p{N}-])/gu;

export function maskEmails(text: string): string {
  return text.replace(
    EMAIL_PATTERN,
    (_match, localFirst: string, domainFirst: string, tld: string) =>
      `${localFirst}•••@${domainFirst}•••.${tld}`
  );
}

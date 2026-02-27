export const HTTP_ALLOWLIST = [
  'api.github.com',
  'jsonplaceholder.typicode.com',
  'httpbin.org',
] as const;

const dynamicAllowlist = new Set<string>();

export function addAllowedDomain(domain: string): void {
  dynamicAllowlist.add(domain);
}

export function removeAllowedDomain(domain: string): void {
  dynamicAllowlist.delete(domain);
}

export function isAllowedDomain(domain: string): boolean {
  if ((HTTP_ALLOWLIST as readonly string[]).includes(domain)) return true;
  return dynamicAllowlist.has(domain);
}

export function clearDynamicDomains(): void {
  dynamicAllowlist.clear();
}

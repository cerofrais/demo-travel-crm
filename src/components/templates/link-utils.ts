import type { ResourceLink } from "@/lib/demo/types";

/** Shared rules for the link library and the composer's link picker. */

export const LINK_NAME_MAX = 120;
export const LINK_DESCRIPTION_MAX = 500;
export const LINK_URL_MAX = 2000;
export const LINK_FOLDER_MAX = 60;
/** Where links nobody filed end up; sorted after the named folders. */
export const OTHER_FOLDER = "Other";

/**
 * A URL typed by a person into one we are willing to store, or null.
 * The stored link is pasted into WhatsApp messages and rendered as an anchor,
 * so only http(s) gets through — decided by the URL parser, not a regex. A
 * bare "wishtrip.co/offers" gets https:// because that is how people type.
 */
export function normalizeLinkUrl(input: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw || raw.length > LINK_URL_MAX || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname || !parsed.hostname.includes(".")) return null;
  return parsed.toString();
}

export function normalizeFolder(input: string | null | undefined): string {
  const cleaned = (input ?? "").replace(/\s+/g, " ").trim().slice(0, LINK_FOLDER_MAX);
  return cleaned || OTHER_FOLDER;
}

export interface LinkGroup {
  folder: string;
  links: ResourceLink[];
}

/** Links grouped by folder: folders A→Z, "Other" last. */
export function groupLinksByFolder(links: ResourceLink[]): LinkGroup[] {
  const groups = new Map<string, LinkGroup>();
  for (const l of links) {
    const folder = l.folder || OTHER_FOLDER;
    const g = groups.get(folder);
    if (g) g.links.push(l);
    else groups.set(folder, { folder, links: [l] });
  }
  const rank = (f: string) => (f === OTHER_FOLDER ? 1 : 0);
  return [...groups.values()].sort((a, b) => rank(a.folder) - rank(b.folder) || a.folder.localeCompare(b.folder, undefined, { sensitivity: "base" }));
}

/** Free-text search over the fields a person would search by. */
export function matchesLinkQuery(link: ResourceLink, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [link.name, link.description ?? "", link.url, link.folder].join(" ").toLowerCase().includes(q);
}

/** What goes into a message: "name: url" — WhatsApp linkifies the bare URL. */
export function formatLinkForText(link: Pick<ResourceLink, "name" | "url">): string {
  return `${link.name}: ${link.url}`;
}

/** Shorten a URL for a table cell: host + start of path. */
export function shortUrl(url: string, max = 48): string {
  const bare = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare;
}

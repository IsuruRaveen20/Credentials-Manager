import {
  formatCategoryLabel,
  normalizeCategory,
  PRESET_CREDENTIAL_CATEGORIES,
} from "@vaultops/shared";

/** Stable pastel colors for any free-form category label. */
const PALETTE = [
  "#F5A524",
  "#8B7DFF",
  "#5CD6F0",
  "#F26D6D",
  "#22B8E0",
  "#3DDC97",
  "#7AA1FF",
  "#F08BD6",
  "#E8C547",
  "#6EE7B7",
];

export function categoryColor(category: string): string {
  const key = normalizeCategory(category).toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length]!;
}

/** Merge presets with live usage counts for the sidebar. */
export function mergeCategorySidebar(
  used: { category: string; count: number }[],
): { category: string; count: number; preset: boolean }[] {
  const byKey = new Map<string, { category: string; count: number }>();
  for (const row of used) {
    const label = formatCategoryLabel(row.category);
    const key = normalizeCategory(row.category).toLowerCase();
    const prev = byKey.get(key);
    if (prev) prev.count += row.count;
    else byKey.set(key, { category: label, count: row.count });
  }

  const out: { category: string; count: number; preset: boolean }[] = [];
  const seen = new Set<string>();

  for (const preset of PRESET_CREDENTIAL_CATEGORIES) {
    const key = preset.toLowerCase();
    seen.add(key);
    const hit = byKey.get(key);
    out.push({ category: formatCategoryLabel(preset), count: hit?.count ?? 0, preset: true });
  }

  for (const [key, row] of byKey) {
    if (seen.has(key)) continue;
    out.push({ category: row.category, count: row.count, preset: false });
  }

  return out.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.category.localeCompare(b.category);
  });
}

export { formatCategoryLabel, normalizeCategory, PRESET_CREDENTIAL_CATEGORIES };

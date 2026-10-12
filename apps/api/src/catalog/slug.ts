/**
 * URL-friendly name: "The Witcher® 3: Wild Hunt" → "the-witcher-3-wild-hunt".
 * Games get the Steam appid appended so two games with the same name
 * (remakes, re-releases) never clash.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function steamGameSlug(title: string, appId: number): string {
  const name = slugify(title);
  return name ? `${name}-${appId}` : `steam-${appId}`;
}

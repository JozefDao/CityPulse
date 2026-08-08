function isVowel(character: string): boolean {
  return /[aeiouy]/i.test(character);
}

function splitNicknameWords(value: string): string[] {
  const normalized = value.trim();
  if (!normalized) {
    return [];
  }

  const separated = normalized.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (separated.length >= 2) {
    return separated;
  }

  const camelLike = normalized
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);

  if (camelLike.length >= 2) {
    return camelLike;
  }

  return separated.length ? separated : [normalized];
}

function getSingleTokenInitials(token: string): string {
  const first = token[0] ?? "";
  const firstDigit = token.match(/\d/)?.[0] ?? "";
  if (firstDigit) {
    return `${first}${firstDigit}`.toUpperCase();
  }

  const alphaOnly = token.replace(/\d+/g, "");
  if (/^[a-z]+$/.test(alphaOnly)) {
    if (alphaOnly.length >= 10) {
      const tail = alphaOnly.slice(Math.floor(alphaOnly.length * 0.7));
      const consonant = tail.split("").find((char) => !isVowel(char));
      return `${first}${consonant ?? tail[0] ?? alphaOnly[Math.floor(alphaOnly.length / 2)] ?? ""}`.toUpperCase();
    }

    if (alphaOnly.length >= 6) {
      const midpoint = Math.ceil(alphaOnly.length / 2);
      const middleChar = alphaOnly[midpoint] ?? "";
      return `${first}${middleChar}`.toUpperCase();
    }
  }

  return (
    `${first}${token[1] || ""}`.toUpperCase() || first.toUpperCase() || "??"
  );
}

export function getNicknameInitials(nickname?: string | null): string {
  if (!nickname) {
    return "??";
  }

  const trimmed = nickname.trim();
  if (!trimmed) {
    return "??";
  }

  const parts = splitNicknameWords(trimmed);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    return `${first}${second}`.toUpperCase() || "??";
  }

  const token = parts[0] ?? "";
  if (!token) {
    return "??";
  }

  return getSingleTokenInitials(token);
}

export function getManagedAvatarPath(path?: string | null): string | null {
  if (!path) {
    return null;
  }

  const value = path.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("/uploads/avatars/")) {
    return value;
  }

  try {
    const url = new URL(value);
    const [, cloudName, resourceType, deliveryType] = url.pathname.split("/");

    if (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      cloudName &&
      resourceType === "image" &&
      deliveryType === "upload"
    ) {
      return value;
    }
  } catch {
    return null;
  }

  return null;
}

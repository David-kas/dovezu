import type { Prisma } from "@prisma/client";

const CYR_TO_LAT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function transliterateRuToLat(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => CYR_TO_LAT[ch] ?? ch)
    .join("");
}

/** Варианты запроса: кириллица, латиница, типичные бренды (вильямс → william). */
export function productSearchTermVariants(search: string): string[] {
  const trimmed = search.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed]);
  if (/[а-яё]/i.test(trimmed)) {
    const lat = transliterateRuToLat(trimmed);
    if (lat) variants.add(lat);
    if (/^vil/i.test(lat) || trimmed.toLowerCase().includes("вильям")) {
      variants.add("william");
      variants.add("williams");
    }
    if (/^dzh/i.test(lat) || /^дж/i.test(trimmed.toLowerCase())) {
      variants.add("jack");
    }
  }
  return [...variants];
}

function conditionsForTerm(term: string): Prisma.ProductWhereInput[] {
  const orConditions: Prisma.ProductWhereInput[] = [
    { name: { contains: term, mode: "insensitive" } },
    { article: { contains: term, mode: "insensitive" } },
    { sku: { contains: term, mode: "insensitive" } },
    { barcode: { contains: term, mode: "insensitive" } },
  ];
  if (term.length >= 3) {
    orConditions.push({ id: { contains: term, mode: "insensitive" } });
  }
  return orConditions;
}

export function buildProductSearchWhere(search: string): Prisma.ProductWhereInput {
  const variants = productSearchTermVariants(search);
  if (variants.length === 0) return {};

  const orConditions = variants.flatMap((term) => conditionsForTerm(term));
  return { OR: orConditions };
}

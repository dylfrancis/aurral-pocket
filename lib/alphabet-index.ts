import { stripArticle } from "@/lib/strings";

export type LetterIndexEntry = {
  letter: string;
  /** Index of the first item in the sorted list that belongs to this letter. */
  index: number;
};

const COMBINING_MARKS = /[\u0300-\u036f]/g;

export function indexLetterFor(name: string): string {
  const first = stripArticle(name)
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

export function buildLetterIndex(names: string[]): LetterIndexEntry[] {
  const firstIndexByLetter = new Map<string, number>();
  names.forEach((name, index) => {
    const letter = indexLetterFor(name);
    if (!firstIndexByLetter.has(letter)) {
      firstIndexByLetter.set(letter, index);
    }
  });
  return [...firstIndexByLetter.entries()].map(([letter, index]) => ({
    letter,
    index,
  }));
}

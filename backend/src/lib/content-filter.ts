// Lista curta e intencionalmente não-exaustiva de palavras impróprias em
// português — ponto de partida pro filtro de nomes da Comunidade (Fase 4.7).
// Deve ser expandida ou trocada por um serviço de moderação de verdade antes
// de qualquer lançamento com público real.
const BANNED_WORDS = [
  "porra",
  "caralho",
  "merda",
  "puta",
  "buceta",
  "cacete",
  "foda",
  "fdp",
  "arrombado",
  "viado",
];

const DIACRITICS_RANGE = /[̀-ͯ]/g;

export function containsBannedWords(text: string): boolean {
  const normalized = text.toLowerCase().normalize("NFD").replace(DIACRITICS_RANGE, "");
  return BANNED_WORDS.some((word) => normalized.includes(word));
}

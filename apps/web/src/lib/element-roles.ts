export type ElementRole =
  | "personagem"
  | "moeda"
  | "pular"
  | "machuca"
  | "powerup"
  | "inimigo"
  | "destrutivel"
  | "dinamico"
  | "ignorar";

export const ROLE_OPTIONS: { value: ElementRole; label: string; emoji: string }[] = [
  { value: "personagem", label: "Personagem", emoji: "⭐" },
  { value: "moeda", label: "Moeda", emoji: "🪙" },
  { value: "pular", label: "Pular", emoji: "⬆️" },
  { value: "machuca", label: "Machuca", emoji: "💥" },
  { value: "powerup", label: "Powerup", emoji: "🛡️" },
  { value: "inimigo", label: "Inimigo", emoji: "👾" },
  { value: "destrutivel", label: "Bloco Destrutível", emoji: "🧱" },
  { value: "dinamico", label: "Objeto Dinâmico", emoji: "🔀" },
  { value: "ignorar", label: "Ignorar", emoji: "🚫" },
];

// TODO(design): trocar por ilustrações de personagem reais quando existir arte
// de jogo pronta — por ora, emoji como placeholder visual.
export const PRESET_CHARACTERS = [
  { id: "robot", label: "Robô", emoji: "🤖", color: "#DBEAFE" },
  { id: "dino", label: "Dino", emoji: "🦕", color: "#DCFCE7" },
  { id: "astronaut", label: "Astronauta", emoji: "🧑‍🚀", color: "#E0E7FF" },
  { id: "ninja", label: "Ninja", emoji: "🥷", color: "#E5E7EB" },
  { id: "cat", label: "Gato", emoji: "🐱", color: "#FFEDD5" },
  { id: "frog", label: "Sapo", emoji: "🐸", color: "#D1FAE5" },
  { id: "ghost", label: "Fantasma", emoji: "👻", color: "#F3E8FF" },
  { id: "monkey", label: "Macaco", emoji: "🐵", color: "#FEF3C7" },
] as const;

export type PresetCharacter = (typeof PRESET_CHARACTERS)[number];

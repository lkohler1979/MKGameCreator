import type { ElementRole } from "@/lib/element-roles";

export type ColorRoleEntry = { color: string; role: ElementRole };

// Adaptação da tabela "Cores Base" de docs/REQUISITOS.MD pro vocabulário de
// papéis que já existe (element-roles.ts). Preto/Cinza (plataforma/física)
// caem os dois em "pular" (mesmo comportamento de corpo sólido). Branco não
// entrou: nosso pipeline assume papel branco como fundo (buildForegroundMask
// em shape-detection.ts), então um elemento branco nunca seria detectado como
// forma separada — Ciano foi reaproveitado no lugar pro Powerup. Verde/Spawn
// e Amarelo/Objetivo ficaram de fora: o personagem já é auto-detectado pela
// maior forma (não por cor) e não existe conceito de "marcar objetivo" hoje.
export const DEFAULT_COLOR_ROLE_MAP: ColorRoleEntry[] = [
  { color: "#1a1a1a", role: "pular" },
  { color: "#2563eb", role: "moeda" },
  { color: "#ef4444", role: "machuca" },
  { color: "#8b5cf6", role: "dinamico" },
  { color: "#f97316", role: "inimigo" },
  { color: "#92400e", role: "destrutivel" },
  { color: "#6b7280", role: "pular" },
  { color: "#06b6d4", role: "powerup" },
];

const MATCH_THRESHOLD = 90;

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Cor mais próxima (distância euclidiana em RGB) dentro do mapa configurado
 * - só retorna um papel se a distância mínima ficar dentro de um limiar
 * tolerante (cor de marcador/giz de cera varia bastante do tom "puro").
 */
export function matchColorToRole(rgb: [number, number, number], entries: ColorRoleEntry[]): ElementRole | null {
  let bestRole: ElementRole | null = null;
  let bestDistance = Infinity;

  for (const entry of entries) {
    const [er, eg, eb] = hexToRgb(entry.color);
    const distance = Math.sqrt((rgb[0] - er) ** 2 + (rgb[1] - eg) ** 2 + (rgb[2] - eb) ** 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRole = entry.role;
    }
  }

  return bestDistance <= MATCH_THRESHOLD ? bestRole : null;
}

import { PRESET_CHARACTERS } from "@/lib/preset-characters";

export function GameThumbnail({ spriteImageUrl }: { spriteImageUrl: string }) {
  if (spriteImageUrl.startsWith("preset:")) {
    const presetId = spriteImageUrl.slice("preset:".length);
    const preset = PRESET_CHARACTERS.find((item) => item.id === presetId);
    return (
      <div
        className="flex aspect-video w-full items-center justify-center rounded-xl text-4xl"
        style={{ backgroundColor: preset?.color ?? "#EEEEEE" }}
      >
        {preset?.emoji ?? "🎮"}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={spriteImageUrl} alt="" className="aspect-video w-full rounded-xl object-cover" />;
}

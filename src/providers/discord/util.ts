import { EmbedBuilder } from "discord.js";

export function createEmbedMessage(
  content: string,
  isError: boolean = false,
  title?: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(isError ? 0xff0000 : 0x5865f2)
    .setTitle(title || null)
    .setDescription(content)
    .setTimestamp()
    .setFooter({
      text: "Kurocha",
    });
}

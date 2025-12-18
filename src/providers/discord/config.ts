import { z } from "zod";

export const DiscordConfigSchema = z.object({
  apiKey: z.string().min(1, "Discord API key is required"),
  channelId: z.string().min(1, "Discord channel ID is required"),
  guildId: z.string().min(1, "Discord guild ID is required"),
});

export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;

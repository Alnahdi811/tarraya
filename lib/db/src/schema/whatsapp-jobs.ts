import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const whatsappJobs = pgTable("whatsapp_jobs", {
  sid: text("sid").primaryKey(),
  state: text("state").notNull(),
  senderKey: text("sender_key"),
  payload: jsonb("payload").$type<{
    url: string; message: string; language: "ar" | "en"; from: string; to: string;
  }>(),
  reply: text("reply"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("whatsapp_jobs_state_created_idx").on(table.state, table.createdAt)]);

export const insertWhatsappJobSchema = createInsertSchema(whatsappJobs);
export type InsertWhatsappJob = z.infer<typeof insertWhatsappJobSchema>;
export type WhatsappJob = typeof whatsappJobs.$inferSelect;

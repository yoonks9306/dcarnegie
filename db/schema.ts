import { integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const reflections = sqliteTable("reflections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  principleId: integer("principle_id").notNull(),
  situation: text("situation").notNull(),
  action: text("action").notNull(),
  reaction: text("reaction").notNull(),
  next: text("next").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [index("idx_reflections_user_principle_date").on(t.userId,t.principleId,t.createdAt)]);

export const dailyFocus = sqliteTable("daily_focus", {
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  principleId: integer("principle_id").notNull(),
  intention: text("intention").notNull(),
}, (t) => [index("idx_daily_focus_user_day").on(t.userId,t.day)]);

export const coachingCycles = sqliteTable("coaching_cycles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  cycleNumber: integer("cycle_number").notNull(),
  startDay: text("start_day").notNull(),
}, (t) => [uniqueIndex("uidx_coaching_cycles_user_number").on(t.userId, t.cycleNumber)]);

export const cyclePrinciples = sqliteTable("cycle_principles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cycleId: integer("cycle_id").notNull(),
  dayNumber: integer("day_number").notNull(),
  firstPrincipleId: integer("first_principle_id").notNull(),
  secondPrincipleId: integer("second_principle_id").notNull(),
}, (t) => [uniqueIndex("uidx_cycle_principles_cycle_day").on(t.cycleId, t.dayNumber)]);

export const dailyMemos = sqliteTable("daily_memos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  cycleNumber: integer("cycle_number").notNull(),
  dayNumber: integer("day_number").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  uniqueIndex("uidx_daily_memos_user_cycle_day").on(t.userId, t.cycleNumber, t.dayNumber),
  index("idx_daily_memos_user_updated").on(t.userId, t.updatedAt),
]);

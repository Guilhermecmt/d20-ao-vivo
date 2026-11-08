import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  createdAt: integer("created_at").notNull(),
  sequence: integer("sequence").notNull().default(0),
  currentSides: integer("current_sides"),
  currentValue: integer("current_value"),
  currentBy: text("current_by"),
  currentAt: integer("current_at"),
});

export const players = sqliteTable("players", {
  roomCode: text("room_code").notNull(),
  playerId: text("player_id").notNull(),
  name: text("name").notNull(),
  seenAt: integer("seen_at").notNull(),
}, (table) => [primaryKey({ columns: [table.roomCode, table.playerId] })]);

export const rolls = sqliteTable("rolls", {
  roomCode: text("room_code").notNull(),
  sequence: integer("sequence").notNull(),
  sides: integer("sides").notNull(),
  value: integer("value").notNull(),
  by: text("by").notNull(),
  at: integer("at").notNull(),
}, (table) => [primaryKey({ columns: [table.roomCode, table.sequence] })]);

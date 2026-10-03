import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const applicationState = sqliteTable('application_state', { id: text('id').primaryKey(), version: integer('version').notNull().default(0), payload: text('payload').notNull() });

CREATE TABLE `coaching_cycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`cycle_number` integer NOT NULL,
	`start_day` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_coaching_cycles_user_number` ON `coaching_cycles` (`user_id`,`cycle_number`);--> statement-breakpoint
CREATE TABLE `cycle_principles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cycle_id` integer NOT NULL,
	`day_number` integer NOT NULL,
	`first_principle_id` integer NOT NULL,
	`second_principle_id` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_cycle_principles_cycle_day` ON `cycle_principles` (`cycle_id`,`day_number`);--> statement-breakpoint
CREATE TABLE `daily_memos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`cycle_number` integer NOT NULL,
	`day_number` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_daily_memos_user_cycle_day` ON `daily_memos` (`user_id`,`cycle_number`,`day_number`);--> statement-breakpoint
CREATE INDEX `idx_daily_memos_user_updated` ON `daily_memos` (`user_id`,`updated_at`);
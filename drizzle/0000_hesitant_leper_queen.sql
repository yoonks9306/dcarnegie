CREATE TABLE `daily_focus` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`principle_id` integer NOT NULL,
	`intention` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_daily_focus_user_day` ON `daily_focus` (`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`principle_id` integer NOT NULL,
	`situation` text NOT NULL,
	`action` text NOT NULL,
	`reaction` text NOT NULL,
	`next` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reflections_user_principle_date` ON `reflections` (`user_id`,`principle_id`,`created_at`);
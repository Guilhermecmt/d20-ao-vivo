CREATE TABLE `players` (
	`room_code` text NOT NULL,
	`player_id` text NOT NULL,
	`name` text NOT NULL,
	`seen_at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `player_id`)
);
--> statement-breakpoint
CREATE TABLE `rolls` (
	`room_code` text NOT NULL,
	`sequence` integer NOT NULL,
	`sides` integer NOT NULL,
	`value` integer NOT NULL,
	`by` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `sequence`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`current_sides` integer,
	`current_value` integer,
	`current_by` text,
	`current_at` integer
);

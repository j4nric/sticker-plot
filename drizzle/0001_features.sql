CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_name` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mime` text NOT NULL,
	`data` blob NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`source` blob,
	`result` text DEFAULT '' NOT NULL,
	`preview_image_id` integer,
	`tea_id` integer,
	`user_name` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`preview_image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tea_id`) REFERENCES `teas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sheet_formats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`page_width` real NOT NULL,
	`page_height` real NOT NULL,
	`columns` integer NOT NULL,
	`rows` integer NOT NULL,
	`label_width` real NOT NULL,
	`label_height` real NOT NULL,
	`origin_x` real NOT NULL,
	`origin_y` real NOT NULL,
	`pitch_x` real NOT NULL,
	`pitch_y` real NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`params` text DEFAULT '{}' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
ALTER TABLE `print_jobs` ADD `user_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `printers` ADD `next_slot` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `motif` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `image_id` integer REFERENCES images(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `template_id` integer REFERENCES templates(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `brew_amount` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `brew_temp` integer;--> statement-breakpoint
ALTER TABLE `teas` ADD `brew_time` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `organic` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `ean` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `product_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `price` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `shelf_life_months` integer;--> statement-breakpoint
ALTER TABLE `teas` ADD `archived_at` integer;
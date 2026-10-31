ALTER TABLE `teas` ADD `title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `kind` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `teas` ADD `flavored` integer DEFAULT false NOT NULL;
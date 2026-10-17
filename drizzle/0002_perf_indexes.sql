CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `import_items_status_idx` ON `import_items` (`status`);--> statement-breakpoint
CREATE INDEX `print_jobs_tea_created_idx` ON `print_jobs` (`tea_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `teas_name_lower_idx` ON `teas` (lower("name"));--> statement-breakpoint
CREATE INDEX `teas_archived_idx` ON `teas` (`archived_at`);
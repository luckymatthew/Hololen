CREATE TABLE `sim_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host_token_hash` text NOT NULL,
	`guest_token_hash` text,
	`state_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sim_rooms_expires_idx` ON `sim_rooms` (`expires_at`);
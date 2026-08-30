CREATE TABLE `checkin_badge_achievements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`badge_id` integer NOT NULL,
	`participant_id` integer NOT NULL,
	`achieved_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`badge_id`) REFERENCES `checkin_badges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `checkin_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `checkin_badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`type` text DEFAULT 'streak' NOT NULL,
	`target_days` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `checkin_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `checkin_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`group_id` integer,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`signup_deadline` text,
	`required_text` text,
	`reward_rules` text,
	`allow_makeup` integer DEFAULT false NOT NULL,
	`makeup_window_days` integer DEFAULT 3 NOT NULL,
	`makeup_limit_per_user` integer DEFAULT 3 NOT NULL,
	`makeup_requires_review` integer DEFAULT true NOT NULL,
	`makeup_counts_for_streak` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `wechat_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `checkin_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer,
	`title` text NOT NULL,
	`description` text,
	`file_url` text,
	`file_type` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `checkin_events`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `checkin_participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`member_id` integer,
	`wx_user_id` integer,
	`nickname` text NOT NULL,
	`child_name` text,
	`joined_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`reward_status` text DEFAULT 'none' NOT NULL,
	`reward_distributed_at` text,
	`reward_note` text,
	FOREIGN KEY (`event_id`) REFERENCES `checkin_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `wechat_group_members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`wx_user_id`) REFERENCES `wx_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `checkin_record_likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` integer NOT NULL,
	`wx_user_id` integer NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `checkin_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wx_user_id`) REFERENCES `wx_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `checkin_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`participant_id` integer NOT NULL,
	`checkin_date` text NOT NULL,
	`note` text,
	`image_url` text,
	`image_hash` text,
	`media_type` text DEFAULT 'image' NOT NULL,
	`is_makeup` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`reviewed_by` integer,
	`reviewed_at` text,
	`review_note` text,
	`display_name` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `checkin_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `checkin_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `checkin_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wx_user_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`remind_time` text DEFAULT '20:00' NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`last_sent_date` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`wx_user_id`) REFERENCES `wx_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `checkin_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `child_learning_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`child_id` integer NOT NULL,
	`path_id` integer NOT NULL,
	`current_stage_id` integer,
	`status` text DEFAULT 'not_started' NOT NULL,
	`start_date` text,
	`completed_date` text,
	`notes` text,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`path_id`) REFERENCES `learning_paths`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`current_stage_id`) REFERENCES `learning_stages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `children` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wx_user_id` integer NOT NULL,
	`nickname` text NOT NULL,
	`gender` text,
	`birth_date` text,
	`grade` text NOT NULL,
	`grade_as_of` text,
	`region` text,
	`textbook_version` text,
	`weak_subjects` text DEFAULT '[]',
	`notes` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`wx_user_id`) REFERENCES `wx_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wx_user_id` integer NOT NULL,
	`date` text DEFAULT '(date(''now''))' NOT NULL,
	`method` text NOT NULL,
	`content` text NOT NULL,
	`result` text,
	`next_follow_date` text,
	`is_live_note` integer DEFAULT false NOT NULL,
	`child_id` integer,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`wx_user_id`) REFERENCES `wx_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `learning_paths` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_stages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path_id` integer NOT NULL,
	`order_index` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`duration_days` integer,
	`target_product_ids` text DEFAULT '[]',
	`key_milestones` text,
	`notes` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`path_id`) REFERENCES `learning_paths`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`mime_type` text,
	`category` text DEFAULT 'sales' NOT NULL,
	`tags` text DEFAULT '[]',
	`description` text,
	`product_id` integer,
	`uploaded_by` integer,
	`download_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_no` text NOT NULL,
	`wx_user_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`order_type` text DEFAULT 'first' NOT NULL,
	`child_id` integer,
	`remark` text,
	`shipping_note` text,
	`purchase_date` text DEFAULT '(date(''now''))' NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`wx_user_id`) REFERENCES `wx_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);--> statement-breakpoint
CREATE TABLE `points_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wx_user_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`ref_type` text DEFAULT 'none' NOT NULL,
	`ref_id` integer,
	`note` text,
	`operator_id` integer,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`wx_user_id`) REFERENCES `wx_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`tier` text DEFAULT 'main' NOT NULL,
	`category` text,
	`price` real DEFAULT 0 NOT NULL,
	`commission_percent` real DEFAULT 0 NOT NULL,
	`image_url` text,
	`selling_points` text,
	`related_product_ids` text DEFAULT '[]',
	`is_on_sale` integer DEFAULT true NOT NULL,
	`sales_count` integer DEFAULT 0 NOT NULL,
	`description` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `textbooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`region` text NOT NULL,
	`subject` text NOT NULL,
	`grade` text NOT NULL,
	`version` text NOT NULL,
	`publisher` text,
	`is_default` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'assistant' NOT NULL,
	`display_name` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `wechat_group_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`wechat_name` text NOT NULL,
	`nickname` text,
	`role` text DEFAULT 'active' NOT NULL,
	`tags` text DEFAULT '[]',
	`wx_user_id` integer,
	`activity_score` integer DEFAULT 50 NOT NULL,
	`remark` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `wechat_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wx_user_id`) REFERENCES `wx_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `wechat_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`purpose` text,
	`description` text,
	`member_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`tags` text DEFAULT '[]',
	`group_rules` text,
	`owner_note` text,
	`notes` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wx_subscribe_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wx_user_id` integer NOT NULL,
	`template_id` text NOT NULL,
	`scene` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_msg` text,
	`sent_at` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	FOREIGN KEY (`wx_user_id`) REFERENCES `wx_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wx_subscribe_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` text NOT NULL,
	`scene` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wx_subscribe_templates_template_id_unique` ON `wx_subscribe_templates` (`template_id`);--> statement-breakpoint
CREATE TABLE `wx_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openid` text NOT NULL,
	`nickname` text,
	`avatar_url` text,
	`child_name` text,
	`last_login_at` text,
	`points` integer DEFAULT 0 NOT NULL,
	`name` text,
	`phone` text,
	`douyin_nickname` text,
	`source` text,
	`importance` text DEFAULT 'normal' NOT NULL,
	`tags` text DEFAULT '[]',
	`remark` text,
	`total_spent` real DEFAULT 0 NOT NULL,
	`order_count` integer DEFAULT 0 NOT NULL,
	`last_order_date` text,
	`last_follow_date` text,
	`wechat_id` text,
	`wechat_remark` text,
	`wechat_add_date` text,
	`wechat_account` text DEFAULT 'main',
	`stage` text DEFAULT 'new_friend' NOT NULL,
	`next_talk_topic` text,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wx_users_openid_unique` ON `wx_users` (`openid`);
CREATE TABLE "clicks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url_id" varchar NOT NULL,
	"country" varchar(2),
	"device" varchar(16),
	"browser" varchar(32),
	"os" varchar(32),
	"referrer_host" varchar(255),
	"clicked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"provider" varchar(20) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_accounts_provider_provider_user_id_pk" PRIMARY KEY("provider","provider_user_id")
);
--> statement-breakpoint
CREATE TABLE "qr_settings" (
	"url_id" varchar PRIMARY KEY NOT NULL,
	"size" integer DEFAULT 512 NOT NULL,
	"dark_color" varchar(7) DEFAULT '#000000' NOT NULL,
	"light_color" varchar(7) DEFAULT '#ffffff' NOT NULL,
	"error_correction" varchar(1) DEFAULT 'M' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shortened_urls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"original_url" text NOT NULL,
	"short_code" varchar(32) NOT NULL,
	"is_custom_alias" boolean DEFAULT false NOT NULL,
	"title" varchar(200),
	"password_hash" varchar,
	"expires_at" timestamp,
	"max_clicks" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"profile_image_url" varchar(2048),
	"password_hash" varchar,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_url_id_shortened_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."shortened_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_settings" ADD CONSTRAINT "qr_settings_url_id_shortened_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."shortened_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortened_urls" ADD CONSTRAINT "shortened_urls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_clicks_url_time" ON "clicks" USING btree ("url_id","clicked_at");--> statement-breakpoint
CREATE INDEX "idx_oauth_user" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_urls_short_code" ON "shortened_urls" USING btree (lower("short_code"));--> statement-breakpoint
CREATE INDEX "idx_urls_user_created" ON "shortened_urls" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree (lower("email"));
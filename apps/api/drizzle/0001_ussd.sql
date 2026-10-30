CREATE TABLE "ussd_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"text_hash" varchar(64) NOT NULL,
	"text" text NOT NULL,
	"response" text NOT NULL,
	"is_end" boolean DEFAULT false NOT NULL,
	"scene" varchar(40),
	"actor_kind" varchar(10),
	"actor_id" integer,
	"ip_address" varchar(45),
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ussd_security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"phone" varchar(20),
	"session_id" varchar(128),
	"detail" text,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ussd_sessions" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"actor_kind" varchar(10),
	"actor_id" integer,
	"state" jsonb NOT NULL,
	"last_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "pin_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "pin_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "pin_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "transaction_pin_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pin_locked_until" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "ussd_requests_session_text_uq" ON "ussd_requests" USING btree ("session_id","text_hash");--> statement-breakpoint
CREATE INDEX "ussd_requests_created_idx" ON "ussd_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ussd_requests_phone_idx" ON "ussd_requests" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "ussd_security_events_type_idx" ON "ussd_security_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "ussd_sessions_phone_idx" ON "ussd_sessions" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "ussd_sessions_expires_idx" ON "ussd_sessions" USING btree ("expires_at");
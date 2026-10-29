CREATE TYPE "public"."admin_action_type" AS ENUM('add_balance', 'approve_user', 'disapprove_user', 'activate_user', 'deactivate_user', 'delete_user', 'reject_user', 'create_user', 'mark_reviewed');--> statement-breakpoint
CREATE TYPE "public"."fraud_prediction" AS ENUM('FRAUD', 'LEGIT', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('SUCCESS', 'ABORTED', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('transfer', 'withdrawal', 'deposit', 'bonus', 'refund', 'adjustment');--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"admin_name" varchar(100) NOT NULL,
	"action_type" "admin_action_type" NOT NULL,
	"user_id" integer,
	"user_name" varchar(100),
	"amount" numeric(15, 2),
	"reason" text,
	"details" text,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username"),
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "failed_login_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(100) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_id" integer,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failed_withdrawal_attempts" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_time" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"email" varchar(100) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"lockout_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_key" varchar(50) NOT NULL,
	"question_text" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "security_questions_question_key_unique" UNIQUE("question_key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" varchar(50) NOT NULL,
	"sender_id" integer,
	"receiver_id" integer,
	"sender_name" varchar(100),
	"receiver_name" varchar(100),
	"amount" numeric(15, 2) NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"status" "transaction_status" NOT NULL,
	"message" text,
	"fraud_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"fraud_prediction" "fraud_prediction",
	"risk_level" "risk_level",
	"prediction_time" timestamp with time zone,
	"model_version" varchar(20),
	"feature_data" jsonb,
	"transaction_location" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"admin_id" integer,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"email" varchar(100) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"card_number" varchar(20) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"security_answers" jsonb,
	"is_approved" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"reset_token" varchar(64),
	"reset_token_expiry" timestamp with time zone,
	"last_known_location" varchar(100),
	"location_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_card_number_unique" UNIQUE("card_number"),
	CONSTRAINT "users_balance_non_negative" CHECK ("users"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failed_withdrawal_attempts" ADD CONSTRAINT "failed_withdrawal_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "failed_login_log_email_idx" ON "failed_login_log" USING btree ("email");--> statement-breakpoint
CREATE INDEX "login_attempts_email_ip_idx" ON "login_attempts" USING btree ("email","ip_address");--> statement-breakpoint
CREATE INDEX "login_attempts_lockout_idx" ON "login_attempts" USING btree ("lockout_until");--> statement-breakpoint
CREATE INDEX "sessions_expire_idx" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "transactions_sender_created_idx" ON "transactions" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_receiver_created_idx" ON "transactions" USING btree ("receiver_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_fraud_idx" ON "transactions" USING btree ("fraud_prediction","fraud_score");--> statement-breakpoint
CREATE INDEX "transactions_risk_idx" ON "transactions" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "transactions_created_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_reset_token_idx" ON "users" USING btree ("reset_token");
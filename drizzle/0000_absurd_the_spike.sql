CREATE TYPE "public"."author_kind" AS ENUM('sppg', 'moderator', 'reporter');--> statement-breakpoint
CREATE TYPE "public"."episode_rule" AS ENUM('auto_multi_school', 'teacher_group_reviewed');--> statement-breakpoint
CREATE TYPE "public"."forwarding" AS ENUM('none', 'simulated_puskesmas', 'forwarded_by_officer');--> statement-breakpoint
CREATE TYPE "public"."leftover" AS ENUM('none', 'little', 'lots');--> statement-breakpoint
CREATE TYPE "public"."location_check" AS ENUM('inside', 'outside', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."problem" AS ENUM('stale', 'foreign_object', 'small_portion', 'late', 'none');--> statement-breakpoint
CREATE TYPE "public"."report_kind" AS ENUM('experience', 'health');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('received', 'reviewed', 'responded', 'closed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."reporter_role" AS ENUM('teacher', 'student', 'parent');--> statement-breakpoint
CREATE TYPE "public"."subject" AS ENUM('self', 'group');--> statement-breakpoint
CREATE TYPE "public"."symptom" AS ENUM('nausea', 'diarrhea', 'dizzy', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('moderator', 'sppg_manager');--> statement-breakpoint
CREATE TABLE "episode" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "episode_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sppg_id" integer NOT NULL,
	"first_detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rule" "episode_rule" NOT NULL,
	"forwarding" "forwarding" DEFAULT 'none' NOT NULL,
	"forwarding_note" text,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "menu" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menu_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sppg_id" integer NOT NULL,
	"served_on" date NOT NULL,
	"name" text NOT NULL,
	"composition" text NOT NULL,
	"photo_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_sppgId_servedOn_unique" UNIQUE("sppg_id","served_on")
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "report_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"school_id" integer NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"reporter_role" "reporter_role" NOT NULL,
	"kind" "report_kind" NOT NULL,
	"consumed_on" date NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rating" integer,
	"leftover" "leftover",
	"problems" "problem"[] DEFAULT '{}' NOT NULL,
	"symptoms" "symptom"[] DEFAULT '{}' NOT NULL,
	"subject" "subject",
	"affected_count" integer,
	"note" varchar(300),
	"location_check" "location_check" NOT NULL,
	"status" "report_status" DEFAULT 'received' NOT NULL,
	"reject_reason" text,
	"duplicate_of" integer,
	"token_hash" text NOT NULL,
	"device_hash" text NOT NULL,
	"ip_hash" text NOT NULL,
	CONSTRAINT "report_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "report_rating_range" CHECK ("report"."rating" IS NULL OR "report"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "response" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "response_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"report_id" integer,
	"episode_id" integer,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"author_kind" "author_kind" NOT NULL,
	"author_user_id" integer,
	CONSTRAINT "response_one_target" CHECK (num_nonnulls("response"."report_id", "response"."episode_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "school" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "school_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"code" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"sppg_id" integer NOT NULL,
	CONSTRAINT "school_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sppg" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sppg_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"district" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"sppg_id" integer,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_manager_has_sppg" CHECK ("user"."role" <> 'sppg_manager' OR "user"."sppg_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "episode" ADD CONSTRAINT "episode_sppg_id_sppg_id_fk" FOREIGN KEY ("sppg_id") REFERENCES "public"."sppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu" ADD CONSTRAINT "menu_sppg_id_sppg_id_fk" FOREIGN KEY ("sppg_id") REFERENCES "public"."sppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_duplicate_of_report_id_fk" FOREIGN KEY ("duplicate_of") REFERENCES "public"."report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response" ADD CONSTRAINT "response_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response" ADD CONSTRAINT "response_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response" ADD CONSTRAINT "response_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school" ADD CONSTRAINT "school_sppg_id_sppg_id_fk" FOREIGN KEY ("sppg_id") REFERENCES "public"."sppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_sppg_id_sppg_id_fk" FOREIGN KEY ("sppg_id") REFERENCES "public"."sppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episode_sppg_id_index" ON "episode" USING btree ("sppg_id") WHERE "episode"."closed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "report_school_id_received_at_index" ON "report" USING btree ("school_id","received_at");--> statement-breakpoint
CREATE INDEX "report_status_index" ON "report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "school_sppg_id_index" ON "school" USING btree ("sppg_id");
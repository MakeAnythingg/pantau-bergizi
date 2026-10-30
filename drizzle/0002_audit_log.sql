CREATE TYPE "public"."audit_action" AS ENUM('demo.reset');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" integer,
	"action" "audit_action" NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE INDEX "audit_log_at_index" ON "audit_log" USING btree ("at");
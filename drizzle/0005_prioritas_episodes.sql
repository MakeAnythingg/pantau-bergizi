ALTER TYPE "public"."audit_action" ADD VALUE 'episode.closed';--> statement-breakpoint
DROP INDEX "episode_sppg_id_index";--> statement-breakpoint
ALTER TABLE "episode" ADD COLUMN "closed_note" text;--> statement-breakpoint
ALTER TABLE "episode" ADD COLUMN "closed_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "report" ADD COLUMN "episode_id" integer;--> statement-breakpoint
ALTER TABLE "episode" ADD CONSTRAINT "episode_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "episode_one_open_per_sppg" ON "episode" USING btree ("sppg_id") WHERE "episode"."closed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "episode_sppg_id_closed_at_index" ON "episode" USING btree ("sppg_id","closed_at");--> statement-breakpoint
CREATE INDEX "report_episode_id_index" ON "report" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "response_episode_id_index" ON "response" USING btree ("episode_id");
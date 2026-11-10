ALTER TYPE "public"."audit_action" ADD VALUE 'report.status_changed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'report.merged';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'response.created';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'menu.updated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'episode.forwarding_changed';--> statement-breakpoint
CREATE INDEX "report_review_queue_idx" ON "report" USING btree ("received_at") WHERE "report"."status" = 'received';--> statement-breakpoint
CREATE INDEX "report_ip_hash_received_at_index" ON "report" USING btree ("ip_hash","received_at");--> statement-breakpoint
CREATE INDEX "response_report_id_created_at_index" ON "response" USING btree ("report_id","created_at");
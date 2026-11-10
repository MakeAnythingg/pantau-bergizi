DROP INDEX "report_review_queue_idx";--> statement-breakpoint
CREATE INDEX "report_review_queue_priority_idx" ON "report" USING btree ((case when "kind" = 'health' and "reporter_role" = 'teacher' and "subject" = 'group'
    and "affected_count" >= 5
    then 0 when "kind" = 'health' then 1 else 2 end),"received_at","id") WHERE "report"."status" = 'received' and "report"."duplicate_of" is null
    and ("report"."kind" = 'health' or "report"."problems" && array['stale', 'foreign_object']::problem[] or "report"."note" is not null);--> statement-breakpoint
CREATE INDEX "report_school_id_kind_consumed_on_index" ON "report" USING btree ("school_id","kind","consumed_on");--> statement-breakpoint
CREATE INDEX "report_duplicate_of_index" ON "report" USING btree ("duplicate_of") WHERE "report"."duplicate_of" is not null;--> statement-breakpoint
CREATE INDEX "sppg_district_index" ON "sppg" USING btree ("district");
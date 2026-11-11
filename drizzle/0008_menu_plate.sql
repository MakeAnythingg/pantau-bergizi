ALTER TABLE "menu" ADD COLUMN "staple" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu" ADD COLUMN "protein" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu" ADD COLUMN "vegetable" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu" ADD COLUMN "fruit" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu" ADD COLUMN "milk" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu" DROP COLUMN "composition";
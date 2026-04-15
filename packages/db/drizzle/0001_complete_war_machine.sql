CREATE TABLE "group_issue_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "group_issue_jobs_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "last_event_id" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "issues_project_app_fingerprint_idx" ON "issues" USING btree ("project_id","app_id","fingerprint");
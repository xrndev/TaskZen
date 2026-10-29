CREATE TABLE "plan_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"owner" text NOT NULL,
	"plan" text,
	"ends_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_metrics" (
	"day" date NOT NULL,
	"event" text NOT NULL,
	"kind" text NOT NULL,
	"n" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "plan_metrics_day_event_kind_pk" PRIMARY KEY("day","event","kind")
);

CREATE TABLE "notification_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text DEFAULT 'webpush' NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_ok_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "notification_endpoints_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"due_soon" boolean DEFAULT true NOT NULL,
	"assigned" boolean DEFAULT true NOT NULL,
	"offsets_minutes" integer[] DEFAULT '{1440,60}'::integer[] NOT NULL,
	"quiet_start" text,
	"quiet_end" text,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"task_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"offset_minutes" integer NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_log_task_id_user_id_offset_minutes_due_at_pk" PRIMARY KEY("task_id","user_id","offset_minutes","due_at")
);
--> statement-breakpoint
ALTER TABLE "notification_endpoints" ADD CONSTRAINT "notification_endpoints_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_endpoints_user_idx" ON "notification_endpoints" USING btree ("user_id");
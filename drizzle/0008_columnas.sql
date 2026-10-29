CREATE TABLE "board_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text,
	"kind" "task_status" NOT NULL,
	"color" text,
	"position" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "column_id" uuid;--> statement-breakpoint
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_columns_team_idx" ON "board_columns" USING btree ("team_id","position");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_column_id_board_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."board_columns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Las tres columnas de serie de cada equipo existente (nombre nulo = nombre traducido) y cada tarea en la de su estado.
INSERT INTO "board_columns" ("team_id", "name", "kind", "position")
SELECT t."id", NULL, k."kind"::"task_status", k."position"
FROM "teams" t
CROSS JOIN (VALUES ('pending', 1000), ('in_progress', 2000), ('completed', 3000)) AS k("kind", "position");--> statement-breakpoint
UPDATE "tasks" SET "column_id" = c."id"
FROM "board_columns" c
WHERE c."team_id" = "tasks"."team_id" AND c."kind" = "tasks"."status";

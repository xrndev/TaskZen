ALTER TABLE "notification_endpoints" ALTER COLUMN "p256dh" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_endpoints" ALTER COLUMN "auth" DROP NOT NULL;
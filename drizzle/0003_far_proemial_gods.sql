ALTER TABLE "departments" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "banner_cld_pub_id" text;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "head_teacher_id" text;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_teacher_id_user_id_fk" FOREIGN KEY ("head_teacher_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
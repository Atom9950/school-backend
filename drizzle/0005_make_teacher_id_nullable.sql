ALTER TABLE "classes" DROP CONSTRAINT "classes_teacher_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "classes" ALTER COLUMN "teacher_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_invite_token_unique" UNIQUE("invite_token");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_reset_token_unique" UNIQUE("reset_token");
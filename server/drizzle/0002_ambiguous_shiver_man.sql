CREATE INDEX "document_collaborators_user_id_idx" ON "document_collaborators" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_permissions_document_user_idx" ON "document_permissions" USING btree ("document_id","user_id");--> statement-breakpoint
CREATE INDEX "document_permissions_user_id_idx" ON "document_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_owner_id_idx" ON "documents" USING btree ("owner_id");
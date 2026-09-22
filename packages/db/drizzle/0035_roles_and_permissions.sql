CREATE TABLE IF NOT EXISTS "role" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permission" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_member_status" CHECK ("store_member"."status" in ('active','invited'))
);
--> statement-breakpoint
ALTER TABLE "role" DROP CONSTRAINT IF EXISTS "role_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" DROP CONSTRAINT IF EXISTS "role_permission_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" DROP CONSTRAINT IF EXISTS "role_permission_role_id_role_id_fk";--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_member" DROP CONSTRAINT IF EXISTS "store_member_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "store_member" ADD CONSTRAINT "store_member_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_member" DROP CONSTRAINT IF EXISTS "store_member_role_id_role_id_fk";--> statement-breakpoint
ALTER TABLE "store_member" ADD CONSTRAINT "store_member_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_store_slug" ON "role" USING btree ("store_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_permission_role_permission" ON "role_permission" USING btree ("role_id","permission");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "store_member_store_user" ON "store_member" USING btree ("store_id","user_id");--> statement-breakpoint

-- Seed the three system roles for every existing store, then map the Better Auth
-- organization members onto them: the org owner keeps full access, everyone else
-- starts as an administrator. New stores get the same rows from the core service.
DO $$
DECLARE
  s RECORD;
  m RECORD;
  owner_id uuid;
  admin_id uuid;
  staff_id uuid;
  target_id uuid;
  owner_perms text[] := ARRAY[
    'orders.read','orders.write','orders.refund','orders.cancel','orders.fulfil',
    'drafts.read','drafts.write',
    'products.read','products.write','products.delete','products.import',
    'inventory.read','inventory.write',
    'customers.read','customers.write','customers.delete',
    'discounts.read','discounts.write',
    'content.read','content.write',
    'analytics.read',
    'online_store.read','online_store.write','online_store.publish',
    'apps.manage',
    'settings.read','settings.manage',
    'staff.read','staff.invite','staff.manage',
    'billing.manage'
  ];
  admin_perms text[];
  staff_perms text[] := ARRAY[
    'orders.read','orders.write','orders.fulfil',
    'drafts.read','drafts.write',
    'products.read',
    'inventory.read','inventory.write',
    'customers.read',
    'analytics.read'
  ];
  p text;
BEGIN
  SELECT array_agg(x) INTO admin_perms
  FROM unnest(owner_perms) AS x
  WHERE x NOT IN ('billing.manage', 'staff.manage');

  FOR s IN SELECT id, organization_id FROM "store" LOOP
    INSERT INTO "role" (id, store_id, name, slug, description, is_system)
    VALUES (gen_random_uuid(), s.id, 'Owner', 'owner', 'Full access, including billing and staff.', true)
    ON CONFLICT (store_id, slug) DO NOTHING;
    INSERT INTO "role" (id, store_id, name, slug, description, is_system)
    VALUES (gen_random_uuid(), s.id, 'Administrator', 'admin', 'Runs the store day to day. Cannot change billing or manage staff roles.', true)
    ON CONFLICT (store_id, slug) DO NOTHING;
    INSERT INTO "role" (id, store_id, name, slug, description, is_system)
    VALUES (gen_random_uuid(), s.id, 'Staff', 'staff', 'Works orders and stock. Read-only elsewhere.', true)
    ON CONFLICT (store_id, slug) DO NOTHING;

    SELECT id INTO owner_id FROM "role" WHERE store_id = s.id AND slug = 'owner';
    SELECT id INTO admin_id FROM "role" WHERE store_id = s.id AND slug = 'admin';
    SELECT id INTO staff_id FROM "role" WHERE store_id = s.id AND slug = 'staff';

    FOREACH p IN ARRAY owner_perms LOOP
      INSERT INTO "role_permission" (id, store_id, role_id, permission)
      VALUES (gen_random_uuid(), s.id, owner_id, p)
      ON CONFLICT (role_id, permission) DO NOTHING;
    END LOOP;
    FOREACH p IN ARRAY admin_perms LOOP
      INSERT INTO "role_permission" (id, store_id, role_id, permission)
      VALUES (gen_random_uuid(), s.id, admin_id, p)
      ON CONFLICT (role_id, permission) DO NOTHING;
    END LOOP;
    FOREACH p IN ARRAY staff_perms LOOP
      INSERT INTO "role_permission" (id, store_id, role_id, permission)
      VALUES (gen_random_uuid(), s.id, staff_id, p)
      ON CONFLICT (role_id, permission) DO NOTHING;
    END LOOP;

    IF s.organization_id IS NOT NULL THEN
      FOR m IN SELECT user_id, role FROM "member" WHERE organization_id = s.organization_id LOOP
        target_id := CASE WHEN m.role = 'owner' THEN owner_id ELSE admin_id END;
        INSERT INTO "store_member" (id, store_id, user_id, role_id, status)
        VALUES (gen_random_uuid(), s.id, m.user_id, target_id, 'active')
        ON CONFLICT (store_id, user_id) DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT apply_store_rls();

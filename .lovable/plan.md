# Multi-Brand (Multi-Tenant) Infrastructure

## 1. Database migration

**New table `public.brands`**
- `id uuid pk`, `slug text unique not null` (lowercase, url-safe, validated),
  `name_en text not null`, `name_ar text`, `logo_url text`,
  `is_active boolean default true`, `created_by uuid` (super admin),
  timestamps.
- GRANTs: `authenticated` SELECT (RLS narrows), `service_role` ALL.
- RLS: super admin full CRUD; everyone else SELECT rows they belong to
  (`brand_id = current_brand_id()` or `super_admin`).

**Role enum + role change**
- Extend `role` check constraint on `profiles` to include `brand_admin`.
- Update `is_admin()` to include `brand_admin` (per-brand admin still is an
  "admin" inside their brand).
- Add `is_brand_admin()` and `current_brand_id()` security-definer helpers.
- Add `can_access_brand(bid uuid)` = `is_super_admin() OR bid = current_brand_id()`.

**Default brand + backfill**
- Insert `('pura', 'Pura', 'بورا')`.
- Backfill `brand_id = <pura.id>` on every existing row in:
  `profiles, products, product_variants, orders, order_items, customers,
   customer_addresses, expenses, activity_logs, message_templates,
   business_settings, customization_options`.
- After backfill, set `brand_id NOT NULL` on those tables (kept nullable on
  `profiles` because super admin has no brand).

**Brand-scoped RLS**
- Rewrite existing policies on the 10 tenant tables to require
  `can_access_brand(brand_id)`.
- Writes: default `brand_id = current_brand_id()` via triggers so callers
  don't have to remember to set it.
- Super admin sees/edits everything.

## 2. Server side

**Edge fn `user-management`**
- Accept optional `brand_id` on create/update.
- Accept `brand_admin` role only when caller is super admin (brand admins
  can only create `staff` inside their own brand).
- Force `brand_id` to equal caller's brand for non-super-admin callers.

**New edge fn `brand-management`** (super-admin only)
- `create` (name_en, name_ar, slug, logo_url) + assign initial brand admin.
- `list`, `update`, `deactivate`.

## 3. Client

**`profile-context`**
- Add `brand` (joined row) and `isBrandAdmin` derived flag.

**Routing (TanStack file routes)**
Move every workspace page under a new brand layout:
- New: `_authenticated.b.$slug.route.tsx` — layout that loads the brand by
  slug, checks the caller can access it (super admin OR brand matches),
  provides a `BrandContext`, renders `<Outlet />`.
- Move: `dashboard`, `inventory`, `customers`, `campaigns`, `orders.index`,
  `orders.$id`, `expenses`, `settings`, `team` files into
  `_authenticated/b/$slug/…`.
- Keep bare `/dashboard` as a smart redirector: super admin → `/brands`,
  brand admin/staff → `/b/{their-slug}/dashboard`.
- New: `_authenticated.brands.tsx` — super-admin-only brand list/create UI.
- Reserve: `store.$slug.tsx` — public placeholder route that fetches the
  brand by slug and renders a "coming soon" shell (RLS allows anon SELECT
  on the specific brand row via a narrow policy).

**AppShell**
- Nav links now use `to="/b/$slug/dashboard"` etc., built from current
  brand context.
- Add brand switcher (super admin only) at top of sidebar.
- Language switcher, i18n, and existing behaviour untouched.

**User-management page (team)**
- When super admin: brand column + brand assignment dropdown; `brand_admin`
  role option.
- When brand admin: staff-only role selector, brand implicit.

## 4. Storefront readiness (no UI yet)
- `store.$slug.tsx` renders a minimal "Storefront coming soon" so the
  slug-based public URL is reserved and the brand lookup path is exercised.
- All product/variant/settings tables now carry `brand_id NOT NULL`, ready
  for a future public read via a narrow `TO anon` policy on
  `products/product_variants` filtered by `brand_id + is_active`.

## 5. Risk / rollout
- Migration is destructive of current policies — I'll drop/recreate in one
  transaction with backfill first, then set NOT NULL last.
- Type regeneration happens after the migration; client edits follow.
- Every existing feature stays functional because super admin sees all
  brands and existing data belongs to `pura`.

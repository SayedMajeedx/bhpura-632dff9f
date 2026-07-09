create extension if not exists pg_net with schema extensions;

-- 1. Order tracking columns
alter table public.orders
  add column if not exists confirmation_email_status text not null default 'pending',
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists confirmation_email_error text;

do $$ begin
  alter table public.orders
    add constraint orders_confirmation_email_status_check
    check (confirmation_email_status in ('pending','sent','failed','skipped'));
exception when duplicate_object then null; end $$;

-- 2. Minimal config table
create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
grant all on public.app_config to service_role;

insert into public.app_config (key, value) values
  ('edge_function_base_url', 'https://REPLACE_WITH_PROJECT_REF.supabase.co/functions/v1'),
  ('order_email_webhook_secret', 'REPLACE_WITH_A_LONG_RANDOM_SECRET')
on conflict (key) do nothing;

-- 3. Trigger: after every new order
create or replace function public.notify_order_confirmation_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_base_url text;
  v_secret   text;
begin
  select value into v_base_url from public.app_config where key = 'edge_function_base_url';
  select value into v_secret   from public.app_config where key = 'order_email_webhook_secret';

  if v_base_url is null or v_secret is null or v_base_url like '%REPLACE_WITH%' then
    return new;
  end if;

  perform net.http_post(
    url     := v_base_url || '/send-order-email',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := jsonb_build_object('order_id', new.id),
    timeout_milliseconds := 15000
  );

  return new;
exception when others then
  raise warning 'notify_order_confirmation_email failed for order %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_order_confirmation_email on public.orders;
create trigger trg_order_confirmation_email
  after insert on public.orders
  for each row
  execute function public.notify_order_confirmation_email();

-- 4. Manual resend function
create or replace function public.resend_order_confirmation_email(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_brand_id uuid;
  v_base_url text;
  v_secret   text;
begin
  select brand_id into v_brand_id from public.orders where id = p_order_id;
  if v_brand_id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if not public.can_access_brand(v_brand_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select value into v_base_url from public.app_config where key = 'edge_function_base_url';
  select value into v_secret   from public.app_config where key = 'order_email_webhook_secret';

  if v_base_url is null or v_secret is null or v_base_url like '%REPLACE_WITH%' then
    raise exception 'EMAIL_SYSTEM_NOT_CONFIGURED';
  end if;

  update public.orders set confirmation_email_status = 'pending' where id = p_order_id;

  perform net.http_post(
    url     := v_base_url || '/send-order-email',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret
               ),
    body    := jsonb_build_object('order_id', p_order_id),
    timeout_milliseconds := 15000
  );

  return jsonb_build_object('queued', true);
end;
$$;

revoke execute on function public.resend_order_confirmation_email(uuid) from public, anon;
grant execute on function public.resend_order_confirmation_email(uuid) to authenticated;
-- Run this file in the Supabase SQL editor before using the app.
-- It creates the tables, role checks, trigger, and row-level security policies.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('applicant', 'hr')),
  phone text default '',
  location text default '',
  skills text default '',
  cv_url text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text not null,
  location text not null,
  deadline date not null,
  description text not null,
  requirements text not null,
  status text not null default 'Open' check (status in ('Open', 'Closed')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  cover_letter text not null,
  status text not null default 'Applied' check (status in ('Applied', 'Screening', 'Interview', 'Offered', 'Hired', 'Rejected')),
  notes text default '',
  interview_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_jobs_updated_at on public.jobs;
create trigger touch_jobs_updated_at
before update on public.jobs
for each row execute function public.touch_updated_at();

drop trigger if exists touch_applications_updated_at on public.applications;
create trigger touch_applications_updated_at
before update on public.applications
for each row execute function public.touch_updated_at();

create or replace function public.is_hr()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'hr'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'applicant')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

drop policy if exists "profiles_select_own_or_hr" on public.profiles;
create policy "profiles_select_own_or_hr"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_hr());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "jobs_select_open_related_or_hr" on public.jobs;
create policy "jobs_select_open_related_or_hr"
on public.jobs for select
to authenticated
using (
  status = 'Open'
  or public.is_hr()
  or exists (
    select 1
    from public.applications
    where applications.job_id = jobs.id
      and applications.applicant_id = auth.uid()
  )
);

drop policy if exists "jobs_insert_hr" on public.jobs;
create policy "jobs_insert_hr"
on public.jobs for insert
to authenticated
with check (public.is_hr() and created_by = auth.uid());

drop policy if exists "jobs_update_hr" on public.jobs;
create policy "jobs_update_hr"
on public.jobs for update
to authenticated
using (public.is_hr())
with check (public.is_hr());

drop policy if exists "applications_select_owner_or_hr" on public.applications;
create policy "applications_select_owner_or_hr"
on public.applications for select
to authenticated
using (applicant_id = auth.uid() or public.is_hr());

drop policy if exists "applications_insert_owner_for_open_job" on public.applications;
create policy "applications_insert_owner_for_open_job"
on public.applications for insert
to authenticated
with check (
  applicant_id = auth.uid()
  and exists (
    select 1
    from public.jobs
    where jobs.id = applications.job_id
      and jobs.status = 'Open'
  )
);

drop policy if exists "applications_update_hr" on public.applications;
create policy "applications_update_hr"
on public.applications for update
to authenticated
using (public.is_hr())
with check (public.is_hr());

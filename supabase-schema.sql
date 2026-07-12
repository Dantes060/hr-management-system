-- HireFlow database setup / migration
-- Run this complete file in the Supabase SQL Editor.
-- It is idempotent: it can be safely re-run after future frontend updates.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'applicant' check (role in ('applicant', 'hr')),
  phone text not null default '',
  location text not null default '',
  skills text not null default '',
  cv_url text not null default '',
  cv_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migrate older HireFlow databases without deleting existing records.
alter table public.profiles add column if not exists cv_path text not null default '';
alter table public.profiles alter column role set default 'applicant';
alter table public.profiles alter column phone set default '';
alter table public.profiles alter column location set default '';
alter table public.profiles alter column skills set default '';
alter table public.profiles alter column cv_url set default '';

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text not null,
  location text not null,
  deadline date not null,
  employment_type text not null default 'Full-time'
    check (employment_type in ('Full-time', 'Part-time', 'Contract', 'Internship')),
  workplace_type text not null default 'On-site'
    check (workplace_type in ('On-site', 'Hybrid', 'Remote')),
  positions integer not null default 1 check (positions between 1 and 100),
  salary_range text not null default '',
  description text not null,
  requirements text not null,
  status text not null default 'Open' check (status in ('Open', 'Closed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs add column if not exists employment_type text not null default 'Full-time';
alter table public.jobs add column if not exists workplace_type text not null default 'On-site';
alter table public.jobs add column if not exists positions integer not null default 1;
alter table public.jobs add column if not exists salary_range text not null default '';

-- Preserve company recruitment history when an HR profile is removed.
alter table public.jobs drop constraint if exists jobs_created_by_fkey;
alter table public.jobs alter column created_by drop not null;
alter table public.jobs
  add constraint jobs_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  cover_letter text not null,
  status text not null default 'Applied'
    check (status in ('Applied', 'Screening', 'Interview', 'Offered', 'Hired', 'Rejected')),
  notes text not null default '',
  interview_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);

-- ---------------------------------------------------------------------------
-- Automatic timestamps
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
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

-- ---------------------------------------------------------------------------
-- Role security
-- ---------------------------------------------------------------------------

create or replace function public.is_hr()
returns boolean
language sql
stable
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

revoke all on function public.is_hr() from public;
grant execute on function public.is_hr() to authenticated;

-- Public sign-up always creates an Applicant. User-controlled auth metadata is
-- deliberately ignored so a visitor cannot grant themselves HR privileges.
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
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'applicant'
  )
  on conflict (id) do update set
    full_name = excluded.full_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Prevent authenticated browser clients from changing immutable identity fields.
-- Changes made directly by an administrator in the SQL Editor have auth.uid() = null
-- and are therefore still allowed.
create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if new.id is distinct from old.id then
      raise exception 'Profile id cannot be changed';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Profile role can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_identity_before_update on public.profiles;
create trigger protect_profile_identity_before_update
before update on public.profiles
for each row execute function public.protect_profile_identity();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

-- Profiles
drop policy if exists "profiles_select_own_or_hr" on public.profiles;
create policy "profiles_select_own_or_hr"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_hr());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'applicant');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Jobs
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

-- Applications
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
      and jobs.deadline >= current_date
  )
);

drop policy if exists "applications_update_hr" on public.applications;
create policy "applications_update_hr"
on public.applications for update
to authenticated
using (public.is_hr())
with check (public.is_hr());

-- ---------------------------------------------------------------------------
-- Private CV storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs',
  'cvs',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- An applicant owns files in cvs/<their-user-id>/.... HR can only read them.
drop policy if exists "cv_select_owner_or_hr" on storage.objects;
create policy "cv_select_owner_or_hr"
on storage.objects for select
to authenticated
using (
  bucket_id = 'cvs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_hr()
  )
);

drop policy if exists "cv_insert_owner" on storage.objects;
create policy "cv_insert_owner"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'cvs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "cv_update_owner" on storage.objects;
create policy "cv_update_owner"
on storage.objects for update
to authenticated
using (
  bucket_id = 'cvs'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'cvs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "cv_delete_owner" on storage.objects;
create policy "cv_delete_owner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'cvs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- Administrator setup
-- ---------------------------------------------------------------------------
-- After the HR user has created and confirmed an Applicant account, run this
-- manually in the SQL Editor, replacing the email address:
--
-- update public.profiles
-- set role = 'hr'
-- where id = (select id from auth.users where email = 'hr@example.com');

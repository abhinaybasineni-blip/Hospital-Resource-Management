create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  password_hash text not null,
  hospital_name text not null,
  role text not null default 'HOSPITAL_MANAGER'
    check (role in ('ADMIN', 'HOSPITAL_MANAGER', 'STAFF')),
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_email_lower_idx on public.profiles (lower(email));

create table if not exists public.icu_beds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bed_id text not null,
  ward text not null,
  status text not null check (status in ('available', 'occupied', 'maintenance', 'critical')),
  patient_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (user_id, bed_id)
);
create index if not exists icu_beds_user_updated_idx on public.icu_beds (user_id, updated_at desc);

create table if not exists public.oxygen_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  equipment_type text not null,
  location text not null,
  status text not null check (status in ('available', 'in-use', 'maintenance', 'critical')),
  quantity integer not null default 1 check (quantity >= 0),
  last_serviced date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists oxygen_user_updated_idx on public.oxygen_equipment (user_id, updated_at desc);

create table if not exists public.ventilators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  asset_id text not null,
  location text not null,
  status text not null check (status in ('available', 'in-use', 'maintenance', 'critical')),
  last_serviced date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (user_id, asset_id)
);
create index if not exists ventilators_user_updated_idx on public.ventilators (user_id, updated_at desc);

create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null,
  quantity integer not null check (quantity >= 0),
  unit text not null,
  reorder_level integer not null default 0 check (reorder_level >= 0),
  expiry_date date not null,
  location text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists medicines_user_expiry_idx on public.medicines (user_id, expiry_date);
create index if not exists medicines_user_updated_idx on public.medicines (user_id, updated_at desc);

create table if not exists public.blood_units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  blood_group text not null check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  quantity integer not null check (quantity >= 0),
  expiry_date date not null,
  location text not null,
  status text not null check (status in ('available', 'reserved', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists blood_user_expiry_idx on public.blood_units (user_id, expiry_date);
create index if not exists blood_user_updated_idx on public.blood_units (user_id, updated_at desc);

create table if not exists public.resource_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_name text not null,
  resource_type text not null check (resource_type in ('icu-beds', 'oxygen', 'ventilators', 'medicines', 'blood')),
  resource_id uuid not null,
  action text not null check (action in ('CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE')),
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists history_user_created_idx on public.resource_history (user_id, created_at desc);
create index if not exists history_type_created_idx on public.resource_history (user_id, resource_type, created_at desc);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  fingerprint text not null,
  resource_type text not null check (resource_type in ('icu-beds', 'oxygen', 'ventilators', 'medicines', 'blood')),
  resource_id uuid not null,
  severity text not null check (severity in ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);
create index if not exists alerts_user_active_created_idx on public.alerts (user_id, is_active, created_at desc);

create table if not exists public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  analysis_type text not null check (analysis_type in ('analysis', 'action-plan', 'checklist')),
  input_snapshot jsonb not null,
  output_json jsonb not null,
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  created_at timestamptz not null default now()
);
create index if not exists ai_outputs_user_created_idx on public.ai_outputs (user_id, created_at desc);

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.icu_beds, public.oxygen_equipment, public.ventilators,
  public.medicines, public.blood_units, public.resource_history, public.alerts,
  public.ai_outputs to authenticated;

alter table public.profiles enable row level security;
alter table public.icu_beds enable row level security;
alter table public.oxygen_equipment enable row level security;
alter table public.ventilators enable row level security;
alter table public.medicines enable row level security;
alter table public.blood_units enable row level security;
alter table public.resource_history enable row level security;
alter table public.alerts enable row level security;
alter table public.ai_outputs enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists icu_beds_owner on public.icu_beds;
create policy icu_beds_owner on public.icu_beds for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists oxygen_owner on public.oxygen_equipment;
create policy oxygen_owner on public.oxygen_equipment for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ventilators_owner on public.ventilators;
create policy ventilators_owner on public.ventilators for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists medicines_owner on public.medicines;
create policy medicines_owner on public.medicines for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists blood_units_owner on public.blood_units;
create policy blood_units_owner on public.blood_units for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists resource_history_owner on public.resource_history;
create policy resource_history_owner on public.resource_history for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists alerts_owner on public.alerts;
create policy alerts_owner on public.alerts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ai_outputs_owner on public.ai_outputs;
create policy ai_outputs_owner on public.ai_outputs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

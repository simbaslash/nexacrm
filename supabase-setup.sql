-- Nexa CRM – kör hela detta i Supabase: SQL Editor → New query → Run

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact text,
  email text,
  phone text,
  service text,
  status text default 'Ny',
  owner text,
  source text,
  value numeric default 0,
  commission numeric default 0,
  next_step text,
  next_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  date date not null,
  time text,
  type text,
  note text,
  owner text,
  created_at timestamptz default now()
);

-- Bara inloggade användare får läsa/skriva
alter table public.leads enable row level security;
alter table public.meetings enable row level security;

drop policy if exists "inloggade leads" on public.leads;
create policy "inloggade leads" on public.leads
  for all to authenticated using (true) with check (true);

drop policy if exists "inloggade meetings" on public.meetings;
create policy "inloggade meetings" on public.meetings
  for all to authenticated using (true) with check (true);

-- Live-uppdatering mellan er två
alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.meetings;

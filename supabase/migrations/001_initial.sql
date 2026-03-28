-- Enable UUID
create extension if not exists "uuid-ossp";

-- Users (extends Supabase auth.users)
create table public.profiles (
  id          uuid references auth.users(id) primary key,
  email       text,
  created_at  timestamptz default now(),
  theme       text default 'light' check (theme in ('light', 'dark')),
  dyslexia_mode boolean default false,
  microphone_enabled boolean default false,
  tts_speed   float default 1.0,
  interface_lang text default 'ru'
);

-- User progress (internal — never shown directly to user)
-- zone: 1, 2, 3 (internal zones — not shown to user)
-- group_id: 'g1'–'g21' (exercise groups — not shown to user)
-- step: 1–5 (difficulty step within group — not shown to user)
create table public.user_progress (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references public.profiles(id) on delete cascade,
  zone         int not null check (zone between 1 and 3),
  group_id     text not null,
  step         int default 1 check (step between 1 and 5),
  letters_seen text[] default '{}',
  letters_mastered text[] default '{}',
  last_session_at timestamptz,
  session_count int default 0,
  updated_at   timestamptz default now()
);

-- Generated AI texts cache
-- Hash key = SHA256 of (group_id + letter_targets + format + difficulty_step)
create table public.generated_texts (
  id           uuid default uuid_generate_v4() primary key,
  cache_key    text unique not null,
  group_id     text not null,
  letter_targets text[] not null,
  format       text not null,
  content      text not null,
  word_count   int,
  created_at   timestamptz default now()
);

-- Audio cache
-- Maps text string → Supabase Storage URL for MP3
create table public.audio_cache (
  id           uuid default uuid_generate_v4() primary key,
  text_hash    text unique not null,
  text_content text not null,
  voice        text default 'fr-FR-Neural2-C',
  storage_url  text not null,
  duration_ms  int,
  created_at   timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can read own progress"
  on public.user_progress for select using (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.user_progress for all using (auth.uid() = user_id);

-- generated_texts and audio_cache are public read (shared cache)
alter table public.generated_texts enable row level security;
alter table public.audio_cache enable row level security;

create policy "Anyone can read generated texts"
  on public.generated_texts for select using (true);

create policy "Anyone can read audio cache"
  on public.audio_cache for select using (true);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

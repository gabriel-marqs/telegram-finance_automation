create table public.incomes (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  amount numeric(10, 2) not null,
  category text not null,
  description text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Online klaverjassen, stap 3: het spel zelf. De volledige staat (met alle kaarten) staat hier;
-- alleen de serverfunctie "klaverjas" leest en schrijft hem en geeft elke speler zijn eigen zicht.
create table if not exists klaverjas.spellen (
  code text primary key references klaverjas.tafels(code) on delete cascade,
  staat jsonb not null,
  versie integer not null default 1,
  bijgewerkt timestamptz not null default now()
);
alter table klaverjas.spellen enable row level security;

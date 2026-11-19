// Serverfunctie voor online klaverjassen. Bewaart de staat van het spel, controleert elke zet
// met dezelfde spelregels als de app en geeft elke speler alleen zijn eigen zicht.
// Bij het uitrollen worden src/online/motor.js en src/regels/*.js meegestuurd (zie ontwikkeling/uitrollen.sh).
import postgres from 'npm:postgres@3.4.5';
import * as M from './online/motor.js';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 });
const KOPPEN = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const antwoord = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: KOPPEN });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: KOPPEN });
  try {
    return antwoord(await verwerk(await req.json()));
  } catch (fout) {
    return antwoord({ fout: (fout as Error).message ?? String(fout) }, 400);
  }
});

// deno-lint-ignore no-explicit-any
async function verwerk({ actie, code, token, zet, als }: any) {
  code = String(code ?? '').toUpperCase();
  return await sql.begin(async (tx) => {
    const [tafel] = await tx`select code, status, regels from klaverjas.tafels where code = ${code} for update`;
    if (!tafel) throw new Error('Deze tafel bestaat niet meer');
    const [ik] = await tx`select plek, maker from klaverjas.plekken where code = ${code} and token = ${String(token ?? '')}`;
    if (!ik) throw new Error('Je zit niet aan deze tafel');
    await tx`update klaverjas.plekken set gezien = now() where code = ${code} and token = ${String(token)}`;
    const mensen = (await tx`select plek, naam, maker, gezien < now() - make_interval(secs => ${M.AFWEZIG_NA}) as afwezig
                             from klaverjas.plekken where code = ${code}`).map((m) => ({ ...m }));
    const namen: (string | null)[] = [null, null, null, null];
    const afwezig = [false, false, false, false];
    for (const m of mensen) { namen[m.plek] = m.naam; afwezig[m.plek] = m.afwezig; }
    const reken = M.rekenaar(mensen);
    const [rij] = await tx`select staat from klaverjas.spellen where code = ${code}`;
    let staat = rij?.staat ?? null;

    if (actie === 'start') {
      if (!ik.maker) throw new Error('Alleen de maker kan starten');
      if (staat && staat.fase !== 'partijKlaar') throw new Error('Het spel is al bezig');
      staat = M.start(tafel.regels);
      await tx`insert into klaverjas.spellen (code, staat) values (${code}, ${tx.json(staat)})
               on conflict (code) do update set staat = excluded.staat, versie = klaverjas.spellen.versie + 1, bijgewerkt = now()`;
      await tx`update klaverjas.tafels set status = 'spelen' where code = ${code}`;
      await tx`select klaverjas.seintje(${code})`;
    } else if (actie === 'zet') {
      if (!staat) throw new Error('Het spel is nog niet begonnen');
      let plek = ik.plek;
      if (als !== undefined && als !== null) {
        // De rekenaar (de maker, of als die weg is een andere speler) speelt de zetten van de
        // computers: op lege plekken en voor wie even weg is.
        if (reken !== ik.plek) throw new Error('Jij speelt nu niet voor de computers');
        if (!M.computerPlek(mensen, Number(als))) throw new Error('Op die plek speelt iemand zelf');
        plek = Number(als);
      }
      staat = M.doe(staat, plek, zet);
      await tx`update klaverjas.spellen set staat = ${tx.json(staat)}, versie = versie + 1, bijgewerkt = now() where code = ${code}`;
      await tx`select klaverjas.seintje(${code})`;
    } else if (actie !== 'zicht') {
      throw new Error('Onbekende actie');
    }
    if (!staat) return { status: tafel.status, namen, afwezig, ik: ik.plek, maker: ik.maker };

    // Voor de rekenaar: moet een computer nu iets doen? Dan alleen wat die computer mag weten.
    let computer = null;
    const z = M.aanZet(staat);
    if (reken === ik.plek && z && z.plek !== ik.plek && M.computerPlek(mensen, z.plek)) computer = M.computerVraag(staat, z.plek);
    return { status: tafel.status, namen, afwezig, ik: ik.plek, maker: ik.maker, zicht: M.zicht(staat, ik.plek), computer };
  });
}

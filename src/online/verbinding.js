// Verbinding met de online tafel in Supabase (project "app maker databases").
// Geen inlog: elke speler heeft een geheime sleutel (token) die op zijn apparaat blijft.
// De publishable key hieronder is bedoeld om openbaar te zijn; de database laat met deze
// sleutel alleen de klaverjas-functies toe (zie supabase/01-wachtruimte.sql).

export const SUPABASE_URL = 'https://kegpsbtlfnqxrwiaeovc.supabase.co';
export const SUPABASE_SLEUTEL = 'sb_publishable_4afcXICjvnZHcjxruVoMRA_PKFBp1hp';

// Roept een databasefunctie aan, bijvoorbeeld rpc('klaverjas_maak', { p_naam, p_regels }).
export async function rpc(naam, args) {
  let antwoord;
  try {
    antwoord = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${naam}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SLEUTEL, Authorization: `Bearer ${SUPABASE_SLEUTEL}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    throw new Error('Geen verbinding met internet');
  }
  const tekst = await antwoord.text();
  const data = tekst ? JSON.parse(tekst) : null;
  if (!antwoord.ok) throw new Error(data?.message || 'Er ging iets mis met de verbinding');
  return data;
}

// Luistert naar seintjes van de tafel (Supabase Realtime, openbaar kanaal "klaverjas-CODE").
// Elk seintje betekent alleen "er is iets veranderd"; de app haalt dan zelf zijn eigen beeld op.
// Werkt Realtime niet, dan kijkt de app elke 4 seconden zelf.
export function luister(code, opSeintje) {
  let ws = null;
  let hartslag = null;
  let gestopt = false;
  let ref = 0;
  const peil = setInterval(() => opSeintje(), 4000);
  const verbind = () => {
    if (gestopt) return;
    try {
      ws = new WebSocket(`${SUPABASE_URL.replace('https', 'wss')}/realtime/v1/websocket?apikey=${SUPABASE_SLEUTEL}&vsn=1.0.0`);
    } catch {
      return;
    }
    const topic = `realtime:klaverjas-${code}`;
    ws.onopen = () => {
      ws.send(JSON.stringify({ topic, event: 'phx_join', payload: { config: { broadcast: { self: false }, presence: { key: '' }, private: false } }, ref: String(++ref) }));
      hartslag = setInterval(() => ws?.readyState === 1 && ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) })), 25000);
    };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.event === 'broadcast') opSeintje(m.payload?.payload);
      } catch { /* negeren */ }
    };
    ws.onclose = () => {
      clearInterval(hartslag);
      if (!gestopt) setTimeout(verbind, 3000);
    };
  };
  verbind();
  return () => {
    gestopt = true;
    clearInterval(peil);
    clearInterval(hartslag);
    try { ws?.close(); } catch { /* al dicht */ }
  };
}

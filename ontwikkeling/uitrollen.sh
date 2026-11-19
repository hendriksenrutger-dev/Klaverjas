#!/bin/sh
# Rolt de serverfunctie "klaverjas" uit naar Supabase (project app maker databases),
# met de spelregels uit src/ erbij. Nodig: een Supabase-toegangssleutel in de omgeving.
set -e
cd "$(dirname "$0")/.."
R=kegpsbtlfnqxrwiaeovc
set -- -F 'metadata={"entrypoint_path":"index.ts","name":"klaverjas","verify_jwt":false};type=application/json' \
  -F "file=@supabase/functions/klaverjas/index.ts;filename=index.ts" \
  -F "file=@src/online/motor.js;filename=online/motor.js"
for f in src/regels/*.js; do set -- "$@" -F "file=@$f;filename=regels/$(basename "$f")"; done
curl -sS -X POST "https://api.supabase.com/v1/projects/$R/functions/deploy?slug=klaverjas" -H "Authorization: Bearer proxy-injected" "$@"
echo

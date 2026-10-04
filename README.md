# thuis.

Een homedisplay voor GitHub Pages met Tuya-bediening via Cloudflare Workers en een Spotify-embed. Zonder ingestelde Tuya-koppeling werkt de interface in demomodus.

## GitHub Pages

1. Push deze repository naar GitHub.
2. Open **Settings → Pages** en kies de branch en root-map waarin `index.html` staat.
3. De site wordt gepubliceerd op `https://GEBRUIKERSNAAM.github.io/REPOSITORY/`.

## Tuya API instellen

De dashboardbestanden bevatten geen Tuya-sleutels. De Worker onder `worker/` ondertekent Tuya-verzoeken en bewaart de API-geheimen aan serverzijde.

1. Maak in Tuya IoT Platform een cloudproject, koppel je Smart Life/Tuya-appaccount en noteer de Access ID, Access Secret en User UID. Schakel de benodigde Smart Home API-diensten in.
2. Open de map `worker` in je terminal en pas `wrangler.toml` aan: `TUYA_UID`, je GitHub Pages-origin en eventueel `TUYA_REGION` (`eu`, `us`, `cn` of `in`). De origin is voor een project doorgaans `https://GEBRUIKERSNAAM.github.io`; CORS vergelijkt alleen de origin, niet het repository-pad.
3. Voer de volgende commando's uit vanuit de map `worker`. Meld je aan bij Cloudflare:

   ```powershell
   npx wrangler login
   ```

4. Stel de geheimen in vanuit de map `worker`:

   ```powershell
   npx wrangler secret put TUYA_ACCESS_ID
   npx wrangler secret put TUYA_ACCESS_SECRET
   npx wrangler secret put DASHBOARD_TOKEN
   ```

   Gebruik voor `DASHBOARD_TOKEN` een lange, willekeurige waarde. Deze is niet hetzelfde als je Tuya Access Secret.
5. Publiceer de Worker:

   ```powershell
   npx wrangler deploy
   ```

6. Open **Instellingen** in het dashboard en vul de Worker-URL (bijvoorbeeld `https://thuistuyaapi.<jouw-subdomein>.workers.dev`) en dezelfde `DASHBOARD_TOKEN` in. Die token wordt alleen lokaal in deze browser opgeslagen.

De proxy haalt ook per apparaat ontbrekende functies en status op. Lampen met `colour_data` of `colour_data_v2` krijgen een kleurkiezer. Niet-beschikbare lampen worden als uit getoond. Verberg apparaten met het oog-icoon; via **Verborgen apparaten** kun je ze terugzetten. Na wijzigingen in `worker/` deploy je opnieuw met `npx wrangler deploy` vanuit de map `worker`.

## Spotify gebruiken

1. Open in Spotify een nummer, album of playlist en kies **Delen → Link kopiëren**.
2. Open **Instellingen** op het dashboard, plak de link en sla op.

De Spotify-player verschijnt naast de apparaten en speelt de gekozen link in een frame af. Hiervoor zijn geen Premium-account, Client ID of Cloudflare nodig. De embed toont niet wat al op een ander apparaat speelt.

## Homedisplay

Gebruik de knop met de schermhoeken rechtsboven om de kioskweergave en volledig scherm te openen. Op de telefoon blijven instellingen bereikbaar via het tandwiel rechtsboven.
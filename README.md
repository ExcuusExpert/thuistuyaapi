# thuis.

Een home-dashboard voor GitHub Pages met Tuya-bediening via Cloudflare Workers en Spotify Connect-bediening. Zonder ingestelde Tuya-koppeling werkt de interface in demomodus.

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

De proxy ondersteunt het ophalen van apparaten en het schakelen van Tuya-apparaten met een `switch`, `switch_1` of `switch_led` datapunt. Voor lampen die `colour_data` of `colour_data_v2` rapporteren verschijnt ook een kleurkiezer. Controleer bij Tuya of je cloudproject de juiste API-regio en accountkoppeling gebruikt.

## Spotify koppelen

1. Maak een app aan in het [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Open in het homedashboard **Instellingen** en kopieer de redirect-URL onder het Spotify Client ID-veld.
3. Voeg die volledige URL als **Redirect URI** toe bij de instellingen van je Spotify-app. De URL moet exact overeenkomen, inclusief eventueel het repository-pad en de afsluitende slash.
4. Kopieer de **Client ID** van Spotify naar dezelfde instellingen in het homedashboard en sla op.
5. Kies **Spotify koppelen** en geef toestemming. De login gebruikt PKCE; een Client Secret is niet nodig en moet niet in het dashboard worden ingevuld.

De speler bedient Spotify Connect: start Spotify eerst op de speaker, telefoon of ander apparaat waar je muziek wilt horen. Afspelen, pauzeren, nummers overslaan en zoeken vereisen Spotify Premium en een actief afspeelapparaat. Staat de Spotify-app in Development Mode, voeg dan je Spotify-account toe aan de toegestane gebruikers. De Client ID en OAuth-tokens worden alleen lokaal in die browser opgeslagen.

## Homedisplay

Gebruik de knop met de schermhoeken rechtsboven om de kioskweergave en volledig scherm te openen. Op de telefoon blijven instellingen bereikbaar via het tandwiel rechtsboven. De klok en speler verversen automatisch.
# thuis.

Een statisch home-dashboard voor GitHub Pages met een beveiligde Tuya-koppeling via Cloudflare Workers. Zonder ingestelde koppeling werkt de interface in demomodus. Spotify kan later als aparte integratie worden toegevoegd.

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

De proxy ondersteunt het ophalen van apparaten en het schakelen van Tuya-apparaten met een `switch`, `switch_1` of `switch_led` datapunt. Controleer bij Tuya of je cloudproject de juiste API-regio en accountkoppeling gebruikt.
const SPOTIFY_KEYS = {
  token: 'thuis-spotify-token',
  verifier: 'thuis-spotify-verifier',
  state: 'thuis-spotify-oauth-state',
  clientId: 'thuis-spotify-client-id',
};
const spotify = { playback: null, busy: false };
const spotifyElement = (selector) => document.querySelector(selector);

function getStoredToken() {
  try { return JSON.parse(localStorage.getItem(SPOTIFY_KEYS.token) || 'null'); }
  catch { return null; }
}

function setSpotifyStatus(message, statusClass = '') {
  const element = spotifyElement('#spotify-status');
  element.className = `spotify-status ${statusClass}`;
  element.replaceChildren(Object.assign(document.createElement('span'), { className: 'tiny-dot' }), document.createTextNode(message));
}

function renderTrackless(message) {
  spotify.playback = null;
  spotifyElement('#spotify-cover').hidden = true;
  spotifyElement('#spotify-cover-placeholder').hidden = false;
  spotifyElement('#spotify-track-title').textContent = message;
  spotifyElement('#spotify-track-artist').textContent = 'Start Spotify op een speaker of ander apparaat';
  spotifyElement('#spotify-device-label').textContent = 'Bediening via Spotify Connect';
  spotifyElement('#spotify-position').textContent = '0:00';
  spotifyElement('#spotify-duration').textContent = '0:00';
  spotifyElement('#spotify-seek').value = '0';
  spotifyElement('#spotify-seek').disabled = true;
  setControlsEnabled(false);
}

function setControlsEnabled(enabled) {
  ['#spotify-previous', '#spotify-next', '#spotify-play', '#spotify-seek'].forEach((selector) => {
    spotifyElement(selector).disabled = !enabled;
  });
}

function base64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

async function connectSpotify() {
  const clientId = localStorage.getItem(SPOTIFY_KEYS.clientId);
  if (!clientId) {
    document.querySelector('#open-settings').click();
    return;
  }
  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)));
  const oauthState = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  sessionStorage.setItem(SPOTIFY_KEYS.verifier, verifier);
  sessionStorage.setItem(SPOTIFY_KEYS.state, oauthState);
  const parameters = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: await createCodeChallenge(verifier),
    state: oauthState,
    scope: 'user-read-currently-playing user-read-playback-state user-modify-playback-state',
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${parameters}`);
}

async function exchangeAuthorizationCode() {
  const parameters = new URLSearchParams(window.location.search);
  const code = parameters.get('code');
  const returnedState = parameters.get('state');
  if (!code && !parameters.has('error')) return;
  const verifier = sessionStorage.getItem(SPOTIFY_KEYS.verifier);
  const expectedState = sessionStorage.getItem(SPOTIFY_KEYS.state);
  sessionStorage.removeItem(SPOTIFY_KEYS.verifier);
  sessionStorage.removeItem(SPOTIFY_KEYS.state);
  window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
  if (parameters.has('error')) throw new Error('Spotify heeft de koppeling geannuleerd.');
  if (!verifier || !expectedState || returnedState !== expectedState) throw new Error('Spotify-aanmelding kon niet veilig worden gecontroleerd. Probeer opnieuw.');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: localStorage.getItem(SPOTIFY_KEYS.clientId),
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${window.location.origin}${window.location.pathname}`,
      code_verifier: verifier,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || 'Spotify-token ophalen mislukt.');
  localStorage.setItem(SPOTIFY_KEYS.token, JSON.stringify({
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: Date.now() + result.expires_in * 1000,
  }));
}

async function accessToken(forceRefresh = false) {
  const stored = getStoredToken();
  if (!stored) throw new Error('Koppel Spotify opnieuw via instellingen.');
  if (!forceRefresh && stored.expiresAt > Date.now() + 60_000) return stored.accessToken;
  if (!stored.refreshToken) throw new Error('Spotify-sessie verlopen. Koppel Spotify opnieuw.');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: localStorage.getItem(SPOTIFY_KEYS.clientId),
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || 'Spotify-sessie vernieuwen mislukt.');
  const refreshed = {
    accessToken: result.access_token,
    refreshToken: result.refresh_token || stored.refreshToken,
    expiresAt: Date.now() + result.expires_in * 1000,
  };
  localStorage.setItem(SPOTIFY_KEYS.token, JSON.stringify(refreshed));
  return refreshed.accessToken;
}

async function spotifyRequest(path, options = {}, retry = true) {
  const token = await accessToken();
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (response.status === 401 && retry) {
    await accessToken(true);
    return spotifyRequest(path, options, false);
  }
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 403
      ? 'Spotify-bediening vereist Premium en een actief apparaat.'
      : result.error?.message || 'Spotify kon niet worden bijgewerkt.';
    throw new Error(message);
  }
  return result;
}

function formatTrackTime(milliseconds) {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function renderPlayback(playback) {
  spotify.playback = playback;
  const track = playback?.item;
  if (!track) {
    renderTrackless('Geen muziek actief');
    spotify.playback = playback;
    return;
  }
  const cover = spotifyElement('#spotify-cover');
  const imageUrl = track.album?.images?.[0]?.url;
  cover.hidden = !imageUrl;
  cover.src = imageUrl || '';
  spotifyElement('#spotify-cover-placeholder').hidden = Boolean(imageUrl);
  spotifyElement('#spotify-track-title').textContent = track.name || 'Onbekend nummer';
  spotifyElement('#spotify-track-artist').textContent = track.artists?.map((artist) => artist.name).join(', ') || 'Onbekende artiest';
  spotifyElement('#spotify-device-label').textContent = playback.device?.name ? `Speelt af op ${playback.device.name}` : 'Spotify Connect';
  spotifyElement('#spotify-duration').textContent = formatTrackTime(track.duration_ms || 0);
  const playButton = spotifyElement('#spotify-play');
  playButton.setAttribute('aria-label', playback.is_playing ? 'Pauzeren' : 'Afspelen');
  playButton.title = playback.is_playing ? 'Pauzeren' : 'Afspelen';
  playButton.querySelector('use').setAttribute('href', playback.is_playing ? '#i-pause' : '#i-play');
  setControlsEnabled(Boolean(playback.device?.id));
  updateProgress();
}

function updateProgress() {
  const playback = spotify.playback;
  if (!playback?.item) return;
  const duration = playback.item.duration_ms || 0;
  const position = Math.min(duration, playback.progress_ms + (playback.is_playing ? Date.now() - playback.receivedAt : 0));
  spotifyElement('#spotify-position').textContent = formatTrackTime(position);
  spotifyElement('#spotify-seek').value = String(duration ? Math.round(position / duration * 1000) : 0);
}

async function refreshSpotify(force = false) {
  const clientId = localStorage.getItem(SPOTIFY_KEYS.clientId);
  spotifyElement('#spotify-connect').textContent = clientId ? 'Spotify koppelen' : 'Spotify instellen';
  spotifyElement('#spotify-connect').hidden = false;
  if (!clientId) {
    renderTrackless('Spotify niet ingesteld');
    setSpotifyStatus('Niet verbonden');
    return;
  }
  if (spotify.busy && !force) return;
  spotify.busy = true;
  try {
    await exchangeAuthorizationCode();
    if (!getStoredToken()) {
      renderTrackless('Spotify niet gekoppeld');
      setSpotifyStatus('Niet verbonden');
      return;
    }
    const playback = await spotifyRequest('/me/player');
    if (playback) playback.receivedAt = Date.now();
    renderPlayback(playback);
    setSpotifyStatus('Verbonden', 'is-connected');
    spotifyElement('#spotify-connect').hidden = true;
  } catch (error) {
    renderTrackless('Spotify niet beschikbaar');
    setSpotifyStatus('Controleer Spotify', 'is-error');
    spotifyElement('#spotify-connect').hidden = false;
    if (force) window.dispatchEvent(new CustomEvent('home-toast', { detail: error.message }));
  } finally {
    spotify.busy = false;
  }
}

async function controlPlayback(action, body) {
  try {
    const endpoint = action === 'seek' ? `/me/player/seek?position_ms=${body.position_ms}` : `/me/player/${action}`;
    await spotifyRequest(endpoint, { method: action === 'next' || action === 'previous' ? 'POST' : 'PUT' });
    window.setTimeout(() => refreshSpotify(true), 400);
  } catch (error) {
    window.dispatchEvent(new CustomEvent('home-toast', { detail: error.message }));
  }
}

function disconnectSpotify() {
  localStorage.removeItem(SPOTIFY_KEYS.token);
  sessionStorage.removeItem(SPOTIFY_KEYS.verifier);
  sessionStorage.removeItem(SPOTIFY_KEYS.state);
  spotifyElement('#spotify-connect').hidden = false;
  refreshSpotify(true);
}

spotifyElement('#spotify-connect').addEventListener('click', connectSpotify);
spotifyElement('#spotify-play').addEventListener('click', () => controlPlayback(spotify.playback?.is_playing ? 'pause' : 'play'));
spotifyElement('#spotify-next').addEventListener('click', () => controlPlayback('next'));
spotifyElement('#spotify-previous').addEventListener('click', () => controlPlayback('previous'));
spotifyElement('#spotify-seek').addEventListener('change', (event) => {
  const duration = spotify.playback?.item?.duration_ms;
  if (duration) controlPlayback('seek', { position_ms: Math.round(Number(event.target.value) / 1000 * duration) });
});
window.addEventListener('home-toast', (event) => {
  const toast = document.querySelector('#toast');
  toast.textContent = event.detail;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2800);
});
window.spotifyIntegration = { connect: connectSpotify, disconnect: disconnectSpotify, refresh: refreshSpotify };
window.setInterval(updateProgress, 1000);
window.setInterval(() => { if (!document.hidden) refreshSpotify(); }, 15_000);
refreshSpotify(true);
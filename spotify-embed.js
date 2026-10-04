const SPOTIFY_LINK_KEY = 'thuis-spotify-embed-link';
const spotifyEmbed = document.querySelector('#spotify-embed');
const spotifyEmpty = document.querySelector('#spotify-empty');

function parseSpotifyLink(value) {
  const input = String(value || '').trim();
  const uriMatch = input.match(/^spotify:(track|album|playlist|episode|show):([a-z\d]{16,64})$/i);
  if (uriMatch) return { type: uriMatch[1].toLowerCase(), id: uriMatch[2], height: uriMatch[1] === 'track' || uriMatch[1] === 'episode' ? 152 : 352 };

  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com') return null;
    const segments = url.pathname.split('/').filter(Boolean);
    const types = ['track', 'album', 'playlist', 'episode', 'show'];
    const typeIndex = segments.findIndex((segment) => types.includes(segment));
    const type = segments[typeIndex];
    const id = segments[typeIndex + 1];
    if (!id || !/^[a-z\d]{16,64}$/i.test(id)) return null;
    return { type, id, height: type === 'track' || type === 'episode' ? 152 : 352 };
  } catch {
    return null;
  }
}

function setSpotifyStatus(message, connected = false) {
  const status = document.querySelector('#spotify-status');
  status.className = `spotify-status${connected ? ' is-connected' : ''}`;
  status.replaceChildren(Object.assign(document.createElement('span'), { className: 'tiny-dot' }), document.createTextNode(message));
}

function renderSpotifyEmbed() {
  const source = localStorage.getItem(SPOTIFY_LINK_KEY) || '';
  const media = parseSpotifyLink(source);
  if (!media) {
    spotifyEmbed.hidden = true;
    spotifyEmbed.removeAttribute('src');
    spotifyEmpty.hidden = false;
    setSpotifyStatus('Niet ingesteld');
    return;
  }

  spotifyEmpty.hidden = true;
  spotifyEmbed.hidden = false;
  spotifyEmbed.title = `Spotify ${media.type} speler`;
  spotifyEmbed.style.height = `${media.height}px`;
  spotifyEmbed.src = `https://open.spotify.com/embed/${media.type}/${media.id}?utm_source=generator&theme=0`;
  setSpotifyStatus('Spotify-player gereed', true);
}

window.spotifyEmbedIntegration = {
  parseLink: parseSpotifyLink,
  refresh: renderSpotifyEmbed,
  clear() {
    localStorage.removeItem(SPOTIFY_LINK_KEY);
    renderSpotifyEmbed();
  },
};

document.querySelector('#spotify-embed-edit').addEventListener('click', () => document.querySelector('#open-settings').click());
renderSpotifyEmbed();
const DEMO_DEVICES = [
  { id: 'demo-ceiling', name: 'Plafondlamp', room: 'Woonkamer', category: 'light', online: true, on: true, switchCode: 'switch_led', colorCode: 'colour_data', color: '#eab36f' },
  { id: 'demo-corner', name: 'Leeslamp', room: 'Woonkamer', category: 'light', online: true, on: false, switchCode: 'switch_led' },
  { id: 'demo-coffee', name: 'Koffiehoek', room: 'Keuken', category: 'plug', online: true, on: true, switchCode: 'switch_1' },
  { id: 'demo-hall', name: 'Slimme stekker', room: 'Hal', category: 'plug', online: true, on: false, switchCode: 'switch_1' },
];
const STORAGE_KEYS = { url: 'thuis-api-url', token: 'thuis-api-token', hidden: 'thuis-hidden-devices' };
const state = { devices: DEMO_DEVICES.map((device) => ({ ...device })), filter: 'all', category: 'all', query: '', connected: false, busy: new Set(), hidden: new Set(readHiddenDevices()), showHidden: false };
const $ = (selector) => document.querySelector(selector);
const grid = $('#device-grid');
const dialog = $('#settings-dialog');
const iconFor = (device) => device.category === 'plug' ? '#i-plug' : device.category === 'sensor' ? '#i-thermo' : '#i-light';
let toastTimer;

function configuredApi() { return { url: localStorage.getItem(STORAGE_KEYS.url) || '', token: localStorage.getItem(STORAGE_KEYS.token) || '' }; }
function readHiddenDevices() { try { const ids = JSON.parse(localStorage.getItem(STORAGE_KEYS.hidden) || '[]'); return Array.isArray(ids) ? ids : []; } catch { return []; } }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('visible'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2800); }
function setConnection(connected, detail) { state.connected = connected; $('#connection-dot').classList.toggle('connected', connected); $('#connection-label').textContent = connected ? 'Tuya verbonden' : 'Demomodus'; $('#connection-detail').textContent = detail; $('.connection-wifi').style.color = connected ? '#7bd39a' : ''; }
function categoryLabel(category) { if (category === 'plug') return 'Stekker'; if (category === 'sensor') return 'Sensor'; if (category === 'light') return 'Lamp'; return category || 'Apparaat'; }
function deviceCountLabel(count) { return `${count} ${count === 1 ? 'apparaat' : 'apparaten'}`; }

function render() {
  const hiddenCount = state.devices.filter((device) => state.hidden.has(device.id)).length;
  if (state.showHidden && hiddenCount === 0) state.showHidden = false;
  const visible = state.devices.filter((device) => {
    const matchesQuery = `${device.name} ${device.room} ${device.category}`.toLowerCase().includes(state.query.toLowerCase());
    if (state.showHidden) return state.hidden.has(device.id) && matchesQuery;
    if (state.hidden.has(device.id)) return false;
    return matchesQuery && (state.filter !== 'on' || device.on) && (state.category === 'all' || device.category === state.category);
  });
  grid.innerHTML = visible.map((device, index) => {
    const isOn = device.online !== false && Boolean(device.on);
    const statusText = device.online === false ? 'Niet bereikbaar' : isOn ? 'Ingeschakeld' : 'Uitgeschakeld';
    const controllable = Boolean(device.switchCode);
    const disabled = device.online === false || state.busy.has(device.id);
    const colorControl = device.colorCode ? `<label class="color-control" style="--device-color:${escapeHtml(device.color || '#ffffff')}" title="Kleur aanpassen"><input type="color" class="device-color" data-color-device="${escapeHtml(device.id)}" value="${escapeHtml(device.color || '#ffffff')}" aria-label="Kleur van ${escapeHtml(device.name)}" ${disabled ? 'disabled' : ''}><span></span></label>` : '';
    const visibilityControl = `<button class="visibility-button" type="button" data-hide-device-id="${escapeHtml(device.id)}" aria-label="${state.showHidden ? 'Terugzetten' : 'Verbergen'}: ${escapeHtml(device.name)}" title="${state.showHidden ? 'Terugzetten' : 'Verbergen'}"><svg><use href="${state.showHidden ? '#i-eye' : '#i-eye-off'}"/></svg></button>`;
    return `<article class="device-card${isOn ? ' is-on' : ''}" style="animation-delay:${index * 45}ms"><span class="device-icon ${device.category || 'light'}"><svg><use href="${iconFor(device)}"/></svg></span><div class="device-info"><strong>${escapeHtml(device.name)}</strong><span>${escapeHtml(device.room || categoryLabel(device.category))}</span><small class="device-state"><span class="tiny-dot"></span>${statusText}</small></div>${controllable ? `<div class="device-control"><small>${isOn ? 'Aan' : 'Uit'}</small><button class="toggle" type="button" role="switch" aria-checked="${isOn}" aria-label="${escapeHtml(device.name)} ${isOn ? 'uitschakelen' : 'inschakelen'}" data-device-id="${escapeHtml(device.id)}" ${disabled ? 'disabled' : ''}></button>${colorControl}${visibilityControl}</div>` : `<div class="device-control"><small>Alleen status</small>${visibilityControl}</div>`}</article>`;
  }).join('');
  $('#empty-state').hidden = visible.length > 0;
  grid.hidden = visible.length === 0;
  $('#empty-title').textContent = state.showHidden ? 'Geen verborgen apparaten' : 'Geen apparaten gevonden';
  $('#empty-copy').textContent = state.showHidden ? 'Er zijn geen verborgen apparaten meer.' : 'Pas je zoekopdracht of filter aan.';
  $('#devices-heading').firstChild.textContent = state.showHidden ? 'Verborgen apparaten ' : 'Jouw apparaten ';
  $('#hidden-devices-toolbar').hidden = hiddenCount === 0;
  $('#hidden-devices-label').textContent = state.showHidden ? 'Terug naar alle apparaten' : 'Verborgen apparaten';
  $('#hidden-device-count').textContent = state.showHidden ? '' : hiddenCount;
  $('#hidden-devices-icon').setAttribute('href', state.showHidden ? '#i-eye' : '#i-eye-off');
  const online = state.devices.filter((device) => device.online !== false).length;
  const active = state.devices.filter((device) => device.online !== false && device.on).length;
  $('#total-count').textContent = state.devices.length;
  $('#nav-device-count').textContent = state.devices.length;
  $('#online-count').textContent = `${deviceCountLabel(online)} online`;
  $('#active-count').textContent = active;
  $('#heading-count').textContent = String(visible.length).padStart(2, '0');
  $('#home-status').textContent = state.devices.length > 0 && online === state.devices.length ? 'Alles rustig' : 'Controleer apparaten';
  $('#home-status-summary').textContent = $('#home-status').textContent;
  $('#welcome-copy').textContent = active === 1 ? 'Er staat 1 apparaat aan.' : active > 1 ? `Er staan ${deviceCountLabel(active)} aan.` : 'Je huis is klaar voor vandaag.';
  $('#last-updated').textContent = `Bijgewerkt om ${new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }

async function requestApi(path, options = {}) {
  const api = configuredApi();
  if (!api.url || !api.token) throw new Error('Stel eerst je Worker URL en dashboard-token in.');
  const endpoint = new URL(api.url);
  endpoint.pathname = path;
  endpoint.searchParams.delete('path');
  const response = await fetch(endpoint, { ...options, headers: { Authorization: `Bearer ${api.token}`, 'Content-Type': 'application/json', ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.error || `Verbinding mislukt (${response.status}).`);
  return payload;
}

async function loadDevices() {
  const api = configuredApi();
  if (!api.url || !api.token) { state.devices = DEMO_DEVICES.map((device) => ({ ...device })); setConnection(false, 'Alleen lokaal'); render(); return; }
  setConnection(false, 'Verbinden…');
  try { const result = await requestApi('/api/devices'); state.devices = Array.isArray(result.devices) ? result.devices : []; setConnection(true, `${state.devices.length} apparaten`); render(); }
  catch (error) { setConnection(false, 'Controleer instellingen'); render(); showToast(error.message); }
}

async function toggleDevice(deviceId) {
  const device = state.devices.find((item) => item.id === deviceId);
  if (!device || state.busy.has(deviceId)) return;
  const nextValue = !device.on;
  if (!state.connected) { device.on = nextValue; render(); showToast('Demomodus: wijziging alleen lokaal opgeslagen.'); return; }
  state.busy.add(deviceId); render();
  try { await requestApi(`/api/devices/${encodeURIComponent(device.id)}/commands`, { method: 'POST', body: JSON.stringify({ code: device.switchCode, value: nextValue }) }); device.on = nextValue; showToast(`${device.name} staat ${nextValue ? 'aan' : 'uit'}.`); }
  catch (error) { showToast(error.message); }
  finally { state.busy.delete(deviceId); render(); }
}

function hsvFromHex(hex) {
  const [red, green, blue] = hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return { h: Math.round((hue + 360) % 360), s: Math.round((maximum ? delta / maximum : 0) * 1000), v: Math.round(maximum * 1000) };
}

async function setDeviceColor(deviceId, hex) {
  const device = state.devices.find((item) => item.id === deviceId);
  if (!device || !device.colorCode) return;
  const color = hsvFromHex(hex);
  const value = device.colorCode === 'colour_data_v2'
    ? [color.h, color.s, color.v].map((part) => part.toString(16).padStart(4, '0')).join('')
    : JSON.stringify(color);
  if (!state.connected) { device.color = hex; render(); showToast('Demomodus: kleur alleen lokaal aangepast.'); return; }
  state.busy.add(deviceId);
  render();
  try {
    await requestApi(`/api/devices/${encodeURIComponent(device.id)}/commands`, { method: 'POST', body: JSON.stringify({ code: device.colorCode, value }) });
    device.color = hex;
    showToast(`Kleur van ${device.name} aangepast.`);
  } catch (error) { showToast(error.message); }
  finally { state.busy.delete(deviceId); render(); }
}

function setDate() {
  const now = new Date();
  $('#clock').textContent = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(now);
  $('#today').textContent = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const hour = now.getHours();
  $('#greeting').textContent = hour < 12 ? 'GOEDEMORGEN' : hour < 18 ? 'GOEDEMIDDAG' : 'GOEDEAVOND';
}

$('#device-search').addEventListener('input', (event) => { state.query = event.target.value.trim(); render(); });
document.querySelectorAll('.filter-tab').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.toggle('selected', tab === button)); render(); }));
document.querySelectorAll('.side-nav [data-filter]').forEach((button) => button.addEventListener('click', () => { state.category = button.dataset.filter; document.querySelectorAll('.side-nav .nav-item').forEach((item) => item.classList.toggle('active', item === button)); document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.toggle('selected', tab.dataset.filter === 'all')); state.filter = 'all'; render(); }));
grid.addEventListener('click', (event) => { const toggle = event.target.closest('button[data-device-id]'); if (toggle) toggleDevice(toggle.dataset.deviceId); });
grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-hide-device-id]');
  if (!button) return;
  const deviceId = button.dataset.hideDeviceId;
  if (state.hidden.has(deviceId)) state.hidden.delete(deviceId);
  else state.hidden.add(deviceId);
  localStorage.setItem(STORAGE_KEYS.hidden, JSON.stringify([...state.hidden]));
  render();
  showToast(state.hidden.has(deviceId) ? 'Apparaat verborgen.' : 'Apparaat teruggezet.');
});
$('#toggle-hidden-devices').addEventListener('click', () => { state.showHidden = !state.showHidden; render(); });
grid.addEventListener('change', (event) => { const picker = event.target.closest('[data-color-device]'); if (picker) setDeviceColor(picker.dataset.colorDevice, picker.value); });
function openSettings() {
  const api = configuredApi();
  $('#api-url').value = api.url;
  $('#api-token').value = api.token;
  $('#spotify-link').value = localStorage.getItem('thuis-spotify-embed-link') || '';
  $('#settings-error').hidden = true;
  dialog.showModal();
}
$('#open-settings').addEventListener('click', openSettings);
$('#open-settings-side').addEventListener('click', openSettings);
$('.dialog-close-row button').addEventListener('click', () => dialog.close());
$('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = $('#api-url').value.trim().replace(/\/$/, '');
  const token = $('#api-token').value.trim();
  const spotifyLink = $('#spotify-link').value.trim();
  const errorBox = $('#settings-error');
  if (Boolean(url) !== Boolean(token)) { errorBox.textContent = 'Vul voor Tuya zowel de Worker URL als het dashboard-token in, of laat beide leeg.'; errorBox.hidden = false; return; }
  if (spotifyLink && !window.spotifyEmbedIntegration?.parseLink(spotifyLink)) { errorBox.textContent = 'Vul een geldige Spotify-link naar een nummer, album of playlist in.'; errorBox.hidden = false; return; }
  if (url) { localStorage.setItem(STORAGE_KEYS.url, url); localStorage.setItem(STORAGE_KEYS.token, token); }
  else { localStorage.removeItem(STORAGE_KEYS.url); localStorage.removeItem(STORAGE_KEYS.token); }
  if (spotifyLink) localStorage.setItem('thuis-spotify-embed-link', spotifyLink);
  else localStorage.removeItem('thuis-spotify-embed-link');
  errorBox.hidden = true;
  await loadDevices();
  window.spotifyEmbedIntegration?.refresh();
  dialog.close();
});
$('#disconnect-button').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEYS.url); localStorage.removeItem(STORAGE_KEYS.token); dialog.close(); loadDevices(); showToast('Tuya-verbinding gewist.'); });
$('#spotify-disconnect').addEventListener('click', () => { $('#spotify-link').value = ''; window.spotifyEmbedIntegration?.clear(); showToast('Spotify-link gewist.'); });
$('#kiosk-button').addEventListener('click', async () => {
  document.body.classList.toggle('kiosk-mode');
  if (!document.fullscreenElement) {
    try { await document.documentElement.requestFullscreen(); } catch { showToast('Volledig scherm niet beschikbaar op dit apparaat.'); }
  } else await document.exitFullscreen();
});
document.addEventListener('fullscreenchange', () => document.body.classList.toggle('kiosk-mode', Boolean(document.fullscreenElement)));
setDate();
window.setInterval(setDate, 15_000);
loadDevices();
const DEMO_DEVICES = [
  { id: 'demo-ceiling', name: 'Plafondlamp', room: 'Woonkamer', category: 'light', online: true, on: true, switchCode: 'switch_led' },
  { id: 'demo-corner', name: 'Leeslamp', room: 'Woonkamer', category: 'light', online: true, on: false, switchCode: 'switch_led' },
  { id: 'demo-coffee', name: 'Koffiehoek', room: 'Keuken', category: 'plug', online: true, on: true, switchCode: 'switch_1' },
  { id: 'demo-hall', name: 'Slimme stekker', room: 'Hal', category: 'plug', online: true, on: false, switchCode: 'switch_1' },
];
const STORAGE_KEYS = { url: 'thuis-api-url', token: 'thuis-api-token' };
const state = { devices: DEMO_DEVICES.map((device) => ({ ...device })), filter: 'all', category: 'all', query: '', connected: false, busy: new Set() };
const $ = (selector) => document.querySelector(selector);
const grid = $('#device-grid');
const dialog = $('#settings-dialog');
const iconFor = (device) => device.category === 'plug' ? '#i-plug' : device.category === 'sensor' ? '#i-thermo' : '#i-light';
let toastTimer;

function configuredApi() { return { url: localStorage.getItem(STORAGE_KEYS.url) || '', token: localStorage.getItem(STORAGE_KEYS.token) || '' }; }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('visible'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2800); }
function setConnection(connected, detail) { state.connected = connected; $('#connection-dot').classList.toggle('connected', connected); $('#connection-label').textContent = connected ? 'Tuya verbonden' : 'Demomodus'; $('#connection-detail').textContent = detail; $('.connection-wifi').style.color = connected ? '#7bd39a' : ''; }
function categoryLabel(category) { if (category === 'plug') return 'Stekker'; if (category === 'sensor') return 'Sensor'; if (category === 'light') return 'Lamp'; return category || 'Apparaat'; }
function deviceCountLabel(count) { return `${count} ${count === 1 ? 'apparaat' : 'apparaten'}`; }

function render() {
  const visible = state.devices.filter((device) => {
    const matchesQuery = `${device.name} ${device.room} ${device.category}`.toLowerCase().includes(state.query.toLowerCase());
    return matchesQuery && (state.filter !== 'on' || device.on) && (state.category === 'all' || device.category === state.category);
  });
  grid.innerHTML = visible.map((device, index) => {
    const statusText = device.online === false ? 'Niet bereikbaar' : device.on ? 'Ingeschakeld' : 'Uitgeschakeld';
    const controllable = Boolean(device.switchCode);
    return `<article class="device-card${device.on ? ' is-on' : ''}" style="animation-delay:${index * 45}ms"><span class="device-icon ${device.category || 'light'}"><svg><use href="${iconFor(device)}"/></svg></span><div class="device-info"><strong>${escapeHtml(device.name)}</strong><span>${escapeHtml(device.room || categoryLabel(device.category))}</span><small class="device-state"><span class="tiny-dot"></span>${statusText}</small></div>${controllable ? `<div class="device-control"><small>${device.on ? 'Aan' : 'Uit'}</small><button class="toggle" type="button" role="switch" aria-checked="${Boolean(device.on)}" aria-label="${escapeHtml(device.name)} ${device.on ? 'uitschakelen' : 'inschakelen'}" data-device-id="${escapeHtml(device.id)}" ${device.online === false || state.busy.has(device.id) ? 'disabled' : ''}></button></div>` : '<span class="device-control"><small>Alleen status</small></span>'}</article>`;
  }).join('');
  $('#empty-state').hidden = visible.length > 0;
  grid.hidden = visible.length === 0;
  const online = state.devices.filter((device) => device.online !== false).length;
  const active = state.devices.filter((device) => device.on).length;
  $('#total-count').textContent = state.devices.length;
  $('#nav-device-count').textContent = state.devices.length;
  $('#online-count').textContent = `${deviceCountLabel(online)} online`;
  $('#active-count').textContent = active;
  $('#heading-count').textContent = String(state.devices.length).padStart(2, '0');
  $('#home-status').textContent = state.devices.length > 0 && online === state.devices.length ? 'Alles rustig' : 'Controleer apparaten';
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

function setDate() { $('#today').textContent = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()); }
$('#device-search').addEventListener('input', (event) => { state.query = event.target.value.trim(); render(); });
document.querySelectorAll('.filter-tab').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.toggle('selected', tab === button)); render(); }));
document.querySelectorAll('.side-nav [data-filter]').forEach((button) => button.addEventListener('click', () => { state.category = button.dataset.filter; document.querySelectorAll('.side-nav .nav-item').forEach((item) => item.classList.toggle('active', item === button)); document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.toggle('selected', tab.dataset.filter === 'all')); state.filter = 'all'; render(); }));
grid.addEventListener('click', (event) => { const toggle = event.target.closest('[data-device-id]'); if (toggle) toggleDevice(toggle.dataset.deviceId); });
$('#open-settings').addEventListener('click', () => { const api = configuredApi(); $('#api-url').value = api.url; $('#api-token').value = api.token; $('#settings-error').hidden = true; dialog.showModal(); });
$('.dialog-close-row button').addEventListener('click', () => dialog.close());
$('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = $('#api-url').value.trim().replace(/\/$/, '');
  const token = $('#api-token').value.trim();
  const errorBox = $('#settings-error');
  if (!url || !token) { errorBox.textContent = 'Vul zowel de Worker URL als het dashboard-token in.'; errorBox.hidden = false; return; }
  localStorage.setItem(STORAGE_KEYS.url, url); localStorage.setItem(STORAGE_KEYS.token, token); errorBox.hidden = true;
  await loadDevices();
  if (state.connected) dialog.close();
});
$('#disconnect-button').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEYS.url); localStorage.removeItem(STORAGE_KEYS.token); dialog.close(); loadDevices(); showToast('Tuya-verbinding gewist.'); });
setDate();
loadDevices();
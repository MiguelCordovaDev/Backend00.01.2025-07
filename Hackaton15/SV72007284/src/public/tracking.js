let socket;
let currentUser;
let currentTracking;

document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  initSocket();
  loadMyPackages();
});

async function loadUser() {
  const res = await fetch('/auth/me', { credentials: 'include' });
  if (!res.ok) { location.href = '/login.html'; return; }
  currentUser = await res.json();
  const el = document.getElementById('userName');
  el.textContent = `${currentUser.displayName || currentUser.username} (${currentUser.role})`;
}

function initSocket() {
  socket = io({ transports: ['websocket'], upgrade: false });

  socket.on('connect', () => console.log('Socket conectado'));
  socket.on('location:updated', (data) => {
    if (data.tracking === currentTracking) updateTimeline();
  });
  socket.on('status:updated', (data) => {
    if (data.tracking === currentTracking) trackPackage();
  });
  socket.on('message:received', (data) => {
    if (data.tracking === currentTracking) appendMessage(data);
  });
  socket.on('error', (e) => console.error('Socket error:', e));
}

function showTab(name) {
  document.getElementById('tab-create').style.display = (name === 'create') ? '' : 'none';
  document.getElementById('tab-my').style.display = (name === 'my') ? '' : 'none';
  document.getElementById('tab-track').style.display = (name === 'track') ? '' : 'none';
  if (name === 'my') loadMyPackages();
}

async function createPackage() {
  const form = document.getElementById('formCreate');
  const data = Object.fromEntries(new FormData(form).entries());

  const res = await fetch('/api/packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  const json = await res.json();
  const alert = document.getElementById('alertCreate');
  if (res.ok) {
    alert.innerHTML = `<div style="color:green">Paquete creado. Tracking: ${json.tracking_number}</div>`;
    form.reset();
    loadMyPackages();
  } else {
    alert.innerHTML = `<div style="color:#b91c1c">Error: ${json.error}</div>`;
  }
  setTimeout(() => alert.innerHTML = '', 5000);
}

async function loadMyPackages() {
  const res = await fetch('/api/packages/my-packages', { credentials: 'include' });
  const list = document.getElementById('listMy');
  if (!res.ok) { list.innerHTML = 'No se pudo cargar.'; return; }
  const data = await res.json();
  list.innerHTML = (data || []).map(p => `
    <div class="pkg" onclick="viewPackage('${p.tracking_number}')">
      <div><strong>${p.tracking_number}</strong></div>
      <div>${p.receiver_name}</div>
      <div><span class="status">${p.status.replaceAll('_',' ')}</span></div>
      <div style="color:#6b7280;font-size:12px">Creado: ${new Date(p.created_at).toLocaleString()}</div>
    </div>
  `).join('') || '<div>No hay paquetes</div>';
}

function viewPackage(tracking) {
  document.getElementById('trackingInput').value = tracking;
  showTab('track');
  trackPackage();
}

async function trackPackage() {
  const tracking = document.getElementById('trackingInput').value.trim();
  if (!tracking) return;
  currentTracking = tracking;

  const res = await fetch(`/api/packages/track/${tracking}`, { credentials: 'include' });
  if (!res.ok) { alert('Paquete no encontrado o no autorizado'); return; }
  const pkg = await res.json();

  document.getElementById('pkgInfo').innerHTML = `
    <div><strong>Tracking:</strong> ${pkg.tracking_number}</div>
    <div><strong>Estado:</strong> <span class="status">${pkg.status.replaceAll('_',' ')}</span></div>
    <div><strong>Destinatario:</strong> ${pkg.receiver_name}</div>
    <div><strong>Dirección:</strong> ${pkg.receiver_address}</div>
    ${pkg.description ? `<div><strong>Descripción:</strong> ${pkg.description}</div>` : ''}
  `;

  await updateTimeline();
  await loadMessages();

  socket.emit('track:join', tracking);
  document.getElementById('trackingResult').style.display = '';
}

async function updateTimeline() {
  const res = await fetch(`/api/packages/${currentTracking}/locations`, { credentials: 'include' });
  const locs = res.ok ? await res.json() : [];
  document.getElementById('timeline').innerHTML = locs.map(l => `
    <div class="item">
      <div><strong>${l.location_name || 'Actualización'}</strong></div>
      ${l.description ? `<div>${l.description}</div>` : ''}
      ${l.latitude && l.longitude ? `<div>📍 ${l.latitude}, ${l.longitude}</div>` : ''}
      <div style="color:#6b7280;font-size:12px">${new Date(l.created_at).toLocaleString()}</div>
    </div>
  `).join('') || '<div>Sin ubicaciones</div>';
}

async function loadMessages() {
  const res = await fetch(`/api/packages/${currentTracking}/messages`, { credentials: 'include' });
  const msgs = res.ok ? await res.json() : [];
  const box = document.getElementById('msgs');
  box.innerHTML = '';
  msgs.forEach(appendMessage);
}

function appendMessage(msg) {
  const box = document.getElementById('msgs');
  const own = msg.sender_id === currentUser.id;
  const div = document.createElement('div');
  div.style.margin = '8px 0';
  div.style.textAlign = own ? 'right' : 'left';
  div.innerHTML = `
    <div style="display:inline-block;padding:8px 12px;border-radius:12px;background:${own ? '#4f46e5':'#f3f4f6'};color:${own ? '#fff':'#111827'}">
      ${msg.sender_username ? `<strong>${msg.sender_username}</strong><br>` : ''}
      ${msg.message}
      <div style="font-size:11px;opacity:.7">${new Date(msg.created_at || msg.timestamp).toLocaleTimeString()}</div>
    </div>
  `;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text || !currentTracking) return;
  socket.emit('message:send', { tracking: currentTracking, message: text });
  input.value = '';
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  location.href = '/login.html';
}
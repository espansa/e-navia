// ==========================================
// FILE: js/app.js
// ==========================================
let CURRENT_USER = null;
let APP_CACHE = {};

const ROLE_MENUS = {
  'Admin': [
    { id: 'admin-dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'admin-users', label: 'Manajemen Pengguna', icon: 'users' },
    { id: 'admin-akademik', label: 'Master Akademik', icon: 'graduation-cap' },
    { id: 'admin-monitoring', label: 'Monitoring Belajar', icon: 'book-open-check' },
    { id: 'admin-laporan', label: 'Laporan & Rekap', icon: 'bar-chart-3' },
    { id: 'admin-log', label: 'Log Aktivitas', icon: 'activity' },
    { id: 'admin-pengaturan', label: 'Pengaturan Platform', icon: 'settings' }
  ],
  'Guru': [
    { id: 'guru-dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'guru-absensi', label: 'Absensi & Jurnal', icon: 'clipboard-check' },
    { id: 'guru-materi', label: 'Materi Pembelajaran', icon: 'book-open' },
    { id: 'guru-tugas', label: 'Tugas & Kuis', icon: 'file-question' },
    { id: 'guru-penilaian', label: 'Penilaian Tugas', icon: 'check-square' },
    { id: 'guru-buku-nilai', label: 'Buku Nilai & Rekap', icon: 'award' }
  ],
  'Siswa': [
    { id: 'siswa-beranda', label: 'Beranda', icon: 'home' },
    { id: 'siswa-materi', label: 'Materi Belajar', icon: 'book-open' },
    { id: 'siswa-tugas', label: 'Tugas & Kuis Saya', icon: 'clipboard-list' },
    { id: 'siswa-nilai', label: 'Transkrip & Absensi', icon: 'award' },
    { id: 'siswa-profil', label: 'Profil Saya', icon: 'user-circle' }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  const savedSession = sessionStorage.getItem('ENAVIA_SESSION');
  if (savedSession) {
    CURRENT_USER = JSON.parse(savedSession);
    initAppShell();
  }
});

function togglePasswordVisibility() {
  const input = document.getElementById('login-password');
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('btn-login');
  const alertBox = document.getElementById('login-alert');

  alertBox.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> Memverifikasi...';

  const res = await callBackendAPI('loginUser', { username, password });

  btn.disabled = false;
  btn.innerHTML = '<span>Masuk ke Platform</span><i data-lucide="arrow-right" class="w-4 h-4"></i>';
  lucide.createIcons();

  if (res.success) {
    CURRENT_USER = res.user;
    sessionStorage.setItem('ENAVIA_SESSION', JSON.stringify(res.user));
    initAppShell();
    showToast('Selamat datang, ' + res.user.nama + '!', 'success');
  } else {
    document.getElementById('login-alert-text').textContent = res.message;
    alertBox.classList.remove('hidden');
  }
}

function initAppShell() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  const initials = CURRENT_USER.nama.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('topbar-avatar').textContent = initials;
  document.getElementById('sidebar-user-name').textContent = CURRENT_USER.nama;
  document.getElementById('topbar-user-name').textContent = CURRENT_USER.nama;
  document.getElementById('sidebar-user-role').textContent = CURRENT_USER.role + (CURRENT_USER.kelas !== '-' ? ' • ' + CURRENT_USER.kelas : '');

  renderSidebarMenu();
  const defaultPage = ROLE_MENUS[CURRENT_USER.role][0].id;
  if (typeof navigateTo === 'function') {
    navigateTo(defaultPage);
  }
}

function renderSidebarMenu() {
  const container = document.getElementById('sidebar-menu');
  const menus = ROLE_MENUS[CURRENT_USER.role] || [];
  container.innerHTML = menus.map(m => `
    <div id="menu-${m.id}" onclick="navigateTo('${m.id}')" class="nav-item">
      <i data-lucide="${m.icon}" class="w-4 h-4 shrink-0"></i>
      <span>${m.label}</span>
    </div>
  `).join('');
  lucide.createIcons();
}

function logoutUser() {
  sessionStorage.removeItem('ENAVIA_SESSION');
  CURRENT_USER = null;
  APP_CACHE = {};
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-password').value = '';
}

function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('-translate-x-full');
  document.getElementById('mobile-overlay').classList.toggle('hidden');
}

function openModal(title, htmlContent) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = htmlContent;
  const modal = document.getElementById('universal-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
}

function closeModal() {
  const modal = document.getElementById('universal-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-[#142C50]';
  const el = document.createElement('div');
  el.className = `${bg} text-white px-4 py-3 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 transition-all`;
  el.innerHTML = `<span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function renderSkeleton() {
  document.getElementById('main-content').innerHTML = `
    <div class="space-y-6">
      <div class="h-8 w-64 skeleton"></div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="h-28 skeleton"></div><div class="h-28 skeleton"></div>
        <div class="h-28 skeleton"></div><div class="h-28 skeleton"></div>
      </div>
      <div class="h-72 skeleton"></div>
    </div>
  `;
}

function compressImageToBase64(file, maxWidth = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
  });
}

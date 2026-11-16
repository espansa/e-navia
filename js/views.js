// ==========================================
// FILE: js/views.js (Modular UI: Admin, Guru, Siswa)
// ==========================================
 
let ACTIVE_PAGE = '';
let QUIZ_TIMER_INTERVAL = null;

async function navigateTo(pageId) {
  ACTIVE_PAGE = pageId;
  if (QUIZ_TIMER_INTERVAL) clearInterval(QUIZ_TIMER_INTERVAL);

  // Highlight Menu Sidebar
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById('menu-' + pageId);
  if (activeNav) activeNav.classList.add('active');

  // Tutup sidebar mobile jika terbuka
  const sidebar = document.getElementById('sidebar');
  if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
    toggleMobileSidebar();
  }

  renderSkeleton();

  // Routing Tampilan Berdasarkan Role
  if (pageId.startsWith('admin-')) {
    if (!APP_CACHE.adminData) {
      const [stats, full] = await Promise.all([
        callBackendAPI('getAdminDashboardStats'),
        callBackendAPI('getAdminFullData')
      ]);
      APP_CACHE.adminStats = stats;
      APP_CACHE.adminData = full;
    }
    renderAdminView(pageId);
  } else if (pageId.startsWith('guru-')) {
    if (!APP_CACHE.guruData) {
      APP_CACHE.guruData = await callBackendAPI('getGuruInitialData', { idGuru: CURRENT_USER.id });
    }
    renderGuruView(pageId);
  } else if (pageId.startsWith('siswa-')) {
    if (!APP_CACHE.siswaData) {
      APP_CACHE.siswaData = await callBackendAPI('getSiswaDashboardData', {
        idSiswa: CURRENT_USER.id,
        kelas: CURRENT_USER.kelas
      });
    }
    renderSiswaView(pageId);
  }

  lucide.createIcons();
}

async function refreshCurrentView() {
  APP_CACHE = {};
  await navigateTo(ACTIVE_PAGE);
}

// =========================================================================
// 1. MODUL ADMIN
// =========================================================================
function renderAdminView(pageId) {
  const main = document.getElementById('main-content');
  const stats = APP_CACHE.adminStats || {};
  const data = APP_CACHE.adminData || { users: [], akademik: [], mapel: [], materi: [], tugas: [], logs: [], pengumuman: [] };

  if (pageId === 'admin-dashboard') {
    const kelasTanpaWali = data.akademik.filter(k => !k.waliKelas || k.waliKelas === '-');
    main.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-extrabold text-[#142C50]">Dashboard Administrator</h1>
            <p class="text-xs text-slate-500">Ringkasan operasional digital learning ${APP_CONFIG.SCHOOL_NAME}</p>
          </div>
          <button onclick="openModalPengumuman()" class="inline-flex items-center gap-2 px-4 py-2.5 bg-[#258BD8] hover:bg-[#1D70B8] text-white text-xs font-semibold rounded-xl shadow-sm transition">
            <i data-lucide="megaphone" class="w-4 h-4"></i> Buat Pengumuman
          </button>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
          ${kpiCard('Total Siswa', stats.totalSiswa || 0, 'users', 'bg-blue-50 text-[#258BD8]')}
          ${kpiCard('Total Guru', stats.totalGuru || 0, 'user-check', 'bg-cyan-50 text-[#38BBD1]')}
          ${kpiCard('Rombel Kelas', stats.totalKelas || 0, 'school', 'bg-amber-50 text-[#F2B84B]')}
          ${kpiCard('Mata Pelajaran', stats.totalMapel || 0, 'book', 'bg-indigo-50 text-indigo-600')}
          ${kpiCard('Materi Terbit', stats.totalMateri || 0, 'layers', 'bg-emerald-50 text-emerald-600')}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Grafik Aktivitas -->
          <div class="card-enavia p-6 lg:col-span-2">
            <h3 class="font-bold text-sm text-[#142C50] mb-4">Statistik Konten & Pengguna Aktif</h3>
            <canvas id="adminChart" height="120"></canvas>
          </div>

          <!-- Perlu Tindak Lanjut & Pengumuman -->
          <div class="space-y-4">
            <div class="card-enavia p-5 border-l-4 border-l-[#F2B84B]">
              <h3 class="font-bold text-sm text-[#142C50] flex items-center gap-2 mb-2">
                <i data-lucide="alert-triangle" class="w-4 h-4 text-[#F2B84B]"></i> Perlu Tindak Lanjut
              </h3>
              <p class="text-xs text-slate-600">
                ${kelasTanpaWali.length > 0
                  ? `Terdapat <b>${kelasTanpaWali.length} kelas</b> yang belum memiliki wali kelas.`
                  : 'Seluruh kelas sudah memiliki wali kelas dan siap beroperasi.'}
              </p>
            </div>

            <div class="card-enavia p-5">
              <h3 class="font-bold text-sm text-[#142C50] mb-3">Pengumuman Terbaru</h3>
              <div class="space-y-3">
                ${data.pengumuman.slice(0, 3).map(p => `
                  <div class="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-[#258BD8]">${p.kategori}</span>
                    <h4 class="text-xs font-bold text-slate-800 mt-1">${p.judul}</h4>
                    <p class="text-[11px] text-slate-500 mt-0.5 line-clamp-2">${p.isi}</p>
                  </div>
                `).join('') || '<p class="text-xs text-slate-400">Belum ada pengumuman.</p>'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render Chart.js
    const ctx = document.getElementById('adminChart');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Siswa Aktif', 'Guru Aktif', 'Kelas', 'Mata Pelajaran', 'Materi', 'Tugas/Kuis'],
          datasets: [{
            label: 'Jumlah Data Sistem',
            data: [stats.totalSiswa, stats.totalGuru, stats.totalKelas, stats.totalMapel, stats.totalMateri, data.tugas.length],
            backgroundColor: ['#258BD8', '#38BBD1', '#F2B84B', '#142C50', '#10B981', '#6366F1'],
            borderRadius: 8
          }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }
  }

  else if (pageId === 'admin-users') {
    main.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-extrabold text-[#142C50]">Manajemen Pengguna</h1>
            <p class="text-xs text-slate-500">Kelola akun Administrator, Guru, dan Siswa</p>
          </div>
          <div class="flex gap-2">
            <button onclick="openModalImportUsers()" class="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition">
              <i data-lucide="upload" class="w-4 h-4"></i> Import Massal
            </button>
            <button onclick="openModalTambahUser()" class="inline-flex items-center gap-2 px-4 py-2.5 bg-[#258BD8] hover:bg-[#1D70B8] text-white text-xs font-semibold rounded-xl shadow-sm transition">
              <i data-lucide="user-plus" class="w-4 h-4"></i> Tambah Akun
            </button>
          </div>
        </div>

        <div class="card-enavia overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 justify-between">
            <input type="text" id="filter-user-search" onkeyup="filterUserTable()" placeholder="Cari nama atau NIP/NIS..." class="px-3.5 py-2 text-xs border border-slate-200 rounded-xl w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-[#258BD8]">
            <select id="filter-user-role" onchange="filterUserTable()" class="px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white">
              <option value="">Semua Peran</option>
              <option value="Siswa">Siswa</option>
              <option value="Guru">Guru</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th class="px-4 py-3">NIP / NIS</th>
                  <th class="px-4 py-3">Nama Lengkap</th>
                  <th class="px-4 py-3">Peran</th>
                  <th class="px-4 py-3">Kelas / Unit</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody id="tbody-users" class="divide-y divide-slate-100">
                ${data.users.map(u => `
                  <tr class="hover:bg-slate-50/70 user-row" data-name="${u.nama.toLowerCase()} ${u.nip_nis}" data-role="${u.role}">
                    <td class="px-4 py-3 font-mono text-slate-600">${u.nip_nis}</td>
                    <td class="px-4 py-3 font-semibold text-slate-800">${u.nama}<br><span class="text-[10px] font-normal text-slate-400">${u.email}</span></td>
                    <td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full text-[11px] font-semibold ${u.role === 'Admin' ? 'bg-purple-100 text-purple-700' : u.role === 'Guru' ? 'bg-cyan-100 text-cyan-800' : 'bg-blue-100 text-blue-700'}">${u.role}</span></td>
                    <td class="px-4 py-3 font-medium">${u.kelas}</td>
                    <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[11px] font-semibold ${u.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${u.status}</span></td>
                    <td class="px-4 py-3 text-right space-x-1">
                      <button onclick="handleUserAction('${u.id}', 'reset_pass')" title="Reset Password ke 123456" class="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100"><i data-lucide="key" class="w-3.5 h-3.5"></i></button>
                      <button onclick="handleUserAction('${u.id}', 'toggle_status')" title="Aktif/Nonaktifkan" class="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"><i data-lucide="power" class="w-3.5 h-3.5"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  else if (pageId === 'admin-akademik') {
    const guruList = data.users.filter(u => u.role === 'Guru' && u.status === 'Aktif');
    main.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-extrabold text-[#142C50]">Master Akademik & Kenaikan Kelas</h1>
            <p class="text-xs text-slate-500">Atur rombongan belajar, mata pelajaran, dan kenaikan kelas massal</p>
          </div>
          <button onclick="openModalKenaikanKelas()" class="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F2B84B] hover:bg-amber-500 text-[#142C50] text-xs font-bold rounded-xl shadow-sm transition">
            <i data-lucide="trending-up" class="w-4 h-4"></i> Kenaikan Kelas Massal
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Daftar Kelas -->
          <div class="card-enavia p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-sm text-[#142C50]">Daftar Rombongan Belajar</h3>
              <button onclick="openModalTambahKelas()" class="text-xs font-semibold text-[#258BD8] hover:underline">+ Tambah Kelas</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 text-slate-500 border-b">
                  <tr><th class="p-2.5">Kelas</th><th class="p-2.5">Tapel / Sem</th><th class="p-2.5">Wali Kelas</th></tr>
                </thead>
                <tbody class="divide-y">
                  ${data.akademik.map(k => `
                    <tr>
                      <td class="p-2.5 font-bold text-[#142C50]">${k.namaKelas}</td>
                      <td class="p-2.5 text-slate-500">${k.tapel} (${k.semester})</td>
                      <td class="p-2.5">${k.waliKelas}</td>
                    </tr>
                  `).join('') || '<tr><td colspan="3" class="p-4 text-center text-slate-400">Belum ada data kelas.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Daftar Mata Pelajaran -->
          <div class="card-enavia p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-sm text-[#142C50]">Pemetaan Mata Pelajaran</h3>
              <button onclick="openModalTambahMapel()" class="text-xs font-semibold text-[#258BD8] hover:underline">+ Tambah Mapel</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 text-slate-500 border-b">
                  <tr><th class="p-2.5">Kode</th><th class="p-2.5">Mata Pelajaran</th><th class="p-2.5">Guru Pengampu</th><th class="p-2.5">Kelas</th></tr>
                </thead>
                <tbody class="divide-y">
                  ${data.mapel.map(m => {
                    const g = guruList.find(x => x.id === m.idGuru);
                    return `
                      <tr>
                        <td class="p-2.5 font-mono font-semibold">${m.kode}</td>
                        <td class="p-2.5 font-semibold text-slate-800">${m.nama}</td>
                        <td class="p-2.5 text-slate-600">${g ? g.nama : m.idGuru}</td>
                        <td class="p-2.5"><span class="px-2 py-0.5 bg-blue-50 text-[#258BD8] rounded font-medium">${m.kelasTarget}</span></td>
                      </tr>
                    `;
                  }).join('') || '<tr><td colspan="4" class="p-4 text-center text-slate-400">Belum ada mata pelajaran.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  else if (pageId === 'admin-monitoring' || pageId === 'admin-laporan') {
    main.innerHTML = `
      <div class="space-y-6">
        <h1 class="text-2xl font-extrabold text-[#142C50]">${pageId === 'admin-monitoring' ? 'Monitoring Pembelajaran' : 'Laporan & Rekapitulasi Sekolah'}</h1>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card-enavia p-5">
            <h3 class="font-bold text-sm text-[#142C50] mb-3">Materi Diterbitkan Guru (${data.materi.length})</h3>
            <div class="space-y-2 max-h-96 overflow-y-auto">
              ${data.materi.map(m => `
                <div class="p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                  <div><p class="font-bold text-slate-800">${m.judul}</p><p class="text-slate-400">${m.kodeMapel} • Kelas ${m.kelas}</p></div>
                  <span class="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold">${m.status}</span>
                </div>
              `).join('') || '<p class="text-xs text-slate-400">Belum ada materi.</p>'}
            </div>
          </div>
          <div class="card-enavia p-5">
            <h3 class="font-bold text-sm text-[#142C50] mb-3">Tugas & Kuis Berjalan (${data.tugas.length})</h3>
            <div class="space-y-2 max-h-96 overflow-y-auto">
              ${data.tugas.map(t => `
                <div class="p-3 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                  <div><p class="font-bold text-slate-800">${t.judul}</p><p class="text-slate-400">${t.jenis} • Kelas ${t.kelas}</p></div>
                  <span class="text-slate-500 font-mono">DL: ${t.deadline}</span>
                </div>
              `).join('') || '<p class="text-xs text-slate-400">Belum ada tugas.</p>'}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  else if (pageId === 'admin-log') {
    main.innerHTML = `
      <div class="space-y-6">
        <h1 class="text-2xl font-extrabold text-[#142C50]">Log Aktivitas & Audit Sistem</h1>
        <div class="card-enavia overflow-hidden">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-500 border-b">
              <tr><th class="p-3.5">Waktu</th><th class="p-3.5">Pengguna</th><th class="p-3.5">Peran</th><th class="p-3.5">Aktivitas</th><th class="p-3.5">Objek</th></tr>
            </thead>
            <tbody class="divide-y">
              ${data.logs.map(l => `
                <tr>
                  <td class="p-3.5 font-mono text-slate-500">${l.waktu}</td>
                  <td class="p-3.5 font-semibold">${l.user}</td>
                  <td class="p-3.5">${l.role}</td>
                  <td class="p-3.5 text-[#258BD8] font-medium">${l.aktivitas}</td>
                  <td class="p-3.5 text-slate-600">${l.objek}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  else if (pageId === 'admin-pengaturan') {
    main.innerHTML = `
      <div class="max-w-xl space-y-6">
        <h1 class="text-2xl font-extrabold text-[#142C50]">Pengaturan Identitas Platform</h1>
        <div class="card-enavia p-6 space-y-4 text-xs">
          <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50">
            <img src="${APP_CONFIG.LOGO_PATH}" class="w-14 h-14 object-contain">
            <div>
              <h3 class="font-bold text-base text-[#142C50]">${APP_CONFIG.APP_NAME}</h3>
              <p class="text-slate-500">${APP_CONFIG.SCHOOL_NAME}</p>
            </div>
          </div>
          <div><label class="font-semibold block mb-1">Endpoint Backend API</label><input type="text" readonly value="${APP_CONFIG.API_URL}" class="w-full p-2.5 bg-slate-100 rounded-xl text-slate-500 font-mono"></div>
          <div><label class="font-semibold block mb-1">Tahun Pelajaran Aktif</label><input type="text" readonly value="${APP_CONFIG.TAHUN_PELAJARAN}" class="w-full p-2.5 bg-slate-100 rounded-xl text-slate-700 font-semibold"></div>
          <p class="text-slate-400 italic">* Perubahan konfigurasi global dapat disesuaikan pada file <code>js/config.js</code> di repositori GitHub.</p>
        </div>
      </div>
    `;
  }
}

// =========================================================================
// 2. MODUL GURU
// =========================================================================
function renderGuruView(pageId) {
  const main = document.getElementById('main-content');
  const gData = APP_CACHE.guruData || { stats: {}, mapel: [], materi: [], tugas: [] };

  if (pageId === 'guru-dashboard') {
    main.innerHTML = `
      <div class="space-y-6">
        <div>
          <h1 class="text-2xl font-extrabold text-[#142C50]">Halo, ${CURRENT_USER.nama}</h1>
          <p class="text-xs text-slate-500">Panel Kendali Pembelajaran & Penilaian Guru</p>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          ${kpiCard('Materi Saya', gData.stats.materiSaya || 0, 'book-open', 'bg-blue-50 text-[#258BD8]')}
          ${kpiCard('Tugas & Kuis', gData.stats.tugasAktif || 0, 'file-text', 'bg-cyan-50 text-[#38BBD1]')}
          ${kpiCard('Siswa Diampu', gData.stats.totalSiswa || 0, 'users', 'bg-amber-50 text-[#F2B84B]')}
          ${kpiCard('Rata-rata Nilai', gData.stats.rataRataNilai || 0, 'award', 'bg-emerald-50 text-emerald-600')}
        </div>

        <div class="card-enavia p-6">
          <h3 class="font-bold text-sm text-[#142C50] mb-4">Mata Pelajaran yang Anda Ampu</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${gData.mapel.map(m => `
              <div class="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-[#142C50] text-white">${m.kode}</span>
                  <h4 class="font-bold text-sm text-slate-800 mt-1">${m.nama}</h4>
                  <p class="text-xs text-slate-500 mt-0.5">Kelas Target: <b>${m.kelasTarget.join(', ')}</b></p>
                </div>
                <div class="text-right text-[11px] text-slate-500">
                  <p>Bobot Nilai:</p>
                  <p class="font-bold text-[#258BD8]">${m.bobot.replace(/,/g, '% / ')}%</p>
                </div>
              </div>
            `).join('') || '<p class="text-xs text-slate-400">Admin belum memetakan mata pelajaran ke akun Anda.</p>'}
          </div>
        </div>
      </div>
    `;
  }

  else if (pageId === 'guru-absensi') {
    const tglHariIni = new Date().toISOString().split('T')[0];
    main.innerHTML = `
      <div class="space-y-6">
        <div>
          <h1 class="text-2xl font-extrabold text-[#142C50]">Absensi Kelas & Jurnal Mengajar</h1>
          <p class="text-xs text-slate-500">Catat kehadiran siswa per pertemuan (otomatis terhubung ke Buku Nilai)</p>
        </div>

        <div class="card-enavia p-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label class="font-semibold block mb-1">Mata Pelajaran</label>
              <select id="absen-mapel" onchange="updateKelasDropdown('absen-mapel', 'absen-kelas')" class="w-full p-2.5 border rounded-xl bg-white">
                ${gData.mapel.map(m => `<option value="${m.kode}">${m.nama}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="font-semibold block mb-1">Kelas</label>
              <select id="absen-kelas" class="w-full p-2.5 border rounded-xl bg-white">
                ${(gData.mapel[0]?.kelasTarget || []).map(k => `<option value="${k}">${k}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="font-semibold block mb-1">Tanggal Pertemuan</label>
              <input type="date" id="absen-tanggal" value="${tglHariIni}" class="w-full p-2.5 border rounded-xl">
            </div>
          </div>
          <button onclick="muatDaftarSiswaAbsensi()" class="px-4 py-2 bg-[#142C50] text-white text-xs font-semibold rounded-xl">Muat Daftar Siswa</button>

          <div id="absen-sheet-container" class="pt-4 border-t border-slate-100 hidden"></div>
        </div>
      </div>
    `;
  }

  else if (pageId === 'guru-materi') {
    main.innerHTML = `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-extrabold text-[#142C50]">Materi Pembelajaran</h1>
            <p class="text-xs text-slate-500">Bagikan ringkasan materi, video YouTube, atau dokumen Google Drive</p>
          </div>
          <button onclick="openModalTambahMateri()" class="px-4 py-2.5 bg-[#258BD8] text-white text-xs font-semibold rounded-xl flex items-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i> Buat Materi Baru
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${gData.materi.map(m => `
            <div class="card-enavia p-5 space-y-2">
              <div class="flex justify-between items-start">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#258BD8]">${m.kodeMapel} • Kelas ${m.kelas}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${m.status === 'Terbit' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">${m.status}</span>
              </div>
              <h3 class="font-bold text-base text-[#142C50]">${m.judul}</h3>
              <p class="text-xs text-slate-600 line-clamp-2">${m.ringkasan}</p>
              ${m.link ? `<a href="${m.link}" target="_blank" class="inline-flex items-center gap-1 text-xs font-semibold text-[#258BD8] hover:underline pt-1"><i data-lucide="external-link" class="w-3.5 h-3.5"></i> Buka Lampiran Media</a>` : ''}
            </div>
          `).join('') || '<p class="text-xs text-slate-400">Belum ada materi yang dibuat.</p>'}
        </div>
      </div>
    `;
  }

  else if (pageId === 'guru-tugas') {
    main.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 class="text-2xl font-extrabold text-[#142C50]">Tugas & Kuis Otomatis</h1>
            <p class="text-xs text-slate-500">Buat penugasan unggah file atau Kuis Pilihan Ganda terkoreksi otomatis</p>
          </div>
          <div class="flex gap-2">
            <button onclick="openModalBuatTugas('Tugas')" class="px-4 py-2.5 bg-[#142C50] text-white text-xs font-semibold rounded-xl">+ Tugas Baru</button>
            <button onclick="openModalBuatTugas('Kuis')" class="px-4 py-2.5 bg-[#258BD8] text-white text-xs font-semibold rounded-xl">+ Kuis PG Otomatis</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${gData.tugas.map(t => `
            <div class="card-enavia p-5 flex justify-between items-center">
              <div>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.jenis === 'Kuis' ? 'bg-amber-100 text-amber-800' : 'bg-cyan-100 text-cyan-800'}">${t.jenis}</span>
                <h3 class="font-bold text-sm text-[#142C50] mt-1">${t.judul}</h3>
                <p class="text-xs text-slate-500">${t.kodeMapel} • Kelas ${t.kelas} • Deadline: <b>${t.deadline}</b></p>
              </div>
              <button onclick="bukaHalamanNilaiTugas('${t.id}', '${t.kelas}', '${t.judul}')" class="px-3 py-2 bg-slate-100 hover:bg-[#258BD8] hover:text-white text-slate-700 text-xs font-semibold rounded-xl transition">
                Periksa
              </button>
            </div>
          `).join('') || '<p class="text-xs text-slate-400">Belum ada tugas atau kuis.</p>'}
        </div>
      </div>
    `;
  }

  else if (pageId === 'guru-penilaian') {
    main.innerHTML = `
      <div class="space-y-6">
        <h1 class="text-2xl font-extrabold text-[#142C50]">Penilaian Tugas Siswa</h1>
        <div class="card-enavia p-5 flex flex-col sm:flex-row gap-3 items-end text-xs">
          <div class="flex-1 w-full">
            <label class="font-semibold block mb-1">Pilih Tugas / Kuis</label>
            <select id="pilih-tugas-nilai" class="w-full p-2.5 border rounded-xl bg-white">
              ${gData.tugas.map(t => `<option value="${t.id}|${t.kelas}|${t.judul}">[${t.jenis}] ${t.judul} (Kelas ${t.kelas})</option>`).join('')}
            </select>
          </div>
          <button onclick="loadTabelPenilaian()" class="px-5 py-2.5 bg-[#258BD8] text-white font-semibold rounded-xl">Tampilkan Jawaban</button>
        </div>
        <div id="grading-workspace"></div>
      </div>
    `;
  }

  else if (pageId === 'guru-buku-nilai') {
    main.innerHTML = `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-extrabold text-[#142C50]">Buku Nilai & Rekapitulasi Berbobot</h1>
            <p class="text-xs text-slate-500">Kalkulasi otomatis Kehadiran + Rata-rata Tugas + Rata-rata Kuis</p>
          </div>
        </div>

        <div class="card-enavia p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end text-xs">
          <div>
            <label class="font-semibold block mb-1">Mata Pelajaran</label>
            <select id="rekap-mapel" onchange="updateKelasDropdown('rekap-mapel', 'rekap-kelas')" class="w-full p-2.5 border rounded-xl bg-white">
              ${gData.mapel.map(m => `<option value="${m.kode}">${m.nama}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="font-semibold block mb-1">Kelas</label>
            <select id="rekap-kelas" class="w-full p-2.5 border rounded-xl bg-white">
              ${(gData.mapel[0]?.kelasTarget || []).map(k => `<option value="${k}">${k}</option>`).join('')}
            </select>
          </div>
          <button onclick="loadRekapBukuNilai()" class="px-5 py-2.5 bg-[#142C50] text-white font-semibold rounded-xl">Hitung Rekap Nilai</button>
        </div>

        <div id="rekap-nilai-result"></div>
      </div>
    `;
  }
}

// =========================================================================
// 3. MODUL SISWA
// =========================================================================
function renderSiswaView(pageId) {
  const main = document.getElementById('main-content');
  const sData = APP_CACHE.siswaData || { stats: {}, materi: [], tugas: [], pengumuman: [] };

  if (pageId === 'siswa-beranda') {
    main.innerHTML = `
      <div class="space-y-6">
        <div class="bg-gradient-to-r from-[#142C50] to-[#258BD8] rounded-3xl p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg">
          <div>
            <span class="px-3 py-1 rounded-full bg-white/15 text-[11px] font-semibold">Kelas ${CURRENT_USER.kelas} • NIS ${CURRENT_USER.nip_nis}</span>
            <h1 class="text-2xl font-extrabold mt-2">Selamat Belajar, ${CURRENT_USER.nama}!</h1>
            <p class="text-xs text-blue-100 mt-1">"${APP_CONFIG.TAGLINE}"</p>
          </div>
          <div class="bg-white/10 backdrop-blur-xs rounded-2xl p-4 text-center min-w-[140px]">
            <p class="text-[11px] text-blue-100">Progres Materi</p>
            <p class="text-3xl font-extrabold text-[#F2B84B]">${sData.stats.progresBelajar || 0}%</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${kpiCard('Materi Selesai', `${sData.materi.filter(m => m.selesai).length} / ${sData.materi.length}`, 'book-open-check', 'bg-blue-50 text-[#258BD8]')}
          ${kpiCard('Tugas Dikerjakan', `${sData.stats.tugasSelesai || 0} / ${sData.stats.totalTugas || 0}`, 'check-circle-2', 'bg-cyan-50 text-[#38BBD1]')}
          ${kpiCard('Rata-rata Nilai', sData.stats.rataRataNilai || '0.0', 'award', 'bg-amber-50 text-[#F2B84B]')}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="card-enavia p-5">
            <h3 class="font-bold text-sm text-[#142C50] mb-3">Tugas & Kuis Terbaru</h3>
            <div class="space-y-3">
              ${sData.tugas.slice(0, 4).map(t => `
                <div class="p-3.5 rounded-xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded ${t.jenis === 'Kuis' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}">${t.jenis} • ${t.namaMapel}</span>
                    <h4 class="text-xs font-bold text-slate-800 mt-1">${t.judul}</h4>
                    <p class="text-[11px] text-slate-400">Batas waktu: ${t.deadline}</p>
                  </div>
                  <button onclick="navigateTo('siswa-tugas')" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${t.statusKumpul === 'Belum Dikerjakan' ? 'bg-[#258BD8] text-white' : 'bg-emerald-100 text-emerald-700'}">
                    ${t.statusKumpul === 'Belum Dikerjakan' ? 'Kerjakan' : 'Selesai'}
                  </button>
                </div>
              `).join('') || '<p class="text-xs text-slate-400">Tidak ada tugas aktif.</p>'}
            </div>
          </div>

          <div class="card-enavia p-5">
            <h3 class="font-bold text-sm text-[#142C50] mb-3">Papan Pengumuman Sekolah</h3>
            <div class="space-y-3">
              ${sData.pengumuman.map(p => `
                <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-[#258BD8] uppercase">${p.kategori}</span>
                    <span class="text-[10px] text-slate-400">${p.tanggal}</span>
                  </div>
                  <h4 class="text-xs font-bold text-slate-800 mt-1">${p.judul}</h4>
                  <p class="text-xs text-slate-600 mt-1">${p.isi}</p>
                </div>
              `).join('') || '<p class="text-xs text-slate-400">Belum ada pengumuman.</p>'}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  else if (pageId === 'siswa-materi') {
    main.innerHTML = `
      <div class="space-y-6">
        <h1 class="text-2xl font-extrabold text-[#142C50]">Materi Pembelajaran Kelas ${CURRENT_USER.kelas}</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${sData.materi.map(m => `
            <div class="card-enavia p-5 flex flex-col justify-between space-y-4">
              <div>
                <div class="flex justify-between items-center mb-2">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#258BD8]">${m.namaMapel}</span>
                  ${m.selesai ? '<span class="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Selesai</span>' : ''}
                </div>
                <h3 class="font-bold text-base text-[#142C50]">${m.judul}</h3>
                <p class="text-xs text-slate-600 mt-1.5 leading-relaxed">${m.ringkasan}</p>
                ${renderSmartEmbed(m.link)}
              </div>
              <div class="pt-3 border-t border-slate-100 flex justify-between items-center">
                <span class="text-[11px] text-slate-400">${m.tanggal}</span>
                ${!m.selesai
                  ? `<button onclick="handleSelesaiMateri('${m.id}')" class="px-3.5 py-1.5 bg-[#142C50] hover:bg-[#258BD8] text-white text-xs font-semibold rounded-xl transition">Tandai Sudah Dipelajari</button>`
                  : `<span class="text-xs text-slate-400 font-medium">Tercatat di progres</span>`}
              </div>
            </div>
          `).join('') || '<p class="text-xs text-slate-400">Belum ada materi diterbitkan untuk kelas Anda.</p>'}
        </div>
      </div>
    `;
  }

  else if (pageId === 'siswa-tugas') {
    main.innerHTML = `
      <div class="space-y-6">
        <h1 class="text-2xl font-extrabold text-[#142C50]">Tugas & Kuis Saya</h1>
        <div class="space-y-4">
          ${sData.tugas.map((t, idx) => `
            <div class="card-enavia p-5 flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${t.jenis === 'Kuis' ? 'bg-amber-100 text-amber-800' : 'bg-cyan-100 text-cyan-800'}">${t.jenis}</span>
                  <span class="text-xs font-semibold text-[#258BD8]">${t.namaMapel}</span>
                </div>
                <h3 class="font-bold text-base text-[#142C50]">${t.judul}</h3>
                <p class="text-xs text-slate-600">${t.instruksi}</p>
                <p class="text-[11px] text-slate-400">Batas Pengumpulan: <b>${t.deadline}</b></p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                ${t.nilai !== '' ? `<div class="text-center px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200"><p class="text-[10px] text-emerald-700 font-semibold">NILAI</p><p class="text-lg font-extrabold text-emerald-700">${t.nilai}</p></div>` : ''}
                ${t.statusKumpul === 'Belum Dikerjakan'
                  ? `<button onclick="mulaiKerjakanTugas(${idx})" class="px-4 py-2.5 bg-[#258BD8] hover:bg-[#1D70B8] text-white text-xs font-semibold rounded-xl shadow-sm">Mulai Kerjakan</button>`
                  : `<span class="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold">${t.statusKumpul}</span>`}
              </div>
            </div>
          `).join('') || '<p class="text-xs text-slate-400">Tidak ada tugas atau kuis saat ini.</p>'}
        </div>
      </div>
    `;
  }

  else if (pageId === 'siswa-nilai') {
    main.innerHTML = `
      <div class="space-y-6">
        <h1 class="text-2xl font-extrabold text-[#142C50]">Transkrip Nilai & Kehadiran</h1>
        <div class="card-enavia overflow-hidden">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-500 border-b">
              <tr><th class="p-4">Mata Pelajaran</th><th class="p-4">Tugas / Kuis</th><th class="p-4">Status</th><th class="p-4">Nilai</th><th class="p-4">Catatan Guru</th></tr>
            </thead>
            <tbody class="divide-y">
              ${sData.tugas.map(t => `
                <tr>
                  <td class="p-4 font-semibold text-slate-800">${t.namaMapel}</td>
                  <td class="p-4">${t.judul} <span class="text-[10px] text-slate-400">(${t.jenis})</span></td>
                  <td class="p-4">${t.statusKumpul}</td>
                  <td class="p-4 font-bold text-[#258BD8] text-sm">${t.nilai !== '' ? t.nilai : '-'}</td>
                  <td class="p-4 text-slate-500">${t.catatanGuru || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  else if (pageId === 'siswa-profil') {
    main.innerHTML = `
      <div class="max-w-lg card-enavia p-6 space-y-4 text-xs">
        <div class="flex items-center gap-4 pb-4 border-b">
          <div class="w-16 h-16 rounded-2xl bg-[#142C50] text-white font-extrabold text-xl flex items-center justify-center">
            ${CURRENT_USER.nama.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 class="text-lg font-extrabold text-[#142C50]">${CURRENT_USER.nama}</h2>
            <p class="text-slate-500">NIS: ${CURRENT_USER.nip_nis} • Kelas ${CURRENT_USER.kelas}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-slate-50 rounded-xl"><p class="text-slate-400">Email</p><p class="font-semibold mt-0.5">${CURRENT_USER.email}</p></div>
          <div class="p-3 bg-slate-50 rounded-xl"><p class="text-slate-400">Sekolah</p><p class="font-semibold mt-0.5">${APP_CONFIG.SCHOOL_NAME}</p></div>
        </div>
      </div>
    `;
  }
}

// =========================================================================
// HELPER UI & AKSI INTERAKTIF (MODAL, FORM SUBMIT, SMART EMBED, EXPORT CSV)
// =========================================================================
function kpiCard(title, value, icon, colorClass) {
  return `
    <div class="card-enavia p-5 flex items-center gap-4">
      <div class="w-11 h-11 rounded-2xl ${colorClass} flex items-center justify-center shrink-0">
        <i data-lucide="${icon}" class="w-5 h-5"></i>
      </div>
      <div>
        <p class="text-[11px] font-medium text-slate-500">${title}</p>
        <p class="text-xl font-extrabold text-[#142C50] mt-0.5">${value}</p>
      </div>
    </div>
  `;
}

// Smart Embed YouTube / Google Drive
function renderSmartEmbed(url) {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
    const vidId = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('youtu.be/')[1].split('?')[0];
    return `<div class="mt-3 rounded-xl overflow-hidden aspect-video border"><iframe class="w-full h-full" src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen></iframe></div>`;
  }
  return `<a href="${url}" target="_blank" class="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-[#258BD8] text-xs font-semibold"><i data-lucide="file-text" class="w-4 h-4"></i> Buka Tautan Materi / Dokumen</a>`;
}

// --- AKSI ADMIN ---
function filterUserTable() {
  const q = document.getElementById('filter-user-search').value.toLowerCase();
  const role = document.getElementById('filter-user-role').value;
  document.querySelectorAll('.user-row').forEach(row => {
    const matchText = row.dataset.name.includes(q);
    const matchRole = !role || row.dataset.role === role;
    row.style.display = matchText && matchRole ? '' : 'none';
  });
}

function openModalTambahUser() {
  openModal('Tambah Pengguna Baru', `
    <form onsubmit="submitTambahUser(event)" class="space-y-3 text-xs">
      <div><label class="font-semibold block mb-1">NIP / NIS</label><input id="u-nip" required class="w-full p-2.5 border rounded-xl"></div>
      <div><label class="font-semibold block mb-1">Nama Lengkap</label><input id="u-nama" required class="w-full p-2.5 border rounded-xl"></div>
      <div><label class="font-semibold block mb-1">Email</label><input id="u-email" type="email" required class="w-full p-2.5 border rounded-xl"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="font-semibold block mb-1">Peran</label><select id="u-role" class="w-full p-2.5 border rounded-xl bg-white"><option value="Siswa">Siswa</option><option value="Guru">Guru</option><option value="Admin">Admin</option></select></div>
        <div><label class="font-semibold block mb-1">Kelas (contoh: 7A)</label><input id="u-kelas" placeholder="-" class="w-full p-2.5 border rounded-xl"></div>
      </div>
      <div><label class="font-semibold block mb-1">Password Awal</label><input id="u-pass" value="123456" required class="w-full p-2.5 border rounded-xl"></div>
      <button type="submit" class="w-full py-2.5 bg-[#258BD8] text-white font-semibold rounded-xl">Simpan Pengguna</button>
    </form>
  `);
}

async function submitTambahUser(e) {
  e.preventDefault();
  const payload = {
    nip_nis: document.getElementById('u-nip').value,
    nama: document.getElementById('u-nama').value,
    email: document.getElementById('u-email').value,
    role: document.getElementById('u-role').value,
    kelas: document.getElementById('u-kelas').value || '-',
    password: document.getElementById('u-pass').value
  };
  const res = await callBackendAPI('tambahUserAdmin', { data: payload, namaAdmin: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) { closeModal(); refreshCurrentView(); }
}

function openModalImportUsers() {
  openModal('Import Massal Pengguna', `
    <div class="space-y-3 text-xs">
      <p class="text-slate-600">Tempel data dari Excel/CSV dengan format per baris:<br><code>NIS/NIP, Nama Lengkap, Email, Role, Kelas</code></p>
      <textarea id="bulk-users-text" rows="6" placeholder="2425001, Ahmad Fauzi, ahmad@smpn1.sch.id, Siswa, 7A&#10;2425002, Siti Aminah, siti@smpn1.sch.id, Siswa, 7A" class="w-full p-3 border rounded-xl font-mono"></textarea>
      <button onclick="submitImportUsers()" class="w-full py-2.5 bg-[#142C50] text-white font-semibold rounded-xl">Proses Import Massal</button>
    </div>
  `);
}

async function submitImportUsers() {
  const raw = document.getElementById('bulk-users-text').value.trim();
  if (!raw) return;
  const rows = raw.split('\n').map(line => {
    const [nip_nis, nama, email, role, kelas] = line.split(',').map(s => s.trim());
    return { nip_nis, nama, email, role, kelas };
  });
  const res = await callBackendAPI('importUsersMassal', { rows, namaAdmin: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) { closeModal(); refreshCurrentView(); }
}

async function handleUserAction(idUser, actionType) {
  if (!confirm('Lanjutkan tindakan pada akun ini?')) return;
  const res = await callBackendAPI('updateUserStatusOrPass', { idUser, actionType, newPassword: '123456', namaAdmin: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) refreshCurrentView();
}

function openModalTambahKelas() {
  openModal('Tambah Rombongan Belajar', `
    <form onsubmit="submitTambahKelas(event)" class="space-y-3 text-xs">
      <div><label class="font-semibold block mb-1">Nama Kelas (misal: 7A)</label><input id="k-nama" required class="w-full p-2.5 border rounded-xl"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="font-semibold block mb-1">Tahun Pelajaran</label><input id="k-tapel" value="2026/2027" required class="w-full p-2.5 border rounded-xl"></div>
        <div><label class="font-semibold block mb-1">Semester</label><select id="k-sem" class="w-full p-2.5 border rounded-xl bg-white"><option>Ganjil</option><option>Genap</option></select></div>
      </div>
      <div><label class="font-semibold block mb-1">Nama Wali Kelas</label><input id="k-wali" required class="w-full p-2.5 border rounded-xl"></div>
      <button type="submit" class="w-full py-2.5 bg-[#258BD8] text-white font-semibold rounded-xl">Simpan Kelas</button>
    </form>
  `);
}

async function submitTambahKelas(e) {
  e.preventDefault();
  const data = {
    namaKelas: document.getElementById('k-nama').value,
    tapel: document.getElementById('k-tapel').value,
    semester: document.getElementById('k-sem').value,
    waliKelas: document.getElementById('k-wali').value
  };
  const res = await callBackendAPI('tambahKelasAdmin', { data, namaAdmin: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) { closeModal(); refreshCurrentView(); }
}

function openModalTambahMapel() {
  const guruList = (APP_CACHE.adminData?.users || []).filter(u => u.role === 'Guru');
  openModal('Tambah Mata Pelajaran', `
    <form onsubmit="submitTambahMapel(event)" class="space-y-3 text-xs">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="font-semibold block mb-1">Kode Mapel</label><input id="m-kode" placeholder="MTK-7" required class="w-full p-2.5 border rounded-xl"></div>
        <div><label class="font-semibold block mb-1">Kategori</label><select id="m-kat" class="w-full p-2.5 border rounded-xl bg-white"><option>Wajib</option><option>Muatan Lokal</option></select></div>
      </div>
      <div><label class="font-semibold block mb-1">Nama Mata Pelajaran</label><input id="m-nama" placeholder="Matematika" required class="w-full p-2.5 border rounded-xl"></div>
      <div><label class="font-semibold block mb-1">Guru Pengampu</label>
        <select id="m-guru" required class="w-full p-2.5 border rounded-xl bg-white">
          ${guruList.map(g => `<option value="${g.id}">${g.nama} (${g.nip_nis})</option>`).join('')}
        </select>
      </div>
      <div><label class="font-semibold block mb-1">Kelas Target (pisahkan koma)</label><input id="m-kelas" placeholder="7A, 7B, 7C" required class="w-full p-2.5 border rounded-xl"></div>
      <button type="submit" class="w-full py-2.5 bg-[#258BD8] text-white font-semibold rounded-xl">Simpan Mata Pelajaran</button>
    </form>
  `);
}

async function submitTambahMapel(e) {
  e.preventDefault();
  const data = {
    kode: document.getElementById('m-kode').value,
    kategori: document.getElementById('m-kat').value,
    nama: document.getElementById('m-nama').value,
    idGuru: document.getElementById('m-guru').value,
    kelasTarget: document.getElementById('m-kelas').value
  };
  const res = await callBackendAPI('tambahMapelAdmin', { data, namaAdmin: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) { closeModal(); refreshCurrentView(); }
}

function openModalKenaikanKelas() {
  openModal('Kenaikan Kelas Massal', `
    <div class="space-y-3 text-xs">
      <p class="text-slate-600">Memindahkan seluruh siswa aktif dari kelas asal ke kelas tujuan secara serentak.</p>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="font-semibold block mb-1">Kelas Asal</label><input id="kk-asal" placeholder="7A" class="w-full p-2.5 border rounded-xl"></div>
        <div><label class="font-semibold block mb-1">Kelas Tujuan</label><input id="kk-tujuan" placeholder="8A (atau Alumni)" class="w-full p-2.5 border rounded-xl"></div>
      </div>
      <button onclick="submitKenaikanKelas()" class="w-full py-2.5 bg-[#F2B84B] text-[#142C50] font-bold rounded-xl">Eksekusi Kenaikan Kelas</button>
    </div>
  `);
}

async function submitKenaikanKelas() {
  const kelasAsal = document.getElementById('kk-asal').value.trim();
  const kelasTujuan = document.getElementById('kk-tujuan').value.trim();
  if (!kelasAsal || !kelasTujuan) return;
  const res = await callBackendAPI('prosesKenaikanKelas', { kelasAsal, kelasTujuan, namaAdmin: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) { closeModal(); refreshCurrentView(); }
}

function openModalPengumuman() {
  openModal('Buat Pengumuman Sekolah', `
    <form onsubmit="submitPengumuman(event)" class="space-y-3 text-xs">
      <div><label class="font-semibold block mb-1">Judul Pengumuman</label><input id="p-judul" required class="w-full p-2.5 border rounded-xl"></div>
      <div><label class="font-semibold block mb-1">Kategori</label><select id="p-kat" class="w-full p-2.5 border rounded-xl bg-white"><option>Akademik</option><option>Ujian</option><option>Kegiatan Sekolah</option></select></div>
      <div><label class="font-semibold block mb-1">Isi Pengumuman</label><textarea id="p-isi" rows="4" required class="w-full p-2.5 border rounded-xl"></textarea></div>
      <button type="submit" class="w-full py-2.5 bg-[#258BD8] text-white font-semibold rounded-xl">Terbitkan</button>
    </form>
  `);
}

async function submitPengumuman(e) {
  e.preventDefault();
  const data = {
    judul: document.getElementById('p-judul').value,
    kategori: document.getElementById('p-kat').value,
    isi: document.getElementById('p-isi').value
  };
  const res = await callBackendAPI('tambahPengumumanAdmin', { data, namaAdmin: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) { closeModal(); refreshCurrentView(); }
}

// --- AKSI GURU ---
function updateKelasDropdown(mapelSelectId, kelasSelectId) {
  const kode = document.getElementById(mapelSelectId).value;
  const mapelObj = (APP_CACHE.guruData?.mapel || []).find(m => m.kode === kode);
  const kelasSelect = document.getElementById(kelasSelectId);
  kelasSelect.innerHTML = (mapelObj?.kelasTarget || []).map(k => `<option value="${k}">${k}</option>`).join('');
}

async function muatDaftarSiswaAbsensi() {
  const kelas = document.getElementById('absen-kelas').value;
  const siswa = await callBackendAPI('getSiswaByKelas', { kelas });
  const container = document.getElementById('absen-sheet-container');
  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="space-y-4 text-xs">
      <div>
        <label class="font-semibold block mb-1">Jurnal Topik / Materi Pertemuan Hari Ini</label>
        <input id="absen-jurnal" placeholder="Contoh: Bab 2 - Persamaan Linear Satu Variabel" class="w-full p-2.5 border rounded-xl">
      </div>
      <table class="w-full text-left border rounded-xl overflow-hidden">
        <thead class="bg-slate-50 border-b"><tr><th class="p-3">NIS</th><th class="p-3">Nama Siswa</th><th class="p-3">Status Kehadiran</th></tr></thead>
        <tbody class="divide-y">
          ${siswa.map(s => `
            <tr>
              <td class="p-3 font-mono">${s.nis}</td>
              <td class="p-3 font-semibold">${s.nama}</td>
              <td class="p-3">
                <select data-siswa-id="${s.id}" class="absen-status-select p-1.5 border rounded-lg bg-white font-semibold">
                  <option value="H">Hadir (H)</option>
                  <option value="S">Sakit (S)</option>
                  <option value="I">Izin (I)</option>
                  <option value="A">Alpa (A)</option>
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <button onclick="simpanAbsensiForm()" class="px-5 py-2.5 bg-[#258BD8] text-white font-semibold rounded-xl">Simpan Absensi & Jurnal</button>
    </div>
  `;
}

async function simpanAbsensiForm() {
  const absenMap = {};
  document.querySelectorAll('.absen-status-select').forEach(sel => {
    absenMap[sel.dataset.siswaId] = sel.value;
  });
  const payload = {
    kodeMapel: document.getElementById('absen-mapel').value,
    kelas: document.getElementById('absen-kelas').value,
    tanggal: document.getElementById('absen-tanggal').value,
    jurnal: document.getElementById('absen-jurnal').value,
    idGuru: CURRENT_USER.id,
    absenMap
  };
  const res = await callBackendAPI('simpanAbsensiKelas', { data: payload, namaGuru: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
}

function openModalTambahMateri() {
  const mapelList = APP_CACHE.guruData?.mapel || [];
  openModal('Buat Materi Pembelajaran', `
    <form onsubmit="submitMateriGuru(event)" class="space-y-3 text-xs">
      <div><label class="font-semibold block mb-1">Judul Materi</label><input id="gm-judul" required class="w-full p-2.5 border rounded-xl"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="font-semibold block mb-1">Mata Pelajaran</label><select id="gm-mapel" class="w-full p-2.5 border rounded-xl bg-white">${mapelList.map(m => `<option value="${m.kode}">${m.nama}</option>`).join('')}</select></div>
        <div><label class="font-semibold block mb-1">Kelas</label><input id="gm-kelas" placeholder="7A" required class="w-full p-2.5 border rounded-xl"></div>
      </div>
      <div><label class="font-semibold block mb-1">Ringkasan Materi</label><textarea id="gm-ringkas" rows="3" required class="w-full p-2.5 border rounded-xl"></textarea></div>
      <div><label class="font-semibold block mb-1">Tautan Media (YouTube / Google Drive PDF)</label><input id="gm-link" placeholder="https://..." class="w-full p-2.5 border rounded-xl"></div>
      <div><label class="font-semibold block mb-1">Status</label><select id="gm-status" class="w-full p-2.5 border rounded-xl bg-white"><option value="Terbit">Terbit Sekarang</option><option value="Draft">Simpan Draft</option></select></div>
      <button type="submit" class="w-full py-2.5 bg-[#258BD8] text-white font-semibold rounded-xl">Simpan Materi</button>
    </form>
  `);
}

async function submitMateriGuru(e) {
  e.preventDefault();
  const data = {
    judul: document.getElementById('gm-judul').value,
    kodeMapel: document.getElementById('gm-mapel').value,
    kelas: document.getElementById('gm-kelas').value.trim(),
    ringkasan: document.getElementById('gm-ringkas').value,
    linkMedia: document.getElementById('gm-link').value.trim(),
    status: document.getElementById('gm-status').value,
    idGuru: CURRENT_USER.id
  };
  const res = await callBackendAPI('simpanMateri', { data, namaGuru: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) { closeModal(); refreshCurrentView(); }
}

function openModalBuatTugas(jenis) {
  const mapelList = APP_CACHE.guruData?.mapel || [];
  const kuisBuilderHTML = jenis === 'Kuis' ? `
    <div class="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
      <p class="font-bold text-amber-900">Format Soal Kuis Pilihan Ganda (1 baris per soal):</p>
      <p class="text-[11px] text-amber-800">Format: <code>Pertanyaan | Opsi A | Opsi B | Opsi C | Opsi D | IndexKunci(0=A,1=B,2=C,3=D)</code></p>
      <textarea id="gt-soal-raw" rows="5" placeholder="Hasil dari 5 + 7 adalah... | 10 | 11 | 12 | 13 | 2" class="w-full p-2.5 border rounded-xl font-mono text-[11px]"></textarea>
    </div>
  ` : '';

  openModal(`Buat ${jenis} Baru`, `
    <form onsubmit="submitTugasGuru(event, '${jenis}')" class="space-y-3 text-xs">
      <div><label class="font-semibold block mb-1">Judul ${jenis}</label><input id="gt-judul" required class="w-full p-2.5 border rounded-xl"></div>
      <div class="grid grid-cols-3 gap-2">
        <div><label class="font-semibold block mb-1">Mapel</label><select id="gt-mapel" class="w-full p-2.5 border rounded-xl bg-white">${mapelList.map(m => `<option value="${m.kode}">${m.nama}</option>`).join('')}</select></div>
        <div><label class="font-semibold block mb-1">Kelas</label><input id="gt-kelas" placeholder="7A" required class="w-full p-2.5 border rounded-xl"></div>
        <div><label class="font-semibold block mb-1">Deadline</label><input id="gt-deadline" type="date" required class="w-full p-2.5 border rounded-xl"></div>
      </div>
      <div><label class="font-semibold block mb-1">Instruksi Pengerjaan</label><textarea id="gt-instruksi" rows="2" required class="w-full p-2.5 border rounded-xl"></textarea></div>
      ${kuisBuilderHTML}
      <button type="submit" class="w-full py-2.5 bg-[#258BD8] text-white font-semibold rounded-xl">Terbitkan ${jenis}</button>
    </form>
  `);
}

async function submitTugasGuru(e, jenis) {
  e.preventDefault();
  let soalList = [];
  if (jenis === 'Kuis') {
    const raw = document.getElementById('gt-soal-raw').value.trim();
    soalList = raw.split('\n').map(line => {
      const parts = line.split('|').map(s => s.trim());
      return { tanya: parts[0], opsi: [parts[1], parts[2], parts[3], parts[4]], kunci: Number(parts[5] || 0) };
    });
  }
  const data = {
    jenis,
    judul: document.getElementById('gt-judul').value,
    kodeMapel: document.getElementById('gt-mapel').value,
    kelas: document.getElementById('gt-kelas').value.trim(),
    deadline: document.getElementById('gt-deadline').value,
    instruksi: document.getElementById('gt-instruksi').value,
    soalList,
    idGuru: CURRENT_USER.id
  };
  const res = await callBackendAPI('simpanTugasKuis', { data, namaGuru: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
  if (res.success) { closeModal(); refreshCurrentView(); }
}

async function bukaHalamanNilaiTugas(idTugas, kelas, judul) {
  await navigateTo('guru-penilaian');
  const sel = document.getElementById('pilih-tugas-nilai');
  if (sel) sel.value = `${idTugas}|${kelas}|${judul}`;
  loadTabelPenilaian();
}

async function loadTabelPenilaian() {
  const val = document.getElementById('pilih-tugas-nilai').value;
  if (!val) return;
  const [idTugas, kelas] = val.split('|');
  const rows = await callBackendAPI('getPengumpulanByTugas', { idTugas, kelas });
  document.getElementById('grading-workspace').innerHTML = `
    <div class="card-enavia overflow-hidden">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 border-b"><tr><th class="p-3">Siswa</th><th class="p-3">Jawaban / File</th><th class="p-3">Nilai (0-100)</th><th class="p-3">Catatan</th><th class="p-3">Aksi</th></tr></thead>
        <tbody class="divide-y">
          ${rows.map(r => `
            <tr>
              <td class="p-3 font-semibold">${r.nama}<br><span class="text-[10px] text-slate-400">${r.status}</span></td>
              <td class="p-3">${r.jawaban.startsWith('http') ? `<a href="${r.jawaban}" target="_blank" class="text-[#258BD8] underline font-semibold">Lihat File/Link</a>` : (r.jawaban || '-')}</td>
              <td class="p-3"><input type="number" id="nilai-${r.idSiswa}" value="${r.nilai}" min="0" max="100" class="w-20 p-1.5 border rounded-lg"></td>
              <td class="p-3"><input type="text" id="cat-${r.idSiswa}" value="${r.catatan}" placeholder="Umpan balik..." class="w-full p-1.5 border rounded-lg"></td>
              <td class="p-3"><button onclick="simpanNilaiBaris('${r.idKumpul}', '${idTugas}', '${r.idSiswa}')" class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold">Simpan</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function simpanNilaiBaris(idKumpul, idTugas, idSiswa) {
  const nilai = document.getElementById('nilai-' + idSiswa).value;
  const catatan = document.getElementById('cat-' + idSiswa).value;
  const res = await callBackendAPI('simpanNilaiTugas', { idKumpul, idTugas, idSiswa, nilai, catatan, namaGuru: CURRENT_USER.nama });
  showToast(res.message, res.success ? 'success' : 'error');
}

async function loadRekapBukuNilai() {
  const kodeMapel = document.getElementById('rekap-mapel').value;
  const kelas = document.getElementById('rekap-kelas').value;
  const res = await callBackendAPI('getRekapNilaiKelas', { kodeMapel, kelas });
  APP_CACHE.lastRekap = { kodeMapel, kelas, rows: res.data };

  document.getElementById('rekap-nilai-result').innerHTML = `
    <div class="card-enavia overflow-hidden">
      <div class="p-4 bg-slate-50 border-b flex justify-between items-center text-xs">
        <span>Bobot Aktif: <b>Hadir ${res.bobot[0]}% • Tugas ${res.bobot[1]}% • Kuis ${res.bobot[2]}%</b> (${res.totalPertemuan} Pertemuan)</span>
        <button onclick="exportRekapCSV()" class="px-3.5 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg">Export CSV / Excel</button>
      </div>
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 border-b">
          <tr><th class="p-3">NIS</th><th class="p-3">Nama Siswa</th><th class="p-3">Absensi</th><th class="p-3">Skor Hadir</th><th class="p-3">Avg Tugas</th><th class="p-3">Avg Kuis</th><th class="p-3">Nilai Akhir</th><th class="p-3">Predikat</th></tr>
        </thead>
        <tbody class="divide-y">
          ${res.data.map(r => `
            <tr>
              <td class="p-3 font-mono">${r.nis}</td>
              <td class="p-3 font-semibold">${r.nama}</td>
              <td class="p-3 text-slate-500">${r.rekapAbsen}</td>
              <td class="p-3">${r.skorHadir}</td>
              <td class="p-3">${r.avgTugas}</td>
              <td class="p-3">${r.avgKuis}</td>
              <td class="p-3 font-extrabold text-[#142C50] text-sm">${r.nilaiAkhir}</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded font-bold bg-blue-50 text-[#258BD8]">${r.predikat}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function exportRekapCSV() {
  const { kodeMapel, kelas, rows } = APP_CACHE.lastRekap || {};
  if (!rows) return;
  let csv = 'NIS,Nama Siswa,Rekap Absensi,Skor Hadir,Rata Tugas,Rata Kuis,Nilai Akhir,Predikat\n';
  rows.forEach(r => { csv += `"${r.nis}","${r.nama}","${r.rekapAbsen}",${r.skorHadir},${r.avgTugas},${r.avgKuis},${r.nilaiAkhir},${r.predikat}\n`; });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Rekap_Nilai_${kodeMapel}_${kelas}.csv`;
  link.click();
}

// --- AKSI SISWA ---
async function handleSelesaiMateri(idMateri) {
  const res = await callBackendAPI('tandaiMateriSelesai', { idMateri, idSiswa: CURRENT_USER.id });
  if (res.success) {
    showToast('Progres belajar diperbarui!', 'success');
    refreshCurrentView();
  }
}

function mulaiKerjakanTugas(indexTugas) {
  const tugas = APP_CACHE.siswaData.tugas[indexTugas];
  if (tugas.jenis === 'Kuis') {
    openModal(`Kuis: ${tugas.judul}`, `
      <form onsubmit="submitKuisForm(event, '${tugas.id}')" class="space-y-4 text-xs">
        <div class="p-3 bg-blue-50 text-[#142C50] rounded-xl font-semibold">Pilih jawaban yang paling tepat, lalu klik Kirim Jawaban.</div>
        ${tugas.soal.map((s, idx) => `
          <div class="p-3.5 border rounded-xl space-y-2">
            <p class="font-bold text-slate-800">${idx + 1}. ${s.tanya}</p>
            ${s.opsi.map((op, oIdx) => `
              <label class="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input type="radio" name="q-${idx}" value="${oIdx}" required>
                <span>${op}</span>
              </label>
            `).join('')}
          </div>
        `).join('')}
        <button type="submit" class="w-full py-3 bg-[#258BD8] text-white font-bold rounded-xl">Kirim Jawaban Kuis</button>
      </form>
    `);
  } else {
    openModal(`Kumpulkan Tugas: ${tugas.judul}`, `
      <form onsubmit="submitTugasFileForm(event, '${tugas.id}', '${tugas.judul}')" class="space-y-4 text-xs">
        <p class="text-slate-600">${tugas.instruksi}</p>
        <div>
          <label class="font-semibold block mb-1">Unggah Foto / Dokumen Tugas (Otomatis terkompresi)</label>
          <input type="file" id="siswa-file-input" accept="image/*,.pdf,.doc,.docx" class="w-full p-2 border rounded-xl">
        </div>
        <div>
          <label class="font-semibold block mb-1">Atau Tempel Tautan Google Drive / Jawaban Teks</label>
          <input type="text" id="siswa-link-input" placeholder="https://drive.google.com/..." class="w-full p-2.5 border rounded-xl">
        </div>
        <button type="submit" id="btn-kumpul-tugas" class="w-full py-3 bg-[#258BD8] text-white font-bold rounded-xl">Kirim Tugas</button>
      </form>
    `);
  }
}

async function submitKuisForm(e, idTugas) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const jawabanArray = [];
  for (let pair of formData.entries()) {
    jawabanArray.push(Number(pair[1]));
  }
  const res = await callBackendAPI('submitKuisSiswa', {
    idTugas, idSiswa: CURRENT_USER.id, namaSiswa: CURRENT_USER.nama, jawabanArray
  });
  if (res.success) {
    closeModal();
    showToast(`Kuis selesai! Skor Anda: ${res.skor} (Benar ${res.benar}/${res.total})`, 'success');
    refreshCurrentView();
  }
}

async function submitTugasFileForm(e, idTugas, judulTugas) {
  e.preventDefault();
  const btn = document.getElementById('btn-kumpul-tugas');
  btn.disabled = true;
  btn.textContent = 'Mengunggah ke Google Drive...';

  const fileInput = document.getElementById('siswa-file-input');
  const linkInput = document.getElementById('siswa-link-input').value.trim();
  let fileData = null, fileName = null;

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    fileName = file.name;
    fileData = await compressImageToBase64(file);
  }

  const res = await callBackendAPI('kumpulkanTugasSiswa', {
    idTugas, judulTugas, idSiswa: CURRENT_USER.id, nis: CURRENT_USER.nip_nis,
    namaSiswa: CURRENT_USER.nama, jawabanLink: linkInput, fileData, fileName
  });

  btn.disabled = false;
  if (res.success) {
    closeModal();
    showToast(res.message, 'success');
    refreshCurrentView();
  } else {
    showToast(res.message, 'error');
  }
}

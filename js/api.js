// ==========================================
// FILE: js/api.js
// ==========================================
async function callBackendAPI(action, payload = {}) {
  try {
    const response = await fetch(APP_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action, payload })
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('API Error [' + action + ']:', error);
    return {
      success: false,
      message: 'Gagal terhubung ke server E-NAVIA. Periksa koneksi internet Anda.'
    };
  }
}

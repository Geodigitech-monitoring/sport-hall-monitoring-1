// script.js - Versi dengan HiveMQ Cloud
let mqttClient = null;
let isConnected = false;
let sensorDataHistory = [];

// Konfigurasi HiveMQ Cloud - GANTI DENGAN SETTING ANDA
const HIVEMQ_CONFIG = {
    hostname: 'd97fa97042434738a712d06b663db901.s1.eu.hivemq.cloud', // Ganti dengan host cluster Anda
    port: 8884, // Port WebSocket SSL
    username: 'hivemq.webclient.1769348223798', // Ganti dengan username HiveMQ
    password: 'E0MR9o&!I7dP1zct#:bD', // Ganti dengan password HiveMQ
    clientId: 'web-client-' + Math.random().toString(16).substr(2, 8),
    protocol: 'wss', // WebSocket Secure
    clean: true
};

// Topics MQTT
const TOPICS = {
    SENSOR_DATA: 'building-tilt/sensor-data',
    COMMANDS: 'building-tilt/commands'
};

// Inisialisasi koneksi MQTT ke HiveMQ
function initHiveMQ() {
    updateConnectionStatus('connecting');
    
    const { hostname, port, username, password, clientId, protocol, clean } = HIVEMQ_CONFIG;
    const url = `${protocol}://${hostname}:${port}/mqtt`;
    
    console.log('Connecting to HiveMQ:', url);
    
    // Buat koneksi MQTT
    mqttClient = mqtt.connect(url, {
        username,
        password,
        clientId,
        clean,
        reconnectPeriod: 3000, // Auto reconnect setiap 3 detik
        connectTimeout: 4000
    });
    
    // Event handlers
    mqttClient.on('connect', () => {
        console.log('Connected to HiveMQ Cloud');
        isConnected = true;
        updateConnectionStatus('connected');
        
        // Subscribe ke topic sensor data
        mqttClient.subscribe(TOPICS.SENSOR_DATA, { qos: 0 }, (err) => {
            if (!err) {
                console.log('Subscribed to:', TOPICS.SENSOR_DATA);
            }
        });
    });
    
    mqttClient.on('message', (topic, message) => {
        if (topic === TOPICS.SENSOR_DATA) {
            try {
                const data = JSON.parse(message.toString());
                processSensorData(data);
            } catch (error) {
                console.error('Error parsing MQTT message:', error);
            }
        }
    });
    
    mqttClient.on('error', (error) => {
        console.error('MQTT Error:', error);
        isConnected = false;
        updateConnectionStatus('error');
    });
    
    mqttClient.on('close', () => {
        console.log('Disconnected from HiveMQ');
        isConnected = false;
        updateConnectionStatus('disconnected');
    });
    
    mqttClient.on('offline', () => {
        console.log('MQTT client offline');
        isConnected = false;
        updateConnectionStatus('disconnected');
    });
}

// Proses data sensor dari MQTT
function processSensorData(data) {
    const now = new Date();
    data.timestamp = now;
    data.timeString = now.toLocaleTimeString('id-ID');
    data.dateString = now.toLocaleDateString('id-ID');
    
    sensorDataHistory.push(data);
    
    // Simpan maksimal 100 data untuk history
    if (sensorDataHistory.length > 100) {
        sensorDataHistory = sensorDataHistory.slice(-100);
    }
    
    updateDashboard(data);
    updateBuildingStatus(data);
    updateAlertBanner(data);
}

// Update dashboard dengan data real-time
function updateDashboard(data) {
    const rollElement = document.getElementById('roll-value');
    const pitchElement = document.getElementById('pitch-value');
    
    if (rollElement) {
        rollElement.textContent = data.roll.toFixed(2) + '°';
        rollElement.style.color = getAngleColor(data.roll);
    }
    
    if (pitchElement) {
        pitchElement.textContent = data.pitch.toFixed(2) + '°';
        pitchElement.style.color = getAngleColor(data.pitch);
    }
}

// Get color based on angle value
function getAngleColor(angle) {
    const absAngle = Math.abs(angle);
    if (absAngle < 5.0) return '#28a745';      // Aman - hijau
    if (absAngle < 10.0) return '#ffc107';     // Waspada - kuning
    if (absAngle < 20.0) return '#ff9800';     // Siaga - oranye
    return '#dc3545';                           // Bahaya - merah
}

// Update status bangunan
function updateBuildingStatus(data) {
    const statusElement = document.getElementById('building-status');
    if (!statusElement) return;
    
    const maxAngle = Math.max(Math.abs(data.roll), Math.abs(data.pitch));
    const status = getBuildingStatus(maxAngle);
    
    statusElement.textContent = status;
    statusElement.className = `data-value status-${status.toLowerCase()}`;
}

// Dapatkan status bangunan
function getBuildingStatus(angle) {
    if (angle < 5.0) return 'AMAN';
    if (angle < 10.0) return 'WASPADA';
    if (angle < 20.0) return 'SIAGA';
    return 'BAHAYA';
}

// Update alert banner
function updateAlertBanner(data) {
    const alertBanner = document.querySelector('.alert-banner');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    
    if (!alertBanner || !alertTitle || !alertMessage) return;
    
    const maxAngle = Math.max(Math.abs(data.roll), Math.abs(data.pitch));
    
    if (maxAngle > 20.0) {
        // Bahaya
        alertBanner.style.display = 'flex';
        alertBanner.style.backgroundColor = '#f8d7da';
        alertBanner.style.borderLeftColor = '#dc3545';
        alertTitle.textContent = 'BAHAYA: Kemiringan Ekstrem!';
        alertTitle.style.color = '#dc3545';
        alertMessage.textContent = `Sudut kemiringan mencapai ${maxAngle.toFixed(2)}°. Segera evakuasi dan hubungi petugas!`;
    } else if (maxAngle > 10.0) {
        // Siaga
        alertBanner.style.display = 'flex';
        alertBanner.style.backgroundColor = '#fff3e0';
        alertBanner.style.borderLeftColor = '#ff9800';
        alertTitle.textContent = 'SIAGA: Kemiringan Tinggi';
        alertTitle.style.color = '#ef6c00';
        alertMessage.textContent = `Sudut kemiringan mencapai ${maxAngle.toFixed(2)}°. Lakukan pemeriksaan segera.`;
    } else if (maxAngle > 5.0) {
        // Waspada
        alertBanner.style.display = 'flex';
        alertBanner.style.backgroundColor = '#fff3cd';
        alertBanner.style.borderLeftColor = '#ffc107';
        alertTitle.textContent = 'WASPADA: Kemiringan Sedang';
        alertTitle.style.color = '#856404';
        alertMessage.textContent = `Sudut kemiringan menunjukkan ${maxAngle.toFixed(2)}°. Pantau terus kondisi.`;
    } else {
        // Aman - sembunyikan banner
        alertBanner.style.display = 'none';
    }
}

// Update status koneksi
function updateConnectionStatus(status) {
    const indicator = document.querySelector('.status-dot');
    const statusText = document.getElementById('connection-status-text');
    
    if (!indicator || !statusText) return;
    
    indicator.className = 'status-dot';
    
    switch(status) {
        case 'connected':
            indicator.classList.add('connected');
            statusText.textContent = 'Terhubung ke HiveMQ Cloud';
            break;
        case 'disconnected':
            indicator.classList.add('disconnected');
            statusText.textContent = 'Terputus dari HiveMQ';
            break;
        case 'connecting':
            indicator.classList.add('connecting');
            statusText.textContent = 'Menghubungkan ke HiveMQ...';
            break;
        case 'error':
            indicator.classList.add('disconnected');
            statusText.textContent = 'Error koneksi HiveMQ';
            break;
    }
}

// Update waktu dan tanggal
function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    const dateElement = document.getElementById('current-date');
    const timeElement = document.getElementById('current-time');
    
    if (dateElement) {
        dateElement.textContent = now.toLocaleDateString('id-ID', options);
    }
    
    if (timeElement) {
        timeElement.textContent = now.toLocaleTimeString('id-ID');
    }
    
    // Update tahun di footer
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = now.getFullYear();
    }
}

// Setup tombol aksi
function setupActionButtons() {
    const downloadSdBtn = document.getElementById('download-sd-btn');
    
    if (downloadSdBtn) {
        downloadSdBtn.addEventListener('click', () => {
            // Kirim command ke ESP32 via MQTT
            if (mqttClient && mqttClient.connected) {
                const command = {
                    type: 'GET_SD_DATA',
                    timestamp: new Date().toISOString()
                };
                mqttClient.publish(TOPICS.COMMANDS, JSON.stringify(command));
                showToast('Permintaan data SD Card dikirim ke ESP32', 'info');
            } else {
                showToast('Tidak terhubung ke HiveMQ Cloud', 'error');
            }
        });
    }
}

// Fungsi untuk menampilkan toast notification
function showToast(message, type = 'info') {
    // Hapus toast sebelumnya jika ada
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Buat elemen toast baru
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    // Tentukan ikon berdasarkan type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Tampilkan toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Sembunyikan setelah 3 detik
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, 3000);
}

// Generate data dummy untuk demo (jika HiveMQ belum ada data)
function generateDemoData() {
    const now = new Date();
    
    for (let i = 0; i < 30; i++) {
        const time = new Date(now.getTime() - (30 - i) * 2000);
        const baseRoll = 0.2;
        const basePitch = -0.1;
        const variation = (Math.sin(i * 0.3) * 0.5);
        
        sensorDataHistory.push({
            roll: baseRoll + variation + (Math.random() - 0.5) * 0.1,
            pitch: basePitch + variation * 0.8 + (Math.random() - 0.5) * 0.1,
            timestamp: time,
            timeString: time.toLocaleTimeString('id-ID'),
            dateString: time.toLocaleDateString('id-ID')
        });
    }
    
    if (sensorDataHistory.length > 0) {
        const latestData = sensorDataHistory[sensorDataHistory.length - 1];
        updateDashboard(latestData);
        updateBuildingStatus(latestData);
    }
}

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Building Tilt Monitoring System with HiveMQ...');
    
    // Update waktu
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Setup tombol aksi
    setupActionButtons();
    
    // Konek ke HiveMQ Cloud
    initHiveMQ();
    
    // Generate data demo jika diperlukan
    setTimeout(() => {
        if (!isConnected) {
            console.log('Using demo data (HiveMQ not connected)');
            generateDemoData();
            
            // Simulasi data real-time
            setInterval(() => {
                if (!isConnected && sensorDataHistory.length > 0) {
                    const lastData = sensorDataHistory[sensorDataHistory.length - 1];
                    const timeVariation = Math.sin(Date.now() * 0.001) * 0.1;
                    
                    const newData = {
                        roll: lastData.roll + (Math.random() - 0.5) * 0.05 + timeVariation,
                        pitch: lastData.pitch + (Math.random() - 0.5) * 0.03 + timeVariation * 0.8,
                        timestamp: new Date(),
                        timeString: new Date().toLocaleTimeString('id-ID'),
                        dateString: new Date().toLocaleDateString('id-ID')
                    };
                    
                    sensorDataHistory.push(newData);
                    
                    if (sensorDataHistory.length > 100) {
                        sensorDataHistory = sensorDataHistory.slice(-100);
                    }
                    
                    updateDashboard(newData);
                    updateBuildingStatus(newData);
                    updateAlertBanner(newData);
                }
            }, 2000);
        }
    }, 5000);
    
    // Update IP display
    setTimeout(() => {
        const ipElement = document.getElementById('ip-address');
        if (ipElement) {
            ipElement.textContent = `Cloud: ${HIVEMQ_CONFIG.hostname}`;
        }
    }, 1000);
});

// Tambahkan CSS untuk toast notification
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    .toast-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        border-left: 4px solid #004aad;
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 10000;
        max-width: 300px;
    }
    
    .toast-notification.show {
        transform: translateX(0);
        opacity: 1;
    }
    
    .toast-success {
        border-left-color: #28a745;
    }
    
    .toast-error {
        border-left-color: #dc3545;
    }
    
    .toast-warning {
        border-left-color: #ffc107;
    }
    
    .toast-info {
        border-left-color: #17a2b8;
    }
    
    .toast-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .toast-content i {
        font-size: 18px;
    }
    
    .toast-success .toast-content i {
        color: #28a745;
    }
    
    .toast-error .toast-content i {
        color: #dc3545;
    }
    
    .toast-warning .toast-content i {
        color: #ffc107;
    }
    
    .toast-info .toast-content i {
        color: #17a2b8;
    }
    
    .toast-content span {
        font-size: 14px;
        color: #333;
    }
    
    @media (max-width: 768px) {
        .toast-notification {
            bottom: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
        }
    }
`;
document.head.appendChild(toastStyle);

// Tambahkan CSS untuk status
const statusStyle = document.createElement('style');
statusStyle.textContent = `
    .status-aman { color: #28a745 !important; }
    .status-waspada { color: #ffc107 !important; }
    .status-siaga { color: #ff9800 !important; }
    .status-bahaya { color: #dc3545 !important; }
    
    .data-value.status-aman { color: #28a745; }
    .data-value.status-waspada { color: #ffc107; }
    .data-value.status-siaga { color: #ff9800; }
    .data-value.status-bahaya { color: #dc3545; }
    
    .reading-info {
        margin-top: 20px;
        padding: 15px;
        background-color: #f0f8ff;
        border-radius: 8px;
        border-left: 4px solid #004aad;
    }
    
    .reading-info h3 {
        color: #004aad;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
    }
    
    .reading-info ul {
        list-style-type: none;
        padding: 0;
    }
    
    .reading-info li {
        margin-bottom: 8px;
        padding: 8px;
        background-color: white;
        border-radius: 5px;
        border: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
    }
    
    .reading-info li i {
        color: #004aad;
    }
`;
document.head.appendChild(statusStyle);

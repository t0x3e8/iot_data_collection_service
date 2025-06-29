let allDevices = [];
let filteredDevices = [];

async function fetchDevices() {
    try {
        const response = await fetch('/api/devices');
        
        // Check if response is ok
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Better data extraction with validation
        if (data.success && Array.isArray(data.data)) {
            allDevices = data.data;
        } else if (Array.isArray(data.data)) {
            allDevices = data.data;
        } else if (Array.isArray(data)) {
            allDevices = data;
        } else {
            allDevices = [];
        }
        
        filteredDevices = allDevices;
        displayDevices(filteredDevices);
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('Error fetching devices:', error);
        showError('Failed to fetch devices: ' + error.message);
        document.getElementById('loading').style.display = 'none';
    }
}

function displayDevices(devices) {
    const container = document.getElementById('devicesContainer');
    
    if (!Array.isArray(devices) || devices.length === 0) {
        container.innerHTML = '<div style="color: white; text-align: center; grid-column: 1/-1;">No devices found</div>';
        return;
    }

    container.innerHTML = devices.map(device => {
        // Add null/undefined checks
        if (!device || !device.device_id) {
            return '';
        }
        
        const timestamp = device.timestamp ? new Date(device.timestamp).toLocaleString() : 'Unknown';
        let dataDisplay = device.data_value || 'No data';
        
        // Try to parse JSON for better display
        try {
            const parsed = JSON.parse(device.data_value);
            if (typeof parsed === 'object' && parsed !== null) {
                dataDisplay = Object.entries(parsed)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('<br>');
            }
        } catch (e) {
            // Keep original value if not JSON
        }

        return `
            <div class="device-card" data-device-id="${device.device_id}">
                <div class="device-header">
                    <div class="device-name">
                        <span class="status-indicator"></span>
                        ${device.device_name || 'Unknown Device'}
                    </div>
                    <div class="device-id">${device.device_id}</div>
                </div>
                <div class="device-data">
                    <div class="data-value">${dataDisplay}</div>
                </div>
                <div class="timestamp">Last updated: ${timestamp}</div>
            </div>
        `;
    }).filter(html => html !== '').join(''); // Filter out empty strings

    // Add click listeners to device cards
    const deviceCards = container.querySelectorAll('.device-card');
    deviceCards.forEach(card => {
        card.addEventListener('click', function() {
            const deviceId = this.getAttribute('data-device-id');
            if (deviceId) {
                viewDeviceHistory(deviceId);
            }
        });
    });
}

function viewDeviceHistory(deviceId) {
    if (deviceId) {
        window.location.href = `/device/${deviceId}`;
    }
}

async function filterData() {
    const deviceFilter = document.getElementById('deviceFilter').value.trim();
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;

    let filtered = [...allDevices];

    // Device filter
    if (deviceFilter) {
        filtered = filtered.filter(device => {
            if (!device) return false;
            
            const deviceId = (device.device_id || '').toLowerCase();
            const deviceName = (device.device_name || '').toLowerCase();
            const filterLower = deviceFilter.toLowerCase();
            
            return deviceId.includes(filterLower) || deviceName.includes(filterLower);
        });
    }

    // Date filters
    if (fromDate) {
        const fromTimestamp = new Date(fromDate).getTime();
        filtered = filtered.filter(device => {
            if (!device || !device.timestamp) return false;
            return new Date(device.timestamp).getTime() >= fromTimestamp;
        });
    }

    if (toDate) {
        const toTimestamp = new Date(toDate).getTime();
        filtered = filtered.filter(device => {
            if (!device || !device.timestamp) return false;
            return new Date(device.timestamp).getTime() <= toTimestamp;
        });
    }

    filteredDevices = filtered;
    displayDevices(filtered);
}

function clearFilters() {
    document.getElementById('deviceFilter').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    filteredDevices = allDevices;
    displayDevices(allDevices);
}

async function refreshData() {
    document.getElementById('loading').style.display = 'block';
    // Clear existing data to show loading state
    document.getElementById('devicesContainer').innerHTML = '';
    await fetchDevices();
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => errorDiv.style.display = 'none', 5000);
    }
    console.error(message);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check if elements exist before adding listeners
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const deviceFilter = document.getElementById('deviceFilter');
    
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', filterData);
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }
    
    // Enter key support for filter input
    if (deviceFilter) {
        deviceFilter.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                filterData();
            }
        });
    }
    
    // Initial load
    fetchDevices();
});

// Auto-refresh every 30 seconds
setInterval(refreshData, 30000);
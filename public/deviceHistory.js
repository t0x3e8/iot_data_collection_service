let currentPage = 1;
let currentDeviceId = '';

function getDeviceIdFromUrl() {
  const pathParts = window.location.pathname.split('/');
  return pathParts[pathParts.length - 1];
}

async function loadDeviceHistory() {
  currentDeviceId = getDeviceIdFromUrl();
  if (!currentDeviceId) {
    showError('No device ID specified');
    return;
  }

  document.getElementById('deviceTitle').textContent = `Device History: ${currentDeviceId}`;

  try {
    const limit = document.getElementById('limitSelect').value;
    const offset = (currentPage - 1) * limit;
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;

    let url = `/api/device/${currentDeviceId}/history?limit=${limit}&offset=${offset}`;
    if (fromDate) {url += `&from_date=${encodeURIComponent(fromDate)}`;}
    if (toDate) {url += `&to_date=${encodeURIComponent(toDate)}`;}

    const response = await fetch(url);
    if (!response.ok) {throw new Error(`HTTP error! status: ${response.status}`);}

    const data = await response.json();
    const records = data.data || data || [];

    if (records.length === 0 && currentPage === 1) {
      showNoData();
    } else {
      displayData(records);
      updatePagination(records.length, parseInt(limit));
    }

    if (records.length > 0) {
      document.getElementById('deviceSubtitle').textContent = records[0].device_name || '';
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('dataTable').style.display = 'block';
  } catch (error) {
    showError(`Failed to load device history: ${  error.message}`);
    document.getElementById('loading').style.display = 'none';
  }
}

function displayData(data) {
  const tbody = document.getElementById('dataTableBody');

  tbody.innerHTML = data.map(record => {
    const timestamp = new Date(record.timestamp).toLocaleString();
    let dataDisplay;

    try {
      const parsed = JSON.parse(record.data_value);
      dataDisplay = `<div class="json-data">${formatJsonData(parsed)}</div>`;
    } catch {
      dataDisplay = `<div class="data-cell">${record.data_value}</div>`;
    }

    return `
            <tr>
                <td>${timestamp}</td>
                <td>${record.device_name}</td>
                <td>${dataDisplay}</td>
            </tr>
        `;
  }).join('');
}

function formatJsonData(jsonData) {
  if (typeof jsonData === 'object' && jsonData !== null) {
    return Object.entries(jsonData)
      .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
      .join('<br>');
  }
  return jsonData;
}

function showNoData() {
  document.getElementById('dataTable').innerHTML =
        '<div class="no-data">No data found for this device</div>';
  document.getElementById('dataTable').style.display = 'block';
}

function updatePagination(recordCount, limit) {
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  pageInfo.textContent = `Page ${currentPage}`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = recordCount < limit;
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    showLoadingAndReload();
  }
}

function nextPage() {
  currentPage++;
  showLoadingAndReload();
}

function applyFilters() {
  currentPage = 1;
  showLoadingAndReload();
}

function clearFilters() {
  document.getElementById('fromDate').value = '';
  document.getElementById('toDate').value = '';
  document.getElementById('limitSelect').value = '50';
  currentPage = 1;
  showLoadingAndReload();
}

function refreshData() {
  showLoadingAndReload();
}

function showLoadingAndReload() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('dataTable').style.display = 'none';
  loadDeviceHistory();
}

function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Button event listeners
  document.getElementById('applyFiltersBtn').addEventListener('click', applyFilters);
  document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);
  document.getElementById('refreshDataBtn').addEventListener('click', refreshData);
  document.getElementById('prevBtn').addEventListener('click', previousPage);
  document.getElementById('nextBtn').addEventListener('click', nextPage);

  // Enter key support for date inputs
  document.getElementById('fromDate').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  });

  document.getElementById('toDate').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  });

  // Limit select change listener
  document.getElementById('limitSelect').addEventListener('change', applyFilters);

  // Initial load
  loadDeviceHistory();
});

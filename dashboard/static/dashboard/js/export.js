// ── DATA FILE EXPORT STATE ─────────────────────────────────────────────────
let currentDataSource = 'clarity';
let currentExportFormat = 'geojson';
let availableFiles = [];

function selectDataSource(source) {
  currentDataSource = source;
  document.querySelectorAll('#tab-data .map-type-btn[data-source]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.source === source);
  });
  loadDataFiles();
}

function selectExportFormat(format) {
  currentExportFormat = format;
  document.querySelectorAll('#tab-data .map-type-btn[data-format]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.format === format);
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function loadDataFiles() {
  const tbody = document.getElementById('file-list-body');
  if (!tbody) return; // not on export page
  tbody.innerHTML = '<tr><td colspan="4" class="no-files-message">Loading files...</td></tr>';

  try {
    const fileType = document.getElementById('data-file-type');
    const dateFilter = document.getElementById('data-date-filter');

    let url = `/api/list-data-files/?source=${currentDataSource}`;
    if (fileType && fileType.value) url += `&type=${fileType.value}`;
    if (dateFilter && dateFilter.value) url += `&date=${dateFilter.value}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      showDataExportStatus(data.error, 'error');
      tbody.innerHTML = '<tr><td colspan="4" class="no-files-message">Error loading files</td></tr>';
      return;
    }

    availableFiles = data.files || [];

    if (availableFiles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="no-files-message">No files found for the selected filters</td></tr>';
      showDataExportStatus('No files available.', 'info');
    } else {
      renderFileList(availableFiles);
      showDataExportStatus(`${availableFiles.length} files available.`, 'success');
    }

    const badge = document.getElementById('file-count-badge');
    if (badge) badge.textContent = `${availableFiles.length} files`;

  } catch (error) {
    console.error('Error loading files:', error);
    showDataExportStatus('Failed to load files.', 'error');
    tbody.innerHTML = '<tr><td colspan="4" class="no-files-message">Failed to load files</td></tr>';
  }
}

function renderFileList(files) {
  const tbody = document.getElementById('file-list-body');
  tbody.innerHTML = '';

  files.forEach((file, index) => {
    const tr = document.createElement('tr');
    const extClass = file.ext === 'geojson' ? 'geojson' : (file.ext === 'csv' ? 'csv' : 'json');

    tr.innerHTML = `
      <td><input type="checkbox" class="file-checkbox" aria-label="${file.filename}" data-index="${index}" data-filename="${file.filename}" onchange="updateSelectionCount()" /></td>
      <td class="file-name-cell">${file.filename}</td>
      <td><span class="file-type-badge ${extClass}">${file.ext}</span></td>
      <td class="file-size-cell">${formatFileSize(file.size)}</td>
    `;
    tbody.appendChild(tr);
  });

  updateSelectionCount();
}

function toggleSelectAll() {
  const selectAll = document.getElementById('select-all-files').checked;
  document.querySelectorAll('.file-checkbox').forEach(cb => {
    cb.checked = selectAll;
  });
  updateSelectionCount();
}

function updateSelectionCount() {
  const checked = document.querySelectorAll('.file-checkbox:checked').length;
  const total = document.querySelectorAll('.file-checkbox').length;
  const selectAll = document.getElementById('select-all-files');
  if (selectAll) {
    selectAll.checked = checked === total && total > 0;
    selectAll.indeterminate = checked > 0 && checked < total;
  }
}

function getSelectedFiles() {
  const selected = [];
  document.querySelectorAll('.file-checkbox:checked').forEach(cb => {
    selected.push(cb.dataset.filename);
  });
  return selected;
}

async function exportSelectedFiles() {
  const selectedFiles = getSelectedFiles();
  const exportBtn = document.getElementById('data-export-btn');

  if (selectedFiles.length === 0) {
    showDataExportStatus('Please select at least one file to export.', 'error');
    return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  showDataExportStatus(`Preparing ${selectedFiles.length} file(s) for download...`, 'info');

  for (let i = 0; i < selectedFiles.length; i++) {
    const filename = selectedFiles[i];
    showDataExportStatus(`Downloading ${i + 1}/${selectedFiles.length}: ${filename}`, 'info');

    const downloadUrl = `/api/export-data-file/?source=${currentDataSource}&file=${encodeURIComponent(filename)}&format=${currentExportFormat}`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (i < selectedFiles.length - 1) {
      await sleep(500);
    }
  }

  exportBtn.disabled = false;
  exportBtn.innerHTML = '&#10515; Download Selected';
  showDataExportStatus(`${selectedFiles.length} file(s) exported successfully!`, 'success');
}

function showDataExportStatus(message, type) {
  const el = document.getElementById('data-export-status');
  if (el) {
    el.textContent = message;
    el.className = `export-status ${type}`;
  }
}

// ── UTILITY ────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── INIT: load data files on page load if on export page ───────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Only auto-load if we're on the export page (has the file list table body)
  if (document.getElementById('file-list-body')) {
    loadDataFiles();
  }
});
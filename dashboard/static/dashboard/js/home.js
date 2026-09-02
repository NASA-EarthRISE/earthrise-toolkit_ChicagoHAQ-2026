// Home Page Helpers:

// System Status Timestamps
function formatTimeAgo(timestamp) {
  const date = new Date(timestamp + 'Z');
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return diffMin + 'm ago';
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr + 'h ago';
  return Math.floor(diffHr / 24) + 'd ago';
}

// Render System Status
function renderStatusFeed(data) {
  const feed = document.getElementById('status-feed');
  let html = '';

  // Server Started 
  html += `
    <div style="padding:0.6rem 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
      <span style="color:var(--text); font-size:0.9rem;">Server Started</span>
      <span style="color:var(--text-muted); font-size:0.82rem; white-space:nowrap;">${formatTimeAgo(data.server_start)}</span>
    </div>`;

  // Dashboard Page Reloaded (from most recent page_refresh activity)
  const activities = data.recent_activities || [];
  const pageRefresh = activities.find(a => a.type === 'page_refresh');
  if (pageRefresh) {
    html += `
      <div style="padding:0.6rem 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <span style="color:var(--text); font-size:0.9rem;">Dashboard Reloaded</span>
        <span style="color:var(--text-muted); font-size:0.82rem; white-space:nowrap;">${formatTimeAgo(pageRefresh.timestamp)}</span>
      </div>`;
  }

  // Data Source Entries
  data.sources.forEach((src, idx) => {
    const fileCountText = src.file_count > 0
      ? `${src.file_count} file${src.file_count !== 1 ? 's' : ''} loaded`
      : 'No files loaded';
    const fileColor = src.file_count > 0 ? 'var(--success)' : '#e53e3e';

    // Use time ago from server_start as the reference for data sources
    const isLast = idx === data.sources.length - 1;
    const borderBottom = isLast ? '' : 'border-bottom:1px solid var(--border);';
    html += `
      <div style="padding:0.6rem 0; ${borderBottom}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:var(--text); font-size:0.9rem;">${src.name}</span>
          <span style="color:var(--text-muted); font-size:0.82rem; white-space:nowrap;">${formatTimeAgo(data.server_start)}</span>
        </div>
        <div style="margin-top:0.25rem; font-size:0.78rem; color:${fileColor};">${fileCountText}</div>
      </div>`;
  });

  feed.innerHTML = html;
}

// Render 'Data Load Status' (Stat Card)
function loadDataStatus(data) {
  const valueEl = document.getElementById('data-status-value');
  const subEl = document.getElementById('data-status-sub');
  
  if (!data || !data.sources) {
    valueEl.textContent = 'Error';
    valueEl.style.color = '#e53e3e';
    subEl.textContent = 'Failed to load status';
    return;
  }
  
  // Count the amount of files in each data/tempo, data/clarity, and data/fused folder
  const totalFiles = data.sources.reduce((sum, src) => sum + src.file_count, 0);
  const allLoaded = data.sources.every(src => src.file_count > 0);
  const noneLoaded = data.sources.every(src => src.file_count === 0);
  
  if (allLoaded) {
    valueEl.textContent = 'Complete';
    valueEl.style.color = 'var(--success)';
  } else if (noneLoaded) {
    valueEl.textContent = 'Failed';
    valueEl.style.color = '#e53e3e';
  } else {
    valueEl.textContent = 'Incomplete';
    valueEl.style.color = 'var(--warning)';
  }
  
  subEl.textContent = `Static Files Loaded: ${totalFiles}`;
}

// Fetch Data Status from "api/data-status/"
function fetchData() {
  fetch('/api/data-status/')
    .then(res => res.json())
    .then(data => {
      renderStatusFeed(data);
      loadDataStatus(data);
    })
    .catch(() => {
      document.getElementById('status-feed').innerHTML =
        '<div style="padding:0.5rem 0; color:#e53e3e;">Failed to load status.</div>';
      loadDataStatus(null);
    });
}

// Initialize when DOM is Ready
document.addEventListener('DOMContentLoaded', function() {
  fetchData();
  // Auto-refresh data status fetch every 60 seconds
  setInterval(fetchData, 60000);
});

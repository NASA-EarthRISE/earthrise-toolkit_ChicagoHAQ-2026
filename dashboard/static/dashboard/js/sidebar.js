// These are NOT linked
 // Mobile hamburger menu toggle (only visible on small screens)
function MenuToggle(el) {
    el.classList.toggle('change');
    document.getElementById('nav-links').classList.toggle('open');
}

// Sidebar toggle with animated hamburger
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('sidebar-hamburger');
    sidebar.classList.toggle('collapsed');
    hamburger.classList.toggle('active');
    // Trigger map resize if on map page
    if (typeof map !== 'undefined' && map.invalidateSize) {
        setTimeout(() => map.invalidateSize(), 350);
    }
}
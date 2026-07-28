
// Mobile menu toggle button
function MenuToggle(el) {
    el.classList.toggle('change');
    document.getElementById('nav-links').classList.toggle('open');
}

// Show mobile menu container on small screens
function checkMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu-container');
    if (window.innerWidth <= 992) {
        mobileMenu.style.display = 'block';
    } else {
        mobileMenu.style.display = 'none';
    }
}

// Run on load and resize
window.addEventListener('load', checkMobileMenu);
window.addEventListener('resize', checkMobileMenu);
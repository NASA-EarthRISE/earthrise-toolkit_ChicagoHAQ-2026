
// Mobile Arrow Toggle Button JS
function MenuToggle(el) {
    el.classList.toggle('change');
    document.getElementById('nav-links').classList.toggle('open');
}

// Show Mobile Arrow on Small Screens
function checkMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu-container');
    if (window.innerWidth <= 992) {
        mobileMenu.style.display = 'block';
    } else {
        mobileMenu.style.display = 'none';
    }
}

// Run on Window Load and Resize
window.addEventListener('load', checkMobileMenu);
window.addEventListener('resize', checkMobileMenu);
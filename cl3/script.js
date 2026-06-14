// Mobile Menu Toggle
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mainNav = document.getElementById('main-nav');

if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', () => {
        mainNav.classList.toggle('active');
        // Hide the mobile menu button when menu is open
        if (mainNav.classList.contains('active')) {
            mobileMenuBtn.style.display = 'none';
        } else {
            mobileMenuBtn.style.display = 'flex';
        }
    });
    // When menu is closed by clicking a nav link, show the button again
    mainNav.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && mainNav.classList.contains('active')) {
            mainNav.classList.remove('active');
            mobileMenuBtn.style.display = 'flex';
        }
    });

    // Close drawer when clicking outside nav and menu button
    document.addEventListener('click', (e) => {
        const isMenuOpen = mainNav.classList.contains('active');
        const isClickInsideNav = mainNav.contains(e.target);
        const isClickOnMenuBtn = mobileMenuBtn.contains(e.target);
        if (isMenuOpen && !isClickInsideNav && !isClickOnMenuBtn) {
            mainNav.classList.remove('active');
            mobileMenuBtn.style.display = 'flex';
        }
    });
}

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');

if (themeToggle) {
    // Check for saved theme preference or default to light
    const savedTheme = localStorage.getItem('modello-theme') || 'light';

    // Apply the saved theme
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.querySelector('i').classList.remove('fa-moon');
        themeToggle.querySelector('i').classList.add('fa-sun');
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const icon = themeToggle.querySelector('i');

        if (document.body.classList.contains('dark-theme')) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            localStorage.setItem('modello-theme', 'dark');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            localStorage.setItem('modello-theme', 'light');
        }
    });
}

// Scroll Animation Observer
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe service cards and testimonial cards
document.addEventListener('DOMContentLoaded', () => {
    const serviceCards = document.querySelectorAll('.service-card');
    const testimonialCards = document.querySelectorAll('.testimonial-card');

    serviceCards.forEach(card => {
        observer.observe(card);
    });

    testimonialCards.forEach(card => {
        observer.observe(card);
    });
});

// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > 100) {
        header.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.1)';
        header.style.padding = '0.5rem 0';
    } else {
        header.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.05)';
        header.style.padding = '1.2rem 0';
    }
});
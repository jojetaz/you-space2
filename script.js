document.addEventListener('DOMContentLoaded', function() {
    // Toggle de tema claro/oscuro
    const toggleKnob = document.querySelector('.toggle-knob');
    const toggleSwitch = document.querySelector('.toggle-switch');
    
    if (toggleSwitch && toggleKnob) {
        toggleSwitch.addEventListener('click', function() {
            toggleKnob.classList.toggle('active');
            const isDark = toggleKnob.classList.contains('active');
            document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
            // Actualizar icono
            const themeIcon = document.querySelector('.theme-icon');
            if (themeIcon) {
                themeIcon.textContent = isDark ? '🌙' : '☀️';
            }
        });
    }

    // Botón CTA - Explorar Ahora
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelector('.cards-grid')?.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Búsqueda (placeholder para futura implementación)
    const searchBtn = document.querySelector('.search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            // Aquí se puede implementar un modal de búsqueda
            console.log('Búsqueda - por implementar');
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Toggle de tema claro/oscuro
    const toggleKnob = document.querySelector('.toggle-knob');
    const toggleSwitch = document.querySelector('.toggle-switch');
    
    if (toggleSwitch && toggleKnob) {
        toggleSwitch.addEventListener('click', function() {
            toggleKnob.classList.toggle('active');
            const isDark = toggleKnob.classList.contains('active');
            document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
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

    // Búsqueda
    const searchBtn = document.querySelector('.search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showModal('Búsqueda', 'La función de búsqueda estará disponible próximamente.');
        });
    }

    // Modal "Próximamente"
    const modal = document.getElementById('modal-overlay');
    const modalText = document.getElementById('modal-text');
    const modalClose = document.getElementById('modal-close');

    function showModal(title, text) {
        if (modal && modalText) {
            const titleEl = modal.querySelector('.modal-title');
            if (titleEl) titleEl.textContent = title;
            modalText.textContent = text;
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal() {
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal?.classList.contains('active')) {
            closeModal();
        }
    });

    // Tarjetas - mostrar modal al hacer clic
    document.querySelectorAll('.card').forEach(function(card) {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            const category = this.getAttribute('data-category') || 'Esta categoría';
            showModal('Próximamente', category + ' estará disponible pronto. ¡Sigue atento!');
        });
    });

    // Enlaces de navegación
    document.querySelectorAll('.nav-links a').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const nav = this.getAttribute('data-nav');
            if (nav === 'inicio') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const labels = {
                    herramientas: 'Herramientas',
                    cursos: 'Cursos',
                    ofertas: 'Ofertas',
                    comunidad: 'Comunidad',
                    contacto: 'Contacto'
                };
                showModal('Próximamente', labels[nav] + ' estará disponible pronto.');
            }
        });
    });

    // Logo - scroll al inicio
    document.querySelector('.logo')?.addEventListener('click', function(e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

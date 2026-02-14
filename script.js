document.addEventListener('DOMContentLoaded', function() {
    // Datos por defecto de herramientas (se guardan en localStorage)
    const TOOLS_KEY = 'you-space-tools';
    
    const defaultTools = [
        { id: '1', nombre: 'tensor.art', descripcion: 'Generación de video (1 por día) e imagen (50 por día), sin censura', url: 'https://tensor.art', videoUrl: '', fecha: '23/06/2025' },
        { id: '2', nombre: 'ltx estudio', descripcion: 'Imagen y video gratis', url: 'https://ltx.studio', videoUrl: '', fecha: '21/06/2025' },
        { id: '3', nombre: 'seedance v1', descripcion: 'Mejor generador de video del momento junio 2025 gratis, texto o imagen a video', url: 'https://seedance.ai', videoUrl: '', fecha: '10/07/2025' },
        { id: '4', nombre: 'seaart.ia', descripcion: 'Generación de videos e imagen sin censura', url: 'https://seaart.ai', videoUrl: '', fecha: '10/07/2025' }
    ];

    function getTools() {
        try {
            const saved = localStorage.getItem(TOOLS_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                return Array.isArray(data) && data.length > 0 ? data : defaultTools;
            }
        } catch (e) {}
        return defaultTools;
    }

    function saveTools(tools) {
        localStorage.setItem(TOOLS_KEY, JSON.stringify(tools));
    }

    function renderToolsTable() {
        const tbody = document.getElementById('tools-tbody');
        if (!tbody) return;
        const tools = getTools();
        tbody.innerHTML = tools.map(t => `
            <tr data-id="${t.id}">
                <td><strong>${escapeHtml(t.nombre)}</strong></td>
                <td>${escapeHtml(t.descripcion)}</td>
                <td>
                    <a href="${escapeHtml(t.url)}" target="_blank" rel="noopener" class="tool-btn tool-btn-visitar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        Visitar
                    </a>
                </td>
                <td>
                    ${t.videoUrl ? `<a href="${escapeHtml(t.videoUrl)}" target="_blank" class="tool-btn tool-btn-video">▶ Ver Video</a>` : '<span class="tool-no-video">—</span>'}
                </td>
                <td>${escapeHtml(t.fecha)}</td>
                <td>
                    <div class="tool-actions">
                        <button class="tool-btn tool-btn-edit" data-edit="${t.id}" title="Editar">✎</button>
                        <button class="tool-btn tool-btn-delete" data-delete="${t.id}" title="Eliminar">🗑</button>
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.dataset.delete;
                if (confirm('¿Eliminar esta herramienta?')) {
                    const tools = getTools().filter(t => t.id !== id);
                    saveTools(tools);
                    renderToolsTable();
                }
            });
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function showToolsPanel() {
        document.getElementById('hero-section')?.classList.add('hidden');
        document.getElementById('cards-section')?.classList.add('hidden');
        document.getElementById('tools-panel')?.classList.add('active');
        renderToolsTable();
    }

    function hideToolsPanel() {
        document.getElementById('hero-section')?.classList.remove('hidden');
        document.getElementById('cards-section')?.classList.remove('hidden');
        document.getElementById('tools-panel')?.classList.remove('active');
    }

    document.getElementById('tools-back')?.addEventListener('click', hideToolsPanel);

    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            const cat = this.getAttribute('data-category');
            if (cat === 'Generación de Video e IA' || cat === 'Recursos de IA') {
                showToolsPanel();
            } else {
                showModal('Próximamente', cat + ' estará disponible pronto. ¡Sigue atento!');
            }
        });
    });

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

    // Enlaces de navegación
    document.querySelectorAll('.nav-links a').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const nav = this.getAttribute('data-nav');
            if (nav === 'inicio') {
                hideToolsPanel();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (nav === 'herramientas') {
                showToolsPanel();
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

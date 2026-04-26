document.addEventListener('DOMContentLoaded', function() {
    const AUTH_KEY = 'you-space-auth';
    const THEME_KEY = 'you-space-theme';
    const INTRO_KEY = 'you-space-intro-seen';
    const VIP_CATEGORY = 'Herramientas Exclusivas VIP';
    const CATEGORIES = Array.from(document.querySelectorAll('.card')).map((card) => card.getAttribute('data-category'));

    let authToken = null;
    let activeUser = { username: 'Invitado', role: 'invitado', plan: 'free', vipStatus: 'none', vipActive: false };
    let activeCategory = 'all';
    let cachedTools = [];
    let currentPanel = 'home';

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function getToday() {
        const now = new Date();
        return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }

    function saveAuthState(data) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(data));
    }

    function getAuthState() {
        try {
            const raw = localStorage.getItem(AUTH_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_error) {
            return null;
        }
    }

    function clearAuthState() {
        localStorage.removeItem(AUTH_KEY);
    }

    function isAdmin() {
        return activeUser.role === 'admin';
    }

    function hasVipAccess() {
        return isAdmin() || activeUser.vipActive;
    }

    async function apiRequest(path, options) {
        const config = options || {};
        const headers = { ...(config.headers || {}) };
        if (authToken) headers.Authorization = `Bearer ${authToken}`;
        if (config.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

        const response = await fetch(path, { method: config.method || 'GET', headers, body: config.body });
        let data = null;
        if (response.status !== 204) {
            const text = await response.text();
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch (_err) {
                    data = { message: text };
                }
            }
        }
        if (!response.ok) {
            const msg = (data && (data.error || data.message)) || `Error en solicitud (${response.status})`;
            throw new Error(msg);
        }
        return data;
    }

    function showInfoModal(title, text) {
        const overlay = document.getElementById('modal-overlay');
        if (!overlay) return;
        overlay.querySelector('.modal-title').textContent = title;
        document.getElementById('modal-text').textContent = text;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeInfoModal() {
        document.getElementById('modal-overlay')?.classList.remove('active');
        document.body.style.overflow = '';
    }

    function closeAllPanels() {
        document.getElementById('hero-section')?.classList.add('hidden');
        document.getElementById('cards-section')?.classList.add('hidden');
        document.getElementById('tools-panel')?.classList.remove('active');
        document.getElementById('community-panel')?.classList.remove('active');
    }

    function showHome() {
        currentPanel = 'home';
        document.getElementById('hero-section')?.classList.remove('hidden');
        document.getElementById('cards-section')?.classList.remove('hidden');
        document.getElementById('tools-panel')?.classList.remove('active');
        document.getElementById('community-panel')?.classList.remove('active');
    }

    async function showToolsPanel() {
        currentPanel = 'tools';
        closeAllPanels();
        document.getElementById('tools-panel')?.classList.add('active');
        await refreshTools();
        renderAccessUI();
    }

    async function showCommunityPanel() {
        currentPanel = 'community';
        closeAllPanels();
        document.getElementById('community-panel')?.classList.add('active');
        await loadForumComments();
    }

    function renderAccessUI() {
        const accessBtn = document.getElementById('user-access-btn');
        const addBtn = document.getElementById('tools-add-btn');
        if (accessBtn) {
            const tier = hasVipAccess() ? 'VIP' : (activeUser.plan === 'vip' ? 'VIP pendiente' : 'Gratis');
            accessBtn.textContent = `Acceso: ${activeUser.username} (${activeUser.role} - ${tier})`;
        }
        if (addBtn) addBtn.classList.toggle('hidden', !isAdmin());
    }

    function renderToolsTable(list, customMessage) {
        const tbody = document.getElementById('tools-tbody');
        const label = document.getElementById('tools-panel-category');
        if (!tbody) return;
        label.textContent = `Categoría activa: ${activeCategory === 'all' ? 'Todas las categorías' : activeCategory}`;

        if (customMessage) {
            tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(customMessage)}</td></tr>`;
            return;
        }

        if (!list || list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">No hay herramientas en esta categoría.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map((t) => `
            <tr data-id="${t.id}">
                <td><strong>${escapeHtml(t.nombre)}</strong></td>
                <td>${escapeHtml(t.descripcion)}</td>
                <td><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener" class="tool-btn tool-btn-visitar">Visitar</a></td>
                <td>${t.videoUrl ? `<a href="${escapeHtml(t.videoUrl)}" target="_blank" rel="noopener" class="tool-btn tool-btn-video">▶ Ver Video</a>` : '<span class="tool-no-video">—</span>'}</td>
                <td>${escapeHtml(t.fecha)}</td>
                <td>${isAdmin() ? `<div class="tool-actions"><button class="tool-btn tool-btn-edit" data-edit="${t.id}">✎</button><button class="tool-btn tool-btn-delete" data-delete="${t.id}">🗑</button></div>` : '<span class="tool-no-video">Sin permisos de edición</span>'}</td>
            </tr>
        `).join('');

        if (!isAdmin()) return;
        tbody.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async function() {
            if (!confirm('¿Eliminar esta herramienta?')) return;
            try {
                await apiRequest(`/api/tools/${encodeURIComponent(this.dataset.delete)}`, { method: 'DELETE' });
                await refreshTools();
            } catch (error) {
                showInfoModal('Error', error.message);
            }
        }));

        tbody.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', async function() {
            const current = list.find((tool) => tool.id === this.dataset.edit);
            if (!current) return;
            const payload = await askToolData(current);
            if (!payload) return;
            try {
                await apiRequest(`/api/tools/${encodeURIComponent(current.id)}`, { method: 'PUT', body: JSON.stringify(payload) });
                await refreshTools();
            } catch (error) {
                showInfoModal('Error', error.message);
            }
        }));
    }

    async function refreshTools() {
        try {
            const query = activeCategory === 'all' ? '' : `?categoria=${encodeURIComponent(activeCategory)}`;
            cachedTools = await apiRequest(`/api/tools${query}`);
            renderToolsTable(cachedTools);
        } catch (error) {
            if (activeCategory === VIP_CATEGORY) {
                renderToolsTable([], 'Esta sección es exclusiva para usuarios VIP.');
                openSubscriptionModal();
                return;
            }
            renderToolsTable([], error.message || 'No se pudieron cargar herramientas');
        }
    }

    async function askToolData(current) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('tool-form-overlay');
            const form = document.getElementById('tool-form');
            const categoria = document.getElementById('tool-categoria');
            const nombre = document.getElementById('tool-nombre');
            const descripcion = document.getElementById('tool-descripcion');
            const url = document.getElementById('tool-url');
            const videoUrl = document.getElementById('tool-video-url');
            const fecha = document.getElementById('tool-fecha');
            const cancel = document.getElementById('tool-form-cancel');

            document.getElementById('tool-form-title').textContent = current && current.id ? 'Editar herramienta' : 'Nueva herramienta';
            categoria.innerHTML = CATEGORIES.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
            categoria.value = current.categoria || (activeCategory === 'all' ? CATEGORIES[0] : activeCategory);
            nombre.value = current.nombre || '';
            descripcion.value = current.descripcion || '';
            url.value = current.url || 'https://';
            videoUrl.value = current.videoUrl || '';
            fecha.value = current.fecha || getToday();

            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';

            function cleanup(result) {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
                form.removeEventListener('submit', onSubmit);
                cancel.removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onOverlay);
                resolve(result);
            }
            function onSubmit(e) {
                e.preventDefault();
                cleanup({
                    categoria: categoria.value.trim(),
                    nombre: nombre.value.trim(),
                    descripcion: descripcion.value.trim(),
                    url: url.value.trim(),
                    videoUrl: videoUrl.value.trim(),
                    fecha: fecha.value.trim()
                });
            }
            function onCancel() { cleanup(null); }
            function onOverlay(e) { if (e.target === overlay) cleanup(null); }
            form.addEventListener('submit', onSubmit);
            cancel.addEventListener('click', onCancel);
            overlay.addEventListener('click', onOverlay);
        });
    }

    async function loadForumComments() {
        const list = document.getElementById('forum-list');
        try {
            const comments = await apiRequest('/api/forum/comments');
            if (!comments.length) {
                list.innerHTML = '<div class="forum-comment">Aún no hay comentarios. Sé el primero en participar.</div>';
                return;
            }
            list.innerHTML = comments.map((item) => `
                <article class="forum-comment">
                    <div class="forum-comment-meta">@${escapeHtml(item.username)} - ${escapeHtml(item.createdAt)}</div>
                    <div class="forum-comment-content">${escapeHtml(item.content)}</div>
                </article>
            `).join('');
        } catch (error) {
            list.innerHTML = `<div class="forum-comment">${escapeHtml(error.message)}</div>`;
        }
    }

    function openAuthModal() {
        const overlay = document.getElementById('auth-overlay');
        const mode = document.getElementById('auth-mode');
        const planWrapper = document.getElementById('auth-plan-wrapper');
        const logoutBtn = document.getElementById('auth-logout-btn');
        const errorEl = document.getElementById('auth-error');
        const form = document.getElementById('auth-form');
        const cancel = document.getElementById('auth-cancel');

        document.getElementById('auth-username').value = '';
        document.getElementById('auth-password').value = '';
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
        }
        mode.value = 'login';
        planWrapper.classList.add('hidden');
        logoutBtn.classList.toggle('hidden', activeUser.role === 'invitado');

        function close() {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            mode.removeEventListener('change', onModeChange);
            form.removeEventListener('submit', onSubmit);
            cancel.removeEventListener('click', onCancel);
            logoutBtn.removeEventListener('click', onLogout);
            overlay.removeEventListener('click', onOverlay);
        }
        function onModeChange() {
            planWrapper.classList.toggle('hidden', mode.value !== 'register');
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.add('hidden');
            }
        }
        async function onSubmit(e) {
            e.preventDefault();
            const username = document.getElementById('auth-username').value.trim();
            const password = document.getElementById('auth-password').value;
            const plan = document.getElementById('auth-plan').value;
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.add('hidden');
            }
            try {
                const payload = mode.value === 'register'
                    ? await apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, plan }) })
                    : await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
                if (!payload || !payload.token || !payload.user) {
                    throw new Error('Respuesta inválida del servidor al iniciar sesión. Intenta nuevamente en unos segundos.');
                }
                authToken = payload.token;
                activeUser = payload.user;
                saveAuthState({ token: authToken, user: activeUser });
                renderAccessUI();
                if (currentPanel === 'tools') await refreshTools();
                if (currentPanel === 'community') await loadForumComments();
                close();
                if (activeUser.plan === 'vip' && !activeUser.vipActive) openSubscriptionModal();
            } catch (error) {
                if (errorEl) {
                    errorEl.textContent = error.message || 'No se pudo completar el acceso.';
                    errorEl.classList.remove('hidden');
                }
            }
        }
        function onCancel() { close(); }
        function onOverlay(e) { if (e.target === overlay) close(); }
        function onLogout() {
            authToken = null;
            activeUser = { username: 'Invitado', role: 'invitado', plan: 'free', vipStatus: 'none', vipActive: false };
            clearAuthState();
            renderAccessUI();
            close();
        }

        mode.addEventListener('change', onModeChange);
        form.addEventListener('submit', onSubmit);
        cancel.addEventListener('click', onCancel);
        logoutBtn.addEventListener('click', onLogout);
        overlay.addEventListener('click', onOverlay);
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function openSubscriptionModal() {
        const overlay = document.getElementById('subscription-overlay');
        const closeBtn = document.getElementById('subscription-close');
        const mpBtn = document.getElementById('subscription-mercadopago-btn');
        const stripeBtn = document.getElementById('subscription-stripe-btn');
        const paypalBtn = document.getElementById('subscription-paypal-btn');
        const activateInfoBtn = document.getElementById('subscription-activate-info');
        const planButtons = Array.from(document.querySelectorAll('#subscription-plans .subscription-plan'));
        const billingButtons = Array.from(document.querySelectorAll('#subscription-billing-toggle .subscription-billing-btn'));
        const dynamicSavingCard = document.getElementById('subscription-dynamic-saving');
        const dynamicSavingValue = document.getElementById('subscription-saving-value');
        const dynamicSavingNote = document.getElementById('subscription-saving-note');
        let selectedPlanId = 'vip-monthly';
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        function animatePercent(toValue) {
            if (!dynamicSavingValue) return;
            const fromValue = parseInt(dynamicSavingValue.textContent, 10) || 0;
            const start = performance.now();
            const duration = 260;

            function tick(now) {
                const progress = Math.min((now - start) / duration, 1);
                const current = Math.round(fromValue + (toValue - fromValue) * progress);
                dynamicSavingValue.textContent = `${current}%`;
                if (progress < 1) requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
        }

        function syncPlanUI(planId) {
            selectedPlanId = planId === 'vip-yearly' ? 'vip-yearly' : 'vip-monthly';
            planButtons.forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-plan') === selectedPlanId));
            billingButtons.forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-plan') === selectedPlanId));
            if (dynamicSavingCard && dynamicSavingNote) {
                const isYearly = selectedPlanId === 'vip-yearly';
                dynamicSavingCard.classList.toggle('yearly', isYearly);
                animatePercent(isYearly ? 25 : 0);
                dynamicSavingNote.textContent = isYearly
                    ? 'Ahorro aproximado de $29.89 USD frente al pago mensual.'
                    : 'Selecciona plan anual para ver ahorro estimado.';
            }
        }

        function close() {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            closeBtn.removeEventListener('click', onClose);
            mpBtn.removeEventListener('click', onMercadoPago);
            stripeBtn.removeEventListener('click', onStripe);
            paypalBtn.removeEventListener('click', onPaypal);
            activateInfoBtn.removeEventListener('click', onActivateInfo);
            overlay.removeEventListener('click', onOverlay);
            planButtons.forEach((btn) => btn.removeEventListener('click', onPlanSelect));
            billingButtons.forEach((btn) => btn.removeEventListener('click', onBillingSelect));
        }
        function onClose() { close(); }
        function onOverlay(e) { if (e.target === overlay) close(); }
        function onPlanSelect(e) {
            const planId = e.currentTarget.getAttribute('data-plan') || 'vip-monthly';
            syncPlanUI(planId);
        }
        function onBillingSelect(e) {
            const planId = e.currentTarget.getAttribute('data-plan') || 'vip-monthly';
            syncPlanUI(planId);
        }
        async function startCheckout(provider, providerName) {
            try {
                if (!authToken) {
                    close();
                    openAuthModal();
                    return;
                }
                const payload = await apiRequest('/api/subscription/create-checkout', {
                    method: 'POST',
                    body: JSON.stringify({ planId: selectedPlanId, provider })
                });
                const checkoutUrl = payload.checkoutUrl || payload.sandboxCheckoutUrl;
                if (!checkoutUrl) {
                    close();
                    showInfoModal('Pagos', `No se pudo generar el enlace de pago para ${providerName}. Revisa la configuración del servidor.`);
                    return;
                }
                window.location.href = checkoutUrl;
            } catch (error) {
                close();
                showInfoModal('Pagos', error.message || `No se pudo iniciar el checkout de ${providerName}.`);
            }
        }
        function onMercadoPago() { return startCheckout('mercadopago', 'Mercado Pago'); }
        function onStripe() {
            return startCheckout('stripe', 'Stripe');
        }
        function onPaypal() {
            return startCheckout('paypal', 'PayPal');
        }
        function onActivateInfo() {
            close();
            showInfoModal('Activación VIP', 'El acceso VIP se activa automáticamente cuando el proveedor de pago confirma la transacción.');
        }

        closeBtn.addEventListener('click', onClose);
        mpBtn.addEventListener('click', onMercadoPago);
        stripeBtn.addEventListener('click', onStripe);
        paypalBtn.addEventListener('click', onPaypal);
        activateInfoBtn.addEventListener('click', onActivateInfo);
        overlay.addEventListener('click', onOverlay);
        planButtons.forEach((btn) => btn.addEventListener('click', onPlanSelect));
        billingButtons.forEach((btn) => btn.addEventListener('click', onBillingSelect));
        syncPlanUI(selectedPlanId);
    }

    async function restoreSession() {
        const saved = getAuthState();
        if (!saved || !saved.token) return;
        authToken = saved.token;
        try {
            activeUser = await apiRequest('/api/auth/me');
            saveAuthState({ token: authToken, user: activeUser });
        } catch (_error) {
            authToken = null;
            clearAuthState();
        }
    }

    function initTheme() {
        const saved = localStorage.getItem(THEME_KEY) || 'dark';
        const knob = document.querySelector('.toggle-knob');
        const icon = document.querySelector('.theme-icon');
        document.body.setAttribute('data-theme', saved);
        const dark = saved === 'dark';
        knob?.classList.toggle('active', dark);
        if (icon) icon.textContent = dark ? '🌙' : '☀️';
    }

    document.getElementById('modal-close')?.addEventListener('click', closeInfoModal);
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeInfoModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInfoModal(); });

    document.getElementById('tools-back')?.addEventListener('click', showHome);
    document.getElementById('community-back')?.addEventListener('click', showHome);
    document.getElementById('user-access-btn')?.addEventListener('click', openAuthModal);

    document.querySelectorAll('.card').forEach((card) => {
        card.addEventListener('click', async (e) => {
            e.preventDefault();
            activeCategory = card.getAttribute('data-category') || 'all';
            await showToolsPanel();
        });
    });

    document.querySelectorAll('.nav-links a').forEach((link) => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const nav = link.getAttribute('data-nav');
            if (nav === 'inicio') return showHome();
            if (nav === 'comunidad') return showCommunityPanel();
            if (nav === 'contacto') {
                showInfoModal('Contacto', 'Puedes crear un usuario gratis o VIP y participar en la comunidad. Próximamente añadiremos soporte directo.');
                return;
            }
            if (nav === 'suscripcion') {
                openSubscriptionModal();
            }
        });
    });

    document.querySelector('.logo')?.addEventListener('click', (e) => {
        e.preventDefault();
        showHome();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.querySelector('.cta-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.cards-grid')?.scrollIntoView({ behavior: 'smooth' });
    });

    document.querySelector('.search-btn')?.addEventListener('click', () => {
        if (currentPanel !== 'tools') return showInfoModal('Búsqueda', 'Abre una categoría para buscar herramientas.');
        const term = prompt('Buscar herramienta por nombre o descripción:');
        if (term === null) return;
        const query = term.trim().toLowerCase();
        if (!query) return renderToolsTable(cachedTools);
        renderToolsTable(cachedTools.filter((t) => t.nombre.toLowerCase().includes(query) || t.descripcion.toLowerCase().includes(query)));
    });

    document.querySelector('.toggle-switch')?.addEventListener('click', function() {
        const current = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, current);
        initTheme();
    });

    document.getElementById('tools-add-btn')?.addEventListener('click', async () => {
        if (!isAdmin()) return;
        const payload = await askToolData({ categoria: activeCategory === 'all' ? CATEGORIES[0] : activeCategory });
        if (!payload) return;
        try {
            await apiRequest('/api/tools', { method: 'POST', body: JSON.stringify(payload) });
            await refreshTools();
        } catch (error) {
            showInfoModal('Error', error.message);
        }
    });

    document.getElementById('forum-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!authToken) {
            showInfoModal('Comunidad', 'Para comentar debes crear un usuario gratis o VIP e iniciar sesión.');
            openAuthModal();
            return;
        }
        const input = document.getElementById('forum-input');
        const content = input.value.trim();
        if (!content) return;
        try {
            await apiRequest('/api/forum/comments', { method: 'POST', body: JSON.stringify({ content }) });
            input.value = '';
            await loadForumComments();
        } catch (error) {
            showInfoModal('Error', error.message);
        }
    });

    restoreSession().finally(async function() {
        initTheme();
        renderAccessUI();
        showHome();
        const searchParams = new URLSearchParams(window.location.search);
        const paymentStatus = searchParams.get('payment');
        const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id');
        if (paymentStatus === 'success') {
            await restoreSession();
            renderAccessUI();
            if (authToken && paymentId) {
                try {
                    const confirmation = await apiRequest('/api/subscription/confirm-payment', {
                        method: 'POST',
                        body: JSON.stringify({ paymentId })
                    });
                    if (confirmation?.user) {
                        activeUser = confirmation.user;
                        saveAuthState({ token: authToken, user: activeUser });
                        renderAccessUI();
                    }
                    if (confirmation?.paymentStatus === 'approved') {
                        showInfoModal('Pago aprobado', 'Tu plan VIP fue activado correctamente.');
                    } else {
                        showInfoModal('Pago recibido', 'El pago fue recibido y está en validación. VIP se activará cuando Mercado Pago lo confirme.');
                    }
                } catch (_error) {
                    showInfoModal('Pago recibido', 'Recibimos el retorno del pago. Si VIP no se activa en unos minutos, vuelve a iniciar sesión.');
                }
            } else {
                showInfoModal('Pago recibido', 'Si Mercado Pago confirmó el pago, tu plan VIP quedará activo en unos segundos.');
            }
            window.history.replaceState({}, '', window.location.pathname);
        } else if (paymentStatus === 'pending') {
            showInfoModal('Pago pendiente', 'Tu pago está pendiente de confirmación. Te avisaremos cuando se active VIP.');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (paymentStatus === 'failure') {
            showInfoModal('Pago no completado', 'No se pudo completar el pago. Puedes reintentar cuando quieras.');
            window.history.replaceState({}, '', window.location.pathname);
        }
        if (!localStorage.getItem(INTRO_KEY)) {
            localStorage.setItem(INTRO_KEY, '1');
            openSubscriptionModal();
        }
    });
});

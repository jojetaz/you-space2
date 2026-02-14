document.addEventListener('DOMContentLoaded', function() {
    let activeWindow = null;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let currentTheme = 'windows';

    function updateClock() {
        const now = new Date();
        let h = now.getHours();
        let m = now.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        m = m < 10 ? '0' + m : m;
        const timeEl = document.querySelector('.time');
        if (timeEl) timeEl.textContent = h + ':' + m + ' ' + ampm;
    }
    updateClock();
    setInterval(updateClock, 60000);

    function activateWindow(windowId) {
        if (activeWindow) {
            activeWindow.classList.remove('active');
            const tb = document.querySelector(`.taskbar-item[data-window="${activeWindow.id}"]`);
            if (tb) tb.classList.remove('active');
        }
        const w = document.getElementById(windowId);
        if (w) {
            w.classList.add('active');
            w.style.zIndex = 10;
            activeWindow = w;
            const tb = document.querySelector(`.taskbar-item[data-window="${windowId}"]`);
            if (tb) tb.classList.add('active');
            else createTaskbarItem(windowId);
        }
    }

    function createTaskbarItem(windowId) {
        const w = document.getElementById(windowId);
        if (!w) return;
        const container = document.querySelector('.taskbar-items');
        const item = document.createElement('div');
        item.className = 'taskbar-item active';
        item.dataset.window = windowId;
        const title = w.querySelector('.window-title').textContent;
        const iconSrc = {
            'file-explorer': 'icons/folder.png',
            'browser': 'icons/browser.png',
            'notepad': 'icons/notepad.png',
            'calculator': 'icons/calculator.png',
            'settings': 'icons/settings.png',
            'word': 'icons/office/word.png',
            'excel': 'icons/office/excel.png',
            'powerpoint': 'icons/office/powerpoint.png'
        }[windowId] || 'icons/app.png';
        item.innerHTML = `<img src="${iconSrc}" alt="${title}"><span>${title}</span>`;
        item.addEventListener('click', function() {
            const target = document.getElementById(windowId);
            if (target.classList.contains('active')) {
                target.classList.remove('active');
                this.classList.remove('active');
            } else activateWindow(windowId);
        });
        container.appendChild(item);
    }

    document.querySelectorAll('.icon').forEach(icon => {
        icon.addEventListener('click', function() {
            activateWindow(this.dataset.window);
        });
    });

    document.querySelectorAll('.start-menu-item[data-window]').forEach(item => {
        item.addEventListener('click', function() {
            activateWindow(this.dataset.window);
            document.querySelector('.start-menu').classList.remove('active');
        });
    });

    document.querySelector('.start-button')?.addEventListener('click', function() {
        document.querySelector('.start-menu').classList.toggle('active');
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.start-menu') && !e.target.closest('.start-button')) {
            document.querySelector('.start-menu')?.classList.remove('active');
        }
    });

    document.querySelectorAll('.window-controls span').forEach(ctrl => {
        ctrl.addEventListener('click', function() {
            const w = this.closest('.window');
            if (this.classList.contains('minimize')) {
                w.classList.remove('active');
                document.querySelector(`.taskbar-item[data-window="${w.id}"]`)?.classList.remove('active');
            } else if (this.classList.contains('maximize')) {
                if (w.style.width === '100vw') {
                    w.style.cssText = 'width: 600px; height: 400px; top: 100px; left: 100px;';
                } else {
                    w.style.cssText = 'width: 100vw; height: calc(100vh - 40px); top: 0; left: 0;';
                }
            } else if (this.classList.contains('close')) {
                w.classList.remove('active');
                document.querySelector(`.taskbar-item[data-window="${w.id}"]`)?.remove();
            }
        });
    });

    document.querySelectorAll('.window-header').forEach(header => {
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('.window-controls')) return;
            const w = this.closest('.window');
            activateWindow(w.id);
            isDragging = true;
            dragOffsetX = e.clientX - w.getBoundingClientRect().left;
            dragOffsetY = e.clientY - w.getBoundingClientRect().top;
            w.classList.add('dragging');
        });
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging || !activeWindow) return;
        const maxX = window.innerWidth - activeWindow.offsetWidth;
        const maxY = window.innerHeight - activeWindow.offsetHeight - 40;
        activeWindow.style.left = Math.max(0, Math.min(e.clientX - dragOffsetX, maxX)) + 'px';
        activeWindow.style.top = Math.max(0, Math.min(e.clientY - dragOffsetY, maxY)) + 'px';
    });

    document.addEventListener('mouseup', function() {
        if (isDragging && activeWindow) {
            activeWindow.classList.remove('dragging');
            isDragging = false;
        }
    });

    // Calculadora
    let calcVal = '0';
    let shouldReset = false;
    const display = document.querySelector('.calculator-display');
    document.querySelectorAll('.calc-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const v = this.textContent;
            if (this.classList.contains('clear')) {
                calcVal = '0';
                display.textContent = '0';
                return;
            }
            if (shouldReset) { calcVal = '0'; shouldReset = false; }
            if (v === '=') {
                try {
                    const expr = calcVal.replace(/×/g, '*').replace(/÷/g, '/');
                    const result = eval(expr);
                    display.textContent = result;
                    calcVal = result.toString();
                    shouldReset = true;
                } catch (e) {
                    display.textContent = 'Error';
                    calcVal = '0';
                    shouldReset = true;
                }
                return;
            }
            if (calcVal === '0' && !'.+-×÷'.includes(v)) calcVal = v;
            else calcVal += v;
            display.textContent = calcVal;
        });
    });

    // Navegador
    const addrInput = document.querySelector('.browser-address');
    const browserFrame = document.querySelector('.browser-frame');
    if (addrInput && browserFrame) {
        addrInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                let url = this.value.trim();
                if (!url.startsWith('http')) url = 'https://' + url;
                try {
                    browserFrame.src = url;
                } catch (err) {
                    browserFrame.src = 'about:blank';
                }
            }
        });
    }

    // Word - contador palabras
    const wordPage = document.querySelector('.word-page');
    if (wordPage) {
        wordPage.addEventListener('input', function() {
            const text = this.textContent.trim();
            const count = text ? text.split(/\s+/).length : 0;
            const sb = this.closest('.window')?.querySelector('.status-bar span:nth-child(2)');
            if (sb) sb.textContent = 'Palabras: ' + count;
        });
        document.querySelectorAll('#word .format-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                if (this.classList.contains('bold')) document.execCommand('bold');
                if (this.classList.contains('italic')) document.execCommand('italic');
                if (this.classList.contains('underline')) document.execCommand('underline');
            });
        });
    }

    // Temas
    function changeTheme(theme) {
        currentTheme = theme;
        document.getElementById('theme-stylesheet').href = 'themes/' + theme + '.css';
        document.querySelector('.desktop').style.backgroundImage = 'url(wallpaper-' + theme + '.jpg)';
        document.querySelectorAll('.theme-option').forEach(o => {
            o.classList.toggle('active', o.dataset.theme === theme);
        });
        localStorage.setItem('you-space-theme', theme);
    }

    document.querySelectorAll('.theme-select-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            changeTheme(this.dataset.theme);
        });
    });

    const saved = localStorage.getItem('you-space-theme');
    if (saved) changeTheme(saved);
    else document.querySelector('.theme-option[data-theme="windows"]')?.classList.add('active');
});

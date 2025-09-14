"use strict";

const host = (function() {
    const that = {};
    let socket = null;
    let roomName = '';
    const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
    let diceConfiguration = [];

    function generateDiceRows() {
        const container = document.getElementById('dice-selector-container');
        container.innerHTML = '';
        diceTypes.forEach(type => {
            const row = document.createElement('div');
            row.className = 'dice-row';
            row.dataset.diceType = type;
            row.innerHTML = `
                <label>${type.toUpperCase()}</label>
                <span id="${type}-quantity" class="dice-quantity-display">0</span>
                <button class="quantity-btn remove-btn">-</button>
                <button class="quantity-btn add-btn">+</button>
                <span id="${type}-color-swatch" class="dice-color-swatch-display"></span>
                <button class="dice-settings-btn">⚙️</button>
            `;
            container.appendChild(row);
        });
    }

    function updateDiceCount(type, change) {
        if (change > 0) {
            const newDie = {
                id: `${type}-${Date.now()}-${Math.random()}`,
                type: type,
                diceColor: '#cccccc',
                labelColor: '#222222',
                metalness: 0.2,
                roughness: 0.8,
                texture: { albedo: null, metalness: null, roughness: null, normal: null }
            };
            diceConfiguration.push(newDie);
        } else {
            const lastDieIndex = diceConfiguration.map(d => d.type).lastIndexOf(type);
            if (lastDieIndex !== -1) {
                diceConfiguration.splice(lastDieIndex, 1);
            }
        }
        updateUIFromConfig();
        socket.emit('set diceSet', { roomName, diceSet: diceConfiguration });
    }

    function updateUIFromConfig() {
        const counts = {};
        diceTypes.forEach(type => counts[type] = 0);
        if (diceConfiguration) {
            diceConfiguration.forEach(die => counts[die.type] = (counts[die.type] || 0) + 1);
        }

        diceTypes.forEach(type => {
            const quantityDisplay = document.getElementById(`${type}-quantity`);
            if (quantityDisplay) quantityDisplay.textContent = counts[type];

            const diceOfType = diceConfiguration.filter(d => d.type === type);
            const swatch = document.getElementById(`${type}-color-swatch`);
            if (swatch) {
                swatch.style.backgroundColor = diceOfType.length > 0 ? diceOfType[0].diceColor : '#888';
            }
        });

        const parts = [];
        diceTypes.forEach(type => {
            if (counts[type] > 0) parts.push(`${counts[type]}${type}`);
        });
        const newNotation = parts.join('+') || '0';
        if (roller && roller.box) {
            roller.box.setDice(newNotation, diceConfiguration);
        }
    }


    that.init = function() {
        const params = new URLSearchParams(window.location.search);
        roomName = params.get('room');
        if (!roomName) {
            window.location.href = '/';
            return;
        }

        generateDiceRows();
        socket = io();

        socket.on('connect', () => {
            const savedPassword = sessionStorage.getItem('roomPassword');
            socket.emit('join room', { roomName: roomName, password: savedPassword });
            sessionStorage.removeItem('roomPassword');
        });

        socket.on('room not found', () => {
            alert('The room you were in no longer exists. Returning to lobby.');
            window.location.href = '/';
        });

        roller.init(socket, roomName);

        const settingsIcon = document.getElementById('settings-icon');
        const sidenav = document.getElementById('sidenav');
        const overlay = document.getElementById('overlay');
        const closeBtn = document.querySelector('.sidenav .close-btn');
        const backgroundColorInput = document.getElementById('background-color-input');
        const diceScaleInput = document.getElementById('dice-scale-input');
        const simSpeedInput = document.getElementById('simulation-speed-input');
        const backgroundColorSwatch = document.getElementById('background-color-swatch');
        const physicsPresets = document.getElementById('physics-presets');
        const recordBtn = document.getElementById('record-btn');
        const portraitBtn = document.getElementById('portrait-btn');
        const diceModal = document.getElementById('dice-settings-modal');
        const closeDiceModalBtn = diceModal.querySelector('.close-modal-btn');
        const modalTitle = document.getElementById('modal-title');

        const textureModal = document.getElementById('texture-settings-modal');
        const textureSettingsBtn = document.getElementById('texture-settings-btn');
        const closeTextureModalBtn = textureModal.querySelector('.close-modal-btn');
        const bgTextureInput = document.getElementById('background-texture-input');
        const clearTextureBtn = document.getElementById('clear-texture-btn');
        const achillBgCheckbox = document.getElementById('achill-bg-checkbox');
        let currentEditingDiceType = null;


        physicsPresets.addEventListener('change', (event) => {
            const presetName = event.target.value;
            if (roller && roller.box) roller.box.applyPhysicsPreset(presetName);
            socket.emit('set physics preset', { roomName, presetName });
        });

        recordBtn.addEventListener('click', () => {
            document.body.classList.add('recording');
            toggleMenu();
        });

        portraitBtn.addEventListener('click', () => {
            document.body.classList.toggle('portrait-mode');
            setTimeout(() => {
                if (roller && roller.box) roller.box.reinit(roller.box.container);
            }, 100);
            toggleMenu();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.body.classList.remove('recording');
            }
        });

        function setInitialSwatchColors() {
            if (backgroundColorSwatch) backgroundColorSwatch.style.backgroundColor = backgroundColorInput.value;
        }

        setInitialSwatchColors();

        function toggleMenu() {
            settingsIcon.classList.toggle('open');
            sidenav.classList.toggle('open');
            overlay.classList.toggle('open');
        }

        function openDiceModal(diceType) {
            currentEditingDiceType = diceType;
            modalTitle.textContent = `Edit ${diceType.toUpperCase()} Materials`;
            const modalDiceList = document.getElementById('modal-dice-list');
            modalDiceList.innerHTML = '';

            const diceOfType = diceConfiguration.filter(d => d.type === diceType);
            if (diceOfType.length === 0) {
                modalDiceList.innerHTML = '<p>Add dice of this type to set individual materials.</p>';
            } else {
                diceOfType.forEach((die, index) => {
                    const dieContainer = document.createElement('div');
                    dieContainer.className = 'dice-instance-container';
                    dieContainer.innerHTML = `
                        <h4>${diceType.toUpperCase()} #${index + 1}</h4>
                        <div class="modal-setting">
                            <label>Surface Color</label>
                            <input type="color" class="modal-dice-color-picker" data-id="${die.id}" value="${die.diceColor}">
                        </div>
                        <div class="modal-setting">
                            <label>Label Color</label>
                            <input type="color" class="modal-label-color-picker" data-id="${die.id}" value="${die.labelColor}">
                        </div>
                        <div class="modal-setting">
                            <label>Metalness</label>
                            <input type="range" class="modal-metalness-slider" data-id="${die.id}" min="0" max="1" step="0.01" value="${die.metalness || 0.5}">
                        </div>
                        <div class="modal-setting">
                            <label>Roughness</label>
                            <input type="range" class="modal-roughness-slider" data-id="${die.id}" min="0" max="1" step="0.01" value="${die.roughness || 0.5}">
                        </div>
                        <hr>
                    `;
                    modalDiceList.appendChild(dieContainer);
                });
            }

            diceModal.style.display = 'block';

            modalDiceList.querySelectorAll('.modal-dice-color-picker, .modal-label-color-picker, .modal-metalness-slider, .modal-roughness-slider').forEach(el => {
                el.addEventListener('input', handleIndividualMaterialChange);
            });
        }

        function openTextureModal() {
            const modalDiceList = document.getElementById('modal-dice-texture-list');
            modalDiceList.innerHTML = '';

            diceTypes.forEach(type => {
                const dieContainer = document.createElement('div');
                dieContainer.innerHTML = `
                    <h4>${type.toUpperCase()} Textures</h4>
                     <div class="modal-setting">
                        <label>Albedo (Color)</label>
                        <input type="file" class="modal-texture-picker" data-type="${type}" data-texture-type="albedo" accept="image/*">
                    </div>
                     <div class="modal-setting">
                        <label>Metalness Map</label>
                        <input type="file" class="modal-texture-picker" data-type="${type}" data-texture-type="metalness" accept="image/*">
                    </div>
                     <div class="modal-setting">
                        <label>Roughness Map</label>
                        <input type="file" class="modal-texture-picker" data-type="${type}" data-texture-type="roughness" accept="image/*">
                    </div>
                    <div class="modal-setting">
                        <label>Normal Map</label>
                        <input type="file" class="modal-texture-picker" data-type="${type}" data-texture-type="normal" accept="image/*">
                    </div>
                    <hr>
                `;
                modalDiceList.appendChild(dieContainer);
            });
            textureModal.style.display = 'block';
            modalDiceList.querySelectorAll('.modal-texture-picker').forEach(picker => {
                picker.addEventListener('change', handleDiceTextureChange);
            });
        }

        function handleIndividualMaterialChange(event) {
            const dieId = event.target.dataset.id;
            const die = diceConfiguration.find(d => d.id === dieId);
            if (die) {
                const target = event.target;
                if (target.classList.contains('modal-dice-color-picker')) {
                    die.diceColor = target.value;
                } else if (target.classList.contains('modal-label-color-picker')) {
                    die.labelColor = target.value;
                } else if (target.classList.contains('modal-metalness-slider')) {
                    die.metalness = parseFloat(target.value);
                } else if (target.classList.contains('modal-roughness-slider')) {
                    die.roughness = parseFloat(target.value);
                }
                updateUIFromConfig();
                handleGeneralAppearanceChange();
            }
        }

        function handleDiceTextureChange(event) {
            const diceType = event.target.dataset.type;
            const textureType = event.target.dataset.textureType;
            const file = event.target.files[0];

            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    diceConfiguration.forEach(die => {
                        if (die.type === diceType) {
                            if (!die.texture) die.texture = {};
                            die.texture[textureType] = e.target.result;
                        }
                    });
                    handleGeneralAppearanceChange();
                };
                reader.readAsDataURL(file);
            }
        }

        function closeModal() {
            diceModal.style.display = 'none';
            textureModal.style.display = 'none';
            currentEditingDiceType = null;
        }

        settingsIcon.addEventListener('click', toggleMenu);
        closeBtn.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);
        closeDiceModalBtn.addEventListener('click', closeModal);
        closeTextureModalBtn.addEventListener('click', closeModal);
        textureSettingsBtn.addEventListener('click', openTextureModal);

        window.addEventListener('click', (event) => {
            if (event.target == diceModal || event.target == textureModal) {
                closeModal();
            }
        });

        function setupDiceRowListeners() {
            document.querySelectorAll('.dice-row').forEach(row => {
                const addBtn = row.querySelector('.add-btn');
                const removeBtn = row.querySelector('.remove-btn');
                const settingsBtn = row.querySelector('.dice-settings-btn');
                const diceType = row.dataset.diceType;

                addBtn.addEventListener('click', () => updateDiceCount(diceType, 1));
                removeBtn.addEventListener('click', () => updateDiceCount(diceType, -1));
                settingsBtn.addEventListener('click', () => openDiceModal(diceType));
            });
        }

        setupDiceRowListeners();

        function handleGeneralAppearanceChange(extraOptions = {}) {
            if (backgroundColorSwatch) backgroundColorSwatch.style.backgroundColor = backgroundColorInput.value;
            const newAppearance = {
                backgroundColor: backgroundColorInput.value,
                scale: parseInt(diceScaleInput.value, 10),
                simulationSpeed: parseFloat(simSpeedInput.value),
                useAchillBackground: achillBgCheckbox.checked,
                ...extraOptions
            };
            socket.emit('set diceSet', { roomName, diceSet: diceConfiguration });
            socket.emit('set appearance', { roomName, newAppearance });
        }

        // --- START OF CORRECTED CODE BLOCK ---

        // Wenn der Nutzer die Hintergrundfarbe ändert
        backgroundColorInput.addEventListener('input', () => {
            achillBgCheckbox.checked = false; // Deaktiviere die Checkbox
            handleGeneralAppearanceChange({ backgroundImage: null, useAchillBackground: false });
        });

        // Wenn der Nutzer die "Achill Background"-Checkbox ändert
        achillBgCheckbox.addEventListener('change', () => {
            if (achillBgCheckbox.checked) {
                // Wenn aktiviert, lösche das benutzerdefinierte Bild
                bgTextureInput.value = '';
                handleGeneralAppearanceChange({
                    backgroundImage: null,
                    useAchillBackground: true
                });
            } else {
                // Wenn deaktiviert, falle zurück zur normalen Farbe
                handleGeneralAppearanceChange({ useAchillBackground: false });
            }
        });

        // Wenn der Nutzer ein eigenes Hintergrundbild hochlädt
        bgTextureInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    // Ein eigenes Bild deaktiviert den Achill Background
                    achillBgCheckbox.checked = false;
                    handleGeneralAppearanceChange({ backgroundImage: e.target.result, useAchillBackground: false });
                };
                reader.readAsDataURL(file);
            }
        });

        // Wenn der Nutzer das eigene Hintergrundbild löscht
        clearTextureBtn.addEventListener('click', () => {
            bgTextureInput.value = '';
            achillBgCheckbox.checked = false; // Auch hier deaktivieren
            handleGeneralAppearanceChange({ backgroundImage: null, useAchillBackground: false });
        });

        // Die Listener für diceScaleInput und simSpeedInput bleiben unverändert
        diceScaleInput.addEventListener('input', handleGeneralAppearanceChange);
        simSpeedInput.addEventListener('input', handleGeneralAppearanceChange);

        // --- END OF CORRECTED CODE BLOCK ---


        const notificationArea = document.getElementById('notification-area');

        function showNotification(message) {
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = message;
            notificationArea.appendChild(notification);
            setTimeout(() => { notification.remove(); }, 4000);
        }

        socket.on('new roll', (data) => {
            const animationVector = data.vector;
            if (roller && roller.box) {
                document.getElementById('result').innerHTML = 'Rolling...';
                roller.box.start_throw(null, (notation) => {
                    document.getElementById('result').innerHTML = notation.resultString;
                }, animationVector);
            }
        });

        socket.on('diceSet update', (newDiceSet) => {
            diceConfiguration = newDiceSet;
            updateUIFromConfig();
        });

        socket.on('appearance update', (newAppearance) => {
            if(newAppearance.backgroundColor) {
                backgroundColorInput.value = newAppearance.backgroundColor;
                if (backgroundColorSwatch) backgroundColorSwatch.style.backgroundColor = newAppearance.backgroundColor;
            }
            if(newAppearance.scale) diceScaleInput.value = newAppearance.scale;
            if(newAppearance.simulationSpeed) {
                simSpeedInput.value = newAppearance.simulationSpeed;
                if (roller && roller.box) roller.box.setSpeed(newAppearance.simulationSpeed);
            }
            if ('backgroundImage' in newAppearance) {
                if (!newAppearance.backgroundImage) {
                    bgTextureInput.value = '';
                }
            }
            if ('useAchillBackground' in newAppearance) {
                achillBgCheckbox.checked = newAppearance.useAchillBackground;
            }

            if (roller && roller.box) {
                roller.box.updateAppearance(newAppearance);
            }
        });

        const cooldownBarContainer = document.getElementById('cooldown-bar-container');
        const cooldownBar = document.getElementById('cooldown-bar');

        socket.on('start cooldown', (data) => {
            cooldownBarContainer.style.display = 'block';
            cooldownBar.style.transition = 'none';
            cooldownBar.style.width = '100%';
            setTimeout(() => {
                cooldownBar.style.transition = `width ${data.duration / 1000}s linear`;
                cooldownBar.style.width = '0%';
            }, 50);
        });

        socket.on('enable roll', () => {
            if (roller) roller.enableRoll();
            cooldownBarContainer.style.display = 'none';
        });

        socket.on('play roll sound', () => {
            if (roller && roller.box) roller.box.playSound();
        });

        socket.on('user_joined', (data) => { showNotification(data.message); });
        socket.on('user_left', (data) => { showNotification(data.message); });

        socket.on('physics preset update', (presetName) => {
            const radioToCheck = document.querySelector(`input[name="physics"][value="${presetName}"]`);
            if (radioToCheck) {
                radioToCheck.checked = true;
            }
            if (roller && roller.box) {
                roller.box.applyPhysicsPreset(presetName);
            }
        });
    };

    return that;
}());
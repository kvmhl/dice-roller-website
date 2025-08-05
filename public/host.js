// host.js - Host-specific logic
"use strict";

const host = (function() {
    const that = {};
    let socket = null;
    let roomName = '';

    that.init = function() {
        const params = new URLSearchParams(window.location.search);
        roomName = params.get('room');
        if (!roomName) {
            window.location.href = '/';
            return;
        }

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

        // --- Menu Logic ---
        const settingsIcon = document.getElementById('settings-icon');
        const sidenav = document.getElementById('sidenav');
        const overlay = document.getElementById('overlay');
        const closeBtn = document.querySelector('.sidenav .close-btn');
        const diceColorInput = document.getElementById('dice-color-input');
        const labelColorInput = document.getElementById('label-color-input');
        const diceScaleInput = document.getElementById('dice-scale-input');

        const diceColorSwatch = document.getElementById('dice-color-swatch');
        const labelColorSwatch = document.getElementById('label-color-swatch');

        const physicsPresets = document.getElementById('physics-presets');


        physicsPresets.addEventListener('change', (event) => {
            const presetName = event.target.value;
            // Apply locally and send to server
            roller.box.applyPhysicsPreset(presetName);
            socket.emit('set physics preset', { roomName, presetName });
        });


        function setInitialSwatchColors() {
            diceColorSwatch.style.backgroundColor = diceColorInput.value;
            labelColorSwatch.style.backgroundColor = labelColorInput.value;
        }

        setInitialSwatchColors();

        function toggleMenu() {
            settingsIcon.classList.toggle('open');
            sidenav.classList.toggle('open');
            overlay.classList.toggle('open');
        }

        settingsIcon.addEventListener('click', toggleMenu);
        closeBtn.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);

        const diceRows = document.querySelectorAll('.dice-row');

        function updateDiceNotation() {
            const parts = [];
            diceRows.forEach(row => {
                const quantityInput = row.querySelector('.dice-quantity');
                const quantity = parseInt(quantityInput.value, 10);

                if (quantity > 0) {
                    const diceType = row.dataset.diceType;
                    parts.push(`${quantity}${diceType}`);
                }
            });

            const newNotation = parts.join('+') || '1d6'; // Default to 1d6 if empty

            roller.box.setDice(newNotation);
            socket.emit('set notation', { roomName, newNotation });
        }

        diceRows.forEach(row => {
            const checkbox = row.querySelector('.dice-checkbox');
            const quantityInput = row.querySelector('.dice-quantity');

            checkbox.addEventListener('change', () => {
                quantityInput.disabled = !checkbox.checked;
                if (checkbox.checked) {
                    if (quantityInput.value === '0') {
                        quantityInput.value = '1';
                    }
                } else {
                    quantityInput.value = '0';
                }
                updateDiceNotation();
            });

            quantityInput.addEventListener('input', () => {
                if (parseInt(quantityInput.value, 10) > 0) {
                    checkbox.checked = true;
                    quantityInput.disabled = false;
                }
                updateDiceNotation();
            });
        });

        function handleAppearanceChange() {
            diceColorSwatch.style.backgroundColor = diceColorInput.value;
            labelColorSwatch.style.backgroundColor = labelColorInput.value;

            const newAppearance = {
                diceColor: diceColorInput.value,
                labelColor: labelColorInput.value,
                scale: parseInt(diceScaleInput.value, 10)
            };
            roller.box.updateAppearance(newAppearance);
            socket.emit('set appearance', { roomName, newAppearance });
        }

        diceColorInput.addEventListener('input', handleAppearanceChange);
        labelColorInput.addEventListener('input', handleAppearanceChange);
        diceScaleInput.addEventListener('input', handleAppearanceChange);

        const notificationArea = document.getElementById('notification-area');

        function showNotification(message) {
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = message;

            notificationArea.appendChild(notification);

            // Remove the element from the DOM after the animation is done
            setTimeout(() => {
                notification.remove();
            }, 4000); // Must match the animation duration in CSS
        }

        // --- Socket Event Handlers ---
        socket.on('new roll', (data) => {
            const serverNotation = data.result;
            const animationVector = data.vector;

            document.getElementById('result').innerHTML = '';

            function before_roll_custom(notation) {
                return serverNotation.result;
            }

            function after_roll_custom(notation) {
                document.getElementById('result').innerHTML = notation.resultString;
            }

            roller.box.start_throw(before_roll_custom, after_roll_custom, animationVector);
        });


        socket.on('notation update', (notation) => {
            const notationMap = new Map();
            if (notation) {
                notation.split('+').forEach(part => {
                    const match = part.match(/(\d+)(d\d+)/);
                    if (match) {
                        notationMap.set(match[2], parseInt(match[1], 10));
                    }
                });
            }

            diceRows.forEach(row => {
                const type = row.dataset.diceType;
                const count = notationMap.get(type) || 0;

                const checkbox = row.querySelector('.dice-checkbox');
                const quantityInput = row.querySelector('.dice-quantity');

                quantityInput.value = count;
                checkbox.checked = count > 0;
                quantityInput.disabled = count === 0;
            });

            roller.box.setDice(notation);
        });

        socket.on('appearance update', (newAppearance) => {
            // Update the input controls to reflect the server's state
            diceColorInput.value = newAppearance.diceColor;
            labelColorInput.value = newAppearance.labelColor;
            diceScaleInput.value = newAppearance.scale;

            diceColorSwatch.style.backgroundColor = newAppearance.diceColor;
            labelColorSwatch.style.backgroundColor = newAppearance.labelColor;

            // Update the visuals
            roller.box.updateAppearance(newAppearance);
        });

        // cooldown bar

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
            roller.enableRoll();
            cooldownBarContainer.style.display = 'none'; // Hide the bar
        });

        socket.on('play roll sound', () => {
            const parsedNotation = DICE.parse_notation(roller.box.diceToRoll);
            if (parsedNotation.set.length > 0) {
                DICE.playSound(roller.box.container, 0.5);
            }
        });

        socket.on('user_joined', (data) => {
            showNotification(data.message);
        });

        socket.on('user_left', (data) => {
            showNotification(data.message);
        });

        socket.on('physics preset update', (presetName) => {
            const radioToCheck = document.querySelector(`input[name="physics"][value="${presetName}"]`);
            if (radioToCheck) {
                radioToCheck.checked = true;
            }
            // Apply the physics update
            roller.box.applyPhysicsPreset(presetName);
        });

    };



    return that;
}());
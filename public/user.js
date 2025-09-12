"use strict";

var user = (function() {
    var that = {};
    var socket = null;
    var roomName = '';

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
            alert('The room you were trying to join no longer exists. Returning to lobby.');
            window.location.href = '/';
        });

        roller.init(socket, roomName);

        // --- Notification Logic ---
        const notificationArea = document.getElementById('notification-area');
        function showNotification(message) {
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = message;
            notificationArea.appendChild(notification);
            setTimeout(() => {
                notification.remove();
            }, 4000);
        }

        socket.on('user_joined', (data) => {
            showNotification(data.message);
        });

        socket.on('user_left', (data) => {
            showNotification(data.message);
        });

        // --- Socket Event Handlers ---

        socket.on('notation update', (notation) => {
            roller.box.setDice(notation);
        });

        socket.on('appearance update', (newAppearance) => {
            roller.box.updateAppearance(newAppearance);

            // ACHTUNG: Die Logik für das DOM-Logo wird hier entfernt, da es in dice.js behandelt wird.
            // const achillLogoElement = document.getElementById('achill-logo');
            // if (achillLogoElement) {
            //     if (newAppearance.showAchillLogo) {
            //         achillLogoElement.classList.remove('hidden');
            //     } else {
            //         achillLogoElement.classList.add('hidden');
            //     }
            // }
        });

        socket.on('physics preset update', (presetName) => {
            roller.box.applyPhysicsPreset(presetName);
        });

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

        socket.on('enable roll', () => {
            roller.enableRoll();
            cooldownBarContainer.style.display = 'none'; // Hide the bar
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

        socket.on('play roll sound', () => {
            const parsedNotation = DICE.parse_notation(roller.box.diceToRoll);
            if (parsedNotation.set.length > 0) {
                DICE.playSound(roller.box.container, 0.5);
            }
        });

        // ACHTUNG: Die Logik für das DOM-Logo wird hier entfernt, da es in dice.js behandelt wird.
        // Initial state for logo visibility (could come from server when client joins)
        // Must not be initialized here as 'appearance update' is sent on join.

    };

    return that;
}());
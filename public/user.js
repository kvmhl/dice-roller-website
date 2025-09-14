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

        socket.on('diceSet update', (newDiceSet) => {
            const parts = [];
            const counts = {};
            newDiceSet.forEach(die => {
                counts[die.type] = (counts[die.type] || 0) + 1;
            });
            Object.keys(counts).forEach(type => {
                if (counts[type] > 0) parts.push(`${counts[type]}${type}`);
            });
            const newNotation = parts.join('+') || '0';

            if (roller && roller.box) {
                roller.box.setDice(newNotation, newDiceSet);
            }
        });

        socket.on('appearance update', (newAppearance) => {
            if (roller && roller.box) {
                roller.box.updateAppearance(newAppearance);
            }
        });

        socket.on('physics preset update', (presetName) => {
            if (roller && roller.box) {
                roller.box.applyPhysicsPreset(presetName);
            }
        });

        socket.on('new roll', (data) => {
            const animationVector = data.vector;
            document.getElementById('result').innerHTML = 'Rolling...';

            function after_roll_custom(notation) {
                document.getElementById('result').innerHTML = notation.resultString;
            }

            if (roller && roller.box) {
                roller.box.start_throw(null, after_roll_custom, animationVector);
            }
        });

        socket.on('enable roll', () => {
            roller.enableRoll();
            cooldownBarContainer.style.display = 'none';
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

        socket.on('play roll sound', () => {
            if (roller && roller.box) {
                roller.box.playSound();
            }
        });

    };

    return that;
}());
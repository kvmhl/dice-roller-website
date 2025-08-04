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


        socket.on('notation update', (notation) => {
            roller.box.setDice(notation);
        });

        socket.on('appearance update', (newAppearance) => {
            roller.box.updateAppearance(newAppearance);
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

        socket.on('cooldown', (data) => {
            const resultElement = document.getElementById('result');
            resultElement.innerHTML = `Please wait ${data.timeLeft} seconds.`;
        });

        socket.on('roll complete', () => {
            roller.enableRoll();
        });

        socket.on('play roll sound', () => {
            const parsedNotation = DICE.parse_notation(roller.box.diceToRoll);
            if (parsedNotation.set.length > 0) {
                DICE.playSound(roller.box.container, 0.5);
            }
        });

    };

    return that;
}());
// user.js - User-specific logic
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
            socket.emit('join room', roomName);
        });

        socket.on('room not found', () => {
            alert('The room you were trying to join no longer exists. Returning to lobby.');
            window.location.href = '/';
        });

        // Pass the user's container to the roller's init function
        roller.init(socket, roomName, document.getElementById('center_div'));

        const notationDisplay = document.getElementById('textInput');

        socket.on('notation update', (notation) => {
            // Update the text display to show the current dice
            notationDisplay.value = notation;
            // Update the dice roller instance with the new dice set
            roller.box.setDice(notation);
        });

        socket.on('appearance update', (newAppearance) => {
            // Tell the dice roller to update the visual appearance of the dice
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
            const parsedNotation = DICE.parse_notation(textInput.value);
            if (parsedNotation.set.length > 0) {
                DICE.playSound(roller.box.container, 0.5);
            }
        });

    };

    return that;
}());

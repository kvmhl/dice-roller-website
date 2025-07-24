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

        // Handle the case where the room no longer exists
        socket.on('room not found', () => {
            alert('The room you were trying to join no longer exists. Returning to lobby.');
            window.location.href = '/';
        });

        roller.init(socket, roomName);

        const notationDisplay = document.getElementById('textInput');

        socket.on('notation update', (notation) => {
            notationDisplay.textContent = notation;
            roller.box.setDice(notation);
        });

        socket.on('new roll', (data) => {
            const serverNotation = data.result;
            const animationVector = data.vector;

            // console.log("Received Swipe Vector:", animationVector);

            // const animationVector = (socket.id === initiatorId) ? throwVector : null;

            // console.log("Vector being used for animation:", animationVector);

            document.getElementById('result').innerHTML = '';

            function before_roll_custom(notation) {
                return serverNotation.result;
            }

            function after_roll_custom(notation) {
                document.getElementById('result').innerHTML = notation.resultString;
            }

            // Call the roll function with the determined vector (accurate or random)
            roller.box.start_throw(before_roll_custom, after_roll_custom, animationVector);
        });
    };

    return that;
}());

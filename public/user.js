// user.js - User-specific logic
"use strict";

var user = (function() {
    var that = {};
    var socket = null;
    var roomName = '';

    that.init = function() {
        // Get room name from URL query parameter
        const params = new URLSearchParams(window.location.search);
        roomName = params.get('room');
        if (!roomName) {
            alert('No room specified!');
            window.location.href = '/';
            return;
        }

        socket = io();

        socket.on('connect', () => {
            // Join the specific room
            socket.emit('join room', roomName);
        });

        roller.init(socket, roomName); // Pass room name to the roller

        const notationDisplay = document.getElementById('textInput');

        socket.on('notation update', (notation) => {
            notationDisplay.textContent = notation;
            roller.box.setDice(notation);
        });

        socket.on('new roll', (serverNotation) => {
            document.getElementById('result').innerHTML = '';
            function before_roll_custom(n) { return serverNotation.result; }
            function after_roll_custom(n) { document.getElementById('result').innerHTML = n.resultString; }
            roller.box.start_throw(before_roll_custom, after_roll_custom);
        });
    };

    return that;
}());

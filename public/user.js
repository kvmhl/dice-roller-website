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

        socket.on('new roll', (serverNotation) => {
            document.getElementById('result').innerHTML = '';
            function before_roll_custom(n) { return serverNotation.result; }
            function after_roll_custom(n) { document.getElementById('result').innerHTML = n.resultString; }
            roller.box.start_throw(before_roll_custom, after_roll_custom);
        });
    };

    return that;
}());

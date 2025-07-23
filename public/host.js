// host.js - Host-specific logic
"use strict";

var host = (function() {
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
            alert('The room you were in no longer exists. Returning to lobby.');
            window.location.href = '/';
        });

        roller.init(socket, roomName);

        const textInput = document.getElementById('textInput');

        textInput.addEventListener('change', () => {
            const newNotation = textInput.value;
            roller.box.setDice(newNotation);
            socket.emit('set notation', { roomName, newNotation });
        });

        socket.on('new roll', (serverNotation) => {
            document.getElementById('result').innerHTML = '';
            function before_roll_custom(n) { return serverNotation.result; }
            function after_roll_custom(n) { document.getElementById('result').innerHTML = n.resultString; }
            roller.box.start_throw(before_roll_custom, after_roll_custom);
        });

        socket.on('notation update', (notation) => {
            textInput.value = notation;
            roller.box.setDice(notation);
        });
    };

    return that;
}());

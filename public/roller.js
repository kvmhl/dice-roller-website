// roller.js - Shared dice logic
"use strict";

var roller = (function() {
    var that = {};
    var elem = {};
    var box = null;
    var socket;
    var roomName;
    var isRolling = false;
    const rollCooldown = 3000;

    // Variables to track the swipe action
    var mouse_time;
    var mouse_start;

    that.init = function(socketInstance, currentRoomName) {
        socket = socketInstance;
        roomName = currentRoomName;

        elem.container = $t.id('diceRoller');
        elem.result = $t.id('result');
        elem.textInput = $t.id('textInput');
        elem.center_div = $t.id('center_div');

        box = new DICE.dice_box(elem.container);
        that.box = box;

        // When the user starts pressing down, record the time and position.
        $t.bind(elem.center_div, ['mousedown', 'touchstart'], function(ev) {
            ev.preventDefault();
            mouse_time = (new Date()).getTime();
            mouse_start = $t.get_mouse_coords(ev);
        });

        // When the user releases, calculate the swipe and trigger a roll.
        $t.bind(elem.center_div, ['mouseup', 'touchend'], function(ev) {
            if (mouse_start === undefined) return;

            // Check if a roll is already in progress (cooldown).
            if (isRolling) {
                console.log('Roll in progress, please wait.');
                mouse_start = undefined;
                return;
            }

            var m = $t.get_mouse_coords(ev);
            var vector = { x: m.x - mouse_start.x, y: -(m.y - mouse_start.y) };
            mouse_start = undefined;
            var dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);

            // Only trigger a roll if the swipe was a meaningful distance.
            if (dist < 10) return;

            // Start the cooldown and request a roll from the server.
            isRolling = true;
            setTimeout(() => {
                isRolling = false;
            }, rollCooldown);

            const notation = elem.textInput.value || elem.textInput.textContent;
            socket.emit('request roll', { roomName, notation });
        });
    };

    return that;
}());
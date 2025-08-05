// roller.js - Shared dice logic
"use strict";

var roller = (function() {
    var that = {};
    var elem = {};
    var box = null;
    var socket;
    var roomName;

    // Variables to track the swipe action
    var mouse_time;
    var mouse_start;
    let canRequestRoll = true;

    that.init = function(socketInstance, currentRoomName) {
        socket = socketInstance;
        roomName = currentRoomName;

        elem.container = $t.id('diceRoller');
        elem.result = $t.id('result');
        elem.center_div = $t.id('center_div');

        box = new DICE.dice_box(elem.container);
        that.box = box;

        // --- SWIPE-TO-ROLL LOGIC ---

        that.enableRoll = function() {
            canRequestRoll = true;
        };

        $t.bind(elem.center_div, ['mousedown', 'touchstart'], function(ev) {
            ev.preventDefault();
            mouse_time = (new Date()).getTime();
            mouse_start = $t.get_mouse_coords(ev);
        });

        $t.bind(elem.center_div, ['mouseup', 'touchend'], function(ev) {
            if (mouse_start === undefined) return;

            // The client now only checks its own simple lock.
            if (!canRequestRoll) {
                mouse_start = undefined;
                return;
            }

            var m = $t.get_mouse_coords(ev);
            var vector = { x: m.x - mouse_start.x, y: -(m.y - mouse_start.y) };
            mouse_start = undefined;
            var dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);

            if (dist < 20) return;

            // Lock the client immediately to prevent spamming clicks
            canRequestRoll = false;

            const notation = that.box.diceToRoll;
            socket.emit('request roll', { roomName, notation, vector });
        });
    };

    return that;
}());

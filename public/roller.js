// roller.js - Shared dice logic
"use strict";

var roller = (function() {
    var that = {};
    var elem = {};
    var box = null;
    var socket;
    var roomName;

    //flag will prevent spamming
    let canRequestRoll = true;

    that.enableRoll = function() {
        canRequestRoll = true;
    };

    // Variables to track the swipe action
    var mouse_time;
    var mouse_start;

    that.init = function(socketInstance, currentRoomName) {
        socket = socketInstance;
        roomName = currentRoomName;

        elem.container = $t.id('diceRoller');
        elem.result = $t.id('result');
        elem.center_div = $t.id('center_div');

        box = new DICE.dice_box(elem.container);
        that.box = box;

        // --- SWIPE-TO-ROLL LOGIC ---

        $t.bind(elem.center_div, ['mousedown', 'touchstart'], function(ev) {
            ev.preventDefault();
            mouse_time = (new Date()).getTime();
            mouse_start = $t.get_mouse_coords(ev);
        });

        $t.bind(elem.center_div, ['mouseup', 'touchend'], function(ev) {
            if (mouse_start === undefined) return;

            if (!canRequestRoll) {
                mouse_start = undefined;
                return;
            }

            var m = $t.get_mouse_coords(ev);

            var vector = { x: m.x - mouse_start.x, y: -(m.y - mouse_start.y) };

            mouse_start = undefined;
            var dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);

            if (dist < 20) return;

            // isRolling = true;
            // setTimeout(() => {
            //     isRolling = false;
            // }, rollCooldown);

            const notation = that.box.diceToRoll;

            canRequestRoll = false;

            // --- DEBUGGING ---
            // console.log("Sending swipe vector to server:", vector);

            socket.emit('request roll', { roomName, notation, vector });
        });
    };

    return that;
}());

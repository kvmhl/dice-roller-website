"use strict";

var roller = (function() {
    var that = {};
    var box = null;
    var socket;
    var roomName;
    let canRequestRoll = true;

    that.init = function(socketInstance, currentRoomName) {
        socket = socketInstance;
        roomName = currentRoomName;

        const container = $t.id('diceRoller');
        const center_div = $t.id('center_div');
        box = new DICE.dice_box(container);
        that.box = box;

        // --- All Input Logic (Mouse, Touch, Keyboard) is now handled here ---
        let mouse_start;

        $t.bind(center_div, ['mousedown', 'touchstart'], function(ev) {
            ev.preventDefault();
            mouse_start = $t.get_mouse_coords(ev);
        });

        $t.bind(center_div, ['mouseup', 'touchend'], function(ev) {
            if (mouse_start === undefined) return;

            var m = $t.get_mouse_coords(ev);
            var vector = { x: m.x - mouse_start.x, y: -(m.y - mouse_start.y) };
            mouse_start = undefined;
            var dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);

            if (dist < 20) return;

            that.requestRoll(vector);
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === ' ') {
                e.preventDefault();
                const vector = { x: (Math.random() - 0.5) * box.w * 0.5, y: box.h };
                that.requestRoll(vector);
            }
        });
    };

    that.enableRoll = function() {
        canRequestRoll = true;
    };

    that.requestRoll = function(vector) {
        if (!canRequestRoll) return;
        canRequestRoll = false;
        socket.emit('request roll', { roomName, vector });
    }

    return that;
}());
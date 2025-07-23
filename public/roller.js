// roller.js - Shared dice logic
"use strict";

var roller = (function() {
    var that = {};
    var elem = {};
    var box = null;
    var socket;
    var roomName; // Store the room name
    var isRolling = false; // Flag to prevent spamming rolls
    const rollCooldown = 3000; // Cooldown in milliseconds (3 seconds)

    // Now accepts roomName
    that.init = function(socketInstance, currentRoomName) {
        socket = socketInstance;
        roomName = currentRoomName;

        elem.container = $t.id('diceRoller');
        elem.result = $t.id('result');
        elem.textInput = $t.id('textInput');
        elem.center_div = $t.id('center_div');

        box = new DICE.dice_box(elem.container);
        that.box = box;

        elem.center_div.addEventListener('click', function() {
            // Check if a roll is already in progress
            if (isRolling) {
                console.log('Roll in progress, please wait for the cooldown.');
                return; // Exit the function if on cooldown
            }

            // Set the flag to true to start the cooldown
            isRolling = true;

            // Reset the flag after the cooldown period
            setTimeout(() => {
                isRolling = false;
            }, rollCooldown);

            const notation = elem.textInput.value || elem.textInput.textContent;
            // Send request with room name
            socket.emit('request roll', { roomName, notation });
        });
    };

    return that;
}());

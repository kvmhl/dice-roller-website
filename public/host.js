// host.js - Host-specific logic
"use strict";

const host = (function() { // Using const instead of var
    const that = {};      // Using const instead of var
    let socket = null;    // Using let for variables that might be reassigned
    let roomName = '';    // Using let for variables that might be reassigned

    that.init = function() {
        const params = new URLSearchParams(window.location.search);
        roomName = params.get('room');
        if (!roomName) {
            window.location.href = '/';
            return;
        }

        // The 'io' function is globally available from the script tag, so this is correct.
        socket = io();

        socket.on('connect', () => {
            socket.emit('join room', roomName);
        });

        socket.on('room not found', () => {
            alert('The room you were in no longer exists. Returning to lobby.');
            window.location.href = '/';
        });

        roller.init(socket, roomName);

        // --- Menu Logic ---
        const settingsIcon = document.getElementById('settings-icon');
        const sidenav = document.getElementById('sidenav');
        const overlay = document.getElementById('overlay');
        const closeBtn = document.querySelector('.sidenav .close-btn');

        const textInput = document.getElementById('textInput');
        const diceColorInput = document.getElementById('dice-color-input');
        const labelColorInput = document.getElementById('label-color-input');
        const diceScaleInput = document.getElementById('dice-scale-input');

        function toggleMenu() {
            sidenav.classList.toggle('open');
            overlay.classList.toggle('open');
        }

        settingsIcon.addEventListener('click', toggleMenu);
        closeBtn.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);

        // Listener for dice notation (This is the single, correct one)
        textInput.addEventListener('change', () => {
            const newNotation = textInput.value;
            roller.box.setDice(newNotation);
            socket.emit('set notation', { roomName, newNotation });
        });

        // Function to handle dice appearance changes
        function handleAppearanceChange() {

            const newAppearance = {
                diceColor: diceColorInput.value,
                labelColor: labelColorInput.value,
                scale: parseInt(diceScaleInput.value, 10)
            };

            roller.box.updateAppearance({
                diceColor: diceColorInput.value,
                labelColor: labelColorInput.value,
                scale: parseInt(diceScaleInput.value, 10)
            });

            socket.emit('set appearance', { roomName, newAppearance });

        }

        diceColorInput.addEventListener('input', handleAppearanceChange);
        labelColorInput.addEventListener('input', handleAppearanceChange);
        diceScaleInput.addEventListener('input', handleAppearanceChange);

        // --- Socket Event Handlers ---
        socket.on('new roll', (data) => {
            const serverNotation = data.result;
            const animationVector = data.vector;

            document.getElementById('result').innerHTML = '';

            // The 'notation' parameter is unused here, but kept for signature consistency
            function before_roll_custom(notation) {
                return serverNotation.result;
            }

            function after_roll_custom(notation) {
                document.getElementById('result').innerHTML = notation.resultString;
            }

            roller.box.start_throw(before_roll_custom, after_roll_custom, animationVector);
        });

        socket.on('notation update', (notation) => {
            textInput.value = notation;
            roller.box.setDice(notation);
        });
    };

    return that;
}());

socket.on('appearance update', (newAppearance) => {
    // Update the input controls to reflect the server's state
    diceColorInput.value = newAppearance.diceColor;
    labelColorInput.value = newAppearance.labelColor;
    diceScaleInput.value = newAppearance.scale;
    // Update the visuals
    roller.box.updateAppearance(newAppearance);
});
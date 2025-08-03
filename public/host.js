// host.js - Host-specific logic
"use strict";

const host = (function() {
    const that = {};
    let socket = null;
    let roomName = '';

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
            settingsIcon.classList.toggle('open');
            sidenav.classList.toggle('open');
            overlay.classList.toggle('open');
        }

        settingsIcon.addEventListener('click', toggleMenu);
        closeBtn.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);

        textInput.addEventListener('change', () => {
            const newNotation = textInput.value;
            roller.box.setDice(newNotation);
            socket.emit('set notation', { roomName, newNotation });
        });

        function handleAppearanceChange() {
            const newAppearance = {
                diceColor: diceColorInput.value,
                labelColor: labelColorInput.value,
                scale: parseInt(diceScaleInput.value, 10)
            };
            roller.box.updateAppearance(newAppearance);
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

            function before_roll_custom(notation) {
                return serverNotation.result;
            }

            function after_roll_custom(notation) {
                document.getElementById('result').innerHTML = notation.resultString;
            }

            roller.box.start_throw(before_roll_custom, after_roll_custom, animationVector);
        });

        socket.on('cooldown', (data) => {
            const resultElement = document.getElementById('result');
            resultElement.innerHTML = `Please wait ${data.timeLeft} seconds.`;
        });

        socket.on('notation update', (notation) => {
            textInput.value = notation;
            roller.box.setDice(notation);
        });

        socket.on('appearance update', (newAppearance) => {
            // Update the input controls to reflect the server's state
            diceColorInput.value = newAppearance.diceColor;
            labelColorInput.value = newAppearance.labelColor;
            diceScaleInput.value = newAppearance.scale;
            // Update the visuals
            roller.box.updateAppearance(newAppearance);
        });

        socket.on('roll complete', () => {
            roller.enableRoll();
        });

        socket.on('play roll sound', () => {
            const parsedNotation = DICE.parse_notation(textInput.value);
            if (parsedNotation.set.length > 0) {
                DICE.playSound(roller.box.container, 0.5);
            }
        });

    };



    return that;
}());
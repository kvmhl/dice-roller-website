// public/lobby.js - CORRECTED AND FINAL VERSION

const socket = io();
const roomNameInput = document.getElementById('roomNameInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomListDiv = document.getElementById('room-list');
const noRoomsMsg = document.getElementById('no-rooms');

const isPrivateCheckbox = document.getElementById('isPrivateCheckbox');
const passwordContainer = document.getElementById('password-container');
const passwordInput = document.getElementById('passwordInput');

// Show/hide password field when checkbox is toggled
isPrivateCheckbox.addEventListener('change', () => {
    passwordContainer.style.display = isPrivateCheckbox.checked ? 'block' : 'none';
});

// Handle creating a new room
createRoomBtn.addEventListener('click', () => {
    const roomName = roomNameInput.value.trim();
    if (roomName) {
        const data = { roomName };
        if (isPrivateCheckbox.checked) {
            const password = passwordInput.value.trim();
            if (password) {
                data.password = password;
                sessionStorage.setItem('roomPassword', password);
            } else {
                alert('Private rooms must have a password.');
                return;
            }
        }
        socket.emit('create room', data);
    }
});

socket.on('create_success', (data) => {
    //server has confirmed the room exists, we navigate.
    window.location.href = `/host.html?room=${encodeURIComponent(data.roomName)}`;
});

socket.on('create_error', (data) => {
    alert(`Error: ${data.message}`);
});

socket.on('update room list', (roomList) => {
    roomListDiv.innerHTML = '';
    if (roomList.length === 0) {
        roomListDiv.innerHTML = '<p id="no-rooms">No active rooms.</p>';
    } else {
        roomList.forEach(room => {
            const roomLink = document.createElement('a');
            roomLink.href = '#';
            roomLink.textContent = room.name + (room.isPrivate ? ' 🔒' : '');

            roomLink.addEventListener('click', (e) => {
                e.preventDefault();
                let password = null;
                if (room.isPrivate) {
                    password = prompt('This room is private. Please enter the password:');
                    if (password === null) return; // User clicked cancel

                    sessionStorage.setItem('roomPassword', password);
                }

                socket.emit('check room', { roomName: room.name, password: password });
            });

            roomListDiv.appendChild(roomLink);
        });
    }
});


socket.on('check_success', (data) => {
    window.location.href = `/user.html?room=${encodeURIComponent(data.roomName)}`;
});

socket.on('join_error', (data) => {
    alert(`Error: ${data.message}`);
});

socket.on('room not found', () => {
    alert('That room no longer exists.');
});
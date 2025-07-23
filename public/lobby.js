// public/lobby.js
const socket = io();
const roomNameInput = document.getElementById('roomNameInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomListDiv = document.getElementById('room-list');
const noRoomsMsg = document.getElementById('no-rooms');

// Listen for updates to the room list from the server
socket.on('update room list', (rooms) => {
    roomListDiv.innerHTML = ''; // Clear the current list
    if (rooms.length === 0) {
        roomListDiv.appendChild(noRoomsMsg);
        noRoomsMsg.style.display = 'block';
    } else {
        noRoomsMsg.style.display = 'none';
        rooms.forEach(roomName => {
            const roomLink = document.createElement('a');
            roomLink.href = `/user.html?room=${encodeURIComponent(roomName)}`;
            roomLink.textContent = roomName;
            roomListDiv.appendChild(roomLink);
        });
    }
});

// Handle creating a new room
createRoomBtn.addEventListener('click', () => {
    const roomName = roomNameInput.value.trim();
    if (roomName) {
        socket.emit('create room', roomName);
        // Redirect to the host page for that room
        window.location.href = `/host.html?room=${encodeURIComponent(roomName)}`;
    }
});

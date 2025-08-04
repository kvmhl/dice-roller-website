const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};
const emptyRoomTimeouts = {};
const ROOM_DELETION_TIMEOUT = 3000; // 3 seconds in milliseconds

// This Set will track users who have an active roll request to prevent spam.
const rollingUsers = new Set();

const rollCooldowns = {};

/**
 * Parses dice notation and returns a result object.
 * @param {string} notation - The dice notation string (e.g., "2d6+1d20+5").
 * @returns {object} The result of the roll.
 */
function rollDice(notation) {
    try {
        const result = { set: [], constant: 0, result: [], resultTotal: 0, resultString: '', error: false };
        const parts = notation.toLowerCase().split(/(?=[+-])/);
        let total = 0;

        parts.forEach(part => {
            if (part.includes('d')) {
                const [numDiceStr, numSidesStr] = part.replace('+', '').split('d');
                const numDice = numDiceStr === '' ? 1 : parseInt(numDiceStr, 10);
                const numSides = parseInt(numSidesStr, 10);
                for (let i = 0; i < numDice; i++) {
                    const roll = Math.floor(Math.random() * numSides) + 1;
                    result.result.push(roll);
                    total += roll;
                }
            } else {
                const constant = parseInt(part, 10);
                result.constant += constant;
                total += constant;
            }
        });

        result.resultTotal = total;
        result.resultString = result.result.join(' + ');
        if (result.constant !== 0) {
            result.resultString += (result.constant > 0 ? ' + ' : ' ') + result.constant;
        }
        if (parts.length > 1 || result.constant !== 0) {
            result.resultString += ` = ${result.resultTotal}`;
        }
        return result;
    } catch (e) {
        return { error: true };
    }
}

function broadcastRoomList() {
    const roomList = Object.keys(rooms).map(name => ({
        name: name,
        isPrivate: !!rooms[name].password // true if a password is set
    }));
    io.emit('update room list', roomList);
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    broadcastRoomList();

    socket.on('create room', (data) => {
        const { roomName, password } = data;
        if (!rooms[roomName]) {
            rooms[roomName] = {
                password: password || null, // Store the password (or null if public)
                users: [],
                notation: '1d6',
                appearance: {
                    diceColor: '#202020',
                    labelColor: '#aaaaaa',
                    scale: 75
                }
            };
            broadcastRoomList();
            console.log(`Room created: ${roomName}`);

            socket.emit('create_success', { roomName });

        } else {
            // Handle error if room exists
        }
    });

    socket.on('check room', (data) => {
        const { roomName, password } = data;
        const room = rooms[roomName];

        if (!room) {
            socket.emit('room not found');
            return;
        }
        if (room.password && room.password !== password) {
            socket.emit('join_error', { message: 'Incorrect password.' });
            return;
        }
        // If everything is okay, tell the lobby it's safe to navigate
        socket.emit('check_success', { roomName });
    });


    socket.on('join room', (data) => {
        // Correctly deconstruct the incoming data object
        const { roomName, password } = data;
        const room = rooms[roomName];

        if (!room) {
            socket.emit('room not found');
            return;
        }

        // Perform the password check
        if (room.password && room.password !== password) {
            socket.emit('join_error', { message: 'Incorrect password.' });
            return;
        }

        // This part is for the deletion timer
        if (emptyRoomTimeouts[roomName]) {
            clearTimeout(emptyRoomTimeouts[roomName]);
            delete emptyRoomTimeouts[roomName];
            console.log(`Deletion timer for room ${roomName} cancelled.`);
        }

        socket.join(roomName);
        room.users.push(socket.id);
        console.log(`User ${socket.id} joined room: ${roomName}`);

        // Let the client know it was successful (for lobby navigation)
        socket.emit('join_success', { roomName });

        // Broadcast the join message to others
        socket.to(roomName).emit('user_joined', { message: `A new user has joined.` });

        // Send initial state to the new user
        socket.emit('notation update', room.notation);
        socket.emit('appearance update', room.appearance);
    });

    socket.on('set appearance', (data) => {
        const { roomName, newAppearance } = data;
        if (rooms[roomName]) {
            rooms[roomName].appearance = newAppearance;
            io.to(roomName).emit('appearance update', newAppearance);
        }
    });

    socket.on('request roll', (data) => {
        if (rollingUsers.has(socket.id)) {
            return;
        }

        const { roomName, notation, vector } = data;
        const now = Date.now();

        rollingUsers.add(socket.id);

        if (rollCooldowns[socket.id] && now < rollCooldowns[socket.id]) {
            const timeLeft = Math.ceil((rollCooldowns[socket.id] - now) / 1000);
            socket.emit('cooldown', { timeLeft });

            // IMPORTANT: Also tell the client its request is finished, and unlock.
            socket.emit('roll complete');
            rollingUsers.delete(socket.id);
            return;
        }

        rollCooldowns[socket.id] = now + 1500;
        if (rooms[roomName]) {
            const result = rollDice(notation);
            if (!result.error) {
                io.to(roomName).emit('play roll sound');
                // Broadcast the animation event to everyone in the room.
                io.to(roomName).emit('new roll', { result: result, vector: vector });
            }
        }

        socket.emit('roll complete');
        rollingUsers.delete(socket.id); // Unlock the user on the server.
    });


    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        rollingUsers.delete(socket.id);

        for (const roomName in rooms) {
            const userIndex = rooms[roomName].users.indexOf(socket.id);
            if (userIndex !== -1) {
                rooms[roomName].users.splice(userIndex, 1);
                console.log(`User left room: ${roomName}`);

                //Broadcast that a user has left the room
                io.to(roomName).emit('user_left', { message: 'A user has left the room.' });

                if (rooms[roomName].users.length === 0) {
                    console.log(`Room ${roomName} is empty. Starting deletion timer.`);
                    emptyRoomTimeouts[roomName] = setTimeout(() => {
                        if (rooms[roomName] && rooms[roomName].users.length === 0) {
                            delete rooms[roomName];
                            broadcastRoomList();
                            console.log(`Room deleted: ${roomName}`);
                        }
                        delete emptyRoomTimeouts[roomName];
                    }, ROOM_DELETION_TIMEOUT);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
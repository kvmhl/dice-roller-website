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

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    socket.emit('update room list', Object.keys(rooms));

    socket.on('create room', (roomName) => {
        if (!rooms[roomName]) {
            rooms[roomName] = {
                notation: '1d6',
                users: [],
                appearance: {
                    diceColor: '#202020',
                    labelColor: '#aaaaaa',
                    scale: 100
                }
            };
            io.emit('update room list', Object.keys(rooms));
            console.log(`Room created: ${roomName}`);
        }
    });

    socket.on('join room', (roomName) => {
        if (!rooms[roomName]) {
            socket.emit('room not found');
            return;
        }

        if (emptyRoomTimeouts[roomName]) {
            clearTimeout(emptyRoomTimeouts[roomName]);
            delete emptyRoomTimeouts[roomName];
        }

        socket.join(roomName);
        rooms[roomName].users.push(socket.id);
        console.log(`User ${socket.id} joined room: ${roomName}`);
        socket.emit('notation update', rooms[roomName].notation);
        socket.emit('appearance update', rooms[roomName].appearance);
    });

    socket.on('set notation', (data) => {
        const { roomName, newNotation } = data;
        if (rooms[roomName]) {
            rooms[roomName].notation = newNotation;
            io.to(roomName).emit('notation update', newNotation);
        }
    });

    socket.on('set appearance', (data) => {
        const { roomName, newAppearance } = data;
        if (rooms[roomName]) {
            rooms[roomName].appearance = newAppearance;
            io.to(roomName).emit('appearance update', newAppearance);
        }
    });

    socket.on('request roll', (data) => {
        // 1. If the user is already locked by the server, ignore the request.
        if (rollingUsers.has(socket.id)) {
            return;
        }

        const { roomName, notation, vector } = data;
        const now = Date.now();

        // 2. Lock the user immediately.
        rollingUsers.add(socket.id);

        // 3. Check server cooldown.
        if (rollCooldowns[socket.id] && now < rollCooldowns[socket.id]) {
            const timeLeft = Math.ceil((rollCooldowns[socket.id] - now) / 1000);
            socket.emit('cooldown', { timeLeft });

            // IMPORTANT: Also tell the client its request is finished, and unlock.
            socket.emit('roll complete');
            rollingUsers.delete(socket.id);
            return;
        }

        // 4. If not on cooldown, process the roll.
        rollCooldowns[socket.id] = now + 3000;
        if (rooms[roomName]) {
            const result = rollDice(notation);
            if (!result.error) {
                io.to(roomName).emit('play roll sound');
                // Broadcast the animation event to everyone in the room.
                io.to(roomName).emit('new roll', { result: result, vector: vector });
            }
        }

        // 5. Send the specific "unlock" event back to the original sender.
        socket.emit('roll complete');
        rollingUsers.delete(socket.id); // Unlock the user on the server.
    });


    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Ensure user is removed from any locks on disconnect.
        rollingUsers.delete(socket.id);

        for (const roomName in rooms) {
            const userIndex = rooms[roomName].users.indexOf(socket.id);
            if (userIndex !== -1) {
                rooms[roomName].users.splice(userIndex, 1);
                console.log(`User left room: ${roomName}`);

                if (rooms[roomName].users.length === 0) {
                    console.log(`Room ${roomName} is empty. Starting deletion timer.`);
                    emptyRoomTimeouts[roomName] = setTimeout(() => {
                        if (rooms[roomName] && rooms[roomName].users.length === 0) {
                            delete rooms[roomName];
                            io.emit('update room list', Object.keys(rooms));
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
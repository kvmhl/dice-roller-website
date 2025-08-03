// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};
// Object to store deletion timeouts for empty rooms
const emptyRoomTimeouts = {};
const ROOM_DELETION_TIMEOUT = 3000; // 30 seconds

function rollDice(notation) {
    try {
        const result = { set: [], constant: 0, result: [], resultTotal: 0, resultString: '', error: false };
        const parts = notation.toLowerCase().split(/(?=[+-])/);
        let total = 0;
        parts.forEach(part => {
            if (part.includes('d')) {
                const [numDiceStr, numSidesStr] = part.replace('+', '').split('d');
                const numDice = numDiceStr === '' ? 1 : parseInt(numDiceStr);
                const numSides = parseInt(numSidesStr);
                for (let i = 0; i < numDice; i++) {
                    const roll = Math.floor(Math.random() * numSides) + 1;
                    result.result.push(roll);
                    total += roll;
                }
            } else {
                const constant = parseInt(part);
                result.constant += constant;
                total += constant;
            }
        });
        result.resultTotal = total;
        result.resultString = result.result.join(' + ');
        if (result.constant !== 0) result.resultString += (result.constant > 0 ? ' + ' : ' ') + result.constant;
        if (parts.length > 1 || result.constant !== 0) result.resultString += ` = ${result.resultTotal}`;
        return result;
    } catch (e) { return { error: true }; }
}

io.on('connection', (socket) => {
    console.log('A user connected to the lobby');
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
        // If the room doesn't exist, kick user back to lobby
        if (!rooms[roomName]) {
            socket.emit('room not found');
            return;
        }

        // If a deletion timeout is pending for this room, cancel it
        if (emptyRoomTimeouts[roomName]) {
            clearTimeout(emptyRoomTimeouts[roomName]);
            delete emptyRoomTimeouts[roomName];
            console.log(`Room deletion cancelled for: ${roomName}`);
        }

        socket.join(roomName);
        rooms[roomName].users.push(socket.id);
        console.log(`A user joined room: ${roomName}`);
        socket.emit('notation update', rooms[roomName].notation);
        socket.emit('appearance update', rooms[roomName].appearance); // Send appearance
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
            // Broadcast the update to everyone in the room (including the host)
            io.to(roomName).emit('appearance update', newAppearance);
        }
    });

    socket.on('request roll', (data) => {
        const { roomName, notation, vector } = data; // Receive the vector
        if (rooms[roomName]) {
            const result = rollDice(notation);
            if (!result.error) {
                io.to(roomName).emit('new roll', { result: result, vector: vector });
            }
        }
    });

    socket.on('disconnect', () => {
        for (const roomName in rooms) {
            const userIndex = rooms[roomName].users.indexOf(socket.id);
            if (userIndex !== -1) {
                rooms[roomName].users.splice(userIndex, 1);
                console.log(`A user left room: ${roomName}`);

                // If the room is now empty, start a timer to delete it
                if (rooms[roomName].users.length === 0) {
                    console.log(`Room ${roomName} is empty. Starting deletion timer.`);
                    emptyRoomTimeouts[roomName] = setTimeout(() => {
                        // Check again in case someone rejoined
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
        console.log('A user disconnected from the lobby');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

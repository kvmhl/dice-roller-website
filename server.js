// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// --- Room Management ---
// This object will store the state of all active rooms
const rooms = {};

// Helper function to roll dice (remains the same)
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

    // Send the initial list of rooms to the newly connected client
    socket.emit('update room list', Object.keys(rooms));

    // Listen for a host creating a new room
    socket.on('create room', (roomName) => {
        if (!rooms[roomName]) {
            rooms[roomName] = {
                notation: '1d6',
                users: []
            };
            // Tell all clients in the lobby about the new room
            io.emit('update room list', Object.keys(rooms));
            console.log(`Room created: ${roomName}`);
        }
    });

    // Listen for a client joining a specific room
    socket.on('join room', (roomName) => {
        if (rooms[roomName]) {
            socket.join(roomName);
            rooms[roomName].users.push(socket.id);
            console.log(`A user joined room: ${roomName}`);

            // Send the current notation for that room to the new user
            socket.emit('notation update', rooms[roomName].notation);
        }
    });

    // Listen for the host changing the dice notation IN A ROOM
    socket.on('set notation', (data) => {
        const { roomName, newNotation } = data;
        if (rooms[roomName]) {
            rooms[roomName].notation = newNotation;
            // Broadcast to everyone IN THAT ROOM
            io.to(roomName).emit('notation update', newNotation);
        }
    });

    // Listen for a roll request IN A ROOM
    socket.on('request roll', (data) => {
        const { roomName, notation } = data;
        if (rooms[roomName]) {
            const result = rollDice(notation);
            if (!result.error) {
                // Broadcast the result to everyone IN THAT ROOM
                io.to(roomName).emit('new roll', result);
            }
        }
    });

    socket.on('disconnect', () => {
        // Handle removing user from room's user list and deleting empty rooms
        for (const roomName in rooms) {
            const index = rooms[roomName].users.indexOf(socket.id);
            if (index !== -1) {
                rooms[roomName].users.splice(index, 1);
                console.log(`A user left room: ${roomName}`);
                if (rooms[roomName].users.length === 0) {
                    delete rooms[roomName];
                    io.emit('update room list', Object.keys(rooms));
                    console.log(`Room deleted: ${roomName}`);
                }
                break;
            }
        }
        console.log('A user disconnected from the lobby');
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

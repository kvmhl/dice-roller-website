const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Increase the maximum payload size for Socket.IO to allow for texture data
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100 MB
});

app.use(express.static('public'));

const rooms = {};
const emptyRoomTimeouts = {};
const ROOM_DELETION_TIMEOUT = 3000;

function broadcastRoomList() {
    const roomList = Object.keys(rooms).map(name => ({
        name: name,
        isPrivate: !!rooms[name].password
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
                password: password || null,
                users: [],
                diceSet: [
                    {
                        id: 'd6-0',
                        type: 'd6',
                        diceColor: '#cccccc',
                        labelColor: '#222222',
                        metalness: 0.2,
                        roughness: 0.8,
                        texture: { albedo: null, metalness: null, roughness: null, normal: null }
                    }
                ],
                appearance: {
                    backgroundColor: '#212121',
                    backgroundImage: null,
                    useAchillBackground: false, // Default to false
                    scale: 100,
                    simulationSpeed: 1,
                },
                physicsPreset: "Normal",
                isRolling: false
            };
            broadcastRoomList();
            console.log(`Room created: ${roomName}`);
            socket.emit('create_success', { roomName });
        } else {
            socket.emit('create_error', { message: 'Room already exists.' });
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
        socket.emit('check_success', { roomName });
    });

    socket.on('join room', (data) => {
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
        if (emptyRoomTimeouts[roomName]) {
            clearTimeout(emptyRoomTimeouts[roomName]);
            delete emptyRoomTimeouts[roomName];
        }

        socket.join(roomName);
        room.users.push(socket.id);
        console.log(`User ${socket.id} joined room: ${roomName}`);
        socket.to(roomName).emit('user_joined', { message: `A new user has joined.` });

        socket.emit('diceSet update', room.diceSet);
        socket.emit('appearance update', room.appearance);
        socket.emit('physics preset update', room.physicsPreset);
    });

    socket.on('set diceSet', (data) => {
        const { roomName, diceSet } = data;
        if (rooms[roomName]) {
            rooms[roomName].diceSet = diceSet;
            io.to(roomName).emit('diceSet update', diceSet);
        }
    });

    socket.on('set appearance', (data) => {
        const { roomName, newAppearance } = data;
        if (rooms[roomName]) {
            Object.assign(rooms[roomName].appearance, newAppearance);
            io.to(roomName).emit('appearance update', rooms[roomName].appearance);
        }
    });

    socket.on('set physics preset', (data) => {
        const { roomName, presetName } = data;
        if (rooms[roomName]) {
            rooms[roomName].physicsPreset = presetName;
            io.to(roomName).emit('physics preset update', presetName);
        }
    });

    socket.on('request roll', (data) => {
        const { roomName, vector } = data;
        const room = rooms[roomName];

        if (room && room.isRolling) return;

        if (room) {
            room.isRolling = true;
            io.to(roomName).emit('play roll sound');
            io.to(roomName).emit('new roll', { vector: vector });

            const ROLL_COOLDOWN = 1500;
            io.to(roomName).emit('start cooldown', { duration: ROLL_COOLDOWN });

            setTimeout(() => {
                if (rooms[roomName]) {
                    rooms[roomName].isRolling = false;
                    io.to(roomName).emit('enable roll');
                }
            }, ROLL_COOLDOWN);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const roomName in rooms) {
            const userIndex = rooms[roomName].users.indexOf(socket.id);
            if (userIndex !== -1) {
                rooms[roomName].users.splice(userIndex, 1);
                io.to(roomName).emit('user_left', { message: 'A user has left the room.' });
                if (rooms[roomName].users.length === 0) {
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
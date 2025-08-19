const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Store rooms and users
const rooms = new Map();
const users = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join room
    socket.on('joinRoom', (data) => {
        const { roomId, userId, userName } = data;
        
        socket.join(roomId);
        users.set(socket.id, { roomId, userId, userName });
        
        // Initialize room if not exists
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                users: new Set(),
                data: {
                    cameras: [],
                    racks: [],
                    rectOverlays: [],
                    cableLines: []
                }
            });
        }
        
        const room = rooms.get(roomId);
        room.users.add(socket.id);
        
        // Notify others in room
        socket.to(roomId).emit('userJoined', {
            userId,
            userName,
            timestamp: Date.now()
        });
        
        // Send current room data to new user
        socket.emit('roomData', room.data);
        
        // Send user list to all in room
        const userList = Array.from(room.users).map(id => {
            const user = users.get(id);
            return { userId: user.userId, userName: user.userName };
        });
        io.to(roomId).emit('userList', userList);
        
        console.log(`User ${userName} joined room ${roomId}`);
    });
    
    // Sync data
    socket.on('syncData', (data) => {
        const { roomId, cameras, racks, rectOverlays, cableLines } = data;
        
        if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.data = { cameras, racks, rectOverlays, cableLines };
            
            // Broadcast to other users in room
            socket.to(roomId).emit('dataSync', {
                cameras,
                racks,
                rectOverlays,
                cableLines,
                timestamp: Date.now()
            });
        }
    });
    
    // Chat message
    socket.on('chatMessage', (data) => {
        const { roomId, message, userName } = data;
        
        socket.to(roomId).emit('chatMessage', {
            message,
            userName,
            timestamp: Date.now()
        });
    });
    
    // Cursor position
    socket.on('cursorMove', (data) => {
        const { roomId, position } = data;
        
        socket.to(roomId).emit('cursorMove', {
            userId: users.get(socket.id)?.userId,
            userName: users.get(socket.id)?.userName,
            position,
            timestamp: Date.now()
        });
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            const room = rooms.get(user.roomId);
            if (room) {
                room.users.delete(socket.id);
                
                // Notify others
                socket.to(user.roomId).emit('userLeft', {
                    userId: user.userId,
                    userName: user.userName,
                    timestamp: Date.now()
                });
                
                // Remove room if empty
                if (room.users.size === 0) {
                    rooms.delete(user.roomId);
                    console.log(`Room ${user.roomId} deleted (empty)`);
                } else {
                    // Update user list
                    const userList = Array.from(room.users).map(id => {
                        const u = users.get(id);
                        return { userId: u.userId, userName: u.userName };
                    });
                    io.to(user.roomId).emit('userList', userList);
                }
            }
            
            users.delete(socket.id);
            console.log(`User ${user.userName} disconnected from room ${user.roomId}`);
        }
    });
});

// API Routes
app.get('/api/rooms/:roomId', (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);
    
    if (room) {
        res.json({
            roomId,
            userCount: room.users.size,
            data: room.data
        });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

app.get('/api/rooms', (req, res) => {
    const roomList = Array.from(rooms.keys()).map(roomId => {
        const room = rooms.get(roomId);
        return {
            roomId,
            userCount: room.users.size
        };
    });
    
    res.json(roomList);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: Date.now(),
        rooms: rooms.size,
        users: users.size
    });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.htm'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CCTV Collaborative Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to access the application`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

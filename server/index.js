const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// Configuration Socket.IO
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

// --- TEMPS RÉEL ---
let connectedUsers = new Map();

io.on('connection', (socket) => {
    socket.on('joinGame', (userData) => {
        connectedUsers.set(socket.id, {
            id: userData.id,
            pseudo: userData.pseudo,
            avatar: userData.avatar || '👤'
        });
        io.emit('updateUserList', Array.from(connectedUsers.values()));
    });

    socket.on('changeAvatar', (newAvatar) => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            user.avatar = newAvatar;
            io.emit('updateUserList', Array.from(connectedUsers.values()));
        }
    });

    socket.on('disconnect', () => {
        connectedUsers.delete(socket.id);
        io.emit('updateUserList', Array.from(connectedUsers.values()));
    });
});

// --- API ROUTES ---

app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: { email: email.toLowerCase(), pseudo, password: hashedPassword, avatar: '🕹️' }
        });
        res.status(201).json({ user: { id: newUser.id, pseudo: newUser.pseudo, avatar: newUser.avatar } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "L'email ou le pseudo est déjà utilisé." });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (user && await bcrypt.compare(password, user.password)) {
            res.json({ user: { id: user.id, pseudo: user.pseudo, avatar: user.avatar } });
        } else {
            res.status(401).json({ error: "Identifiants incorrects" });
        }
    } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post('/api/user/update-avatar', async (req, res) => {
    try {
        const { userId, avatar } = req.body;
        const updated = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { avatar }
        });
        res.json({ avatar: updated.avatar });
    } catch (err) { res.status(500).json({ error: "Erreur mise à jour" }); }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 Serveur prêt sur le port ${PORT}`));
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
    cors: {
        origin: "*", // À remplacer par ton URL frontend en production
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// --- GESTION TEMPS RÉEL (SOCKET.IO) ---
let connectedUsers = {};

io.on('connection', (socket) => {
    // Un joueur rejoint le lobby
    socket.on('joinGame', (userData) => {
        connectedUsers[socket.id] = {
            id: userData.id,
            pseudo: userData.pseudo,
            avatar: userData.avatar || '👤'
        };
        io.emit('updateUserList', Object.values(connectedUsers));
    });

    // Un joueur change d'avatar
    socket.on('changeAvatar', (newAvatar) => {
        if (connectedUsers[socket.id]) {
            connectedUsers[socket.id].avatar = newAvatar;
            io.emit('updateUserList', Object.values(connectedUsers));
        }
    });

    socket.on('disconnect', () => {
        delete connectedUsers[socket.id];
        io.emit('updateUserList', Object.values(connectedUsers));
    });
});

// --- ROUTES API ---

// Inscription
app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                pseudo,
                password: hashedPassword,
                avatar: '🕹️'
            }
        });
        res.status(201).json({ user: { id: newUser.id, pseudo: newUser.pseudo, avatar: newUser.avatar } });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de l'inscription" });
    }
});

// Connexion
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (user && await bcrypt.compare(password, user.password)) {
            res.status(200).json({ user: { id: user.id, pseudo: user.pseudo, avatar: user.avatar } });
        } else {
            res.status(401).json({ error: "Identifiants incorrects" });
        }
    } catch (error) {
        res.status(500).json({ error: "Erreur de connexion" });
    }
});

// Mise à jour Avatar
app.post('/api/user/update-avatar', async (req, res) => {
    try {
        const { userId, avatar } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { avatar: avatar }
        });
        res.status(200).json({ avatar: updatedUser.avatar });
    } catch (error) {
        res.status(500).json({ error: "Erreur mise à jour avatar" });
    }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`✅ Serveur sur port ${PORT}`));
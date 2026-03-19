const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// Configuration Socket.IO robuste
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// --- GESTION TEMPS RÉEL ---
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

// --- ROUTES API ---

app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password } = req.body;
        if (!email || !pseudo || !password) return res.status(400).json({ error: "Champs manquants" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: { email: email.toLowerCase(), pseudo, password: hashedPassword, avatar: '🕹️' }
        });
        res.status(201).json({ user: { id: newUser.id, pseudo: newUser.pseudo, avatar: newUser.avatar } });
    } catch (error) {
        console.error("Erreur Inscription:", error);
        res.status(500).json({ error: "Erreur DB : Vérifiez si l'email existe déjà" });
    }
});

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
        res.status(500).json({ error: "Erreur serveur login" });
    }
});

app.post('/api/user/update-avatar', async (req, res) => {
    try {
        const { userId, avatar } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { avatar }
        });
        res.status(200).json({ avatar: updatedUser.avatar });
    } catch (error) {
        res.status(500).json({ error: "Erreur mise à jour" });
    }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 Serveur actif sur le port ${PORT}`));
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const server = http.createServer(app);

// Configuration du serveur Socket.io (indispensable pour le multijoueur)
const io = new Server(server, {
    cors: {
        origin: "*", // En production sur Railway, on autorise tout ou l'URL du client
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

let onlineUsers = [];

// --- LOGIQUE SOCKET.IO (TEMPS RÉEL) ---
io.on('connection', (socket) => {
    console.log('Joueur connecté:', socket.id);

    socket.on('join_lobby', (userData) => {
        // On évite les doublons dans la liste
        onlineUsers = onlineUsers.filter(u => u.pseudo !== userData.pseudo);
        onlineUsers.push({ ...userData, socketId: socket.id });
        io.emit('update_user_list', onlineUsers);
    });

    socket.on('disconnect', () => {
        onlineUsers = onlineUsers.filter(u => u.socketId !== socket.id);
        io.emit('update_user_list', onlineUsers);
    });
});

// --- ROUTES AUTHENTIFICATION ---
app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password, birthDate, avatar } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, pseudo, password: hashedPassword, birthDate: new Date(birthDate), avatar }
        });
        res.status(201).json({ user: { pseudo: user.pseudo, avatar: user.avatar } });
    } catch (e) {
        res.status(400).json({ error: "Pseudo ou Email déjà pris" });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && await bcrypt.compare(password, user.password)) {
        res.json({ user: { pseudo: user.pseudo, avatar: user.avatar } });
    } else {
        res.status(401).json({ error: "Identifiants incorrects" });
    }
});

// Port dynamique pour Railway
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
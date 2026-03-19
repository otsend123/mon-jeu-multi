const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

let onlineUsers = [];

io.on('connection', (socket) => {
    socket.on('join_lobby', (userData) => {
        onlineUsers = onlineUsers.filter(u => u.pseudo !== userData.pseudo);
        onlineUsers.push({ ...userData, socketId: socket.id });
        io.emit('update_user_list', onlineUsers);
    });
    socket.on('disconnect', () => {
        onlineUsers = onlineUsers.filter(u => u.socketId !== socket.id);
        io.emit('update_user_list', onlineUsers);
    });
});

app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password, birthDate, avatar } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, pseudo, password: hashedPassword, birthDate: new Date(birthDate), avatar: avatar || '👤' }
        });
        res.status(201).json({ user: { pseudo: user.pseudo, avatar: user.avatar } });
    } catch (e) { res.status(400).json({ error: "Erreur inscription" }); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && await bcrypt.compare(password, user.password)) {
        res.json({ user: { pseudo: user.pseudo, avatar: user.avatar } });
    } else { res.status(401).json({ error: "Identifiants incorrects" }); }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Serveur sur port ${PORT}`));
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send("✅ Le backend CyberLobby est en ligne et gère les salons !");
});

// --- LOGIQUE TEMPS RÉEL (SOCKET.IO) ---
let connectedUsers = new Map();
let lobbies = []; // Liste des salons actifs

io.on('connection', (socket) => {

    // Un joueur se connecte au serveur global
    socket.on('joinGame', (userData) => {
        connectedUsers.set(socket.id, {
            id: userData.id,
            pseudo: userData.pseudo,
            avatar: userData.avatar || '👤'
        });
        // Envoie la liste des joueurs à tout le monde
        io.emit('updateUserList', Array.from(connectedUsers.values()));
        // Envoie la liste des salons actuels au nouveau venu
        socket.emit('updateLobbies', lobbies);
    });

    // Création d'un nouveau salon
    socket.on('createLobby', (lobbyName) => {
        const user = connectedUsers.get(socket.id);
        if (user && lobbyName.trim() !== '') {
            const newLobby = {
                id: Date.now().toString(),
                name: lobbyName,
                creator: user.pseudo,
                players: [user] // Le créateur rejoint automatiquement son salon
            };
            lobbies.push(newLobby);
            // On met à jour la liste des salons pour tout le monde
            io.emit('updateLobbies', lobbies);
        }
    });

    // Changement d'avatar
    socket.on('changeAvatar', (newAvatar) => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            user.avatar = newAvatar;
            io.emit('updateUserList', Array.from(connectedUsers.values()));
        }
    });

    // Déconnexion
    socket.on('disconnect', () => {
        connectedUsers.delete(socket.id);
        io.emit('updateUserList', Array.from(connectedUsers.values()));
        // (Optionnel pour plus tard : retirer le joueur des salons s'il s'y trouvait)
    });
});

// --- ROUTES API ---

app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: { email: email.toLowerCase(), pseudo, password: hashedPassword, avatar: '🕹️' }
        });
        res.status(201).json({ user: { id: newUser.id, pseudo: newUser.pseudo, avatar: newUser.avatar } });
    } catch (err) {
        res.status(500).json({ error: "Erreur : Email ou Pseudo déjà pris." });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (user && await bcrypt.compare(password, user.password)) {
            res.json({ user: { id: user.id, pseudo: user.pseudo, avatar: user.avatar } });
        } else {
            res.status(401).json({ error: "Identifiants incorrects." });
        }
    } catch (err) {
        res.status(500).json({ error: "Erreur interne du serveur." });
    }
});

app.post('/api/user/update-avatar', async (req, res) => {
    try {
        const { userId, avatar } = req.body;
        const updated = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { avatar }
        });
        res.json({ avatar: updated.avatar });
    } catch (err) {
        res.status(500).json({ error: "Erreur de mise à jour de l'avatar." });
    }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur en ligne sur le port ${PORT}`));
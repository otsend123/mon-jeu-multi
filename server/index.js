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
    res.status(200).send("✅ Backend CyberLobby en ligne (Sessions Uniques activées) !");
});

// --- ÉTATS DU SERVEUR ---
let connectedUsers = new Map(); // socketId => Données Utilisateur
let userSockets = new Map();    // userId => socketId (Pour la session unique)
let lobbies = [];               // Liste des salons

// Fonction pour retirer un joueur de son salon via son socketId
function leaveCurrentLobby(socketId) {
    const user = connectedUsers.get(socketId);
    if (!user) return;

    lobbies.forEach((lobby, index) => {
        const playerIndex = lobby.players.findIndex(p => p.socketId === socketId);
        if (playerIndex !== -1) {
            lobby.players.splice(playerIndex, 1);

            // On retire le socket du canal Socket.io s'il existe encore
            const socketToLeave = io.sockets.sockets.get(socketId);
            if (socketToLeave) socketToLeave.leave(lobby.id);

            // Si le salon est vide, on le supprime
            if (lobby.players.length === 0) {
                lobbies.splice(index, 1);
            } else {
                io.to(lobby.id).emit('lobbyUpdated', lobby);
            }
        }
    });
    io.emit('updateLobbies', lobbies);
}

io.on('connection', (socket) => {

    // 1. REJOINDRE LE JEU (Avec vérification de session unique)
    socket.on('joinGame', (userData) => {
        // --- SYSTÈME DE SESSION UNIQUE ---
        if (userSockets.has(userData.id)) {
            const oldSocketId = userSockets.get(userData.id);
            // On prévient l'ancien onglet de se fermer
            io.to(oldSocketId).emit('forceDisconnect', "Ce compte a été connecté depuis un autre appareil ou onglet.");

            // On nettoie l'ancienne présence
            leaveCurrentLobby(oldSocketId);
            connectedUsers.delete(oldSocketId);
        }

        // On enregistre la nouvelle connexion
        userSockets.set(userData.id, socket.id);
        connectedUsers.set(socket.id, {
            socketId: socket.id,
            id: userData.id,
            pseudo: userData.pseudo,
            avatar: userData.avatar || '👤'
        });

        io.emit('updateUserList', Array.from(connectedUsers.values()));
        socket.emit('updateLobbies', lobbies);
    });

    // 2. CRÉER UN SALON
    socket.on('createLobby', (lobbyName) => {
        const user = connectedUsers.get(socket.id);
        if (user && lobbyName.trim() !== '') {
            leaveCurrentLobby(socket.id);

            const newLobby = {
                id: `room_${Date.now()}`,
                name: lobbyName,
                creator: user.pseudo,
                players: [user]
            };
            lobbies.push(newLobby);

            socket.join(newLobby.id);
            socket.emit('lobbyJoined', newLobby);
            io.emit('updateLobbies', lobbies);
        }
    });

    // 3. REJOINDRE UN SALON EXISTANT
    socket.on('joinLobby', (lobbyId) => {
        const user = connectedUsers.get(socket.id);
        const lobby = lobbies.find(l => l.id === lobbyId);

        if (user && lobby) {
            if (lobby.players.length >= 8) {
                socket.emit('roomError', "Ce salon est plein (8/8).");
                return;
            }
            leaveCurrentLobby(socket.id);
            lobby.players.push(user);
            socket.join(lobby.id);

            socket.emit('lobbyJoined', lobby);
            io.to(lobby.id).emit('lobbyUpdated', lobby);
            io.emit('updateLobbies', lobbies);
        }
    });

    // 4. QUITTER LE SALON ACTUEL
    socket.on('leaveLobby', () => {
        leaveCurrentLobby(socket.id);
        socket.emit('lobbyLeft');
    });

    // 5. SYSTÈME D'INVITATION
    socket.on('invitePlayer', ({ targetSocketId, lobbyId }) => {
        const sender = connectedUsers.get(socket.id);
        const lobby = lobbies.find(l => l.id === lobbyId);

        if (sender && lobby) {
            socket.to(targetSocketId).emit('receiveInvite', {
                lobbyId: lobby.id,
                lobbyName: lobby.name,
                senderName: sender.pseudo
            });
        }
    });

    // 6. CHANGEMENT D'AVATAR
    socket.on('changeAvatar', (newAvatar) => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            user.avatar = newAvatar;
            io.emit('updateUserList', Array.from(connectedUsers.values()));
            lobbies.forEach(lobby => {
                const p = lobby.players.find(pl => pl.socketId === socket.id);
                if (p) {
                    p.avatar = newAvatar;
                    io.to(lobby.id).emit('lobbyUpdated', lobby);
                }
            });
        }
    });

    // 7. DÉCONNEXION NATURELLE (Fermeture de page, perte de co)
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            userSockets.delete(user.id); // Libère l'ID utilisateur
            leaveCurrentLobby(socket.id);
            connectedUsers.delete(socket.id);
            io.emit('updateUserList', Array.from(connectedUsers.values()));
        }
    });
});

// --- ROUTES API (Authentification) ---
app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: { email: email.toLowerCase(), pseudo, password: hashedPassword, avatar: '🕹️' }
        });
        res.status(201).json({ user: { id: newUser.id, pseudo: newUser.pseudo, avatar: newUser.avatar } });
    } catch (err) { res.status(500).json({ error: "Erreur DB." }); }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (user && await bcrypt.compare(password, user.password)) {
            res.json({ user: { id: user.id, pseudo: user.pseudo, avatar: user.avatar } });
        } else { res.status(401).json({ error: "Identifiants incorrects." }); }
    } catch (err) { res.status(500).json({ error: "Erreur serveur." }); }
});

app.post('/api/user/update-avatar', async (req, res) => {
    try {
        const { userId, avatar } = req.body;
        const updated = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { avatar }
        });
        res.json({ avatar: updated.avatar });
    } catch (err) { res.status(500).json({ error: "Erreur mise à jour." }); }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur en ligne sur le port ${PORT}`));
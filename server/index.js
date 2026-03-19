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
    res.status(200).send("✅ Backend CyberLobby en ligne (Choix des jeux activé) !");
});

let connectedUsers = new Map();
let userSockets = new Map();
let lobbies = [];

function leaveCurrentLobby(socketId) {
    const user = connectedUsers.get(socketId);
    if (!user) return;

    lobbies.forEach((lobby, index) => {
        const playerIndex = lobby.players.findIndex(p => p.socketId === socketId);
        if (playerIndex !== -1) {
            lobby.players.splice(playerIndex, 1);

            const socketToLeave = io.sockets.sockets.get(socketId);
            if (socketToLeave) socketToLeave.leave(lobby.id);

            if (lobby.players.length === 0) {
                lobbies.splice(index, 1);
            } else {
                // Si l'hôte quitte, on nomme le joueur suivant comme nouvel hôte (Optionnel mais pratique)
                if (lobby.creator === user.pseudo && lobby.players.length > 0) {
                    lobby.creator = lobby.players[0].pseudo;
                }
                io.to(lobby.id).emit('lobbyUpdated', lobby);
            }
        }
    });
    io.emit('updateLobbies', lobbies);
}

io.on('connection', (socket) => {

    socket.on('joinGame', (userData) => {
        if (userSockets.has(userData.id)) {
            const oldSocketId = userSockets.get(userData.id);
            io.to(oldSocketId).emit('forceDisconnect', "Ce compte a été connecté depuis un autre appareil.");
            leaveCurrentLobby(oldSocketId);
            connectedUsers.delete(oldSocketId);
        }

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

    socket.on('createLobby', (lobbyName) => {
        const user = connectedUsers.get(socket.id);
        if (user && lobbyName.trim() !== '') {
            leaveCurrentLobby(socket.id);

            const newLobby = {
                id: `room_${Date.now()}`,
                name: lobbyName,
                creator: user.pseudo,
                players: [user],
                selectedGame: null // <-- NOUVEAU : Stocke l'ID du jeu choisi
            };
            lobbies.push(newLobby);

            socket.join(newLobby.id);
            socket.emit('lobbyJoined', newLobby);
            io.emit('updateLobbies', lobbies);
        }
    });

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

    socket.on('leaveLobby', () => {
        leaveCurrentLobby(socket.id);
        socket.emit('lobbyLeft');
    });

    // --- NOUVEAU : SÉLECTIONNER UN JEU ---
    socket.on('selectGame', ({ lobbyId, gameId }) => {
        const lobby = lobbies.find(l => l.id === lobbyId);
        const user = connectedUsers.get(socket.id);

        // Seul le créateur peut changer le jeu
        if (lobby && user && lobby.creator === user.pseudo) {
            lobby.selectedGame = gameId;
            io.to(lobby.id).emit('lobbyUpdated', lobby);
            io.emit('updateLobbies', lobbies); // Pour l'afficher sur l'accueil si on veut
        }
    });

    socket.on('invitePlayer', ({ targetSocketId, lobbyId }) => {
        const sender = connectedUsers.get(socket.id);
        const lobby = lobbies.find(l => l.id === lobbyId);
        if (sender && lobby) {
            socket.to(targetSocketId).emit('receiveInvite', {
                lobbyId: lobby.id, lobbyName: lobby.name, senderName: sender.pseudo
            });
        }
    });

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

    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            userSockets.delete(user.id);
            leaveCurrentLobby(socket.id);
            connectedUsers.delete(socket.id);
            io.emit('updateUserList', Array.from(connectedUsers.values()));
        }
    });
});

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
            where: { id: parseInt(userId) }, data: { avatar }
        });
        res.json({ avatar: updated.avatar });
    } catch (err) { res.status(500).json({ error: "Erreur mise à jour." }); }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur en ligne sur le port ${PORT}`));
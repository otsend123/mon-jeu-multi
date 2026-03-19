const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require("socket.io");
const quizGame = require('./games/quiz.js');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.status(200).send("✅ Backend CyberLobby (Reconnexion Intelligente) en ligne !"));

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
                if (lobby.creator === user.pseudo && lobby.players.length > 0) {
                    lobby.creator = lobby.players[0].pseudo; // Passe le lead au suivant
                }
                if (lobby.status === 'playing' && lobby.selectedGame === 'quiz') {
                    quizGame.handleDisconnection(io, lobbies, lobby);
                }
                io.to(lobby.id).emit('lobbyUpdated', lobby);
            }
        }
    });
    io.emit('updateLobbies', lobbies);
}

io.on('connection', (socket) => {

    socket.on('joinGame', (userData) => {
        // --- RECONNEXION INTELLIGENTE ---
        if (userSockets.has(userData.id)) {
            const oldSocketId = userSockets.get(userData.id);
            const activeLobby = lobbies.find(l => l.players.some(p => p.id === userData.id));

            if (activeLobby) {
                // Le joueur était en jeu ! On met à jour son socket sans casser la partie
                const player = activeLobby.players.find(p => p.id === userData.id);
                player.socketId = socket.id;
                connectedUsers.delete(oldSocketId);
                socket.join(activeLobby.id);
                socket.emit('lobbyJoined', activeLobby);
            } else {
                // Pas en jeu, on nettoie proprement
                io.to(oldSocketId).emit('forceDisconnect', "Double connexion détectée.");
                leaveCurrentLobby(oldSocketId);
                connectedUsers.delete(oldSocketId);
                socket.emit('lobbyLeft');
            }
        }

        userSockets.set(userData.id, socket.id);
        connectedUsers.set(socket.id, {
            socketId: socket.id, id: userData.id, pseudo: userData.pseudo, avatar: userData.avatar || '👤'
        });

        io.emit('updateUserList', Array.from(connectedUsers.values()));
        socket.emit('updateLobbies', lobbies);
    });

    socket.on('createLobby', (lobbyName) => {
        const user = connectedUsers.get(socket.id);
        if (user && lobbyName.trim() !== '') {
            leaveCurrentLobby(socket.id);
            const newLobby = {
                id: `room_${Date.now()}`, name: lobbyName, creator: user.pseudo,
                players: [user], selectedGame: null, status: 'waiting'
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
            if (lobby.players.length >= 8) return socket.emit('roomError', "Salon plein (8/8).");
            if (lobby.status === 'playing') return socket.emit('roomError', "Partie en cours.");
            leaveCurrentLobby(socket.id);
            lobby.players.push(user);
            socket.join(lobby.id);
            socket.emit('lobbyJoined', lobby);
            io.to(lobby.id).emit('lobbyUpdated', lobby);
            io.emit('updateLobbies', lobbies);
        }
    });

    socket.on('leaveLobby', () => { leaveCurrentLobby(socket.id); socket.emit('lobbyLeft'); });

    socket.on('selectGame', ({ lobbyId, gameId }) => {
        const lobby = lobbies.find(l => l.id === lobbyId);
        const user = connectedUsers.get(socket.id);
        if (lobby && user && lobby.creator === user.pseudo && lobby.status === 'waiting') {
            lobby.selectedGame = gameId;
            io.to(lobby.id).emit('lobbyUpdated', lobby);
            io.emit('updateLobbies', lobbies);
        }
    });

    socket.on('startGame', async (lobbyId) => {
        const lobby = lobbies.find(l => l.id === lobbyId);
        const user = connectedUsers.get(socket.id);
        if (lobby && user && lobby.creator === user.pseudo) {
            if (lobby.selectedGame === 'quiz') await quizGame.startQuizGame(io, lobbies, lobby, prisma);
        }
    });

    socket.on('submitAnswer', ({ lobbyId, answer }) => {
        const lobby = lobbies.find(l => l.id === lobbyId);
        if (lobby && lobby.status === 'playing' && lobby.selectedGame === 'quiz') {
            quizGame.handleAnswer(io, lobbies, lobby, socket.id, answer);
        }
    });

    // --- NOUVEAU : BOUTON DE SECOURS POUR L'HÔTE ---
    socket.on('forceNextRound', (lobbyId) => {
        const lobby = lobbies.find(l => l.id === lobbyId);
        const user = connectedUsers.get(socket.id);
        if (lobby && user && lobby.creator === user.pseudo && lobby.status === 'playing') {
            if (lobby.selectedGame === 'quiz') quizGame.forceNext(io, lobbies, lobby);
        }
    });

    socket.on('sendMessage', (text) => {
        const user = connectedUsers.get(socket.id);
        if (user && text.trim() !== '') {
            io.emit('receiveMessage', {
                id: Date.now() + Math.random(), pseudo: user.pseudo, avatar: user.avatar,
                text: text, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            });
        }
    });

    socket.on('invitePlayer', ({ targetSocketId, lobbyId }) => {
        const sender = connectedUsers.get(socket.id);
        const lobby = lobbies.find(l => l.id === lobbyId);
        if (sender && lobby) {
            socket.to(targetSocketId).emit('receiveInvite', { lobbyId: lobby.id, lobbyName: lobby.name, senderName: sender.pseudo });
        }
    });

    socket.on('changeAvatar', (newAvatar) => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            user.avatar = newAvatar;
            io.emit('updateUserList', Array.from(connectedUsers.values()));
            lobbies.forEach(lobby => {
                const p = lobby.players.find(pl => pl.socketId === socket.id);
                if (p) { p.avatar = newAvatar; io.to(lobby.id).emit('lobbyUpdated', lobby); }
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

// ... (Garde tes routes API /register, /login, /api/user/update-avatar identiques ici) ...
app.post('/register', async (req, res) => { try { const { email, pseudo, password } = req.body; const hashedPassword = await bcrypt.hash(password, 10); const newUser = await prisma.user.create({ data: { email: email.toLowerCase(), pseudo, password: hashedPassword, avatar: '🕹️' } }); res.status(201).json({ user: { id: newUser.id, pseudo: newUser.pseudo, avatar: newUser.avatar } }); } catch (err) { res.status(500).json({ error: "Erreur DB." }); } });
app.post('/login', async (req, res) => { try { const { email, password } = req.body; const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } }); if (user && await bcrypt.compare(password, user.password)) { res.json({ user: { id: user.id, pseudo: user.pseudo, avatar: user.avatar } }); } else { res.status(401).json({ error: "Identifiants incorrects." }); } } catch (err) { res.status(500).json({ error: "Erreur serveur." }); } });
app.post('/api/user/update-avatar', async (req, res) => { try { const { userId, avatar } = req.body; const updated = await prisma.user.update({ where: { id: parseInt(userId) }, data: { avatar } }); res.json({ avatar: updated.avatar }); } catch (err) { res.status(500).json({ error: "Erreur mise à jour." }); } });

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur en ligne sur le port ${PORT}`));
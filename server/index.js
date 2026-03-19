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
    res.status(200).send("✅ Le backend CyberLobby (Rooms & Invites) est en ligne !");
});

// --- ÉTATS DU SERVEUR ---
let connectedUsers = new Map(); // socket.id => User Data
let lobbies = []; // Liste des salons { id, name, creator, players: [] }

// Fonction utilitaire pour faire quitter un joueur de son salon actuel
function leaveCurrentLobby(socket) {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    lobbies.forEach((lobby, index) => {
        const playerIndex = lobby.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex !== -1) {
            lobby.players.splice(playerIndex, 1);
            socket.leave(lobby.id);

            // Si le salon est vide, on le supprime
            if (lobby.players.length === 0) {
                lobbies.splice(index, 1);
            } else {
                // Sinon on met à jour les joueurs restants dans ce salon
                io.to(lobby.id).emit('lobbyUpdated', lobby);
            }
        }
    });
    // On met à jour la liste publique des salons
    io.emit('updateLobbies', lobbies);
}

io.on('connection', (socket) => {

    socket.on('joinGame', (userData) => {
        connectedUsers.set(socket.id, {
            socketId: socket.id, // Important pour les invitations privées
            id: userData.id,
            pseudo: userData.pseudo,
            avatar: userData.avatar || '👤'
        });
        io.emit('updateUserList', Array.from(connectedUsers.values()));
        socket.emit('updateLobbies', lobbies);
    });

    // 1. CRÉER UN SALON (Et le rejoindre automatiquement)
    socket.on('createLobby', (lobbyName) => {
        const user = connectedUsers.get(socket.id);
        if (user && lobbyName.trim() !== '') {
            leaveCurrentLobby(socket); // Quitte l'ancien salon si nécessaire

            const newLobby = {
                id: `room_${Date.now()}`,
                name: lobbyName,
                creator: user.pseudo,
                players: [user] // Le créateur est dedans
            };
            lobbies.push(newLobby);

            socket.join(newLobby.id); // Rejoint le canal Socket.io
            socket.emit('lobbyJoined', newLobby); // Indique au client de changer de vue
            io.emit('updateLobbies', lobbies); // Met à jour l'accueil
        }
    });

    // 2. REJOINDRE UN SALON EXISTANT (Limite 8 joueurs)
    socket.on('joinLobby', (lobbyId) => {
        const user = connectedUsers.get(socket.id);
        const lobby = lobbies.find(l => l.id === lobbyId);

        if (user && lobby) {
            if (lobby.players.length >= 8) {
                socket.emit('roomError', "Ce salon est plein (8/8).");
                return;
            }
            leaveCurrentLobby(socket); // Quitte l'actuel
            lobby.players.push(user);
            socket.join(lobby.id);

            socket.emit('lobbyJoined', lobby);
            io.to(lobby.id).emit('lobbyUpdated', lobby); // Met à jour la vue de la salle
            io.emit('updateLobbies', lobbies);
        }
    });

    // 3. QUITTER LE SALON ACTUEL
    socket.on('leaveLobby', () => {
        leaveCurrentLobby(socket);
        socket.emit('lobbyLeft'); // Ramène le client à l'accueil
    });

    // 4. SYSTÈME D'INVITATION
    socket.on('invitePlayer', ({ targetSocketId, lobbyId }) => {
        const sender = connectedUsers.get(socket.id);
        const lobby = lobbies.find(l => l.id === lobbyId);

        if (sender && lobby) {
            // Envoie un événement privé uniquement au joueur ciblé
            socket.to(targetSocketId).emit('receiveInvite', {
                lobbyId: lobby.id,
                lobbyName: lobby.name,
                senderName: sender.pseudo
            });
        }
    });

    socket.on('changeAvatar', (newAvatar) => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            user.avatar = newAvatar;
            io.emit('updateUserList', Array.from(connectedUsers.values()));
            // Mettre à jour dans le salon si le joueur y est
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
        leaveCurrentLobby(socket);
        connectedUsers.delete(socket.id);
        io.emit('updateUserList', Array.from(connectedUsers.values()));
    });
});

// --- ROUTES API ---
// (Identiques à avant)
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
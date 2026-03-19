// server/index.js
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Configuration Socket.IO avec CORS pour le développement
const io = new Server(server, {
    cors: {
        origin: "*", // En production, remplacez "*" par l'URL de votre frontend (ex: https://monjeu.up.railway.app)
        methods: ["GET", "POST"]
    }
});

const prisma = new PrismaClient();

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json()); // Permet de lire le corps des requêtes JSON

// --- GESTION DES JOUEURS CONNECTÉS (Temps Réel) ---
let connectedUsers = {}; // Structure : { socketId: { id, pseudo, avatar } }

io.on('connection', (socket) => {
    // console.log('⚡ Client connecté au Socket :', socket.id);

    // Un joueur rejoint le Lobby (après connexion/inscription)
    socket.on('joinGame', (userData) => {
        // On enregistre l'utilisateur avec son socketId
        connectedUsers[socket.id] = {
            id: userData.id,
            pseudo: userData.pseudo,
            avatar: userData.avatar || '👤' // Avatar par défaut si absent
        };
        console.log(`👤 ${userData.pseudo} a rejoint le Lobby.`);

        // On envoie la liste mise à jour de TOUS les joueurs connectés à TOUT LE MONDE
        io.emit('updateUserList', Object.values(connectedUsers));
    });

    // Un joueur change son avatar en direct
    socket.on('changeAvatar', (newAvatar) => {
        if (connectedUsers[socket.id]) {
            connectedUsers[socket.id].avatar = newAvatar;
            console.log(`✨ ${connectedUsers[socket.id].pseudo} a changé d'avatar pour ${newAvatar}.`);

            // On notifie tout le monde du changement d'apparence
            io.emit('updateUserList', Object.values(connectedUsers));
        }
    });

    // Gestion de la déconnexion (fermeture d'onglet, perte réseau)
    socket.on('disconnect', () => {
        const user = connectedUsers[socket.id];
        if (user) {
            console.log(`❌ ${user.pseudo} a quitté le Lobby.`);
            delete connectedUsers[socket.id]; // Retrait de la liste

            // Mise à jour de la liste pour les autres
            io.emit('updateUserList', Object.values(connectedUsers));
        }
    });
});

// --- ROUTES API ---

// 1. INSCRIPTION (REGISTER)
app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password } = req.body;

        // Validation simple
        if (!email || !pseudo || !password) {
            return res.status(400).json({ error: "Tous les champs sont obligatoires." });
        }

        // Vérification si l'email ou le pseudo existe déjà
        const userExists = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email.toLowerCase() },
                    { pseudo: pseudo }
                ]
            }
        });

        if (userExists) {
            return res.status(400).json({ error: "Cet email ou ce pseudo est déjà utilisé." });
        }

        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Avatar par défaut pour les nouveaux comptes
        const defaultAvatar = '🕹️';

        // Création de l'utilisateur dans la base de données
        const newUser = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                pseudo: pseudo,
                password: hashedPassword,
                avatar: defaultAvatar
            }
        });

        console.log(`✅ Nouveau compte créé : ${newUser.pseudo}`);

        // Réponse de succès (on ne renvoie pas le mot de passe)
        res.status(201).json({
            message: "Compte créé avec succès !",
            user: { id: newUser.id, pseudo: newUser.pseudo, avatar: newUser.avatar }
        });

    } catch (error) {
        console.error("❌ ERREUR REGISTER :", error.message);
        res.status(500).json({ error: "Une erreur est survenue lors de l'inscription." });
    }
});

// 2. CONNEXION (LOGIN)
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email et mot de passe requis." });
        }

        // Recherche de l'utilisateur par email
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        // Vérification de l'utilisateur et du mot de passe
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect." });
        }

        console.log(`🔑 Connexion réussie : ${user.pseudo}`);

        // Réponse de succès avec les infos du profil
        res.status(200).json({
            message: "Connexion réussie !",
            user: {
                id: user.id,
                pseudo: user.pseudo,
                avatar: user.avatar
            }
        });

    } catch (error) {
        console.error("❌ ERREUR LOGIN :", error.message);
        res.status(500).json({ error: "Une erreur est survenue lors de la connexion." });
    }
});

// 3. MISE À JOUR DE L'AVATAR (API)
app.post('/api/user/update-avatar', async (req, res) => {
    try {
        const { userId, avatar } = req.body;

        if (!userId || !avatar) {
            return res.status(400).json({ error: "Informations manquantes." });
        }

        // Mise à jour sécurisée dans la base de données via Prisma
        const updatedUser = await prisma.user.update({
            where: { id: parseInt(userId) }, // Assurez-vous que l'ID est un nombre
            data: { avatar: avatar }
        });

        console.log(`✨ Avatar mis à jour pour l'ID ${userId} : ${avatar}`);

        // On renvoie le nouvel avatar pour confirmer
        res.status(200).json({ message: "Avatar mis à jour !", avatar: updatedUser.avatar });

    } catch (error) {
        console.error("❌ ERREUR UPDATE AVATAR :", error.message);
        res.status(500).json({ error: "Impossible de mettre à jour votre avatar." });
    }
});

// --- ROUTE DE TEST ---
app.get('/', (req, res) => {
    res.send("🚀 Serveur CyberLobby opérationnel (API + Socket.IO) !");
});

// --- LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 8080;
// IMPORTANT : On utilise 'server.listen' (HTTP + Socket) et non 'app.listen' (Express seul)
server.listen(PORT, () => {
    console.log(`✅ Serveur lancé sur le port ${PORT}`);
});
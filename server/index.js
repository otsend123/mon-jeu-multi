const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const app = express();
const prisma = new PrismaClient();

// --- CONFIGURATION ---
app.use(cors());
app.use(express.json());

// --- 1. ROUTE D'INSCRIPTION (REGISTER) ---
app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password, avatar } = req.body;

        // Vérification des champs obligatoires
        if (!email || !pseudo || !password) {
            return res.status(400).json({ error: "Email, pseudo et mot de passe requis" });
        }

        // On vérifie si l'email ou le pseudo existe déjà
        const userExists = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email.toLowerCase() },
                    { pseudo: pseudo }
                ]
            }
        });

        if (userExists) {
            return res.status(400).json({ error: "Email ou Pseudo déjà pris" });
        }

        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // Création de l'utilisateur (birthDate est optionnelle dans le schéma Prisma)
        const newUser = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                pseudo: pseudo,
                password: hashedPassword,
                avatar: avatar || '👤'
            }
        });

        console.log(`✅ Inscription réussie : ${newUser.pseudo}`);
        res.status(201).json({ message: "Compte créé !", user: { pseudo: newUser.pseudo } });

    } catch (error) {
        console.error("❌ ERREUR REGISTER :", error.message);
        res.status(500).json({ error: "Erreur lors de l'inscription", details: error.message });
    }
});

// --- 2. ROUTE DE CONNEXION (LOGIN) ---
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Vérification des champs
        if (!email || !password) {
            return res.status(400).json({ error: "Email et mot de passe requis" });
        }

        // On cherche l'utilisateur par son email
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        // Si l'utilisateur n'existe pas
        if (!user) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect" });
        }

        // Comparaison du mot de passe avec Bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect" });
        }

        // Succès : On renvoie les infos (sans le mot de passe)
        console.log(`🔑 Connexion réussie : ${user.pseudo}`);
        res.status(200).json({
            message: "Connexion réussie",
            user: {
                id: user.id,
                pseudo: user.pseudo,
                avatar: user.avatar
            }
        });

    } catch (error) {
        console.error("❌ ERREUR LOGIN :", error.message);
        res.status(500).json({ error: "Erreur lors de la connexion" });
    }
});

// --- ROUTE DE TEST & PORT ---
app.get('/', (req, res) => {
    res.send("🚀 Serveur CyberLobby en ligne et prêt !");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`✅ Serveur lancé sur le port ${PORT}`);
});
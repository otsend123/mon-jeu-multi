const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Route d'inscription
app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password, birthDate, avatar } = req.body;

        // 1. Sécurité : Vérifier que les champs obligatoires sont là
        if (!email || !pseudo || !password) {
            return res.status(400).json({ error: "Email, pseudo et mot de passe requis" });
        }

        // 2. Vérification des doublons (CORRIGÉ : on utilise 'pseudo' ici)
        const userExists = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { pseudo: pseudo }
                ]
            }
        });

        if (userExists) {
            return res.status(400).json({ error: "Email ou Pseudo déjà pris" });
        }

        // 3. Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Création de l'utilisateur
        const newUser = await prisma.user.create({
            data: {
                email: email,
                pseudo: pseudo,
                password: hashedPassword,
                birthDate: birthDate ? new Date(birthDate) : null,
                avatar: avatar || '👤'
            }
        });

        console.log("✅ Utilisateur créé :", newUser.pseudo);
        res.status(201).json({ message: "Inscription réussie", user: { pseudo: newUser.pseudo } });

    } catch (error) {
        console.error("🔥 Erreur Prisma/Serveur :", error);
        res.status(500).json({ error: "Erreur lors de l'inscription" });
    }
});

// Route de test pour voir si le serveur répond
app.get('/', (req, res) => {
    res.send("Serveur CyberLobby en marche !");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
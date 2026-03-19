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

        // 1. VERIFICATION : Champs vides
        if (!email || !pseudo || !password) {
            console.log("⚠️ Tentative d'inscription avec des champs manquants");
            return res.status(400).json({ error: "Tous les champs sont obligatoires" });
        }

        console.log(`🔎 Vérification en base pour : ${email} et ${pseudo}`);

        // 2. VERIFICATION : Doublons
        const userExists = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email.toLowerCase() },
                    { pseudo: pseudo }
                ]
            }
        });

        if (userExists) {
            console.log("❌ Email ou Pseudo déjà utilisé");
            return res.status(400).json({ error: "Email ou Pseudo déjà pris" });
        }

        // 3. CREATION : Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. INSERTION : Nouvel utilisateur
        const newUser = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                pseudo: pseudo,
                password: hashedPassword,
                birthDate: birthDate ? new Date(birthDate) : null,
                avatar: avatar || '👤'
            }
        });

        console.log("✅ Utilisateur créé avec succès :", newUser.pseudo);
        res.status(201).json({ message: "Inscription réussie", user: { pseudo: newUser.pseudo } });

    } catch (error) {
        console.error("🔥 Erreur Serveur détaillée :", error);
        res.status(500).json({ error: "Erreur interne du serveur" });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Serveur CyberLobby en ligne sur le port ${PORT}`);
});
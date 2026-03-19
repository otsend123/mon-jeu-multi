const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const app = express();
const prisma = new PrismaClient();

// Configuration des Middlewares
app.use(cors());
app.use(express.json());

// --- ROUTE D'INSCRIPTION ---
app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password, avatar } = req.body;

        // 1. Sécurité : Vérifier que les champs indispensables sont présents
        if (!email || !pseudo || !password) {
            return res.status(400).json({ error: "Email, pseudo et mot de passe requis" });
        }

        // 2. Vérification des doublons (Utilisation correcte de 'pseudo')
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

        // 3. Hachage du mot de passe pour la sécurité
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Création de l'utilisateur dans la base de données
        // Note : On ne mentionne pas birthDate car elle n'est pas demandée
        const newUser = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                pseudo: pseudo,
                password: hashedPassword,
                avatar: avatar || '👤'
            }
        });

        console.log(`✅ Nouvel utilisateur créé : ${newUser.pseudo}`);

        // Réponse de succès
        res.status(201).json({
            message: "Inscription réussie !",
            user: { pseudo: newUser.pseudo }
        });

    } catch (error) {
        // Log détaillé dans le terminal Railway pour le débogage
        console.error("❌ ERREUR LORS DE L'INSCRIPTION :", error.message);

        res.status(500).json({
            error: "Erreur lors de l'inscription",
            details: error.message
        });
    }
});

// --- ROUTE PAR DÉFAUT ---
app.get('/', (req, res) => {
    res.send("🚀 Serveur CyberLobby opérationnel !");
});

// Lancement du serveur
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`✅ Serveur en ligne sur le port ${PORT}`);
});
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.post('/register', async (req, res) => {
    try {
        const { email, pseudo, password, birthDate, avatar } = req.body;

        // 1. Vérification des champs obligatoires
        if (!email || !pseudo || !password) {
            return res.status(400).json({ error: "Champs manquants" });
        }

        // 2. Vérification si l'utilisateur existe déjà
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

        // 4. Création de l'utilisateur (on sécurise birthDate)
        const newUser = await prisma.user.create({
            data: {
                email: email,
                pseudo: pseudo,
                password: hashedPassword,
                // On met une date par défaut si birthDate est invalide ou absent
                birthDate: birthDate ? new Date(birthDate) : new Date(),
                avatar: avatar || '👤'
            }
        });

        res.status(201).json({ message: "Inscription réussie", user: { pseudo: newUser.pseudo } });

    } catch (error) {
        console.error("ERREUR CRÉATION :", error);
        // On renvoie l'erreur précise pour comprendre ce qui bloque
        res.status(500).json({ error: "Erreur lors de l'inscription", details: error.message });
    }
});

app.get('/', (req, res) => res.send("Serveur Actif"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Port ${PORT}`));
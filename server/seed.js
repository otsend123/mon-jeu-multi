// server/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const questionsData = require('./questions.json');

async function main() {
    console.log("⏳ Début de l'importation des questions...");

    // On vide la table au cas où pour éviter les doublons
    await prisma.question.deleteMany({});
    console.log("🧹 Anciennes questions effacées.");

    // On insère toutes les questions du fichier JSON
    let count = 0;
    for (const q of questionsData) {
        await prisma.question.create({
            data: {
                images: q.images,
                options: q.options,
                correct: q.correct
            }
        });
        count++;
    }

    console.log(`✅ Succès ! ${count} questions ont été ajoutées à la base de données.`);
}

main()
    .catch((e) => {
        console.error("❌ Erreur :", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
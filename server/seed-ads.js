// server/seed-ads.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("⏳ Début de l'importation de la pub de test...");

    // On vide la table au cas où
    await prisma.adQuestion.deleteMany({});

    // On ajoute une question de test
    await prisma.adQuestion.create({
        data: {
            videoUrl: "vid/pub_test.mp4", // ⚠️ Il faudra mettre une vraie vidéo nommée "pub_test.mp4" dans client/public/vid/
            options: ["Apple", "Nike", "Coca-Cola", "IKEA", "Peugeot"],
            correct: "Apple"
        }
    });

    console.log("✅ Succès ! La pub a été ajoutée à la base de données.");
}

main()
    .catch((e) => {
        console.error("❌ Erreur :", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
// server/games/quiz.js

// Lancement du jeu ASYNCHRONE pour interroger la BDD
async function startQuizGame(io, lobbies, lobby, prisma) {

    try {
        // 1. Récupérer toutes les questions depuis la base de données
        const allQuestions = await prisma.question.findMany();

        if (allQuestions.length === 0) {
            io.to(lobby.id).emit('roomError', "Aucune question trouvée dans la base de données !");
            return;
        }

        // 2. Mélanger et en garder 5 (ou plus)
        const selectedQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 5);

        lobby.status = 'playing';
        lobby.gameState = {
            questions: selectedQuestions,
            currentQuestionIndex: 0,
            scores: {},
            answersThisRound: {},
            roundStatus: 'question' // 'question' ou 'result'
        };

        // Initialiser les scores à 0
        lobby.players.forEach(p => lobby.gameState.scores[p.socketId] = 0);

        io.to(lobby.id).emit('gameStarted', lobby);
        io.emit('updateLobbies', lobbies);

    } catch (error) {
        console.error("Erreur lors de la récupération des questions :", error);
        io.to(lobby.id).emit('roomError', "Erreur interne du serveur lors du chargement du quiz.");
    }
}

// Gestion des réponses
function handleAnswer(io, lobbies, lobby, socketId, answer) {
    if (lobby.status === 'playing' && lobby.gameState.roundStatus === 'question') {
        if (!lobby.gameState.answersThisRound[socketId]) {
            lobby.gameState.answersThisRound[socketId] = answer;
            io.to(lobby.id).emit('playerAnswered', socketId);
            checkRoundEnd(io, lobbies, lobby);
        }
    }
}

// Vérification de la fin du tour
function checkRoundEnd(io, lobbies, lobby) {
    if (lobby.status !== 'playing' || lobby.gameState.roundStatus !== 'question') return;

    const answeredCount = Object.keys(lobby.gameState.answersThisRound).length;

    if (answeredCount >= lobby.players.length && lobby.players.length > 0) {
        lobby.gameState.roundStatus = 'result';
        const currentQ = lobby.gameState.questions[lobby.gameState.currentQuestionIndex];

        for (const [sId, ans] of Object.entries(lobby.gameState.answersThisRound)) {
            if (ans === currentQ.correct) {
                lobby.gameState.scores[sId] += 10;
            }
        }

        io.to(lobby.id).emit('roundResult', lobby);

        setTimeout(() => {
            if (lobby.gameState.currentQuestionIndex < lobby.gameState.questions.length - 1) {
                lobby.gameState.currentQuestionIndex++;
                lobby.gameState.answersThisRound = {};
                lobby.gameState.roundStatus = 'question';
                io.to(lobby.id).emit('nextQuestion', lobby);
            } else {
                lobby.status = 'waiting';
                io.to(lobby.id).emit('gameOver', lobby);
                io.emit('updateLobbies', lobbies);
            }
        }, 5000);
    }
}

function handleDisconnection(io, lobbies, lobby) {
    checkRoundEnd(io, lobbies, lobby);
}

module.exports = { startQuizGame, handleAnswer, handleDisconnection };
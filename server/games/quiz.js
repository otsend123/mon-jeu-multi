// server/games/quiz.js

async function startQuizGame(io, lobbies, lobby, prisma) {
    try {
        // Récupération de toutes les questions en BDD
        const allQuestions = await prisma.question.findMany();

        if (allQuestions.length === 0) {
            io.to(lobby.id).emit('roomError', "Aucune question disponible en base de données !");
            return;
        }

        // Sélection aléatoire de 5 questions
        const selectedQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 5);

        lobby.status = 'playing';
        lobby.gameState = {
            questions: selectedQuestions,
            currentQuestionIndex: 0,
            scores: {},
            answersThisRound: {},
            roundStatus: 'question' // 'question' ou 'result'
        };

        // Initialisation des scores à 0
        lobby.players.forEach(p => lobby.gameState.scores[p.socketId] = 0);

        io.to(lobby.id).emit('gameStarted', lobby);
        io.emit('updateLobbies', lobbies);
    } catch (error) {
        console.error("Erreur lors du lancement du Quiz :", error);
    }
}

function handleAnswer(io, lobbies, lobby, socketId, answer) {
    if (lobby.status === 'playing' && lobby.gameState.roundStatus === 'question') {
        if (!lobby.gameState.answersThisRound[socketId]) {
            lobby.gameState.answersThisRound[socketId] = answer;
            io.to(lobby.id).emit('playerAnswered', socketId);
            checkRoundEnd(io, lobbies, lobby);
        }
    }
}

function checkRoundEnd(io, lobbies, lobby) {
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

module.exports = { startQuizGame, handleAnswer };
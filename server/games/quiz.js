async function startQuizGame(io, lobbies, lobby, prisma) {
    try {
        const allQuestions = await prisma.question.findMany();
        if (allQuestions.length === 0) return io.to(lobby.id).emit('roomError', "Aucune question en base !");

        const selectedQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 5);

        // 🔥 NOUVEAU : On garde le score global du salon (Persistance)
        if (!lobby.scores) lobby.scores = {};
        lobby.players.forEach(p => {
            // On initialise à 0 seulement si le joueur n'a jamais joué dans ce salon
            if (lobby.scores[p.pseudo] === undefined) {
                lobby.scores[p.pseudo] = 0;
            }
        });

        lobby.status = 'playing';
        lobby.gameState = {
            questions: selectedQuestions, currentQuestionIndex: 0,
            answersThisRound: {}, roundStatus: 'question'
        };

        io.to(lobby.id).emit('gameStarted', lobby);
        io.emit('updateLobbies', lobbies);
    } catch (error) { console.error("Erreur Quiz:", error); }
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

function checkRoundEnd(io, lobbies, lobby, force = false) {
    if (lobby.status !== 'playing' || lobby.gameState.roundStatus !== 'question') return;

    const answeredCount = Object.keys(lobby.gameState.answersThisRound).length;
    const activePlayersCount = lobby.players.filter(p => io.sockets.sockets.has(p.socketId)).length;
    const targetCount = activePlayersCount > 0 ? activePlayersCount : 1;

    if (force || answeredCount >= targetCount) {
        lobby.gameState.roundStatus = 'result';
        const currentQ = lobby.gameState.questions[lobby.gameState.currentQuestionIndex];

        // 🔥 NOUVEAU : Attribution des points dans le score global (lobby.scores)
        for (const [sId, ans] of Object.entries(lobby.gameState.answersThisRound)) {
            if (ans === currentQ.correct) {
                const player = lobby.players.find(p => p.socketId === sId);
                if (player) lobby.scores[player.pseudo] += 10;
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

function forceNext(io, lobbies, lobby) {
    checkRoundEnd(io, lobbies, lobby, true);
}

module.exports = { startQuizGame, handleAnswer, handleDisconnection, forceNext };
// On stocke les chronomètres ici, en sécurité, loin des joueurs !
const timers = new Map();

async function startAdQuizGame(io, lobbies, lobby, prisma) {
    try {
        if (!prisma.adQuestion) return io.to(lobby.id).emit('roomError', "Table AdQuestion introuvable.");

        const allQuestions = await prisma.adQuestion.findMany();
        if (allQuestions.length === 0) return io.to(lobby.id).emit('roomError', "Aucune vidéo en base. Lancez 'node seed-ads.js'.");

        const selectedQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 10);

        if (!lobby.scores) lobby.scores = {};
        lobby.players.forEach(p => { if (lobby.scores[p.pseudo] === undefined) lobby.scores[p.pseudo] = 0; });

        lobby.status = 'playing';
        lobby.gameState = {
            questions: selectedQuestions,
            currentQuestionIndex: 0,
            answersThisRound: {},
            roundStatus: 'question',
            roundEndTime: Date.now() + 60000
            // 🔥 On ne met PLUS le timeoutId ici !
        };

        // Nettoyage de sécurité
        if (timers.has(lobby.id)) clearTimeout(timers.get(lobby.id));

        // On stocke le chrono dans notre dictionnaire privé
        timers.set(lobby.id, setTimeout(() => { forceNext(io, lobbies, lobby); }, 60000));

        io.to(lobby.id).emit('gameStarted', lobby);
        io.emit('updateLobbies', lobbies);
    } catch (error) { io.to(lobby.id).emit('roomError', "Erreur technique : " + error.message); }
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
    if (!lobby || !lobby.gameState || lobby.gameState.roundStatus !== 'question') return;

    const answeredCount = Object.keys(lobby.gameState.answersThisRound).length;
    const activePlayersCount = lobby.players.filter(p => io.sockets.sockets.has(p.socketId)).length;
    const targetCount = activePlayersCount > 0 ? activePlayersCount : 1;

    if (force || answeredCount >= targetCount) {
        // 🔥 On arrête le chrono proprement
        if (timers.has(lobby.id)) {
            clearTimeout(timers.get(lobby.id));
            timers.delete(lobby.id);
        }

        lobby.gameState.roundStatus = 'result';
        const currentQ = lobby.gameState.questions[lobby.gameState.currentQuestionIndex];

        for (const [sId, ans] of Object.entries(lobby.gameState.answersThisRound)) {
            if (ans === currentQ.correct) {
                const player = lobby.players.find(p => p.socketId === sId);
                if (player) lobby.scores[player.pseudo] += 20;
            }
        }

        io.to(lobby.id).emit('roundResult', lobby);

        setTimeout(() => {
            if (!lobby || lobby.status !== 'playing') return;

            if (lobby.gameState.currentQuestionIndex < lobby.gameState.questions.length - 1) {
                lobby.gameState.currentQuestionIndex++;
                lobby.gameState.answersThisRound = {};
                lobby.gameState.roundStatus = 'question';
                lobby.gameState.roundEndTime = Date.now() + 60000;

                // Relance le chrono pour la question suivante
                timers.set(lobby.id, setTimeout(() => { forceNext(io, lobbies, lobby); }, 60000));

                io.to(lobby.id).emit('nextQuestion', lobby);
            } else {
                lobby.status = 'waiting';
                io.to(lobby.id).emit('gameOver', lobby);
                io.emit('updateLobbies', lobbies);
            }
        }, 5000);
    }
}

function forceNext(io, lobbies, lobby) { checkRoundEnd(io, lobbies, lobby, true); }
function handleDisconnection(io, lobbies, lobby) { checkRoundEnd(io, lobbies, lobby); }

// Nouvelle fonction pour nettoyer le chrono si le chef arrête la partie brutalement
function stopAdQuizTimer(lobbyId) {
    if (timers.has(lobbyId)) {
        clearTimeout(timers.get(lobbyId));
        timers.delete(lobbyId);
    }
}

module.exports = { startAdQuizGame, handleAnswer, handleDisconnection, forceNext, stopAdQuizTimer };
const fs = require('fs');
const path = require('path');

// Les chronomètres sont stockés en sécurité
const timers = new Map();

// Fonction pour lire le JSON en direct
function getAdQuestions() {
    try {
        const filePath = path.join(__dirname, '../data/ads.json');
        const rawData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error("Erreur de lecture du fichier ads.json :", error);
        return [];
    }
}

async function startAdQuizGame(io, lobbies, lobby, prisma) {
    try {
        // On récupère les questions directement depuis le JSON
        const allQuestions = getAdQuestions();

        if (allQuestions.length === 0) {
            return io.to(lobby.id).emit('roomError', "Aucune vidéo trouvée dans le fichier ads.json !");
        }

        // On mélange et on en garde 10 au maximum (ou moins si ton JSON est plus petit)
        const selectedQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 10);

        if (!lobby.scores) lobby.scores = {};
        lobby.players.forEach(p => {
            if (lobby.scores[p.pseudo] === undefined) lobby.scores[p.pseudo] = 0;
        });

        lobby.status = 'playing';
        lobby.gameState = {
            questions: selectedQuestions,
            currentQuestionIndex: 0,
            answersThisRound: {},
            roundStatus: 'question',
            // 🔥 TEMPS MODIFIÉ : 300 000 ms = 5 minutes
            roundEndTime: Date.now() + 300000
        };

        // Nettoyage de sécurité avant de commencer
        if (timers.has(lobby.id)) clearTimeout(timers.get(lobby.id));

        // 🔥 On lance le chrono du premier tour sur 5 minutes
        timers.set(lobby.id, setTimeout(() => { forceNext(io, lobbies, lobby); }, 300000));

        io.to(lobby.id).emit('gameStarted', lobby);
        io.emit('updateLobbies', lobbies);
    } catch (error) {
        io.to(lobby.id).emit('roomError', "Erreur : " + error.message);
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

function checkRoundEnd(io, lobbies, lobby, force = false) {
    if (!lobby || !lobby.gameState || lobby.gameState.roundStatus !== 'question') return;

    const answeredCount = Object.keys(lobby.gameState.answersThisRound).length;
    const activePlayersCount = lobby.players.filter(p => io.sockets.sockets.has(p.socketId)).length;
    const targetCount = activePlayersCount > 0 ? activePlayersCount : 1;

    if (force || answeredCount >= targetCount) {

        // On arrête le chrono proprement
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
                // 🔥 TEMPS MODIFIÉ : 5 minutes
                lobby.gameState.roundEndTime = Date.now() + 300000;

                // Relance le chrono de 5 minutes pour la question suivante
                timers.set(lobby.id, setTimeout(() => { forceNext(io, lobbies, lobby); }, 300000));

                io.to(lobby.id).emit('nextQuestion', lobby);
            } else {
                lobby.status = 'waiting';
                io.to(lobby.id).emit('gameOver', lobby);
                io.emit('updateLobbies', lobbies);
            }
        }, 5000);
    }
}

function forceNext(io, lobbies, lobby) {
    checkRoundEnd(io, lobbies, lobby, true);
}

function handleDisconnection(io, lobbies, lobby) {
    checkRoundEnd(io, lobbies, lobby);
}

function stopAdQuizTimer(lobbyId) {
    if (timers.has(lobbyId)) {
        clearTimeout(timers.get(lobbyId));
        timers.delete(lobbyId);
    }
}

module.exports = { startAdQuizGame, handleAnswer, handleDisconnection, forceNext, stopAdQuizTimer };
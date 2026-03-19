import React, { useState, useEffect } from 'react';

function QuizGame({ currentLobby, socket, user }) {
    const [hasAnswered, setHasAnswered] = useState(false);
    const [enlargedImage, setEnlargedImage] = useState(null);

    // On prépare la variable gs (qui peut être undefined au tout début)
    const gs = currentLobby?.gameState;

    // 🔥 RÈGLE REACT : Les Hooks (useEffect) doivent TOUJOURS être appelés avant les "return" !
    useEffect(() => {
        setHasAnswered(false);
        setEnlargedImage(null);
    }, [gs?.currentQuestionIndex]); // Le "?" évite de crasher si gs n'est pas encore chargé

    // 🔥 SÉCURITÉ : Maintenant qu'on a passé les Hooks, on peut afficher le Chargement si besoin
    if (!gs || !gs.questions || !user) {
        return <div style={{textAlign: 'center', marginTop: '50px', color: '#00d4ff', fontSize: '1.5rem'}}>Chargement du Quiz en cours...</div>;
    }

    const currentQ = gs.questions[gs.currentQuestionIndex];
    const sortedPlayers = [...currentLobby.players].sort((a, b) => (gs.scores[b.socketId] || 0) - (gs.scores[a.socketId] || 0));

    const answeredCount = Object.keys(gs.answersThisRound || {}).length;
    const isHost = currentLobby.creator === user.pseudo;

    const submitAnswer = (answer) => {
        if (!hasAnswered) {
            socket.emit('submitAnswer', { lobbyId: currentLobby.id, answer });
            setHasAnswered(true);
        }
    };

    return (
        <main className="game-dashboard">
            <div className="game-play-area">
                {gs.roundStatus === 'question' ? (
                    <>
                        <h2>À quelle catégorie appartient cette personne ?</h2>
                        <div className="quiz-images-container">
                            {currentQ.images.map((imgSrc, i) => (
                                <img
                                    key={i}
                                    src={`/${imgSrc}`}
                                    alt={`Indice ${i+1}`}
                                    className="quiz-img clickable-img"
                                    onClick={() => setEnlargedImage(imgSrc)}
                                />
                            ))}
                        </div>
                        <div className="quiz-options">
                            {currentQ.options.map((opt, i) => (
                                <button
                                    key={i}
                                    className={`btn-cyber quiz-btn ${hasAnswered ? 'btn-disabled' : ''}`}
                                    onClick={() => submitAnswer(opt)}
                                    disabled={hasAnswered}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>

                        {hasAnswered && (
                            <div style={{marginTop: '20px'}}>
                                <p className="waiting-text">En attente des autres joueurs ({answeredCount}/{currentLobby.players.length})...</p>

                                {isHost && (
                                    <button
                                        className="btn-cyber btn-small"
                                        style={{backgroundColor: '#ff2e63', border: 'none', marginTop: '10px'}}
                                        onClick={() => socket.emit('forceNextRound', currentLobby.id)}
                                    >
                                        Forcer le résultat ⚡
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="result-area">
                        <h2>Résultat</h2>
                        <p className="correct-answer-text">
                            La bonne réponse était : <br/><strong>{currentQ.correct}</strong>
                        </p>
                        <p className="waiting-text">Préparation de la question suivante...</p>
                    </div>
                )}
            </div>

            <div className="game-scoreboard">
                <h2>Classement</h2>
                {sortedPlayers.map((p, idx) => (
                    <div key={p.socketId} className="score-card">
                        <span className="score-rank">#{idx + 1}</span>
                        <span className="score-avatar">{p.avatar}</span>
                        <span className="score-pseudo">{p.pseudo}</span>
                        <span className="score-points">{gs.scores[p.socketId] || 0} pts</span>
                    </div>
                ))}
            </div>

            {enlargedImage && (
                <div className="image-zoom-overlay" onClick={() => setEnlargedImage(null)}>
                    <img src={`/${enlargedImage}`} alt="Zoom" className="enlarged-img" />
                </div>
            )}
        </main>
    );
}

export default QuizGame;
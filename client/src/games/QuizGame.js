import React, { useState, useEffect } from 'react';

function QuizGame({ currentLobby, socket, user }) {
    const [hasAnswered, setHasAnswered] = useState(false);
    const [enlargedImage, setEnlargedImage] = useState(null);

    const gs = currentLobby?.gameState;

    // 🔥 CORRECT : useEffect est appelé avant le return conditionnel
    useEffect(() => {
        setHasAnswered(false);
        setEnlargedImage(null);
    }, [gs?.currentQuestionIndex]);

    // 🔥 SÉCURITÉ : Après les hooks
    if (!gs || !gs.questions || !user) {
        return <div style={{textAlign: 'center', marginTop: '50px', color: '#00d4ff'}}>Chargement...</div>;
    }

    const currentQ = gs.questions[gs.currentQuestionIndex];
    const sortedPlayers = [...currentLobby.players].sort((a, b) => (currentLobby.scores?.[b.pseudo] || 0) - (currentLobby.scores?.[a.pseudo] || 0));

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
                                <img key={i} src={`/${imgSrc}`} alt="Quiz" className="quiz-img clickable-img" onClick={() => setEnlargedImage(imgSrc)} />
                            ))}
                        </div>
                        <div className="quiz-options">
                            {currentQ.options.map((opt, i) => (
                                <button key={i} className={`btn-cyber quiz-btn ${hasAnswered ? 'btn-disabled' : ''}`} onClick={() => submitAnswer(opt)} disabled={hasAnswered}>{opt}</button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="result-area">
                        <p className="correct-answer-text">Réponse : <strong>{currentQ.correct}</strong></p>
                    </div>
                )}
            </div>
            <div className="game-scoreboard">
                <h2>Classement</h2>
                {sortedPlayers.map((p) => (
                    <div key={p.socketId} className="score-card">
                        <span>{p.pseudo}</span>
                        <span className="score-points">{currentLobby.scores?.[p.pseudo] || 0} pts</span>
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
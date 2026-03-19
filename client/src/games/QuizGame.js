import React, { useState, useEffect } from 'react';

function QuizGame({ currentLobby, socket }) {
    const [hasAnswered, setHasAnswered] = useState(false);
    const [enlargedImage, setEnlargedImage] = useState(null); // NOUVEAU : Gère l'image agrandie

    // Récupération de l'état du jeu depuis le serveur
    const gs = currentLobby.gameState;
    const currentQ = gs.questions[gs.currentQuestionIndex];

    // Tri des joueurs par score
    const sortedPlayers = [...currentLobby.players].sort((a, b) => (gs.scores[b.socketId] || 0) - (gs.scores[a.socketId] || 0));

    // Réinitialise le bouton "Répondre" et ferme l'image au changement de question
    useEffect(() => {
        setHasAnswered(false);
        setEnlargedImage(null);
    }, [gs.currentQuestionIndex]);

    const submitAnswer = (answer) => {
        if (!hasAnswered) {
            socket.emit('submitAnswer', { lobbyId: currentLobby.id, answer });
            setHasAnswered(true);
        }
    };

    return (
        <main className="game-dashboard">
            {/* ZONE GAUCHE : LE JEU */}
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
                                    onClick={() => setEnlargedImage(imgSrc)} // NOUVEAU : Clic pour agrandir
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
                        {hasAnswered && <p className="waiting-text">En attente des autres joueurs...</p>}
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

            {/* ZONE DROITE : CLASSEMENT */}
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

            {/* NOUVEAU : OVERLAY POUR L'IMAGE AGRANDIE */}
            {enlargedImage && (
                <div className="image-zoom-overlay" onClick={() => setEnlargedImage(null)}>
                    <img src={`/${enlargedImage}`} alt="Zoom" className="enlarged-img" />
                </div>
            )}
        </main>
    );
}

export default QuizGame;
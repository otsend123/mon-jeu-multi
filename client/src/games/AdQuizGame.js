import React, { useState, useEffect, useRef } from 'react';

function AdQuizGame({ currentLobby, socket, user }) {
    const [hasAnswered, setHasAnswered] = useState(false);
    const [replaysLeft, setReplaysLeft] = useState(3);
    const [isVideoFinished, setIsVideoFinished] = useState(false);
    const [timeLeft, setTimeLeft] = useState(60);

    const videoRef = useRef(null);
    const gs = currentLobby?.gameState;

    useEffect(() => {
        setHasAnswered(false);
        setReplaysLeft(3);
        setIsVideoFinished(false);
        if (videoRef.current) {
            videoRef.current.load();
            // Si le navigateur bloque, le joueur utilisera les contrôles pour lancer
            videoRef.current.play().catch(e => console.log("Autoplay bloqué par le navigateur :", e));
        }
    }, [gs?.currentQuestionIndex]);

    useEffect(() => {
        if (!gs?.roundEndTime || gs.roundStatus !== 'question') return;
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.floor((gs.roundEndTime - Date.now()) / 1000));
            setTimeLeft(remaining);
        }, 1000);
        return () => clearInterval(interval);
    }, [gs?.roundEndTime, gs?.roundStatus]);

    if (!gs || !gs.questions || !user) {
        return <div style={{textAlign: 'center', marginTop: '50px', color: '#00d4ff'}}>Chargement...</div>;
    }

    const currentQ = gs.questions[gs.currentQuestionIndex];
    const sortedPlayers = [...currentLobby.players].sort((a, b) => (currentLobby.scores?.[b.pseudo] || 0) - (currentLobby.scores?.[a.pseudo] || 0));
    const isHost = currentLobby.creator === user.pseudo;

    const submitAnswer = (answer) => {
        if (!hasAnswered) {
            socket.emit('submitAnswer', { lobbyId: currentLobby.id, answer });
            setHasAnswered(true);
        }
    };

    const handleReplay = () => {
        if (replaysLeft > 0 && videoRef.current) {
            setReplaysLeft(prev => prev - 1);
            videoRef.current.currentTime = 0;
            videoRef.current.play();
            setIsVideoFinished(false);
        }
    };

    return (
        <main className="game-dashboard">
            <div className="game-play-area">
                {gs.roundStatus === 'question' ? (
                    <>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                            <h2>Quelle est cette pub ?</h2>
                            <div style={{fontSize: '1.5rem', fontWeight: 'bold', color: timeLeft <= 10 ? '#ff2e63' : '#00d4ff'}}>
                                ⏱️ {timeLeft}s
                            </div>
                        </div>

                        {/* 🔥 L'attribut 'controls' est la clé ici ! */}
                        <video
                            ref={videoRef}
                            src={`/${currentQ.videoUrl}`}
                            controls
                            playsInline
                            onEnded={() => setIsVideoFinished(true)}
                            style={{width: '100%', maxHeight: '350px', borderRadius: '10px', border: '2px solid #0f3460', backgroundColor: '#000'}}
                        />

                        {isVideoFinished && (
                            <div className="quiz-options" style={{marginTop: '20px'}}>
                                {currentQ.options.map((opt, i) => (
                                    <button key={i} className={`btn-cyber quiz-btn ${hasAnswered ? 'btn-disabled' : ''}`} onClick={() => submitAnswer(opt)} disabled={hasAnswered}>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div style={{marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <button className="btn-cyber btn-small" onClick={handleReplay} disabled={replaysLeft === 0 || hasAnswered}>
                                🔄 Revoir ({replaysLeft}/3)
                            </button>
                            {isHost && hasAnswered && (
                                <button className="btn-cyber btn-small" style={{background: '#ff2e63', border: 'none'}} onClick={() => socket.emit('forceNextRound', currentLobby.id)}>Forcer ⚡</button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="result-area">
                        <h2>Fin du temps !</h2>
                        <p className="correct-answer-text">Réponse : <br/><strong>{currentQ.correct}</strong></p>
                    </div>
                )}
            </div>
            <div className="game-scoreboard">
                <h2>Classement</h2>
                {sortedPlayers.map((p, idx) => (
                    <div key={p.socketId} className="score-card">
                        <span className="score-rank">#{idx + 1}</span>
                        <span className="score-pseudo">{p.pseudo}</span>
                        <span className="score-points">{currentLobby.scores?.[p.pseudo] || 0} pts</span>
                    </div>
                ))}
            </div>
        </main>
    );
}

export default AdQuizGame;
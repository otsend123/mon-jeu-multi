// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import QuizGame from './games/QuizGame'; // <-- IMPORTATION DU JEU
import './App.css';

const API_URL = "https://mon-jeu-multi-production-ed0c.up.railway.app";
const socket = io(API_URL, { transports: ['websocket', 'polling'] });

const AVATARS = ['🕹️', '👽', '🤖', '👻', '👾', '👨‍🚀', '🐱', '🐲', '🐼', '🦊'];

const AVAILABLE_GAMES = [
    { id: 'quiz', name: 'Quiz Image', icon: '📸' },
    { id: 'tictactoe', name: 'Morpion Cyber', icon: '❌' }
];

function App() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
    const [players, setPlayers] = useState([]);
    const [showModal, setShowModal] = useState(false);

    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ email: '', pseudo: '', password: '' });

    const [lobbies, setLobbies] = useState([]);
    const [newLobbyName, setNewLobbyName] = useState('');
    const [currentLobby, setCurrentLobby] = useState(null);
    const [invite, setInvite] = useState(null);

    const [messages, setMessages] = useState([]);
    const [currentMsg, setCurrentMsg] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (user) {
            socket.emit('joinGame', user);

            socket.on('updateUserList', (list) => setPlayers(list));
            socket.on('updateLobbies', (lobbyList) => setLobbies(lobbyList));

            socket.on('lobbyJoined', (lobby) => setCurrentLobby(lobby));
            socket.on('lobbyUpdated', (lobby) => setCurrentLobby(lobby));
            socket.on('lobbyLeft', () => setCurrentLobby(null));
            socket.on('roomError', (msg) => alert(msg));

            socket.on('receiveInvite', (data) => setInvite(data));
            socket.on('receiveMessage', (newMsg) => setMessages((prev) => [...prev, newMsg]));

            // Écoutes de jeu global
            socket.on('gameStarted', (lobby) => setCurrentLobby(lobby));
            socket.on('roundResult', (lobby) => setCurrentLobby(lobby));
            socket.on('nextQuestion', (lobby) => setCurrentLobby(lobby));
            socket.on('gameOver', (lobby) => {
                setCurrentLobby(lobby);
                alert("La partie est terminée ! Regardez le classement final.");
            });

            socket.on('forceDisconnect', (msg) => {
                alert(msg);
                localStorage.removeItem('user');
                window.location.reload();
            });
        }

        return () => {
            socket.off('updateUserList'); socket.off('updateLobbies'); socket.off('lobbyJoined');
            socket.off('lobbyUpdated'); socket.off('lobbyLeft'); socket.off('roomError');
            socket.off('receiveInvite'); socket.off('receiveMessage'); socket.off('forceDisconnect');
            socket.off('gameStarted'); socket.off('roundResult'); socket.off('nextQuestion'); socket.off('gameOver');
        };
    }, [user]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('Tentative...');
        try {
            const res = await fetch(`${API_URL}${isLogin ? '/login' : '/register'}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('user', JSON.stringify(data.user)); setUser(data.user); setError('');
            } else { setError(data.error); }
        } catch (err) { setError("Serveur injoignable."); }
    };

    const updateAvatar = async (emoji) => {
        try {
            const res = await fetch(`${API_URL}/api/user/update-avatar`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, avatar: emoji })
            });
            if (res.ok) {
                const updated = { ...user, avatar: emoji }; setUser(updated);
                localStorage.setItem('user', JSON.stringify(updated)); socket.emit('changeAvatar', emoji); setShowModal(false);
            }
        } catch (e) { console.error(e); }
    };

    if (!user) {
        return (
            <div className="auth-container">
                <h1 className="title-cyber">{isLogin ? 'CONNEXION' : 'INSCRIPTION'}</h1>
                <form onSubmit={handleAuth}>
                    {!isLogin && <input type="text" placeholder="Pseudo" required onChange={e => setForm({...form, pseudo: e.target.value})} />}
                    <input type="email" placeholder="Email" required onChange={e => setForm({...form, email: e.target.value})} />
                    <input type="password" placeholder="Mot de passe" required onChange={e => setForm({...form, password: e.target.value})} />
                    <button type="submit" className="btn-cyber">{isLogin ? 'Entrer' : "S'inscrire"}</button>
                </form>
                {error && <p className="error-msg">{error}</p>}
                <p className="toggle-auth" onClick={() => setIsLogin(!isLogin)} style={{cursor: 'pointer'}}>
                    {isLogin ? "Pas de compte ? S'inscrire" : "Déjà inscrit ? Connexion"}
                </p>
            </div>
        );
    }

    // --- VUE 3 : ROUTEUR DE JEUX EN COURS ---
    if (currentLobby && currentLobby.status === 'playing') {
        const currentQIndex = currentLobby.gameState?.currentQuestionIndex || 0;
        const totalQ = currentLobby.gameState?.questions?.length || 0;

        return (
            <div className="App game-mode">
                <header className="header-cyber">
                    <h1 className="title-cyber">
                        {currentLobby.selectedGame === 'quiz' ? `QUIZ - Question ${currentQIndex + 1}/${totalQ}` : currentLobby.name}
                    </h1>
                </header>

                {/* On affiche le composant du jeu sélectionné */}
                {currentLobby.selectedGame === 'quiz' && (
                    <QuizGame currentLobby={currentLobby} socket={socket} />
                )}
                {/* Futur jeu : currentLobby.selectedGame === 'tictactoe' && <TicTacToeGame ... /> */}
            </div>
        );
    }

    // --- VUE 2 : SALLE D'ATTENTE (ROOM) ---
    if (currentLobby) {
        const slots = [...Array(8)].map((_, index) => currentLobby.players[index] || null);
        const isHost = currentLobby.creator === user.pseudo;
        const selectedGameObj = AVAILABLE_GAMES.find(g => g.id === currentLobby.selectedGame);

        return (
            <div className="App">
                <header className="header-cyber">
                    <h1 className="title-cyber">{currentLobby.name}</h1>
                    <button className="btn-disconnect" onClick={() => socket.emit('leaveLobby')}>🚪 Quitter le salon</button>
                </header>
                <main className="main-dashboard dashboard-top">
                    <section className="panel-section room-section">
                        <h2 className="panel-title">Équipe ({currentLobby.players.length}/8)</h2>
                        <div className="slots-grid">
                            {slots.map((player, idx) => (
                                player ? (
                                    <div key={idx} className="slot-card filled">
                                        <div className="slot-avatar">{player.avatar}</div>
                                        <div className="slot-name">{player.pseudo}</div>
                                        {player.pseudo === currentLobby.creator && <div className="host-badge">👑 Hôte</div>}
                                    </div>
                                ) : (
                                    <div key={idx} className="slot-card empty">
                                        <div className="slot-avatar">?</div>
                                        <div className="slot-name empty-text">Vide</div>
                                    </div>
                                )
                            ))}
                        </div>
                        <div style={{marginTop: '25px', textAlign: 'center'}}>
                            {isHost ? (
                                <button
                                    className={`btn-cyber ${!currentLobby.selectedGame ? 'btn-disabled' : ''}`}
                                    style={{width: '250px'}}
                                    disabled={!currentLobby.selectedGame}
                                    onClick={() => socket.emit('startGame', currentLobby.id)}
                                >
                                    {currentLobby.selectedGame ? `Lancer ${selectedGameObj.name}` : "Choisissez un jeu"}
                                </button>
                            ) : (
                                <p style={{color: '#00d4ff'}}>En attente de l'Hôte pour lancer...</p>
                            )}
                        </div>
                    </section>
                    <section className="panel-section games-section">
                        <h2 className="panel-title">Choix du jeu</h2>
                        <div className="games-grid">
                            {AVAILABLE_GAMES.map(game => (
                                <div
                                    key={game.id}
                                    className={`game-card ${currentLobby.selectedGame === game.id ? 'selected' : ''} ${!isHost ? 'disabled' : ''}`}
                                    onClick={() => { if(isHost) socket.emit('selectGame', { lobbyId: currentLobby.id, gameId: game.id }); }}
                                >
                                    <div className="game-icon">{game.icon}</div>
                                    <div className="game-name">{game.name}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </main>
            </div>
        );
    }

    // --- VUE 1 : ACCUEIL MULTIJOUEUR ---
    return (
        <div className="App">
            <header className="header-cyber">
                <h1 className="title-cyber">CYBER LOBBY</h1>
                <div className="user-profile-btn" onClick={() => setShowModal(true)}>
                    <div className="header-avatar">{user.avatar}</div>
                    <span>{user.pseudo}</span>
                </div>
                <button className="btn-disconnect" onClick={() => {localStorage.clear(); window.location.reload();}}>Déconnexion</button>
            </header>

            {invite && (
                <div className="invite-toast">
                    <p><strong>{invite.senderName}</strong> vous invite dans : <em>{invite.lobbyName}</em></p>
                    <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                        <button className="btn-cyber btn-small" onClick={() => { socket.emit('joinLobby', invite.lobbyId); setInvite(null); }}>Rejoindre</button>
                        <button className="btn-disconnect" onClick={() => setInvite(null)}>Refuser</button>
                    </div>
                </div>
            )}

            <main className="main-dashboard">
                <div className="dashboard-top">
                    <section className="panel-section lobbies-section">
                        <h2 className="panel-title">Salons disponibles</h2>
                        <form className="create-lobby-form" onSubmit={(e) => { e.preventDefault(); if(newLobbyName) { socket.emit('createLobby', newLobbyName); setNewLobbyName(''); } }}>
                            <input type="text" placeholder="Nom du salon..." value={newLobbyName} onChange={(e) => setNewLobbyName(e.target.value)} />
                            <button type="submit" className="btn-cyber btn-small">Créer</button>
                        </form>
                        <div className="lobbies-list">
                            {lobbies.length === 0 ? <p className="empty-text">Aucun salon actif.</p> : lobbies.map(lobby => (
                                <div key={lobby.id} className="lobby-card">
                                    <div className="lobby-info">
                                        <span className="lobby-name">{lobby.name} {lobby.status === 'playing' ? ' (EN JEU)' : ''}</span>
                                        <span className="lobby-creator">Hôte: {lobby.creator}</span>
                                    </div>
                                    <div className="lobby-actions">
                                        <span className="lobby-count">{lobby.players.length}/8</span>
                                        <button className="btn-join" disabled={lobby.status === 'playing'} onClick={() => socket.emit('joinLobby', lobby.id)}>Rejoindre</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="panel-section chat-section">
                        <h2 className="panel-title">Tchat Global</h2>
                        <div className="chat-box" style={{height: '350px'}}>
                            <div className="chat-messages" style={{flex: 1, overflowY: 'auto', padding: '10px'}}>
                                {messages.map((msg) => (
                                    <div key={msg.id} style={{marginBottom: '10px'}}>
                                        <span style={{fontSize:'1.2rem'}}>{msg.avatar}</span> <strong>{msg.pseudo}</strong>: {msg.text}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            <form className="chat-input-area" onSubmit={(e) => { e.preventDefault(); if(currentMsg) { socket.emit('sendMessage', currentMsg); setCurrentMsg(''); }}}>
                                <input type="text" placeholder="Message..." value={currentMsg} onChange={(e) => setCurrentMsg(e.target.value)} style={{flex: 1}}/>
                                <button type="submit" className="btn-send">Envoyer</button>
                            </form>
                        </div>
                    </section>
                </div>
            </main>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="avatar-modal" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Choisir Avatar</h2>
                        <div className="avatar-selection-grid">
                            {AVATARS.map(emoji => <div key={emoji} className="avatar-opt" onClick={() => updateAvatar(emoji)}>{emoji}</div>)}
                        </div>
                        <button className="btn-cyber" onClick={() => setShowModal(false)}>Fermer</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// ⚠️ URL DE TON BACKEND RAILWAY
const API_URL = "https://mon-jeu-multi-production-ed0c.up.railway.app";
const socket = io(API_URL, { transports: ['websocket', 'polling'] });
const AVATARS = ['🕹️', '👽', '🤖', '👻', '👾', '👨‍🚀', '🐱', '🐲', '🐼', '🦊'];

function App() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
    const [players, setPlayers] = useState([]);
    const [showModal, setShowModal] = useState(false);

    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ email: '', pseudo: '', password: '' });

    // Lobbies & Invitations
    const [lobbies, setLobbies] = useState([]);
    const [newLobbyName, setNewLobbyName] = useState('');
    const [currentLobby, setCurrentLobby] = useState(null);
    const [invite, setInvite] = useState(null);

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

            // --- NOUVEAU : DÉCONNEXION FORCÉE SI DOUBLE ONGLET ---
            socket.on('forceDisconnect', (msg) => {
                alert(msg);
                localStorage.removeItem('user');
                window.location.reload();
            });
        }

        return () => {
            socket.off('updateUserList');
            socket.off('updateLobbies');
            socket.off('lobbyJoined');
            socket.off('lobbyUpdated');
            socket.off('lobbyLeft');
            socket.off('roomError');
            socket.off('receiveInvite');
            socket.off('forceDisconnect');
        };
    }, [user]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('Tentative de connexion...');
        try {
            const res = await fetch(`${API_URL}${isLogin ? '/login' : '/register'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
                setError('');
            } else { setError(data.error); }
        } catch (err) { setError("Serveur injoignable."); }
    };

    const updateAvatar = async (emoji) => {
        try {
            const res = await fetch(`${API_URL}/api/user/update-avatar`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id, avatar: emoji })
            });
            if (res.ok) {
                const updated = { ...user, avatar: emoji };
                setUser(updated);
                localStorage.setItem('user', JSON.stringify(updated));
                socket.emit('changeAvatar', emoji);
                setShowModal(false);
            }
        } catch (e) { console.error(e); }
    };

    const handleCreateLobby = (e) => {
        e.preventDefault();
        if (newLobbyName.trim() !== '') {
            socket.emit('createLobby', newLobbyName);
            setNewLobbyName('');
        }
    };

    const handleInvite = (targetSocketId) => {
        if (currentLobby) {
            socket.emit('invitePlayer', { targetSocketId, lobbyId: currentLobby.id });
            alert("Invitation envoyée !");
        }
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

    // --- VUE : SALLE D'ATTENTE (ROOM) ---
    if (currentLobby) {
        const slots = [...Array(8)].map((_, index) => currentLobby.players[index] || null);
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
                                    </div>
                                ) : (
                                    <div key={idx} className="slot-card empty">
                                        <div className="slot-avatar">?</div>
                                        <div className="slot-name empty-text">Vide</div>
                                    </div>
                                )
                            ))}
                        </div>
                        <div style={{marginTop: '20px', textAlign: 'center'}}>
                            <button className="btn-cyber" style={{width: '200px'}}>Lancer la partie</button>
                        </div>
                    </section>
                    <section className="panel-section players-section">
                        <h2 className="panel-title">Inviter des joueurs</h2>
                        <div className="table-container">
                            <table className="players-table">
                                <tbody>
                                {players.filter(p => p.pseudo !== user.pseudo).map(p => {
                                    const isInLobby = currentLobby.players.some(lobbyP => lobbyP.pseudo === p.pseudo);
                                    return (
                                        <tr key={p.socketId}>
                                            <td width="50" className="td-center"><span className="player-avatar">{p.avatar}</span></td>
                                            <td>{p.pseudo}</td>
                                            <td className="td-center">
                                                {isInLobby ? (
                                                    <span style={{color: '#888'}}>Dans le salon</span>
                                                ) : (
                                                    <button className="btn-join" onClick={() => handleInvite(p.socketId)}>Inviter</button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </main>
            </div>
        );
    }

    // --- VUE : ACCUEIL MULTIJOUEUR ---
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
                        <form className="create-lobby-form" onSubmit={handleCreateLobby}>
                            <input type="text" placeholder="Nom du salon..." value={newLobbyName} onChange={(e) => setNewLobbyName(e.target.value)} />
                            <button type="submit" className="btn-cyber btn-small">Créer</button>
                        </form>
                        <div className="lobbies-list">
                            {lobbies.length === 0 ? (
                                <p className="empty-text">Aucun salon actif. Créez-en un !</p>
                            ) : (
                                lobbies.map(lobby => (
                                    <div key={lobby.id} className="lobby-card">
                                        <div className="lobby-info">
                                            <span className="lobby-name">{lobby.name}</span>
                                            <span className="lobby-creator">Hôte: {lobby.creator}</span>
                                        </div>
                                        <div className="lobby-actions">
                                            <span className="lobby-count">{lobby.players.length}/8 joueur(s)</span>
                                            <button className="btn-join" onClick={() => socket.emit('joinLobby', lobby.id)}>Rejoindre</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="panel-section players-section">
                        <h2 className="panel-title">Joueurs en ligne ({players.length})</h2>
                        <div className="table-container">
                            <table className="players-table">
                                <tbody>
                                {players.map(p => (
                                    <tr key={p.id}>
                                        <td className="td-center"><span className="player-avatar">{p.avatar}</span></td>
                                        <td>{p.pseudo}</td>
                                        <td className="td-center"><span className="status-dot"></span></td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
                <div className="dashboard-bottom">
                    <section className="panel-section games-section">
                        <h2 className="panel-title">Catalogue des Jeux (À venir)</h2>
                        <div className="games-placeholder">
                            <div className="game-card-placeholder">Jeu 1</div>
                            <div className="game-card-placeholder">Jeu 2</div>
                        </div>
                    </section>
                </div>
            </main>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="avatar-modal" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Choisir Avatar</h2>
                        <div className="avatar-selection-grid">
                            {AVATARS.map(emoji => (
                                <div key={emoji} className="avatar-opt" onClick={() => updateAvatar(emoji)}>{emoji}</div>
                            ))}
                        </div>
                        <button className="btn-cyber" onClick={() => setShowModal(false)}>Fermer</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
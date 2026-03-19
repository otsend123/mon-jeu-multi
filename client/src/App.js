import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// URL DE TON BACKEND RAILWAY
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

    // --- ÉTATS DES SALONS ---
    const [lobbies, setLobbies] = useState([]);
    const [newLobbyName, setNewLobbyName] = useState('');

    useEffect(() => {
        if (user) {
            socket.emit('joinGame', user);

            socket.on('updateUserList', (list) => setPlayers(list));
            socket.on('updateLobbies', (lobbyList) => setLobbies(lobbyList));
        }

        return () => {
            socket.off('updateUserList');
            socket.off('updateLobbies');
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
                method: "POST",
                headers: { "Content-Type": "application/json" },
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

    // --- ECRAN AUTHENTIFICATION ---
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

    // --- ECRAN PRINCIPAL ---
    return (
        <div className="App">
            <header className="header-cyber">
                <h1 className="title-cyber">CYBER LOBBY</h1>
                <div className="user-profile-btn" onClick={() => setShowModal(true)}>
                    <div className="header-avatar">{user.avatar}</div>
                    <span>{user.pseudo}</span>
                </div>
                <button className="btn-disconnect" onClick={() => {localStorage.clear(); window.location.reload();}}>Quitter</button>
            </header>

            <main className="main-dashboard">

                {/* HAUT : GRILLE GAUCHE/DROITE */}
                <div className="dashboard-top">

                    {/* GAUCHE : LES SALONS */}
                    <section className="panel-section lobbies-section">
                        <h2 className="panel-title">Salons disponibles</h2>

                        <form className="create-lobby-form" onSubmit={handleCreateLobby}>
                            <input
                                type="text"
                                placeholder="Nom du salon..."
                                value={newLobbyName}
                                onChange={(e) => setNewLobbyName(e.target.value)}
                            />
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
                                            <span className="lobby-count">{lobby.players.length} joueur(s)</span>
                                            <button className="btn-join">Rejoindre</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    {/* DROITE : JOUEURS CONNECTÉS (TABLEAU) */}
                    <section className="panel-section players-section">
                        <h2 className="panel-title">Joueurs en ligne ({players.length})</h2>
                        <div className="table-container">
                            <table className="players-table">
                                <thead>
                                <tr>
                                    <th>Avatar</th>
                                    <th>Pseudo</th>
                                    <th>Statut</th>
                                </tr>
                                </thead>
                                <tbody>
                                {players.map(p => (
                                    <tr key={p.id}>
                                        <td className="td-center"><span className="player-avatar">{p.avatar}</span></td>
                                        <td>{p.pseudo}</td>
                                        <td className="td-center"><span className="status-dot"></span> En ligne</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                </div>

                {/* BAS : LA LISTE DES JEUX */}
                <div className="dashboard-bottom">
                    <section className="panel-section games-section">
                        <h2 className="panel-title">Catalogue des Jeux (À venir)</h2>
                        <div className="games-placeholder">
                            <div className="game-card-placeholder">Jeu 1</div>
                            <div className="game-card-placeholder">Jeu 2</div>
                            <div className="game-card-placeholder">Jeu 3</div>
                        </div>
                    </section>
                </div>

            </main>

            {/* MODALE AVATAR */}
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
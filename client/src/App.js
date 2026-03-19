import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// ⚠️ MODIFIE CETTE URL AVEC TON LIEN PUBLIC RAILWAY
const API_URL = "https://scintillating-inspiration-production.up.railway.app";
const socket = io(API_URL);
const AVATARS = ['🕹️', '👽', '🤖', '👻', '👾', '👨‍🚀', '🐱', '🐲', '🐼', '🦊'];

function App() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
    const [players, setPlayers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ email: '', pseudo: '', password: '' });

    useEffect(() => {
        if (user) {
            socket.emit('joinGame', user);
            socket.on('updateUserList', (list) => setPlayers(list));
        }
        return () => socket.off('updateUserList');
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
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError("Impossible de joindre le serveur. Vérifie Railway.");
        }
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
        } catch (e) {
            console.error(e);
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
                    <button type="submit" className="btn-cyber">{isLogin ? 'Entrer' : 'S\'inscrire'}</button>
                </form>
                {error && <p className="error-msg">{error}</p>}
                <p className="toggle-auth" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? "Pas de compte ? S'inscrire" : "Déjà inscrit ? Connexion"}
                </p>
            </div>
        );
    }

    // --- ECRAN LOBBY ---
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

            <main className="lobby-content">
                <h2 className="online-title">Joueurs en ligne ({players.length})</h2>
                <div className="player-grid">
                    {players.map(p => (
                        <div key={p.id} className="player-card">
                            <span className="player-avatar">{p.avatar}</span>
                            <span className="player-pseudo">{p.pseudo}</span>
                        </div>
                    ))}
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
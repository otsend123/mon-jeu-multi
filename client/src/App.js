import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

// ⚠️ REMPLACE PAR TON URL RAILWAY RÉELLE
const SERVER_URL = "https://scintillating-inspiration-production.up.railway.app";
const socket = io(SERVER_URL);
const AVATAR_LIST = ['🕹️', '👽', '🤖', '👻', '👾', '👨‍🚀', '🐱', '🐲', '🐼', '🦊'];

function App() {
    // 1. ÉTATS
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
    const [players, setPlayers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ email: '', pseudo: '', password: '' });
    const [isLogin, setIsLogin] = useState(true); // Basculer entre Connexion et Inscription
    const [error, setError] = useState('');

    // 2. SYNCHRONISATION TEMPS RÉEL
    useEffect(() => {
        if (user) {
            socket.emit('joinGame', user);
            socket.on('updateUserList', (list) => setPlayers(list));
        }
        return () => socket.off('updateUserList');
    }, [user]);

    // 3. ACTIONS (CONNEXION / INSCRIPTION)
    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        const endpoint = isLogin ? '/login' : '/register';

        try {
            const response = await fetch(`${SERVER_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
            } else {
                setError(data.error || 'Une erreur est survenue');
            }
        } catch (err) {
            setError('Impossible de contacter le serveur');
        }
    };

    const handleAvatarSelect = async (emoji) => {
        try {
            const response = await fetch(`${SERVER_URL}/api/user/update-avatar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id, avatar: emoji })
            });
            if (response.ok) {
                const newUser = { ...user, avatar: emoji };
                setUser(newUser);
                localStorage.setItem('user', JSON.stringify(newUser));
                socket.emit('changeAvatar', emoji);
                setShowModal(false);
            }
        } catch (error) { console.error(error); }
    };

    const logout = () => {
        localStorage.removeItem('user');
        setUser(null);
        window.location.reload();
    };

    // 4. RENDU : SI PAS CONNECTÉ (Affiche le Formulaire)
    if (!user) {
        return (
            <div className="auth-container">
                <h1 className="title-cyber">{isLogin ? 'CONNEXION' : 'INSCRIPTION'}</h1>
                <form onSubmit={handleAuth}>
                    {!isLogin && (
                        <input
                            type="text"
                            placeholder="Pseudo"
                            onChange={(e) => setFormData({...formData, pseudo: e.target.value})}
                            required
                        />
                    )}
                    <input
                        type="email"
                        placeholder="Email"
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Mot de passe"
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        required
                    />
                    <button type="submit" className="btn-cyber">
                        {isLogin ? 'Se connecter' : "S'inscrire"}
                    </button>
                </form>
                {error && <p className="error-msg">{error}</p>}
                <p onClick={() => setIsLogin(!isLogin)} style={{cursor: 'pointer', marginTop: '15px'}}>
                    {isLogin ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
                </p>
            </div>
        );
    }

    // 5. RENDU : SI CONNECTÉ (Affiche le Lobby)
    return (
        <div>
            <header className="header-cyber">
                <h1 className="title-cyber">CYBER LOBBY</h1>
                <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
                    <div className="user-profile-btn" onClick={() => setShowModal(true)}>
                        <div className="header-avatar">{user.avatar}</div>
                        <span>{user.pseudo}</span>
                    </div>
                    <button className="btn-disconnect" onClick={logout}>Déconnexion</button>
                </div>
            </header>

            <main className="lobby-content">
                <h2 className="online-title">Joueurs en ligne</h2>
                <div className="player-grid">
                    {players.map(p => (
                        <div key={p.id} className="player-card">
                            <span style={{fontSize: '2rem'}}>{p.avatar}</span>
                            <span>{p.pseudo}</span>
                        </div>
                    ))}
                </div>
            </main>

            {showModal && (
                <div className="modal-overlay">
                    <div className="avatar-modal">
                        <h2 className="modal-title">Mon Profil</h2>
                        <div className="avatar-selection-grid">
                            {AVATAR_LIST.map(emoji => (
                                <div key={emoji} className="avatar-opt" onClick={() => handleAvatarSelect(emoji)}>
                                    {emoji}
                                </div>
                            ))}
                        </div>
                        <button className="btn-close-modal" onClick={() => setShowModal(false)}>Annuler</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
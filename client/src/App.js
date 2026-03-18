import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// URL de ton API Railway (à changer après déploiement)
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const socket = io(API_URL);

function App() {
    const [user, setUser] = useState(null);
    const [players, setPlayers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [formData, setFormData] = useState({ email: '', pseudo: '', password: '', birthDate: '', avatar: '👤' });

    useEffect(() => {
        socket.on('update_user_list', (list) => setPlayers(list));
        return () => socket.off('update_user_list');
    }, []);

    const handleAuth = async (e) => {
        e.preventDefault();
        const path = isLoginMode ? '/login' : '/register';
        try {
            const res = await fetch(`${API_URL}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (res.ok) {
                setUser(data.user);
                socket.emit('join_lobby', data.user);
                setShowModal(false);
            } else { alert(data.error); }
        } catch (err) { alert("Serveur injoignable"); }
    };

    return (
        <div className="App">
            <header className="header">
                <h1>MON JEU MULTI</h1>
                {user ? (
                    <div className="profile"><span>{user.avatar} {user.pseudo}</span><button onClick={() => window.location.reload()}>Déconnexion</button></div>
                ) : (
                    <button className="auth-btn" onClick={() => setShowModal(true)}>Mon Compte</button>
                )}
            </header>

            <main className="hero">
                {!user ? (
                    <>
                        <h2>Prêt à jouer ? Connectez-vous !</h2>
                        <img src="https://via.placeholder.com/400x200" alt="Lobby" />
                    </>
                ) : (
                    <div className="lobby-area">
                        <h2>Lobby en direct 🕒</h2>
                        <div className="players-list">
                            {players.map((p, idx) => (
                                <div key={idx} className="player-tag">{p.avatar} {p.pseudo}</div>
                            ))}
                        </div>
                        <button className="play-btn">LANCER LA PARTIE</button>
                    </div>
                )}
            </main>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{isLoginMode ? "Connexion" : "Inscription"}</h3>
                        <form onSubmit={handleAuth}>
                            {!isLoginMode && <input name="pseudo" placeholder="Pseudo" onChange={e => setFormData({...formData, pseudo: e.target.value})} required />}
                            <input name="email" type="email" placeholder="Email" onChange={e => setFormData({...formData, email: e.target.value})} required />
                            <input name="password" type="password" placeholder="Mot de passe" onChange={e => setFormData({...formData, password: e.target.value})} required />
                            {!isLoginMode && <input name="birthDate" type="date" onChange={e => setFormData({...formData, birthDate: e.target.value})} required />}
                            <button type="submit">{isLoginMode ? "Entrer" : "Créer mon compte"}</button>
                        </form>
                        <p onClick={() => setIsLoginMode(!isLoginMode)} className="switch">
                            {isLoginMode ? "Pas de compte ? S'inscrire" : "Déjà inscrit ? Se connecter"}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
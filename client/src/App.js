import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// URL de ton backend Railway
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const socket = io(API_URL);

function App() {
    // Définition des états (States) qui manquaient dans ta capture
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
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert("Erreur de connexion au serveur");
        }
    };

    return (
        <div className="App">
            <header className="header">
                <h1>MON JEU MULTI</h1>
                {user ? (
                    <div className="profile">
                        <span>{user.avatar} {user.pseudo}</span>
                        <button onClick={() => window.location.reload()}>Déconnexion</button>
                    </div>
                ) : (
                    <button className="auth-btn" onClick={() => setShowModal(true)}>Mon Compte</button>
                )}
            </header>

            <main className="hero">
                {!user ? (
                    <div className="welcome">
                        <h2>Prêt à jouer ?</h2>
                    </div>
                ) : (
                    <div className="lobby-area">
                        <h2>Joueurs en ligne ({players.length})</h2>
                        <div className="players-list">
                            {players.map((p, idx) => (
                                <div key={idx} className="player-tag">{p.avatar} {p.pseudo}</div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{isLoginMode ? "Connexion" : "Inscription"}</h3>
                        <form onSubmit={handleAuth}>
                            {!isLoginMode && (
                                <input placeholder="Pseudo" onChange={e => setFormData({...formData, pseudo: e.target.value})} required />
                            )}
                            <input type="email" placeholder="Email" onChange={e => setFormData({...formData, email: e.target.value})} required />
                            <input type="password" placeholder="Mot de passe" onChange={e => setFormData({...formData, password: e.target.value})} required />
                            <button type="submit">{isLoginMode ? "Entrer" : "Créer compte"}</button>
                        </form>
                        <p onClick={() => setIsLoginMode(!isLoginMode)} className="switch">
                            {isLoginMode ? "Créer un compte" : "Déjà inscrit ?"}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
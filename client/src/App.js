import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import QuizGame from './games/QuizGame';
import './App.css';

const API_URL = "https://mon-jeu-multi-production-ed0c.up.railway.app";
const socket = io(API_URL, { transports: ['websocket', 'polling'] });
const AVATARS = ['🕹️', '👽', '🤖', '👻', '👾', '👨‍🚀', '🐱', '🐲', '🐼', '🦊'];

function App() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
    const [players, setPlayers] = useState([]); // Utilisé pour afficher le nombre de joueurs en ligne
    const [showModal, setShowModal] = useState(false);
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ email: '', pseudo: '', password: '' });
    const [lobbies, setLobbies] = useState([]);
    const [currentLobby, setCurrentLobby] = useState(null);

    useEffect(() => {
        if (user) {
            socket.emit('joinGame', user);
            socket.on('updateUserList', (list) => setPlayers(list));
            socket.on('updateLobbies', (list) => setLobbies(list));
            socket.on('lobbyJoined', (l) => setCurrentLobby(l));
            socket.on('lobbyUpdated', (l) => setCurrentLobby(l));
            socket.on('gameStarted', (l) => setCurrentLobby(l));
            socket.on('forceDisconnect', (msg) => {
                alert(msg);
                localStorage.clear();
                window.location.reload();
            });
        }
        return () => socket.off();
    }, [user]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('Connexion...');
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
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError("Erreur de connexion au serveur.");
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
                    <button type="submit" className="btn-cyber">{isLogin ? 'Entrer' : 'S\'inscrire'}</button>
                </form>
                {error && <p className="error-msg">{error}</p>}
                <p onClick={() => setIsLogin(!isLogin)} style={{cursor: 'pointer'}}>
                    {isLogin ? "Pas de compte ? S'inscrire" : "Déjà inscrit ? Connexion"}
                </p>
            </div>
        );
    }

    return (
        <div className="App">
            {currentLobby && currentLobby.status === 'playing' ? (
                <QuizGame currentLobby={currentLobby} socket={socket} />
            ) : (
                <div className="lobby-ui">
                    <header className="header-cyber">
                        <h1 className="title-cyber">CYBER LOBBY</h1>
                        <p>Joueurs en ligne: {players.length}</p> {/* Utilisation de la variable pour valider le build */}
                        <button className="btn-disconnect" onClick={() => {localStorage.clear(); window.location.reload();}}>Quitter</button>
                    </header>
                    {/* Reste de votre interface lobby ici */}
                </div>
            )}
        </div>
    );
}

export default App;
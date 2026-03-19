import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

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
            <header className="header" style={{display:'flex', justifyContent:'space-between', padding:'20px', background:'#222', color:'white'}}>
                <h1>MON JEU MULTI</h1>
                {user ? (
                    <div><span>{user.avatar} {user.pseudo}</span> <button onClick={() => window.location.reload()}>Déconnexion</button></div>
                ) : (
                    <button onClick={() => setShowModal(true)}>Mon Compte</button>
                )}
            </header>

            <main style={{textAlign:'center', marginTop:'50px'}}>
                {!user ? (
                    <h2>Connectez-vous pour rejoindre le Lobby !</h2>
                ) : (
                    <div className="lobby">
                        <h3>Joueurs en ligne :</h3>
                        {players.map((p, i) => <div key={i}>{p.avatar} {p.pseudo}</div>)}
                    </div>
                )}
            </main>

            {showModal && (
                <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', display:'flex', justifyContent:'center', alignItems:'center'}}>
                    <div style={{background:'white', padding:'30px', borderRadius:'10px', color:'black'}}>
                        <h3>{isLoginMode ? "Connexion" : "Inscription"}</h3>
                        <form onSubmit={handleAuth} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            {!isLoginMode && <input placeholder="Pseudo" onChange={e => setFormData({...formData, pseudo: e.target.value})} required />}
                            <input type="email" placeholder="Email" onChange={e => setFormData({...formData, email: e.target.value})} required />
                            <input type="password" placeholder="Mot de passe" onChange={e => setFormData({...formData, password: e.target.value})} required />
                            <button type="submit">{isLoginMode ? "Se connecter" : "S'inscrire"}</button>
                        </form>
                        <p style={{cursor:'pointer', color:'blue', marginTop:'10px'}} onClick={() => setIsLoginMode(!isLoginMode)}>
                            {isLoginMode ? "Créer un compte" : "Déjà un compte ?"}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io("https://ton-url-railway.app"); // ⚠️ À MODIFIER
const AVATAR_LIST = ['🕹️', '👽', '🤖', '👻', '👾', '👨‍🚀', '🐱', '🐲', '🐼', '🦊'];

function Lobby() {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
    const [players, setPlayers] = useState([]);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (user) {
            socket.emit('joinGame', user);
            socket.on('updateUserList', (list) => setPlayers(list));
        }
        return () => socket.off('updateUserList');
    }, [user]);

    const handleAvatarSelect = async (emoji) => {
        try {
            const response = await fetch("https://ton-url-railway.app/api/user/update-avatar", {
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
        } catch (error) {
            console.error("Erreur avatar:", error);
        }
    };

    if (!user) return <div className="lobby-content">Veuillez vous connecter.</div>;

    return (
        <div>
            <header className="header-cyber">
                <h1 className="title-cyber">CYBER LOBBY</h1>
                <div className="user-profile-btn" onClick={() => setShowModal(true)}>
                    <div className="header-avatar">{user.avatar}</div>
                    <span className="pseudo-text">{user.pseudo}</span>
                </div>
            </header>

            <main className="lobby-content">
                <h2 style={{color: '#e94560', fontFamily: 'Orbitron'}}>Joueurs en ligne</h2>
                <div className="player-grid">
                    {players.map(p => (
                        <div key={p.id} className="player-card">
                            <span style={{fontSize: '2rem'}}>{p.avatar}</span>
                            <span style={{fontWeight: 'bold'}}>{p.pseudo}</span>
                        </div>
                    ))}
                </div>
            </main>

            {showModal && (
                <div className="modal-overlay">
                    <div className="avatar-modal">
                        <h2 style={{fontFamily: 'Orbitron', color: '#00d4ff'}}>Mon Profil</h2>
                        <div className="avatar-selection-grid">
                            {AVATAR_LIST.map(emoji => (
                                <div key={emoji} className="avatar-opt" onClick={() => handleAvatarSelect(emoji)}>
                                    {emoji}
                                </div>
                            ))}
                        </div>
                        <button className="btn-cyber" onClick={() => setShowModal(false)}>Fermer</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Lobby;
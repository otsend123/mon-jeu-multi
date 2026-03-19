// src/Lobby.jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css'; // Assurez-vous d'importer le CSS complet

// Configuration de l'URL du serveur (Railway)
const SERVER_URL = "https://votre-jeu.up.railway.app"; // REMPLACEZ PAR VOTRE URL RAILWAY

const socket = io(SERVER_URL);

// Liste des emojis disponibles pour les avatars
const AVATAR_OPTIONS = ['🕹️', '👽', '🤖', '👻', '👾', '👤', '👨‍🚀', '👸'];

function Lobby() {
    // État pour stocker l'utilisateur connecté (récupéré depuis localStorage ou Login)
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('cyberLobbyUser')));
    const [players, setPlayers] = useState([]); // Liste des joueurs en ligne
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false); // État de la fenêtre modale

    useEffect(() => {
        if (user) {
            // 1. On signale au serveur qu'on rejoint le lobby
            socket.emit('joinGame', {
                id: user.id,
                pseudo: user.pseudo,
                avatar: user.avatar
            });

            // 2. On écoute la liste mise à jour envoyée par le serveur
            socket.on('updateUserList', (userList) => {
                setPlayers(userList);
            });
        }

        // Nettoyage lors de la fermeture du composant
        return () => {
            socket.off('updateUserList');
        };
    }, [user]);

    // Fonction pour gérer le changement d'avatar
    const handleAvatarChange = async (newAvatar) => {
        try {
            // A. Mise à jour dans la base de données via l'API
            const response = await fetch(`${SERVER_URL}/api/user/update-avatar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, avatar: newAvatar }),
            });

            const data = await response.json();

            if (response.ok) {
                // B. Mise à jour de l'état local (React)
                const updatedUser = { ...user, avatar: data.avatar };
                setUser(updatedUser);
                // Mise à jour du stockage local
                localStorage.setItem('cyberLobbyUser', JSON.stringify(updatedUser));

                // C. On avertit le serveur via Socket pour que les autres joueurs voient le changement
                socket.emit('changeAvatar', data.avatar);

                // D. On ferme la modale
                setIsAvatarModalOpen(false);
            } else {
                alert("Erreur : " + data.error);
            }
        } catch (error) {
            console.error("Erreur d'API :", error);
            alert("Impossible de contacter le serveur.");
        }
    };

    const handleDisconnect = () => {
        localStorage.removeItem('cyberLobbyUser');
        window.location.reload(); // Recharger pour simuler une déconnexion
    };

    if (!user) return <div>Vous n'êtes pas connecté.</div>;

    return (
        <div className="App">
            {/* --- HEADER --- */}
            <header className="header-cyber">
                <h1 className="title-cyber">MON JEU MULTI</h1>
                <div className="user-info-header" onClick={() => setIsAvatarModalOpen(true)}>
                    <div className="avatar-display-header">{user.avatar}</div>
                    <div className="pseudo-display-header">{user.pseudo}</div>
                    <button className="btn-disconnect" onClick={handleDisconnect}>Déconnexion</button>
                </div>
            </header>

            {/* --- ZONE PRINCIPALE --- */}
            <main className="lobby-main">
                <h2 className="online-title">Joueurs en ligne :</h2>
                <div className="player-list-container">
                    {players.map((player) => (
                        <div key={player.id} className="player-card">
                            <div className="player-card-avatar">{player.avatar}</div>
                            <div className="player-card-pseudo">{player.pseudo}</div>
                        </div>
                    ))}
                </div>
            </main>

            {/* --- FENÊTRE MODALE DE SÉLECTION D'AVATAR --- */}
            {isAvatarModalOpen && (
                <div className="modal-overlay">
                    <div className="avatar-selector-modal">
                        <h3 className="modal-title">Choisissez votre Avatar</h3>
                        <div className="avatar-grid">
                            {AVATAR_OPTIONS.map((option) => (
                                <div
                                    key={option}
                                    className={`avatar-option ${user.avatar === option ? 'selected' : ''}`}
                                    onClick={() => handleAvatarChange(option)}
                                >
                                    {option}
                                </div>
                            ))}
                        </div>
                        <button className="btn-close-modal" onClick={() => setIsAvatarModalOpen(false)}>Annuler</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Lobby;
import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
    const [message, setMessage] = useState('');
    const [chat, setChat] = useState([]);

    const handleSend = async () => {
        if (message.trim() === '') return;

        // Append the user's message to the chat
        const newChat = [...chat, { sender: 'user', text: message }];
        setChat(newChat);

        try {
            // Send the message to the backend
            const { data } = await axios.post('http://localhost:5000/api/chat', { message });
            setChat([...newChat, { sender: 'agent', text: data.reply }]);
        } catch (error) {
            console.error('Error sending message:', error);
            setChat([...newChat, { sender: 'agent', text: 'Error: Could not process your request.' }]);
        }
        setMessage('');
    };

    return (
        <div className="chat-container">
            <h1>AI Receptionist</h1>
            <div className="chat-window">
                {chat.map((msg, index) => (
                    <div key={index} className={`message ${msg.sender}`}>
                        {msg.text}
                    </div>
                ))}
            </div>
            <div className="chat-input">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                />
                <button onClick={handleSend}>Send</button>
            </div>
        </div>
    );
}

export default App;

import React, { useState } from 'react';
import './App.css';

function App() {
    const [startRecording, setStartRecording] = useState<boolean>(false);
    return (
        <div className="App">
            <header className="App-header">
                <p>
                    Track your habits
                </p>
                <button onClick={() => setStartRecording(true)}>
                    Start
                </button>
            </header>
            {startRecording && (<div className="modal-overlay">
                <div className="modal-content">
                    <h2>Modal Title</h2>
                    <p>Modal content goes here</p>
                    <button onClick={() => setStartRecording(false)}>Close</button>
                </div>
            </div>)}
        </div>
    );
}

export default App;

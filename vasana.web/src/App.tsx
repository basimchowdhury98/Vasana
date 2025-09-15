import React, { useState } from 'react';
import './App.css';
import RecordingModal from './RecordingModal';

function App() {
    const [showRecordingModal, setShowRecordingModal] = useState<boolean>(false);

    async function startRecording() {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            setShowRecordingModal(true);
        } catch (error) {
            console.error('Microphone access denied:', error);
        }
    }
    return (
        <div className="App">
            <header className="App-header">
                <p>
                    Track your habits
                </p>
                <button onClick={startRecording}>
                    Start
                </button>
            </header>
            {showRecordingModal && (<RecordingModal></RecordingModal>)}
        </div>
    );
}

export default App;

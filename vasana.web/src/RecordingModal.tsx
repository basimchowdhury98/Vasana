import { useEffect, useRef, useState } from "react";

function RecordingModal() {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
                mediaRecorderRef.current = new MediaRecorder(stream);
                chunksRef.current = [];

                mediaRecorderRef.current.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunksRef.current.push(event.data);
                    }
                };
                mediaRecorderRef.current.onstop = () => {
                    const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
                    const url = URL.createObjectURL(blob);
                    setAudioUrl(url);

                    // Stop all tracks to release microphone
                    stream.getTracks().forEach(track => track.stop());
                };
                mediaRecorderRef.current.start();
            })
            .catch((error) => {
                console.error('No microphone access:', error);
            });
    }, []);

    function play() {
        if (audioUrl !== null) {
            const audio = new Audio(audioUrl);
            audio.play();
        }
    }

    function stopRecording(){
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
        }
    }

    return (<div className="modal-overlay">
        <div className="modal-content">
            <h2>Modal Title</h2>
            <p>{audioUrl === null ? "Recording" : "Done"}</p>
            {audioUrl !== null && (
                <button onClick={play}>Play</button>
            )}
            {audioUrl === null && (
                <button onClick={stopRecording}>Stop</button>
            )}
        </div>
    </div>)
}

export default RecordingModal;

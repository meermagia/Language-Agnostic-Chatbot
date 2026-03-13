import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import ReactMarkdown from 'react-markdown'; 
import remarkGfm from 'remark-gfm';

const API_URL = "http://localhost:3001";

// A list of predefined Frequently Asked Questions
const FAQS = [
    "What are the library hours?",
    "When is the deadline for fee payment?",
    "what all will i learn in 4th sem",
    "How do I reset my campus password?",
    "When is the next holiday?",
];

function App() {
    // --- State for the entire application ---
    // Chat State
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [manualUserId, setManualUserId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [broadcastMessage, setBroadcastMessage] = useState(null);
    const [isUserIdLocked, setIsUserIdLocked] = useState(false);
    
    // View State
    const [isAdminView, setIsAdminView] = useState(false);

    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [sidebarHistory, setSidebarHistory] = useState([]);

    // Admin Panel State
    const [sessions, setSessions] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [history, setHistory] = useState([]);
    const [broadcastInput, setBroadcastInput] = useState('');
    const [feedback, setFeedback] = useState('');
    const [topQuestions, setTopQuestions] = useState([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

    const messagesEndRef = useRef(null);

    // Effect to scroll down on new messages
    useEffect(() => {
        if (!isAdminView) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isAdminView]);
    
    // Effect to watch the User ID input and fetch its history for the sidebar
    useEffect(() => {
        const handler = setTimeout(() => {
            if (manualUserId.trim()) {
                fetchHistoryForSidebar(manualUserId);
            } else {
                setSidebarHistory([]);
            }
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [manualUserId]);

    // Effect to fetch the broadcast message when the app first loads
    useEffect(() => {
        const fetchInitialBroadcast = async () => {
            try {
                const res = await fetch(`${API_URL}/api/broadcast`);
                if (res.ok) {
                    const data = await res.json();
                    setBroadcastMessage(data.broadcastMessage);
                }
            } catch (error) {
                console.error("Could not fetch initial broadcast message", error);
            }
        };
        fetchInitialBroadcast();
    }, []);

    // --- FUNCTIONS ---
    const fetchHistoryForSidebar = async (userId) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/history/${userId}`);
            if (res.ok) {
                const data = await res.json();
                setSidebarHistory(data);
            } else {
                 setSidebarHistory([]);
            }
        } catch (error) {
            console.error("Error loading sidebar history:", error);
            setSidebarHistory([]);
        }
    };
    
    const handleNewChat = () => {
        setMessages([]);
        setManualUserId('');
        setInput('');
        setIsUserIdLocked(false); // Unlock the User ID field for the new chat
    };

    const submitQuery = async (query, userId) => {
        if (!query.trim() || !userId.trim()) {
            alert("Please ensure both User ID and a question are provided.");
            return;
        }
        const userMessage = { role: 'user', content: query };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: query, userId: userId }),
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const assistantMessage = { role: 'assistant', content: data.answer };
            setMessages(prev => [...prev, assistantMessage]);
            setBroadcastMessage(data.broadcastMessage);
            fetchHistoryForSidebar(userId);
            setIsUserIdLocked(true); // Lock the User ID after a successful send
        } catch (error) {
            const errorMessage = { role: 'assistant', content: `Sorry, something went wrong: ${error.message}` };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFaqClick = (faqText) => {
        if (!manualUserId.trim()) {
            alert("Please enter a User ID before selecting an FAQ.");
            return;
        }
        setInput(faqText);
        submitQuery(faqText, manualUserId);
    };

    const handleSend = (e) => {
        e.preventDefault();
        submitQuery(input, manualUserId);
    };

    const checkPassword = (promptMessage) => {
        const password = window.prompt(promptMessage);
        if (password === "admin") {
            return true;
        } else if (password !== null) {
            alert("Incorrect password.");
        }
        return false;
    };

    const handleAdminAccess = () => {
        if (isAdminView) {
            setIsAdminView(false);
        } else {
            if (checkPassword("Please enter the admin password:")) {
                setIsAdminView(true);
            }
        }
    };
    
    const handleUnlockUserId = () => {
        if (checkPassword("To change the User ID, please enter the admin password:")) {
            setIsUserIdLocked(false);
        }
    };

    // --- ADMIN PANEL FUNCTIONS ---
    const fetchAdminSessions = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/sessions`);
            if (!res.ok) throw new Error("Failed to fetch sessions");
            const data = await res.json();
            setSessions(data);
        } catch (error) {
            console.error(error);
            setFeedback("Error loading sessions.");
            setTimeout(() => setFeedback(''), 3000);
        }
    };
    
    const handleSetBroadcast = async (isClearing = false) => {
        const message = isClearing ? '' : broadcastInput;
        try {
            const res = await fetch(`${API_URL}/api/admin/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            const data = await res.json();
            setFeedback(data.message);
            if(isClearing) setBroadcastInput('');
            setTimeout(() => setFeedback(''), 3000);
        } catch (error) {
            setFeedback('Error setting broadcast message.');
            setTimeout(() => setFeedback(''), 3000);
        }
    };

    const handleClearHistory = async () => {
        if (!selectedUserId) return;
        const isConfirmed = window.confirm(`Are you sure you want to permanently delete all messages for user "${selectedUserId}"?`);
        if (!isConfirmed) return;
        try {
            const res = await fetch(`${API_URL}/api/admin/history/${selectedUserId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error("Failed to clear history");
            const data = await res.json();
            setFeedback(data.message);
            setTimeout(() => setFeedback(''), 4000);
            setHistory([]);
            setSelectedUserId('');
            fetchAdminSessions();
        } catch (error) {
            console.error(error);
            setFeedback("Error clearing history.");
            setTimeout(() => setFeedback(''), 3000);
        }
    };

    const handleFetchTopQuestions = async () => {
        setIsLoadingQuestions(true);
        setFeedback('');
        try {
            const res = await fetch(`${API_URL}/api/admin/top_questions`);
            if (!res.ok) throw new Error("Failed to analyze questions");
            const data = await res.json();
            setTopQuestions(data);
        } catch (error) {
            console.error(error);
            setFeedback("Error analyzing top questions.");
            setTimeout(() => setFeedback(''), 3000);
        } finally {
            setIsLoadingQuestions(false);
        }
    };

    useEffect(() => {
        if (isAdminView) {
            fetchAdminSessions();
        }
    }, [isAdminView]);

    useEffect(() => {
        if (selectedUserId && isAdminView) {
            const fetchHistory = async () => {
                try {
                    const res = await fetch(`${API_URL}/api/admin/history/${selectedUserId}`);
                    if (!res.ok) throw new Error("Failed to fetch history");
                    const data = await res.json();
                    setHistory(data);
                } catch (error) {
                    console.error(error);
                    setFeedback("Error loading chat history.");
                    setTimeout(() => setFeedback(''), 3000);
                }
            };
            fetchHistory();
        } else {
            setHistory([]);
        }
    }, [selectedUserId, isAdminView]);


    // --- RENDER LOGIC ---
    return (
        <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h3>History for:</h3>
                    <div className="sidebar-user-id">{manualUserId || '...'}</div>
                </div>
                <div className="sidebar-content">
                    {sidebarHistory.length > 0 ? (
                        sidebarHistory.map((msg, index) => (
                            <div key={index} className={`sidebar-history-item sidebar-role-${msg.role}`}>
                                <div className="sidebar-history-role">{msg.role}</div>
                                <div className="sidebar-history-content">{msg.content}</div>
                            </div>
                        ))
                    ) : (
                        <div className="no-history-message">
                            {manualUserId ? `No history found for "${manualUserId}".` : "Type a User ID to see history."}
                        </div>
                    )}
                </div>
            </aside>
            
            <div className="main-content-wrapper">
                 <header className="chat-header">
                    <div className="header-content">
                        <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                            <svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"></path></svg>
                        </button>
                        <h1>{isAdminView ? 'Admin Panel' : 'Conversa'}</h1>
                        <div>
                            {!isAdminView && (
                                 <button onClick={handleNewChat} className="new-chat-btn" disabled={isLoading}>New Chat</button>
                            )}
                            <button onClick={handleAdminAccess} className="new-chat-btn">
                                {isAdminView ? '← Back to Chat' : 'Admin Panel'}
                            </button>
                        </div>
                    </div>
                </header>

                {isAdminView ? (
                    <div className="admin-panel">
                        <div className="admin-section">
                           <h3>Broadcast Message</h3>
                           <p>Set a message that will be included in the LLM's context for all users.</p>
                            <input type="text" value={broadcastInput} onChange={(e) => setBroadcastInput(e.target.value)} placeholder="Enter broadcast message..."/>
                            <button onClick={() => handleSetBroadcast(false)}>Set Broadcast</button>
                            <button onClick={() => handleSetBroadcast(true)}>Clear Broadcast</button>
                        </div>
                        <div className="admin-section">
                            <h3>Top Question Categories</h3>
                            <p>Group all user questions by semantic meaning to find out what people are asking most about.</p>
                            <button onClick={handleFetchTopQuestions} disabled={isLoadingQuestions}>{isLoadingQuestions ? 'Analyzing...' : 'Analyze All Questions'}</button>
                            <div className="top-questions-results">
                                {topQuestions.map((category, index) => (
                                    <details key={index} className="question-category"><summary><span className="category-label">{category.category_label}</span><span className="category-count">{category.total_count} questions</span></summary>
                                        <ul>{category.variations.sort((a,b) => b.count - a.count).map((variation, vIndex) => (<li key={vIndex}>"{variation.text}" <span className="variation-count">({variation.count})</span></li>))}</ul>
                                    </details>
                                ))}
                            </div>
                        </div>
                        <div className="admin-section">
                            <h3>View Chat History</h3>
                            <p>Select a user session to view their conversation history.</p>
                            <div className="history-controls">
                                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}><option value="">-- Select a User ID --</option>{sessions.map(id => <option key={id} value={id}>{id}</option>)}</select>
                                {history.length > 0 && (<button onClick={handleClearHistory} className="clear-history-btn">Clear This History</button>)}
                            </div>
                            <div className="history-log">
                                {history.length > 0 ? history.map((msg, index) => (<div key={index} className={`log-message log-${msg.role}`}><strong>{msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}:</strong><p>{msg.content}</p></div>)) : <p className="log-empty">Select a user to view their history.</p>}
                            </div>
                        </div>
                        {feedback && <div className="feedback-toast">{feedback}</div>}
                    </div>
                ) : (
                    <>
                        <main className="chat-window">
                            {broadcastMessage && (<div className="broadcast-banner">{broadcastMessage}</div>)}
                            
                            {messages.length === 0 && !isLoading ? (
                                <div className="faq-container">
                                    <h3>Frequently Asked Questions</h3>
                                    <div className="faq-list">
                                        {FAQS.map((faq, index) => (
                                            <button key={index} className="faq-item" onClick={() => handleFaqClick(faq)}>
                                                {faq}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, index) => (
                                    <div key={index} className={`message ${msg.role}`}>
                                        <div className="bubble">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                ))
                            )}

                            {isLoading && ( <div className="message assistant"><div className="bubble typing-indicator"><span></span><span></span><span></span></div></div> )}
                            <div ref={messagesEndRef} />
                        </main>
                        <footer className="chat-input-area">
                            <div className="footer-content">
                                <form onSubmit={handleSend} className="input-form">
                                    <input
                                        type="text"
                                        className="userid-input"
                                        value={manualUserId}
                                        onChange={(e) => setManualUserId(e.target.value)}
                                        placeholder="Enter User ID..."
                                        disabled={isLoading || isUserIdLocked}
                                    />
                                    {isUserIdLocked && (
                                        <button type="button" className="unlock-btn" onClick={handleUnlockUserId} title="Change User ID">
                                            🔓
                                        </button>
                                    )}
                                    <input
                                        type="text"
                                        className="question-input"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Type your question..."
                                        disabled={isLoading}
                                    />
                                    <button type="submit" disabled={!input.trim() || !manualUserId.trim() || isLoading}>
                                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                                    </button>
                                </form>
                            </div>
                        </footer>
                    </>
                )}
            </div>
        </div>
    );
}

export default App;

//TODO: History chat for each given user ID
//TODO: logic password for web load and userID change
//TODO: faq directly load to chat view and answer
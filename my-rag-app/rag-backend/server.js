import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import Groq from "groq-sdk";

dotenv.config();

// ------------------ CONFIG ------------------
const MONGO_URI = process.env.MONGODB_URL;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.MODEL;
const DB_NAME = "rag_db";
const COLLECTION_NAME = "documents";
const MESSAGES_COLLECTION_NAME = "messages";
const BROADCAST_COLLECTION_NAME = "system_messages";
const INDEX_NAME = "vector_index";
const PORT = 3001;
const MAX_MEMORY_TURNS = 10;

const PREDEFINED_INTENTS = {
    "Holidays & Breaks": "Information about college holidays, vacations, festivals like Diwali, and academic breaks.",
    "Course & Syllabus": "Questions about course structure, subjects, syllabus, semesters, and curriculum details.",
    "Fees & Payments": "Inquiries related to tuition fees, payment deadlines, and financial matters.",
    "Campus Timings": "Questions about the operational hours of the library, offices, or other campus facilities.",
    "Greetings & Chitchat": "Simple greetings like hello, how are you, and other conversational fillers.",
    "File & Document Queries": "Questions asking for information contained within a specific uploaded file or document.",
    "Meta & Broadcast": "Questions about the bot itself, the broadcast message, or asking for responses in a specific language.",
};

// ------------------ INIT APP & CLIENTS ------------------
const app = express();
app.use(cors());
app.use(bodyParser.json());
const groq = new Groq({ apiKey: GROQ_API_KEY });

// --- GLOBALS INITIALIZED ON STARTUP ---
let messagesCollection;
let broadcastCollection;
let vectorStore;
let embeddings;

// --- CORE LOGIC ---
const getUserMemory = async (userId) => {
    const messages = await messagesCollection
        .find({ userId: userId })
        .sort({ timestamp: -1 })
        .limit(MAX_MEMORY_TURNS)
        .toArray();
    return messages.reverse();
};

const addToMemory = async (userId, role, content) => {
    const ts = Math.floor(Date.now() / 1000);
    await messagesCollection.insertOne({ userId, role, content, timestamp: ts });
};

// ✨ MODIFIED: This function is now async to fetch the broadcast message for the LLM
const buildPrompt = async (userQuery, contextDocs, history) => {
    const systemPrompt = `You are an intelligent campus assistant. Answer the user's question based on the provided context documents and the conversation history. If the context doesn't contain the answer, state that you don't have enough information. Be concise and helpful. Answer the user in the **same language as the input**. If the input language is not English, Hindi, or a common regional language you are trained on, default the answer language to **english**.`;    
    const context = contextDocs.map(doc => doc.pageContent).join("\n\n---\n\n");
    const historyMessages = history.map(msg => ({ role: msg.role, content: msg.content }));
    
    const messages = [
        { role: "system", content: systemPrompt },
        ...historyMessages
    ];

    // Fetch and inject the broadcast message as a special context for the LLM
    const broadcastDoc = await broadcastCollection.findOne({ type: "broadcast" });
    if (broadcastDoc && broadcastDoc.message) {
        messages.push({
            role: "system",
            content: `CONTEXT:\n${context}\nSPECIAL ANNOUNCEMENT FOR CONTEXT: ${broadcastDoc.message}\nQUESTION:\n${userQuery}`
        });
    }

    messages.push({
        role: "user",
        content: `CONTEXT:\n${context}\n\nQUESTION:\n${userQuery}`
    });
    
    return messages;
};

// ✨ MODIFIED: This function now 'awaits' the async buildPrompt
const processRagQuery = async (userQuery, userId) => {
    const contextDocs = await vectorStore.similaritySearch(userQuery, 7);
    const history = await getUserMemory(userId);
    await addToMemory(userId, "user", userQuery);
    
    const messages = await buildPrompt(userQuery, contextDocs, history); // <-- Awaited here
    
    const chatCompletion = await groq.chat.completions.create({ messages, model: MODEL });
    const llmAnswer = chatCompletion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
    await addToMemory(userId, "assistant", llmAnswer);
    return llmAnswer;
};


// --- ROUTES ---
app.post("/api/ask", async (req, res) => {
    try {
        const { question, userId } = req.body;
        if (!question || !userId) return res.status(400).json({ error: "Both 'question' and 'userId' are required" });
        const answer = await processRagQuery(question, userId);
        const broadcastDoc = await broadcastCollection.findOne({ type: "broadcast" });
        const broadcastMessage = broadcastDoc ? broadcastDoc.message : null;
        res.json({ answer, broadcastMessage });
    } catch (err) {
        console.error("Error in /api/ask:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/api/reset_chat", async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ detail: "User ID is required." });
    await messagesCollection.deleteMany({ userId });
    res.json({ message: `Chat history for user ${userId} has been cleared.` });
});

// --- ADMIN ROUTES ---
app.get("/api/admin/sessions", async (req, res) => {
    try {
        const userIds = await messagesCollection.distinct("userId");
        res.json(userIds);
    } catch (err) {
        console.error("Error fetching sessions:", err);
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
});

app.get("/api/admin/history/:userId", async (req, res) => {
    try {
        const history = await messagesCollection.find({ userId: req.params.userId }).sort({ timestamp: 1 }).toArray();
        res.json(history);
    } catch (err) {
        console.error("Error fetching history:", err);
        res.status(500).json({ error: "Failed to fetch chat history" });
    }
});

app.delete("/api/admin/history/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const deleteResult = await messagesCollection.deleteMany({ userId: userId });
        res.status(200).json({ 
            status: "ok", 
            message: `Successfully deleted ${deleteResult.deletedCount} messages for user ${userId}.` 
        });
    } catch (err) {
        console.error("Error deleting history:", err);
        res.status(500).json({ error: "Failed to delete chat history" });
    }
});

app.post("/api/admin/broadcast", async (req, res) => {
    try {
        const { message } = req.body;
        if (message && message.trim() !== '') {
            await broadcastCollection.updateOne(
                { type: "broadcast" },
                { $set: { message: message, updatedAt: new Date() } },
                { upsert: true }
            );
            res.json({ status: "ok", message: `Broadcast set to: "${message}"` });
        } else {
            await broadcastCollection.deleteOne({ type: "broadcast" });
            res.json({ status: "ok", message: "Broadcast cleared." });
        }
    } catch (err) {
        console.error("Error setting broadcast:", err);
        res.status(500).json({ error: "Failed to set broadcast message" });
    }
});

app.get("/api/admin/top_questions", async (req, res) => {
    try {
        const uniqueQuestions = await messagesCollection.aggregate([
            { $match: { role: 'user' } },
            { $group: { _id: '$content', count: { $sum: 1 } } }
        ]).toArray();
        if (uniqueQuestions.length === 0) return res.json([]);
        const intentLabels = Object.keys(PREDEFINED_INTENTS);
        const intentPhrases = Object.values(PREDEFINED_INTENTS);
        const questionTexts = uniqueQuestions.map(q => q._id);
        const [intentVectors, questionVectors] = await Promise.all([
            embeddings.embedDocuments(intentPhrases),
            embeddings.embedDocuments(questionTexts)
        ]);
        let categories = {};
        intentLabels.forEach(label => {
            categories[label] = { category_label: label, total_count: 0, variations: [] };
        });
        categories["Other Inquiries"] = { category_label: "Other Inquiries", total_count: 0, variations: [] };
        const SIMILARITY_THRESHOLD = 0.65;
        questionVectors.forEach((qVector, i) => {
            let bestMatch = { score: -1, intent: "Other Inquiries" };
            intentVectors.forEach((intentVector, j) => {
                const score = cosineSimilarity(qVector, intentVector);
                if (score > bestMatch.score) { bestMatch = { score: score, intent: intentLabels[j] }; }
            });
            const targetCategory = bestMatch.score >= SIMILARITY_THRESHOLD ? bestMatch.intent : "Other Inquiries";
            categories[targetCategory].total_count += uniqueQuestions[i].count;
            categories[targetCategory].variations.push({ text: uniqueQuestions[i]._id, count: uniqueQuestions[i].count });
        });
        const formattedResults = Object.values(categories).filter(cat => cat.total_count > 0).sort((a, b) => b.total_count - a.total_count);
        res.json(formattedResults);
    } catch (err) {
        console.error("Error in top questions analysis:", err);
        res.status(500).json({ error: "Failed to analyze top questions" });
    }
});

app.get("/api/broadcast", async (req, res) => {
    try {
        const broadcastDoc = await broadcastCollection.findOne({ type: "broadcast" });
        const broadcastMessage = broadcastDoc ? broadcastDoc.message : null;
        res.json({ broadcastMessage });
    } catch (err) {
        console.error("Error fetching broadcast message:", err);
        res.status(500).json({ error: "Failed to fetch broadcast message" });
    }
});

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return (magnitudeA === 0 || magnitudeB === 0) ? 0 : dotProduct / (magnitudeA * magnitudeB);
}

// --- SERVER STARTUP ---
async function startServer() {
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        messagesCollection = db.collection(MESSAGES_COLLECTION_NAME);
        broadcastCollection = db.collection(BROADCAST_COLLECTION_NAME);
        console.log("✅ Connected to MongoDB Atlas & collections are ready.");
        embeddings = new GoogleGenerativeAIEmbeddings({ model: "models/text-embedding-004", googleApiKey: GOOGLE_API_KEY });
        vectorStore = new MongoDBAtlasVectorSearch(embeddings, { collection: db.collection(COLLECTION_NAME), indexName: INDEX_NAME, textKey: "text", embeddingKey: "embedding" });
        console.log("✅ Vector Store Initialized.");
        app.listen(PORT, () => { console.log(`🚀 Backend server running on http://localhost:${PORT}`); });
    } catch (err) {
        console.error("❌ Server startup failed:", err);
        process.exit(1);
    }
}

startServer();
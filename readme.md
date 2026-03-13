# 🌐 Language-Agnostic Chatbot

A multilingual RAG (Retrieval-Augmented Generation) chatbot that can understand and respond to queries in any language. Built with a React frontend and a Python backend, it combines document ingestion with conversational AI to answer questions from your own knowledge base — regardless of the language you use.

---

## ✨ Features

- **Language-agnostic** — Ask questions in any language; the chatbot understands and responds accordingly
- **RAG-powered** — Answers are grounded in your own uploaded documents, not just generic LLM knowledge
- **Document ingestion** — Load documents from the `documents/` folder into a vector database
- **Modern UI** — Clean, responsive frontend built with React and CSS
- **Modular architecture** — Decoupled frontend (`my-rag-app/`) and backend (`db.py`) for easy customization

---

## 🗂️ Project Structure

```
language-agnostic-chatbot/
├── documents/          # Place your source documents here for ingestion
├── my-rag-app/         # React frontend application
│   ├── src/
│   ├── public/
│   └── package.json
├── db.py               # Python backend: document loading & vector DB setup
├── requirements.txt    # Python dependencies
└── .DS_Store
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- Node.js 16+ and npm
- An OpenAI API key (or compatible LLM provider)

---

### 1. Clone the Repository

```bash
git clone https://github.com/karanLokhande29/language-agnostic-chatbot.git
cd language-agnostic-chatbot
```

---

### 2. Backend Setup

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

Add your documents to the `documents/` folder, then run the ingestion script to load them into the vector store:

```bash
python db.py
```

---

### 3. Frontend Setup

Navigate to the React app directory and install dependencies:

```bash
cd my-rag-app
npm install
```

Start the development server:

```bash
npm start
```

The app will be available at `http://localhost:3000`.

---

## ⚙️ Configuration

Set your API keys and any other configuration values as environment variables before running:

```bash
export OPENAI_API_KEY=your_api_key_here
```

You can also create a `.env` file in the project root:

```
OPENAI_API_KEY=your_api_key_here
```

---

## 🧠 How It Works

1. **Ingestion** — `db.py` reads documents from the `documents/` folder, splits them into chunks, embeds them using a language model, and stores them in a vector database.
2. **Query** — When a user sends a message via the React UI, the query is embedded and matched against the stored document vectors.
3. **Generation** — The most relevant document chunks are passed as context to the LLM, which generates a response — in whatever language the user wrote in.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript, CSS |
| Backend | Python |
| Vector Store | (configured in `db.py`) |
| LLM | OpenAI / compatible provider |

---

## 📁 Adding Documents

Simply drop your `.pdf`, `.txt`, `.md`, or other supported files into the `documents/` folder and re-run:

```bash
python db.py
```

The chatbot will now be able to answer questions based on the new content.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests for bug fixes, new features, or documentation improvements.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source. See the repository for details.

---

## 👤 Author

**Karan Lokhande**
[GitHub](https://github.com/karanLokhande29)

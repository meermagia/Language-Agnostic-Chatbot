import os
from dotenv import load_dotenv
from pymongo import MongoClient
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_mongodb import MongoDBAtlasVectorSearch

load_dotenv()
MONGODB_URL = os.environ.get("MONGODB_URL")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

if not MONGODB_URL or not GOOGLE_API_KEY:
    raise ValueError("MONGODB_URL and GOOGLE_API_KEY must be set in the .env file")

PDFS_PATH = "documents/"
DB_NAME = "rag_db"
COLLECTION_NAME = "documents"
INDEX_NAME = "vector_index" 


def create_vector_db():
    """
    Creates a vector database in MongoDB Atlas from PDF documents
    using Google's embedding model.
    """
    # Initialize MongoDB client
    client = MongoClient(MONGODB_URL)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    print("Loading PDFs from directory...")
    loader = DirectoryLoader(PDFS_PATH, glob='*.pdf', loader_cls=PyPDFLoader)
    documents = loader.load()
    if not documents:
        print(f"No PDF documents found in the '{PDFS_PATH}' directory.")
        return

    print(f"Loaded {len(documents)} document(s).")
    
    print("Splitting documents into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    texts = text_splitter.split_documents(documents)
    print(f"Split documents into {len(texts)} chunks.")

    print("Creating embeddings using Google's API (models/text-embedding-004)...")
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004", 
        google_api_key=GOOGLE_API_KEY
    )

    print("Uploading document chunks and embeddings to MongoDB Atlas...")
    MongoDBAtlasVectorSearch.from_documents(
        documents=texts,
        embedding=embeddings,
        collection=collection,
        index_name=INDEX_NAME
    )
    
    print("Vector database in MongoDB Atlas has been created and populated successfully!")


if __name__ == "__main__":
    client = MongoClient(MONGODB_URL)
    collection = client[DB_NAME][COLLECTION_NAME]
    
    if collection.count_documents({}) > 0:
        response = input(f"Collection '{COLLECTION_NAME}' is not empty. "
                         "Do you want to clear it and re-populate? (y/n): ")
        if response.lower() != 'y':
            print("Operation cancelled.")
            exit()

    collection.delete_many({})
    print(f"Cleared existing documents from the '{COLLECTION_NAME}' collection.")
    
    create_vector_db()
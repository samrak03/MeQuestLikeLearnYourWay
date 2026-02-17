
import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: parseInt(process.env.PORT, 10) || 4000,
    mysql: {
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_NAME,
    },
    postgres: {
        host: process.env.POSTGRES_HOST,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB || 'mequest_rag_db',
        port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    },
    jwtSecret: process.env.JWT_SECRET || 'secret-key',
    llm: {
        geckoUrl: process.env.GECKO_LLM_URL || "http://localhost:8001/generate",
        solarUrl: process.env.SOLAR_LLM_URL || "http://localhost:8001/summarize",
        exaoneUrl: process.env.EXAONE_LLM_URL || "http://localhost:8001/feedback",
        embeddingUrl: (process.env.EXPRESS_EMBEDDING_URL || "http://localhost:8000/embeddings").replace(/\/$/, "")
    }
};

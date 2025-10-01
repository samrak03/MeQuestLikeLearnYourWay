// services/embeddingService.js
import axios from "axios";
import { pgPool } from "../config/db.postgres.js";

//const EMB_URL = process.env.EXPRESS_EMBEDDING_URL; // http://localhost:8000/embeddings

// .env가 베이스만 들어와도 /embeddings를 자동으로 붙여줌
const RAW = (process.env.EXPRESS_EMBEDDING_URL || "").trim();
const EMB_URL = RAW
  ? (RAW.match(/\/embeddings\/?$/)
      ? RAW.replace(/\/$/, "")
      : RAW.replace(/\/$/, "") + "/embeddings")
  : "http://localhost:8000/embeddings";



// 1) 텍스트를 벡터로
export async function embedText(text) {
  if (!EMB_URL) throw new Error("EXPRESS_EMBEDDING_URL is not set");
  try {
    const { data } = await axios.post(
      EMB_URL,
      { input: String(text ?? "") },
      { timeout: 20_000, headers: { "Content-Type": "application/json" } }
    );
    const vec = data?.embedding;
    if (!Array.isArray(vec)) {
      throw new Error(`Invalid embedding response from ${EMB_URL}: ${JSON.stringify(data).slice(0, 200)}...`);
    }
    return vec.map(Number);
  } catch (error) {
    const status = error?.response?.status;
    const url = error?.config?.url;
    throw new Error(`Embedding POST failed status=${status} url=${url} msg=${error.message}`);
  }
}

function toVectorLiteral(vec) {
  if (!Array.isArray(vec) || vec.length === 0) throw new Error("Vector is empty");
  const nums = vec.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error("Vector contains non-numeric value");
    return n;
  });
  // pgvector 리터럴
  return `[${nums.join(",")}]`;
}


// 2) 벡터 검색 (pgvector, ivfflat)
export async function searchByVector(vector, topK = 5, filter = {}) {
   const client = await pgPool.connect();
   try {
     // pgvector는 문자열 리터럴 "[...]" + ::vector 캐스팅이 가장 안전
     const vecLit = toVectorLiteral(vector);  // "[0.5,0.5,0.5]" 형태
     const where = [];
     const values = [vecLit, topK];
     let idx = 3;

     if (filter.model) {
       where.push(`model = $${idx++}`);
       values.push(filter.model);
     }
     if (filter.source) {
       where.push(`"source" = $${idx++}`);
       values.push(filter.source);
     }

     const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
     const sql = `
      SELECT id, model, "source", ref_id, content, embedding <-> $1::vector AS distance
      FROM embeddings
      ${whereSql}
      ORDER BY embedding <-> $1::vector
      LIMIT $2
    `;
     const res = await client.query(sql, values);
     return res.rows; // [{id, content, distance, ...}]
   } finally {
     client.release();
   }
 }

// 3) 텍스트 검색 (텍스트→벡터→pgvector)
export async function searchByText(query, topK = 5, filter = {}) {
  const vector = await embedText(query);
  return searchByVector(vector, topK, filter);
}



import axios from "axios";
import { useState } from "react";

function ChatBot() {

  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [error, setError] = useState("");

  const ask = async () => {
    setError("");
    try {
      const res = await axios.post(
        "http://localhost:5000/chat",
        { question: q }
      );

      setA(res.data.answer);
    } catch (err) {
      setError("Failed to get response. Please try again.");
      console.error(err);
    }
  };

  return (

    <div className="max-w-xl mx-auto mt-8 bg-white shadow-lg p-6 rounded">

      <h2 className="text-xl font-bold mb-4">Recruiter Chatbot</h2>

      <input
        type="text"
        className="border p-2 w-full mb-3"
        placeholder="Ask question..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <button
        onClick={ask}
        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
      >
        Ask
      </button>

      {error && (
        <div className="mt-4 bg-red-100 border border-red-400 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      {a && !error && (
        <div className="mt-4 bg-gray-100 p-3 rounded">
          {a}
        </div>
      )}

    </div>

  );
}

export default ChatBot;
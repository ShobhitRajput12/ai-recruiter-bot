import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "./config";

function CandidateList() {

  const [data, setData] = useState([]);
  const [sortOrder, setSortOrder] = useState("desc");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/candidates`)
      .then(res => setData(res.data));
  }, []);

  return (

    <div className="max-w-3xl mx-auto mt-8">

      <h2 className="text-2xl font-bold mb-4">Top Candidates</h2>

      <select
        className="border rounded p-2 mb-4"
        value={sortOrder}
        onChange={(event) => setSortOrder(event.target.value)}
      >
        <option value="desc">Sort by final score: Highest first</option>
        <option value="asc">Sort by final score: Lowest first</option>
      </select>

      {data
        .sort((a, b) => {
          const leftScore = a.finalScore ?? a.final_score ?? a.totalScore ?? a.score ?? 0;
          const rightScore = b.finalScore ?? b.final_score ?? b.totalScore ?? b.score ?? 0;

          return sortOrder === "asc"
            ? leftScore - rightScore
            : rightScore - leftScore;
        })
        .map(c => (

        <div
          key={c._id}
          className="bg-white shadow-md p-4 rounded mb-4"
        >

          <h3 className="font-semibold text-lg">{c.name}</h3>

          <p className="text-green-600 font-bold">
            Score: {c.finalScore ?? c.totalScore ?? c.score}
          </p>

          <p className="text-gray-600">{c.remarks || c.reason}</p>

          <p className="text-sm text-gray-500 mt-2">
            Technical: {c.technicalScore ?? "-"} | Software / Soft: {c.softwareSoftSkillsScore ?? "-"} | Experience: {c.experienceMatch ?? "-"}
          </p>

        </div>

      ))}

    </div>

  );
}

export default CandidateList;

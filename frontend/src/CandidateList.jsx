import { useEffect, useState } from "react";
import axios from "axios";

function CandidateList() {

  const [data, setData] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:5000/candidates")
      .then(res => setData(res.data));
  }, []);

  return (

    <div className="max-w-3xl mx-auto mt-8">

      <h2 className="text-2xl font-bold mb-4">Top Candidates</h2>

      {data.sort((a, b) => b.score - a.score).map(c => (

        <div
          key={c._id}
          className="bg-white shadow-md p-4 rounded mb-4"
        >

          <h3 className="font-semibold text-lg">{c.name}</h3>

          <p className="text-green-600 font-bold">
            Score: {c.score}
          </p>

          <p className="text-gray-600">{c.reason}</p>

        </div>

      ))}

    </div>

  );
}

export default CandidateList;
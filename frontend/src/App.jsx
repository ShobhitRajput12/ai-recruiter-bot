import React, { useState, useEffect } from "react";

function App() {

const [files,setFiles] = useState([]);
const [job,setJob] = useState("");
const [candidates,setCandidates] = useState([]);
const [latestCandidates,setLatestCandidates] = useState([]);
const [topCandidates,setTopCandidates] = useState([]);
const [question,setQuestion] = useState("");
const [answer,setAnswer] = useState("");
const [loading,setLoading] = useState(false);

// Load candidates on component mount
useEffect(() => {
  loadCandidates();
}, []);

const loadCandidates = async () => {
  try {
    const [latestRes, topRes] = await Promise.all([
      fetch("http://localhost:5000/candidates/latest"),
      fetch("http://localhost:5000/candidates/top")
    ]);
    
    const latestData = await latestRes.json();
    const topData = await topRes.json();
    
    setLatestCandidates(latestData);
    setTopCandidates(topData);
  } catch (err) {
    console.error("Failed to load candidates:", err);
  }
};

const handleFileChange = (e)=>{
setFiles(e.target.files);
};

const uploadResumes = async ()=>{
  setLoading(true);
  try {
    const formData = new FormData();

    for(let i=0;i<files.length;i++){
      formData.append("resumes",files[i]);
    }

    formData.append("job",job);

    const res = await fetch("http://localhost:5000/upload",{
      method:"POST",
      body:formData
    });

    const data = await res.json();

    data.candidates.sort((a,b)=>b.score-a.score);

    setCandidates(data.candidates);
    
    // Refresh the candidate lists
    await loadCandidates();
    
  } catch (err) {
    console.error("Upload failed:", err);
  } finally {
    setLoading(false);
  }
};

const askChatbot = async ()=>{

const res = await fetch("http://localhost:5000/chat",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({question})
});

const data = await res.json();

setAnswer(data.answer);

};

// Candidate Card Component
const CandidateCard = ({ candidate, showDate = false }) => (
  <div className="border p-4 rounded mb-4 bg-gray-50">
    <h3 className="font-semibold text-lg">{candidate.name}</h3>
    <p className="mb-2 text-green-600 font-medium">Score: {candidate.score}/100</p>
    <div className="w-full bg-gray-200 rounded h-4 mb-2">
      <div
        className="bg-green-500 h-4 rounded"
        style={{width:`${candidate.score}%`}}
      ></div>
    </div>
    {showDate && candidate.createdAt && (
      <p className="text-sm text-gray-500">
        Uploaded: {new Date(candidate.createdAt).toLocaleDateString()}
      </p>
    )}
  </div>
);

return (

<div className="min-h-screen bg-gray-100 p-10">

<h1 className="text-3xl font-bold mb-6">AI Recruiter Assistant</h1>

{/* Upload Section */}

<div className="bg-white p-6 rounded-lg shadow mb-8">

<h2 className="text-xl font-semibold mb-4">Upload Resumes</h2>

<input
type="file"
multiple
onChange={handleFileChange}
className="mb-4"
/>

<textarea
placeholder="Paste Job Description"
className="w-full border p-2 rounded mb-4"
rows="4"
value={job}
onChange={(e)=>setJob(e.target.value)}
/>

<button
onClick={uploadResumes}
disabled={loading}
className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
>
{loading ? "Uploading..." : "Upload"}
</button>

</div>

{/* Candidates Sections */}

<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

{/* Latest Candidates */}
<div className="bg-white p-6 rounded-lg shadow">
<h2 className="text-xl font-semibold mb-4">📅 Latest Candidates</h2>
<p className="text-gray-600 mb-4">Recently uploaded resumes</p>

{latestCandidates.length === 0 ? (
  <p className="text-gray-500">No candidates uploaded yet</p>
) : (
  latestCandidates.map((c,index)=>(
    <CandidateCard key={index} candidate={c} showDate={true} />
  ))
)}

</div>

{/* Top Candidates */}
<div className="bg-white p-6 rounded-lg shadow">
<h2 className="text-xl font-semibold mb-4">🏆 Top Candidates</h2>
<p className="text-gray-600 mb-4">Ranked by highest scores</p>

{topCandidates.length === 0 ? (
  <p className="text-gray-500">No candidates available</p>
) : (
  topCandidates.map((c,index)=>(
    <CandidateCard key={index} candidate={c} />
  ))
)}

</div>

</div>

{/* Chatbot */}

<div className="bg-white p-6 rounded-lg shadow">

<h2 className="text-xl font-semibold mb-4">Recruiter Chatbot</h2>

<div className="flex gap-2">

<input
type="text"
placeholder="Ask question..."
className="border p-2 flex-1 rounded"
value={question}
onChange={(e)=>setQuestion(e.target.value)}
/>

<button
onClick={askChatbot}
className="bg-green-500 text-white px-4 rounded hover:bg-green-600"
>
Ask
</button>

</div>

<p className="mt-4">{answer}</p>

</div>

</div>

);

}

export default App;
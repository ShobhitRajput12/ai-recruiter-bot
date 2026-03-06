import React, { useState } from "react";

function App() {

const [files,setFiles] = useState([]);
const [job,setJob] = useState("");
const [candidates,setCandidates] = useState([]);
const [question,setQuestion] = useState("");
const [answer,setAnswer] = useState("");

const handleFileChange = (e)=>{
setFiles(e.target.files);
};

const uploadResumes = async ()=>{

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
className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
>
Upload
</button>

</div>

{/* Candidates */}

<div className="bg-white p-6 rounded-lg shadow mb-8">

<h2 className="text-xl font-semibold mb-4">Top Candidates</h2>

{candidates.map((c,index)=>(

<div key={index} className="border p-4 rounded mb-4">

<h3 className="font-semibold">{c.name}</h3>

<p className="mb-2">Score: {c.score}/100</p>

<div className="w-full bg-gray-200 rounded h-4">

<div
className="bg-green-500 h-4 rounded"
style={{width:`${c.score}%`}}
></div>

</div>

</div>

))}

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
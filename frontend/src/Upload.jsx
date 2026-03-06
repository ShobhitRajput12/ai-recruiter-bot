import axios from "axios";
import { useState } from "react";
import { API_BASE_URL } from "./config";

function Upload() {
  const [files, setFiles] = useState(null);
  const [job, setJob] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!files || !job) {
      alert("Please select files and enter job description");
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("resumes", files[i]);
    }
    formData.append("job", job);

    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Resumes uploaded successfully!");
      setFiles(null);
      setJob("");
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white shadow-lg p-6 rounded">
      <h2 className="text-2xl font-bold mb-4">Upload Resumes</h2>
      <textarea
        className="border p-2 w-full mb-3"
        placeholder="Enter job description..."
        value={job}
        onChange={(e) => setJob(e.target.value)}
        rows="4"
      />
      <input
        type="file"
        multiple
        accept=".pdf,.docx,.doc"
        className="border p-2 w-full mb-3"
        onChange={(e) => setFiles(e.target.files)}
      />
      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}

export default Upload;
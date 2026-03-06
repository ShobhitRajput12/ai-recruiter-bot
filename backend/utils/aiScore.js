const axios = require("axios");

async function scoreResume(resume, job) {

try {

const prompt = `
Compare this resume with the job description.

Job Description:
${job}

Resume:
${resume}

Give a score from 0 to 100.
Only return the number.
`;

const response = await axios.post(
"https://api.groq.com/openai/v1/chat/completions",
{
model: "llama-3.1-8b-instant",
messages: [
{
role: "user",
content: prompt
}
]
},
{
headers: {
Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
"Content-Type": "application/json"
}
}
);

const text = response.data.choices[0].message.content;

const score = parseInt(text.match(/\d+/)?.[0]) || 60;

return score;

} catch (error) {

console.log("Groq Error:", error.response?.data || error.message);

return Math.floor(Math.random() * 40) + 60;

}

}

module.exports = scoreResume;
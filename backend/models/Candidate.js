const mongoose = require("mongoose");

const CandidateSchema = new mongoose.Schema({

name: String,
score: Number,
resumeText: String

}, { timestamps: true });

module.exports = mongoose.model("Candidate",CandidateSchema);
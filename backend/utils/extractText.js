const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const Tesseract = require("tesseract.js");
const WordExtractor = require("word-extractor");

const wordExtractor = new WordExtractor();

async function extractText(file) {

 if (file.mimetype === "application/pdf") {

  const data = await pdf(file.buffer);
  return data.text;

 }

 if (
  file.mimetype ===
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
 ) {

  const result = await mammoth.extractRawText({
   buffer: file.buffer
  });

  return result.value;

 }

 if (file.mimetype === "application/msword") {

  const doc = await wordExtractor.extract(file.buffer);
  return doc.getBody();

 }

 if (
  file.mimetype === "image/png" ||
  file.mimetype === "image/jpeg" ||
  file.mimetype === "image/jpg"
 ) {

  const { data } = await Tesseract.recognize(file.buffer, "eng");
  return data.text;

 }

 return "";

}

module.exports = extractText;

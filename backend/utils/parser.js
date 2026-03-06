const pdfParse = require("pdf-parse");

async function parseFile(file){

const data = await pdfParse(file.buffer);

return data.text;

}

module.exports = parseFile;
var assembler = require('./hmmm-assembler');
var HmmmLexer = assembler.lexer;
var HmmmParser = assembler.parser;

if (process && process.argv) {
  
  var fs = require('fs');
  var source = fs.readFileSync(process.argv[2]).toString();
  
  var lexer = new HmmmLexer();
  var tokens = lexer.lex(source);
  
  var parser = new HmmmParser();
  var assembled = parser.parse(tokens, source);
  
  console.log(assembled);
  
}
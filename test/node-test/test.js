const a = require('./a.js');

const intervalID = setInterval(myCallback, 1000);

let i = 0;

function myCallback() {
  console.log(`callback:${i++}, msg:${a.getStr('john')}`);
}
